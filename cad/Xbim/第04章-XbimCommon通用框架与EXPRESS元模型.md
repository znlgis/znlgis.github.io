---
layout: default
title: 第04章：XbimCommon通用框架与EXPRESS元模型
---

# 第04章：Xbim.Common 通用框架与 EXPRESS 元模型

`Xbim.Common` 是整个 Xbim 工具链的基石。任何其他模块（`Xbim.Ifc`、`Xbim.Ifc4`、`Xbim.Geometry`、`Xbim.IO.*`）都要引用它。本章深入剖析它的核心抽象，让我们能从"使用者"升级为"理解内部机制者"。

## 1. Xbim.Common 的定位

`Xbim.Common` 不绑定任何 IFC 版本，它提供一套**通用的、模式无关的**基础设施：

- 模型容器接口（`IModel`）；
- 实体根接口（`IPersistEntity`）；
- 实体集合（`IEntityCollection`）；
- 事务（`ITransaction` / `XbimEditScope`）；
- 元数据（`ExpressMetaData`、`ExpressType`、`ExpressMetaProperty`）；
- 几何辅助类型（`XbimVector3D`、`XbimMatrix3D`、`XbimRect3D`）；
- 步骤 21 token 常量、单位字符串、日志、依赖注入服务等。

可以把它理解为 "EXPRESS 元模型 + IFC 模型容器" 在 .NET 中的抽象层，是 Xbim 的"内核 ABI"。

## 2. 核心接口家族

### 2.1 `IPersistEntity`

每一个 IFC 实例（不论是 IFC2x3 的 `IfcWall` 还是 IFC4x3 的 `IfcRoad`）最终都会实现这个接口：

```csharp
public interface IPersistEntity : IPersist
{
    int EntityLabel { get; }       // STEP21 文件中的 #id
    IModel Model { get; }          // 所属模型
    ExpressType ExpressType { get; }
    ActivationStatus ActivationStatus { get; }
    void Activate(bool write);     // 懒加载/写激活
    event PropertyChangedEventHandler PropertyChanged;
    event PropertyChangingEventHandler PropertyChanging;
}
```

要点：

- `EntityLabel` 是 `#42` 中的 42，**永远是正整数**；
- `Activate()` 用于按需从磁盘加载实体属性（Esent 后端关键机制）；
- `PropertyChanged/Changing` 事件让事务能跟踪修改用于撤销。

### 2.2 `IModel`

```csharp
public interface IModel : IDisposable
{
    object Tag { get; set; }
    int UserDefinedId { get; set; }
    IEntityCollection Instances { get; }
    bool Activate(IPersistEntity owningEntity);
    void Delete(IPersistEntity entity);
    ITransaction BeginTransaction(string name);
    ITransaction CurrentTransaction { get; }
    ExpressMetaData Metadata { get; }
    IfcSchemaVersion SchemaVersion { get; }
    IModelFactors ModelFactors { get; }            // 全局缩放/容差
    IGeometryStore GeometryStore { get; }          // 几何流容器（Wexbim）
    IInverseCache BeginInverseCaching();           // 反向引用缓存
    IEntityCache BeginEntityCaching();
    string OwningUser { get; set; }
    // ... 其他
}
```

`IModel` 把"一份 IFC 模型"抽象为：**实体集合 + 元数据 + 事务 + 几何存储 + 模型因子**。

### 2.3 `IEntityCollection`

```csharp
public interface IEntityCollection
{
    IEnumerable<IPersistEntity> OfType(string stringType);
    IEnumerable<T> OfType<T>() where T : IPersistEntity;
    IEnumerable<T> OfType<T>(bool activate) where T : IPersistEntity;
    IPersistEntity this[int label] { get; }
    long Count { get; }

    T New<T>() where T : IInstantiableEntity;
    T New<T>(Action<T> initProperties) where T : IInstantiableEntity;
    IPersistEntity New(Type t);
    // ...
}
```

注意几个关键设计：

