# Clipper1/Clipper2 教程形态学内容优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 cad/（教程）与 sci/（源码解读）下的 Clipper1、Clipper2 四个系列中，就地修正形态学相关错误并补齐"膨胀/腐蚀/开运算/闭运算/梯度"完整内容，同步两个 GitHub 仓库的最新 API 事实。

**Architecture:** 4 个并行内容更新任务（文件集互不相交）+ 1 个全局验证任务。所有代码示例以已核对的仓库源码签名为准（见下）。不新增/删除章节文件、不动 index.md 与 navigation.yml。

**Tech Stack:** Jekyll 静态站点，Markdown 教程。C# 代码示例（ClipperLib / Clipper2Lib）。

## Global Constraints

- 只修改本任务指定的文件与段落；不新增章节文件；不动 `sci/*/index.md`、`cad/*/index.md`、`_data/navigation.yml`。
- 章节内新增小节必须顺延重编号，且同步修正本章小结/练习题中引用的小节编号。
- 代码语言一律 C#；API 签名必须与本计划附录"已核对 API 参考"一致，不得凭记忆写。
- 中文写作，无 emoji；风格匹配所在章节现有文风（cad=概念+代码+练习，sci=源码分析+原理+注意事项）。
- 代码块围栏 ` ```csharp ` 成对闭合。
- 禁止提交 git——任务完成后报告改动文件清单与验证结果，由编排者统一验证提交。
- 数学正确性红线：腐蚀必须用补集法 `A ⊖ B = (Aᶜ ⊕ Bʳ)ᶜ`，禁止出现"腐蚀 = MinkowskiDiff"的说法；开运算=先腐蚀后膨胀；闭运算=先膨胀后腐蚀。

## 已核对 API 参考（2026-08 从仓库源码逐行核对）

### Clipper2（AngusJohnson/Clipper2 main 分支，CSharp/Clipper2Lib）

- 静态工具在 `public static class Clipper`（Clipper.cs）。
- `public static Paths64 MinkowskiSum(Path64 pattern, Path64 path, bool isClosed);`
- `public static PathsD MinkowskiSum(PathD pattern, PathD path, bool isClosed);`（注意：**无** precision 参数，旧教程中的 `int precision = 2` 已移除；PathD 精度由内部 `Minkowski.Sum` 的 `decimalPlaces = 2` 默认值处理）
- `public static Paths64 MinkowskiDiff(Path64 pattern, Path64 path, bool isClosed);`、`PathD` 同构。
- `public static Paths64 InflatePaths(Paths64 paths, double delta, JoinType joinType, EndType endType, double miterLimit = 2.0, double arcTolerance = 0.0);`（PathD 重载多 `int precision = 2` 参数）。**`DeflatePaths` 不存在**——收缩 = 负 delta。
- `public static Path64 SimplifyPath(Path64 path, double epsilon, bool isClosedPath = true);`、`public static Paths64 SimplifyPaths(Paths64 paths, double epsilon, bool isClosedPaths = true);`
- `public static PointInPolygonResult PointInPolygon(Point64 pt, Path64 polygon);`；`[Flags] enum PointInPolygonResult { IsOn = 0, IsInside = 1, IsOutside = 2 }`
- `public static Rect64 GetBounds(Path64 path);`、`public static Rect64 GetBounds(Paths64 paths);`；`struct Rect64 { public long left; public long top; public long right; public long bottom; ... }`（字段小写）
- `public static Path64 MakePath(long[] arr);`（另有 int[]、double[] 重载）；`public static double Area(Path64 path);`；`public static bool IsPositive(Path64 poly);`
- `public static Path64 ReversePath(Path64 path);`、`public static Paths64 ReversePaths(Paths64 paths);`
- `public static Path64 ScalePath64(PathD path, double scale);`、`public static PathsD ScalePathsD(Paths64 paths, double scale);`
- `public static Paths64 Union(Paths64 subject, FillRule fillRule);`、`public static Paths64 Difference(Paths64 subject, Paths64 clip, FillRule fillRule);`
- `class Path64 : List<Point64>`、`class Paths64 : List<Path64>`；`struct Point64 { public long X; public long Y; public Point64(long x, long y); ... }`
- `enum JoinType { Miter, Square, Bevel, Round }`、`enum EndType { Polygon, Joined, Butt, Square, Round }`、`enum FillRule { EvenOdd, NonZero, Positive, Negative }`、`enum ClipType { NoClip, Intersection, Union, Difference, Xor }`
- 引擎类 `Clipper64`：`void AddSubject(Paths64 paths);`、`bool Execute(ClipType clipType, FillRule fillRule, Paths64 solutionClosed);`
- `class ClipperOffset { public void AddPath(Path64 path, JoinType joinType, EndType endType); public void AddPaths(Paths64 paths, JoinType joinType, EndType endType); public void Execute(double delta, Paths64 solution); }`（**注意参数顺序**：(delta, solution)）

### Clipper1（znlgis/Clipper1 镜像，v6.4.2，C%23/clipper_library/clipper.cs）

- 命名空间 `ClipperLib`；`using Path = List<IntPoint>;`、`using Paths = List<List<IntPoint>>;`；`cInt = long`。
- **存在**：`public static Paths MinkowskiSum(Path pattern, Path path, bool pathIsClosed);`、`public static Paths MinkowskiSum(Path pattern, Paths paths, bool pathIsClosed);`、`public static Paths MinkowskiDiff(Path poly1, Path poly2);`（**无 isClosed 参数**）
- `public static IntRect GetBounds(Paths paths);`（**只有 Paths 重载**，单路径需包一层 `new Paths { path }`）；`struct IntRect { public cInt left; public cInt top; public cInt right; public cInt bottom; }`；`struct IntPoint { public cInt X; public cInt Y; }`
- **无** `MakePath`。
- `enum ClipType { ctIntersection, ctUnion, ctDifference, ctXor }`、`enum PolyType { ptSubject, ptClip }`、`enum PolyFillType { pftEvenOdd, pftNonZero, pftPositive, pftNegative }`、`enum JoinType { jtSquare, jtRound, jtMiter }`、`enum EndType { etClosedPolygon, etClosedLine, etOpenButt, etOpenSquare, etOpenRound }`
- `Clipper` 类：`public bool AddPath(Path pg, PolyType polyType, bool Closed);`、`public bool AddPaths(Paths ppg, PolyType polyType, bool closed);`、`public bool Execute(ClipType clipType, Paths solution, PolyFillType FillType = PolyFillType.pftEvenOdd);`、`public bool Execute(ClipType clipType, Paths solution, PolyFillType subjFillType, PolyFillType clipFillType);`
- `ClipperOffset`：`public void AddPath(Path path, JoinType joinType, EndType endType);`、`public void AddPaths(Paths paths, JoinType joinType, EndType endType);`、`public void Execute(ref Paths solution, double delta);`（**ref + 参数顺序 (solution, delta)**）
- 偏移方向约定：外轮廓需正面积方向（CCW），正 delta 膨胀。

## 参考实现（任务中嵌入的权威代码）

### 通用形态学（Clipper2，已按当前 API 编写）

```csharp
using Clipper2Lib;

