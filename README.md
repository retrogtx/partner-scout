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
cp .env.example .dev.vars  # add one gateway key
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
| `WHOP_API_KEY` | for Discover | Must be an **App** API key, not a Company one — `public-graphql` rejects company keys outright (`You must provide a valid App API Key`). Get it from a specific app: dashboard → Developer → Apps → your app → *Get started → Set up your local environment*. |
| `APP_ID` | for Whop | `app_…`. Verifies the iframe token's audience. Does **not** control whether auth is required — see `ALLOW_ANONYMOUS`. |
| `ALLOW_ANONYMOUS` | no | `1` lets requests with **no** token through as an anonymous viewer, which is what makes a bare deployment usable outside Whop. Off by default. A presented token is always verified either way. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | for history | Without these the store is in-memory, which on Workers is per-isolate, so no history survives. |

### Model choice matters more than usual

The pipeline asks for schema-constrained JSON in four places. Weaker models fail this outright
(`No object generated: could not parse the response`) or hold the schema but hallucinate into
gaps. Among OpenRouter's free tier only `dots-studio/dots-3-note-preview:free` reliably does
both structured output *and* search — usable for iterating on plumbing, not for briefs anyone
acts on. Put a frontier model behind `SCOUT_MODEL` before trusting the output.

Note the search plugin bills separately (~$0.007/call) even on a free-tier key.

**The free tier also has a daily request cap** (~50/day with no credits), and a full run is 8–11
model calls — so a handful of runs exhausts it and every stage then fails with
`Rate limit exceeded: free-models-per-day`. Adding $10 of credit raises it to 1000/day.

## Deploying

Cloudflare Workers, via Wrangler:

```bash
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SCOUT_MODEL          # and any others from the table above
pnpm build && npx wrangler deploy
```

### Why Workers and not a serverless function

Workers meter **CPU time**, and waiting on `fetch()` doesn't count toward it. There's no enforced
wall-clock limit for HTTP-triggered Workers while the client stays connected. This pipeline is
almost entirely waiting on model APIs with negligible compute, so the constraint that bites
elsewhere barely applies.

That matters because it was a real problem: on Vercel's Hobby plan, functions are capped at 60s
of wall-clock and the research stage was killed mid-run. The stage split below is a legacy of
that, and is worth keeping regardless — it gives finer progress and finer resume.

`wrangler.jsonc` raises `cpu_ms` well above the 30s default as belt-and-braces. That's a **paid
plan** setting; delete the `limits` block on the free plan, where CPU is capped at 10ms per
request (still likely enough here, since almost nothing is CPU).

### Wiring it into Whop

The app renders at three paths, all the same page:

- `/` — standalone
- `/dashboard/$companyId` — Whop dashboard view
- `/experiences/$experienceId` — Whop experience view

In the [developer dashboard](https://whop.com/dashboard/developer) → Hosting, point the app's base
URL at your Worker domain and set the dashboard path to `/dashboard/[companyId]` and the
experience path to `/experiences/[experienceId]`.

> **On auth.** While `APP_ID` is unset the deployment falls back to a shared anonymous viewer so
> the URL works standalone — which also means anyone with the link can spend your gateway credits.
> Setting `APP_ID` switches to strict verification of the Whop iframe token. Set it.

> **Alternative: Whop's own app hosting** (`whop apps deploy`) is also Cloudflare Workers, and
> injects the app's Whop API key into `api.whop.com` calls at the platform layer — so `WHOP_API_KEY`
> becomes unnecessary and Discover comps work with no configuration. The trade is no public URL and
> no cron. Switching back means restoring the `whop()` Vite plugin from `@whop/cli/vite`.

## How it's built

**TanStack Start** (React 19, Vite 8) on **Cloudflare Workers** via `@cloudflare/vite-plugin`.
**Frosted UI** — Whop's Radix-based design system — for the interface. **Vercel AI SDK v7** for
the model layer, behind a provider seam so the gateway is one env var.

A few decisions worth knowing about:

**The run is a step machine.** `advance()` moves the report forward exactly one stage and
returns it; the client loops until `stage === 'done'`. Research is itself three stages —
`researching` / `structuring` / `pitching`, one model call each, with partial work carried on
`report.pending`. Every completed stage is persisted, so a run that dies partway offers
**Resume** rather than making you pay for the earlier stages again.

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

- **Referral dedupe is inert** until the app is granted the `partner:basic:read` scope
  (developer dashboard → your app → Permissions). Without it `GET /partners/businesses` returns
  `403 not authorized for the partner:basic:read scope`, the scout can't see what you've already
  referred, and it may resurface a business you've referred before. Fails soft into the run log.
- **Weak models confabulate into research gaps.** A target that returns one source still gets a
  confident-sounding pitch. Sources-per-brief is shown so you can spot it, but it isn't gated.
- **The social sweep is unreliable at the free model tier** — it returns 7–8 candidates on a good
  run and 0 on a bad one, with no error. When it's empty, Product Hunt carries the run, which
  skews toward SaaS and away from Whop's creator-economy ICP.
