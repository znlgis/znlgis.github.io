---
layout: default
title: 第11章 - SQL 工作区与 DuckDB 空间分析
---

# 第11章 - SQL 工作区与 DuckDB 空间分析

GeoLibre 的 SQL 工作区做了一件在桌面 GIS 里只有"数据库连接 + 查询层"才做得到的事：**地图上的每个矢量图层同时是一张 SQL 表**。你不需要导出、不需要建库、不需要装任何服务端，就能对当前工程里的图层写 `JOIN`、`ST_Intersects`、`ST_Buffer`，把结果直接变成新图层。

支撑它的是 **DuckDB-WASM + spatial 扩展**：DuckDB 编译成 WebAssembly 跑在浏览器里，spatial 扩展是运行时另加载的第二份 WASM（`ST_*` 函数全在它里面）。此外还可以切到 **PGlite + PostGIS** 与 **Apache Sedona** 两种引擎。

> **说明**：本章基于 GeoLibre 3.4。菜单与按钮名保留英文原文。事实来源为 `docs/user-guide/sql-workspace.md`、`docs/tutorials/spatial-sql.md`、`docs/architecture.md`（DuckDB 小节）、`docs/tutorials/source-code-deep-dive-zh.md`，以及源码 `apps/geolibre-desktop/src/lib/{sql-workspace,sql-table-names,sql-cloud-urls,pglite-sql,sedona-workspace}.ts`、`components/panels/SqlWorkspacePanel.tsx`。

---

## 11.1 SQL 工作区的界面

### 11.1.1 打开与布局

**Processing → SQL Workspace**。面板停靠在**地图下方**（与 Python 控制台同一套布局），打开时默认高度 300 px：

| 参数 | 值 | 说明 |
|------|----|------|
| 默认高度 | 300 px | 首次打开 |
| 最小 / 最大高度 | 160 / 640 px | 拖上边缘调整 |
| 编辑器宽度占比 | 0.42 | 可拖动 0.2–0.8 |
| 折叠 | 支持 | 折叠后只剩标题栏 |

面板分左右两栏：左边是 **SQL 编辑器**，右边是**结果网格**。中间的分隔条可以拖动（拖到极限也只在 20%–80% 之间）。

### 11.1.2 控件清单

| 控件 | 位置 | 行为 |
|------|------|------|
| **Run** | 编辑器上方 | 执行当前语句；快捷键 `Ctrl`/`Cmd` + `Enter` |
| **Clear** | 同上 | 清空编辑器 |
| **Completions** | 同上 | 列出可用的补全候选 |
| **SQL engine** | 右上 | 在 **DuckDB** / **PostGIS** / **Apache Sedona** 之间切换；选择记在 `localStorage` 的 `geolibre.sqlWorkspace.engine` |
| **Sample queries…** | 工具条 | 插入示例（按当前引擎给不同的一组） |
| **Sample query for layer…** | 工具条 | 按 Queryable layers 里的某个表生成 `SELECT * FROM "表" LIMIT 10;` |
| **History…** | 工具条 | 复用历史语句（最近 25 条，去重，新的在前） |
| **Layer name** | 结果区上方 | **Add as layer** 与 **Add as query layer** 用的图层名，可空 |
| **Add as layer** | 结果区 | 把结果物化成新图层 |
| **Add as query layer** | 结果区 | 把结果加成"活查询图层"，刷新时重跑 SQL（仅 DuckDB 引擎） |
| **Export CSV** | 结果区 | 导出 CSV（RFC 4180，CRLF 行尾） |
| **Export GeoParquet** | 结果区 | 导出 GeoParquet（**要求结果含几何列**） |

编辑器底部有一行提示：`SQL here · Ctrl/Cmd+Enter to run · Tab or Ctrl+Space to autocomplete`。

### 11.1.3 补全与 Queryable layers

- **补全**同时覆盖：表名（当前所有可查询图层）、列名、SQL 关键字、空间函数；
- **列名是启发式的**：只扫描**前 50 个要素**的属性键，再补上几何列。所以一个只在第 200 个要素里出现的属性不会出现在补全里——但**不影响查询**，直接写列名照样能跑；
- **Queryable layers** 一栏列出当前会被注册成表的图层名，以及引擎要求的几何列名。

> **提示**：图层改名之后，表名可能变。写好的 SQL 建议先在 **Queryable layers** 里核对表名，而不是凭记忆。命名规则见 11.3。

---

### 11.1.4 内置示例查询

**Sample queries…** 按当前引擎给不同的一组，全部针对公开示例数据集 `countries.parquet` 或 `your_layer` 占位表：

| 引擎 | 示例（按类别） |
|------|----------------|
| **DuckDB** | Countries with geometry、Attributes only (no geometry)、Population by continent (aggregate)、Most populous countries (geometry)、Country centroids (spatial)、Largest countries by area (spatial) |
| **PostGIS** | PostGIS version、Make a point (geometry)、First rows of a layer、Feature count、Centroids of a layer、Buffer features by 0.01 deg |
| **Apache Sedona** | First rows of a layer、Feature count、Centroids of a layer、Buffer features、Area of each feature、Buffer a point |

用法建议：**先插一条能跑的，再改**。示例都经过验证，所以它同时是"语法模板"和"环境自检"——如果示例都跑不动，问题在引擎或数据源，不在你的 SQL。

