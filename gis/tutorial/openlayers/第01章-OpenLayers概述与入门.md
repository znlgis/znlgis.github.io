---
layout: default
title: 第01章 - OpenLayers 概述与入门
---

# 第01章 - OpenLayers 概述与入门

## 1.1 OpenLayers 简介

### 1.1.1 什么是 OpenLayers

OpenLayers 是一个高性能、功能丰富的开源 JavaScript 地图库，专门用于在 Web 浏览器中创建交互式地图应用程序。它能够从各种数据源加载、显示和交互地理空间数据，是目前最成熟、功能最完整的开源 Web GIS 前端库之一。

OpenLayers 的核心特性包括：

- **多数据源支持**：支持瓦片服务、矢量数据、WMS、WMTS、WFS 等多种数据源
- **丰富的交互功能**：提供完整的地图导航、要素选择、绘制编辑等交互能力
- **灵活的渲染引擎**：支持 Canvas 和 WebGL 两种渲染方式
- **OGC 标准兼容**：全面支持 OGC 地图服务标准
- **高度可扩展**：模块化设计，易于扩展和定制

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenLayers 生态系统                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │  企业 GIS   │  │   政务平台   │  │  移动应用   │        │
│   │    应用     │  │    系统     │  │   混合开发  │        │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│          │                │                │                │
│          └────────────────┼────────────────┘                │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │ OpenLayers  │                          │
│                    │   核心库    │                          │
│                    └──────┬──────┘                          │
│                           │                                 │
│          ┌────────────────┼────────────────┐                │
│          │                │                │                │
│   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐        │
│   │   Canvas    │  │   WebGL    │  │  OGC 服务   │        │
│   │   渲染引擎  │  │  渲染引擎   │  │   客户端    │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.1.2 项目历史与发展

OpenLayers 项目的发展历程经历了多个重要阶段：

| 时间 | 版本 | 里程碑 |
|------|------|--------|
| 2005 | - | MetaCarta 公司启动项目开发 |
| 2006 | 1.0 | OpenLayers 首个正式版本发布 |
| 2008 | 2.0 | 重大更新，功能大幅增强 |
| 2011 | 2.11 | 最后一个 2.x 系列稳定版本 |
| 2014 | 3.0 | 完全重写，采用现代 JavaScript |
| 2016 | 4.0 | 模块化重构，支持 ES6 |
| 2019 | 5.0 | 改进的 TypeScript 支持 |
| 2020 | 6.0 | 性能优化，WebGL 渲染增强 |
| 2022 | 7.0 | 现代浏览器优化 |
| 2023 | 8.0 | 持续改进，新特性添加 |
| 2024 | 9.0+ | 持续改进，新特性添加 |
| 2025 | 10.0 | image tile source，flat styles rework |
| 2026 | 10.9.0 | GeoZarr 支持，GeoTIFF 改进 |

**版本策略**：

- **主版本更新**：包含破坏性变更，需要迁移代码
- **次版本更新**：新功能添加，向后兼容
- **补丁版本**：Bug 修复和安全更新

### 1.1.3 开源许可证

OpenLayers 采用 **BSD 2-Clause License**（简化 BSD 许可证），这是一个非常宽松的开源许可证：

**BSD 2-Clause 的主要特点**：

1. **自由使用**：可以在任何项目中使用 OpenLayers
2. **商业友好**：可以用于商业软件而无需开源
3. **无需付费**：完全免费使用
4. **保留版权声明**：需要在源码和二进制分发中保留版权声明

