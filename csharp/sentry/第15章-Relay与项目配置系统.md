---
layout: default
title: 第十五章：Relay 与项目配置系统
---

# 第十五章：Relay 与项目配置系统

## 目录

- [15.1 Relay 概述](#151-relay-概述)
  - [15.1.1 Relay 是什么](#1511-relay-是什么)
  - [15.1.2 Relay 在 Sentry 架构中的定位](#1512-relay-在-sentry-架构中的定位)
  - [15.1.3 内部 Relay vs 外部 Relay](#1513-内部-relay-vs-外部-relay)
- [15.2 Relay 的核心功能](#152-relay-的核心功能)
  - [15.2.1 事件过滤（Inbound Filters）](#1521-事件过滤inbound-filters)
  - [15.2.2 速率限制（Rate Limiting）](#1522-速率限制rate-limiting)
  - [15.2.3 数据清理（PII Scrubbing）](#1523-数据清理pii-scrubbing)
  - [15.2.4 事件规范化（Event Normalization）](#1524-事件规范化event-normalization)
  - [15.2.5 动态采样（Dynamic Sampling）](#1525-动态采样dynamic-sampling)
  - [15.2.6 指标提取（Metric Extraction）](#1526-指标提取metric-extraction)
- [15.3 项目配置（Project Config）生成系统](#153-项目配置project-config生成系统)
  - [15.3.1 ProjectConfig 数据结构](#1531-projectconfig-数据结构)
  - [15.3.2 配置生成流程](#1532-配置生成流程)
  - [15.3.3 配置缓存机制](#1533-配置缓存机制)
  - [15.3.4 配置防抖（Debounce）机制](#1534-配置防抖debounce机制)
  - [15.3.5 全局配置（Global Config）](#1535-全局配置global-config)
- [15.4 动态配置系统](#154-动态配置系统)
  - [15.4.1 Option Store 架构](#1541-option-store-架构)
  - [15.4.2 Project Options 注册与默认值](#1542-project-options-注册与默认值)
  - [15.4.3 配置刷新的触发机制](#1543-配置刷新的触发机制)
- [15.5 Feature Flags（功能开关）系统](#155-feature-flags功能开关系统)
  - [15.5.1 Feature Manager 架构](#1551-feature-manager-架构)
  - [15.5.2 FlagPole 集成](#1552-flagpole-集成)
  - [15.5.3 灰度发布与 A/B 测试](#1553-灰度发布与-ab-测试)
  - [15.5.4 公开给 Relay 的特性列表](#1554-公开给-relay-的特性列表)
- [15.6 数据清理规则（Data Scrubbing Rules）](#156-数据清理规则data-scrubbing-rules)
  - [15.6.1 PII 配置结构](#1561-pii-配置结构)
  - [15.6.2 组织级与项目级的规则合并](#1562-组织级与项目级的规则合并)
  - [15.6.3 敏感字段自定义](#1563-敏感字段自定义)
  - [15.6.4 高级规则语法](#1564-高级规则语法)
- [15.7 流入过滤器（Inbound Filters）配置](#157-流入过滤器inbound-filters配置)
  - [15.7.1 过滤器类型总览](#1571-过滤器类型总览)
  - [15.7.2 过滤器配置的加载与传递](#1572-过滤器配置的加载与传递)
  - [15.7.3 通用过滤器（Generic Filters）](#1573-通用过滤器generic-filters)
  - [15.7.4 CSP 过滤器](#1574-csp-过滤器)
- [15.8 速率限制配置](#158-速率限制配置)
  - [15.8.1 Quota 配置结构](#1581-quota-配置结构)
  - [15.8.2 Key 级别限流](#1582-key-级别限流)
  - [15.8.3 项目级别限流](#1583-项目级别限流)
  - [15.8.4 组织级别限流](#1584-组织级别限流)
  - [15.8.5 滥用保护配额](#1585-滥用保护配额)
- [15.9 Relay 与 Sentry 的通信协议](#159-relay-与-sentry-的通信协议)
  - [15.9.1 Relay 注册流程](#1591-relay-注册流程)
  - [15.9.2 项目配置拉取端点](#1592-项目配置拉取端点)
  - [15.9.3 心跳检测](#1593-心跳检测)
  - [15.9.4 公钥交换](#1594-公钥交换)
  - [15.9.5 配置同步时序](#1595-配置同步时序)
- [15.10 自建 Relay 部署与配置](#1510-自建-relay-部署与配置)
  - [15.10.1 Relay 配置文件](#15101-relay-配置文件)
  - [15.10.2 与 Sentry 服务器的对接](#15102-与-sentry-服务器的对接)
  - [15.10.3 网络拓扑建议](#15103-网络拓扑建议)
  - [15.10.4 性能调优要点](#15104-性能调优要点)

---

## 15.1 Relay 概述

### 15.1.1 Relay 是什么

Relay 是 Sentry 官方使用 Rust 语言编写的事件代理服务，是 SDK 端与 Sentry 后端之间的一道智能网关。它不是简单的流量转发器，而是一个在边缘就承担了大量业务逻辑的安全边界。Relay 在事件进入 Sentry 存储之前，负责执行事件过滤、速率限制、PII 数据脱敏、事件规范化等一系列操作。

Relay 的设计目标十分明确：

1. **安全边界**：在敏感数据进入 Sentry 后端存储之前完成脱敏，确保运营人员不会接触原始敏感信息。
2. **流量控制**：在事件链路的最前端实施速率限制，防止单个项目或 Key 的异常流量冲击整个系统。
3. **计算卸载**：将事件规范化、采样决策、指标预提取等 CPU 密集型操作从 Python/Django 后端卸载到 Rust 实现的高性能代理。
4. **网络隔离**：支持在客户的内部网络部署外部 Relay，确保数据不出 VPC。

Relay 是一个独立的开源项目，代码仓库为 `getsentry/relay`，使用 Rust 异步运行时（tokio）构建，具备极高的吞吐量和极低的内存占用。Sentry 仓库（`getsentry/sentry`）中与 Relay 相关的规范定义在 `src/sentry/relay/` 目录下。

### 15.1.2 Relay 在 Sentry 架构中的定位

在 Sentry 的事件处理流水线中，Relay 位于 SDK 和 Sentry 后端之间：

```
+------+     +-------+     +---------+     +-------+     +----------+
| SDK  | --> | Relay | --> | Django  | --> | Kafka | --> | Consumer |
+------+     +-------+     +---------+     +-------+     +----------+
                  |              |
                  v              v
            过滤/限流      存储 / 处理
              脱敏/采样      告警 / 通知
```

Sentry 的 Relay 模型 `sentry.models.relay.Relay` 存储了所有注册 Relay 的元数据（`src/sentry/models/relay.py`）：

```python
@cell_silo_model
class Relay(OverwritableConfigMixin, Model):
    relay_id = models.CharField(max_length=64, unique=True)
    public_key = models.CharField(max_length=200)
    is_internal = models.BooleanField(default=None, null=True)

    def has_org_access(self, org):
        # Internal relays always have access
        if self.is_internal:
            return True
        trusted_relays = org.get_option("sentry:trusted-relays", [])
        key = str(self.public_key_object)
        for relay_info in trusted_relays:
            if relay_info is not None and relay_info.get("public_key") == key:
                return True
        return False
```

### 15.1.3 内部 Relay vs 外部 Relay

Sentry 区分两种 Relay 类型：

**内部 Relay (Internal Relay)**：由 Sentry 部署方自身管理，通常运行在 Sentry 基础设施内部。内部 Relay 拥有全部组织的事件访问权限。

**外部 Relay (External Relay)**：由客户在自有基础设施中部署。外部 Relay 只有在对应组织的 `sentry:trusted-relays` 选项中注册其公钥后，才能获取该组织的项目配置。外部 Relay 非常适合需要数据不出 VPC、或需要在靠近应用的位置进行 PII 脱敏的场景。

从 `sentry/api/endpoints/relay/project_configs.py` 中可以看到访问控制逻辑：

```python
if not relay.is_internal:
    return Response("Relay unauthorized for config information", status=403)
```

配置拉取时，内部 Relay 可以获取全部配置，外部 Relay 则会经过组织级别的访问控制过滤。

---

## 15.2 Relay 的核心功能

### 15.2.1 事件过滤（Inbound Filters）

Relay 在事件进入处理管道的第一时间就执行流入过滤。过滤规则包含在项目配置的 `filterSettings` 字段中，由 Relay 直接执行，被过滤的事件不会产生任何存储或计费开销。

过滤器配置的生成逻辑在 `src/sentry/relay/config/__init__.py` 中的 `get_filter_settings()` 函数：

```python
def get_filter_settings(project: Project) -> Mapping[str, Any]:
    filter_settings = {}

    for flt in get_all_filter_specs():
        filter_id = get_filter_key(flt)
        settings = _load_filter_settings(flt, project)

        if settings is not None and settings.get("isEnabled", True):
            filter_settings[filter_id] = settings
    # ... 自定义过滤器的处理 ...
    return filter_settings
```

过滤器配置最终以 JSON 形式嵌入 Project Config，Relay 逐项评估每个过滤规则。具体的过滤器类型和配置在 [15.7 节](#157-流入过滤器inbound-filters配置) 中详细展开。

### 15.2.2 速率限制（Rate Limiting）

速率限制是 Relay 的核心能力之一。配额配置通过 `get_quotas()` 函数计算，封装在 Project Config 的 `quotas` 字段中：

```python
def get_quotas(project: Project, keys: Iterable[ProjectKey] | None = None) -> list[str]:
    try:
        computed_quotas = [
            quota.to_json() for quota in quotas.backend.get_quotas(project, keys=keys)
        ]
    except BaseException:
        metrics.incr("relay.config.get_quotas", tags={"success": False}, sample_rate=1.0)
        raise
    else:
        metrics.incr("relay.config.get_quotas", tags={"success": True}, sample_rate=1.0)
        return computed_quotas
```

Relay 内部维护了基于滑动窗口的计数器和令牌桶算法来实施限流。当事件被限流拒绝时，Relay 会返回 429 状态码，SDK 端负责实现退避重试策略。详细的配额结构在 [15.8 节](#158-速率限制配置) 中展开。

### 15.2.3 数据清理（PII Scrubbing）

PII 数据清理是整个 Relay 系统中安全策略的核心。Sentry 在 Project Config 中传递 `piiConfig` 和 `datascrubbingSettings` 两个字段给 Relay，后者据此对事件的每一条数据执行脱敏处理。

配置生成在 `src/sentry/relay/datascrubbing.py` 中：

```python
def get_pii_config(project):
    def _decode(value):
        if value:
            return safe_execute(orjson.loads, value)

    return _merge_pii_configs(
        [
            ("organization:", _decode(project.organization.get_option("sentry:relay_pii_config"))),
            ("project:", _decode(project.get_option("sentry:relay_pii_config"))),
        ]
    )
```

合并顺序至关重要：先应用组织级规则，再应用项目级规则。如果反过来，项目级的松散规则可能会覆盖组织级的严格规则，造成数据泄露风险。

详细的 PII 清理机制在 [15.6 节](#156-数据清理规则data-scrubbing-rules) 中展开。

### 15.2.4 事件规范化（Event Normalization）

Relay 对接收到的原始事件执行规范化处理，包括：

- **数据格式标准化**：将 SDK 上报的各种格式的事件转换为 Sentry 内部统一的事件格式（Envelope）。
- **字段补齐**：补充时间戳、平台信息、SDK 版本等元数据字段。
- **堆栈跟踪规范化**：将不同语言/平台的堆栈格式统一化。
- **分组配置应用**：根据 Project Config 中的 `groupingConfig` 字段，在 Relay 端初步计算事件的指纹（fingerprint）。

分组配置通过 `get_grouping_config_dict_for_project()` 获取并嵌入到 Project Config 中：

```python
grouping_config = get_grouping_config_dict_for_project(project)
if grouping_config is not None:
    config["groupingConfig"] = grouping_config
```

### 15.2.5 动态采样（Dynamic Sampling）

动态采样功能允许 Relay 根据采样规则决定哪些事件保留、哪些丢弃。这在处理高流量（百万 QPS 级别）的项目时尤为重要。采样配置的生成如下：

```python
def get_dynamic_sampling_config(timeout: TimeChecker, project: Project) -> Mapping[str, Any] | None:
    if options.get("dynamic-sampling.config.killswitch"):
        return None

    if features.has("organizations:dynamic-sampling", project.organization):
        return {"version": 2, "rules": generate_rules(project)}

    return None
```

采样规则由 `generate_rules(project)` 生成，基于项目的事务量、性能指标等因素动态计算。Relay 端根据这些规则决定每个事件的采样结果。

采样配置存在一个紧急关闭开关（killswitch），当 `dynamic-sampling.config.killswitch` 被触发时，所有采样逻辑停用，所有事件都会被转发——这会导致额外的系统负载，仅用于版本迁移的过渡期。

### 15.2.6 指标提取（Metric Extraction）

Relay 还承担了从事务事件中预提取指标的职责。通过 `get_metric_extraction_config()` 生成的配置，Relay 可以在事件规范化过程中同步提取性能指标（如 duration、throughput、failure rate 等），从而避免在 Snuba/ClickHouse 端重复扫描原始数据。

指标提取的版本通过 `EXTRACT_METRICS_VERSION` 和 `EXTRACT_ABNORMAL_MECHANISM_VERSION` 控制：

```python
EXTRACT_METRICS_VERSION = 1
EXTRACT_ABNORMAL_MECHANISM_VERSION = 2
```

Relay 还支持条件标签（Conditional Tagging），允许根据事件的特定属性动态决定哪些标签被附加到提取的指标上：

```python
add_experimental_config(
    config,
    "metricConditionalTagging",
    get_metric_conditional_tagging_rules,
    project,
)
```

---

## 15.3 项目配置（Project Config）生成系统

### 15.3.1 ProjectConfig 数据结构

Project Config 是 Sentry 后端传递给 Relay 的、描述单个项目如何被 Relay 处理的核心配置对象。它由 `sentry.relay.config._ConfigBase` 和 `ProjectConfig` 类封装：

```python
class _ConfigBase:
    def __init__(self, **kwargs: Any) -> None:
        data: MutableMapping[str, Any] = {}
        object.__setattr__(self, "data", data)
        for key, val in kwargs.items():
            if val is not None:
                data[key] = val

    def to_json_string(self) -> Any:
        data = self.to_dict()
        return utils.json.dumps(data)

class ProjectConfig(_ConfigBase):
    def __init__(self, project: Project, **kwargs: Any) -> None:
        object.__setattr__(self, "project", project)
        super().__init__(**kwargs)
```

通过 `_get_project_config()` 函数构建的完整 Project Config 包含以下核心字段：

| 字段 | 说明 | 来源 |
|---|---|---|
| `disabled` | 项目是否被禁用 | `project.status != ObjectStatus.ACTIVE` |
| `slug` | 项目标识符 | `project.slug` |
| `publicKeys` | 项目的 DSN 公钥列表 | `get_public_key_configs()` |
| `config.allowedDomains` | 允许的事件来源域名 | `get_origins(project)` |
| `config.trustedRelays` | 组织信任的外部 Relay 公钥 | `sentry:trusted-relays` |
| `config.piiConfig` | PII 脱敏规则 | `get_pii_config(project)` |
| `config.datascrubbingSettings` | 数据清理设置 | `get_datascrubbing_settings(project)` |
| `config.features` | 公开给 Relay 的特性开关 | `get_exposed_features(project)` |
| `config.filterSettings` | 流入过滤器配置 | `get_filter_settings(project)` |
| `config.groupingConfig` | 事件分组配置 | `get_grouping_config_dict_for_project(project)` |
| `config.quotas` | 速率限制配额 | `get_quotas(project, keys=project_keys)` |
| `config.sampling` | 动态采样规则 | `get_dynamic_sampling_config()` |
| `config.metricExtraction` | 指标提取配置 | `get_metric_extraction_config(project)` |
| `config.performanceScore` | 性能评分参数 | 各浏览器厂商的基准配置 |
| `organizationId` | 所属组织 ID | `project.organization_id` |
| `projectId` | 项目 ID | `project.id` |

### 15.3.2 配置生成流程

Project Config 的生成是一个复杂的过程，涉及多个子系统的数据聚合。`_get_project_config()` 函数（`src/sentry/relay/config/__init__.py:824`）是这一流程的入口：

```python
def _get_project_config(
    project: Project, project_keys: Iterable[ProjectKey] | None = None
) -> ProjectConfig:
    if project.status != ObjectStatus.ACTIVE:
        return ProjectConfig(project, disabled=True)

    public_keys = get_public_key_configs(project_keys=project_keys)

    with start_span(op="get_public_config", name="get_public_config"):
        now = datetime.now(timezone.utc)
        cfg = {
            "disabled": False,
            "slug": project.slug,
            "lastFetch": now,
            "lastChange": now,
            "rev": uuid.uuid4().hex,
            "publicKeys": public_keys,
            "config": {
                "allowedDomains": list(get_origins(project)),
                "trustedRelays": [...],
                "piiConfig": get_pii_config(project),
                "datascrubbingSettings": get_datascrubbing_settings(project),
            },
            "organizationId": project.organization_id,
            "projectId": project.id,
        }
    # ... 后续加载 filterSettings, groupingConfig, quotas, sampling 等 ...
    return ProjectConfig(project, **cfg)
```

配置生成的每一步都包含了性能监控埋点（`start_span`），便于追踪生产环境中配置生成的性能瓶颈。

有一个关键的容错设计：实验性配置字段（如 `sampling`、`txNameRules`、`metricConditionalTagging`）使用 `add_experimental_config()` 函数包装，任何单字段的构建失败都不会影响整体 Project Config 的生成：

```python
def add_experimental_config(
    config: MutableMapping[str, Any],
    key: str,
    function: ExperimentalConfigBuilder,
    *args: Any,
    **kwargs: Any,
) -> None:
    if subconfig := build_safe_config(key, function, *args, **kwargs):
        config[key] = subconfig
```

`build_safe_config()` 为每个实验性配置字段提供了 20 秒的超时保护（`_FEATURE_BUILD_TIMEOUT = timedelta(seconds=20)`），超时或异常将仅导致该字段缺失，不会阻塞整个配置的生成。

### 15.3.3 配置缓存机制

Project Config 的缓存是系统性能的关键。配置存储在 Redis 中，通过 `sentry.relay.projectconfig_cache` 模块实现：

```python
class RedisProjectConfigCache(ProjectConfigCache):
    def __init__(self, **options):
        cluster_key = options.get("cluster", "default")
        self.cluster = redis.redis_clusters.get_binary(cluster_key)
        read_cluster_key = options.get("read_cluster", cluster_key)
        self.cluster_read = redis.redis_clusters.get_binary(read_cluster_key)

    def set_many(self, configs: dict[str, Mapping[str, Any]]):
        p = self.cluster.pipeline(transaction=False)
        for public_key, config in configs.items():
            serialized = json.dumps(config).encode()
            compressed = zstandard.compress(serialized, level=COMPRESSION_LEVEL)
            p.setex(self.__get_redis_key(public_key), REDIS_CACHE_TIMEOUT, compressed)
            if rev := config.get("rev"):
                p.setex(self.__get_redis_rev_key(public_key), REDIS_CACHE_TIMEOUT, rev)
        p.execute()
```

缓存设计的几个关键点：

1. **Zstandard 压缩**：配置 JSON 使用 zstd（level 3）压缩后存储，大幅降低 Redis 内存占用。
2. **TTL 为 2 小时 20 分钟**：`REDIS_CACHE_TIMEOUT = 8400` 秒。
3. **读写分离**：支持独立的 Redis 读写集群，通过 `read_cluster` 参数指定。
4. **版本号（rev）**：每次配置更新时生成新的 UUID 版本号，允许 Relay 高效判断配置是否有变化。

配置缓存的 Key 格式为 `relayconfig:{public_key}`，版本号为 `relayconfig:{public_key}.rev`。

### 15.3.4 配置防抖（Debounce）机制

当项目或组织的大量配置项频繁变更时，如果每次变更都立即重建 Project Config，会产生大量重复计算和缓存写入。防抖缓存（Debounce Cache）解决了这个问题：

```python
class RedisProjectConfigDebounceCache(ProjectConfigDebounceCache):
    def __init__(self, **options):
        self._key_prefix = options.pop("key_prefix", "relayconfig-debounce")
        self._debounce_ttl = options.pop("debounce_ttl", REDIS_CACHE_TIMEOUT)

    def is_debounced(self, *, public_key, project_id, organization_id):
        if organization_id:
            key = self._get_redis_key(public_key=None, project_id=None, organization_id=organization_id)
            client = self._get_redis_client(key)
            if client.get(key):
                return True
        if project_id:
            key = self._get_redis_key(public_key=None, project_id=project_id, organization_id=None)
            client = self._get_redis_client(key)
            if client.get(key):
                return True
        if public_key:
            key = self._get_redis_key(public_key=public_key, project_id=None, organization_id=None)
            client = self._get_redis_client(key)
            if client.get(key):
                return True
        return False
```

防抖以多层级方式进行：如果组织级别触发了防抖，则对该组织下所有项目和 Key 的配置重建任务都会被抑制；如果项目级别触发防抖，则仅抑制该项目及其 Key。

在 `src/sentry/tasks/relay.py` 中，`schedule_build_project_config()` 函数使用防抖来避免重复调度：

```python
def schedule_build_project_config(public_key):
    tmp_scheduled = time.time()
    if projectconfig_debounce_cache.backend.is_debounced(
        public_key=public_key, project_id=None, organization_id=None
    ):
        metrics.incr("relay.projectconfig_cache.skipped", tags={"reason": "debounce", "task": "build"})
        return

    build_project_config.delay(public_key=public_key, tmp_scheduled=tmp_scheduled)
    projectconfig_debounce_cache.backend.debounce(
        public_key=public_key, project_id=None, organization_id=None
    )
```

注意防抖的顺序：先调度任务，再设置防抖标记。如果顺序颠倒，进程在标记防抖后崩溃，任务就永远丢失了。

此外，`NON_INVALIDATING_PROJECT_OPTIONS` 列表定义了不会触发配置无效化的项目选项：

```python
NON_INVALIDATING_PROJECT_OPTIONS = [
    "sentry:_last_auto_resolve",
    "sentry:transaction_name_cluster_meta",
    *[f"quotas:{category.value}-spike-protection-currently-active" for category in DataCategory],
]
```

### 15.3.5 全局配置（Global Config）

除了每个项目独立的 Project Config 外，Sentry 还维护了一份全局配置（Global Config），适用于所有 Relay 实例。定义在 `src/sentry/relay/globalconfig.py`：

```python
class GlobalConfig(TypedDict, total=False):
    measurements: MeasurementsConfig
    aiModelMetadata: AIModelMetadataConfig | None
    metricExtraction: MetricExtractionGroups
    filters: GenericFiltersConfig | None
    spanOpDefaults: SpanOpDefaults
    options: dict[str, Any]
```

全局配置由 `get_global_config()` 函数生成，包含跨项目的基础设置：

- **measurements**：自定义度量（如 Web Vitals）的定义配置
- **aiModelMetadata**：AI 模型使用量的计费信息
- **metricExtraction**：全局的指标提取分组规则
- **spanOpDefaults**：Span 操作的默认行为规则（例如如何覆盖 `messaging.system` 属性的 span）
- **options**：精选的 Sentry 选项，通过 `RELAY_OPTIONS` 列表控制

全局配置在 Relay 通过 v3 协议请求配置时，若请求体中包含 `"global": true`，会被一并返回：

```python
if version == "3" and request.relay_request_data.get("global"):
    response["global"] = get_global_config()
    response["global_status"] = "ready"
```

---

## 15.4 动态配置系统

### 15.4.1 Option Store 架构

Sentry 的动态配置通过 `OptionsManager`（`src/sentry/options/manager.py`）实现，它提供了一个分层次的键值存储系统：

```python
class OptionsManager:
    def get(self, key: str, silent=False):
        with metrics.timer("options.store.get", tags={"key": key, ...}):
            opt = self.lookup_key(key)

            if self._read_hook is not None:
                result = self._read_hook(key, opt)
                if result is not READ_HOOK_FALLBACK:
                    return result

            if opt.has_any_flag({FLAG_PRIORITIZE_DISK}):
                try:
                    result = settings.SENTRY_OPTIONS[key]
                except KeyError:
                    pass
                else:
                    if result is not None:
                        return result

            if not (opt.flags & FLAG_NOSTORE):
                result = self.store.get(opt, silent=silent)
                if result is not None:
                    return result
            # fallback to default
            ...
```

选项查询的优先级链路为：

1. **Read Hook**：自定义读取钩子（用于 FlagPole 等动态数据源）。
2. **本地磁盘/环境变量**：标记为 `FLAG_PRIORITIZE_DISK` 的选项优先从本地配置读取。
3. **外部存储**：通过 `OptionsStore` 从外部（如数据库）读取。
4. **本地默认值**：`settings.SENTRY_OPTIONS` 或 `settings.SENTRY_DEFAULT_OPTIONS` 中的默认值。

选项注册时的 Flag 标志控制了其行为：

| Flag | 含义 |
|---|---|
| `FLAG_NOSTORE` | 选项不存储到外部，仅从本地默认值读取 |
| `FLAG_STOREONLY` | 选项仅从外部存储读取，不使用本地默认值 |
| `FLAG_PRIORITIZE_DISK` | 优先从本地配置读取 |
| `FLAG_IMMUTABLE` | 选项在运行时不可更改 |
| `FLAG_AUTOMATOR_MODIFIABLE` | 选项可被自动化系统修改（如 FlagPole） |

### 15.4.2 Project Options 注册与默认值

项目级选项通过 `ProjectOptionsManager` 和 `WellKnownProjectOption` 管理（`src/sentry/projectoptions/manager.py`）：

```python
class WellKnownProjectOption:
    def __init__(self, key, default=None, epoch_defaults=None):
        self.key = key
        self.default = default
        self.epoch_defaults = epoch_defaults
        self._epoch_default_list = sorted(epoch_defaults or ())

    def get_default(self, project=None, epoch=None):
        if self.epoch_defaults:
            if epoch is None:
                if project is None:
                    epoch = 1
                else:
                    epoch = project.get_option("sentry:option-epoch") or 1
            idx = bisect.bisect(self._epoch_default_list, epoch)
            if idx > 0:
                return self.epoch_defaults[self._epoch_default_list[idx - 1]]
        return self.default
```

Project Options 的重大创新是**时代（Epoch）机制**。每个项目有一个 `sentry:option-epoch` 值，新创建的项目会获得最新的 epoch（当前为 `LATEST_EPOCH = 15`）。选项可以定义 `epoch_defaults`，为不同 epoch 的项目提供不同的默认值：

```python
# 示例：不同 epoch 的项目使用不同的 SDK Loader 版本
register(
    key="sentry:default_loader_version",
    epoch_defaults={1: "4.x", 2: "5.x", 7: "6.x", 8: "7.x", 13: "8.x", 14: "9.x", 15: "10.x"},
)
```

这意味着一个在 epoch 为 1 时创建的老项目，其 JavaScript Loader 默认使用 4.x 版本；而 epoch 为 15 的新项目，默认使用 10.x 版本。这种机制确保了向后兼容性：老项目的行为不会被新默认值意外改变。

`src/sentry/projectoptions/defaults.py` 中注册了大量项目选项，涵盖了：

- **过滤器默认值**：`filters:legacy-browsers`、`filters:web-crawlers`、`filters:browser-extensions` 等
- **分组配置**：`sentry:grouping_config`、`sentry:fingerprinting_rules`
- **性能检测配置**：`sentry:performance_issue_settings`、`sentry:performance_general_settings`
- **动态采样配置**：`sentry:target_sample_rate`
- **自动修复配置**：`sentry:autofix_automation_tuning`、`sentry:seer_automation_handoff_point`
- **日志过滤**：`filters:custom-error`（默认启用）、`filters:react-hydration-errors`、`filters:chunk-load-error`

### 15.4.3 配置刷新的触发机制

配置刷新通过 Celery 任务实现。当项目或组织选项发生变化时，会触发 `schedule_invalidate_project_config()`，该函数位于 `src/sentry/tasks/relay.py`：

```python
def schedule_invalidate_project_config(
    *,
    trigger,
    organization_id=None,
    project_id=None,
    public_key=None,
    generate=True,
):
    """Invalidates the cached project config and triggers a rebuild."""
```

该函数首先从缓存中移除过期配置，然后触发 `build_project_config` 任务重建并写入新配置。整个过程的关键特性：

1. **基于作用域的失效**：可以指定组织级别（失效该组织下所有项目）、项目级别（失效该项目所有 Key）或 Key 级别（失效单个 DSN）。
2. **防抖保护**：通过 Debounce Cache 防止短时间内重复触发。
3. **非失效选项过滤**：某些高频更新的选项（如 `_last_auto_resolve`、`transaction_name_cluster_meta`）不会触发配置失效，避免无谓的重建开销。

---

## 15.5 Feature Flags（功能开关）系统

### 15.5.1 Feature Manager 架构

Sentry 的功能开关系统通过 `FeatureManager`（`src/sentry/features/manager.py`）实现，它是一个分层的特征决策系统。Feature 的评估顺序为：

1. **注册的特征处理器（FeatureHandler）**：通过 `add_handler()` 注册的自定义逻辑。Handler 返回 `None` 表示不表态，交由下一层决策。
2. **实体处理器（Entity Handler）**：通过 `add_entity_handler()` 注册的统一处理器（通常对应 FlagPole）。
3. **默认配置**：`settings.SENTRY_FEATURES` 中的静态默认值。

```python
def has(self, name, *args, skip_entity=False, skip_experiment_exposure=False, **kwargs):
    with metrics.timer("features.has", tags={"feature": name}, sample_rate=sample_rate):
        actor = kwargs.pop("actor", None)
        feature = self.get(name, *args, **kwargs)

        # Check registered feature handlers
        rv = self._get_handler(feature, actor)
        if rv is not None:
            record_feature_flag(name, rv)
            return rv

        if self._entity_handler and not skip_entity:
            rv = self._entity_handler.has(feature, actor, ...)
            if rv is not None:
                record_feature_flag(name, rv)
                return rv

        rv = settings.SENTRY_FEATURES.get(feature.name, False)
        if rv is not None:
            record_feature_flag(name, rv)
            return rv

        return False
```

Feature 有三种作用域类型（`src/sentry/features/base.py`）：

| 类型 | 类名 | 作用域 |
|---|---|---|
| 系统级 | `SystemFeature` | 无上下文，基于应用全局配置 |
| 组织级 | `OrganizationFeature` | 绑定到特定组织 |
| 项目级 | `ProjectFeature` | 绑定到特定项目，但其组织决定订阅级别 |

Feature 还有两种处理策略：

| 策略 | 含义 |
|---|---|
| `FeatureHandlerStrategy.INTERNAL` | 通过 FeatureHandler 子类中的逻辑判断 |
| `FeatureHandlerStrategy.FLAGPOLE` | 通过 FlagPole 远程特性服务管理，选项自动注册 |

### 15.5.2 FlagPole 集成

FlagPole 是 Sentry 的远程特性管理服务（即 Feature Flag as a Service）。在 Sentry 开源代码中，FlagPole 的实际服务端实现位于 `getsentry`（闭源仓库），但在 `sentry` 开源代码中保留了完整的集成接口。

当一个 Feature 使用 `FeatureHandlerStrategy.FLAGPOLE` 注册时，系统会自动在 Options 中注册对应的选项：

```python
if entity_feature_strategy == FeatureHandlerStrategy.FLAGPOLE:
    feature_option_name = f"{FLAGPOLE_OPTION_PREFIX}.{name}"
    options.register(
        feature_option_name, type=Dict, default={}, flags=options.FLAG_AUTOMATOR_MODIFIABLE
    )
```

FlagPole 的上下文构建器（`src/sentry/features/flagpole_context.py`）负责将 Sentry 的领域对象转换为 FlagPole 可理解的评估上下文：

```python
def get_sentry_flagpole_context_builder() -> ContextBuilder[SentryContextData]:
    return (
        ContextBuilder[SentryContextData]()
        .add_context_transformer(organization_context_transformer, ["organization_id"])
        .add_context_transformer(project_context_transformer, ["project_id"])
        .add_context_transformer(user_context_transformer)
    )
```

上下文中包含的信息有：组织 ID、组织名称、是否为 Early Adopter、项目 ID、项目平台、用户 ID、用户邮箱域名、是否为管理员等。FlagPole 基于这些维度来做特性开关的决策。

### 15.5.3 灰度发布与 A/B 测试

Feature Flags 系统天然支持灰度发布。特征的注册在 `src/sentry/features/permanent.py`（永久特性）和 `src/sentry/features/temporary.py`（临时特性）中完成。

永久特性（`permanent.py`）主要是与 Sentry 订阅计划绑定的特性：

```python
permanent_flagpole_organization_features: dict[str, FlagpoleFeature] = {
    "organizations:relay": FlagpoleFeature(default=True, api_expose=True),
    "organizations:dynamic-sampling": FlagpoleFeature(default=False, api_expose=True),
    "organizations:session-replay": FlagpoleFeature(default=False, api_expose=True),
    "organizations:performance-view": FlagpoleFeature(default=True, api_expose=True),
    # ...
}

permanent_flagpole_project_features: dict[str, FlagpoleFeature] = {
    "projects:custom-inbound-filters": FlagpoleFeature(default=False, api_expose=True),
    "projects:rate-limits": FlagpoleFeature(default=True, api_expose=True),
    # ...
}
```

临时特性（`temporary.py`）是在开发迭代过程中的功能开关，文档中明确强调"这些标志是临时的，应该在功能上线后被清理掉"。目前有 500+ 行临时特性注册代码，涵盖 AI 功能、监控增强、性能改进等功能：

```python
# AI 相关临时特性
manager.add("organizations:ai-issue-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
manager.add("organizations:seer-based-priority", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

# 连续性能分析
manager.add("organizations:continuous-profiling", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
```

通过 FlagPole，Sentry 可以做到：
- 按组织百分比逐步灰度推出新功能
- 针对特定组织启用 Beta 功能
- 进行 A/B 实验，比较不同功能的用户行为影响
- 在发现问题时立即关闭有问题的功能

### 15.5.4 公开给 Relay 的特性列表

并非所有 Feature Flag 都会被传递给 Relay。只有列在 `EXPOSABLE_FEATURES` 中的特性才会包含在 Project Config 的 `features` 字段中：

```python
EXPOSABLE_FEATURES = [
    "organizations:continuous-profiling",
    "organizations:session-replay-recording-scrubbing",
    "organizations:session-replay",
    "organizations:relay-generate-billing-outcome",
    "projects:discard-transaction",
    "projects:span-metrics-extraction",
    "projects:span-metrics-extraction-addons",
    "organizations:indexed-spans-extraction",
    "organizations:ourlogs-ingestion",
    "organizations:tracemetrics-ingestion",
    "organizations:performance-issues-spans",
    "organizations:relay-playstation-ingestion",
    "projects:span-v2-attachment-processing",
    "projects:trace-attachment-processing",
    "projects:relay-minidump-uploads",
    "projects:relay-playstation-uploads",
    "projects:relay-upload-multipart",
]
```

这些特性在选择时遵循一个原则：必须与 Relay 的行为直接相关。因为 Relay 需要根据这些特性来改变事件处理逻辑——例如是否启用 Session Replay 录制脱敏、是否提取 Span Metrics 等。

`get_exposed_features()` 函数会遍历列表，检查每一项是否对项目/组织启用，并记录指标：

```python
def get_exposed_features(project: Project) -> Sequence[str]:
    active_features = []
    for feature in EXPOSABLE_FEATURES:
        if feature.startswith("organizations:"):
            has_feature = features.has(feature, project.organization)
        elif feature.startswith("projects:"):
            has_feature = features.has(feature, project)
        if has_feature:
            active_features.append(feature)
    return active_features
```

---

## 15.6 数据清理规则（Data Scrubbing Rules）

### 15.6.1 PII 配置结构

Sentry 的数据清理系统分为两个层次：底层的 `piiConfig`（高级 PII 配置）和上层的 `datascrubbingSettings`（简易数据清理设置）。两者共同组成 Relay 的数据脱敏策略。

`piiConfig` 是一个结构化的 JSON 配置，定义在 `sentry/relay/datascrubbing.py` 中。它包含两个核心部分：

- **rules**：命名规则集合，每条规则定义了如何匹配和转换数据
- **applications**：规则到数据路径的映射，定义了哪条规则应用于事件的哪个字段

`datascrubbingSettings` 是一个扁平化的简单设置结构：

```python
def get_datascrubbing_settings(project):
    org = project.organization
    rv = {}

    exclude_fields_key = "sentry:safe_fields"
    rv["excludeFields"] = org.get_option(exclude_fields_key, []) + project.get_option(exclude_fields_key, [])

    if org.get_option("sentry:require_scrub_data", False) or project.get_option("sentry:scrub_data", True):
        rv["scrubData"] = True

    if org.get_option("sentry:require_scrub_ip_address", False) or project.get_option("sentry:scrub_ip_address", False):
        rv["scrubIpAddresses"] = True

    sensitive_fields_key = "sentry:sensitive_fields"
    rv["sensitiveFields"] = org.get_option(sensitive_fields_key, []) + project.get_option(sensitive_fields_key, [])

    rv["scrubDefaults"] = org.get_option("sentry:require_scrub_defaults", False) or project.get_option("sentry:scrub_defaults", True)

    return rv
```

简化的数据清理设置包含五个主要开关：

| 字段 | 含义 | 默认值 |
|---|---|---|
| `excludeFields` | 排除在清理之外的安全字段（组织+项目合并） | `[]` |
| `scrubData` | 是否启用数据脱敏 | 组织未强制时为 `True` |
| `scrubIpAddresses` | 是否脱敏 IP 地址 | 组织未强制时为 `False` |
| `sensitiveFields` | 自定义敏感字段列表 | `[]` |
| `scrubDefaults` | 是否使用默认的敏感字段列表 | 组织未强制时为 `True` |

注意组织级选项以 `sentry:require_*` 前缀的强制设置优先于项目级设置。当组织启用了 `require_scrub_data` 时，项目无法关闭数据脱敏。

### 15.6.2 组织级与项目级的规则合并

PII 配置的合并是一个精妙的设计，规则合并的顺序至关重要。代码注释中明确解释了其原因：

```python
# Order of merging is important here. We want to apply organization rules
# before project rules. For example:
# * Organization rule: remove substrings "mypassword"
# * Project rule: remove substrings "my"
# If we were to apply project rules before organization rules, "password"
# would leak.
```

合并通过 `_merge_pii_configs()` 函数实现：

```python
def _merge_pii_configs(prefixes_and_configs: list[tuple[str, dict[str, Any]]]) -> dict[str, Any]:
    merged_config: dict[str, Any] = {}

    for prefix, partial_config in prefixes_and_configs:
        if not partial_config:
            continue

        rules = partial_config.get("rules") or {}
        for rule_name, rule in rules.items():
            prefixed_rule_name = f"{prefix}{rule_name}"
            merged_config.setdefault("rules", {})[prefixed_rule_name] = (
                _prefix_rule_references_in_rule(rules, rule, prefix)
            )

        for selector, applications in (partial_config.get("applications") or {}).items():
            merged_applications = merged_config.setdefault("applications", {}).setdefault(selector, [])
            for application in applications:
                if application in rules:
                    prefixed_rule_name = f"{prefix}{application}"
                    merged_applications.append(prefixed_rule_name)
                else:
                    merged_applications.append(application)

    return merged_config
```

规则名称通过前缀（`organization:` 或 `project:`）来区分来源，防止命名冲突。`_prefix_rule_references_in_rule()` 函数确保规则间的引用（如 `type: multiple` 规则对其他规则的引用）也正确地被前缀化。

### 15.6.3 敏感字段自定义

通过 `sentry:sensitive_fields` 选项，用户可以指定额外的敏感字段。这些字段会被 Relay 在事件数据中搜索并脱敏。配置是组织和项目级别的合并：

```python
sensitive_fields_key = "sentry:sensitive_fields"
rv["sensitiveFields"] = org.get_option(sensitive_fields_key, []) + project.get_option(sensitive_fields_key, [])
```

`sentry:safe_fields` 则定义了"安全字段"——即使用户启用了数据脱敏，这些字段中的数据也不会被清理。这允许精细化控制，例如脱敏所有字段但保留 `user.id` 作为非敏感标识符。

### 15.6.4 高级规则语法

PII 配置支持一套丰富的规则 DSL（Domain-Specific Language），通过 `sentry_relay.processing` 模块（即 Relay 的 Python 绑定）提供验证和执行。

规则验证由 `validate_pii_config()` 和 `validate_pii_selector()` 函数完成：

```python
def validate_pii_config_update(organization, value):
    if not value:
        return value
    try:
        validate_pii_config(value)
    except ValueError as e:
        raise serializers.ValidationError(str(e))
    return value

def validate_pii_selectors(selectors):
    if not selectors:
        return selectors
    errors = list()
    for line, selector in enumerate(selectors, start=1):
        try:
            validate_pii_selector(selector)
        except ValueError as e:
            errors.append(f"{e} (line {line})".capitalize())
    if errors:
        raise serializers.ValidationError(",\n".join(errors))
    return selectors
```

高级 PII 配置支持以下能力：

- **Selector 语法**：通过路径表达式精确匹配事件中的字段（如 `$message`、`$user.email`、`$exception.values.*.value`）
- **规则类型**：包括 `pattern`（正则匹配）、`ip`（IP 地址匹配）、`imei`（设备标识匹配）、`creditcard`（信用卡号匹配）、`email`（邮箱匹配）等多种内置匹配器
- **转换动作**：支持 `remove`（删除）、`replace`（替换为占位符）、`mask`（部分遮蔽）、`hash`（哈希化）等处理策略
- **组合规则**：`multiple` 类型允许引用多条规则，组合应用

`scrub_data()` 函数是 PII 配置实际执行的入口，它应用所有 PII 配置对事件进行清理：

```python
@trace
def scrub_data(project: Project, event: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    for config in get_all_pii_configs(project):
        event = pii_strip_event(config, dict(event), json_loads=orjson.loads, json_dumps=orjson.dumps)
    return event
```

---

## 15.7 流入过滤器（Inbound Filters）配置

### 15.7.1 过滤器类型总览

Sentry 的流入过滤器由 `sentry/ingest/inbound_filters.py` 中的 `FilterStatKeys` 定义，这些键值在 Relay 和 Sentry 之间保持一致：

```python
class FilterStatKeys:
    IP_ADDRESS = "ip-address"
    RELEASE_VERSION = "release-version"
    ERROR_MESSAGE = "error-message"
    BROWSER_EXTENSION = "browser-extensions"
    LEGACY_BROWSER = "legacy-browsers"
    LOCALHOST = "localhost"
    WEB_CRAWLER = "web-crawlers"
    INVALID_CSP = "invalid-csp"
    CORS = "cors"
    DISCARDED_HASH = "discarded-hash"
    CRASH_REPORT_LIMIT = "crash-report-limit"
    HEALTH_CHECK = "filtered-transaction"
```

每种过滤器都有对应的 TSDB 模型用于统计计数：

```python
FILTER_STAT_KEYS_TO_VALUES = {
    FilterStatKeys.IP_ADDRESS: TSDBModel.project_total_received_ip_address,
    FilterStatKeys.RELEASE_VERSION: TSDBModel.project_total_received_release_version,
    FilterStatKeys.ERROR_MESSAGE: TSDBModel.project_total_received_error_message,
    FilterStatKeys.BROWSER_EXTENSION: TSDBModel.project_total_received_browser_extensions,
    # ... 其他映射 ...
}
```

每个过滤器的默认状态在 `src/sentry/projectoptions/defaults.py` 中设置：

```python
register(key="filters:legacy-browsers", epoch_defaults={1: "0"})
register(key="filters:web-crawlers", epoch_defaults={1: "1", 6: "0"})
register(key="filters:browser-extensions", epoch_defaults={1: "0"})
register(key="filters:localhost", epoch_defaults={1: "0"})
register(key="filters:react-hydration-errors", epoch_defaults={1: "1"})
register(key="filters:chunk-load-error", epoch_defaults={1: "1"})
register(key="filters:custom-error", epoch_defaults={1: "1"})
register(key="filters:filtered-transaction", default="1")
```

过滤器的控制值遵循"非零即启用"的规则：`"0"` 表示禁用，`"1"` 表示启用。对于旧浏览器过滤器，值可以更复杂（`"1"` 表示默认子集，多字符字符串表示启用的具体浏览器类型列表）。

### 15.7.2 过滤器配置的加载与传递

过滤器配置通过 `_load_filter_settings()` 函数从项目选项中加载：

```python
def _load_filter_settings(flt: _FilterSpec, project: Project) -> Mapping[str, Any]:
    filter_id = flt.id
    filter_key = f"filters:{filter_id}"
    setting = project.get_option(filter_key)
    return _filter_option_to_config_setting(flt, setting)
```

`_filter_option_to_config_setting()` 将数据库中的字符串值转换为 Relay 可理解的 JSON 格式：

```python
def _filter_option_to_config_setting(flt: _FilterSpec, setting: str) -> Mapping[str, Any]:
    is_enabled = setting != "0"
    ret_val: dict[str, bool | Sequence[str]] = {"isEnabled": is_enabled}

    if flt.id == FilterStatKeys.LEGACY_BROWSER:
        if is_enabled:
            if setting == "1":
                ret_val["options"] = ["default"]
            else:
                ret_val["options"] = list(setting)
    elif flt.id == FilterStatKeys.HEALTH_CHECK:
        if is_enabled:
            ret_val = {"patterns": HEALTH_CHECK_GLOBS, "isEnabled": True}
        else:
            ret_val = {"patterns": [], "isEnabled": False}
    return ret_val
```

### 15.7.3 通用过滤器（Generic Filters）

通用过滤器（Generic Filters）是一个更强大的过滤机制。它使用 Relay 的条件 DSL 来描述过滤规则，不再局限于预定义的过滤器类型。当一个项目启用了 `projects:custom-inbound-filters` 特性后，可以使用以下自定义过滤维度：

- **错误消息过滤（Error Messages）**：通过 `sentry:error_messages` 选项配置正则模式，拒绝包含匹配模式的事件
- **Release 过滤**：通过 `sentry:releases` 选项配置，拒绝特定版本的事件
- **日志消息过滤（Log Messages）**：通过 `sentry:log_messages` 选项配置（需要 `organizations:ourlogs-ingestion` 特性）

```python
if features.has("projects:custom-inbound-filters", project):
    invalid_releases = project.get_option(f"sentry:{FilterTypes.RELEASES}")
    if invalid_releases:
        filter_settings["releases"] = {"releases": invalid_releases}

    error_messages += project.get_option(f"sentry:{FilterTypes.ERROR_MESSAGES}") or []

    if features.has("organizations:ourlogs-ingestion", project.organization):
        log_messages = project.get_option(f"sentry:{FilterTypes.LOG_MESSAGES}") or []
        if log_messages:
            log_messages_filter = get_log_messages_generic_filter(log_messages)
            if log_messages_filter:
                base_generic_filters.append(log_messages_filter)
```

最终，所有自定义过滤规则通过 `get_generic_filters()` 函数转换为 Relay 的通用过滤器 DSL 格式，合并到 `filterSettings["generic"]` 中。

### 15.7.4 CSP 过滤器

CSP（Content Security Policy）报告过滤允许忽略来自浏览器扩展或其他不可信来源的 CSP 违规报告：

```python
csp_disallowed_sources: list[str] = []
if bool(project.get_option("sentry:csp_ignored_sources_defaults", True)):
    csp_disallowed_sources += DEFAULT_DISALLOWED_SOURCES
csp_disallowed_sources += project.get_option("sentry:csp_ignored_sources", [])
if csp_disallowed_sources:
    filter_settings["csp"] = {"disallowedSources": csp_disallowed_sources}
```

默认的不允许来源列表（`DEFAULT_DISALLOWED_SOURCES`）包含了常见的浏览器扩展协议前缀（如 `chrome-extension://`、`moz-extension://` 等）。项目可以通过 `sentry:csp_ignored_sources` 追加自定义的来源列表。

---

## 15.8 速率限制配置

### 15.8.1 Quota 配置结构

Sentry 的速率限制系统基于 `QuotaConfig` 类（`src/sentry/quotas/base.py`）：

```python
@total_ordering
class QuotaConfig:
    """
    Abstract configuration for a quota.

    Sentry applies multiple quotas to an event before accepting it, some of
    which can be configured by the user depending on plan.

    An event will be counted against all quotas that it matches with based
    on the ``category``.
    """
```

Quota 的关键属性包括：

| 属性 | 说明 |
|---|---|
| `id` | 配额唯一标识符 |
| `categories` | 适用的数据类别（Error、Transaction、Attachment、Replay 等） |
| `scope` | 作用域（`ORGANIZATION`、`PROJECT`、`KEY`） |
| `scope_id` | 作用域的具体标识符 |
| `limit` | 时间窗口内的最大允许数量 |
| `window` | 时间窗口大小（秒） |
| `reason_code` | 限流触发时的原因代码 |

配额作用域通过 `QuotaScope` 枚举定义：

```python
@unique
class QuotaScope(IntEnum):
    ORGANIZATION = 1
    PROJECT = 2
    KEY = 3
```

### 15.8.2 Key 级别限流

Key 级别的限流作用于单个 DSN Key。这是最精细的限流粒度，用于防止单个客户端的异常行为影响其他客户端。在 Project Config 的 `quotas` 列表中，Key 级别的配额具有 `scope: "key"` 和对应的 `scope_id`。

Key 级别的配额由每个 `ProjectKey` 的字段计算。当 `get_quotas()` 被调用时，Backend 会基于 Key 的属性（如速率限制设置）生成相应的配置。

### 15.8.3 项目级别限流

项目级别的限流作用于整个项目的所有 Key 的聚合流量。这使得项目管理员可以为项目设置整体的事件速率上限。

项目级别配额的 `scope` 值为 `QuotaScope.PROJECT`，`scope_id` 为项目 ID。所有属于同一项目的 Key 共享该配额。

### 15.8.4 组织级别限流

组织级别的限流作用于整个组织下所有项目的聚合流量。这是最粗粒度的限流控制，由组织的订阅计划决定。Relay 在所有事件处理之前最先检查组织级别配额。

除了速率限制，配额系统还管理事件的数据保留策略：

```python
# 事件保留时间
event_retention = quotas.backend.get_event_retention(project.organization)

# 降采样后的事件保留时间
downsampled_event_retention = quotas.backend.get_downsampled_event_retention(project.organization)

# 按数据类别的保留策略（日志、Span、Trace 指标等）
retentions = quotas.backend.get_retentions(project.organization)
```

保留配置通过 `RETENTIONS_CONFIG_MAPPING` 映射到 Relay 的协议名称：

```python
RETENTIONS_CONFIG_MAPPING = {
    DataCategory.LOG_BYTE: "log",
    DataCategory.TRANSACTION: "span",
    DataCategory.SPAN: "span",
    DataCategory.TRACE_METRIC: "traceMetric",
    DataCategory.TRACE_METRIC_BYTE: "traceMetric",
}
```

### 15.8.5 滥用保护配额

除了标准的速率限制外，Sentry 还实现了滥用保护配额（Abuse Quota）：

```python
@dataclass
class AbuseQuota:
    id: str
    option: str
    categories: list[DataCategory]
    scope: AbuseQuotaScope
    namespace: str | None = None
```

滥用配额通过 `build_metric_abuse_quotas()` 函数构建，它自动为每个支持基数限制的 Use Case 生成组织和项目两级的配额：

```python
def build_metric_abuse_quotas() -> list[AbuseQuota]:
    quotas = list()
    for scope, prefix in [(QuotaScope.PROJECT, "p"), (QuotaScope.ORGANIZATION, "o")]:
        quotas.append(AbuseQuota(id=f"{prefix}amb", option=f"metric-abuse-quota.{scope.api_name()}", ...))
        for use_case in CARDINALITY_LIMIT_USE_CASES:
            quotas.append(AbuseQuota(id=f"{prefix}amb_{use_case.value}", ...))
    return quotas
```

这些配额在 Relay 端与标准配额一起执行，保护系统免受异常的高基数指标写入攻击。

---

## 15.9 Relay 与 Sentry 的通信协议

### 15.9.1 Relay 注册流程

Relay 与 Sentry 之间的通信基于 HTTP/JSON 协议。所有 Relay 相关的 API 端点位于 `src/sentry/api/endpoints/relay/` 目录下。

Relay 启动时的注册流程分为两个步骤：

**第一步：获取挑战（Challenge）**

Relay 向 `/api/0/relays/register/challenge/` 发送 POST 请求（`register_challenge.py`）：

```python
class RelayRegisterChallengeEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    # No authentication required for initial challenge request

    def post(self, request: Request) -> Response:
        json_data = orjson.loads(request.body)
        serializer = RelayRegisterChallengeSerializer(data=json_data)

        if not is_version_supported(json_data.get("version")):
            return Response({"detail": "Relay version no longer supported..."}, status=403)

        public_key = json_data.get("public_key")

        if not settings.SENTRY_RELAY_OPEN_REGISTRATION and not (
            is_internal_relay(request, public_key) or is_static_relay(request)
        ):
            return Response({"detail": "Relay is not allowed to register"}, status=403)

        sig = get_header_relay_signature(request)
        secret = options.get("system.secret-key")
        challenge = create_register_challenge(request.body, sig, secret)

        return Response(serialize(challenge))
```

注册的安全性要求：

1. Relay 必须提供有效的公钥。
2. Relay 的版本必须被支持（通过 `is_version_supported()` 检查）。
3. 除非 `SENTRY_RELAY_OPEN_REGISTRATION` 开启，否则只允许内部或静态 Relay 注册。
4. 请求必须包含有效的签名头。
5. Challenge 使用 Sentry 的 `system.secret-key` 生成。

**第二步：提交响应（Response）**

Relay 收到 Challenge 后，向 `/api/0/relays/register/response/` 提交签名后的响应（`register_response.py`），完成注册。注册成功后，Sentry 将 Relay 的信息存储在 `sentry_relay` 表中。

### 15.9.2 项目配置拉取端点

项目配置通过 `/api/0/relays/projectconfigs/` 端点提供（`project_configs.py`），该端点仅允许已认证的内部 Relay 访问：

```python
class RelayProjectConfigsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request: Request):
        relay = request.relay
        if not relay.is_internal:
            return Response("Relay unauthorized for config information", status=403)

        version = request.GET.get("version") or "1"

        if version == "3" and request.relay_request_data.get("global"):
            response["global"] = get_global_config()
            response["global_status"] = "ready"

        if self._should_post_or_schedule(version, request):
            response.update(self._post_or_schedule_by_key(request))
        elif version in ["2", "3"]:
            response["configs"] = self._post_by_key(request=request)
        elif version == "1":
            response["configs"] = self._post_by_project(request=request)
```

端点支持三个协议版本：

| 版本 | 查询方式 | 缓存策略 |
|---|---|---|
| v1 | 按项目 ID 查询 | 同步生成并缓存 |
| v2 | 按公钥（Public Key）查询 | 同步生成并缓存 |
| v3 | 按公钥（Public Key）查询 | 尽量从缓存读取，未命中的异步调度重建 |

v3 是当前的标准版本，其关键创新在于异步缓存策略：

```python
def _post_or_schedule_by_key(self, request: Request):
    public_keys = set(request.relay_request_data.get("publicKeys") or ())
    proj_configs = {}
    pending = []
    for key in public_keys:
        computed = self._get_cached_or_schedule(key)
        if not computed:
            pending.append(key)
        else:
            proj_configs[key] = computed
    return {"configs": proj_configs, "pending": pending}
```

Relay 收到 `pending` 列表后，会在下一个轮询周期再次请求这些 Key 的配置。这种设计避免了在 HTTP 请求内阻塞等待所有配置的同步生成。

### 15.9.3 心跳检测

Relay 和 Sentry 都实现了轻量级的心跳检测端点 `/api/0/relays/healthcheck/`（`health_check.py`）：

```python
class RelayHealthCheck(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request: Request) -> Response:
        return Response({"is_healthy": True}, status=200)
```

这是一个无需认证的 GET 端点。当 Relay 怀疑网络出现问题时，它会检查此端点是否可达。Sentry 端和 Relay 端都实现了相同的端点语义，因此下游 Relay 不需要区分它连接的是另一个 Relay 还是直接连接到 Sentry。

### 15.9.4 公钥交换

Relay 之间存在公钥交换机制，用于在 Relay 链中建立信任关系。通过 `/api/0/relays/publickeys/` 端点（`public_keys.py`）：

```python
class RelayPublicKeysEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request: Request) -> Response:
        calling_relay = request.relay
        relay_ids = request.relay_request_data.get("relay_ids") or ()
        # ...
        for relay in relays:
            pk = relay.public_key
            relay_id = relay.relay_id
            legacy_public_keys[relay_id] = pk
            public_keys[relay_id] = {
                "publicKey": pk,
                "internal": relay.is_internal and calling_relay.is_internal,
            }
        return Response({"public_keys": legacy_public_keys, "relays": public_keys}, status=200)
```

内部 Relay 可以查询其他 Relay 的 `internal` 属性，外部 Relay 则只能获得公钥信息。这种机制用于 Relay 之间的签名验证和信任链构建。

### 15.9.5 配置同步时序

Relay 与 Sentry 之间的配置同步遵循以下时序：

```
Relay                    Sentry
  |                         |
  |-- POST /projectconfigs -|  (携带已知的 public keys + 版本号)
  |                         |
  |                         |-- 查询 Redis 缓存
  |                         |   |
  |                         |   |-- 命中：直接返回
  |                         |   |-- 未命中：调度 build_project_config 任务
  |                         |
  |<-- {configs, pending} --|  (返回已有配置 + 待处理列表)
  |                         |
  |  [等待配置生成]          |  [Celery 异步生成配置并写入 Redis]
  |                         |
  |-- POST /projectconfigs -|  (再次请求 pending 的 keys)
  |                         |
  |<-- {configs} ----------|  (返回已生成的配置)
  |                         |
```

配置变更的传播：

1. 项目/组织选项发生变化（通过 UI 或 API）
2. 触发 `schedule_invalidate_project_config()` 任务
3. 任务计算新的 Project Config 并写入 Redis 缓存
4. 下一次 Relay 轮询时获取到新配置
5. Relay 立即应用新配置处理后续事件

Relay 在自身内部也维护了配置缓存，它通过对比配置的 `rev` 版本号来判断是否发生了实际变更，避免不必要的配置重载。

---

## 15.10 自建 Relay 部署与配置

### 15.10.1 Relay 配置文件

Relay 使用 YAML 格式的配置文件，核心配置项包括：

```yaml
relay:
  # Relay 的唯模式（managed/proxy/static）
  mode: managed

  # 与上游 Sentry/Relay 的连接配置
  upstream:
    url: "https://sentry.example.com/"

  # 限流与资源限制
  limits:
    max_event_size: 1048576          # 1MB
    max_concurrent_requests: 100
    max_concurrent_queries: 10

  # 缓存配置
  cache:
    project_expiry: 300              # 项目配置缓存过期时间（秒）
    project_grace_period: 60         # 配置过期后的宽限期

  # 日志
  logging:
    level: info

# 处理配置
processing:
  enabled: true

  # Redis 配置（用于速率限制计数）
  redis:
    url: "redis://redis.example.com:6379"

  # Kafka 配置（用于将事件转发到 Sentry）
  kafka_config:
    - name: "events"
      topic: "ingest-events"
    - name: "attachments"
      topic: "ingest-attachments"
```

Relay 有三种运行模式：

| 模式 | 说明 |
|---|---|
| `managed` | 完全由 Sentry 管理，通过 API 获取配置 |
| `proxy` | 纯代理模式，不做任何处理直接转发 |
| `static` | 使用静态配置，不依赖 Sentry API |

### 15.10.2 与 Sentry 服务器的对接

要将自建 Relay 接入 Sentry 服务器，需要以下步骤：

1. **在 Sentry 中注册 Relay 的公钥**：通过 Sentry 管理界面或 API 将 Relay 的公钥注册为受信任的外部 Relay。
2. **配置 Relay 的 upstream 地址**：指向 Sentry 服务器的地址。
3. **配置 Relay 的签名密钥**：确保 Relay 的签名密钥与 Sentry 注册的公钥匹配。

Sentry 服务器端，需要确保 `SENTRY_RELAY_OPEN_REGISTRATION` 配置为允许外部 Relay 注册（或不开启，手动注册）。

在组织设置中，通过 `sentry:trusted-relays` 选项将外部 Relay 的公钥添加到信任列表中：

```python
config["trustedRelays"] = [
    r["public_key"]
    for r in project.organization.get_option("sentry:trusted-relays", [])
    if r
]
```

Project Config 中的 `trustedRelays` 字段告诉了内部 Relay 哪些外部 Relay 是可信任的，从而在 Relay 链中建立信任关系。

还支持受信任 Relay 签名验证：

```python
verify_signature = project.organization.get_option(
    "sentry:ingest-through-trusted-relays-only",
    INGEST_THROUGH_TRUSTED_RELAYS_ONLY_DEFAULT,
)
if verify_signature != INGEST_THROUGH_TRUSTED_RELAYS_ONLY_DEFAULT:
    config["trustedRelaySettings"] = {"verifySignature": verify_signature}
```

当启用 `verifySignature` 时，Relay 会验证来自其他 Relay 的事件的签名，只有签名有效的事件才会被接受。

### 15.10.3 网络拓扑建议

推荐的 Relay 部署拓扑：

```
                    +-------------+
                    |   Sentry    |
                    |  (SaaS/自建) |
                    +------+------+
                           |
                    +------v------+
                    | 内部 Relay   |  (可选，Sentry 托管)
                    +------+------+
                           |
              +------------+------------+
              |                         |
     +--------v--------+     +---------v--------+
     |  客户区域 Relay  |     |  客户区域 Relay   |
     |  (VPC 内部署)    |     |  (VPC 内部署)     |
     +--------+--------+     +---------+--------+
              |                         |
     +--------v--------+     +---------v--------+
     |  应用服务器/SDK  |     |  应用服务器/SDK   |
     +-----------------+     +------------------+
```

拓扑要点：

- **SDK 指向最近的 Relay**：SDK 应配置为向本地 Relay 发送事件，而不是直接发送到 Sentry 服务器。
- **PII 脱敏在边缘 Relay 处理**：最靠近数据源的 Relay 负责 PII 脱敏，确保敏感数据不出网。
- **层级 Relay 链**：如果存在多层 Relay，下游 Relay 会透传已处理的事件给上游。上游 Relay 会验证下游 Relay 的签名。
- **网络可达性**：所有 Relay 必须能够访问 Sentry 服务器的 API 端点（用于配置拉取），以及 Redis/Kafka（如果启用了处理模式）。

### 15.10.4 性能调优要点

Relay 的性能调优主要关注以下几个方面：

**1. 并发连接数**

`max_concurrent_requests` 控制 Relay 同时处理的最大请求数。默认值可能适用于小型部署，高流量环境需要适当调高。

**2. 事件大小限制**

`max_event_size` 控制单个事件的最大字节数。适当降低此值可以防止超大事件（如包含大 Attachments）阻塞处理管道。

**3. 项目配置缓存**

`cache.project_expiry` 控制项目配置的本地缓存时间。较短的过期时间意味着更及时的配置更新，但会增加 API 请求频率；较长的过期时间减少 API 负载，但配置变更的传播延迟更大。

Relay 还支持 `project_grace_period`，在配置过期后仍然使用旧配置处理事件一段时间，作为 API 请求失败的容错机制。

**4. Redis 连接池**

处理模式下的 Relay 依赖 Redis 进行速率限制计数。应确保 Redis 连接池大小与 `max_concurrent_requests` 匹配。连接池耗尽将导致限流计数不可用，可能错误地拒绝或放行事件。

**5. 内存与 CPU**

Relay 是 CPU 密集型的服务（PII 脱敏的正则匹配、事件规范化的 JSON 处理），但也是内存高效的（Rust 的零拷贝设计）。在规划资源时，应优先保证 CPU 核心数，其次才是内存。

**6. 指标监控**

Sentry 的 Relay 配置生成过程有丰富的指标埋点，可通过这些指标监控性能：

```
relay.config.get_project_config.duration   # 配置生成的耗时
relay.projectconfig_cache.write            # 缓存写入次数和延迟
relay.projectconfig_cache.skipped          # 被防抖跳过的重建任务
relay.project_configs.post_v3.fetched      # v3 端点成功返回的配置数
relay.project_configs.post_v3.pending      # v3 端点标记为 pending 的配置数
```

通过监控 `pending` 与 `fetched` 的比例，可以评估配置缓存的命中率。高 `pending` 比例意味着大量配置无法从缓存命中，可能需要增加 Redis 内存或检查构建任务的执行健康度。

---

## 本章小结

本章深入剖析了 Sentry Relay 与项目配置系统的完整架构。Relay 作为 Rust 编写的高性能事件代理，承担了事件过滤、速率限制、PII 脱敏、事件规范化、动态采样和指标提取等关键职责。Project Config 是 Relay 与 Sentry 后端之间的核心协议，它将项目级别的所有行为配置封装为一份自包含的 JSON 文档，通过 Redis 缓存和 HTTP API 分发给 Relay。

配置系统通过 Options Store 的分层查找机制、Project Options 的 Epoch 默认值机制、Feature Flags 的 FlagPole 集成、以及防抖缓存（Debounce Cache）的分散加载机制，实现了高可用、低延迟的配置分发。数据清理规则的组织-项目两级合并设计，确保了安全策略的层次性和不可绕过性。

理解 Relay 和项目配置系统，对于在生产环境中正确部署和调优 Sentry、以及排查事件丢失或配置不及时生效等问题至关重要。
