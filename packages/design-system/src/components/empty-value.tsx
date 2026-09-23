import { cn } from '../lib/utils';

export interface EmptyValueProps {
  children: React.ReactNode;
  className?: string;
}

export function EmptyValue({ children, className }: EmptyValueProps): React.JSX.Element {
  return <span className={cn('text-xs text-muted-foreground italic', className)}>{children}</span>;
}