```
┌────────────────────────────────────────────────────────────┐
│                   BSD 2-Clause 许可证影响                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   您的 Web 应用程序                                         │
│   ┌────────────────────────────────────┐                   │
│   │  ┌──────────────────────────────┐  │                   │
│   │  │     您的业务代码              │  │  ← 无需开源      │
│   │  └──────────────────────────────┘  │                   │
│   │              │                      │                   │
│   │              ▼                      │                   │
│   │  ┌──────────────────────────────┐  │                   │
│   │  │     OpenLayers 库            │  │  ← BSD 许可      │
│   │  │  （作为依赖库使用）           │  │                   │
│   │  └──────────────────────────────┘  │                   │
│   └────────────────────────────────────┘                   │
│                                                            │
│   唯一要求：保留原始版权声明                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 1.2 OpenLayers 核心特性

### 1.2.1 数据源支持

OpenLayers 支持丰富的数据源类型：

**瓦片数据源**：

| 类型 | 类名 | 说明 |
|------|------|------|
| XYZ 瓦片 | ol/source/XYZ | 通用瓦片服务（OSM、高德、天地图等） |
| TileWMS | ol/source/TileWMS | WMS 瓦片服务 |
| WMTS | ol/source/WMTS | WMTS 瓦片服务 |
| TileArcGISRest | ol/source/TileArcGISRest | ArcGIS REST 瓦片服务 |
| BingMaps | ol/source/BingMaps | 必应地图 |
| Stamen | ol/source/Stamen | Stamen 地图服务 |

**矢量数据源**：

| 类型 | 类名 | 说明 |
|------|------|------|
| Vector | ol/source/Vector | 通用矢量数据源 |
| VectorTile | ol/source/VectorTile | 矢量瓦片 |
| Cluster | ol/source/Cluster | 聚合数据源 |

**OGC 服务**：

| 类型 | 类名 | 说明 |
|------|------|------|
| ImageWMS | ol/source/ImageWMS | WMS 图像服务 |
| TileWMS | ol/source/TileWMS | WMS 瓦片服务 |
| WMTS | ol/source/WMTS | WMTS 服务 |

**支持的数据格式**：

| 格式 | 类名 | 说明 |
|------|------|------|
| GeoJSON | ol/format/GeoJSON | 最常用的矢量格式 |
| KML | ol/format/KML | Google Earth 格式 |
| GML | ol/format/GML | OGC 标准 XML 格式 |
| GPX | ol/format/GPX | GPS 交换格式 |
| TopoJSON | ol/format/TopoJSON | 拓扑 JSON 格式 |
| WKT | ol/format/WKT | Well-Known Text |
| EsriJSON | ol/format/EsriJSON | ArcGIS JSON 格式 |
| MVT | ol/format/MVT | Mapbox 矢量瓦片 |

### 1.2.2 渲染引擎

OpenLayers 提供两种渲染方式：

**Canvas 2D 渲染**：

- 默认渲染方式
- 兼容性好，支持所有现代浏览器
- 适合中等数据量的渲染
- CPU 密集型

**WebGL 渲染**：

- 高性能渲染
- 适合大数据量场景
- GPU 加速
- 需要 WebGL 支持

```
┌─────────────────────────────────────────────────────────────┐
│                    渲染引擎对比                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Canvas 2D                        WebGL                    │
│   ┌─────────────────────┐         ┌─────────────────────┐  │
│   │ 特点：                │         │ 特点：              │  │
│   │ • 兼容性好            │         │ • 高性能            │  │
│   │ • 易于调试            │         │ • GPU 加速          │  │
│   │ • 样式丰富            │         │ • 大数据量支持      │  │
│   │ • CPU 渲染            │         │ • 需要 WebGL        │  │
│   └─────────────────────┘         └─────────────────────┘  │
│                                                             │
│   适用场景：                        适用场景：               │
│   • 常规地图应用           　       • 海量点数据            │
│   • 复杂样式需求           　       • 实时数据可视化        │
│   • 老旧设备兼容           　       • 高帧率动画            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2.3 交互系统

OpenLayers 提供完整的交互系统：

**导航交互**：

| 交互 | 类名 | 说明 |
|------|------|------|
| 拖拽平移 | ol/interaction/DragPan | 鼠标拖拽移动地图 |
| 滚轮缩放 | ol/interaction/MouseWheelZoom | 滚轮缩放地图 |
| 双击缩放 | ol/interaction/DoubleClickZoom | 双击放大地图 |
| 键盘导航 | ol/interaction/KeyboardPan | 键盘方向键平移 |
| 捏合缩放 | ol/interaction/PinchZoom | 触屏捏合缩放 |
| 旋转地图 | ol/interaction/PinchRotate | 触屏旋转地图 |

