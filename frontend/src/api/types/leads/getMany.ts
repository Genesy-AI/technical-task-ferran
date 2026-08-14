import type { FIELD_DEFINITIONS } from '../../../utils/leadFields'
import type { PhoneStatus } from '../../../utils/phoneProviders'

export type LeadsGetManyInput = undefined

type Definition = (typeof FIELD_DEFINITIONS)[number]

type ColumnValue<F extends Definition> = F['type'] extends 'int' ? number : string

/**
 * The registry's columns, typed from each field's declared `type`. Optional fields are nullable in
 * the DB, so adding a field to `leadFields.ts` widens this type without an edit here.
 */
type RegistryColumns = {
  [F in Definition as F['key']]: F extends { required: true } ? ColumnValue<F> : ColumnValue<F> | null
}

/** Columns that aren't user-settable fields, so they don't live in the registry. */
export type Lead = {
  id: number
  createdAt: string
  updatedAt: string
  message: string | null
  emailVerified: boolean | null
  /** Written by the enrich-phone workflow; the table polls these while a lookup is in flight. */
  phoneStatus: PhoneStatus | null
  phoneProvider: string | null
  phoneCheckedAt: string | null
} & RegistryColumns

export type LeadsGetManyOutput = Lead[]
