---
layout: default
title: 第15章：Schema 驱动开发——自定义元素类型
---

# 第15章：Schema 驱动开发——自定义元素类型

在第01章的解决方案结构中，我们提到 Elements 采用 **Schema-first** 的开发理念——类型系统首先在 JSON Schema 中定义，然后通过 `Elements.CodeGeneration` 工具链生成 C# 类。这种设计意味着**你定义的自定义元素类型与核心库的内置类型（Wall、Beam、Column 等）在天花板上没有差别**。

本章将深入讲解如何编写 JSON Schema 来定义你自己的元素类型，理解代码生成工具链的内部机制，并动手完成两个实战示例。

## 15.1 Schema-first 理念回顾

### 15.1.1 为什么 Schema-first

传统的 C# 建模库通常是"代码优先"——先手写 C# 类，再（可选地）从代码生成 Schema。Elements 反其道而行之：

```
传统方式:   C# 代码  ──→  JSON Schema（事后产物，常不同步）
Elements:   JSON Schema  ──→  C# 代码（Schema 是唯一的真相来源）
```

这种设计带来三个核心优势：

| 优势 | 说明 |
| --- | --- |
| **语言无关** | Schema 是跨语言的——同一个 Schema 理论上可以生成 C#、Python、TypeScript 等多种语言的类型定义 |
| **序列化验证** | JSON 序列化/反序列化时可以用 Schema 做精确验证，确保数据完整性 |
| **平等的扩展机制** | 你定义的自定义类型和核心库的 Wall、Beam 采用**完全相同**的定义方式和生成流程——没有"二等公民" |

### 15.1.2 核心类型与第三方类型的统一性

打开 `Elements.CodeGeneration/src/TypeGenerator.cs`，你会看到 `_coreTypeNames` 数组列出了所有核心类型名称（Element、GeometricElement、Wall、Beam 等共 40+ 个）。代码生成时，这些类型会被**排除**（不重复生成），但它们的 Schema 定义格式与你的自定义类型没有任何区别：

```csharp
// TypeGenerator.cs 中的核心类型排除列表（节选）
private static readonly string[] _coreTypeNames = new string[]{
    "Element",
    "GeometricElement",
    "Material",
    "Model",
    "Extrude",
    "Sweep",
    "Lamina",
    "Vector3",
    "Polygon",
    "Profile",
    // ... 共 40+ 个
};
```

这意味着：核心类型 = JSON Schema 定义 → 代码生成 → 编译进 `Hypar.Elements.dll`；你的自定义类型 = JSON Schema 定义 → 代码生成 → 编译进你自己的项目。流程完全一致。

## 15.2 JSON Schema 定义元素类型

### 15.2.1 基础骨架

每一个 Elements 类型的 Schema 必须包含以下标准字段：

```json
{
    "$id": "https://example.com/Schemas/MyType.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "MyType",
    "x-namespace": "MyProject.Elements",
    "type": ["object", "null"],
    "description": "我的自定义元素类型。",
    "discriminator": "discriminator",
    "required": ["discriminator"],
    "properties": {
        "discriminator": {
            "type": "string"
        }
    },
    "additionalProperties": false
}
```

各字段的含义：

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `$id` | 推荐 | Schema 的唯一标识符（URI）。代码生成器用它来解析 `$ref` 引用和避免重复生成 |
| `$schema` | 是 | 固定为 draft-07 |
| `title` | 是 | 生成的 C# 类名。`ElementsTypeNameGenerator` 直接使用此值作为类名 |
| `x-namespace` | 是 | Elements 自定义扩展属性。**代码生成器强制要求此属性存在**，否则返回错误："The provided schema does not contain the required 'x-namespace' property." |
| `type` | 是 | 值 `["object", "null"]` 表示可空引用类型（生成的属性将为 `MyType?`） |
| `discriminator` | 见下 | **多态标记字段**。所有继承 Element 的类型必须声明此字段为 `"discriminator"`。序列化时，此字段的值是具体的 C# 类型全名（如 `"Elements.Wall"`），反序列化时 `JsonInheritanceConverter` 用它定位正确的目标类型 |
| `required` | 是 | 必须包含 `"discriminator"`。此外还应列出业务必需属性 |
| `properties` | 是 | 类型的所有属性定义 |
| `additionalProperties` | 推荐 | 设为 `false` 确保 Schema 严格匹配，防止意外属性混入 |

### 15.2.2 discriminator 多态标记

`discriminator` 是 Elements 类型系统的核心机制。它解决的是 JSON 反序列化的一个经典问题：**如何从一个 JSON 对象恢复为正确的派生类型**。

考虑以下场景：模型的 `Elements` 字典中混合存储了 `Wall`、`Beam`、`Column` 等不同类型。反序列化时，JSON 解析器不知道应该创建哪个 C# 类。`discriminator` 字段就是答案：

```json
{
    "discriminator": "Elements.Wall",
    "Id": "abc-123",
    "CenterLine": { ... },
    "Profile": { ... }
}
```

