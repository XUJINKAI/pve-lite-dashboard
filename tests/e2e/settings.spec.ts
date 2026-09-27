import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openMockDashboard } from "./helpers";

test("saves browser settings and restores defaults with synthetic data", async ({ page }) => {
  await openMockDashboard(page);
  await page.locator("#settings-button").click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "常规" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("heading", { name: "电源操作" })).toBeVisible();
  await expect(dialog.getByLabel("数据来源")).toHaveValue("auto");
  await expect(dialog.getByLabel("同源 API 路径")).toHaveValue("/api/api2/json");
  await dialog.getByLabel("页面标题").fill("实验室面板");
  await dialog.getByRole("tab", { name: "资源" }).click();
  await expect(dialog.getByRole("heading", { name: "物理设备管理" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "虚拟机管理" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "刷新周期" })).toBeVisible();
  await expect(dialog.getByLabel("页面前台刷新间隔（秒）")).toHaveValue("5");
  await expect(dialog.getByLabel("页面后台刷新间隔（秒）")).toHaveValue("60");
  await dialog.getByLabel("页面前台刷新间隔（秒）").fill("12");
  await expect(dialog.getByRole("checkbox", { name: "模板" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "已停止实例" })).toBeChecked();
  await dialog.getByRole("checkbox", { name: "已停止实例" }).uncheck();
  await dialog.getByRole("checkbox", { name: "备份" }).uncheck();
  await dialog.getByRole("tab", { name: "显示" }).click();
  await expect(dialog.locator("#settings-panel-display h3")).toHaveText(["实例列表", "更新时间", "显示字段", "资源条"]);
  await dialog.getByRole("checkbox", { name: "网络", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "保存并刷新" }).click();

  await expect(page.locator("#app-title")).toHaveText("实验室面板 (demo)");
  await expect(page).toHaveTitle("实验室面板 (demo)");
  await expect(page.locator(".guest-card")).toHaveCount(5);
  await expect(page.locator("#infrastructure-content > .resource-block")).toHaveCount(4);
  await expect(page.locator(".guest-ip .ip-value")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("pve-lite-dashboard.preferences.v1") || "{}"));
  expect(saved.configOverrides).toEqual({ app: { title: "实验室面板", refreshInterval: 12 }, metrics: { network: false }, resources: { physical: { backups: false }, virtual: { stopped: false } } });

  await page.locator("#settings-button").click();
  await dialog.getByRole("tab", { name: "资源" }).click();
  await expect(dialog.getByLabel("页面前台刷新间隔（秒）")).toHaveValue("12");
  await dialog.getByRole("button", { name: "恢复默认配置" }).click();
  await expect(page.locator("#app-title")).toHaveText("PVE (demo)");
  await expect(page.locator(".guest-card")).toHaveCount(8);
  await expect(page.locator("#infrastructure-content > .resource-block")).toHaveCount(5);
  await expect(page.locator(".guest-ip .ip-value")).toHaveCount(8);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pve-lite-dashboard.preferences.v1") || "{}").configOverrides)).toEqual({});
});

test("imports a validated configuration from the settings text area", async ({ page }) => {
  await openMockDashboard(page);
  await page.locator("#settings-button").click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await dialog.getByRole("tab", { name: "导入 / 导出" }).click();
  const textArea = dialog.getByLabel("配置 JSON");
  const current = JSON.parse(await textArea.inputValue());
  expect(current.app.refreshInterval).toBe(5);
  expect(current.app.hiddenRefreshInterval).toBe(60);
  expect(current.vmStateDisplay.suspended.memoryColor).toBe("paused");
  await textArea.fill("{");
  await dialog.getByRole("button", { name: "导入并刷新" }).click();
  await expect(dialog.getByRole("alert")).toContainText("格式或结构不正确");
  await dialog.getByRole("button", { name: "刷新文本" }).click();
  expect(JSON.parse(await textArea.inputValue()).app.title).toBe("PVE");
  current.app.title = "导入测试";
  await textArea.fill(JSON.stringify(current));
  await dialog.getByRole("button", { name: "导入并刷新" }).click();
  await expect(page.locator("#app-title")).toHaveText("导入测试 (demo)");
  await expect(page).toHaveTitle("导入测试 (demo)");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pve-lite-dashboard.preferences.v1") || "{}").configOverrides)).toEqual({ app: { title: "导入测试" } });
});

