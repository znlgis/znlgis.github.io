---
layout: default
title: Python开发与PyQGIS
---

# 第十四章 Python开发与PyQGIS

## 14.1 PyQGIS简介

### 14.1.1 什么是PyQGIS

PyQGIS是QGIS的Python绑定，提供：
- 完整的QGIS API访问
- 自动化脚本能力
- 插件开发基础
- 独立应用开发

### 14.1.2 QGIS Python环境

```python
# 在QGIS Python控制台中
import sys
print(f"Python版本: {sys.version}")
print(f"QGIS版本: {Qgis.QGIS_VERSION}")
print(f"Qt版本: {qVersion()}")
```

### 14.1.3 访问Python控制台

```
插件 > Python控制台
快捷键: Ctrl+Alt+P
```

## 14.2 核心模块

### 14.2.1 qgis.core

核心功能模块，不依赖GUI：

```python
from qgis.core import (
    QgsProject,           # 项目管理
    QgsVectorLayer,       # 矢量图层
    QgsRasterLayer,       # 栅格图层
    QgsFeature,           # 要素
    QgsGeometry,          # 几何
    QgsField,             # 字段
    QgsCoordinateReferenceSystem,  # CRS
    QgsExpression,        # 表达式
    QgsProcessingAlgorithm  # 处理算法
)
```

### 14.2.2 qgis.gui

GUI组件模块：

```python
from qgis.gui import (
    QgsMapCanvas,         # 地图画布
    QgsMapTool,           # 地图工具
    QgsLayerTreeView,     # 图层树
    QgsAttributeTableView,  # 属性表
    QgsMessageBar         # 消息栏
)
```

### 14.2.3 qgis.analysis

分析功能模块：

```python
from qgis.analysis import (
    QgsNativeAlgorithms,  # 原生算法
    QgsRasterCalculator,  # 栅格计算
    QgsGeometryAnalyzer   # 几何分析
)
```

### 14.2.4 qgis.utils

实用工具：

```python
from qgis.utils import (
    iface,                # 主界面接口
    plugins,              # 已加载插件
    active_plugins        # 活动插件列表
)
```

## 14.3 项目和图层管理

### 14.3.1 项目操作

```python
from qgis.core import QgsProject

project = QgsProject.instance()

# 创建新项目
project.clear()

# 打开项目
project.read('/path/to/project.qgz')

# 保存项目
project.write('/path/to/project.qgz')

# 项目信息
print(f"项目标题: {project.title()}")
print(f"项目路径: {project.fileName()}")
print(f"项目CRS: {project.crs().authid()}")

# 设置项目属性
project.setTitle("我的项目")
project.setCrs(QgsCoordinateReferenceSystem("EPSG:4326"))
```

### 14.3.2 图层管理

```python
# 获取所有图层
layers = project.mapLayers()
for layer_id, layer in layers.items():
    print(f"{layer.name()}: {layer.type()}")

# 按名称获取图层
layer = project.mapLayersByName("图层名称")[0]

# 添加图层
layer = QgsVectorLayer("/path/to/data.shp", "新图层", "ogr")
project.addMapLayer(layer)

# 移除图层
project.removeMapLayer(layer.id())

# 移除所有图层
project.removeAllMapLayers()
```

### 14.3.3 图层树操作

```python
root = project.layerTreeRoot()

# 创建组
group = root.addGroup("我的组")

# 添加图层到组
group.addLayer(layer)

# 设置可见性
node = root.findLayer(layer.id())
node.setItemVisibilityChecked(True)

# 展开/折叠
group.setExpanded(True)
```

## 14.4 矢量数据操作

### 14.4.1 创建矢量图层

```python
from qgis.core import (
    QgsVectorLayer, QgsFeature, QgsGeometry,
    QgsPointXY, QgsField
)
from qgis.PyQt.QtCore import QVariant

# 内存图层
layer = QgsVectorLayer("Point?crs=EPSG:4326", "points", "memory")
provider = layer.dataProvider()

# 添加字段
provider.addAttributes([
    QgsField("id", QVariant.Int),
    QgsField("name", QVariant.String),
    QgsField("value", QVariant.Double)
])
layer.updateFields()

# 添加要素
feature = QgsFeature()
feature.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(116.4, 39.9)))
feature.setAttributes([1, "北京", 100.5])
provider.addFeature(feature)

layer.updateExtents()
```

### 14.4.2 读取要素

```python
# 遍历所有要素
for feature in layer.getFeatures():
    geom = feature.geometry()
    attrs = feature.attributes()
    print(f"ID: {feature.id()}, 几何: {geom.asWkt()}")

# 使用请求过滤
from qgis.core import QgsFeatureRequest

# 按表达式过滤
request = QgsFeatureRequest().setFilterExpression('"population" > 1000000')
for feature in layer.getFeatures(request):
    print(feature['name'])

# 按范围过滤
extent = QgsRectangle(100, 30, 120, 45)
request = QgsFeatureRequest().setFilterRect(extent)

# 只获取特定字段
request = QgsFeatureRequest().setSubsetOfAttributes(['name'], layer.fields())

# 限制数量
request = QgsFeatureRequest().setLimit(10)

# 按FID过滤
request = QgsFeatureRequest().setFilterFid(123)
request = QgsFeatureRequest().setFilterFids([1, 2, 3])
```

