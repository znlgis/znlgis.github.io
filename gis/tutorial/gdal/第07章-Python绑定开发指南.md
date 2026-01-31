---
layout: default
title: 第07章 - Python绑定开发指南
---

# 第07章：Python绑定开发指南

## 7.1 Python GDAL 简介

### 7.1.1 为什么选择 Python

Python 是使用 GDAL 最流行的编程语言，原因包括：

| 优势 | 说明 |
|-----|------|
| **易学易用** | Python 语法简洁，学习曲线平缓 |
| **生态丰富** | NumPy、SciPy、Pandas 等科学计算库完美配合 |
| **快速开发** | 脚本式开发，无需编译 |
| **社区活跃** | 大量教程、示例和问答资源 |
| **行业标准** | 地理空间领域的首选语言 |

### 7.1.2 Python GDAL 生态

```
┌─────────────────────────────────────────────────────────────┐
│                    Python GIS 生态系统                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   高层库（基于 GDAL/OGR）                                     │
│   ├── Rasterio    : 现代化栅格处理接口                       │
│   ├── Fiona       : 现代化矢量处理接口                       │
│   ├── GeoPandas   : 空间数据分析（基于 Fiona）               │
│   └── xarray      : 多维数组处理（支持 NetCDF）              │
│                                                              │
│   中间层                                                     │
│   ├── Shapely     : 几何操作（基于 GEOS）                    │
│   ├── PyProj      : 坐标转换（基于 PROJ）                    │
│   └── Cartopy     : 地图绑制                                 │
│                                                              │
│   底层库                                                     │
│   ├── GDAL/OGR    : 数据读写核心                             │
│   ├── GEOS        : 几何计算                                 │
│   └── PROJ        : 投影计算                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 7.2 安装与配置

### 7.2.1 使用 Conda 安装（推荐）

```bash
# 创建新环境
conda create -n gdal_dev python=3.10

# 激活环境
conda activate gdal_dev

# 安装 GDAL
conda install -c conda-forge gdal

# 安装相关库
conda install -c conda-forge rasterio fiona geopandas shapely pyproj

# 验证安装
python -c "from osgeo import gdal; print(f'GDAL {gdal.__version__}')"
```

### 7.2.2 使用 pip 安装

```bash
# 首先确保系统已安装 GDAL
# Ubuntu
sudo apt install gdal-bin libgdal-dev

# 获取 GDAL 版本
gdal-config --version

# 安装匹配版本的 Python 绑定
pip install GDAL==$(gdal-config --version)

# 如果遇到编译错误
export CPLUS_INCLUDE_PATH=/usr/include/gdal
export C_INCLUDE_PATH=/usr/include/gdal
pip install GDAL==$(gdal-config --version)
```

### 7.2.3 环境配置

```python
from osgeo import gdal, ogr, osr

# 配置选项
gdal.SetConfigOption('GDAL_DATA', '/path/to/gdal/data')
gdal.SetConfigOption('PROJ_LIB', '/path/to/proj/data')

# 启用异常处理（强烈推荐）
gdal.UseExceptions()
ogr.UseExceptions()

# 设置缓存大小（MB）
gdal.SetCacheMax(512 * 1024 * 1024)  # 512 MB

# 设置线程数
gdal.SetConfigOption('GDAL_NUM_THREADS', 'ALL_CPUS')

# 调试模式
gdal.SetConfigOption('CPL_DEBUG', 'ON')
gdal.SetConfigOption('CPL_LOG', '/tmp/gdal_debug.log')
```

## 7.3 栅格数据处理

### 7.3.1 读取栅格数据

```python
from osgeo import gdal
import numpy as np

def read_raster(filepath):
    """读取栅格数据的完整示例"""
    
    gdal.UseExceptions()
    
    # 打开数据集
    ds = gdal.Open(filepath)
    
    # 基本信息
    print(f"驱动: {ds.GetDriver().ShortName}")
    print(f"尺寸: {ds.RasterXSize} x {ds.RasterYSize}")
    print(f"波段数: {ds.RasterCount}")
    
    # 地理变换
    gt = ds.GetGeoTransform()
    print(f"原点: ({gt[0]}, {gt[3]})")
    print(f"像素大小: ({gt[1]}, {gt[5]})")
    
    # 投影
    proj = ds.GetProjection()
    srs = osr.SpatialReference(wkt=proj)
    print(f"坐标系: {srs.GetName()}")
    
    # 读取波段
    band = ds.GetRasterBand(1)
    print(f"数据类型: {gdal.GetDataTypeName(band.DataType)}")
    print(f"无效值: {band.GetNoDataValue()}")
    
    # 读取为 NumPy 数组
    data = band.ReadAsArray()
    print(f"数组形状: {data.shape}")
    print(f"值范围: {data.min()} - {data.max()}")
    
    # 读取所有波段
    all_data = ds.ReadAsArray()  # shape: (bands, height, width)
    
    ds = None  # 关闭数据集
    return data

