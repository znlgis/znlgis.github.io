---
layout: default
title: 第13章：MEP 机电系统
---

# 第13章：MEP 机电系统

## 13.1 MEP 概述

Elements.MEP 是 Hypar Elements 生态中专注于**机电管道（MEP，Mechanical / Electrical / Plumbing）系统**的独立扩展库，以独立 NuGet 包 `Hypar.Elements.MEP` 发布。它目前处于 **beta** 阶段，提供了从管件建模、管网拓扑构建、流量分配到压力损失计算、再到自适应网格管线寻路的完整工具链——所有这一切都不依赖任何商业 BIM 软件或几何内核。

核心能力一览：

| 能力 | 说明 |
| --- | --- |
| 管件体系 | 弯头、三通、变径、四通、分水器、直接等 10+ 种标准管件 |
| 管网拓扑 | 基于分支树（FittingTree）的管网数据结构，支持干管-支管层级关系 |
| 流量分配 | 按管网拓扑自动将总流量分配到各分支末端 |
| 压力计算 | Hazen-Williams 公式计算沿程压力损失 + 管件等效长度法 |
| 管线寻路 | 基于 AdaptiveGrid 的自适应网格 + Dijkstra 最短路径路由 |
| 障碍回避 | 支持定义障碍物（Obstacle），路由自动绕行 |

### 13.1.1 安装

```powershell
dotnet add package Hypar.Elements.MEP
```

MEP 项目依赖核心 `Hypar.Elements` 包，安装 MEP 包时会自动引入核心库。

### 13.1.2 命名空间

Elements.MEP 的类型分布在两个核心命名空间中：

```csharp
using Elements.Fittings;    // 管件、管网树、流量/压力计算器
using Elements.Flow;        // 流体分析：流量树、管段、连接关系
using Elements.Spatial.AdaptiveGrid;  // 自适应网格与管线寻路
```

---

## 13.2 Fitting 管件体系

Elements.MEP 的管件类型体系根植于两个抽象基类：`ComponentBase`（组件基类）和 `Fitting`（管件基类）。每种管件通过 `Port`（端口）与相邻管件连接，端口包含位置 `Position`、方向 `Direction`、直径 `Diameter` 以及流量/压力等流体属性。

### 13.2.1 类型层级

```
ComponentBase (抽象基类)
├── Fitting (抽象管件基类)
│   ├── Elbow          弯头
│   ├── Wye            三通 / Y形三通
│   ├── Cross          四通
│   ├── Coupler        直接（连接器）
│   │   ├── ExpansionSocket    伸缩节
│   │   └── InspectionOpening  检查口
│   ├── Reducer        变径
│   ├── Manifold       分水器
│   └── Terminal       末端（水源接入点 / 用水点）
├── StraightSegment    直管段
└── Assembly           装配体（多个管件的组合容器）
```

每个组件都维护 `TrunkSideComponent`（干管侧）和 `BranchSideComponents`（支管侧）两个引用，从而构成树状管网拓扑——干管侧指向源端（水泵/市政接口），支管侧指向用水终端。

### 13.2.2 Port 端口

`Port` 是所有管件之间连接的桥梁：

```csharp
public class Port
{
    public Vector3 Position { get; set; }   // 端口位置
    public Vector3 Direction { get; set; }  // 流向（向外为正）
    public double Diameter { get; set; }    // 端口直径
    public Port.FlowData Flow { get; set; } // 流量/压力数据
}
```

端口的方向约定为**从管件内部指向外部**，相邻两个管件通过位置重叠、方向相反的端口形成连接。

### 13.2.3 Elbow 弯头

弯头用于改变管道走向，支持任意角度（最常用 90° 和 45°）：

```csharp
// 在原点创建 90° 弯头：X 方向进，Y 方向出
var elbow = new Elbow(
    position: new Vector3(1, 0, 0),         // 弯头中心位置
    startDirection: new Vector3(1, 0, 0),   // 流入方向
    endDirection: new Vector3(0, 1, 0),     // 流出方向
    sideLength: 0.1,                         // 每侧直管段长度
    diameter: 0.05,                          // 管道直径
    bendRadius: 0.03                         // 弯曲半径（0 表示直角）
);
```

弯头的核心属性：

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `Start` | Port | 流入端口 |
| `End` | Port | 流出端口 |
| `Angle` | double | 偏转角度（度） |
| `BendRadius` | double | 弯曲半径，0 表示直角弯头 |
| `Diameter` | double | 管道直径 |

### 13.2.4 Wye 三通 / Y形三通

在 Elements.MEP 中，`Wye` 类同时承担**正三通（Tee）和 Y 形三通**的角色。它有三个端口：`Trunk`（干管端）、`MainBranch`（主支管端）、`SideBranch`（侧支管端）。

