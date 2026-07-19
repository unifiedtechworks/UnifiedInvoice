import type { InvoiceApiClient } from '@invoice/api-client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuthSmokePanel } from '../src/App';
import type { AuthSession, WebAuthClient } from '../src/lib/auth';
import type { WebRuntimeConfigResult } from '../src/lib/config';

const completeConfig: WebRuntimeConfigResult = {
  config: {
    apiBaseUrl: 'https://api.example.test',
    cognitoUserPoolId: 'pool-placeholder',
    cognitoUserPoolClientId: 'client-placeholder',
    awsRegion: 'us-west-2',
  },
  missing: [],
};

const createAuthClient = (session: AuthSession | null): WebAuthClient => ({
  getSession: () => session,
  getAccessToken: () => session?.accessToken ?? null,
  signIn: async () => {
    throw new Error('not used in render tests');
  },
  signOut: () => undefined,
  subscribe: () => () => undefined,
});

const invoiceClient: InvoiceApiClient = {
  health: async () => ({ ok: true, service: 'unified-invoice-api' }),
  listInvoices: async () => ({ items: [] }),
  getInvoice: async () => {
    throw new Error('not used in render tests');
  },
  createDraft: async () => {
    throw new Error('not used in render tests');
  },
  updateDraft: async () => {
    throw new Error('not used in render tests');
  },
  deleteDraft: async () => {
    throw new Error('not used in render tests');
  },
  finalizeInvoice: async () => {
    throw new Error('not used in render tests');
  },
  voidInvoice: async () => {
    throw new Error('not used in render tests');
  },
};

describe('AuthSmokePanel', () => {
  it('renders signed-out state', () => {
    const markup = renderToStaticMarkup(
      <AuthSmokePanel
        authClient={createAuthClient(null)}
        configResult={completeConfig}
        invoiceClient={invoiceClient}
      />,
    );

    expect(markup).toContain('Signed out.');
    expect(markup).toContain('Sign in');
  });

  it('renders signed-in state without raw token values', () => {
    const markup = renderToStaticMarkup(
      <AuthSmokePanel
        authClient={createAuthClient({
          accessToken: 'sensitive-placeholder-access-token',
          idToken: 'sensitive-placeholder-id-token',
          expiresAtEpochMs: null,
        })}
        configResult={completeConfig}
        invoiceClient={invoiceClient}
      />,
    );

    expect(markup).toContain('Signed in. Token values are hidden.');
    expect(markup).toContain('Sign out');
    expect(markup).not.toContain('sensitive-placeholder-access-token');
    expect(markup).not.toContain('sensitive-placeholder-id-token');
  });
});