**选择交互**：

| 交互 | 类名 | 说明 |
|------|------|------|
| 点击选择 | ol/interaction/Select | 点击选择要素 |
| 框选 | ol/interaction/DragBox | 拖拽框选要素 |
| 悬停高亮 | ol/interaction/Pointer | 悬停交互 |

**编辑交互**：

| 交互 | 类名 | 说明 |
|------|------|------|
| 绘制 | ol/interaction/Draw | 绘制新要素 |
| 修改 | ol/interaction/Modify | 修改已有要素 |
| 平移 | ol/interaction/Translate | 平移要素 |
| 捕捉 | ol/interaction/Snap | 捕捉到已有要素 |

### 1.2.4 控件系统

OpenLayers 内置多种地图控件：

```
┌─────────────────────────────────────────────────────────────┐
│                    内置控件一览                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   导航控件                     信息控件                      │
│   ┌─────────────────────┐    ┌─────────────────────┐       │
│   │ • Zoom 缩放按钮      │    │ • Attribution 版权  │       │
│   │ • ZoomSlider 滑块    │    │ • ScaleLine 比例尺  │       │
│   │ • ZoomToExtent 全图  │    │ • MousePosition 坐标│       │
│   │ • Rotate 旋转        │    │ • OverviewMap 鹰眼  │       │
│   └─────────────────────┘    └─────────────────────┘       │
│                                                             │
│   工具控件                     自定义控件                    │
│   ┌─────────────────────┐    ┌─────────────────────┐       │
│   │ • FullScreen 全屏   │    │ • 继承 ol/control   │       │
│   │ • ZoomToExtent 定位 │    │ • 自定义 HTML/CSS   │       │
│   └─────────────────────┘    └─────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 1.3 OpenLayers 架构概览

### 1.3.1 核心架构

OpenLayers 采用模块化架构设计：

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenLayers 核心架构                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                     Map（地图）                      │  │
│   │  - target: 挂载 DOM 元素                            │  │
│   │  - view: 视图配置                                   │  │
│   │  - layers: 图层集合                                 │  │
│   │  - controls: 控件集合                               │  │
│   │  - interactions: 交互集合                           │  │
│   └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│          ┌────────────────┼────────────────┐                │
│          │                │                │                │
│   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐        │
│   │    View     │  │   Layer     │  │   Control   │        │
│   │   (视图)    │  │   (图层)    │  │   (控件)    │        │
│   └──────┬──────┘  └──────┬──────┘  └─────────────┘        │
│          │                │                                 │
│          │         ┌──────▼──────┐                          │
│          │         │   Source    │                          │
│          │         │  (数据源)   │                          │
│          │         └──────┬──────┘                          │
│          │                │                                 │
│          │         ┌──────▼──────┐                          │
│          │         │   Format    │                          │
│          │         │ (数据格式)  │                          │
│          │         └─────────────┘                          │
│          │                                                  │
│   ┌──────▼──────────────────────────────────────────────┐  │
│   │              Projection（投影系统）                  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3.2 模块组织

OpenLayers 的模块按功能组织：

```
ol/
├── Map.js                 # 地图主类
├── View.js                # 视图类
├── Feature.js             # 要素类
├── Overlay.js             # 覆盖物类
├── Observable.js          # 可观察基类
├── Object.js              # 对象基类
│
├── layer/                 # 图层模块
│   ├── Layer.js          # 图层基类
│   ├── Tile.js           # 瓦片图层
│   ├── Vector.js         # 矢量图层
│   ├── VectorTile.js     # 矢量瓦片图层
│   ├── Image.js          # 图像图层
│   ├── Group.js          # 图层组
│   └── Heatmap.js        # 热力图层
│
├── source/                # 数据源模块
│   ├── Source.js         # 数据源基类
│   ├── XYZ.js            # XYZ 瓦片
│   ├── OSM.js            # OpenStreetMap
│   ├── TileWMS.js        # WMS 瓦片
│   ├── WMTS.js           # WMTS 服务
│   ├── Vector.js         # 矢量数据源
│   ├── VectorTile.js     # 矢量瓦片源
│   ├── Cluster.js        # 聚合数据源
│   └── ImageWMS.js       # WMS 图像
│
├── format/                # 数据格式模块
│   ├── GeoJSON.js        # GeoJSON 格式
│   ├── KML.js            # KML 格式
│   ├── GML.js            # GML 格式
│   ├── WKT.js            # WKT 格式
│   ├── TopoJSON.js       # TopoJSON 格式
│   └── MVT.js            # MVT 格式
│
├── style/                 # 样式模块
│   ├── Style.js          # 样式类
│   ├── Fill.js           # 填充样式
│   ├── Stroke.js         # 描边样式
│   ├── Circle.js         # 圆形样式
│   ├── Icon.js           # 图标样式
│   ├── Text.js           # 文本样式
│   └── RegularShape.js   # 规则形状
│
├── control/               # 控件模块
│   ├── Control.js        # 控件基类
│   ├── Zoom.js           # 缩放控件
│   ├── Attribution.js    # 版权控件
│   ├── ScaleLine.js      # 比例尺控件
│   ├── MousePosition.js  # 鼠标位置控件
│   ├── OverviewMap.js    # 鹰眼控件
│   └── FullScreen.js     # 全屏控件
│
├── interaction/           # 交互模块
│   ├── Interaction.js    # 交互基类
│   ├── DragPan.js        # 拖拽平移
│   ├── MouseWheelZoom.js # 滚轮缩放
│   ├── Draw.js           # 绘制交互
│   ├── Modify.js         # 修改交互
│   ├── Select.js         # 选择交互
│   └── Snap.js           # 捕捉交互
│
├── geom/                  # 几何模块
│   ├── Geometry.js       # 几何基类
│   ├── Point.js          # 点
│   ├── LineString.js     # 线
│   ├── Polygon.js        # 面
│   ├── Circle.js         # 圆
│   ├── MultiPoint.js     # 多点
│   ├── MultiLineString.js# 多线
│   └── MultiPolygon.js   # 多面
│
├── proj/                  # 投影模块
│   ├── Projection.js     # 投影类
│   ├── proj4.js          # Proj4 集成
│   └── transforms.js     # 坐标转换
│
└── events/                # 事件模块
    ├── Event.js          # 事件基类
    ├── MapBrowserEvent.js# 地图浏览器事件
    └── condition.js      # 事件条件
