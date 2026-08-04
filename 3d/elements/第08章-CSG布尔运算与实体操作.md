---
layout: default
title: 第08章：CSG布尔运算与实体操作
---

# 第08章：CSG布尔运算与实体操作

在第02章中，我们介绍了 `Representation` 通过 `SolidOperation` 列表来描述元素的几何形态。本章将深入 Elements 几何内核的核心——CSG（Constructive Solid Geometry）布尔运算引擎，解析 `SolidOperation` 的完整参数体系，阐明 `IsVoid` 挖空机制的工作原理，并演示如何将多个实体操作组合为复杂建筑形体。

## 8.1 CSG 基本概念

### 8.1.1 什么是 CSG

**CSG（Constructive Solid Geometry，构造实体几何）** 是一种用基本体素（primitives）通过布尔运算构建复杂形体的建模技术。与基于顶点和面片的 BREP（Boundary Representation，边界表示）不同，CSG 描述的**不是"是什么"，而是"怎么做"**。

在 CSG 的世界中，模型不是一堆三角形面片的集合，而是一棵操作树：

```
          ┌─────────┐
          │  结果   │
          └────┬────┘
        ┌──────┴──────┐
        │  Subtract   │  ← 布尔运算节点
        └──────┬──────┘
    ┌──────────┴──────────┐
    │                      │
┌───┴───┐            ┌────┴────┐
│ 墙体  │            │  门洞   │
│(Union)│            │ 挖空体  │
└───────┘            └─────────┘
```

树枝上的每个叶子是一个基本体素（由 Extrude、Sweep 等操作生成），内部节点是一次布尔运算（Union、Subtract 或 Intersect）。叶子和内部节点的组合共同定义了最终的三维形体。

Elements 正是围绕这一范式设计的——你不需要直接操作顶点和面，而是**声明性地描述几何操作**，由 CSG 引擎计算出最终的精确实体。

### 8.1.2 三种基本布尔操作

CSG 提供三种基本布尔操作，分别对应集合论中的并集、差集和交集：

| 操作 | 集合论 | CSG 术语 | 图解说明 |
| --- | --- | --- | --- |
| **并集** | A ∪ B | **Union** | 将两个实体合并为一个，去除内部交面 |
| **差集** | A − B | **Subtract** | 从实体 A 中挖去与 B 重叠的部分 |
| **交集** | A ∩ B | **Intersect** | 只保留两个实体重叠的部分 |

在建筑建模中，最常用的是 Union（组合构件）和 Subtract（开洞）。

### 8.1.3 Elements 中的 CSG 工作流程

Elements 的 CSG 处理遵循一个清晰的流水线：

```
SolidOperation 列表
       │
       ▼
┌─────────────────────────────────────────┐
│  SolidOperationUtils.                    │
│      GetFinalCsgFromSolids()            │
│                                          │
│  1. 将每个 SolidOperation 转为 Csg.Solid│
│  2. 对所有非 Void 实体执行 Union       │
│  3. 对所有 Void 实体执行 Subtract      │
│  4. 返回最终的 Csg.Solid                │
└─────────────────────────────────────────┘
       │
       ▼
   Csg.Solid（精确的 BREP/CSG 混合表示）
       │
       ▼
  ┌────────────┐    ┌──────────────┐
  │ 三角剖分   │    │  BBox3 计算  │
  │ ToMesh()   │    │  包围盒      │
  └────────────┘    └──────────────┘
```

## 8.2 SolidOperation 完整参数体系

`SolidOperation` 是 Elements 几何体系的声明核心。它有四个具体子类，每个代表一种不同的形体生成方式。

### 8.2.1 SolidOperation 基类

```csharp
public abstract class SolidOperation
{
    // 是否为挖空体（Subtract 操作）
    public bool IsVoid { get; set; }

    // 是否生成实心体（3D）还是仅生成面（2D 用于 Lamina）
    public bool IsSolid { get; set; }
}
```

所有子类继承这两个属性：
- **IsVoid**：设为 `true` 时，该操作生成的实体将在布尔运算中被"减去"，用于开洞、挖槽等
- **IsSolid**：对于 Extrude 和 Sweep，通常为 `true`（生成封闭的三维实体）；对于 Lamina，通常为 `false`（生成薄片面）

### 8.2.2 Extrude：拉伸

`Extrude` 是使用最频繁的 SolidOperation，几乎所有建筑元素（墙、梁、柱、楼板）都通过它生成。

```csharp
public class Extrude : SolidOperation
{
    // 剖面/轮廓（可含空洞，定义拉伸的截面形状）
    public Profile Profile { get; set; }

    // 拉伸长度（单位：米）
    public double Extent { get; set; }

    // 拉伸方向（单位向量）
    public Vector3 Direction { get; set; }

    // 是否从剖面位置双向拉伸各一半
    public bool BothSides { get; set; }

    // 拉伸体的深度（通常由 Extent 和 Direction 决定）
    // 仅在需要通过深度而非 Extent 指定长度时使用
    public double Depth { get; set; }
}
```

**参数详解：**

