/**
 * PharosGRC — requirement detail route (US2/US3). A thin server wrapper so
 * the dynamic `frameworkId`/`versionId`/`requirementId` segments are read
 * without forcing `RequirementDetailView` to use `useParams` — same shape
 * as `versions/[versionId]/page.tsx`.
 */
import { RequirementDetailView } from './requirement-detail-view';

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ frameworkId: string; versionId: string; requirementId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId, versionId, requirementId } = await params;
  return (
    <RequirementDetailView
      frameworkId={frameworkId}
      versionId={versionId}
      requirementId={requirementId}
    />
  );
}
