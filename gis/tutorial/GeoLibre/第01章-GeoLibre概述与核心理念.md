---
layout: default
title: 第01章 - GeoLibre 概述与核心理念
---

# 第01章 - GeoLibre 概述与核心理念

本章回答四个问题：GeoLibre 到底是什么、它为什么这样设计、它现在能做什么、以及它适合谁。读完本章，你应当能判断一个具体任务该不该交给 GeoLibre，并知道后续章节分别深入哪一块能力。

本教程基于 GeoLibre 3.4（仓库 `package.json` 中 `version` 为 `3.4.0`），所有功能名、菜单路径与参数名以该版本仓库中的实现与文档为准。

## 1.1 定位：一个能在任何宿主里打开的 GIS 工作区

### 1.1.1 一句话定义

GeoLibre 的官方定义是：**一个免费开源、轻量、云原生的 GIS 平台，用于可视化、浏览与分析地理空间数据**。它同时运行在网页浏览器、桌面、移动端与 Jupyter Notebook 中，并且默认让数据留在本地。

这句话里有三个关键词，对应三种不同的取舍：

| 关键词 | 含义 | 与常见工具的区别 |
| --- | --- | --- |
| 免费开源（free and open-source） | MIT 许可，源码可读、可改、可再分发 | QGIS 也是开源（GPL），ArcGIS Pro / CARTO / Felt 是商业产品 |
| 轻量（lightweight） | 没有安装包也能用网页版；桌面版是 Tauri 外壳而不是 Electron 巨无霸 | 传统桌面 GIS 需要完整安装与较多系统资源 |
| 云原生（cloud-native） | 优先支持 COG、GeoParquet、PMTiles、Zarr、STAC 这类“放在对象存储里、按 HTTP Range 读取”的格式 | 传统 GIS 以本地文件为中心，云端格式往往要靠插件或服务端 |

“云原生”在这里不等于“必须联网”。它指的是**数据组织方式**：GeoLibre 可以直接对远程对象存储里的云优化文件发起分段读取，而不必先把整份数据下载下来；同一套能力在断网时依然可以处理本地文件。

### 1.1.2 它不是什么

明确边界比罗列功能更有用。根据官方文档的自我描述，GeoLibre 不是：

1. **不是 QGIS 的替代品。** 官方在对比文档里用“专业相机与手机相机”作类比：QGIS 成熟、强大、可扩展；GeoLibre 追求可及性、跨平台与“打开就能用”。两者服务不同的人与不同的时刻。
2. **不是在线 SaaS。** 网页版是托管在 GitHub Pages 上的静态站点，没有服务器账号，数据在浏览器会话内本地处理。只有当你主动添加远程 URL 或主动分享工程时，数据才会离开浏览器。
3. **不是纯地图查看器。** 它带有 1,000+ 地理处理工具、空间 SQL、属性表编辑、符号化、打印布局与故事地图，属于“做数据工作”的工具，而不是只用来“看地球”的工具。
4. **不是企业级地理数据库管理系统。** 版本化编辑、复制、企业地理数据库运维不在它的范围内，这类需求仍应交给 ArcGIS 体系或 PostGIS 工程实践。

### 1.1.3 四类工具的定位对比

| 类别 | 代表 | 强项 | 典型限制 | GeoLibre 的位置 |
| --- | --- | --- | --- | --- |
| 桌面 GIS | QGIS、ArcGIS Pro | 格式覆盖最广、制图与标签最深、插件/工具箱最全 | 需要安装，重分析任务绑定单机 | 用同一套工程文件承担“轻量分析 + 发布 + 嵌入” |
| 在线 GIS 平台 | ArcGIS Online、CARTO、Felt | 托管、协作、组织权限、仓库内计算 | 数据在厂商云，依赖订阅与网络 | 数据留在本地，工程可导出为单文件 HTML |
| 可视化/探索工具 | kepler.gl | 大规模点与轨迹的快速可视化 | 分析工具箱与制图产出较弱 | 兼顾可视化与地理处理、SQL、制图 |
| 虚拟地球 | Google Earth / Earth Pro | 影像、历史影像、街景、真实感三维 | 不是 GIS：无属性表、无投影、无分析工具箱 | 内置 Cesium 地球，并可直接读 KML/KMZ 符号与结构 |

## 1.2 设计哲学：本地优先、云原生、跨平台

### 1.2.1 本地优先（Local-first）

GeoLibre 把“数据默认留在本地”当作产品承诺，而不是一句营销话。具体表现为：

- 网页版把矢量、栅格、SQL 计算全部放在浏览器内完成；托管的公开站点只统计页面访问量，分析代码看不到你加载的数据。
- 分享工程时上传的是**工程文件**（图层引用、样式、视图状态），不是你磁盘上的数据文件；本地文件图层会在分享前被明确警告。
- 需要完全私有化时，可以把同一份 Web 构建部署到自己的服务器，与数据同源放置。
- 桌面版提供本地文件对话框、MBTiles、本地栅格读取、工程保存/打开等浏览器做不到的能力。

> **提示**
> “本地优先”不等于“离线优先”。GeoLibre 的底图、云原生数据、在线目录都需要网络；它的意思是**计算与数据归属在本地**，而不是所有资源都已缓存。离线使用请参考桌面版、PWA 与“Download Offline Area”工具。

### 1.2.2 云原生（Cloud-native）

GeoLibre 的云原生性体现在数据格式与访问方式上，而不是“提供一个云服务”：

| 能力 | 具体表现 |
| --- | --- |
| 云优化栅格 | COG / GeoTIFF、Cloud-Optimized NetCDF/HDF（kerchunk 引用）、MBTiles |
| 云原生矢量 | GeoParquet、FlatGeobuf、PMTiles，通过 HTTP Range 流式读取 |
| 多维数据 | Zarr（远程 store、Icechunk 仓库、本地目录），带变量与维度选择器 |
| 目录协议 | STAC（静态目录与 STAC API）、OGC API - Features/Tiles、CSW |
| 对象存储 | 公开的 S3/GCS/Azure URL 在 SQL 中透明重写；私有 S3 桶可用凭据浏览 |
| 数据库 | PostGIS 浏览、SQL Server/Azure SQL（桌面）、DuckDB、Apache Iceberg、浏览器内 PGlite/PostGIS |

这套组合的意义是：**你不需要先建一个 GIS 服务器，才能用云上的数据。** 一个放在对象存储里的 GeoParquet 或 COG，可以直接被浏览器按需读取；需要服务端时，也支持 WMS/WFS/WMTS、ArcGIS 服务与自托管目录。

### 1.2.3 跨平台（One codebase, many hosts）

GeoLibre 用同一套 React 代码库构建多种宿主：

| 宿主 | 构建方式 | 典型用途 | 关键差异 |
| --- | --- | --- | --- |
| Web | Vite 静态构建，部署在 GitHub Pages 或任意静态服务器 | 分享、嵌入、临时分析 | 无本地文件对话框、无本地 MBTiles/本地栅格读取 |
| 桌面 | Tauri v2（Windows/macOS/Linux） | 日常生产、访问本地文件、Python sidecar | 完整能力，含本地工程保存/打开 |
| Android | Tauri v2 mobile，Google Play / APK | 外业采集、现场查看 | 隐藏依赖本地进程的工具（Conversion、AI Segmentation、sidecar Raster、PostgreSQL/SQL Server） |
| iOS | Tauri v2 mobile，App Store | iPhone/iPad 查看与轻量工作 | 与 Android 相同的裁剪，另外 App Store 构建不含 Earth Engine 登录 |
| Jupyter | Python 包 `geolibre`（anywidget） | Notebook 内嵌完整应用、双向同步 | 由 Python 驱动地图，工程可保存为可移植工程文件 |
| R | R 包 `geolibre`（HTML widget） | RStudio / Quarto / R Markdown / Shiny | 以 HTML widget 形式嵌入，交换可移植工程 |