**History…** 保留最近 **25** 条（去重、新的在前，存在 `localStorage` 的 `geolibre.sqlWorkspace.history`），单击一条即回填编辑器。它是排错时最有用的东西：把报错的语句与上一条能跑的语句并排看，差异通常只有表名或列名。

## 11.2 三种 SQL 引擎

引擎选择在面板右上角。三种都加载了空间扩展，所以 `ST_*` 都可用，但**它们的边界差别很大**。

| | **DuckDB** | **PostGIS** | **Apache Sedona** |
|---|---|---|---|
| 实现 | DuckDB-WASM + spatial 扩展 | PGlite（Postgres 的 WASM 构建）+ PostGIS | 浏览器里是 **CereusDB**（SedonaDB 的 WASM 构建）；桌面可切 **SedonaDB sidecar** |
| 首次加载 | 小（spatial 扩展按需） | **约 19 MB** 数据库引擎 | CereusDB 按需下载；sidecar 需要 `sedona` extra |
| 能查已加载图层 | ✅ | ✅ | ✅ |
| 能直接读本地文件 / URL | ✅（含 `s3://`/`gs://`/`az://` 公开数据） | ❌（PGlite 读不了远程文件） | ❌ |
| 几何列名 | `geom` | `geom` | `geometry` |
| 属性列可直接引用 | ✅ | ✅ | 浏览器引擎**不能**按名引用属性列；sidecar 可以 |
| 结果加为活查询图层 | ✅ | ❌ | ❌ |
| 规模上限 | 受浏览器内存限制 | 受浏览器内存限制 | 浏览器引擎单层 **50 000** 要素；sidecar 更大 |

### 11.2.1 DuckDB：默认选择

适合绝大多数工作：查已加载图层、直读远程 GeoParquet/CSV/GeoJSON、写带几何的查询、把结果变成图层。首次加载小、离线可用。

### 11.2.2 PostGIS：要"完整的 PostGIS SQL"

PGlite 是 Postgres 的 WASM 构建，装上 PostGIS 后，你可以用真正的 PostGIS 语法与函数集（`PostGIS_Full_Version()`、`ST_SetSRID`、`ST_MakePoint`、`ST_GeomFromGeoJSON` 等）。代价是首次要下约 19 MB，而且**读不了远程文件**——只能查已经注册成表的图层，或纯构造的几何。

它的建表方式是"每个属性一组列 + 一个 `geometry(Geometry, 4326)` 列"，几何通过 `ST_SetSRID(ST_GeomFromGeoJSON($n), 4326)` 写入，所以**结果坐标一律是 4326**。

### 11.2.3 Apache Sedona：大规模与 Sedona 生态

两种后端，同一个 SQL 方言：

- **浏览器（CereusDB）**：SedonaDB 的 WebAssembly 构建，按需下载。单层上限 **50 000** 要素，超过会直接报错并提示用 sidecar；
- **桌面（SedonaDB sidecar）**：装了 `sedona` extra 时自动优先使用，适合更大的图层。

一个必须知道的限制：**浏览器引擎里不能按名引用属性列**。`SELECT *` 会返回属性（"Add as layer" 也会保留），但 `WHERE name = 'Texas'` 这种写法在 CereusDB 上不工作——那一版只通过 `geometry` 列与空间函数暴露属性。需要完整属性 SQL 就装 `sedona` extra 跑 sidecar。

> **注意**：Sedona 的几何列叫 `geometry`（不是 `geom`）。所以 `ST_Centroid(geometry)`、`ST_Area(geometry)`、`ST_Buffer(geometry, 0.1)`。补全也会按引擎给出对应列名。

### 11.2.4 怎么选

| 你的任务 | 选择 |
|----------|------|
| 查已加载图层、联表、空间谓词 | DuckDB |
| 直读远程 GeoParquet / CSV / S3 | DuckDB（唯一支持） |
| 需要 PostGIS 专有函数或语法 | PostGIS |
| 图层超过 5 万要素、且需要 Sedona 函数 | Sedona + sidecar |
| 浏览器 / 移动端、无 sidecar | DuckDB 或 Sedona（注意 5 万上限） |

---

## 11.3 表是怎么注册的：命名规则与生命周期

### 11.3.1 表名不是图层名的复制

`assignTableNames` 把图层名转成合法的 SQL 标识符：

| 规则 | 例子 |
|------|------|
| 转小写 | `Countries` → `countries` |
| 非字母数字的连续段压成一个下划线 | `US States (2020)` → `us_states_2020` |
| 去首尾下划线 | `_parcels_` → `parcels` |
| 首字符是数字 → 前缀 `t_` | `2020 Census` → `t_2020_census` |
| 命中保留字 → 前缀 `t_` | `Group` → `t_group` |
| 结果为空 → `layer_<id>` | 纯中文/符号名 |
| 重名 → 追加 `_2`、`_3` | `countries`、`countries_2` |

保留字表不是只有 ANSI 那一套，还包含 DuckDB 专有的 `anti`、`asof`、`by`、`glob`、`ilike`、`macro`、`map`、`pivot`、`qualify`、`semi`、`struct`、`summarize`、`try_cast`、`unpivot`、`values`、`virtual` 等。

