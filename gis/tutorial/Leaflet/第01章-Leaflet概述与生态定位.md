---
layout: default
title: 第01章 - Leaflet 概述与生态定位
---

# 第01章 - Leaflet 概述与生态定位

Leaflet 是 2010 年 Volodymyr Agafonkin 写出的一个 JavaScript 地图库，十几年过去，它的 README 依然用同一句话定位自己：`Leaflet is the leading open-source JavaScript library for building powerful interactive maps`。这句话短，但把范围划得很死——它做的是"可交互地图"这一层，不做 GIS 平台，不做三维地球，也不做数据处理。

理解这个边界，比背 API 重要。因为 Leaflet 的大部分设计选择、以及与同类的取舍，都来自"只做地图交互"这个前提：零运行时依赖（`package.json` 里没有 `dependencies` 字段）、约 40 KB gzip 的 JS 加 2.4 KB gzip 的 CSS、BSD 2-Clause 许可证、源码按 `src/{core,dom,geo,geometry,layer,map}` 几个目录平铺，没有编译步骤。仓库 `AGENTS.md` 的原话是 `Plain ES modules with JSDoc types; there is no compile step for src`。

这一章解决三个问题：Leaflet 在 GIS 技术栈里站哪个位置；1.9.4 与 2.0 beta 该选哪个；以及为什么 2.0 的写法与你在网上抄到的 1.x 代码不兼容。

## 1.1 三条职责与三条边界

### 1.1.1 它实际负责的三件事

把 Leaflet 拆开看，它只做三件事，其余全部交给别的层。

**第一件是经纬度到屏幕像素的换算。** 链路是 `LatLng` → `CRS.project()` → 像素坐标 → 减去像素原点 → 给 DOM 元素设 `transform`。`map.project()`、`map.latLngToLayerPoint()`、`map.getPixelOrigin()` 这一组 API 就是这条链路的公开入口。

**第二件是图层的生命周期。** 任何图层都经历 `beforeAdd` → `onAdd` → `onRemove` 三个阶段，地图负责在合适的时机调用，并负责在缩放、平移时通知图层重算位置。

**第三件是输入事件到地图语义的转换。** 原始 `pointerdown`/`pointermove` 被翻译成 `dragstart`、`zoom`、`click`（带 `latlng`、`containerPoint`、`layerPoint`），再分发给地图、图层、控件。

地图瓦片从哪来、几何数据是什么格式、服务端用什么投影算面积——Leaflet 一概不问。它拿到 URL 模板就发 `<img>` 请求，拿到 GeoJSON 就转成 `Path` 对象，仅此而已。

### 1.1.2 它明确不做的四件事

下面四类需求经常被误派给 Leaflet，结果是要么写出一堆别扭代码，要么最后换库：

| 需求 | Leaflet 核心是否提供 | 现实做法 |
|------|----------------------|----------|
| 任意投影转换（如 CGCS2000 / UTM） | 否，内置只有 `EPSG3857`、`EPSG4326`、`EPSG3395`、`SimpleCRS` 等少数 CRS | 用 Proj4Leaflet，或在服务端出图 |
| 矢量瓦片渲染（MVT / PBF） | 否，核心只有栅格瓦片 `GridLayer` 体系 | 用 `leaflet.vectorgrid` 之类插件，或换 MapLibre GL JS |
| 三维 / 地形 / 倾斜 | 否 | Cesium |
| 空间分析（缓冲区、叠加、路径规划） | 否 | PostGIS、JTS/GEOS、turf.js，算完把结果当 GeoJSON 塞进来 |

这张表的意义在于决定架构：**Leaflet 是展示层，计算和存储必须在它外面完成**。把 PostGIS 的 `ST_Buffer` 结果当 GeoJSON 图层加载，比在浏览器里用 turf 循环算几万个点要快一到两个数量级，而且不用把原始数据全推到前端。

### 1.1.3 在整套 GIS 栈里的位置

一个典型的生产链路如下，Leaflet 只占最右边一格：

