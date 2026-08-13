import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail } from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode
John,Doe,john@example.com,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should reject country codes that are not ISO 3166-1', () => {
    const csv = `firstName,lastName,email,countryCode
Gabrielle,Ray,gabrielle@example.com,XXX
Amanda,James,amanda@example.com,12
Steven,Cole,steven@example.com,United States`

    const result = parseCsv(csv)

    expect(result.map((lead) => lead.countryCode)).toEqual([undefined, undefined, undefined])
    expect(result.every((lead) => !lead.isValid)).toBe(true)
    expect(result[0].errors).toContain('Invalid country code: "XXX"')
    expect(result[1].errors).toContain('Invalid country code: "12"')
    expect(result[2].errors).toContain('Invalid country code: "United States"')
  })

  it('should normalise country codes to uppercase alpha-2', () => {
    const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,es
Jane,Roe,jane@example.com, uk
Iñaki,Álvarez,inaki@example.com,ESP
Ana,Sol,ana@example.com,XK`

    const result = parseCsv(csv)

    expect(result.map((lead) => lead.countryCode)).toEqual(['ES', 'GB', 'ES', 'XK'])
    expect(result.every((lead) => lead.isValid)).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should map the phone, tenure and LinkedIn columns', () => {
    const csv = `firstName,lastName,email,phoneNumber,yearsInRole,linkedinUrl
John,Doe,john@example.com,+34 600 000 000,4,linkedin.com/in/john`

    const result = parseCsv(csv)

    expect(result[0].phoneNumber).toBe('+34 600 000 000')
    expect(result[0].yearsInRole).toBe(4)
    expect(result[0].linkedinUrl).toBe('https://linkedin.com/in/john')
    expect(result[0].isValid).toBe(true)
  })

  it('should accept alias headers for the new fields', () => {
    const csv = `firstName,lastName,email,Phone,Years In Role,LinkedIn
John,Doe,john@example.com,555-0100,2,https://www.linkedin.com/in/john`

    const result = parseCsv(csv)

    expect(result[0].phoneNumber).toBe('555-0100')
    expect(result[0].yearsInRole).toBe(2)
    expect(result[0].linkedinUrl).toBe('https://www.linkedin.com/in/john')
  })

  it('should invalidate a row whose years in role is not a whole number', () => {
    const csv = `firstName,lastName,email,yearsInRole
John,Doe,john@example.com,two
Jane,Roe,jane@example.com,-3`

    const result = parseCsv(csv)

    expect(result.every((lead) => !lead.isValid)).toBe(true)
    expect(result[0].errors).toContain('Years in role must be a whole number: "two"')
    expect(result[1].errors).toContain('Years in role must be a whole number: "-3"')
    expect(result[0].yearsInRole).toBeUndefined()
  })

  it('should invalidate a row whose LinkedIn URL is on another host', () => {
    const csv = `firstName,lastName,email,linkedinUrl
John,Doe,john@example.com,https://example.com/in/john`

    const result = parseCsv(csv)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('LinkedIn URL must be on linkedin.com: "https://example.com/in/john"')
  })

  it('should leave the new fields absent when their cells are blank', () => {
    const csv = `firstName,lastName,email,phoneNumber,yearsInRole,linkedinUrl
John,Doe,john@example.com,,,`

    const result = parseCsv(csv)

    expect(result[0].phoneNumber).toBeUndefined()
    expect(result[0].yearsInRole).toBeUndefined()
    expect(result[0].linkedinUrl).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })
})