**这意味着"图层名 = 表名"只在图层名本身已经是合法标识符时成立。** 中文图层名会被完全改写，所以对中文工程，**看 Queryable layers 而不看图层列表**。

### 11.3.2 注册机制：每次查询重建的临时表

DuckDB 引擎的注册流程是：

```text
1. 把图层的 FeatureCollection 写成 DuckDB 内存文件系统里的一个 .geojson
2. CREATE OR REPLACE TEMP TABLE <表名> AS SELECT * FROM ST_Read('<该文件>')
3. 跑用户的 SQL
4. 关闭连接、drop 掉注册的文件
```

三个后果：

- 表是 **TEMPORARY** 的，随连接关闭而消失，所以**每次查询都会重建**，永远反映当前图层状态（包括你刚改的属性）；
- 注册时会**剥掉 GDAL 自动生成的 `OGC_FID` 列**，避免它在结果图层里变成一个多余的属性、也避免重复读取时的列名冲突；
- 每次运行用一个随机前缀命名内部文件，所以并发查询不会互相覆盖。

### 11.3.3 几何列

| 引擎 | 几何列名 | 说明 |
|------|----------|------|
| DuckDB | `geom` | `ST_Read` 读 GeoJSON 后的默认列名 |
| PostGIS（PGlite） | `geom` | 属性里已有 `geom` 时退让为 `geometry`、`geom_2`… |
| Sedona | `geometry` | CereusDB 与 sidecar 都用这个名字 |

---

## 11.4 查询已加载图层

最小可用查询：

```sql
SELECT NAME, CONTINENT, POP_EST
FROM countries
ORDER BY POP_EST DESC
LIMIT 10;
```

### 11.4.1 先看清表结构

不确定列名时，`DESCRIBE` 比猜快：

```sql
DESCRIBE SELECT * FROM countries;
```

`DESCRIBE` 也可以作用在一个文件上，用来"先侦察再查询"：

```sql
DESCRIBE SELECT * FROM 'https://data.source.coop/giswqs/opengeos/countries.parquet';
```

### 11.4.2 两个图层做联表

地图上的两个图层就是两张表，可以直接 JOIN：

```sql
-- 把城市点按国名接到国家面上，输出落在国境内的城市
SELECT c.NAME AS country, p.name AS city, p.geom
FROM cities p
JOIN countries c
  ON ST_Intersects(c.geom, p.geom)
WHERE c.CONTINENT = 'Africa';
```

### 11.4.3 聚合与分组

```sql
SELECT CONTINENT,
       COUNT(*)                    AS countries,
       SUM(POP_EST)                AS population,
       ROUND(AVG(GDP_MD_EST), 1)   AS avg_gdp
FROM countries
GROUP BY CONTINENT
ORDER BY population DESC;
```

聚合查询通常不需要几何列，所以它不会产出图层——但它是"先算清楚再加入地图"的正确方式。

> **提示**：先跑不带几何的聚合看清数量级，再决定要不要 `Add as layer`。把几百万行结果加成图层，代价在渲染而不是 SQL。

---

### 11.4.4 两种常用组合模式

**CTE：把一步拆成可读的多步**

```sql
WITH africa AS (
  SELECT NAME, POP_EST, geom
  FROM countries
  WHERE CONTINENT = 'Africa'
),
big AS (
  SELECT * FROM africa WHERE POP_EST > 20000000
)
SELECT COUNT(*) AS n, SUM(POP_EST) AS pop FROM big;
```

**UNION ALL：把两张表拼成一张再分析**

```sql
SELECT 'city' AS kind, name, geom FROM cities
UNION ALL
SELECT 'park' AS kind, NAME, geom FROM parks;
```

两个模式都只产出**一条语句**（工作区只允许单语句），但它们能把"过滤 → 派生 → 汇总"写成可读的线性结构，比嵌套子查询好维护得多。

## 11.5 直接查本地文件与 URL

### 11.5.1 裸 URL 自动包裹

SQL 工作区会把 `FROM` / `JOIN` 后面的**裸 URL 或路径**按扩展名自动套上对应 reader。这条便利是工作区自己加的（标准 DuckDB CLI 里必须显式写 `read_parquet('https://…')`）。

| 扩展名 | 自动使用的 reader |
|--------|-------------------|
| `parquet`、`geoparquet`、`pq` | `read_parquet` |
| `csv`、`tsv`、`txt` | `read_csv_auto` |
| `json`、`ndjson` | `read_json_auto` |
| `geojson`、`fgb`、`shp`、`gpkg`、`kml`、`gml` | `ST_Read` |

```sql
SELECT NAME, CONTINENT, POP_EST, geom
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
LIMIT 100;
```

支持的裸源写法包括：`https://…`、`/`（绝对路径）、`./`、`../`、`~/`、以及 Windows 盘符（`C:\…`）。

**已被引号包起来、或已经写在函数调用里的源不会被改写**，所以 `read_parquet('…')`、`ST_Read('…')` 这类显式写法永远安全。改写只作用于真正的代码位置——字符串字面量与注释里的 `FROM https://…` 不会被误伤（源码里专门做了一遍 SQL 字面量遮罩）。

### 11.5.2 远程读取是怎么实现的

这一点决定了"为什么几百 MB 的文件也能查"：

