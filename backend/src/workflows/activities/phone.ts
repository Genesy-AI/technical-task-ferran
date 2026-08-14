/**
 * Phone-enrichment activities: every side effect of the enrich-phone workflow lives here, so the
 * workflow itself stays deterministic.
 *
 * One activity per provider rather than a single parameterised one — Temporal binds retry policy
 * and task queue to the activity call, and each provider needs its own of both.
 */

import { prisma } from '../../prisma'
import { callProvider } from '../phone/callProvider'
import {
  ASTRA_DIALER,
  deriveCompanyWebsite,
  NIMBUS_LOOKUP,
  ORION_CONNECT,
  PhoneLookupInput,
  PhoneStatus,
  ProviderId,
} from '../phone/providers'

export const lookupPhoneOrion = (input: PhoneLookupInput): Promise<string | null> =>
  callProvider(ORION_CONNECT, input)

export const lookupPhoneAstra = (input: PhoneLookupInput): Promise<string | null> =>
  callProvider(ASTRA_DIALER, input)

export const lookupPhoneNimbus = (input: PhoneLookupInput): Promise<string | null> =>
  callProvider(NIMBUS_LOOKUP, input)

/** Reads the lead once and normalises it into the shape every provider adapter reads from. */
export async function loadLeadForPhoneLookup(leadId: number): Promise<PhoneLookupInput | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return null

  return {
    leadId: lead.id,
    fullName: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
    email: lead.email,
    jobTitle: lead.jobTitle,
    companyWebsite: deriveCompanyWebsite(lead.email),
  }
}

/** Written before each provider call, so the table can show which one is being tried right now. */
export async function savePhoneProgress(leadId: number, provider: ProviderId): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { phoneStatus: 'running', phoneProvider: provider },
  })
}

export async function savePhoneResult(
  leadId: number,
  result: { status: PhoneStatus; phoneNumber: string | null; provider: ProviderId | null }
): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      phoneStatus: result.status,
      phoneProvider: result.provider,
      phoneCheckedAt: new Date(),
      // A miss leaves any existing number alone — an imported phone is better than nothing.
      ...(result.status === 'found' ? { phoneNumber: result.phoneNumber } : {}),
    },
  })
}
