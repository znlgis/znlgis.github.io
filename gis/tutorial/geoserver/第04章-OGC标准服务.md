---
layout: default
title: 第4章 OGC标准服务
---

# 第4章 OGC标准服务

## 4.1 OGC标准概述

### 4.1.1 什么是OGC

开放地理空间联盟（Open Geospatial Consortium，简称OGC）是一个国际性的自愿共识标准组织，成立于1994年。OGC的使命是使地理信息和服务具有FAIR特性：可查找（Findable）、可访问（Accessible）、可互操作（Interoperable）和可重用（Reusable）。

OGC标准的重要性体现在：
- **互操作性**：不同厂商的软件可以无缝协作
- **投资保护**：避免被单一厂商锁定
- **数据共享**：促进跨组织的数据交换
- **技术演进**：标准持续更新，适应新技术发展

### 4.1.2 GeoServer支持的OGC标准

GeoServer实现了多种OGC标准，按功能分类如下：

**数据服务标准：**
| 标准 | 全称 | 主要用途 |
|------|------|---------|
| WMS | Web Map Service | 地图图像服务 |
| WMTS | Web Map Tile Service | 地图瓦片服务 |
| WFS | Web Feature Service | 矢量要素服务 |
| WCS | Web Coverage Service | 栅格覆盖服务 |
| WPS | Web Processing Service | 空间处理服务 |

**样式标准：**
| 标准 | 全称 | 主要用途 |
|------|------|---------|
| SLD | Styled Layer Descriptor | 地图样式定义 |
| SE | Symbology Encoding | 符号编码规范 |

**编码标准：**
| 标准 | 全称 | 主要用途 |
|------|------|---------|
| GML | Geography Markup Language | 地理数据XML编码 |
| KML | Keyhole Markup Language | Google Earth格式 |
| Filter | Filter Encoding | 查询条件编码 |

### 4.1.3 OGC API新标准

OGC正在开发新一代的Web API标准，GeoServer也在逐步支持：

- **OGC API - Features**：WFS的现代化替代
- **OGC API - Maps**：WMS的现代化替代
- **OGC API - Tiles**：WMTS的现代化替代
- **OGC API - Styles**：样式管理API
- **OGC API - Processes**：WPS的现代化替代

这些新标准基于OpenAPI规范，更易于使用和集成。

## 4.2 WMS服务详解

### 4.2.1 WMS概述

Web Map Service（WMS）是最基础的OGC地图服务标准。WMS允许客户端请求按指定参数渲染的地图图像。

**WMS的主要特点：**
- 返回渲染好的地图图像（PNG、JPEG、GIF等）
- 支持多图层叠加
- 支持透明背景
- 支持坐标系转换
- 支持查询要素信息

### 4.2.2 WMS操作

WMS定义了三个核心操作：

**1. GetCapabilities**

获取服务的元数据，包括可用图层、支持的格式等。

```
http://localhost:8080/geoserver/wms?
  service=WMS&
  version=1.1.1&
  request=GetCapabilities
```

返回XML格式的服务描述文档，包含：
- 服务信息（标题、摘要、关键字等）
- 可用图层列表及其属性
- 支持的输出格式
- 支持的坐标参考系统

**2. GetMap**

请求渲染的地图图像。

```
http://localhost:8080/geoserver/wms?
  service=WMS&
  version=1.1.1&
  request=GetMap&
  layers=workspace:layer1,workspace:layer2&
  styles=style1,style2&
  bbox=-180,-90,180,90&
  width=800&
  height=400&
  srs=EPSG:4326&
  format=image/png&
  transparent=true
```

**GetMap参数说明：**

| 参数 | 必需 | 说明 |
|------|------|------|
| service | 是 | 固定为WMS |
| version | 是 | WMS版本，如1.1.1或1.3.0 |
| request | 是 | 固定为GetMap |
| layers | 是 | 图层名称，多个用逗号分隔 |
| styles | 是 | 样式名称，可为空 |
| bbox | 是 | 边界框，格式为minx,miny,maxx,maxy |
| width | 是 | 图像宽度（像素） |
| height | 是 | 图像高度（像素） |
| srs/crs | 是 | 坐标参考系统 |
| format | 是 | 输出格式，如image/png |
| transparent | 否 | 是否透明背景 |
| bgcolor | 否 | 背景颜色 |
| exceptions | 否 | 异常报告格式 |