1. 源码把 `read_parquet('https://…')` 这类**原生 reader 的 URL 参数**改注册成 DuckDB 文件句柄（`registerFileURL`），用 JS 侧的 HTTP **Range** 读取；
2. 注册时 `directIO = true`，强制按字节范围读，**不把整个文件缓冲到本地**；
3. 所以 DuckDB 的 Parquet 读取器只取它需要的 row group 与列——**列裁剪 + 谓词下推**在远程文件上同样成立。

为什么不直接用 DuckDB 内置的 httpfs？源码注释写得很直白：WASM 里的 httpfs 路径在很多服务器上会以 `stoi: no conversion` 失败。工作区为此还做了一层自愈：遇到这个错误且语句里确实有远程 reader 时，**重建 SQL 实例并重试一次**。

### 11.5.3 本地文件

桌面版可以直读本机路径：

```sql
SELECT *
FROM ST_Read('D:/data/parcels.gpkg')
LIMIT 20;
```

浏览器版没有真实文件系统，但可以在 `FROM` 后写相对路径/工作区路径——前提是文件确实在那个位置；更可靠的做法是通过 **Add Data** 把文件加成图层，再查它的表。

> **警告**：`ST_Read` 背后是 spatial 扩展自带的一个 **GDAL 子集**，不是系统安装的 GDAL。能读哪些格式取决于当前加载的构建——用 `SELECT * FROM ST_Drivers()` 列出来最准。

---

## 11.6 云对象存储 URL

`s3://`、`gs://`、`az://` 会被**透明改写成公开 HTTPS 地址**，走同一条 HTTP Range 通道，所以不需要 httpfs 扩展、也不需要 `CREATE SECRET`。

| 写法 | 改写成 |
|------|--------|
| `s3://bucket/key` | `https://bucket.s3.amazonaws.com/key` |
| `gs://bucket/key` | `https://storage.googleapis.com/bucket/key` |
| `az://account/container/key` | `https://account.blob.core.windows.net/container/key` |

三种等价写法：

```sql
-- 显式 reader
SELECT * FROM read_parquet('s3://bucket/path/data.parquet') LIMIT 10;

-- 裸云 URL（工作区自动包裹）
SELECT * FROM s3://bucket/path/data.parquet LIMIT 10;

-- 公开 GCS / Azure
SELECT * FROM read_parquet('gs://bucket/path/data.parquet') LIMIT 10;
SELECT * FROM read_parquet('az://account/container/data.parquet') LIMIT 10;
```

### 11.6.1 私有 S3

如果桶被 **Settings → Cloud Storage** 里的某个 S3 连接覆盖，`s3://` 会被换成**用该连接凭据签名的预签名 URL**，于是私有数据也能走同一条读取路径。**其它云 URL 一律匿名读取**：`gs://` 与 `az://` 只支持公开数据。

预签名有一个硬限制：**必须指名单个文件，不支持通配**（globs 不会被签名）。所以 `s3://bucket/dir/*.parquet` 在私有桶上不工作，要逐个写或用公开桶。

### 11.6.2 CORS 是真正的门槛

浏览器侧的读取要求桶的 CORS 策略允许跨域。多数公开数据集桶（AWS Open Data、Source Cooperative 等）已经配好；自建桶忘了配就会看到浏览器的 CORS 报错，而不是 SQL 错误。

> **提示**：Source Cooperative 的 `data.source.coop` 同时发 `Access-Control-Allow-Origin: *` 并支持 Range 请求，所以 DuckDB-WASM、PMTiles、COG 都能直连——这也是本章示例数据都指向它的原因。但它的**元数据 API 不发 CORS 头**，那是另一条链路（桌面走原生 HTTP，Web 走 Worker 代理）。

---

## 11.7 空间函数实战

### 11.7.1 常用函数

| 函数 | 作用 | 备注 |
|------|------|------|
| `ST_Read(path)` | 读矢量文件/URL（GDAL 子集） | 支持 GeoJSON、Shapefile、GeoPackage、FlatGeobuf、KML、GML、DXF、TAB 等，取决于构建 |
| `ST_Drivers()` | 列出可读格式 | 排查"为什么读不了"的第一站 |
| `ST_AsText(geom)` | 几何转 WKT | 结果网格里几何列就是这样显示的 |
| `ST_AsGeoJSON(geom)` | 几何转 GeoJSON | "Add as layer" 内部用它 |
| `ST_Area(geom)` | 面积 | **EPSG:4326 下是平方度** |
| `ST_Area_Spheroid(geom)` | 球面面积（平方米） | 期望 **lat/lon** 顺序，配 `ST_FlipCoordinates` 用 |
| `ST_FlipCoordinates(geom)` | 交换 x/y | 把 lon/lat 变 lat/lon |
| `ST_Centroid(geom)` | 质心 | 面 → 点 |
| `ST_Buffer(geom, d)` | 缓冲区 | `d` 的单位与坐标单位一致（度或米） |
| `ST_Intersects(a, b)` | 相交判定 | 联表的主力 |
| `ST_Intersection(a, b)` | 相交部分 | 生成新几何 |
| `ST_Transform(geom, src, dst)` | 重投影 | 需要构建带的 PROJ 数据 |
| `ST_MakeValid(geom)` | 修复非法几何 | 与 **Fix geometries** 同一套 |
| `ST_GeomFromText(wkt)` | 从 WKT 构造几何 | 构造点最稳的写法 |
| `ST_SetSRID(geom, 4326)` | 设置 SRID | PostGIS 常用 |
| `ST_GeomFromGeoJSON(text)` | 从 GeoJSON 构造 | PostGIS 常用 |
| `ST_MakePoint(lon, lat)` / `ST_Point(lon, lat)` | 构造点 | PostGIS 与 Sedona 示例里都有 |

