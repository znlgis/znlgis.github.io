---
layout: default
title: 第09章 - pgstac 与 PostgreSQL 后端
---

# 第09章 - pgstac 与 PostgreSQL 后端

第 8 章的内存后端能跑通协议，但它把“怎么查”这件事留给了 Python：遍历字典、手工过滤 bbox、切片分页。Item 上万之后这套做法就崩了——每次 /search 都要把所有 Item 加载进内存。

pgstac 把这件事搬进数据库：Item 存成 jsonb，几何与时间抽成独立列建索引，检索编译成一条 SQL，分页用 keyset 而不是 OFFSET。它不是 ORM，也不是应用框架，就是一套 PostgreSQL schema 加函数库。

这一章讲清三件事：表怎么设计、检索怎么执行、运维怎么做。版本基线是 pgstac 0.10.1。

## 9.1 表结构

### 9.1.1 items 表

0.10 的 items 表是“去规范化 + 提升列”的设计：

```sql
CREATE TABLE items (
    id text NOT NULL,
    geometry geometry NOT NULL,
    collection text NOT NULL,
    datetime timestamptz NOT NULL,
    end_datetime timestamptz NOT NULL,
    datetime_is_range boolean NOT NULL DEFAULT false,
    stac_version text,
    stac_extensions jsonb DEFAULT '[]'::jsonb,
    pgstac_updated_at timestamptz NOT NULL DEFAULT now(),
    item_hash bytea NOT NULL DEFAULT '\x'::bytea,
    fragment_id bigint,
    bbox jsonb,
    links jsonb,
    assets jsonb,
    properties jsonb,
    extra jsonb,
    -- 提升列（部分）
    created timestamptz,
    platform text,
    instruments text[],
    eo_cloud_cover float8,
    bands jsonb,
    gsd float8,
    proj_code text,
    proj_shape jsonb,
    proj_transform jsonb,
    private jsonb
)
PARTITION BY LIST (collection);
```

几个设计决策值得理解：

**按 collection 做 LIST 分区。** 一个 Collection 一个分区（或一组子分区），查询带 collection 条件时能直接剪枝。这也是为什么 pgstac 推荐“Collection 数量不要太多，单个 Collection 的 Item 数量可以很大”。

**datetime 与 end_datetime 都是 NOT NULL。** 单时刻的 Item 把两者设成同值，并用 datetime_is_range 标记是否真的是区间。这样区间查询可以统一写成 datetime <= q_end AND end_datetime >= q_start，不需要区分两种情况。

**properties / assets / links / extra 分开存。** 检索主要看 properties，资产列表只在取详情时用。分开存让 fields 扩展的 include/exclude 可以只读需要的列——fields_to_itemcols 会把不需要的重列替换成 NULL::type AS col，保持结果 schema 稳定但**不传输**数据。

**提升列（promoted columns）。** eo_cloud_cover、proj_code、gsd 这些高频过滤字段被复制成原生列，可以建 btree 索引。0.10 的提升列表与 STAC 扩展版本对齐过：proj:epsg（int）换成了 proj:code（text），eo:bands 换成了核心 bands。

**item_hash。** 32 字节的 sha256，用于外部客户端判断“这条 Item 有没有变”，不必拉全量。

### 9.1.2 collections 表

```sql
CREATE TABLE collections (
    key bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id text GENERATED ALWAYS AS (content->>'id') STORED UNIQUE NOT NULL,
    content JSONB NOT NULL,
    fragment_config text[],
    geometry geometry GENERATED ALWAYS AS (pgstac.collection_geom(content)) STORED,
    datetime timestamptz GENERATED ALWAYS AS (pgstac.collection_datetime(content)) STORED,
    end_datetime timestamptz GENERATED ALWAYS AS (pgstac.collection_enddatetime(content)) STORED,
    private jsonb,
    partition_trunc text CHECK (partition_trunc IN ('year', 'month'))
);
```

id 是从 content 里生成出来的（content->>'id'），所以插入时只需要给完整 JSON。geometry 与 datetime 也是生成列，从 extent 里算。

partition_trunc 决定子分区粒度：NULL 表示只有一层（按 collection），year 或 month 表示再按时间切一层。

