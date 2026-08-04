---
layout: default
title: Web服务与OGC标准
---

# 第十七章 Web服务与OGC标准

## 17.1 OGC标准概述

### 17.1.1 什么是OGC

OGC（Open Geospatial Consortium）是制定地理空间数据标准的国际组织。

### 17.1.2 主要OGC服务标准

| 标准 | 全称 | 用途 |
|------|------|------|
| WMS | Web Map Service | 地图图片服务 |
| WMTS | Web Map Tile Service | 瓦片地图服务 |
| WFS | Web Feature Service | 矢量要素服务 |
| WCS | Web Coverage Service | 栅格覆盖服务 |
| WPS | Web Processing Service | 空间处理服务 |
| CSW | Catalogue Service for Web | 元数据目录服务 |

## 17.2 WMS服务

### 17.2.1 添加WMS图层

**GUI方式**：
```
图层 > 数据源管理器 > WMS/WMTS
新建连接 > 输入服务URL
```

**PyQGIS**：
```python
from qgis.core import QgsRasterLayer, QgsProject

# WMS URL参数
uri = "url=https://example.com/wms&layers=layer_name&format=image/png&crs=EPSG:4326&styles="

layer = QgsRasterLayer(uri, "WMS Layer", "wms")
if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
```

### 17.2.2 WMS请求参数

| 参数 | 说明 | 示例 |
|------|------|------|
| url | 服务地址 | https://example.com/wms |
| layers | 图层名称 | layer1,layer2 |
| format | 图像格式 | image/png |
| crs | 坐标系 | EPSG:4326 |
| styles | 样式 | default |
| transparent | 透明背景 | true |

### 17.2.3 常用WMS服务

```python
# 天地图WMS
tdl_url = "url=https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=YOUR_TOKEN"

# 中国国家地理信息公共服务平台
# 需要申请密钥
```

## 17.3 WMTS服务

### 17.3.1 添加WMTS图层

```python
# WMTS连接
uri = "url=https://example.com/wmts&layer=layer_name&tilematrixset=GoogleMapsCompatible&format=image/png&crs=EPSG:3857"

layer = QgsRasterLayer(uri, "WMTS Layer", "wms")
```

### 17.3.2 WMTS参数

| 参数 | 说明 |
|------|------|
| url | 服务地址 |
| layer | 图层名称 |
| tilematrixset | 瓦片矩阵集 |
| format | 图片格式 |
| style | 样式名称 |

## 17.4 XYZ瓦片

### 17.4.1 添加XYZ瓦片

```python
# XYZ瓦片服务
uri = "type=xyz&url=https://tile.openstreetmap.org/{z}/{x}/{y}.png"
layer = QgsRasterLayer(uri, "OpenStreetMap", "wms")
```

### 17.4.2 常用瓦片服务

```python
# OpenStreetMap
osm = "type=xyz&url=https://tile.openstreetmap.org/{z}/{x}/{y}.png&zmax=19&zmin=0"

# Google卫星图
google_sat = "type=xyz&url=https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"

# Esri卫星图
esri_sat = "type=xyz&url=https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

# 高德地图
amap = "type=xyz&url=https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}"
```

### 17.4.3 添加自定义瓦片源

```python
# 通过连接添加XYZ源
from qgis.core import QgsProject, QgsRasterLayer

# 方法1：直接添加
uri = "type=xyz&url=https://your-server.com/tiles/{z}/{x}/{y}.png"
layer = QgsRasterLayer(uri, "Custom Tiles", "wms")
QgsProject.instance().addMapLayer(layer)

# 方法2：保存到浏览器
# 在浏览器面板中右键XYZ Tiles > 新建连接
```

## 17.5 WFS服务

### 17.5.1 添加WFS图层

```python
from qgis.core import QgsVectorLayer

# WFS URL
uri = "https://example.com/wfs?service=WFS&version=2.0.0&request=GetFeature&typename=namespace:layername"

layer = QgsVectorLayer(uri, "WFS Layer", "WFS")
if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
```

### 17.5.2 WFS参数

| 参数 | 说明 |
|------|------|
| service | WFS |
| version | 1.0.0/1.1.0/2.0.0 |
| request | GetFeature |
| typename | 图层类型名 |
| srsname | 坐标系 |
| bbox | 边界框过滤 |
| filter | CQL/OGC过滤 |
| maxFeatures | 最大要素数 |

### 17.5.3 WFS过滤

```python
# 使用边界框过滤
uri = "https://example.com/wfs?service=WFS&version=2.0.0&request=GetFeature&typename=layer&bbox=100,30,120,45,EPSG:4326"

# 使用CQL过滤
uri = "https://example.com/wfs?service=WFS&version=2.0.0&request=GetFeature&typename=layer&CQL_FILTER=population>1000000"
```

## 17.6 WCS服务

### 17.6.1 添加WCS图层

```python
# WCS连接
uri = "url=https://example.com/wcs&coverage=coverage_name"
layer = QgsRasterLayer(uri, "WCS Layer", "wcs")
```

### 17.6.2 WCS操作

| 操作 | 说明 |
|------|------|
| GetCapabilities | 获取服务能力 |
| DescribeCoverage | 描述覆盖范围 |
| GetCoverage | 获取覆盖数据 |