当反序列化器读到 `"discriminator": "Elements.Wall"` 时，`JsonInheritanceConverter`（或新版 `ElementConverter`）会查找已加载的程序集中名为 `Wall` 的类型，然后以该类型为目标进行反序列化。

**在你的 Schema 中，必须：**

1. 在 `properties` 中声明 `discriminator` 属性（类型为 `string`）
2. 在 `required` 中包含 `"discriminator"`
3. 在 Schema 顶层设置 `"discriminator": "discriminator"`（告诉 NJsonSchema 用于多态的字段名）

### 15.2.3 属性定义规范

每个属性使用标准的 JSON Schema 语法定义。以下是一个包含各种属性类型的示例：

```json
"properties": {
    "Name": {
        "description": "元素的名称。",
        "type": ["string", "null"]
    },
    "Length": {
        "description": "长度（米）。",
        "type": "number",
        "minimum": 0,
        "default": 1.0
    },
    "Count": {
        "description": "数量。",
        "type": "integer",
        "default": 1
    },
    "IsActive": {
        "description": "是否激活。",
        "type": "boolean",
        "default": true
    },
    "Position": {
        "description": "位置坐标。",
        "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/Geometry/Vector3.json"
    },
    "Tags": {
        "description": "标签列表。",
        "type": "array",
        "items": {
            "type": "string"
        }
    }
}
```

几个关键点：

- **`$ref` 引用**：引用其他 Schema 定义的复杂类型（如 `Vector3`、`Profile`）。被引用的类型由代码生成器自动解析并生成对应的 `.g.cs` 文件（除非已在排除列表中）
- **`default`**：默认值。JSON 反序列化时如果属性缺失，使用此默认值
- **`minimum`/`maximum`**：数值约束。生成的 C# 代码目前不强制这些约束（它们仅在 Schema 层面有效），但可用于文档说明和数据验证
- **可空类型**：`"type": ["string", "null"]` 在 C# 中对应 `string?`

### 15.2.4 继承：allOf 机制

Elements 使用 `allOf` + `$ref` 实现类型继承。以下对比三种常见继承场景：

**场景 1：继承 Element（纯数据元素）**

```json
{
    "title": "MyDataElement",
    "x-namespace": "MyProject",
    "type": ["object", "null"],
    "allOf": [
        {
            "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/Element.json"
        }
    ],
    "required": ["discriminator"],
    "properties": {
        "discriminator": { "type": "string" },
        "MyCustomProperty": { "type": "string" }
    }
}
```

**场景 2：继承 GeometricElement（带几何的元素）**

```json
{
    "title": "MyFurniture",
    "x-namespace": "MyProject",
    "type": ["object", "null"],
    "allOf": [
        {
            "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/GeometricElement.json"
        }
    ],
    "required": ["discriminator"],
    "properties": {
        "discriminator": { "type": "string" },
        "Style": { "type": "string" }
    }
}
```

**场景 3：继承自定义基类**

```json
{
    "title": "SpecialFurniture",
    "x-namespace": "MyProject",
    "type": ["object", "null"],
    "allOf": [
        {
            "$ref": "./MyFurniture.json"
        }
    ],
    "required": ["discriminator"],
    "properties": {
        "discriminator": { "type": "string" },
        "SpecialFeature": { "type": "string" }
    }
}
```

`allOf` 相当于 C# 的 `: BaseClass`。代码生成器会将 `allOf` 中的所有 `$ref` 合并，生成的 C# 类将继承被引用类型的所有属性。

> 注意：新版本的 Elements 序列化已从 Newtonsoft.Json 迁移到 System.Text.Json。这影响了某些特性的处理方式（如 `JsonProperty` 变为 `JsonPropertyName`，不再支持 `Required` 参数等），但 Schema 定义格式保持不变。

## 15.3 Schema 目录组织

### 15.3.1 官方 Schemas 目录结构

Elements 仓库的 `Schemas/` 目录是所有核心类型的根：

```
Schemas/
├── Element.json                  # 基类型：Element
├── GeometricElement.json         # 几何元素基类（继承 Element）
├── Material.json                 # 材质
├── Model.json                    # 模型容器
├── ContentElement.json           # 内容元素（引用外部 glTF）
├── ContentCatalog.json           # 内容目录
├── Geometry/
│   ├── Vector3.json              # 三维向量
│   ├── Line.json                 # 线段
│   ├── Arc.json                  # 圆弧
│   ├── Polygon.json              # 多边形
│   ├── Polyline.json             # 多段线
│   ├── Profile.json              # 剖面/轮廓
│   ├── Transform.json            # 变换矩阵
│   ├── Plane.json                # 平面
│   ├── BBox3.json                # 三维包围盒
│   ├── Color.json                # 颜色
│   ├── Curve.json                # 曲线（抽象基类）
│   ├── Mesh.json                 # 网格
│   ├── Triangle.json             # 三角形
│   ├── UV.json                   # UV 坐标
│   ├── Vertex.json               # 顶点
│   ├── Matrix.json               # 矩阵
│   ├── Representation.json       # 表示容器
│   └── Solids/
│       ├── SolidOperation.json   # 实体操作基类
│       ├── Extrude.json          # 拉伸
│       ├── Sweep.json            # 扫描
│       └── Lamina.json           # 层板
└── GeoJSON/                      # GeoJSON 相关类型
```

