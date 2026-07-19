import { InvoiceApiAuthError, InvoiceApiError, isInvoiceApiErrorBody } from './errors';
import type {
  CreateDraftInvoiceInput,
  DeleteDraftInvoiceInput,
  DeleteDraftInvoiceResponse,
  FetchLike,
  FinalizeInvoiceInput,
  HealthResponse,
  InvoiceApiClient,
  InvoiceApiClientOptions,
  InvoiceListParams,
  InvoiceListResponse,
  InvoiceResponse,
  UpdateDraftInvoiceInput,
  VoidInvoiceInput,
} from './types';

type HttpMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/u, '');

const encodePathSegment = (value: string): string => encodeURIComponent(value);

const resolveFetch = (fetchImpl: FetchLike | undefined): FetchLike => {
  if (fetchImpl !== undefined) return fetchImpl;
  if (globalThis.fetch === undefined) {
    throw new Error('A fetch implementation is required.');
  }
  return globalThis.fetch.bind(globalThis);
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.trim().length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const createInvoiceApiClient = ({
  baseUrl,
  getAccessToken,
  fetchImpl,
}: InvoiceApiClientOptions): InvoiceApiClient => {
  const normalizedBaseUrl = trimTrailingSlashes(baseUrl);
  const fetcher = resolveFetch(fetchImpl);

  const request = async <T>(
    method: HttpMethod,
    path: string,
    options: Readonly<{ body?: unknown; authenticated: boolean }>,
  ): Promise<T> => {
    const headers = new Headers();
    if (options.body !== undefined) headers.set('content-type', 'application/json');

    if (options.authenticated) {
      const token = await getAccessToken();
      if (token === null || token.trim().length === 0) {
        throw new InvoiceApiAuthError();
      }
      headers.set('authorization', `Bearer ${token}`);
    }

    const response = await fetcher(`${normalizedBaseUrl}${path}`, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const responseBody = await parseJsonSafely(response);

    if (!response.ok) {
      if (isInvoiceApiErrorBody(responseBody)) {
        throw new InvoiceApiError({
          status: response.status,
          code: responseBody.error.code,
          message: responseBody.error.message,
          responseBody,
        });
      }

      throw new InvoiceApiError({
        status: response.status,
        message: `Invoice API request failed with status ${response.status}.`,
        responseBody,
      });
    }

    return responseBody as T;
  };

  const invoiceRequest = <T>(method: HttpMethod, path: string, body?: unknown): Promise<T> =>
    request<T>(method, path, { authenticated: true, ...(body === undefined ? {} : { body }) });

  return Object.freeze({
    health: () => request<HealthResponse>('GET', '/health', { authenticated: false }),

    listInvoices: (params?: InvoiceListParams) => {
      const query = new URLSearchParams();
      if (params?.kind !== undefined) query.set('kind', params.kind);
      const suffix = query.size === 0 ? '' : `?${query.toString()}`;
      return invoiceRequest<InvoiceListResponse>('GET', `/invoices${suffix}`);
    },

    getInvoice: (id: string) =>
      invoiceRequest<InvoiceResponse>('GET', `/invoices/${encodePathSegment(id)}`),

    createDraft: (input: CreateDraftInvoiceInput) =>
      invoiceRequest<InvoiceResponse>('POST', '/invoices/drafts', { draft: input }),

    updateDraft: (id: string, input: UpdateDraftInvoiceInput) =>
      invoiceRequest<InvoiceResponse>('PUT', `/invoices/drafts/${encodePathSegment(id)}`, {
        expectedVersion: input.expectedVersion,
        draft: input.draft,
      }),

    deleteDraft: (id: string, input: DeleteDraftInvoiceInput) =>
      invoiceRequest<DeleteDraftInvoiceResponse>(
        'DELETE',
        `/invoices/drafts/${encodePathSegment(id)}`,
        input,
      ),

    finalizeInvoice: (id: string, input: FinalizeInvoiceInput) =>
      invoiceRequest<InvoiceResponse>('POST', `/invoices/${encodePathSegment(id)}/finalize`, input),

    voidInvoice: (id: string, input: VoidInvoiceInput) =>
      invoiceRequest<InvoiceResponse>('POST', `/invoices/${encodePathSegment(id)}/void`, input),
  });
};