// 圆盘结构元素（正多边形近似，中心在原点）
public static Path64 MakeDisk(long radius, int edgeCount = 32)
{
    Path64 disk = new Path64(edgeCount);
    for (int i = 0; i < edgeCount; i++)
    {
        double angle = 2 * Math.PI * i / edgeCount;
        disk.Add(new Point64(
            (long)Math.Round(radius * Math.Cos(angle)),
            (long)Math.Round(radius * Math.Sin(angle))));
    }
    return disk;
}

// 补集：包围盒减去 paths
public static Paths64 Complement(Paths64 paths, Rect64 bounds)
{
    Path64 box = Clipper.MakePath(new long[] {
        bounds.left, bounds.top,
        bounds.right, bounds.top,
        bounds.right, bounds.bottom,
        bounds.left, bounds.bottom });
    return Clipper.Difference(new Paths64 { box }, paths, FillRule.NonZero);
}

// 结构元素关于原点的反射：B^r = {-b : b in B}
public static Path64 ReflectPath(Path64 pattern)
{
    Path64 reflected = new Path64(pattern.Count);
    foreach (Point64 pt in pattern)
        reflected.Add(new Point64(-pt.X, -pt.Y));
    return reflected;
}

// 形态学膨胀：A ⊕ B = MinkowskiSum(A, B)
public static Paths64 MorphDilate(Path64 shape, Path64 se)
    => Clipper.MinkowskiSum(shape, se, true);

