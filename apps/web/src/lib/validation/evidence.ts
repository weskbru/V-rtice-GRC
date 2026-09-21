import { z } from 'zod';

import { evidence } from '../messages/evidence';

/**
 * Client-side shape/presence validation for `EvidenceCreateDialog` (T036),
 * mirroring `contracts/grc-foundation.openapi.yaml`'s `CreateEvidenceRequest`
 * (revised: no `fileId`) on shape only — Invariant E1 itself is re-checked
 * on the server and arrives as a 422 field error if this client-side
 * mirror is ever wrong, the same "server is the last line" discipline
 * `lib/validation/admin.ts`'s own header documents.
 */
export const createEvidenceFormSchema = z
  .object({
    title: z.string().min(1, evidence.form.validation.title.required),
    description: z.string(),
    type: z.string().min(1, evidence.form.validation.type.required),
    source: z.string().min(1, evidence.form.validation.source.required),
    ownerUserId: z.string().min(1, evidence.form.validation.ownerUserId.required),
    collectedOn: z.string().min(1, evidence.form.validation.collectedOn.required),
    validUntil: z.string(),
    externalUrl: z
      .string()
      .refine((value) => value.length === 0 || z.string().url().safeParse(value).success, {
        message: evidence.form.validation.externalUrl.invalid,
      }),
    observation: z.string(),
    note: z.string().max(1000, evidence.form.validation.noteTooLong),
  })
  .refine((values) => values.externalUrl.length > 0 || values.observation.length > 0, {
    message: evidence.form.validation.substance,
    path: ['observation'],
  });

export type CreateEvidenceFormValues = z.infer<typeof createEvidenceFormSchema>;
