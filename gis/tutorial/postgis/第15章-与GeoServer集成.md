# 第15章：与 GeoServer 集成

## 15.1 概述

GeoServer 是一个开源的地图服务器，可以将 PostGIS 数据库中的空间数据发布为标准的 OGC Web 服务（WMS、WFS、WCS 等）。

### 15.1.1 GeoServer 与 PostGIS 的关系

```
┌─────────────────────────────────────────────────────────────┐
│                    架构示意图                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  客户端应用                                                  │
│  ├── Web 浏览器（OpenLayers、Leaflet）                      │
│  ├── 桌面 GIS（QGIS、ArcGIS）                               │
│  └── 移动应用                                                │
│         │                                                   │
│         │  HTTP (WMS/WFS/WCS/WMTS)                          │
│         ▼                                                   │
│  ┌─────────────────────┐                                    │
│  │    GeoServer        │                                    │
│  │  ├── 图层管理       │                                    │
│  │  ├── 样式渲染       │                                    │
│  │  ├── 缓存管理       │                                    │
│  │  └── 安全控制       │                                    │
│  └─────────────────────┘                                    │
│         │                                                   │
│         │  JDBC                                             │
│         ▼                                                   │
│  ┌─────────────────────┐                                    │
│  │ PostgreSQL/PostGIS  │                                    │
│  │  ├── 空间数据存储   │                                    │
│  │  ├── 空间查询处理   │                                    │
│  │  └── 数据管理       │                                    │
│  └─────────────────────┘                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 15.2 配置 PostGIS 数据存储

### 15.2.1 创建数据存储

在 GeoServer Web 管理界面中：

```
1. 登录 GeoServer 管理界面
   http://localhost:8080/geoserver/web/

2. 数据 → 数据存储 → 添加新的数据存储

3. 选择 "PostGIS" 类型

4. 填写连接参数：
   - 数据存储名称: postgis_store
   - 主机: localhost
   - 端口: 5432
   - 数据库: gis_db
   - 模式: public
   - 用户: postgres
   - 密码: ******
   
5. 高级选项（可选）：
   - 最大连接数: 20
   - 最小连接数: 1
   - 连接超时: 20
   - 验证连接: true
   - 暴露主键: true

6. 保存
```

### 15.2.2 使用 REST API 创建数据存储

```bash
# 创建数据存储
curl -v -u admin:geoserver -X POST \
  -H "Content-Type: application/xml" \
  -d "<dataStore>
        <name>postgis_store</name>
        <connectionParameters>
          <host>localhost</host>
          <port>5432</port>
          <database>gis_db</database>
          <schema>public</schema>
          <user>postgres</user>
          <passwd>password</passwd>
          <dbtype>postgis</dbtype>
        </connectionParameters>
      </dataStore>" \
  "http://localhost:8080/geoserver/rest/workspaces/my_workspace/datastores"

# 使用 JSON 格式
curl -v -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "dataStore": {
      "name": "postgis_store",
      "connectionParameters": {
        "entry": [
          {"@key": "host", "$": "localhost"},
          {"@key": "port", "$": "5432"},
          {"@key": "database", "$": "gis_db"},
          {"@key": "schema", "$": "public"},
          {"@key": "user", "$": "postgres"},
          {"@key": "passwd", "$": "password"},
          {"@key": "dbtype", "$": "postgis"}
        ]
      }
    }
  }' \
  "http://localhost:8080/geoserver/rest/workspaces/my_workspace/datastores"
```

## 15.3 发布图层

### 15.3.1 发布 PostGIS 表

```
1. 数据 → 图层 → 添加新图层

2. 选择数据存储: postgis_store

3. 选择要发布的表（如 poi, roads, districts）

4. 点击 "发布"

5. 配置图层：
   - 基本信息
     - 名称: poi
     - 标题: 兴趣点
     - 摘要: 城市兴趣点数据
   
   - 坐标参考系统
     - 原生 SRS: EPSG:4326
     - 声明的 SRS: EPSG:4326
     - SRS 处理: 强制声明
   
   - 边界框
     - 点击 "从数据计算" 和 "从原生边界计算"

6. 保存
```

### 15.3.2 发布 SQL 视图

```sql
-- 在 PostGIS 中创建视图
CREATE VIEW poi_with_buffer AS
SELECT 
    id,
    name,
    category,
    ST_Buffer(geom::geography, 500)::geometry AS geom
FROM poi;