# 使用
# data = read_raster('example.tif')
```

### 7.3.2 创建栅格数据

```python
from osgeo import gdal, osr
import numpy as np

def create_raster(filepath, data, geotransform, epsg=4326, nodata=-9999):
    """创建栅格数据"""
    
    gdal.UseExceptions()
    
    # 获取数组形状
    if data.ndim == 2:
        bands = 1
        height, width = data.shape
        data = data[np.newaxis, ...]  # 添加波段维度
    else:
        bands, height, width = data.shape
    
    # 确定数据类型
    dtype_map = {
        np.dtype('uint8'): gdal.GDT_Byte,
        np.dtype('int16'): gdal.GDT_Int16,
        np.dtype('uint16'): gdal.GDT_UInt16,
        np.dtype('int32'): gdal.GDT_Int32,
        np.dtype('uint32'): gdal.GDT_UInt32,
        np.dtype('float32'): gdal.GDT_Float32,
        np.dtype('float64'): gdal.GDT_Float64,
    }
    gdal_dtype = dtype_map.get(data.dtype, gdal.GDT_Float64)
    
    # 创建驱动
    driver = gdal.GetDriverByName('GTiff')
    
    # 创建选项
    options = [
        'COMPRESS=LZW',
        'TILED=YES',
        'BLOCKXSIZE=256',
        'BLOCKYSIZE=256',
    ]
    
    # 创建数据集
    ds = driver.Create(filepath, width, height, bands, gdal_dtype, options)
    
    # 设置地理变换
    ds.SetGeoTransform(geotransform)
    
    # 设置投影
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)
    ds.SetProjection(srs.ExportToWkt())
    
    # 写入数据
    for i in range(bands):
        band = ds.GetRasterBand(i + 1)
        band.WriteArray(data[i])
        band.SetNoDataValue(nodata)
        band.ComputeStatistics(False)
    
    # 刷新并关闭
    ds.FlushCache()
    ds = None
    
    print(f"创建完成: {filepath}")

# 使用示例
height, width = 1000, 1000
data = np.random.rand(height, width).astype(np.float32)

# 地理变换：覆盖北京区域
geotransform = (116.0, 0.001, 0, 40.0, 0, -0.001)

create_raster('output.tif', data, geotransform, epsg=4326)
```

### 7.3.3 栅格处理操作

```python
from osgeo import gdal
import numpy as np

def raster_calculator(input_files, output_file, calc_func, **kwargs):
    """
    栅格计算器
    
    参数:
        input_files: 输入文件字典 {'A': 'file1.tif', 'B': 'file2.tif'}
        output_file: 输出文件路径
        calc_func: 计算函数，接收字典参数
    """
    
    gdal.UseExceptions()
    
    # 打开所有输入文件
    datasets = {}
    reference_ds = None
    
    for key, filepath in input_files.items():
        ds = gdal.Open(filepath)
        datasets[key] = ds
        if reference_ds is None:
            reference_ds = ds
    
    # 获取参考信息
    width = reference_ds.RasterXSize
    height = reference_ds.RasterYSize
    geotransform = reference_ds.GetGeoTransform()
    projection = reference_ds.GetProjection()
    
    # 读取数据
    data = {}
    for key, ds in datasets.items():
        data[key] = ds.GetRasterBand(1).ReadAsArray().astype(np.float32)
    
    # 执行计算
    result = calc_func(data, **kwargs)
    
    # 创建输出
    driver = gdal.GetDriverByName('GTiff')
    out_ds = driver.Create(output_file, width, height, 1, gdal.GDT_Float32,
                           ['COMPRESS=LZW'])
    out_ds.SetGeoTransform(geotransform)
    out_ds.SetProjection(projection)
    
    out_band = out_ds.GetRasterBand(1)
    out_band.WriteArray(result)
    out_band.SetNoDataValue(-9999)
    out_band.ComputeStatistics(False)
    
    # 关闭所有数据集
    for ds in datasets.values():
        ds = None
    out_ds = None

