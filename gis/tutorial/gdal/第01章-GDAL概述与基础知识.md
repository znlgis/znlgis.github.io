---
layout: default
title: 第01章 - GDAL概述与基础知识
---

# 第01章：GDAL概述与基础知识

## 1.1 GDAL 简介

### 1.1.1 什么是 GDAL

GDAL（Geospatial Data Abstraction Library，地理空间数据抽象库）是一个用于读取和写入栅格和矢量地理空间数据格式的开源库。GDAL 由 OSGeo（Open Source Geospatial Foundation，开源地理空间基金会）维护，是地理信息系统（GIS）和遥感领域最重要的基础设施之一。

GDAL 的核心设计理念是提供一个统一的抽象层，使开发者能够以一致的方式访问各种不同的地理空间数据格式，而无需关心底层格式的具体实现细节。

```
┌─────────────────────────────────────────────────────────────┐
│                      应用程序层                              │
│    (QGIS, ArcGIS, MapServer, PostGIS, 自定义应用...)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       GDAL 抽象层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  GDAL Core  │  │    OGR      │  │    OSR      │         │
│  │ (栅格处理)   │  │ (矢量处理)  │  │ (空间参考)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       驱动层                                 │
│  GeoTIFF│Shapefile│PostGIS│GeoJSON│KML│NetCDF│HDF│...      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据源层                                │
│     本地文件  │  数据库  │  网络服务  │  云存储             │
└─────────────────────────────────────────────────────────────┘
```

### 1.1.2 GDAL 的历史发展

GDAL 的发展历程反映了地理空间开源社区的成长：

| 年份 | 里程碑事件 |
|-----|-----------|
| 1998 | Frank Warmerdam 开始开发 GDAL |
| 2000 | GDAL 1.0 正式发布 |
| 2002 | OGR 库合并到 GDAL 项目 |
| 2006 | 加入 OSGeo 基金会 |
| 2007 | GDAL 1.4 发布，支持更多格式 |
| 2010 | GDAL 1.7 发布，性能大幅提升 |
| 2014 | Even Rouault 成为主要维护者 |
| 2019 | GDAL 3.0 发布，重大架构更新 |
| 2020 | GDAL 3.1 发布，支持 PROJ 6+ |
| 2021 | GDAL 3.3 发布，云优化改进 |
| 2022 | GDAL 3.5 发布，性能持续优化 |
| 2023 | GDAL 3.7 发布，支持更多现代格式 |
| 2024 | GDAL 3.9 发布，增强云原生与性能优化 |
| 2025 | GDAL 3.11+ 发布，持续优化与新格式支持 |

### 1.1.3 GDAL 的主要特点

GDAL 之所以成为行业标准，是因为它具备以下关键特点：

#### 1. 格式支持广泛

GDAL 支持超过 **200 种** 栅格和矢量数据格式：

**栅格格式（部分列表）：**

| 格式类型 | 支持的格式 |
|---------|-----------|
| 通用影像格式 | GeoTIFF, JPEG, PNG, BMP, GIF |
| 卫星遥感格式 | HDF4, HDF5, NetCDF, GRIB |
| 商业软件格式 | ECW, MrSID, JPEG2000, IMG |
| 开源格式 | VRT, MEM, COG (Cloud Optimized GeoTIFF) |
| 数据库存储 | PostGIS Raster, GeoPackage |

**矢量格式（部分列表）：**

| 格式类型 | 支持的格式 |
|---------|-----------|
| 标准交换格式 | Shapefile, GeoJSON, KML/KMZ, GML |
| 数据库格式 | PostGIS, Spatialite, Oracle Spatial |
| 商业软件格式 | FileGDB, Personal GDB, MapInfo TAB |
| 开源格式 | GeoPackage, FlatGeobuf, TopoJSON |
| CAD格式 | DXF, DWG（部分支持） |

#### 2. 跨平台支持

GDAL 可以在多种操作系统上运行：

| 平台 | 支持状态 |
|-----|---------|
| Windows | ✅ 完全支持（32位/64位） |
| Linux | ✅ 完全支持（所有主流发行版） |
| macOS | ✅ 完全支持（Intel/Apple Silicon） |
| Android | ✅ 部分支持 |
| iOS | ✅ 部分支持 |

