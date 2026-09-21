/**
 * PharosGRC application shell — navigation registry (T071, FR-041, SC-011).
 *
 * This is the single named extension point through which a GRC module
 * becomes visible in the shell. `Sidebar` (`src/components/shell/sidebar.tsx`)
 * and `Header` render *only* from this list — neither hard-codes a module
 * name, route or icon. Adding a future module means adding exactly one entry
 * here; nothing in the shell, `(app)/layout.tsx`, or any existing module
 * changes (FR-039, FR-041).
 *
 * Two entry shapes, enforced by the discriminated union below:
 *
 *   - `status: 'implemented'` — has a real `href`. Shown as a normal link,
 *     and hidden if the caller lacks `requiredPermission` (FR-042 — advisory
 *     only, see `src/lib/permissions.ts`; the server enforces the route
 *     independently regardless of what this list says).
 *   - `status: 'planned'` — has NO `href`. Shown, but explicitly labeled and
 *     non-interactive, never as a link to nowhere (FR-043).
 *
 * Because the two variants are a discriminated union checked with
 * `satisfies` below, giving a `'planned'` entry an `href`, or omitting
 * `href` on an `'implemented'` one, is a compile error — a malformed entry
 * cannot reach the shell.
 *
 * Risk Management (US2, T095–T099) is PharosGRC's first business module
 * (CLAUDE.md §1) and is the concrete demonstration of this extension point:
 * exactly one entry below, nothing else in the shell changed. Its `href`
 * points at `/risks` — the filterable risk register (US3, T110) — now that
 * the register exists; creating a risk is reached from there (its own
 * "Novo risco" action), not from this navigation entry directly.
 */
import {
  AlertTriangle,
  Building2,
  FileBarChart,
  Gauge,
  Gavel,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users,
  Warehouse,
  Workflow,
} from 'lucide-react';

import { shell } from '@/lib/messages/shell';

import type { PermissionId } from '@/lib/permissions';
import type { ComponentType, SVGProps } from 'react';

type NavigationIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavigationEntryBase {
  /** Stable slug — used as the React key and for test/id hooks. Never shown to the user. */
  readonly id: string;
  readonly label: string;
  readonly icon: NavigationIcon;
  /**
   * `resource:action` permission required to see this entry (ADR-003).
   * Omitted for entries every authenticated user may see (e.g. Dashboard).
   * Meaningless on a `'planned'` entry — there is nothing to gate yet.
   */
  readonly requiredPermission?: PermissionId;
}

export interface ImplementedNavigationEntry extends NavigationEntryBase {
  readonly status: 'implemented';
  readonly href: string;
}

export interface PlannedNavigationEntry extends NavigationEntryBase {
  readonly status: 'planned';
}

export type NavigationEntry = ImplementedNavigationEntry | PlannedNavigationEntry;

