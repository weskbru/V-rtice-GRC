'use client';

/**
 * PharosGRC — Administration, roles and permissions
 * (015-roles-permissions-surface, T028–T047; the screen itself dates from
 * T182/FR-022/FR-023 of `specs/001-grc-platform-foundation`).
 *
 * The screen is an access-control surface, not a table of a database
 * entity: four aggregate indicators, search and filters, the roles as
 * cards, and a detail panel that opens beside the list — never a
 * navigation away from it (FR-009).
 *
 * ## Exactly two requests, whatever the number of roles
 *
 * `GET /admin/roles` (one page; roles are a bounded set the contract itself
 * describes that way) and `GET /admin/roles/summary` (one aggregate). Search,
 * kind, module and ordering all run over what is already loaded
 * (`role-filtering.ts`, research.md R-009), so nothing here scales with the
 * row count — the property SC-007 asserts and NFR-006 requires. This screen
 * already pays for A7-F07 (the listing's own per-row `countAssignedUsers`);
 * it does not add to it.
 *
 * The two requests are also independent on purpose: when the indicators
 * fail, they degrade to one quiet line and the roles underneath still load
 * and still filter (the kind filter remains in the filter bar).
 *
 * ## What this screen no longer does
 *
 * It no longer renders `DataTable` (D-03, reverting
 * `specs/012-admin-roles-screen/STATE.md` §2.1 by explicit request, with
 * the justification registered rather than assumed), and it no longer opens
 * `RoleDetailsDialog`/`RoleEditDialog` — reading and editing both happen in
 * the panel.
 *
 * Creating no longer opens `RoleCreateDialog` either (Fase 1 de "Novo
 * papel"): 015 deliberately left creation out of scope (FR-034), which left
 * the screen speaking two visual languages — a module tree with tri-state
 * selection for editing, a flat checklist in a modal for creating. The
 * create panel occupies the same grid cell as the detail panel, so only one
 * panel is ever open: selecting a role closes composition, and starting
 * composition clears the selection. Two panels side by side would mean two
 * "the thing you are working on" at once.
 */
import { PageHeader, ResultsToolbar } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ToolbarSelect } from '@/components/register/toolbar-select';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

import { adminApi } from '../../api';

import { PERMISSION_AREA_ORDER } from './permission-grouping';
import { RoleAdminSummary } from './role-admin-summary';
import { RoleCardList } from './role-card-list';
import { RoleCreatePanel } from './role-create-panel';
import { RoleDeleteDialog } from './role-delete-dialog';
import { RoleDetailPanel } from './role-detail-panel';
import { RoleFilterBar } from './role-filter-bar';
import { applyRoleCriteria, roleModuleReach } from './role-filtering';
import { useRoleSurfaceState } from './use-role-surface-state';

import type { PermissionArea } from './permission-grouping';
import type { Role, RoleSortOption, RolesSummary } from '../../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

/** The contract's own cap. Roles are a bounded set — twelve are seeded — so one page holds all of them. */
const PAGE_SIZE = 100;

