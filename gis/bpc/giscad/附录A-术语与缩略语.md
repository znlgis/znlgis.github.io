---
layout: default
title: 附录A 术语与缩略语
---

# 附录A 术语与缩略语

> **本篇导读**
>
> 附录 A 收的是全书反复出现、又最容易在跨专业沟通里各说各话的词。一张表按“术语/缩略语—英文/全称—含义与在本报告中的用法”三列排开 24 条，从被当成软件名到处用的 CAD、GIS、BIM、CIM，到 CRS、CGCS2000、LRS、断链这类作业词，再到产权体、数据底板、语义映射这类要按本报告口径理解的词。它是查询表，不是术语汇编：第三列写的是“本报告中的用法”，对外引用仍要回到标准或规章原文。容易做错的有两处：一是把 CAD 与 GIS 拿来比软件功能，表里定义的是两套数据模型——图元与要素，换一个软件并不改变这条界线；二是把 CIM 与 CityGML 当成一回事——表里 CIM 指 BIM、GIS、IoT 融合的城市级三维底座与业务平台，CityGML 只是 OGC 的城市三维对象语义标准，一个是建设对象，一个是交换格式。读完你会明白，这套教程里最难统一的不是技术而是词——同一个词在相邻两章指的不是一件事，先在表里对一遍。

## 使用提示

- **用途**：统一说法，不是增加知识。写成果说明、编培训材料、对外答复之前先在表里对一遍词，避免同一个概念在三份文档里换三个名字；碰上不认识的缩略语，第二列给全称，第三列说明它在本报告里指的是什么。
- **口径读法**：第三列是关键。同一术语在标准、部门规章与作业现场可能各有所指，例如“语义映射”在这里指图层、块、字段到要素类与字段的规则化过程，不是泛指任何数据翻译；引用时连同语境一起引，别只摘词条。
- **边界**：只收正文实际出现过、且容易混用的词，不追求收全，也不替代标准术语；与地方规程或受理机构的表述不一致时，以正式文本为准，本表只保证教程内部一致。
- **配合使用**：与第 1 章（1.2 节六个差异、1.6 节的丢失信息）配合读，术语的差别在那里变成工程后果；查工具与格式转附录 B，查论断强度转附录 C，查文号与效力转附录 D。

| 术语/缩略语 | 英文/全称 | 含义与在本报告中的用法 |
| --- | --- | --- |
| CAD | Computer-Aided Design | 计算机辅助设计；本报告指以图元、图层、块、标注为核心的制图与设计技术体系 |
| GIS | Geographic Information System | 地理信息系统；指以要素、属性、拓扑、坐标参照系为核心的空间数据管理与分析体系 |
| BIM | Building Information Modeling | 建筑信息模型；以构件为单元、承载设计-施工-运维信息的建筑数字模型 |
| CIM | City Information Modeling | 城市信息模型；BIM、GIS、IoT 融合的城市级三维空间底座与业务平台 |
| CRS | Coordinate Reference System | 坐标参照系；定义坐标如何对应地球表面的数学模型与基准 |
| CGCS2000 | China Geodetic Coordinate System 2000 | 2000 国家大地坐标系；我国自 2008 年 7 月 1 日起启用的地心坐标系 |
| DWG / DXF | Drawing / Drawing Exchange Format | AutoCAD 的原生图形格式与公开交换格式 |
| DGN | Design File | Bentley MicroStation 的原生图形格式 |
| SHP | ESRI Shapefile | 由 .shp/.shx/.dbf 等文件组成的矢量数据格式，事实标准但有限制 |
| GDB | Geodatabase | Esri 的地理数据库容器（File Geodatabase 为文件夹形式） |
| GeoPackage | OGC GeoPackage | 基于 SQLite 的开放地理数据容器标准（OGC 12-128r19，v1.4.0） |
| IFC | Industry Foundation Classes | buildingSMART 的建筑信息模型交换标准，对应 ISO 16739 |
| CityGML | City Geography Markup Language | OGC 的城市三维对象语义标准，3.0 版于 2023 年发布 |
| 3D Tiles | — | OGC 采纳的三维瓦片流式传输社区标准，1.1 版引入 glTF 扩展与细粒度元数据 |
| LOD | Level of Detail | 细节层次；CityGML 中分 LOD0–LOD4，实景三维中对应地形级/城市级/部件级 |
| LRS | Linear Referencing System | 线性参考系统；用里程桩号等线性度量定位线性设施上的事件 |
| FME | Feature Manipulation Engine | Safe Software 的数据转换平台，广泛用于 CAD/GIS 格式互转 |
| ODA | Open Design Alliance | 提供 DWG 等格式读写 SDK 的行业联盟 |
| 拓扑 | Topology | 要素之间的连通、相邻、包含关系；CAD 一般不维护，GIS 可显式建立 |
| 语义映射 | Semantic Mapping | 把 CAD 的图层/块/字段对应到 GIS 的要素类/字段的规则化过程 |
| 产权体 | Property Volume | 三维不动产中表达权属空间范围的三维实体 |
| 数据底板 | Data Base Plate | 数字孪生流域中的空间数据基础层，含地形、影像、矢量、BIM 等 |
| 实景三维 | 3D Real Scene | 对生产、生活、生态空间进行真实、立体、时序化表达的数字虚拟空间 |
| 断链 | Chainage Break | 线性工程中因改线导致的里程桩号不连续，需专门处理 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/bpc/giscad/第10章-趋势-风险与行动建议/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/bpc/giscad/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/bpc/giscad/附录B-工具与格式速查/" class="chapter-nav__next">下一章 →</a>
</div>
