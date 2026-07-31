---
layout: default
title: 第10章：序列化——JSON、glTF 与 IFC
---

# 第10章：序列化——JSON、glTF 与 IFC

Elements 最核心的价值之一是"一次建模，多格式输出"。你不需要为每种目标格式重复编写导出代码——Elements 在核心库和三个互操作扩展包中内置了完整的序列化管线，覆盖从文本交换到可视化渲染、从 BIM 协作到制图输出的全部场景。

本章将深入每条序列化管线的内部机制，从类型多态标记、三角剖分到 IFC 产品类型映射，帮助你理解"数据如何在格式之间流转"。

## 10.1 JSON 序列化（核心内置）

JSON 是 Elements 的原生序列化格式。模型以 JSON 存储时，数据完整保留——包括元素类型、几何参数、材质属性、空间关系——并且天然适合 Git 版本控制和 CI/CD 管线。

### 10.1.1 基本 API

Model 类提供三组序列化/反序列化方法，覆盖字符串、流和文件三个层面：

```csharp
using Elements;
using Elements.Serialization.JSON;

// ===== 序列化 =====

// 方式一：输出到文件（推荐，避免大对象堆上的字符串分配）
var model = new Model();
// ... 添加元素 ...
model.ToJson("output.json");

// 方式二：输出到内存流
using var stream = new MemoryStream();
model.ToJson(stream, indent: true);

// 方式三：输出为字符串（小模型可用）
string json = model.ToJson(indent: false);

// ===== 反序列化 =====

// 方式一：从字符串反序列化（带错误收集）
Model loaded = Model.FromJson(json, out List<string> errors);
if (errors.Any())
{
    foreach (var err in errors)
        Console.WriteLine($"反序列化警告: {err}");
}

// 方式二：忽略错误
Model loaded2 = Model.FromJson(json);

// 方式三：强制刷新类型缓存（动态加载了自定义元素类型时）
Model loaded3 = Model.FromJson(json, forceTypeReload: true);
```

### 10.1.2 Newtonsoft.Json 配置

Elements 使用 Newtonsoft.Json（而非 System.Text.Json），原因在于其支持 JSON Schema 代码生成和自定义转换器的灵活注册。核心序列化配置集中在 `JsonInheritanceConverter` 中：

```csharp
// JsonInheritanceConverter 是全局注册的自定义转换器
// 所有 Element 派生类通过 [JsonConverter] 特性标记：
[JsonConverter(typeof(JsonInheritanceConverter), "discriminator")]
public abstract class Element { ... }
```

这个转换器在序列化时同时承担三个职责：
1. **多态类型标记**：为每个序列化的对象注入 `discriminator` 字段
2. **引用去重**：同一元素多次被引用时，只序列化 Guid，后续引用替换为纯 Id
3. **类型缓存**：反序列化时通过全类型名查找 .NET 运行时类型

### 10.1.3 Discriminator 多态标记

当你序列化一个 `Wall` 对象时，JSON 中会包含它的全限定类型名：

```json
{
  "discriminator": "Elements.Wall",
  "Id": "a1b2c3d4-...",
  "Name": "外墙 A",
  "Transform": { ... },
  "Representation": { ... }
}
```

这个 `discriminator` 字段是反序列化时恢复正确 .NET 类型的关键。`JsonInheritanceConverter` 在序列化时将当前对象的运行时类型全名写入此字段：

