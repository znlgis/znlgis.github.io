---
layout: default
title: 第05章 - GDAL引擎架构设计
---

# 第05章 - GDAL引擎架构设计

## 5.1 GDAL引擎概述

### 5.1.1 为什么选择GDAL

OGU4Net选择GDAL作为唯一的GIS引擎，这是经过深思熟虑的决策：

| 考量因素 | 说明 |
|---------|------|
| **格式支持** | GDAL支持超过200种栅格和矢量格式 |
| **性能卓越** | C/C++底层实现，性能出色 |
| **跨平台** | 支持Windows、Linux、macOS等平台 |
| **社区活跃** | OSGeo基金会支持，社区活跃 |
| **行业标准** | GIS行业事实标准库 |
| **NuGet支持** | MaxRev.Gdal.Universal提供优秀的.NET绑定 |

### 5.1.2 GDAL/OGR/OSR关系

GDAL实际上是一个库集合：

```
GDAL (Geospatial Data Abstraction Library)
├── GDAL Core       - 栅格数据处理
├── OGR             - 矢量数据处理 (Simple Features)
└── OSR             - 空间参考系统 (Coordinate Systems)
```

OGU4Net主要使用：
- **OGR**：矢量数据读写、几何操作
- **OSR**：坐标系定义、坐标转换

### 5.1.3 MaxRev.Gdal.Universal

