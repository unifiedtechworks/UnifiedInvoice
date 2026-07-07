import { describe, expect, it } from 'vitest';

import { apiHandler, healthHandler } from '../src';

describe('healthHandler', () => {
  it('returns the service health response as JSON', async () => {
    const response = await healthHandler();
    const body = JSON.parse(response.body) as { ok: boolean; service: string };

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe('unified-invoice-api');
    expect(response.headers['content-type']).toBe('application/json');
  });

  it('keeps GET /health public through the API router', async () => {
    const response = await apiHandler({
      rawPath: '/health',
      requestContext: { http: { method: 'GET', path: '/health' } },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      service: 'unified-invoice-api',
    });
  });
});
