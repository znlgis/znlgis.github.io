---
layout: default
title: 第10章 - STAC API 检索与扩展
---

# 第10章 - STAC API 检索与扩展

STAC API 的检索能力分两层：**核心参数**（bbox、intersects、datetime、collections、ids、limit）由 Item Search 规范定义，任何实现都必须支持；**扩展参数**（sort、fields、filter、query）由扩展定义，实现可以选择。用户抱怨“搜不了云量小于 10%”时，问题往往不在核心参数，而在 filter 扩展没开或没写对。

这一章按“核心参数 → 分页 → 排序与字段裁剪 → CQL2 过滤 → 扩展组合”的顺序讲，每个参数给出规范约束与 pgstac 的实际行为。所有示例都可以对着第 9 章起的服务直接跑。

先记一个版本事实：**STAC API 规范是 1.0.0（2023-04-24），不是 1.1.0**。数据规范升到 1.1.0 后，API 的 conformance URI 仍然是 https://api.stacspec.org/v1.0.0/core。写兼容性判断时不要拿 STAC 版本去比对 API 版本。

## 10.1 核心参数

### 10.1.1 参数表

| 参数 | 类型 | 默认 | 约束 |
|------|------|------|------|
| limit | integer | 10 | 上限 10000；超过按上限处理，不报错 |
| bbox | [number] | 无 | 4 或 6 个数；与 intersects 互斥 |
| intersects | GeoJSON Geometry | 无 | 与 bbox 互斥 |
| datetime | string | 无 | RFC 3339 单值或区间，开区间用 .. |
| collections | [string] | 无 | 逗号分隔（GET）或数组（POST） |
| ids | [string] | 无 | 逗号分隔或数组 |
| token | string | 无 | 分页令牌，不透明 |

三条硬规则：

1. **bbox 与 intersects 只能给一个**。规范写的是“如果两个都给，必须返回 400 Bad Request”。
2. **limit 超过上限不报错**。规范原文是“服务器必须按上限处理，而不是返回错误”。stac-fastapi 用 AfterValidator 把值裁到 10000。
3. **bbox 是 2n 个数**，二维 4 个、三维 6 个。给 5 个数会 400，报 “BBox '...' must have 4 or 6 values.”。

### 10.1.2 GET 与 POST 的差异

同一个查询，两种写法：

```bash
# GET
curl -s "http://localhost:8082/search?collections=demo-landsat\
&bbox=100,20,110,30\
&datetime=2023-01-01T00:00:00Z/2023-12-31T23:59:59Z\
&limit=5"
```

```json
{
  "collections": ["demo-landsat"],
  "bbox": [100, 20, 110, 30],
  "datetime": "2023-01-01T00:00:00Z/2023-12-31T23:59:59Z",
  "limit": 5
}
```

```bash
curl -s -X POST http://localhost:8082/search \
  -H "Content-Type: application/json" \
  -d @search.json
```

GET 的限制是 URL 长度。带 intersects 的 GeoJSON 可能几 KB，URL 编码后超过 8 KB 会被某些代理拒绝。规范的建议是：**用 intersects 或复杂条件时优先 POST**。

### 10.1.3 datetime 的写法

| 写法 | 含义 |
|------|------|
| 2023-05-01T00:00:00Z | 精确到该时刻（实际按“包含该时刻”解释） |
| 2023-05-01T00:00:00Z/2023-12-31T23:59:59Z | 闭区间 |
| 2023-05-01T00:00:00Z/.. | 从该时刻起，无上界 |
| ../2023-12-31T23:59:59Z | 无下界，到该时刻止 |
| 2023-05-01 | 只给日期，按当天 00:00:00Z 解释 |

pgstac 的解析在 str_to_interval 里，遇到越界值会返回稳定的错误串：

```text
Invalid RFC3339 datetime.
```

注意区间是**闭区间**：start 与 end 两个端点都包含在内。这与 STAC 1.1.0 对 start_datetime / end_datetime 的定义一致。

### 10.1.4 bbox 与几何的语义差

规范要求“API 的空间过滤必须用 Item 的 geometry 求交，不能用 bbox”。pgstac 的实现是：

```sql
ST_Intersects(i.geometry, ST_MakeEnvelope(100,20,110,30,4326))
```

用 bbox 做索引粗筛、再用 geometry 精确判断。如果实现图省事只做 bbox 相交，斜向条带的影像会被误命中——搜出来的 Item 实际不覆盖查询范围。

## 10.2 分页

### 10.2.1 token 语义

响应里的 next 链接长这样：

