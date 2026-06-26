import {
  addMoney,
  assertMonetaryInteger,
  createMoney,
  equalMoney,
  err,
  makeDomainError,
  ok,
  parseCurrencyDefinition,
  parseInvoiceId,
  parseInvoiceLineItemId,
  parseInvoiceNumber,
  parseIsoDate,
  parseRoundingMode,
  parseSerializedMoney,
  parseSerializedQuantity,
  parseSerializedRate,
  parseUtcTimestamp,
  RATE_SCALE,
  serializeMoney,
  serializeQuantity,
  serializeRate,
  subtractMoney,
  type CurrencyCode,
  type CurrencyDefinition,
  type DomainError,
  type DomainResult,
  type InvoiceLineItemId,
  type Money,
  type Rate,
  type RoundingMode,
  type SerializedMoney,
  type SerializedQuantity,
  type SerializedRate,
} from '@invoice/domain';
import {
  INVOICE_CALCULATION_VERSION,
  type InvoiceCalculationMetadata,
  type InvoiceCalculationTotals,
  type InvoiceDiscount,
  type LineDiscount,
  type LineTax,
  type TaxRoundingStrategy,
} from '@invoice/invoice-engine';

import { createPartySnapshot, createPostalAddressSnapshot } from './party-snapshot';
import {
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
} from './text';
import type {
  DraftInvoice,
  DraftInvoiceLine,
  FinalizedInvoice,
  FinalizedInvoiceLine,
  Invoice,
  PartySnapshot,
  PostalAddressSnapshot,
  VoidedInvoice,
} from './types';

export const INVOICE_SCHEMA_VERSION = 1 as const;
export type SerializedInvoiceSchemaVersion = typeof INVOICE_SCHEMA_VERSION;

export type SerializedCurrencyDefinition = Readonly<{
  code: string;
  minorUnitDigits: 0 | 1 | 2 | 3 | 4;
}>;
export type SerializedFixedDiscount = Readonly<{ kind: 'fixed'; amount: SerializedMoney }>;
export type SerializedPercentageDiscount = Readonly<{ kind: 'percentage'; rate: SerializedRate }>;
export type SerializedLineDiscount = SerializedFixedDiscount | SerializedPercentageDiscount;
export type SerializedInvoiceDiscount = SerializedFixedDiscount | SerializedPercentageDiscount;
export type SerializedLineTax = Readonly<{ rate: SerializedRate }>;
export type SerializedPostalAddressSnapshot = Readonly<{
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
}>;
export type SerializedPartySnapshot = Readonly<{
  displayName: string;
  legalName?: string;
  email?: string;
  phone?: string;
  billingAddress?: SerializedPostalAddressSnapshot;
  taxIdentifier?: string;
}>;
export type SerializedDraftInvoiceLine = Readonly<{
  id: string;
  position: number;
  description: string;
  quantity: SerializedQuantity;
  unitPrice: SerializedMoney;
  discount?: SerializedLineDiscount;
  tax?: SerializedLineTax;
}>;
export type SerializedFinalizedInvoiceLine = SerializedDraftInvoiceLine &
  Readonly<{
    grossAmount: SerializedMoney;
    lineDiscountAmount: SerializedMoney;
    netAmountBeforeInvoiceDiscount: SerializedMoney;
    invoiceDiscountAllocation: SerializedMoney;
    netAmountAfterInvoiceDiscount: SerializedMoney;
    taxableBase: SerializedMoney;
    taxAmount: SerializedMoney;
    totalAmount: SerializedMoney;
  }>;
export type SerializedInvoiceCalculationTotals = Readonly<{
  grossLineTotal: SerializedMoney;
  lineDiscountTotal: SerializedMoney;
  netLineSubtotal: SerializedMoney;
  invoiceDiscountTotal: SerializedMoney;
  discountedSubtotal: SerializedMoney;
  taxableBaseTotal: SerializedMoney;
  taxTotal: SerializedMoney;
  grandTotal: SerializedMoney;
}>;
export type SerializedInvoiceCalculationMetadata = Readonly<{
  calculationVersion: string;
  roundingMode: RoundingMode;
  taxRoundingStrategy: TaxRoundingStrategy;
  currency: SerializedCurrencyDefinition;
}>;

type SerializedFinalizedInvoiceSnapshot = Readonly<{
  kind: 'finalized';
  id: string;
  invoiceNumber: string;
  business: SerializedPartySnapshot;
  customer: SerializedPartySnapshot;
  issueDate: string;
  dueDate: string;
  currency: SerializedCurrencyDefinition;
  lines: readonly SerializedFinalizedInvoiceLine[];
  invoiceDiscount?: SerializedInvoiceDiscount;
  totals: SerializedInvoiceCalculationTotals;
  calculationMetadata: SerializedInvoiceCalculationMetadata;
  notes?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string;
}>;
export type SerializedDraftInvoice = Readonly<{
  schemaVersion: 1;
  kind: 'draft';
  id: string;
  business?: SerializedPartySnapshot;
  customer?: SerializedPartySnapshot;
  issueDate?: string;
  dueDate?: string;
  currency: SerializedCurrencyDefinition;
  lines: readonly SerializedDraftInvoiceLine[];
  invoiceDiscount?: SerializedInvoiceDiscount;
  roundingMode: RoundingMode;
  taxRoundingStrategy: TaxRoundingStrategy;
  notes?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
}>;
export type SerializedFinalizedInvoice = SerializedFinalizedInvoiceSnapshot &
  Readonly<{ schemaVersion: 1 }>;
export type SerializedVoidedInvoice = Readonly<{
  schemaVersion: 1;
  kind: 'voided';
  finalized: SerializedFinalizedInvoiceSnapshot;
  voidedAt: string;
  voidReason: string;
}>;
export type SerializedInvoice =
  | SerializedDraftInvoice
  | SerializedFinalizedInvoice
  | SerializedVoidedInvoice;

const invalidInvoice = (message: string, path?: string): DomainError =>
  makeDomainError('invalid_invoice', message, path);
const invalidLine = (message: string, path?: string): DomainError =>
  makeDomainError('invalid_invoice_line', message, path);
const invalidCalculation = (message: string, path?: string): DomainError =>
  makeDomainError('invalid_invoice_calculation', message, path);
const invariant = (message: string, path?: string): DomainError =>
  makeDomainError('invariant_violation', message, path);
const currencyMismatch = (message: string, path?: string): DomainError =>
  makeDomainError('currency_mismatch', message, path);