# NDVI 计算示例
def ndvi_calc(data):
    """计算 NDVI"""
    red = data['RED']
    nir = data['NIR']
    
    # 避免除零
    denominator = nir + red
    ndvi = np.where(denominator > 0, (nir - red) / denominator, -9999)
    
    return ndvi

# 使用
# raster_calculator(
#     {'RED': 'red_band.tif', 'NIR': 'nir_band.tif'},
#     'ndvi.tif',
#     ndvi_calc
# )
```

### 7.3.4 使用 GDAL Warp

```python
from osgeo import gdal

def reproject_raster(src_path, dst_path, dst_crs, 
                     resolution=None, bounds=None, resampling='bilinear'):
    """高级重投影函数"""
    
    gdal.UseExceptions()
    
    resample_methods = {
        'nearest': gdal.GRA_NearestNeighbour,
        'bilinear': gdal.GRA_Bilinear,
        'cubic': gdal.GRA_Cubic,
        'cubicspline': gdal.GRA_CubicSpline,
        'lanczos': gdal.GRA_Lanczos,
        'average': gdal.GRA_Average,
        'mode': gdal.GRA_Mode,
    }
    
    warp_options = gdal.WarpOptions(
        format='GTiff',
        dstSRS=dst_crs,
        resampleAlg=resample_methods.get(resampling, gdal.GRA_Bilinear),
        creationOptions=['COMPRESS=LZW', 'TILED=YES'],
        xRes=resolution,
        yRes=resolution,
        outputBounds=bounds,
        multithread=True,
        warpMemoryLimit=512,
    )
    
    ds = gdal.Warp(dst_path, src_path, options=warp_options)
    ds = None
    
    print(f"重投影完成: {dst_path}")

def clip_raster(src_path, dst_path, cutline_path=None, bounds=None):
    """裁剪栅格"""
    
    gdal.UseExceptions()
    
    warp_options = gdal.WarpOptions(
        format='GTiff',
        cutlineDSName=cutline_path,
        cropToCutline=True if cutline_path else False,
        outputBounds=bounds,
        dstNodata=-9999,
        creationOptions=['COMPRESS=LZW'],
    )
    
    ds = gdal.Warp(dst_path, src_path, options=warp_options)
    ds = None

def mosaic_rasters(src_files, dst_path, nodata=None):
    """镶嵌多个栅格"""
    
    gdal.UseExceptions()
    
    vrt_options = gdal.BuildVRTOptions(
        resampleAlg='nearest',
        srcNodata=nodata,
        VRTNodata=nodata,
    )
    
    vrt = gdal.BuildVRT('', src_files, options=vrt_options)
    
    translate_options = gdal.TranslateOptions(
        format='GTiff',
        creationOptions=['COMPRESS=LZW', 'TILED=YES', 'BIGTIFF=IF_SAFER'],
    )
    
    ds = gdal.Translate(dst_path, vrt, options=translate_options)
    
    vrt = None
    ds = None

# 使用示例
# reproject_raster('input.tif', 'output.tif', 'EPSG:3857')
# clip_raster('input.tif', 'clipped.tif', cutline_path='boundary.shp')
# mosaic_rasters(['tile1.tif', 'tile2.tif'], 'mosaic.tif')
```

## 7.4 矢量数据处理

### 7.4.1 读取矢量数据

```python
from osgeo import ogr, osr

def read_vector(filepath):
    """读取矢量数据"""
    
    ogr.UseExceptions()
    
    # 打开数据源
    ds = ogr.Open(filepath)
    
    print(f"数据源: {ds.GetDescription()}")
    print(f"图层数: {ds.GetLayerCount()}")
    
    # 遍历图层
    for i in range(ds.GetLayerCount()):
        layer = ds.GetLayer(i)
        
        print(f"\n图层 {i}: {layer.GetName()}")
        print(f"  要素数: {layer.GetFeatureCount()}")
        print(f"  几何类型: {ogr.GeometryTypeToName(layer.GetGeomType())}")
        
        # 获取范围
        extent = layer.GetExtent()
        print(f"  范围: {extent}")
        
        # 获取空间参考
        srs = layer.GetSpatialRef()
        if srs:
            print(f"  坐标系: {srs.GetName()}")
        
        # 获取字段定义
        layer_defn = layer.GetLayerDefn()
        print(f"  字段数: {layer_defn.GetFieldCount()}")
        
        for j in range(layer_defn.GetFieldCount()):
            field_defn = layer_defn.GetFieldDefn(j)
            print(f"    - {field_defn.GetName()}: {field_defn.GetTypeName()}")
    
    ds = None

