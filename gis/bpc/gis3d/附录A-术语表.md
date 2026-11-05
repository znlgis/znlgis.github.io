---
layout: default
title: 附录A 术语表
---

# 附录A 术语表

> **本篇导读**
>
> 本附录把全书反复出现的格式名、坐标系与渲染术语收在一张表里，用法是“看到不认识的名字就来查”。术语密度最高的三章是第 2 章（3D Tiles 与点云格式）、第 3 章（坐标与精度）、第 4 章（引擎与渲染），读那三章时对照本表可以少走回头路。表里每条只给一句话含义，展开论述以正文为准，术语的完整定义请回到对应章节。

| 术语 | 全称／英文 | 含义 |
|---|---|---|
| **3D Tiles** | 3D Tiles | OGC 社区标准，面向海量三维地理数据的流式传输与渲染规范 |
| **B3DM / I3DM / PNTS / CMPT** | Batched 3D Model / Instanced 3D Model / Point Cloud / Composite | 3D Tiles 1.0 的四种瓦片格式 |
| **I3S** | Indexed 3D Scene Layer | Esri 的三维场景图层标准，SLPK 为其封装格式 |
| **glTF** | GL Transmission Format | Khronos 的 3D 资产传输格式，被称为“3D 界的 JPEG” |
| **CityGML** | City Geography Markup Language | OGC 的城市三维语义模型标准，分 LOD0—LOD4 |
| **CityJSON** | CityJSON | CityGML 的 JSON 编码，轻量、适合 Web |
| **IFC** | Industry Foundation Classes | buildingSMART 的 BIM 数据模型标准（ISO 16739 系列） |
| **COPC** | Cloud Optimized Point Cloud | 云优化点云格式，支持按空间范围流式读取 |
| **EPT** | Entwine Point Tile | Entwine 项目的点云瓦片格式 |
| **LAS / LAZ** | LASer / LASzipped | ASPRS 定义的点云交换格式（LAZ 为压缩版） |
| **3DGS** | 3D Gaussian Splatting | 三维高斯泼溅，以高斯基元表示场景的神经渲染技术 |
| **NeRF** | Neural Radiance Fields | 神经辐射场，以隐式神经网络表示场景 |
| **LOD** | Level of Detail | 细节层次，按视距/屏幕误差选择模型精细度 |
| **ECEF** | Earth-Centered, Earth-Fixed | 地心直角坐标系，3D Tiles 与 Cesium 的计算基础 |
| **ENU** | East-North-Up | 东-北-天局部坐标系，常用于局部场景 |
| **CGCS2000** | China Geodetic Coordinate System 2000 | 2000 国家大地坐标系，我国法定坐标系 |
| **EPSG:4979** | WGS 84 3D | 经纬度 + 椭球高的三维地理坐标系 |
| **DEM / DSM / DTM** | Digital Elevation / Surface / Terrain Model | 数字高程模型／数字表面模型／数字地形模型 |
| **OSGB** | OpenSceneGraph Binary | 倾斜摄影常用的分块模型格式 |
| **S3M** | Spatial 3D Model | 超图的二维三维一体化空间数据格式 |
| **CIM** | City Information Model | 城市信息模型，BIM+GIS+IoT 的城市级平台体系 |
| **GaaS** | GIS as a Service | 地理信息即服务，按需订阅的服务模式 |
| **PBR** | Physically Based Rendering | 基于物理的渲染 |

## 使用提醒

- 本表的英文全称与缩写以正文出现过的写法为准；正文没有出现的厂商私有格式名或变体，不收录。
- 术语含义只作定位用，涉及标准条文的技术细节（如 LOD 分级的具体阈值、投影参数）请回正文对应小节核对。
- 同一缩写在行业里有多种展开的（如 CIM），本表取正文使用的口径；引用到其他文档时先确认对方的定义。
- 术语表不标注标准号与版本年份，格式类术语的现行版本以标准组织官网为准。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/bpc/gis3d/第19章-行动建议/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/bpc/gis3d/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/bpc/gis3d/附录B-主要来源清单/" class="chapter-nav__next">下一章 →</a>
</div>
