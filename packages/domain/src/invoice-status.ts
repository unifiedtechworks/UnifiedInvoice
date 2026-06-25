import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export const invoiceStatuses = [
  'draft',
  'finalized',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'voided',
  'uncollectible',
  'refunded',
] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];

const invoiceStatusSet = new Set<string>(invoiceStatuses);
const invalidInvoiceStatusError = makeDomainError(
  'invalid_invoice_status',
  'Invoice status must be one of the declared platform invoice status values.',
);

export const isInvoiceStatus = (value: string): value is InvoiceStatus =>
  invoiceStatusSet.has(value);

export const parseInvoiceStatus = (value: string): DomainResult<InvoiceStatus> => {
  if (!isInvoiceStatus(value)) {
    return err(invalidInvoiceStatusError);
  }

  return ok(value);
};

export const assertInvoiceStatus = (value: string): InvoiceStatus => {
  const result = parseInvoiceStatus(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};
