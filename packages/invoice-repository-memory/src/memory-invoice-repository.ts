import type { InvoiceId } from '@invoice/domain';
import {
  parseSerializedDraftInvoice,
  serializeDraftInvoice,
  type DraftInvoice,
  type FinalizedInvoice,
  type VoidedInvoice,
} from '@invoice/invoice-domain';
import {
  assertInvoiceRecordVersion,
  makeInvoiceRepositoryError,
  repoErr,
  repoOk,
  type DiscardDraftOptions,
  type DiscardDraftResult,
  type GetInvoiceResult,
  type InvoiceListQuery,
  type InvoiceListResult,
  type InvoiceRecordVersion,
  type InvoiceRepository,
  type InvoiceRepositoryResult,
  type SaveFinalizedInvoiceOptions,
  type SaveInvoiceResult,
  type SaveVoidedInvoiceOptions,
  type StoredInvoiceRecord,
  type UpdateInvoiceOptions,
} from '@invoice/invoice-repository';

export type InMemoryInvoiceRepositoryOptions = Readonly<{
  initialRecords?: readonly StoredInvoiceRecord[];
}>;

const notImplemented = (method: string, task: '008D' | '008E') =>
  repoErr(
    makeInvoiceRepositoryError(
      'repository_unavailable',
      `${method} is not implemented in @invoice/invoice-repository-memory until Task ${task}.`,
    ),
  );

const invalidInvoiceRecord = (message: string, path?: string, detail?: string) =>
  repoErr(
    makeInvoiceRepositoryError('invalid_invoice_record', message, {
      ...(path === undefined ? {} : { path }),
      ...(detail === undefined ? {} : { detail }),
    }),
  );

const invariantViolation = (message: string, path?: string) =>
  repoErr(
    makeInvoiceRepositoryError('repository_invariant_violation', message, {
      ...(path === undefined ? {} : { path }),
    }),
  );

const invoiceNotFound = (id: InvoiceId) =>
  repoErr(makeInvoiceRepositoryError('invoice_not_found', `Invoice ${String(id)} was not found.`));

const invoiceConflict = (message: string) =>
  repoErr(makeInvoiceRepositoryError('invoice_conflict', message));

const parseDraftFromRecord = (
  record: StoredInvoiceRecord,
): InvoiceRepositoryResult<DraftInvoice> => {
  if (record.kind !== 'draft') {
    return invariantViolation('Stored draft record must have draft lifecycle kind.', 'kind');
  }

  if (record.invoice.kind !== 'draft') {
    return invariantViolation(
      'Stored draft record payload must be a draft invoice.',
      'invoice.kind',
    );
  }

  if (record.schemaVersion !== record.invoice.schemaVersion) {
    return invariantViolation(
      'Stored invoice record schema version must match serialized invoice schema version.',
      'schemaVersion',
    );
  }

  if (Object.hasOwn(record, 'invoiceNumber')) {
    return invariantViolation('Draft records must not include invoice numbers.', 'invoiceNumber');
  }
  if (Object.hasOwn(record, 'finalizedAt')) {
    return invariantViolation(
      'Draft records must not include finalized timestamps.',
      'finalizedAt',
    );
  }
  if (Object.hasOwn(record, 'voidedAt')) {
    return invariantViolation('Draft records must not include voided timestamps.', 'voidedAt');
  }

  const parsed = parseSerializedDraftInvoice(record.invoice);
  if (!parsed.ok) {
    return invalidInvoiceRecord(
      'Stored draft invoice payload is invalid.',
      parsed.error.path,
      parsed.error.message,
    );
  }

  const draft = parsed.value;

  if (record.id !== draft.id) {
    return invariantViolation('Stored invoice record ID must match serialized invoice ID.', 'id');
  }
  if (record.createdAt !== draft.createdAt) {
    return invariantViolation(
      'Stored invoice record created timestamp must match serialized invoice created timestamp.',
      'createdAt',
    );
  }
  if (record.updatedAt !== draft.updatedAt) {
    return invariantViolation(
      'Stored invoice record updated timestamp must match serialized invoice updated timestamp.',
      'updatedAt',
    );
  }
  if (record.customerDisplayName !== draft.customer?.displayName) {
    return invariantViolation(
      'Stored invoice record customer display name must match serialized invoice customer.',
      'customerDisplayName',
    );
  }
  if (record.issueDate !== draft.issueDate) {
    return invariantViolation(
      'Stored invoice record issue date must match serialized invoice issue date.',
      'issueDate',
    );
  }
  if (record.dueDate !== draft.dueDate) {
    return invariantViolation(
      'Stored invoice record due date must match serialized invoice due date.',
      'dueDate',
    );
  }

  return repoOk(draft);
};

