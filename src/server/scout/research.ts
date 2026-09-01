import { generateText, Output, isStepCount } from 'ai'
import { z } from 'zod'

import { brain, findingsFrom } from '../ai'
import {
  ANNUAL_REVENUE_RANGES,
  pitchSchema,
  researchSchema,
  type Pitch,
  type Research,
  type ShortlistItem,
  type WhopComp,
} from './types'

const RESEARCH_SYSTEM = [
  'You are a research analyst preparing a partner-referral brief. You work only from sources you actually opened.',
  'Where a number is an estimate, say so and show the arithmetic. Never invent a follower count, a price, or an email.',
  'If something cannot be found, say so — a gap is useful, a fabrication is not.',
].join(' ')

const PITCH_SYSTEM = [
  'You also write the referral pitch. The reader is a partner who will send this outreach themselves,',
  'so everything must be specific enough that the recipient can tell it was not a template.',
  'Whop gives a seller: hosted checkout, memberships and recurring billing, a native community and chat,',
  'courses and content hosting, an affiliate programme with a marketplace of promoters, and Discover distribution',
  'to buyers already on the platform. Argue from what this particular business is missing, not from that list.',
  '',
  'Never state a specific Whop fee, percentage, or migration guarantee — you do not know them and the partner',
  'will be held to whatever you write. Compare against the fees the research actually established for their',
  'current stack, and describe Whop only in terms of the capabilities listed above.',
  'Never assert a fact about the target that the research did not establish. "You are on Thinkific" is a',
  'fabrication unless the research says so; write "if you are on a hosted course tool" or leave it out.',
].join(' ')

const RESEARCH_TASK = [
  '### research',
  '1. What they actually sell, and to whom.',
  '2. Who runs it — name, role, location, solo operator or a team.',
  '3. Exact pricing: every tier you can find, and whether it is one-off or recurring.',
  '4. The payment and delivery stack they use today: Gumroad, Stripe, Kajabi, Teachable, Skool, Patreon,',
  '   Substack, Discord invites, Shopify, Whop — whatever the checkout and the community actually run on.',
  '   Platform names only; prices belong in pricePoints.',
  '5. Audience size per channel with real numbers.',
  '6. A revenue estimate. Derive it — price × observable customer count, or member count × subscription —',
  '   state the inputs in `basis`, then pick the band that matches from:',
  `   ${ANNUAL_REVENUE_RANGES.join(', ')}.`,
  '7. How to reach the operator, and every URL you actually consulted in `sources`.',
].join('\n')

const PITCH_TASK = [
  '### pitch',
  '- whyWhop: reasons tied to their actual stack and pricing. "Whop has communities" is useless;',
  '  "you are paying Gumroad 10% and running the community in a separate free Discord" is the argument.',
  '- comps: pick from the supplied list only, and only where the resemblance is real.',
  '  `product` is the bare name — no markdown links, no URL, no prose. Put the reasoning in `why`.',
  '- frictionToday: what their current setup costs them, in fees, tooling, or lost renewals.',
  '- objections: the three they will actually raise, answered honestly. Do not straw-man.',
  '- outreach: the message the partner sends. Reference the specific thing that happened today.',
  '  Under 150 words, no "I hope this finds you well".',
  '  Do not sign off. You do not know the sender’s name, so end on the last real sentence —',
  '  no "Best,", no "[Your Name]", and never a square-bracket placeholder anywhere in the body.',
  '- referralPrefill: exactly what goes into the Whop referral form. annualRevenue must match the research.',
].join('\n')

function compLine(comp: WhopComp): string {
  return `- ${comp.title} (${comp.industryType ?? comp.businessType ?? 'uncategorised'}) · ${comp.memberCount} members · ${comp.price ?? 'price unlisted'}${
    comp.affiliatePercentage ? ` · ${comp.affiliatePercentage}% affiliate` : ''
  } · ${comp.url}`
}

