import { expect, test, type Locator } from "@playwright/test";
import { openMockDashboard } from "./helpers";

async function disclosureDirection(button: Locator) {
  return button.locator(".disclosure-icon").evaluate((icon) => getComputedStyle(icon, "::before").transform);
}

async function followsShortestColumn(page: import("@playwright/test").Page) {
  return page.locator("#infrastructure-content").evaluate((root) => {
    const blocks = [...root.querySelectorAll<HTMLElement>(":scope > .resource-block")];
    const count = window.innerWidth <= 900 ? 1 : window.innerWidth <= 1100 ? 2 : 3;
    const heights = Array<number>(count).fill(0);
    const width = (root.clientWidth - 10 * (count - 1)) / count;
    const origin = root.getBoundingClientRect();
    for (const block of blocks) {
      const column = heights.indexOf(Math.min(...heights));
      const bounds = block.getBoundingClientRect();
      if (Math.abs(bounds.left - origin.left - column * (width + 10)) > 1
        || Math.abs(bounds.top - origin.top - heights[column]) > 1) return false;
      if (Math.abs(parseFloat(block.style.left) - column * (width + 10)) > 1
        || Math.abs(parseFloat(block.style.top) - heights[column]) > 1) return false;
      heights[column] += block.getBoundingClientRect().height + 10;
    }
    return Math.abs(root.getBoundingClientRect().height - (Math.max(0, ...heights) - 10)) <= 1;
  });
}

test("places physical resource blocks in the shortest available column", async ({ page }) => {
  await openMockDashboard(page);
  await expect.poll(() => followsShortestColumn(page)).toBe(true);
  await page.locator("#infrastructure-content > .resource-block").first().locator(".block-title").click();
  await expect.poll(() => followsShortestColumn(page)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => followsShortestColumn(page)).toBe(true);
});

test("shows compact physical summaries with room for capacity and network addresses", async ({ page }) => {
  await openMockDashboard(page);
  const blocks = page.locator("#infrastructure-content > .resource-block");
  const backups = blocks.filter({ has: page.getByRole("heading", { name: "备份", exact: true }) });
  const networks = blocks.filter({ has: page.getByRole("heading", { name: "网络", exact: true }) });
  await expect(page.locator(".node-card .compact-title").first()).toContainText("运行 21天");
  await expect(networks.locator(".count-pill")).toHaveText("3/3");
  await expect(backups.locator(".backup-summary .detail-item")).toHaveCount(1);
  await expect(backups.locator(".backup-summary .detail-item small")).toHaveText("最近备份时间");
  await expect(backups.locator(".backup-summary .detail-item strong")).not.toHaveText("暂无记录");
  await expect(backups.locator(".block-meta-date")).toHaveText(await backups.locator(".backup-summary .detail-item strong").innerText());
  const storageName = await page.locator(".storage-summary .compact-title").first().boundingBox();
  const storageMetric = await page.locator(".storage-summary .metric").first().boundingBox();
  expect(storageName && storageMetric).toBeTruthy();
  expect(storageMetric!.width).toBeGreaterThan(storageName!.width * 1.5);
  const networkName = await networks.locator(".network-row strong").first().boundingBox();
  const networkAddress = await networks.locator(".network-row .network-address").first().boundingBox();
  expect(networkName && networkAddress).toBeTruthy();
  expect(networkAddress!.width).toBeGreaterThan(networkName!.width);
});

test("uses one disclosure direction across resource levels", async ({ page }) => {
  await openMockDashboard(page);
  const infrastructure = page.locator("#infrastructure-toggle");
  const nodesBlock = page.locator(".resource-block").first().locator(".block-title");
  const node = page.locator(".node-toggle").first();
  const storage = page.locator(".storage-summary").first();
  const guest = page.locator(".guest-summary").first();
  const backupBlock = page.locator(".resource-block").filter({ has: page.getByRole("heading", { name: "备份", exact: true }) }).locator(".block-title");
  const openDirection = await disclosureDirection(infrastructure);
  const closedDirection = await disclosureDirection(node);

  expect(openDirection).not.toBe(closedDirection);
  expect(await disclosureDirection(nodesBlock)).toBe(openDirection);
  expect(await disclosureDirection(storage)).toBe(closedDirection);
  expect(await disclosureDirection(guest)).toBe(closedDirection);
  expect(await disclosureDirection(backupBlock)).toBe(openDirection);

  await infrastructure.click();
  await expect.poll(() => disclosureDirection(infrastructure)).toBe(closedDirection);
  await infrastructure.click();
  await expect.poll(() => disclosureDirection(infrastructure)).toBe(openDirection);
  await nodesBlock.click();
  await expect.poll(() => disclosureDirection(nodesBlock)).toBe(closedDirection);
  await nodesBlock.click();
  await expect.poll(() => disclosureDirection(nodesBlock)).toBe(openDirection);
  for (const row of [node, storage, guest]) {
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => disclosureDirection(row)).toBe(openDirection);
  }
  await backupBlock.click();
  await expect.poll(() => disclosureDirection(backupBlock)).toBe(closedDirection);
  await backupBlock.click();
  await expect.poll(() => disclosureDirection(backupBlock)).toBe(openDirection);
});

