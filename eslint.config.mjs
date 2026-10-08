// @ts-check
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const IMPORT_ORDER_RULE = [
  'error',
  {
    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
    'newlines-between': 'always',
    alphabetize: { order: 'asc', caseInsensitive: true },
  },
];

const UNTYPED_FILES = [
  '**/*.config.{js,mjs,cjs,ts,mts,cts}',
  '**/scripts/**/*.{js,mjs,cjs}',
  'eslint.config.mjs',
  'frontend/**/eslint.config.mjs',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.d.ts',
      'database/prisma/migrations/**',
      'frontend/src/components/ui/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-empty-function': ['error', { allow: ['decoratedFunctions'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },

  {
    ...importPlugin.flatConfigs.recommended,
    ignores: ['frontend/src/**', 'frontend/e2e/**', 'frontend/scripts/**', 'frontend/*.config.*'],
  },
  {
    ...importPlugin.flatConfigs.typescript,
    ignores: ['frontend/src/**', 'frontend/e2e/**', 'frontend/scripts/**', 'frontend/*.config.*'],
  },
  {
    ignores: ['frontend/src/**', 'frontend/e2e/**', 'frontend/scripts/**', 'frontend/*.config.*'],
    settings: {
      'import/resolver': {
        typescript: {
          projectService: true,
        },
      },
    },
    rules: {
      'import/order': IMPORT_ORDER_RULE,
      'import/no-unresolved': 'off',
    },
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript').map((config) => ({
    ...config,
    files: [
      'frontend/src/**/*.{ts,tsx,js,jsx}',
      'frontend/e2e/**/*.{ts,tsx,js,jsx}',
      'frontend/scripts/**/*.{ts,tsx,js,jsx}',
    ],
  })),
  {
    files: [
      'frontend/src/**/*.{ts,tsx,js,jsx}',
      'frontend/e2e/**/*.{ts,tsx,js,jsx}',
      'frontend/scripts/**/*.{ts,tsx,js,jsx}',
    ],
    rules: {
      'import/order': IMPORT_ORDER_RULE,
      'import/no-unresolved': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              importNames: ['default'],
              message:
                "Import { Link } from '@/components/navigation/link' instead — it is next/link plus the pending-navigation signal the institutional loader reads (specs/014-institutional-loader §2.3).",
            },
            {
              name: 'next/navigation',
              importNames: ['useRouter'],
              message:
                "Use useNavigate() from '@/components/shell/navigation-pending' for navigation between screens — it reports the wait to the institutional loader. useRouter stays available for same-screen query-string updates via useNavigate(href, { replace: true }) or, where genuinely needed, with an explicit eslint-disable saying why (specs/014-institutional-loader §2.3).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: UNTYPED_FILES,
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