const duplicateIdentifier = (message: string, path?: string): DomainError =>
  makeDomainError('duplicate_identifier', message, path);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const withPath = (error: DomainError, path: string): DomainError =>
  path === '' || error.path?.startsWith(path)
    ? error
    : { ...error, path: error.path === undefined ? path : `${path}.${error.path}` };
const failAt = <T>(result: DomainResult<T>, path: string): DomainResult<T> =>
  result.ok ? result : err(withPath(result.error, path));
const hasKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key));
};
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  hasKeys(value, keys) && Object.keys(value).length === keys.length;
const requireRecord = (value: unknown, path = ''): DomainResult<Record<string, unknown>> =>
  isRecord(value)
    ? ok(value)
    : err(invalidInvoice('Serialized invoice value must be an object.', path));
const stringProp = (
  record: Record<string, unknown>,
  key: string,
  path: string,
): DomainResult<string> =>
  typeof record[key] === 'string'
    ? ok(record[key])
    : err(invalidInvoice('Expected a string value.', path));
const parseString = <T>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  parser: (value: string) => DomainResult<T>,
): DomainResult<T> => {
  const text = stringProp(record, key, path);
  return text.ok ? failAt(parser(text.value), path) : err(text.error);
};
const parseOptionalString = <T>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  parser: (value: string) => DomainResult<T>,
): DomainResult<T | undefined> => {
  if (!Object.hasOwn(record, key)) return ok(undefined);
  return parseString(record, key, path, parser);
};
const schema = (record: Record<string, unknown>): DomainResult<void> =>
  record.schemaVersion === INVOICE_SCHEMA_VERSION
    ? ok(undefined)
    : err(invalidInvoice('Unsupported invoice schema version.', 'schemaVersion'));
const currency = (value: unknown, path: string): DomainResult<CurrencyDefinition> =>
  failAt(parseCurrencyDefinition(value), path);
const serializeCurrency = (value: CurrencyDefinition): SerializedCurrencyDefinition =>
  Object.freeze({ code: value.code, minorUnitDigits: value.minorUnitDigits });
const isTaxStrategy = (value: unknown): value is TaxRoundingStrategy =>
  value === 'per_line' || value === 'invoice_total';
const parseTaxStrategy = (value: unknown, path: string): DomainResult<TaxRoundingStrategy> =>
  isTaxStrategy(value)
    ? ok(value)
    : err(invalidCalculation('Invalid tax rounding strategy.', path));
const parseRounding = (value: unknown, path: string): DomainResult<RoundingMode> =>
  typeof value === 'string'
    ? failAt(parseRoundingMode(value), path)
    : err(makeDomainError('invalid_rounding_mode', 'Invalid rounding mode.', path));
const invoiceRate = (rate: Rate, path: string): DomainResult<Rate> =>
  rate.units >= 0n && rate.units <= RATE_SCALE
    ? ok(rate)
    : err(invalidCalculation('Invoice discount and tax rates must be between 0% and 100%.', path));
