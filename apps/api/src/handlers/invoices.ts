import {
  parseInvoiceId,
  parseIsoDate,
  parseUtcTimestamp,
  USD_CURRENCY_DEFINITION,
  type DomainError,
  type InvoiceId,
  type IsoDateString,
  type UtcTimestampString,
} from '@invoice/domain';
import {
  createDraftInvoice,
  createPartySnapshot,
  parseInvoiceNotes,
  parsePartyDisplayName,
  serializeInvoice,
  setDraftInvoiceDates,
  setDraftInvoiceParties,
  setDraftInvoiceText,
  type CreateDraftInvoiceInput,
  type DraftInvoice,
  type InvoiceNotes,
  type PartySnapshot,
} from '@invoice/invoice-domain';
import type {
  InvoiceLifecycleKind,
  InvoiceListQuery,
  InvoiceListSortBy,
  InvoiceListSortDirection,
  InvoiceRecordVersion,
  InvoiceRepositoryError,
} from '@invoice/invoice-repository';
import { parseInvoiceRecordVersion } from '@invoice/invoice-repository';

import { resolveOwnerId, type AuthenticatedEvent } from '../auth/owner';
import { jsonError, jsonResponse, type HttpResponse } from '../http/response';
import {
  createInvoiceRepository,
  type InvoiceRepositoryFactory,
} from '../repository/create-invoice-repository';
import { healthHandler } from './health';

export type ApiGatewayHttpEvent = AuthenticatedEvent &
  Readonly<{
    rawPath?: string;
    pathParameters?: Readonly<Record<string, string | undefined>>;
    queryStringParameters?: Readonly<Record<string, string | undefined>> | null;
    body?: string | null;
    isBase64Encoded?: boolean;
    requestContext?: AuthenticatedEvent['requestContext'] &
      Readonly<{
        http?: Readonly<{
          method?: string;
          path?: string;
        }>;
      }>;
  }>;

export type InvoiceApiHandlerOptions = Readonly<{
  repositoryFactory?: InvoiceRepositoryFactory;
  generateInvoiceId?: () => string;
  now?: () => Date;
}>;

const mutationNotImplementedMessage = 'This invoice API operation is not implemented yet.';

const lifecycleKinds = new Set<InvoiceLifecycleKind>(['draft', 'finalized', 'voided']);
const sortByValues = new Set<InvoiceListSortBy>([
  'updatedAt',
  'createdAt',
  'issueDate',
  'invoiceNumber',
]);
const sortDirectionValues = new Set<InvoiceListSortDirection>(['asc', 'desc']);

const httpMethod = (event: ApiGatewayHttpEvent): string =>
  event.requestContext?.http?.method?.toUpperCase() ?? '';

const requestPath = (event: ApiGatewayHttpEvent): string =>
  event.rawPath ?? event.requestContext?.http?.path ?? '';

const pathInvoiceId = (event: ApiGatewayHttpEvent): string | undefined => {
  const parameterId = event.pathParameters?.id;
  if (parameterId !== undefined) return parameterId;
  const match = /^\/invoices\/([^/]+)(?:\/(?:finalize|void))?$/u.exec(requestPath(event));
  return match?.[1];
};

const pathDraftInvoiceId = (event: ApiGatewayHttpEvent): string | undefined => {
  const parameterId = event.pathParameters?.id;
  if (parameterId !== undefined) return parameterId;
  const match = /^\/invoices\/drafts\/([^/]+)$/u.exec(requestPath(event));
  return match?.[1];
};

