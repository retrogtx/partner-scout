import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getRequest } from '@tanstack/react-start/server'

import { appId, whopApiOrigin } from './env'

const ISSUER = 'urn:whopcom:exp-proxy'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function keySet() {
  jwks ??= createRemoteJWKSet(new URL('/.well-known/jwks.json', whopApiOrigin()))
  return jwks
}

export type Viewer = { userId: string }

/**
 * Whop attaches a short-lived ES256 JWT on every same-origin request into the
 * app iframe. `@whop/sdk` no longer ships `verifyUserToken`, so verify it
 * directly against Whop's published JWKS.
 */
export async function verifyViewer(): Promise<Viewer> {
  const token = getRequest().headers.get('x-whop-user-token')
  if (!token) throw new Error('Missing x-whop-user-token — open this app from inside Whop.')

  const audience = appId()
  const { payload } = await jwtVerify(token, keySet(), {
    issuer: ISSUER,
    algorithms: ['ES256'],
    ...(audience ? { audience } : {}),
  })

  if (typeof payload.sub !== 'string') throw new Error('Token has no subject')
  return { userId: payload.sub }
}

/** Dev convenience: local runs have no iframe, so fall back to an anonymous viewer. */
export async function viewerOrAnonymous(): Promise<Viewer> {
  try {
    return await verifyViewer()
  } catch (error) {
    if (import.meta.env.DEV) return { userId: 'user_local_dev' }
    throw error
  }
}
