import type { InvoiceApiClient } from '@invoice/api-client';
import { FoundationCard } from '@invoice/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  AppRegistry,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { createCognitoWebAuthClient, type AuthSession, type WebAuthClient } from './lib/auth';
import {
  formatMissingConfigMessage,
  readWebRuntimeConfig,
  type WebRuntimeConfigResult,
} from './lib/config';
import { createWebInvoiceApiClient, formatSafeApiErrorMessage } from './lib/invoice-api';

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

type StatusMessage = Readonly<{
  status: RequestStatus;
  message: string;
}>;

export type AuthSmokePanelProps = Readonly<{
  configResult?: WebRuntimeConfigResult;
  authClient?: WebAuthClient;
  invoiceClient?: InvoiceApiClient;
}>;

const initialStatus: StatusMessage = { status: 'idle', message: 'Not checked yet.' };

const statusStyle = (status: RequestStatus): TextStyle => {
  if (status === 'success') return styles.successText;
  if (status === 'error') return styles.errorText;
  if (status === 'loading') return styles.mutedText;
  return styles.bodyText;
};

export function AuthSmokePanel({
  configResult = readWebRuntimeConfig(),
  authClient,
  invoiceClient,
}: AuthSmokePanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<AuthSession | null>(
    () => authClient?.getSession() ?? null,
  );
  const [healthStatus, setHealthStatus] = useState<StatusMessage>(initialStatus);
  const [signInStatus, setSignInStatus] = useState<StatusMessage>({
    status: 'idle',
    message: 'Signed out.',
  });
  const [listStatus, setListStatus] = useState<StatusMessage>(initialStatus);

  const config = configResult.config;

  const resolvedAuthClient = useMemo(() => {
    if (authClient !== undefined) return authClient;
    if (config === null) return null;
    return createCognitoWebAuthClient({ config });
  }, [authClient, config]);

  const resolvedInvoiceClient = useMemo(() => {
    if (invoiceClient !== undefined) return invoiceClient;
    if (config === null || resolvedAuthClient === null) return null;
    return createWebInvoiceApiClient({ config, authClient: resolvedAuthClient });
  }, [config, invoiceClient, resolvedAuthClient]);

  useEffect(() => {
    if (resolvedAuthClient === null) return undefined;
    return resolvedAuthClient.subscribe((nextSession) => {
      setSession(nextSession);
      if (nextSession === null) {
        setListStatus(initialStatus);
        setSignInStatus({ status: 'idle', message: 'Signed out.' });
      }
    });
  }, [resolvedAuthClient]);

  const runHealthCheck = async () => {
    if (resolvedInvoiceClient === null) {
      setHealthStatus({ status: 'error', message: 'Health check requires complete config.' });
      return;
    }

    setHealthStatus({ status: 'loading', message: 'Checking public health route.' });
    try {
      const health = await resolvedInvoiceClient.health();
      setHealthStatus({
        status: 'success',
        message: `Public health route returned ${health.service}.`,
      });
    } catch (error) {
      setHealthStatus({ status: 'error', message: formatSafeApiErrorMessage(error) });
    }
  };

  const runInvoiceListSmokeCheck = async () => {
    if (resolvedInvoiceClient === null) {
      setListStatus({ status: 'error', message: 'Invoice list check requires complete config.' });
      return;
    }

    setListStatus({ status: 'loading', message: 'Checking authenticated invoice list.' });
    try {
      const response = await resolvedInvoiceClient.listInvoices();
      setListStatus({
        status: 'success',
        message: `Authenticated invoice list returned ${response.items.length} item(s).`,
      });
    } catch (error) {
      setListStatus({ status: 'error', message: formatSafeApiErrorMessage(error) });
    }
  };

  const handleSignIn = () => {
    if (resolvedAuthClient === null) {
      setSignInStatus({ status: 'error', message: 'Sign-in requires complete config.' });
      return;
    }

    setSignInStatus({ status: 'loading', message: 'Signing in.' });
    void resolvedAuthClient
      .signIn({ email, password })
      .then(() => {
        setPassword('');
        setSignInStatus({ status: 'success', message: 'Signed in. Token values are hidden.' });
      })
      .catch((error: unknown) => {
        setSignInStatus({ status: 'error', message: formatSafeApiErrorMessage(error) });
      });
  };

  const handleSignOut = () => {
    resolvedAuthClient?.signOut();
    setPassword('');
  };

  const configPresent = config !== null;

  return (
    <View style={styles.page}>
      <FoundationCard title="UnifiedInvoice API Session">
        Dev auth and read-only API smoke checks.
      </FoundationCard>

      <View style={styles.panel}>
        <StatusRow
          label="Configuration"
          message={
            configPresent
              ? 'All required web env values are present.'
              : formatMissingConfigMessage(configResult.missing)
          }
          tone={configPresent ? 'success' : 'error'}
        />

        <Section title="Public API">
          <Text style={statusStyle(healthStatus.status)}>{healthStatus.message}</Text>
          <ActionButton label="Check health" onPress={runHealthCheck} disabled={!configPresent} />
        </Section>

        <Section title="Auth Session">
          {session === null ? (
            <View style={styles.form}>
              <Text style={styles.bodyText}>Signed out.</Text>
              <LabeledInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoComplete="email"
              />
              <LabeledInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <ActionButton
                label="Sign in"
                onPress={() => handleSignIn()}
                disabled={!configPresent || signInStatus.status === 'loading'}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.successText}>Signed in. Token values are hidden.</Text>
              <ActionButton label="Sign out" onPress={handleSignOut} />
            </View>
          )}
          <Text style={statusStyle(signInStatus.status)}>{signInStatus.message}</Text>
        </Section>

        <Section title="Authenticated API">
          <Text style={statusStyle(listStatus.status)}>{listStatus.message}</Text>
          <ActionButton
            label="Check invoice list"
            onPress={runInvoiceListSmokeCheck}
            disabled={session === null || !configPresent || listStatus.status === 'loading'}
          />
        </Section>
      </View>
    </View>
  );
}