```text
PostGIS / 文件数据
      │  SQL / GDAL
      ▼
GeoServer / MapServer / TiTiler / 自研瓦片服务
      │  WMS · WMTS · XYZ 瓦片 · GeoJSON API
      ▼
  HTTP / CDN
      │
      ▼
┌──────────────────────────────┐
│  浏览器                       │
│  ┌────────────────────────┐  │
│  │ Leaflet                │  │
│  │  GridLayer (瓦片)       │  │
│  │  Path / Marker (矢量)   │  │
│  │  Popup / Tooltip        │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

这也解释了为什么第 6 章要专门讲 WMS——Leaflet 与 OGC 服务之间的接口只有 URL 参数这一层，参数拼错一个 `version`，服务端就会按另一套轴序返回图片，表现为"地图整体转了 90 度"。

### 1.1.4 一个单文件能做什么

先看结果，再谈原理。下面这个文件用 CDN + import map 加载 Leaflet 2.0，不经过任何构建工具：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@2.0.0-beta.3/dist/leaflet.css">
  <style>
    html, body { margin: 0; height: 100%; }
    #map { height: 100%; }
  </style>
  <script type="importmap">
    {"imports": {"leaflet": "https://cdn.jsdelivr.net/npm/leaflet@2.0.0-beta.3/dist/leaflet.js"}}
  </script>
</head>
<body>
  <div id="map"></div>
  <script type="module">
    import {LeafletMap, TileLayer, Marker, Circle} from 'leaflet';

    const map = new LeafletMap('map').setView([39.9042, 116.4074], 11);

    new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    new Marker([39.9042, 116.4074]).addTo(map)
      .bindPopup('天安门').openPopup();

    new Circle([39.95, 116.45], {radius: 3000, color: '#c00', fillOpacity: 0.15}).addTo(map);
  </script>
</body>
</html>
```

注意三个细节，它们是 2.0 与 1.x 的分界：

- 模块脚本里用 `import`，不是 `<script src="leaflet.js">` 之后直接用全局 `L`；
- 用 `new LeafletMap(...)`，不是 `L.map(...)`。`Map` 这个名字可以导入，但会遮蔽 JavaScript 内建的 `Map`，所以官方推荐 `LeafletMap`；
- `<link>` 引入 CSS 不能省。少了它地图能出来，但瓦片拼接、控件样式全乱。

## 1.2 版本现状：1.9.4 与 2.0 beta

### 1.2.1 时间线

| 版本 | 发布时间 | 性质 |
|------|----------|------|
| 1.0.0 | 2016-09-26 | 结束 0.7 系列，确立现在的 API 形态 |
| 1.9.0 | 2022-09-21 | 1.x 最后一个特性版本 |
| 1.9.4 | 2023-05-18 | 1.x 最后一版，官方文档标注为 `the last 1.x release` |
| 2.0.0-alpha | 2025-05-18 | 全面重写：ESM、工厂函数移除、Pointer Events |
| 2.0.0-beta.1 | 2026-11-02 | ES class 重写、自带 TypeScript 类型、可 tree-shake、内联 SVG 默认图标 |
| 2.0.0-beta.3 | 2026-11-10 | 链式视图调用可叠加、坐标校验、事件监听性能重写 |

一个容易踩的事实：**现在 `npm install leaflet` 装到的仍然是 1.9.4**。官方 `docs/install.md` 写得很直白：`Leaflet 1.9.4 is the last 1.x release, and npm install leaflet installs it until 2.0.0 is out`。要装 2.0 beta，命令是 `npm install leaflet@beta`。很多"照着官网示例写却报 `L is not defined`"的问题，源头就是装到了 1.9.4 却用了 2.0 的写法。

### 1.2.2 2.0 到底改了什么

官方迁移文档 `MIGRATION.md` 的开头一句概括得最准：`Leaflet 2.0 is published as ES modules, uses classes instead of factory functions, and handles input with Pointer Events`。展开成可操作的清单：

