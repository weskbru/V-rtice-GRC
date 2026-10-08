import { FrameworkDetailView } from './framework-detail-view';

export default async function FrameworkDetailPage({
  params,
}: {
  params: Promise<{ frameworkId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId } = await params;
  return <FrameworkDetailView frameworkId={frameworkId} />;
}
