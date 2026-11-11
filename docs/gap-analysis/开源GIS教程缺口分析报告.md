# 开源 GIS 平台 / 库 —— gis/tutorial 教程缺口分析报告

> **分析对象**：znlgis.github.io 站点栏目 `gis/tutorial`
> **分析日期**：2026-11-11
> **方法**：仓库全量扫描（1,579 个 Markdown 文件、关键词边界匹配 + 人工复核）+ 5 个方向的在线调研（OSGeo 项目页、GitHub stars/最近提交、项目官网与官方文档、PyPI/npm 版本）+ 跨方向去重
> **调研底稿**：[desktop-3d.md](desktop-3d.md)、[web-frontend.md](web-frontend.md)、[server-cloud.md](server-cloud.md)、[spatial-db-osm.md](spatial-db-osm.md)、[libs-langs.md](libs-langs.md)（同目录）；星数缓存见 [stars-cache.json](stars-cache.json)

---

## 摘要（TL;DR）

**现有家底**：`gis/tutorial` 已提交 21 套教程共 341 章，另有 **JTS 24 章脚手架**（`gis/tutorial/jts/`，正文全部为"撰写中"，尚未提交；工作区的 `_data/navigation.yml`、`gis/tutorial/index.md`、`README.md` 已被并行会话改出 JTS 条目）。已覆盖的层次是：数据引擎（GDAL）、空间数据库（PostGIS）、地图服务（GeoServer 三套）、桌面 GIS（QGIS）、Web 2D（OpenLayers）、Web 3D（CesiumJS）、Java/.NET 几何与工具库（GeoTools、NTS、SharpMap、Mapsui、Esri Geometry API、OpenGIS Utils）、Python 矢量分析（GeoPandas、Shapely）、AI 流水线与新平台（GeoPipeAgent、OpenGIS DAF、GeoLibre）。

**核心结论：站点强在"用库/平台做 GIS"，弱在四处结构性空白——**

1. **造 GIS 的底层引擎缺位**：PROJ（坐标参考系）与 GEOS（C++ 几何引擎）全站只被"间接调用"，没有一套教程讲原理与排障；JTS 在建未收尾。三者是 GeoTools/NTS/Shapely/PostGIS/QGIS 的共同血缘，也是中文 GIS 资料最薄、读者提问最密集的地带。
2. **"生产数据"的桌面工具与生产管线缺位**：现有桌面只有 QGIS 一套；GRASS GIS、OTB、SNAP、WhiteboxTools、GeoDa、CloudCompare、PDAL、OpenDroneMap/WebODM、osgEarth 全部没有——这恰好是测绘、自然资源、应急、规划读者的日常生产工具。
3. **Web 前端只有一条线**：2D 只有 OpenLayers、3D 只有 CesiumJS；最主流的 Leaflet、矢量瓦片时代的 MapLibre GL JS、GPU 可视化的 deck.gl、前端的 Turf.js/JSTS 全部缺位。
4. **服务端与云原生只有 GeoServer 一条线**：MapServer、QGIS Server、MapProxy、GeoNode、GeoNetwork、pygeoapi 缺失；STAC/COG/TiTiler/PMTiles/Planetiler/Martin 等云原生与瓦片栈在站内只"用"不"搭"。

**建议立项顺序（详见第四节）**：第一批 8 项 —— JTS（收尾）、PROJ、Leaflet、MapLibre GL JS、MapServer、GRASS GIS、PDAL、DuckDB spatial；第二批 10 项 —— GEOS、GeoNode、OpenDroneMap/WebODM、SpatiaLite、pgRouting、rasterio、xarray+rioxarray、OSMnx、PySAL、STAC+COG+TiTiler 云原生栈。

**一句话**：补齐这 18 项，站点的教程矩阵才算覆盖"数据生产 → 数据管理 → 服务发布 → 前端呈现"的完整开源 GIS 链路，而不只是"几个明星项目的使用手册"。

---

## 一、已有覆盖盘点

### 1.1 已提交的 21 套教程（341 章）

| 层 | 教程系列 | 章数 | 备注 |
|---|---|---:|---|
| 数据引擎/格式 | GDAL | 15 | 栅格/矢量/CLI/Python/Java/C# 绑定 |
| 空间数据库 | PostGIS | 18 | 类型/索引/函数/栅格/拓扑/集成 |
| 地图服务 | GeoServer、GeoServer REST API、GeoServer Cloud | 8 / 18 / 10 | 单体服务 + REST 自动化 + 微服务 |
| 桌面 GIS | QGIS | 20 | 含 Processing、PyQGIS、插件、QGIS Server 一节 |
| Web 2D | OpenLayers | 18 | — |
| Web 3D | CesiumJS | 18 | 3D Tiles、地形、Entity/Primitive |
| Java 生态 | GeoTools、OpenGIS Utils Java | 17 / 12 | 另有 **JTS 在建（24 章）** |
| .NET 生态 | NetTopologySuite、SharpMap、Mapsui、OpenGIS Utils .NET | 15 / 17 / 16 / 12 | 空间计算 + 桌面渲染 + 跨平台地图 |
| 几何引擎（Esri） | Geometry API Java、Geometry API .NET | 12 / 12 | — |
| Python 矢量分析 | GeoPandas、Shapely | 27 / 20 | 矢量数据分析 + 几何操作 |
| AI 流水线/新平台 | GeoPipeAgent、OpenGIS DAF、GeoLibre | 20 / 10 / 26 | AI 流水线、方案驱动质检、云原生 GIS 平台 |

### 1.2 相邻内容（判断"是否已覆盖"时需一起看）

- `gis/basic`：数据格式、地图服务（OGC 协议综述）、开发环境、开发技巧 4 个栏目——**协议与格式的"概念层"已覆盖**，缺口主要在"部署与实操"。
- `gis/bpc`：11 套业务全景（房产测绘、多测合一、水务、应急、一张图、GIS+CAD、数据分析、数据质检、三维 GIS、GIS+AI 等），属**分析报告型**内容，出现大量工具名词但没有工具实操。
- `gis/lin-ear-th-inking`：JTS 作者 Martin Davis 博客的 32 篇翻译，**算法思想层**覆盖较好，但没有 JTS API 系统教程。
- `demos`：Vue3+OpenLayers（8 章）、Vue3 地图大屏（ECharts + 天地图，5 章）等演示项目，属应用示范，不构成库教程。
- `3d` / `cad`：SuperSplat、Ara3D、Photo-Sphere-Viewer、FreeCAD、OCCT、Clipper2 等，非 GIS 平台/库本体。

