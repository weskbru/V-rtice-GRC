import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'pharos:isPublic';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