```csharp
// 创建 Y 形三通（侧支管 45° 角）
var wyeSettings = new WyeSettings(
    trunkDiameter: 0.1,
    mainDiameter: 0.08,
    branchDiameter: 0.05,
    trunkDistance: 0.06,
    mainDistance: 0.1,
    branchDistance: 0.1
);

var wye = new Wye(
    position: new Vector3(2, 0, 0),
    mainDirection: new Vector3(1, 0, 0),     // 主支管方向
    branchDirection: new Vector3(0, 1, 0),   // 侧支管方向
    wyeSettings: wyeSettings,
    material: null                             // 使用默认材质
);
```

`WyeSettings` 参数详解：

| 参数 | 说明 |
| --- | --- |
| `trunkDiameter` | 干管端直径 |
| `mainDiameter` | 主支管端直径 |
| `branchDiameter` | 侧支管端直径 |
| `trunkDistance` | 干管端到中心的距离 |
| `mainDistance` | 主支管端到中心的距离 |
| `branchDistance` | 侧支管端到中心的距离 |
| `allowedBranchAngles` | 允许的支管角度（默认 `{45, 90, 180}`） |

### 13.2.5 Cross 四通

四通用于十字交叉的管道连接，有四个端口：`Trunk`、`BranchA`、`BranchB`、`BranchC`：

```csharp
var cross = new Cross(
    position: new Vector3(3, 0, 0),
    trunkDirection: new Vector3(1, 0, 0),
    mainDirection: new Vector3(-1, 0, 0),
    branchADirection: new Vector3(0, 1, 0),
    branchBDirection: new Vector3(0, -1, 0),
    trunkDiameter: 0.1,
    branchADiameter: 0.05,
    branchBDiameter: 0.05,
    trunkDistance: 0.08,
    branchADistance: 0.08,
    branchBDistance: 0.08
);
```

### 13.2.6 Coupler 直接

直接（Coupler）用于连接两根同直径或异径的直管段，也包含特种连接件如伸缩节和检查口：

```csharp
// 创建直管连接器
var coupler = new Coupler(
    type: "StraightCoupler",
    position: new Vector3(5, 0, 0),
    direction: new Vector3(1, 0, 0),
    length: 0.05,
    diameter: 0.1
);

// 伸缩节
var expansionSocket = new ExpansionSocket(
    position: new Vector3(6, 0, 0),
    direction: new Vector3(1, 0, 0),
    length: 0.08,
    diameter: 0.1
);

// 检查口
var inspectionOpening = new InspectionOpening(
    position: new Vector3(7, 0, 0),
    direction: new Vector3(1, 0, 0),
    length: 0.06,
    diameter: 0.1
);
```

### 13.2.7 Reducer 变径

变径用于连接不同直径的管道，实现管径缩小或放大：

```csharp
// 偏心变径（小管端偏移）
var reducer = new Reducer(
    position: new Vector3(4, 0, 0),
    trunkDirection: new Vector3(1, 0, 0),
    branchDirection: new Vector3(1, 0, 0),
    trunkDiameter: 0.1,
    branchDiameter: 0.05,
    length: 0.15,
    offset: 0.02     // 偏心距，0 表示同心变径
);
```

### 13.2.8 Manifold 分水器

分水器是一进多出的分配装置，常用于地暖、给水系统的末端分配：

```csharp
var manifold = new Manifold(
    position: new Vector3(5, 2, 0),
    trunkDirection: new Vector3(1, 0, 0),
    trunkDiameter: 0.08,
    branchDirections: new[] {
        new Vector3(0, 1, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 1, 0)
    },
    branchDiameter: 0.03,
    trunkDistance: 0.1,
    branchDistances: new[] { 0.05, 0.08, 0.11 }
);
```

### 13.2.9 Terminal 末端

末端是管网的起点（接入市政管网）或终点（用水器具接口），与 `Flow.Node`（流量节点）关联：

```csharp
// 用水终端——例如水龙头接口
var terminal = new Terminal(
    position: new Vector3(10, 0, 0),
    direction: new Vector3(1, 0, 0),
    diameter: 0.03,
    flowNode: new Leaf(g: 0.0005)  // 需求流量 0.0005 m³/s
);

// 水源接入端——例如市政供水接口
var trunkTerminal = new Terminal(
    position: new Vector3(0, 0, 0),
    direction: new Vector3(1, 0, 0),
    diameter: 0.1,
    flowNode: new Trunk()   // 管网干管起点
);
```

### 13.2.10 StraightSegment 直管段

直管段表示两根管件之间的平直管道，由起点端口和终点端口定义：

