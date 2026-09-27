# PVE Lite Dashboard

[English](README_en.md)

一个没有后台的轻量化的 Proxmox VE 面板，一个页面集中显示节点和VM的各项状态，并可对 VM 进行电源管理。

配置好 API TOKEN 和地址以后，页面会自动发现有权限的节点和虚拟机，并显示获取到的状态信息。

功能列表：

- 物理设备展示：节点信息、存储信息、物理磁盘、网络列表、最近备份
- 虚拟机展示：CPU、内存、IP、磁盘用量、网络流量等
- 对有权限的虚拟机，展示电源管理按钮，启动/停止/暂停/继续等均支持
- 可展示VM config，或通过设置导出所有 VM 的 config 汇总
- 可展示当前 API Token 的权限表格

## 工作方式

```text
浏览器 → 同源 /api/api2/json/... → Caddy → PVE :8006
                                注入 API Token
```

页面会将请求发往本地的 /api 地址，server注入 PVE 的 Token 后，再将 api 请求转发到 PVE 地址以实现通信。

## 编译与 Caddy 部署

安装依赖并生成静态文件：

```bash
npm ci
npm run build
```

构建产物位于 `dist/`。假设部署地址在 `/srv/pve-lite-dashboard/dist`，配置 Caddy：

```caddy
pve.domain {
    root * /srv/pve-lite-dashboard/dist

    handle_path /api/* {
        reverse_proxy https://PVE_ADDRESS:8006 {
            header_up Authorization "PVEAPIToken=PVE_TOKEN"
            transport http {
                tls_insecure_skip_verify
            }
        }
    }

    file_server
}
```

根据实机情况替换站点域名、`dist` 路径、PVE_ADDRESS 和 PVE_TOKEN 即可。

`handle_path` 会移除 `/api` 前缀，因此页面请求 `/api/api2/json/cluster/resources` 时，PVE 收到 `/api2/json/cluster/resources`。示例中的 `tls_insecure_skip_verify` 适用于 PVE 默认自签名证书；若 Caddy 已信任 PVE 证书，可去掉这段配置。

## 本地开发

在项目根目录创建 `.env.local`：

```dotenv
PVE_DASHBOARD_URL=https://PVE_ADDRESS:8006
PVE_DASHBOARD_TOKEN=PVE_TOKEN
```

然后运行：

```bash
npm run dev
```

## PVE 配置

### PVE_TOKEN

1. 在 PVE 网页界面打开「数据中心 → 权限 → 用户」，点击「添加」，创建专用用户，例如用户名 `dashboard`、领域 `Proxmox VE authentication server`，得到 `dashboard@pve`。
2. 打开「数据中心 → 权限 → 角色」，点击「创建」，新建一个面板专用角色。权限选择 `Sys.Audit`、`VM.Audit`、`Datastore.Audit` 和 `Pool.Audit`；如需在面板中操作 VM/LXC 电源，再选择 `VM.PowerMgmt`。
3. 打开「数据中心 → 权限」，点击「添加 → 用户权限」，路径选 `/`，用户选 `dashboard@pve`，角色选刚创建的角色，勾选「传播」。这样会将所选权限应用于整个集群。
4. 打开「数据中心 → 权限 → API 令牌」，点击「添加」，用户选 `dashboard@pve`，令牌 ID 填 `dashboard`，取消勾选「权限分离」，然后点击「添加」。保存弹窗中只显示一次的 Secret。

令牌使用已授予该用户的权限。完整的 `PVE_TOKEN` 由用户、令牌 ID 和 Secret 组成，格式如下：

```text
dashboard@pve!dashboard=TOKEN_SECRET
```

把这个完整值填入上面的 Caddy 配置，或本地开发的 `PVE_DASHBOARD_TOKEN`；`PVEAPIToken=` 前缀已由代理添加。Token 保存在服务端。PVE 的权限与 Token 规则见[官方用户管理文档](https://github.com/proxmox/pve-docs/blob/master/pveum.adoc)。

### VM 分组

Lite Dashboard 的 VM/LXC 分组对应 PVE 的 **Resource Pool（资源池）**：

1. 在 PVE 网页界面打开「数据中心 → 权限 → 资源池」，点击「创建」。
2. 填写资源池 ID，例如 `development`；在注释中填写说明，例如 `开发环境`，然后保存。
3. 在左侧资源树中选择刚创建的资源池，打开「成员」，点击「添加」，选择要放入该组的 VM 或容器。
4. 返回 Lite Dashboard，刷新页面。资源池 ID `development` 会成为分组标题，注释 `开发环境` 显示在标题旁，池中的 VM/LXC 显示在该组。

未加入资源池的实例归入「未分配资源池」，模板归入独立的「模板」组。读取资源池及成员需要相应的 `Pool.Audit` 和 `VM.Audit` 权限。
