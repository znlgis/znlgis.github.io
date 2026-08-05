---
layout: default
title: 第十章：Dashboards 与 Discover 数据分析
---

# 第十章：Dashboards 与 Discover 数据分析

[目录]

- [10.1 Discover 概述：Sentry 的查询引擎](#101-discover-概述sentry-的查询引擎)
  - [10.1.1 Discover 的定位与设计哲学](#1011-discover-的定位与设计哲学)
  - [10.1.2 Discover 与 Snuba 的关系](#1012-discover-与-snuba-的关系)
  - [10.1.3 数据集体系：Events、Transactions 与 Discover](#1013-数据集体系events-transactions-与-discover)
  - [10.1.4 Discover 查询的核心入口函数](#1014-discover-查询的核心入口函数)
- [10.2 Discover Query 语法](#102-discover-query-语法)
  - [10.2.1 字段选择与基本过滤](#1021-字段选择与基本过滤)
  - [10.2.2 聚合函数详解](#1022-聚合函数详解)
  - [10.2.3 算术表达式（Equation）](#1023-算术表达式equation)
  - [10.2.4 Order By、Limit 与 Offset](#1024-order-bylimit-与-offset)
  - [10.2.5 数据集拆分对查询的影响](#1025-数据集拆分对查询的影响)
- [10.3 Discover 查询构建器](#103-discover-查询构建器)
  - [10.3.1 可视化查询界面](#1031-可视化查询界面)
  - [10.3.2 保存查询与 DiscoverSavedQuery 模型](#1032-保存查询与-discoversavedquery-模型)
  - [10.3.3 主页查询与收藏](#1033-主页查询与收藏)
- [10.4 常用查询场景](#104-常用查询场景)
  - [10.4.1 错误分布分析](#1041-错误分布分析)
  - [10.4.2 性能分析](#1042-性能分析)
  - [10.4.3 用户影响范围分析](#1043-用户影响范围分析)
  - [10.4.4 多维度组合分析](#1044-多维度组合分析)
- [10.5 Dashboards 仪表盘](#105-dashboards-仪表盘)
  - [10.5.1 Dashboard 数据模型](#1051-dashboard-数据模型)
  - [10.5.2 预置模板（Prebuilt Dashboards）](#1052-预置模板prebuilt-dashboards)
  - [10.5.3 自定义仪表盘](#1053-自定义仪表盘)
  - [10.5.4 仪表盘版本管理与回滚](#1054-仪表盘版本管理与回滚)
- [10.6 Widget 小部件类型](#106-widget-小部件类型)
  - [10.6.1 Widget 数据模型](#1061-widget-数据模型)
  - [10.6.2 图表类部件](#1062-图表类部件)
  - [10.6.3 表格类部件](#1063-表格类部件)
  - [10.6.4 大数字部件](#1064-大数字部件)
  - [10.6.5 其他特殊部件](#1065-其他特殊部件)
- [10.7 Dashboard 数据源](#107-dashboard-数据源)
  - [10.7.1 Errors & Transactions 数据集拆分](#1071-errors--transactions-数据集拆分)
  - [10.7.2 Widget 层面的数据集拆分](#1072-widget-层面的数据集拆分)
  - [10.7.3 On-Demand Metrics 提取](#1073-on-demand-metrics-提取)
- [10.8 Dashboard 管理与分享](#108-dashboard-管理与分享)
  - [10.8.1 权限控制](#1081-权限控制)
  - [10.8.2 收藏与排序](#1082-收藏与排序)
  - [10.8.3 嵌入分享](#1083-嵌入分享)
- [10.9 Insights 模块](#109-insights-模块)
- [10.10 查询性能优化与最佳实践](#1010-查询性能优化与最佳实践)
  - [10.10.1 查询构建器配置](#10101-查询构建器配置)
  - [10.10.2 采样与 Turbo 模式](#10102-采样与-turbo-模式)
  - [10.10.3 Zerofill 与时间桶填充](#10103-zerofill-与时间桶填充)
  - [10.10.4 Facet 查询的优化策略](#10104-facet-查询的优化策略)
  - [10.10.5 批量查询与缓存](#10105-批量查询与缓存)
  - [10.10.6 最佳实践清单](#10106-最佳实践清单)

---

## 10.1 Discover 概述：Sentry 的查询引擎

### 10.1.1 Discover 的定位与设计哲学

Sentry Discover 是 Sentry 生态中最为核心的自助分析工具。它并非一个简单的"搜索栏"——它是一套完整的查询引擎,允许用户对 Sentry 采集的所有事件数据（错误、事务、会话重放等）执行任意的结构化查询,并支持聚合、分组、时序分析以及可视化展示。

在代码层面,Discover 的本质是一个**高层抽象层**,它接收用户友好的字段名（如 `transaction.duration`、`count_unique(user)`）和查询语法,转换为 Snuba 底层查询语言（SnQL）,并通过 Snuba 执行引擎获取结果。这个架构设计遵循了关注点分离原则：用户不需要知道 Snuba 的物理表结构、ClickHouse 的数据引擎细节,只需要使用一套统一的、语义化的字段和函数即可完成复杂的数据分析。

Discover 的入口模块位于 `src/sentry/snuba/discover.py`,该文件导出了以下核心公共 API：

```python
# src/sentry/snuba/discover.py:52-62
__all__ = (
    "PaginationResult",
    "InvalidSearchQuery",
    "query",              # 主事件查询
    "timeseries_query",   # 时序查询
    "top_events_timeseries",  # Top-N 时序查询
    "get_facets",         # 维度分布查询
    "zerofill",           # 时间桶填充工具
    "histogram_query",    # 直方图查询
    "check_multihistogram_fields",
)
```

这七个函数覆盖了 90% 以上的数据分析场景：`query` 负责获取原始事件列表或聚合结果,`timeseries_query` 负责生成时间序列图表数据,`top_events_timeseries` 同时获取 Top-N 分组及其各自的时间序列,`get_facets` 生成维度分布用于过滤面板,`histogram_query` 生成数值指标的分布直方图。

### 10.1.2 Discover 与 Snuba 的关系

Snuba 是 Sentry 自建的、基于 ClickHouse 的事件数据存储与查询服务。每个 Sentry 事件（无论错误还是事务）在摄入时都会被写入 ClickHouse 的多个物化视图（Materialized View）中。Snuba 对外暴露了一套类似 SQL 的查询语言 SnQL,支持过滤、聚合、分组、排序等标准操作。

Discover 相当于 Snuba 的"翻译层",负责：

1. **字段解析**：将用户输入的字段名（如 `user.email`、`transaction.duration`、`stack.function`）解析为 Snuba 实际的列名（如 `tags[sentry:user]`、`duration`、`exception_stacks.function`）。

2. **函数映射**：将用户级的聚合函数（如 `p50(transaction.duration)`）映射为 ClickHouse 的聚合表达式（如 `quantile(0.5)(duration)`）。

3. **查询构建**：通过 `QueryBuilder` 体系（`DiscoverQueryBuilder`、`TimeseriesQueryBuilder`、`TopEventsQueryBuilder`）构建完整的 SnQL 查询。

4. **结果后处理**：包括时间格式化（Unix 时间戳转换）、空值填零（zerofill）、Top-N 结果分组等。

从架构角度看,Discover 查询的完整数据流如下：

```
用户查询 → Discover API 端点 → discover.py 入口函数
    → QueryBuilder 构造 SnQL → bulk_snuba_queries → Snuba 服务
    → ClickHouse 查询 → 原始结果集 → builder.process_results
    → 字段反解析 + 格式化 → 最终 JSON 响应
```

值得注意的是,`src/sentry/snuba/discover.py` 中同时支持 **MQL**（Metrics Query Language）和 **SnQL** 两条路径,这意味着 Discover 可以在原始的索引事件数据和预聚合的指标数据之间无缝切换,具体由 `allow_metric_aggregates` 和 `has_metrics` 参数控制。

### 10.1.3 数据集体系：Events、Transactions 与 Discover

Sentry 的数据按用途分为多个逻辑数据集（Dataset）,定义在 `src/sentry/snuba/dataset.py`：

```python
# src/sentry/snuba/dataset.py:5-55
class Dataset(Enum):
    Events = "events"              # 所有摄入的错误事件
    Transactions = "transactions"  # 所有摄入的事务（性能）事件
    Discover = "discover"          # Events + Transactions 的联合视图
    Outcomes = "outcomes"          # 使用量统计
    Replays = "replays"            # 会话重放
    Profiles = "profiles"          # 性能剖析
    IssuePlatform = "search_issues"# 通用 Issue 平台
    Functions = "functions"        # 函数级剖析
    SpansIndexed = "spans"         # 索引 Span 数据
    PerformanceMetrics = "generic_metrics"  # 通用指标平台
    EventsAnalyticsPlatform = "events_analytics_platform"  # EAP
```

在 Discover 中,最常用的是 `Dataset.Discover`（联合视图）和 `Dataset.Transactions`（事务专用）。`Dataset.Discover` 本质上将错误事件和事务事件合并到一个统一的命名空间下查询,这意味着你可以在同一次查询中同时看到错误的 `count()` 和事务的 `p95(transaction.duration)`。

然而,这种联合查询架构也存在性能问题：由于两个数据集的物理表和字段结构不同,联合查询需要遍历更多的存储分区。Sentry 在近期版本中对 Discover 数据集进行了**拆分**（详见第 10.7 节）,将原本模糊的 `DISCOVER` 类型拆分为明确的 `ERROR_EVENTS` 和 `TRANSACTION_LIKE` 两个子类型。

### 10.1.4 Discover 查询的核心入口函数

`query` 函数是 Discover 最核心的入口,它几乎被所有上层功能调用——包括 Dashboard Widget 渲染、Saved Query 执行、API 端点等。其签名揭示了 Discover 的全部能力：

```python
# src/sentry/snuba/discover.py:162-264
def query(
    selected_columns: list[str],     # 选择的字段和聚合函数
    query: str,                      # 过滤条件查询字符串
    snuba_params: SnubaParams,       # 时间范围、项目、环境等参数
    equations: list[str] | None = None,  # 算术表达式
    orderby: list[str] | None = None,    # 排序字段
    offset: int | None = None,           # 分页偏移
    limit: int = 50,                     # 返回行数
    auto_fields: bool = False,           # 自动添加 project + eventid
    auto_aggregations: bool = False,     # 自动为条件中的聚合函数添加字段
    include_equation_fields: bool = False,
    allow_metric_aggregates: bool = False,
    use_aggregate_conditions: bool = False,
    conditions: list[Condition] | None = None,  # 直接透传给 Snuba 的条件
    functions_acl: list[str] | None = None,     # 函数白名单
    transform_alias_to_input_format: bool = False,
    sample: float | None = None,      # 采样率
    has_metrics: bool = False,        # 是否使用指标增强
    skip_tag_resolution: bool = False,
    extra_columns: list[Column] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    dataset: Dataset = Dataset.Discover,  # 数据集选择
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
    *,
    referrer: str,                    # 调用来源标识（必填,用于追踪）
) -> EventsResponse:
```

这个函数首先对参数进行校验（`selected_columns` 不能为空,`dataset` 必须是 `Discover` 或 `Transactions`）,然后构造 `DiscoverQueryBuilder` 实例：

```python
# src/sentry/snuba/discover.py:231-253
builder = DiscoverQueryBuilder(
    dataset,
    params={},
    snuba_params=snuba_params,
    query=query,
    selected_columns=selected_columns,
    equations=equations,
    orderby=orderby,
    limit=limit,
    offset=offset,
    sample_rate=sample,
    config=QueryBuilderConfig(
        auto_fields=auto_fields,
        auto_aggregations=auto_aggregations,
        use_aggregate_conditions=use_aggregate_conditions,
        functions_acl=functions_acl,
        equation_config={"auto_add": include_equation_fields},
        has_metrics=has_metrics,
        transform_alias_to_input_format=transform_alias_to_input_format,
        skip_tag_resolution=skip_tag_resolution,
    ),
)
```

`timeseries_query` 的流程稍有不同 —— 它首先通过 `categorize_columns` 将选中的列拆分为方程和普通列,然后使用 `TimeseriesQueryBuilder` 构建查询。该函数还支持 `comparison_delta` 参数,可以在一次调用中获取当前时间段和对比时间段的两组时序数据,自动计算变化率：

```python
# src/sentry/snuba/discover.py:335-353
if comparison_delta:
    if len(base_builder.aggregates) != 1:
        raise InvalidSearchQuery("Only one column can be selected for comparison queries")
    comp_query_params = snuba_params.copy()
    comp_query_params.start -= comparison_delta
    comp_query_params.end -= comparison_delta
    comparison_builder = TimeseriesQueryBuilder(...)
    query_list.append(comparison_builder)
```

然后在结果处理阶段,将两组数据合并计算百分比变化：

```python
# src/sentry/snuba/discover.py:383-385
for row, compared_row in zip(results[0]["data"], results[1]["data"]):
    compared_value = compared_row.get(col_name, 0)
    row["comparisonCount"] = compared_value
```

---

## 10.2 Discover Query 语法

### 10.2.1 字段选择与基本过滤

Discover 查询的核心由两部分组成：**字段选择**（`selected_columns`）和**过滤条件**（`query` 字符串）。字段选择是一个字符串数组,每个元素可以是一个简单的字段名、一个标签引用、或者一个聚合函数调用。

**简单字段**直接引用事件的属性：

```text
transaction
transaction.duration
release
environment
user.email
timestamp
message
```

**标签引用**使用方括号语法,对应事件上附着的任意标签：

```text
tags[os.name]
tags[device.family]
tags[geo.country_code]
```

在代码层面,标签中的字段通过 `resolve_column` 函数解析：

```python
# src/sentry/snuba/discover.py:75
resolve_discover_column = resolve_column(Dataset.Discover)
```

**过滤条件**遵循 Sentry 的搜索查询语法,支持多种操作符：

| 操作符 | 含义 | 示例 |
| --- | --- | --- |
| `:` | 等于 | `environment:production` |
| `!=` | 不等于 | `release:!null` |
| `>` / `<` | 大于/小于 | `transaction.duration:>3000` |
| `>=` / `<=` | 大于等于/小于等于 | `user_count:>=10` |
| `!` | 不包含 | `!transaction:"/api/health"` |
| `is:` | 状态检查 | `is:unresolved` |
| `has:` | 存在性检查 | `has:user` |

这些条件最终通过 `QueryBuilder` 被转换为 Snuba 的 `Condition` 对象列表,或者作为原始 SnQL 片段直接传递：

```python
# 直接透传给 Snuba 的条件（跳过解析层）
conditions: list[Condition] | None = None
```

### 10.2.2 聚合函数详解

Discover 提供了丰富的聚合函数集,函数映射定义在 `src/sentry/search/events/fields.py` 和 `src/sentry/search/events/datasets/discover.py` 中。每个函数在一个或多个数据集上可用,具体取决于数据集的物理结构。

**通用聚合函数（Events + Transactions）**：

| 函数 | 说明 | SnQL 映射 | 返回类型 |
| --- | --- | --- | --- |
| `count()` | 事件计数 | `count()` | integer |
| `count_unique(column)` | 去重计数 | `uniq(column)` | integer |
| `avg(column)` | 平均值 | `avg(column)` | duration |
| `max(column)` | 最大值 | `max(column)` | duration |
| `min(column)` | 最小值 | `min(column)` | duration |
| `sum(column)` | 求和 | `sum(column)` | duration |

**事务专用聚合函数**（仅在 `Transactions`/`TRANSACTION_LIKE` 数据集上可用）：

| 函数 | 说明 | 代码出处 |
| --- | --- | --- |
| `p50(transaction.duration)` | 中位数（P50） | `fields.py:1585` |
| `p75(transaction.duration)` | 75 分位数 | `fields.py:1593` |
| `p95(transaction.duration)` | 95 分位数 | `fields.py:1609` |
| `p99(transaction.duration)` | 99 分位数 | `fields.py:1617` |
| `failure_rate()` | 事务失败率 | `fields.py:1756` |
| `failure_count()` | 失败事务计数 | 基于 `transaction.status` |
| `apdex(threshold)` | Apdex 满意度得分 | 阈值通常为 300ms |
| `eps()` | 每秒事件数（Event Per Second） | `fields.py:1633` |
| `epm()` | 每分钟事件数（Event Per Minute） | `fields.py:1639` |
| `count_miserable(user, threshold)` | 受影响用户计数 | 阈值倍率 4x |
| `user_misery(threshold)` | 用户痛苦指数 | 0-1 范围 |
| `count_web_vitals(measurement, threshold)` | Web Vitals 通过/不通过计数 | LCP/FCP/FID/CLS |
| `percentile(column, n)` | 任意分位数 | 通用版 percentile |

这些函数在 `fields.py` 中通过字典注册。以 `p95` 为例,其定义如下（在 `discover.py` 数据集层）：

```python
# src/sentry/search/events/datasets/discover.py:356-366
"p95": SnQLFunction(
    "p95",
    required_args=[NumberRange(1, 1, NumberTypes.DURATION)],
    snql_aggregate=lambda args, alias: ...
    result_type_fn=...,
    default_result_type="duration",
),
```

每个 SnQLFunction 包含参数验证（`required_args`）、SnQL 转换函数、结果类型推导等逻辑。`eps` 和 `epm` 的实现更为复杂,需要在 `count()` 的基础上除以时间窗口的大小：

```python
# src/sentry/search/events/datasets/function_aliases.py:337-376
def resolve_eps(args, alias):
    # EPS = count() / (end - start).seconds
    ...

def resolve_epm(args, alias):
    # EPM = count() * 60 / (end - start).seconds
    ...
```

`failure_rate` 的定义返回一个百分比：

```python
# src/sentry/search/events/fields.py:1756
"failure_rate", transform="failure_rate()", default_result_type="percentage"
```

### 10.2.3 算术表达式（Equation）

Discover 支持在查询中使用算术表达式,允许用户将多个聚合函数组合在一起进行计算。表达式以 `equation|` 为前缀,使用 `plus`/`minus`/`multiply`/`divide` 四种操作符：

```text
# 计算缓存命中率
equation|(count_if(transaction.op,cache.get))/(count_if(transaction.op,cache.get)+count_if(transaction.op,db.query))

# 计算平均事务耗时 = 总耗时 / 次数
equation|(sum(transaction.duration))/count()
```

算术表达式的解析由 `src/sentry/discover/arithmetic.py` 完成,它使用 Parsimonious 解析器（PEG 语法）构建表达式树：

```python
# src/sentry/discover/arithmetic.py:15-17
EQUATION_PREFIX = "equation|"
EQUATION_ALIAS_REGEX = re.compile(r"^equation\[\d*\]$")
SUPPORTED_OPERATORS = {"plus", "minus", "multiply", "divide"}
```

核心解析语法如下：

```python
# src/sentry/discover/arithmetic.py:95-100
arithmetic_grammar = Grammar(
    r"""
term                 = maybe_factor remaining_adds
remaining_adds       = add_sub*
add_sub              = add_sub_operator maybe_factor
maybe_factor         = spaces (factor / primary) spaces
...
```

解析后的 `Operation` 树可以转换为 Snuba 的 JSON 表达式：

```python
# src/sentry/discover/arithmetic.py:62-72
def to_snuba_json(self, alias: str | None = None) -> JsonQueryType:
    lhs = self.lhs.to_snuba_json() if isinstance(self.lhs, Operation) else self.lhs
    if isinstance(lhs, str):
        lhs = ["toFloat64", [lhs]]
    rhs = self.rhs.to_snuba_json() if isinstance(self.rhs, Operation) else self.rhs
    result: JsonQueryType = [self.operator, [lhs, rhs]]
    if alias:
        result.append(alias)
    return result
```

算术表达式在执行时会被分离出来：`categorize_columns` 函数将 `selected_columns` 中的普通列和表达式列分开,分别传递给 `QueryBuilder` 的不同参数。

### 10.2.4 Order By、Limit 与 Offset

Discover 支持标准的排序和分页机制。`orderby` 参数是一个字符串列表,使用前置的 `-` 表示降序：

```python
# 按错误数量降序排序,每页 50 条
query(
    selected_columns=["count()", "message"],
    query="",
    orderby=["-count()"],
    limit=50,
    offset=0,
    ...
)
```

`limit` 默认值为 50,`offset` 默认值为 `None`（表示从 0 开始）。分页信息通过 `PaginationResult` 具名元组返回：

```python
# src/sentry/snuba/discover.py:70
PaginationResult = namedtuple("PaginationResult", ["next", "previous", "oldest", "latest"])
```

### 10.2.5 数据集拆分对查询的影响

Sentry 将 Discover 数据集拆分为 `ERROR_EVENTS` 和 `TRANSACTION_LIKE` 后,某些字段和函数只能在特定数据集上使用。`dataset_split.py` 中定义了事务专属的聚合函数和字段：

```python
# src/sentry/discover/dataset_split.py:51-80
TRANSACTION_ONLY_AGGREGATES = [
    "failure_rate", "failure_count", "apdex", "count_miserable",
    "user_misery", "count_web_vitals", "percentile",
    "p50", "p75", "p90", "p95", "p99", "p100",
]

TRANSACTION_ONLY_FIELDS = [
    "duration", "transaction_op", "transaction_status",
    "measurements[lcp]", "measurements[cls]", "measurements[fcp]",
    "measurements[fid]", "measurements[inp]", "measurements[ttfb]",
    "measurements[app_start_cold]", "measurements[app_start_warm]",
    "measurements[frames_total]", "measurements[frames_slow]",
    ...
]
```

当你编写一个既包含 `count_unique(user)`（适用于错误事件）又包含 `p95(transaction.duration)`（仅适用于事务）的查询时,查询会被路由到 `Discover` 联合数据集。如果 `discover_widget_split` 字段被设置,则系统会根据查询的特征自动将其路由到 `ERROR_EVENTS` 或 `TRANSACTION_LIKE` 数据集。

---

## 10.3 Discover 查询构建器

### 10.3.1 可视化查询界面

Sentry 在前端提供了完整的可视化 Discover 查询构建器。用户通过交互式界面（而非手写查询字符串）选择：

- **数据集**：Errors、Transactions 或两者的合并视图
- **字段列**：从字段列表中勾选需要展示的列,包括事件属性、标签、聚合结果
- **过滤条件**：通过下拉菜单选择字段、操作符和值,支持多条件组合（AND/OR 逻辑）
- **分组**：选择 Group By 字段,将结果分组展示
- **排序**：选择排序字段和方向
- **图表类型**：表格、柱状图、折线图、面积图等
- **时间范围**：通过内置的日期选择器设定查询的时间窗口

这种可视化构建方式的底层调用仍然是 `discover.py` 中的 `query` 和 `timeseries_query` 函数,前端只是将其图形化呈现而非暴露原始查询字符串。

### 10.3.2 保存查询与 DiscoverSavedQuery 模型

用户在 Discover 界面构建好查询后,可以选择"保存"以便后续复用。保存的查询通过 `DiscoverSavedQuery` 模型持久化到数据库中：

```python
# src/sentry/discover/models.py:81-127
class DiscoverSavedQuery(Model):
    projects = models.ManyToManyField("sentry.Project", through=DiscoverSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    name = models.CharField(max_length=255)
    query = models.JSONField()          # 查询配置的 JSON 结构
    version = models.IntegerField(null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    is_homepage = models.BooleanField(null=True, blank=True)
    dataset = BoundedPositiveIntegerField(       # 数据集类型
        choices=DiscoverSavedQueryTypes.as_choices(),
        default=DiscoverSavedQueryTypes.DISCOVER,
    )
    dataset_source = BoundedPositiveIntegerField(  # 数据集的确定来源
        choices=DatasetSourcesTypes.as_choices(),
        default=DatasetSourcesTypes.UNKNOWN.value,
    )
```

其中 `DiscoverSavedQueryTypes` 枚举定义了三种查询类型：

```python
# src/sentry/discover/models.py:24-40
class DiscoverSavedQueryTypes(TypesClass):
    DISCOVER = 0        # 原始联合查询
    ERROR_EVENTS = 1    # 错误事件查询
    TRANSACTION_LIKE = 2 # 事务类查询
```

`DatasetSourcesTypes` 则记录了数据集是如何被确定的：

```python
# src/sentry/discover/models.py:43-61
class DatasetSourcesTypes(Enum):
    UNKNOWN = 0    # 未分类（待处理）
    INFERRED = 1   # 通过运行查询或启发式推断
    USER = 2       # 用户显式指定
    FORCED = 3     # 模糊查询被强制分割（系统选择默认值）
```

保存查询的 CRUD 操作通过专门的端点实现：
- `discover_saved_queries.py`：创建和列表查询
- `discover_saved_query_detail.py`：详情、更新和删除

查询配置以 JSON 格式存储在 `query` 字段中,包含 `fields`、`aggregates`、`conditions`、`orderby` 等完整信息。

### 10.3.3 主页查询与收藏

每个用户可以为自己的组织设置一个主页查询（Homepage Query）,该查询会在用户打开 Discover 页面时自动加载。这个特性通过 `is_homepage` 字段实现,并配有数据库级唯一约束：

```python
# src/sentry/discover/models.py:120-126
class Meta:
    constraints = [
        UniqueConstraint(
            fields=["organization", "created_by_id", "is_homepage"],
            condition=Q(is_homepage=True),
            name="unique_user_homepage_query",
        )
    ]
```

这确保每个用户在每个组织内只能设置一个主页查询。相关的设置和获取通过 `discover_homepage_query.py` 端点实现。

---

## 10.4 常用查询场景

### 10.4.1 错误分布分析

**按错误类型分组统计** — 查看各种错误类型的发生频率：

```python
query(
    selected_columns=["count()", "error.type", "error.value"],
    query="has:error.type",
    orderby=["-count()"],
    limit=20,
    ...
)
```

**按时间序列的错误率** — 配合 `timeseries_query` 生成时序图：

```python
timeseries_query(
    selected_columns=["count()"],
    query="has:error.type",
    rollup=3600,  # 每小时一个数据点
    ...
)
```

**按环境分布** — 区分生产环境和测试环境的错误分布：

```python
query(
    selected_columns=["environment", "count()", "count_unique(user)"],
    query="",
    orderby=["-count()"],
    ...
)
```

### 10.4.2 性能分析

**事务耗时分布** — 分析哪些事务最慢：

```python
query(
    selected_columns=["transaction", "count()", "p95(transaction.duration)"],
    query="",
    orderby=["-p95(transaction.duration)"],
    limit=20,
    ...
)
```

**事务失败率监控** — 使用 `failure_rate()` 聚合函数：

```python
query(
    selected_columns=["transaction", "failure_rate()", "count()"],
    query="",
    orderby=["-failure_rate()"],
    ...
)
```

**页面加载性能** — 分析 Web Vitals 指标：

```python
query(
    selected_columns=[
        "transaction",
        "p75(measurements.lcp)",
        "p75(measurements.fcp)",
        "p75(measurements.cls)",
    ],
    query="transaction.op:pageload",
    orderby=["-p75(measurements.lcp)"],
    ...
)
```

**每秒/每分钟吞吐量** — 使用 `eps()` 或 `epm()` 函数：

```python
timeseries_query(
    selected_columns=["epm()"],
    query="transaction:/api/*",
    rollup=60,
    ...
)
```

### 10.4.3 用户影响范围分析

**受影响用户数** — 使用 `count_unique(user)` 或 `count_unique(user.email)`：

```python
query(
    selected_columns=["error.type", "count()", "count_unique(user)"],
    query="",
    orderby=["-count_unique(user)"],
    limit=20,
    ...
)
```

**用户痛苦指数** — `user_misery()` 综合考量失败率和影响用户数：

```python
query(
    selected_columns=["transaction", "user_misery(300)", "count_unique(user)"],
    query="",
    orderby=["-user_misery(300)"],
    limit=10,
    ...
)
```

### 10.4.4 多维度组合分析

通过结合多个 Group By 字段,可以实现多维度的下钻分析。例如,同时按项目、环境和事务名分组：

```python
query(
    selected_columns=["project", "environment", "transaction", "p95(transaction.duration)", "count()"],
    query="transaction.op:http.server",
    orderby=["-count()"],
    limit=50,
    ...
)
```

配合算术表达式,可以计算多个指标的组合比率：

```python
query(
    selected_columns=["count()", "count_if(transaction.status,ok)"],
    equations=["equation|(count_if(transaction.status,ok))/count()"],
    query="",
    orderby=["-equation[0]"],
    include_equation_fields=True,
    ...
)
```

---

## 10.5 Dashboards 仪表盘

### 10.5.1 Dashboard 数据模型

仪表盘是多个 Widget 的容器,提供统一的筛选器和查看视角。Dashboard 的数据库模型定义在 `src/sentry/models/dashboard.py` 中：

```python
# src/sentry/models/dashboard.py:336-353
class Dashboard(Model):
    title = models.CharField(max_length=255)
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    projects = models.ManyToManyField("sentry.Project", through=DashboardProject)
    filters = JSONField(null=True)
    prebuilt_id = BoundedPositiveIntegerField(null=True, db_default=None)

    MAX_WIDGETS = 30
```

关键特性：

- **项目关联**：每个 Dashboard 通过多对多关系关联一个或多个项目（通过 `DashboardProject` 中间表,`project` + `dashboard` 唯一约束）
- **过滤器**：`filters` JSON 字段存储仪表盘级别的全局过滤条件,如时间范围、环境选择等。当设置 `all_projects: true` 时,会使用 `ALL_ACCESS_PROJECT_ID`（值为 -1）作为项目占位符
- **数量限制**：`MAX_WIDGETS = 30` 限制每个仪表盘最多 30 个小部件
- **预置标记**：`prebuilt_id` 标识预置模板,非空表示该仪表盘为系统预置

此外,Dashboard 还维护了**使用热度**：`visits` 记录访问次数,`last_visited` 记录最后访问时间。用户自定义的仪表盘还需要保证同组织内标题唯一（预置模板不受此限制）：

```python
# src/sentry/models/dashboard.py:358-375
class Meta:
    constraints = [
        UniqueConstraint(
            fields=["organization", "title"],
            condition=Q(prebuilt_id__isnull=True),
            name="sentry_dashboard_organization_title_uniq",
        ),
        UniqueConstraint(
            fields=["organization", "prebuilt_id"],
            condition=Q(prebuilt_id__isnull=False),
            name="sentry_dashboard_organization_prebuilt_id_uniq",
        ),
        CheckConstraint(
            condition=Q(prebuilt_id__isnull=True) | Q(created_by_id__isnull=True),
            name="sentry_dashboard_prebuilt_null_created_by",
        ),
    ]
```

注意 `created_by_id` 的约束：预置仪表盘的 `created_by_id` 必须为 `NULL`,因为系统仪表盘不属于任何用户。

### 10.5.2 预置模板（Prebuilt Dashboards）

Sentry 内置了 29 个预置仪表盘模板（截至当前代码版本）,覆盖了最常见的监控场景。这些模板定义在 `src/sentry/dashboards/endpoints/organization_dashboards.py` 中：

```python
# src/sentry/dashboards/endpoints/organization_dashboards.py:65-237
class PrebuiltDashboardId(IntEnum):
    FRONTEND_SESSION_HEALTH = 1
    BACKEND_QUERIES = 2
    BACKEND_QUERIES_SUMMARY = 3
    HTTP = 4
    HTTP_DOMAIN_SUMMARY = 5
    WEB_VITALS = 6
    WEB_VITALS_SUMMARY = 7
    MOBILE_VITALS = 8
    MOBILE_VITALS_APP_STARTS = 9
    MOBILE_VITALS_SCREEN_LOADS = 10
    MOBILE_VITALS_SCREEN_RENDERING = 11
    BACKEND_OVERVIEW = 12
    MOBILE_SESSION_HEALTH = 13
    FRONTEND_OVERVIEW = 14
    NEXTJS_FRONTEND_OVERVIEW = 15
    AI_AGENTS_OVERVIEW = 16
    AI_AGENTS_MODELS = 17
    AI_AGENTS_TOOLS = 18
    MCP_OVERVIEW = 19
    MCP_TOOLS = 20
    MCP_RESOURCES = 21
    MCP_PROMPTS = 22
    LARAVEL_OVERVIEW = 23
    FRONTEND_ASSETS = 24
    FRONTEND_ASSETS_SUMMARY = 25
    BACKEND_QUEUES = 26
    BACKEND_QUEUE_SUMMARY = 27
    BACKEND_CACHES = 28
    NODE_RUNTIME_METRICS = 29
```

每个预置仪表盘包含 `prebuilt_id`（必填）和 `title`（必填）,可选 `hidden`（隐藏）、`pre_favorited`（默认收藏）：

```python
PREBUILT_DASHBOARDS: list[PrebuiltDashboard] = [
    {
        "prebuilt_id": PrebuiltDashboardId.WEB_VITALS,
        "title": "Web Vitals",
        "pre_favorited": True,  # 对新用户自动收藏
    },
    {
        "prebuilt_id": PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY,
        "title": "Query Details",
        "hidden": True,  # 不在常规列表中展示
    },
    ...
]
```

值得注意的是,预置仪表盘的**实际内容（Widget 配置）并不存储在数据库中**,而是由**前端代码**根据 `prebuilt_id` 硬编码渲染。数据库中的预置仪表盘记录仅用于追踪收藏状态、最后访问时间等元数据。这意味着：

- 后端只负责同步预置仪表盘的存在性（`sync_prebuilt_dashboards` 函数会在组织创建后自动在数据库中创建对应的记录）
- 前端负责根据 `prebuilt_id` 加载实际的 Widget 布局和数据
- 用户无法编辑或删除预置仪表盘（`organization_dashboard_details.py` 第 153 行明确拒绝删除预置仪表盘的请求）

```python
# src/sentry/dashboards/endpoints/organization_dashboards.py:264-309
def sync_prebuilt_dashboards(organization: Organization) -> None:
    enabled_prebuilt_dashboards = get_enabled_prebuilt_dashboards(organization)
    saved_prebuilt_dashboards = Dashboard.objects.filter(
        organization=organization,
        prebuilt_id__isnull=False,
    )
    # 为不存在的预置仪表盘创建记录,更新已存在的标题
    ...
    # 删除不再需要的预置仪表盘
    ...
```

同步机制通过 Celery 任务异步执行,使用 Redis 缓存防止重复运行（`dashboards:sync_prebuilt_dashboards:{org_id}` 作为缓存键）。

### 10.5.3 自定义仪表盘

自定义仪表盘是用户手动创建的仪表盘,`prebuilt_id` 为 `NULL`。创建自定义仪表盘的 API 端点位于 `organization_dashboards.py`,核心流程如下：

1. **创建 Dashboard 记录**：提供 `title`、`projects`、`filters` 等参数,创建一个 `prebuilt_id` 为 `NULL` 的 Dashboard。
2. **添加 Widget**：通过 `organization_dashboard_details.py` 端点向 Dashboard 中添加 Widget,每个 Widget 包含一组查询（`DashboardWidgetQuery`）。
3. **配置权限**：通过 `DashboardPermissions` 控制编辑权限（详见 10.8 节）。

自定义仪表盘的标题在同组织内唯一,如果重名会返回 409 错误。Dashboard 模型还提供了 `incremental_title` 类方法用于复制仪表盘时自动生成新标题：

```python
# src/sentry/models/dashboard.py:429-452
@classmethod
def incremental_title(cls, organization, name):
    base_name = re.sub(r" ?copy ?(\d+)?$", "", name)
    matching_dashboards = cls.objects.filter(
        organization=organization, title__regex=rf"^{re.escape(base_name)} ?(copy)? ?(\d+)?$"
    ).values("title")
    if not matching_dashboards:
        return name
    next_copy_number = 0
    for dashboard in matching_dashboards:
        match = re.search(r" copy ?(\d+)?", dashboard["title"])
        if match:
            copy_number = int(match.group(1) or 0)
            next_copy_number = max(next_copy_number, copy_number + 1)
    if next_copy_number == 0:
        return f"{base_name} copy"
    return f"{base_name} copy {next_copy_number}"
```

### 10.5.4 仪表盘版本管理与回滚

Sentry 为每个 Dashboard 维护了版本历史,通过 `DashboardRevision` 模型实现：

```python
# src/sentry/models/dashboard.py:474-498
class DashboardRevision(DefaultFieldsModel):
    SNAPSHOT_SCHEMA_VERSION = 1
    RETENTION_LIMIT = 10

    created_by_id = HybridCloudForeignKey("sentry.User", ...)
    title = models.CharField(max_length=255)
    source = models.CharField(max_length=32, default="edit")
    snapshot = JSONField(default=dict)
    snapshot_schema_version = models.IntegerField()
    dashboard = FlexibleForeignKey("sentry.Dashboard", on_delete=models.CASCADE)
```

每当日志盘内容发生变化（编辑 Widget、修改筛选器等）,系统会在一个事务中：

1. 创建一个新的 `DashboardRevision` 记录,将当前 Widget 配置、筛选器等完整状态序列化为 JSON 快照
2. 根据 `RETENTION_LIMIT = 10` 修剪旧版本（只保留最近 10 个版本）
3. 如果超出保留限制,删除最旧的额外版本

版本快照的 `source` 字段记录了变更来源：`"edit"`（手动编辑）、`"restore"`（从快照恢复）等。

恢复功能通过 `organization_dashboard_revision_restore.py` 端点实现,允许用户从任意历史版本恢复仪表盘的完整状态。

---

## 10.6 Widget 小部件类型

### 10.6.1 Widget 数据模型

Widget 是仪表盘的核心组成单元。每个 Widget 包含一个或多个查询（`DashboardWidgetQuery`）,以及显示类型、标题、布局参数等。数据模型定义在 `src/sentry/models/dashboard_widget.py` 中：

```python
# src/sentry/models/dashboard_widget.py:346-386
class DashboardWidget(Model):
    dashboard = FlexibleForeignKey("sentry.Dashboard")
    order = BoundedPositiveIntegerField(null=True)    # 排列顺序
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    thresholds = JSONField(null=True)                 # 阈值配置
    interval = models.CharField(max_length=10, null=True)
    display_type = BoundedPositiveIntegerField(       # 显示类型
        choices=DashboardWidgetDisplayTypes.as_choices()
    )
    date_added = models.DateTimeField(default=timezone.now)
    widget_type = BoundedPositiveIntegerField(        # 数据源类型
        choices=DashboardWidgetTypes.as_choices(), null=True
    )
    limit = models.IntegerField(null=True)            # 返回数据行数限制
    detail = JSONField(null=True)                     # 展示细节配置
    discover_widget_split = BoundedPositiveIntegerField(
        choices=DashboardWidgetTypes.as_choices(), null=True
    )
    dataset_source = BoundedPositiveIntegerField(     # 数据集选取来源
        choices=DatasetSourcesTypes.as_choices(),
        default=DatasetSourcesTypes.UNKNOWN.value,
    )
    widget_snapshot = models.JSONField(null=True)     # 迁移前快照
    changed_reason = models.JSONField(null=True)      # 迁移字段丢弃原因
```

每个 Widget 关联的查询通过 `DashboardWidgetQuery` 模型表示：

```python
# src/sentry/models/dashboard_widget.py:221-258
class DashboardWidgetQuery(Model):
    widget = FlexibleForeignKey("sentry.DashboardWidget")
    name = models.CharField(max_length=255)        # 查询名称（在图例中显示）
    fields = ArrayField(models.TextField(), default=list)       # 字段列表
    conditions = models.TextField()                # 过滤条件
    aggregates = ArrayField(models.TextField(), null=True)      # 聚合函数
    columns = ArrayField(models.TextField(), null=True)         # 非聚合列
    field_aliases = ArrayField(models.TextField(), null=True)   # 字段别名
    orderby = models.TextField(default="")         # 排序条件
    order = BoundedPositiveIntegerField()          # 查询在 Widget 中的顺序
    is_hidden = models.BooleanField(default=False) # 是否隐藏（用于指标部件后台查询）
    selected_aggregate = models.IntegerField(null=True)  # Big Number 选中的聚合索引
```

一个 Widget 可以有多个 `DashboardWidgetQuery`,不同查询的结果以不同颜色的曲线或柱状图叠加展示。例如,一条"API 请求数"的折线可以同时显示 `count()` 和 `p95(transaction.duration)`,尽管它们的值域不同,但可以在相同的 X 轴（时间）上对比趋势。

### 10.6.2 图表类部件

Sentry 支持的图表显示类型通过 `DashboardWidgetDisplayTypes` 枚举定义：

```python
# src/sentry/models/dashboard_widget.py:177-205
class DashboardWidgetDisplayTypes(TypesClass):
    LINE_CHART = 0           # 折线图
    AREA_CHART = 1           # 面积图
    BAR_CHART = 3            # 柱状图
    TABLE = 4                # 表格
    BIG_NUMBER = 6           # 大数字
    DETAILS = 8              # 详情列表
    CATEGORICAL_BAR_CHART = 9  # 分类柱状图
    WHEEL = 10               # 圆环/饼图（wheel）
    RAGE_AND_DEAD_CLICKS = 11  # 愤怒点击与死点击
    SERVER_TREE = 12         # 服务调用树
    TEXT = 13                # 文本部件
    AGENTS_TRACES_TABLE = 14 # AI Agent Trace 表格
    HEATMAP = 15             # 热力图
```

每种显示类型有其默认的返回行数限制（`DEFAULT_MAX_WIDGET_LIMIT = 10`）,但部分类型例外：

```python
# src/sentry/models/dashboard_widget.py:210-213
MAX_WIDGET_LIMIT_BY_DISPLAY_TYPE: dict[int, int] = {
    DashboardWidgetDisplayTypes.CATEGORICAL_BAR_CHART: 25,
    DashboardWidgetDisplayTypes.TABLE: 20,
}
```

**折线图（LINE_CHART）**：最常用的时序图类型,适用于展示随时间变化的趋势,如每分钟错误数、P95 延迟变化。底层通过 `timeseries_query` 函数获取数据,自动处理 `zerofill` 填充空时间桶。

**面积图（AREA_CHART）**：与折线图类似,但用填充的面积表示数据量级,适合展示累积效果或总体占比趋势。

**柱状图（BAR_CHART）**：标准柱状图,适合多维度对比（如不同环境的错误数对比）。当需要对数据进行分类而不是连续时间序列时尤为适用。

**分类柱状图（CATEGORICAL_BAR_CHART）**：特殊的柱状图变体,最高支持 25 条数据,适合展示 Top-N 分类排名,如"按国家分布的错误数"。

**热力图（HEATMAP）**：使用颜色深浅表示数值大小,适合展现二维分布（如按时间和事务名的错误密度）。

### 10.6.3 表格类部件

**表格（TABLE）**：以行列表格形式展示数据,每行对应一个查询结果,每列对应一个字段或聚合函数。表格部件最多显示 20 行（`MAX_WIDGET_LIMIT_BY_DISPLAY_TYPE[TABLE] = 20`）。表格支持 `field_aliases` 字段为列头设置自定义别名。

**详情列表（DETAILS）**：一种特殊的表格变体,通常用于展示事件的详细列表而非聚合结果。每个行可以展开查看事件的全部属性。

**AI Agent Trace 表格（AGENTS_TRACES_TABLE = 14）**：专门为 AI Agent 场景设计的 Trace 展示表格,用于可视化 AI 工具调用链。

### 10.6.4 大数字部件

**大数字（BIG_NUMBER,值为 6）**：以醒目的数字展示单个聚合结果,如"本周总错误数"、"当前 P95 延迟"。其底层通过 `DashboardWidgetQuery.selected_aggregate` 字段指定要显示哪个聚合函数的结果。

与其他部件不同,Big Number 部件通常不需要时间序列数据,只需一个单一的聚合值。`DashboardWidgetQuery` 上的 `is_hidden` 字段在这里发挥作用 —— 当 Big Number 需要展示相比上一周期的变化百分比时,前端的 Widget 渲染会触发一个"隐藏查询"来获取对比数据,这个查询对于用户是透明的。

### 10.6.5 其他特殊部件

**服务调用树（SERVER_TREE）**：用于展示服务间的调用拓扑,通常用于微服务架构的场景,直观展示请求的上下游依赖关系。

**愤怒点击与死点击（RAGE_AND_DEAD_CLICKS）**：专门用于前端用户体验监控的部件,展示用户反复点击无响应元素（"愤怒点击"）或点击无效元素（"死点击"）的情况。

**文本部件（TEXT）**：一个纯文本展示部件,可以用来在仪表盘中添加说明、备注或 Markdown 格式的文档。

---

## 10.7 Dashboard 数据源

### 10.7.1 Errors & Transactions 数据集拆分

在早期的 Discover 中,所有的 Widget 查询都针对统一的 `Dataset.Discover`（联合数据集）。这一设计虽然灵活,但由于底层存储结构的不同（错误事件和事务事件使用不同的 ClickHouse 表）,查询效率有限。Sentry 随后引入了**数据集拆分**（Dataset Split）策略,将 Widget 的数据源明确区分为错误和事务两类。

拆分策略实现在 `src/sentry/discover/dashboard_widget_split.py` 和 `src/sentry/discover/dataset_split.py` 中。其核心思想是：

1. 分析 Widget 的 `fields`、`aggregates`、`columns` 和 `conditions` 中包含的字段和函数
2. 如果查询只包含错误相关字段（如 `error.type`、`error.value`）,则将其分配给 `ERROR_EVENTS` 数据集
3. 如果查询包含事务相关字段（如 `transaction.duration`、`p50(transaction.duration)`）,则将其分配给 `TRANSACTION_LIKE` 数据集
4. 如果查询既包含错误字段又包含事务字段,则使用完整的 `DISCOVER` 联合数据集

Widget 类型枚举中反映了这一拆分：

```python
# src/sentry/models/dashboard_widget.py:50-93
class DashboardWidgetTypes(TypesClass):
    DISCOVER = 0        # @deprecated 旧版联合查询
    ISSUE = 1           # Issue 查询
    RELEASE_HEALTH = 2  # 发布健康
    METRICS = 3         # 指标查询
    ERROR_EVENTS = 100  # 拆分后的错误事件
    TRANSACTION_LIKE = 101  # 拆分后的事务类数据
    SPANS = 102         # Span 数据
    LOGS = 103          # 日志
    TRACEMETRICS = 104  # Trace 指标
    PREPROD_APP_SIZE = 105  # 预发布应用尺寸
```

`discover_widget_split` 字段记录了拆分的目标类型,`dataset_source` 记录了其被确定的方式（推断、用户选择、强制等,可能的值多达 12 种,包括 SPAN_MIGRATION 的多个版本）。

### 10.7.2 Widget 层面的数据集拆分

`dashboard_widget_split.py` 模块负责在 Widget 级别执行数据集拆分。它的输入是一个 Widget 的完整配置（包括所有 `DashboardWidgetQuery`）,输出是根据字段特征分配的 `DashboardWidgetTypes` 值。

拆分过程中的关键决策树如下：

1. 扫描所有查询的 `fields` 和 `conditions`,提取引用的字段名和函数名
2. 与 `TRANSACTION_ONLY_FIELDS` 和 `TRANSACTION_ONLY_AGGREGATES` 列表进行比较：
   - 如果命中了事务专属字段/函数 → 分配为 `TRANSACTION_LIKE`
   - 如果命中了错误专属内容 → 分配为 `ERROR_EVENTS`
   - 如果两者皆有 → 保持 `DISCOVER`（联合）
   - 如果无法确定 → 标记为 `UNKNOWN`,由系统选择默认行为

### 10.7.3 On-Demand Metrics 提取

对于频繁使用的 Dashboard Widget 查询,Sentry 提供了 **On-Demand Metrics** 机制：将 Widget 的查询条件注册为 Relay 端（事件摄入层）的预聚合规则,在事件到达时就提取出 Widget 所需的指标,而非每次渲染时实时查询 Snuba。这大幅降低了查询延迟。

On-Demand Metrics 的状态通过 `DashboardWidgetQueryOnDemand` 模型管理：

```python
# src/sentry/models/dashboard_widget.py:277-343
class DashboardWidgetQueryOnDemand(Model):
    dashboard_widget_query = FlexibleForeignKey("sentry.DashboardWidgetQuery")
    spec_hashes = ArrayField(models.TextField(), default=list)
    spec_version = models.IntegerField(null=True)
    extraction_state = models.CharField(
        max_length=30,
        choices=OnDemandExtractionState.choices  # 多个启用/禁用状态
    )
```

`extraction_state` 的取值反映了复杂的生命周期管理：

- `disabled:not-applicable`：该 Widget 不适用 On-Demand（数据集不支持）
- `disabled:pre-rollout`：预填充状态,用于评估负载
- `disabled:manual`：用户手动禁用
- `disabled:spec-limit`：组织达到 spec 限制,自动禁用
- `disabled:high-cardinality`：高基数检查时发现列基数过高,自动禁用
- `enabled:enrolled`：在 AM1 迁移时自动启用
- `enabled:creation`：在创建 Widget 时主动选择启用
- `enabled:manual`：用户手动启用

某些状态转换可以被自动任务覆盖（如 `disabled:pre-rollout` 可以由定时任务改为 `enabled:enrolled`）,而另一些则不可自动恢复（如 `disabled:manual` 和 `disabled:high-cardinality` 必须由用户手动重新启用）：

```python
def can_extraction_be_auto_overridden(self):
    if self.extraction_state in [
        self.OnDemandExtractionState.DISABLED_MANUAL,
        self.OnDemandExtractionState.DISABLED_HIGH_CARDINALITY,
        self.OnDemandExtractionState.DISABLED_SPEC_LIMIT,
    ]:
        return False
    return True
```

---

## 10.8 Dashboard 管理与分享

### 10.8.1 权限控制

Dashboard 的编辑权限通过 `DashboardPermissions` 模型管理：

```python
# src/sentry/models/dashboard_permissions.py:23-53
class DashboardPermissions(Model):
    is_editable_by_everyone = models.BooleanField(default=True, db_default=True)
    teams_with_edit_access = models.ManyToManyField(
        "sentry.Team", through=DashboardPermissionsTeam, blank=True
    )
    dashboard = models.OneToOneField(
        "sentry.Dashboard", on_delete=models.CASCADE, related_name="permissions"
    )

    def has_edit_permissions(self, user_id):
        if self.is_editable_by_everyone:
            return True
        if user_id == self.dashboard.created_by_id:
            return True  # 创建者永远有编辑权限
        return self.teams_with_edit_access.filter(
            organizationmemberteam__organizationmember__user_id=user_id
        ).exists()
```

权限控制有两种模式：

1. **所有人可编辑（默认）**：`is_editable_by_everyone = True`,组织中所有成员都可以修改仪表盘。
2. **仅限特定团队**：`is_editable_by_everyone = False`,需要显式指定有编辑权限的团队列表。Dashboard 创建者始终拥有编辑权限（即使没有加入授权团队）。

权限检查通过 `organization_dashboard_details.py` 端点在每次编辑操作前执行。当一个用户尝试删除仪表盘时,系统会检查 `has_edit_permissions`,如果用户没有权限则返回 403。

### 10.8.2 收藏与排序

用户可以收藏仪表盘以便快速访问。收藏功能通过 `DashboardFavoriteUser` 模型实现：

```python
# src/sentry/models/dashboard.py:286-294
class DashboardFavoriteUser(DefaultFieldsModel):
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    dashboard = FlexibleForeignKey("sentry.Dashboard", on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField(null=True)
    favorited = models.BooleanField(db_default=True)
```

核心 Manager 方法包括：

- `get_favorite_dashboards(org, user_id)`：获取用户收藏的所有仪表盘,按 `position` 排序
- `insert_favorite_dashboard(org, user_id, dashboard)`：收藏一个仪表盘（添加到列表末尾）
- `insert_favorite_dashboard_alphabetically(org, user_id, dashboard)`：按字母顺序插入预置仪表盘（用于新用户自动收藏）
- `unfavorite_dashboard(org, user_id, dashboard)`：取消收藏,自动调整后续项的位置
- `reorder_favorite_dashboards(org, user_id, dashboard_ids)`：拖拽排序,更新 `position` 值

排序通过原子操作实现,在取消收藏时会自动将后续位置的 `position` 值递减：

```python
self.filter(
    organization=organization,
    user_id=user_id,
    favorited=True,
    position__gt=deleted_position,
).update(position=models.F("position") - 1)
```

### 10.8.3 嵌入分享

Sentry Dashboard 支持通过共享链接或嵌入 iframe 的方式与外部用户分享（包括那些没有 Sentry 账户的成员）。共享功能允许设置**只读访问权限**,外部查看者可以看到仪表盘的实况数据,但无法进行任何修改操作。

嵌入分享的 URL 通常格式为：

```text
https://{organization}.sentry.io/share/dashboard/{dashboard_id}/
```

此功能需要组织层面启用 `organizations:dashboards-share` 特性标志（Feature Flag）。

---

## 10.9 Insights 模块

Insights 模块是基于 Dashboard 和 Discover 之上构建的高级分析功能,提供了特定领域（如后端性能、前端性能、移动端性能、AI Agent 追踪）的预构建视图和深入洞察能力。Insights 模块的仪表盘通过预置模板机制在后台同步：

```python
# src/sentry/dashboards/endpoints/organization_dashboards.py:448-452
if features.has("organizations:dashboards-prebuilt-insights-dashboards", organization):
    # 同步预置仪表盘到数据库
    ...
    sync_prebuilt_dashboards(organization)
```

相比普通的预置模板,Insights 仪表盘提供了更深度的上下文信息：

- **Backend Overview**（后端概览）：展示 API 端点性能、数据库查询耗时、缓存命中率等
- **Frontend Overview**（前端概览）：展示 Web Vitals 指标、页面加载性能、用户交互指标
- **Mobile Vitals**（移动端性能）：展示应用程序启动时间、屏幕加载、帧率等移动端专属指标
- **Web Vitals**：Core Web Vitals（LCP、INP、CLS）的详细监控
- **Queue/Cache**（队列与缓存）：后端基础设施的性能洞察
- **AI Agents**：AI 应用的模型调用、工具使用、MCP 协议等可观测性
- **Laravel/NextJS Overview**：框架专属的性能仪表盘

---

## 10.10 查询性能优化与最佳实践

### 10.10.1 查询构建器配置

Discover 的查询构建器（`DiscoverQueryBuilder`）支持多项性能优化配置,通过 `QueryBuilderConfig` 传入：

1. **`auto_fields`**：当设为 `False` 时,不会自动添加 `project` 和 `eventid` 字段,减少查询的列数。
2. **`auto_aggregations`**：当过滤条件中引用了聚合函数时,自动在 `SELECT` 中添加对应的聚合字段。在 Dashboard 渲染场景下应设为 `True`,避免字段缺失导致的二次查询。
3. **`skip_tag_resolution`**：跳过标签解析步骤,在已知字段已正确解析的情况下跳过可以节省开销。`top_events_timeseries` 中默认启用此选项。
4. **`functions_acl`**：函数访问控制列表,限制可用的聚合函数。通过白名单机制防止查询使用了不支持或不高效的函数。
5. **`has_metrics`**：当设为 `True` 时,查询将尝试使用预聚合的指标数据而非原始事件数据,可以显著降低查询延迟（牺牲一点精度）。

### 10.10.2 采样与 Turbo 模式

在查询大量项目或长时间范围的数据时,Discover 自动启用采样策略以减少 Snuba 的负载：

- **Turbo 模式**：当请求的项目数超过 2 个时（`len(project_ids) > 2`）,系统启用 `turbo` 模式。Turbo 模式下 Snuba 不会应用 `FINAL` 修饰符,即不等待数据去重,在写入并发的场景下可以大幅降低查询延迟,代价是结果可能包含微小偏差。
- **显式采样率**：通过 `sample` 参数可以指定采样率（0.0 到 1.0 之间）。采样后的结果会按 `1 / sample_rate` 的倍率进行缩放。
- **Facet 查询的采样**：`get_facets` 函数在获取标签分布时,如果高频标签的总计数超过 10,000（`key_names["data"][0]["count"] > 10000`）,则自动应用 0.1 的采样率以减少数据量。

### 10.10.3 Zerofill 与时间桶填充

`zerofill` 函数是确保时序图连续性的关键工具。当 Snuba 返回的时序数据中存在空时间桶（即该时间段内没有匹配的事件）时,`zerofill` 会自动插入值为零的数据点：

```python
# src/sentry/snuba/discover.py:113-151
def zerofill(
    data: SnubaData,
    start_param: datetime,
    end_param: datetime,
    rollup: int,
    orderby: list[str],
    time_col_name: str | None = None,
) -> SnubaData:
    return_value: SnubaData = []
    start = int(to_naive_timestamp(naiveify_datetime(start_param)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end_param)) / rollup) * rollup) + rollup
    data_by_time: dict[int, SnubaData] = {}
    ...
    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            return_value.extend(data_by_time[key])
        else:
            return_value.append({"time": key})  # 空桶：只包含 timestamp,聚合字段为 0
    ...
```

通过 `zerofill_results` 参数（默认 `True`）可以控制是否启用。在 `timeseries_query` 和 `top_events_timeseries` 中,zerofill 都是默认启用的,因为时序图如果不展示空桶会导致视觉上的间隔和误导。

### 10.10.4 Facet 查询的优化策略

Facet 查询（`get_facets` 函数）用于生成"维度分布"面板 —— 即展示高频标签及其值。这是一个多步骤的复杂查询,优化策略包括：

1. **先获取高频标签键**：首先查询 `tags_key` 和 `count()`,获取出现频率最高的标签键（如 `environment`、`release`、`os.name`）。
2. **分离查询与聚合**：对于频率最高的标签键（如 `environment`）,逐个发起单独的查询获取其 Top-N 值；对于频率较低的标签键,使用 `tags_key` IN 条件批量聚合查询,减少查询轮次。
3. **项目特殊处理**：在多项目场景下,将项目信息单独查询并放置在结果列表最前面,避免被分页截断。
4. **结果重排序**：最终按 `(tag_key, -count, tag_value)` 三元组排序,确保相同标签键的 Top 值聚集在一起。

### 10.10.5 批量查询与缓存

对于需要多个独立查询的场景（如 Dashboard 中多个 Widget 同时渲染）,Sentry 使用 `bulk_snuba_queries` 批量执行,将多个 SnQL 查询打包为一次网络往返,减少连接开销：

```python
# src/sentry/snuba/discover.py:354-356
query_results = bulk_snuba_queries(
    [query.get_snql_query() for query in query_list], referrer, query_source=query_source
)
```

在 `top_events_timeseries` 中,当需要同时获取 Top-N 事件和"其他"事件（Other）时,也会使用 `bulk_snuba_queries` 并发执行两个查询。

对于预置仪表盘的同步操作,系统使用 Redis 缓存（键格式 `dashboards:sync_prebuilt_dashboards:{organization.id}`）通过 Redis Lock 机制避免在短时间内重复执行相同的同步任务。

### 10.10.6 最佳实践清单

以下是基于 Sentry 代码实现总结的 Discover / Dashboard 使用最佳实践：

**查询编写**：

1. 尽量在单个查询中完成需求 —— 减少 Snuba 的网络往返次数。如果确实需要多个独立查询,利用 `bulk_snuba_queries` 批次执行。
2. 使用精确的过滤条件缩小数据范围 —— `conditions` 比 `query` 字符串处理更高效（前者直接透传给 Snuba 而不经过额外的解析层）。
3. 在不需要精确计数时启用采样 —— `sample=0.1` 可以让结果快 10 倍,适合大数据量的探索性分析。
4. 对于聚合类查询（非 Detail 视图）,将 `auto_fields` 设为 `False` —— 不自动添加 `project` 和 `eventid` 列可以减少 IO。
5. 对于 Top-N 分析,合理设置 `limit` 不要超过实际需要 —— 每个额外的 Top 条目都会产生一条独立的时序查询。

**仪表盘设计**：

6. 一个仪表盘的 Widget 数量控制在 30 以内（系统硬限制）,但实际建议不超过 10-15 个以保证加载速度。
7. 利用预置仪表盘作为起点 —— Sentry 官方提供的模板（Web Vitals、Backend Queries、HTTP 等）覆盖了最常见的监控场景,直接使用可以避免重复造轮子。
8. 对于高频使用的 Widget,启用 On-Demand Metrics —— 将查询条件注册为 Relay 端的预聚合规则,可以让 Dashboard 渲染从"实时查询"变为"读取预计算指标",延迟降低 10 倍以上。
9. 利用 Dashboard 的全局过滤器（`filters` JSON 字段）而非在每个 Widget 中重复设置相同的过滤条件 —— 一次性修改时间范围或环境选择可以影响整个仪表盘。

**性能优化**：

10. 使用 `referrer` 追踪查询来源 —— 每个 Discover 查询都应带上明确的 `referrer` 值,以便在 Snuba 的慢查询日志中定位瓶颈。
11. 时序查询合理设置 `rollup` 值 —— rollup 越小,时间桶越多,产生更多的 ClickHouse 分区扫描。对于 7 天以上的时间范围,建议 `rollup >= 1h`。
12. 利用 `transform_alias_to_input_format=True` 时注意开销 —— 该选项会对每个聚合函数进行反向格式转换,仅在需要时开启。
