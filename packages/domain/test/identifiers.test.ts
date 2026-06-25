import { describe, expect, it } from 'vitest';

import {
  assertCustomerId,
  assertInvoiceId,
  DomainValidationError,
  isCustomerId,
  isInvoiceId,
  parseBusinessId,
  parseCatalogItemId,
  parseCustomerId,
  parseDocumentId,
  parseInvoiceEventId,
  parseInvoiceId,
  parseInvoiceLineItemId,
  parsePaymentId,
  parseUserId,
  type CustomerId,
} from '../src/index';

const identifierParsers = [
  parseUserId,
  parseBusinessId,
  parseCustomerId,
  parseCatalogItemId,
  parseInvoiceId,
  parseInvoiceLineItemId,
  parsePaymentId,
  parseInvoiceEventId,
  parseDocumentId,
] as const;

describe('branded identifiers', () => {
  it('accepts valid opaque identifier strings for every declared identifier type', () => {
    for (const parseIdentifier of identifierParsers) {
      expect(parseIdentifier('abc-123_DEF')).toMatchObject({ ok: true, value: 'abc-123_DEF' });
    }
  });

  it('accepts valid one-character identifiers', () => {
    expect(parseCustomerId('a')).toMatchObject({ ok: true, value: 'a' });
    expect(parseCustomerId('7')).toMatchObject({ ok: true, value: '7' });
  });

  it.each([
    ['', 'empty input'],
    ['   ', 'whitespace-only input'],
    [' customer', 'leading whitespace'],
    ['customer ', 'trailing whitespace'],
    ['customer id', 'spaces'],
    ['customer/id', 'path separators'],
    ['customer\\id', 'Windows path separators'],
    ['customer:id', 'colons'],
    ['customer.id', 'unsupported punctuation'],
    ['_customer', 'non-alphanumeric first character'],
  ])('rejects %s as %s', (value) => {
    const result = parseCustomerId(value);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_identifier');
    }
  });

  it('accepts the maximum length and rejects over-maximum length identifiers', () => {
    const maximum = `a${'b'.repeat(127)}`;
    const overMaximum = `a${'b'.repeat(128)}`;

    expect(maximum).toHaveLength(128);
    expect(parseCustomerId(maximum)).toMatchObject({ ok: true, value: maximum });
    expect(parseCustomerId(overMaximum)).toMatchObject({
      ok: false,
      error: { code: 'invalid_identifier' },
    });
  });

  it('returns discriminated parser results', () => {
    const valid = parseCustomerId('customer_123');
    const invalid = parseCustomerId('customer/123');

    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value).toBe('customer_123');
    }

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe('invalid_identifier');
    }
  });

  it('asserts valid identifiers and throws DomainValidationError for invalid values', () => {
    expect(assertCustomerId('customer-1')).toBe('customer-1');
    expect(() => assertInvoiceId('invoice/1')).toThrow(DomainValidationError);
  });

  it('provides type guards for identifier strings', () => {
    const value = 'customer-1';

    expect(isCustomerId(value)).toBe(true);
    if (isCustomerId(value)) {
      const customerId: CustomerId = value;
      expect(customerId).toBe('customer-1');
    }

    expect(isInvoiceId('invoice:1')).toBe(false);
  });
});
