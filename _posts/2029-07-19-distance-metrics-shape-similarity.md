---
layout: post
title: "JTS 中的距离度量与形状相似性"
date: 2029-07-19 10:00:00 +0800
categories: [GIS, JTS]
tags: [JTS]
---

# JTS 中的距离度量与形状相似性

> 原文：基于 Lin.ear th.inking 博客和 JTS 技术文档
> 作者：Martin Davis
> 日期：约 2016年

## 概述

在空间分析中，测量几何图形之间的距离和相似性是常见需求。JTS 提供了多种距离度量方法，从简单的点到点距离到复杂的 Hausdorff 距离。本文介绍这些方法的原理和应用。

## 基本距离度量

### 点到点距离

最简单的距离度量是两点之间的欧几里得距离：

```java
import org.locationtech.jts.geom.*;

public class BasicDistance {
    public static double pointDistance(Point p1, Point p2) {
        return p1.distance(p2);
    }
    
    public static void main(String[] args) {
        GeometryFactory factory = new GeometryFactory();
        
        Point p1 = factory.createPoint(new Coordinate(0, 0));
        Point p2 = factory.createPoint(new Coordinate(3, 4));
        
        double distance = p1.distance(p2);
        System.out.println("距离: " + distance);  // 输出: 5.0
    }
}
```

### 几何图形之间的最近距离

`distance()` 方法计算任意两个几何图形之间的最短距离：

```java
public class GeometryDistance {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        // 创建两个多边形
        Geometry polygon1 = reader.read(
            "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
        Geometry polygon2 = reader.read(
            "POLYGON ((15 0, 25 0, 25 10, 15 10, 15 0))");
        
        // 计算最短距离
        double distance = polygon1.distance(polygon2);
        System.out.println("最短距离: " + distance);  // 输出: 5.0
    }
}
```

### 带有最近点的距离计算

有时我们不仅需要距离值，还需要知道最近的点对：

```java
import org.locationtech.jts.operation.distance.DistanceOp;

public class DistanceWithPoints {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        Geometry g1 = reader.read("LINESTRING (0 0, 10 10)");
        Geometry g2 = reader.read("LINESTRING (10 0, 0 10)");
        
        DistanceOp distOp = new DistanceOp(g1, g2);
        
        // 获取距离
        double distance = distOp.distance();
        System.out.println("距离: " + distance);
        
        // 获取最近点对
        Coordinate[] nearestPoints = distOp.nearestPoints();
        System.out.println("g1 上的最近点: " + nearestPoints[0]);
        System.out.println("g2 上的最近点: " + nearestPoints[1]);
    }
}
```

## Hausdorff 距离

### 什么是 Hausdorff 距离？

Hausdorff 距离衡量两个点集之间的"最大最小距离"：

$$d_H(A, B) = \max\left(\sup_{a \in A} \inf_{b \in B} d(a, b), \sup_{b \in B} \inf_{a \in A} d(a, b)\right)$$

简单地说：找出 A 中离 B 最远的点到 B 的距离，以及 B 中离 A 最远的点到 A 的距离，取两者的最大值。

```
    A 的点                  B 的点
    
    *  *  *                 o  o  o
       *  *                 o  o
       *                    o
    
    Hausdorff 距离 = max(A到B的最远最近距离, B到A的最远最近距离)
```

### JTS 中的 Hausdorff 距离

```java
import org.locationtech.jts.algorithm.distance.DiscreteHausdorffDistance;

public class HausdorffDistanceExample {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        // 两条相似但不完全相同的线
        Geometry line1 = reader.read("LINESTRING (0 0, 10 0, 10 10)");
        Geometry line2 = reader.read("LINESTRING (0 0, 10 0, 10 12)");
        
        // 计算 Hausdorff 距离
        double hausdorff = DiscreteHausdorffDistance.distance(line1, line2);
        System.out.println("Hausdorff 距离: " + hausdorff);  // 输出: 2.0
    }
}
```

### 密度因子

对于复杂几何图形，可以通过增加采样密度来提高精度：

