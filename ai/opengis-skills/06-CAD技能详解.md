---
layout: default
title: 第六章：CAD 技能详解
---

# 第六章：CAD 技能详解

CAD（计算机辅助设计）是 OpenGIS-Skills 中第二大技能分类，共收录 **19 个技能**。与 GIS 领域侧重空间数据处理不同，CAD 类技能覆盖了从底层几何内核到上层的建筑设计应用、从 2D 制图到 BIM 信息模型、从多平台桌面应用到 Web 端轻量方案的完整链条。无论你是在开发一个几何算法库，还是在做 AutoCAD 插件二次开发，或是构建一套在线 3D 查看器，本章都能帮你快速定位到最匹配的技能。

本章按工具的技术层次和应用场景，将 19 个技能划分为七个子领域：几何内核与算法、参数化 3D CAD、2D 制图、PCB/EDA、BIM 与 IFC、.NET AutoCAD 二次开发、数据交换与可视化。每个技能都会给出核心定位、适用场景和关键 API 或代码示例，让你在面对具体任务时能够快速决策"我应该加载哪个技能"。

---

## 6.1 CAD 技能全景

下表给出了全部 19 个 CAD 技能的快速索引。你可以按"分类"列快速定位到感兴趣的子领域，也可以按"等级"列判断技能的技术深度——"内核"级最深，"框架/应用"级居中，"插件"级最贴业务。

