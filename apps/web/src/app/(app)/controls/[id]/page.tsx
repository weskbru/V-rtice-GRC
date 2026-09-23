import { ControlDetailView } from './control-detail-view';

export default async function ControlDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ControlDetailView controlId={id} />;
}
