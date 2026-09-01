import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { advance } from './scout/run'
import { emptyReport, reportSchema, type Report } from './scout/types'
import { listReportDates, loadReport, saveReport } from './store'
import { viewerOrAnonymous } from './whop-auth'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export const getReport = createServerFn({ method: 'GET' })
  .validator(z.object({ date: z.string().optional() }))
  .handler(async ({ data }): Promise<Report> => {
    const { userId } = await viewerOrAnonymous()
    const date = data.date ?? today()
    return (await loadReport(userId, date)) ?? emptyReport(date)
  })

export const getHistory = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<string>> => {
    const { userId } = await viewerOrAnonymous()
    return listReportDates(userId)
  },
)

/** Runs one stage of the scout. The client calls this until `stage === 'done'`. */
export const stepScout = createServerFn({ method: 'POST' })
  .validator(z.object({ report: reportSchema }))
  .handler(async ({ data }): Promise<Report> => {
    const { userId } = await viewerOrAnonymous()
    try {
      const next = await advance(data.report)
      await saveReport(userId, next)
      return next
    } catch (cause) {
      // Whatever crossed the RPC boundary before this was unreadable on the
      // client. Log the real thing, then rethrow a message worth showing.
      console.error(`[scout] stage "${data.report.stage}" failed`, cause)
      const detail = cause instanceof Error ? cause.message : JSON.stringify(cause)?.slice(0, 300)
      throw new Error(`Stage "${data.report.stage}" failed: ${detail ?? 'unknown error'}`)
    }
  })

export const resetReport = createServerFn({ method: 'POST' })
  .validator(z.object({ date: z.string().optional() }))
  .handler(async ({ data }): Promise<Report> => {
    const { userId } = await viewerOrAnonymous()
    const fresh = emptyReport(data.date ?? today())
    await saveReport(userId, fresh)
    return fresh
  })