- **Profile**：必须是**闭合的平面多边形**（可以带内环空洞）。`Profile` 类本身封装了一个外环（`Perimeter`）和零个或多个内环（`Voids`）。
- **Extent**：拉伸的总长度，沿 `Direction` 方向。
- **Direction**：拉伸方向的单位向量。通常是 `Vector3.ZAxis`（向上）或定位线的方向。
- **BothSides**：设为 `true` 时，实体从剖面位置向正负两个方向各拉伸 `Extent / 2`。对于居中对齐的构件（如中心定位的梁）非常有用。
- **Depth**：与 `Extent` 功能相似但语义不同——当通过起点和终点坐标反算深度时使用。

**示例：基本拉伸体**

```csharp
// 一个 10m × 5m 的矩形楼板，厚 0.2m
var slabProfile = new Profile(
    Polygon.Rectangle(10.0, 5.0)
);

var slabExtrude = new Extrude(
    slabProfile,        // 截面
    0.2,               // 厚度（Extent）
    Vector3.ZAxis,     // 向上拉伸
    false              // 不双向
);
```

**示例：带空洞的拉伸体（管状截面）**

```csharp
// 外径 0.5m，内径 0.4m 的圆管截面
var outerCircle = new Circle(Vector3.Origin, 0.5).ToPolygon(64);
var innerCircle = new Circle(Vector3.Origin, 0.4).ToPolygon(64);

var pipeProfile = new Profile(outerCircle, new[] { innerCircle });

var pipe = new Extrude(
    pipeProfile,
    10.0,
    Vector3.ZAxis,
    false
);
```

**示例：双向拉伸（居中对齐的梁）**

```csharp
// 梁的截面宽 0.3m，高 0.6m，以定位线为中心双向拉伸
var beamProfile = new Profile(
    Polygon.Rectangle(0.3, 0.6)
);

var beamExtrude = new Extrude(
    beamProfile,
    6.0,                  // 总长度 6m
    Vector3.XAxis,        // 沿 X 轴
    true                  // 双向各拉 3m
);
```

### 8.2.3 Sweep：扫描

`Sweep` 将截面轮廓沿一条任意曲线路径扫掠，生成三维实体。适用于弯曲管道、弧形檐口、螺旋坡道等。

```csharp
public class Sweep : SolidOperation
{
    // 截面轮廓
    public Profile Profile { get; set; }

    // 扫描路径（任意曲线）
    public Curve Curve { get; set; }

    // 沿路径起始位置回退的距离
    public double StartSetback { get; set; }

    // 沿路径终止位置回退的距离
    public double EndSetback { get; set; }

    // 扫描的子分段数（控制曲面精度）
    public int Segments { get; set; }
}
```

**参数详解：**

- **Profile**：与 Extrude 相同，定义截面形状。
- **Curve**：扫描路径。可以是 `Line`（直线扫描，效果等同于无旋转的 Extrude）、`Arc`（弧线扫描）或任何实现了 `Curve` 抽象类的自定义曲线。
- **StartSetback / EndSetback**：从路径起点/终点各"退"多少距离。例如，管道连接到弯头时需要留出连接段。
- **Segments**：路径曲线的离散化分段数，影响扫描体的表面精度。

**示例：90度弧形管道**

```csharp
// 90° 弧线，半径 3m
var arc = new Arc(
    Vector3.Origin,
    3.0,
    0.0,                    // 起始角 0°
    Math.PI / 2            // 终止角 90°
);

// 圆形截面，半径 0.1m
var section = new Profile(
    new Circle(Vector3.Origin, 0.1).ToPolygon(32)
);

var sweep = new Sweep(
    section,
    arc,
    0,                      // 无起始退距
    0                       // 无终止退距
);
```

**示例：带退距的管道段**

```csharp
// 直线路径，但在两端各退 0.05m（给连接件留空间）
var pipeLine = new Line(
    new Vector3(0, 0, 3),
    new Vector3(8, 0, 3)
);

var pipeSection = new Profile(
    new Circle(Vector3.Origin, 0.15).ToPolygon(32)
);

var pipeSweep = new Sweep(
    pipeSection,
    pipeLine,
    0.05,                   // 起始退距
    0.05                    // 终止退距
);
```

### 8.2.4 Lamina：层板

`Lamina` 是最特殊的 SolidOperation——它**不生成实体**（`IsSolid = false`），而是在轮廓平面内生成一个薄片面。它通常用于表达无厚度的表面（如幕墙面板、水面、分析面）。

```csharp
public class Lamina : SolidOperation
{
    // 层板的外围轮廓
    public Polygon Perimeter { get; set; }

    // 层板内的空洞
    public IList<Polygon> Voids { get; set; }
}
```

注意 `Lamina` 直接使用 `Polygon` 而非 `Profile`，因为它不涉及拉伸/扫描方向的计算。它本身就是在 XY 平面上的二维面片（通过 `Transform` 定位到三维空间）。

**示例：一个带圆形空洞的矩形面板**

```csharp
// 2m × 3m 的矩形面板
var panelOutline = Polygon.Rectangle(2.0, 3.0);

// 中间的圆形孔洞
var hole = new Circle(Vector3.Origin, 0.3).ToPolygon(32);

var lamina = new Lamina(panelOutline, new[] { hole });
```

### 8.2.5 操作对比速查表