const parseInvoiceRate = (value: unknown, path: string): DomainResult<Rate> => {
  const parsed = failAt(parseSerializedRate(value), path);
  return parsed.ok ? invoiceRate(parsed.value, path) : parsed;
};
const nonNegInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const zeroMoney = (code: CurrencyCode): Money => {
  const result = createMoney(code, assertMonetaryInteger('0'));
  if (!result.ok) throw new Error('Expected zero money creation to succeed.');
  return result.value;
};
const money = (value: unknown, cur: CurrencyDefinition, path: string): DomainResult<Money> => {
  const parsed = failAt(parseSerializedMoney(value), path);
  if (!parsed.ok) return parsed;
  if (parsed.value.currency !== cur.code)
    return err(currencyMismatch('Money currency must match invoice currency.', path));
  return ok(parsed.value);
};
const nonNegativeMoney = (
  value: unknown,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<Money> => {
  const parsed = money(value, cur, path);
  if (!parsed.ok) return parsed;
  return parsed.value.minorUnits >= 0n
    ? parsed
    : err(invalidLine('Money amount must be non-negative.', path));
};
const add = (left: Money, right: Money, path: string): DomainResult<Money> =>
  failAt(addMoney(left, right), path);
const sub = (left: Money, right: Money, path: string): DomainResult<Money> =>
  failAt(subtractMoney(left, right), path);
const same = (actual: Money, expected: Money, message: string, path: string): DomainResult<void> =>
  equalMoney(actual, expected) ? ok(undefined) : err(invariant(message, path));

const serializeDiscount = (discount: LineDiscount | InvoiceDiscount): SerializedLineDiscount =>
  discount.kind === 'fixed'
    ? Object.freeze({ kind: 'fixed', amount: Object.freeze(serializeMoney(discount.amount)) })
    : Object.freeze({ kind: 'percentage', rate: Object.freeze(serializeRate(discount.rate)) });
const parseDiscount = (
  value: unknown,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<LineDiscount> => {
  if (!isRecord(value)) return err(invalidCalculation('Discount must be an object.', path));
  if (value.kind === 'fixed') {
    if (!exactKeys(value, ['kind', 'amount']))
      return err(invalidCalculation('Fixed discount must contain only kind and amount.', path));
    const amount = nonNegativeMoney(value.amount, cur, `${path}.amount`);
    return amount.ok
      ? ok(Object.freeze({ kind: 'fixed', amount: amount.value }))
      : err(amount.error);
  }
  if (value.kind === 'percentage') {
    if (!exactKeys(value, ['kind', 'rate']))
      return err(invalidCalculation('Percentage discount must contain only kind and rate.', path));
    const rate = parseInvoiceRate(value.rate, `${path}.rate`);
    return rate.ok ? ok(Object.freeze({ kind: 'percentage', rate: rate.value })) : err(rate.error);
  }
  return err(invalidCalculation('Discount kind must be fixed or percentage.', `${path}.kind`));
};
const optionalDiscount = (
  record: Record<string, unknown>,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<LineDiscount | undefined> =>
  Object.hasOwn(record, 'discount') ? parseDiscount(record.discount, cur, path) : ok(undefined);
const invoiceDiscount = (
  record: Record<string, unknown>,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<InvoiceDiscount | undefined> =>
  Object.hasOwn(record, 'invoiceDiscount')
    ? parseDiscount(record.invoiceDiscount, cur, path)
    : ok(undefined);
const serializeTax = (tax: LineTax): SerializedLineTax =>
  Object.freeze({ rate: Object.freeze(serializeRate(tax.rate)) });
const parseTax = (value: unknown, path: string): DomainResult<LineTax> => {
  if (!isRecord(value) || !exactKeys(value, ['rate']))
    return err(invalidCalculation('Line tax must contain only rate.', path));
  const rate = parseInvoiceRate(value.rate, `${path}.rate`);
  return rate.ok ? ok(Object.freeze({ rate: rate.value })) : err(rate.error);
};
const optionalTax = (
  record: Record<string, unknown>,
  path: string,
): DomainResult<LineTax | undefined> =>
  Object.hasOwn(record, 'tax') ? parseTax(record.tax, path) : ok(undefined);

const serializeAddress = (address: PostalAddressSnapshot): SerializedPostalAddressSnapshot =>
  Object.freeze({
    line1: address.line1,
    ...(address.line2 === undefined ? {} : { line2: address.line2 }),
    city: address.city,
    ...(address.region === undefined ? {} : { region: address.region }),
    ...(address.postalCode === undefined ? {} : { postalCode: address.postalCode }),
    countryCode: address.countryCode,
  });
const parseAddress = (value: unknown, path: string): DomainResult<PostalAddressSnapshot> => {
  if (
    !isRecord(value) ||
    !hasKeys(value, ['line1', 'city', 'countryCode'], ['line2', 'region', 'postalCode'])
  )
    return err(makeDomainError('invalid_address', 'Postal address shape is invalid.', path));
  const line1 = parseString(value, 'line1', `${path}.line1`, parseAddressLineText);
  if (!line1.ok) return err(line1.error);
  const city = parseString(value, 'city', `${path}.city`, parseAddressLocalityText);
  if (!city.ok) return err(city.error);
  const countryCode = parseString(value, 'countryCode', `${path}.countryCode`, parseCountryCode);
  if (!countryCode.ok) return err(countryCode.error);
  const line2 = parseOptionalString(value, 'line2', `${path}.line2`, parseAddressLineText);
  if (!line2.ok) return err(line2.error);
  const region = parseOptionalString(value, 'region', `${path}.region`, parseAddressRegionText);
  if (!region.ok) return err(region.error);
  const postalCode = parseOptionalString(
    value,
    'postalCode',
    `${path}.postalCode`,
    parsePostalCodeText,
  );
  if (!postalCode.ok) return err(postalCode.error);
  return failAt(
    createPostalAddressSnapshot({
      line1: line1.value,
      ...(line2.value === undefined ? {} : { line2: line2.value }),
      city: city.value,
      ...(region.value === undefined ? {} : { region: region.value }),
      ...(postalCode.value === undefined ? {} : { postalCode: postalCode.value }),
      countryCode: countryCode.value,
    }),
    path,
  );
};
const serializeParty = (party: PartySnapshot): SerializedPartySnapshot =>
  Object.freeze({
    displayName: party.displayName,
    ...(party.legalName === undefined ? {} : { legalName: party.legalName }),
    ...(party.email === undefined ? {} : { email: party.email }),
    ...(party.phone === undefined ? {} : { phone: party.phone }),
    ...(party.billingAddress === undefined
      ? {}
      : { billingAddress: serializeAddress(party.billingAddress) }),
    ...(party.taxIdentifier === undefined ? {} : { taxIdentifier: party.taxIdentifier }),
  });
const parseParty = (value: unknown, path: string): DomainResult<PartySnapshot> => {
  if (
    !isRecord(value) ||
    !hasKeys(
      value,
      ['displayName'],
      ['legalName', 'email', 'phone', 'billingAddress', 'taxIdentifier'],
    )
  )
    return err(makeDomainError('invalid_party_snapshot', 'Party snapshot shape is invalid.', path));
  const displayName = parseString(
    value,
    'displayName',
    `${path}.displayName`,
    parsePartyDisplayName,
  );
  if (!displayName.ok) return err(displayName.error);
  const legalName = parseOptionalString(
    value,
    'legalName',
    `${path}.legalName`,
    parsePartyLegalName,
  );
  if (!legalName.ok) return err(legalName.error);
  const email = parseOptionalString(value, 'email', `${path}.email`, parseEmailSnapshotText);
  if (!email.ok) return err(email.error);
  const phone = parseOptionalString(value, 'phone', `${path}.phone`, parsePhoneSnapshotText);
  if (!phone.ok) return err(phone.error);
  const billingAddress = Object.hasOwn(value, 'billingAddress')
    ? parseAddress(value.billingAddress, `${path}.billingAddress`)
    : ok(undefined);
  if (!billingAddress.ok) return err(billingAddress.error);
  const taxIdentifier = parseOptionalString(
    value,
    'taxIdentifier',
    `${path}.taxIdentifier`,
    parseTaxIdentifierText,
  );
  if (!taxIdentifier.ok) return err(taxIdentifier.error);
  return failAt(
    createPartySnapshot({
      displayName: displayName.value,
      ...(legalName.value === undefined ? {} : { legalName: legalName.value }),
      ...(email.value === undefined ? {} : { email: email.value }),
      ...(phone.value === undefined ? {} : { phone: phone.value }),
      ...(billingAddress.value === undefined ? {} : { billingAddress: billingAddress.value }),
      ...(taxIdentifier.value === undefined ? {} : { taxIdentifier: taxIdentifier.value }),
    }),
    path,
  );
};

const serializeDraftLine = (line: DraftInvoiceLine): SerializedDraftInvoiceLine =>
  Object.freeze({
    id: line.id,
    position: line.position,
    description: line.description,
    quantity: Object.freeze(serializeQuantity(line.quantity)),
    unitPrice: Object.freeze(serializeMoney(line.unitPrice)),
    ...(line.discount === undefined ? {} : { discount: serializeDiscount(line.discount) }),
    ...(line.tax === undefined ? {} : { tax: serializeTax(line.tax) }),
  });
const parseDraftLine = (
  value: unknown,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<DraftInvoiceLine> => {
  if (
    !isRecord(value) ||
    !hasKeys(value, ['id', 'position', 'description', 'quantity', 'unitPrice'], ['discount', 'tax'])
  )
    return err(invalidLine('Invoice line shape is invalid.', path));
  const id = parseString(value, 'id', `${path}.id`, parseInvoiceLineItemId);
  if (!id.ok) return err(id.error);
  if (!nonNegInt(value.position))
    return err(
      invalidLine('Line position must be a non-negative safe integer.', `${path}.position`),
    );
  const description = parseString(
    value,
    'description',
    `${path}.description`,
    parseInvoiceLineDescription,
  );
  if (!description.ok) return err(description.error);
  const quantity = failAt(parseSerializedQuantity(value.quantity), `${path}.quantity`);
  if (!quantity.ok) return err(quantity.error);
  if (quantity.value.units <= 0n)
    return err(invalidLine('Line quantity must be positive.', `${path}.quantity`));
  const unitPrice = nonNegativeMoney(value.unitPrice, cur, `${path}.unitPrice`);
  if (!unitPrice.ok) return err(unitPrice.error);
  const discount = optionalDiscount(value, cur, `${path}.discount`);
  if (!discount.ok) return err(discount.error);
  const tax = optionalTax(value, `${path}.tax`);
  if (!tax.ok) return err(tax.error);
  return ok(
    Object.freeze({
      id: id.value,
      position: value.position,
      description: description.value,
      quantity: quantity.value,
      unitPrice: unitPrice.value,
      ...(discount.value === undefined ? {} : { discount: discount.value }),
      ...(tax.value === undefined ? {} : { tax: tax.value }),
    }),
  );
};

const serializeFinalizedLine = (line: FinalizedInvoiceLine): SerializedFinalizedInvoiceLine =>
  Object.freeze({
    ...serializeDraftLine(line),
    grossAmount: Object.freeze(serializeMoney(line.grossAmount)),
    lineDiscountAmount: Object.freeze(serializeMoney(line.lineDiscountAmount)),
    netAmountBeforeInvoiceDiscount: Object.freeze(
      serializeMoney(line.netAmountBeforeInvoiceDiscount),
    ),
    invoiceDiscountAllocation: Object.freeze(serializeMoney(line.invoiceDiscountAllocation)),
    netAmountAfterInvoiceDiscount: Object.freeze(
      serializeMoney(line.netAmountAfterInvoiceDiscount),
    ),
    taxableBase: Object.freeze(serializeMoney(line.taxableBase)),
    taxAmount: Object.freeze(serializeMoney(line.taxAmount)),
    totalAmount: Object.freeze(serializeMoney(line.totalAmount)),
  });
const parseFinalizedLine = (
  value: unknown,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<FinalizedInvoiceLine> => {
  if (
    !isRecord(value) ||
    !hasKeys(
      value,
      [
        'id',
        'position',
        'description',
        'quantity',
        'unitPrice',
        'grossAmount',
        'lineDiscountAmount',
        'netAmountBeforeInvoiceDiscount',
        'invoiceDiscountAllocation',
        'netAmountAfterInvoiceDiscount',
        'taxableBase',
        'taxAmount',
        'totalAmount',
      ],
      ['discount', 'tax'],
    )
  )
    return err(invalidLine('Finalized invoice line shape is invalid.', path));
  const draftLineValue = {
    id: value.id,
    position: value.position,
    description: value.description,
    quantity: value.quantity,
    unitPrice: value.unitPrice,
    ...(Object.hasOwn(value, 'discount') ? { discount: value.discount } : {}),
    ...(Object.hasOwn(value, 'tax') ? { tax: value.tax } : {}),
  };
  const base = parseDraftLine(draftLineValue, cur, path);
  if (!base.ok) return err(base.error);
  const grossAmount = nonNegativeMoney(value.grossAmount, cur, `${path}.grossAmount`);
  if (!grossAmount.ok) return err(grossAmount.error);
  const lineDiscountAmount = nonNegativeMoney(
    value.lineDiscountAmount,
    cur,
    `${path}.lineDiscountAmount`,
  );
  if (!lineDiscountAmount.ok) return err(lineDiscountAmount.error);
  const netBefore = nonNegativeMoney(
    value.netAmountBeforeInvoiceDiscount,
    cur,
    `${path}.netAmountBeforeInvoiceDiscount`,
  );
  if (!netBefore.ok) return err(netBefore.error);
  const allocation = nonNegativeMoney(
    value.invoiceDiscountAllocation,
    cur,
    `${path}.invoiceDiscountAllocation`,
  );
  if (!allocation.ok) return err(allocation.error);
  const netAfter = nonNegativeMoney(
    value.netAmountAfterInvoiceDiscount,
    cur,
    `${path}.netAmountAfterInvoiceDiscount`,
  );
  if (!netAfter.ok) return err(netAfter.error);
  const taxableBase = nonNegativeMoney(value.taxableBase, cur, `${path}.taxableBase`);
  if (!taxableBase.ok) return err(taxableBase.error);
  const taxAmount = nonNegativeMoney(value.taxAmount, cur, `${path}.taxAmount`);
  if (!taxAmount.ok) return err(taxAmount.error);
  const totalAmount = nonNegativeMoney(value.totalAmount, cur, `${path}.totalAmount`);
  if (!totalAmount.ok) return err(totalAmount.error);
  const expectedBefore = sub(
    grossAmount.value,
    lineDiscountAmount.value,
    `${path}.netAmountBeforeInvoiceDiscount`,
  );
  if (!expectedBefore.ok) return err(expectedBefore.error);
  const beforeOk = same(
    netBefore.value,
    expectedBefore.value,
    'Line net amount before invoice discount is inconsistent.',
    `${path}.netAmountBeforeInvoiceDiscount`,
  );
  if (!beforeOk.ok) return err(beforeOk.error);
  const expectedAfter = sub(
    netBefore.value,
    allocation.value,
    `${path}.netAmountAfterInvoiceDiscount`,
  );
  if (!expectedAfter.ok) return err(expectedAfter.error);
  const afterOk = same(
    netAfter.value,
    expectedAfter.value,
    'Line net amount after invoice discount is inconsistent.',
    `${path}.netAmountAfterInvoiceDiscount`,
  );
  if (!afterOk.ok) return err(afterOk.error);
  const expectedTotal = add(netAfter.value, taxAmount.value, `${path}.totalAmount`);
  if (!expectedTotal.ok) return err(expectedTotal.error);
  const totalOk = same(
    totalAmount.value,
    expectedTotal.value,
    'Line total amount is inconsistent.',
    `${path}.totalAmount`,
  );
  if (!totalOk.ok) return err(totalOk.error);
  if (base.value.tax === undefined) {
    if (taxableBase.value.minorUnits !== 0n)
      return err(invariant('Untaxed lines must have zero taxable base.', `${path}.taxableBase`));
    if (taxAmount.value.minorUnits !== 0n)
      return err(invariant('Untaxed lines must have zero tax amount.', `${path}.taxAmount`));
  } else {
    const taxableOk = same(
      taxableBase.value,
      netAfter.value,
      'Taxable base must equal net amount after invoice discount for taxed lines.',
      `${path}.taxableBase`,
    );
    if (!taxableOk.ok) return err(taxableOk.error);
  }
  if (base.value.discount?.kind === 'fixed') {
    const fixedOk = same(
      lineDiscountAmount.value,
      base.value.discount.amount,
      'Fixed line discount amount must equal stored line discount amount.',
      `${path}.lineDiscountAmount`,
    );
    if (!fixedOk.ok) return err(fixedOk.error);
  }
  return ok(
    Object.freeze({
      ...base.value,
      grossAmount: grossAmount.value,
      lineDiscountAmount: lineDiscountAmount.value,
      netAmountBeforeInvoiceDiscount: netBefore.value,
      invoiceDiscountAllocation: allocation.value,
      netAmountAfterInvoiceDiscount: netAfter.value,
      taxableBase: taxableBase.value,
      taxAmount: taxAmount.value,
      totalAmount: totalAmount.value,
    }),
  );
};

const parseLines = <T>(
  value: unknown,
  path: string,
  parse: (line: unknown, path: string) => DomainResult<T>,
): DomainResult<readonly T[]> => {
  if (!Array.isArray(value)) return err(invalidInvoice('Invoice lines must be an array.', path));
  const lines: T[] = [];
  for (const [index, line] of value.entries()) {
    const parsed = parse(line, `${path}.${index}`);
    if (!parsed.ok) return err(parsed.error);
    lines.push(parsed.value);
  }
  return ok(Object.freeze(lines));
};
const uniqueIds = (
  lines: readonly { id: InvoiceLineItemId }[],
  path: string,
): DomainResult<void> => {
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (seen.has(line.id))
      return err(duplicateIdentifier('Invoice line IDs must be unique.', `${path}.${index}.id`));
    seen.add(line.id);
  }
  return ok(undefined);
};
const notesTerms = (
  record: Record<string, unknown>,
  prefix = '',
): DomainResult<Readonly<{ notes?: DraftInvoice['notes']; terms?: DraftInvoice['terms'] }>> => {
  const p = (key: string) => (prefix === '' ? key : `${prefix}.${key}`);
  const notes = parseOptionalString(record, 'notes', p('notes'), parseInvoiceNotes);
  if (!notes.ok) return err(notes.error);
  const terms = parseOptionalString(record, 'terms', p('terms'), parseInvoiceTermsText);
  if (!terms.ok) return err(terms.error);
  return ok({
    ...(notes.value === undefined ? {} : { notes: notes.value }),
    ...(terms.value === undefined ? {} : { terms: terms.value }),
  });
};

const serializeTotals = (totals: InvoiceCalculationTotals): SerializedInvoiceCalculationTotals =>
  Object.freeze({
    grossLineTotal: Object.freeze(serializeMoney(totals.grossLineTotal)),
    lineDiscountTotal: Object.freeze(serializeMoney(totals.lineDiscountTotal)),
    netLineSubtotal: Object.freeze(serializeMoney(totals.netLineSubtotal)),
    invoiceDiscountTotal: Object.freeze(serializeMoney(totals.invoiceDiscountTotal)),
    discountedSubtotal: Object.freeze(serializeMoney(totals.discountedSubtotal)),
    taxableBaseTotal: Object.freeze(serializeMoney(totals.taxableBaseTotal)),
    taxTotal: Object.freeze(serializeMoney(totals.taxTotal)),
    grandTotal: Object.freeze(serializeMoney(totals.grandTotal)),
  });
const parseTotals = (
  value: unknown,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<InvoiceCalculationTotals> => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'grossLineTotal',
      'lineDiscountTotal',
      'netLineSubtotal',
      'invoiceDiscountTotal',
      'discountedSubtotal',
      'taxableBaseTotal',
      'taxTotal',
      'grandTotal',
    ])
  )
    return err(invalidCalculation('Invoice calculation totals shape is invalid.', path));
  const totals = {
    grossLineTotal: nonNegativeMoney(value.grossLineTotal, cur, `${path}.grossLineTotal`),
    lineDiscountTotal: nonNegativeMoney(value.lineDiscountTotal, cur, `${path}.lineDiscountTotal`),
    netLineSubtotal: nonNegativeMoney(value.netLineSubtotal, cur, `${path}.netLineSubtotal`),
    invoiceDiscountTotal: nonNegativeMoney(
      value.invoiceDiscountTotal,
      cur,
      `${path}.invoiceDiscountTotal`,
    ),
    discountedSubtotal: nonNegativeMoney(
      value.discountedSubtotal,
      cur,
      `${path}.discountedSubtotal`,
    ),
    taxableBaseTotal: nonNegativeMoney(value.taxableBaseTotal, cur, `${path}.taxableBaseTotal`),
    taxTotal: nonNegativeMoney(value.taxTotal, cur, `${path}.taxTotal`),
    grandTotal: nonNegativeMoney(value.grandTotal, cur, `${path}.grandTotal`),
  };
  if (!totals.grossLineTotal.ok) return err(totals.grossLineTotal.error);
  if (!totals.lineDiscountTotal.ok) return err(totals.lineDiscountTotal.error);
  if (!totals.netLineSubtotal.ok) return err(totals.netLineSubtotal.error);
  if (!totals.invoiceDiscountTotal.ok) return err(totals.invoiceDiscountTotal.error);
  if (!totals.discountedSubtotal.ok) return err(totals.discountedSubtotal.error);
  if (!totals.taxableBaseTotal.ok) return err(totals.taxableBaseTotal.error);
  if (!totals.taxTotal.ok) return err(totals.taxTotal.error);
  if (!totals.grandTotal.ok) return err(totals.grandTotal.error);
  const parsed: InvoiceCalculationTotals = {
    grossLineTotal: totals.grossLineTotal.value,
    lineDiscountTotal: totals.lineDiscountTotal.value,
    netLineSubtotal: totals.netLineSubtotal.value,
    invoiceDiscountTotal: totals.invoiceDiscountTotal.value,
    discountedSubtotal: totals.discountedSubtotal.value,
    taxableBaseTotal: totals.taxableBaseTotal.value,
    taxTotal: totals.taxTotal.value,
    grandTotal: totals.grandTotal.value,
  };
  const net = sub(parsed.grossLineTotal, parsed.lineDiscountTotal, `${path}.netLineSubtotal`);
  if (!net.ok) return err(net.error);
  const netOk = same(
    parsed.netLineSubtotal,
    net.value,
    'Net line subtotal is inconsistent.',
    `${path}.netLineSubtotal`,
  );
  if (!netOk.ok) return err(netOk.error);
  const discounted = sub(
    parsed.netLineSubtotal,
    parsed.invoiceDiscountTotal,
    `${path}.discountedSubtotal`,
  );
  if (!discounted.ok) return err(discounted.error);
  const discountedOk = same(
    parsed.discountedSubtotal,
    discounted.value,
    'Discounted subtotal is inconsistent.',
    `${path}.discountedSubtotal`,
  );
  if (!discountedOk.ok) return err(discountedOk.error);
  const grand = add(parsed.discountedSubtotal, parsed.taxTotal, `${path}.grandTotal`);
  if (!grand.ok) return err(grand.error);
  const grandOk = same(
    parsed.grandTotal,
    grand.value,
    'Grand total is inconsistent.',
    `${path}.grandTotal`,
  );
  if (!grandOk.ok) return err(grandOk.error);
  return ok(Object.freeze(parsed));
};
const serializeMetadata = (
  metadata: InvoiceCalculationMetadata,
): SerializedInvoiceCalculationMetadata =>
  Object.freeze({
    calculationVersion: metadata.calculationVersion,
    roundingMode: metadata.roundingMode,
    taxRoundingStrategy: metadata.taxRoundingStrategy,
    currency: serializeCurrency(metadata.currency),
  });
const parseMetadata = (
  value: unknown,
  cur: CurrencyDefinition,
  path: string,
): DomainResult<InvoiceCalculationMetadata> => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['calculationVersion', 'roundingMode', 'taxRoundingStrategy', 'currency'])
  )
    return err(invalidCalculation('Invoice calculation metadata shape is invalid.', path));
  if (value.calculationVersion !== INVOICE_CALCULATION_VERSION)
    return err(
      invalidCalculation('Unsupported invoice calculation version.', `${path}.calculationVersion`),
    );
  const roundingMode = parseRounding(value.roundingMode, `${path}.roundingMode`);
  if (!roundingMode.ok) return err(roundingMode.error);
  const taxRoundingStrategy = parseTaxStrategy(
    value.taxRoundingStrategy,
    `${path}.taxRoundingStrategy`,
  );
  if (!taxRoundingStrategy.ok) return err(taxRoundingStrategy.error);
  const metadataCurrency = currency(value.currency, `${path}.currency`);
  if (!metadataCurrency.ok) return err(metadataCurrency.error);
  if (
    metadataCurrency.value.code !== cur.code ||
    metadataCurrency.value.minorUnitDigits !== cur.minorUnitDigits
  )
    return err(
      currencyMismatch(
        'Calculation metadata currency must match invoice currency.',
        `${path}.currency`,
      ),
    );
  return ok(
    Object.freeze({
      calculationVersion: INVOICE_CALCULATION_VERSION,
      roundingMode: roundingMode.value,
      taxRoundingStrategy: taxRoundingStrategy.value,
      currency: metadataCurrency.value,
    }),
  );
};
const sum = (
  lines: readonly FinalizedInvoiceLine[],
  code: CurrencyCode,
  selector: (line: FinalizedInvoiceLine) => Money,
  path: string,
): DomainResult<Money> => {
  let total = zeroMoney(code);
  for (const line of lines) {
    const next = add(total, selector(line), path);
    if (!next.ok) return next;
    total = next.value;
  }
  return ok(total);
};
const totalsMatchLines = (
  lines: readonly FinalizedInvoiceLine[],
  totals: InvoiceCalculationTotals,
): DomainResult<void> => {
  const checks: readonly [keyof InvoiceCalculationTotals, (line: FinalizedInvoiceLine) => Money][] =
    [
      ['grossLineTotal', (line) => line.grossAmount],
      ['lineDiscountTotal', (line) => line.lineDiscountAmount],
      ['netLineSubtotal', (line) => line.netAmountBeforeInvoiceDiscount],
      ['invoiceDiscountTotal', (line) => line.invoiceDiscountAllocation],
      ['discountedSubtotal', (line) => line.netAmountAfterInvoiceDiscount],
      ['taxableBaseTotal', (line) => line.taxableBase],
      ['taxTotal', (line) => line.taxAmount],
      ['grandTotal', (line) => line.totalAmount],
    ];
  for (const [key, selector] of checks) {
    const actual = sum(lines, totals[key].currency, selector, `totals.${key}`);
    if (!actual.ok) return err(actual.error);
    if (!equalMoney(totals[key], actual.value))
      return err(invariant('Invoice total does not match finalized line sums.', `totals.${key}`));
  }
  return ok(undefined);
};

