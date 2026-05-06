---
layout: default
title: 第06章：建模数据与几何表达 ModelingData
---

# 第06章：建模数据与几何表达 ModelingData

ModelingData 是 OCCT 的“数据层”，把数学几何（`gp`、`Geom`、`Geom2d`）与拓扑（`TopoDS`、`BRep`）整合，并提供 Adaptor、Polygons、容差工具、装配位置等支撑。前两章分别介绍了几何与拓扑，本章把它们组织起来，并补充常被忽视的“配套类”。

## 1. 模块构成

ModelingData 模块包含但不限于：

- `Geom`、`Geom2d`、`GeomConvert`、`GeomLib`、`GeomTools`：抽象几何与转换工具；
- `Geom2dConvert`、`Geom2dGcc`、`GccAna`、`GccInt`：2D 几何工具；
- `GeomAdaptor`、`Geom2dAdaptor`、`Adaptor3d`、`Adaptor2d`：适配层；
- `BRep`、`BRepLProp`、`BRepLib`、`BRepTools`、`BRepCheck`、`BRepBndLib`：B-Rep 的“维护工具”；
- `BRepAdaptor`：把 B-Rep 边/面适配为 Adaptor；
- `BRepGProp`：质量属性（体积、表面积、惯性）；
- `Poly`、`Poly_Triangulation`、`Poly_Polygon3D`、`Poly_PolygonOnTriangulation`：多边形/三角网；
- `TopAbs`、`TopoDS`、`TopExp`、`TopLoc`、`TopTools`：拓扑骨架；
- `IntTools`、`IntCurveSurface`、`IntSurfaces`、`IntPatch`：相交内核；
- `MAT`、`MAT2d`：中轴；
- `ProjLib`：参数空间投影。

## 2. `BRepAdaptor` 与算法接口

绝大多数算法（圆角、布尔、网格化、求交）只接受 `Adaptor3d_Curve` 或 `Adaptor3d_Surface`，因此必须把拓扑边/面转成 Adaptor：

```cpp
BRepAdaptor_Curve curve(edge);          // 自动获取 3D 曲线 + 参数范围
BRepAdaptor_Surface surf(face, true);   // true 表示考虑 Location
BRepAdaptor_Curve2d pcurve(edge, face); // 边在面上的 PCurve
```

`BRepAdaptor_CompCurve` 把多条边组成的 wire 视为一条连续曲线（自动跨边切换）。

## 3. `BRepLProp`/`BRepGProp`：物性

`BRepLProp_SLProps`、`BRepLProp_CLProps` 计算曲面/曲线的局部属性：法向、切矢、主曲率：
```cpp
BRepLProp_SLProps props(BRepAdaptor_Surface(face), u, v, 2, 1e-6);
gp_Vec n = props.Normal();
Standard_Real k1 = props.MaxCurvature();
```

`BRepGProp` 计算质量属性：
```cpp
GProp_GProps g;
BRepGProp::VolumeProperties(shape, g);
double vol = g.Mass();
gp_Pnt cog = g.CentreOfMass();
```

`SurfaceProperties`、`LinearProperties` 类似，分别计算表面积、长度。

## 4. 包围盒 `BRepBndLib`

```cpp
Bnd_Box bb;
BRepBndLib::Add(shape, bb, false); // 第三参不优化精度
BRepBndLib::AddOptimal(shape, bb); // 更紧的包围盒，慢
Bnd_OBB obb;
BRepBndLib::AddOBB(shape, obb);
```

包围盒是空间过滤、视图缩放、求交预筛选的基石。

## 5. 多边形与三角网格 `Poly`

`Poly_Triangulation` 表示一张面上的三角网，存储节点坐标、法向（可选）、UV 参数（可选）、三角形列表。它附着在 `TopoDS_Face` 上，由 `BRepMesh` 生成，`AIS` 可视化使用。

`Poly_Polygon3D`：3D 折线；
`Poly_PolygonOnTriangulation`：边在三角网上的折线索引（保证显示无缝）；
`Poly_Polygon2D`、`Poly_PolygonOnTriangulation` 配合实现“边线落在面三角顶点上”的关系。

读取与遍历：
```cpp
TopLoc_Location loc;
Handle(Poly_Triangulation) tri = BRep_Tool::Triangulation(face, loc);
const gp_Trsf& tr = loc.Transformation();
for (int i = 1; i <= tri->NbNodes(); ++i) {
    gp_Pnt p = tri->Node(i).Transformed(tr);
}
for (int i = 1; i <= tri->NbTriangles(); ++i) {
    Standard_Integer n1, n2, n3;
    tri->Triangle(i).Get(n1, n2, n3);
}
```

