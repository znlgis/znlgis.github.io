# 调研笔记：空间数据库扩展 / 时空大数据 / OSM 与路径规划地理编码栈

> 调研员：dbosm（task-5） ｜ 调研日期：2026-11-11 ｜ 仓库：znlgis.github.io
> 范围：空间数据库与扩展、时空大数据、OSM 数据栈、路由/导航、地理编码（不含 Web 前端、不含桌面 GIS 软件本体）
> 数据来源：项目官网/官方文档、GitHub（stars 与 pushedAt 取团队共享缓存 `docs/gap-analysis/stars-cache.json`，另对个别仓库用 shields.io 复核）、OSGeo 官网与 Wiki、项目发布记录。所有 star 数为 2026-11 上旬数值，仅作量级参考。

## 结论速览

- **P0（建议优先立项，3 个）**：SpatiaLite（单文件空间库，PostGIS 的轻量对照面）、DuckDB spatial（列式分析引擎，站内已多处引用但无系统教程）、pgRouting（站点 18 章 PostGIS 教程只顺带一句"CREATE EXTENSION pgrouting"，中文网络分析刚需）。
- **P1（值得做 10+ 章系列或重点专题，4 个）**：OSM 数据栈（osm2pgsql + Osmium + Overpass API 合并为一个"OSM 数据工程"系列）、Nominatim（自建地理编码服务）、OSRM / Valhalla（二选一或合并为"开源路由引擎"系列）、Apache Sedona（分布式空间分析，与 DuckDB 形成单机/集群对照）。
- **P2（可做重点专题，各自 3~6 章或一篇深文）**：MobilityDB、GeoMesa、GeoTrellis、GraphHopper、OpenTripPlanner、Pelias/Photon、Overture Maps 数据管道、H3/S2 网格索引、TimescaleDB（因站点已有 GeoServer Cloud 章节提及）。
- **不建议**：GeoWave（已归档/停更）、JOSM/iD/StreetComplete/Vespucci（OSM 编辑器，属桌面/Web 软件，与"系列教程"定位不符，只适合附录一句）、MySQL/ClickHouse/Redis/Valkey/Neo4j 的地理能力（非 GIS 主力，见"其他可提一句"）。

---

## 明细表

