---
layout: default
title: 第02章：核心概念——Element 与 Model
---

# 第02章：核心概念——Element 与 Model

## 2.1 类型体系全景

理解 Elements 的类型体系是使用和开发的基础。Elements 采用**三层继承架构**，从最抽象的 `Element` 到最具体的建筑元素（墙、梁、柱等），形成一个严谨的类型层级：

```
Element (Id + Name + AdditionalProperties)
├── GeometricElement           ★所有带几何表示的元素
│   ├── Wall / StandardWall / WallByProfile    墙
│   ├── Beam / Joist                           梁/托梁
│   ├── Column                                  柱
│   ├── Brace / StructuralFraming / Frame       支撑/结构框架
│   ├── Floor / Panel                           楼板/面板
│   ├── Space / Opening                         空间/开洞
│   ├── Mass / Topography                       体量/地形
│   ├── BaseCeiling / SolidCeiling / OpenCeiling  天花板
│   ├── GridLine / Symbol                       轴网/符号
│   ├── MeshElement / ImportMeshElement         网格元素
│   ├── ModelCurve / ModelLines / ModelPoints   模型线
│   ├── ContentElement                          内容元素（引用glTF）
│   ├── Light / PointLight / DirectionalLight   灯光
│   ├── ModelText / ModelArrows                 文字/箭头
│   └── AnalysisMesh / AnalysisImage            分析网格/分析图像
│
├── Material                                   材质
├── ElementInstance                            元素实例
├── ElementProxy<T>                            跨模型代理
├── ContentCatalog                             内容目录
└── MappingBase                                属性映射基类
```

### 2.1.1 Element：一切元素的根基

`Element` 是所有建筑元素的抽象基类。它的核心属性很少，但承载了整个类型系统的关键约定：

```csharp
public abstract class Element : INotifyPropertyChanged
{
    // 唯一标识符（GUID）
    public Guid Id { get; set; }

    // 人类可读的名称
    public string Name { get; set; }

    // 扩展属性字典（JSON序列化中捕获未知属性）
    [JsonExtensionData]
    public Dictionary<string, object> AdditionalProperties { get; set; }
}
```

几个重要的设计决策：

- **Id 是 GUID**：每个元素都有一个全局唯一标识符，在分布式场景中（多模型合并、跨项目引用）保持唯一性
- **INotifyPropertyChanged**：实现属性变更通知，使 UI 框架（如 Blazor Playground）可以响应式绑定
- **AdditionalProperties**：通过 `[JsonExtensionData]` 特性，JSON 反序列化时捕获 Schema 中未定义的属性。这是连接 Revit 实例参数等外部数据的关键机制

### 2.1.2 GeometricElement：带几何的元素

`GeometricElement` 是 `Element` 的直接子类，**所有能在三维空间中可见的建筑元素都继承自它**。它引入了几何表示的核心概念：

```csharp
public abstract class GeometricElement : Element
{
    // 变换矩阵（位置 + 旋转 + 缩放）
    public Transform Transform { get; set; }

    // 几何表示（SolidOperation 列表）
    public Representation Representation { get; set; }

    // 包围盒（缓存，计算后不可变）
    public BBox3 Bounds { get; protected set; }

    // 是否为"元素定义"（不直接显示，仅作为实例的模板）
    public bool IsElementDefinition { get; set; }

    // ★ 核心虚方法：每个子类必须覆写以填充几何操作
    public virtual void UpdateRepresentations()
    {
        // 子类在此填充 Representation.SolidOperations
    }

    // 计算几何实体并更新包围盒
    public void UpdateBoundsAndComputeSolid(bool transformed = true)
    {
        // 触发 CSG 布尔运算，生成 Csg.Solid
    }

    // 三角剖分为网格
    public Mesh ToMesh(Transform transform = null)
    {
        // 将 Csg.Solid 三角化为 Elements.Geometry.Mesh
    }
}
```

**UpdateRepresentations** 是理解 Elements 几何生成的最重要的钩子方法。每个建筑元素子类覆写此方法，在其中创建 `SolidOperation` 对象并添加到 `Representation.SolidOperations` 列表中。

以墙元素为例，它的 `UpdateRepresentations` 大致相当于：

