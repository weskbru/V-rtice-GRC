/**
 * PharosGRC — risk detail route (T096, FR-093, FR-094).
 *
 * A thin server wrapper so the dynamic `id` segment is read without forcing
 * `RiskDetailView` to use `useParams` — same shape as `(app)/profile/page.tsx`.
 */
import { RiskDetailView } from './risk-detail-view';

export default async function RiskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <RiskDetailView riskId={id} />;
}
