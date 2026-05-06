---
layout: default
title: 第04章：数学与几何基元 gp Geom GeomAPI
---

# 第04章：数学与几何基元 gp / Geom / GeomAPI

OCCT 把几何分成两层：解析几何（`gp`）描述简单的、参数化封闭的形状；抽象几何（`Geom`、`Geom2d`）抽象任意自由曲线/曲面，并可序列化、可参数化操作；`GeomAPI`、`Geom2dAPI`、`GeomAdaptor` 提供高层算法封装。理解这三层是后续拓扑建模与算法的基础。

## 1. 设计动机

为什么不能用同一组类表达所有几何？因为：

- 解析几何（直线、圆、圆锥曲线、平面、圆柱、球、锥、环面）有显式参数表达，运算高效，序列化紧凑。
- 自由曲线/曲面（B 样条、Bezier、修剪曲面、偏置曲面、组合曲面）需要更通用的表示，无法用少量参数描述。
- B-Rep 与算法层希望统一接口（统一的 `D0/D1/D2`、`Value`、`Parameter` 调用），不希望关心底层是哪种类型。

OCCT 的解决方案：

1. `gp_*` 提供解析对象，按值传递；
2. `Geom_*`/`Geom2d_*` 提供 `Standard_Transient` 派生的抽象基类与具体子类，按 handle 传递；
3. `GeomAdaptor_*` 把任意 `Geom_*` 适配为 `Adaptor3d_Curve`/`Surface`，供算法使用；
4. `GeomAPI_*`、`Geom2dAPI_*` 是常见算法的“一行 API”。

## 2. `gp` 解析几何

主要类型（3D）：
- `gp_Pnt`：点。
- `gp_Vec`、`gp_Dir`：向量与归一化方向。
- `gp_Lin`：无界直线（点 + 方向）。
- `gp_Circ`：圆（坐标系 + 半径）。
- `gp_Elips`、`gp_Hypr`、`gp_Parab`：椭圆、双曲线、抛物线。
- `gp_Pln`：平面。
- `gp_Cylinder`、`gp_Cone`、`gp_Sphere`、`gp_Torus`：二次曲面与环面。
- `gp_Trsf`：刚体变换（旋转、平移、镜像、缩放、复合）。
- `gp_GTrsf`：包含非刚体（剪切、非均匀缩放）。
- `gp_Quaternion`：旋转四元数。

2D 对应有 `gp_Pnt2d`、`gp_Lin2d`、`gp_Circ2d`、`gp_Pln2d` 不存在（平面是 3D 概念），`gp_Ax2d`/`gp_Ax22d` 表示 2D 坐标系。

`gp` 没有“裁剪”的概念，例如 `gp_Lin` 永远是无穷直线，`gp_Circ` 永远是完整圆；要表达半径有限的弧段，需要用 `Geom_TrimmedCurve` 或在拓扑层用 `BRepBuilderAPI_MakeEdge` 指定参数范围。

## 3. `Geom` 抽象 3D 几何

抽象基类：`Geom_Geometry`（变换接口）→ `Geom_Curve`/`Geom_Surface`/`Geom_Point`/`Geom_Vector`。

常见曲线：
- `Geom_Line`、`Geom_Circle`、`Geom_Ellipse`、`Geom_Hyperbola`、`Geom_Parabola`：解析曲线在抽象层的封装。
- `Geom_BezierCurve`：Bezier 曲线，控制点 + 权重。
- `Geom_BSplineCurve`：B 样条曲线，OCCT 中最重要的曲线类型，几乎所有自由曲线最终都会转换或近似为 B 样条。
- `Geom_TrimmedCurve`：把任意曲线限制到一个参数范围。
- `Geom_OffsetCurve`：等距曲线。

常见曲面：
- `Geom_Plane`、`Geom_CylindricalSurface`、`Geom_ConicalSurface`、`Geom_SphericalSurface`、`Geom_ToroidalSurface`：解析曲面。
- `Geom_BezierSurface`、`Geom_BSplineSurface`：自由曲面。
- `Geom_RectangularTrimmedSurface`：矩形参数域裁剪。
- `Geom_OffsetSurface`：偏置曲面。
- `Geom_SurfaceOfRevolution`、`Geom_SurfaceOfLinearExtrusion`：回转面与拉伸面。

通用接口：`D0(u, P)`、`D1(u, P, V1)`、`D2(u, P, V1, V2, ...)`、`Value(u)`、`FirstParameter()`、`LastParameter()`、`IsClosed()`、`Continuity()`、`Transform(gp_Trsf)`、`Reverse()`、`Translated()`。

## 4. `Geom2d` 抽象 2D 几何

`Geom2d_*` 是 `Geom_*` 的 2D 平行体系，主要用于：

- B-Rep 中边在面上的“参数曲线”（PCurve）；
- 二维草图、出图；
- 表面参数空间内的算法。

类型对应：`Geom2d_Curve` 派生的 `Geom2d_Line`、`Geom2d_Circle`、`Geom2d_Ellipse`、`Geom2d_BSplineCurve`、`Geom2d_BezierCurve`、`Geom2d_TrimmedCurve`、`Geom2d_OffsetCurve`。

## 5. `GeomAdaptor` 与 `Adaptor3d`

算法（求交、投影、网格化）需要统一接口而不关心曲线/曲面具体类型。OCCT 提供：