## 6. 数据修复 `ShapeAnalysis` / `ShapeFix` / `ShapeUpgrade`

虽然这些工具包归在 ModelingAlgorithms，但常被用于 ModelingData 阶段的“数据清理”：

- `ShapeAnalysis_FreeBounds`：自由边检测；
- `ShapeAnalysis_Wire`：线框自洽性；
- `ShapeFix_Shape`：综合修复；
- `ShapeUpgrade_UnifySameDomain`：合并同曲面相邻面；
- `ShapeBuild_ReShape`：替换 / 重写子拓扑。

## 7. 转换 `GeomConvert` / `Geom2dConvert`

工程实战常需要把不同曲线/曲面统一到 B 样条：

- `GeomConvert::CurveToBSplineCurve(...)`、`SurfaceToBSplineSurface(...)`；
- `GeomConvert::ConcatC1` 把多段曲线拼成 C1 连续 BSpline；
- `GeomConvert_BSplineCurveKnotSplitting` 分裂节点；
- `Geom2dConvert::CurveToBSplineCurve`。

这些转换为 BOP、BRepFill、BRepOffset 等算法提供统一输入。

## 8. 投影 `ProjLib`

`ProjLib_ProjectOnPlane`、`ProjLib_ProjectOnSurface`：把 3D 曲线投影到面或平面，产生 PCurve；
`ProjLib_ProjectedCurve`：自动选择最合适算法；
`ProjLib_PrjResolve` 用于 PCurve 重建。

边的 PCurve 缺失会导致很多算法失败，必要时调用 `BRepLib::BuildCurves3d` 或 `BRepLib::BuildCurve3d`、`ProjLib` 来补齐。

## 9. 求交内核 `IntTools` / `IntPatch`

OCCT 的求交体系层级：

- `IntAna`/`IntAna2d`：解析/解析对象的精确求交；
- `IntPatch`：面-面求交，输出参数空间曲线；
- `IntTools`：拓扑级求交，向 BOP 提供基础（线-面、面-面、边-边、Vertex-Edge、Vertex-Face）；
- `IntCurveSurface`：曲线-曲面；
- `IntCurvesFace`：曲线-面（带参数范围）。

掌握这一层有助于理解 BOP 失败时的根因。

## 10. 中轴 `MAT`

`MAT2d`：2D 区域的中轴变换；
`MAT`：3D 中轴，多用于偏置、复杂特征建模与某些拓扑分析。

## 11. 容差与 `BRepLib`

`BRepLib::SameParameter(shape, tol)`：让边的 3D 曲线和 PCurve 在参数上一致；
`BRepLib::SameRange(edge)`：把两个 PCurve 调整到相同参数范围；
`BRepLib::UpdateTolerances(shape)`：根据子拓扑容差更新父；
`BRepLib::EncodeRegularity(shape)`：标记每条边相邻面之间的连续性（C0/C1/G1/G2），用于网格化与抽壳。

## 12. 表达式与节点装配位置

OCCT 不内置“表达式”，但通过 `gp_Trsf`、`TopLoc_Location` 与 `BRepBuilderAPI_Transform`、`BRepBuilderAPI_GTransform`、`BRepBuilderAPI_Copy` 实现实例化与变换。XCAF（见第 13 章）在 OCAF 文档中以 `XCAFDoc_Location`、`XCAFDoc_ShapeTool` 维护装配树。

## 13. 数据建模建议

- **几何尽量解析**：能用 `Geom_Plane`、`Geom_Cylinder` 描述就不要用 BSpline；后续算法更稳。
- **少用拷贝多用 Location**：装配实例只改 Location 不改 TShape。
- **维护容差**：导入数据后跑 `ShapeFix_Shape`、`BRepCheck_Analyzer`，必要时 `SameParameter`。
- **及时清理**：不再使用的 `Compound` 应清空，避免巨大 BRep 文件。
- **数据模型隔离**：可视化层不要直接修改原始 TShape，必要时 `BRepBuilderAPI_Copy`。

## 14. 常见错误

- **PCurve 丢失** 导致 BOP/网格失败，使用 `BRepLib::BuildCurves3d` 或 `MakeFace` 时显式提供 wire；
- **同向重复边**：自由边检测失败，使用 `ShapeAnalysis_FreeBounds`；
- **容差爆炸**：在导入 STEP 后运行 `ShapeFix_ShapeTolerance` 限制最大值；
- **共享 TShape 误改**：拓扑修改前应 `BRepBuilderAPI_Copy(shape, true /*copyGeom*/)`。

掌握了几何与拓扑的数据层，下一章开始进入 OCCT 的“算法层”——从 `BRepBuilderAPI`/`BRepPrimAPI` 到布尔运算、局部操作和高级建模。
