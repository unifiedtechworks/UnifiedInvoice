import { jsonError, type HttpResponse } from '../http/response';

export type JwtClaims = Readonly<Record<string, unknown>>;

export type AuthenticatedEvent = Readonly<{
  requestContext?: Readonly<{
    authorizer?: Readonly<{
      jwt?: Readonly<{
        claims?: JwtClaims;
      }>;
    }>;
  }>;
}>;

export type OwnerResolution =
  | Readonly<{ ok: true; ownerId: string }>
  | Readonly<{ ok: false; response: HttpResponse }>;

const claimString = (claims: JwtClaims | undefined, key: string): string | undefined => {
  const value = claims?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveOwnerId = (event: AuthenticatedEvent): OwnerResolution => {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const ownerId = claimString(claims, 'sub') ?? claimString(claims, 'username');

  if (ownerId === undefined) {
    return {
      ok: false,
      response: jsonError(
        401,
        'unauthorized',
        'Authenticated owner could not be resolved from JWT claims.',
      ),
    };
  }

  return { ok: true, ownerId };
};
