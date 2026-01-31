---
layout: post
title: 第01章 - CesiumJS概述与入门
date: 2024-03-01 10:00:00 +0800
categories: [GIS, CesiumJS]
tags: [CesiumJS, 3D地球, WebGL]
---

# 第01章：CesiumJS概述与入门

## 1.1 CesiumJS 简介

### 1.1.1 什么是 CesiumJS

CesiumJS 是一个开源的 JavaScript 库，专门用于在 Web 浏览器中创建高性能的 3D 地球和 2D 地图可视化应用。它基于 WebGL 技术实现硬件加速图形渲染，无需任何插件即可在现代浏览器中运行，是当今 Web 端三维地理信息可视化领域最知名和最成熟的开源解决方案之一。

CesiumJS 由 Cesium GS 公司（原 Analytical Graphics, Inc.）开发和维护，采用 Apache 2.0 开源许可证，可免费用于商业和非商业项目。

```
┌─────────────────────────────────────────────────────────────────┐
│                      Web 应用层                                  │
│    (智慧城市、数字孪生、航空航天、地理信息系统、教育科研...)         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CesiumJS                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Viewer    │  │   Scene     │  │   Camera    │             │
│  │  (视图器)    │  │   (场景)    │  │   (相机)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Entity     │  │ Primitive   │  │ DataSource  │             │
│  │  (实体)      │  │ (图元)      │  │ (数据源)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WebGL 渲染引擎                              │
│     顶点着色器 │ 片段着色器 │ 纹理映射 │ 帧缓冲 │ ...            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       数据服务层                                  │
│  Cesium ion │ 3D Tiles │ 地形服务 │ 影像服务 │ GeoJSON │ ...    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1.2 CesiumJS 的历史发展

CesiumJS 的发展历程是 Web 三维地理可视化技术演进的缩影：

| 年份 | 里程碑事件 |
|-----|-----------|
| 2011 | Analytical Graphics, Inc. (AGI) 开始开发 Cesium 项目 |
| 2012 | CesiumJS 1.0 正式发布，支持基本 3D 地球渲染 |
| 2013 | 引入 Entity API，简化开发体验 |
| 2014 | 发布 3D Tiles 规范草案 |
| 2015 | 3D Tiles 1.0 正式发布，支持大规模三维数据 |
| 2016 | Cesium ion 云平台推出 |
| 2017 | 3D Tiles 成为 OGC 社区标准 |
| 2019 | 公司更名为 Cesium GS |
| 2020 | 支持 glTF 2.0，增强模型渲染能力 |
| 2021 | 发布模块化 npm 包结构 |
| 2022 | 3D Tiles Next 扩展发布 |
| 2023 | CesiumJS 持续优化云原生支持 |
| 2024 | 增强 AI 集成与实时数据流支持 |

### 1.1.3 CesiumJS 的核心特点

CesiumJS 之所以成为三维地理可视化的首选方案，是因为具备以下关键特点：

#### 1. 高精度全球渲染

CesiumJS 基于 WGS84 椭球体模型实现高精度全球渲染：

| 特性 | 描述 |
|-----|------|
| 坐标精度 | 支持厘米级定位精度 |
| 全球覆盖 | 无缝全球地球渲染 |
| 多模式显示 | 3D 地球、2D 地图、2.5D 哥伦布视图 |
| 地形支持 | 全球高程地形数据 |

#### 2. 丰富的数据格式支持

CesiumJS 支持多种业界标准数据格式：

**三维模型格式：**

| 格式 | 描述 |
|-----|------|
| glTF/GLB | 通用三维模型传输格式 |
| 3D Tiles | 大规模三维数据流式加载格式 |
| KML/KMZ | Google Earth 兼容格式 |
| CZML | Cesium 专用动态数据格式 |

**地理数据格式：**

| 格式 | 描述 |
|-----|------|
| GeoJSON | 通用矢量数据格式 |
| TopoJSON | 拓扑优化的矢量格式 |
| WMS/WMTS | OGC 地图服务标准 |
| TMS | 瓦片地图服务 |

#### 3. 跨平台兼容性

CesiumJS 可在多种平台和浏览器上运行：

| 平台/浏览器 | 支持状态 |
|------------|---------|
| Chrome | ✅ 完全支持 |
| Firefox | ✅ 完全支持 |
| Edge | ✅ 完全支持 |
| Safari | ✅ 完全支持 |
| 移动端 Chrome/Safari | ✅ 支持 |
| WebView (Android/iOS) | ✅ 支持 |

#### 4. 性能优化

CesiumJS 内置多种性能优化机制：

```
┌─────────────────────────────────────────────────────────────┐
│                   CesiumJS 性能优化机制                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  视锥体剔除      │  │  LOD 层次细节    │                  │
│  │ (Frustum Cull) │  │ (Level of Detail)│                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  流式加载        │  │  GPU 实例化     │                  │
│  │ (Streaming)     │  │ (Instancing)    │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  瓦片缓存        │  │  按需渲染       │                  │
│  │ (Tile Cache)    │  │ (On-demand)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## 1.2 CesiumJS 核心概念

