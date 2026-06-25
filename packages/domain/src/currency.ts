import { brandString, type Brand } from './brand';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export type CurrencyCode = Brand<string, 'CurrencyCode'>;
export type CurrencyMinorUnitDigits = 0 | 1 | 2 | 3 | 4;

export type CurrencyDefinition = Readonly<{
  code: CurrencyCode;
  minorUnitDigits: CurrencyMinorUnitDigits;
}>;

export const DEFAULT_CURRENCY_CODE = 'USD' as CurrencyCode;
export const USD_CURRENCY_DEFINITION: CurrencyDefinition = Object.freeze({
  code: DEFAULT_CURRENCY_CODE,
  minorUnitDigits: 2,
});

const currencyCodePattern = /^[A-Z]{3}$/;
const invalidCurrencyCodeError = makeDomainError(
  'invalid_currency_code',
  'Currency code must contain exactly three uppercase ASCII letters.',
);
const invalidCurrencyDefinitionError = makeDomainError(
  'invalid_currency_definition',
  'Currency definition must include a valid currency code and minor unit digits from 0 through 4.',
);

const currencyMinorUnitDigits = [0, 1, 2, 3, 4] as const;

export const isCurrencyMinorUnitDigits = (value: unknown): value is CurrencyMinorUnitDigits =>
  typeof value === 'number' && currencyMinorUnitDigits.includes(value as CurrencyMinorUnitDigits);

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

export const createCurrencyDefinition = (
  code: CurrencyCode,
  minorUnitDigits: CurrencyMinorUnitDigits,
): DomainResult<CurrencyDefinition> => ok(Object.freeze({ code, minorUnitDigits }));

const hasOnlyCurrencyDefinitionKeys = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('code') && keys.includes('minorUnitDigits');
};

export const parseCurrencyDefinition = (value: unknown): DomainResult<CurrencyDefinition> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return err(invalidCurrencyDefinitionError);
  }

  const candidate = value as Record<string, unknown>;

  if (!hasOnlyCurrencyDefinitionKeys(candidate)) {
    return err(invalidCurrencyDefinitionError);
  }

  if (typeof candidate.code !== 'string' || !isCurrencyMinorUnitDigits(candidate.minorUnitDigits)) {
    return err(invalidCurrencyDefinitionError);
  }

  const code = parseCurrencyCode(candidate.code);

  if (!code.ok) {
    return err(invalidCurrencyDefinitionError);
  }

  return createCurrencyDefinition(code.value, candidate.minorUnitDigits);
};

export const assertCurrencyDefinition = (value: unknown): CurrencyDefinition => {
  const result = parseCurrencyDefinition(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};
