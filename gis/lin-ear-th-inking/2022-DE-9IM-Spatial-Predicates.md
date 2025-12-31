# DE-9IM 空间谓词的关系属性

> 原文：[Relational Properties of DE-9IM spatial predicates](https://lin-ear-th-inking.blogspot.com/2022/10/)
> 作者：Martin Davis
> 日期：2022年10月

## 概述

本文深入探讨了 DE-9IM（维度扩展的 9 交集模型）空间谓词的数学理论，包括它们在自反性、对称性和传递性方面的分类。这些属性对于理解和正确使用空间关系至关重要。

## DE-9IM 模型回顾

DE-9IM 是 OGC（开放地理空间联盟）定义的标准空间关系模型。它通过比较两个几何图形的内部（Interior）、边界（Boundary）和外部（Exterior）来描述它们之间的关系。

### 9 交集矩阵

```
           几何 B
          I    B    E
    I [ dim  dim  dim ]
几何 A
    B [ dim  dim  dim ]
    
    E [ dim  dim  dim ]
```

其中：
- I = Interior（内部）
- B = Boundary（边界）
- E = Exterior（外部）
- dim = 交集的维度（-1=空, 0=点, 1=线, 2=面）

## 标准空间谓词

DE-9IM 定义了以下标准空间谓词：

| 谓词 | 描述 | DE-9IM 模式 |
|------|------|------------|
| Equals | 拓扑相等 | T*F**FFF* |
| Disjoint | 不相交 | FF*FF**** |
| Intersects | 相交 | T******** 或 *T******* 或 ***T***** 或 ****T**** |
| Touches | 接触 | FT******* 或 F**T***** 或 F***T**** |
| Crosses | 交叉 | 取决于几何类型 |
| Within | A 在 B 内部 | T*F**F*** |
| Contains | A 包含 B | T*****FF* |
| Overlaps | 重叠 | 取决于几何类型 |
| Covers | A 覆盖 B | T*****FF* 或 *T****FF* 或 ***T**FF* 或 ****T*FF* |
| CoveredBy | A 被 B 覆盖 | T*F**F*** 或 *TF**F*** 或 **FT*F*** 或 **F*TF*** |

## 关系属性分类

### 1. 自反性（Reflexivity）

自反关系是指几何图形与自身的关系。

#### 自反谓词（Reflexive）
对于任意几何 A：R(A, A) = true

- **Equals**: A.equals(A) = true
- **Intersects**: A.intersects(A) = true
- **Covers**: A.covers(A) = true
- **CoveredBy**: A.coveredBy(A) = true

#### 非自反谓词（Irreflexive）
对于任意几何 A：R(A, A) = false

- **Disjoint**: A.disjoint(A) = false
- **Touches**: A.touches(A) = false
- **Crosses**: A.crosses(A) = false
- **Overlaps**: A.overlaps(A) = false

### 2. 对称性（Symmetry）

对称关系是指关系在交换操作数后保持不变。

#### 对称谓词（Symmetric）
R(A, B) = R(B, A)

- **Equals**: A.equals(B) ⟺ B.equals(A)
- **Disjoint**: A.disjoint(B) ⟺ B.disjoint(A)
- **Intersects**: A.intersects(B) ⟺ B.intersects(A)
- **Touches**: A.touches(B) ⟺ B.touches(A)
- **Crosses**: A.crosses(B) ⟺ B.crosses(A)
- **Overlaps**: A.overlaps(B) ⟺ B.overlaps(A)

#### 非对称谓词（Asymmetric）
R(A, B) ≠ R(B, A)（一般情况下）

- **Within/Contains**: A.within(B) ⟺ B.contains(A)
- **Covers/CoveredBy**: A.covers(B) ⟺ B.coveredBy(A)

### 3. 传递性（Transitivity）

传递关系是指如果 R(A, B) 和 R(B, C) 为真，则 R(A, C) 也为真。

#### 传递谓词（Transitive）
R(A, B) ∧ R(B, C) → R(A, C)

- **Equals**: A.equals(B) ∧ B.equals(C) → A.equals(C)
- **Within**: A.within(B) ∧ B.within(C) → A.within(C)
- **Contains**: A.contains(B) ∧ B.contains(C) → A.contains(C)
- **Covers**: A.covers(B) ∧ B.covers(C) → A.covers(C)
- **CoveredBy**: A.coveredBy(B) ∧ B.coveredBy(C) → A.coveredBy(C)

#### 非传递谓词（Non-transitive）
- **Intersects**: A.intersects(B) ∧ B.intersects(C) ↛ A.intersects(C)
- **Touches**: A.touches(B) ∧ B.touches(C) ↛ A.touches(C)
- **Overlaps**: A.overlaps(B) ∧ B.overlaps(C) ↛ A.overlaps(C)

## 属性汇总表

| 谓词 | 自反性 | 对称性 | 传递性 |
|------|--------|--------|--------|
| Equals | ✓ | ✓ | ✓ |
| Disjoint | ✗ | ✓ | ✗ |
| Intersects | ✓ | ✓ | ✗ |
| Touches | ✗ | ✓ | ✗ |
| Crosses | ✗ | ✓ | ✗ |
| Within | ✓ | ✗ | ✓ |
| Contains | ✓ | ✗ | ✓ |
| Overlaps | ✗ | ✓ | ✗ |
| Covers | ✓ | ✗ | ✓ |
| CoveredBy | ✓ | ✗ | ✓ |

## 实际应用

### 1. 空间查询优化

了解谓词的传递性可以优化空间查询：

```java
// 利用 Contains 的传递性优化嵌套查询
// 如果已知 A contains B 且 B contains C
// 则无需测试 A contains C（一定为 true）

boolean aContainsB = a.contains(b);
boolean bContainsC = b.contains(c);

// 利用传递性跳过测试
if (aContainsB && bContainsC) {
    // a.contains(c) 必然为 true
    aContainsC = true;
}
```

### 2. 空间索引设计

对称谓词可以简化空间索引的设计：

```java
// 对于对称谓词，只需要单向索引
// A.intersects(B) = B.intersects(A)

// 非对称谓词需要注意方向
// A.within(B) != B.within(A)
```

### 3. 数据验证

利用自反性进行数据验证：

```java
// 每个几何图形应该与自身相等
for (Geometry g : geometries) {
    if (!g.equals(g)) {
        System.out.println("警告：几何图形不与自身相等（可能存在问题）");
    }
}
```

## 补充谓词

除了标准谓词外，DE-9IM 还支持自定义谓词：

```java
// 使用自定义 DE-9IM 模式
String customPattern = "T*T***T**";  // 自定义关系
boolean matches = geomA.relate(geomB, customPattern);
```

## 总结

理解 DE-9IM 空间谓词的数学属性对于正确使用空间关系至关重要。自反性、对称性和传递性的知识可以帮助优化空间查询、设计更好的空间索引，并避免常见的逻辑错误。

## 参考资料

- [DE-9IM 维基百科](https://en.wikipedia.org/wiki/DE-9IM)
- [OGC Simple Features 规范](https://www.ogc.org/standards/sfa)
- [PostGIS DE-9IM 教程](https://postgis.net/workshops/postgis-intro/de9im.html)
