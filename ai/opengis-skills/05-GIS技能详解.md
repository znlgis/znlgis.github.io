---
layout: default
title: 第五章：GIS 技能详解
---

# 第五章：GIS 技能详解

本章是教程中篇幅最长、信息密度最高的一章。我们将对 opengis-skills 仓库中全部 **23 个 GIS 技能**逐一进行深度解析。GIS 类技能覆盖从「数据获取 → 命令行处理 → 编程分析 → 空间数据库 → 地图服务 → 前端可视化」的完整链条，是 opengis-skills 仓库中规模最大的领域分类。

如果你是 GIS 开发者，这一章可以作为日常工作的速查手册：当你需要用 GDAL 做格式转换、用 GeoPandas 做空间分析、用 GeoServer 发布地图服务、用 CesiumJS 做三维可视化时，直接跳到对应小节获取准确的 API 签名和代码示例。每一节的撰写都基于仓库中对应 SKILL.md 的实际内容——不是从训练数据中猜测，而是对真实技能文件的系统梳理。

---

## 5.1 GIS 技能全景

在深入每个技能之前，先用一张全量表格建立全局视图。下表包含全部 23 个 GIS 技能的快速索引：

| 分类 | 技能 | 层级 | 简要说明 | 文件大小 |
|:-----|:-----|:----:|:---------|:--------:|
| 数据处理 | `gdal` | CLI | GDAL/OGR 命令行工具，50+ 命令覆盖矢量和栅格处理 | 12 KB |
| 数据处理 | `gdal-api` | API | GDAL/OGR 的 C/C++/Python/Java/.NET 四语言编程接口 | 42 KB |
| 数据处理 | `qgis-process` | CLI | QGIS 200+ 算法的 Headless 命令行批量处理 | 17 KB |
| 数据处理 | `geopipe-agent` | YAML | AI 原生 GIS ETL 流水线引擎，声明式 YAML 管道 | 15 KB |
| 空间数据库 | `postgis` | SQL | PostgreSQL 空间扩展，1000+ 空间函数和 GiST 索引 | 8 KB |
| 几何运算 | `jts` | Java | Java Topology Suite，二维矢量几何计算鼻祖 | 20 KB |
| 几何运算 | `geometry-api-java` | Java | Esri Geometry API for Java，独立几何计算库 | 12 KB |
| 几何运算 | `geometry-api-net` | .NET | Esri Geometry API for .NET，znlgis 社区维护分支 | 19 KB |
| 几何运算 | `shapely` | Python | Python GEOS 绑定，NumPy 原生向量化几何运算 | 19 KB |
| 几何运算 | `nettopologysuite` | .NET | JTS 的 .NET 完整移植，NuGet 包 | 8 KB |
| 矢量分析 | `geopandas` | Python | 继承 pandas 的 GeoDataFrame 矢量空间分析库 | 21 KB |
| 工具集 | `opengis-utils-for-java` | Java | GDAL/GeoServer/JTS 的 Java 工具集封装 | 30 KB |
| 工具集 | `opengis-utils-for-net` | .NET | GDAL/GeoServer/NTS 的 .NET 工具集封装 | 26 KB |
| 地图服务器 | `geoserver` | Server | 开源 Java 地图服务器，WMS/WFS/WMTS/WCS/WPS | 7 KB |
| 地图服务器 | `geoserver-rest-api` | REST | GeoServer REST 配置管理 API，自动化运维 | 20 KB |
| 地图服务器 | `geoserver-cloud` | Cloud | GeoServer 的云原生微服务拆分架构 | 7 KB |
| QGIS 生态 | `pyqgis` | Python | QGIS Python 二次开发 API，插件开发和自动化脚本 | 28 KB |
| Web 可视化 | `cesiumjs` | JS | WebGL 3D 地球引擎，3D Tiles/glTF/CZML | 9 KB |
| Web 可视化 | `openlayers` | JS | 全功能 2D Web 地图库，WMS/WMTS/矢量瓦片 | 7 KB |
| .NET 组件 | `sharpmap` | .NET | .NET WinForms/ASP.NET 传统 2D 地图组件 | 8 KB |
| .NET 组件 | `mapsui` | .NET | 跨平台 .NET 地图控件（WPF/MAUI/Avalonia/Blazor） | 8 KB |
| 综合 | `opengis-all` | 聚合 | 一站式端到端 GIS 全流程索引（GDAL+QGIS+GeoServer） | 40 KB |
| Java 工具集 | `geotools` | Java | Java GIS 工具集，OGC 标准参考实现 | 23 KB |

**分类解读：**

- **数据处理类**（4 个）：gdal 和 qgis-process 面向命令行场景，gdal-api 面向编程集成，geopipe-agent 则是 AI 原生 YAML 流水线引擎——四种方式覆盖从手动处理到全自动管道的不同需求
- **几何运算类**（5 个）：jts 是 Java 生态的几何运算标准，经由 GEOS 影响 shapely（Python）和 NetTopologySuite（.NET），geometry-api-java 和 geometry-api-net 则是 Esri 体系的几何方案
- **地图服务器类**（3 个）：geoserver 是单体部署，geoserver-rest-api 实现自动化管理，geoserver-cloud 将单体拆分为微服务
- **Web 可视化类**（2 个）：openlayers 统治 2D Web 地图，cesiumjs 统治 3D 地球可视化
- **工具集与综合类**（4 个）：geotools 是 Java GIS 的标准工具集，opengis-utils 系列提供跨语言的便利封装，opengis-all 则是一站式全流程索引

---

## 5.2 数据处理与命令行

数据处理是 GIS 技能的起点——无论后续走数据库路线、分析路线还是发布路线，数据必须先经过转换、清洗、重投影等预处理。本节详解四个数据处理技能。

### 5.2.1 gdal — GDAL/OGR 命令行工具

**技能定位：** GDAL（Geospatial Data Abstraction Library）是地理空间数据处理的事实标准。这个技能聚焦于 GDAL/OGR 的命令行接口，即 **50+ 个 CLI 工具**的完整指南。

**文件规模：** 主文件约 12 KB（452 行）。`reference/` 子目录包含 `vector-tools.md`（矢量工具完整参数表）和 `raster-tools.md`（栅格工具完整参数表）。

**命令行体系：** GDAL 3.9 引入了统一的新式 CLI 接口，同时也保留传统命令行风格：

```bash
# 新式 CLI（GDAL 3.9+）：gdal <command> <subcommand> [options] <inputs>
gdal vector info input.shp
gdal raster info input.tif

# 传统 CLI（仍可用）：直接调用各工具
ogrinfo input.shp
gdalinfo input.tif
```

**矢量处理核心命令：**

`ogr2ogr` 是矢量数据处理最核心的命令，几乎覆盖所有矢量操作场景：

```bash
# 基础格式转换（Shapefile → GeoJSON）
ogr2ogr -f GeoJSON output.geojson input.shp

# 指定目标格式（Shapefile → GeoPackage）
ogr2ogr -f GPKG output.gpkg input.shp

# 坐标系转换（WGS84 → Web Mercator）
ogr2ogr -t_srs EPSG:3857 output.shp input.shp

# 源坐标系指定（当源数据未声明 CRS 时）
ogr2ogr -s_srs EPSG:4326 -t_srs EPSG:3857 output.shp input.shp

# 按属性过滤
ogr2ogr -where "population > 1000000" output.shp input.shp

# 空间裁剪（按范围框）
ogr2ogr -spat xmin ymin xmax ymax output.shp input.shp

# 按图层名选择
ogr2ogr output.shp input.gpkg -sql "SELECT * FROM roads WHERE type='highway'"

# 追加模式（而非覆盖）
ogr2ogr -append output.shp input2.shp
```

`ogrinfo` 用于查看矢量数据信息：

```bash
# 基本信息
ogrinfo input.shp

# 结构化 JSON 输出
ogrinfo -json input.shp

# 查看所有图层
ogrinfo -al input.gpkg

# 查看数据结构（仅字段名和类型）
ogrinfo -so input.shp

# 按条件过滤查看
ogrinfo -where "area > 10000" input.shp
```

**栅格处理核心命令：**

`gdalwarp` 用于栅格重投影、裁剪和镶嵌：

```bash
# 重投影
gdalwarp -t_srs EPSG:4326 input.tif output.tif

# 指定重采样方法
gdalwarp -t_srs EPSG:4326 -r bilinear input.tif output.tif

# 按范围裁剪
gdalwarp -te xmin ymin xmax ymax input.tif output.tif

# 调整分辨率
gdalwarp -tr 30 30 input.tif output.tif

# 多波段输出
gdalwarp -of GTiff -co COMPRESS=LZW input.tif output.tif
```

`gdal_translate` 用于栅格格式转换和缩放：

```bash
# 格式转换
gdal_translate -of JPEG input.tif output.jpg

# 缩放输出尺寸
gdal_translate -outsize 50% 50% input.tif output.tif

# 转换为 COG（Cloud Optimized GeoTIFF）
gdal_translate -of COG input.tif output_cog.tif

# 提取子区域
gdal_translate -srcwin xoff yoff xsize ysize input.tif output.tif
```

`gdal_calc.py` 栅格计算器：

```bash
# NDVI 计算（近红外波段 4，红光波段 3）
gdal_calc.py -A input.tif --A_band=4 -B input.tif --B_band=3 \
  --calc="(A.astype(float)-B.astype(float))/(A.astype(float)+B.astype(float))" \
  --outfile ndvi.tif --type=Float32

# 多条件分类
gdal_calc.py -A dem.tif --calc="1*(A<200) + 2*(A>=200)*(A<500) + 3*(A>=500)" \
  --outfile class.tif --NoDataValue=0
```

`gdal_dem` DEM 分析工具集：

```bash
# 山体阴影
gdaldem hillshade dem.tif hillshade.tif -z 2 -az 315 -alt 45

# 坡度
gdaldem slope dem.tif slope.tif -p -compute_edges

# 坡向
gdaldem aspect dem.tif aspect.tif

# 彩色渲染
gdaldem color-relief dem.tif color_ramp.txt relief_color.tif
```

**环境变量配置：** GDAL 行为可通过环境变量精细控制：

| 变量 | 说明 | 示例 |
|:-----|:-----|:-----|
| `GDAL_DATA` | GDAL 数据文件目录（含 EPSG 定义） | `/usr/share/gdal` |
| `PROJ_LIB` | PROJ 投影库数据目录 | `/usr/share/proj` |
| `GDAL_NUM_THREADS` | 多线程并行数 | `ALL_CPUS` |
| `GDAL_CACHEMAX` | 内存缓存大小（MB） | `2048` |
| `CPL_DEBUG` | 调试输出开关 | `ON` |
| `GDAL_DISABLE_READDIR_ON_OPEN` | 跳过打开时的目录扫描 | `YES` |

**常见使用模式（来自技能文件）：**

```bash
#!/bin/bash
# 批量格式转换：目录内所有 Shapefile → GeoJSON
for shp in *.shp; do
  base="${shp%.shp}"
  ogr2ogr -f GeoJSON "$base.geojson" "$shp"
done
```

**技能文件给出的 AI 推荐工作流：**

1. **探索数据**：先用 `gdalinfo` / `ogrinfo` 了解数据结构、CRS、属性字段
2. **检查驱动支持**：`ogrinfo --formats` / `gdalinfo --formats` 确认目标格式可用
3. **分步处理**：避免单条命令完成所有操作——先转换格式，再重投影，最后裁剪
4. **使用 JSON 输出**：`-json` 参数让 AI 更容易解析输出结果
5. **性能优化**：启用多线程（`GDAL_NUM_THREADS=ALL_CPUS`）、加大缓存（`GDAL_CACHEMAX=2048`）、使用 COG 格式

---

