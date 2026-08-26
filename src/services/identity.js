// Integración con el vault id.dotrino.com (única fuente de identidad).
// Expone adaptadores para el cliente geo: éste espera signData(data)->string y
// getPublicKeyJwk()->string, pero el vault devuelve { signature, publickey } en
// signData. Acá hacemos el puente.

import { Identity } from '@dotrino/identity'

let identity = null
let myPubkey = null

export async function initIdentity () {
  if (identity) return identity
  identity = await Identity.connect()
  myPubkey = identity.me?.publickey || null
  return identity
}

export async function getIdentity () {
  if (!identity) await initIdentity()
  return identity
}

export function getMyPubkey () { return myPubkey }
export function isReady () { return identity !== null && !!myPubkey }

// --- adaptadores para createGeoClient ---

// El geo-client arma data { publickey, lat, ... } y la firma entera. El vault
// firma `data` y devuelve { signature, publickey }; tomamos sólo la firma.
export async function signData (data) {
  const id = await getIdentity()
  const res = await id.signData(data)
  return res.signature
}

export async function getPublicKeyJwk () {
  if (!myPubkey) await initIdentity()
  return myPubkey
}

// --- sellado extremo a extremo (CONVENCIONES §4.1) ---------------------------
//
// El proxio NO cifra: lo que se manda con `sendByPubkey` lo puede leer quien lo opere.
// El mensaje de contacto es una persona escribiéndole a otra, así que va sellado.
//
// La llave privada de cifrado vive en el VAULT, no aquí: la app no la toca. Se delega
// en `identity.encrypt`/`identity.decrypt`, que es el mismo E2E que usa el messenger.

/** Mi pública de cifrado. Va en el pin, firmada, para que puedan escribirme en privado. */
export async function getEncryptionPubkey () {
  const id = await getIdentity()
  return id.getEncryptionPubkey()
}

export const sealing = {
  async seal (msg, peerEncPub) {
    if (!peerEncPub) {
      const e = new Error('el anuncio no trae llave de cifrado')
      e.code = 'unsealed'
      throw e
    }
    const id = await getIdentity()
    const envelope = await id.encrypt([peerEncPub], JSON.stringify(msg))
    return { app: 'trueque', sealed: envelope, from: await getEncryptionPubkey() }
  },
  async open (sobre) {
    const id = await getIdentity()
    const texto = await id.decrypt(sobre.from, null, sobre.sealed)
    return JSON.parse(texto)
  },
  isSealed (m) {
    return !!m && m.app === 'trueque' && !!m.sealed
  },
}
