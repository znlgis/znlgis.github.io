---
layout: default
title: 第07章：建模算法概览 BRepBuilderAPI 与 BRepPrimAPI
---

# 第07章：建模算法概览 BRepBuilderAPI 与 BRepPrimAPI

ModelingAlgorithms 是 OCCT 体量最大、最常被直接调用的模块。它分为两个层次：底层算法（拓扑构造、布尔运算、局部操作、放样、扫掠等）与高层 API（`BRepBuilderAPI_Make*`、`BRepPrimAPI_Make*`、`BRepAlgoAPI_*`、`BRepOffsetAPI_*`、`BRepFilletAPI_*`）。本章先梳理“构造类”的两个核心：`BRepBuilderAPI` 与 `BRepPrimAPI`。

## 1. 设计模式：Make + IsDone + Shape

OCCT 中所有建模 API 都遵循相同模式：

```cpp
BRepXxxAPI_MakeYyy maker(args...);
maker.Build();                    // 多数情况下构造时已自动调用
if (!maker.IsDone()) { ... }      // 检查是否成功
TopoDS_Shape result = maker.Shape();
```

部分类继承自 `BRepBuilderAPI_MakeShape`，可以隐式转换为 `TopoDS_Shape`：
```cpp
TopoDS_Shape b = BRepPrimAPI_MakeBox(10, 20, 30);
```

注意：`Shape()` 返回的是“一个临时引用”，最好赋值出来再使用，避免算法对象析构后底层数据失效。

## 2. `BRepBuilderAPI_Make*` 拓扑构造

| API | 输入 | 输出 |
| --- | --- | --- |
| `MakeVertex` | `gp_Pnt` | `TopoDS_Vertex` |
| `MakeEdge` | 两点 / 曲线 + 参数 / 曲线 + 顶点 | `TopoDS_Edge` |
| `MakeEdge2d` | `Geom2d_Curve` | 2D 边（用于在面上构造） |
| `MakePolygon` | 一组点 | `TopoDS_Wire`（折线） |
| `MakeWire` | 多条边 / 多个 wire | `TopoDS_Wire` |
| `MakeFace` | 平面 / 曲面 + wire / 已有 face + 内孔 | `TopoDS_Face` |
| `MakeShell` | 一组面 | `TopoDS_Shell` |
| `MakeSolid` | shell（必须闭合） | `TopoDS_Solid` |
| `MakeCompound` | 任意 shape | `TopoDS_Compound`（其实更常用 `BRep_Builder::MakeCompound`） |

构造点-边-线-面-壳-体的典型流程：
```cpp
TopoDS_Vertex v1 = BRepBuilderAPI_MakeVertex(gp_Pnt(0,0,0));
TopoDS_Vertex v2 = BRepBuilderAPI_MakeVertex(gp_Pnt(10,0,0));
TopoDS_Edge e1 = BRepBuilderAPI_MakeEdge(v1, v2);
// ... 构造其它边
BRepBuilderAPI_MakeWire mw;
mw.Add(e1); mw.Add(e2); mw.Add(e3); mw.Add(e4);
TopoDS_Wire w = mw.Wire();
TopoDS_Face f = BRepBuilderAPI_MakeFace(gp_Pln(...), w);
```

## 3. 变换与拷贝

- `BRepBuilderAPI_Transform(shape, gp_Trsf, copyGeom)`：刚体变换；`copyGeom=true` 拷贝底层几何；
- `BRepBuilderAPI_GTransform(shape, gp_GTrsf)`：包含非均匀缩放等；
- `BRepBuilderAPI_Copy(shape, copyGeom, copyMesh)`：深拷贝；
- `BRepBuilderAPI_NurbsConvert(shape)`：把所有几何转换为 NURBS；
- `BRepBuilderAPI_Sewing`：把多个面缝合成壳。

```cpp
gp_Trsf t; t.SetTranslation(gp_Vec(50, 0, 0));
TopoDS_Shape moved = BRepBuilderAPI_Transform(box, t, true);
```

## 4. `BRepPrimAPI_Make*` 基本体

`BRepPrimAPI_*` 提供解析体的构造：

- `MakeBox(dx, dy, dz)` 或 `MakeBox(p1, p2)`；
- `MakeSphere(r)` 或 `MakeSphere(p, r)`；
- `MakeCylinder(r, h)` 或 `MakeCylinder(ax2, r, h, angle)`；
- `MakeCone(r1, r2, h)`；
- `MakeTorus(R, r)` 或 `MakeTorus(ax2, R, r, angle1, angle2, angle)`；
- `MakeWedge(...)`；
- `MakeRevol(profile, axis, angle, copy)`：旋转生成；
- `MakePrism(profile, vec, copy, canonize)`：拉伸生成；
- `MakeHalfSpace(face/shell, refPnt)`：半空间，用于布尔减法切割；
- `MakeRevolution(curve)`：仅由曲线生成回转曲面（更底层）。

