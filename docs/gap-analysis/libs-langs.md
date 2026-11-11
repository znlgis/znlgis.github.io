# 教程缺口调研：核心几何/CRS 引擎与各语言 GIS 库

> 调研员：libslangs ｜ 完成时间：2026-11-11 ｜ 范围：基础库与语言生态（**不含**服务端、桌面应用、数据库扩展、OSM 数据栈——这些由其他方向负责）
>
> **证据口径**：仓库覆盖状态 = 对全仓库 1,581 个 Markdown 文件做词边界匹配（排除「<h3>」「bitmap」「terrain」等误匹配）后人工复核；星数 = shields.io /github/stars 徽章（2026-11-11，**四舍五入到千位，非精确值**，全队共用一个 IP，未逐一消耗 GitHub API 配额）；活跃度 = shields.io /github/last-commit 徽章相对时间换算到 2026-11；版本 = GitHub Release / PyPI 徽章；OSGeo 身份 = 官网项目页。

## 结论速览

- **P0（建议立项 10+ 章系列）**：PROJ（+pyproj）、GEOS、rasterio（+rio CLI，顺带 pyogrio/Fiona IO 对照）、OSMnx、PySAL 空间统计、xarray+rioxarray。
- **P1（重点专题 6~10 章，或并入相邻 P0 系列）**：GeoAI 遥感（segment-geospatial/SamGeo + TorchGeo）、movingpandas 轨迹分析。
- **R/Julia/Rust/Go 语言生态整体按 P2 处理**：R 空间生态（sf/stars/terra/tmap/lidR）若站长有意补语言生态可升 P1；Julia/Rust/Go 均 P2/观察。
- **P2（单篇深度文或暂缓）**：R 空间生态（默认）、H3、S2、libspatialindex、Boost.Geometry/CGAL/SFCGAL、Apache SIS/GeoAPI、DotSpatial/MaxRev.Gdal.Core/SharpKml、Cartopy、leafmap/ipyleaflet、Lonboard/dask-geopandas/overturemaps-py、exactextract/rasterstats、Julia 生态、Rust/Go GIS 库。
- **已在建/已覆盖，不重复建议**：JTS（24 章“撰写中”，见 gis/tutorial/jts/）、GeoTools、NetTopologySuite、SharpMap、Mapsui、Shapely、GeoPandas、GeoServer/PostGIS/QGIS/GDAL。
- **一句话判断**：站点在“几何 API（Shapely/JTS/NTS/Esri Geometry）”和“平台/框架（GDAL/QGIS/PostGIS/GeoServer）”之间，**缺的是最底层的两个引擎（PROJ、GEOS）和 Python 数据栈的栅格/网络/统计/多维四块**——这恰好是中文 GIS 资料最薄弱、而读者提问最密集的地带。

## 明细表

> 说明：**JTS 教程已在建**（gis/tutorial/jts/，24 章正文均为“撰写中”，导航已挂出），故本报告不把 JTS 当缺口、也不建议新增；GeoTools、NetTopologySuite、SharpMap、Mapsui、Shapely、GeoPandas 已覆盖，同样不列。

### A. P0 / P1（值得单独立项）

