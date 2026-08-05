---
layout: default
title: 第五章：SDK 集成与事件上报机制
---

- [5.1 Sentry SDK 体系概览](#51-sentry-sdk-体系概览)
  - [5.1.1 官方 SDK 支持语言一览](#511-官方-sdk-支持语言一览)
  - [5.1.2 SDK 的层次结构](#512-sdk-的层次结构)
  - [5.1.3 SDK 协议版本](#513-sdk-协议版本)
- [5.2 SDK 核心工作原理](#52-sdk-核心工作原理)
  - [5.2.1 初始化流程：sentry_sdk.init](#521-初始化流程sentry_sdkinit)
  - [5.2.2 Scope — 作用域系统](#522-scope--作用域系统)
  - [5.2.3 Hub/Client 模式](#523-hubclient-模式)
  - [5.2.4 Transport — 传输层](#524-transport--传输层)
- [5.3 事件（Event）数据结构详解](#53-事件event数据结构详解)
  - [5.3.1 Event ID](#531-event-id)
  - [5.3.2 Timestamp](#532-timestamp)
  - [5.3.3 Platform](#533-platform)
  - [5.3.4 Level](#534-level)
  - [5.3.5 Logger](#535-logger)
  - [5.3.6 Transaction](#536-transaction)
  - [5.3.7 Exception 接口](#537-exception-接口)
  - [5.3.8 Stacktrace 接口](#538-stacktrace-接口)
  - [5.3.9 Mechanism 机制对象](#539-mechanism-机制对象)
  - [5.3.10 Message / Logentry 接口](#5310-message--logentry-接口)
  - [5.3.11 Breadcrumbs 接口](#5311-breadcrumbs-接口)
  - [5.3.12 User 接口](#5312-user-接口)
  - [5.3.13 Contexts 上下文接口](#5313-contexts-上下文接口)
  - [5.3.14 Tags](#5314-tags)
  - [5.3.15 Extra](#5315-extra)
  - [5.3.16 Release 与 Dist](#5316-release-与-dist)
  - [5.3.17 Environment](#5317-environment)
  - [5.3.18 Fingerprint](#5318-fingerprint)
  - [5.3.19 SDK 元数据](#5319-sdk-元数据)
  - [5.3.20 Threads 线程信息](#5320-threads-线程信息)
  - [5.3.21 Spans 跨度信息](#5321-spans-跨度信息)
  - [5.3.22 Request 与 Template 接口](#5322-request-与-template-接口)
- [5.4 错误捕获机制](#54-错误捕获机制)
  - [5.4.1 全局异常处理器](#541-全局异常处理器)
  - [5.4.2 Try-Catch 手动上报](#542-try-catch-手动上报)
  - [5.4.3 Unhandled Rejection](#543-unhandled-rejection)
  - [5.4.4 原生崩溃捕获](#544-原生崩溃捕获)
- [5.5 Breadcrumbs（面包屑）机制](#55-breadcrumbs面包屑机制)
  - [5.5.1 Breadcrumbs 数据结构](#551-breadcrumbs-数据结构)
  - [5.5.2 自动记录类型](#552-自动记录类型)
  - [5.5.3 手动添加面包屑](#553-手动添加面包屑)
- [5.6 Context 上下文信息](#56-context-上下文信息)
  - [5.6.1 User 上下文](#561-user-上下文)
  - [5.6.2 Tags 标签](#562-tags-标签)
  - [5.6.3 Extra 附加数据](#563-extra-附加数据)
  - [5.6.4 Scope 作用域管理](#564-scope-作用域管理)
  - [5.6.5 Scope 泄露检测：Sentry 的实际实践](#565-scope-泄露检测sentry-的实际实践)
- [5.7 事件上报流程：SDK 端到 Sentry 端的完整链路](#57-事件上报流程sdk-端到-sentry-端的完整链路)
  - [5.7.1 整体架构概览](#571-整体架构概览)
  - [5.7.2 第一阶段：SDK 端数据收集与发送](#572-第一阶段sdk-端数据收集与发送)
  - [5.7.3 第二阶段：Relay 网关处理](#573-第二阶段relay-网关处理)
  - [5.7.4 第三阶段：Kafka 消息队列](#574-第三阶段kafka-消息队列)
  - [5.7.5 第四阶段：Ingest Consumer 消费](#575-第四阶段ingest-consumer-消费)
  - [5.7.6 第五阶段：preprocess_event 预处理](#576-第五阶段preprocess_event-预处理)
  - [5.7.7 第六阶段：EventManager.normalize 规范化](#577-第六阶段eventmanagernormalize-规范化)
  - [5.7.8 第七阶段：EventManager.save 保存](#578-第七阶段eventmanagersave-保存)
  - [5.7.9 第八阶段：post_process_group 后处理](#579-第八阶段post_process_group-后处理)
  - [5.7.10 完整链路时序图](#5710-完整链路时序图)
- [5.8 Before Send / Event Processors](#58-before-send--event-processors)
  - [5.8.1 before_send 回调](#581-before_send-回调)
  - [5.8.2 before_send_transaction 回调](#582-before_send_transaction-回调)
  - [5.8.3 Event Processor 处理器](#583-event-processor-处理器)
  - [5.8.4 敏感数据脱敏](#584-敏感数据脱敏)
  - [5.8.5 Sentry 自己的 before_send 实践](#585-sentry-自己的-before_send-实践)
- [5.9 多语言 SDK 集成实战](#59-多语言-sdk-集成实战)
  - [5.9.1 Python（sentry-sdk）](#591-pythonsentry-sdk)
  - [5.9.2 JavaScript/TypeScript（@sentry/browser）](#592-javascripttypescriptsentrybrowser)
  - [5.9.3 Java（sentry-java）](#593-javasentry-java)
  - [5.9.4 .NET（Sentry.AspNetCore）](#594-netsentryaspnetcore)
- [5.10 SDK 性能与最佳实践](#510-sdk-性能与最佳实践)
  - [5.10.1 采样率配置](#5101-采样率配置)
  - [5.10.2 事件批量发送](#5102-事件批量发送)
  - [5.10.3 传输队列管理](#5103-传输队列管理)
  - [5.10.4 敏感数据处理](#5104-敏感数据处理)
  - [5.10.5 健康检查排除](#5105-健康检查排除)
  - [5.10.6 最佳实践总结](#5106-最佳实践总结)

# 第五章：SDK 集成与事件上报机制

Sentry 的核心功能是在应用程序发生错误时，将错误信息（包括堆栈跟踪、上下文信息、用户环境等）从客户端 SDK 上报到 Sentry 服务端。本章深入分析 Sentry SDK 的架构设计、事件数据结构的完整定义、错误捕获机制的原理，以及从 SDK 端到 Sentry 服务端 `event_manager.save()` 的完整上报链路。

本章的分析基于 Sentry 代码库中的以下核心模块：

- `src/sentry/event_manager.py` — 事件管理核心，负责事件的规范化（normalize）与持久化（save）
- `src/sentry/interfaces/` — 事件中各类接口（Exception、Stacktrace、Breadcrumbs、User 等）的结构定义
- `src/sentry/ingest/` — Kafka 消费者、入站过滤、事件预处理
- `src/sentry/utils/sdk.py` — Sentry 自己使用 Sentry SDK 的配置封装

---

## 5.1 Sentry SDK 体系概览

### 5.1.1 官方 SDK 支持语言一览

Sentry 为几乎所有主流编程语言和框架提供了官方 SDK，覆盖了从后端服务、前端浏览器到移动端应用的全场景：

| 语言/平台 | SDK 包名 | 版本管理 | 典型集成方式 |
| --- | --- | --- | --- |
| Python | `sentry-sdk` | PyPI | `sentry_sdk.init(dsn=...)` |
| JavaScript/TypeScript | `@sentry/browser` / `@sentry/node` | npm | `Sentry.init({ dsn: ... })` |
| Java | `sentry` / `sentry-spring-boot-starter` | Maven Central | Spring Boot 自动配置 |
| .NET | `Sentry.AspNetCore` | NuGet | `builder.UseSentry()` |
| Go | `sentry-go` | Go Modules | `sentry.Init(sentry.ClientOptions{...})` |
| PHP | `sentry/sentry` | Composer | `\Sentry\init(['dsn' => '...'])` |
| Ruby | `sentry-ruby` | RubyGems | `Sentry.init { ... }` |
| Rust | `sentry` | crates.io | `let _guard = sentry::init(...)` |
| React Native | `@sentry/react-native` | npm | `Sentry.init({ dsn: ... })` |
| Flutter/Dart | `sentry_flutter` | pub.dev | `SentryFlutter.init(...)` |
| Apple（Swift/ObjC） | `sentry-cocoa` | CocoaPods / SPM | `SentrySDK.start { ... }` |
| Android | `sentry-android` | Gradle | `SentryAndroid.init(this)` |
| Unity | `sentry-unity` | UPM | 编辑器内配置 |
| Unreal Engine | `sentry-unreal` | Marketplace | 蓝图配置 |
| C/C++ | `sentry-native` | CMake | `sentry_init(options)` |

从 Sentry 服务端源码 `src/sentry/interfaces/sdk.py` 中可以看到，每个上报的事件都携带了 SDK 元数据：

```python
class Sdk(Interface):
    """
    The SDK used to transmit this event.

    >>> {
    >>>     "name": "sentry.java",
    >>>     "version": "1.7.10",
    >>>     "integrations": ["log4j"],
    >>>     "packages": [
    >>>         {
    >>>             "name": "maven:io.sentry.sentry",
    >>>             "version": "1.7.10",
    >>>         }
    >>>     ]
    >>> }
    """
```

其中 `name`（SDK 名称）、`version`（版本号）、`integrations`（启用的集成列表）、`packages`（关联的包信息）构成完整的 SDK 身份标识，帮助 Sentry 服务端了解事件的来源。

### 5.1.2 SDK 的层次结构

Sentry SDK 的设计遵循统一的层次架构，所有语言 SDK 实现都遵循相同的抽象模式：

```
+--------------------------------------------------+
|                  Application Code                 |
+------------------------+-------------------------+
|     Integrations       |  Manual API Calls       |
| (Django, Flask, etc.)  | (capture_exception, etc.) |
+------------------------+-------------------------+
|              Scope Management                     |
|   (Tags, Context, User, Breadcrumbs, Fingerprint) |
+--------------------------------------------------+
|            Hub / Client (Event Pipeline)           |
|   (before_send, event_processors, transports)     |
+--------------------------------------------------+
|                  Transport                        |
|   (HTTP, Queue, Background Thread)               |
+--------------------------------------------------+
|              Sentry Server / Relay                |
+--------------------------------------------------+
```

每一层的职责如下：

1. **Integrations**（集成层）：为特定框架（Django、Flask、Express、Spring 等）提供自动化集成，自动注入错误处理和性能追踪。这些集成本身不修改应用代码，而是依赖框架提供的钩子机制（middleware、filter、interceptor 等）进行拦截。

2. **Scope Management**（作用域管理）：管理事件附带的上下文数据，包括 Tags、User、Breadcrumbs、Extra 等。Scope 是 Sentry SDK 中的核心概念——它定义了一个"当前上下文"，在给定的执行路径中（一个 HTTP 请求、一个后台任务等）自动附加到所有事件上。

3. **Hub / Client**（事件管道）：Hub 是 SDK 的中央协调器，负责管理 Scope 栈和 Client 实例。Client 实现了实际的事件处理流程，包括运行 before_send 回调、调用 event process、将事件发送到 Transport。

4. **Transport**（传输层）：负责将序列化后的事件数据通过网络发送到 Sentry 服务端或 Relay。支持异步、批处理、重试、队列等机制。

### 5.1.3 SDK 协议版本

Sentry 采用版本化的 Event 协议。在 `event_manager.py:352` 中可以看到：

```python
def __init__(
    self,
    data: MutableMapping[str, Any],
    version: str = "5",
    ...
):
```

当前协议版本为 `5`。该版本号决定了事件的 JSON 结构格式、字段命名和接口定义规则。所有 SDK 都需要按照该协议版本序列化事件数据，确保不同语言和版本 SDK 发送的事件能够被统一处理。

---

## 5.2 SDK 核心工作原理

### 5.2.1 初始化流程：sentry_sdk.init

所有 Sentry SDK 的入口都是 `init()` 函数。以 Python SDK 为例，初始化代码通常如下：

```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://examplePublicKey@o0.ingest.sentry.io/0",
    environment="production",
    release="myapp@1.0.0",
    traces_sample_rate=0.2,
    max_breadcrumbs=100,
    before_send=strip_sensitive_data,
)
```

从 Sentry 自身初始化 SDK 的代码 `src/sentry/utils/sdk.py:355-612` 中，可以看到一个更复杂的初始化过程：

```python
def configure_sdk():
    """
    Setup and initialize the Sentry SDK.
    """
    sdk_options, dsns = _get_sdk_options()

    # 创建传输层
    if dsns.sentry4sentry:
        transport = make_transport(get_options(dsn=dsns.sentry4sentry, **sdk_options))
        sentry4sentry_transport = patch_transport_for_instrumentation(transport, "upstream")

    # 初始化 SDK
    sentry_sdk.init(
        dsn=dsns.sentry4sentry,
        transport=MultiplexingTransport,
        integrations=integrations,
        **sdk_options,
    )
```

初始化过程包含以下关键步骤：

1. **解析 DSN**：从 DSN（Data Source Name）中提取公钥、主机地址和项目 ID
2. **创建 Transport**：根据 DSN 创建 HTTP 传输通道
3. **注册 Integrations**：加载并激活框架集成（DjangoIntegration、LoggingIntegration、RedisIntegration 等）
4. **创建 Client**：构建事件处理的核心客户端对象
5. **创建全局 Hub**：初始化全局 Hub，绑定 Client 和初始 Scope

### 5.2.2 Scope — 作用域系统

Scope 是 Sentry SDK 中最核心的概念之一。它用于管理事件附带的上下文信息，这些信息会在事件被捕获时自动附加到事件数据中。SDK 支持四种 Scope 类型：

| Scope 类型 | API 方法 | 生命周期 |
| --- | --- | --- |
| Isolation Scope | `sentry_sdk.get_isolation_scope()` | 线程/协程隔离，不跨执行单元传播 |
| Current Scope | `sentry_sdk.get_current_scope()` | 随调用链传播，可被 push/pop |
| Global Scope | `sentry_sdk.get_global_scope()` | 全局共享，进程生命周期内持续有效 |
| New Scope | `sentry_sdk.new_scope()` | 创建隔离的作用域副本 |

在 Sentry 自己的代码中（`src/sentry/utils/sdk.py:127`），可以看到大量使用 Isolation Scope 的实践：

```python
def is_current_event_safe():
    scope = sentry_sdk.get_isolation_scope()
    if scope._tags.get(UNSAFE_TAG):
        return False
    project_id = scope._tags.get("processing_event_for_project")
    if project_id and project_id == settings.SENTRY_PROJECT:
        return False
    ...
```

Scope 上可设置的数据类型包括：

- **Tags**：键值对标签，用于分类和搜索（如 `environment`、`handled`）
- **Extra**：任意附加数据，支持嵌套结构（如请求参数、响应数据）
- **User**：用户信息（id、email、username、ip_address）
- **Contexts**：结构化上下文（如 `os`、`device`、`app`、`runtime`）
- **Breadcrumbs**：面包屑事件时间线
- **Level**：事件严重级别
- **Fingerprint**：分组指纹
- **Transaction**：事务名称

### 5.2.3 Hub/Client 模式

Hub/Client 模式是 Sentry SDK 中较为独特的设计。不同语言 SDK 的实现略有差异，但核心概念一致：

- **Hub**：维护一个 Scope 栈，管理当前活跃的 Scope。当调用 `capture_exception()` 时，Hub 将当前的 Scope 数据合并到事件中，然后委托 Client 处理。
- **Client**：接收事件数据，运行 before_send 回调和 event processor，最后通过 Transport 发送事件。

从 `src/sentry/utils/sdk.py:20-21` 的导入声明中可以看到：

```python
from sentry_sdk import Scope, capture_exception, capture_message, isolation_scope
```

Python SDK 提供了与这些概念直接交互的顶层 API。

### 5.2.4 Transport — 传输层

Transport 负责将事件数据发送到 Sentry 服务端。标准的 Transport 实现基于 HTTP POST 请求，将事件以 JSON 格式发送到 DSN 指定的端点。

从 `src/sentry/utils/sdk.py:310-319` 可以看到 Sentry 自己对 Transport 的仪器化封装：

```python
def patch_transport_for_instrumentation(transport, transport_name):
    _send_request = transport._send_request
    if _send_request:
        def patched_send_request(*args, **kwargs):
            metrics.incr(f"internal.sent_requests.{transport_name}.events")
            return _send_request(*args, **kwargs)
        transport._send_request = patched_send_request
    return transport
```

Sentry 还实现了自己的 `MultiplexingTransport`（第 393-563 行），将事件同时发送到两个独立的 Sentry 实例——Sentry SaaS（sentry.io）和 Sentry4Sentry（内部实例），体现了生产环境中的"双重上报"需求：

```python
class MultiplexingTransport(sentry_sdk.transport.Transport):
    """
    Sends all envelopes and events to two Sentry instances:
    - Sentry SaaS (aka Sentry.io) and
    - Sentry4Sentry (aka S4S)
    """
    def _capture_anything(self, method_name, *args, **kwargs):
        if sentry4sentry_transport:
            ...
        if sentry_saas_transport and options.get("store.use-relay-dsn-sample-rate") == 1:
            if is_current_event_safe():
                ...
```

值得注意的是 `is_current_event_safe()` 防护器——它的作用是防止无限递归：如果 Sentry 内部代码在捕获事件时再次触发 Sentry SDK，会导致事件嵌套上报，造成无限循环。因此当当前执行上下文被标记为"不安全"时（如正在处理从 Sentry 自己项目来的事件），事件会被丢弃。

---

## 5.3 事件（Event）数据结构详解

Sentry 事件是一个复杂的 JSON 文档，包含了错误诊断所需的全部信息。本节逐一分析事件中的每个核心字段，结合 `src/sentry/interfaces/` 中的源代码进行说明。

### 5.3.1 Event ID

每个事件都有一个全局唯一的 32 位十六进制字符串作为标识符：

```
"event_id": "fc6d8c0c43fc4630ad850ee518f1b9d0"
```

Event ID 由 SDK 生成（通常是 UUID4 的十六进制表示），贯穿整个处理流水线。在 `event_manager.py:604` 的保存流程中，Event ID 被用于事件去重：

```python
# ingest/consumer/processors.py:118
deduplication_key = f"ev:{project_id}:{event_id}"
cached_value = cache.get(deduplication_key)
if cached_value is not None:
    return  # 已被处理，跳过
```

### 5.3.2 Timestamp

事件的时间戳指示错误发生的时刻，采用 ISO 8601 格式或 Unix 时间戳：

```
"timestamp": "2024-01-15T10:30:00.000Z"
```

在 `event_manager.py:664` 中，timestamp 被提取为 `recorded_timestamp`：

```python
job["recorded_timestamp"] = data.get("timestamp")
```

服务端还会记录 `received_timestamp`（接收时间），两者差值用于计算端到端延迟指标：

```python
# event_manager.py:613-617
metrics.timing(
    "events.latency",
    job["received_timestamp"] - job["recorded_timestamp"],
    tags=metric_tags,
)
```

### 5.3.3 Platform

Platform 指示事件来源的运行平台：

```
"platform": "python"
```

在 `event_manager.py:672` 中，platform 从事件数据中提取：

```python
job["platform"] = event.platform
```

Sentty 定义了有效的平台列表（`VALID_PLATFORMS`），包括 `python`、`javascript`、`java`、`node`、`ruby`、`csharp`、`go`、`php`、`rust` 等。Platform 决定了事件在 Sentry UI 中的显示方式（如堆栈跟踪的渲染格式）。

### 5.3.4 Level

Level 表示事件的严重级别，支持以下值：

| Level | 含义 |
| --- | --- |
| `fatal` | 致命错误，通常导致进程崩溃 |
| `error` | 错误，需要立即关注 |
| `warning` | 警告，可能导致问题 |
| `info` | 信息，记录正常运行信息 |
| `debug` | 调试信息 |

在 `event_manager.py:660` 中：

```python
job["level"] = level = data.get("level")
```

Level 在后续处理中通过 `parse_log_level()` 转换为内部枚举值，用于分组和排序。

### 5.3.5 Logger

Logger 字段记录产生事件的日志记录器名称：

```
"logger": "myapp.views"
```

在 `event_manager.py:659` 中：

```python
job["logger_name"] = logger_name = data.get("logger")
```

Logger 名称同时被复制到 Tags 中以支持搜索（`event_manager.py:680-681`）：

```python
if logger_name:
    set_tag(data, "logger", logger_name)
```

### 5.3.6 Transaction

Transaction 表示发生错误时正在执行的事务名称。对于 HTTP 请求，通常是 URL 路由；对于后台任务，通常是任务名称：

```
"transaction": "GET /api/users/{id}"
```

在 `event_manager.py:649-652` 中：

```python
transaction_name = data.get("transaction")
if transaction_name:
    transaction_name = force_str(transaction_name)
job["transaction"] = transaction_name
```

Transaction 也会被自动复制到 Tags 中（第 684-685 行）。

### 5.3.7 Exception 接口

Exception 接口是 Sentry 事件中最重要的接口之一，用于描述运行时异常。其定义位于 `src/sentry/interfaces/exception.py`。

Exception 接口支持两种表示形式：

**单异常格式**（旧版兼容）：
```json
{
    "exception": {
        "type": "ValueError",
        "value": "invalid value for argument 'name'",
        "module": "builtins",
        "stacktrace": { ... },
        "mechanism": { ... }
    }
}
```

**异常链格式**（现代格式）：
```json
{
    "exception": {
        "values": [
            {
                "type": "DivisionByZeroError",
                "value": "division by zero",
                "module": "__main__",
                "stacktrace": { "frames": [...] },
                "mechanism": {
                    "type": "chained",
                    "handled": true,
                    "is_exception_group": false,
                    "exception_id": 0
                }
            },
            {
                "type": "ValueError",
                "value": "invalid operation",
                "module": "builtins",
                "stacktrace": { "frames": [...] },
                "mechanism": {
                    "type": "chained",
                    "handled": true,
                    "is_exception_group": false,
                    "exception_id": 1,
                    "parent_id": 0
                }
            }
        ]
    }
}
```

从 `exception.py:100-146` 可以看到 Exception 接口的完整定义，每个异常条目包含：

- `type`：异常类型名（如 `ValueError`）
- `value`：异常消息
- `module`：异常所在模块
- `stacktrace`：关联的堆栈跟踪（Stacktrace 接口）
- `mechanism`：异常机制描述（Mechanism 接口）
- `thread_id`：发生异常的线程 ID

### 5.3.8 Stacktrace 接口

Stacktrace 接口描述调用栈中的帧序列，定义在 `src/sentry/interfaces/stacktrace.py:140-160` 中。每个 Frame（栈帧）包含：

```json
{
    "frames": [
        {
            "filename": "app/views.py",
            "function": "handle_request",
            "lineno": 42,
            "colno": 16,
            "abs_path": "/home/user/project/app/views.py",
            "context_line": "    result = do_work(data)",
            "pre_context": [
                "def handle_request(data):",
                "    validate(data)"
            ],
            "post_context": [
                "    return result",
                ""
            ],
            "in_app": true,
            "vars": {
                "data": "{'key': 'value'}"
            }
        }
    ]
}
```

关键字段说明：

- `filename`：相对于项目根目录的文件路径
- `function`：函数名
- `lineno` / `colno`：行号和列号
- `abs_path`：文件的绝对路径
- `context_line`：出错行的源代码行
- `pre_context` / `post_context`：出错行前后的源代码行
- `in_app`：标记该帧是否属于用户代码（`true`）还是框架/库代码（`false`），这是 Sentry 分组算法的关键输入
- `vars`：局部变量的值

在 `stacktrace.py:61-92` 中，`get_context()` 函数将 `pre_context`、`context_line`、`post_context` 组合成带有行号的完整上下文：

```python
def get_context(lineno, context_line, pre_context=None, post_context=None):
    if lineno is None:
        return []
    context = []
    start_lineno = lineno - len(pre_context or [])
    if pre_context:
        for line in pre_context:
            context.append((at_lineno, line))
            at_lineno += 1
    context.append((at_lineno, context_line))
    at_lineno += 1
    if post_context:
        for line in post_context:
            context.append((at_lineno, line))
            at_lineno += 1
    return context
```

### 5.3.9 Mechanism 机制对象

Mechanism 接口（`exception.py:100-150`）描述异常是如何被捕获的。这是理解错误来源的关键元数据：

```json
{
    "mechanism": {
        "type": "generic",
        "handled": false,
        "synthetic": false,
        "description": "SIGSEGV",
        "help_link": "https://developer.apple.com/...",
        "data": {
            "relevant_address": "0x1"
        },
        "meta": {
            "signal": {
                "number": 11,
                "code": 0,
                "name": "SIGSEGV",
                "code_name": "SEGV_NOOP"
            },
            "mach_exception": {
                "exception": 1,
                "code": 1,
                "subcode": 8,
                "name": "EXC_BAD_ACCESS"
            }
        },
        "source": "onerror",
        "is_exception_group": false,
        "exception_id": 0
    }
}
```

关键字段：

- `type`：捕获机制类型，如 `generic`（通用异常）、`chained`（异常链）、`mach`（macOS 内核异常）、`signal`（Unix 信号）
- `handled`：异常是否被应用代码处理过（`true` 表示在 try-catch 中捕获并上报，`false` 表示未处理的崩溃）
- `synthetic`：是否为合成异常（例如 SDK 自己生成的）
- `meta`：操作系统/运行时级别的元数据，如信号编号、Mach 异常码
- `source`：SDK 捕获来源（如 `onerror`、`console.error`、`unhandledrejection`）
- `is_exception_group` / `exception_id` / `parent_id`：异常组支持（Python 3.11+ ExceptionGroup）

### 5.3.10 Message / Logentry 接口

Message 接口（在 API 中映射为 `logentry`）包含事件的文本描述，定义在 `src/sentry/interfaces/message.py`：

```json
{
    "logentry": {
        "message": "User %s attempted to access resource %s",
        "formatted": "User alice attempted to access resource /admin",
        "params": ["alice", "/admin"]
    }
}
```

- `message`：原始格式字符串（带占位符）
- `formatted`：格式化后的完整消息
- `params`：格式化参数列表

`message.py:19-51` 显示，`Message` 接口的 `to_string()` 方法返回 `formatted` 字段（如果可用），否则返回 `message`。

### 5.3.11 Breadcrumbs 接口

Breadcrumbs（面包屑）是记录事件发生前用户操作的序列，定义在 `src/sentry/interfaces/breadcrumbs.py`。每个面包屑包含：

```json
{
    "breadcrumbs": {
        "values": [
            {
                "type": "navigation",
                "level": "info",
                "timestamp": 1705315200.0,
                "message": "Navigated to /dashboard",
                "category": "ui.click",
                "data": {
                    "from": "/home",
                    "to": "/dashboard"
                },
                "event_id": null
            }
        ]
    }
}
```

- `type`：面包屑类型（`default`、`http`、`error`、`navigation`、`user` 等）
- `level`：严重级别（`debug`、`info`、`warning`、`error`）
- `timestamp`：Unix 时间戳
- `message`：描述（最长 1000 字符）
- `category`：分类标签
- `data`：附加数据字典
- `event_id`：关联的事件 ID（如果面包屑是从另一个事件派生的）

从 `breadcrumbs.py:28-35` 可以看到规范化过程：

```python
@classmethod
def to_python(cls, data):
    values = []
    for index, crumb in enumerate(get_path(data, "values", filter=True, default=())):
        values.append(cls.normalize_crumb(crumb))
    return super().to_python({"values": values})
```

### 5.3.12 User 接口

User 接口（`src/sentry/interfaces/user.py`）描述与事件关联的用户信息：

```json
{
    "user": {
        "id": "user_42",
        "email": "alice@example.com",
        "username": "alice",
        "ip_address": "192.168.1.100",
        "name": "Alice Smith",
        "geo": {
            "country_code": "US",
            "city": "San Francisco",
            "region": "CA"
        },
        "data": {
            "subscription": "pro",
            "login_method": "sso"
        }
    }
}
```

从 `user.py:43-51` 可以看到关键字段的定义：

```python
@classmethod
def to_python(cls, data):
    data = data.copy()
    for key in ("id", "email", "username", "ip_address", "name", "geo", "data"):
        data.setdefault(key, None)
    if data["geo"] is not None:
        data["geo"] = Geo.to_python(data["geo"])
    return super().to_python(data)
```

Sentry 建议**至少提供 `id` 或 `ip_address`** 之一，以便在 UI 中区分不同用户。

### 5.3.13 Contexts 上下文接口

Contexts 接口（`src/sentry/interfaces/contexts.py`）允许发送结构化的运行时上下文信息。与 key-value 形式的 Tags 不同，Contexts 支持嵌套对象结构，用于描述更复杂的系统状态。

标准的 Contexts 类型包括：

| Context 类型 | 描述 | 典型字段 |
| --- | --- | --- |
| `os` | 操作系统信息 | `name`、`version`、`kernel_version`、`build` |
| `device` | 设备信息 | `name`、`family`、`model`、`arch`、`memory_size`、`battery_level`、`orientation` |
| `runtime` | 运行时环境 | `name`、`version` |
| `browser` | 浏览器信息 | `name`、`version` |
| `app` | 应用信息 | `app_start_time`、`device_app_hash` |
| `gpu` | 图形处理器 | `name`、`version`、`vendor_name` |

```json
{
    "contexts": {
        "os": {
            "name": "Linux",
            "version": "5.15.0",
            "kernel_version": "5.15.0-91-generic",
            "type": "os"
        },
        "runtime": {
            "name": "CPython",
            "version": "3.11.7",
            "type": "runtime"
        },
        "device": {
            "name": "web-server-01",
            "arch": "x86_64",
            "type": "device"
        }
    }
}
```

`contexts.py:42-82` 中定义了 `ContextType` 类和 `context_to_tag_mapping` 机制，允许在事件规范化时将 Context 中的指定字段提升为 Tags：

```python
class ContextType:
    context_to_tag_mapping: ClassVar[dict[str, str]] = {}
    """
    This indicates which fields should be promoted into tags during event
    normalization. (See EventManager)
    """
```

例如，`os` context 可能配置为将 `os.name` 提升为 `os` 标签，将 `os.version` 提升为 `os.version` 标签，这样这些字段就可以被用于搜索和过滤。

### 5.3.14 Tags

Tags 是键值对形式的元数据，用于在 Sentry UI 中进行快速搜索、过滤和分组。Tags 的值有长度限制（`MAX_TAG_VALUE_LENGTH`）：

```json
{
    "tags": [
        ["environment", "production"],
        ["handled", "yes"],
        ["level", "error"],
        ["transaction", "GET /api/users/{id}"],
        ["url", "https://example.com/api/users"]
    ]
}
```

在 `event_manager.py:196-199` 中可以看到 Tag 的操作函数：

```python
def set_tag(data: dict[str, Any], key: str, value: Any) -> None:
    pop_tag(data, key)
    if value is not None:
        data.setdefault("tags", []).append((key, trim(value, MAX_TAG_VALUE_LENGTH)))
```

Tags 在事件处理流程中的多个阶段被自动设置：
- `_pull_out_data` 自动设置 `level`、`logger`、`environment`、`transaction` 标签
- `_derive_tags_many` 通过自动标签派生器添加更多标签
- `_derive_interface_tags_many` 从 Interface 对象中提取标签

### 5.3.15 Extra

Extra 是任意附加数据的字典，不用于搜索或过滤，仅在事件详情页中展示：

```json
{
    "extra": {
        "request_params": {"page": 1, "limit": 100},
        "session_id": "abc123",
        "feature_flags": {"new_ui": true, "beta_search": false}
    }
}
```

Extra 中的值可以是任意 JSON 序列化类型，不会像 Tags 那样被长度截断。

### 5.3.16 Release 与 Dist

Release 标识事件发生的代码版本：

```json
{
    "release": "myapp@1.2.3",
    "dist": "build-456"
}
```

在 `event_manager.py:661-662` 中：

```python
job["release"] = data.get("release")
job["dist"] = data.get("dist")
```

Release 在事件保存时通过 `_get_or_create_release_many()` 函数（`event_manager.py:726-766`）自动与 `Release` 模型关联，并且从 Tags 中移除原始 `release` 键，替换为 `sentry:release`：

```python
pop_tag(data, "release")
set_tag(data, "sentry:release", release.version)
```

### 5.3.17 Environment

Environment 指定事件发生的部署环境：

```json
{
    "environment": "production"
}
```

Environment 用于区分不同部署环境的错误（如 `production`、`staging`、`development`）。在 `event_manager.py:663` 中被提取，并通过 `_get_or_create_environment_many()` 与 `Environment` 模型关联。

### 5.3.18 Fingerprint

Fingerprint（指纹）是用于覆盖 Sentry 默认分组逻辑的用户自定义分组键：

```json
{
    "fingerprint": [
        "myapp-database",
        "{{ default }}",
        "query-timeout"
    ]
}
```

Fingerprint 是一个字符串数组，决定哪些事件应归入同一 Issue 组。`{{ default }}` 是特殊占位符，表示插入 Sentry 默认的分组算法生成的指纹。

Fingerprint 的正确配置可以：
- 将不同异常类型的相同业务错误合并到同一组
- 将同一异常类型的不同参数分布到不同组

### 5.3.19 SDK 元数据

每个事件携带 SDK 的元数据（`src/sentry/interfaces/sdk.py`），描述发送事件的 SDK 身份：

```json
{
    "sdk": {
        "name": "sentry.python",
        "version": "2.8.0",
        "integrations": ["django", "celery", "redis"],
        "packages": [
            {"name": "pypi:sentry-sdk", "version": "2.8.0"}
        ]
    }
}
```

在服务端，`event_manager.py:209-231` 中的 `sdk_metadata_from_event()` 函数提取 SDK 名称并生成归一化版本，用于统计指标标记：

```python
def sdk_metadata_from_event(event: Event) -> Mapping[str, Any]:
    if not (sdk_metadata := event.data.get("sdk")):
        return {}
    try:
        return {
            "sdk": {
                "name": sdk_metadata.get("name") or "unknown",
                "name_normalized": normalized_sdk_tag_from_event(event.data),
            }
        }
    except Exception:
        logger.warning("failed to set normalized SDK name", exc_info=True)
        return {}
```

### 5.3.20 Threads 线程信息

Threads 接口（`src/sentry/interfaces/threads.py`）记录事件发生时所有线程的状态：

```json
{
    "threads": {
        "values": [
            {
                "id": "0",
                "name": "MainThread",
                "current": true,
                "crashed": false,
                "stacktrace": { "frames": [...] }
            },
            {
                "id": "1",
                "name": "Worker-1",
                "current": false,
                "crashed": true,
                "stacktrace": { "frames": [...] }
            }
        ]
    }
}
```

从 `threads.py:18-44` 可以看到每个线程包含：

- `id`：线程标识符
- `name`：线程名称
- `current`：是否为当前线程
- `crashed`：是否因此线程而崩溃
- `stacktrace`：线程的堆栈跟踪
- `raw_stacktrace`：未处理的原始堆栈跟踪
- `state`：线程状态（如 `"running"`）
- `held_locks`：持有的锁信息

### 5.3.21 Spans 跨度信息

Spans 接口（`src/sentry/interfaces/spans.py`）用于性能监控，记录事务中的各个操作跨度：

```json
{
    "spans": [
        {
            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
            "span_id": "8c931f4740435fb8",
            "parent_span_id": "9c2a6db8c79068a2",
            "op": "http.client",
            "description": "GET https://api.example.com/data",
            "start_timestamp": "2024-01-15T10:30:01.000Z",
            "timestamp": "2024-01-15T10:30:01.450Z",
            "data": {"url": "https://api.example.com/data", "status_code": 200}
        }
    ]
}
```

### 5.3.22 Request 与 Template 接口

Request 接口（`src/sentry/interfaces/http.py`）记录 HTTP 请求的完整信息：

```json
{
    "request": {
        "url": "https://example.com/api/users",
        "method": "POST",
        "headers": [["Content-Type", "application/json"]],
        "query_string": [["page", "1"]],
        "data": {"username": "alice"},
        "cookies": [["session_id", "abc123"]],
        "env": {"SERVER_NAME": "web-01"}
    }
}
```

Template 接口（`src/sentry/interfaces/template.py`）用于模板引擎（如 Django、Jinja2）中的错误：

```json
{
    "template": {
        "abs_path": "/app/templates/user.html",
        "filename": "user.html",
        "lineno": 15,
        "context_line": "{{ user.name | upper }}",
        "pre_context": ["<div class='name'>", ""],
        "post_context": ["</div>", ""]
    }
}
```

---

## 5.4 错误捕获机制

### 5.4.1 全局异常处理器

Sentry SDK 在各语言中通过注册全局异常处理器来自动捕获未处理的异常。以下是各语言的实现方式：

**Python**：通过 `sys.excepthook` 和 `threading.excepthook` 捕获未处理的异常，通过 `atexit` 注册清理回调。

```python
# SDK 内部实现（简化版）
import sys

_original_excepthook = sys.excepthook

def _sentry_excepthook(exc_type, exc_value, exc_traceback):
    # 上报到 Sentry
    sentry_sdk.capture_exception(exc_value)
    # 调用原始处理器
    _original_excepthook(exc_type, exc_value, exc_traceback)

sys.excepthook = _sentry_excepthook
```

**JavaScript**：通过 `window.onerror`、`window.onunhandledrejection` 捕获浏览器中的未处理错误。

```javascript
window.onerror = function(message, source, lineno, colno, error) {
    Sentry.captureException(error || message);
    return true; // 阻止默认浏览器错误处理
};
```

**Java**：通过 `Thread.setDefaultUncaughtExceptionHandler()` 注册 JVM 级别的未捕获异常处理器。

**Go**：通过 `recover()` 在 goroutine 级别捕获 panic。

### 5.4.2 Try-Catch 手动上报

除了自动捕获，SDK 也支持在 try-catch 块中手动上报异常：

**Python**：

```python
from sentry_sdk import capture_exception

try:
    result = risky_operation()
except Exception as e:
    capture_exception(e)
    # 可选：添加额外上下文
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("feature", "payment")
        scope.set_extra("order_id", order.id)
        capture_exception(e)
```

**JavaScript**：

```javascript
try {
    riskyOperation();
} catch (error) {
    Sentry.withScope((scope) => {
        scope.setTag("feature", "payment");
        scope.setExtra("order_id", order.id);
        Sentry.captureException(error);
    });
}
```

手动上报的关键优势是可以附加**特定于该错误点的上下文信息**，这些信息不会泄漏到其他事件中。

### 5.4.3 Unhandled Rejection

在 JavaScript 环境中，Promise 的未处理拒绝（Unhandled Rejection）是常见的错误来源。SDK 通过 `unhandledrejection` 事件捕获：

```javascript
window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason, {
        mechanism: {
            handled: false,
            type: 'onunhandledrejection'
        }
    });
});
```

在 `mechanism.source` 字段中，`onunhandledrejection` 明确标记了错误的捕获来源，帮助区分自动捕获与手动捕获的错误。

### 5.4.4 原生崩溃捕获

对于 C/C++、iOS、Android 等原生平台，Sentry SDK 通过**信号处理器**和**崩溃报告器**来捕获原生崩溃：

- **Unix/Linux**：注册 `SIGSEGV`、`SIGABRT`、`SIGBUS`、`SIGFPE`、`SIGILL` 等信号的处理函数
- **macOS/iOS**：通过 Mach Exception Port 捕获内核级别的异常
- **Windows**：通过 `SetUnhandledExceptionFilter` 捕获结构化异常（SEH）
- **Android**：使用 `breakpad` 或 `crashpad` 作为崩溃报告后端

从 `exception.py:13-97` 的 `upgrade_legacy_mechanism()` 函数可以看到，原生崩溃的元数据通过 Mechanism 接口上报，包括信号编号、Mach 异常码、相关内存地址等关键信息：

```python
result.setdefault("meta", {})["signal"] = prune_empty_keys({
    "number": posix_signal.get("signal"),
    "code": posix_signal.get("code"),
    "name": posix_signal.get("name"),
    "code_name": posix_signal.get("code_name"),
})
```

---

## 5.5 Breadcrumbs（面包屑）机制

### 5.5.1 Breadcrumbs 数据结构

Breadcrumbs 记录事件发生前的一系列操作，与黑匣子飞行记录器的原理类似——当事故发生时，前面记录的 Breadcrumbs 帮助还原事故原因。

每个 Breadcrumb 的完整字段如下：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 面包屑类型（`default`、`http`、`error`、`navigation`、`user`） |
| `level` | string | 否 | 严重级别（`debug`、`info`、`warning`、`error`），默认 `info` |
| `timestamp` | float | 是 | Unix 时间戳 |
| `message` | string | 否 | 面向用户的文本描述 |
| `category` | string | 否 | 分类标签（如 `ui.click`、`db.query`） |
| `data` | object | 否 | 附加数据字典 |
| `event_id` | string | 否 | 关联的事件 ID |

从 `breadcrumbs.py:58-70` 的 `normalize_crumb()` 方法可以看到规范化逻辑：

```python
@classmethod
def normalize_crumb(cls, crumb):
    crumb = dict(crumb)
    ts = parse_timestamp(crumb.get("timestamp"))
    if ts:
        crumb["timestamp"] = ts.timestamp()
    else:
        crumb["timestamp"] = None
    for key in ("type", "level", "message", "category", "event_id", "data"):
        crumb.setdefault(key, None)
    return crumb
```

### 5.5.2 自动记录类型

Sentry SDK 通过 Integrations 自动记录多种类型的 Breadcrumbs：

| 面包屑类型 | 触发条件 | category 示例 | data 示例 |
| --- | --- | --- | --- |
| HTTP 请求 | 出站 HTTP 调用 | `httplib` / `requests` | `url`、`method`、`status_code`、`reason` |
| 数据库查询 | ORM/SQL 执行 | `sql.query` | SQL 语句内容 |
| UI 点击 | 用户交互事件 | `ui.click` | 点击的元素选择器 |
| 控制台日志 | `console.log/warn/error` | `console` | 日志级别和参数 |
| 导航事件 | 页面路由变化 | `navigation` | `from`、`to` |
| 键盘输入 | 按键事件 | `ui.input` | 输入字段名称 |
| DOM 突变 | DOM 元素变化 | `ui.dom` | 变异类型和目标元素 |
| Fetch / XHR | 网络请求 | `fetch` / `xhr` | 请求 URL 和响应状态 |

### 5.5.3 手动添加面包屑

开发者可以在应用代码中手动添加面包屑，记录业务逻辑中的关键步骤：

**Python**：

```python
from sentry_sdk import add_breadcrumb

# 简单面包屑
sentry_sdk.add_breadcrumb(
    category="auth",
    message="User authenticated",
    level="info",
)

# 带数据的详细面包屑
sentry_sdk.add_breadcrumb(
    category="payment",
    message="Payment initiated",
    level="info",
    data={
        "order_id": "12345",
        "amount": 99.99,
        "currency": "USD",
    },
)

# 使用 push_scope 确保面包屑仅在当前 scope 有效
with sentry_sdk.push_scope() as scope:
    scope.add_breadcrumb(
        category="checkout",
        message="Processing checkout",
        level="info",
    )
    process_checkout()  # 此函数内的错误会附带此面包屑
```

**JavaScript**：

```javascript
Sentry.addBreadcrumb({
    category: 'auth',
    message: 'User authenticated',
    level: 'info',
    data: { userId: '42' },
});
```

建议在以下关键节点手动添加面包屑：
- 用户认证和授权事件
- 支付和交易流程
- 数据导出或重要文件操作
- 外部 API 调用（除了 SDK 自动记录的 HTTP 面包屑之外）
- 业务状态机转换

将面包屑数量控制在合理范围（默认最大 100），避免在循环中大量添加面包屑。

---

## 5.6 Context 上下文信息

### 5.6.1 User 上下文

User 上下文用于将事件关联到具体的用户，在 Sentry UI 中可以看到"受影响的用户数"统计：

```python
sentry_sdk.set_user({
    "id": "user_42",
    "email": "alice@example.com",
    "username": "alice",
    "ip_address": "{{auto}}",  # SDK 自动填充
})
```

建议在用户认证后（登录成功时）立即设置 User 上下文，在用户退出登录时调用 `set_user(None)` 清除。

### 5.6.2 Tags 标签

Tags 是用于搜索和分类的关键工具。善用 Tags 可以极大地提高问题排查效率：

```python
sentry_sdk.set_tag("feature", "payment")
sentry_sdk.set_tag("shop_id", "123")
sentry_sdk.set_tag("db.instance", "replica-01")
```

Tags 的使用建议：
- **低基数**：每个 Tag 的取值数量应在 1000 以内，否则会造成 UI 性能问题
- **高价值**：应选择有助于区分和过滤问题的维度，如 `feature`、`page`、`region`
- **避免唯一值**：不要将 `user_id`、`request_id`、`timestamp` 等唯一值作为 Tag

### 5.6.3 Extra 附加数据

Extra 适用于存储任意结构化数据，帮助在事件详情中了解更完整的上下文：

```python
sentry_sdk.set_extra("request_body", request.data)
sentry_sdk.set_extra("user_permissions", user.permissions)
sentry_sdk.set_extra("feature_toggles", feature_flags)
```

Extra 中的值不会被索引，不能用于搜索和过滤。如果某个字段需要通过搜索找到，应该使用 Tag。

### 5.6.4 Scope 作用域管理

Scope 定义了上下文的生命周期。合理使用不同级别的 Scope 可以避免上下文泄漏和数据污染：

**Python Scope 管理示例**：

```python
import sentry_sdk

# 1. 全局 scope（进程级别）
sentry_sdk.set_tag("service", "api-server")
sentry_sdk.set_user({"username": "system"})

# 2. 请求 scope（使用 context manager）
def handle_request(request):
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("endpoint", request.path)
        scope.set_user({"id": request.user.id})
        scope.set_extra("request_id", request.id)
        # 此 scope 内的所有错误都会携带上述信息
        process(request)

# 3. 临时 scope（使用新 scope 隔离）
with sentry_sdk.new_scope() as scope:
    scope.set_tag("operation", "background_sync")
    sync_data()
    # 此 scope 在退出时自动销毁
```

**Scope 继承规则**：
- `push_scope`：创建当前 Scope 的浅拷贝（继承现有的 Tags、Extra、User 等）
- `new_scope`：创建全新的 Scope（不继承任何上下文）
- `configure_scope`：修改当前 Scope 而不创建新副本

### 5.6.5 Scope 泄露检测：Sentry 的实际实践

Sentry 自己的代码中有一套 Scope 泄露检测机制（`src/sentry/utils/sdk.py:615-665`），这是从生产环境中学到的经验教训：

```python
def check_tag_for_scope_bleed(
    tag_key: str, expected_value: str | int, add_to_scope: bool = True
) -> None:
    """
    Detect if the given tag has already been set to a value different than
    what we expect. If we find a mismatch, log a warning and add scope bleed
    tags to the scope.
    """
    scope = sentry_sdk.get_isolation_scope()
    current_value = scope._tags.get(tag_key)
    if not current_value:
        return
    current_value = str(current_value)
    if current_value != expected_value:
        if add_to_scope:
            scope.set_tag("possible_mistag", True)
            scope.set_tag(f"scope_bleed.{tag_key}", True)
        logger.warning("Tag already set and different (%s).", tag_key, extra=...)
```

Scope 泄露是 Sentry 自身在生产环境中遇到的真实问题。当一个请求的 Scope 数据"泄露"到另一个请求中时，会导致事件被标记为错误的标签（例如错误的 `organization.slug`）。这套检测机制通过以下方式缓解：

1. 在设置 Tag 前检查当前 Scope 是否已有不同值
2. 如果发现不匹配，将 `possible_mistag` 和 `scope_bleed.*` 标记添加到当前 Scope
3. 记录警告日志以备排查

---

## 5.7 事件上报流程：SDK 端到 Sentry 端的完整链路

事件从 SDK 端捕获到最终持久化的完整链路是理解 Sentry 工作方式的关键。本节基于 `src/sentry/event_manager.py` 和 `src/sentry/ingest/consumer/processors.py` 的实际代码，绘出每一步的细节。

### 5.7.1 整体架构概览

```
 SDK Client                   Sentry Infrastructure
+-------------+        +---------+    +---------+    +---------+
| Application | -----> |  Relay  | -> |  Kafka  | -> | Ingest  |
|   (SDK)     |  HTTP  | (Gateway)|    | (Queue) |    | Consumer|
+-------------+        +---------+    +---------+    +----+----+
                                                          |
                              +---------------------------+
                              |
+-----------------------------v---------------------------------+
|                    Django Application                          |
|  preprocess_event -> EventManager.normalize -> save            |
|                                         |                      |
|                   save_error_events      |                      |
|                           |              |                      |
|               +-----------+--------------v-----------+         |
|               |          Grouping & Assignment       |         |
|               +-----------+--------------+-----------+         |
|                           |              |                     |
|               +-----------v---+ +--------v-------+             |
|               |  Nodestore    | |  Eventstream   |             |
|               |  (Event Body) | |  (Kafka+Snuba) |             |
|               +---------------+ +----------------+             |
+----------------------------------------------------------------+
```

### 5.7.2 第一阶段：SDK 端数据收集与发送

当异常发生时，SDK 执行以下步骤：

1. **异常捕获**：通过全局异常处理器或手动调用 `capture_exception()` 捕获异常
2. **事件构建**：将异常对象转换为 Event 数据结构，包括：
   - 自动提取异常类型、消息、堆栈跟踪
   - 收集当前 Scope 中的 Tags、Extra、User、Breadcrumbs、Contexts
   - 附加 SDK 元数据（名称、版本、包信息）
   - 生成 Event ID（UUID4 的十六进制表示）
3. **Event Processor 处理**：按序运行所有注册的 event processor，允许修改/过滤事件
4. **before_send 回调**：调用用户自定义的 `before_send` 函数，允许修改或丢弃事件
5. **事件序列化**：将事件内容序列化为 JSON，包装在 Envelope 中
6. **Transport 发送**：通过 HTTP POST 将 Envelope 发送到 Sentry DSN 端点

### 5.7.3 第二阶段：Relay 网关处理

Relay 是 Sentry 的事件入口网关，负责：

1. **速率限制**：根据项目配额限制事件速率
2. **入站过滤**：根据项目设置应用入站过滤器（过滤本地请求、浏览器扩展、已知爬虫、健康检查等）
3. **PII 清洗**：根据项目的数据清洗规则对敏感数据进行脱敏
4. **事件规范化**：执行基础的规范化操作（类似 `StoreNormalizer`）
5. **Kafka 投递**：将处理后的 Envelope 投递到指定的 Kafka Topic

从 `src/sentry/ingest/inbound_filters.py:63-80` 可以看到支持的入站过滤器列表：

```python
def get_all_filter_specs():
    filters = [
        _localhost_filter,
        _browser_extensions_filter,
        _legacy_browsers_filter,
        _web_crawlers_filter,
        _healthcheck_filter,
    ]
    return tuple(filters)
```

### 5.7.4 第三阶段：Kafka 消息队列

事件被 Relay 投递到 Kafka Topic 后，进入异步处理阶段。Kafka 在此的作用是：

- **解耦**：将事件接收与事件处理分离，避免高峰期处理延迟导致拒绝服务
- **缓冲**：在流量突发时提供弹性缓冲
- **重试**：Consumer 处理失败时可以重试消费，不会丢失事件

Kafka 中存储的是 Envelope 格式的原始数据，包含了序列化的事件 JSON 和附件元数据。

### 5.7.5 第四阶段：Ingest Consumer 消费

Ingest Consumer（`src/sentry/ingest/consumer/processors.py`）是 Kafka 的消费端，负责将消息从 Kafka 拉取并分发到对应的处理函数。

从 `processors.py:77-320` 的 `process_event()` 函数可以看到完整的消费流程：

```python
@trace_func(name="ingest_consumer.process_event")
def process_event(
    consumer_type: str,
    message: IngestMessage,
    project: Project,
    ...
) -> None:
    """
    Perform some initial filtering and deserialize the message payload.
    """
    # 1. 提取消息字段
    payload = message["payload"]
    start_time = float(message["start_time"])
    event_id = message["event_id"]
    project_id = int(message["project_id"])
    attachments = message.get("attachments") or ()

    # 2. 去重检查
    deduplication_key = f"ev:{project_id}:{event_id}"
    cached_value = cache.get(deduplication_key)
    if cached_value is not None:
        return  # 已被处理，跳过

    # 3. Killswitch 检查
    if killswitch_matches_context("store.load-shed-pipeline-projects", ...):
        return

    # 4. 解析 JSON 载荷
    data = orjson.loads(payload)

    # 5. 根据事件类型分发
    if consumer_type == ConsumerType.Transactions or data.get("type") == "transaction":
        processing_store = transaction_processing_store
    else:
        processing_store = event_processing_store

    # 6. 将事件数据存储到处理存储（Redis）
    cache_key = processing_store.store(data)

    # 7. 按事件类型分发到不同任务
    if data.get("type") == "transaction":
        save_event_transaction.delay(cache_key=cache_key, ...)
    elif data.get("type") == "feedback":
        save_event_feedback.delay(...)
    else:
        preprocess_event(cache_key=cache_key, data=data, ...)

    # 8. 设置去重标记
    cache.set(deduplication_key, "", CACHE_TIMEOUT)
```

### 5.7.6 第五阶段：preprocess_event 预处理

`preprocess_event` 任务（在 `src/sentry/tasks/store.py` 中定义）负责在后台异步执行以下操作：

1. **从 Redis 处理存储中获取事件数据**
2. **应用入站过滤器**（再次检查，因为项目设置可能在 Relay 处理后发生了变化）
3. **处理附件**：将附件从 chunk 缓存中重组
4. **调用 `EventManager.save()`** 进行事件保存

```python
# 简化流程
def preprocess_event(cache_key, data, start_time, event_id, project, ...):
    # 从 Redis 获取事件数据
    event_data = event_processing_store.get(cache_key)

    # 应用过滤器
    if should_filter_event(event_data, project):
        return

    # 调用 EventManager 保存
    manager = EventManager(event_data)
    manager.normalize(project_id=project.id)
    event = manager.save(project_id=project.id)

    # 删除 Redis 存储中的事件数据
    event_processing_store.delete_by_key(cache_key)
```

### 5.7.7 第六阶段：EventManager.normalize 规范化

`EventManager.normalize()`（`event_manager.py:386-425`）调用 Rust 实现的 `StoreNormalizer` 进行事件规范化：

```python
def _normalize_impl(self, project_id: int | None = None) -> None:
    from sentry_relay.processing import StoreNormalizer

    rust_normalizer = StoreNormalizer(
        project_id=self._project.id if self._project else project_id,
        client_ip=self._client_ip,
        client=self._auth.client if self._auth else None,
        key_id=str(self._key.id) if self._key else None,
        grouping_config=self._grouping_config,
        protocol_version=str(self.version) if self.version is not None else None,
        is_renormalize=self._is_renormalize,
        remove_other=self._remove_other,
        normalize_user_agent=True,
        sent_at=self.sent_at.isoformat() if self.sent_at is not None else None,
        json_dumps=orjson.dumps,
        **DEFAULT_STORE_NORMALIZER_ARGS,
    )

    self._data = rust_normalizer.normalize_event(dict(self._data), json_loads=orjson.loads)
```

规范化操作包括：

1. **协议校验**：确保事件符合 SDK 协议规范
2. **字段类型检查**：确保各字段类型正确（如 `timestamp` 转换为 datetime）
3. **数据截断**：将超长字段截断到最大长度限制
4. **默认值填充**：为缺失字段填充默认值
5. **GeoIP 解析**：根据 IP 地址添加地理位置信息
6. **User-Agent 解析**：从 User-Agent 头提取浏览器/设备信息
7. **Context 到 Tag 的提升**：根据 `context_to_tag_mapping` 将 Context 字段提升为 Tags

### 5.7.8 第七阶段：EventManager.save 保存

`EventManager.save()`（`event_manager.py:430-508`）是事件处理的核心入口。根据事件类型（error/transaction/generic）执行不同的保存路径：

```python
@trace
def save(self, project_id=None, ...):
    # 确保已规范化
    if not self._normalized:
        self.normalize(project_id=project.id)

    job = {"data": self._data, "project_id": project.id, ...}

    # 提取事件数据
    _pull_out_data([job], projects)

    # 根据事件类型分发
    event_type = self._data.get("type")
    if event_type == "transaction":
        jobs = save_transaction_events([job], projects, ...)
    elif event_type == "generic":
        jobs = save_generic_events([job], projects)
    else:
        return self.save_error_events(project, job, projects, ...)
```

对于最常见的 **error 类型事件**，`save_error_events()`（第 511-631 行）执行以下子步骤：

#### a) Release 关联（`_get_or_create_release_many`）

```python
def _get_or_create_release_many(jobs, projects):
    for job in jobs:
        if data.get("release"):
            release = Release.get_or_create(
                project=project,
                version=data["release"],
                date_added=date,
                create=create_release,
            )
            job["release"] = release
            # 防止冲突：替换原始 release tag 为 sentry:release
            pop_tag(data, "release")
            set_tag(data, "sentry:release", release.version)
```

#### b) Event User 提取（`_get_event_user_many`）

```python
job["user"] = _get_event_user(project, data)
if user:
    pop_tag(data, "user")
    set_tag(data, "sentry:user", user.tag_value)
```

#### c) 自动 Tag 派生（`_derive_tags_many`）

从事件中自动派生 Tags，例如从 URL 中提取域名。

#### d) 接口 Tag 派生（`_derive_interface_tags_many`）

从 Interface 对象中提取 Tags（如从 Exception 中提取 `handled` 状态）。

#### e) 分组分配（`assign_event_to_group`）

这是核心步骤——通过分组算法计算事件指纹，将事件分配到一个 Issue 组。分组过程包括：

1. 运行主分组算法计算 `primary_hash`
2. 如果项目处于分组过渡期，运行次分组算法计算 `secondary_hash`
3. 可选：通过 Seer 服务进行匹配
4. 如果找到匹配的 group_hash，事件归属到已有 Group
5. 如果未找到匹配，创建新的 Group

```python
group_info = assign_event_to_group(event=job["event"], job=job, metric_tags=metric_tags)
if not group_info:
    return job["event"]  # 被丢弃或过滤
```

#### f) Environment 关联（`_get_or_create_environment_many`）

将事件的 `environment` 字段与 `Environment` 模型关联。

#### g) 指标记录（`_tsdb_record_all_metrics`）

将事件计数写入 TSDB（时间序列数据库）。

#### h) Nodestore 保存（`_nodestore_save_many`）

将事件的完整 JSON 数据保存到 Nodestore 中，这是一个键值存储，以 `event_id` 为键：

```python
_nodestore_save_many(jobs=jobs, app_feature="errors")
```

#### i) Eventstream 写入（`_eventstream_insert_many`）

将事件元数据写入 Eventstream（Kafka Topic），由 Snuba 消费并写入 ClickHouse：

```python
_eventstream_insert_many(jobs)
```

#### j) 信号发送

发送 `first_event_received`、`first_event_with_minified_stack_trace_received` 等信号，触发后续的异步通知和处理。

### 5.7.9 第八阶段：post_process_group 后处理

事件保存后，`post_process_group` 任务（通过 Celery/TaskBroker 异步执行）负责：

1. **插件通知**：调用项目配置的插件（如 Slack、PagerDuty、Email）
2. **规则引擎**：执行告警规则匹配和通知发送
3. **自动解决**：检查是否有修复提交自动解决 Issue
4. **疑似提交**：通过 Suspect Commits 算法关联最近的代码变更
5. **数据转发**：将事件数据同步到外部集成
6. **统计更新**：更新项目级别的 Issue 统计

### 5.7.10 完整链路时序图

```
Application (SDK)          Relay             Kafka        Ingest Consumer      Tasks             EventManager
     │                       │                 │                │                 │                    │
     │ capture_exception()   │                 │                │                 │                    │
     │ build_envelope()      │                 │                │                 │                    │
     │ POST /api/{pid}/envelope/               │                │                 │                    │
     │──────────────────────>│                 │                │                 │                    │
     │                       │                 │                │                 │                    │
     │                       │ rate_limit()    │                │                 │                    │
     │                       │ inbound_filter()│                │                 │                    │
     │                       │ normalize()     │                │                 │                    │
     │                       │ produce()       │                │                 │                    │
     │                       │────────────────>│                │                 │                    │
     │                       │                 │                │                 │                    │
     │                       │                 │ consume()      │                 │                    │
     │                       │                 │───────────────>│                 │                    │
     │                       │                 │                │                 │                    │
     │                       │                 │                │ dedup_check()   │                    │
     │                       │                 │                │ store_event()   │                    │
     │                       │                 │                │────────────────>│                    │
     │                       │                 │                │                 │ preprocess_event() │
     │                       │                 │                │                 │───────────────────>│
     │                       │                 │                │                 │                    │ normalize()
     │                       │                 │                │                 │                    │ save()
     │                       │                 │                │                 │                    │──>save_error_events()
     │                       │                 │                │                 │                    │    ├─ _pull_out_data
     │                       │                 │                │                 │                    │    ├─ _get_or_create_release
     │                       │                 │                │                 │                    │    ├─ _derive_tags
     │                       │                 │                │                 │                    │    ├─ assign_event_to_group
     │                       │                 │                │                 │                    │    ├─ _nodestore_save
     │                       │                 │                │                 │                    │    └─ _eventstream_insert
     │                       │                 │                │                 │  post_process_group│
     │                       │                 │                │                 │<───────────────────│
     │                       │                 │                │                 │  (notifications)  │
```

---

## 5.8 Before Send / Event Processors

### 5.8.1 before_send 回调

`before_send` 是 SDK 提供的最重要钩子之一，允许开发者在事件被发送前检查和修改事件数据。它接收两个参数：
- `event`：即将发送的事件字典
- `hint`：包含额外上下文的字典（如 `exc_info`、原始异常对象等）

返回修改后的事件、`None` 表示丢弃该事件：

```python
def before_send(event, hint):
    # 丢弃特定类型的错误
    if "KeyboardInterrupt" in event.get("exception", {}).get("values", [{}])[0].get("type", ""):
        return None

    # 从 HTTP cookies 中脱敏
    if "request" in event and "cookies" in event["request"]:
        for cookie_key in event["request"]["cookies"]:
            if cookie_key in ("session", "token"):
                event["request"]["cookies"][cookie_key] = "********"

    return event

sentry_sdk.init(
    dsn="...",
    before_send=before_send,
)
```

### 5.8.2 before_send_transaction 回调

`before_send_transaction` 是专门针对 Transaction 事件的过滤/修改回调：

```python
def before_send_transaction(event, hint):
    # 丢弃健康检查请求的性能数据
    if event.get("transaction") == "/health":
        return None

    # 速率过高的事件可能触发截断，标记此类事件
    if len(event.get("spans", [])) >= 1000:
        event["tags"]["spans_over_limit"] = "true"

    return event

sentry_sdk.init(
    dsn="...",
    before_send_transaction=before_send_transaction,
)
```

### 5.8.3 Event Processor 处理器

Event Processor 是 SDK 内部的事件处理管道组件，可以按顺序注册多个处理器。与 `before_send` 不同，Event Processor 运行得更早（在 `before_send` 之前），并且可以影响事件构建过程：

```python
def my_event_processor(event, hint):
    # 添加自定义数据
    event.setdefault("extra", {})["custom_field"] = "value"
    return event

with sentry_sdk.push_scope() as scope:
    scope.add_event_processor(my_event_processor)
    # 此 scope 内的所有事件都会先经过 my_event_processor 处理
```

Event Processor 的顺序执行，前一个处理器的输出是后一个处理器的输入。如果任何一个处理器返回 `None`，该事件将被丢弃。

### 5.8.4 敏感数据脱敏

敏感数据脱敏是 `before_send` 最常见的应用场景。以下是常见的脱敏模式：

**密码字段脱敏**：

```python
SENSITIVE_KEYS = {"password", "secret", "token", "auth", "credential", "apikey"}

def _is_sensitive(key):
    return any(sensitive in key.lower() for sensitive in SENSITIVE_KEYS)

def scrub_event(event, hint):
    # 脱敏 request data
    if "request" in event and "data" in event["request"]:
        data = event["request"]["data"]
        if isinstance(data, dict):
            for key in list(data.keys()):
                if _is_sensitive(key):
                    data[key] = "[Filtered]"

    # 脱敏 extra
    if "extra" in event:
        for key in list(event["extra"].keys()):
            if _is_sensitive(key):
                event["extra"][key] = "[Filtered]"

    # 脱敏 breadcrumbs data
    if "breadcrumbs" in event:
        for crumb in event["breadcrumbs"].get("values", []):
            if "data" in crumb and isinstance(crumb["data"], dict):
                for key in list(crumb["data"].keys()):
                    if _is_sensitive(key):
                        crumb["data"][key] = "[Filtered]"

    return event
```

### 5.8.5 Sentry 自己的 before_send 实践

Sentry 项目本身使用了自己的 SDK，其 `before_send` 回调（`src/sentry/utils/sdk.py:270-283`）提供了真实的生产实践参考：

```python
def before_send(event: Event, hint: Hint) -> Event | None:
    if event.get("tags"):
        if settings.SILO_MODE:
            event["tags"]["silo_mode"] = str(settings.SILO_MODE)
        if settings.SENTRY_LOCAL_CELL:
            event["tags"]["sentry_region"] = settings.SENTRY_LOCAL_CELL

    event_exc = hint.get("exc_info", [None])[0]
    if event_exc == asyncio.CancelledError:
        return None  # 丢弃 CancelledError —— 这是正常的协程取消信号
    if event_exc == OperationalError:
        event["level"] = "warning"  # 数据库临时故障降级为 warning

    return event
```

而 `before_send_transaction`（第 237-267 行）展示了更复杂的处理：

```python
def before_send_transaction(event: Event, _: Hint) -> Event | None:
    # 丢弃通用 301 重定向的 Transaction
    if (
        event.get("tags", {}).get("http.status_code") == "301"
        and event.get("transaction_info", {}).get("source") == "url"
    ):
        return None

    # 标记 span 数量超过限制的事务
    num_of_spans = len(event["spans"])
    event["tags"]["spans_over_limit"] = str(num_of_spans >= 1000)

    # 设置 span 计数到 trace context
    data = event.setdefault("contexts", {}).setdefault("trace", {}).setdefault("data", {})
    data["num_of_spans"] = num_of_spans

    return event
```

---

## 5.9 多语言 SDK 集成实战

### 5.9.1 Python（sentry-sdk）

**安装**：

```bash
pip install sentry-sdk
```

**基础集成**：

```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://examplePublicKey@o0.ingest.sentry.io/0",
    traces_sample_rate=1.0,
    profiles_sample_rate=1.0,
)

# 自动捕获所有未处理异常——无需额外代码
1 / 0  # 此错误会自动上报

# 手动捕获
try:
    raise ValueError("invalid input")
except Exception:
    sentry_sdk.capture_exception()
```

**Django 集成**：

```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn="https://examplePublicKey@o0.ingest.sentry.io/0",
    integrations=[DjangoIntegration(
        transaction_style="url",
        middleware_spans=True,
        signals_spans=True,
        cache_spans=True,
    )],
    traces_sample_rate=1.0,
    send_default_pii=True,  # 发送用户 PII
)
```

Django 集成会自动收集：
- HTTP 请求（URL、method、headers、body）
- 数据库查询（ORM 语句和耗时）
- 缓存操作（Redis/Memcached 调用）
- 模板渲染错误
- Celery 任务上下文

**Flask 集成**：

```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

app = Flask(__name__)

sentry_sdk.init(
    dsn="https://examplePublicKey@o0.ingest.sentry.io/0",
    integrations=[FlaskIntegration(transaction_style="url")],
    traces_sample_rate=1.0,
)
```

**FastAPI 集成**：

```python
import sentry_sdk
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration

app = FastAPI()

sentry_sdk.init(
    dsn="https://examplePublicKey@o0.ingest.sentry.io/0",
    integrations=[
        StarletteIntegration(transaction_style="url"),
        FastApiIntegration(transaction_style="url"),
    ],
    traces_sample_rate=1.0,
)
```

**Python 常用集成列表**：

| 集成 | 包路径 | 用途 |
| --- | --- | --- |
| Django | `sentry_sdk.integrations.django.DjangoIntegration` | Django Web 框架全栈监控 |
| Flask | `sentry_sdk.integrations.flask.FlaskIntegration` | Flask Web 框架监控 |
| FastAPI | `sentry_sdk.integrations.fastapi.FastApiIntegration` | FastAPI 异步框架监控 |
| Celery | `sentry_sdk.integrations.celery.CeleryIntegration` | Celery 任务队列监控 |
| SQLAlchemy | `sentry_sdk.integrations.sqlalchemy.SqlalchemyIntegration` | ORM 查询性能追踪 |
| Redis | `sentry_sdk.integrations.redis.RedisIntegration` | Redis 操作追踪 |
| Logging | `sentry_sdk.integrations.logging.LoggingIntegration` | Python logging 集成 |
| AWS Lambda | `sentry_sdk.integrations.aws_lambda.AwsLambdaIntegration` | 无服务器函数监控 |
| gRPC | `sentry_sdk.integrations.grpc.GrpcIntegration` | gRPC 服务监控 |
| RQ | `sentry_sdk.integrations.rq.RQIntegration` | RQ 任务队列监控 |
| Quart | `sentry_sdk.integrations.quart.QuartIntegration` | Quart 异步 Web 框架 |
| Bottle | `sentry_sdk.integrations.bottle.BottleIntegration` | Bottle 微框架监控 |

### 5.9.2 JavaScript/TypeScript（@sentry/browser）

**安装**：

```bash
npm install @sentry/browser
```

**基础集成**：

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
    dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
```

**Node.js 集成**：

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
    dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
    integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
    ],
    tracesSampleRate: 1.0,
});
```

**React 集成**：

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
    dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
        Sentry.reactRouterV6BrowserTracingIntegration({ ... }),
    ],
    tracesSampleRate: 1.0,
});

// 使用 Error Boundary 捕获组件渲染错误
function App() {
    return (
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
            <Main />
        </Sentry.ErrorBoundary>
    );
}
```

**Next.js 集成**：

```javascript
// sentry.client.config.js (客户端)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
    tracesSampleRate: 1.0,
});

// sentry.server.config.js (服务端)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
    tracesSampleRate: 1.0,
});
```

### 5.9.3 Java（sentry-java）

**安装（Gradle）**：

```groovy
dependencies {
    implementation 'io.sentry:sentry-spring-boot-starter:7.x.x'
}
```

**Spring Boot 集成**：

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import io.sentry.Sentry;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        // Spring Boot 自动配置 Sentry，也可以通过 application.properties 配置
        SpringApplication.run(Application.class, args);
    }
}
```

**application.properties 配置**：

```properties
sentry.dsn=https://examplePublicKey@o0.ingest.sentry.io/0
sentry.environment=production
sentry.release=myapp@1.0.0
sentry.traces-sample-rate=0.2
sentry.send-default-pii=true
sentry.logging.minimum-event-level=error
sentry.logging.minimum-breadcrumb-level=info
```

**手动捕获异常**：

```java
import io.sentry.Sentry;
import io.sentry.SentryLevel;

try {
    riskyOperation();
} catch (Exception e) {
    Sentry.configureScope(scope -> {
        scope.setTag("feature", "payment");
        scope.setExtra("order_id", order.getId());
    });
    Sentry.captureException(e);
}
```

### 5.9.4 .NET（Sentry.AspNetCore）

**安装（NuGet）**：

```bash
dotnet add package Sentry.AspNetCore
```

**ASP.NET Core 集成**：

```csharp
using Sentry;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseSentry(options =>
{
    options.Dsn = "https://examplePublicKey@o0.ingest.sentry.io/0";
    options.Environment = "production";
    options.Release = "myapp@1.0.0";
    options.TracesSampleRate = 0.2;
    options.SendDefaultPii = true;
    options.MaxRequestBodySize = RequestSize.Always;
    options.MinimumBreadcrumbLevel = LogLevel.Information;
    options.MinimumEventLevel = LogLevel.Error;
});

var app = builder.Build();
app.UseSentryTracing();
app.Run();
```

**手动捕获异常**：

```csharp
using Sentry;

try
{
    RiskyOperation();
}
catch (Exception ex)
{
    SentrySdk.ConfigureScope(scope =>
    {
        scope.SetTag("feature", "payment");
        scope.SetExtra("order_id", orderId);
    });
    SentrySdk.CaptureException(ex);
}
```

**Serilog 集成**：

```csharp
Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.Sentry(o =>
    {
        o.Dsn = "https://examplePublicKey@o0.ingest.sentry.io/0";
        o.MinimumBreadcrumbLevel = LogEventLevel.Information;
        o.MinimumEventLevel = LogEventLevel.Error;
    })
    .CreateLogger();
```

---

## 5.10 SDK 性能与最佳实践

### 5.10.1 采样率配置

采样率是控制 Sentry 数据量和成本的关键参数。Sentry 支持两种采样率：

- **Error Sample Rate**（错误采样率）：控制错误事件的采样比例。通常设为 `1.0`（100%），因为错误数量相对较少
- **Traces Sample Rate**（性能追踪采样率）：控制 Transaction 事件的采样比例。根据流量规模调整，通常设为 `0.1` 到 `0.5`

```python
sentry_sdk.init(
    dsn="...",
    sample_rate=1.0,              # 错误事件 100% 采样
    traces_sample_rate=0.1,       # 性能追踪 10% 采样
    profiles_sample_rate=0.05,    # 性能剖析 5% 采样
)
```

**采样函数**（更精细的控制）：

```python
def traces_sampler(sampling_context):
    """
    根据上下文动态决定采样率
    """
    path = sampling_context.get("wsgi_environ", {}).get("PATH_INFO", "")

    # 健康检查端点的采样率设为 0
    if path.startswith("/health"):
        return 0.0

    # 重要事务的采样率提升到 50%
    if path.startswith("/api/payment"):
        return 0.5

    # 默认 10% 采样
    return 0.1

sentry_sdk.init(
    dsn="...",
    traces_sampler=traces_sampler,
)
```

从 Sentry 自己的采样配置（`src/sentry/utils/sdk.py:198-219`）可以看到生产实践中的精细化采样控制：

```python
def traces_sampler(sampling_context):
    wsgi_path = sampling_context.get("wsgi_environ", {}).get("PATH_INFO")
    if wsgi_path and wsgi_path in SAMPLED_ROUTES:
        return SAMPLED_ROUTES[wsgi_path]

    custom_sample_rate = sampling_context.get("sample_rate")
    if custom_sample_rate is not None:
        return float(custom_sample_rate)

    if sampling_context["parent_sampled"] is not None:
        return sampling_context["parent_sampled"]

    if "taskworker" in sampling_context:
        task_name = sampling_context["taskworker"].get("task")
        if task_name in SAMPLED_TASKS:
            return SAMPLED_TASKS[task_name]

    return float(settings.SENTRY_BACKEND_APM_SAMPLING or 0)
```

这个函数展示了几个重要的采样模式：
1. **按路由采样**：对特定路径（如预热端点）采样率降为 0
2. **上下文传播**：如果上游已有采样决策（`parent_sampled`），则沿用
3. **按任务采样**：不同后台任务使用不同的采样率
4. **默认后备**：所有未匹配的情况使用统一的默认采样率

### 5.10.2 事件批量发送

SDK 支持将多个事件批量打包到一个 Envelope 中发送，减少网络往返次数：

```json
// Envelope 结构
{"event_id":"abc123","sent_at":"2024-01-15T10:30:00.000Z"}
{"type":"event"}
{"event_id":"abc123","platform":"python","exception":{...}}

{"type":"span","length":200}
{"trace_id":"...","span_id":"...","op":"db.query",...}
```

Envelope 的优势：
1. 将事件和关联的 Spans、Attachments 打包在同一个 HTTP 请求中
2. 减少 HTTP 开销，提升吞吐量
3. 事件与附件原子性地传输

### 5.10.3 传输队列管理

SDK 维护一个内部传输队列，事件先入队后异步发送，避免阻塞应用主线程。关键配置项：

```python
sentry_sdk.init(
    dsn="...",
    transport_queue_size=2000,  # 队列最大容量（Sentry 内部设置）
    shutdown_timeout=5,          # 关闭时等待发送完成的超时秒数
)
```

从 Sentry 自己的配置（`src/sentry/utils/sdk.py:333`）可以看到：

```python
sdk_options["transport_queue_size"] = 2_000
```

建议：
- 在进程**正常关闭**（`SIGTERM`）时，调用 `sentry_sdk.flush()` 确保队列中的事件全部发送
- 避免在**高频循环**中大量产生事件，可能导致队列溢出

### 5.10.4 敏感数据处理

**不要发送的数据**：
- 密码、密钥、Token
- 身份证号、银行卡号
- 用户的认证 Cookie
- 内部 IP 地址和主机名（如果不可公开）

**推荐的脱敏策略**：

1. **使用 before_send 全局过滤**：

```python
def before_send(event, hint):
    # 使用正则表达式脱敏
    import re
    def scrub(value):
        if isinstance(value, str):
            return re.sub(r'secret_\w+', '[REDACTED]', value)
        return value

    # 脱敏 request body
    if "request" in event and "data" in event["request"]:
        if isinstance(event["request"]["data"], dict):
            for k, v in event["request"]["data"].items():
                event["request"]["data"][k] = scrub(v)
    return event
```

2. **使用 send_default_pii=False**（默认值）：

不回传用户的 IP 地址、Cookie 和 HTTP Body 中的个人信息。

3. **设置 max_request_body_size**：

限制 SDK 捕获的 HTTP 请求体大小：

```python
sentry_sdk.init(dsn="...", max_request_body_size="small")  # 仅捕获前几千字节
```

### 5.10.5 健康检查排除

健康检查端点（如 `/health`、`/ready`）通常不应产生 Sentry 事件。有两种排除方式：

**方式一：在 traces_sampler 中统一排除**：

```python
def traces_sampler(ctx):
    if ctx.get("wsgi_environ", {}).get("PATH_INFO", "") == "/health":
        return 0.0
    return 0.1
```

**方式二：在 before_send 中丢弃**：

```python
def before_send(event, hint):
    if event.get("transaction") == "/health":
        return None
    return event
```

值得注意的是，Sentry 的 Relay 网关也内置了 `_healthcheck_filter` 入站过滤器（`src/sentry/ingest/inbound_filters.py:77`），可以自动过滤掉配置的 `/health` 类路径事件。建议同时使用 SDK 端和 Relay 端两层过滤，最大化减轻服务端负担。

### 5.10.6 最佳实践总结

| 类别 | 建议 | 说明 |
| --- | --- | --- |
| DSN 安全 | 使用环境变量存储 DSN | 不要将 DSN 硬编码在源码中 |
| 版本号 | 每部署设置 release | 格式建议 `项目名@版本号`，如 `myapp@1.2.3` |
| 环境标识 | 区分 environment | 至少区分 `production`、`staging`、`development` |
| 采样率 | 性能数据适度采样 | Error 建议 100%，Transaction 建议 10%-50% |
| Tags 基数 | 低基数标签 | 每个 Tag 取值不超过 1000 个，避免高基数 |
| Breadcrumbs | 控制在 100 以内 | 在循环中谨慎添加面包屑 |
| 敏感数据 | 使用 before_send 脱敏 | 永远不要发送密码、Token 等敏感信息 |
| 队列刷新 | 进程关闭前调用 flush() | 确保未发送的事件不会丢失 |
| 依赖版本 | 保持 SDK 更新 | 新版本修复已知问题并支持新功能 |
| 集成选择 | 按需启用集成 | 只启用实际使用的框架集成，减少开销 |

---

> **本章小结**：Sentry SDK 的设计遵循统一的分层架构——从应用层的全局异常抓取，到 Scope/Hub/Client 的事件构建与修饰，再到 Transport 的网络传输。事件数据结构的精心设计（29 个核心字段和接口）保证了跨语言、跨平台的统一诊断体验。事件从 SDK 上报到服务端持久化的完整链路涉及 Relay 网关、Kafka 队列、Ingest Consumer、Normalizer 规范化、EventManager 保存等多个阶段，每个阶段都有专门的优化和防护机制。理解这些原理，有助于在实际项目中更高效地使用 Sentry，也帮助在排查 SDK 相关问题时有更清晰的思路。
