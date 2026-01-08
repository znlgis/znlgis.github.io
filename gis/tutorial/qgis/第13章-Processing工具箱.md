---
layout: default
title: Processing工具箱
---

# 第十三章 Processing工具箱

## 13.1 Processing框架概述

### 13.1.1 什么是Processing框架

Processing是QGIS的地理处理框架，提供：
- 统一的算法接口
- 批处理能力
- 模型设计器
- 脚本集成
- 历史记录

### 13.1.2 框架架构

```
Processing Framework
├── QgsProcessingRegistry (注册表)
│   └── QgsProcessingProvider (提供者)
│       └── QgsProcessingAlgorithm (算法)
├── QgsProcessingContext (上下文)
├── QgsProcessingFeedback (反馈)
└── GUI组件
    ├── Processing Toolbox (工具箱)
    ├── Algorithm Dialog (算法对话框)
    └── Graphical Modeler (模型设计器)
```

### 13.1.3 打开工具箱

```
处理 > 工具箱
或 Ctrl+Alt+T
```

## 13.2 工具箱结构

### 13.2.1 算法提供者

| 提供者 | 说明 | 算法数 |
|--------|------|--------|
| QGIS | 原生算法 | 200+ |
| GDAL | GDAL/OGR工具 | 50+ |
| GRASS | GRASS GIS | 500+ |
| SAGA | SAGA GIS | 300+ |
| Scripts | 用户脚本 | 自定义 |
| Models | 处理模型 | 自定义 |

### 13.2.2 搜索算法

```python
import processing

# 搜索算法
for alg in QgsApplication.processingRegistry().algorithms():
    if 'buffer' in alg.displayName().lower():
        print(f"{alg.id()}: {alg.displayName()}")
```

### 13.2.3 获取算法帮助

```python
# 获取算法帮助
processing.algorithmHelp("native:buffer")

# 获取算法参数定义
alg = QgsApplication.processingRegistry().algorithmById("native:buffer")
for param in alg.parameterDefinitions():
    print(f"{param.name()}: {param.description()}")
```

## 13.3 运行算法

### 13.3.1 使用GUI运行

1. 在工具箱中找到算法
2. 双击打开对话框
3. 设置参数
4. 点击运行

### 13.3.2 使用Python运行

```python
import processing

# 基本调用
result = processing.run("native:buffer", {
    'INPUT': layer,
    'DISTANCE': 100,
    'OUTPUT': 'memory:'
})

# 获取输出图层
output_layer = result['OUTPUT']

# 添加到项目
QgsProject.instance().addMapLayer(output_layer)
```

### 13.3.3 运行并加载结果

```python
# 自动加载结果
result = processing.runAndLoadResults("native:buffer", {
    'INPUT': layer,
    'DISTANCE': 100,
    'OUTPUT': 'memory:'
})
```

### 13.3.4 参数类型

| 参数类型 | 常量 | Python类型 |
|---------|------|-----------|
| 矢量图层 | SOURCE | QgsVectorLayer/str |
| 栅格图层 | RASTER | QgsRasterLayer/str |
| 数值 | NUMBER | int/float |
| 字符串 | STRING | str |
| 布尔 | BOOLEAN | bool |
| 枚举 | ENUM | int |
| 字段 | FIELD | str |
| 范围 | EXTENT | str/QgsRectangle |
| CRS | CRS | str/QgsCRS |
| 输出 | SINK | str |

## 13.4 批处理

### 13.4.1 GUI批处理

1. 右键算法 > 作为批处理执行
2. 添加多行输入
3. 配置输出命名
4. 运行

### 13.4.2 Python批处理

```python
import processing

# 批量缓冲多个图层
layers = ['layer1.shp', 'layer2.shp', 'layer3.shp']
distances = [100, 200, 300]

for layer_path, dist in zip(layers, distances):
    result = processing.run("native:buffer", {
        'INPUT': layer_path,
        'DISTANCE': dist,
        'OUTPUT': layer_path.replace('.shp', f'_buffer_{dist}.shp')
    })
```

### 13.4.3 使用迭代器

```python
# 对图层中的每个要素分别处理
for feature in layer.getFeatures():
    # 提取单个要素
    temp = QgsVectorLayer("Point?crs=EPSG:4326", "temp", "memory")
    temp.dataProvider().addFeature(feature)
    
    # 处理
    result = processing.run("native:buffer", {
        'INPUT': temp,
        'DISTANCE': 100,
        'OUTPUT': f'/output/buffer_{feature.id()}.shp'
    })
```