```

### 1.3.3 核心类关系

```
┌─────────────────────────────────────────────────────────────┐
│                    核心类继承关系                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Observable                                                │
│       │                                                     │
│       ├── BaseObject                                        │
│       │       │                                             │
│       │       ├── Map                                       │
│       │       ├── View                                      │
│       │       ├── Layer                                     │
│       │       │     ├── TileLayer                           │
│       │       │     ├── VectorLayer                         │
│       │       │     ├── ImageLayer                          │
│       │       │     └── VectorTileLayer                     │
│       │       │                                             │
│       │       ├── Source                                    │
│       │       │     ├── TileSource                          │
│       │       │     │     ├── XYZ                           │
│       │       │     │     ├── TileWMS                       │
│       │       │     │     └── WMTS                          │
│       │       │     ├── VectorSource                        │
│       │       │     └── ImageSource                         │
│       │       │                                             │
│       │       └── Feature                                   │
│       │                                                     │
│       └── Interaction                                       │
│             ├── DragPan                                     │
│             ├── Draw                                        │
│             ├── Select                                      │
│             └── Modify                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 1.4 OpenLayers 与相关技术

### 1.4.1 与其他 Web GIS 库对比

| 特性 | OpenLayers | Leaflet | Mapbox GL JS | Cesium |
|------|------------|---------|--------------|--------|
| 定位 | 全功能 GIS 库 | 轻量级地图库 | 矢量瓦片专用 | 三维地球 |
| 文件大小 | ~500KB | ~40KB | ~500KB | ~5MB |
| 学习曲线 | 较陡 | 平缓 | 中等 | 陡峭 |
| OGC 支持 | 完整 | 需插件 | 有限 | 部分 |
| 矢量瓦片 | 支持 | 需插件 | 原生支持 | 支持 |
| 3D 支持 | 有限 | 无 | 2.5D | 完整 3D |
| 开源许可 | BSD | BSD | 混合 | Apache |
| 社区活跃度 | 高 | 高 | 高 | 中 |
| 商业应用 | 广泛 | 广泛 | 广泛 | 行业应用 |

