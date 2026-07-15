---
layout: default
title: 第06章：场景模型Models与实例化渲染
---

# 第06章：场景模型 Models 与实例化渲染

单个网格只是几何。要表达一个**场景**——成千上万个构件、每个有自己的位置与材质、还要能高效送进 GPU——需要 `Ara3D.Models`。本章讲解模型接口体系、`Model3D`、实例结构、材质、以及 GPU 就绪的 `RenderModelData`。

## 1. 为什么需要“模型”这一层

AEC 场景的典型特征是**大量重复几何 + 实例化**：同一根梁、同一扇门可能出现成百上千次，只是位置、朝向、颜色不同。如果每个实例都复制一份网格，内存会爆炸。`Ara3D.Models` 的设计正是：

- **唯一网格集合**（`Meshes`）：只存不同的几何；
- **实例集合**（`Instances`）：每个实例引用一个网格索引 + 一个变换 + 材质；
- **GPU 就绪缓冲区**（`RenderModelData`）：把上述数据展开成顶点/索引/实例缓冲，直接喂给渲染器。

## 2. 模型接口体系

```csharp
public interface IModel3D : ITransformable3D<IModel3D>
{
    IReadOnlyList<TriangleMesh3D> Meshes    { get; }   // 唯一网格几何
    IReadOnlyList<InstanceStruct> Instances { get; }   // 放置的实例
}

public interface IHasBounds3D { Bounds3D Bounds { get; } }

public interface IBoundedModel3D : IModel3D, IHasBounds3D, ITransformable3D<IBoundedModel3D>
{
    IReadOnlyList<Bounds3D> MeshBounds     { get; }
    IReadOnlyList<Bounds3D> InstanceBounds { get; }
}

public interface IRenderableModel3D : IBoundedModel3D, IDeformable3D<IRenderableModel3D>
{
    IBuffer<float>            VertexBuffer         { get; }  // x,y,z 交错
    IBuffer<uint>             IndexBuffer          { get; }
    IBuffer<MeshSliceStruct>  MeshSliceBuffer      { get; }
    IBuffer<InstanceStruct>   InstanceBuffer       { get; }
    IBuffer<Bounds3D>         MeshBoundsBuffer     { get; }
    IBuffer<Bounds3D>         InstanceBoundsBuffer { get; }
}
```

分层含义：`IModel3D`（逻辑模型）→ `IBoundedModel3D`（带包围盒）→ `IRenderableModel3D`（带 GPU 缓冲区）。

## 3. Model3D——主场景对象

```csharp
public class Model3D : ITransformable3D<Model3D>, IModel3D
{
    public IReadOnlyList<TriangleMesh3D> Meshes    { get; }
    public IReadOnlyList<InstanceStruct> Instances { get; }

    public static Model3D Empty = new([], []);

    // 工厂方法
    public static Model3D Create(TriangleMesh3D mesh, Material material, Matrix4x4 matrix, byte flags);
    public static Model3D Create(TriangleMesh3D mesh, Material material, IReadOnlyList<Matrix4x4> matrices);
    public static Model3D Create(TriangleMesh3D mesh, Material material);
    public static Model3D Create(TriangleMesh3D mesh);

    public static implicit operator Model3D(TriangleMesh3D m);  // 网格自动包装成模型

    public IModel3D Transform(Transform3D t);
}
```

注意那个**隐式转换**：一个 `TriangleMesh3D` 可以直接当作 `Model3D` 使用，方便把“纯几何”接入需要模型的 API。

```csharp
// 单网格、指定材质
var model = Model3D.Create(
    PlatonicSolids.TriangulatedCube,
    Material.Default.WithColor(new Color(0.8f, 0.2f, 0.2f, 1f)));

// 同一网格、多份变换 = 实例化
var matrices = 100.Select(i => Matrix4x4.CreateTranslation(new Vector3(i * 2, 0, 0)));
var wall = Model3D.Create(beamMesh, Material.Default, matrices);
```

## 4. InstanceStruct——64 字节的渲染实例

实例是场景的核心数据单元，被刻意压缩到**正好 64 字节**（一个缓存行），以便海量实例高效驻留与上传：