| 项目 | 类别 | 官网/GitHub | License | 主流度证据 | 一句话定位 | 仓库覆盖状态 | 优先级 | 与现有教程的关系/建议 |
|---|---|---|---|---|---|---|---|---|
| **SpatiaLite** | 空间数据库 | gaia-gis.it/fossil/libspatialite；SQLite 扩展 | MPL-1.1 / GPL-2.0 / LGPL-2.1 三重（详见官网） | SQLite 生态唯一的成熟空间扩展；Debian/Ubuntu 打包、QGIS/GeoTools/SharpMap/GDAL 均内置支持；当前版 5.1.0（2023-08），官网仍在维护（fossil 2025–2026 有 ticket）；**非 OSGeo 官网项目页所列项目**，随 OSGeoLive 分发；无官方 GitHub 仓库，star 不可比 | "一个 .sqlite 文件就是一张空间数据库"，嵌入式/桌面/移动端首选 | **仅提及**：QGIS 第 03/05/16/19 章、GeoPandas 第 09 章、GeoTools 第 09 章、SharpMap 第 06 章、GDAL 第 13 章、OpenGIS Skills 技能列表各有零散代码/表格；**无独立教程** | **P0** | 与 PostGIS 教程互补：PostGIS 是"服务端重型"，SpatiaLite 是"端上轻量"。站点已有大量"顺带提到 SpatiaLite"的断点，读者点进来找不到系统入口。建议 12~15 章：SQLite 基础→spatialite CLI/mod_spatialite 加载→几何与 SRID→空间索引 R-Tree→空间 SQL 函数→GeoPackage 与 SpatiaLite 的关系→QGIS/GDAL/GeoPandas/Java/.NET 各语言接入→导入导出 Shapefile/GeoJSON→虚拟表与外部数据→移动端（Android/iOS）打包→性能与并发→与 PostGIS 选型决策。**风险标注**：项目长期由 Alessandro Furieri 单人维护、官网界面陈旧、5.1.0 已 3 年未发新版，教程应在章节中如实写"选型边界"而非回避 |
| **DuckDB spatial** | 空间数据库/分析引擎 | duckdb.org/docs/stable/core_extensions/spatial/overview.html；github.com/duckdb/duckdb-spatial | MIT（DuckDB 本体与扩展仓库均 MIT） | DuckDB 本体 **42,953★**（2026-11，pushed 2026-11-09）为当前最热分析数据库之一；spatial 是官方一等扩展（随 DuckDB 版本发布，文档独立成章，DuckDB 1.5 起 GEOMETRY 类型与坐标轴顺序有破坏性变更）；被 GeoLibre/DuckDB-WASM、geopandas 生态、GeoParquet 工具链广泛依赖；扩展仓库自身 723★（仅扩展代码仓，不代表主流度） | 单机列式空间 SQL：直读 Shapefile/GeoParquet/GeoJSON，ST_* 函数 + Arrow 零拷贝 | **间接覆盖**：GeoLibre 第 11 章讲"平台内 DuckDB SQL 工作区"（WASM 形态、面向 GeoLibre 操作）；GeoPandas 第 08 章 8.8.3 演示 DuckDB 读 GeoParquet；giszj 第 05 章工具链表列了 DuckDB spatial；**无独立教程** | **P0** | 站点唯一"分析型空间 SQL"入口被 GeoLibre 教程"包着讲"，读者离开 GeoLibre 就学不到通用用法。建议 12~14 章：安装/CLI/Python/R 接入→spatial 扩展加载与 GEOMETRY 类型→ST_Read 全家桶（Shapefile/GeoJSON/GPKG/GeoParquet）→空间连接与分析→GeoParquet/GeoArrow 输出→与 GeoPandas/Arrow 互操作→DuckDB vs PostGIS vs Sedona 选型→性能调优（线程、内存、分区）→WASM 浏览器端（对齐 GeoLibre）→1.5 坐标轴变更迁移 |
| **pgRouting** | 空间数据库扩展 | pgrouting.org；github.com/pgRouting/pgrouting | GPL-2.0 | **1,447★**（pushed 2026-11-09）；**2024-12 从 OSGeo 孵化毕业成为 OSGeo 正式项目**（osgeo-announce）；最新 v4.0.2（2026-09-05）；PostGIS 生态里唯一的图/网络分析扩展 | PostGIS 上的路径规划：Dijkstra/A*/双向/旅行商/车辆路径（VRP）/等时圈 | **仅提及**：PostGIS 第 18 章"路径规划"小节 3 行代码 + 第 02 章安装命令一行；无系统讲解 | **P0** | 站点 18 章 PostGIS 教程的重心是"存查"，网络分析只留了一句 `CREATE EXTENSION pgrouting`，而中文 GIS 读者（物流、应急、选址、公交）对路网分析需求极强。建议 12~14 章：路网数据准备（OSM→pgRouting 拓扑）→pgr_createTopology→Dijkstra→A*/双向 A*→one-to-many/many-to-many→等时圈（drivingDistance）→TSP→VRP→带转向成本（turn restrictions）→与 OSM 数据栈联动→QGIS/GeoServer 发布分析结果→性能与索引 |
| **OSM 数据栈（osm2pgsql + Osmium + Overpass API）** | OSM 数据处理 | osm2pgsql.org；osmcode.org/osmium-tool；overpass-api.de | osm2pgsql GPL-2.0；osmium-tool GPL-3.0；Overpass API（AGPL-3.0，服务实例另有使用条款） | osm2pgsql **1,688★**（pushed 2026-10-25），最新 2.3.1（2026-07），OSM Carto 已于 2026-04 切换到 flex output，旧 pgsql output 自 2.0 起弃用——**正处"新旧写法切换"的教程真空期**；Osmium-tool **715★**（pushed 2026-11-01），OSM 官方生态的 PBF 瑞士军刀；Overpass API **941★**（GitHub 镜像仓从 2024-03 后未再推送，但 overpass-api.de 与 overpass turbo 仍是全球公共实例） | OSM 原始数据→PBF 处理→PostGIS 落库→按需查询的完整数据工程链 | **未覆盖**：全仓库无 osm2pgsql/Osmium/Overpass 教程；GeoLibre 第 26 章一句"OSM Downloader 拉建筑与道路（Overpass 面积限制）"、PostGIS 简介文一句"osm2pgsql 是独立工具" | **P1** | 中文互联网"OSM 数据怎么进数据库/怎么按条件抽数据"的教程极其零散，且大量基于 osm2pgsql 1.x 的 pgsql output（2026 年已被弃用）。建议合并为 14~16 章"OSM 数据工程"系列：OSM 数据模型（node/way/relation、标签体系）→PBF 下载与地理裁剪（osmium extract）→osmium-tool 过滤/导出→osm2pgsql 入门（flex Lua 写法为主、pgsql output 仅作迁移章节）→定制表结构（道路、POI、行政区）→增量更新（replication diff）→Overpass QL 语法与 overpass turbo→按行政区/POI 抽取实战→OSM+PostGIS 空间分析→与 Overture 数据的取舍 |
| **Nominatim** | 地理编码 | nominatim.org；github.com/osm-search/Nominatim | GPL-3.0 | **4,562★**（pushed 2026-11-03）；最新 v5.3.3；OpenStreetMap 基金会官方地理编码服务，也是全球公共 `nominatim.openstreetmap.org` 的实现；被 GeoLibre（默认 Provider）、GeoPipeAgent、GeoPandas 教程（经 geopy）引用 | 基于 OSM 的自建地理编码/反向地理编码服务 | **仅提及**：GeoPandas 第 23 章用 geopy 调公共 Nominatim（含 1 req/s 限制说明）、GeoPipeAgent 第 11 章 `network.geocode`、GeoLibre 第 04/22 章"自建 Nominatim/Pelias"一句话 | **P1** | 站点已教会读者"调公共服务"，但没有任何一章教"自建服务"——而公共服务有速率限制、中国大陆 OSM 数据稀疏且中文地址解析弱，实际项目必须自建+补充本地数据。建议 12 章：OSM 数据准备→安装（Docker/原生）→导入与索引→API（search/reverse/lookup）→地址层级与结构化查询→中文地址匹配的短板与补数（对照高德/百度）→性能调优→与 PostgreSQL 业务库联动→替代方案 Pelias/Photon 对比。**必须如实写清中文场景的限制** |
| **OSRM** | 路由/导航 | project-osrm.org；github.com/Project-OSRM/osrm-backend | BSD-2-Clause | **8,205★**（pushed 2026-11-07），开源路由引擎里 star 最高；GIS 圈"自建路径规划"默认答案之一 | 高性能 OSM 路由后端：CH/MLD 预处理，路线/矩阵/最近点/路网匹配 | **未覆盖**：全仓库无 OSRM 教程；GeoLibre 第 05 章仅一句"Encoded Polyline 精度 6（Valhalla/OSRM/Mapbox）" | **P1** | 与 Valhalla 二选一即可，但站点两份都没有。中文场景（外卖/物流/网约车自建算路）刚需。建议 12 章：安装与 OSM 预处理（osrm-extract/partition/customize）→API 全家桶→CH vs MLD→成本模型（car/bike/foot）→矩阵与批量算路→路线几何与导航指令→多实例部署与负载→自定义 Lua 成本函数→中国路网数据的坑（行政区边界、禁行）→与 Valhalla 对比 |
| **Valhalla** | 路由/导航 | valhalla.github.io/valhalla；github.com/valhalla/valhalla | MIT（GitHub license 徽章识别不出，以 LICENSE 文件为准） | **6,438★**（pushed 2026-11-10）；最新 v3.9.1；被 GeoLibre 作为默认网络分析后端（公共 FOSSGIS 实例 `valhalla1.openstreetmap.de`）、被 OSRM 之外大量出行服务采用 | 多模式路由 + 等时圈 + 矩阵 + 高度/地形感知，配置驱动 | **间接覆盖**：GeoLibre 第 12/15 章把 Valhalla 当"外部服务"调用（等时圈/OD 矩阵/顺序路线），默认公共实例；**无独立部署/调优教程** | **P1** | 站内已有人"用"Valhalla 的章节，但读者学完只会点按钮，不会"搭一个自己的 Valhalla 并写请求"。建议可作为 OSRM 系列的姊妹篇，或合并为"开源路由引擎（OSRM/Valhalla）"14 章双引擎教程，Valhalla 侧重：配置文件结构、tiles 构建、等时圈/矩阵/高度、多模式（步行/骑行/公交）、本地化（中文导航播报）。**风险**：与 OSRM 部分内容重叠，需在立项时二选一或明确分工 |
| **Apache Sedona** | 时空大数据 | sedona.apache.org；github.com/apache/sedona | Apache-2.0 | **2,427★**（pushed 2026-11-07）；Apache 基金会顶级项目；最新 1.9.1（2026-08-05）；覆盖 Spark/Flink/Snowflake，2025 年加入 GeoStats 与 SedonaDB（单机版） | 分布式空间分析：Spark/Flink 上跑 ST_* 与空间连接 | **仅提及**：GeoLibre 第 11 章作为 SQL 引擎选项之一（Sedona SQL 切换）、第 12/22 章 sidecar 的 SedonaDB；gisfx 专题多处讨论 Sedona 趋势；**无教程** | **P1** | 站点 PostGIS（单机事务）+ GeoPandas（单机内存）之间缺"集群/大数据"这一层，Sedona 是唯一同时覆盖 Spark 与 Flink 的开源主流答案。建议 12~14 章：环境与 Spark 集成→Spatial RDD→Spatial SQL→GeoParquet/GeoArrow 读写→空间连接与分区调优→栅格（Raster）→SedonaDB 单机→与 DuckDB 的单机/分布式分工→Flink 实时空间流→SpatialBench 基准方法 |
| MobilityDB | 时空数据库 | mobilitydb.github.io；github.com/MobilityDB/MobilityDB | 类 PostgreSQL 许可（GitHub 徽章识别不出，按官方 LICENSE） | **632★**（pushed 2026-11-09）；**OSGeo Community 项目**（osgeo.org/projects/mobilitydb 返回 200）；1.3.0 已进入 Debian（postgresql-18-mobilitydb 1.3.0-2）；文档 PDF 完整 | PostGIS 上的移动对象数据库：轨迹类型 tgeompoint、时空索引、轨迹查询 | **未覆盖**：无 MobilityDB 教程；仅 gisfx 未核实清单与 OpenGIS Skills"低优先级"表各一句 | **P2** | 高德/北斗轨迹、车联网、共享单车/网约车数据在中文场景体量巨大，但目标读者偏窄（需要 PostgreSQL 团队）。可作为 PostGIS 教程的"第 19 章扩展"或独立 8~10 章专题：移动对象类型→轨迹构造→时空谓词→轨迹聚合→与 PostGIS 几何互转→MovingPandas 对照（Python 侧）→车联网案例 |
| GeoMesa | 时空大数据 | geomesa.org；github.com/locationtech/geomesa | Apache-2.0 | **1,499★**（pushed 2026-11-10，活跃）；**OSGeo 项目**（osgeo.org/projects/geomesa 200）；支持 HBase/Accumulo/Cassandra/Redis/PostGIS 等后端 | 分布式时空索引与查询（落在大数据存储上） | **未覆盖** | **P2** | 与 Sedona 定位不同（Sedona 计算、GeoMesa 存储索引），但中文读者基数小、部署重（Hadoop 系）。建议暂缓，或仅在 Sedona/大数据专题里用一节对比 |
| GeoTrellis | 时空大数据/栅格 | geotrellis.io；github.com/geotrellis/geotrellis | Apache-2.0（官方；GitHub 徽章识别不出） | **1,379★**（pushed 2026-11-05）；LocationTech 项目；Spark 栅格处理与瓦片服务的老牌方案 | 分布式栅格：Spark 上的瓦片 ETL 与服务 | **仅提及**：GeoTools 第 01 章性能对比表一句"大规模栅格处理：GDAL、GeoTrellis" | **P2** | 站点栅格内容偏 GDAL/QGIS 单机。GeoTrellis 适合"省级影像/瓦片流水线"专题，但生态活跃度已让位于 titiler/rio-tiler 等轻量方案，优先级不宜高 |
| GraphHopper | 路由/导航 | graphhopper.com；github.com/graphhopper/graphhopper | Apache-2.0 | **6,802★**（pushed 2026-11-10）；Java 生态路由引擎事实标准；可作库内嵌 | Java 路由引擎：可作为库嵌入，或独立服务 | **未覆盖** | **P2** | 对 Java 读者（站点有 GeoTools/GeoServer 系列）最友好，但 OS 版功能被商业版（GraphHopper Directions API）切走一部分（如部分优化模块）。可在 OSRM/Valhalla 专题里作"Java 选型"一节 |
| OpenTripPlanner | 路由/导航（公交） | opentripplanner.org；github.com/opentripplanner/OpenTripPlanner | LGPL-2.1（GitHub 徽章识别不出） | **2,774★**（pushed 2026-11-10）；GTFS+OSM 多模式出行规划的事实标准；国内外公交/交通规划项目常用 | 公交+步行+骑行多模式行程规划（GTFS + OSM） | **未覆盖** | **P2** | 与 OSRM/Valhalla（自驾/骑行）互补，但目标读者是公交/交通规划单位，受众窄。建议作为"公共交通 GIS"专题 |
| Pelias | 地理编码 | pelias.io；github.com/pelias/pelias | MIT | **3,601★**（pushed 2026-07-24，节奏放缓）；Elasticsearch 上的模块化地理编码器 | 可组合的全球地理编码服务（OSM/OpenAddresses/WhosOnFirst 多源） | **仅提及**：GeoLibre 第 22 章一句"指向自建 Nominatim 或 Pelias" | **P2** | 与 Nominatim 形成"轻量单机 vs 多源可扩展"的对照。若做 Nominatim 系列，可加 1~2 章对比 |
| Photon | 地理编码 | photon.komoot.io；github.com/komoot/photon | Apache-2.0 | **3,178★**（pushed 2026-11-02）；基于 Elasticsearch 的 OSM 地理编码，欧洲使用广 | 轻量 OSM 地理编码（自动补全/模糊搜索） | **未覆盖** | **P2** | 部署比 Nominatim 简单、搜索体验更"像搜索引擎"，适合"POI 搜索框"场景。可在 Nominatim 系列里作替代方案一章 |
| Overture Maps | 数据管道 | overturemaps.org；github.com/overturemaps/overturemaps-py | 数据 CDLA-Permissive-2.0；工具 MIT | Overture Maps Foundation（AWS/Meta/Microsoft/TomTom 2022 年成立）；月度 release（示例 STAC release `2026-10-*`）；Python CLI **280★**（pushed 2026-11-10）；被 GeoLibre 内置为插件 | 开放底图数据（Parquet 分布式存储）+ 云原生数据管道 | **仅提及**：GeoLibre 第 03 章"Overture Maps 内置插件"一句 | **P2** | 中文场景对 Overture 的 POI 覆盖较新但尚未覆盖国内细节；作为"云原生底图数据"专题可写 6~8 章（数据模型、STAC 检索、DuckDB 直查、与 OSM 的差异、行政区/POI 抽取、增量更新） |
| H3 / h3-pg | 网格索引 | h3geo.org；github.com/uber/h3、postgis/h3-pg | Apache-2.0 | H3 **6,718★**（pushed 2026-11-06）；Uber 开源，已成为蜂窝网格索引事实标准；PostgreSQL 绑定 h3-pg 已归入 **postgis/h3-pg** 组织（387★，PGXN 4.5.0） | 六边形分层网格索引（聚合、邻域、出行分析） | **未覆盖**：无 H3 教程；仅 gisfx 提到"实时用网格编码 + Flink"一句 | **P2** | 中文 GIS 里"蜂窝网格做热力/选址/供需"的需求增长快，但单独立 10+ 章略单薄。建议作为 PostGIS 高级专题 3~5 章（H3 索引、h3-pg 安装、聚合与可视化）或独立"空间索引与网格编码"专题（H3+S2 合讲） |
| S2 Geometry | 网格索引 | s2geometry.io；github.com/google/s2geometry | Apache-2.0 | **2,748★**（pushed 2026-10-27）；Google 出品，BigQuery/Google Maps 底层网格；C++/Go/Java/Python 多语言 | 球面分层网格（S2 Cell） | **未覆盖** | **P2** | 与 H3 对比讲更有价值（六边形 vs 四叉球面），但中文资料少、库偏底层。同上，并入网格索引专题 |
| TimescaleDB | 时空扩展（时序） | timescale.com；github.com/timescale/timescaledb | **TSL（源码可见、非 OSI 开源）+ Apache-2.0 部分**（GitHub 徽章识别不出，需按官方 LICENSE 明确） | **23,835★**（pushed 2026-11-09）；时序数据库事实标准之一，PostgreSQL 扩展 | PostgreSQL 上的时序数据（时间分区、连续聚合、压缩） | **仅提及**：GeoServer Cloud 第 10 章架构图出现 TimescaleDB（历史轨迹） | **P2** | 严格说不是"GIS 库"，但与"轨迹/传感器时序 + 空间"结合场景多。若做 MobilityDB 专题可对比；不建议单独立 GIS 教程（许可也不符合"全开源"口径） |

