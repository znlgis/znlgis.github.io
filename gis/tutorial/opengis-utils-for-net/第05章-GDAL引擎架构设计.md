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
        DataFormatType.FILEGDB,
        DataFormatType.GEOPACKAGE,
        DataFormatType.KML,
        DataFormatType.DXF,
        DataFormatType.SHP,
        DataFormatType.GEOJSON
    };  // POSTGIS 经由 `PG:` 连接串驱动推断读写；TXT 由 GtTxtUtil 专门处理
    
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
        // 读取在进程级全局配置锁内串行执行：SHAPE_ENCODING 是进程级配置，
        // 编码敏感的打开/读取需避免并发读取互相覆盖，读取结束后恢复原值
        lock (GlobalConfigLock)
        {
            // 1. 参数验证
            if (string.IsNullOrWhiteSpace(path))
                throw new ArgumentException("Path cannot be null or empty", nameof(path));
            
            // 应用 options["encoding"]（Shapefile 属性编码）
            ApplyEncodingOption(options);
            
            OgrDataSource? dataSource = null;
            try
            {
                // 2. 打开数据源
                dataSource = Ogr.Open(path, 0); // 0 = 只读
                if (dataSource == null)
                    throw new DataSourceException($"Failed to open data source: {path}");
                
                // 3. 获取图层
                Layer ogrLayer;
                if (!string.IsNullOrWhiteSpace(layerName))
                {
                    ogrLayer = dataSource.GetLayerByName(layerName);
                    if (ogrLayer == null)
                        throw new DataSourceException($"Layer '{layerName}' not found");
                }
                else
                {
                    if (dataSource.GetLayerCount() == 0)
                        throw new DataSourceException("No layers found in data source");
                    ogrLayer = dataSource.GetLayerByIndex(0);
                }
                
                // 4. 读取并转换
                return ReadOgrLayer(ogrLayer, attributeFilter, spatialFilterWkt);
            }
            finally
            {
                // 5. 释放资源并恢复 SHAPE_ENCODING
                dataSource?.Dispose();
                RestoreShapeEncoding();
            }
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
    
    // 3. 应用属性过滤（无效过滤器抛出 FormatParseException；
    //    GPKG 等 SQL 驱动把过滤器编译推迟到首次取要素，非法过滤同样包装为 FormatParseException）
    if (!string.IsNullOrWhiteSpace(attributeFilter))
    {
        try
        {
            ogrLayer.SetAttributeFilter(attributeFilter);
        }
        catch (System.Exception ex)
        {
            throw new FormatParseException($"Invalid attribute filter: {attributeFilter}", ex);
        }
    }
    
    // 4. 应用空间过滤（无效 WKT 抛出 FormatParseException，不静默忽略）
    if (!string.IsNullOrWhiteSpace(spatialFilterWkt))
    {
        try
        {
            using var filterGeom = OSGeo.OGR.Geometry.CreateFromWkt(spatialFilterWkt);
            if (filterGeom == null)
                throw new FormatParseException($"Invalid spatial filter WKT: {spatialFilterWkt}");
            ogrLayer.SetSpatialFilter(filterGeom);
        }
        catch (FormatParseException)
        {
            throw;
        }
        catch (System.Exception ex)
        {
            throw new FormatParseException($"Invalid spatial filter WKT: {spatialFilterWkt}", ex);
        }
    }
    
    // 5. 读取要素（保留源数据 FID）
    ogrLayer.ResetReading();
    
    Feature? ogrFeature;
    while ((ogrFeature = ogrLayer.GetNextFeature()) != null)
    {
        using (ogrFeature)
        {
            var feature = new OguFeature { Fid = (int)ogrFeature.GetFID() };
            
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
                    var value = GetFieldValue(ogrFeature, fieldIndex, field.DataType, field.Name);
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
private object? GetFieldValue(Feature feature, int fieldIndex, FieldDataType dataType, string fieldName)
{
    // 检查字段是否已设置
    if (!feature.IsFieldSet(fieldIndex))
        return null;
    
    // OGR 的 null 字段（如 Shapefile 空 'D' 日期字段）按空值返回，不再抛异常
    if (feature.IsFieldNull(fieldIndex))
        return null;
    
    return dataType switch
    {
        FieldDataType.INTEGER => feature.GetFieldAsInteger(fieldIndex),
        FieldDataType.LONG => feature.GetFieldAsInteger64(fieldIndex),
        FieldDataType.DOUBLE or FieldDataType.FLOAT => feature.GetFieldAsDouble(fieldIndex),
        FieldDataType.STRING => feature.GetFieldAsString(fieldIndex),
        FieldDataType.DATE or FieldDataType.DATETIME => GetDateTimeValue(feature, fieldIndex, fieldName),
        _ => feature.GetFieldAsString(fieldIndex)
    };
}

private DateTime? GetDateTimeValue(Feature feature, int fieldIndex, string fieldName)
{
    try
    {
        feature.GetFieldAsDateTime(
            fieldIndex,
            out int year, out int month, out int day,
            out int hour, out int minute, out float second,
            out int tzFlag);
        
        // 保留 GDAL 返回的小数秒
        var wholeSeconds = (int)Math.Truncate(second);
        var fractionalTicks = (long)Math.Round(
            (second - wholeSeconds) * TimeSpan.TicksPerSecond, MidpointRounding.AwayFromZero);
        
        return new DateTime(year, month, day, hour, minute, wholeSeconds).AddTicks(fractionalTicks);
    }
    catch (System.Exception ex)
    {
        // 无法解析的日期字段以类型化异常报告，不再静默返回 null
        throw new FormatParseException($"Invalid date field '{fieldName}'", ex);
    }
}
```

### 5.3.4 获取图层名称列表

```csharp
public IList<string> GetLayerNames(string path)
{
    if (string.IsNullOrWhiteSpace(path))
        throw new ArgumentException("Path cannot be null or empty", nameof(path));
    
    using var dataSource = Ogr.Open(path, 0);
    if (dataSource == null)
        throw new DataSourceException($"Failed to open data source: {path}");
    
    var layerNames = new List<string>();
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

数据源打不开时抛出 `DataSourceException`，而不是静默返回空列表（空列表只表示数据源确实不含图层）。

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
            throw new DataSourceException($"Driver '{driverName}' not available");
        
        // 3. 确保目录存在
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }
        
        // 4. 删除已存在的文件（删除失败抛出 DataSourceException，而非忽略）
        if (File.Exists(path) || Directory.Exists(path))
        {
            if (driver.DeleteDataSource(path) != 0)
                throw new DataSourceException($"Failed to delete existing data source: {path}");
        }
        
        OgrDataSource? dataSource = null;
        try
        {
            // 5. 创建数据源
            dataSource = driver.CreateDataSource(path, new string[] { });
            if (dataSource == null)
                throw new DataSourceException($"Failed to create data source: {path}");
            
            // 6. 创建图层：几何类型按首个可解析要素的 WKT 解析，
            //    PointZ/PolylineZ 等升级为对应 25D 类型（GPKG 不再出现"声明2D却含Z几何"）；
            //    坐标系来自 layer.Wkid；图层创建选项包含 encoding/GeoJSON 坐标精度/OVERWRITE 等
            var ogrGeomType = ResolveOgrGeometryType(layer);
            var layerOptions = BuildLayerOptions(options, driverName);
            using var spatialReference = CreateSpatialReference(layer.Wkid);
            var ogrLayer = dataSource.CreateLayer(
                layerName ?? layer.Name ?? "layer",
                spatialReference,
                ogrGeomType,
                layerOptions);
            
            if (ogrLayer == null)
                throw new DataSourceException("Failed to create layer");
            
            // 7. 创建字段：DXF 等固定 schema 驱动跳过失败字段并告警，
            //    其余驱动创建失败即抛 DataSourceException；
            //    字段索引按"实际创建顺序的序数"映射，
            //    规避 GDAL 清洗字段名（如 Shapefile 截断超 10 字符名称）导致的按名查找失败
            var createdFieldOrdinals = CreateFields(ogrLayer, layer, driverName);
            var fieldIndexMap = BuildFieldIndexMap(layer, createdFieldOrdinals);
            
            // 8. 写入要素：空几何要素跳过并计数告警；
            //    非零源 FID 尽量保留（PostgreSQL 下 0 也显式保留），
            //    FID 冲突时改用自动分配重试一次；
            //    失败要素汇总后以 DataSourceException 报告
            foreach (var oguFeature in layer.Features)
            {
                WriteFeature(ogrLayer, oguFeature, layer.Fields, fieldIndexMap);
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
    
    // 数据库连接串没有文件扩展名，必须先按前缀识别，否则会误落默认 Shapefile 驱动
    if (path.StartsWith("PG:", StringComparison.OrdinalIgnoreCase))
        return "PostgreSQL";
    
    // 根据扩展名推断
    var extension = Path.GetExtension(path).ToLowerInvariant();
    return extension switch
    {
        ".shp" => "ESRI Shapefile",
        ".gdb" => "OpenFileGDB",  // GDAL 3.6+ 可写，避免依赖 ESRI SDK 的 FileGDB 驱动
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
private FieldDefn CreateOgrFieldDefn(OguField field, bool kmlDemoteDates = false)
{
    var ogrType = MapToOgrFieldType(field.DataType);
    
    // KML 规范无日期类型：OFTDate 会让原生 KML 写驱动整体失败，
    // 写入 KML/LIBKML 时日期降级为文本列，内容以 ISO 串保留
    if (kmlDemoteDates && field.DataType is FieldDataType.DATE or FieldDataType.DATETIME)
        ogrType = FieldType.OFTString;
    
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
private void WriteFeature(Layer ogrLayer, OguFeature oguFeature, IList<OguField> fields,
    Dictionary<string, int> fieldIndexMap)
{
    // 空几何要素（如 Shapefile 的 NullShape 记录）跳过并汇总计数，不判为整层失败
    if (string.IsNullOrWhiteSpace(oguFeature.Wkt))
    {
        skippedNoGeometry++;
        return;
    }
    
    Feature? ogrFeature = null;
    OSGeo.OGR.Geometry? geometry = null;
    
    try
    {
        // 创建要素，尽量保留非零源 FID（PostgreSQL 驱动下 0 也显式保留）
        ogrFeature = new Feature(ogrLayer.GetLayerDefn());
        if ((oguFeature.Fid != 0 || preserveZeroFid) && ogrFeature.SetFID(oguFeature.Fid) != 0)
            throw new System.Exception($"设置要素 FID 失败 (Fid={oguFeature.Fid})");
        
        // 设置几何
        geometry = OSGeo.OGR.Geometry.CreateFromWkt(oguFeature.Wkt);
        if (geometry == null)
            throw new System.Exception($"无法解析要素几何 (Fid={oguFeature.Fid})");
        if (ogrFeature.SetGeometry(geometry) != 0)
            throw new System.Exception($"设置要素几何失败 (Fid={oguFeature.Fid})");
        
        // 设置属性（按预计算的字段序数映射，不受 GDAL 名称清洗影响）
        foreach (var field in fields)
        {
            if (fieldIndexMap.TryGetValue(field.Name, out var fieldIndex))
            {
                var value = oguFeature.GetValue(field.Name);
                SetFieldValue(ogrFeature, fieldIndex, value, field.DataType, field.Name);
            }
        }
        
        // 添加到图层；FID 冲突（GPKG/OpenFileGDB UNIQUE 约束）时改用自动分配重试一次
        if (!TryCreateFeature(ogrLayer, ogrFeature) && (oguFeature.Fid != 0 || preserveZeroFid))
        {
            ogrFeature.SetFID(-1);
            TryCreateFeature(ogrLayer, ogrFeature);
        }
    }
    catch (System.Exception ex)
    {
        // 单个要素失败不再 Console.WriteLine，而是计入失败数并以结构化日志告警，
        // 处理完全部输入后汇总抛出 DataSourceException
        failedCount++;
        Logger.LogWarning(ex, "写入要素时出错 (Fid={Fid})", oguFeature.Fid);
    }
    finally
    {
        geometry?.Dispose();
        ogrFeature?.Dispose();
    }
}

private void SetFieldValue(Feature feature, int fieldIndex, object? value, FieldDataType dataType,
    string fieldName)
{
    if (value == null)
    {
        // 优先使用 OGR null 语义（GDAL 3.3+），GeoJSON 的 WRITE_NULL_FIELDS 等选项
        // 依赖 null 而非 unset；旧绑定不支持时回退 UnsetField
        try { feature.SetFieldNull(fieldIndex); }
        catch (System.Exception) { feature.UnsetField(fieldIndex); }
        return;
    }
    
    switch (dataType)
    {
        case FieldDataType.INTEGER:
            feature.SetField(fieldIndex, Convert.ToInt32(value, CultureInfo.InvariantCulture));
            break;
            
        case FieldDataType.LONG:
            feature.SetField(fieldIndex, Convert.ToInt64(value, CultureInfo.InvariantCulture));
            break;
            
        case FieldDataType.DOUBLE:
        case FieldDataType.FLOAT:
            feature.SetField(fieldIndex, Convert.ToDouble(value, CultureInfo.InvariantCulture));
            break;
            
        case FieldDataType.DATE:
        case FieldDataType.DATETIME:
            if (value is not DateTime dt)
                throw new FormatException($"Value for date field '{fieldName}' is not a DateTime");
            
            // 保留毫秒小数秒
            var seconds = dt.Second + (float)dt.Millisecond / 1000;
            feature.SetField(fieldIndex, dt.Year, dt.Month, dt.Day, dt.Hour, dt.Minute, seconds, 0);
            break;
            
        default:
            feature.SetField(fieldIndex, value.ToString());
            break;
    }
    
    if (!feature.IsFieldSet(fieldIndex))
        throw new DataSourceException($"Failed to set field '{fieldName}'");
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
| FileGDB | FileGDB | ✅ | ✅ | 依赖 ESRI FileGDB SDK，运行时可能缺失 |
| FileGDB | OpenFileGDB | ✅ | ✅ | 无需SDK；GDAL 3.6+ 支持创建，OGU4Net 写 `.gdb` 默认使用该驱动 |
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

if (hasOpenFileGDB)
{
    // GDAL 3.6+ 起 OpenFileGDB 可读写，GdalWriter 对 .gdb 默认选择该驱动
    var layer = OguLayerUtil.ReadLayer(DataFormatType.FILEGDB, "data.gdb", "LayerName");
}
else if (hasFileGDB)
{
    // 依赖 ESRI SDK 的 FileGDB 驱动
    Console.WriteLine("FileGDB driver is available");
}
else
{
    Console.WriteLine("No FileGDB driver available");
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

> **注意**：`GdalReader` 的读取操作在进程级配置锁内串行执行（保护 `SHAPE_ENCODING` 等全局配置），并行读取不会带来吞吐提升；`async` 版本仅用于避免阻塞调用线程。

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
catch (DataSourceException ex)
{
    // 数据源打不开、图层不存在等（类型化异常，不再依赖消息文本匹配）
    Console.WriteLine($"无法打开数据源: {ex.Message}");
}
catch (FormatParseException ex)
{
    // 无效的属性/空间过滤器、无法解析的日期字段等
    Console.WriteLine($"解析失败: {ex.Message}");
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

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/opengis-utils-for-net/第04章-统一图层模型详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/opengis-utils-for-net/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/opengis-utils-for-net/第06章-数据格式转换实战/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
