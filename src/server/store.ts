import { upstash } from './env'
import { reportSchema, type Report } from './scout/types'

const memory = new Map<string, Report>()

function key(userId: string, date: string): string {
  return `partner-scout:${userId}:${date}`
}

async function upstashCommand(command: Array<string>): Promise<unknown> {
  const config = upstash()
  if (!config) return null

  const response = await fetch(config.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  })
  if (!response.ok) throw new Error(`Upstash ${response.status}: ${await response.text()}`)

  const body = (await response.json()) as { result?: unknown }
  return body.result ?? null
}

/**
 * Reports are keyed per user per day. Without Upstash configured this is an
 * in-memory map, which is per-isolate on Workers — fine for a single run,
 * but history survives only where a real store is wired up.
 */
export async function saveReport(userId: string, report: Report): Promise<void> {
  memory.set(key(userId, report.date), report)
  try {
    // Reports age out after 90 days; a scout brief is worthless long after that.
    await upstashCommand(['SET', key(userId, report.date), JSON.stringify(report), 'EX', '7776000'])
  } catch (error) {
    // A stage costs minutes of model time and the client already holds the
    // result — never throw that away because the cache write failed.
    console.error('[store] persist failed', error)
  }
}

export async function loadReport(userId: string, date: string): Promise<Report | null> {
  try {
    const raw = await upstashCommand(['GET', key(userId, date)])
    if (typeof raw === 'string') {
      // Both the JSON and the shape are untrusted: a value written by an older
      // version of the schema must degrade to "no report", not a 500 on load.
      const parsed = reportSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    }
  } catch (error) {
    console.error('[store] read failed', error)
  }
  return memory.get(key(userId, date)) ?? null
}

export async function listReportDates(userId: string): Promise<Array<string>> {
  const scanned = await upstashCommand(['KEYS', `partner-scout:${userId}:*`]).catch(() => null)
  const remote = Array.isArray(scanned) ? scanned.map((k) => String(k).split(':').pop()!) : []
  const local = [...memory.keys()]
    .filter((k) => k.startsWith(`partner-scout:${userId}:`))
    .map((k) => k.split(':').pop()!)

  return [...new Set([...remote, ...local])].sort().reverse()
}