| 项目 | 类别 | 官网/GitHub | License | 主流度证据（2026-11-11） | 一句话定位 | 仓库覆盖状态 | 优先级 | 与现有教程的关系/建议 |
|---|---|---|---|---|---|---|---|---|
| **PROJ** | C/C++ CRS 引擎 | proj.org；github.com/OSGeo/PROJ | MIT | ★约 2,000；release v9.9.0；2026-11-05 仍有提交；**OSGeo 官方项目**（osgeo.org/projects/proj/）；GDAL/QGIS/PostGIS/GeoPandas/pyproj/Cartopy/rasterio 的坐标转换内核 | 坐标参考系统与投影变换的“根” | **无独立教程**；全仓 84 文件 396 处提及（GDAL 第06章、GeoPandas 第06章、QGIS/PostGIS 教程顺带讲用法） | **P0** | 现有教程只讲“在某个软件里点哪里/怎么写一行 pyproj”，没人讲 CRS 模型、WKT2、转换管线与精度。建议 14 章系列，并用“中国坐标系（CGCS2000/西安80/北京54/GCJ-02）+ 高程基准 + 七参数”做落点 |
| **GEOS** | C++ 几何引擎 | libgeos.org；github.com/libgeos/geos | LGPL-2.1 | ★约 1,500；v3.15.0；2026-11-08 有提交；**OSGeo 官方项目**；Shapely 官网明确写“using GEOS, the engine of PostGIS, and a port of JTS” | OGC 简单要素的 C/C++ 参考实现，PostGIS/QGIS/GDAL/Shapely 的几何运算内核 | **无独立教程**；57 文件 203 处提及（多在 Shapely/PostGIS 教程中作为“底层”一句带过） | **P0** | JTS 教程在建（24 章“撰写中”），GEOS 是其 C++ 姐妹实现；Shapely 教程只覆盖 Python 层。建议 11 章，聚焦 C API、OverlayNG 鲁棒性、STRtree、PreparedGeometry 与性能，和 JTS 教程形成“Java/C++ 双视角” |
| **rasterio** | Python 栅格 IO | rasterio.readthedocs.io；github.com/rasterio/rasterio | BSD-3-Clause | ★约 2,600；v1.5.2；2026-11 有提交；PangEO/GDAL 生态事实标准，GeoLibre/GeoPipeAgent 都把它当首选 | GDAL 之上的 Python 栅格读写与处理层（含 rio 命令行） | **无独立教程**；24 文件 70 处提及（GDAL 第07章 Python 绑定、GeoLibre、GeoPipeAgent 顺带） | **P0** | 站点 Python 栈已有矢量（GeoPandas/Shapely），**栅格是明显缺口**；GDAL 教程第07章只讲 ctypes 绑定原理。建议 13 章，附“pyogrio/Fiona 矢量 IO 对照”1 章，承接 GeoPandas 第07章 |
| **OSMnx** | Python 城市网络分析 | osmnx.readthedocs.io；github.com/gboeing/osmnx | MIT | ★约 5,900；PyPI v2.1.1；2026-11-07 有提交；作者 Boeing 2025 年 Geographical Analysis 论文；GeoPandas 生态标配 | OSM 街道网络/POI/建筑足迹的下载、建模、分析、可视化 | **近乎未覆盖**：仅 GeoPandas 第26章“第三方库集成”一句 | **P0** | 站点完全没有 OSM 主题教程；中文现有资料普遍停留在 v0.x/v1.x，与 v2 API 脱节。建议 12 章（含可达性、街道方位、城市形态指标）；**第2章的 OSM 数据/许可可与 spatial-db-osm 方向共建**，避免两套 OSM 教程 |
| **PySAL**（libpysal/esda/spopt/momepy/spaghetti/tobler，配套 spreg） | Python 空间统计 | pysal.org；github.com/pysal/libpysal 等 | BSD-3-Clause | libpysal ★约 294、esda ★263、spopt ★387、momepy ★638、spaghetti ★285、tobler ★172；libpysal v4.15.1，2026-11-09 有提交；空间统计/空间计量 Python 事实标准（对应 R 的 spdep） | 空间权重、空间自相关、区域化、城市形态、网络统计的“全家桶” | **近未覆盖**：仅 GeoPandas 第26/27章几句；spaghetti/tobler/momepy/spopt 全仓 0 命中 | **P0** | 站点已有大量“几何操作”教程，但没有“空间统计分析”教程；规划/地理/经济地理读者刚需。建议 12 章（权重→Moran/LISA→区域化→网络→形态→回归入门） |
| **xarray + rioxarray** | Python 多维栅格 | xarray.dev；github.com/pydata/xarray、corteva/rioxarray | Apache-2.0 | xarray ★约 4,200、v2026.09.0、2026-11-09 有提交；rioxarray ★约 631、v0.24.0；气象/海洋/遥感领域标准数据模型 | 带坐标标注的 N 维数组 + 地理栅格 CRS 扩展（NetCDF/Zarr 生态） | **无独立教程**；xarray 仅 3 文件 8 处提及（GDAL 第07章、GeoLibre 第19章、GeoPandas 第01章）；rioxarray 1 处 | **P0（可与 rasterio 合并规划）** | 站点无任何科学计算/N 维数组教程，但 GDAL/GeoLibre 都已引用它。建议 10 章专题；若版面紧张，与 rasterio 合成“Python 栅格分析（20+ 章）”两卷本，第一卷 rasterio、第二卷 xarray/rioxarray |
| **GeoAI 遥感**（segment-geospatial/SamGeo + TorchGeo，概览 eo-learn/Raster Vision） | Python 遥感深度学习 | samgeo.gishub.org；github.com/opengeos/segment-geospatial、microsoft/torchgeo | MIT | segment-geospatial ★约 4,200、v1.4.2、2026-11 有提交；TorchGeo ★约 4,200、v0.10.1、2026-11-06 有提交；eo-learn ★1.3k；Raster Vision ★2.2k（2026-06 后无提交，维护放缓） | 遥感影像分割/地物提取与地理机器学习工具链 | **仅顺带提及**：SamGeo 在 GeoLibre 教程 6 章出现 28 处（第12/16/22/23章），segment-geospatial 3 处；TorchGeo/eo-learn/Raster Vision 全仓 0 | **P1** | GeoLibre 第16章只是“功能罗列”级别，站点 ai/ 有通用 AI 教程但无遥感 DL。建议 10 章实操专题（交互分割→批量矢量化→TorchGeo 微调→精度评价→工程化），理论部分引用站点既有 AI/GeoAI 内容 |
| **R 空间生态**（sf/stars/terra/tmap/mapview/lidR/spdep） | R 语言 GIS | r-spatial.org；github.com/r-spatial/sf 等 | sf：GPL-2 与 MIT 双许可；terra/tmap/mapview/lidR：GPL-3.0；stars：Apache-2.0 | sf ★约 1,500（2026-11-10 提交）、terra ★623（当日）、stars ★610、tmap ★908、mapview ★554、lidR ★714、spdep ★151；均活跃 | R 语言的空间矢量/栅格/制图/统计/点云全套 | **基本未覆盖**：仅 GeoPandas 第01章“GeoPandas vs R sf 包”一节；terra/stars/spdep/lidR 全仓 0 | **P2（若补语言生态可升 P1）** | 站点没有 R 内容；R 在高校与生态/林业/规划领域用户稳定，且与 PySAL 形成“双语言空间统计”对照。建议 12 章合并系列（不拆 7 个小教程），突出“与 Python 栈互操作”差异化卖点 |
| **movingpandas** | Python 轨迹分析 | movingpandas.org；github.com/movingpandas/movingpandas | MIT | ★约 1,400；v0.23.0；2026-09 有提交；基于 GeoPandas 的轨迹分析事实标准 | 移动对象/轨迹数据清洗、停留点、分割、可视化 | **近乎未覆盖**：2 文件 8 处（GeoPandas 第26章一句、lin-ear-th-inking 文章一处） | **P1（可作为 8 章专题）** | 轨迹/GPS/物流/出行数据需求增长快，中文系统资料稀缺；与 GeoPandas 第22章（Folium）、第25章（大数据）衔接，可做成“时空数据”专题的一块 |