同一份 `.geolibre` 工程可以在这些宿主之间移动，是这套设计最实际的好处：在桌面做数据准备，在网页分享结果，在 Notebook 里用 Python 复现，在手机上查看现场。

### 1.2.4 可审计、可撤销的自动化

GeoLibre 的 AI 能力被刻意设计成“通过应用执行操作”，而不是“让模型直接改文件”：

- AI 助手把自然语言请求转换成 GeoLibre 操作（空间 SQL、符号化、增删数据、地图控制），这些操作走应用自己的命令通道，因此**可审计、可撤销**。
- 每次地理处理都会进入 Processing History，可一键重跑并复制等价 Python 代码。
- MCP 服务器（`geolibre-mcp`）以无头方式编写 `.geolibre` 工程，读写被限制在 `--root` 或 `GEOLIBRE_MCP_ROOTS` 指定的根目录内。
- 部署侧另有 capability 模型，可按 `project:edit`、`data:add`、`processing:run`、`export:data`、`plugins:install`、`settings:manage` 六项能力独立收紧界面。

> **注意**
> AI 助手默认关闭，直到你配置了 Provider 与凭据。它不是一个“云端代做 GIS”的服务：模型只产出操作意图，真正的执行仍在你的浏览器/桌面进程里。

### 1.2.5 各宿主共享的行为契约

跨平台最容易“看起来一样、用起来不一样”。GeoLibre 用一份行为契约来约束差异，判断一个功能在哪端可用时，可以按这张表核对：

| 行为 | Web | 桌面 | 移动 | Jupyter/R |
| --- | --- | --- | --- | --- |
| 同一套工作区与工程格式 | 是 | 是 | 是 | 是 |
| 浏览器会话内处理数据 | 是 | 是 | 是 | 是 |
| 本地文件对话框 | 否 | 是 | 系统选择器 | 宿主决定 |
| 本地 MBTiles / 本地栅格读取 | 否 | 是 | 受限 | 否 |
| 工程保存到本地路径 | 下载/文件选择器 | 是 | 受限 | 由 Python/R 写入 |
| Python sidecar 工具 | 仅同源代理部署 | 是 | 否 | 否 |
| 触摸优先布局 | 响应式 | 窗口尺寸 | 是 | 宿主页面 |
| 插件安装 | 是 | 是 | 受限 | 视构建而定 |

看表的规律很清楚：**越靠近“本地文件系统与本地进程”，桌面越是唯一完整答案；越靠近“分享与嵌入”，Web 越是首选。**

## 1.3 项目脉络：从 v0.1 到 v3.4

### 1.3.1 关键里程碑

GeoLibre 的 `docs/roadmap.md` 按版本记录了全部发布内容。下面抽取对理解产品形态最有帮助的节点：

| 版本 | 主题 | 代表性能力 |
| --- | --- | --- |
| v0.1 | 地图查看器与 GeoJSON | Tauri + React + MapLibre 外壳、图层/样式面板、基础属性表、插件接口 |
| v0.2 | 工程持久化 | `.geolibre.json` 保存/打开、最近工程、属性表高亮 |
| v0.3 | 云原生格式 | GeoParquet（DuckDB-WASM）、FlatGeobuf、PMTiles、COG/GeoTIFF |
| v0.4 | DuckDB Spatial | `INSTALL spatial` / `LOAD spatial`，Shapefile、KML/KMZ、GeoPackage 等导入路径 |
| v0.9 | 数据集成与菜单重组 | SQL 工作区、Planetary Computer、Earth Engine、Time Slider、Web Services、Conversion/Vector/Raster 菜单、Docker |
| v1.0 | 处理流水线与插件体系 | GDAL/Rasterio/GeoPandas 流水线、外部插件分发、插件市场 MVP、Python 包、跨平台安装包 |
| v1.3 | 分析深度与协作 | 空间统计、网络分析、Apache Sedona SQL 引擎、实时协作 MVP、故事地图、AI 助手、Python 控制台、Android |
| v1.5 | 浏览器内 Whitebox | 1,000+ 工具改为 WebAssembly 在浏览器执行、Dashboard 面板、UI Profiles |
| v1.8 | 产出与标注 | 相机漫游录制、故事地图、单文件 HTML 导出、地图注记 |
| v2.0 | 三维地球与符号交换 | CesiumJS 三维地球、行星底图、SLD/QML/Mapbox GL 样式互通、可回写源图层的编辑 |
| v2.2 | 制图与表达式体系 | 规则渲染器、Style Manager、Expression Builder、虚拟字段、打印图集（Atlas） |
| v2.5 | 工程迁移与自托管 | QGIS/ArcGIS Pro 工程导入、DGGS 插件、自托管共享/协作服务、iOS |
| v2.6 | 深链与 MCP | data/style 深链、`geolibre-mcp`、COG 驱动地形、中国区域底图、自有设计系统 |
| v2.7 | 可视化建模与外部接入 | Model Builder、Chrome 扩展、STAC 全资产类型、框选/多边形选择 |
| v2.9 | 无令牌三维地球 | Cesium 地球不再强制 Ion token、capability 模型、无密钥全球 DEM 下载 |
| v3.0 | Cesium 成为一等引擎 | 主图可切换 Cesium、可编辑 SVG 打印布局、ArcGIS Feature Service 回写 |
| v3.1 | 四引擎齐全 | Mapbox GL JS 与 ArcGIS Maps SDK 加入、God's Eye View、OAuth 分享、语音 AI 助手 |
| v3.2 | 点云与凭据安全 | 点云标注插件、私有 S3、系统凭据库（Keychain/Credential Manager/Secret Service） |
| v3.3 | 视线与坐标体系 | 视线分析、MGRS/USNG/任意 EPSG 坐标、SQL Server、工程快照对比与单图层恢复 |
| v3.4 | 影像分析与星载激光 | OBIA 工作台与 eCognition 规则集导入、ICESat-2/GEDI、逐向导航、ArcGIS 服务完整编辑 |

> **提示**
> 版本号不是“功能开关”。GeoLibre 的工程文件带 `version` 字段（当前写入 `0.2.0`），但应用版本与工程格式版本是两条线；用 3.4 打开早期工程通常无需迁移。

### 1.3.2 三条主线

回看这条版本线，可以把它归纳为三条同时推进的主线：

| 主线 | 起点 | 现在的形态 |
| --- | --- | --- |
| 数据入口 | GeoJSON → DuckDB → 云原生格式 | 文件、URL、OGC/ArcGIS 服务、STAC、数据库、3D/点云、CAD、Excel、File GDB 等统一进 Add Data 与 Browser 面板 |
| 分析引擎 | 本地算法 → Turf.js → Whitebox/GeoPandas/rasterio | 浏览器 WASM 工具箱 + 客户端矢量/栅格引擎 + 可选 Python sidecar + 三种 SQL 引擎 + Model Builder |
| 产出与协作 | 保存工程 → 分享 → 打印 | 打印布局/图集、故事地图、Dashboard、单文件 HTML、嵌入 API、实时协作、自托管服务端 |

