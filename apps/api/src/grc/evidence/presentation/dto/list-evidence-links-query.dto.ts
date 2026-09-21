/**
 * T034/002-shared-grc-foundation, US1 — matches `GET
 * /evidence/{evidenceId}/links`'s `includeUnlinked` query parameter
 * (`contracts/grc-foundation.openapi.yaml`'s `listEvidenceLinks`
 * operation). `@Transform` boolean-coercion mirrors `ListRisksQueryDto`'s
 * own `toBoolean` helper.
 */
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Reads `obj[key]` — the UNTOUCHED raw query value — never the `value`
 * argument.
 *
 * The global `ValidationPipe` runs with `enableImplicitConversion: true`,
 * which coerces a field reflected as `boolean` via `Boolean(rawString)`
 * BEFORE any `@Transform` runs. `Boolean('false')` is a non-empty string,
 * so it is already `true` by the time a `@Transform(({ value }) => ...)`
 * receives it: an explicit `?flag=false` was silently read as `true`.
 *
 * Reproduced directly against this exact `class-transformer` version
 * before the fix (`plainToInstance(Dto, { flag: 'false' },
 * { enableImplicitConversion: true })` yielded `true`) and after it
 * (yields `false`). `apps/api/test/unit/query-boolean-coercion.spec.ts`
 * holds that reproduction for every DTO sharing this shape, so the pattern
 * cannot come back one file at a time — it was present in seven of them.
 */
function toBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

export class ListEvidenceLinksQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeUnlinked = false;
}
