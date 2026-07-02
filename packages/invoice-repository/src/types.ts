import type { InvoiceId, InvoiceNumber, IsoDateString, UtcTimestampString } from '@invoice/domain';
import type {
  DraftInvoice,
  FinalizedInvoice,
  Invoice,
  SerializedInvoice,
  SerializedInvoiceSchemaVersion,
  VoidedInvoice,
} from '@invoice/invoice-domain';

import type { InvoiceRepositoryResult } from './result';
import type { InvoiceRecordVersion } from './version';

export type InvoiceLifecycleKind = 'draft' | 'finalized' | 'voided';

export type UpdateInvoiceOptions = Readonly<{
  expectedVersion: InvoiceRecordVersion;
}>;

export type SaveFinalizedInvoiceOptions = Readonly<{
  expectedVersion: InvoiceRecordVersion;
}>;

export type SaveVoidedInvoiceOptions = Readonly<{
  expectedVersion: InvoiceRecordVersion;
}>;

export type DiscardDraftOptions = Readonly<{
  expectedVersion: InvoiceRecordVersion;
}>;

export type SaveInvoiceResult = Readonly<{
  invoice: Invoice;
  version: InvoiceRecordVersion;
}>;

export type GetInvoiceResult = Readonly<{
  invoice: Invoice;
  version: InvoiceRecordVersion;
}>;

export type DiscardDraftResult = Readonly<{
  id: InvoiceId;
}>;

export type StoredInvoiceRecord = Readonly<{
  id: InvoiceId;
  kind: InvoiceLifecycleKind;
  schemaVersion: SerializedInvoiceSchemaVersion;
  invoice: SerializedInvoice;
  version: InvoiceRecordVersion;
  createdAt: UtcTimestampString;
  updatedAt: UtcTimestampString;
  invoiceNumber?: InvoiceNumber;
  customerDisplayName?: string;
  issueDate?: IsoDateString;
  dueDate?: IsoDateString;
  finalizedAt?: UtcTimestampString;
  voidedAt?: UtcTimestampString;
}>;

export type InvoiceListSortBy = 'updatedAt' | 'createdAt' | 'issueDate' | 'invoiceNumber';

export type InvoiceListSortDirection = 'asc' | 'desc';

export type InvoiceListQuery = Readonly<{
  kind?: InvoiceLifecycleKind;
  search?: string;
  sortBy?: InvoiceListSortBy;
  sortDirection?: InvoiceListSortDirection;
  pageSize?: number;
  cursor?: string;
}>;

export type InvoiceListItem = Readonly<{
  id: InvoiceId;
  kind: InvoiceLifecycleKind;
  version: InvoiceRecordVersion;
  createdAt: UtcTimestampString;
  updatedAt: UtcTimestampString;
  invoiceNumber?: InvoiceNumber;
  customerDisplayName?: string;
  issueDate?: IsoDateString;
  dueDate?: IsoDateString;
  finalizedAt?: UtcTimestampString;
  voidedAt?: UtcTimestampString;
}>;

export type InvoiceListResult = Readonly<{
  items: readonly InvoiceListItem[];
  nextCursor?: string;
}>;

export type InvoiceRepository = Readonly<{
  /**
   * Creates a new draft invoice record. This is a create-only persistence operation and
   * should fail with `invoice_already_exists` when the invoice ID is already present.
   */
  createDraft(invoice: DraftInvoice): Promise<InvoiceRepositoryResult<SaveInvoiceResult>>;

  /**
   * Updates an existing draft invoice using optimistic concurrency. Implementations must
   * not recalculate invoices and must fail if the existing record is finalized or voided.
   */
  updateDraft(
    invoice: DraftInvoice,
    options: UpdateInvoiceOptions,
  ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>>;

  /**
   * Saves an already-finalized aggregate. This persistence operation does not perform
   * domain finalization; callers must pass a FinalizedInvoice produced by invoice-domain.
   * Implementations enforce invoice-number uniqueness for finalized and voided invoices.
   */
  saveFinalized(
    invoice: FinalizedInvoice,
    options: SaveFinalizedInvoiceOptions,
  ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>>;

  /**
   * Saves an already-voided aggregate. This persistence operation does not perform
   * domain voiding; callers must pass a VoidedInvoice produced by invoice-domain.
   * Implementations preserve invoice-number reservation and must not recalculate or zero totals.
   */
  saveVoided(
    invoice: VoidedInvoice,
    options: SaveVoidedInvoiceOptions,
  ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>>;

  getById(id: InvoiceId): Promise<InvoiceRepositoryResult<GetInvoiceResult>>;

  list(query?: InvoiceListQuery): Promise<InvoiceRepositoryResult<InvoiceListResult>>;

  /**
   * Discards drafts only. Finalized and voided invoice hard deletion is intentionally deferred.
   */
  discardDraft(
    id: InvoiceId,
    options: DiscardDraftOptions,
  ): Promise<InvoiceRepositoryResult<DiscardDraftResult>>;
}>;
