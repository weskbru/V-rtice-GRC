import { ArrowRight } from 'lucide-react';

import { cn } from '../../lib/utils';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';
import { StatusBadge } from '../status-badge';

import { LoadMoreButton } from './load-more-button';

import type { AuditTimelineLabels, AuditTimelineProps } from './types';

/** Union of every key present in either allow-listed values object, in first-seen order — so a field that only changed FROM something (deleted) or only changed TO something (added) still gets a row. */
function diffKeys(
  previousValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown> | null | undefined,
): readonly string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const source of [previousValues, newValues]) {
    if (!source) continue;
    for (const key of Object.keys(source)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

/**
 * Renders an allow-listed field's raw value for display. Never assumes a
 * shape beyond JSON — `previousValues`/`newValues` are `Record<string,
 * unknown>` by contract (arbitrary allow-listed fields, FR-035).
 *
 * `labels.resolveFieldValue` gets first refusal on every non-absent value —
 * this is the caller's one hook for turning a raw id/enum/date into
 * something a reader recognizes (a category's name, "Alto", a formatted
 * date). When it declines (not supplied, or returns `undefined` for this
 * particular key/value), this function falls back to the generic,
 * domain-blind formatting below, so an unmapped field still renders
 * something instead of nothing.
 */
function formatFieldValue(key: string, value: unknown, labels: AuditTimelineLabels): string {
  if (value === null || value === undefined) return labels.notRecordedLabel;
  const resolved = labels.resolveFieldValue?.(key, value);
  if (resolved !== undefined) return resolved;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    // Circular reference or similar — `JSON.stringify` failed, so fall back
    // to a value that is always safe to compute (never `String(value)` on
    // an arbitrary object, which would print the unhelpful
    // `[object Object]`).
    return Object.prototype.toString.call(value);
  }
}

/**
 * Platform-wide raw audit-trail timeline (T169, US7, FR-033 to FR-037).
 * Distinct from `ActivityHistory`: this renders the immutable, append-only
 * `audit_event` record itself — actor, action, entity, outcome and the
 * allow-listed before/after values — never a narrative summary. `action`
 * and `entityType` are technical identifiers and are rendered EXACTLY as
 * given (CLAUDE.md §11.1); nothing in this component translates them.
 *
 * Shares `ActivityHistory`'s accessibility approach: a real `<ol role
 * ="list">` / `<li role="listitem">` list (with the roles restated
 * explicitly to survive the `list-style: none` reset across browsers), and
 * outcome is conveyed by `StatusBadge` — icon and text together, never
 * color alone (FR-091) — never this component's own opinion on which
 * `StatusVariant` an outcome deserves (`labels.outcomeVariant`, D-10).
 */
export function AuditTimeline({
  items,
  labels,
  isLoading = false,
  error,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className,
}: AuditTimelineProps): React.JSX.Element {
  if (isLoading) {
    return <LoadingState variant="block" label={labels.loading} />;
  }

  if (error) {
    return <ErrorState problem={error} />;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ol role="list" aria-label={labels.caption} className="flex list-none flex-col gap-4 pl-0">
        {items.map((entry) => {
          const changedKeys = diffKeys(entry.previousValues, entry.newValues);

          return (
            <li
              key={entry.id}
              role="listitem"
              className="flex flex-col gap-1.5 border-l-2 border-border py-0.5 pl-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  variant={labels.outcomeVariant(entry.outcome)}
                  label={labels.outcomeLabel(entry.outcome)}
                />
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                  {entry.action}
                </code>
              </div>

              <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <dt className="font-medium">{labels.occurredAtLabel}</dt>
                  <dd>{entry.occurredAtLabel}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="font-medium">{labels.actorLabel}</dt>
                  <dd>{entry.actorLabel}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="font-medium">{labels.entityLabel}</dt>
                  <dd>
                    <code className="text-muted-foreground">{entry.entityType}</code>
                    {entry.entityId ? ` (${entry.entityId})` : ''}
                  </dd>
                </div>
              </dl>

              {changedKeys.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 p-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {labels.changedFieldsLabel}
                  </p>
                  <dl className="flex flex-col gap-1">
                    {changedKeys.map((key) => (
                      <div key={key} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                        <dt className="font-medium text-muted-foreground">
                          {labels.fieldLabel(key)}:
                        </dt>
                        <dd className="flex flex-wrap items-center gap-1.5">
                          {/* Previous value is struck through AND muted —
                              two non-color signals that it no longer holds,
                              never color alone (FR-091). */}
                          <span className="text-muted-foreground line-through decoration-muted-foreground/60">
                            {formatFieldValue(key, entry.previousValues?.[key], labels)}
                          </span>
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3 shrink-0 text-muted-foreground"
                          />
                          <span className="font-semibold text-foreground">
                            {formatFieldValue(key, entry.newValues?.[key], labels)}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <dt className="font-medium">{labels.ipAddressLabel}</dt>
                  <dd>{entry.ipAddress ?? labels.notRecordedLabel}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="font-medium">{labels.userAgentLabel}</dt>
                  <dd className="max-w-xs truncate" title={entry.userAgent ?? undefined}>
                    {entry.userAgent ?? labels.notRecordedLabel}
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt className="font-medium">{labels.correlationIdLabel}</dt>
                  <dd>{entry.correlationId}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>

      {hasMore ? (
        <LoadMoreButton
          label={labels.loadMoreLabel}
          loadingLabel={labels.loadingMoreLabel}
          isLoading={isLoadingMore}
          onClick={onLoadMore}
        />
      ) : null}
    </div>
  );
}