def read_features(filepath, layer_name=None, where=None, bbox=None):
    """读取要素并返回列表"""
    
    ogr.UseExceptions()
    
    ds = ogr.Open(filepath)
    
    if layer_name:
        layer = ds.GetLayerByName(layer_name)
    else:
        layer = ds.GetLayer(0)
    
    # 设置过滤器
    if where:
        layer.SetAttributeFilter(where)
    
    if bbox:
        layer.SetSpatialFilterRect(*bbox)
    
    features = []
    
    for feature in layer:
        feat_dict = {
            'fid': feature.GetFID(),
            'geometry': feature.GetGeometryRef().ExportToWkt() if feature.GetGeometryRef() else None,
        }
        
        # 获取所有属性
        layer_defn = layer.GetLayerDefn()
        for i in range(layer_defn.GetFieldCount()):
            field_name = layer_defn.GetFieldDefn(i).GetName()
            feat_dict[field_name] = feature.GetField(i)
        
        features.append(feat_dict)
    
    ds = None
    return features

# 使用示例
# read_vector('data.shp')
# features = read_features('data.shp', where="population > 1000000")
```

### 7.4.2 创建矢量数据

```python
from osgeo import ogr, osr

def create_point_shapefile(filepath, points, fields, epsg=4326):
    """
    创建点图层
    
    参数:
        filepath: 输出路径
        points: 点列表，每个点是字典 {'x': ..., 'y': ..., 'field1': ..., ...}
        fields: 字段定义列表 [(name, type, width), ...]
        epsg: 坐标系 EPSG 代码
    """
    
    ogr.UseExceptions()
    
    # 创建数据源
    driver = ogr.GetDriverByName('ESRI Shapefile')
    
    # 删除已存在的文件
    if driver.DeleteDataSource(filepath) != 0:
        pass
    
    ds = driver.CreateDataSource(filepath)
    
    # 创建空间参考
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)
    
    # 创建图层
    layer = ds.CreateLayer('points', srs, ogr.wkbPoint)
    
    # 创建字段
    for field_def in fields:
        name, field_type = field_def[0], field_def[1]
        field = ogr.FieldDefn(name, field_type)
        
        if field_type == ogr.OFTString and len(field_def) > 2:
            field.SetWidth(field_def[2])
        
        layer.CreateField(field)
    
    # 获取图层定义
    layer_defn = layer.GetLayerDefn()
    
    # 添加要素
    for point_data in points:
        feature = ogr.Feature(layer_defn)
        
        # 设置几何
        point = ogr.Geometry(ogr.wkbPoint)
        point.AddPoint(point_data['x'], point_data['y'])
        feature.SetGeometry(point)
        
        # 设置属性
        for field_def in fields:
            field_name = field_def[0]
            if field_name in point_data:
                feature.SetField(field_name, point_data[field_name])
        
        layer.CreateFeature(feature)
        feature = None
    
    ds = None
    print(f"创建完成: {filepath}")

# 使用示例
points = [
    {'x': 116.4, 'y': 39.9, 'name': '北京', 'population': 21540000},
    {'x': 121.5, 'y': 31.2, 'name': '上海', 'population': 24280000},
    {'x': 113.3, 'y': 23.1, 'name': '广州', 'population': 18680000},
]

fields = [
    ('name', ogr.OFTString, 50),
    ('population', ogr.OFTInteger64),
]

# create_point_shapefile('cities.shp', points, fields)
```

### 7.4.3 空间分析

```python
from osgeo import ogr, osr