1. **基于类型的查询是一等公民**：`OfType<IIfcWall>()` 直接返回墙的强类型迭代器。底层（无论是 Esent 还是 Memory）都对类型索引做了优化。
2. **创建实体只能通过 `New<T>()`**：不能 `new IfcWall()`，必须由 `IModel` 来分配 EntityLabel 并注册到集合。
3. **可以通过 EntityLabel 直接索引**：`model.Instances[42]` 取出 `#42`。

### 2.4 `ITransaction`

```csharp
public interface ITransaction : IDisposable
{
    string Name { get; }
    void Commit();
    void RollBack();
    void AddReversibleAction(Action doAction, Action undoAction, ...);
}
```

Xbim 强制要求**所有写操作必须在事务内**。典型写法：

```csharp
using var txn = model.BeginTransaction("Add wall");
var wall = model.Instances.New<Xbim.Ifc4.SharedBldgElements.IfcWall>(w =>
{
    w.Name = "Wall-001";
});
txn.Commit();
```

事务在 Esent 后端会真正落地到 ESE 日志，在 Memory 后端则用于实现撤销/重做。

## 3. EXPRESS 元模型在 Xbim 中的呈现

EXPRESS schema 的关键概念在 `Xbim.Common.Metadata` 命名空间中有完整对应：

| EXPRESS 概念 | Xbim 类型 |
| --- | --- |
| Schema | `ExpressMetaData`（每个 schema 一份单例） |
| ENTITY | `ExpressType` |
| Attribute（直接属性） | `ExpressMetaProperty`（`EntityAttribute.Order`） |
| INVERSE | `ExpressMetaProperty.IsInverse`（`InverseAttribute`） |
| DERIVE | `ExpressMetaProperty.IsDerived`（`DerivedAttribute`） |
| SELECT | C# 接口 + `ExpressType.SubTypes` |
| TYPE（类型别名）| `ExpressType.UnderlyingType` 或 `IExpressValueType` |
| ENUMERATION | C# `enum` |

### 3.1 `ExpressMetaData`

每个具体 schema（IFC2x3、IFC4、IFC4x3）会注册一份 `ExpressMetaData` 实例，可以通过：

```csharp
var meta = ExpressMetaData.Schema(typeof(Xbim.Ifc4.Kernel.IfcWall).Module);
foreach (var t in meta.Types())
    Console.WriteLine($"{t.Type.Name}  Inheritance={t.Inheritance}  Derives={t.SuperType?.Type.Name}");
```

得到的 `ExpressType` 含：

- `Type`：对应的 .NET `Type`；
- `Properties`：`(byte order) -> ExpressMetaProperty` 字典，按 EXPRESS 属性顺序；
- `Inverses`：反向引用集合；
- `SubTypes`、`SuperType`：类型层次；
- `ExpressName`、`ExpressNameUpper`：原始 EXPRESS 名（"IfcWall"，序列化用）。

### 3.2 `ExpressMetaProperty`

```csharp
public class ExpressMetaProperty
{
    public PropertyInfo PropertyInfo { get; }
    public bool IsExplicit { get; }
    public bool IsInverse { get; }
    public bool IsDerived { get; }
    public Type PropertyType { get; }
    public Type EnumerableType { get; }
    public byte EntityAttributeOrder { get; }
    public EntityAttributeAttribute EntityAttribute { get; }
    public InverseAttribute InverseAttribute { get; }
    public string Name { get; }
}
```

这个对象配合反射，让 STEP21/XML 序列化器可以**完全数据驱动**地写入实体——不需要为每个实体类手写 `Read/Write` 方法。

### 3.3 自动生成的 IFC 实体长什么样

打开 `Xbim.Ifc4/Kernel/IfcWall.cs`（自动生成），你会看到类似：

```csharp
[ExpressType("IfcWall", 26)]
public partial class @IfcWall : IfcBuildingElement, IInstantiableEntity, IIfcWall
{
    [EntityAttribute(9, EntityAttributeState.Optional, ...)]
    public IfcWallTypeEnum? PredefinedType { get => ...; set => ...; }
    // 反向、派生属性...
}
```