## 13.5 模型设计器

### 13.5.1 打开模型设计器

```
处理 > 模型设计器
```

### 13.5.2 模型组件

**输入**：
- 矢量图层
- 栅格图层
- 数值
- 字符串
- 范围
- CRS
- 等等

**算法**：
- 任何Processing算法
- 其他模型

**输出**：
- 矢量输出
- 栅格输出

### 13.5.3 创建模型示例

```
模型：缓冲区并裁剪

输入:
├── 点图层 (points_input)
├── 裁剪范围 (clip_layer)
└── 缓冲距离 (buffer_distance)

算法流程:
1. Buffer (native:buffer)
   └── 输入: points_input
   └── 距离: buffer_distance
   └── 输出: buffered

2. Clip (native:clip)
   └── 输入: buffered
   └── 覆盖: clip_layer
   └── 输出: final_output

输出:
└── 裁剪后的缓冲区 (final_output)
```

### 13.5.4 保存和使用模型

```python
# 模型保存为 .model3 文件
# 默认位置: ~/.local/share/QGIS/QGIS3/profiles/default/processing/models/

# 使用模型
result = processing.run("model:my_model", {
    'points_input': point_layer,
    'clip_layer': clip_polygon,
    'buffer_distance': 500,
    'final_output': 'memory:'
})
```

### 13.5.5 导出模型为Python

```python
# 在模型设计器中：
# 编辑 > 导出为Python脚本

# 生成的脚本示例：
from qgis.core import QgsProcessingAlgorithm

class MyModel(QgsProcessingAlgorithm):
    def processAlgorithm(self, parameters, context, feedback):
        # 算法代码
        pass
```

## 13.6 自定义脚本

### 13.6.1 脚本结构

```python
from qgis.processing import alg

@alg(name='myscript', label='My Custom Script',
     group='My Tools', group_label='My Tools')
@alg.input(type=alg.SOURCE, name='INPUT', label='Input layer')
@alg.input(type=alg.NUMBER, name='VALUE', label='Value', default=10)
@alg.input(type=alg.SINK, name='OUTPUT', label='Output layer')
def process_algorithm(instance, parameters, context, feedback, inputs):
    """
    自定义处理脚本
    """
    source = instance.parameterAsSource(parameters, 'INPUT', context)
    value = instance.parameterAsDouble(parameters, 'VALUE', context)
    
    (sink, dest_id) = instance.parameterAsSink(
        parameters, 'OUTPUT', context,
        source.fields(),
        source.wkbType(),
        source.sourceCrs()
    )
    
    total = source.featureCount()
    for current, feature in enumerate(source.getFeatures()):
        if feedback.isCanceled():
            break
            
        # 处理逻辑
        new_feature = QgsFeature(feature)
        # 修改要素...
        
        sink.addFeature(new_feature)
        feedback.setProgress(int(current / total * 100))
    
    return {'OUTPUT': dest_id}
```

### 13.6.2 完整算法类

```python
from qgis.core import (
    QgsProcessingAlgorithm,
    QgsProcessingParameterFeatureSource,
    QgsProcessingParameterNumber,
    QgsProcessingParameterFeatureSink,
    QgsFeature
)

class MyAlgorithm(QgsProcessingAlgorithm):
    INPUT = 'INPUT'
    OUTPUT = 'OUTPUT'
    BUFFER_DISTANCE = 'BUFFER_DISTANCE'
    
    def createInstance(self):
        return MyAlgorithm()
    
    def name(self):
        return 'myalgorithm'
    
    def displayName(self):
        return '我的算法'
    
    def group(self):
        return '自定义工具'
    
    def groupId(self):
        return 'customtools'
    
    def shortHelpString(self):
        return '算法帮助说明'
    
    def initAlgorithm(self, config=None):
        self.addParameter(
            QgsProcessingParameterFeatureSource(
                self.INPUT,
                '输入图层',
                [QgsProcessing.TypeVectorPolygon]
            )
        )
        
        self.addParameter(
            QgsProcessingParameterNumber(
                self.BUFFER_DISTANCE,
                '缓冲距离',
                type=QgsProcessingParameterNumber.Double,
                defaultValue=100
            )
        )
        
        self.addParameter(
            QgsProcessingParameterFeatureSink(
                self.OUTPUT,
                '输出图层'
            )
        )
    
    def processAlgorithm(self, parameters, context, feedback):
        source = self.parameterAsSource(parameters, self.INPUT, context)
        distance = self.parameterAsDouble(parameters, self.BUFFER_DISTANCE, context)
        
        (sink, dest_id) = self.parameterAsSink(
            parameters, self.OUTPUT, context,
            source.fields(),
            QgsWkbTypes.Polygon,
            source.sourceCrs()
        )
        
        for feature in source.getFeatures():
            if feedback.isCanceled():
                break
            
            buffered_geom = feature.geometry().buffer(distance, 5)
            new_feature = QgsFeature()
            new_feature.setGeometry(buffered_geom)
            new_feature.setAttributes(feature.attributes())
            sink.addFeature(new_feature)
        
        return {self.OUTPUT: dest_id}
```

