# 前端分层职责

Dashboard 是静态 Vue 应用。PVE 提供资源、权限与任务状态；浏览器中的各层负责读取、归一化、展示和用户操作。

```text
PVE REST API
    ↓
同源代理 → data-source → dashboard-api → dashboard store
                                    ↘ guest-cache ↗
                                            ↓
                                  domain + useDashboardView
                                            ↓
                                         components
```

## `src/core/`：运行时基础配置

- `config.ts` 定义默认配置和 TypeScript 结构，校验并合并浏览器保存的配置覆盖项。前台资源刷新默认每 5 秒执行一次。
- `preferences.ts` 是浏览器偏好的唯一持久化入口，负责读取、写入和旧版语言设置迁移。配置覆盖项、区域及资源池开合、资源行展开和语言选择通过它保存。
- `types.ts` 定义 PVE 原始记录、归一化资源和组件共享类型；`numbers.ts` 提供纯数值规则，`format.ts` 与 `i18n.ts` 提供页面格式化和翻译。

## `src/services/`：远端数据与缓存

- `data-source.ts` 选择实时或演示数据源，解开 PVE 响应中的 `data`，并保留 HTTP 状态与错误信息。
- `dashboard-api.ts` 集中维护 PVE endpoint、路径编码和响应契约。它校验列表、对象、权限映射、UPID 与任务状态；格式异常作为错误返回给调用方。节点状态、磁盘、网络各自返回成功或失败结果。
- `guest-cache.ts` 管理 Guest 配置与网络信息的响应式缓存、同一请求合并、失效和失败重试。网络读取仅针对运行中的实例，其他状态使用配置中的静态地址。节点变化会使配置与网络缓存失效；状态变化会使网络缓存失效。手动刷新会重新读取已有缓存项，失败项在后续刷新中按重试间隔重新请求。
- `snapshot-cache.ts` 管理备份和物理设备快照。相同节点集合的并发读取会合并；刷新失败时保留旧快照，节点集合变化时重新建立快照。
- `power-tasks.ts` 轮询 PVE 返回的 UPID 任务，仅在任务停止且退出状态为 `OK` 时确认成功；`mock-data.ts` 实现演示数据源。演示配置、磁盘容量与网络地址按实例生成，电源操作更新对应实例。

## `src/domain/`：纯业务规则

资源归一化、筛选、分组、权限值判断、Guest 网络与磁盘信息提取、资源条计算都在这里完成。领域函数接收输入并返回结果，不访问 DOM、网络或浏览器存储。展示分组不会改写 PVE 返回的 Guest 所属资源池。

## `src/stores/`：Dashboard 状态与操作编排

`dashboard.ts` 保存当前资源、权限、任务状态、节点信息和布局状态。它协调多个服务请求、合并刷新结果、维护 Guest 缓存，并处理电源操作的确认、任务完成反馈与资源重读。主资源读取失败时保留上次资源并标记连接失败；资源池读取失败时保留旧清单；权限读取失败时清空权限并禁止电源操作。备份、节点状态、磁盘和网络按节点分别保存最近成功数据、错误与成功时间；部分读取失败时，成功的部分继续更新。组件通过 store 的方法变更共享状态；偏好写入由 store 交给 `core/preferences.ts`。

## `src/composables/`：页面组合能力

- `useDashboardPolling.ts` 管理初始加载、前后台资源刷新、权限刷新、网络恢复刷新、相对时间计时和卸载清理。
- `useDashboardView.ts` 将 store 的原始状态映射为 Node、Storage、Guest、资源池和页面摘要所需的响应式视图。
- `useDialogs.ts`、`useToast.ts` 管理弹窗与提示；`useOverflowTitles.ts` 为省略的文本补充悬停标题。

## `src/components/` 与 `src/App.vue`：页面展示

组件负责布局、字段和操作控件，读取视图数据或 store 状态并调用 store 方法。`SettingsDialog.vue` 将设置表单提交给 `core/config.ts`，保存成功后重新加载页面。`App.vue` 连接生命周期、周期刷新、视图组合和页面区块。全局样式在 `src/styles/`，组件特有的设置样式位于对应 Vue SFC。

## 数据更新路径

1. 周期刷新或手动刷新调用 store，store 通过 `dashboard-api` 读取 PVE 资源与资源池。
2. store 根据当前 Guest 身份同步配置与网络缓存；节点详情及备份随资源轮询每 60 秒刷新，手动刷新和节点集合变化时立即刷新。
3. `useDashboardView` 调用领域函数生成展示数据，Vue 组件响应状态变化。
4. 电源操作先提交给 PVE，再等待任务状态，最后重新读取资源；页面状态以 PVE 返回的数据为准。

页面在辅助数据读取失败时展示对应错误；已有数据继续显示，并标出上次成功读取时间。空列表只表示接口成功返回的空结果。

适配层单测与页面失败场景使用手写的虚构 PVE 响应，覆盖路径、响应格式、部分读取失败、权限拒绝和恢复流程。
