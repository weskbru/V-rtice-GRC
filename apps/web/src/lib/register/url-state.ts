'use client';

// This hook writes the CURRENT screen's own query string (filters, sorting,
// pagination): not a navigation between screens, and routing it through
// `useNavigate` would raise the page-level institutional loader over a filter
// change (specs/014-institutional-loader §2.3).
// eslint-disable-next-line no-restricted-imports -- see above.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * PharosGRC — the mechanism behind "the URL query string IS the register's
 * state", shared by every module's own register-state hook.
 *
 * Each module keeps its own hook, because what the parameters MEAN — which
 * statuses exist, which fields the contract accepts for `sort`, what the
 * default page size is — is domain knowledge that has no business being
 * configured through a generic object. What is not domain knowledge, and was
 * nevertheless copied into eight hooks, is everything below: committing one
 * change to the current query string, not writing defaults, resetting the
 * page when the result set changes, and debouncing a search box without
 * losing a filter the user changed mid-debounce.
 *
 * That last one is not a detail. The copied implementations all carry the
 * same comment about the same real defect: a `setTimeout` armed by the
 * search box captures the query string as it was when the timer started, so
 * a status filter or a page click applied during the debounce window was
 * silently discarded when the timer fired. It is fixed here once, through a
 * ref that always holds the latest query string, instead of eight times.
 */

/** Long enough to absorb normal typing cadence, short enough that a settled query reaches the URL well within a moment of the user pausing. */
export const SEARCH_DEBOUNCE_MS = 350;

export type UrlQueryCommit = (
  mutate: (params: URLSearchParams) => void,
  resetPage?: boolean,
) => void;

/**
 * Returns a `commit` that applies one change to the CURRENT query string and
 * navigates with `router.replace`.
 *
 * `replace`, never `push`: a register must not stack one history entry per
 * filter click, so the Back button from a record's detail page lands on the
 * register exactly as it was left, rather than unwinding a trail of filter
 * states.
 *
 * `resetPage` defaults to true — changing what is filtered, searched or
 * sorted invalidates whatever page position made sense before. Callers that
 * manage `page` themselves (page navigation, page size, a view toggle, a
 * selection) pass `false`.
 */
export function useUrlQueryCommit(): UrlQueryCommit {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  // Always the query string this hook believes is CURRENT. Read through this
  // ref rather than closed over directly, so a deferred caller (a debounce
  // timer) commits against the current URL, not the one that existed when it
  // was armed.
  //
  // Written from two places, for two different kinds of "current":
  //
  //   1. Synchronously, at the bottom of `commit` below, to the query string
  //      THAT COMMIT just computed and handed to `router.replace`. This is
  //      what lets a second commit fired right after the first — a view
  //      toggle immediately followed by a filter change, both real clicks in
  //      the same user interaction — compose onto it instead of racing it.
  //      `router.replace`'s own navigation does not land synchronously
  //      (`useSearchParams()` only reflects it once Next.js's transition
  //      actually completes and this component re-renders), so without this
  //      write a second commit fired before that lands would rebuild from
  //      the PRE-first-commit snapshot and silently erase it — the router
  //      always applies the *last* `replace`, not a merge of both. This was
  //      a measured defect, not a hypothetical: `action-plan.spec.ts`'s own
  //      "switch to Tabela, then apply a filter" step reproduced it —
  //      landing back on Cards with the filter applied, the toggle
  //      overwritten.
  //   2. In an effect keyed on `useSearchParams()`, for every OTHER way the
  //      URL can change from under this hook — Back/Forward, a pasted link,
  //      any navigation this hook did not itself just perform. Effects flush
  //      before any later macrotask, so a debounce timer always sees the
  //      latest of either write. Because this effect's dependency is the
  //      search-params STRING, not a render count, it only re-fires when the
  //      URL actually differs from what write #1 already set — so it
  //      re-syncs an external change without clobbering a same-tick local
  //      one with a stale render's value.
  const searchParamsStringRef = useRef(searchParamsString);
  useEffect(() => {
    searchParamsStringRef.current = searchParamsString;
  }, [searchParamsString]);

  return useCallback(
    (mutate: (params: URLSearchParams) => void, resetPage = true) => {
      const next = new URLSearchParams(searchParamsStringRef.current);
      mutate(next);
      if (resetPage) {
        next.delete('page');
      }
      const queryString = next.toString();
      // Write #1 above — see the ref's own comment. Must happen before
      // `router.replace`, or (irrelevant to correctness here, since this
      // function is synchronous either way, but) so the ordering reads the
      // same as the comment describes: compute, remember, then navigate.
      searchParamsStringRef.current = queryString;
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
}

export interface DebouncedSearchParamResult {
  /** The input's live value — always current, even before the debounced URL commit fires. Bind the search box to this, never to the URL value. */
  inputValue: string;
  setValue: (value: string) => void;
  /** Clears the box and cancels any pending commit, for "clear all filters". The caller still removes the parameter in its own commit. */
  clear: () => void;
}

/**
 * Keeps a search box's visible value and its debounced URL parameter in
 * step, in both directions.
 *
 * Typing updates the box immediately and the URL once the user pauses; a
 * change that comes from anywhere else (Back/Forward, a pasted link, "clear
 * filters") updates the box and cancels a pending commit, so a timer armed
 * before the change can never overwrite it afterwards.
 */
export function useDebouncedSearchParam(
  urlValue: string,
  paramKey: string,
  commit: UrlQueryCommit,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): DebouncedSearchParamResult {
  const [inputValue, setInputValue] = useState(urlValue);
  const lastCommittedRef = useRef(urlValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function cancelPending(): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }

  useEffect(() => {
    if (urlValue !== lastCommittedRef.current) {
      cancelPending();
      lastCommittedRef.current = urlValue;
      setInputValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => () => cancelPending(), []);

  const setValue = useCallback(
    (value: string) => {
      setInputValue(value);
      cancelPending();
      timerRef.current = setTimeout(() => {
        lastCommittedRef.current = value;
        commit((params) => {
          if (value) {
            params.set(paramKey, value);
          } else {
            params.delete(paramKey);
          }
        });
      }, delayMs);
    },
    [commit, paramKey, delayMs],
  );

  const clear = useCallback(() => {
    cancelPending();
    lastCommittedRef.current = '';
    setInputValue('');
  }, []);

  return { inputValue, setValue, clear };
}