const singleQueryValue = (
  event: ApiGatewayHttpEvent,
  key: keyof NonNullable<ApiGatewayHttpEvent['queryStringParameters']>,
): string | undefined => {
  const value = event.queryStringParameters?.[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parsePageSize = (raw: string | undefined): number | undefined | HttpResponse => {
  if (raw === undefined) return undefined;
  if (!/^\d+$/u.test(raw)) return jsonError(400, 'bad_request', 'pageSize must be an integer.');
  const pageSize = Number(raw);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return jsonError(400, 'bad_request', 'pageSize must be between 1 and 100.');
  }
  return pageSize;
};

const parseListQuery = (event: ApiGatewayHttpEvent): InvoiceListQuery | HttpResponse => {
  const kind = singleQueryValue(event, 'kind');
  const search = singleQueryValue(event, 'search');
  const sortBy = singleQueryValue(event, 'sortBy');
  const sortDirection = singleQueryValue(event, 'sortDirection');
  const pageSize = parsePageSize(singleQueryValue(event, 'pageSize'));
  const cursor = singleQueryValue(event, 'cursor');

  if (kind !== undefined && !lifecycleKinds.has(kind as InvoiceLifecycleKind)) {
    return jsonError(400, 'bad_request', 'kind must be draft, finalized, or voided.');
  }
  if (sortBy !== undefined && !sortByValues.has(sortBy as InvoiceListSortBy)) {
    return jsonError(
      400,
      'bad_request',
      'sortBy must be updatedAt, createdAt, issueDate, or invoiceNumber.',
    );
  }
  if (
    sortDirection !== undefined &&
    !sortDirectionValues.has(sortDirection as InvoiceListSortDirection)
  ) {
    return jsonError(400, 'bad_request', 'sortDirection must be asc or desc.');
  }
  if (typeof pageSize !== 'number' && pageSize !== undefined) return pageSize;

  return {
    ...(kind === undefined ? {} : { kind: kind as InvoiceLifecycleKind }),
    ...(search === undefined ? {} : { search }),
    ...(sortBy === undefined ? {} : { sortBy: sortBy as InvoiceListSortBy }),
    ...(sortDirection === undefined
      ? {}
      : { sortDirection: sortDirection as InvoiceListSortDirection }),
    ...(pageSize === undefined ? {} : { pageSize }),
    ...(cursor === undefined ? {} : { cursor }),
  };
};

const repositoryErrorStatus = (error: InvoiceRepositoryError): number => {
  switch (error.code) {
    case 'invoice_not_found':
      return 404;
    case 'invoice_already_exists':
    case 'invoice_conflict':
    case 'invoice_number_conflict':
      return 409;
    case 'invalid_invoice_record_version':
      return 400;
    case 'repository_unavailable':
      return 503;
    case 'invalid_invoice_record':
    case 'repository_invariant_violation':
      return 500;
  }
};

const repositoryErrorResponse = (error: InvoiceRepositoryError): HttpResponse =>
  jsonError(repositoryErrorStatus(error), error.code, error.message);

const domainErrorResponse = (error: DomainError): HttpResponse =>
  jsonError(400, error.code, error.message);

const requireOwner = (event: ApiGatewayHttpEvent): ReturnType<typeof resolveOwnerId> =>
  resolveOwnerId(event);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonBody = (event: ApiGatewayHttpEvent): unknown | HttpResponse => {
  if (event.body === undefined || event.body === null || event.body.trim().length === 0) {
    return {};
  }

  if (event.isBase64Encoded === true) {
    return jsonError(400, 'bad_request', 'Base64-encoded request bodies are not supported.');
  }

  try {
    return JSON.parse(event.body) as unknown;
  } catch {
    return jsonError(400, 'bad_request', 'Request body must be valid JSON.');
  }
};

const parseOptionalInvoiceId = (value: unknown): InvoiceId | HttpResponse => {
  if (typeof value !== 'string') {
    return jsonError(400, 'bad_request', 'draft.id must be a string when provided.');
  }

  const parsed = parseInvoiceId(value);
  if (!parsed.ok) return domainErrorResponse(parsed.error);
  return parsed.value;
};

const parseGeneratedInvoiceId = (generateInvoiceId: () => string): InvoiceId | HttpResponse => {
  const parsed = parseInvoiceId(generateInvoiceId());
  if (!parsed.ok) {
    return jsonError(500, 'internal_error', 'Generated invoice id is invalid.');
  }
  return parsed.value;
};

const parseTimestamp = (date: Date): UtcTimestampString | HttpResponse => {
  const parsed = parseUtcTimestamp(date.toISOString());
  if (!parsed.ok) return domainErrorResponse(parsed.error);
  return parsed.value;
};

const parseOptionalDate = (
  value: unknown,
  fieldName: 'issueDate' | 'dueDate',
): IsoDateString | undefined | HttpResponse => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    return jsonError(400, 'bad_request', `draft.${fieldName} must be a string when provided.`);
  }

  const parsed = parseIsoDate(value);
  if (!parsed.ok) return domainErrorResponse(parsed.error);
  return parsed.value;
};

