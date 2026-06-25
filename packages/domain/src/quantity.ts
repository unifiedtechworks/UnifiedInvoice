import { brandBigInt, type Brand, type BrandedObject } from './brand';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export type QuantityInteger = Brand<bigint, 'QuantityInteger'>;

export type Quantity = Readonly<{
  units: QuantityInteger;
  scale: typeof QUANTITY_SCALE;
}> &
  BrandedObject<'Quantity'>;

export type SerializedQuantity = Readonly<{
  units: string;
  scale: number;
}>;

export const QUANTITY_SCALE = 4 as const;
export const QUANTITY_SCALE_FACTOR = 10_000n as const;
export const MIN_QUANTITY_UNITS = -9_999_999_999_999_999n as QuantityInteger;
export const MAX_QUANTITY_UNITS = 9_999_999_999_999_999n as QuantityInteger;

const quantityDecimalPattern = /^-?(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/;
const quantityIntegerPattern = /^-?(0|[1-9][0-9]*)$/;
const invalidQuantityError = makeDomainError(
  'invalid_quantity',
  'Quantity must be a canonical decimal with no more than four decimal places.',
);
const quantityOverflowError = makeDomainError(
  'numeric_overflow',
  'Quantity is outside the supported application safety bounds.',
);

const isWithinQuantityBounds = (value: bigint): boolean =>
  value >= MIN_QUANTITY_UNITS && value <= MAX_QUANTITY_UNITS;

export const isQuantityInteger = (value: unknown): value is QuantityInteger =>
  typeof value === 'bigint' && isWithinQuantityBounds(value);

export const parseQuantityInteger = (value: string): DomainResult<QuantityInteger> => {
  if (!quantityIntegerPattern.test(value)) {
    return err(invalidQuantityError);
  }

  const parsed = BigInt(value);

  if (!isWithinQuantityBounds(parsed)) {
    return err(quantityOverflowError);
  }

  return ok(brandBigInt<'QuantityInteger'>(parsed));
};

export const assertQuantityInteger = (value: string): QuantityInteger => {
  const result = parseQuantityInteger(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

const createQuantityFromUnits = (units: QuantityInteger): Quantity =>
  Object.freeze({ units, scale: QUANTITY_SCALE }) as Quantity;

export const createQuantity = (units: QuantityInteger): DomainResult<Quantity> =>
  ok(createQuantityFromUnits(units));

export const parseQuantity = (value: string): DomainResult<Quantity> => {
  if (!quantityDecimalPattern.test(value)) {
    return err(invalidQuantityError);
  }

  const isNegative = value.startsWith('-');
  const unsignedValue = isNegative ? value.slice(1) : value;
  const [whole = '', fraction = ''] = unsignedValue.split('.');
  const paddedFraction = fraction.padEnd(QUANTITY_SCALE, '0');
  const units = BigInt(whole) * QUANTITY_SCALE_FACTOR + BigInt(paddedFraction || '0');
  const signedUnits = isNegative && units !== 0n ? -units : units;

  if (!isWithinQuantityBounds(signedUnits)) {
    return err(quantityOverflowError);
  }

  return createQuantity(brandBigInt<'QuantityInteger'>(signedUnits));
};

export const assertQuantity = (value: string): Quantity => {
  const result = parseQuantity(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

const hasOnlySerializedQuantityKeys = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('units') && keys.includes('scale');
};

export const serializeQuantity = (value: Quantity): SerializedQuantity => ({
  units: value.units.toString(),
  scale: value.scale,
});

export const parseSerializedQuantity = (value: unknown): DomainResult<Quantity> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return err(invalidQuantityError);
  }

  const candidate = value as Record<string, unknown>;

  if (!hasOnlySerializedQuantityKeys(candidate)) {
    return err(invalidQuantityError);
  }

  if (typeof candidate.units !== 'string' || candidate.scale !== QUANTITY_SCALE) {
    return err(invalidQuantityError);
  }

  const units = parseQuantityInteger(candidate.units);

  if (!units.ok) {
    return units.error.code === 'numeric_overflow' ? err(units.error) : err(invalidQuantityError);
  }

  return createQuantity(units.value);
};

export const compareQuantity = (left: Quantity, right: Quantity): -1 | 0 | 1 => {
  if (left.units < right.units) {
    return -1;
  }

  if (left.units > right.units) {
    return 1;
  }

  return 0;
};

export const equalQuantity = (left: Quantity, right: Quantity): boolean =>
  compareQuantity(left, right) === 0;