```json
{
  "type": "FeatureCollection",
  "features": [ ... ],
  "links": [
    {"rel": "root", "href": "http://localhost:8082/", "type": "application/json"},
    {"rel": "self", "href": "http://localhost:8082/search", "type": "application/json"},
    {"rel": "next", "href": "http://localhost:8082/search?token=next:eyJ...",
     "type": "application/geo+json", "method": "GET"}
  ],
  "numberReturned": 10,
  "numberMatched": 137
}
```

客户端只要跟着 next 走，不要自己拼 token。**没有 next 链接就是最后一页**——这是规范定义的终止条件。

### 10.2.2 POST 的分页链接

POST 请求不能靠 URL 传参，所以规范给 Link 对象加了四个字段：method、headers、body、merge。

```json
{
  "rel": "next",
  "href": "http://localhost:8082/search",
  "method": "POST",
  "body": {"token": "next:eyJ...", "collections": ["demo-landsat"], "limit": 10},
  "merge": true
}
```

merge: true 表示“把 body 合并进原始请求体”，而不是替换。服务端不必把整个原始查询回显，只需要给出增量。

### 10.2.3 翻页的性能陷阱

用 OFFSET 实现的分页，翻到第 1000 页会扫过 100 万行。pgstac 用 keyset，翻页成本恒定。自己实现后端时这条必须注意：

```python
# 反例：越翻越慢
rows = all_items[offset : offset + limit]

# 正例：从上一页最后一个排序键继续
rows = [r for r in all_items if (r.datetime, r.id) < last_key][:limit]
```

## 10.3 排序与字段裁剪

### 10.3.1 sortby

sort 扩展给请求模型加一个 sortby 数组：

```json
{"sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}]}
```

字段名要带 properties. 前缀（datetime 例外，直接写 datetime）。direction 只能是 asc 或 desc。

pgstac 对 datetime 排序做了专门优化，其他字段排序在超大表上会退化成全表排序。stac-fastapi-pgstac 的文档明确提醒：**百万级以上建议限制 sort 的使用，或者给数据库设 statement_timeout**。

```bash
# 只允许按时间排序的最简单做法：不开 sort 扩展
export ENABLED_EXTENSIONS="query,fields,filter,pagination"
```

### 10.3.2 fields

fields 扩展裁剪返回的字段，减少传输量：

```json
{
  "collections": ["demo-landsat"],
  "fields": {
    "include": ["id", "properties.datetime", "assets.visual.href"],
    "exclude": ["properties.eo:cloud_cover"]
  }
}
```

规则：

- include 与 exclude 同时给时，先 include 再 exclude；
- include 里的 "id"、"type"、"geometry" 之类顶层字段直接写名字；
- 嵌套字段用点号；
- 空的 include 数组表示“什么都不返回”，不是“返回全部”。

pgstac 的实现会据此生成列投影，把不需要的重列（geometry、assets、links）替换成 NULL，保持结果 schema 稳定：

```sql
CASE
  WHEN a.attname = ANY (ARRAY['geometry','bbox','assets','links','link_hrefs',
                              'extra','properties','stac_version','stac_extensions'])
       AND NOT field_included(...)
  THEN format('NULL::%s AS %I', format_type(a.atttypid, a.atttypmod), a.attname)
  ELSE format('i.%I', a.attname)
END
```

这个设计的好处是：客户端可以准备一次查询、逐页绑定参数，列数永远一致。

## 10.4 CQL2 过滤

### 10.4.1 为什么要 filter

核心参数只能表达“空间 + 时间 + 集合 + id”。想搜“云量小于 10% 且平台是 landsat-8”，核心参数做不到——这两个字段在 properties 里，属于任意字段过滤。

filter 扩展用 CQL2 补上这块。规范要求实现必须支持：

- Filter（queryables 机制 + filter / filter-lang / filter-crs 参数）
- Basic CQL2（AND / OR / NOT、= / <> / < / <= / > / >=、IS NULL）
- Item Search Filter（把上面两个绑定到 /search）
- CQL2 Text 或 CQL2 JSON 至少一种

### 10.4.2 两种语法

**cql2-text** 是类 SQL 的字符串：

```text
eo:cloud_cover < 10 AND platform = 'landsat-8'
datetime >= TIMESTAMP('2023-01-01T00:00:00Z')
S_INTERSECTS(geometry, POLYGON((100 20, 110 20, 110 30, 100 30, 100 20)))
```

**cql2-json** 是 JSON 结构：