### 5.2.2 gdal-api — GDAL/OGR 编程 API

**技能定位：** 当命令行 `ogr2ogr` 无法满足需求时——比如需要逐要素处理、嵌入到更大的数据处理管道、或者在代码中动态构建几何——就轮到 gdal-api 上场。

**文件规模：** 约 42 KB（1478 行），是 GIS 类中最大的单一技能文件，深度覆盖四种语言的 API。

**支持语言：** GDAL 核心以 C++ 实现，通过 SWIG 生成 Python、Java、C# 三种语言绑定，各语言 API 与 C++ 保持一致的类与方法命名。

```bash
# Python 安装（Conda 推荐，自动处理 C 库依赖）
conda install -c conda-forge gdal

# 验证
python -c "from osgeo import gdal; print(gdal.VersionInfo())"
```

**核心对象模型：**

| C++ 类 | Python 类 | 说明 |
|:-------|:----------|:-----|
| `GDALDataset` | `gdal.Dataset` | 数据集——可以是单个文件、文件夹（Shapefile）或数据库连接 |
| `GDALDriver` | `gdal.Driver` | 驱动——负责读写特定格式 |
| `GDALRasterBand` | `gdal.Band` | 栅格波段——单层像元矩阵 |
| `OGRLayer` | `ogr.Layer` | 矢量图层——要素集合 |
| `OGRFeature` | `ogr.Feature` | 矢量要素——一条记录，包含几何和属性 |
| `OGRGeometry` | `ogr.Geometry` | 几何对象——点、线、面及其集合 |
| `OGRFieldDefn` | `ogr.FieldDefn` | 字段定义——属性列的名称和类型 |
| `OGRSpatialReference` | `ogr.SpatialReference` | 空间参考——坐标系定义 |

**Python API 典型代码：**

```python
from osgeo import gdal, ogr, osr

# === 矢量读写 ===
# 打开 Shapefile
ds = ogr.Open("input.shp")
layer = ds.GetLayer(0)

# 遍历要素
for feature in layer:
    geom = feature.GetGeometryRef()
    name = feature.GetField("NAME")
    print(f"{name}: {geom.GetGeometryName()}")

# 创建新 Shapefile
driver = ogr.GetDriverByName("ESRI Shapefile")
out_ds = driver.CreateDataSource("output.shp")
srs = osr.SpatialReference()
srs.ImportFromEPSG(4326)
out_layer = out_ds.CreateLayer("layer", srs, ogr.wkbPoint)

# 添加字段
field_defn = ogr.FieldDefn("NAME", ogr.OFTString)
field_defn.SetWidth(50)
out_layer.CreateField(field_defn)

# 添加要素
feature = ogr.Feature(out_layer.GetLayerDefn())
point = ogr.Geometry(ogr.wkbPoint)
point.AddPoint(116.4, 39.9)
feature.SetGeometry(point)
feature.SetField("NAME", "Beijing")
out_layer.CreateFeature(feature)

# 清理
feature = None
out_ds = None
ds = None

# === 栅格读写 ===
# 打开 GeoTIFF
ds = gdal.Open("dem.tif")
band = ds.GetRasterBand(1)
data = band.ReadAsArray()
print(f"尺寸: {ds.RasterXSize} × {ds.RasterYSize}")
print(f"NoData: {band.GetNoDataValue()}")

# 创建新栅格
driver = gdal.GetDriverByName("GTiff")
out_ds = driver.Create("output.tif", 512, 512, 1, gdal.GDT_Float32)
out_ds.SetGeoTransform(ds.GetGeoTransform())
out_ds.SetProjection(ds.GetProjection())
out_band = out_ds.GetRasterBand(1)
out_band.WriteArray(data)
out_band.SetNoDataValue(-9999)
out_band = None
out_ds = None

# === 坐标变换 ===
src_srs = osr.SpatialReference()
src_srs.ImportFromEPSG(3857)
tgt_srs = osr.SpatialReference()
tgt_srs.ImportFromEPSG(4326)
transform = osr.CoordinateTransformation(src_srs, tgt_srs)

point = ogr.CreateGeometryFromWkt("POINT (12968000 4863000)")
point.Transform(transform)
print(point.ExportToWkt())  # POINT (116.397 39.908)
```

**关键设计要点：**

- GDAL Python API 采用**两阶段初始化**模式：先获取 Driver，再通过 Driver 创建 Dataset。这是 GDAL 的"工厂模式"实现——你永远不直接 `new` 一个 Dataset
- 所有 `Open()` 返回的对象必须在用完后显式销毁（设为 `None` 或退出作用域），否则可能导致数据未写入磁盘
- `gdal.UseExceptions()` 启用后，所有 GDAL 错误会触发 Python 异常而不是静默失败——强烈建议在脚本开头调用

**适用场景建议：**

- 命令行参数不够灵活时（如需要逐要素条件判断、动态计算属性）
- 需要在 Python/C++ 数据处理管道中内嵌 GIS 操作时
- 需要读写 200+ 栅格格式和 100+ 矢量格式中的特殊格式（如 NetCDF/HDF5/FileGDB）

---

### 5.2.3 qgis-process — QGIS 命令行批处理

**技能定位：** `qgis_process` 是 QGIS 自带的命令行处理执行器，让你**不启动 QGIS 桌面应用**就能运行 200+ 内置空间分析算法。源代码位于 QGIS 主仓库的 `src/process/` 目录。

**文件规模：** 约 17 KB（555 行）。

**为什么需要这个技能？** QGIS 桌面是 GIS 开发者最熟悉的工具之一，但它的处理工具箱原本只能在 GUI 中操作。`qgis_process` 打开了两扇关键的门：

1. **CI/CD 自动化**：在 GitHub Actions / Jenkins 中运行空间分析步骤
2. **服务端批量处理**：在 Linux 服务器上以 headless 模式运行 QGIS 算法

**基本用法：**

```bash
# 验证安装（需 QGIS 3.16+）
qgis_process --version

# 列出所有可用算法
qgis_process list

# 查看算法帮助
qgis_process help native:buffer

# 运行算法（非 JSON 模式）
qgis_process run native:buffer -- INPUT=input.shp DISTANCE=500 OUTPUT=output.shp

# JSON 模式运行（AI/脚本友好）
qgis_process run --json native:buffer -- INPUT=input.shp DISTANCE=500 OUTPUT=output.shp
```

**JSON 输出格式：** 当使用 `--json` 参数时，输出为结构化 JSON，便于 AI 和脚本解析：

```json
{
  "algorithm": "native:buffer",
  "inputs": {"INPUT": "input.shp", "DISTANCE": 500},
  "results": {"OUTPUT": "output.shp"},
  "execution_time": 2.34
}
```

**变量插值：** 在管道文件中可以使用 `@INPUT` 和 `@OUTPUT` 占位符：

```bash
qgis_process run native:reprojectlayer -- \
  INPUT=@INPUT \
  TARGET_CRS=EPSG:4326 \
  OUTPUT=@OUTPUT
```

**常用算法速查：**

| 算法 ID | 功能 | 关键参数 |
|:--------|:-----|:---------|
| `native:buffer` | 缓冲区 | `INPUT`, `DISTANCE`, `SEGMENTS`, `DISSOLVE` |
| `native:reprojectlayer` | 矢量重投影 | `INPUT`, `TARGET_CRS`, `OUTPUT` |
| `native:clip` | 矢量裁剪 | `INPUT`, `OVERLAY`, `OUTPUT` |
| `native:intersection` | 矢量相交 | `INPUT`, `OVERLAY`, `OUTPUT` |
| `native:dissolve` | 融合 | `INPUT`, `FIELD`, `OUTPUT` |
| `native:fixgeometries` | 几何修复 | `INPUT`, `OUTPUT` |
| `gdal:warpreproject` | 栅格重投影 | `INPUT`, `TARGET_CRS`, `RESAMPLING` |
| `gdal:cliprasterbymasklayer` | 按矢量裁剪栅格 | `INPUT`, `MASK`, `OUTPUT` |

**Headless 服务器部署：**

```bash
# 无窗口系统必须设置此环境变量
export QT_QPA_PLATFORM=offscreen

# 跳过加载插件加速启动
qgis_process --skip-loading-plugins list
```

**与 gdal 的选择：** 当处理逻辑是纯格式转换、重投影、裁剪时，gdal 的 CLI 工具更快更轻量。当需要用到 QGIS 特有的算法（如网络分析、空间统计、高级制图算法）时，`qgis_process` 是唯一的选择。

---

### 5.2.4 geopipe-agent — AI 原生 GIS ETL 流水线引擎

**技能定位：** GeoPipeAgent 是 opengis-skills 仓库中最具前瞻性的技能——它不是一个传统的 GIS 工具，而是一个**专为 AI 编程助手设计**的 YAML 驱动 GIS ETL 流水线引擎。核心理念：你（AI）生成 YAML 管道配置，框架负责执行并返回结构化结果。

**文件规模：** 主文件约 15 KB（483 行）。`reference/` 子目录包含 `steps-reference.md`（步骤库完整参考，24 KB）和 `pipeline-schema.md`（管道配置规范）。

