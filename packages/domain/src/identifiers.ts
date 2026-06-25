import { brandString, type Brand } from './brand';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export type UserId = Brand<string, 'UserId'>;
export type BusinessId = Brand<string, 'BusinessId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
export type CatalogItemId = Brand<string, 'CatalogItemId'>;
export type InvoiceId = Brand<string, 'InvoiceId'>;
export type InvoiceLineItemId = Brand<string, 'InvoiceLineItemId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type InvoiceEventId = Brand<string, 'InvoiceEventId'>;
export type DocumentId = Brand<string, 'DocumentId'>;

type IdentifierName =
  | 'UserId'
  | 'BusinessId'
  | 'CustomerId'
  | 'CatalogItemId'
  | 'InvoiceId'
  | 'InvoiceLineItemId'
  | 'PaymentId'
  | 'InvoiceEventId'
  | 'DocumentId';

const invalidIdentifierError = (name: IdentifierName) =>
  makeDomainError(
    'invalid_identifier',
    `${name} must be 1-128 characters, start with an ASCII letter or digit, and contain only ASCII letters, digits, underscores, or hyphens.`,
  );

const isIdentifierValue = (value: string): boolean => identifierPattern.test(value);

const parseIdentifier = <TIdentifier extends Brand<string, IdentifierName>>(
  value: string,
  name: IdentifierName,
): DomainResult<TIdentifier> => {
  if (!isIdentifierValue(value)) {
    return err(invalidIdentifierError(name));
  }

  return ok(brandString<IdentifierName>(value) as TIdentifier);
};

const assertIdentifier = <TIdentifier extends Brand<string, IdentifierName>>(
  value: string,
  name: IdentifierName,
): TIdentifier => {
  const result = parseIdentifier<TIdentifier>(value, name);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

export const parseUserId = (value: string): DomainResult<UserId> =>
  parseIdentifier<UserId>(value, 'UserId');
export const isUserId = (value: string): value is UserId => isIdentifierValue(value);
export const assertUserId = (value: string): UserId => assertIdentifier<UserId>(value, 'UserId');

export const parseBusinessId = (value: string): DomainResult<BusinessId> =>
  parseIdentifier<BusinessId>(value, 'BusinessId');
export const isBusinessId = (value: string): value is BusinessId => isIdentifierValue(value);
export const assertBusinessId = (value: string): BusinessId =>
  assertIdentifier<BusinessId>(value, 'BusinessId');

export const parseCustomerId = (value: string): DomainResult<CustomerId> =>
  parseIdentifier<CustomerId>(value, 'CustomerId');
export const isCustomerId = (value: string): value is CustomerId => isIdentifierValue(value);
export const assertCustomerId = (value: string): CustomerId =>
  assertIdentifier<CustomerId>(value, 'CustomerId');

export const parseCatalogItemId = (value: string): DomainResult<CatalogItemId> =>
  parseIdentifier<CatalogItemId>(value, 'CatalogItemId');
export const isCatalogItemId = (value: string): value is CatalogItemId => isIdentifierValue(value);
export const assertCatalogItemId = (value: string): CatalogItemId =>
  assertIdentifier<CatalogItemId>(value, 'CatalogItemId');

export const parseInvoiceId = (value: string): DomainResult<InvoiceId> =>
  parseIdentifier<InvoiceId>(value, 'InvoiceId');
export const isInvoiceId = (value: string): value is InvoiceId => isIdentifierValue(value);
export const assertInvoiceId = (value: string): InvoiceId =>
  assertIdentifier<InvoiceId>(value, 'InvoiceId');

export const parseInvoiceLineItemId = (value: string): DomainResult<InvoiceLineItemId> =>
  parseIdentifier<InvoiceLineItemId>(value, 'InvoiceLineItemId');
export const isInvoiceLineItemId = (value: string): value is InvoiceLineItemId =>
  isIdentifierValue(value);
export const assertInvoiceLineItemId = (value: string): InvoiceLineItemId =>
  assertIdentifier<InvoiceLineItemId>(value, 'InvoiceLineItemId');

export const parsePaymentId = (value: string): DomainResult<PaymentId> =>
  parseIdentifier<PaymentId>(value, 'PaymentId');
export const isPaymentId = (value: string): value is PaymentId => isIdentifierValue(value);
export const assertPaymentId = (value: string): PaymentId =>
  assertIdentifier<PaymentId>(value, 'PaymentId');

export const parseInvoiceEventId = (value: string): DomainResult<InvoiceEventId> =>
  parseIdentifier<InvoiceEventId>(value, 'InvoiceEventId');
export const isInvoiceEventId = (value: string): value is InvoiceEventId =>
  isIdentifierValue(value);
export const assertInvoiceEventId = (value: string): InvoiceEventId =>
  assertIdentifier<InvoiceEventId>(value, 'InvoiceEventId');

export const parseDocumentId = (value: string): DomainResult<DocumentId> =>
  parseIdentifier<DocumentId>(value, 'DocumentId');
export const isDocumentId = (value: string): value is DocumentId => isIdentifierValue(value);
export const assertDocumentId = (value: string): DocumentId =>
  assertIdentifier<DocumentId>(value, 'DocumentId');
