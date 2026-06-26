import { err, makeDomainError, ok, type DomainResult } from '@invoice/domain';

import { type PartySnapshot, type PostalAddressSnapshot } from './types';

const invalidParty = (message: string, path?: string) =>
  makeDomainError('invalid_party_snapshot', message, path);

const invalidAddress = (message: string, path?: string) =>
  makeDomainError('invalid_address', message, path);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const createPostalAddressSnapshot = (
  input: PostalAddressSnapshot,
): DomainResult<PostalAddressSnapshot> => {
  if (
    !isRecord(input) ||
    input.line1 === undefined ||
    input.city === undefined ||
    input.countryCode === undefined
  ) {
    return err(invalidAddress('Postal address requires line1, city, and countryCode.'));
  }

  return ok(Object.freeze({ ...input }));
};

export const createPartySnapshot = (input: PartySnapshot): DomainResult<PartySnapshot> => {
  if (!isRecord(input) || input.displayName === undefined) {
    return err(invalidParty('Party snapshot requires a display name.', 'displayName'));
  }

  let billingAddress = input.billingAddress;

  if (billingAddress !== undefined) {
    const address = createPostalAddressSnapshot(billingAddress);

    if (!address.ok) {
      return err(address.error);
    }

    billingAddress = address.value;
  }

  return ok(
    Object.freeze({
      ...input,
      ...(billingAddress === undefined ? {} : { billingAddress }),
    }),
  );
};