| 特性 | Extrude | Sweep | Lamina | ConstructedSolid |
| --- | --- | --- | --- | --- |
| 输入 | Profile + 方向 + 长度 | Profile + 曲线路径 | Polygon + 空洞 | 子 SolidOperation 列表 |
| 输出 | 三维实体 | 三维实体 | 二维薄片面 | 三维实体（组合体） |
| IsSolid 默认值 | `true` | `true` | `false` | `true` |
| 典型用途 | 墙、梁、柱、楼板 | 弯管、弧形梁 | 幕墙面板、水面 | 复杂异形构件 |
| 路径类型 | 直线（固定方向） | 任意曲线 | 无路径（纯平面） | 取决于子操作 |

## 8.3 IsVoid 挖空操作

### 8.3.1 IsVoid 的工作原理

`IsVoid` 是 `SolidOperation` 上最关键的一个布尔开关。它的默认值为 `false`，表示该操作生成的是**实体材料**。设为 `true` 时，该操作生成的实体变成了"负空间"——在最终的 CSG 计算中，它被从所有 `IsVoid = false` 的实体中**减除**。

```csharp
// 普通拉伸：生成一个实心方块
var solidBlock = new Extrude(
    new Profile(Polygon.Rectangle(1, 1)),
    1.0,
    Vector3.ZAxis,
    false
)
{
    IsVoid = false    // 默认值，生成实体材料
};

// 挖空拉伸：从其他实体中切除这个形状
var voidBlock = new Extrude(
    new Profile(Polygon.Rectangle(0.5, 0.5)),
    1.0,
    Vector3.ZAxis,
    false
)
{
    IsVoid = true     // 标记为挖空，用于开洞
};
```

### 8.3.2 挖空的布尔运算顺序

Elements 处理多个 `SolidOperation` 时的布尔运算顺序是固定的：

1. **第一步**：将所有 `IsVoid = false` 的操作生成的 `Csg.Solid` 做 **Union（并集）**，形成一个"正形体"
2. **第二步**：将所有 `IsVoid = true` 的操作生成的 `Csg.Solid` 逐一从正形体中 **Subtract（差集）** 掉

这意味着：
- **挖空可以穿过多层实体**——一个 IsVoid 的体素会同时切除所有与之重叠的非 Void 体素
- **挖空之间不互相影响**——两个 IsVoid 操作之间不做布尔运算
- **Union 优先于 Subtrac**t——先合并所有实体，再统一挖空

### 8.3.3 挖空的使用场景

**墙上的门洞：**

```csharp
var wall = new Wall(
    new Line(new Vector3(0, 0, 0), new Vector3(5, 0, 0)),
    new Profile(Polygon.Rectangle(0.2, 3.0)),
    3.0
);

// 在墙上开一个 1m 宽 × 2.1m 高的门洞
var doorOpening = new Opening(
    Polygon.Rectangle(1.0, 2.1),    // 门洞轮廓
    0.2,                             // 深度（略大于墙厚）
    new Transform(2.0, 0, 0)         // 位于墙的中间
);

// Opening 内部会自动创建 IsVoid=true 的 Extrude
```

**楼板上的天窗：**

```csharp
var floor = new Floor(
    Polygon.Rectangle(6.0, 8.0),
    0.2
);

// 在楼板上方创建一个天窗开洞
var skylightOpening = new Opening(
    Polygon.Rectangle(1.5, 1.5),
    0.3,                              // 深度略大于楼板厚度
    new Transform(3.0, 4.0, 0.05)     // 中心位置，略高于楼板表面
);
```

### 8.3.4 IsVoid 与嵌套关系

一个 `GeometricElement` 的 `Representation.SolidOperations` 可以包含任意数量的 IsVoid 操作。当元素被添加到 `Model` 并调用 `UpdateBoundsAndComputeSolid()` 时，所有操作（实体和挖空）一起参与该元素的 CSG 计算。

关键规则：
- **同元素内的挖空只作用于同元素内的实体**——Element A 的 IsVoid 不会挖到 Element B 的实体
- 如果需要跨元素挖洞（如楼梯在楼板上开洞），需要在同一个 `Representation` 中组合多个操作

## 8.4 多个实体操作的组合

### 8.4.1 一个 Element 拥有多个 SolidOperation

一个 `GeometricElement` 的 `Representation.SolidOperations` 是一个列表，这意味着一个元素可以由**多个几何操作组合而成**。这是构建复杂形体的关键机制。

典型的例子是带饰面层的墙：

```csharp
public class StuccoWall : Wall
{
    public override void UpdateRepresentations()
    {
        Representation = new Representation();

        // 操作 1：混凝土核心（180mm 厚）
        var core = new Extrude(
            new Profile(Polygon.Rectangle(0.18, 3.0)),
            CenterLine.Length(),
            CenterLine.Direction().Unitized(),
            false
        )
        { IsVoid = false };

        // 操作 2：外饰面层（20mm 厚），向外偏移 90mm
        var exteriorFinish = new Extrude(
            new Profile(Polygon.Rectangle(0.02, 3.0)),
            CenterLine.Length(),
            CenterLine.Direction().Unitized(),
            false
        )
        {
            IsVoid = false,
            // 需要配合 Transform 偏移到混凝土外侧
        };

        // 操作 3：内饰面层（20mm 厚）
        var interiorFinish = new Extrude(
            new Profile(Polygon.Rectangle(0.02, 3.0)),
            CenterLine.Length(),
            CenterLine.Direction().Unitized(),
            false
        )
        {
            IsVoid = false,
            // 需要配合 Transform 偏移到混凝土内侧
        };

        Representation.SolidOperations.AddRange(
            new SolidOperation[] { core, exteriorFinish, interiorFinish }
        );
    }
}
```

