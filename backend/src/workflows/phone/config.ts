/**
 * Provider credentials. Activity-side only — `providers.ts` takes the key as an argument precisely
 * so that workflow code never reaches `process.env`.
 *
 * The README's keys are the defaults so the take-home runs with no setup; in a real deployment
 * these would be required env vars and the fallbacks would be deleted.
 */

import { ProviderId } from './providers'

export const PROVIDER_API_KEYS: Readonly<Record<ProviderId, string>> = {
  orionConnect: process.env.ORION_CONNECT_API_KEY ?? 'mySecretKey123',
  astraDialer: process.env.ASTRA_DIALER_API_KEY ?? '1234jhgf',
  nimbusLookup: process.env.NIMBUS_LOOKUP_API_KEY ?? '000099998888',
}
