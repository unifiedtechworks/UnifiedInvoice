import { describe, expect, it } from 'vitest';

import {
  assertInvoiceId,
  assertInvoiceLineItemId,
  assertInvoiceNumber,
  assertMoney,
  assertMonetaryInteger,
  assertQuantity,
  assertUtcTimestamp,
  USD_CURRENCY_DEFINITION,
} from '@invoice/domain';
import {
  addDraftInvoiceLine,
  createDraftInvoice,
  parseInvoiceLineDescription,
  serializeDraftInvoice,
  type DraftInvoice,
  type DraftInvoiceLine,
} from '@invoice/invoice-domain';
import { assertInvoiceRecordVersion, type StoredInvoiceRecord } from '@invoice/invoice-repository';

import { createInMemoryInvoiceRepository } from '../src/index';

const must = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(`Expected ok: ${JSON.stringify(result.error)}`);
  return result.value;
};

const invoiceId = (value = 'invoice-1') => assertInvoiceId(value);
const lineId = (value = 'line-1') => assertInvoiceLineItemId(value);
const timestamp = (value: string) => assertUtcTimestamp(value);
const version = (value: string) => assertInvoiceRecordVersion(value);

const draftLine = (id = 'line-1', position = 0): DraftInvoiceLine =>
  Object.freeze({
    id: lineId(id),
    position,
    description: must(parseInvoiceLineDescription('Consulting services')),
    quantity: assertQuantity('1'),
    unitPrice: assertMoney(USD_CURRENCY_DEFINITION.code, assertMonetaryInteger('1000')),
  });

const draftInvoice = (id = 'invoice-1', updatedAt = '2026-01-01T00:00:00.000Z') =>
  must(
    createDraftInvoice({
      id: invoiceId(id),
      currency: USD_CURRENCY_DEFINITION,
      createdAt: timestamp('2026-01-01T00:00:00.000Z'),
      updatedAt: timestamp(updatedAt),
    }),
  );

const draftWithLine = (id = 'invoice-1', updatedAt = '2026-01-01T00:01:00.000Z') =>
  must(addDraftInvoiceLine(draftInvoice(id), draftLine(), timestamp(updatedAt)));

const storedDraftRecord = (draft: DraftInvoice, recordVersion = 'v7'): StoredInvoiceRecord => {
  const serialized = serializeDraftInvoice(draft);
  return Object.freeze({
    id: draft.id,
    kind: 'draft',
    schemaVersion: serialized.schemaVersion,
    invoice: serialized,
    version: version(recordVersion),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    ...(draft.customer?.displayName === undefined
      ? {}
      : { customerDisplayName: draft.customer.displayName }),
    ...(draft.issueDate === undefined ? {} : { issueDate: draft.issueDate }),
    ...(draft.dueDate === undefined ? {} : { dueDate: draft.dueDate }),
  });
};