### B. P2（观察 / 单篇深度文 / 与相邻方向合并）

| 项目 | 类别 | 官网/GitHub | License | 主流度证据（2026-11-11） | 一句话定位 | 仓库覆盖状态 | 优先级 | 与现有教程的关系/建议 |
|---|---|---|---|---|---|---|---|---|
| **H3 / h3-py** | 六边形网格索引 | h3geo.org；github.com/uber/h3、uber/h3-py | Apache-2.0 | H3 ★约 6,700、v4.5.0、2026-11-10 有提交；h3-py ★约 1,000、v4.5.0；蜂窝网格事实标准，PostgreSQL 绑定已迁入 postgis/h3-pg | 分层六边形网格编码 | **未覆盖**：GeoLibre 第03章 1 处“H3 索引”（<h3> HTML 误匹配已排除）；另有 docs/gap-analysis/spatial-db-osm.md 提及 | **P2（协作项）** | **与 spatial-db-osm 方向重叠**：该笔记已建议“H3+S2 合并为空间索引与网格编码专题”并定 P2，我同意，不重复立项；若单独做，建议 8 章 h3-py 分析向（索引/邻域/聚合/可视化/DuckDB h3 扩展） |
| **S2 Geometry** | 球面网格索引 | s2geometry.io；github.com/google/s2geometry | Apache-2.0 | ★约 2,700、v0.14.0、2026-09 有提交；Google 出品，BigQuery 等底层 | 球面四叉网格（S2 Cell） | **未覆盖**（全仓 0 有效命中） | **P2（协作项）** | 同上，建议与 H3 合并成“网格编码”专题对比讲（六边形 vs 球面四叉） |
| **libspatialindex** | C++ 空间索引 | libspatialindex.github.io；github.com/libspatialindex/libspatialindex | MIT | ★约 801；2026-11-06 有提交；Python RTree、QGIS 等使用 | R-tree 等空间索引库 | 未覆盖（0） | **P2（其他可提一句）** | 太底层且站点已在 Shapely 第12章（STRtree）、PostGIS（GiST）讲索引概念，单独立项性价比低 |
| **Boost.Geometry** | C++ 几何算法 | boost.org/doc/libs；github.com/boostorg/geometry | BSL-1.0 | ★约 520；2026-11-10 有提交；Boost 官方库 | 泛型 C++ 几何计算 | 仅 CAD 教程提及 1 处 | **P2** | C++ 受众且与 CAD 方向交叉，建议在“C++ GIS 开发”专题中 1~2 章 |
| **CGAL** | C++ 计算几何 | cgal.org；github.com/CGAL/cgal | LGPL-3.0（部分 GPL 模块） | ★约 6,100；2026-11-05 有提交；计算几何权威库 | 精确谓词/三角剖分/布尔运算 | 10 文件 13 处（postgis 及 cad/cadquery、openscad 教程） | **P2** | 非 GIS 专用，站点 CAD 方向已覆盖部分；仅在 SFCGAL/3D 布尔运算时作为上游提及 |
| **SFCGAL** | C++ 3D 几何 | sfcgal.org；GitHub 镜像 Oslandia/SFCGAL（主仓已迁 GitLab，活跃度需核实） | LGPL-2.1 | GitHub 镜像 ★约 114、最后提交 2024-03（镜像停更）；**OSGeo 社区项目**；PostGIS 3D 运算后端 | 基于 CGAL 的 2D/3D 精确几何 | 8 文件 24 处（PostGIS 第13/14章讲 3D 时提及） | **P2** | 建议并入 PostGIS 第14章扩写或 3D 专题，不单独立项 |
| **Apache SIS** | Java CRS/元数据 | sis.apache.org；github.com/apache/sis | Apache-2.0 | ★约 128；v1.7；2026-11-07 有提交；Apache 顶级项目、GeoAPI 参考实现 | Java 空间参考系统/单位/元数据标准库 | 仅 lin-ear-th-inking 文章 1 处 | **P2** | 受众窄但权威，中文近乎空白；可做 6~8 章“Java 空间参考”专题，与 GeoTools/JTS 教程互补。优先级低于 PROJ（PROJ 是跨语言事实标准） |
| **GeoAPI** | Java OGC 接口 | github.com/opengeospatial/geoapi | OGC 许可（BSD 类） | ★约 141；2026-10 有提交；OGC 官方 Java 接口规范 | OGC 规范的 Java 接口层 | 仅 NetTopologySuite/SharpMap 教程提及 | **P2** | 并入 Apache SIS 专题 1 章即可 |
| **Hibernate Spatial** | Java 空间 ORM | hibernate.org；hibernate/hibernate-orm 的 spatial 模块 | LGPL-2.1 | Hibernate 生态成熟，PostGIS 教程第17章已涉及 | JPA/Hibernate 空间类型与函数集成 | **已覆盖**：PostGIS 第17章“编程语言集成”5 处提及 | — | **不单独立项**（随 Hibernate 使用场景，最多补 1 篇） |
| **DotSpatial** | .NET GIS 库 | dotspatial.github.io；github.com/DotSpatial/DotSpatial | MIT | ★约 916，但**最后提交 2025-10**（约 13 个月前），已趋停滞 | .NET 桌面 GIS 控件/数据 | 3 文件提及（SharpMap/NTS/OpenGIS Utils 对比处） | **P2 / 不建议** | 功能与站点已有 NTS/SharpMap/Mapsui 重叠，且更新停滞；最多在选型文中一段 |
| **BruTile** | .NET 瓦片库 | github.com/BruTile/BruTile | LGPL-2.1 | ★约 376；2026-05 有提交；Mapsui 的瓦片底层 | 瓦片源/LOD 管理 | **已覆盖**：Mapsui 教程 6 章 + SharpMap 教程 7 章共 54 处 | — | **不单独立项**（Mapsui 教程已讲透） |
| **MaxRev.Gdal.Core**（gdal.netcore） | .NET GDAL 绑定 | github.com/MaxRev-Dev/gdal.netcore | MIT | ★约 215；2026-10 有提交；NuGet 上最常用的 GDAL .NET Core 包 | 免编译跨平台 GDAL NuGet 封装 | **已覆盖**：GDAL 第02/09章、OpenGIS Utils .NET 教程 4 处 | — | **不单独立项**，可在 GDAL 教程补一节版本矩阵 |
| **SharpKml** | .NET KML 库 | github.com/samcragg/SharpKml | 开源（Ms-PL 系，以仓库为准） | ★约 166；**最后提交 2024-04**，维护弱 | KML 读写 | 全仓 0 | **P2 / 不建议** | KML 场景已在 NTS/SharpMap/GDAL 教程覆盖，需求窄 |
| **GMap.NET** | .NET 地图控件 | github.com/judero01col/GMap.NET（社区 fork） | 开源（以仓库为准） | fork ★约 517，**最后提交 2023-05**；上游 WinForms 控件生态老化 | WinForms 地图控件 | Mapsui 教程 1 处 | **P2 / 不建议** | WinForms legacy，已被 Mapsui 教程覆盖 |
| **Cartopy** | Python 制图/投影 | scitools.org.uk/cartopy；github.com/SciTools/cartopy | LGPL-3.0 | ★约 1,600；v0.26.0；2026-11-10 有提交；气象/海洋制图标准 | 投影感知的科研地图绘制 | 仅 GDAL 第07章 1 处 | **P2** | 与 geopandas 第21章（Matplotlib）互补；气象读者需求真实，可做 8 章专题，但优先级低于栅格/统计方向 |
| **leafmap / ipyleaflet** | Python 交互地图 | leafmap.org；github.com/opengeos/leafmap、jupyter-widgets/ipyleaflet | MIT | leafmap ★约 3,800（2026-11-10 提交）、ipyleaflet ★约 1,500（2026-05 提交） | Notebook 内交互地图（含 Kepler/白板） | leafmap 1 处（GeoLibre 第19章）；ipyleaflet 0 | **P2** | GeoPandas 第22章 Folium 已覆盖基础交互；建议在“xarray/rasterio 专题”里各 1 章，不单独立项 |
| **Lonboard / dask-geopandas / overturemaps-py** | 大规模地理数据栈 | github.com/developmentseed/lonboard、geopandas/dask-geopandas、overturemaps/overturemaps-py | MIT / BSD-3 / MIT（以仓库为准） | Lonboard ★约 977（2026-11-09 提交）、dask-geopandas ★593（2026-07）、overturemaps-py ★280（2026-11-10） | 亿级要素可视化 / 并行 GeoPandas / Overture 数据访问 | dask-geopandas 仅 GeoPandas 第25/27章提及；Lonboard、overturemaps 0 | **P2** | 建议合并成“云原生/大规模地理数据”专题（6~8 章）；Overture 数据侧可能与 spatial-db-osm 重叠，注意分工 |
| **exactextract / rasterstats** | 栅格分区统计 | github.com/isciences/exactextract；perrygeo/python-rasterstats（维护弱） | Apache-2.0 / BSD-3 | exactextract ★约 327（2026-10 提交）；rasterstats 仅 GeoPandas 第26章 1 处、且仓库迁移/维护状态待核 | 区域统计（zonal statistics） | 1 处提及 | **P2** | 各 1 章并入 rasterio 系列的“分区统计”章即可 |
| **Julia 生态**（GeoStats.jl/Rasters.jl/ArchGDAL.jl） | Julia GIS | juliaearth.org；github.com/JuliaEarth/GeoStats.jl、rafaqz/Rasters.jl | MIT | GeoStats.jl ★约 593、v0.91、2026-11 有提交；Rasters.jl ★约 265、2026-09；ArchGDAL.jl 约百级（仓库名待核） | Julia 地理统计与栅格 | 全仓 0 | **P2（观察）** | 受众极小，暂不立项；可作为“多语言 GIS 生态”综述文的一节 |
| **Rust 生态**（geo/geozero/gdal-rs） | Rust GIS | github.com/georust/geo、georust/geozero、georust/gdal | MIT/Apache-2.0 双许可（以仓库为准） | geo ★约 2,000（crates v0.33.1，2026-11 提交）、geozero ★479、gdal ★459 | Rust 几何算法/格式流式处理/GDAL 绑定 | 全仓 0 | **P2** | 有增长但中文需求小；可做“Rust GIS 工具链”6 章专题，与站点 others/go 语言教程并列 |
| **Go 生态**（orb/go-geom/tegola/imposm3） | Go GIS | github.com/paulmach/orb、twpayne/go-geom、go-spatial/tegola、omniscale/imposm3 | MIT/BSD（以仓库为准） | orb ★约 1,100（2026-11 提交）、go-geom ★约 988、tegola ★约 1,500（v0.21.2，2026-09）、imposm3 ★约 775（2026-08） | Go 几何/矢量切片/OSM 导入 | 全仓 0 | **P2** | tegola/imposm 属“服务端/OSM 栈”越界，交其他方向；仅 orb/go-geom 属本方向，可 1 篇深文 |