function compsBlock(comps: Array<WhopComp>): string {
  return comps.length
    ? comps.map(compLine).join('\n')
    : '(comp data unavailable this run — return an empty comps list. Do NOT conclude that no comparable Whop product exists; you simply have not been shown any.)'
}

/** Free-form search pass, only needed where search is a tool the model must choose to call. */
async function investigate(target: ShortlistItem, today: string): Promise<string> {
  const { searchModel, searchTools } = brain()

  const result = await generateText({
    model: searchModel,
    tools: searchTools,
    stopWhen: isStepCount(10),
    system: RESEARCH_SYSTEM,
    prompt: [
      `Today is ${today}. Research this business in depth.`,
      '',
      `Name: ${target.name}`,
      `URL: ${target.url ?? 'unknown — find it'}`,
      `Tagline: ${target.tagline}`,
      `Why it surfaced: ${target.signal}`,
      '',
      RESEARCH_TASK,
      '',
      'Finish with a list of every URL you opened.',
    ].join('\n'),
  })

  return findingsFrom(result)
}

const briefSchema = z.object({ research: researchSchema, pitch: pitchSchema })

/**
 * Research and pitch for one target, in a single request.
 *
 * This was three calls — search, structure, pitch — because Vercel killed a
 * function at 60s. Workers has no wall-clock limit, and every extra call spends
 * a request against a daily quota, so the split now buys nothing but cost.
 * Where search is provider-side it happens inside this same call.
 */
export async function briefTarget(args: {
  target: ShortlistItem
  today: string
  comps: Array<WhopComp>
}): Promise<{ research: Research; pitch: Pitch }> {
  const { searchModel, searchIsProviderSide, model } = brain()

  // Tool-based search still needs its own pass: given a schema and a tool, the
  // model will happily satisfy the schema and never search.
  const notes = searchIsProviderSide ? null : await investigate(args.target, args.today)

  const { output } = await generateText({
    model: searchIsProviderSide ? searchModel : model,
    output: Output.object({ schema: briefSchema }),
    system: [RESEARCH_SYSTEM, PITCH_SYSTEM].join(' '),
    prompt: [
      `Today is ${args.today}.`,
      '',
      `## Target: ${args.target.name}`,
      `URL: ${args.target.url ?? 'unknown — find it'}`,
      `Tagline: ${args.target.tagline}`,
      `Why it surfaced today: ${args.target.signal}`,
      `Shortlist rationale: ${args.target.fitReason}`,
      '',
      ...(notes ? ['## Research notes', notes, ''] : []),
      '## Comparable Whop products earning right now',
      compsBlock(args.comps),
      '',
      '## Task — produce both halves in one object',
      '',
      RESEARCH_TASK,
      '',
      PITCH_TASK,
    ].join('\n'),
  })

  return {
    research: output.research,
    pitch: {
      ...output.pitch,
      outreach: { ...output.pitch.outreach, body: stripPlaceholders(output.pitch.outreach.body) },
    },
  }
}

const SIGNOFF = /(best|thanks|cheers|regards|sincerely)/i

/**
 * Models sign off with "Best, [Partner Name]" however firmly you tell them not
 * to, and a partner pasting that into an email is the worst failure this tool
 * has. Remove the placeholder first, then any sign-off it leaves dangling —
 * dropping whole lines would wipe a message whose placeholder shares a line
 * with real content.
 */
function stripPlaceholders(body: string): string {
  const withoutPlaceholders = body.replace(/\s*\[[^\]]*\]/g, '')

  const lines = withoutPlaceholders.split('\n')
  while (lines.length) {
    const last = lines[lines.length - 1]!.trim()
    if (!last || new RegExp(`^${SIGNOFF.source}[,!.]?$`, 'i').test(last)) {
      lines.pop()
      continue
    }
    break
  }

  return lines
    .join('\n')
    .replace(new RegExp(`\\s*\\b${SIGNOFF.source}\\s*[,!.]?\\s*$`, 'i'), '')
    .trim()
}
