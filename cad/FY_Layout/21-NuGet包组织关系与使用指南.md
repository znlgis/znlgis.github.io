# 第二十一章：NuGet 包组织关系与使用指南

## 21.1 概述

FY_Layout 项目（飞扬集成设计平台 - 场地布置插件）采用了一套精心设计的 NuGet 包分层架构，将底层 LightCAD 框架的各个功能层封装为独立的 NuGet 包。这套架构的核心设计理念是：

- **分层解耦**：将几何运算、三维渲染、二维绘图、数据持久化、文件 I/O、UI 控件等功能分别封装到独立的 NuGet 包中
- **按需引用**：插件开发者只需引用自己实际使用的层级包，无需引入整个框架
- **编译期引用、运行期由宿主提供**：采用 NuGet 的 `ref/{tfm}/` 机制，包中的 DLL 仅用于编译时类型解析，运行时由飞扬主程序提供实际程序集
- **统一版本管理**：通过 `Directory.Build.props` 实现所有包的版本、元数据、许可证统一管理

本章将从 NuGet 包的完整清单、依赖关系图、内部程序集组成、MSBuild 构建机制、消费方式等方面进行全面详尽的解析。

---

## 21.2 NuGet 包完整清单

FY_Layout 解决方案（`LightBIM.sln`）中共包含 **11 个 NuGet 包项目**，分为三大类：

### 21.2.1 框架基础层包（6 个）

这是 LightCAD 框架的核心分层，每个包对应一个架构层级：

| 包名 | PackageId | 目标框架 | 程序集数 | 职责 |
|------|-----------|---------|---------|------|
| 核心层 | `Fs.FY.LightCAD.Core` | net8.0 | 3 | 几何元素、数学运算、插件运行时 |
| 渲染层 | `Fs.FY.LightCAD.Render` | net8.0 | 2 | 三维渲染工具、Three.js 几何辅助 |
| 绘图层 | `Fs.FY.LightCAD.Drawing` | net8.0-windows | 3 | 交互式二维绘图、绘图命令基类 |
| 数据层 | `Fs.FY.LightCAD.Data` | net8.0 | 6 | 数据模型、数据库工具、SQLite 存储 |
| I/O 层 | `Fs.FY.LightCAD.IO` | net8.0 | 4 | DXF/JSON/SVG/DWG 文件格式支持 |
| UI 层 | `Fs.FY.LightCAD.UI` | net8.0-windows | 4 | OpenGL 绑定、WinForms 扩展控件、表达式求值 |

### 21.2.2 扩展集成层包（4 个）

用于与外部平台（宿主应用、Rhino、SketchUp、ACS）集成：

| 包名 | PackageId | 目标框架 | 程序集数 | 职责 |
|------|-----------|---------|---------|------|
| 宿主层 | `Fs.FY.LightCAD.Host` | net8.0-windows | 13 | 主程序框架、解决方案管理、WebView2 集成 |
| ACS 模型层 | `Fs.FY.LightCAD.AcsModel` | net8.0 | 3 | ACS BIM 数据互通 |
| Rhino 集成层 | `Fs.FY.LightCAD.Rhino` | net8.0-windows | 5 | Rhino.Inside 互操作 |
| SketchUp 集成层 | `Fs.FY.LightCAD.SketchUp` | net8.0-windows | 3 | SketchUp 模型导入 |

### 21.2.3 插件层包（2 个）

FY_Layout 场地布置功能的实际实现：

| 包名 | PackageId | 目标框架 | 职责 |
|------|-----------|---------|------|
| 场布插件 | `Fs.FY.Layout` | net8.0-windows | 场布元素的二维绘图与三维建模插件 |
| 图形提供程序 | `Fs.FY.Layout.Provider` | net8.0 | 场布元素的 Shape/Solid Provider 注册 |

---

## 21.3 NuGet 包依赖关系图

### 21.3.1 总体依赖关系

以下是所有 NuGet 包之间通过 `ProjectReference` 声明的依赖关系：

```
┌──────────────────────────────────────────────────────────────┐
│                    插件层 (Plugin Layer)                       │
│                                                              │
│   Fs.FY.Layout ──────────┐                                   │
│   (QdLayout 场布插件)      │ 依赖全部 6 个基础层包              │
│                          ▼                                   │
│   Fs.FY.Layout.Provider ─┐                                   │
│   (Provider 注册)         │ 仅依赖 Core + Render              │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    扩展集成层                                  │
│                          │                                   │
│   Host ─── Core + Render + Drawing + Data + UI               │
│   AcsModel ── Core                                           │
│   Rhino ──── Core + Render                                   │
│   SketchUp ── Core                                           │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    框架基础层                                  │
│                          │                                   │
│   UI ──────── Core + Render                                  │
│   Drawing ─── Core                                           │
│   Data ────── Core                                           │
│   IO ──────── Core                                           │
│   Render ──── Core                                           │
│   Core ────── (无依赖，最底层)                                 │
└──────────────────────────────────────────────────────────────┘
```

### 21.3.2 框架基础层依赖关系详解

```
Fs.FY.LightCAD.Core          ← 无外部依赖（最底层基础包）
       ▲
       │
       ├── Fs.FY.LightCAD.Render     ← 依赖 Core
       │          ▲
       │          │
       │          └── Fs.FY.LightCAD.UI  ← 依赖 Core + Render
       │
       ├── Fs.FY.LightCAD.Drawing    ← 依赖 Core
       │
       ├── Fs.FY.LightCAD.Data       ← 依赖 Core
       │
       └── Fs.FY.LightCAD.IO         ← 依赖 Core
```

关键特征：
- **Core 是唯一的零依赖包**，所有其他包都直接或间接依赖它
- **Render 是 UI 的前置依赖**，因为 UI 的 OpenGL 渲染需要 Render 层的三维几何支持
- **Drawing、Data、IO 三者互不依赖**，它们各自只依赖 Core，属于同级平行层
- **UI 层跨越两级**，同时依赖 Core 和 Render

### 21.3.3 插件包 Fs.FY.Layout 的完整依赖链

QdLayout 插件引用了全部 6 个基础层包，它的 `.csproj` 中包含以下 `ProjectReference`：

```xml
<!-- QdLayout.csproj 中的 ProjectReference -->
<ItemGroup>
    <ProjectReference Include="..\Fs.FY.LightCAD.Core\Fs.FY.LightCAD.Core.csproj" />
    <ProjectReference Include="..\Fs.FY.LightCAD.Render\Fs.FY.LightCAD.Render.csproj" />
    <ProjectReference Include="..\Fs.FY.LightCAD.Drawing\Fs.FY.LightCAD.Drawing.csproj" />
    <ProjectReference Include="..\Fs.FY.LightCAD.Data\Fs.FY.LightCAD.Data.csproj" />
    <ProjectReference Include="..\Fs.FY.LightCAD.IO\Fs.FY.LightCAD.IO.csproj" />
    <ProjectReference Include="..\Fs.FY.LightCAD.UI\Fs.FY.LightCAD.UI.csproj" />
</ItemGroup>
```

