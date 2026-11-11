# Web 地图前端 / 移动端地图 / 国产开源 WebGIS 引擎 —— 教程缺口调研

> 调研人：webfront（task-2）；日期：2026-11-11；范围：浏览器端与移动端地图/三维/可视化开源库，含国产开源项目（不含服务端、不含桌面 GIS）。
> 方法：全仓库文本扫描（1595 个 md/html/js/yml/json 文件，排除 .git/assets/node_modules）+ 官网/仓库证据（shields.io 的 star 与 last-commit 徽章、npm registry 版本与 license、GitHub 仓库与 OSGeo 邮件列表）。star 数为 shields.io 四舍五入值，仅用于量级判断。

## 结论速览

- **P0（建议尽快立项，各 10+ 章）**：Leaflet、MapLibre GL JS、deck.gl —— 全球主流度最高、站点完全缺独立教程，且分别补上"轻量 2D""矢量瓦片 WebGL""GPU 数据可视化"三块 WebGIS 前端拼图。
- **P1（建议排进下一批，8~12 章或重点专题）**：Mars3D、AntV L7、Turf.js、ECharts 地理可视化 —— 中文生态刚需或与现有几何/可视化教程强互补。
- **P2（专题或并入现有教程章节，4~8 章）**：maptalks、JSTS、proj4js、geotiff.js、ol-cesium、PMTiles、Maputnik、flutter_map、MapLibre Native、Mapsforge、GeoStyler；kepler.gl 只建议做导读。

## 明细表

