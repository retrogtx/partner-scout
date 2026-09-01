import { Badge, Button, Text } from 'frosted-ui'
import { useState } from 'react'

import { ANNUAL_REVENUE_LABELS, type Brief } from '#/server/scout/types'

function Section({
  title,
  children,
  aside,
}: {
  title: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{title}</span>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Bullets({ items }: { items: Array<string> }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
            style={{ background: 'var(--accent-9)' }}
          />
          <Text size="2" className="leading-relaxed">
            {item}
          </Text>
        </li>
      ))}
    </ul>
  )
}

function Chip({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'accent' }) {
  return (
    <span
      className="rounded-md px-2 py-1 text-[12px] leading-none"
      style={{
        background: tone === 'accent' ? 'var(--accent-a3)' : 'var(--gray-a3)',
        color: tone === 'accent' ? 'var(--accent-11)' : 'var(--gray-12)',
        border: '1px solid var(--hairline)',
      }}
    >
      {children}
    </span>
  )
}

function FitMeter({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  const tone = clamped >= 70 ? 'var(--green-9)' : clamped >= 45 ? 'var(--amber-9)' : 'var(--gray-8)'

  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">fit</span>
      <div className="h-1 w-16 overflow-hidden rounded-full" style={{ background: 'var(--gray-a4)' }}>
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: tone }} />
      </div>
      <span className="font-mono text-[12px] tabular-nums" style={{ color: 'var(--gray-12)' }}>
        {clamped}
      </span>
    </div>
  )
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      size="1"
      variant="surface"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

function confidenceTone(confidence: 'low' | 'medium' | 'high') {
  return confidence === 'high' ? 'success' : confidence === 'medium' ? 'warning' : 'gray'
}

