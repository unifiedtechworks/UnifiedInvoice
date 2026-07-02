export type InvoiceRepositoryErrorCode =
  | 'invoice_not_found'
  | 'invoice_already_exists'
  | 'invoice_conflict'
  | 'invoice_number_conflict'
  | 'invalid_invoice_record'
  | 'invalid_invoice_record_version'
  | 'repository_unavailable'
  | 'repository_invariant_violation';

export type InvoiceRepositoryError = Readonly<{
  code: InvoiceRepositoryErrorCode;
  message: string;
  path?: string;
  detail?: string;
}>;

export type InvoiceRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: InvoiceRepositoryError }>;

export const makeInvoiceRepositoryError = (
  code: InvoiceRepositoryErrorCode,
  message: string,
  options: Readonly<{ path?: string; detail?: string }> = {},
): InvoiceRepositoryError => {
  const error: {
    code: InvoiceRepositoryErrorCode;
    message: string;
    path?: string;
    detail?: string;
  } = { code, message };

  if (options.path !== undefined) error.path = options.path;
  if (options.detail !== undefined) error.detail = options.detail;

  return Object.freeze(error);
};

export const repoOk = <T>(value: T): InvoiceRepositoryResult<T> =>
  Object.freeze({ ok: true, value });

export const repoErr = (error: InvoiceRepositoryError): InvoiceRepositoryResult<never> =>
  Object.freeze({ ok: false, error });
