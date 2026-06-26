import { describe, expect, it } from 'vitest';

import { serializeMoney } from '@invoice/domain';

import {
  addDraftInvoiceLine,
  createDraftInvoice,
  finalizeInvoice,
  parseAddressLineText,
  parseAddressLocalityText,
  parseCountryCode,
  parseEmailSnapshotText,
  parseInvoiceNotes,
  parseInvoiceTermsText,
  parsePartyLegalName,
  parsePhoneSnapshotText,
  parsePostalCodeText,
  parseSerializedDraftInvoice,
  parseSerializedFinalizedInvoice,
  parseSerializedInvoice,
  parseSerializedVoidedInvoice,
  parseTaxIdentifierText,
  serializeDraftInvoice,
  serializeFinalizedInvoice,
  serializeInvoice,
  serializeVoidedInvoice,
  setDraftCalculationSettings,
  setDraftInvoiceDates,
  setDraftInvoiceDiscount,
  setDraftInvoiceParties,
  setDraftInvoiceText,
  voidInvoice,
  type DraftInvoice,
  type FinalizedInvoice,
} from '../src/index';
import {
  USD,
  description,
  draftLine,
  invoiceId,
  invoiceNumber,
  money,
  partyName,
  quantity,
  rate,
  timestamp,
  voidReason,
} from './fixtures';

const must = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(`Expected ok: ${JSON.stringify(result.error)}`);
  return result.value;
};

const text = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => must(result);

const fullParty = (name: string) =>
  Object.freeze({
    displayName: partyName(name),
    legalName: text(parsePartyLegalName(`${name} LLC`)),
    email: text(parseEmailSnapshotText(`${name.toLowerCase()}@example.com`)),
    phone: text(parsePhoneSnapshotText('+1 555 0100')),
    billingAddress: Object.freeze({
      line1: text(parseAddressLineText('123 Main St')),
      city: text(parseAddressLocalityText('Seattle')),
      postalCode: text(parsePostalCodeText('98101')),
      countryCode: text(parseCountryCode('US')),
    }),
    taxIdentifier: text(parseTaxIdentifierText('TAX-123')),
  });

const fullDraft = (): DraftInvoice => {
  let draft = must(
    createDraftInvoice({
      id: invoiceId('invoice-serialization'),
      currency: USD,
      createdAt: timestamp('2026-01-01T00:00:00.000Z'),
      updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
    }),
  );
  draft = must(
    setDraftInvoiceParties(
      draft,
      { business: fullParty('Seller'), customer: fullParty('Buyer') },
      timestamp('2026-01-01T00:01:00.000Z'),
    ),
  );
  draft = must(
    setDraftInvoiceDates(
      draft,
      { issueDate: '2026-01-02' as never, dueDate: '2026-02-01' as never },
      timestamp('2026-01-01T00:02:00.000Z'),
    ),
  );
  draft = must(
    setDraftInvoiceText(
      draft,
      {
        notes: text(parseInvoiceNotes('Unicode ✓\nSecond line')),
        terms: text(parseInvoiceTermsText('Net 30\nThank you')),
      },
      timestamp('2026-01-01T00:03:00.000Z'),
    ),
  );
  draft = must(
    setDraftCalculationSettings(
      draft,
      { roundingMode: 'half_to_even', taxRoundingStrategy: 'invoice_total' },
      timestamp('2026-01-01T00:04:00.000Z'),
    ),
  );
  draft = must(
    setDraftInvoiceDiscount(
      draft,
      { kind: 'percentage', rate: rate('5') },
      timestamp('2026-01-01T00:05:00.000Z'),
    ),
  );
  draft = must(
    addDraftInvoiceLine(
      draft,
      {
        ...draftLine('line-a', 5, '100.00'),
        discount: { kind: 'fixed', amount: money('10.00') },
        tax: { rate: rate('10') },
      },
      timestamp('2026-01-01T00:06:00.000Z'),
    ),
  );
  draft = must(
    addDraftInvoiceLine(
      draft,
      {
        ...draftLine('line-b', 5, '50.00'),
        description: description('Design services'),
        quantity: quantity('2'),
        discount: { kind: 'percentage', rate: rate('20') },
      },
      timestamp('2026-01-01T00:07:00.000Z'),
    ),
  );
  return draft;
};