**3. GetFeatureInfo**

查询地图上某点的要素信息。

```
http://localhost:8080/geoserver/wms?
  service=WMS&
  version=1.1.1&
  request=GetFeatureInfo&
  layers=workspace:layer&
  query_layers=workspace:layer&
  styles=&
  bbox=-180,-90,180,90&
  width=800&
  height=400&
  srs=EPSG:4326&
  x=400&
  y=200&
  info_format=application/json&
  feature_count=10
```

**GetFeatureInfo特有参数：**

| 参数 | 说明 |
|------|------|
| query_layers | 要查询的图层 |
| x, y | 查询点的像素坐标 |
| info_format | 返回信息的格式 |
| feature_count | 最大返回要素数 |

### 4.2.3 WMS 1.1.1与1.3.0的区别

WMS有两个主要版本在使用：1.1.1和1.3.0。主要区别包括：

| 方面 | WMS 1.1.1 | WMS 1.3.0 |
|------|-----------|-----------|
| 坐标参数 | SRS | CRS |
| 坐标顺序 | x,y (经度,纬度) | 取决于CRS定义 |
| 边界框顺序 | minx,miny,maxx,maxy | 可能是miny,minx,maxy,maxx |
| 异常格式 | application/vnd.ogc.se_xml | XML |

特别注意：在WMS 1.3.0中，对于EPSG:4326等地理坐标系，边界框的顺序变为纬度在前，经度在后。这是很多客户端出错的原因。

### 4.2.4 GeoServer WMS扩展功能

GeoServer在标准WMS基础上提供了许多扩展功能：

**SLD参数：**

动态传递样式定义：
```
&SLD=http://example.com/style.sld
&SLD_BODY=<StyledLayerDescriptor>...</StyledLayerDescriptor>
```

**视点参数（Vendor Parameters）：**

```
&env=key1:value1;key2:value2    # 环境变量
&cql_filter=attribute='value'   # CQL过滤
&viewparams=param1:value1       # 视图参数
&format_options=dpi:300         # 格式选项
```

**时间和高程维度：**

```
&time=2023-01-01T00:00:00Z      # 时间维度
&elevation=100                  # 高程维度
```

### 4.2.5 WMS配置

在GeoServer中配置WMS服务：

1. 进入"服务" > "WMS"
2. 可配置的选项包括：

**基本设置：**
- 服务元数据（标题、摘要、关键字）
- 在线资源URL
- 费用和访问约束

**输出限制：**
- 最大渲染内存
- 最大渲染时间
- 最大输出尺寸

**水印：**
- 启用/禁用水印
- 水印图像
- 位置和透明度

## 4.3 WFS服务详解

### 4.3.1 WFS概述

Web Feature Service（WFS）提供对矢量要素的访问和操作。与WMS返回图像不同，WFS返回实际的要素数据，包括几何和属性。

**WFS的主要特点：**
- 返回原始地理要素数据
- 支持属性和空间查询
- 支持要素编辑（WFS-T）
- 支持多种输出格式

### 4.3.2 WFS服务级别

WFS定义了三个服务级别：

| 级别 | 支持的操作 | 说明 |
|------|-----------|------|
| Basic | GetCapabilities, DescribeFeatureType, GetFeature | 只读访问 |
| XLink | Basic + GetGmlObject | 支持XLink引用 |
| Transactional | XLink + Transaction, LockFeature | 支持编辑操作 |

### 4.3.3 WFS操作

**1. GetCapabilities**

获取服务元数据：

```
http://localhost:8080/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=GetCapabilities
```

**2. DescribeFeatureType**

获取要素类型的结构描述：

```
http://localhost:8080/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=DescribeFeatureType&
  typeNames=workspace:layer
```

返回GML应用模式（XSD），描述要素的属性结构。

**3. GetFeature**

获取要素数据：

```
http://localhost:8080/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=GetFeature&
  typeNames=workspace:roads&
  count=100&
  outputFormat=application/json
```

**GetFeature参数说明：**

| 参数 | WFS 1.x | WFS 2.0 | 说明 |
|------|---------|---------|------|
| typeName | typeName | typeNames | 要素类型名称 |
| maxFeatures | maxFeatures | count | 最大返回数量 |
| propertyName | propertyName | propertyName | 返回的属性 |
| featureId | featureId | resourceId | 要素ID |
| filter | filter | filter | XML过滤条件 |
| bbox | bbox | bbox | 空间范围 |
| sortBy | sortBy | sortBy | 排序字段 |
| startIndex | - | startIndex | 起始位置 |

