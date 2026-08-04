---
layout: default
title: 第08章：STL 导出与文件格式
---

# 第08章：STL 导出与文件格式

建模的最终目的通常是**产出一个可制造、可查看的文件**。OpenCSG.NET 内置了对 **STL（STereoLithography）** 格式的导出支持——这是 3D 打印和快速原型领域事实上的通用格式。本章讲清 ASCII 与二进制两种 STL 的写出方式、扇形三角化原理、数字格式化的陷阱、二进制头部的"solid"坑，以及导出实践中的注意事项。所有导出功能定义在 `Formats.cs`，以**扩展方法**形式挂在 `Solid`、`Polygon`、`Vertex`、`Vector3D` 上。

## 8.1 STL 格式速览

STL 用一堆**三角面片**描述实体表面，每个三角面片记录一个法线和三个顶点。它有两种编码：

| 特性 | ASCII STL | 二进制 STL |
| --- | --- | --- |
| 可读性 | 纯文本，可直接阅读/diff | 二进制，不可读 |
| 文件体积 | 大（每三角约几百字节） | 小（每三角固定 50 字节） |
| 数值精度 | 保留 `double` 的文本精度 | **降为 32 位 `float`** |
| 适用 | 调试、版本对比、小模型 | 生产、大模型、传输 |

一个共同点：**STL 只存储三角面片，没有单位、没有颜色（标准）、没有材质**。所谓"这个模型是毫米还是英寸"，完全由下游软件约定——STL 里的数字就是裸坐标值。

## 8.2 导出为 ASCII STL

最常用的方式，把实体写进一个 `TextWriter`：

