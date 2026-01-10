---
layout: default
title: 第10章 - Python绑定开发指南
---

# 第10章 - Python绑定开发指南

## 10.1 Python绑定概述

### 10.1.1 绑定机制

LibreDWG使用SWIG（Simplified Wrapper and Interface Generator）生成Python绑定，可以直接在Python中调用LibreDWG的C函数。

**特点：**
- 直接映射C API到Python
- 支持Python 2.7和Python 3.x
- 自动内存管理
- 与C API保持一致的函数命名

### 10.1.2 安装Python绑定

**从源码安装：**

```bash
# 安装依赖
sudo apt install python3-dev swig

# 编译LibreDWG时启用Python绑定
cd libredwg
./configure --enable-python
make
sudo make install

# 或单独安装Python绑定
cd bindings/python
python3 setup.py build
python3 setup.py install --user
```

**验证安装：**

```python
import libredwg
print(f"LibreDWG version: {libredwg.LIBREDWG_VERSION_MAJOR}.{libredwg.LIBREDWG_VERSION_MINOR}")
```

## 10.2 基本读取操作

### 10.2.1 读取DWG文件

```python
#!/usr/bin/env python3
"""LibreDWG Python基本读取示例"""

import libredwg
import sys

def read_dwg(filename):
    """读取DWG文件并返回Dwg_Data对象"""
    dwg = libredwg.Dwg_Data()
    
    # 读取文件
    error = libredwg.dwg_read_file(filename, dwg)
    
    if error >= libredwg.DWG_ERR_CRITICAL:
        print(f"读取文件失败，错误码: {error}")
        return None
    
    if error:
        print(f"警告: 存在非严重错误 (0x{error:x})")
    
    return dwg

def print_dwg_info(dwg):
    """打印DWG基本信息"""
    print(f"DWG版本: {dwg.header.version}")
    print(f"对象数量: {dwg.num_objects}")
    print(f"类数量: {dwg.num_classes}")
    
    # 打印头变量
    print(f"\n头变量:")
    print(f"  EXTMIN: ({dwg.header_vars.EXTMIN.x:.4f}, "
          f"{dwg.header_vars.EXTMIN.y:.4f}, "
          f"{dwg.header_vars.EXTMIN.z:.4f})")
    print(f"  EXTMAX: ({dwg.header_vars.EXTMAX.x:.4f}, "
          f"{dwg.header_vars.EXTMAX.y:.4f}, "
          f"{dwg.header_vars.EXTMAX.z:.4f})")
    print(f"  INSUNITS: {dwg.header_vars.INSUNITS}")

def main():
    if len(sys.argv) < 2:
        print(f"用法: {sys.argv[0]} <dwg文件>")
        return 1
    
    dwg = read_dwg(sys.argv[1])
    if dwg is None:
        return 1
    
    print_dwg_info(dwg)
    
    # 释放内存
    libredwg.dwg_free(dwg)
    return 0

if __name__ == '__main__':
    sys.exit(main())
```

### 10.2.2 遍历对象

```python
#!/usr/bin/env python3
"""遍历DWG对象"""

import libredwg

def iterate_objects(dwg):
    """遍历所有对象"""
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        print(f"对象 {i}:")
        print(f"  类型: {obj.type}")
        print(f"  名称: {obj.name}")
        print(f"  句柄: 0x{obj.handle.value:x}")
        print(f"  超类型: {obj.supertype}")
        print()

def count_by_type(dwg):
    """按类型统计对象数量"""
    stats = {}
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        type_name = obj.name if obj.name else f"Type_{obj.type}"
        
        if type_name not in stats:
            stats[type_name] = 0
        stats[type_name] += 1
    
    return stats

def print_stats(stats):
    """打印统计结果"""
    print("对象类型统计:")
    print("-" * 30)
    
    # 按数量排序
    sorted_stats = sorted(stats.items(), key=lambda x: x[1], reverse=True)
    
    for type_name, count in sorted_stats:
        print(f"  {type_name}: {count}")

# 使用示例
if __name__ == '__main__':
    import sys
    
    dwg = libredwg.Dwg_Data()
    error = libredwg.dwg_read_file(sys.argv[1], dwg)
    
    if error >= libredwg.DWG_ERR_CRITICAL:
        print("读取失败")
        sys.exit(1)
    
    stats = count_by_type(dwg)
    print_stats(stats)
    
    libredwg.dwg_free(dwg)
```