const toStoredDraftInvoiceRecord = (
  invoice: DraftInvoice,
  version: InvoiceRecordVersion,
): StoredInvoiceRecord => {
  const serialized = serializeDraftInvoice(invoice);

  return Object.freeze({
    id: invoice.id,
    kind: 'draft',
    schemaVersion: serialized.schemaVersion,
    invoice: serialized,
    version,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    ...(invoice.customer?.displayName === undefined
      ? {}
      : { customerDisplayName: invoice.customer.displayName }),
    ...(invoice.issueDate === undefined ? {} : { issueDate: invoice.issueDate }),
    ...(invoice.dueDate === undefined ? {} : { dueDate: invoice.dueDate }),
  });
};

const versionNumber = (version: InvoiceRecordVersion): number | undefined => {
  const match = /^v(\d+)$/u.exec(version);
  if (match?.[1] === undefined) return undefined;
  const value = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

export const createInMemoryInvoiceRepository = (
  options: InMemoryInvoiceRepositoryOptions = {},
): InvoiceRepository => {
  const recordsById = new Map<string, StoredInvoiceRecord>();
  let versionCounter = 0;

  for (const record of options.initialRecords ?? []) {
    if (record.kind !== 'draft') {
      throw new Error(
        'Initial finalized and voided invoice records are deferred to Task 008D in @invoice/invoice-repository-memory.',
      );
    }

    const idKey = String(record.id);
    if (recordsById.has(idKey)) {
      throw new Error(`Duplicate initial invoice record ID: ${idKey}.`);
    }

    const parsed = parseDraftFromRecord(record);
    if (!parsed.ok) {
      throw new Error(`Invalid initial draft invoice record: ${parsed.error.message}`);
    }

    const seededVersionNumber = versionNumber(record.version);
    if (seededVersionNumber !== undefined) {
      versionCounter = Math.max(versionCounter, seededVersionNumber);
    }

    recordsById.set(idKey, toStoredDraftInvoiceRecord(parsed.value, record.version));
  }

  const nextVersion = (): InvoiceRecordVersion => {
    versionCounter += 1;
    return assertInvoiceRecordVersion(`v${versionCounter}`);
  };

  const parseStoredDraftResult = (record: StoredInvoiceRecord) => {
    const parsed = parseDraftFromRecord(record);
    if (!parsed.ok) return parsed;
    return repoOk(Object.freeze({ invoice: parsed.value, version: record.version }));
  };

  return Object.freeze({
    async createDraft(invoice: DraftInvoice): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'draft') {
        return invalidInvoiceRecord('createDraft only accepts draft invoices.', 'kind');
      }

      const idKey = String(invoice.id);
      if (recordsById.has(idKey)) {
        return repoErr(
          makeInvoiceRepositoryError('invoice_already_exists', `Invoice ${idKey} already exists.`),
        );
      }

      const version = nextVersion();
      const record = toStoredDraftInvoiceRecord(invoice, version);
      recordsById.set(idKey, record);

      return parseStoredDraftResult(record);
    },

    async updateDraft(
      invoice: DraftInvoice,
      options: UpdateInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'draft') {
        return invalidInvoiceRecord('updateDraft only accepts draft invoices.', 'kind');
      }

      const idKey = String(invoice.id);
      const existing = recordsById.get(idKey);
      if (existing === undefined) return invoiceNotFound(invoice.id);
      if (existing.kind !== 'draft') return invoiceConflict('Only draft invoices can be updated.');
      if (options.expectedVersion !== existing.version) {
        return invoiceConflict('Invoice record version conflict.');
      }

      const version = nextVersion();
      const record = toStoredDraftInvoiceRecord(invoice, version);
      recordsById.set(idKey, record);

      return parseStoredDraftResult(record);
    },

    async saveFinalized(
      _invoice: FinalizedInvoice,
      _options: SaveFinalizedInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      return notImplemented('saveFinalized', '008D');
    },

    async saveVoided(
      _invoice: VoidedInvoice,
      _options: SaveVoidedInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      return notImplemented('saveVoided', '008D');
    },

    async getById(id: InvoiceId): Promise<InvoiceRepositoryResult<GetInvoiceResult>> {
      const record = recordsById.get(String(id));
      if (record === undefined) return invoiceNotFound(id);
      return parseStoredDraftResult(record);
    },

    async list(_query?: InvoiceListQuery): Promise<InvoiceRepositoryResult<InvoiceListResult>> {
      return notImplemented('list', '008E');
    },

    async discardDraft(
      id: InvoiceId,
      options: DiscardDraftOptions,
    ): Promise<InvoiceRepositoryResult<DiscardDraftResult>> {
      const idKey = String(id);
      const existing = recordsById.get(idKey);
      if (existing === undefined) return invoiceNotFound(id);
      if (existing.kind !== 'draft')
        return invoiceConflict('Only draft invoices can be discarded.');
      if (options.expectedVersion !== existing.version) {
        return invoiceConflict('Invoice record version conflict.');
      }

      recordsById.delete(idKey);
      return repoOk(Object.freeze({ id }));
    },
  });
};