**注意：** 项目仓库 [github.com/znlgis/geopipe-agent](https://github.com/znlgis/geopipe-agent) 当前不可访问（404/私有）。技能文件标注了此警告，建议使用者以参考为主。

**核心能力：**

- **声明式流水线**：YAML 定义分析步骤，AI 友好——AI 不需要生成 Python 代码，只需要生成结构化的 YAML 配置
- **丰富步骤库**：矢量分析（buffer/clip/intersection/dissolve）、栅格分析、网络分析、空间聚类、数据质检
- **多后端支持**：`native_python`（基于 geopandas/shapely/rasterio）和 `qgis_process`
- **质检框架**：10 种 QC 检查，支持错误/警告/信息三级严重度
- **步骤间数据传递**：通过 `$step_id.output` 语法实现管道内步骤间的数据流

**三段式管道结构：**

```yaml
pipeline:
  name: "数据质检修复"
  description: "读取 Shapefile → 质检 → (如有问题)修复 → 输出"

  steps:
    # 第一段：输入读取
    - id: read
      use: io.read_vector
      params:
        path: "data/buildings.shp"

    # 第二段：分析与质检
    - id: check_valid
      use: qc.geometry_validity
      params:
        input: "$read"
        severity: error

    - id: fix_valid
      use: qc.geometry_validity
      params:
        input: "$check_valid"
        auto_fix: true
      when: "$check_valid.issues_count > 0"   # 条件执行

    # 第三段：输出写入
    - id: save
      use: io.write_vector
      params:
        input: "$fix_valid"
        path: "output/buildings_checked.gpkg"
        format: GPKG
```

**YAML 管道的关键设计：**

1. **`$step_id.output` 语法**：步骤间通过 `$` 前缀引用前序步骤的输出，形成了 DAG（有向无环图）数据流
2. **`when` 条件执行**：仅当条件为真时才执行该步骤，支持引用前序步骤的结果变量（如 `issues_count > 0`）
3. **`on_error` 错误处理**：支持 `skip`（跳过继续）、`abort`（中止管道）、`warn`（警告后继续）三种策略

**10 种 QC 检查类型：**

| 检查步骤 | 检查内容 |
|:--------|:--------|
| `qc.geometry_validity` | 几何有效性（自相交、环方向错误等） |
| `qc.geometry_type` | 几何类型一致性 |
| `qc.null_geometry` | 空几何检查 |
| `qc.null_attribute` | 空属性值检查 |
| `qc.attribute_range` | 属性值范围检查 |
| `qc.unique_values` | 唯一值约束检查 |
| `qc.spatial_overlap` | 空间重叠检查 |
| `qc.spatial_gap` | 空间缝隙检查 |
| `qc.crs_check` | 坐标参考系检查 |
| `qc.feature_count` | 要素数量检查 |

**安装与使用：**

```bash
pip install geopipe-agent

# 生成管道模板（快速上手）
geopipe-agent template buffer > pipeline.yaml

# 列出所有可用步骤
geopipe-agent list-steps

# 查看具体步骤帮助
geopipe-agent help-step vector.buffer

# 执行管道
geopipe-agent run pipeline.yaml
```

**典型场景：Shapefile → GeoJSON 转换管线：**

```yaml
pipeline:
  name: "Shapefile 到 GeoJSON 转换"
  steps:
    - id: read
      use: io.read_vector
      params:
        path: "input.shp"
    - id: check
      use: qc.geometry_validity
      params:
        input: "$read"
        severity: warn
    - id: fix
      use: qc.geometry_validity
      params:
        input: "$check"
        auto_fix: true
      when: "$check.issues_count > 0"
    - id: write
      use: io.write_vector
      params:
        input: "$fix"
        path: "output.geojson"
        format: GeoJSON
```

**geoipipe-agent 的定位：** 在 GIS 技能体系中，它是**专门面向 AI 编程助手的工作流层**。当用户说"帮我做一个 Shapefile 质检并输出 GeoJSON 的自动化流程"，AI 不需要写 50 行 Python 代码——只需生成 20 行 YAML 配置。这大大降低了 AI 在代码生成中的出错概率，因为 YAML 的约束性比通用编程语言强得多。

---

## 5.3 空间数据库 — PostGIS

**技能定位：** PostGIS 是基于 PostgreSQL 的开源空间数据库扩展，遵循 OGC Simple Features for SQL 规范，是 GIS 后端系统中最广泛使用的空间数据库。它让 SQL 查询具备了空间语义——你不再问"ID 为 5 的记录是什么"，而是问"距离这个点 1 公里范围内有哪些 POI"。

**文件规模：** 约 8 KB（251 行），覆盖核心数据类型、建表与索引、100+ 高频空间函数、性能优化和空间聚合。

**核心数据类型：**

| 类型 | 说明 | 适用场景 |
|:-----|:-----|:---------|
| `geometry(Point, 4326)` | 平面几何，速度快 | 投影坐标系下的常规分析（如城市级） |
| `geography(Point, 4326)` | 球面几何，距离按米计 | 全球范围、跨经线的距离/面积计算 |
| `raster` | 栅格 | DEM、影像瓦片的数据库内存储与分析 |

`geometry` 和 `geography` 的选择是一个常见困惑点。简单规则：如果你的分析范围不超过一个省，用 `geometry`（速度快）；如果跨大洲或全球范围，用 `geography`（距离准确）。`geography` 的 `ST_Distance` 返回米而非度，这在业务应用中至关重要。

**环境准备：**

```bash
# Docker 部署（推荐）
docker run --name pg -e POSTGRES_PASSWORD=pg -p 5432:5432 \
  -d postgis/postgis:17-3.6

# 启用扩展
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;    -- 拓扑（可选）
CREATE EXTENSION postgis_raster;       -- 栅格（可选）

SELECT PostGIS_Full_Version();         -- 验证
```

**建表与空间索引：**

```sql
-- 创建空间表
CREATE TABLE poi (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    geom geometry(Point, 4326)
);

-- 创建空间索引（GiST，基于 R-Tree）
CREATE INDEX idx_poi_geom ON poi USING GIST (geom);

-- 插入数据
INSERT INTO poi (name, geom)
VALUES ('天安门', ST_SetSRID(ST_MakePoint(116.397, 39.909), 4326));
```

**核心空间函数分类：**

**1. 空间关系函数（Spatial Relationships）：**

```sql
-- 判断两个几何是否相交
SELECT name FROM parks WHERE ST_Intersects(geom, ST_MakePoint(116.4, 39.9, 4326));

-- 判断 A 是否包含 B
SELECT * FROM regions WHERE ST_Contains(geom, ST_MakePoint(116.4, 39.9, 4326));

-- 判断 A 是否在 B 内部
SELECT * FROM buildings WHERE ST_Within(geom, some_polygon);

-- 计算距离（geometry 返回度，geography 返回米）
SELECT ST_Distance(a.geom::geography, b.geom::geography) FROM poi a, poi b;
```

**2. 几何构造函数：**

```sql
-- 缓冲区（单位取决于 CRS：地理坐标系为度）
SELECT ST_Buffer(geom, 0.01) FROM poi WHERE name = '天安门';

-- 质心
SELECT ST_Centroid(geom) FROM districts;

-- 凸包
SELECT ST_ConvexHull(ST_Collect(geom)) FROM points;
```

**3. 坐标变换：**

```sql
-- 从 WGS84 转 Web Mercator
SELECT ST_Transform(geom, 3857) FROM poi;

-- 从任意 CRS 转 WGS84
SELECT ST_Transform(geom, 4326) FROM some_table;
```

**4. 空间聚合与连接：**

```sql
-- 计算每个行政区内有多少 POI
SELECT d.name, COUNT(p.id)
FROM districts d
LEFT JOIN poi p ON ST_Contains(d.geom, p.geom)
GROUP BY d.name;

-- 合并相交的多边形
SELECT ST_Union(geom) FROM parcels WHERE district_id = 1;
```

**性能优化策略：**

1. **GiST 索引是必需品**：无索引的空间查询在大数据量下（百万级）会从毫秒退化为分钟
2. **按需 Transform**：在插入时存储最常查询的投影（如同时存 4326 和 3857 两列），避免查询时反复 Transform
3. **使用 `geography` 类型做全球距离查询**：`geometry` 的 `ST_Distance` 在 4326 下返回的是度数，几乎无业务意义
4. **分区表**：按行政区或网格对超大型空间表做分区（PostgreSQL 原生表分区 + 空间边界）
5. **`VACUUM ANALYZE`**：大量空间数据变更后务必执行，否则查询计划器基于过期统计信息制定低效计划

**PostGIS 在 GIS 技能链中的位置：** 它是数据处理（GDAL）和地图发布（GeoServer）之间的持久化层。典型工作流是：GDAL 处理原始数据 → `shp2pgsql` 或 `ogr2ogr` 导入 PostGIS → GeoServer 从 PostGIS 读数据发布 WMS/WFS 服务。

---

## 5.4 几何运算库

几何运算库是 GIS 软件栈的"数学内核"——所有空间关系判断、集合运算、缓冲区计算最终都落在几何运算层。opengis-skills 覆盖了 Java、Python、.NET 三个主要生态的几何运算库。

### 5.4.1 jts — Java Topology Suite（Java）

**技能定位：** JTS 是二维矢量几何运算的**鼻祖级实现**。它是 GEOS（C++，PostGIS 的几何引擎）和 NetTopologySuite（.NET 移植）的设计蓝图。`jts-core` 是 GeoTools、GeoServer 等 Java GIS 平台的底层几何运算依赖。

**文件规模：** 约 20 KB（558 行）。

**Geometry 层次结构：**

```
Geometry (抽象基类)
├── Point                          ← 0 维：单点
├── LineString                     ← 1 维：有序点序列
│   └── LinearRing                 ← 1 维：闭合的简单线段
├── Polygon                        ← 2 维：外环 + 0+ 个内环（孔洞）
├── MultiPoint                     ← Point 集合
├── MultiLineString                ← LineString 集合
├── MultiPolygon                   ← Polygon 集合
└── GeometryCollection             ← 异质几何集合
```

**快速集成：**

```xml
<dependency>
    <groupId>org.locationtech.jts</groupId>
    <artifactId>jts-core</artifactId>
    <version>1.20.0</version>
</dependency>
```

**核心 API：**

```java
import org.locationtech.jts.geom.*;

GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);

// 创建几何
Point p = gf.createPoint(new Coordinate(116.397, 39.908));
LineString ls = gf.createLineString(new Coordinate[]{
    new Coordinate(116, 39), new Coordinate(117, 40)
});
Polygon poly = gf.createPolygon(new Coordinate[]{
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10, 10), new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 空间谓词（返回 boolean）
poly.contains(p);          // A 包含 B?
poly.intersects(p);        // 是否相交?
poly.touches(p);           // 边界接触?
poly.within(p);            // A 在 B 内部?
poly.overlaps(p);          // 重叠但不包含?
poly.covers(p);            // 覆盖（比 contains 更宽松，包含边界）

// 空间运算（返回 Geometry）
Geometry union = a.union(b);               // 合并
Geometry inter = a.intersection(b);        // 相交部分
Geometry diff = a.difference(b);           // A 减去 B
Geometry symDiff = a.symDifference(b);     // 对称差

// 缓冲区
Geometry buf = p.buffer(100);              // 缓冲区（单位同 CRS）

// 几何分析
double area = poly.getArea();              // 面积
double len = ls.getLength();               // 长度
Point centroid = poly.getCentroid();       // 质心
Geometry hull = mp.convexHull();           // 凸包
boolean valid = poly.isValid();            // 有效性检查

// WKT/WKB I/O
WKTReader reader = new WKTReader();
Geometry g = reader.read("POINT (116.397 39.908)");
WKTWriter writer = new WKTWriter();
String wkt = writer.write(g);
```

**DE-9IM 空间关系模型：** JTS 完全实现了 OGC 标准的 Dimensionally Extended 9-Intersection Model（DE-9IM），通过 `relate()` 方法可以获取两个几何之间最完整的拓扑关系矩阵。这是空间谓词（`contains`、`intersects` 等）的底层数学基础：

```java
// DE-9IM 矩阵——两个几何的内部、边界、外部的 9 种交集组合
IntersectionMatrix matrix = poly.relate(line);
matrix.matches("T*F**FFF*");  // 自定义拓扑关系模式匹配
```

**PrecisionModel 和坐标精度：** JTS 的 `PrecisionModel` 是控制坐标精度的关键机制。在处理浮点运算带来的拓扑误差（如两个"几乎共线"的线段被判为交叉）时，可以通过降低精度来消除微小误差：

```java
PrecisionModel pm = new PrecisionModel(1000);  // 保留 3 位小数精度
GeometryFactory gf = new GeometryFactory(pm);
Geometry cleaned = TopologyPreservingSimplifier.simplify(geom, tolerance);
```

**空间索引：** JTS 内置两种空间索引用于加速批量空间查询：

- `STRtree`：基于 Sort-Tile-Recursive 算法的 R-Tree 实现，适合静态数据和大批量查询
- `Quadtree`：四叉树，适合动态数据

---

### 5.4.2 shapely — Python 几何对象与运算（Python）

**技能定位：** Shapely 是 GEOS C++ 库的 Python 绑定，是 GeoPandas、PyQGIS 等 Python GIS 工具的几何运算底层依赖。它提供了 Python 生态中最原生的几何运算体验。

**文件规模：** 约 19 KB（476 行）。

**双 API 模式：** Shapely 同时提供**函数式 API**（`shapely.xxx()`）和**面向对象 API**（`geom.xxx()`）。函数式 API 支持 NumPy 数组向量化运算并释放 GIL，应当作为首选：

```python
import shapely
import numpy as np

geoms = np.array([shapely.Point(0, 0), shapely.Point(1, 1)])

# 函数式 API — 向量化，释放 GIL
shapely.area(geoms)              # array of floats
shapely.buffer(geoms, 1.0)       # array of polygons
shapely.contains(polygon, geoms) # array of bools

# 面向对象 API — 标量操作
from shapely import Point, Polygon
p = Point(0, 0)
poly = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
p.buffer(10)
poly.contains(p)
```

**运算符重载：** Shapely 提供了直觉化的几何运算符：

```python
geom1 & geom2    # intersection（相交）
geom1 | geom2    # union（合并）
geom1 - geom2    # difference（A 减去 B）
geom1 ^ geom2    # symmetric_difference（对称差）
```

**几何类型创建：**

```python
from shapely import Point, LineString, Polygon, MultiPoint

# 从坐标创建
p = Point(116.397, 39.908)
p3d = Point(116.397, 39.908, 100.0)  # 3D 点（Z 值仅存储，不参与运算）
line = LineString([(0, 0), (1, 1), (2, 0)])
poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
ring = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)],
                holes=[[(3, 3), (7, 3), (7, 7), (3, 7)]])  # 带孔洞

# 从 WKT 和 GeoJSON
from shapely import from_wkt, from_geojson
g1 = from_wkt("POINT (116.397 39.908)")
g2 = from_geojson('{"type":"Point","coordinates":[116.397,39.908]}')
```

**空间关系方法：**

```python
poly.contains(p)          # A 完全包含 B
poly.covers(p)            # 覆盖（比 contains 宽松）
poly.intersects(line)     # 是否相交
poly.touches(line)        # 边界接触
poly.within(other)        # A 在 B 内部
poly.crosses(line)        # 穿越
poly.overlaps(other)      # 重叠
poly.equals(other)        # 拓扑相等
poly.disjoint(other)      # 完全不相交
poly.relate(other)        # DE-9IM 矩阵字符串
```

**集合论运算：**

```python
result = shapely.intersection(a, b)         # 相交部分
result = shapely.union(a, b)                # 合并
result = shapely.union_all(geom_array)      # 多几何一次性合并
result = shapely.difference(a, b)           # A 减去 B
result = shapely.symmetric_difference(a, b) # 对称差
```

**重要注意事项（来自技能文件的 Caveats 节）：**

1. **Z 值被忽略**：所有空间分析仅作用于 x-y 平面，Z 值在运算中不参与
2. **`contains` 排除边界**：点在面的边界上时 `contains` 返回 `False`，如需包含边界请用 `covers()`
3. **`set_coordinates` 原地修改**：调用前先用 `.copy()` 保留原始对象
4. **函数式和 OOP 的 `buffer` 默认参数不同**：`Point(0,0).buffer(1)` 的 `quad_segs=16`，而 `shapely.buffer(Point(0,0), 1)` 的 `quad_segs=8`

---

### 5.4.3 geopandas — Python 矢量空间数据处理（Python）

**技能定位：** GeoPandas 是 Python 地理空间矢量数据处理的**核心库**——它在 pandas DataFrame 之上扩展了几何列，让你以操作表格的方式操作空间数据。GeoPandas 之于 GIS 相当于 pandas 之于数据科学。

**文件规模：** 约 21 KB（583 行）。

**核心类：** `GeoDataFrame` 继承 `pandas.DataFrame`，`GeoSeries` 继承 `pandas.Series`。这意味着所有 pandas 的操作（分组聚合、过滤、合并）都可以无缝用于空间数据。

```python
import geopandas as gpd

# 读取数据
gdf = gpd.read_file("data/cities.shp")

# 直接使用 pandas 方法
gdf.head()
gdf.describe()
gdf.groupby("country").agg({"population": "sum"})

# 访问几何列
gdf.geometry           # GeoSeries
gdf.geometry.area      # 每个要素的面积
gdf.geometry.boundary  # 每个要素的边界
gdf.geometry.centroid  # 每个要素的质心
```

**CRS 管理和投影变换：**

```python
# 查看当前 CRS
print(gdf.crs)  # EPSG:4326

# 投影变换
gdf_projected = gdf.to_crs("EPSG:3857")

# 设置 CRS（当源数据无 CRS 信息时）
gdf.crs = "EPSG:4326"
```

**空间连接（sjoin）：** 这是 GeoPandas 的核心能力——将两个 GeoDataFrame 按空间关系连接，类似 SQL 的 `JOIN` 但连接条件是空间谓词：

```python
# 找出每个 POI 所在的行区
result = gpd.sjoin(poi_gdf, districts_gdf, how="inner", predicate="within")

# predicate 选项：intersects/contains/within/touches/crosses/overlaps
```

**空间叠加（overlay）：**

```python
# 面与面的交集
intersect = gpd.overlay(parcels, flood_zones, how="intersection")

# 面与面的差集
remain = gpd.overlay(parcels, flood_zones, how="difference")

# 面与面的合并
combined = gpd.overlay(a, b, how="union")
```

**裁剪（clip）：**

```python
# 按范围框裁剪
clipped = gpd.clip(gdf, bbox=(xmin, ymin, xmax, ymax))

# 按多边形的空间范围裁剪（本质是 intersection）
clipped = gpd.clip(gdf, study_area_polygon)
```

**多格式读写：**

```python
# 读
gdf = gpd.read_file("data.shp")              # Shapefile
gdf = gpd.read_file("data.gpkg", layer="roads")  # GeoPackage
gdf = gpd.read_file("data.geojson")          # GeoJSON
gdf = gpd.read_parquet("data.parquet")       # GeoParquet
gdf = gpd.read_postgis("SELECT * FROM poi", con, geom_col="geom")  # PostGIS

# 写
gdf.to_file("output.shp")
gdf.to_file("output.gpkg", layer="roads", driver="GPKG")
gdf.to_file("output.geojson", driver="GeoJSON")
gdf.to_parquet("output.parquet")
gdf.to_postgis("poi", con, if_exists="replace")
```

**依赖关系：** GeoPandas 构建在多个 GIS 库之上：

| 核心依赖 | 用途 |
|:---------|:-----|
| `shapely` (>= 2.0) | 几何对象与运算 |
| `pyproj` (>= 3.5) | CRS 处理与坐标变换 |
| `pyogrio` (>= 0.7.2) | 默认文件 IO 引擎（基于 GDAL/OGR） |
| `pandas` (>= 2.0) | DataFrame 基类 |

---

### 5.4.4 geometry-api-java — Esri Geometry API for Java（Java）

**技能定位：** Esri Geometry API for Java 是一个**自包含**的 Java 几何计算库，不依赖任何外部 GIS 库，可直接嵌入 Hadoop MapReduce、Hive UDF、Spark 等大数据框架。它提供了 Esri 体系的几何对象模型，支持 2D/3D 几何、空间运算、JSON/GeoJSON/WKT/WKB 序列化。

**文件规模：** 约 12 KB（373 行）。

**维护状态提示：** 最新版本仍为 2.2.4（2020-09），已多年未更新。活跃项目建议优先选用 JTS。

**核心类：**

```java
import com.esri.core.geometry.*;

// GeometryEngine — 静态便捷方法入口
boolean result = GeometryEngine.contains(polygon, point, spatialRef);
Geometry buffer = GeometryEngine.buffer(geom, spatialRef, 100, null);

// 几何类型
Point pt = new Point(116.4, 39.9);
Polyline line = new Polyline();
line.startPath(0, 0);
line.lineTo(100, 100);
Polygon poly = new Polygon();
poly.startPath(0, 0);
poly.lineTo(10, 0); poly.lineTo(10, 10); poly.lineTo(0, 10);
poly.closeAllPaths();

// SpatialReference
SpatialReference sr = SpatialReference.create(4326);

// MapGeometry — 将 Geometry 与 SpatialReference 绑定
MapGeometry mg = new MapGeometry(geom, sr);
```

**JSON 序列化：** 这是该库的一个重要特色——直接支持 Esri JSON 格式的序列化，这是 ArcGIS 生态系统的标准数据交换格式：

```java
// GeoJSON → Geometry
MapGeometry mg = OperatorImportFromGeoJson.local()
    .execute(Geometry.Type.Unknown, geoJsonString, null);

// Geometry → GeoJSON
String geoJson = OperatorExportToGeoJson.local()
    .execute(spatialRef, geometry);

// Esri JSON → Geometry
MapGeometry mg = OperatorImportFromJson.local()
    .execute(Geometry.Type.Unknown, esriJsonString);
```

**适用场景：**

- 需要与 ArcGIS 服务通过 Esri JSON 格式交换数据
- 在 Java 大数据框架（Spark/Hive）中执行空间操作
- 需要在不引入 GeoTools 等重依赖的情况下做轻量级几何计算

---

### 5.4.5 geometry-api-net — Esri Geometry API for .NET（.NET）

**技能定位：** geometry-api-net 是 Esri Geometry API 的 .NET 版本。原 Esri 仓库已废弃（github.com/Esri/geometry-api-net），当前版本由 **znlgis 社区维护**，已重命名为 `OpenGIS.Esri.Geometry`。

**文件规模：** 约 19 KB（573 行）。

**NuGet 安装：**

```bash
dotnet add package Esri.Geometry.Core
dotnet add package Esri.Geometry.Json    # 可选，System.Text.Json 支持
```

**命名空间体系：**

| 命名空间 | 用途 |
|:---------|:-----|
| `OpenGIS.Esri.Geometry.Core` | 核心入口，GeometryEngine 便捷 API |
| `OpenGIS.Esri.Geometry.Core.Geometries` | 几何类型（Point, Polygon 等） |
| `OpenGIS.Esri.Geometry.Core.Operators` | 空间运算算子 |
| `OpenGIS.Esri.Geometry.Core.SpatialReference` | 空间参考/坐标系统 |
| `OpenGIS.Esri.Geometry.Core.IO` | 序列化（WKT, WKB, GeoJSON, Esri JSON） |
| `OpenGIS.Esri.Geometry.Json.Converters` | System.Text.Json 转换器 |

**几何类型：**

```csharp
using OpenGIS.Esri.Geometry.Core;
using OpenGIS.Esri.Geometry.Core.Geometries;

// 6 种几何类型
Point pt = new Point(116.397, 39.908);
MultiPoint mpt = new MultiPoint();
Polyline line = new Polyline();
Polygon poly = new Polygon();
Envelope env = new Envelope();
```

**空间运算：** 提供 25+ 种空间运算算子，涵盖关系判断、集合运算、几何构造：

```csharp
using OpenGIS.Esri.Geometry.Core.Operators;

// 空间关系
bool contains = GeometryEngine.Contains(poly, pt);
bool intersects = GeometryEngine.Intersects(a, b);

// 集合运算
Geometry result = GeometryEngine.Intersection(a, b);
Geometry union = GeometryEngine.Union(a, b);
Geometry diff = GeometryEngine.Difference(a, b);

// 缓冲区
Geometry buffer = GeometryEngine.Buffer(geom, 100);

// 大地测量运算
Geometry geoBuffer = GeometryEngine.GeodesicBuffer(geom, 1000);  // 距离单位为米
double geodesicDist = GeometryEngine.GeodesicDistance(p1, p2);    // 球面距离
```

**空间参考管理：**

```csharp
SpatialReference sr = SpatialReference.Create(4326);
SpatialReference webMercator = SpatialReference.Create(3857);
```

---

### 5.4.6 nettopologysuite — JTS 的 .NET 移植（.NET）

**技能定位：** NetTopologySuite（NTS）是 JTS 的 .NET 完整移植，API 与 JTS 几乎一一对应（仅命名风格从 Java Bean 转为 C# PascalCase）。它是 Mapsui、SharpMap 等 .NET GIS 组件的几何运算基础。

**文件规模：** 约 8 KB（254 行）。

**NuGet 安装：**

```bash
dotnet add package NetTopologySuite
dotnet add package NetTopologySuite.IO.GeoJSON
dotnet add package NetTopologySuite.IO.ShapeFile
dotnet add package ProjNet  # 坐标变换（可选）
```

**几何工厂：**

```csharp
using NetTopologySuite.Geometries;

var gf = new GeometryFactory(new PrecisionModel(), 4326);

var p = gf.CreatePoint(new Coordinate(116.397, 39.908));
var ls = gf.CreateLineString(new[] {
    new Coordinate(116, 39), new Coordinate(117, 40)
});
var poly = gf.CreatePolygon(new[] {
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10, 10), new Coordinate(0, 10),
    new Coordinate(0, 0)
});
```

**空间关系与运算：**

```csharp
// 空间谓词
bool b = polyA.Intersects(polyB);
bool contains = polyA.Contains(point);

// 集合运算
var inter = polyA.Intersection(polyB);
var union = polyA.Union(polyB);
var diff = polyA.Difference(polyB);
var buf = p.Buffer(100);
var hull = mp.ConvexHull();

// 几何度量
double area = poly.Area;
double len = ls.Length;

// 空间索引
var tree = new STRtree<string>();
tree.Insert(geom.EnvelopeInternal, "item1");
var results = tree.Query(envelope);
```

**EF Core 集成：** NTS 的一个独特优势是与 Entity Framework Core 的深度集成——空间属性可以自动翻译为数据库的空间 SQL：

```csharp
public class City
{
    public int Id { get; set; }
    public string Name { get; set; }
    public Point Location { get; set; }
}

// 查询：自动翻译为 PostGIS/SQL Server 的空间 SQL
var cities = await context.Cities
    .Where(c => c.Location.Distance(point) < 1000)
    .ToListAsync();
```

**与 JTS 的对应关系：** 如果你熟悉 JTS，NTS 的切换几乎零学习成本：

| JTS（Java） | NTS（C#） |
|:-----------|:----------|
| `GeometryFactory` | `GeometryFactory` |
| `Coordinate` | `Coordinate` |
| `WKTReader` / `WKTWriter` | `WKTReader` / `WKTWriter` |
| `STRtree` | `STRtree` |
| `PrecisionModel` | `PrecisionModel` |
| `intersection()` | `Intersection()` |

---

### 5.4.7 opengis-utils-for-java — Java GIS 工具集（Java）

**技能定位：** OGU4J（OpenGIS Utils for Java）是一个 J基于 GeoTools、JTS、GDAL/OGR 和 Esri Geometry API 的统一 Java GIS 工具集。它为常见的 GIS 操作提供了一站式的高级封装，降低了直接操作底层库的复杂度。

**文件规模：** 约 30 KB（728 行）。

**核心特性：**

- **统一图层模型** (`OguLayer`)：抽象了 Shapefile、GeoJSON、FileGDB、PostGIS 等多种数据源的读写，对外提供一致的接口
- **双引擎架构**：同时支持 GeoTools（纯 Java，无原生依赖）和 GDAL（通过 JNI 调用原生库，格式支持更全）。引擎工厂模式下自动选择最佳引擎
- **GeometryUtil**：60+ 静态几何运算方法，封装了 JTS 的常用操作
- **CRS 工具**：内置 CGCS2000（中国大地坐标系）的 WKT 定义，支持坐标系管理与转换

**统一图层模型：**

```java
// 读——不管源格式是什么，统一用 OguLayerUtil
OguLayer layer = OguLayerUtil.read("data.shp");
OguLayer layer = OguLayerUtil.read("data.geojson");
OguLayer layer = OguLayerUtil.read("data.gdb");  // File Geodatabase

// 遍历
for (OguFeature feature : layer.getFeatures()) {
    String wkt = feature.getGeometry();           // 几何以 WKT 存储
    Map<String, OguFieldValue> attrs = feature.getAttributes();
}

// 写
OguLayerUtil.write(layer, "output.gpkg", "GPKG");
```

**双引擎架构设计：**

```java
// 引擎选择
GisEngine engine = GisEngineFactory.create(GisEngineType.GDAL);     // 只用 GDAL
GisEngine engine = GisEngineFactory.create(GisEngineType.GEOTOOLS); // 只用 GeoTools
GisEngine engine = GisEngineFactory.create(GisEngineType.AUTO);     // 自动选择

// 通过引擎获取读写器
LayerReader reader = engine.getReader(DataFormatType.SHP);
LayerWriter writer = engine.getWriter(DataFormatType.GEOJSON);
```

**适用场景：**

- 需要在新项目中使用统一的 GIS 工具集，避免同时管理 GeoTools + JTS + GDAL 三套独立依赖
- 处理国产 GIS 格式（如国土调查的 TXT 格式，`GtTxtUtil` 支持）
- 需要 CGCS2000 坐标系的内置支持

---

### 5.4.8 opengis-utils-for-net — .NET GIS 工具集（.NET）

**技能定位：** OpenGIS Utils for .NET 是 OGU4J 的 .NET 对应版本，同样提供统一图层模型、双引擎架构和 50+ 几何工具方法。NuGet 包名为 `OpenGIS.Utils`。

**文件规模：** 约 26 KB（786 行）。

**项目结构：**

```
src/OpenGIS.Utils/
├── Configuration/        # GdalConfiguration, LibrarySettings
├── DataSource/           # OguLayerUtil（高级 I/O 入口）
├── Engine/
│   ├── Enums/            # GeometryType, FieldDataType, DataFormatType...
│   ├── IO/               # ILayerReader, ILayerWriter 接口
│   ├── Model/Layer/      # OguLayer, OguFeature, OguField...
│   └── Util/             # CrsUtil, OgrUtil, ShpUtil, PostgisUtil...
├── Geometry/             # GeometryUtil（50+ 静态方法）
└── Utils/                # EncodingUtil, ZipUtil 等通用工具
```

**NuGet 安装与使用：**

```bash
dotnet add package OpenGIS.Utils
```

**核心模式与 Java 版完全一致：**

```csharp
using OpenGIS.Utils.DataSource;
using OpenGIS.Utils.Engine;
using OpenGIS.Utils.Engine.Enums;

// 统一读写
var layer = OguLayerUtil.Read("data.shp");
OguLayerUtil.Write(layer, "output.gpkg", "GPKG");

// 引擎选择
var engine = GisEngineFactory.Create(GisEngineType.AUTO);
var reader = engine.GetReader(DataFormatType.SHP);
```

**许可证差异：** OGU4J 使用 LGPL-2.1-or-later，而 .NET 版使用 Apache-2.0——后者对商业集成更友好。

---

## 5.5 地图服务器

地图服务器是 GIS 数据的**输出层**——数据经过处理、存储后，通过地图服务器以标准 OGC 协议（WMS/WFS 等）对外发布，供 Web 前端和其他客户端消费。opengis-skills 涵盖 GeoServer 的三个层面：单体部署、REST 管理、云原生架构。

### 5.5.1 geoserver — 开源地图服务器

**技能定位：** GeoServer 是基于 Java 的开源地图服务器，实现了 OGC 的全套标准协议栈：WMS（地图图像）、WF（矢要素）、WMTS（瓦片地图）、WCS（栅格覆盖）、WPS（空间处理）。本技能聚焦于 GeoServer 的服务端运维与配置。

**文件规模：** 约 7 KB（232 行）。

**核心概念层次：**

```
Workspace（工作空间——命名空间隔离）
  └── Store（数据存储——指向具体数据源）
        └── Layer（图层——Store 中的一个资源 + 样式 = 一个图层）
              └── Style（样式——SLD/CSS 渲染规则）
```

**部署方式：**

```bash
# 二进制部署
wget https://sourceforge.net/projects/geoserver/files/GeoServer/3.0.0/geoserver-3.0.0-bin.zip
unzip geoserver-3.0.0-bin.zip && cd geoserver-3.0.0
sh bin/startup.sh              # http://localhost:8080/geoserver  (admin/geoserver)

# Docker 部署
docker run --name gs -p 8080:8080 \
  -e EXTRA_JAVA_OPTS="-Xms512m -Xmx2g" \
  -v $PWD/data:/opt/geoserver_data \
  docker.osgeo.org/geoserver:3.0.0
```

**支持的数据源：** PostGIS、Shapefile、GeoPackage、Oracle Spatial、SQL Server、ArcSDE、GeoTIFF、ImageMosaic、NetCDF、JPEG2000 等。

**样式系统：** 支持四种样式语言：

- **SLD**（Styled Layer Descriptor）：OGC 标准，XML 格式，最通用
- **CSS**：类 CSS 语法，更易读易写
- **YSLD**：YAML 格式的 SLD 替代，更简洁
- **MBStyle**：MapBox Style 规范的 GeoServer 实现

**缓存策略：** GeoWebCache（GWC）集成在 GeoServer 内部，自动缓存 WMS 切图结果为瓦片，大幅提升重复请求的响应速度。支持将瓦片存储为文件系统、S3、Azure Blob 等后端。

**GeoServer 在 GIS 技能链中的位置：** 它是地图发布的核心环节。典型工作流：PostGIS 中存储经过 GDAL 处理的数据 → GeoServer 从 PostGIS 读取并配置样式 → OpenLayers/CesiumJS 前端通过 WMS/WMTS 协议加载地图。

---

### 5.5.2 geoserver-rest-api — GeoServer REST 管理 API

**技能定位：** GeoServer 的 Web UI 适合手工操作，但在自动化场景（CI/CD、批量配置、AI 编程助手操作）中，REST API 才是正确的入口。这个技能覆盖 GeoServer REST API 的完整端点——工作空间、数据存储、图层、样式、图层组的完整 CRUD 操作。

**文件规模：** 约 20 KB（468 行）。

**认证方式：**

```bash
# HTTP Basic Auth（默认）
curl -u admin:geoserver http://localhost:8080/geoserver/rest/workspaces.json

# 在代码中
headers = {"Authorization": "Basic " + base64("admin:geoserver")}
```

**核心端点速查：**

| 资源 | 列出 | 创建 | 更新 | 删除 |
|:-----|:-----|:-----|:-----|:-----|
| 工作空间 | `GET /rest/workspaces.json` | `POST /rest/workspaces` | `PUT /rest/workspaces/{ws}` | `DELETE /rest/workspaces/{ws}?recurse=true` |
| 数据存储 | `GET /rest/workspaces/{ws}/datastores.json` | `POST /rest/workspaces/{ws}/datastores` | `PUT /rest/workspaces/{ws}/datastores/{ds}` | `DELETE /rest/workspaces/{ws}/datastores/{ds}?recurse=true` |
| 图层 | `GET /rest/layers.json` | `POST /rest/workspaces/{ws}/datastores/{ds}/featuretypes` | `PUT /rest/workspaces/{ws}/datastores/{ds}/featuretypes/{ft}` | `DELETE /rest/workspaces/{ws}/datastores/{ds}/featuretypes/{ft}?recurse=true` |
| 样式 | `GET /rest/styles.json` | `POST /rest/styles` | `PUT /rest/styles/{style}` | `DELETE /rest/styles/{style}` |
| 图层组 | `GET /rest/layergroups.json` | `POST /rest/layergroups` | `PUT /rest/layergroups/{lg}` | `DELETE /rest/layergroups/{lg}` |

**Python 自动化示例：**

```python
import requests

BASE = "http://localhost:8080/geoserver/rest"
AUTH = ("admin", "geoserver")

# 创建工作空间
resp = requests.post(f"{BASE}/workspaces", auth=AUTH, json={
    "workspace": {"name": "myworkspace"}
})

# 创建 PostGIS 数据存储
resp = requests.post(
    f"{BASE}/workspaces/myworkspace/datastores",
    auth=AUTH,
    headers={"Content-Type": "application/json"},
    json={
        "dataStore": {
            "name": "mydb",
            "type": "PostGIS",
            "connectionParameters": {
                "host": "localhost", "port": "5432",
                "database": "gisdb", "user": "gisuser",
                "passwd": "gispass", "dbtype": "postgis"
            }
        }
    }
)

# 发布图层
resp = requests.post(
    f"{BASE}/workspaces/myworkspace/datastores/mydb/featuretypes",
    auth=AUTH,
    headers={"Content-Type": "application/json"},
    json={
        "featureType": {
            "name": "poi",
            "nativeName": "poi",
            "title": "POI Points",
            "srs": "EPSG:4326"
        }
    }
)

# 上传 SLD 样式
with open("style.sld", "r") as f:
    sld_content = f.read()
resp = requests.post(
    f"{BASE}/styles",
    auth=AUTH,
    headers={"Content-Type": "application/vnd.ogc.sld+xml"},
    data=sld_content,
    params={"name": "mystyle"}
)

# 将样式应用到图层
resp = requests.put(
    f"{BASE}/layers/myworkspace:poi",
    auth=AUTH,
    headers={"Content-Type": "application/json"},
    json={"layer": {"defaultStyle": {"name": "mystyle"}}}
)

# 重新加载配置（使更改生效）
requests.post(f"{BASE}/reload", auth=AUTH)

# 重置缓存
requests.post(f"{BASE}/reset", auth=AUTH)
```

**AI 编程助手的典型用法：** 当用户说"帮我发布这个 Shapefile 到 GeoServer"，AI 加载此技能后，将按以下步骤生成代码：1) 创建工作空间 2) 创建 Shapefile 数据存储（或先用 ogr2ogr 导入 PostGIS） 3) 发布图层 4) 应用默认样式 5) 验证 WMS GetCapabilities 响应。

