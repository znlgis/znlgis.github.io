# JTS 精度模型与数值鲁棒性

> 原文：基于 Lin.ear th.inking 博客和 JTS 技术文档
> 作者：Martin Davis
> 日期：约 2017年

## 概述

数值精度问题是计算几何中最棘手的挑战之一。JTS 通过精度模型（PrecisionModel）和各种鲁棒性策略来处理浮点数计算中的不精确性。本文深入探讨这些机制的原理和最佳实践。

## 为什么精度很重要？

### 浮点数的局限性

计算机使用有限位数表示实数，这导致了不可避免的舍入误差：

```java
public class FloatingPointIssue {
    public static void main(String[] args) {
        // 浮点数精度问题演示
        double a = 0.1 + 0.2;
        System.out.println(a);  // 输出: 0.30000000000000004
        
        double b = 0.1 + 0.1 + 0.1;
        System.out.println(b == 0.3);  // 输出: false
    }
}
```

### 几何计算中的影响

在几何计算中，精度问题可能导致：

1. **拓扑不一致**：本应相交的线不相交
2. **无效几何**：操作结果产生自相交多边形
3. **计算失败**：算法抛出 TopologyException

```
    理论上的相交         计算机中的相交
    
    A ----+---- B        A --------+--- B
          |                      /
          |              (可能错过交点)
    C ----+---- D        C ----+------ D
```

## JTS 精度模型

### PrecisionModel 类

JTS 使用 `PrecisionModel` 类来控制坐标精度：

```java
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.geom.GeometryFactory;

public class PrecisionModelExample {
    public static void main(String[] args) {
        // 1. 浮点精度（默认）
        PrecisionModel floatingPM = new PrecisionModel(PrecisionModel.FLOATING);
        
        // 2. 单精度浮点
        PrecisionModel floatingSinglePM = new PrecisionModel(PrecisionModel.FLOATING_SINGLE);
        
        // 3. 固定精度（小数点后 3 位）
        PrecisionModel fixedPM = new PrecisionModel(1000.0);  // scale = 1000
        
        // 使用精度模型创建 GeometryFactory
        GeometryFactory factory = new GeometryFactory(fixedPM);
    }
}
```

### 精度类型比较

| 精度类型 | Scale | 说明 | 适用场景 |
|---------|-------|------|---------|
| FLOATING | - | 双精度浮点 | 默认，高精度需求 |
| FLOATING_SINGLE | - | 单精度浮点 | 内存受限场景 |
| Fixed | 自定义 | 固定精度 | 数据交换，叠加分析 |

### 固定精度的计算

```java
public class FixedPrecisionDemo {
    public static void main(String[] args) {
        // scale = 1000 意味着精确到小数点后 3 位
        PrecisionModel pm = new PrecisionModel(1000.0);
        
        // 坐标会被四舍五入
        double original = 12.34567;
        double rounded = pm.makePrecise(original);
        System.out.println("原始: " + original);  // 12.34567
        System.out.println("舍入: " + rounded);   // 12.346
    }
}
```

## Snap Rounding（捕捉舍入）

### 什么是 Snap Rounding？

Snap Rounding 是一种处理几何叠加中精度问题的技术。它将所有坐标和交点捕捉到网格点上，保证拓扑一致性。

```
    无 Snap Rounding        使用 Snap Rounding
    
    /\                      /\
   /  \                    /  \
  /    \  交点可能         /    \  交点捕捉到网格
 /    X \  位置不精确     / X    \  位置精确
/--------\              /--------\
        网格                 网格
```

### JTS 中的 Snap Rounding

```java
import org.locationtech.jts.precision.GeometryPrecisionReducer;

public class SnapRoundingExample {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        // 原始几何（高精度坐标）
        Geometry geom = reader.read(
            "POLYGON ((0.123456 0.234567, 10.345678 0.456789, " +
            "10.567890 10.678901, 0.789012 10.890123, 0.123456 0.234567))");
        
        // 降低精度
        PrecisionModel pm = new PrecisionModel(100.0);  // 小数点后 2 位
        GeometryPrecisionReducer reducer = new GeometryPrecisionReducer(pm);
        
        Geometry reduced = reducer.reduce(geom);
        System.out.println("原始: " + geom);
        System.out.println("降精: " + reduced);
    }
}
```

## OverlayNG 的鲁棒性

### 鲁棒叠加

JTS 的 OverlayNG 实现了高度鲁棒的叠加操作：

```java
import org.locationtech.jts.operation.overlayng.OverlayNG;
import org.locationtech.jts.operation.overlayng.OverlayNGRobust;

public class RobustOverlayExample {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        Geometry g1 = reader.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
        Geometry g2 = reader.read("POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))");
        
        // 使用 OverlayNGRobust 自动处理精度问题
        Geometry intersection = OverlayNGRobust.overlay(
            g1, g2, OverlayNG.INTERSECTION);
        
        System.out.println("交集: " + intersection);
    }
}
```

### 固定精度叠加

```java
public class FixedPrecisionOverlay {
    /**
     * 使用固定精度执行叠加操作
     */
    public static Geometry overlayWithPrecision(
            Geometry g1, 
            Geometry g2, 
            int opCode,
            double scale) {
        
        PrecisionModel pm = new PrecisionModel(scale);
        return OverlayNG.overlay(g1, g2, opCode, pm);
    }
    
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        Geometry g1 = reader.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
        Geometry g2 = reader.read("POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))");
        
        // 使用 scale=1000 (小数点后 3 位) 执行交集
        Geometry result = overlayWithPrecision(
            g1, g2, OverlayNG.INTERSECTION, 1000.0);
        
        System.out.println("结果: " + result);
    }
}
```

