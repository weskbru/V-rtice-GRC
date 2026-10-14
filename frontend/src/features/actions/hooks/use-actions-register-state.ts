'use client';

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

export type ActionsRegisterView = 'cards' | 'table';

export interface ActionsRegisterUrlState {
  page: number;
  pageSize: number;
  status: ActionStatus | undefined;
  originType: ActionOriginType | undefined;
  overdue: boolean;
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
  activeFilterCount: number;
}

export function useActionsRegisterState(): UseActionsRegisterStateResult {
  const searchParams = useSearchParams();
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