示例：
```cpp
TopoDS_Shape cyl = BRepPrimAPI_MakeCylinder(
    gp_Ax2(gp_Pnt(0,0,0), gp_Dir(0,0,1)), 5.0, 20.0);
TopoDS_Shape rev = BRepPrimAPI_MakeRevol(profileWire, gp_Ax1(gp_Pnt(0,0,0), gp_Dir(0,0,1)));
TopoDS_Shape ext = BRepPrimAPI_MakePrism(profileFace, gp_Vec(0, 0, 50));
```

注意：`MakePrism(face, vec)` 返回 `TopoDS_Solid`（如果 face 是闭合面），`MakePrism(wire, vec)` 返回 `TopoDS_Shell`。

## 5. 隐藏的细节

### 5.1 Wire 顺序与朝向

`BRepBuilderAPI_MakeWire` 会尝试按拓扑相连顺序排列边，并自动调整 reverse；但如果输入边方向不一致，可能会失败。建议用 `BRepBuilderAPI_MakePolygon` 构造已知顺序的折线。

### 5.2 Face 的 outer wire 与孔

```cpp
BRepBuilderAPI_MakeFace mf(plane, outerWire);
mf.Add(holeWire1);
mf.Add(holeWire2);
TopoDS_Face f = mf.Face();
```

孔 wire 的方向必须与外环相反，否则修剪结果异常。可以用 `BRepBuilderAPI_MakeFace(plane, w, true)` 的 `restricted` 参数让 OCCT 自动选择朝向。

### 5.3 Shell→Solid 闭合性

`BRepBuilderAPI_MakeSolid(shell)` 仅当 shell 闭合时才有效。`BRepCheck_Analyzer` 可检查；`BRepBuilderAPI_Sewing` 可以在缝合时合并自由边。

### 5.4 Modified / Generated / IsDeleted

`BRepBuilderAPI_MakeShape` 提供算法溯源接口：

- `Modified(shape)`：被算法替换为其它 shape 的列表（典型情况：原边被布尔切割成多段）；
- `Generated(shape)`：由该 shape 衍生出的新拓扑（圆角生成的圆角面）；
- `IsDeleted(shape)`：被删除。

这些接口在维护“面归属”、“特征追踪”、“持久命名”时非常关键。

## 6. 装配 Compound

`Compound` 可以容纳任意拓扑：
```cpp
BRep_Builder b;
TopoDS_Compound c;
b.MakeCompound(c);
b.Add(c, shape1);
b.Add(c, shape2);
```

`BRepBuilderAPI_MakeCompSolid` 可以构造 `CompSolid`（由共享面的实体集合，常用于多腔体）。

## 7. 实战：构造一个法兰盘

```cpp
// 主体：圆柱
gp_Ax2 ax(gp_Pnt(0,0,0), gp_Dir(0,0,1));
TopoDS_Shape body = BRepPrimAPI_MakeCylinder(ax, 60, 20).Shape();

// 中间通孔
TopoDS_Shape hole = BRepPrimAPI_MakeCylinder(ax, 20, 25).Shape();

// 多个螺栓孔通过旋转复制
TopoDS_Compound bolts;
BRep_Builder bb;
bb.MakeCompound(bolts);
for (int i = 0; i < 6; ++i) {
    gp_Ax2 axb(
        gp_Pnt(40 * std::cos(i * M_PI / 3.0), 40 * std::sin(i * M_PI / 3.0), -1),
        gp_Dir(0, 0, 1));
    bb.Add(bolts, BRepPrimAPI_MakeCylinder(axb, 5, 22).Shape());
}

// 布尔运算（详见下章）：body - hole - bolts
```

## 8. 调试技巧

- 使用 Draw：`box b 10 20 30`、`pcylinder c 5 20`、`prism p w 0 0 50`；
- 出现 `IsDone()=false` 时检查输入：参数顺序、wire 是否闭合、面是否退化；
- 容差不一致：`BRepBuilderAPI_MakeWire` 中两条边端点距离 > 容差会失败；
- 自由边可视化：`BRepCheck_Analyzer ana(s); ana.Result(...)`；
- 复杂 wire 可用 `BRepBuilderAPI_MakePolygon` + `Closed()` 简化。

掌握 BuilderAPI 与 PrimAPI 后，你已经能造出大部分零件的“雏形”。下一章我们进入 CAD 内核最受关注的话题：布尔运算与高级建模。