// 形态学腐蚀：A ⊖ B = (A^c ⊕ B^r)^c
public static Paths64 MorphErode(Path64 shape, Path64 se)
{
    Rect64 b = Clipper.GetBounds(shape);
    Rect64 sb = Clipper.GetBounds(se);
    long w = sb.right - sb.left, h = sb.bottom - sb.top;
    Rect64 bounds = new Rect64(b.left - w, b.top - h, b.right + w, b.bottom + h);

    Paths64 comp = Complement(new Paths64 { shape }, bounds);
    Path64 seReflected = ReflectPath(se);
    Paths64 grown = new Paths64();
    foreach (Path64 p in comp)
        grown.AddRange(Clipper.MinkowskiSum(p, seReflected, true));
    return Complement(grown, bounds);
}

// 开运算：(A ⊖ B) ⊕ B —— 平滑凸角、剔除细小突起、断开窄桥
public static Paths64 MorphOpen(Path64 shape, Path64 se)
{
    Paths64 eroded = MorphErode(shape, se);
    Paths64 opened = new Paths64();
    foreach (Path64 p in eroded)
        opened.AddRange(Clipper.MinkowskiSum(p, se, true));
    return Clipper.Union(opened, FillRule.NonZero);
}

// 闭运算：(A ⊕ B) ⊖ B —— 平滑凹角、填充细小凹陷、弥合窄缝
public static Paths64 MorphClose(Path64 shape, Path64 se)
{
    Paths64 dilated = MorphDilate(shape, se);
    Paths64 closed = new Paths64();
    foreach (Path64 p in dilated)
        closed.AddRange(MorphErode(p, se));
    return Clipper.Union(closed, FillRule.NonZero);
}

// 形态学梯度：(A ⊕ B) \ (A ⊖ B) —— 得到边界带
public static Paths64 MorphGradient(Path64 shape, Path64 se)
    => Clipper.Difference(MorphDilate(shape, se), MorphErode(shape, se), FillRule.NonZero);
```

注意事项（写入教程）：
1. 结构元素必须**以原点为中心**，否则结果整体平移。
2. 结构元素对称时 Bʳ = B，可直接用原结构元素。
3. 腐蚀结果可能为空（结构元素比形状大）：先判空再继续。
4. 圆盘结构元素等价于 `JoinType.Round` 偏移：`Clipper.InflatePaths(paths, ±r, JoinType.Round, EndType.Polygon)`，实现更简单且快——**教程应说明：圆盘/方形结构元素优先用偏移，任意形状结构元素才用闵可夫斯基法**。
5. 迭代收缩（官方 README 兔子示例模式）每轮调用 `Clipper.SimplifyPaths(p, 0.25)` 清除碎屑。

### 偏移版形态学（Clipper2）

```csharp
// 圆盘结构元素半径 r 的膨胀 / 腐蚀
Paths64 dilated = Clipper.InflatePaths(paths,  r, JoinType.Round, EndType.Polygon);
Paths64 eroded  = Clipper.InflatePaths(paths, -r, JoinType.Round, EndType.Polygon);

// 开运算 = 先腐蚀后膨胀；闭运算 = 先膨胀后腐蚀；梯度 = 膨胀 - 腐蚀
Paths64 opened = Clipper.InflatePaths(
    Clipper.InflatePaths(paths, -r, JoinType.Round, EndType.Polygon),
    r, JoinType.Round, EndType.Polygon);
```

### Clipper1 版（整数坐标，缩放因子 1e6；无 MakePath、GetBounds 仅 Paths 重载）

```csharp
using ClipperLib;

const double scale = 1e6;

// 偏移版膨胀/腐蚀（jtRound = 圆盘结构元素）
ClipperOffset co = new ClipperOffset();
co.AddPaths(paths, JoinType.jtRound, EndType.etClosedPolygon);
Paths dilated = new Paths();
co.Execute(ref dilated, 5.0 * scale);

// 补集
public static Paths Complement(Paths paths, IntRect bounds)
{
    Path box = new Path {
        new IntPoint(bounds.left, bounds.top),
        new IntPoint(bounds.right, bounds.top),
        new IntPoint(bounds.right, bounds.bottom),
        new IntPoint(bounds.left, bounds.bottom) };
    Clipper clipper = new Clipper();
    clipper.AddPath(box, PolyType.ptSubject, true);
    clipper.AddPaths(paths, PolyType.ptClip, true);
    Paths result = new Paths();
    clipper.Execute(ClipType.ctDifference, result,
        PolyFillType.pftNonZero, PolyFillType.pftNonZero);
    return result;
}