## 详细说明（P0 / P1）

### P0-1｜PROJ（+ pyproj 3.8.0）
**为什么缺**：全仓 84 个文件提到 PROJ，但没有任何一处系统讲它——GDAL 第06章只讲“在 GDAL 里设置 CRS”，GeoPandas 第06章只讲 to_crs() 调用，QGIS/PostGIS 教程只讲界面/参数。PROJ 是从 EPSG 注册表到实际坐标数值的那一层，也是跨带、跨基准、跨高程基准出问题的真正位置。
**为什么值得补**：它是 OSGeo 官方项目、站点几乎所有教程的隐式依赖；中文互联网关于“WKT1 与 WKT2、CGCS2000 与 WGS84 差异、七参数该填哪个、高程异常怎么加”的资料零散且错误率高。该主题天然有 10+ 章，且每章都能落到工程排障，适合做成旗舰系列。
**建议章节方向**：CRS/大地基准/投影概念体系 → EPSG 注册表与 projinfo → proj 字符串到 WKT2:2019 → 投影正反算 → 基准转换（Helmert 七参数/四参数）→ 网格偏移（NTv2/HARN/geoid，含 grid 数据部署）→ 复合 CRS 与垂直基准 → 中国坐标系实战（CGCS2000/西安80/北京54/GCJ-02）→ 转换管线与精度评估 → C API 与 pyproj → Java/.NET 绑定 → 常见错误排障 → 与 GDAL/PROJ-data 集成 → 综合案例。
**与现有教程关系**：作为 GDAL 第06章、GeoPandas 第06章、QGIS 投影章节的“底层原理篇”被交叉引用；pyproj 不再单独立项。

