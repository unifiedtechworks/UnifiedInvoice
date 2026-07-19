import { describe, expect, it } from 'vitest';

import { formatMissingConfigMessage, readWebRuntimeConfig } from '../src/lib/config';

describe('web runtime config', () => {
  it('reads required Vite environment variables', () => {
    const result = readWebRuntimeConfig({
      VITE_UNIFIED_INVOICE_API_BASE_URL: ' https://api.example.test ',
      VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_ID: ' pool-placeholder ',
      VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID: ' client-placeholder ',
      VITE_UNIFIED_INVOICE_AWS_REGION: ' us-west-2 ',
    });

    expect(result.missing).toEqual([]);
    expect(result.config).toEqual({
      apiBaseUrl: 'https://api.example.test',
      cognitoUserPoolId: 'pool-placeholder',
      cognitoUserPoolClientId: 'client-placeholder',
      awsRegion: 'us-west-2',
    });
  });

  it('reports missing config without exposing values', () => {
    const result = readWebRuntimeConfig({
      VITE_UNIFIED_INVOICE_API_BASE_URL: '',
    });

    expect(result.config).toBeNull();
    expect(result.missing).toContain('VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID');
    expect(formatMissingConfigMessage(result.missing)).toContain(
      'VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID',
    );
  });
});