### 14.4.3 编辑要素

```python
# 开始编辑
layer.startEditing()

# 添加要素
new_feature = QgsFeature()
new_feature.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(117.0, 40.0)))
new_feature.setAttributes([2, "天津", 200.0])
layer.addFeature(new_feature)

# 修改属性
layer.changeAttributeValue(feature.id(), field_index, new_value)

# 修改几何
layer.changeGeometry(feature.id(), new_geometry)

# 删除要素
layer.deleteFeature(feature.id())

# 保存编辑
layer.commitChanges()

# 或取消编辑
# layer.rollBack()
```

## 14.5 栅格数据操作

### 14.5.1 读取栅格

```python
from qgis.core import QgsRasterLayer

layer = QgsRasterLayer("/path/to/raster.tif", "raster")

# 基本信息
print(f"宽度: {layer.width()}")
print(f"高度: {layer.height()}")
print(f"波段数: {layer.bandCount()}")
print(f"CRS: {layer.crs().authid()}")
print(f"范围: {layer.extent()}")

# 分辨率
print(f"X分辨率: {layer.rasterUnitsPerPixelX()}")
print(f"Y分辨率: {layer.rasterUnitsPerPixelY()}")
```

### 14.5.2 读取像素值

```python
provider = layer.dataProvider()

# 读取单个点的值
point = QgsPointXY(116.4, 39.9)
result = provider.identify(point, QgsRaster.IdentifyFormatValue)
if result.isValid():
    values = result.results()
    for band, value in values.items():
        print(f"波段{band}: {value}")

# 读取数据块
extent = layer.extent()
block = provider.block(1, extent, layer.width(), layer.height())
for row in range(block.height()):
    for col in range(block.width()):
        value = block.value(row, col)
```

### 14.5.3 栅格统计

```python
# 波段统计
stats = provider.bandStatistics(1)
print(f"最小值: {stats.minimumValue}")
print(f"最大值: {stats.maximumValue}")
print(f"平均值: {stats.mean}")
print(f"标准差: {stats.stdDev}")
```

## 14.6 几何操作

### 14.6.1 创建几何

```python
from qgis.core import QgsGeometry, QgsPointXY, QgsPoint

# 点
point = QgsGeometry.fromPointXY(QgsPointXY(116.4, 39.9))
point3d = QgsGeometry.fromPoint(QgsPoint(116.4, 39.9, 100))

# 线
line = QgsGeometry.fromPolylineXY([
    QgsPointXY(116.0, 39.0),
    QgsPointXY(117.0, 39.5),
    QgsPointXY(118.0, 40.0)
])

# 多边形
polygon = QgsGeometry.fromPolygonXY([[
    QgsPointXY(116.0, 39.0),
    QgsPointXY(117.0, 39.0),
    QgsPointXY(117.0, 40.0),
    QgsPointXY(116.0, 40.0),
    QgsPointXY(116.0, 39.0)
]])

# 从WKT创建
geom = QgsGeometry.fromWkt("POINT(116.4 39.9)")

# 从WKB创建
geom = QgsGeometry()
geom.fromWkb(wkb_bytes)
```

### 14.6.2 几何运算

```python
# 缓冲区
buffered = geom.buffer(100, 5)

# 质心
centroid = geom.centroid()

# 边界框
bbox = geom.boundingBox()

# 面积和长度
area = geom.area()
length = geom.length()

# 简化
simplified = geom.simplify(10)

# 凸包
convex = geom.convexHull()

# 叠加运算
intersection = geom1.intersection(geom2)
union = geom1.combine(geom2)
difference = geom1.difference(geom2)
symmetric_diff = geom1.symDifference(geom2)
```

### 14.6.3 空间关系

```python
# 相交
intersects = geom1.intersects(geom2)

# 包含
contains = geom1.contains(geom2)

# 在内部
within = geom1.within(geom2)

# 相等
equals = geom1.equals(geom2)

# 接触
touches = geom1.touches(geom2)

# 重叠
overlaps = geom1.overlaps(geom2)

# 相离
disjoint = geom1.disjoint(geom2)

# 距离
distance = geom1.distance(geom2)
```

## 14.7 坐标转换

### 14.7.1 CRS操作

```python
from qgis.core import QgsCoordinateReferenceSystem

# 创建CRS
crs = QgsCoordinateReferenceSystem("EPSG:4326")
crs = QgsCoordinateReferenceSystem.fromEpsgId(4326)
crs = QgsCoordinateReferenceSystem.fromProj("+proj=longlat +datum=WGS84")

# CRS信息
print(f"描述: {crs.description()}")
print(f"EPSG: {crs.authid()}")
print(f"是否地理: {crs.isGeographic()}")
print(f"单位: {crs.mapUnits()}")
```