标准 SQL 的 `COUNT`、`SUM`、`AVG`、`MIN`、`MAX`、`GROUP BY`、`JOIN`、`WITH`、`UNION ALL` 全部可用——DuckDB 是完整的分析型数据库，不只是"几何函数集合"。

### 11.7.2 14 个可直接复制的示例

下面示例默认表名 `countries` 来自示例数据集（列：`NAME`、`CONTINENT`、`POP_EST`、`GDP_MD_EST`、`geom`），其它表名请对照你的 **Queryable layers** 替换。

**示例 1：远程 GeoParquet 直查**

```sql
SELECT NAME, CONTINENT, POP_EST, geom
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
LIMIT 100;
```

**示例 2：先侦察结构**

```sql
DESCRIBE SELECT * FROM 'https://data.source.coop/giswqs/opengeos/countries.parquet';
```

**示例 3：只要属性，不要几何（结果不能作为图层加入地图，但能导出 CSV）**

```sql
SELECT NAME, CONTINENT, POP_EST, GDP_MD_EST
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
ORDER BY POP_EST DESC
LIMIT 10;
```

**示例 4：分组聚合**

```sql
SELECT CONTINENT,
       COUNT(*)     AS countries,
       SUM(POP_EST) AS population
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
GROUP BY CONTINENT
ORDER BY population DESC;
```

**示例 5：条件过滤并保留几何（可直接 Add as layer）**

```sql
SELECT NAME, POP_EST, geom
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
WHERE POP_EST > 50000000
ORDER BY POP_EST DESC;
```

**示例 6：质心 → 点图层**

```sql
SELECT NAME, CONTINENT, ST_Centroid(geom) AS geom
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
WHERE CONTINENT = 'Africa';
```

**示例 7：面积排序（注意平方度）**

```sql
-- area 的单位是"平方度"，只适合排序，不适合上报
SELECT NAME, ST_Area(geom) AS area
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
ORDER BY area DESC
LIMIT 10;
```

**示例 8：把平方度换成平方千米**

```sql
-- ST_Area_Spheroid 期望 lat/lon 顺序，所以先 ST_FlipCoordinates；再除以 1e6 得 km²
SELECT NAME,
       ST_Area_Spheroid(ST_FlipCoordinates(geom)) / 1e6 AS area_km2
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
ORDER BY area_km2 DESC
LIMIT 10;
```

**示例 9：缓冲区（度为单位）**

```sql
-- 0.05 度约 5.5 km（赤道附近），中高纬东西向会变窄
SELECT NAME, ST_Buffer(geom, 0.05) AS geom
FROM https://data.source.coop/giswqs/opengeos/countries.parquet
WHERE CONTINENT = 'Europe';
```

**示例 10：两个图层的空间联表**

```sql
-- cities 是点图层，countries 是面图层
SELECT c.NAME AS country, p.name AS city, p.geom
FROM cities p
JOIN countries c ON ST_Intersects(c.geom, p.geom)
WHERE c.CONTINENT = 'Asia';
```

**示例 11：每个面里的点计数（空间聚合）**

```sql
SELECT c.NAME AS country, COUNT(*) AS city_count
FROM cities p
JOIN countries c ON ST_Intersects(c.geom, p.geom)
GROUP BY c.NAME
ORDER BY city_count DESC
LIMIT 20;
```

**示例 12：重投影后再计算**

```sql
-- 假设 utm_layer 的 geom 是 EPSG:32650 的米制坐标
SELECT NAME,
       ST_Area(ST_Transform(geom, 'EPSG:32650', 'EPSG:4326')) AS area_deg2,
       ST_Transform(geom, 'EPSG:32650', 'EPSG:4326')          AS geom
FROM utm_layer;
```

**示例 13：读 Shapefile / GeoJSON 并裁剪**

```sql
WITH park AS (
  SELECT * FROM ST_Read('https://example.org/data/national_park.geojson')
)
SELECT p.NAME, ST_Intersection(p.geom, c.geom) AS geom
FROM park p
JOIN countries c ON ST_Intersects(p.geom, c.geom);
```

**示例 14：CSV 坐标 → 点几何**

```sql
SELECT name, lon, lat,
       ST_GeomFromText('POINT(' || lon || ' ' || lat || ')') AS geom
FROM read_csv_auto('https://example.org/data/stations.csv');
```

### 11.7.3 PostGIS 与 Sedona 的等价写法

PostGIS 引擎（无远程文件，只查已注册表或构造几何）：

```sql
SELECT PostGIS_Full_Version() AS version;

SELECT ST_SetSRID(ST_MakePoint(-115.1398, 36.1699), 4326) AS geom;

SELECT NAME, ST_Area(geom) AS area, geom
FROM your_layer
ORDER BY area DESC
LIMIT 10;
```

