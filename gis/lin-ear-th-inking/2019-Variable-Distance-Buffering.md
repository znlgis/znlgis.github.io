# JTS 中的可变距离缓冲区

> 原文：[Variable-distance buffering in JTS](https://lin-ear-th-inking.blogspot.com/2019/11/variable-distance-buffering-in-jts.html)
> 作者：Martin Davis
> 日期：2019年11月

## 概述

JTS 传统上计算固定距离的缓冲区几何图形。2019 年的博客文章介绍了"可变距离缓冲区"的概念，其中缓冲距离可以沿几何图形变化。这大大增加了空间分析的灵活性。

## 传统缓冲区 vs 可变距离缓冲区

### 传统缓冲区

标准 JTS 缓冲区在输入几何图形周围以固定距离创建缓冲区：

```java
import org.locationtech.jts.geom.Geometry;

Geometry line = ...;
double fixedDistance = 50.0;  // 固定 50 米

// 传统缓冲区 - 所有地方都是 50 米
Geometry buffer = line.buffer(fixedDistance);
```

**应用场景：**
- 河流周围 50 米的保护区
- 道路两侧等宽的噪音缓冲区
- 建筑物周围的安全距离

### 可变距离缓冲区

可变距离缓冲区允许缓冲距离沿几何图形动态变化：

```java
// 概念示例：缓冲距离沿线变化
// 起点 10 米，终点 100 米
public Geometry variableBuffer(LineString line, 
                               double startDistance, 
                               double endDistance) {
    // 根据位置计算不同的缓冲距离
    // 实现需要自定义逻辑
}
```

**应用场景：**
- 河流上游窄、下游宽的洪水风险区
- 根据交通量变化的道路影响区
- 基于人口密度变化的服务半径

## 实现方法

### 方法1：分段缓冲

将线分成多段，每段使用不同的缓冲距离，然后合并：

```java
import org.locationtech.jts.geom.*;
import org.locationtech.jts.operation.union.CascadedPolygonUnion;
import java.util.*;

public class VariableBufferBySegments {
    private GeometryFactory factory = new GeometryFactory();
    
    public Geometry createVariableBuffer(LineString line, 
                                         double[] distances) {
        List<Geometry> buffers = new ArrayList<>();
        Coordinate[] coords = line.getCoordinates();
        
        for (int i = 0; i < coords.length - 1; i++) {
            // 创建线段
            LineString segment = factory.createLineString(
                new Coordinate[] { coords[i], coords[i + 1] });
            
            // 使用该段对应的距离
            double distance = distances[Math.min(i, distances.length - 1)];
            Geometry segmentBuffer = segment.buffer(distance);
            buffers.add(segmentBuffer);
        }
        
        // 合并所有缓冲区
        return CascadedPolygonUnion.union(buffers);
    }
}
```

### 方法2：插值距离函数

使用距离函数根据位置计算缓冲距离：

```java
import org.locationtech.jts.linearref.LengthIndexedLine;

public class InterpolatedVariableBuffer {
    
    /**
     * 线性插值的可变缓冲区
     */
    public Geometry createLinearVariableBuffer(
            LineString line,
            double startDistance,
            double endDistance,
            int segments) {
        
        GeometryFactory factory = new GeometryFactory();
        List<Geometry> buffers = new ArrayList<>();
        
        // 将线分成多段
        double totalLength = line.getLength();
        double segmentLength = totalLength / segments;
        
        LengthIndexedLine indexedLine = new LengthIndexedLine(line);
        
        for (int i = 0; i < segments; i++) {
            double startPos = i * segmentLength;
            double endPos = (i + 1) * segmentLength;
            
            // 提取线段
            Geometry segment = indexedLine.extractLine(startPos, endPos);
            
            // 计算该段的平均距离（线性插值）
            double ratio = (startPos + endPos) / (2 * totalLength);
            double distance = startDistance + ratio * (endDistance - startDistance);
            
            // 创建缓冲区
            buffers.add(segment.buffer(distance));
        }
        
        return CascadedPolygonUnion.union(buffers);
    }
}
```

### 方法3：基于属性的距离

根据几何图形的属性（如交通量、风险等级）计算缓冲距离：

```java
public class AttributeBasedBuffer {
    
    /**
     * 根据属性值计算缓冲距离
     */
    public Geometry createAttributeBuffer(
            List<LineString> segments,
            List<Double> attributes,
            DistanceFunction distFunc) {
        
        List<Geometry> buffers = new ArrayList<>();
        
        for (int i = 0; i < segments.size(); i++) {
            LineString segment = segments.get(i);
            double attribute = attributes.get(i);
            
            // 使用距离函数计算缓冲距离
            double distance = distFunc.compute(attribute);
            buffers.add(segment.buffer(distance));
        }
        
        return CascadedPolygonUnion.union(buffers);
    }
}

@FunctionalInterface
interface DistanceFunction {
    double compute(double attribute);
}
```

使用示例：

```java
// 根据交通量计算缓冲距离
// 交通量越大，影响范围越大
DistanceFunction trafficDistFunc = traffic -> {
    if (traffic < 1000) return 10.0;      // 低交通量：10米
    else if (traffic < 5000) return 25.0; // 中交通量：25米
    else return 50.0;                      // 高交通量：50米
};

Geometry buffer = createAttributeBuffer(roadSegments, trafficVolumes, trafficDistFunc);
```

## 实际应用场景

### 1. 环境影响分析

```java
// 根据污染源强度变化的影响区
public Geometry createPollutionImpactZone(
        LineString source,
        double[] pollutionLevels) {
    
    // 污染越强，影响范围越大
    double[] distances = Arrays.stream(pollutionLevels)
        .map(level -> level * 10)  // 污染指数 × 10 = 缓冲距离（米）
        .toArray();
    
    return createVariableBuffer(source, distances);
}
```

### 2. 洪水风险建模

```java
// 河流沿线的洪水风险区
// 上游窄，下游宽
public Geometry createFloodRiskZone(LineString river) {
    double upstreamWidth = 50.0;   // 上游 50 米
    double downstreamWidth = 200.0; // 下游 200 米
    
    return createLinearVariableBuffer(river, upstreamWidth, downstreamWidth, 20);
}
```

### 3. 基础设施规划

```java
// 根据人口密度变化的服务区
public Geometry createServiceArea(
        LineString infrastructure,
        double[] populationDensity) {
    
    // 人口密度高的地方需要更大的服务范围
    double[] distances = new double[populationDensity.length];
    for (int i = 0; i < populationDensity.length; i++) {
        distances[i] = Math.sqrt(populationDensity[i]) * 5;
    }
    
    return createVariableBuffer(infrastructure, distances);
}
```

## 技术考量

### 平滑过渡

分段缓冲可能在段连接处产生不连续：

```java
// 使用更多段数来平滑过渡
int segments = 50;  // 更多段数 = 更平滑的过渡

// 或者使用样条插值
public double[] smoothDistances(double[] distances, int outputCount) {
    // 使用样条插值生成平滑的距离数组
    SplineInterpolator interpolator = new SplineInterpolator();
    // ... 实现细节
}
```

### 性能优化

```java
// 对于大量段数，使用并行处理
List<Geometry> buffers = segments.parallelStream()
    .map(seg -> {
        double dist = calculateDistance(seg);
        return seg.buffer(dist);
    })
    .collect(Collectors.toList());

// 使用高效的合并
Geometry result = CascadedPolygonUnion.union(buffers);
```

### 几何有效性

```java
// 确保结果几何图形有效
Geometry result = ...;
if (!result.isValid()) {
    result = result.buffer(0);  // 修复无效几何
}
```

## JTS 设计原则的体现

可变距离缓冲区的实现体现了 JTS 的设计原则：

1. **几何统一性**：缓冲操作可以应用于所有几何类型
2. **无意外**：行为一致且可预测
3. **通用性**：功能设计尽可能通用

## 总结

可变距离缓冲区扩展了 JTS 传统缓冲操作的能力，允许更灵活、更接近实际需求的空间分析。虽然 JTS 核心可能不直接支持这一功能，但可以通过分段缓冲和合并的方式轻松实现。

## 参考资料

- [JTS BufferOp JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/buffer/BufferOp.html)
- [JTS CascadedPolygonUnion](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/union/CascadedPolygonUnion.html)
- [Lin.ear th.inking 2019 年博客归档](https://lin-ear-th-inking.blogspot.com/2019/)
