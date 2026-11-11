---
layout: default
title: 第01章 - MapLibre GL JS 概述与生态定位
---

# 第01章 - MapLibre GL JS 概述与生态定位

## 1.1 浏览器地图库要落在什么约束里

把全世界的道路、建筑、POI 装进浏览器，同时保证拖动跟手、缩放不糊、倾斜后还有立体感，这是 MapLibre GL JS 的工作范围。它是 TypeScript 写的浏览器端渲染器：接收一份 JSON 样式（style）和一组数据源（source），在 `<canvas>` 上用 WebGL2 把矢量瓦片画出来。它不生产瓦片，也不做空间分析，这两件事分别由瓦片服务和后端承担。

支撑这个定位的是三个固定选择，后面每一章都会回到它们：

1. **数据是矢量瓦片，不是预渲染的 PNG。** 同一条道路在不同缩放级别由同一份几何重新绘制，线宽、颜色、标注位置都能在运行时改，不用为每个缩放级别准备一套图片。
2. **坐标统一在 Web Mercator 的瓦片金字塔上。** zoom 为 z 时整个世界被切成 2^z × 2^z 个瓦片，单个瓦片在屏幕上按 512 CSS 像素宽绘制，瓦片内部的几何坐标归一化到 0–8192。这个 8192 写在 `src/data/extent.ts` 的 `EXTENT = 8192`，来源是 int16 顶点在丢掉符号位、线顶点数据打包位和右侧越界缓冲位之后剩下的 2^13。
3. **渲染走 GPU。** 每个图层的每个可见瓦片最终落成一次 `gl.drawElements`，样式属性被翻译成 shader 的 uniform 或顶点属性。数据量受带宽和解析速度限制，效果受 WebGL2 能力和样式规范限制，手感受每帧能提交多少 draw call 限制。

理解这三条，就能判断一个需求该不该落到这个库上，而不是先写代码再看能不能跑。

## 1.2 从 Mapbox GL JS 分叉出来的时间线

MapLibre GL JS 的起源不是从零设计，而是一次许可证事件的产物。原来的 mapbox-gl-js 在 1.x 时代是 BSD 许可的开源项目；2020 年 12 月 Mapbox 发布 v2.0.0 并改为非 OSS 许可，社区随即在 npm 上接管了 `maplibre-gl` 这个包名，把最后一个 BSD 版本继续维护下去。

| 时间（npm 发布时间） | 事件 |
| --- | --- |
| 2020-11-19 | mapbox-gl 1.13.0，BSD 许可的最后一个主线版本 |
| 2020-12-08 | mapbox-gl 2.0.0 发布，许可改为非 OSS |
| 2020-12-09 | `maplibre-gl` 包在 npm 创建，发布占位版本 0.0.0 |
| 2020-12-10 | 1.13.0-rc.0 到 rc.4 连续发布，目标写得很明确：作为 1.x 的 drop-in 替换 |
| 2021-07-03 | 1.15.0，1.x 线的收尾 |
| 2022-01-13 | 2.0.0，开始与上游 API 分化 |
| 2023-05-23 | 3.0.0 |
| 2024-02-01 | 4.0.0 |
| 2024-12-31 | 5.0.0 |
| 2026-07-22 | 6.0.0 |
| 2026-11-07 | 6.17.0，本教程对照的版本 |

许可证是 BSD-3-Clause，`package.json` 里写的是 `"license": "BSD-3-Clause"`，`LICENSE.txt` 是标准三条款文本。它的实际含义是：可以商用、可以闭源分发、可以改源码，只要保留版权声明和免责条款，且不能用作者名义为你的产品背书。这一点和依赖地图厂商 token 的方案有本质差别——MapLibre 自身不需要 key，瓦片从哪来、要不要付费，是数据供给方的问题。

版本线从 1.x 到 6.x 已经走得很远，所以"MapLibre 是不是就是 Mapbox GL JS"这个判断要分版本看：1.x 是逐 API 对齐的替换品，2.x 之后两者各自演进，接口与渲染行为都可能不同。把 Mapbox 的旧教程直接套到 6.x 上，最容易在事件对象、WebGL 上下文和 worker 配置上翻车。

## 1.3 渲染管线一瞥

MapLibre 把"解析数据"和"画出来"分在两个线程上，这是它能在低端设备上保持可交互的关键。

