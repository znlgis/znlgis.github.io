---
layout: default
title: 第11章：XbimGeometry几何引擎架构与OCCT集成
---

# 第11章：Xbim.Geometry 几何引擎架构与 OCCT 集成

到目前为止我们处理的都是"语义层"——属性、关系、空间结构。从本章开始，我们进入 Xbim 的另一半重头戏：**几何**。即把 IFC 模型中以参数化、隐式描述的几何对象（拉伸、扫掠、布尔差集、曲面…）转化为可渲染的网格或可计算的实体。

## 1. 为什么需要专门的几何引擎

IFC 把几何分成两个层次：

- **位置（Placement）**：相对坐标系；
- **形状（Representation）**：用各种 `IfcRepresentationItem` 子类描述形状本体。

形状描述方式可分为两大类：

1. **隐式（implicit）**：参数化的几何，例如：
   - `IfcExtrudedAreaSolid`：把 2D 轮廓沿某方向拉伸；
   - `IfcRevolvedAreaSolid`：旋转生成；
   - `IfcSweptDiskSolid`：圆截面沿曲线扫掠（管道）；
   - `IfcBooleanResult`：A 与 B 做并/差/交；
   - `IfcCsgSolid`：CSG 树。
2. **显式（explicit）**：
   - `IfcFacetedBrep`、`IfcManifoldSolidBrep`：面表示；
   - `IfcTriangulatedFaceSet`：三角网格；
   - `IfcPolygonalFaceSet`：多边形面集合。