test("limits section toggles to heading text and meta controls", async ({ page }) => {
  await openMockDashboard(page);
  const headings = [
    { title: page.locator("#infrastructure-title-toggle"), meta: page.locator("#infrastructure-toggle") },
    { title: page.locator("#virtual-title-toggle"), meta: page.locator("#virtual-toggle") },
  ];
  for (const { title, meta } of headings) {
    await expect(meta).toHaveAttribute("aria-expanded", "true");
    await title.click();
    await expect(meta).toHaveAttribute("aria-expanded", "false");
    await meta.click();
    await expect(title).toHaveAttribute("aria-expanded", "true");
    const titleBox = await title.boundingBox();
    const metaBox = await meta.boundingBox();
    expect(titleBox && metaBox).toBeTruthy();
    const gap = metaBox!.x - titleBox!.x - titleBox!.width;
    expect(gap).toBeGreaterThan(20);
    await page.mouse.click(titleBox!.x + titleBox!.width + gap / 2, titleBox!.y + titleBox!.height / 2);
    await expect(meta).toHaveAttribute("aria-expanded", "true");
  }
});

test("toggles resource pools from the whole heading and keyboard", async ({ page }) => {
  await openMockDashboard(page);
  const pool = page.locator(".pool-section").first();
  const heading = pool.locator(".pool-heading");
  const title = await heading.locator(".pool-title").boundingBox();
  const meta = await heading.locator(".pool-heading-meta").boundingBox();
  expect(title && meta).toBeTruthy();
  const gap = meta!.x - title!.x - title!.width;
  expect(gap).toBeGreaterThan(20);
  await page.mouse.click(title!.x + title!.width + gap / 2, title!.y + title!.height / 2);
  await expect(heading).toHaveAttribute("aria-expanded", "false");
  await expect(pool.locator(".guest-list")).toBeHidden();
  await heading.press("Enter");
  await expect(heading).toHaveAttribute("aria-expanded", "true");
  await expect(pool.locator(".guest-list")).toBeVisible();
  await heading.press("Space");
  await expect(heading).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(heading).toHaveAttribute("aria-expanded", "false");
  await heading.click();
  await expect(pool.locator(".guest-list")).toBeVisible();
});

test("aligns paused and running guest memory columns", async ({ page }) => {
  await openMockDashboard(page);
  const running = page.locator(".guest-card").filter({ hasText: "dev-linux" }).locator(".mini-metric").last();
  const paused = page.locator(".guest-card").filter({ hasText: "windows-lab" }).locator(".mini-metric");
  const runningBox = await running.boundingBox();
  const pausedBox = await paused.boundingBox();
  expect(runningBox && pausedBox).toBeTruthy();
  expect(Math.abs(runningBox!.x - pausedBox!.x)).toBeLessThanOrEqual(1);
});

