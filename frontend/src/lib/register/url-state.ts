'use client';

// eslint-disable-next-line no-restricted-imports -- este hook centraliza o acesso à URL.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 350;

export type UrlQueryCommit = (
  mutate: (params: URLSearchParams) => void,
  resetPage?: boolean,
) => void;

export function useUrlQueryCommit(): UrlQueryCommit {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

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
      searchParamsStringRef.current = queryString;
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
}

export interface DebouncedSearchParamResult {
  inputValue: string;
  setValue: (value: string) => void;
  clear: () => void;
}

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
