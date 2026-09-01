# Partner Scout

Finds the three products worth chasing today and turns each one into a Whop Partners referral
pitch you can actually send.

[Whop Partners](https://whop.com/partners) pays a share of a referred business's processing
volume, so a good target isn't the loudest launch — it's one with real, repeatable revenue it
could plausibly move onto Whop. Partner Scout looks for that specifically, and every run ends
with something actionable: a drafted outreach message and the three fields the referral form
actually asks for.

<!-- Add a screenshot here once deployed: ![Partner Scout](docs/screenshot.png) -->

## What a run does

A run walks four stages. Each is a separate request, so you watch it progress rather than
staring at a spinner.

| Stage | What happens |
| --- | --- |
| **Source** | Today's Product Hunt front page (Atom feed, no token), plus a live web sweep of X, Reddit, TikTok, YouTube, Gumroad, Skool and Substack for paid offers spiking in the last 48 hours. In parallel: Whop Discover's top earners over the last 24 hours. |
| **Rank** | Scores every candidate on how much processing volume it could realistically move onto Whop, using the Discover data as evidence of what actually converts there. Picks three. Drops anything already on Whop, already referred by you, or with attention but no paid offer. |
| **Research** | Per target: pricing, the payment and community stack they run today (Gumroad, Kajabi, Stripe, Patreon, a free Discord…), audience size per channel, a revenue estimate with its arithmetic shown, and how to reach the operator. Search-backed, with sources listed. |
| **Brief** | Why Whop for *them* specifically, what their current stack costs them, comparable Whop products already earning, the objections they'll raise, a drafted outreach message, and the referral prefill — business name, website, and an annual revenue band matching Whop's own enum. |

Sources degrade independently: if the social sweep or Discover fails, the failure lands in the
run log and the run continues. Only an empty candidate set aborts.

## Setup

```bash
pnpm install
cp .env.example .env      # add one gateway key
pnpm dev
```

You need **one** of `OPENROUTER_API_KEY` or `AI_GATEWAY_API_KEY`. Both work — the only real
difference is how the research step reaches the live web:

| | Model access | Live search |
| --- | --- | --- |
| **OpenRouter** | `@openrouter/ai-sdk-provider` | the `web` plugin, applied by OpenRouter |
| **Vercel AI Gateway** | `@ai-sdk/gateway` | `perplexitySearch`, executed by the Gateway |

If both keys are set, OpenRouter wins; `SCOUT_AI_PROVIDER=gateway` forces the other.

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` / `AI_GATEWAY_API_KEY` | one of them | See above. |
| `SCOUT_AI_PROVIDER` | no | `openrouter` \| `gateway`. Only needed when both keys are set. |
| `SCOUT_MODEL` | no | Defaults to `anthropic/claude-opus-5`. |
| `WHOP_API_KEY` | for Discover | Whop dashboard → Developer → Apps → *Set up your local environment*. Without it the Discover comps step is skipped. |
| `APP_ID` | in production | `app_…`. Checked against the iframe token's audience. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | for history | Without these the store is in-memory, which on serverless means no history survives. |

### Model choice matters more than usual

The pipeline asks for schema-constrained JSON in four places. Weaker models fail this outright
(`No object generated: could not parse the response`) or hold the schema but hallucinate into
gaps. Among OpenRouter's free tier only `dots-studio/dots-3-note-preview:free` reliably does
both structured output *and* search — usable for iterating on plumbing, not for briefs anyone
acts on. Put a frontier model behind `SCOUT_MODEL` before trusting the output.

Note the search plugin bills separately (~$0.007/call) even on a free-tier key.

## Deploying

Vercel auto-detects TanStack Start + Nitro, so there's no build command to configure:

```bash
vercel            # preview
vercel --prod     # production
```

Set the environment variables above in the Vercel project. Long-running stages need headroom —
`vercel.json` sets `maxDuration` to 300s, which requires a plan that allows it.

### Wiring it into Whop

The app renders at three paths, all the same page:

- `/` — standalone
- `/dashboard/$companyId` — Whop dashboard view
- `/experiences/$experienceId` — Whop experience view

In the [developer dashboard](https://whop.com/dashboard/developer) → Hosting, point the app's
base URL at your Vercel domain and set the dashboard path to `/dashboard/[companyId]` and the
experience path to `/experiences/[experienceId]`.

> **Hosting trade-off.** Whop's own app hosting (`whop apps deploy`) injects the app's Whop API
> key into `api.whop.com` requests at the platform layer, so app code never holds it. Hosting on
> Vercel gives that up — you set `WHOP_API_KEY` yourself. Everything else, including iframe auth,
> works the same.

## How it's built

**TanStack Start** (React 19, Vite 8) with **Nitro** targeting Vercel Functions.
**Frosted UI** — Whop's Radix-based design system — for the interface. **Vercel AI SDK v7** for
the model layer, behind a provider seam so the gateway is one env var.

A few decisions worth knowing about:

**The run is a step machine.** A full run is minutes of model time, which no single serverless
request survives. `advance()` moves the report forward exactly one stage and returns it; the
client loops until `stage === 'done'`. Every completed stage is persisted, so a run that dies
partway offers **Resume** rather than making you pay for the earlier stages again.

**Search runs in two passes.** Asking for a schema and a web search in the same call lets the
model satisfy the schema immediately with an empty array and never search. A free-form pass
first makes searching the only way to produce anything; a second pass structures the findings.
`generateText` also only reports the *final* step's text, so a run ending on a tool call needs
the intermediate step text recovered (`findingsFrom`).

**Auth is hand-rolled on purpose.** `@whop/sdk` no longer ships `verifyUserToken`, so
`src/server/whop-auth.ts` verifies the `x-whop-user-token` JWT directly against Whop's published
JWKS (ES256, issuer `urn:whopcom:exp-proxy`, audience `APP_ID`). Local dev falls back to an
anonymous viewer.

**The pitch is fenced against invention.** The model may not state Whop fees, percentages, or
migration guarantees — a partner would be held to whatever it writes — and may not assert facts
about the target the research didn't establish. When the comp set is empty it must return an
empty list rather than concluding no comparable product exists.

```
src/
  components/     scout-page · brief-card · shell (top bar, stage rail)
  routes/         / · /dashboard/$companyId · /experiences/$experienceId
  server/
    ai.ts         provider seam — OpenRouter vs Gateway, and where search comes from
    env.ts        typed env access
    whop.ts       Discover GraphQL + Partners REST
    whop-auth.ts  iframe JWT verification
    store.ts      per-user/per-day reports, memory or Upstash
    functions.ts  server functions the client calls
    scout/        types · sources · rank · research · run (the step machine)
```

## Known gaps

- **Whop Discover comps are unverified.** Every run so far has been local without a
  `WHOP_API_KEY`, so the comps array has always been empty and that code path hasn't executed
  successfully end to end.
- **Weak models confabulate into research gaps.** A target that returns one source still gets a
  confident-sounding pitch. Sources-per-brief is shown so you can spot it, but it isn't gated.
- **No dedupe against previously-referred businesses in code** — it's instructed in the ranking
  prompt and depends on the Partners API returning results.