这意味着当消费者安装 `Fs.FY.Layout` NuGet 包时，NuGet 会自动解析并安装全部 6 个基础层包作为传递依赖。

### 21.3.4 Provider 包 Fs.FY.Layout.Provider 的精简依赖

QdLayoutProvider 只需要核心几何运算和三维渲染能力，因此仅依赖两个包：

```xml
<!-- QdLayoutProvider.csproj 中的 ProjectReference -->
<ItemGroup>
    <ProjectReference Include="..\Fs.FY.LightCAD.Core\Fs.FY.LightCAD.Core.csproj" />
    <ProjectReference Include="..\Fs.FY.LightCAD.Render\Fs.FY.LightCAD.Render.csproj" />
</ItemGroup>
```

这体现了"按需引用"的设计原则：Provider 不涉及 UI、数据库、文件 I/O 和二维绘图，因此不引用这些层。

---

## 21.4 各包内部程序集详解

### 21.4.1 Fs.FY.LightCAD.Core — 核心基础层

**目标框架**：`net8.0`（跨平台）

包含 3 个程序集，位于 `Libs/` 目录：

| 程序集 | 文件名 | 功能描述 |
|--------|--------|----------|
| LightCAD.Core | `LightCAD.Core.dll` | 核心几何元素系统（点、线、弧、多段线、曲线组等）、元素基类 `DirectComponent`、属性系统、图层管理、元素类型注册（`ElementType`、GUID 标识）等 |
| LightCAD.MathLib | `LightCAD.MathLib.dll` | 数学运算库，包含 `Vector2`/`Vector3` 向量运算、`Matrix3`/`Matrix4` 矩阵变换、`Box2`/`Box3` 包围盒、几何求交、三角化等 |
| LightCAD.Runtime | `LightCAD.Runtime.dll` | 插件运行时框架，提供 `ILcPlugin` 接口、`CommandClass`/`CommandMethod` 特性、命令注册与调度、插件生命周期管理 |

**命名空间示例**：
- `LightCAD.Core` — 几何元素基类
- `LightCAD.MathLib` — 数学工具
- `LightCAD.Runtime` — 插件运行时

**使用场景**：所有基于 LightCAD 框架的二次开发都必须引用此包，它是整个包体系的根基。

### 21.4.2 Fs.FY.LightCAD.Render — 三维渲染层

**目标框架**：`net8.0`（跨平台）

**依赖**：`Fs.FY.LightCAD.Core`

包含 2 个程序集：

| 程序集 | 文件名 | 功能描述 |
|--------|--------|----------|
| LightCAD.RenderUtils | `LightCAD.RenderUtils.dll` | 三维渲染工具类、材质管理（`MaterialManager`）、`IElement3dAction` 接口、三维实体生成与导出 |
| ThreeJs4Net | `ThreeJs4Net.dll` | Three.js 的 .NET 移植版，提供 `Object3D`、`Mesh`、`Geometry`、`BufferGeometry`、各种 `Material`、基本几何体（`BoxGeometry`、`SphereGeometry`、`CylinderGeometry`、`ExtrudeGeometry`）等三维图形原语 |

**关键类型**：
- `ThreeJs4Net.Object3D` — 三维场景对象基类
- `ThreeJs4Net.Mesh` — 网格对象（几何体 + 材质）
- `ThreeJs4Net.BoxGeometry` / `SphereGeometry` / `CylinderGeometry` — 基本几何体
- `ThreeJs4Net.ExtrudeGeometry` — 拉伸几何体（从二维轮廓生成三维实体）
- `ThreeJs4Net.MeshLambertMaterial` / `MeshPhongMaterial` / `MeshStandardMaterial` — 材质类型

**使用场景**：需要实现三维模型生成、三维场景渲染的插件开发。

### 21.4.3 Fs.FY.LightCAD.Drawing — 二维绘图层

**目标框架**：`net8.0-windows`（Windows Forms 依赖）

**依赖**：`Fs.FY.LightCAD.Core`

包含 3 个程序集：

| 程序集 | 文件名 | 功能描述 |
|--------|--------|----------|
| LightCAD.Drawing | `LightCAD.Drawing.dll` | 二维绘图画布 `LcCanvas2d`（基于 SkiaSharp）、画笔/画刷 `LcPaint`/`LcTextPaint`、线型/填充样式、坐标系变换、视图控制等 |
| LightCAD.Drawing.Actions | `LightCAD.Drawing.Actions.dll` | 绘图动作基类 `DirectComponentAction`（元素的二维绘制行为）、交互输入器 `PointInputer`/`ElementSetInputer`/`CmdTextInputer`、捕捉系统、夹点编辑 `ControlGrip` |
| LightCAD.Component.Actions | `LightCAD.Component.Actions.dll` | 通用组件动作，提供元素的拖拽、旋转、缩放等交互操作基础设施 |

**关键类型**：
- `LcCanvas2d` — 二维绘图画布
- `DirectComponentAction` — 元素绘制动作基类（每个场布元素如草坪、围墙都需要继承此类实现 `Draw()` 方法）
- `PointInputer` — 点输入器（用于交互式获取鼠标点击坐标）
- `ControlGrip` — 夹点编辑控件（用于元素的拖拽修改）

**使用场景**：需要实现交互式二维绘图、元素绘制、用户输入交互的插件。

### 21.4.4 Fs.FY.LightCAD.Data — 数据管理层

**目标框架**：`net8.0`（跨平台）

**依赖**：`Fs.FY.LightCAD.Core`

包含 6 个程序集：

| 程序集 | 文件名 | 功能描述 |
|--------|--------|----------|
| LightCAD.Model | `LightCAD.Model.dll` | 数据模型定义，元素属性与序列化模型 |
| LightCAD.DBUtility | `LightCAD.DBUtility.dll` | 数据库工具类，通用数据访问接口 |
| LightCAD.DBHelper | `LightCAD.DBHelper.dll` | SQLite 数据库辅助类，连接管理与查询封装 |
| Dapper | `Dapper.dll` | 轻量级 ORM 框架，用于对象关系映射查询 |
| System.Data.SQLite | `System.Data.SQLite.dll` | SQLite ADO.NET 数据提供程序 |
| System.Data.SQLite.EF6 | `System.Data.SQLite.EF6.dll` | SQLite 的 Entity Framework 6 提供程序 |

**使用场景**：需要进行数据持久化、数据库查询、模板数据管理的插件。

