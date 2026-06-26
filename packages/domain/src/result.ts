export type DomainErrorCode =
  | 'invalid_identifier'
  | 'invalid_date'
  | 'invalid_timestamp'
  | 'invalid_currency_code'
  | 'invalid_invoice_status'
  | 'invalid_money'
  | 'invalid_quantity'
  | 'invalid_currency_definition'
  | 'currency_mismatch'
  | 'numeric_overflow'
  | 'invalid_rounding_mode'
  | 'invalid_rate'
  | 'invalid_invoice_calculation'
  | 'duplicate_identifier'
  | 'discount_exceeds_amount'
  | 'overpayment'
  | 'invalid_state_transition'
  | 'invariant_violation';

export type DomainError = Readonly<{
  code: DomainErrorCode;
  message: string;
  path?: string;
}>;

export type DomainResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: DomainError }>;

export class DomainValidationError extends Error {
  readonly detail: DomainError;

  constructor(detail: DomainError) {
    super(detail.message);
    this.name = 'DomainValidationError';
    this.detail = detail;
  }
}

export const makeDomainError = (
  code: DomainErrorCode,
  message: string,
  path?: string,
): DomainError => {
  if (path === undefined) {
    return { code, message };
  }

  return { code, message, path };
};

export const ok = <T>(value: T): DomainResult<T> => ({ ok: true, value });

export const err = (error: DomainError): DomainResult<never> => ({ ok: false, error });