---

## 详细说明（P0 / P1）

### P0-1 SpatiaLite：被站内教程"顺带提到 7 次"却没有入口的轻量空间库
站点在 QGIS（4 章）、GeoPandas、GeoTools、SharpMap、GDAL、OpenGIS Skills 里一共提到 SpatiaLite 十余次，但没有任何一处告诉读者"它是什么、怎么装、怎么写第一条空间 SQL"。这是典型的"知识断点"：读者在 QGIS 里看到 SpatiaLite 数据源，点进站点却找不到系统教程。中文读者对"单文件空间数据库"的需求真实存在（桌面工具、离线移动端、单机交付、嵌入式设备），而 PostGIS 教程讲的是服务端重型方案，两者不是替代关系。建议 12~15 章，且必须诚实地写"项目现状"一节：官方版本 5.1.0 停在 2023-08、官网仍由 Alessandro Furieri 单人维护、社区有"是否已停止维护"的公开讨论（2024 年 GIS StackExchange 有专帖）——但 Debian/Ubuntu 持续打包、QGIS/GDAL/GeoTools 持续内置，短期不会消失。章节方向：SQLite 与空间扩展概念 → 安装（CLI/mod_spatialite 各语言）→ 几何类型与 SRID → R-Tree 空间索引 → 空间函数实战 → GeoPackage 与 SpatiaLite 的区别与互转 → 各语言接入（C/Python/Java/.NET）→ Shapefile/GeoJSON/PostGIS 导入导出 → 虚拟表（VirtualSpatialIndex/VirtualOGR）→ 移动端与嵌入式部署 → 并发与性能 → 与 PostGIS/DuckDB spatial 选型决策。

