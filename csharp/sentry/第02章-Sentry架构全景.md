---
layout: default
title: 第二章：Sentry 架构全景
---

# 第二章：Sentry 架构全景

## 目录

- [2.1 整体架构概览](#21-整体架构概览)
- [2.2 核心组件详解](#22-核心组件详解)
  - [2.2.1 Web 前端 (React SPA + Django SSR)](#221-web-前端-react-spa--django-ssr)
  - [2.2.2 后端 API 层 (Django + Django REST Framework)](#222-后端-api-层-django--django-rest-framework)
  - [2.2.3 Relay (事件代理网关)](#223-relay-事件代理网关)
  - [2.2.4 Snuba (ClickHouse 查询引擎)](#224-snuba-clickhouse-查询引擎)
  - [2.2.5 Kafka (消息队列)](#225-kafka-消息队列)
  - [2.2.6 Celery / TaskBroker (任务队列)](#226-celery--taskbroker-任务队列)
  - [2.2.7 其他关键服务](#227-其他关键服务)
- [2.3 事件处理流水线](#23-事件处理流水线)
- [2.4 多区域架构 (Silos)](#24-多区域架构-silos)
- [2.5 技术栈总览](#25-技术栈总览)
- [2.6 部署模式对比](#26-部署模式对比)

---

## 2.1 整体架构概览

Sentry 是一个分布式、多层次的事件监控平台。其架构设计相当复杂：核心部分是一个基于 Django 的单体应用，但在 SaaS 生产环境中则拆分为多个独立的服务，通过消息队列和服务间通信协同工作。以下是从代码中抽象出的整体架构图：

```
                          +-------+
                          |  CDN  |
                          +---+---+
                              |
              +---------------+---------------+
              |                               |
        +-----v-----+                   +-----v-----+
        |  Webpack   |                   |  Nginx /  |
        |  DevServer |                   |  API GW   |
        +-----+-----+                   +-----+-----+
              |                               |
    +---------v----------+         +----------v---------+
    |  React SPA (前端)  |         |    Django 后端     |
    |  /issues/          |         |    /api/0/*        |
    |  /performance/  ...|         |    DRF Views       |
    +--------------------+         +--------+-----------+
                                            |
          +------------+-----------+--------+--------+------------+
          |            |           |        |        |            |
    +-----v-----+ +---v----+ +---v---+ +---v--+ +---v---+ +-----v-----+
    | PostgreSQL | | Redis | |Snuba  | |Kafka | |Relay  | |Symbolicator|
    |(主数据库)  | |(缓存) | |(CH查询| |(消息)| |(事件  | |(符号化)    |
    |            | |       | | 引擎) | |队列) | | 网关) | |           |
    +------------+ +-------+ +-------+ +------+ +-------+ +-----------+
```

以上是逻辑架构概览。在实际的 SaaS 部署中，整个系统还会进一步划分为 Control Silo 和 Region Silo 两个维度（详见 2.4 节）。

从 `devservices/config.yml` 的开发依赖清单中，可以看到 Sentry 开发环境最少需要以下服务才能启动（`minimal` 模式）：

- **postgres**：主关系型数据库
- **snuba**：ClickHouse 查询层

默认开发模式 (`default`) 则额外包含：

- **relay**：事件转发与接入服务
- **spotlight**：本地调试用的 Sidecar 开发工具
- **objectstore**：文件与二进制大对象存储

完整的开发模式 (`full`) 还会叠加 Kafka 消费进程、Symbolicator 符号化服务、任务队列（TaskBroker）、Vroom（Profiling 服务）、Uptime Checker 等十个以上额外服务。

这种分层设计体现了 Sentry 架构的核心哲学：**最小依赖启动核心功能，按需叠加扩展能力**。Monolith 模式下，Kafka Consumer、Celery、TaskBroker 等组件都运行在同一个 Django 进程内或通过子进程管理；而在 SaaS 生产环境中，每个组件都是独立的微服务。

下面从 `src/sentry/` 的目录结构中可以看到代码层面的核心模块划分：

| 模块 | 路径 | 职责 |
|------|------|------|
| API 端点 | `sentry/api/endpoints/` | REST API 实现，基于 DRF |
| Web 前端路由 | `sentry/web/` | URL 路由、React SPA 入口视图 |
| 事件接入 | `sentry/ingest/` | Kafka 消费、事件过滤与预处理 |
| 事件存储 | `sentry/eventstore/` | 事件数据的读写抽象 |
| 事件流 | `sentry/eventstream/` | 数据流的 Snuba 后端实现 |
| 查询层 | `sentry/snuba/` | 所有 Snuba/ClickHouse 查询的封装 |
| 任务系统 | `sentry/tasks/` | Celery 异步任务（post_process 等） |
| 规则引擎 | `sentry/rules/` | Issue Alert 的条件/动作规则 |
| 多区域 | `sentry/silo/` | Silo 模式隔离与访问控制 |
| 配置 | `sentry/conf/` | Django settings、Kafka 定义等 |

---

## 2.2 核心组件详解

### 2.2.1 Web 前端 (React SPA + Django SSR)

Sentry 的前端采用 **React 单页应用 (SPA)** 架构。开发时，前端代码由 Webpack DevServer 提供热更新，并通过反向代理将 API 请求转发给后端的 Django 服务。

生产环境中，React 构建产物作为静态资源由 Django 直接托管。

#### URL 路由机制

Sentry 的前端路由遵循 **`ReactPageView` 模式**：Django 在 `sentry/web/urls.py` 中注册大量 `re_path` 路由规则，绝大部分 URL 最终映射到 `ReactPageView` 这个通用视图。该视图渲染一个包含 React 挂载点的 HTML 模板，React Router 接管后续的客户端路由。

```python
# sentry/web/urls.py 中的典型路由模式
re_path(
    r"^(?P<organization_slug>[^/]+)/issues/(?P<group_id>\d+)/$",
    react_page_view,
    name="sentry-organization-issue",
),
```

前端支持的功能模块覆盖了 Sentry 的全产品矩阵：

| 路由前缀 | 功能模块 | 说明 |
|---------|---------|------|
| `/issues/` | Issues | 错误追踪、问题分组与详情 |
| `/performance/` | Performance | 性能监控、事务追踪 |
| `/releases/` | Releases | 版本管理与追踪 |
| `/crons/` | Crons | 定时任务监控 |
| `/profiling/` | Profiling | 代码性能分析 |
| `/replays/` | Session Replay | 用户会话回放 |
| `/explore/` | Explore | 可视化数据探索 |
| `/dashboards/` | Dashboards | 自定义仪表盘 |
| `/insights/` | Insights | 洞察分析 |
| `/alerts/` | Alerts | 告警管理 |
| `/feedback/` | User Feedback | 用户反馈 |
| `/discover/` | Discover | 事件查询与分析 |
| `/llm-monitoring/` | AI Monitoring | LLM 调用链监控 |
| `/traces/` | Traces | 分布式追踪 |

前端通过 `/api/client-config/` 端点获取运行时配置（如 DSN 公钥、功能开关等），由 `sentry/web/client_config.py` 下的 `ClientConfigView` 提供服务。

#### 静态资源管理

前端构建产物通过带版本哈希的 URL 托管：

```
/_static/dist/<module>/<path>     # 带 content hash 的 JS/CSS 资源
/_static/<version>/<module>/<path> # 带时间戳/哈希版本的传统路径
```

### 2.2.2 后端 API 层 (Django + Django REST Framework)

Sentry 的后端 API 层是整个系统的控制中枢。所有 API 端点统一挂载在 `/api/0/` 路径前缀下。

#### 框架选型

- **Web 框架**：Django（`django`）
- **REST API 框架**：Django REST Framework（`rest_framework`）
- **ASGI 服务器**：Granian（`SENTRY_USE_GRANIAN = True`，在 `server.py:2857`）
- **API 文档**：drf-spectacular（OpenAPI 3.0 自动生成）

#### API 端点结构

API 端点遵循 RESTful 设计，集中在 `sentry/api/endpoints/` 目录下。仅顶层 URL 路由文件就长达 3860 行，覆盖了数百个端点。以下列举部分关键端点组：

- **Organizations**: `/api/0/organizations/{org_slug}/`
- **Projects**: `/api/0/projects/{org_slug}/{project_slug}/`
- **Events/Issues**: `/api/0/projects/{org_slug}/{project_slug}/events/`
- **Releases**: `/api/0/organizations/{org_slug}/releases/`
- **Teams/Members**: `/api/0/organizations/{org_slug}/members/`

#### 中间件链

Sentry 在 `server.py` 中定义了严格的中间件执行顺序（第 390-419 行），以下是关键中间件及其职责：

```python
MIDDLEWARE = (
    "csp.middleware.CSPMiddleware",                    # 内容安全策略
    "sentry.middleware.health.HealthCheck",             # 健康检查端点
    "sentry.middleware.security.SecurityHeadersMiddleware", # 安全头
    "sentry.middleware.env.SentryEnvMiddleware",        # 环境变量注入
    "sentry.middleware.proxy.SetRemoteAddrFromForwardedFor", # 代理 IP 解析
    "sentry.middleware.stats.RequestTimingMiddleware",  # 请求计时统计
    "sentry.middleware.access_log.access_log_middleware",   # 访问日志
    "sentry.middleware.stats.ResponseCodeMiddleware",   # 响应码统计
    "sentry.middleware.subdomain.SubdomainMiddleware",  # 子域名路由
    "django.middleware.common.CommonMiddleware",        # Django 通用中间件
    "django.contrib.sessions.middleware.SessionMiddleware",  # 会话管理
    "django.middleware.csrf.CsrfViewMiddleware",        # CSRF 保护
    "sentry.middleware.auth.AuthenticationMiddleware",  # 认证（自定义）
    "sentry.middleware.suspended.SuspendedUserMiddleware", # 挂起用户检测
    "sentry.middleware.viewer_context.ViewerContextMiddleware", # 查看者上下文
    "sentry.middleware.integrations.IntegrationControlMiddleware", # 集成控制
    "sentry.hybridcloud.apigateway.middleware.ApiGatewayMiddleware", # API 网关
    "sentry.middleware.customer_domain.CustomerDomainMiddleware",   # 客户域名
    "sentry.middleware.sudo.SudoMiddleware",            # 提权操作验证
    "sentry.middleware.superuser.SuperuserMiddleware",  # 超级用户权限
    "sentry.middleware.staff.StaffMiddleware",          # 员工权限
    "sentry.middleware.locale.SentryLocaleMiddleware",  # 国际化
    "sentry.middleware.ratelimit.RatelimitMiddleware",  # 速率限制
    "django.contrib.messages.middleware.MessageMiddleware", # 消息提示
    "sentry.middleware.agent_discovery.AgentDiscoveryMiddleware", # AI Agent 发现
)
```

该中间件链的执行顺序体现了 Sentry 的安全和路由策略：CSP、安全头优先，然后是请求代理与统计，接着是 Django 标准中间件，再是 Sentry 自定义的认证、权限、多租户域名和限流逻辑。

#### 数据库配置

主数据库是 PostgreSQL，配置在 `server.py:253-264`：

```python
DATABASES = {
    "default": {
        "ENGINE": "sentry.db.postgres",  # 自定义 Django DB Backend
        "NAME": "sentry",
        "USER": "postgres",
        "HOST": "127.0.0.1",
        "AUTOCOMMIT": True,
        "ATOMIC_REQUESTS": False,
    }
}
```

Sentry 自定义了 `sentry.db.postgres` 作为 Django 的数据库引擎，以满足其特殊的连接管理和查询需求。

### 2.2.3 Relay (事件代理网关)

Relay 是 Sentry 事件处理管道中的**第一道防线**。它是一个用 **Rust** 编写的独立服务，负责接收来自 SDK 的所有事件数据，并在将数据转发到后端之前执行一系列关键的预处理操作。

#### 核心职责

1. **事件接收与验证**：接收来自各语言 SDK 的 HTTP 请求（错误事件、性能追踪、Session 等），验证数据格式和签名。

2. **速率限制 (Rate Limiting)**：根据项目配额对事件进行限流，超量事件直接丢弃，防止后端被突发流量淹没。这一层限流在事件到达 Kafka 之前就已完成，保护了整条管道。

3. **数据清洗 (Data Scrubbing)**：根据项目配置的敏感信息过滤规则（PII scrubbing），在事件进入存储系统之前擦除或脱敏敏感数据。相关代码位于 `sentry/relay/datascrubbing.py`。

4. **事件规范化**：将不同 SDK 版本发送的格式各异的原始事件数据，标准化为 Sentinel 内部统一的 Event Schema。

5. **负载均衡与路由**：将处理后的标准化事件转发到对应的 Kafka Topic（`ingest-events`、`ingest-transactions`、`ingest-attachments` 等）。

6. **Project Config 同步**：Relay 定期从 Django 后端拉取项目配置（采样率、过滤规则、DSN 验证等），在本地缓存。配置相关的代码位于 `sentry/relay/config/` 和 `sentry/relay/projectconfig_cache/`。

#### 架构位置

```
 SDK 客户端               Relay 集群               Kafka
+--------+            +---------------+        +----------+
| Python | ---HTTP---> | Relay 1      | -----> | ingest-  |
| SDK    |            | (速率限制)   |        | events   |
+--------+            | (数据清洗)   |        +----------+
                      | (规范化)     |
+--------+            |              | -----> +----------+
| JS SDK | ---HTTP---> | Relay 2      |        | ingest-  |
+--------+            +---------------+        | trans..  |
                                               +----------+
```

开发环境中，Relay 运行在端口 `127.0.0.1:7900`，配置在 `config/relay*.yml` 下。在 `cell-routing` 模式下，还会启动两个 Relay 实例 -- `relay-edge`（下游路由层）和 `relay-cell`（上游处理层）-- 来模拟多 Cell 环境下的路由场景。

#### 配置管理

Sentry 后端通过 `/api/0/relays/projectconfigs/` 端点向 Relay 提供项目配置，该端点在高 QPS 下为性能敏感路径，日志过滤配置中特别排除了对该路径的请求日志记录（`server.py:2995`）。

### 2.2.4 Snuba (ClickHouse 查询引擎)

Snuba 是 Sentry 数据查询栈中的核心组件。它构建在 ClickHouse 之上，提供事件数据的快速聚合和查询能力。从代码库中可以看到，Sentry 主仓库中有大量模块直接对 Snuba 发起查询。

#### 代码层面体现

`sentry/snuba/` 目录包含 38 个文件，涵盖了 Sentry 几乎所有数据产品的查询逻辑：

| 文件 | 查询对象 |
|------|---------|
| `snuba/events.py` | Error 事件查询 |
| `snuba/transactions.py` | Transaction 性能数据 |
| `snuba/discover.py` | Discover 多模型查询 |
| `snuba/sessions.py` | Session/健康数据 |
| `snuba/outcomes.py` | 事件处理结果统计 |
| `snuba/metrics/` | 自定义指标查询 |
| `snuba/spans_rpc.py` | Span 追踪数据 |
| `snuba/profiles.py` | Profiling 数据 |
| `snuba/replays.py` | Session Replay 数据 |
| `snuba/uptime_results.py` | Uptime 监控结果 |
| `snuba/ourlogs.py` | 日志数据 |

每个 Snuba 查询都标记了 `referrer`（来源标识），用于追踪查询来源和做速率控制：

```python
# 示例：Discover 查询的 referrer
SNUBA_REFERRER = "api.discover.query"
```

#### 与事件存储的关系

Sentry 的事件存储（EventStore）在 `sentry/eventstore/` 下提供了统一的事件读写抽象：写入走 `eventstream/snuba.py`（通过 Kafka 异步写入 ClickHouse），读取通过 `sentry/snuba/` 模块直接查询 ClickHouse。

这里使用了 **CQRS (命令查询职责分离)** 模式：写路径经过 Kafka 批量处理以追求吞吐，读路径直接查询 ClickHouse 以追求低延迟。

#### Snuba 的独立部署

在 `devservices/config.yml` 中，Snuba 有多个部署模式：

```
snuba          # 基础模式，标准查询 + 事件消费
snuba-profiling  # 包含 Profiling 数据的消费能力
snuba-metrics    # 包含 Metrics 指标数据的消费能力
```

此外，`SENTRY_DISTRIBUTED_CLICKHOUSE_TABLES = False`（`server.py:249`）是默认关闭的分布式表模式，在生产环境中通过 `getsentry` 配置开启。

### 2.2.5 Kafka (消息队列)

Kafka 是 Sentry 事件处理管道的中枢神经系统。**所有**事件数据在通过 Relay 的校验和规范化之后，都被写入到 Kafka 的不同 Topic 中，由专门的消费者进程消费并处理。

#### 主要 Topic 与消费者

从 `devservices/config.yml` 的 `x-programs` 区域可以清晰列出所有 Kafka 消费者及其对应的 `sentry run consumer` 命令：

**事件接入类 Consumer：**

| Consumer 名称 | 命令 | 消费的 Topic |
|-------------|------|-------------|
| `ingest-events` | `sentry run consumer ingest-events` | 错误事件 |
| `ingest-transactions` | `sentry run consumer ingest-transactions` | 性能事务 |
| `ingest-attachments` | `sentry run consumer ingest-attachments` | 事件附件（截图、文件） |
| `ingest-monitors` | `sentry run consumer ingest-monitors` | 定时任务检查 |
| `ingest-occurrences` | `sentry run consumer ingest-occurrences` | Issue 发生记录 |
| `ingest-feedback-events` | `sentry run consumer ingest-feedback-events` | 用户反馈事件 |
| `ingest-metrics` | `sentry run consumer ingest-metrics` | 指标数据 |
| `ingest-generic-metrics` | `sentry run consumer ingest-generic-metrics` | 通用指标 |
| `billing-metrics-consumer` | `sentry run consumer billing-metrics-consumer` | 计费用指标 |

**后续处理类 Consumer：**

| Consumer 名称 | 命令 | 消费的 Topic |
|-------------|------|-------------|
| `post-process-forwarder-errors` | `sentry run consumer post-process-forwarder-errors` | 错误后处理转发 |
| `post-process-forwarder-transactions` | `sentry run consumer post-process-forwarder-transactions` | 事务后处理转发 |
| `post-process-forwarder-issue-platform` | `sentry run consumer post-process-forwarder-issue-platform` | 问题平台后处理 |

**Span 与 Segment 处理：**

| Consumer 名称 | 命令 | 消费的 Topic |
|-------------|------|-------------|
| `process-spans` | `sentry run consumer process-spans` | Span 数据缓冲处理 |
| `process-segments` | `sentry run consumer process-segments` | 性能段数据处理 |

**监控相关 Consumer：**

| Consumer 名称 | 命令 |
|-------------|------|
| `monitors-clock-tick` | `sentry run consumer monitors-clock-tick` |
| `monitors-clock-tasks` | `sentry run consumer monitors-clock-tasks` |
| `monitors-incident-occurrences` | `sentry run consumer monitors-incident-occurrences` |

**Uptime 监控：**

| Consumer 名称 | 命令 |
|-------------|------|
| `uptime-results` | `sentry run consumer uptime-results` |

#### 开发环境监控模式

在 `devservices/config.yml` 中，Sentry 提供了多种开发模式组合，每种模式启动特定的 Kafka Consumer 组合。例如：

- **tracing 模式**：`ingest-events` + `ingest-transactions` + `ingest-metrics` + `ingest-generic-metrics` + `billing-metrics-consumer` + `post-process-forwarder-*` + `process-spans` + `process-segments` + `ingest-occurrences`

- **crons 模式**：`ingest-monitors` + `monitors-clock-tick` + `monitors-clock-tasks` + `monitors-incident-occurrences`

- **replay 模式**：`ingest-events` + `ingest-transactions`

这种分层设计允许开发者只启动当前调试所需的数据管道部分，而不是一次性拉起全部消费者。

### 2.2.6 Celery / TaskBroker (任务队列)

Sentry 的异步任务系统经历了从 Celery 到自定义 TaskBroker 的演进：

#### TaskBroker（新一代任务系统）

`taskbroker` 是 Sentry 自研的异步任务处理服务，在 `config.yml` 中有两种部署模式：

1. **taskbroker**（共享实例）：处理用户自定义的异步任务（如告警通知、数据导出、集成同步等）。通过远程仓库 `getsentry/taskbroker` 部署。

2. **taskbroker-sentry**（Sentry 专用实例）：处理 Sentry 内部管道任务，主要是 "raw-mode" 类型的高吞吐事件处理（`ingest-profiles`、`subscription results`、`replay recordings` 等）。端口为 `localhost:50052`。

对应的 Worker 由 `sentry run taskworker` 命令启动，负责消费 TaskBroker 中的任务并执行。

#### Celery（传统任务系统）

Celery 仍然被使用，特别是在 Post-Process 阶段（错误合并、告警触发、通知发送等）。`sentry/tasks/` 目录下有 50 个文件定义了各类异步任务：

```python
# sentry/eventstream/snuba.py 中 Post-Process 的触发方式
post_process_group.apply_async(
    kwargs={...},
    headers={"sentry-propagate-traces": False},
)
```

主要的 Celery 任务包括：

| 任务文件 | 职责 |
|---------|------|
| `tasks/store.py` | 事件持久化存储 |
| `tasks/post_process.py` | 事件后处理（告警触发、分组等） |
| `tasks/merge.py` | Issue 合并逻辑 |
| `tasks/unmerge.py` | Issue 拆分逻辑 |
| `tasks/process_buffer.py` | 缓冲数据批量写入 |
| `tasks/digests.py` | 通知摘要生成 |
| `tasks/clear_expired_*.py` | 过期数据清理 |

#### 任务调度器

`taskworker-scheduler` 是 TaskBroker 生态中的周期性任务调度器，通过 `sentry run taskworker-scheduler` 命令启动。它类似于 Celery Beat 的角色，但专门为 TaskBroker 设计。

### 2.2.7 其他关键服务

除上述核心组件外，Sentry 还依赖以下支撑服务：

#### Symbolicator（符号化服务）

Symbolicator 是一个独立的 Rust 服务，负责处理原生崩溃（Native Crash）的符号化。它将内存地址转换为函数名和源码位置。支持多种调试符号格式（PDB、DWARF、Breakpad）。

配置在 `server.py:2801-2815`，支持按符号化类型（`default`/`js`/`jvm`）路由到不同的处理池：

```python
SYMBOLICATOR_POOL_URLS: dict[str, str] = {
    # "default": "...",
    # "js": "...",
    # "jvm": "...",
}
```

#### Vroom（Profiling 服务）

Vroom 是 Sentry 的性能剖析（Profiling）数据处理服务，处理来自应用代码的调用栈采样数据。配置方式：

```python
SENTRY_VROOM = os.getenv("VROOM", "http://127.0.0.1:8085")
```

#### Seer（AI 辅助服务）

Seer 是 Sentry 的 AI/ML 服务，提供多项智能化功能，所有默认地址为 `http://127.0.0.1:9091`：

| 功能 | 超时设置 |
|------|---------|
| 异常断点检测 (`SEER_BREAKPOINT_DETECTION_URL`) | 5 秒 |
| 事件严重性评分 (`SEER_SEVERITY_TIMEOUT`) | 300 毫秒 |
| 自动修复 (`SEER_AUTOFIX_URL`) | - |
| 事件摘要 (`SEER_SUMMARIZATION_URL`) | - |
| 异常检测 (`SEER_ANOMALY_DETECTION_URL`) | 5 秒 |

#### Chartcuterie（图表渲染）

Chartcuterie 负责将图表数据渲染为 PNG 图片，用于告警通知中的图表附件。

#### Uptime Checker

Sentry 的可用性监控服务，定期向配置的 URL 发起健康检查请求，检测结果通过 `uptime-results` Kafka Consumer 流入系统。

#### Spotlight

Spotlight 是本地开发的调试辅助工具，运行在 `127.0.0.1:8969`，允许开发者在浏览器中实时查看本地产生的 Sentry 事件。开发环境中通过 `SENTRY_SPOTLIGHT` 环境变量控制。

---

## 2.3 事件处理流水线

从 SDK 捕获一个异常到最终在 Sentry 的 Issue 页面中展示，事件经历了一条缜密的处理流水线。以下是完整的数据流：

```
[Step 1] SDK 客户端捕获异常
    |  (序列化为 JSON, 附带 DSN 公钥)
    v
[Step 2] Relay (事件代理)
    |  入口: HTTPS endpoint (如 o{org_id}.ingest.sentry.io)
    ├─ 验证 DSN 公钥
    ├─ 检查项目配额 (Rate Limiting)
    ├─ 数据清洗 (PII Scrubbing)
    ├─ 事件规范化 (Normalization)
    └─ 路由到对应 Kafka Topic
    |
    |  输出:
    ├─ ingest-events (Error 事件)
    ├─ ingest-transactions (Performance 事务)
    ├─ ingest-attachments (附件)
    ├─ ingest-monitors (Cron 监控)
    └─ ingest-metrics (指标数据)
    v
[Step 3] Kafka Topics (消息缓冲)
    |  持久化存储, 分区并行消费
    v
[Step 4] Ingest Consumers (Kafka 消费进程)
    |  由 `sentry run consumer ingest-*` 命令启动
    ├─ ingest-events Consumer:
    |   ├─ 解析事件数据
    |   ├─ 应用 Inbound Filters (sentry/ingest/inbound_filters.py)
    |   ├─ 事务聚类 (sentry/ingest/transaction_clusterer/)
    |   ├─ 事件分组 (Event Grouping): 根据异常栈生成 fingerprint
    |   ├─ 写入 PostgreSQL: 事件元数据、Issue Group
    |   ├─ 写入 Nodestore: 完整事件 JSON (sentry/nodestore/)
    |   └─ 写入 EventStream (Kafka -> Snuba 消费者)
    |
    ├─ ingest-transactions Consumer:
    |   └─ 类似流程, 处理 Transaction 事件到 Snuba
    |
    └─ 其他 Consumers: 各自处理对应数据类型
    v
[Step 5] EventStream -> Snuba Consumer
    |  (sentry/eventstream/snuba.py)
    |  将事件数据写入 ClickHouse 的对应表
    |
    |  数据分层:
    ├─ errors 表: Error 事件
    ├─ transactions 表: 性能事务
    ├─ discover 表: 统一查询视图
    ├─ spans 表: Span 追踪数据
    ├─ sessions 表: 健康数据
    ├─ outcomes 表: 处理结果统计
    └─ metrics 表: 自定义指标
    v
[Step 6] Post-Process Forwarder (后处理转发)
    |  (sentry/post_process_forwarder/post_process_forwarder.py)
    |  从 eventstream 消费后, 触发异步后处理任务
    v
[Step 7] Celery / TaskBroker (异步后处理)
    |  post_process_group.apply_async()
    ├─ 触发 Issue Alert 规则检查 (sentry/rules/)
    ├─ 发送通知 (Email, Slack, PagerDuty 等)
    ├─ 调用 Seer AI 服务进行:
    |   ├─ 事件严重性评分
    |   ├─ 异常断点分析
    |   └─ AI 摘要生成
    ├─ 更新 Issue 统计数据
    └─ 记录 Outcomes (事件处理结果)
    v
[Step 8] Snuba (查询响应)
    |  Web 前端通过 /api/0/ 端点查询 Snuba
    |  sentry/snuba/ 下的查询模块封装 ClickHouse SQL
    v
[Step 9] React SPA (前端展示)
    用户在浏览器看到 Issues, Performance, Alerts 等界面
```

#### 关键设计点

1. **Relay 作为护城河**：所有事件在进入 Kafka 之前必须经过 Relay 的验证和限流。这一步保护了整条管道不被恶意或异常流量压垮。

2. **Kafka 作为解耦层**：Relay 到 Ingest Consumer 之间通过 Kafka 解耦。消息在多分区中持久化，消费者可以独立扩缩容。

3. **双写体系 (PostgreSQL + ClickHouse)**：元数据（Issue 信息、项目配置、用户数据）写入 PostgreSQL；海量事件数据和聚合数据通过 EventStream 写入 ClickHouse/Snuba。查询时根据需求选择数据源。

4. **Nodestore 作为事件体存储**：完整的事件 JSON 正文（可能包含数百 KB 的上下文变量）存储在 Nodestore（默认基于 PostgreSQL 的 `nodestore_node` 表），而事件索引信息存入 ClickHouse 供快速查询。

5. **后处理分离**：事件的摄取写入和后续处理（告警、通知）通过 Post-Process Forwarder 解耦。事件可以先快速入库，告警和通知异步处理，不阻塞接入管道。

---

## 2.4 多区域架构 (Silos)

Sentry 的 Multi-Region / Hybrid Cloud 架构是其 SaaS 部署的核心基础设施。从代码中的 `sentry/silo/` 模块可以清晰地看到设计意图。

#### SiloMode 枚举

在 `sentry/silo/base.py:21-29` 中定义了三种 Silo 模式：

```python
class SiloMode(Enum):
    MONOLITH = "MONOLITH"   # 单体模式 (Self-Hosted)
    CONTROL = "CONTROL"     # 控制平面
    CELL = "REGION"         # 区域平面 (Region Silo)
```

#### 三种模式的架构对比

**Monolith 模式**（单体模式）：

```
+--------------------------------------------------+
|              单一 Django 进程                     |
|  +-----------+  +-----------+  +--------------+  |
|  | Web 前端  |  | REST API  |  | 所有数据模型  |  |
|  | (React)   |  | (DRF)     |  | (DB access)  |  |
|  +-----------+  +-----------+  +--------------+  |
|  +-------------------------------------------+    |
|  |       内置 Kafka Consumer / Celery         |    |
|  +-------------------------------------------+    |
+--------------------------------------------------+
         |                |
    +----v----+     +----v----+
    |PostgreSQL|    | ClickHouse|
    +---------+     +---------+

特点: 所有模型和端点均可访问, 单数据库, 适合小规模部署
```

**Control Silo + Region Silo 模式**（SaaS 模式）：

```
+-------------------------------+    +-------------------------------+
|       Control Silo (单例)     |    |   Region Silo (US 区域实例)   |
|  - 全局用户账号               |    |  - 客户事件数据              |
|  - 全局组织元数据             |    |  - 项目配置                  |
|  - 计费信息                   |    |  - Issue 分组                |
|  - 集成配置                   |    |  - 告警规则                  |
|  - API Token 管理            |    |  - 成员角色 (本地缓存)       |
|                               |    |                               |
|  PostgreSQL (control)         |    |  PostgreSQL (region)          |
|                               |    |  ClickHouse (region)          |
+-------------+-----------------+    +--------------+----------------+
              |                                     |
              |  RPC/Silo Client 通信               |
              +<----------------------------------->+

                      +-------------------------------+
                      |   Region Silo (EU 区域实例)  |
                      |  (结构与 US 区域相同)        |
                      |  (区域间不通信)              |
                      +-------------------------------+

特点:
  - Control Silo 全局只有一个
  - Region Silo 可以有多个 (每个地理区域一个)
  - Region Silo 之间不直接通信
  - 实现数据驻留 (Data Residency)
```

#### 访问控制

`SiloLimit` 类（`sentry/silo/base.py:102`）提供了端点级和函数级的 Silo 隔离控制：

```python
# 标记函数仅在 Control Silo 可用
control_silo_function = FunctionSiloLimit(SiloMode.CONTROL)

# 标记函数仅在 Region Silo 可用
cell_silo_function = FunctionSiloLimit(SiloMode.CELL)

# 标记函数在所有非 Monolith Silo 可用
all_silo_function = FunctionSiloLimit(SiloMode.CELL, SiloMode.CONTROL)
```

当在测试环境中越界调用时，会抛出 `SiloLimit.AvailabilityError`：

```python
class AvailabilityError(Exception):
    """Indicate that something in unavailable in the current silo mode."""
```

#### 开发环境 Silo 运行

在本地开发中，通过 `sentry devserver --silo=control` 和 `sentry devserver --silo=region` 可以分别启动两种 Silo 实例：

```
sentry devserver --silo=control --celery-beat --workers   # Port 8001
sentry devserver --silo=region --celery-beat --workers --ingest  # Port 8010
```

在 Silo 模式下，数据库被物理分割为 `sentry`（原单体 DB）、`control` DB 和 `region` DB 三部分，通过 `bin/split-silo-database` 工具完成数据分离。

#### Outbox 模式

Sentry 使用 Outbox 模式处理跨 Silo 的数据同步：

```python
SENTRY_OUTBOX_MODELS = {
    "CONTROL": ["sentry.ControlOutbox"],
    "CELL": ["sentry.CellOutbox"],
}
```

Control Outbox 记录需要在 Region Silo 中生效的变更（如组织配置更新），Region Outbox 记录需要通知 Control Silo 的事件（如用量统计）。通过定期同步保证最终一致性。

---

## 2.5 技术栈总览

以下是 Sentry 完整的技术栈一览：

### 编程语言

| 语言 | 用途 | 关键库/框架 |
|------|------|-----------|
| Python 3 | 后端核心 | Django, DRF, Celery, typed |
| TypeScript / JavaScript | Web 前端 | React, Emotion (CSS-in-JS) |
| Rust | 高性能服务 | Relay, Symbolicator |

### 后端框架与库

| 组件 | 技术 | 说明 |
|------|------|------|
| Web 框架 | Django 5.x | 全功能 Web 框架 |
| REST API | Django REST Framework | API 序列化、认证、权限 |
| ASGI 服务器 | Granian | 替代 Gunicorn/uWSGI (`SENTRY_USE_GRANIAN = True`) |
| ORM | Django ORM + 自定义 PostgreSQL Backend | `sentry.db.postgres` |
| 数据库迁移 | Django Migrations | 支持零停机迁移 (`django-pg-zero-downtime-migrations`) |
| API 文档 | drf-spectacular | OpenAPI 3.0 自动生成 |
| 异步任务 (传统) | Celery | Post-Process、通知、清理等 |
| 异步任务 (新一代) | TaskBroker (自研) | 高吞吐管道任务 |
| 模板引擎 | Django Templates | SSR 页面和邮件 |
| 认证 | django.contrib.auth + 自定义 Auth Middleware | 多 SSO Provider 支持 |
| 搜索 | Django + Algolia + 自定义 Search | `sentry/search/` |
| Webpack | Webpack DevServer | 前端开发热更新 |
| 测试 | pytest, unittest | `sentry/testutils/` |

### 数据存储

| 数据库 | 用途 | 代码路径 |
|--------|------|---------|
| PostgreSQL | 主数据库（元数据、配置、Issue 信息） | `sentry/db/postgres.py` |
| ClickHouse | 时序事件数据（通过 Snuba） | `sentry/snuba/` |
| Redis | 缓存、会话、速率限制、流控 | 多个 `SENTRY_*_REDIS_CLUSTER` 配置项 |
| Memcached | 缓存（可选） | `sentry/cache/` |
| Nodestore | 事件完整 JSON 正文 | `sentry/nodestore/` |
| Filestore / Objectstore | 附件、Source Map、大文件 | `sentry/filestore/`, `sentry/objectstore/` |
| Bigtable (Emulator) | 测试环境模拟 Google Bigtable | |

PostgreSQL 作为 "Source of Truth"，存储所有非海量事件数据；ClickHouse 是查询性能的核心保障，支撑了 Issues、Performance、Discover 等所有数据产品。

Redis 在 Sentry 中的使用极其广泛，仅从 `server.py` 中就能看到约 20 个不同用途的 Redis Cluster 配置：

```python
SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER = "default"    # 动态采样规则
SENTRY_RATE_LIMIT_REDIS_CLUSTER = "default"                 # 速率限制
SENTRY_RULE_TASK_REDIS_CLUSTER = "default"                  # 规则任务
SENTRY_SPAN_BUFFER_CLUSTER = "default"                      # Span 缓冲
SENTRY_MONITORS_REDIS_CLUSTER = "default"                   # 定时任务监控
SENTRY_UPTIME_DETECTOR_CLUSTER = "default"                  # 可用性检测
# ... 还有十几个其他用途
```

### 消息队列

| 组件 | 用途 | 代码路径 |
|------|------|---------|
| Apache Kafka | 事件管道核心 | `sentry/eventstream/`, `sentry/consumers/` |
| TaskBroker (gRPC) | 新一代异步任务队列 | `sentry/taskworker/` |
| Celery (Redis/RabbitMQ) | 传统异步任务队列 | `sentry/tasks/` |

### 前端技术

| 组件 | 技术/库 | 说明 |
|------|--------|------|
| UI 框架 | React | SPA 架构 |
| 状态管理 | Reflux / React Context | |
| CSS 方案 | Emotion (CSS-in-JS) | |
| 图表可视化 | ECharts / 自定义 SVG | Sentry 维护了自己的 `chartcuterie` 图表渲染服务 |
| 路由 | React Router + Django URL 分发 | |
| 静态托管 | Django Static Files | `/_static/` 路径 |

### 外部集成

Sentry 内置了大量第三方服务的集成支持（均在 `sentry/integrations/` 目录下）：

- **通信工具**: Slack, Discord, Microsoft Teams
- **项目管理**: Jira, Jira Server
- **代码托管**: GitHub, GitHub Enterprise, GitLab, Bitbucket, Bitbucket Server
- **部署平台**: Vercel
- **代码编辑器**: Cursor (AI Agent)

---

## 2.6 部署模式对比

Sentry 支持三种部署模式，由 `sentry/conf/types/sentry_config.py` 中的 `SentryMode` 定义：

```python
SentryMode = StrEnum("SentryMode", ("SELF_HOSTED", "SINGLE_TENANT", "SAAS"))
```

### 模式对比表

| 特性 | Self-Hosted | Single Tenant | SaaS |
|------|-----------|---------------|------|
| **Silo 模式** | Monolith | 可配置 | Control + Region |
| **数据库** | 单个 PostgreSQL | 单个 PostgreSQL | 分离的 Control DB + Region DB |
| **Kafka** | 可选（Monolith 内嵌） | 独立集群 | 独立集群 |
| **Relay** | 内置 Relay | 独立 Relay 集群 | 全球分布的 Relay 集群 |
| **数据驻留** | 不支持 | 支持（单区域） | 支持（多区域） |
| **水平扩展** | 有限 | 中等 | 完全水平扩展 |
| **Silo 管理界面** | /manage/ 可用 | /manage/ 可用 | /manage/ 不可用 |
| **适用场景** | 小团队、企业内部 | 中大型企业、合规需求 | 公有云服务 |

三种模式的代码路径差异体现在多个层面。例如，`/manage/` 管理界面仅在非 SaaS 模式下加载（`sentry/web/urls.py:116-124`）：

```python
if settings.SENTRY_MODE != SentryMode.SAAS:
    urlpatterns += [
        re_path(r"^manage/", react_page_view, name="sentry-admin-overview"),
    ]
```

### 开发环境的模式选择

在 `devservices/config.yml` 中，Sentry 为开发环境提供了不同的服务组合模式：

- **minimal**（最小模式）：`postgres + snuba` -- 仅启动数据库，适用于简单调试
- **default**（默认模式）：`snuba + postgres + relay + spotlight + objectstore`
- **tracing**（追踪模式）：叠加事件接入和 Metrics 相关的全部消费者
- **crons**：Cron 监控专用模式
- **profiling**：Profiling 性能分析专用模式
- **full**（完整模式）：启动所有已知服务
- **cell-routing**：多 Cell 路由开发模式（包含 `synapse` 路由代理和 Relay 链）

这种模式化设计让开发者可以根据当前工作需要**精确选择**启动哪些服务，避免资源浪费。

### 架构演进的本质

Sentry 的架构设计本质上是一个**从单体到分布式渐进演进**的过程：

1. Monolith 模式保留了快速启动、简单运维的优势，适合自托管和小规模使用。
2. Silo 模式在保留 Django 代码单体结构的同时，通过运行时隔离实现了数据物理分离，满足了 SaaS 多区域数据驻留的需求。
3. 关键路径（Relay、Kafka、Snuba）从一开始就被设计为可独立扩展的服务，使得架构可以在不重写核心逻辑的情况下从单体扩展到分布式。

这种设计使得同一份代码库可以同时服务三种截然不同的部署场景，极大地降低了维护成本。
