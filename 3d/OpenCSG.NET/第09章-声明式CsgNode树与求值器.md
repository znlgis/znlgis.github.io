---
layout: default
title: 第09章：声明式 CsgNode 树与求值器
---

# 第09章：声明式 CsgNode 树与求值器

前面八章讲的都是**命令式 API**——你一步步调用 `Cube()`、`.Subtract()`、`.Translate()`，像下达指令一样构建实体。本章介绍 OpenCSG.NET 的另一套 API：**声明式的 `CsgNode` 树**。你不再"执行操作"，而是用一组不可变的 `record` **描述**一棵"建模意图树"，再交给 `CsgEvaluator` 一次性求值成 `Solid`。这套 API 是第 11 章 JSON 序列化的基础，也是构建可视化编辑器、参数化配置系统的理想数据模型。

## 9.1 命令式 vs 声明式：两种思维

| 维度 | 命令式（`Solid`/`Solids`） | 声明式（`CsgNode`/`CsgEvaluator`） |
| --- | --- | --- |
| 你写的是 | **操作步骤**（怎么做） | **数据结构**（要什么） |
| 核心类型 | `Solid`（立即算出几何） | `CsgNode`（只是描述，不算几何） |
| 求值时机 | 每步立即计算 | 调 `Evaluate` 时统一计算 |
| 可否序列化 | 否（`Solid` 是几何结果） | **是**（节点树可转 JSON） |
| 典型场景 | 直接建模、脚本 | 保存/传输建模参数、可视化编辑器、撤销重做 |

一句话：**命令式产出"结果"，声明式产出"配方"**。配方可以被保存、传输、修改、重新求值——这正是声明式的价值所在。二者底层统一：`CsgEvaluator` 求值声明式树时，调用的正是命令式内核。

## 9.2 CsgNode：用 record 描述建模树

所有节点都继承自抽象记录 `CsgNode`（定义在 `CsgNode.cs`）：

```csharp
public abstract record CsgNode;
```

选用 C# 的 **`record`** 而非 `class`，是深思熟虑的设计——记录天生**不可变**、带**值相等语义**、支持 **`with` 表达式**做非破坏性修改，非常契合"建模配方"这种数据。

> **netstandard2.0 的小魔法**：C# 9 的 `record` 在 `netstandard2.0` 上需要一个名为 `IsExternalInit` 的编译期类型。`CsgNode.cs` 顶部用几行代码"打了个补丁"（polyfill）把它补上，才让记录能在这个老目标框架上编译。这是支持广泛平台的必要妥协。

### 9.2.1 节点类型全景

`CsgNode` 的子类分四组：

**图元节点（叶子，直接对应几何形体）：**

```csharp
public record BoxNode(Vector3D Center, Vector3D Size) : CsgNode;
public record SphereNode(Vector3D Center, double Radius) : CsgNode;
public record CylinderNode(Vector3D Center, double Radius, double Height) : CsgNode;
public record ConeNode(Vector3D Center, double TopRadius, double BottomRadius, double Height) : CsgNode;
public record ExtrudeNode(Profile2D Profile, double Height) : CsgNode;   // 拉伸型材，见第10章
public record WedgeNode(Vector3D Corner, double Width, double Depth, double Height) : CsgNode;  // 楔形，见第10章
```

**布尔运算节点（内部节点，带子节点列表）：**

```csharp
public record UnionNode(List<CsgNode> Children) : CsgNode;
public record SubtractNode(List<CsgNode> Children) : CsgNode;
public record IntersectNode(List<CsgNode> Children) : CsgNode;
```

**变换节点：**

```csharp
public record TransformNode(Vector3D Translation, Vector3D Rotation, CsgNode Child) : CsgNode;
```

一棵典型的 `CsgNode` 树，就是这些节点嵌套组合而成——布尔/变换节点在内部，图元节点在叶子。

### 9.2.2 图元节点默认"居中"

一个和命令式 API 的重要区别：**图元节点都以 `Center` 为中心**，而不像 `Solids.Cube` 那样默认角在原点。

- `BoxNode(Center, Size)` → 求值为**以 `Center` 为中心**、尺寸 `Size` 的长方体。
- `SphereNode(Center, Radius)` → 以 `Center` 为中心的球。
- `CylinderNode(Center, Radius, Height)` → 以 `Center` 为中心、**沿 Y 轴**、高 `Height` 的圆柱（从 `Center.Y - Height/2` 到 `Center.Y + Height/2`）。

所以声明式 API 里，你通过 `Center` 直接指定形体位置，通常无需再套一层平移。

## 9.3 CsgNodes：便捷工厂

