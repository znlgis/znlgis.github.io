# 调研笔记：地图服务端 / 瓦片服务 / 门户目录 / 云原生与 OGC API

> 调研员：servercloud｜共享任务：task-3｜日期：2026-11-11
> 仓库：`D:\self\code\znlgis.github.io`，`gis/tutorial` 现有 21 套教程 + `jts`（24 章正文"撰写中"，按在建处理）。
> 口径说明：star 数取自 shields.io 的 `/github/stars/<owner>/<repo>.json`（缓存值，非精确）；活跃度取自 `/github/last-commit`（相对日期按 2026-11-11 口语化表述）。GitHub API 仅用于 STAC tag（v1.1.0）与 pygeoapi release（0.24.0）两处。

## 结论速览

- **P0（建议优先成系列，10+ 章）**：**GeoNode**（门户/内容管理系统，站在现有 GeoServer 之上，中文圈最缺的一块）、**MapServer**（与 GeoServer 并列的 OGC 服务端，mapfile 是独立知识体系）、**pygeoapi**（OGC API 系标准的 Python 参考实现，OGC 合规认证）、**QGIS Server**（QGIS 工程直发 WMS/WFS/WMTS，现有 QGIS 教程仅 17.9 一节）、**云原生影像/目录栈：STAC + COG + TiTiler + PMTiles**（建议拆成 "STAC 与云原生影像" 与 "PMTiles/矢量瓦片构建" 两个专题或一个 15+ 章系列）。
- **P1（值得做 8-12 章或重点专题）**：**MapProxy**（代理+缓存+重投影，OSGeo 项目）、**GeoNetwork**（元数据目录 CSW/ISO 19115/DCAT）、**Martin / pg_tileserv / Tegola / TileServer GL**（矢量瓦片服务，按语言栈选 1-2 个）、**Planetiler + Tippecanoe + Tilemaker + OpenMapTiles**（从 OSM 自建矢量瓦片）、**Mapnik**（渲染引擎，MapServer/TileServer GL 的底层）、**Apache Sedona / GeoMesa / GeoTrellis**（分布式与大数据 GIS，只做服务端/引擎视角）。
- **P2（专题文章或按需再评估）**：deegree、MapStore、geOrchestra、ldproxy、GeoBlacklight、pycsw、MapFish Print、MapCache、GeoWebCache（已内嵌 GeoServer 教程）、Baremaps、Zarr、GeoParquet/GeoArrow、Overture Maps、CKAN 地理扩展。

## 明细表