export function BriefCard({ brief, index }: { brief: Brief; index: number }) {
  const { candidate, research, pitch } = brief
  const outreach = `${pitch.outreach.subject}\n\n${pitch.outreach.body}`

  return (
    <article className="panel overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className="font-mono text-[12px] tabular-nums" style={{ color: 'var(--gray-a9)' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold leading-none tracking-[-0.02em]">
              {candidate.name}
            </h2>
            <Chip tone="accent">{candidate.source === 'product_hunt' ? 'Product Hunt' : 'Social'}</Chip>
          </div>
          {research.website ? (
            <a
              href={research.website}
              target="_blank"
              rel="noreferrer"
              className="w-fit font-mono text-[12px] hover:underline"
              style={{ color: 'var(--gray-a10)' }}
            >
              {research.website.replace(/^https?:\/\//, '')}
            </a>
          ) : null}
        </div>
        <FitMeter score={candidate.fitScore} />
      </div>

      {/* Pitch headline + today's signal */}
      <div className="px-5 pb-5">
        <p className="text-[15px] leading-snug tracking-[-0.01em]">{pitch.headline}</p>
        <div
          className="mt-3 border-l-2 pl-3"
          style={{ borderColor: 'var(--accent-a8)' }}
        >
          <span className="eyebrow">signal today</span>
          <Text size="2" color="gray" className="mt-1 block leading-relaxed">
            {candidate.signal}
          </Text>
        </div>
      </div>

      {/* Facts grid */}
      <div className="grid border-t sm:grid-cols-2" style={{ borderColor: 'var(--hairline)' }}>
        <div className="border-b p-5 sm:border-r" style={{ borderColor: 'var(--hairline)' }}>
          <Section title="what they sell">
            <Text size="2" className="leading-relaxed">
              {research.summary}
            </Text>
            {research.monetization.pricePoints.length ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {research.monetization.pricePoints.map((price) => (
                  <Chip key={price}>{price}</Chip>
                ))}
              </div>
            ) : null}
          </Section>
        </div>

        <div className="border-b p-5" style={{ borderColor: 'var(--hairline)' }}>
          <Section title="stack today">
            <div className="flex flex-wrap gap-1.5">
              {research.monetization.currentStack.length ? (
                research.monetization.currentStack.map((tool) => <Chip key={tool}>{tool}</Chip>)
              ) : (
                <Text size="2" color="gray">
                  Not found
                </Text>
              )}
            </div>
            <Text size="2" color="gray" className="leading-relaxed">
              {research.monetization.model}
            </Text>
          </Section>
        </div>

        <div className="border-b p-5 sm:border-r" style={{ borderColor: 'var(--hairline)' }}>
          <Section title="audience">
            <div className="flex flex-col gap-1.5">
              {research.audience.channels.map((channel) => (
                <div
                  key={`${channel.platform}-${channel.handle}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <Text size="2">{channel.platform}</Text>
                  <span className="font-mono text-[12px] tabular-nums" style={{ color: 'var(--gray-a10)' }}>
                    {channel.followers ?? channel.handle ?? '—'}
                  </span>
                </div>
              ))}
            </div>
            <Text size="2" color="gray" className="leading-relaxed">
              {research.audience.reachNote}
            </Text>
          </Section>
        </div>

        <div className="border-b p-5" style={{ borderColor: 'var(--hairline)' }}>
          <Section
            title="revenue estimate"
            aside={
              <Badge size="1" color={confidenceTone(research.revenue.confidence)}>
                {research.revenue.confidence}
              </Badge>
            }
          >
            <Text size="4" weight="medium" className="tracking-[-0.02em]">
              {ANNUAL_REVENUE_LABELS[research.revenue.annualRevenue]}
            </Text>
            <Text size="2" color="gray" className="leading-relaxed">
              {research.revenue.basis}
            </Text>
          </Section>
        </div>
      </div>

      {/* Argument */}
      <div className="flex flex-col gap-6 p-5">
        <Section title="why whop, for them">
          <Bullets items={pitch.whyWhop} />
        </Section>

        {pitch.frictionToday.length ? (
          <Section title="what their setup costs them">
            <Bullets items={pitch.frictionToday} />
          </Section>
        ) : null}

        {pitch.comps.length ? (
          <Section title="comparable products on whop">
            <div className="flex flex-wrap gap-1.5">
              {pitch.comps.map((comp) => (
                <Chip key={comp} tone="accent">
                  {comp}
                </Chip>
              ))}
            </div>
          </Section>
        ) : null}

        {pitch.objections.length ? (
          <Section title="objections">
            <div className="flex flex-col">
              {pitch.objections.map((item, position) => (
                <div
                  key={item.objection}
                  className="flex flex-col gap-1 py-3"
                  style={{
                    borderTop: position === 0 ? 'none' : '1px solid var(--hairline)',
                    paddingTop: position === 0 ? 0 : undefined,
                  }}
                >
                  <Text size="2" weight="medium">
                    {item.objection}
                  </Text>
                  <Text size="2" color="gray" className="leading-relaxed">
                    {item.response}
                  </Text>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>

      {/* Outreach */}
      <div className="border-t p-5" style={{ borderColor: 'var(--hairline)' }}>
        <Section
          title={`outreach · ${pitch.outreach.channel}`}
          aside={<CopyButton text={outreach} label="Copy message" />}
        >
          <div className="panel-inset p-4">
            <Text size="2" weight="medium" className="block">
              {pitch.outreach.subject}
            </Text>
            <Text size="2" color="gray" className="mt-2 block whitespace-pre-wrap leading-relaxed">
              {pitch.outreach.body}
            </Text>
          </div>
          {research.contacts.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {research.contacts.map((contact) => (
                <Chip key={`${contact.channel}-${contact.handleOrEmail}`}>
                  {contact.channel}
                  {contact.handleOrEmail ? ` · ${contact.handleOrEmail}` : ''}
                </Chip>
              ))}
            </div>
          ) : null}
        </Section>
      </div>

      {/* Referral prefill */}
      <div
        className="flex flex-wrap items-end gap-x-8 gap-y-4 border-t p-5"
        style={{ borderColor: 'var(--hairline)', background: 'var(--panel-raised)' }}
      >
        <Field label="business name" value={pitch.referralPrefill.businessName} />
        <Field label="website" value={pitch.referralPrefill.website} mono />
        <Field
          label="annual revenue"
          value={ANNUAL_REVENUE_LABELS[pitch.referralPrefill.annualRevenue]}
        />
        <div className="ml-auto flex items-center gap-2">
          {research.sources.length ? <SourcesToggle sources={research.sources} /> : null}
          <Button
            size="2"
            variant="classic"
            render={<a href="https://whop.com/partners" target="_blank" rel="noreferrer" />}
          >
            Refer on Whop
          </Button>
        </div>
      </div>
    </article>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <span
        className={`truncate text-[13px] ${mono ? 'font-mono' : 'font-medium'}`}
        style={{ color: 'var(--gray-12)' }}
      >
        {value}
      </span>
    </div>
  )
}

function SourcesToggle({ sources }: { sources: Array<string> }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="2" variant="ghost" onClick={() => setOpen((value) => !value)}>
        {sources.length} sources
      </Button>
      {open ? (
        <div className="panel-inset mt-2 w-full basis-full p-4">
          <div className="flex flex-col gap-1.5">
            {sources.map((source) => (
              <a
                key={source}
                href={source}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[12px] hover:underline"
                style={{ color: 'var(--gray-a10)' }}
              >
                {source}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