export function RoleAdminView(): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const canManageRoles = hasPermission('role:administer');
  // FR-018/FR-019 — a separate permission, read separately. `role:administer`
  // never implies it, and nothing on this screen may treat it as if it did.
  const canAdministerUsers = hasPermission('user:administer');
  const canManageOrgUnits = hasPermission('org_unit:administer');

  const surface = useRoleSurfaceState();

  const [rows, setRows] = useState<readonly Role[]>([]);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const [summary, setSummary] = useState<RolesSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  const [creating, setCreating] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  // `loading` is derived rather than set synchronously at the top of the
  // effect — the same pattern (and the same `react-hooks/set-state-in-effect`
  // reason) as `UserAdminView` and the previous version of this screen.
  const [resolvedReloadToken, setResolvedReloadToken] = useState<number | null>(null);
  const loading = resolvedReloadToken !== reloadToken;

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listRoles(1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setError(undefined);
        setResolvedReloadToken(reloadToken);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError) {
          setError({
            title: caught.problem.title,
            detail: caught.problem.detail,
            correlationId: caught.problem.correlationId,
          });
        } else {
          setError({});
        }
        setResolvedReloadToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getRolesSummary()
      .then((result) => {
        if (cancelled) return;
        setSummary(result);
        setSummaryError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSummaryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function reload(): void {
    setReloadToken((token) => token + 1);
  }

  const visibleRoles = useMemo(
    () =>
      applyRoleCriteria(
        rows,
        { q: surface.state.q, type: surface.state.type, module: surface.state.module },
        surface.state.sort,
      ),
    [rows, surface.state.q, surface.state.type, surface.state.module, surface.state.sort],
  );

  /** Only the modules at least one loaded role actually reaches — an option that can only ever return an empty list is not offered. */
  const availableModules = useMemo(() => {
    const labels = new Map<PermissionArea, string>();
    for (const role of rows) {
      // Not named `module`: `@next/next/no-assign-module-variable` reserves
      // that identifier.
      for (const reach of roleModuleReach(role)) {
        labels.set(reach.area, reach.label);
      }
    }
    return PERMISSION_AREA_ORDER.filter((area) => labels.has(area)).map((area) => ({
      area,
      label: labels.get(area) ?? area,
    }));
  }, [rows]);

  // Derived from every loaded role, not from the filtered list: narrowing the
  // filters must not slam the open panel shut on a role the user is reading.
  const selectedRole = rows.find((role) => role.id === selectedRoleId) ?? null;

  function startCreating(): void {
    // One panel at a time — the two share the grid's second column.
    setSelectedRoleId(null);
    setCreating(true);
  }

  function selectRole(role: Role): void {
    setCreating(false);
    setSelectedRoleId(role.id);
  }

  // FR-026's sibling for creation: the action exists only for a caller who
  // holds `role:administer`, and the server refuses the request regardless.
  const createAction = canManageRoles ? (
    <Button onClick={startCreating}>
      <Plus aria-hidden="true" className="size-4" />
      {admin.roles.createAction}
    </Button>
  ) : null;

  const isFiltered = surface.hasActiveFilters;

  return (
    <div className="flex flex-col gap-6">
      {/*
       * No breadcrumb here: the shell's own header already renders
       * "ADMINISTRAÇÃO / Papéis e permissões" as a `nav` landmark on every
       * authenticated screen (`components/shell/header.tsx`). A second one
       * would duplicate both the landmark and the words.
       */}
      <PageHeader
        title={admin.roles.pageTitle}
        description={admin.roles.pageDescription}
        actions={createAction}
      />

      <RoleAdminSummary
        summary={summary}
        isLoading={summary === null && !summaryError}
        hasError={summaryError}
        activeType={surface.state.type}
        onSelectType={surface.setType}
      />

      <RoleFilterBar
        searchValue={surface.searchInputValue}
        onSearchChange={surface.setSearch}
        onClearSearch={surface.clearSearch}
        type={surface.state.type}
        onTypeChange={surface.setType}
        module={surface.state.module}
        onModuleChange={surface.setModule}
        availableModules={availableModules}
        hasActiveFilters={surface.hasActiveFilters}
        activeFilterCount={surface.activeFilterCount}
        onClearFilters={surface.clearFilters}
      />

      {/*
       * The strip between the filters and the results, as in every register:
       * how many roles matched on the left, and every decision about HOW they
       * are presented on the right. Ordering lives here rather than among the
       * filters because it reorders and never hides a role — it is not one of
       * the fields the "Filtros N" badge counts.
       *
       * `ResultsToolbar` also carries the count's `role="status"`, so a filter
       * change announces the new result size without moving focus — the same
       * guarantee the previous hand-written `aria-live` line gave, now from
       * the shared component.
       */}
      <ResultsToolbar
        count={
          isFiltered
            ? admin.roles.results.countOfTotal(visibleRoles.length, rows.length)
            : admin.roles.results.count(visibleRoles.length)
        }
        isLoading={loading}
        loadingLabel={admin.roles.results.countLoading}
      >
        <ToolbarSelect
          label={admin.roles.results.sortLabel}
          prefix={admin.roles.results.sortLabel}
          options={Object.entries(admin.roles.results.sortOptions).map(([value, label]) => ({
            value,
            label,
          }))}
          value={surface.state.sort}
          onValueChange={(value) => surface.setSort(value as RoleSortOption)}
          /*
           * `15rem`, measured rather than copied. At `13rem` the trigger
           * offers 158 px of text box and the longest option, "Quantidade de
           * permissões", needs 165: it rendered as "Quantidade de permissõe"
           * at 1440 px — a clipped label in the ONE control FR-005b requires
           * to always NAME the ordering in force. `15rem` gives 190 px.
           *
           * One width, not a responsive `w-full` below `sm`: the toolbar's
           * control group is sized to its content, so a percentage resolves
           * against that content and left the trigger at 210 px — clipping
           * the same label again, at 390 px this time. With a fixed base the
           * trigger settles at 215 px there (flex shrink against the count
           * line) and the 165 px label still fits.
           *
           * `max-w-full` is the guard if that ever stops being true: the
           * trigger gives up width, the page never scrolls sideways
           * (NFR-005, F-66 cause 1). Verified at 1440 and 390 px, both
           * themes: document and `<main>` scroll width equal client width.
           */
          triggerClassName="w-[15rem] max-w-full"
        />
      </ResultsToolbar>

      <div
        className={cn(
          // `items-start` is what lets the panel be `sticky`: a grid item
          // stretched to the row's height has nothing left to stick to.
          'grid grid-cols-1 items-start gap-4',
          (selectedRole !== null || creating) && 'xl:grid-cols-[minmax(0,1fr)_26rem]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <RoleCardList
            roles={visibleRoles}
            totalRoles={rows.length}
            selectedRoleId={selectedRoleId}
            onSelect={selectRole}
            isLoading={loading}
            error={error}
            onRetry={reload}
            onClearFilters={surface.clearFilters}
            createAction={createAction}
          />
        </div>

        {creating && canManageRoles ? (
          <RoleCreatePanel
            onClose={() => setCreating(false)}
            onCreated={(created) => {
              setCreating(false);
              feedback.success(admin.roles.feedback.createSuccess);
              // Select what was just created: the reload brings it into
              // `rows`, and the panel then opens on it, so "where did it
              // go?" never has to be answered by hunting the list.
              setSelectedRoleId(created.id);
              reload();
            }}
          />
        ) : null}

        {selectedRole ? (
          <RoleDetailPanel
            key={selectedRole.id}
            role={selectedRole}
            canManageRoles={canManageRoles}
            canAdministerUsers={canAdministerUsers}
            canManageOrgUnits={canManageOrgUnits}
            onClose={() => setSelectedRoleId(null)}
            onSaved={() => {
              feedback.success(admin.roles.feedback.updateSuccess);
              reload();
            }}
            onDelete={setDeletingRole}
          />
        ) : null}
      </div>

      {canManageRoles ? (
        <RoleDeleteDialog
          role={deletingRole}
          onOpenChange={(open) => {
            if (!open) setDeletingRole(null);
          }}
          onDeleted={() => {
            setSelectedRoleId(null);
            setDeletingRole(null);
            feedback.success(admin.roles.feedback.deleteSuccess);
            reload();
          }}
          onError={(message) => feedback.error(message)}
        />
      ) : null}
    </div>
  );
}
