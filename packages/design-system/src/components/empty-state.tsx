import { FileSearch, Inbox } from 'lucide-react';

import { cn } from '../lib/utils';

import type { ComponentType, ReactNode, SVGProps } from 'react';

export type EmptyStateVariant = 'empty' | 'no-results';

const DEFAULTS: Record<
  EmptyStateVariant,
  { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; description: string }
> = {
  empty: {
    icon: Inbox,
    title: 'Nada por aqui ainda',
    description: 'Os registros aparecerão aqui assim que forem criados.',
  },
  'no-results': {
    icon: FileSearch,
    title: 'Nenhum resultado encontrado para os filtros aplicados',
    description: 'Tente ajustar ou limpar os filtros e os termos de busca.',
  },
};

export interface EmptyStateProps {
  /**
   * 'empty' — the collection genuinely has no records yet.
   * 'no-results' — records exist but the current filters/search exclude
   * all of them. The register (and any future filterable list) MUST tell
   * these apart, since the correct next action differs (create vs. clear
   * filters).
   */
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** e.g. a "Create risk" or "Clear filters" button, owned by the caller. */
  action?: ReactNode;
  className?: string;
}

/** Platform-wide empty-state pattern (FR-045). */
export function EmptyState({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps): React.JSX.Element {
  const defaults = DEFAULTS[variant];
  const Icon = icon ?? defaults.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-10 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title ?? defaults.title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description ?? defaults.description}
        </p>
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
