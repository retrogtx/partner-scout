import { defineConfig } from 'nitro'

// Vercel's Hobby plan hard-caps a function at 60s, so asking for more is
// silently unhonoured. The scout is split so no single stage needs longer;
// raise this to 300 on Pro if you want fewer, larger requests.
export default defineConfig({
  vercel: {
    functions: {
      maxDuration: 60,
    },
  },
})
