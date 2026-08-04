---
layout: default
title: 第08章：BIM与IFC数据处理
---

# 第08章：BIM 与 IFC 数据处理

Ara3D 在 BIM 数据领域的核心贡献是 **BimOpenSchema（BOS）**——一个开放、列式、以关系为中心的 BIM 数据模式。本章讲解 BOS 的设计、数据接口、IFC 加载与转换、以及把 BIM 数据导出到 Parquet/DuckDB/Excel/SQLite 的工具。

## 1. 为什么要 BimOpenSchema

传统 BIM 交换（IFC/RVT）面临几个痛点：文件庞大、schema 复杂、难以用通用数据工具（SQL/Pandas）分析。BOS 的思路是把 BIM 拆成**列式的实体-属性-值（EAV）表**，从而：

- 天然适配列式存储（Parquet）与分析型数据库（DuckDB）；
- 字符串、数字、点等去重进独立表，压缩率高；
- 关系显式建模，便于图/层级查询。

当前 schema 版本 **v0.3**。

## 2. IBimData——BOS 顶层数据接口

```csharp
public interface IBimData
{
    BimManifest                        Manifest    { get; }  // 元信息
    IReadOnlyList<ParameterDescriptor> Descriptors { get; }  // 参数定义
    IReadOnlyList<Parameter>           Parameters  { get; }  // 参数值（EAV）
    IReadOnlyList<Document>            Documents   { get; }  // 源文档
    IReadOnlyList<Entity>             Entities    { get; }  // 实体（构件）
    IReadOnlyList<string>             Strings     { get; }  // 去重字符串池
    IReadOnlyList<double>             Numbers     { get; }  // 去重数字池
    IReadOnlyList<Point>              Points      { get; }  // 去重点池
    IReadOnlyList<EntityRelation>     Relations   { get; }  // 实体关系
    BimGeometry                       Geometry    { get; }  // 列式几何
}
```

核心思想：`Parameters` 表里存的不是字符串/数字本身，而是**指向 Strings/Numbers/Points 池的索引**——这就是列式 + 去重。

## 3. 核心记录类型

```csharp
// 实体：一个 BIM 构件
public record struct Entity(EntityIndex Index, long LocalId, StringIndex Name,
                            StringIndex Category, DocumentIndex Document);

// 参数值（EAV 的一行）
public record struct Parameter(EntityIndex Entity, DescriptorIndex Descriptor,
                               ValueType ValueType, int ValueIndex);
// ValueType ∈ { String, Number, Point, Integer, Bool, Entity ... }
// ValueIndex 指向对应池

// 参数定义
public record struct ParameterDescriptor(StringIndex Name, StringIndex Group,
                                         StringIndex Units, ParameterType Type);

// 实体间关系
public record struct EntityRelation(EntityIndex A, EntityIndex B, RelationType Type);
```

`RelationType` 涵盖约 15 种 BIM 关系，例如：`ContainedIn`、`Contains`、`HostedBy`、`Hosts`、`TypeOf`、`HasType`、`GroupedBy`、`AggregatedInto`、`ConnectedTo`、`BoundedBy`、`FillsVoid`、`VoidsElement`、`AssignedTo` 等。用强类型索引（`EntityIndex`、`StringIndex` 等 record struct）避免“裸 int”混用错误。

## 4. BimGeometry——列式几何

几何也被拆成 6 张列式表，避免逐对象封装的开销：

```csharp
public class BimGeometry
{
    public IReadOnlyList<Point>       Vertices        { get; }  // 全局顶点池
    public IReadOnlyList<int>         Indices         { get; }  // 三角索引
    public IReadOnlyList<MeshSlice>   Meshes          { get; }  // 顶点/索引范围
    public IReadOnlyList<Transform>   Transforms      { get; }  // 实例变换
    public IReadOnlyList<GeometryRef> GeometryRefs    { get; }  // 实体→网格+变换
    public IReadOnlyList<Material>    Materials       { get; }
}
```

这样一份几何可被多个实体引用（通过 `GeometryRef`），与第 06 章的实例化理念一致。

## 5. BimObjectModel——反规范化视图

列式 EAV 适合存储与分析，但不便于逐对象遍历。`BimObjectModel` 提供**反规范化**（denormalized）的面向对象视图，把参数、关系“挂回”到对象上：

```csharp
public class BimObjectModel
{
    public IReadOnlyList<BimObject> Objects { get; }
}

public class BimObject
{
    public long   LocalId  { get; }
    public string Name     { get; }
    public string Category { get; }
    public IReadOnlyDictionary<string, object> Parameters { get; }  // 已解引用为实际值
    public IReadOnlyList<BimObject> Children { get; }               // 已解析关系
}
```

用法：用 `IBimData` 存/传，用 `BimObjectModel` 做业务遍历。

## 6. 加载 IFC——Ara3D.IfcLoader

`Ara3D.IfcLoader` 负责读 IFC。它采用**混合策略**：

