# PVE Lite Dashboard — Design

## 1. 产品定义

PVE Lite Dashboard 是一个专门用于**日常查看和少量电源控制**的 Proxmox VE 静态 Dashboard。

核心问题只有四个：

1. PVE Node 现在状态如何？
2. 哪些 VM / LXC 正在运行？
3. CPU / RAM 当前用了多少？
4. 我能否快速 Start / Shutdown / Reboot / Suspend / Resume？

复杂管理继续使用 PVE 官方 UI。

---

## 2. 架构

```text
PVE REST API
      │
      ▼
    Caddy
      │
      ├── Token injection
      └── Same-origin proxy
      │
      ▼
Static Frontend
      │
      ├── Resource discovery
      ├── Permission discovery
      ├── Browser settings and presentation rules
      └── Power controls
```

运行时无需：

```text
数据库
业务后端
服务端状态
```

前端使用 Vite 构建，部署时由 Caddy 提供 `dist/` 中的静态文件。本地开发由 Vite 代理相同的 `/api/` 路径并注入 Token。

---

## 3. PVE 是唯一事实来源

禁止维护完整 VM 清单。

资源来自：

```text
GET /cluster/resources
```

当前消费：

```text
node
storage
qemu
lxc
```

因此资源生命周期天然动态：

```text
Create VM
→ 自动出现

Delete VM
→ 自动消失

Rename VM
→ 自动更新

Migrate VM
→ node 自动更新
```

---

## 4. 页面设置的职责

页面设置不回答：

> PVE 有哪些 VM？

它只回答：

> 已经存在的 VM 应该如何显示？

设置面板按职责分为四页：

```text
常规        页面标题、副标题、初始语言、数据来源、API 路径、电源操作
资源        刷新周期、实例类型、模板与停止实例的显示、数据筛选
显示        资源池位置、更新时间、字段、资源条阈值
导入 / 导出  VM 配置 TXT 导出，以及浏览器配置 JSON 的查看、刷新与导入
```

设置保存在当前浏览器。“导入 / 导出”页按顺序包含两个 section：

1. **VM 配置导出**：点击按钮后重新读取当前权限可见的实例清单，涵盖 QEMU、LXC、模板与停机实例，独立于页面资源筛选。最多同时读取 4 个 config，界面显示进度并禁用重复导出。按 VMID 排序、逐实例分段输出全部原始配置键值，文件包含导出时间、节点、类型、名称与成功/失败统计，浏览器下载带时间戳的 UTF-8 TXT 文件。个别读取失败时继续导出其余实例，并在文件与界面标明失败；清单读取失败时显示错误，空清单显示暂无实例。
2. **浏览器配置**：显示当前生效的完整配置 JSON；文本框默认最高 160px，随窗口高度缩小，内容在框内滚动；用户可复制文本保存，或粘贴完整配置并通过校验后导入。保存和导入都会刷新页面。
数据筛选中的“显示模板”和“显示已停止实例”默认勾选，对应资源按筛选规则展示。

---

## 5. Resource Pool 分组

资源池清单来自 `GET /pools`，VM/LXC 再按 PVE 返回的 `pool` 字段归组：

```text
PVE resource pool: core
  VM/LXC...

PVE resource pool: development
  VM/LXC...

没有资源池
  未分配资源池

模板
  所有可见模板单独归组，并始终排在最后
```

资源池变化由 PVE 自动反映到首页，空资源池也会正常显示。

「虚拟机与容器」区域和每个资源池分组均可独立折叠。展开状态保存在当前浏览器，刷新页面后继续使用；默认全部展开。折叠仅影响页面展示，资源读取和分组规则保持不变。

未分配资源池的排序可在页面设置中配置：

```js
resources: {
  pool: {
    unassignedPosition: "first", // first | last，默认 first
  },
}
```

模板不受所属资源池影响，始终显示在独立的“模板”组中，并排在所有其他资源池之后。`resources.virtual.templates` 控制模板是否显示。

---

## 6. 权限模型

有效权限来自：

```text
GET /access/permissions
```

对每个 Guest 检查所属资源池、VM 路径与根路径上的有效权限：

```text
/pool/{poolid}
/vms/{vmid}
/
```

