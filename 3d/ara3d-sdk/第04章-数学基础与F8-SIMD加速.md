---
layout: default
title: 第04章：数学基础与F8 SIMD加速
---

# 第04章：数学基础与 F8 SIMD 加速

三维数据处理的底层是数学。Ara3D-SDK 的数学分成两条线：

1. **Plato 生成的标量/向量/矩阵类型**（`Vector3`、`Matrix4x4`、`Quaternion`、`Number`、`Angle` 等），提供符合直觉、类型安全、不可变的 API；
2. **`Ara3D.F8` 的 SIMD 类型**（`f8`、`Vector3x8`、`d4`），用 AVX 指令**一次处理 8 个 float / 4 个 double**，用于批量顶点计算等热点路径。

本章讲清这两条线，以及它们如何协作。

## 1. Plato 与数学类型的来源

Ara3D 的核心数学类型不是手写的，而是由 **Plato DSL** 自动生成，落在 `src/Plato.Generated/` 与 `src/Plato.Intrinsics/`，并被 `Ara3D.Geometry` 导入（它们**不是**独立的 NuGet 包，随 `Ara3D.Geometry` 一起提供）。这些类型都在 **`namespace Ara3D.Geometry`** 下。

| 类型 | 底层 | 说明 |
| --- | --- | --- |
| `Number` | `float` | 标量数字（类型安全包装） |
| `Integer` | `int` | 整数 |
| `Angle` | `float`（弧度） | 类型安全角度 |
| `Vector2/3/4` | `System.Numerics.VectorN` | 2/3/4 维向量 |
| `Vector8` | 8 元素 float | 8 维向量 |
| `Matrix3x2` / `Matrix4x4` | `System.Numerics.Matrix*` | 矩阵 |
| `Quaternion` | `System.Numerics.Quaternion` | 四元数 |
| `Plane` | `System.Numerics.Plane` | 平面 |

设计上，这些类型是对 `System.Numerics` 的**类型安全包装**：既有强类型（例如把角度和数字分开，避免“弧度还是角度”的混淆），又能通过隐式转换与底层无缝互操作。

## 2. Vector3——三维向量

```csharp
public readonly partial struct Vector3   // 在 namespace Ara3D.Geometry
{
    public readonly SNVector3 Value;     // 底层 System.Numerics.Vector3
    public Number X { get; }
    public Number Y { get; }
    public Number Z { get; }

    // 与 System.Numerics.Vector3 隐式互转
    public static implicit operator SNVector3(Vector3 v);
    public static implicit operator Vector3(SNVector3 v);

    // 运算符：+ - * / % 及一元负号
    public static Vector3 operator +(Vector3 left, Vector3 right);
    public static Vector3 operator *(Vector3 left, Number scalar);

    // 常用方法
    public Number  Distance(Vector3 v2);
    public Number  DistanceSquared(Vector3 v2);
    public Number  Dot(Vector3 right);
    public Vector3 Cross(Vector3 right);
    public Vector3 Normalize { get; }
    public Number  Length { get; }
    public Number  LengthSquared { get; }
    public Vector3 Reflect(Vector3 normal);
    public Vector3 Clamp(Vector3 min, Vector3 max);
    public Vector3 Transform(Matrix4x4 matrix);
    public Vector3 Transform(Quaternion rotation);
    public Vector3 TransformNormal(Matrix4x4 matrix);
    public Vector3 Min(Vector3 v2);
    public Vector3 Max(Vector3 v2);
}
```

用法：

```csharp
var a = new Vector3(1, 0, 0);
var b = new Vector3(0, 1, 0);
Vector3 n = a.Cross(b).Normalize;   // (0,0,1)
Number  d = a.Dot(b);               // 0
Number  len = (a - b).Length;       // √2
```

> 提示：许多“计算属性”（如 `Normalize`、`Length`）是**只读属性**而非方法，符合“无副作用的数学量”这一直觉。`Point3D` 表示位置，`Vector3` 表示方向/位移，几何库对二者做了语义区分。

## 3. Matrix4x4——4×4 变换矩阵

