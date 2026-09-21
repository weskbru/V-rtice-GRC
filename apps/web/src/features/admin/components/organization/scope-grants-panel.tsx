'use client';

/**
 * PharosGRC — Administration, organizational scope grants (T183, FR-025a,
 * FR-025b, FR-028). Picking a user (by name/e-mail search, `GET /users`)
 * shows and manages THEIR grants — the contract has no reverse lookup
 * ("who has scope on this unit"), only `GET /admin/users/{userId}/scope-
 * grants`, so this is the shape the real API supports. A new `UNIT` grant
 * defaults to whichever unit is selected in the tree; `GLOBAL` needs none.
 * A grant/revoke takes effect on the user's NEXT request, not immediately
 * for an already-open session (FR-028) — stated plainly, matching the
 * roles screen's identical notice.
 */
import { ConfirmDialog, EmptyValue } from '@pharos/design-system/components';
import { Building2, Loader2, Search, ShieldMinus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';

import { adminApi } from '../../api';

import type { DirectoryUser, OrgScopeGrant, OrgScopeType, OrgUnitNode } from '../../types';

export interface ScopeGrantsPanelProps {
  selectedUnit: OrgUnitNode | null;
  allUnits: readonly OrgUnitNode[];
}

export function ScopeGrantsPanel({
  selectedUnit,
  allUnits,
}: ScopeGrantsPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);

  const [grants, setGrants] = useState<readonly OrgScopeGrant[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const [scopeType, setScopeType] = useState<OrgScopeType>('UNIT');
  const [unitId, setUnitId] = useState('');
  const [granting, setGranting] = useState(false);

  const [pendingRevoke, setPendingRevoke] = useState<OrgScopeGrant | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Adjusted DURING rendering, not in an effect (React's own recommended
  // alternative for "reset this state when a prop changes" — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-
  // state-when-a-prop-changes): a `useEffect` calling `setUnitId`
  // synchronously would trip `react-hooks/set-state-in-effect` for a case
  // that does not need an effect at all. `unitId` still stays independently
  // editable afterward (the "Unidade" select below can override it) —
  // only a genuine change in which TREE node is selected snaps it back.
  //
  // Both sides of the comparison are normalized to `string` (never
  // `undefined`/`null`) — comparing `selectedUnit?.id` (which is `undefined`
  // when nothing is selected) against a `useState` default of `null`
  // produces `undefined !== null`, which is ALWAYS true and re-triggers the
  // `setState` calls on every single render, regardless of whether the
  // resolved id actually changed. React's own "too many re-renders" guard
  // caught exactly this while writing `admin-access.spec.ts` (T175) — a
  // real bug found and fixed by evidence, not by inspection alone.
  const resolvedUnitId = selectedUnit?.id ?? '';
  const [syncedUnitId, setSyncedUnitId] = useState(resolvedUnitId);
  if (resolvedUnitId !== syncedUnitId) {
    setSyncedUnitId(resolvedUnitId);
    setUnitId(resolvedUnitId);
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Nothing to clear via `setState` here: the results list below is
      // gated on `query.trim().length >= 2` in the JSX itself, so a leftover
      // `results` value from a previous, longer query is never rendered.
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      // Inside the timer callback, not the effect's own synchronous
      // execution — same reasoning `.then()`/`.catch()` callbacks elsewhere
      // in this file rely on (`react-hooks/set-state-in-effect`).
      setSearching(true);
      adminApi
        .searchDirectoryUsers(trimmed)
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch(() => {
          if (!cancelled) feedback.error(admin.organization.scopeGrants.searchError);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  // `loadingGrants` is derived from "the last RESOLVED grants key doesn't
  // match the one this render calls for" — see `UserAdminView`'s identical
  // pattern and doc comment (`react-hooks/set-state-in-effect`).
  const grantsKey = `${selectedUser?.id ?? ''}|${reloadToken}`;
  const [resolvedGrantsKey, setResolvedGrantsKey] = useState<string | null>(null);
  const loadingGrants = selectedUser !== null && resolvedGrantsKey !== grantsKey;

  useEffect(() => {
    if (!selectedUser) {
      // Nothing to clear via `setState` here: the grants table below only
      // renders while `selectedUser` is truthy, so a leftover `grants` value
      // from a previously selected user is never rendered while this branch
      // is the current one.
      return;
    }
    let cancelled = false;
    adminApi
      .listUserScopeGrants(selectedUser.id)
      .then((result) => {
        if (cancelled) return;
        setGrants(result);
        setResolvedGrantsKey(grantsKey);
      })
      .catch(() => {
        if (cancelled) return;
        feedback.error(admin.organization.scopeGrants.loadError);
        setResolvedGrantsKey(grantsKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `grantsKey` is derived from these exact two fields; listing it too would refetch on the same change twice for no benefit.
  }, [selectedUser, reloadToken]);

  async function handleGrant(): Promise<void> {
    if (!selectedUser) return;
    setGranting(true);
    try {
      await adminApi.grantUserScope(selectedUser.id, {
        scopeType,
        orgUnitId: scopeType === 'UNIT' ? unitId || null : null,
      });
      feedback.success(admin.organization.scopeGrants.grantSuccess);
      setReloadToken((token) => token + 1);
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        feedback.error(admin.organization.scopeGrants.duplicateError);
      } else {
        feedback.error(admin.organization.scopeGrants.genericError);
      }
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(): Promise<void> {
    if (!selectedUser || !pendingRevoke) return;
    setRevoking(true);
    try {
      await adminApi.revokeUserScope(selectedUser.id, pendingRevoke.id);
      feedback.success(admin.organization.scopeGrants.revokeSuccess);
      setPendingRevoke(null);
      setReloadToken((token) => token + 1);
    } catch {
      feedback.error(admin.organization.scopeGrants.genericError);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">
          {admin.organization.scopeGrants.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {admin.organization.scopeGrants.description}
        </p>
        {/* Ties this panel back to the tree's own selection state (task brief: the tree and the grant panel must read as one connected surface, not two independent widgets) — a new `UNIT` grant below defaults to exactly this unit. */}
        {selectedUnit ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs font-medium text-foreground">
            <Building2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
            {admin.organization.scopeGrants.selectedUnitLabel(selectedUnit.name)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={admin.organization.scopeGrants.userSearchLabel}
            placeholder={admin.organization.scopeGrants.userSearchPlaceholder}
            className="pl-8"
            value={selectedUser ? selectedUser.fullName : query}
            onChange={(event) => {
              setSelectedUser(null);
              setQuery(event.target.value);
            }}
          />
          {selectedUser ? (
            <button
              type="button"
              aria-label={common.actions.remove}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSelectedUser(null);
                setQuery('');
              }}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
        {!selectedUser && query.trim().length >= 2 ? (
          <ul className="flex max-w-sm flex-col gap-1 rounded-md border border-border p-1">
            {searching ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">…</li>
            ) : results.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">
                {admin.organization.scopeGrants.noSearchResults}
              </li>
            ) : (
              results.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setSelectedUser(candidate);
                      setQuery('');
                      setResults([]);
                    }}
                  >
                    <span className="font-medium text-foreground">{candidate.fullName}</span>
                    <span className="text-xs text-muted-foreground">{candidate.email}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {!selectedUser ? (
        <p className="text-sm text-muted-foreground">
          {admin.organization.scopeGrants.noUserSelected}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-foreground">
            {admin.organization.scopeGrants.grantsTitle(selectedUser.fullName)}
          </h3>

          <Table>
            <TableCaption className="sr-only">
              {admin.organization.scopeGrants.grantsTitle(selectedUser.fullName)}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{admin.organization.scopeGrants.columns.type}</TableHead>
                <TableHead>{admin.organization.scopeGrants.columns.unit}</TableHead>
                <TableHead>{admin.organization.scopeGrants.columns.grantedBy}</TableHead>
                <TableHead>{admin.organization.scopeGrants.columns.grantedAt}</TableHead>
                <TableHead className="sr-only">
                  {admin.organization.scopeGrants.revokeAction}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingGrants ? (
                <TableRow>
                  <TableCell colSpan={5}>…</TableCell>
                </TableRow>
              ) : grants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    {admin.organization.scopeGrants.empty}
                  </TableCell>
                </TableRow>
              ) : (
                grants.map((grant) => (
                  <TableRow key={grant.id}>
                    <TableCell>
                      {grant.scopeType === 'GLOBAL'
                        ? admin.organization.scopeGrants.scopeType.global
                        : admin.organization.scopeGrants.scopeType.unit}
                    </TableCell>
                    <TableCell>
                      {grant.orgUnit ? (
                        grant.orgUnit.name
                      ) : (
                        <EmptyValue>{admin.organization.scopeGrants.notApplicable}</EmptyValue>
                      )}
                    </TableCell>
                    <TableCell>
                      {grant.grantedBy ? (
                        grant.grantedBy.fullName
                      ) : (
                        <EmptyValue>{admin.organization.scopeGrants.notApplicable}</EmptyValue>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(grant.grantedAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Revoking a grant is reversible (it can be re-granted) but immediately narrows what this user can see — the "sensitive" tier, carried here through the same warning tone as every other security-relevant-but-non-destructive action in Administration (CLAUDE.md §18.11). */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-status-warning-fg hover:bg-status-warning-bg hover:text-status-warning-fg"
                        onClick={() => setPendingRevoke(grant)}
                      >
                        <ShieldMinus aria-hidden="true" className="size-4" />
                        {admin.organization.scopeGrants.revokeAction}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                {admin.organization.scopeGrants.form.scopeTypeLabel}
              </span>
              <Select
                value={scopeType}
                onValueChange={(value) => setScopeType(value as OrgScopeType)}
              >
                <SelectTrigger
                  className="w-48"
                  aria-label={admin.organization.scopeGrants.form.scopeTypeLabel}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIT">
                    {admin.organization.scopeGrants.form.unitOption}
                  </SelectItem>
                  <SelectItem value="GLOBAL">
                    {admin.organization.scopeGrants.form.globalOption}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scopeType === 'UNIT' ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {admin.organization.scopeGrants.form.unitLabel}
                </span>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger
                    className="w-64"
                    aria-label={admin.organization.scopeGrants.form.unitLabel}
                  >
                    <SelectValue
                      placeholder={admin.organization.scopeGrants.form.unitPlaceholder}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {allUnits.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button
              type="button"
              disabled={granting || (scopeType === 'UNIT' && !unitId)}
              onClick={() => void handleGrant()}
            >
              {granting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {granting
                ? admin.organization.scopeGrants.form.submitting
                : admin.organization.scopeGrants.form.submit}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {admin.organization.scopeGrants.effectNotice}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        title={admin.organization.scopeGrants.revokeDialog.title}
        description={admin.organization.scopeGrants.revokeDialog.description}
        variant="sensitive"
        icon={ShieldMinus}
        isConfirming={revoking}
        onConfirm={() => void handleRevoke()}
        labels={{
          confirm: admin.organization.scopeGrants.revokeDialog.confirm,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
      />
    </div>
  );
}
