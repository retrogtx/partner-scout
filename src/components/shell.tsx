import { Text } from 'frosted-ui'

import type { Report, ReportStage } from '#/server/scout/types'

export function TopBar({
  date,
  actions,
}: {
  date: string
  actions: React.ReactNode
}) {
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur-xl"
      style={{ borderColor: 'var(--hairline)', background: 'color-mix(in srgb, var(--canvas) 82%, transparent)' }}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-5">
        <div className="flex items-center gap-2.5">
          <Mark />
          <Text size="2" weight="medium">
            Partner Scout
          </Text>
        </div>
        <span className="eyebrow opacity-40">/</span>
        <span className="eyebrow">{date}</span>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
    </header>
  )
}

/**
 * A scope: quiet ring, one lit sweep, one locked target. Monochrome with a
 * single accent element — a letter in a coloured box reads as a placeholder.
 */
function Mark() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden>
      {/* 300° ring, open at the upper right */}
      <path
        d="M17 10A7 7 0 1 1 13.5 3.94"
        stroke="var(--gray-a9)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* the target, sitting in the gap */}
      <circle cx="16.06" cy="6.5" r="2.35" fill="var(--accent-9)" />
    </svg>
  )
}

const STAGES: Array<{ id: ReportStage; label: string }> = [
  { id: 'sourcing', label: 'Source' },
  { id: 'ranking', label: 'Rank' },
  { id: 'researching', label: 'Research' },
  { id: 'done', label: 'Brief' },
]

const ORDER: Array<ReportStage> = ['sourcing', 'ranking', 'researching', 'done']

/** Horizontal stepper. Each step is past / current / upcoming — no percentages. */
export function StageRail({ report, running }: { report: Report; running: boolean }) {
  const currentIndex = ORDER.indexOf(report.stage)

  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((stage, index) => {
        const state = index < currentIndex ? 'past' : index === currentIndex ? 'current' : 'upcoming'
        const active = state === 'current' && running
        const detail =
          stage.id === 'researching' && (state === 'current' || state === 'past')
            ? `${Math.min(report.briefs.length + (state === 'current' ? 1 : 0), Math.max(report.shortlist.length, 1))}/${report.shortlist.length || 3}`
            : null

        return (
          <div key={stage.id} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span
                aria-hidden
                className="h-px w-5"
                style={{ background: state === 'upcoming' ? 'var(--hairline)' : 'var(--accent-a7)' }}
              />
            ) : null}
            <span
              className="flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 transition-colors"
              style={{
                background: state === 'current' ? 'var(--accent-a3)' : 'transparent',
                color:
                  state === 'upcoming'
                    ? 'var(--gray-a9)'
                    : state === 'current'
                      ? 'var(--accent-11)'
                      : 'var(--gray-12)',
              }}
            >
              <Dot state={state} pulsing={active} />
              <span className="text-[12px] font-medium leading-none">{stage.label}</span>
              {detail ? <span className="eyebrow leading-none">{detail}</span> : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Dot({ state, pulsing }: { state: 'past' | 'current' | 'upcoming'; pulsing: boolean }) {
  if (state === 'past') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <circle cx="6" cy="6" r="5.5" fill="var(--accent-9)" />
        <path
          d="M3.6 6.2 5.2 7.8 8.4 4.6"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    )
  }
  return (
    <span className="relative grid h-3 w-3 place-items-center">
      {pulsing ? (
        <span
          className="absolute inset-0 animate-ping rounded-full"
          style={{ background: 'var(--accent-a6)' }}
        />
      ) : null}
      <span
        className="relative h-2 w-2 rounded-full"
        style={{
          background: state === 'current' ? 'var(--accent-9)' : 'transparent',
          border: state === 'upcoming' ? '1px solid var(--gray-a7)' : 'none',
        }}
      />
    </span>
  )
}
