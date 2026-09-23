/* global window, document, innerWidth, innerHeight */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const output = process.argv[2] ?? '../../docs/reviews/ui/login-proteus';
const sizes = [
  [1920, 1080],
  [1672, 941],
  [1536, 864],
  [1440, 900],
  [1366, 768],
  [1280, 800],
  [1024, 768],
  [768, 900],
  [390, 844],
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of process.env.LOGIN_CHECK_INTERACTIONS_ONLY ? [] : ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme: theme });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    for (const [width, height] of sizes) {
      if (process.env.LOGIN_CHECK_WIDTH && width !== Number(process.env.LOGIN_CHECK_WIDTH))
        continue;
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/login`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await page.getByRole('heading', { name: 'Entrar', exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        scroll: document.documentElement.scrollHeight > innerHeight,
        buttonBottom: document.querySelector('button[type=submit]').getBoundingClientRect().bottom,
        height: innerHeight,
      }));
      const axe = await new AxeBuilder({ page }).analyze();
      await page.screenshot({ path: path.join(output, `${theme}-${width}.png`), fullPage: true });
      results.push({
        theme,
        width,
        height,
        ...layout,
        axe: axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      });
      expect(layout.overflow).toBe(false);
      if (width >= 900) expect(layout.scroll).toBe(false);
      expect(layout.buttonBottom).toBeLessThanOrEqual(height);
      expect(axe.violations).toEqual([]);
    }
    expect(consoleErrors).toEqual([]);
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/login?returnTo=/risks`, { waitUntil: 'networkidle' });
  const password = page.getByLabel('Senha', { exact: true });
  await page.getByLabel('E-mail', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mostrar senha' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeFocused();
  await password.fill('invalid-password');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('invalid-password');
  await page.getByRole('button', { name: 'Ocultar senha' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByLabel('E-mail', { exact: true }).fill('login-visual-invalid@example.invalid');
  await password.press('Enter');
  await expect(page.getByRole('form').getByRole('alert')).toContainText(
    'E-mail ou senha incorretos.',
  );
  results.push({ invalidCredentials: true, enter: true, passwordVisibility: true });
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    let submissions = 0;
    await page.route('**/api/v1/auth/login', async (route) => {
      submissions++;
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await page.getByLabel('E-mail', { exact: true }).fill(process.env.SEED_ADMIN_EMAIL);
    await password.fill(process.env.SEED_ADMIN_PASSWORD);
    const loginResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/auth/login' &&
        response.request().method() === 'POST',
    );
    await password.press('Enter');
    await expect(page.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
    expect((await loginResponse).status()).toBe(200);
    await page.waitForURL((url) => url.pathname === '/risks' || url.pathname === '/profile', {
      timeout: 30000,
    });
    expect(submissions).toBe(1);
    results.push({
      validCredentials: true,
      redirect: new URL(page.url()).pathname,
      loading: true,
      submissions,
    });
  }
  await context.close();
} finally {
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
