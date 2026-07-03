import type { InvoiceId } from '@invoice/domain';
import type {
  DraftInvoice,
  FinalizedInvoice,
  SerializedInvoice,
  VoidedInvoice,
} from '@invoice/invoice-domain';
import type {
  InvoiceListQuery,
  InvoiceListResult,
  InvoiceRecordVersion,
  InvoiceRepository,
  InvoiceRepositoryResult,
  StoredInvoiceRecord,
} from '@invoice/invoice-repository';

import type { InMemoryInvoiceRepositoryOptions } from '../src/index';
import { createInMemoryInvoiceRepository } from '../src/index';

declare const initialRecords: StoredInvoiceRecord[];
declare const serialized: SerializedInvoice;
declare const draft: DraftInvoice;
declare const finalized: FinalizedInvoice;
declare const voided: VoidedInvoice;
declare const id: InvoiceId;
declare const version: InvoiceRecordVersion;

const validListQuery: InvoiceListQuery = {
  kind: 'finalized',
  search: 'INV-1001',
  sortBy: 'invoiceNumber',
  sortDirection: 'asc',
  pageSize: 25,
  cursor: 'offset:25',
};

const options: InMemoryInvoiceRepositoryOptions = {
  initialRecords,
};

const readonlyOptions: InMemoryInvoiceRepositoryOptions = {
  initialRecords: initialRecords as readonly StoredInvoiceRecord[],
};

const factory: (options?: InMemoryInvoiceRepositoryOptions) => InvoiceRepository =
  createInMemoryInvoiceRepository;
const repository: InvoiceRepository = createInMemoryInvoiceRepository(options);

repository.createDraft(draft);
repository.updateDraft(draft, { expectedVersion: version });
repository.saveFinalized(finalized, { expectedVersion: version });
repository.saveVoided(voided, { expectedVersion: version });
repository.getById(id);
const listResult: Promise<InvoiceRepositoryResult<InvoiceListResult>> =
  repository.list(validListQuery);
repository.discardDraft(id, { expectedVersion: version });

// @ts-expect-error list rejects invalid lifecycle kinds
const invalidListKind = repository.list({ kind: 'paid' });

// @ts-expect-error list rejects unsupported sort fields
const invalidListSortBy = repository.list({ sortBy: 'total' });

// @ts-expect-error list rejects unsupported sort directions
const invalidListSortDirection = repository.list({ sortDirection: 'ascending' });

// @ts-expect-error Factory createDraft accepts runtime DraftInvoice, not SerializedInvoice
const invalidCreateSerialized = repository.createDraft(serialized);

// @ts-expect-error updateDraft accepts runtime DraftInvoice, not SerializedInvoice
const invalidUpdateSerialized = repository.updateDraft(serialized, { expectedVersion: version });

// @ts-expect-error saveFinalized accepts runtime FinalizedInvoice, not SerializedInvoice
const invalidSaveFinalizedSerialized = repository.saveFinalized(serialized, {
  expectedVersion: version,
});

// @ts-expect-error saveVoided accepts runtime VoidedInvoice, not SerializedInvoice
const invalidSaveVoidedSerialized = repository.saveVoided(serialized, { expectedVersion: version });

// @ts-expect-error FinalizedInvoice cannot be updated through draft persistence operation
const invalidUpdateFinalized = repository.updateDraft(finalized, { expectedVersion: version });

// @ts-expect-error DraftInvoice cannot be saved through finalized persistence operation
const invalidSaveFinalizedDraft = repository.saveFinalized(draft, { expectedVersion: version });

// @ts-expect-error FinalizedInvoice cannot be saved through voided persistence operation
const invalidSaveVoidedFinalized = repository.saveVoided(finalized, { expectedVersion: version });

// @ts-expect-error Plain strings must be parsed or asserted before use as InvoiceRecordVersion
const invalidExpectedVersion = repository.updateDraft(draft, { expectedVersion: 'v1' });

// @ts-expect-error Plain strings must be parsed or asserted before use as InvoiceId
const invalidPlainId = repository.getById('invoice-1');

void options;
void readonlyOptions;
void factory;
void repository;
void validListQuery;
void listResult;
void invalidListKind;
void invalidListSortBy;
void invalidListSortDirection;
void invalidCreateSerialized;
void invalidUpdateSerialized;
void invalidSaveFinalizedSerialized;
void invalidSaveVoidedSerialized;
void invalidUpdateFinalized;
void invalidSaveFinalizedDraft;
void invalidSaveVoidedFinalized;
void invalidExpectedVersion;
void invalidPlainId;
