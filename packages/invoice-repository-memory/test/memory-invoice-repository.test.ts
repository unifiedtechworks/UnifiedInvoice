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
  finalizeInvoice,
  parseInvoiceLineDescription,
  parsePartyDisplayName,
  parseVoidReason,
  serializeDraftInvoice,
  serializeFinalizedInvoice,
  serializeVoidedInvoice,
  setDraftInvoiceDates,
  setDraftInvoiceParties,
  voidInvoice,
  type DraftInvoice,
  type DraftInvoiceLine,
  type FinalizedInvoice,
  type PartySnapshot,
  type VoidedInvoice,
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
const party = (displayName: string): PartySnapshot => {
  const parsed = parsePartyDisplayName(displayName);
  if (!parsed.ok) throw new Error(`Expected party name: ${displayName}`);
  return Object.freeze({ displayName: parsed.value });
};

const draftLine = (id = 'line-1', position = 0): DraftInvoiceLine =>
  Object.freeze({
    id: lineId(id),
    position,
    description: must(parseInvoiceLineDescription('Consulting services')),
    quantity: assertQuantity('1'),
    unitPrice: assertMoney(USD_CURRENCY_DEFINITION.code, assertMonetaryInteger('1000')),
  });

const draftInvoice = (
  id = 'invoice-1',
  updatedAt = '2026-01-01T00:00:00.000Z',
  createdAt = '2026-01-01T00:00:00.000Z',
) =>
  must(
    createDraftInvoice({
      id: invoiceId(id),
      currency: USD_CURRENCY_DEFINITION,
      createdAt: timestamp(createdAt),
      updatedAt: timestamp(updatedAt),
    }),
  );

const draftWithLine = (id = 'invoice-1', updatedAt = '2026-01-01T00:01:00.000Z') =>
  must(addDraftInvoiceLine(draftInvoice(id), draftLine(), timestamp(updatedAt)));

const finalizableDraft = (
  id = 'invoice-1',
  options: Readonly<{
    customerDisplayName?: string;
    issueDate?: string;
    dueDate?: string;
    createdAt?: string;
  }> = {},
) => {
  const parties = must(
    setDraftInvoiceParties(
      draftInvoice(id, options.createdAt, options.createdAt),
      { business: party('Seller'), customer: party(options.customerDisplayName ?? 'Buyer') },
      timestamp('2026-01-01T00:01:00.000Z'),
    ),
  );
  const dates = must(
    setDraftInvoiceDates(
      parties,
      {
        issueDate: (options.issueDate ?? '2026-01-02') as never,
        dueDate: (options.dueDate ?? '2026-02-01') as never,
      },
      timestamp('2026-01-01T00:02:00.000Z'),
    ),
  );
  return must(
    addDraftInvoiceLine(dates, draftLine(`line-${id}`), timestamp('2026-01-01T00:03:00.000Z')),
  );
};

const finalizedInvoice = (
  id = 'invoice-1',
  number = 'INV-1001',
  options: Parameters<typeof finalizableDraft>[1] & Readonly<{ finalizedAt?: string }> = {},
): FinalizedInvoice =>
  must(
    finalizeInvoice(finalizableDraft(id, options), {
      invoiceNumber: assertInvoiceNumber(number),
      finalizedAt: timestamp(options.finalizedAt ?? '2026-01-01T00:04:00.000Z'),
    }),
  );

const voidedInvoice = (
  invoice = finalizedInvoice(),
  voidedAt = '2026-01-02T00:00:00.000Z',
): VoidedInvoice =>
  must(
    voidInvoice(invoice, {
      voidedAt: timestamp(voidedAt),
      reason: must(parseVoidReason('Issued in error')),
    }),
  );

const storedFinalizedRecord = (
  invoice: FinalizedInvoice,
  recordVersion = 'v7',
): StoredInvoiceRecord => {
  const serialized = serializeFinalizedInvoice(invoice);
  return Object.freeze({
    id: invoice.id,
    kind: 'finalized',
    schemaVersion: serialized.schemaVersion,
    invoice: serialized,
    version: version(recordVersion),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    invoiceNumber: invoice.invoiceNumber,
    customerDisplayName: invoice.customer.displayName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    finalizedAt: invoice.finalizedAt,
  });
};

