import type { SerializedInvoice, SerializedPartySnapshot } from '@invoice/invoice-domain';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type HealthResponse = Readonly<{
  ok: true;
  service: string;
}>;

export type InvoiceApiErrorBody = Readonly<{
  error: Readonly<{
    code: string;
    message: string;
  }>;
}>;

export type InvoiceApiClientOptions = Readonly<{
  baseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  fetchImpl?: FetchLike;
}>;

export type InvoiceLifecycleKind = 'draft' | 'finalized' | 'voided';

export type InvoiceListParams = Readonly<{
  kind?: InvoiceLifecycleKind;
}>;

export type InvoiceListItem = Readonly<{
  id: string;
  kind: InvoiceLifecycleKind;
  version: string;
  createdAt: string;
  updatedAt: string;
  invoiceNumber?: string;
  customerDisplayName?: string;
  issueDate?: string;
  dueDate?: string;
  finalizedAt?: string;
  voidedAt?: string;
}>;

export type InvoiceListResponse = Readonly<{
  items: readonly InvoiceListItem[];
  nextCursor?: string;
}>;

export type InvoiceResponse = Readonly<{
  invoice: SerializedInvoice;
  version: string;
}>;

export type DeleteDraftInvoiceResponse = Readonly<{
  id: string;
}>;

export type DraftInvoiceLineInput = Readonly<{
  description: string;
  quantity: string;
  unitPrice: string;
}>;

export type CreateDraftInvoiceInput = Readonly<{
  id?: string;
  business?: SerializedPartySnapshot;
  customer?: SerializedPartySnapshot;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  lines?: readonly DraftInvoiceLineInput[];
}>;

export type UpdateDraftInvoiceInput = Readonly<{
  expectedVersion: string;
  draft: Readonly<{
    business?: SerializedPartySnapshot;
    customer?: SerializedPartySnapshot;
    issueDate?: string;
    dueDate?: string;
    notes?: string;
    lines?: readonly DraftInvoiceLineInput[];
  }>;
}>;

export type DeleteDraftInvoiceInput = Readonly<{
  expectedVersion: string;
}>;

export type FinalizeInvoiceInput = Readonly<{
  expectedVersion: string;
  invoiceNumber: string;
  finalizedAt?: string;
}>;

export type VoidInvoiceInput = Readonly<{
  expectedVersion: string;
  voidReason: string;
  voidedAt?: string;
}>;

export type InvoiceApiClient = Readonly<{
  health(): Promise<HealthResponse>;
  listInvoices(params?: InvoiceListParams): Promise<InvoiceListResponse>;
  getInvoice(id: string): Promise<InvoiceResponse>;
  createDraft(input: CreateDraftInvoiceInput): Promise<InvoiceResponse>;
  updateDraft(id: string, input: UpdateDraftInvoiceInput): Promise<InvoiceResponse>;
  deleteDraft(id: string, input: DeleteDraftInvoiceInput): Promise<DeleteDraftInvoiceResponse>;
  finalizeInvoice(id: string, input: FinalizeInvoiceInput): Promise<InvoiceResponse>;
  voidInvoice(id: string, input: VoidInvoiceInput): Promise<InvoiceResponse>;
}>;
