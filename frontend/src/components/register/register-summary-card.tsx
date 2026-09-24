import { SummaryStatCard } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { cn } from '@/lib/utils';

import styles from './register-summary-card.module.css';

import type { SummaryStatCardTone } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

export interface RegisterSummaryCardProps {
  href: string;
  linkLabel: string;
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: SummaryStatCardTone;
  isLoading?: boolean;
  className?: string;
}

export function RegisterSummaryCard({
  href,
  linkLabel,
  label,
  value,
  hint,
  icon,
  tone,
  isLoading = false,
  className,
}: RegisterSummaryCardProps): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-label={linkLabel}
      data-tone={tone}
      className={cn(
        'group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <SummaryStatCard
        label={label}
        value={value}
        hint={hint}
        icon={icon}
        tone={tone}
        isLoading={isLoading}
        className={styles.card}
      />
    </Link>
  );
}
