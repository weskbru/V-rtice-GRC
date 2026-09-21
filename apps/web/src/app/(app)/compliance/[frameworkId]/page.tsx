/**
 * PharosGRC — framework detail route (US1). A thin server wrapper so the
 * dynamic `frameworkId` segment is read without forcing
 * `FrameworkDetailView` to use `useParams` — same shape as
 * `(app)/controls/[id]/page.tsx`.
 */
import { FrameworkDetailView } from './framework-detail-view';

export default async function FrameworkDetailPage({
  params,
}: {
  params: Promise<{ frameworkId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId } = await params;
  return <FrameworkDetailView frameworkId={frameworkId} />;
}