### 15.3.2 组织你的自定义 Schema

建议按照以下约定组织你自己的 Schema：

```
MyProject/
├── MyProject.csproj
├── Schemas/                      # 你的 Schema 定义
│   ├── MyFurniture.json
│   ├── MyProgress.json
│   └── Geometry/                 # 自定义几何类型（如有）
│       └── MyCustomProfile.json
├── Generated/                    # 代码生成输出目录
│   ├── MyFurniture.g.cs
│   ├── MyProgress.g.cs
│   └── MyCustomProfile.g.cs
└── Extensions/                   # 手写扩展代码（partial 类）
    ├── MyFurniture.Override.cs   # 覆写 UpdateRepresentations
    └── MyProgress.Override.cs
```

关键约定：
- **`.g.cs` 后缀**：表示 Generated（生成）文件，应纳入 `.gitignore` 或明确标记为自动生成
- **`partial` 类**：生成的都是 `partial class`，方便你在另一个文件中手写扩展逻辑
- **引用路径**：外部 Schema 使用完整的 GitHub raw URL；内部 Schema 使用相对路径（如 `"./Geometry/MyCustomProfile.json"`）

## 15.4 Elements.CodeGeneration 代码生成流程

`Elements.CodeGeneration` 项目是整个 Schema-first 工作流的核心引擎。它基于三个组件协同工作：

### 15.4.1 整体架构

```
JSON Schema（draft-07）
    │
    ▼
┌──────────────────────────────────────┐
│         TypeGenerator                │
│  - GenerateUserElementTypeFromUriAsync│
│  - GenerateInMemoryAssembly...       │
│  - GetSchemaAsync (url/本地文件)      │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│       NJsonSchema 解析               │
│  JsonSchema.FromJsonAsync()          │
│  解析 $ref / allOf / discriminator   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│      C# 代码生成                     │
│  ├─ ElementsTypeNameGenerator        │
│  ├─ ElementsPropertyNameGenerator    │
│  ├─ TypeResolver (CSharpTypeResolver)│
│  └─ CSharpGenerator (NJsonSchema)    │
│      └─ DotLiquid 模板渲染           │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│       后处理 & 写入磁盘               │
│  - FileTweaksAndCleanup()            │
│  - 写入 .g.cs 文件                   │
└──────────────────────────────────────┘
```

### 15.4.2 TypeGenerator：入口与调度

`TypeGenerator` 是静态工具类，提供多种代码生成入口：

| 方法 | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| `GenerateUserElementTypeFromJsonAsync(schemaJson, outputDir)` | JSON 字符串 | `.g.cs` 文件 | 程序化生成，适合嵌入到构建流程 |
| `GenerateUserElementTypeFromUriAsync(uri, outputDir)` | URL 或本地路径 | `.g.cs` 文件 | 通过 hypar.json 的 `element_types` 配置调用 |
| `GenerateUserElementTypesFromUrisAsync(uris, outputDir)` | URL 数组 | 多个 `.g.cs` 文件 | 批量生成（并行） |
| `GenerateInMemoryAssemblyFromUrisAndLoadAsync(uris)` | URL 数组 | 已加载的 `Assembly` | Web 应用（如 Playground）的即时编译场景 |
| `GenerateInMemoryAssemblyFromUrisAndSaveAsync(uris, dllPath)` | URL 数组 | `.dll` 文件 | 生成可重用的程序集 |

核心工作流（以 `GenerateUserElementTypeFromUriAsync` 为例）：

1. **加载 Schema**：`GetSchemaAsync(uri)` — 如果 uri 以 `http` 开头，使用 `JsonSchema.FromUrlAsync()`；否则作为本地文件路径加载
2. **提取命名空间**：检查 `x-namespace` 扩展属性（不存在则报错）
3. **获取类型名**：使用 `schema.Title`
4. **排除已存在的类型**：合并 `_coreTypeNames` + 已加载程序集中的类型，避免重复生成
5. **调用 `GetCodeForTypesFromSchema`**：配置 `CSharpGeneratorSettings` → 创建 `CSharpGenerator` → 生成代码
6. **后处理**：`FileTweaksAndCleanup`（如将某些类型改为 struct）
7. **写入磁盘**：检查文件是否已存在且内容一致（避免重复写入）

### 15.4.3 自定义命名与类型解析

代码生成器定制了 NJsonSchema 的默认行为：

**ElementsTypeNameGenerator（`ITypeNameGenerator`）**：

```csharp
public string Generate(JsonSchema schema, string typeNameHint, 
                        IEnumerable<string> reservedTypeNames)
{
    if (schema.IsEnumeration || string.IsNullOrEmpty(schema.Title))
    {
        // 没有 Title 时使用属性名作为类型名
        if (typeNameHint == null)
        {
            var identifier = $"UnknownType_{Guid.NewGuid()...}";
            Console.WriteLine($"Encountered a schema with no Title property...");
            return identifier;
        }
        return typeNameHint;
    }
    // 有 Title 时直接使用 Title
    return schema.Title.ToSafeIdentifier();
}
```

