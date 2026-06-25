import { describe, expect, it } from 'vitest';

import {
  assertCurrencyCode,
  assertMoney,
  assertMonetaryInteger,
  assertQuantityInteger,
  createQuantity,
  parseSerializedMoney,
  parseSerializedQuantity,
  serializeMoney,
  serializeQuantity,
  type SerializedMoney,
} from '../src/index';

describe('money and quantity serialization boundaries', () => {
  it('round-trips serialized money through JSON without precision loss', () => {
    const valueAboveSafeInteger = '9007199254740993';
    const money = assertMoney(
      assertCurrencyCode('USD'),
      assertMonetaryInteger(valueAboveSafeInteger),
    );
    const serialized = serializeMoney(money);
    const jsonRoundTrip = JSON.parse(JSON.stringify(serialized)) as SerializedMoney;

    expect(serialized).toEqual({ currency: 'USD', minorUnits: valueAboveSafeInteger });
    expect(jsonRoundTrip).toEqual(serialized);
    expect(parseSerializedMoney(jsonRoundTrip)).toMatchObject({
      ok: true,
      value: { minorUnits: BigInt(valueAboveSafeInteger) },
    });
  });

  it('round-trips serialized quantity through JSON without precision loss', () => {
    const quantity = createQuantity(assertQuantityInteger('9007199254740993'));
    if (!quantity.ok) {
      throw new Error('Expected quantity creation to succeed.');
    }

    const serialized = serializeQuantity(quantity.value);
    const jsonRoundTrip = JSON.parse(JSON.stringify(serialized));

    expect(serialized).toEqual({ units: '9007199254740993', scale: 4 });
    expect(jsonRoundTrip).toEqual(serialized);
    expect(parseSerializedQuantity(jsonRoundTrip)).toMatchObject({
      ok: true,
      value: { units: 9007199254740993n },
    });
  });

  it('demonstrates raw Money and Quantity are not JSON contracts because they contain bigint', () => {
    const money = assertMoney(assertCurrencyCode('USD'), assertMonetaryInteger('1'));
    const quantity = createQuantity(assertQuantityInteger('10000'));

    expect(() => JSON.stringify(money)).toThrow(TypeError);
    if (quantity.ok) {
      expect(() => JSON.stringify(quantity.value)).toThrow(TypeError);
    }
  });

  it('rejects malformed serialized money including extra properties', () => {
    for (const value of [
      null,
      [],
      { currency: 'USD', minorUnits: 100 },
      { currency: 'usd', minorUnits: '100' },
      { currency: 'USD', minorUnits: '01' },
      { currency: 'USD', minorUnits: '100', extra: true },
    ]) {
      expect(parseSerializedMoney(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_money' },
      });
    }
  });
});