**4. Transaction（WFS-T）**

执行要素编辑操作（插入、更新、删除）：

**插入要素：**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="2.0.0"
  xmlns:wfs="http://www.opengis.net/wfs/2.0"
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:topp="http://www.example.com/topp">
  <wfs:Insert>
    <topp:roads>
      <topp:name>New Road</topp:name>
      <topp:type>highway</topp:type>
      <topp:geom>
        <gml:LineString srsName="EPSG:4326">
          <gml:posList>116.3 39.9 116.4 39.95</gml:posList>
        </gml:LineString>
      </topp:geom>
    </topp:roads>
  </wfs:Insert>
</wfs:Transaction>
```

**更新要素：**
```xml
<wfs:Transaction>
  <wfs:Update typeName="topp:roads">
    <wfs:Property>
      <wfs:ValueReference>topp:name</wfs:ValueReference>
      <wfs:Value>Updated Name</wfs:Value>
    </wfs:Property>
    <fes:Filter>
      <fes:ResourceId rid="roads.1"/>
    </fes:Filter>
  </wfs:Update>
</wfs:Transaction>
```

**删除要素：**
```xml
<wfs:Transaction>
  <wfs:Delete typeName="topp:roads">
    <fes:Filter>
      <fes:ResourceId rid="roads.1"/>
    </fes:Filter>
  </wfs:Delete>
</wfs:Transaction>
```

### 4.3.4 CQL过滤

GeoServer支持CQL（Common Query Language）作为简化的过滤语法：

**属性过滤：**
```
CQL_FILTER=name='Beijing'
CQL_FILTER=population > 1000000
CQL_FILTER=name LIKE 'Bei%'
CQL_FILTER=type IN ('highway', 'primary')
```

**空间过滤：**
```
CQL_FILTER=BBOX(geom, 116, 39, 117, 40)
CQL_FILTER=INTERSECTS(geom, POINT(116.3 39.9))
CQL_FILTER=WITHIN(geom, POLYGON((116 39, 117 39, 117 40, 116 40, 116 39)))
CQL_FILTER=DWITHIN(geom, POINT(116.3 39.9), 1000, meters)
```

**组合条件：**
```
CQL_FILTER=type='highway' AND population > 100000
CQL_FILTER=name='Beijing' OR name='Shanghai'
```

### 4.3.5 WFS输出格式

GeoServer WFS支持多种输出格式：

| 格式 | MIME类型 | 说明 |
|------|----------|------|
| GML2 | text/xml; subtype=gml/2.1.2 | GML 2.1.2格式 |
| GML3 | text/xml; subtype=gml/3.1.1 | GML 3.1.1格式 |
| GML32 | text/xml; subtype=gml/3.2 | GML 3.2格式 |
| GeoJSON | application/json | JSON格式 |
| CSV | text/csv | 逗号分隔值 |
| Shapefile | application/zip | Shapefile压缩包 |
| KML | application/vnd.google-earth.kml+xml | Google Earth格式 |

## 4.4 WCS服务详解

### 4.4.1 WCS概述

Web Coverage Service（WCS）提供栅格覆盖数据的访问。与WMS返回渲染图像不同，WCS返回原始栅格数据，保留像元值信息。

**WCS的适用场景：**
- 获取DEM数据进行分析
- 下载遥感影像进行处理
- 获取气象数据进行模型计算

### 4.4.2 WCS操作

**1. GetCapabilities**

```
http://localhost:8080/geoserver/wcs?
  service=WCS&
  version=2.0.1&
  request=GetCapabilities
```

**2. DescribeCoverage**

获取覆盖数据的详细描述：

```
http://localhost:8080/geoserver/wcs?
  service=WCS&
  version=2.0.1&
  request=DescribeCoverage&
  coverageId=workspace__coverage
```

**3. GetCoverage**

获取覆盖数据：

```
http://localhost:8080/geoserver/wcs?
  service=WCS&
  version=2.0.1&
  request=GetCoverage&
  coverageId=workspace__coverage&
  format=image/tiff&
  subset=x(116,117)&
  subset=y(39,40)&
  scalefactor=0.5