```csharp
// 源码中的核心逻辑（简化）
private static string GetDiscriminatorName(object value)
{
    var t = value.GetType();
    // 泛型类型特殊处理：ElementProxy<Beam> → "Elements.ElementProxy<Elements.Beam>"
    if (t.IsGenericType)
        return $"{t.FullName.Split('`').First()}<{string.Join(",", t.GenericTypeArguments.Select(a => a.FullName))}>";
    else
        return t.FullName.Split('`').First();
}
```

反序列化时，转换器通过 `discriminator` 值在类型缓存中查找对应的 .NET 类型：

```csharp
// 反序列化流程
// 1. 读取 discriminator → "Elements.Wall"
// 2. 在 TypeCache 中查找 → typeof(Wall)
// 3. 如果找不到类型（例如用户自定义类型尚未加载），回退策略：
//    - 有 Representation 属性 → 反序列化为 GeometricElement
//    - 有 Id 属性 → 反序列化为 Element
//    - 都不满足 → 返回 objectType
```

这种回退机制确保了"向前兼容"——旧版 Elements 可以加载包含未来类型定义的 JSON，丢失的只是具体类型信息，几何数据仍然保留。

### 10.1.4 类型缓存机制

`JsonInheritanceConverter` 维护一个全局类型缓存字典，键是类型的全限定名（即 discriminator 值），值是 `System.Type` 对象：

```csharp
// 缓存初始化——遍历 AppDomain 中所有已加载程序集
private static Dictionary<string, Type> BuildAppDomainTypeCache(out List<string> failedAssemblyErrors)
{
    var typeCache = new Dictionary<string, Type>();
    foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
    {
        foreach (var t in assembly.GetTypes())
        {
            // 筛选规则：public class + 标记了 [JsonConverter(typeof(JsonInheritanceConverter))]
            if (t.IsPublic && t.IsClass &&
                t.GetCustomAttribute<JsonConverterAttribute>()?.ConverterType == typeof(JsonInheritanceConverter))
            {
                typeCache[t.FullName] = t;
            }
        }
    }
    return typeCache;
}
```

有两个关键设计点：
- **排除前缀优化**：`System.*`、`Newtonsoft.*` 等命名空间被排除，避免不必要的程序集扫描
- **手动刷新**：如果你在运行时动态加载了包含自定义元素类型的程序集，可以调用 `JsonInheritanceConverter.RefreshAppDomainTypeCache()` 或使用 `Model.FromJson(json, forceTypeReload: true)`

## 10.2 JSON 格式详解

### 10.2.1 Model JSON 结构

一个完整的 Elements JSON 文件的顶层结构：

```json
{
  "Transform": {
    "Matrix": {
      "Components": [ ... ]
    }
  },
  "Elements": {
    "a1b2c3d4-...": {
      "discriminator": "Elements.Wall",
      "Id": "a1b2c3d4-...",
      "Name": "外墙 A",
      "Transform": { ... },
      "Material": "e5f6g7h8-...",
      "Representation": {
        "SolidOperations": [
          {
            "discriminator": "Elements.Geometry.Solids.Extrude",
            "Profile": { ... },
            "Height": 3.0,
            "Direction": { ... }
          }
        ]
      }
    },
    "e5f6g7h8-...": {
      "discriminator": "Elements.Material",
      "Id": "e5f6g7h8-...",
      "Color": { "Red": 0.8, "Green": 0.8, "Blue": 0.8, "Alpha": 1.0 },
      "Name": "混凝土"
    }
  }
}
```

### 10.2.2 元素 Id 作为字典 Key

`Model.Elements` 是一个 `IDictionary<Guid, Element>`，序列化后以 Guid 字符串作为 JSON 对象的键：

```json
"Elements": {
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": { "discriminator": "Elements.Wall", ... },
  "f1e2d3c4-b5a6-9876-5432-109876abcdef": { "discriminator": "Elements.Beam", ... }
}
```

这种设计的优势：
- **O(1) 元素查找**：通过 Guid 即时定位任意元素，无需遍历
- **引用解析**：当元素 A 引用元素 B 时（如 Wall.Material 引用 Material 元素），JSON 中只需要存储 B 的 Guid 字符串。`JsonInheritanceConverter` 在反序列化时自动解析引用

```csharp
// 序列化时：Wall.Material 如果是 Material 元素，则只写 Guid
public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
{
    var element = value as Element;
    // 只有顶层路径（Elements.xxxxx）才展开完整内容
    // 非顶层路径下的 Element 只序列化 Id
    if (element != null && !PathIsTopLevel(writer.Path, "Elements"))
        writer.WriteValue(element.Id);
    else
    {
        // 展开完整 JSON 对象，注入 discriminator
        var jObject = JObject.FromObject(value, serializer);
        jObject.AddFirst(new JProperty(_discriminator, GetDiscriminatorName(value)));
        writer.WriteToken(jObject.CreateReader());
    }
}
```

### 10.2.3 AdditionalProperties 捕获未知属性

Element 基类定义了 `AdditionalProperties` 字典，标记有 `[JsonExtensionData]`：

```csharp
[JsonExtensionData]
public Dictionary<string, object> AdditionalProperties { get; set; }
```

当 JSON 反序列化时遇到 Schema 中未定义的属性，Newtonsoft.Json 不会丢弃它们，而是自动存入 `AdditionalProperties`。序列化时这些属性也会原样输出。这是连接外部数据（如 Revit 实例参数、自定义分析数据）的关键机制，实现了"无损传递"——Elements 不需要理解所有属性，但能在序列化/反序列化链中保持它们的完整性。

### 10.2.4 版本兼容性

Elements 通过以下策略确保序列化格式的版本兼容：

| 策略 | 机制 |
| --- | --- |
| **向前兼容** | discriminator 回退——未知类型退化为 `Element` 或 `GeometricElement` |
| **向后兼容** | `AdditionalProperties` 保留已知 Schema 中不存在的属性 |
| **共享对象去重** | `SharedObjects` 字典单独存储共享属性，减少元素间的冗余 |
| **错误容忍** | 单个元素反序列化失败不会中断整个模型的加载，错误通过 `DeserializationWarnings` 收集 |

## 10.3 glTF/GLB 导出（核心内置）

glTF（GL Transmission Format）是 Khronos Group 制定的 3D 场景传输标准，被称为"3D 界的 JPEG"。Elements 在核心库中直接内置了完整的 glTF 2.0 导出管线，无需额外 NuGet 包。

### 10.3.1 基本 API

```csharp
using Elements.Serialization.glTF;