- `Adaptor3d_Curve`、`Adaptor3d_Surface`、`Adaptor2d_Curve2d`：抽象适配接口。
- `GeomAdaptor_Curve`、`GeomAdaptor_Surface`：把 `Geom_Curve`/`Surface` 适配过来。
- `Geom2dAdaptor_Curve`：把 `Geom2d_Curve` 适配为 `Adaptor2d_Curve2d`。
- `BRepAdaptor_Curve`、`BRepAdaptor_Surface`、`BRepAdaptor_Curve2d`：把拓扑边/面提升为 Adaptor。

应用示例：
```cpp
GeomAdaptor_Curve adp(curve);
GCPnts_AbscissaPoint::Length(adp, eps); // 计算长度
GCPnts_UniformAbscissa pts(adp, n);      // 等弧长离散
```

## 6. `GeomAPI` 高层算法

常用 API：
- `GeomAPI_PointsToBSpline`：通过点列拟合 B 样条曲线。
- `GeomAPI_PointsToBSplineSurface`：拟合 B 样条曲面。
- `GeomAPI_Interpolate`：插值多项式 / 样条。
- `GeomAPI_ProjectPointOnCurve`、`GeomAPI_ProjectPointOnSurf`：投影。
- `GeomAPI_ExtremaCurveCurve`、`ExtremaSurfaceSurface`、`ExtremaCurveSurface`：极值/距离计算。
- `GeomAPI_IntCS`、`GeomAPI_IntSS`：曲线-曲面/曲面-曲面相交。
- `GeomAPI`（命名空间函数）：各种构造与转换。

```cpp
TColgp_Array1OfPnt pts(1, n);
// 填充 pts...
GeomAPI_PointsToBSpline fit(pts, 3, 8, GeomAbs_C2, 1e-3);
Handle(Geom_BSplineCurve) bs = fit.Curve();
```

## 7. `Geom2dAPI` 与 2D 工具

类似 3D，常用的有：
- `Geom2dAPI_PointsToBSpline`、`Geom2dAPI_Interpolate`、`Geom2dAPI_ExtremaCurveCurve`、`Geom2dAPI_InterCurveCurve`、`Geom2dAPI_ProjectPointOnCurve`。

加上 `Geom2dGcc`、`GccAna` 等工具包提供圆与直线的几何构造（切线、相切圆等）。

## 8. 参数化、连续性与方向

OCCT 几何对象都有“参数化”：
- `Curve`：一维参数 `u`；
- `Surface`：二维参数 `(u, v)`；
- 参数范围由 `FirstParameter`/`LastParameter`/`UFirst...VLast...` 给出；
- `IsClosed`/`IsPeriodic` 与 `IsUClosed/IsVPeriodic` 决定是否首尾相接、是否循环参数。

连续性 `GeomAbs_Shape`：`C0`、`G1`、`C1`、`G2`、`C2`、`C3`、`CN`。`G` 表示几何连续（切矢方向），`C` 表示参数连续。

方向：曲线/曲面有内禀方向（参数增大方向）；与拓扑方向（`TopAbs_FORWARD/REVERSED`）结合形成 B-Rep 的“朝向”。

## 9. 创建几何对象的常见做法

```cpp
gp_Pnt p1(0,0,0), p2(10,0,0);
Handle(Geom_Line) line = new Geom_Line(p1, gp_Dir(p2.XYZ() - p1.XYZ()));
Handle(Geom_TrimmedCurve) seg = new Geom_TrimmedCurve(line, 0, p1.Distance(p2));

gp_Ax2 ax(gp_Pnt(0,0,0), gp_Dir(0,0,1));
Handle(Geom_Circle) circ = new Geom_Circle(ax, 5.0);

gp_Pln pln(gp_Ax3(gp_Pnt(0,0,0), gp_Dir(0,0,1)));
Handle(Geom_Plane) plane = new Geom_Plane(pln);

TColgp_Array2OfPnt poles(1, 4, 1, 4);
TColStd_Array1OfReal uknots(1, 4), vknots(1, 4);
TColStd_Array1OfInteger umult(1, 4), vmult(1, 4);
// 填充控制点与节点...
Handle(Geom_BSplineSurface) surf =
   new Geom_BSplineSurface(poles, uknots, vknots, umult, vmult, 3, 3);
```

## 10. 与拓扑的桥梁

要把 `Geom_Curve`/`Geom_Surface` 转换为拓扑实体：
- `BRepBuilderAPI_MakeEdge(curve, u1, u2)` 创建带参数范围的边；
- `BRepBuilderAPI_MakeFace(surface, umin, umax, vmin, vmax, tol)` 创建面；
- `BRepBuilderAPI_MakeWire`/`MakeShell`/`MakeSolid` 进一步组合。

反向：`BRep_Tool::Curve(edge)` 取出底层 `Geom_Curve`；`BRep_Tool::Surface(face)` 取出底层 `Geom_Surface`。

## 11. 调试技巧

- Draw 中可以 `mkcurve c1 myedge`、`mksurface s1 myface` 把拓扑底层几何提取为可显示对象。
- 使用 `GeomAPI_ProjectPointOnCurve` 验证算法对参数定位是否正确。
- 使用 `GeomAbs_Shape Curve::Continuity()` 检查曲面/曲线连续性。
- 调试自由曲面可以输出 `Poles()`、`Knots()`、`Multiplicities()` 与 `Degree()` 检查。

掌握 `gp`、`Geom`、`Geom2d`、`GeomAPI` 与 Adaptor 之后，便可以从纯几何过渡到 B-Rep 拓扑结构。下一章我们将进入 `TopoDS` 与 `BRep`。
