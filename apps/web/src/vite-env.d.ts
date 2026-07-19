/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UNIFIED_INVOICE_API_BASE_URL?: string;
  readonly VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID?: string;
  readonly VITE_UNIFIED_INVOICE_AWS_REGION?: string;
}
