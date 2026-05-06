---
layout: default
title: 第05章：拓扑数据结构 TopoDS 与 BRep
---

# 第05章：拓扑数据结构 TopoDS 与 BRep

OCCT 采用边界表示（B-Rep）描述实体几何。`TopoDS` 提供拓扑骨架（顶点、边、面、壳、实体的层级与方向），`BRep` 把几何信息（曲线、曲面、参数范围、容差、定位）填充进拓扑骨架。本章梳理这两个工具包的设计、内部结构与典型操作。

## 1. 拓扑层级

OCCT 的 B-Rep 由 7 种实体构成（`TopAbs_ShapeEnum`）：

- `VERTEX`（顶点）
- `EDGE`（边）
- `WIRE`（线框：边的有序集合）
- `FACE`（面）
- `SHELL`（壳：面的集合）
- `SOLID`（实体：壳的集合，闭合）
- `COMPSOLID`（复合实体）
- `COMPOUND`（复合体：任意混合）

层级关系自上而下：`COMPOUND ⊇ COMPSOLID ⊇ SOLID ⊇ SHELL ⊇ FACE ⊇ WIRE ⊇ EDGE ⊇ VERTEX`。每一级是上一级的“构件 + 朝向”。

## 2. `TopoDS_Shape`

`TopoDS_Shape` 是所有拓扑对象的“句柄”，本质上是一个值类型，内部含三个字段：
- `TopoDS_TShape`（共享的底层数据，由具体派生类如 `BRep_TFace` 提供）；
- `TopLoc_Location`（局部坐标系，用于装配中复用同一几何）；
- `TopAbs_Orientation`（朝向：`FORWARD`、`REVERSED`、`INTERNAL`、`EXTERNAL`）。

也就是说：**两个 `TopoDS_Shape` 可以共享同一个 `TShape`，但有不同的位置或朝向**。这正是 OCCT 装配体节省内存的关键。

具体派生：
- `TopoDS_Vertex`、`TopoDS_Edge`、`TopoDS_Wire`、`TopoDS_Face`、`TopoDS_Shell`、`TopoDS_Solid`、`TopoDS_CompSolid`、`TopoDS_Compound`。

它们都不是新结构，只是通过类型校验把 `TopoDS_Shape` 包装一下。`TopoDS::Vertex(shape)` 等静态方法用于强制转换。

## 3. 朝向 `TopAbs_Orientation`

朝向描述拓扑对象在父对象中的“走向”：

- 对边而言，FORWARD 表示沿曲线参数增大方向；REVERSED 反向；
- 对面而言，FORWARD 表示曲面参数化的法向；REVERSED 表示翻面；
- INTERNAL/EXTERNAL：用于无穷面、辅助构造、内部边。

朝向取反：`TopAbs::Reverse(orient)`；面 `Reversed()` 创建翻面副本。在拓扑算法（布尔、修剪）中，正确的朝向决定结果实体的“内外”。

## 4. 子层遍历：`TopExp` 与 `TopExp_Explorer`

最常用的遍历器：

```cpp
for (TopExp_Explorer exp(shape, TopAbs_FACE); exp.More(); exp.Next()) {
    const TopoDS_Face& f = TopoDS::Face(exp.Current());
}
```

`TopExp_Explorer` 第三个参数可以指定排除哪种父类型（避免重复）。

按映射遍历：
```cpp
TopTools_IndexedMapOfShape vmap, emap, fmap;
TopExp::MapShapes(shape, TopAbs_VERTEX, vmap);
TopExp::MapShapes(shape, TopAbs_EDGE, emap);
TopExp::MapShapes(shape, TopAbs_FACE, fmap);
```

边-面、顶点-边的反向关系可用 `TopTools_IndexedDataMapOfShapeListOfShape`：
```cpp
TopTools_IndexedDataMapOfShapeListOfShape edge2face;
TopExp::MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge2face);
```

这是写算法时识别共享边、相邻面、孤立顶点的标准手段。

## 5. `BRep` 的几何附着

拓扑骨架本身没有几何，附着信息由 `BRep` 提供：

- `BRep_TVertex`：顶点坐标 + 容差；
- `BRep_TEdge`：曲线列表（每个曲线表达可以是 3D `Geom_Curve`、面上的 PCurve、`Geom_Polygon3D`、`Poly_PolygonOnTriangulation` 等）+ 参数范围 + 容差；
- `BRep_TFace`：曲面 `Geom_Surface` + 容差 + 自然面边界 + 三角网格 `Poly_Triangulation`。

边可以同时拥有：
- 一个 3D 曲线；
- 多个面上的 2D PCurve（每张相邻面一条）；
- 多个三角化下的折线（与 `Poly_Triangulation` 配合）。

这种“多重表达”使 OCCT 能处理共享边、面间一致性、网格化与显示等多种需求。

## 6. 工具类 `BRep_Tool`

`BRep_Tool` 是只读访问器：