### 1.2.1 Viewer（视图器）

Viewer 是 CesiumJS 应用的入口点，它封装了所有核心组件：

```javascript
// 创建基本 Viewer
const viewer = new Cesium.Viewer('cesiumContainer', {
    // 配置选项
    animation: true,           // 动画控件
    timeline: true,            // 时间轴控件
    fullscreenButton: true,    // 全屏按钮
    geocoder: true,            // 地理编码搜索
    homeButton: true,          // 主页按钮
    infoBox: true,             // 信息框
    navigationHelpButton: true, // 导航帮助
    sceneModePicker: true,     // 场景模式选择器
    selectionIndicator: true,  // 选择指示器
    baseLayerPicker: true      // 底图选择器
});
```

**Viewer 主要组成：**

| 组件 | 描述 |
|-----|------|
| scene | 场景对象，包含所有渲染内容 |
| camera | 相机对象，控制视角 |
| entities | 实体集合，高级数据管理 |
| dataSources | 数据源集合 |
| imageryLayers | 影像图层集合 |
| terrainProvider | 地形提供者 |
| clock | 时钟对象，控制时间 |

### 1.2.2 Scene（场景）

Scene 是所有 3D 内容的容器：

```javascript
// 访问场景对象
const scene = viewer.scene;

// 场景配置
scene.globe.enableLighting = true;     // 启用光照
scene.fog.enabled = true;              // 启用雾效
scene.skyAtmosphere.show = true;       // 显示大气层
scene.sun.show = true;                 // 显示太阳
scene.moon.show = true;                // 显示月亮
```

### 1.2.3 Camera（相机）

Camera 控制观察视角：

```javascript
// 相机定位
viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 15000),
    orientation: {
        heading: Cesium.Math.toRadians(0),    // 朝向（方位角）
        pitch: Cesium.Math.toRadians(-45),    // 俯仰角
        roll: 0                                // 翻转角
    }
});

// 相机飞行
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(121.5, 31.2, 10000),
    duration: 3  // 飞行时间（秒）
});
```

### 1.2.4 Entity（实体）

Entity 是高级别数据表示方式：

```javascript
// 添加点实体
const point = viewer.entities.add({
    name: '北京',
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
    point: {
        pixelSize: 10,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
    },
    label: {
        text: '北京',
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE
    }
});

// 添加多边形实体
const polygon = viewer.entities.add({
    name: '多边形区域',
    polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
            116.0, 39.0,
            117.0, 39.0,
            117.0, 40.0,
            116.0, 40.0
        ]),
        material: Cesium.Color.RED.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.BLACK
    }
});
```

### 1.2.5 Primitive（图元）

Primitive 是底层渲染 API，性能更高：

```javascript
// 创建几何实例
const instance = new Cesium.GeometryInstance({
    geometry: new Cesium.RectangleGeometry({
        rectangle: Cesium.Rectangle.fromDegrees(116.0, 39.0, 117.0, 40.0)
    }),
    attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED)
    }
});

// 添加到场景
scene.primitives.add(new Cesium.Primitive({
    geometryInstances: instance,
    appearance: new Cesium.PerInstanceColorAppearance()
}));
```

## 1.3 CesiumJS 生态系统

### 1.3.1 Cesium ion 平台

Cesium ion 是官方云平台，提供：

| 服务 | 描述 |
|-----|------|
| 数据托管 | 托管 3D Tiles、地形、影像数据 |
| 数据转换 | 在线转换各种 3D 数据格式 |
| 全球数据 | 提供全球地形、卫星影像 |
| 访问令牌 | API 访问认证管理 |