### 21.4.5 Fs.FY.LightCAD.IO — 文件 I/O 层

**目标框架**：`net8.0`（跨平台）

**依赖**：`Fs.FY.LightCAD.Core`

包含 4 个程序集：

| 程序集 | 文件名 | 功能描述 |
|--------|--------|----------|
| netDxf | `netDxf.dll` | DXF 文件格式读写库（AutoCAD 交换格式） |
| Newtonsoft.Json | `Newtonsoft.Json.dll` | JSON 序列化/反序列化库（项目数据交换） |
| Svg | `Svg.dll` | SVG 矢量图形读写库 |
| LightCAD.ImpExpDwg | `LightCAD.ImpExpDwg.dll` | LightCAD 原生 DWG 导入/导出工具 |

**使用场景**：需要进行文件导入导出（DXF、DWG、JSON、SVG 格式）的插件。

### 21.4.6 Fs.FY.LightCAD.UI — UI/OpenGL 层

**目标框架**：`net8.0-windows`（Windows Forms 依赖）

**依赖**：`Fs.FY.LightCAD.Core` + `Fs.FY.LightCAD.Render`

包含 4 个程序集：

| 程序集 | 文件名 | 功能描述 |
|--------|--------|----------|
| OpenTK | `OpenTK.dll` | OpenGL 图形绑定库（用于三维场景 GPU 加速渲染） |
| OpenTK.WinForms | `OpenTK.WinForms.dll` | OpenTK 的 WinForms 集成控件 |
| WinFormsUI | `WinFormsUI.dll` | 高级 WinForms UI 控件库（DockPanel 停靠面板等） |
| Flee | `Flee.dll` | 表达式求值引擎（用于参数化设计中的公式计算） |

**使用场景**：需要实现自定义 UI 对话框、三维 OpenGL 视口、表达式公式计算的插件。

### 21.4.7 Fs.FY.LightCAD.Host — 宿主应用层

**目标框架**：`net8.0-windows`

**依赖**：`Core` + `Render` + `Drawing` + `Data` + `UI`

包含 13 个程序集：

| 程序集 | 功能描述 |
|--------|----------|
| LightCAD.WinForm | 主程序 WinForms 框架 |
| LightCAD.UI.WinForm | 主程序 UI 框架 |
| LightCAD.LocalSolution | 本地解决方案管理 |
| LightCAD.Login | 用户认证登录 |
| LightCAD.PrjManager | 项目管理器 |
| LightCAD.WebCore | Web 核心服务 |
| Microsoft.Web.WebView2.Core | WebView2 运行时核心 |
| Microsoft.Web.WebView2.WinForms | WebView2 WinForms 集成 |
| LightCOM.Library | COM 互操作库 |
| QdArch | 架构基础库 |
| QdArchBase | 架构基础扩展 |
| Weikio.PluginFramework | Weikio 插件框架 |
| Weikio.PluginFramework.Abstractions | 插件框架抽象层 |

**使用场景**：需要深度集成主程序功能（如访问解决方案管理、用户认证、WebView2 嵌入网页）的插件。

### 21.4.8 Fs.FY.LightCAD.AcsModel — ACS 模型层

**目标框架**：`net8.0`（跨平台）

**依赖**：`Core`

包含 3 个程序集（来自 `飞扬主程序/` 目录）：

| 程序集 | 功能描述 |
|--------|----------|
| AcsModel.DesignFile | ACS 设计文件操作 |
| AcsModel.Project | ACS 项目管理 |
| AcsModel.System | ACS 系统接口 |

**使用场景**：需要与 ACS BIM 平台进行数据交互的插件。

### 21.4.9 Fs.FY.LightCAD.Rhino — Rhino3D 集成层

**目标框架**：`net8.0-windows`

**依赖**：`Core` + `Render`

包含 5 个程序集：

| 程序集 | 功能描述 |
|--------|----------|
| LightCAD.Rhino | LightCAD 与 Rhino 的桥接层 |
| Rhino.Inside | Rhino.Inside 运行时 |
| RhinoCommon | Rhino 通用 API |
| Rhino.UI | Rhino UI 组件 |
| RhinoWindows | Rhino Windows 集成 |

**使用场景**：需要在飞扬平台内使用 Rhino 的 NURBS 曲面、实体建模能力的插件。

### 21.4.10 Fs.FY.LightCAD.SketchUp — SketchUp 集成层

**目标框架**：`net8.0-windows`

**依赖**：`Core`

包含 3 个程序集：

| 程序集 | 功能描述 |
|--------|----------|
| LightCAD.SketchUp | LightCAD 与 SketchUp 的桥接层 |
| SketchUpAPI | SketchUp C API 的 .NET 封装 |
| SketchUpCommonPreferences | SketchUp 通用首选项 |

**使用场景**：需要导入或操作 SketchUp 模型的插件。

---

## 21.5 核心设计机制：ref/{tfm}/ 编译期引用

### 21.5.1 设计原理

FY_Layout 的 NuGet 包采用了一个关键的技术手段：**将所有 DLL 放置在 NuGet 包的 `ref/{tfm}/` 路径下，而非 `lib/{tfm}/` 路径下**。

这两个路径在 NuGet 中有根本性的区别：

| 路径 | 用途 | 是否复制到输出目录 | 是否用于编译 |
|------|------|-------------------|-------------|
| `lib/{tfm}/` | 标准库路径 | ✅ 是 | ✅ 是 |
| `ref/{tfm}/` | 仅编译引用路径 | ❌ 否 | ✅ 是 |

### 21.5.2 为什么选择 ref/{tfm}/ ？

飞扬集成设计平台是一个**宿主应用程序**（类似 AutoCAD、Revit），插件运行在宿主进程内。宿主主程序已经提供了 LightCAD 框架的所有 DLL。如果 NuGet 包使用 `lib/{tfm}/` 路径，那么每个插件的输出目录都会包含一份框架 DLL 的副本，这会导致：

1. **版本冲突**：不同插件可能引用不同版本的框架 DLL，导致运行时类型不兼容
2. **文件冗余**：每个插件目录都包含重复的框架 DLL 副本
3. **加载歧义**：CLR 可能从插件目录而非宿主目录加载 DLL，导致不可预期的行为

使用 `ref/{tfm}/` 路径后：

- **编译时**：NuGet 提供 DLL 供编译器解析类型、方法签名
- **运行时**：宿主主程序提供实际的 DLL 程序集
- **插件输出目录**：只包含插件自身的 DLL，不包含任何框架 DLL
- **消费者无需配置**：不需要设置 `Private=false` 或 `ExcludeAssets="runtime"`

### 21.5.3 在 .csproj 中的实现方式

