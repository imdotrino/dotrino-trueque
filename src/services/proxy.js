// Handoff de contacto por el proxy (transporte del ecosistema). Cuando alguien
// quiere responder a un anuncio, le mandamos un mensaje SELLADO: cae en la cola
// offline 24h del vendedor y le aparece en su messenger (misma identidad del vault).
// El índice geo es sólo descubrimiento; la conversación va por acá.
//
// ⚠️ OJO: hoy este mensaje NO LO RECIBE NADIE. Se manda y cae en la cola offline, pero
// no hay un solo receptor de `trueque-contact` en el ecosistema: el messenger espera el
// formato `TIPO|{json}` y esto es un objeto JSON pelado, así que lo descarta sin decir
// nada. O sea: responder a un anuncio no le llega al vendedor. Está anotado en
// PENDIENTES.md del ecosistema; sellarlo no cambia eso ni lo empeora.
//
// Va sellado porque el proxio NO cifra (CONVENCIONES §4.1): sin esto, el texto que una
// persona le escribe a otra sería legible para quien opere el proxio. La llave de
// cifrado del vendedor viaja en su pin, firmada por él.

import { getWebSocketProxyClient, identitySealing } from '@dotrino/proxy-client'
import { getIdentity, getMyPubkey } from './identity'

/** @type {import('@dotrino/proxy-client').WebSocketProxyClient | null} */
let client = null
let identified = false

/** @returns {Promise<import('@dotrino/proxy-client').WebSocketProxyClient>} */
async function ensureConnected () {
  // `requireSealed`: nada en claro, ni al enviar ni al recibir (CONVENCIONES §4.1).
  // El sellado lo hace el puente del pilar, con la bóveda (CONVENCIONES §4.1). La marca
  // `trueque` es la misma de antes: quien recibe descarta lo que no es suyo por ahí.
  const id = await getIdentity()
  const c = client ||= getWebSocketProxyClient({ requireSealed: true, sealing: identitySealing(id, { app: 'trueque' }) })
  if (identified) return c
  await c.connect()
  const publickey = getMyPubkey()
  if (!publickey) throw new Error('vault has no pubkey: cannot identify')
  // Mismo sobre de identify que usa el messenger.
  // El sobre lo arma el pilar, con el destinatario dentro (antes se copiaba en cada app).
  await c.identifyAs({ publickey, sign: (d) => id.signData(d) })
  identified = true
  return c
}

/**
 * Envía un mensaje de contacto al dueño de un anuncio.
 *
 * Va SELLADO: el texto es de una persona para otra y el proxio no tiene por qué
 * verlo. La llave de cifrado del vendedor viaja en su pin, firmada por él.
 *
 * @param {string} toPubkey  pubkey JWK string del pin
 * @param {string|undefined} toEncPub  pública de cifrado del pin (`payload.encPub`); sin ella
 *                           el envío falla con `code: 'unsealed'`
 * @param {{ title: string, text: string }} payload
 * @returns {Promise<void>}
 */
export async function contactSeller (toPubkey, toEncPub, payload) {
  const c = await ensureConnected()
  await c.sendSealed([toPubkey], {
    type: 'trueque-contact',
    app: 'trueque',
    ...payload,
    ts: Date.now()
  }, { peerEncPub: toEncPub })
}