注释中的 `[EntityAttribute(9, ...)]` 表示 `PredefinedType` 是 EXPRESS 顺序中第 9 个直接属性——这正是 STEP21 文件里 `IFCWALL(...)` 括号内第 9 个参数。Xbim 序列化器就靠这些特性恢复字段顺序。

## 4. 两套并行的接口体系：版本绑定 vs 抽象

Xbim 4.x 起引入了一套**抽象接口** `Xbim.Ifc4.Interfaces`：

- `IIfcWall`、`IIfcRoot`、`IIfcProject`、`IIfcRelAggregates`、`IIfcPropertySingleValue` …
- 这套接口位于 `Xbim.Ifc4` 程序集内，**但同时被 `Xbim.Ifc2x3` 和 `Xbim.Ifc4x3` 实现**；
- 它代表"**逻辑 IFC 模型**"，把 2x3 和 4 的差异在接口层抹平。

这意味着可以编写**版本无关**的代码：

```csharp
foreach (IIfcWall wall in model.Instances.OfType<IIfcWall>())
{
    // 不论 SchemaVersion 是 Ifc2x3 / Ifc4 / Ifc4x3，都能跑
}
```

而具体写实现（例如设置某些 IFC4 特有的属性）时，再切回到具体类：

```csharp
var wall4 = model.Instances.New<Xbim.Ifc4.SharedBldgElements.IfcWall>();
wall4.PredefinedType = IfcWallTypeEnum.SHEAR;
```

## 5. ModelFactors：单位与容差

每个 IFC 模型自带一组单位声明（`IfcUnitAssignment`）：长度（mm/m/in）、角度（rad/deg）、面积、体积、力等。`IModel.ModelFactors` 把它们抽象成：

```csharp
public interface IModelFactors
{
    double OneMilliMeter { get; }
    double OneMeter { get; }
    double LengthToMetresConversionFactor { get; }
    double AngleToRadiansConversionFactor { get; }
    double Precision { get; }                  // 几何精度
    double DeflectionTolerance { get; }        // 三角化偏差
    XbimVector3D WorldCoordinateSystem { get; }
    // ...
}
```

这是 Xbim.Geometry 在做布尔运算、三角化时**必须**读取的值。如果忽略它们，1mm 的容差用在以米为单位的模型里会引发灾难性误差。

## 6. 几何辅助类型

`Xbim.Common.Geometry` 命名空间提供与 OCCT 解耦的轻量几何类型：

- `XbimPoint3D`、`XbimVector3D`、`XbimRect3D`、`XbimMatrix3D`；
- 序列化友好的 `XbimQuaternion`；
- 三角网格容器 `XbimTriangulatedFace`、`XbimShapeTriangulation`。

它们不依赖 OCCT，可以在没有几何引擎的纯托管环境（Linux）下使用。

## 7. 依赖注入与 v6 服务模型

v6 是 Xbim 的关键演进点。它引入了 `XbimServices` —— 一个静态包装的依赖注入容器（基于 `Microsoft.Extensions.DependencyInjection`）：

```csharp
XbimServices.Current.ConfigureServices(services =>
{
    services.AddXbimToolkit(builder => builder
        .AddMemoryModel()             // 模型后端
        .AddEsentModel()              // Esent 后端
        .AddHeuristicModel()          // 大小自适应后端
        .AddLogging(/* ILoggerFactory */));
});
```

之后内部各种工厂、几何引擎实例、Tessellator 都从容器解析。这极大提高了可测试性、可扩展性。如果你来自 v5：**只需要在程序启动时调用一次 `XbimServices.Current.ConfigureServices(...)`，其余 API 几乎不变**。

## 8. 日志（ILoggerFactory）

Xbim 内部使用 `Microsoft.Extensions.Logging` 抽象。例如 `Xbim.Common.XbimLogging`、`Xbim.Geometry.Engine.Interop.XbimGeometryEngine` 都会输出几何转换中的警告（"Boolean failed for entity #1234"）。在生产环境中**必须**接入日志系统：

```csharp
services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Warning));
```

否则你将看不到几何引擎给出的宝贵诊断信息。

## 9. 反向引用（INVERSE）的实现

EXPRESS 中的 INVERSE 是"反向找谁引用我"，例如：

