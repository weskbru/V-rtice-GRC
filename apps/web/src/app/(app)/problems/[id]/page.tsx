/**
 * PharosGRC — problem detail route (008-incidents-problems, US2). A thin
 * server wrapper so the dynamic `id` segment is read without forcing
 * `ProblemDetailView` to use `useParams` — same shape as `(app)/assets/
 * [id]/page.tsx`.
 */
import { ProblemDetailView } from './problem-detail-view';

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ProblemDetailView problemId={id} />;
}
