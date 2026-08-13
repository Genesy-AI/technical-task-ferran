import { FieldKey, MESSAGE_FIELDS } from './leadFields'

/** Anything with registry-keyed values — a lead from the API, or a parsed CSV row. */
export type TemplateLead = Partial<Record<FieldKey, unknown>>

export interface TemplateSegment {
  text: string
  /** Set when this segment is a placeholder the lead has no value for. */
  missingField?: FieldKey
  /** Set when this segment is a placeholder naming a field that does not exist. */
  unknownField?: string
}

export interface TemplatePreview {
  segments: TemplateSegment[]
  missing: FieldKey[]
  unknown: string[]
}

const PLACEHOLDER = /\{(\w+)\}/g

export const hasValue = (value: unknown): boolean => value !== null && value !== undefined && value !== ''

/**
 * Render a template against one lead for display.
 *
 * Deliberately not a copy of the backend's `generateMessageFromTemplate`: that one throws on the
 * first gap because it is producing a message, whereas this one has to render the whole string and
 * report *every* gap so the user can see what is wrong before generating. The two agree on which
 * leads are unusable — see `willBeSkipped`.
 */
export const renderTemplatePreview = (template: string, lead: TemplateLead): TemplatePreview => {
  const segments: TemplateSegment[] = []
  const missing: FieldKey[] = []
  const unknown: string[] = []

  let lastIndex = 0
  let match: RegExpExecArray | null
  PLACEHOLDER.lastIndex = 0

  while ((match = PLACEHOLDER.exec(template)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: template.slice(lastIndex, match.index) })
    }
    lastIndex = PLACEHOLDER.lastIndex

    const name = match[1]
    const field = MESSAGE_FIELDS.find((candidate) => candidate.key === name)

    if (!field) {
      if (!unknown.includes(name)) unknown.push(name)
      segments.push({ text: match[0], unknownField: name })
      continue
    }

    const value = lead[field.key]

    if (!hasValue(value)) {
      if (!missing.includes(field.key)) missing.push(field.key)
      segments.push({ text: match[0], missingField: field.key })
      continue
    }

    segments.push({ text: String(value) })
  }

  if (lastIndex < template.length) {
    segments.push({ text: template.slice(lastIndex) })
  }

  return { segments, missing, unknown }
}

/** A lead the backend will refuse to generate for — same rule, predicted client-side. */
export const willBeSkipped = (preview: TemplatePreview): boolean =>
  preview.missing.length > 0 || preview.unknown.length > 0

/** How many of these leads have a usable value for the field. Drives the picker's coverage badge. */
export const fieldCoverage = (leads: TemplateLead[], key: FieldKey): number =>
  leads.filter((lead) => hasValue(lead[key])).length