```csharp
public override void UpdateRepresentations()
{
    // 如果未定义表示，创建一个
    if (Representation == null)
        Representation = new Representation();

    // 用此墙的 CenterLine + Profile 创建拉伸操作
    var extrude = new Extrude(
        Profile,                             // 剖面/轮廓
        CenterLine.Length(),                 // 拉伸长度
        CenterLine.Direction().Unitized(),   // 拉伸方向（通常是沿定位线）
        false                                // 不是挖空
    );

    Representation.SolidOperations.Add(extrude);
}
```

### 2.1.3 IsElementDefinition：元素定义 vs 元素实例

`IsElementDefinition` 是一个关键属性。设置为 `true` 的元素不会在模型中直接渲染，而是作为"模板"或"库定义"存在，由 `ElementInstance` 引用。

```csharp
// 创建一个梁定义（不在模型中显示）
var beamDef = new Beam(
    new Line(Vector3.Origin, new Vector3(3, 0, 0)),
    new Profile(Polygon.Rectangle(0.2, 0.4))
)
{
    IsElementDefinition = true,     // ★ 标记为定义
    Name = "300x400 标准梁"
};

model.AddElement(beamDef);

// 用这个定义创建多个实例
var instance1 = beamDef.CreateInstance(
    new Transform(5, 2, 3),         // 放在 (5, 2, 3)
    "梁实例 A"
);
var instance2 = beamDef.CreateInstance(
    new Transform(5, 8, 3),
    "梁实例 B"
);

model.AddElements(new[] { instance1, instance2 });
```

这种方式在大型建筑中非常重要——相同的梁、柱可以定义一次，在不同位置实例化多次，大幅减少数据冗余。

## 2.2 Representation 表示系统

### 2.2.1 Representation：几何操作的容器

```csharp
public class Representation
{
    // 实体操作列表（Extrude, Sweep, Lamina, ConstructedSolid）
    public List<SolidOperation> SolidOperations { get; set; }
}
```

`Representation` 的概念非常简洁：它**只是 `SolidOperation` 的列表**。每个 `SolidOperation` 描述一个三维实体如何通过基本的几何操作（拉伸、扫描、层压）创建。如果 `SolidOperation.IsVoid` 为 `true`，则该操作为"挖空"，在后续 CSG 布尔运算中被减去。

### 2.2.2 RepresentationInstance：表示实例（2.1 新架构）

Elements 2.1 引入了 `RepresentationInstance`，实现了**一个元素对应多个视觉表示**的设计：

```csharp
public class RepresentationInstance
{
    // 指向的表示对象（可以是 SolidRepresentation、CurveRepresentation 等）
    public ElementRepresentation Representation { get; set; }

    // 材质
    public Material Material { get; set; }

    // 是否为默认表示
    public bool IsDefault { get; set; }

    // 表示类型（结构视图 / 建筑视图 / 分析视图 等）
    public string RepresentationTypes { get; set; }
}
```

这意味着同一堵墙可以有三个 `RepresentationInstance`：
- 建筑视图：混凝土核心 + 外饰面 + 内饰面
- 结构视图：仅混凝土核心
- 分析视图：简化为线框或分析网格

## 2.3 SolidOperation：实体操作体系

`SolidOperation` 是 Elements 几何内核的声明层。开发者不需要直接操作顶点和面，而是**声明性地描述几何的形状**，由内核负责计算实际的三维实体。

### 2.3.1 操作的继承体系

```
SolidOperation（抽象基类）
├── Extrude           拉伸：2D 轮廓沿直线方向挤出
├── Sweep             扫描：2D 轮廓沿曲线路径扫掠
├── Lamina            层板：2D 轮廓本身的薄片表示
└── ConstructedSolid  构造实体：由多个子操作组合而成
```

每个操作都有一个 `bool IsVoid` 属性。设为 `true` 时，该操作的实体将从父实体的 CSG 布尔运算中被减去。

### 2.3.2 Extrude：最常用的操作

```csharp
public class Extrude : SolidOperation
{
    public Profile Profile { get; set; }     // 剖面轮廓（可含空洞）
    public double Extent { get; set; }       // 拉伸长度
    public Vector3 Direction { get; set; }   // 拉伸方向
    public bool BothSides { get; set; }      // 是否双向拉伸
}
```

示例：创建一个带空洞的拉伸体（类似管道）：

```csharp
// 外轮廓：圆形
var outerCircle = new Circle(Vector3.Origin, 0.5).ToPolygon(64);

// 内轮廓（空洞）：小圆形
var innerCircle = new Circle(Vector3.Origin, 0.4).ToPolygon(64);

// 带空洞的剖面
var profile = new Profile(outerCircle, new[] { innerCircle });

// 创建拉伸（结果是一个圆管）
var pipeExtrude = new Extrude(
    profile,
    5.0,                           // 5 米长
    Vector3.ZAxis,                 // 向上拉伸
    false                          // 不是挖空
);
```