**TypeResolver（`CSharpTypeResolver`）**：

```csharp
public override string Resolve(JsonSchema schema, bool isNullable, 
                                string typeNameHint)
{
    // 特殊处理：允许空属性的 object schema 生成代码
    if (schema.Type == JsonObjectType.Object && schema.Properties.Count() == 0)
    {
        GetOrGenerateTypeName(schema, typeNameHint);
        return typeNameHint;
    }
    var baseResult = base.Resolve(schema, isNullable, typeNameHint);
    // Vector3 和 Color 类型允许 nullable
    if (_typesToMakeNullable.Contains(baseResult) && isNullable)
    {
        return $"{baseResult}?";
    }
    return baseResult;
}
```

### 15.4.4 CatalogGenerator：内容目录生成

除了类型生成，`Elements.CodeGeneration` 还包含 `CatalogGenerator`——它从一个 `ContentCatalog` JSON 文件生成静态 C# 类，其中每个属性对应一个预定义的 `ContentElement`：

```csharp
// CatalogGenerator.FromUri("my-catalog.json", "./Generated");
// 生成的代码示例：
public static class MyCatalog
{
    public static ContentElement Chair1 => new ContentElement(...);
    public static ContentElement Table => new ContentElement(...);
}
```

这主要用于将外部 3D 模型（glTF）打包为 Elements 可用的 `ContentElement`。

### 15.4.5 自定义扩展属性

除了标准的 `x-namespace`，Elements 还支持 `x-struct` 扩展属性。当 Schema 中设置 `"x-struct": true` 时，`FileTweaksAndCleanup` 会将生成的 `class` 替换为 `struct`：

```json
{
    "title": "Vector3",
    "x-namespace": "Elements.Geometry",
    "x-struct": true,
    "...": "..."
}
```

→ 生成 `public partial struct Vector3 { ... }` 而非 `public partial class Vector3 { ... }`

这种机制用于 `Vector3`、`Color` 等轻量级值类型。

## 15.5 自定义 GeometricElement 子类的 Schema 定义要点

### 15.5.1 必须继承 GeometricElement

如果元素需要在三维空间中显示，Schema 必须通过 `allOf` 继承 `GeometricElement`：

```json
"allOf": [
    {
        "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/GeometricElement.json"
    }
]
```

生成的 C# 类将自动获得 `Transform`、`Material`、`Representation`、`IsElementDefinition` 等属性，以及 `CreateInstance()`、`HasGeometry()`、`UpdateBoundsAndComputeSolid()` 等方法。

### 15.5.2 必须覆写 UpdateRepresentations

`GeometricElement.UpdateRepresentations()` 是一个虚方法，默认实现为空。**这是几何生成的总入口**——你必须在 `partial` 类中覆写它来填充 `Representation.SolidOperations`。

生成代码的流程：

1. 运行代码生成，得到带有业务属性的 `partial class MyFurniture : GeometricElement`
2. 在同项目的另一个文件中，写 `partial class` 的同名文件，覆写 `UpdateRepresentations`：

```csharp
// MyFurniture.Override.cs（手写文件）
using Elements.Geometry;
using Elements.Geometry.Solids;

namespace MyProject;

public partial class MyFurniture
{
    public override void UpdateRepresentations()
    {
        Representation ??= new Representation();

        if (Width <= 0 || Depth <= 0 || Height <= 0)
            return;

        // 使用 Extrude 创建长方体
        var profile = new Profile(
            Polygon.Rectangle(Width, Depth)
        );

        var extrude = new Extrude(
            profile,
            Height,
            Vector3.ZAxis,
            false
        );

        Representation.SolidOperations.Add(extrude);
    }
}
```

### 15.5.3 RepresentaionInstance 支持（可选）

如果你希望元素支持多视图表示（如结构视图 vs 建筑视图），可在 Schema 中添加 `RepresentationInstances` 属性：

```json
"RepresentationInstances": {
    "description": "The element's additional representation instances.",
    "type": "array",
    "items": {
        "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/..."
    }
}
```

大多数简单场景不需要此机制——使用默认的单 `Representation` + 单 `Material` 即可。

## 15.6 自定义非几何元素

### 15.6.1 继承 Element（纯数据管理）

并非所有元素都需要几何表示。BIM 项目中大量的非几何数据——如设备参数表、施工进度、成本估算、审批状态——可以作为 `Element` 的直接子类：