-- 或使用参数化 SQL 视图（在 GeoServer 中配置）
```

在 GeoServer 中配置 SQL 视图：

```
1. 数据 → 图层 → 添加新图层
2. 选择数据存储
3. 点击 "配置新的 SQL 视图"
4. 输入 SQL 语句：
   
   SELECT id, name, category, 
          ST_Simplify(geom, %tolerance%) AS geom
   FROM poi
   WHERE category = '%category%'

5. 设置参数：
   - tolerance: 0.001 (默认值)
   - category: restaurant (默认值)

6. 设置几何列：geom, POINT, 4326
7. 设置主键列：id
8. 保存并发布
```

### 15.3.3 使用 REST API 发布图层

```bash
# 发布图层
curl -v -u admin:geoserver -X POST \
  -H "Content-Type: application/xml" \
  -d "<featureType>
        <name>poi</name>
        <nativeName>poi</nativeName>
        <title>兴趣点</title>
        <srs>EPSG:4326</srs>
        <enabled>true</enabled>
      </featureType>" \
  "http://localhost:8080/geoserver/rest/workspaces/my_workspace/datastores/postgis_store/featuretypes"
```

## 15.4 样式配置

### 15.4.1 SLD 样式示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>poi_style</Name>
    <UserStyle>
      <Title>POI 样式</Title>
      <FeatureTypeStyle>
        <!-- 按类别设置不同颜色 -->
        <Rule>
          <Name>餐饮</Name>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>category</ogc:PropertyName>
              <ogc:Literal>餐饮</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#FF6600</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#000000</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>10</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        
        <Rule>
          <Name>医院</Name>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>category</ogc:PropertyName>
              <ogc:Literal>医院</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>cross</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#FF0000</CssParameter>
                </Fill>
              </Mark>
              <Size>12</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        
        <!-- 默认样式 -->
        <Rule>
          <Name>其他</Name>
          <ElseFilter/>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#0066FF</CssParameter>
                </Fill>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        
        <!-- 标注 -->
        <Rule>
          <TextSymbolizer>
            <Label>
              <ogc:PropertyName>name</ogc:PropertyName>
            </Label>
            <Font>
              <CssParameter name="font-family">SimHei</CssParameter>
              <CssParameter name="font-size">12</CssParameter>
            </Font>
            <LabelPlacement>
              <PointPlacement>
                <AnchorPoint>
                  <AnchorPointX>0.5</AnchorPointX>
                  <AnchorPointY>0</AnchorPointY>
                </AnchorPoint>
                <Displacement>
                  <DisplacementX>0</DisplacementX>
                  <DisplacementY>-10</DisplacementY>
                </Displacement>
              </PointPlacement>
            </LabelPlacement>
            <Halo>
              <Radius>2</Radius>
              <Fill>
                <CssParameter name="fill">#FFFFFF</CssParameter>
              </Fill>
            </Halo>
          </TextSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
```

### 15.4.2 多边形样式

```xml
<Rule>
  <Name>行政区</Name>
  <PolygonSymbolizer>
    <Fill>
      <CssParameter name="fill">#AACCEE</CssParameter>
      <CssParameter name="fill-opacity">0.5</CssParameter>
    </Fill>
    <Stroke>
      <CssParameter name="stroke">#003366</CssParameter>
      <CssParameter name="stroke-width">2</CssParameter>
    </Stroke>
  </PolygonSymbolizer>
</Rule>
```

### 15.4.3 线样式

```xml
<Rule>
  <Name>道路</Name>
  <LineSymbolizer>
    <Stroke>
      <CssParameter name="stroke">#FF9900</CssParameter>
      <CssParameter name="stroke-width">3</CssParameter>
      <CssParameter name="stroke-linecap">round</CssParameter>
      <CssParameter name="stroke-linejoin">round</CssParameter>
    </Stroke>
  </LineSymbolizer>
</Rule>
```

## 15.5 WMS 服务使用

### 15.5.1 GetCapabilities

```
http://localhost:8080/geoserver/wms?
  service=WMS&
  version=1.1.1&
  request=GetCapabilities
```

### 15.5.2 GetMap

```
http://localhost:8080/geoserver/wms?
  service=WMS&
  version=1.1.1&
  request=GetMap&
  layers=my_workspace:poi&
  styles=poi_style&
  bbox=116,39,117,40&
  width=800&
  height=600&
  srs=EPSG:4326&
  format=image/png
```

### 15.5.3 GetFeatureInfo

