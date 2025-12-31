# JTS 中的均匀分布随机点生成

> 原文：[Evenly Distributed Random Points in JTS](https://lin-ear-th-inking.blogspot.com/2015/07/)
> 作者：Martin Davis
> 日期：2015年7月

## 概述

2010 年的博客文章介绍了在多边形内生成随机点的基本方法。2015 年的这篇文章进一步探讨了如何生成"均匀分布"的随机点——避免点过于聚集的问题。

## 问题回顾

真正的随机分布（泊松分布）具有"聚集"特性：

```
纯随机分布：              均匀随机分布：
+----------------+        +----------------+
|  *   **    *   |        |  *   *    *    |
|    *     * *   |        |    *    *   *  |
|  *  *   *      |        |  *    *   *    |
|      * **   *  |        |    *   *    *  |
|  *       *     |        |  *    *    *   |
+----------------+        +----------------+
   看起来不均匀               视觉上更均匀
```

## 解决方案：距离容差

通过使用距离容差和空间索引（KD 树），我们可以确保生成的点之间保持最小距离。

### 核心算法

```java
import org.locationtech.jts.geom.*;
import org.locationtech.jts.index.kdtree.KdTree;
import java.util.*;

public class EvenRandomPointsGenerator {
    private GeometryFactory factory = new GeometryFactory();
    private Random random = new Random();
    
    /**
     * 生成均匀分布的随机点
     * 使用 KD 树进行距离检查，确保点之间保持最小距离
     */
    public MultiPoint generateEvenPoints(
            Polygon polygon, 
            int targetCount,
            double tolerance) {
        
        List<Coordinate> coordinates = new ArrayList<>();
        KdTree kdTree = new KdTree(tolerance);  // 使用容差创建 KD 树
        
        Envelope env = polygon.getEnvelopeInternal();
        int maxAttempts = targetCount * 50;
        int attempts = 0;
        
        while (coordinates.size() < targetCount && attempts < maxAttempts) {
            attempts++;
            
            // 生成随机坐标
            double x = env.getMinX() + random.nextDouble() * env.getWidth();
            double y = env.getMinY() + random.nextDouble() * env.getHeight();
            Coordinate coord = new Coordinate(x, y);
            
            // 检查是否在多边形内
            Point point = factory.createPoint(coord);
            if (!polygon.contains(point)) {
                continue;
            }
            
            // 使用 KD 树的容差功能
            // 如果距离现有点太近，会被"捕捉"到现有点
            KdTree.KdNode node = kdTree.insert(coord);
            Coordinate insertedCoord = node.getCoordinate();
            
            // 检查是否是新点（没有被捕捉）
            if (insertedCoord.equals2D(coord)) {
                coordinates.add(coord);
            }
            // 如果被捕捉，说明太近了，跳过这个点
        }
        
        return factory.createMultiPointFromCoords(
            coordinates.toArray(new Coordinate[0]));
    }
}
```

### KD 树的容差机制

JTS 的 `KdTree` 支持距离容差：

```java
// 创建带容差的 KD 树
double tolerance = 10.0;  // 10 米最小距离
KdTree tree = new KdTree(tolerance);

// 插入点时，如果新点距离现有点小于容差，
// 会返回现有点的节点而不是创建新节点
Coordinate coord1 = new Coordinate(0, 0);
Coordinate coord2 = new Coordinate(5, 5);  // 距离 coord1 约 7.07 米

KdTree.KdNode node1 = tree.insert(coord1);  // 插入成功
KdTree.KdNode node2 = tree.insert(coord2);  // 返回 node1，因为太近

// 检查：node2.getCoordinate() == coord1（被捕捉到现有点）
```

## 改进的实现

### 带有重试策略的生成器

```java
public class RobustEvenPointsGenerator {
    private GeometryFactory factory = new GeometryFactory();
    private Random random = new Random();
    
    /**
     * 带有自适应容差的均匀点生成
     */
    public MultiPoint generateWithAdaptiveTolerance(
            Polygon polygon, 
            int targetCount) {
        
        // 计算初始容差
        double area = polygon.getArea();
        double initialTolerance = Math.sqrt(area / targetCount) * 0.5;
        
        // 尝试生成
        MultiPoint result = tryGenerate(polygon, targetCount, initialTolerance);
        
        // 如果点数不足，减小容差重试
        double tolerance = initialTolerance;
        while (result.getNumGeometries() < targetCount * 0.9 && tolerance > 0.1) {
            tolerance *= 0.8;
            result = tryGenerate(polygon, targetCount, tolerance);
        }
        
        return result;
    }
    
    private MultiPoint tryGenerate(Polygon polygon, int count, double tolerance) {
        // 使用前面的算法
        return generateEvenPoints(polygon, count, tolerance);
    }
}
```

### 支持多边形集合

```java
public class MultiPolygonPointsGenerator {
    
    /**
     * 在多个多边形中生成均匀分布的点
     * 每个多边形的点数与其面积成比例
     */
    public MultiPoint generateForMultiPolygon(
            MultiPolygon multiPolygon,
            int totalCount,
            double tolerance) {
        
        double totalArea = multiPolygon.getArea();
        List<Coordinate> allCoords = new ArrayList<>();
        
        for (int i = 0; i < multiPolygon.getNumGeometries(); i++) {
            Polygon polygon = (Polygon) multiPolygon.getGeometryN(i);
            
            // 按面积比例分配点数
            double ratio = polygon.getArea() / totalArea;
            int count = (int) Math.round(totalCount * ratio);
            
            // 生成该多边形的点
            EvenRandomPointsGenerator gen = new EvenRandomPointsGenerator();
            MultiPoint points = gen.generateEvenPoints(polygon, count, tolerance);
            
            // 收集坐标
            for (Coordinate coord : points.getCoordinates()) {
                allCoords.add(coord);
            }
        }
        
        return factory.createMultiPointFromCoords(
            allCoords.toArray(new Coordinate[0]));
    }
}
```

## 应用示例

### 人口密度图

```java
public class PopulationDensityMap {
    private GeometryFactory factory = new GeometryFactory();
    
    /**
     * 创建人口密度点图
     * @param regions 区域列表
     * @param populations 各区域人口
     * @param dotsPerPerson 每多少人一个点
     */
    public Map<String, MultiPoint> createPopulationDots(
            Map<String, Polygon> regions,
            Map<String, Integer> populations,
            int dotsPerPerson) {
        
        Map<String, MultiPoint> result = new HashMap<>();
        EvenRandomPointsGenerator generator = new EvenRandomPointsGenerator();
        
        for (Map.Entry<String, Polygon> entry : regions.entrySet()) {
            String name = entry.getKey();
            Polygon region = entry.getValue();
            int population = populations.getOrDefault(name, 0);
            
            // 计算点数
            int numDots = population / dotsPerPerson;
            if (numDots == 0) continue;
            
            // 计算合适的最小距离
            double tolerance = Math.sqrt(region.getArea() / numDots) * 0.3;
            
            // 生成点
            MultiPoint dots = generator.generateEvenPoints(region, numDots, tolerance);
            result.put(name, dots);
        }
        
        return result;
    }
}
```

### 资源分布可视化

```java
public class ResourceDistributionViz {
    
    /**
     * 按类别创建资源分布图
     * 不同类别的资源用不同颜色的点表示
     */
    public Map<String, MultiPoint> createResourceDots(
            Polygon region,
            Map<String, Integer> resourceCounts,
            int dotsPerUnit) {
        
        Map<String, MultiPoint> result = new HashMap<>();
        
        // 计算总点数和容差
        int totalDots = resourceCounts.values().stream()
            .mapToInt(v -> v / dotsPerUnit)
            .sum();
        double tolerance = Math.sqrt(region.getArea() / totalDots) * 0.3;
        
        // 为每种资源生成点
        // 使用全局 KD 树确保所有类别的点都不重叠
        KdTree globalTree = new KdTree(tolerance);
        
        for (Map.Entry<String, Integer> entry : resourceCounts.entrySet()) {
            String category = entry.getKey();
            int count = entry.getValue() / dotsPerUnit;
            
            MultiPoint dots = generateWithGlobalTree(
                region, count, tolerance, globalTree);
            result.put(category, dots);
        }
        
        return result;
    }
    
    private MultiPoint generateWithGlobalTree(
            Polygon polygon, int count, double tolerance, KdTree globalTree) {
        // 使用全局 KD 树生成点，确保不同类别的点也保持距离
        // ... 实现类似前面的逻辑
    }
}
```

## 性能考量

### 大规模点生成

对于需要生成大量点的场景：

```java
public class LargeScalePointGenerator {
    
    /**
     * 大规模点生成的优化策略
     */
    public MultiPoint generateLargeScale(
            Polygon polygon, 
            int count,
            double tolerance) {
        
        // 策略1：使用 PreparedGeometry 加速包含测试
        PreparedGeometry prepared = PreparedGeometryFactory.prepare(polygon);
        
        // 策略2：分块生成
        // 将多边形分成多个小区域，每个区域独立生成
        
        // 策略3：并行处理
        // 使用 parallelStream 并行生成
        
        // ... 实现细节
    }
}
```

### 内存优化

```java
// 对于非常大量的点，使用坐标数组而不是 Point 对象
public Coordinate[] generateCoordinatesOnly(
        Polygon polygon, int count, double tolerance) {
    
    List<Coordinate> coords = new ArrayList<>();
    KdTree tree = new KdTree(tolerance);
    
    // 只存储坐标，不创建 Point 对象
    // ... 生成逻辑
    
    return coords.toArray(new Coordinate[0]);
}
```

## 与 2010 年方法的比较

| 特性 | 2010 简单随机 | 2015 均匀分布 |
|------|---------------|---------------|
| 分布 | 泊松（聚集） | 均匀（稀疏） |
| 速度 | 快 | 较慢 |
| 视觉效果 | 自然但不均匀 | 均匀且美观 |
| 适用场景 | 统计模拟 | 可视化 |

## 总结

均匀分布的随机点生成是对简单随机生成的重要改进。通过使用 KD 树的距离容差功能，可以确保生成的点之间保持最小距离，产生视觉上更均匀的分布。这种方法特别适合于制图和数据可视化应用。

## 参考资料

- [JTS KdTree JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/index/kdtree/KdTree.html)
- [JTS RandomPointsBuilder](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/shape/random/RandomPointsBuilder.html)
- [Lin.ear th.inking 博客 2015](https://lin-ear-th-inking.blogspot.com/2015/07/)