// ===== GLB 导出（二进制 glTF，推荐） =====

// 方式一：导出到文件
model.ToGlTF("model.glb");  // 默认 useBinarySerialization = true

// 方式二：导出到字节数组（适合 Web API 返回）
byte[] glbBytes = model.ToGlTF(drawEdges: false, mergeVertices: false);

// 方式三：导出到流
using var stream = new MemoryStream();
model.ToGlTF(stream, drawEdges: true);

// ===== glTF 导出（JSON + 分离的 .bin 文件） =====

model.ToGlTF("model.gltf", useBinarySerialization: false);

// ===== Base64 编码（适合嵌入 HTML 的 data URI） =====
string b64 = model.ToBase64String();
// <img src="data:model/gltf-binary;base64,{b64}" />
```

### 10.3.2 导出管线内部流程

从 Elements 模型到 glTF 文件的完整转换路径：

```
Model
  │
  ├─→ 1. InitializeGlTF()         创建 Gltf 根对象、设置场景和节点
  │     ├─ 添加 KHR_materials_specular、KHR_materials_ior 等扩展
  │     ├─ 创建根节点（旋转 +Z 到 Y-up）
  │     └─ 收集所有 Material 并转换为 glTF PBR 材质
  │
  ├─→ 2. GetRenderDataForElement() 遍历每个元素
  │     ├─ GeometricElement → UpdateRepresentations() → ToMesh()
  │     │   └─ Csg.Solid → Tessellate() → Elements.Geometry.Mesh
  │     ├─ ElementInstance → 查阅 BaseDefinition 的网格
  │     ├─ ContentElement → 加载外部 glTF 并合并节点
  │     └─ 收集顶点、法线、UV、颜色到 GraphicsBuffers
  │
  ├─→ 3. 组装 glTF 组件
  │     ├─ Buffer → BufferView → Accessor 三级结构
  │     ├─ Mesh → MeshPrimitive（TRIANGLES / LINES）
  │     ├─ Node（含 Transform Matrix）→ 场景图
  │     └─ 添加边缘线（可选）、灯光节点
  │
  └─→ 4. SaveGlb() / SaveGltf()
        ├─ CombineBufferAndFixRefs() 合并多 buffer
        └─ SaveBinaryModel() 写出二进制文件
```

### 10.3.3 GraphicsBuffers：三角剖分后的数据载体

三角剖分的结果被封装在 `GraphicsBuffers` 中，这是 Elements 内部统一的网格数据格式：

```csharp
// 关键数据结构（概念表示）
public class GraphicsBuffers
{
    public List<byte> Vertices;   // float[] 顶点坐标（交织存储）
    public List<byte> Normals;    // float[] 法线向量
    public List<byte> Indices;    // ushort[] 三角形索引
    public List<byte> UVs;        // float[] 纹理坐标
    public List<byte> Colors;     // float[] 顶点颜色

    public double[] VMin, VMax;   // 顶点包围盒（用于 glTF accessor）
    public double[] NMin, NMax;   // 法线包围盒
    public int IMin, IMax;        // 索引范围
}
```

每个 `GeometricElement` 在导出前通过 `UpdateBoundsAndComputeSolid()` 触发 CSG 布尔计算，然后调用 `Tessellate()` 将最终的 `Csg.Solid` 三角剖分为 `GraphicsBuffers`。

### 10.3.4 GLB 二进制嵌入

GLB 格式将 JSON 场景描述和二进制数据打包在同一个文件中，结构如下：

```
GLB 文件结构（12 + n 字节）：
┌──────────────────────────────┐
│  magic (0x46546C67)          │ 4 bytes  — "glTF"
│  version (2)                 │ 4 bytes
│  total length                │ 4 bytes  — 文件总长度
├──────────────────────────────┤
│  JSON Chunk                  │
│  ├─ chunkLength              │ 4 bytes
│  ├─ chunkType (0x4E4F534A)   │ 4 bytes  — "JSON"
│  └─ chunkData                │ n bytes  — UTF-8 JSON
├──────────────────────────────┤
│  BIN Chunk (可选)            │
│  ├─ chunkLength              │ 4 bytes
│  ├─ chunkType (0x004E4942)   │ 4 bytes  — "BIN\0"
│  └─ chunkData                │ m bytes  — 二进制 buffer
└──────────────────────────────┘
```

Elements 使用 `glTFLoader` 库完成这一打包过程。

### 10.3.5 材质映射与扩展

Elements 材质到 glTF 的映射转换在 `GltfExtensions.AddMaterials()` 中完成：

```csharp
// 映射规则
gltfMaterial.PbrMetallicRoughness = new MaterialPbrMetallicRoughness
{
    BaseColorFactor = material.Color.ToArray(true),   // RGBA → float[4]
    RoughnessFactor = 1.0f - material.GlossinessFactor, // 光泽度 → 粗糙度
    MetallicFactor = 0                                 // 建筑材质默认非金属
};

