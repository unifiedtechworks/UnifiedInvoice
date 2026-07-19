import { InvoiceApiAuthError, type FetchLike } from '@invoice/api-client';
import { describe, expect, it, vi } from 'vitest';

import type { WebRuntimeConfig } from '../src/lib/config';
import { createWebInvoiceApiClient } from '../src/lib/invoice-api';

const config: WebRuntimeConfig = {
  apiBaseUrl: 'https://api.example.test/',
  cognitoUserPoolId: 'pool-placeholder',
  cognitoUserPoolClientId: 'client-placeholder',
  awsRegion: 'us-west-2',
};

describe('web invoice API client wiring', () => {
  it('calls public health without requesting a token', async () => {
    const getAccessToken = vi.fn(() => {
      throw new Error('health should not request a token');
    });
    const fetchImpl: FetchLike = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, service: 'unified-invoice-api' }), { status: 200 }),
    );

    const client = createWebInvoiceApiClient({
      config,
      authClient: { getAccessToken },
      fetchImpl,
    });

    await expect(client.health()).resolves.toEqual({
      ok: true,
      service: 'unified-invoice-api',
    });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.test/health', expect.any(Object));
  });

  it('uses the auth token provider for authenticated list calls', async () => {
    const getAccessToken = vi.fn(() => 'placeholder-access-token');
    const fetchImpl: FetchLike = vi.fn(
      async () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );

    const client = createWebInvoiceApiClient({
      config,
      authClient: { getAccessToken },
      fetchImpl,
    });

    await expect(client.listInvoices()).resolves.toEqual({ items: [] });

    const requestInit = vi.mocked(fetchImpl).mock.calls[0]?.[1];
    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(new Headers(requestInit?.headers).get('authorization')).toBe(
      'Bearer placeholder-access-token',
    );
  });

  it('requires a token for authenticated list calls', async () => {
    const fetchImpl: FetchLike = vi.fn(
      async () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    const client = createWebInvoiceApiClient({
      config,
      authClient: { getAccessToken: () => null },
      fetchImpl,
    });

    await expect(client.listInvoices()).rejects.toBeInstanceOf(InvoiceApiAuthError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
