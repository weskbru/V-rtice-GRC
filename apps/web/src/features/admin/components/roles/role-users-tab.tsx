'use client';

/**
 * PharosGRC — Administration, the detail panel's Users tab
 * (015-roles-permissions-surface FR-018 to FR-025, T039/T040/T041).
 *
 * ## The security boundary this file exists to respect
 *
 * `role:administer` does NOT imply `user:administer` (FR-019). The only
 * operation that lists the people holding a role is
 * `GET /admin/users?roleId=`, and that endpoint requires `user:administer`
 * (`admin-users.controller.ts`). There is no alternative route protected by
 * `role:administer` alone, and creating one is explicitly forbidden.
 *
 * So without `user:administer` the roster component is NEVER MOUNTED — not
 * rendered and hidden, not fetched and filtered, not styled away. The
 * request is not made, and therefore no name, e-mail, job title or unit can
 * reach the DOM by any path (FR-020, SC-006). What remains is the aggregate
 * count `GET /admin/roles` already returned for every role
 * (`assignedUserCount`), which discloses nothing about any individual, plus
 * an explanation of what the reader is missing and why.
 *
 * ## One request per page, never one per person
 *
 * The authorized branch makes exactly ONE paginated request per page it
 * shows (FR-024, NFR-006). This screen already carries the cost of A7-F07
 * (the roles listing's own per-row `countAssignedUsers`), and F-59/F-61 are
 * two standing records of the global rate limiter refusing requests on
 * screen when a panel fans out per row. Nothing here fans out: a page turn
 * costs exactly one request, whatever the page holds.
 *
 * Until 015 closed, the tab asked for a single page at `pageSize: 100` —
 * the contract's own cap (`ListAdminUsersQueryDto`, `@Max(100)`) — and had
 * no pagination at all. A role with more than 100 holders showed the first
 * 100 while the count above it, read from `meta.total`, correctly said
 * there were more: the screen truncated without saying so
 * (`015/STATE.md` §13 item 7). The endpoint was already paginated; only the
 * client was not. This file now consumes the pagination the server always
 * offered, through the SAME `PaginationFooter` every register uses — not a
 * control of its own (CLAUDE.md §18.12).
 *
 * Turning a page is local state inside the roster: it re-runs this
 * component's own effect and nothing else. The role fetch, the summary
 * fetch and the panel itself are untouched, and the page is deliberately
 * NOT written to the query string — neither is the role selection that
 * opened the panel.
 *
 * ## Organizational scope is not a property of this assignment
 *
 * `UserRole` has no scope column: its key is `(userId, roleId)` plus who
 * granted it and when. Scope is a SECOND dimension granted per user
 * (`OrgScopeGrant`), so the tab says so rather than letting the reader
 * infer that holding a role decides what someone sees (FR-022). The link to
 * manage it appears only for a reader who may actually consult it
 * (FR-023 — `/admin/organization` is gated on `org_unit:administer`).
 */
import { PaginationFooter } from '@pharos/design-system/components';
import { Info, ShieldOff } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import { roleDisplayName } from '@/lib/role-display-name';

import { adminApi } from '../../api';

import type { AdminUser, Role } from '../../types';

/**
 * Ten, not the registers' 25, and the reason was measured on screen rather
 * than assumed: the panel body that holds this tab is 414 px wide and, at a
 * 900 px viewport, **518 px tall** (`DetailPanel`'s `100svh - 5rem` cap minus
 * its fixed header and footer). A person here is not a table row — it is a
 * five-line card of about 148 px — so 25 of them made the tab 4 402 px long
 * and put the pagination control eight and a half panel-heights below the
 * fold, where nobody would ever find it. Ten keeps the control within reach
 * of the same scroll a reader already makes to see the list.
 *
 * The size options below still offer the house's 25/50/100 for a reader who
 * wants a long page, and every one of them is at or under the contract's
 * `@Max(100)` (`ListAdminUsersQueryDto`), so no choice the footer offers can
 * produce a request the server refuses.
 */
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export interface RoleUsersTabProps {
  role: Role;
  /** Whether the CURRENT user holds `user:administer`. Never derived from `role:administer` (FR-019). */
  canAdministerUsers: boolean;
  /** Whether the current user may consult organizational scope (`org_unit:administer`), which gates the link only (FR-023). */
  canManageOrgUnits: boolean;
}

