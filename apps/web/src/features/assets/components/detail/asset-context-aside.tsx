'use client';

import { DisclosureGroup } from '@pharos/design-system/components';
import { ChevronRight } from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { assets } from '@/lib/messages/assets';
import { cn } from '@/lib/utils';

import { formatTimestamp } from '../../date';

import type { AssetDetail } from '../../types';

interface AsideBlockProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

function AsideBlock({ id, title, children }: AsideBlockProps): React.JSX.Element {
  const isWide = useWideViewport();

  if (isWide) {
    return (
      <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2">
        <h2 id={`${id}-heading`} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {children}
      </section>
    );
  }

  return (
    <DisclosureGroup title={title} headingLevel={2}>
      <div className="flex flex-col gap-2">{children}</div>
    </DisclosureGroup>
  );
}

interface RelationshipRow {
  key: string;
  label: string;
  targetSection: string;
  hint?: string;
}

function assetSectionHref(assetId: string, sectionId: string): string {
  return `/assets/${assetId}?section=${sectionId}`;
}

export interface AssetContextAsideProps {
  asset: AssetDetail;
  activeSectionId: string;
}

export function AssetContextAside({
  asset,
  activeSectionId,
}: AssetContextAsideProps): React.JSX.Element {
  const messages = assets.detail;
  const panel = messages.relationshipsPanel;

  const relationshipRows: RelationshipRow[] = [
    {
      key: 'risks',
      label: panel.risks(asset.risks.length),
      targetSection: 'risks',
    },
    {
      key: 'controls',
      label: panel.controls(asset.controls.length),
      targetSection: 'controls',
    },
    {
      key: 'incidents',
      label: panel.incidents,
      targetSection: 'incidents',
      hint: panel.viewHint,
    },
  ];

  return (
    <>
      <AsideBlock id="asset-relationships" title={panel.heading}>
        <ul className="flex flex-col gap-1">
          {relationshipRows.map((row) => {
            const isActive = row.targetSection === activeSectionId;
            return (
              <li key={row.key}>
                <Link
                  href={assetSectionHref(asset.id, row.targetSection)}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={row.hint ? `${row.label} ${row.hint}` : row.label}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isActive ? 'bg-muted font-semibold text-foreground' : 'text-foreground/90',
                  )}
                >
                  <span aria-hidden="true" className="min-w-0 flex-1 truncate">
                    {row.label}
                  </span>
                  {row.hint ? (
                    <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">
                      {row.hint}
                    </span>
                  ) : null}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </AsideBlock>

      <AsideBlock id="asset-last-updated" title={messages.lastUpdatedHeading}>
        <p className="text-sm text-foreground">{formatTimestamp(asset.updatedAt)}</p>
      </AsideBlock>
    </>
  );
}
