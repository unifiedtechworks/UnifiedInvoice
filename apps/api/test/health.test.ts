import { describe, expect, it } from 'vitest';

import { healthHandler } from '../src';

describe('healthHandler', () => {
  it('returns the service health response as JSON', async () => {
    const response = await healthHandler();
    const body = JSON.parse(response.body) as { ok: boolean; service: string };

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe('unified-invoice-api');
    expect(response.headers['content-type']).toBe('application/json');
  });
});
