import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDirectory, '..');
const schemaSource = path.resolve(backendRoot, '../database/prisma/schema.prisma');
const temporaryDirectory = mkdtempSync(path.join(backendRoot, '.prisma-schema-'));
const schemaPath = path.join(temporaryDirectory, 'schema.prisma');
const require = createRequire(import.meta.url);
const prismaPackageJson = require.resolve('prisma/package.json');
const prismaCliEntry = path.join(path.dirname(prismaPackageJson), 'build', 'index.js');

try {
  cpSync(schemaSource, schemaPath);

  const result = spawnSync(
    process.execPath,
    [prismaCliEntry, 'generate', '--schema', schemaPath],
    {
      cwd: backendRoot,
      stdio: 'inherit',
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