export const serializeDraftInvoice = (invoice: DraftInvoice): SerializedDraftInvoice =>
  Object.freeze({
    schemaVersion: INVOICE_SCHEMA_VERSION,
    kind: 'draft',
    id: invoice.id,
    ...(invoice.business === undefined ? {} : { business: serializeParty(invoice.business) }),
    ...(invoice.customer === undefined ? {} : { customer: serializeParty(invoice.customer) }),
    ...(invoice.issueDate === undefined ? {} : { issueDate: invoice.issueDate }),
    ...(invoice.dueDate === undefined ? {} : { dueDate: invoice.dueDate }),
    currency: serializeCurrency(invoice.currency),
    lines: Object.freeze(invoice.lines.map(serializeDraftLine)),
    ...(invoice.invoiceDiscount === undefined
      ? {}
      : { invoiceDiscount: serializeDiscount(invoice.invoiceDiscount) }),
    roundingMode: invoice.roundingMode,
    taxRoundingStrategy: invoice.taxRoundingStrategy,
    ...(invoice.notes === undefined ? {} : { notes: invoice.notes }),
    ...(invoice.terms === undefined ? {} : { terms: invoice.terms }),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  });
export const parseSerializedDraftInvoice = (value: unknown): DomainResult<DraftInvoice> => {
  const record = requireRecord(value);
  if (!record.ok) return err(record.error);
  if (
    !hasKeys(
      record.value,
      [
        'schemaVersion',
        'kind',
        'id',
        'currency',
        'lines',
        'roundingMode',
        'taxRoundingStrategy',
        'createdAt',
        'updatedAt',
      ],
      ['business', 'customer', 'issueDate', 'dueDate', 'invoiceDiscount', 'notes', 'terms'],
    )
  )
    return err(invalidInvoice('Serialized draft invoice shape is invalid.'));
  const ver = schema(record.value);
  if (!ver.ok) return err(ver.error);
  if (record.value.kind !== 'draft')
    return err(invalidInvoice('Serialized invoice kind must be draft.', 'kind'));
  const id = parseString(record.value, 'id', 'id', parseInvoiceId);
  if (!id.ok) return err(id.error);
  const cur = currency(record.value.currency, 'currency');
  if (!cur.ok) return err(cur.error);
  const lines = parseLines(record.value.lines, 'lines', (line, path) =>
    parseDraftLine(line, cur.value, path),
  );
  if (!lines.ok) return err(lines.error);
  const ids = uniqueIds(lines.value, 'lines');
  if (!ids.ok) return err(ids.error);
  const business = Object.hasOwn(record.value, 'business')
    ? parseParty(record.value.business, 'business')
    : ok(undefined);
  if (!business.ok) return err(business.error);
  const customer = Object.hasOwn(record.value, 'customer')
    ? parseParty(record.value.customer, 'customer')
    : ok(undefined);
  if (!customer.ok) return err(customer.error);
  const issueDate = parseOptionalString(record.value, 'issueDate', 'issueDate', parseIsoDate);
  if (!issueDate.ok) return err(issueDate.error);
  const dueDate = parseOptionalString(record.value, 'dueDate', 'dueDate', parseIsoDate);
  if (!dueDate.ok) return err(dueDate.error);
  if (
    issueDate.value !== undefined &&
    dueDate.value !== undefined &&
    dueDate.value < issueDate.value
  )
    return err(invalidInvoice('Due date must not precede issue date.', 'dueDate'));
  const discount = invoiceDiscount(record.value, cur.value, 'invoiceDiscount');
  if (!discount.ok) return err(discount.error);
  const roundingMode = parseRounding(record.value.roundingMode, 'roundingMode');
  if (!roundingMode.ok) return err(roundingMode.error);
  const taxRoundingStrategy = parseTaxStrategy(
    record.value.taxRoundingStrategy,
    'taxRoundingStrategy',
  );
  if (!taxRoundingStrategy.ok) return err(taxRoundingStrategy.error);
  const text = notesTerms(record.value);
  if (!text.ok) return err(text.error);
  const createdAt = parseString(record.value, 'createdAt', 'createdAt', parseUtcTimestamp);
  if (!createdAt.ok) return err(createdAt.error);
  const updatedAt = parseString(record.value, 'updatedAt', 'updatedAt', parseUtcTimestamp);
  if (!updatedAt.ok) return err(updatedAt.error);
  if (updatedAt.value < createdAt.value)
    return err(
      invalidInvoice('Updated timestamp must not precede created timestamp.', 'updatedAt'),
    );
  const draft = Object.freeze({
    kind: 'draft',
    id: id.value,
    ...(business.value === undefined ? {} : { business: business.value }),
    ...(customer.value === undefined ? {} : { customer: customer.value }),
    ...(issueDate.value === undefined ? {} : { issueDate: issueDate.value }),
    ...(dueDate.value === undefined ? {} : { dueDate: dueDate.value }),
    currency: cur.value,
    lines: lines.value,
    ...(discount.value === undefined ? {} : { invoiceDiscount: discount.value }),
    roundingMode: roundingMode.value,
    taxRoundingStrategy: taxRoundingStrategy.value,
    ...text.value,
    createdAt: createdAt.value,
    updatedAt: updatedAt.value,
  }) as DraftInvoice;
  return ok(draft);
};

