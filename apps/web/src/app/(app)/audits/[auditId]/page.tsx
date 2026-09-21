/**
 * PharosGRC — audit engagement detail route (T076). A thin server wrapper
 * so the dynamic `auditId` segment is read without forcing
 * `AuditEngagementDetailView` to use `useParams` — same shape as
 * `(app)/controls/[id]/page.tsx`.
 */
import { AuditEngagementDetailView } from './audit-engagement-detail-view';

export default async function AuditEngagementDetailPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}): Promise<React.JSX.Element> {
  const { auditId } = await params;
  return <AuditEngagementDetailView auditId={auditId} />;
}
