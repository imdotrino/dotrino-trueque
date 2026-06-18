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
