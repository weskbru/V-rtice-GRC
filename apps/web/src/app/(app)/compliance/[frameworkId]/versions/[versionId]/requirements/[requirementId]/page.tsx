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
