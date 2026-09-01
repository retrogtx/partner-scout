import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getRequest } from '@tanstack/react-start/server'

import { allowAnonymous, appId, whopApiOrigin } from './env'

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
 * Two separate questions, deliberately not conflated:
 *   - Is a presented token real? Always checked. A bad token is always rejected.
 *   - Is an *absent* token acceptable? Only when `ALLOW_ANONYMOUS` says so.
 *
 * An earlier version keyed both off `APP_ID`, which meant wiring the app into
 * Whop and closing public access were the same switch — and worse, an invalid
 * token silently downgraded to anonymous instead of being refused.
 */
export async function viewerOrAnonymous(): Promise<Viewer> {
  if (getRequest().headers.get('x-whop-user-token')) return verifyViewer()
  if (import.meta.env.DEV) return { userId: 'user_local_dev' }
  if (allowAnonymous()) return { userId: 'user_anonymous' }
  throw new Error(
    'No Whop user token on this request. Open the app from inside Whop, or set ALLOW_ANONYMOUS=1 to permit public use.',
  )
}