test("keeps guest resource values readable on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openMockDashboard(page);

  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await page.locator(".guest-card .mini-metric").evaluateAll((metrics) => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      rows: metrics.map((metric) => {
        const value = metric.querySelector(".mini-head strong")!;
        const heading = metric.querySelector(".mini-head")!;
        const label = metric.querySelector(".metric-label")!;
        const bar = metric.querySelector(".progress")!;
        return {
          label: (label as HTMLElement).innerText,
          labelY: label.getBoundingClientRect().y,
          valueY: value.getBoundingClientRect().y,
          valueWidth: value.scrollWidth,
          visibleWidth: value.clientWidth,
          valueOverflow: getComputedStyle(value).textOverflow,
          headingHeight: heading.getBoundingClientRect().height,
          headingBottom: heading.getBoundingClientRect().bottom,
          barTop: bar.getBoundingClientRect().top,
        };
      }),
    }));
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    for (const row of layout.rows) {
      expect(row.barTop).toBeGreaterThan(row.headingBottom);
      if (width <= 720) {
        expect(row.headingHeight).toBeLessThan(20);
        expect(Math.abs(row.valueY - row.labelY)).toBeLessThan(1);
        if (row.valueWidth > row.visibleWidth) expect(row.valueOverflow).toBe("ellipsis");
      } else {
        expect(row.valueWidth).toBeLessThanOrEqual(row.visibleWidth);
      }
    }
    if (width <= 720) expect(layout.rows[1].label).toBe("内存");
    if (width <= 720) {
      const running = page.locator(".guest-card").filter({ hasText: "dev-linux" });
      const cpu = await running.locator(".guest-cpu").boundingBox();
      const memory = await running.locator(".guest-memory").boundingBox();
      const pausedMemory = await page.locator(".guest-card").filter({ hasText: "windows-lab" }).locator(".guest-memory").boundingBox();
      expect(cpu && memory && pausedMemory).toBeTruthy();
      expect(memory!.x).toBeGreaterThan(cpu!.x + cpu!.width);
      expect(Math.abs(memory!.y - cpu!.y)).toBeLessThan(1);
      expect(Math.abs(pausedMemory!.x - memory!.x)).toBeLessThan(1);
    }
  }
  await expect(page.locator(".guest-card").filter({ hasText: "windows-lab" }).locator(".guest-resource-placeholder")).toBeHidden();
});

test("places mobile tools and infrastructure summaries in compact rows", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openMockDashboard(page);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
      };
      return {
        pageWidth: document.documentElement.scrollWidth,
        titleFits: document.querySelector("#app-title")!.scrollWidth <= document.querySelector("#app-title")!.clientWidth,
        brand: box(".brand"),
        buttons: [...document.querySelectorAll(".header-tools button")].map((button) => {
          const rect = button.getBoundingClientRect();
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
        }),
        connection: box(".connection"),
        storageName: box(".storage-summary .compact-title"),
        storageMetric: box(".storage-summary .metric"),
        networkName: box(".network-row strong"),
        networkAddress: box(".network-row .network-address"),
        networkStatus: box(".network-row .badge"),
        networkType: box(".network-row .network-type"),
        networkContext: box(".network-row .network-context"),
      };
    });

    expect(layout.pageWidth).toBeLessThanOrEqual(width);
    expect(layout.titleFits).toBe(true);
    expect(layout.buttons).toHaveLength(4);
    expect(layout.buttons[0].x).toBeGreaterThan(layout.brand.right);
    expect(layout.buttons.every((button) => button.y === layout.buttons[0].y)).toBe(true);
    expect(layout.connection.y).toBeGreaterThanOrEqual(layout.buttons[0].bottom);
    expect(layout.storageMetric.x).toBeGreaterThan(layout.storageName.right);
    expect(Math.abs(layout.storageName.y - layout.storageMetric.y)).toBeLessThan(5);
    expect(layout.networkAddress.y).toBe(layout.networkName.y);
    expect(layout.networkStatus.y).toBe(layout.networkName.y);
    expect(layout.networkType.y).toBe(layout.networkContext.y);
    expect(layout.networkType.y).toBeGreaterThan(layout.networkName.y);
  }
});