| 项目 | 类别 | 官网/GitHub | License | 主流度证据 | 一句话定位 | 仓库覆盖状态 | 优先级 | 与现有教程的关系/建议 |
|---|---|---|---|---|---|---|---|---|
| GeoNode | 门户/内容管理 | geonode.org / GeoNode/geonode | GPL-3.0 | OSGeo 项目；1.7k star；last-commit yesterday；官方 README 明确 "geospatial content management system" | 基于 Django 的空间数据 CMS，整合 GeoServer + pycsw + MapStore，做数据上传/元数据/地图/权限/分享 | **仅提及**：qgis/第04章 与 geoserver-cloud/第01、05章 各 1-2 处 | **P0** | 它是现有 GeoServer 教程的"上层产品"：GeoServer 讲引擎，GeoNode 讲平台。建议 12-14 章：安装（Docker）、数据集上传与发布、元数据与权限、MapStore 地图、GeoServer 联动、REST API、主题与模板、生产部署 |
| MapServer | 地图服务端 | mapserver.org / MapServer/MapServer | MIT（类 X/MIT） | OSGeo 项目；1.2k star；last-commit yesterday；README "system for developing web-based GIS applications" | C 实现的 OGC 服务端（WMS/WFS/WCS/WMTS），mapfile 配置驱动，轻量高性能 | **仅提及**：geoserver/第01章 1.5.2 对比表、gdal/第01章 生态图、geopandas/第01章 一句 | **P0** | 与 GeoServer 并列的另一条服务端路线，中文资料远少于 GeoServer。建议 12 章：mapfile 语法、图层/样式（CLASS/STYLE）、表达式与标注、WMS/WFS/WMTS、MapCache 配合、安全、FastCGI 部署、与 GDAL/PostGIS 数据源 |
| pygeoapi | OGC API | pygeoapi.io / geopython/pygeoapi | MIT | 0.24.0（2026）；633 star；last-commit last friday；官网自称 OGC 合规认证 + OGC Reference Implementation | Python 实现的 OGC API（Features/Tiles/Maps/Processes/Coverages）服务端，插件化 provider | **未覆盖**（0 处） | **P0** | 纯 Python 栈，与 GeoPandas/Shapely 路线天然衔接；OGC API 是 WMS/WFS 之后的新标准，中文教程几乎空白。建议 10-12 章：核心概念、provider 配置、Features/Tiles/Maps、Processes、部署、与 GeoServer 对比 |
| QGIS Server | 地图服务端 | qgis.org / qgis/QGIS（server 子模块） | GPL-2.0 | QGIS 15k star；last-commit yesterday；QGIS 官方组件 | 用 .qgs/.qgz 工程直接发布 WMS/WFS/WMTS，符号系统与桌面端一致 | **部分覆盖**：qgis/第17章 17.9 仅一节，另有第02章 Docker 片段 | **P0** | 现有 QGIS 教程把 Server 当附属品，实际是"会 QGIS 就会发布"的低成本路径。建议独立 10 章或扩为 6-8 章专题：工程配置、FCGI/Docker、WMS/WFS/WMTS 参数、SLD、权限与多工程、性能 |
| STAC | 云原生目录标准 | stacspec.org / radiantearth/stac-spec | Apache-2.0 | 规范最新 v1.1.0；stac-browser 436 star、stac-fastapi 327 star、pgstac 229 star；last-commit 均活跃 | 时空资产目录规范（Item/Collection/Catalog），影像与云原生数据的"索引层" | **仅提及**：GeoLibre 约 20+ 处（第05/16/20章）、geoserver-cloud 第10章 1 处 | **P0** | 站点已有大量"用 STAC 取数"的提及，却没有"怎么建 STAC 服务"的教程。建议专题 10 章：规范、静态目录、stac-fastapi、pgstac、STAC Browser、与 COG/TiTiler 联动 |
| COG / TiTiler | 云原生影像服务 | cogeotiff.github.io / developmentseed/titiler | MIT / BSD-3 | COG 已是 **OGC 正式标准 1.0（doc 21-026）**；rio-cogeo 398 star；TiTiler 1.2k star、last-commit last monday | COG=云优化 GeoTIFF；TiTiler=动态瓦片渲染服务（COG/Zarr/STAC 后端） | **仅提及**：rio-cogeo 2 处（GeoLibre 第02/12章）；TiTiler 3 处（GeoLibre 第05/08/26章） | **P0** | 与 STAC 合成"云原生影像栈"系列；GeoLibre 教程只讲"客户端怎么用"，缺"服务端怎么搭"。建议 10-12 章：COG 原理/生成、TiTiler 部署与 API、colormap/rescale、mosaic、STAC 后端、性能与缓存 |
| PMTiles | 瓦片归档格式 | protomaps.com/docs/pmtiles / protomaps/PMTiles | BSD-3 | 3.1k star；last-commit september；被 GeoLibre/MapLibre 生态广泛采用 | 单文件瓦片档案，HTTP Range 直接读，无需瓦片服务器 | **仅提及**：19 个文件（GeoLibre 多章、geoserver-cloud 第01章） | **P0**（并入瓦片系列） | GeoLibre 教程已讲"用 PMTiles"，缺"造 PMTiles/自托管"。建议与 Planetiler 合成"自建矢量瓦片"系列：OSM 抽取→Planetiler→PMTiles→对象存储/CDN |
| MapProxy | 瓦片缓存/代理 | mapproxy.org / mapproxy/mapproxy | Apache-2.0 | OSGeo 项目；677 star；last-commit last saturday；官网明确 tile cache/proxy 定位 | WMS/WMTS/TMS 代理、缓存、重投影、多源合并，把老旧服务加速成瓦片 | **未覆盖**（0 处） | **P1** | 国内"服务聚合+缓存加速"刚需，且能与 GeoServer/MapServer/ArcGIS 服务混用。建议 8-10 章：配置结构（yaml）、source/cache/grid、种子与清理、S3/MBTiles 后端、重投影、安全 |
| GeoNetwork | 元数据目录 | geonetwork-opensource.org / geonetwork/core-geonetwork | GPL-2.0 | OSGeo 项目；525 star；last-commit last monday；README 支持 CSW 2.0.2 / ISO 1911x / DCAT-AP / OAI-PMH | 元数据编目与发现平台，CSW 服务，支持收割与多语言 | **未覆盖**（0 处） | **P1** | 政务/自然资源信息化场景高频，中文教程少。建议 8 章：安装、元数据模板、CSW、收割、权限、与 GeoServer/GeoNode 联动、DCAT |
| Martin | 矢量瓦片服务 | maplibre.org/martin / maplibre/martin | Apache-2.0 / MIT（双） | 4.1k star（本组最高）；last-commit yesterday | Rust 写的 PostGIS/MBTiles/PMTiles 瓦片服务，MapLibre 生态官方项目 | **仅提及**：geopandas/第01章 "Martin" 一词（疑为人名） | **P1** | 与 PostGIS 教程天然衔接（PostGIS 已讲到 pg_tileserv 一句）。建议 8 章专题：PostGIS 源、MBTiles/PMTiles 源、样式与字体、缓存、部署 |
| pg_tileserv / Tegola / TileServer GL | 瓦片服务 | CrunchyData/pg_tileserv、go-spatial/tegola、maptiler/tileserver-gl | Apache-2.0 / MIT / BSD-3 | 1.1k / 1.5k / 2.9k star；pg_tileserv last-commit 2025-12（略缓）、Tegola september、TileServer GL november | 分别对应 PostGIS 直出、Go 语言、多格式瓦片服务器 | **仅提及**：pg_tileserv 1 处（postgis/第01章 生态图） | **P1** | 不必每个都成系列；建议"矢量瓦片服务端选型"专题 + 以 Martin 为主样例，pg_tileserv 作为 PostGIS 章节延伸 |
| Planetiler | 矢量瓦片构建 | onthegomap/planetiler | Apache-2.0 | 2.2k star；last-commit today | Java 写的 OSM→矢量瓦片（MBTiles/PMTiles）构建器，内存/磁盘 Profile 化 | **未覆盖**（0 处） | **P1** | "自建底图"系列核心，配合 OpenMapTiles schema。建议与 PMTiles/Tilemaker 合成 10 章：数据源、Profile、schema、增量更新、PMTiles 输出、部署 |
| Tippecanoe / Tilemaker / OpenMapTiles | 瓦片构建/规格 | felt/tippecanoe、systemed/tilemaker、openmaptiles/openmaptiles | BSD-2 / BSD-3 / BSD-3 | 1.6k / 1.9k / 3.2k star；均活跃（august / november / july） | Tippecanoe=GeoJSON→矢量瓦片；Tilemaker=OSM PBF→瓦片；OpenMapTiles=瓦片 schema 与样式 | **未覆盖**（0 处） | **P1** | 与 Planetiler 同一系列按"轻量/生产"分工写，不必各开一套 |
| Mapnik | 渲染引擎 | mapnik.org / mapnik/mapnik | LGPL-2.1 | 4k star；last-commit last sunday | C++ 地图渲染引擎，MapServer 之外的另一条渲染路线，TileServer GL/TileMill 底层 | **仅提及**：1 处（geopandas/第21章 "contextily … Mapnik" 样式名） | **P1** | 偏底层，建议作为"地图渲染引擎对比"专题的一章，或与 TileServer GL 合并 |
| Apache Sedona | 分布式空间计算 | sedona.apache.org / apache/sedona | Apache-2.0 | Apache 顶级项目；2.4k star；last-commit yesterday | Spark/Flink 上的分布式空间计算引擎 | **仅提及**：8 处（GeoLibre 相关章节） | **P1** | 大数据方向但属"引擎"视角；建议 8-10 章专题：SpatiaLite/Spark、空间分区、SQL 空间函数、与 PostGIS 分工。与数据库方向队友可能有重叠，只写引擎侧 |
| GeoMesa | 分布式时空索引 | geomesa.org / locationtech/geomesa | Apache-2.0 | Eclipse 基金会；1.5k star；last-commit yesterday | 基于 HBase/Accumulo/Kafka 的时空索引与查询 | **未覆盖**（0 处） | **P2→P1 边缘** | 受众窄但无替代，建议先做 4-6 章专题试水 |
| GeoTrellis | 分布式栅格 | geotrellis.io / locationtech/geotrellis | Apache-2.0 | 1.4k star；last-commit last thursday | Spark 上的栅格处理与瓦片服务 | **仅提及**：1 处（GeoTools 第01章） | **P2** | 与 TiTiler/COG 有竞争关系，优先 TiTiler |
| deegree | 地图服务端 | deegree.org / deegree/deegree3 | LGPL-2.1 | OSGeo 项目；170 star；last-commit november | Java 的 OGC 标准服务端，INSPIRE 合规强 | **未覆盖**（0 处） | **P2** | 国内使用少，主要价值在 INSPIRE 场景；可写 1-2 篇对比文 |
| MapStore | Web GIS 前端/门户 | geosolutions.it / geosolutions-it/MapStore2 | BSD-3 | 670 star；last-commit yesterday | 可配置的 Web GIS 门户框架（React），常与 GeoServer/GeoNode 搭配 | **未覆盖**（0 处） | **P2** | 前端方向，可能与前端队友重叠；GeoNode 章节里顺带讲即可 |
| geOrchestra | 空间数据基础设施 | georchestra.org / georchestra/georchestra | GPL-3.0 | 147 star；last-commit october；GeoServer Cloud 第05章 提及其 Gateway | 一体化 SDI 套件（GeoServer+GeoNetwork+MapStore+安全网关） | **仅提及**：geoserver-cloud/第05章 1 处 | **P2** | 面向政府 SDI，受众窄；可在 GeoNetwork/GeoNode 章节做对比 |
| ldproxy | OGC API 服务端 | ldproxy.net / interactive-instruments/ldproxy | MPL-2.0 | 107 star；last-commit last friday；OGC API Features 参考实现（官方 README 自述）+ OGC Reference Implementation | Java 的 OGC API 全套实现，支持 PostGIS/GeoPackage/WFS 源 | **未覆盖**（0 处） | **P2** | 与 pygeoapi 同类，中文受众更小；建议作为 pygeoapi 对比对象 |
| GeoBlacklight | 地理发现门户 | geoblacklight.org / geoblacklight/geoblacklight | Apache-2.0 | 154 star；last-commit yesterday | 基于 Blacklight/Solr 的地学资源发现门户（高校图书馆常用） | **未覆盖**（0 处） | **P2** | 场景偏图书馆/学术，可在 GeoNetwork 章节对比 |
| pycsw | CSW 目录 | pycsw.org / geopython/pycsw | MIT | OSGeo 项目；242 star；last-commit october | OGC CSW 目录服务，GeoNode 的元数据后端之一 | **未覆盖**（0 处） | **P2** | 单点功能，放在 GeoNetwork/GeoNode 章节讲即可，不必独立 |
| MapFish Print | 打印服务 | mapfish.org / mapfish/mapfish-print | GPL-3.0 | 199 star；last-commit yesterday | 服务端地图打印/PDF 输出（GeoServer 生态常用） | **未覆盖**（0 处） | **P2** | 真实需求存在（出图/报表），可做 3-5 章小专题 |
| MapCache / GeoWebCache | 瓦片缓存 | mapserver.org / MapServer/mapcache；geowebcache.osgeo.org | MIT / LGPL-3.0 | MapCache 152 star、last-commit october；GWC 已随 GeoServer 集成（17 文件提及） | WMS 瓦片缓存（MapCache 偏 MapServer，GWC 偏 GeoServer） | **部分覆盖**：GWC 在 geoserver 教程第04/08章已讲 | **P2** | MapCache 作为 MapServer 教程的配套章；GWC 不重复 |
| Baremaps | 矢量瓦片/OSM 工具链 | baremaps.apache.org / baremaps/baremaps | Apache-2.0 | 开源；last-commit september（star 数据抓取异常，未采信） | Java 的 OSM 瓦片流水线（PostGIS 导入 + 瓦片生成 + 前端库） | **未覆盖**（0 处） | **P2** | 仍在 Apache 孵化，成熟度待观察，先提一句 |
| Zarr | 云原生数组 | zarr.dev / zarr-developers/zarr-python | MIT | 2.1k star；last-commit yesterday；GeoLibre 13 文件提及 | 分块压缩数组格式，气候/多维栅格的云原生存储 | **仅提及**：13 处（GeoLibre、openlayers 等） | **P2** | 偏科学数据，可在云原生格式专题中做 2-3 章 |
| GeoParquet / GeoArrow | 云原生矢量 | geoparquet.org / flatgeobuf | Apache-2.0 | GeoParquet 25 文件提及、FlatGeobuf 25 文件提及；flatgeobuf 829 star、last-commit november | GeoParquet=列式矢量存储；GeoArrow=内存列式几何；FlatGeobuf=流式+空间索引单文件 | **仅提及**：geopandas 第07/08章已系统讲过读写 | **P2** | GeoPandas 教程已覆盖到"会用"，缺"作为服务端发布形态"（配合 PMTiles/对象存储），可在云原生系列补 |
| Overture Maps | 开放底图数据 | overturemaps.org | 数据 CC-BY / 工具 MIT | GeoLibre 4 文件提及；数据发布方为 Overture Maps Foundation | 融合 OSM/微软/Esri 等的开放地图数据集，Parquet 格式 | **仅提及**：GeoLibre 第01/03章、geopandas 第08章 | **P2** | 更像数据源而非软件，可在云原生数据章节做一节 |
| CKAN 地理扩展 | 开放数据门户 | ckan.org | AGPL-3.0 | CKAN 5.2k star、last-commit yesterday；GeoLibre/OpenLayers 多处提及 | 开放数据门户，地理扩展（geoview/资源预览）承载空间数据集 | **仅提及**：5 处（openlayers/geotools/geometry-api-net 等，均为泛提） | **P2** | 与 GeoNode 定位不同（通用开放数据 vs 空间 CMS），可在门户选型文对比 |

