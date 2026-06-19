---
layout: default
title: "第十九章：Cookbook 示例精讲"
---

# 第十九章：Cookbook 示例精讲

GeoPipeAgent 自带 7 个即用型流水线示例（`cookbook/` 目录），覆盖了最常见的 GIS 工作场景。本章逐一精讲每个示例，分析其设计思路和关键细节。

---

## 19.1 运行 Cookbook 示例

```bash
# 克隆仓库后，进入项目目录
cd GeoPipeAgent

# 校验所有示例
geopipe-agent validate cookbook/buffer-analysis.yaml
geopipe-agent validate cookbook/vector-qc.yaml

# 执行示例（需准备对应数据文件）
geopipe-agent run cookbook/buffer-analysis.yaml
```

---

## 19.2 `buffer-analysis.yaml`：缓冲区分析

完整文件内容：

```yaml
pipeline:
  name: "缓冲区分析"
  description: "对道路数据进行缓冲区分析并输出结果"

  variables:
    input_path: "data/roads.shp"
    buffer_dist: 500
    output_format: "GeoJSON"

  steps:
    - id: load-roads
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: reproject
      use: vector.reproject
      params:
        input: "$load-roads.output"
        target_crs: "EPSG:3857"

    - id: buffer-analysis
      use: vector.buffer
      params:
        input: "$reproject.output"
        distance: "${buffer_dist}"
        cap_style: "round"

    - id: save-result
      use: io.write_vector
      params:
        input: "$buffer-analysis.output"
        path: "output/road_buffer.geojson"
        format: "${output_format}"

  outputs:
    result: "$save-result.output"
    stats: "$buffer-analysis.stats"
```

### 精讲要点

1. **标准的"投影→分析→保存"三步模式**：先将 WGS84 数据重投影到 EPSG:3857（米制），再做 500 米缓冲，确保距离单位正确
2. **变量化关键参数**：`input_path`、`buffer_dist`、`output_format` 均使用变量，方便命令行覆盖：`geopipe-agent run cookbook/buffer-analysis.yaml --var buffer_dist=1000`
3. **显式 `.output` 引用**：`$load-roads.output`、`$reproject.output`——此为明确写法，效果等同于 `$load-roads`（简写）
4. **`outputs` 声明**：同时输出文件路径（`result`）和统计信息（`stats`），便于下游提取

---

## 19.3 `vector-qc.yaml`：矢量数据全量质检

```yaml
pipeline:
  name: "矢量数据质检"
  description: "对建筑物矢量数据进行几何有效性、属性完整性、坐标系、数值范围等质检"

  variables:
    input_path: "data/buildings.shp"
    expected_crs: "EPSG:4326"

  steps:
    - id: load-data
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: check-crs
      use: qc.crs_check
      params:
        input: "$load-data.output"
        expected_crs: "${expected_crs}"

    - id: check-geometry
      use: qc.geometry_validity
      params:
        input: "$load-data.output"
        auto_fix: false
        severity: "error"

    - id: check-topology
      use: qc.topology
      params:
        input: "$load-data.output"
        rules: ["no_overlaps"]
        tolerance: 0.001

    - id: check-attrs
      use: qc.attribute_completeness
      params:
        input: "$load-data.output"
        required_fields: ["name", "height", "type"]
        severity: "warning"

    - id: check-domain
      use: qc.attribute_domain
      params:
        input: "$load-data.output"
        field: "type"
        allowed_values: ["residential", "commercial", "industrial", "public"]

    - id: check-height
      use: qc.value_range
      params:
        input: "$load-data.output"
        field: "height"
        min: 0
        max: 1000
        severity: "warning"

    - id: check-duplicates
      use: qc.duplicate_check
      params:
        input: "$load-data.output"
        check_geometry: true
        check_fields: ["name"]

    - id: save-geometry-issues
      use: io.write_vector
      params:
        input: "$check-geometry.issues_gdf"
        path: "output/geometry_issues.geojson"
        format: "GeoJSON"
      when: "$check-geometry.issues_count > 0"

  outputs:
    data: "$load-data.output"
    geometry_issues: "$check-geometry.issues_gdf"
    attribute_issues: "$check-attrs.issues_gdf"
```

### 精讲要点

