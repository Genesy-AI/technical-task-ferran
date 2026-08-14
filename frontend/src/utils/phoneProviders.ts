/**
 * Presentation-side mirror of the backend phone-provider registry
 * (`backend/src/workflows/phone/providers.ts`). Labels and status values only — the request
 * shapes, keys and retry policy stay on the server.
 *
 * Kept in sync by hand, same arrangement as `countries.ts` and `leadFields.ts`; there is no shared
 * package in this repo.
 */

export type PhoneStatus = 'running' | 'found' | 'not_found' | 'failed'

export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

const PROVIDER_LABELS: Record<PhoneProviderId, string> = {
  orionConnect: 'Orion Connect',
  astraDialer: 'Astra Dialer',
  nimbusLookup: 'Nimbus Lookup',
}

export const providerLabel = (id: string | null): string | null =>
  (id && PROVIDER_LABELS[id as PhoneProviderId]) || null