#### 3. 多语言绑定

GDAL 提供多种编程语言的绑定：

| 语言 | 绑定方式 | 成熟度 |
|-----|---------|--------|
| C/C++ | 原生 API | ⭐⭐⭐⭐⭐ |
| Python | SWIG 绑定 | ⭐⭐⭐⭐⭐ |
| Java | SWIG 绑定 | ⭐⭐⭐⭐ |
| C#/.NET | SWIG 绑定 | ⭐⭐⭐⭐ |
| Perl | SWIG 绑定 | ⭐⭐⭐ |
| R | rgdal 包 | ⭐⭐⭐⭐ |

#### 4. 丰富的命令行工具

GDAL 提供了一套完整的命令行工具：

```bash
# 栅格工具
gdalinfo      # 显示栅格数据信息
gdal_translate # 栅格格式转换
gdalwarp      # 栅格投影转换和重采样
gdal_merge.py # 栅格镶嵌
gdaladdo      # 创建金字塔

# 矢量工具
ogrinfo       # 显示矢量数据信息
ogr2ogr       # 矢量格式转换
ogrlineref    # 线性参考
ogrtindex     # 创建瓦片索引

# 通用工具
gdalsrsinfo   # 显示空间参考信息
gdal_contour  # 等值线生成
gdal_grid     # 网格插值
```

## 1.2 GDAL 核心组件

GDAL 库实际上由三个主要组件组成，它们各自负责不同的功能领域：

### 1.2.1 GDAL Core - 栅格数据处理

GDAL Core 是处理栅格数据的核心组件，主要功能包括：

```
┌─────────────────────────────────────────────────────────┐
│                    GDAL Core 架构                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   GDALDataset   │  │   GDALDriver    │              │
│  │   (数据集)       │  │   (驱动)         │              │
│  └────────┬────────┘  └─────────────────┘              │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐                                   │
│  │   GDALRasterBand│                                   │
│  │   (栅格波段)     │                                   │
│  └────────┬────────┘                                   │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              像素数据 (Pixel Data)               │   │
│  │  Byte | Int16 | Int32 | Float32 | Float64 | ... │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**主要类和概念：**

| 类名 | 描述 |
|-----|------|
| GDALDataset | 表示一个栅格数据集，包含一个或多个波段 |
| GDALRasterBand | 表示数据集中的一个波段 |
| GDALDriver | 负责读写特定格式的驱动程序 |
| GDALDriverManager | 驱动管理器，管理所有注册的驱动 |

**核心功能：**

- 读取和写入栅格数据
- 访问和修改地理变换参数
- 处理栅格波段数据
- 创建和管理金字塔（概览）
- 读写元数据

### 1.2.2 OGR - 矢量数据处理

OGR（最初代表 OpenGIS Simple Features Reference Implementation）是处理矢量数据的组件：

```
┌─────────────────────────────────────────────────────────┐
│                     OGR 架构                             │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  GDALDataset    │  │   OGRDriver     │              │
│  │  (数据源)        │  │   (驱动)         │              │
│  └────────┬────────┘  └─────────────────┘              │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐                                   │
│  │   OGRLayer      │                                   │
│  │   (图层)         │                                   │
│  └────────┬────────┘                                   │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   OGRFeature    │  │ OGRFeatureDefn  │              │
│  │   (要素)         │  │ (要素定义)       │              │
│  └────────┬────────┘  └─────────────────┘              │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  OGRGeometry    │  │  OGRFieldDefn   │              │
│  │  (几何对象)      │  │  (字段定义)      │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

**主要类和概念：**

| 类名 | 描述 |
|-----|------|
| GDALDataset | 在 OGR 中也表示矢量数据源 |
| OGRLayer | 表示数据源中的一个图层 |
| OGRFeature | 表示图层中的一个要素 |
| OGRGeometry | 表示要素的几何形状 |
| OGRFieldDefn | 定义属性字段的结构 |
| OGRFeatureDefn | 定义要素的结构（包含字段和几何类型） |

**支持的几何类型：**

