import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { Theme } from 'frosted-ui'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'color-scheme', content: 'dark' },
      { title: 'Partner Scout' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://rsms.me' },
      { rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="frosted-ui dark" style={{ colorScheme: 'dark' }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* iris + slate is the closest Frosted gets to Linear's blue-violet on near-black. */}
        <Theme appearance="dark" accentColor="iris" grayColor="slate" hasBackground={false}>
          {children}
        </Theme>
        <Scripts />
      </body>
    </html>
  )
}