理解这三条主线，就能理解 GeoLibre 的功能为什么这样分布：**入口尽量的宽，分析尽量留在客户端，产出尽量做成可带走的文件。**

### 1.3.3 本教程的版本基准

| 项目 | 值 |
| --- | --- |
| 应用版本 | 3.4.0 |
| 仓库 | `opengeos/GeoLibre`（GitHub） |
| 作者 | Qiusheng Wu（giswqs） |
| 许可证 | MIT |
| 官网 | <https://geolibre.app> |
| 网页版 | <https://web.geolibre.app> |
| 文档版本基准 | 仓库 `main` 分支 `docs/` |

## 1.4 核心能力全景

### 1.4.1 1,000+ 浏览器内地理处理工具

**Processing → Whitebox Toolbox** 打开的工具箱包含 1,000+ 个地理处理工具，通过 WebAssembly 运行时在浏览器内执行，具备原生栅格与矢量 I/O。它们来自 Whitebox Next Gen 套件加上 GeoLibre 自有的 WASM 工具，按类别组织：

| 类别 | 工具数 | 典型能力 |
| --- | --- | --- |
| Vector | 313 | 叠加、缓冲、连接、清理、拓扑、概化 |
| Raster | 256 | 栅格代数、滤波、重分类、分区与邻域统计 |
| Remote sensing | 154 | 光谱指数、波段运算、分类、变化检测 |
| Hydrology | 100 | 流向/汇流累积、流域、河网、洼地填充 |
| Terrain | 99 | 坡度、坡向、山体阴影、曲率、粗糙度、视域 |
| LiDAR | 67 | 点云滤波、地面分类、DEM/DSM 生成 |
| Conversion | 49 | 转为 GeoParquet、PMTiles、COG 等云原生格式 |
| Network | 26 | 连通性、成本距离、路径分析 |
| Projection | 4 | 栅格与矢量重投影 |

合计 1,068 项（按上表逐项相加）。此外，**Processing → GeoLibre Toolbox** 下还有矢量工具（Turf.js 客户端、可选 GeoPandas/Pyodide 或 sidecar 引擎）、栅格工具（rasterio sidecar，带客户端回退）、Conversion、Spatial Statistics 与 Network 工具。这两套工具箱在同一个 Processing 菜单里，因此部分类别名会出现两次，这是正常现象。

> **注意**
> “浏览器内执行”意味着数据不上传，但也意味着受浏览器内存与 WebAssembly 限制。多 GB 的本地处理任务仍应交给桌面 GIS；GeoLibre 的定位是“把大部分常见分析放到手边”，不是“无限算力”。

### 1.4.2 四种渲染引擎

同一个工程可以切换四种渲染引擎（**View → Rendering engine**），并且可以在分屏中混用：

| 引擎 | 角色 | 强项 | 凭据 |
| --- | --- | --- | --- |
| MapLibre GL JS | 默认二维引擎 | 插件支持最广、矢量瓦片与样式表达最成熟 | 不需要 |
| Mapbox GL JS | 可选二维引擎 | Mapbox 样式、全球视图、地形 | 需要 Mapbox access token |
| CesiumJS | 可选三维地球 | 原生地球、地形、3D Tiles、CZML、Ion、I3S | 无 token 可用；token 解锁 World Terrain 与 Ion 影像 |
| ArcGIS Maps SDK for JavaScript | 可选二维/三维 | 原生 ArcGIS 服务、三维场景、投影（Spilhaus 等） | 无凭据可用；API key 解锁 Esri 底图样式 |

引擎选择随工程保存；切换时相机、图层、分组、可见性、透明度与受支持的样式会保留。菜单、工具与插件会按当前引擎的能力进行门控。

### 1.4.3 SQL 工作区与三种引擎

SQL 工作区（**Processing → SQL Workspace**）支持三种引擎：

| 引擎 | 运行位置 | 适用场景 |
| --- | --- | --- |
| DuckDB Spatial | 浏览器（DuckDB-WASM） | 主力引擎：Parquet/GeoParquet、本地文件、远程 URL、空间函数 |
| PGlite / PostGIS | 浏览器（PGlite） | 想用 PostGIS 语法与函数、验证 PostGIS 行为 |
| Apache Sedona | 浏览器（CereusDB）或 sidecar | 大数据风格的空间 SQL、Sedona 函数 |

裸 URL 会自动包裹成匹配的读取器并发起 HTTP Range 请求；结果可以加回地图，也可以导出为 CSV 或 GeoParquet。SQL 工作区可停靠为地图旁的调整大小面板，并带表名、列名与关键字自动补全。

### 1.4.4 AI 助手、MCP 与智能体技能

| 入口 | 做什么 | 边界 |
| --- | --- | --- |
| AI Assistant（面板） | 自然语言 → 空间 SQL、符号化、增删图层、地图控制 | 默认关闭；需配置 Provider；操作可撤销 |
| Python Console | 在应用内用 Python 脚本驱动应用 | 由 Pyodide 或本地 Python 执行 |
| `geolibre-mcp` | 无头编写/修改 `.geolibre` 工程，供 AI 客户端调用 | stdio；读写限定在允许根目录 |
| `skills/geolibre/` | 教外部智能体“什么时候用 MCP、Python API 还是手写工程 JSON” | 随仓库发布，有测试守卫 |

Provider 支持 Google Gemini、Anthropic、OpenAI、OpenRouter、Vercel AI Gateway、Amazon Bedrock、本地 Ollama，以及任意 OpenAI 兼容端点。凭据保存在本机（桌面进系统凭据库），不写进共享工程文件。

### 1.4.5 插件系统与插件市场

- 内置插件覆盖图层控制、底图、MapLibre 组件、卷帘、街景、时间滑块、Overture Maps、LiDAR、GeoAgent、GeoEditor、大气效果等。
- 外部插件通过 `plugin.json` 清单从 zip、目录或市场安装；市场安装与更新会校验发布的 bundle hash，并遵守 registry blocklist。
- 插件可以注册右侧面板、工具栏菜单与浮动面板，可以声明支持的渲染引擎，也可以向 AI 助手注册工具与提示词。