### P0-2｜GEOS 3.15.0
**为什么缺**：Shapely 官网第一句就说自己包装的是“the engine of PostGIS, and a port of JTS”，但站点 Shapely 教程 20 章全在 Python 层，PostGIS 教程讲 SQL 函数，没人讲 GEOS 的 C API、OverlayNG、精度模型和空间索引实现。
**为什么值得补**：它是 OSGeo 官方项目、PostGIS/QGIS/GDAL/Shapely 的共同几何内核；站点正在写的 JTS 教程（24 章）恰好是其 Java 母本，两个教程可以互相引用形成“Java/C++ 双视角”，这是本站相对中文同行的差异化内容。C/C++ 读者与做 PostGIS 内核调优的读者都吃这套。
**建议章节方向**：定位与 JTS/GDAL 关系 → 构建与 C API → 几何模型与 WKT/WKB 流 → 谓词与 DE-9IM → OverlayNG 与鲁棒性/精度模型 → Buffer/距离/简化 → STRtree → 有效性修复（MakeValid）→ 3D 与 SFCGAL 边界 → PreparedGeometry 与性能 → 语言绑定与 PostGIS 内核视角。

### P0-3｜rasterio 1.5.2（含 rio CLI、pyogrio/Fiona 对照）
**为什么缺**：站点 Python 教程是“GeoPandas（矢量）+ Shapely（几何）+ GeoPipeAgent（流水线）”，**没有栅格侧**。GDAL 教程第07章讲的是 Python 绑定原理（osgeo.gdal），而 Python 社区实际写代码用的是 rasterio，两者完全不同的使用范式。
**为什么值得补**：rasterio 是 Python 栅格 IO 的事实标准（★约 2.6k、月内活跃），与已有 GeoPandas 教程能拼成完整的“Python GIS 数据栈”；中文 rasterio 资料多为零散片段，窗口读取、重投影对齐、COG、掩膜、rio CLI 这些工程要点恰好是读者卡点。
**建议章节方向**：定位与 GDAL 关系 → dataset/band 数据模型 → 读写与 profile → window/block 读取 → 掩膜与 nodata → warp/reproject → 重采样与对齐 → COG/overview → mosaic/merge → rio CLI → 与 numpy/dask 协同 → 性能 → 综合案例；附 1 章“pyogrio/Fiona 矢量 IO 对照”（GeoPandas 1.0 起默认引擎已换 pyogrio，Fiona 退居可选后端，故 Fiona 不单独立项）。

