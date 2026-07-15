---
layout: default
title: 第02章：环境搭建、NuGet包体系与第一个程序
---

# 第02章：环境搭建、NuGet 包体系与第一个程序

本章带你从零搭好 Ara3D-SDK 的开发环境，理解它的目标框架（TFM）与 NuGet 包体系，并写出第一个可运行的程序。

## 1. 环境要求

Ara3D-SDK 基于 **.NET 8**。你需要准备：

- **.NET 8 SDK**（`dotnet --version` 应输出 `8.x`）；
- 一个 IDE：**Visual Studio 2022**（17.8+）、**JetBrains Rider** 或 **VS Code + C# Dev Kit** 均可；
- 若要使用 **文件 I/O、IFC、WPF** 等 Windows 专属功能，需要 **Windows x64**（因为这些库的目标框架是 `net8.0-windows`，`Ara3D.IfcLoader` 还依赖原生 64 位 DLL）；
- 若只做**跨平台**的基础工具与几何计算（`Ara3D.SDK.Core` / `Ara3D.SDK.Geometry`），Linux / macOS 也可运行。

> CPU 提示：`Ara3D.F8` 使用 **AVX**（256 位）指令；`Ara3D.Memory` 按 64 字节对齐以适配 AVX-512。现代 x64 CPU 均支持 AVX，SDK 在不支持时也有回退路径，但要获得最佳性能建议使用较新的 x64 处理器。

## 2. 目标框架：net8.0 与 net8.0-windows

理解两种 TFM 的分工，是正确引用 SDK 的关键：

| 包层级 | TFM | 原因 |
| --- | --- | --- |
| `Ara3D.SDK.Core` | `net8.0` | 跨平台：Collections、Utils、Logging、Memory、Events、WorkItems、PropKit、DataTable、Utils.Roslyn |
| `Ara3D.SDK.Geometry` | `net8.0` | 跨平台：Geometry、Models、F8（SIMD）、Memory、Collections |
| `Ara3D.SDK.IO` | `net8.0-windows` | 需要 Windows：所有 I/O 格式、BOS、`Ara3D.IfcLoader`（原生 DLL） |
| `Ara3D.SDK` | `net8.0-windows` | 完整栈，含 WPF 辅助 |
| `Ara3D.Utils.Wpf`（ext/） | `net8.0-windows` | WPF 仅 Windows |
| `Ara3D.IfcLoader`（ext/） | `net8.0-windows` | `web-ifc-library.dll` 为 x64 Windows 原生库 |

因此，如果你的项目要引用 `Ara3D.SDK` 或 `Ara3D.SDK.IO`，`.csproj` 中的目标框架应写成：

```xml
<TargetFramework>net8.0-windows</TargetFramework>
```

若只用跨平台部分：

```xml
<TargetFramework>net8.0</TargetFramework>
```

## 3. 通过 NuGet 引用（推荐）

日常使用**最简单**的方式是从 NuGet 引用元包。新建一个控制台项目并添加引用：

```bash
dotnet new console -n MyAra3DApp
cd MyAra3DApp
# 跨平台基础
dotnet add package Ara3D.SDK.Core
# 或几何栈
dotnet add package Ara3D.SDK.Geometry
# 或完整 Windows 栈（需将 TFM 改为 net8.0-windows）
dotnet add package Ara3D.SDK
```

对应到 `.csproj`：

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <!-- 若引用 Ara3D.SDK / Ara3D.SDK.IO 改为 net8.0-windows -->
    <TargetFramework>net8.0-windows</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <!-- F8/SIMD 与部分 IO 使用 unsafe 指针 -->
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Ara3D.SDK" Version="1.6.1" />
  </ItemGroup>
</Project>
```

你也可以**只引用单个库**，得到更小的依赖面：

```xml
<PackageReference Include="Ara3D.Collections" Version="1.6.1" />
<PackageReference Include="Ara3D.Geometry" Version="1.6.1" />
<PackageReference Include="Ara3D.IO.PLY" Version="1.6.1" />
<PackageReference Include="Ara3D.BimOpenSchema.IO" Version="1.6.1" />
```

> 版本一致性：所有 Ara3D 包共享同一版本号（由仓库 `Directory.Build.props` 的 `Ara3DVersion` 统一设置），请让你引用的所有 Ara3D 包保持**同一版本**，避免混用不同版本导致的 API 不匹配。

关于 `Ara3D.IfcLoader`：它需要 `web-ifc-library.dll` 出现在输出目录。该原生库来自仓库 `vendor/`，其 `.csproj` 会自动复制到输出目录——通过 NuGet 引用时也会随包携带。

## 4. 从源码构建（做二次开发时）

如果你要修改 SDK 本身或调试源码，直接克隆仓库构建。仓库提供了一组 Windows 批处理脚本：

```bat
build.bat              :: 构建整个解决方案（Debug）
build.bat Release      :: Release 构建
test.bat               :: 运行完整测试套件（含 Slow）
test.bat fast          :: 运行全部区域，跳过 Slow 的文件 I/O 测试
test.bat geometry      :: 只跑某个区域（all|sdk|geometry|bim|devtools|knownissues）
pack.bat               :: 从 build/packages.txt 打包所有 NuGet（Release）
```

底层其实就是 `dotnet build` / `dotnet test` / `dotnet msbuild build/PackAll.proj`。打出的 `.nupkg` 会写入被 gitignore 的 `artifacts/` 目录。第 10 章会详细讲解这套构建/测试/发布工作流。

在自己的项目里引用**本地构建**的包时，可把本地 `artifacts/` 目录加为 NuGet 源：

```bash
dotnet nuget add source /path/to/ara3d-sdk/artifacts --name ara3d-local
dotnet add package Ara3D.SDK --version 1.6.1 --source ara3d-local
```

## 5. 第一个程序：Hello Ara3D

参考官方 `examples/Workshop` 里的入门课程，我们先做一个“列出 Ara3D.Geometry 中所有公开类型”的小程序，用来验证环境是否正确：

```csharp
using System;
using System.Linq;

