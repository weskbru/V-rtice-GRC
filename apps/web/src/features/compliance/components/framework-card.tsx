'use client';

/**
 * PharosGRC — framework register card view, one framework (US1, CLAUDE.md
 * §18, §18.12). Mirrors `AssetCard`/`AuditEngagementCard`: no quick-view
 * side panel for this register, so the whole card is one stretched link to
 * `/compliance/{id}`, with the code repeated as its own smaller link purely
 * so it can be opened in a new tab independently.
 *
 * ## One deliberate difference from every other card in this family: no badge row
 *
 * `Framework` carries no lifecycle status of its own — only its
 * `FrameworkVersion`s do (`DRAFT`/`PUBLISHED`), and this register lists
 * frameworks, not versions. `origin` is a plain classification, never a
 * `StatusBadge` — the exact same "quiet text, not a colour, for a
 * non-lifecycle classifier" precedent `framework-register-columns.tsx`
 * already set for the table view, so the two views of this same register
 * never disagree about how a framework is described.
 */
import { Tag } from 'lucide-react';

import { formatTimestampDate } from '../date';

import type { Framework } from '../types';

import { Link } from '@/components/navigation/link';
import registerCardStyles from '@/components/register/register-card.module.css';
import { compliance } from '@/lib/messages/compliance';
import { cn } from '@/lib/utils';

export interface FrameworkCardProps {
  framework: Framework;
}

export function FrameworkCard({ framework }: FrameworkCardProps): React.JSX.Element {
  const card = compliance.register.card;

  return (
    <article
      data-tone="neutral"
      className={cn(
        registerCardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 hover:bg-accent/20',
        'has-[:focus-visible]:border-ring/60 has-[:focus-visible]:bg-accent/20',
      )}
    >
      <Link
        href={`/compliance/${framework.id}`}
        className="relative z-10 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {framework.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/compliance/${framework.id}`}
          aria-label={card.selectLabel(framework.code, framework.name)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {framework.name}
          </span>
        </Link>

        {framework.description ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {framework.description}
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="flex min-w-0 flex-col gap-0.5 text-xs">
          <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <Tag aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{card.originLabel}</span>
          </dt>
          <dd className="truncate font-medium text-foreground">
            {compliance.originLabels[framework.origin]}
          </dd>
        </dl>

        <p className="text-xs text-muted-foreground">
          {card.updatedAt(formatTimestampDate(framework.updatedAt))}
        </p>
      </div>
    </article>
  );
}
