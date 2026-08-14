import { describe, expect, it } from 'vitest'
import {
  ASTRA_DIALER,
  canAttempt,
  deriveCompanyWebsite,
  NIMBUS_LOOKUP,
  ORION_CONNECT,
  PhoneLookupInput,
  PROVIDER_ORDER,
} from './providers'

const lead = (overrides: Partial<PhoneLookupInput> = {}): PhoneLookupInput => ({
  leadId: 1,
  fullName: 'Jane Smith',
  email: 'jane.smith@acme.io',
  jobTitle: 'CTO',
  companyWebsite: 'acme.io',
  ...overrides,
})

describe('provider order', () => {
  it('asks the best provider first and the newest last', () => {
    expect(PROVIDER_ORDER).toEqual(['orionConnect', 'astraDialer', 'nimbusLookup'])
  })
})

describe('buildRequest', () => {
  it('puts Orion’s key in the x-auth-me header and sends name + website', () => {
    const request = ORION_CONNECT.buildRequest(lead(), 'mySecretKey123')

    expect(request.url).toBe('https://api.enginy.ai/api/tmp/orionConnect')
    expect(request.headers).toEqual({ 'x-auth-me': 'mySecretKey123' })
    expect(request.body).toEqual({ fullName: 'Jane Smith', companyWebsite: 'acme.io' })
  })

  it('puts Astra’s key in the apiKey header and sends only the email', () => {
    const request = ASTRA_DIALER.buildRequest(lead(), '1234jhgf')

    expect(request.headers).toEqual({ apiKey: '1234jhgf' })
    expect(request.body).toEqual({ email: 'jane.smith@acme.io' })
  })

  it('puts Nimbus’ key in the query string, not a header', () => {
    const request = NIMBUS_LOOKUP.buildRequest(lead(), '000099998888')

    expect(request.url).toBe('https://api.enginy.ai/api/tmp/numbusLookup?api=000099998888')
    expect(request.headers).toEqual({})
    expect(request.body).toEqual({ email: 'jane.smith@acme.io', jobTitle: 'CTO' })
  })
})

describe('canAttempt', () => {
  it('skips Orion when the company website could not be derived', () => {
    expect(canAttempt('orionConnect', lead({ companyWebsite: null }))).toBe(false)
    expect(canAttempt('orionConnect', lead())).toBe(true)
  })

  it('skips Nimbus without a job title but still allows Astra', () => {
    const input = lead({ jobTitle: null })

    expect(canAttempt('nimbusLookup', input)).toBe(false)
    expect(canAttempt('astraDialer', input)).toBe(true)
  })

  it('skips the email-based providers when the lead has no email', () => {
    const input = lead({ email: null })

    expect(canAttempt('astraDialer', input)).toBe(false)
    expect(canAttempt('nimbusLookup', input)).toBe(false)
  })
})

describe('parsePhone', () => {
  it('reads Orion’s string phone', () => {
    expect(ORION_CONNECT.parsePhone({ phone: '5329298537' })).toBe('5329298537')
    expect(ORION_CONNECT.parsePhone({ phone: null })).toBeNull()
  })

  it('reads Astra’s null / undefined / missing forms as no data', () => {
    expect(ASTRA_DIALER.parsePhone({ phoneNmbr: '+34600111222' })).toBe('+34600111222')
    expect(ASTRA_DIALER.parsePhone({ phoneNmbr: null })).toBeNull()
    expect(ASTRA_DIALER.parsePhone({ phoneNmbr: undefined })).toBeNull()
    expect(ASTRA_DIALER.parsePhone({})).toBeNull()
  })

  it('reads Nimbus’ JSON number under the field name it actually uses', () => {
    // The live endpoint answers `phoneNmbr`; the README documents `number`. Both are accepted.
    expect(NIMBUS_LOOKUP.parsePhone({ phoneNmbr: 8169345459, countryCode: 'ES' })).toBe('8169345459')
    expect(NIMBUS_LOOKUP.parsePhone({ number: 8169345459, countryCode: 'ES' })).toBe('8169345459')
  })

  it('treats an unusable payload as a miss rather than a value', () => {
    for (const provider of [ORION_CONNECT, ASTRA_DIALER, NIMBUS_LOOKUP]) {
      expect(provider.parsePhone(undefined)).toBeNull()
      expect(provider.parsePhone('not an object')).toBeNull()
      expect(provider.parsePhone({})).toBeNull()
    }

    expect(ORION_CONNECT.parsePhone({ phone: '   ' })).toBeNull()
    expect(NIMBUS_LOOKUP.parsePhone({ phoneNmbr: Number.NaN })).toBeNull()
  })
})

describe('deriveCompanyWebsite', () => {
  it('takes the domain from a work address', () => {
    expect(deriveCompanyWebsite('jane.smith@Acme.IO')).toBe('acme.io')
    expect(deriveCompanyWebsite('jane@mail.acme.co.uk')).toBe('mail.acme.co.uk')
  })

  it('refuses free-mail hosts — they are the lead’s mailbox, not their employer', () => {
    expect(deriveCompanyWebsite('hancockjames@gmail.com')).toBeNull()
    expect(deriveCompanyWebsite('someone@outlook.com')).toBeNull()
  })

  it('refuses anything that is not a usable domain', () => {
    expect(deriveCompanyWebsite(null)).toBeNull()
    expect(deriveCompanyWebsite('')).toBeNull()
    expect(deriveCompanyWebsite('no-at-sign')).toBeNull()
    expect(deriveCompanyWebsite('jane@localhost')).toBeNull()
  })
})