绝大多数主流 BIM 软件导出的 IFC 倾向**隐式描述**（更紧凑、便于编辑）。但要在 3D 视图中显示，必须把它们转换为三角网格。这个转换涉及 NURBS、布尔运算、面修复、曲面三角化等大量复杂运算 —— 这正是 [Open CASCADE Technology](https://github.com/Open-Cascade-SAS/OCCT)（OCCT）这类工业级几何内核擅长的工作。

`Xbim.Geometry` 的核心思路是：**用 OCCT 来"翻译"IFC 几何**。

## 2. XbimGeometry 仓库的整体架构

```
XbimGeometry
├── Xbim.Geometry.Abstractions/        纯托管接口（IXbimGeometryEngine 等）
├── Xbim.Geometry.Engine/              C++/CLI 实现，包装 OCCT
├── Xbim.Geometry.Engine.Interop/      托管侧加载/调用，跨 x86/x64
├── Xbim.ModelGeometry.Scene/          场景管理、实例化、Wexbim 输出
├── Xbim.Geometry.NetCore/             .NET Core 兼容层（把 OCCT 的 native 库延迟加载）
├── Xbim.Geometry.Engine.Tests/        几何回归测试用例
└── ThirdParty/ OCC/                   预编译的 OCCT 7.6.3 头与库
```

按层次：

```
应用代码（C#）
    │ 调用
    ▼
Xbim.Geometry.Engine.Interop (托管)
    │ 加载/调用
    ▼
Xbim.Geometry.Engine (C++/CLI mixed-mode DLL)
    │ 调用
    ▼
OCCT 7.6.3 (TKernel.dll, TKMath.dll, TKBRep.dll, TKTopAlgo.dll, TKBO.dll, TKMesh.dll, ...)
```

## 3. 核心接口：IXbimGeometryEngine

在 `Xbim.Geometry.Abstractions` 中：

```csharp
public interface IXbimGeometryEngine
{
    XbimShapeGeometry CreateShapeGeometry(
        IIfcRepresentationItem representation,
        double precision,
        double deflection,
        double angle,
        XbimGeometryType targetGeomType = XbimGeometryType.Polyhedron,
        XbimGeometryCreator.LoggingEvents events = ...);

    IXbimSolid CreateSolid(IIfcExtrudedAreaSolid solid);
    IXbimSolid CreateSolid(IIfcRevolvedAreaSolid solid);
    IXbimSolidSet CreateBooleanResult(IIfcBooleanResult boolOp);

    IXbimGeometryObject Create(IIfcRepresentationItem ifcGeometry, ILogger logger = null);

    IXbimShell  CreateShell(IIfcConnectedFaceSet ifcShell);
    IXbimGeometryObjectSet  CreateSurfaceModel(IIfcFaceBasedSurfaceModel surface);

    XbimMatrix3D ToMatrix3D(IIfcAxis2Placement3D placement);

    void WriteTriangulation(BinaryWriter bw, IXbimGeometryObject geom, double tolerance, double deflection, double angle);
    // ...
}
```

每一个 IFC 几何元素都有对应的 `Create*`/`Convert*` 方法。一般我们不直接调它，而是通过更高层的 `Xbim3DModelContext`（见下章与第 13 章）批量处理。

## 4. C++/CLI 桥接层

`Xbim.Geometry.Engine`（mixed-mode）是一个 C++/CLI DLL，把 OCCT 的 C++ 类型包装成 CLR 类型。例如：

- `XbimSolid`（CLI ref class）→ 内部持有 `TopoDS_Solid` 智能指针；
- `XbimShell` → `TopoDS_Shell`；
- `XbimEdge`、`XbimFace`、`XbimWire` → 对应 OCCT 类型；
- `XbimVector3D` 与 OCCT `gp_Vec` 之间互转。

C++/CLI 的好处：

- 调用 OCCT C++ 不必 P/Invoke + 大量 marshal；
- 可以让 C# 抛出/捕获 native 异常；
- mixed-mode 程序集可同时被 C# 项目引用。

代价：

- 仅支持 Windows + MSVC；
- 必须用 MSBuild 编译；
- 调试时需要"启用 native 代码调试"。

## 5. OCCT 7.6.3 提供了什么

XbimGeometry 主要使用 OCCT 的：

- **TKernel / TKMath**：基础几何（点、向量、矩阵、容差）；
- **TKBRep / TKG3d**：边界表达（`TopoDS_Shape`、`Geom_Surface`）；
- **TKGeomBase / TKGeomAlgo**：曲线/曲面构造、求交；
- **TKBO**：布尔运算（`BRepAlgoAPI_Cut/Common/Fuse`）；
- **TKTopAlgo**：拓扑算法（`BRepBuilderAPI_*`、`BRepPrimAPI_*`、`BRepOffsetAPI_*`）；
- **TKMesh**：三角化（`BRepMesh_IncrementalMesh`）；
- **TKShHealing**：模型修复（容差统一、缝合）。

OCCT 是 LGPL 兼容许可，Xbim 把用到的部分以 NuGet/捆绑形式分发，免去用户自己编译几小时 OCCT 的痛苦。

## 6. 加载 native 库：Xbim.Geometry.Engine.Interop

托管端通过 `XbimGeometryEngine` 类（注意：与 abstractions 里的接口同名，是其默认实现的 wrapper）加载 native：

```csharp
public class XbimGeometryEngine : IXbimGeometryEngine
{
    public XbimGeometryEngine(ILogger<XbimGeometryEngine> logger = null)
    {
        // 1) 探测当前进程是 x86 还是 x64；
        // 2) 从同目录加载 OCCT *.dll；
        // 3) 加载 mixed-mode Xbim.Geometry.Engine.dll；
        // 4) 反射拿到内部 IXbimGeometryEngine 实现。
    }

    public IXbimGeometryObject Create(IIfcRepresentationItem ifcGeometry, ILogger logger = null)
        => _engine.Create(ifcGeometry, logger);
}
```

要点：

- 如果你用 `dotnet publish`，**必须**保证 OCCT 的所有 `TK*.dll` 与 `Xbim.Geometry.Engine.x64.dll`（mixed-mode）一并复制到输出目录；
- v6 后 `XbimServices.Current.GetService<IXbimGeometryEngine>()` 可在 DI 容器中解析；
- 在 Linux/macOS 上调用会抛 `Xbim.Common.Exceptions.XbimException`（明确不支持）。

## 7. ModelFactors 的关键作用

每次几何转换调用都会用到 `IModelFactors`：

| 字段 | 几何用途 |
| --- | --- |
| `Precision` | 容差，OCCT 中用于判断点重合、共线、共面 |
| `DeflectionTolerance` | 三角化的弦长偏差（mm） |
| `DeflectionAngle` | 三角化的角度偏差（rad） |
| `LengthToMetresConversionFactor` | 单位换算（多用于读取/写出 Wexbim 时） |

**精度的实务建议**：

- 对于以 `mm` 为单位的模型（最常见），Precision = 0.01 (mm)，Deflection = 5–10 (mm) 适合多数可视化场景；
- 1m 单位的模型 Precision = 0.00001 (m)；
- 太松会导致布尔失败、面裂缝；太紧会让三角化巨慢、内存爆炸。

## 8. 最简单的几何转换示例

```csharp
using Xbim.Geometry.Engine.Interop;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;
using Microsoft.Extensions.Logging.Abstractions;

using var model = IfcStore.Open("SampleHouse.ifc");
var engine = new XbimGeometryEngine(NullLogger<XbimGeometryEngine>.Instance);

foreach (var rep in model.Instances.OfType<IIfcExtrudedAreaSolid>().Take(3))
{
    var solid = engine.CreateSolid(rep);
    Console.WriteLine($"Volume of #{rep.EntityLabel} = {solid.Volume:F3}");
}
```

输出每个拉伸体的体积。OCCT 已经把 `IfcExtrudedAreaSolid` 转成了 `TopoDS_Solid`，并提供精确体积计算。

## 9. 几何 IO：Wexbim 文件

`Xbim.ModelGeometry.Scene` 模块的 `Xbim3DModelContext` 在批量处理几何后，会把结果以 **`.wexbim`**（Web XBIM）格式持久化：

- 二进制流；
- 体积小（例如 100MB IFC 通常生成 5–20MB wexbim）；
- 包含产品 → 三角网格的映射；
- 直接被 `Xbim.WindowsUI`、`Xbim.WebUI` 加载渲染；
- 可重复使用：一次转换、多次显示。

第 13 章会展开 Wexbim 与可视化。

## 10. 跨平台之路：Xbim.Geometry.NetCore

社区一直在尝试让几何引擎跨平台运行。`Xbim.Geometry.NetCore` 项目尝试：

- 把 OCCT 编译成 Linux `.so` / macOS `.dylib`；
- 用 P/Invoke 替代 C++/CLI；
- 用 `NativeLibrary.Load` 按平台动态加载。

目前 master 分支的几何引擎仍主要面向 Windows，跨平台支持处于实验阶段。如果你必须在 Linux 部署 IFC 几何处理，目前更稳妥的方式是：

- **方案 A**：Windows 服务做几何转换 → 输出 wexbim → Linux 端只做 IO/Web；
- **方案 B**：用 IfcOpenShell（C++）+ pythonOCC 做 Linux 端转换；
- **方案 C**：在 Docker for Windows 中运行 Xbim 几何处理。

## 11. 错误处理与日志

几何转换不是万能的，遇到病态几何（自相交、零体积、过于尖锐的角）OCCT 会失败。**必须**为 `IXbimGeometryEngine` 注入 `ILogger`：

```csharp
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

var sp = new ServiceCollection()
    .AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Warning))
    .BuildServiceProvider();
var logger = sp.GetRequiredService<ILogger<XbimGeometryEngine>>();
var engine = new XbimGeometryEngine(logger);
```

引擎会输出诸如：

```
warn: Boolean Cut failed for #1234 IfcExtrudedAreaSolid x IfcOpeningElement #4567, falling back to single solid.
```

调试时可以根据 EntityLabel 在 IFC 文件中定位问题源头。

## 12. 小结

`Xbim.Geometry` 是一个：

- 用 C++/CLI 桥接 OCCT 7.6.3；
- 把 IFC 几何（隐式 + 显式）翻译为 OCCT B-Rep；
- 进一步三角化为 Wexbim/网格；
- 仅在 Windows 上稳定，跨平台仍在演进。

掌握它需要理解 OCCT 的 B-Rep 数据结构、容差系统、布尔算法。如果你做过 OCCT 二次开发，就会发现 Xbim.Geometry 几乎就是"IFC 形状 → OCCT 形状"的一对一映射。

下一章我们会具体走完一遍：从 `IfcExtrudedAreaSolid` 到三角网格的全过程，以及布尔运算、扫掠、放样、面修复等高级几何。