```java
public class DenseHausdorff {
    public static double computeHausdorff(Geometry g1, Geometry g2, double densifyFrac) {
        DiscreteHausdorffDistance hd = new DiscreteHausdorffDistance(g1, g2);
        hd.setDensifyFraction(densifyFrac);  // 0.25 表示每条边再细分
        return hd.distance();
    }
}
```

### Hausdorff 距离的应用

1. **形状匹配**：比较两个形状的相似程度
2. **轨迹比较**：评估两条路径的相似性
3. **地图泛化评估**：评估简化后的地图与原始地图的差异

## 形状相似性

### 基于 Hausdorff 的相似性

```java
public class ShapeSimilarity {
    /**
     * 计算形状相似度 (0-1)
     * 1 表示完全相同，0 表示非常不同
     */
    public static double similarity(Geometry g1, Geometry g2) {
        double hausdorff = DiscreteHausdorffDistance.distance(g1, g2);
        
        // 归一化：使用两个几何图形的最大尺寸
        double maxSize = Math.max(
            g1.getEnvelopeInternal().getDiameter(),
            g2.getEnvelopeInternal().getDiameter()
        );
        
        if (maxSize == 0) return 1.0;  // 两个点
        
        // 转换为相似度
        return Math.max(0, 1 - hausdorff / maxSize);
    }
}
```

### 面积比较

对于多边形，可以使用面积进行比较：

```java
public class AreaBasedSimilarity {
    /**
     * 基于交集/并集比率的相似度 (Jaccard 指数)
     */
    public static double jaccard(Geometry g1, Geometry g2) {
        Geometry intersection = g1.intersection(g2);
        Geometry union = g1.union(g2);
        
        double intersectionArea = intersection.getArea();
        double unionArea = union.getArea();
        
        if (unionArea == 0) return 1.0;
        
        return intersectionArea / unionArea;
    }
    
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        Geometry poly1 = reader.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
        Geometry poly2 = reader.read("POLYGON ((2 2, 12 2, 12 12, 2 12, 2 2))");
        
        double similarity = jaccard(poly1, poly2);
        System.out.println("Jaccard 相似度: " + similarity);
    }
}
```

## Fréchet 距离（概念）

### 什么是 Fréchet 距离？

Fréchet 距离常被形象地描述为"遛狗距离"：

想象一个人沿着一条路径走，他的狗沿着另一条路径走。他们都不能后退，只能向前走或停下。Fréchet 距离是所需的最短狗绳长度。

```
    人的路径: -------->
    狗的路径: ---->----->
    
    Fréchet 距离 = 不回头情况下所需的最短绳子长度
```

### Fréchet vs Hausdorff

| 特性 | Hausdorff | Fréchet |
|-----|-----------|---------|
| 考虑顺序 | 否 | 是 |
| 计算复杂度 | O(n²) | O(n² log n) |
| 适用场景 | 形状比较 | 轨迹/路径比较 |

**注意**：JTS 核心库目前不包含 Fréchet 距离的实现，但可以通过第三方库或自定义实现来使用。

## 缓冲区距离

### 使用缓冲区进行距离分析

```java
public class BufferDistanceAnalysis {
    /**
     * 检查几何图形是否在指定距离内
     */
    public static boolean isWithinDistance(Geometry g1, Geometry g2, double distance) {
        return g1.isWithinDistance(g2, distance);
    }
    
    /**
     * 找出在指定距离内的所有几何图形
     */
    public static List<Geometry> findNearby(
            Geometry target, 
            List<Geometry> candidates, 
            double maxDistance) {
        
        List<Geometry> result = new ArrayList<>();
        
        // 创建搜索区域
        Geometry searchArea = target.buffer(maxDistance);
        
        for (Geometry candidate : candidates) {
            if (searchArea.intersects(candidate)) {
                // 进一步验证精确距离
                if (target.distance(candidate) <= maxDistance) {
                    result.add(candidate);
                }
            }
        }
        
        return result;
    }
}
```

## 应用示例

### 轨迹相似性分析

