import { AssetDetailView } from './asset-detail-view';

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <AssetDetailView assetId={id} />;
}