Sedona 引擎（几何列叫 `geometry`）：

```sql
SELECT ST_Centroid(geometry) AS geometry
FROM your_layer;

SELECT ST_Area(geometry) AS area, geometry
FROM your_layer
ORDER BY area DESC
LIMIT 10;

SELECT ST_Buffer(geometry, 0.1) AS geometry
FROM your_layer;
```

> **警告**：三个引擎的 `ST_Area` 在经纬度上都返回"平方度"。要平方米/平方千米，DuckDB 用 `ST_Area_Spheroid(ST_FlipCoordinates(geom))`，PostGIS 用 `ST_Area(geom::geography)`（需该构建支持 geography），Sedona 请优先在投影坐标下计算。**不要**把平方度直接当面积上报。

---

## 11.8 结果的四种去向

| 去向 | 条件 | 结果 |
|------|------|------|
| **Add as layer** | 结果含几何列 | 物化为新的 GeoJSON 图层，可 identify / 选择 / 进属性表 |
| **Add as query layer** | 仅 **DuckDB** 引擎，且含几何列 | 加"活图层"，从 Layers 面板刷新时**重跑这段 SQL** |
| **Export CSV** | 任意结果 | RFC 4180、CRLF；含几何时几何以 WKT 文本出现 |
| **Export GeoParquet** | 结果**必须含几何列** | 写 GeoParquet，保留几何与 `geo` 元数据 |

### 11.8.1 结果网格的限制

- 网格**最多渲染 500 行**，超出时提示 `Showing first 500 of N rows. Export to see them all.`；
- 但**导出与 Add as layer 用完整结果**，不受 500 行限制；
- 没有行返回时提示 `Statement executed. No rows returned.`；
- 几何列在网格里显示为 **WKT 文本**，这样可读也可复制。

### 11.8.2 结果图层能做什么

结果图层与普通矢量图层同权：

| 能力 | 说明 |
|------|------|
| Identify / 选择 / 属性表 | 完整可用 |
| 样式 | 走 Style 面板的全套符号化 |
| 导出 | 走图层动作的导出（GeoJSON / GeoParquet / GeoPackage / …） |
| **Materialize to editable layer** | 把查询结果复制成可编辑的 GeoJSON 图层（要改几何/字段时用） |
| **Edit query in SQL Workspace** | 查询图层可回到工作区继续改 SQL |

活查询图层（`Add as query layer`）的行为差别在于：它的数据**不是快照**，而是"SQL + 刷新时重跑"。所以源图层改了之后，刷新一次就同步——这正是"地图是数据库视图"的具体形态。

> **提示**：同时开多个 DuckDB 查询结果图层是支持的。给它们起能自解释的名字（`africa_pop_gt_50m` 而不是 `SQL result`），后面在 Layers 面板里会省很多时间。

---

### 11.8.3 结果上线前的三个问题

在点 **Add as layer** 之前，先回答：

1. **行数对不对？** 先跑一个 `SELECT COUNT(*)` 的等价聚合，和预期比。多一行少一行通常意味着 `JOIN` 的键重复（面面相交会产生"一对多"的行）。
2. **几何列在不在？** 结果里必须有一列真正的 `GEOMETRY` 类型（`geom` 或 `geometry`）。`ST_AsText(geom) AS geom` 得到的是**文本**，不会被当成几何列。
3. **坐标是度还是米？** 图层一律按 WGS84 度渲染。`ST_Transform` 之后忘了转回来的结果会被画到 (0,0) 附近——这和导入时的"投影坐标当经纬度"是同一个坑。

## 11.9 与 Processing、Model Builder 的配合

### 11.9.1 典型接力：SQL 过滤 → 矢量分析 → 云原生输出

1. **SQL 工作区**里先做"数据库擅长的事"：过滤、联表、聚合、空间谓词；
2. **Add as layer** 把结果物化（只把需要的行带上地图）；
3. 打开 **Processing → GeoLibre Toolbox → Vector**，对结果跑 Buffer / Clip / Spatial join 等（客户端 Turf.js 或 Pyodide/GeoPandas）；
4. 用 **Processing → GeoLibre Toolbox → Conversion** 写出 GeoParquet / FlatGeobuf / PMTiles。

这条链路的取舍是：**SQL 负责"选行与算列"，矢量工具负责"改几何"，转换工具负责"换格式"**。把三者混用（例如用 SQL 做大范围缓冲、再用矢量工具做联表）通常更慢，也更难复现。

### 11.9.2 Model Builder 里的 DuckDB

Model Builder 的节点读的不是 SQL 文本，而是工具的参数；但部分工具**内部**需要 DuckDB 能力。宿主通过 `DuckDbCapability` 注入三件事：

```ts
// packages/processing/src/types.ts（节选）
export interface DuckDbCapability {
  ensureExtensions: (names: string[]) => Promise<void>;   // 例如 ["spatial", "h3"]
  registerGeoJson: (geojson: FeatureCollection) => Promise<DuckDbGeoJsonSource>;
  query: (sql: string) => Promise<Record<string, unknown>[]>;
}
```

`registerGeoJson` 返回的是一个 **`FROM` 可用的 SQL 表达式**，其几何列名为 `geom`；实现上它把 FeatureCollection 落成一个临时文件再 `ST_Read`。类型注释里有一条安全边界值得抄下来：

