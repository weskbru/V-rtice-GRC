import type { Page } from '@playwright/test';

export const SEEDED_ROOT_ORG_UNIT_NAME = 'PharosGRC';

export async function selectSeededRootOrgUnit(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
  const rootOption = page.getByRole('option', { name: SEEDED_ROOT_ORG_UNIT_NAME, exact: true });
  if ((await rootOption.count()) === 0) {
    throw new Error(
      `The seeded root organizational unit ("${SEEDED_ROOT_ORG_UNIT_NAME}") is not among the ` +
        '"Unidade organizacional" combobox options. This most likely means the backend this run ' +
        'is pointed at was never seeded (apps/api/prisma/seed/platform.seed.ts) — or the caller is ' +
        'signed in as an actor whose organizational scope does not include the root, in which case ' +
        "selectSeededRootOrgUnit() is the wrong helper to call here (pick a unit within that actor's " +
        'own scope instead, as risk-approval.spec.ts/risk-history.spec.ts already do).',
    );
  }
  await rootOption.click();
}