/**
 * The degraded state (FR-020). It receives the role, uses only
 * `assignedUserCount` from it, and imports nothing that could fetch a
 * person — the component has no network path at all.
 */
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

/** The page a stored outcome belongs to, so "is this still the page being shown?" is a comparison, not a flag. */
function pageKey(roleId: string, pageIndex: number, pageSize: number): string {
  return `${roleId}|${pageIndex}|${pageSize}`;
}

/** The authorized roster. Only ever mounted when the current user holds `user:administer`. */
function RoleUserRoster({ role }: { role: Role }): React.JSX.Element {
  const messages = admin.roles.usersTab;
  /** 0-based, to match `PaginationFooter`; the request is 1-based. */
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  /**
   * Loading and failure are DERIVED from which page the stored outcome
   * belongs to, not tracked as their own flags flipped at the top of the
   * effect: `react-hooks/set-state-in-effect` forbids the synchronous
   * `setIsLoading(true)` that the flag version needs, and the derivation is
   * the better answer anyway — there is no ordering in which "loading" and
   * "the rows" can disagree about which page they describe.
   */
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
  // The rows of the page being replaced stay on screen until the next page
  // arrives, so the panel does not collapse to one line and re-expand on
  // every page turn.
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
        {/*
         * One line, two facts, never a third node appearing and disappearing
         * underneath the pagination control: while a page is in flight this
         * says so, and otherwise it states the total. Announcing the change
         * in place (`role="status"`) is what tells a screen-reader user that
         * the page turned; letting a loading line appear ABOVE the list would
         * push the footer down under the pointer that had just clicked it.
         */}
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
            // FR-025 — real provenance of access, never presented as
            // inheritance: these are the OTHER roles the same person holds,
            // and the hint under the list says the access is their union.
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

      {/*
       * Explains the "Outros papéis" line of the cards above, so it sits with
       * the list it describes rather than after the pagination control — and
       * only when there are cards to explain: a role nobody holds was telling
       * the reader how to interpret a field that was not on screen.
       */}
      {users !== null && users.length > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">{messages.otherRolesHint}</p>
      ) : null}

      {/*
       * The same footer the six register screens render, given the same
       * state — not a second pagination control written for a panel.
       *
       * It appears once a page has actually come back (`users !== null`) and
       * then STAYS, including while the next page is in flight and including
       * when that next page fails. A control that disappears under the
       * pointer — or under the keyboard focus — that just operated it is a
       * defect, not a tidy-up: choosing a larger page size can collapse
       * eight pages into one, and unmounting the footer at that moment would
       * strand focus on `<body>`. Before the first page arrives there is
       * nothing to page through and nothing focused inside it, so it is
       * absent rather than claiming a range it has not read.
       *
       * `sm:` is a VIEWPORT query, and this footer lives in a 26rem column,
       * so at 1440 px the shared component's own `sm:flex-row` would put the
       * results summary and the controls side by side in 384 px and force
       * the numbered pages to wrap mid-row. Overriding the direction here
       * keeps the shared component shared and adapts only its axis.
       */}
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

/** FR-022/FR-023 — scope is a dimension of the USER, stated here so nobody reads the role assignment as carrying it. */
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
      {/*
       * Keyed by role: selecting another role in the list while the Users
       * tab is open must start that role's roster at its first page, not
       * ask the server for page 5 of a role that may only have one.
       */}
      {canAdministerUsers ? (
        <RoleUserRoster key={role.id} role={role} />
      ) : (
        <RoleUsersRestricted role={role} />
      )}
      <ScopeNotice canManageOrgUnits={canManageOrgUnits} />
    </div>
  );
}