## 详细说明（P0/P1）

### P0

**GeoNode（门户/内容管理系统）**
站点已有 GeoServer 三套教程（单体、REST、Cloud），但"把 GeoServer 包成一个给非专业用户用的平台"这一层完全缺失。GeoNode 是 OSGeo 官方项目、官方 README 自述为 geospatial CMS，且它本身由 GeoServer + pycsw + MapStore 组成——正好把站点已有的 GeoServer 知识接到"平台产品"层面，中文 GIS 读者在政务/自然资源/应急场景最容易遇到它。建议章节：Docker 部署与初始化、数据集上传与发布流程、元数据（与 pycsw）、用户/组/权限、MapStore 地图与故事、GeoServer 联动与 OAuth2、REST API 自动化、主题定制、生产部署与备份。

**MapServer（地图服务端）**
GeoServer 之外的另一条主流 OGC 服务端路线，C 实现、mapfile 配置、资源占用低，README 明确"无需编程即可开发 Web GIS 应用"。现有教程只在 geoserver/第01章 做了一张对比表、gdal/第01章 提了生态位，属于"知道名字但不会用"。中文 MapServer 资料稀缺，且 mapfile 是独立的知识体系（LAYER/CLASS/STYLE/EXPRESSION/LABEL），适合做成 12 章系列，并与 GDAL 数据源、PostGIS、MapCache 串起来。