## 10.3 访问实体数据

### 10.3.1 读取几何实体

```python
#!/usr/bin/env python3
"""读取几何实体数据"""

import libredwg
import math

class LineInfo:
    """直线信息"""
    def __init__(self, start, end):
        self.start = start
        self.end = end
    
    @property
    def length(self):
        dx = self.end[0] - self.start[0]
        dy = self.end[1] - self.start[1]
        dz = self.end[2] - self.start[2]
        return math.sqrt(dx*dx + dy*dy + dz*dz)

class CircleInfo:
    """圆信息"""
    def __init__(self, center, radius):
        self.center = center
        self.radius = radius
    
    @property
    def circumference(self):
        return 2 * math.pi * self.radius
    
    @property
    def area(self):
        return math.pi * self.radius * self.radius

def get_lines(dwg):
    """获取所有直线"""
    lines = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.fixedtype == libredwg.DWG_TYPE_LINE:
            line = obj.tio.entity.tio.LINE
            
            start = (line.start.x, line.start.y, line.start.z)
            end = (line.end.x, line.end.y, line.end.z)
            
            lines.append(LineInfo(start, end))
    
    return lines

def get_circles(dwg):
    """获取所有圆"""
    circles = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.fixedtype == libredwg.DWG_TYPE_CIRCLE:
            circle = obj.tio.entity.tio.CIRCLE
            
            center = (circle.center.x, circle.center.y, circle.center.z)
            radius = circle.radius
            
            circles.append(CircleInfo(center, radius))
    
    return circles

def get_arcs(dwg):
    """获取所有圆弧"""
    arcs = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.fixedtype == libredwg.DWG_TYPE_ARC:
            arc = obj.tio.entity.tio.ARC
            
            arcs.append({
                'center': (arc.center.x, arc.center.y, arc.center.z),
                'radius': arc.radius,
                'start_angle': math.degrees(arc.start_angle),
                'end_angle': math.degrees(arc.end_angle)
            })
    
    return arcs

# 使用示例
if __name__ == '__main__':
    import sys
    
    dwg = libredwg.Dwg_Data()
    libredwg.dwg_read_file(sys.argv[1], dwg)
    
    lines = get_lines(dwg)
    print(f"直线数量: {len(lines)}")
    if lines:
        total_length = sum(l.length for l in lines)
        print(f"总长度: {total_length:.4f}")
    
    circles = get_circles(dwg)
    print(f"\n圆数量: {len(circles)}")
    if circles:
        total_area = sum(c.area for c in circles)
        print(f"总面积: {total_area:.4f}")
    
    arcs = get_arcs(dwg)
    print(f"\n圆弧数量: {len(arcs)}")
    
    libredwg.dwg_free(dwg)
```

### 10.3.2 读取文本实体

