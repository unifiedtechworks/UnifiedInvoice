import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export const roundingModes = [
  'half_away_from_zero',
  'half_to_even',
  'truncate',
  'floor',
  'ceiling',
] as const;

export type RoundingMode = (typeof roundingModes)[number];

export const DEFAULT_ROUNDING_MODE = 'half_away_from_zero' as const;

const roundingModeSet = new Set<string>(roundingModes);
const invalidRoundingModeError = makeDomainError(
  'invalid_rounding_mode',
  'Rounding mode must be one of the declared platform rounding mode values.',
);
const invariantDivisionByZeroError = makeDomainError(
  'invariant_violation',
  'Internal integer division denominator must not be zero.',
);

export const isRoundingMode = (value: string): value is RoundingMode => roundingModeSet.has(value);

export const parseRoundingMode = (value: string): DomainResult<RoundingMode> => {
  if (!isRoundingMode(value)) {
    return err(invalidRoundingModeError);
  }

  return ok(value);
};

export const assertRoundingMode = (value: string): RoundingMode => {
  const result = parseRoundingMode(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

const absolute = (value: bigint): bigint => (value < 0n ? -value : value);

const signOf = (value: bigint): -1n | 0n | 1n => {
  if (value < 0n) {
    return -1n;
  }

  if (value > 0n) {
    return 1n;
  }

  return 0n;
};

export const divideAndRound = (
  numerator: bigint,
  denominator: bigint,
  roundingMode: RoundingMode = DEFAULT_ROUNDING_MODE,
): DomainResult<bigint> => {
  if (denominator === 0n) {
    return err(invariantDivisionByZeroError);
  }

  const normalizedNumerator = denominator < 0n ? -numerator : numerator;
  const normalizedDenominator = absolute(denominator);
  const quotient = normalizedNumerator / normalizedDenominator;
  const remainder = normalizedNumerator % normalizedDenominator;

  if (remainder === 0n) {
    return ok(quotient);
  }

  const sign = signOf(normalizedNumerator);
  const absoluteRemainder = absolute(remainder);
  const twiceRemainder = absoluteRemainder * 2n;

  switch (roundingMode) {
    case 'truncate':
      return ok(quotient);
    case 'floor':
      return ok(sign < 0n ? quotient - 1n : quotient);
    case 'ceiling':
      return ok(sign > 0n ? quotient + 1n : quotient);
    case 'half_away_from_zero':
      return ok(twiceRemainder >= normalizedDenominator ? quotient + sign : quotient);
    case 'half_to_even': {
      if (twiceRemainder > normalizedDenominator) {
        return ok(quotient + sign);
      }

      if (twiceRemainder < normalizedDenominator) {
        return ok(quotient);
      }

      return ok(quotient % 2n === 0n ? quotient : quotient + sign);
    }
  }
};