```
ENTITY IfcRoot;
INVERSE
   IsDecomposedBy : SET OF IfcRelAggregates FOR RelatingObject;
END_ENTITY;
```

Xbim 的 INVERSE 属性在 C# 中表现为 `IEnumerable<T>`，**运行时**遍历模型实体集合反查。这意味着：

- 反向访问比正向慢；
- 当你要在循环中多次读取 INVERSE 属性时，应当借助 `IModel.BeginInverseCaching()`：

```csharp
using (model.BeginInverseCaching())
{
    foreach (var product in model.Instances.OfType<IIfcProduct>())
    {
        var defByProps = product.IsDefinedBy.OfType<IIfcRelDefinesByProperties>();
        // ...
    }
}
```

缓存会预扫描一次模型并对所有 INVERSE 建立索引，遍历完成后释放。处理大型模型这一步必不可少。

## 10. 模型后端的统一抽象

`Xbim.Common` 不知道也不关心模型存在哪里。具体实现由后端提供：

- `Xbim.IO.Memory.MemoryModel` —— 内存哈希表（默认在 .NET Core 上）；
- `Xbim.IO.Esent.EsentModel` —— Windows Esent 嵌入式数据库（适合大型 IFC，>500MB）；
- `Xbim.IO.HeuristicModel` —— 自动按文件大小选择 Memory or Esent；
- 第三方扩展：理论上你可以实现自己的 `IModel`（例如基于 SQLite、LiteDB），只要遵守 `Xbim.Common` 的接口契约。

## 11. 实体的"激活"状态

考虑加载 1GB IFC：如果一次性把所有实体的所有属性反序列化到内存，立刻就 OOM。Esent 后端解决方案是：

1. 解析时只加载 `EntityLabel` 与类型；
2. 真正访问属性时调用 `Activate(false)` 把 Esent 中存的二进制属性反序列化到对象；
3. 被修改时调用 `Activate(true)` 标记脏数据，事务提交时写回 Esent。

`ActivationStatus` 枚举：

- `NotActivated` —— 尚未读属性；
- `ActivatedRead` —— 已读，但未修改；
- `ActivatedReadWrite` —— 已读并被修改。

理解这一点能帮助你诊断"明明属性看起来加载了，调试器看到却是默认值"的诡异现象（实际是被 Activate 包裹的属性 getter 触发延迟加载）。

## 12. 一个迷你示例：通过 ExpressType 反射

```csharp
using var model = IfcStore.Open("SampleHouse.ifc");

// 列出所有具体实体类型及其数量（按继承层次）
var meta = model.Metadata;
foreach (var et in meta.Types())
{
    int count = model.Instances.OfType(et.Type.FullName, false).Count();
    if (count > 0)
        Console.WriteLine($"{et.ExpressName,-40} {count}");
}

// 读取 #1234 的所有 explicit 属性值
var entity = model.Instances[1234];
var et2 = entity.ExpressType;
foreach (var prop in et2.Properties.Values.Where(p => p.EntityAttribute.State != EntityAttributeState.Derived))
{
    var value = prop.PropertyInfo.GetValue(entity);
    Console.WriteLine($"{prop.Name} = {value}");
}
```

这种"用 ExpressType 反射操纵任何 IFC 实体"的能力非常强大，是写通用导出器、模型对比工具的基础。

## 13. 小结

`Xbim.Common` 把 EXPRESS/IFC 数据模型抽象为：

- `IModel` + `IEntityCollection` + `IPersistEntity`：模型容器；
- `ExpressMetaData` + `ExpressType` + `ExpressMetaProperty`：元模型；
- `ITransaction`：事务；
- `IModelFactors`：单位/容差；
- `XbimServices` + DI：v6 引入的服务体系。

理解了它，再看 `Xbim.Ifc.IfcStore`、`Xbim.Geometry.Engine.IXbimGeometryEngine`、`Xbim.IO.Step21` 等模块就只是"用这套抽象具体实现某个能力"。

下一章我们把焦点上移到**应用层**入口 `Xbim.Ifc.IfcStore`。