### 2.3.3 Sweep：沿曲线扫描

```csharp
public class Sweep : SolidOperation
{
    public Profile Profile { get; set; }      // 截面轮廓
    public Curve Curve { get; set; }          // 扫描路径
    public double StartSetback { get; set; }  // 起始退距
    public double EndSetback { get; set; }    // 终止退距
}
```

示例：创建一根沿弧线的弯曲管道：

```csharp
// 弧线路径：90 度、半径 3 米
var arc = new Arc(
    Vector3.Origin,
    3.0,
    0.0,       // 起始角 0°
    Math.PI / 2  // 终止角 90°
);

// 圆形截面
var section = new Profile(new Circle(Vector3.Origin, 0.1).ToPolygon(32));

// 扫描
var sweep = new Sweep(section, arc, 0, 0);
```

## 2.4 Model：模型容器

`Model` 是 Elements 的顶层容器，管理所有元素并提供查询、序列化、剖切等功能。

### 2.4.1 创建与基本操作

```csharp
public class Model
{
    // 所有元素（字典：Id → Element）
    public Dictionary<Guid, Element> Elements { get; }

    // 添加元素
    public void AddElement(
        Element element,
        bool gatherSubElements = true,       // 是否递归收集子元素
        bool updateRepresentations = true    // 是否调用 UpdateRepresentations
    );

    // 批量添加
    public void AddElements(IEnumerable<Element> elements);

    // 移除元素
    public void RemoveElement(Guid id);
}
```

### 2.4.2 查询元素

```csharp
// 按类型查询（返回具体类型）
public List<T> AllElementsOfType<T>() where T : Element;

// 按类型查询（包括派生类型）
public List<T> AllElementsAssignableFromType<T>() where T : Element;

// 按 Id 查询（返回具体类型）
public T GetElementOfType<T>(Guid id) where T : Element;

// 按名称查询
public T GetElementByName<T>(string name) where T : Element;
```

示例：

```csharp
var model = new Model();
// ... 添加元素 ...

// 获取所有墙（不包括 WallByProfile、StandardWall 等子类）
var walls = model.AllElementsOfType<Wall>();

// 获取所有墙（包括所有派生类型）
var allWalls = model.AllElementsAssignableFromType<Wall>();

// 按 Id 查找特定元素
var myBeam = model.GetElementOfType<Beam>(someGuid);

// 按名称查找
var mainColumn = model.GetElementByName<Column>("主入口柱");
```

### 2.4.3 平面剖切模型

`Model.Intersect` 方法用平面对模型进行剖切，返回剖面多边形和交线，是实现"生成剖面图"的基础：

```csharp
// 用 XZ 平面在 Y=0 处剖切
var plane = new Plane(
    Vector3.Origin,
    Vector3.YAxis
);

model.Intersect(
    plane,
    out var polygons,     // 剖面多边形
    out var beyond,       // 超出平面的元素
    out var lines          // 交线段
);

// polygons 可以导出为 DXF/SVG 生成剖面图
```

## 2.5 元素生命周期

Elements 中元素的完整生命周期分为四个阶段：

```
创建 → 几何计算 → 序列化/导出 → 反序列化/重建
```

### 2.5.1 阶段一：创建（Constructor）

在构造函数中设置元素的业务属性：

```csharp
var wall = new Wall(
    new Line(new Vector3(0, 0, 0), new Vector3(5, 0, 0)),
    new Profile(Polygon.Rectangle(0.2, 3.0)),
    3.0
)
{
    Name = "外墙-A1",
    Material = new Material("混凝土", Colors.Gray)
};
```

### 2.5.2 阶段二：几何计算（UpdateRepresentations + ComputeSolid）

调用 `Model.AddElement()` 时自动触发：

1. `UpdateRepresentations()` — 子类填充 `SolidOperation` 列表
2. 递归收集子元素（`RecursiveGatherSubElements`）
3. `UpdateBoundsAndComputeSolid()` — 执行 CSG 布尔运算，生成精确的 `Csg.Solid` 和 `BBox3`

```csharp
model.AddElement(wall);
// 此时 wall.HasGeometry() == true
// wall.Bounds 已被计算
```

### 2.5.3 阶段三：序列化/导出

