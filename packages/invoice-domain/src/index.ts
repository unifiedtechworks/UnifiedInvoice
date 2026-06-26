export const invoiceDomainModelFoundation = {
  name: 'Invoice Domain Model',
  status: 'foundation-ready',
} as const;

export type InvoiceDomainModelFoundation = typeof invoiceDomainModelFoundation;

export {
  addDraftInvoiceLine,
  createDraftInvoice,
  removeDraftInvoiceLine,
  reorderDraftInvoiceLines,
  setDraftCalculationSettings,
  setDraftInvoiceDates,
  setDraftInvoiceDiscount,
  setDraftInvoiceParties,
  setDraftInvoiceText,
  updateDraftInvoiceLine,
} from './draft';
export { calculateDraftInvoice, finalizeInvoice, toInvoiceCalculationInput } from './finalization';
export { voidInvoice } from './lifecycle';
export { createPartySnapshot, createPostalAddressSnapshot } from './party-snapshot';
export {
  parseAddressLineText,
  parseAddressLocalityText,
  parseAddressRegionText,
  parseCountryCode,
  parseEmailSnapshotText,
  parseInvoiceLineDescription,
  parseInvoiceNotes,
  parseInvoiceTermsText,
  parsePartyDisplayName,
  parsePartyLegalName,
  parsePhoneSnapshotText,
  parsePostalCodeText,
  parseTaxIdentifierText,
  parseVoidReason,
  type AddressLineText,
  type AddressLocalityText,
  type AddressRegionText,
  type CountryCode,
  type EmailSnapshotText,
  type InvoiceLineDescription,
  type InvoiceNotes,
  type InvoiceTermsText,
  type PartyDisplayName,
  type PartyLegalName,
  type PhoneSnapshotText,
  type PostalCodeText,
  type TaxIdentifierText,
  type VoidReason,
} from './text';
export {
  type CreateDraftInvoiceInput,
  type DraftInvoice,
  type DraftInvoiceLine,
  type DraftInvoiceLineInput,
  type DraftInvoiceLinePatch,
  type FinalizeInvoiceCommand,
  type FinalizedInvoice,
  type FinalizedInvoiceLine,
  type Invoice,
  type PartySnapshot,
  type PostalAddressSnapshot,
  type VoidInvoiceCommand,
  type VoidedInvoice,
} from './types';
