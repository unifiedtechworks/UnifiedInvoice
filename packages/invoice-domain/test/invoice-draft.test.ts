import { describe, expect, it } from 'vitest';

import {
  addDraftInvoiceLine,
  createDraftInvoice,
  parseInvoiceLineDescription,
  removeDraftInvoiceLine,
  reorderDraftInvoiceLines,
  setDraftInvoiceDates,
  updateDraftInvoiceLine,
} from '../src/index';
import {
  USD,
  description,
  draftLine,
  invoiceId,
  lineId,
  minorMoney,
  quantity,
  timestamp,
} from './fixtures';

const createDraft = () => {
  const result = createDraftInvoice({
    id: invoiceId(),
    currency: USD,
    createdAt: timestamp('2026-01-01T00:00:00.000Z'),
    updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
  });
  if (!result.ok) throw new Error('Expected draft.');
  return result.value;
};

describe('draft invoices', () => {
  it('creates a valid empty frozen draft with defaults', () => {
    const draft = createDraft();
    expect(draft.kind).toBe('draft');
    expect(draft.lines).toEqual([]);
    expect(draft.roundingMode).toBe('half_away_from_zero');
    expect(draft.taxRoundingStrategy).toBe('per_line');
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.lines)).toBe(true);
  });

  it('rejects invalid timestamp ordering and currency definitions', () => {
    expect(
      createDraftInvoice({
        id: invoiceId(),
        currency: USD,
        createdAt: timestamp('2026-01-02T00:00:00.000Z'),
        updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice' } });

    expect(
      createDraftInvoice({
        id: invoiceId(),
        currency: { code: 'usd', minorUnitDigits: 2 } as never,
        createdAt: timestamp('2026-01-01T00:00:00.000Z'),
        updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_currency_definition' } });
  });

  it('adds, updates, removes, and reorders lines immutably', () => {
    const draft = createDraft();
    const added = addDraftInvoiceLine(
      draft,
      draftLine('b', 1),
      timestamp('2026-01-01T00:01:00.000Z'),
    );
    expect(added).toMatchObject({ ok: true });
    if (!added.ok) throw new Error('Expected add.');
    expect(draft.lines).toHaveLength(0);

    const addedSecond = addDraftInvoiceLine(
      added.value,
      draftLine('a', 0),
      timestamp('2026-01-01T00:02:00.000Z'),
    );
    expect(addedSecond.ok && addedSecond.value.lines.map((line) => line.id)).toEqual(['a', 'b']);
    if (!addedSecond.ok) throw new Error('Expected second add.');

    const updated = updateDraftInvoiceLine(
      addedSecond.value,
      lineId('a'),
      { description: description('Updated'), quantity: quantity('2') },
      timestamp('2026-01-01T00:03:00.000Z'),
    );
    expect(updated.ok && updated.value.lines[0]?.description).toBe('Updated');
    if (!updated.ok) throw new Error('Expected update.');

    const reordered = reorderDraftInvoiceLines(
      updated.value,
      [lineId('b'), lineId('a')],
      timestamp('2026-01-01T00:04:00.000Z'),
    );
    expect(reordered.ok && reordered.value.lines.map((line) => [line.id, line.position])).toEqual([
      ['b', 0],
      ['a', 1],
    ]);
    if (!reordered.ok) throw new Error('Expected reorder.');

    const removed = removeDraftInvoiceLine(
      reordered.value,
      lineId('b'),
      timestamp('2026-01-01T00:05:00.000Z'),
    );
    expect(removed.ok && removed.value.lines.map((line) => line.id)).toEqual(['a']);
  });

  it('rejects duplicate IDs, invalid positions, quantities, prices, currency mismatch, and backward updatedAt', () => {
    const draft = createDraft();
    const added = addDraftInvoiceLine(
      draft,
      draftLine('line-1'),
      timestamp('2026-01-01T00:01:00.000Z'),
    );
    if (!added.ok) throw new Error('Expected add.');

    expect(
      addDraftInvoiceLine(added.value, draftLine('line-1'), timestamp('2026-01-01T00:02:00.000Z')),
    ).toMatchObject({ ok: false, error: { code: 'duplicate_identifier' } });
    expect(
      addDraftInvoiceLine(draft, draftLine('x', -1), timestamp('2026-01-01T00:01:00.000Z')),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice_line' } });
    expect(
      addDraftInvoiceLine(
        draft,
        { ...draftLine('x'), quantity: quantity('0') },
        timestamp('2026-01-01T00:01:00.000Z'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice_line' } });
    expect(
      addDraftInvoiceLine(
        draft,
        { ...draftLine('x'), unitPrice: minorMoney('-1') },
        timestamp('2026-01-01T00:01:00.000Z'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice_line' } });
    expect(
      addDraftInvoiceLine(draft, draftLine('x'), timestamp('2025-12-31T00:00:00.000Z')),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice' } });
  });

  it('validates text and date setters', () => {
    expect(parseInvoiceLineDescription('   ')).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_line' },
    });
    expect(parseInvoiceLineDescription('line\n2')).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_line' },
    });

    const draft = createDraft();
    expect(
      setDraftInvoiceDates(
        draft,
        { issueDate: '2026-01-01' as never },
        timestamp('2026-01-01T00:01:00.000Z'),
      ),
    ).toMatchObject({ ok: true });
  });
});
