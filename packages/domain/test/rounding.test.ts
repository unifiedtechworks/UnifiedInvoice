import { describe, expect, it } from 'vitest';

import {
  assertCurrencyCode,
  createCurrencyDefinition,
  DEFAULT_ROUNDING_MODE,
  isRoundingMode,
  parseMoneyFromDecimal,
  parseQuantity,
  parseRoundingMode,
  roundingModes,
  type RoundingMode,
  multiplyMoneyByQuantity,
} from '../src/index';

const usd = createCurrencyDefinition(assertCurrencyCode('USD'), 2);

const multiplyCents = (cents: string, quantity: string, roundingMode: RoundingMode): bigint => {
  if (!usd.ok) {
    throw new Error('Expected USD currency definition.');
  }

  const money = parseMoneyFromDecimal(cents, usd.value);
  const parsedQuantity = parseQuantity(quantity);

  if (!money.ok || !parsedQuantity.ok) {
    throw new Error('Expected money and quantity test fixtures to parse.');
  }

  const result = multiplyMoneyByQuantity(money.value, parsedQuantity.value, roundingMode);

  if (!result.ok) {
    throw new Error('Expected multiplication to succeed.');
  }

  return result.value.minorUnits;
};

describe('rounding modes', () => {
  it('declares only the approved rounding modes and default', () => {
    expect(roundingModes).toEqual([
      'half_away_from_zero',
      'half_to_even',
      'truncate',
      'floor',
      'ceiling',
    ]);
    expect(DEFAULT_ROUNDING_MODE).toBe('half_away_from_zero');
    expect(parseRoundingMode('half_away_from_zero')).toMatchObject({ ok: true });
    expect(parseRoundingMode('half_up')).toMatchObject({
      ok: false,
      error: { code: 'invalid_rounding_mode' },
    });
    expect(isRoundingMode('ceiling')).toBe(true);
  });

  it.each([
    ['half_away_from_zero', 2n, -2n, 2n, -2n, 2n],
    ['half_to_even', 2n, -2n, 2n, -2n, 2n],
    ['truncate', 1n, -1n, 1n, -1n, 2n],
    ['floor', 1n, -2n, 1n, -2n, 2n],
    ['ceiling', 2n, -1n, 2n, -1n, 2n],
  ] as const)(
    'rounds positive/negative non-half, positive/negative half, and exact divisions for %s',
    (mode, positiveNonHalf, negativeNonHalf, positiveHalf, negativeHalf, exact) => {
      expect(multiplyCents('0.01', '1.6000', mode)).toBe(positiveNonHalf);
      expect(multiplyCents('-0.01', '1.6000', mode)).toBe(negativeNonHalf);
      expect(multiplyCents('0.01', '1.5000', mode)).toBe(positiveHalf);
      expect(multiplyCents('-0.01', '1.5000', mode)).toBe(negativeHalf);
      expect(multiplyCents('0.01', '2.0000', mode)).toBe(exact);
    },
  );

  it('uses half-to-even parity for halfway values', () => {
    expect(multiplyCents('0.01', '2.5000', 'half_to_even')).toBe(2n);
    expect(multiplyCents('0.01', '3.5000', 'half_to_even')).toBe(4n);
    expect(multiplyCents('-0.01', '2.5000', 'half_to_even')).toBe(-2n);
    expect(multiplyCents('-0.01', '3.5000', 'half_to_even')).toBe(-4n);
  });
});
