---
layout: default
title: 第08章：STL 导出与文件格式
---

# 第08章：STL 导出与文件格式

建模的最终目的通常是**产出一个可制造、可查看的文件**。OpenCSG.NET 内置了对 **STL（STereoLithography）** 格式的导出支持——这是 3D 打印和快速原型领域事实上的通用格式。本章讲清 ASCII 与二进制两种 STL 的写出方式、扇形三角化原理、数字格式化的陷阱、二进制头部的"solid"坑，以及导出实践中的注意事项。

库里现在有**两套导出路线**，本章以现代路线为主（两套的三角形切分算法与格式细节完全一致）：

1. **现代管线（推荐）**：`CsgMesh.TrianglesOf(solid)` 把实体转成 **Z-up** 三角网格，交给 `StlWriter.Write(...)` 写出——格式显式指定、返回面数/字节数统计（本章 8.2、8.4~8.7）。
2. **经典扩展方法（源码仍在用）**：`Formats.cs` 里挂在 `Solid`/`Polygon`/`Vertex`/`Vector3D` 上的 `WriteStl`/`ToStlString` 扩展方法，直接在 CSG 的 **Y-up** 坐标里写出（本章 8.3）。

## 8.1 STL 格式速览

STL 用一堆**三角面片**描述实体表面，每个三角面片记录一个法线和三个顶点。它有两种编码：

| 特性 | ASCII STL | 二进制 STL |
| --- | --- | --- |
| 可读性 | 纯文本，可直接阅读/diff | 二进制，不可读 |
| 文件体积 | 大（每三角约几百字节） | 小（每三角固定 50 字节） |
| 数值精度 | 保留 `double` 的文本精度 | **降为 32 位 `float`** |
| 适用 | 调试、版本对比、小模型 | 生产、大模型、传输 |

一个共同点：**STL 只存储三角面片，没有单位、没有颜色（标准）、没有材质**。所谓"这个模型是毫米还是英寸"，完全由下游软件约定——STL 里的数字就是裸坐标值。

## 8.2 现代管线：CsgMesh + StlWriter

推荐的导出流程只有两步——**转网格、写文件**：

```csharp
using Csg;
using static Csg.Solids;

var part = Cube(size: 10, center: true).Subtract(Sphere(r: 6));

// ① 实体 → Z-up 三角网格
var triangles = CsgMesh.TrianglesOf(part);

// ② 网格 → STL 文件（默认二进制）
var result = StlWriter.Write("part.stl", triangles, StlFormat.Binary, header: "part");

Console.WriteLine($"{result.TriangleCount} 面, {result.Bytes} 字节 → {result.Path}");
```

`StlWriter` 的关键成员：

```csharp
public enum StlFormat { Binary, Ascii }

public sealed class StlWriteResult
{
    public string Path { get; }
    public int TriangleCount { get; }
    public long Bytes { get; }
}

public static StlWriteResult Write(string path, IReadOnlyList<MeshTriangle> triangles,
                                   StlFormat format = StlFormat.Binary, string? header = null);
```

选择 ASCII 只需改一个枚举值：

```csharp
StlWriter.Write("part_ascii.stl", triangles, StlFormat.Ascii, header: "part");
```

### 8.2.1 坐标系：Y-up → Z-up（与经典方法的差异）

`CsgMesh` 会把 CSG 实体的 **Y-up** 坐标换算成网格的 **Z-up**（`FromCsg` 做 Y↔Z 交换），并把扇形三角化的绕序反转一次补偿反射——这样导出的 STL 与"在 Z-up CAD 里直接落图的实体"姿态一致。**导出口径的完整原理在第 12 章**，这里只需记住：

- **现代管线（CsgMesh + StlWriter）= Z-up**；
- **经典扩展方法（Formats.cs）= Y-up（CSG 原生坐标）**。

同一次建模，两套管线导出的坐标数值不同（Y、Z 互换）——下游软件若不区分，模型会"躺倒"。**同一项目内只用一套口径**是最省心的策略。