const storedVoidedRecord = (invoice: VoidedInvoice, recordVersion = 'v7'): StoredInvoiceRecord => {
  const serialized = serializeVoidedInvoice(invoice);
  return Object.freeze({
    id: invoice.finalized.id,
    kind: 'voided',
    schemaVersion: serialized.schemaVersion,
    invoice: serialized,
    version: version(recordVersion),
    createdAt: invoice.finalized.createdAt,
    updatedAt: invoice.voidedAt,
    invoiceNumber: invoice.finalized.invoiceNumber,
    customerDisplayName: invoice.finalized.customer.displayName,
    issueDate: invoice.finalized.issueDate,
    dueDate: invoice.finalized.dueDate,
    finalizedAt: invoice.finalized.finalizedAt,
    voidedAt: invoice.voidedAt,
  });
};

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

  it('rejects duplicate seed IDs', () => {
    const seededDraft = draftWithLine('seeded');
    const draftRecord = storedDraftRecord(seededDraft);

    expect(() =>
      createInMemoryInvoiceRepository({ initialRecords: [draftRecord, draftRecord] }),
    ).toThrow('Duplicate initial invoice record ID');
  });
});

describe('createInMemoryInvoiceRepository finalized and voided behavior', () => {
  it('replaces a draft with a finalized invoice and getById returns the finalized record', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = finalizableDraft();
    const created = await repository.createDraft(draft);
    if (!created.ok) throw new Error('expected draft create');
    const finalized = finalizedInvoice();

    const saved = await repository.saveFinalized(finalized, {
      expectedVersion: created.value.version,
    });

    expect(saved).toMatchObject({ ok: true, value: { version: 'v2', invoice: finalized } });
    const found = await repository.getById(finalized.id);
    expect(found).toEqual(saved);
  });

  it('enforces saveFinalized conflicts, idempotency, and invoice-number uniqueness', async () => {
    const repository = createInMemoryInvoiceRepository();
    const firstDraft = finalizableDraft('invoice-1');
    const secondDraft = finalizableDraft('invoice-2');
    const firstCreated = await repository.createDraft(firstDraft);
    const secondCreated = await repository.createDraft(secondDraft);
    if (!firstCreated.ok || !secondCreated.ok) throw new Error('expected creates');
    const finalized = finalizedInvoice('invoice-1', 'INV-1001');
    const saved = await repository.saveFinalized(finalized, {
      expectedVersion: firstCreated.value.version,
    });
    if (!saved.ok) throw new Error('expected finalized save');

    await expect(
      repository.updateDraft(firstDraft, { expectedVersion: saved.value.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.discardDraft(firstDraft.id, { expectedVersion: saved.value.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.saveFinalized(finalized, { expectedVersion: version('v999') }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.saveFinalized(finalizedInvoice('missing', 'INV-MISSING'), {
        expectedVersion: version('v1'),
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
    await expect(
      repository.saveFinalized({ ...firstDraft, kind: 'draft' } as never, {
        expectedVersion: saved.value.version,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invalid_invoice_record' } });

    const duplicateNumber = finalizedInvoice('invoice-2', 'INV-1001');
    await expect(
      repository.saveFinalized(duplicateNumber, { expectedVersion: secondCreated.value.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_number_conflict' } });

    const same = await repository.saveFinalized(finalized, {
      expectedVersion: saved.value.version,
    });
    expect(same).toEqual(saved);
    const different = {
      ...finalized,
      invoiceNumber: assertInvoiceNumber('INV-DIFFERENT'),
    } as FinalizedInvoice;
    await expect(
      repository.saveFinalized(different, { expectedVersion: saved.value.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
  });

  it('replaces a finalized invoice with a voided invoice and preserves totals', async () => {
    const finalized = finalizedInvoice();
    const repository = createInMemoryInvoiceRepository({
      initialRecords: [storedFinalizedRecord(finalized, 'v7')],
    });
    const voided = voidedInvoice(finalized);

    const saved = await repository.saveVoided(voided, { expectedVersion: version('v7') });

    expect(saved).toMatchObject({ ok: true, value: { version: 'v8', invoice: voided } });
    if (!saved.ok) throw new Error('expected voided save');
    expect((saved.value.invoice as VoidedInvoice).finalized.totals).toEqual(finalized.totals);
    const found = await repository.getById(finalized.id);
    expect(found).toEqual(saved);
  });

  it('enforces saveVoided conflicts, idempotency, and reserved invoice numbers', async () => {
    const finalized = finalizedInvoice('invoice-1', 'INV-VOID');
    const otherDraft = finalizableDraft('invoice-2');
    const repository = createInMemoryInvoiceRepository({
      initialRecords: [storedFinalizedRecord(finalized, 'v7')],
    });
    const voided = voidedInvoice(finalized);
    const saved = await repository.saveVoided(voided, { expectedVersion: version('v7') });
    if (!saved.ok) throw new Error('expected voided save');

    await expect(
      repository.saveVoided(voided, { expectedVersion: version('v7') }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.saveVoided(voidedInvoice(finalizedInvoice('missing', 'INV-MISS')), {
        expectedVersion: version('v1'),
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
    await expect(
      repository.saveVoided(finalized as never, { expectedVersion: saved.value.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invalid_invoice_record' } });
    const same = await repository.saveVoided(voided, { expectedVersion: saved.value.version });
    expect(same).toEqual(saved);
    const different = {
      ...voided,
      voidedAt: timestamp('2026-01-03T00:00:00.000Z'),
    } as VoidedInvoice;
    await expect(
      repository.saveVoided(different, { expectedVersion: saved.value.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.discardDraft(finalized.id, { expectedVersion: saved.value.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });

    const created = await repository.createDraft(otherDraft);
    if (!created.ok) throw new Error('expected second draft');
    await expect(
      repository.saveFinalized(finalizedInvoice('invoice-2', 'INV-VOID'), {
        expectedVersion: created.value.version,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_number_conflict' } });
  });

  it('rejects voiding drafts and unsafe void payloads', async () => {
    const repository = createInMemoryInvoiceRepository();
    const draft = finalizableDraft();
    const created = await repository.createDraft(draft);
    if (!created.ok) throw new Error('expected create');

    await expect(
      repository.saveVoided(voidedInvoice(finalizedInvoice()), {
        expectedVersion: created.value.version,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
  });

  it('supports finalized and voided seeds, rejects duplicate seed numbers, and advances versions', async () => {
    const finalized = finalizedInvoice('seed-finalized', 'INV-SEED-1');
    const voided = voidedInvoice(finalizedInvoice('seed-voided', 'INV-SEED-2'));
    const repository = createInMemoryInvoiceRepository({
      initialRecords: [storedFinalizedRecord(finalized, 'v7'), storedVoidedRecord(voided, 'v11')],
    });

    await expect(repository.getById(finalized.id)).resolves.toMatchObject({
      ok: true,
      value: { version: 'v7', invoice: finalized },
    });
    await expect(repository.getById(voided.finalized.id)).resolves.toMatchObject({
      ok: true,
      value: { version: 'v11', invoice: voided },
    });
    await expect(repository.createDraft(draftInvoice('new-after-seed'))).resolves.toMatchObject({
      ok: true,
      value: { version: 'v12' },
    });
    expect(() =>
      createInMemoryInvoiceRepository({
        initialRecords: [
          storedFinalizedRecord(finalized),
          storedVoidedRecord(voidedInvoice(finalized)),
        ],
      }),
    ).toThrow('Duplicate initial invoice record ID');
    expect(() =>
      createInMemoryInvoiceRepository({
        initialRecords: [
          storedFinalizedRecord(finalized),
          storedFinalizedRecord(finalizedInvoice('other-seed', 'INV-SEED-1')),
        ],
      }),
    ).toThrow('Duplicate initial invoice number');
  });
});

describe('createInMemoryInvoiceRepository list behavior', () => {
  const listFixtureRecords = () => {
    const draft = draftInvoice(
      'list-draft',
      '2026-01-01T00:05:00.000Z',
      '2026-01-01T00:00:00.000Z',
    );
    const finalized = finalizedInvoice('list-finalized', 'INV-1002', {
      customerDisplayName: 'Acme Industries',
      issueDate: '2026-01-04',
      dueDate: '2026-02-04',
      createdAt: '2026-01-01T00:00:45.000Z',
      finalizedAt: '2026-01-01T00:20:00.000Z',
    });
    const voided = voidedInvoice(
      finalizedInvoice('list-voided', 'INV-1001', {
        customerDisplayName: 'Beta Builders',
        issueDate: '2026-01-03',
        dueDate: '2026-02-03',
        createdAt: '2026-01-01T00:00:30.000Z',
        finalizedAt: '2026-01-01T00:15:00.000Z',
      }),
      '2026-01-01T00:30:00.000Z',
    );
    return [
      storedDraftRecord(draft, 'v1'),
      storedFinalizedRecord(finalized, 'v2'),
      storedVoidedRecord(voided, 'v3'),
    ] as const;
  };

  const listedIds = async (
    query?: Parameters<ReturnType<typeof createInMemoryInvoiceRepository>['list']>[0],
  ) => {
    const repository = createInMemoryInvoiceRepository({ initialRecords: listFixtureRecords() });
    const result = await repository.list(query);
    const value = must(result);
    return value.items.map((item) => String(item.id));
  };

  it('returns empty items with no next cursor for an empty repository', async () => {
    const result = must(await createInMemoryInvoiceRepository().list());

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items)).toBe(true);
  });

  it('lists draft, finalized, and voided records with updatedAt descending by default', async () => {
    await expect(listedIds()).resolves.toEqual(['list-voided', 'list-finalized', 'list-draft']);
  });

  it('filters by lifecycle kind', async () => {
    await expect(listedIds({ kind: 'draft' })).resolves.toEqual(['list-draft']);
    await expect(listedIds({ kind: 'finalized' })).resolves.toEqual(['list-finalized']);
    await expect(listedIds({ kind: 'voided' })).resolves.toEqual(['list-voided']);
  });

  it('searches invoice numbers and customer display names case-insensitively', async () => {
    await expect(listedIds({ search: 'INV-1002' })).resolves.toEqual(['list-finalized']);
    await expect(listedIds({ search: '100' })).resolves.toEqual(['list-voided', 'list-finalized']);
    await expect(listedIds({ search: 'Acme Industries' })).resolves.toEqual(['list-finalized']);
    await expect(listedIds({ search: 'build' })).resolves.toEqual(['list-voided']);
    await expect(listedIds({ search: 'aCmE' })).resolves.toEqual(['list-finalized']);
    await expect(listedIds({ search: '   ' })).resolves.toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
    await expect(listedIds({ search: 'unrelated' })).resolves.toEqual([]);
  });

  it('sorts by supported fields and keeps missing optional sort values last', async () => {
    await expect(listedIds({ sortBy: 'updatedAt', sortDirection: 'asc' })).resolves.toEqual([
      'list-draft',
      'list-finalized',
      'list-voided',
    ]);
    await expect(listedIds({ sortBy: 'updatedAt', sortDirection: 'desc' })).resolves.toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
    await expect(listedIds({ sortBy: 'createdAt', sortDirection: 'asc' })).resolves.toEqual([
      'list-draft',
      'list-voided',
      'list-finalized',
    ]);
    await expect(listedIds({ sortBy: 'issueDate', sortDirection: 'asc' })).resolves.toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
    await expect(listedIds({ sortBy: 'invoiceNumber', sortDirection: 'desc' })).resolves.toEqual([
      'list-finalized',
      'list-voided',
      'list-draft',
    ]);
  });

  it('uses deterministic tie-breaking by ID after primary sort values match', async () => {
    const first = draftInvoice('tie-b', '2026-01-01T00:00:00.000Z');
    const second = draftInvoice('tie-a', '2026-01-01T00:00:00.000Z');
    const repository = createInMemoryInvoiceRepository({
      initialRecords: [storedDraftRecord(first, 'v2'), storedDraftRecord(second, 'v1')],
    });

    const result = must(await repository.list({ sortBy: 'updatedAt', sortDirection: 'desc' }));

    expect(result.items.map((item) => String(item.id))).toEqual(['tie-a', 'tie-b']);
  });

  it('paginates with offset cursors and handles cursors beyond result length', async () => {
    const repository = createInMemoryInvoiceRepository({ initialRecords: listFixtureRecords() });
    const firstPage = must(await repository.list({ pageSize: 2 }));

    expect(firstPage.items.map((item) => String(item.id))).toEqual([
      'list-voided',
      'list-finalized',
    ]);
    expect(firstPage.nextCursor).toBe('offset:2');
    if (firstPage.nextCursor === undefined) throw new Error('expected next cursor');

    const secondPage = must(await repository.list({ pageSize: 2, cursor: firstPage.nextCursor }));
    expect(secondPage.items.map((item) => String(item.id))).toEqual(['list-draft']);
    expect(secondPage.nextCursor).toBeUndefined();

    const beyond = must(await repository.list({ cursor: 'offset:99' }));
    expect(beyond.items).toEqual([]);
    expect(beyond.nextCursor).toBeUndefined();
  });

  it('validates invalid cursors and page sizes', async () => {
    const repository = createInMemoryInvoiceRepository({ initialRecords: listFixtureRecords() });

    await expect(repository.list({ cursor: 'bad-cursor' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'cursor' },
    });
    await expect(repository.list({ cursor: 'offset:-1' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'cursor' },
    });
    await expect(repository.list({ pageSize: 0 })).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'pageSize' },
    });
    await expect(repository.list({ pageSize: 101 })).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'pageSize' },
    });
    await expect(repository.list({ pageSize: 1.5 })).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'pageSize' },
    });
  });

  it('returns frozen list items and arrays without leaking internal state', async () => {
    const repository = createInMemoryInvoiceRepository({ initialRecords: listFixtureRecords() });
    const firstList = must(await repository.list({ sortBy: 'updatedAt', sortDirection: 'desc' }));

    expect(Object.isFrozen(firstList.items)).toBe(true);
    expect(Object.isFrozen(firstList.items[0])).toBe(true);
    expect(() => (firstList.items as unknown[]).push(firstList.items[0] as unknown)).toThrow(
      TypeError,
    );
    expect(() => {
      (firstList.items[0] as { customerDisplayName?: string }).customerDisplayName = 'Mutated';
    }).toThrow(TypeError);

    const secondList = must(await repository.list({ sortBy: 'updatedAt', sortDirection: 'desc' }));
    expect(secondList.items.map((item) => String(item.id))).toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
    expect(secondList.items[0]?.customerDisplayName).toBe('Beta Builders');

    const found = must(await repository.getById(invoiceId('list-voided')));
    expect(found.invoice.kind).toBe('voided');
  });
});