以 `Fs.FY.LightCAD.Core` 包为例，其 `.csproj` 文件中的关键配置：

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <PackageId>Fs.FY.LightCAD.Core</PackageId>
    <IsPackable>true</IsPackable>
    <!-- 不输出自身的构建产物到包中 -->
    <IncludeBuildOutput>false</IncludeBuildOutput>
    <BaseOutputPath>..\Build\Packages</BaseOutputPath>
  </PropertyGroup>

  <!--
    DLL 放在 ref/net8.0/ 下：
    - 编译时可用于类型解析
    - 运行时不会被复制到消费者的输出目录
  -->
  <ItemGroup>
    <None Include="..\Libs\LightCAD.Core.dll"
          Pack="true"
          PackagePath="ref\net8.0\" />
    <None Include="..\Libs\LightCAD.MathLib.dll"
          Pack="true"
          PackagePath="ref\net8.0\" />
    <None Include="..\Libs\LightCAD.Runtime.dll"
          Pack="true"
          PackagePath="ref\net8.0\" />
  </ItemGroup>
</Project>
```

关键属性解释：
- `IsPackable=true`：允许通过 `dotnet pack` 生成 NuGet 包
- `IncludeBuildOutput=false`：不将项目自身编译产物（如果有的话）包含在 NuGet 包中
- `Pack="true"` + `PackagePath="ref\net8.0\"`：将 DLL 打包到 `ref/{tfm}/` 路径下

### 21.5.4 不同目标框架的 ref 路径

注意不同包使用的 `ref/` 子路径有所不同：

| 目标框架 | ref 路径 | 使用的包 |
|---------|----------|---------|
| net8.0 | `ref/net8.0/` | Core, Render, Data, IO, AcsModel |
| net8.0-windows | `ref/net8.0-windows7.0/` | Drawing, UI, Host, Rhino, SketchUp |

使用 `net8.0-windows` 的包通常包含 Windows Forms 依赖（`<UseWindowsForms>true</UseWindowsForms>`），因此需要 Windows 特定的目标框架标识符。

### 21.5.5 与传统 Private=false 方式的对比

在传统的 CAD 插件开发中（如 AutoCAD .NET API），开发者通常需要手动设置引用的 `Private=false`（即"不复制到本地"）：

```xml
<!-- 传统方式：需要每个引用都设置 Private=false -->
<Reference Include="acdbmgd">
    <HintPath>...\acdbmgd.dll</HintPath>
    <Private>false</Private>
</Reference>
```

而 FY_Layout 的 `ref/{tfm}/` 方式让消费者完全不需要关心这些：

```xml
<!-- 消费者只需安装 NuGet 包，无需任何额外配置 -->
<PackageReference Include="Fs.FY.LightCAD.Core" Version="1.0.0" />
```

这是一个显著的开发体验提升。

---

## 21.6 MSBuild 构建机制详解

### 21.6.1 Directory.Build.props — 全局构建属性

位于仓库根目录的 `Directory.Build.props` 文件对解决方案中的**所有项目**生效。其完整内容如下：

```xml
<Project>

  <PropertyGroup>
    <!-- 统一版本号 -->
    <Version>1.0.0</Version>
    <AssemblyVersion>1.0.0.0</AssemblyVersion>
    <FileVersion>1.0.0.0</FileVersion>

    <!-- 统一 NuGet 元数据 -->
    <Authors>znlgis</Authors>
    <Company>飞扬集成设计平台</Company>
    <Copyright>Copyright (c) 飞扬集成设计平台. Licensed under CC-BY-NC 4.0.</Copyright>
    <PackageLicenseFile>LICENSE</PackageLicenseFile>
    <PackageProjectUrl>https://github.com/znlgis/FY_Layout</PackageProjectUrl>
    <RepositoryUrl>https://github.com/znlgis/FY_Layout.git</RepositoryUrl>
    <RepositoryType>git</RepositoryType>
    <PackageTags>FeiYang;LightCAD;BIM;CAD;Layout;Construction;Architecture</PackageTags>
    <PackageReadmeFile>README.md</PackageReadmeFile>

    <!-- 生成 XML 文档文件（用于 IntelliSense） -->
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>$(NoWarn);CS1591</NoWarn>
  </PropertyGroup>

  <!-- 全局导入：所有项目都自动引用 Core 和 Render 层 -->
  <Import Project="$(MSBuildThisFileDirectory)props\LightCAD.CoreRefs.props" />
  <Import Project="$(MSBuildThisFileDirectory)props\LightCAD.RenderRefs.props" />

  <!-- 所有 NuGet 包都包含 LICENSE 文件 -->
  <ItemGroup>
    <None Include="$(MSBuildThisFileDirectory)LICENSE" Pack="true" PackagePath="\" />
  </ItemGroup>

</Project>
```

**设计要点**：

1. **统一版本**：所有包共享 `1.0.0` 版本号，保证版本一致性
2. **统一元数据**：作者、许可证、仓库 URL 等信息只需定义一次
3. **自动导入 Core + Render**：通过 `Import` 语句，所有项目自动获得 Core 层（3 个 DLL）和 Render 层（2 个 DLL）的编译引用
4. **XML 文档生成**：启用 IntelliSense 智能提示支持

### 21.6.2 props 目录 — 分层引用属性文件

`props/` 目录下有 6 个 MSBuild 属性文件，每个对应一个架构层级：

#### LightCAD.CoreRefs.props — 核心层引用

```xml
<!--
  Foundation layer — core geometry, math, and plugin runtime.
  Imported by Directory.Build.props so every project has these references.
-->
<Project>
  <ItemGroup>
    <Reference Include="LightCAD.Core">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.Core.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="LightCAD.MathLib">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.MathLib.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="LightCAD.Runtime">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.Runtime.dll</HintPath>
      <Private>false</Private>
    </Reference>
  </ItemGroup>
</Project>
```

#### LightCAD.RenderRefs.props — 渲染层引用

```xml
<!--
  3D rendering layer — render utilities and Three.js geometry helpers.
  Imported by Directory.Build.props so every project has these references.
-->
<Project>
  <ItemGroup>
    <Reference Include="LightCAD.RenderUtils">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.RenderUtils.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="ThreeJs4Net">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\ThreeJs4Net.dll</HintPath>
      <Private>false</Private>
    </Reference>
  </ItemGroup>
</Project>
```

#### LightCAD.DrawingRefs.props — 绘图层引用

```xml
<!--
  2D drawing layer — interactive drawing operations and action command base classes.
  Imported by projects that implement interactive 2D drawing commands.
-->
<Project>
  <ItemGroup>
    <Reference Include="LightCAD.Drawing">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.Drawing.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="LightCAD.Drawing.Actions">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.Drawing.Actions.dll</HintPath>
      <Private>false</Private>
    </Reference>
  </ItemGroup>
</Project>
```

