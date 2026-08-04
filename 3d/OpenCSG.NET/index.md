---
layout: default
title: OpenCSG.NET 使用与开发教程
---

# OpenCSG.NET 使用与开发教程

OpenCSG.NET 是一个**纯 C# 实现、零第三方依赖的构造实体几何（Constructive Solid Geometry，CSG）库**。它让你可以用代码创建立方体、球体、圆柱体等基础形体，再通过并集、差集、交集等布尔运算把它们组合成任意复杂的三维实体，最终导出为 STL 文件用于 3D 打印、CNC 加工或可视化。整个库基于 `netstandard2.0`，可以运行在 .NET Framework、.NET Core / .NET 5+、Mono、Unity 等几乎所有 .NET 平台上。

本教程从源代码分析出发，全面覆盖 OpenCSG.NET 的项目定位、CSG 与 BSP 树原理、基础形体、布尔运算、几何变换、STL 导出、声明式 `CsgNode` 建模树、参数化截面拉伸、JSON 序列化、内核源码剖析，并通过一个"冷弯 C 型钢檩条"的工程实战案例把各章知识融会贯通，最后讲解测试、性能与二次开发。

## 章节列表

- [第01章：OpenCSG.NET 概述与学习路线](https://znlgis.github.io/3d/OpenCSG.NET/第01章-OpenCSG.NET概述与学习路线/) —— 了解 CSG 库的定位、上游血统（csg.js → praeclarum/Csg → hypar-io/Csg → OpenCSG.NET）、特性速览与学习路径
- [第02章：环境搭建与第一个程序](https://znlgis.github.io/3d/OpenCSG.NET/第02章-环境搭建与第一个程序/) —— 安装 .NET SDK、通过 NuGet 引用、解析项目结构，编写并运行第一个"打孔立方体"程序
- [第03章：CSG 与 BSP 树核心原理](https://znlgis.github.io/3d/OpenCSG.NET/第03章-CSG与BSP树核心原理/) —— 理解实体的边界表示、布尔运算的集合语义，以及 BSP 树如何完成多边形分割与分类
- [第04章：数学与几何基础类型](https://znlgis.github.io/3d/OpenCSG.NET/第04章-数学与几何基础类型/) —— `Vector3D`/`Vector2D`/`Matrix4x4`/`Plane`/`Vertex`/`Polygon`/`BoundingBox` 等底层类型详解
- [第05章：基础形体——立方体、球体、圆柱体](https://znlgis.github.io/3d/OpenCSG.NET/第05章-基础形体立方体球体圆柱体/) —— `Solids.Cube/Sphere/Cylinder` 的全部重载、选项类与分辨率控制
- [第06章：布尔运算——并集、差集、交集](https://znlgis.github.io/3d/OpenCSG.NET/第06章-布尔运算并集差集交集/) —— `Union/Subtract/Intersect` 的实例与静态用法、链式组合与原点居中修复
- [第07章：几何变换——平移、旋转与缩放](https://znlgis.github.io/3d/OpenCSG.NET/第07章-几何变换平移旋转与缩放/) —— `Translate/Scale/RotateX/Y/Z/Transform` 与 `Matrix4x4` 变换矩阵、镜像与坐标系
- [第08章：STL 导出与文件格式](https://znlgis.github.io/3d/OpenCSG.NET/第08章-STL导出与文件格式/) —— ASCII 与二进制 STL 的写出、扇形三角化原理与常见坑
- [第09章：声明式 CsgNode 树与求值器](https://znlgis.github.io/3d/OpenCSG.NET/第09章-声明式CsgNode树与求值器/) —— `CsgNode` 记录体系、`CsgNodes` 工厂、`CsgEvaluator` 求值与 `TransformNode`
- [第10章：参数化截面与拉伸建模](https://znlgis.github.io/3d/OpenCSG.NET/第10章-参数化截面与拉伸建模/) —— `Profile2D` 七种型材截面、`ExtrudeNode` 拉伸与耳切三角化、`WedgeNode` 楔形体
- [第11章：CsgNode 的 JSON 序列化](https://znlgis.github.io/3d/OpenCSG.NET/第11章-CsgNode的JSON序列化/) —— `CsgSerialization` 的 `$type` 多态判别、驼峰命名、单节点与数组的往返读写
- [第12章：源码剖析——Solid 内核与 BSP 算法](https://znlgis.github.io/3d/OpenCSG.NET/第12章-源码剖析Solid内核与BSP算法/) —— `Solid`/`Tree`/`Node`/`PolygonTreeNode` 迭代式实现、规范化、共面重划分与 Tag 缓存
- [第13章：实战案例——冷弯 C 型钢檩条建模](https://znlgis.github.io/3d/OpenCSG.NET/第13章-实战案例冷弯C型钢檩条建模/) —— 完整走读 `Runner.CPurlin` 样例，参数化生成带冲孔与圆角的钢结构型材
- [第14章：测试、性能优化与二次开发](https://znlgis.github.io/3d/OpenCSG.NET/第14章-测试性能优化与二次开发/) —— NUnit 近似测试、BenchmarkDotNet 基准、扩展新形体与 NuGet 发布流程

> 共 14 章

## 适用人群

- **.NET/C# 开发者**：希望以编程方式生成三维实体模型、导出 STL 的开发者
- **3D 打印与 CNC 爱好者**：需要参数化、可版本控制地描述零件几何的工程师
- **CAD/CAM 与钢结构开发者**：需要在服务端批量生成型材、构件的专业人员
- **几何算法学习者**：想深入理解 CSG 与 BSP 树布尔运算实现细节的读者

## 技术要求

- 熟悉 C# 和 .NET 基础（类、结构体、记录 record、泛型、扩展方法）
- 了解三维几何基本概念（向量、点、平面、多边形、坐标系）
- 了解基本的集合运算概念（并、差、交）即可，CSG 原理会在教程中讲解

## 参考资源

- [OpenCSG.NET GitHub 仓库](https://github.com/znlgis/OpenCSG.NET)
- [上游项目 praeclarum/Csg](https://github.com/praeclarum/Csg)（C# 移植源头之一）
- [OpenJsCad / csg.js](https://github.com/jscad/csg.js)（算法原始出处）
- OpenCSG.NET 仓库内 `samples/` 与 `tests/` 目录（官方推荐的用法示例）
