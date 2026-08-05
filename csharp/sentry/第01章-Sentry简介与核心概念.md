---
layout: default
title: 第一章：Sentry 简介与核心概念
---

# 第一章：Sentry 简介与核心概念

- [1.1 什么是 Sentry](#11-什么是-sentry)
- [1.2 发展历史与版本演进](#12-发展历史与版本演进)
- [1.3 核心概念](#13-核心概念)
  - [1.3.1 Event（事件）](#131-event事件)
  - [1.3.2 Issue / Group（问题）](#132-issue--group问题)
  - [1.3.3 Project（项目）](#133-project项目)
  - [1.3.4 Organization（组织）](#134-organization组织)
  - [1.3.5 DSN（数据源名称）](#135-dsn数据源名称)
  - [1.3.6 Transaction 与 Span（事务与跨度）](#136-transaction-与-span事务与跨度)
  - [1.3.7 其他重要概念](#137-其他重要概念)
- [1.4 Sentry 与其他 APM 工具对比](#14-sentry-与其他-apm-工具对比)
- [1.5 Sentry 开源协议与商业模式](#15-sentry-开源协议与商业模式)

---

## 1.1 什么是 Sentry

Sentry 是当前业界使用最广泛的实时错误监控与调试平台。其官方定义简洁而准确：

> Users and logs provide clues. Sentry provides answers.
> （用户和日志提供线索。Sentry 提供答案。）

从技术实现的角度，Sentry 是一个**全栈应用性能监控（APM）与错误追踪系统**。它由服务器端（Sentry Server）和众多语言的客户端 SDK（Sentry SDK）共同组成。SDK 嵌入到你的应用程序中，在运行时自动捕获未处理的异常、程序崩溃、性能瓶颈、用户反馈等信息，将其序列化后发送到 Sentry 服务器；服务器端负责接收、存储、聚合、去重、告警以及可视化展示。

Sentry 的核心能力远不止"错误日志收集"。截至当前版本（v26.8.0-dev），它已经演进为覆盖以下领域的综合可观测性平台：

| 能力模块 | 说明 |
|---|---|
| **Issue Tracking** | 自动聚合重复错误，按堆栈指纹去重，形成可追踪的 Issue |
| **Performance Monitoring** | 基于分布式追踪（Distributed Tracing）的事务和 Span 性能分析 |
| **Session Replay** | 以类视频回放方式重现用户出错的完整操作过程 |
| **Cron Monitoring** | 监控定时任务（Cron Job）的执行状态与耗时 |
| **Release Health** | 追踪每个版本的会话数据、崩溃率、采纳率 |
| **User Feedback** | 收集用户主动提交的反馈信息并与 Error/Transaction 关联 |
| **Profiling** | 生产环境下的代码级性能剖析 |
| **Uptime Monitoring** | 对 URL 端点进行可用性检测 |
| **Autofix (AI)** | 利用 LLM 分析 Issue 上下文并自动生成修复建议或 Pull Request |

从架构上看，Sentry 服务端是一个基于 **Django 5.2** 框架的大型 Python 应用（`pyproject.toml` 中 `django>=5.2.14`），需要 Python 3.13 及以上版本运行。它依赖的基础设施组件包括：

- **PostgreSQL**：存储元数据（Organization、Project、Group、User 等关系型数据）
- **ClickHouse（通过 Snuba）**：存储和查询海量事件数据（`snuba-sdk>=3.0.43`）
- **Redis**：缓存和消息队列（`redis>=3.4.1`）
- **Kafka**：事件流处理（`confluent-kafka>=2.8.0`）
- **Relay**：一个用 Rust 编写的独立边缘服务，负责 SDK 请求的鉴权、限流、数据清洗和事件规范化（`sentry-relay>=0.9.27`）
- **Symbolicator**：原生崩溃符号解析服务

在代码库中，核心的事件处理入口是 `src/sentry/event_manager.py`（约 2800 行的关键模块），它负责将 SDK 上报的原始数据转化为统一的 Event 对象，执行分组哈希计算、存储到 Nodestore 和 Snuba，并触发后续的告警和通知流程。

---

## 1.2 发展历史与版本演进

Sentry 的起源可以追溯到 2008 年。当时 Sentry 创始人 David Cramer 在开发 Django 项目时，受够了缺少好用的错误追踪工具，于是编写了一个 Django 应用层面的错误日志记录模块，最初命名为 **django-db-log**。这个项目在 Django 社区迅速流行起来。

### 关键里程碑

| 时间 | 里程碑 | 说明 |
|---|---|---|
| 2008 | 项目诞生 | David Cramer 创建 django-db-log，一个 Django 错误日志应用 |
| 2010 | 更名为 Sentry | 项目脱离 Django 绑定，更名为 Sentry，2.0 版本发布 |
| 2012 | 成立公司 | Functional Software, Inc. 成立（Sentry 背后的公司实体），提供 SaaS 服务 sentry.io |
| 2013 | Sentry 5.x | 引入插件系统，支持多种第三方集成 |
| 2016 | Sentry 8.x | 重大架构重构，引入 Nodestore 抽象、Snuba（ClickHouse）查询层 |
| 2017 | Sentry 9.x | 引入 Relay（Rust 边缘代理），实现 SDK 请求的高性能前置处理 |
| 2019 | Sentry 10.x | 引入 Performance Monitoring（事务/跨度追踪），从纯错误监控迈向 APM |
| 2021 | Sentry 21.x | 版本号策略变更为 CalVer（日历化版本），引入 Session Replay、Profiling |
| 2023 | Sentry 23.x | 引入 AI 辅助分析（Seer/Autofix），发布 FSL 开源协议 |
| 2025 | Sentry 25.x | 引入 Uptime Monitoring、Issue Priority（优先级自动分级）、Code Review 事件 |
| 2026 | Sentry 26.x | 进一步深化 AI 能力（Autofix 支持 PR 审查反馈、Smart Assignment），新的 Issue 分类体系（DB_QUERY、FRONTEND、MOBILE 等精细分类），引入新的 Inbox 视图 |

### 版本号策略

自 2021 年起，Sentry 转向**日历化版本（CalVer）**，格式为 `YY.MINOR.PATCH`。当前版本为 **26.8.0.dev0**（来自 `setup.cfg`）。这意味着：

- 主版本号 `26` 对应年份 2026
- 次要版本号 `8` 表示当年的第 8 个次要发布
- 补丁版本号和 `.dev0` 后缀表示开发中状态

代码库变更记录在 `CHANGES` 文件中，该文件目前已积累超过 23,000 行，记录了从早期版本到最新 `26.7.2` 的每一项功能、修复和改进。

### 当前技术栈概览

从 `pyproject.toml` 可以一窥 Sentry 服务端的完整技术栈：

- **Web 框架**：Django 5.2 + Django REST Framework 3.16
- **数据库驱动**：asyncpg、psycopg2-binary（PostgreSQL 异步+同步双驱动）
- **序列化**：orjson（快速 JSON）、msgpack、msgspec
- **消息队列**：confluent-kafka、sentry-arroyo（自有 Kafka 流处理框架）
- **对象存储**：boto3（AWS S3）、google-cloud-storage
- **AI/ML**：openai、tiktoken、tokenizers
- **前端**：React + TypeScript（`package.json`、`tsconfig.json` 表明独立的前端构建体系）
- **辅助服务**：sentry-relay（Rust 边缘代理）、snuba-sdk（ClickHouse 查询）

---

## 1.3 核心概念

理解 Sentry 的核心概念是有效使用它的前提。这些概念在 Sentry 代码库中有明确定义——不仅有对应的 Django Model 类，还有严格的序列化器、API 端点和权限控制。以下逐一深入分析。

### 1.3.1 Event（事件）

Event 是 Sentry 中最基本的数据单元。每当 SDK 捕获到一次异常、一次崩溃或一条性能数据，它就会生成一个 Event 并发送到 Sentry 服务器。

#### 事件的数据结构

在代码中，Event 的数据由 `EventDict` 类包装（`src/sentry/models/event.py:14`），它是 Python 的 `MutableMapping` 子类，在创建实例时会自动通过 Rust 编写的 `StoreNormalizer` 进行 schema 校验和数据规范化（re-normalization）：

```python
class EventDict(MutableMapping[str, V]):
    """
    Creating an instance of this dictionary will send the event through basic
    (Rust-based) type/schema validation called "re-normalization".
    """
```

Event 的运行时模型定义在 `src/sentry/services/eventstore/models.py` 中。一个 Event 携带的核心字段包括（部分字段同时存储在 Snuba/ClickHouse 中以支持快速查询）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `event_id` | `str` | 全局唯一的事件 ID（UUID 十六进制格式） |
| `project_id` | `int` | 所属 Project 的 ID |
| `group_id` | `int or None` | 所属 Group（Issue）的 ID |
| `timestamp` / `datetime` | `datetime` | 事件发生时间，优先使用毫秒精度 |
| `platform` | `str` | SDK 平台标识（如 `python`、`javascript`、`dotnet`） |
| `message` | `str` | 日志消息，取自 `logentry.formatted` 或 `logentry.message` |
| `culprit` | `str` | 问题根源的摘要（如模块名+函数名） |
| `tags` | `list[tuple[str, str]]` | 键值对形式的标签，用于分类和过滤 |
| `release` | `str` | 通过 `sentry:release` tag 获取（版本号） |
| `transaction` | `str` | 事务名称（性能追踪时使用） |
| `trace_id` | `str` | 分布式追踪的 Trace ID，取自 `contexts.trace.trace_id` |
| `user` | `User interface` | 用户信息（id、email、username、ip_address），可来自 Snuba 或 raw data |
| `title` | `str` | 事件标题（如异常类型: 异常消息） |

#### 事件类型

Sentry 通过 `eventtypes` 模块定义了一套事件类型体系（`src/sentry/eventtypes/base.py`）。类型检测由 Relay（Rust）完成，服务端通过 `data.get("type")` 读取：

```python
EventTypeStr = Literal[
    "default",    # 默认类型（自定义事件）
    "error",      # 异常/错误事件
    "csp",        # 内容安全策略违规
    "nel",        # 网络错误日志
    "hpkp",       # HTTP 公钥固定违规
    "expectct",   # 证书透明度违规
    "expectstaple", # OCSP Stapling 违规
    "transaction",  # 事务/性能事件
    "generic",    # 通用事件（issue platform）
    "feedback",   # 用户反馈事件
]
```

每种事件类型都有对应的 Python 类（如 `ErrorEvent`、`TransactionEvent`、`DefaultEvent` 等），负责提取元数据（`extract_metadata`）、生成标题（`get_title`）和定位信息（`get_location`）。

#### 事件接口（Interfaces）

Sentry 将事件中结构化的子数据称为 **Interface**（接口），定义在 `src/sentry/interfaces/` 目录下。这是一套可插拔的数据解析和渲染体系：

| Interface | 文件 | 说明 |
|---|---|---|
| `Stacktrace` | `stacktrace.py` | 调用堆栈（frames list） |
| `Exception` | `exception.py` | 异常信息（type、value、stacktrace） |
| `Breadcrumbs` | `breadcrumbs.py` | 用户操作面包屑（事件发生前的操作序列） |
| `Contexts` | `contexts.py` | 运行时上下文（os、runtime、device、browser 等） |
| `Http` | `http.py` | HTTP 请求上下文（url、method、headers、cookies） |
| `User` | `user.py` | 用户信息（id、email、ip_address） |
| `Spans` | `spans.py` | 分布式追踪 Span 列表 |
| `Template` | `template.py` | 模板引擎上下文（Django 模板等） |
| `SDK` | `sdk.py` | SDK 自身信息（名称、版本、集成包列表） |
| `Threads` | `threads.py` | 线程信息 |
| `DebugMeta` | `debug_meta.py` | 调试元信息（用于符号化） |

这些 Interface 以 JSON 形式存储在 Nodestore 中，在从 API 读取事件时动态解析和渲染。Interface 之间可以互相嵌套（例如 `Exception` 包含 `Stacktrace`，`Stacktrace` 又引用 `DebugMeta`）。

### 1.3.2 Issue / Group（问题）

Issue（在代码中称为 **Group**）是 Sentry 最核心的聚合概念。简单来说，**Issue 是将相同根因的事件自动分组后形成的一个可追踪问题实体**。

#### Group 的数据库模型

在 `src/sentry/models/group.py:848` 中，Group 定义为 Django Model：

```python
class Group(Model):
    """
    Aggregated message which summarizes a set of Events.
    """
    project = FlexibleForeignKey("sentry.Project")
    logger = models.CharField(max_length=64, default="")
    level = BoundedPositiveIntegerField(default=logging.ERROR)
    message = models.TextField()
    culprit = models.CharField(max_length=200)
    platform = models.CharField(max_length=64)
    status = BoundedPositiveIntegerField(default=GroupStatus.UNRESOLVED)
    times_seen = BoundedPositiveIntegerField(default=1)
    last_seen = models.DateTimeField(default=timezone.now)
    first_seen = models.DateTimeField(default=timezone.now)
    time_spent_total = BoundedIntegerField(default=0)
    short_id = BoundedBigIntegerField(null=True)
    type = BoundedPositiveIntegerField()       # GroupType.type_id
    priority = models.PositiveIntegerField(null=True)
    # ...更多字段
```

关键字段解读：

- **`status`**：问题状态，包括 `UNRESOLVED`（未解决）、`RESOLVED`（已解决）、`IGNORED`（已忽略）。`substatus` 提供了更精细的状态：`ONGOING`（持续中）、`ESCALATING`（升级中）、`FOREVER`（永久忽略）等。
- **`times_seen`**：该 Issue 累计发生次数（去重后的事件数）。
- **`short_id`**：短标识符，与 Project slug 组合生成 `PROJ-ABCD` 格式的可读 ID（`qualified_short_id` 属性）。
- **`type`**：Group 的类型 ID，对应 `GroupType.type_id`，决定该 Issue 属于哪种分类。
- **`priority`**：由 ML 模型（Seer）自动计算的优先级分数。
- **`seer_fixability_score`**：AI 评估的可修复性分数。

#### 分组（Grouping）机制

事件到 Issue 的分组是 Sentry 最关键的算法之一。核心思想是：对每个 Event 的数据计算一个**哈希指纹（Hash）**，相同指纹的事件归入同一个 Group。这个过程由 `src/sentry/event_manager.py` 中的分组管道完成：

1. `run_primary_grouping` -- 使用主分组配置计算哈希
2. `get_or_create_grouphashes` -- 将哈希存储并关联到 Group
3. `maybe_run_secondary_grouping` -- 当主分组配置变更时，同时计算旧配置的哈希以平滑迁移
4. `maybe_check_seer_for_matching_grouphash` -- 利用 ML 模型（Seer）辅助匹配

分组策略（Grouping Strategy）定义在 `src/sentry/grouping/strategies/` 中，支持多种指纹算法：基于堆栈的 `stacktrace` 分组、基于消息的 `message` 分组等。

#### Issue 类别（GroupCategory）

随着平台扩展，Sentry 的 Issue 分类体系日益丰富。在 `src/sentry/issues/grouptype.py` 中，`GroupCategory` 定义了以下类别：

| 类别 | 值 | 说明 |
|---|---|---|
| `ERROR` | 1 | 错误事件（传统的异常/崩溃） |
| `PERFORMANCE` | 2 | 性能问题（已逐步拆分） |
| `CRON` | 4 | 定时任务异常（正在迁移到 OUTAGE） |
| `REPLAY` | 5 | Session Replay 相关问题 |
| `FEEDBACK` | 6 | 用户反馈 |
| `UPTIME` | 7 | 可用性检测告警 |
| `METRIC_ALERT` | 8 | 指标告警 |
| `OUTAGE` | 10 | 服务中断（新分类） |
| `METRIC` | 11 | 指标异常 |
| `DB_QUERY` | 12 | 数据库查询性能问题 |
| `HTTP_CLIENT` | 13 | HTTP 客户端请求问题（N+1 等） |
| `FRONTEND` | 14 | 前端性能问题 |
| `MOBILE` | 15 | 移动端特定问题 |
| `AI_DETECTED` | 16 | AI 自动检测出的问题 |
| `PREPROD` | 17 | 预生产阶段检测的问题（构建产物分析） |
| `CONFIGURATION` | 19 | SDK/工具链配置问题 |

`PERFORMANCE` 类别的 Issue 正在逐步拆分为 `DB_QUERY`、`FRONTEND`、`MOBILE`、`HTTP_CLIENT` 四个细分类别（`PERFORMANCE_ISSUE_CATEGORIES`），这使得开发团队可以更精准地定位性能瓶颈的根因。

### 1.3.3 Project（项目）

Project 是 Sentry 中**事件的组织单位**。每个 Project 通常对应一个代码仓库或一个可独立部署的服务单元，拥有一套独立的 DSN、配置和 Issue 列表。

在 `src/sentry/models/project.py:234` 中，Project 定义的核心字段：

| 字段 | 说明 |
|---|---|
| `slug` | 项目短标识符（URL 友好，如 `my-api`） |
| `name` | 项目显示名称 |
| `organization` | 所属 Organization（外键） |
| `platform` | 平台标识（如 `python`、`javascript-react`、`dotnet-aspnetcore`） |
| `status` | 状态（ACTIVE / PENDING_DELETION 等） |
| `flags` | 位标志字段（控制多项开关行为） |
| `first_event` | 首条事件的时间（用于追踪接入状态） |

Sentry 支持超过 100 种平台/框架的 SDK（`GETTING_STARTED_DOCS_PLATFORMS` 列表涵盖了从 `android`、`apple-ios` 到 `javascript-nextjs`、`dotnet-aspnetcore`、`go-gin` 等主流技术栈）。

### 1.3.4 Organization（组织）

Organization 是 Sentry 的**最高层级管理单元**，代表一个团队或公司实体。它包含多个 Project 和 Team，拥有独立的计费计划、成员管理和权限策略。

`src/sentry/models/organization.py:150` 中的 Organization 模型：

```python
class Organization(ReplicatedCellModel):
    """
    An organization represents a group of individuals which
    maintain ownership of projects.
    """
    name = models.CharField(max_length=64)
    slug = SentryOrgSlugField(unique=True)
    status = BoundedPositiveIntegerField(default=ACTIVE)
    default_role = models.CharField(max_length=32)
```

Organization 通过 `OutboxCategory.ORGANIZATION_UPDATE` 实现跨 Cell（Sentry 的多区域部署架构）的数据复制。

在 Sentry 的层级关系中，数据的归属路径为：

```
Organization -> Team -> Project -> ProjectKey (DSN) -> Event -> Group (Issue)
```

### 1.3.5 DSN（数据源名称）

DSN（Data Source Name）是 SDK 连接 Sentry 服务器的**唯一凭证**，采用类似 URL 的格式：

```
https://<public_key>:<secret_key>@<host>/<project_id>
```

例如：

```
https://a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6@o123456.ingest.sentry.io/4505123456786432
```

在 `src/sentry/models/projectkey.py` 中，`ProjectKey` 是 DSN 的数据库模型：

```python
class ProjectKey(ReplicatedCellModel):
    project = FlexibleForeignKey("sentry.Project")
    label = models.CharField(max_length=64)
    public_key = models.CharField(max_length=32, unique=True)  # 32 位十六进制
    secret_key = models.CharField(max_length=32, unique=True)  # 32 位十六进制
    roles = TypedClassBitField()  # store / api 权限位
    status = BoundedPositiveIntegerField()  # ACTIVE / INACTIVE
    use_case = models.CharField()  # USER / PROFILING / TEMPEST / DEMO
```

关键特性：

- **密钥生成**：`public_key` 和 `secret_key` 通过 `secrets.token_hex(nbytes=16)` 生成 32 位十六进制字符串
- **角色（Roles）**：通过位标志控制 DSN 的权限
  - `store`：允许向 `/api/{project_id}/store/` 端点发送事件
  - `api`：允许读写 REST API
- **Use Case**：区分 DSN 的用途
  - `USER`：常规事件上报
  - `PROFILING`：用于提交聚合函数指标数据
  - `TEMPEST` / `DEMO`：内部使用
- **Dual DSN**：每个 ProjectKey 同时拥有 `dsn_public` 和 `dsn_private` 两种格式。Public DSN 仅包含 `public_key`（不含 `secret_key`），适用于客户端 JavaScript SDK 等公开场景；Private DSN 同时包含两组密钥，用于服务器端 SDK

DSN 的 `get_endpoint()` 方法支持多种高级特性：
- 组织级子域名覆盖（`org-ingest-subdomains` Feature Flag 控制）：将默认的 `sentry.io` 转化为 `o{org_id}.ingest.sentry.io`
- 自定义 Relay 端点覆盖（`sentry:relay_dsn_endpoint` 选项）
- Cell 模式下的本地化 URL 生成

除了标准的 Event Store 端点，DSN 还对外暴露了多种专用端点：
- `csp_endpoint`：CSP（内容安全策略）违规上报
- `security_endpoint`：安全策略违规上报
- `minidump_endpoint`：原生崩溃 Minidump 上传
- `otlp_traces_endpoint` / `otlp_logs_endpoint`：OpenTelemetry 协议兼容端点
- `unreal_endpoint`：Unreal Engine 专用端点
- `crons_endpoint`：Cron 监控打卡端点

### 1.3.6 Transaction 与 Span（事务与跨度）

Transaction 和 Span 是 Sentry Performance Monitoring 的核心概念，遵循 OpenTelemetry 标准中的分布式追踪模型。

#### Transaction（事务）

Transaction 代表一个完整的、有意义的**用户操作或请求**。在代码中，Transaction 是一种特殊的 Event，其类型为 `"transaction"`，由 `TransactionEvent` 类处理（`src/sentry/eventtypes/transaction.py`）：

```python
class TransactionEvent(BaseEvent):
    key = "transaction"

    def extract_metadata(self, data):
        description = get_path(data, "contexts", "trace", "description")
        transaction = get_path(data, "transaction")
        return {"title": description or transaction, "location": transaction}
```

Transaction 的标题可以来自两个地方：
1. `contexts.trace.description` -- Span 的描述文本（更精确）
2. `transaction` 字段 -- 事务名称（如 `GET /api/users`）

Transaction 中包含一个 Trace 上下文（`contexts.trace`），记录了 `trace_id`、`span_id`、`parent_span_id`、`op`（操作类型）和 `status` 等关键字段。

#### Span（跨度）

Span 是 Transaction 内部的**一个工作单元**，用于描述调用链中的具体步骤。在 `src/sentry/interfaces/spans.py` 中定义：

```python
class Span(Interface):
    """
    Holds timing spans related to APM and tracing.
    """
```

一个 Span 包含 16 个规范字段（`SPAN_KEYS`）：

| 字段 | 说明 |
|---|---|
| `trace_id` | 所属 Trace 的全局唯一 ID |
| `parent_span_id` | 父 Span 的 ID（构成树形结构） |
| `span_id` | 当前 Span 的唯一 ID |
| `start_timestamp` | 开始时间（ISO 8601） |
| `timestamp` | 结束时间 |
| `same_process_as_parent` | 是否与父 Span 在同一进程 |
| `description` | 人类可读的描述（如 `http://httpbin.org/base64/ GET`） |
| `op` | 操作类型（如 `http`、`db`、`cache.get`） |
| `tags` | 附加标签（如 `http.status_code: 200`） |
| `data` | 附加数据（如 URL、方法、状态码） |

通过 Span 形成的树形结构，可以直观地分析请求在各个环节的耗时分布。

#### 分布式追踪体系

Trace 是一棵由多个 Span 组成的树。当请求跨越多个服务（微服务场景），同一个 `trace_id` 贯穿所有下游调用，使得可以在 Sentry 的 Trace View 中查看完整的请求链路：

```
Trace (trace_id: a0fa8803...)
  Transaction: GET /api/orders                  (span_id: aaa)
    Span: db.query SELECT * FROM orders WHERE    (span_id: bbb, parent: aaa)
    Span: http GET /api/inventory               (span_id: ccc, parent: aaa)
      Transaction: GET /api/inventory           (span_id: ddd, parent: ccc)
        Span: db.query SELECT * FROM items      (span_id: eee, parent: ddd)
        Span: cache.get inventory:123           (span_id: fff, parent: ddd)
```

### 1.3.7 其他重要概念

#### Release（版本）

Release 代表应用的一个发布版本，通过 SDK 的 `release` 配置项上报（在 Event 中存储为 `sentry:release` tag）。Sentry 可以追踪每个版本的异常率、采纳率，并与源码仓库（GitHub/GitLab 等）关联——将错误与具体提交关联起来（通过 `sentry.models.commit` 和 `sentry.models.releasecommit`）。

#### Environment（环境）

Environment 标签（如 `production`、`staging`、`development`）用于区分事件发生的部署环境。Sentry 支持按环境过滤 Issues，并提供环境间的对比分析。

#### Log Level（日志级别）

Sentry 支持 6 个标准日志级别（`src/sentry/constants.py:249`），映射自 Python logging 模块：

```python
class LogLevel(IntEnum):
    SAMPLE = logging.NOTSET   # 0  (采样)
    DEBUG = logging.DEBUG     # 10
    INFO = logging.INFO       # 20
    WARNING = logging.WARNING # 30
    ERROR = logging.ERROR     # 40
    FATAL = logging.FATAL     # 50
```

`DEFAULT_LOG_LEVEL` 为 `"error"`，这意味着对于不显式设置级别的日志事件，Sentry 默认将其视为 ERROR 级别。

#### Breadcrumbs（面包屑）

Breadcrumbs 是事件发生前用户操作和系统事件的**时间线记录**。每个 Breadcrumb 包含 `timestamp`、`category`（如 `http`、`console`、`navigation`）、`message`、`level` 和 `data`。当排查一个 Bug 时，Breadcrumbs 提供的上下文往往是找到根因的关键线索——你可以看到用户点击了哪个按钮、发送了哪个请求、在哪个步骤触发了异常。

#### Nodestore 与 Snuba

理解 Sentry 的存储架构需要区分两个层次：

- **Nodestore**：存储 Event 的完整 JSON 负载（`NodeData`）。Event 数据以 `md5(f"{project_id}:{event_id}")` 的十六进制哈希作为 key 存储，支持多种后端（如 Bigtable）
- **Snuba / ClickHouse**：存储 Event 的**列式索引**，用于高性能聚合查询。Snuba 是 Sentry 自建的 ClickHouse 查询抽象层（`snuba-sdk`）。像 Issue 事件数统计、Discover 查询、趋势分析等都在 Snuba 上完成

Event 对象（`BaseEvent`）支持同时从 Nodestore 和 Snuba 读取数据，通过 `_snuba_data` 属性缓存列式数据，在访问 title、tags、user 等字段时优先从 Snuba 获取，未命中时回退到 Nodestore。

---

## 1.4 Sentry 与其他 APM 工具对比

在应用性能监控领域，Sentry 与其他工具形成了差异化的定位。以下从功能维度进行对比：

| 维度 | Sentry | Datadog | New Relic | ELK Stack | Grafana (LGTM) |
|---|---|---|---|---|---|
| **核心定位** | 错误追踪+APM | 基础设施+APM+日志 | 全栈可观测性 | 日志搜索与分析 | 监控可视化 |
| **错误聚合** | 原生支持，分组算法成熟 | 需要手动配置 | 支持 | 需要自行实现 | 依赖 Loki 日志查询 |
| **堆栈符号化** | 内置符号服务器（Symbolicator），支持 Native/ProGuard/Source Map | 需额外配置 | 支持 | 无 | 无 |
| **Release 追踪** | 原生 Release/Commit 关联 | 支持 | 支持 | 无 | 无 |
| **分布式追踪** | 完整支持（Trace/Span Model），基于 OpenTelemetry | 完整支持 | 完整支持 | 需 APM 插件 | Tempo 后端 |
| **Session Replay** | 内置 | 内置 | 内置 | 无 | 无（社区方案） |
| **AI 自动修复** | 内置（Seer/Autofix），可自动生成 PR | 有 AI 助手 | 有 AI 助手 | 无 | 有 AI 插件 |
| **开源协议** | FSL-1.1-Apache-2.0（源码可用） | 闭源 SaaS | 闭源 SaaS | Apache 2.0 | AGPLv3 |
| **自托管** | 支持（self-hosted Docker Compose） | 不支持 | 不支持 | 完全自建 | 官方支持 |
| **SDK 语言覆盖** | 20+ 官方 SDK，社区生态丰富 | 丰富的 Agent 和 SDK | 丰富的 SDK | 任意语言（日志输出） | 广泛 |
| **日志管理** | 通过 `sentry_ourlogs` 支持，非核心 | 核心能力，日志与 Trace 深度集成 | 核心能力 | 核心能力 | Loki 核心 |
| **基础设施监控** | 不涉及 | 核心能力（CPU、内存、网络） | 支持 | 可配合 Metricbeat | 核心能力 |
| **定价模型** | 按事件量/跨度量计费 | 按主机/自定义指标计费 | 按数据摄入量计费 | 自行承担基础设施 | 自行承担基础设施 |

### 关键差异化优势

**Sentry 的核心优势在于其对"开发者调试体验"的深度优化**：

1. **上下文完整性**：每条 Event 自动附带堆栈、Breadcrumbs、环境信息、Tags、Release、User 等上下文，不需要额外配置。而通用日志系统（如 ELK）需要开发者手动结构化日志才能达到类似效果。

2. **代码级定位**：通过符号服务器（Symbolicator）处理 Native 符号（`.dSYM`、`.pdb`）、ProGuard 混淆映射和 JavaScript Source Map，将混淆后的堆栈还原为包含文件名、行号的原始源码位置。

3. **Grouping 算法**：成熟的去重算法确保同一个 Bug 的多次发生被聚合为同一个 Issue，避免了"告警风暴"。这是 Sentry 区别于通用日志系统的决定性特性。

4. **开发生命周期集成**：Sentry 深度集成版本控制系统（GitHub、GitLab、Bitbucket 等）、CI/CD 和服务管理工具（Jira、Slack、PagerDuty 等），形成了覆盖"发现 -> 定位 -> 分配 -> 修复 -> 验证"的完整闭环。

5. **AI 增强**：Seer 平台提供的自动修复（Autofix）能力，在 2025-2026 年成为区分于竞品的显著特征。它能读取 Issue 上下文、分析堆栈、定位代码，并在代码仓库中直接创建 Draft PR。

### 典型使用场景选择

| 场景 | 推荐工具 |
|---|---|
| 移动应用崩溃监控 + 调试 | **Sentry**（原生崩溃符号化 + Session Replay） |
| 后端服务异常监控 + 追踪 | **Sentry** + Datadog/Grafana（基础设施指标） |
| 大规模日志搜索与分析 | ELK / Loki |
| 全栈可观测性 + 基础设施 | Datadog / New Relic |
| 预算有限的创业团队 | **Sentry**（自托管免费 + SaaS Free Tier） |

---

## 1.5 Sentry 开源协议与商业模式

### FSL 协议（Functional Source License）

2023 年 11 月，Sentry 宣布将其开源协议从 BSL（Business Source License）切换为自主制定的 **FSL（Functional Source License）**，版本为 `FSL-1.1-Apache-2.0`（`LICENSE.md` 中标注）。

#### 协议核心条款

FSL 是一种"源码可用"（Source Available）协议，介于传统开源协议（MIT/Apache）和闭源商业协议之间：

**允许的使用（Permitted Purposes）**：
1. **内部使用**：个人或公司内部运行、修改和使用 Sentry
2. **非商业教育**：用于教学场景
3. **非商业研究**：用于学术研究
4. **专业服务**：为合法使用 Sentry 的客户提供咨询和实施服务

**禁止的使用（Competing Use）**：
- **禁止将 Sentry 或其修改版作为商业产品/服务提供**，如果该产品或服务：
  1. 替代 Sentry 本身
  2. 替代 Sentry 公司提供的任何其他产品或服务
  3. 提供与 Sentry 相同或实质上相似的功能

简单来说：**你可以自己部署、修改和使用 Sentry，但不能将 Sentry 打包成商业竞品出售**。

#### 自动转换为 Apache 2.0

FSL 最关键的条款是**"未来授权"（Grant of Future License）**：

> 从软件每个版本**发布之日起满两年**后，该版本的许可自动且不可撤销地转换为 Apache License 2.0。

这意味着：
- Sentry 24.x 版本的代码在 2026 年已经转换为 Apache 2.0
- Sentry 25.x 版本的代码将在 2027 年转换为 Apache 2.0
- Sentry 26.x 版本的代码将在 2028 年转换为 Apache 2.0

这个设计平衡了商业利益和开源社区利益：Sentry 公司获得 2 年的商业保护期，而社区最终能获得完全开源的代码。

### 商业模式

Sentry 采用 **Open Core + SaaS** 的商业模式：

#### 1. SaaS 服务（sentry.io）

这是 Sentry 的主要收入来源。提供多种定价层级：

- **Developer（Free）**：有限的事件量和功能（适合个人开发者和小项目）
- **Team**：中小团队，增加容量和协作功能
- **Business**：中大型组织，提供 SSO、高级权限管理、SLA 保障
- **Enterprise**：大型企业，定制化方案

计费基于**事件的保留数量**和**Span 的数据量**，而非按主机或用户数计费。

#### 2. 自托管（Self-Hosted）

Sentry 提供官方的 Docker Compose 部署方案（`self-hosted/` 目录），允许用户在自己的基础设施上运行 Sentry。自托管版本免费但功能上有一定限制（如单组织模式无 SSO）。

#### 3. 开源与商业的分界线

GitHub 上的 `getsentry/sentry` 仓库包含了 Sentry 的完整服务端代码。但 Sentry 公司内部还有一个私有仓库 `getsentry/getsentry`，包含仅供 SaaS 付费用户使用的商业特性代码。在 `pyproject.toml` 的依赖列表中可以看到对 `getsentry` 相关依赖的注释（如 `[begin] getsentry ... [end] getsentry` 标记的包，包括 `avalara`（税务）、`stripe`（支付）等）。

#### 4. 竞品对比

| 项目 | 协议 | 商业模式 |
|---|---|---|
| Sentry | FSL-1.1-Apache-2.0 | SaaS + Self-Hosted |
| Datadog | 闭源 | 纯 SaaS |
| Grafana | AGPLv3 | SaaS + Self-Hosted |
| SigNoz | MIT | SaaS + Self-Hosted |
| GlitchTip | MIT | Self-Hosted（Sentry 兼容） |

Sentry 的 FSL 协议在开源社区引发过争议。支持者认为它保护了商业可持续性（确保开源项目不会因被云厂商"白嫖"而资金枯竭）；反对者则认为 FSL 不是 OSI 认可的真正开源协议。不论立场如何，FSL + 2 年自动转 Apache 的设计已经在 HashiCorp、Elastic 等公司的类似实践中被验证为一种可行的折中方案。

---

以上是 Sentry 的核心概念与背景介绍。在下一章中，我们将开始动手实践——注册 Sentry 账号、创建 Organization 和 Project、获取 DSN、并在 .NET 应用中完成 SDK 的初始化配置。
