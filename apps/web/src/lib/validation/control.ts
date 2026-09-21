import { z } from 'zod';

import { controls } from '../messages/controls';

/**
 * Client-side shape/presence validation for the control create/edit form
 * (T046). Mirrors `CreateControlRequest`/`UpdateControlRequest` in
 * `contracts/controls.openapi.yaml` on shape only — full business
 * validation (target org unit in scope, owner in the unit's organizational
 * line, FR-008) happens exclusively on the server and arrives as 422 field
 * errors, exactly like `lib/validation/risk.ts`'s own convention.
 *
 * `ownerUserId`, `nature`, `type` and `frequency` are all optional at
 * creation (FR-005, "controle sem dono" edge case) — the select controls
 * use `NONE_SELECT_VALUE` as the "nothing selected" sentinel (a Radix
 * `Select.Item` cannot carry an empty-string value), mapped to `null`
 * before reaching `controlsApi` via `toNullable`.
 */
export const NONE_SELECT_VALUE = '__none__';

export const controlFormSchema = z.object({
  name: z
    .string()
    .min(1, controls.form.validation.name.required)
    .max(300, controls.form.validation.name.tooLong),
  description: z.string().min(1, controls.form.validation.description.required),
  orgUnitId: z.string().min(1, controls.form.validation.orgUnit.required),
  ownerUserId: z.string(),
  nature: z.string(),
  type: z.string(),
  frequency: z.string(),
});

export type ControlFormValues = z.infer<typeof controlFormSchema>;

/** `''` or `NONE_SELECT_VALUE` both mean "not set" — the API's own nullable convention. */
export function toNullable(value: string): string | null {
  return value && value !== NONE_SELECT_VALUE ? value : null;
}