将内存中的模型转换为持久化格式：

```csharp
// JSON 格式（文本，可版本控制）
var json = model.ToJson();
File.WriteAllText("model.json", json);

// glTF/GLB 格式（Web 3D 查看）
model.ToGlTF("model.glb");

// IFC 格式（专业 BIM 软件）
model.ToIFC("model.ifc");
```

### 2.5.4 阶段四：反序列化/重建

从持久化格式重建模型：

```csharp
// 从 JSON 重建
var json = File.ReadAllText("model.json");
var model = Model.FromJson(json, out var errors);

if (errors.Any())
{
    Console.WriteLine($"加载错误: {string.Join(", ", errors)}");
}
```

## 2.6 SharedObject 与跨元素共享

`SharedObject` 是一种特殊的存在——它有 `Id`，但**不参与序列化**。它用于在多个元素之间共享数据，但不作为独立元素输出到文件：

```csharp
public abstract class SharedObject
{
    public Guid Id { get; set; }
}
```

其子类包括：

```csharp
public abstract class ElementRepresentation : SharedObject
{
    // 抽象类：可生成 glTF 缓冲和捕捉点
    public abstract GraphicsBuffers ToGraphicsBuffers();
    public abstract IList<Vector3> SnappingPoints { get; }
}

// 具体实现
public class SolidRepresentation : ElementRepresentation { ... }
public class CurveRepresentation : ElementRepresentation { ... }
public class ContentRepresentation : ElementRepresentation { ... }
```

## 2.7 ElementInstance：实例化

`ElementInstance` 是实现"定义-实例"模式的关键类：

```csharp
public class ElementInstance : Element
{
    // 指向元素定义
    public Element BaseDefinition { get; set; }

    // 实例的变换（位置、旋转、缩放）
    public Transform Transform { get; set; }
}
```

配合 `GeometricElement.CreateInstance()` 使用：

```csharp
// 1. 创建一个"柱子定义"
var columnDef = new Column(Vector3.Origin, 3.0, squareProfile)
{
    IsElementDefinition = true,
    Name = "400x400 标准柱"
};

// 2. 在多处创建实例
for (int i = 0; i < 10; i++)
{
    var instance = columnDef.CreateInstance(
        new Transform(i * 6, 0, 0),
        $"柱-C{i+1}"
    );
    model.AddElement(instance);
}
```

## 2.8 ElementProxy<T>：跨模型引用

当多个 `Model` 之间需要引用同一元素时（例如，一个"幕墙系统"模型引用"主体结构"模型中的梁），使用 `ElementProxy<T>`：

```csharp
// 在主模型中有一个 Beam
var mainBeam = new Beam(...);
mainModel.AddElement(mainBeam);

// 在附属模型中通过 Proxy 引用它
var proxy = new ElementProxy<Beam>(mainBeam.Id);
// proxy.Element 会在反序列化后延迟加载
```

## 2.9 Mappings：跨系统属性映射

在 BIM 协作中，同一个建筑构件在不同软件中有不同的属性名称。Elements 的 `MappingBase` 体系解决了这个问题：

```csharp
public abstract class MappingBase : Element
{
    // 抽象方法：执行实际映射
    public abstract void SetMapping(
        object context,
        Dictionary<string, object> properties
    );
}
```

例如，可以将 Revit 中的"基础约束"参数映射到 Elements 的对应属性上。

## 2.10 小结

本章涵盖了 Elements 最核心的概念：

- **Element**：所有建筑元素的基类，定义 Id、Name 和扩展属性
- **GeometricElement**：带几何表示的元素，通过 `UpdateRepresentations()` 声明几何
- **Representation + SolidOperation**：几何的声明式描述（Extrude、Sweep 等）
- **Model**：元素的容器，提供添加、查询、序列化、剖切功能
- **IsElementDefinition + ElementInstance**：定义-实例模式，减少数据冗余
- **元素生命周期**：创建 → 几何计算 → 序列化 → 反序列化

下一章将深入 Elements 的几何系统核心——向量、曲线与多边形。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="https://znlgis.github.io/3d/elements/第02章-核心概念Element与Model/第01章-Elements概述与快速入门/">← 上一章</a>
  <a href="https://znlgis.github.io/3d/elements/第02章-核心概念Element与Model/">目录</a>
  <a href="https://znlgis.github.io/3d/elements/第02章-核心概念Element与Model/第03章-几何系统（上）向量曲线与多边形/">下一章 →</a>
</div>