### 8.4.2 实体操作与挖空操作的顺序

在 `SolidOperations` 列表中的顺序**不影响**最终结果——`GetFinalCsgFromSolids()` 方法会先收集所有非 Void，再收集所有 Void，分别处理。所以你可以按任意顺序添加：

```csharp
// 以下两种写法效果完全相同

// 写法 A：先实体后挖空
Representation.SolidOperations.Add(beamExtrude);   // IsVoid = false
Representation.SolidOperations.Add(holeVoid);      // IsVoid = true

// 写法 B：先挖空后实体
Representation.SolidOperations.Add(holeVoid);      // IsVoid = true
Representation.SolidOperations.Add(beamExtrude);   // IsVoid = false
```

### 8.4.3 使用 Transform 控制操作间的位置关系

每个 `SolidOperation` 本身没有 `Transform` 属性，但它们的输入几何（`Profile` 的 `Polygon`、`Sweep` 的 `Curve` 等）都定义在局部坐标系中。多个 SolidOperation 可以通过它们各自的**输入几何的绝对坐标**来定义空间关系。

例如，一个空心柱（实心外壁 + 内部挖空）：

```csharp
// 创建一个空心柱的 Representation
var rep = new Representation();

// 操作 1：实心方形柱（0.3m × 0.3m × 3m）
var solidColumn = new Extrude(
    new Profile(Polygon.Rectangle(0.3, 0.3)),
    3.0,
    Vector3.ZAxis,
    false
)
{ IsVoid = false };

// 操作 2：内部的圆形挖空（直径 0.2m）
var innerVoid = new Extrude(
    new Profile(new Circle(Vector3.Origin, 0.1).ToPolygon(32)),
    3.0,
    Vector3.ZAxis,
    false
)
{ IsVoid = true };

// 注意：挖空的截面圆心在 (0,0)，柱的矩形也以 (0,0) 为中心
// 如果要对齐到柱的中心，两者需要在同一局部坐标空间

rep.SolidOperations.Add(solidColumn);
rep.SolidOperations.Add(innerVoid);
```

当需要将操作放置在不同位置时，使用 `SolidOperation` 所在元素的 `Transform` 属性，或在剖面/路径的坐标体系中预先偏移。

## 8.5 SolidOperationUtils.GetFinalCsgFromSolids()

### 8.5.1 方法签名与职责

`SolidOperationUtils.GetFinalCsgFromSolids()` 是 Elements CSG 管线中最核心的静态方法。它的职责是将一个 `SolidOperation` 列表"编译"为一个精确的 `Csg.Solid` 对象。

```csharp
public static class SolidOperationUtils
{
    public static Csg.Solid GetFinalCsgFromSolids(
        IList<SolidOperation> solidOperations,
        out Csg.Solid consolidatedSolid,
        out List<Csg.Solid> voidSolids
    );
}
```

### 8.5.2 内部处理流程

该方法的执行分为四个阶段：

```
阶段 1：分类
├── 遍历所有 SolidOperation
├── IsVoid == false → 加入实体列表
└── IsVoid == true  → 加入挖空列表

阶段 2：Convert（操作 → Csg.Solid）
├── Extrude  → Profile 三角剖分 + 沿 Direction 拉伸 Extent
├── Sweep    → 沿 Curve 分段扫描，每段构建实体
├── Lamina   → Polygon 三角剖分为薄面
└── ConstructedSolid → 递归处理子操作

阶段 3：Union（合并实体）
├── 将所有非 Void 的 Csg.Solid 做 Union 运算
└── 得到 consolidatedSolid（合并后的正形体）

阶段 4：Subtract（减除挖空）
├── 遍历所有 Void 的 Csg.Solid
├── consolidatedSolid = consolidatedSolid.Subtract(voidSolid)
└── 返回最终的 Csg.Solid
```

### 8.5.3 代码示例：手动调用布尔运算

虽然通常不需要直接调用 `GetFinalCsgFromSolids()`（`Model.AddElement()` 会自动调用），但理解它的工作原理有助于调试：

```csharp
using Elements.Geometry.Solids;

// 创建操作列表
var operations = new List<SolidOperation>
{
    new Extrude(
        new Profile(Polygon.Rectangle(10, 10)),
        0.5,
        Vector3.ZAxis,
        false
    )
    { IsVoid = false },  // 实心楼板

    new Extrude(
        new Profile(new Circle(Vector3.Origin, 1.0).ToPolygon(32)),
        1.0,
        Vector3.ZAxis,
        false
    )
    { IsVoid = true }    // 楼板上的圆洞
};

// 手动执行 CSG 计算
var finalSolid = SolidOperationUtils.GetFinalCsgFromSolids(
    operations,
    out var consolidated,  // Union 后的正形体（本例中就是楼板本身）
    out var voids          // 所有挖空体的列表
);

// finalSolid 就是"带圆洞的楼板"的精确 CSG 实体
```

