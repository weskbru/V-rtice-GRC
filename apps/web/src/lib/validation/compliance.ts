import { z } from 'zod';

import { compliance } from '../messages/compliance';

/**
 * Client-side shape/presence validation for the Compliance forms
 * (004-compliance-management, US1). Mirrors `CreateFrameworkRequest`/
 * `UpdateFrameworkRequest`, `CreateFrameworkVersionRequest`/
 * `UpdateFrameworkVersionRequest` and `CreateRequirementRequest`/
 * `UpdateRequirementRequest` in `contracts/compliance.openapi.yaml` on shape
 * only — full business validation (e.g. a duplicate version `label`, FR-002)
 * happens exclusively on the server and arrives as a 422 field error,
 * exactly like `lib/validation/control.ts`'s own convention.
 */

/**
 * `origin` is a plain, non-empty string here — not `z.enum` — so the form's
 * "nothing selected yet" state (`''`, before the Radix `Select` has a value)
 * has a representable default; `FrameworkForm` narrows it to
 * `FrameworkOrigin` only when building the request body, mirroring
 * `ControlForm`'s own `toNullable`/cast convention for its enum-valued
 * selects.
 */
export const frameworkFormSchema = z.object({
  name: z
    .string()
    .min(1, compliance.frameworkForm.validation.name.required)
    .max(300, compliance.frameworkForm.validation.name.tooLong),
  description: z.string().min(1, compliance.frameworkForm.validation.description.required),
  origin: z.string().min(1, compliance.frameworkForm.validation.origin.required),
});

export type FrameworkFormValues = z.infer<typeof frameworkFormSchema>;

export const frameworkVersionFormSchema = z.object({
  label: z
    .string()
    .min(1, compliance.versionForm.validation.label.required)
    .max(100, compliance.versionForm.validation.label.tooLong),
});

export type FrameworkVersionFormValues = z.infer<typeof frameworkVersionFormSchema>;

export const requirementFormSchema = z.object({
  externalRef: z
    .string()
    .min(1, compliance.requirements.validation.externalRef.required)
    .max(100, compliance.requirements.validation.externalRef.tooLong),
  title: z
    .string()
    .min(1, compliance.requirements.validation.title.required)
    .max(300, compliance.requirements.validation.title.tooLong),
  description: z.string().min(1, compliance.requirements.validation.description.required),
});

export type RequirementFormValues = z.infer<typeof requirementFormSchema>;