### 9.1.3 分区策略

两层分区是 pgstac 的核心性能设计：

```text
items (PARTITION BY LIST (collection))
 ├─ _items_1            ← collection 1，无时间子分区
 ├─ _items_2            ← collection 2 的父分区（PARTITION BY RANGE (datetime)）
 │   ├─ _items_2_2023   ← 2023 年
 │   ├─ _items_2_2024
 │   └─ _items_2_2025
 └─ _items_3_202305     ← collection 3，按月
```

创建子分区时用 advisory lock 串行化，避免并发建表冲突：

```sql
PERFORM pg_advisory_xact_lock(hashtext('pgstac.check_partition'), hashtext(_partition_name));
```

分区名的规则是 _items_{key} 加时间后缀（YYYY 或 YYYYMM）。key 是 collections 表的自增主键，不是 collection id——因为 id 里可能有特殊字符。

时间子分区的好处：查询带时间范围时，Postgres 能直接跳过不相关的分区。一个 5 年、每年 2000 万条的 Collection，查某一天的数据只需要扫 1/60 的分区。

### 9.1.4 其他表

| 表 | 作用 |
|----|------|
| item_fragments | Item 内容的去重片段，按 (collection, hash) 唯一 |
| item_field_registry | 记录每个 Collection 出现过哪些 JSON 路径，用于生成 queryables |
| searches | 检索缓存：WHERE 子句、ORDER BY、命中数、最后使用时间 |
| queryables | 可查询字段的注册表，支持按 Collection 限定 |
| migrations | 已应用的迁移版本 |
| pgstac_settings | 运行期配置，可被会话参数与请求内的 conf 覆盖 |
| partition_stats | 每个分区的时空范围与索引状态 |

item_fragments 是 0.10 引入的去重机制：同一个 Collection 里大量 Item 的 assets、links 模板完全相同，把公共部分存一份，Item 只存 fragment_id。这对 Sentinel-2 这种“几万景、资产结构一模一样”的数据能把存储压掉一半以上。

## 9.2 检索是怎么执行的

### 9.2.1 从 JSON 到 SQL

一个 POST /search 的请求体最终变成一条 SQL：

```text
{"collections":["demo"],"bbox":[100,20,110,30],
 "datetime":"2023-01-01T00:00:00Z/2023-12-31T23:59:59Z",
 "limit":10}
        ↓ search_to_cql2()
CQL2 JSON 表示
        ↓ cql2_query()
WHERE i.collection = ANY('{demo}') AND i.datetime <= '...' AND i.end_datetime >= '...'
  AND ST_Intersects(i.geometry, ST_MakeEnvelope(100,20,110,30,4326))
        ↓ search_page()
keyset 分页查询
```

三个函数串起来：

```sql
CREATE OR REPLACE FUNCTION stac_search_to_where(j jsonb) RETURNS text AS $$
DECLARE _where text := cql2_query(search_to_cql2(j));
BEGIN
    IF _where IS NULL OR btrim(_where) = '' THEN RETURN ' TRUE '; END IF;
    RETURN _where;
END;
$$ LANGUAGE PLPGSQL STABLE;
```

空搜索返回 TRUE，这样调用方不需要特判“没有条件”。

### 9.2.2 keyset 分页

pgstac 不用 OFFSET。OFFSET 100000 会让数据库扫过前 10 万行再丢弃，越翻越慢。

keyset 分页记录“上一页最后一行的排序键”，下一页从那里继续：

```text
第一页：ORDER BY datetime DESC, id DESC LIMIT 11
       取前 10 行，第 11 行用来判断 has_more
下一页：WHERE (datetime, id) < ('2023-05-01T...', 'demo-001')
        ORDER BY datetime DESC, id DESC LIMIT 11
```

返回给客户端的 token 编码了这个位置。pgstac 的 token 带方向前缀：

```sql
keyset text := nullif(regexp_replace(coalesce(_token,''), '^(next|prev):', ''), '');
is_prev boolean := (_token LIKE 'prev:%') AND keyset IS NOT NULL;
```

所以客户端拿到的链接形如：

