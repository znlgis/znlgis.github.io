# 教程缺口调研：桌面 GIS / 三维点云 / 摄影测量 / 遥感平台

> 调研员：desktop3d　｜　调研日期：2026-11-11　｜　仓库：D:\self\code\znlgis.github.io
> 范围：开源桌面 GIS 平台、三维/点云处理、摄影测量/无人机、遥感处理平台。不含 Web 前端、服务端、纯语言库（这些由其他组负责）。
> 证据口径：GitHub stars 取自 shields.io 缓存（2026-11-11 抓取）；活跃度取自 GitHub API 的 `pushed_at`（2026-11-11 查询）；OSGeo 身份按 osgeo.org 项目页是否存在判定，**未逐页核对"项目/社区项目/孵化"徽标等级**；停更项目的时间来自公开资料与仓库可达性，未逐一打开旧官网复核，标注为"约"。

## 结论速览

- **P0（建议优先立项，10+ 章系列）**：GRASS GIS（开源桌面 GIS 计算引擎鼻祖）、OpenDroneMap / WebODM（无人机航测—实景三维全流程）、PDAL（点云界的 GDAL，可带 Entwine 一章）。
- **P1（值得做系列或 8~12 章重点专题）**：OTB、SNAP（两大遥感处理平台）、CloudCompare（点云桌面处理）、osgEarth（实景三维/仿真三维地球）、WhiteboxTools（国土/水文分析）、GeoDa（空间统计与空间自相关）、3DCityDB + CityGML（三维城市数据库）。
- **P2（可做单篇专题或并入他人教程的一章）**：Potree/Entwine（Web 点云，注意与 webfront 组去重）、摄影测量工具链（Meshroom/AliceVision、OpenSfM、COLMAP、MicMac）、Open Data Cube、openEO、Open3D（跨界）、MapWindow5/OpenJUMP（边缘）、py3dtiles/SFCGAL（小工具/已被 PostGIS 教程间接覆盖，不建议单独立项）。

一句话判断：站点现有 21+ 套教程集中在"开发库 + 服务端 + Web 三维"，**缺的是"桌面软件与生产管线"这一层**——数据从无人机/点云/影像到可用成果的实操链路，恰好是中文读者（测绘、自然资源、应急、规划、高校）搜索量最大、而中文系统教程最少的部分。

## 站点现有相关覆盖（判定依据）

- `gis/tutorial/` 已有 21 套 + JTS 脚手架：QGIS（20 章）、GDAL（15 章）、PostGIS（18 章）、CesiumJS（18 章，Web 三维）、GeoPandas（27 章）、GeoLibre（26 章，含第 14 章地形水文、第 16 章遥感影像、第 17 章点云与 LiDAR、第 12 章地理处理工具箱）、JTS（24 章，在建）。
- `gis/bpc/gis3d`（24 篇）是**分析报告型**教程，论述了 3D Tiles、点云格式、Potree、OSGB、倾斜摄影、CityGML、重建路线，但**没有工具实操**；`gis/bpc/yzt`、`giszj`、`giscad` 等白皮书同理。
- `3d/` 目录有 SuperSplat（3DGS，第 01/02 章提及 COLMAP 作为前置重建）、Photo-Sphere-Viewer、OpenCSG.NET 等，属三维开发，不是 GIS 平台教程。
- 全仓库检索结果（排除 `docs/gap-analysis`）：gvSIG、ILWIS、Kosmo、osgEarth、3DCityDB、py3dtiles、OpenDroneMap/WebODM、MicMac、Meshroom/AliceVision、OpenSfM、Open Data Cube **零命中**；GRASS/SAGA/OTB/PDAL/Entwine/CloudCompare/WhiteboxTools/GeoDa/Potree/SNAP **仅顺带提及**，无独立教程。

## 明细表

