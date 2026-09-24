import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '../database/prisma/schema.prisma',
  migrations: {
    path: '../database/prisma/migrations',
    seed: 'ts-node --transpile-only seeds/index.ts',
  },
});
