import { describe, expect, it } from 'vitest';

import {
  addDraftInvoiceLine,
  calculateDraftInvoice,
  createDraftInvoice,
  finalizeInvoice,
  setDraftInvoiceDates,
  setDraftInvoiceParties,
  toInvoiceCalculationInput,
} from '../src/index';
import { calculateInvoice } from '@invoice/invoice-engine';
import { USD, draftLine, invoiceId, invoiceNumber, party, rate, timestamp } from './fixtures';

const finalizableDraft = () => {
  const created = createDraftInvoice({
    id: invoiceId(),
    currency: USD,
    createdAt: timestamp('2026-01-01T00:00:00.000Z'),
    updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
  });
  if (!created.ok) throw new Error('Expected draft.');
  const parties = setDraftInvoiceParties(
    created.value,
    { business: party('Seller'), customer: party('Buyer') },
    timestamp('2026-01-01T00:01:00.000Z'),
  );
  if (!parties.ok) throw new Error('Expected parties.');
  const dates = setDraftInvoiceDates(
    parties.value,
    { issueDate: '2026-01-02' as never, dueDate: '2026-02-01' as never },
    timestamp('2026-01-01T00:02:00.000Z'),
  );
  if (!dates.ok) throw new Error('Expected dates.');
  const line = addDraftInvoiceLine(
    dates.value,
    { ...draftLine('line-1', 0, '100.00'), tax: { rate: rate('10') } },
    timestamp('2026-01-01T00:03:00.000Z'),
  );
  if (!line.ok) throw new Error('Expected line.');
  return line.value;
};

describe('invoice finalization', () => {
  it('calculates drafts through the Task 004 engine without payments', () => {
    const draft = finalizableDraft();
    const input = toInvoiceCalculationInput(draft);
    expect(input).toMatchObject({ ok: true });
    if (!input.ok) throw new Error('Expected input.');
    expect('payments' in input.value).toBe(false);
    expect(calculateDraftInvoice(draft)).toEqual(calculateInvoice(input.value));
  });

  it('finalizes by authoritative recalculation and freezes the snapshot', () => {
    const draft = finalizableDraft();
    const finalized = finalizeInvoice(draft, {
      invoiceNumber: invoiceNumber(),
      finalizedAt: timestamp('2026-01-01T00:04:00.000Z'),
    });

    expect(finalized).toMatchObject({
      ok: true,
      value: {
        kind: 'finalized',
        invoiceNumber: 'INV-1001',
        updatedAt: '2026-01-01T00:04:00.000Z',
        finalizedAt: '2026-01-01T00:04:00.000Z',
        totals: { grandTotal: { minorUnits: 11000n } },
        lines: [
          {
            id: 'line-1',
            grossAmount: { minorUnits: 10000n },
            taxableBase: { minorUnits: 10000n },
            taxAmount: { minorUnits: 1000n },
            totalAmount: { minorUnits: 11000n },
          },
        ],
      },
    });
    if (!finalized.ok) throw new Error('Expected finalized.');
    expect(Object.isFrozen(finalized.value)).toBe(true);
    expect(Object.isFrozen(finalized.value.lines)).toBe(true);
    expect(Object.isFrozen(finalized.value.lines[0])).toBe(true);
    expect(draft.kind).toBe('draft');
  });

  it('rejects missing required fields, bad dates, empty lines, and calculation errors', () => {
    const empty = createDraftInvoice({
      id: invoiceId('invoice-empty'),
      currency: USD,
      createdAt: timestamp('2026-01-01T00:00:00.000Z'),
      updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
    });
    if (!empty.ok) throw new Error('Expected empty.');
    expect(
      finalizeInvoice(empty.value, {
        invoiceNumber: invoiceNumber(),
        finalizedAt: timestamp('2026-01-01T00:01:00.000Z'),
      }),
    ).toMatchObject({ ok: false, error: { code: 'missing_required_field' } });

    const draft = finalizableDraft();
    expect(
      setDraftInvoiceDates(
        draft,
        { dueDate: '2026-01-01' as never },
        timestamp('2026-01-01T00:04:00.000Z'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice' } });

    const missingDueDate = setDraftInvoiceDates(
      draft,
      { dueDate: undefined },
      timestamp('2026-01-01T00:04:00.000Z'),
    );
    if (!missingDueDate.ok) throw new Error('Expected date clear.');
    expect(
      finalizeInvoice(missingDueDate.value, {
        invoiceNumber: invoiceNumber(),
        finalizedAt: timestamp('2026-01-01T00:05:00.000Z'),
      }),
    ).toMatchObject({ ok: false, error: { code: 'missing_required_field' } });

    expect(
      finalizeInvoice(draft, {
        invoiceNumber: invoiceNumber(),
        finalizedAt: timestamp('2025-12-31T00:00:00.000Z'),
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice' } });
  });
});
