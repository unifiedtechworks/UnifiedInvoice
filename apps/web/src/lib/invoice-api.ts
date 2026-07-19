import { createInvoiceApiClient, InvoiceApiAuthError, InvoiceApiError } from '@invoice/api-client';
import type { FetchLike, InvoiceApiClient } from '@invoice/api-client';

import type { WebAuthClient } from './auth';
import type { WebRuntimeConfig } from './config';

export type WebInvoiceApiOptions = Readonly<{
  config: WebRuntimeConfig;
  authClient: Pick<WebAuthClient, 'getAccessToken'>;
  fetchImpl?: FetchLike;
}>;

export const createWebInvoiceApiClient = ({
  config,
  authClient,
  fetchImpl,
}: WebInvoiceApiOptions): InvoiceApiClient =>
  createInvoiceApiClient({
    baseUrl: config.apiBaseUrl,
    getAccessToken: () => authClient.getAccessToken(),
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });

export const formatSafeApiErrorMessage = (error: unknown): string => {
  if (error instanceof InvoiceApiAuthError) {
    return 'No active API session is available. Sign in again and retry.';
  }
  if (error instanceof InvoiceApiError) {
    return `Invoice API request failed with status ${error.status}.`;
  }
  if (error instanceof Error && error.name === 'WebAuthError') return error.message;
  return 'The request failed. Check the configuration and try again.';
};
