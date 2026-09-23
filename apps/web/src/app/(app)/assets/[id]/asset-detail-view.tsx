'use client';

import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Eye, Pencil, ShieldAlert, ShieldCheck, Siren } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { assetsApi } from '@/features/assets/api';
import { AssetLifecycleActions } from '@/features/assets/components/asset-lifecycle-actions';
import {
  AssetLinkedControlsSection,
  AssetLinkedIncidentsSection,
  AssetLinkedRisksSection,
} from '@/features/assets/components/asset-linked-entities-section';
import { AssetOverview } from '@/features/assets/components/asset-overview';
import { AssetContextAside } from '@/features/assets/components/detail/asset-context-aside';
import { AssetEditPanel } from '@/features/assets/components/detail/asset-edit-panel';
import { formatTimestampDate } from '@/features/assets/date';
import { assetSituationLabel, assetSituationVariant } from '@/features/assets/situation';
import { ApiError } from '@/lib/api-client';
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

import type { AssetDetail } from '@/features/assets/types';
import type { EntityTab, ErrorStateProblem } from '@pharos/design-system/components';

export interface AssetDetailViewProps {
  assetId: string;
}

export function AssetDetailView({ assetId }: AssetDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={assets.detail.loading} />}>
      <AssetDetailViewContent assetId={assetId} />
    </Suspense>
  );
}

function AssetDetailViewContent({ assetId }: AssetDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await assetsApi.getAsset(assetId);
        if (!cancelled) {
          setAsset(result);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else if (error instanceof ApiError) {
          setProblem({
            title: error.problem.title,
            detail: error.problem.detail,
            correlationId: error.problem.correlationId,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={assets.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={assets.detail.notFoundTitle}
        description={assets.detail.notFoundDescription}
      />
    );
  }

  if (!asset) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('asset:edit');
  const canAdminister = hasPermission('asset:administer');

  const tabs: EntityTab[] = [
    {
      id: 'overview',
      label: assets.detail.sections.overview,
      icon: Eye,
      content: (
        <div className="flex flex-col gap-6">
          <AssetOverview asset={asset} />
          <AssetLifecycleActions
            asset={asset}
            canAdminister={canAdminister}
            onChanged={(updated) => setAsset(updated)}
          />
        </div>
      ),
    },
    {
      id: 'risks',
      label: assets.detail.sections.risks,
      icon: ShieldAlert,
      content: <AssetLinkedRisksSection risks={asset.risks} />,
    },
    {
      id: 'controls',
      label: assets.detail.sections.controls,
      icon: ShieldCheck,
      content: <AssetLinkedControlsSection controls={asset.controls} />,
    },
    {
      id: 'incidents',
      label: assets.detail.sections.incidents,
      icon: Siren,
      content: <AssetLinkedIncidentsSection assetId={asset.id} />,
    },
  ];

  const activeSectionId = tabs.some((tab) => tab.id === sectionParam) ? sectionParam! : tabs[0]!.id;

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/assets" className="hover:underline">
                  {assets.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{asset.code}</span>
              </>
            }
            code={asset.code}
            title={asset.name}
            badges={
              <StatusBadge
                variant={assetSituationVariant(asset.isActive)}
                label={assetSituationLabel(asset.isActive)}
              />
            }
            metadata={
              <>
                <span>
                  {asset.orgUnit
                    ? assets.detail.metadata.orgUnit(asset.orgUnit.name)
                    : assets.detail.metadata.noOrgUnit}
                </span>
                <span>
                  {assets.detail.metadata.createdAt(formatTimestampDate(asset.createdAt))}
                </span>
                <span>
                  {assets.detail.metadata.updatedAt(formatTimestampDate(asset.updatedAt))}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {assets.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={common.entityTabs.sectionsAriaLabel}
            scrollLabels={{
              scrollBack: common.entityTabs.scrollBack,
              scrollForward: common.entityTabs.scrollForward,
            }}
            value={sectionParam ?? ''}
            onValueChange={setSection}
            tabs={tabs}
            size="compact"
          />
        }
        aside={<AssetContextAside asset={asset} activeSectionId={activeSectionId} />}
        asideLabel={assets.detail.asideLabel}
      />

      {editing ? (
        <AssetEditPanel
          asset={asset}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setAsset(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
