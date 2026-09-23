import { RiskDetailView } from './risk-detail-view';

export default async function RiskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <RiskDetailView riskId={id} />;
}
