import type { EntityCodePrefix } from '../entity-code.service';

export abstract class EntityCodeGeneratorPort {
  abstract nextCode(prefix: EntityCodePrefix, year: number): Promise<string>;
}
