import { brandString, type Brand } from './brand';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export type InvoiceNumber = Brand<string, 'InvoiceNumber'>;

const invoiceNumberPattern = /^[A-Za-z0-9][A-Za-z0-9_/-]{0,63}$/;
const invalidInvoiceNumberError = makeDomainError(
  'invalid_invoice_number',
  'Invoice number must be 1-64 characters, start with an ASCII letter or digit, and contain only ASCII letters, digits, underscores, slashes, or hyphens.',
);

export const isInvoiceNumber = (value: unknown): value is InvoiceNumber =>
  typeof value === 'string' && invoiceNumberPattern.test(value);

export const parseInvoiceNumber = (value: string): DomainResult<InvoiceNumber> => {
  if (!isInvoiceNumber(value)) {
    return err(invalidInvoiceNumberError);
  }

  return ok(brandString<'InvoiceNumber'>(value));
};

export const assertInvoiceNumber = (value: string): InvoiceNumber => {
  const result = parseInvoiceNumber(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};