### P0-4｜OSMnx 2.1.1
**为什么缺**：站点没有任何 OSM 主题教程，OSMnx 只在 GeoPandas 第26章“第三方库集成”里被列了一行。中文现有 OSMnx 教程普遍针对 v0.x/v1.x，而 v2.x 的 API 与依赖已明显变化。
**为什么值得补**：★约 5.9k、月内活跃、作者有 2025 年方法论文，是城市/交通/规划方向最常用的 Python 库；与站点已有的 GeoPandas、PostGIS、可视化教程能自然衔接，且“路网 + POI + 建筑足迹”比纯矢量操作更贴近项目需求。
**建议章节方向**：OSM 数据模型与许可 → 安装/Overpass/缓存 → graph_from_* 与网络类型 → 图属性（长度/速度/坡度）→ 拓扑简化与清理 → 最短路径与路由 → 出行时间与可达性 → POI/建筑/设施 → 街道方位与可视化 → 城市形态指标 → 大数据与并发 → 综合案例（15 分钟生活圈/骑行网络）。

### P0-5｜PySAL 空间统计
**为什么缺**：站点有“几何操作”但没有“空间统计”。GeoPandas 第26/27章只是把 PySAL 列进集成清单，libpysal/esda 各 3 处提及，spaghetti/tobler/momepy/spopt 全仓 0 命中——等于没有。
**为什么值得补**：空间权重、Moran's I、LISA、空间聚类、区域化是 GIS 分析的核心方法，中文读者（地理/规划/经济地理/公共卫生）需求明确；PySAL 是 Python 侧事实标准（libpysal v4.15.1、2026-11-09 提交），且与 GeoPandas 数据模型无缝衔接。对站点而言，这是“从画图工具走向分析工具”的关键一跃。
**建议章节方向**：生态总览 → libpysal 空间权重 W（邻接/距离/KNN/kernel）→ 权重标准化与可视化 → 全局自相关（Moran/Geary）→ 局部 LISA 与聚类图 → esda 其他统计 → spopt 区域化（skater/max-p）→ momepy 城市形态 → spaghetti 网络统计 → tobler 面积插值 → spreg 空间回归入门 → 综合案例（人口/房价空间分析）。