---

### 5.5.3 geoserver-cloud — 云原生微服务架构

**技能定位：** GeoServer Cloud 将传统的单体 GeoServer 按 OGC 服务类型拆分为多个独立的 Spring Boot 微服务，支持 Kubernetes 编排、自动扩缩容和集中配置管理。它 **100% 兼容社区版 GeoServer** 的 Web UI、SLD 样式和数据存储配置。

**文件规模：** 约 7 KB（240 行）。

**服务拆分：**

| 服务 | 镜像 | 用途 |
|:-----|:-----|:-----|
| `gateway` | `geoservercloud/geoserver-cloud-gateway` | API 网关，统一入口 |
| `discovery` | `geoservercloud/geoserver-cloud-discovery` | 服务注册与发现（Eureka） |
| `config` | `geoservercloud/geoserver-cloud-config` | 集中配置中心 |
| `web-ui` | `geoservercloud/geoserver-cloud-webui` | 管理界面 |
| `rest` | `geoservercloud/geoserver-cloud-rest` | REST API 服务 |
| `wms` | `geoservercloud/geoserver-cloud-wms` | WMS 服务（可按需独立扩展） |
| `wfs` | `geoservercloud/geoserver-cloud-wfs` | WFS 服务 |
| `wcs` | `geoservercloud/geoserver-cloud-wcs` | WCS 服务 |
| `wps` | `geoservercloud/geoserver-cloud-wps` | WPS 服务 |
| `gwc` | `geoservercloud/geoserver-cloud-gwc` | GeoWebCache 瓦片缓存 |

