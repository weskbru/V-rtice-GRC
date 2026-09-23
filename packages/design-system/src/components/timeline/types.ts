import type { ErrorStateProblem } from '../error-state';
import type { StatusVariant } from '../status-badge';

export interface ActivityHistoryEntry {
  id: string;
  kindLabel: string;
  occurredAtLabel: string;
  assertedDateLabel?: string | null;
  actorName: string;
  summary: string;
  previousValue?: string | null;
  newValue?: string | null;
}

export interface ActivityHistoryLabels {
  caption: string;
  loading: string;
  loadError: string;
  empty: string;
  recordedAtLabel: string;
  assertedDateLabel: string;
  previousValueLabel: string;
  newValueLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface ActivityHistoryProps {
  items: readonly ActivityHistoryEntry[];
  labels: ActivityHistoryLabels;
  isLoading?: boolean;
  error?: ErrorStateProblem;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

export interface AuditTimelineEntry {
  id: string;
  occurredAtLabel: string;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  outcome: string;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId: string;
}

export interface AuditTimelineLabels {
  caption: string;
  loading: string;
  loadError: string;
  empty: string;
  occurredAtLabel: string;
  actorLabel: string;
  entityLabel: string;
  notRecordedLabel: string;
  outcomeLabel: (outcome: string) => string;
  outcomeVariant: (outcome: string) => StatusVariant;
  changedFieldsLabel: string;
  fieldLabel: (key: string) => string;
  resolveFieldValue?: (key: string, value: unknown) => string | undefined;
  ipAddressLabel: string;
  userAgentLabel: string;
  correlationIdLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface AuditTimelineProps {
  items: readonly AuditTimelineEntry[];
  labels: AuditTimelineLabels;
  isLoading?: boolean;
  error?: ErrorStateProblem;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}
