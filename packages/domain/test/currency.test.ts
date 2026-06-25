import { describe, expect, it } from 'vitest';

import {
  assertCurrencyCode,
  assertCurrencyDefinition,
  createCurrencyDefinition,
  DEFAULT_CURRENCY_CODE,
  DomainValidationError,
  isCurrencyMinorUnitDigits,
  isCurrencyCode,
  parseCurrencyCode,
  parseCurrencyDefinition,
  USD_CURRENCY_DEFINITION,
  type CurrencyCode,
} from '../src/index';

describe('currency codes', () => {
  it('accepts valid uppercase three-letter codes', () => {
    expect(DEFAULT_CURRENCY_CODE).toBe('USD');
    expect(parseCurrencyCode('USD')).toMatchObject({ ok: true, value: 'USD' });
    expect(parseCurrencyCode('EUR')).toMatchObject({ ok: true, value: 'EUR' });
  });

  it.each([
    ['usd', 'lowercase'],
    ['US', 'wrong length'],
    ['USDD', 'wrong length'],
    ['US1', 'digits'],
    ['US$', 'punctuation'],
    [' USD', 'leading whitespace'],
    ['USD ', 'trailing whitespace'],
  ])('rejects %s as %s', (value) => {
    expect(parseCurrencyCode(value)).toMatchObject({
      ok: false,
      error: { code: 'invalid_currency_code' },
    });
  });

  it('asserts and narrows currency codes', () => {
    const value = 'USD';

    expect(assertCurrencyCode(value)).toBe(value);
    expect(() => assertCurrencyCode('usd')).toThrow(DomainValidationError);
    expect(isCurrencyCode(value)).toBe(true);
    if (isCurrencyCode(value)) {
      const currencyCode: CurrencyCode = value;
      expect(currencyCode).toBe(value);
    }
  });
});

describe('currency definitions', () => {
  it('exports USD as the only built-in currency definition for Task 003', () => {
    expect(USD_CURRENCY_DEFINITION).toEqual({ code: 'USD', minorUnitDigits: 2 });
  });

  it('creates and parses definitions for allowed minor-unit digits', () => {
    const examples = [
      ['JPY', 0],
      ['EUR', 2],
      ['KWD', 3],
      ['XTS', 4],
    ] as const;

    for (const [code, minorUnitDigits] of examples) {
      const created = createCurrencyDefinition(assertCurrencyCode(code), minorUnitDigits);
      expect(created).toMatchObject({ ok: true, value: { code, minorUnitDigits } });
      expect(parseCurrencyDefinition({ code, minorUnitDigits })).toMatchObject({
        ok: true,
        value: { code, minorUnitDigits },
      });
    }
  });

  it('narrows allowed minor-unit digits', () => {
    expect(isCurrencyMinorUnitDigits(0)).toBe(true);
    expect(isCurrencyMinorUnitDigits(4)).toBe(true);
    expect(isCurrencyMinorUnitDigits(5)).toBe(false);
    expect(isCurrencyMinorUnitDigits(2.5)).toBe(false);
    expect(isCurrencyMinorUnitDigits('2')).toBe(false);
  });

  it('rejects malformed currency definitions and extra properties', () => {
    for (const value of [
      null,
      [],
      { code: 'usd', minorUnitDigits: 2 },
      { code: 'USD', minorUnitDigits: 5 },
      { code: 'USD', minorUnitDigits: 2.5 },
      { code: 'USD', minorUnitDigits: '2' },
      { code: 'USD', minorUnitDigits: 2, extra: true },
    ]) {
      expect(parseCurrencyDefinition(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_currency_definition' },
      });
    }
  });

  it('throws DomainValidationError from assert-style currency definition APIs', () => {
    expect(assertCurrencyDefinition({ code: 'USD', minorUnitDigits: 2 })).toEqual({
      code: 'USD',
      minorUnitDigits: 2,
    });
    expect(() => assertCurrencyDefinition({ code: 'USD', minorUnitDigits: 5 })).toThrow(
      DomainValidationError,
    );
  });
});