```python
#!/usr/bin/env python3
"""读取文本实体"""

import libredwg
import re

def strip_mtext_formatting(text):
    """清理MTEXT格式码"""
    if not text:
        return ""
    
    # 移除常见格式码
    result = text
    
    # \P -> 换行
    result = result.replace('\\P', '\n')
    result = result.replace('\\p', '\n')
    
    # 移除字体设置 \fArial|...;
    result = re.sub(r'\\[fFhHwWaAcCqQtT][^;]*;', '', result)
    
    # 移除样式码 \L \l \O \o 等
    result = re.sub(r'\\[LlOoKkUu]', '', result)
    
    # 移除花括号
    result = result.replace('{', '').replace('}', '')
    
    # 处理转义
    result = result.replace('\\\\', '\\')
    
    return result.strip()

def get_texts(dwg):
    """获取所有文本"""
    texts = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.fixedtype == libredwg.DWG_TYPE_TEXT:
            text = obj.tio.entity.tio.TEXT
            
            texts.append({
                'type': 'TEXT',
                'content': text.text_value if text.text_value else '',
                'position': (text.ins_pt.x, text.ins_pt.y),
                'height': text.height,
                'rotation': text.rotation
            })
        
        elif obj.fixedtype == libredwg.DWG_TYPE_MTEXT:
            mtext = obj.tio.entity.tio.MTEXT
            
            content = mtext.text if mtext.text else ''
            clean_content = strip_mtext_formatting(content)
            
            texts.append({
                'type': 'MTEXT',
                'content': clean_content,
                'raw_content': content,
                'position': (mtext.ins_pt.x, mtext.ins_pt.y, mtext.ins_pt.z),
                'width': mtext.rect_width
            })
    
    return texts

def search_text(dwg, pattern, case_sensitive=False):
    """搜索文本"""
    texts = get_texts(dwg)
    results = []
    
    flags = 0 if case_sensitive else re.IGNORECASE
    
    for text in texts:
        content = text['content']
        if re.search(pattern, content, flags):
            results.append(text)
    
    return results

# 使用示例
if __name__ == '__main__':
    import sys
    
    dwg = libredwg.Dwg_Data()
    libredwg.dwg_read_file(sys.argv[1], dwg)
    
    texts = get_texts(dwg)
    
    print(f"文本数量: {len(texts)}")
    print("\n文本内容:")
    print("-" * 50)
    
    for text in texts:
        print(f"[{text['type']}] {text['content'][:50]}...")
    
    # 搜索示例
    if len(sys.argv) > 2:
        pattern = sys.argv[2]
        results = search_text(dwg, pattern)
        print(f"\n搜索 '{pattern}' 结果: {len(results)} 个")
    
    libredwg.dwg_free(dwg)
```

## 10.4 图层操作

### 10.4.1 读取图层信息

```python
#!/usr/bin/env python3
"""图层操作"""

import libredwg

class Layer:
    """图层类"""
    def __init__(self, name, color, on=True, frozen=False, locked=False):
        self.name = name
        self.color = color
        self.on = on
        self.frozen = frozen
        self.locked = locked
    
    def __repr__(self):
        status = []
        if not self.on:
            status.append("关闭")
        if self.frozen:
            status.append("冻结")
        if self.locked:
            status.append("锁定")
        
        status_str = ", ".join(status) if status else "正常"
        return f"Layer('{self.name}', color={self.color}, {status_str})"

def get_layers(dwg):
    """获取所有图层"""
    layers = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.fixedtype == libredwg.DWG_TYPE_LAYER:
            layer_obj = obj.tio.object.tio.LAYER
            
            layer = Layer(
                name=layer_obj.name if layer_obj.name else "(无名)",
                color=layer_obj.color.index,
                on=bool(layer_obj.on),
                frozen=bool(layer_obj.frozen),
                locked=bool(layer_obj.locked)
            )
            
            layers.append(layer)
    
    return layers

def get_entities_by_layer(dwg, layer_name):
    """获取指定图层的所有实体"""
    entities = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.supertype != libredwg.DWG_SUPERTYPE_ENTITY:
            continue
        
        ent = obj.tio.entity
        
        # 获取图层名称
        entity_layer = "0"  # 默认
        if ent.layer and ent.layer.obj:
            if ent.layer.obj.fixedtype == libredwg.DWG_TYPE_LAYER:
                layer_obj = ent.layer.obj.tio.object.tio.LAYER
                if layer_obj.name:
                    entity_layer = layer_obj.name
        
        if entity_layer.lower() == layer_name.lower():
            entities.append({
                'handle': obj.handle.value,
                'type': obj.name,
                'fixedtype': obj.fixedtype
            })
    
    return entities

def print_layer_summary(dwg):
    """打印图层摘要"""
    layers = get_layers(dwg)
    
    print(f"图层数量: {len(layers)}")
    print("-" * 50)
    print(f"{'名称':<20} {'颜色':>5} {'状态'}")
    print("-" * 50)
    
    for layer in layers:
        status = "正常"
        if not layer.on:
            status = "关闭"
        elif layer.frozen:
            status = "冻结"
        elif layer.locked:
            status = "锁定"
        
        print(f"{layer.name:<20} {layer.color:>5} {status}")

# 使用示例
if __name__ == '__main__':
    import sys
    
    dwg = libredwg.Dwg_Data()
    libredwg.dwg_read_file(sys.argv[1], dwg)
    
    print_layer_summary(dwg)
    
    # 获取特定图层的实体
    if len(sys.argv) > 2:
        layer_name = sys.argv[2]
        entities = get_entities_by_layer(dwg, layer_name)
        print(f"\n图层 '{layer_name}' 的实体: {len(entities)} 个")
        for ent in entities[:10]:
            print(f"  0x{ent['handle']:x}: {ent['type']}")
    
    libredwg.dwg_free(dwg)
```

