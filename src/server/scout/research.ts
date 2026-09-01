import { generateText, Output, isStepCount } from 'ai'

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

/**
 * Search-backed pass. Runs free-form so the model can chase links without also
 * fighting a schema; the structuring happens in `structure` below.
 */
async function investigate(target: ShortlistItem, today: string): Promise<string> {
  const { searchModel, searchTools } = brain()

  const result = await generateText({
    model: searchModel,
    tools: searchTools,
    stopWhen: isStepCount(12),
    system: [
      'You are a research analyst preparing a partner-referral brief. You work only from sources you actually opened.',
      'Where a number is an estimate, say so and show the arithmetic. Never invent a follower count, a price, or an email.',
      'If something cannot be found, write "not found" — a gap is useful, a fabrication is not.',
    ].join(' '),
    prompt: [
      `Today is ${today}. Research this business in depth.`,
      '',
      `Name: ${target.name}`,
      `URL: ${target.url ?? 'unknown — find it'}`,
      `Tagline: ${target.tagline}`,
      `Why it surfaced: ${target.signal}`,
      '',
      'Cover, in order:',
      '1. What they actually sell, and to whom.',
      '2. Who runs it — name, role, location, whether it is a solo operator or a team.',
      '3. Exact pricing. Every tier and price point you can find, and whether it is one-off or recurring.',
      '4. The payment and delivery stack they use today: Gumroad, Stripe, Kajabi, Teachable, Skool, Patreon,',
      '   Substack, Discord invites, Shopify, Whop — whatever the checkout and the community actually run on.',
      '5. Audience size per channel with real numbers, and how engaged it looks.',
      '6. A revenue estimate. Derive it — price × observable customer count, or member count × subscription —',
      '   and state the inputs. Then place it in one of these bands exactly:',
      `   ${ANNUAL_REVENUE_RANGES.join(', ')}.`,
      '7. How to reach the operator: email, DM, contact form. Give the real handle or address if it is public.',
      '',
      'Finish with a list of every URL you opened.',
    ].join('\n'),
  })

  return findingsFrom(result)
}

async function structure(notes: string, target: ShortlistItem): Promise<Research> {
  const { model } = brain()

  const { output } = await generateText({
    model,
    output: Output.object({ schema: researchSchema }),
    system:
      'You convert research notes into a structured record. Carry over only what the notes support; use null where the notes say not found.',
    prompt: [`Business: ${target.name}`, '', '## Notes', notes].join('\n'),
  })

  return output
}

export async function researchTarget(
  target: ShortlistItem,
  today: string,
): Promise<{ research: Research; notes: string }> {
  const notes = await investigate(target, today)
  return { research: await structure(notes, target), notes }
}

function compLine(comp: WhopComp): string {
  return `- ${comp.title} (${comp.industryType ?? comp.businessType ?? 'uncategorised'}) · ${comp.memberCount} members · ${comp.price ?? 'price unlisted'}${
    comp.affiliatePercentage ? ` · ${comp.affiliatePercentage}% affiliate` : ''
  } · ${comp.url}`
}

/** Turns the research into the thing a partner can actually act on. */
export async function buildPitch(args: {
  target: ShortlistItem
  research: Research
  comps: Array<WhopComp>
}): Promise<Pitch> {
  const { model } = brain()

  const { output } = await generateText({
    model,
    output: Output.object({ schema: pitchSchema }),
    system: [
      'You write referral pitches for Whop Partners. The reader is a partner who will send this outreach themselves,',
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
    ].join(' '),
    prompt: [
      `## Target: ${args.target.name}`,
      `Why it surfaced today: ${args.target.signal}`,
      `Shortlist rationale: ${args.target.fitReason}`,
      '',
      '## Research',
      JSON.stringify(args.research, null, 2),
      '',
      '## Comparable Whop products earning right now',
      args.comps.length
        ? args.comps.map(compLine).join('\n')
        : '(comp data unavailable this run — return an empty comps list. Do NOT conclude that no comparable Whop product exists; you simply have not been shown any.)',
      '',
      '## Task',
      'Write the pitch.',
      '- whyWhop: reasons tied to their actual stack and pricing. "Whop has communities" is useless;',
      '  "you are paying Gumroad 10% and running the community in a separate free Discord" is the argument.',
      '- comps: pick from the supplied list only, and only where the resemblance is real.',
      '- frictionToday: what their current setup costs them, in fees, tooling, or lost renewals.',
      '- objections: the three they will actually raise, answered honestly. Do not straw-man.',
      '- outreach: the message the partner sends. Reference the specific thing that happened today.',
      '  Under 150 words, no placeholders, no "I hope this finds you well".',
      '- referralPrefill: exactly what goes into the Whop referral form. annualRevenue must match the research.',
    ].join('\n'),
  })

  return output
}