// 支持的 glTF 扩展
// KHR_materials_specular  — 镜面反射（从 Material.SpecularFactor）
// KHR_materials_ior       — 折射率
// KHR_materials_unlit     — 无光照材质（Material.Unlit）
// HYPAR_materials_edge_settings — Hypar 自定义边缘显示
// HYPAR_draw_in_front     — 始终在最前渲染
```

纹理图片（PNG）会被翻转 Y 轴（OpenGL 约定）后嵌入到 glTF 的 buffer 中。

## 10.4 IFC 双向转换（Elements.Serialization.IFC）

IFC（Industry Foundation Classes）是 buildingSMART 制定的 BIM 数据交换标准。Elements 通过独立的 `Elements.Serialization.IFC` NuGet 包提供完整的读写支持。

### 10.4.1 基本 API

```csharp
using Elements.Serialization.IFC;

// ===== 写出 IFC =====

// 方式一：导出到文件
model.ToIFC("building.ifc");

// 方式二：导出到流
using var stream = new MemoryStream();
model.ToIFC(stream, leaveOpen: true);

// ===== 读取 IFC =====

// 读取 IFC STEP 文件（可指定要转换的元素 Id 集合）
Model importedModel = IFCModelExtensions.FromIFC("source.ifc",
    out List<string> constructionErrors,
    idsToConvert: new[] { "IFCGuid-1", "IFCGuid-2" });

foreach (var err in constructionErrors)
    Console.WriteLine($"IFC 导入警告: {err}");
```

### 10.4.2 IFC 文档生成流程

IFC 写出时，`IFCModelExtensions` 自动构建完整的 IFC 空间结构：

```
IfcProject
 └─ IfcSite ("Hypar Site")
      └─ IfcBuilding ("Default Building")
           └─ IfcBuildingStorey ("Default Storey")
                └─ IfcWall / IfcBeam / IfcColumn / IfcSlab / IfcSpace ...
```

```csharp
// 源码简化：空间层次自动创建
private static Document CreateIfcDocument(this Model model)
{
    var ifc = new Document(...);

    // 创建 Site → Building → Storey 标准三级结构
    var site = new IfcSite(...);
    var building = new IfcBuilding(...);
    var storey = new IfcBuildingStorey(...);

    // 将所有产品分配到 Storey 下
    var spatialRel = new IfcRelContainedInSpatialStructure(products, storey);

    return ifc;
}
```

### 10.4.3 产品类型映射

Elements 建筑元素到 IFC 实体类型的映射规则：

| Elements 类型 | IFC 实体 | 说明 |
| --- | --- | --- |
| `Wall` / `StandardWall` / `WallByProfile` | `IfcWall` / `IfcWallStandardCase` | 墙 |
| `Beam` | `IfcBeam` | 梁 |
| `Column` | `IfcColumn` | 柱 |
| `Floor` | `IfcSlab` | 楼板 |
| `Space` | `IfcSpace` | 空间 |
| `Mass` | `IfcBuildingElementProxy` | 体量（兜底映射） |
| `Opening` | `IfcOpeningElement` | 开洞 |

对于没有明确映射的元素类型（如 `Mass`），Elements 使用 `IfcBuildingElementProxy` 作为通用兜底，确保几何数据不会丢失。

### 10.4.4 表示解析器

Elements 通过分析元素的 `SolidOperation` 列表，将几何操作映射为对应的 IFC 表示类型：

```
SolidOperation               →  IFC Representation
────────────────────────────────────────────────────
Extrude                      →  IfcExtrudedAreaSolid
     └─ Profile (Polygon) →  IfcArbitraryClosedProfileDef
     └─ Height             →  IfcExtrudedAreaSolid.Depth
     └─ Direction          →  IfcExtrudedAreaSolid.ExtrudedDirection

Sweep                        →  IfcExtrudedAreaSolid 或 IfcSurfaceCurveSweptAreaSolid
     └─ 直扫（无旋转）     →  IfcExtrudedAreaSolid
     └─ 弯曲扫              →  IfcSurfaceCurveSweptAreaSolid

Lamina                       →  IfcShellBasedSurfaceModel
Boolean (Union/Subtract)     →  IfcBooleanResult（CSG 树）
     └─ 树形递归             →  嵌套 IfcBooleanResult

