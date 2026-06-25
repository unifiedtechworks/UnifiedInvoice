import { describe, expect, it } from 'vitest';

import {
  assertInvoiceStatus,
  DomainValidationError,
  invoiceStatuses,
  isInvoiceStatus,
  parseInvoiceStatus,
  type InvoiceStatus,
} from '../src/index';

describe('invoice status vocabulary', () => {
  it('accepts every declared status', () => {
    for (const status of invoiceStatuses) {
      expect(parseInvoiceStatus(status)).toMatchObject({ ok: true, value: status });
    }
  });

  it('rejects unknown statuses', () => {
    expect(parseInvoiceStatus('cancelled')).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_status' },
    });
  });

  it('asserts and narrows statuses to the declared vocabulary', () => {
    const value = 'paid';

    expect(assertInvoiceStatus(value)).toBe(value);
    expect(() => assertInvoiceStatus('cancelled')).toThrow(DomainValidationError);
    expect(isInvoiceStatus(value)).toBe(true);
    if (isInvoiceStatus(value)) {
      const status: InvoiceStatus = value;
      expect(status).toBe(value);
    }
  });
});
