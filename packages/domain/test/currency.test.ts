import { describe, expect, it } from 'vitest';

import {
  assertCurrencyCode,
  DEFAULT_CURRENCY_CODE,
  DomainValidationError,
  isCurrencyCode,
  parseCurrencyCode,
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