test("shows mobile disks in two rows and places guest identity beside status and one IP", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openMockDashboard(page);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, height: rect.height };
      };
      return {
        pageWidth: document.documentElement.scrollWidth,
        diskName: box(".disk-summary strong"),
        diskType: box(".disk-summary .disk-size"),
        diskLife: box(".disk-summary .disk-life"),
        diskNode: box(".disk-summary .disk-temperature"),
        guestId: box(".guest-card .guest-vmid"),
        guestName: box(".guest-card .guest-identity strong"),
        guestStatus: box(".guest-card .guest-secondary .badge"),
        guestIp: box(".guest-card .guest-ip-cell"),
      };
    });
    expect(layout.pageWidth).toBeLessThanOrEqual(width);
    expect(layout.diskType.y).toBe(layout.diskLife.y);
    expect(layout.diskLife.y).toBe(layout.diskNode.y);
    expect(layout.diskType.y).toBeGreaterThan(layout.diskName.y);
    expect(layout.diskType.x).toBeLessThan(layout.diskLife.x);
    expect(layout.diskLife.x).toBeLessThan(layout.diskNode.x);
    expect(layout.guestId.y).toBe(layout.guestName.y);
    expect(layout.guestId.x).toBeLessThan(layout.guestName.x);
    expect(layout.guestStatus.y).toBe(layout.guestName.y);
    expect(layout.guestId.height).toBe(layout.guestName.height);
    expect(layout.guestStatus.height).toBe(layout.guestName.height);
    expect(layout.guestIp.y).toBe(layout.guestName.y);
    expect(layout.guestIp.right).toBeLessThan(layout.guestStatus.x);
    expect(layout.guestStatus.x).toBeGreaterThan(layout.guestName.x);
    await expect(page.locator(".guest-card").first().locator(".guest-summary > .disclosure-icon")).toBeHidden();
    await expect(page.locator(".guest-card").first().locator(".mobile-ip-addresses")).toHaveText("10.10.0.201");
    await expect(page.locator(".guest-card").first().locator(".desktop-ip-addresses")).toBeHidden();

    const multiIpGuest = page.locator(".guest-card").filter({ hasText: "dev-linux" });
    const singleIpGuest = page.locator(".guest-card").filter({ hasText: "windows-lab" });
    const ip = await multiIpGuest.locator(".mobile-ip-addresses").boundingBox();
    const more = await multiIpGuest.locator(".ip-more").boundingBox();
    const singleIp = await singleIpGuest.locator(".mobile-ip-addresses").boundingBox();
    expect(ip && more && singleIp).toBeTruthy();
    expect(Math.abs(ip!.y + ip!.height / 2 - more!.y - more!.height / 2)).toBeLessThan(1);
    expect(Math.abs(singleIp!.x + singleIp!.width - more!.x - more!.width)).toBeLessThan(1);
    const metricColors = await multiIpGuest.locator(".guest-metrics .mini-head").evaluateAll((heads) => heads.map((head) => ({
      label: getComputedStyle(head.querySelector(".metric-label")!).color,
      value: getComputedStyle(head.querySelector("strong")!).color,
    })));
    expect(metricColors.every(({ label, value }) => label === value)).toBe(true);
  }

  await page.locator(".guest-card").first().locator(".ip-stack").click();
  await expect(page.locator("dialog[open] .ip-row")).toHaveText(["10.10.0.201", "10.20.0.201", "2001:db8::201"]);
});

test("loads deterministic mock data and supports guest expansion", async ({ page }) => {
  await openMockDashboard(page);

  await expect(page.locator("#connection-text")).toHaveText("已连接 (demo)");
  await expect(page.locator("#app-title")).toHaveText("PVE (demo)");
  await expect(page).toHaveTitle("PVE (demo)");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /brand-mark.*\.svg/);
  const iconUrl = await page.locator('link[rel="icon"]').getAttribute("href");
  const brandUrl = await page.locator("img.brand-mark").getAttribute("src");
  expect(new URL(brandUrl!, page.url()).href).toBe(new URL(iconUrl!, page.url()).href);
  expect(await page.locator("img.brand-mark").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect((await page.request.get(new URL(iconUrl!, page.url()).toString())).ok()).toBe(true);
  await expect(page.locator(".guest-card")).toHaveCount(8);
  await expect(page.locator("#virtual-meta")).toContainText("8");

  const firstGuest = page.locator(".guest-card").first();
  await expect(firstGuest.locator(".identity-copy small")).toHaveCount(0);
  await expect(firstGuest.locator(".guest-summary")).not.toContainText("QEMU");
  await expect(firstGuest.locator(".guest-summary")).not.toContainText("demo-pve");
  await expect(firstGuest.locator(".guest-memory .metric-label")).toHaveText("内存");
  const collapsedBackground = await firstGuest.evaluate((element) => getComputedStyle(element).backgroundColor);
  const summaryBackground = await firstGuest.locator(".guest-summary").evaluate((element) => getComputedStyle(element).backgroundColor);
  await firstGuest.locator(".guest-summary").hover();
  await expect(firstGuest.locator(".guest-summary")).toHaveCSS("background-color", summaryBackground);
  const ipWidth = await firstGuest.locator(".guest-ip-cell").evaluate((element) => element.getBoundingClientRect().width);
  const cpuWidth = await firstGuest.locator(".mini-metric").first().evaluate((element) => element.getBoundingClientRect().width);
  const memoryWidth = await firstGuest.locator(".mini-metric").last().evaluate((element) => element.getBoundingClientRect().width);
  expect(ipWidth).toBeLessThan(cpuWidth);
  expect(memoryWidth).toBeGreaterThan(cpuWidth);
  await firstGuest.locator(".guest-summary").click();
  await expect(firstGuest).toHaveClass(/expanded/);
  await expect(firstGuest.locator(".guest-summary")).toHaveCSS("background-color", summaryBackground);
  await expect(firstGuest.locator(".guest-details")).toBeVisible();
  await expect(firstGuest.locator(".detail-info .detail-item small")).toHaveText(["类型", "节点", "运行时间", "磁盘用量", "磁盘读写", "网络流量", "实际宿主内存"]);

  await expect(firstGuest.locator(".detail-item").filter({ hasText: "运行时间" }).locator("strong")).toHaveText("6天 0时");
  await expect(firstGuest.locator(".detail-item").filter({ hasText: "磁盘用量" }).locator("strong")).toHaveText("48.38 / 115.20 GB");
  await expect(firstGuest.locator(".detail-info .detail-item strong").nth(0)).toHaveText("QEMU");
  await expect(firstGuest.locator(".detail-info .detail-item strong").nth(1)).toHaveText("demo-pve");
  await expect(firstGuest).toHaveCSS("background-color", collapsedBackground);
  await expect(firstGuest.locator(".guest-details")).toHaveCSS("background-color", collapsedBackground);

  await page.locator("#language-button").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#connection-text")).toHaveText("Connected (demo)");
});