```json
{"rel": "next", "href": "https://api.example.com/search?token=next:eyJ...", "method": "GET"}
{"rel": "prev", "href": "https://api.example.com/search?token=prev:eyJ...", "method": "GET"}
```

token 对客户端是不透明的，不要解析它，也不要假设它能跨版本复用。

### 9.2.3 命中数统计

numberMatched 有两种算法，由 context 配置控制：

| context | 行为 |
|---------|------|
| off | 不返回 numberMatched |
| on | 每次精确 count(*) |
| auto | 先用 EXPLAIN 估算，估算值够大就直接用估算值 |

auto 的逻辑在 where_stats 里：

```sql
EXECUTE format('EXPLAIN (format json) SELECT 1 FROM items i WHERE %s', ...) INTO explain_json;
sw_estimated_count := (explain_json->0->'Plan'->>'Plan Rows')::bigint;
...
IF _context = 'auto' AND sw_estimated_count >= _estimated_count_threshold
   AND sw_estimated_cost >= _estimated_cost_threshold THEN
    sw.context_count := sw_estimated_count;
    RETURN sw;
END IF;
```

对百万级结果，精确 count 要几秒；估算值误差可能有 10%–30%，但快两个数量级。前端做分页器时通常只需要“大概有多少页”，auto 是合理默认。

统计结果缓存在 searches 表里，TTL 由 context_stats_ttl 控制。相同 WHERE 的重复查询直接命中缓存。

## 9.3 部署

### 9.3.1 装 PostGIS 与 pgstac

pgstac 依赖 PostGIS，顺序不能反：

```bash
# 1. 起一个带 PostGIS 的 Postgres
docker run -d --name pg -p 5432:5432 \
  -e POSTGRES_USER=pgstac -e POSTGRES_PASSWORD=pgstac -e POSTGRES_DB=pgstac \
  postgis/postgis:16-3.4

# 2. 等就绪
until docker exec pg pg_isready -U pgstac; do sleep 1; done

# 3. 迁移：0.10 起迁移是独立的 Python 包，不在 PostGIS 镜像里
python -m pip install pgstac-migrate
pgstac-migrate migrate --dsn "postgresql://pgstac:pgstac@localhost:5432/pgstac"

# 4. 确认版本
psql "postgresql://pgstac:pgstac@localhost:5432/pgstac" -c "SELECT pgstac.get_version();"
#  get_version
# -------------
#  0.10.1
```

0.10 把原来合一的 pypgstac 拆成三块：pgstac-migrate（迁移）、pgstac Rust CLI（加载与检索）、pgstac Python wheel（读写 API）。0.9 及以前只有 pypgstac，迁移命令是 pypgstac migrate；照老文档在新版本上执行会报 command not found。

手工安装（不用 Docker）时，把 SQL 按序执行：

```bash
for f in src/pgstac/sql/*.sql; do
  psql -U pgstac -d pgstac -v ON_ERROR_STOP=1 -f "$f"
done
```

文件名前缀就是执行顺序：000_idempotent_pre、001_core、001a_jsonutils、001s_stacutils、002_collections、002a_queryables、002b_cql、002c_envelope、002d_keyset、003a_items、003b_partitions、003c_ingest、004_search、004a_collectionsearch、005_tileutils、006_tilesearch、997_maintenance、998_idempotent_post、999_version。

### 9.3.2 创建 Collection 与加载 Item

pgstac 提供 SQL 函数直接写：

```sql
-- 建集合，按月做时间子分区
SELECT pgstac.create_collection(
  '{
    "type": "Collection",
    "stac_version": "1.1.0",
    "id": "demo-landsat",
    "description": "示例 Landsat 集合",
    "license": "CC-BY-4.0",
    "extent": {
      "spatial": {"bbox": [[100, 20, 110, 30]]},
      "temporal": {"interval": [["2023-01-01T00:00:00Z", null]]}
    },
    "links": []
  }'::jsonb,
  'month'
);

-- 插入一个 Item
SELECT pgstac.create_item('{
  "type": "Feature",
  "stac_version": "1.1.0",
  "id": "demo-001",
  "collection": "demo-landsat",
  "geometry": {"type": "Polygon",
    "coordinates": [[[100,20],[110,20],[110,30],[100,30],[100,20]]]},
  "bbox": [100, 20, 110, 30],
  "properties": {"datetime": "2023-05-01T00:00:00Z",
                 "eo:cloud_cover": 12.5, "platform": "landsat-8"},
  "assets": {},
  "links": []
}'::jsonb);
```