```javascript
// 使用 Cesium ion 访问令牌
Cesium.Ion.defaultAccessToken = 'your_access_token';

// 加载 Cesium ion 资源
const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
    imageryProvider: Cesium.createWorldImagery()
});
```

### 1.3.2 3D Tiles 规范

3D Tiles 是 OGC 标准，用于流式传输大规模三维数据：

```
┌─────────────────────────────────────────────────────────────┐
│                    3D Tiles 层级结构                          │
├─────────────────────────────────────────────────────────────┤
│  tileset.json (根节点)                                       │
│      ├── tile_0.b3dm (批量三维模型)                          │
│      ├── tile_1.b3dm                                        │
│      ├── children/                                          │
│      │   ├── tile_0_0.b3dm (子节点)                         │
│      │   ├── tile_0_1.b3dm                                  │
│      │   └── ...                                            │
│      └── ...                                                │
└─────────────────────────────────────────────────────────────┘
```

**3D Tiles 支持的内容类型：**

| 类型 | 扩展名 | 描述 |
|-----|--------|------|
| Batched 3D Model | .b3dm | 批量三维模型 |
| Instanced 3D Model | .i3dm | 实例化三维模型 |
| Point Cloud | .pnts | 点云数据 |
| Composite | .cmpt | 复合瓦片 |

### 1.3.3 相关技术栈

CesiumJS 常与以下技术配合使用：

| 技术 | 用途 |
|-----|------|
| Vue/React/Angular | 前端框架集成 |
| Node.js | 后端服务开发 |
| Turf.js | 空间分析计算 |
| three.js | 自定义渲染效果 |
| PostGIS | 空间数据存储 |
| GeoServer | 地图服务发布 |

## 1.4 CesiumJS 应用场景

### 1.4.1 典型应用领域

| 领域 | 应用场景 |
|-----|---------|
| **智慧城市** | 城市三维可视化、BIM 建筑模型、市政设施管理 |
| **数字孪生** | 工厂数字孪生、园区管理、实时监控 |
| **航空航天** | 卫星轨道仿真、飞行航线规划、空间态势感知 |
| **交通运输** | 车辆追踪、航运监控、铁路线路管理 |
| **应急管理** | 灾害模拟、救援指挥、风险评估 |
| **国土测绘** | 地形分析、规划展示、土地管理 |
| **教育科研** | 地球科学教学、考古展示、科研可视化 |

### 1.4.2 实际案例

#### 案例1：智慧城市三维可视化

```javascript
// 加载城市建筑 3D Tiles
const cityBuildings = viewer.scene.primitives.add(
    new Cesium.Cesium3DTileset({
        url: 'https://your-server/city/tileset.json'
    })
);

// 设置建筑样式
cityBuildings.style = new Cesium.Cesium3DTileStyle({
    color: {
        conditions: [
            ['${height} >= 100', 'color("red")'],
            ['${height} >= 50', 'color("orange")'],
            ['true', 'color("gray")']
        ]
    }
});

// 定位到城市
viewer.zoomTo(cityBuildings);
```

#### 案例2：卫星轨道追踪

```javascript
// 使用 CZML 描述卫星轨道
const czml = [{
    id: 'document',
    name: 'Satellite Orbit',
    version: '1.0'
}, {
    id: 'satellite',
    name: '卫星1号',
    availability: '2024-01-01T00:00:00Z/2024-01-02T00:00:00Z',
    position: {
        epoch: '2024-01-01T00:00:00Z',
        cartographicDegrees: [
            0, 116.0, 39.0, 400000,
            3600, 120.0, 35.0, 400000,
            7200, 124.0, 31.0, 400000
        ]
    },
    model: {
        gltf: './models/satellite.glb',
        scale: 1000
    },
    path: {
        material: { solidColor: { color: { rgba: [255, 255, 0, 255] } } },
        width: 2,
        leadTime: 3600,
        trailTime: 3600
    }
}];

// 加载 CZML 数据
const dataSource = Cesium.CzmlDataSource.load(czml);
viewer.dataSources.add(dataSource);
```

#### 案例3：地形分析展示