#### LightCAD.DataRefs.props — 数据层引用

```xml
<!--
  Data management layer — model definitions and database/template utilities.
  Imported by projects that persist or query element data.
-->
<Project>
  <ItemGroup>
    <Reference Include="LightCAD.Model">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.Model.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="LightCAD.DBUtility">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\LightCAD.DBUtility.dll</HintPath>
      <Private>false</Private>
    </Reference>
  </ItemGroup>
</Project>
```

#### LightCAD.IORefs.props — I/O 层引用

```xml
<!--
  File I/O layer — DXF, JSON, and SVG format support.
  Imported by projects that import/export drawing data.
-->
<Project>
  <ItemGroup>
    <Reference Include="netDxf">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\netDxf.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="Newtonsoft.Json">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\Newtonsoft.Json.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="Svg">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\Svg.dll</HintPath>
      <Private>false</Private>
    </Reference>
  </ItemGroup>
</Project>
```

#### LightCAD.UIRefs.props — UI/OpenGL 层引用

```xml
<!--
  UI / OpenGL layer — Windows Forms UI extensions, OpenGL bindings, and expression evaluation.
  Imported by projects that render 3D scenes or present advanced UI controls.
-->
<Project>
  <ItemGroup>
    <Reference Include="OpenTK">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\OpenTK.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="OpenTK.WinForms">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\OpenTK.WinForms.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="WinFormsUI">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\WinFormsUI.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="Flee">
      <HintPath>$(MSBuildThisFileDirectory)..\Libs\Flee.dll</HintPath>
      <Private>false</Private>
    </Reference>
  </ItemGroup>
</Project>
```

### 21.6.3 两种引用机制的协作

FY_Layout 中存在两套并行的引用机制，它们各自服务于不同目的：

| 机制 | 配置位置 | 目的 | 作用时机 |
|------|---------|------|---------|
| `.props` 文件中的 `<Reference>` | `props/*.props` + `Directory.Build.props` | 提供编译时 DLL 引用（指向 `Libs/` 目录的实际 DLL） | `dotnet build` 编译时 |
| `.csproj` 中的 `<ProjectReference>` | 各包的 `.csproj` | 记录 NuGet 包依赖关系（生成 `.nuspec` 中的 `<dependencies>`） | `dotnet pack` 打包时 |

**具体运作流程**：

1. 开发者执行 `dotnet build`：
   - `Directory.Build.props` 自动导入 `CoreRefs.props` 和 `RenderRefs.props`
   - 项目特定的 `.csproj` 按需导入其他 `.props`（如 `DrawingRefs.props`）
   - 编译器使用 `Libs/` 目录中的 DLL 进行类型解析

2. 开发者执行 `dotnet pack`：
   - 各 `.csproj` 中的 `<ProjectReference>` 被 NuGet 转换为包依赖关系
   - DLL 通过 `<None Include="..." Pack="true" PackagePath="ref/{tfm}/" />` 放入 `ref/` 目录
   - 生成 `.nupkg` 文件

3. 消费者安装 NuGet 包：
   - NuGet 解析 `ref/{tfm}/` 中的 DLL 供编译使用
   - 不复制任何 DLL 到消费者输出目录
   - 运行时由宿主主程序提供这些 DLL

### 21.6.4 props 文件的导入策略

**全局导入**（所有项目自动获得）：

| props 文件 | 导入位置 | 理由 |
|-----------|---------|------|
| `LightCAD.CoreRefs.props` | `Directory.Build.props` | 所有项目都需要几何和运行时基础 |
| `LightCAD.RenderRefs.props` | `Directory.Build.props` | 所有项目都需要三维渲染能力 |

**按需导入**（仅特定项目使用）：

| props 文件 | 导入位置 | 使用的项目 |
|-----------|---------|----------|
| `LightCAD.DrawingRefs.props` | `QdLayout.csproj` | 仅插件项目需要二维绘图 |
| `LightCAD.DataRefs.props` | `QdLayout.csproj` | 仅插件项目需要数据持久化 |
| `LightCAD.IORefs.props` | `QdLayout.csproj` | 仅插件项目需要文件 I/O |
| `LightCAD.UIRefs.props` | `QdLayout.csproj` | 仅插件项目需要 UI 和 OpenGL |

QdLayout 插件是唯一一个需要全部 6 个层引用的项目：

```xml
<!-- QdLayout.csproj 中按需导入的层级引用 -->
<Import Project="..\props\LightCAD.DrawingRefs.props" />
<Import Project="..\props\LightCAD.DataRefs.props" />
<Import Project="..\props\LightCAD.IORefs.props" />
<Import Project="..\props\LightCAD.UIRefs.props" />
<!-- Core 和 Render 已由 Directory.Build.props 全局导入 -->
```

而 QdLayoutProvider 只需要 Core + Render（由 `Directory.Build.props` 全局导入），不需要额外导入任何 `.props` 文件。

---

## 21.7 Libs 目录 — 预编译程序集仓库

### 21.7.1 概述

`Libs/` 目录存放了所有 LightCAD 框架和第三方库的预编译 DLL 文件。这些 DLL 有两个用途：

1. **开发时**：作为 `<Reference>` 的 `HintPath` 目标，提供编译时类型信息
2. **打包时**：作为 NuGet 包的内容来源，被复制到 `ref/{tfm}/` 路径下

### 21.7.2 完整 DLL 清单

以下按所属层级分组列出 `Libs/` 目录中的所有 DLL：

**核心层 (Core)**：
| DLL | 功能 |
|-----|------|
| `LightCAD.Core.dll` | 核心几何元素系统 |
| `LightCAD.MathLib.dll` | 数学运算库 |
| `LightCAD.Runtime.dll` | 插件运行时框架 |

**渲染层 (Render)**：
| DLL | 功能 |
|-----|------|
| `LightCAD.RenderUtils.dll` | 三维渲染工具 |
| `ThreeJs4Net.dll` | Three.js .NET 移植版 |

**绘图层 (Drawing)**：
| DLL | 功能 |
|-----|------|
| `LightCAD.Drawing.dll` | 二维绘图画布与工具 |
| `LightCAD.Drawing.Actions.dll` | 绘图动作基类 |
| `LightCAD.Component.Actions.dll` | 通用组件动作 |

**数据层 (Data)**：
| DLL | 功能 |
|-----|------|
| `LightCAD.Model.dll` | 数据模型 |
| `LightCAD.DBUtility.dll` | 数据库工具 |
| `LightCAD.DBHelper.dll` | SQLite 辅助 |
| `Dapper.dll` | ORM 框架 |
| `System.Data.SQLite.dll` | SQLite 提供程序 |
| `System.Data.SQLite.EF6.dll` | SQLite EF6 |

