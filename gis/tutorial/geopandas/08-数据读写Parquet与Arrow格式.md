---
layout: default
title: "第8章：数据读写——Parquet 与 Arrow 格式"
---

# 第8章：数据读写——Parquet 与 Arrow 格式

随着地理空间数据量的快速增长，传统的 Shapefile 和 GeoJSON 格式在性能上越来越难以满足需求。GeoParquet 和 GeoArrow 作为新一代地理空间数据格式，提供了卓越的读写性能和存储效率。本章将深入介绍这些现代格式在 GeoPandas 中的使用方法。

---

## 8.1 什么是 GeoParquet

### 8.1.1 Apache Parquet 简介

Apache Parquet 是一种开源的**列式存储**文件格式，最初由 Twitter 和 Cloudera 为 Hadoop 生态系统设计。它具有以下核心特性：

| 特性 | 说明 |
|------|------|
| **列式存储** | 数据按列而非按行存储，适合分析查询 |
| **高效压缩** | 同列数据类型相同，压缩率极高 |
| **编码优化** | 支持字典编码、RLE、Delta 等多种编码方式 |
| **Schema 嵌入** | 文件自带数据结构描述 |
| **分块读取** | 支持行组（Row Group）级别的随机访问 |
| **跨平台** | Java、Python、C++、Rust 等多语言支持 |

### 8.1.2 GeoParquet 的诞生

GeoParquet 是 Apache Parquet 的**地理空间扩展**，它在标准 Parquet 文件的元数据中添加了地理空间相关的信息，使 Parquet 能够存储和管理地理空间数据。

```
┌─────────────────────────────────────────┐
│           GeoParquet 文件结构            │
├─────────────────────────────────────────┤
│  Parquet 文件头                         │
├─────────────────────────────────────────┤
│  Row Group 1                            │
│    ├── Column: name  (字符串)           │
│    ├── Column: population (整数)        │
│    └── Column: geometry (WKB/GeoArrow)  │
├─────────────────────────────────────────┤
│  Row Group 2                            │
│    ├── ...                              │
├─────────────────────────────────────────┤
│  Parquet 文件尾（含元数据）             │
│    └── geo 元数据（CRS、几何类型等）    │
└─────────────────────────────────────────┘
```

### 8.1.3 GeoParquet 的核心优势

与传统格式相比，GeoParquet 具有显著优势：

| 优势 | 详细说明 |
|------|---------|
| **读写速度快** | 列式存储 + 高效编码，比 Shapefile 快 5-10 倍 |
| **文件体积小** | 内置压缩，通常比 GeoJSON 小 10-50 倍 |
| **列选择读取** | 只读取需要的列，减少 IO 和内存 |
| **类型丰富** | 支持各种数据类型，无 Shapefile 的限制 |
| **云原生** | 支持远程读取，适合云存储 |
| **生态丰富** | DuckDB、BigQuery、Spark 等均支持 |

```python
import geopandas as gpd

# GeoParquet 的读写非常简洁
# 写入
gdf.to_parquet("data.parquet")

# 读取
gdf = gpd.read_parquet("data.parquet")
```

---

## 8.2 GeoParquet 规范

### 8.2.1 元数据规范

GeoParquet 通过在 Parquet 文件的元数据中添加一个名为 `geo` 的 JSON 键来存储地理空间信息：

```json
{
  "version": "1.1.0",
  "primary_column": "geometry",
  "columns": {
    "geometry": {
      "encoding": "WKB",
      "geometry_types": ["Polygon", "MultiPolygon"],
      "crs": {
        "type": "GeographicCRS",
        "name": "WGS 84",
        "id": {"authority": "EPSG", "code": 4326}
      },
      "bbox": [73.5, 18.2, 135.1, 53.6],
      "covering": {
        "bbox": {
          "xmin": ["bbox", "xmin"],
          "ymin": ["bbox", "ymin"],
          "xmax": ["bbox", "xmax"],
          "ymax": ["bbox", "ymax"]
        }
      }
    }
  }
}
```

