import { AuditEngagementDetailView } from './audit-engagement-detail-view';

export default async function AuditEngagementDetailPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}): Promise<React.JSX.Element> {
  const { auditId } = await params;
  return <AuditEngagementDetailView auditId={auditId} />;
}