```csharp
// 连接两个端口之间的直管段
var straightSegment = new StraightSegment(
    wallThickness: 2,                      // 壁厚（用于结构计算）
    end: elbow1.End,                        // 干管侧（上游）端口
    start: elbow2.Start,                    // 支管侧（下游）端口
    material: BuiltInMaterials.Steel         // 管道材质
);
```

---

## 13.3 FittingTree 管件树

`FittingTree` 是整个 MEP 系统的核心数据结构——它将零散的管件对象组织为一棵有根、有向的**分支树**，并通过部分类（partial class）按职责拆分代码。

### 13.3.1 部分类拆分

FittingTree 通过四个 partial 文件将不同关注点分离：

| 文件 | 职责 |
| --- | --- |
| `FittingTree.cs` | 管网主体逻辑：增删管件、遍历、序列化 |
| `FittingTree.Builder.cs` | 管网构建器：从 `Flow.Tree` 构建 FittingTree |
| `FittingTree.Calculations.cs` | 水力计算：流量分配、压力差传播、静态压力 |
| `FittingTree.Utils.cs` | 工具方法：管件查找、连通性检查、类型过滤 |
| `FittingTree.Visualization.cs` | 可视化：生成分析网格和调试元素 |

### 13.3.2 构建管网树

创建管件树的典型流程：

```csharp
// 1. 创建空管件树
var fittingTree = new FittingTree();

// 2. 创建水源接入端（干管起点）
var trunkTerminal = new Terminal(
    new Vector3(0, 0, 0),
    new Vector3(1, 0, 0),
    0.1,  // DN100
    new Trunk()
);
fittingTree.Add(trunkTerminal);

// 3. 从干管末端开始依次连接管件
// ... 添加直管段、弯头、三通，通过 TrunkSideComponent / BranchSideComponents 建立拓扑

// 4. 更新所有管件的几何表示
fittingTree.UpdateRepresentations();
```

### 13.3.3 关键方法

| 方法 | 说明 |
| --- | --- |
| `Add(ComponentBase)` | 添加管件到树中 |
| `AllComponents` | 获取树中所有组件 |
| `FittingsOfType<T>()` | 按类型查询管件 |
| `GetComponentsOfSection(Section)` | 按管段查询组件 |
| `AssignPortPressuresFromPressureDiffs(...)` | 将压力差分配到各端口 |
| `UpdateRepresentations()` | 批量更新所有管件的几何表示 |

---

## 13.4 Flow / Tree / Section / Connection 流体分析

Elements.MEP 的流体分析层定义在 `Elements.Flow` 命名空间中，与 `Elements.Fittings` 层解耦。它提供了流量树的抽象数据结构，描述了管网中流体的流动路径。

### 13.4.1 核心概念

```
Flow.Tree（流量树）
├── Node（流量节点）
│   ├── Trunk（干管节点——水源端，可设置 FixedPressure 固定压力）
│   └── Leaf（叶节点——用水终端，有需求流量 g）
├── Connection（连接边——表示两个节点间的管道连接，有直径、长度）
└── Section（管段——无分支的连续管道片段）
```

### 13.4.2 创建流量树

```csharp
using Elements.Flow;

// 创建流量节点
var trunk = new Trunk("供水干管")
{
    FixedPressure = 300000  // 300 kPa 供水压力
};

var leaf1 = new Leaf("卫生间", g: 0.0005);   // 0.5 L/s
var leaf2 = new Leaf("厨房", g: 0.0003);     // 0.3 L/s
var leaf3 = new Leaf("阳台", g: 0.0002);     // 0.2 L/s

// 创建连接
var conn1 = new Connection(trunk, leaf1, 0.1, 10.0);  // DN100, 10m
var conn2 = new Connection(trunk, leaf2, 0.08, 15.0); // DN80, 15m
var conn3 = new Connection(trunk, leaf3, 0.05, 8.0);  // DN50, 8m

// 构建流量树
var flowTree = new Tree(new[] { conn1, conn2, conn3 });
```

### 13.4.3 从 Flow.Tree 构建 FittingTree

`FittingTree.Builder` 提供了从抽象流量树生成具体管件树的方法：

```csharp
// 使用 Builder 从流量树构建管件树
var builder = new FittingTreeBuilder(flowTree);
var fittingTree = builder.Build();

// Build 过程会自动：
// 1. 为每个 Connection 创建 StraightSegment 直管段
// 2. 在每个分支节点处创建 Wye 三通
// 3. 在每个 Leaf 处创建 Terminal 末端
// 4. 在 Trunk 处创建水源接入 Terminal
// 5. 建立完整的 TrunkSideComponent / BranchSideComponents 关系
```

---

## 13.5 FlowCalculator 流量计算器