**pygeoapi（OGC API 服务端）**
OGC API 是 WMS/WFS 之后的新一代标准，pygeoapi 是 Python 参考实现（官网自述 OGC 合规 + Reference Implementation），0.24.0、633 star、持续活跃。站点 Python 路线（GeoPandas/Shapely/GeoPipeAgent）很强，却完全没有"用 Python 发布标准服务"的教程，这是明显的链路断点。建议 10-12 章：OGC API 家族概念、安装与配置、provider（GeoJSON/PostGIS/栅格）、Features/Tiles/Maps/Processes、OpenAPI、部署与鉴权、与 GeoServer 的取舍。

**QGIS Server（QGIS 工程直发服务）**
现有 QGIS 教程 17.9 只有一节，但"用桌面工程直接发布服务"是中文读者最省力的发布路径（符号系统、标注、打印布局全部复用）。建议独立 10 章或 6-8 章专题：工程与图层配置、FCGI 与 Docker 部署、WMS/WMTS/WFS 请求参数、SLD 与样式、多工程与权限、性能与缓存、与 QGIS Desktop 的协作流程。

**STAC + COG + TiTiler + PMTiles（云原生影像/瓦片栈）**
这四者是一个完整链路：STAC 编目、COG 存像素、TiTiler 动态出瓦片、PMTiles 做静态瓦片归档。证据很硬：COG 是 OGC 正式标准（doc 21-026），STAC 规范已到 v1.1.0，TiTiler 1.2k star、PMTiles 3.1k star 且都活跃。站点现状是"客户端大量用"（GeoLibre 教程 20+ 处、geoserver-cloud 提及）但"服务端零教程"。建议拆两个系列：①"STAC 与云原生影像"（规范、静态目录、stac-fastapi、pgstac、STAC Browser、TiTiler 渲染、mosaic、鉴权）；②"自建矢量瓦片"（Planetiler/Tippecanoe、PMTiles 输出、对象存储+CDN、MapLibre 消费）。

