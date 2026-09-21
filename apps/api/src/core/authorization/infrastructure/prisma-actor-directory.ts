/**
 * `ActorDirectoryPort` implementation (T177). See that port's header for
 * why this capability reads the `users` table directly rather than
 * depending on `core/identity`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ActorDirectoryPort } from '../domain/ports/actor-directory.port';

@Injectable()
export class PrismaActorDirectory extends ActorDirectoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findActorLabel(userId: string): Promise<string | undefined> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    return user?.fullName;
  }
}