test("loads fallback disk capacity when guest expansion is restored after reload", async ({ page }) => {
  await openMockDashboard(page);
  const guest = page.locator(".guest-card").filter({ hasText: "windows-lab" });
  const summary = guest.locator(".guest-summary");
  const disk = guest.locator(".detail-info .detail-item").filter({ hasText: "磁盘容量" }).locator("strong");
  await summary.click();
  await expect(disk).toHaveText("scsi0 128 GB");

  await page.reload();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(disk).toHaveText("scsi0 128 GB");
  await page.locator("#refresh-button").click();
  await expect(disk).toHaveText("scsi0 128 GB");
});

test("opens the complete IP list from the address stack", async ({ page }) => {
  await openMockDashboard(page);
  const guest = page.locator(".guest-card").filter({ hasText: "dev-linux" });
  const ipValue = guest.locator(".ip-value");

  await expect(ipValue.locator(".desktop-ip-addresses")).toHaveText("10.10.0.201, 10.20.0.201");
  await expect(ipValue.locator(".ip-more")).toHaveText("...");
  await ipValue.locator(".desktop-ip-addresses").click();
  await expect(page.locator("dialog[open] .ip-row")).toHaveText(["10.10.0.201", "10.20.0.201", "2001:db8::201"]);
});

test("refreshes configured IPs for stopped, paused, and template guests", async ({ page }) => {
  const addresses = new Map([["901", "10.90.0.1"], ["902", "10.90.0.2"], ["903", "10.90.0.3"]]);
  const configReads = new Map<string, number>();
  await page.route("**/api/api2/json/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/api2/json", "");
    const match = path.match(/\/(qemu|lxc)\/(901|902|903)\/config$/);
    if (match) {
      const id = match[2];
      configReads.set(id, (configReads.get(id) || 0) + 1);
      const address = addresses.get(id);
      const data = match[1] === "lxc" ? { net0: `name=eth0,bridge=vmbr0,ip=${address}/24` } : { ipconfig0: `ip=${address}/24` };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
      return;
    }
    if (path.includes("/agent/network-get-interfaces") || path.endsWith("/interfaces")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "guest offline" }) });
      return;
    }
    const data = path === "/cluster/resources" ? [
      { type: "qemu", id: "qemu/901", vmid: 901, node: "fictional-node-a", name: "sample-stopped", status: "stopped" },
      { type: "qemu", id: "qemu/902", vmid: 902, node: "fictional-node-a", name: "sample-paused", status: "paused" },
      { type: "lxc", id: "lxc/903", vmid: 903, node: "fictional-node-a", name: "sample-template", status: "stopped", template: 1 },
    ] : path === "/pools" ? [] : {};
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
  });

  await page.goto("/?data=live");
  const stopped = page.locator(".guest-card").filter({ hasText: "sample-stopped" });
  const paused = page.locator(".guest-card").filter({ hasText: "sample-paused" });
  const template = page.locator(".guest-card").filter({ hasText: "sample-template" });
  await expect(stopped.locator(".ip-value")).toContainText("10.90.0.1");
  await expect(paused.locator(".ip-value")).toContainText("10.90.0.2");
  await expect(template.locator(".ip-value")).toContainText("10.90.0.3");
  await expect(stopped.locator(".identity-copy small")).toHaveCount(0);
  await stopped.locator(".guest-summary").click();
  await expect(stopped.locator(".detail-info .detail-item strong").nth(0)).toHaveText("QEMU");
  await expect(stopped.locator(".detail-info .detail-item strong").nth(1)).toHaveText("fictional-node-a");
  await expect(template.locator(".identity-copy small")).toHaveCount(0);
  await template.locator(".guest-summary").click();
  await expect(template.locator(".detail-info .detail-item strong").nth(0)).toHaveText("LXC");
  await expect(template.locator(".detail-info .detail-item strong").nth(1)).toHaveText("fictional-node-a");
  const statusBox = await stopped.locator(".badge").boundingBox();
  const ipBox = await stopped.locator(".guest-ip").boundingBox();
  expect(statusBox && ipBox).toBeTruthy();
  expect(statusBox!.x + statusBox!.width).toBeLessThan(ipBox!.x);

  addresses.set("901", "10.90.1.1");
  addresses.set("902", "10.90.1.2");
  addresses.set("903", "10.90.1.3");
  await page.locator("#refresh-button").click();
  await expect(stopped.locator(".ip-value")).toContainText("10.90.1.1");
  await expect(paused.locator(".ip-value")).toContainText("10.90.1.2");
  await expect(template.locator(".ip-value")).toContainText("10.90.1.3");
  expect(["901", "902", "903"].map((id) => configReads.get(id))).toEqual([2, 2, 2]);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileStatus = await stopped.locator(".badge").boundingBox();
  const mobileIp = await stopped.locator(".guest-ip").boundingBox();
  expect(mobileStatus && mobileIp).toBeTruthy();
  expect(mobileStatus!.y).toBe(mobileIp!.y);
  expect(mobileIp!.x + mobileIp!.width).toBeLessThan(mobileStatus!.x);
});

