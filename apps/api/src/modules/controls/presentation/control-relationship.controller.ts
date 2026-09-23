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
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import {
  LinkControlToAssetUseCase,
  UnlinkControlFromAssetUseCase,
} from '../application/links/control-asset-link.usecase';
import {
  LinkControlToProcessUseCase,
  UnlinkControlFromProcessUseCase,
} from '../application/links/control-process-link.usecase';
import {
  ListControlAssetLinksUseCase,
  ListControlProcessLinksUseCase,
  ListControlRiskLinksUseCase,
} from '../application/links/list-control-links.usecase';

import {
  toControlAssetLinkResponse,
  toControlProcessLinkResponse,
  toControlRiskLinkResponse,
  type ControlEntityLinkResponse,
  type ControlRiskLinkResponse,
} from './dto/control-relationship-response.mapper';
import { LinkEntityRequestDto } from './dto/link-entity-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

function parseIncludeWithdrawn(raw: string | undefined): boolean {
  return raw === 'true';
}

@Controller('controls/:controlId')
export class ControlRelationshipController {
  constructor(
    private readonly listRiskLinksUseCase: ListControlRiskLinksUseCase,
    private readonly listProcessLinksUseCase: ListControlProcessLinksUseCase,
    private readonly linkProcessUseCase: LinkControlToProcessUseCase,
    private readonly unlinkProcessUseCase: UnlinkControlFromProcessUseCase,
    private readonly listAssetLinksUseCase: ListControlAssetLinksUseCase,
    private readonly linkAssetUseCase: LinkControlToAssetUseCase,
    private readonly unlinkAssetUseCase: UnlinkControlFromAssetUseCase,
  ) {}

  @RequirePermission('control:view')
  @Get('risks')
  async listRiskLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly ControlRiskLinkResponse[]> {
    const links = await this.listRiskLinksUseCase.execute({
      actorUserId: session.userId,
      controlId,
      includeWithdrawn: parseIncludeWithdrawn(includeWithdrawnRaw),
    });
    return links.map(toControlRiskLinkResponse);
  }

  @RequirePermission('control:view')
  @Get('processes')
  async listProcessLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly ControlEntityLinkResponse[]> {
    const links = await this.listProcessLinksUseCase.execute({
      actorUserId: session.userId,
      controlId,
      includeWithdrawn: parseIncludeWithdrawn(includeWithdrawnRaw),
    });
    return links.map(toControlProcessLinkResponse);
  }

  @RequirePermission('control:edit')
  @Post('processes')
  @HttpCode(HttpStatus.CREATED)
  async linkProcess(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Body() body: LinkEntityRequestDto,
  ): Promise<ControlEntityLinkResponse> {
    const link = await this.linkProcessUseCase.execute({
      actorUserId: session.userId,
      controlId,
      processId: body.id,
    });
    return toControlProcessLinkResponse(link);
  }

  @RequirePermission('control:edit')
  @Delete('processes/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkProcess(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<void> {
    await this.unlinkProcessUseCase.execute({ actorUserId: session.userId, controlId, linkId });
  }

  @RequirePermission('control:view')
  @Get('assets')
  async listAssetLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly ControlEntityLinkResponse[]> {
    const links = await this.listAssetLinksUseCase.execute({
      actorUserId: session.userId,
      controlId,
      includeWithdrawn: parseIncludeWithdrawn(includeWithdrawnRaw),
    });
    return links.map(toControlAssetLinkResponse);
  }

  @RequirePermission('control:edit')
  @Post('assets')
  @HttpCode(HttpStatus.CREATED)
  async linkAsset(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Body() body: LinkEntityRequestDto,
  ): Promise<ControlEntityLinkResponse> {
    const link = await this.linkAssetUseCase.execute({
      actorUserId: session.userId,
      controlId,
      assetId: body.id,
    });
    return toControlAssetLinkResponse(link);
  }

  @RequirePermission('control:edit')
  @Delete('assets/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkAsset(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<void> {
    await this.unlinkAssetUseCase.execute({ actorUserId: session.userId, controlId, linkId });
  }
}
