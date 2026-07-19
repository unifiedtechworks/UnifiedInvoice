import type { InvoiceApiErrorBody } from './types';

export class InvoiceApiError extends Error {
  readonly name = 'InvoiceApiError';
  readonly status: number;
  readonly code: string | undefined;
  readonly responseBody: unknown;

  constructor({
    status,
    code,
    message,
    responseBody,
  }: Readonly<{
    status: number;
    code?: string;
    message: string;
    responseBody?: unknown;
  }>) {
    super(message);
    this.status = status;
    this.code = code;
    this.responseBody = responseBody;
  }
}

export class InvoiceApiAuthError extends Error {
  readonly name = 'InvoiceApiAuthError';
  readonly code = 'missing_access_token';

  constructor() {
    super('An access token is required for authenticated invoice API routes.');
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isInvoiceApiErrorBody = (value: unknown): value is InvoiceApiErrorBody =>
  isRecord(value) &&
  isRecord(value.error) &&
  typeof value.error.code === 'string' &&
  typeof value.error.message === 'string';
