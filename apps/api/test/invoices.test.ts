import { assertInvoiceId, type UtcTimestampString } from '@invoice/domain';
import type { Invoice } from '@invoice/invoice-domain';
import type { InvoiceRepository, InvoiceRepositoryResult } from '@invoice/invoice-repository';
import { makeInvoiceRepositoryError, repoErr, repoOk } from '@invoice/invoice-repository';
import { describe, expect, it, vi } from 'vitest';

import { createInvoiceApiHandler, type ApiGatewayHttpEvent } from '../src';

const ownerClaims = { sub: 'owner-123' };

const event = (
  method: string,
  path: string,
  options: Partial<ApiGatewayHttpEvent> = {},
): ApiGatewayHttpEvent => ({
  rawPath: path,
  requestContext: {
    authorizer: { jwt: { claims: ownerClaims } },
    http: { method, path },
  },
  ...options,
});

const unauthorizedEvent = (method: string, path: string): ApiGatewayHttpEvent => ({
  rawPath: path,
  requestContext: {
    authorizer: { jwt: { claims: {} } },
    http: { method, path },
  },
});

const draftInvoice = Object.freeze({
  kind: 'draft',
  id: assertInvoiceId('invoice_1'),
  currency: { code: 'USD', minorUnitDigits: 2 },
  lines: [],
  roundingMode: 'half_away_from_zero',
  taxRoundingStrategy: 'per_line',
  createdAt: '2026-01-01T00:00:00.000Z' as UtcTimestampString,
  updatedAt: '2026-01-01T00:00:00.000Z' as UtcTimestampString,
}) as unknown as Invoice;

const okRepository = (overrides: Partial<InvoiceRepository> = {}): InvoiceRepository =>
  ({
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    saveFinalized: vi.fn(),
    saveVoided: vi.fn(),
    getById: vi.fn(async () => repoOk({ invoice: draftInvoice, version: 'v1' })),
    list: vi.fn(async () =>
      repoOk({
        items: [
          {
            id: assertInvoiceId('invoice_1'),
            kind: 'draft',
            version: 'v1',
            createdAt: '2026-01-01T00:00:00.000Z' as UtcTimestampString,
            updatedAt: '2026-01-01T00:00:00.000Z' as UtcTimestampString,
          },
        ],
        nextCursor: 'offset:1',
      }),
    ),
    discardDraft: vi.fn(),
    ...overrides,
  }) as InvoiceRepository;

const error = (code: Parameters<typeof makeInvoiceRepositoryError>[0]) =>
  makeInvoiceRepositoryError(code, `Repository ${code} error.`);

const responseBody = (response: Awaited<ReturnType<ReturnType<typeof createInvoiceApiHandler>>>) =>
  JSON.parse(response.body) as unknown;

describe('invoice API routes', () => {
  it('requires an owner for GET /invoices', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('GET', '/invoices'));

    expect(response.statusCode).toBe(401);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authenticated owner could not be resolved from JWT claims.',
      },
    });
  });

  it('maps supported query parameters and returns list results', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('GET', '/invoices', {
        queryStringParameters: {
          cursor: 'offset:10',
          kind: 'draft',
          pageSize: '25',
          search: 'Acme',
          sortBy: 'createdAt',
          sortDirection: 'asc',
        },
      }),
    );

    expect(repository.list).toHaveBeenCalledWith({
      cursor: 'offset:10',
      kind: 'draft',
      pageSize: 25,
      search: 'Acme',
      sortBy: 'createdAt',
      sortDirection: 'asc',
    });
    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toEqual({
      items: [
        {
          id: 'invoice_1',
          kind: 'draft',
          version: 'v1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      nextCursor: 'offset:1',
    });
  });

  it('maps bad list query input to 400 before calling the repository', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('GET', '/invoices', { queryStringParameters: { pageSize: 'not-a-number' } }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('maps repository list errors to HTTP responses', async () => {
    const repository = okRepository({
      list: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> =>
          repoErr(error('repository_unavailable')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(event('GET', '/invoices'));

    expect(response.statusCode).toBe(503);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'repository_unavailable',
        message: 'Repository repository_unavailable error.',
      },
    });
  });

  it('requires an owner for GET /invoices/{id}', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('GET', '/invoices/invoice_1'));

    expect(response.statusCode).toBe(401);
  });

  it('returns a serialized invoice and version for GET /invoices/{id}', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('GET', '/invoices/invoice_1', { pathParameters: { id: 'invoice_1' } }),
    );

    expect(repository.getById).toHaveBeenCalledWith(assertInvoiceId('invoice_1'));
    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toEqual({
      invoice: {
        schemaVersion: 1,
        kind: 'draft',
        id: 'invoice_1',
        currency: { code: 'USD', minorUnitDigits: 2 },
        lines: [],
        roundingMode: 'half_away_from_zero',
        taxRoundingStrategy: 'per_line',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      version: 'v1',
    });
  });

  it('maps invalid invoice IDs to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(event('GET', '/invoices/not valid'));

    expect(response.statusCode).toBe(400);
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('maps repository get not found errors to 404', async () => {
    const repository = okRepository({
      getById: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_not_found')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(event('GET', '/invoices/invoice_1'));

    expect(response.statusCode).toBe(404);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invoice_not_found',
        message: 'Repository invoice_not_found error.',
      },
    });
  });

  it('returns protected 501 JSON responses for mutation stubs', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });

    for (const [method, path] of [
      ['POST', '/invoices/drafts'],
      ['PUT', '/invoices/drafts/invoice_1'],
      ['POST', '/invoices/invoice_1/finalize'],
      ['POST', '/invoices/invoice_1/void'],
      ['DELETE', '/invoices/drafts/invoice_1'],
    ] as const) {
      const response = await handler(event(method, path));
      expect(response.statusCode).toBe(501);
      expect(responseBody(response)).toEqual({
        error: {
          code: 'not_implemented',
          message: 'This invoice API operation is not implemented yet.',
        },
      });
    }
  });

  it('requires an owner before returning mutation stubs', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('POST', '/invoices/drafts'));

    expect(response.statusCode).toBe(401);
  });
});