### 8.2.2 元数据字段说明

| 字段 | 说明 |
|------|------|
| `version` | GeoParquet 规范版本 |
| `primary_column` | 主几何列的名称 |
| `encoding` | 几何编码方式（WKB 或 GeoArrow） |
| `geometry_types` | 几何类型列表 |
| `crs` | 坐标参考系统（PROJJSON 格式） |
| `bbox` | 整体边界框 [xmin, ymin, xmax, ymax] |
| `covering` | 覆盖列（用于空间过滤优化） |

### 8.2.3 版本演进

| 版本 | 发布时间 | 主要变化 |
|------|---------|---------|
| 0.4.0 | 2022 | 初始规范草案 |
| 1.0.0 | 2023 | 首个稳定版本，WKB 编码标准化 |
| 1.1.0 | 2024 | 支持 GeoArrow 原生编码、covering 列 |

```python
import geopandas as gpd
import pyarrow.parquet as pq

# 查看 GeoParquet 的元数据
parquet_file = pq.ParquetFile("data.parquet")
metadata = parquet_file.schema_arrow.metadata

# 解析 geo 元数据
import json
geo_metadata = json.loads(metadata[b"geo"])
print(json.dumps(geo_metadata, indent=2))
```

---

## 8.3 read_parquet() 详解

### 8.3.1 基本语法

```python
geopandas.read_parquet(
    path,               # 文件路径（本地或远程）
    columns=None,       # 要读取的列
    storage_options=None,  # 存储选项（用于远程文件）
    bbox=None,          # 边界框过滤
    **kwargs            # 传递给底层引擎的参数
)
```

### 8.3.2 基本读取

```python
import geopandas as gpd

# 读取本地文件
gdf = gpd.read_parquet("data.parquet")
print(f"行数: {len(gdf)}")
print(f"列数: {len(gdf.columns)}")
print(f"CRS: {gdf.crs}")
print(f"几何类型: {gdf.geom_type.unique()}")
```

### 8.3.3 列选择 — columns 参数

列选择是 Parquet 格式的核心优势之一。由于列式存储，只读取需要的列可以显著减少 IO 和内存使用：

```python
# 只读取特定列
gdf = gpd.read_parquet(
    "large_dataset.parquet",
    columns=["name", "population", "geometry"]
)

# 对比全量读取
# 如果文件有 50 列，只读 3 列可以减少约 94% 的读取量

# 查看文件中的所有列（不读取数据）
import pyarrow.parquet as pq
schema = pq.read_schema("large_dataset.parquet")
print("可用列:")
for field in schema:
    print(f"  {field.name}: {field.type}")
```

### 8.3.4 空间过滤 — bbox 参数

```python
# 使用边界框进行空间过滤
gdf = gpd.read_parquet(
    "china_pois.parquet",
    bbox=(115, 39, 117, 41)  # 北京周边
)
print(f"过滤后行数: {len(gdf)}")

# bbox 过滤利用 Parquet 的行组统计信息
# 可以跳过不在范围内的行组，大大提高性能
```

### 8.3.5 组合使用

```python
# 同时使用列选择和空间过滤
gdf = gpd.read_parquet(
    "nationwide_buildings.parquet",
    columns=["building_type", "area_sqm", "geometry"],
    bbox=(120, 30, 122, 32)  # 上海区域
)

# 这种组合使用可以极大地减少数据读取量
# 对于 TB 级别的数据集尤其有效
```

### 8.3.6 读取分区数据集

```python
# Parquet 数据集可以按目录分区
# 例如：
# data/
#   province=北京/
#     part-0.parquet
#   province=上海/
#     part-0.parquet
#   province=广东/
#     part-0.parquet

# 读取整个分区数据集
gdf = gpd.read_parquet("data/")

# 使用 PyArrow 的过滤功能
import pyarrow.parquet as pq
import pyarrow.dataset as ds

dataset = ds.dataset("data/", format="parquet")
table = dataset.to_table(
    filter=ds.field("province") == "北京"
)
gdf = gpd.GeoDataFrame.from_arrow(table)
```

