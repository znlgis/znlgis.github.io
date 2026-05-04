---
layout: default
title: JTS 中的约束 Delaunay 三角剖分
---

# JTS 中的约束 Delaunay 三角剖分

> 原文：基于 JTS 文档和 Lin.ear th.inking 博客内容
> 作者：Martin Davis
> 日期：约 2014年

## 概述

Delaunay 三角剖分是计算几何中的基础算法，而约束 Delaunay 三角剖分（Constrained Delaunay Triangulation, CDT）允许在三角剖分中强制包含特定的边。JTS 提供了完整的三角剖分支持，本文介绍其原理和使用方法。

## 什么是 Delaunay 三角剖分？

### 基本概念

Delaunay 三角剖分是一种特殊的三角剖分方式，具有以下性质：

1. **空圆性质**：任何三角形的外接圆内不包含其他点
2. **最大化最小角**：在所有可能的三角剖分中，Delaunay 三角剖分最大化了最小角
3. **唯一性**：对于一般位置的点集，Delaunay 三角剖分是唯一的

```
    普通三角剖分          Delaunay 三角剖分
    
    *-------*            *-------*
    |\      |            |  \    |
    | \     |            |   \   |
    |  \    |            |    \  |
    *   \   |     →      *-----\ |
    |    \  |            |      \|
    |     \ |            |       *
    |      \|            |      /
    *-------*            *-----*
    
    （角度较小）           （角度较大）
```

### 为什么 Delaunay 很重要？

- **避免狭长三角形**：产生更"好看"的三角形
- **数值稳定**：在有限元分析中更加稳定
- **与 Voronoi 图对偶**：Delaunay 三角剖分是 Voronoi 图的对偶

## 约束 Delaunay 三角剖分

### 什么是约束？

在某些应用中，我们需要三角剖分包含特定的边（约束边）：

- 多边形的边界
- 道路或河流的中心线
- 地形特征线

```
    无约束               有约束（必须包含AB边）
    
    A -------- B         A -------- B
    | \      / |         |         /|
    |   \  /   |    →    |        / |
    |    \/    |         |       /  |
    |    /\    |         |      /   |
    |   /  \   |         |     /    |
    | /      \ |         |    /     |
    *---------*          *---/------*
```

### JTS 中的实现

```java
import org.locationtech.jts.geom.*;
import org.locationtech.jts.triangulate.polygon.ConstrainedDelaunayTriangulator;

public class CDTExample {
    public static void main(String[] args) {
        GeometryFactory factory = new GeometryFactory();
        
        // 创建一个简单多边形
        Coordinate[] coords = new Coordinate[] {
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(10, 10),
            new Coordinate(0, 10),
            new Coordinate(0, 0)
        };
        
        Polygon polygon = factory.createPolygon(coords);
        
        // 执行约束 Delaunay 三角剖分
        Geometry triangulation = ConstrainedDelaunayTriangulator.triangulate(polygon);
        
        System.out.println("三角剖分结果：");
        System.out.println(triangulation);
    }
}
```

## 三角剖分多边形

### 简单多边形三角剖分

```java
import org.locationtech.jts.triangulate.polygon.PolygonTriangulator;

public class PolygonTriangulationExample {
    public static Geometry triangulatePolygon(Polygon polygon) {
        return PolygonTriangulator.triangulate(polygon);
    }
    
    public static void main(String[] args) {
        GeometryFactory factory = new GeometryFactory();
        WKTReader reader = new WKTReader(factory);
        
        // 创建一个L形多边形
        Polygon lShape = (Polygon) reader.read(
            "POLYGON ((0 0, 10 0, 10 5, 5 5, 5 10, 0 10, 0 0))");
        
        Geometry triangles = triangulatePolygon(lShape);
        
        // 输出三角形数量
        System.out.println("三角形数量: " + triangles.getNumGeometries());
        
        // 输出每个三角形
        for (int i = 0; i < triangles.getNumGeometries(); i++) {
            System.out.println("三角形 " + (i+1) + ": " + triangles.getGeometryN(i));
        }
    }
}
```

### 带孔洞的多边形

```java
public class PolygonWithHoleTriangulation {
    public static void main(String[] args) throws Exception {
        GeometryFactory factory = new GeometryFactory();
        WKTReader reader = new WKTReader(factory);
        
        // 带孔洞的多边形
        Polygon polygonWithHole = (Polygon) reader.read(
            "POLYGON ((0 0, 20 0, 20 20, 0 20, 0 0), " +
            "(5 5, 15 5, 15 15, 5 15, 5 5))");
        
        Geometry triangles = ConstrainedDelaunayTriangulator.triangulate(polygonWithHole);
        
        System.out.println("三角形数量: " + triangles.getNumGeometries());
        
        // 验证：所有三角形的并集应该等于原多边形
        Geometry union = triangles.union();
        System.out.println("并集面积: " + union.getArea());
        System.out.println("原多边形面积: " + polygonWithHole.getArea());
    }
}
```

