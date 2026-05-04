---
layout: default
title: JTS 中的随机点生成
---

# JTS 中的随机点生成

> 原文：[More Random Points in JTS](https://lin-ear-th-inking.blogspot.com/2010/05/more-random-points-in-jts.html)
> 作者：Martin Davis
> 日期：2010年5月

## 概述

在多边形内生成随机点是 GIS 和制图学中的常见需求，特别是用于创建点密度图（Dot Density Maps）。本文介绍了 JTS 中随机点生成的方法，以及如何改进生成更均匀分布的点。

## 应用场景

### 点密度图

点密度图是一种强大的可视化技术，用于显示多边形区域内的定量信息：

- 每个点代表固定数量（如每点 = 100 人）
- 点随机分布在多边形内
- 视觉密度反映数据密度

**常见用途：**
- 人口分布可视化
- 资源分布展示
- 事件密度分析

## 基本随机点生成

### 方法1：边界框 + 过滤

最简单的方法是在边界框内生成随机点，然后过滤掉多边形外的点：

```java
import org.locationtech.jts.geom.*;
import java.util.*;

public class RandomPointsInPolygon {
    private GeometryFactory factory = new GeometryFactory();
    private Random random = new Random();
    
    /**
     * 在多边形内生成指定数量的随机点
     */
    public List<Point> generateRandomPoints(Polygon polygon, int numPoints) {
        List<Point> points = new ArrayList<>();
        Envelope envelope = polygon.getEnvelopeInternal();
        
        while (points.size() < numPoints) {
            // 在边界框内生成随机坐标
            double x = envelope.getMinX() + 
                      random.nextDouble() * envelope.getWidth();
            double y = envelope.getMinY() + 
                      random.nextDouble() * envelope.getHeight();
            
            Point point = factory.createPoint(new Coordinate(x, y));
            
            // 检查点是否在多边形内
            if (polygon.contains(point)) {
                points.add(point);
            }
        }
        
        return points;
    }
}
```

### 效率考量

对于凹多边形或复杂形状，边界框内多边形外的面积可能很大，导致大量点被拒绝：

```java
/**
 * 计算采样效率
 */
public double calculateSamplingEfficiency(Polygon polygon) {
    Envelope envelope = polygon.getEnvelopeInternal();
    double boxArea = envelope.getWidth() * envelope.getHeight();
    double polygonArea = polygon.getArea();
    
    // 效率 = 多边形面积 / 边界框面积
    return polygonArea / boxArea;
}
```

## 真随机的"聚集"问题

真正的随机分布（泊松分布）会产生视觉上的"聚集"现象：

```
+----------------------------------+
|  *    *  *                  *    |
|      * **  *                     |
|                   *     *  *     |
|  *         *           **        |
|        *      *    *             |
|    *       *            *    *   |
+----------------------------------+
     聚集现象：某些区域点密集，某些区域稀疏
```

这是真随机的固有特性，不是 bug！但对于可视化来说，可能不是理想的效果。

## 改进：均匀分布的随机点

### 使用最小距离约束

通过添加最小距离约束，避免点过于聚集：

```java
import org.locationtech.jts.index.kdtree.KdTree;

public class EvenlyDistributedRandomPoints {
    private GeometryFactory factory = new GeometryFactory();
    private Random random = new Random();
    
    /**
     * 生成均匀分布的随机点
     * @param polygon 目标多边形
     * @param numPoints 点数量
     * @param minDistance 点之间的最小距离
     */
    public List<Point> generateEvenPoints(
            Polygon polygon, 
            int numPoints, 
            double minDistance) {
        
        List<Point> points = new ArrayList<>();
        KdTree kdTree = new KdTree();  // 用于快速距离检查
        Envelope envelope = polygon.getEnvelopeInternal();
        
        int maxAttempts = numPoints * 100;  // 防止无限循环
        int attempts = 0;
        
        while (points.size() < numPoints && attempts < maxAttempts) {
            attempts++;
            
            double x = envelope.getMinX() + 
                      random.nextDouble() * envelope.getWidth();
            double y = envelope.getMinY() + 
                      random.nextDouble() * envelope.getHeight();
            
            Coordinate coord = new Coordinate(x, y);
            Point point = factory.createPoint(coord);
            
            // 检查是否在多边形内
            if (!polygon.contains(point)) {
                continue;
            }
            
            // 检查与现有点的距离
            if (points.isEmpty() || isDistanceOK(kdTree, coord, minDistance)) {
                points.add(point);
                kdTree.insert(coord, point);
            }
        }
        
        return points;
    }
    
    private boolean isDistanceOK(KdTree tree, Coordinate coord, double minDist) {
        // 查询最近邻
        Envelope searchEnv = new Envelope(
            coord.x - minDist, coord.x + minDist,
            coord.y - minDist, coord.y + minDist);
        
        List<Object> nearPoints = tree.query(searchEnv);
        
        for (Object obj : nearPoints) {
            KdTree.KdNode node = (KdTree.KdNode) obj;
            double dist = coord.distance(node.getCoordinate());
            if (dist < minDist) {
                return false;
            }
        }
        return true;
    }
}
```

### 自动计算最小距离

```java
/**
 * 根据点数量自动计算合适的最小距离
 */
public double calculateMinDistance(Polygon polygon, int numPoints) {
    double area = polygon.getArea();
    
    // 假设点均匀分布，每个点占据的面积
    double areaPerPoint = area / numPoints;
    
    // 正六边形最优打包的间距
    // 面积 = sqrt(3)/2 * d^2，所以 d = sqrt(2 * area / sqrt(3))
    double optimalDistance = Math.sqrt(2 * areaPerPoint / Math.sqrt(3));
    
    // 使用最优距离的 80% 作为最小距离，允许一些变化
    return optimalDistance * 0.8;
}
```

## 准随机序列（低差异序列）

另一种方法是使用准随机（Quasi-random）序列，如 Halton 或 Sobol 序列：

```java
/**
 * Halton 序列生成器
 */
public class HaltonSequence {
    private int base;
    private int index;
    
    public HaltonSequence(int base) {
        this.base = base;
        this.index = 0;
    }
    
    public double next() {
        double result = 0;
        double f = 1.0 / base;
        int i = ++index;
        
        while (i > 0) {
            result += f * (i % base);
            i = i / base;
            f = f / base;
        }
        
        return result;
    }
}

/**
 * 使用 Halton 序列生成准随机点
 */
public List<Point> generateHaltonPoints(Polygon polygon, int numPoints) {
    List<Point> points = new ArrayList<>();
    HaltonSequence seqX = new HaltonSequence(2);  // 基数 2
    HaltonSequence seqY = new HaltonSequence(3);  // 基数 3
    
    Envelope envelope = polygon.getEnvelopeInternal();
    
    while (points.size() < numPoints) {
        double x = envelope.getMinX() + seqX.next() * envelope.getWidth();
        double y = envelope.getMinY() + seqY.next() * envelope.getHeight();
        
        Point point = factory.createPoint(new Coordinate(x, y));
        
        if (polygon.contains(point)) {
            points.add(point);
        }
    }
    
    return points;
}
```

**准随机序列的优点：**
- 更均匀的空间覆盖
- 确定性（可重复）
- 视觉上更"随机"的外观

## 用于点密度图的完整示例

```java
import org.locationtech.jts.geom.*;
import java.awt.*;
import java.util.*;

public class DotDensityMap {
    private GeometryFactory factory = new GeometryFactory();
    
    /**
     * 为一组区域创建点密度图
     * @param regions 区域多边形
     * @param values 每个区域的数值
     * @param divisor 每个点代表的数值
     */
    public Map<Polygon, List<Point>> createDotDensityMap(
            List<Polygon> regions,
            List<Double> values,
            double divisor) {
        
        Map<Polygon, List<Point>> result = new HashMap<>();
        
        for (int i = 0; i < regions.size(); i++) {
            Polygon region = regions.get(i);
            double value = values.get(i);
            
            // 计算该区域的点数量
            int numDots = (int) Math.round(value / divisor);
            
            // 生成随机点
            List<Point> dots = generateEvenlyDistributedPoints(region, numDots);
            
            result.put(region, dots);
        }
        
        return result;
    }
    
    private List<Point> generateEvenlyDistributedPoints(
            Polygon polygon, int numPoints) {
        // 使用带最小距离约束的随机点生成
        double minDist = calculateMinDistance(polygon, numPoints);
        return generateEvenPoints(polygon, numPoints, minDist);
    }
}
```

## 性能优化

### 使用准备几何

对于大量点的包含测试，使用 PreparedGeometry：

```java
import org.locationtech.jts.geom.prep.*;

public List<Point> generatePointsFast(Polygon polygon, int numPoints) {
    PreparedGeometry preparedPolygon = PreparedGeometryFactory.prepare(polygon);
    List<Point> points = new ArrayList<>();
    
    Envelope envelope = polygon.getEnvelopeInternal();
    
    while (points.size() < numPoints) {
        double x = envelope.getMinX() + random.nextDouble() * envelope.getWidth();
        double y = envelope.getMinY() + random.nextDouble() * envelope.getHeight();
        
        Point point = factory.createPoint(new Coordinate(x, y));
        
        // 使用 PreparedGeometry 的 contains 方法（更快）
        if (preparedPolygon.contains(point)) {
            points.add(point);
        }
    }
    
    return points;
}
```

### 批量点检测

```java
// 一次生成多个候选点，批量检测
public List<Point> generatePointsBatch(Polygon polygon, int numPoints, int batchSize) {
    PreparedGeometry prepared = PreparedGeometryFactory.prepare(polygon);
    List<Point> result = new ArrayList<>();
    
    while (result.size() < numPoints) {
        // 生成一批候选点
        List<Point> candidates = generateCandidates(polygon, batchSize);
        
        // 批量过滤
        for (Point p : candidates) {
            if (prepared.contains(p)) {
                result.add(p);
                if (result.size() >= numPoints) break;
            }
        }
    }
    
    return result;
}
```

## 总结

JTS 提供了在多边形内生成随机点的基础能力。根据应用需求，可以选择：

1. **简单随机**：快速但可能聚集
2. **最小距离约束**：均匀分布但较慢
3. **准随机序列**：均匀且可重复

点密度图是这些技术的典型应用，在人口统计、资源分布等可视化中广泛使用。

## 参考资料

- [JTS RandomPointsBuilder](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/shape/random/RandomPointsBuilder.html)
- [Halton 序列 - 维基百科](https://en.wikipedia.org/wiki/Halton_sequence)
- [点密度图 - Esri 文档](https://developers.arcgis.com/documentation/mapping-and-location-services/data-visualization/data-driven-styles/dot-density/)