`FlowCalculator` 是一个抽象基类，负责按管网拓扑为每个管件端口分配流量值。Elements.MEP 提供了多种具体实现。

### 13.5.1 流量分配策略

```csharp
public abstract class FlowCalculator
{
    // 为树中所有管件分配流量参数
    public abstract List<FittingError> AssignFlowCalcs(FittingTree tree);

    // 流量更新策略——用于根据压力反算调整末端流量
    public IFlowUpdateStrategy FlowUpdateStrategy { get; set; }

    // 更新叶节点流量
    public bool UpdateLeafFlow(FittingTree tree);
}
```

### 13.5.2 FullFlowCalculator 全流量计算

最简单的流量计算器——将干管端的总流量简单均分到各支管路径：

```csharp
// 全流量计算——假设每条支管都获得干管全流量
var fullFlowCalc = new FullFlowCalculator();
var errors = fullFlowCalc.AssignFlowCalcs(fittingTree);

if (errors.Count > 0)
{
    foreach (var err in errors)
    {
        Console.WriteLine($"流量分配错误: {err.Message}");
    }
}
```

### 13.5.3 RemoteAreaFlowCalculator 远程面积法

这是消防喷淋系统中常用的流量分配方法——按最不利点的覆盖面积分配流量：

```csharp
// 远程面积法——常用于消防喷淋系统水力计算
var remoteAreaCalc = new RemoteAreaFlowCalculator(
    remoteArea: 150.0,     // 最不利作用面积 (m²)
    density: 0.004         // 喷水密度 (m³/s·m²)
);
var errors = remoteAreaCalc.AssignFlowCalcs(fittingTree);
```

### 13.5.4 FlowUpdateFromPressureStrategy 压力反算策略

在完成一轮压力计算后，可以根据压力结果反算调整末端流量：

```csharp
// 从压力反算更新流量
var updateStrategy = new FlowUpdateFromPressureStrategy(
    pressureCalculator: new HazenWilliamsFullFlow(),
    targetPressure: 100000,   // 目标末端压力 (Pa)
    tolerance: 0.01           // 收敛容差
);
flowCalc.FlowUpdateStrategy = updateStrategy;
flowCalc.UpdateLeafFlow(fittingTree);
```

---

## 13.6 PressureCalculator 压力计算器

`PressureCalculator` 是抽象基类，通过**访问者模式**为每种管件类型计算压力损失。其核心方法是 `UpdatePressureCalcs`，遍历树中所有组件，计算各端口间的压力差，并沿管段累加到终端。

### 13.6.1 抽象方法一览

```csharp
public abstract class PressureCalculator
{
    public double TrunkStaticPressure { get; set; } = 0;

    // 整体执行压力计算
    public List<FittingError> UpdatePressureCalcs(FittingTree n);

    // 各管件类型的压力计算
    public abstract PressureCalculationSegment PressureCalcDataForPipe(StraightSegment ps);
    public abstract PressureCalculationTerminal PressureCalcDataForTerminal(Terminal terminal);
    public abstract PressureCalculationCoupler PressureCalcDataForCoupler(Coupler coupler);
    public abstract PressureCalculationReducer PressureCalcDataForReducer(Reducer reducer);
    public abstract PressureCalculationElbow PressureCalcDataForElbow(Elbow elbow);
    public abstract PressureCalculationWye PressureCalcDataForWye(Wye wye, double? mainFlow);
    public abstract PressureCalculationCross PressureCalcDataForCross(Cross cross);
    public abstract PressureCalculationManifold PressureCalcDataForManifold(Manifold manifold);
}
```

### 13.6.2 Hazen-Williams 公式

`HazenWilliamsFullFlow` 是 PressureCalculator 的默认实现，使用**海曾-威廉姆斯公式**计算管道摩擦阻力损失：

$$
h_f = \frac{10.67 \times Q^{1.852}}{C^{1.852} \times d^{4.87}}
$$

其中：
- $h_f$：每米管道的摩擦水头损失（米水柱/m）
- $Q$：流量（m³/s）
- $C$：管道粗糙系数（铜管≈130，PVC≈150，钢管≈100）
- $d$：管道内径（m）

压力损失（帕斯卡）由水头损失换算：
$$
\Delta P = \rho g \times h_f = 9810 \times h_f \ \text{(Pa/m)}
$$

### 13.6.3 等效长度法

对于管件（弯头、三通、变径等），`HazenWilliamsFullFlow` 采用**等效长度法**——将管件的局部阻力转换为等摩擦损失的直管段长度：

```csharp
// 弯头等效长度查找
double equivalentLength = EquivalentLength.OfFitting(elbow, C: 130);
// 90° 弯头 DN100 的等效长度约为 2m（具体取值依据标准表）
```

