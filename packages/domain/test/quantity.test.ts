import { describe, expect, it } from 'vitest';

import {
  assertQuantity,
  assertQuantityInteger,
  compareQuantity,
  createQuantity,
  DomainValidationError,
  equalQuantity,
  isQuantityInteger,
  MAX_QUANTITY_UNITS,
  MIN_QUANTITY_UNITS,
  parseQuantity,
  parseQuantityInteger,
  parseSerializedQuantity,
  QUANTITY_SCALE,
  QUANTITY_SCALE_FACTOR,
  serializeQuantity,
  type QuantityInteger,
} from '../src/index';

describe('quantity integers and fixed-scale quantities', () => {
  it('defines a fixed four-decimal scale', () => {
    expect(QUANTITY_SCALE).toBe(4);
    expect(QUANTITY_SCALE_FACTOR).toBe(10_000n);
  });

  it('accepts whole, fractional, zero, negative, minimum, and maximum quantities', () => {
    expect(parseQuantity('1')).toMatchObject({ ok: true, value: { units: 10_000n } });
    expect(parseQuantity('1.5')).toMatchObject({ ok: true, value: { units: 15_000n } });
    expect(parseQuantity('2.25')).toMatchObject({ ok: true, value: { units: 22_500n } });
    expect(parseQuantity('0.125')).toMatchObject({ ok: true, value: { units: 1_250n } });
    expect(parseQuantity('0')).toMatchObject({ ok: true, value: { units: 0n } });
    expect(parseQuantity('-1.25')).toMatchObject({ ok: true, value: { units: -12_500n } });
    expect(parseQuantityInteger(MAX_QUANTITY_UNITS.toString())).toMatchObject({ ok: true });
    expect(parseQuantityInteger(MIN_QUANTITY_UNITS.toString())).toMatchObject({ ok: true });
  });

  it('accepts negative zero forms and canonicalizes them to zero', () => {
    for (const value of ['-0', '-0.0', '-0.00', '-0.0000']) {
      const result = parseQuantity(value);
      expect(result).toMatchObject({ ok: true, value: { units: 0n } });
      if (result.ok) {
        expect(serializeQuantity(result.value).units).toBe('0');
      }
    }
  });

  it('rejects excessive precision and malformed quantity input', () => {
    for (const value of ['1.23456', '001.2', '+1', '1e3', '1,000', ' 1', '1 ', '.5', '1.']) {
      expect(parseQuantity(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_quantity' },
      });
    }
  });

  it('detects quantity overflow without clamping', () => {
    expect(parseQuantityInteger('10000000000000000')).toMatchObject({
      ok: false,
      error: { code: 'numeric_overflow' },
    });
  });

  it('creates immutable quantities and supports comparison/equality', () => {
    const one = assertQuantity('1');
    const two = assertQuantity('2');
    const secondOne = assertQuantity('1.0000');

    expect(Object.isFrozen(one)).toBe(true);
    expect(createQuantity(assertQuantityInteger('5000'))).toMatchObject({
      ok: true,
      value: { units: 5000n, scale: 4 },
    });
    expect(compareQuantity(one, two)).toBe(-1);
    expect(compareQuantity(two, one)).toBe(1);
    expect(compareQuantity(one, secondOne)).toBe(0);
    expect(equalQuantity(one, secondOne)).toBe(true);
  });

  it('uses unknown-accepting type guards for bounded bigint values', () => {
    expect(isQuantityInteger(1n)).toBe(true);
    expect(isQuantityInteger('1')).toBe(false);
    expect(isQuantityInteger(10_000_000_000_000_000n)).toBe(false);

    const value: unknown = 25n;
    if (isQuantityInteger(value)) {
      const units: QuantityInteger = value;
      expect(units).toBe(25n);
    }
  });

  it('serializes and deserializes canonical quantity contracts', () => {
    const quantity = assertQuantity('1.2500');
    const serialized = serializeQuantity(quantity);

    expect(serialized).toEqual({ units: '12500', scale: 4 });
    expect(parseSerializedQuantity(serialized)).toMatchObject({ ok: true, value: quantity });
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });

  it('rejects malformed serialized quantities including extra properties', () => {
    for (const value of [
      null,
      [],
      { units: 1n, scale: 4 },
      { units: '10000', scale: 2 },
      { units: '10000', scale: 4, extra: true },
      { units: '01', scale: 4 },
    ]) {
      expect(parseSerializedQuantity(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_quantity' },
      });
    }
  });

  it('throws DomainValidationError from assert-style APIs', () => {
    expect(() => assertQuantity('1.23456')).toThrow(DomainValidationError);
    expect(() => assertQuantityInteger('01')).toThrow(DomainValidationError);
  });
});