const finalizedInvoice = (): FinalizedInvoice =>
  must(
    finalizeInvoice(fullDraft(), {
      invoiceNumber: invoiceNumber('INV-SER-1'),
      finalizedAt: timestamp('2026-01-01T00:08:00.000Z'),
    }),
  );

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const mutableJson = <T>(value: T): Record<string, unknown> =>
  json(value) as Record<string, unknown>;

const expectNoBigInt = (value: unknown): void => {
  expect(() => JSON.stringify(value)).not.toThrow();
  if (typeof value === 'object' && value !== null) {
    for (const nested of Array.isArray(value) ? value : Object.values(value))
      expectNoBigInt(nested);
  } else {
    expect(typeof value).not.toBe('bigint');
  }
};

describe('invoice aggregate serialization', () => {
  it('round-trips minimal and full drafts through canonical JSON', () => {
    const minimal = must(
      createDraftInvoice({
        id: invoiceId('min'),
        currency: USD,
        createdAt: timestamp('2026-01-01T00:00:00.000Z'),
        updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
      }),
    );
    for (const draft of [minimal, fullDraft()]) {
      const serialized = serializeDraftInvoice(draft);
      expect(Object.isFrozen(serialized)).toBe(true);
      expect(Object.isFrozen(serialized.lines)).toBe(true);
      expectNoBigInt(serialized);
      const parsed = parseSerializedDraftInvoice(json(serialized));
      expect(parsed).toMatchObject({ ok: true });
      if (!parsed.ok) throw new Error('expected parsed draft');
      expect(serializeDraftInvoice(parsed.value)).toEqual(serialized);
      expect(Object.isFrozen(parsed.value)).toBe(true);
      expect(Object.isFrozen(parsed.value.lines)).toBe(true);
    }
  });

  it('round-trips finalized and voided invoices without recalculating stored values', () => {
    const finalized = finalizedInvoice();
    const serialized = serializeFinalizedInvoice(finalized);
    const parsed = must(parseSerializedFinalizedInvoice(json(serialized)));
    expect(serializeFinalizedInvoice(parsed)).toEqual(serialized);
    expect(parsed.calculationMetadata.calculationVersion).toBe('1');
    expect(Object.isFrozen(parsed.lines[0])).toBe(true);

    const voided = must(
      voidInvoice(finalized, {
        voidedAt: timestamp('2026-01-02T00:00:00.000Z'),
        reason: voidReason('Customer requested cancellation'),
      }),
    );
    const serializedVoided = serializeVoidedInvoice(voided);
    expect('schemaVersion' in serializedVoided.finalized).toBe(false);
    const parsedVoided = must(parseSerializedVoidedInvoice(json(serializedVoided)));
    expect(serializeVoidedInvoice(parsedVoided)).toEqual(serializedVoided);
    expect(parsedVoided.finalized.totals.grandTotal).toEqual(finalized.totals.grandTotal);
  });

  it('dispatches generic parse/serialize by lifecycle kind', () => {
    const draft = fullDraft();
    const finalized = finalizedInvoice();
    const voided = must(
      voidInvoice(finalized, {
        voidedAt: timestamp('2026-01-02T00:00:00.000Z'),
        reason: voidReason(),
      }),
    );
    for (const invoice of [draft, finalized, voided]) {
      const parsed = must(parseSerializedInvoice(json(serializeInvoice(invoice))));
      expect(parsed.kind).toBe(invoice.kind);
    }
  });

  it('rejects schema, lifecycle, strict-shape, and primitive errors with paths', () => {
    const draft = serializeDraftInvoice(fullDraft());
    expect(parseSerializedInvoice({ ...draft, schemaVersion: '1' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice', path: 'schemaVersion' },
    });
    expect(parseSerializedInvoice({ ...draft, schemaVersion: 2 })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice', path: 'schemaVersion' },
    });
    expect(parseSerializedInvoice({ ...draft, kind: 'sent' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice', path: 'kind' },
    });
    expect(parseSerializedDraftInvoice({ ...draft, extra: true })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice' },
    });
    expect(
      parseSerializedDraftInvoice({
        ...draft,
        lines: [{ ...draft.lines[0], unitPrice: { currency: 'USD', minorUnits: '01' } }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_money', path: 'lines.0.unitPrice' } });
    expect(
      parseSerializedFinalizedInvoice({
        ...serializeFinalizedInvoice(finalizedInvoice()),
        kind: 'draft',
      }),
    ).toMatchObject({ ok: false, error: { path: 'kind' } });
  });

  it('rejects draft cross-field failures and preserves line order/duplicate positions', () => {
    const draft = serializeDraftInvoice(fullDraft());
    expect(draft.lines.map((line) => line.id)).toEqual(['line-a', 'line-b']);
    expect(draft.lines.map((line) => line.position)).toEqual([5, 5]);
    expect(parseSerializedDraftInvoice({ ...draft, dueDate: '2026-01-01' })).toMatchObject({
      ok: false,
      error: { path: 'dueDate' },
    });
    expect(
      parseSerializedDraftInvoice({ ...draft, updatedAt: '2025-01-01T00:00:00.000Z' }),
    ).toMatchObject({ ok: false, error: { path: 'updatedAt' } });
    const [firstLine, secondLine] = draft.lines;
    if (firstLine === undefined || secondLine === undefined) throw new Error('Expected two lines.');
    expect(
      parseSerializedDraftInvoice({
        ...draft,
        lines: [firstLine, { ...secondLine, id: firstLine.id }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'duplicate_identifier' } });
  });

  it('rejects finalized integrity failures and unsupported calculation versions', () => {
    const serialized = serializeFinalizedInvoice(finalizedInvoice());
    const badLine = mutableJson(serialized);
    const badLineLines = badLine.lines as Record<string, unknown>[];
    badLine.lines = [
      { ...badLineLines[0], totalAmount: serializeMoney(money('999.99')) },
      ...badLineLines.slice(1),
    ];
    expect(parseSerializedFinalizedInvoice(badLine)).toMatchObject({
      ok: false,
      error: { code: 'invariant_violation', path: 'lines.0.totalAmount' },
    });

    const badTotal = mutableJson(serialized);
    (badTotal.totals as Record<string, unknown>).grandTotal = serializeMoney(money('1.00'));
    expect(parseSerializedFinalizedInvoice(badTotal)).toMatchObject({
      ok: false,
      error: { code: 'invariant_violation', path: 'totals.grandTotal' },
    });

    const badVersion = mutableJson(serialized);
    (badVersion.calculationMetadata as Record<string, unknown>).calculationVersion = '2';
    expect(parseSerializedFinalizedInvoice(badVersion)).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_invoice_calculation',
        path: 'calculationMetadata.calculationVersion',
      },
    });

    const fixedMismatch = mutableJson(serialized);
    const fixedMismatchLines = fixedMismatch.lines as Record<string, unknown>[];
    fixedMismatchLines[0] = {
      ...fixedMismatchLines[0],
      lineDiscountAmount: serializeMoney(money('9.00')),
    };
    expect(parseSerializedFinalizedInvoice(fixedMismatch)).toMatchObject({
      ok: false,
      error: { code: 'invariant_violation' },
    });
  });

  it('rejects nested voided finalized schemaVersion and invalid void timestamp', () => {
    const finalized = finalizedInvoice();
    const voided = serializeVoidedInvoice(
      must(
        voidInvoice(finalized, {
          voidedAt: timestamp('2026-01-02T00:00:00.000Z'),
          reason: voidReason(),
        }),
      ),
    );
    expect(
      parseSerializedVoidedInvoice({
        ...voided,
        finalized: { ...voided.finalized, schemaVersion: 1 },
      }),
    ).toMatchObject({ ok: false, error: { path: 'finalized.schemaVersion' } });
    expect(
      parseSerializedVoidedInvoice({ ...voided, voidedAt: '2025-01-01T00:00:00.000Z' }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_state_transition', path: 'voidedAt' } });
  });
});