const serializeFinalizedSnapshot = (
  invoice: FinalizedInvoice,
): SerializedFinalizedInvoiceSnapshot =>
  Object.freeze({
    kind: 'finalized',
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    business: serializeParty(invoice.business),
    customer: serializeParty(invoice.customer),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: serializeCurrency(invoice.currency),
    lines: Object.freeze(invoice.lines.map(serializeFinalizedLine)),
    ...(invoice.invoiceDiscount === undefined
      ? {}
      : { invoiceDiscount: serializeDiscount(invoice.invoiceDiscount) }),
    totals: serializeTotals(invoice.totals),
    calculationMetadata: serializeMetadata(invoice.calculationMetadata),
    ...(invoice.notes === undefined ? {} : { notes: invoice.notes }),
    ...(invoice.terms === undefined ? {} : { terms: invoice.terms }),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    finalizedAt: invoice.finalizedAt,
  });
export const serializeFinalizedInvoice = (invoice: FinalizedInvoice): SerializedFinalizedInvoice =>
  Object.freeze({ schemaVersion: INVOICE_SCHEMA_VERSION, ...serializeFinalizedSnapshot(invoice) });
const parseFinalizedSnapshot = (value: unknown, prefix = ''): DomainResult<FinalizedInvoice> => {
  const p = (path: string) => (prefix === '' ? path : `${prefix}.${path}`);
  if (
    !isRecord(value) ||
    !hasKeys(
      value,
      [
        'kind',
        'id',
        'invoiceNumber',
        'business',
        'customer',
        'issueDate',
        'dueDate',
        'currency',
        'lines',
        'totals',
        'calculationMetadata',
        'createdAt',
        'updatedAt',
        'finalizedAt',
      ],
      ['invoiceDiscount', 'notes', 'terms'],
    )
  )
    return err(invalidInvoice('Serialized finalized invoice shape is invalid.', prefix));
  if (value.kind !== 'finalized')
    return err(invalidInvoice('Serialized invoice kind must be finalized.', p('kind')));
  const id = parseString(value, 'id', p('id'), parseInvoiceId);
  if (!id.ok) return err(id.error);
  const invoiceNumber = parseString(value, 'invoiceNumber', p('invoiceNumber'), parseInvoiceNumber);
  if (!invoiceNumber.ok) return err(invoiceNumber.error);
  const business = parseParty(value.business, p('business'));
  if (!business.ok) return err(business.error);
  const customer = parseParty(value.customer, p('customer'));
  if (!customer.ok) return err(customer.error);
  const issueDate = parseString(value, 'issueDate', p('issueDate'), parseIsoDate);
  if (!issueDate.ok) return err(issueDate.error);
  const dueDate = parseString(value, 'dueDate', p('dueDate'), parseIsoDate);
  if (!dueDate.ok) return err(dueDate.error);
  if (dueDate.value < issueDate.value)
    return err(invalidInvoice('Due date must not precede issue date.', p('dueDate')));
  const cur = currency(value.currency, p('currency'));
  if (!cur.ok) return err(cur.error);
  const lines = parseLines(value.lines, p('lines'), (line, path) =>
    parseFinalizedLine(line, cur.value, path),
  );
  if (!lines.ok) return err(lines.error);
  if (lines.value.length === 0)
    return err(invalidInvoice('Finalized invoice requires at least one line.', p('lines')));
  const ids = uniqueIds(lines.value, p('lines'));
  if (!ids.ok) return err(ids.error);
  const discount = invoiceDiscount(value, cur.value, p('invoiceDiscount'));
  if (!discount.ok) return err(discount.error);
  const totals = parseTotals(value.totals, cur.value, p('totals'));
  if (!totals.ok) return err(totals.error);
  const metadata = parseMetadata(value.calculationMetadata, cur.value, p('calculationMetadata'));
  if (!metadata.ok) return err(metadata.error);
  const text = notesTerms(value, prefix);
  if (!text.ok) return err(text.error);
  const createdAt = parseString(value, 'createdAt', p('createdAt'), parseUtcTimestamp);
  if (!createdAt.ok) return err(createdAt.error);
  const updatedAt = parseString(value, 'updatedAt', p('updatedAt'), parseUtcTimestamp);
  if (!updatedAt.ok) return err(updatedAt.error);
  const finalizedAt = parseString(value, 'finalizedAt', p('finalizedAt'), parseUtcTimestamp);
  if (!finalizedAt.ok) return err(finalizedAt.error);
  if (finalizedAt.value < createdAt.value)
    return err(
      invalidInvoice('Finalized timestamp must not precede created timestamp.', p('finalizedAt')),
    );
  if (updatedAt.value !== finalizedAt.value)
    return err(invalidInvoice('Updated timestamp must equal finalized timestamp.', p('updatedAt')));
  const sums = totalsMatchLines(lines.value, totals.value);
  if (!sums.ok) return err(withPath(sums.error, prefix));
  if (discount.value?.kind === 'fixed') {
    const fixed = same(
      totals.value.invoiceDiscountTotal,
      discount.value.amount,
      'Fixed invoice discount amount must equal stored invoice discount total.',
      p('totals.invoiceDiscountTotal'),
    );
    if (!fixed.ok) return err(fixed.error);
  }
  const finalized = Object.freeze({
    kind: 'finalized',
    id: id.value,
    invoiceNumber: invoiceNumber.value,
    business: business.value,
    customer: customer.value,
    issueDate: issueDate.value,
    dueDate: dueDate.value,
    currency: cur.value,
    lines: lines.value,
    ...(discount.value === undefined ? {} : { invoiceDiscount: discount.value }),
    totals: totals.value,
    calculationMetadata: metadata.value,
    ...text.value,
    createdAt: createdAt.value,
    updatedAt: updatedAt.value,
    finalizedAt: finalizedAt.value,
  }) as FinalizedInvoice;
  return ok(finalized);
};
export const parseSerializedFinalizedInvoice = (value: unknown): DomainResult<FinalizedInvoice> => {
  const record = requireRecord(value);
  if (!record.ok) return err(record.error);
  const ver = schema(record.value);
  if (!ver.ok) return err(ver.error);
  const snapshot = { ...record.value };
  delete snapshot.schemaVersion;
  return parseFinalizedSnapshot(snapshot);
};
export const serializeVoidedInvoice = (invoice: VoidedInvoice): SerializedVoidedInvoice =>
  Object.freeze({
    schemaVersion: INVOICE_SCHEMA_VERSION,
    kind: 'voided',
    finalized: serializeFinalizedSnapshot(invoice.finalized),
    voidedAt: invoice.voidedAt,
    voidReason: invoice.voidReason,
  });
