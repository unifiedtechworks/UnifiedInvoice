import { describe, expect, it } from 'vitest';

import {
  assertInvoiceRecordVersion,
  InvoiceRepositoryValidationError,
  isInvoiceRecordVersion,
  makeInvoiceRepositoryError,
  parseInvoiceRecordVersion,
  repoErr,
  repoOk,
} from '../src/index';

describe('invoice record version primitive', () => {
  it('accepts opaque non-whitespace tokens', () => {
    expect(parseInvoiceRecordVersion('v1')).toMatchObject({ ok: true, value: 'v1' });
    expect(parseInvoiceRecordVersion('etag:abc123')).toMatchObject({
      ok: true,
      value: 'etag:abc123',
    });
    expect(isInvoiceRecordVersion('A'.repeat(128))).toBe(true);
  });

  it('rejects invalid tokens', () => {
    for (const value of [
      '',
      ' ',
      ' v1',
      'v1 ',
      'v 1',
      'line\nbreak',
      'tab\tvalue',
      'A'.repeat(129),
    ]) {
      expect(parseInvoiceRecordVersion(value)).toMatchObject({
        ok: false,
        error: { code: 'invalid_invoice_record_version' },
      });
    }
  });

  it('rejects non-string values in the guard', () => {
    expect(isInvoiceRecordVersion(undefined)).toBe(false);
    expect(isInvoiceRecordVersion(null)).toBe(false);
    expect(isInvoiceRecordVersion(1)).toBe(false);
    expect(isInvoiceRecordVersion({ value: 'v1' })).toBe(false);
  });

  it('throws from assert API', () => {
    expect(assertInvoiceRecordVersion('version-1')).toBe('version-1');
    expect(() => assertInvoiceRecordVersion('bad token')).toThrow(InvoiceRepositoryValidationError);
  });
});

describe('invoice repository result helpers', () => {
  it('returns frozen ok and err results', () => {
    const okResult = repoOk({ value: 1 });
    const error = makeInvoiceRepositoryError('invoice_not_found', 'Invoice was not found.', {
      path: 'id',
      detail: 'Missing test invoice.',
    });
    const errResult = repoErr(error);

    expect(okResult).toEqual({ ok: true, value: { value: 1 } });
    expect(errResult).toEqual({ ok: false, error });
    expect(Object.isFrozen(okResult)).toBe(true);
    expect(Object.isFrozen(errResult)).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
  });
});
