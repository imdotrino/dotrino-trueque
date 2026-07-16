<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, watchEffect, nextTick } from 'vue'
import { initIdentity, getMyPubkey, getIdentity } from './services/identity'
import { getGeo } from './services/geo'
import { contactSeller } from './services/proxy'
import { getReputation } from './services/reputation'
import { createVaultProfileProvider } from '@dotrino/profile'
import '@dotrino/profile'
import { useBackLayer } from '@dotrino/nav/vue'
// Barra superior estándar del ecosistema (CONVENCIONES §5): trae marca, volver,
// perfil (§6.1) y moneda de support en un solo componente. No la re-armamos.
import '@dotrino/topbar'

const KINDS = [
  { id: 'vendo', label: 'Vendo', color: 'var(--vendo)' },
  { id: 'regalo', label: 'Regalo', color: 'var(--regalo)' },
  { id: 'busco', label: 'Busco', color: 'var(--busco)' }
]
const kindOf = id => KINDS.find(k => k.id === id) || KINDS[0]

const ready = ref(false)
const idError = ref('')
const pos = ref(null)            // { lat, lng }
const locating = ref(false)
const geoError = ref('')

const pins = ref([])
const loading = ref(false)
const netError = ref('')

const radiusMeters = ref(2000)
const filter = ref('todos')      // 'todos' | 'vendo' | 'regalo' | 'busco'

const myPin = ref(null)          // { payload, expiresAt }
const now = ref(Date.now())

const showPublish = ref(false)
const form = reactive({ kind: 'vendo', title: '', price: '', tags: '', ttlH: 6 })
const publishing = ref(false)

const contactTarget = ref(null)
const contactText = ref('')
const sending = ref(false)

// Volver unificado (@dotrino/nav): el botón físico / chevron
// cierra el modal abierto antes de salir hacia dotrino.com.
useBackLayer(showPublish)
useBackLayer(contactTarget, { onClose: () => { contactTarget.value = null } })

const toast = ref('')
let toastTimer = null
function flash (msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 3000)
}

const radiusLabel = computed(() =>
  radiusMeters.value >= 1000 ? `${(radiusMeters.value / 1000).toFixed(1)} km` : `${radiusMeters.value} m`
)

const myPinLeft = computed(() => {
  if (!myPin.value) return ''
  const ms = myPin.value.expiresAt - now.value
  if (ms <= 0) return 'expirado'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
})

