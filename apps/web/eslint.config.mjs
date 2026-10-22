// @ts-check
// ESLint flat config for apps/web. Next.js 16 removed `next lint`: `npm run lint` runs the ESLint
// CLI with eslint-config-next. The root eslint.config.js covers the Node/TypeScript workspaces
// and ignores apps/web.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Same conventions as the root config.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // eslint-plugin-react-hooks 7 (shipped with eslint-config-next 16) adds React Compiler
      // diagnostics to its recommended set. The app does not run the React Compiler and relies on
      // the "latest value in a ref" and "reset state in an effect" patterns on purpose (~65 sites).
      // Keep the classic rules (rules-of-hooks, exhaustive-deps) blocking and opt into these when
      // the compiler is adopted (see docs/04).
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts', 'playwright-report/**', 'e2e/.results/**']),
]);