### 14.7.2 坐标转换

```python
from qgis.core import QgsCoordinateTransform

source_crs = QgsCoordinateReferenceSystem("EPSG:4326")
dest_crs = QgsCoordinateReferenceSystem("EPSG:32650")

transform = QgsCoordinateTransform(source_crs, dest_crs, project)

# 转换点
point = QgsPointXY(116.4, 39.9)
transformed = transform.transform(point)

# 转换范围
extent = QgsRectangle(116, 39, 117, 40)
transformed_extent = transform.transformBoundingBox(extent)

# 转换几何
geom = QgsGeometry.fromPointXY(point)
geom.transform(transform)
```

## 14.8 表达式和脚本

### 14.8.1 使用表达式

```python
from qgis.core import QgsExpression, QgsExpressionContext, QgsExpressionContextUtils

# 创建表达式
expression = QgsExpression('"population" * 1000')

# 创建上下文
context = QgsExpressionContext()
context.appendScopes(QgsExpressionContextUtils.globalProjectLayerScopes(layer))

# 计算值
for feature in layer.getFeatures():
    context.setFeature(feature)
    value = expression.evaluate(context)
    print(value)
```

### 14.8.2 自定义函数

```python
from qgis.core import qgsfunction

@qgsfunction(args='auto', group='Custom')
def my_sum(value1, value2, feature, parent):
    """
    计算两个值的和
    <h4>语法</h4>
    my_sum(value1, value2)
    """
    return value1 + value2

# 注册函数
QgsExpression.registerFunction(my_sum)

# 使用后注销
# QgsExpression.unregisterFunction('my_sum')
```

## 14.9 消息和日志

### 14.9.1 消息栏

```python
from qgis.core import Qgis

# 显示消息
iface.messageBar().pushMessage(
    "标题",
    "消息内容",
    level=Qgis.Info,
    duration=5
)

# 消息级别
# Qgis.Info - 信息
# Qgis.Warning - 警告
# Qgis.Critical - 错误
# Qgis.Success - 成功
```

### 14.9.2 日志

```python
from qgis.core import QgsMessageLog, Qgis

QgsMessageLog.logMessage(
    "日志消息",
    tag="MyPlugin",
    level=Qgis.Info
)
```

## 14.10 独立应用

### 14.10.1 独立脚本模板

```python
#!/usr/bin/env python3
"""独立PyQGIS脚本"""

from qgis.core import (
    QgsApplication,
    QgsProject,
    QgsVectorLayer
)

# 初始化QGIS应用
QgsApplication.setPrefixPath("/usr", True)
qgs = QgsApplication([], False)
qgs.initQgis()

# 你的代码
layer = QgsVectorLayer("/path/to/data.shp", "layer", "ogr")
if layer.isValid():
    print(f"要素数: {layer.featureCount()}")

# 清理
qgs.exitQgis()
```

### 14.10.2 带GUI的独立应用

```python
from qgis.core import QgsApplication
from qgis.gui import QgsMapCanvas
from qgis.PyQt.QtWidgets import QMainWindow, QApplication

class MyApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.canvas = QgsMapCanvas()
        self.setCentralWidget(self.canvas)
        self.setWindowTitle("我的GIS应用")
        self.resize(800, 600)

if __name__ == "__main__":
    QgsApplication.setPrefixPath("/usr", True)
    app = QApplication([])
    qgs = QgsApplication([], True)
    qgs.initQgis()
    
    window = MyApp()
    window.show()
    
    app.exec_()
    qgs.exitQgis()
```

## 14.11 调试技巧

### 14.11.1 打印调试

```python
# 使用print
print(f"变量值: {variable}")

# 使用日志
QgsMessageLog.logMessage(f"Debug: {variable}", "Debug")
```

### 14.11.2 使用IDE

- **PyCharm**：配置QGIS Python解释器
- **VS Code**：使用Python扩展
- **Eclipse + PyDev**

### 14.11.3 远程调试

```python
# 使用pydevd
import pydevd_pycharm
pydevd_pycharm.settrace('localhost', port=5678)
```

## 14.12 小结

本章详细介绍了PyQGIS开发：

**关键要点**：
1. 理解PyQGIS模块结构
2. 掌握项目和图层管理
3. 熟练操作矢量和栅格数据
4. 了解几何操作和坐标转换
5. 能够使用表达式和自定义函数
6. 掌握独立应用开发

PyQGIS是QGIS自动化和扩展的基础。

---

**上一章**：[第13章 Processing工具箱](https://znlgis.github.io/gis/tutorial/qgis/第13章-Processing工具箱/)

**下一章**：[第15章 插件开发指南](https://znlgis.github.io/gis/tutorial/qgis/第15章-插件开发指南/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/qgis/第13章-Processing工具箱/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/qgis/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/qgis/第15章-插件开发指南/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