create_collection 的第二个参数是 partition_trunc，可选 'year' 或 'month'，不传就是只有 collection 一层。

create_item 会自动路由到对应分区，并在分区不存在时先建分区。批量导入用 staging 表更快：

```sql
-- 批量：一次插入多行，触发器逐行处理
INSERT INTO items_staging (content) VALUES
  ('{...}'::jsonb),
  ('{...}'::jsonb);

-- 或者用封装函数，参数是 JSON 数组
SELECT pgstac.create_items('[{...}, {...}]'::jsonb);
```

三张 staging 表的语义不同：items_staging 冲突时报错（纯新增），items_staging_ignore 冲突时跳过，items_staging_upsert 冲突时覆盖。它们都是 UNLOGGED 表，写入不写 WAL，速度快很多，但崩溃会丢数据——只用于可重跑的导入。

### 9.3.3 接上 stac-fastapi

```bash
export PGUSER=pgstac PGPASSWORD=pgstac PGHOST=localhost PGPORT=5432 PGDATABASE=pgstac
export STAC_FASTAPI_TITLE="示例影像目录"
export ENABLE_TRANSACTIONS_EXTENSIONS=TRUE
export ENABLED_EXTENSIONS="query,sort,fields,filter,pagination"

uvicorn stac_fastapi.pgstac.app:create_app --factory --port 8082
```

ENABLED_EXTENSIONS 的可选键来自扩展映射表：query、sort、fields、filter、pagination（检索侧），collection_search、free_text（集合检索），extra。不设就是全开。

### 9.3.4 验证

```bash
curl -s "http://localhost:8082/search?collections=demo-landsat&limit=1" \
  | python -c "import json,sys; d=json.load(sys.stdin); print(d['numberMatched'], d['features'][0]['id'])"
# 1 demo-001

# 看查询计划，确认分区剪枝生效
docker exec pg psql -U pgstac -d pgstac -c "
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM pgstac.search('{\"collections\":[\"demo-landsat\"],\"limit\":10}'::jsonb);
"
```

计划里应该只出现 _items_*_202305 一个分区，而不是扫描所有分区。看到 Append 下挂十几个子计划，说明 collection 条件没被下推。

## 9.4 运维

### 9.4.1 分区维护

新建分区是惰性的：第一次插入某个月的数据时才建。这会导致“写入偶发变慢”。可以提前建：

```sql
-- 预建未来 3 个月的分区
SELECT pgstac.ensure_partitions(3);
```

```bash
# 定时任务：每天凌晨补建
0 2 * * * psql -U pgstac -d pgstac -c "SELECT pgstac.ensure_partitions(3);"
```

删除旧数据用 DROP PARTITION，不要用 DELETE：

```sql
-- 快：直接摘掉分区
DROP TABLE pgstac._items_2_202301;

-- 慢：逐行删，还会留下大量死元组
DELETE FROM pgstac.items WHERE datetime < '2023-02-01';
```

### 9.4.2 索引

pgstac 默认建两个索引：

```sql
CREATE INDEX "datetime_idx" ON items USING BTREE (datetime DESC, end_datetime ASC);
CREATE INDEX "geometry_idx" ON items USING GIST (geometry);
```

datetime_idx 的列顺序与排序方向是按“最新优先”设计的，正好匹配默认排序。geometry_idx 用 GiST，因为要支持 ST_Intersects 而不是简单的 bbox 比较。

提升列（eo_cloud_cover、gsd 等）的索引由 queryables 机制按需创建。注册一个 queryable 时会生成对应的表达式索引：

```sql
out := format($q$CREATE INDEX ON %%I USING %s (%s(((content -> 'properties'::text) -> %L::text)))$q$, ...);
```

注意这里索引的是 content->'properties'->>字段 的表达式，不是提升列——两套机制并存。

### 9.4.3 统计与 VACUUM

jsonb 列更新频繁的表，autovacuum 默认参数往往不够。建议按表调：