---

## 8.4 to_parquet() 详解

### 8.4.1 基本语法

```python
GeoDataFrame.to_parquet(
    path,                   # 输出文件路径
    index=None,             # 是否包含索引
    compression="snappy",   # 压缩算法
    schema_version=None,    # GeoParquet 规范版本
    write_covering_bbox=None,  # 是否写入覆盖边界框
    geometry_encoding=None, # 几何编码方式
    **kwargs                # 传递给底层引擎的参数
)
```

### 8.4.2 基本写入

```python
import geopandas as gpd
from shapely.geometry import Point

# 创建示例数据
gdf = gpd.GeoDataFrame(
    {
        "name": ["北京", "上海", "广州"],
        "population": [2171, 2487, 1868],
        "province": ["北京市", "上海市", "广东省"]
    },
    geometry=[
        Point(116.407, 39.904),
        Point(121.474, 31.230),
        Point(113.264, 23.129)
    ],
    crs="EPSG:4326"
)

# 基本写入
gdf.to_parquet("cities.parquet")
```

### 8.4.3 压缩选项

Parquet 支持多种压缩算法，可以根据需求选择：

| 压缩算法 | 压缩率 | 速度 | 说明 |
|---------|--------|------|------|
| `snappy` | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 默认值，速度快，适合一般场景 |
| `gzip` | ⭐⭐⭐⭐ | ⭐⭐ | 压缩率高，但速度较慢 |
| `zstd` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 推荐，压缩率和速度的最佳平衡 |
| `lz4` | ⭐⭐ | ⭐⭐⭐⭐⭐ | 极快，适合需要极速读写的场景 |
| `brotli` | ⭐⭐⭐⭐⭐ | ⭐ | 最高压缩率，但速度最慢 |
| `None` | - | ⭐⭐⭐⭐⭐ | 不压缩 |

```python
# 使用不同的压缩算法
gdf.to_parquet("data_snappy.parquet", compression="snappy")  # 默认
gdf.to_parquet("data_zstd.parquet", compression="zstd")      # 推荐
gdf.to_parquet("data_gzip.parquet", compression="gzip")      # 高压缩
gdf.to_parquet("data_none.parquet", compression=None)        # 无压缩

# 比较文件大小
import os
for comp in ["snappy", "zstd", "gzip", None]:
    filename = f"data_{comp}.parquet"
    gdf.to_parquet(filename, compression=comp)
    size = os.path.getsize(filename)
    print(f"{str(comp):10s} → {size:,} bytes")
```

### 8.4.4 索引处理

```python
# 不写入索引（推荐，减少文件大小）
gdf.to_parquet("data.parquet", index=False)

# 写入索引
gdf.to_parquet("data.parquet", index=True)

# 自动判断（默认行为）
gdf.to_parquet("data.parquet")  # 如果索引有意义则写入
```

### 8.4.5 几何编码选择

```python
# WKB 编码（默认，兼容性最好）
gdf.to_parquet("data_wkb.parquet", geometry_encoding="WKB")

# GeoArrow 编码（更高效，需要 GeoParquet 1.1+）
gdf.to_parquet("data_geoarrow.parquet", geometry_encoding="geoarrow")
```

### 8.4.6 覆盖边界框

```python
# 写入覆盖边界框列（用于空间过滤优化）
gdf.to_parquet("data.parquet", write_covering_bbox=True)

# 这会在 Parquet 文件中额外添加 bbox 列
# 使得空间过滤查询可以利用 Parquet 的行组统计信息
# 极大地提升大数据集的空间查询性能
```

---

## 8.5 Apache Arrow Feather 格式

