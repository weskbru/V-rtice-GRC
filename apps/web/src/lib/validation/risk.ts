import { z } from 'zod';

import { risks } from '../messages/risks';

/**
 * Client-side shape/presence validation for the risk create/edit form
 * (T095). Mirrors `CreateRiskRequest`/`UpdateRiskRequest` in
 * `contracts/risks.openapi.yaml` on shape only — full business validation
 * (referenced records exist/active, target org unit in scope, etc., FR-059)
 * happens exclusively on the server and arrives as 422 field errors.
 *
 * `categoryId`, `typeId`, `originId` and `responsibleUserId` are optional
 * per FR-055/FR-056 (a risk may leave these unset in `DRAFT`) — the select
 * controls in `risk-form.tsx` use `NONE_SELECT_VALUE` as the "nothing
 * selected" sentinel (a Radix `Select.Item` cannot carry an empty-string
 * value), so this schema accepts that sentinel too and the form maps it to
 * `null` before it ever reaches `risksApi`.
 */
export const NONE_SELECT_VALUE = '__none__';

export const riskFormSchema = z.object({
  title: z
    .string()
    .min(1, risks.validation.title.required)
    .max(300, risks.validation.title.tooLong),
  description: z.string().min(1, risks.validation.description.required),
  categoryId: z.string(),
  typeId: z.string(),
  originId: z.string(),
  orgUnitId: z.string().min(1, risks.validation.orgUnit.required),
  ownerUserId: z.string().min(1, risks.validation.owner.required),
  responsibleUserId: z.string(),
  identifiedOn: z.string().min(1),
  nextReviewOn: z.string(),
});

export type RiskFormValues = z.infer<typeof riskFormSchema>;

/** `''` or `NONE_SELECT_VALUE` both mean "not set" — the API's own nullable convention. */
export function toNullable(value: string): string | null {
  return value && value !== NONE_SELECT_VALUE ? value : null;
}