**核心价值：** 在传统单体 GeoServer 中，WMS 的高并发压力会导致 WFS 服务响应变慢——因为它们共享同一个 JVM。在 Cloud 架构中，WMS 服务可以独立扩容到 10 个实例而 WFS 仍然保持 2 个实例，资源利用效率大幅提升。

**快速启动：**

```bash
git clone https://github.com/geoserver/geoserver-cloud.git
cd geoserver-cloud/compose
docker compose -f compose.yml -f catalog-pgconfig.yml up -d
# Gateway: http://localhost:9090/geoserver
```

**配置后端选择：**

| 后端 | 适用场景 | 说明 |
|:-----|:---------|:-----|
| `datadir` | 简单场景 | 共享卷（NFS/PVC），配置以文件形式存储，各实例挂载同一目录 |
| `pgconfig` | 生产推荐 | PostgreSQL 存储配置，强一致性，支持事务 |
| `jdbcconfig` | 旧方案 | 已被 pgconfig 替代，不推荐新项目使用 |

**启用 PgConfig（生产推荐）：**

```yaml
GEOSERVER_BACKEND_PGCONFIG_ENABLED: "true"
GEOSERVER_BACKEND_PGCONFIG_JDBCURL: "jdbc:postgresql://pg:5432/gsconfig"
GEOSERVER_BACKEND_PGCONFIG_USERNAME: "gs"
GEOSERVER_BACKEND_PGCONFIG_PASSWORD: "gs"
```