### 1.3 JTS 在建状态的特别说明（重要）

- `gis/tutorial/jts/` 已有 24 章骨架、索引页与章节导航，**全部正文为"本章正文撰写中"**，且该目录**未被 git 跟踪**（`git status` 显示 `?? gis/tutorial/jts/`）。
- 工作区中 `_data/navigation.yml`、`gis/tutorial/index.md`、`README.md` 已加入 JTS 条目（未提交）。若直接以工作区构建/部署，会出现一套"空壳教程"。
- **建议**：JTS 作为 P0 第一优先级"先收尾再上线"；若短期无法完成，先回退这三个文件的 JTS 条目，避免半成品暴露。

### 1.4 覆盖矩阵（层 × 现状）

| 层 | 已覆盖 | 空白（本次调研结论） |
|---|---|---|
| 基础引擎/坐标 | （JTS 在建） | **PROJ、GEOS**、S2、H3、Boost.Geometry、CGAL、libspatialindex |
| 桌面 GIS/分析 | QGIS | **GRASS GIS**、OTB、SNAP、WhiteboxTools、GeoDa、CloudCompare、3DCityDB、SAGA（低优先） |
| 点云/摄影测量/三维生产 | GeoLibre 有应用章节 | **PDAL**、**OpenDroneMap/WebODM**、Potree、Meshroom、osgEarth |
| 服务端/发布/门户 | GeoServer 三套 | **MapServer**、QGIS Server、MapProxy、**GeoNode**、GeoNetwork、pygeoapi、deegree、MapStore |
| 云原生/瓦片/大数据 | 仅零星提及 | **STAC+COG+TiTiler**、PMTiles、Planetiler、Martin、Sedona、GeoMesa、GeoTrellis |
| Web 前端/可视化 | OpenLayers、CesiumJS | **Leaflet**、**MapLibre GL JS**、deck.gl、Turf.js、L7、ECharts 地理、Mars3D、maptalks |
| 数据库/数据工程 | PostGIS | **DuckDB spatial**、**SpatiaLite**、**pgRouting**、OSM 数据栈、Nominatim、OSRM/Valhalla、MobilityDB |
| 语言生态 | Java/.NET 较全，Python 矢量较全 | rasterio、xarray、OSMnx、PySAL、Apache SIS、R/Julia/Rust/Go（P2） |
| 移动端/外业 | （无） | MapLibre Native、Mapsforge、flutter_map、QField（P2） |

---

## 二、评估口径

**主流度（四要素）**：① OSGeo 官方项目/社区项目身份；② GitHub stars 与最近提交（2026-11-11 抓取，仅作量级参考）；③ 生态依赖关系（谁离不开它，如 PROJ/GEOS 被 PostGIS/QGIS/GDAL/Shapely 依赖）；④ 中文社区实际需求（站点定位：GIS 开发、测绘/自然资源/政务/应急场景）。

**立项价值（五条）**：① 能否撑起 10+ 章独立知识体系；② 与现有教程互补而非重复；③ 中文资料缺口是否真实存在；④ 是否有稳定的 API/文档可写；⑤ 受众规模与站点主线是否匹配。

**数据与局限**：
- 星数来自 GitHub API / shields.io 缓存，四舍五入，**不是精确值**；GRASS（主仓曾为 SVN）、SNAP（GitHub 只是镜像）、Mars3D/maptalks（中文热度远高于 star）等 star 会显著低估真实用户量。
- OSGeo 官网项目页为 JS 渲染，本次抓取受限，**"OSGeo 官方项目"身份建议写作前再到 osgeo.org 复核徽标等级**。
- 停更年份、部分仓库更名/迁移未逐一核实，已在各调研笔记的"不确定点"标注。
- 中文需求判断来自领域常识与站点定位，**没有搜索指数支撑**，正式立项前可用百度/微信指数校准。

---

## 三、缺口总览（按类别）

> 优先级标记：**P0** = 建议尽快立项（10+ 章系列）；**P1** = 下一批（8~12 章或重点专题）；**P2** = 观察/专题文章；"—" = 不单独立项。
> "站内现状"分三层：**独立教程**（有自成系列）/ **间接覆盖**（作为底层被使用但无自身教学）/ **仅提及**（正文出现但无系列）/ **未覆盖**（全仓库 0 命中）。

### A. 基础引擎与坐标 / 几何

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **PROJ** | 坐标参考系与投影转换的"根"，GDAL/QGIS/PostGIS/pyproj 的转换内核 | 间接覆盖：84 个文件 396 处提及，无系统教程 | **P0** | 14 章：CRS/基准/投影 → EPSG/projinfo → WKT2 → 基准转换 → 网格偏移 → 中国坐标系（CGCS2000/西安80/北京54/GCJ-02）→ pyproj/绑定 → 排障 |
| **GEOS** | C++ 几何引擎，PostGIS/QGIS/Shapely 的几何运算内核（JTS 的 C++ 移植） | 间接覆盖：57 个文件 203 处 | **P0** | 11 章：C/C++ API、OverlayNG 鲁棒性、STRtree、PreparedGeometry、性能；与 JTS 教程"双视角" |
| JTS | Java 几何引擎、OGC 简单要素参考实现 | **在建**：24 章骨架 | **P0（收尾）** | 完成正文并提交；与 GeoTools/NTS/GEOS/Shapely 交叉引用 |
| S2 Geometry | 球面分层网格（Google 系） | 未覆盖 | P2 | 与 H3 合并"网格编码"专题 |
| H3 | 六边形分层网格索引 | 未覆盖（仅 gisfx 一句） | P2 | 并入"空间索引与网格编码"专题（H3+S2） |
| Boost.Geometry | 泛型 C++ 几何算法库 | 仅 CAD 教程提及 | P2 | "C++ GIS 开发"专题 1~2 章 |
| CGAL | 计算几何权威库（精确谓词/剖分/布尔） | 仅 CAD/PostGIS 零星提及 | P2 | 非 GIS 专用，SFCGAL/3D 布尔时作上游提及 |
| SFCGAL | 3D 几何/曲面运算（PostGIS 后端） | 间接覆盖：PostGIS 教程 3 章 | — | 不立项，PostGIS 第 14 章扩写 |
| libspatialindex | C++ R-tree 等空间索引 | 未覆盖 | P2 | 索引概念已在 Shapely/PostGIS 覆盖，性价比低 |
| Clipper2 | 2D 布尔/偏移 | **已覆盖**：sci/、cad/ 两套 | — | 不重复 |

