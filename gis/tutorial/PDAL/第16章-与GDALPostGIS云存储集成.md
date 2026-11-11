---
layout: default
title: 第16章 - 与 GDAL/PostGIS/云存储集成
---

# 第16章 - 与 GDAL/PostGIS/云存储集成

点云很少单独存在。一个典型的生产链条是：机载 LiDAR 落成 LAZ → 与影像或矢量叠加做质检 → 分类与 DEM 进 PostGIS/GeoServer → 原始数据放 S3 供 Web 端按需取数。PDAL 在链条里是"处理中枢"，它的集成能力决定了这条链能不能跑通。

PDAL 的集成只有三个入口，理解它们就够用了：

| 入口 | 背后技术 | 能做什么 |
|---|---|---|
| GDAL VSI | GDAL 虚拟文件系统 | 直接读 `http(s)://`、`s3://`、`gs://`、`vsi*://` 路径，按需 Range 请求 |
| GDAL 栅格/矢量 | `readers.gdal`、`writers.gdal`、`filters.overlay`、`filters.colorization` | 点云与栅格互转、用矢量属性给点打标签 |
| PostgreSQL Pointcloud | `readers.pgpointcloud`、`writers.pgpointcloud` | 点云分块入 PostGIS，按空间条件查询 |

本章按这三个入口讲，重点在参数与坑：pgpointcloud 的 patch 大小、`srid` 不自动重投影、云路径的凭证配置。

## 16.1 云存储：靠 GDAL VSI，不靠 PDAL 自己

### 16.1.1 直接给 URL

PDAL 的 reader 支持把 URL 当文件名，PDAL 文档里原话是"fetching only the portion that is needed for processing"——按需只取用到的那一段：

```bash
pdal info https://github.com/PDAL/data/raw/refs/heads/main/autzen/autzen-classified.copc.laz
```

对 COPC 这样的索引化格式效果最明显：`pdal info --summary` 只读头信息和根节点，不下载整个文件。对普通 LAZ 则等价于"边下边解压"，节省的是内存不是流量。

支持的协议前缀（由 GDAL VSI 提供）：

| 前缀 | 说明 | 典型用途 |
|---|---|---|
| `http://` / `https://` | HTTP(S) Range 请求 | 公开数据集、CDN |
| `/vsicurl/https://...` | 显式走 vsicurl | 需要控制缓存时 |
| `s3://bucket/key` | AWS S3 | 需要凭证；也支持 `/vsis3/` |
| `gs://bucket/key` | Google Cloud Storage | 需要凭证 |
| `az://container/blob` | Azure Blob | 需要凭证 |

### 16.1.2 凭证与环境变量

GDAL 的 S3 驱动读环境变量或 `~/.aws/credentials`；PDAL 不额外封装。常用的几个：

```bash
# AWS
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=eu-central-1         # 部分版本用 AWS_DEFAULT_REGION

# 匿名访问公开桶
export AWS_NO_SIGN_REQUEST=YES

# GCS
export GS_ACCESS_KEY_ID=...
export GS_SECRET_ACCESS_KEY=...
```

Windows PowerShell 对应 `$env:AWS_ACCESS_KEY_ID = "..."`。匿名桶要显式关签名，否则 GDAL 会尝试用空凭证签名并返回 403。

### 16.1.3 云路径的三个坑

**坑一：`filename` 是全路径，不是目录。** 与 EPT 一样，`.copc.laz` 或单个 `.laz` 的完整 URL 才能读，给 `s3://bucket/prefix/` 会失败。

**坑二：重定向与签名。** 部分对象存储返回 302 到另一个域名，GDAL 默认跟随重定向，但会丢掉签名头；表现为 `403 AccessDenied`。解决方式是改用对应厂商的原生协议（`s3://` 而非 `https://`），或在网关侧配好直连。

**坑三：计费按请求数。** Range 请求不是免费的。用 `pdal info --summary` 探测一个 100 GB 的 COPC 只花几个请求，但 `pdal translate` 全量读取会产生大量 Range 请求。批量处理前先把数据拉到本地或同区域计算节点。

## 16.2 PostGIS：pgpointcloud 扩展

### 16.2.1 存储模型

PostgreSQL Pointcloud 扩展把点云存成"patch"：表里每行是一个 patch，一个 patch 包含若干空间邻近的点。查询可以只扫相关 patch，这是它比"把点云存成 BLOB"强的地方。

关键约束（官方文档明确说明）：patch 应小于 PostgreSQL 的页大小 **8 KB**，对多数 LiDAR 数据相当于 **每个 patch 400–600 点**。所以写库前必须先用 `filters.chipper` 切块，`capacity` 取 400：

```json
[
  { "type": "readers.las", "filename": "input.las", "spatialreference": "EPSG:26916" },
  { "type": "filters.chipper", "capacity": 400 },
  {
    "type": "writers.pgpointcloud",
    "connection": "host='localhost' dbname='lidar' user='pramsey'",
    "table": "example",
    "compression": "dimensional",
    "srid": "26916"
  }
]
```

