---
layout: default
title: Elements 使用与开发教程
---

# Elements 使用与开发教程

Hypar Elements（简称 Elements）是由 Hypar 公司开源的**建筑信息模型（BIM）编程生成库**，专为 AEC（建筑、结构、机电、施工）领域设计。它以纯 C# 代码的方式创建建筑模型——墙、梁、柱、楼板、空间、机电管道等——无需启动任何商业 BIM 软件。

本教程从源代码分析出发，全面覆盖 Elements 的类型体系、几何内核、建筑元素、布尔运算、序列化互操作、空间搜索、MEP 机电、组件化生成和 Schema 驱动开发等内容，最终通过一个综合建模项目将各章知识融会贯通。

## 章节列表

- [第01章：Elements 概述与快速入门](https://znlgis.github.io/3d/elements/第01章-Elements概述与快速入门/) —— 了解 Elements 的定位与技术栈，搭建开发环境，创建第一个墙模型
- [第02章：核心概念——Element 与 Model](https://znlgis.github.io/3d/elements/第02章-核心概念Element与Model/) —— 深入三层类型体系，理解 Representation/SolidOperation，掌握 Model 容器的增删查改
- [第03章：几何系统（上）——向量、曲线与多边形](https://znlgis.github.io/3d/elements/第03章-几何系统（上）向量曲线与多边形/) —— 右手坐标系与精度约定，Vector3 向量运算，六种曲线类型与求交，Polygon 布尔运算
- [第04章：几何系统（下）——轮廓、变换与实体](https://znlgis.github.io/3d/elements/第04章-几何系统（下）轮廓变换与实体/) —— Profile 带洞轮廓，型钢截面与工厂模式，Transform 变换矩阵，Mesh/BREP/Solid 半边结构
- [第05章：建筑元素——墙、梁、柱、楼板](https://znlgis.github.io/3d/elements/第05章-建筑元素墙梁柱楼板/) —— Wall/Beam/Column/Floor/Panel 的核心属性和用法，创建完整房间模型
- [第06章：结构与框架——桁架、支撑与结构框架](https://znlgis.github.io/3d/elements/第06章-结构与框架桁架支撑与结构框架/) —— Frame/Brace/StructuralFraming 的定义-实例模式，钢结构框架建模
- [第07章：空间、开洞与地形](https://znlgis.github.io/3d/elements/第07章-空间开洞与地形/) —— Space 空间定义、Opening 开洞、Topography 地形、Mass 体量、Ceiling 天花板与 GridLine 轴网
- [第08章：CSG 布尔运算与实体操作](https://znlgis.github.io/3d/elements/第08章-CSG布尔运算与实体操作/) —— Extrude/Sweep/Lamina/ConstructedSolid 四种实体操作，IsVoid 挖空，SolidOperationUtils 组合策略
- [第09章：材质、光照与渲染](https://znlgis.github.io/3d/elements/第09章-材质光照与渲染/) —— Material PBR 材质参数，Light 灯光体系，glTF 渲染管线，顶点属性修改钩子
- [第10章：序列化——JSON、glTF 与 IFC](https://znlgis.github.io/3d/elements/第10章-序列化JSON-glTF与IFC/) —— 五种序列化格式（JSON/glTF/GLB/IFC/DXF/SVG）的导入导出原理与实战
- [第11章：空间数据结构——网格、拓扑与自适应网格](https://znlgis.github.io/3d/elements/第11章-空间数据结构网格拓扑与自适应网格/) —— Grid1d/Grid2d 轴网、HalfEdgeGraph2d 半边图、CellComplex 三维拓扑、AdaptiveGrid 管线寻路
- [第12章：图与空间搜索](https://znlgis.github.io/3d/elements/第12章-图与空间搜索/) —— Network 图算法（最短路径/环检测）、Octree 八叉树空间索引、BinaryTree 射线追踪
- [第13章：MEP 机电系统](https://znlgis.github.io/3d/elements/第13章-MEP机电系统/) —— Fitting 管件体系（弯头/三通/变径等）、FittingTree 管件树、流路与压力分析（Hazen-Williams）
- [第14章：组件化生成](https://znlgis.github.io/3d/elements/第14章-组件化生成/) —— ComponentDefinition 与五种放置规则（阵列/网格/折线/位置/尺寸驱动），组件嵌套与实例化
- [第15章：Schema 驱动开发——自定义元素类型](https://znlgis.github.io/3d/elements/第15章-Schema驱动开发自定义元素类型/) —— JSON Schema 定义自定义元素、Elements.CodeGeneration 代码生成、*.g.cs 产物解析
- [第16章：实战案例——综合建模项目](https://znlgis.github.io/3d/elements/第16章-实战案例综合建模项目/) —— 从零构建两层办公楼，涵盖结构/建筑/机电/空间/材质/序列化全链路

> 共 16 章

## 适用人群

- **.NET/C# 开发者**：希望以编程方式生成建筑三维模型的开发者
- **BIM 工程师**：需要自动化生成大量建筑方案变体的专业人员
- **Web 3D 开发者**：需要从建筑数据生成 glTF 模型的工程师
- **开源 GIS/AEC 爱好者**：探索开源建筑信息模型技术的爱好者

## 技术要求

- 熟悉 C# 和 .NET 基础（类、继承、接口、泛型）
- 了解三维几何基本概念（向量、点、线、面、坐标系）
- 了解建筑基本概念（墙、梁、柱、楼板等建筑构件）

## 参考资源

- [Hypar Elements GitHub 仓库](https://github.com/hypar-io/Elements)
- [Hypar Elements NuGet 包](https://www.nuget.org/packages/Hypar.Elements)
- [Elements 测试代码](https://github.com/hypar-io/Elements/tree/master/Elements/test)（官方推荐的用法示例）