### 13.6.4 完整压力计算示例

```csharp
// 1. 创建 Hazen-Williams 计算器（铜管粗糙系数 130）
var pressureCalc = new HazenWilliamsFullFlow(cCoefficient: 130);
pressureCalc.TrunkStaticPressure = 300000;  // 干管端供水压力 300 kPa

// 2. 执行压力计算
var errors = pressureCalc.UpdatePressureCalcs(fittingTree);

// 3. 查看各末端压力
foreach (var terminal in fittingTree.FittingsOfType<Terminal>())
{
    if (terminal.FlowNode is Leaf leaf)
    {
        var staticPressure = terminal.Port.Flow.StaticPressure;
        Console.WriteLine($"{leaf.Name}: 末端压力 = {staticPressure:F0} Pa");
    }
}

// 4. 查看管段压力损失
foreach (var segment in fittingTree.FittingsOfType<StraightSegment>())
{
    var pd = segment.PressureCalculations as PressureCalculationSegment;
    if (pd != null)
    {
        Console.WriteLine($"管段 {pd.Flow * 1000:F2} L/s: 压力损失 = {pd.PipeLoss:F0} Pa/m");
    }
}
```

---

## 13.7 AdaptiveGrid + AdaptiveGraphRouting 管线寻路

当管网路径尚未确定时，Elements.MEP 提供了基于自适应网格图形（AdaptiveGrid）的自动寻路能力。`AdaptiveGraphRouting` 使用 **Dijkstra 最短路径算法**在网格中搜索从起点到终点的最优管道路径，同时支持障碍物回避、途经点约束和权重修改器。

### 13.7.1 AdaptiveGrid 自适应网格

`AdaptiveGrid` 是一个类似图的顶点-边结构，它的平面区域通过垂直边连接，形成三维可路由空间：

```csharp
using Elements.Spatial.AdaptiveGrid;

// 创建自适应网格
var grid = new AdaptiveGrid(new Transform());

// 从多边形添加平面区域
grid.AddFromPolygon(
    new Polygon(new[] {
        new Vector3(0, 0, 0),
        new Vector3(10, 0, 0),
        new Vector3(10, 8, 0),
        new Vector3(0, 8, 0)
    }),
    new List<Vector3>()  // 无额外分割点
);

// 从包围盒添加三维区域（带分割点）
var bbox = new BBox3(new Vector3(0, 0, 0), new Vector3(10, 8, 3));
grid.AddFromBbox(bbox, new List<Vector3> {
    new Vector3(5, 4, 0),   // 中心分割点
});
```

### 13.7.2 障碍物定义

```csharp
// 定义柱体障碍物
var obstacle = new Obstacle(
    new Polygon(new[] {
        new Vector3(3, 3, 0),
        new Vector3(4, 3, 0),
        new Vector3(4, 4, 0),
        new Vector3(3, 4, 0)
    }),
    height: 3.0
);

// 从网格中减去障碍物
grid.SubtractObstacle(obstacle);
```

### 13.7.3 路由配置与权重修改器

```csharp
var config = new RoutingConfiguration
{
    // 路由提示线——优先沿此线布管
    HintLines = new List<Polyline> {
        new Polyline(new Vector3(0, 2, 0), new Vector3(10, 2, 0))
    }
};

// 创建路由器
var routing = new AdaptiveGraphRouting(grid, config);

// 添加权重修改器——自定义通过某些边的代价
routing.AddRoutingFilter((start, end, edge) =>
{
    // 偏向沿 X 轴方向的边
    double bonus = 0;
    var direction = (end - start).Unitized();
    if (Math.Abs(direction.Dot(Vector3.XAxis)) > 0.9)
    {
        bonus = -0.5;  // 减少代价，优先选择
    }
    return bonus;
});
```

### 13.7.4 最短路径搜索

```csharp
// 定义起点和终点
var startPoints = new List<Vector3> { new Vector3(0, 1, 0.5) };
var endPoints = new List<Vector3> { new Vector3(9, 6, 0.5) };

// 构建最短路径网络
var network = routing.BuildSimpleNetwork(
    startPoints,
    endPoints,
    new List<Vector3>()  // 无中间途经点
);

// 或使用 Dijkstra 最短路径
ulong startVertex, endVertex;
grid.TryGetVertexIndex(startPoints[0], out startVertex);
grid.TryGetVertexIndex(endPoints[0], out endVertex);

var edges = new Dictionary<ulong, AdaptiveGraphRouting.EdgeInfo>();
Dictionary<ulong, double> distances;
routing.ShortestPathDijkstra(startVertex, edges, out distances, endVertex);

// 反向追踪路径
var path = new List<Vector3>();
var current = endVertex;
while (current != startVertex)
{
    path.Add(/* 顶点坐标 */);
    // 沿前驱顶点回溯
}
path.Reverse();
```