## 17.7 ArcGIS REST服务

### 17.7.1 Feature Service

```python
# ArcGIS Feature Service
uri = "crs='EPSG:4326' url='https://services.arcgis.com/.../FeatureServer/0'"
layer = QgsVectorLayer(uri, "ArcGIS FS", "arcgisfeatureserver")
```

### 17.7.2 Map Service

```python
# ArcGIS Map Service
uri = "crs='EPSG:3857' format='PNG32' url='https://services.arcgis.com/.../MapServer'"
layer = QgsRasterLayer(uri, "ArcGIS MS", "arcgismapserver")
```

## 17.8 矢量瓦片

### 17.8.1 添加矢量瓦片

```python
from qgis.core import QgsVectorTileLayer

# MVT服务
uri = "type=xyz&url=https://example.com/tiles/{z}/{x}/{y}.pbf"
layer = QgsVectorTileLayer(uri, "Vector Tiles")

# 设置样式
layer.loadDefaultStyle()
```

### 17.8.2 矢量瓦片样式

```python
# 加载MapBox GL样式
style_url = "https://example.com/style.json"
# 需要插件支持或手动转换
```

## 17.9 QGIS Server

### 17.9.1 QGIS Server简介

QGIS Server是基于QGIS核心库的OGC服务器，支持：
- WMS 1.3.0
- WFS 1.0.0/1.1.0
- WCS 1.1.1
- WMTS 1.0.0
- OGC API - Features

### 17.9.2 项目发布

**准备QGIS项目用于发布**：
```
项目 > 属性 > QGIS Server

设置:
- 服务能力（标题、摘要、关键词）
- WMS能力（CRS列表、范围）
- WFS能力（已发布图层）
```

### 17.9.3 服务配置

```
# Apache配置示例
<VirtualHost *:80>
    ScriptAlias /qgis/ /usr/lib/cgi-bin/qgis_mapserv.fcgi
    
    <Directory "/usr/lib/cgi-bin/">
        SetEnv QGIS_PROJECT_FILE /path/to/project.qgz
        SetEnv QGIS_SERVER_LOG_FILE /var/log/qgis/server.log
        SetEnv QGIS_SERVER_LOG_LEVEL 0
    </Directory>
</VirtualHost>
```

### 17.9.4 访问服务

```
# WMS GetCapabilities
http://server/qgis/?SERVICE=WMS&REQUEST=GetCapabilities

# WMS GetMap
http://server/qgis/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=layer&STYLES=&CRS=EPSG:4326&BBOX=100,30,120,45&WIDTH=800&HEIGHT=600&FORMAT=image/png

# WFS GetFeature
http://server/qgis/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAME=layer
```

## 17.10 云存储

### 17.10.1 支持的云存储

QGIS通过GDAL支持多种云存储：
- Amazon S3
- Google Cloud Storage
- Microsoft Azure
- HTTP/HTTPS

### 17.10.2 访问云数据

```python
# 访问S3上的数据
uri = "/vsicurl/https://s3.amazonaws.com/bucket/file.tif"
layer = QgsRasterLayer(uri, "S3 Raster", "gdal")

# 使用认证的S3
# 需要设置环境变量 AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
uri = "/vsis3/bucket/file.tif"
```

### 17.10.3 Cloud Optimized GeoTIFF

```python
# 加载COG
uri = "/vsicurl/https://example.com/cog.tif"
layer = QgsRasterLayer(uri, "COG", "gdal")

# COG支持范围请求，只下载需要的部分
```

## 17.11 缓存管理

### 17.11.1 WMS缓存

```
设置 > 选项 > 网络 > 缓存

设置:
- 缓存目录
- 缓存大小
- 过期时间
```

### 17.11.2 清除缓存

```python
from qgis.core import QgsNetworkAccessManager

# 清除网络缓存
nam = QgsNetworkAccessManager.instance()
nam.cache().clear()
```

## 17.12 网络配置

### 17.12.1 代理设置

```
设置 > 选项 > 网络 > 代理

配置:
- 代理类型（HTTP/Socks5）
- 主机/端口
- 认证
- 排除列表
```

### 17.12.2 超时设置

```python
from qgis.core import QgsSettings

settings = QgsSettings()
settings.setValue("qgis/networkAndProxy/networkTimeout", 30000)  # 毫秒
```

## 17.13 小结

本章详细介绍了QGIS的Web服务集成：

**关键要点**：
1. 理解各种OGC服务标准
2. 掌握WMS/WMTS/XYZ瓦片使用
3. 了解WFS矢量服务
4. 熟悉ArcGIS REST服务
5. 了解QGIS Server发布
6. 掌握云存储访问

Web服务是现代GIS数据共享的重要方式。

---

**上一章**：[第16章 数据库集成](https://znlgis.github.io/gis/tutorial/qgis/第16章-数据库集成/)

**下一章**：[第18章 高级功能与扩展](https://znlgis.github.io/gis/tutorial/qgis/第18章-高级功能与扩展/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/qgis/第17章-Web服务与OGC标准/第16章-数据库集成/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/qgis/第17章-Web服务与OGC标准/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/qgis/第17章-Web服务与OGC标准/第18章-高级功能与扩展/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