```text
主线程                                     Worker 线程
──────────────────────────────────────────────────────────────
Map
 ├─ TileManager       请求瓦片 ─────────►  fetch PBF
 │                                        └─ WorkerTile.parse()
 │                                            ├─ 按 layout 分组 → Bucket
 │                                            └─ FeatureIndex（空间查询用）
 │◄────────────── ArrayBuffer 转移 ──────────┘
 ├─ Style.update()    逐图层计算 paint 属性、过渡插值
 ├─ placement          符号碰撞、标注位置
 └─ Painter.render()
      ├─ offscreen pass   需要离屏渲染的图层
      ├─ sky / atmosphere 天空与大气
      ├─ opaque pass      不透明图层，自顶向下
      └─ translucent pass 半透明图层，自底向上 → 屏幕
```

Bucket 是"矢量瓦片到 WebGL 缓冲"的唯一落点：它把同一组 layout 属性的图层合到一起，产出顶点数组、索引数组，以及数据驱动的 paint 属性数组。Painter 再按图层逐瓦片设置 uniform、绑定缓冲、提交绘制。这些细节在第 3 章展开，这里只需要记住两个数量级：图层类型有 11 种（fill、line、symbol、circle、heatmap、fill-extrusion、raster、hillshade、color-relief、background，外加 custom），source 类型有 6 种（vector、raster、raster-dem、geojson、video、image）。

## 1.4 v5 到 v6：WebGL2 变成硬门槛

从 5.x 升到 6.x 是一次明确的平台收缩，官方迁移指南写在仓库的 `docs/guides/v5-to-v6-migration-guide.md`，要点如下：

| 变更 | v5 行为 | v6 行为 | 迁移动作 |
| --- | --- | --- | --- |
| 图形接口 | WebGL2 优先，可回退 WebGL1 | 只支持 WebGL2 | 不支持 WebGL2 的设备直接不可用 |
| 上下文类型 | `canvasContextAttributes.contextType` 可选 webgl1/webgl2 | 只接受 `'webgl2'` | 删掉 webgl1 相关配置 |
| 失败表现 | 降级或静默失败 | 构造函数抛 `GPUInitializationError` | 用 try/catch 包住 `new Map()` |
| 分发格式 | UMD + ESM + 独立 CSP 包 | 仅 ESM（`maplibre-gl.mjs`） | `<script type="module">` 或打包器 |
| 默认导入 | `import maplibregl from 'maplibre-gl'` | 命名导入或 `import * as` | 改导入语句 |
| 内部 transform | `map.transform` 可用 | 已移除，Map 组合 Camera | 改用公开 API |
| 事件类型 | 部分为类型别名 | 全部是类，`data` 事件带完整 source 信息 | 用 `event.type` 判断，不要 `instanceof` |

WebGPU 的状态需要说清楚，因为网上经常把它和 MapLibre 绑在一起讲。截至 6.17.0，主干 `src/` 下只有 `webgl/` 目录，没有 WebGPU 渲染器的源码；仓库里存在一个名为 `webgpu-backend` 的分支，但发布产物里没有对应实现。源码中有两处为将来留的口子：`src/render/render_to_texture_interface.ts` 的注释写明"具体实现放在 backend 目录（webgl/、webgpu/）"，`MapOptions.canvasContextAttributes.contextType` 的类型是 `'webgl2'`，注释称其为"forward-looking API for future WebGPU support"。结论是：现在写生产代码，按 WebGL2 规划；WebGPU 只能作为关注项，不能作为选型理由。

## 1.5 和 Leaflet、OpenLayers、CesiumJS 的分工

这四类库经常被放在一起比较，但它们解决的问题不同，硬要比"谁更强"没有意义。

| 库 | 渲染方式 | 数据模型 | 三维能力 | 许可 | 典型任务 |
| --- | --- | --- | --- | --- | --- |
| MapLibre GL JS | WebGL2，GPU 批渲染 | 矢量瓦片 + style spec | 有：地形、fill-extrusion、globe 投影 | BSD-3-Clause | 高密度矢量底图、样式化专题图、带地形的三维城市 |
| Leaflet | DOM / Canvas 2D | 栅格瓦片 + 几何要素 + 标记 | 无 | BSD-2-Clause | 标记为主的地图、简单叠加、低端设备 |
| OpenLayers | Canvas 2D 与 WebGL 混合 | 多源（WMS/WMTS/矢量/瓦片）、任意投影 | 有限 | BSD-2-Clause | 专业 GIS 投影、WMS 叠加、图层与打印控制 |
| CesiumJS | WebGL，三维地球 | 3D Tiles、CZML、地形 | 完整 | Apache-2.0 | 全球尺度三维场景、飞行轨迹、倾斜摄影 |