## Voronoi 图

### Voronoi 图与 Delaunay 的关系

Voronoi 图是 Delaunay 三角剖分的对偶：

```
    Delaunay 三角剖分           Voronoi 图
    
         *                    +---+---+
        /|\                   |   |   |
       / | \                  |   +   |
      /  |  \                 +---+---+
     *---+---*                |   |   |
      \  |  /                 |   +   |
       \ | /                  +---+---+
         *
    
    三角形顶点  ↔  Voronoi 单元
    三角形边    ↔  Voronoi 边
```

### JTS 中的 Voronoi 图

```java
import org.locationtech.jts.triangulate.VoronoiDiagramBuilder;

public class VoronoiExample {
    public static void main(String[] args) {
        GeometryFactory factory = new GeometryFactory();
        
        // 创建点集
        Coordinate[] points = new Coordinate[] {
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(5, 10),
            new Coordinate(2, 5),
            new Coordinate(8, 5)
        };
        
        MultiPoint multiPoint = factory.createMultiPointFromCoords(points);
        
        // 创建 Voronoi 图
        VoronoiDiagramBuilder builder = new VoronoiDiagramBuilder();
        builder.setSites(multiPoint);
        
        Geometry voronoi = builder.getDiagram(factory);
        
        System.out.println("Voronoi 图：");
        System.out.println(voronoi);
    }
}
```

## 应用场景

### 1. 有限元网格生成

三角剖分是有限元分析的基础：

```java
public class FEMMeshGenerator {
    /**
     * 生成有限元网格
     */
    public static Geometry generateMesh(Polygon domain, double maxTriangleArea) {
        // 使用约束 Delaunay 三角剖分
        Geometry mesh = ConstrainedDelaunayTriangulator.triangulate(domain);
        
        // 可以进一步细化网格
        // 直到所有三角形面积小于 maxTriangleArea
        
        return mesh;
    }
}
```

### 2. 地形建模

从高程点创建 TIN（不规则三角网）：

```java
public class TINBuilder {
    /**
     * 从高程点构建 TIN
     */
    public static Geometry buildTIN(List<Coordinate> elevationPoints) {
        GeometryFactory factory = new GeometryFactory();
        
        CoordinateList coords = new CoordinateList();
        for (Coordinate c : elevationPoints) {
            coords.add(c);
        }
        
        DelaunayTriangulationBuilder builder = new DelaunayTriangulationBuilder();
        builder.setSites(coords);
        
        return builder.getTriangles(factory);
    }
}
```

### 3. 最近邻搜索

利用 Voronoi 图进行最近邻查询：

```java
public class NearestNeighborSearch {
    private GeometryCollection voronoiCells;
    private List<Point> originalPoints;
    
    /**
     * 使用 Voronoi 图找最近邻
     */
    public Point findNearest(Point query) {
        for (int i = 0; i < voronoiCells.getNumGeometries(); i++) {
            Geometry cell = voronoiCells.getGeometryN(i);
            if (cell.contains(query)) {
                return originalPoints.get(i);
            }
        }
        return null;
    }
}
```

## 性能考虑

### 时间复杂度

| 操作 | 时间复杂度 |
|------|-----------|
| Delaunay 三角剖分（增量） | O(n log n) |
| Delaunay 三角剖分（分治） | O(n log n) |
| Voronoi 图 | O(n log n) |
| 简单多边形三角剖分 | O(n log n) |

### 内存使用

三角剖分的空间复杂度为 O(n)，其中 n 是输入点的数量。

## 总结

JTS 提供了完整的三角剖分功能：

1. **Delaunay 三角剖分**：从点集生成最优三角剖分
2. **约束 Delaunay 三角剖分**：支持强制边
3. **多边形三角剖分**：将多边形分解为三角形
4. **Voronoi 图**：Delaunay 的对偶结构

这些功能在地形建模、有限元分析、空间索引等领域有广泛应用。

## 参考资料

- [JTS ConstrainedDelaunayTriangulator API](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/triangulate/polygon/ConstrainedDelaunayTriangulator.html)
- [JTS VoronoiDiagramBuilder API](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/triangulate/VoronoiDiagramBuilder.html)
- [Delaunay 三角剖分 - Wikipedia](https://en.wikipedia.org/wiki/Delaunay_triangulation)
- [约束 Delaunay 三角剖分 - Wikipedia](https://en.wikipedia.org/wiki/Constrained_Delaunay_triangulation)