### 8.5.1 Feather 格式简介

Apache Arrow Feather（也称为 Arrow IPC 格式）是 Arrow 的原生序列化格式，特别适合在内存中进行数据交换。

| 特性 | Parquet | Feather |
|------|---------|---------|
| 设计目标 | 持久存储 | 内存映射 / 快速序列化 |
| 压缩 | 内置多种压缩 | 可选压缩 |
| 列选择读取 | 支持 | 支持 |
| 行组过滤 | 支持 | 不支持 |
| 读取速度 | 快 | 极快（接近内存速度） |
| 文件大小 | 较小 | 较大（无压缩时） |
| 适用场景 | 数据仓库、持久存储 | 进程间通信、临时缓存 |

### 8.5.2 read_feather() 读取

```python
import geopandas as gpd

# 基本读取
gdf = gpd.read_feather("data.feather")

# 列选择
gdf = gpd.read_feather(
    "data.feather",
    columns=["name", "geometry"]
)
```

### 8.5.3 to_feather() 写入

```python
# 基本写入
gdf.to_feather("data.feather")

# 带压缩
gdf.to_feather("data.feather", compression="zstd")
gdf.to_feather("data.feather", compression="lz4")
gdf.to_feather("data.feather", compression="uncompressed")
```

### 8.5.4 使用场景

```python
# 场景1：中间结果缓存
# 在复杂的分析流程中，将中间结果保存为 Feather 以加速后续步骤
gdf_processed = complex_spatial_analysis(gdf_raw)
gdf_processed.to_feather("cache/step1_result.feather")

# 后续步骤直接读取（极快）
gdf_cached = gpd.read_feather("cache/step1_result.feather")

# 场景2：Python 进程间数据传递
# 进程 A 写入
gdf.to_feather("shared/data.feather")
# 进程 B 读取
gdf = gpd.read_feather("shared/data.feather")
```

---

## 8.6 GeoArrow 编码

### 8.6.1 什么是 GeoArrow

GeoArrow 是一种在 Apache Arrow 列式内存格式中表示地理空间数据的规范。与传统的 WKB（Well-Known Binary）编码不同，GeoArrow 使用**原生的 Arrow 数组结构**来存储几何坐标。

### 8.6.2 WKB vs GeoArrow

```
WKB 编码：每个几何体是一个独立的二进制 blob
┌──────────────────────────────────────┐
│ Binary Column                        │
│  [WKB_blob_1, WKB_blob_2, ...]     │
│  每个 blob 需要单独解析              │
└──────────────────────────────────────┘

GeoArrow 编码：坐标直接存储在 Arrow 数组中
┌──────────────────────────────────────┐
│ Struct Column                        │
│  x: [116.4, 121.5, 113.3, ...]     │
│  y: [39.9, 31.2, 23.1, ...]        │
│  坐标可以直接访问，无需解析          │
└──────────────────────────────────────┘
```

### 8.6.3 GeoArrow 编码类型

不同的几何类型使用不同的 Arrow 数据结构：

| 几何类型 | Arrow 结构 | 说明 |
|---------|-----------|------|
| **Point** | `Struct<x: double, y: double>` | 固定结构体 |
| **LineString** | `List<Struct<x: double, y: double>>` | 点的列表 |
| **Polygon** | `List<List<Struct<x: double, y: double>>>` | 环的列表（环是点的列表） |
| **MultiPoint** | `List<Struct<x: double, y: double>>` | 点的列表 |
| **MultiLineString** | `List<List<Struct<x: double, y: double>>>` | 线的列表 |
| **MultiPolygon** | `List<List<List<Struct<x: double, y: double>>>>` | 多边形的列表 |

```python
import geopandas as gpd

# 使用 GeoArrow 编码写入 Parquet
gdf.to_parquet("data_geoarrow.parquet", geometry_encoding="geoarrow")

# 读取时自动识别编码方式
gdf = gpd.read_parquet("data_geoarrow.parquet")
```

