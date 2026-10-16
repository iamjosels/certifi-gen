import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ONLY_RELATIVE_IMPORTS = {
  regex: '^(?!\\.)',
  message: 'This layer must stay free of external libraries (relative imports only).',
};

const UI_FORBIDDEN_LIBRARIES = [
  'pdf-lib',
  '@pdf-lib/fontkit',
  'pdfjs-dist',
  'jszip',
  'xlsx',
  'mammoth',
  'papaparse',
  'fflate',
].map((name) => ({
  name,
  message: 'UI code must use the application ports instead of calling this library directly.',
}));

export default defineConfig(
  {
    ignores: [
      'dist',
      'coverage',
      'fixtures',
      'vendor',
      'public',
      'playwright-report',
      'test-results',
      'node_modules',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: [
                './src/application',
                './src/infrastructure',
                './src/workers',
                './src/ui',
                './src/composition-root.ts',
                './src/main.tsx',
              ],
              message: 'domain must not depend on any other layer.',
            },
            {
              target: './src/application',
              from: [
                './src/infrastructure',
                './src/workers',
                './src/ui',
                './src/composition-root.ts',
                './src/main.tsx',
              ],
              message: 'application may only depend on domain.',
            },
            {
              target: './src/infrastructure',
              from: ['./src/ui', './src/composition-root.ts', './src/main.tsx'],
              message: 'infrastructure must not depend on the UI.',
            },
            {
              target: './src/workers',
              from: ['./src/ui', './src/composition-root.ts', './src/main.tsx'],
              message: 'workers must not depend on the UI.',
            },
            {
              target: './src/ui',
              from: [
                './src/infrastructure',
                './src/workers',
                './src/composition-root.ts',
                './src/main.tsx',
              ],
              message: 'UI receives adapters through the services context, never directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['src/domain/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ONLY_RELATIVE_IMPORTS] }],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    ignores: ['src/application/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ONLY_RELATIVE_IMPORTS] }],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    extends: [jsxA11y.flatConfigs.strict],
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: UI_FORBIDDEN_LIBRARIES,
          patterns: [
            {
              group: ['pdfjs-dist/*', 'pdf-lib/*', 'xlsx/*', 'mammoth/*'],
              message: 'UI code must use the application ports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/main.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', 'deploy/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
