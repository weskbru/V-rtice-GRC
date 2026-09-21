/**
 * PharosGRC — asset detail route (T047). A thin server wrapper so the
 * dynamic `id` segment is read without forcing `AssetDetailView` to use
 * `useParams` — same shape as `(app)/controls/[id]/page.tsx`.
 */
import { AssetDetailView } from './asset-detail-view';

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <AssetDetailView assetId={id} />;
}
