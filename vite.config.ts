import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { nitro } from 'nitro/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Cloudflare is the primary target; Vercel sets VERCEL=1 on its builder, which
// is the only signal needed to swap the server adapter. Everything else — env
// access included — is identical, because process.env is populated on both.
const onVercel = Boolean(process.env.VERCEL)

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // frosted-ui's ESM build uses extensionless directory imports that Node's
  // resolver rejects, so it has to be bundled rather than externalised.
  ssr: { noExternal: ['frosted-ui', '@frosted-ui/icons'] },
  plugins: [
    onVercel ? nitro() : cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