只在：

```text
VM.PowerMgmt === 1
```

时渲染电源按钮。

权限弹窗使用矩阵表展示路径和权限：路径纵向按字母排序，权限横向按覆盖路径数量降序；数量相同按首次出现顺序，仍相同再按字母排序。弹窗支持点击遮罩关闭。

物理设备与管理面板中的 Node、Storage、物理磁盘、网络和备份资源块按当前最短列依次排列；面板收缩时内容区域高度归零。

各类资源行允许列收缩，过长的版本号、设备名、路径和详情值保持单行并以省略号显示，不撑破所在卡片。

Storage 摘要显示名称和容量，容量条占用较宽的横向空间；功能列表、所属节点和状态放在可展开详情中。被省略的长文本在鼠标悬停时显示完整内容。节点运行时间显示在节点名称旁。

权限获取失败：

```text
fail closed
→ 隐藏全部控制
```

PVE ACL 继承和 token/user 权限交集由 PVE 自己计算，前端不重复实现 ACL 算法。

---

## 7. 状态模型

统一：

```text
running
stopped
suspended
unknown
```

特殊情况：

```text
lock === "suspended"
```

优先归一为：

```text
suspended
```

这是因为 PVE 挂起 VM 在 cluster resource 汇总里可能同时表现为：

```text
status: stopped
lock: suspended
```

---

## 8. Action 状态机

```text
stopped
  └── Start

running
  ├── Suspend
  ├── Reboot
  ├── Shutdown
  └── Stop（强制）

suspended
  ├── Resume
  ├── Suspend
  ├── Reboot
  ├── Shutdown
  └── Stop（强制）

unknown
  └── no actions
```

按钮还必须同时通过权限检测。

电源操作采用两个按钮：第一个根据状态显示 Start 或 Resume；第二个打开电源操作菜单，包含 Shutdown、Stop（强制）、Reboot、Suspend，并使用内联 SVG 图标。Stop 调用 PVE 的 `status/stop`，用于不等待 Guest 操作系统的强制停止。

---

## 9. Action 设计

统一入口：

```js
performAction(guest, action)
```

实际 endpoint 根据：

```text
guest.type
guest.node
guest.vmid
```

动态生成。

写操作提交后不做假的乐观状态更新。

正确流程：

```text
POST
↓
PVE 接收任务
↓
UI 显示 pending，并轮询 UPID 任务状态
↓
任务成功或返回错误
↓
显示成功或完整错误反馈（包括 HTTP 状态码）
↓
继续轮询资源
↓
PVE 状态真正变化
↓
UI 更新
```

PVE 始终是事实来源。

区域标题使用当前语言的名称，同行右侧显示资源摘要。区域、资源块和资源池的标题左对齐，CSS 绘制的展开箭头放在标题行右端，接在摘要或计数之后。Node、Storage 和 Guest 行内展开控件的箭头放在文字前。箭头方向由控件的 `aria-expanded` 控制；原生 `details` 使用 `open` 状态。箭头以低对比度常显，悬停或键盘聚焦时加深。

资源块和资源池使用统一的 6px 圆角外框，页面、分组标题栏和项目内容区形成三层底色：浅色主题分别为 #f6f8fa、#eaeef2 和 #ffffff；暗色主题分别为 #0d1117、#252d38 和 #161b22。分组标题栏共用 `--group-bg`。常规边框保持 1px，浅色主题使用 #b8c2cc、暗色主题使用 #505b68，清楚界定资源块与资源池。标题栏与展开内容之间、实例和设备条目之间通过细分隔线区分。Guest 摘要内边距为 12px，存储和设备摘要同样使用 12px 内边距；资源池之间间隔 12px。Guest 面板采用三级文字层级：名称使用 14px、600 字重的正文色；IP、指标与详情值使用 12px、400 字重，桌面使用正文色；编号、运行时间、状态与字段标签使用 12px 常规字重和辅助文字色。手机指标延续辅助文字色。物理设备与管理面板采用相同层级：节点、存储、磁盘和网络名称使用 14px、600 字重，指标、地址、备份时间和详情值使用 12px 常规字重，标签与辅助信息使用辅助文字色。节点在资源块内按单列列表排列；节点和存储详情按内容宽度换行，间距为纵向 12px、横向 24px，与摘要之间使用常规边框色 30% 强度的细线。顶栏通过留白与内容区区分，操作使用统一线条 SVG 图标，资源面板在鼠标悬停、点击和触摸后保持一致底色；触摸高亮为透明，键盘焦点使用蓝色轮廓。

