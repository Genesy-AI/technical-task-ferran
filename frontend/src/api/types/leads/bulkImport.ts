import type { CsvLead } from '../../../utils/csvParser'

/** Rows are sent as parsed: registry-keyed values, minus the client-side validation bookkeeping. */
export interface LeadsBulkImportInput {
  leads: Omit<CsvLead, 'isValid' | 'errors' | 'rowIndex'>[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  errors: Array<{
    lead: any
    error: string
  }>
}