```sql
ALTER TABLE pgstac.items SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);
```

scale_factor 从默认 0.2 降到 0.02，意味着 2% 的行变化就触发 vacuum。对大表这是必要的，否则统计信息滞后会让查询计划选错索引。

### 9.4.4 连接池

stac-fastapi-pgstac 自带连接池，参数是环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| DB_MIN_CONN_SIZE | 1 | 最小连接数 |
| DB_MAX_CONN_SIZE | 10 | 最大连接数 |
| DB_MAX_QUERIES | 50000 | 单连接查询上限，超过后重建 |
| DB_MAX_INACTIVE_CONN_LIFETIME | 300 | 空闲连接存活秒数 |

DB_MAX_QUERIES 是个容易被忽略的保护：长连接跑了几万次查询后，Postgres 的执行计划缓存与内存可能劣化，定期重建连接能缓解。

多 worker 部署时，总连接数 = workers × DB_MAX_CONN_SIZE。4 个 worker、每个 10 个连接 = 40，加上运维连接，Postgres 的 max_connections 至少给 100。

## 9.5 排错

| 现象 | 原因 | 修法 |
|------|------|------|
| function search(jsonb) does not exist | pgstac 版本过旧，或 search_path 不对 | 设 search_path=pgstac,public |
| 查询扫全部分区 | collection 条件没下推，或统计信息过期 | ANALYZE，检查 WHERE 里 collection 的类型 |
| 插入报 partition not found | 分区没建，且 ensure_partitions 没跑 | 跑 ensure_partitions 或让 create_item 自动建 |
| numberMatched 与实际差很多 | context=auto 用的是估算值 | 需要精确值就设 context=on |
| 分页翻到后面越来越慢 | 用了 OFFSET（自实现的分页） | 用 pgstac 的 token |
| 迁移报 extension postgis does not exist | 没装 PostGIS | CREATE EXTENSION postgis |
| 内存暴涨 | 大结果集全量 hydration | 用 fields 限制字段，或开 USE_API_HYDRATE |

第一条最常见。pgstac 的函数都在 pgstac schema 下，连接时必须把 search_path 设对。stac-fastapi-pgstac 的 ServerSettings 默认就是 "pgstac,public"，自己写 psql 时容易忘。

## 9.6 生产建议

**Collection 数量控制在几十个以内。** 每个 Collection 至少一个分区，分区太多会让查询计划变复杂。用 properties 区分数据集，不要用 Collection。

**时间子分区按数据量选粒度。** 单个 Collection 每年超过 5000 万条用 month，否则 year 就够。粒度太细会让分区数量爆炸。

**定期 ANALYZE 大表。** jsonb 的统计信息质量直接影响计划选择。pgstac 的 search 缓存也依赖统计，统计不准会导致 context 估算失真。

**把 searches 表当成缓存管理。** 它有 TTL 与使用计数，可以定期清理长期未用的行：

```sql
DELETE FROM pgstac.searches WHERE lastused < now() - interval '30 days';
```

**读副本分担检索。** pgstac 的检索是只读的，可以挂只读副本给 /search，主库只负责写入。stac-fastapi-pgstac 的连接串指向副本即可，但要注意复制延迟——刚写入的 Item 可能搜不到。

## 9.7 本章小结

| 要点 | 结论 |
|------|------|
| 表设计 | items 按 collection LIST 分区，可再按 datetime RANGE 子分区 |
| 检索 | JSON → CQL2 → WHERE → keyset 分页，不用 OFFSET |
| 命中数 | context=off/on/auto，auto 用 EXPLAIN 估算并缓存 |
| 迁移 | 0.10 用 pgstac-migrate；0.9 及以前用 pypgstac |
| 索引 | datetime btree + geometry GiST，提升列按 queryables 建表达式索引 |
| 运维 | ensure_partitions 预建、DROP PARTITION 删数据、调 autovacuum |

下一章回到 API 侧：/search 的参数细节、CQL2 过滤的写法、扩展怎么组合，以及分页与排序的边界。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第08章-stac-fastapi服务开发/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第09章-pgstac与PostgreSQL后端/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第10章-STACAPI检索与扩展/" class="chapter-nav__next">下一章 →</a>
</div>