### P0-2 DuckDB spatial：站点最该补的"分析型空间 SQL"入口
DuckDB 本体 4.3 万 star、spatial 是官方一等扩展、DuckDB 1.5 刚做了 GEOMETRY 类型的破坏性变更（坐标轴顺序），说明这个生态正处在"能力跃升 + 写法迁移"的窗口期，正是出教程的好时机。但站点目前对它的覆盖全部是"寄生式"的：GeoLibre 第 11 章讲的是 GeoLibre 的 SQL 工作区（WASM 形态 + 平台 UI），GeoPandas 第 08 章只有一段 DuckDB 读 GeoParquet 的示例，giszj 专题只在工具链表里一行。读者想学"通用 DuckDB spatial"必须跳出站点。建议 12~14 章：安装与三种接入（CLI/Python/R）→ spatial 扩展加载与 GEOMETRY 类型 → ST_Read 读全格式 → 空间连接与聚合 → GeoParquet/GeoArrow 输出 → 与 GeoPandas/Arrow 互操作 → 与 PostGIS 的"读写互转" → 性能调优（threads/memory_limit/分区）→ DuckDB-WASM 浏览器端 → 1.5 坐标轴变更迁移 → 选型（DuckDB vs PostGIS vs Sedona）。**与现有教程的关系**：它是 GeoLibre 第 11 章的"底层依赖"，也是 GeoPandas 第 08 章的"下游工具"，独立成篇后现有两章都可改为"详见 DuckDB spatial 教程"。

