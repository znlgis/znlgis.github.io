---
layout: default
title: 第01章：Elements 概述与快速入门
---

# 第01章：Elements 概述与快速入门

## 1.1 Elements 是什么

Hypar Elements（简称 Elements）是由 Hypar 公司（hypar-io）开源的**建筑信息模型（BIM）编程生成库**，专为 AEC（Architecture, Engineering & Construction，建筑/结构/机电/施工）领域设计。它以纯 C# 代码的方式生成建筑模型——墙、梁、柱、楼板、空间、机电管道等——无需启动任何商业 BIM 软件，也不需要商业几何内核的授权。

> Elements 是"基于 .NET 的编程式 BIM 建模引擎 + 自研几何内核 + 多格式互操作层"——它让建筑模型成为一种可版本控制、可自动化生成、可集成到 CI/CD 的数据产物。

关键信息速览：

| 项目 | 内容 |
| --- | --- |
| GitHub 仓库 | [hypar-io/Elements](https://github.com/hypar-io/Elements) |
| NuGet 包 | `Hypar.Elements` |
| 当前版本 | 2.4.x |
| 技术栈 | C# / .NET Standard 2.0 + .NET 6.0 |
| 许可协议 | MIT |
| 坐标系 | 右手坐标系，+Z 向上 |
| 精度约定 | `Vector3.EPSILON = 1e-5`（所有几何比较必须使用容差方法） |
| 核心依赖 | Newtonsoft.Json、LibTessDotNet、glTF2Loader、自定义 Csg fork、NetOctree |

## 1.2 为什么选择 Elements

### 1.2.1 传统 BIM 开发的痛点

在 Elements 出现之前，以编程方式生成建筑模型通常意味着：

- **绑定商业平台**：必须安装 Revit、Rhino 等商业软件的 SDK，模型只能在特定环境中运行
- **几何内核昂贵**：Parasolid、ACIS 等商业几何内核授权费高昂，且无法在 Linux 服务器上运行
- **格式壁垒**：不同软件之间的数据交换依赖 IFC 等中间格式，信息丢失严重
- **不可版本控制**：BIM 模型通常是二进制大文件，难以用 Git 管理
- **无法自动化**：在 CI/CD 流水线中生成和验证建筑模型几乎不可能

### 1.2.2 Elements 的解决方案

Elements 从根本上重新思考了建筑模型应该如何被创建和管理：

| 痛点 | Elements 的解决方案 |
| --- | --- |
| 绑定商业平台 | 纯 .NET 库，无宿主依赖，可在任何支持 .NET 的环境运行（Windows/Linux/macOS） |
| 几何内核昂贵 | 自研混合 BREP/CSG 几何内核，MIT 许可，零授权费 |
| 格式壁垒 | 原生支持 JSON / glTF / GLB / IFC / DXF / SVG 双向转换 |
| 不可版本控制 | JSON 序列化格式是人类可读的文本，天然适合 Git diff |
| 无法自动化 | 可作为 NuGet 包集成到任何 .NET 项目，在 CI/CD 中自动生成、验证和导出模型 |

### 1.2.3 核心定位

```
Elements 是"参数化的、可编程的、互操作的建筑模型描述语言"
      ——用 C# 描述建筑，而不是用鼠标点击
```

Elements 不是另一个 BIM 工具的替代品，而是**把建筑模型从"图形文件"升级为"代码资产"**的桥梁。你可以：

- 在微服务中用代码生成数千个建筑方案变体
- 将生成结果导出为 glTF 在 Web 上预览
- 导出为 IFC 供 Revit、Archicad 等专业软件深化
- 用 JSON 格式做 diff、做版本管理、做自动化审查

## 1.3 解决方案结构

Elements 是一个多项目解决方案（`Elements.sln`），包含 10 个项目，按职责分为四层：

```
Elements.sln
├── 核心层 (Core)
│   └── Elements\                     核心库，260+ 个 .cs 文件
│       ├── Element.cs ...            55+ 种建筑元素类型
│       ├── Geometry\                 混合 BREP/CSG 几何内核（50 文件）
│       ├── Spatial\                  空间数据结构
│       ├── Search\                   图与空间索引
│       ├── Serialization\            JSON/glTF 序列化
│       ├── Analysis\                 分析可视化
│       └── Annotations\              标注系统
│
├── 互操作层 (Interop)
│   ├── Elements.Serialization.IFC\   Model ⇄ IFC 双向转换
│   ├── Elements.Serialization.DXF\   Model → DXF 导出
│   └── Elements.Serialization.SVG\   Model → SVG/PDF 导出
│
├── 领域扩展层 (Domain Extensions)
│   ├── Elements.MEP\                 机电系统（管路配件、压力/流量分析）
│   ├── Elements.Components\          组件化生成框架
│   └── Elements.CodeGeneration\      JSON Schema → C# 代码生成
│
├── 辅助项目 (Supporting)
│   ├── Elements.Playground\          浏览器内实时编码编辑器（Blazor + Roslyn）
│   └── Elements.Benchmarks\          性能基准测试（BenchmarkDotNet）
│
└── Schemas\                          核心类型 JSON Schema（draft-07）——代码生成的事实标准
    ├── Element.json / GeometricElement.json / Material.json / Model.json
    └── Geometry\ (Vector3/Curve/Arc/Line/Polygon/Profile/Mesh/Transform/Solids...)
```

### 1.3.1 核心层：Elements 主库

这是整个生态的基石。260+ 个 C# 文件，按功能组织在子目录中：

| 子目录 | 职责 | 关键类型 |
| --- | --- | --- |
| `src\Geometry\` | 几何内核：向量、曲线、多边形、轮廓、网格、实体、变换 | `Vector3`、`Line`、`Arc`、`Polygon`、`Profile`、`Solid`、`Transform` |
| `src\Geometry\Solids\` | CSG 实体操作：拉伸、扫描、层板、构造实体 | `SolidOperation`、`Extrude`、`Sweep`、`Lamina` |
| `src\` | 建筑元素类型体系 | `Wall`、`Beam`、`Column`、`Floor`、`Space`、`Mass` 等 |
| `src\Spatial\` | 空间拓扑数据结构 | `Grid1d`/`Grid2d`、`CellComplex`、`AdaptiveGrid` |
| `src\Search\` | 图与空间索引 | `Network`、`Octree`、`BinaryTree` |
| `src\Serialization\` | JSON/glTF 序列化 | `Model.ToJson()`、`Model.ToGlTF()` |

### 1.3.2 互操作层：格式转换

Elements 的序列化架构让模型可以在 AEC 行业的主流格式之间自由流转：

| 项目 | 方向 | 支持格式 |
| --- | --- | --- |
| `Serialization.JSON`（核心内置） | 双向 | JSON（人类可读、Git 友好） |
| `Serialization.glTF`（核心内置） | 导出 | glTF 2.0 / GLB（Web 3D 标准） |
| `Serialization.IFC` | 双向 | IFC 2x3 / IFC 4（BIM 行业标准） |
| `Serialization.DXF` | 导出 | DXF（CAD 交换格式） |
| `Serialization.SVG` | 导出 | SVG / PDF（图纸输出） |

### 1.3.3 领域扩展层

- **Elements.MEP**（beta）：机电管道系统，包括管路配件（弯头、三通、变径等）、分流/合流节点、压力与流量计算（Hazen-Williams 公式），以及自适应网格管线寻路
- **Elements.Components**：组件化生成框架，支持定义可重用组件（`ComponentDefinition`），通过放置规则（阵列、网格、折线、位置、尺寸驱动）实例化为模型
- **Elements.CodeGeneration**：Schema-first 代码生成工具链。JSON Schema 定义类型 → NJsonSchema 生成 C# 类——核心库的类型和第三方自定义类型使用**完全相同**的生成方式

### 1.3.4 Schemas 目录

`Schemas/` 下存放所有核心类型的 JSON Schema 定义（draft-07）。这是 Elements "Schema-first" 设计理念的体现——类型系统首先在 Schema 中定义，然后通过代码生成工具生成 C# 类。这种设计意味着：

- 类型定义与语言无关（Schema 是跨语言的）
- 第三方可以完全相同的方式扩展类型系统
- 序列化格式有精确的 Schema 验证

## 1.4 核心设计理念

### 1.4.1 Schema-first 开发

Elements 的类型系统不是手写 C# 类然后生成 Schema，而是**先定义 Schema，再生成代码**。这在 `Schemas/` 目录中体现得淋漓尽致：

```
Schemas\
├── Element.json          # 所有元素的基类型
├── GeometricElement.json # 带几何表示的元素
├── Material.json         # 材质
├── Model.json            # 模型容器
└── Geometry\
    ├── Vector3.json
    ├── Polygon.json
    ├── Profile.json
    ├── Solids\
    │   ├── SolidOperation.json
    │   ├── Extrude.json
    │   ├── Sweep.json
    │   └── Lamina.json
    └── ...
```

Schema 使用 JSON Schema draft-07，通过 `discriminator` 属性实现多态类型标记（`JsonInheritanceConverter`）。当你定义自定义元素类型时，遵循相同的流程——这意味着你的自定义类型与核心内置类型在天花板上没有差别。

### 1.4.2 无宿主依赖

Elements 刻意不依赖任何商业软件或商业几何内核：

- **无 Revit 依赖**：不需要安装 Autodesk Revit
- **无 Rhino 依赖**：不需要 McNeel Rhinoceros 或 openNURBS
- **无 Parasolid/ACIS**：不使用任何商业几何内核
- **纯 .NET**：可以在 Linux Docker 容器中运行，支持微服务和 CI/CD 流水线

核心几何计算依赖一个**自定义 fork 的 Csg 库**（编译为 `lib/Csg.dll`）和 LibTessDotNet（二维三角剖分）。这使 Elements 成为少有的"能在 Linux 服务器上运行的建筑几何引擎"。

### 1.4.3 数据流架构

Elements 的典型数据流路径清晰地展示了从创建到输出的完整链条：

```
创建元素 Wall( Line, Profile, height )
  │
  ├── UpdateRepresentations()
  │    将 Extrude 等 SolidOperation 填入 Representation.SolidOperations
  │
  ├── Model.AddElement( gatherSubElements=true, updateRepresentations=true )
  │    反射递归收集子元素（RecursiveGatherSubElements）
  │
  ├── UpdateBoundsAndComputeSolid()
  │    调用 Csg 库计算布尔运算 → 生成 Csg.Solid + 包围盒 BBox3
  │
  └── 导出
      ├── Model.ToJson()       →  JSON 文本（可 diff、可版本控制）
      ├── Model.ToGlTF()       →  GLB/glTF 二进制（Web 3D 预览）
      ├── Model.ToIFC()        →  IFC 文件（专业 BIM 软件深化）
      ├── Model → DXF          →  CAD 图纸
      └── Model → SVG/PDF      →  矢量图纸/报告
```

### 1.4.4 表示与实体分离

Elements 2.1 引入了"表示实例"（RepresentationInstance）架构，将**元素的几何表示**与**元素本身**解耦：

- `GeometricElement`：建筑元素的业务属性（名称、类型、材质引用等）
- `Representation` + `SolidOperation`：几何操作列表（拉伸、扫描、挖空等）
- `RepresentationInstance`：将表示绑定到特定材质和视图类型

同一个元素可以有多个 `RepresentationInstance`——例如，一堵墙在结构视图中显示为核心混凝土，在建筑视图中显示为带饰面层。

## 1.5 环境搭建与第一个程序

### 1.5.1 环境要求

| 组件 | 最低版本 | 说明 |
| --- | --- | --- |
| .NET SDK | 6.0+ | Elements.csproj 目标 net6.0 |
| IDE | Visual Studio 2022 / Rider / VS Code | 任意 .NET IDE |
| 操作系统 | Windows / Linux / macOS | 无 OS 限制 |
| NuGet 源 | nuget.org | `Hypar.Elements` 包发布在官方 NuGet |

### 1.5.2 创建项目并安装 Elements

```powershell
# 创建控制台项目
dotnet new console -n ElementsDemo
cd ElementsDemo

# 添加 Hypar.Elements NuGet 包
dotnet add package Hypar.Elements
```

如果需要 IFC 导出功能，额外安装：

```powershell
dotnet add package Hypar.Elements.Serialization.IFC
```

### 1.5.3 第一个程序：创建一堵墙

下面的代码展示了 Elements 最基本的用法——创建一堵 4 米长的墙，导出为 glTF 在浏览器中查看：

```csharp
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;

// 1. 定义墙的定位线（4 米长的线段）
var line = new Line(
    new Vector3(0, 0, 0),    // 起点
    new Vector3(4, 0, 0)     // 终点：4 米长
);

// 2. 使用标准剖面（也可以是自定义轮廓）
var profile = new Profile(
    Polygon.Rectangle(0.2, 3.0)  // 宽 0.2m，高 3.0m
);

// 3. 创建墙元素
var wall = new Wall(
    line,     // 定位线
    profile,  // 剖面/轮廓
    3.0       // 高度
);

// 4. 创建模型容器并添加元素
var model = new Model();
model.AddElement(wall);

// 5. 导出为 glTF 格式（可在浏览器中查看）
model.ToGlTF("wall.glb");
```

运行后会在当前目录生成 `wall.glb` 文件，可以用任何 glTF 查看器（Windows 3D 查看器、在线 [gltf-viewer](https://gltf-viewer.donmccurdy.com/)、Three.js 等）打开查看。

### 1.5.4 第一个程序：导出为 JSON

Elements 的原生序列化格式是 JSON，人类可读且对 Git 友好：

```csharp
using Elements;
using Elements.Geometry;

var model = new Model();

// 创建一根梁
var beamLine = new Line(new Vector3(0, 0, 3), new Vector3(6, 0, 3));
var beam = new Beam(
    beamLine,
    new Profile(Polygon.Rectangle(0.3, 0.5))  // 宽 0.3m，高 0.5m
);
model.AddElement(beam);

// 序列化为 JSON 字符串
string json = model.ToJson();

// 写入文件
File.WriteAllText("beam.json", json);

// 从 JSON 反序列化回来
var loaded = Model.FromJson(json);
Console.WriteLine($"加载了 {loaded.Elements.Count} 个元素");
```

输出：

```
加载了 1 个元素
```

生成的 JSON 文件可以直接用 Git 管理，修改前后用 `git diff` 可以看到每次设计变更的精确内容。下面是一个简化的 JSON 片段示例：

```json
{
  "discriminator": "Elements.Model",
  "Elements": {
    "abc123": {
      "discriminator": "Elements.Beam",
      "Id": "abc123",
      "Name": null,
      "Transform": null,
      "Material": { ... },
      "Representation": {
        "SolidOperations": [
          {
            "discriminator": "Elements.Geometry.Solids.Extrude",
            "Profile": { ... },
            "Extent": 6.0,
            "Direction": { "X": 0, "Y": 1, "Z": 0 }
          }
        ]
      }
    }
  }
}
```

### 1.5.5 创建更多建筑元素

让我们在一个程序中创建墙、柱、楼板三种基本建筑元素：

```csharp
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;

var model = new Model();

// --- 楼板 ---
var floorOutline = Polygon.LShape(8, 6, 3, 4);  // L 形轮廓
var floor = new Floor(floorOutline, 0.2);         // 厚度 0.2m
model.AddElement(floor);

// --- 墙 ---
// 用矩形轮廓创建四面外墙
var wallProfile = new Profile(Polygon.Rectangle(0.2, 3.0));

var walls = new[]
{
    new Wall(new Line(new Vector3(0, 0, 0), new Vector3(8, 0, 0)), wallProfile, 3.0),
    new Wall(new Line(new Vector3(8, 0, 0), new Vector3(8, 6, 0)), wallProfile, 3.0),
    new Wall(new Line(new Vector3(8, 6, 0), new Vector3(0, 6, 0)), wallProfile, 3.0),
    new Wall(new Line(new Vector3(0, 6, 0), new Vector3(0, 0, 0)), wallProfile, 3.0),
};

foreach (var wall in walls)
{
    model.AddElement(wall);
}

// --- 柱 ---
var columnProfile = new Profile(Polygon.Rectangle(0.3, 0.3));
var positions = new[]
{
    new Vector3(1, 1, 0),
    new Vector3(7, 1, 0),
    new Vector3(7, 5, 0),
    new Vector3(1, 5, 0),
};

foreach (var pos in positions)
{
    var column = new Column(pos, 3.0, columnProfile);
    model.AddElement(column);
}

// 导出
model.ToGlTF("building.glb");
Console.WriteLine($"模型中包含 {model.Elements.Count} 个元素（含子元素）");
```

### 1.5.6 使用命名空间和 using 指令

Elements 项目中的常用命名空间：

```csharp
using Elements;                         // Element, Model, Material, GeometricElement
using Elements.Geometry;               // Vector3, Line, Arc, Polygon, Profile, Transform
using Elements.Geometry.Solids;        // SolidOperation, Extrude, Sweep, Lamina
using Elements.Geometry.Profiles;      // WProfile, HSSProfile, CProfile 等型钢轮廓
using Elements.Spatial;                // Grid1d, Grid2d, CellComplex, AdaptiveGrid
using Elements.Serialization.JSON;     // Model.ToJson(), Model.FromJson()
using Elements.Serialization.glTF;     // Model.ToGlTF(), Model.ToGlb()
```

## 1.6 Elements 与其他 BIM 技术的对比

| 维度 | Elements | Revit API | IFC 直接生成 | Three.js |
| --- | --- | --- | --- | --- |
| 定位 | 编程式建模库 | BIM 平台插件开发 | 数据格式 | 3D 渲染引擎 |
| 几何引擎 | 自研 BREP/CSG | Autodesk 内核 | 无（仅描述） | 无几何内核 |
| 运行环境 | .NET 任意平台 | 仅 Windows + Revit | 任意 | 浏览器/Node.js |
| 建筑语义 | 丰富（墙/梁/柱/空间等） | 极丰富 | 标准定义 | 无 |
| IFC 导出 | 原生支持 | 原生支持 | 原生就是 IFC | 需额外开发 |
| 版本控制 | JSON文本，Git友好 | 困难（RVT二进制） | IFC文本，可diff | JS/JSON文本 |
| Docker 部署 | 支持 | 不支持 | 支持 | 支持 |
| 学习曲线 | 中等 | 陡峭（需Revit+API） | 中高（需懂IFC规范） | 低 |

## 1.7 教程学习路线

本教程围绕"基础入门 → 核心概念 → 几何系统 → 建筑元素 → 布尔运算 → 材质渲染 → 序列化互操作 → 空间搜索 → 专业扩展 → 实战案例"这条主线展开。

| 章节 | 主题 | 学习目标 |
| --- | --- | --- |
| 第01章 | 概述与快速入门 | 理解 Elements 定位，跑通第一个模型 |
| 第02章 | 核心概念：Element 与 Model | 掌握类型体系、元素生命周期、模型容器 |
| 第03-04章 | 几何系统 | 掌握向量/曲线/多边形/剖面/实体操作 |
| 第05-07章 | 建筑元素系列 | 创建完整的建筑结构模型 |
| 第08章 | CSG 布尔运算 | 理解几何内核的工作机制 |
| 第09章 | 材质与渲染 | 为模型赋予视觉属性 |
| 第10章 | 序列化与互操作 | 导出 JSON/glTF/IFC/DXF/SVG |
| 第11-12章 | 空间与搜索 | 空间网格、拓扑图、网络寻路 |
| 第13章 | MEP 机电系统 | 管道生成与水力分析 |
| 第14章 | 组件化生成 | 可重用组件与放置规则 |
| 第15章 | Schema 驱动开发 | 自定义元素类型与代码生成 |
| 第16章 | 实战案例 | 综合建筑建模项目 |

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <span></span>
  <a href="https://znlgis.github.io/3d/elements/第01章-Elements概述与快速入门/">目录</a>
  <a href="https://znlgis.github.io/3d/elements/第01章-Elements概述与快速入门/第02章-核心概念Element与Model/">下一章 →</a>
</div>