> Implementations MUST produce it from host-controlled input only … never embed user-supplied content here, or the consuming tool becomes a SQL-injection vector.

也就是说：`sql` 字段不能来自用户输入。工具作者要么用固定模板，要么把用户输入作为**参数绑定**，而不是字符串拼接。

### 11.9.3 两条往返路径

| 需求 | 路径 |
|------|------|
| 结果要改几何/字段 | 结果图层 `…` → **Materialize to editable layer** → GeoEditor / 属性表 |
| 查询图层要改 SQL | 结果图层 `…` → **Edit query in SQL Workspace** → 改完重跑，再 Add as layer |

---

## 11.10 性能与实践

### 11.10.1 让远程查询变快

| 手段 | 做法 | 原理 |
|------|------|------|
| **列裁剪** | 只 `SELECT` 需要的列，避免 `SELECT *` | Parquet 是列式存储，不读的列不产生 IO |
| **谓词下推** | 把过滤条件写进 `WHERE`，不要先全读再在客户端过滤 | 读取器用 row group 统计跳过不匹配的数据块 |
| **先 LIMIT 探测** | 首次交互用 `LIMIT 100`，确认列名与量级后再跑全量 | 少一次大查询的等待 |
| **优先列式 + 索引格式** | GeoParquet（列式）、FlatGeobuf（自带空间索引） | 都适合 Range 读取；Shapefile 需要整份下载 |
| **缩小时间/空间范围** | 用分区列或 bbox 条件先过滤 | 减少实际读取的字节数 |
| **少搬几何** | 聚合阶段不带 `geom` | 几何列通常是文件里最大的一列 |

### 11.10.2 让本地查询变快

1. **先过滤再联表**——把 `WHERE` 写进子查询/CTE，别让 `JOIN` 先做笛卡尔积；
2. **面面相交代价最高**，能先做 bbox 预筛就先做（例如先按经纬度范围裁剪）；
3. **避免在 WHERE 里对列做函数**（`WHERE ST_Area(geom) > x` 无法下推，先算成列再过滤）；
4. **结果不要顺手 Add as layer**——物化几十万要素会明显变慢，先聚合。

### 11.10.3 限制清单

| 限制 | 说明 |
|------|------|
| **单语句** | 一次只能跑一条语句；检测到中间分号会报 `Only a single SQL statement is supported…` |
| 结果网格 500 行 | 只影响显示，不影响导出与加图层 |
| 浏览器内存 | WASM 有上限，超大结果集先聚合 |
| 单线程 | WASM 版本不是多线程分析引擎 |
| CORS | 远程桶必须允许跨域 |
| 私有 S3 需单文件 | 预签名不支持通配 |
| `gs://`/`az://` 仅公开 | 不支持凭据 |
| PostGIS 读不了远程文件 | 只能查已注册表 |
| Sedona 浏览器限 5 万要素/层 | 超出请装 `sedona` extra 用 sidecar |
| Sedona 浏览器不能按名引用属性 | 属性 SQL 需 sidecar |
| `ST_Read` 格式取决于构建 | 用 `ST_Drivers()` 确认 |

---

## 11.11 常见错误与排查

| 现象 | 原因 | 处理 |
|------|------|------|
| `Only a single SQL statement is supported…` | 语句中间有分号，或粘了两条语句 | 拆成两次运行；结尾分号是允许的 |
| `Catalog Error: Table with name X does not exist` | 表名不对：中文图层名被改写、重名加了 `_2`、或图层没有 GeoJSON | 在 **Queryable layers** 里核对；命名规则见 11.3 |
| `Binder Error: Referenced column "X" not found` | 列名大小写/拼写；或 Sedona 浏览器引擎不支持属性列 | 用 `DESCRIBE` 看真实列名；Sedona 换 sidecar |
| `stoi: no conversion` | WASM 里的 httpfs 在部分服务器上失败 | 工作区会自动重建实例重试一次；仍失败就改用 `ST_Read` 或换数据源 |
| 浏览器报 CORS | 桶未允许跨域 | 配 `Access-Control-Allow-Origin`；或改用同源代理 |
| `HTTP 403` / `404` | 私有桶未配连接、路径写错、预签名不支持通配 | 配 **Settings → Cloud Storage**；指名单个文件 |
| Sedona 报超过要素上限 | 浏览器引擎单层 5 万上限 | 装 `sedona` extra 用 sidecar，或先在 SQL 里过滤 |
| `ST_Transform` 报错 | 构建不带该 CRS 的 PROJ 数据 | 先转成 4326 再导入，或用矢量工具的重投影 |
| 结果没有几何、无法 Add as layer | 查询没选几何列 | 把 `geom`（Sedona 是 `geometry`）加进 SELECT |
| 加图层后要素"少了" | 结果被 `LIMIT` 截断 | 去掉 LIMIT 重跑；网格的 500 行限制不影响加图层 |

> **提示**：出错时先把错误原文贴到 **History** 里对照上一条能跑的语句——SQL 工作区里 90% 的报错是表名/列名/引擎三者之一不匹配。

---

## 11.12 本章小结

