import { test, expect, type Page } from '@playwright/test';

const errors: string[] = [];
function watch(page: Page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/vibrate|Failed to load resource/.test(m.text())) errors.push(m.text()); });
}

test('first run → add Thai books → read → stats → backup → restore → English', async ({ page }) => {
  watch(page);
  await page.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.setItem('lang', 'th'); sessionStorage.setItem('init', '1'); } });
  await page.goto('/');
  await expect(page).toHaveURL(/#\/welcome/);
  await expect(page.getByText('อ่านหนังสือเล่มจริงที่คุณมี ทีละนิด ทุกวัน')).toBeVisible();
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByRole('button', { name: /ห้องเช่าเมืองนีออน/ }).click();
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  // first book typed by hand
  await page.getByPlaceholder('ชื่อหนังสือ').fill('อาณาจักรมด');
  await page.getByPlaceholder('จำนวนหน้า').fill('120');
  await page.getByRole('button', { name: 'เพิ่มเล่มนี้' }).click();
  await page.getByRole('button', { name: '10 นาที' }).click();
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByRole('button', { name: 'ไปที่ชั้นหนังสือ' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('อาณาจักรมด').first()).toBeVisible();

  // second book: manual entry
  await page.getByRole('link', { name: 'เพิ่ม' }).click();
  await page.getByRole('button', { name: 'ค้นหาหรือพิมพ์เอง' }).click();
  await page.getByRole('button', { name: 'กรอกข้อมูลเอง' }).click();
  await page.getByLabel('ชื่อเรื่อง').fill('ดาบพิฆาตอสูร เล่ม 1');
  await page.getByLabel('ผู้แต่ง').fill('Koyoharu Gotouge');
  await page.getByLabel('จำนวนหน้า').fill('190');
  await page.getByRole('button', { name: 'บันทึกเข้าชั้น' }).click();
  await expect(page.getByText('วางเข้าชั้นแล้ว')).toBeVisible();
  await page.getByRole('button', { name: 'ไปที่ชั้นหนังสือ' }).click();

  // read: start timer, finish, set page
  await page.getByRole('link', { name: 'อ่าน' }).click();
  await page.getByRole('button', { name: 'เริ่มจับเวลา' }).click();
  await expect(page).toHaveURL(/#\/read\/session/);
  // pretend 12 minutes passed
  await page.evaluate(() => { const k = 'ireadbook-timer'; const v = JSON.parse(localStorage.getItem(k)!); v.state.active.startedAt -= 12 * 60000; localStorage.setItem(k, JSON.stringify(v)); });
  await page.reload();
  await page.getByRole('button', { name: 'จบรอบ' }).click();
  await page.getByRole('textbox', { name: 'อ่านถึงหน้า' }).fill('25');
  await page.getByRole('button', { name: 'สนุก' }).click();
  await page.getByRole('button', { name: 'บันทึก' }).click();
  await expect(page.locator('.result-xp')).toContainText('+12');
  await expect(page.getByText('วันนี้อ่านครบเป้าแล้ว')).toBeVisible();
  await page.getByRole('button', { name: 'เสร็จ' }).click();

  // stats
  await page.getByRole('link', { name: 'สถิติ' }).click();
  await expect(page.getByText('หน้าแรก').first()).toBeVisible(); // achievement "Page one"
  await expect(page.locator('.tile-streak .tile-v')).toContainText('1');

  // backup → wipe → restore
  await page.goto('/#/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ส่งออกไฟล์สำรอง' }).click()]);
  const path = await dl.path();
  expect(dl.suggestedFilename()).toMatch(/\.ireadbook$/);
  await page.getByRole('button', { name: 'ลบข้อมูลทั้งหมดในเครื่องนี้' }).click();
  await page.getByRole('button', { name: 'ลบทั้งหมด' }).click();
  await expect(page).toHaveURL(/#\/welcome/);
  // new device: restore from the first onboarding screen
  await page.locator('input[type=file]').setInputFiles(path!);
  await expect(page.getByText(/นำเข้าแล้ว: 2 เล่ม, 1 รอบที่อ่าน/)).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await page.getByRole('link', { name: 'อ่าน' }).click();
  await expect(page.getByText('ดาบพิฆาตอสูร เล่ม 1').or(page.getByText('อาณาจักรมด')).first()).toBeVisible();

  // English
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'English' }).click();
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();

  expect(errors).toEqual([]);
});
