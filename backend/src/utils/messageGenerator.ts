import { FieldKey, FieldValue, MESSAGE_FIELDS } from './leadFields'

/**
 * Only the placeholder-able fields are read here, so the shape is derived from the registry
 * rather than restated. A lead may legitimately be missing any optional one.
 */
export type Lead = { firstName: string } & Partial<Record<FieldKey, FieldValue | undefined>>

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  let message = template

  const templateVariables = template.match(/\{(\w+)\}/g) || []

  for (const variable of templateVariables) {
    const fieldName = variable.slice(1, -1)
    const field = MESSAGE_FIELDS.find((candidate) => candidate.key === fieldName)

    if (!field) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[field.key]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    // A replacer function, not a replacement string: lead values contain arbitrary text and `$&`
    // or `$1` inside one would otherwise be re-interpreted as a substitution pattern.
    const replacement = String(fieldValue)
    message = message.replace(new RegExp(`\\{${fieldName}\\}`, 'g'), () => replacement)
  }

  return message
}