```
http://localhost:8080/geoserver/wms?
  service=WMS&
  version=1.1.1&
  request=GetFeatureInfo&
  layers=my_workspace:poi&
  query_layers=my_workspace:poi&
  info_format=application/json&
  x=400&
  y=300&
  width=800&
  height=600&
  bbox=116,39,117,40&
  srs=EPSG:4326
```

## 15.6 WFS 服务使用

### 15.6.1 GetFeature

```
# GML 格式
http://localhost:8080/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=GetFeature&
  typeName=my_workspace:poi&
  outputFormat=application/gml+xml;version=3.2

# GeoJSON 格式
http://localhost:8080/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=GetFeature&
  typeName=my_workspace:poi&
  outputFormat=application/json

# 带过滤条件
http://localhost:8080/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=GetFeature&
  typeName=my_workspace:poi&
  outputFormat=application/json&
  CQL_FILTER=category='餐饮'

# 空间过滤
http://localhost:8080/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=GetFeature&
  typeName=my_workspace:poi&
  outputFormat=application/json&
  CQL_FILTER=BBOX(geom,116.3,39.8,116.5,40.0)
```

## 15.7 性能优化

### 15.7.1 PostGIS 端优化

```sql
-- 创建空间索引
CREATE INDEX idx_poi_geom ON poi USING GIST (geom);

-- 分析表
ANALYZE poi;

-- 创建用于过滤的普通索引
CREATE INDEX idx_poi_category ON poi (category);

-- 创建复合索引
CREATE INDEX idx_poi_category_geom ON poi USING GIST (geom) WHERE category = '餐饮';

-- 简化大几何
UPDATE districts SET geom_simplified = ST_Simplify(geom, 0.001);
```

### 15.7.2 GeoServer 端优化

```
1. 启用 GeoWebCache 缓存
   - 配置瓦片网格
   - 设置缓存策略
   
2. 配置连接池
   - 最大连接数根据服务器配置
   - 设置合适的超时时间
   
3. 启用原生 BBOX 过滤
   - 在图层配置中启用
   
4. 使用 SQL 视图预聚合数据
   - 对于大数据量的统计查询

5. 配置样式缓存
   - 减少 SLD 解析开销
```

### 15.7.3 配置 GeoWebCache

```xml
<!-- gwc-layers.xml -->
<GeoServerLayer>
  <name>my_workspace:poi</name>
  <mimeFormats>
    <string>image/png</string>
    <string>image/jpeg</string>
  </mimeFormats>
  <gridSubsets>
    <gridSubset>
      <gridSetName>EPSG:4326</gridSetName>
    </gridSubset>
    <gridSubset>
      <gridSetName>EPSG:900913</gridSetName>
    </gridSubset>
  </gridSubsets>
  <expireCache>3600</expireCache>
  <expireClients>600</expireClients>
</GeoServerLayer>
```

## 15.8 安全配置

### 15.8.1 数据安全

```sql
-- 创建只读用户
CREATE USER geoserver_reader WITH PASSWORD 'password';
GRANT CONNECT ON DATABASE gis_db TO geoserver_reader;
GRANT USAGE ON SCHEMA public TO geoserver_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO geoserver_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO geoserver_reader;
```

### 15.8.2 GeoServer 安全配置

```
1. 设置图层安全规则
   安全 → 数据 → 添加新规则
   
2. 配置服务安全
   安全 → 服务 → 设置服务访问权限
   
3. 启用 SSL/HTTPS
   在代理服务器或应用服务器配置
```

## 15.9 本章小结

本章详细介绍了 PostGIS 与 GeoServer 的集成：

1. **数据存储配置**：连接 PostGIS 数据库
2. **图层发布**：表、视图、SQL 视图
3. **样式配置**：SLD 样式定义
4. **服务使用**：WMS、WFS 服务
5. **性能优化**：索引、缓存、连接池
6. **安全配置**：用户权限、服务安全

## 15.10 下一步

在下一章中，我们将学习与 QGIS 集成，包括：

- QGIS 连接 PostGIS
- 数据编辑
- 空间分析
- 地图制作

---

**相关资源**：
- [GeoServer 官方文档](https://docs.geoserver.org/)
- [GeoServer REST API](https://docs.geoserver.org/stable/en/user/rest/)
- [SLD 参考](https://docs.geoserver.org/stable/en/user/styling/sld/reference/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第14章-三维与曲线几何" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第16章-与QGIS集成" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
