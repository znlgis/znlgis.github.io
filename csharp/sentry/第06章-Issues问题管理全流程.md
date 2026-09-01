---
layout: default
title: 第六章：Issues 问题管理全流程
---

# 第六章：Issues 问题管理全流程

 - [6.1 Issue（问题）的概念与生命周期](#section-6-1-issue)
  - [6.1.1 什么是 Issue](#611-什么是-issue)
  - [6.1.2 GroupStatus——顶层状态](#612-groupstatus顶层状态)
  - [6.1.3 GroupSubStatus——次级状态](#613-groupsubstatus次级状态)
  - [6.1.4 状态流转详解](#614-状态流转详解)
  - [6.1.5 活动记录与审计追踪](#615-活动记录与审计追踪)
- [6.2 事件分组（Grouping）机制](#62-事件分组grouping机制)
  - [6.2.1 分组的核心目标](#621-分组的核心目标)
  - [6.2.2 分组变体（Variant）体系](#622-分组变体variant体系)
  - [6.2.3 分组策略（Strategy）详解](#623-分组策略strategy详解)
  - [6.2.4 Grouping Config 的版本演进](#624-grouping-config-的版本演进)
  - [6.2.5 增强规则（Enhancements）](#625-增强规则enhancements)
   - [6.2.6 Fingerprint（指纹）机制](#section-6-2-6-fingerprint)
  - [6.2.7 完整的分组流程](#627-完整的分组流程)
- [6.3 Issue 详情页解读](#63-issue-详情页解读)
  - [6.3.1 Issue 概览属性](#631-issue-概览属性)
  - [6.3.2 Event 列表与推荐 Event](#632-event-列表与推荐-event)
  - [6.3.3 Tags 分布](#633-tags-分布)
  - [6.3.4 Breadcrumbs 时间线](#634-breadcrumbs-时间线)
  - [6.3.5 侧边栏聚合统计](#635-侧边栏聚合统计)
- [6.4 Issue 操作](#64-issue-操作)
   - [6.4.1 Resolve（解决）](#section-6-4-1-resolve)
   - [6.4.2 Ignore / Archive（忽略 / 归档）](#section-6-4-2-ignore-archive)
   - [6.4.3 Assign（分配）](#section-6-4-3-assign)
  - [6.4.4 Bookmark / Subscribe（书签 / 订阅）](#644-bookmark--subscribe标记--订阅)
   - [6.4.5 Merge（合并）](#section-6-4-5-merge)
   - [6.4.6 Delete / Remove（删除）](#section-6-4-6-delete-remove)
   - [6.4.7 Reprocessing（重处理）](#section-6-4-7-reprocessing)
- [6.5 Issue 搜索与过滤](#65-issue-搜索与过滤)
  - [6.5.1 搜索查询语法](#651-搜索查询语法)
  - [6.5.2 预定义搜索与保存视图](#652-预定义搜索与保存视图)
  - [6.5.3 搜索实现架构](#653-搜索实现架构)
- [6.6 Issue Owners 与自动分配规则](#66-issue-owners-与自动分配规则)
  - [6.6.1 Ownership Rules 语法](#661-ownership-rules-语法)
  - [6.6.2 Code Owners 集成](#662-code-owners-集成)
  - [6.6.3 自动分配流程](#663-自动分配流程)
  - [6.6.4 Suspect Commits 与嫌疑提交](#664-suspect-commits-与嫌疑提交)
- [6.7 Issue 平台（Issue Platform）](#67-issue-平台issue-platform)
  - [6.7.1 Issue Occurrence 模型](#671-issue-occurrence-模型)
  - [6.7.2 各类 Issue 类型全景](#672-各类-issue-类型全景)
  - [6.7.3 Issue Category 分类体系](#673-issue-category-分类体系)
  - [6.7.4 Noise Reduction 与创建配额](#674-noise-reduction-与创建配额)
- [6.8 告警规则关联](#68-告警规则关联)
  - [6.8.1 Issue Alert Rules 的创建](#681-issue-alert-rules-的创建)
  - [6.8.2 告警条件类型](#682-告警条件类型)
  - [6.8.3 Post-Process 中的告警触发](#683-post-process-中的告警触发)
- [6.9 Issue 数据导出与 API](#69-issue-数据导出与-api)
  - [6.9.1 REST API 端点概览](#691-rest-api-端点概览)
  - [6.9.2 批量操作与游标分页](#692-批量操作与游标分页)

---

## 6.1 Issue（问题）的概念与生命周期 {#section-6-1-issue}

### 6.1.1 什么是 Issue

在 Sentry 的术语体系中，**Issue**（问题）是对一组具有相同根因的 **Event**（事件）的聚合体。如果把 Event 看作单个错误发生时的快照，那么 Issue 就是把成千上万次相同错误组织在一起的高层概念。

在数据库层面，Issue 由 `Group` 模型承载（位于 `src/sentry/models/group.py`）。该模型在 PostgreSQL 中的实际表名是 `sentry_groupedmessage`，这个历史命名揭示了其本质——**分组的消息**。

```python
# src/sentry/models/group.py:848-903 (精简)
class Group(Model):
    """Aggregated message which summarizes a set of Events."""

    project = FlexibleForeignKey("sentry.Project")
    logger = models.CharField(max_length=64, default=DEFAULT_LOGGER_NAME)
    level = BoundedPositiveIntegerField(default=logging.ERROR)
    message = models.TextField()
    culprit = models.CharField(max_length=MAX_CULPRIT_LENGTH, blank=True, null=True)
    platform = models.CharField(max_length=64, null=True)
    status = BoundedPositiveIntegerField(default=GroupStatus.UNRESOLVED)
    substatus = BoundedIntegerField(null=True)
    times_seen = BoundedPositiveIntegerField(default=1)
    last_seen = models.DateTimeField(default=timezone.now)
    first_seen = models.DateTimeField(default=timezone.now)
    first_release = FlexibleForeignKey("sentry.Release", null=True)
    resolved_at = models.DateTimeField(null=True)
    active_at = models.DateTimeField(null=True)
    short_id = BoundedBigIntegerField(null=True)
    type = BoundedPositiveIntegerField(default=DEFAULT_TYPE_ID)
    priority = models.PositiveIntegerField(null=True)
    data = LegacyTextJSONField(null=True)
```

每个 Issue 有一个全局唯一的 Short ID，格式为 `PROJECT_SLUG-XXXX`（例如 `BACKEND-A3F2`），由 `qualified_short_id` 属性生成。Short ID 使用 Base32 编码算法，在项目范围内自增。

### 6.1.2 GroupStatus——顶层状态

Sentry 定义了七种顶层状态，在 `GroupStatus` 类中声明（`src/sentry/models/group.py:182-196`）：

| 状态常量 | 值 | 含义 |
|---|---|---|
| `UNRESOLVED` | 0 | 未解决，Issue 处于活跃/待处理状态 |
| `RESOLVED` | 1 | 已解决，Issue 被标记为处理完毕 |
| `IGNORED` | 2 | 已忽略/归档，Issue 被暂时或永久搁置 |
| `PENDING_DELETION` | 3 | 等待删除 |
| `DELETION_IN_PROGRESS` | 4 | 删除进行中 |
| `PENDING_MERGE` | 5 | 等待合并（被合并的 Issue 的中间状态） |
| `REPROCESSING` | 6 | 重处理中（事件正在被重新分组） |

其中 `MUTED` 是 `IGNORED` 的历史别名，标记为 `# TODO(dcramer): remove in 9.0`，在新代码中应当避免使用。

顶层状态中只有 `UNRESOLVED` 和 `IGNORED` 支持**次级状态（SubStatus）**，其余的 `RESOLVED`、`PENDING_DELETION` 等不需要次级细分。

### 6.1.3 GroupSubStatus——次级状态

次级状态（`src/sentry/types/group.py`）是对 `UNRESOLVED` 和 `IGNORED` 两种顶层状态的进一步细化：

| SubStatus | 所属顶层状态 | 含义 |
|---|---|---|
| `NEW` | UNRESOLVED | 新创建的 Issue，首次被捕获 |
| `ONGOING` | UNRESOLVED | 持续发生中，超过 7 天或重新激活后的常态 |
| `ESCALATING` | UNRESOLVED | 正在升级，事件频率或用户影响显著上升 |
| `REGRESSED` | UNRESOLVED | 回归，之前已解决但又重新出现 |
| `UNTIL_ESCALATING` | IGNORED | 归档直到升级，当达到升级条件时自动恢复 |
| `UNTIL_CONDITION_MET` | IGNORED | 归档直到条件满足（达到指定次数/用户数等） |
| `FOREVER` | IGNORED | 永久归档，除非手动恢复 |

每个状态的合法性在 `pre_save_group_default_substatus` 信号处理器中强制校验（`src/sentry/models/group.py:1343-1364`），不合规的组合会被记录为错误日志。

### 6.1.4 状态流转详解

Issue 的完整生命周期可用以下状态流转图描述：

```
                   +---> RESOLVED ---> (手动 Unresolve) ---+
                   |      (自动 Resolve)                    |
                   |                                        v
NEW ---> ONGOING --+                                    UNRESOLVED
  |        |       |                                        ^
  |        |       +---> IGNORED (FOREVER) ---> (手动) -----+
  |        |       +---> IGNORED (UNTIL_CONDITION_MET) -----+
  |        |       +---> IGNORED (UNTIL_ESCALATING) --------+
  |        |                                                |
  |        +---> ESCALATING --(速率下降)--> ONGOING --------+
  |                                                         |
  +--(7天内取消忽略)--> NEW                                 |
                                                           |
REGRESSED (Resolved Issue 重新出现) <----------------------+
```

状态变更的核心入口是 `handle_status_update` 函数（`src/sentry/issues/status_change.py:68-184`）。它处理以下几种情况：

**1. Resolve（解决）**

调用 `Group.objects.update_group_status()` 方法（`src/sentry/models/group.py:695-803`），该方法：
- 批量更新 `status=RESOLVED`、`substatus=None`、`resolved_at=当前时间`
- 创建 `Activity` 记录（类型 `SET_RESOLVED`）
- 记录 `GroupHistory` 条目
- 调用 `update_group_open_period()`，关闭当前 Issue 的打开时间段（Open Period）
- 触发 `issue_resolved` 信号

**2. Ignore（忽略）**

`handle_ignored` 函数（`src/sentry/issues/ignored.py:88-159`）处理忽略逻辑：

- **永久忽略**：简单地将 `status=IGNORED, substatus=FOREVER`，移除 Inbox 标记
- **条件忽略**（指定次数 `ignoreCount` + 时间窗口 `ignoreWindow`）：创建 `GroupSnooze` 记录，存储忽略条件和初始状态，当新事件到来且不满足条件时自动解除忽略
- **用户数条件忽略**（`ignoreUserCount` + `ignoreUserWindow`）：按受影响用户数判断
- **时间窗口忽略**（`ignoreDuration`）：设置 `until` 时间点，到期后自动解除
- **升级型归档**（`ignoredUntilEscalating`）：归档的同时生成预测模型，当事件频率超过预测阈值时自动升级为 `ESCALATING`

`GroupSnooze.is_valid()` 方法在每次新事件到来时被调用（`process_snoozes` 在 post-process 流水线中），根据条件判断是否应当解除忽略状态。

**3. Unresolve（取消解决）**

当已解决的 Issue 重新出现新事件时，状态变为 `UNRESOLVED`，且 SubStatus 设为 `REGRESSED`（回归）。如果是从忽略状态手动恢复，SubStatus 根据 Issue 的创建时间判断：首次出现 7 天内的设为 `NEW`，否则设为 `ONGOING`。这个逻辑在 `infer_substatus` 函数中实现（`src/sentry/issues/status_change.py:32-65`）。

**4. Escalating（升级）**

升级检测有两个路径：

- **新 Issue 升级**（`detect_new_escalation`，在 `post_process.py:1418-1487`）：针对创建不到 24 小时的 Issue，如果其每小时事件速率超过项目级别的升级阈值，自动标记为 `ESCALATING` 并提升优先级
- **归档 Issue 升级**（`process_snoozes`，在 `post_process.py:821-934`）：针对 `UNTIL_ESCALATING` 状态的 Issue，调用 `is_escalating()` 判断是否触发预测升级

### 6.1.5 活动记录与审计追踪

每次 Issue 状态变更都会在 `Activity` 表中创建记录，并通过 `GroupHistory` 表追踪历史。`record_group_history_from_activity_type` 函数将 Activity 类型映射为 GroupHistory 状态。通知订阅者通过 `GroupSubscription.objects.subscribe()` 完成，确保操作者自动订阅后续变更通知。

---

## 6.2 事件分组（Grouping）机制

### 6.2.1 分组的核心目标

Sentry 每天可能接收数以亿计的事件。如果每个事件都单独展示，开发者将被信息海洋淹没。分组的核心目标是将**相同根因**的事件聚合为一个 Issue，同时又能区分**不同根因**的错误。

从代码实现的角度，分组就是将 Event 的某些属性（堆栈、异常类型、消息等）计算为一个哈希值（hash），相同哈希的事件归入同一个 Group。这个哈希值存储在 `GroupHash` 表中。

### 6.2.2 分组变体（Variant）体系

分组系统的入口是 `get_grouping_variants_for_event` 函数（`src/sentry/grouping/api.py:358-459`）。它返回一个变体字典，每个变体代表一种分组结果及其贡献程度。变体类型定义在 `src/sentry/grouping/variants.py` 中：

| 变体类型 | 类名 | 说明 |
|---|---|---|
| `checksum` | `ChecksumVariant` | SDK 发送了显式的 `checksum` 字段（32 字符十六进制），直接用作哈希 |
| `hashed_checksum` | `HashedChecksumVariant` | SDK 发送了非标准长度的 checksum，先哈希再使用 |
| `app`、`system`、`default` | `ComponentVariant` | 基于事件内容（堆栈、异常、消息等）的策略计算出的分组变体 |
| `custom_fingerprint` | `CustomFingerprintVariant` | 自定义指纹（客户端或服务端规则匹配），完全覆盖事件内容分组 |
| `salted_*` | `SaltedComponentVariant` | 混合指纹模式，将事件内容分组哈希与自定义指纹拼接后重新哈希 |
| `fallback` | `FallbackVariant` | 兜底变体，当所有其他变体都无法贡献时使用随机哈希 |

每种变体都有一个 `contributes` 属性，表示该变体是否应该用于最终分组。默认情况下，只有一个变体标记为 `contributes=True`，其哈希值就是最终的分组依据。

### 6.2.3 分组策略（Strategy）详解

分组策略决定了**如何从事件数据中提取分组组件**。所有策略在 `src/sentry/grouping/strategies/newstyle.py` 中实现，通过 `@strategy` 装饰器注册。策略按优先级从高到低依次执行，第一个产生有效结果的策略即为胜出者：

```
chained-exception:v1  (最高优先级，也处理单个异常)
    └── threads:v1
        └── stacktrace:v1
            └── template:v1
                └── csp:v1 (Content Security Policy)
                    └── hpkp:v1
                        └── expect-staple:v1
                            └── expect-ct:v1
                                └── message:v1 (最低优先级)
```

**Chained Exception（链式异常）策略**：处理 Java、Python 等语言中的异常链（`cause` 链）。对于链式异常，将所有异常的类型、值和堆栈按照因果关系串联在一起计算哈希。单个异常也走这个策略。

**Threads（线程）策略**：处理多线程环境中发生的崩溃。将当前崩溃线程的堆栈与其他线程的堆栈一起参与分组。

**Stacktrace（堆栈）策略**：最常见的分组策略。提取异常堆栈中帧的 module（模块）、function（函数）、filename（文件名）和 context line（上下文行）等信息，参数化掉变量部分后计算哈希。其中：

- 帧的 **module** 是文件路径去掉扩展名和行号后的部分
- 帧的 **function** 会被参数化——例如 `myFunc(param1=123, param2="abc")` 变为 `myFunc(param1=*, param2=*)`
- **In-App 帧**（应用代码）比系统/框架代码帧的权重更高
- `context_line` 参与分组时也会做参数化处理

**Template（模板）策略**：适用于 Django/Jinja2 等模板引擎抛出的异常。

**Message（消息）策略**：最低优先级的兜底策略。对于没有堆栈信息的事件（如 `logging.error("something")`），将消息文本参数化后直接哈希。通过正则替换将数字、UUID、日期等变量替换为占位符，只保留消息的结构模式。

除了上述内容策略，还有一个关键的 **frame 委托策略**（`frame:v1`），它定义了如何对单个堆栈帧进行参数化处理，包括：

- 去除数字和哈希值的参数化（`parameterization.py`）
- 对 Java CGLIB/Javassist/Reflection 增强器生成类名的模式替换
- 对 Ruby ERB 模板 `__NNNN_NNNN` 后缀的修剪
- 对 Clojure 匿名函数的规范化

### 6.2.4 Grouping Config 的版本演进

分组逻辑会随时间改进，Sentry 通过 **Grouping Config** 机制管理版本。config 定义在 `src/sentry/grouping/strategies/configurations.py` 中：

```python
# 当前默认配置
register_grouping_config(
    id=WINTER_2023_GROUPING_CONFIG,  # "newstyle:2023-01-11"
    initial_context={
        "use_legacy_exception_subcomponent_order": True,
        "handle_js_single_frame_url_origin_backwards": True,
        "prevent_python_multiprocessing_context_line_parameterization": True,
        "use_legacy_unknown_variable_handling": True,
    },
    enhancements_base="all-platforms:2023-01-11",
    fingerprinting_bases=["javascript@2024-02-02"],
)

# 下一版配置，base=WINTER_2023_GROUPING_CONFIG 表示继承
register_grouping_config(
    id=FALL_2025_GROUPING_CONFIG,  # "newstyle:2025-10-08"
    base=WINTER_2023_GROUPING_CONFIG,
    initial_context={
        "use_legacy_exception_subcomponent_order": False,
        "handle_js_single_frame_url_origin_backwards": False,
        "prevent_python_multiprocessing_context_line_parameterization": False,
        "use_legacy_unknown_variable_handling": False,
    },
    enhancements_base="all-platforms:2026-01-20",
)
```

每个项目通过 `sentry:grouping_config` 选项指定当前使用的 config ID（由 `PrimaryGroupingConfigLoader` 加载）。当 config 发生变更时，旧的 Group 可能无法被新事件匹配。Sentry 引入了 `SecondaryGroupingConfigLoader`（读取 `sentry:secondary_grouping_config`）作为过渡机制：新事件同时用主配置和辅助配置计算哈希，如果辅助配置的哈希命中已存在的旧 Group，则将新事件归入其中，避免产生重复 Issue。

### 6.2.5 增强规则（Enhancements）

增强规则允许项目自定义堆栈帧的 in-app 标记和分组贡献属性。规则系统基于 Rust 实现的 `sentry_ophio.enhancers` 库，提供高性能的规则匹配。规则文件通过 `EnhancementsConfig` 类加载（`src/sentry/grouping/enhancer/__init__.py`），支持以下操作：

- **标记 in-app/out-app 帧**：`+app`、`-app` 控制哪些堆栈帧被视为"应用代码"
- **控制帧参与分组**：`+group`、`-group` 决定某帧是否影响分组哈希
- **标记帧的贡献方向**：控制帧为分组"加分"还是"减分"

增强规则通过 `Base64` 编码存储在 Event 数据中，确保后续重处理时可复现相同的分组结果。规则格式示例：

```
# 将 sentry 的内部帧标记为 non-app
stack.module:sentry -app -group

# 将特定包标记为 in-app
stack.module:com.myapp.* +app
```

`DEFAULT_ENHANCEMENTS_BASE` 当前值为 `"all-platforms:2026-01-20"`，包含约 300 条内置规则，覆盖主流平台（Python、JavaScript、Java、Ruby、PHP、Go 等）的框架识别。

### 6.2.6 Fingerprint（指纹）机制 {#section-6-2-6-fingerprint}

Fingerprint 是分组系统中最灵活的机制，允许开发者**覆盖**默认的分组行为。分为三个层面：

**1. 客户端指纹（Client-Side Fingerprint）**

SDK 可以在事件中携带 `fingerprint` 字段。标准用法：

```python
# Python SDK 示例
sentry_sdk.capture_exception(
    error,
    fingerprint=["database-connection-error"]
)
```

所有 `fingerprint=["database-connection-error"]` 的事件会被归入同一个 Issue。

`{{ default }}` 是一个特殊变量，表示"使用默认分组策略的结果"。当 fingerprint 列表中包含 `{{ default }}` 时，模式为**混合模式**——将默认分组的哈希与自定义值拼接后重新哈希（Salted Hash）。

**2. 服务端指纹规则（Server-Side Fingerprinting）**

项目可以在设置中配置服务端指纹规则（`sentry:fingerprinting_rules`），不需要修改代码即可改变事件分组。规则格式类似于增强规则：

```
# 按异常类型和堆栈路径自定义指纹
type:DatabaseError -> database-error

# 按消息内容匹配
logger:myapp.* message:"timeout connecting to *" -> connection-timeout

# 添加自定义标题
tags.function:login error.type:TypeError -> login-error title="Login Error"
```

规则通过 `apply_server_side_fingerprinting` 函数（`src/sentry/grouping/api.py:244-276`）匹配，结果存储在事件的 `_fingerprint_info` 字段中。

**3. 内置指纹规则**

部分平台有内置的指纹规则。当前只有 JavaScript 平台有内置规则（`javascript@2024-02-02`），用于处理常见的 JS 错误模式。

### 6.2.7 完整的分组流程

结合以上所有概念，一个 Event 从接收到分组完成的完整流程如下：

1. **接收原始事件**：由 Relay（Rust 边缘代理）或直接 API 调用接收
2. **规范化（Normalization）**：提取 platform、stacktrace、exception、message 等字段，应用数据清洗规则
3. **加载 Grouping Config**：`get_grouping_config_dict_for_project()` 从项目选项读取 config ID 和增强规则
4. **检查 checksum**：如果事件携带 `checksum` 字段且为 32 字符十六进制，直接使用它作为哈希
5. **应用服务端指纹规则**：`apply_server_side_fingerprinting()` 检查事件是否匹配任何自定义指纹规则
6. **执行分组策略**：`_get_variants_from_strategies()` 按优先级依次运行各策略，首个产生有效结果的策略胜出
7. **组装最终变体**：根据指纹类型决定是使用 `ComponentVariant`、`CustomFingerprintVariant` 还是 `SaltedComponentVariant`
8. **Fallback 保护**：如果没有任何变体贡献，生成 `FallbackVariant`（随机哈希）
9. **写入 GroupHash**：将最终哈希存储到 `GroupHash` 表，关联到 Group
10. **触发 Post-Process**：调用 `post_process_group` 任务，执行告警、通知、升级检测等后续流程

---

## 6.3 Issue 详情页解读

Sentry 的 Issue 详情页（前端路由 `/organizations/:orgSlug/issues/:groupId/`）是日常调试的核心界面。服务端通过 `GroupDetailsEndpoint`（`src/sentry/issues/endpoints/group_details.py`）提供数据，前端据此渲染。

### 6.3.1 Issue 概览属性

详情页顶部展示 Issue 的关键属性，对应 `Group` 模型的核心字段：

| 属性 | 字段来源 | 说明 |
|---|---|---|
| Title | `group.title` / `group.data["title"]` | Issue 标题，由事件类型决定。Error 类型使用 `data.title`，其他类型由 `event_type.get_title()` 生成 |
| Culprit | `group.culprit` | 问题发生的代码位置（文件名/URL），最大长度 200 字符 |
| Level | `group.level` | 严重级别（error、warning、info、fatal、debug），色标区分 |
| Platform | `group.platform` | SDK 平台标识（如 `python`、`javascript`、`java`） |
| Status & SubStatus | `group.status` + `group.substatus` | 当前状态（Unresolved/Resolved/Ignored）+ 细分子状态 |
| Times Seen | `group.times_seen` + `times_seen_pending` | 累计发生次数（含缓冲延迟更新） |
| Users Affected | `group.count_users_seen()` | 受影响的独立用户数，通过 tagstore 查询 |
| First Seen / Last Seen | `group.first_seen` / `group.last_seen` | 首次/最近一次出现时间 |
| First Release / Last Release | `group.get_first_release()` / `group.get_last_release()` | 首次/最近出现所在的版本 |
| Short ID | `group.qualified_short_id` | `PROJECT-XXXX` 格式的短标识 |
| Priority | `group.priority` | Issue 优先级（HIGH/MEDIUM/LOW） |
| Assignee | `group.get_assignee()` | 当前指派人（Team 或 User） |

`times_seen` 的值不是实时精确的——Sentry 使用 Buffer 机制批量累积更新以减少数据库写入压力。因此 API 在返回前会调用 `fetch_buffered_group_stats()` 获取缓冲区中的待处理增量。

### 6.3.2 Event 列表与推荐 Event

每个 Issue 下关联了大量 Events。服务端提供三种 Event 获取方式：

**Latest Event（最新事件）**：通过 `group.get_latest_event()` 获取。使用 Snuba 的 `argMax` 聚合函数从 ClickHouse 查询最新的 event_id。支持按环境过滤。

**Oldest Event（最早事件）**：通过 `group.get_oldest_event()` 获取。按时间升序取第一条，用于了解问题的首次触发条件。

**Recommended Event（推荐事件）**：通过 `group.get_recommended_event()` 获取。这是 Sentry 智能推荐机制的核心，排序权重在 `EventOrdering.RECOMMENDED` 中定义：

```python
# src/sentry/models/group.py:250-257
RECOMMENDED = [
    "-replay.id",       # 优先选择有 Session Replay 的事件
    "-trace.sampled",   # 其次是有 Trace 采样的事件
    "num_processing_errors",  # 处理错误最少的事件优先
    "-profile.id",      # 有 Profiling 数据的事件优先
    "-timestamp",       # 最后按时间排序
    "-id",
]
```

当 `verify_replay_exists=True` 时，推荐逻辑会从候选事件中验证 Replay 数据是否真实存在（`_select_event_with_existing_replay`），确保"View Replay"按钮不会指向不存在的回放。

### 6.3.3 Tags 分布

Tags 是 Sentry 提供的最强大的维度分析工具。Tag 以键值对形式附加在事件上，支持：

- **预定义 Tags**：`environment`、`release`、`level`、`transaction`、`user`、`url`、`server_name`、`os`、`browser` 等
- **自定义 Tags**：SDK 通过 `scope.set_tag()` 或事件直接设置的任意键值对

在服务端，Tags 数据通过 `tagstore` 服务查询。每个 Issue 的 Tags 子页面通过以下端点提供：

- `GroupTagsEndpoint`：列出该 Issue 的所有 Tag key
- `GroupTagKeyValuesEndpoint`：列出某个 Tag key 的所有 distinct 值及计数
- `GroupTagKeyDetailsEndpoint`：按时间序列展示某 Tag key 的分布

Tags 的计数是**去重的**：`tagstore.get_groups_user_counts()` 只统计唯一用户数，而非事件总数，避免重复用户被重复计数。

### 6.3.4 Breadcrumbs 时间线

Breadcrumbs（面包屑）记录了错误发生前用户的一系列操作，是理解问题上下文的关键。每个 Breadcrumb 包含：

- **timestamp**：操作发生时间
- **category**：操作类别（`http`、`navigation`、`ui.click`、`console`、`error`、`device` 等）
- **message**：操作的文字描述
- **level**：级别（debug、info、warning、error）
- **data**：附加的结构化数据（HTTP 请求/响应、DOM 元素、地理位置等）

在 Event 详情页，Breadcrumbs 以时间线形式展示，越靠近错误发生时间的越重要。Sentry 默认显示最近 100 条 Breadcrumb。

### 6.3.5 侧边栏聚合统计

Issue 详情页侧边栏展示多项聚合统计数据，帮助快速评估影响范围：

**Event 频率趋势图**：通过 `GroupStatsEndpoint` 提供，默认展示 24 小时的分钟级或小时级事件计数。后端使用 `tsdb` 服务（时间序列数据库抽象层）查询按时间 bucket 聚合的事件计数。

**首次/最后出现版本**：通过 `GroupFirstLastReleaseEndpoint` 返回。实际查询通过 `Release.objects.get_group_release_version()` 在 Snuba 中执行。

**Related Issues（相关问题）**：通过 `RelatedIssuesEndpoint` 提供，基于两种关联方式：
- **Same Root Cause**：由 `same_root_cause.py` 实现，分析堆栈相似性
- **Trace Connected**：由 `trace_connected.py` 实现，分析共享 Trace 关系

**Similar Issues（相似问题）**：通过 `GroupSimilarIssuesEndpoint` 提供，使用向量嵌入（Embeddings）计算 Issue 之间的相似度。

---

## 6.4 Issue 操作

### 6.4.1 Resolve（解决） {#section-6-4-1-resolve}

Resolve 是 Issue 最常见的管理操作。支持两种方式：

**手动 Resolve**：团队成员在 UI 中点击 Resolve 按钮，触发 `GroupDetailsEndpoint.put()` 方法，调用 `update_groups()` 将状态设为 `RESOLVED`。

**自动 Resolve**：Sentry 可以在新版本发布后自动解决旧 Issue。操作逻辑在 `project_issues_resolved_in_release` 端点处理——当某 Release 被标记为 Deploy 后，Sentry 查找所有在该版本**之前**最后出现且在该版本**之后**未再现的 Issue，将其批量标记为 Resolved。

Resolve 时 `resolved_at` 字段被设置为当前时间，这会在 `update_group_open_period()` 中触发 Issue 打开时段的关闭。

### 6.4.2 Ignore / Archive（忽略 / 归档） {#section-6-4-2-ignore-archive}

Ignore 操作的实现分为两个入口（`src/sentry/issues/status_change.py`）：

**`handle_ignored`（条件忽略）**：处理带有 `ignoreDuration`、`ignoreCount`、`ignoreUserCount` 等条件的忽略。核心是为每个 Issue 创建 `GroupSnooze` 记录：

```python
# src/sentry/issues/ignored.py:118-140 (精简)
for group in group_list:
    state = {}
    if ignore_count and not ignore_window:
        state["times_seen"] = group.times_seen       # 记录当前次数
    if ignore_user_count and not ignore_user_window:
        state["users_seen"] = group.count_users_seen()  # 记录当前用户数

    GroupSnooze.objects.update_or_create(
        group=group,
        defaults={
            "until": ignore_until,        # 时间到期点
            "count": ignore_count,        # 次数阈值
            "window": ignore_window,      # 时间窗口（分钟）
            "user_count": ignore_user_count,
            "user_window": ignore_user_window,
            "state": state,               # 初始状态（用于增量计算）
        },
    )
```

当新事件到达时，`process_snoozes` 调用 `GroupSnooze.is_valid()` 检查忽略条件：

- 计算当前次数与初始状态的差值
- 如果差值超过 `count` 阈值，条件不再满足，Issue 解除忽略
- 同理检查 `user_count`
- 如果 `until` 时间已过，自动解除

**`handle_archived_until_escalating`（升级型归档）**：这是一种特殊的忽略模式。调用 `generate_and_save_forecasts()` 为每个被归档的 Issue 生成预测模型。当 Issue 的事件频率超过预测阈值时，自动升级为 `ESCALATING` 状态，从"归档"回到"未解决"。

Ignore 操作还会触发 `remove_group_from_inbox(group, action=GroupInboxRemoveAction.IGNORED)`，将 Issue 从团队的 Inbox 中移除。

### 6.4.3 Assign（分配） {#section-6-4-3-assign}

Assign 通过 `GroupAssignee` 模型实现。一个 Issue 可以分配给一个 Team 或一个 User。

```python
# 分配查询
def get_assignee(self) -> Team | RpcUser | None:
    group_assignee = GroupAssignee.objects.get(group=self)
    assigned_actor: Actor = group_assignee.assigned_actor()
    return assigned_actor.resolve()
```

分配操作与 Follow/Subscribe 机制联动：当 Team 成员分配 Issue 给自己时，会自动订阅该 Issue 的状态变更通知。

### 6.4.4 Bookmark / Subscribe（标记 / 订阅）

虽然 `bookmark` 字段在 Issue 详情处理中仍然存在，但现代 Sentry 中更重要的概念是**订阅**：

- **显式订阅**：用户通过 UI 点击 Subscribe 按钮，在 `GroupSubscription` 表中创建记录，`reason=GroupSubscriptionReason.status_change`
- **隐式订阅**：当用户处理 Issue（Assign、Comment）时，`GroupSubscription.objects.subscribe()` 自动生效
- **团队订阅**：Issue 被分配给团队时，团队成员可以通过团队级别的设置接收通知

### 6.4.5 Merge（合并） {#section-6-4-5-merge}

Merge 操作将多个 Issue 合并为一个主 Issue，所有子 Issue 的事件都重新关联到主 Issue。

```python
# src/sentry/issues/merge.py:25-74 (关键逻辑)
def handle_merge(group_list, project_lookup, acting_user):
    # 1. 只允许 Error 类型 Issue 合并
    if any(group.issue_category != GroupCategory.ERROR for group in group_list):
        raise ValidationError("Only error issues can be merged.")

    # 2. 选择主 Issue：最早出现 > 最多事件数 > 最小 ID
    group_list_sorted = sorted(
        group_list,
        key=lambda g: (g.first_seen, -g.times_seen, g.id),
    )
    primary_group, groups_to_merge = group_list_sorted[0], group_list_sorted[1:]

    # 3. 通过 eventstream 开始合并，将子 Issue 事件重定向
    eventstream_state = eventstream.backend.start_merge(
        primary_group.project_id, group_ids_to_merge, primary_group.id, primary_group.first_seen
    )

    # 4. 标记子 Issue 为 PENDING_MERGE
    Group.objects.filter(id__in=group_ids_to_merge).update(
        status=GroupStatus.PENDING_MERGE, substatus=None
    )

    # 5. 启动异步合并任务
    start_merge_groups.delay(
        from_object_ids=group_ids_to_merge,
        to_object_id=primary_group.id,
        transaction_id=uuid4().hex,
        eventstream_state=eventstream_state,
    )
```

合并操作依赖异步任务 `start_merge_groups`，它执行以下步骤：
- 更新 Snuba 中所有子 Issue 事件的 `group_id` 指向主 Issue
- 更新 `GroupHash` 表
- 转移 Attachments、User Reports、Comments 到主 Issue
- 创建 `GroupRedirect` 记录，确保旧的 Short ID 可以重定向到新 Issue
- 更新 Tags、计数等聚合数据

### 6.4.6 Delete / Remove（删除） {#section-6-4-6-delete-remove}

删除操作通过 `delete_group_list` 函数处理：

1. 将 Issue 的 `status` 改为 `PENDING_DELETION`
2. 异步任务从 Snuba 中删除所有相关事件
3. 删除 Event Attachments
4. 删除关联数据（GroupAssignee、GroupSnooze、GroupSubscription 等）
5. 最终将 `status` 改为 `DELETION_IN_PROGRESS` 然后从数据库中删除

删除操作在 90 天内可以恢复（事件数据仍在 ClickHouse 的保留期内）。

### 6.4.7 Reprocessing（重处理） {#section-6-4-7-reprocessing}

Reprocessing 允许对已存储的事件重新运行分组算法，适用于：
- 修改了增强规则后希望事件重新分组
- 修复了分组bug后补充分组
- 改变了 Grouping Config 后迁移旧数据

操作通过 `GroupReprocessingEndpoint` 触发，Issue 状态变为 `REPROCESSING`。重处理过程中，新事件不会被添加到该 Group（防止数据交叉污染），完成后旧的 Group 被删除或与命中结果合并。

---

## 6.5 Issue 搜索与过滤

### 6.5.1 搜索查询语法

Sentry 提供了一套丰富的搜索查询语法，用于在 Issues 列表中快速过滤。服务端搜索查询的实现分布在 `src/sentry/issues/search.py`、`src/sentry/issues/issue_search.py` 和 `src/sentry/search/snuba/backend/` 中。

**基础搜索 token：**

| Token | 语法示例 | 说明 |
|---|---|---|
| `is` | `is:unresolved`、`is:resolved`、`is:ignored`、`is:assigned`、`is:unassigned` | Issue 状态过滤 |
| `assigned` | `assigned:me`、`assigned:#team-slug`、`assigned:user@email` | 分配过滤 |
| `bookmarks` | `bookmarks:me` | 已收藏的 Issue |
| `firstRelease` | `firstRelease:1.0.0` | 首次出现的版本 |
| `release` | `release:1.2.0` | 当前版本 |
| `timesSeen` | `timesSeen:>100` | 事件次数（支持比较操作符） |
| `lastSeen` | `lastSeen:-24h` | 最后出现时间 |
| `firstSeen` | `firstSeen:-7d` | 首次出现时间 |
| `event.type` | `event.type:error` | 事件类型 |
| `has` | `has:user`、`has:replay`、`has:profile` | 是否存在某类关联数据 |
| `age` | `age:-24h` | Issue 创建时长 |
| `issue.category` | `issue.category:error`、`issue.category:performance` | Issue 类别 |
| `issue.type` | `issue.type:performance_slow_db_query` | 具体的 Issue 类型 |
| `issue.priority` | `issue.priority:high` | Issue 优先级 |

**自由文本搜索**：不在上述 token 中的文本将被视为全文搜索，匹配 Issue 的 `message`、`title` 和 `culprit` 字段。

**Tag 维度搜索**：任意 Tag Key 都可以作为搜索过滤条件，例如：
- `environment:production`
- `browser.name:Chrome`
- `url:*api/users*`（支持通配符）
- `user.email:user@example.com`

**布尔操作符**：支持 `AND`、`OR`、`NOT`、括号分组和引号括起含空格的 token。

### 6.5.2 预定义搜索与保存视图

Sentry 支持保存搜索条件为"搜索视图"（Search View），通过 `OrganizationGroupSearchViewsEndpoint` 管理。常用预定义视图：

- **All Unresolved**：`is:unresolved` —— 开发者的日常工作入口
- **For Review**：`is:unresolved is:for_review` —— Inbox 视图，显示待审核的 Issue
- **Assigned to Me**：`assigned:me is:unresolved`
- **New Today**：`is:unresolved age:-24h`
- **Ignored**：`is:ignored` —— 被归档的 Issue

保存视图支持加星（Starred），通过 `OrganizationGroupSearchViewDetailsStarredEndpoint` 管理个人偏好。

### 6.5.3 搜索实现架构

搜索请求的处理路径：

1. **API 入口**：`OrganizationGroupIndexEndpoint`（`src/sentry/issues/endpoints/organization_group_index.py`）
2. **构建搜索查询**：`build_query_params_from_request()` 从 URL 参数构建 Snuba 查询
3. **Issue 类型过滤**：`group_types_from()` 和 `group_categories_from()` 分析 `issue.category` 和 `issue.type` 过滤条件，确定需要查询的数据集
4. **数据源路由**：`_query_params_for_error()`、`_query_params_for_performance()` 等函数根据 Issue 类别路由到不同的 Snuba 数据集：

```python
# src/sentry/issues/search.py (精简)
def _query_params_for_error(query_partial, ...):
    """Error 类型 Issue 查询 Events 数据集"""
    return query_partial(
        dataset=Dataset.Events, ...
    )

def _query_params_for_issue_platform(query_partial, ...):
    """Issue Platform 类型使用 IssuePlatform 数据集"""
    return query_partial(
        dataset=Dataset.IssuePlatform, ...
    )
```

5. **Snuba 执行**：查询转换为 ClickHouse SQL，在 Snuba 中执行
6. **结果合并**：多个数据源的结果按 `last_seen` 排序后合并、分页

---

## 6.6 Issue Owners 与自动分配规则

### 6.6.1 Ownership Rules 语法

Issue Owners 功能允许项目定义"谁负责哪部分代码"的规则。当 Issue 包含匹配的堆栈帧路径时，自动识别负责人。规则通过 PEG 语法解析器定义在 `src/sentry/issues/ownership/grammar.py`：

```
# EBNF 语法定义（精简）
ownership = line*
line      = _ (comment / rule / empty)
rule      = _ matcher owners
matcher   = _ matcher_tag identifier
matcher_type = "url" / "path" / "module" / "codeowners" / tags.*
owners    = _ owner*
owner     = _ team_prefix identifier
team_prefix = "#"?
```

**规则示例：**

```text
# 按文件路径分配
path:src/payments/* team-payments@example.com #team-payments

# 按模块分配
module:com.myapp.database.* #backend-team

# 按 URL 分配
url:https://example.com/api/* user@example.com

# 按 Tag 分配
tags.environment:production #on-call
```

Owernship 规则存储在 `ProjectOwnership` 模型（`src/sentry/models/projectownership.py`）中。每个 `Rule` 对象包含一个 `Matcher`（匹配器）和一个 Owner 列表。

### 6.6.2 Code Owners 集成

Sentry 支持与 GitHub/GitLab 的 CODEOWNERS 文件集成。通过 `CodeownersEndpoint` 管理关联，规则来源于仓库中的 `.github/CODEOWNERS` 文件。匹配使用 `codeowners_match()` 函数，将堆栈中的文件路径与 CODEOWNERS 规则模式对比，找到对应的 Team 或 User。

Code Owners 分配产生 `GroupOwnerType.CODEOWNERS` 类型的所有者记录，与 `GroupOwnerType.OWNERSHIP_RULE` 区分，确保在处理 diff 时可以识别来源并正确删除过时记录。

### 6.6.3 自动分配流程

自动分配在 Post-Process 流水线中触发，分为两个步骤：

**Step 1: `handle_owner_assignment`（`src/sentry/tasks/post_process.py:189-299`）**

```python
def handle_owner_assignment(job: PostProcessJob) -> None:
    # 1. 检查 Issue 是否已有 Assignee（有则跳过）
    if assignee_exists:
        return

    # 2. 检查防抖：一天内同一 Issue 不重复评估
    issue_owners_debounce_time = cache.get(ISSUE_OWNERS_DEBOUNCE_KEY(group.id))
    if issue_owners_debounce_time is not None:
        return

    # 3. 检查频率限制：每项目默认每分钟最多 50 个 Issue
    if should_issue_owners_ratelimit(project_id, group_id, org_id):
        return

    # 4. 调用 ProjectOwnership.get_issue_owners() 获取匹配的所有者
    issue_owners = ProjectOwnership.get_issue_owners(project.id, event.data)

    # 5. 存储所有关系
    handle_group_owners(project, group, issue_owners)
```

`get_issue_owners()` 从事件数据中提取堆栈帧的文件路径，依次与 Ownership Rules 匹配：
- `path` 匹配器使用 `glob_match` 进行通配符匹配
- `module` 匹配器对 Java/Python 等语言的模块路径进行匹配
- `url` 匹配器对请求 URL 进行匹配
- `codeowners` 匹配器委托给 `codeowners_match()`
- `tags.*` 匹配器直接匹配事件的 Tag

**Step 2: `handle_auto_assignment`（`src/sentry/tasks/post_process.py:1132-1150`）**

如果 Issue 新创建且没有手动分配，`ProjectOwnership.handle_auto_assignment()` 可能会自动分配 Issue 给匹配的 Owner。

### 6.6.4 Suspect Commits 与嫌疑提交

除了 Ownership Rules，Sentry 还可以通过 **Suspect Commits**（嫌疑提交）机制关联 Issue 到具体的 Git 提交。在 `process_commits` 函数中（`post_process.py:1051-1129`）：

1. 从事件堆栈帧中提取文件路径（`get_frame_paths()`）
2. 检查组织是否配置了 GitHub/GitLab 集成（Source Code Management）
3. 如果有 SCM 集成：调用 `process_commit_context.delay()` 使用 Blame 功能找到引入错误的提交
4. 如果没有 SCM 集成：回退到 `process_suspect_commits.delay()`，基于版本间的文件变更推测嫌疑提交

找到的嫌疑提交存储在 `GroupOwner` 表中，类型为 `GroupOwnerType.SUSPECT_COMMIT`，可通过 `group.get_suspect_commit()` 查询。

---

## 6.7 Issue 平台（Issue Platform）

### 6.7.1 Issue Occurrence 模型

传统的 Error Issue 是通过 Event 经过 Grouping 自动创建的。但对于 **非 Error 类型**的 Issue（Performance、Cron、Replay、Uptime 等），它们的产生方式不同——这些 Issue 通常由检测器（Detector）主动发现后创建。

为了统一这个流程，Sentry 设计了 **Issue Occurrence** 模型（`src/sentry/issues/issue_occurrence.py`）：

```python
class IssueOccurrenceData(TypedDict):
    id: str                    # 唯一标识
    project_id: int
    event_id: str              # 关联的 Event ID
    fingerprint: Sequence[str] # 分组指纹
    issue_title: str           # Issue 标题
    subtitle: str              # Issue 副标题
    resource_id: str | None    # 资源标识（如 URL、Monitor ID）
    evidence_data: Mapping[str, Any]      # 证据数据
    evidence_display: Sequence[IssueEvidenceData]  # 证据展示数据
    type: int                  # GroupType ID
    detection_time: float
    level: str | None
    culprit: str | None
```

Occurrence 通过 Kafka 消息队列提交，被 `occurrence_consumer` 消费后创建 Group 并关联 Event。在 Post-Process 中，如果 `occurrence_id` 不为空，任务会跳过传统的 event_processing_store 读取，转而通过 `IssueOccurrence.fetch()` 获取数据。

Evidence（证据）是 Occurrence 的核心展示概念，包含：
- **evidence_data**：键值对数据（如 `{"op": "db", "description": "SELECT * FROM ..."}`）
- **evidence_display**：结构化的展示列表，每项包含 `name`、`value` 和 `important`（是否重点展示）

### 6.7.2 各类 Issue 类型全景

Sentry 将所有 Issue 类型通过 `GroupTypeRegistry` 注册表统一管理（`src/sentry/issues/grouptype.py`）。目前已注册的类型包括：

**Performance Issues（性能问题）：**

| 类型 ID | Slug | 说明 | 类别 |
|---|---|---|---|
| 1001 | `performance_slow_db_query` | 慢数据库查询 | DB_QUERY |
| 1004 | `performance_render_blocking_asset_span` | 大型渲染阻塞资源 | FRONTEND |
| 1006 | `performance_n_plus_one_db_queries` | N+1 数据库查询 | DB_QUERY |
| 1007 | `performance_consecutive_db_queries` | 连续数据库查询 | DB_QUERY |
| 1008 | `performance_file_io_main_thread` | 主线程文件 I/O | MOBILE |
| 1009 | `performance_consecutive_http` | 连续 HTTP 请求 | HTTP_CLIENT |
| 1010 | `performance_n_plus_one_api_calls` | N+1 API 调用 | HTTP_CLIENT |
| 1011 | `performance_m_n_plus_one_db_queries` | M:N+1 数据库查询 | DB_QUERY |
| 1012 | `performance_uncompressed_assets` | 未压缩的资源 | FRONTEND |
| 1013 | `performance_db_main_thread` | 主线程数据库操作 | MOBILE |
| 1015 | `performance_large_http_payload` | 大型 HTTP 载荷 | HTTP_CLIENT |
| 1016 | `performance_http_overhead` | HTTP/1.1 开销 | HTTP_CLIENT |
| 1018 | `performance_p95_endpoint_regression` | P95 端点性能回归 | METRIC |
| 1020 | `db_query_injection_vulnerability` | 潜在数据库查询注入漏洞 | DB_QUERY |

**Profile Issues（性能剖析问题）：**

| 类型 ID | Slug | 说明 | 类别 |
|---|---|---|---|
| 2001 | `profile_file_io_main_thread` | 主线程文件 I/O | MOBILE |
| 2002 | `profile_image_decode_main_thread` | 主线程图片解码 | MOBILE |
| 2003 | `profile_json_decode_main_thread` | 主线程 JSON 解码 | MOBILE |
| 2007 | `profile_regex_main_thread` | 主线程正则表达式 | MOBILE |
| 2009 | `profile_frame_drop` | 帧丢失 | MOBILE |
| 2011 | `profile_function_regression` | 函数性能回归 | METRIC |

**Replay Issues（回放问题）：**

| 类型 ID | Slug | 说明 | 类别 |
|---|---|---|---|
| 5002 | `replay_click_rage` | Rage Click 检测（用户反复疯狂点击） | FRONTEND |
| 5003 | `replay_hydration_error` | 水合错误（SSR 与 CSR 不匹配） | FRONTEND |

**Cron Monitor Issues（定时任务监控）：**

| 类型 ID | Slug | 说明 | 类别 |
|---|---|---|---|
| 4001 | `monitor_check_in_failure` | 定时任务执行失败 | OUTAGE |
| （动态生成） | `monitor_check_in_timeout` | 定时任务超时 | OUTAGE |
| （动态生成） | `monitor_check_in_missed` | 定时任务未触发 | OUTAGE |

**Uptime Issues（可用性监控）：**

| 类型 ID | Slug | 说明 | 类别 |
|---|---|---|---|
| （动态生成） | `uptime_domain_check_failure` | 域名检查失败 | OUTAGE |

**Metric Issues（指标告警问题）：**

由 `MetricIssue` 类承载（`src/sentry/incidents/grouptype.py`），代表**指标告警检测器**触发时创建的 Issue。这些 Issue 与 `Detector` 模型关联，通过 `detector_id` 参数追踪。

**AI Detected Issues（AI 检测问题）：**

| 类型 ID | Slug | 说明 | 类别 |
|---|---|---|---|
| 3501-3508 | `llm_detected_*` / `ai_detected_*` | LLM 自动检测的问题（实验性） | AI_DETECTED / HTTP_CLIENT / DB_QUERY |

### 6.7.3 Issue Category 分类体系

`GroupCategory` 枚举（`src/sentry/issues/grouptype.py:31-83`）定义了 Issue 的顶层分类。当前版本正在从旧的粗粒度分类迁移到新的细粒度分类：

| 旧分类（部分已废弃） | 新分类 | 说明 |
|---|---|---|
| `ERROR (1)` | （保留） | 传统异常/错误 |
| `PERFORMANCE (2)` | `DB_QUERY (12)`、`FRONTEND (14)`、`MOBILE (15)`、`HTTP_CLIENT (13)` | 性能问题拆分为四个子类别 |
| `PROFILE (3)` | 合并到 `MOBILE (15)` | Profiling 问题合并到 Mobile |
| `CRON (4)` | `OUTAGE (10)` | Cron 问题归入中断类 |
| `REPLAY (5)` | `FRONTEND (14)` | Replay 问题归入前端 |
| `FEEDBACK (6)` | （保留） | 用户反馈 |
| `UPTIME (7)` | `OUTAGE (10)` | Uptime 问题归入中断类 |
| `METRIC_ALERT (8)` | `METRIC (11)` | 指标告警 |
| `CONFIGURATION (19)` | （新） | SDK/工具配置问题 |
| `PREPROD (17)` | （新） | 预生产问题（构建产物分析） |
| `AI_DETECTED (16)` | （新） | AI 检测问题 |

这个分类不仅影响 UI 展示，还直接影响搜索、告警规则的数据集路由。搜索查询中的 `issue.category` 过滤条件会通过 `group_categories_from()` 函数转换为具体的数据集选择。

### 6.7.4 Noise Reduction 与创建配额

Sentry 为 Issue 创建内置了**噪声控制**（Noise Reduction）机制，通过 `NoiseConfig` 数据类配置：

```python
@dataclass(frozen=True)
class NoiseConfig:
    ignore_limit: int = DEFAULT_IGNORE_LIMIT  # 默认 3
    expiry_time: timedelta = DEFAULT_EXPIRY_TIME  # 默认 24 小时
```

当某 GroupHash 的事件数未达到 `ignore_limit` 时，Sentry **不会创建 Issue**，而是等待。如果 24 小时内仍达不到阈值，计数器过期。这个机制通过 Redis 计数器实现：

```python
# src/sentry/issues/grouptype.py:791-820
def should_create_group(grouptype, client, grouphash, project):
    key = f"grouphash:{grouphash}:{project.id}"
    times_seen = client.incr(key)

    noise_config = grouptype.noise_config
    if not noise_config:
        return True  # 没有限制，立即创建

    over_threshold = times_seen >= noise_config.ignore_limit
    if over_threshold:
        client.delete(key)
        return True  # 达到阈值，创建 Issue
    else:
        client.expire(key, noise_config.expiry_seconds)
        return False  # 尚未达到，等待
```

不同 Issue 类型有不同的阈值配置。例如：
- Performance Slow DB Query：`ignore_limit=100`（需要 100 次才创建）
- Performance N+1 Query：`ignore_limit=3`（默认值）
- Profile Frame Drop：`ignore_limit=2000`（极高阈值，避免噪音）
- Consecutive HTTP：`ignore_limit=5`

此外，每种 Issue 类型还有**创建配额**（`creation_quota`），由 `Quota` 类控制（默认 5 个/小时，滑动窗口 60 秒）。Cron Monitor Issue 例外，配额为 60,000 个/小时。

---

## 6.8 告警规则关联

### 6.8.1 Issue Alert Rules 的创建

Issue Alert Rules 是 Sentry 告警体系的基础。当 Issue 的状态发生变化（新建、回归、升级等），符合规则的 Issue 会触发通知。告警规则通过 Workflow Engine（`src/sentry/workflow_engine/`）驱动。

在 Post-Process 流程的最后阶段，`process_workflow_engine` 函数被调用（`post_process.py:977-1010`），将事件发送到 Workflow Engine：

```python
def process_workflow_engine(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return
    if not job["event"].group.is_unresolved():
        return  # 只对 Unresolved 的 Issue 处理

    process_workflows_event.apply_async(
        kwargs=dict(
            event_id=job["event"].event_id,
            occurrence_id=job["event"].occurrence_id,
            group_id=job["event"].group_id,
            group_state=job["group_state"],       # is_new, is_regression
            has_reappeared=job["has_reappeared"],
            has_escalated=job["has_escalated"],
        ),
    )
```

### 6.8.2 告警条件类型

告警规则的条件可以基于 Issue 的多种属性：

| 条件类别 | 示例条件 | 说明 |
|---|---|---|
| **状态变更** | Issue 首次创建 | `group_state.is_new == True` |
| **状态变更** | Issue 回归 | `group_state.is_regression == True` |
| **状态变更** | Issue 升级 | `has_escalated == True` |
| **状态变更** | Issue 恢复出现 | `has_reappeared == True` |
| **属性过滤** | `issue.category` 为特定值 | 只针对特定类别的 Issue |
| **属性过滤** | `level` 大于等于 error | 只对严重错误告警 |
| **属性过滤** | `event.type` 匹配 | 只对特定事件类型告警 |
| **频率条件** | 事件数超过 X 次 | 频率触发 |
| **频率条件** | 受影响用户数超过 Y 人 | 用户影响触发 |
| **环境过滤** | `environment` 为 production | 只对生产环境告警 |

### 6.8.3 Post-Process 中的告警触发

Post-Process 的完整流水线（`GROUP_CATEGORY_POST_PROCESS_PIPELINE` 在 `post_process.py:1589-1625`）中，与告警直接相关的步骤：

```python
GroupCategory.ERROR: [
    _capture_group_stats,       # 1. 捕获 Issue 统计
    process_snoozes,            # 2. 处理忽略/归档状态（可能触发升级）
    process_inbox_adds,         # 3. 添加到 Inbox
    process_malicious_issue_detection, # 4. 恶意问题检测
    detect_new_escalation,      # 5. 新 Issue 升级检测
    process_commits,            # 6. 嫌疑提交检测
    handle_owner_assignment,    # 7. Issue Owner 分配
    handle_auto_assignment,     # 8. 自动分配
    kick_off_seer_automation,   # 9. AI 自动化（Autofix）
    kick_off_lightweight_rca_cluster, # 10. 轻量根因聚类
    process_workflow_engine,    # 11. 工作流引擎（告警规则匹配）
    process_resource_change_bounds,   # 12. 资源变更边界（Webhook）
    process_data_forwarding,    # 13. 数据转发
    process_code_mappings,      # 14. 代码映射
    process_similarity,         # 15. 相似度索引
    ...
]
```

非 Error 类别的 Issue 使用 `GENERIC_POST_PROCESS_PIPELINE`：

```python
GENERIC_POST_PROCESS_PIPELINE = [
    process_snoozes,
    process_inbox_adds,
    kick_off_seer_automation,
    process_workflow_engine,     # <-- 告警在此触发
    process_resource_change_bounds,
    process_data_forwarding,
]
```

两者的关键差异在于 Error 类型的流水线有更多步骤（commits、owners、similarity 等），而通用流水线保持精简。

---

## 6.9 Issue 数据导出与 API

### 6.9.1 REST API 端点概览

Sentry 提供了完整的 REST API 用于 Issue 管理。以下是核心端点的概览（全部定义在 `src/sentry/issues/endpoints/` 下）：

**Issue 列表与搜索：**

| 端点 | HTTP 方法 | 说明 |
|---|---|---|
| `/api/0/organizations/{org}/issues/` | GET | 搜索 Issue 列表 |
| `/api/0/organizations/{org}/issues/` | PUT | 批量更新 Issue |
| `/api/0/organizations/{org}/issues/` | DELETE | 批量删除 Issue |
| `/api/0/projects/{org}/{project}/issues/` | GET | 项目级别的 Issue 列表 |
| `/api/0/organizations/{org}/issues-count/` | GET | Issue 数量统计 |

**Issue 详情：**

| 端点 | HTTP 方法 | 说明 |
|---|---|---|
| `/api/0/issues/{issue_id}/` | GET | 获取 Issue 详情 |
| `/api/0/issues/{issue_id}/` | PUT | 更新 Issue（状态、分配等） |
| `/api/0/issues/{issue_id}/` | DELETE | 删除 Issue |
| `/api/0/organizations/{org}/issues/{issue_id}/events/` | GET | 列出 Issue 下的 Events |
| `/api/0/issues/{issue_id}/events/{event_id}/` | GET | 获取特定 Event 详情 |
| `/api/0/issues/{issue_id}/events/recommended/` | GET | 获取推荐 Event |
| `/api/0/issues/{issue_id}/events/oldest/` | GET | 获取最早 Event |
| `/api/0/issues/{issue_id}/events/latest/` | GET | 获取最新 Event |

**Issue 关联数据：**

| 端点 | HTTP 方法 | 说明 |
|---|---|---|
| `/api/0/issues/{issue_id}/tags/` | GET | 列出 Tag Keys |
| `/api/0/issues/{issue_id}/tags/{key}/` | GET | 获取 Tag Key 详情（时间序列分布） |
| `/api/0/issues/{issue_id}/tags/{key}/values/` | GET | 列出 Tag Key 的所有值 |
| `/api/0/issues/{issue_id}/hashes/` | GET | 列出 GroupHash 记录 |
| `/api/0/issues/{issue_id}/stats/` | GET | 获取时间序列统计 |
| `/api/0/issues/{issue_id}/notes/` | GET/POST | Issue 评论 |
| `/api/0/issues/{issue_id}/attachments/` | GET | Issue 附件 |
| `/api/0/issues/{issue_id}/similar-issues/` | GET | 相似 Issue |
| `/api/0/issues/{issue_id}/user-reports/` | GET | 用户反馈 |
| `/api/0/issues/{issue_id}/first-last-release/` | GET | 首次/最后版本 |
| `/api/0/issues/{issue_id}/current-release/` | GET | 当前版本 |

**Issue 操作：**

| 端点 | HTTP 方法 | 说明 |
|---|---|---|
| `/api/0/issues/{issue_id}/merge/` | PUT | 合并 Issue |
| `/api/0/issues/{issue_id}/reprocessing/` | POST | 触发重处理 |
| `/api/0/projects/{org}/{project}/issues/{issue_id}/` | PUT | 更新 Issue（项目作用域） |

**Issue Owners：**

| 端点 | HTTP 方法 | 说明 |
|---|---|---|
| `/api/0/projects/{org}/{project}/ownership/` | GET/PUT | 获取/设置 Ownership 规则 |
| `/api/0/projects/{org}/{project}/codeowners/` | GET/POST | Codeowners 配置 |
| `/api/0/projects/{org}/{project}/codeowners/{id}/` | PUT/DELETE | 更新/删除 Codeowners |

**搜索视图：**

| 端点 | HTTP 方法 | 说明 |
|---|---|---|
| `/api/0/organizations/{org}/search-views/` | GET/POST | 搜索视图列表 |
| `/api/0/organizations/{org}/search-views/{id}/` | GET/PUT/DELETE | 搜索视图详情 |

### 6.9.2 批量操作与游标分页

**批量操作**通过 `update_groups()` 和 `delete_group_list()` 函数（定义在 `src/sentry/api/helpers/group_index/`）支持。批量更新支持搜索查询作为过滤条件——这意味着你可以用同一搜索条件选中所有匹配的 Issue 后执行批量 Resolve/Ignore/Delete。

**游标分页**使用 `Cursor` 类（`src/sentry/utils/cursors.py`）实现。不同于传统的页码偏移分页，Sentry 使用 `DateTimePaginator` 基于 `last_seen` 时间戳进行游标分页，优势是在数据不断变化（新 Issue 不断创建）的情况下，不会出现重复或遗漏。

API 的完整文档在 Sentry 服务器运行后可通过 `/api/0/` 的 Swagger/OpenAPI 界面浏览，所有端点的请求参数、响应格式和示例均自动生成。

---

**本章小结**：Issue 是 Sentry 错误监控的核心抽象，连接了原始事件数据与开发者的日常工作流。从事件到来时的分组算法（Grouping Strategies），到 Issue 状态的精细管理（GroupStatus + GroupSubStatus），再到自动分配、告警触发和 API 集成，整个体系构成了一个完整的闭环。理解这些底层机制，能够帮助开发团队更精准地配置分组规则，更高效地管理问题生命周期，以及更好地利用 API 实现自定义工作流集成。
