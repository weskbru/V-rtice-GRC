/**
 * Wraps `@nestjs/config`'s `ConfigModule` with `validateEnv` (T015), so an
 * invalid environment throws during Nest's bootstrap phase — before the
 * process ever accepts a request — and exports `AppConfigService` as the
 * only supported way for the rest of the codebase to read configuration.
 */
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.schema';

// `isGlobal: true` on ConfigModule.forRoot() only makes @nestjs/config's own
// ConfigModule/ConfigService global — it says nothing about AppConfigService,
// which is a provider of THIS module. `@Global()` here is what makes
// AppConfigService injectable from every other module (LoggingModule,
// PrismaModule, CacheModule, ...) without each of them importing
// AppConfigModule individually.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
