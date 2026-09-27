import { expect, type Page } from "@playwright/test";

export async function freezeClock(page: Page) {
  await page.addInitScript(() => {
    const fixedNow = 1_735_689_600_000;
    Date.now = () => fixedNow;
  });
}

export async function openMockDashboard(page: Page) {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?data=mock");
  await expect(page.locator("#connection-text")).toHaveText("已连接 (demo)");
  await expect(page.locator(".guest-card")).toHaveCount(8);
  await expect(page.locator(".disk-summary").first()).toContainText("41 °C");
  await expect(page.locator(".network-row").first()).toBeVisible();
  await page.waitForFunction(() => {
    const ips = [...document.querySelectorAll(".guest-card .ip-value")];
    return ips.length === 8 && ips.every((element) => !element.textContent?.includes("读取中"));
  });
}
