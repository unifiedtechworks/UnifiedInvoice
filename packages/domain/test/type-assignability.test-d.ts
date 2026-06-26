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
  type Money,
  type MonetaryInteger,
  type PaymentId,
  type Quantity,
  type QuantityInteger,
  type Rate,
  type RateUnits,
  type SerializedMoney,
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
declare const monetaryInteger: MonetaryInteger;
declare const quantityInteger: QuantityInteger;
declare const money: Money;
declare const quantity: Quantity;
declare const serializedMoney: SerializedMoney;
declare const rateUnits: RateUnits;
declare const rate: Rate;

const validCustomerId: CustomerId = secondCustomerId;
const validIdentifierString: string = customerId;
const validDateString: string = isoDate;
const validTimestampString: string = utcTimestamp;
const validCurrencyString: string = currencyCode;
const validInvoiceStatus: InvoiceStatus = 'draft';
const validMonetaryBigInt: bigint = monetaryInteger;
const validQuantityBigInt: bigint = quantityInteger;
const validRateBigInt: bigint = rateUnits;

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

// @ts-expect-error MonetaryInteger and QuantityInteger must not be interchangeable
const invalidMonetaryInteger: MonetaryInteger = quantityInteger;

// @ts-expect-error QuantityInteger and MonetaryInteger must not be interchangeable
const invalidQuantityInteger: QuantityInteger = monetaryInteger;

// @ts-expect-error Money cannot be assigned from a plain object
const invalidMoney: Money = { currency: currencyCode, minorUnits: monetaryInteger };

// @ts-expect-error Quantity cannot be assigned from a plain object
const invalidQuantity: Quantity = { units: quantityInteger, scale: 4 };

// @ts-expect-error SerializedMoney is not the same as Money
const invalidSerializedMoney: SerializedMoney = money;

// @ts-expect-error Money is not the same as SerializedMoney
const invalidMoneyFromSerialized: Money = serializedMoney;

// @ts-expect-error RateUnits and QuantityInteger must not be interchangeable
const invalidRateUnitsFromQuantity: RateUnits = quantityInteger;

// @ts-expect-error RateUnits and MonetaryInteger must not be interchangeable
const invalidRateUnitsFromMoney: RateUnits = monetaryInteger;

// @ts-expect-error Rate cannot be assigned from a plain object
const invalidRate: Rate = { units: rateUnits };

void validCustomerId;
void validIdentifierString;
void validDateString;
void validTimestampString;
void validCurrencyString;
void validInvoiceStatus;
void validMonetaryBigInt;
void validQuantityBigInt;
void validRateBigInt;
void businessId;
void paymentId;
void quantity;
void rate;
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
void invalidMonetaryInteger;
void invalidQuantityInteger;
void invalidMoney;
void invalidQuantity;
void invalidSerializedMoney;
void invalidMoneyFromSerialized;
void invalidRateUnitsFromQuantity;
void invalidRateUnitsFromMoney;
void invalidRate;
