import { describe, it, expect } from 'vitest'
import { normalizeCountryCode, isValidCountryCode, COUNTRY_NAMES_BY_ALPHA2 } from './countries'

describe('normalizeCountryCode', () => {
  it('accepts alpha-2 codes and uppercases them', () => {
    expect(normalizeCountryCode('ES')).toBe('ES')
    expect(normalizeCountryCode('es')).toBe('ES')
    expect(normalizeCountryCode('  tv  ')).toBe('TV')
  })

  it('resolves alpha-3 codes to alpha-2', () => {
    expect(normalizeCountryCode('ESP')).toBe('ES')
    expect(normalizeCountryCode('gbr')).toBe('GB')
  })

  it('accepts UK as an alias for GB', () => {
    expect(normalizeCountryCode('UK')).toBe('GB')
    expect(normalizeCountryCode('uk')).toBe('GB')
  })

  it('rejects values outside the standard', () => {
    expect(normalizeCountryCode('XXX')).toBeNull()
    expect(normalizeCountryCode('12')).toBeNull()
    expect(normalizeCountryCode('United States')).toBeNull()
    expect(isValidCountryCode('XXX')).toBe(false)
  })

  it('treats an absent value as no country rather than an error', () => {
    expect(normalizeCountryCode('')).toBeNull()
    expect(normalizeCountryCode(null)).toBeNull()
    expect(normalizeCountryCode(undefined)).toBeNull()
  })

  it('includes the user-assigned XK entry', () => {
    expect(normalizeCountryCode('XK')).toBe('XK')
    expect(COUNTRY_NAMES_BY_ALPHA2.get('XK')).toBe('Kosovo')
  })
})
