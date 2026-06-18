// Handoff de contacto por el proxy (transporte del ecosistema). Cuando alguien
// quiere responder a un anuncio, le mandamos un mensaje por sendByPubkey: cae en
// la cola offline 24h del vendedor y le aparece en su messenger (misma identidad
// del vault). El índice geo es sólo descubrimiento; la conversación va por acá.

import { getWebSocketProxyClient } from '@dotrino/proxy-client'
import { getIdentity, getMyPubkey } from './identity'

let client = null
let identified = false

async function ensureConnected () {
  if (!client) client = getWebSocketProxyClient()
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
 * @param {string} toPubkey  pubkey JWK string del pin
 * @param {object} payload   { title, text, ... }
 */
export async function contactSeller (toPubkey, payload) {
  const c = await ensureConnected()
  await c.sendByPubkey([toPubkey], {
    type: 'trueque-contact',
    app: 'trueque',
    ...payload,
    ts: Date.now()
  })
}
