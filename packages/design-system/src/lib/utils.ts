import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { ClassValue } from 'clsx';

/**
 * Merge conditional class names and resolve conflicting Tailwind utility
 * classes (last one wins), matching the shadcn/ui convention. Kept as a
 * self-contained copy (rather than importing from `apps/web`) so this
 * package never depends on an application — `packages/design-system` is
 * consumed by `apps/web` and every future module, never the reverse.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
