'use client';

/**
 * PharosGRC — "Planos de Ação" register URL state, bringing this screen
 * into the shared register family (CLAUDE.md §18.12): the URL query string
 * IS the register's state, through the SAME `useUrlQueryCommit` mechanism
 * `use-register-state.ts` (Risks) and `use-engagement-catalog-state.ts`
 * (Audit Engagements) already use — see either of those hooks' own doc
 * comments for the full shareable-link/no-drift/Back-button reasoning this
 * file does not repeat.
 *
 * `GET /actions` (`ListActionsQuery`, `../types.ts`) accepts exactly ONE
 * value per filter field and no `sort`/free-text search at all — this hook
 * therefore carries no CSV-joined multi-value filter and no `q`/debounce
 * state, mirroring `use-engagement-catalog-state.ts`'s own identical
 * reasoning for `GET /audits`.
 *
 * `onlyMine` defaults to `true` — SC-002's own scenario ("um responsável vê
 * todo o trabalho atribuído a ele, de qualquer origem, numa única lista")
 * is this screen's whole reason to exist. Because it is the DEFAULT, it is
 * never written to the URL when true — only `onlyMine=false` ever appears,
 * exactly like every other default in this codebase's register hooks.
 */
import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useUrlQueryCommit } from '@/lib/register/url-state';

import type { ActionOriginType, ActionStatus } from '../types';

export const ACTIONS_REGISTER_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_VIEW: ActionsRegisterView = 'cards';

const VALID_STATUSES: ReadonlySet<string> = new Set<ActionStatus>([
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
const VALID_ORIGINS: ReadonlySet<string> = new Set<ActionOriginType>([
  'RISK_TREATMENT',
  'FINDING',
  'CONTROL_ASSESSMENT',
  'INCIDENT',
  'PROBLEM',
]);

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (ACTIONS_REGISTER_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseStatus(value: string | null): ActionStatus | undefined {
  return value && VALID_STATUSES.has(value) ? (value as ActionStatus) : undefined;
}

function parseOriginType(value: string | null): ActionOriginType | undefined {
  return value && VALID_ORIGINS.has(value) ? (value as ActionOriginType) : undefined;
}

function parseBooleanFlag(value: string | null): boolean {
  return value === 'true';
}

/** Which presentation the results area is currently rendering. Cards is the primary view (CLAUDE.md §18), matching every other register in this codebase. */
export type ActionsRegisterView = 'cards' | 'table';

export interface ActionsRegisterUrlState {
  page: number;
  pageSize: number;
  status: ActionStatus | undefined;
  originType: ActionOriginType | undefined;
  overdue: boolean;
  /** Defaults `true` (see this file's own header) — never written to the URL when true, so `?onlyMine=` absent always means "somente minhas ações". */
  onlyMine: boolean;
  view: ActionsRegisterView;
}

export interface UseActionsRegisterStateResult {
  state: ActionsRegisterUrlState;
  setStatus: (value: ActionStatus | undefined) => void;
  setOriginType: (value: ActionOriginType | undefined) => void;
  setOverdue: (value: boolean) => void;
  setOnlyMine: (value: boolean) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: ActionsRegisterView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** How many filter FIELDS are currently applied — shown on the collapsed "Filtros" button. `onlyMine` counts only when turned OFF (a divergence from its own default), never when true. */
  activeFilterCount: number;
}

export function useActionsRegisterState(): UseActionsRegisterStateResult {
  const searchParams = useSearchParams();
  // The commit mechanism — one change applied to the CURRENT query string,
  // `replace` not `push`, page reset by default — is shared with every
  // other register (`@/lib/register/url-state`). What stays here is what
  // only this register knows: its enums and its own `onlyMine` default.
  const commit = useUrlQueryCommit();

  const state: ActionsRegisterUrlState = {
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    status: parseStatus(searchParams.get('status')),
    originType: parseOriginType(searchParams.get('originType')),
    overdue: parseBooleanFlag(searchParams.get('overdue')),
    onlyMine: searchParams.get('onlyMine') === 'false' ? false : true,
    view: searchParams.get('view') === 'table' ? 'table' : DEFAULT_VIEW,
  };

  const setPage = useCallback(
    (page: number) => {
      commit((params) => {
        if (page > 1) {
          params.set('page', String(page));
        } else {
          params.delete('page');
        }
      }, false);
    },
    [commit],
  );

  const setPageSize = useCallback(
    (size: number) => {
      commit((params) => {
        if (size !== DEFAULT_PAGE_SIZE) {
          params.set('pageSize', String(size));
        } else {
          params.delete('pageSize');
        }
        params.delete('page');
      }, false);
    },
    [commit],
  );

  const setStatus = useCallback(
    (value: ActionStatus | undefined) => {
      commit((params) => {
        if (value) {
          params.set('status', value);
        } else {
          params.delete('status');
        }
      });
    },
    [commit],
  );

  const setOriginType = useCallback(
    (value: ActionOriginType | undefined) => {
      commit((params) => {
        if (value) {
          params.set('originType', value);
        } else {
          params.delete('originType');
        }
      });
    },
    [commit],
  );

  const setOverdue = useCallback(
    (value: boolean) => {
      commit((params) => {
        if (value) {
          params.set('overdue', 'true');
        } else {
          params.delete('overdue');
        }
      });
    },
    [commit],
  );

  const setOnlyMine = useCallback(
    (value: boolean) => {
      commit((params) => {
        if (!value) {
          params.set('onlyMine', 'false');
        } else {
          params.delete('onlyMine');
        }
      });
    },
    [commit],
  );

  const setView = useCallback(
    (view: ActionsRegisterView) => {
      commit((params) => {
        if (view === DEFAULT_VIEW) {
          params.delete('view');
        } else {
          params.set('view', view);
        }
      }, false);
    },
    [commit],
  );

  const clearFilters = useCallback(() => {
    commit((params) => {
      for (const key of ['status', 'originType', 'overdue', 'onlyMine']) {
        params.delete(key);
      }
    });
  }, [commit]);

  const activeFilterCount =
    (state.status !== undefined ? 1 : 0) +
    (state.originType !== undefined ? 1 : 0) +
    (state.overdue ? 1 : 0) +
    (state.onlyMine === false ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    setStatus,
    setOriginType,
    setOverdue,
    setOnlyMine,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