def buffer_layer(input_path, output_path, distance, dissolve=False):
    """对图层进行缓冲区分析"""
    
    ogr.UseExceptions()
    
    # 打开输入
    src_ds = ogr.Open(input_path)
    src_layer = src_ds.GetLayer()
    
    # 创建输出
    driver = ogr.GetDriverByName('ESRI Shapefile')
    dst_ds = driver.CreateDataSource(output_path)
    dst_layer = dst_ds.CreateLayer(
        'buffer',
        src_layer.GetSpatialRef(),
        ogr.wkbPolygon
    )
    
    # 复制字段
    src_defn = src_layer.GetLayerDefn()
    for i in range(src_defn.GetFieldCount()):
        dst_layer.CreateField(src_defn.GetFieldDefn(i))
    
    dst_defn = dst_layer.GetLayerDefn()
    
    # 执行缓冲
    if dissolve:
        # 溶解所有缓冲区
        union_geom = None
        for src_feature in src_layer:
            geom = src_feature.GetGeometryRef()
            if geom:
                buffer_geom = geom.Buffer(distance)
                if union_geom is None:
                    union_geom = buffer_geom
                else:
                    union_geom = union_geom.Union(buffer_geom)
        
        if union_geom:
            dst_feature = ogr.Feature(dst_defn)
            dst_feature.SetGeometry(union_geom)
            dst_layer.CreateFeature(dst_feature)
    else:
        for src_feature in src_layer:
            geom = src_feature.GetGeometryRef()
            if geom:
                buffer_geom = geom.Buffer(distance)
                
                dst_feature = ogr.Feature(dst_defn)
                dst_feature.SetGeometry(buffer_geom)
                
                for i in range(src_defn.GetFieldCount()):
                    dst_feature.SetField(i, src_feature.GetField(i))
                
                dst_layer.CreateFeature(dst_feature)
    
    src_ds = None
    dst_ds = None

def spatial_join(target_path, join_path, output_path, how='intersects'):
    """空间连接"""
    
    ogr.UseExceptions()
    
    target_ds = ogr.Open(target_path)
    target_layer = target_ds.GetLayer()
    
    join_ds = ogr.Open(join_path)
    join_layer = join_ds.GetLayer()
    
    # 创建输出
    driver = ogr.GetDriverByName('ESRI Shapefile')
    out_ds = driver.CreateDataSource(output_path)
    out_layer = out_ds.CreateLayer(
        'joined',
        target_layer.GetSpatialRef(),
        target_layer.GetGeomType()
    )
    
    # 复制目标图层字段
    target_defn = target_layer.GetLayerDefn()
    for i in range(target_defn.GetFieldCount()):
        out_layer.CreateField(target_defn.GetFieldDefn(i))
    
    # 添加连接图层字段（加前缀）
    join_defn = join_layer.GetLayerDefn()
    for i in range(join_defn.GetFieldCount()):
        field_defn = join_defn.GetFieldDefn(i)
        new_field = ogr.FieldDefn(f'join_{field_defn.GetName()}', field_defn.GetType())
        out_layer.CreateField(new_field)
    
    out_defn = out_layer.GetLayerDefn()
    
    # 执行空间连接
    for target_feature in target_layer:
        target_geom = target_feature.GetGeometryRef()
        
        if target_geom is None:
            continue
        
        # 空间过滤
        join_layer.SetSpatialFilter(target_geom)
        
        for join_feature in join_layer:
            join_geom = join_feature.GetGeometryRef()
            
            # 检查空间关系
            if how == 'intersects' and target_geom.Intersects(join_geom):
                out_feature = ogr.Feature(out_defn)
                out_feature.SetGeometry(target_geom.Clone())
                
                # 复制目标属性
                for i in range(target_defn.GetFieldCount()):
                    out_feature.SetField(i, target_feature.GetField(i))
                
                # 复制连接属性
                for i in range(join_defn.GetFieldCount()):
                    out_feature.SetField(
                        target_defn.GetFieldCount() + i,
                        join_feature.GetField(i)
                    )
                
                out_layer.CreateFeature(out_feature)
                break  # 只取第一个匹配
        
        join_layer.ResetReading()
    
    target_ds = None
    join_ds = None
    out_ds = None

# 使用示例
# buffer_layer('points.shp', 'buffer.shp', 1000)  # 1000米缓冲区
# spatial_join('parcels.shp', 'zones.shp', 'parcels_with_zone.shp')
```

## 7.5 与 NumPy 集成

### 7.5.1 高效数据转换

```python
from osgeo import gdal, gdal_array
import numpy as np

