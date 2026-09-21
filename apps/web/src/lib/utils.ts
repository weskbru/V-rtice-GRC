import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { ClassValue } from 'clsx';

/**
 * Merge conditional class names and resolve conflicting Tailwind utility
 * classes (last one wins) — the standard shadcn/ui convention. Consumed by
 * every generated primitive in `src/components/ui/`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