```json
{
    "$id": "https://example.com/Schemas/ConstructionProgress.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ConstructionProgress",
    "x-namespace": "MyProject.Construction",
    "type": ["object", "null"],
    "allOf": [
        {
            "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/Element.json"
        }
    ],
    "description": "施工进度数据。",
    "required": ["discriminator", "PhaseName", "PlannedStart", "PlannedEnd"],
    "properties": {
        "discriminator": { "type": "string" },
        "PhaseName": {
            "description": "阶段名称。",
            "type": "string"
        },
        "PlannedStart": {
            "description": "计划开始日期。",
            "type": "string",
            "format": "date"
        },
        "PlannedEnd": {
            "description": "计划结束日期。",
            "type": "string",
            "format": "date"
        },
        "ActualStart": {
            "description": "实际开始日期。",
            "type": ["string", "null"],
            "format": "date"
        },
        "ActualEnd": {
            "description": "实际结束日期。",
            "type": ["string", "null"],
            "format": "date"
        },
        "ProgressPercent": {
            "description": "完成百分比（0-100）。",
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "default": 0
        },
        "Status": {
            "description": "状态：planned/in-progress/completed/delayed",
            "type": "string",
            "default": "planned"
        },
        "AssignedContractor": {
            "description": "承包商标识。",
            "type": ["string", "null"]
        }
    },
    "additionalProperties": false
}
```

对应的生成 C# 类：

```csharp
// ConstructionProgress.g.cs（自动生成）
[JsonConverter(typeof(JsonInheritanceConverter), new object[] { "discriminator" })]
public partial class ConstructionProgress : Element
{
    [JsonPropertyName("PhaseName")]
    public string PhaseName { get; set; }

    [JsonPropertyName("PlannedStart")]
    public string PlannedStart { get; set; }

    [JsonPropertyName("PlannedEnd")]
    public string PlannedEnd { get; set; }

    [JsonPropertyName("ActualStart")]
    public string ActualStart { get; set; }

    [JsonPropertyName("ActualEnd")]
    public string ActualEnd { get; set; }

    [JsonPropertyName("ProgressPercent")]
    [DefaultValue(0)]
    public double ProgressPercent { get; set; } = 0;

    [JsonPropertyName("Status")]
    [DefaultValue("planned")]
    public string Status { get; set; } = "planned";

    [JsonPropertyName("AssignedContractor")]
    public string AssignedContractor { get; set; }
}
```

纯数据元素添加到 `Model` 中后，可以通过 `AllElementsOfType<T>()` 查询，与几何元素一起序列化/反序列化——它们只是不参与渲染。

### 15.6.2 关联几何元素

纯数据元素通常需要关联到具体的几何元素。推荐使用 `Guid` 引用：

```json
"RelatedElementIds": {
    "description": "关联的几何元素 ID 列表。",
    "type": "array",
    "items": { "type": "string" }
}
```

在运行时通过 `model.GetElementOfType<T>(guid)` 查找对应的几何元素。

## 15.7 代码生成产物：\*.g.cs 文件

### 15.7.1 生成文件的标准格式

运行代码生成后，每个 Schema 会生成一个 `.g.cs` 文件。以下是一个生成文件的典型结构：

```csharp
// MyFurniture.g.cs（自动生成）
using Elements;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Text.Json.Serialization;

namespace MyProject
{
    [JsonConverter(typeof(JsonInheritanceConverter), new object[] { "discriminator" })]
    public partial class MyFurniture : GeometricElement
    {
        [JsonPropertyName("Style")]
        public string Style { get; set; }

        [JsonPropertyName("Width")]
        [DefaultValue(1.0)]
        public double Width { get; set; } = 1.0;

        [JsonPropertyName("Depth")]
        [DefaultValue(1.0)]
        public double Depth { get; set; } = 1.0;

        [JsonPropertyName("Height")]
        [DefaultValue(0.75)]
        public double Height { get; set; } = 0.75;

        [JsonConstructor]
        public MyFurniture(
            string style,
            double width,
            double depth,
            double height,
            Transform transform,
            Material material,
            Representation representation,
            bool isElementDefinition,
            Guid id,
            string name)
            : base(transform, material, representation, isElementDefinition, id, name)
        {
            Style = style;
            Width = width;
            Depth = depth;
            Height = height;
        }

        public MyFurniture() { }
    }
}
```

关键约定：

- **`[JsonConverter(typeof(JsonInheritanceConverter), ...)]`**：注册自定义 JSON 转换器，处理多态反序列化
- **`partial class`**：必须保持 `partial`，方便你扩展
- **`[JsonPropertyName]`**：System.Text.Json 的属性名映射（替代了旧版的 `[JsonProperty]`）
- **`[JsonConstructor]`**：标记 JSON 反序列化使用的构造函数
- **参数顺序**：生成器按 properties 定义顺序排列参数，基类参数（如 `Transform`、`Material`）排在末尾
- **无参构造函数**：始终生成一个无参构造函数，用于 `Activator.CreateInstance` 等场景
- **`[DefaultValue]`**：标记默认值（目前仅用于文档和工具提示，不影响序列化行为）

### 15.7.2 版本迁移说明

如果你参考较旧版本的 Elements 文档或代码，可能看到以下差异：