### P1

**MapProxy**
OSGeo 项目、677 star、README 定位"caches, accelerates and transforms data from existing map services"，支持 WMS/WMTS/TMS/ArcGIS 源、重投影、S3/MBTiles 后端。国内做服务聚合与加速时经常是首选，而站点 0 覆盖。建议 8-10 章：yaml 配置结构、source/cache/grid、种子（seed）与清理、后端存储、重投影、多源合并、安全与限流。

**GeoNetwork**
OSGeo 项目、525 star、README 列明 CSW 2.0.2 / ISO 1911x / DCAT-AP / OAI-PMH 支持，是元数据编目的事实标准级工具。中文政务 GIS 场景需求明确，建议 8 章：安装、元数据模板与编辑、CSW 检索、收割（harvesting）、权限、与 GeoServer/GeoNode 联动、DCAT 与目录互操作。

**Martin / pg_tileserv / Tegola / TileServer GL**
矢量瓦片服务端是"PostGIS→前端"的必经环节。Martin 4.1k star、MapLibre 官方生态、昨日提交，最值得作为主样例；pg_tileserv 与 PostGIS 教程直接衔接（现仅生态图一处）；Tegola/TileServer GL 作选型对比。建议一个"矢量瓦片服务端选型"专题（6-8 章）+ Martin 深度 8 章，避免四套重复教程。