### 8.6.4 GeoArrow 的性能优势

```python
import geopandas as gpd
import time

# 创建大数据集进行性能测试
import numpy as np
from shapely.geometry import Point

n = 1_000_000
gdf_large = gpd.GeoDataFrame(
    {"value": np.random.randn(n)},
    geometry=[Point(x, y) for x, y in
              zip(np.random.uniform(73, 135, n),
                  np.random.uniform(18, 54, n))],
    crs="EPSG:4326"
)

# WKB 编码写入
start = time.time()
gdf_large.to_parquet("test_wkb.parquet", geometry_encoding="WKB")
print(f"WKB 写入: {time.time() - start:.2f}s")

# GeoArrow 编码写入
start = time.time()
gdf_large.to_parquet("test_geoarrow.parquet", geometry_encoding="geoarrow")
print(f"GeoArrow 写入: {time.time() - start:.2f}s")

# 对比读取速度
start = time.time()
_ = gpd.read_parquet("test_wkb.parquet")
print(f"WKB 读取: {time.time() - start:.2f}s")

start = time.time()
_ = gpd.read_parquet("test_geoarrow.parquet")
print(f"GeoArrow 读取: {time.time() - start:.2f}s")
```

典型结果（具体数值因硬件而异）：

```
WKB 写入: 3.45s
GeoArrow 写入: 1.82s
WKB 读取: 2.13s
GeoArrow 读取: 0.95s
```

---

## 8.7 WKB 编码回退机制

### 8.7.1 什么时候使用 WKB

在某些情况下，GeoArrow 编码无法使用，GeoPandas 会自动回退到 WKB 编码：

| 情况 | 说明 |
|------|------|
| 混合几何类型 | 同一列中包含 Point 和 Polygon 等不同类型 |
| 旧版软件 | 目标软件不支持 GeoArrow |
| 空几何 | 某些空几何的处理方式不同 |
| 三维几何 | Z 和 M 坐标的支持取决于实现 |

### 8.7.2 WKB 编码的工作方式

```python
# WKB 编码将每个几何体序列化为二进制格式
from shapely import wkb
from shapely.geometry import Point

point = Point(116.4, 39.9)
wkb_bytes = wkb.dumps(point)
print(f"WKB 字节数: {len(wkb_bytes)}")
print(f"WKB 内容: {wkb_bytes.hex()}")

# 在 Parquet 中，WKB 存储为 Binary 类型的列
# 每个几何体是一个独立的二进制 blob
```

### 8.7.3 显式控制编码

```python
# 显式使用 WKB 编码（确保最大兼容性）
gdf.to_parquet("compatible.parquet", geometry_encoding="WKB")

# 显式使用 GeoArrow 编码（更高性能）
# 如果几何类型不一致，会抛出错误
try:
    gdf_mixed.to_parquet("data.parquet", geometry_encoding="geoarrow")
except ValueError as e:
    print(f"GeoArrow 编码失败: {e}")
    # 回退到 WKB
    gdf_mixed.to_parquet("data.parquet", geometry_encoding="WKB")
```

---

## 8.8 Arrow Table 互操作

### 8.8.1 to_arrow() — 转换为 Arrow Table

```python
import geopandas as gpd
from shapely.geometry import Point

gdf = gpd.GeoDataFrame(
    {"name": ["北京", "上海"], "pop": [2171, 2487]},
    geometry=[Point(116.4, 39.9), Point(121.5, 31.2)],
    crs="EPSG:4326"
)

# 转换为 Arrow Table
table = gdf.to_arrow()
print(type(table))
# <class 'pyarrow.lib.Table'>

print(table.schema)
# name: string
# pop: int64
# geometry: binary  (WKB 编码)
# -- schema metadata --
# geo: '{"version":"1.1.0",...}'

# 使用 GeoArrow 编码
table_geoarrow = gdf.to_arrow(geometry_encoding="geoarrow")
print(table_geoarrow.schema)
# geometry 列会使用 struct 或 list 类型
```

