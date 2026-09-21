/**
 * T012/002-shared-grc-foundation — the sole implementation of
 * `EntityCodeGeneratorPort`. Same concurrency idiom as
 * `modules/risk/infrastructure/prisma-risk-code-generator.ts` — see that
 * file's header for the full explanation this one does not repeat.
 *
 * ## Collision avoidance under concurrency
 *
 * `grc_code_sequences` holds one row per `(prefix, year)` (composite
 * primary key). `nextCode` does exactly one `UPSERT`:
 *
 * ```sql
 * INSERT INTO grc_code_sequences (prefix, year, last_value) VALUES ($1, $2, 1)
 * ON CONFLICT (prefix, year) DO UPDATE SET last_value = grc_code_sequences.last_value + 1
 * RETURNING last_value;
 * ```
 *
 * (Prisma's `upsert` with an `{ increment: 1 }` update compiles to exactly
 * this `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` on PostgreSQL.) Two
 * concurrent transactions attempting this statement for the SAME
 * `(prefix, year)` are serialized at the row level by PostgreSQL exactly as
 * `PrismaRiskCodeGenerator` documents for `risk_code_sequences` — two
 * concurrent callers therefore always observe two DIFFERENT, sequential
 * `lastValue`s. `formatEntityCode` (`domain/entity-code.service.ts`) is a
 * pure function of `(prefix, year, sequence)`, so two different sequence
 * numbers can never format to the same code string. Two DIFFERENT prefixes
 * (e.g. an `Evidence` and an `Action` created at the same instant) never
 * contend at all — they are different rows.
 *
 * ## Why a failed creation does not "burn" a code number in the success
 * path
 *
 * Same reasoning as `PrismaRiskCodeGenerator`: `nextCode` is always called
 * from inside the SAME transaction scope as the entity row insert it is
 * generating a code for (a later task's use case, out of this task's
 * scope). If that transaction rolls back, PostgreSQL rolls back the
 * counter increment too, so a failed create never leaves a permanent gap.
 * A gap from some other cause (e.g. a crash between commit and an
 * unrelated failure) is still acceptable: R-008 requires `code` to be
 * unique, human-readable and immutable — it never requires the per-year
 * sequence to be gap-free.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { formatEntityCode } from '../domain/entity-code.service';
import { EntityCodeGeneratorPort } from '../domain/ports/entity-code-generator.port';

import type { EntityCodePrefix } from '../domain/entity-code.service';

@Injectable()
export class PrismaEntityCodeGenerator implements EntityCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {}

  async nextCode(prefix: EntityCodePrefix, year: number): Promise<string> {
    const row = await this.prisma.client.grcCodeSequence.upsert({
      where: { prefix_year: { prefix, year } },
      create: { prefix, year, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });

    return formatEntityCode(prefix, year, row.lastValue);
  }
}