| 项目 | 类别 | 官网/GitHub | License | 主流度证据 | 一句话定位 | 仓库覆盖状态 | 优先级 | 与现有教程的关系/建议 |
|---|---|---|---|---|---|---|---|---|
| GRASS GIS | 桌面 GIS/栅格计算 | grass.osgeo.org；OSGeo/grass | GPL-2.0+ | OSGeo 官方项目；GitHub 约 1.2k★（主仓为 OSGeo SVN，星数低估）；2026-11-11 仍有推送 | 40 余年历史的栅格/矢量计算引擎，QGIS 的"重计算后端" | 未覆盖：仅 QGIS 教程第 10/13 章作为 Processing provider 提及 | **P0** | 与 QGIS 教程互补（QGIS 会调 GRASS 模块但没讲 GRASS 本身）；栅格代数/地形水文/temporal 框架是 QGIS 讲不深的部分 |
| OpenDroneMap / WebODM | 摄影测量/无人机 | opendronemap.org；OpenDroneMap/ODM、OpenDroneMap/WebODM | AGPL-3.0 | ODM 约 6.6k★、WebODM 约 4.3k★；均 2026-10 有推送；OSGeo 社区项目（官网有项目页） | 无人机影像→正射/DSM/点云/三维瓦片的开源全流程 | 未覆盖（零命中） | **P0** | 与 CesiumJS 教程天然衔接（ODM 产出 3D Tiles 可直接进 Cesium）；实景三维中国/应急测绘的中文资料缺口最大 |
| PDAL | 点云处理库/CLI | pdal.io；PDAL/PDAL | BSD-3 | 约 1.4k★；2026-11-10 有推送；OSGeo 官网有项目页 | "点云界的 GDAL"：LAS/LAZ/EPT 读写、滤波、分类、Pipeline JSON | 仅提及：GeoLibre 第 17 章、QGIS 第 18 章、gis3d 白皮书 | **P0** | GDAL 教程的兄弟篇（同样 C++/Python/CLI 三接口）；站点点云处理目前只有 GeoLibre 应用层 |
| Orfeo ToolBox (OTB) | 遥感处理平台 | orfeo-toolbox.org；orfeotoolbox/OTB | Apache-2.0 | 约 0.4k★ 但为 CNES 官方项目、OSGeo 官方项目；2026-11-05 有推送 | 大规模光学/SAR 影像处理（正射、融合、分类、SAR） | 仅提及：ai/opengis-skills 第 12 章一句 | **P1** | 与 GDAL（读写）、QGIS（Processing 集成）互补；中文 OTB 资料少 |
| SNAP (ESA) | 遥感处理平台 | step.esa.int；senbox-org/snap-engine | GPL-3.0 | GitHub 镜像约 0.2k★（官网/发行版下载量大，星数严重低估）；2026-11-09 有推送 | Sentinel 系列/InSAR/时序分析事实标准工具 | 未覆盖（精确检索 0） | **P1** | 与 OTB 二选一可先做 OTB（工程化更强），SNAP 面向 Sentinel/InSAR 读者；两者可写在同一专题对照 |
| CloudCompare | 点云桌面处理 | cloudcompare.org；CloudCompare/CloudCompare | GPL-2.0+ | 约 4.9k★；2026-11-09 有推送 | 点云查看/配准/滤波/量测/网格的桌面事实标准 | 仅提及：ai/opengis-skills 一句 | **P1** | 与 PDAL 形成"桌面点云"组合（PDAL 批处理、CloudCompare 交互质检）；中文实操教程稀缺 |
| osgEarth | 三维地球渲染 | osgearth.org；gwaldron/osgearth | MIT | 约 1.8k★；2026-11-10 有推送；底层 OpenSceneGraph 约 3.6k★ | C++ 三维地球/地形 SDK，军工仿真与桌面端实景三维常用 | 未覆盖（OpenSceneGraph 仅 gis3d 附录术语表提及） | **P1**（专题） | 与 CesiumJS 教程成"Web/桌面"双路线；中文资料极少，适合 10 章左右专题 |
| WhiteboxTools | 地形/水文分析工具集 | whiteboxgeo.com；jblindsay/whitebox-tools | MIT | 约 1.2k★；2026-05-26 有推送；QGIS 插件生态里有官方入口 | 500+ 地形/水文/栅格分析工具的 Rust 实现，Python/R/QGIS 可调 | 仅提及：GeoLibre 第 26 章、ai/opengis-skills | **P1**（专题） | 与 GeoPandas 教程（矢量）互补为"栅格分析"链路；国土空间/水文分析常用，8~10 章够用 |
| GeoDa | 空间统计/探索分析 | geodacenter.github.io；GeoDaCenter/geoda | GPL-3.0 | 约 0.8k★；2026-10-24 有推送；ASU GeoDa Center 长期维护 | 空间自相关（Moran/LISA）、空间聚类、空间回归的经典教学工具 | 未覆盖（"GeoDa"精确检索 0，此前 454 次是 GeoDataFrame 误匹配） | **P1**（专题） | 与 GeoPandas 教程互补（GeoPandas 不做空间统计推断）；规划/地理教学读者刚需 |
| 3DCityDB + CityGML | 三维城市数据库 | 3dcitydb.org；3dcitydb/3dcitydb | Apache-2.0 | 约 0.5k★；2026-11-10 有推送 | CityGML 三维城市模型的关系库/工具链（v5 起独立于 Oracle，支持 PostGIS） | 未覆盖（CityGML 仅格式层面被 geopandas 第 7 章、gis3d 白皮书提及） | **P1**（专题） | 与 PostGIS（空间库）、Cesium（三维可视化）串成"CIM/实景三维数据库"闭环，符合 CIM/数字孪生热点 |
| Potree | Web 点云可视化 | potree.org；potree/potree | BSD-2 | 约 5.7k★；最后推送 2026-01-08（维护放缓但仍是事实标准） | 海量点云 WebGL 浏览器查看（Potree 格式/Octree） | 仅提及：gis3d 第 05 章一句 | P2 | 与 Entwine（EPT 索引）配套；可能与 webfront 组范围重叠，建议合并成一个"Web 点云"专题或并入 Cesium 教程附录 |
| Entwine | 点云索引/ETL | entwine.io；connormanning/entwine | LGPL-2.1 | 约 0.5k★；2026-06-02 有推送；PDAL 生态官方配套 | 把海量 LAS/LAZ 建成 EPT 索引，供 Potree/PDAL 使用 | 仅提及：gis3d 第 02/03/05 章、GeoLibre 第 17 章 | P2 | 最自然的归属是 PDAL 教程的一章，不单独立项 |
| Meshroom / AliceVision | 摄影测量/三维重建 | alicevision.org；alicevision/Meshroom、alicevision/AliceVision | MPL-2.0 | Meshroom 约 13k★、AliceVision 约 3.5k★；2026-11-10 有推送 | 图形化 SfM+MVS 三维重建（照片→网格/纹理） | 未覆盖 | P2 | 与 ODM（无人机/正射）分工不同；可做"开源摄影测量"专题，或与 3d/supersplat（3DGS）联动 |
| OpenSfM | SfM 引擎 | opensfm.org；mapillary/OpenSfM | BSD-2 | 约 3.8k★；2026-11-02 有推送（代码仍维护，正式发布稀疏） | Mapillary 出品的 Structure-from-Motion 引擎 | 未覆盖 | P2 | 偏库/管线，适合摄影测量专题中的"引擎层"一章 |
| COLMAP | SfM/MVS 引擎 | colmap.github.io；colmap/colmap | BSD-3 | 约 13k★；学术/3DGS 管线标配 | 通用 SfM+MVS 重建引擎 | 间接提及：3d/supersplat 第 01/02 章（3DGS 前置流程） | P2 | 站点已在 3DGS 语境讲过 COLMAP，独立成系列会重复；建议只做专题章节 |
| Open Data Cube | 遥感数据立方体 | opendatacube.org；opendatacube/datacube-core | Apache-2.0 | 约 0.6k★；2026-11-10 有推送 | 基于 PostGIS 的 ARD 影像数据立方体（Landsat/Sentinel 时序） | 未覆盖 | P2 | 与 PostGIS 教程衔接（底层就是 PostGIS 表）；受众偏科研/政府，可 6~8 章专题 |
| openEO | 遥感云处理标准/客户端 | openeo.org；Open-EO/openeo-python-client | Apache-2.0 | 客户端约 0.2k★；平台生态（GEE、CDSE 等后端） | 跨平台遥感处理 API 标准，用来"一次写、多云跑" | 仅提及：gis/bpc/gisai 4 处（政策/数据出境语境） | P2 | Google Earth Engine 闭源不可做教程，openEO 是其开源规范化替代，可做"GEE 对照"专题 |
| Open3D | 通用三维处理库 | open3d.org；isl-org/Open3D | MIT | 约 14k★ | 点云/网格的通用 3D 处理与 ML 库，非 GIS | 仅提及：ai/opengis-skills | P2（跨界） | 与 GDAL/PDAL 生态无直接耦合；若做"点云深度学习"才值得，否则提一句即可 |
| MapWindow5 | 桌面 GIS（.NET） | mapwindow.org；MapWindow/MapWindow5 | MPL-2.0 | 约 0.3k★ | Windows/.NET 桌面 GIS，插件式 | 仅提及：SharpMap 第 13 章一句 | P2（边缘） | 与 SharpMap/Mapsui 教程同属 .NET 桌面，增量价值有限 |
| OpenJUMP | 桌面 GIS（Java） | openjump.org | GPL | 2024 年仍有 2.3.0 发布（邮件列表），GitHub 主仓不可达，仓库在 SourceForge | 轻量 Java 桌面 GIS（JUMP 血脉） | 仅提及：PostGIS 第 01 章 | P2（边缘） | 与 GeoTools/JTS 教程重叠度高，可作"PostGIS 桌面客户端"一小节 |
| SFCGAL | 三维几何运算库 | gitlab.com/sfcgal/SFCGAL | LGPL-2.1 | GitHub 镜像 114★ 且已归档（2024-03，主仓在 GitLab） | PostGIS 三维/曲面运算后端 | **已间接覆盖**：PostGIS 教程第 02/13/14 章、gis/basic PostGIS 简介 | 不建议单独立项 | 已在 PostGIS 教程里讲过依赖关系，补一章 SFCGAL 实操即可 |
| py3dtiles | 3D Tiles 生产库 | py3dtiles 文档站（官方在 GitLab；GitHub 镜像星数不可信，约几十级） | Apache-2.0 | 2026-10 有推送；小众但被 ODM 等管线引用 | 点云/矢量转 3D Tiles 的 Python 工具 | 未覆盖 | P2（小工具） | 只在 Cesium/PDAL 教程里带一节即可，撑不起系列 |

