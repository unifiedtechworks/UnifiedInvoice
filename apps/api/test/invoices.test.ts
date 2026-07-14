import {
  assertInvoiceId,
  assertInvoiceLineItemId,
  assertInvoiceNumber,
  assertQuantity,
  parseMoneyFromDecimal,
  USD_CURRENCY_DEFINITION,
  type IsoDateString,
  type UtcTimestampString,
} from '@invoice/domain';
import {
  addDraftInvoiceLine,
  createDraftInvoice,
  createPartySnapshot,
  finalizeInvoice,
  parseInvoiceLineDescription,
  parsePartyDisplayName,
  type DraftInvoice,
  type FinalizedInvoice,
  type Invoice,
  type VoidedInvoice,
} from '@invoice/invoice-domain';
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

const party = (displayName: string) => {
  const parsedName = parsePartyDisplayName(displayName);
  if (!parsedName.ok) throw new Error(`Expected party display name ${displayName}.`);
  const snapshot = createPartySnapshot({ displayName: parsedName.value });
  if (!snapshot.ok) throw new Error(`Expected party snapshot ${displayName}.`);
  return snapshot.value;
};

const lineDescription = (value: string) => {
  const parsed = parseInvoiceLineDescription(value);
  if (!parsed.ok) throw new Error(`Expected invoice line description ${value}.`);
  return parsed.value;
};

const money = (value: string) => {
  const parsed = parseMoneyFromDecimal(value, USD_CURRENCY_DEFINITION);
  if (!parsed.ok) throw new Error(`Expected money ${value}.`);
  return parsed.value;
};

const finalizableDraftInvoice = (() => {
  const createdAt = '2026-01-01T00:00:00.000Z' as UtcTimestampString;
  const draft = createDraftInvoice({
    id: assertInvoiceId('invoice_1'),
    business: party('Unified Tech Works'),
    customer: party('Acme Co'),
    issueDate: '2026-01-02' as IsoDateString,
    dueDate: '2026-01-16' as IsoDateString,
    currency: USD_CURRENCY_DEFINITION,
    createdAt,
    updatedAt: createdAt,
  });
  if (!draft.ok) throw new Error('Expected finalizable draft fixture.');

  const withLine = addDraftInvoiceLine(
    draft.value,
    {
      id: assertInvoiceLineItemId('line_1'),
      position: 0,
      description: lineDescription('Consulting services'),
      quantity: assertQuantity('1'),
      unitPrice: money('10.00'),
    },
    createdAt,
  );
  if (!withLine.ok) throw new Error('Expected finalizable draft line fixture.');
  return withLine.value;
})();

const finalizedInvoice = (() => {
  const finalized = finalizeInvoice(finalizableDraftInvoice, {
    invoiceNumber: assertInvoiceNumber('INV-020'),
    finalizedAt: '2026-01-02T03:04:05.000Z' as UtcTimestampString,
  });
  if (!finalized.ok) throw new Error('Expected finalized invoice fixture.');
  return finalized.value;
})();

const okRepository = (overrides: Partial<InvoiceRepository> = {}): InvoiceRepository =>
  ({
    createDraft: vi.fn(async (invoice: DraftInvoice) => repoOk({ invoice, version: 'v-created' })),
    updateDraft: vi.fn(async (invoice: DraftInvoice) => repoOk({ invoice, version: 'v-updated' })),
    saveFinalized: vi.fn(async (invoice: FinalizedInvoice) =>
      repoOk({ invoice, version: 'v-finalized' }),
    ),
    saveVoided: vi.fn(async (invoice: VoidedInvoice) => repoOk({ invoice, version: 'v-voided' })),
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
    discardDraft: vi.fn(async (id) => repoOk({ id })),
    ...overrides,
  }) as InvoiceRepository;

const error = (code: Parameters<typeof makeInvoiceRepositoryError>[0]) =>
  makeInvoiceRepositoryError(code, `Repository ${code} error.`);

const responseBody = (response: Awaited<ReturnType<ReturnType<typeof createInvoiceApiHandler>>>) =>
  JSON.parse(response.body) as unknown;

