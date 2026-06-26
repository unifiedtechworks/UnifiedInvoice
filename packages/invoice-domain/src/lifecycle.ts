import { err, makeDomainError, ok, type DomainResult } from '@invoice/domain';

import { type FinalizedInvoice, type VoidInvoiceCommand, type VoidedInvoice } from './types';

const compareCanonical = (left: string, right: string): -1 | 0 | 1 => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

export const voidInvoice = (
  invoice: FinalizedInvoice,
  command: VoidInvoiceCommand,
): DomainResult<VoidedInvoice> => {
  if (typeof invoice !== 'object' || invoice === null || Array.isArray(invoice)) {
    return err(
      makeDomainError('invalid_state_transition', 'Only finalized invoices can be voided.'),
    );
  }

  if (invoice.kind !== 'finalized') {
    return err(
      makeDomainError('invalid_state_transition', 'Only finalized invoices can be voided.'),
    );
  }

  if (compareCanonical(command.voidedAt, invoice.finalizedAt) < 0) {
    return err(
      makeDomainError(
        'invalid_state_transition',
        'Void timestamp must not precede finalized timestamp.',
        'voidedAt',
      ),
    );
  }

  return ok(
    Object.freeze({
      kind: 'voided',
      finalized: invoice,
      voidedAt: command.voidedAt,
      voidReason: command.reason,
    }),
  );
};
