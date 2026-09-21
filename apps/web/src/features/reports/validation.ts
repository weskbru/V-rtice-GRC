import { z } from 'zod';

import { reports } from '@/lib/messages/reports';

/**
 * Client-side shape/presence validation for `ReportForm` (009-indicators-reports, T061), mirroring
 * `lib/validation/incidents.ts`'s own shape — `z.string().min(1, ...)` for every required text
 * field, the server as the sole authority on anything beyond presence (an unknown `metricKeys`
 * value, for instance) per `CreateReportDefinitionRequest` in `contracts/reports.openapi.yaml`.
 *
 * Kept inside `features/reports/` rather than `lib/validation/` — this task's own scope boundary
 * is `apps/web/src/features/reports/**`/`apps/web/src/app/(app)/reports/**`, and this schema has
 * no caller outside this feature.
 */
export const reportFormSchema = z.object({
  name: z.string().min(1, reports.form.validation.name.required),
  description: z.string().min(1, reports.form.validation.description.required),
  metricKeys: z.array(z.string()).min(1, reports.form.validation.metricKeys.required),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;
