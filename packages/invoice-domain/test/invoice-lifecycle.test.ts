import { describe, expect, it } from 'vitest';

import {
  addDraftInvoiceLine,
  createDraftInvoice,
  finalizeInvoice,
  setDraftInvoiceDates,
  setDraftInvoiceParties,
  voidInvoice,
} from '../src/index';
import { USD, draftLine, invoiceId, invoiceNumber, party, timestamp, voidReason } from './fixtures';

const finalizedInvoice = () => {
  const draft = createDraftInvoice({
    id: invoiceId(),
    currency: USD,
    createdAt: timestamp('2026-01-01T00:00:00.000Z'),
    updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
  });
  if (!draft.ok) throw new Error('draft');
  const parties = setDraftInvoiceParties(
    draft.value,
    { business: party('Seller'), customer: party('Buyer') },
    timestamp('2026-01-01T00:01:00.000Z'),
  );
  if (!parties.ok) throw new Error('parties');
  const dates = setDraftInvoiceDates(
    parties.value,
    { issueDate: '2026-01-01' as never, dueDate: '2026-01-31' as never },
    timestamp('2026-01-01T00:02:00.000Z'),
  );
  if (!dates.ok) throw new Error('dates');
  const line = addDraftInvoiceLine(dates.value, draftLine(), timestamp('2026-01-01T00:03:00.000Z'));
  if (!line.ok) throw new Error('line');
  const finalized = finalizeInvoice(line.value, {
    invoiceNumber: invoiceNumber(),
    finalizedAt: timestamp('2026-01-01T00:04:00.000Z'),
  });
  if (!finalized.ok) throw new Error('finalized');
  return finalized.value;
};

describe('invoice lifecycle voiding', () => {
  it('voids finalized invoices while preserving the original snapshot', () => {
    const finalized = finalizedInvoice();
    const voided = voidInvoice(finalized, {
      voidedAt: timestamp('2026-01-02T00:00:00.000Z'),
      reason: voidReason(),
    });
    expect(voided).toMatchObject({
      ok: true,
      value: { kind: 'voided', voidReason: 'Issued in error' },
    });
    if (!voided.ok) throw new Error('voided');
    expect(voided.value.finalized).toBe(finalized);
    expect(voided.value.finalized.totals.grandTotal.minorUnits).toBe(
      finalized.totals.grandTotal.minorUnits,
    );
    expect(Object.isFrozen(voided.value)).toBe(true);
  });

  it('rejects void timestamps before finalization', () => {
    expect(
      voidInvoice(finalizedInvoice(), {
        voidedAt: timestamp('2025-12-31T00:00:00.000Z'),
        reason: voidReason(),
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_state_transition' } });
  });
});
