/**
 * PharosGRC — control detail route (T047). A thin server wrapper so the
 * dynamic `id` segment is read without forcing `ControlDetailView` to use
 * `useParams` — same shape as `(app)/risks/[id]/page.tsx`.
 */
import { ControlDetailView } from './control-detail-view';

export default async function ControlDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ControlDetailView controlId={id} />;
}