// 任意结构元素腐蚀（补集法）
public static Paths MorphErode(Paths shape, Path se)
{
    IntRect b = Clipper.GetBounds(shape);
    IntRect sb = Clipper.GetBounds(new Paths { se });
    long w = sb.right - sb.left, h = sb.bottom - sb.top;
    IntRect bounds = new IntRect(b.left - w, b.top - h, b.right + w, b.bottom + h);

    Paths comp = Complement(shape, bounds);
    Path seReflected = new Path(se.Count);
    foreach (IntPoint pt in se)
        seReflected.Add(new IntPoint(-pt.X, -pt.Y));

    Paths grown = new Paths();
    foreach (Path p in comp)
        grown.AddRange(Clipper.MinkowskiSum(seReflected, p, true));
    return Complement(grown, bounds);
}
```

---

### Task 1: sci/Clipper2（第16、18、20章）— 深度实现

**Files:**
- Modify: `sci/Clipper2/第18章-Minkowski和与差.md`
- Modify: `sci/Clipper2/第16章-ClipperOffset偏移类详解.md`
- Modify: `sci/Clipper2/第20章-实际应用与最佳实践.md`

**Interfaces:**
- Consumes: 本计划"已核对 API 参考"（Clipper2 部分）+ "参考实现"。
- Produces: 修正后的 18.3.1/18.8.3 签名；18.6 完整形态学小节（18.6.3 形态学基础概念 / 18.6.4 形态学膨胀 / 18.6.5 形态学腐蚀（补集法）/ 18.6.6 开运算与闭运算 / 18.6.7 形态学梯度与组合应用）；16.13 形态学视角小节；20.6.5 交叉引用段落。

- [ ] **Step 1: 通读第18章**，确认 18.3.1（约 50-71 行）、18.6.3（约 310-329 行）、18.8.3（约 425-433 行）、18.10 小结（约 469-479 行）当前内容与上下文。

- [ ] **Step 2: 修复 18.3.1 过期签名**。将 PathD 版声明（含 `int precision = 2` 与 CheckPrecision/缩放实现）替换为当前实现：

```csharp
public static PathsD MinkowskiSum(PathD pattern, PathD path, bool isClosed)
{
    return Minkowski.Sum(pattern, path, isClosed);
}
```

并加一段说明：当前版本 Clipper 类只保留 3 参包装，内部委托 `Minkowski.Sum`（PathD 重载带 `int decimalPlaces = 2` 默认参数）；早期版本的 `precision` 参数已移除。18.8.3 中 `Clipper.MinkowskiSum(circleApprox, complexPath, true, 3)` 改为 `Clipper.MinkowskiSum(circleApprox, complexPath, true)`。

- [ ] **Step 3: 用完整形态学小节替换 18.6.3**。删除旧的错误 Dilate/Erode 代码（含 `ReflectPath` 未定义引用），改写为 5 个小节（### 18.6.3 ~ ### 18.6.7，18.6.1/18.6.2 不动，18.7 及之后编号不动）：
  - 18.6.3 形态学基础概念：二值形态学定义（膨胀 A ⊕ B = ∪{a+B}、腐蚀 A ⊖ B = {x : x+B ⊆ A}）、与闵可夫斯基运算的关系、**明确警告：闵可夫斯基差 A ⊕ (−B) 不是腐蚀**（它与碰撞检测有关，腐蚀是另一个概念）。
  - 18.6.4 形态学膨胀：`MorphDilate`（用参考实现），示例（三角形 + 小圆盘）。
  - 18.6.5 形态学腐蚀（补集法）：完整推导 `A ⊖ B = (Aᶜ ⊕ Bʳ)ᶜ` + `Complement`、`ReflectPath`、`MorphErode` 三个函数（用参考实现），注意事项（结构元素以原点为中心、对称时 Bʳ=B、结果可为空）。
  - 18.6.6 开运算与闭运算：`MorphOpen`/`MorphClose`（参考实现）+ 几何效果说明（开：剔突起/断窄桥；闭：填凹陷/弥窄缝）+ 圆盘版等价实现（`InflatePaths` 先 -r 后 +r / 先 +r 后 -r）。
  - 18.6.7 形态学梯度与组合应用：`MorphGradient`（参考实现）+ 应用场景（边界带提取、多边形质量检查、地图综合）。
- [ ] **Step 4: 更新 18.10 本章小结**：把"应用广泛：机器人、游戏、CAD"扩展为含形态学（膨胀/腐蚀/开/闭/梯度）的条目。

- [ ] **Step 5: 第16章新增形态学视角小节**。在 `## 16.13 本章小结` 之前插入 `## 16.13 形态学视角：偏移与结构元素`，原小结改为 16.14。内容：偏移 = 以圆盘（JoinType.Round）/方形（JoinType.Square）为结构元素的形态学膨胀或收缩（delta 符号）；`InflatePaths` 是静态简化 API（**DeflatePaths 不存在，收缩即负 delta**）；迭代收缩与 `SimplifyPaths` 配合（引用官方 README 兔子示例模式）；任意结构元素见第18章（交叉引用链接格式 `[第18章：Minkowski 和与差](https://znlgis.github.io/sci/Clipper2/第18章-Minkowski和与差/)`）。检查本章小结是否引用小节编号，若有则同步修正。

