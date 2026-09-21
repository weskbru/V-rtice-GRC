# @pharos/design-system

The PharosGRC Design System: shared design tokens and components layered on Tailwind CSS 4 and
shadcn/ui, consumed identically by `apps/web` and every future GRC module (Constitution X).

Tokens (T043) and components (T044–T046) are implemented. `packages/api-types` remains generated
separately.

See `docs/architecture/frontend.md` for the full picture this package is one piece of: the web app's route
map, the authenticated shell, the product's navigation abstraction (`<Link>`/`useNavigate`, and
the lint rule that enforces it), the four-layer rule for what belongs in this package versus
`apps/web/src/components/ui/`, `apps/web/src/components/` or `apps/web/src/features/*`, and the
checklist for wiring a new screen end to end. This file only documents the package itself.

As of 2026-09-14, `src/components/index.ts` (the barrel — the authoritative list of what this
package exports) re-exports, beyond the seven named below: `CardGrid`, `EmptyValue`,
`DetailPanel`, `DisclosureGroup`, `ViewToggle`, `SummaryStatCard`, `MetricCard`,
`ThresholdBreachBadge`, `TrendChart`, `RiskMatrix`, `RiskScore`, the `form/` group (`FormField`,
`FormSection`, `ReadOnlyField`, `SearchablePicker`), the `entity/` group (`EntityHeader`,
`EntityTabs`), the `data-table/` group (`DataTable` — a wrapper over `@tanstack/react-table` —
plus `ColumnVisibilityMenu`, `PaginationFooter`, `ResultsToolbar`, `MultiSelectFilter`), the
`timeline/` group (`ActivityHistory`, `AuditTimeline`) and the `collaboration/` group
(`CommentThread`, `AttachmentList`). Treat the barrel, not this paragraph, as the source of truth
when the two disagree.

## Conventions

- **Tailwind CSS 4, CSS-first config.** There is no `tailwind.config.js`; the theme is defined with
  `@theme`/`:root` custom properties in `src/styles/globals.css`, imported by consumers via the
  package's `./styles` export (`@pharos/design-system/styles`). `apps/web`'s own stylesheet is a
  single `@import '@pharos/design-system/styles';` — the token layer is defined exactly once.
- **shadcn/ui primitives live in `apps/web/src/components/ui/`, not here.** Per plan.md's project
  structure, generated shadcn/ui primitives are owned by `apps/web` (generated via
  `apps/web/components.json`) and kept byte-identical to the CLI's output. This package therefore
  must not depend on `apps/web` (the dependency direction only ever goes the other way), so its own
  composed components (`src/components/`: `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState`,
  `ConfirmDialog`, `StatusBadge`, `RiskLevelBadge`) are hand-written directly on Radix primitives
  (e.g. `ConfirmDialog` on `@radix-ui/react-dialog`) and Tailwind utility classes consuming the tokens
  above — not generated shadcn output. The `components.json` at this package's root predates that
  decision and is not exercised by any build step; it is kept only so a future primitive genuinely
  shared below the application layer has a ready-made shadcn config to generate into.
- **Subpath exports.** Consumers import `@pharos/design-system/tokens`, `@pharos/design-system/components`
  or `@pharos/design-system/styles` — never deep paths into `src/` or `dist/`. The package root
  (`@pharos/design-system`) is reserved for future convenience re-exports.
- **Build.** Plain `tsc` project (no bundler): `pnpm --filter @pharos/design-system build` emits
  declaration files and JS to `dist/`. CSS is not compiled by `tsc`; it is shipped from `src/styles`
  and processed by whichever app imports it (PostCSS + `@tailwindcss/postcss`).