### 8.8.2 from_arrow() — 从 Arrow Table 创建

```python
import geopandas as gpd
import pyarrow as pa

# 从 Arrow Table 创建 GeoDataFrame
# （Arrow Table 必须包含 GeoParquet 兼容的 geo 元数据）
gdf = gpd.GeoDataFrame.from_arrow(table)

print(type(gdf))
# <class 'geopandas.geodataframe.GeoDataFrame'>
print(gdf.crs)
# EPSG:4326
```

### 8.8.3 与 DuckDB 集成

```python
import duckdb
import geopandas as gpd

# DuckDB 原生支持 GeoParquet
con = duckdb.connect()

# 安装并加载空间扩展
con.install_extension("spatial")
con.load_extension("spatial")

# 直接在 GeoParquet 上执行 SQL 查询
result = con.execute("""
    SELECT name, population, ST_AsText(geometry) as geom_wkt
    FROM read_parquet('cities.parquet')
    WHERE population > 10000000
""").fetchdf()

# 从 DuckDB 结果创建 GeoDataFrame
gdf = con.execute("""
    SELECT *
    FROM read_parquet('cities.parquet')
    WHERE ST_Within(
        geometry,
        ST_GeomFromText('POLYGON((115 39, 117 39, 117 41, 115 41, 115 39))')
    )
""").fetch_arrow_table()

gdf = gpd.GeoDataFrame.from_arrow(gdf)
```

### 8.8.4 与 Polars 集成

```python
import polars as pl
import geopandas as gpd

# Polars 可以高效读取 Parquet
df_polars = pl.read_parquet("data.parquet")

# 转换为 Arrow Table，再转为 GeoDataFrame
arrow_table = df_polars.to_arrow()
# 注意：需要确保 Arrow Table 包含正确的 geo 元数据
```

---

## 8.9 性能对比

### 8.9.1 读写速度对比

以下是不同格式在典型数据集上的性能对比（参考值，实际可能因数据和硬件而异）：

```python
import geopandas as gpd
import time
import os

def benchmark_format(gdf, format_name, write_func, read_func, filepath):
    """格式性能基准测试"""
    # 写入测试
    start = time.time()
    write_func(gdf, filepath)
    write_time = time.time() - start

    # 文件大小
    if os.path.isfile(filepath):
        file_size = os.path.getsize(filepath) / (1024 * 1024)  # MB
    else:
        # 目录（如 Shapefile）
        total = sum(
            os.path.getsize(os.path.join(dirpath, f))
            for dirpath, _, filenames in os.walk(filepath)
            for f in filenames
        )
        file_size = total / (1024 * 1024)

    # 读取测试
    start = time.time()
    _ = read_func(filepath)
    read_time = time.time() - start

    print(f"{format_name:15s} | "
          f"写入: {write_time:6.2f}s | "
          f"读取: {read_time:6.2f}s | "
          f"大小: {file_size:8.2f} MB")

# 运行基准测试
# benchmark_format(gdf, "Shapefile",
#     lambda g, p: g.to_file(p),
#     lambda p: gpd.read_file(p),
#     "benchmark.shp")
# benchmark_format(gdf, "GeoJSON",
#     lambda g, p: g.to_file(p, driver="GeoJSON"),
#     lambda p: gpd.read_file(p),
#     "benchmark.geojson")
# ... 等等
```

### 8.9.2 典型性能数据

以 100 万个点要素（含 10 个属性列）为例的参考数据：

| 格式 | 写入时间 | 读取时间 | 文件大小 |
|------|---------|---------|---------|
| GeoParquet (Snappy) | 1.5 s | 0.8 s | 45 MB |
| GeoParquet (Zstd) | 2.0 s | 0.9 s | 35 MB |
| Feather | 1.0 s | 0.5 s | 70 MB |
| Shapefile | 8.0 s | 5.0 s | 120 MB |
| GeoPackage | 12.0 s | 6.0 s | 90 MB |
| GeoJSON | 25.0 s | 15.0 s | 350 MB |

