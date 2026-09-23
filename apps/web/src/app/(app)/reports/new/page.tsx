'use client';

import { EmptyState, PageHeader } from '@pharos/design-system/components';
import { ShieldOff } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { ReportForm } from '@/features/reports/components/report-form';
import { reports } from '@/lib/messages/reports';
import { usePermissions } from '@/lib/permissions';

export default function NewReportPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  if (!hasPermission('report:create')) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={reports.register.createForbidden.title}
        description={reports.register.createForbidden.description}
        action={
          <Button asChild variant="outline">
            <Link href="/reports">{reports.register.createForbidden.backAction}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={reports.form.createHeading} />
      <ReportForm onCreated={() => undefined} />
    </div>
  );
}