> 结论：这一层是全站**最底层的结构性空白**。PROJ 与 GEOS 是"每套教程都依赖、但每套都没讲"的两个引擎，中文系统资料几乎为零；且二者与在建 JTS 一起，能组成"Java/C++/Python 三视角几何引擎矩阵"。

### B. 桌面 GIS 与空间分析平台

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **GRASS GIS** | 40 余年历史的栅格/矢量计算引擎，QGIS 的"重计算后端" | 仅 QGIS 教程第 10/13 章作为 Processing provider 提及 | **P0** | 12 章：区域/地图代数 → 地形水文 → 矢量拓扑 → temporal 时序 → Python API → 与 QGIS/PostGIS 联动 |
| OTB（Orfeo ToolBox） | CNES 的大规模遥感影像处理平台，OSGeo 官方项目 | 仅 ai 技能清单一句 | P1 | 10 章：Applications、正射/融合/分割/分类、SAR、Python API、QGIS 集成 |
| SNAP（ESA） | Sentinel/InSAR/时序分析的事实标准 | 未覆盖 | P1 | 8~10 章：Sentinel 数据、Graph Builder、GPT CLI、InSAR 基础；与 OTB 做选型对照 |
| WhiteboxTools | 500+ 地形/水文/栅格分析工具（Rust） | 仅 GeoLibre/技能清单提及 | P1 | 8~10 章：DEM 预处理、流向/汇流/流域、地形指标、Python/QGIS 调用 |
| GeoDa | 空间自相关（Moran/LISA）、空间聚类与回归的经典工具 | 未覆盖（早期 454 处为 GeoDataFrame 误匹配） | P1 | 8~12 章：权重矩阵、全局/局部 Moran、LISA、聚类、空间回归 |
| CloudCompare | 点云桌面交互处理事实标准 | 仅 ai 技能清单一句 | P1 | 8~10 章：配准（ICP）、裁剪分割、滤波法线、量测断面、CLI 脚本 |
| 3DCityDB + CityGML | CityGML 三维城市模型数据库（v5 支持 PostGIS） | 未覆盖（CityGML 仅格式层提及） | P1 | 8~10 章：LOD 概念、入库、SQL 查询、导出 3D Tiles、与 Cesium 对接 |
| SAGA GIS | 老牌桌面 GIS（地形/地统计强） | 仅 qgis 一处 | P2 | 价值低于 GRASS，可作 GRASS 教程对比章节 |
| QGIS 插件/Processing 深化 | — | QGIS 教程已有 20 章但插件开发偏浅 | — | 建议扩章而非新系列 |

> 不建议：uDig（约 2019 停更、仓库不可达）、gvSIG（萎缩）、ILWIS（约 2019 停更）、Kosmo（约 2015 停更）、OpenJUMP/MapWindow5（边缘）。

### C. 点云 / 摄影测量 / 三维生产

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **PDAL（+ Entwine）** | "点云界的 GDAL"：LAS/LAZ/EPT 读写、滤波、分类、Pipeline JSON | 间接覆盖：GeoLibre 17 章、QGIS 18 章应用层 | **P0** | 10~12 章：点云格式 → pdal 命令 → Pipeline → 滤波/地面分类 → 重投影 → Python → Entwine/EPT → 3D Tiles 集成 |
| **OpenDroneMap / WebODM** | 无人机影像 → 正射/DSM/点云/三维瓦片的开源全流程 | 未覆盖（0 命中） | **P0** | 10~12 章：航测基础 → 空三 → 正射/DSM 精度 → 点云/网格 → 3D Tiles → WebODM 平台 → 与 QGIS/Cesium 对接 |
| Potree | 海量点云 WebGL 浏览器查看（事实标准） | 仅 gis3d 白皮书一句 | P2 | Web 点云专题，归口 Cesium/前端，避免与 Entwine 重复 |
| osgEarth（+ OpenSceneGraph） | C++ 桌面/嵌入式三维地球 SDK（军工仿真、指挥大厅） | 未覆盖 | P1 | 10 章专题：地形/影像图层、倾斜摄影加载、坐标精度、性能、工程集成；与 Cesium 成"桌面/Web 双路线" |
| Meshroom / AliceVision | 图形化 SfM+MVS 三维重建 | 未覆盖 | P2 | 与 OpenSfM/COLMAP 合并"开源摄影测量"专题 |
| OpenSfM | Mapillary 的 SfM 引擎 | 未覆盖 | P2 | 同上（引擎层一章） |
| COLMAP | 通用 SfM/MVS 引擎 | 间接：3d/supersplat 已作 3DGS 前置提及 | P2 | 不独立成系列，摄影测量专题中一章 |
| py3dtiles | 点云/矢量转 3D Tiles 的 Python 小工具 | 未覆盖 | P2 | Cesium/PDAL 教程带一节 |
| Open3D | 通用三维处理/ML 库（非 GIS） | 仅技能清单提及 | P2 | 除非做"点云深度学习"，否则一句提及 |