## 10.5 数据导出

### 10.5.1 导出为Pandas DataFrame

```python
#!/usr/bin/env python3
"""导出DWG数据到Pandas DataFrame"""

import libredwg
import pandas as pd
import math

def entities_to_dataframe(dwg):
    """将实体转换为DataFrame"""
    records = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.supertype != libredwg.DWG_SUPERTYPE_ENTITY:
            continue
        
        ent = obj.tio.entity
        
        # 获取图层
        layer = "0"
        if ent.layer and ent.layer.obj:
            if ent.layer.obj.fixedtype == libredwg.DWG_TYPE_LAYER:
                layer_obj = ent.layer.obj.tio.object.tio.LAYER
                if layer_obj.name:
                    layer = layer_obj.name
        
        record = {
            'handle': f"0x{obj.handle.value:x}",
            'type': obj.name,
            'layer': layer,
            'color': ent.color.index
        }
        
        # 根据类型添加几何信息
        if obj.fixedtype == libredwg.DWG_TYPE_LINE:
            line = ent.tio.LINE
            record['start_x'] = line.start.x
            record['start_y'] = line.start.y
            record['end_x'] = line.end.x
            record['end_y'] = line.end.y
            dx = line.end.x - line.start.x
            dy = line.end.y - line.start.y
            record['length'] = math.sqrt(dx*dx + dy*dy)
        
        elif obj.fixedtype == libredwg.DWG_TYPE_CIRCLE:
            circle = ent.tio.CIRCLE
            record['center_x'] = circle.center.x
            record['center_y'] = circle.center.y
            record['radius'] = circle.radius
            record['area'] = math.pi * circle.radius * circle.radius
        
        elif obj.fixedtype == libredwg.DWG_TYPE_TEXT:
            text = ent.tio.TEXT
            record['x'] = text.ins_pt.x
            record['y'] = text.ins_pt.y
            record['text'] = text.text_value if text.text_value else ''
            record['height'] = text.height
        
        records.append(record)
    
    return pd.DataFrame(records)

def layers_to_dataframe(dwg):
    """将图层转换为DataFrame"""
    records = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.fixedtype == libredwg.DWG_TYPE_LAYER:
            layer = obj.tio.object.tio.LAYER
            
            records.append({
                'name': layer.name if layer.name else '',
                'color': layer.color.index,
                'on': bool(layer.on),
                'frozen': bool(layer.frozen),
                'locked': bool(layer.locked)
            })
    
    return pd.DataFrame(records)

# 使用示例
if __name__ == '__main__':
    import sys
    
    dwg = libredwg.Dwg_Data()
    libredwg.dwg_read_file(sys.argv[1], dwg)
    
    # 导出实体
    entities_df = entities_to_dataframe(dwg)
    print("实体数据:")
    print(entities_df.head(10))
    print(f"\n类型统计:\n{entities_df['type'].value_counts()}")
    
    # 导出图层
    layers_df = layers_to_dataframe(dwg)
    print("\n图层数据:")
    print(layers_df)
    
    # 保存为CSV
    entities_df.to_csv('entities.csv', index=False)
    layers_df.to_csv('layers.csv', index=False)
    print("\n已保存到CSV文件")
    
    libredwg.dwg_free(dwg)
```

### 10.5.2 导出为GeoDataFrame