## 处理 TopologyException

### 异常原因

`TopologyException` 通常由以下原因引起：

1. **输入几何无效**
2. **精度问题导致的拓扑不一致**
3. **几乎重合的边界**

### 防御性处理策略

```java
public class RobustGeometryOperations {
    
    /**
     * 鲁棒的交集操作
     */
    public static Geometry safeIntersection(Geometry g1, Geometry g2) {
        try {
            // 首先尝试标准操作
            return g1.intersection(g2);
        } catch (TopologyException e) {
            // 如果失败，尝试使用 OverlayNGRobust
            try {
                return OverlayNGRobust.overlay(g1, g2, OverlayNG.INTERSECTION);
            } catch (Exception e2) {
                // 如果仍然失败，尝试缓冲区修复
                return safeIntersectionWithBuffer(g1, g2);
            }
        }
    }
    
    private static Geometry safeIntersectionWithBuffer(Geometry g1, Geometry g2) {
        // 使用微小缓冲区修复潜在问题
        Geometry fixed1 = g1.buffer(0);
        Geometry fixed2 = g2.buffer(0);
        return fixed1.intersection(fixed2);
    }
}
```

### 验证和修复

```java
public class GeometryValidator {
    
    /**
     * 验证并修复几何图形
     */
    public static Geometry validateAndFix(Geometry geom) {
        if (!geom.isValid()) {
            // 使用 buffer(0) 修复
            Geometry fixed = geom.buffer(0);
            
            if (fixed.isValid()) {
                return fixed;
            }
            
            // 如果 buffer(0) 不工作，尝试 GeometryFixer
            return new GeometryFixer(geom).getResult();
        }
        return geom;
    }
}
```

## 最佳实践

### 1. 选择合适的精度

```java
public class PrecisionBestPractices {
    
    /**
     * 根据数据源选择精度
     */
    public static PrecisionModel choosePrecision(String dataSource) {
        switch (dataSource) {
            case "GPS":
                // GPS 精度约为 1 米，小数点后 5 位足够
                return new PrecisionModel(100000.0);
            
            case "SURVEY":
                // 测量数据需要更高精度
                return new PrecisionModel(1000000.0);
            
            case "CARTOGRAPHIC":
                // 制图数据可以使用较低精度
                return new PrecisionModel(1000.0);
            
            default:
                return new PrecisionModel();  // 默认浮点
        }
    }
}
```

### 2. 预处理输入数据

```java
public class DataPreprocessing {
    
    /**
     * 预处理几何数据
     */
    public static Geometry preprocess(Geometry geom, PrecisionModel pm) {
        // 1. 验证有效性
        if (!geom.isValid()) {
            geom = new GeometryFixer(geom).getResult();
        }
        
        // 2. 降低精度到目标精度模型
        geom = GeometryPrecisionReducer.reduce(geom, pm);
        
        // 3. 再次验证
        if (!geom.isValid()) {
            geom = geom.buffer(0);
        }
        
        return geom;
    }
}
```

### 3. 使用一致的精度

```java
public class ConsistentPrecision {
    private final PrecisionModel precisionModel;
    private final GeometryFactory factory;
    
    public ConsistentPrecision(double scale) {
        this.precisionModel = new PrecisionModel(scale);
        this.factory = new GeometryFactory(precisionModel);
    }
    
    /**
     * 确保所有操作使用一致的精度
     */
    public Geometry union(List<Geometry> geometries) {
        // 先统一精度
        List<Geometry> normalized = geometries.stream()
            .map(g -> GeometryPrecisionReducer.reduce(g, precisionModel))
            .collect(Collectors.toList());
        
        // 然后执行操作
        GeometryCollection gc = factory.createGeometryCollection(
            normalized.toArray(new Geometry[0]));
        return gc.union();
    }
}
```

## 常见问题与解决方案

### 问题 1：叠加操作失败

```java
// 症状: TopologyException: found non-noded intersection

// 解决方案
Geometry result = OverlayNGRobust.overlay(g1, g2, OverlayNG.INTERSECTION);
```

### 问题 2：几乎重合的边

```java
// 症状: 两条几乎相同的边被认为不同

// 解决方案: 使用容差比较
public boolean edgesMatch(LineSegment e1, LineSegment e2, double tolerance) {
    return e1.distance(e2.p0) < tolerance && e1.distance(e2.p1) < tolerance;
}
```

### 问题 3：精度降低后几何无效

```java
// 症状: 降低精度后多边形变得自相交

// 解决方案: 使用 TopologyPreservingSimplifier
TopologyPreservingSimplifier simplifier = 
    new TopologyPreservingSimplifier(geom);
simplifier.setDistanceTolerance(0.01);
Geometry simplified = simplifier.getResultGeometry();
```

## 总结

处理几何精度问题的关键点：

1. **理解问题根源**：浮点数本身的局限性
2. **选择合适的精度模型**：根据数据源和应用需求
3. **使用鲁棒算法**：OverlayNGRobust 处理大多数情况
4. **预处理数据**：验证和修复输入几何
5. **统一精度**：确保所有操作使用一致的精度模型

通过合理使用 JTS 的精度工具，可以大大减少几何计算中的数值问题。

## 参考资料

- [JTS PrecisionModel API](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/geom/PrecisionModel.html)
- [JTS OverlayNG 文档](https://github.com/locationtech/jts/blob/master/doc/OverlayNGDesign.md)
- [Snap Rounding - Wikipedia](https://en.wikipedia.org/wiki/Snap_rounding)
- [浮点数问题 - What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)
