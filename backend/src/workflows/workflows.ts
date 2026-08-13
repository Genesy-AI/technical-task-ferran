import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { verifyEmail } = proxyActivities<typeof activities>({
  // The verification provider is slow for some addresses (up to ~20s in the mock), so the
  // per-attempt budget has to clear that. At 1s the activity timed out, and the *default* retry
  // policy is unbounded — it retried forever and the workflow never completed.
  startToCloseTimeout: '30 seconds',
  retry: {
    // Bounded, so a genuinely failing address surfaces as an error instead of hanging the caller.
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