| 几何类型 | OGR 类名 | 描述 |
|---------|---------|------|
| 点 | OGRPoint | 单个坐标点 |
| 线 | OGRLineString | 由点序列组成的线 |
| 多边形 | OGRPolygon | 由外环和可选内环组成 |
| 多点 | OGRMultiPoint | 点的集合 |
| 多线 | OGRMultiLineString | 线的集合 |
| 多多边形 | OGRMultiPolygon | 多边形的集合 |
| 几何集合 | OGRGeometryCollection | 任意几何类型的集合 |

### 1.2.3 OSR - 空间参考系统

OSR（OGR Spatial Reference）负责处理坐标系统和投影：

```
┌─────────────────────────────────────────────────────────┐
│                     OSR 架构                             │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐ │
│  │           OGRSpatialReference                      │ │
│  │           (空间参考对象)                            │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│          ┌───────────────┼───────────────┐             │
│          ▼               ▼               ▼             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐│
│  │   地理坐标系   │ │   投影坐标系   │ │   局部坐标系  ││
│  │ (Geographic)  │ │ (Projected)   │ │   (Local)     ││
│  └───────────────┘ └───────────────┘ └───────────────┘│
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │       OGRCoordinateTransformation                  │ │
│  │           (坐标转换对象)                            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**主要功能：**

| 功能 | 描述 |
|-----|------|
| 坐标系定义 | 支持 WKT、PROJ、EPSG 等多种定义方式 |
| 坐标转换 | 不同坐标系之间的转换 |
| 投影计算 | 正向和逆向投影计算 |
| 参数获取 | 获取椭球体、基准面、投影参数等 |

**常用坐标系标识：**

| EPSG 代码 | 名称 | 描述 |
|----------|------|------|
| 4326 | WGS 84 | 全球通用地理坐标系 |
| 3857 | Web Mercator | Web 地图投影 |
| 4490 | CGCS2000 | 中国大地坐标系 |
| 32650 | UTM Zone 50N | UTM 投影（北半球50带） |
| 4547 | CGCS2000 / 3-degree Gauss-Kruger zone 39 | 高斯-克吕格投影 |

## 1.3 GDAL 与相关项目

### 1.3.1 GDAL 生态系统

GDAL 是一个庞大生态系统的核心，与许多其他项目紧密集成：

```
                    ┌─────────────────┐
                    │    QGIS         │
                    │   ArcGIS        │
                    │   MapServer     │
                    │   GeoServer     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │                 │
       ┌────────────┤     GDAL       ├────────────┐
       │            │                 │            │
       │            └────────┬────────┘            │
       │                     │                     │
       ▼                     ▼                     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    PROJ     │     │  GEOS       │     │  SQLite     │
│ (投影计算)   │     │ (几何计算)   │     │ (数据库)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 1.3.2 PROJ 库

PROJ 是一个坐标转换库，GDAL 依赖它进行投影计算：

| 版本 | 特点 |
|-----|------|
| PROJ 4.x | 经典版本，使用 proj4 字符串 |
| PROJ 5.x | 过渡版本 |
| PROJ 6.x+ | 现代版本，支持 WKT2，精度更高 |

**PROJ 与 GDAL 版本对应：**

| GDAL 版本 | 推荐 PROJ 版本 |
|----------|---------------|
| GDAL 2.x | PROJ 4.x - 5.x |
| GDAL 3.0 | PROJ 6.x |
| GDAL 3.3+ | PROJ 7.x+ |
| GDAL 3.6+ | PROJ 9.x |

### 1.3.3 GEOS 库

GEOS（Geometry Engine Open Source）提供几何操作功能：

| 功能类型 | 具体功能 |
|---------|---------|
| 空间关系 | Contains, Within, Intersects, Touches, Crosses |
| 空间操作 | Buffer, Union, Intersection, Difference, SymDifference |
| 几何验证 | IsValid, IsSimple |
| 几何构建 | Convex Hull, Centroid, Envelope |

