import { describe, expect, it, vi } from 'vitest';

import {
  createInvoiceApiClient,
  InvoiceApiAuthError,
  InvoiceApiError,
  type FetchLike,
} from '../src';

type CapturedRequest = Readonly<{
  url: string;
  init: RequestInit | undefined;
}>;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const textResponse = (status: number, body: string): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain' },
  });

const fakeFetch = (response: Response | ((request: CapturedRequest) => Response)) => {
  const requests: CapturedRequest[] = [];
  const fetchImpl: FetchLike = vi.fn(async (input, init) => {
    const request = Object.freeze({ url: String(input), init });
    requests.push(request);
    return typeof response === 'function' ? response(request) : response;
  });
  return { fetchImpl, requests };
};

const authHeader = (request: CapturedRequest): string | null =>
  new Headers(request.init?.headers).get('authorization');

const contentTypeHeader = (request: CapturedRequest): string | null =>
  new Headers(request.init?.headers).get('content-type');

const firstRequest = (requests: readonly CapturedRequest[]): CapturedRequest => {
  const request = requests[0];
  if (request === undefined) throw new Error('Expected a captured request.');
  return request;
};

describe('invoice API client', () => {
  it('normalizes baseUrl trailing slashes', async () => {
    const fake = fakeFetch(jsonResponse(200, { ok: true, service: 'unified-invoice-api' }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test///',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await client.health();

    expect(firstRequest(fake.requests).url).toBe('https://api.example.test/health');
  });

  it('does not attach Authorization for health', async () => {
    const fake = fakeFetch(jsonResponse(200, { ok: true, service: 'unified-invoice-api' }));
    const getAccessToken = vi.fn(async () => 'test-access-token');
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken,
      fetchImpl: fake.fetchImpl,
    });

    const response = await client.health();

    expect(response).toEqual({ ok: true, service: 'unified-invoice-api' });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(authHeader(firstRequest(fake.requests))).toBeNull();
  });

  it('attaches Authorization for authenticated invoice routes', async () => {
    const fake = fakeFetch(jsonResponse(200, { items: [] }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'test-access-token',
      fetchImpl: fake.fetchImpl,
    });

    await client.listInvoices();

    expect(authHeader(firstRequest(fake.requests))).toBe('Bearer test-access-token');
  });

  it('rejects missing tokens before fetching invoice routes', async () => {
    const fake = fakeFetch(jsonResponse(200, { items: [] }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => null,
      fetchImpl: fake.fetchImpl,
    });

    await expect(client.listInvoices()).rejects.toBeInstanceOf(InvoiceApiAuthError);
    expect(fake.fetchImpl).not.toHaveBeenCalled();
  });

  it('sends list query parameters', async () => {
    const fake = fakeFetch(jsonResponse(200, { items: [] }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await client.listInvoices({ kind: 'voided' });

    expect(firstRequest(fake.requests).url).toBe('https://api.example.test/invoices?kind=voided');
    expect(firstRequest(fake.requests).init?.method).toBe('GET');
  });

  it('sends createDraft using the API draft wrapper shape', async () => {
    const fake = fakeFetch(jsonResponse(201, { invoice: { kind: 'draft' }, version: 'v1' }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await client.createDraft({
      business: { displayName: 'Unified Techworks' },
      customer: { displayName: 'Acme Co' },
      issueDate: '2026-01-01',
      dueDate: '2026-01-15',
      lines: [{ description: 'Service', quantity: '1', unitPrice: '10.00' }],
    });

    expect(firstRequest(fake.requests).url).toBe('https://api.example.test/invoices/drafts');
    expect(firstRequest(fake.requests).init?.method).toBe('POST');
    expect(contentTypeHeader(firstRequest(fake.requests))).toBe('application/json');
    expect(JSON.parse(String(firstRequest(fake.requests).init?.body))).toEqual({
      draft: {
        business: { displayName: 'Unified Techworks' },
        customer: { displayName: 'Acme Co' },
        issueDate: '2026-01-01',
        dueDate: '2026-01-15',
        lines: [{ description: 'Service', quantity: '1', unitPrice: '10.00' }],
      },
    });
  });

  it('sends updateDraft using expectedVersion and draft fields', async () => {
    const fake = fakeFetch(jsonResponse(200, { invoice: { kind: 'draft' }, version: 'v2' }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await client.updateDraft('invoice_1', {
      expectedVersion: 'v1',
      draft: {
        business: { displayName: 'Updated Business' },
        lines: [{ description: 'Updated', quantity: '2', unitPrice: '12.00' }],
      },
    });

    expect(firstRequest(fake.requests).url).toBe(
      'https://api.example.test/invoices/drafts/invoice_1',
    );
    expect(firstRequest(fake.requests).init?.method).toBe('PUT');
    expect(JSON.parse(String(firstRequest(fake.requests).init?.body))).toEqual({
      expectedVersion: 'v1',
      draft: {
        business: { displayName: 'Updated Business' },
        lines: [{ description: 'Updated', quantity: '2', unitPrice: '12.00' }],
      },
    });
  });

  it('sends deleteDraft expectedVersion', async () => {
    const fake = fakeFetch(jsonResponse(200, { id: 'invoice_1' }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await client.deleteDraft('invoice_1', { expectedVersion: 'v1' });

    expect(firstRequest(fake.requests).init?.method).toBe('DELETE');
    expect(JSON.parse(String(firstRequest(fake.requests).init?.body))).toEqual({
      expectedVersion: 'v1',
    });
  });

  it('sends finalizeInvoice input fields', async () => {
    const fake = fakeFetch(jsonResponse(200, { invoice: { kind: 'finalized' }, version: 'v2' }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await client.finalizeInvoice('invoice_1', {
      expectedVersion: 'v1',
      invoiceNumber: 'INV-001',
      finalizedAt: '2026-01-02T03:04:05.000Z',
    });

    expect(firstRequest(fake.requests).url).toBe(
      'https://api.example.test/invoices/invoice_1/finalize',
    );
    expect(firstRequest(fake.requests).init?.method).toBe('POST');
    expect(JSON.parse(String(firstRequest(fake.requests).init?.body))).toEqual({
      expectedVersion: 'v1',
      invoiceNumber: 'INV-001',
      finalizedAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('sends voidInvoice input fields', async () => {
    const fake = fakeFetch(jsonResponse(200, { invoice: { kind: 'voided' }, version: 'v3' }));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await client.voidInvoice('invoice_1', {
      expectedVersion: 'v2',
      voidReason: 'Issued in error',
      voidedAt: '2026-01-03T03:04:05.000Z',
    });

    expect(firstRequest(fake.requests).url).toBe(
      'https://api.example.test/invoices/invoice_1/void',
    );
    expect(firstRequest(fake.requests).init?.method).toBe('POST');
    expect(JSON.parse(String(firstRequest(fake.requests).init?.body))).toEqual({
      expectedVersion: 'v2',
      voidReason: 'Issued in error',
      voidedAt: '2026-01-03T03:04:05.000Z',
    });
  });

  it('parses successful JSON responses', async () => {
    const fake = fakeFetch(
      jsonResponse(200, {
        invoice: { schemaVersion: 1, kind: 'draft', id: 'invoice_1' },
        version: 'v1',
      }),
    );
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'token',
      fetchImpl: fake.fetchImpl,
    });

    await expect(client.getInvoice('invoice_1')).resolves.toEqual({
      invoice: { schemaVersion: 1, kind: 'draft', id: 'invoice_1' },
      version: 'v1',
    });
  });

  it.each([400, 401, 404, 409, 503])(
    'throws typed API errors for %s JSON responses',
    async (status) => {
      const fake = fakeFetch(
        jsonResponse(status, {
          error: { code: 'invoice_conflict', message: 'Conflict happened.' },
        }),
      );
      const client = createInvoiceApiClient({
        baseUrl: 'https://api.example.test',
        getAccessToken: async () => 'test-access-token',
        fetchImpl: fake.fetchImpl,
      });

      await expect(client.getInvoice('invoice_1')).rejects.toMatchObject({
        status,
        code: 'invoice_conflict',
        message: 'Conflict happened.',
      });
    },
  );

  it('throws typed errors for non-JSON error responses', async () => {
    const fake = fakeFetch(textResponse(500, 'plain failure'));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'test-access-token',
      fetchImpl: fake.fetchImpl,
    });

    await expect(client.getInvoice('invoice_1')).rejects.toMatchObject({
      status: 500,
      code: undefined,
      message: 'Invoice API request failed with status 500.',
      responseBody: 'plain failure',
    });
  });

  it('does not include tokens in thrown error messages', async () => {
    const fake = fakeFetch(textResponse(500, 'server failure'));
    const client = createInvoiceApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'redacted-test-access-token',
      fetchImpl: fake.fetchImpl,
    });

    await client.getInvoice('invoice_1').catch((error: unknown) => {
      expect(error).toBeInstanceOf(InvoiceApiError);
      expect(String(error instanceof Error ? error.message : error)).not.toContain(
        'redacted-test-access-token',
      );
    });
  });
});