```javascript
// 加载高精度地形
viewer.terrainProvider = Cesium.createWorldTerrain({
    requestWaterMask: true,
    requestVertexNormals: true
});

// 启用地形遮挡
viewer.scene.globe.depthTestAgainstTerrain = true;

// 添加地形分析剖面线
const positions = Cesium.Cartesian3.fromDegreesArray([
    116.0, 39.0,
    117.0, 40.0,
    118.0, 39.5
]);

viewer.entities.add({
    name: '剖面线',
    polyline: {
        positions: positions,
        width: 3,
        material: Cesium.Color.RED,
        clampToGround: true
    }
});
```

## 1.5 CesiumJS 版本与特性

### 1.5.1 版本演进

| 版本范围 | 时间 | 主要特性 |
|---------|------|---------|
| 1.0 - 1.40 | 2012-2017 | 基础功能建立，Entity API，3D Tiles 初版 |
| 1.41 - 1.80 | 2018-2021 | 性能优化，glTF 2.0，模块化 |
| 1.81 - 1.100 | 2021-2023 | 3D Tiles Next，云优化，TypeScript 支持 |
| 1.100+ | 2023-至今 | 持续优化，新特效，AI 集成 |

### 1.5.2 模块化结构

CesiumJS 提供模块化 npm 包：

| 包名 | 描述 |
|-----|------|
| cesium | 完整库（包含引擎和控件） |
| @cesium/engine | 核心渲染引擎 |
| @cesium/widgets | UI 控件组件 |

```javascript
// 使用完整包
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// 或使用模块化包
import { Viewer } from '@cesium/engine';
import { Timeline } from '@cesium/widgets';
```

### 1.5.3 选择合适的版本

| 需求 | 推荐方案 |
|-----|---------|
| 快速开发 | 使用 cesium 完整包 |
| 包大小优化 | 使用 @cesium/engine |
| 旧项目兼容 | 保持现有版本 |
| 新功能体验 | 使用最新稳定版 |

## 1.6 学习资源与社区

### 1.6.1 官方资源

| 资源 | URL | 描述 |
|-----|-----|------|
| 官方网站 | https://cesium.com | 产品介绍、下载 |
| 文档中心 | https://cesium.com/learn | 学习教程、API 文档 |
| Sandcastle | https://sandcastle.cesium.com | 在线示例代码 |
| GitHub | https://github.com/CesiumGS/cesium | 源码、Issue |
| 论坛 | https://community.cesium.com | 社区讨论 |

### 1.6.2 学习路径

**入门阶段：**
1. 完成 Quickstart 教程
2. 学习 Sandcastle 示例
3. 掌握 Entity API
4. 理解坐标系统

**进阶阶段：**
1. 深入 Primitive API
2. 学习 3D Tiles
3. 掌握性能优化
4. 自定义着色器

**高级阶段：**
1. 源码阅读
2. 扩展开发
3. 与其他框架集成
4. 生产环境部署

### 1.6.3 社区支持

| 平台 | 用途 |
|-----|------|
| Cesium 论坛 | 官方技术支持 |
| Stack Overflow | 问答（cesiumjs 标签） |
| GitHub Discussions | 技术讨论 |
| 知乎/CSDN | 中文社区教程 |

## 1.7 本章小结

本章介绍了 CesiumJS 的基本概念和核心组件：

1. **CesiumJS 是什么**：基于 WebGL 的开源三维地球可视化库
2. **核心概念**：
   - Viewer：应用入口
   - Scene：场景容器
   - Camera：视角控制
   - Entity：高级数据表示
   - Primitive：底层渲染
3. **主要特点**：跨平台、高性能、丰富的数据格式支持
4. **生态系统**：Cesium ion、3D Tiles、相关技术栈
5. **应用场景**：智慧城市、航空航天、数字孪生等

在下一章中，我们将详细介绍 CesiumJS 的环境搭建与快速开始。

## 1.8 思考与练习

1. CesiumJS 相比其他三维地图库（如 three.js + 地图）有什么优势？
2. Entity API 和 Primitive API 各自适合什么场景？
3. 3D Tiles 解决了什么问题？为什么需要它？
4. 列举三个你能想到的 CesiumJS 应用场景。
5. 访问 Sandcastle 官方示例，运行并理解一个基础示例。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-环境搭建与快速开始" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
