import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import {
  NoPermissionRequired,
  RequirePermission,
} from '../../authorization/presentation/permission.guard';
import { CurrentSession } from '../../identity/presentation/current-session.decorator';
import { CreateCommentUseCase } from '../application/create-comment.usecase';
import { ListCommentsUseCase } from '../application/list-comments.usecase';
import { WithdrawCommentUseCase } from '../application/withdraw-comment.usecase';

import { toCommentResponse, type CommentResponse } from './dto/comment-response.mapper';
import { CreateCommentRequestDto } from './dto/create-comment-request.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request, Response } from 'express';

export interface CommentPageResponse {
  readonly data: readonly CommentResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('comments')
export class CommentController {
  constructor(
    private readonly createCommentUseCase: CreateCommentUseCase,
    private readonly listCommentsUseCase: ListCommentsUseCase,
    private readonly withdrawCommentUseCase: WithdrawCommentUseCase,
  ) {}

  @NoPermissionRequired()
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListCommentsQueryDto,
  ): Promise<CommentPageResponse> {
    const result = await this.listCommentsUseCase.execute({
      actorUserId: session.userId,
      entityType: query.entityType,
      entityId: query.entityId,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: result.items.map(toCommentResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('comment:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: CreateCommentRequestDto,
  ): Promise<CommentResponse> {
    const comment = await this.createCommentUseCase.execute({
      actorUserId: session.userId,
      entityType: body.entityType,
      entityId: body.entityId,
      body: body.body,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${comment.id}`);

    return toCommentResponse(comment);
  }

  @RequirePermission('comment:delete')
  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async withdraw(
    @CurrentSession() session: ValidatedSession,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<void> {
    await this.withdrawCommentUseCase.execute({
      actorUserId: session.userId,
      commentId,
    });
  }
}