export const parseSerializedVoidedInvoice = (value: unknown): DomainResult<VoidedInvoice> => {
  const record = requireRecord(value);
  if (!record.ok) return err(record.error);
  if (!exactKeys(record.value, ['schemaVersion', 'kind', 'finalized', 'voidedAt', 'voidReason']))
    return err(invalidInvoice('Serialized voided invoice shape is invalid.'));
  const ver = schema(record.value);
  if (!ver.ok) return err(ver.error);
  if (record.value.kind !== 'voided')
    return err(invalidInvoice('Serialized invoice kind must be voided.', 'kind'));
  if (isRecord(record.value.finalized) && Object.hasOwn(record.value.finalized, 'schemaVersion'))
    return err(
      invalidInvoice(
        'Nested finalized snapshot must not include schemaVersion.',
        'finalized.schemaVersion',
      ),
    );
  const finalized = parseFinalizedSnapshot(record.value.finalized, 'finalized');
  if (!finalized.ok) return err(finalized.error);
  const voidedAt = parseString(record.value, 'voidedAt', 'voidedAt', parseUtcTimestamp);
  if (!voidedAt.ok) return err(voidedAt.error);
  const voidReason = parseString(record.value, 'voidReason', 'voidReason', parseVoidReason);
  if (!voidReason.ok) return err(voidReason.error);
  if (voidedAt.value < finalized.value.finalizedAt)
    return err(
      makeDomainError(
        'invalid_state_transition',
        'Void timestamp must not precede finalized timestamp.',
        'voidedAt',
      ),
    );
  return ok(
    Object.freeze({
      kind: 'voided',
      finalized: finalized.value,
      voidedAt: voidedAt.value,
      voidReason: voidReason.value,
    }),
  );
};
export const serializeInvoice = (invoice: Invoice): SerializedInvoice => {
  switch (invoice.kind) {
    case 'draft':
      return serializeDraftInvoice(invoice);
    case 'finalized':
      return serializeFinalizedInvoice(invoice);
    case 'voided':
      return serializeVoidedInvoice(invoice);
  }
};
export const parseSerializedInvoice = (value: unknown): DomainResult<Invoice> => {
  const record = requireRecord(value);
  if (!record.ok) return err(record.error);
  const ver = schema(record.value);
  if (!ver.ok) return err(ver.error);
  if (record.value.kind === 'draft') return parseSerializedDraftInvoice(value);
  if (record.value.kind === 'finalized') return parseSerializedFinalizedInvoice(value);
  if (record.value.kind === 'voided') return parseSerializedVoidedInvoice(value);
  return err(invalidInvoice('Unknown serialized invoice kind.', 'kind'));
};
