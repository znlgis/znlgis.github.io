---
layout: default
title: 第02章 标准与数据格式（上）：3D Tiles 与关键标准
---

# 第02章 标准与数据格式（上）：3D Tiles 与关键标准

> **本章导读**
>
> 标准常被当成背景知识跳过，它却决定数据底座五年后还能不能用。本章对应原报告 2.1.1—2.1.2 节：先把 3D Tiles 三个版本摆清楚——1.0 是 OGC 18-053r2 社区标准，1.1（OGC 22-025r4）于 2022-12-17 通过并以 glTF 作瓦片载荷，2.0 截至 2026-04 仍在社区标准流程中；再拆 2.0 补进来的体素、时态、AEC 与 3DGS 扩展；最后说清 CityGML、CityJSON、IFC、I3S、COPC 与 GeoPackage 的分工。

## 学习目标

读完本章，你应当能够：

- 按文档号与通过时间，准确复述 3D Tiles 1.0、1.1、2.0 三个版本的状态差异；
- 说出 3D Tiles 2.0 在空间分块、坐标配准、语义时态、体素、矢量、AEC、3DGS 七类扩展各补了什么能力；
- 用 2.1.2 节的表判断某个项目该选 CityGML 还是 CityJSON，并说明编码与压缩量方面的理由；
- 说清 IFC 4.3 纳入 IfcRoad、IfcRailway、IfcBridge、IfcTunnel 对线性工程 BIM+GIS 的实际意义；
- 复述 COPC 仅支持 PDRF 6/7/8 这一约束，并在转换前核对原始点云的记录格式；
- 指出“GeoPackage 1.4.0 支持三维”是误读，并说明 1.4.0 的实际变更范围。

## 2.1.1 3D Tiles：从“渲染格式”到“空间分块基础设施”

3D Tiles 由 Cesium 于 2015 年提出，2019 年成为 OGC 社区标准。当前状态需要精确表述：

| 版本 | 文档号 | 状态 | 关键能力 |
|---|---|---|---|
| 3D Tiles 1.0 | OGC 18-053r2 | Community Standard | b3dm / i3dm / pnts / cmpt 四种瓦片格式，层级 LOD |
| 3D Tiles 1.1 | **OGC 22-025r4** | Community Standard，**2022-12-17 通过** | 直接以 glTF 作为瓦片载荷，支持隐式分块（implicit tiling）、元数据（metadata） |
| 3D Tiles 2.0 | 在研 | **2026-04 处于 OGC 社区标准流程**，Cesium 称 2026 年内批准 | glTF 2.1 基线，矢量瓦片、体素、时态、AEC 扩展、3DGS |

来源：〔OGC 3D Tiles 标准页 https://www.ogc.org/standards/3dtiles/〕〔CesiumGS/3d-tiles next/2.0 README〕

**3D Tiles 2.0 是本次技术演进的核心事件，值得逐项拆解。** 它把 glTF 2.1 作为统一载荷基线，通过一组地理空间扩展补足 GIS 语义：

**空间分块与索引类**
- `3DTILES_tileset`、`3DTILES_implicit_tiling`、`3DTILES_subtree`：用四叉树/八叉树的**紧凑表示**替代逐瓦片 JSON 描述，加速空间查询与遍历。这是隐式瓦片的核心——CesiumJS 1.146 正是在此基础上把大型建筑数据集加载提速 23 倍、内存降低 13 倍。
- `3DTILES_shape_s2`：允许用 Google S2 单元作为包围体，适合全球尺度瓦片集。
- `3DTILES_shape_cylinder_region`、`3DTILES_shape_ellipsoid_region`：圆柱与椭球包围体，贴合地球曲率与特殊形体（如塔筒、储罐区域）。
- `3DTILES_horizon_occlusion_point`：地平线遮挡点，用于运行时视锥剔除。

**坐标与配准类（BIM+GIS 的关键）**
- `EXT_geospatial_crs` / `EXT_geospatial_crs_wkid` / `EXT_geospatial_crs_wkt2`：在 glTF 资产内**声明坐标系**，分别支持 EPSG 代码（WKID）与 WKT2 描述。
- `EXT_georeference`：把 glTF 节点地理配准到指定地理坐标。
- `EXT_node_visibility_volume`：定义可视体，只有视点进入该体才请求并细化该瓦片——对室内、地下场景尤其关键。

