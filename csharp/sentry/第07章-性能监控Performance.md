---
layout: default
title: 第七章：性能监控（Performance）
---

- [7.1 Performance 概述](#71-performance-概述)
  - [7.1.1 APM 与 Error Tracking 的关系](#711-apm-与-error-tracking-的关系)
  - [7.1.2 Tracing 基本概念](#712-tracing-基本概念)
  - [7.1.3 Sentry Performance 架构全景](#713-sentry-performance-架构全景)
- [7.2 Transaction（事务）详解](#72-transaction事务详解)
  - [7.2.1 Transaction 的定义与事件模型](#721-transaction-的定义与事件模型)
  - [7.2.2 Transaction Name 与 Transaction Source](#722-transaction-name-与-transaction-source)
  - [7.2.3 Transaction 的声明周期](#723-transaction-的声明周期)
  - [7.2.4 Transaction 与 Error 的关联](#724-transaction-与-error-的关联)
- [7.3 Span（跨度）详解](#73-span跨度详解)
  - [7.3.1 Span 的数据结构](#731-span-的数据结构)
  - [7.3.2 Span Op（操作类型）](#732-span-op操作类型)
  - [7.3.3 Span Status 与 Duration](#733-span-status-与-duration)
  - [7.3.4 Span 树与父子关系](#734-span-树与父子关系)
  - [7.3.5 Span 数据在 ClickHouse 中的存储与查询](#735-span-数据在-clickhouse-中的存储与查询)
- [7.4 分布式追踪（Distributed Tracing）](#74-分布式追踪distributed-tracing)
  - [7.4.1 Trace ID 的生成与传播](#741-trace-id-的生成与传播)
  - [7.4.2 sentry-trace 与 baggage Header](#742-sentry-trace-与-baggage-header)
  - [7.4.3 跨服务关联原理](#743-跨服务关联原理)
- [7.5 性能指标详解](#75-性能指标详解)
  - [7.5.1 Apdex（应用性能指数）](#751-apdex应用性能指数)
  - [7.5.2 百分位延迟 P50/P75/P95/P99](#752-百分位延迟-p50p75p95p99)
  - [7.5.3 Failure Rate（失败率）](#753-failure-rate失败率)
  - [7.5.4 Throughput -- TPM/TPS（吞吐量）](#754-throughput----tpmtps吞吐量)
  - [7.5.5 指标计算的底层实现](#755-指标计算的底层实现)
- [7.6 Performance 页面解读](#76-performance-页面解读)
  - [7.6.1 Transaction Summary 页面](#761-transaction-summary-页面)
  - [7.6.2 Span 瀑布图与水合分析](#762-span-瀑布图与水合分析)
  - [7.6.3 Suspect Spans 分析](#763-suspect-spans-分析)
  - [7.6.4 Trace View 全链路视图](#764-trace-view-全链路视图)
- [7.7 数据库查询追踪](#77-数据库查询追踪)
  - [7.7.1 SQL 查询自动 Instrumentation](#771-sql-查询自动-instrumentation)
  - [7.7.2 N+1 查询自动检测 -- 从代码看实现](#772-n1-查询自动检测----从代码看实现)
  - [7.7.3 MN+1 状态机检测](#773-mn1-状态机检测)
  - [7.7.4 连续 DB 查询检测](#774-连续-db-查询检测)
- [7.8 前端性能监控](#78-前端性能监控)
  - [7.8.1 Web Vitals 核心指标](#781-web-vitals-核心指标)
  - [7.8.2 Page Load Transaction](#782-page-load-transaction)
  - [7.8.3 前端特定的性能 Issues](#783-前端特定的性能-issues)
- [7.9 性能 Issues 自动检测体系](#79-性能-issues-自动检测体系)
  - [7.9.1 检测器架构总览](#791-检测器架构总览)
  - [7.9.2 各检测器详解](#792-各检测器详解)
  - [7.9.3 检测配置与阈值](#793-检测配置与阈值)
  - [7.9.4 Issue 的创建与分组](#794-issue-的创建与分组)
- [7.10 自定义 Instrumentation](#710-自定义-instrumentation)
  - [7.10.1 手动创建 Transaction](#7101-手动创建-transaction)
  - [7.10.2 手动创建 Span](#7102-手动创建-span)
  - [7.10.3 添加自定义 Tag 与 Measurement](#7103-添加自定义-tag-与-measurement)
- [7.11 性能采样策略](#711-性能采样策略)
  - [7.11.1 采样决策的生命周期](#7111-采样决策的生命周期)
  - [7.11.2 client_sample_rate 与 server_sample_rate](#7112-client_sample_rate-与-server_sample_rate)
  - [7.11.3 动态采样（Dynamic Sampling）](#7113-动态采样dynamic-sampling)
  - [7.11.4 采样偏差与统计推断](#7114-采样偏差与统计推断)

# 第七章：性能监控（Performance）

性能监控（Performance Monitoring）是 Sentry 从 **9.x 版本**开始引入的分布式追踪（Distributed Tracing）能力。它使得 Sentry 不再仅仅是一个"错误日志收集系统"，而是演进为一款覆盖错误追踪与性能分析的全栈 APM 平台。

> **版本说明**：本章内容基于 Sentry 代码库 `26.8.0.dev0` 版本。代码引用路径均为相对于仓库根目录的相对路径。

---

## 7.1 Performance 概述

### 7.1.1 APM 与 Error Tracking 的关系

传统的错误监控回答的是"系统出了什么问题"，而 APM 回答的是"系统为什么慢"以及"在哪里慢"。两款能力之间并非割裂的，而是有机统一在同一个 Tracing 基础设施之上：

- **相同的 SDK 埋点**：Sentry SDK 同时采集 Error 事件和 Transaction/Spans 数据，使用同一套初始化配置。
- **统一的 Trace Context**：错误事件可以关联到发生该错误的 Transaction 和 Span，开发者在 Issue 详情页可以直接看到出错时的完整调用链路。
- **事件归一化流程**：两类事件都在 `src/sentry/event_manager.py`（约 2800 行）中被统一处理——`save_error_events` 处理 Error 事件，`save_transaction_events` 处理 Transaction 事件，两者共享相同的存储管道。

在代码层面，事件类型由 `EventType` 区分，`src/sentry/event_manager.py:2666-2676` 中的 `PerformanceJob` TypedDict 承载性能事件特有的字段：

```python
class PerformanceJob(TypedDict, total=False):
    performance_problems: Sequence[PerformanceProblem]
    event: Event
    groups: list[GroupInfo]
    culprit: str
    received_timestamp: float
    event_metadata: Mapping[str, Any]
    platform: str
    level: str
    logger_name: str
    release: Release
```

### 7.1.2 Tracing 基本概念

在深入代码之前，需要建立以下核心概念的准确定义：

| 概念 | 说明 | 在 Sentry 中的对应 |
|---|---|---|
| **Trace** | 一次完整的请求链路，可能跨越多个微服务。由全局唯一的 `trace_id` 标识。 | ` contexts.trace.trace_id` |
| **Transaction** | 单个服务的处理单元，包含开始时间、结束时间、服务名称。一个 Trace 中包含多个 Transaction。 | `transaction` 事件类型 |
| **Span** | Transaction 内部的一个操作片段，如一次数据库查询、一次 HTTP 调用。 | `spans` 数组 |
| **Root Span** | Transaction 自身也是一个 Span，称为 Root Span。 | `contexts.trace.span_id` |
| **Parent Span** | Span 的父节点，用于构建调用树。 | `span.parent_span_id` |

两者之间的关系可以用一张图表示：

```
Trace (trace_id: abc123)
└── Transaction A (service-A, span_id: 001)
    ├── Span: db.query (SELECT ...)
    ├── Span: http.client (GET /api/users)
    │   └── Transaction B (service-B, span_id: 002, parent_span_id: 001)
    │       ├── Span: db.query (SELECT ...)
    │       └── Span: cache.get (redis)
    └── Span: template.render
```

在上面的示例中，Service-A 发出的 HTTP 调用在 Service-B 侧触发了 Transaction B。`parent_span_id` 为 001，将两个 Transaction 串联起来，构成了完整的分布式 Trace。

### 7.1.3 Sentry Performance 架构全景

从代码实现来看，Sentry 的性能监控系统由以下核心组件构成：

1. **SDK 层**：各语言 SDK 负责创建 Transaction/Spans，计算采样决策（`client_sample_rate`），生成 `sentry-trace` 和 `baggage` header，并将事件发送到 Relay。
2. **Relay 层**：Rust 编写的边缘代理，负责速率限制、数据清洗、事件规范化，以及服务端采样决策（`server_sample_rate`）。
3. **事件管理器**：`src/sentry/event_manager.py` 中的 `save_transaction_events` 处理 Transaction 事件的存储任务编排，包括：
   - 调用 `_detect_performance_problems`（`event_manager.py:2600`）对 Span 列表进行性能问题自动检测。
   - 调用 `_record_transaction_info`（`event_manager.py:2625`）记录 Transaction 名称用于后续聚类，并标记项目中的 `has_transactions` 标志。
4. **Snuba / ClickHouse**：性能数据（Transactions, Spans）通过 Snuba SDK（`snuba-sdk>=3.0.43`）写入 ClickHouse，提供高性能的聚合查询。
5. **性能问题检测器**：位于 `src/sentry/issue_detection/` 目录下的 14 个独立检测器，对 Span 树进行模式识别以自动发现性能瓶颈。
6. **Discover**：统一的查询引擎，支持跨 Transactions、Errors 的联合查询。

---

## 7.2 Transaction（事务）详解

### 7.2.1 Transaction 的定义与事件模型

Transaction 是 Sentry Performance 的核心数据单元。在 Sentry 的事件系统中，Transaction 是一种特殊的 Event 类型，其 `type` 字段为 `"transaction"`，区别于 Error Event 的 `"error"` 或 `"default"`。

Transaction 事件的 JSON 结构（简化版）如下：

```json
{
  "event_id": "abc123def456",
  "type": "transaction",
  "transaction": "GET /api/users/{user_id}",
  "transaction_info": {
    "source": "route"
  },
  "contexts": {
    "trace": {
      "trace_id": "8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
      "span_id": "0011223344556677",
      "op": "http.server",
      "status": "ok"
    }
  },
  "start_timestamp": 1722825600.123,
  "timestamp": 1722825601.456,
  "spans": [
    {
      "span_id": "aabbccdd",
      "parent_span_id": "0011223344556677",
      "op": "db",
      "description": "SELECT * FROM users WHERE id = %s",
      "start_timestamp": 1722825600.200,
      "timestamp": 1722825600.350,
      "data": {
        "db.system": "postgresql",
        "db.name": "mydb"
      }
    }
  ],
  "measurements": {
    "lcp": {"value": 1234, "unit": "millisecond"},
    "fcp": {"value": 800, "unit": "millisecond"}
  },
  "tags": [
    ["release", "1.0.0"],
    ["environment", "production"]
  ]
}
```

### 7.2.2 Transaction Name 与 Transaction Source

Transaction Name（`transaction` 字段）是 Sentry 进行性能聚合分析的关键维度。它决定了一条请求如何被分组到对应的 Transaction Summary 页面。

Transaction Source（`transaction_info.source`）标识了 Transaction Name 的来源，直接影响聚合精度与 URL 参数化行为。Sentry 支持以下 Source 等级（从低到高）：

| Source | 含义 | 示例 |
|---|---|---|
| `url` | 原始 URL，最粗粒度 | `/users/123/profile` |
| `route` | URL 路由匹配的结果 | `/users/{user_id}/profile` |
| `custom` | 开发者自定义名称 | `my_batch_job` |
| `task` | 后台任务名称 | `send_email_notification` |
| `view` | Django view 名称 | `app.views.UserProfileView` |
| `component` | 前端组件名称 | `UserProfile` |

在 Sentry 服务端，Transaction Name 会被写入聚类表（`record_transaction_name_for_clustering`），用于后续的自动 Transaction Name 优化和 URL 规范化。

### 7.2.3 Transaction 的声明周期

Transaction 在 SDK 端创建后经历以下阶段：

1. **SDK 创建**：应用代码中通过 `SentrySdk.StartTransaction()` 创建 Transaction。
2. **Span 采集**：在 Transaction 存活期间，所有创建的 Span 自动附加到当前 Transaction 上。
3. **采样决策**：SDK 根据采样配置决定是否将该 Transaction 发送到服务端。
4. **完成**：Transaction 结束（`transaction.Finish()`）后，SDK 将完整的 Transaction 数据（包括所有 Span）序列化并通过 HTTP 发送到 Relay。
5. **Relay 处理**：Relay 进行二次采样决策 (`server_sample_rate`) 和数据规范化。
6. **事件管理器**：Sentry 事件管理器接收数据：
   - `save_transaction_events` 负责存储编排
   - `_detect_performance_problems` 对 Span 数据执行性能问题自动检测
   - `_record_transaction_info` 记录事务元数据并标记 `has_transactions` 标志
7. **存储**：Transaction 数据写入 Nodestore（本体）和 ClickHouse（聚合查询用）。

### 7.2.4 Transaction 与 Error 的关联

Transaction 和 Error 通过 `trace_id` 关联。当错误事件发生时，SDK 自动将当前活跃 Transaction 的 `trace_id` 注入到错误事件的 `contexts.trace` 中。在 Sentry UI 中，这意味着：

- 在 Error Issue 详情页可以看到导致错误的完整 Transaction 链路。
- 在 Transaction Summary 页可以看到该 Transaction 上发生的所有错误。

---

## 7.3 Span（跨度）详解

### 7.3.1 Span 的数据结构

Span 是 Sentry 性能数据模型中最细粒度的操作单元。在 `src/sentry/search/eap/spans/attributes.py` 中定义了 Span 的全部属性定义。核心字段包括：

| 字段 | 内部名称 | 类型 | 说明 |
|---|---|---|---|
| `span_id` | `sentry.item_id` | string | Span 的唯一标识 |
| `parent_span_id` | `sentry.parent_span_id` | string | 父 Span 的 ID |
| `span.op` | `sentry.op` | string | 操作类型（如 `db`, `http.client`）|
| `span.description` | `sentry.raw_description` | string | 操作描述（如 SQL 语句、URL） |
| `span.name` | `sentry.name` | string | Span 名称 |
| `span.kind` | `sentry.kind` | string | Span 类别（CLIENT / SERVER / PRODUCER / CONSUMER） |
| `span.action` | `sentry.action` | string | 具体动作（如 `QUERY`, `GET`） |
| `span.domain` | `sentry.domain` | string | 操作域（如 `users` 表、`api.example.com`） |
| `span.group` | `sentry.group` | string | 归一化后的操作分组（用于聚合去重） |
| `span.category` | `sentry.category` | string | 模块分类（db / http / cache / queue 等） |
| `span.duration` | `sentry.duration_ms` | number | Span 总耗时（毫秒） |
| `span.self_time` | `sentry.exclusive_time_ms` | number | 扣除子 Span 耗时后的独占时间（毫秒） |
| `start_timestamp` | `sentry.start_timestamp` | number | 开始时间戳 |
| `precise.start_ts` | — | string | 精确开始时间 |
| `precise.finish_ts` | — | string | 精确结束时间 |
| `span.status` | `sentry.status` | string | 状态（ok / cancelled / unknown_error 等） |

### 7.3.2 Span Op（操作类型）

`span.op` 是 Span 的**操作类型标识**，它是 Sentry 进行分类、筛选和检测的核心依据。在 `src/sentry/issue_detection/performance_detection.py:577-671` 中，检测器通过 `allowed_span_ops` 前缀匹配来识别目标 Span。

常见的 `span.op` 前缀及其含义：

| Op 前缀 | 含义 | 典型子类型 |
|---|---|---|
| `db` | 数据库操作 | `db`, `db.sql.query`, `db.redis` |
| `http` | HTTP 请求 | `http.client`, `http.server` |
| `cache` | 缓存操作 | `cache.get_item`, `cache.put_item` |
| `queue` | 消息队列 | `queue.publish`, `queue.process` |
| `browser` | 浏览器操作 | `browser.request`, `browser.pageload` |
| `resource` | 资源加载 | `resource.script`, `resource.css`, `resource.img` |
| `ui` | 用户界面 | `ui.interaction.click`, `ui.load` |
| `navigation` | 页面导航 | `navigation.push`, `navigation.navigate` |
| `serialize` | 序列化操作 | `serialize.serialize`, `serialize.deserialize` |
| `middleware` | 中间件 | `middleware.django`, `middleware.aspnetcore` |

`span.op` 在检测器中的使用方式：检测器通过 `find_span_prefix` 方法进行前缀匹配。例如 `SlowDBQueryDetector` 的配置为 `"allowed_span_ops": ["db"]`，意味着所有以 `db` 开头的 Span 都会被该检测器扫描：

```python
# src/sentry/issue_detection/base.py:71-75
def find_span_prefix(self, settings, span_op):
    allowed_span_ops = settings.get("allowed_span_ops", [])
    if len(allowed_span_ops) <= 0:
        return True
    return next((op for op in allowed_span_ops if span_op.startswith(op)), False)
```

### 7.3.3 Span Status 与 Duration

**Span Status** 表示 Span 的执行结果。在 `contexts.trace.status` 中，常见的状态值包括：

| Status | 含义 |
|---|---|
| `ok` | 操作成功完成 |
| `cancelled` | 操作被取消 |
| `unknown` | 状态未知 |
| `invalid_argument` | 参数无效 |
| `deadline_exceeded` | 超时 |
| `not_found` | 资源未找到 |
| `already_exists` | 资源已存在 |
| `permission_denied` | 权限拒绝 |
| `resource_exhausted` | 资源耗尽 |
| `unauthenticated` | 未认证 |
| `internal_error` | 内部错误 |
| `unavailable` | 服务不可用 |
| `data_loss` | 数据丢失 |

**Duration（`span.duration`）** 是 Span 的端到端耗时，由 `timestamp - start_timestamp` 计算得到。与之对应的 **Self Time（`span.self_time`）** 是减去所有子 Span 耗时后的剩余时间——反映的是该 Span 自身的执行时间，而非等待子任务的时间。`span.self_time` 是定位性能瓶颈的最关键指标。

### 7.3.4 Span 树与父子关系

Span 通过 `parent_span_id` 形成树状结构。在 Sentry 的性能问题检测流程中，有一个关键步骤是将 Span 列表按 DFS 遍历展开为扁平列表，供后续检测器逐一扫描：

```python
# src/sentry/issue_detection/performance_detection.py:788-842
def build_tree(spans):
    """根据 parent_span_id 构建 Span 树"""
    span_tree = {}
    segment_id = None
    for span in spans:
        span_id = span["span_id"]
        is_root = span.get("is_segment", False)
        if is_root:
            segment_id = span_id
        if span_id not in span_tree:
            span_tree[span_id] = (span, [])
    for span, _ in span_tree.values():
        parent_id = span.get("parent_span_id")
        if parent_id is not None and parent_id in span_tree:
            _, children = span_tree[parent_id]
            children.append(span)
    return span_tree, segment_id

def flatten_tree(tree, segment_id):
    """对 Span 树进行 DFS 遍历，产出扁平列表"""
    visited = set()
    flattened_spans = []
    if segment_id:
        dfs(visited, flattened_spans, tree, segment_id)
    remaining = sorted(tree.items(), key=lambda s: s[1][0]["start_timestamp"])
    for span_id, _ in remaining:
        if span_id not in visited:
            dfs(visited, flattened_spans, tree, span_id)
    return flattened_spans
```

这个树→扁平化的过程是性能检测的前提，所有检测器的 `visit_span` 方法会按 DFS 顺序逐一处理 Span，识别其中的性能问题模式。

### 7.3.5 Span 数据在 ClickHouse 中的存储与查询

Span 数据通过 Snuba RPC 写入 ClickHouse。在查询层面，`src/sentry/snuba/spans_rpc.py` 中的 `Spans` 类提供了统一的查询封装：

- **`run_table_query`**：执行 Span 的表格查询，支持筛选、排序、分页。
- **`run_trace_query`**：根据 `trace_id` 获取完整的 Trace 数据，包括所有 Span 及其属性（`parent_span`, `span.op`, `span.description`, `span.duration`, Web Vitals 测量值等）。
- **`run_stats_query`**：执行 Span 统计查询，获取属性分布数据（如 Span 耗时分桶）。

`run_trace_query` 中请求的默认属性字段（`spans_rpc.py:99-144`）揭示了 Sentry 认为性能分析最重要的维度：

```python
trace_attributes = [
    "parent_span",
    "span.description",
    "span.op",
    "span.name",
    "is_transaction",
    "transaction.span_id",
    "transaction.event_id",
    "transaction",
    "precise.start_ts",
    "precise.finish_ts",
    "project.id",
    "profile.id",
    "profiler.id",
    "span.duration",
    "sdk.name",
    # Web Vitals
    "measurements.lcp",
    "measurements.fcp",
    "measurements.inp",
    "measurements.cls",
    "measurements.ttfb",
    # Mobile Vitals
    "app.vitals.start.cold",
    "app.vitals.start.warm",
]
```

---

## 7.4 分布式追踪（Distributed Tracing）

### 7.4.1 Trace ID 的生成与传播

Trace ID 是分布式追踪的全局唯一标识符。当 SDK 创建第一个 Transaction 时，会生成一个 32 字符的十六进制 Trace ID。此后，该 ID 通过 HTTP Header 在微服务之间传播，将所有参与同一请求的服务串联起来。

Sentry SDK 使用两种 header 进行上下文传播：

1. **`sentry-trace`**：包含 `trace_id-span_id-sampled` 三部分。
   - 格式：`{trace_id}-{parent_span_id}-{sampled_flag}`
   - 示例：`8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d-0011223344556677-1`

2. **`baggage`**：W3C 标准的键值对传播 header，包含采样决策、租户信息等额外元数据。
   - 格式：`key1=value1,key2=value2;property1;property2=val`
   - 示例：`sentry-environment=production,sentry-release=1.0.0,sentry-trace_id=8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d`

### 7.4.2 sentry-trace 与 baggage Header

`src/sentry/templatetags/sentry_trace.py` 展示了服务端如何获取 Trace 上下文：

```python
def get_sentry_trace():
    return sentry_sdk.get_traceparent()

def get_sentry_baggage():
    return sentry_sdk.get_baggage()
```

在 Sentry 前端配置中，`src/sentry/web/client_config.py:219-220` 将 Trace 信息注入到前端 JavaScript 配置中：

```python
"sentry_trace": sentry_sdk.get_traceparent() or "",
"baggage": sentry_sdk.get_baggage() or "",
```

这样前端发出的 API 请求也会携带相同的 `trace_id`，实现前后端联动追踪。

在 API 层面，`src/sentry/api/base.py:168` 配置了 CORS 允许的 header：

```python
"sentry-trace, baggage, X-CSRFToken"
```

### 7.4.3 跨服务关联原理

跨服务追踪的核心在于 **`parent_span_id`** 的传递。以下是一个典型的跨服务追踪流程：

1. Service-A 创建 Transaction（`span_id: A001`）。
2. Service-A 向 Service-B 发起 HTTP 请求时，SDK 自动创建一个 `http.client` Span（`span_id: A002`, `parent_span_id: A001`）。
3. SDK 将 `sentry-trace: {trace_id}-A002-1` 注入 HTTP 请求头。
4. Service-B 的 SDK 从 HTTP 请求头中提取 `sentry-trace`，创建新的 Transaction（`span_id: B001`, `parent_span_id: A002`）。
5. Service-B 内部的所有 Span 的 `parent_span_id` 都指向 B001 或 B 内部的父 Span。

在 Sentry UI 的 **Trace View** 页面中，系统通过 `trace_id` 查询所有相关的 Transaction 和 Span，再按 `parent_span_id` 还原完整的调用树，实现了可视化的端到端链路追踪。

---

## 7.5 性能指标详解

### 7.5.1 Apdex（应用性能指数）

Apdex（Application Performance Index）是一个衡量用户满意度的综合指标。Sentry 在 Discover 中内置了 `apdex()` 函数。

**计算公式**：

```
Apdex = (满意请求数 + 容忍请求数的 0.5) / 总请求数
```

其中，请求分为三类：
- **满意（Satisfied）**：响应时间 <= T（T 为目标阈值，通常设置为 300ms）
- **容忍（Tolerating）**：T < 响应时间 <= 4T
- **沮丧（Frustrated）**：响应时间 > 4T

Apdex 的值域为 [0, 1]，越接近 1 表示用户体验越好。

### 7.5.2 百分位延迟 P50/P75/P95/P99

百分位延迟是性能分析的核心指标。Sentry 通过 ClickHouse 的 `quantile()` 函数计算。

| 指标 | 含义 | 应用场景 |
|---|---|---|
| **P50**（中位数） | 50% 的请求在此时间内完成 | 反映典型用户体验 |
| **P75** | 75% 的请求在此时间内完成 | 观察主流用户的性能趋势 |
| **P95** | 95% 的请求在此时间内完成 | 监控大多数用户的尾部延迟 |
| **P99** | 99% 的请求在此时间内完成 | 定位长尾问题，SLA 考核 |
| **P100** | 最慢请求的耗时 | 发现极端异常值 |

`src/sentry/snuba/transactions.py` 中的 `timeseries_query` 函数支持按时间窗口（`rollup`）计算百分位时间序列，从而观察延迟趋势：

```python
def timeseries_query(
    selected_columns,
    query,
    snuba_params,
    rollup,         # 时间窗口（秒），如 3600 表示按小时聚合
    referrer,
    zerofill_results=True,
    ...
):
    return discover.timeseries_query(
        selected_columns, query, snuba_params, rollup,
        dataset=Dataset.Transactions,
        ...
    )
```

### 7.5.3 Failure Rate（失败率）

失败率 = 失败的 Transaction 数 / 总 Transaction 数。

在 Sentry 中，Transaction 的"失败"是由 Span 的 `status` 字段判断的。如果任何一个 Span 的状态为非 `ok`，则该 Transaction 被视为失败。通过 `failure_rate()` 函数可以在 Discover 中计算失败率。

### 7.5.4 Throughput -- TPM/TPS（吞吐量） {#754-throughput----tpmtps吞吐量}

- **TPM（Transactions Per Minute）**：每分钟处理的 Transaction 数量。最常用的吞吐量指标。
- **TPS（Transactions Per Second）**：每秒处理的 Transaction 数量。

Sentry 通过 `count()` 或 `count_unique(transaction)` 聚合函数在 Discover / Transactions 数据集中计算吞吐量。

### 7.5.5 指标计算的底层实现

`src/sentry/snuba/transactions.py` 是 Transaction 查询的高层封装，底层通过 `sentry.snuba.discover` 模块生成 Snuba 查询请求。Discover 支持两种数据集的查询：

1. **Transactions Dataset**：使用 `Dataset.Transactions`，对应 ClickHouse 中的 `transactions` 表。
2. **Metrics Dataset**：使用从 Transaction 事件中提取的性能指标（MetricSpec），提供更高效的聚合查询。

在 `transactions.py:18-72` 中，`query` 函数将核心参数转发到 `discover.query`，并通过 `dataset=Dataset.Transactions` 指定数据源：

```python
def query(selected_columns, query, snuba_params, ..., dataset=Dataset.Discover, ...):
    return discover.query(
        selected_columns, query, snuba_params=snuba_params,
        ...
        dataset=Dataset.Transactions,
        ...
    )
```

---

## 7.6 Performance 页面解读

### 7.6.1 Transaction Summary 页面

Transaction Summary 是 Sentry Performance 的核心页面。进入路径：**Performance > All Transactions > 点击某个 Transaction Name**。

页面由以下模块构成：

1. **概览面板**：展示当前 Transaction 的核心指标 —— P50/P95/P99 延迟、Apdex、Failure Rate、TPM。
2. **延迟趋势图**：显示一段时间内的 P50/P95/P99 时间序列曲线。
3. **吞吐量趋势图**：显示 TPM 的变化趋势。
4. **Suspect Spans 表格**：列出该 Transaction 中耗时最长的 Span 操作（按累计 Self Time 排序）。
5. **Span 瀑布图**：展示典型请求的详细 Span 调用时间线。

### 7.6.2 Span 瀑布图与水合分析

Span 瀑布图（Waterfall Chart）是 Performance 页面最具可读性的视图之一。它将单个 Transaction 中所有 Span 按时间线水平展开，形成类似 Chrome DevTools Network 面板的瀑布效果。

关键视觉元素：

- **蓝色横条**：每个 Span 的持续时间（`span.duration`）。
- **嵌套缩进**：体现父子关系（`parent_span_id`）。
- **红色横条**：失败的 Span（`status != ok`）。
- **Self Time 标注**：横条中的浅色部分是子 Span 的耗时，深色部分是 Self Time。

### 7.6.3 Suspect Spans 分析

Suspect Spans 是通过自研算法**自动识别**的最可能引发性能瓶颈的 Span 列表。Sentry 的算法综合考虑：

1. **累计 Self Time 占比**：Span 的总 Self Time 在 Transaction 总 Self Time 中的比例。
2. **出现频率变化**：与历史基线相比，Span 耗时的变化幅度。
3. **Span Op 类型**：不同 Op 类型有不同的阈值判断。

原理上，Suspect Spans 并非独立于检测器体系运行，但其结果与性能性能 Issues（见 7.9 节）有重叠 —— Suspect Spans 侧重于"统计显著性"，而性能 Issues 侧重于"已知反模式匹配"。

### 7.6.4 Trace View 全链路视图

Trace View 展示了跨服务的完整调用链路。通过 `trace_id` 从 ClickHouse 中查询所有相关的 Transaction 和 Span，构建完整调用树。

`src/sentry/snuba/spans_rpc.py:87-232` 中的 `run_trace_query` 方法实现了这一逻辑：

```python
@classmethod
@trace
def run_trace_query(cls, *, trace_id, params, referrer, config, ...):
    # 通过 GetTraceRequest protobuf 消息向 Snuba RPC 请求完整 Trace
    request = GetTraceRequest(
        meta=meta,
        trace_id=trace_id,
        limit=options.get("performance.traces.pagination.query-limit"),
        items=[
            GetTraceRequest.TraceItem(
                item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
                attributes=[col.proto_definition for col in columns],
            )
        ],
    )
    # 支持分页迭代（最多 MAX_ITERATIONS 次），支持超时保护
    response = snuba_rpc.get_trace_rpc(request)
    for iteration in range(MAX_ITERATIONS):
        if response.page_token.end_pagination:
            process_item_groups(response.item_groups)
            break
        elif MAX_TIMEOUT > 0 and time.time() - start_time > MAX_TIMEOUT:
            process_item_groups(response.item_groups)
            break
        request.page_token.CopyFrom(response.page_token)
        # 并行处理当前页 + 请求下一页
        with ContextPropagatingThreadPoolExecutor(...) as thread_pool:
            _ = thread_pool.submit(process_item_groups, response.item_groups)
            response_future = thread_pool.submit(snuba_rpc.get_trace_rpc, request)
        response = response_future.result()
    return spans
```

返回的 Span 列表包含 `parent_span` 字段，前端据此构建树形视图。

---

## 7.7 数据库查询追踪

### 7.7.1 SQL 查询自动 Instrumentation

Sentry SDK 通过 ORM/数据库驱动的 Monkey Patch 或原生集成自动捕获 SQL 查询。以 Python Django 为例，SDK 通过 `django.db.backends` 的 wrapper 拦截数据库游标执行，将每条 SQL 包装为一个 `op="db"` 的 Span。

Span 中的数据包含关键诊断信息：

| 字段 | 路径 | 示例 |
|---|---|---|
| SQL 文本 | `span.description` | `SELECT "users"."id" FROM "users" WHERE ...` |
| 数据库系统 | `data.db.system` | `postgresql`, `mysql` |
| 数据库名 | `data.db.name` | `mydb` |
| 查询哈希 | `span.hash` | `a1b2c3d4`（去标识化后的 SQL 指纹）|
| 命中的表 | `data.db.tables` | `users, profiles` |

`span.hash` 字段尤为重要 —— 它将参数化后的 SQL 做哈希处理，使得结构相同但参数不同的 SQL 在聚合分析中被视为同一类查询。性能检测器依赖 `span.hash` 来判断 Span 之间的等价性。

### 7.7.2 N+1 查询自动检测 -- 从代码看实现 {#772-n1-查询自动检测----从代码看实现}

N+1 查询是 ORM 使用中最常见的性能反模式之一。Sentry 的 N+1 检测器（`src/sentry/issue_detection/detectors/n_plus_one_db_span_detector.py`）通过识别以下 Span 结构模式来自动发现 N+1 问题：

```
[-------- transaction span -----------]
   [-------- parent span -----------]
      [source query]          <-- 一次性查询（获取 N 条记录）
                     [n0]       <-- 紧接着循环 N 个重复查询
                         [n1]
                             [n2]
                                 ...
```

检测逻辑的核心步骤（见 `NPlusOneDBSpanDetector` 类）：

**步骤 1：扫描 Span 流**

`visit_span` 方法按 DFS 顺序处理每个 Span：

```python
def visit_span(self, span):
    op = span.get("op", None)
    if not self._is_db_op(op):
        # 非 DB Span：尝试存储已检测到的问题，然后重置
        self._maybe_store_problem()
        self._reset_detection()
        if span.get("parent_span_id", None):
            self.potential_parents[span_id] = span  # 记录为潜在父节点
        return
    # 缓存查询不计入 N+1
    if is_cached_span(span):
        return
    # 找 source span...
```

**步骤 2：定位 Source Span**

第一个满足条件的 DB Span 被标记为 `source_span`（前提是它有一个已记录的父 Span）：

```python
def _maybe_use_as_source(self, span):
    parent_span_id = span.get("parent_span_id", None)
    if not parent_span_id or parent_span_id not in self.potential_parents:
        return
    self.source_span = span
```

**步骤 3：追踪 N 个重复 Span**

检测器持续扫描后续 Span，只要满足以下条件就追加到 `n_spans` 列表：
- 与 `source_span` 拥有相同的 `parent_span_id`
- Span 的 `hash` 值与 `source_span` 不同
- 与前一个 N-Span 的 `hash` 值相同（确保它们之间是等价的）

```python
def _continues_n_plus_1(self, span):
    # 必须与 source_span 共享同一个 parent
    if span.get("parent_span_id") != self.source_span.get("parent_span_id"):
        return False
    # hash 不能等于 source（否则就是同一个查询）
    if span.get("hash") == self.source_span.get("hash"):
        return False
    # 检查与前一个 n-span 等价
    return are_spans_equivalent(a=span, b=self.previous_span)
```

**步骤 4：判定与 Issue 创建**

当满足以下阈值时，创建 Performance Issue：
- `n_spans` 数量 >= 配置的 `count` 阈值（默认值见 7.9.3 节）
- 所有 N-Span 的总耗时 >= `duration_threshold`
- Source Span 和 N-Span 都包含完整的 SQL 查询（非截断）

指纹生成算法将 `parent_op + parent_hash + source_hash + n_hash` 串联后做 SHA1 哈希，确保相同模式的问题被聚合到同一个 Issue：

```python
def _fingerprint(self, parent_op, parent_hash, source_hash, n_hash):
    problem_class = "GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES"
    full_fingerprint = hashlib.sha1(
        (str(parent_op) + str(parent_hash) + str(source_hash) + str(n_hash)).encode("utf8"),
    ).hexdigest()
    return f"1-{problem_class}-{full_fingerprint}"
```

### 7.7.3 MN+1 状态机检测

MN+1 是 N+1 的复杂变体 —— 多个（M 个）source 查询，每个后面跟着 N 个重复查询。Sentry 使用有限状态机（`MNPlusOneState`）来检测这种模式。

`src/sentry/issue_detection/detectors/mn_plus_one_db_span_detector.py:27-215` 实现了一个两状态的状态机：

```
SearchingForMNPlusOne ──(找到匹配模式)──> ContinuingMNPlusOne
        ^                                       │
        └───────────────────────────────────────┘
                    (模式结束或中断)
```

- **SearchingForMNPlusOne**：扫描 Span 流，寻找"一个 source DB Span 后跟着 N 个重复 Span"的模式。
- **ContinuingMNPlusOne**：确认找到至少 2 次这种模式（`minimum_occurrences_of_pattern: 3`），如果连续出现则发出警告。

状态转换中的关键参数（`performance_detection.py:629-636`）：

```python
DetectorType.M_N_PLUS_ONE_DB: {
    "total_duration_threshold": settings["n_plus_one_db_duration_threshold"],  # ms
    "minimum_occurrences_of_pattern": 3,
    "max_sequence_length": 8,
    "max_allowable_depth": 3,
    "min_percentage_of_db_spans": 0.05,
}
```

### 7.7.4 连续 DB 查询检测

除了 N+1 模式外，Sentry 还能检测**连续顺序执行的 DB 查询**——即多个独立的数据库查询在代码中按顺序执行，没有并行化。

`ConsecutiveDBSpanDetector` 检测的条件：
- 存在连续 2 个或以上的 DB Span
- 并行化执行可以节省的时间超过 `min_time_saved` 阈值
- 节省时间占 DB Span 总耗时的比例超过 `min_time_saved_ratio`（10%）

配置参数（`performance_detection.py:602-611`）：

```python
DetectorType.CONSECUTIVE_DB_OP: {
    "min_time_saved": settings["consecutive_db_min_time_saved_threshold"],  # ms
    "min_time_saved_ratio": 0.1,
    "span_duration_threshold": 30,  # 每个 Span 最短 30ms
    "consecutive_count_threshold": 2,
}
```

---

## 7.8 前端性能监控

### 7.8.1 Web Vitals 核心指标

Sentry 前端 SDK 会自动采集 Google Web Vitals 指标。在 `src/sentry/snuba/spans_rpc.py:121-130` 中，Trace 查询包含了完整的 Web Vitals 字段：

| 指标 | 字段 | 含义 | 良好阈值 |
|---|---|---|---|
| **LCP**（Largest Contentful Paint） | `measurements.lcp` | 最大内容绘制时间 | < 2500ms |
| **FCP**（First Contentful Paint） | `measurements.fcp` | 首次内容绘制时间 | < 1800ms |
| **INP**（Interaction to Next Paint） | `measurements.inp` | 交互到下次绘制延迟 | < 200ms |
| **CLS**（Cumulative Layout Shift） | `measurements.cls` | 累计布局偏移 | < 0.1 |
| **TTFB**（Time to First Byte） | `measurements.ttfb` | 首字节时间 | < 800ms |

除了原始值，Sentry 还存储加权评分（`measurements.score.ratio.*`），用于聚合计算 Web Vitals 的通过率。

---

### 7.8.2 Page Load Transaction

浏览器 SDK 为每个页面加载自动创建一个 `pageload` 类型的 Transaction，Transaction Name 为页面路由。该 Transaction 包含的 Span 覆盖了页面加载的完整生命周期：

| Span | Op | 说明 |
|---|---|---|
| `browser.request` | `browser` | 主文档请求 |
| `resource.script` | `resource.script` | 脚本加载 |
| `resource.css` | `resource.css` | 样式表加载 |
| `resource.img` | `resource.img` | 图片加载 |
| `ui.long-task` | `ui.long-task` | 长任务（超过 50ms 的主线程阻塞） |

每个 Span 都带有 `data.http.response_content_length` 等字段，用于后续的 Large HTTP Payload 检测。

### 7.8.3 前端特定的性能 Issues

Sentry 提供了前端专属的性能问题检测器：

1. **Large Render Blocking Asset**（`RenderBlockingAssetSpanDetector`，type_id: 1004）：检测阻塞 FCP 的大体积 CSS/JS 资源。判断条件包括资源大小超过阈值、资源加载时间占 FCP 的比例超过阈值。

2. **Uncompressed Asset**（`UncompressedAssetSpanDetector`，type_id: 1012）：检测未启用压缩（Gzip/Brotli）的静态资源。要求 `resource.script` 或 `resource.css` Span 的 `data.http.response_content_length` 与 `data.http.decoded_body_size` 比例接近 1:1，说明压缩未生效。

---

## 7.9 性能 Issues 自动检测体系

这是 Sentry Performance 最具差异化的能力 —— 自动将检测到的性能反模式转化为可追踪的 Issue，纳入与 Error 相同的 Issue 管理流程（告警、分配、标记解决）。

### 7.9.1 检测器架构总览

性能检测的核心入口是 `src/sentry/issue_detection/performance_detection.py` 中的 `detect_performance_problems` 函数，它在 `event_manager.py:2600-2607` 中被调用：

```python
@trace
def _detect_performance_problems(jobs, projects):
    for job in jobs:
        if job["data"].get("_performance_issues_spans"):
            job["performance_problems"] = []
        else:
            job["performance_problems"] = detect_performance_problems(
                job["data"], projects[job["project_id"]]
            )
```

检测流程分为以下阶段：

**阶段 1：速率控制**

检测本身有性能开销，因此 Sentry 使用 `performance.issues.all.problem-detection` 选项控制检测比例。代码中通过随机数进行判断：

```python
rate = options.get("performance.issues.all.problem-detection")
if rate and rate > random.random():
    # 执行实际检测
    return _detect_performance_problems(data, sdk_span, project, ...)
return []  # 跳过检测
```

**阶段 2：Span 排序与树构建**

将 Span 列表构建为树结构，然后通过 DFS 展平：

```python
tree, segment_id = build_tree(data.get("spans", []))
data = {**data, "spans": flatten_tree(tree, segment_id)}
```

**阶段 3：初始化检测器**

系统级别的开关控制哪些检测器可以运行（`is_detection_allowed_for_system`）：

```python
detectors = [
    detector_class(detection_settings[detector_class.settings_key], data)
    for detector_class in DETECTOR_CLASSES
    if detector_class.is_detection_allowed_for_system()
]
```

**阶段 4：逐个运行检测器**

每个检测器的 `visit_span` 方法按 DFS 顺序被调用，遍历每个 Span：

```python
for detector in detectors:
    try:
        run_detector_on_data(detector, data)
    except Exception:
        logger.exception(...)
```

**阶段 5：收集结果**

通过 `is_creation_allowed` 筛选出实际要创建 Issue 的检测结果：

```python
problems = []
for detector in detectors:
    if detector.is_creation_allowed():
        problems.extend(detector.stored_problems.values())
```

### 7.9.2 各检测器详解

`src/sentry/issue_detection/base.py` 定义了 `DetectorType` 枚举，共 14 种检测器类型：

```python
class DetectorType(Enum):
    SLOW_DB_QUERY = "slow_db_query"           # 慢数据库查询
    RENDER_BLOCKING_ASSET_SPAN = "render_blocking_assets"  # 渲染阻塞资源
    N_PLUS_ONE_DB_QUERIES = "n_plus_one_db"   # N+1 数据库查询
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls"  # N+1 API 调用
    CONSECUTIVE_DB_OP = "consecutive_db"      # 连续数据库操作
    CONSECUTIVE_HTTP_OP = "consecutive_http"   # 连续 HTTP 请求
    LARGE_HTTP_PAYLOAD = "large_http_payload"  # 大 HTTP 响应体
    FILE_IO_MAIN_THREAD = "file_io_main_thread"  # 主线程文件 IO
    M_N_PLUS_ONE_DB = "m_n_plus_one_db"       # M*(N+1) 数据库查询
    UNCOMPRESSED_ASSETS = "uncompressed_assets"  # 未压缩资源
    DB_MAIN_THREAD = "db_main_thread"          # 主线程数据库操作
    HTTP_OVERHEAD = "http_overhead"            # HTTP/1.1 连接开销
    SQL_INJECTION = "sql_injection"            # SQL 注入风险
    QUERY_INJECTION = "query_injection"        # 查询注入风险
```

各检测器对应的 GroupType（`src/sentry/issues/grouptype.py`）定义如下：

| 检测器 | GroupType | type_id | 分类 |
|---|---|---|---|
| SlowDBQueryDetector | `PerformanceSlowDBQueryGroupType` | 1001 | DB_QUERY |
| NPlusOneDBSpanDetector | `PerformanceNPlusOneGroupType` | 1006 | DB_QUERY |
| MNPlusOneDBSpanDetector | `PerformanceNPlusOneGroupType` | 1006/1011 | DB_QUERY |
| ConsecutiveDBSpanDetector | `PerformanceConsecutiveDBQueriesGroupType` | 1007 | DB_QUERY |
| ConsecutiveHTTPSpanDetector | `PerformanceConsecutiveHTTPQueriesGroupType` | 1009 | HTTP_CLIENT |
| NPlusOneAPICallsDetector | `PerformanceNPlusOneAPICallsGroupType` | 1010 | HTTP_CLIENT |
| LargeHTTPPayloadDetector | `PerformanceLargeHTTPPayloadGroupType` | 1015 | HTTP_CLIENT |
| HTTPOverheadDetector | `PerformanceHTTPOverheadGroupType` | 1016 | HTTP_CLIENT |
| DBMainThreadDetector | `PerformanceDBMainThreadGroupType` | 1013 | MOBILE |
| FileIOMainThreadDetector | `PerformanceFileIOMainThreadGroupType` | 1008 | MOBILE |
| RenderBlockingAssetSpanDetector | `PerformanceRenderBlockingAssetSpanGroupType` | 1004 | FRONTEND |
| UncompressedAssetSpanDetector | `PerformanceUncompressedAssetsGroupType` | 1012 | FRONTEND |

### 7.9.3 检测配置与阈值

`get_detection_settings` 函数（`performance_detection.py:577-671`）为每个检测器生成运行时配置。关键阈值摘要：

| 检测器 | 关键参数 | 默认值来源 |
|---|---|---|
| Slow DB Query | `duration_threshold` | `performance.issues.slow_db_query.duration_threshold` |
| N+1 DB | `count`, `duration_threshold` | `performance.issues.n_plus_one_db.count_threshold` |
| N+1 API Calls | `total_duration`, `concurrency_threshold: 15ms`, `count: 5` | `performance.issues.n_plus_one_api_calls.total_duration` |
| Consecutive HTTP | `span_duration_threshold`, `consecutive_count_threshold`, `max_duration_between_spans` | `performance.issues.consecutive_http.*` |
| Consecutive DB | `min_time_saved`, `min_time_saved_ratio: 0.1`, `consecutive_count_threshold: 2` | `performance.issues.consecutive_db.min_time_saved_threshold` |
| Large HTTP Payload | `payload_size_threshold`, `minimum_span_duration: 100ms` | `performance.issues.large_http_payload.size_threshold` |
| Render Blocking Asset | `fcp_minimum_threshold`, `fcp_maximum_threshold`, `fcp_ratio_threshold`, `minimum_size_bytes` | `performance.issues.render_blocking_assets.*` |
| Uncompressed Asset | `size_threshold_bytes`, `duration_threshold` | `performance.issues.uncompressed_asset.*` |
| DB on Main Thread | `duration_threshold` | `performance.issues.db_on_main_thread.total_spans_duration_threshold` |
| File IO Main Thread | `duration_threshold` | `performance.issues.file_io_on_main_thread.total_spans_duration_threshold` |
| HTTP Overhead | `http_request_delay_threshold` | `performance.issues.http_overhead.http_request_delay_threshold` |
| MN+1 DB | `total_duration_threshold`, `minimum_occurrences_of_pattern: 3`, `max_sequence_length: 8` | 同 N+1 duration_threshold |

### 7.9.4 Issue 的创建与分组

检测器发现性能问题后，通过以下流程创建 Issue：

1. **生成指纹**：每个检测器通过特定的指纹算法（通常是 `1-{GroupType}-{SHA1 of key params}` 格式）为问题生成指纹。
2. **去重**：同一次检测中相同指纹的问题只保留一个。Sentry 的 GroupHash 机制保证同一项目内相同指纹的 Issue 被合并。
3. **创建 Group**：通过 `save_grouphash_and_group` 创建 Group（Issue）对象及对应的 GroupHash：

```python
# src/sentry/event_manager.py:2679-2698
def save_grouphash_and_group(project, event, new_grouphash, **group_kwargs):
    with transaction.atomic(router.db_for_write(GroupHash)):
        group_hash, created = GroupHash.objects.get_or_create(
            project=project, hash=new_grouphash
        )
        if created:
            group = _create_group(project, event, **group_kwargs)
            group_hash.update(group=group)
    return group, created, group_hash
```

4. **Issue 属性填充**：包括 `EvidenceData`（证据数据，包含 offender_span_ids、transaction_name、SQL 描述等），用于 Issue 详情页展示。

---

## 7.10 自定义 Instrumentation

### 7.10.1 手动创建 Transaction

Sentry SDK 提供了手动创建 Transaction 的 API。以下是各语言 SDK 的核心模式：

**Python：**

```python
import sentry_sdk

with sentry_sdk.start_transaction(
    op="task",
    name="process_orders",
    source="task",
) as transaction:
    # 业务逻辑
    result = process_all_orders()

    # 设置 Transaction 状态
    transaction.set_status("ok")

    # 设置自定义 Tag（用于筛选和聚合）
    transaction.set_tag("order_count", len(result))

    # 设置 Measurement（用于性能指标）
    transaction.set_measurement("items_processed", len(result), "none")
```

**JavaScript：**

```javascript
const transaction = Sentry.startTransaction({
  op: "task",
  name: "process_orders",
  source: "task",
});

try {
  const result = await processAllOrders();
  transaction.setStatus("ok");
  transaction.setTag("order_count", result.length);
} catch (e) {
  transaction.setStatus("internal_error");
  throw e;
} finally {
  transaction.finish();
}
```

**C#：**

```csharp
var transaction = SentrySdk.StartTransaction("process_orders", "task");
transaction.SetSource(TransactionNameSource.Task);

try
{
    var result = ProcessAllOrders();
    transaction.Status = SpanStatus.Ok;
    transaction.SetTag("order_count", result.Count.ToString());
}
catch (Exception)
{
    transaction.Status = SpanStatus.InternalError;
    throw;
}
finally
{
    transaction.Finish();
}
```

### 7.10.2 手动创建 Span

当你需要对一个细粒度的操作进行性能追踪时，可以手动创建 Span：

**Python：**

```python
with sentry_sdk.start_span(op="db", description="query_user_stats") as span:
    span.set_data("cache_hit", False)
    stats = expensive_database_query()
    span.set_data("rows_returned", len(stats))
```

**JavaScript：**

```javascript
const span = transaction.startChild({
  op: "cache.get",
  description: "get_user_session",
});

try {
  const session = await cache.get("user_session");
  span.setData("cache_hit", session !== null);
  span.finish();
  return session;
} catch (e) {
  span.setStatus("internal_error");
  span.finish();
  throw e;
}
```

### 7.10.3 添加自定义 Tag 与 Measurement

**Tag**（标签）用于分组和筛选。建议使用低基数（有限枚举值）的 Tag：

```python
transaction.set_tag("user_tier", "premium")
transaction.set_tag("feature_flag.new_ui", "enabled")
```

**Measurement**（测量值）用于数值聚合（平均值、百分位等）：

```python
# 单位: millisecond（默认）
transaction.set_measurement("cache_warmup_time", 234.5, "millisecond")

# 单位: byte
transaction.set_measurement("response_size", 102400, "byte")

# 单位: none（无单位整数计数）
transaction.set_measurement("retry_count", 3, "none")
```

---

## 7.11 性能采样策略

### 7.11.1 采样决策的生命周期

Sentry 的性能数据采样涉及两个独立的决策点：

1. **客户端采样（Client-side Sampling）**：在 SDK 端决定是否发送 Transaction。由 `traces_sample_rate` 或 `traces_sampler` 配置控制。
2. **服务端采样（Server-side Sampling）**：在 Relay 端对已接收的 Transaction 进行二次采样，确保高流量服务不会压垮后端存储。

对应的两个属性在 Span 数据中分别记录为 `client_sample_rate` 和 `server_sample_rate`（见 `src/sentry/search/eap/spans/attributes.py:42-43`）：

```python
simple_sentry_field("client_sample_rate", search_type="number"),
simple_sentry_field("server_sample_rate", search_type="number"),
```

### 7.11.2 client_sample_rate 与 server_sample_rate

**client_sample_rate** 是 SDK 端配置的采样率，取值范围 (0, 1]：
- `1.0` = 100% 采样（所有 Transaction 都发送）
- `0.1` = 10% 采样
- `0.01` = 1% 采样

`server_sample_rate` 是 Relay 执行的二次采样率。当 Transaction 从客户端发送到 Relay 后，Relay 会根据项目的动态采样配置决定是否最终保留该 Transaction。

在实际查询中，这两个值用于**统计推断**——例如，计算实际 TPM 时需要除以有效采样率：

```
实际 TPM = 采样的 Transaction 数 / (client_sample_rate * server_sample_rate)
```

### 7.11.3 动态采样（Dynamic Sampling）

Sentry 的动态采样系统（Dynamic Sampling）是一套**自适应采样决策引擎**，运行在 Relay 侧。核心思想是：不是一刀切地按照固定比例采样，而是根据实时流量、Transaction 类型、和配额动态调整采样率。

其基本原理包括：

- **低流量 Transaction 优先保留**：对于 TPM 低的 Transaction，采样率自动升高（甚至 100%），确保稀有路径不被遗漏。
- **高流量 Transaction 降采样**：对于 TPM 高的 Transaction，采样率降低，控制总体数据量。
- **兜底采样**：保证每个 Transaction 类别至少有一定数量的样本被保留。

动态采样的实现在 `src/sentry/dynamic_sampling/` 目录下，通过分析实时的 Transaction 量数据和项目配额来生成采样规则。这些规则通过 Relay 的 Project Config 下发到 Relay 层执行。

### 7.11.4 采样偏差与统计推断

使用采样数据进行性能分析时，必须注意采样偏差：

- **百分位延迟**：对于随机采样，P50/P75/P95/P99 是无偏估计。但动态采样（偏向低流量路径）可能导致百分位估计略有偏差。
- **计数指标**：TPM、错误计数等必须使用采样率进行外推（extrapolation）。
- **稀有路径**：动态采样提升了稀有路径的覆盖率，因此带来的偏差恰恰是有益的——它帮助开发者发现"不易察觉"的性能问题。

在 Sentry 的 Discover 查询中，`count()` 以外的聚合函数（`p50()`, `p95()`, `avg()`）通常不需要手动外推，但 `count()` 和 `count_unique()` 需要结合采样上下文做修正。
