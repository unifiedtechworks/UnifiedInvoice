import { type Brand } from '@invoice/domain';
import { err, makeDomainError, ok, type DomainResult } from '@invoice/domain';

export type InvoiceLineDescription = Brand<string, 'InvoiceLineDescription'>;
export type InvoiceNotes = Brand<string, 'InvoiceNotes'>;
export type InvoiceTermsText = Brand<string, 'InvoiceTermsText'>;
export type PartyDisplayName = Brand<string, 'PartyDisplayName'>;
export type PartyLegalName = Brand<string, 'PartyLegalName'>;
export type EmailSnapshotText = Brand<string, 'EmailSnapshotText'>;
export type PhoneSnapshotText = Brand<string, 'PhoneSnapshotText'>;
export type AddressLineText = Brand<string, 'AddressLineText'>;
export type AddressLocalityText = Brand<string, 'AddressLocalityText'>;
export type AddressRegionText = Brand<string, 'AddressRegionText'>;
export type PostalCodeText = Brand<string, 'PostalCodeText'>;
export type CountryCode = Brand<string, 'CountryCode'>;
export type TaxIdentifierText = Brand<string, 'TaxIdentifierText'>;
export type VoidReason = Brand<string, 'VoidReason'>;

type TextErrorCode =
  | 'invalid_invoice_line'
  | 'invalid_invoice'
  | 'invalid_party_snapshot'
  | 'invalid_address'
  | 'invalid_void_reason';

const brandText = <TBrand extends string>(value: string): Brand<string, TBrand> =>
  value as Brand<string, TBrand>;

const hasControlCharacters = (value: string, allowNewlines = false): boolean => {
  for (const char of value) {
    const code = char.codePointAt(0);

    if (code === undefined) {
      continue;
    }

    if (allowNewlines && (char === '\n' || char === '\t')) {
      continue;
    }

    if ((code >= 0 && code <= 31) || code === 127) {
      return true;
    }
  }

  return false;
};

const parseBoundedText = <TBrand extends string>(
  value: string,
  options: Readonly<{
    minLength: number;
    maxLength: number;
    allowNewlines?: boolean;
    errorCode: TextErrorCode;
    message: string;
  }>,
): DomainResult<Brand<string, TBrand>> => {
  if (
    value.length < options.minLength ||
    value.length > options.maxLength ||
    value.trim().length === 0 ||
    hasControlCharacters(value, options.allowNewlines ?? false)
  ) {
    return err(makeDomainError(options.errorCode, options.message));
  }

  return ok(brandText<TBrand>(value));
};

export const parseInvoiceLineDescription = (value: string): DomainResult<InvoiceLineDescription> =>
  parseBoundedText<'InvoiceLineDescription'>(value, {
    minLength: 1,
    maxLength: 500,
    errorCode: 'invalid_invoice_line',
    message:
      'Invoice line description must be 1-500 printable characters and must not be whitespace-only.',
  });

export const parseInvoiceNotes = (value: string): DomainResult<InvoiceNotes> =>
  parseBoundedText<'InvoiceNotes'>(value, {
    minLength: 1,
    maxLength: 2_000,
    allowNewlines: true,
    errorCode: 'invalid_invoice',
    message: 'Invoice notes must be 1-2000 printable characters when present.',
  });

export const parseInvoiceTermsText = (value: string): DomainResult<InvoiceTermsText> =>
  parseBoundedText<'InvoiceTermsText'>(value, {
    minLength: 1,
    maxLength: 2_000,
    allowNewlines: true,
    errorCode: 'invalid_invoice',
    message: 'Invoice terms must be 1-2000 printable characters when present.',
  });

export const parsePartyDisplayName = (value: string): DomainResult<PartyDisplayName> =>
  parseBoundedText<'PartyDisplayName'>(value, {
    minLength: 1,
    maxLength: 200,
    errorCode: 'invalid_party_snapshot',
    message: 'Party display name must be 1-200 printable characters.',
  });

export const parsePartyLegalName = (value: string): DomainResult<PartyLegalName> =>
  parseBoundedText<'PartyLegalName'>(value, {
    minLength: 1,
    maxLength: 200,
    errorCode: 'invalid_party_snapshot',
    message: 'Party legal name must be 1-200 printable characters when present.',
  });

export const parseEmailSnapshotText = (value: string): DomainResult<EmailSnapshotText> => {
  const at = value.indexOf('@');

  if (
    value.length < 1 ||
    value.length > 320 ||
    hasControlCharacters(value) ||
    /\s/.test(value) ||
    at <= 0 ||
    at !== value.lastIndexOf('@') ||
    at === value.length - 1
  ) {
    return err(
      makeDomainError(
        'invalid_party_snapshot',
        'Email snapshot text must be 1-320 characters, contain exactly one non-edge @, and contain no whitespace or control characters.',
      ),
    );
  }

  return ok(brandText<'EmailSnapshotText'>(value));
};

export const parsePhoneSnapshotText = (value: string): DomainResult<PhoneSnapshotText> =>
  parseBoundedText<'PhoneSnapshotText'>(value, {
    minLength: 1,
    maxLength: 50,
    errorCode: 'invalid_party_snapshot',
    message: 'Phone snapshot text must be 1-50 printable characters when present.',
  });

export const parseAddressLineText = (value: string): DomainResult<AddressLineText> =>
  parseBoundedText<'AddressLineText'>(value, {
    minLength: 1,
    maxLength: 200,
    errorCode: 'invalid_address',
    message: 'Address lines must be 1-200 printable characters.',
  });

export const parseAddressLocalityText = (value: string): DomainResult<AddressLocalityText> =>
  parseBoundedText<'AddressLocalityText'>(value, {
    minLength: 1,
    maxLength: 100,
    errorCode: 'invalid_address',
    message: 'Address locality must be 1-100 printable characters.',
  });

export const parseAddressRegionText = (value: string): DomainResult<AddressRegionText> =>
  parseBoundedText<'AddressRegionText'>(value, {
    minLength: 1,
    maxLength: 100,
    errorCode: 'invalid_address',
    message: 'Address region must be 1-100 printable characters when present.',
  });

export const parsePostalCodeText = (value: string): DomainResult<PostalCodeText> =>
  parseBoundedText<'PostalCodeText'>(value, {
    minLength: 1,
    maxLength: 32,
    errorCode: 'invalid_address',
    message: 'Postal code must be 1-32 printable characters when present.',
  });

export const parseCountryCode = (value: string): DomainResult<CountryCode> => {
  if (!/^[A-Z]{2}$/.test(value)) {
    return err(
      makeDomainError(
        'invalid_address',
        'Country code must contain exactly two uppercase ASCII letters.',
      ),
    );
  }

  return ok(brandText<'CountryCode'>(value));
};

export const parseTaxIdentifierText = (value: string): DomainResult<TaxIdentifierText> =>
  parseBoundedText<'TaxIdentifierText'>(value, {
    minLength: 1,
    maxLength: 100,
    errorCode: 'invalid_party_snapshot',
    message: 'Tax identifier must be 1-100 printable characters when present.',
  });

export const parseVoidReason = (value: string): DomainResult<VoidReason> =>
  parseBoundedText<'VoidReason'>(value, {
    minLength: 1,
    maxLength: 500,
    errorCode: 'invalid_void_reason',
    message: 'Void reason must be 1-500 printable characters and must be single-line.',
  });
