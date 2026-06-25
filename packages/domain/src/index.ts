export const invoiceDomainFoundation = {
  name: 'Invoice Domain',
  status: 'foundation-ready',
} as const;

export type InvoiceDomainFoundation = typeof invoiceDomainFoundation;

export const financialCalculationPolicy =
  'Floating-point currency calculations are prohibited. Money and invoice calculation design is deferred.' as const;

export type { Brand } from './brand';
export {
  assertCurrencyCode,
  DEFAULT_CURRENCY_CODE,
  isCurrencyCode,
  parseCurrencyCode,
  type CurrencyCode,
} from './currency';
export {
  assertIsoDate,
  assertUtcTimestamp,
  isIsoDate,
  isUtcTimestamp,
  parseIsoDate,
  parseUtcTimestamp,
  type IsoDateString,
  type UtcTimestampString,
} from './dates';
export {
  assertBusinessId,
  assertCatalogItemId,
  assertCustomerId,
  assertDocumentId,
  assertInvoiceEventId,
  assertInvoiceId,
  assertInvoiceLineItemId,
  assertPaymentId,
  assertUserId,
  isBusinessId,
  isCatalogItemId,
  isCustomerId,
  isDocumentId,
  isInvoiceEventId,
  isInvoiceId,
  isInvoiceLineItemId,
  isPaymentId,
  isUserId,
  parseBusinessId,
  parseCatalogItemId,
  parseCustomerId,
  parseDocumentId,
  parseInvoiceEventId,
  parseInvoiceId,
  parseInvoiceLineItemId,
  parsePaymentId,
  parseUserId,
  type BusinessId,
  type CatalogItemId,
  type CustomerId,
  type DocumentId,
  type InvoiceEventId,
  type InvoiceId,
  type InvoiceLineItemId,
  type PaymentId,
  type UserId,
} from './identifiers';
export {
  assertInvoiceStatus,
  invoiceStatuses,
  isInvoiceStatus,
  parseInvoiceStatus,
  type InvoiceStatus,
} from './invoice-status';
export {
  DomainValidationError,
  err,
  makeDomainError,
  ok,
  type DomainError,
  type DomainErrorCode,
  type DomainResult,
} from './result';