### 8.2.2 头部处理与数字格式

- `header` 省略时默认 `"STL export"`（纯 ASCII）；给定值中的 `\r`/`\n` 一律替换为空格，防止破坏文件结构。
- 二进制路径超长头**截断到 79 字节**（80 字节定长头末位留零）；ASCII 路径的 `solid`/`endsolid` 名完整写出、**不截断**。
- ASCII 数字格式为 `{0:0.######}`（六位小数）+ `InvariantCulture`（见 8.5 的国际化坑）。
- 法向由**绕序重算**（`StlWriter.NormalOf`），不信任调用方；退化三角形写零法向。

## 8.3 经典扩展方法：WriteStl 与 ToStlString

源码里仍然保留了 `Formats.cs` 的扩展方法入口——官方示例（`Runner.Examples`、`Runner.CPurlin`）至今在使用。它在 CSG 的 **Y-up 原生坐标**里直接写出：

```csharp
// 方式一：写入文件（ASCII）
using (var writer = new StreamWriter("part.stl"))
{
    part.WriteStl("part", writer);
}

// 方式二：写入文件（二进制）——同名方法，换成 BinaryWriter 即切换编码
using (var fs = File.Create("part_bin.stl"))
using (var bw = new BinaryWriter(fs))
{
    part.WriteStl("part", bw);
}
```

`WriteStl(this Solid csg, string name, TextWriter writer)` 的第二个参数 `name` 是写进 STL 头尾的实体名（`solid <name> ... endsolid <name>`）。生成的文本大致长这样：

```
solid part
facet normal 0 0 1
outer loop
vertex 5 5 5
vertex -5 5 5
vertex -5 -5 5
endloop
endfacet
...
endsolid part
```

### 8.3.1 不落盘：ToStlString

如果你想在内存里检查、比较或通过网络发送 STL，可以用 `ToStlString`：

```csharp
string stl = part.ToStlString("part");   // 返回完整 ASCII STL 文本（Y-up 坐标）
Console.WriteLine(stl.Substring(0, 200)); // 看看开头
```

`ToStlString` 内部就是用一个 `StringWriter` 调 `WriteStl`，非常适合单元测试里对导出结果做断言。

### 8.3.2 二进制头部的 "solid" 陷阱

经典二进制路径有一个精妙的兼容性处理。STL 规范建议：**二进制文件的 80 字节头部绝不能以 ASCII 字符串 "solid" 开头**，否则某些软件会把它误判成 ASCII STL（因为 ASCII STL 正是以 `solid` 开头的）。

`Formats.cs` 的二进制导出为此做了保护：如果你传入的 `name` 恰好以 "solid"（不区分大小写）开头，它会**自动在头部前面加上 "stlbin" 前缀**，避免被误判：

```csharp
// 假设 name = "solidBracket"
// 二进制头部会写成 "stlbin" + "solidBracket"，而不是直接 "solidBracket"
```

之后再把 `name` 以 ASCII 编码填进头部剩余空间（超长会被截断到 80 字节以内）。你通常不必关心这个细节，但了解它能解释"为什么我的二进制 STL 头部多了 stlbin 几个字"。现代管线 `StlWriter` 则用另一个角度解决同一问题：默认头 `"STL export"` + 换行净化 + 截断 79 字节，不依赖前缀游戏。

### 8.3.3 精度：double 降为 float

务必注意：二进制 STL 用 **32 位单精度浮点（REAL32）** 存坐标，而 OpenCSG.NET 内部用的是 **64 位 double**。导出二进制时会发生 `(float)` 强制转换，**精度下降**。对绝大多数打印/加工场景，float 精度绰绰有余；但如果你的模型坐标数量级很大、或对微米级精度敏感，要意识到这一步的精度损失。ASCII STL 则保留 double 的完整文本精度（六位小数输出）。

### 8.3.4 二进制 STL 的文件结构