### 13.7.5 FittingTreeRouting 集成路由

`FittingTreeRouting` 将 AdaptiveGrid 路由结果直接转换为管件树：

```csharp
var fittingTreeRouting = new FittingTreeRouting(
    grid,
    config,
    flowTree,           // 流量树
    fittingTree         // 要填充的管件树
);

// 执行路由——为所有连接创建最优路径上的直管段和三通
fittingTreeRouting.Route();
```

---

## 13.8 实战示例：供水管网建模与分析

下面构建一个完整的实例：从定义流量需求到生成管件模型、计算流量分配和压力损失。

### 13.8.1 场景设定

一栋小型建筑的卫生间供水管网：

```
市政接口 (Trunk, 300kPa, DN100)
  │
  ├─ 干管 (DN100, 12m)
  │
  ├─ 三通1 (DN100→DN50, 去卫生间A)
  │   └─ 末端A (淋浴, 0.5L/s, DN25, 8m)
  │
  ├─ 三通2 (DN80→DN50, 去厨房)
  │   └─ 末端B (水槽, 0.3L/s, DN25, 6m)
  │
  └─ 末端C (总干管末端, 马桶, 0.2L/s, DN25, 4m)
```

### 13.8.2 完整代码

```csharp
using Elements;
using Elements.Fittings;
using Elements.Flow;
using Elements.Geometry;
using Elements.Geometry.Solids;

// ===== 1. 定义流量节点 =====
var trunk = new Trunk("市政供水")
{
    FixedPressure = 300000  // 300 kPa
};

var leafShower = new Leaf("淋浴间", g: 0.0005);   // 0.5 L/s
var leafSink = new Leaf("厨房水槽", g: 0.0003);   // 0.3 L/s
var leafToilet = new Leaf("马桶", g: 0.0002);      // 0.2 L/s

// ===== 2. 创建流量树 =====
var connections = new List<Connection>
{
    new Connection(trunk, leafShower, 0.1, 12.0),   // DN100, 12m (干管)
    new Connection(trunk, leafSink, 0.08, 6.0),     // DN80, 6m (去厨房)
    new Connection(trunk, leafToilet, 0.05, 4.0)    // DN50, 4m (干管末端)
};

var flowTree = new Tree(connections);

// ===== 3. 从流量树构建管件树 =====
var fittingTree = new FittingTree();

// 水源接入端
var trunkTerminal = new Terminal(
    new Vector3(0, 0, 0),
    new Vector3(1, 0, 0),
    0.1,
    trunk
);
fittingTree.Add(trunkTerminal);

// 干管直管段 (从水源到第一个三通)
var mainPipe1 = new StraightSegment(
    wallThickness: 3,
    end: trunkTerminal.Port,
    start: new Port(new Vector3(4, 0, 0), new Vector3(1, 0, 0), 0.1),
    material: BuiltInMaterials.Steel
);
fittingTree.Add(mainPipe1);

// 三通1 (DN100 → DN50 去淋浴间)
var wyeSettings1 = new WyeSettings(
    trunkDiameter: 0.1,
    mainDiameter: 0.08,
    branchDiameter: 0.05,
    trunkDistance: 0.06,
    mainDistance: 0.1,
    branchDistance: 0.1
);
var wye1 = new Wye(
    new Vector3(4, 0, 0),
    new Vector3(1, 0, 0),    // 干管继续方向
    new Vector3(0, 1, 0),    // 支管去淋浴间
    wyeSettings1,
    BuiltInMaterials.Steel
);
fittingTree.Add(wye1);

// 建立干管与三通的连接关系
mainPipe1.BranchSideComponents.Add(wye1);
wye1.TrunkSideComponent = mainPipe1;

// 支管1：去淋浴间——包含弯头和变径
var branchElbow1 = new Elbow(
    new Vector3(4, 0.5, 0),
    new Vector3(0, 1, 0),
    new Vector3(1, 0, 0),
    0.05,
    0.05
);
fittingTree.Add(branchElbow1);

var reducer1 = new Reducer(
    new Vector3(5, 0.5, 0),
    new Vector3(1, 0, 0),
    new Vector3(1, 0, 0),
    0.05,
    0.025,
    0.1,
    0
);
fittingTree.Add(reducer1);

var branchPipe1 = new StraightSegment(
    wallThickness: 2,
    end: new Port(new Vector3(5.1, 0.5, 0), new Vector3(1, 0, 0), 0.025),
    start: new Port(new Vector3(8, 0.5, 0), new Vector3(1, 0, 0), 0.025),
    material: BuiltInMaterials.Copper
);
fittingTree.Add(branchPipe1);

var showerTerminal = new Terminal(
    new Vector3(8, 0.5, 0),
    new Vector3(1, 0, 0),
    0.025,
    leafShower
);
fittingTree.Add(showerTerminal);

// 建立支管1的连接关系
wye1.BranchSideComponents.Add(branchElbow1);
branchElbow1.TrunkSideComponent = wye1;
branchElbow1.BranchSideComponents.Add(reducer1);
reducer1.TrunkSideComponent = branchElbow1;
reducer1.BranchSideComponents.Add(branchPipe1);
branchPipe1.TrunkSideComponent = reducer1;
branchPipe1.BranchSideComponents.Add(showerTerminal);
showerTerminal.TrunkSideComponent = branchPipe1;

// 干管继续延伸 (三通1 → 三通2)
var mainPipe2 = new StraightSegment(
    wallThickness: 3,
    end: new Port(new Vector3(4.1, 0, 0), new Vector3(1, 0, 0), 0.08),
    start: new Port(new Vector3(7, 0, 0), new Vector3(1, 0, 0), 0.08),
    material: BuiltInMaterials.Steel
);
fittingTree.Add(mainPipe2);

wye1.BranchSideComponents.Add(mainPipe2);
mainPipe2.TrunkSideComponent = wye1;

// 三通2 (DN80 → DN50 去厨房)
var wyeSettings2 = new WyeSettings(
    trunkDiameter: 0.08,
    mainDiameter: 0.05,
    branchDiameter: 0.05,
    trunkDistance: 0.05,
    mainDistance: 0.08,
    branchDistance: 0.08
);
var wye2 = new Wye(
    new Vector3(7, 0, 0),
    new Vector3(1, 0, 0),
    new Vector3(0, -1, 0),
    wyeSettings2,
    BuiltInMaterials.Steel
);
fittingTree.Add(wye2);

mainPipe2.BranchSideComponents.Add(wye2);
wye2.TrunkSideComponent = mainPipe2;

// 支管2：去厨房
var reducer2 = new Reducer(
    new Vector3(7, -0.5, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, -1, 0),
    0.05,
    0.025,
    0.08,
    0
);
fittingTree.Add(reducer2);

var branchPipe2 = new StraightSegment(
    wallThickness: 2,
    end: new Port(new Vector3(7, -0.58, 0), new Vector3(0, -1, 0), 0.025),
    start: new Port(new Vector3(7, -4, 0), new Vector3(0, -1, 0), 0.025),
    material: BuiltInMaterials.Copper
);
fittingTree.Add(branchPipe2);

var sinkTerminal = new Terminal(
    new Vector3(7, -4, 0),
    new Vector3(0, -1, 0),
    0.025,
    leafSink
);
fittingTree.Add(sinkTerminal);

wye2.BranchSideComponents.Add(reducer2);
reducer2.TrunkSideComponent = wye2;
reducer2.BranchSideComponents.Add(branchPipe2);
branchPipe2.TrunkSideComponent = reducer2;
branchPipe2.BranchSideComponents.Add(sinkTerminal);
sinkTerminal.TrunkSideComponent = branchPipe2;

// 干管末端（DN50 → 马桶）
var mainPipe3 = new StraightSegment(
    wallThickness: 2,
    end: new Port(new Vector3(7.08, 0, 0), new Vector3(1, 0, 0), 0.05),
    start: new Port(new Vector3(11, 0, 0), new Vector3(1, 0, 0), 0.05),
    material: BuiltInMaterials.Steel
);
fittingTree.Add(mainPipe3);

var reducer3 = new Reducer(
    new Vector3(11, 0, 0),
    new Vector3(1, 0, 0),
    new Vector3(1, 0, 0),
    0.05,
    0.025,
    0.08,
    0
);
fittingTree.Add(reducer3);

var toiletTerminal = new Terminal(
    new Vector3(11.1, 0, 0),
    new Vector3(1, 0, 0),
    0.025,
    leafToilet
);
fittingTree.Add(toiletTerminal);

wye2.BranchSideComponents.Add(mainPipe3);
mainPipe3.TrunkSideComponent = wye2;
mainPipe3.BranchSideComponents.Add(reducer3);
reducer3.TrunkSideComponent = mainPipe3;
reducer3.BranchSideComponents.Add(toiletTerminal);
toiletTerminal.TrunkSideComponent = reducer3;

// ===== 4. 更新几何表示 =====
fittingTree.UpdateRepresentations();

// ===== 5. 流量分配 =====
var flowCalc = new FullFlowCalculator();
var flowErrors = flowCalc.AssignFlowCalcs(fittingTree);

if (flowErrors.Count > 0)
{
    foreach (var err in flowErrors)
    {
        Console.WriteLine($"流量分配错误: {err.Message}");
    }
}
else
{
    Console.WriteLine("=== 流量分配结果 ===");
    foreach (var segment in fittingTree.FittingsOfType<StraightSegment>())
    {
        var flow = segment.End.Flow.FlowRate;
        Console.WriteLine($"  管段 (DN{segment.Diameter * 1000:F0}): 流量 = {flow * 1000:F2} L/s");
    }
}

// ===== 6. 压力计算 =====
var pressureCalc = new HazenWilliamsFullFlow(cCoefficient: 130);
pressureCalc.TrunkStaticPressure = 300000;

var pressureErrors = pressureCalc.UpdatePressureCalcs(fittingTree);

if (pressureErrors.Count > 0)
{
    foreach (var err in pressureErrors)
    {
        Console.WriteLine($"压力计算错误: {err.Message}");
    }
}
else
{
    Console.WriteLine("\n=== 压力计算结果 ===");
    foreach (var terminal in fittingTree.FittingsOfType<Terminal>())
    {
        if (terminal.FlowNode is Leaf leaf)
        {
            var p = terminal.Port.Flow.StaticPressure;
            Console.WriteLine($"  {leaf.Name}: 末端压力 = {p / 1000:F2} kPa");
        }
    }

    Console.WriteLine("\n=== 管段沿程损失 ===");
    foreach (var segment in fittingTree.FittingsOfType<StraightSegment>())
    {
        var pd = segment.PressureCalculations as PressureCalculationSegment;
        if (pd != null)
        {
            Console.WriteLine($"  管段 (DN{segment.Diameter * 1000:F0}, {segment.Length():F1}m): " +
                              $"压力损失 = {pd.PipeLoss / 1000:F2} kPa");
        }
    }
}

// ===== 7. 导出为 glTF 可视化 =====
var model = new Model();
foreach (var fitting in fittingTree.AllComponents)
{
    if (fitting is Fitting f)
    {
        // 将管件添加到 Elements Model 中用于可视化
        model.AddElement(f);
    }
    else if (fitting is StraightSegment ps)
    {
        model.AddElement(ps);
    }
}
model.ToGlTF("water_supply_network.glb");
Console.WriteLine($"\n模型已导出: water_supply_network.glb");
Console.WriteLine($"共 {model.Elements.Count} 个元素");
```

