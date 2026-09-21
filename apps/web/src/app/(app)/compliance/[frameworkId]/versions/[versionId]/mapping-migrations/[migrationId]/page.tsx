/**
 * PharosGRC — mapping migration detail route (US2, SC-004). A thin server
 * wrapper so the dynamic segments are read without forcing
 * `MappingMigrationDetailView` to use `useParams`.
 */
import { MappingMigrationDetailView } from './mapping-migration-detail-view';

export default async function MappingMigrationDetailPage({
  params,
}: {
  params: Promise<{ frameworkId: string; versionId: string; migrationId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId, versionId, migrationId } = await params;
  return (
    <MappingMigrationDetailView
      frameworkId={frameworkId}
      versionId={versionId}
      migrationId={migrationId}
    />
  );
}