- **几何**：通过 P/Invoke 调用原生 `web-ifc`（`ext/` 目录下的 `web-ifc-library.dll`，来自著名的 [ThatOpen/web-ifc](https://github.com/ThatOpen/engine_web-ifc) 项目）——工业级、快速的 IFC 几何三角化；
- **属性**：走第 07 章的纯 C# `StepParser` 分词器，零拷贝提取属性数据。

```csharp
public class IfcFile : IDisposable
{
    public IfcFile(string path);                 // 加载 IFC
    public IReadOnlyList<IfcMesh>    Meshes    { get; }
    public IReadOnlyList<IfcEntity>  Entities  { get; }
    public StepDocument              StepData  { get; }  // 属性来源
    public void Dispose();
}
```

```csharp
using var ifc = new IfcFile("building.ifc");
Console.WriteLine($"网格数: {ifc.Meshes.Count}, 实体数: {ifc.Entities.Count}");
```

> P/Invoke 原生库意味着 IfcLoader 是 Windows/平台相关的；分发时需带上 `ext/` 下的原生 DLL。

## 7. IFC → BOS——IfcToBosConverter

把 IFC 转成开放的 BOS 数据，只需一步：

```csharp
IBimData bim = IfcToBosConverter.Convert("building.ifc");

// 之后就能用统一的 BOS API 分析
foreach (var e in bim.Entities)
{
    var name     = bim.Strings[e.Name.Value];
    var category = bim.Strings[e.Category.Value];
    Console.WriteLine($"{category} / {name}");
}
```

转换器负责：字符串/数字/点去重进池、构建 EAV 参数表、解析 IFC 关系为 `EntityRelation`、把几何写进 `BimGeometry`。

## 8. 导出到数据工具

BOS 的最大价值是**用通用数据工具分析 BIM**。SDK 提供多种导出：

| 工具类 | 目标 | 说明 |
| --- | --- | --- |
| `ParquetUtils` | Apache Parquet | 列式，供 Pandas/Spark/DuckDB |
| `DuckDbUtils` | DuckDB | 直接建库/查询 |
| `ExcelUtils` | Excel `.xlsx` | 每表一个 sheet |
| `DataTableExportUtils` | CSV / Markdown / HTML / SQLite | 多格式导出 |

`DataTableExportUtils` 常用方法：

```csharp
DataTableExportUtils.WriteCsv(table, "out.csv");
DataTableExportUtils.WriteMarkdownTable(table, "out.md");
DataTableExportUtils.WriteHtmlTable(table, "out.html");
DataTableExportUtils.WriteSqlite(table, "out.db");
```

导出到 Parquet 后，用 DuckDB 直接 SQL 分析 BIM：

```sql
-- 统计各类别构件数量
SELECT category, COUNT(*) AS n
FROM 'entities.parquet'
GROUP BY category ORDER BY n DESC;
```

## 9. 一个端到端流水线

```csharp
using Ara3D.BimOpenSchema;
using Ara3D.IfcLoader;

// 1) IFC → BOS
IBimData bim = IfcToBosConverter.Convert("building.ifc");

// 2) 反规范化视图，做业务遍历
var model = bim.ToObjectModel();
var walls = model.Objects.Where(o => o.Category == "IfcWall").ToList();
Console.WriteLine($"墙体数量: {walls.Count}");

// 3) 导出参数表到 Parquet，供数据科学工具
ParquetUtils.Write(bim, "building_bos.parquet");

// 4) 也可写 SQLite 供轻量查询
DataTableExportUtils.WriteSqlite(bim.ToDataTable(), "building.db");
```

## 10. 本章小结

- **BOS（BimOpenSchema）** 是开放、列式、以关系为中心的 BIM 模式（v0.3）；
- `IBimData` 用 EAV + 去重池（Strings/Numbers/Points）存参数，用 `EntityRelation` 显式建模约 15 种关系；
- `BimGeometry` 以 6 张列式表存几何，支持实体共享；
- `BimObjectModel` 提供反规范化的面向对象视图，便于业务遍历；
- `Ara3D.IfcLoader` 混合策略：原生 web-ifc 取几何 + 纯 C# StepParser 取属性；
- `IfcToBosConverter.Convert()` 一步把 IFC 转成 BOS；
- 借助 `ParquetUtils`/`DuckDbUtils`/`ExcelUtils`/`DataTableExportUtils`，BIM 数据可无缝进入现代数据分析生态。

下一章转向交互式创作——Ara3D Studio 的插件（脚本组件）开发。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/ara3d-sdk/第08章-BIM与IFC数据处理/第07章-文件IO与三维数据格式/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/3d/ara3d-sdk/第08章-BIM与IFC数据处理/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/3d/ara3d-sdk/第08章-BIM与IFC数据处理/第09章-Ara3D-Studio插件开发/" style="text-decoration: none;">下一章 →</a>
</div>
