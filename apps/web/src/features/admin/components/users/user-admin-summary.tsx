'use client';

/**
 * PharosGRC — Administration, the users screen's four indicators (CLAUDE.md
 * §18.5, §19.7), mirroring `risk-register-summary.tsx`'s own reasoning for
 * why these are server aggregates and never a second count computed here.
 *
 * Three requests on mount, each an O(1) server aggregate — never a count
 * derived from the loaded page:
 *   - **Total de usuários**: `adminApi.listUsers({ page: 1, pageSize: 1 })`
 *     → `meta.total`, no filters.
 *   - **Ativos**: the same call with `status: 'ACTIVE'` → `meta.total`.
 *   - **Inativos**: `total − ativos`, computed here rather than a fourth
 *     request — exact, because `status` is a closed two-value enum
 *     (`AdminUserStatus`), so every user counted in `total` is in exactly
 *     one of the two buckets.
 *   - **Sem papel**: `total − usersWithRoles`, where `usersWithRoles` comes
 *     from `adminApi.getRolesSummary()` (`GET /admin/roles/summary`). Both
 *     counts are over the SAME universe — the unfiltered `listUsers` call
 *     counts every row of `user`, and `usersWithRoles` is
 *     `COUNT(DISTINCT user_id)` over `user_roles`
 *     (`prisma-user-directory.repository.ts#listAdmin`,
 *     `prisma-role.repository.ts#getSummaryCounts`) — so the subtraction is
 *     exact, not an approximation.
 *
 * `GET /admin/roles/summary` requires `role:administer`, which this
 * screen's own `user:administer` does NOT imply (015-roles-permissions-
 * surface FR-019): a caller can hold one without the other. When
 * `canManageRoles` is false, this component never calls that endpoint at
 * all — no failed request, no permanent skeleton — and the "Sem papel" tile
 * is simply ABSENT, never a zero. The strip then lays out the remaining
 * three tiles.
 *
 * "Ativos" and "Inativos" link into this register's own `status` filter —
 * a real, already-existing filter field, so the number shown and the list
 * it opens into can never disagree. "Sem papel" is NOT a link: `GET
 * /admin/users` has no filter the contract supports for it, and faking one
 * would be worse than a plain figure (CLAUDE.md §19.7 — never a second,
 * unenforced rule standing in for a real one).
 *
 * A failure anywhere in the three requests degrades the WHOLE strip to one
 * quiet line (mirroring `role-admin-summary.tsx`'s identical choice for
 * this same administration area) — it must never hide or block the
 * register underneath it.
 */
import { SummaryStatCard } from '@pharos/design-system/components';
import { ShieldOff, UserCog, UserRoundCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';

import { adminApi } from '../../api';

import type { ComponentType, SVGProps } from 'react';

export interface UserAdminSummaryProps {
  /** Whether `GET /admin/roles/summary` is reachable at all — decides whether the fourth tile is fetched and rendered (FR-019: `role:administer` does not imply `user:administer`, nor the reverse). */
  canManageRoles: boolean;
  className?: string;
}

interface SummaryCardDefinition {
  key: string;
  label: string;
  hint: string;
  linkLabel: string | undefined;
  href: string | undefined;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  value: number | undefined;
}

const FOCUS_RING_CLASSES =
  'group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function buildCardDefinitions(
  total: number | undefined,
  active: number | undefined,
  usersWithRoles: number | undefined,
  canManageRoles: boolean,
): readonly SummaryCardDefinition[] {
  const summary = admin.users.summary;
  const inactive = total !== undefined && active !== undefined ? total - active : undefined;
  const withoutRole =
    canManageRoles && total !== undefined && usersWithRoles !== undefined
      ? total - usersWithRoles
      : undefined;

  const cards: SummaryCardDefinition[] = [
    {
      key: 'total',
      label: summary.total.label,
      hint: summary.total.hint,
      linkLabel: summary.total.linkLabel,
      href: '/admin/users',
      icon: Users,
      tone: 'neutral',
      value: total,
    },
    {
      key: 'active',
      label: summary.active.label,
      hint: summary.active.hint,
      linkLabel: summary.active.linkLabel,
      href: '/admin/users?status=ACTIVE',
      icon: UserRoundCheck,
      tone: 'success',
      value: active,
    },
    {
      key: 'inactive',
      label: summary.inactive.label,
      hint: summary.inactive.hint,
      linkLabel: summary.inactive.linkLabel,
      href: '/admin/users?status=INACTIVE',
      icon: ShieldOff,
      tone: 'neutral',
      value: inactive,
    },
  ];

  if (canManageRoles) {
    cards.push({
      key: 'withoutRole',
      label: summary.withoutRole.label,
      hint: summary.withoutRole.hint,
      linkLabel: undefined,
      href: undefined,
      icon: UserCog,
      tone: 'warning',
      value: withoutRole,
    });
  }

  return cards;
}

export function UserAdminSummary({
  canManageRoles,
  className,
}: UserAdminSummaryProps): React.JSX.Element {
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [active, setActive] = useState<number | undefined>(undefined);
  const [usersWithRoles, setUsersWithRoles] = useState<number | undefined>(undefined);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const requests: Promise<unknown>[] = [
      adminApi.listUsers({ page: 1, pageSize: 1 }).then((page) => {
        if (!cancelled) setTotal(page.meta.total);
      }),
      adminApi.listUsers({ page: 1, pageSize: 1, status: 'ACTIVE' }).then((page) => {
        if (!cancelled) setActive(page.meta.total);
      }),
    ];

    if (canManageRoles) {
      requests.push(
        adminApi.getRolesSummary().then((result) => {
          if (!cancelled) setUsersWithRoles(result.usersWithRoles);
        }),
      );
    }

    Promise.all(requests).catch(() => {
      if (!cancelled) setHasError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [canManageRoles]);

  if (hasError) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        {admin.users.summary.loadError}
      </p>
    );
  }

  const isLoading =
    total === undefined || active === undefined || (canManageRoles && usersWithRoles === undefined);
  const cards = buildCardDefinitions(total, active, usersWithRoles, canManageRoles);

  return (
    <section
      aria-label={admin.users.summary.regionLabel}
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {cards.map((card) => {
        const stat = (
          <SummaryStatCard
            label={card.label}
            value={card.value !== undefined ? admin.users.summary.value(card.value) : ''}
            hint={card.hint}
            icon={card.icon}
            tone={card.tone}
            isLoading={isLoading}
            className="h-full"
          />
        );

        if (!card.href || !card.linkLabel) {
          return (
            <div key={card.key} className="h-full">
              {stat}
            </div>
          );
        }

        return (
          <Link
            key={card.key}
            href={card.href}
            aria-label={card.linkLabel}
            className={FOCUS_RING_CLASSES}
          >
            {stat}
          </Link>
        );
      })}
    </section>
  );
}