### 1.4.2 与 GeoServer 的协作

OpenLayers 与 GeoServer 是 Web GIS 的经典组合：

```
┌─────────────────────────────────────────────────────────────┐
│                  OpenLayers + GeoServer 架构                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                   前端 (浏览器)                      │  │
│   │  ┌───────────────────────────────────────────────┐  │  │
│   │  │               OpenLayers                       │  │  │
│   │  │  • 地图渲染                                    │  │  │
│   │  │  • 用户交互                                    │  │  │
│   │  │  • 数据可视化                                  │  │  │
│   │  └───────────────────────────────────────────────┘  │  │
│   └──────────────────────────┬──────────────────────────┘  │
│                              │                              │
│                              │ HTTP/HTTPS                   │
│                              │ (WMS/WFS/WMTS/REST)          │
│                              │                              │
│   ┌──────────────────────────▼──────────────────────────┐  │
│   │                   后端 (服务器)                      │  │
│   │  ┌───────────────────────────────────────────────┐  │  │
│   │  │               GeoServer                        │  │  │
│   │  │  • 地图服务发布                                │  │  │
│   │  │  • 数据管理                                    │  │  │
│   │  │  • 样式配置                                    │  │  │
│   │  └───────────────────────────────────────────────┘  │  │
│   │                         │                            │  │
│   │  ┌───────────────────────────────────────────────┐  │  │
│   │  │            空间数据库 (PostGIS)               │  │  │
│   │  └───────────────────────────────────────────────┘  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**典型交互场景**：

```javascript
// 加载 GeoServer WMS 服务
const wmsLayer = new TileLayer({
  source: new TileWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: {
      'LAYERS': 'workspace:layer_name',
      'TILED': true
    },
    serverType: 'geoserver'
  })
});

// 加载 GeoServer WFS 服务
const wfsSource = new VectorSource({
  format: new GeoJSON(),
  url: function(extent) {
    return 'http://localhost:8080/geoserver/wfs?' +
      'service=WFS&version=1.1.0&request=GetFeature&' +
      'typename=workspace:layer_name&' +
      'outputFormat=application/json&' +
      'srsname=EPSG:3857&' +
      'bbox=' + extent.join(',') + ',EPSG:3857';
  },
  strategy: bboxStrategy
});
```

### 1.4.3 与现代前端框架集成

OpenLayers 可以与主流前端框架无缝集成：

**Vue.js 集成**：

```javascript
// Vue 3 组件示例
import { onMounted, onUnmounted, ref } from 'vue';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

export default {
  setup() {
    const mapRef = ref(null);
    let map = null;
    
    onMounted(() => {
      map = new Map({
        target: mapRef.value,
        layers: [
          new TileLayer({
            source: new OSM()
          })
        ],
        view: new View({
          center: [0, 0],
          zoom: 2
        })
      });
    });
    
    onUnmounted(() => {
      if (map) {
        map.setTarget(null);
      }
    });
    
    return { mapRef };
  }
};
```

**React 集成**：

{% raw %}
```javascript
// React 函数组件示例
import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

function MapComponent() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  useEffect(() => {
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM()
          })
        ],
        view: new View({
          center: [0, 0],
          zoom: 2
        })
      });
    }
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(null);
      }
    };
  }, []);
  
  return <div ref={mapRef} style={{ width: '100%', height: '400px' }} />;
}
```
{% endraw %}

## 1.5 适用场景分析

### 1.5.1 推荐使用场景

**1. 企业级 WebGIS 应用**

```javascript
// 典型的企业 GIS 应用架构
const map = new Map({
  target: 'map',
  layers: [
    // 底图层
    new TileLayer({ source: new XYZ({ url: '...' }) }),
    // 业务图层 - WMS
    new TileLayer({ source: new TileWMS({ ... }) }),
    // 业务图层 - 矢量
    new VectorLayer({ source: new VectorSource({ ... }) })
  ],
  view: new View({
    center: fromLonLat([116.4, 39.9]),
    zoom: 10
  }),
  controls: defaultControls().extend([
    new ScaleLine(),
    new MousePosition({ ... })
  ])
});
```

**2. 地图数据编辑应用**

```javascript
// 要素绘制与编辑
const drawInteraction = new Draw({
  source: vectorSource,
  type: 'Polygon'
});

