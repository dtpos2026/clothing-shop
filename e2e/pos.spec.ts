import { test, expect, type Page } from '@playwright/test';

async function freshApp(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByText('Total Sales', { exact: false }).or(page.getByText('Dashboard').first())).toBeVisible({ timeout: 20_000 });
}

const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('clothing-pos-store') || '{}').state);

test('meter sale from a thaan: 50 m roll, sell 4 m → 46 m', async ({ page }) => {
  await freshApp(page);
  // receive a 50 m thaan for a colour-meter product
  await page.goto('/#/goods-receiving');
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Reshmi Classic/ }).click();
  const s0 = await state(page);
  const prod0 = s0.products.find((p: { article: string }) => p.article === 'Reshmi Classic');
  await page.getByRole('combobox').nth(1).click().catch(() => undefined);
  await page.getByRole('option', { name: 'Black' }).click().catch(() => undefined);
  await page.locator('input[type=number]').first().fill('50');
  await page.getByPlaceholder(/TH-0042/).fill('TH-E2E');
  await page.getByRole('button', { name: /Receive/ }).click();
  await expect.poll(async () => (await state(page)).products.find((p: { id: string }) => p.id === prod0.id).stockQty).toBe(prod0.stockQty + 50);

  // sell 4 m in POS
  await page.goto('/#/pos');
  await page.getByPlaceholder(/Search or scan/).fill('Reshmi Classic');
  await page.locator('button', { hasText: 'Reshmi Classic' }).first().click();
  await page.getByRole('button', { name: /^Black/ }).click();
  await page.getByRole('button', { name: /By meter/ }).click();
  await page.getByLabel('Meters').fill('4');
  const sel = page.getByLabel('Cut from thaan');
  await sel.selectOption((await sel.locator('option', { hasText: 'TH-E2E' }).getAttribute('value'))!);
  await page.getByRole('button', { name: /^Add 4/ }).click();
  await page.getByRole('button', { name: /Complete Sale/ }).click();
  await expect(page.getByRole('heading', { name: /Invoice INV-/ })).toBeVisible();

  const s1 = await state(page);
  const prod1 = s1.products.find((p: { id: string }) => p.id === prod0.id);
  const roll = prod1.rolls.find((r: { rollNo: string }) => r.rollNo === 'TH-E2E');
  expect(roll.remainingMeters).toBe(46);
  expect(prod1.stockQty).toBe(prod0.stockQty + 46);
  expect(s1.sales.at(-1).items[0].sellUnit).toBe('meter');
});

test('USB scanner (keyboard wedge) adds the scanned product to the cart', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/pos');
  await expect(page.getByText(/Cart is empty/)).toBeVisible();
  await page.keyboard.type('NL-FS-001', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByText('Nishat Linen — Formal Shirt')).toBeVisible();
});

test('split payment with udhar needs a customer and creates credit', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/pos');
  await page.getByPlaceholder(/Search or scan/).fill('Formal Shirt');
  await page.locator('button', { hasText: 'Formal Shirt' }).first().click();
  await page.getByTitle('Split payment').click();
  await page.locator('div:has(> select) input[type=number]').first().fill('1000');
  await page.getByRole('button', { name: /Complete Sale/ }).click();
  await expect(page.getByText(/Select Customer/).first()).toBeVisible();
  await page.getByRole('button', { name: /Ahmed Khan/ }).click();
  await page.getByRole('button', { name: /Complete Sale/ }).click();
  await expect(page.getByRole('heading', { name: /Invoice INV-/ })).toBeVisible();
  const s = await state(page);
  expect(s.credits.at(-1).remainingAmount).toBe(3200 - 1000);
});

test('invoice designer offers six templates and saves a default', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/invoice-designer');
  for (const n of ['Classic Retail', 'Modern Minimal', 'Premium Business', 'Detailed Product Table', 'Compact Thermal', 'Professional A4']) {
    await expect(page.getByText(n, { exact: true }).first()).toBeVisible();
  }
  await page.getByText('Premium Business', { exact: true }).first().click();
  await page.getByRole('button', { name: /Save as default/ }).click();
  expect((await state(page)).settings.receiptTemplate).toBe('premium-business');
});

test('ZIP backup → restore preview → merge keeps data', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/backup');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Save$/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.dtbackup\.zip$/);
  const path = await dl.path();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Choose file/ }).click()]);
  await chooser.setFiles(path!);
  await expect(page.getByText('Checksum verified ✓')).toBeVisible();
  await page.getByRole('button', { name: /Merge/ }).click();
  await expect(page.getByText(/skipped \d+ duplicates/)).toBeVisible();
});

test('exports: CSV and Excel downloads', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/export');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByRole('button', { name: /^CSV$/ }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Save$/ }).click()]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole('button', { name: /^XLSX$/ }).click();
  const [xl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Save$/ }).click()]);
  expect(xl.suggestedFilename()).toMatch(/\.xlsx$/);
});

test('Urdu switches the layout to RTL', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: /Language/ }).click();
  await page.getByRole('button', { name: /اردو/ }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('ڈیش بورڈ').first()).toBeVisible();
});

test('day close keeps sales history', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/pos');
  await page.keyboard.type('NL-FS-001', { delay: 5 });
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Complete Sale/ }).click();
  await page.keyboard.press('Escape');
  await page.goto('/#/day-close');
  await page.getByPlaceholder('Count the drawer').fill('3200');
  await page.getByRole('button', { name: /Close Day/ }).click();
  await page.getByRole('button', { name: /^Close day$/ }).click();
  const s = await state(page);
  expect(s.sales.length).toBe(1);
  expect(s.dayClosings.length).toBe(1);
});
