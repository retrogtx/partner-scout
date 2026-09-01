import { Button, Callout, Spinner, Text } from 'frosted-ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import { BriefCard } from './brief-card'
import { StageRail, TopBar } from './shell'
import { getReport, resetReport, stepScout } from '#/server/functions'
import { stageLabel, type Report } from '#/server/scout/types'

export function ScoutPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Survives re-renders so an in-flight loop can be cancelled by unmount.
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    getReport({ data: {} })
      .then(setReport)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
    return () => {
      cancelled.current = true
    }
  }, [])

  const run = useCallback(async (from: Report) => {
    setRunning(true)
    setError(null)
    let current = from
    try {
      // Each call advances one stage; looping here is what keeps any single
      // request short enough to survive the Workers runtime.
      while (current.stage !== 'done' && !cancelled.current) {
        current = await stepScout({ data: { report: current } })
        setReport(current)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }, [])

  const startFresh = useCallback(async () => {
    setError(null)
    try {
      const fresh = await resetReport({ data: {} })
      setReport(fresh)
      await run(fresh)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [run])

  if (!report) {
    return (
      <div className="grid min-h-screen place-items-center p-5">
        {/* A failed initial load used to leave this spinning forever, because
            `report` stays null and the error was never given a surface. */}
        {error ? (
          <Callout.Root color="danger" className="max-w-xl">
            <Callout.Title>Could not load today’s report</Callout.Title>
            <Callout.Description>{error}</Callout.Description>
          </Callout.Root>
        ) : (
          <Spinner size="3" />
        )}
      </div>
    )
  }

  const done = report.stage === 'done'
  const notStarted = report.stage === 'sourcing' && report.candidates.length === 0 && !running
  // Every completed stage is persisted, so a run that died partway can pick up
  // where it stopped instead of paying for the earlier stages again.
  const resumable = !done && !notStarted && !running

  return (
    <div className="min-h-screen">
      <TopBar
        date={report.date}
        actions={
          <>
            {resumable ? (
              <Button size="2" variant="ghost" onClick={startFresh}>
                Start over
              </Button>
            ) : null}
            {/* Not Button's `loading` prop — it swaps the label out for a spinner,
                which reads as an empty button. The stage rail already animates. */}
            <Button
              size="2"
              variant="classic"
              disabled={running}
              onClick={() => (done ? startFresh() : run(report))}
            >
              {running ? 'Scouting…' : notStarted ? 'Run scout' : resumable ? 'Resume' : 'Run again'}
            </Button>
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pb-24 pt-6">
        {notStarted ? (
          <EmptyState onRun={() => run(report)} />
        ) : (
          <>
            <div className="panel flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StageRail report={report} running={running} />
                <Text size="1" color="gray">
                  {done ? 'Report ready' : stageLabel(report)}
                </Text>
              </div>
              {report.log.length ? (
                <>
                  <div className="rule" />
                  <div className="flex flex-col gap-1">
                    {report.log.map((line) => (
                      <div key={line} className="flex gap-2">
                        <span className="eyebrow mt-[3px] shrink-0">·</span>
                        <Text size="1" color="gray" className="leading-relaxed">
                          {line}
                        </Text>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {error ? (
              <Callout.Root color="danger">
                <Callout.Title>Scout stopped</Callout.Title>
                <Callout.Description>{error}</Callout.Description>
              </Callout.Root>
            ) : null}

            {report.briefs.map((brief, index) => (
              <BriefCard key={brief.candidate.name} brief={brief} index={index} />
            ))}

            {running && report.briefs.length < report.shortlist.length ? (
              <PendingCard
                name={report.shortlist[report.briefs.length]?.name}
                index={report.briefs.length}
              />
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

function PendingCard({ name, index }: { name?: string; index: number }) {
  return (
    <div className="panel flex items-center gap-4 p-5">
      <span className="font-mono text-[12px] tabular-nums" style={{ color: 'var(--gray-a9)' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <Spinner size="1" />
      <Text size="2" color="gray">
        {name ? `Researching ${name}…` : 'Working…'}
      </Text>
    </div>
  )
}

function EmptyState({ onRun }: { onRun: () => void }) {
  const steps = [
    ['Source', 'Today’s Product Hunt front page, plus a live sweep of X, Reddit, TikTok and the creator platforms.'],
    ['Rank', 'Scored on how much processing volume each could realistically move onto Whop.'],
    ['Research', 'Pricing, current payment stack, audience, revenue estimate, and who to contact.'],
    ['Brief', 'A pitch built on their specific gaps, plus outreach and the referral prefill.'],
  ] as const

  return (
    <div className="panel mt-10 overflow-hidden">
      <div className="flex flex-col gap-3 p-8 pb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Nothing scouted yet today</h1>
        <Text size="2" color="gray" className="max-w-xl leading-relaxed">
          Find the three products worth chasing today and turn each into a Whop Partners referral
          you can actually send.
        </Text>
        <div className="flex items-center gap-3 pt-2">
          <Button size="3" variant="classic" onClick={onRun}>
            Run scout
          </Button>
          <Text size="1" color="gray">
            Takes a few minutes — leave the tab open.
          </Text>
        </div>
      </div>
      <div className="grid border-t sm:grid-cols-2" style={{ borderColor: 'var(--hairline)' }}>
        {steps.map(([title, body], index) => (
          <div
            key={title}
            className="flex gap-3 border-b p-5 sm:odd:border-r"
            style={{ borderColor: 'var(--hairline)' }}
          >
            <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--gray-a8)' }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex flex-col gap-1">
              <Text size="2" weight="medium">
                {title}
              </Text>
              <Text size="1" color="gray" className="leading-relaxed">
                {body}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
