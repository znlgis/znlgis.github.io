---
layout: default
title: geometry-api-net 教程
---

# geometry-api-net 教程

欢迎阅读 geometry-api-net 完整教程！本教程将帮助您全面掌握这个强大的 .NET 几何计算库。

## 教程目录

### 基础篇

1. **[第一章：项目概述与框架理念](第01章-项目概述与框架理念)**
   - 项目简介与技术规格
   - 核心设计理念：操作符单例模式
   - 项目架构与功能清单

2. **[第二章：快速开始指南](第02章-快速开始指南)**
   - 环境准备与项目构建
   - 第一个程序
   - 核心 API 快速预览
   - 常见使用场景

3. **[第三章：核心几何类型详解](第03章-核心几何类型详解)**
   - Geometry 抽象基类
   - Point、MultiPoint
   - Line、Polyline
   - Polygon、Envelope
   - MapGeometry

### 操作符篇

4. **[第四章：空间关系操作符](第04章-空间关系操作符)**
   - Contains、Intersects、Distance
   - Equals、Disjoint、Within
   - Crosses、Touches、Overlaps
   - 光线投射算法详解

5. **[第五章：几何运算操作符](第05章-几何运算操作符)**
   - Buffer（缓冲区）
   - ConvexHull（凸包）
   - Area、Length（面积、长度）
   - Simplify（简化）- Douglas-Peucker 算法
   - Centroid、Boundary
   - Generalize、Densify、Clip、Offset

6. **[第六章：集合操作符](第06章-集合操作符)**
   - Union（并集）
   - Intersection（交集）
   - Difference（差集）
   - SymmetricDifference（对称差）

### 数据篇

7. **[第七章：数据格式导入导出](第07章-数据格式导入导出)**
   - WKT（Well-Known Text）
   - WKB（Well-Known Binary）
   - GeoJSON
   - Esri JSON
   - 格式转换最佳实践

8. **[第八章：空间参考系统](第08章-空间参考系统)**
   - WGS 84 与 Web Mercator
   - SpatialReference 类
   - 大地测量计算
   - 坐标转换基础

### 高级篇

9. **[第九章：邻近分析与位置服务](第09章-邻近分析与位置服务)**
   - GetNearestCoordinate
   - GetNearestVertex
   - GetNearestVertices
   - 实际应用案例

10. **[第十章：高级应用与性能优化](第10章-高级应用与性能优化)**
    - 架构最佳实践
    - 性能优化技巧
    - 错误处理
    - 测试策略

### 实践篇

11. **[第十一章：实战案例](第11章-实战案例)**
    - 案例一：位置服务系统
    - 案例二：轨迹分析系统
    - 案例三：区域分析系统

12. **[第十二章：API 参考手册](第12章-API参考手册)**
    - 完整 API 参考
    - 所有几何类型
    - 所有操作符
    - GeometryEngine 静态方法

## 快速链接

### 常用 API

```csharp
// 几何创建
var point = new Point(x, y);
var polygon = new Polygon();
polygon.AddRing(points);

// 空间关系测试
bool contains = GeometryEngine.Contains(polygon, point);
bool intersects = GeometryEngine.Intersects(g1, g2);
double distance = GeometryEngine.GeodesicDistance(p1, p2);

// 几何运算
var buffer = GeometryEngine.Buffer(point, distance);
var simplified = GeometryEngine.Simplify(polyline, tolerance);
var union = GeometryEngine.Union(g1, g2);

// 数据格式
string wkt = GeometryEngine.GeometryToWkt(geometry);
string json = GeometryEngine.GeometryToGeoJson(geometry);
```

### 项目资源

- **源代码**: [github.com/znlgis/geometry-api-net](https://github.com/znlgis/geometry-api-net)
- **许可证**: LGPL 2.1
- **目标框架**: .NET Standard 2.0
- **测试覆盖**: 255+ 测试用例

## 开始学习

建议按顺序阅读本教程，特别是如果您是 GIS 开发新手。每章都包含：

- 概念讲解
- API 说明
- 代码示例
- 实现原理（针对核心算法）
- 最佳实践

**祝您学习愉快！**
