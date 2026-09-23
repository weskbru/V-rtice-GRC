import { z } from 'zod';

import { validation } from '../messages/validation';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, validation.email.required)
    .max(320, validation.email.invalid)
    .email(validation.email.invalid),
  password: z.string().min(1, validation.password.required).max(256),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, validation.currentPassword.required).max(256),
    newPassword: z
      .string()
      .min(12, validation.newPassword.tooShort)
      .max(256, validation.newPassword.tooLong),
    confirmNewPassword: z.string().min(1, validation.confirmNewPassword.required),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: validation.confirmNewPassword.mismatch,
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
