// @ts-check
import boundaries from 'eslint-plugin-boundaries';

import rootConfig from '../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: true },
      'boundaries/files': [
        { category: 'composition', pattern: 'src/*.ts' },
        { category: 'composition', pattern: 'src/{core,grc,modules}/*/*.ts' },
      ],
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },

        { type: 'core-domain', pattern: 'src/core/(*)/domain/**', capture: ['capability'] },
        {
          type: 'core-application',
          pattern: 'src/core/(*)/application/**',
          capture: ['capability'],
        },
        {
          type: 'core-infrastructure',
          pattern: 'src/core/(*)/infrastructure/**',
          capture: ['capability'],
        },
        {
          type: 'core-presentation',
          pattern: 'src/core/(*)/presentation/**',
          capture: ['capability'],
        },

        { type: 'grc-domain', pattern: 'src/grc/(*)/domain/**', capture: ['capability'] },
        {
          type: 'grc-application',
          pattern: 'src/grc/(*)/application/**',
          capture: ['capability'],
        },
        {
          type: 'grc-infrastructure',
          pattern: 'src/grc/(*)/infrastructure/**',
          capture: ['capability'],
        },
        {
          type: 'grc-presentation',
          pattern: 'src/grc/(*)/presentation/**',
          capture: ['capability'],
        },

        { type: 'module-domain', pattern: 'src/modules/(*)/domain/**', capture: ['module'] },
        {
          type: 'module-application',
          pattern: 'src/modules/(*)/application/**',
          capture: ['module'],
        },
        {
          type: 'module-infrastructure',
          pattern: 'src/modules/(*)/infrastructure/**',
          capture: ['module'],
        },
        {
          type: 'module-presentation',
          pattern: 'src/modules/(*)/presentation/**',
          capture: ['module'],
        },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              message:
                'Only shared/** may be imported unconditionally; everything else must be reached explicitly (ADR-011).',
              allow: { to: { element: { type: 'shared' } } },
            },

            {
              message:
                'Composition roots (Nest modules, main.ts, the permission catalogue) may import any layer of any area — that is their job (research.md D-10).',
              from: { file: { categories: 'composition' } },
              allow: {
                to: {
                  element: {
                    types: [
                      'shared',
                      'infrastructure',
                      'core-domain',
                      'core-application',
                      'core-infrastructure',
                      'core-presentation',
                      'grc-domain',
                      'grc-application',
                      'grc-infrastructure',
                      'grc-presentation',
                      'module-domain',
                      'module-application',
                      'module-infrastructure',
                      'module-presentation',
                    ],
                  },
                },
              },
            },
            {
              message:
                'Composition roots (Nest modules, main.ts, the permission catalogue) may import any layer of any area — that is their job (research.md D-10).',
              from: { file: { categories: 'composition' } },
              allow: { to: { file: { categories: 'composition' } } },
            },

            {
              from: {
                element: {
                  types: ['core-infrastructure', 'grc-infrastructure', 'module-infrastructure'],
                },
              },
              allow: { to: { element: { type: 'infrastructure' } } },
            },
            {
              from: { element: { type: 'infrastructure' } },
              allow: { to: { element: { type: 'infrastructure' } } },
            },

            {
              from: { element: { type: 'core-domain' } },
              allow: { to: { element: { type: 'core-domain' } } },
            },
            {
              from: { element: { type: 'core-application' } },
              allow: { to: { element: { types: ['core-domain', 'core-application'] } } },
            },
            {
              from: { element: { type: 'core-infrastructure' } },
              allow: {
                to: {
                  element: { types: ['core-domain', 'core-application', 'core-infrastructure'] },
                },
              },
            },
            {
              from: { element: { type: 'core-presentation' } },
              allow: {
                to: {
                  element: { types: ['core-domain', 'core-application', 'core-presentation'] },
                },
              },
            },

            {
              from: { element: { type: 'module-domain' } },
              allow: {
                to: {
                  element: {
                    type: 'module-domain',
                    captured: { module: '{{from.element.captured.module}}' },
                  },
                },
              },
            },
            {
              from: { element: { type: 'module-application' } },
              allow: {
                to: {
                  element: {
                    types: ['module-domain', 'module-application'],
                    captured: { module: '{{from.element.captured.module}}' },
                  },
                },
              },
            },
            {
              from: { element: { type: 'module-infrastructure' } },
              allow: {
                to: {
                  element: {
                    types: ['module-domain', 'module-application', 'module-infrastructure'],
                    captured: { module: '{{from.element.captured.module}}' },
                  },
                },
              },
            },
            {
              from: { element: { type: 'module-presentation' } },
              allow: {
                to: {
                  element: {
                    types: ['module-domain', 'module-application', 'module-presentation'],
                    captured: { module: '{{from.element.captured.module}}' },
                  },
                },
              },
            },

            {
              from: { element: { type: 'grc-domain' } },
              allow: { to: { element: { type: 'grc-domain' } } },
            },
            {
              from: { element: { type: 'grc-application' } },
              allow: { to: { element: { types: ['grc-domain', 'grc-application'] } } },
            },
            {
              from: { element: { type: 'grc-infrastructure' } },
              allow: { to: { element: { types: ['grc-domain', 'grc-application'] } } },
            },
            {
              from: { element: { type: 'grc-infrastructure' } },
              allow: {
                to: {
                  element: {
                    type: 'grc-infrastructure',
                    captured: { capability: '{{from.element.captured.capability}}' },
                  },
                },
              },
            },
            {
              from: { element: { type: 'grc-presentation' } },
              allow: { to: { element: { types: ['grc-domain', 'grc-application'] } } },
            },
            {
              from: { element: { type: 'grc-presentation' } },
              allow: {
                to: {
                  element: {
                    type: 'grc-presentation',
                    captured: { capability: '{{from.element.captured.capability}}' },
                  },
                },
              },
            },

            {
              from: {
                element: {
                  types: [
                    'grc-domain',
                    'grc-application',
                    'grc-infrastructure',
                    'grc-presentation',
                  ],
                },
              },
              allow: {
                to: {
                  element: {
                    types: [
                      'core-domain',
                      'core-application',
                      'core-infrastructure',
                      'core-presentation',
                    ],
                  },
                },
              },
            },

            {
              from: {
                element: {
                  types: [
                    'module-domain',
                    'module-application',
                    'module-infrastructure',
                    'module-presentation',
                  ],
                },
              },
              allow: {
                to: {
                  element: {
                    types: ['grc-domain', 'grc-application'],
                  },
                },
              },
            },

            {
              from: {
                element: {
                  types: [
                    'module-domain',
                    'module-application',
                    'module-infrastructure',
                    'module-presentation',
                  ],
                },
              },
              allow: {
                to: {
                  element: {
                    types: [
                      'core-domain',
                      'core-application',
                      'core-infrastructure',
                      'core-presentation',
                    ],
                  },
                },
              },
            },

            {
              from: {
                element: {
                  types: [
                    'core-domain',
                    'core-application',
                    'core-infrastructure',
                    'core-presentation',
                  ],
                },
              },
              disallow: {
                to: {
                  element: {
                    types: [
                      'module-domain',
                      'module-application',
                      'module-infrastructure',
                      'module-presentation',
                    ],
                  },
                },
              },
              message: 'core/** must never import from modules/** (ADR-011).',
            },

            {
              from: {
                element: {
                  types: [
                    'core-domain',
                    'core-application',
                    'core-infrastructure',
                    'core-presentation',
                  ],
                },
              },
              disallow: {
                to: {
                  element: {
                    types: [
                      'grc-domain',
                      'grc-application',
                      'grc-infrastructure',
                      'grc-presentation',
                    ],
                  },
                },
              },
              message:
                'core/** must never import from grc/** — the platform cannot depend on the GRC kernel (ADR-016).',
            },
            {
              from: {
                element: {
                  types: [
                    'grc-domain',
                    'grc-application',
                    'grc-infrastructure',
                    'grc-presentation',
                  ],
                },
              },
              disallow: {
                to: {
                  element: {
                    types: [
                      'module-domain',
                      'module-application',
                      'module-infrastructure',
                      'module-presentation',
                    ],
                  },
                },
              },
              message:
                'grc/** must never import from modules/** — the GRC kernel cannot depend on a business domain (ADR-016).',
            },
          ],
        },
      ],

      'boundaries/no-unknown-files': 'error',
    },
  },
];
