import { z } from 'zod';

import { assets } from '../messages/assets';

/**
 * Client-side shape/presence validation for the asset create/edit form
 * (T048). Mirrors `CreateAssetRequest`/`UpdateAssetRequest` in
 * `contracts/assets.openapi.yaml` on shape only — full business validation
 * (target org unit inside the caller's authorized scope, invariant A2)
 * happens exclusively on the server and arrives as 422 field errors,
 * exactly like `lib/validation/control.ts`'s own convention.
 *
 * `description` carries no presence rule — it is optional in the contract
 * — but the server's own `MinLength(1)` means an empty string is refused
 * the moment the field is present at all (`CreateAssetRequestDto`,
 * `UpdateAssetRequestDto`): `AssetForm` therefore omits the property
 * entirely rather than sending `''` whenever the trimmed value is empty
 * (see that component's own `buildCreateBody`/`buildUpdateBody`).
 */
export const assetFormSchema = z.object({
  name: z
    .string()
    .min(1, assets.form.validation.name.required)
    .max(300, assets.form.validation.name.tooLong),
  description: z.string(),
  orgUnitId: z.string().min(1, assets.form.validation.orgUnit.required),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;
