'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseDetailSectionResult {
  sectionParam: string | null;
  setSection: (id: string) => void;
}

export function useDetailSection(): UseDetailSectionResult {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSection = searchParams.get('section');

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
      lastUrlSectionRef.current = id;
      setSectionState(id);

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