```

**GetCoverage参数：**

| 参数 | 说明 |
|------|------|
| coverageId | 覆盖数据标识符 |
| format | 输出格式 |
| subset | 子集范围 |
| scalefactor | 缩放因子 |
| rangesubset | 波段子集 |

## 4.5 WMTS服务详解

### 4.5.1 WMTS概述

Web Map Tile Service（WMTS）提供预生成的地图瓦片服务。WMTS的主要优势是高性能，因为瓦片是预先渲染好的。

**WMTS与WMS的比较：**

| 方面 | WMS | WMTS |
|------|-----|------|
| 响应内容 | 动态渲染的图像 | 预缓存的瓦片 |
| 性能 | 较慢 | 很快 |
| 灵活性 | 高（任意范围和尺寸） | 低（固定的瓦片级别） |
| 存储需求 | 无 | 需要缓存存储空间 |
| 适用场景 | 低频访问、复杂查询 | 高频访问、底图服务 |

### 4.5.2 瓦片金字塔

WMTS基于瓦片金字塔结构，每个级别的瓦片大小相同（通常256×256像素），但覆盖的地理范围不同：

```
Level 0: 1个瓦片覆盖全球
Level 1: 4个瓦片覆盖全球
Level 2: 16个瓦片覆盖全球
...
Level n: 4^n个瓦片覆盖全球
```

### 4.5.3 WMTS操作

**1. GetCapabilities**

```
http://localhost:8080/geoserver/gwc/service/wmts?
  service=WMTS&
  version=1.0.0&
  request=GetCapabilities
```

**2. GetTile（KVP方式）**

```
http://localhost:8080/geoserver/gwc/service/wmts?
  service=WMTS&
  version=1.0.0&
  request=GetTile&
  layer=workspace:layer&
  style=&
  tilematrixset=EPSG:4326&
  tilematrix=EPSG:4326:10&
  tilerow=512&
  tilecol=1024&
  format=image/png
```

**3. GetTile（RESTful方式）**

GeoServer支持RESTful风格的瓦片请求：

```
http://localhost:8080/geoserver/gwc/service/wmts/rest/
  {layer}/{style}/{tilematrixset}/{tilematrix}/{tilerow}/{tilecol}?format={format}
```

示例：
```
http://localhost:8080/geoserver/gwc/service/wmts/rest/
  workspace:layer/default/EPSG:4326/EPSG:4326:10/512/1024?format=image/png
```

### 4.5.4 TileMatrixSet

TileMatrixSet定义了瓦片的坐标系统和级别结构。常用的TileMatrixSet包括：

| 名称 | 坐标系 | 说明 |
|------|--------|------|
| EPSG:4326 | WGS84地理坐标 | 全球范围 |
| EPSG:900913 | Web墨卡托 | Google/OSM兼容 |
| EPSG:3857 | Web墨卡托 | 标准代码 |

### 4.5.5 GeoWebCache配置

GeoServer集成了GeoWebCache（GWC）来提供瓦片缓存功能：

**启用图层缓存：**

1. 进入"瓦片缓存" > "图层缓存"
2. 找到要缓存的图层
3. 点击配置图标
4. 设置缓存选项：
   - 启用缓存
   - 选择TileMatrixSet
   - 选择输出格式
   - 设置过期时间

**预生成瓦片：**

1. 进入"瓦片缓存" > "种子和截断"
2. 选择图层
3. 配置种子参数：
   - 缩放级别范围
   - 地理范围
   - 线程数
4. 点击"提交"开始生成

## 4.6 WPS服务详解

### 4.6.1 WPS概述

Web Processing Service（WPS）提供空间处理和分析功能。WPS允许客户端在服务器端执行地理处理操作。

**WPS的适用场景：**
- 复杂的空间分析
- 数据处理和转换
- 批量处理任务
- 客户端计算能力有限时

### 4.6.2 WPS操作

**1. GetCapabilities**

获取可用的处理过程列表：

```
http://localhost:8080/geoserver/wps?
  service=WPS&
  version=1.0.0&
  request=GetCapabilities
```

**2. DescribeProcess**

获取特定处理过程的详细描述：

```
http://localhost:8080/geoserver/wps?
  service=WPS&
  version=1.0.0&
  request=DescribeProcess&
  identifier=JTS:buffer