Imported (外部 BREP)         →  IfcFacetedBrep / IfcMappedItem
```

对于 `Extrude` 操作的简化映射逻辑：

```csharp
// 概念代码：Extrude → IfcExtrudedAreaSolid
var profile = extrude.Profile;
var position = new IfcAxis2Placement3D(...);
var profileDef = new IfcArbitraryClosedProfileDef(
    IfcProfileTypeEnum.AREA, null, position, profile.Perimeter.ToIfcPolyline());

var solid = new IfcExtrudedAreaSolid(
    profileDef,
    position,
    extrude.Direction.ToIfcDirection(),
    extrude.Height);

// 附加材质关联
var styledItem = new IfcStyledItem(solid,
    new[] { styleAssignments[material.Id] }, material.Name);

var representation = new IfcProductDefinitionShape(
    null, null, new[] { new IfcShapeRepresentation(..., "Body", "SweptSolid", new[] { styledItem }) });
```

### 10.4.5 IFC 读取方向

从 IFC 读取时，`FromIFC` 方法使用内部的 `IFCToHypar` 解析引擎：

```csharp
// IFC 读取的核心解析过程
public static Model FromIFC(string path, out List<string> constructionErrors, IList<string> idsToConvert = null)
{
    var modelProvider = new FromIfcModelProvider(path, idsToConvert: idsToConvert);
    constructionErrors = modelProvider.GetConstructionErrors();
    return modelProvider.Model;
}
```

读取管线的核心挑战在于将 IFC 丰富的表示类型反向映射为 Elements 的 `SolidOperation`。从 `IfcExtrudedAreaSolid` 中提取 Profile + Height + Direction 相对直接；`IfcBooleanResult` 和 `IfcFacetedBrep` 则需要网格化后作为 `ImportMeshElement` 导入。

## 10.5 DXF 导出（Elements.Serialization.DXF）

DXF（Drawing eXchange Format）是 AutoCAD 的原生矢量交换格式，广泛用于建筑平面图和施工图交换。Elements 通过 `Elements.Serialization.DXF` 包支持将模型导出为 DXF。

### 10.5.1 基本 API

```csharp
using Elements.Serialization.DXF;

// 创建渲染器
var renderer = new ModelToDxf();

// 可选：设置图层映射配置
renderer.SetMappingConfiguration(new MappingConfiguration
{
    // 自定义图层名、线宽、颜色映射
});

// 渲染到流
using var dxfStream = renderer.Render(model);

// 保存到文件
using var fileStream = File.Create("plan.dxf");
dxfStream.CopyTo(fileStream);
```

### 10.5.2 字典注册转换器

`ModelToDxf` 内部维护一个类型到渲染器的字典：

```csharp
private Dictionary<Type, IRenderDxf> _dxfCreators = new Dictionary<Type, IRenderDxf>
{
    { typeof(ContentElement), new ContentElementToDXF() },
    { typeof(ElementInstance), new ElementInstanceToDXF() }
};
```

渲染流程：

```
ModelToDxf.Render(model)
  │
  ├─→ 遍历 model.Elements.Values
  │
  ├─→ 类型在 _dxfCreators 中注册？
  │     ├─ 是 → 调用对应的 IRenderDxf.TryAddDxfEntity()
  │     └─ 否 → 检查是否是 GeometricElement
  │             ├─ 是 → GeometricElementToDxf（几何兜底渲染）
  │             └─ 否 → 跳过
  │
  └─→ 返回 MemoryStream（DxfFile → DxfAcadVersion.R2013）
```

### 10.5.3 几何兜底渲染

`GeometricElementToDxf` 是 DXF 导出的核心兜底处理器。它将元素的几何表示转换为 DXF 的 LWPOLYLINE、LINE、ARC 等基本图元：

```csharp
// 概念代码：几何兜底
public class GeometricElementToDxf : IRenderDxf
{
    public void TryAddDxfEntity(DxfFile doc, GeometricElement element, DxfRenderContext context)
    {
        // 将元素三角剖分为网格
        var mesh = element.ToMesh();

        // 将三角形边提取为 DXF LINE 图元
        foreach (var triangle in mesh.Triangles)
        {
            // 每条边生成一条 DXF Line
            doc.Entities.Add(new DxfLine(triangle.Vertices[0].Position,
                                          triangle.Vertices[1].Position));
            // ... 其余两条边
        }
    }
}
```

## 10.6 SVG/PDF 导出（Elements.Serialization.SVG）

`Elements.Serialization.SVG` 包提供两类可视化导出：
- **SvgSection**：模型剖切平面图（楼层平面）
- **SvgFaceElevation**：几何面立面图（BRep face 二维投影）

两者都支持导出为 SVG 和 PDF。

### 10.6.1 SvgSection：剖面平面图

`SvgSection` 在指定标高处用一个水平面剖切模型，将截面和背景投影到二维平面：

```csharp
using Elements.Serialization.SVG;

