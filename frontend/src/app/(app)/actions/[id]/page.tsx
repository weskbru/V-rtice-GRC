import { ActionDetailView } from '@/features/actions/components/action-detail-view';

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ActionDetailView actionId={id} />;
}
