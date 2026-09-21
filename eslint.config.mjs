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

// Files that are not (and should not be) part of any package's `tsconfig.json`
// `include` — config files, generated output — so type-aware rules cannot run
// against them. See https://typescript-eslint.io/linting/typed-linting/#i-get-errors-telling-me-eslint-was-configured-to-run--but-does-not-match-any-of-your-projects
const UNTYPED_FILES = [
  '**/*.config.{js,mjs,cjs,ts,mts,cts}',
  '**/scripts/**/*.{js,mjs,cjs}',
  'eslint.config.mjs',
  'apps/*/eslint.config.mjs',
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
      'apps/api/prisma/migrations/**',
      // shadcn/ui generated primitives, kept byte-identical to the CLI's
      // output (plan.md: "shadcn/ui generated primitives (unmodified)") —
      // not linted for the same reason they are not reformatted, see
      // .prettierignore.
      'apps/web/src/components/ui/**',
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

  // Import plugin + ordering — everywhere except apps/web, which gets its own
  // "import" plugin instance (and rules) from eslint-config-next below;
  // registering the plugin twice for the same files throws
  // "Cannot redefine plugin 'import'".
  {
    ...importPlugin.flatConfigs.recommended,
    ignores: ['apps/web/**'],
  },
  {
    ...importPlugin.flatConfigs.typescript,
    ignores: ['apps/web/**'],
  },
  {
    ignores: ['apps/web/**'],
    settings: {
      'import/resolver': {
        typescript: {
          projectService: true,
        },
      },
    },
    rules: {
      'import/order': IMPORT_ORDER_RULE,
      // Module resolution is authoritatively checked by TypeScript itself
      // (`typecheck`); import/no-unresolved duplicates that with a weaker
      // resolver and produces false positives on workspace path aliases.
      'import/no-unresolved': 'off',
    },
  },

  // React / Next.js — scoped to apps/web only. eslint-config-next registers
  // its own "import"/"react"/"react-hooks"/"jsx-a11y" plugin instances, so
  // apps/web gets import/order from that registration instead of the block
  // above.
  ...compat.extends('next/core-web-vitals', 'next/typescript').map((config) => ({
    ...config,
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
  })),
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'import/order': IMPORT_ORDER_RULE,
      'import/no-unresolved': 'off',
      /*
       * `specs/014-institutional-loader` §2.3: the institutional loader appears
       * over a navigation because the `<Link>` the product renders reports the
       * router's own `useLinkStatus` — so a screen that imports `next/link`
       * directly, or navigates through a bare `useRouter`, is silently outside
       * the mechanism. That is a property nobody should have to remember per
       * screen, so it is a lint error rather than a convention. The two
       * wrappers below are the only places allowed to reach for the originals.
       */
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
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Config files and plain Node scripts: no type-aware linting (no tsconfig
  // covers them), CommonJS/Node globals as appropriate.
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
