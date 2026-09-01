import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Nitro compiles the server half into Vercel Functions. Vercel auto-detects
// both TanStack Start and Nitro, so there is no build command to configure.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  // frosted-ui's ESM build uses extensionless directory imports ("./components"),
  // which Node's native resolver rejects. Bundling it for SSR lets Vite resolve
  // them instead of handing the package to Node.
  ssr: { noExternal: ['frosted-ui', '@frosted-ui/icons'] },
  plugins: [tailwindcss(), tanstackStart(), nitro(), viteReact()],
})