```csharp
public partial struct Matrix4x4
{
    public readonly SNMatrix4x4 Value;

    // 工厂方法
    public static Matrix4x4 CreateTranslation(Vector3 position);
    public static Matrix4x4 CreateScale(Number scale);
    public static Matrix4x4 CreateScale(Number x, Number y, Number z);
    public static Matrix4x4 CreateRotationX(Angle angle);
    public static Matrix4x4 CreateRotationY(Angle angle);
    public static Matrix4x4 CreateRotationZ(Angle angle);

    // 属性
    public Vector3   Translation { get; }
    public Number    Determinant { get; }
    public Matrix4x4 Transpose { get; }
    public Matrix4x4 Invert { get; }     // 不可逆时抛异常
    public Quaternion Rotation { get; }

    // 分解为 (平移, 旋转, 缩放, 是否成功)
    public (Vector3, Quaternion, Vector3, Boolean) Decompose { get; }

    public Matrix4x4 Lerp(Matrix4x4 m2, Number amount);
    // 运算符：+ - * /
}
```

组合变换（注意 `System.Numerics` 是行主序、行向量约定，矩阵相乘顺序为“先应用的在左”）：

```csharp
var t = Matrix4x4.CreateTranslation(new Vector3(0, 0, 5));
var r = Matrix4x4.CreateRotationY(Angle.Degrees(30));
var s = Matrix4x4.CreateScale(2, 1, 1);
var world = s * r * t;                          // 先缩放，再旋转，再平移

var (pos, rot, scl, ok) = world.Decompose;      // 反解 TRS
```

## 4. Quaternion 与 Angle

四元数用于稳定的旋转表示与插值：

```csharp
public partial struct Quaternion
{
    public static Quaternion CreateFromAxisAngle(Vector3 axis, Angle angle);
    public static Quaternion CreateFromYawPitchRoll(Angle yaw, Angle pitch, Angle roll);
    public static Quaternion CreateFromRotationMatrix(Matrix4x4 matrix);

    public Quaternion Concatenate(Quaternion value2);
    public Quaternion Lerp(Quaternion q2, Number amount);
    public Quaternion Slerp(Quaternion q2, Number amount);   // 球面线性插值
    public Quaternion Normalize { get; }
    public Quaternion Conjugate { get; }
    public Quaternion Inverse { get; }
}
```

`Angle` 是类型安全的角度，内部始终以弧度存储，避免“度/弧度”混淆：

```csharp
public readonly partial struct Angle
{
    public static Angle Degrees(Number d);   // 从角度创建
    public static Angle Radians(Number r);   // 从弧度创建
    public Number Turns { get; }             // 圈数 [0,1]

    public Number Sin { get; }
    public Number Cos { get; }
    public Number Tan { get; }

    public Quaternion RotateX { get; }       // 绕 X 轴的旋转四元数
    public Quaternion RotateY { get; }
    public Quaternion RotateZ { get; }
}
```

示例：

```csharp
var q = Quaternion.CreateFromAxisAngle(Vector3.UnitY, Angle.Degrees(90));
var p = new Vector3(1, 0, 0).Transform(q);   // ≈ (0,0,-1)

// 用“圈”做参数化更直观
Angle quarter = 0.25f.Turns();               // 0.25 圈 = 90°
```

## 5. Ara3D.F8——AVX 8 宽 float

到目前为止的类型都是“一次处理一个”。当你要变换**几百万个顶点**时，逐个调用的开销不可忽视。`Ara3D.F8` 用 **AVX**（`Vector256<float>`）把 8 个 float 打包成一个 `f8`，一条指令并行处理。

```csharp
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public readonly struct f8
{
    public readonly Vector256<float> Value;

    public f8(float scalar);                       // 广播：8 个都等于 scalar
    public f8(float f0, float f1, /* ... */ float f7);

    public static f8 Zero, One, AllBitsSet, SignMask;

    public float this[int index] { get; }          // 取第 index 个 lane
    public int Count { get; }                       // 恒为 8

    // 算术（全部走 SIMD）
    public static f8 operator +(f8 a, f8 b);
    public static f8 operator -(f8 a, f8 b);
    public static f8 operator *(f8 a, f8 b);
    public static f8 operator /(f8 a, f8 b);
    public static f8 operator *(f8 a, float scalar); // 标量广播乘

    // 位运算
    public static f8 operator &(f8 a, f8 b);
    public static f8 operator |(f8 a, f8 b);
    public static f8 AndNot(f8 a, f8 b);

    // 比较（返回掩码 f8，命中的 lane 全 1）
    public static f8 operator <(f8 a, f8 b);
    public static f8 operator >=(f8 a, f8 b);

    // 条件选择（blend）
    public static f8 ConditionalSelect(f8 condition, f8 a, f8 b);
}
```