// 方式一：静态方法，一步生成并保存
SvgSection.CreateAndSavePlanFromModels(
    models: new[] { model },
    elevation: 1.2,                       // 剖切标高（单位：米）
    frontContext: new SvgContext           // 截面样式
    {
        Fill = new SvgColourServer(Color.Black),
        StrokeWidth = new SvgUnit(SvgUnitType.User, 0.01f)
    },
    backContext: new SvgContext            // 后景样式
    {
        Stroke = new SvgColourServer(Color.Gray),
        StrokeWidth = new SvgUnit(SvgUnitType.User, 0.005f)
    },
    path: "floor_plan.svg",
    showGrid: true,                       // 显示轴网
    planRotation: PlanRotation.LongestGridHorizontal  // 自动旋转对齐
);

// 方式二：实例化后自定义
var section = new SvgSection(new[] { model }, elevation: 1.2)
{
    FrontContext = new SvgContext { Fill = new SvgColourServer(Color.Red) },
    BackContext = new SvgContext { Stroke = new SvgColourServer(Color.Blue) },
    ShowGrid = true,
    GridHeadExtension = 2.0,
    GridHeadRadius = 0.5,
    PlanRotation = PlanRotation.None,
    PlanRotationDegrees = 0
};

// 注册元素绘制事件（自定义渲染）
section.OnElementDrawing += (sender, args) =>
{
    if (args.Element is Wall)
    {
        // 自定义墙的 SVG 绘制逻辑
        args.IsProcessed = true;
        args.CreationSequence = ElementSerializationEventArgs.CreationSequences.Immediately;
        args.SvgElements.Add(new SvgCircle { ... });
    }
};

section.SaveAsSvg("custom_plan.svg");
section.SaveAsPdf("custom_plan.pdf", new PdfSaveOptions
{
    PageWidth = 841,   // A4 横向
    PageHeight = 594,
    Margin = 20
});
```

### 10.6.2 剖切面生成原理

`SvgSection` 的内部实现复用 `Model.Intersect()` 方法：

```csharp
// 源码简化：剖切 = 平面求交
var plane = new Plane(new Vector3(0, 0, elevation), Vector3.ZAxis);

model.Intersect(plane,
    out Dictionary<Guid, List<Polygon>> intersecting,   // Front：截面上的多边形
    out Dictionary<Guid, List<Polygon>> back,           // Back：平面后的多边形投影
    out Dictionary<Guid, List<Line>> lines);            // 线段（轴网等）

// 将 Polygon 转换为 SVG <path> 元素
// Front 使用 FrontContext（实心填充 + 粗线）
// Back 使用 BackContext（仅有描边 + 细线）
```

### 10.6.3 SvgFaceElevation：立面图

`SvgFaceElevation` 用于绘制单个几何面（Face）的二维立面投影：

```csharp
using Elements.Serialization.SVG;

// 从元素的 BRep 面创建立面图
var solid = element.GetFinalSolid();
var face = solid.Faces.First(f => /* 选出目标面 */);

var elevation = new SvgFaceElevation(face, up: Vector3.ZAxis)
{
    ElementLinesContext = new SvgContext
    {
        Stroke = new SvgColourServer(Color.Black),
        StrokeWidth = new SvgUnit(SvgUnitType.User, 0.01f)
    },
    DimensionLinesContext = new SvgContext
    {
        Stroke = new SvgColourServer(Color.DarkBlue),
        StrokeWidth = new SvgUnit(SvgUnitType.User, 0.005f)
    },
    PlanRotationDegrees = 0
};

elevation.SaveAsSvg("elevation.svg");
elevation.SaveAsPdf("elevation.pdf", new PdfSaveOptions
{
    PageWidth = 594,
    PageHeight = 841,
    Margin = 20
});
```

`SvgFaceElevation` 的智能标注引擎会自动识别面的外轮廓和内孔（如门窗洞口），并生成尺寸标注线（基于支持的四个方向：+X、-X、+Y、-Y）。

### 10.6.4 SvgContext 样式配置

`SvgContext` 封装了 SVG 图元的样式属性：

```csharp
public class SvgContext
{
    public SvgColourServer Fill { get; set; }       // 填充色
    public SvgColourServer Stroke { get; set; }     // 描边色
    public SvgUnit StrokeWidth { get; set; }         // 描边宽度
    public SvgStrokeLineCap StrokeLineCap { get; set; } // 端点样式
    public SvgUnitCollection StrokeDashArray { get; set; } // 虚线样式
}
```

配置示例：

```csharp
// 截面：黑色填充
var frontContext = new SvgContext
{
    Fill = new SvgColourServer(Color.Black),
    StrokeWidth = new SvgUnit(SvgUnitType.User, 0.01f)
};

