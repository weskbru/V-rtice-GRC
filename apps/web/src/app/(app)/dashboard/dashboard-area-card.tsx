import { Construction } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/lib/messages/dashboard';

export interface DashboardAreaCardProps {
  label: string;
}

export function DashboardAreaCard({ label }: DashboardAreaCardProps): React.JSX.Element {
  return (
    <Card className="border-dashed bg-muted/40 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Construction aria-hidden="true" className="size-4 shrink-0" />
          {label}
        </CardTitle>
        <CardDescription>{dashboard.plannedArea.message}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-muted-foreground">{dashboard.plannedArea.badge}</p>
      </CardContent>
    </Card>
  );
}