const parseOptionalNotes = (value: unknown): InvoiceNotes | undefined | HttpResponse => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    return jsonError(400, 'bad_request', 'draft.notes must be a string when provided.');
  }

  const parsed = parseInvoiceNotes(value);
  if (!parsed.ok) return domainErrorResponse(parsed.error);
  return parsed.value;
};

const parseOptionalCustomer = (value: unknown): PartySnapshot | undefined | HttpResponse => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    return jsonError(400, 'bad_request', 'draft.customer must be an object when provided.');
  }

  if (typeof value.displayName !== 'string') {
    return jsonError(400, 'bad_request', 'draft.customer.displayName must be a string.');
  }

  const displayName = parsePartyDisplayName(value.displayName);
  if (!displayName.ok) return domainErrorResponse(displayName.error);

  const customer = createPartySnapshot({ displayName: displayName.value });
  if (!customer.ok) return domainErrorResponse(customer.error);
  return customer.value;
};

const createGeneratedInvoiceId = (): string =>
  `invoice_${globalThis.crypto.randomUUID().replaceAll('-', '_')}`;

const parseCreateDraftInput = (
  event: ApiGatewayHttpEvent,
  generateInvoiceId: () => string,
  now: () => Date,
): CreateDraftInvoiceInput | HttpResponse => {
  const body = parseJsonBody(event);
  if (isHttpResponse(body)) return body;
  if (!isRecord(body)) return jsonError(400, 'bad_request', 'Request body must be an object.');

  const rawDraft = body.draft;
  if (rawDraft !== undefined && !isRecord(rawDraft)) {
    return jsonError(400, 'bad_request', 'draft must be an object when provided.');
  }
  const draft = rawDraft ?? {};

  const id =
    Object.hasOwn(draft, 'id') && draft.id !== undefined
      ? parseOptionalInvoiceId(draft.id)
      : parseGeneratedInvoiceId(generateInvoiceId);
  if (isHttpResponse(id)) return id;

  const timestamp = parseTimestamp(now());
  if (isHttpResponse(timestamp)) return timestamp;

  const customer = parseOptionalCustomer(draft.customer);
  if (isHttpResponse(customer)) return customer;

  const issueDate = parseOptionalDate(draft.issueDate, 'issueDate');
  if (isHttpResponse(issueDate)) return issueDate;

  const dueDate = parseOptionalDate(draft.dueDate, 'dueDate');
  if (isHttpResponse(dueDate)) return dueDate;

  const notes = parseOptionalNotes(draft.notes);
  if (isHttpResponse(notes)) return notes;

  return {
    id,
    currency: USD_CURRENCY_DEFINITION,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(customer === undefined ? {} : { customer }),
    ...(issueDate === undefined ? {} : { issueDate }),
    ...(dueDate === undefined ? {} : { dueDate }),
    ...(notes === undefined ? {} : { notes }),
  };
};

const allowedUpdateDraftFields = new Set([
  'customer',
  'dueDate',
  'id',
  'issueDate',
  'notes',
  'ownerId',
]);

type DraftUpdatePatch = Readonly<{
  expectedVersion: InvoiceRecordVersion;
  customer?: PartySnapshot;
  issueDate?: IsoDateString;
  dueDate?: IsoDateString;
  notes?: InvoiceNotes;
  hasCustomer: boolean;
  hasIssueDate: boolean;
  hasDueDate: boolean;
  hasNotes: boolean;
}>;