// 后景：灰色虚线
var backContext = new SvgContext
{
    Stroke = new SvgColourServer(Color.Gray),
    StrokeWidth = new SvgUnit(SvgUnitType.User, 0.005f),
    StrokeDashArray = new SvgUnitCollection
    {
        new SvgUnit(SvgUnitType.User, 0.1f),
        new SvgUnit(SvgUnitType.User, 0.05f)
    }
};

// 轴网：长虚线
var gridContext = new SvgContext
{
    Stroke = new SvgColourServer(Color.Black),
    StrokeWidth = new SvgUnit(SvgUnitType.User, 0.01f),
    StrokeDashArray = new SvgUnitCollection
    {
        new SvgUnit(SvgUnitType.User, 0.3f),
        new SvgUnit(SvgUnitType.User, 0.025f),
        new SvgUnit(SvgUnitType.User, 0.05f),
        new SvgUnit(SvgUnitType.User, 0.025f)
    }
};
```

### 10.6.5 PDF 导出

SVG 导出包通过 SkiaSharp 管线将 SVG 转换为 PDF。`PdfSaveOptions` 控制页面尺寸和边距：

```csharp
public class PdfSaveOptions
{
    public float PageWidth { get; set; } = 841;   // 默认 A4 横向
    public float PageHeight { get; set; } = 594;
    public float Margin { get; set; } = 20;
}
```

内部流程为：SVG (`SKSvg.Load`) → `SKPicture` → `SKCanvas.DrawPicture` → `SKDocument.CreatePdf`，自动缩放以适配页面。

## 10.7 实战示例：五种格式全导出

下面是一个完整的综合示例，创建一个小型建筑模型并导出为全部五种格式：

```csharp
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using Elements;
using Elements.Geometry;
using Elements.Geometry.Solids;
using Elements.Geometry.Profiles;
using Elements.Serialization.JSON;
using Elements.Serialization.glTF;
using Elements.Serialization.IFC;
using Elements.Serialization.DXF;
using Elements.Serialization.SVG;

// ========== 步骤 1：创建模型 ==========

var model = new Model();

// 添加材质
var concreteMaterial = new Material("混凝土", new Color(0.7, 0.7, 0.7, 1.0));
var steelMaterial = new Material("钢材", new Color(0.5, 0.5, 0.6, 1.0));
model.AddElements(concreteMaterial, steelMaterial);

// 创建外墙（Extrude 表示）
var wallLine = new Line(new Vector3(0, 0, 0), new Vector3(10, 0, 0));
var wall = new StandardWall(
    wallLine,
    0.2,   // 厚度
    3.0,   // 高度
    concreteMaterial,
    transform: new Transform());
wall.Name = "外墙 A";
model.AddElement(wall);

// 创建柱（通过 Profile + Extrude）
var columnProfile = Polygon.Rectangle(0.3, 0.3);
var column = new Column(
    new Vector3(5, 0, 0),
    3.0,
    columnProfile,
    concreteMaterial,
    transform: new Transform());
column.Name = "柱 C1";
model.AddElement(column);

// 创建梁
var beamLine = new Line(new Vector3(0, 3, 3.0), new Vector3(10, 3, 3.0));
var beam = new Beam(beamLine, profile: Polygon.Rectangle(0.2, 0.4),
    material: steelMaterial,
    transform: new Transform());
beam.Name = "梁 B1";
model.AddElement(beam);

// 创建楼板
var floorOutline = Polygon.Rectangle(10, 5);
var floor = new Floor(floorOutline, 0.15, new Transform(0, 0, 0),
    material: concreteMaterial);
floor.Name = "楼板 F1";
model.AddElement(floor);

// 创建空间
var spaceBoundary = Polygon.Rectangle(9, 4);
var space = new Space(spaceBoundary, 3.0, 0.0,
    new Transform(new Vector3(0.5, 0.5, 0.15)));
space.Name = "房间 101";
model.AddElement(space);

// ========== 步骤 2：更新几何表示 ==========

model.UpdateBoundsAndComputedSolids();

// ========== 步骤 3：JSON 序列化 ==========

// 格式化输出，适合 Git 版本控制
model.ToJson("complete_model.json", indent: true);

// 验证：反序列化回来
var reloaded = Model.FromJson(File.ReadAllText("complete_model.json"), out var jsonErrors);
Console.WriteLine($"JSON 反序列化: {reloaded.Elements.Count} 个元素, {jsonErrors.Count} 个错误");

// ========== 步骤 4：glTF/GLB 导出 ==========

// GLB 二进制（Web 3D 查看器、游戏引擎）
model.ToGlTF("complete_model.glb");
Console.WriteLine("GLB 导出完成");

