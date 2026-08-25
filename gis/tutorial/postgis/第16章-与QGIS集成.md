---
layout: default
title: 第16章：与 QGIS 集成
---

# 第16章：与 QGIS 集成

## 16.1 概述

QGIS 是功能强大的开源桌面 GIS 软件，与 PostGIS 有着深度集成，支持直接编辑和分析 PostGIS 数据。

## 16.2 连接 PostGIS

### 16.2.1 创建连接

```
1. 打开 QGIS
2. 浏览器面板 → PostgreSQL → 右键 → 新建连接
3. 填写连接信息：
   - 名称: PostGIS_Local
   - 主机: localhost
   - 端口: 5432
   - 数据库: gis_db
   - 用户名: postgres
   - 密码: ******
4. 测试连接 → 确定
```

### 16.2.2 加载数据

```
1. 展开 PostgreSQL 连接
2. 展开数据库和模式
3. 双击表名或拖拽到地图画布
4. 或使用 图层 → 添加图层 → 添加 PostGIS 图层
```

### 16.2.3 使用 DB Manager

```
1. 数据库 → DB 管理器
2. 选择 PostGIS 连接
3. 功能：
   - 浏览表结构
   - 执行 SQL 查询
   - 导入导出数据
   - 创建空间索引
   - 查看表统计信息
```

## 16.3 数据编辑

### 16.3.1 启用编辑

```
1. 选择 PostGIS 图层
2. 图层 → 切换编辑 或 点击编辑按钮
3. 使用数字化工具编辑要素
4. 保存编辑 → 自动同步到数据库
```

### 16.3.2 编辑工具

- **添加要素**：点、线、面
- **移动要素**
- **节点编辑**
- **分割要素**
- **合并要素**
- **删除要素**
- **属性编辑**

### 16.3.3 事务支持

```
1. 设置 → 选项 → 数据源
2. 启用 "对 PostgreSQL 使用单次事务编辑"
3. 多个编辑操作在一个事务中完成
```

## 16.4 空间查询

### 16.4.1 使用 DB Manager 执行 SQL

```sql
-- 在 DB Manager 中执行 PostGIS 查询
SELECT name, ST_Area(geom::geography) AS area_m2
FROM districts
WHERE ST_Intersects(geom, ST_MakeEnvelope(116, 39, 117, 40, 4326));

-- 将结果加载为图层
-- 勾选 "将结果加载为新图层"
-- 设置几何列和主键
```

### 16.4.2 创建虚拟图层

```sql
-- 使用虚拟图层执行 PostGIS 函数
SELECT 
    p.id,
    p.name,
    d.name AS district,
    p.geometry
FROM poi AS p
JOIN districts AS d ON ST_Contains(d.geometry, p.geometry)
```

## 16.5 处理工具

### 16.5.1 调用 PostGIS 函数

QGIS 处理工具箱中集成了 PostGIS 函数：

```
处理 → 工具箱 → Database → 
  - 执行 SQL
  - 导入到 PostGIS
  - 从 PostGIS 导出
  - PostGIS 缓冲区
  - PostGIS 溶解
```

### 16.5.2 批处理

```python
# 使用 Python 控制台批量处理
from qgis.core import QgsDataSourceUri, QgsVectorLayer

uri = QgsDataSourceUri()
uri.setConnection("localhost", "5432", "gis_db", "postgres", "password")
uri.setDataSource("public", "poi", "geom", "", "id")

layer = QgsVectorLayer(uri.uri(), "poi", "postgres")
```

## 16.6 样式和符号

### 16.6.1 保存样式到数据库

```
1. 设置图层样式
2. 图层 → 属性 → 样式 → 样式 → 保存样式
3. 选择 "保存到数据库"
4. 设置样式名称和描述
```

### 16.6.2 加载数据库样式

```
1. 图层 → 属性 → 样式 → 样式 → 加载样式
2. 选择 "从数据库加载"
3. 选择样式
```

## 16.7 数据导入导出

### 16.7.1 导入到 PostGIS

```
1. 使用 DB Manager
   - 表 → 导入图层/文件
   - 选择源图层
   - 设置目标表名
   - 配置选项（SRID、主键、索引）

2. 使用处理工具
   - 处理 → 工具箱 → Database → 导入到 PostGIS

3. 使用拖放
   - 将图层拖到 DB Manager 中的模式
```

### 16.7.2 从 PostGIS 导出

```
1. 右键图层 → 导出 → 保存要素为
2. 选择格式（Shapefile、GeoJSON、GeoPackage 等）
3. 设置导出选项
```

## 16.8 性能优化

### 16.8.1 图层优化

```
1. 使用空间过滤
   - 图层属性 → 源 → 要素子集
   - 输入 PostGIS 过滤表达式
   
2. 简化几何显示
   - 图层属性 → 渲染 → 在渲染时简化几何图形
   
3. 使用预计算视图
   - 为复杂查询创建物化视图
```

### 16.8.2 渲染优化

```
1. 设置比例尺可见性
2. 使用缓存
3. 启用并行渲染
4. 使用瓦片图层
```

## 16.9 Python 脚本

### 16.9.1 PyQGIS 连接 PostGIS

```python
from qgis.core import QgsDataSourceUri, QgsVectorLayer, QgsProject

# 创建连接
uri = QgsDataSourceUri()
uri.setConnection("localhost", "5432", "gis_db", "postgres", "password")
uri.setDataSource("public", "poi", "geom", "category='餐饮'", "id")

# 创建图层
layer = QgsVectorLayer(uri.uri(), "餐饮POI", "postgres")

# 添加到项目
QgsProject.instance().addMapLayer(layer)

# 执行 PostGIS 查询
uri.setDataSource("public", "", "geom", "", "id")
uri.setParam('sql', """
    SELECT id, name, ST_Buffer(geom::geography, 500)::geometry AS geom
    FROM poi WHERE category = '医院'
""")
buffer_layer = QgsVectorLayer(uri.uri(), "医院服务区", "postgres")
```

### 16.9.2 批量处理

```python
import processing
from qgis.core import QgsVectorLayer

# 使用处理算法
result = processing.run("native:buffer", {
    'INPUT': 'postgres://host=localhost dbname=gis_db user=postgres password=password table="public"."poi" (geom)',
    'DISTANCE': 100,
    'OUTPUT': 'memory:'
})

# 导入到 PostGIS
processing.run("qgis:importintopostgis", {
    'INPUT': result['OUTPUT'],
    'DATABASE': 'gis_db',
    'SCHEMA': 'public',
    'TABLENAME': 'poi_buffer',
    'PRIMARY_KEY': 'id',
    'GEOMETRY_COLUMN': 'geom'
})
```

## 16.10 本章小结

本章详细介绍了 QGIS 与 PostGIS 的集成：

1. **连接配置**：创建数据库连接
2. **数据编辑**：直接编辑 PostGIS 数据
3. **空间查询**：DB Manager 和虚拟图层
4. **处理工具**：调用 PostGIS 函数
5. **样式管理**：数据库样式存储
6. **数据交换**：导入导出
7. **Python 脚本**：自动化处理

## 16.11 下一步

在下一章中，我们将学习编程语言集成，包括：

- Python 连接 PostGIS
- Java 连接 PostGIS
- .NET 连接 PostGIS

---

**相关资源**：
- [QGIS 文档](https://docs.qgis.org/)
- [PyQGIS 开发者手册](https://docs.qgis.org/3.28/en/docs/pyqgis_developer_cookbook/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/postgis/第15章-与GeoServer集成/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/postgis/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/postgis/第17章-编程语言集成/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