const parseUpdateDraftInput = (event: ApiGatewayHttpEvent): DraftUpdatePatch | HttpResponse => {
  const body = parseJsonBody(event);
  if (isHttpResponse(body)) return body;
  if (!isRecord(body)) return jsonError(400, 'bad_request', 'Request body must be an object.');

  if (typeof body.expectedVersion !== 'string') {
    return jsonError(400, 'bad_request', 'expectedVersion is required.');
  }
  const expectedVersion = parseInvoiceRecordVersion(body.expectedVersion);
  if (!expectedVersion.ok) return repositoryErrorResponse(expectedVersion.error);

  if (!isRecord(body.draft)) {
    return jsonError(400, 'bad_request', 'draft must be an object.');
  }

  for (const key of Object.keys(body.draft)) {
    if (!allowedUpdateDraftFields.has(key)) {
      return jsonError(400, 'bad_request', `draft.${key} is not supported for draft updates.`);
    }
  }

  const hasCustomer = Object.hasOwn(body.draft, 'customer');
  const hasIssueDate = Object.hasOwn(body.draft, 'issueDate');
  const hasDueDate = Object.hasOwn(body.draft, 'dueDate');
  const hasNotes = Object.hasOwn(body.draft, 'notes');

  if (!hasCustomer && !hasIssueDate && !hasDueDate && !hasNotes) {
    return jsonError(400, 'bad_request', 'At least one supported draft field is required.');
  }

  const customer = hasCustomer ? parseOptionalCustomer(body.draft.customer) : undefined;
  if (isHttpResponse(customer)) return customer;

  const issueDate = hasIssueDate ? parseOptionalDate(body.draft.issueDate, 'issueDate') : undefined;
  if (isHttpResponse(issueDate)) return issueDate;

  const dueDate = hasDueDate ? parseOptionalDate(body.draft.dueDate, 'dueDate') : undefined;
  if (isHttpResponse(dueDate)) return dueDate;

  const notes = hasNotes ? parseOptionalNotes(body.draft.notes) : undefined;
  if (isHttpResponse(notes)) return notes;

  return {
    expectedVersion: expectedVersion.value,
    ...(customer === undefined ? {} : { customer }),
    ...(issueDate === undefined ? {} : { issueDate }),
    ...(dueDate === undefined ? {} : { dueDate }),
    ...(notes === undefined ? {} : { notes }),
    hasCustomer,
    hasIssueDate,
    hasDueDate,
    hasNotes,
  };
};

const applyDraftUpdatePatch = (
  draft: DraftInvoice,
  patch: DraftUpdatePatch,
  updatedAt: UtcTimestampString,
): DraftInvoice | HttpResponse => {
  let current = draft;

  if (patch.hasCustomer && patch.customer !== undefined) {
    const updated = setDraftInvoiceParties(current, { customer: patch.customer }, updatedAt);
    if (!updated.ok) return domainErrorResponse(updated.error);
    current = updated.value;
  }

  if (patch.hasIssueDate || patch.hasDueDate) {
    const updated = setDraftInvoiceDates(
      current,
      {
        ...(patch.hasIssueDate ? { issueDate: patch.issueDate } : {}),
        ...(patch.hasDueDate ? { dueDate: patch.dueDate } : {}),
      },
      updatedAt,
    );
    if (!updated.ok) return domainErrorResponse(updated.error);
    current = updated.value;
  }

  if (patch.hasNotes && patch.notes !== undefined) {
    const updated = setDraftInvoiceText(current, { notes: patch.notes }, updatedAt);
    if (!updated.ok) return domainErrorResponse(updated.error);
    current = updated.value;
  }

  return current;
};

const isHttpResponse = (value: unknown): value is HttpResponse =>
  isRecord(value) && typeof value.statusCode === 'number';