- [ ] **Step 6: 第20章 20.6.5 交叉引用**。在"路径膨胀/收缩"示例后加一段说明：该模式即形态学开运算/闭运算的特例，系统性讨论见第18章形态学小节（链接同上格式）。不改其他内容。

- [ ] **Step 7: 自查**。逐文件重读改动处：代码围栏闭合、API 与参考一致、小节编号连续、无"腐蚀=MinkowskiDiff"残留。报告：每个文件的改动摘要（改动前/后小节名）、自查结果。

### Task 2: sci/Clipper1（第17、19、20章）— 深度实现

**Files:**
- Modify: `sci/Clipper1/第17章-ClipperOffset详解.md`
- Modify: `sci/Clipper1/第19章-辅助函数与工具.md`
- Modify: `sci/Clipper1/第20章-实际应用与最佳实践.md`

**Interfaces:**
- Consumes: 本计划"已核对 API 参考"（Clipper1 部分）+ Clipper1 版参考实现。
- Produces: 17.12 形态学视角小节；19.x 形态学辅助函数小节（补集法腐蚀）；20.4.2 闭运算框架 + 20.x 形态学应用小节。

- [ ] **Step 1: 通读三个文件**，确认第17章末尾小节编号（小结在哪个编号）、第19章 19.4（约 138-217 行，含 19.4.1/19.4.2）与全章结构、第20章 20.4.2（约 286-304 行）与全章结构（小结编号）。

- [ ] **Step 2: 第19章 19.4 补充**。19.4 现有签名文档与 v6.4.2 一致（保留）。补充两点：(a) `MinkowskiSum(Path pattern, Paths paths, bool pathIsClosed)` 重载存在（pattern 与多条 path 逐一求和）；(b) `MinkowskiDiff(Path poly1, Path poly2)` 只有两参、无 isClosed。在 19.4.2 之后新增 `### 19.4.3 形态学腐蚀（补集法）`：用 Clipper1 版参考实现（Complement + MorphErode），推导 `A ⊖ B = (Aᶜ ⊕ Bʳ)ᶜ`，注意 GetBounds 只有 Paths 重载。若 19.4.3 编号与后文冲突（如后文已有 19.4.x），改为插入新 `## 19.x` 小节并整体顺延。

- [ ] **Step 3: 第17章新增形态学视角小节**。在小结前插入 `## 17.12 形态学视角：JoinType 与结构元素`（小结顺延为 17.13）。内容：jtRound = 圆盘结构元素、jtSquare = 方形结构元素；偏移方向约定（外轮廓正面积方向、正 delta 膨胀、负 delta 收缩即腐蚀）；与布尔运算组合的开/闭运算公式（先 -r 后 +r = 开，先 +r 后 -r = 闭）；说明 Clipper1 无 InflatePaths 简化 API、无 DeflatePaths。检查小结编号引用并修正。

