---
layout: default
title: 附录B 工具与格式速查
---

# 附录B 工具与格式速查

> **本篇导读**
>
> 附录 B 按“谁在生产、谁在管理、谁在承载”把工具与格式分成三张表：B.1 设计侧 9 行，从 AutoCAD、Civil 3D、Map 3D 到 MicroStation、OpenRoads、Revit 与南方 CASS；B.2 平台侧 8 行，覆盖 ArcGIS、SuperMap、MapGIS、QGIS、PostGIS、GeoServer/MapServer、FME 与 GDAL/OGR；B.3 三维与 CIM 侧 6 行，把 IFC、CityGML、3D Tiles、glTF、倾斜摄影与点云、三维引擎分开放。B.1 与 B.2 里真正有用的是最后一列“接口方式”——它说的是数据怎么过河，不是这个软件有多强；B.3 则要先分清一行里那是交换格式、传输格式、数据源还是平台组件。最容易做错的地方，是把“支持 DWG”读成“能无损读取”：同一条通道可以只搬图元，也可以连参数化对象一起搬，Civil 3D 的曲面、路线、管网导出为普通 DWG 就退化为图元，而表中另一处又写着“对象可导出为要素”，两句话合起来读才对。第二处错在把名单当选型结论——表里出现只说明正文提到过，不说明它适合你的项目。读完你会明白，速查表的用处是让你问对问题：这次交接走哪条通道、通道尽头会丢什么。

## 使用提示

- **用途**：按“我在哪一侧、要交到哪一侧”查行，不按厂商名查。先定位 B.1、B.2、B.3：B.1、B.2 读最后一列的接口方式，B.3 读“类型”列；查格式本身的定位（IFC、CityGML、3D Tiles 各管什么）也在 B.3 里。
- **口径读法**：“支持”“可导入”只说明存在读写通道，不说明读到什么深度。同一行里“曲面/路线/管网对象可导出为要素”与第 1 章 1.3 节“导出为普通 DWG 时退化为图元”要合起来读：前者说的是对象级导出，后者说的是转成普通图形，两个场景不同，结论也不冲突。
- **边界**：名单只收正文提到过的工具与格式，不是选型推荐，也不含版本、授权、性能与国产化适配信息；产品能力以厂商文档为准，本附录不复述其宣称。
- **配合使用**：与附录 A 配合确认缩略语，与附录 C 配合核对某条工具能力的证据强度（例如第 17 条费城机场的 FME 案例属概念验证），与第 1 章 1.5 节四条转换路径配合判断该走哪一类。

## B.1 CAD 与设计侧

| 工具 | 厂商/来源 | 主要用途 | 与 GIS 的接口方式 |
| --- | --- | --- | --- |
| AutoCAD | Autodesk | 通用二维制图、工程图 | DWG/DXF 导出；可挂 ArcGIS for AutoCAD |
| Civil 3D | Autodesk | 道路、场地、管网、土方参数化设计 | 曲面/路线/管网对象可导出为要素；支持 ArcGIS for AutoCAD |
| Map 3D | Autodesk | CAD 环境下的 GIS 数据编辑 | FDO 连接 SHP、PostGIS、Oracle Spatial |
| MicroStation | Bentley | 交通、市政、电力设计 | DGN 导出；OpenCities Map 提供 GIS 能力 |
| OpenRoads | Bentley | 公路与市政线性工程设计 | 与 iTwin、OpenCities 衔接 |
| Revit | Autodesk | 建筑与机电设计（BIM） | IFC 导出、DWG 导出、专有插件 |
| 南方 CASS | 南方测绘 | 地形、地籍、房产测绘成图 | 自有入库工具转 SHP/GDB |
| 中望 CAD / 浩辰 CAD | 中望软件 / 浩辰软件 | 国产 CAD 平台 | DWG 兼容读写；插件生态逐步完善 |
| 纬地 / 鸿业 | 国内厂商 | 公路与市政设计专业软件 | 输出设计图表与 DWG，配合 GIS 入库 |

## B.2 GIS 与平台侧

| 工具 | 厂商/来源 | 主要用途 | 与 CAD 的接口方式 |
| --- | --- | --- | --- |
| ArcGIS Pro / ArcGIS Enterprise | Esri | 空间数据管理、分析、服务发布 | 直接读取 DWG/DXF；ArcGIS for AutoCAD 双向同步 |
| SuperMap GIS | 超图软件 | 二三维一体化 GIS 平台 | CAD 数据导入、三维模型接入 |
| MapGIS | 中地数码 | 国土、地矿、不动产行业 GIS | CAD 数据转换工具、行业建库模块 |
| QGIS | 开源社区 | 桌面 GIS 与数据处理 | DXF/DWG（依赖 GDAL/ODA）导入 |
| PostGIS | 开源社区 | 服务端空间数据库 | 通过 GDAL/FME 导入 CAD 转换结果 |
| GeoServer / MapServer | 开源社区 | OGC 服务发布 | 数据源来自 PostGIS/GDB 等 |
| FME | Safe Software | 多格式数据转换与自动化 | 内置 DWG/DXF/DGN 读写与坐标系处理 |
| GDAL/OGR | 开源社区 | 格式转换与栅格矢量处理 | DXF、DGN 驱动；DWG 需 ODA 支持 |

## B.3 三维与 CIM 侧

| 工具/格式 | 类型 | 用途 | 备注 |
| --- | --- | --- | --- |
| IFC | 交换格式 | 建筑与基础设施模型交换 | ISO 16739；IFC 4.3 扩展至桥梁、道路、铁路等 |
| CityGML | 交换格式 | 城市对象语义模型 | OGC 标准，3.0 版 2023 年发布 |
| 3D Tiles | 传输格式 | 海量三维流式传输 | OGC 社区标准 1.1，支持 glTF 扩展 |
| glTF | 传输格式 | Web 端三维模型传输 | Khronos 标准，3D Tiles 的几何载体 |
| 倾斜摄影/点云 | 数据源 | 实景三维建模 | 常用 OSGB、LAS/LAZ、E57 等格式 |
| 三维引擎 | 平台组件 | 场景渲染与交互 | Cesium、Unreal、Unity、国产引擎等 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/bpc/giscad/附录A-术语与缩略语/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/bpc/giscad/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/bpc/giscad/附录C-事实核查汇总/" class="chapter-nav__next">下一章 →</a>
</div>