**可观测性：** 每个微服务都暴露 Actuator 端点，集成 Prometheus 采集指标和 Sleuth 分布式链路追踪，解决微服务架构下的故障定位难题。

---

## 5.6 QGIS 生态 — PyQGIS

**技能定位：** PyQGIS 是 QGIS 桌面的 Python 绑定层，将 QGIS 核心 C++ 类库（`qgis.core`、`qgis.gui`、`qgis.analysis` 等）完整暴露给 Python。它让开发者可以编写独立 Python 脚本（无需启动 QGIS 桌面）、开发 QGIS 插件、调用 Processing 框架执行空间分析。

**文件规模：** 约 28 KB（1004 行），深度覆盖矢量图层操作、栅格图层操作、地图渲染、Processing 算法调用和插件开发。

**主要模块：**

| 模块 | 说明 |
|:-----|:-----|
| `qgis.core` | 核心类——图层、要素、几何、坐标参考系、项目、Processing 框架 |
| `qgis.gui` | GUI 组件——地图画布（QgsMapCanvas）、地图工具、符号选择器 |
| `qgis.analysis` | 空间分析——插值、网络分析、栅格计算 |
| `qgis.processing` | Processing 算法调用入口（`processing.run()`） |
| `qgis.server` | QGIS Server Python 插件接口 |

**独立脚本初始化：**

```python
import sys
from qgis.core import QgsApplication

qgs = QgsApplication([], False)  # False = 不使用 GUI
qgs.setPrefixPath("/usr", True)   # 设置 QGIS 安装路径
qgs.initQgis()

# === PyQGIS 代码 ===

qgs.exitQgis()
```

**矢量图层操作：**

```python
from qgis.core import (
    QgsVectorLayer, QgsFeature, QgsGeometry, QgsPointXY,
    QgsField, QgsFields, QgsProject
)

# 加载矢量图层
layer = QgsVectorLayer("data/roads.shp", "Roads", "ogr")
if not layer.isValid():
    raise Exception("图层加载失败")

# 属性查询
for feature in layer.getFeatures():
    geom = feature.geometry()
    name = feature["NAME"]
    print(f"{name}: {geom.length()}")

# 空间过滤（只处理视口范围内的要素）
layer.selectByRect(QgsRectangle(116.0, 39.5, 117.0, 40.5))
for feature in layer.selectedFeatures():
    process(feature)

# 编辑模式——修改属性
layer.startEditing()
for feature in layer.getFeatures():
    layer.changeAttributeValue(feature.id(),
        layer.fields().indexOf("STATUS"), "PROCESSED")
layer.commitChanges()

# 编辑模式——修改几何
layer.startEditing()
for feature in layer.getFeatures():
    geom = feature.geometry()
    buffered = geom.buffer(100, 5)
    layer.changeGeometry(feature.id(), buffered)
layer.commitChanges()
```

**地图渲染：**

```python
from qgis.core import QgsMapSettings, QgsMapRendererCustomPainterJob
from qgis.gui import QgsMapCanvas
from PyQt5.QtGui import QImage, QPainter

# 渲染到图像文件
settings = QgsMapSettings()
settings.setLayers([layer])
settings.setOutputSize(QSize(800, 600))
settings.setExtent(QgsRectangle(116.0, 39.5, 117.0, 40.5))

image = QImage(QSize(800, 600), QImage.Format_ARGB32)
image.fill(Qt.white)
painter = QPainter(image)
renderer = QgsMapRendererCustomPainterJob(settings, painter)
renderer.start()
renderer.waitForFinished()
painter.end()
image.save("output.png")
```

**调用 Processing 算法：**

```python
import processing

# 运行 Processing 算法（与 qgis_process 命令行对应）
result = processing.run("native:buffer", {
    "INPUT": "data/roads.shp",
    "DISTANCE": 500,
    "SEGMENTS": 30,
    "OUTPUT": "memory:"  # 返回内存临时图层
})
buffered_layer = result["OUTPUT"]

# 处理结果可以直接继续分析
clip_result = processing.run("native:clip", {
    "INPUT": buffered_layer,
    "OVERLAY": "data/boundary.shp",
    "OUTPUT": "output/clipped.shp"
})
```

**插件开发要点：** PyQGIS 技能文件覆盖了 QGIS 插件开发的核心模式——通过实现 `QgsProcessingAlgorithm` 将自定义算法注册到 Processing 工具箱中，以及通过 `QgsMapTool` 创建自定义地图交互工具。

---

## 5.7 Web 地图可视化

Web 地图可视化是 GIS 数据的**最终呈现层**——用户看到的地图、交互、可视化效果在这一层产生。opengis-skills 覆盖了 Web GIS 的两大主流库：2D 的 OpenLayers 和 3D 的 CesiumJS。

### 5.7.1 cesiumjs — 3D 地球可视化（JavaScript）

**技能定位：** CesiumJS 是基于 WebGL 的高性能 3D 地球引擎，支持海量三维数据（3D Tiles）的流式加载、时序动画（CZML）和 glTF/GLB 模型的 PBR 渲染。

**文件规模：** 约 9 KB（284 行）。

**快速上手：**

```html
<div id="cesiumContainer" style="width:100%;height:100vh"></div>
<script type="module">
  import * as Cesium from 'cesium';
  import 'cesium/Build/Cesium/Widgets/widgets.css';

  Cesium.Ion.defaultAccessToken = 'YOUR_ION_TOKEN';

  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: await Cesium.createWorldTerrainAsync(),
    timeline: false,
    animation: false
  });

  // 相机飞行到指定位置
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.397, 39.908, 5000),
    orientation: { heading: 0, pitch: -30, roll: 0 }
  });
</script>
```

**Entity API（高层声明式）：**

```javascript
// 添加点
viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(116.397, 39.908),
  point: { pixelSize: 10, color: Cesium.Color.RED }
});

// 添加面
viewer.entities.add({
  polygon: {
    hierarchy: Cesium.Cartesian3.fromDegreesArray([
      116.0, 39.5, 117.0, 39.5, 117.0, 40.5, 116.0, 40.5
    ]),
    material: Cesium.Color.BLUE.withAlpha(0.5)
  }
});

// 添加 3D 模型（glTF）
viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(116.397, 39.908, 100),
  model: {
    uri: 'model.glb',
    scale: 10
  }
});
```

**3D Tiles 加载：** CesiumJS 的核心能力是加载 OGC 3D Tiles 规范的三维场景——倾斜摄影、BIM 模型、点云数据、城市模型：

```javascript
const tileset = viewer.scene.primitives.add(
  await Cesium.Cesium3DTileset.fromUrl('tileset.json')
);

// 定位到 tileset
viewer.zoomTo(tileset);

// 自定义样式（按属性着色）
tileset.style = new Cesium.Cesium3DTileStyle({
  color: '${Height} > 100 ? color("red") : color("blue")'
});
```

**CZML 时序数据：** CZML（Cesium Language）是 Cesium 的 JSON 格式时序数据描述语言，用于展示随时间变化的动态场景：

```javascript
const czml = [{
  id: "document", version: "1.0",
  clock: { interval: "2024-01-01T00:00:00Z/2024-01-01T23:59:59Z", currentTime: "2024-01-01T12:00:00Z" }
}, {
  id: "satellite",
  position: {
    interpolationAlgorithm: "LAGRANGE",
    epoch: "2024-01-01T00:00:00Z",
    cartesian: [/* ... 时序坐标数据 ... */]
  }
}];

viewer.dataSources.add(Cesium.CzmlDataSource.load(czml));
```

**地形和影像图层：**

