import { describe, it, expect } from 'vitest'
import { fieldCoverage, renderTemplatePreview, willBeSkipped } from './templatePreview'

const text = (template: string, lead: Parameters<typeof renderTemplatePreview>[1]) =>
  renderTemplatePreview(template, lead)
    .segments.map((segment) => segment.text)
    .join('')

describe('renderTemplatePreview', () => {
  it('substitutes values it has', () => {
    const preview = renderTemplatePreview('Hi {firstName} at {companyName}!', {
      firstName: 'Jane',
      companyName: 'Acme',
    })

    expect(text('Hi {firstName} at {companyName}!', { firstName: 'Jane', companyName: 'Acme' })).toBe(
      'Hi Jane at Acme!'
    )
    expect(preview.missing).toEqual([])
    expect(preview.unknown).toEqual([])
    expect(willBeSkipped(preview)).toBe(false)
  })

  it('reports every gap rather than stopping at the first', () => {
    const preview = renderTemplatePreview('{firstName} {companyName} {phoneNumber}', {
      firstName: 'Jane',
    })

    expect(preview.missing).toEqual(['companyName', 'phoneNumber'])
    expect(willBeSkipped(preview)).toBe(true)
  })

  it('leaves a missing placeholder in place and marks the segment', () => {
    const preview = renderTemplatePreview('Hi {firstName} at {companyName}', { firstName: 'Jane' })

    expect(preview.segments.map((segment) => segment.text).join('')).toBe('Hi Jane at {companyName}')
    expect(preview.segments.find((segment) => segment.missingField)).toEqual({
      text: '{companyName}',
      missingField: 'companyName',
    })
  })

  it('reports a placeholder naming no known field', () => {
    const preview = renderTemplatePreview('Hi {salary}', { firstName: 'Jane' })

    expect(preview.unknown).toEqual(['salary'])
    expect(preview.missing).toEqual([])
    expect(willBeSkipped(preview)).toBe(true)
  })

  it('rejects columns that are not user-settable fields', () => {
    expect(renderTemplatePreview('{message}', { firstName: 'Jane' }).unknown).toEqual(['message'])
  })

  it('treats an empty string as missing but zero as present', () => {
    expect(renderTemplatePreview('{jobTitle}', { jobTitle: '' }).missing).toEqual(['jobTitle'])
    expect(renderTemplatePreview('{yearsInRole}', { yearsInRole: 0 }).missing).toEqual([])
    expect(text('{yearsInRole} years', { yearsInRole: 0 })).toBe('0 years')
  })

  it('does not double-report a field used twice', () => {
    expect(renderTemplatePreview('{companyName} {companyName}', {}).missing).toEqual(['companyName'])
  })

  it('handles a template with no placeholders', () => {
    expect(text('Just a flat message.', {})).toBe('Just a flat message.')
  })

  it('handles an empty template', () => {
    expect(renderTemplatePreview('', {}).segments).toEqual([])
  })

  it('leaves malformed braces alone', () => {
    expect(text('{firstName', { firstName: 'Jane' })).toBe('{firstName')
    expect(text('{{firstName}}', { firstName: 'Jane' })).toBe('{Jane}')
  })

  it('is reusable across calls despite the module-level regex', () => {
    const template = '{firstName} {firstName}'
    expect(text(template, { firstName: 'Jane' })).toBe('Jane Jane')
    expect(text(template, { firstName: 'Bob' })).toBe('Bob Bob')
  })
})

describe('fieldCoverage', () => {
  const leads = [
    { firstName: 'Jane', companyName: 'Acme' },
    { firstName: 'Bob', companyName: '' },
    { firstName: 'Ada' },
  ]

  it('counts leads with a usable value', () => {
    expect(fieldCoverage(leads, 'firstName')).toBe(3)
    expect(fieldCoverage(leads, 'companyName')).toBe(1)
    expect(fieldCoverage(leads, 'linkedinUrl')).toBe(0)
  })

  it('returns zero for an empty selection', () => {
    expect(fieldCoverage([], 'firstName')).toBe(0)
  })
})
