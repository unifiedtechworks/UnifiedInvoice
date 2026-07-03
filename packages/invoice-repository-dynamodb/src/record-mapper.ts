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
  isInvoiceRecordVersion,
  makeInvoiceRepositoryError,
  repoErr,
  repoOk,
  type InvoiceRecordVersion,
  type InvoiceRepositoryResult,
  type StoredInvoiceRecord,
} from '@invoice/invoice-repository';

export type ParsedStoredInvoiceRecord = Readonly<{
  record: StoredInvoiceRecord;
  invoice: Invoice;
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseDraftFromRecord = (
  record: StoredInvoiceRecord,
): InvoiceRepositoryResult<DraftInvoice> => {
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
  const invoice = parsed.value;
  if (record.id !== invoice.id) return invariantViolation('Record ID must match payload ID.', 'id');
  if (record.createdAt !== invoice.createdAt)
    return invariantViolation('Record createdAt must match payload createdAt.', 'createdAt');
  if (record.updatedAt !== invoice.updatedAt)
    return invariantViolation('Record updatedAt must match payload updatedAt.', 'updatedAt');
  if (record.customerDisplayName !== invoice.customer?.displayName)
    return invariantViolation(
      'Record customerDisplayName must match payload customer.',
      'customerDisplayName',
    );
  if (record.issueDate !== invoice.issueDate)
    return invariantViolation('Record issueDate must match payload issueDate.', 'issueDate');
  if (record.dueDate !== invoice.dueDate)
    return invariantViolation('Record dueDate must match payload dueDate.', 'dueDate');
  return repoOk(invoice);
};

const parseFinalizedFromRecord = (
  record: StoredInvoiceRecord,
): InvoiceRepositoryResult<FinalizedInvoice> => {
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
  if (record.invoiceNumber !== invoice.invoiceNumber)
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
  if (record.invoiceNumber !== invoice.finalized.invoiceNumber)
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

export const parseStoredInvoiceRecord = (
  value: unknown,
): InvoiceRepositoryResult<ParsedStoredInvoiceRecord> => {
  if (!isObjectRecord(value))
    return invalidInvoiceRecord('Stored invoice record must be an object.');
  if (!['draft', 'finalized', 'voided'].includes(String(value.kind)))
    return invalidInvoiceRecord('Stored invoice record kind is invalid.', 'kind');
  if (!isInvoiceRecordVersion(value.version))
    return repoErr(
      makeInvoiceRepositoryError(
        'invalid_invoice_record_version',
        'Stored invoice record version is invalid.',
        { path: 'version' },
      ),
    );

  const parsedPayload = parseSerializedInvoice(value.invoice);
  if (!parsedPayload.ok)
    return invalidInvoiceRecord(
      'Stored invoice payload is invalid.',
      parsedPayload.error.path,
      parsedPayload.error.message,
    );

  const record = value as unknown as StoredInvoiceRecord;
  let invoiceResult: InvoiceRepositoryResult<Invoice>;
  switch (record.kind) {
    case 'draft':
      invoiceResult = parseDraftFromRecord(record);
      break;
    case 'finalized':
      invoiceResult = parseFinalizedFromRecord(record);
      break;
    case 'voided':
      invoiceResult = parseVoidedFromRecord(record);
      break;
  }
  if (!invoiceResult.ok) return invoiceResult;
  return repoOk(Object.freeze({ record, invoice: invoiceResult.value }));
};

export const toStoredDraftInvoiceRecord = (
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

export const toStoredFinalizedInvoiceRecord = (
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

export const toStoredVoidedInvoiceRecord = (
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

export const canonicalSerializedJson = (invoice: SerializedInvoice): string =>
  JSON.stringify(invoice);