备份资源块从 vzdump 任务历史中选取最近一次成功任务的完成时间，展开后显示这一项；该时间描述任务记录，不校验归档文件是否仍存在。

备份资源块的标题概要显示最近一次成功备份任务的完成时间；网络资源块的标题概要显示在线条目数与条目总数。网络条目为地址和补充信息留出更多宽度。

---

## 10. 资源展示

Node 默认：

```text
Name
Status
CPU
RAM
Uptime
```

节点卡片的 CPU 与内存指标等宽排列；只显示其中一项时，该指标占满整行。窄屏下两项纵向排列。节点与 Guest 摘要的 CPU/内存指标间距共用 18px 变量。900px 及以下宽度时，物理资源块单列排列，Guest 摘要中的资源指标使用整行宽度，名称和数值位于进度条上方。

手机宽度下，顶栏左侧显示品牌，右侧第一行排列四个操作按钮、第二行显示连接状态；存储的名称与容量条并排；网络信息分为两行，第一行显示名称、IP 和状态，第二行显示类型及补充信息。

物理磁盘摘要显示名称、大小、寿命和温度；手机宽度下名称独占第一行，大小、寿命和温度位于第二行。点击摘要展开节点、类型、通电时间、累计读写及 SMART 健康状态（如 `PASSED`），无法读取的字段显示 `—`。Guest 在资源池内连续排列，条目之间使用细分隔线，摘要在资源指标之前采用单行网格：左侧显示编号与名称，右侧依次显示首个 IP 与状态。文字使用统一的 20px 行高，名称可伸缩并单行省略，IP 和状态靠右排列；多个 IP 可打开完整列表，地址与 ` ...` 提示在同一行居中对齐，单个地址靠右。CPU 与内存并排显示，指标名称和数值使用弱色并位于同一行，进度条位于下方；内存标题只显示名称，过长文字单行省略。Guest 的展开状态通过摘要行和 `aria-expanded` 表达。

CPU、内存和容量资源条的灰色轨道使用统一的 `--progress-track` 颜色，基于辅助文字色混合 20% 绘制；填充颜色和资源比例分别表达压力与使用量。

物理设备与管理、虚拟机与容器两个顶层区域通过标题文字和右侧概要按钮展开或收起，两侧之间的空白区域保持静态。节点、存储、磁盘、网络、备份和资源池分组的整条标题栏均可点击展开或收起，支持键盘 Enter 与空格操作，展开状态通过 `aria-expanded` 表达。暂停实例的内存列与运行实例的内存列使用相同的起始位置和指标间距。

权限矩阵弹窗在桌面端最大宽度为 1180px，窄屏随视口缩放。任一页面弹窗打开时，页面滚动位置保持固定，弹窗内容可在弹窗内部滚动。

Guest 摘要显示 VMID、名称、状态、IP、CPU 和内存，运行时间放在展开详情中；非运行实例和模板的运行时间显示 `—`。内存摘要使用“内存”标签，数值显示已用／总量，进度条表达使用比例。桌面布局收紧 VMID 和状态列，CPU、内存列使用更大的可伸缩空间，内存列最宽。点击摘要可展开详情；电源操作位于详情区。详情区依次显示类型、所属节点、运行时间、磁盘用量或配置容量、磁盘读写、网络流量和实际宿主内存，各字段遵循显示设置，详情信息项按内容宽度排列，横向间距为 24px、纵向间距为 12px。Guest 收起和展开时均使用内容区底色，详情区与摘要底色一致，两者之间使用常规边框色 30% 强度的细分隔线。磁盘信息优先显示 Agent 的实际文件系统用量；获取不到时以“磁盘容量”为标签显示配置中的磁盘名称和容量，两者均不可用时显示 `—`。详情信息区末尾提供靠左排列的“全部配置”链接样式按钮，以弹窗按字段名排序展示 config 接口返回的全部键值，保留 net0、scsi0 等原始字符串；弹窗支持刷新、关闭及 Escape，读取期间和失败时展示对应状态。页面刷新后恢复已展开实例时，资源加载完成后自动读取其配置；页面手动刷新也会刷新已展开实例的配置。IP 优先读取 QEMU Guest Agent 或 LXC 接口信息；已停止、暂停和模板实例在刷新时读取 Guest 配置，尝试显示其中的静态 IP。多个 IP 在摘要中以英文逗号加空格分隔，最多显示两个，超出摘要数量的地址以 ` ...` 提示（桌面超过两个，手机超过一个）；点击整个 IP 地址区域可打开完整地址弹窗，支持 Enter 与空格键，操作独立于 VM 详情展开。CPU 和内存资源条的计算见 [资源条与状态显示规范](status_bar.md)。