**Planetiler + Tippecanoe + Tilemaker + OpenMapTiles**
"从 OSM 自建底图"是中文社区的长期刚需，这四个分别覆盖生产级构建、GeoJSON 快速切片、OSM PBF 轻量构建、瓦片 schema/样式。建议合并为一个 10 章系列，按"轻量（Tippecanoe/Tilemaker）→ 生产（Planetiler+OpenMapTiles）→ 输出 PMTiles/MBTiles → 部署"组织。

**Mapnik**
4k star、持续活跃，是 TileServer GL、TileMill 等渲染链路的核心。偏底层，不建议独立成篇，建议作为"地图渲染引擎对比"专题的一章（Mapnik vs MapServer vs GeoServer 渲染栈），或并入 TileServer GL 专题。

**Apache Sedona / GeoMesa / GeoTrellis**
三者都是"大数据/分布式"引擎视角，星数 2.4k/1.5k/1.4k 且活跃（Sedona/GeoMesa 昨日提交）。与数据库方向队友的范围可能重叠，建议只写"引擎侧"：分布式空间分区、SQL 空间函数在 Spark 上的行为、与 PostGIS 的边界。先做 Sedona（Apache 顶级项目、受众最广）8-10 章，GeoMesa/GeoTrellis 各做 4-6 章专题试水。

