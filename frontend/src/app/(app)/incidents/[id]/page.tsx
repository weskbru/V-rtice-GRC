import { IncidentDetailView } from './incident-detail-view';

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <IncidentDetailView incidentId={id} />;
}