const modifyInteraction = new Modify({
  source: vectorSource
});

map.addInteraction(drawInteraction);
map.addInteraction(modifyInteraction);
```

**3. 多源数据集成展示**

```javascript
// 集成多种数据源
const layers = [
  new TileLayer({ source: new OSM() }),           // OSM 底图
  new TileLayer({ source: new TileWMS({ ... }) }), // WMS 服务
  new VectorTileLayer({ source: new VectorTile({ ... }) }), // 矢量瓦片
  new VectorLayer({ source: new VectorSource({ ... }) }),   // GeoJSON
  new Heatmap({ source: new VectorSource({ ... }) })        // 热力图
];
```

**4. OGC 服务客户端**

```javascript
// WFS 事务操作
const wfsFormat = new WFS();
const features = vectorSource.getFeatures();

const xml = wfsFormat.writeTransaction(
  features,  // insert
  [],        // update
  [],        // delete
  {
    featureNS: 'http://geoserver/namespace',
    featurePrefix: 'workspace',
    featureType: 'layer_name',
    srsName: 'EPSG:3857'
  }
);
```

### 1.5.2 不太适合的场景

| 场景 | 原因 | 替代方案 |
|------|------|----------|
| 简单的标记地图 | 功能过重 | Leaflet |
| 高性能矢量瓦片 | 非原生支持 | Mapbox GL JS |
| 三维地球应用 | 不支持 3D | Cesium、Three.js |
| 移动端原生应用 | 仅 Web 端 | Mapbox Native SDK |
| 极简主义项目 | 库体积较大 | Leaflet |

### 1.5.3 技术选型建议

```
┌─────────────────────────────────────────────────────────────┐
│                    技术选型决策树                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   项目需求                                                   │
│       │                                                     │
│       ├─── 需要完整 OGC 支持？                               │
│       │         │                                           │
│       │         ├── 是 ──→ OpenLayers ✓                    │
│       │         │                                           │
│       │         └── 否 ──→ 继续判断                        │
│       │                                                     │
│       ├─── 需要矢量瓦片为主？                                │
│       │         │                                           │
│       │         ├── 是 ──→ Mapbox GL JS                    │
│       │         │                                           │
│       │         └── 否 ──→ 继续判断                        │
│       │                                                     │
│       ├─── 需要三维地球？                                    │
│       │         │                                           │
│       │         ├── 是 ──→ Cesium                          │
│       │         │                                           │
│       │         └── 否 ──→ 继续判断                        │
│       │                                                     │
│       ├─── 追求极简轻量？                                    │
│       │         │                                           │
│       │         ├── 是 ──→ Leaflet                         │
│       │         │                                           │
│       │         └── 否 ──→ OpenLayers ✓                    │
│       │                                                     │
│       └─── 企业级 GIS 功能？                                 │
│                 │                                           │
│                 └── 是 ──→ OpenLayers ✓                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 1.6 第一个 OpenLayers 应用

### 1.6.1 环境准备

**方式一：CDN 引入（快速体验）**

```html
<!DOCTYPE html>
<html>
<head>
  <title>OpenLayers 快速入门</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v10.9.0/ol.css">
  <script src="https://cdn.jsdelivr.net/npm/ol@v10.9.0/dist/ol.js"></script>
  <style>
    .map {
      width: 100%;
      height: 400px;
    }
  </style>
</head>
<body>
  <div id="map" class="map"></div>
  <script>
    // 地图代码
  </script>
</body>
</html>
```

**方式二：NPM 安装（推荐）**

