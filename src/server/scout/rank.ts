import { generateText, Output } from 'ai'
import { z } from 'zod'

import { brain } from '../ai'
import { shortlistItemSchema, type Candidate, type ShortlistItem, type WhopComp } from './types'

// Deliberately not `.length(3)`: array-length constraints are dropped when the
// schema is sent to the provider, so the bound would only ever surface as a
// client-side validation throw. Ask for three in the prompt, enforce by slicing.
const rankingSchema = z.object({
  shortlist: z.array(shortlistItemSchema).min(1),
  rejected: z.array(z.object({ name: z.string(), reason: z.string() })),
})

function compLine(comp: WhopComp): string {
  const parts = [
    comp.title,
    comp.industryType ?? comp.businessType ?? 'unknown category',
    `${comp.memberCount} members`,
    comp.price ?? 'price unlisted',
  ]
  return `- ${parts.join(' · ')}`
}

/**
 * Picks the three best partner-referral targets. Whop's own top sellers are
 * supplied as evidence of what converts on the platform, not as candidates —
 * those businesses are already on Whop.
 */
export async function rankCandidates(args: {
  today: string
  candidates: Array<Candidate>
  comps: Array<WhopComp>
  alreadyReferred: Array<string>
}): Promise<{ shortlist: Array<ShortlistItem>; rejected: Array<{ name: string; reason: string }> }> {
  const { model } = brain()

  const { output } = await generateText({
    model,
    output: Output.object({ schema: rankingSchema }),
    system: [
      'You screen leads for the Whop Partners programme, where a partner refers a business onto Whop',
      'and earns a share of that business\'s processing volume for as long as it sells there.',
      'A good target therefore has real, recurring payment volume it could move onto Whop —',
      'not just attention. Attention with no paid offer is worth nothing to a partner.',
    ].join(' '),
    prompt: [
      `Today is ${args.today}.`,
      '',
      '## Candidates spotted today',
      JSON.stringify(args.candidates, null, 2),
      '',
      '## What is actually earning on Whop right now (comparables, NOT candidates)',
      args.comps.map(compLine).join('\n') || '(none available)',
      '',
      ...(args.alreadyReferred.length
        ? [
            '## Already referred by this partner — never shortlist these',
            args.alreadyReferred.join(', '),
            '',
          ]
        : []),
      '## Task',
      'Pick the 3 best candidates to deep-research as Whop Partners referral targets.',
      'If fewer than 3 are worth researching, return fewer. Never invent a candidate,',
      'never emit a placeholder row, and never shortlist something absent from the list above.',
      '',
      'Score each on how much processing volume it could plausibly move onto Whop within a quarter:',
      '- Does it already charge money, and is that revenue recurring or repeatable?',
      '- Does it resemble the comparables above — the categories that demonstrably convert on Whop?',
      '- Is the operator small and independent enough to actually switch platforms?',
      '- Is its current stack (Gumroad, Stripe Checkout, Kajabi, Patreon, manual Discord invites) something Whop clearly beats?',
      '',
      'Reject anything already on Whop, anything enterprise, and anything with attention but no paid offer.',
      'fitReason must name the specific evidence you scored on, not restate the tagline.',
      '',
      'fitScore is on a 0–100 scale, not 1–10. Roughly: 80+ an obvious yes, 60–79 worth the outreach,',
      '40–59 speculative, under 40 you should not have shortlisted it.',
    ].join('\n'),
  })

  // Weaker models routinely score 1–10 despite the instruction; rescale rather
  // than show a genuine top pick as "Fit 9".
  const rescale = output.shortlist.every((item) => item.fitScore <= 10)
  const shortlist = output.shortlist
    .slice(0, 3)
    .map((item) => ({ ...item, fitScore: rescale ? item.fitScore * 10 : item.fitScore }))

  return { shortlist, rejected: output.rejected }
}