// 带边缘线的高质量 GLB
model.ToGlTF("complete_model_edges.glb", drawEdges: true);

// 字节数组（Web API 返回）
byte[] glbBytes = model.ToGlTF();
File.WriteAllBytes("complete_model_api.glb", glbBytes);

// ========== 步骤 5：IFC 导出与导入 ==========

// 导出为 IFC STEP 文件
model.ToIFC("complete_model.ifc");
Console.WriteLine("IFC 导出完成");

// 从 IFC 重新导入
var ifcModel = IFCModelExtensions.FromIFC("complete_model.ifc", out var ifcErrors);
Console.WriteLine($"IFC 导入: {ifcModel.Elements.Count} 个元素, {ifcErrors.Count} 个警告");

// ========== 步骤 6：DXF 导出 ==========

var dxfRenderer = new ModelToDxf();
using (var dxfStream = dxfRenderer.Render(model))
using (var fileStream = File.Create("complete_model.dxf"))
{
    dxfStream.CopyTo(fileStream);
}
Console.WriteLine("DXF 导出完成");

// ========== 步骤 7：SVG/PDF 平面图 ==========

var frontContext = new SvgContext
{
    Fill = new SvgColourServer(Color.Black),
    StrokeWidth = new SvgUnit(SvgUnitType.User, 0.01f)
};
var backContext = new SvgContext
{
    Stroke = new SvgColourServer(Color.DarkGray),
    StrokeWidth = new SvgUnit(SvgUnitType.User, 0.005f)
};

// 在 1.5m 标高处剖切生成平面图
SvgSection.CreateAndSavePlanFromModels(
    models: new[] { model },
    elevation: 1.5,
    frontContext: frontContext,
    backContext: backContext,
    path: "complete_plan.svg",
    showGrid: false,
    planRotation: PlanRotation.None);

// 同时导出 PDF
var section = new SvgSection(new[] { model }, elevation: 1.5)
{
    FrontContext = frontContext,
    BackContext = backContext,
    ShowGrid = false
};
section.SaveAsPdf("complete_plan.pdf", new PdfSaveOptions
{
    PageWidth = 841,
    PageHeight = 594,
    Margin = 30
});
Console.WriteLine("SVG 平面图 / PDF 导出完成");

// ========== 步骤 8：输出总结 ==========

Console.WriteLine("\n=== 导出完成 ===");
Console.WriteLine($"  JSON           : complete_model.json");
Console.WriteLine($"  GLB            : complete_model.glb / complete_model_edges.glb");
Console.WriteLine($"  IFC            : complete_model.ifc (可导入 Revit/Archicad)");
Console.WriteLine($"  DXF            : complete_model.dxf (可导入 AutoCAD)");
Console.WriteLine($"  SVG            : complete_plan.svg");
Console.WriteLine($"  PDF            : complete_plan.pdf");
```

### 各格式适用场景对比

| 格式 | 适用场景 | 优点 | 局限 |
| --- | --- | --- | --- |
| **JSON** | 数据交换、版本控制、CI/CD | 完整语义保留、人类可读、Git 友好 | 无渲染信息 |
| **glTF/GLB** | Web 3D 查看器、游戏引擎、AR/VR | 二进制高效、PBR 材质、广泛生态 | 丢失建筑语义（无墙/梁/柱类型） |
| **IFC** | BIM 协作（Revit/Archicad/Tekla） | 开放标准、建筑语义完整、可双向 | 文件较大（STEP 文本）、部分表示有损 |
| **DXF** | 施工图、AutoCAD 交换 | 行业标准、精确矢量 | 仅二维投影、无材质颜色 |
| **SVG/PDF** | 出图、报告、Web 展示 | 矢量无损、浏览器原生支持 | 仅二维剖切面 |

## 10.8 小结

本章覆盖了 Elements 的五种序列化格式及其内部机制：

- **JSON**：Elements 的原生格式，通过 `JsonInheritanceConverter` 实现多态序列化、引用去重和版本兼容
- **glTF/GLB**：从 CSG 实体到三角网格的完整导出管线，支持 PBR 材质、纹理、灯光和 Hypar 自定义扩展
- **IFC**：双向转换，自动构建标准空间层次，将 SolidOperation 映射为 IFC 表示类型
- **DXF**：基于字典的转换器注册模式，`GeometricElementToDxf` 作为几何兜底渲染器
- **SVG/PDF**：基于模型剖切的二维平面图/立面图生成，支持轴网、尺寸标注和自定义元素渲染

下一章将进入 Elements 的空间计算层——网格、拓扑图和自适应网格。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="第09章-材质光照与渲染">← 上一章</a>
  <a href="./">目录</a>
  <a href="第11章-空间数据结构网格拓扑与自适应网格">下一章 →</a>
</div>