---

## 11. 资源筛选与物理设备布局

资源设置分为 `resources.physical` 和 `resources.virtual`。每组的 `show` 为总开关；物理设备组的 `node`、`storage`、`disks`、`network`、`backups` 分别控制五个资源块。虚拟机组的 `qemu`、`lxc`、`templates`、`stopped` 控制实例类型与状态，`excludeVmids` 接受 VMID 数字或 `[起始, 结束]` 范围。物理设备资源块在桌面端按当前最短列依次排布，窄屏自动减少列数。

```js
resources: {
  pool: { unassignedPosition: "first" },
  physical: { show: true, node: true, storage: true, disks: true, network: true, backups: true },
  virtual: { show: true, qemu: true, lxc: true, templates: true, stopped: true, excludeVmids: [101, [200, 210]] },
}
```

---

## 12. Refresh

页面设置中的刷新配置统一使用秒：

```text
Foreground  5s
Background  60s
Permissions 5min
```

资源自动刷新间隔设置为 `0` 时禁用自动刷新；页面首次加载和手动点击刷新仍然有效。

重新切回页面时，若前台自动刷新已启用，则立即刷新。

---

## 13. 安全边界

Caddy 与本地开发代理在服务端注入 Token，但代理入口仍需受控。

实际边界是：

```text
谁能访问 Dashboard API
≈
谁能借用这个 Token 的能力
```

所以核心防护：

```text
最低权限 Token
+
LAN/VPN 网络限制
```

前端权限检测是 UI 行为，不是安全机制。

最终授权始终由 PVE 服务端 ACL 强制执行。

---

## 14. 技术选型

使用：

```text
Vue 3
TypeScript
Vite
Pinia
CSS
Caddy
```

工程约束：

```text
静态构建产物
浏览器本地设置
PVE REST API
浏览器端状态管理
```

前端工程以 TypeScript 编写 Vue 组件，Vite 负责开发服务器和静态构建，Pinia 负责跨组件共享状态。生产环境继续由 Caddy 提供静态文件，并代理 PVE API。

### 14.1 前端模块边界

Vue 应用入口连接生命周期和各视图。完整的层级职责见 [前端架构说明](ARCHITECTURE.md)。可复用能力按职责拆分：

```text
src/components/    页面布局、资源卡片、Guest 与弹窗组件
src/stores/        PVE 状态、刷新与操作编排、布局状态
src/composables/   周期刷新、展示映射、弹窗和消息提示
src/services/      数据源、PVE API、Guest 与节点快照缓存、任务轮询和演示数据
src/core/          配置、国际化、偏好和通用类型
src/domain/        资源归一化、筛选、分组、权限和资源条算法等纯业务规则
src/styles/        Dashboard 全局视觉样式
tests/playwright.config.ts、tests/vitest.config.ts   浏览器与单元测试配置
tests/results/、tests/report/、tests/coverage/   测试生成的结果与报告
```

领域模块不访问 DOM；组件通过响应式视图读取 PVE 事实数据；外部请求和缓存集中在服务中，store 负责更新编排。配置覆盖项与布局偏好通过 `core/preferences.ts` 持久化。

统一验证入口为 `npm run verify`，依次执行 lint、TypeScript 类型检查、unit tests、production build 和一次包含交互与视觉断言的 Playwright 测试。视觉基线更新使用单独的 `npm run test:visual:update`。

