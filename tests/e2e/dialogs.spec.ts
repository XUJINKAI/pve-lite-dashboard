import { expect, test } from "@playwright/test";
import { openMockDashboard } from "./helpers";

test("shows the permission matrix at a readable width", async ({ page }) => {
  await openMockDashboard(page);
  await page.locator("#permissions-button").click();
  const dialog = page.locator("#permissions-dialog");
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())?.width).toBeGreaterThan(1000);
  await page.setViewportSize({ width: 375, height: 800 });
  expect((await dialog.boundingBox())?.width).toBeLessThanOrEqual(347);
});

test("keeps page position fixed while any dashboard dialog is open", async ({ page }) => {
  await openMockDashboard(page);
  await page.evaluate(() => {
    document.body.style.minHeight = "3500px";
    window.scrollTo(0, 400);
  });
  const dialogs = page.locator("dialog");
  await expect(dialogs).toHaveCount(5);
  for (const dialog of await dialogs.all()) {
    await dialog.evaluate((element: HTMLDialogElement) => element.showModal());
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(4, 4);
    await page.mouse.wheel(0, 500);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await dialog.evaluate((element: HTMLDialogElement) => element.close());
  }
  await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
});

test("shows complete raw guest configuration with loading, refresh and read errors", async ({ page }) => {
  let fail = false;
  let address = "02:00:00:00:00:01";
  const rawConfig = () => ({ name: "sample-config", net0: `virtio=${address},bridge=vmbr0,firewall=1`, scsi0: "sample-store:vm-901-disk-0,size=64G,discard=on", cores: 4, agent: "1", onboot: 1, description: "<script>sample text</script>\n" + "Sample description ".repeat(30) });
  await page.route("**/api/api2/json/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/config")) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ status: fail ? 403 : 200, json: fail ? { message: "sample config denied" } : { data: rawConfig() } });
      return;
    }
    const data = path.endsWith("/cluster/resources") ? [{ type: "qemu", vmid: 901, node: "sample-node", name: "sample-config", status: "running" }]
      : path.endsWith("/pools") ? [] : {};
    await route.fulfill({ json: { data } });
  });
  await page.goto("/?data=live");
  await page.locator(".guest-summary").click();
  await page.getByRole("button", { name: "全部配置", exact: true }).click();
  const dialog = page.locator("#guest-config-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("读取中");
  for (const [key, value] of Object.entries(rawConfig())) await expect(dialog.locator(".config-text")).toContainText(`${key}: ${value}`);
  await expect(dialog.locator("script")).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(width - 28);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await test.info().attach(`guest-config-${width}`, { body: await page.screenshot(), contentType: "image/png" });
  }
  address = "02:00:00:00:00:02";
  await dialog.getByRole("button", { name: "立即刷新" }).click();
  await expect(dialog.locator(".config-text")).toContainText(`net0: virtio=${address},bridge=vmbr0,firewall=1`);
  fail = true;
  await dialog.getByRole("button", { name: "立即刷新" }).click();
  await expect(dialog.getByRole("status")).toContainText("sample config denied");
  fail = false;
  await dialog.getByRole("button", { name: "立即刷新" }).click();
  await expect(dialog.locator(".config-text")).toContainText("scsi0: sample-store:vm-901-disk-0,size=64G,discard=on");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "全部配置", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).not.toBeVisible();
});