要点：

- 比较运算返回的是**掩码**（每个 lane 全 0 或全 1），配合 `ConditionalSelect` 实现无分支（branchless）逻辑；
- `d4` 是对应的 4 宽 double 版本（`Vector256<double>`），用法类似。

## 6. Vector3x8——8 个并行的 Vector3

只有标量 `f8` 还不够，几何计算需要“8 个三维向量”。`Vector3x8` 用 **SoA（结构数组）** 布局，把 8 个向量的 X、Y、Z 分别存成三个 `f8`：

```csharp
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public readonly struct Vector3x8 : IEquatable<Vector3x8>
{
    public readonly f8 X;   // 8 个 x 分量
    public readonly f8 Y;   // 8 个 y 分量
    public readonly f8 Z;   // 8 个 z 分量

    public Vector3x8(f8 x, f8 y, f8 z);
    public Vector3x8(Vector3 v);   // 广播同一个向量到 8 个 lane

    // SoA 载入/存回
    public static Vector3x8 LoadSoA(ReadOnlySpan<float> xs, ys, zs);
    public void StoreSoA(Span<float> xs, ys, zs);

    // AoS（结构体数组）载入/存回——常用于顶点数组
    public static Vector3x8 LoadAoS(ReadOnlySpan<Vector3> vectors, int start = 0);
    public void StoreAoS(Span<Vector3> vectors, int start = 0);

    // 单 lane 访问
    public Vector3 GetLane(int lane);
    public Vector3x8 WithLane(int lane, Vector3 v);

    // 算术、Dot、Cross、Length、Normalize、ConditionalSelect ...
    public static readonly Vector3x8 Zero, One, UnitX, UnitY, UnitZ;
}
```

批量处理顶点示例：

```csharp
Vector3[] vertices = /* 大量顶点 */;
int i = 0;
for (; i + 8 <= vertices.Length; i += 8)
{
    var v8 = Vector3x8.LoadAoS(vertices, i);   // 一次读 8 个
    var scaled = v8 * new f8(2.0f);            // 8 个同时 ×2
    scaled.StoreAoS(vertices, i);              // 一次写回 8 个
}
// 处理剩余不足 8 个的尾部
for (; i < vertices.Length; i++)
    vertices[i] = vertices[i] * 2.0f;
```

配套还有 `BoundsUtil`（用 SIMD 计算包围盒）等辅助。

> 何时用 F8：只有在**明确的热点、批量、可对齐**的数据路径上才需要手写 SIMD。日常几何操作直接用 `Vector3`/`Matrix4x4` 即可，SDK 内部已在需要处使用 F8 优化。过早 SIMD 化会牺牲可读性。

## 7. 标量类型与几何类型如何协作

- 顶点集合通常是 `IReadOnlyList<Point3D>`；
- 变换用 `Matrix4x4` / `Quaternion` / `Transform3D`；
- `Ara3D.Models`（第 06 章）的 `InstanceStruct` 内部就用三列 `Vector4` 存一个 3×4 变换矩阵，追求紧凑（正好 64 字节）；
- `Ara3D.F8` 在渲染缓冲更新、包围盒批算等处提速。

理解这套“**类型安全数学 + 可选 SIMD**”的分层，你就能在“可读性”和“极致性能”之间自如取舍。

## 8. 本章小结

- Ara3D 的数学类型由 **Plato 生成**，是对 `System.Numerics` 的类型安全、不可变包装，位于 `Ara3D.Geometry` 命名空间；
- `Vector3`、`Matrix4x4`、`Quaternion`、`Angle` 覆盖常规三维数学，计算量多以只读属性暴露；
- `Ara3D.F8` 提供 `f8`（AVX 8 宽 float）、`Vector3x8`（SoA/AoS 载入的 8 路向量）、`d4`（4 宽 double），用于批量热点；
- 比较返回掩码 + `ConditionalSelect` 实现无分支逻辑；
- 日常用标量类型，热点再上 SIMD。

下一章我们用这些数学工具，进入 `Ara3D.Geometry` 的网格与程序化建模。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第03章-核心基础库Core详解" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第05章-几何与网格建模" style="text-decoration: none;">下一章 →</a>
</div>