### P0-3 pgRouting：PostGIS 教程最大的"未展开章节"
站点 PostGIS 教程 18 章，是站内最成熟的系列之一，但网络分析只在第 18 章留了 3 行代码 + 第 02 章一行安装命令。pgRouting 2024-12 刚毕业为 OSGeo 正式项目、v4.0.2（2026-09）活跃，是 PostGIS 生态里唯一的图分析扩展。中文场景需求极强：物流配送、应急疏散、选址、公交线网、外卖算路——这些读者在站点里找不到任何系统内容。建议作为"PostGIS 进阶"独立系列（12~14 章），并在 PostGIS 教程第 18 章加"延伸阅读"链接。章节方向：路网数据（OSM→pgRouting 拓扑）→ pgr_createTopology → Dijkstra → A*/双向 → one-to-many / many-to-many → 等时圈 → TSP → VRP → 转向限制与转向成本 → 与 OSM 数据栈联动 → 发布（QGIS/GeoServer）→ 性能与索引。**与现有教程的关系**：底层依赖 PostGIS 教程（读者应先读），上游依赖 OSM 数据栈（若 OSM 系列立项，两者互相引用）。

### P1-1 OSM 数据栈：中文互联网最缺的"从 PBF 到 PostGIS"完整链路
站点对 OSM 的覆盖停留在"用 OSM 瓦片当底图"（Mapsui/SharpMap/OpenLayers/Cesium 各处）和"用 geopy 调 Nominatim"（GeoPandas 第 23 章）。但"OSM 原始数据怎么处理"完全空白。更关键的是时机：osm2pgsql 2.0（2024-09）弃用 pgsql output、osm2pgsql 2.3.1（2026-07）、OSM Carto 于 2026-04 全面切到 flex output——中文教程大量基于旧写法，此刻出一套"以 flex Lua 为主"的新教程价值最高。建议合并为 14~16 章"OSM 数据工程"系列：OSM 数据模型 → PBF 下载/裁剪（osmium extract）→ osmium-tool 过滤导出 → osm2pgsql flex 输出 → 定制道路/POI/行政区表 → 增量更新（replication）→ Overpass QL → Overpass 抽取实战 → OSM+PostGIS 分析 → 与 Overture 的取舍。**与现有教程的关系**：它是 pgRouting 与 Nominatim 的前置数据环节，也是 PostGIS 教程的实战数据源。

