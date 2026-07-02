import { type Brand } from '@invoice/domain';

import {
  makeInvoiceRepositoryError,
  repoErr,
  repoOk,
  type InvoiceRepositoryResult,
} from './result';

export type InvoiceRecordVersion = Brand<string, 'InvoiceRecordVersion'>;

const maxInvoiceRecordVersionLength = 128;
const whitespacePattern = /\s/u;
const hasAsciiControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true;
    }
  }

  return false;
};

const invalidVersionError = () =>
  makeInvoiceRepositoryError(
    'invalid_invoice_record_version',
    'Invoice record version must be a non-empty opaque string of at most 128 characters with no whitespace or ASCII control characters.',
  );

export class InvoiceRepositoryValidationError extends Error {
  readonly detail;

  constructor(detail: ReturnType<typeof invalidVersionError>) {
    super(detail.message);
    this.name = 'InvoiceRepositoryValidationError';
    this.detail = detail;
  }
}

export const isInvoiceRecordVersion = (value: unknown): value is InvoiceRecordVersion =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= maxInvoiceRecordVersionLength &&
  !whitespacePattern.test(value) &&
  !hasAsciiControlCharacter(value);

export const parseInvoiceRecordVersion = (
  value: string,
): InvoiceRepositoryResult<InvoiceRecordVersion> => {
  if (!isInvoiceRecordVersion(value)) {
    return repoErr(invalidVersionError());
  }

  return repoOk(value as InvoiceRecordVersion);
};

export const assertInvoiceRecordVersion = (value: string): InvoiceRecordVersion => {
  const result = parseInvoiceRecordVersion(value);

  if (!result.ok) {
    throw new InvoiceRepositoryValidationError(result.error);
  }

  return result.value;
};