Console.WriteLine("Hello from a project referencing Ara3D.SDK");

// 取 Ara3D.Geometry 程序集（Vector3 定义在 Ara3D.Geometry 命名空间）
var asm = typeof(Ara3D.Geometry.Vector3).Assembly;
var types = asm.GetTypes()
    .Where(t => t.IsPublic)
    .OrderBy(t => t.Name)
    .ToList();

Console.WriteLine($"Found {types.Count} types in the Ara3D.Geometry library");
foreach (var t in types)
    Console.WriteLine($"Type: {t.Name}");
```

运行：

```bash
dotnet run
```

如果能打印出一长串类型名（`Vector3`、`Matrix4x4`、`TriangleMesh3D`……），说明 SDK 已正确引用。

## 6. 第二个程序：生成并导出一个网格

再进一步，做点“真三维”的事：生成一个立方体网格并导出为 PLY 文件。（注意：`Ara3D.IO.PLY` 是 Windows 目标框架，本例请在 Windows 上、`net8.0-windows` 项目中运行。）

```csharp
using Ara3D.Geometry;   // 几何类型
using Ara3D.IO.PLY;     // PLY 导入/导出

// PlatonicSolids 提供常见基本体，这里取一个已三角化的立方体
TriangleMesh3D cube = PlatonicSolids.TriangulatedCube;

// 所有变换都是不可变的：返回新网格
var transformed = cube
    .Scale(new Vector3(2, 1, 1))                // 非均匀缩放
    .Rotate(Quaternion.CreateFromAxisAngle(Vector3.UnitY, Angle.Degrees(30)))
    .Translate(new Vector3(0, 0, 5));

Console.WriteLine($"顶点数: {transformed.Points.Count}, 面数: {transformed.Triangles.Count}");
Console.WriteLine($"包围盒: {transformed.Bounds.Min} .. {transformed.Bounds.Max}");

// 导出为 ASCII PLY
transformed.WritePly("cube.ply");
Console.WriteLine("已写出 cube.ply");
```

要点预览（后续章节展开）：

- `PlatonicSolids.TriangulatedCube` 直接给你一个立方体；几何库还提供 `Primitives.Cylinder(...)`、`Revolve`、`Extrude`、`Sweep` 等程序化操作；
- `Scale/Rotate/Translate` 返回**新对象**（不可变管线，便于链式与并行）；
- `WritePly` 是 `TriangleMesh3D` 上的扩展方法，来自 `Ara3D.IO.PLY`。

## 7. 全局 using 提升体验

Studio 示例项目用一个 `GlobalUsings.cs` 一次性导入常用命名空间，你也可以照做，减少每个文件的 `using`：

```csharp
// GlobalUsings.cs
global using Ara3D.Collections;
global using Ara3D.DataTable;
global using Ara3D.Geometry;
global using Ara3D.Logging;
global using Ara3D.Memory;
global using Ara3D.Models;
global using Ara3D.PropKit;
global using Ara3D.Studio.API;
global using Ara3D.Utils;
```

## 8. 常见问题排查

- **`AllowUnsafeBlocks` 报错**：`F8`、`Memory`、`StepParser` 等使用 `unsafe` 指针，务必在 `.csproj` 打开 `<AllowUnsafeBlocks>true</AllowUnsafeBlocks>`；
- **找不到 `web-ifc-library.dll`**：使用 `Ara3D.IfcLoader` 时确保原生 DLL 已复制到输出目录，且平台为 **x64 Windows**（不要设成 AnyCPU 下的 32 位）；
- **`net8.0` 引用了 Windows 专属包**：会在还原/编译时报 TFM 不兼容，把 `TargetFramework` 改为 `net8.0-windows`；
- **版本冲突**：确保所有 Ara3D 包版本一致；
- **Linux/macOS 想用 IFC/PLY**：这些是 Windows 目标框架，无法在非 Windows 直接运行，可考虑仅用 `Ara3D.SDK.Geometry` 的跨平台能力。

## 9. 本章小结

本章我们：

- 明确了 .NET 8 环境要求与 `net8.0` / `net8.0-windows` 两种 TFM 的分工；
- 学会了通过 NuGet 引用元包或单个库，并注意版本一致性与 `AllowUnsafeBlocks`；
- 了解了从源码构建的批处理脚本与本地包源用法；
- 跑通了“Hello Ara3D”和“生成并导出网格”两个入门程序；
- 掌握了 `GlobalUsings` 与常见问题排查。

下一章开始，我们进入 SDK 的基石——`Ara3D.SDK.Core` 核心基础库，理解它为何能高效处理海量数据。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第01章-Ara3D-SDK全景概览与学习路线" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第03章-核心基础库Core详解" style="text-decoration: none;">下一章 →</a>
</div>