### 16.2.2 writers.pgpointcloud 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `connection` | 必填 | libpq 连接串，`host=... dbname=... user=...` |
| `table` | 必填 | 目标表（不存在会创建） |
| `schema` | `public` | 目标 schema |
| `column` | `pa` | 存放 patch 的列名 |
| `compression` | `"dimensional"` | `none` / `dimensional`（按维度动态压缩）/ `lazperf`（LAZ 压缩） |
| `overwrite` | `false` | `true` 先 DROP 表再写；`false` 追加 |
| `srid` | **4326** | 写入 schema 的 EPSG 代码 |
| `pcid` | 0 | 复用已有 PCID（点云 schema 标识） |
| `pre_sql` / `post_sql` | 无 | 写入前/后执行的 SQL，可给文件名 |
| `scale_x/y/z`、`offset_x/y/z` | 无 | 指定后坐标按整数压缩存储 |
| `output_dims` | 无 | 限制写入的维度 |

两个必须注意的行为：

**不自动重投影。** `srid` 只是写进 schema 的声明，不会改变坐标值。文档原话是 "PDAL makes no attempt to reproject data to your specified srid"。坐标系不对就先用 `filters.reprojection` 转，再写 `srid`。

**overwrite 默认 false。** 同一份数据跑两遍会写进同一张表，产生重复 patch。ETL 里要么设 `overwrite: true`，要么在 `pre_sql` 里先 `DELETE FROM ... WHERE`。

### 16.2.3 readers.pgpointcloud 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `connection` | 必填 | 连接串 |
| `table` | 必填 | 源表 |
| `schema` | `public` | 源 schema |
| `column` | `pa` | patch 列 |
| `where` | 无 | SQL 条件，可用 `PC_Intersects`、`PC_Tile` 等扩展函数 |
| `spatialreference` | 无 | 覆盖 SRS 声明 |

空间查询示例（官方文档原文）：

```json
[
  {
    "type": "readers.pgpointcloud",
    "connection": "dbname='lidar' user='user'",
    "table": "lidar",
    "column": "pa",
    "spatialreference": "EPSG:26910",
    "where": "PC_Intersects(pa, ST_MakeEnvelope(560037.36, 5114846.45, 562667.31, 5118943.24, 26910))"
  },
  { "type": "writers.text", "filename": "output.txt" }
]
```

`where` 里能用的函数由扩展提供，要用 `PC_Intersects` 而不是普通的 `ST_Intersects`——后者对 patch 列不生效。

## 16.3 与栅格/矢量互操作

### 16.3.1 用矢量给点打标签：filters.overlay

质检里常见需求：给定行政边界或地块多边形，给落在其中的点打上一列属性。`filters.overlay` 正是这个：

```json
[
  "input.las",
  {
    "type": "filters.overlay",
    "datasource": "districts.geojson",
    "column": "district_id",
    "dimension": "UserData"
  },
  { "type": "writers.las", "filename": "tagged.las", "extra_dims": "UserData" }
]
```

要点：目标维度必须已存在或先注册；`column` 是矢量属性列名；点在多边形内才赋值，多边形的坐标系必须与点云一致（PDAL 不会帮你转，也不会警告）。

### 16.3.2 点云与栅格

`writers.gdal`（第 10 章）把点云插值成 DEM；反过来 `readers.gdal` 把栅格读成点（每个像元一个点，维度来自波段）。两者配合可以做"用 DEM 校正点云高程再重算 DEM"的迭代，但要小心 `readers.gdal` 产生的点数 = 栅格像元数，一个 10000×10000 的 DEM 就是 1 亿点，直接进 pipeline 会爆内存。

`filters.colorization` 也是栅格集成：按点坐标从影像取 RGB 赋给点云。

## 16.4 端到端示例：一个完整的入库 ETL

把前面几节串起来：从对象存储读 COPC、重投影、切 patch、写 PostGIS，全程一条 pipeline。

```json
[
  {
    "type": "readers.copc",
    "filename": "s3://lidar-prod/2024/block-17.copc.laz",
    "resolution": 0.05
  },
  {
    "type": "filters.reprojection",
    "out_srs": "EPSG:32633",
    "error_on_failure": true
  },
  {
    "type": "filters.range",
    "limits": "Classification![7:7]"
  },
  {
    "type": "filters.chipper",
    "capacity": 400
  },
  {
    "type": "writers.pgpointcloud",
    "connection": "host='db.internal' dbname='lidar' user='etl' password='***'",
    "table": "block_17",
    "schema": "pointcloud",
    "column": "pa",
    "compression": "dimensional",
    "srid": "32633",
    "overwrite": true,
    "pre_sql": "DROP TABLE IF EXISTS pointcloud.block_17;",
    "post_sql": "CREATE INDEX ON pointcloud.block_17 USING gist (pa); ANALYZE pointcloud.block_17;"
  }
]
```

