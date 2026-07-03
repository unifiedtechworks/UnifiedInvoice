import type { InvoiceId, InvoiceNumber } from '@invoice/domain';
import {
  parseSerializedDraftInvoice,
  parseSerializedFinalizedInvoice,
  parseSerializedInvoice,
  parseSerializedVoidedInvoice,
  serializeDraftInvoice,
  serializeFinalizedInvoice,
  serializeVoidedInvoice,
  type DraftInvoice,
  type FinalizedInvoice,
  type Invoice,
  type SerializedInvoice,
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

const invoiceNumberConflict = (invoiceNumber: InvoiceNumber) =>
  repoErr(
    makeInvoiceRepositoryError(
      'invoice_number_conflict',
      `Invoice number ${String(invoiceNumber)} is already assigned to another invoice.`,
      { path: 'invoiceNumber' },
    ),
  );

const canonicalSerializedJson = (invoice: SerializedInvoice): string => JSON.stringify(invoice);

const parseDraftFromRecord = (
  record: StoredInvoiceRecord,
): InvoiceRepositoryResult<DraftInvoice> => {
  if (record.kind !== 'draft')
    return invariantViolation('Stored draft record kind mismatch.', 'kind');
  if (record.invoice.kind !== 'draft')
    return invariantViolation('Stored draft payload kind mismatch.', 'invoice.kind');
  if (record.schemaVersion !== record.invoice.schemaVersion)
    return invariantViolation(
      'Record schema version must match payload schema version.',
      'schemaVersion',
    );
  if (Object.hasOwn(record, 'invoiceNumber'))
    return invariantViolation('Draft records must not include invoice numbers.', 'invoiceNumber');
  if (Object.hasOwn(record, 'finalizedAt'))
    return invariantViolation(
      'Draft records must not include finalized timestamps.',
      'finalizedAt',
    );
  if (Object.hasOwn(record, 'voidedAt'))
    return invariantViolation('Draft records must not include voided timestamps.', 'voidedAt');

  const parsed = parseSerializedDraftInvoice(record.invoice);
  if (!parsed.ok)
    return invalidInvoiceRecord(
      'Stored draft invoice payload is invalid.',
      parsed.error.path,
      parsed.error.message,
    );
  const draft = parsed.value;
  if (record.id !== draft.id) return invariantViolation('Record ID must match payload ID.', 'id');
  if (record.createdAt !== draft.createdAt)
    return invariantViolation('Record createdAt must match payload createdAt.', 'createdAt');
  if (record.updatedAt !== draft.updatedAt)
    return invariantViolation('Record updatedAt must match payload updatedAt.', 'updatedAt');
  if (record.customerDisplayName !== draft.customer?.displayName)
    return invariantViolation(
      'Record customerDisplayName must match payload customer.',
      'customerDisplayName',
    );
  if (record.issueDate !== draft.issueDate)
    return invariantViolation('Record issueDate must match payload issueDate.', 'issueDate');
  if (record.dueDate !== draft.dueDate)
    return invariantViolation('Record dueDate must match payload dueDate.', 'dueDate');
  return repoOk(draft);
};

const parseFinalizedFromRecord = (
  record: StoredInvoiceRecord,
): InvoiceRepositoryResult<FinalizedInvoice> => {
  if (record.kind !== 'finalized')
    return invariantViolation('Stored finalized record kind mismatch.', 'kind');
  if (record.invoice.kind !== 'finalized')
    return invariantViolation('Stored finalized payload kind mismatch.', 'invoice.kind');
  if (record.schemaVersion !== record.invoice.schemaVersion)
    return invariantViolation(
      'Record schema version must match payload schema version.',
      'schemaVersion',
    );
  if (Object.hasOwn(record, 'voidedAt'))
    return invariantViolation('Finalized records must not include voided timestamps.', 'voidedAt');

  const parsed = parseSerializedFinalizedInvoice(record.invoice);
  if (!parsed.ok)
    return invalidInvoiceRecord(
      'Stored finalized invoice payload is invalid.',
      parsed.error.path,
      parsed.error.message,
    );
  const invoice = parsed.value;
  if (record.id !== invoice.id) return invariantViolation('Record ID must match payload ID.', 'id');
  if (record.createdAt !== invoice.createdAt)
    return invariantViolation('Record createdAt must match payload createdAt.', 'createdAt');
  if (record.updatedAt !== invoice.updatedAt)
    return invariantViolation('Record updatedAt must match payload updatedAt.', 'updatedAt');
  if (record.invoiceNumber === undefined || record.invoiceNumber !== invoice.invoiceNumber)
    return invariantViolation(
      'Record invoiceNumber must match payload invoiceNumber.',
      'invoiceNumber',
    );
  if (record.customerDisplayName !== invoice.customer.displayName)
    return invariantViolation(
      'Record customerDisplayName must match payload customer.',
      'customerDisplayName',
    );
  if (record.issueDate !== invoice.issueDate)
    return invariantViolation('Record issueDate must match payload issueDate.', 'issueDate');
  if (record.dueDate !== invoice.dueDate)
    return invariantViolation('Record dueDate must match payload dueDate.', 'dueDate');
  if (record.finalizedAt !== invoice.finalizedAt)
    return invariantViolation('Record finalizedAt must match payload finalizedAt.', 'finalizedAt');
  return repoOk(invoice);
};

const parseVoidedFromRecord = (
  record: StoredInvoiceRecord,
): InvoiceRepositoryResult<VoidedInvoice> => {
  if (record.kind !== 'voided')
    return invariantViolation('Stored voided record kind mismatch.', 'kind');
  if (record.invoice.kind !== 'voided')
    return invariantViolation('Stored voided payload kind mismatch.', 'invoice.kind');
  if (record.schemaVersion !== record.invoice.schemaVersion)
    return invariantViolation(
      'Record schema version must match payload schema version.',
      'schemaVersion',
    );

  const parsed = parseSerializedVoidedInvoice(record.invoice);
  if (!parsed.ok)
    return invalidInvoiceRecord(
      'Stored voided invoice payload is invalid.',
      parsed.error.path,
      parsed.error.message,
    );
  const invoice = parsed.value;
  if (record.id !== invoice.finalized.id)
    return invariantViolation('Record ID must match payload ID.', 'id');
  if (record.createdAt !== invoice.finalized.createdAt)
    return invariantViolation('Record createdAt must match payload createdAt.', 'createdAt');
  if (record.updatedAt !== invoice.voidedAt)
    return invariantViolation('Voided record updatedAt must match payload voidedAt.', 'updatedAt');
  if (
    record.invoiceNumber === undefined ||
    record.invoiceNumber !== invoice.finalized.invoiceNumber
  )
    return invariantViolation(
      'Record invoiceNumber must match payload invoiceNumber.',
      'invoiceNumber',
    );
  if (record.customerDisplayName !== invoice.finalized.customer.displayName)
    return invariantViolation(
      'Record customerDisplayName must match payload customer.',
      'customerDisplayName',
    );
  if (record.issueDate !== invoice.finalized.issueDate)
    return invariantViolation('Record issueDate must match payload issueDate.', 'issueDate');
  if (record.dueDate !== invoice.finalized.dueDate)
    return invariantViolation('Record dueDate must match payload dueDate.', 'dueDate');
  if (record.finalizedAt !== invoice.finalized.finalizedAt)
    return invariantViolation('Record finalizedAt must match payload finalizedAt.', 'finalizedAt');
  if (record.voidedAt !== invoice.voidedAt)
    return invariantViolation('Record voidedAt must match payload voidedAt.', 'voidedAt');
  return repoOk(invoice);
};

const parseInvoiceFromRecord = (record: StoredInvoiceRecord): InvoiceRepositoryResult<Invoice> => {
  const parsed = parseSerializedInvoice(record.invoice);
  if (!parsed.ok)
    return invalidInvoiceRecord(
      'Stored invoice payload is invalid.',
      parsed.error.path,
      parsed.error.message,
    );
  switch (record.kind) {
    case 'draft':
      return parseDraftFromRecord(record);
    case 'finalized':
      return parseFinalizedFromRecord(record);
    case 'voided':
      return parseVoidedFromRecord(record);
  }
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

const toStoredFinalizedInvoiceRecord = (
  invoice: FinalizedInvoice,
  version: InvoiceRecordVersion,
): StoredInvoiceRecord => {
  const serialized = serializeFinalizedInvoice(invoice);
  return Object.freeze({
    id: invoice.id,
    kind: 'finalized',
    schemaVersion: serialized.schemaVersion,
    invoice: serialized,
    version,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    invoiceNumber: invoice.invoiceNumber,
    customerDisplayName: invoice.customer.displayName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    finalizedAt: invoice.finalizedAt,
  });
};

const toStoredVoidedInvoiceRecord = (
  invoice: VoidedInvoice,
  version: InvoiceRecordVersion,
): StoredInvoiceRecord => {
  const serialized = serializeVoidedInvoice(invoice);
  return Object.freeze({
    id: invoice.finalized.id,
    kind: 'voided',
    schemaVersion: serialized.schemaVersion,
    invoice: serialized,
    version,
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
  const invoiceNumberToId = new Map<string, string>();
  let versionCounter = 0;

  const assertInvoiceNumberAvailable = (
    invoiceNumber: InvoiceNumber,
    id: InvoiceId,
  ): InvoiceRepositoryResult<void> => {
    const claimedId = invoiceNumberToId.get(String(invoiceNumber));
    if (claimedId !== undefined && claimedId !== String(id))
      return invoiceNumberConflict(invoiceNumber);
    return repoOk(undefined);
  };

  const claimInvoiceNumber = (invoiceNumber: InvoiceNumber, id: InvoiceId): void => {
    invoiceNumberToId.set(String(invoiceNumber), String(id));
  };

  for (const record of options.initialRecords ?? []) {
    const idKey = String(record.id);
    if (recordsById.has(idKey)) throw new Error(`Duplicate initial invoice record ID: ${idKey}.`);
    const parsed = parseInvoiceFromRecord(record);
    if (!parsed.ok)
      throw new Error(`Invalid initial ${record.kind} invoice record: ${parsed.error.message}`);
    const seededVersionNumber = versionNumber(record.version);
    if (seededVersionNumber !== undefined)
      versionCounter = Math.max(versionCounter, seededVersionNumber);
    if (record.kind === 'draft') {
      recordsById.set(
        idKey,
        toStoredDraftInvoiceRecord(parsed.value as DraftInvoice, record.version),
      );
      continue;
    }
    const invoiceNumber =
      record.kind === 'finalized'
        ? (parsed.value as FinalizedInvoice).invoiceNumber
        : (parsed.value as VoidedInvoice).finalized.invoiceNumber;
    if (invoiceNumberToId.has(String(invoiceNumber)))
      throw new Error(`Duplicate initial invoice number: ${String(invoiceNumber)}.`);
    claimInvoiceNumber(invoiceNumber, record.id);
    recordsById.set(
      idKey,
      record.kind === 'finalized'
        ? toStoredFinalizedInvoiceRecord(parsed.value as FinalizedInvoice, record.version)
        : toStoredVoidedInvoiceRecord(parsed.value as VoidedInvoice, record.version),
    );
  }

  const nextVersion = (): InvoiceRecordVersion => {
    versionCounter += 1;
    return assertInvoiceRecordVersion(`v${versionCounter}`);
  };

  const parseStoredInvoiceResult = (record: StoredInvoiceRecord) => {
    const parsed = parseInvoiceFromRecord(record);
    if (!parsed.ok) return parsed;
    return repoOk(Object.freeze({ invoice: parsed.value, version: record.version }));
  };

  return Object.freeze({
    async createDraft(invoice: DraftInvoice): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'draft')
        return invalidInvoiceRecord('createDraft only accepts draft invoices.', 'kind');
      const idKey = String(invoice.id);
      if (recordsById.has(idKey))
        return repoErr(
          makeInvoiceRepositoryError('invoice_already_exists', `Invoice ${idKey} already exists.`),
        );
      const version = nextVersion();
      const record = toStoredDraftInvoiceRecord(invoice, version);
      recordsById.set(idKey, record);
      return parseStoredInvoiceResult(record);
    },

    async updateDraft(
      invoice: DraftInvoice,
      options: UpdateInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'draft')
        return invalidInvoiceRecord('updateDraft only accepts draft invoices.', 'kind');
      const idKey = String(invoice.id);
      const existing = recordsById.get(idKey);
      if (existing === undefined) return invoiceNotFound(invoice.id);
      if (existing.kind !== 'draft') return invoiceConflict('Only draft invoices can be updated.');
      if (options.expectedVersion !== existing.version)
        return invoiceConflict('Invoice record version conflict.');
      const version = nextVersion();
      const record = toStoredDraftInvoiceRecord(invoice, version);
      recordsById.set(idKey, record);
      return parseStoredInvoiceResult(record);
    },

    async saveFinalized(
      invoice: FinalizedInvoice,
      options: SaveFinalizedInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'finalized')
        return invalidInvoiceRecord('saveFinalized only accepts finalized invoices.', 'kind');
      const idKey = String(invoice.id);
      const existing = recordsById.get(idKey);
      if (existing === undefined) return invoiceNotFound(invoice.id);
      if (options.expectedVersion !== existing.version)
        return invoiceConflict('Invoice record version conflict.');
      if (existing.kind === 'voided')
        return invoiceConflict('Voided invoices cannot be finalized.');
      const serialized = serializeFinalizedInvoice(invoice);
      if (existing.kind === 'finalized') {
        if (canonicalSerializedJson(existing.invoice) === canonicalSerializedJson(serialized))
          return parseStoredInvoiceResult(existing);
        return invoiceConflict('Finalized invoice payload differs from existing record.');
      }
      const available = assertInvoiceNumberAvailable(invoice.invoiceNumber, invoice.id);
      if (!available.ok) return available;
      const version = nextVersion();
      const record = toStoredFinalizedInvoiceRecord(invoice, version);
      const validated = parseFinalizedFromRecord(record);
      if (!validated.ok) return validated;
      claimInvoiceNumber(invoice.invoiceNumber, invoice.id);
      recordsById.set(idKey, record);
      return parseStoredInvoiceResult(record);
    },

    async saveVoided(
      invoice: VoidedInvoice,
      options: SaveVoidedInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'voided')
        return invalidInvoiceRecord('saveVoided only accepts voided invoices.', 'kind');
      const id = invoice.finalized?.id;
      if (id === undefined)
        return invalidInvoiceRecord(
          'Voided invoices must include finalized snapshot.',
          'finalized',
        );
      const idKey = String(id);
      const existing = recordsById.get(idKey);
      if (existing === undefined) return invoiceNotFound(id);
      if (options.expectedVersion !== existing.version)
        return invoiceConflict('Invoice record version conflict.');
      if (existing.kind === 'draft') return invoiceConflict('Draft invoices cannot be voided.');
      const serialized = serializeVoidedInvoice(invoice);
      if (existing.kind === 'voided') {
        if (canonicalSerializedJson(existing.invoice) === canonicalSerializedJson(serialized))
          return parseStoredInvoiceResult(existing);
        return invoiceConflict('Voided invoice payload differs from existing record.');
      }
      if (
        canonicalSerializedJson(existing.invoice) !==
        canonicalSerializedJson(serializeFinalizedInvoice(invoice.finalized))
      )
        return invoiceConflict('Voided invoice finalized snapshot differs from existing record.');
      const claimedId = invoiceNumberToId.get(String(invoice.finalized.invoiceNumber));
      if (claimedId === undefined)
        return invariantViolation(
          'Finalized invoice number must already be reserved before voiding.',
          'invoiceNumber',
        );
      if (claimedId !== idKey) return invoiceNumberConflict(invoice.finalized.invoiceNumber);
      const version = nextVersion();
      const record = toStoredVoidedInvoiceRecord(invoice, version);
      const validated = parseVoidedFromRecord(record);
      if (!validated.ok) return validated;
      recordsById.set(idKey, record);
      return parseStoredInvoiceResult(record);
    },

    async getById(id: InvoiceId): Promise<InvoiceRepositoryResult<GetInvoiceResult>> {
      const record = recordsById.get(String(id));
      if (record === undefined) return invoiceNotFound(id);
      return parseStoredInvoiceResult(record);
    },

    async list(_query?: InvoiceListQuery): Promise<InvoiceRepositoryResult<InvoiceListResult>> {
      return repoErr(
        makeInvoiceRepositoryError(
          'repository_unavailable',
          'list is not implemented in @invoice/invoice-repository-memory until Task 008E.',
        ),
      );
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
      if (options.expectedVersion !== existing.version)
        return invoiceConflict('Invoice record version conflict.');
      recordsById.delete(idKey);
      return repoOk(Object.freeze({ id }));
    },
  });
};
