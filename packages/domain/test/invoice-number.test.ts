import { describe, expect, it } from 'vitest';

import {
  assertInvoiceNumber,
  DomainValidationError,
  isInvoiceNumber,
  parseInvoiceNumber,
} from '../src/index';

describe('invoice number primitive', () => {
  it('accepts canonical display numbers', () => {
    expect(parseInvoiceNumber('INV-1001')).toMatchObject({ ok: true, value: 'INV-1001' });
    expect(parseInvoiceNumber('2026/0001')).toMatchObject({ ok: true, value: '2026/0001' });
    expect(parseInvoiceNumber('a_b-1/2')).toMatchObject({ ok: true, value: 'a_b-1/2' });
    expect(isInvoiceNumber('INV-1001')).toBe(true);
  });

  it('rejects noncanonical values', () => {
    for (const value of ['', ' INV-1', 'INV-1 ', 'INV 1', '#1', '-INV', 'A'.repeat(65)]) {
      expect(parseInvoiceNumber(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_invoice_number' },
      });
    }
  });

  it('throws from assert API', () => {
    expect(assertInvoiceNumber('INV-1')).toBe('INV-1');
    expect(() => assertInvoiceNumber('bad value')).toThrow(DomainValidationError);
  });
});