```json
{
  "op": "and",
  "args": [
    {"op": "<", "args": [{"property": "eo:cloud_cover"}, 10]},
    {"op": "=", "args": [{"property": "platform"}, "landsat-8"]}
  ]
}
```

filter-lang 的默认值按请求方式区分：**GET 默认 cql2-text，POST 默认 cql2-json**。这条容易记混，写错会得到 400 或者“过滤器被忽略”的诡异结果。

### 10.4.3 完整示例

```bash
# GET + cql2-text，注意 URL 编码
curl -s -G "http://localhost:8082/search" \
  --data-urlencode "collections=demo-landsat" \
  --data-urlencode "filter-lang=cql2-text" \
  --data-urlencode "filter=eo:cloud_cover < 10 AND platform = 'landsat-8'" \
  --data-urlencode "limit=5"
```

```bash
# POST + cql2-json
curl -s -X POST "http://localhost:8082/search" \
  -H "Content-Type: application/json" \
  -d '{
    "collections": ["demo-landsat"],
    "filter-lang": "cql2-json",
    "filter": {
      "op": "and",
      "args": [
        {"op": "<", "args": [{"property": "eo:cloud_cover"}, 10]},
        {"op": "=", "args": [{"property": "platform"}, "landsat-8"]}
      ]
    },
    "limit": 5
  }'
```

用 -G 加 --data-urlencode 而不是手拼查询串，能避免中文、单引号、空格的编码问题。手拼时最常见的错误是把 < 直接写进 URL，被当成 HTML 实体或截断。

### 10.4.4 常用算子

| 类别 | 算子 |
|------|------|
| 逻辑 | and、or、not |
| 比较 | =、<>、<、<=、>、>= |
| 空值 | isNull |
| 范围 | between、in（Advanced Comparison） |
| 字符串 | like（Advanced Comparison）、lower/upper（Case-insensitive） |
| 空间 | s_intersects、s_within、s_contains、s_disjoint 等（Spatial Functions） |
| 时间 | t_before、t_after、t_intersects、t_during（Temporal Functions） |
| 数组 | a_equals、a_contains（Array Functions） |

空间算子要额外声明 conformance class。Basic Spatial Functions 只接受 BBOX 与 Point 作为空间字面量；要传 Polygon 必须实现 basic-spatial-functions-plus。

### 10.4.5 queryables

queryables 端点告诉客户端“哪些字段能过滤”：

```bash
curl -s "http://localhost:8082/queryables" | python -m json.tool | head -30
# {
#     "$schema": "https://json-schema.org/draft/2020-12/schema",
#     "$id": "https://localhost:8082/queryables",
#     "type": "object",
#     "title": "Queryables for this STAC API",
#     "properties": {
#         "id": {"$ref": "https://schemas.stacspec.org/v1.0.0/item-spec/json-schema/item.json#/properties/id"},
#         "datetime": {...},
#         "eo:cloud_cover": {"title": "Cloud Cover", "type": "number"}
#     }
# }
```

pgstac 的 queryables 是动态的：item_field_registry 记录了每个 Collection 出现过哪些 JSON 路径，注册过的字段才能出现在 queryables 里。新加一个字段后要重新生成 queryables，否则 filter 会报“字段不存在”。

## 10.5 扩展组合

### 10.5.1 stac-fastapi 提供的扩展

| 扩展 | 作用 | conformance |
|------|------|-------------|
| transaction | 增删改 | ogcapi-features/extensions/transaction |
| bulk_transactions | 批量写入 | 同上，额外端点 |
| filter | CQL2 过滤 + queryables | filter + basic-cql2 + cql2-text/json |
| sort | 排序 | item-search#sort |
| fields | 字段裁剪 | item-search#fields |
| query | 属性等值查询（旧机制） | item-search#query |
| pagination | token 或 offset 分页 | 无独立 conformance |
| collection_search | 集合级检索 | collection-search |
| aggregation | 聚合统计 | aggregation |
| free_text | 全文检索 | free-text |

query 扩展是 CQL2 之前的老机制，只支持等值与 in。新项目直接用 filter，query 只用于兼容老客户端。

### 10.5.2 组合时的冲突

几个真实的冲突点：

**filter 与 query 同时开**，同一个字段两种写法都能表达，pgstac 会把它们 AND 起来。这不是错误，但会让调试变复杂——建议只开一个。

**sort 与 pagination** 耦合。token 里编码了排序键，改了 sortby 之后旧 token 失效。客户端换排序必须从头翻。

**fields 与 aggregation** 冲突。聚合需要读被裁剪掉的字段，开了 fields 又开 aggregation 会得到空结果。

