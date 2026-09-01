import { defineConfig } from 'nitro'

// A research stage is minutes of model time, far past Vercel's default
// function timeout. The step machine keeps each request to one stage, but that
// stage still needs real headroom.
export default defineConfig({
  vercel: {
    functions: {
      maxDuration: 300,
    },
  },
})