1. **多 QC 步骤串联**：7 个 QC 步骤全部检查同一份数据（`$load-data.output`）——这是 QC 步骤"检查并透传"设计的核心价值，可以无限串联
2. **有条件保存问题报告**：`when: "$check-geometry.issues_count > 0"`——只有实际存在几何问题时才生成问题文件，避免产生空文件
3. **`issues_gdf` 引用**：`$check-geometry.issues_gdf` 引用 QC 步骤的 metadata 中存储的问题要素 GeoDataFrame
4. **不同 severity**：`check-geometry` 用 `"error"`（严重问题），`check-attrs` 和 `check-height` 用 `"warning"`（可接受的不完整），体现数据质量分级

---

## 19.4 `overlay-analysis.yaml`：叠加分析

```yaml
pipeline:
  name: "叠加分析"
  description: "对两个矢量图层进行交集叠加分析"

  steps:
    - id: load-layer1
      use: io.read_vector
      params:
        path: "data/landuse.shp"

    - id: load-layer2
      use: io.read_vector
      params:
        path: "data/flood_zone.shp"

    - id: overlay-analysis
      use: vector.overlay
      params:
        input: "$load-layer1.output"
        overlay_layer: "$load-layer2.output"
        how: "intersection"

    - id: save-result
      use: io.write_vector
      params:
        input: "$overlay-analysis.output"
        path: "output/landuse_in_flood_zone.geojson"
        format: "GeoJSON"

  outputs:
    result: "$save-result.output"
    stats: "$overlay-analysis.stats"
```

### 精讲要点

1. **双数据源加载**：流水线支持同时加载多个数据文件，每个都有独立的步骤 ID
2. **叠加分析模式**：`intersection` 求交集，识别洪泛区内的土地利用情况
3. **此流水线的典型扩展**：可在 `overlay-analysis` 前添加 `vector.reproject`，确保两个图层 CRS 一致（否则 GeoPandas 可能报错）

---

## 19.5 `dissolve-analysis.yaml`：融合分析

```yaml
pipeline:
  name: "融合分析"
  description: "按指定字段融合要素，统计各类别的要素数量和属性"

  variables:
    input_path: "data/parcels.shp"

  steps:
    - id: load-data
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: dissolve-by-type
      use: vector.dissolve
      params:
        input: "$load-data.output"
        by: "land_type"
        agg:
          area_sqm: "sum"
          parcel_count: "count"

    - id: save-dissolved
      use: io.write_vector
      params:
        input: "$dissolve-by-type.output"
        path: "output/dissolved_by_type.geojson"
        format: "GeoJSON"

  outputs:
    result: "$save-dissolved.output"
```

### 精讲要点

1. **聚合函数**：`agg` 字典定义每个字段的聚合方式，`sum`（求和）、`count`（计数）、`mean`（均值）等
2. **融合结果**：每个 `land_type` 类别的所有要素几何合并为一个多边形，`area_sqm` 字段求和，`parcel_count` 字段计数

---

## 19.6 `filter-simplify.yaml`：过滤与简化

```yaml
pipeline:
  name: "数据筛选与简化"
  description: "筛选特定属性的要素，然后简化几何以减少文件大小"

  variables:
    input_path: "data/parcels.shp"
    filter_expression: "area_sqm > 1000"
    simplify_tolerance: 1.0

  steps:
    - id: read-data
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: filter
      use: vector.query
      params:
        input: "$read-data.output"
        expr: "${filter_expression}"    # ⚠️ 注意：参数名是 expr，非 expression

    - id: simplify
      use: vector.simplify
      params:
        input: "$filter.output"
        tolerance: "${simplify_tolerance}"

    - id: save
      use: io.write_vector
      params:
        input: "$simplify.output"
        path: "output/filtered_simplified.geojson"

  outputs:
    result: "$save.output"
    filter_stats: "$filter.stats"
```

> **⚠️ 注意**：`vector.query` 步骤的过滤参数名为 `expr`（不是 `expression`）。以上示例已修正。

### 精讲要点

1. **"过滤→简化"组合**：先过滤掉小地块（面积 < 1000 m²），再对剩余要素做几何简化，减小文件体积
2. **`simplify_tolerance` 单位**：取决于 CRS，在 EPSG:3857 中单位是米，在 EPSG:4326 中单位是度
3. **`filter_stats` 输出**：`$filter.stats` 包含 `feature_count`（过滤后数量）和 `original_count`（原始数量）

---

