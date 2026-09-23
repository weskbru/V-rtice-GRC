import type { ActionStatus } from '@prisma/client';

export function todayDateOnlyUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const OVERDUE_ELIGIBLE_ACTION_STATUSES: readonly ActionStatus[] = ['OPEN', 'IN_PROGRESS'];

export function isActionOverdue(dueOn: Date, status: ActionStatus, referenceDate: Date): boolean {
  if (!OVERDUE_ELIGIBLE_ACTION_STATUSES.includes(status)) {
    return false;
  }
  return dueOn.getTime() < referenceDate.getTime();
}

export function overdueEligibleActionStatusSqlList(): string {
  return OVERDUE_ELIGIBLE_ACTION_STATUSES.map((status) => `'${status}'`).join(', ');
}