直接 `new BoxNode(...)` 也行，但 `CsgNodes` 静态类提供了更简洁的工厂方法，还有一些友好的重载：

```csharp
using static Csg.CsgNodes;   // 静态引入

// 图元
var box = Box(new Vector3D(0, 0, 0), new Vector3D(2, 2, 2));
var box2 = Box(0, 0, 0, 2, 2, 2);          // 6 个 double 的便捷重载：cx,cy,cz,sx,sy,sz
var ball = Sphere(new Vector3D(0, 0, 0), 1.5);
var cyl  = Cylinder(new Vector3D(0, 0, 0), radius: 0.5, height: 3);

// 布尔（可变参数，任意多个子节点）
var u = Union(box, ball);
var d = Subtract(box, cyl);
var x = Intersect(box, ball);

// 变换：平移向量 + 欧拉旋转（度） + 子树
var moved = Transform(
    translation: new Vector3D(5, 0, 0),
    rotation:    new Vector3D(0, 0, 45),
    child:       box);
```

注意布尔工厂 `Union/Subtract/Intersect` 接收 `params CsgNode[]`，内部包装成 `List<CsgNode>`。整棵树建好之前，**没有任何几何被计算**——它们只是数据。

## 9.4 CsgEvaluator：把树求值成 Solid

描述好的树，交给 `CsgEvaluator.Evaluate` 变成真正的 `Solid`：

```csharp
CsgNode tree = Subtract(
    Box(0, 0, 0, 10, 10, 10),
    Sphere(new Vector3D(0, 0, 0), 6.5)
);

Solid solid = CsgEvaluator.Evaluate(tree);   // 到这一步才真正计算几何

using var w = new StreamWriter("out.stl");
solid.WriteStl("out", w);
```

### 9.4.1 求值机制：模式匹配分发

`Evaluate` 的核心是一个 C# **模式匹配 `switch`**，按节点类型分发到对应的构建逻辑（源码 `CsgEvaluator.cs`）：

```csharp
return node switch
{
    BoxNode n       => Solids.Cube(n.Size, n.Center),
    SphereNode n    => Solids.Sphere(n.Radius, n.Center),
    CylinderNode n  => EvaluateCylinder(n),
    ConeNode n      => throw new CsgEvaluationException("Cone not yet supported ..."),
    UnionNode n     => EvaluateBool(n.Children, (a, b) => a.Union(b)),
    SubtractNode n  => EvaluateBool(n.Children, (a, b) => a.Subtract(b)),
    IntersectNode n => EvaluateBool(n.Children, (a, b) => a.Intersect(b)),
    TransformNode n => ApplyTransform(Evaluate(n.Child), n.Translation, n.Rotation),
    ExtrudeNode n   => EvaluateExtrude(n),
    WedgeNode n     => EvaluateWedge(n),
    _               => throw new CsgEvaluationException($"Unknown node type: ...")
};
```

求值是**递归**的：遇到布尔或变换节点，先递归求值子节点，再组合。这把一棵声明式树"自底向上"地折叠成一个 `Solid`。

### 9.4.2 布尔节点的折叠语义

布尔节点的子节点列表由 `EvaluateBool` 按**从左到右**折叠：先求值第一个子节点作为初始结果，再依次和后续子节点做布尔运算。

```csharp
// 伪代码
result = Evaluate(children[0]);
for (i = 1; i < children.Count; i++)
    result = op(result, Evaluate(children[i]));
```

所以 `Subtract(a, b, c)` 等价于 `(a − b) − c`，`Union(a, b, c)` 等价于 `(a ∪ b) ∪ c`。**布尔节点至少要有一个子节点**，否则 `Evaluate` 抛 `CsgEvaluationException("Boolean node requires at least one child")`。

### 9.4.3 批量求值 EvaluateAll

如果你有一批**独立**的树要分别求值（比如一个装配体里的多个零件），用 `EvaluateAll`：

```csharp
IReadOnlyList<Solid> parts = CsgEvaluator.EvaluateAll(new[] { treeA, treeB, treeC });
```

它对每棵树独立调用 `Evaluate`，返回结果列表，方便逐个导出或分别上色。

## 9.5 TransformNode 的变换顺序（重要）

`TransformNode` 的求值细节值得单独强调，因为它的**内部顺序**可能和你的直觉不同。`ApplyTransform` 的逻辑是：

1. **先平移**（如果 `Translation` 非零）；
2. **再依次绕 X、Y、Z 旋转**（各自非零时才应用）。