### 1.3.4 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        GDAL                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  必需依赖：                                                   │
│  ├── PROJ (坐标投影)                                         │
│  ├── libtiff (GeoTIFF 支持)                                  │
│  ├── libgeotiff (GeoTIFF 地理信息)                           │
│  └── zlib (压缩支持)                                         │
│                                                              │
│  可选依赖：                                                   │
│  ├── GEOS (高级几何操作)                                     │
│  ├── SQLite/Spatialite (GeoPackage 支持)                    │
│  ├── PostgreSQL/PostGIS (PostGIS 支持)                      │
│  ├── libpng (PNG 格式)                                       │
│  ├── libjpeg (JPEG 格式)                                     │
│  ├── libcurl (网络访问)                                      │
│  ├── libxml2 (XML 解析)                                      │
│  ├── HDF5 (HDF5 格式)                                        │
│  ├── NetCDF (NetCDF 格式)                                    │
│  └── OpenJPEG (JPEG2000 格式)                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 1.4 GDAL 应用场景

### 1.4.1 典型应用领域

GDAL 在以下领域得到广泛应用：

| 领域 | 应用场景 |
|-----|---------|
| **遥感处理** | 卫星影像预处理、辐射校正、几何校正 |
| **GIS 开发** | 空间数据读写、格式转换、数据管理 |
| **地图制图** | 底图处理、栅格渲染、符号化 |
| **数据工程** | ETL 流程、数据仓库、批量处理 |
| **科学研究** | 气候数据分析、地质建模、生态研究 |
| **国土测绘** | 地籍数据管理、坐标转换、数据归档 |
| **城市规划** | 三维建模、空间分析、规划展示 |

### 1.4.2 实际案例

#### 案例1：卫星影像批量处理

```python
# 使用 Python GDAL 批量处理 Sentinel-2 影像
from osgeo import gdal
import os

def process_sentinel2_images(input_dir, output_dir):
    """批量处理 Sentinel-2 影像"""
    for filename in os.listdir(input_dir):
        if filename.endswith('.tif'):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, f"processed_{filename}")
            
            # 打开源数据
            src_ds = gdal.Open(input_path)
            
            # 进行投影转换
            gdal.Warp(output_path, src_ds,
                     dstSRS='EPSG:4326',
                     resampleAlg='bilinear')
            
            src_ds = None
```

#### 案例2：矢量数据格式转换

```python
# 将 Shapefile 转换为 GeoJSON
from osgeo import ogr

def shp_to_geojson(shp_path, geojson_path):
    """Shapefile 转 GeoJSON"""
    # 获取驱动
    driver = ogr.GetDriverByName('GeoJSON')
    
    # 打开源数据
    src_ds = ogr.Open(shp_path)
    src_layer = src_ds.GetLayer()
    
    # 创建目标数据
    dst_ds = driver.CreateDataSource(geojson_path)
    dst_ds.CopyLayer(src_layer, 'output')
    
    # 清理
    src_ds = None
    dst_ds = None
```

#### 案例3：坐标系统转换

```python
# 坐标点从 WGS84 转换到 CGCS2000
from osgeo import osr

def transform_coordinates(x, y, src_epsg=4326, dst_epsg=4490):
    """坐标转换"""
    # 创建源和目标空间参考
    src_srs = osr.SpatialReference()
    src_srs.ImportFromEPSG(src_epsg)
    
    dst_srs = osr.SpatialReference()
    dst_srs.ImportFromEPSG(dst_epsg)
    
    # 创建转换对象
    transform = osr.CoordinateTransformation(src_srs, dst_srs)
    
    # 执行转换
    result = transform.TransformPoint(x, y)
    
    return result[0], result[1]
```

### 1.4.3 使用 GDAL 的知名项目

| 项目 | 类型 | 如何使用 GDAL |
|-----|------|--------------|
| QGIS | 桌面 GIS | 核心数据访问引擎 |
| GeoServer | 地图服务器 | 栅格数据发布 |
| MapServer | 地图服务器 | 数据格式支持 |
| PostGIS | 空间数据库 | 栅格功能（raster2pgsql） |
| Rasterio | Python 库 | 底层数据访问 |
| GeoPandas | Python 库 | 矢量数据 I/O |
| GRASS GIS | GIS 软件 | 数据导入导出 |
| Google Earth Engine | 云平台 | 数据处理引擎 |

## 1.5 GDAL 版本与特性

### 1.5.1 版本演进