```csharp
using Csg;
using static Csg.Solids;

var part = Cube(size: 10, center: true).Subtract(Sphere(r: 6));

// 方式一：写入文件
using (var writer = new StreamWriter("part.stl"))
{
    part.WriteStl("part", writer);
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

### 8.2.1 拿到 STL 字符串（不落盘）

如果你想在内存里检查、比较或通过网络发送 STL，可以用 `ToStlString`：

```csharp
string stl = part.ToStlString("part");   // 返回完整 ASCII STL 文本
Console.WriteLine(stl.Substring(0, 200)); // 看看开头
```

`ToStlString` 内部就是用一个 `StringWriter` 调 `WriteStl`，非常适合单元测试里对导出结果做断言。

## 8.3 导出为二进制 STL

只要把 `TextWriter` 换成 `BinaryWriter`，就调用到二进制版本的重载——**同名方法，靠参数类型区分**：

```csharp
using (var fs = File.Create("part.stl"))
using (var writer = new BinaryWriter(fs))
{
    part.WriteStl("part", writer);   // 二进制 STL
}
```

二进制 STL 的结构是固定的：

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

### 8.3.1 二进制头部的 "solid" 陷阱

这里藏着一个精妙的兼容性处理。STL 规范建议：**二进制文件的 80 字节头部绝不能以 ASCII 字符串 "solid" 开头**，否则某些软件会把它误判成 ASCII STL（因为 ASCII STL 正是以 `solid` 开头的）。

OpenCSG.NET 的二进制导出为此做了保护：如果你传入的 `name` 恰好以 "solid"（不区分大小写）开头，它会**自动在头部前面加上 "stlbin" 前缀**，避免被误判：

```csharp
// 假设 name = "solidBracket"
// 二进制头部会写成 "stlbin" + "solidBracket"，而不是直接 "solidBracket"
```

之后再把 `name` 以 ASCII 编码填进头部剩余空间（超长会被截断到 80 字节以内）。你通常不必关心这个细节，但了解它能解释"为什么我的二进制 STL 头部多了 stlbin 几个字"。

### 8.3.2 精度：double 降为 float

务必注意：二进制 STL 用 **32 位单精度浮点（REAL32）** 存坐标，而 OpenCSG.NET 内部用的是 **64 位 double**。导出二进制时会发生 `(float)` 强制转换，**精度下降**。对绝大多数打印/加工场景，float 精度绰绰有余；但如果你的模型坐标数量级很大、或对微米级精度敏感，要意识到这一步的精度损失。ASCII STL 则保留 double 的完整文本精度。

## 8.4 扇形三角化：多边形如何变成三角面片

`Solid` 内部存的是**多边形**（可能是四边形、五边形……），而 STL 只认**三角形**。导出时需要把每个多边形**三角化**。OpenCSG.NET 用最简单的**扇形三角化（fan triangulation）**：以多边形的第一个顶点为"扇心"，依次和后续相邻两点组成三角形。

对一个有 N 个顶点的多边形 `v0, v1, ..., v(N-1)`，生成 **N − 2 个三角形**：

```
(v0, v1, v2), (v0, v2, v3), (v0, v3, v4), ...
```

源码里就是这个循环（ASCII 与二进制版本一致）：

```csharp
for (var i = 0; i < polygon.Vertices.Count - 2; i++)
{
    // 三角形 = (Vertices[0], Vertices[i+1], Vertices[i+2])
}
```

### 8.4.1 为什么这依赖"多边形是凸的"

扇形三角化**只对凸多边形正确**。如果多边形是凹的，从第一个顶点拉出的扇形三角形可能落到多边形外部，产生错误面片。幸运的是，第 3、4 章讲过——**OpenCSG.NET 的所有 `Polygon` 都被约定为凸多边形**，布尔运算与规范化也维持这个不变量。所以扇形三角化在这个库里总是安全的。这也解释了为什么该库不需要复杂的耳切/三角化算法来导出 STL（但生成型材截面时需要，见第 10 章）。

### 8.4.2 法线从哪来

每个三角面片的法线直接取自**多边形所在平面的法线**（`polygon.Plane.Normal`），而不是重新计算。因为一个平面多边形三角化出的所有三角形共面、法线相同，直接复用平面法线既快又一致。顶点少于 3 个的退化多边形会被**跳过**。

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

把建模到导出走一遍完整流程，同时导出 ASCII 和二进制两份对照：

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

// ASCII
using (var w = new StreamWriter("body_ascii.stl"))
    body.WriteStl("body", w);

// 二进制
using (var fs = File.Create("body_bin.stl"))
using (var bw = new BinaryWriter(fs))
    body.WriteStl("body", bw);

// 内存字符串（可用于测试/预览）
string preview = body.ToStlString("body");
Console.WriteLine(preview.Substring(0, Math.Min(160, preview.Length)));
```

运行后你会得到 `body_ascii.stl` 与 `body_bin.stl` 两个文件，几何一致但体积悬殊——这直观展示了两种编码的取舍。

## 8.8 本章小结

- OpenCSG.NET 以**扩展方法**提供 STL 导出：`WriteStl(..., TextWriter)` 写 **ASCII**、`WriteStl(..., BinaryWriter)` 写**二进制**、`ToStlString(name)` 返回 ASCII 字符串。
- ASCII 可读、可 diff、保留 double 精度但体积大；二进制体积小但坐标**降为 float**。
- 导出用**扇形三角化**把凸多边形拆成 N−2 个三角形，法线直接取自多边形平面；该方法安全的前提是库保证多边形**恒为凸**。
- 二进制头部对以 "solid" 开头的名字自动加 **"stlbin" 前缀**，避免被误判为 ASCII STL。
- 所有数字用 **InvariantCulture** 格式化，保证跨区域设置可读——自定义导出时务必遵循。
- 实践上注意 ASCII/二进制的取舍、水密性、无单位约定、分辨率、以及用 `using` 正确释放写入器。

至此，命令式 API 的"创建—组合—变换—导出"闭环全部打通。下一章我们转向**声明式 API**——用不可变的 `CsgNode` 树来描述建模意图，为序列化和参数化持久化打下基础。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第08章-STL导出与文件格式/第07章-几何变换平移旋转与缩放/">← 上一章</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第08章-STL导出与文件格式/">目录</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第08章-STL导出与文件格式/第09章-声明式CsgNode树与求值器/">下一章 →</a>
</div>
