# 使用 JTS 简化多边形覆盖

> 原文：[Simplifying Polygonal Coverages with JTS](https://lin-ear-th-inking.blogspot.com/2023/03/simplifying-polygonal-coverages-with-jts.html)
> 作者：Martin Davis
> 日期：2023年3月

## 概述

JTS 2023 年版本引入了处理**简单多边形覆盖（Simple Polygonal Coverages）**的新功能。多边形覆盖是边缘匹配的、不重叠的多边形几何集合，广泛用于 GIS 数据表示。

## 什么是多边形覆盖？

多边形覆盖（Polygonal Coverage）是一组多边形，具有以下特征：

- **边缘匹配**：相邻多边形在边界处精确对齐
- **不重叠**：任意两个多边形的内部不相交
- **可包含间隙**：允许非连续区域或空洞
- **可包含孤岛**：支持不与其他多边形相邻的独立多边形

### 常见应用场景

- 行政区划地图（省、市、县边界）
- 土地利用/土地覆盖数据
- 地籍数据
- 人口普查区划

## 覆盖简化的挑战

对多边形覆盖进行简化面临特殊挑战：

1. **保持边缘一致性**：简化后相邻多边形的共享边界必须保持一致
2. **避免自相交**：简化不能产生自相交的多边形
3. **保持拓扑关系**：多边形之间的相邻关系必须保持
4. **防止产生间隙**：不应在原本边缘匹配的区域产生新间隙

## JTS 的覆盖简化实现

JTS 提供了 `CoverageSimplifier` 类来处理覆盖简化：

```java
import org.locationtech.jts.coverage.CoverageSimplifier;
import org.locationtech.jts.geom.Geometry;

Geometry[] coverage = ...;  // 有效的多边形覆盖

// 设置简化容差
double tolerance = 10.0;

// 执行简化
Geometry[] simplifiedCoverage = CoverageSimplifier.simplify(coverage, tolerance);
```

### 简化参数

- **容差（tolerance）**：控制简化的程度。较大的值会产生更简单的几何图形，但可能丢失更多细节。

## 算法原理

### 约束的 Visvalingam-Whyatt 简化

JTS 的覆盖简化基于修改版的 Visvalingam-Whyatt 算法：

1. **识别共享边界**：首先识别覆盖中所有多边形的共享边界
2. **统一简化共享边界**：确保共享边界在所有相邻多边形中以相同方式简化
3. **保持约束**：确保简化不会违反拓扑约束

### 内部边界 vs 外部边界

- **内部边界**（共享边界）：必须保持一致性，在两个相邻多边形中同步简化
- **外部边界**（覆盖边界）：可以独立简化，但不能产生自相交

```java
// 也可以分别处理内部和外部边界
CoverageSimplifier simplifier = new CoverageSimplifier(coverage);

// 设置内部边界容差
simplifier.setInnerTolerance(5.0);

// 设置外部边界容差
simplifier.setOuterTolerance(10.0);

Geometry[] result = simplifier.simplify();
```

## 实际应用示例

### 简化行政区划地图

```java
import org.locationtech.jts.coverage.CoverageSimplifier;
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;

// 加载省份多边形
Geometry[] provinces = loadProvinces();

// 首先验证输入是否为有效覆盖
CoverageValidator validator = new CoverageValidator(provinces);
if (!validator.isValid()) {
    System.out.println("警告：输入不是有效覆盖");
    // 可能需要先进行清理
}

// 执行简化（容差为 100 米）
double tolerance = 100.0;
Geometry[] simplified = CoverageSimplifier.simplify(provinces, tolerance);

// 验证简化结果
CoverageValidator resultValidator = new CoverageValidator(simplified);
System.out.println("简化后是否为有效覆盖: " + resultValidator.isValid());

// 计算顶点减少率
int originalVertices = countVertices(provinces);
int simplifiedVertices = countVertices(simplified);
double reduction = (1.0 - (double)simplifiedVertices / originalVertices) * 100;
System.out.println("顶点减少: " + reduction + "%");
```

### 级联简化（多级细节）

```java
// 创建不同简化级别的版本
double[] tolerances = {10.0, 50.0, 100.0, 500.0};

for (double tol : tolerances) {
    Geometry[] simplified = CoverageSimplifier.simplify(coverage, tol);
    saveCoverage(simplified, "coverage_simplified_" + tol + ".geojson");
}
```

## 与其他简化方法的比较

### 传统多边形简化的问题

如果对覆盖中的每个多边形独立应用 Douglas-Peucker 等简化算法：

- 共享边界可能会以不同方式简化
- 产生间隙或重叠
- 破坏拓扑关系

### CoverageSimplifier 的优势

- 保持覆盖的拓扑完整性
- 共享边界同步简化
- 不产生新的间隙或重叠

## 性能考虑

1. **输入要求**：输入必须是有效的多边形覆盖
2. **预处理**：如果输入不是有效覆盖，先使用 `CoverageCleaner` 进行清理
3. **容差选择**：根据数据精度和应用需求选择合适的容差值

## 工作流程建议

```
输入多边形
    ↓
CoverageValidator（验证）
    ↓
CoverageCleaner（如需要，清理）
    ↓
CoverageSimplifier（简化）
    ↓
CoverageValidator（验证结果）
    ↓
输出简化的覆盖
```

## 总结

JTS 的覆盖简化功能为处理边缘匹配的多边形数据提供了强大而可靠的工具。它确保在简化过程中保持拓扑完整性，非常适合 GIS 数据的多尺度表示和数据优化。

## 参考资料

- [JTS Coverage 包文档](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/coverage/package-summary.html)
- [Visvalingam-Whyatt 算法](https://en.wikipedia.org/wiki/Visvalingam%E2%80%93Whyatt_algorithm)
- [JTS GitHub 仓库](https://github.com/locationtech/jts)
