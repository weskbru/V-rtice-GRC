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
  readonly id: string;
  readonly label: string;
  readonly icon: NavigationIcon;
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
    id: 'my-actions',
    label: shell.navigation.modules.myActions,
    icon: ListChecks,
    requiredPermission: 'action:view',
    status: 'implemented',
    href: '/actions',
  },
  {
    id: 'problems',
    label: shell.navigation.modules.problems,
    icon: AlertTriangle,
    requiredPermission: 'problem:view',
    status: 'implemented',
    href: '/problems',
  },
  {
    id: 'incidents',
    label: shell.navigation.modules.incidents,
    icon: Siren,
    requiredPermission: 'incident:view',
    status: 'implemented',
    href: '/incidents',
  },
  {
    id: 'controls',
    label: shell.navigation.modules.controls,
    icon: ShieldCheck,
    requiredPermission: 'control:view',
    status: 'implemented',
    href: '/controls',
  },
  {
    id: 'assets',
    label: shell.navigation.modules.assets,
    icon: Warehouse,
    requiredPermission: 'asset:view',
    status: 'implemented',
    href: '/assets',
  },
  {
    id: 'processes',
    label: shell.navigation.modules.processes,
    icon: Workflow,
    requiredPermission: 'process:view',
    status: 'implemented',
    href: '/processes',
  },
  {
    id: 'compliance',
    label: shell.navigation.modules.compliance,
    icon: ScrollText,
    requiredPermission: 'compliance:view',
    status: 'implemented',
    href: '/compliance',
  },
  {
    id: 'audits',
    label: shell.navigation.modules.audits,
    icon: Gavel,
    requiredPermission: 'audit-engagement:view',
    status: 'implemented',
    href: '/audits',
  },
  {
    id: 'indicators',
    label: shell.navigation.modules.indicators,
    icon: Gauge,
    requiredPermission: 'indicator:view',
    status: 'implemented',
    href: '/indicators',
  },
  {
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
