'use client';

import { PaginationFooter } from '@pharos/design-system/components';
import { Info, ShieldOff } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import { roleDisplayName } from '@/lib/role-display-name';

import { adminApi } from '../../api';

import type { AdminUser, Role } from '../../types';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export interface RoleUsersTabProps {
  role: Role;
  canAdministerUsers: boolean;
  canManageOrgUnits: boolean;
}

function RoleUsersRestricted({ role }: { role: Role }): React.JSX.Element {
  const messages = admin.roles.usersTab.restricted;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3"
    >
      <ShieldOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={titleId} className="text-sm font-medium text-foreground">
          {messages.title}
        </h3>
        <p className="text-xs leading-5 text-muted-foreground">{messages.description}</p>
        <p className="pt-1 text-sm font-medium text-foreground tabular-nums">
          {messages.countLabel(role.assignedUserCount)}
        </p>
      </div>
    </section>
  );
}

function pageKey(roleId: string, pageIndex: number, pageSize: number): string {
  return `${roleId}|${pageIndex}|${pageSize}`;
}

function RoleUserRoster({ role }: { role: Role }): React.JSX.Element {
  const messages = admin.roles.usersTab;
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loaded, setLoaded] = useState<{
    key: string;
    users: readonly AdminUser[];
    total: number;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const titleId = useId();

  const currentKey = pageKey(role.id, pageIndex, pageSize);
  const hasError = failedKey === currentKey;
  const isLoading = !hasError && loaded?.key !== currentKey;
  const users = loaded?.users ?? null;
  const total = loaded?.total ?? role.assignedUserCount;

  useEffect(() => {
    let cancelled = false;
    const key = pageKey(role.id, pageIndex, pageSize);
    adminApi
      .listUsers({ page: pageIndex + 1, pageSize, roleId: role.id })
      .then((page) => {
        if (cancelled) return;
        setLoaded({ key, users: page.data, total: page.meta.total });
      })
      .catch(() => {
        if (cancelled) return;
        setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [role.id, pageIndex, pageSize]);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">
          {messages.title}
        </h3>
        <p role="status" className="text-xs text-muted-foreground tabular-nums">
          {isLoading ? messages.loading : messages.count(total)}
        </p>
      </div>

      {hasError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {messages.loadError}
        </p>
      ) : users === null ? null : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.empty}</p>
      ) : (
        <ul aria-busy={isLoading} className="flex flex-col gap-2">
          {users.map((user) => {
            const otherRoles = user.roles.filter((assigned) => assigned.id !== role.id);
            return (
              <li
                key={user.id}
                className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
              >
                <span className="text-sm font-medium text-foreground">{user.fullName}</span>
                <span className="text-xs break-all text-muted-foreground">{user.email}</span>
                <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="font-medium">{messages.columns.jobTitle}:</dt>
                    <dd>{user.jobTitle ?? messages.notSet}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="font-medium">{messages.columns.status}:</dt>
                    <dd>
                      {user.status === 'ACTIVE'
                        ? admin.users.status.active
                        : admin.users.status.inactive}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="font-medium">{messages.columns.orgUnit}:</dt>
                    <dd>{user.primaryOrgUnit?.name ?? messages.notSet}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="font-medium">{messages.columns.otherRoles}:</dt>
                    <dd>
                      {otherRoles.length === 0
                        ? messages.noOtherRoles
                        : otherRoles.map((assigned) => roleDisplayName(assigned.name)).join(', ')}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      {users !== null && users.length > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">{messages.otherRolesHint}</p>
      ) : null}

      {users !== null && total > 0 ? (
        <PaginationFooter
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={total}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
          labels={common.dataTable}
          className="sm:flex-col sm:items-start sm:justify-start"
        />
      ) : null}
    </section>
  );
}

function ScopeNotice({ canManageOrgUnits }: { canManageOrgUnits: boolean }): React.JSX.Element {
  const messages = admin.roles.usersTab.scopeNotice;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={titleId} className="text-sm font-medium text-foreground">
          {messages.title}
        </h3>
        <p className="text-xs leading-5 text-muted-foreground">{messages.description}</p>
        {canManageOrgUnits ? (
          <Link
            href="/admin/organization"
            className="w-fit text-xs font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {messages.link}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function RoleUsersTab({
  role,
  canAdministerUsers,
  canManageOrgUnits,
}: RoleUsersTabProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {canAdministerUsers ? (
        <RoleUserRoster key={role.id} role={role} />
      ) : (
        <RoleUsersRestricted role={role} />
      )}
      <ScopeNotice canManageOrgUnits={canManageOrgUnits} />
    </div>
  );
}
