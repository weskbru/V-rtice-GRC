/**
 * Generic `class-validator` failure envelope — the title/detail pair used
 * whenever `ValidationPipe` rejects a request body, independent of which
 * module's DTO failed. Per-field messages live beside each DTO's own
 * module file instead (e.g. `risk.ts`'s `riskFields`, `admin.ts`'s
 * `adminUser`) — see `user-messages.ts`.
 */
export const validation = {
  requestValidationFailedTitle: 'Falha na validação da requisição',
  requestValidationFailedDetail: 'Um ou mais campos são inválidos.',
} as const;