export const navigationRegistry: readonly NavigationEntry[] = [
  {
    id: 'dashboard',
    label: shell.navigation.modules.dashboard,
    icon: LayoutDashboard,
    status: 'implemented',
    href: '/dashboard',
  },
  {
    id: 'risks',
    label: shell.navigation.modules.risks,
    icon: ShieldAlert,
    requiredPermission: 'risk:view',
    status: 'implemented',
    href: '/risks',
  },
  {
    // 002-shared-grc-foundation, US2, R-009 — the ONE new sidebar entry
    // this whole phase adds. Evidence and Finding stay inside the domain
    // contexts that consume them (risk detail, future finding screens);
    // Action earns its own entry because the value of a single
    // cross-origin work list is exactly what motivates the shared
    // capability (SC-002) — see spec.md's own "Assumptions" section.
    id: 'my-actions',
    label: shell.navigation.modules.myActions,
    icon: ListChecks,
    requiredPermission: 'action:view',
    status: 'implemented',
    href: '/actions',
  },
  {
    // 008-incidents-problems, US2 — the problem register (T-Problems).
    // Gated by `problem:view`, mirroring how `risks`/`controls`/`assets`
    // are gated above.
    id: 'problems',
    label: shell.navigation.modules.problems,
    icon: AlertTriangle,
    requiredPermission: 'problem:view',
    status: 'implemented',
    href: '/problems',
  },
  {
    // 008-incidents-problems, US1 — the incident register, gated by
    // `incident:view`, mirroring how `problems`/`risks`/`controls` are
    // gated above.
    id: 'incidents',
    label: shell.navigation.modules.incidents,
    icon: Siren,
    requiredPermission: 'incident:view',
    status: 'implemented',
    href: '/incidents',
  },
  {
    // 003-controls-management, US1 — the Controls catalog. Gated by
    // `control:view`, mirroring how `risks`/`my-actions` are gated above.
    id: 'controls',
    label: shell.navigation.modules.controls,
    icon: ShieldCheck,
    requiredPermission: 'control:view',
    status: 'implemented',
    href: '/controls',
  },
  {
    // 006-assets-processes — the asset inventory (US1, US2, US3). Gated by
    // `asset:view`, mirroring how `risks`/`controls`/`compliance`/`audits`
    // are gated above.
    id: 'assets',
    label: shell.navigation.modules.assets,
    icon: Warehouse,
    requiredPermission: 'asset:view',
    status: 'implemented',
    href: '/assets',
  },
  {
    // 006-assets-processes — the process catalog, built shape-for-shape
    // with `assets` above (FR-020). Gated by `process:view`.
    id: 'processes',
    label: shell.navigation.modules.processes,
    icon: Workflow,
    requiredPermission: 'process:view',
    status: 'implemented',
    href: '/processes',
  },
  {
    // 004-compliance-management — the normative library, requirement↔control
    // mapping, mapping migration and the calculated compliance state (US1 to
    // US3). Gated by `compliance:view`, mirroring how `risks`/`controls` are
    // gated above.
    id: 'compliance',
    label: shell.navigation.modules.compliance,
    icon: ScrollText,
    requiredPermission: 'compliance:view',
    status: 'implemented',
    href: '/compliance',
  },
  {
    // 005-audit-findings — audit engagement register, detail, scope and
    // lifecycle (US1). Gated by `audit-engagement:view`, mirroring how
    // `risks`/`controls`/`compliance` are gated above.
    id: 'audits',
    label: shell.navigation.modules.audits,
    icon: Gavel,
    requiredPermission: 'audit-engagement:view',
    status: 'implemented',
    href: '/audits',
  },
  {
    // 009-indicators-reports — the indicator catalog and current-value/
    // history detail (US1-US6). Gated by `indicator:view`, mirroring how
    // `risks`/`controls`/`compliance` are gated above.
    id: 'indicators',
    label: shell.navigation.modules.indicators,
    icon: Gauge,
    requiredPermission: 'indicator:view',
    status: 'implemented',
    href: '/indicators',
  },
  {
    // 009-indicators-reports — the report catalog, creation and run
    // (US1-US6). Gated by `report:view`, mirroring `indicators` above.
    id: 'reports',
    label: shell.navigation.modules.reports,
    icon: FileBarChart,
    requiredPermission: 'report:view',
    status: 'implemented',
    href: '/reports',
  },
  {
    id: 'admin-users',
    label: shell.navigation.administration.users,
    icon: Users,
    requiredPermission: 'user:administer',
    status: 'implemented',
    href: '/admin/users',
  },
  {
    id: 'admin-roles',
    label: shell.navigation.administration.roles,
    icon: KeyRound,
    requiredPermission: 'role:administer',
    status: 'implemented',
    href: '/admin/roles',
  },
  {
    id: 'admin-organization',
    label: shell.navigation.administration.organization,
    icon: Building2,
    requiredPermission: 'org_unit:administer',
    status: 'implemented',
    href: '/admin/organization',
  },
] as const satisfies readonly NavigationEntry[];