判断顺序可以简单化成三问：需要矢量瓦片级别的样式控制和 3D 倾斜，选 MapLibre；只需要底图加一堆标记、还要兼容老设备，Leaflet 的包体和心智负担都更小；业务里绕不开 EPSG 自定义投影、WMS、要素编辑，OpenLayers 的投影与图层体系更顺手；主角是全球球体和 3D Tiles，直接上 CesiumJS。

站内还有两套相邻教程可以对照：需要投影与 WMS 细节看 [OpenLayers 教程](https://znlgis.github.io/gis/tutorial/openlayers/)，需要轻量标记方案看 [Leaflet 教程](https://znlgis.github.io/gis/tutorial/Leaflet/)，移动端与原生渲染看 [MapLibre Native 教程](https://znlgis.github.io/gis/tutorial/maplibre-native/)，三维地球看 [CesiumJS 教程](https://znlgis.github.io/gis/tutorial/cesium/)。

## 1.6 包体与运行时成本

选型时最常被低估的是首屏成本。以 6.17.0 的 npm 产物实测（unpkg 上的 dist 文件，gzip 用 zlib level 9 计算）：

| 文件 | 原始大小 | gzip | brotli |
| --- | --- | --- | --- |
| `dist/maplibre-gl.mjs` | 1,110,272 B（约 1.06 MiB） | 296,154 B（约 289 KiB） | 241,939 B（约 236 KiB） |
| `dist/maplibre-gl-worker.mjs` | 520,114 B（约 508 KiB） | 148,182 B（约 145 KiB） | 121,635 B（约 119 KiB） |
| `dist/maplibre-gl.css` | 71,596 B（约 70 KiB） | 10,161 B（约 9.9 KiB） | 8,326 B（约 8.1 KiB） |

主包和 worker 是两份独立的下载，压缩后合计约 380 KB（brotli）到 440 KB（gzip），还没算 sprite、glyphs 和瓦片本身。首屏要快的项目，应当用 HTTP 压缩、CDN、长缓存这三件事把静态资源成本压掉，而不是指望换成更小的库。

运行时默认值同样值得记：

| 项目 | 默认值 | 源码位置 |
| --- | --- | --- |
| Web Worker 数量 | 1；Safari 为 `max(min(floor(hardwareConcurrency/2), 3), 1)` | `src/util/worker_pool.ts` |
| 并行图片请求 | 16，每帧最多 8 | `src/util/config.ts` |
| 瓦片缓存缩放层数 | 5 | `MapOptions.maxTileCacheZoomLevels` |
| 标注淡入淡出 | 300 ms | `MapOptions.fadeDuration` |
| 画布尺寸上限 | `[4096, 4096]` | `MapOptions.maxCanvasSize` |

worker 只有一个这件事常被误解。v6 默认就是 1，Safari 才按核数开到最多 3，原因是 A/B 测试显示多 worker 的收益不足以抵消内存与启动开销（`worker_pool.ts` 的注释引用了 PR #2354）。如果业务是重 GeoJSON 解析，可以在创建地图之前调高：

```js
import {setWorkerCount, getWorkerCount, setMaxParallelImageRequests} from 'maplibre-gl';

// 必须在 new Map() 之前调用，之后再改不生效
setWorkerCount(2);
setMaxParallelImageRequests(24);

console.log(getWorkerCount()); // 2
```

## 1.7 最小可运行示例

**用 CDN 直接跑一个页面。** 从 6.0.0 起必须用 `<script type="module">`，版本号要写死，`@latest` 在 v6 上会拿到主版本不匹配的产物。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.css" />
  <style>
    html, body { margin: 0; height: 100%; }
    #map { height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.mjs';

    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [116.39, 39.9],
      zoom: 4
    });

    map.on('load', () => console.log('style 与首屏瓦片已就绪'));
  </script>
</body>
</html>
```

**用 npm 加打包器。** 打包器场景下 worker 的 URL 需要手动指定，v6 只对浏览器直接 ESM 做了自动探测。Vite 的写法是导入 `?worker&url`：

```bash
npm install maplibre-gl@^6.17.0
```

```js
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);

const map = new Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [116.39, 39.9],
  zoom: 4
});
```

**处理 WebGL2 不可用。** v6 在拿不到 WebGL2 上下文时抛 `GPUInitializationError`，这个错误可以被捕获，用于展示降级提示而不是白屏。

```js
import {Map, GPUInitializationError, getVersion} from 'maplibre-gl';

// 先自己探一次，用户环境不支持时不必构造 Map
const probe = document.createElement('canvas');
const gl = probe.getContext('webgl2');