### D. 服务端 / 发布 / 门户 / 元数据

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **MapServer** | 与 GeoServer 并列的 OGC 服务端（C 实现、mapfile 配置驱动） | 仅提及：geoserver/gdal/geopandas 对比表 | **P0** | 12 章：mapfile 语法、图层/样式/表达式/标注、WMS/WFS/WMTS、MapCache、安全、FastCGI/Docker 部署 |
| **GeoNode** | Django 空间数据 CMS（整合 GeoServer + pycsw + MapStore），平台层 | 仅提及（qgis、geoserver-cloud 1~2 处） | **P0** | 12~14 章：部署 → 数据上传发布 → 元数据/权限 → MapStore → GeoServer 联动 → REST API → 主题 → 生产运维 |
| QGIS Server | 用 QGIS 工程直接发布 WMS/WFS/WMTS（符号系统与桌面一致） | 部分覆盖：QGIS 教程 17.9 一节 | P1 | 独立 8~10 章：工程配置、FCGI/Docker、请求参数、SLD、多工程权限、性能 |
| MapProxy | WMS/WMTS/TMS 代理、缓存、重投影、多源合并（OSGeo 项目） | 未覆盖 | P1 | 8~10 章：yaml 配置、source/cache/grid、seed 与清理、S3/MBTiles 后端、重投影 |
| pygeoapi | OGC API 系列（Features/Tiles/Maps/Processes）的 Python 参考实现 | 未覆盖 | P1（高） | 10~12 章：OGC API 概念、provider（GeoJSON/PostGIS/栅格）、OpenAPI、部署鉴权、与 GeoServer 取舍 |
| GeoNetwork | 元数据目录（CSW/ISO 19115/DCAT/OAI-PMH） | 未覆盖 | P1 | 8 章：安装、模板、CSW、收割、权限、与 GeoServer/GeoNode 联动 |
| deegree | Java OGC 服务端（INSPIRE 合规强） | 未覆盖 | P2 | 1~2 篇对比文 |
| MapStore | 可配置 WebGIS 门户（React，常配 GeoServer/GeoNode） | 未覆盖 | P2 | 并入 GeoNode 教程 |
| geOrchestra | 一体化 SDI 套件（GeoServer+GeoNetwork+MapStore+网关） | 仅 geoserver-cloud 一处 | P2 | 门户选型对比文 |
| MapCache / GeoWebCache | WMS 瓦片缓存 | GWC 已内嵌 GeoServer 教程；MapCache 未覆盖 | P2 | MapCache 作 MapServer 配套章；GWC 不重复 |
| MapFish Print | 服务端地图打印/PDF 输出 | 未覆盖 | P2 | 3~5 章小专题（出图/报表真实需求） |
| Mapbender / istSOS / ZOO-Project / rasdaman | OSGeo 长尾（SDI 框架/传感器观测/WPS/栅格数组库） | 未覆盖 | P2 | 除非有行业需求，不单独立项 |

### E. 云原生 / 瓦片 / 大数据

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **STAC** | 时空资产目录规范（Item/Collection/Catalog），云原生影像的"索引层" | 仅提及：GeoLibre 20+ 处、geoserver-cloud 1 处 | **P0（组合）** | 与 COG/TiTiler 合成"云原生影像栈"12 章：规范 → 静态目录 → stac-fastapi → pgstac → STAC Browser → 鉴权 |
| **COG** | 云优化 GeoTIFF（OGC 正式标准 21-026） | 仅提及（rio-cogeo 2 处） | **P0（组合）** | 同上：COG 原理/生成/校验、对象存储、与 TiTiler/STAC 联动 |
| **TiTiler** | 动态瓦片渲染服务（COG/Zarr/STAC 后端） | 仅提及 3 处 | **P0（组合）** | 同上：部署、colormap/rescale、mosaic、缓存与性能 |
| PMTiles | 单文件瓦片归档（HTTP Range 直读，无需瓦片服务器） | 仅提及 19 个文件（GeoLibre 为主） | P1 | 并入"自建矢量瓦片"系列：生成、对象存储/CDN、MapLibre 消费 |
| Planetiler | OSM → 矢量瓦片（MBTiles/PMTiles）生产级构建器 | 未覆盖 | P1 | "自建矢量瓦片"系列核心：Profile、schema、增量更新 |
| Tippecanoe / Tilemaker / OpenMapTiles | GeoJSON 切片 / OSM PBF 轻量构建 / 瓦片 schema 与样式 | 未覆盖 | P1 | 与 Planetiler 合并为一个系列，按"轻量→生产"分工，不各开一套 |
| Martin | PostGIS/MBTiles/PMTiles 矢量瓦片服务（MapLibre 官方生态） | 仅提及（误命中） | P1 | 6~8 章专题：PostGIS 源、MBTiles/PMTiles、字体样式、缓存、部署 |
| pg_tileserv / Tegola / TileServer GL | PostGIS 直出 / Go / 多格式瓦片服务器 | pg_tileserv 仅提及 1 处 | P2 | "矢量瓦片服务端选型"专题 1~2 章，不各开系列 |
| Apache Sedona | Spark/Flink 上的分布式空间计算（Apache 顶级项目） | 仅提及（GeoLibre 引擎选项） | P1 | 10~12 章：Spark 集成 → Spatial SQL → GeoParquet → 分区调优 → SedonaDB → 与 DuckDB 分工 |
| GeoMesa | 分布式时空索引（HBase/Accumulo 等） | 未覆盖 | P2 | 受众窄、部署重，先 4~6 章专题试水 |
| GeoTrellis | Spark 上的分布式栅格与瓦片 | 仅 geotools 一处 | P2 | 已被 TiTiler/rio-tiler 轻量方案挤压，低优先 |
| Open Data Cube | 基于 PostGIS 的 ARD 影像数据立方体 | 未覆盖 | P2 | 6~8 章专题（科研/政府） |
| Overture Maps | 开放底图数据（Parquet 分布式存储） | 仅提及（GeoLibre 插件、GeoPandas 1 处） | P2 | 数据章节，与 OSM 数据栈做取舍对比 |
| Zarr / GeoParquet / GeoArrow / FlatGeobuf | 云原生数组与列式矢量格式 | 仅提及（GeoPandas 已讲读写） | P2 | 云原生格式专题 2~3 章，不必独立系列 |
| Mapnik | C++ 地图渲染引擎（TileServer GL/TileMill 底层） | 仅 geopandas 一处 | P2 | 渲染引擎对比章，不独立 |

