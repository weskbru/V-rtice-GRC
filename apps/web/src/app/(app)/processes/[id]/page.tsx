/**
 * PharosGRC — process detail route (T047). A thin server wrapper so the
 * dynamic `id` segment is read without forcing `ProcessDetailView` to use
 * `useParams` — same shape as `(app)/controls/[id]/page.tsx`.
 */
import { ProcessDetailView } from './process-detail-view';

export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ProcessDetailView processId={id} />;
}
