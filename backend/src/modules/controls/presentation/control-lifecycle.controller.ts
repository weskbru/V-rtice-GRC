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
