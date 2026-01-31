---
layout: post
title: "JTS TestBuilder - 几何图形的多功能工具"
date: 2029-07-22 10:00:00 +0800
categories: [GIS, JTS]
tags: [JTS]
---

# JTS TestBuilder - 几何图形的多功能工具

> 原文：[JTS TestBuilder](https://lin-ear-th-inking.blogspot.com/2019/08/)
> 作者：Martin Davis
> 日期：2019年8月

## 概述

JTS TestBuilder 是一个强大的图形用户界面 (GUI) 应用程序，用于可视化、创建、编辑和测试 JTS 几何操作。它是开发人员和研究人员在计算几何、GIS 和空间分析领域的必备工具。

## 主要功能

### 1. 几何可视化

TestBuilder 提供了强大的几何可视化功能：

- **多种显示模式**：填充、描边、点
- **样式定制**：颜色、线宽、透明度
- **层叠显示**：同时显示多个几何图形
- **缩放和平移**：灵活的视图控制

### 2. 几何创建和编辑

可以通过多种方式创建和编辑几何图形：

- **手动绘制**：使用鼠标绘制点、线、多边形
- **WKT 输入**：直接输入 Well-Known Text 格式
- **WKB 导入**：导入 Well-Known Binary 数据
- **文件导入**：支持 GeoJSON、GML、Shapefile 等格式

### 3. 几何操作测试

测试各种 JTS 几何操作：

- **构造操作**：缓冲区、凸包、边界
- **集合操作**：并集、交集、差集
- **空间关系**：相交、包含、覆盖
- **测量操作**：面积、长度、距离

### 4. 调试工具

- **段标签**：显示线段编号和方向
- **方向箭头**：显示环的方向
- **拓扑揭示**：放大显示微小的几何差异
- **验证面板**：检查几何有效性

## 界面组成

### 主窗口

```
+-----------------------------------------------+
|  菜单栏                                        |
+-----------------------------------------------+
|                    |                          |
|    几何显示区域     |     操作面板              |
|                    |     - 输入几何 A          |
|                    |     - 输入几何 B          |
|                    |     - 操作选择            |
|                    |     - 结果显示            |
|                    |                          |
+-----------------------------------------------+
|  状态栏                                        |
+-----------------------------------------------+
```

### 几何输入面板

```java
// 示例：输入两个几何图形进行操作
// 几何 A
POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))

// 几何 B
POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))
```

### 操作面板

支持的操作类别：

| 类别 | 操作 |
|------|------|
| 构造 | Buffer, ConvexHull, Boundary, Centroid |
| 集合 | Union, Intersection, Difference, SymDifference |
| 关系 | Intersects, Contains, Covers, Touches |
| 测量 | Area, Length, Distance |
| 简化 | DouglasPeucker, TopologyPreserving |
| 验证 | IsValid, IsSimple |

## 使用示例

### 示例1：测试缓冲区操作

1. 在几何 A 输入框中输入：
   ```
   LINESTRING (0 0, 10 10, 20 0)
   ```

2. 选择操作：**Geometry Functions** → **Buffer**

3. 设置参数：距离 = 2.0

4. 点击执行，查看结果

### 示例2：测试交集操作

1. 输入几何 A：
   ```
   POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))
   ```

2. 输入几何 B：
   ```
   POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))
   ```

3. 选择操作：**Binary Geometry Functions** → **Intersection**

4. 查看交集结果

### 示例3：验证几何有效性

1. 输入可能无效的几何：
   ```
   POLYGON ((0 0, 10 10, 10 0, 0 10, 0 0))
   ```

2. 选择操作：**Validation Functions** → **IsValid**

3. 查看验证结果和错误详情

## 高级功能

### Inspector 视图

Inspector 视图提供几何图形的详细信息：

- **层次结构**：显示几何组件
- **线段列表**：列出所有线段
- **顶点坐标**：显示所有顶点
- **度量信息**：面积、长度等

### RevealTopology 模式

这是一个特别有用的调试功能：

- **放大微小差异**：视觉上夸大几何图形之间的微小差异
- **发现隐藏问题**：帮助发现肉眼难以察觉的拓扑问题
- **线条对齐检查**：检查看似重合的线是否真正重合

### 批量测试

TestBuilder 支持批量测试用例：

```xml
<!-- 测试用例文件示例 -->
<case>
  <desc>缓冲区测试</desc>
  <a>
    LINESTRING (0 0, 10 10)
  </a>
  <test>
    <op name="buffer" arg1="A" arg2="1.0">
      POLYGON (...)
    </op>
  </test>
</case>
```

## 安装和运行

### 命令行启动

```bash
# 从 JTS 发布版本运行
java -jar jts-app.jar

# 或使用 Maven
mvn exec:java -Dexec.mainClass="org.locationtech.jts.app.JtsTestBuilder"
```

### IDE 集成

JTS TestBuilder 可以集成到 JetBrains IDE 中：

1. 安装 "JTS Test Builder" 插件
2. 在 IDE 中直接打开 TestBuilder
3. 支持从代码中快速测试几何

## 实用技巧

### 1. 使用键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+A | 选择几何 A |
| Ctrl+B | 选择几何 B |
| Ctrl+E | 执行操作 |
| Ctrl+Z | 撤销 |

### 2. 调试复杂几何

当处理复杂几何时：

1. 使用 Inspector 视图检查详细结构
2. 启用 RevealTopology 模式
3. 逐步分解几何进行测试

### 3. 性能分析

TestBuilder 可以用于性能分析：

1. 在大量数据上运行操作
2. 观察执行时间
3. 比较不同算法的性能

## 与开发工作流集成

### 单元测试生成

可以使用 TestBuilder 生成测试用例：

```java
// 从 TestBuilder 导出的测试用例
@Test
public void testIntersection() {
    WKTReader reader = new WKTReader();
    Geometry a = reader.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
    Geometry b = reader.read("POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))");
    
    Geometry expected = reader.read("POLYGON ((5 5, 10 5, 10 10, 5 10, 5 5))");
    Geometry result = a.intersection(b);
    
    assertTrue(expected.equalsExact(result, 0.0001));
}
```

### 问题重现

当遇到几何处理问题时：

1. 在 TestBuilder 中重现问题
2. 使用 Inspector 分析原因
3. 测试修复方案

## 总结

JTS TestBuilder 是一个不可或缺的工具：

- **可视化**：直观地查看几何图形
- **测试**：交互式测试 JTS 操作
- **调试**：发现和诊断几何问题
- **学习**：理解空间算法的工作原理

对于任何使用 JTS 进行空间开发的人员，TestBuilder 都是必备工具。

## 参考资料

- [JTS TestBuilder 文档](https://github.com/locationtech/jts/blob/master/doc/JTSTestBuilder.md)
- [JTS GitHub 仓库](https://github.com/locationtech/jts)
- [JetBrains IDE 插件](https://plugins.jetbrains.com/plugin/21252-jts-test-builder)
- [Eclipse Newsletter - JTS TestBuilder](https://www.eclipse.org/community/eclipse_newsletter/2018/december/jts.php)
