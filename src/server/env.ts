type ScoutEnv = {
  APP_ID?: string
  WHOP_API_ORIGIN?: string
  WHOP_API_KEY?: string
  OPENROUTER_API_KEY?: string
  AI_GATEWAY_API_KEY?: string
  SCOUT_AI_PROVIDER?: string
  SCOUT_MODEL?: string
  PRODUCT_HUNT_TOKEN?: string
  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string
}

// Nitro exposes Vercel's environment on process.env, and `vercel dev` /
// `.dev.vars` populate the same place locally.
const env = process.env as ScoutEnv

export function whopApiOrigin(): string {
  return env.WHOP_API_ORIGIN ?? 'https://api.whop.com'
}

export function appId(): string | undefined {
  return env.APP_ID
}

/**
 * Whop's app-hosting runtime injects the app's API key into requests to
 * api.whop.com at the platform layer, so app code never sees it. Outside that
 * runtime (local dev) the key has to come from a secret.
 */
export function whopApiKey(): string | undefined {
  return env.WHOP_API_KEY
}

export type AiProviderName = 'openrouter' | 'gateway'

/**
 * Whichever gateway key is present wins; OpenRouter first because its `web`
 * plugin gives every model live search without a second vendor.
 * `SCOUT_AI_PROVIDER` forces one when both keys are set.
 */
export function aiCredentials(): { provider: AiProviderName; apiKey: string } {
  const forced = env.SCOUT_AI_PROVIDER as AiProviderName | undefined
  const openrouter = env.OPENROUTER_API_KEY
  const gateway = env.AI_GATEWAY_API_KEY

  if (forced === 'openrouter') {
    if (!openrouter) throw new Error('SCOUT_AI_PROVIDER=openrouter but OPENROUTER_API_KEY is unset')
    return { provider: 'openrouter', apiKey: openrouter }
  }
  if (forced === 'gateway') {
    if (!gateway) throw new Error('SCOUT_AI_PROVIDER=gateway but AI_GATEWAY_API_KEY is unset')
    return { provider: 'gateway', apiKey: gateway }
  }

  if (openrouter) return { provider: 'openrouter', apiKey: openrouter }
  if (gateway) return { provider: 'gateway', apiKey: gateway }

  throw new Error(
    'No AI gateway key. Set OPENROUTER_API_KEY or AI_GATEWAY_API_KEY (.env locally, project env vars on Vercel).',
  )
}

export function scoutModelId(): string {
  return env.SCOUT_MODEL ?? 'anthropic/claude-opus-5'
}

export function productHuntToken(): string | undefined {
  return env.PRODUCT_HUNT_TOKEN
}

export function upstash(): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}
