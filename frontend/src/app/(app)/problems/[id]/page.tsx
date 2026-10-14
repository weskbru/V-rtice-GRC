import { ProblemDetailView } from './problem-detail-view';

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ProblemDetailView problemId={id} />;
}
