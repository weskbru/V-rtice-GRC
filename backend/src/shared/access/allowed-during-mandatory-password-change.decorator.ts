import { SetMetadata } from '@nestjs/common';

export const ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY =
  'vertice:allowedDuringMandatoryPasswordChange';

export const AllowedDuringMandatoryPasswordChange = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY, true);