### F. Web 前端 / 可视化

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **Leaflet** | 最流行的轻量 2D Web 地图库（约 46k star） | 仅提及/demo 级：115 处，无教程 | **P0** | 12~14 章：容器/坐标 → 瓦片与国内底图合规 → 矢量/GeoJSON → 标记弹窗 → 事件控件 → 插件生态 → WMS/WFS → Vue/React 集成 → 实战 |
| **MapLibre GL JS** | 矢量瓦片 WebGL 渲染的开源标准实现（Mapbox GL v1 社区 fork） | 间接覆盖：GeoLibre 教程 343 处，但只讲产品行为 | **P0** | 12~14 章：渲染管线 → style spec → source/layer → 表达式 → 3D 地形/挤出 → 插件 → 与瓦片服务对接 → 离线部署 → 性能 |
| deck.gl | GPU 大规模空间数据可视化（vis.gl 生态） | 仅提及（GeoLibre 82 处） | P1（高） | 10~12 章：图层体系 → 常用图层 → loaders.gl → TileLayer/MVT → COG/点云 → 与 MapLibre 集成 → 性能 |
| Turf.js | 前端 GeoJSON 空间分析标准库（约 11k star） | 仅提及（Cesium/OL 章节用过） | P1 | 8~10 章：GeoJSON 模型 → 度量 → 谓词 → buffer/overlay → 插值 → 与地图库集成 → Web Worker 性能 |
| Mars3D | 国产 Cesium 业务框架（国内三维项目常用） | 未覆盖 | P1 | 10~12 章：架构与 Cesium 关系 → 图层 → 标绘 → 漫游 → 空间分析 → 小部件 → Vue 工程化 |
| AntV L7 | 蚂蚁 WebGL 地理可视化引擎 | 未覆盖 | P1 | 8~10 章：图层/数据 → 热力/聚合/飞线 → 动态轨迹 → 与地图底图集成 |
| ECharts 地理可视化 | 国内大屏事实标准（geo/map 系列） | 间接：demos 大屏已用，无系统教学 | P1 | 6~8 章专题：geo 组件 → GeoJSON 注册 → scatter/lines/heatmap → 飞线迁徙 → 下钻联动 → 天地图叠加 → echarts-gl |
| maptalks | 国产二三维一体 WebGL 引擎 | 未覆盖 | P2 | 4~6 章专题（自定义投影/插件体系） |
| JSTS | JTS 的 JavaScript 移植（前端 buffer/overlay） | 未覆盖 | P2 | 6~8 章专题，与 JTS 教程同源 |
| proj4js / geotiff.js | 前端投影转换 / 浏览器 GeoTIFF/COG | 未覆盖（"proj4" 113 处为其他语境） | P2 | Leaflet/MapLibre/deck.gl 教程章节（各 4~6 章可独立） |
| ol-cesium | OpenLayers 与 Cesium 的 2D/3D 联动 | 仅提及 1 处 | P2 | 6~8 章（站点已有 OL + Cesium，缺"缝合层"） |
| Maputnik / GeoStyler | MapLibre 样式编辑器 / SLD 与 Mapbox Style 互转 | 未覆盖 | P2 | 分别并入 MapLibre、GeoServer 章节 |
| Kepler.gl | 地理数据分析工具（非开发库） | 仅提及 | — | 1 篇导读/案例，不做系列 |
| MapLibre Native / Mapsforge / flutter_map | 移动端渲染/离线地图 | 未覆盖 | P2 | 移动端专题观察；国内以商用 SDK 为主，受众有限 |

### G. 空间数据库 / 数据工程 / OSM / 路由 / 地理编码

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **DuckDB spatial** | 单机列式空间 SQL（DuckDB 官方一等扩展） | 间接覆盖：GeoLibre 第 11 章"平台内 SQL"、GeoPandas 8 章一段 | **P0** | 12~14 章：安装/CLI/Python → spatial 扩展 → ST_Read 全格式 → 空间连接 → GeoParquet/GeoArrow → 与 GeoPandas 互操作 → 性能 → WASM → 与 PostGIS/Sedona 选型 |
| **SpatiaLite** | SQLite 空间扩展：单文件空间数据库（端侧/离线/嵌入式首选） | 仅提及：QGIS/GeoPandas/GeoTools/SharpMap/GDAL 共 20 个文件 | **P0** | 12 章：几何/SRID → R-Tree → 空间 SQL → GeoPackage 关系 → 各语言接入 → 导入导出 → 移动端 → 与 PostGIS/DuckDB 选型 |
| **pgRouting** | PostGIS 上的图/网络分析（2024-12 毕业为 OSGeo 正式项目） | 仅提及：PostGIS 教程 3 行代码 | **P0** | 12~14 章：路网拓扑 → Dijkstra/A* → 等时圈 → TSP/VRP → 转向限制 → 与 OSM 数据栈联动 |
| OSM 数据栈（osm2pgsql + Osmium + Overpass） | OSM 原始数据 → PBF 处理 → PostGIS 落库 → 按需查询 | 未覆盖（仅 GeoLibre 一句） | P1（高） | 14~16 章"OSM 数据工程"：数据模型 → PBF 裁剪 → osmium → osm2pgsql flex output（新旧写法切换期）→ 增量更新 → Overpass QL → 抽取实战 |
| Nominatim | 基于 OSM 的自建地理编码/反地理编码服务 | 仅提及（GeoPandas 用公共实例、GeoLibre 一句） | P1 | 10~12 章：数据准备 → 安装/导入 → API → 地址层级 → 中文地址短板与补数 → 性能 → 与业务库联动 |
| OSRM / Valhalla | 高性能自建路由引擎（路线/矩阵/等时圈/多模式） | OSRM 未覆盖；Valhalla 仅"调公共实例" | P1 | 建议 12 章：OSRM 为主（预处理 → API → CH/MLD → 成本模型 → 部署），Valhalla 作姊妹篇或对比章 |
| GraphHopper / OpenTripPlanner | Java 路由引擎 / 公交多模式出行规划 | 未覆盖 | P2 | 路由选型章 / 公交 GIS 专题 |
| Pelias / Photon | Elasticsearch 系地理编码（多源/自动补全） | 提及/未覆盖 | P2 | Nominatim 教程对比章 |
| MobilityDB | PostgreSQL 移动对象/轨迹数据库（OSGeo 社区项目） | 未覆盖 | P2 | 8~10 章专题，与 movingpandas 对照 |
| H3 / S2 | 六边形/球面网格索引编码 | 未覆盖 | P2 | "空间索引与网格编码"专题（H3+S2+h3-pg 合并） |
| TimescaleDB | PostgreSQL 时序扩展（许可为 TSL，非纯开源） | 仅 geoserver-cloud 架构图 | P2 | 不建议做 GIS 教程（许可+定位） |
| GeoWave | 分布式时空索引 | 未覆盖 | — | 已停更（2024-11 后无提交），不建议 |

