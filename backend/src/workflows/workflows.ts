import { ActivityOptions, proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'
import {
  canAttempt,
  getPhoneProvider,
  PhoneAttempt,
  PhoneEnrichmentResult,
  PhoneLookupInput,
  PhoneStatus,
  PROVIDER_ORDER,
  ProviderId,
} from './phone/providers'

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 second',
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}

/** Local writes and reads: fast, and on the default queue rather than a provider's rate-limited one. */
const { loadLeadForPhoneLookup, savePhoneProgress, savePhoneResult } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  // Bounded on purpose: if the lead was deleted mid-run these fail identically forever, and the
  // Temporal default is unlimited attempts.
  retry: { maximumAttempts: 3 },
})

/**
 * Timeout, retry budget and task queue all come from the provider's own registry entry, so tuning a
 * provider never means editing the workflow.
 */
const activityOptionsFor = (id: ProviderId): ActivityOptions => {
  const provider = getPhoneProvider(id)

  return {
    taskQueue: provider.taskQueue,
    startToCloseTimeout: provider.startToCloseTimeout,
    retry: {
      maximumAttempts: provider.maximumAttempts,
      initialInterval: '1 second',
      backoffCoefficient: 2,
      // A rejected key or a malformed request fails the same way three times.
      nonRetryableErrorTypes: ['ProviderRejected'],
    },
  }
}

type LookupActivity = (input: PhoneLookupInput) => Promise<string | null>

const lookupActivity: Record<ProviderId, LookupActivity> = {
  orionConnect: proxyActivities<typeof activities>(activityOptionsFor('orionConnect')).lookupPhoneOrion,
  astraDialer: proxyActivities<typeof activities>(activityOptionsFor('astraDialer')).lookupPhoneAstra,
  nimbusLookup: proxyActivities<typeof activities>(activityOptionsFor('nimbusLookup')).lookupPhoneNimbus,
}

/**
 * Walk the providers in registry order, stop at the first phone number, and record what happened
 * either way.
 *
 * One workflow per lead — the caller enforces that with `workflowId: enrich-phone-<leadId>`.
 *
 * A provider that errors out after its retries does not abort the chain: the next provider still
 * gets its turn, and only a run where every attempted provider failed is reported as `failed`
 * rather than `not_found`. "Nobody has this number" and "we couldn't ask" are different answers.
 */
export async function enrichPhoneWorkflow(leadId: number): Promise<PhoneEnrichmentResult> {
  const lead = await loadLeadForPhoneLookup(leadId)

  if (!lead) {
    throw new Error(`Lead ${leadId} no longer exists`)
  }

  const attempts: PhoneAttempt[] = []

  for (const providerId of PROVIDER_ORDER) {
    if (!canAttempt(providerId, lead)) {
      attempts.push({ provider: providerId, outcome: 'skipped' })
      continue
    }

    await savePhoneProgress(leadId, providerId)

    try {
      const phoneNumber = await lookupActivity[providerId](lead)

      if (phoneNumber) {
        attempts.push({ provider: providerId, outcome: 'found' })
        await savePhoneResult(leadId, { status: 'found', phoneNumber, provider: providerId })
        return { leadId, status: 'found', phoneNumber, provider: providerId, attempts }
      }

      attempts.push({ provider: providerId, outcome: 'no-data' })
    } catch (error) {
      attempts.push({
        provider: providerId,
        outcome: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const answered = attempts.some((attempt) => attempt.outcome === 'no-data')
  const errored = attempts.some((attempt) => attempt.outcome === 'error')
  const status: PhoneStatus = !answered && errored ? 'failed' : 'not_found'

  await savePhoneResult(leadId, { status, phoneNumber: null, provider: null })

  return { leadId, status, phoneNumber: null, provider: null, attempts }
}
