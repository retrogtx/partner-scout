import { whopApiKey, whopApiOrigin } from './env'

async function whopFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = whopApiKey()
  return fetch(new URL(path, whopApiOrigin()), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...init?.headers,
    },
  })
}

const TRENDING_QUERY = /* GraphQL */ `
  query TrendingProducts($first: Int!, $order: PublicAccessPassesOrder!) {
    publicAccessPasses(first: $first, filter: { order: $order, direction: desc }) {
      nodes {
        id
        title
        headline
        route
        memberCount
        businessType
        industryType
        globalAffiliatePercentage
        company {
          route
          title
        }
        defaultPlan {
          rawInitialPrice
          rawRenewalPrice
          baseCurrency
          formattedPeriod
        }
      }
    }
  }
`

export type WhopTrendingProduct = {
  title: string
  headline: string | null
  url: string
  companyName: string | null
  memberCount: number
  businessType: string | null
  industryType: string | null
  affiliatePercentage: number | null
  price: string | null
}

type GqlNode = {
  title: string
  headline: string | null
  route: string
  memberCount: number
  businessType: string | null
  industryType: string | null
  globalAffiliatePercentage: number | null
  company: { route: string; title: string | null } | null
  defaultPlan: {
    rawInitialPrice: number | null
    rawRenewalPrice: number | null
    baseCurrency: string | null
    formattedPeriod: string | null
  } | null
}

function formatPrice(plan: GqlNode['defaultPlan']): string | null {
  if (!plan) return null
  const amount = plan.rawRenewalPrice ?? plan.rawInitialPrice
  if (amount == null) return null
  const currency = (plan.baseCurrency ?? 'usd').toUpperCase()
  const period = plan.formattedPeriod ? ` / ${plan.formattedPeriod}` : ''
  return `${amount} ${currency}${period}`
}

/**
 * Top products on Whop right now. `most_money_made_24_hours` is the closest
 * thing Whop has to "winners of the day"; these are the comps a partner pitches
 * an off-Whop business with.
 */
export async function fetchWhopTrending(
  first = 12,
  order: 'most_money_made_24_hours' | 'trending_3_hours' | 'trending' = 'most_money_made_24_hours',
): Promise<Array<WhopTrendingProduct>> {
  const response = await whopFetch('/public-graphql', {
    method: 'POST',
    body: JSON.stringify({ query: TRENDING_QUERY, variables: { first, order } }),
  })

  if (!response.ok) throw new Error(`Whop GraphQL ${response.status}: ${await response.text()}`)

  const body = (await response.json()) as {
    data?: { publicAccessPasses?: { nodes?: Array<GqlNode> } }
    errors?: Array<{ message: string }>
  }
  if (body.errors?.length) throw new Error(`Whop GraphQL: ${body.errors[0]!.message}`)

  return (body.data?.publicAccessPasses?.nodes ?? []).map((node) => ({
    title: node.title,
    headline: node.headline,
    url: `https://whop.com/${node.company?.route ?? ''}/${node.route}`,
    companyName: node.company?.title ?? null,
    memberCount: node.memberCount,
    businessType: node.businessType,
    industryType: node.industryType,
    affiliatePercentage: node.globalAffiliatePercentage,
    price: formatPrice(node.defaultPlan),
  }))
}

/**
 * Businesses the caller has already referred, so the scout doesn't resurface
 * them. Requires partner scope; returns an empty list when the app key can't
 * read the caller's partner account.
 */
export async function fetchReferredBusinesses(): Promise<Array<string>> {
  try {
    const response = await whopFetch('/api/v1/partners/businesses?limit=100')
    if (!response.ok) return []
    const body = (await response.json()) as {
      data?: Array<{ account?: { title?: string | null; route?: string | null } | null }>
    }
    return (body.data ?? [])
      .flatMap((row) => [row.account?.title, row.account?.route])
      .filter((value): value is string => Boolean(value))
  } catch {
    return []
  }
}