test("starts a stopped container from its details", async ({ page }) => {
  await openMockDashboard(page);

  const container = page.locator(".guest-card").filter({ hasText: "monitoring" });
  await expect(container.locator(".badge")).toContainText("停止");
  await container.locator(".guest-summary").click();
  await container.getByRole("button", { name: "启动 monitoring" }).click();
  await expect(container.locator(".badge")).toContainText("运行");
});

test("persists the infrastructure panel with other preferences", async ({ page }) => {
  await openMockDashboard(page);
  await page.locator("#infrastructure-toggle").click();
  await expect(page.locator("#infrastructure-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.locator(".guest-summary").first().click();
  await page.reload();
  await expect(page.locator("#infrastructure-toggle")).toHaveAttribute("aria-expanded", "false");
});

test("persists virtual section and each resource pool independently", async ({ page }) => {
  await openMockDashboard(page);
  const virtual = page.locator("#virtual-toggle");
  const firstPool = page.locator(".pool-section").first();
  const secondPool = page.locator(".pool-section").nth(1);
  const firstPoolHeading = firstPool.locator(".pool-heading");

  await expect(virtual).toHaveAttribute("aria-expanded", "true");
  await expect(firstPoolHeading).toHaveAttribute("aria-expanded", "true");
  await firstPoolHeading.click();
  await expect(firstPoolHeading).toHaveAttribute("aria-expanded", "false");
  await expect(firstPool.locator(".guest-card").first()).toBeHidden();
  await expect(secondPool.locator(".guest-card").first()).toBeVisible();
  await virtual.click();
  await expect(virtual).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#guest-groups")).toBeHidden();
  await expect(page.locator("#virtual-meta")).toContainText("8");

  await page.reload();
  await expect(page.locator("#connection-text")).toHaveText("已连接 (demo)");
  await expect(page.locator(".guest-card")).toHaveCount(8);
  await expect(virtual).toHaveAttribute("aria-expanded", "false");
  await expect(firstPoolHeading).toHaveAttribute("aria-expanded", "false");
  await virtual.click();
  await expect(virtual).toHaveAttribute("aria-expanded", "true");
  await expect(secondPool.locator(".guest-card").first()).toBeVisible();
  await firstPoolHeading.click();
  await expect(firstPool.locator(".guest-card").first()).toBeVisible();
  await firstPool.locator(".guest-summary").first().click();
  await expect(firstPool.locator(".guest-details").first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(virtual).toBeVisible();
  await firstPoolHeading.click();
  await expect(firstPool.locator(".guest-card").first()).toBeHidden();
  await firstPoolHeading.click();
  await expect(firstPool.locator(".guest-card").first()).toBeVisible();
});

test("retains invented dashboard data across read failures and clears auxiliary errors after recovery", async ({ page }) => {
  let failAuxiliary = false;
  let malformedResources = false;
  await page.route("**/api/api2/json/**", async (route) => {
    const url = new URL(route.request().url());
    const path = `${url.pathname}${url.search}`.replace("/api/api2/json", "");
    if (failAuxiliary && ["/status", "/disks/list", "/network", "/tasks?"].some((part) => path.includes(part))) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "sample outage" }) });
      return;
    }
    const data = path === "/cluster/resources"
      ? malformedResources ? { unexpected: "shape" } : [{ type: "node", id: "node/fictional-node-a", node: "fictional-node-a", status: "online" }, { type: "qemu", id: "qemu/901", vmid: 901, node: "fictional-node-a", name: "sample-guest", status: "running" }]
      : path === "/pools" ? []
        : path === "/access/permissions" ? {}
          : path.endsWith("/disks/list") ? [{ devpath: "/dev/sample-disk", model: "Sample Disk", health: "PASSED" }]
            : path.endsWith("/network") ? [{ iface: "sample-bridge" }]
              : path.endsWith("/status") ? { cpuinfo: { model: "Sample CPU" } }
                : path.includes("/tasks?") ? [{ id: "902", status: "FAILED", endtime: 1_700_086_400 }, { id: "901", status: "OK", endtime: 1_700_000_000 }]
                  : path.endsWith("/config") ? { cores: 2 }
                    : { result: [] };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
  });

  await page.goto("/?data=live");
  await expect(page.locator("#connection-text")).toHaveText("已连接");
  await expect(page).toHaveTitle("PVE");
  await page.locator(".node-toggle").click();
  await expect(page.locator(".node-details")).toContainText("Sample CPU");
  await expect(page.locator(".device-list").first()).toContainText("Sample Disk");
  const backupTime = page.locator(".backup-summary .detail-item strong");
  const expectedBackupTime = await page.evaluate(() => new Date(1_700_000_000_000).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
  await expect(backupTime).toHaveText(expectedBackupTime);
  await expect(page.locator(".block-meta-date")).toHaveText(expectedBackupTime);
  const firstGuest = page.locator(".guest-summary").first();
  await firstGuest.click();
  await expect(page.locator(".guest-details").first()).not.toContainText("上次备份");

  failAuxiliary = true;
  await page.locator("#refresh-button").click();
  await expect(page.locator(".node-details [role='status']")).toContainText("sample outage");
  await expect(page.locator(".node-details")).toContainText("Sample CPU");
  await expect(page.locator(".device-list").first()).toContainText("Sample Disk");
  await expect(page.locator(".device-list").first().getByRole("status")).toContainText("上次成功读取");
  await expect(backupTime).toHaveText(expectedBackupTime);
  await expect(page.locator(".backup-panel").getByRole("status")).toContainText("sample outage");

  failAuxiliary = false;
  await page.locator("#refresh-button").click();
  await expect(page.locator(".node-details [role='status']")).toHaveCount(0);
  await expect(page.locator(".device-list").first().getByRole("status")).toHaveCount(0);
  await expect(page.locator(".backup-panel").getByRole("status")).toHaveCount(0);

  malformedResources = true;
  await page.locator("#refresh-button").click();
  await expect(page.locator("#connection-text")).toHaveText("连接中断");
  await expect(page.locator(".guest-card")).toHaveCount(1);
});