```javascript
// 全球地形
viewer.terrainProvider = await Cesium.createWorldTerrainAsync({
  requestWaterMask: true,  // 水面效果
  requestVertexNormals: true  // 光照计算
});

// 自定义影像图层
viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: 'https://tile.example.com/{z}/{x}/{y}.png'
  })
);
```

**相机控制：**

```javascript
// 飞行到指定视点
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
  orientation: { heading: heading, pitch: pitch, roll: 0 },
  duration: 3
});

// 锁定视角跟随 Entity
viewer.trackedEntity = entity;
```

---

### 5.7.2 openlayers — Web 2D 地图库（JavaScript）

**技能定位：** OpenLayers 是全功能的开源 JavaScript Web 地图库，支持 WMS/WFS/WMTS/矢量瓦片/GeoJSON 等丰富的图层类型、交互编辑和样式定制。

**文件规模：** 约 7 KB（276 行）。

**安装与基础地图：**

```bash
npm install ol
```

```javascript
import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  view: new View({
    center: [12968000, 4863000],  // EPSG:3857（Web Mercator 米制坐标）
    zoom: 10
  })
});
```

**图层与数据源：**

```javascript
import XYZ from 'ol/source/XYZ.js';
import TileWMS from 'ol/source/TileWMS.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';

// XYZ 瓦片底图
const xyzLayer = new TileLayer({
  source: new XYZ({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' })
});

// WMS 图层
const wmsLayer = new TileLayer({
  source: new TileWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: { LAYERS: 'myworkspace:mylayer', TILED: true }
  })
});

// GeoJSON 矢量图层
const vectorLayer = new VectorLayer({
  source: new VectorSource({
    url: 'data.geojson',
    format: new GeoJSON()
  })
});

map.addLayer(vectorLayer);
```

**样式定制：**

```javascript
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Circle from 'ol/style/Circle.js';

// 图层级别样式
vectorLayer.setStyle(new Style({
  fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
  stroke: new Stroke({ color: '#ff0000', width: 2 }),
  image: new Circle({ radius: 6, fill: new Fill({ color: '#ff0000' }) })
}));

// 按属性函数式样式
vectorLayer.setStyle((feature) => {
  const type = feature.get('type');
  if (type === 'highway') {
    return highwayStyle;
  }
  return defaultStyle;
});
```

**交互与控件：**

```javascript
// 绘制交互
import Draw from 'ol/interaction/Draw.js';
const draw = new Draw({ source: vectorSource, type: 'Polygon' });
map.addInteraction(draw);

// 选择交互
import Select from 'ol/interaction/Select.js';
const select = new Select();
map.addInteraction(select);
select.on('select', (e) => {
  console.log(e.selected[0].getProperties());
});

// 弹出信息窗口
import Overlay from 'ol/Overlay.js';
const popup = new Overlay({
  element: document.getElementById('popup'),
  positioning: 'bottom-center'
});
map.addOverlay(popup);
map.on('click', (evt) => {
  const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
  if (feature) {
    popup.setPosition(evt.coordinate);
    document.getElementById('popup-content').innerHTML = feature.get('name');
  }
});
```

**矢量瓦片：**

```javascript
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import MVT from 'ol/format/MVT.js';

const vtLayer = new VectorTileLayer({
  source: new VectorTileSource({
    format: new MVT(),
    url: 'http://localhost:8080/geoserver/gwc/service/tms/1.0.0/mylayer@EPSG:900913@pbf/{z}/{x}/{y}.pbf'
  })
});
```

**核心概念速查表：**

| 类 | 作用 |
|:---|:-----|
| `Map` | 顶层容器——地图实例 |
| `View` | 视图——控制投影、中心点、缩放、旋转 |
| `Layer` | 图层——数据 + 样式的组合 |
| `Source` | 数据源——从哪里获取数据（WMS/WMTS/XYZ/GeoJSON） |
| `Feature` / `Geometry` | 矢量要素与几何（Point/LineString/Polygon） |
| `Style` | 样式——控制要素的外观 |
| `Interaction` | 交互——Draw/Select/Modify/Snap 等用户交互行为 |

---

## 5.8 .NET GIS 组件

### 5.8.1 sharpmap — .NET 传统 2D 地图组件（.NET）

**技能定位：** SharpMap 是一个较早期的 .NET 2D 地图渲染库，面向 WinForms 和 ASP.NET WebForms。技能文件明确指出：**新项目建议改用 Mapsui**。SharpMap 更适合维护已有（通常是 .NET Framework 时代的）GIS 应用。

**文件规模：** 约 8 KB（301 行）。

**核心数据源支持：** Shapefile、PostGIS、SQL Server Spatial、Oracle Spatial、SQLite/SpatiaLite、WMS、WF、OSM/Bing 瓦片。

**核心对象：**

```csharp
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;

var map = new Map(new Size(800, 600));

// Shapefile 图层
var prov = new ShapeFile("countries.shp", true);
var layer = new VectorLayer("countries", prov)
{
    Style = new VectorStyle {
        Fill = new SolidBrush(Color.LightGreen),
        Outline = Pens.Black,
        EnableOutline = true
    }
};
map.Layers.Add(layer);

// 缩放至全图
map.ZoomToExtents();
```

**架构依赖：** SharpMap 底层几何运算依赖 NetTopologySuite，坐标变换依赖 ProjNet（`ProjNet4GeoAPI`）。如果不打算升级到 Mapsui 但仍需维护 SharpMap 应用，对 NTS 的了解是必要的。

**注意：** SharpMap 主要目标平台是 .NET Framework（4.x），对 .NET 6+/8+ 的兼容性有限。其渲染基于 `System.Drawing`（GDI+），在 Linux 环境下问题较多。这是技能文件建议迁移到 Mapsui 的核心原因——Mapsui 使用 SkiaSharp 渲染，跨平台无兼容问题。

---

### 5.8.2 mapsui — .NET 跨平台地图控件（.NET）

**技能定位：** Mapsui 是推荐的 .NET 地图控件，跨 WPF、MAUI、Avalonia、Uno Platform、Blazor 和 WinForms。它是 SharpMap 的精神继任者但采用了更现代的架构和 SkiaSharp 渲染引擎。

**文件规模：** 约 8 KB（279 行）。

**安装：**

```bash
dotnet add package Mapsui.Wpf    # 或 Mapsui.Maui / Mapsui.Avalonia / Mapsui.Blazor
dotnet add package Mapsui.Tiling
dotnet add package Mapsui.Nts
```

**WPF 入门：**

```xml
<!-- XAML -->
<Window xmlns:mapsui="clr-namespace:Mapsui.UI.Wpf;assembly=Mapsui.UI.Wpf">
    <mapsui:MapControl x:Name="MapControl"/>
</Window>
```

```csharp
// C# Code-Behind
using Mapsui;
using Mapsui.Tiling;
using Mapsui.Projections;

var map = new Map();
map.Layers.Add(OpenStreetMap.CreateTileLayer());

// 坐标转换：WGS84 → Web Mercator
var pt = SphericalMercator.FromLonLat(116.397, 39.908).ToMPoint();
map.Navigator.CenterOnAndZoomTo(pt, map.Navigator.Resolutions[10]);

MapControl.Map = map;
```

**核心概念：**

| 类型 | 说明 |
|:-----|:-----|
| `Map` | 地图——包含所有图层 |
| `Layer` / `MemoryLayer` / `ImageLayer` / `TileLayer` | 图层——不同类型的数据承载 |
| `IProvider` | 数据提供者——从不同来源读取 GIS 数据 |
| `IFeature` / `GeometryFeature` | 要素——内部使用 NTS 几何 |
| `IStyle` / `VectorStyle` / `LabelStyle` / `SymbolStyle` | 样式系统 |
| `Navigator` | 视图操作——缩放、平移、旋转 |

**数据源支持：** OSM / WMS / WMTS / TMS / XYZ 瓦片、Shapefile / GeoJSON / MBTiles / PostGIS。通过 `Mapsui.Nts` 扩展包与 NetTopologySuite 几何对象互操作。

**触控交互：** 内置拖动、缩放、旋转、双指捏合和要素命中检测，在移动端（MAUI）上有原生体验。

**离线模式：** 支持从 MBTiles 文件读取离线矢量/栅格瓦片，适合野外作业场景。

**与 SharpMap 的迁移路径：** 两个库都基于 NetTopologySuite，且 Mapsui 提供更现代的渲染管道（SkiaSharp 替代 GDI+）和更广泛的平台支持。从 SharpMap 迁移到 Mapsui 的主要工作是重写图层和样式的创建代码——数据读取层（基于 NTS）基本可以复用。

---

## 5.9 综合型技能

### 5.9.1 opengis-all — 一站式 GIS 全流程索引

**技能定位：** `opengis-all` 是 GIS 技能类中的一个特殊存在——它不聚焦于单个工具，而是**聚合了 GDAL、GDAL API、qgis_process、PyQGIS 和 GeoServer REST API 五个技能**，以端到端 GIS 工作流的形式组织内容。

**文件规模：** 约 40 KB（1359 行），是 GIS 类中第二大文件（仅次于 gdal-api）。

**四阶段工作流：**

```
阶段一          阶段二          阶段三          阶段四
数据获取        数据处理        空间分析        服务发布
与生成    →     与转换    →             →   
· 读取各类      · 格式转换      · 缓冲区分析    · 创建工作空间
  矢量/栅格     · 坐标系转换    · 叠加分析      · 上传数据
· 创建新数据    · 裁剪/合并     · 栅格计算      · 发布图层
· 查询元数据    · 元数据编辑    · DEM分析       · 配置样式
                                · 统计分析      · 图层组/缓存

工具映射：
  阶段一：GDAL CLI · GDAL API · PyQGIS
  阶段二：GDAL CLI · GDAL API · qgis_process · PyQGIS
  阶段三：qgis_process · PyQGIS · GDAL CLI · GDAL API
  阶段四：GeoServer REST API
```

**设计特点：** 每个阶段同时展示多种工具的等价用法，让 AI 可以根据用户的技术栈（Python 开发者 vs 命令行用户 vs 全流程自动化需求）选择最合适的方案：

```bash
# 同一操作（矢量重投影）的三种等效方式

## GDAL 命令行
ogr2ogr -t_srs EPSG:3857 output.shp input.shp

## GDAL Python API
gdal.VectorTranslate("output.shp", "input.shp",
    options="-t_srs EPSG:3857")

## qgis_process
qgis_process run native:reprojectlayer -- \
    INPUT=input.shp TARGET_CRS=EPSG:3857 OUTPUT=output.shp
```

**完整实战案例：** 技能文件包含"从 TIF 下载到 WMS 发布"的完整代码示例，覆盖了：

1. 用 `gdal_translate` / `gdalwarp` 处理下载的栅格数据
2. 用 `gdal_calc.py` 做 NDVI 分析
3. 用 `gdal_polygonize.py` 将栅格转为矢量
4. 用 `ogr2ogr` 将矢量导入 PostGIS
5. 用 GeoServer REST API 创建数据存储并发布 WMS 图层

这个文件是 GIS 开发者快速体验完整工作流的最佳入口——它不是重复其他技能的内容，而是展示**技能之间的协作模式**。

---

### 5.9.2 geotools — Java GIS 工具集（Java）

**技能定位：** GeoTools 是一个成熟、模块化的开源 Java GIS 库，由 OSGeo 基金会管理。它是 GeoServer 和 uDig 的底层 GIS 引擎，也是 OGC 标准的 Java 参考实现。

**文件规模：** 约 23 KB（622 行）。

**核心能力：**

