import { describe, expect, it } from 'vitest';

import {
  addMoney,
  assertCurrencyCode,
  assertMoney,
  assertMonetaryInteger,
  compareMoney,
  createCurrencyDefinition,
  createMoney,
  DomainValidationError,
  equalMoney,
  isMonetaryInteger,
  MAX_MONETARY_MINOR_UNITS,
  MIN_MONETARY_MINOR_UNITS,
  negateMoney,
  parseMoneyFromDecimal,
  parseMonetaryInteger,
  serializeMoney,
  subtractMoney,
  USD_CURRENCY_DEFINITION,
  type CurrencyDefinition,
  type Money,
  type MonetaryInteger,
} from '../src/index';

const usd = USD_CURRENCY_DEFINITION;

const currencyDefinition = (
  code: string,
  minorUnitDigits: 0 | 1 | 2 | 3 | 4,
): CurrencyDefinition => {
  const result = createCurrencyDefinition(assertCurrencyCode(code), minorUnitDigits);

  if (!result.ok) {
    throw new Error(`Expected ${code} currency definition to be valid.`);
  }

  return result.value;
};

const eur: CurrencyDefinition = currencyDefinition('EUR', 2);

const money = (value: string, currency: CurrencyDefinition = usd): Money => {
  const result = parseMoneyFromDecimal(value, currency);

  if (!result.ok) {
    throw new Error(`Expected ${value} to parse as money.`);
  }

  return result.value;
};

describe('monetary integers', () => {
  it('accepts zero, positive, negative, smallest, and maximum supported minor-unit values', () => {
    expect(parseMonetaryInteger('0')).toMatchObject({ ok: true, value: 0n });
    expect(parseMonetaryInteger('1')).toMatchObject({ ok: true, value: 1n });
    expect(parseMonetaryInteger('-1')).toMatchObject({ ok: true, value: -1n });
    expect(parseMonetaryInteger(MAX_MONETARY_MINOR_UNITS.toString())).toMatchObject({
      ok: true,
      value: MAX_MONETARY_MINOR_UNITS,
    });
    expect(parseMonetaryInteger(MIN_MONETARY_MINOR_UNITS.toString())).toMatchObject({
      ok: true,
      value: MIN_MONETARY_MINOR_UNITS,
    });
  });

  it('rejects values outside the application safety bounds without clamping', () => {
    expect(parseMonetaryInteger('10000000000000000')).toMatchObject({
      ok: false,
      error: { code: 'numeric_overflow' },
    });
    expect(parseMonetaryInteger('-10000000000000000')).toMatchObject({
      ok: false,
      error: { code: 'numeric_overflow' },
    });
  });

  it('rejects malformed integer strings', () => {
    for (const value of ['01', '+1', '1.0', '1e3', ' 1', '1 ', '1,000']) {
      expect(parseMonetaryInteger(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_money' },
      });
    }
  });

  it('uses unknown-accepting type guards for bounded bigint values', () => {
    expect(isMonetaryInteger(1n)).toBe(true);
    expect(isMonetaryInteger('1')).toBe(false);
    expect(isMonetaryInteger(1)).toBe(false);
    expect(isMonetaryInteger(10_000_000_000_000_000n)).toBe(false);

    const value: unknown = 25n;
    if (isMonetaryInteger(value)) {
      const minorUnits: MonetaryInteger = value;
      expect(minorUnits).toBe(25n);
    }
  });
});