| 项目 | 类别 | 官网/GitHub | License | 主流度证据（2026-11-11） | 一句话定位 | 仓库覆盖状态 | 优先级 | 与现有教程的关系/建议 |
|---|---|---|---|---|---|---|---|---|
| Leaflet | Web 2D 地图库 | leafletjs.com / Leaflet/Leaflet | BSD-2-Clause | 约 46k star；最近提交"昨天"；npm 稳定版 1.9.4（2.x 仍在推进） | 最流行的轻量 2D Web 地图库，插件生态最大 | **仅提及/演示级使用**：全仓库 115 处；demos/map-360-demo 通过 PSV PlanPlugin 用它做联动底图、OpenLayers 教程第 1 章对比表、SharpMap 第 14 章、opengis-skills 技能卡；无独立教程 | **P0** | 与 OpenLayers 教程互补（轻量 vs 全功能）；建议 12~14 章 |
| MapLibre GL JS | Web 矢量瓦片/WebGL | maplibre.org / maplibre/maplibre-gl-js | BSD-3-Clause | 约 12k star；最近提交"昨天"；npm 6.17.0；2020-12 由 OSGeo 社区成员发起，是 Mapbox GL JS v1 的社区 fork | 矢量瓦片 WebGL 渲染的开源标准实现 | **间接覆盖**：GeoLibre 教程 343 处提及，整本以它作默认渲染引擎，但只讲"GeoLibre 怎么用它"，没有 MapLibre 自身的 API、样式规范、表达式教学 | **P0** | 是 GeoLibre 的底层依赖，也是 Mapbox v2 闭源后的开源替代；建议 12~14 章 |
| deck.gl | WebGL 数据可视化 | deck.gl / visgl/deck.gl | MIT | 约 15k star；最近提交"今天"；npm @deck.gl/core 9.4.1 | GPU 大数据空间可视化图层框架（vis.gl 生态） | **仅提及**：GeoLibre 第 17/25 章（COG、点云、性能排查）与 opengis-skills；无教程 | **P0** | 与 Cesium 教程"地学场景"互补（deck.gl 是"数据图层"）；建议 10~12 章 |
| Mars3D | 国产 Cesium 应用框架 | mars3d.cn / marsgis/mars3d | Apache-2.0（npm 标注） | 约 1.1k GitHub star（中文社区热度远高于 star，Gitee 未计入）；最近提交 2026-11；npm mars3d 3.12.1 | 基于 Cesium 的开箱即用三维 GIS 开发框架，国内三维项目常用 | **未覆盖**（0 处提及） | **P1** | 正好是 Cesium 教程（18 章）的上一层业务封装；建议 10~12 章 |
| AntV L7 | 国产地理可视化引擎 | l7.antv.antgroup.com / antvis/L7 | MIT | 约 4.1k star；最近提交 2026-10；npm 2.29.1 | 蚂蚁开源 WebGL 地理可视化引擎，擅长海量点/线/面与动态效果 | **未覆盖** | **P1** | 与 ECharts（图表）、deck.gl（通用图层）形成三选一；建议 8~10 章 |
| Turf.js | JS 空间分析 | turfjs.org / Turfjs/turf | MIT | 约 11k star；最近提交 2026-11；npm 7.4.0 | 浏览器/Node 端 GeoJSON 空间分析标准库 | **仅提及**：Cesium 第 12 章测量、OpenLayers 第 18 章、GeoLibre 多处，全仓库 29 处 | **P1** | 前端版的 JTS/Shapely；站点已有 JTS/Shapely/NTS 三条几何教程，缺前端 JS 这一条；建议 8~10 章专题 |
| ECharts 地理可视化 | 通用可视化库（geo/map 组件） | echarts.apache.org / apache/echarts | Apache-2.0 | 约 68k star；npm 6.1.0（Apache 顶级项目） | 国内大屏/报表事实标准图表库，geo/map 系列承载地图可视化 | **间接覆盖**：demos/vue3-map-dashboard（5 章）用 ECharts + 天地图做人员大屏；无系统地理可视化教学 | **P1** | 站点读者的大屏刚需；建议 6~8 章专题（不按引擎教程写） |
| maptalks | 国产 2D/3D WebGL 引擎 | maptalks.org / maptalks/maptalks.js | BSD-3-Clause | 约 4.5k star；最近提交 2026-10；npm 1.13.0 | 上海团队开源的二三维一体 WebGL 地图引擎，强项是自定义 EPSG 投影与插件体系 | **未覆盖** | **P2** | 特色与 OpenLayers 重叠但更轻；中文教程少、社区小于 Leaflet，适合专题 |
| JSTS | JS 拓扑运算 | github.com/bjornharrtell/jsts | EDL-1.0 / EPL-1.0 | 约 1.6k star；npm 2.12.1 | JTS 的 JavaScript 移植，前端 buffer/overlay/拓扑谓词 | **未覆盖**（0 处） | **P2** | 与在建 JTS 教程同 API 血统；可做 6~8 章"JS 版 JTS"专题 |
| proj4js | 前端投影转换 | proj4js.org / proj4js/proj4js | MIT | 约 2.2k star；npm 2.22.0 | 前端坐标转换事实标准，OpenLayers/Leaflet 自定义投影的底层依赖 | **未覆盖**（"proj4js" 0 处；113 处 "proj4" 均为其他语境） | **P2** | 建议并入 Leaflet/MapLibre 教程章节，或 4~6 章小专题 |
| geotiff.js | 浏览器栅格 | geotiffjs.github.io / geotiffjs/geotiff.js | MIT | 约 1.1k star；npm 3.0.5 | 浏览器端读取 GeoTIFF/COG | **未覆盖**（"geotiff.js" 0 处；259 处 "geotiff" 均为数据格式语境） | **P2** | 与 GeoLibre 的 COG 能力、deck.gl 的 COGLayer 联动；4~6 章 |
| ol-cesium | 2D/3D 联动 | openlayers.org/ol-cesium | BSD-2-Clause | 约 1.2k star；最近提交"上周一"；npm 2.17.0 | OpenLayers 与 Cesium 的官方 2D/3D 联动方案 | **仅提及** 1 次（opengis-skills） | **P2** | 站点已有 OL 与 Cesium 两套教程，缺"缝合层"；6~8 章 |
| PMTiles | 单文件瓦片分发 | docs.protomaps.com/pmtiles | BSD-3-Clause | 约 3.1k star；最近提交 2026-09；npm 4.5.0 | 无服务器单文件瓦片格式及工具链 | **仅提及**：GeoLibre 文档 114 处（支持 PMTiles），无系统讲解 | **P2** | 与 MapLibre/deck.gl 离线部署互补；4~6 章 |
| Maputnik | 样式编辑器 | maputnik.github.io / maplibre/maputnik | MIT | 约 2.7k star | MapLibre/Mapbox 样式规范的可视化编辑器 | **未覆盖** | **P2** | 并入 MapLibre 教程一章即可 |
| flutter_map | Flutter 移动地图 | docs.fleaflet.dev / fleaflet/flutter_map | BSD-3-Clause | 约 3k star；最近提交 2026-11 | Flutter 生态最常用的开源地图库 | **未覆盖** | **P2** | 站点缺移动端链路；国内移动 GIS 多用商用 SDK，受众有限 |
| MapLibre Native | 移动端渲染引擎 | maplibre.org/maplibre-native | BSD-2-Clause | 约 2.3k star | Android/iOS 矢量瓦片渲染引擎（Mapbox Native 的开源替代） | **未覆盖** | **P2** | 与 MapLibre GL JS 同生态，可合并在同一系列讲 |
| Mapsforge | Android 离线矢量地图 | mapsforge/mapsforge | LGPL-3.0 | 约 1.4k star；最近提交 2026-10 | Android 端 OSM 离线矢量渲染库 | **未覆盖** | **P2** | Java/Android 专用，国内受众小，只适合单篇专题 |
| GeoStyler | 样式转换/编辑 | geostyler.org / geostyler/geostyler | BSD-2-Clause | 约 346 star | SLD 与 Mapbox Style 的互转与可视化编辑 | **未覆盖** | **P2** | 与 GeoServer SLD 教程相关但小众；可做单篇工具文 |
| Kepler.gl | 地理数据分析工具 | kepler.gl / keplergl/kepler.gl | MIT | 约 12k star；最近提交"昨天"；npm latest 仍是 3.3.0-alpha.20 | Uber 开源的地理数据可视化分析工具（工具，非开发库） | **仅提及**（4 处） | 不做系列 | 适合 1 篇导读/案例，不值得 10 章教程 |

