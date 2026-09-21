// @ts-check
import boundaries from 'eslint-plugin-boundaries';

import rootConfig from '../../eslint.config.mjs';

/**
 * Module boundary enforcement for the NestJS modular monolith (ADR-011,
 * research.md). Element types are keyed off
 * `apps/api/src/{shared,infrastructure,core,modules}/**`, with one element
 * type per architectural layer (rather than a single "core"/"module" type
 * with a "layer" capture) — `eslint-plugin-boundaries`'s capture matching is
 * only reliable with one capturing group per pattern, so each layer gets its
 * own pattern capturing just the capability/module name:
 *
 *   - `shared`                 src/shared/**
 *   - `infrastructure`         src/infrastructure/**            (framework-facing, no business rules)
 *   - `core-domain`            src/core/(capability)/domain/**
 *   - `core-application`       src/core/(capability)/application/**
 *   - `core-infrastructure`    src/core/(capability)/infrastructure/**
 *   - `core-presentation`      src/core/(capability)/presentation/**
 *   - `grc-domain`             src/grc/(capability)/domain/**
 *   - `grc-application`        src/grc/(capability)/application/**
 *   - `grc-infrastructure`     src/grc/(capability)/infrastructure/**
 *   - `grc-presentation`       src/grc/(capability)/presentation/**
 *   - `module-domain`          src/modules/(module)/domain/**
 *   - `module-application`     src/modules/(module)/application/**
 *   - `module-infrastructure`  src/modules/(module)/infrastructure/**
 *   - `module-presentation`    src/modules/(module)/presentation/**
 *
 * ## `composition` (research.md D-10)
 *
 * `app.module.ts`, `main.ts`, `permission-catalogue.ts` and every
 * `<name>.module.ts` (including smaller sub-modules like
 * `control-directory.module.ts`) matched none of the 14 layer types above —
 * the boundary rule was never evaluated for them at all, which is precisely
 * the file a second business module is most likely to get wrong first
 * (F-25). `composition` closes that gap: a composition root may import ANY
 * layer of ANY area — that literally is its job (binding a concrete
 * `grc/shared/infrastructure` class into a module's `providers`, five
 * modules do this today from their own `*.module.ts` and nowhere else).
 *
 * Implemented as a `boundaries/files` FILE CATEGORY (`composition`), not a
 * `boundaries/elements` element type. `eslint-plugin-boundaries` element
 * patterns describe folders and are matched with folder semantics even when
 * the pattern text ends in `.ts` (confirmed empirically: declaring
 * `{ type: 'composition', pattern: 'src/*.ts' }` as an ELEMENT produces the
 * plugin's own runtime warning, "Element patterns match folders, not
 * individual files... For file classification, use file descriptors
 * (`boundaries/files`)", and left every composition file classified as
 * `element.isUnknown` regardless). A `boundaries/files` category is exactly
 * what the plugin documents for this shape: independent, full-path-matched,
 * per-file classification. `boundaries/no-unknown-files` treats a file as
 * known if EITHER its element OR its file category is known (`Rules/
 * NoUnknownFiles.js`), so a file-category match alone silences it; the
 * `boundaries/dependencies` policies below key off `from: { file: {
 * categories: 'composition' } }` rather than `element.type` for the same
 * reason.
 *
 * The pattern is `src/{core,grc,modules}/<name>/<file>.ts` — one path
 * segment below a capability/module directory, NOT `<file>.module.ts`
 * specifically. Widened
 * deliberately past D-10's literal wording after finding three pre-existing
 * files at that exact same depth that are not `*.module.ts`
 * (`modules/compliance/compliance-permissions.ts`,
 * `modules/controls/control-permissions.ts`,
 * `modules/controls/control-assessment-audit-allowlist.ts`) — each one's own
 * header comment already documents itself as following the unclassified
 * "module root, outside domain/application/infrastructure/presentation"
 * precedent this category now names formally. Enabling `no-unknown-files`
 * without covering them would fail the lint on three files that were never
 * the target of this change; a pattern narrowed to the literal `*.module.ts`
 * wording would have left them unknown and broken the build.
 *
 * ## `boundaries/no-unknown-files` (research.md D-10, FR-019)
 *
 * Enabled below so a file that matches none of the 15 types now fails the
 * lint instead of being silently exempt from every boundary rule — the
 * blind spot F-25 named.
 *
 * Rules enforced (all as errors, `default: "disallow"` so every legitimate
 * dependency direction is explicit rather than assumed):
 *
 *   1. `core/**` never imports from `modules/**` — no policy ever allows a
 *      `core-*` element to reach a `module-*` element, and the default
 *      denies it; a final explicit `disallow` policy restates this so it
 *      cannot be silently reopened by an earlier, broader policy.
 *   2. A module under `modules/<name>/**` never imports from
 *      `modules/<other>/**` — every `module-*` policy's `to` selector
 *      templates the `module` capture back from the importing element
 *      (`captured: { module: "{{from.element.captured.module}}" }`), so a
 *      cross-module import never matches an `allow` policy and falls
 *      through to `default: "disallow"`.
 *   3. `shared/**` imports nothing from `core`, `modules` or
 *      `infrastructure`; every element may import `shared` (the only policy
 *      with no `from` selector allows `to: shared` unconditionally; `shared`
 *      never appears as a `from` in any other `allow` policy).
 *   4. Inward layering inside each core capability and each business module:
 *      `domain` imports nothing from `application`/`infrastructure`/`presentation`;
 *      `application` may additionally import `domain`; `infrastructure` and
 *      `presentation` may additionally import `domain` + `application`.
 *   5. `composition` may import any layer of any area (research.md D-10).
 *      `modules/* -> grc/*`, for non-composition files, is restricted to
 *      `grc-domain`/`grc-application` only — the five modules that bind a
 *      concrete `grc/shared/infrastructure` class do so exclusively from
 *      their own `*.module.ts`, which `composition` now covers (FR-020).
 *   6. GRC kernel capabilities (`grc/<capability>`) get the same mutual
 *      isolation business modules already have (F-60, research.md D-10):
 *      two capabilities may import each other's `domain`/`application` —
 *      it is a single shared kernel (ADR-016), and `grc/finding` already
 *      legitimately imports `grc/evidence`'s port this way — but never each
 *      other's `infrastructure`/`presentation` (own-capability access to
 *      those two layers is unaffected, via the same
 *      `captured: { capability: "{{from.element.captured.capability}}" }`
 *      templating `module-*` already uses for module isolation) (FR-021).
 *
 * Two consequences of the architecture, not additional rules beyond
 * ADR-011: `modules -> core` is allowed (plan.md Project Structure:
 * "business modules — may depend on core/, not on each other"), and each
 * capability's/module's own `infrastructure` layer may import the top-level
 * `infrastructure` element (e.g. `PrismaService`, `RedisService`).
 */