## 详细说明（P0 / P1）

### P0-1 GRASS GIS
- **为什么缺**：站点有 20 章 QGIS 教程，但 GRASS 只以"QGIS 里的 Processing 插件"身份出现（QGIS 第 10、13 章），读者无法独立使用这个 1982 年起持续开发的 OSGeo 官方项目；全站零篇 GRASS 正文。
- **为什么值得补**：中文 GRASS 资料严重依赖十年前的翻译版教材，而 GRASS 8.x 已有 Python API、temporal 时序框架和与 QGIS 的双向工程；它是"桌面端做大规模栅格/水文/生态计算"的少数开源选择，高校与科研读者基础广。
- **建议章节方向**：①安装与界面/区域与栅格地图代数；②r.mapcalc/r.reclass 与栅格代数；③地形与水文模块（r.watershed/r.flow）；④矢量拓扑与 v.* 工具链；⑤temporal 时序数据；⑥Python API（grass.script）与批处理；⑦GRASS↔QGIS/PostGIS 联动；⑧自定义模块与插件开发；⑨生态/水文综合案例。

### P0-2 OpenDroneMap / WebODM
- **为什么缺**：全仓库零命中，而"无人机航测→正射/DSM/点云/三维瓦片"是实景三维中国、应急测绘、自然资源巡查的日常生产链；站点 CesiumJS 教程讲了怎么"用"三维数据，却没讲怎么"造"三维数据。
- **为什么值得补**：ODM（约 6.6k★）+ WebODM（约 4.3k★）是目前唯一成熟的开源端到端航测管线，2026 年仍在密集提交；AGPL 但可自托管，中文读者对"从无人机照片到 3D Tiles"的完整教程需求大、供给极少。
- **建议章节方向**：①航测基础与 ODM 安装（Docker/原生）；②影像采集规范与 POS/GCP；③空三（SfM）流程与质量检查；④正射影像/DSM/DTM 输出与精度评估；⑤密集点云与分类；⑥三维网格/纹理与 3D Tiles 输出；⑦WebODM 平台部署与任务管理；⑧大区域分块、集群与性能；⑨与 QGIS/Cesium 成果对接；⑩典型行业案例（应急、自然资源、工程）。

