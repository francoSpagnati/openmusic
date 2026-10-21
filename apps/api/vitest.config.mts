import { defineConfig } from 'vitest/config';
import { testEnv } from '../../scripts/test-env.mjs';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    env: testEnv(),
    globalSetup: ['./test/global-setup.ts'],
    // Suites share one Postgres database and one Redis DB: run files sequentially.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
