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

describe('DynamoDB invoice repository factory and draft behavior', () => {
  it('validates configuration and keeps list deferred', async () => {
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

    await expect(repositoryFixture().repository.list()).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'repository_unavailable',
        message: 'list is not implemented in @invoice/invoice-repository-dynamodb until Task 011C.',
      },
    });
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