### P0-3 PDAL（+ Entwine）
- **为什么缺**：站点有 GDAL 教程但点云处理完全空白；PDAL 只在 GeoLibre 第 17 章（应用层点云面板）和 3D 白皮书里被提到，读者学不到"点云界的 GDAL"这条管线。
- **为什么值得补**：PDAL 约 1.4k★、OSGeo 官网有项目页、2026-11 仍活跃；中文点云教程多为商业软件（LiDAR360、Terrasolid）或 Python 碎片脚本，缺系统级 ETL 教程；而且它与 GDAL 教程天然同构（C++ 库 + CLI + Python），是"教程矩阵"里最顺的补位。
- **建议章节方向**：①点云格式与 LAS/LAZ 结构；②PDAL 安装与 pdal info/translate；③Pipeline JSON 与 stage 模型；④滤波/去噪/地面分类（SMRF/PMF）；⑤坐标系统与点云重投影；⑥Python 绑定与批处理；⑦Entwine/EPT 索引（配合 Potree）；⑧与 PostGIS/GeoPackage/Cesium 3D Tiles 集成；⑨性能与超大点云；⑩质检与工程案例。

### P1-1 Orfeo ToolBox (OTB)
- OSGeo 官方项目、CNES 出品、Apache-2.0，2026-11 仍活跃；站点只剩一句提及。OTB 是"大规模遥感影像处理"的工程化选择（正射、融合、分类、SAR），可被 QGIS/CLI/Python 调用，正好补 GDAL 教程（读写）与应用之间的处理层。建议 10 章左右：安装与 OTB Applications、影像预处理/正射、融合与分割、监督分类、SAR 处理、Python API、与 QGIS/OTB 插件集成。