无论哪套管线，二进制 STL 的布局都是固定的：

```
UINT8[80]   头部（80 字节，通常被忽略）
UINT32      三角形数量
每个三角形（50 字节）：
    REAL32[3]  法线向量   （12 字节）
    REAL32[3]  顶点 1     （12 字节）
    REAL32[3]  顶点 2     （12 字节）
    REAL32[3]  顶点 3     （12 字节）
    UINT16     属性字节数 （2 字节，这里恒为 0）
```

`StlWriter` 中的 `HeaderLength = 80`、`FacetLength = 50` 两个常量正对应这个布局。

## 8.4 扇形三角化：多边形如何变成三角面片

`Solid` 内部存的是**多边形**（可能是四边形、五边形……），而 STL 只认**三角形**。导出时需要把每个多边形**三角化**。OpenCSG.NET 用最简单的**扇形三角化（fan triangulation）**：以多边形的第一个顶点为"扇心"，依次和后续相邻两点组成三角形。

对一个有 N 个顶点的多边形 `v0, v1, ..., v(N-1)`，生成 **N − 2 个三角形**：

```
(v0, v1, v2), (v0, v2, v3), (v0, v3, v4), ...
```

现代管线的实现（`CsgMesh.TrianglesOf`）就是这个循环，外加**绕序反转**补偿 Y↔Z 反射（第 12 章详解）：

```csharp
var a = FromCsg(vertices[0].Pos);
for (var i = 1; i + 1 < vertices.Count; i++)
    triangles.Add(new MeshTriangle(a, FromCsg(vertices[i + 1].Pos), FromCsg(vertices[i].Pos)));
```

### 8.4.1 为什么这依赖"多边形是凸的"

扇形三角化**只对凸多边形正确**。如果多边形是凹的，从第一个顶点拉出的扇形三角形可能落到多边形外部，产生错误面片。幸运的是，第 3、4 章讲过——**OpenCSG.NET 的所有 `Polygon` 都被约定为凸多边形**，布尔运算与规范化也维持这个不变量。所以扇形三角化在这个库里总是安全的。这也解释了为什么该库不需要复杂的耳切/三角化算法来导出 STL（但生成型材截面时需要，见第 10 章）。

### 8.4.2 法线从哪来

现代管线中，每个三角面片的法线由 `StlWriter.NormalOf` **按绕序（右手法则）重算并归一化**——不信任任何外部输入；退化三角形（面积趋零）写零法向，符合"读入方可自行忽略"的 STL 约定。因为一个平面多边形三角化出的所有三角形共面，重算法线与多边形平面法线天然一致。顶点少于 3 个的退化多边形会被**跳过**。

## 8.5 数字格式化：InvariantCulture 的重要性

一个看似不起眼、实则关乎"能不能被正确读取"的细节：**数字必须用不变文化（InvariantCulture）格式化**。

在某些区域设置（如德语、法语）里，小数点是逗号 `,` 而不是句点 `.`。如果 STL 里写出 `vertex 1,5 2,0 3,0`，几乎所有 STL 读取器都会解析失败或错乱。OpenCSG.NET 的 `Formats` 明确用 `CultureInfo.InvariantCulture` 来格式化所有坐标：

```csharp
static readonly IFormatProvider icult = System.Globalization.CultureInfo.InvariantCulture;
// ...
string.Format(icult, "vertex {0} {1} {2}", pos.X, pos.Y, pos.Z);
```

这样无论程序运行在什么区域设置下，导出的 STL 都用标准的 `.` 小数点，保证跨环境可读。**如果你自己扩展导出逻辑，切记也要用 InvariantCulture**，这是一个经典的国际化坑。

## 8.6 导出实践清单

把导出相关的经验汇总成一份清单：

