import { expect, test } from "@playwright/test";
import { openMockDashboard } from "./helpers";

test("dashboard mock visual baseline", async ({ page }) => {
  await openMockDashboard(page);
  await expect(page.locator("#virtual-section")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-mock.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});

test("dashboard mobile mock visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMockDashboard(page);
  await expect(page.locator("#virtual-section")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-mock-mobile.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});