### P1-2 SNAP (ESA)
- GitHub 镜像星数低（约 217）但它是 Sentinel/InSAR 的事实标准，官网下载与 ESA 生态支撑强；站点精确检索零覆盖。中文读者做 Sentinel-1 时序、InSAR、NDVI 的需求大而系统教程少。建议先做 8~10 章专题（安装、Sentinel 数据、Graph Builder 批处理、InSAR 基础、GPT 命令行、Python/EO 扩展），并在开头与 OTB 做选型对照，避免与 OTB 教程内容重复。

### P1-3 CloudCompare
- 约 4.9k★、2026-11 仍活跃，桌面点云交互处理事实标准；站点只在一份 AI 技能清单里出现过一句。与 PDAL 形成"批处理 vs 交互式"组合，对测绘/建筑/文保读者很实用。建议 8~10 章：界面与格式、点云配准（ICP）、裁剪与分割、滤波与法线、量测与断面、网格与纹理、插件/脚本（CloudCompare 命令行 CLI）。

### P1-4 osgEarth
- 约 1.8k★、MIT、2026-11 仍活跃，是做桌面/嵌入式三维地球（实景三维、军事仿真、指挥大厅）的 C++ 事实标准；站点没有任何覆盖（OpenSceneGraph 只在白皮书术语表出现）。与 CesiumJS 教程形成"Web/桌面"互补；门槛高、中文资料极少，适合做 10 章左右专题：OSG/osgEarth 架构、地形与影像图层、模型/倾斜摄影加载、坐标与精度、动画与交互、性能优化、工程集成。

