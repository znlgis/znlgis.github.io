---
layout: default
title: 第01章：OpenCSG.NET 概述与学习路线
---

# 第01章：OpenCSG.NET 概述与学习路线

## 1.1 OpenCSG.NET 是什么

OpenCSG.NET 是一个面向 .NET 平台的**构造实体几何（Constructive Solid Geometry，简称 CSG）建模库**。所谓 CSG，是一种用"基础形体 + 布尔运算"来描述复杂三维实体的建模方法：你先创建立方体、球体、圆柱体这样的简单形体，再用**并集（Union）**、**差集（Subtract）**、**交集（Intersect）** 把它们拼接、挖洞、求交，最终得到任意复杂的零件。这正是 OpenSCAD、许多 3D 打印切片器以及 CAD 内核背后的核心思想。

用一句话概括：

> OpenCSG.NET = "用 C# 代码描述实体几何 + 布尔运算内核 + STL 导出"——它让三维模型变成一段可版本控制、可参数化、可在服务端批量生成的代码。

关键信息速览：

| 项目 | 内容 |
| --- | --- |
| GitHub 仓库 | [znlgis/OpenCSG.NET](https://github.com/znlgis/OpenCSG.NET) |
| NuGet 包 | `OpenCSG.NET` |
| 命名空间 | `Csg` |
| 核心库目标框架 | `netstandard2.0`（兼容 .NET Framework 4.6.1+、.NET Core、.NET 5/6/7/8/9、Mono、Unity 等） |
| 示例/测试/性能目标框架 | `net8.0` |
| 许可协议 | MIT |
| 核心依赖 | 仅 `System.Text.Json`（8.0.5，且只有序列化功能会用到） |
| 语言版本 | C# 9.0（`Nullable enable`、`TreatWarningsAsErrors`） |
| 主要能力 | 基础形体、布尔运算、几何变换、STL 导出、声明式建模树、参数化型材截面、JSON 序列化 |

### 1.1.1 两套并行的 API

理解 OpenCSG.NET 最重要的一点，是它同时提供**两套风格截然不同、但底层统一**的 API：

1. **命令式 / 低层 API（`Solid` + `Solids`）**——你直接调用 `Solids.Cube(...)`、`Solids.Sphere(...)` 创建 `Solid` 实体对象，再用 `.Union()` / `.Subtract()` / `.Intersect()` / `.Translate()` 等方法链式组合。这是最直接、最灵活的用法，本教程第 5~8 章重点讲解。

2. **声明式 / 高层 API（`CsgNode` 树 + `CsgEvaluator`）**——你用一组不可变的 `record`（`BoxNode`、`SphereNode`、`UnionNode`……）描述一棵"建模意图树"，再交给 `CsgEvaluator.Evaluate(node)` 求值成 `Solid`。这套 API 天然可 JSON 序列化，适合把建模参数保存成文件、通过网络传输、或做成可视化编辑器的数据模型。本教程第 9~11 章重点讲解。

两套 API 并不冲突：声明式树最终也是调用命令式内核来计算的。你可以在同一个项目里混用——例如用声明式描述整体结构，用命令式做局部微调。

## 1.2 为什么会有 OpenCSG.NET：上游血统

OpenCSG.NET 并不是从零发明的，它有一条清晰的"移植与合并"血统。了解这条血统，能帮你理解代码里许多设计取舍的来龙去脉。

```
OpenJsCad csg.js（JavaScript 原始实现）
  └── praeclarum/Csg（手工 C# 移植）
        └── hypar-io/Csg
              ├── Csg（Union 原点居中修复、NaN 校验）
              └── DotNetCsg（二进制 STL、迭代式 BSP、RotateX/Y/Z）
                    └── OpenCSG.NET（本项目——合并两支改进）
```

- **csg.js / OpenJsCad**：最初的 JavaScript CSG 实现，用 BSP 树（二叉空间分割树）完成布尔运算。算法经典但递归实现，遇到复杂模型容易栈溢出。
- **praeclarum/Csg**：Frank Krueger 把 csg.js 手工移植成 C#，保留了 BSP 算法与规范化流程。
- **hypar-io/Csg**：Hypar 在 BIM 场景下使用并派生出两支：
  - **Csg 分支**：修复了 `Union` 在**大坐标**下的浮点精度问题（把几何整体平移到原点附近再做布尔，最后平移回去），并对 `Vector3D` 增加了 NaN 校验。
  - **DotNetCsg 分支**：增加了**二进制 STL** 输出、把递归 BSP 改写为**迭代式**（用显式栈/队列，避免栈溢出），补齐了 `RotateX/Y/Z` 等旋转辅助方法，并提供了丰富示例。
- **OpenCSG.NET**：把上面两支的优点合并到一起——既有 Csg 的原点居中 `Union` 修复与 NaN 校验，又有 DotNetCsg 的二进制 STL、迭代 BSP 与旋转辅助，并在此基础上新增了**声明式 `CsgNode` 树**、**参数化型材截面 `Profile2D`** 与 **JSON 序列化**等现代化能力。

这条血统解释了一个重要事实：**OpenCSG.NET 的布尔运算内核是"久经考验"的成熟算法**，它的价值不在于发明新算法，而在于把多年来社区积累的修复与增强整合进一个零依赖、跨平台、易用的现代 .NET 包。

## 1.3 它能做什么，不能做什么

### 1.3.1 擅长的场景

- **参数化零件建模**：用变量驱动尺寸，一行代码改一个参数就能生成一批零件。
- **3D 打印 / CNC 前处理**：直接导出 STL，喂给切片器或 CAM 软件。
- **钢结构 / 型材建模**：库内置了 H 型钢、槽钢、方管、L 型角钢等**标准截面**，可拉伸成型材并冲孔（见第 10、13 章）。
- **服务端批量几何生成**：零依赖、纯托管代码、可在 Linux 容器里跑，非常适合放进 Web API 或 CI 流水线。
- **教学与算法研究**：源码不大、结构清晰，是学习 CSG 与 BSP 树的极佳样本。

### 1.3.2 当前的限制

在开始之前，先了解几条"边界"，能帮你避免踩坑（后续章节会详细展开）：

- **不是网格编辑器**：它处理的是"实体的边界多边形"，不做任意三角网格的细分、平滑、重拓扑。
- **圆锥体尚未实现**：声明式 API 里定义了 `ConeNode`，但 `CsgEvaluator` 目前会对它抛出"Cone not yet supported"异常（第 9 章会讲替代方案——用 `Cylinder` 的锥台重载）。
- **导入格式有限**：核心库聚焦"生成 + 导出 STL"，不内置 STL/STEP 的**读取**解析。
- **圆柱体沿 Y 轴**：`Cylinder` 与 `CylinderNode` 默认沿 **Y 轴**方向生成，这与不少人预期的 Z 轴不同，需要配合旋转使用（第 5 章详解）。

## 1.4 第一印象：五分钟看懂用法

下面这段代码浓缩了 OpenCSG.NET 命令式 API 的典型流程——创建、布尔、变换、导出。你现在不需要完全理解每一行，只要建立"手感"即可，后续章节会逐一拆解。

```csharp
using Csg;
using static Csg.Solids;   // 静态引入后可直接写 Cube(...) 而不必写 Solids.Cube(...)

class Program
{
    static void Main()
    {
        // 1) 基础形体
        var cube     = Cube(size: 2, center: true);        // 边长 2、居中的立方体
        var sphere   = Sphere(r: 1.3, center: true);       // 半径 1.3 的球
        var cylinder = Cylinder(r: 0.5, h: 3, center: true); // 半径 0.5、高 3 的圆柱

        // 2) 布尔运算：立方体与球取交，再挖掉圆柱（打一个通孔）
        var body = cube.Intersect(sphere)   // 交集：得到"带圆角的方块"
                       .Subtract(cylinder);  // 差集：中间挖一个孔

        // 3) 导出为 ASCII STL 文件
        using var writer = new StreamWriter("part.stl");
        body.WriteStl("part", writer);
    }
}
```

运行后你会得到一个 `part.stl` 文件，用任意 STL 查看器（Windows 3D 查看器、Blender、在线 viewer 等）打开，就能看到一个"被球体削圆了棱角、中心带通孔"的方块。这就是 CSG 的魅力：**几行代码 = 一个可制造的三维零件**。

## 1.5 本教程的学习路线

本教程共 14 章，按"入门 → 原理 → 命令式用法 → 声明式用法 → 深入与实战"五个阶段组织，建议初学者顺序阅读，有经验者可按需跳读。

| 阶段 | 章节 | 主题 | 你将学会 |
| --- | --- | --- | --- |
| 入门 | 第01章 | 概述与学习路线 | 项目定位、上游血统、两套 API 的关系 |
| 入门 | 第02章 | 环境搭建与第一个程序 | 装 SDK、引 NuGet、跑通第一个程序、看懂项目结构 |
| 原理 | 第03章 | CSG 与 BSP 树原理 | 边界表示、布尔语义、BSP 分割与分类 |
| 原理 | 第04章 | 数学与几何基础类型 | `Vector3D`/`Matrix4x4`/`Plane`/`Polygon`/`Vertex` |
| 命令式 | 第05章 | 基础形体 | `Cube`/`Sphere`/`Cylinder` 全部重载与分辨率 |
| 命令式 | 第06章 | 布尔运算 | `Union`/`Subtract`/`Intersect` 与原点居中修复 |
| 命令式 | 第07章 | 几何变换 | 平移/旋转/缩放/镜像与变换矩阵 |
| 命令式 | 第08章 | STL 导出 | ASCII 与二进制 STL、三角化原理 |
| 声明式 | 第09章 | CsgNode 树与求值器 | 节点体系、`CsgNodes` 工厂、`CsgEvaluator` |
| 声明式 | 第10章 | 参数化截面与拉伸 | 七种型材截面、`ExtrudeNode`、`WedgeNode` |
| 声明式 | 第11章 | JSON 序列化 | `$type` 多态、往返读写、持久化建模参数 |
| 深入 | 第12章 | 源码剖析 | `Solid`/`Tree`/`Node` 迭代内核、规范化、Tag 缓存 |
| 实战 | 第13章 | 冷弯 C 型钢檩条 | 完整工程案例：参数化型材 + 冲孔 + 圆角 |
| 深入 | 第14章 | 测试、性能与二次开发 | NUnit 近似测试、基准测试、扩展与发布 |

### 1.5.1 阅读建议

- **只想快速用起来**：读第 1、2、5、6、7、8 章即可覆盖 80% 的日常需求。
- **要做可保存/可传输的建模参数**：加读第 9、10、11 章（声明式 + 序列化）。
- **要做钢结构 / 型材**：重点读第 10、13 章。
- **想理解或改进内核、贡献代码**：第 3、4、12、14 章不可错过。

## 1.6 本章小结

- OpenCSG.NET 是一个**零依赖、跨平台、MIT 授权**的 .NET CSG 建模库，命名空间为 `Csg`，NuGet 包名为 `OpenCSG.NET`。
- 它提供**命令式（`Solid`/`Solids`）** 与**声明式（`CsgNode`/`CsgEvaluator`）** 两套 API，底层共用同一个布尔运算内核。
- 它的算法血统源自 `csg.js`，经 praeclarum/Csg、hypar-io/Csg 演化，最终**合并 Csg 与 DotNetCsg 两支的改进**——原点居中 `Union`、二进制 STL、迭代式 BSP 等。
- 它擅长参数化零件、3D 打印前处理、钢结构型材与服务端批量几何生成；当前不做网格编辑、STL 读取，且圆锥体尚未实现、圆柱体默认沿 Y 轴。

下一章将带你**搭建开发环境、通过 NuGet 引用 OpenCSG.NET、看懂仓库结构，并运行你的第一个完整程序**。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <span></span>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/">目录</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第02章-环境搭建与第一个程序/">下一章 →</a>
</div>
