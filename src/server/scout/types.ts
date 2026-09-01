import { z } from 'zod'

/** Mirrors `BusinessModels::ANNUAL_REVENUE_RANGES` — the values the Whop referral form accepts. */
export const ANNUAL_REVENUE_RANGES = [
  'just_getting_started',
  'under_10k',
  'from_10k_to_100k',
  'from_100k_to_1m',
  'from_1m_to_10m',
  'over_10m',
] as const

export const ANNUAL_REVENUE_LABELS: Record<(typeof ANNUAL_REVENUE_RANGES)[number], string> = {
  just_getting_started: 'Just getting started',
  under_10k: 'Under $10k / yr',
  from_10k_to_100k: '$10k–$100k / yr',
  from_100k_to_1m: '$100k–$1M / yr',
  from_1m_to_10m: '$1M–$10M / yr',
  over_10m: 'Over $10M / yr',
}

export const candidateSchema = z.object({
  name: z.string(),
  url: z.string().nullable(),
  source: z.enum(['product_hunt', 'social', 'whop_discover']),
  tagline: z.string(),
  /** Why this is hot *today* — the thing that makes it a scout hit rather than a directory entry. */
  signal: z.string(),
})
export type Candidate = z.infer<typeof candidateSchema>

export const shortlistItemSchema = candidateSchema.extend({
  fitScore: z.number().min(0).max(100),
  fitReason: z.string(),
})
export type ShortlistItem = z.infer<typeof shortlistItemSchema>

export const whopCompSchema = z.object({
  title: z.string(),
  headline: z.string().nullable(),
  url: z.string(),
  companyName: z.string().nullable(),
  memberCount: z.number(),
  businessType: z.string().nullable(),
  industryType: z.string().nullable(),
  affiliatePercentage: z.number().nullable(),
  price: z.string().nullable(),
})
export type WhopComp = z.infer<typeof whopCompSchema>

export const researchSchema = z.object({
  summary: z.string().describe('Three or four sentences on what the business actually sells.'),
  website: z.string().nullable(),
  operator: z.object({
    name: z.string().nullable(),
    role: z.string().nullable(),
    basedIn: z.string().nullable(),
  }),
  monetization: z.object({
    model: z.string().describe('e.g. one-off course, monthly community, SaaS seat'),
    pricePoints: z.array(z.string()),
    currentStack: z
      .array(z.string())
      .describe(
        'Named platforms and tools only — Gumroad, Stripe, Kajabi, Skool, Patreon, Discord, Shopify. Never prices or product names; those belong in pricePoints.',
      ),
  }),
  audience: z.object({
    channels: z.array(
      z.object({
        platform: z.string(),
        handle: z.string().nullable(),
        followers: z.string().nullable(),
      }),
    ),
    reachNote: z.string(),
  }),
  revenue: z.object({
    annualRevenue: z.enum(ANNUAL_REVENUE_RANGES),
    basis: z.string().describe('How the estimate was derived — cite the observable numbers.'),
    confidence: z.enum(['low', 'medium', 'high']),
  }),
  contacts: z.array(
    z.object({
      name: z.string().nullable(),
      channel: z.string().describe('email, X DM, LinkedIn, contact form, …'),
      handleOrEmail: z.string().nullable(),
    }),
  ),
  sources: z.array(z.string()).describe('URLs actually consulted.'),
})
export type Research = z.infer<typeof researchSchema>

export const pitchSchema = z.object({
  headline: z.string().describe('One line: the reason this business belongs on Whop.'),
  whyWhop: z.array(z.string()).describe('Concrete, specific-to-them reasons. No generic benefits.'),
  comps: z
    .array(z.string())
    .describe('Names of Whop products from the supplied comp set that resemble this business.'),
  frictionToday: z.array(z.string()).describe('What their current stack costs them.'),
  objections: z.array(z.object({ objection: z.string(), response: z.string() })),
  outreach: z.object({
    channel: z.string(),
    subject: z.string(),
    body: z.string().describe('Under 150 words, plain text, no placeholders left unfilled.'),
  }),
  referralPrefill: z.object({
    businessName: z.string(),
    website: z.string(),
    annualRevenue: z.enum(ANNUAL_REVENUE_RANGES),
  }),
})
export type Pitch = z.infer<typeof pitchSchema>

export type Brief = {
  candidate: ShortlistItem
  research: Research
  pitch: Pitch
}

export type ReportStage = 'sourcing' | 'ranking' | 'researching' | 'done'

export type Report = {
  date: string
  stage: ReportStage
  candidates: Array<Candidate>
  comps: Array<WhopComp>
  shortlist: Array<ShortlistItem>
  briefs: Array<Brief>
  log: Array<string>
}

export const reportSchema: z.ZodType<Report> = z.object({
  date: z.string(),
  stage: z.enum(['sourcing', 'ranking', 'researching', 'done']),
  candidates: z.array(candidateSchema),
  comps: z.array(whopCompSchema),
  shortlist: z.array(shortlistItemSchema),
  briefs: z.array(
    z.object({
      candidate: shortlistItemSchema,
      research: researchSchema,
      pitch: pitchSchema,
    }),
  ),
  log: z.array(z.string()),
})

export function emptyReport(date: string): Report {
  return { date, stage: 'sourcing', candidates: [], comps: [], shortlist: [], briefs: [], log: [] }
}

export function stageLabel(report: Report): string {
  switch (report.stage) {
    case 'sourcing':
      return 'Collecting what launched today'
    case 'ranking':
      return 'Scoring candidates for Whop fit'
    case 'researching':
      return `Researching ${report.briefs.length + 1} of ${report.shortlist.length}`
    case 'done':
      return 'Report ready'
  }
}