export const createInvoiceApiHandler = ({
  repositoryFactory = createInvoiceRepository,
  generateInvoiceId = createGeneratedInvoiceId,
  now = () => new Date(),
}: InvoiceApiHandlerOptions = {}) => {
  const handler = async (event: ApiGatewayHttpEvent): Promise<HttpResponse> => {
    const method = httpMethod(event);
    const path = requestPath(event);

    if (method === 'GET' && path === '/health') return healthHandler();

    if (method === 'GET' && path === '/invoices') {
      const owner = requireOwner(event);
      if (!owner.ok) return owner.response;

      const query = parseListQuery(event);
      if ('statusCode' in query) return query;

      const result = await repositoryFactory(owner.ownerId).list(query);
      if (!result.ok) return repositoryErrorResponse(result.error);

      return jsonResponse(200, {
        items: result.value.items,
        ...(result.value.nextCursor === undefined ? {} : { nextCursor: result.value.nextCursor }),
      });
    }

    if (method === 'GET' && /^\/invoices\/[^/]+$/u.test(path)) {
      const owner = requireOwner(event);
      if (!owner.ok) return owner.response;

      const rawId = pathInvoiceId(event);
      const parsedId = rawId === undefined ? undefined : parseInvoiceId(rawId);
      if (parsedId === undefined || !parsedId.ok) {
        return jsonError(400, 'bad_request', 'Invoice id is invalid.');
      }

      const result = await repositoryFactory(owner.ownerId).getById(parsedId.value);
      if (!result.ok) return repositoryErrorResponse(result.error);

      return jsonResponse(200, {
        invoice: serializeInvoice(result.value.invoice),
        version: result.value.version,
      });
    }

    if (method === 'POST' && path === '/invoices/drafts') {
      const owner = requireOwner(event);
      if (!owner.ok) return owner.response;

      const input = parseCreateDraftInput(event, generateInvoiceId, now);
      if (isHttpResponse(input)) return input;

      const invoice = createDraftInvoice(input);
      if (!invoice.ok) return domainErrorResponse(invoice.error);

      const result = await repositoryFactory(owner.ownerId).createDraft(invoice.value);
      if (!result.ok) return repositoryErrorResponse(result.error);

      return jsonResponse(201, {
        invoice: serializeInvoice(result.value.invoice),
        version: result.value.version,
      });
    }

    if (method === 'PUT' && /^\/invoices\/drafts\/[^/]+$/u.test(path)) {
      const owner = requireOwner(event);
      if (!owner.ok) return owner.response;

      const rawId = pathDraftInvoiceId(event);
      const parsedId = rawId === undefined ? undefined : parseInvoiceId(rawId);
      if (parsedId === undefined || !parsedId.ok) {
        return jsonError(400, 'bad_request', 'Invoice id is invalid.');
      }

      const patch = parseUpdateDraftInput(event);
      if (isHttpResponse(patch)) return patch;

      const repository = repositoryFactory(owner.ownerId);
      const existing = await repository.getById(parsedId.value);
      if (!existing.ok) return repositoryErrorResponse(existing.error);

      if (existing.value.invoice.kind !== 'draft') {
        return jsonError(409, 'invoice_conflict', 'Only draft invoices can be updated.');
      }

      const timestamp = parseTimestamp(now());
      if (isHttpResponse(timestamp)) return timestamp;

      const updatedDraft = applyDraftUpdatePatch(existing.value.invoice, patch, timestamp);
      if (isHttpResponse(updatedDraft)) return updatedDraft;

      const result = await repository.updateDraft(updatedDraft, {
        expectedVersion: patch.expectedVersion,
      });
      if (!result.ok) return repositoryErrorResponse(result.error);

      return jsonResponse(200, {
        invoice: serializeInvoice(result.value.invoice),
        version: result.value.version,
      });
    }

    if (
      (method === 'POST' && /^\/invoices\/[^/]+\/finalize$/u.test(path)) ||
      (method === 'POST' && /^\/invoices\/[^/]+\/void$/u.test(path)) ||
      (method === 'DELETE' && /^\/invoices\/drafts\/[^/]+$/u.test(path))
    ) {
      const owner = requireOwner(event);
      if (!owner.ok) return owner.response;
      return jsonError(501, 'not_implemented', mutationNotImplementedMessage);
    }

    return jsonError(404, 'not_found', 'Route not found.');
  };

  return handler;
};

export const apiHandler = createInvoiceApiHandler();
