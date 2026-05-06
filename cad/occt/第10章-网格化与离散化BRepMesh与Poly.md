---
layout: default
title: 第10章：网格化与离散化 BRepMesh 与 Poly
---

# 第10章：网格化与离散化 BRepMesh 与 Poly

精确 B-Rep 不能直接显示、3D 打印、有限元仿真。OCCT 通过 `BRepMesh` 把每个面离散为三角网，把每条边离散为折线，存储在 `Poly_Triangulation` 与 `Poly_PolygonOnTriangulation` 中。本章介绍网格化的算法、参数、API 与典型用法。

## 1. 算法概述

`BRepMesh_IncrementalMesh` 是核心入口：
- 遍历所有面，按容差与角度参数生成三角网；
- 在每条边上生成与三角顶点对齐的折线；
- 共享边上的折线在两面间一致，避免显示出现“缝隙”；
- 输出存入 `BRep_TFace::Triangulation`、`BRep_TEdge::Polygon3D` / `PolygonOnTriangulation`。

经典调用：
```cpp
BRepMesh_IncrementalMesh mesh(shape,
    /*Linear=*/0.1,         // 线偏差容差
    /*Relative=*/false,
    /*Angular=*/0.5,        // 弧度角偏差
    /*Parallel=*/true);
mesh.Perform();
```

## 2. 关键参数

- **Linear deflection（弦高/线偏差）**：网格点与精确曲线之间的最大距离。值越小三角形越多。
- **Angular deflection（角偏差）**：相邻网格段法向夹角的最大值（弧度）。控制曲面凸出区域采样密度。
- **Relative**：若为 true，linear 按形体包围盒比例计算（典型 0.001～0.01）。
- **InternalVerticesMode**：是否在面内部生成额外节点（默认 true，有助于细致建模）。
- **ControlSurfaceDeflection**：自适应控制曲面偏差。
- **AdaptiveMin**：限制极小三角形。

`IMeshTools_Parameters`（OCCT 7.4+）以结构体形式集中管理参数：
```cpp
IMeshTools_Parameters p;
p.Deflection = 0.05;
p.Angle = 0.3;
p.InParallel = true;
BRepMesh_IncrementalMesh mesh(shape, p);
```

## 3. 输出结构 `Poly_Triangulation`

每个面持有一份 `Poly_Triangulation`：
- `NbNodes()`、`Node(i)`：顶点（face 局部坐标，需 `TopLoc_Location` 变换）；
- `NbTriangles()`、`Triangle(i)`：三角形索引（1 起始，按面 forward 朝向给出）；
- `UVNode(i)`：UV 参数（可选）；
- `Normal(i)`：法向（OCCT 7.6+ 默认携带）；
- `Tolerance()`、`HasNormals()`、`HasUVNodes()`。

注意三角形朝向需要乘以面的 `Orientation`：当面为 `REVERSED` 时三角形顶点顺序需取反。

## 4. 边折线 `Poly_PolygonOnTriangulation`

每条边在每相邻面上保存一份索引数组，指向 `Poly_Triangulation` 的节点。这样显示边线时直接走相同节点，避免“拼面缝隙”。
```cpp
TopLoc_Location loc;
Handle(Poly_Triangulation) tri = BRep_Tool::Triangulation(face, loc);
Handle(Poly_PolygonOnTriangulation) pol = BRep_Tool::PolygonOnTriangulation(edge, tri, loc);
const TColStd_Array1OfInteger& nodes = pol->Nodes();
```

## 5. 全局折线 `Poly_Polygon3D`

边可单独存储 3D 折线（不依赖三角网），用于线框显示、CAM 路径：
```cpp
Handle(Poly_Polygon3D) pol = BRep_Tool::Polygon3D(edge, loc);
```

## 6. 生成 STL/OBJ 导出

OCCT 自带 `StlAPI`、`RWObj` 直接导出三角网（详见第 12 章），但常需要先 `BRepMesh` 一次：
```cpp
BRepMesh_IncrementalMesh m(shape, 0.1);
StlAPI_Writer w;
w.ASCIIMode() = false;
w.Write(shape, "out.stl");
```