const deterministicOptions = {
  generateInvoiceId: () => 'invoice_created',
  generateLineItemId: () => 'line_created',
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

  it('creates draft invoices with finalizable business and line fields', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('POST', '/invoices/drafts', {
        body: JSON.stringify({
          draft: {
            business: { displayName: 'Unified Techworks' },
            customer: { displayName: 'Finalize Customer' },
            issueDate: '2026-03-01',
            dueDate: '2026-03-15',
            notes: 'Ready to finalize',
            lines: [
              {
                description: 'Service description',
                quantity: '2',
                unitPrice: '125.00',
              },
            ],
          },
        }),
      }),
    );

    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'draft',
        id: assertInvoiceId('invoice_created'),
        business: { displayName: 'Unified Techworks' },
        customer: { displayName: 'Finalize Customer' },
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        lines: [
          expect.objectContaining({
            id: assertInvoiceLineItemId('line_created'),
            position: 0,
            description: 'Service description',
            quantity: assertQuantity('2'),
            unitPrice: money('125.00'),
          }),
        ],
      }),
    );
    expect(response.statusCode).toBe(201);
    expect(responseBody(response)).toMatchObject({
      invoice: {
        schemaVersion: 1,
        kind: 'draft',
        id: 'invoice_created',
        business: { displayName: 'Unified Techworks' },
        customer: { displayName: 'Finalize Customer' },
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        lines: [
          {
            id: 'line_created',
            position: 0,
            description: 'Service description',
            quantity: { units: '20000', scale: 4 },
            unitPrice: { currency: 'USD', minorUnits: '12500' },
          },
        ],
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

  it.each([
    ['invalid business shape', { draft: { business: 'not an object' } }, 'bad_request'],
    ['invalid line shape', { draft: { lines: ['not an object'] } }, 'bad_request'],
    [
      'invalid quantity',
      {
        draft: {
          lines: [{ description: 'Service', quantity: 'not-a-quantity', unitPrice: '1.00' }],
        },
      },
      'invalid_quantity',
    ],
    [
      'invalid unit price',
      {
        draft: {
          lines: [{ description: 'Service', quantity: '1', unitPrice: '1.001' }],
        },
      },
      'invalid_money',
    ],
    ['unsupported invoice number', { draft: { invoiceNumber: 'INV-001' } }, 'bad_request'],
    ['unsupported totals', { draft: { totals: {} } }, 'bad_request'],
    ['unsupported payments', { draft: { payments: [] } }, 'bad_request'],
  ])('maps %s in draft creation to 400', async (_label, body, code) => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('POST', '/invoices/drafts', { body: JSON.stringify(body) }),
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toMatchObject({ error: { code } });
    expect(repository.createDraft).not.toHaveBeenCalled();
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

  it('updates draft invoices with finalizable business and replacement lines', async () => {
    const repository = okRepository();
    const repositoryFactory = vi.fn(() => repository);
    const handler = createInvoiceApiHandler({ repositoryFactory, ...deterministicOptions });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({
          expectedVersion: 'v1',
          draft: {
            business: { displayName: 'Unified Techworks' },
            customer: { displayName: 'Updated Customer' },
            issueDate: '2026-03-01',
            dueDate: '2026-03-15',
            lines: [
              {
                description: 'Updated service description',
                quantity: '2',
                unitPrice: '125.00',
              },
            ],
          },
        }),
      }),
    );

    expect(repositoryFactory).toHaveBeenCalledWith('owner-123');
    expect(repository.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'draft',
        id: assertInvoiceId('invoice_1'),
        business: { displayName: 'Unified Techworks' },
        customer: { displayName: 'Updated Customer' },
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        lines: [
          expect.objectContaining({
            id: assertInvoiceLineItemId('line_created'),
            position: 0,
            description: 'Updated service description',
            quantity: assertQuantity('2'),
            unitPrice: money('125.00'),
          }),
        ],
        updatedAt: '2026-01-02T03:04:05.000Z',
      }),
      { expectedVersion: 'v1' },
    );
    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toMatchObject({
      invoice: {
        kind: 'draft',
        id: 'invoice_1',
        business: { displayName: 'Unified Techworks' },
        lines: [
          {
            id: 'line_created',
            description: 'Updated service description',
            quantity: { units: '20000', scale: 4 },
            unitPrice: { currency: 'USD', minorUnits: '12500' },
          },
        ],
      },
      version: 'v-updated',
    });
  });

  it('keeps existing draft lines when update omits lines', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizableDraftInvoice, version: assertInvoiceRecordVersion('v1') }),
      ),
    });
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: { notes: 'Keep lines' } }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(repository.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Keep lines',
        lines: finalizableDraftInvoice.lines,
      }),
      { expectedVersion: 'v1' },
    );
  });

  it('removes all draft lines when update provides an empty lines array', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizableDraftInvoice, version: assertInvoiceRecordVersion('v1') }),
      ),
    });
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: { lines: [] } }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(repository.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [],
        updatedAt: '2026-01-02T03:04:05.000Z',
      }),
      { expectedVersion: 'v1' },
    );
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

  it.each([
    [
      'invalid business shape',
      { expectedVersion: 'v1', draft: { business: 'not an object' } },
      'bad_request',
    ],
    [
      'invalid line shape',
      { expectedVersion: 'v1', draft: { lines: ['not an object'] } },
      'bad_request',
    ],
    [
      'invalid quantity',
      {
        expectedVersion: 'v1',
        draft: {
          lines: [{ description: 'Service', quantity: 'not-a-quantity', unitPrice: '1.00' }],
        },
      },
      'invalid_quantity',
    ],
    [
      'invalid unit price',
      {
        expectedVersion: 'v1',
        draft: {
          lines: [{ description: 'Service', quantity: '1', unitPrice: '1.001' }],
        },
      },
      'invalid_money',
    ],
    [
      'unsupported invoice number',
      { expectedVersion: 'v1', draft: { invoiceNumber: 'INV-001' } },
      'bad_request',
    ],
    ['unsupported totals', { expectedVersion: 'v1', draft: { totals: {} } }, 'bad_request'],
    ['unsupported payments', { expectedVersion: 'v1', draft: { payments: [] } }, 'bad_request'],
  ])('maps %s in draft updates to 400', async (_label, body, code) => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('PUT', '/invoices/drafts/invoice_1', { body: JSON.stringify(body) }),
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toMatchObject({ error: { code } });
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

  it('deletes authenticated draft invoices using the path id and expected version', async () => {
    const repository = okRepository();
    const repositoryFactory = vi.fn(() => repository);
    const handler = createInvoiceApiHandler({ repositoryFactory });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({
          id: 'ignored_body_id',
          ownerId: 'body-owner-ignored',
          expectedVersion: 'v1',
        }),
      }),
    );

    expect(repositoryFactory).toHaveBeenCalledWith('owner-123');
    expect(repository.discardDraft).toHaveBeenCalledTimes(1);
    expect(repository.discardDraft).toHaveBeenCalledWith(assertInvoiceId('invoice_1'), {
      expectedVersion: assertInvoiceRecordVersion('v1'),
    });
    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toEqual({ id: 'invoice_1' });
  });

  it('requires an owner for DELETE /invoices/drafts/{id}', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('DELETE', '/invoices/drafts/invoice_1'));

    expect(response.statusCode).toBe(401);
  });

  it('maps malformed draft delete JSON to 400 before calling the repository', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', { body: '{"expectedVersion":' }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.discardDraft).not.toHaveBeenCalled();
  });

  it('requires expectedVersion for draft deletes', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', { body: JSON.stringify({}) }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.discardDraft).not.toHaveBeenCalled();
  });

  it('validates expectedVersion for draft deletes', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'not valid' }),
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
    expect(repository.discardDraft).not.toHaveBeenCalled();
  });

  it('maps invalid draft delete invoice IDs to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/not valid', {
        body: JSON.stringify({ expectedVersion: 'v1' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.discardDraft).not.toHaveBeenCalled();
  });

  it('maps unsupported draft delete fields to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1', draft: {} }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.discardDraft).not.toHaveBeenCalled();
  });

  it('maps non-object draft delete bodies to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify(['not', 'an', 'object']),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.discardDraft).not.toHaveBeenCalled();
  });

  it('maps missing draft invoices to 404 for deletes', async () => {
    const repository = okRepository({
      discardDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_not_found')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1' }),
      }),
    );

    expect(response.statusCode).toBe(404);
  });

  it('maps finalized or voided invoice conflicts to 409 for deletes', async () => {
    const repository = okRepository({
      discardDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_conflict')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1' }),
      }),
    );

    expect(response.statusCode).toBe(409);
  });

  it('maps stale expected versions to 409 for deletes', async () => {
    const repository = okRepository({
      discardDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_conflict')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'stale-v1' }),
      }),
    );

    expect(response.statusCode).toBe(409);
  });

  it('maps repository unavailability to 503 for deletes', async () => {
    const repository = okRepository({
      discardDraft: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> =>
          repoErr(error('repository_unavailable')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('DELETE', '/invoices/drafts/invoice_1', {
        body: JSON.stringify({ expectedVersion: 'v1' }),
      }),
    );

    expect(response.statusCode).toBe(503);
  });

  it('finalizes authenticated draft invoices using the path id and expected version', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({
          invoice: finalizableDraftInvoice,
          version: assertInvoiceRecordVersion('v1'),
        }),
      ),
    });
    const repositoryFactory = vi.fn(() => repository);
    const handler = createInvoiceApiHandler({ repositoryFactory, ...deterministicOptions });

    const response = await handler(
      event('POST', '/invoices/invoice_1/finalize', {
        body: JSON.stringify({
          id: 'ignored_body_id',
          ownerId: 'body-owner-ignored',
          totals: { ignored: true },
          expectedVersion: 'v1',
          invoiceNumber: 'INV-020',
          finalizedAt: '2026-01-02T03:04:05.000Z',
        }),
      }),
    );

    expect(repositoryFactory).toHaveBeenCalledWith('owner-123');
    expect(repository.getById).toHaveBeenCalledWith(assertInvoiceId('invoice_1'));
    expect(repository.saveFinalized).toHaveBeenCalledTimes(1);
    expect(repository.saveFinalized).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'finalized',
        id: assertInvoiceId('invoice_1'),
        invoiceNumber: 'INV-020',
        finalizedAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
      }),
      { expectedVersion: assertInvoiceRecordVersion('v1') },
    );
    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toMatchObject({
      invoice: {
        schemaVersion: 1,
        kind: 'finalized',
        id: 'invoice_1',
        invoiceNumber: 'INV-020',
        lines: [{ id: 'line_1', totalAmount: { currency: 'USD', minorUnits: '1000' } }],
        totals: { grandTotal: { currency: 'USD', minorUnits: '1000' } },
        finalizedAt: '2026-01-02T03:04:05.000Z',
      },
      version: 'v-finalized',
    });
  });

  it('defaults finalizedAt to the handler clock when finalizing', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizableDraftInvoice, version: assertInvoiceRecordVersion('v1') }),
      ),
    });
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('POST', '/invoices/invoice_1/finalize', {
        body: JSON.stringify({ expectedVersion: 'v1', invoiceNumber: 'INV-021' }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(repository.saveFinalized).toHaveBeenCalledWith(
      expect.objectContaining({ finalizedAt: '2026-01-02T03:04:05.000Z' }),
      { expectedVersion: assertInvoiceRecordVersion('v1') },
    );
  });

  it('requires an owner for POST /invoices/{id}/finalize', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('POST', '/invoices/invoice_1/finalize'));

    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['malformed JSON', '{"expectedVersion":', 'bad_request'],
    ['non-object body', JSON.stringify(['not', 'an', 'object']), 'bad_request'],
    ['missing expectedVersion', JSON.stringify({ invoiceNumber: 'INV-020' }), 'bad_request'],
    [
      'invalid expectedVersion',
      JSON.stringify({ expectedVersion: 'not valid', invoiceNumber: 'INV-020' }),
      'invalid_invoice_record_version',
    ],
    ['missing invoiceNumber', JSON.stringify({ expectedVersion: 'v1' }), 'bad_request'],
    [
      'invalid invoiceNumber',
      JSON.stringify({ expectedVersion: 'v1', invoiceNumber: '!invalid' }),
      'invalid_invoice_number',
    ],
    [
      'invalid finalizedAt',
      JSON.stringify({
        expectedVersion: 'v1',
        invoiceNumber: 'INV-020',
        finalizedAt: 'not-a-timestamp',
      }),
      'invalid_timestamp',
    ],
    [
      'unsupported body field',
      JSON.stringify({ expectedVersion: 'v1', invoiceNumber: 'INV-020', payments: [] }),
      'bad_request',
    ],
  ])('maps %s finalize input to 400 before loading the invoice', async (_label, body, code) => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(event('POST', '/invoices/invoice_1/finalize', { body }));

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toMatchObject({ error: { code } });
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.saveFinalized).not.toHaveBeenCalled();
  });

  it('maps invalid finalize invoice IDs to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/not valid/finalize', {
        body: JSON.stringify({ expectedVersion: 'v1', invoiceNumber: 'INV-020' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.saveFinalized).not.toHaveBeenCalled();
  });

  it('maps missing invoices to 404 for finalization', async () => {
    const repository = okRepository({
      getById: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_not_found')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/finalize', {
        body: JSON.stringify({ expectedVersion: 'v1', invoiceNumber: 'INV-020' }),
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(repository.saveFinalized).not.toHaveBeenCalled();
  });

  it('maps non-draft existing invoices to 409 for finalization', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizedInvoice, version: assertInvoiceRecordVersion('v1') }),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/finalize', {
        body: JSON.stringify({ expectedVersion: 'v1', invoiceNumber: 'INV-020' }),
      }),
    );

    expect(response.statusCode).toBe(409);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invoice_conflict',
        message: 'Only draft invoices can be finalized.',
      },
    });
    expect(repository.saveFinalized).not.toHaveBeenCalled();
  });

  it('maps domain finalization validation errors to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/finalize', {
        body: JSON.stringify({ expectedVersion: 'v1', invoiceNumber: 'INV-020' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'missing_required_field',
        message: 'Business snapshot is required.',
      },
    });
    expect(repository.saveFinalized).not.toHaveBeenCalled();
  });

  it.each([
    ['stale expected versions', 'invoice_conflict', 409],
    ['duplicate invoice numbers', 'invoice_number_conflict', 409],
    ['repository unavailability', 'repository_unavailable', 503],
  ] as const)('maps %s to HTTP responses for finalization', async (_label, code, statusCode) => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizableDraftInvoice, version: assertInvoiceRecordVersion('v1') }),
      ),
      saveFinalized: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error(code)),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/finalize', {
        body: JSON.stringify({ expectedVersion: 'v1', invoiceNumber: 'INV-020' }),
      }),
    );

    expect(response.statusCode).toBe(statusCode);
    expect(responseBody(response)).toMatchObject({ error: { code } });
  });

  it('voids authenticated finalized invoices using the path id and expected version', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizedInvoice, version: assertInvoiceRecordVersion('v2') }),
      ),
    });
    const repositoryFactory = vi.fn(() => repository);
    const handler = createInvoiceApiHandler({ repositoryFactory, ...deterministicOptions });

    const response = await handler(
      event('POST', '/invoices/invoice_1/void', {
        body: JSON.stringify({
          id: 'ignored_body_id',
          ownerId: 'body-owner-ignored',
          totals: { ignored: true },
          payments: [{ ignored: true }],
          expectedVersion: 'v2',
          voidReason: 'Customer cancelled',
          voidedAt: '2026-01-02T03:04:05.000Z',
        }),
      }),
    );

    expect(repositoryFactory).toHaveBeenCalledWith('owner-123');
    expect(repository.getById).toHaveBeenCalledWith(assertInvoiceId('invoice_1'));
    expect(repository.saveVoided).toHaveBeenCalledTimes(1);
    expect(repository.saveVoided).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'voided',
        finalized: finalizedInvoice,
        voidedAt: '2026-01-02T03:04:05.000Z',
        voidReason: 'Customer cancelled',
      }),
      { expectedVersion: assertInvoiceRecordVersion('v2') },
    );
    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toMatchObject({
      invoice: {
        schemaVersion: 1,
        kind: 'voided',
        finalized: {
          kind: 'finalized',
          id: 'invoice_1',
          invoiceNumber: 'INV-020',
          totals: { grandTotal: { currency: 'USD', minorUnits: '1000' } },
        },
        voidedAt: '2026-01-02T03:04:05.000Z',
        voidReason: 'Customer cancelled',
      },
      version: 'v-voided',
    });
  });

  it('defaults voidedAt to the handler clock when voiding', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizedInvoice, version: assertInvoiceRecordVersion('v2') }),
      ),
    });
    const handler = createInvoiceApiHandler({
      repositoryFactory: () => repository,
      ...deterministicOptions,
    });

    const response = await handler(
      event('POST', '/invoices/invoice_1/void', {
        body: JSON.stringify({ expectedVersion: 'v2', voidReason: 'Issued in error' }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(repository.saveVoided).toHaveBeenCalledWith(
      expect.objectContaining({ voidedAt: '2026-01-02T03:04:05.000Z' }),
      { expectedVersion: assertInvoiceRecordVersion('v2') },
    );
  });

  it('requires an owner for POST /invoices/{id}/void', async () => {
    const handler = createInvoiceApiHandler({ repositoryFactory: () => okRepository() });
    const response = await handler(unauthorizedEvent('POST', '/invoices/invoice_1/void'));

    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['malformed JSON', '{"expectedVersion":', 'bad_request'],
    ['non-object body', JSON.stringify(['not', 'an', 'object']), 'bad_request'],
    ['missing expectedVersion', JSON.stringify({ voidReason: 'Issued in error' }), 'bad_request'],
    [
      'invalid expectedVersion',
      JSON.stringify({ expectedVersion: 'not valid', voidReason: 'Issued in error' }),
      'invalid_invoice_record_version',
    ],
    ['missing voidReason', JSON.stringify({ expectedVersion: 'v2' }), 'bad_request'],
    [
      'invalid voidReason',
      JSON.stringify({ expectedVersion: 'v2', voidReason: '' }),
      'invalid_void_reason',
    ],
    [
      'invalid voidedAt',
      JSON.stringify({
        expectedVersion: 'v2',
        voidReason: 'Issued in error',
        voidedAt: 'not-a-timestamp',
      }),
      'invalid_timestamp',
    ],
    [
      'unsupported body field',
      JSON.stringify({ expectedVersion: 'v2', voidReason: 'Issued in error', draft: {} }),
      'bad_request',
    ],
  ])('maps %s void input to 400 before loading the invoice', async (_label, body, code) => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(event('POST', '/invoices/invoice_1/void', { body }));

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toMatchObject({ error: { code } });
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.saveVoided).not.toHaveBeenCalled();
  });

  it('maps invalid void invoice IDs to 400', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/not valid/void', {
        body: JSON.stringify({ expectedVersion: 'v2', voidReason: 'Issued in error' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.saveVoided).not.toHaveBeenCalled();
  });

  it('maps missing invoices to 404 for voiding', async () => {
    const repository = okRepository({
      getById: vi.fn(
        async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error('invoice_not_found')),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/void', {
        body: JSON.stringify({ expectedVersion: 'v2', voidReason: 'Issued in error' }),
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(repository.saveVoided).not.toHaveBeenCalled();
  });

  it('maps non-finalized invoices to 409 for voiding', async () => {
    const repository = okRepository();
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/void', {
        body: JSON.stringify({ expectedVersion: 'v1', voidReason: 'Issued in error' }),
      }),
    );

    expect(response.statusCode).toBe(409);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invoice_conflict',
        message: 'Only finalized invoices can be voided.',
      },
    });
    expect(repository.saveVoided).not.toHaveBeenCalled();
  });

  it('maps already voided invoices to 409 for voiding', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({
          invoice: {
            kind: 'voided',
            finalized: finalizedInvoice,
            voidedAt: '2026-01-02T03:04:05.000Z',
            voidReason: 'Issued in error',
          } as unknown as Invoice,
          version: assertInvoiceRecordVersion('v3'),
        }),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/void', {
        body: JSON.stringify({ expectedVersion: 'v3', voidReason: 'Issued in error' }),
      }),
    );

    expect(response.statusCode).toBe(409);
    expect(repository.saveVoided).not.toHaveBeenCalled();
  });

  it('maps domain void validation errors to 400', async () => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizedInvoice, version: assertInvoiceRecordVersion('v2') }),
      ),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/void', {
        body: JSON.stringify({
          expectedVersion: 'v2',
          voidReason: 'Issued in error',
          voidedAt: '2026-01-01T00:00:00.000Z',
        }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({
      error: {
        code: 'invalid_state_transition',
        message: 'Void timestamp must not precede finalized timestamp.',
      },
    });
    expect(repository.saveVoided).not.toHaveBeenCalled();
  });

  it.each([
    ['stale expected versions', 'invoice_conflict', 409],
    ['duplicate invoice numbers', 'invoice_number_conflict', 409],
    ['repository unavailability', 'repository_unavailable', 503],
  ] as const)('maps %s to HTTP responses for voiding', async (_label, code, statusCode) => {
    const repository = okRepository({
      getById: vi.fn(async () =>
        repoOk({ invoice: finalizedInvoice, version: assertInvoiceRecordVersion('v2') }),
      ),
      saveVoided: vi.fn(async (): Promise<InvoiceRepositoryResult<never>> => repoErr(error(code))),
    });
    const handler = createInvoiceApiHandler({ repositoryFactory: () => repository });

    const response = await handler(
      event('POST', '/invoices/invoice_1/void', {
        body: JSON.stringify({ expectedVersion: 'v2', voidReason: 'Issued in error' }),
      }),
    );

    expect(response.statusCode).toBe(statusCode);
    expect(responseBody(response)).toMatchObject({ error: { code } });
  });
});