```csharp
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public unsafe struct InstanceStruct   // 恰好 64 字节
{
    public Vector4 Column0;      // 3×4 变换矩阵的列（列主序）
    public Vector4 Column1;
    public Vector4 Column2;
    public int   MeshIndex;      // 指向 model.Meshes 的索引
    public int   EntityIndex;    // BIM 实体 ID
    public uint  PackedColor;    // R,G,B,A 打包成字节
    public byte  Unused;
    public byte  Flags;          // HiddenFlag = 0x1
    public byte  RoughnessByte;
    public byte  MetallicByte;

    // 计算属性
    public Matrix4x4 Matrix4x4 { get; set; }  // 由 Column0/1/2 重建
    public Color     Color     { get; set; }
    public float     Alpha     { get; }
    public float     Metallic  { get; set; }
    public float     Roughness { get; set; }
    public bool      Transparent { get; }
    public bool      IsVisible   { get; }
    public Vector3   Translation { get; }
}
```

设计取舍：用三列 `Vector4` 存 3×4 矩阵（省掉恒为 (0,0,0,1) 的第 4 行），颜色/粗糙度/金属度用字节打包——把 PBR 外观 + 变换 + 索引全塞进 64 字节。

## 5. Material——PBR 材质

```csharp
public record struct Material(Color Color, float Metallic, float Roughness)
{
    public static Material Default = new(new Color(0.85f, 0.85f, 0.95f, 1f), 0f, 0.7f);

    public Material WithColor(Color color);
    public Material WithMetallic(float metallic);
    public Material WithRoughness(float roughness);
    public Material WithAlpha(float alpha);

    public bool Transparent { get; }   // Alpha <= 0.999f
    public bool Visible     { get; }   // Alpha >= 0.001f
    public PackedMaterial AsPacked();  // 字节打包形式
}
```

`Material` 是不可变 record struct，`WithXxx` 系列返回修改副本，符合函数式风格。

## 6. MeshSliceStruct——GPU 绘制切片

为把多个网格合并进同一对顶点/索引缓冲，需要记录每个网格在缓冲中的偏移范围：

```csharp
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct MeshSliceStruct
{
    public int  BaseVertex;   // 顶点缓冲基偏移
    public int  VertexCount;
    public uint FirstIndex;   // 索引缓冲偏移
    public uint IndexCount;
}
```

这正是现代图形 API（如带 `baseVertex` 的间接绘制）所需要的元数据。

## 7. RenderModelData——GPU 就绪缓冲容器

`RenderModelData` 是渲染器长期持有的**主数据对象**，全部建立在**非托管内存**（`UnmanagedList<T>`）之上，绕开 GC：

```csharp
public class RenderModelData : IDisposable, IModel3D
{
    public MetaData Meta;   // 包围盒、顶点/面计数、标志
    public UnmanagedList<float>           VertexData        { get; }  // XYZ 或 XYZRGB 交错
    public UnmanagedList<uint>            IndexData         { get; }
    public UnmanagedList<MeshSliceStruct> MeshSliceData     { get; }
    public UnmanagedList<InstanceStruct>  InstanceData      { get; }
    public UnmanagedList<Bounds3D>        MeshBoundsData    { get; }
    public UnmanagedList<Bounds3D>        InstanceBoundsData{ get; }

    // 更新方法（多种重载）
    public void Update(IModel3D model);
    public void Update(TriangleMesh3D mesh, IReadOnlyList<Vector3> colors, Material mat, Matrix4x4 matrix);
    public void Update(QuadMesh3D  mesh, IReadOnlyList<Vector3> colors, Material mat, Matrix4x4 matrix);
    public void Update(LineMesh3D  mesh, IReadOnlyList<Vector3> colors, Material mat, Matrix4x4 matrix);
    public void Update(ColoredTriangleMesh3D mesh, Material mat, Matrix4x4 matrix);
    public void Update(IEnumerable<RenderModelData> models);   // 合并多个
    public void Clear();
    public Model3D ToModel3D();
}
```

- 构造参数 **PrimitiveSize**：2 = 线，3 = 三角形，4 = 四边形；
- 通过各种 `Update` 重载，可以把 `IModel3D`、单个网格、甚至多个 `RenderModelData` 合并进同一份缓冲；
- 因为实现了 `IDisposable`，用完记得释放非托管内存（`using` 或显式 `Dispose`）。

```csharp
using var render = new RenderModelData(primitiveSize: 3);
render.Update(model);                     // 把逻辑模型展开为 GPU 缓冲
// 现在 render.VertexData / IndexData / InstanceData 可直接上传显卡
Console.WriteLine($"顶点: {render.VertexData.Count}, 实例: {render.InstanceData.Count}");
```

## 8. Model3DExtensions——丰富的模型操作

`Model3DExtensions` 提供了一套函数式的模型处理 API：