```python
#!/usr/bin/env python3
"""导出DWG数据到GeoDataFrame"""

import libredwg
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
import math

def entities_to_geodataframe(dwg):
    """将实体转换为GeoDataFrame"""
    features = []
    
    for i in range(dwg.num_objects):
        obj = dwg.object[i]
        
        if obj.supertype != libredwg.DWG_SUPERTYPE_ENTITY:
            continue
        
        ent = obj.tio.entity
        
        # 获取图层
        layer = "0"
        if ent.layer and ent.layer.obj:
            if ent.layer.obj.fixedtype == libredwg.DWG_TYPE_LAYER:
                layer_obj = ent.layer.obj.tio.object.tio.LAYER
                if layer_obj.name:
                    layer = layer_obj.name
        
        geometry = None
        properties = {
            'handle': f"0x{obj.handle.value:x}",
            'type': obj.name,
            'layer': layer,
            'color': ent.color.index
        }
        
        # 创建几何对象
        if obj.fixedtype == libredwg.DWG_TYPE_POINT:
            point = ent.tio.POINT
            geometry = Point(point.x, point.y)
        
        elif obj.fixedtype == libredwg.DWG_TYPE_LINE:
            line = ent.tio.LINE
            geometry = LineString([
                (line.start.x, line.start.y),
                (line.end.x, line.end.y)
            ])
            properties['length'] = geometry.length
        
        elif obj.fixedtype == libredwg.DWG_TYPE_CIRCLE:
            circle = ent.tio.CIRCLE
            # 将圆表示为点，半径作为属性
            geometry = Point(circle.center.x, circle.center.y)
            properties['radius'] = circle.radius
        
        elif obj.fixedtype == libredwg.DWG_TYPE_LWPOLYLINE:
            pline = ent.tio.LWPOLYLINE
            points = []
            for j in range(pline.num_points):
                points.append((pline.points[j].x, pline.points[j].y))
            
            if len(points) >= 2:
                if pline.flag & 1:  # 闭合
                    if len(points) >= 3:
                        geometry = Polygon(points)
                else:
                    geometry = LineString(points)
        
        if geometry:
            features.append({
                'geometry': geometry,
                **properties
            })
    
    return gpd.GeoDataFrame(features)

# 使用示例
if __name__ == '__main__':
    import sys
    
    dwg = libredwg.Dwg_Data()
    libredwg.dwg_read_file(sys.argv[1], dwg)
    
    gdf = entities_to_geodataframe(dwg)
    
    print(f"几何对象数量: {len(gdf)}")
    print(f"几何类型:\n{gdf.geometry.type.value_counts()}")
    
    # 保存为GeoJSON
    gdf.to_file('output.geojson', driver='GeoJSON')
    
    # 保存为Shapefile
    gdf.to_file('output.shp')
    
    print("已保存到GeoJSON和Shapefile")
    
    libredwg.dwg_free(dwg)
```

## 10.6 实用工具类

### 10.6.1 DWG处理类

