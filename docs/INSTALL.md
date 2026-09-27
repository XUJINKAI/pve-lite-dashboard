# 安装与部署

本文说明如何为 PVE Lite Dashboard 配置专用账号、监控角色与 API Token，并使用 Caddy 安全代理 PVE API。

## 工作方式

```text
Browser → /api/api2/json/... → Caddy 注入 Token → PVE :8006
```

## 构建前端

项目使用 TypeScript 与 Vite 构建静态产物，开发环境使用 Node.js 22.12+（22.x）或 24+。首次部署或代码更新时执行：

```bash
npm ci
npx playwright install chromium
npm run verify
```

构建结果位于 `dist/`。默认配置由 `src/core/config.ts` 编入静态资源。打开页面右上角的「设置」可以调整数据来源、同源 API 路径、刷新间隔、资源筛选和展示选项；保存后，覆盖项写入当前浏览器的 localStorage，并重新加载页面。前台资源刷新默认每 5 秒执行一次。不同浏览器各自保存自己的设置。

生产环境的 Token 保存在 Caddy 服务端，不应写入前端源码或构建产物。

## GitHub Pages 演示站点

仓库包含 `.github/workflows/pages.yml`。在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中，将 **Source** 设为 **GitHub Actions**。

推送到 `main` 时自动构建并部署，也可以在 **Actions → Deploy GitHub Pages → Run workflow** 手动触发。工作流使用 Node.js 24，执行 `npm ci` 和 `npm run build`，将 `dist/` 上传并部署到 `github-pages` 环境。部署结果链接显示在 workflow 的部署任务中。

Vite 使用相对资源路径，支持 GitHub Pages 的仓库子路径。默认数据源为 `auto` 时，`*.github.io` 站点自动显示内置演示数据。使用自定义域名时，通过 `?data=mock` 或页面设置选择演示数据。GitHub Pages 提供静态页面；连接真实 PVE 的部署方式见本文的 Caddy 配置。

## 本地开发连接 PVE

在项目根目录创建被 Git 忽略的 `.env.local`：

```dotenv
PVE_DASHBOARD_URL=https://PVE_ADDRESS:8006
PVE_DASHBOARD_TOKEN=dashboard@pve!dashboard=TOKEN_SECRET
```

执行 `npm run dev`，开发服务监听 `127.0.0.1:4173`。本机打开 `http://127.0.0.1:4173/`。如需在可信局域网中访问，显式执行 `npm run dev -- --host 0.0.0.0`。Vite 代理 `/api/` 请求，移除 `/api` 前缀并注入 `PVEAPIToken` 认证头，因此开发服务应运行在可信网络中。使用 Shell 环境变量设置同名配置也可以；修改 `.env.local` 后需重启开发服务器。

Token 只由开发服务器读取。变量名保持 `PVE_DASHBOARD_` 前缀，不使用会暴露到浏览器代码中的 `VITE_` 前缀。开发代理允许 PVE 默认的自签名证书；正式部署使用下文的 Caddy 配置。

## 配置监控权限

在 PVE Shell 中创建专用用户：

```bash
pveum user add dashboard@pve \
  --comment "PVE Lite Dashboard"
```

