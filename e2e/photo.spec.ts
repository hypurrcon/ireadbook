import { test, expect } from '@playwright/test';

test('add a book from real cover photos (barcode), works without the book APIs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // the book APIs are unreachable here, like being offline
  await page.route(/googleapis\.com|openlibrary\.org/, (r) => r.abort('internetdisconnected'));
  await page.addInitScript(() => localStorage.setItem('lang', 'th'));
  await page.goto('/#/welcome?step=ready');
  await page.getByRole('button', { name: 'ไปที่ชั้นหนังสือ' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/add');
  const inputs = page.locator('input[type=file]');
  await inputs.nth(0).setInputFiles('tests/fixtures/ants-front.png');
  await expect(page.getByText('ปรับมุมปกหน้า')).toBeVisible();
  await expect(page.locator('.corner-handle')).toHaveCount(4);
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await inputs.nth(2).setInputFiles('tests/fixtures/ants-back.png');
  await page.getByRole('button', { name: 'ดึงข้อมูลหนังสือ' }).click();
  await expect(page.getByText('ตรวจข้อมูล')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('ตอนนี้ออฟไลน์ แอปจะเติมข้อมูลให้เมื่อมีเน็ต')).toBeVisible();
  // no guessing from the cover text any more: the title stays empty instead of being wrong
  await expect(page.getByLabel('ชื่อเรื่อง')).toHaveValue('');
  await page.getByText('ข้อมูลเพิ่มเติม').click();
  await expect(page.getByLabel('ISBN')).toHaveValue('9786169433736');
  await page.getByLabel('ชื่อเรื่อง').fill('อาณาจักรมด');
  await page.getByRole('button', { name: 'บันทึกเข้าชั้น' }).click();
  await page.getByRole('button', { name: 'ดูหนังสือเล่มนี้' }).click();
  await expect(page.getByRole('heading', { name: 'อาณาจักรมด' })).toBeVisible();
  await expect(page.locator('.detail-cover img').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'ค้นข้อมูลอีกครั้ง' })).toBeVisible();
  expect(errors).toEqual([]);
});