OGU4Net通过 [MaxRev.Gdal.Universal](https://github.com/MaxRev-Dev/gdal.netcore) 访问GDAL：

| 特性 | 说明 |
|-----|------|
| 自动配置 | 自动处理GDAL库加载和配置 |
| 跨平台 | 包含所有平台的原生库 |
| 驱动内置 | 常用驱动已编译进包 |
| 持续更新 | 跟进GDAL新版本 |

## 5.2 GdalEngine实现

### 5.2.1 类结构

```csharp
namespace OpenGIS.Utils.Engine;

/// <summary>
/// GDAL引擎实现
/// </summary>
public class GdalEngine : GisEngine
{
    /// <summary>
    /// 引擎类型
    /// </summary>
    public override GisEngineType EngineType => GisEngineType.GDAL;
    
    /// <summary>
    /// 支持的格式列表
    /// </summary>
    public override IList<DataFormatType> SupportedFormats => new List<DataFormatType>
    {
        DataFormatType.SHP,
        DataFormatType.GEOJSON,
        DataFormatType.FILEGDB,
        DataFormatType.GEOPACKAGE,
        DataFormatType.KML,
        DataFormatType.DXF,
        DataFormatType.POSTGIS
    };
    
    /// <summary>
    /// 创建读取器
    /// </summary>
    public override ILayerReader CreateReader()
    {
        return new GdalReader();
    }
    
    /// <summary>
    /// 创建写入器
    /// </summary>
    public override ILayerWriter CreateWriter()
    {
        return new GdalWriter();
    }
}
```

### 5.2.2 引擎工厂

```csharp
namespace OpenGIS.Utils.Engine;

/// <summary>
/// GIS引擎工厂
/// </summary>
public static class GisEngineFactory
{
    // 单例引擎实例
    private static readonly GdalEngine _gdalEngineInstance = new();
    
    /// <summary>
    /// 根据引擎类型获取引擎
    /// </summary>
    public static GisEngine GetEngine(GisEngineType engineType)
    {
        return engineType switch
        {
            GisEngineType.GDAL => _gdalEngineInstance,
            GisEngineType.GEOTOOLS => _gdalEngineInstance, // 兼容性重定向
            _ => throw new EngineNotSupportedException(
                $"Engine type {engineType} is not supported")
        };
    }
    
    /// <summary>
    /// 根据数据格式获取引擎
    /// </summary>
    public static GisEngine GetEngine(DataFormatType format)
    {
        // 所有格式都使用GDAL
        return _gdalEngineInstance;
    }
}
```

## 5.3 GdalReader深度解析

### 5.3.1 核心读取流程

```csharp
public class GdalReader : ILayerReader
{
    static GdalReader()
    {
        // 确保GDAL已初始化
        GdalConfiguration.ConfigureGdal();
    }
    
    public OguLayer Read(
        string path,
        string? layerName = null,
        string? attributeFilter = null,
        string? spatialFilterWkt = null,
        Dictionary<string, object>? options = null)
    {
        // 1. 参数验证
        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Path cannot be null or empty", nameof(path));
        
        OgrDataSource? dataSource = null;
        try
        {
            // 2. 打开数据源
            dataSource = Ogr.Open(path, 0); // 0 = 只读
            if (dataSource == null)
                throw new Exception($"Failed to open data source: {path}");
            
            // 3. 获取图层
            Layer ogrLayer;
            if (!string.IsNullOrWhiteSpace(layerName))
            {
                ogrLayer = dataSource.GetLayerByName(layerName);
                if (ogrLayer == null)
                    throw new Exception($"Layer '{layerName}' not found");
            }
            else
            {
                if (dataSource.GetLayerCount() == 0)
                    throw new Exception("No layers found in data source");
                ogrLayer = dataSource.GetLayerByIndex(0);
            }
            
            // 4. 读取并转换
            return ReadOgrLayer(ogrLayer, attributeFilter, spatialFilterWkt);
        }
        finally
        {
            // 5. 释放资源
            dataSource?.Dispose();
        }
    }
}
```

### 5.3.2 读取OGR图层

```csharp
private OguLayer ReadOgrLayer(
    Layer ogrLayer,
    string? attributeFilter,
    string? spatialFilterWkt)
{
    var layer = new OguLayer { Name = ogrLayer.GetName() };
    
    // 1. 读取字段定义
    var layerDefn = ogrLayer.GetLayerDefn();
    var fieldCount = layerDefn.GetFieldCount();
    
    for (int i = 0; i < fieldCount; i++)
    {
        var fieldDefn = layerDefn.GetFieldDefn(i);
        var field = new OguField
        {
            Name = fieldDefn.GetName(),
            DataType = MapOgrFieldType(fieldDefn.GetFieldType()),
            Length = fieldDefn.GetWidth(),
            Precision = fieldDefn.GetPrecision()
        };
        layer.AddField(field);
    }
    
    // 2. 确定几何类型
    var geomType = ogrLayer.GetGeomType();
    layer.GeometryType = MapOgrGeometryType(geomType);
    
    // 3. 应用属性过滤
    if (!string.IsNullOrWhiteSpace(attributeFilter))
    {
        ogrLayer.SetAttributeFilter(attributeFilter);
    }
    
    // 4. 应用空间过滤
    if (!string.IsNullOrWhiteSpace(spatialFilterWkt))
    {
        try
        {
            using var filterGeom = OSGeo.OGR.Geometry.CreateFromWkt(spatialFilterWkt);
            if (filterGeom != null)
            {
                ogrLayer.SetSpatialFilter(filterGeom);
            }
        }
        catch
        {
            // 忽略无效的空间过滤
        }
    }
    
    // 5. 读取要素
    int fid = 1;
    ogrLayer.ResetReading();
    
    Feature? ogrFeature;
    while ((ogrFeature = ogrLayer.GetNextFeature()) != null)
    {
        using (ogrFeature)
        {
            var feature = new OguFeature { Fid = fid++ };
            
            // 读取几何
            var geometry = ogrFeature.GetGeometryRef();
            if (geometry != null)
            {
                geometry.ExportToWkt(out string wkt);
                feature.Wkt = wkt;
            }
            
            // 读取属性
            foreach (var field in layer.Fields)
            {
                var fieldIndex = ogrFeature.GetFieldIndex(field.Name);
                if (fieldIndex >= 0)
                {
                    var value = GetFieldValue(ogrFeature, fieldIndex, field.DataType);
                    feature.SetValue(field.Name, value);
                }
            }
            
            layer.AddFeature(feature);
        }
    }
    
    return layer;
}
```

### 5.3.3 字段值读取

```csharp
private object? GetFieldValue(Feature feature, int fieldIndex, FieldDataType dataType)
{
    // 检查字段是否已设置
    if (!feature.IsFieldSet(fieldIndex))
        return null;
    
    return dataType switch
    {
        FieldDataType.INTEGER => feature.GetFieldAsInteger(fieldIndex),
        FieldDataType.LONG => feature.GetFieldAsInteger64(fieldIndex),
        FieldDataType.DOUBLE or FieldDataType.FLOAT => feature.GetFieldAsDouble(fieldIndex),
        FieldDataType.STRING => feature.GetFieldAsString(fieldIndex),
        FieldDataType.DATE or FieldDataType.DATETIME => GetDateTimeValue(feature, fieldIndex),
        _ => feature.GetFieldAsString(fieldIndex)
    };
}

private DateTime? GetDateTimeValue(Feature feature, int fieldIndex)
{
    try
    {
        feature.GetFieldAsDateTime(
            fieldIndex,
            out int year, out int month, out int day,
            out int hour, out int minute, out float second,
            out int tzFlag);
        
        return new DateTime(year, month, day, hour, minute, (int)second);
    }
    catch
    {
        return null;
    }
}
```

### 5.3.4 获取图层名称列表

```csharp
public IList<string> GetLayerNames(string path)
{
    if (string.IsNullOrWhiteSpace(path))
        throw new ArgumentException("Path cannot be null or empty", nameof(path));
    
    var layerNames = new List<string>();
    
    using var dataSource = Ogr.Open(path, 0);
    if (dataSource == null)
        return layerNames;
    
    var layerCount = dataSource.GetLayerCount();
    for (int i = 0; i < layerCount; i++)
    {
        using var layer = dataSource.GetLayerByIndex(i);
        if (layer != null)
        {
            layerNames.Add(layer.GetName());
        }
    }
    
    return layerNames;
}
```

## 5.4 GdalWriter深度解析

### 5.4.1 核心写入流程

```csharp
public class GdalWriter : ILayerWriter
{
    static GdalWriter()
    {
        GdalConfiguration.ConfigureGdal();
    }
    
    public void Write(
        OguLayer layer,
        string path,
        string? layerName = null,
        Dictionary<string, object>? options = null)
    {
        // 1. 参数验证
        if (layer == null)
            throw new ArgumentNullException(nameof(layer));
        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Path cannot be null or empty", nameof(path));
        
        // 2. 推断驱动名称
        string driverName = InferDriverName(path, options);
        var driver = Ogr.GetDriverByName(driverName);
        
        if (driver == null)
            throw new Exception($"Driver '{driverName}' not available");
        
        // 3. 确保目录存在
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }
        
        // 4. 删除已存在的文件
        if (File.Exists(path) || Directory.Exists(path))
        {
            try { driver.DeleteDataSource(path); }
            catch { /* 忽略删除错误 */ }
        }
        
        OgrDataSource? dataSource = null;
        try
        {
            // 5. 创建数据源
            dataSource = driver.CreateDataSource(path, new string[] { });
            if (dataSource == null)
                throw new Exception($"Failed to create data source: {path}");
            
            // 6. 创建图层
            var ogrGeomType = MapToOgrGeometryType(layer.GeometryType);
            var ogrLayer = dataSource.CreateLayer(
                layerName ?? layer.Name ?? "layer",
                null,
                ogrGeomType,
                new string[] { });
            
            if (ogrLayer == null)
                throw new Exception("Failed to create layer");
            
            // 7. 创建字段
            foreach (var field in layer.Fields)
            {
                var fieldDefn = CreateOgrFieldDefn(field);
                ogrLayer.CreateField(fieldDefn, 1);
                fieldDefn.Dispose();
            }
            
            // 8. 写入要素
            foreach (var oguFeature in layer.Features)
            {
                WriteFeature(ogrLayer, oguFeature, layer.Fields);
            }
            
            // 9. 同步到磁盘
            dataSource.SyncToDisk();
        }
        finally
        {
            dataSource?.Dispose();
        }
    }
}
```

### 5.4.2 驱动名称推断

```csharp
private string InferDriverName(string path, Dictionary<string, object>? options)
{
    // 优先从选项获取
    if (options != null && options.TryGetValue("driver", out var driverObj))
    {
        return driverObj.ToString() ?? "ESRI Shapefile";
    }
    
    // 根据扩展名推断
    var extension = Path.GetExtension(path).ToLowerInvariant();
    return extension switch
    {
        ".shp" => "ESRI Shapefile",
        ".gdb" => "FileGDB",
        ".gpkg" => "GPKG",
        ".kml" => "KML",
        ".dxf" => "DXF",
        ".geojson" or ".json" => "GeoJSON",
        _ => "ESRI Shapefile"
    };
}
```

### 5.4.3 创建OGR字段定义

```csharp
private FieldDefn CreateOgrFieldDefn(OguField field)
{
    var ogrType = MapToOgrFieldType(field.DataType);
    var fieldDefn = new FieldDefn(field.Name, ogrType);
    
    // 设置字段宽度
    if (field.Length.HasValue && field.Length.Value > 0)
    {
        fieldDefn.SetWidth(field.Length.Value);
    }
    
    // 设置精度
    if (field.Precision.HasValue && field.Precision.Value > 0)
    {
        fieldDefn.SetPrecision(field.Precision.Value);
    }
    
    return fieldDefn;
}

private FieldType MapToOgrFieldType(FieldDataType dataType)
{
    return dataType switch
    {
        FieldDataType.INTEGER => FieldType.OFTInteger,
        FieldDataType.LONG => FieldType.OFTInteger64,
        FieldDataType.DOUBLE or FieldDataType.FLOAT => FieldType.OFTReal,
        FieldDataType.STRING => FieldType.OFTString,
        FieldDataType.DATE => FieldType.OFTDate,
        FieldDataType.DATETIME => FieldType.OFTDateTime,
        FieldDataType.BINARY => FieldType.OFTBinary,
        _ => FieldType.OFTString
    };
}
```

### 5.4.4 写入要素

```csharp
private void WriteFeature(Layer ogrLayer, OguFeature oguFeature, IList<OguField> fields)
{
    if (string.IsNullOrWhiteSpace(oguFeature.Wkt))
        return;
    
    Feature? ogrFeature = null;
    OSGeo.OGR.Geometry? geometry = null;
    
    try
    {
        // 创建要素
        ogrFeature = new Feature(ogrLayer.GetLayerDefn());
        
        // 设置几何
        geometry = OSGeo.OGR.Geometry.CreateFromWkt(oguFeature.Wkt);
        if (geometry != null)
        {
            ogrFeature.SetGeometry(geometry);
        }
        
        // 设置属性
        foreach (var field in fields)
        {
            var fieldIndex = ogrFeature.GetFieldIndex(field.Name);
            if (fieldIndex >= 0)
            {
                var value = oguFeature.GetValue(field.Name);
                SetFieldValue(ogrFeature, fieldIndex, value, field.DataType);
            }
        }
        
        // 添加到图层
        if (ogrLayer.CreateFeature(ogrFeature) != 0)
        {
            Console.WriteLine($"Warning: Failed to create feature {oguFeature.Fid}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Warning: Error writing feature {oguFeature.Fid}: {ex.Message}");
    }
    finally
    {
        geometry?.Dispose();
        ogrFeature?.Dispose();
    }
}

private void SetFieldValue(Feature feature, int fieldIndex, object? value, FieldDataType dataType)
{
    if (value == null)
    {
        feature.UnsetField(fieldIndex);
        return;
    }
    
    switch (dataType)
    {
        case FieldDataType.INTEGER:
            feature.SetField(fieldIndex, Convert.ToInt32(value));
            break;
            
        case FieldDataType.LONG:
            feature.SetField(fieldIndex, Convert.ToInt64(value));
            break;
            
        case FieldDataType.DOUBLE:
        case FieldDataType.FLOAT:
            feature.SetField(fieldIndex, Convert.ToDouble(value));
            break;
            
        case FieldDataType.DATE:
        case FieldDataType.DATETIME:
            if (value is DateTime dt)
            {
                feature.SetField(fieldIndex, 
                    dt.Year, dt.Month, dt.Day,
                    dt.Hour, dt.Minute, dt.Second, 0);
            }
            break;
            
        default:
            feature.SetField(fieldIndex, value.ToString());
            break;
    }
}
```

## 5.5 驱动详解

### 5.5.1 查看可用驱动

```csharp
using OpenGIS.Utils.Configuration;

// 获取所有驱动
var drivers = GdalConfiguration.GetSupportedDrivers();
Console.WriteLine($"Total drivers: {drivers.Count}");

foreach (var driver in drivers)
{
    Console.WriteLine($"  - {driver}");
}

// 检查特定驱动
Console.WriteLine($"\nDriver availability:");
Console.WriteLine($"  ESRI Shapefile: {GdalConfiguration.IsDriverAvailable("ESRI Shapefile")}");
Console.WriteLine($"  GeoJSON: {GdalConfiguration.IsDriverAvailable("GeoJSON")}");
Console.WriteLine($"  GPKG: {GdalConfiguration.IsDriverAvailable("GPKG")}");
Console.WriteLine($"  FileGDB: {GdalConfiguration.IsDriverAvailable("FileGDB")}");
Console.WriteLine($"  OpenFileGDB: {GdalConfiguration.IsDriverAvailable("OpenFileGDB")}");
Console.WriteLine($"  PostgreSQL: {GdalConfiguration.IsDriverAvailable("PostgreSQL")}");
```

### 5.5.2 常用驱动对照表

| 格式 | 驱动名称 | 读取 | 写入 | 说明 |
|-----|---------|------|------|------|
| Shapefile | ESRI Shapefile | ✅ | ✅ | 最常用格式 |
| GeoJSON | GeoJSON | ✅ | ✅ | Web标准格式 |
| GeoPackage | GPKG | ✅ | ✅ | OGC标准 |
| FileGDB | FileGDB | ✅ | ✅ | 需要FileGDB SDK |
| FileGDB | OpenFileGDB | ✅ | ❌ | 只读，无需SDK |
| PostGIS | PostgreSQL | ✅ | ✅ | 需要连接字符串 |
| KML | KML | ✅ | ✅ | Google Earth |
| DXF | DXF | ✅ | ✅ | AutoCAD交换格式 |
| CSV | CSV | ✅ | ✅ | 文本表格 |
| GPX | GPX | ✅ | ✅ | GPS交换格式 |

### 5.5.3 特殊格式处理

**PostGIS连接：**

```csharp
// PostGIS连接字符串格式
string connStr = "PG:host=localhost dbname=mydb user=postgres password=secret";

// 读取PostGIS表
var layer = OguLayerUtil.ReadLayer(
    DataFormatType.POSTGIS,
    connStr,
    layerName: "public.my_table"
);
```

**FileGDB处理：**

```csharp
// 检查FileGDB驱动
bool hasFileGDB = GdalConfiguration.IsDriverAvailable("FileGDB");
bool hasOpenFileGDB = GdalConfiguration.IsDriverAvailable("OpenFileGDB");

if (hasFileGDB)
{
    // 完整读写支持
    var layer = OguLayerUtil.ReadLayer(DataFormatType.FILEGDB, "data.gdb", "LayerName");
}
else if (hasOpenFileGDB)
{
    // 只读支持
    Console.WriteLine("FileGDB driver not available, using OpenFileGDB (read-only)");
}
```

## 5.6 数据过滤

### 5.6.1 属性过滤

```csharp
// SQL WHERE子句语法
var layer = OguLayerUtil.ReadLayer(
    DataFormatType.SHP,
    "cities.shp",
    attributeFilter: "Population > 1000000"
);

// 复杂条件
var filtered = OguLayerUtil.ReadLayer(
    DataFormatType.SHP,
    "cities.shp",
    attributeFilter: "Province = '广东省' AND Population > 500000"
);

// 字符串匹配
var match = OguLayerUtil.ReadLayer(
    DataFormatType.SHP,
    "cities.shp",
    attributeFilter: "Name LIKE '%市%'"
);
```

### 5.6.2 空间过滤

```csharp
// 使用矩形范围过滤
var bbox = "POLYGON ((116.0 39.0, 117.0 39.0, 117.0 40.0, 116.0 40.0, 116.0 39.0))";
var layer = OguLayerUtil.ReadLayer(
    DataFormatType.SHP,
    "cities.shp",
    spatialFilterWkt: bbox
);

// 使用圆形范围过滤
var circle = GeometryUtil.BufferWkt("POINT (116.404 39.915)", 0.5);
var nearbyLayer = OguLayerUtil.ReadLayer(
    DataFormatType.SHP,
    "cities.shp",
    spatialFilterWkt: circle
);
```

### 5.6.3 组合过滤

```csharp
// 同时使用属性和空间过滤
var layer = OguLayerUtil.ReadLayer(
    DataFormatType.SHP,
    "cities.shp",
    attributeFilter: "Population > 500000",
    spatialFilterWkt: "POLYGON ((116.0 39.0, 117.0 39.0, 117.0 40.0, 116.0 40.0, 116.0 39.0))"
);
```

## 5.7 格式转换

### 5.7.1 基本转换

```csharp
// Shapefile → GeoJSON
OguLayerUtil.ConvertFormat(
    "input.shp",
    DataFormatType.SHP,
    "output.geojson",
    DataFormatType.GEOJSON
);

// GeoJSON → GeoPackage
OguLayerUtil.ConvertFormat(
    "input.geojson",
    DataFormatType.GEOJSON,
    "output.gpkg",
    DataFormatType.GEOPACKAGE
);
```

### 5.7.2 带处理的转换

```csharp
// 1. 读取
var layer = OguLayerUtil.ReadLayer(DataFormatType.SHP, "input.shp");

// 2. 处理
// 例如：坐标转换
foreach (var feature in layer.Features)
{
    if (!string.IsNullOrEmpty(feature.Wkt))
    {
        feature.Wkt = CrsUtil.Transform(feature.Wkt, 4326, 4490);
    }
}
layer.Wkid = 4490;

// 3. 写入
OguLayerUtil.WriteLayer(DataFormatType.GEOJSON, layer, "output.geojson");
```

### 5.7.3 批量转换

```csharp
var inputDir = "input/";
var outputDir = "output/";

var shpFiles = Directory.GetFiles(inputDir, "*.shp");

foreach (var shpFile in shpFiles)
{
    var fileName = Path.GetFileNameWithoutExtension(shpFile);
    var outputFile = Path.Combine(outputDir, $"{fileName}.geojson");
    
    Console.WriteLine($"Converting: {fileName}");
    OguLayerUtil.ConvertFormat(
        shpFile, DataFormatType.SHP,
        outputFile, DataFormatType.GEOJSON
    );
}
```

## 5.8 性能优化

### 5.8.1 大文件处理

```csharp
// 使用空间索引加速查询
// GDAL会自动使用.shx等索引文件

// 对于大数据集，使用过滤减少读取量
var layer = OguLayerUtil.ReadLayer(
    DataFormatType.SHP,
    "large_dataset.shp",
    attributeFilter: "Type = 'City'",  // 减少读取量
    spatialFilterWkt: bbox              // 空间过滤
);
```

### 5.8.2 内存管理

```csharp
// 分批处理大量数据
void ProcessLargeDataset(string inputPath, int batchSize = 1000)
{
    using var dataSource = Ogr.Open(inputPath, 0);
    var ogrLayer = dataSource.GetLayerByIndex(0);
    
    ogrLayer.ResetReading();
    var batch = new List<OguFeature>();
    
    Feature? ogrFeature;
    while ((ogrFeature = ogrLayer.GetNextFeature()) != null)
    {
        using (ogrFeature)
        {
            var feature = ConvertFeature(ogrFeature);
            batch.Add(feature);
            
            if (batch.Count >= batchSize)
            {
                ProcessBatch(batch);
                batch.Clear();
                GC.Collect();  // 适当回收内存
            }
        }
    }
    
    if (batch.Count > 0)
    {
        ProcessBatch(batch);
    }
}
```

### 5.8.3 并行处理

```csharp
// 异步读取多个文件
async Task<OguLayer[]> ReadMultipleFilesAsync(string[] paths)
{
    var tasks = paths.Select(path => 
        OguLayerUtil.ReadLayerAsync(DataFormatType.SHP, path));
    
    return await Task.WhenAll(tasks);
}

// 使用示例
var paths = new[] { "file1.shp", "file2.shp", "file3.shp" };
var layers = await ReadMultipleFilesAsync(paths);
```

## 5.9 错误处理

### 5.9.1 常见错误处理

```csharp
try
{
    var layer = OguLayerUtil.ReadLayer(DataFormatType.SHP, "data.shp");
}
catch (ArgumentException ex)
{
    Console.WriteLine($"参数错误: {ex.Message}");
}
catch (FileNotFoundException ex)
{
    Console.WriteLine($"文件不存在: {ex.FileName}");
}
catch (Exception ex) when (ex.Message.Contains("Failed to open"))
{
    Console.WriteLine($"无法打开数据源: {ex.Message}");
}
catch (Exception ex)
{
    Console.WriteLine($"未知错误: {ex.Message}");
}
```

### 5.9.2 驱动检查

```csharp
public void SafeWrite(OguLayer layer, string path, string driverName)
{
    // 检查驱动可用性
    if (!GdalConfiguration.IsDriverAvailable(driverName))
    {
        throw new EngineNotSupportedException(
            $"Driver '{driverName}' is not available. " +
            $"Available drivers: {string.Join(", ", GdalConfiguration.GetSupportedDrivers().Take(10))}...");
    }
    
    // 执行写入
    var options = new Dictionary<string, object> { { "driver", driverName } };
    OguLayerUtil.WriteLayer(DataFormatType.SHP, layer, path, options: options);
}
```

## 5.10 小结

本章详细介绍了OGU4Net的GDAL引擎架构：

1. **GDAL选择**：行业标准、格式全面、性能优秀
2. **GdalEngine**：引擎实现，创建读写器
3. **GdalReader**：数据读取、过滤、类型映射
4. **GdalWriter**：数据写入、驱动推断、字段创建
5. **驱动系统**：多种格式支持、特殊格式处理
6. **性能优化**：大文件处理、内存管理、并行处理

理解GDAL引擎的实现细节，有助于解决实际开发中遇到的问题，并进行必要的扩展和优化。