- **矢量数据访问**：Shapefile、GeoPackage、GeoJSON、PostGIS、Oracle Spatial、SQL Server 等，通过统一的 `DataStore` 接口
- **栅格数据访问**：GeoTIFF、NetCDF、ImageMosaic 等，通过 `GridCoverageReader` 接口
- **坐标参考系统 (CRS)**：基于 EPSG 数据库的完整投影定义与坐标转换
- **空间查询与过滤**：CQL / ECQL（类似 SQL 的空间查询语言）、OGC Filter 编码标准
- **地图渲染**：基于 SLD/SE（Symbology Encoding）的制图样式与栅格/矢量图片输出
- **OGC Web 服务客户端**：WMS / WFS / WCS 客户端，可直接从远程地图服务拉取数据
- **几何运算**：基于 JTS Topology Suite 的全套几何计算

**环境要求：** JDK 11+（GeoTools 21-33）；JDK 17+（GeoTools 34+）。

**Maven 集成：**

```xml
<!-- OSGeo 仓库 -->
<repositories>
    <repository>
        <id>osgeo</id>
        <url>https://repo.osgeo.org/repository/release/</url>
    </repository>
</repositories>

<!-- 常用模块 -->
<dependency>
    <groupId>org.geotools</groupId>
    <artifactId>gt-main</artifactId>        <!-- 核心 -->
</dependency>
<dependency>
    <groupId>org.geotools</groupId>
    <artifactId>gt-shapefile</artifactId>   <!-- Shapefile 支持 -->
</dependency>
<dependency>
    <groupId>org.geotools</groupId>
    <artifactId>gt-geotiff</artifactId>     <!-- GeoTIFF 栅格支持 -->
</dependency>
<dependency>
    <groupId>org.geotools</groupId>
    <artifactId>gt-postgis</artifactId>     <!-- PostGIS 支持 -->
</dependency>
<dependency>
    <groupId>org.geotools</groupId>
    <artifactId>gt-wms</artifactId>         <!-- WMS 客户端 -->
</dependency>
```

**Feature 数据模型：**

```java
import org.geotools.api.data.*;
import org.geotools.api.feature.simple.*;
import org.geotools.data.shapefile.*;

// 打开 Shapefile
File file = new File("roads.shp");
DataStore store = new ShapefileDataStore(file.toURI().toURL());
String typeName = store.getTypeNames()[0];
SimpleFeatureSource source = store.getFeatureSource(typeName);

// 空间查询（CQL 过滤）
Filter filter = CQL.toFilter("NAME LIKE 'Highway%' AND INTERSECTS(geom, POLYGON((...))))");
SimpleFeatureCollection features = source.getFeatures(filter);

// 遍历结果
try (SimpleFeatureIterator it = features.features()) {
    while (it.hasNext()) {
        SimpleFeature feature = it.next();
        Geometry geom = (Geometry) feature.getDefaultGeometry();
        String name = (String) feature.getAttribute("NAME");
    }
}
```

**CQL / ECQL 空间查询语言：**

```java
// CQL 示例——类 SQL 的空间查询
"POPULATION > 1000000"
"NAME = 'Beijing'"
"INTERSECTS(geom, POLYGON((116 39, 117 39, 117 40, 116 40, 116 39)))"
"DWITHIN(geom, POINT(116.4 39.9), 10, kilometers)"
"POPULATION > 500000 AND AREA > 1000"
```

**CRS 变换：**

```java
import org.geotools.api.referencing.crs.CoordinateReferenceSystem;
import org.geotools.referencing.CRS;

CoordinateReferenceSystem srcCRS = CRS.decode("EPSG:4326");
CoordinateReferenceSystem tgtCRS = CRS.decode("EPSG:3857");

MathTransform transform = CRS.findMathTransform(srcCRS, tgtCRS);
Geometry transformed = JTS.transform(geom, transform);
```

**栅格处理（GridCoverage）：**

```java
import org.geotools.coverage.grid.*;

// 读取 GeoTIFF
File tiffFile = new File("dem.tif");
AbstractGridFormat format = GridFormatFinder.findFormat(tiffFile);
GridCoverage2DReader reader = format.getReader(tiffFile);
GridCoverage2D coverage = reader.read(null);

// 访问栅格属性
Envelope2D envelope = coverage.getEnvelope2D();
CoordinateReferenceSystem crs = coverage.getCoordinateReferenceSystem2D();
```

**GeoTools 在技能链中的位置：** 它之于 Java GIS 开发等同于 gdal-api + geopandas + shapely 之于 Python GIS 开发——是一个完整的工具箱。如果你在用 Java 构建 GIS 应用，GeoTools 通常是第一个也是唯一需要的 GIS 依赖。

---

## 5.10 GIS 技能选择决策树

面对 23 个 GIS 技能，如何根据实际需求快速选择正确的技能（或技能组合）？以下决策树提供了从「需求描述」到「推荐技能」的完整映射关系：

```
我需要用 GIS 技能解决什么问题？
│
├─ 命令行/脚本批量处理数据
│   ├─ 格式转换/重投影/裁剪 → gdal（ogr2ogr/gdalwarp/gdal_translate）
│   ├─ DEM 分析/NDVI 计算 → gdal（gdal_calc/gdal_dem）
│   ├─ 需要 QGIS 特有算法 → qgis-process
│   └─ AI 生成 YAML 替代手写代码 → geopipe-agent
│
├─ 用编程语言开发 GIS 功能
│   ├─ Python
│   │   ├─ DataFrame 风格的空间数据分析 → geopandas
│   │   ├─ 纯几何运算 → shapely
│   │   ├─ 需要 GDAL/OGR 的底层控制 → gdal-api
│   │   ├─ QGIS 插件/自动化脚本 → pyqgis
│   │   └─ 以上都需要 + 一站式封装 → opengis-utils 暂无 Python 版
│   │
│   ├─ Java
│   │   ├─ 全功能 GIS 工具集 → geotools
│   │   ├─ 纯几何运算 → jts
│   │   ├─ Esri 生态几何运算 → geometry-api-java
│   │   ├─ 需要 GDAL 底层 API（通过 JNI） → gdal-api
│   │   └─ 统一工具集封装 → opengis-utils-for-java
│   │
│   ├─ .NET / C#
│   │   ├─ 纯几何运算（JTS 风格） → nettopologysuite
│   │   ├─ Esri 生态几何运算 → geometry-api-net
│   │   ├─ 需要 GDAL 底层 API（通过 SWIG） → gdal-api
│   │   ├─ 桌面/WPF 嵌入地图 → mapsui（推荐）
│   │   ├─ 旧版 WinForms 地图 → sharpmap（仅维护旧项目）
│   │   └─ 统一工具集封装 → opengis-utils-for-net
│   │
│   └─ JavaScript / TypeScript
│       ├─ 3D 地球可视化/倾斜摄影/点云 → cesiumjs
│       ├─ 2D Web 地图/WMS/WFS 前端 → openlayers
│       └─ 两者都需要 → cesiumjs + openlayers 可共存（Cesium 支持 OL-Cesium 集成）
│
├─ 空间数据库存储与查询 → postgis
│
├─ 发布地图服务
│   ├─ 传统单体部署 → geoserver
│   ├─ 需要自动化管理/CI/CD → geoserver + geoserver-rest-api
│   └─ Kubernetes 云原生 → geoserver-cloud
│
├─ 端到端完整流程（数据处理→分析→发布） → opengis-all
│
└─ 不确定用什么，需要遍历选项
    ├─ 只看 GIS 领域概览 → 加载 gis/SKILL.md（L2 分类索引）
    └─ 全仓库概览 → 加载根 SKILL.md（L1 全局入口）
```

**典型组合推荐：**

| 场景 | 推荐技能组合 | 说明 |
|:-----|:------------|:-----|
| Python 全栈 GIS 项目 | `geopandas` + `shapely` + `gdal-api` | GeoPandas 处理矢量分析，Shapely 做底层几何运算，gdal-api 覆盖特殊格式 |
| Java 后端 GIS 服务 | `geotools` + `jts` + `postgis` | GeoTools 提供完整工具链，JTS 做几何运算，PostGIS 做空间数据库 |
| .NET 企业级 GIS | `nettopologysuite` + `gdal-api` + `mapsui` | NTS 几何运算，GDAL API 数据转换，Mapsui 前端展示 |
| Web 全栈 GIS | `openlayers` + `cesiumjs` + `geoserver` + `postgis` | OL/Cesium 前端 → GeoServer 服务 → PostGIS 存储 |
| 数据管道/ETL | `gdal` + `qgis-process` + `geopipe-agent` | GDAL 基本转换，QGIS 特有算法，Geopipe 声明式管道 |
| 云原生地图平台 | `geoserver-cloud` + `postgis` | GeoServer 微服务 + PostGIS 数据库 |

---

## 5.11 本章小结

本章对 opengis-skills 仓库中全部 **23 个 GIS 技能**进行了系统梳理，涵盖了从数据获取到前端可视化的完整处理链路。核心要点回顾：

**1. 数据处理（4 个技能）：**
- `gdal`（CLI）：50+ 命令行工具，矢量格式转换（`ogr2ogr`）、栅格重投影（`gdalwarp`）、DEM 分析（`gdaldem`）、栅格计算（`gdal_calc`）
- `gdal-api`（API）：C++/Python/Java/.NET 四语言编程绑定，200+ 驱动全覆盖
- `qgis-process`（CLI）：Headless 批量运行 QGIS 200+ 算法，支持 JSON 输入输出
- `geopipe-agent`（YAML）：AI 原生声明式 GIS ETL 管道，10 种 QC 检查，多后端支持

**2. 空间数据库（1 个技能）：**
- `postgis`：PostgreSQL 空间扩展，geometry/geography 双类型，GiST 索引，1000+ 空间函数

**3. 几何运算（5 个技能）：**
- Java 生态：`jts`（JTS 鼻祖级）、`geometry-api-java`（Esri 体系）
- Python 生态：`shapely`（GEOS 绑定，双 API 模式）、`geopandas`（pandas DataFrame 风格空间分析）
- .NET 生态：`nettopologysuite`（JTS .NET 移植）

**4. 地图服务（3 个技能）：**
- `geoserver`：单体部署与配置，SLD/CSS/YSLD 多样式语言，GeoWebCache 瓦片缓存
- `geoserver-rest-api`：RESTful 自动化管理接口，Workspace/Store/Layer/Style 的完整 CRUD
- `geoserver-cloud`：微服务拆分，Kubernetes 编排，PgConfig 集中配置

**5. QGIS 生态（1 个技能）：**
- `pyqgis`：QGIS Python 绑定，独立脚本 + 插件开发 + Processing 算法调用

**6. Web 可视化（2 个技能）：**
- `cesiumjs`：WebGL 3D 地球，3D Tiles/CZML/glTF 模型/地形和影像
- `openlayers`：2D Web 地图，WMS/WFS/矢量瓦片/交互与控件

**7. .NET 组件（2 个技能）：**
- `sharpmap`：传统 WinForms 地图（维护旧项目用）
- `mapsui`：跨平台现代 .NET 地图控件（WPF/MAUI/Avalonia/Blazor，新项目首选）

**8. 综合与工具集（4 个技能）：**
- `opengis-all`：一站式端到端 GIS 工作流（数据获取→处理→分析→发布）
- `geotools`：Java GIS 工具集（OGC 标准参考实现）
- `opengis-utils-for-java` / `opengis-utils-for-net`：统一图层模型 + 双引擎架构的便利工具集

**9. 技能选择（5.10 决策树）：**
面对 23 个技能，按「命令行 → 编程语言 → 数据库 → 服务器 → 前端」的链条分段选择，配合 5.10 节的典型组合推荐，即可快速确定正确的技能（组合）。

---

下一章将进入 CAD 领域，详解 opengis-skills 仓库中 19 个 CAD 技能——从 Open CASCADE Technology 几何内核到 FreeCAD 参数化建模，从 KiCad PCB 设计到 Clipper2 多边形裁剪的全链路。