## 19.7 `raster-qc.yaml`：栅格质检

```yaml
pipeline:
  name: "栅格数据质检"
  description: "对 DEM 栅格数据进行 NoData、值域、分辨率一致性检查"

  variables:
    input_path: "data/dem.tif"

  steps:
    - id: load-dem
      use: io.read_raster
      params:
        path: "${input_path}"

    - id: check-nodata
      use: qc.raster_nodata
      params:
        input: "$load-dem.output"
        expected_nodata: -9999
        max_nodata_ratio: 0.3

    - id: check-values
      use: qc.raster_value_range
      params:
        input: "$load-dem.output"
        min: -500
        max: 9000
        severity: "error"

    - id: check-resolution
      use: qc.raster_resolution
      params:
        input: "$load-dem.output"
        expected_x_res: 30
        expected_y_res: 30
        tolerance: 0.5

  outputs:
    nodata_issues: "$check-nodata.stats"
    value_issues: "$check-values.stats"
    resolution_issues: "$check-resolution.stats"
```

### 精讲要点

1. **DEM 质检三要素**：NoData 设置正确性（`-9999`）、高程值合理范围（`-500` 到 `9000` 米）、空间分辨率一致性（30 米 Landsat）
2. **栅格 QC 串联**：三个 QC 步骤都引用 `$load-dem.output`（同一份栅格数据），与矢量 QC 串联模式完全一致

---

## 19.8 `batch-convert.yaml`：格式转换

```yaml
pipeline:
  name: "批量转换"
  description: "将 Shapefile 转换为 GeoJSON 格式并投影到 WGS84"

  variables:
    input_path: "data/buildings.shp"
    output_path: "output/buildings_wgs84.geojson"

  steps:
    - id: read-data
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: reproject
      use: vector.reproject
      params:
        input: "$read-data.output"
        target_crs: "EPSG:4326"

    - id: write-output
      use: io.write_vector
      params:
        input: "$reproject.output"
        path: "${output_path}"
        format: "GeoJSON"

  outputs:
    result: "$write-output.output"
```

### 批量执行脚本

结合 Shell 脚本，对目录下所有 Shapefile 批量转换：

```bash
#!/bin/bash
# 批量将 data/ 目录下所有 Shapefile 转换为 GeoJSON
for shp in data/*.shp; do
    name=$(basename "$shp" .shp)
    echo "Converting: $shp → output/${name}.geojson"
    geopipe-agent run cookbook/batch-convert.yaml \
        --var input_path="$shp" \
        --var output_path="output/${name}.geojson" \
        2>&1 | grep -E '"status"|"error"'
done
```

---

## 19.9 Cookbook 示例的共同模式

分析 7 个示例，可以归纳出以下共同设计模式：

| 模式 | 示例 | 说明 |
|------|------|------|
| 变量化路径 | 全部 | `input_path`/`output_path` 使用变量，方便 `--var` 覆盖 |
| 投影→分析 | buffer-analysis | 距离相关分析前先转换为米制坐标系 |
| QC 串联 | vector-qc | 多个 QC 步骤检查同一数据，透传模式 |
| 条件保存 | vector-qc | `when` 条件控制问题报告只在有问题时生成 |
| 显式 `.output` 引用 | overlay, batch-convert | 明确引用步骤主输出 |
| `outputs` 声明 | 全部 | 声明重要结果，便于 JSON 报告提取 |

---

## 19.10 本章小结

本章精讲了 GeoPipeAgent 自带的 7 个 Cookbook 示例：

1. **`buffer-analysis.yaml`**：标准的"投影转换→缓冲分析→保存"三步模式
2. **`vector-qc.yaml`**：7 个 QC 步骤串联，条件保存问题报告
3. **`overlay-analysis.yaml`**：双数据源加载，交集叠加
4. **`dissolve-analysis.yaml`**：按字段融合，带聚合函数
5. **`filter-simplify.yaml`**：过滤大要素，然后简化几何
6. **`raster-qc.yaml`**：DEM 三要素质检（NoData/值域/分辨率）
7. **`batch-convert.yaml`**：格式转换模板，配合 Shell 脚本批量执行

---

**导航**：[← 第十八章：自定义步骤与扩展开发](第18章-自定义步骤与扩展开发) ｜ [第二十章：最佳实践与综合案例 →](第20章-最佳实践与综合案例)