## 与站点已有基础文章的关系

`gis/basic/services/` 下已有《OGC标准地图服务协议总结》《切片简介》《其他地图服务协议》等概念性综述（不是服务端部署教程）。因此 P0/P1 新教程应统一：协议概念**不重复讲**，直接链接到 `/gis/basic/services/`，教程正文只讲"怎么装、怎么配、怎么发布、怎么调优"；反过来在基础文章里补新教程的链接。这样可以避免专题与基础篇内容打架。

## 已衰落 / 不建议清单

| 项目 | 状态 | 原因 |
|---|---|---|
| TileCache | 已停维护 | 最后提交 2014-12，35 star，被 MapProxy/内置瓦片缓存取代 |
| GeoWebCache（独立部署） | 已并入 | 已集成在 GeoServer 内，站点 geoserver 教程第04/08章已覆盖，不必单列 |
| GeoWave | 边缘化 | 528 star，last-commit november 仍活跃但生态萎缩、依赖 HBase/Accumulo 重，受众极窄，P2 之外不建议成系列 |
| Baremaps | 观察中 | Apache 孵化中，last-commit september，star 数据抓取异常（未采信）；成熟度不足，先不做系列 |
| pygeos | 已被取代 | 已并入 Shapely 2.0（站点 shapely 教程如未提可补一句，不属本方向） |
| Mapbox GL JS v2+ | 商业闭源 | 非开源，排除（MapLibre GL 为社区分叉，属前端方向） |
| Google Earth Engine / SuperMap / ArcGIS Online | 商业服务/闭源 | 排除；站点 GeoLibre 教程已讲到 Earth Engine 的"用"，但不宜做服务端教程 |

## 越界发现（不属本方向但值得团队注意）

- **数据库方向**：PostGIS 教程已讲 pg_tileserv 一句，建议那边补"PostGIS 作为瓦片源"的配置示例，与 Martin 专题互相链接。
- **前端方向**：MapLibre GL JS 是 PMTiles/Martin 的默认消费端，如果前端队友写 MapLibre，应与"自建矢量瓦片"系列交叉引用。
- **AI 方向**：GeoLibre 教程的 MCP/Agent 章节已出现 STAC/COG 能力，云原生系列可作为其"服务端补全"。
- **元数据/标准方向**：CSW（pycsw/GeoNetwork）与 OGC API 是两代目录标准，若有人写"OGC 标准演进"综述，本笔记的 STAC/COG 证据可直接复用。

## 不确定点 / 待核实

1. **STAC 1.1 的 OGC 采纳状态**：已确认规范 tag v1.1.0，但其是否已成为 OGC 正式标准未在本次核实（OGC API 家族与 STAC 关系建议写教程前再查一次）。
2. **GeoNode 的版本与组件清单**：README 确认其为 geospatial CMS 并依赖 GeoServer/pycsw/MapStore，但 2026 年具体版本号与是否仍默认 MapStore 未逐项核实。
3. **MapServer 许可证**：通用说法为 MIT 类（X/MIT），未逐字核对 LICENSE 文件。
4. **Baremaps star 数**：shields.io 返回 0，疑为仓库改名/缓存，未采信；如要推荐需重新核实。
5. **star 数均为 shields.io 缓存值**，可能滞后数天；GitHub API 匿名限流（60/小时，全队共享）本次仅用了 2 次（STAC tag、pygeoapi release）。