也就是**先平移、后旋转**。回忆第 7 章：旋转是绕世界原点的。所以 `TransformNode` 会把子树**先移到目标位置，再绕世界原点旋转**——这通常**不是**"原地自转再就位"的效果。

如果你想要"先旋转（在原点原地自转）、再平移就位"，需要**嵌套两个 `TransformNode`**：内层只做旋转，外层只做平移：

```csharp
// 目标：让 box 先在原点绕 Z 自转 45°，再平移到 (10, 0, 0)
var node = Transform(
    translation: new Vector3D(10, 0, 0),   // 外层：只平移
    rotation:    new Vector3D(0, 0, 0),
    child: Transform(
        translation: new Vector3D(0, 0, 0),
        rotation:    new Vector3D(0, 0, 45),  // 内层：只旋转（此时 box 还在原点）
        child: Box(0, 0, 0, 2, 2, 2)));
```

理解这一点能避免"我的零件转到了奇怪的位置"这类困惑。

## 9.6 ConeNode 尚未实现：一个必须知道的限制

节点体系里定义了 `ConeNode`（圆锥/圆台），`CsgNodes.Cone(...)` 工厂也能创建它——**但 `Evaluate` 遇到它会直接抛异常**：

```csharp
ConeNode n => throw new CsgEvaluationException("Cone not yet supported (requires Solid API investigation)"),
```

这意味着：**你可以构造包含 `ConeNode` 的树、甚至序列化它，但一旦求值就会失败**。这是当前版本的已知限制。

**规避方案**：需要圆锥/圆台时，回到命令式 API，用第 5 章讲的 **`RadiusEnd = 0` 或不等半径的 `Cylinder`** 来实现，然后（如果需要）把它作为一个独立 `Solid` 与声明式求值结果再做命令式布尔。或者，如果你在做二次开发，第 14 章会讨论如何给求值器补上圆锥支持——本质上就是把 `ConeNode` 映射到一个不等半径的 `CylinderOptions`。

## 9.7 完整示例：用声明式树建一个支架

把本章知识串起来，用纯声明式方式描述一个"带安装孔的 L 形支架"雏形，再求值导出：

```csharp
using Csg;
using static Csg.CsgNodes;

// 描述阶段：只是搭建数据，不做任何几何计算
CsgNode bracket = Subtract(
    // 主体：两块板用并集拼成 L 形
    Union(
        Box(0, 0, 0, 40, 6, 20),                       // 水平板
        Box(-17, 15, 0, 6, 36, 20)                     // 竖直板（靠左）
    ),
    // 挖两个安装孔（用居中的圆柱，沿 Y 轴穿过水平板）
    Cylinder(new Vector3D(12, 0, 6), radius: 2.5, height: 12),
    Cylinder(new Vector3D(12, 0, -6), radius: 2.5, height: 12)
);

// 求值阶段：一次性算出几何
Solid solid = CsgEvaluator.Evaluate(bracket);

using var w = new StreamWriter("bracket.stl");
solid.WriteStl("bracket", w);
Console.WriteLine($"面数：{solid.Polygons.Count}");
```

整个 `bracket` 变量在 `Evaluate` 之前只是一棵**纯数据的树**——你可以把它打印、序列化（第 11 章）、存进数据库、或在 UI 里让用户编辑参数，然后随时重新求值。这就是声明式相较命令式的独特能力。

## 9.8 本章小结

- 声明式 API 用不可变的 **`CsgNode` 记录树**描述"建模配方"，命令式 API 产出"几何结果"；二者底层统一，声明式求值时调用命令式内核。
- 节点分四组：**图元**（Box/Sphere/Cylinder/Cone/Extrude/Wedge）、**布尔**（Union/Subtract/Intersect，带子节点列表）、**变换**（Transform）。图元节点默认**以 `Center` 居中**。
- `CsgNodes` 提供便捷工厂；`CsgEvaluator.Evaluate` 用**模式匹配**递归求值，布尔节点**从左到右折叠**，`EvaluateAll` 批量求值。
- **`TransformNode` 先平移后旋转**；要"原地自转再就位"需**嵌套两个 TransformNode**。
- **`ConeNode` 尚未实现**，求值会抛异常；需要圆锥请用命令式 `Cylinder`（半径收为 0）。

下一章深入声明式 API 最实用的部分——**参数化截面 `Profile2D` 与拉伸建模**：如何用 H 型钢、槽钢、L 型角钢等标准截面配合 `ExtrudeNode` 生成工程型材，以及 `WedgeNode` 楔形体的原理。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第08章-STL导出与文件格式/">← 上一章</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/">目录</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第10章-参数化截面与拉伸建模/">下一章 →</a>
</div>
