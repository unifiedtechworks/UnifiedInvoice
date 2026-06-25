import { describe, expect, it } from 'vitest';

import { assertCurrencyCode, DomainValidationError, err, makeDomainError, ok } from '../src/index';

describe('domain errors and results', () => {
  it('keeps error details JSON-safe plain data', () => {
    const detail = makeDomainError(
      'invalid_identifier',
      'Invalid customer identifier.',
      'customer.id',
    );

    expect(JSON.parse(JSON.stringify(detail))).toEqual({
      code: 'invalid_identifier',
      message: 'Invalid customer identifier.',
      path: 'customer.id',
    });
  });

  it('discriminates ok and err results', () => {
    const success = ok('value');
    const failure = err(makeDomainError('invariant_violation', 'Invariant failed.'));

    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.value).toBe('value');
    }

    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error.code).toBe('invariant_violation');
    }
  });

  it('throws real DomainValidationError instances from assert functions', () => {
    try {
      assertCurrencyCode('usd');
      throw new Error('Expected assertCurrencyCode to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      if (error instanceof DomainValidationError) {
        expect(error.detail.code).toBe('invalid_currency_code');
        expect(error.message).toBe(error.detail.message);
      }
    }
  });

  it('does not add HTTP, React, AWS, database, logging, or persistence fields to errors', () => {
    const detail = makeDomainError('invalid_invoice_status', 'Invalid invoice status.');

    expect(Object.keys(detail).sort()).toEqual(['code', 'message']);
    expect(detail).not.toHaveProperty('status');
    expect(detail).not.toHaveProperty('statusCode');
    expect(detail).not.toHaveProperty('setState');
    expect(detail).not.toHaveProperty('awsError');
    expect(detail).not.toHaveProperty('tableName');
    expect(detail).not.toHaveProperty('logger');
  });
});