使用内置角色 `PVEAuditor`，由 PVE 提供包括 `Sys.Audit`、`VM.Audit`、`Datastore.Audit` 和 `Pool.Audit` 在内的读取权限。角色与 ACL 规则见 [PVE 官方用户管理文档](https://github.com/proxmox/pve-docs/blob/master/pveum.adoc)。

### 监控整个集群

```bash
pveum acl modify / \
  -user dashboard@pve \
  -role PVEAuditor \
  -propagate 1
```

### 监控指定资源

需要限制可见范围时，选择对应路径授权。例如仅监控 VM 63：

```bash
pveum acl modify /vms/63 \
  -user dashboard@pve \
  -role PVEAuditor \
  -propagate 1
```

或监控资源池及其成员：

```bash
pveum acl modify /pool/my-pool \
  -user dashboard@pve \
  -role PVEAuditor \
  -propagate 1
```

这些是读取范围的不同选择；根路径 `/` 上传播的授权覆盖整个集群。VM 或资源池范围的授权只提供相应资源的可见性；物理节点和存储信息需要对应路径上的读取权限。

### 可选：VM/LXC 电源管理

需要启动、关闭、强制停止、重启、暂停或恢复实例时，创建仅含 `VM.PowerMgmt` 的角色：

```bash
pveum role add DashboardPower -privs "VM.PowerMgmt"
```

将读取和电源角色一起授予指定 VM：

```bash
pveum acl modify /vms/63 \
  -user dashboard@pve \
  -role PVEAuditor,DashboardPower \
  -propagate 1
```

或授权给资源池及其成员：

```bash
pveum acl modify /pool/my-pool \
  -user dashboard@pve \
  -role PVEAuditor,DashboardPower \
  -propagate 1
```

需要对整个集群执行电源操作时，将授权路径设为 `/`。在同一路径配置多个角色时保留完整角色列表。`PVEAuditor` 用于读取，`DashboardPower` 用于电源控制；前端依据 PVE 返回的有效权限显示按钮。

部分详情接口还取决于 PVE 版本、额外权限或 Guest Agent 状态。读取失败时页面保留成功的数据并展示对应错误，按具体接口检查所需权限。

## 创建 API Token

对已经限定权限的专用用户，使用 `--privsep 0` 让 Token 继承该用户的权限：

```bash
pveum user token add dashboard@pve dashboard \
  --privsep 0
```

PVE 只会显示一次 Token secret。最终认证值格式为：

```text
dashboard@pve!dashboard=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

如果使用 `--privsep 1`，还需要单独为 Token 配置 ACL。

## 测试 PVE API

替换 PVE 地址和 Token 后执行：

```bash
curl -k \
  -H 'Authorization: PVEAPIToken=dashboard@pve!dashboard=TOKEN_SECRET' \
  'https://PVE_ADDRESS:8006/api2/json/cluster/resources'
```

测试权限：

```bash
curl -k \
  -H 'Authorization: PVEAPIToken=dashboard@pve!dashboard=TOKEN_SECRET' \
  'https://PVE_ADDRESS:8006/api2/json/access/permissions'
```

## 配置 Caddy

将项目部署到例如 `/srv/pve-lite-dashboard`，并让 Caddy 指向构建后的 `dist/` 目录。

任何能访问 `/api/` 代理的人都能使用 Token 的权限，包括已授权的 VM/LXC 电源操作。应通过可信 LAN、VPN 或认证网关限制整个站点和 `/api/` 的访问。以下示例提供静态文件和 API 转发，访问限制需要按部署环境配置。界面中的资源筛选和按钮显隐只影响展示，实际授权由 PVE ACL 执行。

示例 Caddy 配置：

```caddy
pve-dashboard.home {
    root * /srv/pve-lite-dashboard/dist

    handle_path /api/* {
        reverse_proxy https://PVE_ADDRESS:8006 {
            header_up -Cookie
            header_up Authorization "PVEAPIToken={env.PVE_DASHBOARD_TOKEN}"

            transport http {
                tls_insecure_skip_verify
            }
        }
    }

    file_server
}
```

`handle_path /api/*` 会移除 `/api` 前缀，因此浏览器请求：

```text
/api/api2/json/cluster/resources
```

最终会转发到：

```text
/api2/json/cluster/resources
```

所有请求保持同源，不需要在 PVE 上配置 CORS。

## 保存 Token 环境变量

将 Token 保存在 Caddy 服务端环境文件中。推荐创建：

```text
/etc/caddy/pve-dashboard.env
```

内容：

```bash
PVE_DASHBOARD_TOKEN=dashboard@pve!dashboard=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

限制文件权限：

```bash
sudo chown root:caddy /etc/caddy/pve-dashboard.env
sudo chmod 640 /etc/caddy/pve-dashboard.env
```

执行 `sudo systemctl edit caddy`，加入：

```ini
[Service]
EnvironmentFile=/etc/caddy/pve-dashboard.env
```

然后重新加载：

```bash
sudo systemctl daemon-reload
sudo systemctl restart caddy
sudo systemctl status caddy
```

## 自签名证书

很多 PVE 使用默认自签名证书，因此示例包含：

```caddy
transport http {
    tls_insecure_skip_verify
}
```

它只影响 Caddy 到 PVE 的证书验证。若 PVE 证书已被 Caddy 信任，应删除此配置。

## 启用站点

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

访问：

```text
https://pve-dashboard.home
```

测试 Caddy 是否正确注入 Token：

```bash
curl -k https://pve-dashboard.home/api/api2/json/cluster/resources
```

浏览器和这个 curl 请求都不应自行携带 Authorization Header。

## 常见问题

- `401 / 403`：检查 Token、ACL、资源池传播和所需 Audit 权限。
- `502`：检查 Caddy 是否能访问 `https://PVE_ADDRESS:8006`。
- GET 正常但操作返回 `403`：检查目标 VM 或所属资源池的 `VM.PowerMgmt`。
- 资源池不显示：检查 `/pool/{poolid}` 上是否有 `Pool.Audit`。

虽然 Token 不会下发到浏览器，但任何可以访问 Dashboard `/api/` 代理的人都能使用该 Token 的权限。应坚持最小权限，并只在可信 LAN、VPN 或额外认证之后开放。

## 发布文件与隐私

GitHub 仓库只提交源码、文档及虚构测试数据。`.env.local`、构建产物、浏览器测试报告、Agent 工作目录和 `pve-vm-configs-*.txt` 配置导出文件由 `.gitignore` 排除。静态站点发布内容使用 `dist/`。构建不加载 `PVE_DASHBOARD_` 环境变量；Token 由部署端注入。

VM 配置 TXT 包含原始配置，可能带有 IP、MAC、SSH 公钥、Cloud-init 凭据及挂载路径，应保存在私有位置。浏览器配置 JSON 包含自定义标题和筛选等本地设置，分享前也应检查。页面与测试截图应使用 `?data=mock` 的虚构数据。

Playwright 测试使用生产构建的 preview 服务，运行前先执行 `npm run build`；`npm run verify` 已包含该步骤。