### 13.6.3 注册自定义算法

```python
from qgis.core import QgsApplication

# 创建提供者
class MyProvider(QgsProcessingProvider):
    def loadAlgorithms(self):
        self.addAlgorithm(MyAlgorithm())
    
    def id(self):
        return 'myprovider'
    
    def name(self):
        return '我的工具'

# 注册提供者
provider = MyProvider()
QgsApplication.processingRegistry().addProvider(provider)
```

## 13.7 历史和结果

### 13.7.1 查看历史

```
处理 > 历史
```

显示所有执行过的算法及其参数。

### 13.7.2 重新运行

从历史记录可以：
- 复制Python命令
- 重新打开对话框
- 查看参数

### 13.7.3 结果查看器

```
处理 > 结果查看器
```

显示输出文件和报告。

## 13.8 配置选项

### 13.8.1 Processing设置

```
设置 > 选项 > 处理
```

**常规设置**：
- 临时文件夹
- 默认输出格式
- 日志级别

**提供者设置**：
- GRASS路径
- SAGA路径
- 启用/禁用提供者

### 13.8.2 Python配置

```python
from qgis.core import QgsProcessingContext

# 创建上下文
context = QgsProcessingContext()

# 设置临时文件夹
context.setTemporaryFolder('/custom/temp')

# 设置无效几何处理
context.setInvalidGeometryCheck(QgsFeatureRequest.GeometryAbortOnInvalid)
```

## 13.9 常用算法参考

### 13.9.1 矢量分析

```python
# 缓冲区
processing.run("native:buffer", {'INPUT': layer, 'DISTANCE': 100, 'OUTPUT': 'memory:'})

# 裁剪
processing.run("native:clip", {'INPUT': layer, 'OVERLAY': clip, 'OUTPUT': 'memory:'})

# 相交
processing.run("native:intersection", {'INPUT': layer1, 'OVERLAY': layer2, 'OUTPUT': 'memory:'})

# 合并
processing.run("native:mergevectorlayers", {'LAYERS': [l1, l2], 'OUTPUT': 'memory:'})

# 溶解
processing.run("native:dissolve", {'INPUT': layer, 'FIELD': ['field'], 'OUTPUT': 'memory:'})
```

### 13.9.2 栅格分析

```python
# 栅格计算
processing.run("gdal:rastercalculator", {
    'INPUT_A': raster, 'BAND_A': 1,
    'FORMULA': 'A * 0.001',
    'OUTPUT': '/output.tif'
})

# 坡度
processing.run("gdal:slope", {'INPUT': dem, 'OUTPUT': '/slope.tif'})

# 重采样
processing.run("gdal:warpreproject", {
    'INPUT': raster,
    'TARGET_RESOLUTION': 100,
    'OUTPUT': '/resampled.tif'
})
```

### 13.9.3 数据管理

```python
# 投影转换
processing.run("native:reprojectlayer", {
    'INPUT': layer,
    'TARGET_CRS': 'EPSG:32650',
    'OUTPUT': 'memory:'
})

# 格式转换
processing.run("native:savefeatures", {
    'INPUT': layer,
    'OUTPUT': '/output.gpkg'
})
```

## 13.10 小结

本章详细介绍了QGIS Processing框架：

**关键要点**：
1. 理解Processing框架架构
2. 掌握使用GUI和Python运行算法
3. 熟练使用批处理功能
4. 能够创建和使用处理模型
5. 了解自定义脚本开发
6. 掌握常用算法的使用

Processing是QGIS自动化的核心。

---

**上一章**：[第12章 数据编辑与数字化](第12章-数据编辑与数字化)

**下一章**：[第14章 Python开发与PyQGIS](第14章-Python开发与PyQGIS)
