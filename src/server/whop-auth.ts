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

/**
 * Whop only sends `x-whop-user-token` when the app is embedded in its iframe,
 * so a bare deployment has no way to identify anyone.
 *
 * The gate is `APP_ID`: while it is unset the deployment is not yet claimed by
 * a Whop app, and we fall back to a shared anonymous viewer so the URL is
 * usable standalone. Setting `APP_ID` — which you must do to wire it into Whop
 * anyway — switches this to strict verification. Until then the deployment is
 * open to anyone with the link and will spend gateway credits on their behalf.
 */
export async function viewerOrAnonymous(): Promise<Viewer> {
  try {
    return await verifyViewer()
  } catch (error) {
    if (import.meta.env.DEV) return { userId: 'user_local_dev' }
    if (!appId()) return { userId: 'user_unclaimed' }
    throw error
  }
}