| 大版本 | 发布时间 | 主要特性 |
|-------|---------|---------|
| 1.x | 2000-2014 | 基础功能建立，格式支持扩展 |
| 2.x | 2015-2019 | 统一 API，性能优化，Python 3 支持 |
| 3.x | 2019-至今 | PROJ 6+ 支持，云优化，多维数组 |

### 1.5.2 GDAL 3.x 重要更新

GDAL 3.x 系列带来了许多重要更新：

| 特性 | 描述 |
|-----|------|
| **PROJ 6+ 支持** | 更精确的坐标转换，支持时间相关的转换 |
| **统一 API** | 栅格和矢量 API 进一步统一 |
| **多维数组** | 更好的 NetCDF/HDF5 支持 |
| **云优化** | 改进的 /vsicurl/ 和 /vsis3/ 支持 |
| **COG 支持** | 原生 Cloud Optimized GeoTIFF 支持 |
| **Arrow 集成** | 支持 Apache Arrow 列式数据格式 |

### 1.5.3 选择合适的版本

根据你的需求选择合适的 GDAL 版本：

| 需求 | 推荐版本 |
|-----|---------|
| 生产环境稳定性 | GDAL 3.10.x LTS |
| 最新功能 | GDAL 3.11.x+ |
| 旧系统兼容 | GDAL 2.4.x |
| 云原生应用 | GDAL 3.10.x+ |

## 1.6 学习资源与社区

### 1.6.1 官方资源

| 资源 | URL | 描述 |
|-----|-----|------|
| 官方网站 | https://gdal.org | 文档、下载、API 参考 |
| GitHub | https://github.com/OSGeo/gdal | 源码、Issue、PR |
| 邮件列表 | gdal-dev@lists.osgeo.org | 开发讨论 |
| IRC | #gdal on libera.chat | 实时交流 |

### 1.6.2 学习资料

**官方文档：**
- [GDAL 文档](https://gdal.org/documentation.html)
- [驱动程序列表](https://gdal.org/drivers/raster/index.html)
- [API 参考](https://gdal.org/api/index.html)
- [教程](https://gdal.org/tutorials/index.html)

**书籍推荐：**
- 《Geoprocessing with Python》 by Chris Garrard
- 《Python Geospatial Development》 by Erik Westra
- 《GDAL/OGR Cookbook》（在线资源）

### 1.6.3 社区支持

| 平台 | 用途 |
|-----|------|
| GIS Stack Exchange | 问答社区 |
| Reddit r/gis | 讨论社区 |
| OSGeo 论坛 | 官方论坛 |
| GitHub Discussions | 技术讨论 |

## 1.7 本章小结

本章介绍了 GDAL 的基本概念和核心组件：

1. **GDAL 是什么**：地理空间数据抽象库，支持 200+ 种数据格式
2. **核心组件**：
   - GDAL Core：栅格数据处理
   - OGR：矢量数据处理
   - OSR：空间参考系统
3. **主要特点**：跨平台、多语言绑定、丰富的命令行工具
4. **生态系统**：与 PROJ、GEOS 等项目紧密集成
5. **应用场景**：遥感处理、GIS 开发、数据工程等

在下一章中，我们将详细介绍 GDAL 的安装与环境配置方法。

## 1.8 思考与练习

1. GDAL、OGR、OSR 三个组件各自的主要功能是什么？
2. 为什么 GDAL 能够成为地理空间数据处理的行业标准？
3. GDAL 3.x 相比 2.x 版本有哪些重要的改进？
4. 列举三个你熟悉的使用 GDAL 的项目或软件。
5. 对于一个新项目，你会如何选择合适的 GDAL 版本？

---

## 📖 推荐阅读

学完本章后，建议继续阅读以下相关教程：

- **[PostGIS 教程](../../postgis/)** — GDAL 与 PostGIS 配合使用，实现强大的空间数据存储与处理
- **[GeoServer 教程](../../geoserver/)** — 使用 GDAL 处理后通过 GeoServer 发布地图服务
- **[QGIS 教程](../../qgis/)** — GDAL 是 QGIS 的核心数据引擎，两者深度集成
- **[OpenLayers 教程](../../openlayers/)** — 前端展示 GDAL 处理后的空间数据

---

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-GDAL安装与环境配置" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