describe('money creation and decimal parsing', () => {
  it('creates immutable branded Money values through public constructors', () => {
    const minorUnits = assertMonetaryInteger('123');
    const result = createMoney(assertCurrencyCode('USD'), minorUnits);

    expect(result).toMatchObject({ ok: true, value: { currency: 'USD', minorUnits: 123n } });
    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
    }
    expect(assertMoney(assertCurrencyCode('USD'), minorUnits).minorUnits).toBe(123n);
  });

  it('parses zero, positive, negative, and smallest-unit decimal values', () => {
    expect(money('0').minorUnits).toBe(0n);
    expect(money('12.34').minorUnits).toBe(1234n);
    expect(money('-12.34').minorUnits).toBe(-1234n);
    expect(money('0.01').minorUnits).toBe(1n);
  });

  it('accepts negative zero forms and canonicalizes them to zero', () => {
    for (const value of ['-0', '-0.0', '-0.00']) {
      const parsed = money(value);
      expect(parsed.minorUnits).toBe(0n);
      expect(serializeMoney(parsed).minorUnits).toBe('0');
    }
  });

  it('uses supplied currency minor-unit digits without assuming two decimals', () => {
    const jpy = createCurrencyDefinition(assertCurrencyCode('JPY'), 0);
    const kwd = createCurrencyDefinition(assertCurrencyCode('KWD'), 3);
    const test4 = createCurrencyDefinition(assertCurrencyCode('XTS'), 4);

    expect(jpy.ok && money('123', jpy.value).minorUnits).toBe(123n);
    expect(kwd.ok && money('1.234', kwd.value).minorUnits).toBe(1234n);
    expect(test4.ok && money('1.2345', test4.value).minorUnits).toBe(12345n);
  });

  it('rejects malformed decimal machine inputs and excessive precision', () => {
    for (const value of [
      '001.23',
      '+1.23',
      '1e3',
      '1,000.00',
      '$1.00',
      ' .50',
      '.50',
      '1.',
      '1.234',
    ]) {
      expect(parseMoneyFromDecimal(value, usd)).toMatchObject({
        ok: false,
        error: { code: 'invalid_money' },
      });
    }
  });

  it('throws DomainValidationError from assert-style APIs', () => {
    expect(() => assertMonetaryInteger('01')).toThrow(DomainValidationError);
  });
});

describe('money arithmetic', () => {
  it('adds, subtracts, negates, compares, and checks equality for same-currency money', () => {
    const left = money('12.50');
    const right = money('2.25');

    expect(addMoney(left, right)).toMatchObject({ ok: true, value: { minorUnits: 1475n } });
    expect(subtractMoney(left, right)).toMatchObject({ ok: true, value: { minorUnits: 1025n } });
    expect(negateMoney(right)).toMatchObject({ ok: true, value: { minorUnits: -225n } });
    expect(compareMoney(left, right)).toMatchObject({ ok: true, value: 1 });
    expect(compareMoney(right, left)).toMatchObject({ ok: true, value: -1 });
    expect(compareMoney(left, money('12.50'))).toMatchObject({ ok: true, value: 0 });
    expect(equalMoney(left, money('12.50'))).toBe(true);
  });

  it('rejects cross-currency arithmetic and ordering comparisons while equality returns false', () => {
    const usdMoney = money('1.00', usd);
    const eurMoney = money('1.00', eur);

    expect(addMoney(usdMoney, eurMoney)).toMatchObject({
      ok: false,
      error: { code: 'currency_mismatch' },
    });
    expect(subtractMoney(usdMoney, eurMoney)).toMatchObject({
      ok: false,
      error: { code: 'currency_mismatch' },
    });
    expect(compareMoney(usdMoney, eurMoney)).toMatchObject({
      ok: false,
      error: { code: 'currency_mismatch' },
    });
    expect(equalMoney(usdMoney, eurMoney)).toBe(false);
  });

  it('detects arithmetic overflow', () => {
    const maximum = assertMoney(assertCurrencyCode('USD'), MAX_MONETARY_MINOR_UNITS);
    const one = money('0.01');

    expect(addMoney(maximum, one)).toMatchObject({
      ok: false,
      error: { code: 'numeric_overflow' },
    });
    expect(
      negateMoney(assertMoney(assertCurrencyCode('USD'), MIN_MONETARY_MINOR_UNITS)),
    ).toMatchObject({
      ok: true,
      value: { minorUnits: 9_999_999_999_999_999n },
    });
  });
});