describe('createInMemoryInvoiceRepository draft behavior', () => {
  it('returns an object implementing repository methods', () => {
    const repository = createInMemoryInvoiceRepository();

    expect(repository).toMatchObject({
      createDraft: expect.any(Function),
      updateDraft: expect.any(Function),
      saveFinalized: expect.any(Function),
      saveVoided: expect.any(Function),
      getById: expect.any(Function),
      list: expect.any(Function),
      discardDraft: expect.any(Function),
    });
  });

  it('returns not-implemented repository errors for deferred methods', async () => {
    const repository = createInMemoryInvoiceRepository();
    const finalized = { kind: 'finalized' } as never;
    const voided = { kind: 'voided' } as never;

    const finalizedResult = await repository.saveFinalized(finalized, {
      expectedVersion: version('v1'),
    });
    const voidedResult = await repository.saveVoided(voided, { expectedVersion: version('v1') });
    const listResult = await repository.list();

    expect(finalizedResult).toMatchObject({
      ok: false,
      error: { code: 'repository_unavailable' },
    });
    expect(voidedResult).toMatchObject({ ok: false, error: { code: 'repository_unavailable' } });
    expect(listResult).toMatchObject({ ok: false, error: { code: 'repository_unavailable' } });
  });

  it('creates a draft, returns v1, and getById returns the created draft with the same version', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = draftInvoice();

    const created = await repository.createDraft(draft);
    expect(created).toMatchObject({ ok: true, value: { version: 'v1' } });
    if (!created.ok) throw new Error('expected create ok');
    expect(created.value.invoice).toEqual(draft);
    expect(created.value.invoice).not.toBe(draft);
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.value)).toBe(true);

    const found = await repository.getById(draft.id);
    expect(found).toEqual(created);
  });

  it('rejects duplicate draft IDs and unsafe non-draft casts', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = draftInvoice();
    await repository.createDraft(draft);

    const duplicate = await repository.createDraft(draft);
    expect(duplicate).toMatchObject({ ok: false, error: { code: 'invoice_already_exists' } });

    const invalid = await repository.createDraft({ ...draft, kind: 'finalized' } as never);
    expect(invalid).toMatchObject({ ok: false, error: { code: 'invalid_invoice_record' } });
  });

  it('does not mutate the input draft', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = draftWithLine();
    const before = serializeDraftInvoice(draft);

    await repository.createDraft(draft);

    expect(serializeDraftInvoice(draft)).toEqual(before);
  });

  it('updates an existing draft with optimistic concurrency and returns a new version', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = draftInvoice();
    const created = await repository.createDraft(draft);
    if (!created.ok) throw new Error('expected create ok');

    const updatedDraft = draftWithLine('invoice-1');
    const updated = await repository.updateDraft(updatedDraft, {
      expectedVersion: created.value.version,
    });

    expect(updated).toMatchObject({ ok: true, value: { version: 'v2' } });
    if (!updated.ok) throw new Error('expected update ok');
    expect(updated.value.invoice).toEqual(updatedDraft);

    const found = await repository.getById(updatedDraft.id);
    expect(found).toEqual(updated);
  });

  it('rejects stale, missing, and unsafe non-draft updates', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = draftInvoice();
    await repository.createDraft(draft);

    const stale = await repository.updateDraft(draftWithLine(), {
      expectedVersion: version('v999'),
    });
    const missing = await repository.updateDraft(draftInvoice('missing'), {
      expectedVersion: version('v1'),
    });
    const invalid = await repository.updateDraft({ ...draft, kind: 'finalized' } as never, {
      expectedVersion: version('v1'),
    });

    expect(stale).toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    expect(missing).toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
    expect(invalid).toMatchObject({ ok: false, error: { code: 'invalid_invoice_record' } });
  });

  it('discards drafts with expected version', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = draftInvoice();
    const created = await repository.createDraft(draft);
    if (!created.ok) throw new Error('expected create ok');

    const discarded = await repository.discardDraft(draft.id, {
      expectedVersion: created.value.version,
    });
    expect(discarded).toEqual({ ok: true, value: { id: draft.id } });

    const found = await repository.getById(draft.id);
    expect(found).toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
  });

  it('rejects stale and missing draft discards', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = draftInvoice();
    await repository.createDraft(draft);

    const stale = await repository.discardDraft(draft.id, { expectedVersion: version('v999') });
    const missing = await repository.discardDraft(invoiceId('missing'), {
      expectedVersion: version('v1'),
    });

    expect(stale).toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    expect(missing).toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
  });

  it('supports initial draft records and avoids generated version collisions', async () => {
    const seededDraft = draftInvoice('seeded');
    const repository = createInMemoryInvoiceRepository({
      initialRecords: [storedDraftRecord(seededDraft, 'v7')],
    });

    const found = await repository.getById(seededDraft.id);
    expect(found).toMatchObject({ ok: true, value: { version: 'v7', invoice: seededDraft } });

    const created = await repository.createDraft(draftInvoice('new-draft'));
    expect(created).toMatchObject({ ok: true, value: { version: 'v8' } });
  });

  it('rejects duplicate seed IDs and finalized or voided seeds', () => {
    const seededDraft = draftWithLine('seeded');
    const draftRecord = storedDraftRecord(seededDraft);
    const finalizedRecord: StoredInvoiceRecord = Object.freeze({
      id: seededDraft.id,
      kind: 'finalized',
      schemaVersion: draftRecord.schemaVersion,
      invoice: draftRecord.invoice,
      version: version('v1'),
      createdAt: seededDraft.createdAt,
      updatedAt: seededDraft.updatedAt,
      invoiceNumber: assertInvoiceNumber('INV-SEED'),
      finalizedAt: timestamp('2026-01-01T00:02:00.000Z'),
    });

    expect(() =>
      createInMemoryInvoiceRepository({ initialRecords: [draftRecord, draftRecord] }),
    ).toThrow('Duplicate initial invoice record ID');
    expect(() => createInMemoryInvoiceRepository({ initialRecords: [finalizedRecord] })).toThrow(
      'deferred to Task 008D',
    );
  });
});
