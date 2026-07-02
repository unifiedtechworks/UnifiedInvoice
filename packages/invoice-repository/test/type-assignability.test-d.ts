import type { InvoiceId, InvoiceNumber, UtcTimestampString } from '@invoice/domain';
import type {
  DraftInvoice,
  FinalizedInvoice,
  SerializedInvoice,
  SerializedInvoiceSchemaVersion,
  VoidedInvoice,
} from '@invoice/invoice-domain';

import type {
  InvoiceLifecycleKind,
  InvoiceListQuery,
  InvoiceRecordVersion,
  InvoiceRepository,
  InvoiceRepositoryResult,
  SaveInvoiceResult,
  StoredInvoiceRecord,
} from '../src/index';

declare const repository: InvoiceRepository;
declare const draft: DraftInvoice;
declare const finalized: FinalizedInvoice;
declare const voided: VoidedInvoice;
declare const serialized: SerializedInvoice;
declare const id: InvoiceId;
declare const version: InvoiceRecordVersion;
declare const timestamp: UtcTimestampString;
declare const invoiceNumber: InvoiceNumber;
declare const schemaVersion: SerializedInvoiceSchemaVersion;

const createResult: Promise<InvoiceRepositoryResult<SaveInvoiceResult>> =
  repository.createDraft(draft);
const updateResult: Promise<InvoiceRepositoryResult<SaveInvoiceResult>> = repository.updateDraft(
  draft,
  { expectedVersion: version },
);
const finalizedResult: Promise<InvoiceRepositoryResult<SaveInvoiceResult>> =
  repository.saveFinalized(finalized, { expectedVersion: version });
const voidedResult: Promise<InvoiceRepositoryResult<SaveInvoiceResult>> = repository.saveVoided(
  voided,
  { expectedVersion: version },
);

const lifecycleKind: InvoiceLifecycleKind = 'draft';
const query: InvoiceListQuery = { kind: 'finalized', sortBy: 'updatedAt', sortDirection: 'desc' };
const record: StoredInvoiceRecord = {
  id,
  kind: 'finalized',
  schemaVersion,
  invoice: serialized,
  version,
  createdAt: timestamp,
  updatedAt: timestamp,
  invoiceNumber,
};

// @ts-expect-error Repository public API accepts runtime DraftInvoice, not SerializedInvoice
const invalidCreate = repository.createDraft(serialized);

// @ts-expect-error Repository public API accepts runtime DraftInvoice, not SerializedInvoice
const invalidUpdate = repository.updateDraft(serialized, { expectedVersion: version });

// @ts-expect-error Repository public API accepts runtime FinalizedInvoice, not SerializedInvoice
const invalidSaveFinalizedSerialized = repository.saveFinalized(serialized, {
  expectedVersion: version,
});

// @ts-expect-error Plain strings must be parsed or asserted before use as InvoiceId
const invalidId: InvoiceId = 'invoice-1';

// @ts-expect-error Plain strings must be parsed or asserted before use as InvoiceRecordVersion
const invalidVersion: InvoiceRecordVersion = 'version-1';

// @ts-expect-error DraftInvoice cannot be saved through finalized persistence operation
const invalidSaveFinalizedDraft = repository.saveFinalized(draft, { expectedVersion: version });

// @ts-expect-error FinalizedInvoice cannot be updated through draft persistence operation
const invalidUpdateFinalized = repository.updateDraft(finalized, { expectedVersion: version });

// @ts-expect-error Lifecycle filter is constrained to known invoice lifecycle kinds
const invalidKind: InvoiceLifecycleKind = 'paid';

// @ts-expect-error Sort fields are constrained to supported listing fields
const invalidSortQuery: InvoiceListQuery = { sortBy: 'customerDisplayName' };

const invalidRecord: StoredInvoiceRecord = {
  id,
  kind: 'draft',
  schemaVersion,
  // @ts-expect-error Stored records require canonical SerializedInvoice payloads
  invoice: draft,
  version,
  createdAt: timestamp,
  updatedAt: timestamp,
};

void createResult;
void updateResult;
void finalizedResult;
void voidedResult;
void lifecycleKind;
void query;
void record;
void invalidCreate;
void invalidUpdate;
void invalidSaveFinalizedSerialized;
void invalidId;
void invalidVersion;
void invalidSaveFinalizedDraft;
void invalidUpdateFinalized;
void invalidKind;
void invalidSortQuery;
void invalidRecord;
