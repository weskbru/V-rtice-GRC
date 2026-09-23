import { ProcessDetailView } from './process-detail-view';

export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ProcessDetailView processId={id} />;
}
