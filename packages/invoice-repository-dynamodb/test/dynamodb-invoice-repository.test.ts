import { describe, expect, it } from 'vitest';

import { createDynamoDbInvoiceRepository } from '../src';
import { FakeDynamoDbDocumentClient } from './fake-document-client';
import {
  draftInvoice,
  finalizableDraft,
  finalizedInvoice,
  invoiceId,
  version,
  voidedInvoice,
} from './fixtures';

const repositoryFixture = (ownerId = 'owner-a', fake = new FakeDynamoDbDocumentClient()) => {
  let nextVersion = 0;
  const repository = createDynamoDbInvoiceRepository({
    tableNames: { invoicesTableName: 'invoices-test' },
    ownerId,
    client: fake.asClient(),
    generateVersion: () => version(`v${++nextVersion}`),
  });
  return { repository, fake };
};

const must = <T>(result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>): T => {
  if (!result.ok) throw new Error('Expected repository success.');
  return result.value;
};

const reverseObjectKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, nested]) => [key, reverseObjectKeys(nested)]),
  );
};

const seedListRecords = async (repository: ReturnType<typeof repositoryFixture>['repository']) => {
  await repository.createDraft(draftInvoice('list-draft'));

  const finalizedDraft = finalizableDraft('list-finalized');
  const finalizedCreated = must(await repository.createDraft(finalizedDraft));
  await repository.saveFinalized(finalizedInvoice('list-finalized', 'INV-1002'), {
    expectedVersion: finalizedCreated.version,
  });

  const voidedDraft = finalizableDraft('list-voided');
  const voidedCreated = must(await repository.createDraft(voidedDraft));
  const finalizedForVoid = finalizedInvoice('list-voided', 'INV-1001');
  const finalizedSaved = must(
    await repository.saveFinalized(finalizedForVoid, {
      expectedVersion: voidedCreated.version,
    }),
  );
  await repository.saveVoided(voidedInvoice(finalizedForVoid), {
    expectedVersion: finalizedSaved.version,
  });
};

const listedIds = async (
  repository: ReturnType<typeof repositoryFixture>['repository'],
  query?: Parameters<ReturnType<typeof repositoryFixture>['repository']['list']>[0],
) => {
  const result = must(await repository.list(query));
  return result.items.map((item) => String(item.id));
};