```cpp
gp_Pnt p = BRep_Tool::Pnt(vertex);
double tol = BRep_Tool::Tolerance(vertex);

double f, l;
Handle(Geom_Curve) c = BRep_Tool::Curve(edge, f, l);
Handle(Geom2d_Curve) pc = BRep_Tool::CurveOnSurface(edge, face, f, l);

Handle(Geom_Surface) s = BRep_Tool::Surface(face);
Handle(Poly_Triangulation) tri = BRep_Tool::Triangulation(face, location);
```

写入对应使用 `BRep_Builder`（少用，通常通过更高层 BuilderAPI）。

## 7. 容差体系

OCCT 是有限精度浮点系统，每个顶点/边/面都有一个 `tolerance`，表示该几何元素与名义几何的最大偏差。算法（求交、缝合、布尔）需要在容差范围内一致：

- 顶点容差通常 ≤ 边容差 ≤ 面容差；
- `BRepCheck_Analyzer` 检查容差与拓扑一致性；
- `ShapeFix_ShapeTolerance` 调整容差；
- `BRepLib::SameRange`、`BRepLib::SameParameter` 修正参数一致性。

容差太小会导致布尔失败，太大会影响后续精度，建议保持在导入数据自然容差（如 1e-6 mm）附近。

## 8. 位置 `TopLoc_Location`

`TopLoc_Location` 是“变换矩阵的累乘”，可链式组合，避免每次拷贝几何：

```cpp
gp_Trsf t; t.SetTranslation(gp_Vec(10,0,0));
TopLoc_Location loc(t);
TopoDS_Shape moved = shape.Located(loc);
```

`Located(loc)` 返回新的 `TopoDS_Shape`（仍共享 TShape），`Move(loc)` 累乘当前位置。装配中常对同一零件 TShape 设置不同 Location 实现实例化。

## 9. 朝向、位置、TShape 与等价性

判断两个 `TopoDS_Shape` 是否“相同”：
- `IsSame(other)`：忽略朝向，但必须 TShape 与 Location 相同；
- `IsEqual(other)`：朝向也必须相同；
- `IsPartner(other)`：仅 TShape 相同，位置/朝向可不同（用于装配）；

哈希：`TopoDS_Shape::HashCode(seed)`，与 `IsSame` 一致，可以放进 `TopTools_MapOfShape`。

## 10. 构造拓扑：从下到上

通常的构造顺序：

1. `BRepBuilderAPI_MakeVertex(p)` 创建顶点；
2. `BRepBuilderAPI_MakeEdge(curve, v1, v2, u1, u2)` 创建边；
3. `BRepBuilderAPI_MakeWire` 把多条边按头尾顺序串成线框；
4. `BRepBuilderAPI_MakeFace(surface, wire)` 用线框裁剪面；
5. `BRepBuilderAPI_MakeShell` 把面拼成壳；
6. `BRepBuilderAPI_MakeSolid` 把闭合壳变实体；
7. `TopoDS_Compound` + `BRep_Builder::Add` 任意组合。

具体 API 见下章。

## 11. 拓扑遍历的高级模式

- **按面分组取边**：用 `MapShapesAndAncestors` 得到 `edge → list<face>`，过滤共享边/边界边；
- **去重**：使用 `TopTools_IndexedMapOfShape` 自带的去重；
- **按方向访问**：循环线框边时使用 `BRepTools_WireExplorer` 保证拓扑顺序；
- **递归处理 Compound**：`COMPOUND` 内部可能嵌套 `COMPOUND`，遍历时记得使用 `TopExp_Explorer(shape, TopAbs_SOLID)` 直接得到底层。

## 12. 常用辅助类

- `BRepTools`：保存/加载 `.brep` 文件、`Read`、`Write`、`UVBounds`、`OuterWire`；
- `BRepTools_Modifier`：以模板方式重建拓扑（替换面/曲面/位置）；
- `BRepLib`：参数一致化、采样曲线、构造法向；
- `BRepCheck_Analyzer`：拓扑/几何一致性检查；
- `ShapeAnalysis_*`：多种检查器（自由边、退化、参数一致性）；
- `ShapeBuild_ReShape`：批量替换子拓扑。

## 13. 文件持久化

OCCT 有自有的 `.brep` 文本格式：
```cpp
BRepTools::Write(shape, "out.brep");
TopoDS_Shape s;
BRep_Builder b;
BRepTools::Read(s, "in.brep", b);
```

它保存了拓扑、几何与容差，可作为算法调试与回归测试的“黄金数据”。

## 14. 调试技巧

- Draw：`explode s F`、`explode s E`、`explode s V` 拆分；`whatis s` 查看类型与子数；`tolerance s` 查看容差。
- C++：`BRepCheck_Analyzer ana(shape, true); ana.IsValid()`；
- Visualization：用 `tools/ShapeView` 可视化拓扑树；
- 输出 `BRepTools::Dump(shape, std::cout)` 查看树结构。

## 15. 小结

`TopoDS` + `BRep` 构成 OCCT 的“骨架 + 血肉”：骨架描述拓扑层级与朝向，血肉提供几何与容差。理解共享 TShape、Location、Orientation 三件套与多重几何附着，是阅读 OCCT 源码与实现自定义算法的基础。下一章我们把视角拉远，看看 ModelingData 模块如何组织几何与拓扑数据。
