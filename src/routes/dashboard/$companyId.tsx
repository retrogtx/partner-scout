import { createFileRoute } from '@tanstack/react-router'

import { ScoutPage } from '#/components/scout-page'

/** Whop dashboard view — configure the app's dashboard path as `/dashboard/[companyId]`. */
export const Route = createFileRoute('/dashboard/$companyId')({ component: ScoutPage })