> 覆盖状态口径：**独立教程**=导航与 gis/tutorial 下自成系列（本次候选均不属于）；**间接覆盖**=现有教程把该库当底层讲但无自身教学；**仅提及**=正文出现但无系列；**未覆盖**=全仓库 0 处。仓库现有 21 套教程 + 在建 JTS（24 章正文"撰写中"），前端只有 OpenLayers 18 章与 CesiumJS 18 章两套，外加 demos 的 Vue3+OpenLayers（8 章）、Vue3 大屏（5 章）等演示教程。

## 详细说明

### P0

**Leaflet**：全仓库 115 处提及却没有一套教程，是最大的"看着熟、没系统学过"缺口。它是 2D Web 地图的入门事实标准（约 46k star，1.9.4 稳定版仍在维护），中文教材、外包项目、政务系统里出现频率极高；站点现有 OpenLayers 教程偏重、Cesium 偏三维，中间"40KB 轻量地图"这一层空着。demos/map-360-demo 虽然用了 Leaflet，但那是 Photo-Sphere-Viewer 的插件配置，读者学完不会 Leaflet 本身。建议 12~14 章：地图容器与坐标系统 → 瓦片图层与国内底图（天地图/高德合规接入、GCJ-02 偏移处理）→ 矢量图层与 GeoJSON → 标记/弹窗/工具提示 → 事件与交互 → 控件与插件生态（聚合 markercluster、绘制 leaflet-draw、热力图）→ WMS/WFS 与 GeoServer 对接 → 移动端与性能 → 与 Vue/React 集成 → 实战（点位管理/专题图）。

**MapLibre GL JS**：站点对它的覆盖"深但不显"——GeoLibre 教程整本以 MapLibre 为默认渲染引擎（343 处提及），可始终是讲 GeoLibre 的产品行为，没有讲 MapLibre 自己的 style spec、source/layer 模型、表达式、矢量瓦片协议。Mapbox GL JS v2 起改为专有许可，MapLibre 成为开源矢量瓦片前端的唯一主流选择，中文读者做"私有化矢量瓦片+自定义样式"时绕不开。建议 12~14 章：架构与渲染管线 → style spec 详解 → 数据源（矢量瓦片/MVT/PMTiles/GeoJSON）→ 图层类型与表达式 → 3D 地形与 fill-extrusion → 交互与控件 → 插件生态 → 与 GeoServer/矢量切片服务对接 → 离线部署与 Maputnik 样式制作 → 性能调优 → 实战。

**deck.gl**：15k star、MIT、vis.gl 生态的核心，国内"城市大数据/交通大屏/三维可视化"项目的高频选型。站点只在 GeoLibre 的 COG、点云、性能章节里顺带出现（82 处），没有独立教学。它与 Cesium 教程不冲突：Cesium 解决"地球与地学场景"，deck.gl 解决"海量数据图层"（散点、弧线、六边形聚合、轨迹、点云）。建议 10~12 章：架构与图层生命周期 → 常用图层（Scatterplot/Arc/Path/Polygon/Hexagon/Icon/Text）→ 数据源与 loaders.gl → TileLayer/MVTLayer 与矢量瓦片 → COG 与点云 → 与 MapLibre/Mapbox 集成 → 拾取与交互 → 性能与 WebGL 调优 → 与 Kepler.gl 的关系 → 实战。

### P1

