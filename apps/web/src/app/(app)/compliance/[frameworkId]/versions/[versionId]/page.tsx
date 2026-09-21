/**
 * PharosGRC — framework version detail route (US1). A thin server wrapper
 * so the dynamic `frameworkId`/`versionId` segments are read without
 * forcing `FrameworkVersionDetailView` to use `useParams` — same shape as
 * `(app)/controls/[id]/page.tsx`.
 */
import { FrameworkVersionDetailView } from './framework-version-detail-view';

export default async function FrameworkVersionDetailPage({
  params,
}: {
  params: Promise<{ frameworkId: string; versionId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId, versionId } = await params;
  return <FrameworkVersionDetailView frameworkId={frameworkId} versionId={versionId} />;
}