### P1-2 Nominatim：从"调公共服务"到"自建地理编码服务"
GeoPandas 第 23 章已经教了怎么用 geopy 调公共 Nominatim，并写了 1 req/s 限制；GeoPipeAgent 第 11 章也封了 network.geocode。站点缺的是"自建"这一层。中文读者需求真实：公共服务限速、国内 OSM 数据稀疏、地址格式差异大、合规上不希望把地址发给境外服务。建议 12 章，但**必须写清中文地址匹配的短板**：Nominatim 的地址解析基于 OSM 标签体系，中国大陆门牌/小区数据在 OSM 中覆盖率低且更新慢，libpostal 对中文地址分词也不理想——所以教程应包含"补数"和"混合方案"（自建 Nominatim + 本地地址库 + 高德/百度兜底），避免读者误以为自建就能替代商业地理编码。章节方向：数据准备 → 安装（Docker/原生）→ 导入/索引 → API 三件套 → 结构化地址查询 → 中文地址短板与补数 → 性能调优 → 与 PostgreSQL 业务库联动 → Pelias/Photon 对比。

### P1-3 路由引擎（OSRM / Valhalla）：站内"会用不会搭"
GeoLibre 第 12/15 章把 Valhalla 当外部服务调用（等时圈、OD 矩阵、顺序路线，默认公共 FOSSGIS 实例），第 05 章提到 OSRM 的 polyline 精度——但站点没有任何一章教"怎么搭建一个自己的路由引擎"。OSRM 8,205★、Valhalla 6,438★，是开源路由的两大主力（GraphHopper 6,802★ 作 Java 侧备选）。建议二选一或合并：OSRM 侧重性能与算路 API，Valhalla 侧重多模式与等时圈/矩阵。中文场景（物流、外卖、网约车）对"自建算路"需求强，且涉及"中国路网数据的坑"（行政区边界、禁限行、高速收费）值得专门章节。**注意**：两者内容有重叠，立项时应明确分工（建议先 OSRM、后 Valhalla 作姊妹篇），避免两套教程互相稀释。