describe('DynamoDB invoice repository factory and draft behavior', () => {
  it('validates configuration', () => {
    const fake = new FakeDynamoDbDocumentClient();
    expect(() =>
      createDynamoDbInvoiceRepository({
        tableNames: { invoicesTableName: '' },
        ownerId: 'owner-a',
        client: fake.asClient(),
      }),
    ).toThrow('invoicesTableName must be a non-empty string');
    expect(() =>
      createDynamoDbInvoiceRepository({
        tableNames: { invoicesTableName: 'table' },
        ownerId: ' ',
        client: fake.asClient(),
      }),
    ).toThrow('ownerId must be a non-empty string');
    expect(() =>
      createDynamoDbInvoiceRepository({
        tableNames: { invoicesTableName: 'table' },
        ownerId: 'owner-a',
        client: {} as never,
      }),
    ).toThrow('client must be a DynamoDBDocumentClient');
  });

  it('rejects invalid generated versions before writing', async () => {
    const fake = new FakeDynamoDbDocumentClient();
    const repository = createDynamoDbInvoiceRepository({
      tableNames: { invoicesTableName: 'invoices-test' },
      ownerId: 'owner-a',
      client: fake.asClient(),
      generateVersion: () => 'bad version' as never,
    });
    await expect(repository.createDraft(draftInvoice())).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_record_version' },
    });
    expect(fake.getItem('OWNER#owner-a', 'INVOICE#invoice-1')).toBeUndefined();
  });

  it('creates, reads, updates, and discards drafts with optimistic concurrency', async () => {
    const { repository } = repositoryFixture();
    const draft = draftInvoice();
    const created = must(await repository.createDraft(draft));
    expect(created).toMatchObject({ invoice: draft, version: 'v1' });
    await expect(repository.createDraft(draft)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invoice_already_exists' },
    });
    await expect(repository.getById(draft.id)).resolves.toMatchObject({ ok: true, value: created });

    const updatedDraft = { ...draft, updatedAt: '2026-01-01T00:01:00.000Z' } as typeof draft;
    const updated = must(
      await repository.updateDraft(updatedDraft, { expectedVersion: created.version }),
    );
    expect(updated).toMatchObject({ invoice: updatedDraft, version: 'v3' });
    await expect(
      repository.updateDraft(updatedDraft, { expectedVersion: created.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.discardDraft(draft.id, { expectedVersion: created.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.discardDraft(draft.id, { expectedVersion: updated.version }),
    ).resolves.toEqual({ ok: true, value: { id: draft.id } });
    await expect(repository.getById(draft.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invoice_not_found' },
    });
  });

  it('rejects unsafe draft inputs and missing updates/discards', async () => {
    const { repository } = repositoryFixture();
    const draft = draftInvoice();
    await expect(
      repository.createDraft({ ...draft, kind: 'finalized' } as never),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_record' },
    });
    await expect(
      repository.updateDraft(draft, { expectedVersion: version('v1') }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
    await expect(
      repository.discardDraft(draft.id, { expectedVersion: version('v1') }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
  });

  it('isolates records by owner partition', async () => {
    const fake = new FakeDynamoDbDocumentClient();
    const first = repositoryFixture('owner-a', fake).repository;
    const second = repositoryFixture('owner-b', fake).repository;
    const draft = draftInvoice();
    await first.createDraft(draft);
    await expect(second.getById(draft.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invoice_not_found' },
    });
    await expect(first.getById(draft.id)).resolves.toMatchObject({ ok: true });
  });
});

describe('DynamoDB invoice repository finalized and voided behavior', () => {
  it('atomically finalizes a draft and reserves its invoice number', async () => {
    const { repository, fake } = repositoryFixture();
    const draft = finalizableDraft();
    const created = must(await repository.createDraft(draft));
    const finalized = finalizedInvoice();
    const saved = must(
      await repository.saveFinalized(finalized, { expectedVersion: created.version }),
    );
    expect(saved).toMatchObject({ invoice: finalized, version: 'v2' });
    expect(fake.getItem('OWNER#owner-a', 'INVOICE_NUMBER#INV-1001')).toMatchObject({
      invoiceId: 'invoice-1',
    });
    await expect(repository.getById(finalized.id)).resolves.toMatchObject({
      ok: true,
      value: saved,
    });
    await expect(
      repository.updateDraft(draft, { expectedVersion: saved.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.discardDraft(draft.id, { expectedVersion: saved.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
  });

  it('enforces finalized conflicts, uniqueness, and idempotency', async () => {
    const { repository } = repositoryFixture();
    const firstDraft = finalizableDraft('invoice-1');
    const secondDraft = finalizableDraft('invoice-2');
    const firstCreated = must(await repository.createDraft(firstDraft));
    const secondCreated = must(await repository.createDraft(secondDraft));
    const finalized = finalizedInvoice('invoice-1', 'INV-SHARED');
    await expect(
      repository.saveFinalized(finalized, { expectedVersion: version('stale') }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    const saved = must(
      await repository.saveFinalized(finalized, { expectedVersion: firstCreated.version }),
    );
    await expect(
      repository.saveFinalized(finalizedInvoice('invoice-2', 'INV-SHARED'), {
        expectedVersion: secondCreated.version,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_number_conflict' } });
    await expect(
      repository.saveFinalized(finalized, { expectedVersion: saved.version }),
    ).resolves.toEqual({ ok: true, value: saved });
    await expect(
      repository.saveFinalized(finalizedInvoice('invoice-1', 'INV-DIFFERENT'), {
        expectedVersion: saved.version,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.saveFinalized(finalizedInvoice('missing'), { expectedVersion: version('v1') }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
  });

  it('voids finalized invoices while preserving reservations and idempotency', async () => {
    const { repository, fake } = repositoryFixture();
    const draft = finalizableDraft();
    const created = must(await repository.createDraft(draft));
    const finalized = finalizedInvoice();
    const finalizedSaved = must(
      await repository.saveFinalized(finalized, { expectedVersion: created.version }),
    );
    const voided = voidedInvoice(finalized);
    await expect(
      repository.saveVoided(voided, { expectedVersion: version('stale') }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    const voidedSaved = must(
      await repository.saveVoided(voided, { expectedVersion: finalizedSaved.version }),
    );
    expect(voidedSaved).toMatchObject({ invoice: voided, version: 'v3' });
    expect(fake.getItem('OWNER#owner-a', 'INVOICE_NUMBER#INV-1001')).toMatchObject({
      invoiceId: 'invoice-1',
    });
    await expect(
      repository.saveVoided(voided, { expectedVersion: voidedSaved.version }),
    ).resolves.toEqual({ ok: true, value: voidedSaved });
    const different = {
      ...voided,
      voidedAt: '2026-01-01T00:06:00.000Z',
    } as typeof voided;
    await expect(
      repository.saveVoided(different, { expectedVersion: voidedSaved.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.saveFinalized(finalized, { expectedVersion: voidedSaved.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
  });

  it('voids the finalized aggregate returned by getById with the current version', async () => {
    const { repository, fake } = repositoryFixture();
    const draft = finalizableDraft();
    const created = must(await repository.createDraft(draft));
    const finalizedSaved = must(
      await repository.saveFinalized(finalizedInvoice(), { expectedVersion: created.version }),
    );
    const stored = fake.getItem('OWNER#owner-a', 'INVOICE#invoice-1');
    if (stored === undefined) throw new Error('Expected stored finalized invoice.');
    fake.setItem({
      ...stored,
      record: {
        ...(stored.record as object),
        invoice: reverseObjectKeys((stored.record as { invoice: unknown }).invoice),
      },
    });
    const loadedFinalized = must(await repository.getById(draft.id));
    if (loadedFinalized.invoice.kind !== 'finalized')
      throw new Error('Expected finalized invoice.');

    const voided = voidedInvoice(loadedFinalized.invoice);
    const voidedSaved = must(
      await repository.saveVoided(voided, { expectedVersion: loadedFinalized.version }),
    );

    expect(loadedFinalized.version).toBe(finalizedSaved.version);
    expect(voidedSaved).toMatchObject({ invoice: voided, version: 'v3' });
    await expect(repository.getById(draft.id)).resolves.toMatchObject({
      ok: true,
      value: { invoice: { kind: 'voided' }, version: 'v3' },
    });
    expect(fake.getItem('OWNER#owner-a', 'INVOICE_NUMBER#INV-1001')).toMatchObject({
      invoiceId: 'invoice-1',
    });
  });

  it('rejects missing, stale, and draft void transitions', async () => {
    const { repository } = repositoryFixture();
    const draft = finalizableDraft();
    const created = must(await repository.createDraft(draft));
    const voided = voidedInvoice(finalizedInvoice());
    await expect(
      repository.saveVoided(voided, { expectedVersion: created.version }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_conflict' } });
    await expect(
      repository.saveVoided(voidedInvoice(finalizedInvoice('missing')), {
        expectedVersion: version('v1'),
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invoice_not_found' } });
  });

  it('requires the finalized invoice-number reservation before voiding', async () => {
    const { repository, fake } = repositoryFixture();
    const draft = finalizableDraft();
    const created = must(await repository.createDraft(draft));
    const finalized = finalizedInvoice();
    const saved = must(
      await repository.saveFinalized(finalized, { expectedVersion: created.version }),
    );
    fake.deleteItem('OWNER#owner-a', 'INVOICE_NUMBER#INV-1001');
    await expect(
      repository.saveVoided(voidedInvoice(finalized), { expectedVersion: saved.version }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'invoiceNumber' },
    });
  });
});

describe('DynamoDB invoice repository validation and AWS errors', () => {
  it('maps malformed stored records to repository validation errors', async () => {
    const { repository, fake } = repositoryFixture();
    const draft = draftInvoice();
    await repository.createDraft(draft);
    const item = fake.getItem('OWNER#owner-a', 'INVOICE#invoice-1');
    if (item === undefined) throw new Error('Expected stored item.');
    fake.setItem({ ...item, record: { ...(item.record as object), invoice: { kind: 'broken' } } });
    await expect(repository.getById(draft.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_record' },
    });
  });

  it('maps contradictory item metadata to repository invariant violations', async () => {
    const { repository, fake } = repositoryFixture();
    const draft = draftInvoice();
    await repository.createDraft(draft);
    const item = fake.getItem('OWNER#owner-a', 'INVOICE#invoice-1');
    if (item === undefined) throw new Error('Expected stored item.');
    fake.setItem({ ...item, updatedAt: '2026-12-31T00:00:00.000Z' });
    await expect(repository.getById(draft.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'updatedAt' },
    });
  });

  it('maps unknown client failures to repository_unavailable', async () => {
    const { repository, fake } = repositoryFixture();
    fake.failNext(Object.assign(new Error('network unavailable'), { name: 'NetworkingError' }));
    await expect(repository.getById(invoiceId('invoice-1'))).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_unavailable', detail: 'NetworkingError' },
    });
  });

  it('does not misclassify unexplained transaction cancellations as invoice conflicts', async () => {
    const { repository, fake } = repositoryFixture();
    const draft = finalizableDraft();
    const created = must(await repository.createDraft(draft));
    fake.failNextCommand(
      'TransactWriteCommand',
      Object.assign(new Error('transaction unavailable'), { name: 'TransactionCanceledException' }),
    );
    await expect(
      repository.saveFinalized(finalizedInvoice(), { expectedVersion: created.version }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_unavailable', detail: 'TransactionCanceledException' },
    });
  });
});

describe('DynamoDB invoice repository list behavior', () => {
  it('returns an immutable empty list and follows internal DynamoDB pages', async () => {
    const empty = must(await repositoryFixture().repository.list());
    expect(empty).toEqual({ items: [] });
    expect(Object.isFrozen(empty)).toBe(true);
    expect(Object.isFrozen(empty.items)).toBe(true);

    const { repository } = repositoryFixture('owner-a', new FakeDynamoDbDocumentClient(1));
    await seedListRecords(repository);
    await expect(listedIds(repository)).resolves.toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
  });

  it('lists only the repository owner and excludes number reservations', async () => {
    const fake = new FakeDynamoDbDocumentClient();
    const ownerA = repositoryFixture('owner-a', fake).repository;
    const ownerB = repositoryFixture('owner-b', fake).repository;
    await seedListRecords(ownerA);
    await ownerB.createDraft(draftInvoice('owner-b-draft'));

    await expect(listedIds(ownerA)).resolves.toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
    await expect(listedIds(ownerB)).resolves.toEqual(['owner-b-draft']);
  });

  it('filters every supported lifecycle kind', async () => {
    const { repository } = repositoryFixture();
    await seedListRecords(repository);
    await expect(listedIds(repository, { kind: 'draft' })).resolves.toEqual(['list-draft']);
    await expect(listedIds(repository, { kind: 'finalized' })).resolves.toEqual(['list-finalized']);
    await expect(listedIds(repository, { kind: 'voided' })).resolves.toEqual(['list-voided']);
  });

  it('searches invoice numbers and customer names simply and case-insensitively', async () => {
    const { repository } = repositoryFixture();
    await seedListRecords(repository);
    await expect(listedIds(repository, { search: 'INV-1002' })).resolves.toEqual([
      'list-finalized',
    ]);
    await expect(listedIds(repository, { search: '100' })).resolves.toEqual([
      'list-voided',
      'list-finalized',
    ]);
    await expect(listedIds(repository, { search: 'Buyer list-finalized' })).resolves.toEqual([
      'list-finalized',
    ]);
    await expect(listedIds(repository, { search: 'VoIdEd' })).resolves.toEqual(['list-voided']);
    await expect(listedIds(repository, { search: '   ' })).resolves.toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
    await expect(listedIds(repository, { search: 'unrelated' })).resolves.toEqual([]);
  });

  it('sorts supported fields and keeps missing optional values last', async () => {
    const { repository } = repositoryFixture();
    await seedListRecords(repository);
    await expect(
      listedIds(repository, { sortBy: 'updatedAt', sortDirection: 'asc' }),
    ).resolves.toEqual(['list-draft', 'list-finalized', 'list-voided']);
    await expect(
      listedIds(repository, { sortBy: 'updatedAt', sortDirection: 'desc' }),
    ).resolves.toEqual(['list-voided', 'list-finalized', 'list-draft']);
    await expect(
      listedIds(repository, { sortBy: 'createdAt', sortDirection: 'asc' }),
    ).resolves.toEqual(['list-draft', 'list-finalized', 'list-voided']);
    await expect(
      listedIds(repository, { sortBy: 'issueDate', sortDirection: 'asc' }),
    ).resolves.toEqual(['list-finalized', 'list-voided', 'list-draft']);
    await expect(
      listedIds(repository, { sortBy: 'invoiceNumber', sortDirection: 'asc' }),
    ).resolves.toEqual(['list-voided', 'list-finalized', 'list-draft']);
    await expect(
      listedIds(repository, { sortBy: 'invoiceNumber', sortDirection: 'desc' }),
    ).resolves.toEqual(['list-finalized', 'list-voided', 'list-draft']);
  });

  it('uses invoice ID as deterministic tie-breaker', async () => {
    const { repository } = repositoryFixture();
    await repository.createDraft(draftInvoice('tie-b'));
    await repository.createDraft(draftInvoice('tie-a'));
    await expect(
      listedIds(repository, { sortBy: 'updatedAt', sortDirection: 'desc' }),
    ).resolves.toEqual(['tie-a', 'tie-b']);
  });

  it('paginates with offset cursors and handles offsets beyond results', async () => {
    const { repository } = repositoryFixture();
    await seedListRecords(repository);
    const first = must(await repository.list({ pageSize: 2 }));
    expect(first.items.map((item) => String(item.id))).toEqual(['list-voided', 'list-finalized']);
    expect(first.nextCursor).toBe('offset:2');
    if (first.nextCursor === undefined) throw new Error('Expected next cursor.');
    const second = must(await repository.list({ pageSize: 2, cursor: first.nextCursor }));
    expect(second.items.map((item) => String(item.id))).toEqual(['list-draft']);
    expect(second.nextCursor).toBeUndefined();
    expect(must(await repository.list({ cursor: 'offset:99' }))).toEqual({ items: [] });
  });

  it('validates cursors and page sizes', async () => {
    const { repository } = repositoryFixture();
    for (const cursor of ['bad-cursor', 'offset:-1', `offset:${Number.MAX_SAFE_INTEGER + 1}`]) {
      await expect(repository.list({ cursor })).resolves.toMatchObject({
        ok: false,
        error: { code: 'repository_invariant_violation', path: 'cursor' },
      });
    }
    for (const pageSize of [0, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(repository.list({ pageSize })).resolves.toMatchObject({
        ok: false,
        error: { code: 'repository_invariant_violation', path: 'pageSize' },
      });
    }
  });

  it('rejects corrupt queried items instead of leaking partial metadata', async () => {
    const { repository, fake } = repositoryFixture();
    await repository.createDraft(draftInvoice('corrupt'));
    const item = fake.getItem('OWNER#owner-a', 'INVOICE#corrupt');
    if (item === undefined) throw new Error('Expected stored item.');
    fake.setItem({ ...item, customerDisplayName: 'Contradictory metadata' });
    await expect(repository.list()).resolves.toMatchObject({
      ok: false,
      error: { code: 'repository_invariant_violation', path: 'customerDisplayName' },
    });
  });

  it('does not leak mutable list state', async () => {
    const { repository } = repositoryFixture();
    await seedListRecords(repository);
    const first = must(await repository.list());
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.items)).toBe(true);
    expect(Object.isFrozen(first.items[0])).toBe(true);
    expect(() => (first.items as unknown[]).push(first.items[0] as unknown)).toThrow(TypeError);
    expect(() => {
      (first.items[0] as { customerDisplayName?: string }).customerDisplayName = 'Mutated';
    }).toThrow(TypeError);
    await expect(listedIds(repository)).resolves.toEqual([
      'list-voided',
      'list-finalized',
      'list-draft',
    ]);
    await expect(repository.getById(invoiceId('list-voided'))).resolves.toMatchObject({
      ok: true,
      value: { invoice: { kind: 'voided' } },
    });
  });
});
