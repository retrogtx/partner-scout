import { generateText, Output, isStepCount } from 'ai'
import { z } from 'zod'

import { brain, findingsFrom } from '../ai'
import { candidateSchema, type Candidate } from './types'

const PRODUCT_HUNT_FEED = 'https://www.producthunt.com/feed'

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function stripTags(value: string): string {
  return decodeEntities(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Product Hunt's Atom feed needs no token. Entries are already ordered by the
 * day's ranking, so the head of the feed is "top products today".
 */
export async function fetchProductHunt(limit = 10): Promise<Array<Candidate>> {
  const response = await fetch(PRODUCT_HUNT_FEED, {
    headers: { 'user-agent': 'partner-scout/1.0 (+https://whop.com)' },
  })
  if (!response.ok) throw new Error(`Product Hunt feed ${response.status}`)

  const xml = await response.text()
  const entries = xml.split('<entry>').slice(1, limit + 1)

  return entries.flatMap((entry): Array<Candidate> => {
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    if (!title) return []

    const href = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? null
    const rawContent = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? ''
    const tagline = stripTags(rawContent).split(' Discussion |')[0]?.trim() ?? ''
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null

    return [
      {
        name: decodeEntities(title).trim(),
        url: href,
        source: 'product_hunt',
        tagline: tagline.slice(0, 240),
        signal: published
          ? `On the Product Hunt front page (posted ${published.slice(0, 10)})`
          : 'On the Product Hunt front page',
      },
    ]
  })
}

const socialSweepSchema = z.object({ candidates: z.array(candidateSchema.omit({ source: true })) })

/**
 * Product Hunt skews to SaaS. This sweep is what catches Whop's actual ICP:
 * creators and operators whose paid offer is spiking on X, Reddit, TikTok or
 * YouTube today but who have no Product Hunt presence at all.
 *
 * Two passes on purpose. Asking for a schema and a search in one call lets the
 * model satisfy the schema immediately with an empty array and never search;
 * a free-form pass first makes searching the only way to produce anything.
 */
export async function sweepSocial(today: string, limit = 10): Promise<Array<Candidate>> {
  const { searchModel, searchTools, searchIsProviderSide, model } = brain()

  const sweep = await generateText({
    model: searchModel,
    // With provider-side search there is no tool loop to short-circuit, so the
    // schema can be satisfied in the same call — one request instead of two.
    ...(searchIsProviderSide ? { output: Output.object({ schema: socialSweepSchema }) } : {}),
    tools: searchTools,
    stopWhen: isStepCount(10),
    system: [
      'You are a scout for Whop, a platform where creators and operators sell digital products:',
      'communities, courses, coaching, trading/betting groups, newsletters, agencies, software, and bots.',
      'You find businesses that are getting traction RIGHT NOW and that sell, or obviously could sell, a paid digital offer.',
      'Search the live web. Do not answer from memory — anything you cannot tie to something published in the last few days is worthless here.',
    ].join(' '),
    prompt: [
      `Today is ${today}. Find up to ${limit} distinct products, creators, or small businesses that are spiking in attention today or in the last 48 hours.`,
      '',
      'Search across X/Twitter, Reddit, TikTok, YouTube, Instagram, Discord, Skool, Gumroad, Substack and indie-maker communities.',
      'Prioritise operators who already charge money — a paid community, a course, a subscription, a signals group, a paid newsletter, a template shop.',
      'Exclude: big public companies, anything already selling on Whop, pure open-source projects with no monetisation, and anything whose traction is older than a week.',
      '',
      'Search before you answer. For each one give the name, its primary URL, a one-line tagline, and the specific',
      'signal that made it register today (the post that blew up, the launch, the view count, the thread) —',
      'cite the number or the platform, not a vague "gaining traction".',
      '',
      'If a search turns up nothing usable, run a different one. Return findings as a plain list.',
    ].join('\n'),
  })

  const asSocial = (list: Array<Omit<Candidate, 'source'>>): Array<Candidate> =>
    list.slice(0, limit).map((candidate) => ({ ...candidate, source: 'social' }))

  if (searchIsProviderSide) return asSocial(sweep.output.candidates)

  // Tool-based search: the model can satisfy a schema without ever calling the
  // tool, so the search has to run free-form first and be structured after.
  const findings = findingsFrom(sweep)
  if (!findings) return []

  const { output } = await generateText({
    model,
    output: Output.object({ schema: socialSweepSchema }),
    system:
      'You convert research findings into structured records. Include only businesses actually named in the findings.',
    prompt: ['## Findings', findings].join('\n'),
  })

  return asSocial(output.candidates)
}