1. **SQL 工作区停靠底部**，左编辑器右结果；`Ctrl`/`Cmd`+`Enter` 运行，`Tab`/`Ctrl`+`Space` 补全。
2. **三种引擎**：DuckDB（默认，能读文件与 URL）、PostGIS/PGlite（完整 PostGIS 语法，首次约 19 MB，不能读远程）、Apache Sedona（浏览器 CereusDB 限 5 万要素，桌面可走 sidecar）。
3. **表名由图层名推导**：小写、非字母数字压成 `_`、数字开头或保留字加 `t_`、空名用 `layer_<id>`、重名加 `_2`。中文图层名会被改写，务必看 **Queryable layers**。
4. **表是每次查询重建的 TEMP TABLE**（`ST_Read` 注册的 GeoJSON 文件），所以永远反映当前图层；注册时剥离 `OGC_FID`。
5. **几何列**：DuckDB/PostGIS 是 `geom`，Sedona 是 `geometry`。
6. **裸 URL 自动包裹 reader**（parquet/csv/json/ST_Read 四类），远程按 **HTTP Range** 流式读取，`directIO` 强制不整份缓冲。
7. **云 URL 透明改写**：`s3://`→`https://bucket.s3.amazonaws.com`、`gs://`→`storage.googleapis.com`、`az://`→`blob.core.windows.net`；私有 S3 走预签名且不支持通配。
8. **空间函数**：`ST_Read`、`ST_AsGeoJSON`、`ST_Area`、`ST_Area_Spheroid`+`ST_FlipCoordinates`、`ST_Centroid`、`ST_Buffer`、`ST_Intersects`、`ST_Intersection`、`ST_Transform`、`ST_MakeValid`、`ST_GeomFromText`。
9. **经纬度上的 `ST_Area` 是平方度**；要平方米用球面函数，不要直接上报。
10. **结果四条去向**：Add as layer（物化）、Add as query layer（DuckDB 活查询）、Export CSV、Export GeoParquet（需几何）；网格只显示 500 行，导出与加图层用全量。
11. **与 Processing / Model Builder 的接口**是 `DuckDbCapability`（`ensureExtensions` / `registerGeoJson` / `query`），`registerGeoJson` 返回的 SQL 片段**绝不能拼接用户输入**。
12. **性能靠列裁剪与谓词下推**：只选需要的列、把过滤写进 `WHERE`、先 `LIMIT` 探测、聚合时不带几何。

---

## 11.13 实践练习

1. **侦察与直查**：对 `https://data.source.coop/giswqs/opengeos/countries.parquet` 先跑 `DESCRIBE`，记录全部列名与类型；再写一条只返回 `NAME`、`CONTINENT` 与 `geom` 的查询，用 **Add as layer** 加入地图，并说明为什么这条查询比 `SELECT *` 更快。

2. **面积单位**：对同一批国家分别用 `ST_Area(geom)` 与 `ST_Area_Spheroid(ST_FlipCoordinates(geom)) / 1e6` 计算并排序，比较两个排名的差异；解释为什么单位错不影响"排序"却会毁掉"上报"。

3. **两图层空间联表**：加载一个点图层与一个面图层，用 `ST_Intersects` 做联表并 `GROUP BY` 统计每个面里的点数；把结果 **Add as layer**，再用属性表核对其中一行的计数与地图上的点是否一致。

4. **引擎对比**：把第 3 题的查询分别切到 **PostGIS** 与 **Apache Sedona** 重跑（注意几何列名与 Sedona 的属性列限制），记录三条各自的报错或结果差异，并写出你会为哪类任务选哪个引擎。

5. **云 URL 与私有桶**：用公开桶跑一条 `read_parquet('s3://…')`，再试着用通配符读同一个私有桶目录，记录两者差别；说明为什么预签名不支持 glob。

6. **活查询图层**：用 **Add as query layer** 加一个带 `WHERE` 条件的查询图层，然后修改源图层里某个要素的属性并保存，从 Layers 面板刷新该查询图层，确认结果跟着变化；再对比 **Add as layer** 的结果是否变化，并解释两者的生命周期差别。

---

**延伸阅读**

- 仓库文档：`docs/user-guide/sql-workspace.md`、`docs/tutorials/spatial-sql.md`、`docs/architecture.md`（DuckDB 小节）、`docs/tutorials/source-code-deep-dive-zh.md`（第 2 节）
- 源码：`apps/geolibre-desktop/src/lib/{sql-workspace,sql-table-names,sql-cloud-urls,pglite-sql,pglite-workspace,sedona-workspace}.ts`、`apps/geolibre-desktop/src/components/panels/SqlWorkspacePanel.tsx`、`packages/processing/src/types.ts`
- 相关章节：[第05章 数据添加与格式支持](https://znlgis.github.io/gis/tutorial/GeoLibre/第05章-数据添加与格式支持/)、[第09章 坐标系统、投影与测量](https://znlgis.github.io/gis/tutorial/GeoLibre/第09章-坐标系统投影与测量/)、[第10章 属性表、数据编辑与字段采集](https://znlgis.github.io/gis/tutorial/GeoLibre/第10章-属性表数据编辑与字段采集/)、[第12章 地理处理工具箱](https://znlgis.github.io/gis/tutorial/GeoLibre/第12章-地理处理工具箱/)

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/第10章-属性表数据编辑与字段采集/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/第12章-地理处理工具箱/" class="chapter-nav__next">下一章 →</a>
</div>
