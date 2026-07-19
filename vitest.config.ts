import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: [{ find: /^react-native$/, replacement: require.resolve('react-native-web') }],
  },
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/api/**/*.test.ts',
      'apps/web/**/*.test.ts',
      'apps/web/**/*.test.tsx',
      'infra/cdk/**/*.test.ts',
    ],
    globals: true,
  },
});
