import { test, expect } from '@playwright/test';

const ROOMS = ['ห้องใต้หลังคาวันฝนตก', 'ห้องเช่าเมืองนีออน', 'ห้องสมุดเก่า', 'บ้านญี่ปุ่น', 'บ้านต้นไม้', 'สถานีอวกาศ', 'หอคอยพ่อมด', 'ตู้นอนรถไฟกลางคืน', 'ห้องใต้ทะเล', 'คาเฟ่มุมถนน', 'สตูดิโอมินิมอล'];

test('every room renders the shelf without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('lang', 'th'));
  await page.goto('/#/welcome?step=book');
  for (const t of ['อาณาจักรมด', 'Dune', 'เจ้าชายน้อย']) {
    await page.getByPlaceholder('ชื่อหนังสือ').fill(t);
    await page.getByRole('button', { name: 'เพิ่มเล่มนี้' }).click();
    await expect(page.getByText('อยากอ่านวันละเท่าไร')).toBeVisible();
    await page.getByRole('button', { name: 'กลับ' }).click();
  }
  await page.goto('/#/welcome?step=ready');
  await page.getByRole('button', { name: 'ไปที่ชั้นหนังสือ' }).click();
  await expect(page).toHaveURL(/#\/$/);
  for (const [i, name] of ROOMS.entries()) {
    await page.goto('/#/settings');
    await page.getByRole('button', { name: new RegExp(name) }).first().click();
    await page.goto('/#/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `test-results/room-${i}.png` });
  }
  expect(errors).toEqual([]);
});
