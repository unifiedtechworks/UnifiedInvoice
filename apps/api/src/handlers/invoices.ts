import { parseInvoiceId } from '@invoice/domain';
import { serializeInvoice } from '@invoice/invoice-domain';
import type {
  InvoiceLifecycleKind,
  InvoiceListQuery,
  InvoiceListSortBy,
  InvoiceListSortDirection,
  InvoiceRepositoryError,
} from '@invoice/invoice-repository';

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

const requireOwner = (event: ApiGatewayHttpEvent): ReturnType<typeof resolveOwnerId> =>
  resolveOwnerId(event);

export const createInvoiceApiHandler = ({
  repositoryFactory = createInvoiceRepository,
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

    if (
      (method === 'POST' && path === '/invoices/drafts') ||
      (method === 'PUT' && /^\/invoices\/drafts\/[^/]+$/u.test(path)) ||
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