| 维度 | 1.9.4 | 2.0.0-beta.3 |
|------|-------|--------------|
| 模块格式 | UMD，`<script>` 得到全局 `L`；也有 ESM 构建 | 只有 ESM（`dist/leaflet.js`）；全局版单独发布为 `dist/leaflet-global.js` |
| 默认导出 | `import L from 'leaflet'` 可用 | 无默认导出，必须 `import * as L` 或具名导入 |
| 创建对象 | 工厂函数 `L.marker()`、`L.map()` | `new Marker()`、`new LeafletMap()` |
| 类扩展 | `L.Class.extend()`、`initialize()` | 原生 `class extends`、`constructor()`、`static defaultOptions` |
| 事件模型 | mouse/touch 事件（`mousemove` 等） | Pointer Events（`pointermove` 等） |
| 浏览器基线 | 兼容到 IE11 | Baseline 2022（Safari 15.4+），IE 与其他旧浏览器移除 |
| 打包体积 | 全量约 38 KB gzip | 含瓦片图层的地图 25.6 KB gzip（可 tree-shake） |
| TypeScript | 需要 `@types/leaflet` | 包内自带类型，且与 `@types/leaflet` 不兼容 |
| 默认图标 | 三个 PNG 文件（`dist/images/`） | 内联 SVG，25×46，可用 `color` 改色 |
| 深度导入 | `leaflet/src/...` 可用 | 只保留 `leaflet/dist/leaflet.css` 与 `leaflet/styles.css` |

其中对项目影响最大的是**去掉工厂函数**：2.0 里 `L.marker()` 这类小写函数全部消失，取而代之的是首字母大写的类名。曾经的嵌套类也被提到顶层，改名规则是"路径压平成名字"：

| 1.9.4 | 2.0 |
|-------|-----|
| `L.Control.Layers`、`L.control.layers` | `LayersControl` |
| `L.TileLayer.WMS`、`L.tileLayer.wms` | `WMSTileLayer` |
| `L.Icon.Default` | `DefaultIcon` |
| `L.CRS.EPSG3857` / `L.CRS.Simple` | `EPSG3857` / `SimpleCRS` |
| `L.Map.Drag` 等 handler | `DragHandler` 等 |

### 1.2.3 选版本的判断标准

不要按"新版本更好"选，按依赖链选：

| 场景 | 建议 | 理由 |
|------|------|------|
| 新项目、无历史插件包袱、现代浏览器 | 2.0 beta | 可 tree-shake、自带类型、默认图标问题已解决 |
| 依赖 markercluster、draw、heat 等成熟插件 | 先查插件是否声明支持 2.0 | 2.0 移除了 `extend()`/`initialize()`，老插件直接抛 `not a function` |
| 需要兼容旧浏览器 / 内网老 IE | 1.9.4 | 2.0 只支持 Baseline 2022 |
| 长期维护的政企内网系统 | 1.9.4 | beta 版本不应进生产；1.9.4 已稳定三年 |
| 严格 TypeScript 类型要求 | 2.0 beta | 1.x 依赖 DefinitelyTyped，类型结构与 2.0 不同 |

插件兼容性有官方标记：插件清单里声明了 `compatible-v2: true` 的，才会出现在官网 "Ready for Leaflet 2" 分类下。迁移文档还给了一个同时支持两版的写法（`peerDependencies: "leaflet": "^1.9.0 || ^2.0.0-beta.1"`），这意味着过渡期内插件作者可以两边都兼容——但对使用者来说，仍要逐个确认。

### 1.2.4 仓库长什么样

读源码是理解行为最快的路径。2.0 的源码结构非常扁平：

```text
src/
├── Leaflet.js          # 唯一的入口，只做 re-export 与 version 常量
├── leaflet.css         # 全部样式（约 13 KB 未压缩）
├── types.ts            # 手写的 TS 类型入口
├── core/  Class.js  Events.js  Handler.js  Util.js
├── dom/   DomEvent.js  DomUtil.js  Draggable.js  PosAnimation.js
├── geo/   LatLng.js  LatLngBounds.js  crs/  projection/
├── geometry/  Point.js  Bounds.js  LineUtil.js  PolyUtil.js  Transformation.js
├── layer/  Layer.js  LayerBase.js  LayerGroup.js  FeatureGroup.js  GeoJSON.js
│           DivOverlay.js  Popup.js  Tooltip.js  BlanketOverlay.js
│           marker/  tile/  vector/
└── map/   Map.js  handler/
```