```csharp
// 展平（把所有实例合并成一张网格）
public static TriangleMesh3D ToMesh(this IModel3D self);
public static ColoredTriangleMesh3D ToColoredMesh(this IModel3D self);

// 实例化 / 克隆
public static IModel3D Clone(this IModel3D model, IReadOnlyList<Matrix4x4> matrices);
public static IModel3D Clone(this IModel3D model, IReadOnlyList<Vector3> positions);
public static IModel3D CloneAlong(this TriangleMesh3D mesh, Func<Number, Point3D> curveFunc, Integer count);

// 过滤
public static Model3D  Where(this IModel3D self, Func<InstanceStruct, bool> f);
public static IModel3D WhereMeshes(this IModel3D model, Func<TriangleMesh3D, bool> filter);
public static Model3D  FilterAndRemoveUnusedMeshes(this IModel3D self, Func<InstanceStruct, bool> f);

// 合并
public static Model3D Merge(this IEnumerable<IModel3D> models);

// 逐网格/逐实例变换
public static IModel3D WithMeshes(this IModel3D self, Func<TriangleMesh3D, TriangleMesh3D> f);
public static IModel3D WithInstances(this IModel3D self, Func<InstanceStruct, InstanceStruct> f);
public static Model3D  Transform(this IModel3D self, Transform3D transform);

// 包围盒
public static IReadOnlyList<Bounds3D> GetInstanceBounds(this IModel3D self);
public static Bounds3D GetBounds(this IModel3D self);
```

用法示例：

```csharp
// 只保留可见实例，并去掉不再被引用的网格
var visible = model.FilterAndRemoveUnusedMeshes(inst => inst.IsVisible);

// 把每个实例调暗到 20% 透明度
var ghosted = model.WithInstances(inst => inst.WithAlpha(0.2f));

// 合并多个模型
var scene = new[] { walls, floors, roof }.Merge();
```

## 9. Model3DBuilder——增量构建场景

示例项目里用 `Model3DBuilder` 增量拼装模型：先加网格，再按索引加实例：

```csharp
var mb = new Model3DBuilder();
mb.Meshes.Add(PlatonicSolids.TriangulatedCube);   // 网格索引 0
foreach (var transform in transforms)
    mb.AddInstance(0, transform);                 // 引用网格 0 + 变换
// 也可直接 AddModel(existingModel) 合并另一个模型
mb.AddModel(hBeamModel);
IModel3D result = mb.Build();
```

这与 `Meshes + Instances` 的数据模型一一对应：**一次上传网格几何，多次实例化**。屋架示例 `RoofBeams`、L 系统分形 `Fractal`、楼梯 `Stairs` 都基于此模式。

## 10. 一个完整的小场景

```csharp
using Ara3D.Geometry;
using Ara3D.Models;

// 1) 造一根“梁”几何
var beam = PlatonicSolids.TriangulatedCube.Scale(new Vector3(4f, 0.3f, 0.5f));

// 2) 在 X 方向排 20 根
var positions = 20.Select(i => new Vector3(0, i * 1.0f, 0));
var beams = Model3D.Create(beam, Material.Default.WithColor(new Color(1, 0.1f, 0.3f, 1)))
                   .Clone(positions);

// 3) 求包围盒并展平为单网格（如需导出）
var bounds = beams.GetBounds();
var flat = beams.ToMesh();

// 4) 生成 GPU 缓冲
using var render = new RenderModelData(3);
render.Update(beams);

Console.WriteLine($"实例数: {beams.Instances.Count}, 包围盒尺寸: {bounds.Size}");
```

## 11. 本章小结

- `Ara3D.Models` 用“**唯一网格 + 实例**”模型高效表达重复几何密集的 AEC 场景；
- 接口分层：`IModel3D` → `IBoundedModel3D` → `IRenderableModel3D`；
- `InstanceStruct` 压缩到 64 字节，含 3×4 变换、材质打包、网格/实体索引；
- `Material` 是不可变 PBR record struct；`MeshSliceStruct` 描述 GPU 绘制切片；
- `RenderModelData` 基于非托管内存，提供 GPU 就绪缓冲与多种 `Update` 合并方式；
- `Model3DExtensions` 与 `Model3DBuilder` 提供函数式与增量式两种构建/处理风格。

下一章我们把模型**读写到磁盘**——BFAST、G3D、PLY、glTF、VIM、STEP、GeoJSON 等格式。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第05章-几何与网格建模" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第07章-文件IO与三维数据格式" style="text-decoration: none;">下一章 →</a>
</div>