def read_raster_as_array(filepath, band_index=1):
    """高效读取栅格为 NumPy 数组"""
    
    ds = gdal.Open(filepath)
    band = ds.GetRasterBand(band_index)
    
    # 使用 gdal_array 模块
    data = gdal_array.BandReadAsArray(band)
    
    # 获取元数据
    nodata = band.GetNoDataValue()
    geotransform = ds.GetGeoTransform()
    projection = ds.GetProjection()
    
    ds = None
    
    return {
        'data': data,
        'nodata': nodata,
        'geotransform': geotransform,
        'projection': projection,
    }

def write_array_as_raster(filepath, data, geotransform, projection, nodata=-9999):
    """将 NumPy 数组写入栅格"""
    
    # NumPy 类型到 GDAL 类型映射
    numpy_to_gdal = {
        np.dtype('uint8'): gdal.GDT_Byte,
        np.dtype('int8'): gdal.GDT_Byte,
        np.dtype('uint16'): gdal.GDT_UInt16,
        np.dtype('int16'): gdal.GDT_Int16,
        np.dtype('uint32'): gdal.GDT_UInt32,
        np.dtype('int32'): gdal.GDT_Int32,
        np.dtype('float32'): gdal.GDT_Float32,
        np.dtype('float64'): gdal.GDT_Float64,
    }
    
    gdal_type = numpy_to_gdal.get(data.dtype, gdal.GDT_Float64)
    
    if data.ndim == 2:
        bands = 1
        height, width = data.shape
    else:
        bands, height, width = data.shape
    
    driver = gdal.GetDriverByName('GTiff')
    ds = driver.Create(
        filepath, width, height, bands, gdal_type,
        ['COMPRESS=LZW', 'TILED=YES']
    )
    
    ds.SetGeoTransform(geotransform)
    ds.SetProjection(projection)
    
    if data.ndim == 2:
        band = ds.GetRasterBand(1)
        gdal_array.BandWriteArray(band, data)
        band.SetNoDataValue(nodata)
    else:
        for i in range(bands):
            band = ds.GetRasterBand(i + 1)
            gdal_array.BandWriteArray(band, data[i])
            band.SetNoDataValue(nodata)
    
    ds.FlushCache()
    ds = None
```

### 7.5.2 内存数据集

```python
from osgeo import gdal
import numpy as np

def create_memory_raster(data, geotransform, projection):
    """创建内存中的栅格数据集"""
    
    if data.ndim == 2:
        bands = 1
        height, width = data.shape
        data = data[np.newaxis, ...]
    else:
        bands, height, width = data.shape
    
    # 创建内存驱动
    driver = gdal.GetDriverByName('MEM')
    
    # 确定数据类型
    dtype_map = {
        np.dtype('float32'): gdal.GDT_Float32,
        np.dtype('float64'): gdal.GDT_Float64,
        np.dtype('int32'): gdal.GDT_Int32,
        np.dtype('uint8'): gdal.GDT_Byte,
    }
    gdal_type = dtype_map.get(data.dtype, gdal.GDT_Float64)
    
    # 创建内存数据集
    mem_ds = driver.Create('', width, height, bands, gdal_type)
    mem_ds.SetGeoTransform(geotransform)
    mem_ds.SetProjection(projection)
    
    for i in range(bands):
        band = mem_ds.GetRasterBand(i + 1)
        band.WriteArray(data[i])
    
    return mem_ds

def array_to_vrt(data, geotransform, projection):
    """将数组转换为 VRT 数据集"""
    
    # 首先创建内存数据集
    mem_ds = create_memory_raster(data, geotransform, projection)
    
    # 创建 VRT
    vrt = gdal.BuildVRT('', mem_ds)
    
    return vrt, mem_ds  # 注意：必须保持 mem_ds 的引用
```

## 7.6 高级主题

### 7.6.1 多线程处理

```python
from osgeo import gdal
import numpy as np
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import multiprocessing

def process_tile(args):
    """处理单个瓦片"""
    
    src_path, x_off, y_off, x_size, y_size, processing_func = args
    
    # 每个进程需要重新打开数据集
    ds = gdal.Open(src_path)
    band = ds.GetRasterBand(1)
    
    # 读取瓦片
    data = band.ReadAsArray(x_off, y_off, x_size, y_size)
    
    # 处理
    result = processing_func(data)
    
    ds = None
    
    return x_off, y_off, result