### P0-6｜xarray + rioxarray
**为什么缺**：全仓仅 3 个文件 8 处提到 xarray，rioxarray 只有 GeoLibre 第19章 1 处；站点没有任何 N 维数组/NetCDF/Zarr 教程。但 GDAL 教程和 GeoLibre 都已把 xarray 当作“下一步”引用。
**为什么值得补**：气象、海洋、遥感、生态领域的栅格数据早已是 NetCDF/Zarr 形态，xarray（★约 4.2k，v2026.09）是这一层的标准数据模型，rioxarray 负责补上 CRS；与 rasterio 是“数据模型 vs IO 库”的分工，两者合起来才完整。中文 xarray 资料集中在气象社区，GIS 视角（CRS/重投影/与 GeoPandas 互操作）反而稀缺。
**建议章节方向**：定位与数据模型（DataArray/Dataset）→ 索引/切片/对齐 → 读写 NetCDF/Zarr/GRIB → 计算与 groupby/rolling → Dask 并行 → rioxarray CRS/重投影/裁剪 → 与 rasterio/GeoPandas 互操作 → 可视化 → 时序/多波段案例 → 工程化。
**与现有教程关系**：建议与 rasterio 合并规划为“Python 栅格分析”两卷，避免两套教程各写一半；若必须二选一，先 rasterio 后 xarray。

### P1-1｜GeoAI 遥感（segment-geospatial/SamGeo + TorchGeo）
**为什么缺**：GeoLibre 教程 6 章出现 28 次 SamGeo，但都是“平台功能罗列”；TorchGeo、eo-learn、Raster Vision 全仓 0 命中。站点 ai/ 目录有通用 AI 教程，却没有遥感深度学习实操。
**为什么值得补**：segment-geospatial（★约 4.2k）与 TorchGeo（★约 4.2k）都在月内活跃，中文读者对“大模型/分割一切模型落地遥感”兴趣极高；该主题适合 10 章实操专题，且能反哺 GeoLibre 教程（做深度解读而不是功能列表）。
**建议章节方向**：遥感 DL 概览与数据 → 环境/GPU → SamGeo 交互分割 → 批量分割与矢量化 → TorchGeo 数据集/采样器 → 预训练模型微调 → 分类/变化检测 → 精度评价 → 大图切片与推理工程化 → 案例。

### R 空间生态（建议 P2，可作语言生态储备；若站长想补 R 可升 P1）
**为什么缺**：全仓只有 GeoPandas 第01章有一节“GeoPandas vs R sf 包”，其余 R 包 0 命中；站点完全没有 R 内容。
**为什么值得补**：sf（★约 1.5k，2026-11-10 提交）是 R 侧 GeoPandas 对应物，terra/stars/tmap/lidR 覆盖栅格、数据立方、制图、点云，整套生态都活跃；高校与生态/林业/规划领域 R 用户稳定。对站点是“语言生态补位”，且能与 PySAL 形成“双语言空间统计”对照的独特内容。
**建议章节方向**：R 与空间生态总览 → sf 矢量模型与读写 → stars 栅格立方 → terra 栅格计算 → CRS 与投影（引用 PROJ 教程）→ tmap 制图 → mapview 交互 → spdep 空间统计 → lidR 点云 → 与 Python/GeoPandas 互操作 → 性能 → 案例。建议合并成一套 12 章，而不是 7 个小教程。

### P1-3｜movingpandas 0.23
**为什么缺**：仅 GeoPandas 第26章一句 + lin-ear-th-inking 文章一处，没有系统内容。
**为什么值得补**：★约 1.4k、基于 GeoPandas 的轨迹分析事实标准，中文系统资料稀缺；GPS/物流/出行/动物轨迹需求增长，且能复用站点已有的 Folium/GeoPandas 可视化章节，性价比高。
**建议章节方向**：轨迹数据模型 → Trajectory/TrajectoryCollection → 清洗/重采样/速度 → 停留点检测 → 分割与聚类 → 可视化 → 大规模与并行 → 案例。

## 已衰落 / 不建议清单