### 8.5.4 性能考量

布尔运算的计算量随参与实体数量的增加而显著增长。以下是一些优化建议：

- **减少不必要的 SolidOperation**：如果多个实体在空间上不相交，它们仍会被逐一处理。在可能的情况下，先用建模逻辑合并后再创建操作
- **控制 Polyon 的顶点数**：`ToPolygon(64)` 生成 64 边形的圆近似，通常足够。不要默认使用 128 或 256 边的高精度圆——每个顶点都会增加 CSG 的计算量
- **合理使用 ConstructedSolid**：对于有大量子操作的复杂形体，使用 `ConstructedSolid` 将它们封装为独立的 CSG 树节点，可提高计算效率

## 8.6 自定义 CSG Fork

### 8.6.1 Elements 对 Csg.js 的修改

Elements 的核心 CSG 计算引擎是一个**编译为 .NET DLL 的自定义 Fork**，而非原始的 JavaScript `csg.js` 库。这个 Fork 位于 `lib/Csg.dll`，通过 P/Invoke 或 IL 编译集成到 Elements 中。

原始 `csg.js`（由 Evan Wallace 编写）是一个纯 JavaScript 的 CSG 库，被广泛应用于 Three.js 社区。Elements 团队将其移植到 .NET 平台并做了以下关键修改：

| 修改点 | 原始 csg.js | Elements Fork (Csg.dll) |
| --- | --- | --- |
| **平台** | JavaScript（浏览器/Node.js） | .NET IL（跨平台托管代码） |
| **精度** | JS 的 `Number`（IEEE 754 双精度） | 采用 `EPSILON = 1e-5` 的建筑尺度精度 |
| **大坐标处理** | 对建筑尺度的大坐标存在精度损失 | 2.4 版修复了大坐标下的精度问题 |
| **性能** | 单线程 JS 执行 | .NET 优化，支持大型模型 |
| **内存管理** | JS GC | .NET GC + 显式资源释放 |

### 8.6.2 Csg.Solid 的内部表示

原始的 `csg.js` 使用 BSP（Binary Space Partition，二叉空间分割）树来表示实体，面上的每个顶点都存储其法线方向。Elements 的 Fork 保持了这一设计，但加入了以下关键改进：

- **顶点合并**：在 Union/Subtract 操作后，合并距离小于 `EPSILON` 的近乎重合的顶点
- **共面检测**：检测共面的多边形，避免产生极薄的面片导致渲染伪影
- **大坐标归一化**：在处理前将几何数据归一化到局部坐标空间，计算完成后再还原

### 8.6.3 直接使用 Csg.Solid

在某些高级场景中，你可能需要直接创建和操作 `Csg.Solid` 对象：

```csharp
using Elements.Geometry;

// 方法 1：从 Elements Solid 转换
var elementsSolid = Solid.SweptSolid(profile, curve);
var csgSolid = elementsSolid.ToCsg();

// 方法 2：Csg.Solid 自身的布尔运算
var cubeA = Csg.Solid.CreateCube(size: 1.0, center: true);
var cubeB = new Csg.Solid().Translate(0.5, 0.5, 0);
var result = cubeA.Union(cubeB);

// 方法 3：转回 Elements Solid 用于后续操作
var backToElements = new Solid(csgSolid);
```

> **提示**：在大多数情况下，你不需要直接操作 `Csg.Solid`。通过 `SolidOperation` 声明式地描述几何，让 `GetFinalCsgFromSolids()` 自动处理底层 CSG，是更符合 Elements 设计理念的方式。

## 8.7 精度问题与 EPSILON

### 8.7.1 EPSILON 的作用

在浮点数计算中，由于 IEEE 754 的精度限制，完全精确的相等比较是不可靠的。Elements 使用 `Vector3.EPSILON = 1e-5`（即 0.00001 米 = 0.01 毫米）作为所有几何计算中的容差值。

```csharp
// 不要这样比较
if (a.X == b.X) { ... }

// 应该这样比较
if (Math.Abs(a.X - b.X) < Vector3.EPSILON) { ... }

// 或者使用 Elements 提供的方法
if (a.IsAlmostEqualTo(b)) { ... }
```

### 8.7.2 大坐标下的 CSG 精度问题

在建筑尺度的模型中，坐标值经常达到数千甚至数万。例如，一个城市级模型的原点可能设在城市中心，而建筑物的绝对坐标可能是 `(50000, 30000, 0)`。在这样的大坐标下：

- 浮点数的尾数位被高位的整数部分占据，小数部分的精度急剧下降
- CSG 计算中的共面判断、顶点合并等操作可能出现误判

Elements 2.4 版对此做了专项修复。将坐标值提到数万后，CSG 计算仍能保持稳定。

### 8.7.3 实际影响的例子

**不良实践：远处的细节模型**

```csharp
// 在距离原点 100 公里处创建一个精密的 1mm 细节
var farAway = new Vector3(100000, 100000, 0);
var tinyHole = new Circle(farAway, 0.001).ToPolygon(64);
// 这个圆孔可能因为精度问题被 CSG 引擎忽略
```