def parallel_raster_processing(src_path, dst_path, processing_func, 
                                tile_size=512, num_workers=None):
    """并行处理栅格数据"""
    
    gdal.UseExceptions()
    
    if num_workers is None:
        num_workers = multiprocessing.cpu_count()
    
    # 打开源数据
    src_ds = gdal.Open(src_path)
    width = src_ds.RasterXSize
    height = src_ds.RasterYSize
    
    # 创建任务列表
    tasks = []
    for y in range(0, height, tile_size):
        for x in range(0, width, tile_size):
            x_size = min(tile_size, width - x)
            y_size = min(tile_size, height - y)
            tasks.append((src_path, x, y, x_size, y_size, processing_func))
    
    # 创建输出数据集
    driver = gdal.GetDriverByName('GTiff')
    dst_ds = driver.Create(
        dst_path, width, height, 1, gdal.GDT_Float32,
        ['COMPRESS=LZW', 'TILED=YES']
    )
    dst_ds.SetGeoTransform(src_ds.GetGeoTransform())
    dst_ds.SetProjection(src_ds.GetProjection())
    dst_band = dst_ds.GetRasterBand(1)
    
    src_ds = None
    
    # 并行处理
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        results = list(executor.map(process_tile, tasks))
    
    # 写入结果
    for x_off, y_off, result in results:
        dst_band.WriteArray(result, x_off, y_off)
    
    dst_ds.FlushCache()
    dst_ds = None
    
    print(f"并行处理完成: {dst_path}")

# 使用示例
def normalize(data):
    """归一化处理"""
    return (data - data.min()) / (data.max() - data.min())

# parallel_raster_processing('input.tif', 'output.tif', normalize)
```

### 7.6.2 错误处理和日志

```python
from osgeo import gdal
import logging

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('gdal_app')

# GDAL 错误处理器
def gdal_error_handler(err_class, err_num, err_msg):
    """自定义 GDAL 错误处理器"""
    
    err_type_map = {
        gdal.CE_None: 'None',
        gdal.CE_Debug: 'Debug',
        gdal.CE_Warning: 'Warning',
        gdal.CE_Failure: 'Failure',
        gdal.CE_Fatal: 'Fatal',
    }
    
    err_type = err_type_map.get(err_class, 'Unknown')
    
    if err_class >= gdal.CE_Warning:
        logger.warning(f"GDAL {err_type} ({err_num}): {err_msg}")
    
    if err_class >= gdal.CE_Failure:
        raise RuntimeError(f"GDAL {err_type}: {err_msg}")

# 注册错误处理器
# gdal.PushErrorHandler(gdal_error_handler)

# 使用上下文管理器进行错误处理
from contextlib import contextmanager

@contextmanager
def gdal_context():
    """GDAL 操作上下文管理器"""
    
    gdal.UseExceptions()
    
    # 保存当前配置
    old_debug = gdal.GetConfigOption('CPL_DEBUG')
    
    try:
        yield
    except Exception as e:
        logger.error(f"GDAL 操作失败: {e}")
        raise
    finally:
        # 恢复配置
        if old_debug:
            gdal.SetConfigOption('CPL_DEBUG', old_debug)

# 使用示例
with gdal_context():
    ds = gdal.Open('example.tif')
    # 处理数据...
    ds = None
```

## 7.7 最佳实践

### 7.7.1 代码组织

```python
"""
gdal_utils.py - GDAL 工具函数模块
"""

from osgeo import gdal, ogr, osr
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
import logging

# 模块初始化
gdal.UseExceptions()
ogr.UseExceptions()

logger = logging.getLogger(__name__)