```bash
# 只开需要的扩展，避免隐式行为
export ENABLED_EXTENSIONS="filter,sort,fields,pagination"
```

### 10.5.3 一致性检查

开了扩展之后，落地页的 conformsTo 应该包含对应的 URI。用这个脚本核对：

```bash
#!/usr/bin/env bash
set -euo pipefail
API="${1:-http://localhost:8082}"

curl -s "$API/" | python - "$API" <<'PY'
import json, sys
api = sys.argv[1]
d = json.load(sys.stdin)
need = {
    "core": "https://api.stacspec.org/v1.0.0/core",
    "item-search": "https://api.stacspec.org/v1.0.0/item-search",
    "filter": "http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/filter",
    "cql2-json": "http://www.opengis.net/spec/cql2/1.0/conf/cql2-json",
    "cql2-text": "http://www.opengis.net/spec/cql2/1.0/conf/cql2-text",
}
have = set(d.get("conformsTo", []))
for name, uri in need.items():
    print(f"{name:12s} {'OK' if uri in have else 'MISSING'}")
PY
```

```text
core         OK
item-search  OK
filter       OK
cql2-json    OK
cql2-text    OK
```

注意 filter 扩展的 SEARCH 类在 stac-fastapi 里写的是 https://api.stacspec.org/v1.0.0-rc.2/item-search#filter，而规范文本里是 v1.0.0 版本。这个 rc.2 的残留是源码事实，客户端如果用严格字符串匹配会判成“不支持 filter”。判断时建议只匹配前缀或只认 CQL2 那几个 URI。

## 10.6 排错

| 现象 | 原因 | 修法 |
|------|------|------|
| 400 BBox '...' must have 4 or 6 values | bbox 个数不对 | 检查是否漏了逗号或多了空格 |
| 400 bbox 与 intersects 同时给 | 规范禁止 | 二选一 |
| filter 不生效，返回全部 | filter-lang 与实际语法不匹配 | GET 用 cql2-text，POST 用 cql2-json |
| filter 报字段不存在 | queryables 没注册该字段 | 重新生成 queryables |
| sortby 报字段不合法 | 忘了 properties. 前缀 | 改成 properties.eo:cloud_cover |
| 翻页拿到重复数据 | 排序键不唯一（只按 datetime 排） | 加 id 作为次级排序键 |
| numberMatched 是估算值 | context=auto | 需要精确值设 context=on |
| token 失效 | 换了 sortby 或 collections | 重新从第一页开始 |

第六条在自研后端里很常见：只按 datetime 排序时，同一秒的多条记录顺序不稳定，翻页会重复或漏掉。keyset 分页必须用**唯一且稳定**的排序键组合。

## 10.7 生产建议

**默认关闭不用的扩展。** 每开一个扩展就多一组 conformance 声明和请求模型字段，客户端会据此假设能力。ENABLED_EXTENSIONS 显式列出比全开更可控。

**给 /search 设 limit 上限。** 10000 是规范上限，但对内存不友好——10000 个 Item 的 FeatureCollection 可能几十 MB。可以在反向代理层限制，或者在业务层再裁一次。

**filter 的字段要有索引。** pgstac 的提升列（eo_cloud_cover、gsd）自带索引；自定义字段要靠 queryables 注册后建的表达式索引。没索引的字段过滤会全表扫。

**不要在前端拼 CQL2 字符串。** 用户输入直接拼进 cql2-text 会有注入风险（虽然 CQL2 不是 SQL，但语法注入一样能让查询报错或返回意外结果）。用 cql2-json 结构化构造。

**缓存 queryables 响应。** 它变化不频繁，但每次请求都要查注册表。给 5–10 分钟的缓存。

## 10.8 本章小结

| 要点 | 结论 |
|------|------|
| 版本 | STAC API 是 1.0.0，与数据规范 1.1.0 不同步 |
| 核心参数 | bbox 与 intersects 互斥；limit 超限静默裁剪到 10000 |
| 分页 | 跟着 next 链接走，token 不透明；keyset 优于 OFFSET |
| 排序 | 字段带 properties. 前缀；大表限制 sort 使用 |
| 过滤 | GET 默认 cql2-text，POST 默认 cql2-json |
| 扩展 | 按需开启，注意 filter/query 重复、sort 与 token 耦合 |

下一章讲浏览层：STAC Browser 的部署模式、配置项、与静态目录/API 的对接，以及部署到 GitHub Pages 时的限制。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第09章-pgstac与PostgreSQL后端/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第11章-STACBrowser与目录浏览/" class="chapter-nav__next">下一章 →</a>
</div>