**语义与时态类**
- `3DTILES_layers`：内容归属图层，承载应用自定义属性。
- `EXT_node_visibility_conditions`：**时态瓦片**的核心，允许瓦片按 `keys`（时间戳、修订号等字符串）选择条件内容。这直接支撑施工进度对比、地形变迁、洪水演进时序。

**体素类**
- `EXT_voxels`：在 glTF 中存储均匀体素网格，属性以连续场方式填充。这是地质、气象、流体、地下空间建模的格式基础——过去这类数据在 GIS 里几乎没有标准容器。

**矢量类**
- `3DTILES_tileset_vectors`：在三维空间编码矢量点、线、面。
- `KHR_mesh_primitive_restart`、`EXT_mesh_polygon`：Cesium 贡献给 Khronos 的扩展，用于高效流式传输矢量载荷，常见情形可**减小 glTF 体积最多 5 倍**〔来源：Cesium 官方博客，2026-09-02〕。

**AEC（建筑工程）扩展类**
- `EXT_mesh_primitive_edge_visibility`：以极紧凑方式编码边可见性，让引擎渲染出“带隐线的工程图”效果——这是 CAD 用户不能妥协的诉求。
- `EXT_texture_info_constant_lod`：动态计算纹理坐标，保持屏幕上恒定的纹素/像素比，避免远处纹理闪烁。
- `BENTLEY_materials_line_style` / `_planar_fill` / `_point_style`：线型（粗细、虚线）、面填充、点样式，直接对应 CAD 制图语义。

**3D 高斯泼溅类**
- `KHR_gaussian_splatting`：在 glTF 中存储 3D 高斯泼溅，可当作点云处理。
- `KHR_gaussian_splatting_compression_spz_2`：SPZ 压缩格式支持。

〔以上扩展清单来源：https://github.com/CesiumGS/3d-tiles/blob/main/next/2.0/README.md〕

**这份清单说明了什么？** 它说明 3D Tiles 2.0 的目标不是“支持更多模型格式”，而是**把 GIS 长期缺失的表达能力补进标准**：体素补上了“体数据”（地质、气象），时态补上了“变化”（施工、洪水），AEC 扩展补上了“工程制图语义”，3DGS 补上了“传统摄影测量拍不出的细结构”。当这四块补齐，三维 GIS 才第一次具备承载**完整物理世界描述**的格式基础。

## 2.1.2 其他关键标准的分工

| 标准 | 归属 | 核心定位 | 在三维 GIS 中的角色 |
|---|---|---|---|
| **CityGML 3.0** | OGC 20-010 | **2021 年 9 月**发布（《Part 1: Conceptual Model Standard》）。概念模型级重构：引入 **LOD0**（此前最低 LOD1）、修订 LOD 概念并区分 Level of Detail 与 Level of Information、新增**双时态**（validFrom/validTo）与**多版本管理**、支持**点云**表达对象 | 提供**语义与拓扑**，适合城市规划、能耗分析、法规审查；本身不是渲染格式 |
| **CityJSON** | 2.0.2（Living Standard） | CityGML 3.0 数据模型的 **JSON 编码子集**，规范原文称“使用 JSON 而非 GML 可使文件压缩约 **6 倍**”（compress files by a factor 6），并带 JSON 专有扩展机制〔来源：cityjson.org/specs，2.0.2〕 | CityGML 的“实用化外壳”，适合 Web 与开发工具链；**是同一模型的另一种编码，不是竞争标准** |
| **IFC 4.3** | buildingSMART → ISO 16739-1:2024 | **2024 年发布并由 ISO 批准**，schema 版本 4.3.0.1，当前补丁 **IFC4.3 Add2**。首次把 **IfcRoad、IfcRailway、IfcBridge、IfcTunnel、IfcMarineFacility** 与 IfcAlignment 纳入核心 schema | BIM 侧权威语义源。线性工程的纳入，从源头缓解了“BIM+GIS 模型对不上”的问题 |
| **I3S** | Esri / OGC 社区标准 | 索引 3D 场景层，按视觉范围与相机距离索引，区分 orthometric 与 ellipsoidal 两种 heightModel；SLPK 封装 | 与 ArcGIS 栈深度绑定，和 3D Tiles 形成事实上的双轨。**当前版本号待核实** |
| **glTF 2.0 / 2.1** | Khronos | 3D 资产传输格式（“3D 界的 JPEG”） | 3D Tiles 1.1+ 的底层载荷，BIM/GIS 融合的公共语言 |
| **LAS 1.4 / COPC / EPT** | ASPRS / 社区 | LAS 1.4 的 PDRF 6—10 支持 64 位计数与 WKT CRS；**COPC 1.0（©2021 Hobu, Inc.）基于 LAZ 1.4**，以聚类八叉树支持云上按需取块，**仅支持 PDRF 6/7/8**；EPT 由 Entwine 维护，目录式八叉树 | 激光雷达数据的标准容器与流式访问方式 |
| **LandInfra / InfraGML** | OGC | InfraGML 1.0 文档号 **16-100r2**，Part 0 LandInfra Core 为唯一强制一致性类 | 线性工程的语义模型。与 IFC 4.3 功能重叠但语境不同：**LandInfra 出生在测量与地籍语境，IFC 出生在工程交付语境**。实践中常见 IFC 管构件、LandInfra 管线路走廊与地形 |
| **GeoPackage 1.4.0** | OGC | 文档号 12-128r19，**2024-02-06** 发布。变更仅涉及 DATETIME 格式、扩展命名规则、R 树触发器 | **注意：1.4.0 并未新增三维几何类型**，“GeoPackage 1.4 支持三维”是行业里流传的误读 |
| **S-100 / S-104** | IHO | 海洋测绘与水位数据 | 水域三维与海事应用 |