两个值得记住的事实。第一，`src/Leaflet.js` 只有 3.7 KB，内容是 `export const version = '2.0.0-beta.3'` 加一长串 `export {...} from './xxx.js'`——**它不包含任何实现**，只负责把散落的类汇成一个公开入口。第二，源码就是最终产物，没有 Babel/TypeScript 编译步骤；`npm run build` 用 Rolldown 打包到 `dist/`，同时用 `tsc` 从 JSDoc 生成类型声明。这带来一个好处：浏览器调试器里看到的堆栈行号，与 GitHub 上的源码行号一致。

## 1.3 与同类的边界

Leaflet 与另外两个常被放在一起比较的库，差异是架构级的，不是功能多寡：

| | Leaflet | MapLibre GL JS | OpenLayers |
|---|---|---|---|
| 渲染方式 | DOM（`<img>` 瓦片 + SVG/Canvas 矢量） | WebGL | Canvas 2D / WebGL（视构建） |
| 核心数据模型 | 栅格瓦片 + 矢量叠加层 | 矢量瓦片 + style 规范 | 通用 OGC 要素与图层 |
| 坐标系支持 | 内置 4 类 CRS，其余靠插件 | 主要是 Web Mercator | 内置多坐标系与重投影 |
| 学习成本 | 低，API 面小 | 中高，需理解 style/layer/source | 高，概念多 |
| 适合场景 | 业务系统内嵌地图、点位/区域展示、需要大量现成插件 | 矢量瓦片底图、样式化地图、高交互密度 | 多源 OGC 服务聚合、需要精确坐标系控制的专业 GIS |

选择时最实在的一个指标是**数据形态**：底图已经是 XYZ/WMTS 栅格瓦片、叠加层是几十到几万个点线面 → Leaflet 最省事；底图是 MVT 矢量瓦片、需要按 zoom 动态改样式 → MapLibre GL JS；需要在同一张图上叠 WMS、WFS、WMTS 且坐标系各不相同 → OpenLayers。这不是能力高低，是数据模型匹配度。

本站另有 [MapLibre GL JS 教程](https://znlgis.github.io/gis/tutorial/maplibre-gl-js/)、[OpenLayers 教程](https://znlgis.github.io/gis/tutorial/openlayers/) 与 [Cesium 教程](https://znlgis.github.io/gis/tutorial/cesium/)，需要横向对比时可以直接对照阅读。

## 1.4 插件生态的规模与代价

Leaflet 官方插件清单收录了 470 余个插件（`docs/_plugins/` 目录下每个 Markdown 文件对应一个条目，含一个模板文件），按 34 个类别组织，从底图源、聚类、编辑几何、热力图到打印导出都有。这既是 Leaflet 的优势，也是它最大的升级成本：**核心不动，功能全靠插件，插件又深度依赖核心的内部结构**。

2.0 把 `L.Class.extend()`、`initialize()`、`L.Mixin.Events`、`Class.__super__` 全部移除，于是所有用 1.x 类系统写成的插件都需要改。官方在迁移文档里给了兼容两版的模板，并以两个插件作为范例：Leaflet.heat（短小完整）与 Leaflet.markercluster（体量大、还额外支持用 `extend()` 被子类化）。

判断一个插件能否用在 2.0 上，看三处：

1. 有没有用 `L.Class.extend` / `Control.extend` —— 用了就要改；
2. 有没有 `import L from 'leaflet'` 默认导入 —— 用了会直接报模块没有 default 导出；
3. 有没有依赖 `dist/images/` 或 `Icon.Default` 的旧 workaround —— 2.0 里这两个都没了。

## 1.5 三种引入方式的最小示例

### 1.5.1 无构建：import map + CDN

即 1.1.4 的例子。要点在于 `<script type="importmap">` 必须出现在任何 `type="module"` 脚本之前，浏览器解析 `import 'leaflet'` 时靠它解析裸模块名。生产环境应加上 SRI 校验，官方 `docs/install.md` 给了带 `integrity` 与 `crossorigin` 属性的完整片段。

### 1.5.2 有构建：npm + Vite

```bash
# 2.0 beta
npm install leaflet@beta
# 或锁定 1.9.4
npm install leaflet@1.9.4
```

```js
import {LeafletMap, TileLayer} from 'leaflet';
import 'leaflet/styles.css';

const map = new LeafletMap('map').setView([31.2304, 121.4737], 12);
new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);
```

`leaflet/styles.css` 与 `leaflet/dist/leaflet.css` 指向同一个文件，前者是 2.0 新增的别名，写哪个都行。但 `leaflet/src/...` 这类深导入在 2.0 已被禁止，Vite 会报 `Failed to resolve import`。

### 1.5.3 只能用全局变量：leaflet-global.js

有些老系统不方便上模块，2.0 为此单独发布了 `dist/leaflet-global.js`：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@2.0.0-beta.3/dist/leaflet.css">
<script src="https://cdn.jsdelivr.net/npm/leaflet@2.0.0-beta.3/dist/leaflet-global.js"></script>
<script>
  const map = new L.LeafletMap('map').setView([30.67, 104.06], 12);
  new L.TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);
  new L.Marker([30.67, 104.06]).addTo(map);
