import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { DashboardIconChip } from './dashboard-icon-chip';

import type { DashboardTone } from './dashboard-icon-chip';
import type { LucideIcon } from 'lucide-react';

export interface DashboardChartCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: DashboardTone;
  children: React.ReactNode;
  className?: string;
}

export function DashboardChartCard({
  title,
  description,
  icon,
  tone,
  children,
  className,
}: DashboardChartCardProps): React.JSX.Element {
  return (
    <Card className={cn('h-full gap-4 overflow-hidden py-4', className)}>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <DashboardIconChip icon={icon} tone={tone} size="sm" />
          <h3 data-slot="card-title" className="text-base leading-none font-semibold">
            {title}
          </h3>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}
