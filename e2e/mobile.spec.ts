import { test, expect } from '@playwright/test';

test('Android-size layout: bottom navigation, camera scanner dialog, cart sheet', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/pos');
  const nav = page.locator('nav.fixed');
  await expect(nav.getByText('POS')).toBeVisible();
  await nav.getByText('Scan').click();
  await expect(page.getByText(/Scan barcode \/ QR code/)).toBeVisible();
  await page.getByPlaceholder('Or type code / SKU').fill('NL-FS-001');
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByRole('button', { name: /items/ }).click();
  await expect(page.getByRole('dialog').getByText('Nishat Linen — Formal Shirt')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-pos.png' });
});