**I/O 层 (IO)**：
| DLL | 功能 |
|-----|------|
| `netDxf.dll` | DXF 文件读写 |
| `Newtonsoft.Json.dll` | JSON 处理 |
| `Svg.dll` | SVG 矢量图形 |
| `LightCAD.ImpExpDwg.dll` | DWG 导入/导出 |

**UI 层 (UI)**：
| DLL | 功能 |
|-----|------|
| `OpenTK.dll` | OpenGL 绑定 |
| `OpenTK.WinForms.dll` | OpenTK WinForms 集成 |
| `WinFormsUI.dll` | 高级 UI 控件 |
| `Flee.dll` | 表达式求值器 |

**其他**：
| DLL | 功能 |
|-----|------|
| `LightCAD.Rhino.dll` | Rhino 桥接（Rhino 包使用） |
| `LightCAD.SketchUp.dll` | SketchUp 桥接（SketchUp 包使用） |

---

## 21.8 NuGet 包的生成与发布

### 21.8.1 构建命令

生成所有 NuGet 包的命令：

```bash
# 进入仓库根目录
cd FY_Layout

# 打包所有项目（Release 配置）
dotnet pack -c Release

# 或仅打包特定项目
dotnet pack Fs.FY.LightCAD.Core -c Release
dotnet pack QdLayout -c Release
```

### 21.8.2 输出路径

不同项目的 NuGet 包输出到不同位置：

| 项目类型 | BaseOutputPath | 包输出路径 |
|---------|----------------|-----------|
| 框架层包（Core/Render/Drawing/Data/IO/UI） | `..\Build\Packages` | `Build/Packages/Release/` |
| 扩展集成层包（Host/AcsModel/Rhino/SketchUp） | `..\Build\Packages` | `Build/Packages/Release/` |
| QdLayout 插件 | `..\Build` | `Build/Release/` |
| QdLayoutProvider | `..\Build\Providers` | `Build/Providers/Release/` |

### 21.8.3 生成的 .nupkg 文件

运行 `dotnet pack` 后生成的包文件：

```
Build/
├── Packages/
│   └── Release/
│       ├── Fs.FY.LightCAD.Core.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.Render.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.Drawing.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.Data.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.IO.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.UI.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.Host.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.AcsModel.1.0.0.nupkg
│       ├── Fs.FY.LightCAD.Rhino.1.0.0.nupkg
│       └── Fs.FY.LightCAD.SketchUp.1.0.0.nupkg
├── Release/
│   └── Fs.FY.Layout.1.0.0.nupkg
└── Providers/
    └── Release/
        └── Fs.FY.Layout.Provider.1.0.0.nupkg
```

### 21.8.4 NuGet 包内部结构

以 `Fs.FY.LightCAD.Core.1.0.0.nupkg` 为例，解压后的目录结构：

```
Fs.FY.LightCAD.Core.1.0.0/
├── Fs.FY.LightCAD.Core.nuspec     ← 包元数据
├── LICENSE                         ← 许可证文件
├── README.md                       ← 说明文档
├── ref/
│   └── net8.0/
│       ├── LightCAD.Core.dll       ← 编译时引用
│       ├── LightCAD.MathLib.dll    ← 编译时引用
│       └── LightCAD.Runtime.dll    ← 编译时引用
└── [Content_Types].xml
```

注意：`ref/net8.0/` 下没有 `lib/` 目录，这意味着这些 DLL 不会被复制到消费者的输出目录。

### 21.8.5 nuget.config 配置

仓库根目录的 `nuget.config` 定义了包源：

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <!-- 可选：GitHub Packages 源 -->
    <!-- <add key="github"
         value="https://nuget.pkg.github.com/znlgis/index.json" /> -->
  </packageSources>
</configuration>
```

目前默认使用官方 nuget.org 源。如需使用 GitHub Packages 私有源，取消注释即可。

---

## 21.9 消费者使用指南 — 如何使用这些 NuGet 包进行二次开发

### 21.9.1 前置条件

- **开发环境**：Visual Studio 2022（17.5.5 或更高版本）
- **目标框架**：.NET 8.0（如使用 Windows Forms UI 则需 `net8.0-windows`）
- **运行环境**：飞扬集成设计平台主程序（提供运行时 DLL）

### 21.9.2 典型插件项目的 NuGet 引用方案

根据插件的功能需求，选择需要引用的包：

**场景一：仅需几何运算的纯计算插件**

```xml
<ItemGroup>
    <PackageReference Include="Fs.FY.LightCAD.Core" Version="1.0.0" />
</ItemGroup>
```

**场景二：需要三维建模的 Provider 插件**

```xml
<ItemGroup>
    <PackageReference Include="Fs.FY.LightCAD.Core" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.Render" Version="1.0.0" />
</ItemGroup>
```

> 注意：由于 Render 依赖 Core，NuGet 会自动解析 Core 包，因此实际上只需引用 Render 即可。但显式声明两者可以更清晰地表达意图。

**场景三：完整的交互式绘图插件（类似 QdLayout）**

```xml
<ItemGroup>
    <PackageReference Include="Fs.FY.LightCAD.Core" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.Render" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.Drawing" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.Data" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.IO" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.UI" Version="1.0.0" />
</ItemGroup>
```

**场景四：需要访问宿主应用功能的插件**

```xml
<ItemGroup>
    <PackageReference Include="Fs.FY.LightCAD.Host" Version="1.0.0" />
    <!-- Host 包会传递依赖 Core, Render, Drawing, Data, UI -->
</ItemGroup>
```

**场景五：需要 Rhino 三维建模能力的插件**

```xml
<ItemGroup>
    <PackageReference Include="Fs.FY.LightCAD.Rhino" Version="1.0.0" />
    <!-- Rhino 包会传递依赖 Core + Render -->
</ItemGroup>
```

### 21.9.3 完整的二次开发项目模板

以下是一个完整的插件项目 `.csproj` 文件模板：

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <!-- 如果使用 WinForms UI，使用 net8.0-windows -->
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>

    <!-- 输出为类库（插件 DLL） -->
    <OutputType>Library</OutputType>
    <AssemblyName>MyCustomPlugin</AssemblyName>
  </PropertyGroup>

  <!-- 根据需要选择引用的 LightCAD 层包 -->
  <ItemGroup>
    <PackageReference Include="Fs.FY.LightCAD.Core" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.Render" Version="1.0.0" />
    <PackageReference Include="Fs.FY.LightCAD.Drawing" Version="1.0.0" />
    <!-- 按需添加其他层包 -->
  </ItemGroup>

</Project>
```

### 21.9.4 插件入口类示例

