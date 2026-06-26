import { describe, expect, it } from 'vitest';

import {
  applyRateToMoney,
  assertCurrencyCode,
  assertMoney,
  assertMonetaryInteger,
  assertRateUnits,
  MAX_MONETARY_MINOR_UNITS,
  DomainValidationError,
  isRateUnits,
  MAX_RATE_UNITS,
  MIN_RATE_UNITS,
  parseRateFromDecimalPercent,
  parseRateUnits,
  parseSerializedRate,
  RATE_SCALE,
  serializeRate,
  type RateUnits,
} from '../src/index';

const usdMoney = (minorUnits: string) =>
  assertMoney(assertCurrencyCode('USD'), assertMonetaryInteger(minorUnits));

const rate = (value: string) => {
  const result = parseRateFromDecimalPercent(value);

  if (!result.ok) {
    throw new Error(`Expected rate ${value} to parse.`);
  }

  return result.value;
};

describe('rate primitives', () => {
  it('uses parts-per-million scale with a reusable 0% through 1000% bound', () => {
    expect(RATE_SCALE).toBe(1_000_000n);
    expect(MIN_RATE_UNITS).toBe(0n);
    expect(MAX_RATE_UNITS).toBe(10_000_000n);
  });

  it('parses canonical decimal percent strings', () => {
    expect(parseRateFromDecimalPercent('0')).toMatchObject({ ok: true, value: { units: 0n } });
    expect(parseRateFromDecimalPercent('10')).toMatchObject({
      ok: true,
      value: { units: 100_000n },
    });
    expect(parseRateFromDecimalPercent('8.25')).toMatchObject({
      ok: true,
      value: { units: 82_500n },
    });
    expect(parseRateFromDecimalPercent('0.0001')).toMatchObject({ ok: true, value: { units: 1n } });
    expect(parseRateFromDecimalPercent('100')).toMatchObject({
      ok: true,
      value: { units: 1_000_000n },
    });
    expect(parseRateFromDecimalPercent('1000')).toMatchObject({
      ok: true,
      value: { units: 10_000_000n },
    });
  });

  it('rejects malformed rate input and over-maximum values', () => {
    for (const value of [
      ' 1',
      '1 ',
      '+1',
      '-1',
      '1e2',
      '1%',
      '1,000',
      '.5',
      '1.',
      '1.00001',
      '001',
      '1000.0001',
      '1001',
    ]) {
      expect(parseRateFromDecimalPercent(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_rate' },
      });
    }
  });

  it('parses and guards rate units', () => {
    expect(parseRateUnits('1000000')).toMatchObject({ ok: true, value: 1_000_000n });
    expect(parseRateUnits('10000001')).toMatchObject({
      ok: false,
      error: { code: 'invalid_rate' },
    });
    expect(isRateUnits(1n)).toBe(true);
    expect(isRateUnits('1')).toBe(false);
    expect(isRateUnits(10_000_001n)).toBe(false);

    const value: unknown = 100n;
    if (isRateUnits(value)) {
      const units: RateUnits = value;
      expect(units).toBe(100n);
    }
  });

  it('serializes and deserializes canonical rate contracts', () => {
    const parsed = rate('8.25');
    const serialized = serializeRate(parsed);

    expect(serialized).toEqual({ units: '82500', scale: 1_000_000 });
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
    expect(parseSerializedRate(serialized)).toMatchObject({ ok: true, value: parsed });
  });

  it('rejects malformed serialized rates including extra properties', () => {
    for (const value of [
      null,
      [],
      { units: 1n, scale: 1_000_000 },
      { units: '1', scale: 100 },
      { units: '1', scale: 1_000_000, extra: true },
      { units: '10000001', scale: 1_000_000 },
    ]) {
      expect(parseSerializedRate(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_rate' },
      });
    }
  });

  it('freezes created rates', () => {
    expect(Object.isFrozen(rate('8.25'))).toBe(true);
  });

  it('applies rates to positive and negative money with deterministic rounding', () => {
    expect(applyRateToMoney(usdMoney('100'), rate('10'))).toMatchObject({
      ok: true,
      value: { minorUnits: 10n },
    });
    expect(applyRateToMoney(usdMoney('101'), rate('10'))).toMatchObject({
      ok: true,
      value: { minorUnits: 10n },
    });
    expect(applyRateToMoney(usdMoney('105'), rate('10'))).toMatchObject({
      ok: true,
      value: { minorUnits: 11n },
    });
    expect(applyRateToMoney(usdMoney('-100'), rate('10'))).toMatchObject({
      ok: true,
      value: { minorUnits: -10n },
    });
    expect(applyRateToMoney(usdMoney('-105'), rate('10'))).toMatchObject({
      ok: true,
      value: { minorUnits: -11n },
    });
  });

  it('applies negative halfway cases for every supported rounding mode', () => {
    const amount = usdMoney('-5');
    const tenPercent = rate('10');

    expect(applyRateToMoney(amount, tenPercent, 'half_away_from_zero')).toMatchObject({
      ok: true,
      value: { minorUnits: -1n },
    });
    expect(applyRateToMoney(amount, tenPercent, 'half_to_even')).toMatchObject({
      ok: true,
      value: { minorUnits: 0n },
    });
    expect(applyRateToMoney(amount, tenPercent, 'truncate')).toMatchObject({
      ok: true,
      value: { minorUnits: 0n },
    });
    expect(applyRateToMoney(amount, tenPercent, 'floor')).toMatchObject({
      ok: true,
      value: { minorUnits: -1n },
    });
    expect(applyRateToMoney(amount, tenPercent, 'ceiling')).toMatchObject({
      ok: true,
      value: { minorUnits: 0n },
    });
  });

  it('detects monetary overflow when applying rates', () => {
    const result = applyRateToMoney(
      assertMoney(assertCurrencyCode('USD'), MAX_MONETARY_MINOR_UNITS),
      rate('1000'),
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'numeric_overflow' } });
  });

  it('throws DomainValidationError from assert-style APIs', () => {
    expect(assertRateUnits('100')).toBe(100n);
    expect(() => assertRateUnits('10000001')).toThrow(DomainValidationError);
  });
});