### P1-4 Apache Sedona：补齐站点缺失的"分布式/大数据"层
站点现有的空间计算全部是单机：PostGIS（事务）、GeoPandas（内存）、DuckDB（若立项）。Sedona 是 Apache 顶级项目、2,427★、覆盖 Spark/Flink/Snowflake/SedonaDB，是唯一主流的分布式空间分析答案。站点在 GeoLibre 教程里已经让 Sedona 作为"SQL 引擎选项"出现，gisfx 专题也多次讨论其趋势，但没有系统教程。建议 12~14 章：Spark 集成 → Spatial RDD → Spatial SQL → GeoParquet/GeoArrow → 空间连接与分区 → 栅格 → SedonaDB 单机 → 与 DuckDB 的分工 → Flink 实时空间流 → SpatialBench 基准方法。**与现有教程的关系**：与 PostGIS/DuckDB 形成"事务/单机分析/集群"三层选型叙事，正好补站点缺的那一层。

---

## 已衰落 / 不建议清单

| 项目 | 原因 |
|---|---|
| **GeoWave** | 仓库已从 ngageoint 迁移到 locationtech/geowave；528★，最近推送 **2024-11**，最后 release 0.8.0（2023-12），实质停止维护。定位又被 GeoMesa 与 Sedona 挤压，不建议投入。 |
| **JOSM / iD Editor / StreetComplete / Vespucci** | 都是 OSM **编辑器**（桌面/移动/Web 应用），属于"桌面软件/Web 前端"范畴，与本站教程定位（库/平台开发）不符，且单独立 10+ 章价值低。iD 3,923★、StreetComplete 5,142★、JOSM 456★（仅镜像）虽活跃，但只在 OSM 数据工程系列里用一节"数据回编/校验"提及即可。 |
| **BRouter** | 749★，但定位是 Android 离线骑行路由，受众窄，且官网/GitHub 活跃度一般。只在路由引擎对比表提一句。 |
| **Imposm 3** | osm2pgsql 的直接竞品，775★（pushed 2026-08），但社区明显更偏 osm2pgsql（1,688★，且为 OSM 官方推荐链路），api 教程只做一套即可，Imposm 在 OSM 数据工程系列里用一节对比。 |
| **GeoMesa / GeoTrellis**（从"不建议"降为 P2） | 本身活跃且是 OSGeo/LocationTech 项目，但部署重、中文读者基数小，见明细表 P2 说明，暂不立项。 |
| **MySQL / ClickHouse / Redis / Valkey / Neo4j 地理能力** | 均非 GIS 主力：MySQL 空间函数受限于 SRID 与索引能力、ClickHouse 地理类型仅够"存点算距离"、Redis/Valkey GEO 是简单 geohash 半径查询、Neo4j 空间插件生态弱。**最多在选型文章里一句话带过**，不占教程位。 |
| **Wherobots** | 商业公司（托管 Sedona 服务），非开源项目，按范围排除（可作 Sedona 教程的"托管方案"一句）。 |
| **Google Earth Engine / Mapbox 商业服务** | 商业闭源/纯在线服务，按范围排除。 |

