import { describe, expect, it } from 'vitest';

import {
  createPartySnapshot,
  createPostalAddressSnapshot,
  parseAddressLineText,
  parseAddressLocalityText,
  parseCountryCode,
  parseEmailSnapshotText,
  parseInvoiceNotes,
  parseInvoiceTermsText,
  parsePartyDisplayName,
  parsePhoneSnapshotText,
  parseVoidReason,
} from '../src/index';
import { party } from './fixtures';

const addressLine = (value: string) => {
  const result = parseAddressLineText(value);
  if (!result.ok) throw new Error('Expected address line.');
  return result.value;
};

const locality = (value: string) => {
  const result = parseAddressLocalityText(value);
  if (!result.ok) throw new Error('Expected locality.');
  return result.value;
};

const country = (value: string) => {
  const result = parseCountryCode(value);
  if (!result.ok) throw new Error('Expected country.');
  return result.value;
};

describe('party and text snapshots', () => {
  it('creates frozen party and address snapshots', () => {
    const address = createPostalAddressSnapshot({
      line1: addressLine('123 Main'),
      city: locality('Seattle'),
      countryCode: country('US'),
    });
    expect(address).toMatchObject({ ok: true });
    if (!address.ok) throw new Error('Expected address.');
    expect(Object.isFrozen(address.value)).toBe(true);

    const created = createPartySnapshot({ ...party('Customer'), billingAddress: address.value });
    expect(created).toMatchObject({ ok: true });
    if (!created.ok) throw new Error('Expected party.');
    expect(Object.isFrozen(created.value)).toBe(true);
    expect(Object.isFrozen(created.value.billingAddress)).toBe(true);
  });

  it('rejects invalid party, address, email, phone, notes, terms, country, and void reason text', () => {
    expect(parsePartyDisplayName(' '.repeat(2))).toMatchObject({
      ok: false,
      error: { code: 'invalid_party_snapshot' },
    });
    expect(parseEmailSnapshotText('a@@b.com')).toMatchObject({
      ok: false,
      error: { code: 'invalid_party_snapshot' },
    });
    expect(parseEmailSnapshotText('@example.com')).toMatchObject({
      ok: false,
      error: { code: 'invalid_party_snapshot' },
    });
    expect(parsePhoneSnapshotText('')).toMatchObject({
      ok: false,
      error: { code: 'invalid_party_snapshot' },
    });
    expect(parseInvoiceNotes('hello\nworld')).toMatchObject({ ok: true });
    expect(parseInvoiceNotes('')).toMatchObject({ ok: false, error: { code: 'invalid_invoice' } });
    expect(parseInvoiceTermsText('net 30')).toMatchObject({ ok: true });
    expect(parseCountryCode('usa')).toMatchObject({
      ok: false,
      error: { code: 'invalid_address' },
    });
    expect(parseVoidReason('')).toMatchObject({
      ok: false,
      error: { code: 'invalid_void_reason' },
    });
    expect(parseVoidReason('bad\nreason')).toMatchObject({
      ok: false,
      error: { code: 'invalid_void_reason' },
    });
    expect(createPartySnapshot({} as never)).toMatchObject({
      ok: false,
      error: { code: 'invalid_party_snapshot' },
    });
    expect(
      createPostalAddressSnapshot({ city: parseAddressLocalityText('Seattle') } as never),
    ).toMatchObject({ ok: false, error: { code: 'invalid_address' } });
  });
});