| 分类 | 技能 | 等级 | 平台/语言 | 说明 |
|:-----|:-----|:----|:----------|:-----|
| 几何内核 | `occt` | 内核 | C++/Python | Open CASCADE Technology，工业级三维几何内核 |
| 几何算法 | `clipper2` | 算法 | C++/C#/Python/Delphi | 高性能 2D 多边形布尔运算与偏移库 |
| 几何算法 | `clipper1` | 算法 | 多语言 | Clipper 1.x 旧版，部分场景仍在使用 |
| 参数化 3D | `freecad` | 应用 | C++/Python | 开源参数化 3D CAD/BIM 平台，10+ 工作台 |
| 脚本 3D | `openscad` | DSL | 自研语言 | 声明式 CSG 脚本建模语言，适合程序化生成 |
| 脚本 3D | `cadquery` | API | Python | 基于 OCCT 的 Python 链式 API 参数化建模 |
| 约束 3D | `solvespace` | 应用 | C++/CMake | 轻量级约束求解器，35+ 约束类型 |
| Web3D | `chili3d` | 库 | TypeScript/WASM | 纯 Web 端 3D CAD（OCCT.js + Three.js） |
| 2D 制图 | `qcad` | 应用 | C++/JavaScript | 开源 2D CAD 编辑器，ECMAScript 扩展系统 |
| 2D 制图 | `librecad` | 应用 | C++/Qt | 开源 2D CAD，支持命令行批处理 |
| Web2D | `lightcad` | 框架 | C#/TypeScript | 轻量 Web 2D CAD 框架，基于 Fabric.js |
| PCB/EDA | `kicad` | 应用 | C++/Python | 开源 PCB 设计套件，原理图→布局→生产输出 |
| BIM/IFC | `xbim` | 库 | .NET (C#) | BIM/IFC 工具集，强类型 IFC 实体模型 |
| AutoCAD.NET | `ifoxcad` | 框架 | .NET (C#) | AutoCAD 二次开发框架，多 CAD 兼容 |
| AutoCAD.NET | `fy_layout` | 插件 | .NET (C#) | 基于 LightCAD 的施工场地布置插件 |
| AutoCAD.NET | `lightningcad` | 插件 | .NET (C#) | 建筑围护深化设计插件 |
| AutoCAD.NET | `tongwen` | 插件 | .NET (C#) | 工程图纸多语言无损翻译套件 |
| 数据交换 | `libredwg` | 库 | C/Python | DWG 文件读写库，R13～2021 格式支持 |
| 可视化 | `astral3d` | 框架 | JS/TS | 工业级 Web 3D 可视化平台，30+ 格式支持 |

---

## 6.2 几何内核与算法

这一节涵盖整个 CAD 技能栈的最底层——几何计算基础设施。`occt` 提供工业级的 3D 实体建模能力，`clipper2` 和 `clipper1` 负责 2D 矢量边界的布尔运算。如果你需要在自己的程序中嵌入几何计算能力而不是使用现成的 CAD 软件，这三个技能是你的首选。

### 6.2.1 occt——Open CASCADE Technology

**定位**：occt 是整个 opengis-skills CAD 分类中等级最高的技能（标记为"内核"）。Open CASCADE Technology（OCCT）是一个工业级 C++ 三维几何建模内核，同时也是 FreeCAD、CadQuery、Chili3D、Xbim 等众多上层 CAD/BIM 工具的底层引擎。掌握 occt 等同于掌握了 CAD 软件开发的"发动机"。

**核心概念**：

OCCT 围绕三个支柱构建：**建模数据**（几何+拓扑）、**建模算法**（布尔运算、圆角、扫掠等）和**数据交换**（STEP/IGES/STL 等格式）。

**(1) B-Rep 边界表示（Boundary Representation）**

OCCT 采用 B-Rep 作为核心几何表达方式。B-Rep 通过边界来定义实体：一个实体由外壳（Shell）包围，外壳由面（Face）组成，面由边界环（Wire）界定，边界环由边（Edge）构成，每条边有起点和终点两个顶点（Vertex）。

**(2) 拓扑形状（TopoDS_Shape 层次结构）**

OCCT 的拓扑类全部隶属于 `TopoDS` 包，继承关系如下：

```
TopoDS_Shape（基类，所有拓扑对象）
  ├── TopoDS_Vertex（顶点）
  ├── TopoDS_Edge（边）
  ├── TopoDS_Wire（线框/环）
  ├── TopoDS_Face（面）
  ├── TopoDS_Shell（壳）
  ├── TopoDS_Solid（实体）
  ├── TopoDS_CompSolid（复合实体）
  └── TopoDS_Compound（复合体）
```

常用的类型判断与转换宏：`BRep_Tool::Surface(face)` 获取曲面、`TopExp_Explorer` 遍历子形状、`BRepGProp` 计算体积/面积/质心。

**(3) 布尔运算（BRepAlgoAPI_Fuse/Common/Cut）**

OCCT 的布尔运算统一在 `BRepAlgoAPI` 包下：

- **Fuse（并集）**：`BRepAlgoAPI_Fuse(shape1, shape2)`，融合两个形体
- **Common（交集）**：`BRepAlgoAPI_Common(shape1, shape2)`，取两者的公共部分
- **Cut（差集）**：`BRepAlgoAPI_Cut(shape1, shape2)`，从 shape1 中挖掉与 shape2 重叠的部分
- **Section（截面）**：`BRepAlgoAPI_Section(shape1, shape2)`，计算两形体相交的线

所有布尔运算类均继承自 `BRepBuilderAPI_MakeShape`，调用 `Shape()` 方法获取结果。

**(4) STEP/IGES I/O**

OCCT 提供了两种主要的 CAD 中性格式读写能力：

- **STEP 读写**：`STEPControl_Reader` / `STEPControl_Writer`。STEP（ISO 10303，通常为 `.stp`/`.step` 文件）是工业界最通用的几何数据交换标准，支持实体、曲面、装配关系等完整信息。
- **IGES 读写**：`IGESControl_Reader` / `IGESControl_Writer`。IGES（`.igs`/`.iges`）是较早的标准，主要面向曲面和线框，不保留实体特征历史。

**(5) 网格生成（BRepMesh_IncrementalMesh）**

`BRepMesh_IncrementalMesh` 将 B-Rep 几何离散化为三角网格，是数据导出为 STL、可视化、FEM 分析等场景的必要步骤。通过设置线性偏差（Deflection）和角度偏差（Angle）参数控制离散精度。

**(6) 可视化（AIS_Shape 交互式对象）**

OCCT 自带的 3D 可视化框架由 `AIS`（Application Interactive Services）、`V3d_Viewer`、`Graphic3d` 等模块组成。`AIS_Shape` 是连接几何与显示的桥梁——创建一个 `AIS_Shape` 对象并将 `TopoDS_Shape` 关联到它，就可以把几何体绘制到 3D 视图中，并支持高亮、选择、拖拽等交互。

**典型应用场景**：

- 开发自有几何建模软件的内核
- 在 CAD 数据格式转换服务中嵌入 OCCT 作为几何引擎（STEP→STL、STEP→glTF 等）
- 使用 pythonOCC（OCCT 的 Python 绑定）做自动化几何处理脚本
- FreeCAD 的 Part 模块、CadQuery 的建模操作均直接调用 OCCT

**示例代码——创建并导出立方体**：

```cpp
#include <BRepPrimAPI_MakeBox.hxx>
#include <STEPControl_Writer.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <StlAPI_Writer.hxx>

// 创建一个 10x10x10 的立方体
TopoDS_Shape box = BRepPrimAPI_MakeBox(10.0, 10.0, 10.0).Shape();

// 导出为 STEP
STEPControl_Writer stepWriter;
stepWriter.Transfer(box, STEPControl_AsIs);
stepWriter.Write("box.stp");

// 导出为 STL
BRepMesh_IncrementalMesh(box, 0.1);
StlAPI_Writer stlWriter;
stlWriter.Write(box, "box.stl");
```

---

### 6.2.2 clipper2——高性能 2D 多边形布尔运算

**定位**：Clipper2 是由 Angus Johnson 开发的 2D 多边形布尔运算库——Clipper 的完全重写版本，原生支持 C++、C#、Python 和 Delphi。它专注于 2D 平面上的精确几何运算，是 CAD/CAM 刀路计算、GIS 矢量叠加分析、激光切割排样等场景的核心算法库。

**核心特性**：

**(1) 64 位整数坐标精度**

Clipper2 内部所有几何计算均使用 **64 位整数（`int64_t` / `long`）**，而非浮点数。这从根本上消除了浮点运算中常见的舍入误差和拓扑不一致问题。但代价是：用户需要将实际坐标值通过缩放因子（如 1 单位 = 1000 内部单位）转换为整数。Clipper2 提供了 `PathsD` 类型自动处理浮点数到整数的转换。

**(2) 布尔运算**

四个标准布尔运算均通过 `Clipper` 类的方法完成：

- **Intersection（交集）**：`Clipper64.Intersect(pathsA, pathsB, fillRule)`
- **Union（并集）**：`Clipper64.Union(paths, fillRule)`
- **Difference（差集）**：`Clipper64.Difference(pathsA, pathsB, fillRule)`
- **XOR（异或）**：`Clipper64.Xor(pathsA, pathsB, fillRule)`

`FillRule`（填充规则）支持 `EvenOdd`（奇偶填充）和 `NonZero`（非零环绕）两种，决定自交多边形内部的"洞"如何判定。

**(3) 多边形偏移（ClipperOffset）**

`ClipperOffset` 类实现多边形的内外膨胀/收缩（Offset / Inflate），核心参数：

- **偏移距离（delta）**：正值向外膨胀，负值向内收缩
- **连接类型（JoinType）**：`Square`（方角）、`Round`（圆角，可设精度）、`Miter`（斜角，可设限值）
- **端点类型（EndType）**：`Polygon`（闭合）、`Joined`（直线末端）、`Butt`/`Square`/`Round`（开放路径端点样式）

**(4) Minkowski 运算**

- `Minkowski.Sum(pattern, path, isClosed)`：闵可夫斯基和
- `Minkowski.Diff(pattern, path, isClosed)`：闵可夫斯基差

这些运算在机器人路径规划（计算 C-space 障碍物）、碰撞检测、形态学膨胀/腐蚀等场景下非常关键。

**代码示例——C# 计算两个多边形的交集**：

```csharp
using Clipper2Lib;

// 定义多边形 A（三角形）
Path64 polyA = Clipper.MakePath(new long[] { 0, 0, 100, 0, 50, 100 });

// 定义多边形 B（矩形）
Path64 polyB = Clipper.MakePath(new long[] { 25, 25, 75, 25, 75, 125, 25, 125 });

// 计算交集
Paths64 solution = Clipper.Intersect(
    new Paths64 { polyA },
    new Paths64 { polyB },
    FillRule.NonZero
);

// solution 中即为两个多边形的重叠区域
```

**何时使用 Clipper2 vs OCCT**：

| 对比维度 | Clipper2 | OCCT |
|:---------|:---------|:-----|
| 维度 | 2D | 2D + 3D |
| 坐标精度 | 64位整数（精确） | 双精度浮点 |
| 几何类型 | 多边形/路径 | B-Rep 实体/曲面/线框 |
| 性能 | 极高（专为 2D 优化） | 中等（3D 通用） |
| 语言绑定 | C++/C#/Python/Delphi | C++（pythonOCC 非官方） |
| 典型场景 | GIS 面叠加、CAM 刀路、排样 | CAD 建模、BIM 几何分析 |

---

### 6.2.3 clipper1——旧版 Clipper

**定位**：clipper1 是 Clipper 库的 1.x 版本。虽然 Clipper2 在性能和 API 设计上全面优于 Clipper1，但部分存量项目仍依赖 Clipper1 的特定 API 行为，OpenGIS-Skills 因此保留了 clipper1 作为独立技能。

**核心差异**：

| 对比维度 | Clipper 1.x | Clipper 2.x |
|:---------|:------------|:------------|
| 命名空间 | `ClipperLib` | `Clipper2Lib` |
| 布尔运算类 | `Clipper` | `Clipper64` / `ClipperD` |
| 路径类型 | `List<IntPoint>` | `Path64` / `PathD` |
| 多路径类型 | `List<List<IntPoint>>` | `Paths64` / `PathsD` |
| 偏移类 | `ClipperOffset` | `ClipperOffset`（同名称，不同 API） |
| 填充规则 | `PolyFillType` 枚举 | `FillRule` 枚举 |
| 缩放转换 | 手动 `* scalingFactor` | `ClipperD` 自动处理 |
| Minkowski | 无内置 | `Minkowski.Sum/Diff` |

**迁移指南**：从 Clipper1 迁移到 Clipper2 的关键步骤：

1. 将所有 `List<IntPoint>` 替换为 `Path64`，`List<List<IntPoint>>` 替换为 `Paths64`
2. 将 `Clipper.Execute(ClipType, PolyFillType)` 替换为 `Clipper64.Intersect/Union/Difference/Xor(paths, fillRule)`
3. 浮点输入改用 `PathD`/`PathsD`，库自动完成缩放转换
4. 偏移操作的方法签名从 `ClipperOffset.AddPath(path, joinType, endType)` 改为 `ClipperOffset.AddPath(path, joinType, endType)，但返回值从 `List<List<IntPoint>>` 统一为 `Paths64`

**何时仍使用 clipper1**：只有在维护老项目、团队尚未完成迁移、或依赖的第三方库仍绑定 clipper1 API 时才需要。新项目应直接选用 clipper2。

---

## 6.3 参数化 3D CAD

本节涵盖 5 个面向 3D 参数化建模的技能。它们代表了几种截然不同的建模哲学：FreeCAD 是经典的特征式参数化建模（点→草图→特征→装配），OpenSCAD 是声明式 CSG 脚本建模，CadQuery 是链式 API 编程建模，SolveSpace 是约束驱动建模，Chili3D 则是纯 Web 端的在线 CAD。

### 6.3.1 freecad——开源参数化 3D CAD/BIM

**定位**：FreeCAD 是一个开源、跨平台、以参数化建模为核心的三维 CAD/CAE/CAM 平台。它基于 OpenCASCADE 7.8.1 几何内核，使用 Coin3D 做 3D 渲染，Qt 6.x 做 GUI，内置 Python 3.11 解释器。截至本教程编写时的最新稳定版本为 1.1.3（2026 年 7 月）。FreeCAD 的技能文件是 CAD 分类中内容最深厚的之一，覆盖了从用户操作到 Python 脚本、从工作台开发到底层 OCCT 调用的全部层次。

**核心概念——工作台系统（Workbench）**：

FreeCAD 的界面组织方式不同于商业 CAD 的单一"模式"切换，而是采用开放式的**工作台（Workbench）**系统。用户在不同工作台之间切换，获得该领域的一组专用工具。所有工作台共享同一个文档对象模型，切换工作台不会丢失数据。以下是核心工作台及其功能定位：

| 工作台 | 核心功能 | 典型操作 |
|:-------|:---------|:---------|
| **Sketcher** | 2D 草图约束绘制 | 画线/弧/圆，施加距离/角度/平行/垂直/相切约束 |
| **Part** | CSG 建模（基本体+布尔运算） | 创建立方体/球/圆柱/圆锥，Fuse/Cut/Common，从脚本构建底级形状 |
| **PartDesign** | 基于特征的参数化建模 | Sketch→Pad（拉伸）/Pocket（挖槽）/Revolution（旋转）→Fillet（圆角）/Chamfer（倒角） |
| **Assembly** | 装配体（1.1.0 内置） | Joint 约束系统（Fixed/Revolute/Slider/Cylindrical 等），在同一文档中组织零件装配 |
| **Arch/BIM** | 建筑信息模型 | 墙/楼板/柱/窗/门/屋顶构建，IFC 导入导出 |
| **CAM** | 数控加工路径 | 创建 Job（作业）→定义刀具→生成铣削/钻孔路径→后处理输出 G-code |
| **FEM** | 有限元分析 | 定义材料（Material）→网格划分（FEM Mesh）→施加约束和载荷→运行 CalculiX 求解器→查看结果 |
| **TechDraw** | 工程图纸生成 | 从 3D 模型投影生成 2D 视图、剖面、尺寸标注、公差标注 |
| **Draft** | 二维辅助绘图 | 直线/弧线/矩形/多边形绘制，捕捉系统，阵列复制 |
| **Spreadsheet** | 参数表 | 存储设计参数（如长度、厚度），其他对象通过表达式引用 |

**Python 脚本 API**：

FreeCAD 从设计之初就将 Python 可编程性作为一等特性。所有 GUI 命令对应的 Python 代码均可在控制台中查看和执行。以下是一个完整的 Python 脚本示例——用 PartDesign 工作台创建一个带孔的法兰：

```python
import FreeCAD as App
import PartDesign as PD
import Sketcher

# 创建新文档
doc = App.newDocument("Flange")

# 步骤1：创建一个圆柱底座（Pad）
body = doc.addObject("PartDesign::Body", "Body")
# 在 XZ 平面上创建草图
sketch = doc.addObject("Sketcher::SketchObject", "Sketch")
body.addObject(sketch)
sketch.Support = (doc.getObject("XZ_Plane"), [""])
sketch.MapMode = "FlatFace"
# 画一个圆并施加半径约束
sketch.addGeometry(Part.Circle(App.Vector(0, 0, 0), App.Vector(0, 0, 1), 50))
sketch.addConstraint(Sketcher.Constraint("Radius", 0, 50))

# 将草图拉伸 20mm 高度
pad = doc.addObject("PartDesign::Pad", "Pad")
body.addObject(pad)
pad.Profile = sketch
pad.Length = 20

# 步骤2：打孔——在底座上表面创建草图，画小圆，做 Pocket
# ...（类似流程）

doc.recompute()
```

**无头模式（Headless）**：FreeCAD 支持在无 GUI 环境下作为 Python 模块导入和运行，这对服务器端批量处理和 CI 流水线非常有用：

```python
import FreeCAD as App
App.Console.PrintMessage("Running in headless mode\n")
# 执行建模或格式转换逻辑
```

**文件格式**：
- **FCStd**：FreeCAD 原生格式（ZIP 包 + XML 文档结构 + BREP 几何数据）
- **导入**：STEP、IGES、STL、OBJ、DXF、SVG
- **导出**：STEP、IGES、STL、OBJ、DXF、SVG、IFC、glTF、PDF（通过 TechDraw）

---

### 6.3.2 openscad——声明式 CSG 脚本建模

**定位**：OpenSCAD 是一款独特的 3D CAD 建模工具——它不是交互式的，而是**基于脚本声明式地描述几何体**。用户用 OpenSCAD 自有的函数式语言编写建模脚本，OpenSCAD 解释执行这个脚本，通过 CSG（Constructive Solid Geometry）构建实体并渲染预览。

**核心理念**：与 FreeCAD 的"点→草图→特征"不同，OpenSCAD 的哲学是"**描述你想要什么，而不是如何构建它**"。这使 OpenSCAD 天然适合程序员思维、精确的参数化设计和程序化生成（如齿轮、螺丝、散热器格栅等有数学规律的零件）。

**核心语法**：

```
// 基本体
cube([10, 20, 5]);                // 长方体 [x, y, z]
sphere(r=10, $fn=100);             // 球体（$fn 控制面数精度）
cylinder(h=20, r1=5, r2=10);      // 圆柱（可渐缩）
polyhedron(points, faces);         // 自定义多面体

// 变换
translate([x, y, z]) { ... }      // 平移
rotate([ax, ay, az]) { ... }      // 旋转
scale([sx, sy, sz]) { ... }       // 缩放
mirror([nx, ny, nz]) { ... }      // 镜像
resize([nx, ny, nz]) { ... }      // 缩放到目标尺寸
color("red") { ... }              // 着色（仅预览）

// 布尔运算
union() { A; B; }                  // 并集
difference() { A; B; C; }         // 差集（A - B - C）
intersection() { A; B; }          // 交集

// 模块化
module myPart(size) {
    cube(size);
}
myPart([10, 20, 5]);
```

```openscad
// 控制结构
for (i = [0:5]) { ... }           // 循环
if (condition) { ... }            // 条件
children([index]);                 // 子节点引用

// 函数
function f(x) = x * 2 + 1;
echo(f(5));                        // 输出调试
```

**标准库与扩展生态**：

- **MCAD**：机械零件库（螺丝、螺母、轴承、齿轮等标准件）
- **BOSL**（Belfry OpenSCAD Library）：功能极丰富的通用建模库，提供了更高级的变换、形状、掩模、螺纹等
- **wing-tip**：机翼剖面生成模块

**命令行导出**：

```bash
# 直接导出 STL
openscad -o output.stl input.scad

# 导出 PNG 预览图
openscad -o preview.png --imgsize=800,600 input.scad

# 导出 DXF（纯 2D 投影）
openscad -o output.dxf input.scad
```

**与 FreeCAD/CadQuery 的选择**：OpenSCAD 适合纯程序员的参数化几何（脚本体积小、逻辑清晰、可被版本控制完美管理），但不适合需要曲面操作（NURBS）、STEP 互操作、约束求解和交互式编辑的场景——那些情况应选 FreeCAD 或 CadQuery。

---

### 6.3.3 cadquery——Python 链式 API 参数化 3D 建模

**定位**：CadQuery 是一个基于 OCCT（通过 OCP 绑定）的 Python 参数化 3D CAD 建模库，核心理念是"**用链式 API 写出可读性极高的建模代码**"。如果你觉得 OpenSCAD 的语法过于局限、FreeCAD 的 Python API 过于冗长，CadQuery 提供的"流畅接口（Fluent API）"很可能就是你想要的。

**核心工作流**：

CadQuery 的建模流程围绕 **`Workplane`（工作平面）** 概念展开：

1. 创建一个 `Workplane` 对象（默认在 XY 平面上）
2. 在其上绘制 2D 轮廓（矩形、圆、多边形或组合形状）
3. 将 2D 轮廓沿 Z 轴拉伸（`extrude`）或旋转（`revolve`），得到 3D 实体
4. 选择实体的特定面，在该面上创建新的 `Workplane`
5. 在新工作平面上继续操作（打孔、拉伸凸台、圆角等）

这种"**在面上创建工作面→2D→3D→选面→继续**"的模式极其直观，非常接近机械设计工程师的思维过程。

**链式 API 示例**：

```python
import cadquery as cq

# 一个带孔的支架：底座 + 立板 + 加强筋 + 圆角 + 安装孔
result = (
    cq.Workplane("XY")
    # 底座：矩形拉伸
    .rect(60, 40).extrude(10)
    # 选底座上表面，创建立板
    .faces(">Z").workplane()
    .rect(10, 30).extrude(40)
    # 选底座上表面和立板侧面，创建加强筋
    .faces(">Z").workplane()
    .transformed(offset=cq.Vector(0, 15, 0))
    .rect(8, 8).extrude(35)
    # 给底座四角打安装孔
    .faces(">Z[0]").workplane()
    .rect(50, 30, forConstruction=True)
    .vertices().hole(3, 10)
    # 给立板顶部倒圆角
    .faces(">Z").edges("|Y").fillet(2)
)
```

**核心机制详解**：

**(1) 选择器系统（Selectors）**

这是 CadQuery 最强大的特性之一。选择器用简洁的字符串语法精确过滤面、边或顶点：

| 选择器 | 含义 |
|:-------|:-----|
| `faces(">Z")` | 法线朝 +Z 方向的面 |
| `faces(">Z[0]")` | 法线朝 +Z 的面中 Z 坐标最大的那个 |
| `faces("<Z")` | 法线朝 -Z 的面 |
| `faces("%Plane")` | 平行于指定平面的面 |
| `edges("|Y")` | 平行于 Y 轴的边 |
| `edges(">X")` | 中点 X 坐标大于原点的边 |
| `vertices()` | 选特定位置的点（常与 `forConstruction` 配合） |
| `faces().edges()` | 先选面再取边，逐步细化 |

**(2) CQGI (CadQuery Gateway Interface)**

CQGI 是 CadQuery 的命令行交互界面，支持在 VS Code / Jupyter 中实时预览模型。配合 `cq-editor`（图形化前端），可以实现"写代码→即时看 3D 结果"的开发体验。

**(3) 布尔运算和倒角**

`cq.Workplane` 对象可直接进行布尔运算和特征操作：

```python
a = cq.Workplane("XY").box(10, 10, 10)
b = cq.Workplane("XY").sphere(6)
union_result = a.union(b)            # 并集
cut_result = a.cut(b)                 # 差集
common_result = a.intersect(b)        # 交集

# 倒角和圆角
part = cq.Workplane("XY").box(20, 20, 10)
part = part.faces(">Z").chamfer(2)   # 上表面边倒角 2mm
part = part.edges().fillet(1)         # 所有边倒圆角 1mm
```

**导出格式**：STEP（推荐，保留 B-Rep 精确几何）、STL（3D 打印）、GLTF（Web 可视化）。

**CadQuery vs FreeCAD vs OpenSCAD 对比**：

| 维度 | CadQuery | FreeCAD | OpenSCAD |
|:-----|:---------|:--------|:---------|
| 编程语言 | Python 标准库 | Python 脚本 API | 自研 DSL |
| 几何内核 | OCCT（OCP 绑定） | OCCT 7.8.1 | CGAL |
| STEP 支持 | 原生读写 | 原生读写 | 不支持 |
| NURBS 曲面 | 支持 | 支持 | 不支持 |
| GUI | cq-editor（轻量） | 完整的工作台系统 | 脚本编辑器+预览 |
| 学习曲线 | 中等（需 Python + 选择器语法） | 中高（需理解 FreeCAD 对象模型） | 低（语法简单但有局限） |

---

### 6.3.4 solvespace——轻量级约束求解 3D CAD

**定位**：SolveSpace 是一款免费开源的参数化 2D/3D CAD，最独特之处在于它是一个**可独立使用的约束求解器库**。软件体积仅约 10MB，却支持 35+ 种几何约束类型，非常适合快速原型设计、机械零件草图和将约束求解功能嵌入其他应用。

**核心特性**：

**(1) 约束系统**

SolveSpace 的约束类型覆盖了机械设计中最常见的关系：

- **距离约束**：点-点距离、点-线距离、线-线距离
- **角度约束**：线-线角度
- **位置约束**：点-点重合、点在线/圆/弧上、中点
- **几何约束**：平行、垂直、相切、对称、共线、等长/等半径
- **逻辑约束**：水平、竖直

所有约束实时求解，意味着拖动几何元素时整个系统保持约束一致性——这是 SolveSpace 作为约束求解器的核心价值。

**(2) 建模流程**

SolveSpace 的建模逻辑清晰且轻量：

1. 在 2D 草图中绘制几何（线、圆、弧、样条、贝塞尔曲线）
2. 施加尺寸和几何约束
3. 通过**拉伸**（Extrude）或**旋转**（Revolve）将草图转为 3D 实体
4. 可选的布尔运算（并集、差集、交集）
5. 装配体支持（3.0+）

**(3) 支持格式**：导入/导出 STEP、STL、DXF、SVG、PDF、OBJ。其中 STEP 导出保留了 B-Rep 精确几何。

**(4) 命令行接口**

SolveSpace 提供了完整的命令行模式，适合自动化处理和 CI/CD 集成：

```bash
# 从 solvespace 文件导出为 STL
solvespace-cli model.slvs -o output.stl

# 导出为 DXF（工程图视图）
solvespace-cli model.slvs -o output.dxf --view front --scale 1:1
```

**最适合的场景**：

- 快速做机械零件草图验证
- 需要精确约束求解（如连杆机构运动分析）
- 将约束求解器嵌入自有软件（SolveSpace 的 C 语言 API 库清晰可集成）
- 教学和入门——安装包小、学习曲线低、无需复杂配置

---

### 6.3.5 chili3d——纯 Web 3D CAD

**定位**：Chili3D 是一款基于 Web 浏览器的开源 3D CAD 应用。它通过将 OpenCASCADE 编译为 WebAssembly（OCCT.js + WASM），与 Three.js 渲染引擎集成，在浏览器内实现了接近桌面级 CAD 的建模和查看能力。

**技术架构**：

- **TypeScript 全栈**：整个项目用 TypeScript 编写，前后端统一语言
- **OCCT.js（WASM）**：OpenCASCADE 7.x 通过 Emscripten 编译为 WebAssembly，在浏览器中执行 B-Rep 几何运算
- **Three.js**：WebGL 渲染层，负责 3D 场景的绘制和交互
- **Rspack**：构建工具，替代 Webpack 获得更快的编译速度

**核心能力**：

- **建模**：基本体（长方体/圆柱/球/圆锥）、2D 草图绘制、布尔运算（并集/差集/交集）、拉伸/旋转/扫掠/放样、倒角/圆角
- **捕捉**：对象捕捉（点/边/面）、工作平面捕捉、轴追踪、特征点自动检测
- **编辑**：移动/旋转/镜像/删除、子形状操作、爆炸复合体
- **测量**：角度、长度、面积、体积计算
- **文档管理**：创建/打开/保存、撤销/重做、事务历史
- **格式支持**：导入导出 STEP、IGES、BREP（0.6.1+ 新增）

**与桌面 CAD 的差异**：

| 维度 | Chili3D | FreeCAD / SolidWorks |
|:-----|:--------|:---------------------|
| 部署 | 零安装，浏览器打开即用 | 需下载安装 ~500MB |
| 性能 | WASM 近原生（约 70-80% 桌面性能） | 原生编译，全速 |
| 文件存储 | IndexedDB（浏览器本地） | 本地文件系统 |
| 参数化 | 不支持参数化约束 | 完整参数化 |
| 扩展性 | 前端生态（TypeScript） | Python/C++ 插件 |

**Node.js 服务端渲染**：Chili3D 的 OCCT.js 后端可以在 Node.js 中运行，利用 Linux 服务器为 Web 前端提供几何计算服务——例如：浏览器端提交 STEP 文件，服务端完成布尔运算、网格化、格式转换等重计算后返回结果。

**典型场景**：在线 CAD 查看器、轻量编辑、团队协同预览、嵌入网页的产品配置器。

---

## 6.4 2D CAD 与制图

虽然 3D 建模工具越来越强大，但 2D 制图仍然是工程施工、图纸交付、机械出图等领域不可替代的基本功。OpenGIS-Skills 包含三个 2D CAD 技能——两个桌面应用（QCAD 和 LibreCAD）和一个 Web 框架（LightCAD），分别对应不同的使用场景。

### 6.4.1 qcad——开源专业 2D CAD 编辑器

**定位**：QCAD 是 RibbonSoft 公司维护的开源 2D CAD 编辑系统，基于 Qt 框架用 C++ 编写。其最突出的能力是**专业的 DXF/DWG 读写支持**——读取 DWG R9～R2018、DXF R12～R32，写入 DXF R12～R32 和 DWG R15～R2018。

**核心功能模块**：

**(1) ECMAScript (JavaScript) 扩展系统**

QCAD 最独特的设计是其内置了 **Qt Script**（基于 ECMAScript / JavaScript）作为脚本语言。所有菜单命令本质上都是 ECMAScript 脚本，位于 `scripts/` 目录下，用户可以直接查看和修改。这意味着：

- 开发自定义工具就是写一个 JavaScript 文件
- 可以一键录制用户操作并导出为脚本
- 无编译环节，修改脚本后重启 QCAD 即生效
- 支持完整的 JavaScript 语言特性（类、函数、正则、JSON 等）

**(2) 图层管理**

QCAD 提供标准的 CAD 图层体系：创建/删除图层、设置颜色/线型/线宽、锁定/冻结/隐藏、通过图层状态管理器批量控制。图层与块（Block）配合，可以实现符号库的标准化管理。

**(3) 图块定义和插入**

块（Block）是 CAD 中可复用的符号单元。QCAD 支持创建块定义（包含若干图元）、将块定义插入到图纸的任意位置/角度/缩放、嵌套块、属性块（带可编辑文字标签的块）。块的底层存储使用 `RBlockReferenceEntity` 关联到 `RBlock` 定义。

**(4) 标注系统**

QCAD 提供全套工程标注类型：线性标注（水平和垂直距离）、对齐标注（两点间实际距离）、角度标注、半径/直径标注、坐标标注、引线标注。标注样式（箭头类型、文字高度、单位格式）通过标注样式管理器统一控制。

**(5) QCAD/CAM**

QCAD 的专业版包含 QCAD/CAM 模块，可以在 2D 图形基础上生成数控加工路径（轮廓铣削、钻孔、铣内腔），并输出 G-Code。这是 QCAD 从"绘图工具"扩展到"制造准备工具"的关键桥梁。

**(6) 打印和布局**

支持纸空间（Paper Space）和模型空间（Model Space）分离、多视口布局、自定义打印比例、打印预览和批量打印。

---

### 6.4.2 librecad——开源 2D CAD（Qt 社区版）

**定位**：LibreCAD 是 QCAD 社区版的延续，采用 C++ 和 Qt 编写，同样是开源 2D CAD 工具。LibreCAD 与 QCAD 的核心差异在于：

| 维度 | QCAD | LibreCAD |
|:-----|:-----|:---------|
| 许可证 | 社区版 GPL / 专业版商业 | GPL v2 |
| ECMAScript 脚本 | 支持 | 不支持（使用 C++ 插件框架 v2+） |
| DWG 读写 | 支持（专业版 + ODA 库） | 仅读取（实验性） |
| CAM | 专业版内置 | 不支持 |
| 插件系统 | JavaScript 脚本 | C++ 动态库 |
| 目标用户 | 专业制图 + 自动化 | 通用 2D CAD + 教育 |

**命令行批处理模式**：LibreCAD 提供了 `-x` 选项以无 GUI 模式运行，支持命令行格式转换和批量处理：

```bash
# DXF 转 SVG
librecad -x "dxf2svg" -i input.dxf -o output.svg

# 批量打印
librecad -x "print" -i drawing.dxf -p printer_name
```

**API 扩展**：LibreCAD 2.2+ 引入了 C++ 插件框架，允许开发者编译 `.so`/`.dll` 动态库来扩展 LibreCAD 的功能。插件可以注册新命令、添加工具栏、操作文档中的实体。

**与 QCAD 的选择**：

- 如果你需要 ECMAScript 脚本自动化、DWG 写入、CAM 路径生成：选择 QCAD
- 如果你只需要纯 2D 制图、DFX 编辑、轻量使用，且在意完全免费：选择 LibreCAD

---

### 6.4.3 lightcad——轻量 Web 2D CAD 框架

**定位**：LightCAD 是由启道软件（Qidao Soft）开发的专业级开源 CAD 平台，基于 .NET 10 和 C#，是整个 opengis-skills CAD 生态中规模最大的单体项目之一。但这里讨论的是 LightCAD 作为技能文件在 CAD 2D 制图方面的内容——其 Web 端的 2D 渲染能力、Fabric.js 集成和为二次开发提供的 TypeScript 接口。

**核心架构**：

LightCAD 采用严格的分层设计：

```
用户界面层    →  LightCAD.WinForm / LightCAD.Model
应用运行时层  →  LightCAD.Runtime
绘图交互层    →  LightCAD.Drawing
渲染工具层    →  LightCAD.RenderUtils (Three.js4Net + OpenTK)
核心数据层    →  LightCAD.Core
数学基础层    →  LightCAD.MathLib
```

**2D 绘图能力**：

- **基本图元**：直线、圆弧、椭圆、多段线、样条曲线、填充区域、文本、多行文本
- **标注系统**：线性标注、对齐标注、角度标注、半径/直径标注
- **图层管理**：颜色、线型、线宽、可见性控制
- **选择系统**：点选、框选、按图元类型/颜色/图层过滤
- **捕捉系统**：端点、中点、圆心、交点、切点、垂足

**Web 端二次开发**：

LightCAD 的 Web 渲染层基于 Three.js4Net（将 Three.js 能力桥接到 .NET），同时提供了面向 Web 前端的 TypeScript/JavaScript 接口。开发者可以用 TypeScript 创建自定义实体、注册命令、构建 UI 面板，实现与桌面端完全一致的绘图功能——但运行在浏览器中。

**Web 嵌入示例**：将一个 LightCAD 绘图画布嵌入到 Web 页面中，提供基础的 2D 查看和标注能力——这是在 BIM 协同、图纸审批、现场验收等场景下的典型用法。

---

## 6.5 PCB/EDA——KiCad

**定位**：KiCad 是目前最成熟的开源电子设计自动化（EDA）工具套件。与 CAD 分类中的其他技能主要面向机械/建筑领域不同，KiCad 是唯一专注于**印刷电路板（PCB）设计**的技能。KiCad 采用 GPL-3.0 许可证，在 CERN 持续支持下达到了企业级可用性。

**核心子模块**：

| 模块 | 功能 | 对应可执行程序 |
|:-----|:-----|:--------------|
| **原理图编辑器（Eeschema）** | 绘制电路原理图，元器件符号放置，电气连接，层次化子图 | `kicad-cli sch` |
| **PCB 编辑器（Pcbnew）** | 元器件布局，信号布线（交互式/差分对/推挽），铜覆层 | `kicad-cli pcb` |
| **3D 查看器** | 3D 渲染 PCB 板和元器件，STEP 模型导入 | 内置于 Pcbnew |
| **封装编辑器** | 创建和管理元器件封装（Footprint） | `kicad-cli fp` |
| **符号编辑器** | 创建和管理原理图符号（Symbol） | 内置于 Eeschema |
| **Gerber 查看器** | 查看生产文件（Gerber + 钻孔） | `gerbview` |

**Python 脚本 API（KiCad 8.0+）**：

从 KiCad 8.0 开始，官方引入了 `pcbnew` Python 模块的稳定 API，支持通过脚本自动化常见的 PCB 开发任务。以下是几个典型场景：

```python
import pcbnew

# 加载 PCB 文件
board = pcbnew.LoadBoard("my_project.kicad_pcb")

# 遍历所有元器件，打印位号和封装名
for footprint in board.GetFootprints():
    ref = footprint.GetReference()
    fp = footprint.GetFPID().GetLibItemName()
    print(f"{ref}: {fp}")

# 导出 BOM（物料清单）——实际代码会更长，这里示意逻辑
# ...

# 运行设计规则检查（DRC）
drc = pcbnew.DRC()
drc.RunTests(board)
```

**命令行自动化**（KiCad 9.x+ CLI）：

```bash
# 从原理图更新 PCB
kicad-cli pcb update --board project.kicad_pcb --schematic project.kicad_sch

# 导出 Gerber 生产文件
kicad-cli pcb export gerbers --board project.kicad_pcb --output gerbers/

# 导出 BOM
kicad-cli sch export bom --schematic project.kicad_sch --output bom.csv

# 导出 3D STEP 模型
kicad-cli pcb export step --board project.kicad_pcb --output project.step
```

**文件格式**：KiCad 6.0+ 使用基于 S-expressions 的新文件格式（`.kicad_sch`、`.kicad_pcb`、`.kicad_mod` 等），纯文本、人类可读、版本控制友好——这是 KiCad 区别于传统二进制格式 EDA 工具的一大优势。

---

## 6.6 BIM 与 IFC——xbim

**定位**：Xbim（the eXtensible Building Information Modelling toolkit）是一个面向 .NET 平台的开源 BIM 开发工具集。它将 buildingSMART 组织的 IFC 标准（ISO 16739）——从晦涩的 STEP/EXPRESS 文本格式——转化为 .NET 开发者可以直接用 C# 读、写、查询、编辑、可视化的**强类型对象模型**。

**核心能力**：

**(1) 强类型 IFC 实体模型**

Xbim 的最大价值在于：它将 IFC 模式中的每一个实体（如 `IfcWall`、`IfcDoor`、`IfcSlab`、`IfcRelAggregates` 等数百个实体类型）映射为**自动生成的 C# 接口/类**。这意味着在 Visual Studio 或 Rider 中开发时，IDE 能为 IFC 属性提供完整的智能提示和编译期类型检查。这与那些把 IFC 数据当作"字符串集合"来处理的方案有着本质区别。

**(2) IFC 格式兼容**

Xbim 原生支持三种 IFC 序列化方式：

- **STEP21**（`.ifc`）：最常用的文本格式
- **IFC XML**（`.ifcXML`）：基于 XML 的 IFC 表述
- **IFC ZIP**（`.ifcZIP`）：压缩包格式

支持的 IFC 版本包括 **IFC2x3**、**IFC4** 和 **IFC4x3**。

**(3) Xbim.Geometry 几何引擎**

Xbim 并非只能解析"数据"——通过 `Xbim.Geometry` 模块，它可以将 IFC 中以参数化、隐式方式描述的几何（如 `IfcExtrudedAreaSolid` 拉伸实体、`IfcBooleanClippingResult` 布尔裁剪结果）转换为精确的 B-Rep 表达和可显示的三角网格，底层基于 OCCT 7.6.x。

**(4) 可视化**

- **xbimXplorer**：基于 WPF 的桌面 BIM 模型查看器
- **xbimWebUI**：基于 WebGL 的浏览器端查看器，配合 `.wexbim` 二进制几何流实现 Web 端 BIM 展示

**(5) COBie 数据交换**

COBie（Construction Operations Building Information Exchange）是面向设施运维阶段的资产信息交换标准。Xbim 通过 `XbimCobieExpress` 模块支持 COBie 数据的生成和校验。

**代码示例——.NET 中读取 IFC 文件并统计墙的数量**：

```csharp
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

// 打开 IFC 文件
using var model = IfcStore.Open("Building.ifc");

// 查询所有墙（IfcWall / IfcWallStandardCase）
var walls = model.Instances.OfType<IIfcWall>();
Console.WriteLine($"墙体数量: {walls.Count()}");

// 遍历每面墙的属性
foreach (var wall in walls)
{
    var name = wall.Name;
    var type = wall.GetType().Name;
    Console.WriteLine($"  {type}: {name}");
}

// 计算总楼板面积
var slabs = model.Instances.OfType<IIfcSlab>();
double totalArea = 0;
foreach (var slab in slabs)
{
    // 通过几何引擎或属性集获取面积...
}
```

**在 BIM 生态中的位置**：Xbim 与 IfcOpenShell（C++/Python）是开源 IFC 世界两座并列的高峰。选择 Xbim 的关键理由：如果你已经深度使用 .NET 技术栈（C#/Azure/ASP.NET），Xbim 是最自然的选择——它不需要引入额外的语言运行时，IDE 集成度最高。

---

## 6.7 .NET AutoCAD 二次开发

这一节是 CAD 技能中最"业务导向"的部分——四个技能全部围绕 AutoCAD 平台的 .NET 二次开发展开。从底层框架（IFoxCAD）、到施工场布（FY_Layout）、到围护深化设计（LightningCAD）、再到图纸翻译（TongWen），它们形成了一个"基础框架 + 垂直业务插件"的完整生态。

### 6.7.1 ifoxcad——AutoCAD .NET 二次开发框架

**定位**：IFoxCAD 是一个基于 .NET 的 AutoCAD / 中望CAD（ZWCAD）/ 浩辰CAD（GstarCAD）二次开发类库，由雪山飞狐（狐哥）开创、落魄山人重构。它的核心设计理念是"**最小化内核 + 扩展方法**"——只用 DBTrans、SymbolTable、ResultData、SelectFilter 四个核心类作为基础，其余所有功能通过 C# 的扩展方法实现。

**核心机制**：

**(1) DBTrans——统一事务封装**

AutoCAD .NET API 中所有数据库操作必须包裹在 `using (Transaction tr = db.TransactionManager.StartTransaction()) { ... tr.Commit(); }` 样板代码中。IFoxCAD 的 `DBTrans` 彻底消灭了这个样板：

```csharp
// 传统 AutoCAD .NET API（每段操作约 6 行样板代码）
using (var tr = db.TransactionManager.StartTransaction())
{
    var bt = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
    var btr = (BlockTableRecord)tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForWrite);
    var line = new Line(new Point3d(0, 0, 0), new Point3d(10, 10, 0));
    btr.AppendEntity(line);
    tr.AddNewlyCreatedDBObject(line, true);
    tr.Commit();
}

// IFoxCAD 方式——用 DBTrans 消除样板
using (var tr = new DBTrans())
{
    var line = new Line(new Point3d(0, 0, 0), new Point3d(10, 10, 0));
    tr.CurrentSpace.AddEntity(line);
}
```

`DBTrans` 自动管理事务的开启、提交和回滚，自动获取当前空间（模型空间/图纸空间），开发者只需关注业务逻辑。

**(2) 链式扩展方法**

IFoxCAD 为 AutoCAD 原生实体类型提供了大量链式扩展方法，例如：

```csharp
// 创建带属性的直线
var line = new Line(p1, p2)
    .SetLayer("中心线")       // 设置图层
    .SetColorIndex(1)          // 设置颜色（红色）
    .SetLinetype("CENTER")     // 设置线型
    .AddToCurrentSpace();      // 添加到模型空间
```

**(3) 多 CAD 兼容**

IFoxCAD 深度兼容三种 CAD 平台：
- **AutoCAD**（Autodesk）：主流商业 CAD
- **中望 CAD（ZWCAD）**：国产 CAD，广泛应用于国内企业
- **浩辰 CAD（GstarCAD）**：另一款国产 CAD

不同平台之间底层 API 存在细微差异（如某些方法在 ZWCAD 中不适用），IFoxCAD 的封装屏蔽了这些差异，实现一套代码三平台运行。

**(4) 依赖注入（DI）集成**

IFoxCAD 内建了对 .NET 通用 DI 容器的支持，允许通过构造函数注入服务、配置和日志，适合大型 CAD 插件项目的工程化管理。

**(5) 命令注册（ICommand 接口）**

通过实现 `ICommand` 接口（而非传统 AutoCAD 的 `[CommandMethod]` 特性标注），IFoxCAD 提供了更灵活的命令注册方式——支持命令分组、条件启用/禁用、运行时热加载。

**典型场景**：任何基于 .NET 的 AutoCAD 二次开发项目，IFoxCAD 都应该作为基础框架被引入。它能将开发效率提升数倍，同时消除内存泄漏（事务未释放）、跨平台兼容等隐性风险。

---

### 6.7.2 fy_layout——施工场地布置插件

**定位**：FY_Layout（飞扬集成设计平台）是 LightCAD 平台的场地布置二次开发插件，也是 opengis-skills 技能仓库中 CAD 类文件体积最大的技能（26,822 字节）。它演示了如何基于 LightCAD 核心框架进行专业功能的扩展开发，覆盖了施工场地布置中常见的全部业务元素。

**核心功能模块**：

| 模块 | 说明 | 关键算法 |
|:-----|:-----|:---------|
| **板房布置** | 临时建筑（宿舍、办公室、仓库）的二维排布 | 矩形放置、阵列复制、碰撞检测 |
| **塔吊布置** | 塔式起重机的位置规划 | 覆盖半径计算、干涉分析 |
| **道路系统** | 施工道路和运输路径绘制 | 道路中线生成、交叉口处理、路基参数化 |
| **围墙布置** | 工地围墙/围栏自动生成 | 沿边界线等距分布、门洞自动避让 |
| **基坑开挖** | 开挖区域绘制与放坡计算 | 多边形偏移、放坡系数计算、土方量估算 |
| **绿化草坪** | 绿化区域绘制 | 多边形填充、边界平滑 |
| **硬化地面** | 道路和场地硬化 | 区域填充、面积统计 |

**技术特点**：FY_Layout 采用**二三维一体化**——所有场布元素同时支持二维平面绘制和三维立体显示，两者使用统一的数据模型。这意味着设计者在俯视图中放置板房后，可以立即切换到三维视图查看效果，无需任何转换。

**作为技能的学习价值**：FY_Layout 技能文件不仅是一个业务插件的参考，更是一个"如何基于 LightCAD 框架开发 CAD 领域插件的完整示范"——包括元素类型定义、Provider 参数化系统、UI 面板开发、命令注册、数据序列化等全部环节。

---

### 6.7.3 lightningcad——建筑围护深化设计插件

**定位**：LightningCAD（闪电围护）是一款面向**建筑围护结构深化设计**（外墙/屋面/幕墙）的 AutoCAD 插件，支持 AutoCAD 2019-2027 和中望 CAD 2022+ 双平台。

**核心功能**：

**(1) 板材自动排布**

围护深化设计的核心是"板材排布"——在指定墙面或屋面区域内，按照一定规则将板材逐块排列。LightningCAD 的板材排布模块支持：

- **外墙板**：横向/纵向排布，自动避让门窗洞口
- **内墙板**：适配内隔墙构造要求
- **屋面板**：找坡/不找坡两种模式（找坡模式下系统根据坡度自动调整板材切割角度）
- **楼承板**：钢结构楼板专用排布

排布完成后支持手动微调——锚点拖拽调整长度、板材合并/拆分、批量属性修改。

**(2) 幕墙系统**

两种幕墙形式：
- **框式幕墙**：立柱、横梁、面板分别定义和排布
- **单元式幕墙**：以"单元板块"为单位整体划分

**(3) 铝板分格和展开**

对于金属幕墙（铝板/铝塑板），LightningCAD 提供分格算法——将大面铝板按标准规格自动划分为小板，并生成展开图（用于工厂下料）。

**(4) 龙骨布置**

自动在墙体和屋面系统中布置竖向龙骨和水平檩条，支持间距定义、端部处理和洞口加强。

**(5) 统计输出**

自动生成板材统计表（型号、规格、数量、面积）、龙骨下料清单、收边件明细。

---

### 6.7.4 tongwen——工程图纸多语言翻译套件 🔥

**定位**：同文（Tongwen）是 opengis-skills 中最新增补的 CAD 技能，也是一款非常独特的 CAD/BIM 工具——它解决的问题不是"画图"或"建模"，而是**工程图纸的跨语言无损翻译**。其名称取自"车同轨，书同文"的理念，寓意打通中外工程协作的语言壁垒。

**核心痛点与解法**：

传统做法是将图纸中的文字逐条复制粘贴到 Excel、翻译、再手动回填——耗时、易出错、更致命的是会破坏图纸的图层结构、文字样式和坐标位置。同文的方案是在完整保留图纸原生数据（图层、坐标、文字样式、块属性、对象关联）的前提下，实现文本的自动提取→术语约束翻译→人工审校→受控回写。整个过程对图纸"零破坏"。

**技术方案**：

利用 CAD API 逐实体遍历，识别文字类实体（Dimension/Leader 标注、MText 多行文本、Attribute 块属性、图层名称、图框标题栏），提取文本内容和精确的几何属性（位置坐标、文字高度、旋转角度、对齐方式），译文写入时严格保持原属性不变。

**核心功能**：

| 功能模块 | 说明 |
|:---------|:-----|
| **文字提取** | 自动扫描全图文字对象，批量提取文本内容、坐标、图层、样式属性 |
| **术语库** | 四层翻译知识系统（通用词典 + 行业术语库 + 项目术语库 + 人工修正记忆），确保同一术语在全项目中译文一致 |
| **翻译执行** | 调用翻译引擎（内置本地引擎/可对接外部 API），逐条翻译，术语约束自动生效 |
| **人工审校** | 四级风险质量检查（阻断/高/中/低），支持人工逐条审查和修正 |
| **回写图纸** | 三种回写策略（原位替换/双语并排/仅译文），完整保留图层/颜色/字体/高度/旋转角度 |
| **批量处理** | 命令行模式支持多张图纸一键批量翻译，适合百张图纸的项目级翻译任务 |

**语言支持**：20+ 语言方向——中文↔英文/日文/韩文/法文/德文/西班牙文/俄文/阿拉伯文等，以及上述语种之间的互译。

**平台支持**：AutoCAD 2019-2026，数据存储本地优先（不依赖任何云服务），支持纯离线运行。

**排版保护**：这是同文最核心的技术承诺——翻译后文字在图纸中的位置、大小、旋转角度、图层、颜色、字体、对齐方式与原文字**完全一致**。这是它区别于"用 OCR 或截图翻译工具处理图纸"的根本差异点。

**典型场景**：国内设计院向海外业主/监理交付双语图纸；中国工程企业承接海外项目的施工图翻译；竣工档案的多语种归档。

---

## 6.8 数据交换与可视化

CAD 数据的价值不仅在于创建和编辑，更在于在不同系统之间流转和在多种终端上呈现。最后两个技能分别解决"数据格式互通"和"3D 可视化"两大关键需求。

### 6.8.1 libredwg——自由 DWG 读写库

**定位**：LibreDWG 是 GNU 项目下的一个完全开源的 C 语言库，专门用于读写 AutoCAD 的 DWG 文件格式。DWG 作为 CAD 行业的"事实标准"文件格式，长期被 Autodesk 作为专有格式控制，而 LibreDWG 是当前最完善的开源 DWG 处理方案。

**版本兼容性**：

LibreDWG 对 DWG 格式的读取覆盖率接近 99%，支持从最古老的 R1.2 到最新的 R2018 版本（共 30+ 个版本），具体包括：

- **早期**：r1.1～r14
- **中期**：r2000～r2004（写入功能达到"基本可用"级别）
- **近期**：r2007～r2018（读取功能完善，写入功能在持续改进中）

**核心组件**：

| 组件 | 功能 |
|:-----|:-----|
| **libredwg C 库** | DWG 解析和生成的核心引擎 |
| **dwgread** | 命令行读取工具，输出 JSON/DXF/SVG 等多种格式 |
| **dwgwrite** | 命令行写入工具，从 JSON 创建 DWG 文件 |
| **dxf2dwg** | DXF 到 DWG 的转换 |
| **dwg2dxf** | DWG 到 DXF 的转换 |
| **dwg2SVG** | DWG 到 SVG 的转换（用于 Web 预览） |
| **libredwg-python** | Python 绑定（社区维护） |

**命令行工具示例**：

```bash
# 读取 DWG 文件并输出为 JSON（含所有实体属性）
dwgread -O json input.dwg > output.json

# DWG 转 DXF
dwg2dxf input.dwg -o output.dxf

# DXF 转 DWG
dxf2dwg input.dxf -o output.dwg

# 查看 DWG 文件的元信息
dwgread -v4 input.dwg
```

**Python 绑定使用示例**：

```python
import libredwg

# 读取 DWG
dwg = libredwg.DwgData()
libredwg.dwg_read_file("drawing.dwg", dwg)

# 遍历所有实体
for obj in dwg.object:
    if obj.type == libredwg.DWG_TYPE_LINE:
        print(f"线段: ({obj.line.start.x}, {obj.line.start.y}) → ({obj.line.end.x}, {obj.line.end.y})")
    elif obj.type == libredwg.DWG_TYPE_TEXT:
        print(f"文字: {obj.text.text_value}")
```

**典型应用场景**：

- 在 Web 服务中解析 DWG 文件提取实体信息（如自动统计门窗数量）
- 批量 DWG→DXF 或 DWG→SVG 格式转换
- 在非 Windows 平台（Linux/macOS）上处理 DWG 文件
- 作为自建 CAD 数据管道的底层依赖

---

### 6.8.2 astral3d——工业 3D 可视化平台

**定位**：Astral3D 是杭州星孪数字科技团队开发的现代化 Web 3D 编辑器和三维引擎，基于 Vue3 + Three.js 技术栈，采用 Apache-2.0 许可证开源。它专为数字孪生场景（智慧城市、智慧工厂、智慧建筑）优化，是目前国内最具影响力的 Web 3D 开源解决方案之一。

**核心特性**：

**(1) 格式支持**

Astral3D 支持 30+ 种 3D 模型格式导入，覆盖了 CAD/BIM 全生态：

| 格式类型 | 支持的格式 |
|:---------|:----------|
| 通用 3D | GLTF / GLB / OBJ / FBX / 3DS / DAE / PLY / STL |
| BIM | RVT（Revit）/ IFC / NWD（Navisworks） |
| CAD | DWG / DXF |
| 点云 | LAS / LAZ / PTS / XYZ |
| 倾斜摄影 | OSGB / 3DTiles |

**(2) 大模型轻量化**

数字孪生场景中，一个完整的 BIM 模型可能包含百万级构件。Astral3D 通过以下技术手段解决 Web 端的渲染性能问题：

- **LOD（Level of Detail）**：根据相机距离自动切换模型精度层级
- **实例化渲染（Instancing）**：对重复构件（如柱子、窗户）只存储一份几何数据，GPU 端批量绘制
- **分包加载**：将大场景按空间区域分片，按需加载当前视野内的模型

**(3) CAD 数据互转**

Astral3D 内置了 CAD 格式与 Web 标准格式的转换管线：

```
OBJ / STL / STEP / IFC / DWG / RVT
         ↓ 解析 + 轻量化处理
    glTF / GLB（Web 端高效渲染）
```

这意味着用户上传一份 Revit 模型或 IFC 文件后，Astral3D 自动完成解析和轻量化，生成可在浏览器中秒开的 glTF 文件。

**(4) 扩展能力**

- **插件系统**：支持第三方插件的热加载/卸载，类似 VS Code 的扩展体系
- **脚本运行时**：内嵌 JavaScript/TypeScript 脚本引擎，可编写自定义交互逻辑
- **粒子系统**：内置火焰/烟雾/萤火虫等特效
- **天气系统**：晴天/雨天/雪天/雾天环境模拟
- **动画编辑器**：完整的关键帧动画和时间轴编辑

**与 chili3d 的选择**：

| 对比 | Astral3D | Chili3D |
|:-----|:---------|:--------|
| 定位 | 数字孪生可视化平台 | Web 端 CAD 建模工具 |
| 建模能力 | 弱（侧重浏览和标记） | 强（完整 B-Rep 建模） |
| 格式广度 | 30+ 种，含 BIM/CAD/点云 | STEP/IGES/BREP/STL |
| 大场景性能 | 极强（LOD/实例化/分包） | 中等 |
| UI 框架 | Vue3（前端领域标准） | 自研 Ribbon 界面 |

简单记忆：如果你需要在 Web 端**编辑 CAD 模型**，选 Chili3D；如果你需要在 Web 端**展示和管理 BIM/CAD 数据**，选 Astral3D。

---

## 6.9 CAD 技能选择决策树

面对 19 个技能，选择哪个取决于你的任务类型。以下决策树帮你快速定位：

```
需要 CAD 技能？
├─ 几何算法 → clipper2（首选）/ clipper1（旧项目维护）
├─ 3D 几何内核开发 → occt
├─ 3D 建模
│   ├─ 我喜欢用 Python 写建模脚本 → cadquery
│   ├─ 我喜欢声明式函数语言 → openscad
│   ├─ 我需要完整的交互式 GUI → freecad
│   ├─ 我需要精确的约束求解（机构运动）→ solvespace
│   └─ 我需要在浏览器里建模 → chili3d
├─ 2D 制图
│   ├─ 桌面端专业制图 + 脚本自动化 → qcad
│   ├─ 桌面端轻量制图 + 免费 → librecad
│   └─ Web 端 2D 绘图框架 → lightcad
├─ PCB 设计 → kicad
├─ BIM 与 IFC
│   ├─ .NET 技术栈 → xbim
│   └─ C++/Python 技术栈 → occt + IfcOpenShell（非本技能范畴）
├─ AutoCAD 二次开发
│   ├─ 我需要一个基础框架简化开发 → ifoxcad
│   ├─ 施工场地布置 → fy_layout
│   ├─ 建筑围护深化设计 → lightningcad
│   └─ 工程图纸多语言翻译 → tongwen
├─ DWG 文件读写
│   ├─ C 语言或 Python 绑定 → libredwg
│   └─ 仅需 DWG 查看，不开源也可 → qcad（读取）+ ODA SDK
└─ 3D 可视化
    ├─ 数字孪生 / BIM 大场景 Web 浏览 → astral3d
    └─ Web 端 CAD 模型编辑 → chili3d
```

**组合技能推荐**：

在实际项目中，多个 CAD 技能经常协同使用。以下是三组经典搭配：

| 场景 | 技能组合 | 说明 |
|:-----|:---------|:-----|
| **CAD 数据转换服务** | `occt` + `libredwg` | 用 libredwg 读 DWG，用 occt 做几何转换和网格化，输出 STL/STEP/glTF |
| **BIM Web 可视化平台** | `xbim` + `astral3d` | 用 xbim 解析 IFC 提取几何和属性，用 astral3d 做 Web 端渲染和交互 |
| **AutoCAD 插件全栈开发** | `ifoxcad` + `tongwen` + `lightningcad` | 以 ifoxcad 为框架底座，集成 tongwen（翻译）和 lightningcad（围护设计）的业务能力 |

---

## 6.10 本章小结

本章详细解析了 opengis-skills 中全部 19 个 CAD 技能。如果只能记住三个关键点，请记住：

1. **金字塔结构**：底层是 `occt` 几何内核和 `clipper2` 几何算法；中间层是 `freecad`/`cadquery`/`openscad`/`solvespace` 等参数化建模工具；顶层是 `ifoxcad`/`lightningcad`/`tongwen` 等面向 AutoCAD 平台的垂直业务插件。你的任务在哪一层，就加载哪一层的技能。

2. **平台分化明显**：桌面端（FreeCAD、QCAD、KiCad）、浏览器端（Chili3D、Astral3D、LightCAD）、.NET 企业端（IFoxCAD、Xbim）三类各有专属技能。不要用桌面端的技能去解决 Web 端的问题。

3. **真实项目需要组合**：没有哪个单技能能覆盖一个真实的工程场景。一个标准的"读取 DWG→解析 BIM 几何→转换格式→Web 展示"流程，就需要 `libredwg` + `xbim` + `occt` + `astral3d` 四个技能接力完成。学会按决策树选择和按推荐组合搭配，是高效使用 CAD 技能的关键。
