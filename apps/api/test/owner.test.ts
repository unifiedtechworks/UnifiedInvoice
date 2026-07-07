import { describe, expect, it } from 'vitest';

import { resolveOwnerId } from '../src/auth/owner';

describe('resolveOwnerId', () => {
  it('resolves the owner from the JWT sub claim first', () => {
    const result = resolveOwnerId({
      requestContext: {
        authorizer: {
          jwt: { claims: { sub: 'owner-sub', username: 'fallback-user' } },
        },
      },
    });

    expect(result).toEqual({ ok: true, ownerId: 'owner-sub' });
  });

  it('falls back to the username claim only when sub is absent', () => {
    const result = resolveOwnerId({
      requestContext: {
        authorizer: {
          jwt: { claims: { username: 'fallback-user' } },
        },
      },
    });

    expect(result).toEqual({ ok: true, ownerId: 'fallback-user' });
  });

  it('rejects requests without an owner claim', () => {
    const result = resolveOwnerId({
      requestContext: {
        authorizer: {
          jwt: { claims: {} },
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.statusCode).toBe(401);
      expect(JSON.parse(result.response.body)).toEqual({
        error: {
          code: 'unauthorized',
          message: 'Authenticated owner could not be resolved from JWT claims.',
        },
      });
    }
  });
});