**Mars3D**：国内三维 GIS 项目大量使用它而不是裸 Cesium——它把 Cesium 包成"地图+图层+标绘+漫游+空间分析+小部件"的业务框架，官网中文文档完整（mars3d.cn），npm 3.12.1、2026-11 仍有提交。站点已有 18 章 CesiumJS 教程，Mars3D 正好承接"学完 Cesium 后怎么做业务系统"的需求。建议 10~12 章：架构与 Cesium 关系 → 地图/场景配置 → 图层体系（矢量/瓦片/三维模型/地形）→ 标绘与编辑 → 漫游与飞行 → 空间分析与量算 → 小部件与 UI → 与 Vue 工程化集成 → 性能与部署。

**AntV L7**：蚂蚁开源（MIT，4.1k star，2026-10 活跃），中文文档与新特性更新跟得上，适合做"大数据量空间可视化"——热力图、网格聚合、飞线、动态轨迹。与 ECharts、deck.gl 有功能重叠但定位不同：ECharts 是图表优先，deck.gl 是通用 GPU 图层，L7 更偏"开箱即用的地理可视化场景"。建议 8~10 章，或作为"地理可视化三选一"横向对比专题的一部分。

**Turf.js**：11k star、2026-11 仍在提交，是前端空间分析的默认答案；站点在 Cesium 第 12 章测量和 OpenLayers 第 18 章里用过它，但没有系统讲 GeoJSON 运算。它与 JTS、Shapely、NTS 教程构成"几何引擎四件套"的最后一块（且是唯一跑在浏览器里的）。建议 8~10 章专题：GeoJSON 数据模型 → 度量与单位 → 空间关系谓词 → 几何变换与 buffer → 叠加分析 → 插值与等值线 → 与 OL/Leaflet/MapLibre 集成 → 性能（Web Worker + 简化）。

**ECharts 地理可视化**：68k star 的 Apache 顶级项目，中文大屏绕不开；站点 demos/vue3-map-dashboard 已经用 ECharts + 天地图做人员追踪大屏，说明站长本身认可这个技术栈，但那是"项目实战"不是"地理可视化教学"。建议 6~8 章专题而非系列：geo/map 组件与坐标系 → 地图数据（GeoJSON/注册地图）→ 地图系列（scatter/effectScatter/lines/heatmap）→ 飞线与迁徙图 → 地图下钻与联动 → 与天地图/高德底图叠加 → 3D 地球（echarts-gl）→ 大屏性能。

### P2 说明（简要）

- **maptalks**（4.5k，活跃，BSD-3）：国产二三维一体引擎，自定义投影和插件体系是特色，但中文生态被 Leaflet/MapLibre/L7 挤压，做 4~6 章专题即可。
- **JSTS**（1.6k）：JTS 的 JS 移植，前端做 buffer/union/overlay 的成熟方案；和在建 JTS 教程同源，适合 6~8 章专题。
- **proj4js / geotiff.js**：都是"一个能力"的库，不建议单独成套，按章节并入 Leaflet/MapLibre/deck.gl 教程更合适（proj4js 4~6 章、geotiff.js 4~6 章也可以）。
- **ol-cesium**（1.2k，1 周内仍有提交）：站点已有 OL 和 Cesium 两套教程，缺 2D/3D 联动这一层；6~8 章足够。
- **PMTiles**（3.1k）：无服务器瓦片分发的新标准，GeoLibre 已支持，做 MapLibre 教程时顺带专章即可。
- **Maputnik / GeoStyler**：样式工具，分别并入 MapLibre 教程、GeoServer SLD 相关文章。
- **flutter_map / MapLibre Native / Mapsforge**：移动端整体缺，但国内移动 GIS 以高德/百度 SDK 为主，开源移动地图教程的读者基数小，只建议单篇或合并专题。

## 已衰落 / 不建议清单

| 项目 | 原因 |
|---|---|
| Mapbox GL JS v2+ | v2 起改为专有许可、需付费 token，不再是开源项目；仅作为 MapLibre 教程里的对照与迁移说明 |
| XbsjEarth / EarthSDK（cesiumlab/XbsjEarthUI，733 star，MIT） | 最后提交 2022-12，已停更；不建议做教程 |
| DC-SDK（dvgis/dc-sdk，938 star，Apache-2.0） | 最后提交 2026-06，近半年无更新、社区小；可在 Mars3D 教程对比章节提一句，不单独立项 |
| OsmAnd（6.1k）/ Organic Maps（16k） | 是 GPL 导航应用而非开发库，教程价值低、编译成本高，不做系列；可在移动端生态文章提一句 |
| react-leaflet / react-map-gl / vue-maplibre 等封装 | 框架封装层，不单独立项；作为 Leaflet/MapLibre 教程的"前端框架集成"章节（注意 demos 已有 Vue3+OpenLayers 演示，别重复） |
| three.js（GIS 场景） | 已被站点 3D 系列（Photo-Sphere-Viewer、Astral3D、Elements 等）间接覆盖，不重复立项；若要补，做"three.js + GIS 图层"单篇专题 |
| 高德/百度/腾讯 JS API、天地图 API、Google Maps/Earth Engine、ArcGIS Maps SDK、SuperMap iClient | 商业或纯在线服务、需密钥/配额，不符合"开源教程"定位；只在 Leaflet/MapLibre 教程里讲"国内底图合规接入与偏移纠偏" |
| 纯插件（Leaflet.markercluster、leaflet.heat、leaflet-draw、supercluster、rbush、flatbush） | 单文件/算法小库，作为教程章节内容，不占系列名额 |

