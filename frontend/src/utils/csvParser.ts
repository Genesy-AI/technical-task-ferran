import Papa from 'papaparse'
import {
  CSV_HEADER_INDEX,
  FieldKey,
  FieldValue,
  REQUIRED_FIELDS,
  getLeadField,
  normalizeCsvHeader,
  parseFieldValue,
} from './leadFields'

/**
 * A parsed row. Field values are keyed by registry key and simply absent when the cell was blank,
 * so a new importable field shows up here with no change to this file.
 */
export type CsvLead = Partial<Record<FieldKey, FieldValue>> & {
  firstName: string
  lastName: string
  email: string
  isValid: boolean
  errors: string[]
  rowIndex: number
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const values: Partial<Record<FieldKey, FieldValue>> = {}
    const errors: string[] = []

    Object.entries(row).forEach(([header, value]) => {
      const key = CSV_HEADER_INDEX.get(normalizeCsvHeader(header))
      const field = key ? getLeadField(key) : undefined
      if (!key || !field) return

      const { value: parsed, error } = parseFieldValue(field, value)
      if (error) errors.push(error)
      // Left absent rather than null when blank, so `lead.jobTitle` reads as "not provided".
      if (parsed !== null) values[key] = parsed
    })

    for (const field of REQUIRED_FIELDS) {
      if (values[field.key] === undefined) {
        errors.push(`${field.label} is required`)
      }
    }

    if (values.email !== undefined && !isValidEmail(String(values.email))) {
      errors.push('Invalid email format')
    }

    data.push({
      ...values,
      firstName: String(values.firstName ?? ''),
      lastName: String(values.lastName ?? ''),
      email: String(values.email ?? ''),
      isValid: errors.length === 0,
      errors,
      rowIndex: index + 2,
    })
  })

  return data
}