export function App() {
  return <AuthSmokePanel />;
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatusRow({
  label,
  message,
  tone,
}: Readonly<{ label: string; message: string; tone: 'success' | 'error' }>) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={tone === 'success' ? styles.successText : styles.errorText}>{message}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  autoComplete,
}: Readonly<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoComplete?: 'email';
}>) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoComplete={autoComplete}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
}: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : undefined,
        pressed && !disabled ? styles.buttonPressed : undefined,
      ]}
    >
      <Text style={disabled ? styles.buttonTextDisabled : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    minHeight: '100%',
    padding: 24,
    backgroundColor: '#f6f8fa',
    gap: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 720,
    gap: 16,
  },
  section: {
    borderWidth: 1,
    borderColor: '#d6dbe1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18202a',
  },
  bodyText: {
    color: '#394453',
    fontSize: 15,
    lineHeight: 22,
  },
  mutedText: {
    color: '#586575',
    fontSize: 15,
    lineHeight: 22,
  },
  successText: {
    color: '#116329',
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: '#b42318',
    fontSize: 15,
    lineHeight: 22,
  },
  statusRow: {
    borderWidth: 1,
    borderColor: '#d6dbe1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 6,
  },
  statusLabel: {
    color: '#18202a',
    fontSize: 15,
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#394453',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#aeb7c2',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#18202a',
    backgroundColor: '#ffffff',
    fontSize: 16,
  },
  button: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#1f6feb',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonPressed: {
    backgroundColor: '#1a5fc8',
  },
  buttonDisabled: {
    backgroundColor: '#d6dbe1',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextDisabled: {
    color: '#586575',
    fontSize: 15,
    fontWeight: '700',
  },
} satisfies Record<string, ViewStyle | TextStyle>);

AppRegistry.registerComponent('InvoiceWeb', () => App);