</script>
```

它把模块导出的所有名字挂到 `window.L` 上，但**不再支持 AMD、CommonJS 和 `L.noConflict()`**。如果页面里同时有别的库占用 `L`，只能自己包一层 IIFE 隔离。

## 1.6 三个真实报错与修法

**`Uncaught SyntaxError: Unexpected token 'export'`**
用普通 `<script src=".../leaflet.js">` 加载 2.0 的 ESM 构建。迁移文档第一句就是 `dist/leaflet.js is now an ES module, so a plain <script> tag fails with a syntax error`。修法：改 `type="module"` + import map，或换成 `leaflet-global.js`。

**`SyntaxError: The requested module 'leaflet' does not provide an export named 'default'`**
沿用了 1.x 的 `import L from 'leaflet'`。2.0 移除了默认导出。修法：`import * as L from 'leaflet'` 或改成具名导入。前者能保留 `L.Marker` 这类写法，迁移时改动最小。

**`TypeError: Cannot read properties of undefined (reading 'map')`** 或 `L is not defined`
页面同时加载了 1.9.4 的全局脚本与 2.0 的模块，或者只加载了模块但代码里写 `L.map()`。模块脚本不会定义全局 `L`，迁移文档明确写了这一点：`The ES module doesn't define a global L`。修法：统一到一种形态，二选一，不要混用。

## 1.7 生产环境的三条硬建议

**锁定精确版本，不要用 `leaflet@beta` 上线。** `@beta` 是移动标签，beta.3 到正式版之间可能还有 beta.4；把 `2.0.0-beta.3` 写死，并配合 CDN 的 SRI 校验，才能保证半年后打开还是同一个文件。

**瓦片服务与库版本解耦。** 底图换成自建 GeoServer 或商业服务时，往往还要求固定的 `maxNativeZoom`、`tms`、`subdomains`。把这些参数写进配置对象而不是散在代码里，换服务商时只改一个 JSON。

**插件清单在上线前跑一遍。** 尤其是 `import L from 'leaflet'` 与 `L.Class.extend` 这两类模式，在 2.0 下 100% 出错，而且错误信息不一定指向插件本身。用构建工具的告警加上一次手工点检，比线上排查便宜得多。

## 1.8 本章小结

| 结论 | 依据 |
|------|------|
| Leaflet 只做"地图交互"这一层 | 零依赖、40 KB gzip、`src/` 只有坐标/图层/事件三块 |
| `npm install leaflet` 当前装到 1.9.4 | `docs/install.md` 明示，2.0 需 `leaflet@beta` |
| 2.0 是破坏性重写 | ESM only、无默认导出、无工厂函数、Pointer Events、Baseline 2022 |
| 2.0 体积优势来自 tree-shaking | 含瓦片图层的地图 25.6 KB gzip，1.x 全量约 38 KB |
| 插件是升级的最大风险点 | `extend()`/`initialize()`/`Class.__super__` 全被移除 |
| 选版本看依赖链，不看新旧 | 无包袱选 2.0 beta；有老插件或旧浏览器选 1.9.4 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第02章-环境搭建与快速开始/" class="chapter-nav__next">下一章 →</a>
</div>