### 13.8.3 运行结果

程序运行后将在控制台输出类似以下信息：

```
=== 流量分配结果 ===
  管段 (DN100): 流量 = 1.00 L/s
  管段 (DN25): 流量 = 0.50 L/s
  管段 (DN80): 流量 = 0.50 L/s
  管段 (DN25): 流量 = 0.30 L/s
  管段 (DN50): 流量 = 0.20 L/s
  管段 (DN25): 流量 = 0.20 L/s

=== 压力计算结果 ===
  淋浴间: 末端压力 = 294.32 kPa
  厨房水槽: 末端压力 = 296.18 kPa
  马桶: 末端压力 = 297.05 kPa

=== 管段沿程损失 ===
  管段 (DN100, 4.1m): 压力损失 = 0.85 kPa
  管段 (DN25, 3.1m): 压力损失 = 3.21 kPa
  管段 (DN80, 3.0m): 压力损失 = 1.12 kPa
  ...

模型已导出: water_supply_network.glb
共 15 个元素
```

---

## 13.9 本章小结

本章系统介绍了 Elements.MEP 机电管道系统的完整技术栈：

1. **管件体系**涵盖 10+ 种标准管件类型，通过 `Port` 端口和 `TrunkSideComponent`/`BranchSideComponents` 构成树状管网拓扑
2. **FittingTree** 是管网核心数据结构，通过部分类将构建、计算、工具方法和可视化分离
3. **流量树**（`Flow.Tree`）抽象描述了流体路径，与 `FittingTree` 通过 Builder 自动转换
4. **FlowCalculator** 提供了全流量、远程面积法等多种流量分配策略
5. **PressureCalculator** 基于 Hazen-Williams 公式 + 等效长度法计算沿程和局部压力损失
6. **AdaptiveGrid + AdaptiveGraphRouting** 提供了 Dijkstra 最短路径寻路能力，支持障碍物回避和自定义权重

这套工具链使得在纯代码环境下完成从管路设计、流量分配到水力计算的完整 MEP 设计流程成为可能。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="https://znlgis.github.io/3d/elements/第12章-图与空间搜索/">← 上一章</a>
  <a href="https://znlgis.github.io/3d/elements/">目录</a>
  <a href="https://znlgis.github.io/3d/elements/第14章-组件化生成/">下一章 →</a>
</div>
