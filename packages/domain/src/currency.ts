import { brandString, type Brand } from './brand';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export type CurrencyCode = Brand<string, 'CurrencyCode'>;

export const DEFAULT_CURRENCY_CODE = 'USD' as CurrencyCode;

const currencyCodePattern = /^[A-Z]{3}$/;
const invalidCurrencyCodeError = makeDomainError(
  'invalid_currency_code',
  'Currency code must contain exactly three uppercase ASCII letters.',
);

export const parseCurrencyCode = (value: string): DomainResult<CurrencyCode> => {
  if (!currencyCodePattern.test(value)) {
    return err(invalidCurrencyCodeError);
  }

  return ok(brandString<'CurrencyCode'>(value));
};

export const isCurrencyCode = (value: string): value is CurrencyCode =>
  currencyCodePattern.test(value);

export const assertCurrencyCode = (value: string): CurrencyCode => {
  const result = parseCurrencyCode(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};