`index.html` 是正式页面入口；默认配置位于 `src/core/config.ts`，设置界面保存浏览器本地覆盖项。Dashboard 样式由 `src/main.ts` 从 `src/styles/` 导入。国际化、偏好存储、演示数据和数据访问层位于 `src` 对应目录。

顶栏品牌标记和网站图标共用 `src/assets/brand-mark.svg`。演示数据模式下，页面标题、浏览器标题和连接状态文字附加 `(demo)` 标识。

### 14.2 视觉回归

Playwright 使用确定性的演示数据打开 Dashboard，对桌面和 390px 手机视口的完整页面截图进行视觉回归检查。交互测试覆盖分组展开、Guest 信息、设置和弹窗；视觉基线位于 `tests/e2e/visual.spec.ts-snapshots/`。


### 14.3 资源面板共用样式

`src/styles/resources.css` 集中定义 VM 与物理资源共用的面板外框、标题栏、名称层级、连续列表分隔线、详情信息项和资源条。`infrastructure.css` 与 `guests.css` 分别负责物理资源和 VM 的布局，`responsive.css` 负责窄屏排列。

| 样式 | 共用规则 |
| --- | --- |
| 面板 | 内容底色、1px 边框、`--radius` 圆角 |
| 标题栏 | `--group-bg` 分组底色、42px 最小高度、统一内边距；整行按钮控制展开收起 |
| 资源名称 | `--resource-name-size`：14px，600 字重 |
| 数值与辅助文字 | `--resource-text-size`：12px，400 字重；标签使用辅助文字色 |
| 摘要留白 | `--resource-padding`：12px |
| 详情信息项 | 按内容宽度排列，`--resource-detail-gap`：纵向 12px、横向 24px |
| 详情分隔线 | `--resource-detail-line`：常规边框色的 30% 强度 |
| 资源条 | 统一轨道、4px 高度、状态颜色与数值排版 |

同类视觉调整优先修改共用规则；独立布局仅定义列宽、对齐和响应式差异。

---

## 15. 成功标准

项目达到目标时应该满足：

```text
新增 VM 不改代码
删除 VM 不改代码
改名不改代码
迁移 Node 不改代码
权限变化自动反映
常用 VM 能人为归类
未分配资源池的 VM 自动归入未分配资源池
页面长期打开足够清晰
复杂管理仍然回官方 PVE
```

最重要的边界：

> 它是 PVE 的日常状态面板，不是另一个 PVE。

### 磁盘详细数据读取

物理磁盘通过节点 disks/smart 接口补充温度、通电时间、累计读写及 SMART 信息；SMART 查询失败独立降级，不影响磁盘列表显示。NVMe 文本与 SATA SMART 属性分别提取可用字段。

VM 真实磁盘用量通过运行中 QEMU 的 agent/get-fsinfo 读取，优先显示根文件系统 `/`；其他系统显示有效文件系统（多项带挂载点），过滤 EFI 挂载点。容量采用 total-bytes 普通用户口径，按 1024³ 换算，遵循页面 GB 单位约定，固定两位小数并只在末尾显示单位，例如 `41.33 / 59.05 GB`。缺少 Agent、权限不足、停机、空数据或缺少有效容量时，回退到 config 中各磁盘的 size 容量；配置容量也不可用时显示 `—`。在展开、恢复展开和刷新时加载；实例迁移及状态变化时使缓存失效。

### 演示数据

`?data=mock` 使用内置虚构数据，包含一个节点、两种存储、NVMe 与 SATA 磁盘、三个业务资源池及一个空资源池。八台实例涵盖运行与停机的 QEMU/LXC、挂起 VM 和云模板。每台实例提供对应的 CPU、内存、磁盘与原始配置；运行中 VM 提供文件系统用量，网络涵盖 IPv4、多网卡和 IPv6，停机实例展示配置中的静态地址。电源操作在当前页面的演示数据中生效，重新加载页面恢复初始场景。

辅助数据随资源轮询每 60 秒更新，手动刷新立即读取。演示模式仅使用内置数据；API 路径限定同源并拒绝反斜杠，请求遇到重定向时按错误处理。
