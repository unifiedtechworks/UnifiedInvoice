import {
  type CurrencyDefinition,
  type InvoiceId,
  type InvoiceLineItemId,
  type InvoiceNumber,
  type IsoDateString,
  type Money,
  type Quantity,
  type RoundingMode,
  type UtcTimestampString,
} from '@invoice/domain';
import {
  type InvoiceCalculationMetadata,
  type InvoiceCalculationTotals,
  type InvoiceDiscount,
  type LineDiscount,
  type LineTax,
  type TaxRoundingStrategy,
} from '@invoice/invoice-engine';

import {
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

export type PostalAddressSnapshot = Readonly<{
  line1: AddressLineText;
  line2?: AddressLineText;
  city: AddressLocalityText;
  region?: AddressRegionText;
  postalCode?: PostalCodeText;
  countryCode: CountryCode;
}>;

export type PartySnapshot = Readonly<{
  displayName: PartyDisplayName;
  legalName?: PartyLegalName;
  email?: EmailSnapshotText;
  phone?: PhoneSnapshotText;
  billingAddress?: PostalAddressSnapshot;
  taxIdentifier?: TaxIdentifierText;
}>;

export type DraftInvoiceLine = Readonly<{
  id: InvoiceLineItemId;
  position: number;
  description: InvoiceLineDescription;
  quantity: Quantity;
  unitPrice: Money;
  discount?: LineDiscount;
  tax?: LineTax;
}>;

export type DraftInvoice = Readonly<{
  kind: 'draft';
  id: InvoiceId;
  business?: PartySnapshot;
  customer?: PartySnapshot;
  issueDate?: IsoDateString;
  dueDate?: IsoDateString;
  currency: CurrencyDefinition;
  lines: readonly DraftInvoiceLine[];
  invoiceDiscount?: InvoiceDiscount;
  roundingMode: RoundingMode;
  taxRoundingStrategy: TaxRoundingStrategy;
  notes?: InvoiceNotes;
  terms?: InvoiceTermsText;
  createdAt: UtcTimestampString;
  updatedAt: UtcTimestampString;
}>;

export type FinalizedInvoiceLine = Readonly<{
  id: InvoiceLineItemId;
  position: number;
  description: InvoiceLineDescription;
  quantity: Quantity;
  unitPrice: Money;
  discount?: LineDiscount;
  tax?: LineTax;
  grossAmount: Money;
  lineDiscountAmount: Money;
  netAmountBeforeInvoiceDiscount: Money;
  invoiceDiscountAllocation: Money;
  netAmountAfterInvoiceDiscount: Money;
  taxableBase: Money;
  taxAmount: Money;
  totalAmount: Money;
}>;

export type FinalizedInvoice = Readonly<{
  kind: 'finalized';
  id: InvoiceId;
  invoiceNumber: InvoiceNumber;
  business: PartySnapshot;
  customer: PartySnapshot;
  issueDate: IsoDateString;
  dueDate: IsoDateString;
  currency: CurrencyDefinition;
  lines: readonly FinalizedInvoiceLine[];
  invoiceDiscount?: InvoiceDiscount;
  totals: InvoiceCalculationTotals;
  calculationMetadata: InvoiceCalculationMetadata;
  notes?: InvoiceNotes;
  terms?: InvoiceTermsText;
  createdAt: UtcTimestampString;
  updatedAt: UtcTimestampString;
  finalizedAt: UtcTimestampString;
}>;

export type VoidedInvoice = Readonly<{
  kind: 'voided';
  finalized: FinalizedInvoice;
  voidedAt: UtcTimestampString;
  voidReason: VoidReason;
}>;

export type Invoice = DraftInvoice | FinalizedInvoice | VoidedInvoice;

export type CreateDraftInvoiceInput = Readonly<{
  id: InvoiceId;
  currency: CurrencyDefinition;
  createdAt: UtcTimestampString;
  updatedAt: UtcTimestampString;
  business?: PartySnapshot;
  customer?: PartySnapshot;
  issueDate?: IsoDateString;
  dueDate?: IsoDateString;
  invoiceDiscount?: InvoiceDiscount;
  roundingMode?: RoundingMode;
  taxRoundingStrategy?: TaxRoundingStrategy;
  notes?: InvoiceNotes;
  terms?: InvoiceTermsText;
}>;

export type DraftInvoiceLineInput = DraftInvoiceLine;

export type DraftInvoiceLinePatch = Partial<
  Pick<DraftInvoiceLine, 'position' | 'description' | 'quantity' | 'unitPrice' | 'discount' | 'tax'>
>;

export type FinalizeInvoiceCommand = Readonly<{
  invoiceNumber: InvoiceNumber;
  finalizedAt: UtcTimestampString;
}>;

export type VoidInvoiceCommand = Readonly<{
  voidedAt: UtcTimestampString;
  reason: VoidReason;
}>;