### H. 语言生态补全

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| **rasterio（+Fiona/pyogrio 对照）** | GDAL 之上的 Python 栅格读写与处理（含 rio CLI） | 仅提及：24 个文件 70 处 | **P0** | 13 章：数据集/波段 → 窗口读写 → 重投影/重采样 → mask/裁剪 → rio CLI → 与 GeoPandas/Shapely 互操作 → 性能 → 分区统计 |
| **xarray + rioxarray** | 带坐标标注的 N 维数组 + 地理栅格 CRS 扩展 | xarray 仅 3 文件 8 处、rioxarray 1 处 | **P0** | 10 章：DataArray/Dataset → NetCDF/Zarr → 索引/重采样 → rioxarray CRS/重投影 → 时间序列 → 与 Dask 并行 → 遥感/气候案例 |
| **OSMnx** | OSM 街道网络/POI/建筑足迹的下载、建模、分析 | 仅 GeoPandas 26 章一句 | **P0** | 12 章：v2 API → 路网类型/简化 → 可达性 → 街道方位/城市形态 → POI/建筑 → 可视化 → 与 NetworkX/GeoPandas 联动 |
| **PySAL** | 空间统计"全家桶"（权重/Moran/LISA/区域化/网络/形态/回归） | 仅 GeoPandas 26/27 章几句；spaghetti/tobler/momepy/spopt 全仓 0 | **P0** | 12 章：libpysal 权重 → esda Moran/LISA → spopt 区域化 → momepy 城市形态 → spaghetti 网络统计 → spreg 回归入门 |
| GeoAI 遥感（segment-geospatial/SamGeo + TorchGeo） | 遥感影像分割/地物提取与地理机器学习 | 仅 GeoLibre 功能罗列级提及 | P1 | 10 章实操专题：交互分割 → 批量矢量化 → TorchGeo 微调 → 精度评价 → 工程化 |
| movingpandas | 基于 GeoPandas 的轨迹分析 | 仅 2 文件 8 处 | P1 | 8 章专题：轨迹清洗 → 停留点 → 分割 → 可视化；与 MobilityDB 对照 |
| Apache SIS | Java 空间参考/单位/元数据标准库（Apache 顶级项目） | 几乎未覆盖 | P1（低） | 6~8 章专题，与 GeoTools/JTS 互补 |
| Hibernate Spatial | Java ORM 空间扩展 | **已覆盖**：PostGIS 第 17 章 | — | 不单独立项 |
| DotSpatial / GMap.NET / SharpKml | .NET 老牌 GIS 库/控件 | 提及；DotSpatial 2025-10 后停滞，GMap.NET fork 2023 停更 | — | 不建议（与 NTS/SharpMap/Mapsui 重叠且维护弱） |
| BruTile / MaxRev.Gdal.Core | .NET 瓦片库 / GDAL NuGet 封装 | **已覆盖**（Mapsui、SharpMap、GDAL 教程） | — | 不单独立项，可补版本矩阵小节 |
| R 空间生态（sf/terra/stars/tmap/lidR/spdep） | R 语言空间矢量/栅格/制图/统计/点云 | 仅 GeoPandas 一句对比 | P2（可升 P1） | 若补语言生态，做 12 章合并系列（不拆 7 个小教程） |
| Julia（GeoStats.jl/Rasters.jl） | Julia 地理统计与栅格 | 未覆盖 | P2 | 观察，可作"多语言 GIS 生态"综述一节 |
| Rust（geo/geozero/gdal-rs） | Rust 几何/格式/GDAL 绑定 | 未覆盖 | P2 | 6 章专题或综述 |
| Go（orb/go-geom） | Go 几何/矢量切片 | 未覆盖 | P2 | 1 篇深文（tegola/imposm 归服务端/OSM） |

### I. 移动端 / 外业采集

| 项目 | 一句话定位 | 站内现状 | 优先级 | 建议 |
|---|---|---|---|---|
| QField（+ Mergin Maps） | QGIS 移动端外业采集 | 未覆盖 | P2 | 与 QGIS 教程衔接的"外业采集"专题 6~8 章 |
| MapLibre Native / Mapsforge / flutter_map | 移动端渲染/离线地图库 | 未覆盖 | P2 | 观察；国内移动 GIS 以商用 SDK 为主 |
| ODK / KoboToolbox | 表单化外业数据采集 | 未覆盖 | P2 | 非 GIS 库，除非写行业方案文 |

---

## 四、优先级建议（立项顺序）

### 4.1 P0 第一批（8 项，建议先做）

