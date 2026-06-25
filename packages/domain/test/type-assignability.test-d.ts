import {
  type BusinessId,
  type CatalogItemId,
  type CurrencyCode,
  type CustomerId,
  type DocumentId,
  type InvoiceEventId,
  type InvoiceId,
  type InvoiceLineItemId,
  type InvoiceStatus,
  type IsoDateString,
  type PaymentId,
  type UserId,
  type UtcTimestampString,
} from '../src/index';

declare const userId: UserId;
declare const businessId: BusinessId;
declare const customerId: CustomerId;
declare const secondCustomerId: CustomerId;
declare const catalogItemId: CatalogItemId;
declare const invoiceId: InvoiceId;
declare const invoiceLineItemId: InvoiceLineItemId;
declare const paymentId: PaymentId;
declare const invoiceEventId: InvoiceEventId;
declare const documentId: DocumentId;
declare const isoDate: IsoDateString;
declare const utcTimestamp: UtcTimestampString;
declare const currencyCode: CurrencyCode;

const validCustomerId: CustomerId = secondCustomerId;
const validIdentifierString: string = customerId;
const validDateString: string = isoDate;
const validTimestampString: string = utcTimestamp;
const validCurrencyString: string = currencyCode;
const validInvoiceStatus: InvoiceStatus = 'draft';

// @ts-expect-error CustomerId must not be assignable to InvoiceId
const invalidInvoiceId: InvoiceId = customerId;

// @ts-expect-error InvoiceId must not be assignable to CustomerId
const invalidCustomerId: CustomerId = invoiceId;

// @ts-expect-error Distinct identifier brands must not be interchangeable
const invalidBusinessId: BusinessId = userId;

// @ts-expect-error Distinct identifier brands must not be interchangeable
const invalidCatalogItemId: CatalogItemId = invoiceLineItemId;

// @ts-expect-error Distinct identifier brands must not be interchangeable
const invalidPaymentId: PaymentId = invoiceEventId;

// @ts-expect-error Distinct identifier brands must not be interchangeable
const invalidDocumentId: DocumentId = catalogItemId;

// @ts-expect-error Plain strings must be parsed or asserted before use as branded identifiers
const invalidPlainCustomerId: CustomerId = 'customer-1';

// @ts-expect-error Date and timestamp brands must not be interchangeable
const invalidTimestamp: UtcTimestampString = isoDate;

// @ts-expect-error Timestamp and date brands must not be interchangeable
const invalidDate: IsoDateString = utcTimestamp;

// @ts-expect-error Currency codes require their own brand
const invalidCurrencyCode: CurrencyCode = customerId;

// @ts-expect-error InvoiceStatus is constrained to declared vocabulary
const invalidInvoiceStatus: InvoiceStatus = 'cancelled';

void validCustomerId;
void validIdentifierString;
void validDateString;
void validTimestampString;
void validCurrencyString;
void validInvoiceStatus;
void businessId;
void paymentId;
void documentId;
void invalidInvoiceId;
void invalidCustomerId;
void invalidBusinessId;
void invalidCatalogItemId;
void invalidPaymentId;
void invalidDocumentId;
void invalidPlainCustomerId;
void invalidTimestamp;
void invalidDate;
void invalidCurrencyCode;
void invalidInvoiceStatus;
