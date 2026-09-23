import { FrameworkVersionDetailView } from './framework-version-detail-view';

export default async function FrameworkVersionDetailPage({
  params,
}: {
  params: Promise<{ frameworkId: string; versionId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId, versionId } = await params;
  return <FrameworkVersionDetailView frameworkId={frameworkId} versionId={versionId} />;
}