几个细节值得单独说：

- `resolution` 放在读端控制入库密度，避免把原始全精度数据塞进数据库；
- `error_on_failure: true` 让坐标异常的点直接失败，而不是静默少几个点（第 11 章的结论）；
- `overwrite: true` 与 `pre_sql` 的 DROP 效果相同，二选一即可；保留 `pre_sql` 是因为后续还要建其他索引；
- `post_sql` 里建 GiST 索引是必须的，否则 `PC_Intersects` 空间查询会退化成全表扫描。

## 16.5 云访问的性能开关

GDAL 的 vsicurl 有几个环境变量直接决定云读取表现，PDAL 不封装它们，但完全受其影响：

| 变量 | 作用 | 建议 |
|---|---|---|
| `VSI_CACHE` | 关闭/开启 VSI 层缓存 | 单文件顺序读设 `FALSE` 可省内存；随机读设默认 |
| `CPL_VSIL_CURL_CHUNK_SIZE` | 单次 Range 请求的字节数 | 小文件保持默认，大文件可调大以减少请求数 |
| `CPL_VSIL_CURL_CACHE_SIZE` | curl 层缓存字节数 | 默认 16 MB；批量处理同一文件时可调大 |
| `GDAL_HTTP_TIMEOUT` | 单请求超时（秒） | 跨洲链路调到 30–60 |
| `GDAL_DISABLE_READDIR_ON_OPEN` | 打开文件时是否列目录 | 对象存储设 `EMPTY_DIR` 可显著减少请求 |

最后一项在 S3 上影响很大：默认行为会在打开文件时尝试列举同前缀对象，一次打开可能触发几十个请求。设成：

```bash
export GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
```

批量 `pdal translate` 一万个文件时，这一项能把总请求数降下来一个量级。

## 16.6 排错清单


| 现象 | 原因 | 修法 |
|---|---|---|
| `403 AccessDenied` 读公开 S3 桶 | 仍在尝试签名 | 设 `AWS_NO_SIGN_REQUEST=YES` |
| `Couldn't create ... with driver` | 对应 GDAL 插件缺失（如 `readers.gdal`） | 换带 GDAL 的 PDAL 发行版（conda 版默认带） |
| 写库后查询很慢 | patch 过大，单行跨多页 | 前置 `filters.chipper`，`capacity` 取 400–600 |
| 表里出现重复数据 | `overwrite` 默认 `false` | 设 `true` 或 `pre_sql` 清表 |
| 入库后坐标系不对 | `srid` 只是声明 | 先 `filters.reprojection` 再写库 |
| `column "pa" does not exist` | 目标列名不是默认 `pa` | 显式传 `column` |
| `PC_Intersects` 报函数不存在 | 扩展没装或不在当前 schema 的 search_path | `CREATE EXTENSION pointcloud;` 并检查 `search_path` |
| 云路径读一半失败 | 重定向丢签名或网络抖动 | 改用原生协议前缀；`ignore_unreadable` 不适用于单文件读取 |

## 16.7 生产建议

**入库前统一坐标系。** PostGIS 里同一张表混多个 SRID 是灾难。用 `filters.reprojection` 统一到一个投影，`srid` 与该投影一致，之后所有空间查询才可靠。

**patch 大小的经验值比参数调优重要。** `chipper capacity=400` 加默认 `dimensional` 压缩，是多数 LiDAR 数据的稳定起点；点格式很大（含 RGB、多回波）时可以降到 300。

**云上分层。** 原始 LAZ/COPC 放对象存储，供按需读取与再处理；入库的是经过分类、抽稀的结果。不要把原始点云整份塞进 PostGIS——数据库的备份、迁移、升级成本会随体积线性上升。

**凭证走环境变量或 IAM 角色。** 不要写进 pipeline JSON，pipeline 文件通常要进版本库。K8s 里用 service account 绑定 IAM 角色，避免长周期密钥。

## 16.8 本章小结

| 主题 | 结论 |
|---|---|
| 云读取 | 直接给 URL，走 GDAL VSI；COPC/EPT 只取需要的部分 |
| 协议 | `http(s)://`、`s3://`、`gs://`、`az://`；匿名桶需 `AWS_NO_SIGN_REQUEST=YES` |
| pgpointcloud 写 | 必须前置 `filters.chipper`（每 patch 400–600 点 ≈ 8 KB 页） |
| pgpointcloud 参数 | `schema`=public、`column`=pa、`compression`=dimensional、`overwrite`=false、`srid`=4326 |
| 重投影 | `srid` 只声明不转换，坐标得自己转 |
| 查询 | `where` 里用 `PC_Intersects`/`PC_Tile` 等扩展函数 |
| 矢量叠加 | `filters.overlay` 给点打属性，坐标系必须预先一致 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第15章-点云分割聚类与特征提取/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第17章-点云可视化与三维发布/" class="chapter-nav__next">下一章 →</a>
</div>