---

## 其他可提一句（不占表格）

- **networkx / OSMnx**：OSMnx 5,891★、NetworkX 已被 GeoPipeAgent 第 11 章与 GeoPandas 第 26 章覆盖，属"Python 路网分析"现状；若 pgRouting 立项，可在对比章节提及"Python 侧轻量方案"。
- **MovingPandas**（1,425★）：可与 MobilityDB 对照的 Python 轨迹分析库，建议并入 MobilityDB 专题。
- **geopy**（4,872★）：站点 GeoPandas/GeoPipeAgent 已用，无需单独教程。
- **planetiler / tilemaker / OpenMapTiles**：OSM→矢量瓦片的工具链，属"Web 前端/瓦片服务"方向（可能是其他调研员的范围），此处仅记录。
- **pgpointcloud / PostGIS pointcloud**：429★，点云数据库扩展，受众窄，建议在 GDAL/LiDAR 相关内容里一句带过。

---

## 越界发现（供 lead 转交其他方向）

1. **OSM→矢量瓦片**：planetiler、tilemaker、OpenMapTiles 是 OSM 数据栈的自然下游，若"OSM 数据工程"系列立项，需与"Web 地图/瓦片"方向协调边界。
2. **GeoServer 的 OSM 数据源**：站点 GeoServer 教程未涉及 OSM 数据落库后的发布链路，与 OSM 系列可互相引用。
3. **DuckDB spatial 与 GeoParquet 的关系**：站点 gisfx 专题已讨论 GeoParquet 趋势，若 DuckDB 教程立项，需与 gisfx 作者协调引用关系，避免重复。
4. **Valhalla 等时圈**：GeoLibre 第 12/15 章已有"调用公共实例"的操作内容，Valhalla  tutorials 应从"部署与请求构造"切入，避免重复 GeoLibre 的 UI 操作讲解。

---

## 不确定点（需后续核实）

1. **SpatiaLite 维护状态**：官网首页仍写 "developed and maintained by Alessandro Furieri"、当前版 5.1.0（2023-08-04），但 2026-01 的 spatialite-users 邮件列表帖子提到 "as of January 1st, I'm officially ..."（疑似交接），未能取得全文核实。教程立项时应向项目方或邮件列表确认，并在正文中给出"截至 2026-11 的维护状态"声明。
2. **SpatiaLite 的 OSGeo 身份**：osgeo.org/projects/spatialite 返回 404，未在 OSGeo 官网项目页列出（仅随 OSGeoLive 分发），不应宣传为"OSGeo 项目"。
3. **License 识别**：Valhalla（应为 MIT）、MobilityDB、GeoMesa、GeoTrellis、OpenTripPlanner、TimescaleDB 的 GitHub license 徽章无法识别，需以各仓库 LICENSE 文件为准；其中 **TimescaleDB 为 TSL 许可（非 OSI 开源）+ 部分 Apache-2.0，若站内口径是"全开源"，应降级或注明**。
4. **DuckDB 版本号**：shields 的 latest release 显示 v2.0.0，而搜索结果提到 DuckDB 1.5（2026-03 发布）与 1.4 LTS；版本线可能已进入 2.x，教程写作时应以写作时的官方文档版本为准。
5. **Overpass API 官方仓库活跃度**：GitHub 镜像 941★ 但从 2024-03 后无推送；公共实例 des/overpass-api.de 仍正常服务，但"官方代码是否在其他仓库活跃开发"未核实，教程应只讲查询与使用，不承诺自建部署细节。
6. **Overture 在国内的覆盖度**：未核实其中国境内 POI/道路的数据完整度，教程中不宜宣称"可替代高德/百度"。
7. **Nominatim 中文地址效果**：未做实测，仅基于其算法（OSM 标签 + 分词）判断短板，教程写作前应做小样本验证。