```csharp
using LightCAD.Runtime;

namespace MyCustomPlugin;

/// <summary>
/// 自定义插件入口点
/// </summary>
[CommandClass]
public class MyPlugin : ILcPlugin
{
    public string Name => "我的自定义插件";
    public string Description => "基于 LightCAD 框架的二次开发示例";

    public void Initialize()
    {
        // 插件初始化逻辑
        Console.WriteLine($"{Name} 已加载");
    }

    public void Terminate()
    {
        // 插件卸载清理逻辑
    }

    /// <summary>
    /// 自定义命令示例
    /// </summary>
    [CommandMethod(Name = "MyCmd", ShortCuts = "MC")]
    public void MyCommand()
    {
        // 命令实现逻辑
    }
}
```

### 21.9.5 运行时部署

编译后的插件 DLL 需要部署到飞扬主程序的插件目录中：

```
飞扬主程序安装目录/
├── LightCAD.exe              ← 主程序（提供所有框架 DLL）
├── LightCAD.Core.dll         ← 运行时 DLL（由主程序提供）
├── LightCAD.MathLib.dll
├── LightCAD.Runtime.dll
├── ... (其他框架 DLL)
├── Plugins/
│   └── MyCustomPlugin/
│       └── MyCustomPlugin.dll  ← 你的插件 DLL（仅此一个文件）
└── Providers/
    └── MyCustomProvider/
        └── MyProvider.dll      ← Provider DLL（如果有的话）
```

由于 NuGet 包使用 `ref/{tfm}/` 机制，插件的输出目录中不会包含任何框架 DLL，只有插件自身的程序集。这正是该设计的核心优势。

---

## 21.10 解决方案结构与 Visual Studio 分组

### 21.10.1 LightBIM.sln 解决方案结构

在 Visual Studio 中打开 `LightBIM.sln`，解决方案资源管理器中的项目组织如下：

```
LightBIM.sln
├── WorkingDrawing/                     ← 解决方案文件夹
│   ├── Plugins/                        ← 插件项目组
│   │   └── QdLayout                    ← 场布插件项目
│   └── Providers/                      ← Provider 项目组
│       └── QdLayoutProvider            ← 场布 Provider 项目
└── Packages/                           ← NuGet 包项目组
    ├── Fs.FY.LightCAD.Core
    ├── Fs.FY.LightCAD.Render
    ├── Fs.FY.LightCAD.Drawing
    ├── Fs.FY.LightCAD.Data
    ├── Fs.FY.LightCAD.IO
    ├── Fs.FY.LightCAD.UI
    ├── Fs.FY.LightCAD.Host
    ├── Fs.FY.LightCAD.AcsModel
    ├── Fs.FY.LightCAD.Rhino
    └── Fs.FY.LightCAD.SketchUp
```

### 21.10.2 解决方案文件夹说明

| 文件夹 | GUID | 用途 |
|--------|------|------|
| WorkingDrawing | `{C4431186-...}` | 施工图设计相关项目的顶层分组 |
| Plugins | `{97221518-...}` | 插件项目（QdLayout）的分组 |
| Providers | `{04A5E9C8-...}` | Provider 项目（QdLayoutProvider）的分组 |
| Packages | `{BD02353B-...}` | 所有 NuGet 包项目的分组 |

---

## 21.11 版本管理策略

### 21.11.1 统一版本号

所有 NuGet 包通过 `Directory.Build.props` 共享统一的版本号：

```xml
<PropertyGroup>
    <Version>1.0.0</Version>
    <AssemblyVersion>1.0.0.0</AssemblyVersion>
    <FileVersion>1.0.0.0</FileVersion>
</PropertyGroup>
```

这意味着：
- 所有包始终保持相同版本，避免兼容性问题
- 升级时只需修改 `Directory.Build.props` 中的版本号
- 消费者可以放心引用同版本的任意包组合

### 21.11.2 版本升级流程

1. 修改 `Directory.Build.props` 中的 `<Version>`
2. 运行 `dotnet pack -c Release`
3. 所有 `.nupkg` 文件自动使用新版本号
4. 发布到 NuGet 源（nuget.org 或 GitHub Packages）

### 21.11.3 语义化版本建议

- **主版本号**（Major）：框架 API 发生不兼容变更时递增
- **次版本号**（Minor）：新增功能但保持向后兼容时递增
- **修订号**（Patch）：Bug 修复时递增

---

## 21.12 包元数据与许可证

### 21.12.1 统一元数据

所有包通过 `Directory.Build.props` 共享以下元数据：

| 属性 | 值 | 说明 |
|------|-----|------|
| Authors | znlgis | 包作者 |
| Company | 飞扬集成设计平台 | 所属组织 |
| Copyright | Copyright (c) 飞扬集成设计平台. Licensed under CC-BY-NC 4.0. | 版权声明 |
| PackageLicenseFile | LICENSE | CC-BY-NC 4.0 许可证 |
| PackageProjectUrl | https://github.com/znlgis/FY_Layout | 项目主页 |
| RepositoryUrl | https://github.com/znlgis/FY_Layout.git | Git 仓库地址 |
| PackageTags | FeiYang;LightCAD;BIM;CAD;Layout;Construction;Architecture | 搜索标签 |
| PackageReadmeFile | README.md | NuGet 包说明文档 |

### 21.12.2 许可证

项目使用 **CC-BY-NC 4.0**（知识共享 署名-非商业性使用 4.0 国际）许可证。每个 NuGet 包中都包含 `LICENSE` 文件：

```xml
<!-- Directory.Build.props 中 -->
<ItemGroup>
    <None Include="$(MSBuildThisFileDirectory)LICENSE"
          Pack="true" PackagePath="\" />
</ItemGroup>
```

### 21.12.3 各包的独立描述

每个包在其 `.csproj` 中定义了独立的 `<Description>`，清晰说明该包的功能和包含的程序集：

| 包 | 描述（中文） |
|-----|-------------|
| Core | 飞扬集成设计平台 LightCAD 基础层 - 包含核心几何元素、数学运算与插件运行时 |
| Render | 飞扬集成设计平台 LightCAD 渲染层 - 包含三维渲染工具与 Three.js 几何辅助库 |
| Drawing | 飞扬集成设计平台 LightCAD 二维绘图层 - 包含交互式绘图操作、绘图命令基类与通用动作组件 |
| Data | 飞扬集成设计平台 LightCAD 数据管理层 - 包含模型定义、数据库工具与 SQLite 存储 |
| IO | 飞扬集成设计平台 LightCAD 文件 I/O 层 - 包含 DXF、JSON、SVG 格式支持与 DWG 导入导出 |
| UI | 飞扬集成设计平台 LightCAD UI/OpenGL 层 - 包含 Windows Forms UI 扩展控件、OpenGL 图形绑定与表达式求值器 |
| Host | 飞扬集成设计平台宿主应用层 - 包含主程序框架、解决方案管理、用户认证、项目管理与 WebView2 集成等宿主 API |
| AcsModel | 飞扬集成设计平台 ACS BIM 模型集成层 |
| Rhino | 飞扬集成设计平台 Rhino3D 集成层 |
| SketchUp | 飞扬集成设计平台 SketchUp 集成层 |
| Layout | 飞扬集成设计平台 - 场地布置插件 |
| Layout.Provider | 飞扬集成设计平台 - 场地布置图形提供程序 |

