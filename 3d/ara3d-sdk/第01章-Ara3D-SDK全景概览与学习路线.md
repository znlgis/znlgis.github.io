---
layout: default
title: 第01章：Ara3D-SDK全景概览与学习路线
---

# 第01章：Ara3D-SDK 全景概览与学习路线

## 1. Ara3D-SDK 是什么

**Ara3D-SDK**（仓库名 `ara3d/ara3d-sdk`）是由 **Ara 3D Inc.** 开源的一套 **C# 库集合**，专注于 **AEC（Architecture、Engineering、Construction，建筑、工程与施工）** 领域的三维数据处理工作流。它采用 **MIT 许可证**，源码完全公开，任何人都可以阅读、修改、二次开发并集成到自己的产品中。

Ara3D-SDK 的两大定位：

1. **独立使用的高性能三维/BIM 工具库**：加载、生成、变换、导出海量三维几何与 BIM 数据；
2. **Ara 3D Studio 桌面应用的扩展底座**：通过 `Ara3D.Studio.API` 编写生成器、修改器、命令与工具，把自己的算法接入 Studio 的可视化流程图（Flow Graph）。

官方在 NuGet 上发布了包 [`Ara3D.SDK`](https://www.nuget.org/packages/Ara3D.SDK)，当前版本为 `1.6.x`（由仓库根目录 `Directory.Build.props` 中的 `Ara3DVersion` 统一管理，所有包共享同一版本号）。

> 一句话定位：Ara3D-SDK 是“面向 AEC 的高性能 .NET 三维数据处理引擎 + Studio 插件框架”，代码结构清晰、几乎零外部依赖，非常适合作为学习现代高性能 .NET 图形/BIM 工程的范本。

## 2. 为什么要学习 Ara3D-SDK

在 AEC / BIM / 数字孪生 / GIS 三维等领域，工程师经常面对这些痛点：

- 模型体量巨大（动辄数百万三角面、几十万构件实例），传统托管内存与 GC 难以支撑实时处理；
- IFC、Revit、STEP、glTF、PLY 等格式繁多，解析器质量参差、性能不一；
- BIM 数据（构件、参数、关系、几何）缺乏统一、易查询的开放模式（schema）；
- 想做参数化建模、算法生成、批量处理，却缺少一套一致的几何内核与脚本框架。

Ara3D-SDK 针对性地给出了工程化答案：

1. **统一的高性能内存模型**：`Ara3D.Memory` 提供 64 字节对齐的非托管缓冲区、堆可存的 `ByteSlice`、内存映射文件视图，为 SIMD 与超大数据集服务；
2. **SIMD 加速的数学与几何**：`Ara3D.F8`（AVX 8 宽 float）+ Plato 生成的数学类型，让批量顶点变换、包围盒计算跑在向量指令上；
3. **不可变、可组合的几何内核**：`TriangleMesh3D` / `QuadGrid3D` 等类型的所有变换都返回新对象，天然适合函数式管线与并行；
4. **一等公民的 BIM 开放模式（BOS）**：把 IFC / Revit 数据规约到列式 EAV 结构，可直接落地为 Parquet / DuckDB / Excel；
5. **可插拔的 Studio 框架**：几十行代码就能写出一个参数化生成器或网格修改器，实时预览。

学会 Ara3D-SDK，你将同时掌握：**高性能 .NET 数据工程、三维几何算法、三维/BIM 文件格式内幕、以及一套完整的插件式产品架构**。

## 3. 仓库整体结构

Ara3D-SDK 是一个 **C# 单体仓库（monorepo）**，顶层目录职责如下：

| 目录 | 职责 |
| --- | --- |
| `src/` | **受支持的 SDK 库**与 NuGet 元包（跨平台基础、几何、I/O、BIM、Studio API） |
| `ext/` | Windows 专属扩展：`Ara3D.IfcLoader`（原生 IFC 加载）、`Ara3D.Utils.Wpf`（WPF 辅助） |
| `apps/` | 独立桌面应用（如 BOS Browser） |
| `examples/` | 示例与用法演示（Workshop 课程、Studio 脚本示例、Tools 工具） |
| `plugins/` | 宿主插件（Bowerbird 实时脚本、Revit 加载项） |
| `integrations/` | 可选的第三方适配器（如 Assimp） |
| `tests/` | NUnit 单元测试、回归测试、开发者测试 |
| `vendor/` | 必需的第三方原生库（如 `web-ifc-library.dll`） |
| `toolchain/` | 开发工具（如 IfcTypeGen），`IsPackable=false`，不打包 |
| `deprecated/` | 已不再维护的旧项目 |
| `build/` | 打包清单 `packages.txt` 与 `PackAll.proj` |
| `docs/` | 工作流、包依赖图、发布流程等文档 |

**关键设计原则**：只有 `src/` 和 `ext/` 下的库会被打包成 NuGet（见 `build/packages.txt`）；`toolchain/`、`tests/`、`apps/`、`examples/` 等永不进入发布产物。

## 4. 分层架构与四个元包

Ara3D-SDK 提供了四个**元包（meta-package）**——它们本身不含源码，只是依赖捆绑，方便你按需选择最小可用集合：

```
Ara3D.SDK  (net8.0-windows — 完整 Windows 技术栈)
├── Ara3D.SDK.Core            net8.0        — 跨平台基础（Utils/Logging/Memory/Collections/...）
├── Ara3D.SDK.Geometry        net8.0        — 网格、模型、SIMD 数学
├── Ara3D.SDK.IO              net8.0-windows— 文件格式、BOS、IFC
├── Ara3D.Studio.API          Studio 插件 API
└── Ara3D.Utils.Wpf           WPF 辅助（ext/）
```

选择建议：

- 只需**跨平台**的基础工具或几何计算 → 引用 `Ara3D.SDK.Core` 或 `Ara3D.SDK.Geometry`；
- 需要在 **Windows** 上读写各种三维/BIM 文件 → 引用 `Ara3D.SDK.IO`；
- 想“一包搞定几乎所有事情”（含 WPF、IFC、Studio API）→ 引用 `Ara3D.SDK`。

从**依赖层次**看，整个 SDK 大致分为五层（自底向上）：

1. **基础层（叶子节点，零内部依赖）**：`Collections`、`Events`、`F8`、`Memory`、`Utils`、`WorkItems`；
2. **核心层**：`Logging→Utils`、`Utils.Roslyn→Logging`、`Geometry→Collections+Memory+Utils`、`PropKit→Geometry+Utils`；
3. **数据层**：`DataTable→Collections+PropKit`、`Models→Collections+F8+Memory+Geometry`；
4. **I/O 层**：`IO.BFAST→Memory+Utils`、`IO.G3D→Collections+BFAST`、`IO.StepParser→Memory+Logging+Utils` 等；
5. **BIM 层**：`BimOpenSchema→DataTable+Geometry+Models`、`IfcLoader→BimOpenSchema+StepParser+Models`、`BimOpenSchema.IO→BimOpenSchema+IfcLoader`。

> 值得强调：**大多数库零外部 NuGet 依赖**。仅有少数例外——`Utils.Roslyn`（Roslyn 编译器）、`IO.GltfExporter`（Newtonsoft.Json）、`BimOpenSchema.IO`（ClosedXML/DuckDB.NET/Parquet.Net），以及 `IfcLoader` 携带的原生 `web-ifc-library.dll`。

## 5. 核心库一览

下面按类别快速浏览 `src/` 下的主要库（后续章节会逐一深入）：

### 5.1 跨平台基础（Ara3D.SDK.Core）

| 包 | 说明 |
| --- | --- |
| `Ara3D.Collections` | 只读列表视图、稀疏矩阵、LINQ 辅助 |
| `Ara3D.DataTable` | 列式内存数据接口（struct-of-arrays） |
| `Ara3D.Events` | 线程安全的事件总线 |
| `Ara3D.F8` | SIMD（AVX）8 宽 float 数学 |
| `Ara3D.Logging` | 日志、进度与任务管理 |
| `Ara3D.Memory` | 对齐缓冲区、切片、内存映射文件视图 |
| `Ara3D.PropKit` | 运行时属性描述符，用于 UI 绑定 |
| `Ara3D.Utils` | 路径、压缩、性能分析等通用工具 |
| `Ara3D.Utils.Roslyn` | Roslyn 编译辅助 |
| `Ara3D.WorkItems` | 后台工作项队列 |

### 5.2 几何与模型（Ara3D.SDK.Geometry）

| 包 | 说明 |
| --- | --- |
| `Ara3D.Geometry` | 网格、拓扑、空间查询、程序化建模、导出 |
| `Ara3D.Models` | 场景模型、实例、渲染缓冲区 |
| `Ara3D.F8` | AVX SIMD 数学 |

其中，几何所用的数学类型（`Vector3`、`Matrix4x4`、`Quaternion`、`Number`、`Angle` 等）由 **Plato DSL** 自动生成到 `src/Plato.Generated` 与 `src/Plato.Intrinsics`，并被 `Ara3D.Geometry` 导入。

### 5.3 文件 I/O（Ara3D.SDK.IO，Windows）

| 包 | 说明 |
| --- | --- |
| `Ara3D.IO.BFAST` | 数组序列化二进制容器格式 |
| `Ara3D.IO.G3D` | G3D 几何交换格式（基于 BFAST） |
| `Ara3D.IO.PLY` | PLY 网格导入/导出 |
| `Ara3D.IO.GltfExporter` | glTF/GLB 导出 |
| `Ara3D.IO.SharpGLTF` | glTF/GLB 导入与操作（SharpGLTF 分支） |
| `Ara3D.IO.VIM` | VIM BIM 二进制格式 |
| `Ara3D.IO.StepParser` | ISO STEP 文件分词与解析 |
| `Ara3D.IO.GeoJson` | GeoJSON 与 IMDF 室内地图 |

### 5.4 BIM

| 包 | 说明 |
| --- | --- |
| `Ara3D.BimOpenSchema` | BIM 开放模式（BOS）对象模型 |
| `Ara3D.BimOpenSchema.IO` | Parquet/DuckDB/Excel 序列化与 IFC 导入 |
| `Ara3D.IfcLoader`（ext/） | IFC → BOS 转换（原生 web-ifc） |

### 5.5 Studio 与应用架构

| 包 | 说明 |
| --- | --- |
| `Ara3D.Studio.API` | 流程图、资产与修改器管线类型 |

## 6. 典型应用场景

- **三维格式转换器**：读 IFC/STEP/PLY，写 glTF/GLB，做批量转换与轻量化；
- **参数化建模工具**：用 `IGenerator`/`IModifier` 在 Studio 中生成楼梯、幕墙、屋架、管道等；
- **BIM 数据平台**：把 Revit/IFC 模型导出为 BOS（Parquet），进 DuckDB / 数据湖做分析；
- **自定义查看器/编辑器**：基于 `RenderModelData` 的 GPU 就绪缓冲区，接入自研渲染器；
- **Revit 加载项**：借助 Bowerbird 实时脚本或 BOS 导出插件扩展 Revit。

## 7. 学习路线与本教程结构

本教程共 10 章，建议按顺序学习（也可按需跳读）：

| 章节 | 主题 | 你将学到 |
| --- | --- | --- |
| 第01章 | 全景概览与学习路线 | SDK 定位、架构、包体系（本章） |
| 第02章 | 环境搭建与第一个程序 | 安装、NuGet 引用、TFM、Hello Ara3D |
| 第03章 | 核心基础库 Core | 集合、内存、事件、日志、工作项、数据表 |
| 第04章 | 数学与 F8 SIMD | Vector/Matrix/Quaternion、f8、Vector3x8 |
| 第05章 | 几何与网格建模 | 网格类型、程序化几何、AABB 空间查询 |
| 第06章 | 场景模型 Models | Model3D、实例、材质、渲染缓冲区 |
| 第07章 | 文件 IO 与格式 | BFAST/G3D/PLY/glTF/VIM/STEP/GeoJSON |
| 第08章 | BIM 与 IFC | BOS 对象模型、IFC 加载、Parquet/DuckDB |
| 第09章 | Studio 插件开发 | 生成器、修改器、FlowObject、命令、工具 |
| 第10章 | 二次开发与发布 | Bowerbird、Revit、build/test/pack、发 NuGet |

**前置知识建议**：熟悉 C#（尤其是泛型、扩展方法、`struct`/值类型、`unsafe`/指针的基本概念）、了解 .NET 8 与 NuGet；有三维数学（向量/矩阵/四元数）与 BIM/AEC 基础会更轻松，但不是必需——本教程会在关键处补充背景。

## 8. 本章小结

本章我们建立了对 Ara3D-SDK 的整体认知：

- 它是一套**开源、面向 AEC 的高性能 C# 库集合**，可独立使用，也可扩展 Ara 3D Studio；
- 仓库是 monorepo，`src/` 与 `ext/` 是受支持并打包的库；
- 通过**四个元包**（Core / Geometry / IO / SDK）按需选择，核心库多为**零外部依赖**；
- 架构分为基础、核心、数据、I/O、BIM 五层，几何数学由 Plato 生成；
- 典型场景覆盖格式转换、参数化建模、BIM 数据平台、自定义查看器与 Revit 集成。

下一章，我们将动手搭建开发环境、理解目标框架（`net8.0` vs `net8.0-windows`）的取舍，并写出第一个引用 Ara3D-SDK 的程序。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/ara3d-sdk/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/3d/ara3d-sdk/第02章-环境搭建NuGet包体系与第一个程序/" style="text-decoration: none;">下一章 →</a>
</div>
