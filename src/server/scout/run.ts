import { fetchReferredBusinesses, fetchWhopTrending } from '../whop'
import { rankCandidates } from './rank'
import { briefTarget } from './research'
import { fetchProductHunt, sweepSocial } from './sources'
import type { Report } from './types'

/**
 * Fingerprints on the full normalised URL, not the host — every Product Hunt
 * entry shares a host, so a host-level key collapses the whole feed into one.
 */
function dedupe(candidates: Array<Report['candidates'][number]>): Array<Report['candidates'][number]> {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const path = candidate.url
      ?.toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
    const fingerprint = path || candidate.name.toLowerCase().trim()
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}

async function settled<T>(label: string, work: Promise<T>, log: Array<string>): Promise<T | null> {
  try {
    return await work
  } catch (error) {
    log.push(`${label} failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * Advances the report by exactly one stage.
 *
 * A full run is minutes of model time, which no single request survives. Each
 * call does one bounded chunk and hands the report back, so the client drives
 * the loop and gets real progress instead of a spinner.
 */
export async function advance(report: Report): Promise<Report> {
  const log = [...report.log]

  switch (report.stage) {
    case 'sourcing': {
      const [productHunt, social, comps] = await Promise.all([
        settled('Product Hunt', fetchProductHunt(), log),
        settled('Social sweep', sweepSocial(report.date), log),
        settled('Whop Discover', fetchWhopTrending(), log),
      ])

      const candidates = dedupe([...(productHunt ?? []), ...(social ?? [])])
      if (candidates.length === 0) {
        throw new Error(`No candidates found. ${log.join(' ') || 'All sources returned empty.'}`)
      }

      log.push(
        `Sourced ${candidates.length} candidates (${productHunt?.length ?? 0} Product Hunt, ${social?.length ?? 0} social) and ${comps?.length ?? 0} Whop comps.`,
      )
      return { ...report, stage: 'ranking', candidates, comps: comps ?? [], log }
    }

    case 'ranking': {
      const alreadyReferred = await fetchReferredBusinesses()
      const { shortlist, rejected } = await rankCandidates({
        today: report.date,
        candidates: report.candidates,
        comps: report.comps,
        alreadyReferred,
      })

      log.push(`Shortlisted ${shortlist.map((item) => item.name).join(', ')}.`)
      if (rejected.length) log.push(`Passed on ${rejected.length} others.`)
      return { ...report, stage: 'researching', shortlist, log }
    }

    case 'researching': {
      const target = report.shortlist[report.briefs.length]
      if (!target) return { ...report, stage: 'done', log }

      const { research, pitch } = await briefTarget({
        target,
        today: report.date,
        comps: report.comps,
      })

      const briefs = [...report.briefs, { candidate: target, research, pitch }]
      log.push(`Researched ${target.name} (${research.sources.length} sources).`)

      return {
        ...report,
        stage: briefs.length >= report.shortlist.length ? 'done' : 'researching',
        briefs,
        log,
      }
    }

    case 'done':
      return report
  }
}