---

## 21.13 进阶主题

### 21.13.1 创建自己的 NuGet 层包

如果你正在开发的功能需要被多个插件复用，可以参考 FY_Layout 的分层模式创建自己的 NuGet 包：

**步骤一**：创建包项目

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <PackageId>MyCompany.LightCAD.MyLayer</PackageId>
    <Description>我的自定义层包</Description>
    <IsPackable>true</IsPackable>
    <IncludeBuildOutput>false</IncludeBuildOutput>
  </PropertyGroup>

  <!-- 将 DLL 放入 ref 目录 -->
  <ItemGroup>
    <None Include="path\to\MyLibrary.dll"
          Pack="true"
          PackagePath="ref\net8.0\" />
  </ItemGroup>

  <!-- 声明依赖关系 -->
  <ItemGroup>
    <PackageReference Include="Fs.FY.LightCAD.Core" Version="1.0.0" />
  </ItemGroup>
</Project>
```

**步骤二**：生成包

```bash
dotnet pack -c Release
```

**步骤三**：在插件项目中引用

```xml
<PackageReference Include="MyCompany.LightCAD.MyLayer" Version="1.0.0" />
```

### 21.13.2 使用本地 NuGet 源进行开发

在开发阶段，可以使用本地文件夹作为 NuGet 源：

```xml
<!-- nuget.config -->
<configuration>
  <packageSources>
    <clear />
    <add key="local" value="C:\MyPackages" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
```

将生成的 `.nupkg` 文件复制到 `C:\MyPackages` 目录后，Visual Studio 即可识别并安装。

### 21.13.3 使用 GitHub Packages 发布

FY_Layout 的 `nuget.config` 中预留了 GitHub Packages 源的配置：

```xml
<!-- 取消注释即可启用 -->
<add key="github" value="https://nuget.pkg.github.com/znlgis/index.json" />
```

发布到 GitHub Packages：

```bash
# 设置 API Key
dotnet nuget add source "https://nuget.pkg.github.com/znlgis/index.json" \
    --name github \
    --username znlgis \
    --password YOUR_GITHUB_TOKEN

# 发布包
dotnet nuget push "Build/Packages/Release/*.nupkg" \
    --source github
```

### 21.13.4 调试 NuGet 包引用问题

常见问题排查：

**问题 1**：编译时提示找不到类型

```
error CS0246: 未能找到类型或命名空间名"DirectComponent"
```

**解决**：确保引用了 `Fs.FY.LightCAD.Core` 包，该类型定义在 `LightCAD.Core.dll` 中。

**问题 2**：运行时提示 DLL 未找到

```
System.IO.FileNotFoundException: Could not load file or assembly 'LightCAD.Core'
```

**解决**：确保插件运行在飞扬主程序环境中。`ref/{tfm}/` 包不提供运行时 DLL，这些由宿主主程序提供。

**问题 3**：版本不匹配

```
System.TypeLoadException: Could not load type 'XXX' from assembly 'LightCAD.Core'
```

**解决**：确保 NuGet 包版本与飞扬主程序版本匹配。所有包应使用相同版本号。

---

## 21.14 各包用途速查表

### 21.14.1 按功能需求选择包

| 我需要的功能 | 应引用的包 |
|-------------|-----------|
| 定义几何元素、向量运算 | Core |
| 注册插件、定义命令 | Core（包含 Runtime） |
| 生成三维模型 | Core + Render |
| 实现二维交互绘图 | Core + Drawing |
| 读写数据库 | Core + Data |
| 导入/导出 DXF/DWG 文件 | Core + IO |
| 导入/导出 JSON 数据 | Core + IO |
| 创建自定义 UI 对话框 | Core + UI |
| 使用 OpenGL 三维视口 | Core + Render + UI |
| 访问宿主主程序 API | Host（自动包含 Core/Render/Drawing/Data/UI） |
| 使用 Rhino 建模 | Core + Render + Rhino |
| 导入 SketchUp 模型 | Core + SketchUp |
| 完整的场布类插件 | Core + Render + Drawing + Data + IO + UI |

### 21.14.2 按包内容速查

| 包 | 提供的关键类型 |
|----|-------------|
| Core | `DirectComponent`, `ElementType`, `Polyline2d`, `Line2d`, `Arc2d`, `Vector2`, `Vector3`, `Matrix3`, `Box2`, `ILcPlugin`, `CommandClass`, `CommandMethod` |
| Render | `Object3D`, `Mesh`, `BoxGeometry`, `ExtrudeGeometry`, `MeshLambertMaterial`, `MaterialManager`, `IElement3dAction` |
| Drawing | `LcCanvas2d`, `LcPaint`, `DirectComponentAction`, `PointInputer`, `ElementSetInputer`, `ControlGrip` |
| Data | `LightCAD.Model.*`, `Dapper.SqlMapper`, `System.Data.SQLite.*` |
| IO | `netDxf.DxfDocument`, `Newtonsoft.Json.JsonConvert`, `Svg.SvgDocument` |
| UI | `OpenTK.GLControl`, `WinFormsUI.DockPanel`, `Flee.ExpressionContext` |

---

## 21.15 总结

FY_Layout 的 NuGet 包体系是一个教科书级的**宿主-插件架构** NuGet 分层设计案例。其核心设计理念可以总结为：

1. **分层架构**：6 个基础层 + 4 个扩展层 + 2 个插件层，共 12 个 NuGet 包，职责边界清晰
2. **ref/{tfm}/ 机制**：利用 NuGet 的编译期引用特性，实现"编译时用包、运行时用宿主"的零冲突部署
3. **MSBuild props 分层导入**：通过 `.props` 文件组织编译引用，`Directory.Build.props` 实现全局默认 + 按需扩展
4. **ProjectReference 记录依赖**：`.csproj` 中的 `ProjectReference` 用于 `dotnet pack` 时生成正确的包依赖关系
5. **统一版本管理**：`Directory.Build.props` 集中管理版本号和元数据，确保所有包一致

这套设计让二次开发者可以：
- 通过 `dotnet add package` 一键安装所需的框架层
- 无需手动配置 `Private=false` 或复制 DLL
- 插件输出目录干净整洁，只包含自身程序集
- 享受 NuGet 的自动依赖解析和版本管理