**正确做法：靠近原点建模，用 Transform 定位**

```csharp
// 在局部坐标 (0, 0, 0) 处创建模型
var localHole = new Circle(Vector3.Origin, 0.001).ToPolygon(64);
// 用元素的 Transform 将它放到远处
var beam = new Beam(...)
{
    Transform = new Transform(100000, 100000, 0)
};
```

### 8.7.4 精度调优建议

| 场景 | 建议 |
| --- | --- |
| 建筑单体 | 原点放在建筑中心附近，坐标范围在 ±100m 内 |
| 城市级模型 | 每个建筑在自己的局部坐标中建模，用 Transform 放到绝对位置 |
| 极细构件（<5mm） | 可能超出 EPSILON 范围，考虑放大建模或用显式面片代替 CSG |
| 两个体素精确贴合 | 保持 1mm 以上的重叠或间距，完全共面可能导致 CSG 伪影 |
| 大量 CSG 操作 | 操作次数越多，累积误差越大；控制操作复杂度 |

## 8.8 ConstructedSolid 构造实体

### 8.8.1 什么是 ConstructedSolid

`ConstructedSolid` 是一种**元操作**（meta-operation）——它本身不定义任何形状参数，而是作为其他 `SolidOperation` 的容器，将它们组合为一个逻辑单元。

```csharp
public class ConstructedSolid : SolidOperation
{
    // 子 SolidOperation 列表
    public IList<SolidOperation> SolidOperations { get; set; }
}
```

### 8.8.2 使用场景

`ConstructedSolid` 的使用场景包括：

1. **封装复杂形体的子结构**：一个有十几个子操作的复杂构件，用 `ConstructedSolid` 封装后作为整体管理
2. **控制 CSG 计算的作用域**：子操作先在 ConstructedSolid 内部完成布尔运算，结果再参与父级的布尔运算
3. **实现分层建模**：模块 A 和模块 B 各自是一个 ConstructedSolid，它们之间再做 Union

### 8.8.3 示例：组合柱

```csharp
// 创建一个复杂的"组合柱"：方形截面 + 内部圆管 + 四角倒角
var constructedSolid = new ConstructedSolid
{
    SolidOperations = new List<SolidOperation>()
};

// 子操作 1：方形柱体
var squareColumn = new Extrude(
    new Profile(Polygon.Rectangle(0.3, 0.3)),
    3.0,
    Vector3.ZAxis,
    false
)
{ IsVoid = false };

// 子操作 2：内部圆形空洞
var innerTube = new Extrude(
    new Profile(new Circle(Vector3.Origin, 0.08).ToPolygon(32)),
    3.0,
    Vector3.ZAxis,
    false
)
{ IsVoid = true };

// 子操作 3：四角倒角（四分之一圆弧，中心在角落，用圆柱减去）
// 为了简化，这里用一个小的方形挖空模拟
var chamfer = new Extrude(
    new Profile(Polygon.Rectangle(0.05, 0.05)),
    3.0,
    Vector3.ZAxis,
    false
)
{ IsVoid = true };

constructedSolid.SolidOperations.Add(squareColumn);
constructedSolid.SolidOperations.Add(innerTube);
constructedSolid.SolidOperations.Add(chamfer);

// 将 ConstructedSolid 作为整体添加到元素的 Representation 中
var columnRep = new Representation();
columnRep.SolidOperations.Add(constructedSolid);
```

### 8.8.4 ConstructedSolid 的 CSG 行为

当 `GetFinalCsgFromSolids()` 遇到 `ConstructedSolid` 时：

```
ConstructedSolid
    │
    ├── 递归调用 GetFinalCsgFromSolids()
    │      在其子操作列表上执行 Union → Subtract
    │      ↓
    │  得到一个中间 Csg.Solid（子操作的结果）
    │
    └── 将这个中间 Csg.Solid 作为普通操作的结果
        参与父级的 Union 或 Subtract 运算
```

这个递归特性使得 `ConstructedSolid` 可以嵌套任意深度，实现复杂的分层布尔运算。

## 8.9 实战示例

### 8.9.1 带门洞的墙

这个示例创建一个具有门洞和窗洞的完整墙体：

```csharp
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;

var model = new Model();

// --- 墙体 ---
var wallProfile = new Profile(Polygon.Rectangle(0.2, 3.0));
var wall = new Wall(
    new Line(new Vector3(0, 0, 0), new Vector3(6, 0, 0)),
    wallProfile,
    3.0
)
{ Name = "南向外墙" };
model.AddElement(wall);

// --- 门洞 ---
var doorOpening = new Opening(
    Polygon.Rectangle(1.0, 2.1),    // 1m 宽 × 2.1m 高
    0.3,                             // 深度（略大于墙厚 0.2m）
    new Transform(1.5, 0, 0)        // 距离墙起点 1.5m
);
model.AddElement(doorOpening);

// --- 窗洞 ---
var windowOpening = new Opening(
    Polygon.Rectangle(1.2, 1.5),    // 1.2m 宽 × 1.5m 高
    0.3,                              // 深度
    new Transform(4.0, 0, 1.0)      // 距离墙起点 4m，窗台高度 1m
);
model.AddElement(windowOpening);

// 导出
model.ToGlTF("wall_with_openings.glb");
```