## 其他可提一句

- **loaders.gl**（857 star，MIT）：deck.gl 的数据加载底座，随 deck.gl 教程讲。
- **mapbox-gl-style-spec / @maplibre/maplibre-gl-style-spec**：MapLibre 样式规范的 npm 包，GeoLibre 状态层就用它做表达式求值，可作 MapLibre 教程的"工程化"章节素材。
- **Leaflet 国内生态**：天地图瓦片插件、GCJ-02 纠偏、坐标系偏移是所有国内 WebGIS 教程的必答题，建议在 Leaflet 与 MapLibre 两套教程里统一口径。
- **Kepler.gl**：12k star 且仍在提交，但定位是分析工具（3.x 仍 alpha），建议 1 篇导读或案例，不做系列。

## 越界发现（供 lead 协调，不在本笔记结论内）

1. **服务端矢量切片/瓦片服务**（Martin、pg_tileserv、TileServer GL）：属服务端范围，但 MapLibre/deck.gl 教程会依赖它；若服务端队员未覆盖，建议协调补一篇基础文。
2. **国内底图合规与 GCJ-02 偏移**：这是横跨 Leaflet/MapLibre/OL/Cesium 多条教程的横向主题（GeoLibre 第 2 章只有半页说明），建议在 gis/basic 下统一成一篇，避免每套教程重复写。
3. **移动端地图**（MapLibre Native/flutter_map/Mapsforge）：站点目前只有 .NET 的 Mapsui，移动端开源地图链路整体缺失；但受众与站点主线偏离，只建议观察。

## 不确定点

- **OSGeo 身份**：本次抓取 osgeo.org 项目页返回空内容，未能逐项核实。已确认的事实是：MapLibre 于 2020-12 由 OSGeo 邮件列表社区成员发起、作为 Mapbox GL JS v1 的 fork；Leaflet/MapLibre 是否为 OSGeo 官方社区项目，建议站长按 osgeo.org/projects 人工复核后再写进教程引言。
- **star 数为 shields.io 四舍五入值**（"46k""12k"），不是精确值；Mars3D 的真实中文热度远高于 GitHub 1.1k star（Gitee、官网下载、项目使用量未计入）。
- **kepler.gl 正式版本**：npm latest 为 3.3.0-alpha.20，2.x 是否仍为稳定线未核实，影响"是否值得做教程"的判断。
- **DC-SDK** 是否已实质停止维护（2026-06 后无提交）需看官网公告，目前按"低活跃、不建议单独立项"处理。
- **Mars3D license**：npm 标注 Apache-2.0，GitHub shields 无法识别（可能因仓库根目录 license 文件命名），引用前需官网确认。
- **flutter_map** 版本号未取到（非 npm 生态），只确认了仓库活跃度（2026-11 有提交）。

---

### 附：本次用到的证据清单

- star / last-commit：`https://img.shields.io/github/stars/<owner>/<repo>.json`、`https://img.shields.io/github/last-commit/<owner>/<repo>.json`（2026-11-11 抓取）。
- 版本 / license：`https://registry.npmjs.org/<pkg>/latest`（leaflet 1.9.4、maplibre-gl 6.17.0、@deck.gl/core 9.4.1、@antv/l7 2.29.1、maptalks 1.13.0、mars3d 3.12.1、pmtiles 4.5.0、@turf/turf 7.4.0、jsts 2.12.1、proj4 2.22.0、geotiff 3.0.5、@loaders.gl/core 4.5.4、ol-cesium 2.17.0、echarts 6.1.0、mapbox-gl 3.34.2）。
- 仓库覆盖：对 1595 个文本文件做关键词计数（leaflet 115 处、maplibre 343、mapbox 467、deck.gl 82、turf.js 29、pmtiles 114、echarts 47；maptalks/antv/jsts/proj4js/geotiff.js/mars3d/dc-sdk/xbsj/flutter_map/osmand/organic maps/mapsforge/maputnik/geostyler 均为 0），并逐文件核对上下文。