if (!gl) {
  document.getElementById('tip').textContent = '当前浏览器不支持 WebGL2，地图无法渲染';
} else {
  try {
    const map = new Map({
      container: 'map',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [116.39, 39.9],
      zoom: 4
    });
    console.log('maplibre-gl', getVersion());
  } catch (err) {
    if (err instanceof GPUInitializationError) {
      console.error('GPU 初始化失败：', err.message);
    } else {
      throw err;
    }
  }
}
```

**离线环境用内联样式。** 没有瓦片服务时，用一份最小的 style JSON 也能验证渲染链路是否通：

```js
const map = new maplibregl.Map({
  container: 'map',
  center: [116.39, 39.9],
  zoom: 3,
  style: {
    version: 8,
    sources: {},
    layers: [
      {id: 'bg', type: 'background', paint: {'background-color': '#e8eef3'}}
    ]
  }
});
```

这份样式只声明了 style spec 版本、空数据源和一个背景图层，能验证 canvas 尺寸、WebGL2 上下文、样式解析三件事。样式规范的完整结构在第 5 章。

## 1.8 生态位：规范、原生端、绑定与数据

MapLibre 不是一个孤立仓库，它是"一套规范 + 多个渲染端"里的浏览器端：

- **样式规范（style spec）**：`@maplibre/maplibre-gl-style-spec` 是独立的 npm 包，6.17.0 依赖 `^26.6.0`，对应 style spec v8。浏览器端和 MapLibre Native 读同一份规范，样式才能跨端复用。规范里当前定义了 11 种图层类型和 6 种 source 类型。
- **MapLibre Native**：C++ 实现，面向 Android、iOS、macOS、Linux 等平台。同一份 style JSON 在 Web 与原生端表现应当一致，但渲染细节（尤其是标注和 3D）会有差异，跨端项目要留验收环节。
- **框架绑定**：React 用 `react-map-gl`（vis.gl 项目），Angular 用 `ngx-maplibre-gl`。它们只做生命周期封装，样式与数据能力仍来自本库。
- **数据供给**：官方 demo tiles、各家商业瓦片服务、自建 tileserver，以及 PMTiles 这类单文件瓦片包。PMTiles 通过 `addProtocol` 接进来，第 13 章会写。
- **插件**：awesome-maplibre 汇总了绘制、3D Tiles、可视化等扩展。插件质量参差，选之前先看它是否还跟着 6.x 的 API 更新。

## 1.9 什么时候不该选它

几个明确的否决条件，提前排除比事后重构便宜：

1. **必须支持 IE11 或 2018 年前后的老浏览器。** v6 要求 WebGL2 且 TypeScript 目标是 ES2022，这两条都过不去。真要覆盖这类环境，只能停留在 1.x/2.x 的旧版本，或者换 Leaflet。
2. **页面主体是大量 DOM 标记和表单交互。** 成百上千个自定义 DOM 覆盖物会拖垮主线程，这类场景 Leaflet 的 Marker 体系更直接，或者用 MapLibre 的 `Marker` + 聚合减少节点数。
3. **需要任意投影的 WMS 叠加与专业制图输出。** OpenLayers 对多投影、WMS、打印的支持是设计目标之一；MapLibre 的自定义投影是 6.15 才作为实验能力引入的（`addProjection`），面上覆盖不如前者。
4. **服务端渲染。** Map 需要真实 DOM 和 WebGL 上下文，SSR 阶段只能占位，地图必须在客户端创建。
5. **只想要一张静态切片图。** 后端的栅格切图服务成本更低，没必要为了显示一张图引入 1 MB 的库。

## 1.10 本章小结

| 判断项 | 结论 |
| --- | --- |
| 出身 | 2020-12 mapbox-gl v2 改许可后，社区基于 BSD 版本分叉，包名 `maplibre-gl` |
| 许可 | BSD-3-Clause，可商用闭源，无需 token |
| 版本 | 本教程对照 6.17.0（2026-11-07）；6.0.0 起仅 ESM、仅 WebGL2 |
| WebGPU | 主分支无实现，仅 `webgpu-backend` 分支；`contextType` 目前只接受 `'webgl2'` |
| 数据模型 | style spec v8：6 种 source、11 种 layer；瓦片 512 px，内部坐标 0–8192 |
| 包体 | 主包 gzip 约 289 KiB，worker 约 145 KiB，CSS 约 9.9 KiB |
| 运行时默认 | 1 个 worker（Safari 最多 3），16 路并行图片请求，标注淡入淡出 300 ms |
| 该选它 | 需要矢量瓦片样式化、平滑缩放、地形与 3D 建筑 |
| 不该选它 | 需要 IE11/老浏览器、以 DOM 标记为主、需要任意投影 WMS、纯后端切图 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第02章-环境搭建与快速上手/" class="chapter-nav__next">下一章 →</a>
</div>