- [ ] **Step 4: 第20章**。(a) 20.4.2 "先膨胀后收缩"：加一句"该模式即形态学闭运算（见第19章/第17章）"并给出开/闭运算对照公式（先腐蚀后膨胀 = 开运算）。 (b) 在小结前新增 `## 20.x 形态学应用案例`（编号按文件实际顺延）：案例1 小图斑剔除（开运算：先负偏移后正偏移，面积阈值过滤）；案例2 窄缝弥合与凹口填充（闭运算）；案例3 边界带提取（形态学梯度 = 膨胀 - 腐蚀，用 ctDifference）；每例附完整 Clipper1 代码（注意缩放因子与 ref Execute）。

- [ ] **Step 5: 自查**。重读改动处：代码围栏闭合、Clipper1 API 与参考一致（ref Execute、jtRound 等）、小节编号连续。报告改动摘要与自查结果。

### Task 3: cad/Clipper2（第01、04、05章）— 深度实现

**Files:**
- Modify: `cad/Clipper2/第01章-Clipper2概述与安装.md`
- Modify: `cad/Clipper2/第04章-多边形偏移操作.md`
- Modify: `cad/Clipper2/第05章-矩形裁剪与闵可夫斯基操作.md`

**Interfaces:**
- Consumes: Clipper2 API 参考 + Clipper2 参考实现。
- Produces: 第01章三角剖分警告；第04章 4.11 形态学操作小节；第05章 5.3.7 C++ 转 C#、全章 API 统一、5.3.10 形态学小节。

- [ ] **Step 1: 通读三个文件**，重点：第01章功能概述段落位置；第04章 4.10/4.11（常见问题/本章小结）与代码风格；第05章 5.3.7（约 352-431 行）C++ 代码全貌、5.3.9、5.4、5.6 小结。

- [ ] **Step 2: 第01章**。在功能概述处加一句警告（引用官方 README CAUTION）：当前版本三角剖分代码存在已知 bug，作者正在修复，教程建议在修复发布前谨慎使用三角剖分功能。

- [ ] **Step 3: 第04章新增形态学小节**。在 `## 4.11 本章小结` 之前插入 `## 4.11 形态学操作`（小结顺延为 4.12），含 ### 子节：4.11.1 膨胀与腐蚀（InflatePaths 正/负 delta + JoinType.Round=圆盘结构元素，附代码）；4.11.2 开运算与闭运算（先 -r 后 +r / 先 +r 后 -r，附代码 + 几何效果说明）；4.11.3 形态学梯度（膨胀 - 腐蚀，Clipper.Difference）；4.11.4 迭代收缩与碎屑清理（README 兔子模式：每轮 SimplifyPaths(p, 0.25)）；4.11.5 应用场景（小图斑剔除、窄缝弥合、凹口填充、边界带提取——每项 2-3 句 + 小代码片段）；文末注明任意形状结构元素见第05章闵可夫斯基法（链接格式 `[第五章](https://znlgis.github.io/cad/Clipper2/第05章-矩形裁剪与闵可夫斯基操作/)`）。同步修正本章小结中的小节编号引用（若有）与练习题（若有涉及编号）。

- [ ] **Step 4: 第05章 5.3.7 C++ 转 C#**。将 5.3.7 中全部 C++ 代码（std::vector、std::cout、`Point64 origin(0,0)` 构造、`const auto&` 循环）改写为等价 C#（`Paths64`/`Clipper.MakePath`/`Console.WriteLine`/`Clipper.PointInPolygon`），保持语义不变；全章扫描 `MinkowskiSum(`/`MinkowskiDiff(`/`Union(`/`PointInPolygon(` 裸调用，统一加 `Clipper.` 前缀（或在章首代码处说明 using static，二选一并保持一致）。

- [ ] **Step 5: 第05章新增 5.3.10**。在 `## 5.4 综合应用案例` 之前插入 `### 5.3.10 形态学操作（任意结构元素）`：说明 5.3.7 的"形态学膨胀"只是膨胀；完整给出 MorphDilate/MorphErode（补集法）/MorphOpen/MorphClose/MorphGradient（Clipper2 参考实现，函数名可简化），强调"闵可夫斯基差不等于腐蚀"，并给圆盘结构元素提示"等价于第04章 Round 偏移"。更新 5.6 本章小结条目提及形态学。

- [ ] **Step 6: 自查**。重读改动处；grep 本章确认无 C++ 残留（`std::`、`cout`、`const auto`）；代码围栏闭合；编号连续。报告改动摘要与自查结果。