```

**3. Execute**

执行处理过程：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<wps:Execute service="WPS" version="1.0.0"
  xmlns:wps="http://www.opengis.net/wps/1.0.0"
  xmlns:ows="http://www.opengis.net/ows/1.1"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <ows:Identifier>JTS:buffer</ows:Identifier>
  <wps:DataInputs>
    <wps:Input>
      <ows:Identifier>geom</ows:Identifier>
      <wps:Data>
        <wps:ComplexData mimeType="application/wkt">
          POINT(116.3 39.9)
        </wps:ComplexData>
      </wps:Data>
    </wps:Input>
    <wps:Input>
      <ows:Identifier>distance</ows:Identifier>
      <wps:Data>
        <wps:LiteralData>0.01</wps:LiteralData>
      </wps:Data>
    </wps:Input>
  </wps:DataInputs>
  <wps:ResponseForm>
    <wps:RawDataOutput mimeType="application/json">
      <ows:Identifier>result</ows:Identifier>
    </wps:RawDataOutput>
  </wps:ResponseForm>
</wps:Execute>
```

### 4.6.3 常用WPS处理过程

GeoServer提供了大量内置的处理过程：

**JTS空间操作：**
- JTS:buffer - 缓冲区分析
- JTS:intersection - 相交运算
- JTS:union - 合并运算
- JTS:difference - 差异运算
- JTS:convexHull - 凸包计算

**矢量处理：**
- vec:Clip - 裁剪
- vec:PointBuffers - 点缓冲
- vec:Query - 查询过滤
- vec:Aggregate - 聚合统计

**栅格处理：**
- ras:Contour - 等值线提取
- ras:CropCoverage - 裁剪
- ras:RangeLookup - 值域分类

## 4.7 服务配置与优化

### 4.7.1 全局服务设置

在GeoServer中配置服务的全局参数：

**服务元数据：**
- 标题、摘要、关键字
- 联系人信息
- 费用和访问约束

**输出限制：**
- 最大要素数/覆盖大小
- 最大渲染内存/时间

### 4.7.2 图层服务配置

针对单个图层的服务配置：

1. 进入图层编辑页面
2. 在"发布"标签页配置服务选项
3. 可配置：
   - 是否在某服务中发布
   - 默认样式
   - 查询限制

### 4.7.3 服务异常处理

配置错误响应的格式和内容：

**WMS异常格式：**
- application/vnd.ogc.se_xml
- application/vnd.ogc.se_inimage
- application/vnd.ogc.se_blank

**异常处理策略：**
- 返回空白图像
- 返回错误图像
- 返回XML异常文档

### 4.7.4 CORS配置

跨域资源共享（CORS）配置，允许Web应用从不同域访问GeoServer服务：

在web.xml中配置：
```xml
<filter>
  <filter-name>cross-origin</filter-name>
  <filter-class>org.eclipse.jetty.servlets.CrossOriginFilter</filter-class>
  <init-param>
    <param-name>allowedOrigins</param-name>
    <param-value>*</param-value>
  </init-param>
  <init-param>
    <param-name>allowedMethods</param-name>
    <param-value>GET,POST,PUT,DELETE,HEAD,OPTIONS</param-value>
  </init-param>
</filter>
```

## 本章小结

本章详细介绍了GeoServer支持的OGC标准服务：

1. **OGC标准概述**：理解OGC的作用和GeoServer支持的标准
2. **WMS服务**：学习地图图像服务的操作和参数
3. **WFS服务**：掌握矢量要素服务的访问和编辑
4. **WCS服务**：了解栅格覆盖数据服务
5. **WMTS服务**：学习地图瓦片服务和缓存配置
6. **WPS服务**：了解Web处理服务的使用方法

OGC标准服务是GeoServer的核心功能，深入理解这些服务对于有效使用GeoServer至关重要。

在下一章中，我们将学习如何使用SLD和CSS创建地图样式，实现丰富的地图可视化效果。

## 思考与练习

1. 使用GetMap请求获取一张PNG格式的地图图像。
2. 使用WFS GetFeature请求获取JSON格式的矢量数据。
3. 使用CQL_FILTER进行空间和属性查询。
4. 配置图层的WMTS缓存，预生成一定范围的瓦片。
5. 使用WPS执行一个缓冲区分析操作。
6. 比较WMS 1.1.1和1.3.0版本在坐标顺序上的差异。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/geoserver/第03章-数据管理与发布/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver/第05章-地图样式与SLD/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
