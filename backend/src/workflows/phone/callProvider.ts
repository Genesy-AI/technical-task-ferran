/**
 * The one place a phone provider is actually called over HTTP.
 *
 * Its real job is classifying failures, because that is what the retry policy acts on: a 401 is a
 * bug in our config and will fail identically three times, while a 429 or a 503 is exactly what
 * exponential backoff exists for.
 */

import { PROVIDER_API_KEYS } from './config'
import { PhoneLookupInput, PhoneProvider } from './providers'

/**
 * Errors of this type are listed in the workflow's `nonRetryableErrorTypes`. Temporal derives the
 * failure type from `Error.name`, so the name — not the class — is the contract.
 */
export class ProviderRejectedError extends Error {
  name = 'ProviderRejected'
}

/** Retried by Temporal: the provider is temporarily unhappy, not permanently wrong about us. */
export class ProviderUnavailableError extends Error {
  name = 'ProviderUnavailable'
}

const isPermanent = (status: number) => status === 400 || status === 401 || status === 403 || status === 404

export async function callProvider(provider: PhoneProvider, input: PhoneLookupInput): Promise<string | null> {
  const request = provider.buildRequest(input, PROVIDER_API_KEYS[provider.id])

  let response: Response
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...request.headers },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(provider.requestTimeoutMs),
    })
  } catch (error) {
    // Network error or our own client-side timeout — both worth another attempt.
    const reason = error instanceof Error ? error.message : String(error)
    throw new ProviderUnavailableError(`${provider.label} did not respond: ${reason}`)
  }

  if (isPermanent(response.status)) {
    throw new ProviderRejectedError(`${provider.label} rejected the request (${response.status})`)
  }

  if (!response.ok) {
    throw new ProviderUnavailableError(`${provider.label} returned ${response.status}`)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    // A 200 we can't read is a provider defect, not a transient one; treat it as a miss and let the
    // next provider in the chain have a go.
    return null
  }

  return provider.parsePhone(payload)
}