test("hides power controls when invented permission response is denied", async ({ page }) => {
  await page.route("**/api/api2/json/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/api2/json", "");
    if (path === "/access/permissions" || path.endsWith("/config")) {
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "sample denial" }) });
      return;
    }
    const data = path === "/cluster/resources"
      ? [{ type: "qemu", id: "qemu/901", vmid: 901, node: "fictional-node-a", name: "sample-guest", status: "stopped" }]
      : path === "/pools" ? [] : { result: [] };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
  });

  await page.goto("/?data=live");
  const guest = page.locator(".guest-card");
  await expect(guest).toHaveCount(1);
  await guest.locator(".guest-summary").click();
  await expect(guest.locator(".detail-info .detail-item").filter({ hasText: "磁盘容量" })).toContainText("磁盘容量");
  await expect(guest.locator(".detail-info .detail-item").filter({ hasText: "磁盘容量" }).locator("strong")).toHaveText("—");
  await expect(guest.locator(".permission-note")).toBeVisible();
  await expect(guest.locator(".actions")).toHaveCount(0);
});

test("expands physical disk information on desktop and mobile", async ({ page }) => {
  await openMockDashboard(page);
  const disk = page.locator(".disk-card").first();
  await expect(disk.locator(".disk-summary").first()).toContainText("41 °C");
  await expect(disk.locator(".disk-summary")).toContainText("寿命 94%");
  await expect(disk.locator(".disk-summary")).not.toContainText("demo-pve");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await disk.locator(".disk-summary").click();
    await expect(disk.locator(".disk-details")).toContainText("demo-pve");
    await expect(disk.locator(".disk-details")).toContainText("3,523 小时");
    await expect(disk.locator(".disk-details")).toContainText("读 14.2 TB · 写 22.7 TB");
    await expect(disk.locator(".detail-item").filter({ hasText: "SMART 信息" }).locator("strong")).toHaveText("PASSED");
    await expect(disk.locator("pre")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await disk.locator(".disk-summary").click();
    await expect(disk.locator(".disk-details")).toHaveCount(0);
  }
});

