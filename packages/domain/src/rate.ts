import { brandBigInt, type Brand, type BrandedObject } from './brand';
import { type Money, createMoney, parseMonetaryInteger } from './money';
import { divideAndRound, type RoundingMode } from './rounding';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export type RateUnits = Brand<bigint, 'RateUnits'>;

export type Rate = Readonly<{
  units: RateUnits;
}> &
  BrandedObject<'Rate'>;

export type SerializedRate = Readonly<{
  units: string;
  scale: 1_000_000;
}>;

export const RATE_SCALE = 1_000_000n as const;
export const MIN_RATE_UNITS = 0n as RateUnits;
export const MAX_RATE_UNITS = 10_000_000n as RateUnits;

const rateUnitsPattern = /^(0|[1-9][0-9]*)$/;
const rateDecimalPercentPattern = /^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/;
const invalidRateError = makeDomainError(
  'invalid_rate',
  'Rate must be a canonical non-negative decimal percent within the supported bounds.',
);

const isWithinRateBounds = (value: bigint): boolean =>
  value >= MIN_RATE_UNITS && value <= MAX_RATE_UNITS;

export const isRateUnits = (value: unknown): value is RateUnits =>
  typeof value === 'bigint' && isWithinRateBounds(value);

export const parseRateUnits = (value: string): DomainResult<RateUnits> => {
  if (!rateUnitsPattern.test(value)) {
    return err(invalidRateError);
  }

  const parsed = BigInt(value);

  if (!isWithinRateBounds(parsed)) {
    return err(invalidRateError);
  }

  return ok(brandBigInt<'RateUnits'>(parsed));
};

export const assertRateUnits = (value: string): RateUnits => {
  const result = parseRateUnits(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

const createRateFromUnits = (units: RateUnits): Rate => Object.freeze({ units }) as Rate;

export const createRate = (units: RateUnits): DomainResult<Rate> => {
  if (!isRateUnits(units)) {
    return err(invalidRateError);
  }

  return ok(createRateFromUnits(units));
};

export const assertRate = (units: RateUnits): Rate => {
  const result = createRate(units);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

export const parseRateFromDecimalPercent = (value: string): DomainResult<Rate> => {
  if (!rateDecimalPercentPattern.test(value)) {
    return err(invalidRateError);
  }

  const [whole = '', fraction = ''] = value.split('.');
  const units = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0') || '0');

  if (!isWithinRateBounds(units)) {
    return err(invalidRateError);
  }

  return createRate(brandBigInt<'RateUnits'>(units));
};

const hasOnlySerializedRateKeys = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('units') && keys.includes('scale');
};

export const serializeRate = (value: Rate): SerializedRate => ({
  units: value.units.toString(),
  scale: 1_000_000,
});

export const parseSerializedRate = (value: unknown): DomainResult<Rate> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return err(invalidRateError);
  }

  const candidate = value as Record<string, unknown>;

  if (!hasOnlySerializedRateKeys(candidate)) {
    return err(invalidRateError);
  }

  if (typeof candidate.units !== 'string' || candidate.scale !== 1_000_000) {
    return err(invalidRateError);
  }

  const units = parseRateUnits(candidate.units);

  if (!units.ok) {
    return err(units.error);
  }

  return createRate(units.value);
};

export const assertSerializedRate = (value: unknown): Rate => {
  const result = parseSerializedRate(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

export const applyRateToMoney = (
  amount: Money,
  rate: Rate,
  roundingMode?: RoundingMode,
): DomainResult<Money> => {
  const rounded = divideAndRound(amount.minorUnits * rate.units, RATE_SCALE, roundingMode);

  if (!rounded.ok) {
    return err(rounded.error);
  }

  const minorUnits = parseMonetaryInteger(rounded.value.toString());

  if (!minorUnits.ok) {
    return err(minorUnits.error);
  }

  return createMoney(amount.currency, minorUnits.value);
};
