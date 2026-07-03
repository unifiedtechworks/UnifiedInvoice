import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts', 'infra/cdk/**/*.test.ts'],
    globals: true,
  },
});