上述代码中，`Opening` 元素内部会创建 `IsVoid = true` 的 `Extrude`，通过 CSG 布尔运算从墙体实体中切除门洞和窗洞。

### 8.9.2 带天窗的楼板

创建一个带矩形天窗和圆形天窗的楼板：

```csharp
var model = new Model();

// --- 楼板：8m × 6m，厚 0.2m ---
var floor = new Floor(
    Polygon.Rectangle(8.0, 6.0),
    0.2
)
{ Name = "顶层楼板" };
model.AddElement(floor);

// --- 矩形天窗开洞 1：2m × 1.5m ---
var skylight1 = new Opening(
    Polygon.Rectangle(2.0, 1.5),
    0.3,
    new Transform(2.5, 3.0, 0.05)
);
model.AddElement(skylight1);

// --- 矩形天窗开洞 2：2m × 1.5m ---
var skylight2 = new Opening(
    Polygon.Rectangle(2.0, 1.5),
    0.3,
    new Transform(5.5, 3.0, 0.05)
);
model.AddElement(skylight2);

// --- 圆形天窗开洞 ---
var skylight3 = new Opening(
    new Circle(Vector3.Origin, 0.8).ToPolygon(32),
    0.3,
    new Transform(4.0, 1.5, 0.05)
);
model.AddElement(skylight3);

model.ToGlTF("floor_with_skylights.glb");
```

### 8.9.3 空心柱

创建一个方形截面的空心柱（外部是实心方柱，内部是圆形空心，可用作设备竖井）：

```csharp
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;

var model = new Model();

// 定义空心柱：外方内圆
// 我们需要手动构建 Representation，因为标准 Column 只支持实心
var hollowColumn = new Column(
    new Vector3(5, 5, 0),      // 柱底位置
    4.0,                       // 高度 4m
    new Profile(Polygon.Rectangle(0.5, 0.5)),  // 外部 500mm × 500mm
    0.0                        // 底部偏移
)
{ Name = "设备竖井" };

// 手动添加内部挖空操作
// 注意：需要在构造后修改 Representation
hollowColumn.Representation = new Representation();

// 外部实心方柱
hollowColumn.Representation.SolidOperations.Add(
    new Extrude(
        new Profile(Polygon.Rectangle(0.5, 0.5)),
        4.0,
        Vector3.ZAxis,
        false
    )
    { IsVoid = false }
);

// 内部圆形挖空（直径 0.3m），偏移到方柱中心
var innerVoidProfile = new Profile(
    new Circle(Vector3.Origin, 0.15).ToPolygon(32)
);

hollowColumn.Representation.SolidOperations.Add(
    new Extrude(
        innerVoidProfile,
        4.0,
        Vector3.ZAxis,
        false
    )
    { IsVoid = true }
);

model.AddElement(hollowColumn);
model.ToGlTF("hollow_column.glb");
```

### 8.9.4 壁龛墙（Wall with Niche）

创建一个带有装饰壁龛的墙——墙上有多个凹槽但不贯穿：

```csharp
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;

var model = new Model();

// --- 墙体：5m 长，0.3m 厚，3m 高 ---
var wallProfile = new Profile(Polygon.Rectangle(0.3, 3.0));
var wall = new Wall(
    new Line(new Vector3(0, 0, 0), new Vector3(5, 0, 0)),
    wallProfile,
    3.0
)
{ Name = "装饰壁龛墙" };
model.AddElement(wall);

// --- 创建壁龛（不贯穿的挖空）---
// 三个等距的壁龛，深度 0.15m（墙的一半深），不贯穿
for (int i = 0; i < 3; i++)
{
    var nicheX = 1.0 + i * 1.5;  // 间距 1.5m
    var nicheProfile = Polygon.Rectangle(0.6, 0.8);  // 0.6m 宽 × 0.8m 高

    var niche = new Opening(
        nicheProfile,
        0.15,                           // 深度 0.15m，不贯穿 0.3m 的墙
        new Transform(nicheX, -0.05, 1.2)  // 在前面板上，距地 1.2m
    );
    model.AddElement(niche);
}

model.ToGlTF("wall_with_niches.glb");
```

### 8.9.5 带弧形窗的圆形建筑

综合运用 Extrude 和 Sweep，创建一个圆柱形塔楼，并在弧形立面上开窗：

