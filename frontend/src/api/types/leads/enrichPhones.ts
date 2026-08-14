export type LeadsEnrichPhonesInput = {
  leadIds: number[]
}

/**
 * The workflows are started, not awaited — the response says what was kicked off, and progress is
 * read from the lead rows themselves (`phoneStatus` / `phoneProvider`) as the table polls.
 */
export type LeadsEnrichPhonesOutput = {
  success: boolean
  started: number[]
  /** Already had a live workflow, so no second one was started. */
  alreadyRunning: number[]
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
