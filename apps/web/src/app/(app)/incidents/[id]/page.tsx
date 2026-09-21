/**
 * PharosGRC — incident detail route (008-incidents-problems, US1). A thin
 * server wrapper so the dynamic `id` segment is read without forcing
 * `IncidentDetailView` to use `useParams` — same shape as
 * `(app)/assets/[id]/page.tsx`.
 */
import { IncidentDetailView } from './incident-detail-view';

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <IncidentDetailView incidentId={id} />;
}