### P1-5 WhiteboxTools
- 约 1.2k★、MIT、2026 年仍有提交，500+ 地形/水文/栅格分析工具且提供 Python/R/QGIS 接口；站点只在 GeoLibre 综合案例和 AI 技能清单里提过。它对"国土空间/水文/选址"读者非常实用，与 GeoPandas 教程（矢量）互补成"栅格分析"链路。建议 8~10 章专题：安装与 Python 接口、DEM 预处理、水文分析（流向/汇流/流域）、地形指标、栅格代数与重分类、与 GeoPandas/QGIS 联动。

### P1-6 GeoDa
- 约 0.8k★、GPL-3.0、ASU 长期维护（2026-10 有提交）；站点零覆盖（此前命中均为 GeoDataFrame 误匹配）。空间自相关（Moran/LISA）、空间聚类、空间回归是规划/地理/社科读者的刚需，而 GeoPandas 教程不做统计推断。建议 8~12 章专题：数据准备、空间权重矩阵、全局/局部 Moran、LISA 图、空间聚类、空间回归、与 GeoPandas/GeoDa 联动。

### P1-7 3DCityDB + CityGML
- 约 0.5k★、Apache-2.0、2026-11 仍活跃；CityGML 只在格式介绍里出现，没有任何"三维城市数据库"实操。CIM/数字孪生/实景三维中国背景下，把 CityGML 模型入库、查询、导出 3D Tiles 的链路很有价值，且能与站内 PostGIS + Cesium 教程串成闭环。建议 8~10 章专题：CityGML/LOD 概念、3DCityDB 部署（PostGIS）、导入导出、SQL 查询、Web 可视化、与 Cesium/3D Tiles 对接。

## 已衰落 / 不建议单独立项

| 项目 | 结论 | 原因 |
|---|---|---|
| uDig | 不建议 | GitHub 仓库已不可达（API 404），最后发布约 2.2.0（2019），LocationTech 生态已基本停摆；功能被 QGIS 全面覆盖。仅可在 GeoTools/PostGIS 教程里提一句。 |
| Kosmo | 不建议 | 西班牙语社区项目，约 2015 年后停止维护，无中文资料价值。 |
| ILWIS | 不建议 | 约 2019 年后停更（3.8.x 为末代），现仅剩小众的 ILWISPy 衍生项目；遥感/栅格功能已被 GRASS/OTB 覆盖。 |
| gvSIG | 不建议（或降为 P2 边缘） | 曾是 OSGeo 官方桌面 GIS，但社区与发版明显萎缩、GitHub 主仓不可查（官网仍有 2024 年博客）；中文教程需求已被 QGIS 吸收。 |
| OpenJUMP | P2 边缘 | 2024 年仍有 2.3.0 发布，但用户群小、源码主仓在 SourceForge；与 GeoTools/JTS 教程重叠，做一篇"PostGIS 桌面客户端"即可。 |
| MicMac | P2 边缘 | IGN France 的摄影测量套件，维护弱、文档差、中文资料几乎为零；已有 ODM/Meshroom 覆盖同类需求。 |
| Google Earth Engine | 排除（非开源） | 闭源 SaaS，不能写"开源教程"；可在 openEO 教程中做对照说明。 |
| SuperMap / Mapbox GL / ContextCapture 等 | 排除（商业闭源） | 不属开源教程范围；仅可作选型对照。 |

## 其它可提一句（不占表格）

- **SAGA GIS**：老牌桌面 GIS（地形/地统计强），SourceForge 时代项目、GitHub 镜像仅数十星，中文教材有一些但版本老旧。价值低于 GRASS，若 GRASS 教程立项后读者有栅格分析扩展需求，可在 GRASS/WhiteboxTools 教程中作横向对比。
- **QGIS 插件生态**：QGIS 教程已有 20 章，不建议再开系列；可在现有教程内加"Processing/插件开发"专题补强。
- **OpenSceneGraph**：osgEarth 的底层渲染引擎，约 3.6k★；只应在 osgEarth 教程第 1 章讲清依赖关系，不单独立项。
- **OSGB/倾斜摄影格式转换**：站点白皮书（gis3d、giszj）反复提到 OSGB，但都是格式论述；等 ODM/osgEarth 教程立项后，作为其中一章（OSGB→3D Tiles 转换）即可，不需要独立系列。

