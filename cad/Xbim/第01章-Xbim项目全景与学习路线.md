---
layout: default
title: 第01章：Xbim项目全景与学习路线
---

# 第01章：Xbim 项目全景与学习路线

## 1. Xbim 是什么

**Xbim**（the e**X**tensible **B**uilding **I**nformation **M**odelling toolkit）是一个面向 .NET 平台的开源 BIM（Building Information Modelling，建筑信息模型）开发工具集，由 xBIM Team 在 GitHub 组织 [`xBimTeam`](https://github.com/xBimTeam) 下维护。它是英语世界中最成熟、最完整的开源 IFC 开发库之一，被许多商业 BIM 软件、研究机构与政府项目作为底层 IFC 处理引擎使用。

Xbim 的核心目标是：**把 buildingSMART 制定的 IFC（Industry Foundation Classes）开放标准从晦涩的 STEP/EXPRESS 文本格式中"解放"出来，转化为 .NET 开发者可以方便地读、写、查询、编辑、可视化的强类型对象模型**。其口号可以概括为：

> "Read, write, validate and interrogate data in the buildingSMART IFC formats — using any .NET language."

围绕这个核心，Xbim 还逐步扩展出一整套围绕 Open BIM 的工具链，包括几何引擎、3D 可视化、COBie 资产数据交换、IDS 模型校验、BCF 协同等模块。

## 2. Xbim 在 BIM 生态中的位置

要理解 Xbim 的价值，先要理解它在 BIM 生态中的定位：

- **buildingSMART International** 是国际 BIM 标准制定组织，负责 IFC、bSDD、IDM、MVD、IDS、BCF 等开放标准。
- **IFC** 是 buildingSMART 的核心数据模型标准，由 ISO 16739 收录，使用 ISO 10303（STEP）的 EXPRESS 数据建模语言定义。
- **IFC 文件**通常以 `.ifc`（STEP21 文本）、`.ifcXML`（XML）或 `.ifcZIP`（压缩）形式分发。
- 主流商业 BIM 软件（Revit、ArchiCAD、Tekla、Allplan、Vectorworks 等）都支持 IFC 导入导出，但各家对标准的实现并不完全一致，因此**第三方独立 IFC 工具**对于互操作性至关重要。
- 在开源世界，主要的 IFC 工具有：
  - **Xbim Toolkit**（.NET，C#/C++）—— 本教程主题。
  - **IfcOpenShell**（C++/Python）—— 另一个广泛使用的开源 IFC 库，BlenderBIM 的底层。
  - **IFC.js / web-ifc**（C++/JavaScript）—— 面向浏览器的 IFC 处理库。
  - **TUM Open Infra Platform**、**FreeCAD BIM Workbench** 等若干针对特定场景的工具。

Xbim 与 IfcOpenShell 是 IFC 开源生态中两座并列的高峰。Xbim 的主要优势在于：

1. **强类型、自动生成的 .NET 类库**：每一个 IFC 实体（例如 `IfcWall`、`IfcDoor`、`IfcRelAggregates`）都对应一个 C# 接口/类，IDE 可以提供完整的智能提示。
2. **原生支持完整的 IFC2x3 / IFC4 / IFC4x3 模式**，并兼容 STEP21、ifcXML、ifcZIP 三种序列化方式。
3. **基于 Open CASCADE Technology 的工业级几何引擎**（Xbim.Geometry），可以处理真实世界中复杂的隐式几何（拉伸、扫掠、布尔差集、CSG 等），而不仅仅是显式三角网格。
4. **完整的事务/持久化机制**：可以把巨型 IFC 文件转成 Esent/Memory 数据库，按需加载，避免内存爆炸。
5. **丰富的扩展模块**：COBie、IDS、BCF、Web 可视化等。

## 3. Xbim 的仓库与模块全景

Xbim Toolkit 由 `xBimTeam` 组织下的多个仓库组成，本教程主要聚焦其中两个最核心的仓库：

### 3.1 [`xBimTeam/XbimEssentials`](https://github.com/xBimTeam/XbimEssentials)

`XbimEssentials` 是 Xbim 的"基础"仓库，是整个工具集的地基。它的主要内容：

- **`Xbim.Common`**：通用基础设施，包含模型接口（`IModel`、`IPersistEntity`）、事务（`ITransaction`）、几何元数据（`IfcAxis2Placement`、`XbimMatrix3D` 等几何辅助类型）、元数据反射、单位（`IIfcUnitAssignment` 抽象层）、依赖注入服务等。
- **`Xbim.Tessellator`**：纯托管的几何细分器，用于在没有 Xbim.Geometry 的场景下做轻量三角化。
- **`Xbim.Ifc`**：高层 API 入口，最重要的类型是 `IfcStore`，它把模型打开/创建/保存的工作封装成一行代码。
- **`Xbim.Ifc2x3`、`Xbim.Ifc4`、`Xbim.Ifc4x3`**：按 IFC 模式版本组织的实体类库。每一份是从 EXPRESS 模式自动生成的代码，包含数百到上千个实体类型与枚举。
- **`Xbim.IO`、`Xbim.IO.Esent`、`Xbim.IO.Memory`、`Xbim.IO.Xml`、`Xbim.IO.Step21`**：不同格式与不同后端的读写实现。Esent 是 Windows 内置的嵌入式数据库，可以承载千万级实体。Memory 后端轻量、跨平台，是 .NET Core/Linux 上的默认选择。
- **`Xbim.CodeGeneration`**：从 EXPRESS schema 文件自动生成 C# 实体类的代码生成器，是 Xbim 能够紧跟 IFC 标准演进的关键工具。
- **`Xbim.IDS.Validator`**：在 v6 之后引入的 IDS（Information Delivery Specification）模型验证器（在独立仓库 [`Xbim.IDS.Validator`](https://github.com/xBimTeam/Xbim.IDS.Validator) 中演进，但与 Essentials 紧密配合）。

### 3.2 [`xBimTeam/XbimGeometry`](https://github.com/xBimTeam/XbimGeometry)

`XbimGeometry` 是 Xbim 的几何引擎仓库，它把 IFC 中以参数化、隐式方式描述的几何（如 `IfcExtrudedAreaSolid`、`IfcBooleanResult`、`IfcSweptDiskSolid`）转换为：

- 精确的 B-Rep 表达；
- 可显示的三角网格（Tessellation）；
- 可参与布尔运算的几何对象。

其底层基于 [Open CASCADE Technology 7.6.x](https://www.opencascade.com/)（OCCT），通过 C++/CLI 桥接到 .NET。仓库内容主要包括：

- **`Xbim.Geometry.Engine`（C++/CLI）**：把 OCCT C++ 类型包装成可以从 C# 调用的 CLR 类型。
- **`Xbim.Geometry.Engine.Interop`**：在托管侧加载 native 引擎（含 x86/x64 选择、运行时部署等）。
- **`Xbim.ModelGeometry.Scene`**：场景管理、几何实例化、Wexbim（`.wexbim`）二进制几何流文件生成与读取。
- **`Xbim.Geometry`（NuGet 包）**：最终对外发布的元包。

### 3.3 其他常用仓库

- [`xBimTeam/XbimWindowsUI`](https://github.com/xBimTeam/XbimWindowsUI)：基于 WPF 的桌面查看器 `XbimXplorer`，是学习与调试 IFC 模型最方便的工具之一。
- [`xBimTeam/XbimWebUI`](https://github.com/xBimTeam/XbimWebUI)：基于 WebGL 的浏览器端查看器，配合 `.wexbim` 文件可以在网页中显示 BIM 模型。
- [`xBimTeam/XbimCobieExpress`](https://github.com/xBimTeam/XbimCobieExpress)：COBie 数据资产交换标准的 Xbim 实现。
- [`xBimTeam/XbimBCF`](https://github.com/xBimTeam/XbimBCF)：BCF（BIM Collaboration Format）协同问题报告格式的实现。
- [`xBimTeam/Xbim.IDS.Validator`](https://github.com/xBimTeam/Xbim.IDS.Validator)：IDS（Information Delivery Specification）模型校验。
- [`xBimTeam/XbimSamples`](https://github.com/xBimTeam/XbimSamples)：官方示例项目集合。

## 4. Xbim 的版本历史与节奏

Xbim 至今主要经历以下大版本：

- **v3 / v4**：早期阶段，仅支持 .NET Framework，大量使用 Esent 数据库后端，核心 API 经历多次重构。
- **v5**：引入 `IfcStore` 高层封装、统一 IFC2x3/IFC4 接口（`Xbim.Ifc4.Interfaces`）。
- **v5.1+**：开始支持 .NET Standard 2.0，托管侧逐步实现跨平台；几何引擎仍依赖 Windows + OCCT 原生库。
- **v6**：标志性的版本。引入了 .NET 标准的依赖注入（`Microsoft.Extensions.DependencyInjection`）模式，通过 `XbimServices` 暴露内部服务（日志、几何引擎、Tessellator 等）；正式支持 `.netstandard2.0`、`.netstandard2.1`、`.net6.0`、`net8.0`。
- **v6.x**：完善对 IFC4x3（基础设施扩展）的支持、改进几何引擎稳定性、跟进 OCCT 7.6.3。

Xbim 的版本号同时会出现在 `Xbim.Essentials`、`Xbim.Geometry`、`Xbim.CobieExpress`、`Xbim.WindowsUI` 等多个 NuGet 包上，发布通过 Azure DevOps Pipelines + MyGet（develop / master 分支预发布）+ NuGet（正式发布）三段流水线完成。

## 5. 学习 Xbim 需要的前置知识

要顺畅地学习 Xbim 二次开发，建议你具备：

- **C# / .NET 基础**：熟悉接口、泛型、LINQ、`async/await`、依赖注入。
- **基本 BIM/CAD 概念**：墙、柱、梁、板、空间、楼层、构件、属性等术语。
- **基本的 IFC 概念**：知道 IFC 是 BIM 数据交换的开放标准（第 03 章会专门讲）。
- **几何与拓扑基础**：点、线、面、实体、曲线、曲面、B-Rep、CSG 等概念（第 11–12 章会铺垫，但有 OCCT 基础会更轻松）。
- **可选**：C++ 与 C++/CLI（仅当你想编译/修改几何引擎源码时需要）；EXPRESS 数据建模语言（仅当你想看懂 IFC schema 文件时需要）。

## 6. 推荐学习路线

针对不同读者，本教程提供以下几条主路径，章节编号对应教程目录中的章节：

### 路径 A：BIM 应用开发者（最常见）

> 目标：用 Xbim 在 .NET 应用中读取/编辑 IFC、提取属性、生成报表、做模型校验。

```
01 → 02 → 03 → 05 → 06 → 07 → 09 → 10 → 14 → 15 → 16
```

可以先跳过 04（元模型内部）和 11–13（几何/可视化）。

### 路径 B：BIM 可视化开发者

> 目标：把 IFC 模型显示在桌面或浏览器里，做交互、漫游、剖切、量测。

```
01 → 02 → 03 → 05 → 06 → 11 → 12 → 13 → 16
```

需要重点关注 Xbim.Geometry 与 Xbim.WindowsUI / Xbim.WebUI。

### 路径 C：核心二次开发 / 贡献者

> 目标：理解 Xbim 内部机制，乃至修改 Xbim 源码、扩展 IFC4x3、参与社区贡献。

```
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16
```

按本教程顺序通读即可。需要额外阅读：EXPRESS 标准、`Xbim.CodeGeneration` 仓库、OCCT 文档。

## 7. 一个最小示例：Hello, IFC

为了让你对 Xbim 产生一个直观印象，先给出一段最简单的示例代码（细节会在第 05–06 章详细讲解）。

```csharp
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

class Program
{
    static void Main()
    {
        using var model = IfcStore.Open("SampleHouse.ifc");

        // 统计模型基本信息
        Console.WriteLine($"Schema: {model.SchemaVersion}");
        Console.WriteLine($"Project: {model.Instances.OfType<IIfcProject>().FirstOrDefault()?.Name}");
        Console.WriteLine($"Walls : {model.Instances.OfType<IIfcWall>().Count()}");
        Console.WriteLine($"Doors : {model.Instances.OfType<IIfcDoor>().Count()}");
    }
}
```

短短几行代码就完成了：

1. 打开一个任意版本的 IFC 文件（IFC2x3、IFC4、IFC4x3 都可以）。
2. 通过统一接口 `Xbim.Ifc4.Interfaces.IIfcXxx` 屏蔽版本差异。
3. 用 LINQ + 泛型查询，自然地按类型统计实体。

这种"用 LINQ 玩 IFC"的开发体验，是 Xbim 给中文开发者最大的吸引力之一。

## 8. 配套资源

- 官方门户：<https://xbimteam.github.io/>
- 官方文档：<https://docs.xbim.net/>（部分已迁移到仓库 wiki / examples）
- 主仓库：[`xBimTeam`](https://github.com/xBimTeam) 组织主页
- 官方示例：[`XbimSamples`](https://github.com/xBimTeam/XbimSamples)
- IFC 标准在线浏览：<https://standards.buildingsmart.org/IFC/RELEASE/>
- 桌面查看器 XbimXplorer：从 [`XbimWindowsUI`](https://github.com/xBimTeam/XbimWindowsUI) Releases 下载
- 社区讨论：仓库 Issues、xBIM 论坛（<https://forum.xbim.net/>，部分内容已归档至 GitHub Discussions）

## 9. 本教程的目标

读完本系列 16 章之后，你应当能够：

1. 独立搭建 Xbim 开发环境，熟练编译 `XbimEssentials` 与 `XbimGeometry` 源码；
2. 理解 IFC 的整体数据模型、EXPRESS 元模型与 STEP21 序列化格式；
3. 使用 `IfcStore` 在 .NET 项目中读、写、查询、编辑 IFC 文件；
4. 操纵属性集、量集、材料、分类、空间结构与构件关系；
5. 利用 Xbim.Geometry + OCCT 处理 IFC 几何，生成网格用于可视化；
6. 借助 Xbim.WindowsUI、Xbim.WebUI 在桌面或浏览器中显示 BIM 模型；
7. 使用 IDS 做模型校验、用 BCF 做协同问题管理、用 COBie 做资产数据交换；
8. 完成一个综合性的 BIM 工具链项目（导出报表、模型对比、合规检查或 Web 查看器）。

下一章我们将动手搭建开发环境，把 `XbimEssentials` 与 `XbimGeometry` 仓库克隆到本地、成功编译并运行第一个示例。
