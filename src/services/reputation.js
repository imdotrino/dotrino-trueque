// Puente al registro de reputación compartido (reputation.dotrino.com).
// Reusa el web-of-trust local del vault para ponderar (anti-sybil) y publica las
// atestaciones firmadas. En Trueque: badge antes del trato + calificar después.

import { createVaultReputation } from '@dotrino/reputation'
import { getIdentity } from './identity'

let _rep = null

export async function getReputation () {
  if (_rep) return _rep
  const id = await getIdentity()
  if (!id) return null
  _rep = createVaultReputation(id)
  return _rep
}
