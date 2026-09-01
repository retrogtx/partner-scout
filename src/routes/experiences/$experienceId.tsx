import { createFileRoute } from '@tanstack/react-router'

import { ScoutPage } from '#/components/scout-page'

/** Whop experience view — configure the app's experience path as `/experiences/[experienceId]`. */
export const Route = createFileRoute('/experiences/$experienceId')({ component: ScoutPage })