test("uses configuration capacity when guest filesystem data is unavailable", async ({ page }) => {
  let fail = false;
  let configAvailable = true;
  await page.route("**/api/api2/json/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/agent/get-fsinfo")) {
      await route.fulfill({ status: fail ? 503 : 200, json: fail ? { message: "agent unavailable" } : { data: { result: [{ mountpoint: "/", "used-bytes": 12 * 1024 ** 3, "total-bytes": 48 * 1024 ** 3 }] } } });
      return;
    }
    const data = path.endsWith("/cluster/resources") ? [{ type: "qemu", vmid: 901, node: "sample-node", name: "sample-filesystem", status: "running" }]
      : path.endsWith("/pools") ? [] : path.endsWith("/config") && configAvailable ? { scsi0: "sample:disk,size=64G" } : {};
    await route.fulfill({ json: { data } });
  });
  await page.goto("/?data=live");
  await page.locator(".guest-summary").click();
  const usage = page.locator(".detail-item").filter({ has: page.locator("small", { hasText: /^磁盘(用量|容量)$/ }) }).locator("strong");
  await expect(usage).toHaveText("12.00 / 48.00 GB");
  await page.reload();
  await expect(usage).toHaveText("12.00 / 48.00 GB");
  fail = true;
  await page.locator("#refresh-button").click();
  await expect(usage).toHaveText("scsi0 64.0 GB");
  configAvailable = false;
  await page.locator("#refresh-button").click();
  await expect(usage).toHaveText("—");
  fail = false;
  await page.locator("#refresh-button").click();
  await expect(usage).toHaveText("12.00 / 48.00 GB");
});

test("opens IP lists by pointer and keyboard without toggling guest details", async ({ page }) => {
  await openMockDashboard(page);
  const guest = page.locator(".guest-card").filter({ hasText: "dev-linux" });
  const stack = guest.locator(".ip-stack");
  const summary = guest.locator(".guest-summary");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(stack.locator(".ip-more")).toHaveText("...");
    for (const key of ["click", "Enter", "Space"]) {
      if (key === "click") await stack.locator(width === 1440 ? ".desktop-ip-addresses" : ".mobile-ip-addresses").click();
      else { await stack.focus(); await page.keyboard.press(key); }
      await expect(page.locator("dialog[open] .ip-row")).toHaveText(["10.10.0.201", "10.20.0.201", "2001:db8::201"]);
      await expect(summary).toHaveAttribute("aria-expanded", "false");
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    }
  }
});

test("demo covers container power transitions, templates and an empty pool using local data", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/api/")) apiRequests.push(request.url());
  });
  await openMockDashboard(page);
  const container = page.locator(".guest-card").filter({ hasText: "monitoring" });
  await container.locator(".guest-summary").click();
  await expect(container.locator(".ip-value")).toContainText("10.10.1.1");
  await container.getByRole("button", { name: "启动 monitoring" }).click();
  await expect(container.locator(".badge")).toHaveText("运行");
  await expect(container.locator(".guest-memory")).toBeVisible();
  const template = page.locator(".guest-card").filter({ hasText: "debian-cloud-template" });
  await template.locator(".guest-summary").click();
  await expect(template.locator(".actions")).toHaveCount(0);
  await expect(page.locator(".pool-section").filter({ hasText: "staging" }).locator(".guest-card")).toHaveCount(0);
  await expect(page.locator(".disk-summary")).toHaveCount(2);
  expect(apiRequests).toEqual([]);
});
