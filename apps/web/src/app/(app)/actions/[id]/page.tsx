/**
 * PharosGRC — action detail route (`/actions/{id}`). A thin server wrapper
 * so the dynamic `id` segment is read without forcing `ActionDetailView` to
 * use `useParams` — same shape as `(app)/incidents/[id]/page.tsx`.
 */
import { ActionDetailView } from '@/features/actions/components/action-detail-view';

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ActionDetailView actionId={id} />;
}