```python
#!/usr/bin/env python3
"""DWG处理工具类"""

import libredwg
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
import math

@dataclass
class Point3D:
    x: float
    y: float
    z: float = 0.0

@dataclass
class BoundingBox:
    min_point: Point3D
    max_point: Point3D
    
    @property
    def width(self):
        return self.max_point.x - self.min_point.x
    
    @property
    def height(self):
        return self.max_point.y - self.min_point.y
    
    @property
    def center(self):
        return Point3D(
            (self.min_point.x + self.max_point.x) / 2,
            (self.min_point.y + self.max_point.y) / 2,
            (self.min_point.z + self.max_point.z) / 2
        )

class DWGReader:
    """DWG文件读取器"""
    
    def __init__(self, filename: str):
        self.filename = filename
        self._dwg = None
        self._loaded = False
    
    def __enter__(self):
        self.load()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    def load(self) -> bool:
        """加载DWG文件"""
        if self._loaded:
            return True
        
        self._dwg = libredwg.Dwg_Data()
        error = libredwg.dwg_read_file(self.filename, self._dwg)
        
        if error >= libredwg.DWG_ERR_CRITICAL:
            self._dwg = None
            return False
        
        self._loaded = True
        return True
    
    def close(self):
        """释放资源"""
        if self._dwg:
            libredwg.dwg_free(self._dwg)
            self._dwg = None
            self._loaded = False
    
    @property
    def version(self) -> str:
        """获取DWG版本"""
        if not self._loaded:
            return ""
        return self._dwg.header.version
    
    @property
    def object_count(self) -> int:
        """获取对象数量"""
        if not self._loaded:
            return 0
        return self._dwg.num_objects
    
    @property
    def bounds(self) -> Optional[BoundingBox]:
        """获取图纸范围"""
        if not self._loaded:
            return None
        
        vars = self._dwg.header_vars
        return BoundingBox(
            min_point=Point3D(vars.EXTMIN.x, vars.EXTMIN.y, vars.EXTMIN.z),
            max_point=Point3D(vars.EXTMAX.x, vars.EXTMAX.y, vars.EXTMAX.z)
        )
    
    def get_layers(self) -> List[Dict[str, Any]]:
        """获取所有图层"""
        if not self._loaded:
            return []
        
        layers = []
        for i in range(self._dwg.num_objects):
            obj = self._dwg.object[i]
            if obj.fixedtype == libredwg.DWG_TYPE_LAYER:
                layer = obj.tio.object.tio.LAYER
                layers.append({
                    'name': layer.name if layer.name else '',
                    'color': layer.color.index,
                    'on': bool(layer.on),
                    'frozen': bool(layer.frozen),
                    'locked': bool(layer.locked)
                })
        return layers
    
    def get_entities(self, entity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取实体"""
        if not self._loaded:
            return []
        
        entities = []
        for i in range(self._dwg.num_objects):
            obj = self._dwg.object[i]
            
            if obj.supertype != libredwg.DWG_SUPERTYPE_ENTITY:
                continue
            
            if entity_type and obj.name != entity_type:
                continue
            
            entity = self._parse_entity(obj)
            if entity:
                entities.append(entity)
        
        return entities
    
    def _parse_entity(self, obj) -> Optional[Dict[str, Any]]:
        """解析单个实体"""
        ent = obj.tio.entity
        
        # 获取图层
        layer = "0"
        if ent.layer and ent.layer.obj:
            if ent.layer.obj.fixedtype == libredwg.DWG_TYPE_LAYER:
                layer_obj = ent.layer.obj.tio.object.tio.LAYER
                if layer_obj.name:
                    layer = layer_obj.name
        
        result = {
            'handle': obj.handle.value,
            'type': obj.name,
            'layer': layer,
            'color': ent.color.index
        }
        
        # 根据类型解析
        if obj.fixedtype == libredwg.DWG_TYPE_LINE:
            line = ent.tio.LINE
            result['start'] = Point3D(line.start.x, line.start.y, line.start.z)
            result['end'] = Point3D(line.end.x, line.end.y, line.end.z)
            dx = line.end.x - line.start.x
            dy = line.end.y - line.start.y
            result['length'] = math.sqrt(dx*dx + dy*dy)
        
        elif obj.fixedtype == libredwg.DWG_TYPE_CIRCLE:
            circle = ent.tio.CIRCLE
            result['center'] = Point3D(circle.center.x, circle.center.y, circle.center.z)
            result['radius'] = circle.radius
        
        elif obj.fixedtype == libredwg.DWG_TYPE_TEXT:
            text = ent.tio.TEXT
            result['position'] = Point3D(text.ins_pt.x, text.ins_pt.y, 0)
            result['content'] = text.text_value if text.text_value else ''
            result['height'] = text.height
        
        return result
    
    def search_text(self, pattern: str, case_sensitive: bool = False) -> List[Dict[str, Any]]:
        """搜索文本"""
        import re
        
        results = []
        flags = 0 if case_sensitive else re.IGNORECASE
        
        for entity in self.get_entities():
            if 'content' in entity:
                if re.search(pattern, entity['content'], flags):
                    results.append(entity)
        
        return results

# 使用示例
if __name__ == '__main__':
    import sys
    
    with DWGReader(sys.argv[1]) as reader:
        print(f"版本: {reader.version}")
        print(f"对象数量: {reader.object_count}")
        print(f"范围: {reader.bounds}")
        
        print("\n图层:")
        for layer in reader.get_layers():
            print(f"  {layer['name']}: 颜色 {layer['color']}")
        
        print("\n直线:")
        for line in reader.get_entities('LINE')[:5]:
            print(f"  {line['start']} -> {line['end']}")
```

## 10.7 本章小结

本章介绍了LibreDWG的Python绑定开发：

1. **安装配置**：从源码编译安装Python绑定
2. **基本读取**：加载DWG文件和遍历对象
3. **实体访问**：读取LINE、CIRCLE、TEXT等实体
4. **图层操作**：获取图层信息和按图层过滤
5. **数据导出**：导出到Pandas和GeoPandas
6. **工具类**：封装常用操作的DWGReader类

---

**下一章预告**：[第11章 - 实体与对象操作详解](第11章-实体与对象操作详解) - 深入学习各种实体和对象的操作方法。
