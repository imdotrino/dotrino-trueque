// Cliente del índice geo (geo.dotrino.com) — usa el paquete del ecosistema,
// no reimplementa el protocolo. Identidad inyectada desde el vault.

import { createGeoClient } from '@dotrino/geo'
import { signData, getPublicKeyJwk } from './identity'

/** @type {import('@dotrino/geo').GeoClient | null} */
let geo = null

/** @returns {import('@dotrino/geo').GeoClient} el cliente del índice, uno por página */
export function getGeo () {
  if (!geo) {
    // @ts-expect-error -- los tipos de @dotrino/geo dicen que signData devuelve la firma (string),
    // pero el cliente usa y necesita el paquete entero { signature, publickey, chain } (ver su index.js).
    geo = createGeoClient({ signData, getPublicKeyJwk })
    // baseUrl default = https://geo.dotrino.com
  }
  return geo
}