class RasterDataset:
    """栅格数据集封装类"""
    
    def __init__(self, filepath: str, mode: str = 'r'):
        self.filepath = Path(filepath)
        self.mode = mode
        self._ds = None
    
    def __enter__(self):
        access = gdal.GA_Update if self.mode == 'w' else gdal.GA_ReadOnly
        self._ds = gdal.Open(str(self.filepath), access)
        if self._ds is None:
            raise IOError(f"无法打开: {self.filepath}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._ds:
            self._ds.FlushCache()
            self._ds = None
        return False
    
    @property
    def width(self) -> int:
        return self._ds.RasterXSize
    
    @property
    def height(self) -> int:
        return self._ds.RasterYSize
    
    @property
    def bands(self) -> int:
        return self._ds.RasterCount
    
    @property
    def geotransform(self) -> Tuple:
        return self._ds.GetGeoTransform()
    
    @property
    def projection(self) -> str:
        return self._ds.GetProjection()
    
    def read_band(self, band_index: int = 1) -> np.ndarray:
        """读取指定波段"""
        band = self._ds.GetRasterBand(band_index)
        return band.ReadAsArray()
    
    def read_all(self) -> np.ndarray:
        """读取所有波段"""
        return self._ds.ReadAsArray()

class VectorDataset:
    """矢量数据集封装类"""
    
    def __init__(self, filepath: str, mode: str = 'r'):
        self.filepath = Path(filepath)
        self.mode = mode
        self._ds = None
    
    def __enter__(self):
        update = 1 if self.mode == 'w' else 0
        self._ds = ogr.Open(str(self.filepath), update)
        if self._ds is None:
            raise IOError(f"无法打开: {self.filepath}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self._ds = None
        return False
    
    @property
    def layer_count(self) -> int:
        return self._ds.GetLayerCount()
    
    def get_layer(self, index: int = 0):
        return self._ds.GetLayer(index)
    
    def features(self, layer_index: int = 0) -> List[Dict[str, Any]]:
        """获取所有要素"""
        layer = self._ds.GetLayer(layer_index)
        features = []
        
        for feature in layer:
            feat_dict = {'fid': feature.GetFID()}
            
            geom = feature.GetGeometryRef()
            if geom:
                feat_dict['geometry'] = geom.ExportToWkt()
            
            layer_defn = layer.GetLayerDefn()
            for i in range(layer_defn.GetFieldCount()):
                field_name = layer_defn.GetFieldDefn(i).GetName()
                feat_dict[field_name] = feature.GetField(i)
            
            features.append(feat_dict)
        
        layer.ResetReading()
        return features

# 使用示例
# with RasterDataset('input.tif') as ds:
#     data = ds.read_all()
#     print(f"数据形状: {data.shape}")
```

### 7.7.2 性能优化建议

```python
# 1. 使用分块读取大文件
def read_large_raster_efficiently(filepath, processing_func, block_size=512):
    """高效读取大型栅格文件"""
    
    ds = gdal.Open(filepath)
    band = ds.GetRasterBand(1)
    
    width = ds.RasterXSize
    height = ds.RasterYSize
    
    for y in range(0, height, block_size):
        for x in range(0, width, block_size):
            x_size = min(block_size, width - x)
            y_size = min(block_size, height - y)
            
            data = band.ReadAsArray(x, y, x_size, y_size)
            processing_func(data, x, y)
    
    ds = None

# 2. 设置合适的缓存大小
gdal.SetCacheMax(1024 * 1024 * 1024)  # 1GB

# 3. 使用多线程
gdal.SetConfigOption('GDAL_NUM_THREADS', 'ALL_CPUS')

# 4. 对于网络数据，启用 HTTP 缓存
gdal.SetConfigOption('CPL_VSIL_CURL_CACHE_SIZE', '100000000')  # 100MB

# 5. 使用 VRT 进行虚拟处理
# VRT 可以避免不必要的数据复制
```

## 7.8 本章小结

本章详细介绍了 Python GDAL 开发：

1. **环境安装**：Conda 安装（推荐）和 pip 安装方法
2. **栅格处理**：读取、创建、裁剪、重投影、镶嵌
3. **矢量处理**：读取、创建、空间分析
4. **NumPy 集成**：高效的数据转换和内存数据集
5. **高级主题**：多线程处理、错误处理
6. **最佳实践**：代码组织和性能优化

## 7.9 思考与练习

1. 比较 osgeo.gdal 和 rasterio 的优缺点。
2. 编写一个函数，读取多波段影像并计算指定的波段指数。
3. 实现一个支持断点续传的大文件处理器。
4. 如何处理 GDAL 操作中的内存溢出问题？
5. 编写一个矢量数据转换器，支持多种输出格式。
6. 实现并行处理 1000 个栅格文件的批处理脚本。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第06章-坐标系统与投影转换" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第08章-Java绑定开发指南" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