## 7. 自定义遍历（导出到自有引擎）

```cpp
for (TopExp_Explorer ex(shape, TopAbs_FACE); ex.More(); ex.Next()) {
    const TopoDS_Face& f = TopoDS::Face(ex.Current());
    TopLoc_Location loc;
    Handle(Poly_Triangulation) t = BRep_Tool::Triangulation(f, loc);
    if (t.IsNull()) continue;
    const gp_Trsf& tr = loc.Transformation();
    bool reversed = (f.Orientation() == TopAbs_REVERSED);
    for (Standard_Integer i = 1; i <= t->NbTriangles(); ++i) {
        Standard_Integer n1, n2, n3;
        t->Triangle(i).Get(n1, n2, n3);
        if (reversed) std::swap(n2, n3);
        gp_Pnt p1 = t->Node(n1).Transformed(tr);
        gp_Pnt p2 = t->Node(n2).Transformed(tr);
        gp_Pnt p3 = t->Node(n3).Transformed(tr);
        // 写入到自定义网格...
    }
}
```

## 8. 重新网格化与并行

每次修改拓扑后需要重新网格化：`BRepTools::Clean(shape)` 清除旧三角网。`BRepMesh_IncrementalMesh` 默认增量更新，已有面的网格如果参数未变会跳过。

并行：`p.InParallel = true` + 启用 TBB（或内置任务池）能在多面零件上显著加速；并行对单面无效。

## 9. 参数选择经验

- 显示用：linear 0.1 mm + angular 0.5 rad，在毫米单位零件下兼顾视觉与性能；
- 高精度截图：linear 0.01 mm；
- 3D 打印（FDM）：0.05～0.1 mm；
- SLA 高精度：0.01～0.02 mm；
- 仿真前处理：通常配合 SMESH/Netgen，不直接用 BRepMesh。

`Relative` 模式适用于不知道单位的零件。

## 10. `MeshVS` 网格可视化

OCCT 提供 `MeshVS` 工具包，把任意网格（不限于 B-Rep 的三角化）渲染到 AIS：
```cpp
Handle(MeshVS_Mesh) m = new MeshVS_Mesh();
m->SetDataSource(myDataSource);
ctx->Display(m, true);
```

支持节点/面属性着色、伪彩色显示、边显示等，常用于 FEM 后处理与逆向工程数据可视化。

## 11. 与质量属性的关系

`BRepGProp` 默认对精确 B-Rep 计算质量属性，但若仅有网格，可使用 `GProp_GProps`（手工累加）或 `BRepGProp_VinertGK` 的 GK 数值积分版。对粗糙网格，质量属性误差较大，建议保证网格密度。

## 12. 网格修复

OCCT 自带的 `Poly_MakerOfCDT`、`Poly_CoherentTriangulation` 提供网格一致性维护与拓扑修复，但功能有限；专业修复推荐导出 STL 后用 MeshLab/Netfabb 等工具，再导回。

## 13. 常见问题

- **导出 STL 缺面**：未先调用 `BRepMesh_IncrementalMesh`；
- **STL 体积巨大**：deflection 设置过小；
- **法向不正确**：未考虑 `Orientation`；
- **边线显示与三角不对齐**：`Poly_PolygonOnTriangulation` 缺失，调用 `BRepMesh` 而非自定义离散；
- **网格随单位变化**：使用 `Relative=true`。

## 14. 调试

- Draw：`incmesh s 0.1`、`tessellate s`、`triangles s`；
- 用 `BRepMesh_IncrementalMesh::IsModified()` 检查是否触发了重新网格化；
- 异常：`Standard_OutOfRange`/`NumericError` 通常意味着面退化，先做 `ShapeFix`。

完成网格化后，OCCT 的几何 → 拓扑 → 离散 链路就已经齐全。下一章我们抽身到“可视化”，讲 V3d/AIS/Graphic3d 体系。
