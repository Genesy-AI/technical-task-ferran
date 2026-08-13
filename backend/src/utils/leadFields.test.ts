import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  CSV_HEADER_INDEX,
  IMPORTABLE_FIELDS,
  LEAD_FIELDS,
  MESSAGE_FIELDS,
  REQUIRED_FIELDS,
  getLeadField,
  listFieldKeys,
  normalizeCsvHeader,
  parseFieldValue,
} from './leadFields'

const field = (key: string) => {
  const found = getLeadField(key)
  if (!found) throw new Error(`no such field: ${key}`)
  return found
}

describe('LEAD_FIELDS', () => {
  it('has unique keys', () => {
    const keys = LEAD_FIELDS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('carries the three new data points', () => {
    expect(LEAD_FIELDS.map((f) => f.key)).toEqual(
      expect.arrayContaining(['phoneNumber', 'yearsInRole', 'linkedinUrl'])
    )
  })

  it('derives its subsets from the flags', () => {
    expect(REQUIRED_FIELDS.map((f) => f.key)).toEqual(['firstName', 'lastName', 'email'])
    expect(MESSAGE_FIELDS.every((f) => f.inMessages)).toBe(true)
    expect(IMPORTABLE_FIELDS.every((f) => f.importable)).toBe(true)
  })
})

describe('the frontend mirror', () => {
  // The two packages are separate installs, so the registry is vendored on both sides the way
  // countries.ts already is. Byte-identical is the contract — this is the drift alarm.
  it('is byte-identical to this file', () => {
    const here = readFileSync(join(__dirname, 'leadFields.ts'), 'utf8')
    const there = readFileSync(join(__dirname, '../../../frontend/src/utils/leadFields.ts'), 'utf8')
    expect(there).toBe(here)
  })
})

describe('CSV_HEADER_INDEX', () => {
  it('matches headers regardless of case, spacing and punctuation', () => {
    expect(CSV_HEADER_INDEX.get(normalizeCsvHeader('yearsInRole'))).toBe('yearsInRole')
    expect(CSV_HEADER_INDEX.get(normalizeCsvHeader('Years In Role'))).toBe('yearsInRole')
    expect(CSV_HEADER_INDEX.get(normalizeCsvHeader('years_in_role'))).toBe('yearsInRole')
  })

  it('resolves declared aliases', () => {
    expect(CSV_HEADER_INDEX.get(normalizeCsvHeader('phone'))).toBe('phoneNumber')
    expect(CSV_HEADER_INDEX.get(normalizeCsvHeader('LinkedIn'))).toBe('linkedinUrl')
    expect(CSV_HEADER_INDEX.get(normalizeCsvHeader('country'))).toBe('countryCode')
  })

  it('does not resolve unknown headers', () => {
    expect(CSV_HEADER_INDEX.get(normalizeCsvHeader('salary'))).toBeUndefined()
  })
})

describe('parseFieldValue', () => {
  it('treats blank as unset for every type, without an error', () => {
    for (const leadField of LEAD_FIELDS) {
      expect(parseFieldValue(leadField, '   ')).toEqual({ value: null })
      expect(parseFieldValue(leadField, null)).toEqual({ value: null })
      expect(parseFieldValue(leadField, undefined)).toEqual({ value: null })
    }
  })

  it('trims string fields', () => {
    expect(parseFieldValue(field('jobTitle'), '  Copywriter ')).toEqual({ value: 'Copywriter' })
  })

  it('normalises country codes and rejects non-ISO values', () => {
    expect(parseFieldValue(field('countryCode'), ' esp ')).toEqual({ value: 'ES' })
    expect(parseFieldValue(field('countryCode'), 'XXX')).toEqual({
      value: null,
      error: 'Invalid country code: "XXX"',
    })
  })

  describe('int', () => {
    it('accepts whole numbers including zero', () => {
      expect(parseFieldValue(field('yearsInRole'), '0')).toEqual({ value: 0 })
      expect(parseFieldValue(field('yearsInRole'), ' 12 ')).toEqual({ value: 12 })
    })

    it('accepts a number that has already been through JSON', () => {
      expect(parseFieldValue(field('yearsInRole'), 3)).toEqual({ value: 3 })
    })

    it('rejects anything that is not a whole number', () => {
      for (const raw of ['two', '-3', '2.5', '3 years', '1e3']) {
        const result = parseFieldValue(field('yearsInRole'), raw)
        expect(result.value).toBeNull()
        expect(result.error).toBe(`Years in role must be a whole number: "${raw}"`)
      }
    })
  })

  describe('url', () => {
    it('accepts a fully qualified URL', () => {
      expect(parseFieldValue(field('linkedinUrl'), 'https://www.linkedin.com/in/jane')).toEqual({
        value: 'https://www.linkedin.com/in/jane',
      })
    })

    it('assumes https for a bare host', () => {
      expect(parseFieldValue(field('linkedinUrl'), 'linkedin.com/in/jane')).toEqual({
        value: 'https://linkedin.com/in/jane',
      })
    })

    it('accepts country subdomains', () => {
      expect(parseFieldValue(field('linkedinUrl'), 'https://es.linkedin.com/in/jane').value).toBe(
        'https://es.linkedin.com/in/jane'
      )
    })

    it('rejects a URL on another host', () => {
      expect(parseFieldValue(field('linkedinUrl'), 'https://example.com/in/jane')).toEqual({
        value: null,
        error: 'LinkedIn URL must be on linkedin.com: "https://example.com/in/jane"',
      })
    })

    it('rejects a host that merely ends in the same letters', () => {
      expect(parseFieldValue(field('linkedinUrl'), 'notlinkedin.com/in/jane').value).toBeNull()
    })

    it('rejects a non-http scheme', () => {
      expect(parseFieldValue(field('linkedinUrl'), 'javascript:alert(1)').value).toBeNull()
    })
  })
})

describe('listFieldKeys', () => {
  it('renders the required set for user-facing copy', () => {
    expect(listFieldKeys(REQUIRED_FIELDS)).toBe('firstName, lastName and email')
  })

  it('handles one and zero fields', () => {
    expect(listFieldKeys([field('email')])).toBe('email')
    expect(listFieldKeys([])).toBe('')
  })
})
