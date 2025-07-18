import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: 'price-comparison-app-79fd88qa',
  authRequired: true
})

export default blink