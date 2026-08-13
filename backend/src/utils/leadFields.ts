/**
 * Single source of truth for lead fields.
 *
 * The field list keeps growing, so nothing downstream enumerates fields by hand: the
 * message-template whitelist, the bulk-import whitelist and the per-value coercion rules are all
 * derived from LEAD_FIELDS. Adding a field = one entry here + a Prisma migration.
 *
 * Kept in sync by hand with the copy on the other side of the stack (backend/frontend);
 * there is no shared package in this repo. Same arrangement as `countries.ts`.
 */

import { normalizeCountryCode } from './countries'

/**
 * How a raw CSV/JSON value is coerced and validated.
 * - `string`  free text, trimmed
 * - `country` ISO 3166-1, normalised to alpha-2 via `normalizeCountryCode`
 * - `int`     non-negative whole number
 * - `url`     http(s), optionally pinned to a host by `hostSuffix`
 */
export type FieldType = 'string' | 'country' | 'int' | 'url'

interface LeadFieldDefinition {
  key: string
  label: string
  type: FieldType
  /** A row without this is rejected on import. */
  required: boolean
  /** Settable through CSV import. */
  importable: boolean
  /** Usable as a `{placeholder}` in a message template. */
  inMessages: boolean
  /** Extra CSV headers that map to this field, on top of the key itself. */
  csvAliases?: readonly string[]
  /** `url` fields only: the host the URL must sit on. */
  hostSuffix?: string
}

/** Exported for type-level use only — iterate `LEAD_FIELDS` instead. */
export const FIELD_DEFINITIONS = [
  {
    key: 'firstName',
    label: 'First name',
    type: 'string',
    required: true,
    importable: true,
    inMessages: true,
  },
  { key: 'lastName', label: 'Last name', type: 'string', required: true, importable: true, inMessages: true },
  { key: 'email', label: 'Email', type: 'string', required: true, importable: true, inMessages: true },
  {
    key: 'jobTitle',
    label: 'Job title',
    type: 'string',
    required: false,
    importable: true,
    inMessages: true,
  },
  {
    key: 'companyName',
    label: 'Company',
    type: 'string',
    required: false,
    importable: true,
    inMessages: true,
  },
  {
    key: 'countryCode',
    label: 'Country',
    type: 'country',
    required: false,
    importable: true,
    inMessages: true,
    csvAliases: ['country'],
  },
  {
    key: 'phoneNumber',
    label: 'Phone',
    type: 'string',
    required: false,
    importable: true,
    inMessages: true,
    csvAliases: ['phone', 'phonenumber', 'telephone'],
  },
  {
    key: 'yearsInRole',
    label: 'Years in role',
    type: 'int',
    required: false,
    importable: true,
    inMessages: true,
    csvAliases: ['years', 'yearsatcompany', 'yearsincompany'],
  },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    type: 'url',
    required: false,
    importable: true,
    inMessages: true,
    hostSuffix: 'linkedin.com',
    csvAliases: ['linkedin', 'linkedinprofile', 'linkedinprofileurl'],
  },
] as const satisfies readonly LeadFieldDefinition[]

export type FieldKey = (typeof FIELD_DEFINITIONS)[number]['key']

export interface LeadField extends LeadFieldDefinition {
  key: FieldKey
}

/**
 * The registry. Widened from the `as const` literal on purpose: the literal narrows each entry to
 * exactly the keys it declares, which hides the optional ones from anything iterating the list.
 */
export const LEAD_FIELDS: readonly LeadField[] = FIELD_DEFINITIONS

/** A coerced value ready for Prisma. `null` means "not set". */
export type FieldValue = string | number | null

/** Placeholders a template may reference. Excludes `message` (self-referential) and `emailVerified`. */
export const MESSAGE_FIELDS = LEAD_FIELDS.filter((field) => field.inMessages)

export const IMPORTABLE_FIELDS = LEAD_FIELDS.filter((field) => field.importable)

export const REQUIRED_FIELDS = LEAD_FIELDS.filter((field) => field.required)

export const getLeadField = (key: string): LeadField | undefined =>
  LEAD_FIELDS.find((field) => field.key === key)

/** CSV headers are matched loosely: case, spaces, underscores and punctuation are all ignored. */
export const normalizeCsvHeader = (header: string): string => header.toLowerCase().replace(/[^a-z]/g, '')

/** normalised header -> field key, covering both the key itself and any declared aliases. */
export const CSV_HEADER_INDEX: ReadonlyMap<string, FieldKey> = new Map(
  IMPORTABLE_FIELDS.flatMap((field) =>
    [field.key as string, ...(field.csvAliases ?? [])].map((header): [string, FieldKey] => [
      normalizeCsvHeader(header),
      field.key,
    ])
  )
)

export interface ParsedFieldValue {
  value: FieldValue
  error?: string
}

const parseUrl = (field: LeadField, raw: string): ParsedFieldValue => {
  // Accept `linkedin.com/in/jane` as readily as the fully-qualified form.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { value: null, error: `Invalid ${field.label} URL: "${raw}"` }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { value: null, error: `Invalid ${field.label} URL: "${raw}"` }
  }

  const host = url.hostname.toLowerCase()
  if (field.hostSuffix) {
    if (host !== field.hostSuffix && !host.endsWith(`.${field.hostSuffix}`)) {
      return { value: null, error: `${field.label} URL must be on ${field.hostSuffix}: "${raw}"` }
    }
  } else if (!host.includes('.')) {
    return { value: null, error: `Invalid ${field.label} URL: "${raw}"` }
  }

  return { value: url.toString() }
}

/**
 * Coerce and validate one raw value for a field.
 *
 * Blank is always accepted and yields `null` — optionality is enforced separately, by
 * `REQUIRED_FIELDS`. A value that is present but unparseable is an error, which follows the
 * behaviour `countryCode` already had: a bad optional value invalidates the row rather than being
 * silently dropped.
 */
export const parseFieldValue = (field: LeadField, raw: unknown): ParsedFieldValue => {
  const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()

  if (!trimmed) return { value: null }

  switch (field.type) {
    case 'country': {
      const code = normalizeCountryCode(trimmed)
      return code ? { value: code } : { value: null, error: `Invalid country code: "${trimmed}"` }
    }
    case 'int': {
      if (!/^\d+$/.test(trimmed)) {
        return { value: null, error: `${field.label} must be a whole number: "${trimmed}"` }
      }
      return { value: Number(trimmed) }
    }
    case 'url':
      return parseUrl(field, trimmed)
    default:
      return { value: trimmed }
  }
}

/** e.g. `firstName, lastName and email` — for user-facing copy, so it can't drift from the list. */
export const listFieldKeys = (fields: readonly LeadField[]): string => {
  const keys = fields.map((field) => field.key)
  if (keys.length <= 1) return keys.join('')
  return `${keys.slice(0, -1).join(', ')} and ${keys[keys.length - 1]}`
}
