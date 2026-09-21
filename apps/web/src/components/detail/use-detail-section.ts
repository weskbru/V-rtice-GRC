'use client';

/**
 * PharosGRC — shared detail-screen `?section=<id>` deep link, originally
 * built for risk detail (016-risk-detail-experience §4.4).
 *
 * The URL query string IS the durable record of the selected section — a
 * deep link, a refresh, and Back/Forward all resolve from it — but it is no
 * longer the RENDER source. See "023-detail-nav-performance" below for why.
 *
 * ## 023-detail-nav-performance: `router.replace()` was the 467ms
 *
 * Measured before this fix, clicking a section tab in every `?section=`
 * screen (Risks, Problems, Incidents, Controls, Assets — Action's own detail
 * screen has no `?section=` at all and, not coincidentally, was the one
 * screen that responded in ~55ms): 465–535ms from click to the tab visually
 * switching, and **two** RSC requests per click, even though the content
 * itself renders in single-digit milliseconds once selected and the
 * transition fetches zero application data. The cause was this hook's old
 * `setSection`, which called the shared `useUrlQueryCommit`
 * (`@/lib/register/url-state`), whose `commit` ends in `router.replace()` —
 * `next/navigation`'s `useRouter().replace`. In the App Router that is a
 * NAVIGATION, not a plain URL write: it dispatches `ACTION_NAVIGATE`
 * (`next/dist/client/components/router-reducer/reducers/navigate-reducer.js`),
 * which looks up (or creates, on demand — nothing here is ever prefetched by
 * hovering a `<button>`) a prefetch-cache entry for the exact new href, and
 * because these detail routes sit behind an authenticated, cookie-reading
 * layout (fully dynamic, no static shell to reuse), that lookup itself
 * resolves into a SECOND request — `fetchServerResponse` for the
 * `dynamicRequestTree` — to fill in the parts the on-demand prefetch could
 * not answer statically. Two server round trips to change which `<div>` is
 * visible in a component that already has all the data it needs, client-side.
 *
 * The fix bypasses `router.replace()` (and therefore `useUrlQueryCommit`)
 * entirely for this one parameter, using the native History API directly —
 * this is Next.js's own documented pattern for updating the query string of
 * the CURRENT screen without a navigation ("Using the native History API",
 * next.js's Linking and Navigating guide). Confirmed against the installed
 * 15.5.25 by reading its client bundle, not assumed:
 *
 *   - `next/dist/client/components/app-router.js` patches
 *     `window.history.pushState`/`replaceState` at mount. A call whose
 *     `data` does NOT already carry Next's own `__NA`/`_N` markers (i.e. any
 *     call this hook makes, passing `null`) is treated as EXTERNAL: Next
 *     copies its own internal `__PRIVATE_NEXTJS_INTERNALS_TREE` onto it
 *     (`copyNextJsInternalHistoryState`, so the tree is never lost) and
 *     dispatches `ACTION_RESTORE` with the new URL.
 *   - `ACTION_RESTORE` (`router-reducer/reducers/restore-reducer.js`) only
 *     ever reuses `state.cache` and recomputes `canonicalUrl` — it never
 *     fetches anything.
 *   - `useSearchParams()`/`usePathname()` are themselves derived from that
 *     same `canonicalUrl` (`useMemo` in `app-router.js`'s `Router`), so they
 *     pick up the change with zero network cost.
 *   - Back/Forward already goes through this exact same `ACTION_RESTORE`
 *     path (`dispatchTraverseAction` on `popstate`), so this fix changes
 *     NOTHING about Back/Forward — no extra `popstate` handling was added
 *     here.
 *
 * `setSection` still keeps its own synchronous `useState` mirror rather than
 * relying solely on that (correct, but React-`startTransition`-scheduled)
 * round trip, so the visual tab switch is not merely fast but exactly as
 * synchronous as Action's own uncontrolled `EntityTabs` already is — the
 * same "local state is the render source, the URL is reconciled into it"
 * shape `useDebouncedSearchParam` (`@/lib/register/url-state`) already uses
 * for the register's own search box, applied here to the same class of
 * problem: a value that must render immediately on user input while a
 * slower, asynchronous channel (there: a debounce; here: the router's own
 * transition) catches the URL up afterward.
 *
 * ## Scope: fixed here, not in `useUrlQueryCommit`
 *
 * `useUrlQueryCommit` is shared by eight modules' own register-state hooks
 * (filters, sorting, pagination) — changing its `router.replace()` there
 * would be a platform-wide behavioural change with no equivalent
 * measurement behind it, and no register screen was reported as slow. This
 * hook (`useDetailSection`) has exactly the two current consumers listed
 * below, so the smaller, fully-contained fix lives here.
 *
 * ## Promotion (018-incident-detail-experience)
 *
 * Moved here, verbatim in behaviour, from
 * `features/risks/components/detail/use-risk-detail-section.ts`
 * (`useRiskDetailSection` → `useDetailSection`,
 * `UseRiskDetailSectionResult` → `UseDetailSectionResult`). The promotion is
 * earned, not speculative (CLAUDE.md §19.10): Incidents' own detail screen
 * (018-incident-detail-experience) is the second real consumer of this
 * exact mechanism. Consumers today:
 * `apps/web/src/app/(app)/risks/[id]/risk-detail-view.tsx`,
 * `.../incidents/[id]/incident-detail-view.tsx`,
 * `.../problems/[id]/problem-detail-view.tsx`,
 * `.../controls/[id]/control-detail-view.tsx` and
 * `.../assets/[id]/asset-detail-view.tsx`.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseDetailSectionResult {
  /** The current `?section=` value, or `null` when absent. Resolving it against the current permission-filtered navigation model (falling back to the first visible section) is the caller's job — see `detail-navigation.ts`'s `resolveActiveDetailSection`. Backed by local state that updates synchronously on `setSection` (see this file's own header comment) and reconciles from the URL whenever it changes for any other reason (deep link, refresh, Back/Forward, a pasted link). */
  sectionParam: string | null;
  /** Selects a new section: updates the render source immediately, then writes `?section=` via the native History API (no `router.replace()` — see header comment). No history entry per click, mirroring the register's own `replace`-only convention. */
  setSection: (id: string) => void;
}

export function useDetailSection(): UseDetailSectionResult {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSection = searchParams.get('section');

  // The render source. Initialised from the URL (deep link / refresh work
  // with no extra round trip) and reconciled from it whenever the URL
  // changes for a reason OTHER than this hook's own `setSection` call below
  // — Back/Forward, a pasted link — exactly like `useDebouncedSearchParam`
  // reconciles its own `inputValue` from `urlValue` for the same reason.
  const [section, setSectionState] = useState(urlSection);
  const lastUrlSectionRef = useRef(urlSection);

  useEffect(() => {
    if (urlSection !== lastUrlSectionRef.current) {
      lastUrlSectionRef.current = urlSection;
      setSectionState(urlSection);
    }
  }, [urlSection]);

  const setSection = useCallback(
    (id: string) => {
      // Write #1: synchronous, so the tab visually switches on this same
      // click — never waits on the URL round trip below to land.
      lastUrlSectionRef.current = id;
      setSectionState(id);

      // Write #2: the durable, deep-linkable, Back/Forward-visible URL —
      // via the native History API, not `router.replace()`. See this file's
      // own header comment for why that distinction is the entire fix.
      const next = new URLSearchParams(searchParams.toString());
      next.set('section', id);
      const queryString = next.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      window.history.replaceState(null, '', url);
    },
    [pathname, searchParams],
  );

  return { sectionParam: section, setSection };
}