export default [
  ...rootConfig,
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      // Resolves relative/aliased import sources to files on disk so the
      // element classification above can be applied to the *target* of an
      // import, not just its source text.
      'import/resolver': { typescript: true },
      // research.md D-10 — the `composition` FILE category (not an element
      // type; see this file's header comment for why). Matches full file
      // paths in one pass, independent of the folder-based element
      // patterns below.
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

        // ADR-016 — the shared GRC kernel: GRC concepts no single business
        // module owns (Evidence, Action, Finding). Same inward layering as a
        // core capability; may reach `core`, never `modules`.
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
            // 3. Every element may import `shared`.
            {
              message:
                'Only shared/** may be imported unconditionally; everything else must be reached explicitly (ADR-011).',
              allow: { to: { element: { type: 'shared' } } },
            },

            // 5. A composition root (a Nest module, main.ts, the permission
            // catalogue) may import any layer of any area — that is its job
            // (research.md D-10). `composition` is a FILE category, not an
            // element type (see this file's header comment), so both sides
            // of this policy select on `file.categories` / the 14 layer
            // element types explicitly rather than via a wildcard — this
            // plugin has no "any type" shorthand, and an explicit list is
            // itself the record of every type composition is allowed to
            // touch. Two policies because `to` cannot mix an `element`
            // selector and a `file` selector as OR alternatives in one
            // entry the way this config's other policies compose them.
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
            // Composition roots also import each other (main.ts -> app.module.ts
            // -> every *.module.ts).
            {
              message:
                'Composition roots (Nest modules, main.ts, the permission catalogue) may import any layer of any area — that is their job (research.md D-10).',
              from: { file: { categories: 'composition' } },
              allow: { to: { file: { categories: 'composition' } } },
            },

            // core/** and modules/**'s own `infrastructure` layer may reach
            // the top-level `infrastructure` element (e.g. PrismaService).
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

            // 4. Inward layering inside each core capability. Cross-capability
            // core imports are not restricted here (only the module isolation
            // policies below constrain business domains to their own module).
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

            // 2. + 4. Inward layering inside each business module, scoped to
            // the SAME module only (the `module` capture is templated back
            // from the importing element) — exactly what makes a cross-module
            // import fall through to `default: "disallow"`.
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

            // ADR-016 — inward layering inside each GRC kernel capability,
            // mirroring the core policies above. `grc-domain`/`grc-application`
            // deliberately do NOT template the `capability` capture back: two
            // kernel capabilities are a single shared core and may reach each
            // other's domain/application freely (research.md D-10) —
            // `grc/finding/application/close-finding.usecase.ts` importing
            // `grc/evidence/domain/ports/evidence-link-repository.port.ts` is
            // the real, already-existing case this preserves.
            {
              from: { element: { type: 'grc-domain' } },
              allow: { to: { element: { type: 'grc-domain' } } },
            },
            {
              from: { element: { type: 'grc-application' } },
              allow: { to: { element: { types: ['grc-domain', 'grc-application'] } } },
            },
            // F-60 / research.md D-10 — unlike domain/application above,
            // `infrastructure` and `presentation` DO template `capability`
            // back: a kernel capability may still reach any capability's
            // domain/application, but only ITS OWN infrastructure/
            // presentation — mirroring the `module` isolation `module-*`
            // policies already apply. This is what makes a hypothetical
            // `grc/action/infrastructure` importing a concrete class from
            // `grc/evidence/infrastructure` fall through to `default:
            // "disallow"`.
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

            // ADR-016 — the GRC kernel may depend on core capabilities, the
            // same way business modules may.
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

            // ADR-016 — business modules may depend on the GRC kernel. This is
            // the direction that makes Evidence/Action/Finding reusable without
            // any module importing another module. Restricted to
            // `grc-domain`/`grc-application` only (research.md D-10, FR-020):
            // the five modules that bind a concrete `grc/shared/infrastructure`
            // class do so exclusively from their own `*.module.ts`, which the
            // `composition` type (and its own, separate allow-all policy
            // above) already covers — a non-composition module file reaching
            // `grc-infrastructure`/`grc-presentation` now falls through to
            // `default: "disallow"`.
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

            // Business modules may depend on core capabilities (plan.md:
            // "modules — may depend on core/, not on each other").
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

            // 1. Explicit safety net: core/** must never import modules/**
            // (already true under `default: "disallow"`; restated so it
            // cannot be silently reopened by an earlier, broader policy).
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

            // ADR-016 — the two remaining directions the layering forbids.
            // Both are already denied by `default: "disallow"`; restated so a
            // future broader policy cannot silently reopen them.
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

      // research.md D-10, FR-019 — a file matching none of the 15 element
      // types above (composition included) now fails the lint instead of
      // being silently exempt from every boundary rule (F-25).
      'boundaries/no-unknown-files': 'error',
    },
  },
];