插件 API 的细节留给[第21章 插件系统与插件开发](https://znlgis.github.io/gis/tutorial/GeoLibre/第21章-插件系统与插件开发/)。

### 1.4.6 工程格式与产出

一个 `.geolibre` 工程文件装下：地图视图、底图、每个图层的源与样式、地图偏好、插件状态、图例、打印布局、故事地图、Dashboard 部件、书签、交互状态与元数据。工程是**引用式**的：它保存图层来源，而不是把远程数据复制进文件。

产出渠道包括：

- 单文件离线 HTML（**Project → Export → Export as HTML...**），可离线打开、无需服务器。
- 打印布局导出 PNG/PDF/可编辑 SVG，支持图集（Atlas / map series）。
- 故事地图与故事地图的独立 HTML 导出。
- 分享链接（`share.geolibre.app` 或自托管服务）。
- 样式与图层文件：SLD / QML / Mapbox GL JSON / GeoLibre URL style、图层样式文件、图层列表文件。

### 1.4.7 数据入口矩阵

| 入口类别 | 代表格式/协议 |
| --- | --- |
| 本地矢量 | GeoJSON、GeoParquet、GeoPackage、Shapefile、FlatGeobuf、KML/KMZ、GML、CSV、GPX、OSM PBF、DXF/DWG、Excel、File GDB（桌面） |
| 本地栅格 | GeoTIFF/COG、HDF5/NetCDF-4、MBTiles（桌面） |
| 远程矢量 | GeoJSON URL、GeoRSS、OGC API - Features、WFS、ArcGIS FeatureServer |
| 远程栅格/瓦片 | XYZ、WMS、WMTS、ArcGIS MapServer/ImageServer、WCS、COG、PMTiles、Zarr |
| 三维与点云 | 3D Tiles（含鉴权）、I3S、LiDAR（LAS/LAZ/COPC/EPT）、Gaussian splats、glTF/GLB、CZML、KML |
| 数据库 | PostGIS、SQL Server/Azure SQL（桌面）、DuckDB、Apache Iceberg、PGlite/PostGIS |
| 目录与云 | STAC、Planetary Computer、Earth Engine、Overture、Earthdata、GeoLens、S3、Hugging Face、ArcGIS Hub/Socrata/CKAN |

### 1.4.8 主要产出格式

GeoLibre 的产出并不只有“分享链接”。不同任务对应不同格式，选错格式会让下游多走很多弯路：

| 产出 | 入口 | 适合 |
| --- | --- | --- |
| `.geolibre` 工程 | Project → Save / Share | 继续编辑、团队交换、版本管理 |
| 单文件 HTML | Project → Export → Export as HTML... | 离线分发、嵌入静态站点、交付客户 |
| PNG / PDF / SVG | Project → Print Layout... | 打印、报告、排版；SVG 可进 Inkscape/Illustrator |
| GeoJSON / GeoParquet / Shapefile / GeoPackage / CSV | 图层操作或属性表导出 | 交给下游 GIS、数据库或数据管道 |
| KML / KMZ | 图层导出 | 回到 Google Earth 生态 |
| PMTiles / COG | Conversion 工具 | 发布为云原生数据 |
| LAS / LAZ / COPC | LiDAR 图层导出 | 点云交付与后续处理 |
| STAC Item | 图层 Metadata 对话框 | 数据编目与目录发布 |
| glTF / OBJ / STL | 三维拉伸图层导出 | 三维建模与打印 |

> **提示**
> 工程文件是“引用”，导出格式是“数据”。要交付给别人长期保存时，优先导出 GeoParquet/COG 这类自包含数据，再把工程里的图层指向它，而不是把数据塞进工程。

## 1.5 与主流平台的对比

官方对比文档把对象限定为 QGIS、ArcGIS Pro、ArcGIS Online、CARTO、Felt、kepler.gl，并单独讨论 Google Earth。下面抽取结论性内容，完整表格见仓库 `docs/comparison.md`。

### 1.5.1 定位速览

| | GeoLibre | QGIS | ArcGIS Pro | ArcGIS Online | CARTO | Felt | kepler.gl |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 许可 | MIT | GPL-2.0+ | 专有 | 专有 | 专有 | 专有 | MIT |
| 费用 | 免费 | 免费 | 订阅 | 订阅（分析按额度计费） | 订阅 | 订阅 | 免费 |
| 浏览器 | 完整应用，无需安装 | 无官方浏览器版 | 无 | 是（产品本身就是浏览器应用） | 是 | 是（编辑产品） | 是 |
| 桌面 | Windows/macOS/Linux | Windows/macOS/Linux | 仅 Windows | — | — | — | — |
| 移动 | 原生 Android/iOS | 借助 QField/Mergin Maps | — | 借助 ArcGIS Field Maps | — | Felt Field App | 响应式网页 |
| 工程文件 | `.geolibre`（开放、有文档） | `.qgs`/`.qgz` | `.aprx`（专有） | 托管 Web Map JSON | Map/Workflow JSON | 托管地图，无本地文件 | 可导出的配置 JSON |
| 数据位置 | 你的设备 | 你的设备 | 本地/企业地理数据库 | 厂商云 | 你的云数据仓库 | 厂商云（企业版可单租户） | 浏览器 |

### 1.5.2 数据与格式

| | GeoLibre | QGIS | ArcGIS Pro |
| --- | --- | --- | --- |
| 格式广度 | 宽：DuckDB-WASM Spatial + 自有读取器 | **最广**：GDAL/OGR 能读的都能读 | 很宽，含原生 Esri 格式 |
| 云原生矢量 | GeoParquet、FlatGeobuf、PMTiles（HTTP Range） | GeoParquet、FlatGeobuf、PMTiles（较新 GDAL） | 较新的 GeoParquet；无原生 PMTiles |
| 云原生栅格 | COG、Zarr、Cloud-Optimized NetCDF/HDF、kerchunk、MBTiles | COG、Zarr（GDAL 驱动） | COG；Zarr 作为多维栅格类型 |
| STAC | 内置目录浏览器 + STAC Index 发现 | 内置 STAC 连接 | 内置 STAC 连接与 Explore STAC |
| 数据库 | PostGIS、SQL Server（桌面）、DuckDB、Iceberg、PGlite/PostGIS | PostGIS、SpatiaLite、Oracle、SQL Server、SAP HANA | 企业地理数据库（SDE） |

结论很直接：**格式广度上 QGIS 仍然第一，GeoLibre 的优势在“云原生格式 + 浏览器内直接读”。** File Geodatabase 这类格式只有桌面版可用。

### 1.5.3 分析与制图

| 维度 | GeoLibre | QGIS | ArcGIS Pro | CARTO | Felt | kepler.gl |
| --- | --- | --- | --- | --- | --- | --- |
| 地理处理 | 1,000+（WASM 浏览器内） | 1,000+（原生/GDAL/GRASS/SAGA） | 最成熟，另有付费扩展 | 200+ Workflows 组件、180+ SQL 函数 | 少量常用工具 | 无工具目录 |
| 分析位置 | 浏览器；桌面可选 sidecar | 本机 | 本机或服务器/门户 | 你的云数据仓库 | 厂商云 | 浏览器 |
| 空间 SQL | DuckDB Spatial、PGlite/PostGIS、Apache Sedona | 虚拟图层、DB Manager | 企业地理数据库 SQL | 原生界面（仓库 SQL） | 连接源上的 SQL | DuckDB SQL |
| 模型/批处理 | Model Builder + 批处理与流水线串联 | 图形模型设计器 | ModelBuilder | Workflows（DAG、调度、版本） | — | — |
| 打印布局 | 打印布局 + 图集，PNG/PDF/SVG | 完整打印 composer + 图集 | 完整 Layout + map series | 高分辨率图片/PDF | 图片/PDF | 图片导出 |
| 样式交换 | 导入/导出 SLD、QML、Mapbox GL JSON | QML、SLD | `.lyrx`，有限 SLD | — | — | — |

### 1.5.4 与 QGIS：互补而非竞争

官方把两者比作“专业相机”与“手机相机”，这个类比值得完整理解：

- QGIS 提供极大的能力、灵活性与控制力，是专业制图、复杂格式与重处理任务的首选。
- GeoLibre 优先考虑可及性、便利性与即时分享，让没有复杂安装环境的用户也能处理空间数据。
- 两者可以组合：在 QGIS 中做数据准备与制图，把结果发布/嵌入为 GeoLibre 工程；GeoLibre 能直接读 QGIS 的 `.qgs`/`.qgz` 工程与 QML 样式。

### 1.5.5 与 ArcGIS 家族

- **ArcGIS Pro**：企业地理数据库编辑与版本化、最深的 3D 与影像工作流、专业工具箱，仍是 Esri 生态内不可替代的部分。GeoLibre 能读 `.aprx`/`.mapx` 的部分内容（第一幅二维地图的范围、本地矢量与 GeoTIFF、嵌套分组、可见性、简单符号、字段标注、矢量瓦片门户项、缓存地图服务），但不支持 File GDB、场景与网络共享路径。
- **ArcGIS Online**：重点是托管图层、组织共享与权限，以及 Dashboards/StoryMaps/Field Maps/Experience Builder 这套应用家族。GeoLibre 的差异在于工程可带走、可离线、可自托管。

### 1.5.6 与 CARTO、Felt、kepler.gl

| 平台 | 它最强的地方 | 什么时候仍应选它 | 什么时候选 GeoLibre |
| --- | --- | --- | --- |
| CARTO | 数据已在云仓库、需要把计算下推到仓库、Workflows 与 AI Agents | 数据必须留在 BigQuery/Snowflake 等仓库内，团队依赖仓库 SQL 与调度 | 数据要留在本机、需要离线工程文件、需要开源许可 |
| Felt | 团队协作制图、多人实时编辑与评论、外业 App | 协作制图本身就是全部工作，且能接受托管 | 需要分析深度、投影、打印布局或私有部署 |
| kepler.gl | 大规模点/轨迹的快速漂亮可视化 | 只需要探索性可视化，DuckDB SQL + AI 已够用 | 需要地理处理工具箱、制图产出或可移植工程 |

### 1.5.7 与 Google Earth / Google Earth Pro

Google Earth 是“虚拟地球”，GeoLibre 是“恰好带地球的 GIS”。两者的重叠只在“看”的瞬间：

| 维度 | GeoLibre | Google Earth（Web/移动） | Google Earth Pro（桌面） |
| --- | --- | --- | --- |
| 许可与费用 | MIT，免费 | 专有；免费版 + 按席位付费 | 专有，免费；桌面下载于 2027-06-25 结束 |
| 用途 | 分析、制图、数据工作 | 探索、标注、展示影像 | 同上，外加接近 GIS 的导入与量测 |
| 数据输入 | 矢量/栅格/瓦片/数据库/STAC/OGC/Esri/云原生 | KML/KMZ、GeoJSON、压缩 Shapefile | KML/KMZ、Shapefile、GeoTIFF、影像叠加、CSV 地理编码、GPS/GPX |
| 属性数据 | 属性表、连接、字段计算器、空间 SQL | 地标描述 | 导入文件的基础属性显示 |
| 投影 | 导入时重投影、可检索 EPSG、按工程椭球测量 | 仅 WGS84 地球 | 仅 WGS84 地球 |
| 分析 | 1,000+ 工具、空间 SQL、空间统计、路径与等时圈 | 量测、网页版高程剖面、图层过滤 | 量测、高程剖面、视域 |
| 产出 | 故事地图、打印图集、相机漫游视频、Dashboard、单文件 HTML | Drive 工程 + 演示模式 | Movie Maker 视频、高清图片 |
| 工程文件 | `.geolibre`，开放、可 diff、本地 | Drive 托管；可导出 KML | `.kmz`/`.kml` |

Google Earth 仍更强的地方是影像档案、历史影像、街景与真实感三维；GeoLibre 更强的是“看之后的一切”：属性、连接、工具箱、SQL、数据驱动符号化、打印布局、重投影与开放工程文件。

### 1.5.8 选择结论

| 你的处境 | 建议 |
| --- | --- |
| 想在一个浏览器标签里用真正的 GIS，数据不能离开本机 | GeoLibre |
| 需要 GDAL/OGR 的最广格式覆盖、最深桌面制图、成熟插件 | QGIS |
| 已在 Esri 生态，需要企业地理数据库、版本化、最深 3D/影像 | ArcGIS Pro |
| 重点是托管图层、组织权限与 Esri 应用家族 | ArcGIS Online |
| 数据已在云仓库且必须留在那里 | CARTO |
| 团队协作制图与低摩擦地图制作是全部工作 | Felt |
| 快速漂亮地探索大规模点/轨迹 | kepler.gl |
| 只想看地球、展示地点、标注 | Google Earth |
| 需要接替 Earth Pro 的 KML 归档 + 真 GIS 能力 | GeoLibre |

## 1.6 技术栈与架构鸟瞰

本节只建立“地图”，细节留给[第23章 源码架构与二次开发](https://znlgis.github.io/gis/tutorial/GeoLibre/第23章-源码架构与二次开发/)。

### 1.6.1 技术栈

| 层 | 技术 | 作用 |
| --- | --- | --- |
| 桌面/移动外壳 | Tauri v2（Rust） | 原生窗口、文件对话框、系统凭据库、协议处理、移动端打包 |
| UI | React 19 + TypeScript + Tailwind CSS | 工作区、面板、对话框、命令面板 |
| 主地图 | MapLibre GL JS 6 | 矢量/栅格渲染、图层同步、交互与控件 |
| 三维叠加 | deck.gl 9 | 点云、3D Tiles、I3S、Gaussian splats 等重叠加图层 |
| 其他引擎 | Mapbox GL JS、CesiumJS、ArcGIS Maps SDK for JavaScript | 可切换的主图或分屏引擎 |
| 本地分析 | DuckDB-WASM Spatial、Turf.js、WebAssembly 工具箱、Pyodide | 矢量读取与 SQL、几何工具、Whitebox、GeoPandas |
| 可选后端 | Python FastAPI sidecar（127.0.0.1:8765） | Whitebox 服务端补充、格式转换、rasterio 栅格、GeoPandas 引擎、SQL Server |
| 状态管理 | Zustand（`@geolibre/core`） | 唯一事实源：工程、图层、样式、UI 状态 |
| 分发服务 | Cloudflare Workers（viewer/collab/tiles/ai-proxy）、FastAPI 参考服务端 | 分享、协作、瓦片、AI 代理、自托管项目 API |

### 1.6.2 仓库版图

| 目录 | 内容 |
| --- | --- |
| `apps/geolibre-desktop` | React + Tauri 主应用（组件、`src-tauri`、JupyterLite、静态资源） |
| `apps/geolibre-mcp-app` | MCP 应用壳 |
| `packages/core` | Zustand store、领域类型、`.geolibre` schema（`project.ts`/`types.ts`） |
| `packages/map` | MapLibre 生命周期与图层同步；Mapbox/Cesium/ArcGIS 引擎适配 |
| `packages/ui` | 基础 UI 原语 |
| `packages/processing` | 客户端算法注册表（矢量/栅格/WASM/OBIA/统计/DGGS/视域） |
| `packages/plugins` | 插件接口、内置插件、插件宿主（右侧面板/工具栏菜单/浮动面板） |
| `packages/embed` | `@geolibre/embed` 类型化 iframe 客户端 |
| `packages/collab-core` | 协作协议与会话核心 |
| `backend/geolibre_server` | 本地 FastAPI sidecar（可选） |
| `backend/geolibre_server_api` | 多用户项目/身份 API 参考实现（FastAPI + SQLAlchemy + Postgres/SQLite） |
| `python/` | `geolibre` Jupyter anywidget 与 `geolibre-mcp` |
| `workers/` | Cloudflare Workers：viewer、collab、collab-node、tiles、ai-proxy |
| `extensions/geolibre-chrome` | Chrome 扩展 |
| `schema/`、`scripts/`、`tests/`、`e2e/`、`docs/`、`docker/`、`packaging/`、`skills/` | 部署 schema、脚本、测试、文档、容器与打包、智能体技能 |

### 1.6.3 单向数据流

应用是 store-driven 的，数据流严格单向：

1. **数据入口**：Add Data、Tauri 文件对话框、文件选择、拖拽或插件发起加载。
2. **解析**：本地矢量优先由 DuckDB-WASM Spatial 读成 GeoJSON（`INSTALL spatial; LOAD spatial; ST_Read`）；GeoParquet 走 Parquet reader；zip Shapefile 走 shpjs 并以 DuckDB 兜底；KMZ 客户端解压。
3. **入库**：调用 `addGeoJsonLayer`，生成 `GeoLibreLayer` 记录写入 Zustand store。
4. **订阅**：`MapCanvas` 订阅 `layers`，`MapController.syncLayers` 比较前后差异，协调 MapLibre 的 source/layer 增删改。
5. **回写**：用户编辑走 store action，再由第 4 步反映到地图。

这条链路有一条硬规则：**禁止 UI 直接修改 MapLibre 对象**。要让地图变化，就改 store，让同步层去应用。否则撤销/重做、工程保存与协作补丁都会与地图实际状态脱节。

> **提示**
> 这条规则同样适用于二次开发与插件开发。插件通过宿主 API 注册图层与面板，而不是自己抓 `map` 对象硬改；这样切换渲染引擎时插件才能被正确挂起与恢复。

### 1.6.4 渲染分层

- **MapLibre 主图**：矢量、栅格瓦片、COG、PMTiles、WMS/WMTS 等；样式与图层顺序由 store 同步。
- **deck.gl 叠加**：点云、3D Tiles、I3S、Gaussian splats、Deck.gl Layer builder 图层。
- **Cesium 地球**：作为主图时替换整个工作区（旧画布卸载）；作为分屏时与二维相机同步。
- **Mapbox / ArcGIS**：各自的原生图层体系，能力按引擎门控。

四种引擎共享同一份工程状态，因此“切换引擎不丢图层”是设计目标，而不是逐引擎重做一遍工程。

### 1.6.5 可选服务端

| 组件 | 何时需要 | 默认 |
| --- | --- | --- |
| Python sidecar | 需要 rasterio 全量栅格工具、GeoPandas 引擎、格式转换、SQL Server | 桌面按需启动；浏览器可作为同源 /sidecar 代理 |
| 分享服务端 | 需要私有化 Project → Share 与项目画廊 | 默认用 `share.geolibre.app`；可自托管或设为 off |
| 协作中继 | 需要实时多人编辑 | 默认关闭，需配置 `VITE_GEOLIBRE_COLLAB_URL` 或运行时变量 |
| AI 代理 Worker | 希望托管 AI 调用而不在浏览器暴露上游 token | 仅托管/自托管部署使用 |

这些组件全部**可选**。GeoLibre 的核心工作流（加载、样式、属性表、矢量工具、Whitebox、DuckDB SQL、打印、导出）在一个静态 Web 构建里即可完成。

### 1.6.6 嵌入协议与协作

如果要把 GeoLibre 嵌进自己的系统，需要理解两条“对外接口”：

**（1）iframe 的 postMessage 协议。** 宿主页面通过版本化协议控制被嵌入的应用，协议 v2 为当前版本，v1 宿主仍受支持。典型命令包括：加载工程、移动相机、高亮要素、打开处理工具、切换与列出图层、应用过滤、读取视口、添加图层、导出 PNG，以及 `getLayerFeatures` 与 `getDrawnFeatures` 读回要素。

应用回传的事件：

| 事件 | 含义 |
| --- | --- |
| `ready` | 应用就绪，可以发命令 |
| `ack` | 命令确认（与请求关联） |
| `projectLoaded` | 工程加载完成 |
| `selectionChanged` | 选择变化 |
| `viewChanged` | 相机/视口变化 |
| `toolCompleted` | 处理工具执行完成 |
| `serverFileWritten` | 服务端文件写入完成 |
| `featuresChanged` | 要素被绘制或编辑（去抖） |

协议默认关闭，除非部署方用 `GEOLIBRE_EMBED_ORIGINS` 声明可信来源；来源白名单决定“谁能发命令”，部署 capability 决定“哪些命令存在”，两者是独立的两道闸门。

**（2）类型化客户端。** `geolibre/embed` 把上述协议封装成 Promise 风格的 API：`connect()` 在应用就绪后 resolve，每个命令返回与 ack 关联的 Promise，事件按名称订阅。它的版本随 GeoLibre 发布，避免手写 postMessage 的字符串与竞态。

> **注意**
> 嵌入 API 不是“远程控制任意部署”的通道。没有配置可信来源时它完全关闭；即使开启，也只对白名单来源开放，并受部署能力约束。

## 1.7 平台矩阵与分发渠道

### 1.7.1 平台矩阵

| 平台 | 分发方式 | 自动更新 | 备注 |
| --- | --- | --- | --- |
| Web | GitHub Pages 静态站 / 自建静态服务器 / Docker | 随页面刷新 | 无需安装；无本地文件对话框 |
| Windows | Microsoft Store、winget、`.msi`/`-setup.exe`、便携 zip | Store 版自动；GitHub 版需手动 | GitHub 构建未签名，可能触发 SmartScreen |
| macOS | Homebrew Cask、DMG、Mac App Store | Homebrew 可升级；MAS 走商店 | MAS 版是沙盒构建，功能有裁剪 |
| Linux | AUR、COPR、Flatpak（FlatPark）、`.deb`、`.rpm`、AppImage | 包管理器/AppImageUpdate | v2.3.0 之后的 AppImage 内嵌更新信息，可用 AppImageUpdate 差分更新 |
| Android | Google Play、按 ABI 签名的 APK | Play 自动；侧载需手动 | Play 与侧载签名不同，不能互相升级 |
| iOS | App Store | 自动 | 无面向最终用户的侧载 `.ipa` |
| Jupyter | PyPI `geolibre`、conda-forge | pip/conda | 内嵌完整应用，双向同步 |
| R | CRAN `geolibre` | `install.packages` | HTML widget |
| Chrome | Chrome Web Store、release 里的 zip | 商店自动 | 收集页面上的数据链接与服务，在 GeoLibre 中打开 |
| 容器 | `ghcr.io/opengeos/geolibre:latest`、`docker compose` | 拉取新镜像 | 可带 sidecar、Basic Auth、Clerk/Auth0 门禁 |

### 1.7.2 桌面分发细节

| 系统 | 首选 | 备选 | 注意 |
| --- | --- | --- | --- |
| Windows | Microsoft Store（签名、自动更新） | winget `OpenGeos.GeoLibre`、手动安装、便携版 | 便携版依赖 WebView2 Runtime；不自动更新 |
| macOS Apple Silicon | Homebrew Cask `brew install --cask geolibre` | DMG（开发者 ID 签名并公证） | 完整功能 |
| macOS Intel | 同上（`x64` DMG） | — | 同上 |
| macOS（沙盒） | Mac App Store | — | 无 sidecar、无 JupyterLab 服务、无 martin/PostGIS、无外部插件安装、无 Earth Engine 登录 |
| Linux | AUR `geolibre-bin` / COPR / Flatpak | `.deb`、`.rpm`、AppImage | AppImage 需要 FUSE（libfuse2），否则用 `--appimage-extract-and-run` |

### 1.7.3 包与嵌入

| 包/接口 | 用途 |
| --- | --- |
| `pip install geolibre` | Jupyter 中嵌入完整应用（anywidget） |
| `conda install -c conda-forge geolibre` | conda 环境 |
| `install.packages("geolibre")` | R / RStudio / Quarto / Shiny |
| `@geolibre/core`、`@geolibre/map`（npm） | 在其他应用中复用 store、工程 schema 与 MapLibre 同步引擎 |
| `@geolibre/embed`（npm） | 类型化 iframe 客户端，按 postMessage 协议控制嵌入页 |
| `geolibre`（PyPI，含 `geolibre-mcp` 控制台脚本） | MCP stdio 服务器，供 AI 客户端无头编写工程 |
| Docker 镜像 | 自托管 Web 应用，可启用 sidecar 与访问门禁 |

### 1.7.4 更新与信任模型

- GitHub Release 的 Windows 构建未签名，首次运行可能触发 SmartScreen；Store 构建已签名并自动更新。
- macOS DMG 自 v1.4.1 起用开发者 ID 签名并经 Apple 公证，正常打开无需绕过 Gatekeeper；更早的版本需要 `xattr -dr com.apple.quarantine`。
- 外部插件是**受信任代码**：安装即授予其与应用同源的权限。市场安装会校验 bundle hash，但沙箱隔离不是插件模型的一部分。
- 桌面版把 API key、token 等敏感值放进系统凭据库；网页版只能放在浏览器存储中，这是“同源脚本可读”的已知权衡。

### 1.7.5 自托管与服务端形态

自托管不是“二选一”，而是按需要叠加：

| 形态 | 提供什么 | 典型场景 |
| --- | --- | --- |
| 静态站点 | 完整 Web 应用，无后端 | 内网发布、与数据同源部署 |
| 单容器（Docker） | 静态站 + nginx + 可选 sidecar | 小团队、演示环境 |
| Compose 组合 | Web + 项目服务端 + 协作中继 + Postgres | 需要 Share、项目画廊、实时协作 |
| 访问门禁 | HTTP Basic Auth、Clerk、Auth0 | 对外但不想公开 |
| 能力策略 | `GEOLIBRE_CAPABILITIES` 限制六项能力 | 展厅、教室、只读门户 |
| 自有服务端点 | `GEOLIBRE_SHARE_URL`、`GEOLIBRE_COLLAB_URL`、`GEOLIBRE_GEOLENS_URL` | 数据与协作都留在自己基础设施内 |

关键运行时变量（容器启动时读取，改完重启即可生效，无需重建镜像）：

| 变量 | 作用 |
| --- | --- |
| `GEOLIBRE_SHARE_URL` | 指向自托管分享服务；`off` 移除 Share 与项目画廊 |
| `GEOLIBRE_COLLAB_URL` | 指向协作中继；不设置则协作关闭 |
| `GEOLIBRE_APP_NAME` | 替换工具栏与标签页标题中的 “GeoLibre” |
| `GEOLIBRE_CAPABILITIES` | 逗号分隔的能力列表，或 `none` |
| `GEOLIBRE_EMBED_ORIGINS` | 允许驱动嵌入应用的来源 |
| `GEOLIBRE_AUTH_USER` / `GEOLIBRE_AUTH_PASSWORD` | 单组共享凭据的 HTTP Basic Auth |

> **警告**
> 远程服务必须使用 TLS：应用可能向配置的服务发送凭据。分享/GeoLens 用 `https://`，协作中继用 `wss://`；不合规的值会**让容器启动失败**，而不是悄悄回退到公共服务。

## 1.8 适用与不适用场景

### 1.8.1 适合的场景

1. **需要“打开就能用”的 GIS**：教学、培训、评审、客户演示，不想让参与者先装软件。
2. **数据不能上传**：涉密、受控或客户数据只能留在本机；网页版在浏览器内完成计算。
3. **云原生数据工作流**：数据在对象存储里以 COG/GeoParquet/PMTiles/Zarr 存放，需要按需读取与快速预览。
4. **跨端交付**：同一份工程在桌面制作、网页分享、手机查看、Notebook 复现。
5. **嵌入到自己的产品**：需要开放工程格式、MIT 许可、可版本化的 iframe API 与可自托管部署。
6. **浏览器内的中等规模分析**：矢量叠加与缓冲、地形/水文、光谱指数、点云分类、空间 SQL。

### 1.8.2 不适合的场景

官方在对比文档里明确列出了 GeoLibre 不占优的领域：

| 限制 | 说明 | 替代方案 |
| --- | --- | --- |
| 超大本地数据集 | 浏览器内存与 WASM 是硬限制；客户端矢量切片与流式读取能抬高上限，但多 GB 的本地处理仍属桌面 GIS | QGIS、ArcGIS Pro |
| 格式广度 | GDAL/OGR 能读的格式比 DuckDB-WASM Spatial 多；File Geodatabase 只有桌面版支持 | QGIS（GDAL/OGR） |
| 专业工具箱深度 | ArcGIS Pro 的 Spatial Analyst、Geostatistical Analyst、Network Analyst，以及 QGIS 二十年插件积累，覆盖 GeoLibre 没有等价物的流程 | ArcGIS Pro、QGIS |
| 企业数据管理 | 版本化编辑、复制、企业地理数据库运维不在范围内 | ArcGIS Enterprise、PostGIS 工程实践 |
| 成熟度 | GeoLibre 稳定且在活跃开发，但远比 QGIS/ArcGIS 年轻；部分“已发布”能力是近期加入的 | 保守项目可先在 QGIS 中验证流程 |

### 1.8.3 组合使用的建议

- **QGIS 做数据工程，GeoLibre 做交付**：在 QGIS 中整理图层与样式，导出 QML/SLD，GeoLibre 导入样式并把工程分享为网页或单文件 HTML。
- **ArcGIS Pro 做权威数据，GeoLibre 做外业查看**：Pro 维护企业地理数据库，GeoLibre 通过 ArcGIS 服务或导出文件查看与轻量编辑。
- **Python/Notebook 做批量实验，GeoLibre 做可视化验证**：用 `geolibre` Python 包在 Notebook 内嵌应用，边算边看。
- **自托管做团队门户**：Docker 部署 Web 应用 + 自托管分享/协作服务，数据与应用同源，避免 CORS 与凭据外泄。

### 1.8.4 从其它工具迁移的检查清单

把既有工作搬到 GeoLibre 之前，按顺序核对这八项，能避免大部分“打开了但不对”的问题：

1. **数据格式**：列出全部源文件格式，标出 GDAL 专有或 GeoLibre 只读的格式（如 File GDB、CAD、专有影像格式）。
2. **坐标系**：确认每个图层的 CRS 是否写在数据里；没有 `.prj` 的 Shapefile 需要手工指定。
3. **数据规模**：估算要素数与栅格尺寸；超过浏览器舒适区间的数据先切分、聚合或转云原生格式。
4. **远程服务**：检查 WMS/WFS/ArcGIS 服务是否允许跨域、是否使用 token；共享前先看 Share 的就绪检查。
5. **符号与标注**：确认 QML/SLD 能否覆盖现有样式；不支持的符号需要手工重建。
6. **分析流程**：把桌面工具箱流程映射到 Whitebox、GeoLibre Toolbox、SQL 或 Model Builder，记录没有等价物的步骤。
7. **产出要求**：是否需要打印图集、PDF 报告、单文件 HTML 或嵌入页面，提前验证打印布局与导出效果。
8. **数据托管**：决定本地文件、对象存储还是数据库；本地文件图层在分享时会被明确列出“将缺失”。

## 1.9 许可、引用、社区与贡献

### 1.9.1 MIT 许可

GeoLibre 使用 MIT 许可证。对你的实际含义：

| 你可以 | 你必须 | 你不必 |
| --- | --- | --- |
| 商业使用、修改、再分发、私有部署 | 在副本中保留版权与许可声明 | 开源你的修改 |
| 把它嵌入自己的产品 | 不追究作者责任（免责声明） | 支付授权费 |

> **注意**
> MIT 只覆盖 GeoLibre 自身代码。它依赖的第三方库、底图服务、影像服务与数据各有自己的许可与条款；商用前请逐一确认，尤其是底图与影像提供商。

### 1.9.2 引用

GeoLibre 在 Zenodo 上归档，每次发布都会生成 DOI；概念 DOI 始终解析到最新版本。

```text
Wu, Q. (2026). GeoLibre: A lightweight, cloud-native GIS platform for
visualizing, exploring, and analyzing geospatial data. Zenodo.
https://doi.org/10.5281/zenodo.20785400
```

BibTeX 与 APA 条目可从仓库根的 `CITATION.cff` 获取，也可用 GitHub 的 “Cite this repository” 按钮直接复制。

### 1.9.3 社区与支持渠道

| 渠道 | 用途 |
| --- | --- |
| GitHub Issues | 缺陷报告与功能请求（有 issue 模板） |
| GitHub Releases | 版本说明与安装包 |
| 官方文档 <https://geolibre.app> | 用户指南、教程、参考文档 |
| 视频教程 | YouTube 上的功能演示与工作流讲解 |
| DeepWiki | 面向代码理解的仓库问答入口 |
| GitHub Sponsors / Buy Me a Coffee | 赞助开发、托管与分发 |

### 1.9.4 贡献入口

| 你想做的事 | 入口 |
| --- | --- |
| 报告缺陷 | GitHub Issue（附版本、平台、复现步骤、诊断信息） |
| 修文档 | `docs/` 下的 Markdown，遵循贡献指南的文档章节 |
| 写代码 | `docs/contributing.md`：开发环境、仓库结构、质量门禁 |
| 写插件 | `docs/plugin-api.md` 与 `packages/plugins` |
| 翻译 | `docs/i18n.md`；20 种完整语言目录 |
| 提供数据/示例 | `docs/gallery.md`、示例工程与开放数据画廊 |

本地质量门禁的核心命令是 `npm run ci`（lint + 前端构建与测试 + 测试类型检查 + 后端 + Rust 检查）。只想先跑前端时用 `npm run ci:frontend`。

### 1.9.5 术语约定

本站教程中的术语按下列约定使用，与界面英文保持一致：

| 术语 | 英文/界面名 | 含义 |
| --- | --- | --- |
| 工程 | project | 一个 `.geolibre` 文件及其工作区状态 |
| 图层 | layer | 工程中的一份数据渲染单元，含 source、style、visible 等 |
| 渲染引擎 | rendering engine | 绘制地图的底层引擎（MapLibre/Mapbox/Cesium/ArcGIS） |
| 侧车 | sidecar | 本机可选的 Python FastAPI 服务（127.0.0.1:8765） |
| 云原生 | cloud-native | 以 COG/GeoParquet/PMTiles/Zarr 等格式按需读取的数据组织方式 |
| 深链 | deep link | 用 URL 参数直接打开工程、数据或工具 |
| 插件市场 | marketplace / registry | 内置的插件索引与安装入口 |
| 体验级别 | experience level | Beginner / Intermediate / Advanced / Custom |
| 能力 | capability | 部署侧限制的六项操作权限 |
| 体验配置 | UI profile | 控制菜单、数据源、插件可见性的本地配置 |

### 1.9.6 本教程的章节地图

| 你想学 | 去读 |
| --- | --- |
| 装起来、跑通第一个地图 | [第02章 安装部署与快速上手](https://znlgis.github.io/gis/tutorial/GeoLibre/第02章-安装部署与快速上手/) |
| 认清界面、菜单、面板与快捷键 | [第03章 用户界面与工作区](https://znlgis.github.io/gis/tutorial/GeoLibre/第03章-用户界面与工作区/) |
| 工程文件、设置与凭据 | [第04章 项目文件与个人设置](https://znlgis.github.io/gis/tutorial/GeoLibre/第04章-项目文件与个人设置/) |
| 加数据、认格式 | [第05章 数据添加与格式支持](https://znlgis.github.io/gis/tutorial/GeoLibre/第05章-数据添加与格式支持/) |
| 图层、样式、引擎、坐标 | 第06–09 章 |
| 属性表、SQL、地理处理、建模 | 第10–15 章 |
| 遥感、点云、AI、Python、制图、插件 | 第16–21 章 |
| 自托管、架构、测试、性能 | 第22–25 章 |
| 综合案例 | [第26章 实战案例与综合应用](https://znlgis.github.io/gis/tutorial/GeoLibre/第26章-实战案例与综合应用/) |

## 1.10 本章小结

- GeoLibre 是 MIT 许可的免费开源、轻量、云原生 GIS 平台，同一套代码运行在 Web、桌面、Android、iOS 与 Jupyter 中，数据默认留在本地。
- 三条设计承诺是本地优先、云原生格式、跨平台同构；AI 与自动化被约束为“通过应用执行、可审计、可撤销”。
- 版本线从 v0.1（地图查看器）走到 v3.4（OBIA、星载激光、四渲染引擎、完整 ArcGIS 服务编辑），三条主线是数据入口、分析引擎、产出与协作。
- 核心能力可归纳为：1,000+ WASM 工具、四渲染引擎、三种 SQL 引擎、AI/MCP、插件市场、开放工程格式与多种产出渠道。
- 与 QGIS、ArcGIS、CARTO、Felt、kepler.gl、Google Earth 相比，GeoLibre 不追求全面替代，而是用“浏览器内 + 本地数据 + 开放工程”占住一个它们都不完全覆盖的位置。
- 它不适合超大本地数据集、最广格式覆盖、最深专业工具箱与企业地理数据库管理；这些场景应与 QGIS/ArcGIS 组合使用。
- 使用前请确认第三方底图、影像与数据的许可条款；学术引用使用 Zenodo DOI。

## 1.11 实践练习

1. **定位判断**：列出你手头三个 GIS 任务，分别判断应使用 GeoLibre、QGIS 还是 ArcGIS Pro，并写出判断依据（数据规模、格式、是否需要企业地理数据库、是否需要离线分享）。
2. **版本考古**：打开仓库 `docs/roadmap.md`，找出“Cesium 成为主渲染引擎”与“Mapbox/ArcGIS 加入渲染引擎”分别属于哪个版本，并说明这两步对“一个工程四种引擎”的意义。
3. **能力核对**：任选一个 Whitebox 工具类别（如 Hydrology），在文档或应用中找到至少三个具体工具名，记录它们的输入、输出与所在菜单路径。
4. **对比写作**：以“给一个没有 GIS 背景的同事解释为什么不用 Google Earth 做这份工作”为题，写一段 200 字说明，至少引用本章两个对比维度。
5. **许可检查**：为一个准备商用的地图应用列出需要核对的第三方许可清单（GeoLibre 本体、底图提供商、影像服务、数据源），并说明 MIT 覆盖到哪里、不覆盖到哪里。
6. **架构复述**：不看本章，用自己的话画出“数据入口 → store → MapCanvas → MapController.syncLayers”的单向数据流，并解释为什么 UI 不能直接改 MapLibre 对象。
