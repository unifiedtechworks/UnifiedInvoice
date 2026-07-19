import type { FetchLike } from '@invoice/api-client';

import type { WebRuntimeConfig } from './config';

export type AuthSession = Readonly<{
  accessToken: string;
  idToken: string;
  expiresAtEpochMs: number | null;
}>;

export type SignInInput = Readonly<{
  email: string;
  password: string;
}>;

export type AuthStateListener = (session: AuthSession | null) => void;

export type WebAuthClient = Readonly<{
  getSession(): AuthSession | null;
  getAccessToken(): string | null;
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): void;
  subscribe(listener: AuthStateListener): () => void;
}>;

export class WebAuthError extends Error {
  readonly name = 'WebAuthError';
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type CognitoAuthResponse = Readonly<{
  AuthenticationResult?: Readonly<{
    AccessToken?: string;
    IdToken?: string;
    ExpiresIn?: number;
  }>;
  message?: string;
  __type?: string;
}>;

const parseCognitoResponse = async (response: Response): Promise<CognitoAuthResponse> => {
  try {
    return (await response.json()) as CognitoAuthResponse;
  } catch {
    return {};
  }
};

const safeAuthFailureMessage = (body: CognitoAuthResponse): string => {
  const type = body.__type ?? '';
  if (type.includes('NotAuthorizedException') || type.includes('UserNotFoundException')) {
    return 'Sign-in failed. Check the email and password, then try again.';
  }
  return 'Sign-in failed. Check the web auth configuration and try again.';
};

export const createCognitoWebAuthClient = ({
  config,
  fetchImpl = globalThis.fetch.bind(globalThis),
}: Readonly<{
  config: WebRuntimeConfig;
  fetchImpl?: FetchLike;
}>): WebAuthClient => {
  let currentSession: AuthSession | null = null;
  const listeners = new Set<AuthStateListener>();

  const notify = () => {
    for (const listener of listeners) listener(currentSession);
  };

  const setSession = (session: AuthSession | null) => {
    currentSession = session;
    notify();
  };

  return Object.freeze({
    getSession: () => currentSession,

    getAccessToken: () => currentSession?.accessToken ?? null,

    signIn: async ({ email, password }) => {
      const response = await fetchImpl(`https://cognito-idp.${config.awsRegion}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-amz-json-1.1',
          'x-amz-target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: config.cognitoUserPoolClientId,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
          },
        }),
      });

      const body = await parseCognitoResponse(response);
      if (!response.ok) {
        throw new WebAuthError('sign_in_failed', safeAuthFailureMessage(body));
      }

      const accessToken = body.AuthenticationResult?.AccessToken;
      const idToken = body.AuthenticationResult?.IdToken;
      if (accessToken === undefined || idToken === undefined) {
        throw new WebAuthError('missing_tokens', 'Sign-in did not return a usable session.');
      }

      const expiresInSeconds = body.AuthenticationResult?.ExpiresIn;
      const session: AuthSession = {
        accessToken,
        idToken,
        expiresAtEpochMs:
          typeof expiresInSeconds === 'number' ? Date.now() + expiresInSeconds * 1000 : null,
      };
      setSession(session);
      return session;
    },

    signOut: () => setSession(null),

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
};