| 项目 | 原因 |
|---|---|
| **pygeos** | 已并入 Shapely 2.0（GEOS 后端直接进入 Shapely），历史包不应再立教程；若写，只在 Shapely 第19章迁移指南里提一句 |
| **Fiona** | 仍维护（v1.10.1），但 GeoPandas 1.0 起默认 IO 引擎改为 pyogrio，Fiona 退居可选后端；**不单独立系列**，并入 rasterio 教程的 IO 对照章 |
| **GMap.NET** | WinForms 时代控件，社区 fork 最后提交 2023-05，上游生态老化；功能已被 Mapsui/SharpMap 教程覆盖 |
| **SharpKml** | 最后提交 2024-04，维护弱；KML 读写需求已被 NTS/SharpMap/GDAL 教程覆盖 |
| **DotSpatial** | 最后提交 2025-10 后趋停滞，能力与 NetTopologySuite/SharpMap/Mapsui 教程重叠 |
| **geemap / Google Earth Engine 系** | 强依赖 GEE 商业服务与账号配额，不适合做“开源 GIS”系列；如需，仅在 GeoAI 专题做 1 篇对比综述（Python 侧替代：leafmap + 开源影像） |
| **Raster Vision** | 2026-06 后无提交，维护明显放缓；仅在 GeoAI 专题中作“历史/对比”提及，不立项 |
| **Mapbox GL JS v2+ / SuperMap 等商业产品** | 闭源或商业许可，按任务口径排除 |
| **NetTopologySuite.IO / BruTile / MaxRev.Gdal.Core / Hibernate Spatial / GeoAlchemy2 / geopy / folium / contextily** | 已在现有教程内覆盖（NTS、Mapsui/SharpMap、GDAL/OpenGIS Utils、PostGIS 第17章、GeoPandas、Shapely），**无需新增教程**，最多在对应教程补一节 |

## 其他可提一句（不占表格）

- **ntv2 / proj-data 网格文件、EPSG 数据库更新**：作为 PROJ 教程的运维小节，不独立。
- **Shapely 2.2 / GEOS 3.15 版本差异**：在 GEOS 与 Shapely 教程之间加“版本对照”交叉引用即可。
- **h3-pg**（postgis/h3-pg）：H3 的 PostgreSQL 绑定，若 spatial-db-osm 方向的网格专题立项，可作为一章。
- **contextily**（★约 599）：已在 GeoPandas 第21章使用，不单列。
- **GeoAlchemy2**（★约 712）：已在 PostGIS 第17章覆盖，不单列。

## 越界发现与协作提示

1. **H3 / S2 与 docs/gap-analysis/spatial-db-osm.md 重叠**：该笔记已把 H3（6,718★）、S2（2,748★）列为 P2 并建议合并成“空间索引与网格编码”专题。**我同意不再重复立项**；若 lead 决定做，建议由 spatial-db-osm 方向牵头（其已有 H3 索引/h3-pg 细节），我侧可在“PySAL/OSMnx 教程”里各写 1 节接入网格聚合。
2. **OSMnx 与 OSM 数据栈分工**：OSMnx 教程聚焦“网络分析与城市形态”（我的方向），OSM 数据下载/入库/瓦片属 spatial-db-osm 方向；建议第2章直接引用其 OSM 数据与许可内容，两边不写两套 OSM 介绍。
3. **PROJ/GEOS 与 server-cloud、postgis 方向**：这两个引擎会被 GeoServer Cloud/PostGIS 教程反复引用。建议 PROJ/GEOS 教程只写“引擎与原理”，配置用法留在原有教程，双向交叉链接，避免内容打架。
4. **GeoAI 与站点 ai/ 及 gis/bpc/gisai 内容**：本报告建议的是“遥感 DL 工具链实操”，理论/产业分析引用既有内容，不重复写。
5. **xarray 若其他方向计划做“科学计算/气象”教程**：需与 lead 裁决归属；我侧按“GIS 栅格分析”角度写 CRS/重投影/互操作，偏气象的 Lab 可留给科学计算方向。

## 不确定点（请 lead 裁决）

1. 星数来自 shields.io 四舍五入（2k/1.5k/2.7k…），**不是精确值**，报告中已统一标“约”；GitHub API 配额全队共用，我仅用了 1 次。
2. 少数仓库更名/迁移未逐一核实：**geemap**（GitHub 仓库地址 shields 查不到，文档站 geemap.org 正常）、**ArchGDAL.jl**（疑在 yeesian/ArchGDAL.jl 而非 JuliaGeo 组织）、**rasterstats**（perrygeo/python-rasterstats，疑迁移）、**SFCGAL**（GitHub 为镜像，主仓在 GitLab，活跃度未核）。这些都在 P2/不建议，不影响 P0/P1 结论。
3. **Fiona 的定位**：仍维护且 GeoPandas 仍支持，我建议并入 rasterio 对照章而非独立系列；若站点希望“每库一教程”的整齐结构，可上调为 6 章小系列。
4. **xarray 是否算“GIS 缺口”**：它是通用科学计算库，我按站点受众（遥感/气象读者）判断为 P0 末位；若 lead 认为应归入科学计算方向，可降为 P1 并只做 rioxarray 部分。
5. **H3/S2 归属**：与 spatial-db-osm 方向重复，建议由 lead 决定统一归属，避免两篇笔记各推一次。