function fmtDist (m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

// ---- arranque ----
let poll = null
let clock = null
let watchId = null

onMounted(async () => {
  try {
    identityInst.value = await initIdentity()
    ready.value = true
  } catch (e) {
    idError.value = 'No se pudo abrir el vault de identidad (id.dotrino.com).'
    console.warn(e)
  }
  // Reputación para el modal de perfil del topbar (sin ella, el botón solo abre
  // la ficha sin web-of-trust).
  if (identityInst.value) {
    try { reputationInst.value = await getReputation() } catch (_) { /* sin registro */ }
  }
  startLocate()
  poll = setInterval(() => { if (pos.value && ready.value) refresh() }, 15000)
  clock = setInterval(() => { now.value = Date.now() }, 30000)
})

onUnmounted(() => {
  clearInterval(poll); clearInterval(clock)
  if (watchId != null) navigator.geolocation.clearWatch(watchId)
})

function startLocate () {
  if (!('geolocation' in navigator)) { geoError.value = 'Tu navegador no tiene geolocalización.'; return }
  locating.value = true
  geoError.value = ''
  navigator.geolocation.getCurrentPosition(onPos, onGeoErr, { enableHighAccuracy: true, timeout: 12000 })
  watchId = navigator.geolocation.watchPosition(onPos, onGeoErr, { enableHighAccuracy: true, maximumAge: 10000 })
}
function onPos (p) {
  locating.value = false
  const first = !pos.value
  pos.value = { lat: p.coords.latitude, lng: p.coords.longitude }
  drawRadar()
  if (first && ready.value) refresh()
}
function onGeoErr (e) {
  locating.value = false
  geoError.value = e.code === 1
    ? 'Permiso de ubicación denegado. Habilitalo para ver anuncios cerca.'
    : 'No se pudo obtener tu ubicación.'
}

// ---- consultar ----
async function refresh () {
  if (!pos.value || !ready.value) return
  loading.value = true
  netError.value = ''
  try {
    const q = { lat: pos.value.lat, lng: pos.value.lng, radiusMeters: radiusMeters.value, limit: 100 }
    if (filter.value !== 'todos') q.filter = { kind: filter.value }
    const tags = searchTags.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    if (tags.length) q.tags = tags
    const { pins: got } = await getGeo().queryRadius(q)
    const mine = getMyPubkey()
    pins.value = got
      .filter(p => p.publickey !== mine)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
    await nextTick(); drawRadar()
  } catch (e) {
    netError.value = 'No se pudieron cargar los anuncios.'
    console.warn(e)
  } finally {
    loading.value = false
  }
}
const searchTags = ref('')   // búsqueda por etiquetas (overlap)
let tagDebounce = null
watch([radiusMeters, filter], () => { if (pos.value && ready.value) refresh() })
watch(searchTags, () => { clearTimeout(tagDebounce); tagDebounce = setTimeout(() => { if (pos.value && ready.value) refresh() }, 400) })

// ---- publicar ----
async function doPublish () {
  if (!form.title.trim()) { flash('Ponele un título al anuncio.'); return }
  if (!pos.value) { flash('Necesito tu ubicación para publicar.'); return }
  publishing.value = true
  try {
    const payload = { kind: form.kind, title: form.title.trim().slice(0, 80) }
    if (form.kind === 'vendo' && form.price.trim()) payload.price = form.price.trim().slice(0, 24)
    const tags = form.tags.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    const ttlMs = Number(form.ttlH) * 3600 * 1000
    const res = await getGeo().publishPin({ lat: pos.value.lat, lng: pos.value.lng, payload, tags, ttlMs })
    myPin.value = { payload, expiresAt: res.expiresAt }
    showPublish.value = false
    form.title = ''; form.price = ''; form.tags = ''
    flash('Anuncio publicado.')
    refresh()
  } catch (e) {
    flash('No se pudo publicar.')
    console.warn(e)
  } finally {
    publishing.value = false
  }
}
async function removeMine () {
  try {
    await getGeo().removePin()
    myPin.value = null
    flash('Anuncio retirado.')
    refresh()
  } catch (e) { flash('No se pudo retirar.'); console.warn(e) }
}

// ---- contactar (handoff por el proxy) + perfil/reputación ----
// El perfil + reputación del vendedor (y el calificarlo) lo maneja la tarjeta
// compartida <dotrino-profile> dentro del modal de contacto.
function openContact (pin) {
  contactTarget.value = pin
  contactText.value = `Hola, me interesa tu anuncio "${pin.payload?.title || ''}".`
}

// Provider del perfil: cablea identidad + registro de reputación del ecosistema.
let _profileProvider = null
async function ensureProfileProvider () {
  if (_profileProvider) return _profileProvider
  try {
    const [identity, reputation] = await Promise.all([getIdentity(), getReputation()])
    if (reputation) _profileProvider = createVaultProfileProvider({ identity, reputation })
  } catch (_) { /* sin provider el componente muestra "registro no disponible" */ }
  return _profileProvider
}
function bindProfile (el) {
  if (!el) return
  ensureProfileProvider().then((p) => { if (p) el.provider = p })
}
function onProfileRate () { flash('Calificación publicada. Gracias.') }
const profileTheme = {
  '--ccp-bg': 'var(--panel)',
  '--ccp-bg-2': 'var(--panel2)',
  '--ccp-bg-3': 'var(--panel2)',
  '--ccp-bg-4': 'var(--line)',
  '--ccp-border': 'var(--line)',
  '--ccp-text': 'var(--text)',
  '--ccp-muted': 'var(--muted)',
  '--ccp-accent': 'var(--accent)',
  '--ccp-accent-2': '#23b8a6',
  '--ccp-gold': 'var(--vendo)',
  '--ccp-derived': 'var(--vendo)',
  '--ccp-online': 'var(--regalo)',
  '--ccp-affinity': 'var(--accent)',
  '--ccp-input-bg': 'var(--panel2)',
  '--ccp-radius': '12px',
}

// "Mi perfil" (§6.1): el topbar es dueño del botón Y del modal <dotrino-profile
// mode="self">. Solo le pasamos las instancias del vault + el tema; así la app no
// fija la versión de @dotrino/profile (viaja dentro de @dotrino/topbar).
const identityInst = ref(null)
const reputationInst = ref(null)
const topbarRef = ref(null)
watchEffect(() => {
  const tb = topbarRef.value
  if (!tb) return
  tb.identity = identityInst.value ?? null
  tb.reputation = reputationInst.value ?? null
  tb.profileTheme = profileTheme
})

async function sendContact () {
  if (!contactTarget.value) return
  sending.value = true
  try {
    await contactSeller(contactTarget.value.publickey, {
      title: contactTarget.value.payload?.title || '',
      text: contactText.value.trim().slice(0, 280)
    })
    flash('Mensaje enviado. Sigue la charla en el messenger.')
    contactTarget.value = null
  } catch (e) {
    flash('No se pudo contactar (proxy/identidad).')
    console.warn(e)
  } finally {
    sending.value = false
  }
}
// ---- radar (proximidad, sin tiles de terceros) ----
const canvas = ref(null)
function drawRadar () {
  const cv = canvas.value
  if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const size = cv.clientWidth
  cv.width = size * dpr; cv.height = size * dpr
  const ctx = cv.getContext('2d')
  ctx.scale(dpr, dpr)
  const cx = size / 2, cy = size / 2, R = size / 2 - 6
  ctx.clearRect(0, 0, size, size)

  // anillos
  ctx.strokeStyle = 'rgba(45,212,191,.18)'
  ctx.lineWidth = 1
  for (const f of [0.33, 0.66, 1]) {
    ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke()
  }
  // ejes
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()

  // yo
  ctx.fillStyle = '#2dd4bf'
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()

  if (!pos.value) return
  const mLat = 111320
  const mLng = 111320 * Math.cos(pos.value.lat * Math.PI / 180)
  for (const p of pins.value) {
    const dx = (p.lng - pos.value.lng) * mLng
    const dy = (p.lat - pos.value.lat) * mLat
    const d = Math.min(radiusMeters.value, p.distanceMeters || Math.hypot(dx, dy))
    const ang = Math.atan2(dx, dy) // 0 = norte
    const rr = (d / radiusMeters.value) * R
    const x = cx + Math.sin(ang) * rr
    const y = cy - Math.cos(ang) * rr
    ctx.fillStyle = kindOf(p.payload?.kind).color
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
  }
}
window.addEventListener('resize', drawRadar)
</script>

<template>
  <div class="app">
    <!-- Barra superior estándar (§5): marca + volver + perfil + moneda de support.
         `no-lang`: la app es solo en español (falta el i18n es/en, §9).
         `:lang.attr`: OJO, tiene que ir como ATRIBUTO. El componente define
         `get lang()` sin setter, así que Vue (que en un custom element prefiere la
         propiedad cuando `'lang' in el`) no lograría escribirlo: se perdería en
         silencio y el topbar caería a navigator.language, poniendo <html lang="en">
         en una app que solo habla español. -->
    <dotrino-topbar
      ref="topbarRef"
      class="topbar"
      brand="Trueque"
      icon="/icon.svg"
      brand-href="./"
      :lang.attr="'es'"
      no-lang
      profile
      support-href="https://ko-fi.com/dotrino"
      support-repo="imdotrino/dotrino-trueque"
      support-discord="https://discord.gg/D648uq7cth">
      <dotrino-install slot="end" class="cc-install" data-testid="install-btn"></dotrino-install>
    </dotrino-topbar>

    <main class="main">
      <p v-if="idError" class="banner err">{{ idError }}</p>
      <p v-if="geoError" class="banner err">
        {{ geoError }}
        <button class="btn small" @click="startLocate">Reintentar</button>
      </p>

      <!-- controles -->
      <div class="controls">
        <div class="chips">
          <button class="chip" :class="{ on: filter === 'todos' }" @click="filter = 'todos'">Todos</button>
          <button v-for="k in KINDS" :key="k.id" class="chip"
                  :class="{ on: filter === k.id }"
                  :style="filter === k.id ? { background: k.color, color: '#04140f', borderColor: 'transparent' } : {}"
                  @click="filter = k.id">{{ k.label }}</button>
        </div>
        <input class="tagSearch" v-model="searchTags" maxlength="80"
               placeholder="Buscar por etiqueta: bici, comida…" />
        <div class="radius">
          <span class="muted">Radio</span>
          <input type="range" min="300" max="10000" step="100" v-model.number="radiusMeters" />
          <strong>{{ radiusLabel }}</strong>
        </div>
      </div>

      <!-- radar -->
      <div class="radarWrap">
        <canvas ref="canvas" class="radar"></canvas>
        <div v-if="locating" class="radarHint">Ubicándote…</div>
        <div v-else-if="!pos" class="radarHint">Activa la ubicación</div>
        <div v-else class="radarScale">{{ radiusLabel }}</div>
      </div>

      <!-- mi anuncio -->
      <div v-if="myPin" class="myPin">
        <span class="badge" :style="{ background: kindOf(myPin.payload.kind).color }">{{ kindOf(myPin.payload.kind).label }}</span>
        <span class="myTitle">{{ myPin.payload.title }}</span>
        <span class="muted ttl">expira en {{ myPinLeft }}</span>
        <button class="btn danger small" @click="removeMine">Retirar</button>
      </div>

      <!-- lista -->
      <div class="listHead">
        <h2>Cerca de ti <span class="muted" v-if="!loading">({{ pins.length }})</span></h2>
        <button class="btn ghost small" :disabled="loading || !pos" @click="refresh">{{ loading ? '…' : 'Actualizar' }}</button>
      </div>
      <p v-if="netError" class="banner err">{{ netError }}</p>

      <ul class="list">
        <li v-for="p in pins" :key="p.publickey" class="card">
          <span class="badge" :style="{ background: kindOf(p.payload?.kind).color }">{{ kindOf(p.payload?.kind).label }}</span>
          <div class="cardBody">
            <div class="cardTitle">{{ p.payload?.title || '(sin título)' }}</div>
            <div class="cardMeta">
              <span v-if="p.payload?.price" class="price">{{ p.payload.price }}</span>
              <span class="muted">{{ fmtDist(p.distanceMeters) }}</span>
            </div>
          </div>
          <button class="btn primary small" @click="openContact(p)">Contactar</button>
        </li>
        <li v-if="!pins.length && pos && !loading" class="empty">
          No hay anuncios en {{ radiusLabel }}. Sube el radio o publica el primero.
        </li>
      </ul>
    </main>

    <!-- FAB publicar -->
    <button class="fab" :disabled="!ready || !pos" @click="showPublish = true" title="Publicar anuncio">+</button>

    <!-- modal publicar -->
    <div v-if="showPublish" class="modal" @click.self="showPublish = false">
      <div class="sheet">
        <h3>Publicar anuncio</h3>
        <div class="kindPick">
          <button v-for="k in KINDS" :key="k.id" class="chip"
                  :class="{ on: form.kind === k.id }"
                  :style="form.kind === k.id ? { background: k.color, color: '#04140f', borderColor: 'transparent' } : {}"
                  @click="form.kind = k.id">{{ k.label }}</button>
        </div>
        <label class="fld">
          <span>Título</span>
          <input v-model="form.title" maxlength="80" placeholder="Ej: Bici rodado 26, casi nueva" />
        </label>
        <label v-if="form.kind === 'vendo'" class="fld">
          <span>Precio (opcional)</span>
          <input v-model="form.price" maxlength="24" placeholder="Ej: $80 / negociable" />
        </label>
        <label class="fld">
          <span>Etiquetas (opcional, separadas por coma)</span>
          <input v-model="form.tags" maxlength="120" placeholder="Ej: bici, rodado26, usado" />
        </label>
        <label class="fld">
          <span>Vence en</span>
          <select v-model.number="form.ttlH">
            <option :value="1">1 hora</option>
            <option :value="6">6 horas</option>
            <option :value="24">24 horas (máx)</option>
          </select>
        </label>
        <p class="muted tiny">Tu anuncio es efímero y anónimo: lleva tu identidad para que te contacten por el messenger, sin guardar tu ubicación.</p>
        <div class="sheetBtns">
          <button class="btn ghost" @click="showPublish = false">Cancelar</button>
          <button class="btn primary" :disabled="publishing" @click="doPublish">{{ publishing ? 'Publicando…' : 'Publicar' }}</button>
        </div>
      </div>
    </div>

    <!-- modal contactar -->
    <div v-if="contactTarget" class="modal" @click.self="contactTarget = null">
      <div class="sheet">
        <h3>Contactar</h3>
        <p class="muted small">Sobre: <strong>{{ contactTarget.payload?.title }}</strong></p>

        <!-- Perfil + reputación del vendedor (y calificarlo) — tarjeta compartida -->
        <dotrino-profile
          :ref="bindProfile"
          mode="edit"
          :style="profileTheme"
          :pubkey="contactTarget.publickey"
          name="Vendedor"
          @cc-profile-rate="onProfileRate"
        ></dotrino-profile>

        <label class="fld">
          <span>Mensaje</span>
          <input v-model="contactText" maxlength="280" />
        </label>
        <p class="muted tiny">Se envía por el proxy (cae en su messenger). Sigue la charla ahí.</p>

        <div class="sheetBtns">
          <button class="btn ghost" @click="contactTarget = null">Cerrar</button>
          <button class="btn primary" :disabled="sending" @click="sendContact">{{ sending ? 'Enviando…' : 'Enviar' }}</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.app { min-height: 100%; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }

.rep { display: flex; align-items: center; gap: .5rem; background: var(--panel2); border: 1px solid var(--line); border-radius: .6rem; padding: .5rem .7rem; margin: .2rem 0 .6rem; }
.repLabel { font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.repScore { display: flex; align-items: center; gap: .5rem; }
.repScore strong { color: var(--accent); font-size: 1.05rem; }
.rateRow { display: flex; align-items: center; justify-content: space-between; gap: .6rem; margin: .2rem 0 .6rem; }
.rateStars { display: inline-flex; gap: .1rem; }
.starBtn { font-size: 1.3rem; color: var(--line); line-height: 1; padding: 0 .05rem; }
.starBtn.on { color: var(--vendo); }
.starBtn.afin.on { color: var(--accent); }
.starBtn:disabled { opacity: .6; }
.tagSearch { width: 100%; }
.afinScore { color: var(--accent); }

/* El <dotrino-topbar> trae la barra; acá solo el tema de la app y el sticky
   (el .bar del componente no lo es). */
.topbar {
  position: sticky; top: 0; z-index: 5;
  --dotrino-topbar-bg: var(--panel);
  --dotrino-topbar-border: var(--line);
  --dotrino-topbar-text: var(--text);
  --dotrino-topbar-muted: var(--muted);
  --dotrino-topbar-accent: var(--accent);
  --dotrino-topbar-accent-text: var(--accent-ink);
}
.topbar::part(brand-name) { font-weight: 800; font-size: 1.1rem; }
/* Botón de perfil: circular ghost, como el resto de controles de la app. */
.topbar::part(profile) { width: 34px; height: 34px; background: var(--panel2); color: var(--text); }
/* "Instalar App": Web Component compartido con el look del antiguo botón ghost small. */
.cc-install {
  flex-shrink: 0;
  --cc-install-color: var(--text);
  --cc-install-radius: 999px;
  --cc-install-gap: 6px;
  --cc-install-icon: 15px;
  --cc-install-font-size: .85rem;
  --cc-install-bg-hover: var(--panel2);
  --cc-install-accent: var(--accent);
}
.cc-install::part(button) {
  padding: .4rem .6rem;
  border: 1px solid var(--line);
  background: transparent;
  font-weight: 600;
}
.main { flex: 1; width: 100%; max-width: 680px; margin: 0 auto; padding: .8rem; }

.banner { padding: .6rem .8rem; border-radius: .6rem; margin: .4rem 0; display: flex; gap: .6rem; align-items: center; }
.banner.err { background: #2a1620; color: #ffb4b4; border: 1px solid #5a2a3a; }

.controls { display: flex; flex-direction: column; gap: .6rem; margin: .4rem 0 .8rem; }
.chips { display: flex; gap: .4rem; flex-wrap: wrap; }
.chip {
  border: 1px solid var(--line); background: var(--panel2); color: var(--text);
  padding: .4rem .7rem; border-radius: 999px; font-weight: 600; font-size: .9rem;
}
.chip.on { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
.radius { display: flex; align-items: center; gap: .6rem; }
.radius input[type=range] { flex: 1; accent-color: var(--accent); }

.radarWrap { position: relative; width: min(78vw, 360px); margin: .4rem auto 1rem; aspect-ratio: 1; }
.radar { width: 100%; height: 100%; background: radial-gradient(circle at center, #0e1726, #0a0e14 70%); border-radius: 50%; border: 1px solid var(--line); }
.radarHint, .radarScale { position: absolute; left: 50%; transform: translateX(-50%); color: var(--muted); font-size: .85rem; }
.radarHint { top: 50%; transform: translate(-50%, -50%); }
.radarScale { bottom: 6px; font-size: .75rem; }

.myPin { display: flex; align-items: center; gap: .5rem; background: var(--panel); border: 1px solid var(--accent); border-radius: .7rem; padding: .5rem .7rem; margin-bottom: .8rem; }
.myTitle { font-weight: 600; }
.myPin .ttl { margin-left: auto; font-size: .8rem; }

.listHead { display: flex; align-items: center; justify-content: space-between; margin: .4rem 0; }
.listHead h2 { font-size: 1rem; margin: 0; }

.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .5rem; }
.card { display: flex; align-items: center; gap: .6rem; background: var(--panel); border: 1px solid var(--line); border-radius: .7rem; padding: .6rem .7rem; }
.cardBody { flex: 1; min-width: 0; }
.cardTitle { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cardMeta { display: flex; gap: .6rem; font-size: .85rem; margin-top: .15rem; }
.price { color: var(--vendo); font-weight: 700; }
.empty { color: var(--muted); text-align: center; padding: 1.2rem; }

.badge { font-size: .68rem; font-weight: 800; color: #04140f; padding: .2rem .45rem; border-radius: .4rem; text-transform: uppercase; letter-spacing: .03em; }

.muted { color: var(--muted); }
.small { font-size: .85rem; padding: .4rem .6rem; }
.tiny { font-size: .75rem; }

.fab {
  position: fixed; right: 1rem; bottom: calc(1rem + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: var(--accent-ink);
  font-size: 2rem; font-weight: 700; line-height: 1; box-shadow: 0 8px 24px rgba(0,0,0,.5); z-index: 6;
}
.fab:disabled { opacity: .5; }

.modal { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: flex-end; justify-content: center; z-index: 20; }
.sheet { background: var(--panel); border: 1px solid var(--line); border-radius: 1rem 1rem 0 0; padding: 1rem; width: 100%; max-width: 680px; padding-bottom: calc(1rem + env(safe-area-inset-bottom)); }
.sheet h3 { margin: 0 0 .8rem; }
.kindPick { display: flex; gap: .4rem; margin-bottom: .8rem; }
.fld { display: block; margin-bottom: .7rem; }
.fld span { display: block; font-size: .8rem; color: var(--muted); margin-bottom: .25rem; }
.sheetBtns { display: flex; gap: .6rem; justify-content: flex-end; margin-top: .6rem; }

.toast { position: fixed; left: 50%; bottom: calc(5rem + env(safe-area-inset-bottom)); transform: translateX(-50%); background: var(--panel2); border: 1px solid var(--line); padding: .6rem 1rem; border-radius: .8rem; z-index: 30; box-shadow: 0 6px 20px rgba(0,0,0,.5); }
</style>
