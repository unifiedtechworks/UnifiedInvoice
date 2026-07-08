import { assertInvoiceId, type UtcTimestampString } from '@invoice/domain';
import type { DraftInvoice, Invoice } from '@invoice/invoice-domain';
import type { InvoiceRepository, InvoiceRepositoryResult } from '@invoice/invoice-repository';
import {
  assertInvoiceRecordVersion,
  makeInvoiceRepositoryError,
  repoErr,
  repoOk,
} from '@invoice/invoice-repository';
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

const finalizedInvoice = Object.freeze({
  ...draftInvoice,
  kind: 'finalized',
}) as unknown as Invoice;

const okRepository = (overrides: Partial<InvoiceRepository> = {}): InvoiceRepository =>
  ({
    createDraft: vi.fn(async (invoice: DraftInvoice) => repoOk({ invoice, version: 'v-created' })),
    updateDraft: vi.fn(async (invoice: DraftInvoice) => repoOk({ invoice, version: 'v-updated' })),
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

const deterministicOptions = {
  generateInvoiceId: () => 'invoice_created',
  now: () => new Date('2026-01-02T03:04:05.000Z'),
} as const;

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

  it('creates authenticated draft invoices for the JWT owner', async () => {
    const repository = okRepository();
    const repositoryFactory = vi.fn(() => repository);
    const handler = createInvoiceApiHandler({ repositoryFactory, ...deterministicOptions });

    const response = await handler(
      event('POST', '/invoices/drafts', {
        body: JSON.stringify({
          draft: {
            id: 'invoice_from_client',
            ownerId: 'body-owner-ignored',
            customer: { displayName: 'Acme Co' },
            issueDate: '2026-02-01',
            dueDate: '2026-02-15',
            notes: 'First draft',
          },
        }),
      }),
    );

    expect(repositoryFactory).toHaveBeenCalledWith('owner-123');
    expect(repository.createDraft).toHaveBeenCalledTimes(1);
    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'draft',
        id: assertInvoiceId('invoice_from_client'),
        customer: { displayName: 'Acme Co' },
        issueDate: '2026-02-01',
        dueDate: '2026-02-15',
        notes: 'First draft',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
      }),
    );
    expect(response.statusCode).toBe(201);
    expect(responseBody(response)).toEqual({
      invoice: {
        schemaVersion: 1,
        kind: 'draft',
        id: 'invoice_from_client',
        customer: { displayName: 'Acme Co' },
        issueDate: '2026-02-01',
        dueDate: '2026-02-15',
        currency: { code: 'USD', minorUnitDigits: 2 },
        lines: [],
        roundingMode: 'half_away_from_zero',
        taxRoundingStrategy: 'per_line',
        notes: 'First draft',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
      },
      version: 'v-created',
    });
  });

  it('supports minimal draft creation with a generated invoice id', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(event('POST', '/invoices/drafts', { body: '{}' }));

    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'draft',
        id: assertInvoiceId('invoice_created'),
        currency: { code: 'USD', minorUnitDigits: 2 },
        lines: [],
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
      }),
    );
    expect(response.statusCode).toBe(201);
    expect(responseBody(response)).toMatchObject({
      invoice: { kind: 'draft', id: 'invoice_created', lines: [] },
      version: 'v-created',
    });
  });

  it('maps malformed draft JSON to 400 before calling the repository', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(event('POST', '/invoices/drafts', { body: '{"draft":' }));

    expect(response.statusCode).toBe(400);
    expect(repository.createDraft).not.toHaveBeenCalled();
    expect(responseBody(response)).toEqual({
      error: {
        code: 'bad_request',
        message: 'Request body must be valid JSON.',
      },
    });
  });

  it('maps draft validation errors to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('POST', '/invoices/drafts', {
        body: JSON.stringify({
          draft: {
            issueDate: '2026-02-15',
            dueDate: '2026-02-01',
          },
        }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.createDraft).not.toHaveBeenCalled();
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invalid_invoice',
        message: 'Due date must not precede issue date.',
      },
    });
  });

  it('requires an owner for POST /invoices/drafts', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('POST', '/invoices/drafts'));

    expect(response.statusCode).toBe(401);
  });

  it('maps duplicate draft IDs to 409', async () => {
    const repository = okRepository({
      createDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> =>
          repoErr(error('invoice_already_exists')),
      ),
    });
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(event('POST', '/invoices/drafts', { body: '{}' }));

    expect(response.statusCode).toBe(409);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invoice_already_exists',
        message: 'Repository invoice_already_exists error.',
      },
    });
  });

  it('maps draft repository unavailability to 503', async () => {
    const repository = okRepository({
      createDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> =>
          repoErr(error('repository_unavailable')),
      ),
    });
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(event('POST', '/invoices/drafts', { body: '{}' }));

    expect(response.statusCode).toBe(503);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'repository_unavailable',
        message: 'Repository repository_unavailable error.',
      },
    });
  });

  it('updates authenticated draft invoices using the path id and expected version', async () => {
    const repository = okRepository();
    const repositoryFactory = vi.fn(() => repository);
    const handler = createInvoiceApiHandler({ repositoryFactory, ...deterministicOptions });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({
          expectedVersion: 'v1',
          ownerId: 'body-owner-ignored',
          draft: {
            id: 'ignored_body_id',
            ownerId: 'also-ignored',
            customer: { displayName: 'Updated Customer' },
            issueDate: '2026-03-01',
            dueDate: '2026-03-15',
            notes: 'Updated notes',
          },
        }),
      }),
    );

    expect(repositoryFactory).toHaveBeenCalledWith('owner-123');
    expect(repository.getById).toHaveBeenCalledWith(assertInvoiceId('invoice_1'));
    expect(repository.updateDraft).toHaveBeenCalledTimes(1);
    expect(repository.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'draft',
        id: assertInvoiceId('invoice_1'),
        customer: { displayName: 'Updated Customer' },
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        notes: 'Updated notes',
        updatedAt: '2026-01-02T03:04:05.000Z',
      }),
      { expectedVersion: 'v1' },
    );
    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toEqual({
      invoice: {
        schemaVersion: 1,
        kind: 'draft',
        id: 'invoice_1',
        customer: { displayName: 'Updated Customer' },
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        currency: { code: 'USD', minorUnitDigits: 2 },
        lines: [],
        roundingMode: 'half_away_from_zero',
        taxRoundingStrategy: 'per_line',
        notes: 'Updated notes',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
      },
      version: 'v-updated',
    });
  });

  it('requires an owner for PUT /invoices/drafts/{id}', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('PUT', '/invoices/drafts/invoice_1'));

    expect(response.statusCode).toBe(401);
  });

  it('maps malformed update JSON to 400 before loading the repository', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', { body: '{"draft":' }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.updateDraft).not.toHaveBeenCalled();
  });

  it('requires expectedVersion for draft updates', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ draft: { notes: 'Missing expected version' } }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('validates expectedVersion for draft updates', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'not valid', draft: { notes: 'Bad version' } }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invalid_invoice_record_version',
        message:
          'Invoice record version must be a non-empty opaque string of at most 128 characters with no whitespace or ASCII control characters.',
      },
    });
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('maps invalid draft update invoice IDs to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/not valid', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: { notes: 'Valid body' } }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('maps unsupported draft update fields to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: { lineItems: [] } }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('maps missing draft invoices to 404 for updates', async () => {
    const repository = okRepository({
      getById: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_not_found')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: { notes: 'Updated notes' } }),
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(repository.updateDraft).not.toHaveBeenCalled();
  });

  it('maps non-draft existing invoices to 409 for updates', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizedInvoice, version: assertInvoiceRecordVersion('v1') }),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: { notes: 'Updated notes' } }),
      }),
    );

    expect(response.statusCode).toBe(409);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invoice_conflict',
        message: 'Only draft invoices can be updated.',
      },
    });
    expect(repository.updateDraft).not.toHaveBeenCalled();
  });

  it('maps stale expected versions to 409 for updates', async () => {
    const repository = okRepository({
      updateDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_conflict')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'stale-v1', draft: { notes: 'Updated notes' } }),
      }),
    );

    expect(response.statusCode).toBe(409);
  });

  it('maps repository unavailability to 503 for updates', async () => {
    const repository = okRepository({
      updateDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> =>
          repoErr(error('repository_unavailable')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: { notes: 'Updated notes' } }),
      }),
    );

    expect(response.statusCode).toBe(503);
  });

  it('maps draft update domain validation errors to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({
          expectedVersion: 'v1',
          draft: { issueDate: '2026-03-15', dueDate: '2026-03-01' },
        }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.updateDraft).not.toHaveBeenCalled();
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invalid_invoice',
        message: 'Due date must not precede issue date.',
      },
    });
  });

  it('returns protected 501 JSON responses for remaining mutation stubs', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });

    for (const [method, path] of [
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

  it('requires an owner before returning remaining mutation stubs', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('POST', '/invoices/invoice_1/finalize'));

    expect(response.statusCode).toBe(401);
  });
});