```java
public class TrajectoryAnalysis {
    /**
     * 比较两条 GPS 轨迹的相似性
     */
    public static Map<String, Double> compareTrajectories(
            LineString track1, 
            LineString track2) {
        
        Map<String, Double> metrics = new HashMap<>();
        
        // 1. Hausdorff 距离
        double hausdorff = DiscreteHausdorffDistance.distance(track1, track2);
        metrics.put("hausdorff", hausdorff);
        
        // 2. 平均距离
        double avgDistance = computeAverageDistance(track1, track2);
        metrics.put("averageDistance", avgDistance);
        
        // 3. 长度差异
        double lengthDiff = Math.abs(track1.getLength() - track2.getLength());
        metrics.put("lengthDifference", lengthDiff);
        
        return metrics;
    }
    
    private static double computeAverageDistance(LineString l1, LineString l2) {
        double totalDist = 0;
        int count = 0;
        
        for (Coordinate c : l1.getCoordinates()) {
            Point p = l1.getFactory().createPoint(c);
            totalDist += p.distance(l2);
            count++;
        }
        
        return totalDist / count;
    }
}
```

### 地图匹配质量评估

```java
public class MapMatchingQuality {
    /**
     * 评估地图匹配结果的质量
     */
    public static double evaluateMatching(
            LineString originalTrack,
            LineString matchedRoute) {
        
        // 使用 Hausdorff 距离评估匹配质量
        double hausdorff = DiscreteHausdorffDistance.distance(
            originalTrack, matchedRoute);
        
        // 转换为质量分数 (0-100)
        double maxAcceptableDeviation = 50.0;  // 50米
        double quality = Math.max(0, 100 - (hausdorff / maxAcceptableDeviation * 100));
        
        return quality;
    }
}
```

## 性能优化

### 使用空间索引加速距离查询

```java
import org.locationtech.jts.index.strtree.STRtree;

public class IndexedDistanceQuery {
    private STRtree index;
    private List<Geometry> geometries;
    
    public IndexedDistanceQuery(List<Geometry> geometries) {
        this.geometries = geometries;
        this.index = new STRtree();
        
        for (int i = 0; i < geometries.size(); i++) {
            Geometry g = geometries.get(i);
            index.insert(g.getEnvelopeInternal(), i);
        }
    }
    
    /**
     * 使用空间索引快速找到最近的几何图形
     */
    public Geometry findNearest(Point query, double searchRadius) {
        Envelope searchEnv = new Envelope(
            query.getX() - searchRadius, query.getX() + searchRadius,
            query.getY() - searchRadius, query.getY() + searchRadius
        );
        
        List candidates = index.query(searchEnv);
        
        Geometry nearest = null;
        double minDist = Double.MAX_VALUE;
        
        for (Object obj : candidates) {
            int idx = (Integer) obj;
            Geometry candidate = geometries.get(idx);
            double dist = query.distance(candidate);
            
            if (dist < minDist) {
                minDist = dist;
                nearest = candidate;
            }
        }
        
        return nearest;
    }
}
```

## 总结

JTS 提供了丰富的距离度量工具：

1. **基本距离**：`distance()` 方法计算任意几何图形之间的最短距离
2. **带点位的距离**：`DistanceOp` 返回距离和最近点对
3. **Hausdorff 距离**：`DiscreteHausdorffDistance` 衡量形状整体相似性
4. **缓冲区分析**：`isWithinDistance()` 进行距离筛选

选择合适的距离度量方法取决于具体应用场景：

- 简单的接近性检查：使用 `distance()` 或 `isWithinDistance()`
- 形状相似性比较：使用 Hausdorff 距离
- 轨迹/路径比较：考虑 Fréchet 距离（需要额外实现）

## 参考资料

- [JTS DistanceOp API](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/distance/DistanceOp.html)
- [JTS DiscreteHausdorffDistance API](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/algorithm/distance/DiscreteHausdorffDistance.html)
- [Hausdorff Distance - Wikipedia](https://en.wikipedia.org/wiki/Hausdorff_distance)
- [Fréchet Distance - Wikipedia](https://en.wikipedia.org/wiki/Fr%C3%A9chet_distance)
