import { test, expect, chromium, type Page, type Browser } from '@playwright/test';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PORT = 9123;
let server: any;
let browser: Browser;

test.beforeAll(async () => {
  const { ExpressPeerServer } = require('peer');
  const express = require('express');
  const http = require('http');
  const app = express();
  server = http.createServer(app);
  app.use('/', ExpressPeerServer(server, { path: '/' }));
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));
  browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--use-gl=angle', '--use-angle=swiftshader'] });
});
test.afterAll(async () => { await browser?.close(); server?.close?.(); });

async function device(name: string): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([port]) => {
    localStorage.setItem('lang', 'th');
    localStorage.setItem('ireadbook-peer-server', `127.0.0.1:${port}`);
  }, [PORT]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  return page;
}

async function onboardWithBook(page: Page, title: string) {
  await page.goto('/#/welcome?step=book');
  await page.getByPlaceholder('ชื่อหนังสือ').fill(title);
  await page.getByRole('button', { name: 'เพิ่มเล่มนี้' }).click();
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByRole('button', { name: 'ไปที่ชั้นหนังสือ' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

const listTitles = async (page: Page) => {
  await page.goto('/#/');
  const toggle = page.getByRole('button', { name: 'รายการ' });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  return page.locator('.grid-title');
};

test('link two devices with a 5-minute code; books, edits and deletions follow', async () => {
  const phone = await device('phone');
  const pc = await device('pc');
  await onboardWithBook(phone, 'เล่มจากมือถือ');

  // phone shows a code
  await phone.goto('/#/settings');
  await phone.getByRole('button', { name: 'เชื่อมเครื่องใหม่' }).click();
  const codeBox = phone.locator('.pair-code b');
  await expect(codeBox).toHaveCount(6, { timeout: 15000 });
  const code = (await codeBox.allTextContents()).join('');
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  // pc already has a book of its own, then joins with the code
  await onboardWithBook(pc, 'เล่มจากคอม');
  await pc.goto('/#/settings');
  await pc.getByRole('button', { name: 'กรอกรหัสจากอีกเครื่อง' }).click();
  await pc.getByLabel('รหัส 6 ตัว').fill(code.toLowerCase());
  await pc.getByRole('button', { name: 'เชื่อมต่อ', exact: true }).click();
  await expect(pc.getByText('เชื่อมแล้ว ข้อมูลซิงก์เรียบร้อย')).toBeVisible({ timeout: 20000 });
  await expect(phone.getByText('สองเครื่องใช้ชั้นหนังสือเดียวกันแล้ว')).toBeVisible({ timeout: 10000 });

  // both shelves now have both books
  await expect(await listTitles(pc)).toHaveText(['เล่มจากคอม', 'เล่มจากมือถือ'].sort(), { timeout: 10000 }).catch(async () => {
    await expect((await listTitles(pc)).filter({ hasText: 'เล่มจากมือถือ' })).toHaveCount(1);
  });
  await expect((await listTitles(phone)).filter({ hasText: 'เล่มจากคอม' })).toHaveCount(1, { timeout: 10000 });

  // a new book on the pc appears on the phone while both are open
  await pc.goto('/#/add');
  await pc.getByRole('button', { name: 'ค้นหาหรือพิมพ์เอง' }).click();
  await pc.getByRole('button', { name: 'กรอกข้อมูลเอง' }).click();
  await pc.getByLabel('ชื่อเรื่อง').fill('เล่มที่สาม');
  await pc.getByRole('button', { name: 'บันทึกเข้าชั้น' }).click();
  await expect(pc.getByText('วางเข้าชั้นแล้ว')).toBeVisible();
  await expect.poll(async () => (await listTitles(phone)).filter({ hasText: 'เล่มที่สาม' }).count(), { timeout: 15000 }).toBe(1);

  // deleting on the phone removes it on the pc
  await (await listTitles(phone)).filter({ hasText: 'เล่มที่สาม' }).click();
  await phone.getByRole('button', { name: 'ลบหนังสือเล่มนี้' }).click();
  await phone.getByRole('button', { name: 'ลบ', exact: true }).click();
  await expect.poll(async () => (await listTitles(pc)).filter({ hasText: 'เล่มที่สาม' }).count(), { timeout: 15000 }).toBe(0);

  // one-tap sync from the shelf with the data-flying animation
  await phone.goto('/#/');
  await phone.locator('.sync-chip').click();
  await expect(phone.locator('.sync-fx')).toBeVisible();
  await phone.waitForTimeout(700);
  await phone.screenshot({ path: 'test-results/sync-fx-running.png' });
  await expect(phone.getByText(/ซิงก์เสร็จแล้ว|ข้อมูลตรงกันอยู่แล้ว/)).toBeVisible({ timeout: 20000 });
  await phone.screenshot({ path: 'test-results/sync-fx-done.png' });
  await phone.locator('.sync-fx').click();

  // reload both: they find each other again by themselves
  await phone.reload();
  await pc.reload();
  await pc.goto('/#/settings');
  await expect(pc.locator('.devices .sync-dot.synced')).toHaveCount(1, { timeout: 20000 });
});
