// Integración con el vault id.dotrino.com (única fuente de identidad).
// Expone adaptadores para el cliente geo: éste espera signData(data)->string y
// getPublicKeyJwk()->string, pero el vault devuelve { signature, publickey } en
// signData. Acá hacemos el puente.

import { Identity } from '@dotrino/identity'

/** @type {Identity | null} */
let identity = null
/** @type {string | null} */
let myPubkey = null

/** @returns {Promise<Identity>} la conexión con la bóveda (lanza si no responde) */
export async function initIdentity () {
  if (identity) return identity
  const id = await Identity.connect()
  identity = id
  // MI IDENTIDAD ES EL `profileId`, no la llave de ESTE aparato.
  //
  // `me.publickey` es la llave del aparato, y solo coincide con la cuenta en el que la
  // fundó. Usarla como identidad hacía que publicar desde el teléfono y desde el PC
  // quedara a nombre de dos personas distintas: dos autores en el mapa, y la
  // reputación repartida entre ellos en vez de acumularse. Sin error, en silencio.
  // `profileActa` existe en el pilar pero falta en sus tipos.
  const withActa = /** @type {Identity & { profileActa (): Promise<{ acta?: { profileId?: string } } | null> }} */ (id)
  myPubkey = (await withActa.profileActa().catch(() => null))?.acta?.profileId
    || id.me?.publickey || null
  return id
}

/** @returns {Promise<Identity>} */
export async function getIdentity () {
  if (!identity) return initIdentity()
  return identity
}

/** @returns {string | null} mi identidad (el `profileId`), o null antes de conectar */
export function getMyPubkey () { return myPubkey }
/** @returns {boolean} */
export function isReady () { return identity !== null && !!myPubkey }

// --- adaptadores para createGeoClient ---

// El geo-client arma `data` y pide la firma. El vault devuelve el PAQUETE
// —{ signature, publickey, profileId, chain }— y hay que pasarlo ENTERO: sin
// `chain` el servidor no puede comprobar que este aparato habla por esta
// identidad, y con la verificación nueva rechaza el sobre.
/**
 * @param {object} data
 * @returns {Promise<{ signature: string, publickey: string }>} el paquete firmado entero
 */
export async function signData (data) {
  const id = await getIdentity()
  return id.signData(data)
}

/** @returns {Promise<string>} */
export async function getPublicKeyJwk () {
  if (!myPubkey) await initIdentity()
  // Sin identidad no se firma nada a nombre de nadie: se para y se dice.
  if (!myPubkey) throw Object.assign(new Error('the vault gave no identity: nothing can be signed'), { code: 'no-identity' })
  return myPubkey
}

// --- sellado extremo a extremo (CONVENCIONES §4.1) ---------------------------
//
// El proxio NO cifra: lo que se manda con `sendByPubkey` lo puede leer quien lo opere.
// El mensaje de contacto es una persona escribiéndole a otra, así que va sellado, con el
// puente del pilar (`identitySealing` de @dotrino/proxy-client, ver ./proxy.js): la llave
// privada de cifrado vive en el VAULT y la app no la toca.
//
// Antes la app traía su propio puente, y tenía dos fallos que nadie veía: pasaba el
// destinatario como texto (la bóveda espera { encryptionPubkey }), así que el sobre salía
// sin destinatarios; y leía el resultado de `decrypt` como texto cuando es { plaintext }.

/**
 * Mi pública de cifrado. Va en el pin, firmada, para que puedan escribirme en privado.
 *
 * @returns {Promise<string>}
 */
export async function getEncryptionPubkey () {
  const id = await getIdentity()
  return id.getEncryptionPubkey()
}
