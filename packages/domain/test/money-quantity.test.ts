import { describe, expect, it } from 'vitest';

import {
  assertCurrencyCode,
  assertMoney,
  createCurrencyDefinition,
  MAX_MONETARY_MINOR_UNITS,
  multiplyMoneyByQuantity,
  parseMoneyFromDecimal,
  parseQuantity,
  USD_CURRENCY_DEFINITION,
} from '../src/index';

const parsedMoney = (value: string) => {
  const result = parseMoneyFromDecimal(value, USD_CURRENCY_DEFINITION);
  if (!result.ok) {
    throw new Error('Expected money fixture to parse.');
  }
  return result.value;
};

const parsedQuantity = (value: string) => {
  const result = parseQuantity(value);
  if (!result.ok) {
    throw new Error('Expected quantity fixture to parse.');
  }
  return result.value;
};

describe('money multiplied by quantity', () => {
  it('handles whole quantities, fractional quantities, and exact results', () => {
    expect(multiplyMoneyByQuantity(parsedMoney('12.34'), parsedQuantity('2'))).toMatchObject({
      ok: true,
      value: { minorUnits: 2468n },
    });
    expect(multiplyMoneyByQuantity(parsedMoney('10.00'), parsedQuantity('1.5'))).toMatchObject({
      ok: true,
      value: { minorUnits: 1500n },
    });
  });

  it('rounds required results with the default half-away-from-zero mode', () => {
    expect(multiplyMoneyByQuantity(parsedMoney('0.01'), parsedQuantity('1.5'))).toMatchObject({
      ok: true,
      value: { minorUnits: 2n },
    });
    expect(multiplyMoneyByQuantity(parsedMoney('-0.01'), parsedQuantity('1.5'))).toMatchObject({
      ok: true,
      value: { minorUnits: -2n },
    });
  });

  it('handles negative quantities at the primitive level', () => {
    expect(multiplyMoneyByQuantity(parsedMoney('10.00'), parsedQuantity('-1.5'))).toMatchObject({
      ok: true,
      value: { minorUnits: -1500n },
    });
  });

  it('detects overflow after exact intermediate arithmetic', () => {
    const maximum = assertMoney(assertCurrencyCode('USD'), MAX_MONETARY_MINOR_UNITS);

    expect(multiplyMoneyByQuantity(maximum, parsedQuantity('2'))).toMatchObject({
      ok: false,
      error: { code: 'numeric_overflow' },
    });
  });

  it('supports non-USD currency definitions without a registry', () => {
    const kwd = createCurrencyDefinition(assertCurrencyCode('KWD'), 3);
    if (!kwd.ok) {
      throw new Error('Expected KWD definition fixture.');
    }

    const unitPrice = parseMoneyFromDecimal('1.234', kwd.value);
    expect(unitPrice).toMatchObject({ ok: true, value: { currency: 'KWD', minorUnits: 1234n } });
  });
});