## 越界发现（供 lead 去重/分工）

1. **Potree / Entwine / py3dtiles**：兼具"点云处理"和"Web 前端可视化"，可能落在 webfront 组范围。建议归口：PDAL 教程（P0）带 Entwine 一章；Potree 单独归 webfront 或作为 CesiumJS 教程补充章，避免两组各写一遍。
2. **SFCGAL**：libslangs 组可能从"几何引擎/PostGIS 依赖"角度覆盖；它已在本站 PostGIS 教程间接讲过，建议不立项，最多在 PostGIS 教程补一节。
3. **COLMAP / 3DGS**：3d 目录已有 supersplat 教程（3DGS 管线），COLMAP 已作为前置提及；摄影测量专题（ODM/Meshroom）立项时必须与该教程做链接，避免重复讲 COLMAP。
4. **QGIS 插件/Processing**：如果 libslangs 或其他人从"库"角度写 QGIS 相关，请与本笔记的"GRASS 作 QGIS 后端"分工对齐，GRASS 独立成系列。
5. **CAD/三维目录**（cad/*、3d/*）已有大量非 GIS 三维教程，本次未纳入统计，避免与站点"三维开发"内容混淆。

## 不确定点与建议复核

- **OSGeo 身份等级**：GRASS、OTB、gvSIG 为 OSGeo 官方项目，PDAL、ODM 有 OSGeo 项目页（社区项目）；本次通过项目页存在性判断，未核对"孵化/毕业"徽标，写宣传文案前建议到 osgeo.org 项目页复核一次。
- **SNAP 星数不代表用户量**：GitHub 只是镜像，ESA 官网发行版用户远大于 217★；同理 GRASS（主仓 SVN）、SAGA（SourceForge）星数均低估。
- **停更项目时间**：uDig（约 2019）、ILWIS（约 2019）、Kosmo（约 2015）、gvSIG（约 2024 仍有博客）来自公开资料与仓库可达性，未逐一打开旧官网核验，正式写作前需复核。
- **py3dtiles 仓库**：GitHub 镜像星数不可信（官方主仓在 GitLab），主流度按"ODM/3D Tiles 管线引用"间接判断。
- **中国读者需求判断**（实景三维、国土、应急、高校教学）来自领域常识与站点定位推断，没有搜索指数数据支撑；建议 lead 用百度/微信指数或知乎搜索量再校准 P0 排序。
- **时间预算**：本次以"覆盖面 + 可核验证据"为目标，未对每个项目做逐版发布历史核查；P0/P1 的活跃度都有 2026-10/11 的 GitHub 推送证据支撑。

## 附：本次检索与证据记录

- 全仓库 grep（排除 gap-analysis）覆盖 38 个关键词；`GeoDa` 首次 454 次命中经二次精确检索确认为 `GeoDataFrame` 误匹配，实际未覆盖。
- GitHub API 查询（2026-11-11）：GRASS 1187★/pushed 2026-11-11、PDAL 1432★/2026-11-10、ODM 6597★/2026-10-29、osgEarth 1820★/2026-11-10、Potree 5663★/2026-01-08、CloudCompare 4855★/2026-11-09、OTB 393★/2026-11-05、SNAP 217★/2026-11-09、GeoDa 812★/2026-10-24、WhiteboxTools 1222★/2026-05-26、3DCityDB 488★/2026-11-10、Meshroom 13080★/2026-11-10、OpenSfM 3818★/2026-11-02、ODC 596★/2026-11-10、Entwine 534★/2026-06-02、SFCGAL 114★/已归档、uDig 仓库 404。
- shields.io 补充星数：OpenSceneGraph 3.6k、Open3D 14k、AliceVision 3.5k、COLMAP 13k、WebODM 4.3k、QGIS 15k、MapWindow5 约 0.3k。
- OSGeo 官网项目页（可访问）：grass-gis、orfeo-toolbox、pdal。