| 序 | 项目 | 建议章数 | 站内现状 | 立项理由 |
|---:|---|---:|---|---|
| 1 | **[JTS](https://github.com/locationtech/jts)（收尾）** | 24（已有骨架） | 在建、未提交 | 已投入的沉没成本最高；且 nav/index/README 已在工作区挂出条目，半成品上线有风险；它是 GeoTools/NTS/GEOS/Shapely 的血统源头 |
| 2 | **[PROJ](https://proj.org)** | 14 | 间接覆盖，无教程 | 坐标系/投影是中国 GIS 最普遍的坑；全站几乎所有教程都依赖它，却无人系统讲；每章都能落到工程排障 |
| 3 | **[Leaflet](https://leafletjs.com)** | 12~14 | 仅 demo/对比表 | 轻量 2D 地图事实标准（约 46k star），中文资料与外包需求都极大；站点最缺的"高流量入门系列" |
| 4 | **[MapLibre GL JS](https://maplibre.org)** | 12~14 | GeoLibre 底层 | 矢量瓦片前端唯一主流开源实现（Mapbox GL v2 闭源后）；GeoLibre 教程整本以它为渲染引擎却没教它本身 |
| 5 | **[MapServer](https://mapserver.org)** | 12 | 仅对比表提及 | 与 GeoServer 并列的 OGC 服务端路线，mapfile 是独立知识体系；中文资料远少于 GeoServer，正好补"服务端全貌" |
| 6 | **[GRASS GIS](https://grass.osgeo.org)** | 12 | 仅 QGIS 教程提及 | OSGeo 旗舰桌面分析引擎，中文资料停留在旧教材；与 QGIS 教程形成"桌面双雄" |
| 7 | **[PDAL](https://pdal.io)** | 10~12 | 应用层提及 | 点云界的 GDAL，与现有 GDAL 教程同构（C++/CLI/Python 三接口）；站点点云处理完全空白 |
| 8 | **[DuckDB spatial](https://duckdb.org/docs/stable/core_extensions/spatial/overview)** | 12~14 | GeoLibre 包着讲 | 当前最热的分析型数据库，spatial 是官方一等扩展；站内唯一入口被"平台 UI"包住，读者学不到通用用法 |

### 4.2 P0 第二批（10 项，建议紧随其后）

| 序 | 项目 | 建议章数 | 立项理由 |
|---:|---|---:|---|
| 9 | **[GEOS](https://libgeos.org)** | 11 | 与 JTS 形成 Java/C++ "双视角几何引擎"；PostGIS/Shapely/QGIS 的几何内核，中文教程空白 |
| 10 | **[GeoNode](https://geonode.org)** | 12~14 | 平台层缺口：把 GeoServer 三套教程接成"给非专业用户用的产品"；政务/自然资源场景常见 |
| 11 | **[OpenDroneMap / WebODM](https://opendronemap.org)** | 10~12 | 无人机 → 正射/DSM/点云/3D Tiles 全流程；实景三维中国/应急测绘热点，中文系统教程极少 |
| 12 | **[SpatiaLite](https://www.gaia-gis.it/fossil/libspatialite)** | 10~12 | 端侧轻量空间库，与 PostGIS 互补；站内已"顺带提到 20 个文件"却没有入口（知识断点） |
| 13 | **[pgRouting](https://pgrouting.org)** | 12~14 | PostGIS 教程只留 3 行；中文物流/应急/公交/选址需求强；2024-12 刚成为 OSGeo 正式项目 |
| 14 | **[rasterio](https://rasterio.readthedocs.io)** | 13 | Python 线"有矢量无栅格"的断点；与 GeoPandas 教程直接衔接 |
| 15 | **[xarray](https://xarray.dev) + [rioxarray](https://corteva.github.io/rioxarray)** | 10 | 多维栅格（NetCDF/Zarr）标准数据模型；GDAL/GeoLibre 已引用但无教学 |
| 16 | **[OSMnx](https://osmnx.readthedocs.io)** | 12 | 街道网络/城市形态分析；站点零 OSM 主题；与 OSM 数据栈分工（OSMnx 偏分析） |
| 17 | **[PySAL](https://pysal.org)** | 12 | 空间统计/空间计量；GeoPandas 不做统计推断，规划/地理/经济地理读者刚需 |
| 18 | **[STAC](https://stacspec.org) + [COG](https://cogeotiff.github.io) + [TiTiler](https://developmentseed.org/titiler/)**（云原生影像栈） | 12 | 影像云原生全链路；站内"客户端大量用、服务端零教程"；COG 已是 OGC 正式标准 |

> 说明：第 14~17 项同属"Python 数据栈补全"，可按季度连排，形成与 GeoPandas/Shapely 衔接的"Python GIS 六件套"；第 18 项可拆成"STAC 与云原生影像""自建矢量瓦片"两个专题。

### 4.3 P1（下一批，约 20 项）

Web/可视化：**deck.gl**（GPU 可视化）、**Turf.js**（前端空间分析）、**Mars3D**（国产 Cesium 业务框架）、**AntV L7**、**ECharts 地理可视化**（专题）。

桌面/遥感/三维：**OTB**、**SNAP**、**CloudCompare**、**WhiteboxTools**、**GeoDa**、**3DCityDB + CityGML**、**osgEarth**。

服务端/平台：**QGIS Server**、**MapProxy**、**GeoNetwork**、**pygeoapi**（高优先）、MapFish Print（小专题）。

云原生/瓦片：**"自建矢量瓦片"组合**（Planetiler + Tippecanoe + Tilemaker + OpenMapTiles + PMTiles）、**Martin**（+ pg_tileserv/Tegola/TileServer GL 选型）、**Apache Sedona**。

数据工程：**OSM 数据栈**（osm2pgsql + Osmium + Overpass）、**Nominatim**、**OSRM**（+ Valhalla 姊妹篇）。

语言/专题：**GeoAI 遥感**（segment-geospatial/TorchGeo）、**movingpandas**、**Apache SIS**、**R 空间生态**（可选）。

### 4.4 P2（观察 / 单篇专题，约 30 项）

H3、S2、Boost.Geometry、CGAL、libspatialindex、GeoAPI、deegree、MapStore、geOrchestra、pycsw、MapCache、Mapbender/istSOS/ZOO-Project/rasdaman、Mapnik、pg_tileserv/Tegola/TileServer GL、GeoMesa、GeoTrellis、Open Data Cube、Overture Maps、Zarr/GeoParquet/GeoArrow/FlatGeobuf、Potree、Meshroom/OpenSfM/COLMAP、py3dtiles、Open3D、maptalks、JSTS、proj4js、geotiff.js、ol-cesium、Maputnik/GeoStyler、MapLibre Native/Mapsforge/flutter_map、QField/Mergin、MobilityDB、GraphHopper、OpenTripPlanner、Pelias/Photon、Cartopy、leafmap/ipyleaflet、Lonboard/dask-geopandas、exactextract/rasterstats、Julia/Rust/Go 生态、OSGeoLive 导览。

### 4.5 不建议立项（已衰落 / 商业 / 定位不符）

| 项目 | 原因 |
|---|---|
| uDig、gvSIG、ILWIS、Kosmo、OpenJUMP、MapWindow5 | 停更/萎缩/边缘，功能已被 QGIS/GRASS 覆盖 |
| GeoWave、TileCache、pygeos | 停更/已被取代（pygeos 已并入 Shapely 2） |
| Mapbox GL JS v2+、Google Earth Engine、SuperMap、ArcGIS、天地图 API | 商业闭源或纯在线服务（GEE 可作 openEO 对照） |
| Kepler.gl | 分析工具而非开发库，1 篇导读即可 |
| XbsjEarth/EarthSDK、DC-SDK | 停更/低活跃（可在 Mars3D 教程对比章一句） |
| OsmAnd、Organic Maps | GPL 导航应用而非开发库 |
| TimescaleDB | 许可为 TSL（非纯开源），定位偏时序而非 GIS |
| MySQL/ClickHouse/Redis/Valkey/Neo4j 地理能力 | 非 GIS 主力，选型文中一句带过 |
| DotSpatial、GMap.NET、SharpKml | .NET 维护停滞，且与现有 NTS/SharpMap/Mapsui 重叠 |
| Wherobots、Baremaps（观察） | 商业托管 / Apache 孵化中，成熟度不足 |
| Imposm、BRouter | 生态明显偏向 osm2pgsql/OSRM，不单独立项 |

---

## 五、组合系列与横向专题建议

**组合系列（避免"一库一教程"碎片化）**：
1. **矢量瓦片全链路**：Planetiler/OpenMapTiles（造）→ PMTiles（存/分发）→ Martin（服务）→ MapLibre GL JS（前端消费）。四个项目合成 18~20 章，比各自单开更有价值。
2. **云原生影像栈**：STAC（编目）→ COG（存储）→ TiTiler（动态渲染）→ TiTiler/STAC 前端（浏览）。
3. **OSM 数据工程**：Osmium/osm2pgsql（入库）→ Overpass（抽取）→ Nominatim（地理编码）→ OSRM（路由）→ OSMnx（分析）。
4. **无人机 → 三维成果**：ODM/WebODM（生产）→ PDAL（点云处理）→ osgEarth/Cesium（呈现）→ 3D Tiles。
5. **Python 数据栈**：rasterio → xarray/rioxarray → OSMnx → PySAL → movingpandas（GeoAI 作选修）。

**横向专题（建议放 `gis/basic` 或现有教程补章，不占系列名额）**：
- **国内底图合规与 GCJ-02 偏移**：Leaflet/MapLibre/OpenLayers/Cesium 每套都要用，目前 GeoLibre 只有半页；建议统一成一篇基础文，各教程引用。
- **OGC 标准演进**：WMS/WFS → OGC API（pygeoapi）→ STAC；`gis/basic/services` 已有概念层，补"代际关系"即可。
- **云原生格式**：COG/GeoParquet/GeoArrow/FlatGeobuf/PMTiles/Zarr——在 GeoPandas 教程补章 + 云原生系列导论。
- **开源 GIS 选型地图 / OSGeoLive 导览**：一篇文章把 OSGeo 项目全景与"什么场景选什么"讲清，作为全部教程的索引页。
- **JTS 博客翻译与教程的互链**：`lin-ear-th-inking` 32 篇算法文章与 JTS/GEOS 教程互链，价值会被放大。

---

## 六、落地建议（结合仓库规范）

1. **先处理 JTS**：完成 24 章正文 → `node scripts/check-style-consistency.js` + `check-internal-links.js` → 提交 `gis/tutorial/jts/`、`_data/navigation.yml`、`gis/tutorial/index.md`、`README.md` 四处改动。若暂不完成，先回退三个文件中的 JTS 条目（目录未跟踪，不影响构建）。
2. **新系列用脚手架**：`node scripts/new-tutorial.js --dir gis/tutorial/<name> --title "<标题>" --chapters <N> --nav gis`，再按 CONTRIBUTING 写正文（front matter、唯一 H1、`.chapter-nav`、站内链接用完整域名）。
3. **节奏建议**：现有 21 套平均 16 章；按"每季度 2~3 套新系列 + 1 个组合专题"的节奏，P0 两批 18 项约需 6~8 个季度，可在过程中按读者反馈调整。
4. **交叉引用**：新教程开头写明"前置阅读"（如 PROJ ← GDAL 第 6 章 / GeoPandas 第 6 章），结尾写"延伸阅读"；避免与既有教程重复讲同一操作（如 QGIS Server 只讲部署与请求，不讲 QGIS 桌面操作）。
5. **数据来源**：各笔记中的 star 数为 2026-11-11 量级值，正式写教程引言时建议以官方文档版本为准，不写 star 数字。

---

## 七、附录

### A. 本次调研的判定统计

| 类别 | 数量（约） | 说明 |
|---|---:|---|
| 调研候选项目 | 130+ | 覆盖桌面、三维、摄影测量、遥感、Web 前端、服务端、云原生、数据库、OSM、语言生态 |
| 建议 P0 | 18 | 第一批 8 + 第二批 10 |
| 建议 P1 | 20+ | 重点专题或 8~12 章系列 |
| 建议 P2 | 30+ | 观察/单篇/合并章节 |
| 不建议 | 20+ | 停更、商业、定位不符 |
| 站内"仅提及但无入口"的项目 | 15+ | SpatiaLite、PROJ、GEOS、MapServer、GeoNode、pgRouting、Valhalla、STAC、PMTiles、rasterio 等 |

### B. 调研方法与底稿索引

- 仓库扫描：对 1,579 个 Markdown 文件做关键词边界匹配（排除 `<h3>`、`bitmap`、`terrain`、`GeoDataFrame` 等误匹配），区分"独立教程/间接覆盖/仅提及/未覆盖"；脚本见 [coverage-check.sh](coverage-check.sh)、[patterns.txt](patterns.txt)。
- 五份方向笔记：[desktop-3d.md](desktop-3d.md)（桌面/三维/摄影测量/遥感）、[web-frontend.md](web-frontend.md)（Web 前端/移动端/国产引擎）、[server-cloud.md](server-cloud.md)（服务端/瓦片/门户/云原生）、[spatial-db-osm.md](spatial-db-osm.md)（空间数据库/大数据/OSM/路由/地理编码）、[libs-langs.md](libs-langs.md)（核心引擎与各语言库）。
- 星数与活跃度缓存：[stars-cache.json](stars-cache.json)（GitHub API/ungh 抓取，2026-11-11；shields.io 四舍五入值仅作量级参考）。
- 主要参考来源：[OSGeo Projects](https://www.osgeo.org/projects/)（项目身份）、[Awesome Geospatial](https://github.com/sacridini/Awesome-Geospatial) 与 [Awesome GIS](https://github.com/sshuair/awesome-gis)（全景清单）、[GitHub topic: geospatial](https://github.com/topics/geospatial)（主流度排序）、各项目官网与 GitHub 仓库（见五份笔记明细表）。

### C. 待复核事项（写教程前建议确认）

1. OSGeo 项目/社区项目/孵化徽标等级（官网项目页为 JS 渲染，本次未能全量核对）。
2. 停更项目的准确年份（uDig/ILWIS/gvSIG/Kosmo/TileCache/GeoWave 等）。
3. 部分仓库更名/迁移：geemap、ArchGDAL.jl、rasterstats、SFCGAL（GitHub 为镜像，主仓在 GitLab）、Baremaps。
4. DuckDB 版本线（shields 与文档版本号存在出入）、SpatiaLite 维护者交接传闻、Mars3D 许可证。
5. 中文需求强度：建议用百度/微信指数校准 P0/P1 排序（本次为领域常识判断）。

---

*报告完。五份方向笔记为本次分析的原始依据，可单独查阅。*