### Task 4: cad/Clipper1（第01、04、06章）— 轻量实现

**Files:**
- Modify: `cad/Clipper1/第01章-Clipper1概述与安装.md`
- Modify: `cad/Clipper1/第04章-多边形偏移操作.md`
- Modify: `cad/Clipper1/第06章-实际应用案例与最佳实践.md`

**Interfaces:**
- Consumes: Clipper1 API 参考 + Clipper1 版参考实现。
- Produces: 第01章仓库信息段落；第04章 4.8 形态学操作小节（编号顺延，小结/练习题随动）；第06章交叉引用段落。

- [ ] **Step 1: 通读三个文件**，确认第01章安装/获取部分位置；第04章 4.7/4.8/4.9（性能优化/本章小结/练习题）编号与引用；第06章案例结构。

- [ ] **Step 2: 第01章**。在安装/获取部分补充：GitHub 仓库 https://github.com/znlgis/Clipper1 是 SourceForge（polyclipping）的镜像，仓库含 C#、Delphi、C++、Documentation（官方文档）以及 Clipper2 beta 目录（Clipper2 早期测试版，不建议新项目使用）。

- [ ] **Step 3: 第04章新增形态学小节**。在 `## 4.8 本章小结` 之前插入 `## 4.8 形态学操作`（小结顺延 4.9、练习题顺延 4.10），含 ### 子节：4.8.1 膨胀与腐蚀（ClipperOffset + jtRound + 正负 delta，注意 ref Execute 与缩放因子，附代码）；4.8.2 开运算与闭运算（先腐蚀后膨胀 / 先膨胀后腐蚀，附代码 + 效果说明）；4.8.3 形态学梯度（膨胀 ctDifference 腐蚀）；4.8.4 应用场景（小图斑剔除、窄缝弥合、凹口填充，各附简短代码）；注明任意形状结构元素需借助 19 章所述闵可夫斯基方法（cad 系列无对应章，改为说明"圆盘/方形结构元素已覆盖多数场景"）。同步修正小结/练习题中的编号引用。

- [ ] **Step 4: 第06章交叉引用**。在合适的应用案例（若涉及缓冲区/偏移/简化）附近加 1-2 句指向第04章形态学小节的说明（链接格式 `[第四章](https://znlgis.github.io/cad/Clipper1/第04章-多边形偏移操作/)`）。

- [ ] **Step 5: 自查**。重读改动处；代码围栏闭合；Clipper1 API（ref Execute、jtRound、缩放）与参考一致；编号连续。报告改动摘要与自查结果。

### Task 5: 全局验证与提交（编排者执行）

- [ ] **Step 1: 语法检查**。用 ripgrep 全量检查 8 个改动文件：(a) 代码围栏成对（`rg -c '^```'` 各文件为偶数）；(b) 无 C++ 残留（`rg "std::|const auto|cout|#include"` cad/Clipper2/第05章 无匹配）；(c) 无错误公式残留（`rg "MinkowskiDiff.*腐蚀|腐蚀.*MinkowskiDiff"` 全库无匹配）。

- [ ] **Step 2: 小节编号抽查**。对每个改动文件 rg 出 `^#{2,3} ` 行，人工核对编号连续。

- [ ] **Step 3: Jekyll 构建**。尝试 `bundle exec jekyll build`（若本机无 jekyll/ruby 环境，跳过并说明；以 markdown 检查代替）。构建失败则定位到具体文件修复。

- [ ] **Step 4: 提交**。`git status` 确认只有 12 个教程文件 + docs 计划文档被修改；按系列分 4 次提交（sci/Clipper2、sci/Clipper1、cad/Clipper2、cad/Clipper1），提交信息格式 `docs(Clipper2源码解读): 修正闵可夫斯基签名并补齐形态学小节` 等；不 `git add -A`。

---

## 自审结论

- Spec 覆盖：设计文档"各文件改动明细"每条均有对应 Task 步骤；仓库事实同步（第01章信息、三角剖分警告）已入 Task 3/4；API 核对已前置完成并写入 Global Constraints。
- 占位符扫描：无 TBD/TODO；所有插入内容均给出权威参考实现代码。
- 一致性：Clipper2/Clipper1 两套 API 参考分别标注；腐蚀公式全篇统一为补集法；开/闭运算方向统一（开=先腐后胀，闭=先胀后腐）。