| 旧版 (Newtonsoft.Json) | 新版 (System.Text.Json) |
| --- | --- |
| `[JsonProperty("name")]` | `[JsonPropertyName("name")]` |
| `using Newtonsoft.Json;` | `using System.Text.Json.Serialization;` |
| `JsonConverter(typeof(JsonInheritanceConverter), "discriminator")` | `JsonConverter(typeof(JsonInheritanceConverter), new object[] { "discriminator" })` |
| `out errors` 反序列化参数 | 不再支持（`ModelConverter` 内部处理） |
| `[JsonProperty(Required = Required.Always)]` | 不支持（需通过 `required` 关键字或自定义验证） |

本教程的代码示例基于当前主流版本。如果遇到反序列化兼容性问题，请参考 [hypar-io/Elements PR #870](https://github.com/hypar-io/Elements/pull/870)。

## 15.8 实战示例

### 15.8.1 示例一：家具元素（继承 GeometricElement）

目标：定义一个"家具"元素，包含长、宽、高属性，用 `Extrude` 创建简单的长方体几何。

**步骤 1：编写 JSON Schema**

文件：`Schemas/FurnitureElement.json`

```json
{
    "$id": "https://example.com/Schemas/FurnitureElement.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "FurnitureElement",
    "x-namespace": "MyProject.Elements",
    "type": ["object", "null"],
    "allOf": [
        {
            "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/GeometricElement.json"
        }
    ],
    "description": "一个家具元素，通过拉伸长方体表示。",
    "required": ["discriminator", "Length", "Width", "Height"],
    "discriminator": "discriminator",
    "properties": {
        "discriminator": {
            "type": "string"
        },
        "Length": {
            "description": "家具长度（沿 X 轴，米）。",
            "type": "number",
            "minimum": 0.01,
            "default": 1.0
        },
        "Width": {
            "description": "家具宽度（沿 Y 轴，米）。",
            "type": "number",
            "minimum": 0.01,
            "default": 0.6
        },
        "Height": {
            "description": "家具高度（沿 Z 轴，米）。",
            "type": "number",
            "minimum": 0.01,
            "default": 0.75
        },
        "Category": {
            "description": "家具分类（如 desk, chair, cabinet）。",
            "type": "string",
            "default": "desk"
        },
        "MaterialName": {
            "description": "材质显示名称。",
            "type": "string",
            "default": "橡木"
        }
    },
    "additionalProperties": false
}
```

**步骤 2：运行代码生成**

```csharp
// 在构建脚本或初始化代码中
using Elements.Generate;

var schemaJson = File.ReadAllText("Schemas/FurnitureElement.json");
var result = await TypeGenerator.GenerateUserElementTypeFromJsonAsync(
    schemaJson,
    "Generated/"
);

if (result.Success)
{
    Console.WriteLine($"代码已生成到: {result.FilePath}");
}
else
{
    Console.WriteLine($"生成失败: {string.Join(", ", result.DiagnosticResults)}");
}
```

**步骤 3：生成的 FurnitureElement.g.cs**

```csharp
// FurnitureElement.g.cs（自动生成）
using Elements;
using System;
using System.ComponentModel;
using System.Text.Json.Serialization;

namespace MyProject.Elements
{
    [JsonConverter(typeof(JsonInheritanceConverter), new object[] { "discriminator" })]
    public partial class FurnitureElement : GeometricElement
    {
        [JsonPropertyName("Length")]
        [DefaultValue(1.0)]
        public double Length { get; set; } = 1.0;

        [JsonPropertyName("Width")]
        [DefaultValue(0.6)]
        public double Width { get; set; } = 0.6;

        [JsonPropertyName("Height")]
        [DefaultValue(0.75)]
        public double Height { get; set; } = 0.75;

        [JsonPropertyName("Category")]
        [DefaultValue("desk")]
        public string Category { get; set; } = "desk";

        [JsonPropertyName("MaterialName")]
        [DefaultValue("橡木")]
        public string MaterialName { get; set; } = "橡木";

        [JsonConstructor]
        public FurnitureElement(
            double length, double width, double height,
            string category, string materialName,
            Transform transform, Material material,
            Representation representation,
            bool isElementDefinition, Guid id, string name)
            : base(transform, material, representation, isElementDefinition, id, name)
        {
            Length = length;
            Width = width;
            Height = height;
            Category = category;
            MaterialName = materialName;
        }

        public FurnitureElement() { }
    }
}
```

**步骤 4：手写 Geometry 覆写（FurnitureElement.Geometry.cs）**

```csharp
// FurnitureElement.Geometry.cs（手写 partial 类）
using Elements.Geometry;
using Elements.Geometry.Solids;

namespace MyProject.Elements;

public partial class FurnitureElement
{
    public override void UpdateRepresentations()
    {
        Representation ??= new Representation();

        if (Length <= 0 || Width <= 0 || Height <= 0)
            return;

        // 用矩形轮廓创建拉伸体
        var profile = new Profile(
            Polygon.Rectangle(Length, Width)
        );

        var extrude = new Extrude(
            profile,
            Height,
            Vector3.ZAxis,
            false          // 非挖空
        );

        Representation.SolidOperations.Add(extrude);
    }
}
```

**步骤 5：使用自定义元素**

```csharp
using Elements;
using Elements.Geometry;
using MyProject.Elements;

var model = new Model();

// 创建一张书桌
var desk = new FurnitureElement(
    length: 1.6,
    width: 0.8,
    height: 0.75,
    category: "desk",
    materialName: "橡木",
    transform: new Transform(new Vector3(3, 2, 0)),
    material: new Material("橡木", new Color(0.6, 0.4, 0.2, 1.0)),
    representation: null,
    isElementDefinition: false,
    id: Guid.NewGuid(),
    name: "书桌-01"
);

model.AddElement(desk);

// 创建一把椅子
var chair = new FurnitureElement(
    length: 0.5,
    width: 0.5,
    height: 0.45,
    category: "chair",
    materialName: "黑色皮革",
    transform: new Transform(new Vector3(3.5, 1.2, 0)),
    material: new Material("皮革", new Color(0.1, 0.1, 0.1, 0.8)),
    representation: null,
    isElementDefinition: false,
    id: Guid.NewGuid(),
    name: "椅子-01"
);

model.AddElement(chair);

// 查询所有家具
var allFurniture = model.AllElementsOfType<FurnitureElement>();
Console.WriteLine($"共 {allFurniture.Count} 件家具");

// 按分类筛选
var desks = allFurniture.Where(f => f.Category == "desk");
Console.WriteLine($"其中书桌 {desks.Count()} 件");

// 导出
model.ToGlTF("furniture.glb");
```

### 15.8.2 示例二：施工进度元素（继承 Element）

目标：定义一个纯数据元素，用于管理施工进度信息。

**步骤 1：编写 JSON Schema**

文件：`Schemas/ConstructionPhase.json`

```json
{
    "$id": "https://example.com/Schemas/ConstructionPhase.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ConstructionPhase",
    "x-namespace": "MyProject.Construction",
    "type": ["object", "null"],
    "allOf": [
        {
            "$ref": "https://raw.githubusercontent.com/hypar-io/Elements/master/Schemas/Element.json"
        }
    ],
    "description": "施工阶段进度数据。",
    "required": [
        "discriminator",
        "PhaseName",
        "PlannedStart",
        "PlannedEnd"
    ],
    "discriminator": "discriminator",
    "properties": {
        "discriminator": {
            "type": "string"
        },
        "PhaseName": {
            "description": "阶段名称，如'基础施工'、'主体结构'。",
            "type": "string"
        },
        "PlannedStart": {
            "description": "计划开始日期（ISO 8601）。",
            "type": "string",
            "format": "date"
        },
        "PlannedEnd": {
            "description": "计划结束日期（ISO 8601）。",
            "type": "string",
            "format": "date"
        },
        "ActualStart": {
            "description": "实际开始日期。",
            "type": ["string", "null"],
            "format": "date"
        },
        "ActualEnd": {
            "description": "实际结束日期。",
            "type": ["string", "null"],
            "format": "date"
        },
        "ProgressPercent": {
            "description": "完成百分比（0-100）。",
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "default": 0
        },
        "Status": {
            "description": "状态：planned / in-progress / completed / delayed",
            "type": "string",
            "default": "planned"
        },
        "RelatedElementIds": {
            "description": "关联的几何元素 GUID 列表。",
            "type": "array",
            "items": {
                "type": "string"
            }
        },
        "Notes": {
            "description": "备注。",
            "type": ["string", "null"]
        }
    },
    "additionalProperties": false
}
```

**步骤 2：运行代码生成**

```csharp
var result = await TypeGenerator.GenerateUserElementTypeFromUriAsync(
    "./Schemas/ConstructionPhase.json",
    "./Generated/"
);
```

**步骤 3：使用施工进度数据**

```csharp
using Elements;
using MyProject.Construction;

var model = new Model();

// 记录基础施工阶段
var foundationPhase = new ConstructionPhase
{
    Id = Guid.NewGuid(),
    Name = "PH-01",
    PhaseName = "基础施工",
    PlannedStart = "2026-03-01",
    PlannedEnd = "2026-04-15",
    ActualStart = "2026-03-05",
    ActualEnd = "2026-04-20",
    ProgressPercent = 100,
    Status = "completed",
    Notes = "因雨季延误5天"
};

model.AddElement(foundationPhase);

// 记录主体结构阶段（进行中）
var structurePhase = new ConstructionPhase
{
    Id = Guid.NewGuid(),
    Name = "PH-02",
    PhaseName = "主体结构",
    PlannedStart = "2026-04-16",
    PlannedEnd = "2026-07-30",
    ActualStart = "2026-04-22",
    ProgressPercent = 60,
    Status = "in-progress",
    RelatedElementIds = new List<string>
    {
        "col-001", "col-002", "beam-001", "slab-001"
    }
};

model.AddElement(structurePhase);

// 查询所有施工阶段
var allPhases = model.AllElementsOfType<ConstructionPhase>();

// 统计
var completed = allPhases.Where(p => p.Status == "completed");
var inProgress = allPhases.Where(p => p.Status == "in-progress");
var delayed = allPhases.Where(p => p.Status == "delayed");

Console.WriteLine($"施工阶段总数: {allPhases.Count}");
Console.WriteLine($"已完成: {completed.Count()}, 进行中: {inProgress.Count()}, 延误: {delayed.Count()}");

// 序列化为 JSON（可与 BIM 几何数据一起保存）
var json = model.ToJson();
File.WriteAllText("project-data.json", json);
```

### 15.8.3 验证生成的 C# 类

生成的代码可以通过以下方式验证：

```csharp
// 1. 编译检查——确保生成的 .g.cs 文件能通过编译
//    dotnet build

// 2. 反射检查——确认生成的类型正确继承了基类
var furnitureType = typeof(FurnitureElement);
Console.WriteLine($"基类: {furnitureType.BaseType?.Name}");
// 输出: 基类: GeometricElement

Console.WriteLine($"是 Element? {typeof(Element).IsAssignableFrom(furnitureType)}");
// 输出: 是 Element? True

Console.WriteLine($"是 GeometricElement? {typeof(GeometricElement).IsAssignableFrom(furnitureType)}");
// 输出: 是 GeometricElement? True

// 3. 序列化往返测试——确保 JSON 序列化/反序列化不丢失数据
var model = new Model();
var desk = new FurnitureElement(1.6, 0.8, 0.75, "desk", "橡木",
    new Transform(), null, null, false, Guid.NewGuid(), "测试");
model.AddElement(desk);

var json = model.ToJson();
var deserialized = Model.FromJson(json);

var loadedDesk = deserialized.AllElementsOfType<FurnitureElement>().First();
Console.WriteLine($"往返后: Length={loadedDesk.Length}, Category={loadedDesk.Category}");
// 输出: 往返后: Length=1.6, Category=desk

// 4. 检查 discriminator 字段——确保多态标记正确
Console.WriteLine($"discriminator: {loadedDesk.GetType().FullName}");
// 输出: discriminator: MyProject.Elements.FurnitureElement
```

## 15.9 常见问题与最佳实践

### Schema 编写注意事项

1. **`x-namespace` 不可省略**：代码生成器会明确报错。选择有意义的命名空间（如 `MyCompany.BIM.Furniture`）
2. **`discriminator` 不可省略**：必须在 `properties` 和 `required` 中声明，否则序列化时无法识别类型
3. **`$ref` 路径的选择**：引用核心类型时使用完整的 GitHub raw URL（确保一致性和可追踪性）；引用项目内类型时使用相对路径
4. **`additionalProperties: false`**：防止 JSON 中混入未定义的属性，保持数据干净
5. **避免属性命名冲突**：不要使用 `discriminator`、`Id`、`Name` 等已在基类中定义的名称

### 扩展 vs 覆盖

- **Partial 类扩展**：不要直接修改 `.g.cs` 文件——下一次代码生成会覆盖它。始终在单独的 `.Override.cs` 或 `.Geometry.cs` 文件中写扩展代码
- **Schema 的演化**：修改 Schema → 重新生成 → 检查你的扩展代码是否仍然兼容
- **代码生成要纳入构建流程**：将代码生成步骤加入 MSBuild 的 `BeforeBuild` target，或在 CI 流水线中执行

### 运行时代码生成

对于 Web 应用场景（如 Elements Playground），可以使用 `GenerateInMemoryAssemblyFromUrisAndLoadAsync` 在运行时动态编译用户上传的 Schema：

```csharp
var result = await TypeGenerator.GenerateInMemoryAssemblyFromUrisAndLoadAsync(
    new[] { "./user-schema.json" }
);

if (result.Success)
{
    // 通过反射使用动态生成的类型
    var userType = result.Assembly.GetType("MySchema.MyType");
    var instance = Activator.CreateInstance(userType);
}
```

## 15.10 小结

本章完整覆盖了 Elements Schema 驱动开发的核心知识：

- **Schema-first 理念**：JSON Schema 是类型的唯一真相来源，核心类型和自定义类型使用相同的定义和生成方式
- **JSON Schema 语法**：draft-07 标准，`discriminator` 多态标记，`allOf` 继承，`x-namespace` 命名空间
- **代码生成引擎**：`TypeGenerator` → NJsonSchema 解析 → `CSharpGenerator` → DotLiquid 模板 → `.g.cs` 文件
- **两个实战示例**：`FurnitureElement`（几何类，extrude 长方体）和 `ConstructionPhase`（数据类，施工进度管理）
- **`.g.cs` 约定**：partial 类、`[JsonConstructor]`、`[JsonPropertyName]`，手写代码与生成代码分离

掌握了 Schema 驱动开发后，你可以将 Elements 从"使用内置类型建模"升级为"定义领域类型 → 自动生成代码 → 构建专属 BIM 数据模型"，真正将建筑模型变成可编程、可扩展的代码资产。

下一章将通过一个完整的综合案例，串联本教程所有的知识点——从几何创建到序列化导出，从空间搜索到自定义类型，构建一个可交付的建筑信息模型。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="第14章-组件化生成">← 上一章</a>
  <a href="./">目录</a>
  <a href="第16章-实战案例综合建模项目">下一章 →</a>
</div>