```csharp
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;

var model = new Model();

// --- 圆柱形塔身：半径 3m，高 12m ---
var towerProfile = new Profile(
    new Circle(Vector3.Origin, 3.0).ToPolygon(64)
);

var towerExtrude = new Extrude(
    towerProfile,
    12.0,
    Vector3.ZAxis,
    false
);

// 手动创建元素
var towerBody = new Mass(towerProfile, 12.0)
{ Name = "圆形塔楼" };
model.AddElement(towerBody);

// --- 弧形窗（多排）---
var windowWidth = 1.2;           // 窗宽（弧长方向）
var windowHeight = 2.0;          // 窗高
var windowArc = 1.2 / 3.0;       // 窗弧对应的弧度（弧长 / 半径）
var radius = 2.8;                // 窗的位置半径（略小于塔的 3m）

for (int floor = 0; floor < 5; floor++)
{
    var height = 1.5 + floor * 2.5;    // 第 0 层距地 1.5m

    for (int i = 0; i < 8; i++)
    {
        var startAngle = i * Math.PI / 4;  // 8 扇窗均匀分布 360°

        // 创建弧形窗的扫掠路径
        var windowArcPath = new Arc(
            new Vector3(0, 0, height),
            radius,
            startAngle,                 // 起始角
            startAngle + windowArc      // 终止角
        );

        // 窗的截面轮廓（矩形）
        var windowSection = new Profile(
            Polygon.Rectangle(0.3, windowHeight)  // 深 0.3m，高 2m
        );

        // 创建弧形窗的 Sweep（IsVoid = true）
        var windowVoid = new Sweep(
            windowSection,
            windowArcPath,
            0,
            0
        )
        { IsVoid = true };

        // 将挖空 Sweep 直接添加到塔身的 Representation
        towerBody.Representation.SolidOperations.Add(windowVoid);
    }
}

// 重新计算几何
towerBody.UpdateBoundsAndComputeSolid();

model.ToGlTF("circular_tower_with_windows.glb");
```

### 8.9.6 复合型楼梯（ConstructedSolid 实战）

使用 `ConstructedSolid` 封装楼梯的梯段、平台和扶手为一个整体：

```csharp
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;

var model = new Model();

// --- 创建楼梯的 ConstructedSolid ---
var staircase = new ConstructedSolid
{
    SolidOperations = new List<SolidOperation>()
};

// 子操作 1：楼梯侧板（左）
var leftStringer = new Extrude(
    new Profile(Polygon.Rectangle(0.15, 1.0)),
    6.0,                                    // 6m 长的侧板
    new Vector3(1, 0, 1).Unitized(),        // 沿 45° 斜向上
    false
)
{ IsVoid = false };

// 子操作 2：楼梯侧板（右）
var rightStringer = new Extrude(
    new Profile(Polygon.Rectangle(0.15, 1.0)),
    6.0,
    new Vector3(1, 0, 1).Unitized(),
    false
)
{ IsVoid = false };

// 子操作 3：踏步（简化为一个整体斜面）
var treadSlab = new Extrude(
    new Profile(Polygon.Rectangle(1.2, 1.0)),
    6.0,
    new Vector3(1, 0, 1).Unitized(),
    false
)
{ IsVoid = false };

// 子操作 4：扶手（用 Sweep 沿着楼梯扶手线）
var handrailPath = new Line(
    new Vector3(0, -0.65, 0.9),
    new Vector3(6, -0.65, 6.9)
);

var handrailProfile = new Profile(
    new Circle(Vector3.Origin, 0.04).ToPolygon(16)
);

var handrail = new Sweep(
    handrailProfile,
    handrailPath,
    0.1,                     // 起始退距
    0.1                      // 终止退距
)
{ IsVoid = false };

staircase.SolidOperations.Add(leftStringer);
staircase.SolidOperations.Add(rightStringer);
staircase.SolidOperations.Add(treadSlab);
staircase.SolidOperations.Add(handrail);

// 将 ConstructedSolid 添加到元素
var stairElement = new Mass(
    new Profile(Polygon.Rectangle(1.3, 6.0)),
    4.0
)
{ Name = "楼梯-ConstructedSolid", };
stairElement.Representation = new Representation();
stairElement.Representation.SolidOperations.Add(staircase);

model.AddElement(stairElement);
model.ToGlTF("staircase_constructed.glb");
```

## 8.10 小结

本章深入讲解了 Elements 的 CSG 布尔运算引擎和 SolidOperation 体系：

- **CSG（构造实体几何）** 是一种声明式的建模范式，Elements 通过它实现跨平台的精确几何计算
- **SolidOperation** 有四个子类：Extrude（拉伸）、Sweep（扫描）、Lamina（层板）、ConstructedSolid（构造实体），各有不同的参数和适用场景
- **IsVoid** 是关键的布尔开关，将操作标记为"挖空"，在 CSG 计算中执行 Subtract
- **多个操作**可以组合在一个 Representation 中，先 Union 所有实体，再 Subtract 所有挖空
- **GetFinalCsgFromSolids()** 是 CSG 管线的入口，自动处理分类 → 转换 → Union → Subtract 的完整流程
- **自定义 CSG Fork** 针对建筑尺度的精度做了专项优化，EPSILON = 1e-5 是几何计算的基准容差
- **ConstructedSolid** 支持嵌套的子操作组合，实现复杂的层次化布尔运算

下一章将讲解 Elements 的材质系统与光照渲染，为模型赋予真实的视觉表现。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="https://znlgis.github.io/3d/elements/第08章-CSG布尔运算与实体操作/第07章-空间开洞与地形/">← 上一章</a>
  <a href="https://znlgis.github.io/3d/elements/第08章-CSG布尔运算与实体操作/">目录</a>
  <a href="https://znlgis.github.io/3d/elements/第08章-CSG布尔运算与实体操作/第09章-材质光照与渲染/">下一章 →</a>
</div>
