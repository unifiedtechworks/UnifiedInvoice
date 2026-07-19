export type WebRuntimeConfig = Readonly<{
  apiBaseUrl: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  awsRegion: string;
}>;

export type WebRuntimeConfigKey =
  | 'VITE_UNIFIED_INVOICE_API_BASE_URL'
  | 'VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_ID'
  | 'VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID'
  | 'VITE_UNIFIED_INVOICE_AWS_REGION';

export type WebRuntimeConfigResult = Readonly<{
  config: WebRuntimeConfig | null;
  missing: readonly WebRuntimeConfigKey[];
}>;

type EnvSource = Partial<Record<WebRuntimeConfigKey, string | undefined>>;

const requiredKeys: readonly WebRuntimeConfigKey[] = [
  'VITE_UNIFIED_INVOICE_API_BASE_URL',
  'VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_ID',
  'VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID',
  'VITE_UNIFIED_INVOICE_AWS_REGION',
];

const readRequiredEnvValue = (env: EnvSource, key: WebRuntimeConfigKey): string | null => {
  const value = env[key]?.trim();
  return value === undefined || value.length === 0 ? null : value;
};

export const readWebRuntimeConfig = (env: EnvSource = import.meta.env): WebRuntimeConfigResult => {
  const missing = requiredKeys.filter((key) => readRequiredEnvValue(env, key) === null);
  if (missing.length > 0) return { config: null, missing };

  return {
    config: {
      apiBaseUrl: readRequiredEnvValue(env, 'VITE_UNIFIED_INVOICE_API_BASE_URL')!,
      cognitoUserPoolId: readRequiredEnvValue(env, 'VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_ID')!,
      cognitoUserPoolClientId: readRequiredEnvValue(
        env,
        'VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID',
      )!,
      awsRegion: readRequiredEnvValue(env, 'VITE_UNIFIED_INVOICE_AWS_REGION')!,
    },
    missing: [],
  };
};

export const formatMissingConfigMessage = (missing: readonly WebRuntimeConfigKey[]): string =>
  missing.length === 0
    ? 'Web runtime configuration is present.'
    : `Missing web runtime configuration: ${missing.join(', ')}.`;
