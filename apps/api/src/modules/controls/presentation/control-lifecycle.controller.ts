/**
 * T023/003-controls-management — `ControlLifecycleController`:
 * `GET /controls/{controlId}/lifecycle`, `POST
 * /controls/{controlId}/transitions` per `contracts/controls.openapi.yaml`'s
 * "Control Lifecycle" operations (D-6, FR-004, FR-005, FR-006) — operations
 * 5-6 of 6.
 *
 * `POST /transitions` is deliberately `@NoPermissionRequired()`, not
 * `@RequirePermission(...)` — mirrors `modules/risk/presentation/lifecycle.controller.ts`'s
 * identical reasoning: a single route serving every `(from, to)` pair
 * cannot carry one static permission (`control:edit` for the three
 * non-terminal transitions, `control:administer` for entry into
 * `RETIRED`) — the real, per-pair check is performed one layer down, in
 * `PerformControlTransitionUseCase`.
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';

import {
  NoPermissionRequired,
  RequirePermission,
} from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { GetControlLifecycleUseCase } from '../application/lifecycle/get-control-lifecycle.usecase';
import { PerformControlTransitionUseCase } from '../application/perform-control-transition.usecase';

import { formatETag, parseIfMatchHeader } from './control.controller';
import {
  toControlLifecycleStateResponse,
  type ControlLifecycleStateResponse,
} from './dto/control-lifecycle-state-response.mapper';
import {
  toControlLifecycleTransitionResponse,
  type ControlLifecycleTransitionResponse,
} from './dto/control-lifecycle-transition-response.mapper';
import { TransitionControlRequestDto } from './dto/transition-control-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Response } from 'express';

@Controller('controls/:controlId')
export class ControlLifecycleController {
  constructor(
    private readonly getControlLifecycleUseCase: GetControlLifecycleUseCase,
    private readonly performControlTransitionUseCase: PerformControlTransitionUseCase,
  ) {}

  /** `getControlLifecycle` — the current state, and the transitions valid
   * from here AND permitted to this caller. */
  @RequirePermission('control:view')
  @Get('lifecycle')
  async getLifecycle(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
  ): Promise<ControlLifecycleStateResponse> {
    const state = await this.getControlLifecycleUseCase.execute({
      actorUserId: session.userId,
      controlId,
    });
    return toControlLifecycleStateResponse(state);
  }

  /** `transitionControl`. See this file's header for why this route is
   * `@NoPermissionRequired()` rather than a static `@RequirePermission`.
   * `@HttpCode(HttpStatus.OK)` because the contract declares `200`, not
   * Nest's `@Post()` default of `201` — this applies an existing control's
   * transition, nothing is "created". */
  @NoPermissionRequired()
  @Post('transitions')
  @HttpCode(HttpStatus.OK)
  async transition(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: TransitionControlRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlLifecycleTransitionResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { transition, control } = await this.performControlTransitionUseCase.execute({
      actorUserId: session.userId,
      controlId,
      expectedVersion,
      toStatus: body.toStatus,
      justification: body.justification,
    });

    response.set('ETag', formatETag(control.version));

    return toControlLifecycleTransitionResponse(transition);
  }
}