- **选 ASCII 还是二进制？** 调试、想 diff、模型小 → ASCII；生产、模型大、要传输 → 二进制。
- **文件扩展名**：两种编码都用 `.stl`。查看器靠内容而非扩展名区分。
- **确保水密**：布尔运算若输入了非流形/破面几何，导出的 STL 也会有洞。导出前保证你的实体是干净的闭合实体（合理使用"挖孔略微超出"等技巧，见第 6 章）。
- **单位**：STL 无单位。团队内约定好"1 单位 = 1 毫米"之类，并在整个建模流程中保持一致。
- **分辨率**：导出前把曲面分辨率调到目标质量（第 5 章）；ASCII 高分辨率模型文件会很大，此时优先二进制。
- **用 `using` 管理写入器**：确保 `StreamWriter`/`BinaryWriter` 被正确 flush 和释放，否则文件可能不完整。
- **验证**：导出后用查看器（Windows"3D 查看器"、Blender、在线 STL viewer）打开确认；或在测试里用 `ToStlString` 断言面数/内容。

## 8.7 一个完整的导出示例

把建模到导出走一遍完整流程，用**现代管线**同时导出二进制与 ASCII 两份对照：

```csharp
using Csg;
using static Csg.Solids;

// 建模：一个带通孔的圆角立方体
var body = Intersection(
                Cube(size: 20, center: true),
                Sphere(r: 13, center: true))     // 圆角
           .Subtract(
                Cylinder(r: 4, h: 30, center: true).RotateX(90)); // 通孔（略高，避免共面）

Console.WriteLine($"多边形数：{body.Polygons.Count}");

// 实体 → 网格（Z-up）
var triangles = CsgMesh.TrianglesOf(body);

// 二进制（默认）
var bin = StlWriter.Write("body_bin.stl", triangles, StlFormat.Binary, "body");
// ASCII
var asc = StlWriter.Write("body_ascii.stl", triangles, StlFormat.Ascii, "body");

Console.WriteLine($"bin: {bin.TriangleCount} 面 / {bin.Bytes} 字节");
Console.WriteLine($"ascii: {asc.TriangleCount} 面 / {asc.Bytes} 字节");
```

运行后你会得到 `body_ascii.stl` 与 `body_bin.stl` 两个文件，几何一致但体积悬殊——这直观展示了两种编码的取舍。你还可以顺手验算一下二进制文件的字节数：`80 + 4 + 50 × 面数`，与 `result.Bytes` 应严格相等。

## 8.8 本章小结

- 导出有**两套路线**：现代管线 `CsgMesh.TrianglesOf` → `StlWriter.Write(path, triangles, format, header)`（**Z-up**、有 `StlWriteResult` 统计）；经典扩展方法 `solid.WriteStl(name, TextWriter/BinaryWriter)`、`ToStlString(name)`（**Y-up 原生坐标**）。**同一项目内保持一套口径**。
- ASCII 可读、可 diff、保留 double 精度但体积大；二进制体积小但坐标**降为 float**，布局为 `80 + 4 + 50×面数` 字节。
- 导出用**扇形三角化**把凸多边形拆成 N−2 个三角形；`CsgMesh` 在三角化时**反转绕序**，补偿 Y↔Z 反射带来的朝向翻转。
- 二进制头部有两个防护：经典方法对以 "solid" 开头的名字自动加 **"stlbin" 前缀**；现代管线用 ASCII 安全默认头 + 换行净化 + 截断 79 字节。
- 所有数字用 **InvariantCulture** 格式化（ASCII 路径六位小数），保证跨区域设置可读——自定义导出时务必遵循。
- 实践上注意 ASCII/二进制的取舍、水密性、无单位约定、分辨率（第 12 章的自适应细分为此而生）、以及用 `using` 正确释放写入器。

至此，命令式 API 的"创建—组合—变换—导出"闭环全部打通。下一章我们转向**声明式 API**——用不可变的 `CsgNode` 树来描述建模意图，为序列化和参数化持久化打下基础。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第07章-几何变换平移旋转与缩放/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第09章-声明式CsgNode树与求值器/" class="chapter-nav__next">下一章 →</a>
</div>
