// Cliente del índice geo (geo.dotrino.com) — usa el paquete del ecosistema,
// no reimplementa el protocolo. Identidad inyectada desde el vault.

import { createGeoClient } from '@dotrino/geo'
import { signData, getPublicKeyJwk } from './identity'

let geo = null

export function getGeo () {
  if (!geo) {
    geo = createGeoClient({ signData, getPublicKeyJwk })
    // baseUrl default = https://geo.dotrino.com
  }
  return geo
}
