/**
 * The phone-provider registry.
 *
 * Three providers that agree on nothing: different request bodies, auth in a header vs the query
 * string, and three different names for the same field in the response. Everything provider-shaped
 * is confined to an entry in this file — the workflow only knows an ordered list of ids, and the
 * transport (`callProvider.ts`) only knows `buildRequest` and `parsePhone`. Adding a fourth
 * provider is one entry plus one activity wrapper.
 *
 * This module is imported by workflow code, so it must stay pure: no IO, no `process`, no clock.
 * Credentials are passed in from the activity side (`config.ts`) rather than read here.
 */

import type { ActivityOptions } from '@temporalio/workflow'

/** Temporal's duration literal (`'15 seconds'`). Type-only, so nothing is imported at runtime. */
type Duration = NonNullable<ActivityOptions['startToCloseTimeout']>

export const PHONE_PROVIDER_BASE_URL = 'https://api.enginy.ai/api/tmp'

export type ProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

/** Everything a provider could want about a lead, normalised once by the loader activity. */
export interface PhoneLookupInput {
  leadId: number
  fullName: string
  email: string | null
  jobTitle: string | null
  companyWebsite: string | null
}

export interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

export interface PhoneProvider {
  id: ProviderId
  label: string
  /** Its own task queue, so a per-provider rate limit is a worker option rather than a semaphore. */
  taskQueue: string
  /** Ceiling across every worker on that queue. Providers are unlimited today; they won't stay so. */
  maxActivitiesPerSecond: number
  /** Inputs that must be non-empty for a call to be worth making. */
  requires: readonly (keyof PhoneLookupInput)[]
  /** Bounds the HTTP request itself; `startToCloseTimeout` bounds the activity around it. */
  requestTimeoutMs: number
  startToCloseTimeout: Duration
  maximumAttempts: number
  buildRequest(input: PhoneLookupInput, apiKey: string): ProviderRequest
  parsePhone(payload: unknown): string | null
}

const field = (payload: unknown, key: string): unknown =>
  payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : undefined

/**
 * Providers return phones as strings, as JSON numbers, as `null`, or by omitting the key. Anything
 * that isn't a non-empty scalar means "no data" — an unparseable payload is not an error worth
 * retrying, it is a miss.
 */
const asPhone = (value: unknown): string | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  if (typeof value !== 'string') return null
  return value.trim() || null
}

export const ORION_CONNECT: PhoneProvider = {
  id: 'orionConnect',
  label: 'Orion Connect',
  taskQueue: 'phone-orion-connect',
  maxActivitiesPerSecond: 5,
  requires: ['fullName', 'companyWebsite'],
  // Measured at ~4.4s per call against the live endpoint, so a "short" timeout still has to be
  // generous enough to clear an honest slow response.
  requestTimeoutMs: 12_000,
  startToCloseTimeout: '15 seconds',
  maximumAttempts: 3,
  buildRequest: (input, apiKey) => ({
    url: `${PHONE_PROVIDER_BASE_URL}/orionConnect`,
    headers: { 'x-auth-me': apiKey },
    body: { fullName: input.fullName, companyWebsite: input.companyWebsite },
  }),
  parsePhone: (payload) => asPhone(field(payload, 'phone')),
}

export const ASTRA_DIALER: PhoneProvider = {
  id: 'astraDialer',
  label: 'Astra Dialer',
  taskQueue: 'phone-astra-dialer',
  maxActivitiesPerSecond: 20,
  requires: ['email'],
  requestTimeoutMs: 4_000,
  startToCloseTimeout: '5 seconds',
  maximumAttempts: 3,
  buildRequest: (input, apiKey) => ({
    url: `${PHONE_PROVIDER_BASE_URL}/astraDialer`,
    headers: { apiKey },
    body: { email: input.email },
  }),
  parsePhone: (payload) => asPhone(field(payload, 'phoneNmbr')),
}

export const NIMBUS_LOOKUP: PhoneProvider = {
  id: 'nimbusLookup',
  label: 'Nimbus Lookup',
  taskQueue: 'phone-nimbus-lookup',
  maxActivitiesPerSecond: 10,
  requires: ['email', 'jobTitle'],
  requestTimeoutMs: 8_000,
  startToCloseTimeout: '10 seconds',
  maximumAttempts: 3,
  // The only one that authenticates by query parameter.
  buildRequest: (input, apiKey) => ({
    url: `${PHONE_PROVIDER_BASE_URL}/numbusLookup?api=${encodeURIComponent(apiKey)}`,
    headers: {},
    body: { email: input.email, jobTitle: input.jobTitle },
  }),
  // Documented as `{ number, countryCode }`; the live endpoint actually answers
  // `{ phoneNmbr: 8169345459, countryCode: 'ES' }`. Accept both rather than trust the doc.
  parsePhone: (payload) => asPhone(field(payload, 'phoneNmbr') ?? field(payload, 'number')),
}

/** Best data first, cheapest fallback last — the order the chain is walked in. */
export const PHONE_PROVIDERS: readonly PhoneProvider[] = [ORION_CONNECT, ASTRA_DIALER, NIMBUS_LOOKUP]

export const PROVIDER_ORDER: readonly ProviderId[] = PHONE_PROVIDERS.map((provider) => provider.id)

export const getPhoneProvider = (id: ProviderId): PhoneProvider => {
  const provider = PHONE_PROVIDERS.find((candidate) => candidate.id === id)
  if (!provider) throw new Error(`Unknown phone provider: ${id}`)
  return provider
}

/**
 * A provider whose required inputs are missing is skipped, not called. Sending a lead with no
 * company website to Orion burns an attempt and a rate-limit slot to be told nothing.
 */
export const canAttempt = (id: ProviderId, input: PhoneLookupInput): boolean =>
  getPhoneProvider(id).requires.every((key) => Boolean(input[key]))

export const PROVIDER_LABELS: Readonly<Record<ProviderId, string>> = {
  orionConnect: ORION_CONNECT.label,
  astraDialer: ASTRA_DIALER.label,
  nimbusLookup: NIMBUS_LOOKUP.label,
}

/**
 * Free-mail hosts are the lead's mailbox, not their employer, so they yield no company website.
 * Not exhaustive by design — a miss here costs one skipped Orion call, a false positive would send
 * Orion a garbage domain.
 */
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'yahoo.co.uk',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
])

/**
 * `lead` has no company-website column, and Orion needs one. The email domain is the only honest
 * source we have; a free-mail domain yields `null`, which makes Orion unattemptable for that lead.
 */
export const deriveCompanyWebsite = (email: string | null | undefined): string | null => {
  const domain = email?.split('@')[1]?.trim().toLowerCase()
  if (!domain || !domain.includes('.') || FREE_MAIL_DOMAINS.has(domain)) return null
  return domain
}

export type PhoneStatus = 'running' | 'found' | 'not_found' | 'failed'

export type AttemptOutcome = 'found' | 'no-data' | 'skipped' | 'error'

export interface PhoneAttempt {
  provider: ProviderId
  outcome: AttemptOutcome
  error?: string
}

export interface PhoneEnrichmentResult {
  leadId: number
  status: PhoneStatus
  phoneNumber: string | null
  provider: ProviderId | null
  attempts: PhoneAttempt[]
}