**标准之间的关系，用一个类比可以说清**：IFC 是“施工图”，CityGML 是“城市说明书”，glTF 是“包装箱”，3D Tiles 是“物流系统”，而 COPC 是“散装货物专用集装箱”。它们不是竞争关系，而是产业链上下游。

## 本章小结

- 3D Tiles 已完成从渲染格式到空间分块基础设施的转变，但版本状态必须分开表述：1.0 与 1.1 是社区标准，2.0 截至 2026-04 仍在 OGC 社区标准流程中。
- 3D Tiles 2.0 补的是 GIS 长期缺失的表达能力：体素补体数据、时态补变化、AEC 扩展补工程制图语义、3DGS 补传统摄影测量拍不出的细结构。
- 各标准的角色是产业链分工而非竞争：IFC 是施工图，CityGML 是城市说明书，glTF 是包装箱，3D Tiles 是物流系统，COPC 是散装货物专用集装箱。
- CityJSON 2.0.2 是 CityGML 3.0 数据模型的 JSON 编码子集，规范原文称可使文件压缩约 6 倍；它是同一模型的另一种编码，不是竞争标准。
- IFC 4.3（ISO 16739-1:2024）首次把道路、铁路、桥梁、隧道等线性基础设施纳入核心 schema，从源头缓解线性工程模型对不上的问题。
- COPC 1.0 仅支持 PDRF 6/7/8，转 COPC 前必须核对原始点云的记录格式；成果交付仍以 LAS/LAZ 原始档案为准。
- GeoPackage 1.4.0 于 2024-02-06 发布，变更只涉及 DATETIME 格式、扩展命名规则与 R 树触发器，并未新增三维几何类型。

## 思考与练习

1. 核对一个你参与过的项目的数据交付清单，逐项标注所用标准与文档号，标不出的列成补查清单。
2. 同事说“3D Tiles 2.0 已经发布了，可以直接按它设计”。请用 2.1.1 节的状态表判断这句话哪里不准确，并给出方案里的正确表述。
3. 某项目要做城市级建筑语义查询，在 CityGML 与 CityJSON 之间选编码。请按 2.1.2 节给出选择与配套工具链建议，并说明压缩量依据。
4. 取一份你手头的点云成果，确认其 PDRF 编号；若不在 6/7/8 之列，写出转 COPC 之前需要处理的步骤。
5. 辨析：“IFC 和 CityGML 功能重叠，选一个就行。”用 2.1.2 节的分工表判断这句话的问题，并说明实践中两者如何并存。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/bpc/gis3d/第01章-三维GIS要解决什么问题/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/bpc/gis3d/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/bpc/gis3d/第03章-标准与数据格式下点云与坐标/" class="chapter-nav__next">下一章 →</a>
</div>