```bash
# 创建项目
npm init -y

# 安装 OpenLayers
npm install ol

# 安装构建工具
npm install --save-dev vite
```

### 1.6.2 Hello OpenLayers

**CDN 版本**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hello OpenLayers</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v10.9.0/ol.css">
  <script src="https://cdn.jsdelivr.net/npm/ol@v10.9.0/dist/ol.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
    }
    #map {
      width: 100%;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  
  <script>
    // 创建地图实例
    const map = new ol.Map({
      // 挂载目标
      target: 'map',
      
      // 图层配置
      layers: [
        // OpenStreetMap 底图
        new ol.layer.Tile({
          source: new ol.source.OSM()
        })
      ],
      
      // 视图配置
      view: new ol.View({
        // 北京坐标（经纬度转 Web Mercator）
        center: ol.proj.fromLonLat([116.4074, 39.9042]),
        // 缩放级别
        zoom: 10
      })
    });
    
    console.log('OpenLayers 版本:', ol.VERSION);
    console.log('地图创建成功!');
  </script>
</body>
</html>
```

**NPM 模块化版本**：

```javascript
// main.js
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

// 创建地图实例
const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: fromLonLat([116.4074, 39.9042]),
    zoom: 10
  })
});

console.log('地图创建成功!');
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hello OpenLayers (NPM)</title>
  <style>
    * { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

### 1.6.3 代码解析

**1. 地图对象 (Map)**

```javascript
const map = new Map({
  target: 'map',      // 挂载的 DOM 元素 ID
  layers: [...],      // 图层数组
  view: new View(...) // 视图对象
});
```

**2. 图层 (Layer)**

```javascript
new TileLayer({
  source: new OSM()   // 数据源
});
```

**3. 视图 (View)**

```javascript
new View({
  center: fromLonLat([116.4074, 39.9042]), // 地图中心点
  zoom: 10                                  // 缩放级别
});
```

**4. 坐标转换 (fromLonLat)**

```javascript
// 将经纬度 (EPSG:4326) 转换为 Web Mercator (EPSG:3857)
const webMercatorCoord = fromLonLat([116.4074, 39.9042]);
// 结果: [12958752.49, 4853167.35]
```

### 1.6.4 运行效果

运行上述代码后，将看到：

1. 以北京为中心的地图
2. OpenStreetMap 底图
3. 可以进行平移、缩放等基本交互

```
┌─────────────────────────────────────────────────────────────┐
│                    运行效果预览                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  [+] [-]                              © OpenStreetMap│  │
│   │                                                      │  │
│   │            ╭─────────╮                               │  │
│   │           ╱           ╲                              │  │
│   │          │   北京市    │                              │  │
│   │          │    ·       │                              │  │
│   │           ╲           ╱                              │  │
│   │            ╰─────────╯                               │  │
│   │                                                      │  │
│   │                                                      │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   交互功能：                                                │
│   • 鼠标拖拽：平移地图                                      │
│   • 滚轮滚动：缩放地图                                      │
│   • 双击：放大地图                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 1.7 本章小结

本章介绍了 OpenLayers 的基本概念和特性：

1. **OpenLayers 简介**：高性能、功能丰富的开源 Web GIS 库
2. **核心特性**：数据源支持、渲染引擎、交互系统、控件系统
3. **架构设计**：模块化设计、核心类关系
4. **技术生态**：与 GeoServer、前端框架的集成
5. **适用场景**：企业级 WebGIS、数据编辑、OGC 服务客户端
6. **快速入门**：CDN 和 NPM 两种使用方式

### 关键要点

- OpenLayers 是 Web GIS 领域最成熟的开源库之一
- 采用 BSD 许可证，商业友好
- 完整支持 OGC 标准（WMS、WFS、WMTS 等）
- 模块化设计，按需引入
- 与 GeoServer 是经典的前后端组合

### 下一步

在下一章中，我们将详细介绍环境搭建和快速开始，包括：
- 开发环境配置
- NPM 项目搭建
- 常用底图配置
- 调试技巧

---

[返回目录](index) | [下一章：环境搭建与快速开始 →](第02章-环境搭建与快速开始)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-环境搭建与快速开始" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