test("applies both resource group switches and VMID exclusions", async ({ page }) => {
  await openMockDashboard(page);
  await page.locator("#settings-button").click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await dialog.getByRole("tab", { name: "资源" }).click();
  await dialog.getByRole("checkbox", { name: "显示物理设备" }).uncheck();
  await dialog.getByLabel("VMID 排除").fill("101-110");
  await dialog.getByRole("button", { name: "保存并刷新" }).click();
  await expect(page.locator("#infrastructure-section")).toBeHidden();
  await expect(page.locator(".guest-card")).toHaveCount(6);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pve-lite-dashboard.preferences.v1") || "{}").configOverrides.resources)).toEqual({
    physical: { show: false }, virtual: { excludeVmids: [[101, 110]] },
  });

  await page.locator("#settings-button").click();
  await dialog.getByRole("tab", { name: "资源" }).click();
  await dialog.getByRole("checkbox", { name: "显示虚拟机与容器" }).uncheck();
  await dialog.getByRole("button", { name: "保存并刷新" }).click();
  await expect(page.locator("#virtual-section")).toBeHidden();
  await expect(page.locator("#empty-state")).toBeHidden();
});

test("downloads all guest configurations and keeps browser settings in a separate section", async ({ page }) => {
  await openMockDashboard(page);
  await page.locator("#settings-button").click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await dialog.getByRole("tab", { name: "导入 / 导出" }).click();
  await expect(dialog.locator("#settings-panel-importExport h3")).toHaveText(["VM 配置导出", "浏览器配置"]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 720 : 900 });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect((await dialog.getByLabel("配置 JSON").boundingBox())!.height).toBeLessThanOrEqual(160);
    expect(await dialog.locator(".settings-body").evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await test.info().attach(`settings-export-${width}`, { body: await page.screenshot(), contentType: "image/png" });
  }
  const downloadPromise = page.waitForEvent("download");
  const button = dialog.getByRole("button", { name: "导出全部 VM 配置" });
  await button.click();
  await expect(button).toBeDisabled();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pve-vm-configs-.*\.txt$/);
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("Total: 8\nSucceeded: 8\nFailed: 0");
  for (const vmid of [101, 110, 201, 202, 203, 301, 302, 900]) expect(text).toMatch(new RegExp(`===== (QEMU|LXC) ${vmid} ·`));
  expect(text).toContain("scsi0: vm-data:vm-101-disk-0,size=32G");
  await expect(dialog.getByRole("status")).toHaveText("已导出 8 个实例的配置。");
  await expect(button).toBeEnabled();
  expect(JSON.parse(await dialog.getByLabel("配置 JSON").inputValue()).app.title).toBe("PVE");
});

test("exports fresh configurations including filtered guests and reports partial, empty and failed reads", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pve-lite-dashboard.preferences.v1", JSON.stringify({ configOverrides: { app: { refreshInterval: 0 }, resources: { virtual: { excludeVmids: [902] } } } })));
  let mode = "normal";
  let value = "initial";
  await page.route("**/api/api2/json/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/cluster/resources")) {
      await route.fulfill({ status: mode === "error" ? 503 : 200, json: mode === "error" ? { message: "sample resource outage" } : { data: mode === "empty" ? [] : [
        { type: "qemu", vmid: 901, name: "sample-running", node: "sample-node", status: "running" },
        { type: "qemu", vmid: 902, name: "sample-hidden", node: "sample-node", status: "stopped" },
        { type: "lxc", vmid: 903, name: "sample-template", node: "sample-node", status: "stopped", template: 1 },
      ] } });
      return;
    }
    if (path.endsWith("/config")) {
      await route.fulfill({ status: path.includes("/903/") ? 403 : 200, json: path.includes("/903/") ? { message: "sample config denied" } : { data: { net0: "virtio=02:00:00:00:00:01,bridge=vmbr0", description: value } } });
      return;
    }
    await route.fulfill({ json: { data: path.endsWith("/pools") ? [] : {} } });
  });
  await page.goto("/?data=live");
  await expect(page.locator(".guest-card")).toHaveCount(2);
  await page.locator("#settings-button").click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await dialog.getByRole("tab", { name: "导入 / 导出" }).click();
  value = "fresh export value";
  const downloadPromise = page.waitForEvent("download");
  const button = dialog.getByRole("button", { name: "导出全部 VM 配置" });
  await button.click();
  const text = await readFile((await (await downloadPromise).path())!, "utf8");
  expect(text).toContain("Total: 3\nSucceeded: 2\nFailed: 1");
  expect(text).toContain("QEMU 902 · sample-hidden");
  expect(text).toContain("LXC 903 · sample-template · sample-node · template");
  expect(text).toContain("[ERROR] sample config denied");
  expect(text).toContain("description: fresh export value");
  expect(text).toContain("net0: virtio=02:00:00:00:00:01,bridge=vmbr0");
  await expect(dialog.getByRole("status")).toContainText("1 个读取失败");
  mode = "empty";
  await button.click();
  await expect(dialog.getByRole("status")).toHaveText("当前没有可导出的实例。");
  mode = "error";
  await button.click();
  await expect(dialog.getByRole("alert")).toContainText("sample resource outage");
  await expect(button).toBeEnabled();
});
