// Handoff de contacto por el proxy (transporte del ecosistema). Cuando alguien
// quiere responder a un anuncio, le mandamos un mensaje SELLADO: cae en la cola
// offline 24h del vendedor y le aparece en su messenger (misma identidad del vault).
// El índice geo es sólo descubrimiento; la conversación va por acá.
//
// Va sellado porque el proxio NO cifra (CONVENCIONES §4.1): sin esto, el texto que una
// persona le escribe a otra sería legible para quien opere el proxio. La llave de
// cifrado del vendedor viaja en su pin, firmada por él.

import { getWebSocketProxyClient } from '@dotrino/proxy-client'
import { getIdentity, getMyPubkey, sealing } from './identity'

let client = null
let identified = false

async function ensureConnected () {
  // `requireSealed`: nada en claro, ni al enviar ni al recibir (CONVENCIONES §4.1).
  if (!client) client = getWebSocketProxyClient({ requireSealed: true, sealing })
  if (identified) return client
  const token = await client.connect()
  const id = await getIdentity()
  const publickey = getMyPubkey()
  if (!publickey) throw new Error('vault sin pubkey; no se puede identificar')
  // Mismo sobre de identify que usa el messenger.
  const data = { op: 'identify', publickey, token, ts: Date.now() }
  const { signature } = await id.signData(data)
  await client.identify({ data, signature })
  identified = true
  return client
}

/**
 * Envía un mensaje de contacto al dueño de un anuncio.
 *
 * Va SELLADO: el texto es de una persona para otra y el proxio no tiene por qué
 * verlo. La llave de cifrado del vendedor viaja en su pin, firmada por él.
 *
 * @param {string} toPubkey  pubkey JWK string del pin
 * @param {string} toEncPub  pública de cifrado del pin (`payload.encPub`)
 * @param {object} payload   { title, text, ... }
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
