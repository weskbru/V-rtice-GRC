/**
 * T053/002-shared-grc-foundation, US2 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `CreateActionRequest` exactly.
 * No `orgUnitId` (derived from the origin, see `create-action.usecase.ts`'s
 * header) and no `status` (always `OPEN` at creation) — not declaring them
 * here means the global `ValidationPipe`'s `forbidNonWhitelisted` rejects a
 * caller who tries to smuggle either past creation.
 *
 * ## `ACTION_ORIGIN_TYPE_VALUES` is DERIVED, never hand-restated
 *
 * Coordinator finding, 2026-09-11: this list used to be a hand-typed
 * `['RISK_TREATMENT', 'FINDING']`, which silently fell out of step with
 * `ActionOriginType` not once but twice — `CONTROL_ASSESSMENT`
 * (003-controls-management) went live with a registered accessor, an
 * audit allow-list and a label, yet `POST /actions` still rejected it at
 * request validation; `INCIDENT`/`PROBLEM`
 * (008-incidents-problems) repeated the exact same gap the same night.
 * Both origin types were fully wired at the domain level — resolvers
 * registered, `test/unit/action-model-convergence-guard.spec.ts` green —
 * and unusable at the HTTP surface regardless, because that convergence
 * guard proves the ENUM's registrations converge; it never asked whether
 * this validator's own copy of the enum was still correct.
 *
 * `Object.values(ActionOriginType)` closes the gap permanently: every
 * value the schema declares is accepted the moment its migration lands,
 * with no second file to remember. `ActionOriginType` is imported as a
 * value (not `import type`) specifically so this line can call
 * `Object.values` on it — Prisma emits every schema enum as a real JS
 * object at runtime, not merely a TypeScript type.
 */
import { ActionOriginType } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

const ACTION_ORIGIN_TYPE_VALUES: readonly ActionOriginType[] = Object.values(ActionOriginType);

export class CreateActionRequestDto {
  @IsIn(ACTION_ORIGIN_TYPE_VALUES, { message: USER_MESSAGES.dto.action.originType.isIn })
  originType!: ActionOriginType;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.action.originId.isUuid })
  originId!: string;

  @IsString({ message: USER_MESSAGES.dto.action.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.action.title.length })
  title!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.action.description.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.action.description.maxLength })
  description?: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.action.responsibleUserId.isUuid })
  responsibleUserId!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.action.dueOn.isDateString })
  dueOn!: string;
}