> **注意：** 以上数据为近似参考值，实际性能受数据特征、硬件配置、操作系统等因素影响。

### 8.9.3 什么时候选择什么格式

```python
# 决策辅助函数
def suggest_format(use_case):
    """根据使用场景推荐文件格式"""
    suggestions = {
        "长期存储与分析": "GeoParquet (Zstd 压缩)",
        "Web 前端展示": "GeoJSON 或 FlatGeobuf",
        "进程间数据传递": "Feather",
        "与 ArcGIS 交互": "File Geodatabase 或 Shapefile",
        "云存储与远程访问": "GeoParquet 或 FlatGeobuf",
        "与旧系统兼容": "Shapefile",
        "多图层数据": "GeoPackage",
        "大数据处理": "GeoParquet (分区)",
    }
    return suggestions.get(use_case, "GeoParquet（通用推荐）")
```

---

## 8.10 云存储集成

### 8.10.1 远程文件读取

GeoParquet 的一个重要优势是支持从云存储直接读取：

```python
import geopandas as gpd

# 从 AWS S3 读取
gdf = gpd.read_parquet(
    "s3://my-bucket/data/cities.parquet",
    storage_options={
        "key": "your-access-key",
        "secret": "your-secret-key",
        "region": "us-east-1"
    }
)

# 从 Google Cloud Storage 读取
gdf = gpd.read_parquet(
    "gs://my-bucket/data/cities.parquet",
    storage_options={
        "token": "path/to/credentials.json"
    }
)

# 从 Azure Blob Storage 读取
gdf = gpd.read_parquet(
    "abfs://container@account.dfs.core.windows.net/data/cities.parquet",
    storage_options={
        "account_name": "your-account",
        "account_key": "your-key"
    }
)
```

### 8.10.2 远程文件写入

```python
# 写入到 S3
gdf.to_parquet(
    "s3://my-bucket/output/result.parquet",
    storage_options={
        "key": "your-access-key",
        "secret": "your-secret-key"
    }
)
```

### 8.10.3 HTTP/HTTPS 直接读取

```python
# 从公开的 HTTP URL 读取
gdf = gpd.read_parquet(
    "https://data.example.com/open-data/buildings.parquet"
)

# 许多开放数据平台提供 GeoParquet 格式
# 例如：Overture Maps、Microsoft Building Footprints 等
```

### 8.10.4 使用 fsspec 配置

```python
import fsspec

# 使用 fsspec 的文件系统抽象
fs = fsspec.filesystem("s3", anon=True)  # 匿名访问公开数据

# 列出远程文件
files = fs.ls("s3://open-data-bucket/geo/")
print(files)

# 读取
with fs.open("s3://open-data-bucket/geo/data.parquet", "rb") as f:
    gdf = gpd.read_parquet(f)
```

---

## 8.11 最佳实践

### 8.11.1 写入最佳实践

```python
import geopandas as gpd

# 1. 选择合适的压缩算法
# 推荐使用 Zstd — 在压缩率和速度之间取得最佳平衡
gdf.to_parquet("data.parquet", compression="zstd")

# 2. 启用覆盖边界框（用于大数据集的空间查询优化）
gdf.to_parquet("data.parquet", write_covering_bbox=True)

# 3. 优先使用 GeoArrow 编码（如果几何类型一致）
if len(gdf.geom_type.unique()) == 1:
    gdf.to_parquet("data.parquet", geometry_encoding="geoarrow")
else:
    gdf.to_parquet("data.parquet", geometry_encoding="WKB")

# 4. 不要将不必要的索引写入文件
gdf.to_parquet("data.parquet", index=False)
```

### 8.11.2 读取最佳实践

