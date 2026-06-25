import { brandBigInt, type Brand, type BrandedObject } from './brand';
import { type CurrencyCode, type CurrencyDefinition } from './currency';
import { type Quantity, QUANTITY_SCALE_FACTOR } from './quantity';
import { divideAndRound, type RoundingMode } from './rounding';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export type MonetaryInteger = Brand<bigint, 'MonetaryInteger'>;

export type Money = Readonly<{
  currency: CurrencyCode;
  minorUnits: MonetaryInteger;
}> &
  BrandedObject<'Money'>;

export type SerializedMoney = Readonly<{
  currency: string;
  minorUnits: string;
}>;

export const MIN_MONETARY_MINOR_UNITS = -9_999_999_999_999_999n as MonetaryInteger;
export const MAX_MONETARY_MINOR_UNITS = 9_999_999_999_999_999n as MonetaryInteger;

const monetaryIntegerPattern = /^-?(0|[1-9][0-9]*)$/;
const moneyDecimalPattern = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const invalidMoneyError = makeDomainError(
  'invalid_money',
  'Money must use a valid currency and canonical minor-unit or decimal representation.',
);
const moneyOverflowError = makeDomainError(
  'numeric_overflow',
  'Money amount is outside the supported application safety bounds.',
);
const currencyMismatchError = makeDomainError(
  'currency_mismatch',
  'Money operations require matching currencies.',
);

const isWithinMoneyBounds = (value: bigint): boolean =>
  value >= MIN_MONETARY_MINOR_UNITS && value <= MAX_MONETARY_MINOR_UNITS;

export const isMonetaryInteger = (value: unknown): value is MonetaryInteger =>
  typeof value === 'bigint' && isWithinMoneyBounds(value);

export const parseMonetaryInteger = (value: string): DomainResult<MonetaryInteger> => {
  if (!monetaryIntegerPattern.test(value)) {
    return err(invalidMoneyError);
  }

  const parsed = BigInt(value);

  if (!isWithinMoneyBounds(parsed)) {
    return err(moneyOverflowError);
  }

  return ok(brandBigInt<'MonetaryInteger'>(parsed));
};

export const assertMonetaryInteger = (value: string): MonetaryInteger => {
  const result = parseMonetaryInteger(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

const createMoneyFromMinorUnits = (currency: CurrencyCode, minorUnits: MonetaryInteger): Money =>
  Object.freeze({ currency, minorUnits }) as Money;

export const createMoney = (
  currency: CurrencyCode,
  minorUnits: MonetaryInteger,
): DomainResult<Money> => {
  if (!isMonetaryInteger(minorUnits)) {
    return err(moneyOverflowError);
  }

  return ok(createMoneyFromMinorUnits(currency, minorUnits));
};

export const assertMoney = (currency: CurrencyCode, minorUnits: MonetaryInteger): Money => {
  const result = createMoney(currency, minorUnits);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

const minorUnitFactor = (minorUnitDigits: number): bigint => 10n ** BigInt(minorUnitDigits);

export const parseMoneyFromDecimal = (
  value: string,
  currency: CurrencyDefinition,
): DomainResult<Money> => {
  if (!moneyDecimalPattern.test(value)) {
    return err(invalidMoneyError);
  }

  const isNegative = value.startsWith('-');
  const unsignedValue = isNegative ? value.slice(1) : value;
  const [whole = '', fraction = ''] = unsignedValue.split('.');

  if (fraction.length > currency.minorUnitDigits) {
    return err(invalidMoneyError);
  }

  const factor = minorUnitFactor(currency.minorUnitDigits);
  const paddedFraction = fraction.padEnd(currency.minorUnitDigits, '0');
  const minorUnits = BigInt(whole) * factor + BigInt(paddedFraction || '0');
  const signedMinorUnits = isNegative && minorUnits !== 0n ? -minorUnits : minorUnits;

  if (!isWithinMoneyBounds(signedMinorUnits)) {
    return err(moneyOverflowError);
  }

  return createMoney(currency.code, brandBigInt<'MonetaryInteger'>(signedMinorUnits));
};

const hasOnlySerializedMoneyKeys = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('currency') && keys.includes('minorUnits');
};

export const serializeMoney = (value: Money): SerializedMoney => ({
  currency: value.currency,
  minorUnits: value.minorUnits.toString(),
});

export const parseSerializedMoney = (value: unknown): DomainResult<Money> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return err(invalidMoneyError);
  }

  const candidate = value as Record<string, unknown>;

  if (!hasOnlySerializedMoneyKeys(candidate)) {
    return err(invalidMoneyError);
  }

  if (typeof candidate.currency !== 'string' || typeof candidate.minorUnits !== 'string') {
    return err(invalidMoneyError);
  }

  const currency = currencyFromSerialized(candidate.currency);

  if (currency === null) {
    return err(invalidMoneyError);
  }

  const minorUnits = parseMonetaryInteger(candidate.minorUnits);

  if (!minorUnits.ok) {
    return minorUnits.error.code === 'numeric_overflow'
      ? err(minorUnits.error)
      : err(invalidMoneyError);
  }

  return createMoney(currency, minorUnits.value);
};

const currencyFromSerialized = (value: string): CurrencyCode | null => {
  if (!/^[A-Z]{3}$/.test(value)) {
    return null;
  }

  return value as CurrencyCode;
};

const requireMatchingCurrency = (left: Money, right: Money): DomainResult<CurrencyCode> => {
  if (left.currency !== right.currency) {
    return err(currencyMismatchError);
  }

  return ok(left.currency);
};

const createMoneyFromArithmetic = (
  currency: CurrencyCode,
  minorUnits: bigint,
): DomainResult<Money> => {
  if (!isWithinMoneyBounds(minorUnits)) {
    return err(moneyOverflowError);
  }

  return createMoney(currency, brandBigInt<'MonetaryInteger'>(minorUnits));
};

export const addMoney = (left: Money, right: Money): DomainResult<Money> => {
  const currency = requireMatchingCurrency(left, right);

  if (!currency.ok) {
    return err(currency.error);
  }

  return createMoneyFromArithmetic(currency.value, left.minorUnits + right.minorUnits);
};

export const subtractMoney = (left: Money, right: Money): DomainResult<Money> => {
  const currency = requireMatchingCurrency(left, right);

  if (!currency.ok) {
    return err(currency.error);
  }

  return createMoneyFromArithmetic(currency.value, left.minorUnits - right.minorUnits);
};

export const negateMoney = (value: Money): DomainResult<Money> =>
  createMoneyFromArithmetic(value.currency, -value.minorUnits);

export const compareMoney = (left: Money, right: Money): DomainResult<-1 | 0 | 1> => {
  const currency = requireMatchingCurrency(left, right);

  if (!currency.ok) {
    return err(currency.error);
  }

  if (left.minorUnits < right.minorUnits) {
    return ok(-1);
  }

  if (left.minorUnits > right.minorUnits) {
    return ok(1);
  }

  return ok(0);
};

export const equalMoney = (left: Money, right: Money): boolean =>
  left.currency === right.currency && left.minorUnits === right.minorUnits;

export const multiplyMoneyByQuantity = (
  money: Money,
  quantity: Quantity,
  roundingMode?: RoundingMode,
): DomainResult<Money> => {
  const rounded = divideAndRound(
    money.minorUnits * quantity.units,
    QUANTITY_SCALE_FACTOR,
    roundingMode,
  );

  if (!rounded.ok) {
    return err(rounded.error);
  }

  return createMoneyFromArithmetic(money.currency, rounded.value);
};
