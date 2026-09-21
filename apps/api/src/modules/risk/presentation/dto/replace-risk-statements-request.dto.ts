/**
 * T093 — matches `contracts/risks.openapi.yaml`'s `ReplaceRiskStatementsRequest`
 * exactly (`additionalProperties: false`, `required: [items]`,
 * `maxItems: 50`). Shared verbatim by `PUT /risks/{riskId}/causes` and
 * `PUT /risks/{riskId}/consequences` — both operations declare the SAME
 * request schema (FR-057: "same replacement ... semantics as causes"), so
 * one DTO covers both; which child table (`RiskCause`/`RiskConsequence`) is
 * replaced is determined entirely by which route received the request, not
 * by anything in the body — the same pattern `LinkEntityRequestDto` already
 * establishes for the control/process/asset link endpoints.
 *
 * `items` is required (never `@IsOptional()`): the contract's "An empty
 * array clears it" means an explicit `[]` is a meaningful, valid replace —
 * omitting the property entirely is not the same request and is rejected
 * with `400`.
 */
import { ArrayMaxSize, IsArray, IsString, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReplaceRiskStatementsRequestDto {
  @IsArray({ message: USER_MESSAGES.dto.riskStatementItems.isArray })
  @ArrayMaxSize(50, { message: USER_MESSAGES.dto.riskStatementItems.arrayMaxSize })
  @IsString({ each: true, message: USER_MESSAGES.dto.riskStatementItems.isString })
  @MinLength(1, { each: true, message: USER_MESSAGES.dto.riskStatementItems.minLength })
  items!: string[];
}