```python
# 1. 只读取需要的列
gdf = gpd.read_parquet("data.parquet", columns=["name", "geometry"])

# 2. 使用空间过滤
gdf = gpd.read_parquet("data.parquet", bbox=(115, 39, 117, 41))

# 3. 对于大数据集，先查看元数据
import pyarrow.parquet as pq
pf = pq.ParquetFile("data.parquet")
print(f"行数: {pf.metadata.num_rows}")
print(f"行组数: {pf.metadata.num_row_groups}")
print(f"列数: {pf.metadata.num_columns}")
```

### 8.11.3 数据管道中的最佳实践

```python
# 推荐的数据处理管道

# 1. 原始数据：可能是 Shapefile、GeoJSON 等
raw_gdf = gpd.read_file("raw_data.shp")

# 2. 数据清洗和处理
cleaned_gdf = clean_and_process(raw_gdf)

# 3. 持久化为 GeoParquet（高效存储）
cleaned_gdf.to_parquet(
    "processed/data.parquet",
    compression="zstd",
    write_covering_bbox=True
)

# 4. 后续分析直接读取 GeoParquet（极快）
gdf = gpd.read_parquet("processed/data.parquet")

# 5. 最终结果按需导出为其他格式
gdf.to_file("output/result.geojson", driver="GeoJSON")  # Web 展示
gdf.to_file("output/result.gpkg")                        # GIS 软件
```

### 8.11.4 格式转换工具函数

```python
def convert_to_parquet(input_path, output_path, **kwargs):
    """将任意格式转换为 GeoParquet"""
    gdf = gpd.read_file(input_path)

    # 默认选项
    defaults = {
        "compression": "zstd",
        "write_covering_bbox": True,
        "index": False
    }
    defaults.update(kwargs)

    gdf.to_parquet(output_path, **defaults)

    # 打印统计信息
    import os
    input_size = os.path.getsize(input_path) / (1024 * 1024)
    output_size = os.path.getsize(output_path) / (1024 * 1024)
    ratio = input_size / output_size if output_size > 0 else 0

    print(f"转换完成:")
    print(f"  输入: {input_path} ({input_size:.2f} MB)")
    print(f"  输出: {output_path} ({output_size:.2f} MB)")
    print(f"  压缩比: {ratio:.1f}x")
    print(f"  行数: {len(gdf)}")

# 使用示例
convert_to_parquet("old_data.shp", "new_data.parquet")
```

---

## 8.12 本章小结

本章详细介绍了 GeoParquet 和 GeoArrow 格式在 GeoPandas 中的应用，涵盖了以下核心内容：

| 主题 | 关键要点 |
|------|---------|
| GeoParquet | Apache Parquet 的地理空间扩展，列式存储，高效压缩 |
| 规范版本 | 1.1.0 支持 GeoArrow 原生编码和覆盖边界框 |
| read_parquet() | 支持列选择、空间过滤，云存储直接读取 |
| to_parquet() | 支持多种压缩算法，推荐 Zstd |
| Feather | Arrow IPC 格式，极快的序列化/反序列化速度 |
| GeoArrow 编码 | 原生 Arrow 数组结构存储几何，性能优于 WKB |
| Arrow 互操作 | to_arrow() / from_arrow() 实现 Arrow 生态集成 |
| 性能 | 比 Shapefile 快 5-10 倍，文件小 2-3 倍 |
| 云存储 | 原生支持 S3、GCS、Azure Blob 等远程路径 |

**核心建议：**

- 新项目优先使用 GeoParquet 作为数据存储格式
- 压缩算法推荐 Zstd（最佳平衡）
- 大数据集启用 `write_covering_bbox=True`
- 几何类型一致时使用 GeoArrow 编码
- 读取时充分利用列选择和空间过滤
- 中间缓存数据可使用 Feather 格式

下一章我们将学习 GeoPandas 与数据库的交互，包括 PostGIS 和 Spatialite 的读写操作。
