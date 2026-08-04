---
layout: default
title: 第08章：Shapefile 文件操作
---

# 第08章：Shapefile 文件操作

## 8.1 Shapefile 格式概述

Shapefile 是 Esri 开发的一种广泛使用的矢量数据格式，虽然是专有格式，但已成为 GIS 数据交换的事实标准。NetTopologySuite.IO.Esri.Shapefile 提供了完整的 Shapefile 读写支持。

### 8.1.1 Shapefile 组成文件

Shapefile 实际上由多个文件组成：

| 扩展名 | 必需 | 说明 |
|--------|------|------|
| .shp | 是 | 几何数据（主文件） |
| .shx | 是 | 几何索引 |
| .dbf | 是 | 属性数据（dBase 格式） |
| .prj | 否 | 坐标系定义（WKT 格式） |
| .cpg | 否 | 字符编码定义 |
| .sbn/.sbx | 否 | 空间索引 |

### 8.1.2 Shapefile 支持的几何类型

| ShapeType | 说明 | NTS 对应类型 |
|-----------|------|--------------|
| Point | 点 | Point |
| PolyLine | 线（多段线） | LineString/MultiLineString |
| Polygon | 多边形 | Polygon/MultiPolygon |
| MultiPoint | 多点 | MultiPoint |
| PointZ | 三维点 | Point (with Z) |
| PolyLineZ | 三维线 | LineString (with Z) |
| PolygonZ | 三维多边形 | Polygon (with Z) |
| PointM | 带 M 值的点 | Point (with M) |
| PolyLineM | 带 M 值的线 | LineString (with M) |
| PolygonM | 带 M 值的多边形 | Polygon (with M) |

### 8.1.3 安装 Shapefile 库

```bash
# 安装 NetTopologySuite.IO.Esri.Shapefile
dotnet add package NetTopologySuite.IO.Esri.Shapefile
```

## 8.2 读取 Shapefile

### 8.2.1 基本读取

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO.Esri;

// 读取所有要素
var features = Shapefile.ReadAllFeatures("path/to/file.shp");

Console.WriteLine($"要素数量: {features.Count}");

foreach (var feature in features)
{
    Console.WriteLine($"几何类型: {feature.Geometry.GeometryType}");
    Console.WriteLine($"属性: {string.Join(", ", feature.Attributes.GetNames())}");
}
```

### 8.2.2 使用 ShapefileReader

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO.Esri.Shapefiles.Readers;

// 使用 ShapefileReader 进行更细粒度的控制
using (var reader = Shapefile.OpenRead("path/to/file.shp"))
{
    Console.WriteLine($"Shape类型: {reader.ShapeType}");
    Console.WriteLine($"边界: {reader.BoundingBox}");
    Console.WriteLine($"字段数量: {reader.Fields.Count}");
    
    // 读取所有要素
    while (reader.Read())
    {
        var geometry = reader.Geometry;
        var attributes = new AttributesTable();
        
        // 读取属性
        for (int i = 0; i < reader.Fields.Count; i++)
        {
            var field = reader.Fields[i];
            var value = reader.GetValue(i);
            attributes.Add(field.Name, value);
        }
        
        Console.WriteLine($"几何: {geometry.GeometryType}");
    }
}
```

### 8.2.3 读取字段信息

```csharp
using NetTopologySuite.IO.Esri.Shapefiles.Readers;

using (var reader = Shapefile.OpenRead("path/to/file.shp"))
{
    Console.WriteLine("字段信息：");
    foreach (var field in reader.Fields)
    {
        Console.WriteLine($"  名称: {field.Name}");
        Console.WriteLine($"  类型: {field.FieldType}");
        Console.WriteLine($"  长度: {field.Length}");
        Console.WriteLine($"  小数位: {field.NumericScale}");
        Console.WriteLine("---");
    }
}
```

### 8.2.4 读取坐标系信息

```csharp
using NetTopologySuite.IO.Esri;

// 读取 .prj 文件
var prjPath = "path/to/file.prj";
if (File.Exists(prjPath))
{
    var wkt = File.ReadAllText(prjPath);
    Console.WriteLine($"坐标系 WKT: {wkt}");
    
    // 可以使用 ProjNet 解析坐标系
    // var csFactory = new CoordinateSystemFactory();
    // var cs = csFactory.CreateFromWkt(wkt);
}
```

### 8.2.5 读取带编码的 Shapefile

```csharp
using NetTopologySuite.IO.Esri;
using System.Text;

// 指定编码（处理中文属性）
var options = new ShapefileReaderOptions
{
    Encoding = Encoding.GetEncoding("GB2312")  // 或 "GBK", "UTF-8"
};

var features = Shapefile.ReadAllFeatures("path/to/file.shp", options);

// 或检查 .cpg 文件
var cpgPath = "path/to/file.cpg";
if (File.Exists(cpgPath))
{
    var encodingName = File.ReadAllText(cpgPath).Trim();
    Console.WriteLine($"编码: {encodingName}");
}
```

## 8.3 写入 Shapefile

### 8.3.1 基本写入

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Esri;

var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 创建要素列表
var features = new List<Feature>();

// 添加点要素
var point1 = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
features.Add(new Feature(point1, new AttributesTable
{
    { "name", "北京" },
    { "population", 21540000 },
    { "area", 16410.54 }
}));

var point2 = factory.CreatePoint(new Coordinate(121.4737, 31.2304));
features.Add(new Feature(point2, new AttributesTable
{
    { "name", "上海" },
    { "population", 24870000 },
    { "area", 6340.5 }
}));

// 写入 Shapefile
Shapefile.WriteAllFeatures(features, "cities.shp");

Console.WriteLine("Shapefile 写入成功！");
```

### 8.3.2 写入多边形

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Esri;

var factory = new GeometryFactory(new PrecisionModel(), 4326);
var features = new List<Feature>();

// 创建多边形
var polygon1 = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(116.3, 39.8), new Coordinate(116.5, 39.8),
    new Coordinate(116.5, 40.0), new Coordinate(116.3, 40.0),
    new Coordinate(116.3, 39.8)
});
features.Add(new Feature(polygon1, new AttributesTable
{
    { "name", "区域A" },
    { "type", "residential" }
}));

// 创建带孔多边形
var shell = factory.CreateLinearRing(new Coordinate[]
{
    new Coordinate(116.6, 39.8), new Coordinate(117.0, 39.8),
    new Coordinate(117.0, 40.2), new Coordinate(116.6, 40.2),
    new Coordinate(116.6, 39.8)
});
var hole = factory.CreateLinearRing(new Coordinate[]
{
    new Coordinate(116.7, 39.9), new Coordinate(116.9, 39.9),
    new Coordinate(116.9, 40.1), new Coordinate(116.7, 40.1),
    new Coordinate(116.7, 39.9)
});
var polygon2 = factory.CreatePolygon(shell, new[] { hole });
features.Add(new Feature(polygon2, new AttributesTable
{
    { "name", "区域B" },
    { "type", "industrial" }
}));

Shapefile.WriteAllFeatures(features, "regions.shp");
```

### 8.3.3 写入线要素

```csharp
var factory = new GeometryFactory(new PrecisionModel(), 4326);
var features = new List<Feature>();

// 单条线
var line1 = factory.CreateLineString(new Coordinate[]
{
    new Coordinate(116.3, 39.9),
    new Coordinate(116.4, 39.95),
    new Coordinate(116.5, 39.9)
});
features.Add(new Feature(line1, new AttributesTable
{
    { "name", "道路1" },
    { "length", line1.Length }
}));

// 多线
var multiLine = factory.CreateMultiLineString(new LineString[]
{
    factory.CreateLineString(new Coordinate[]
    {
        new Coordinate(116.4, 39.8), new Coordinate(116.4, 40.0)
    }),
    factory.CreateLineString(new Coordinate[]
    {
        new Coordinate(116.45, 39.8), new Coordinate(116.45, 40.0)
    })
});
features.Add(new Feature(multiLine, new AttributesTable
{
    { "name", "并行道路" },
    { "length", multiLine.Length }
}));

Shapefile.WriteAllFeatures(features, "roads.shp");
```

### 8.3.4 指定字段定义

```csharp
using NetTopologySuite.IO.Esri;
using NetTopologySuite.IO.Esri.Dbf.Fields;

var factory = new GeometryFactory(new PrecisionModel(), 4326);
var features = new List<Feature>();

// 添加要素
features.Add(new Feature(
    factory.CreatePoint(new Coordinate(116.4074, 39.9042)),
    new AttributesTable
    {
        { "name", "北京" },
        { "code", "BJ" },
        { "population", 21540000 },
        { "area", 16410.54 },
        { "created", DateTime.Now }
    }
));

// 定义字段结构
var options = new ShapefileWriterOptions(ShapeType.Point)
{
    // 可以在这里配置选项
};

Shapefile.WriteAllFeatures(features, "cities_custom.shp");
```

### 8.3.5 写入带编码的 Shapefile

```csharp
using NetTopologySuite.IO.Esri;
using System.Text;

var factory = new GeometryFactory(new PrecisionModel(), 4326);
var features = new List<Feature>();

features.Add(new Feature(
    factory.CreatePoint(new Coordinate(116.4074, 39.9042)),
    new AttributesTable
    {
        { "name", "北京市" },
        { "province", "北京" }
    }
));

// 使用 UTF-8 编码
var options = new ShapefileWriterOptions(ShapeType.Point)
{
    Encoding = Encoding.UTF8
};

Shapefile.WriteAllFeatures(features, "cities_utf8.shp", options);

// 创建 .cpg 文件
File.WriteAllText("cities_utf8.cpg", "UTF-8");
```

## 8.4 Shapefile 服务封装

### 8.4.1 完整的 Shapefile 服务类

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Esri;
using System.Text;

public class ShapefileService
{
    private readonly GeometryFactory _factory;

    public ShapefileService(int srid = 4326)
    {
        _factory = new GeometryFactory(new PrecisionModel(), srid);
    }

    /// <summary>
    /// 读取 Shapefile 文件
    /// </summary>
    public List<Feature> ReadShapefile(string path, Encoding? encoding = null)
    {
        var options = new ShapefileReaderOptions();
        if (encoding != null)
        {
            options.Encoding = encoding;
        }
        
        return Shapefile.ReadAllFeatures(path, options).ToList();
    }

    /// <summary>
    /// 写入 Shapefile 文件
    /// </summary>
    public void WriteShapefile(
        IEnumerable<Feature> features, 
        string path,
        Encoding? encoding = null)
    {
        var featureList = features.ToList();
        if (featureList.Count == 0)
        {
            throw new ArgumentException("要素列表不能为空");
        }

        // 确定几何类型
        var shapeType = DetermineShapeType(featureList.First().Geometry);
        
        var options = new ShapefileWriterOptions(shapeType);
        if (encoding != null)
        {
            options.Encoding = encoding;
        }

        Shapefile.WriteAllFeatures(featureList, path, options);
        
        // 创建 .cpg 文件
        if (encoding != null)
        {
            var cpgPath = Path.ChangeExtension(path, ".cpg");
            File.WriteAllText(cpgPath, encoding.WebName.ToUpper());
        }
    }

    /// <summary>
    /// 获取 Shapefile 信息
    /// </summary>
    public ShapefileInfo GetShapefileInfo(string path)
    {
        var info = new ShapefileInfo();
        
        using (var reader = Shapefile.OpenRead(path))
        {
            info.ShapeType = reader.ShapeType.ToString();
            info.BoundingBox = reader.BoundingBox;
            info.FeatureCount = 0;
            
            // 获取字段信息
            info.Fields = reader.Fields.Select(f => new FieldInfo
            {
                Name = f.Name,
                Type = f.FieldType.ToString(),
                Length = f.Length,
                DecimalCount = f.NumericScale
            }).ToList();
            
            // 计算要素数量
            while (reader.Read())
            {
                info.FeatureCount++;
            }
        }
        
        // 读取坐标系
        var prjPath = Path.ChangeExtension(path, ".prj");
        if (File.Exists(prjPath))
        {
            info.CoordinateSystemWkt = File.ReadAllText(prjPath);
        }
        
        return info;
    }

    /// <summary>
    /// 筛选要素
    /// </summary>
    public List<Feature> FilterFeatures(
        string path, 
        Func<Feature, bool> predicate)
    {
        var features = ReadShapefile(path);
        return features.Where(predicate).ToList();
    }

    /// <summary>
    /// 空间查询
    /// </summary>
    public List<Feature> SpatialQuery(
        string path, 
        Geometry queryGeometry,
        SpatialRelation relation = SpatialRelation.Intersects)
    {
        var features = ReadShapefile(path);
        
        return features.Where(f => 
        {
            return relation switch
            {
                SpatialRelation.Intersects => f.Geometry.Intersects(queryGeometry),
                SpatialRelation.Contains => queryGeometry.Contains(f.Geometry),
                SpatialRelation.Within => f.Geometry.Within(queryGeometry),
                SpatialRelation.Touches => f.Geometry.Touches(queryGeometry),
                _ => false
            };
        }).ToList();
    }

    /// <summary>
    /// 合并 Shapefile
    /// </summary>
    public void MergeShapefiles(IEnumerable<string> inputPaths, string outputPath)
    {
        var allFeatures = new List<Feature>();
        
        foreach (var path in inputPaths)
        {
            var features = ReadShapefile(path);
            allFeatures.AddRange(features);
        }
        
        WriteShapefile(allFeatures, outputPath);
    }

    /// <summary>
    /// 转换为 GeoJSON
    /// </summary>
    public string ConvertToGeoJson(string shapefilePath)
    {
        var features = ReadShapefile(shapefilePath);
        var collection = new FeatureCollection();
        
        foreach (var feature in features)
        {
            collection.Add(feature);
        }
        
        var writer = new NetTopologySuite.IO.GeoJsonWriter();
        return writer.Write(collection);
    }

    /// <summary>
    /// 从 GeoJSON 创建 Shapefile
    /// </summary>
    public void CreateFromGeoJson(string geoJson, string outputPath)
    {
        var reader = new NetTopologySuite.IO.GeoJsonReader();
        var collection = reader.Read<FeatureCollection>(geoJson);
        
        WriteShapefile(collection.ToList(), outputPath);
    }

    private ShapeType DetermineShapeType(Geometry geometry)
    {
        return geometry switch
        {
            Point => ShapeType.Point,
            MultiPoint => ShapeType.MultiPoint,
            LineString => ShapeType.PolyLine,
            MultiLineString => ShapeType.PolyLine,
            Polygon => ShapeType.Polygon,
            MultiPolygon => ShapeType.Polygon,
            _ => throw new NotSupportedException($"不支持的几何类型: {geometry.GeometryType}")
        };
    }
}

public class ShapefileInfo
{
    public string ShapeType { get; set; }
    public Envelope BoundingBox { get; set; }
    public int FeatureCount { get; set; }
    public List<FieldInfo> Fields { get; set; }
    public string CoordinateSystemWkt { get; set; }
}

public class FieldInfo
{
    public string Name { get; set; }
    public string Type { get; set; }
    public int Length { get; set; }
    public int DecimalCount { get; set; }
}

public enum SpatialRelation
{
    Intersects,
    Contains,
    Within,
    Touches
}
```

### 8.4.2 使用示例

```csharp
var service = new ShapefileService(4326);

// 读取 Shapefile
var features = service.ReadShapefile("cities.shp", Encoding.UTF8);
Console.WriteLine($"读取了 {features.Count} 个要素");

// 获取文件信息
var info = service.GetShapefileInfo("cities.shp");
Console.WriteLine($"几何类型: {info.ShapeType}");
Console.WriteLine($"要素数量: {info.FeatureCount}");
Console.WriteLine($"字段: {string.Join(", ", info.Fields.Select(f => f.Name))}");

// 空间查询
var factory = new GeometryFactory(new PrecisionModel(), 4326);
var queryArea = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(116, 39), new Coordinate(117, 39),
    new Coordinate(117, 40), new Coordinate(116, 40),
    new Coordinate(116, 39)
});
var filtered = service.SpatialQuery("cities.shp", queryArea, SpatialRelation.Within);
Console.WriteLine($"区域内要素数量: {filtered.Count}");

// 转换为 GeoJSON
var geoJson = service.ConvertToGeoJson("cities.shp");
File.WriteAllText("cities.geojson", geoJson);
```

## 8.5 批量处理

### 8.5.1 批量转换

```csharp
public class BatchProcessor
{
    private readonly ShapefileService _service;

    public BatchProcessor()
    {
        _service = new ShapefileService();
    }

    /// <summary>
    /// 批量转换 Shapefile 到 GeoJSON
    /// </summary>
    public void BatchConvertToGeoJson(string inputDir, string outputDir)
    {
        Directory.CreateDirectory(outputDir);
        
        var shapefiles = Directory.GetFiles(inputDir, "*.shp");
        
        foreach (var shpPath in shapefiles)
        {
            var fileName = Path.GetFileNameWithoutExtension(shpPath);
            var outputPath = Path.Combine(outputDir, $"{fileName}.geojson");
            
            try
            {
                var geoJson = _service.ConvertToGeoJson(shpPath);
                File.WriteAllText(outputPath, geoJson);
                Console.WriteLine($"转换成功: {fileName}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"转换失败 {fileName}: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// 批量重投影
    /// </summary>
    public void BatchReproject(
        string inputDir, 
        string outputDir,
        Func<Geometry, Geometry> reprojectFunc)
    {
        Directory.CreateDirectory(outputDir);
        
        var shapefiles = Directory.GetFiles(inputDir, "*.shp");
        
        foreach (var shpPath in shapefiles)
        {
            var features = _service.ReadShapefile(shpPath);
            var reprojected = features.Select(f =>
            {
                var newGeom = reprojectFunc(f.Geometry);
                return new Feature(newGeom, f.Attributes);
            }).ToList();
            
            var outputPath = Path.Combine(outputDir, Path.GetFileName(shpPath));
            _service.WriteShapefile(reprojected, outputPath);
        }
    }

    /// <summary>
    /// 按属性分割 Shapefile
    /// </summary>
    public void SplitByAttribute(string inputPath, string outputDir, string fieldName)
    {
        Directory.CreateDirectory(outputDir);
        
        var features = _service.ReadShapefile(inputPath);
        
        // 按属性值分组
        var groups = features.GroupBy(f => f.Attributes[fieldName]?.ToString() ?? "null");
        
        foreach (var group in groups)
        {
            var outputPath = Path.Combine(outputDir, $"{group.Key}.shp");
            _service.WriteShapefile(group.ToList(), outputPath);
            Console.WriteLine($"创建文件: {group.Key}.shp ({group.Count()} 个要素)");
        }
    }
}
```

### 8.5.2 数据验证和修复

```csharp
public class DataValidator
{
    private readonly GeometryFactory _factory;

    public DataValidator()
    {
        _factory = new GeometryFactory();
    }

    /// <summary>
    /// 验证 Shapefile 数据
    /// </summary>
    public ValidationResult ValidateShapefile(string path)
    {
        var result = new ValidationResult();
        var features = Shapefile.ReadAllFeatures(path).ToList();
        
        result.TotalFeatures = features.Count;
        
        for (int i = 0; i < features.Count; i++)
        {
            var feature = features[i];
            
            // 检查空几何
            if (feature.Geometry == null || feature.Geometry.IsEmpty)
            {
                result.EmptyGeometries.Add(i);
                continue;
            }
            
            // 检查无效几何
            if (!feature.Geometry.IsValid)
            {
                result.InvalidGeometries.Add(new InvalidGeometryInfo
                {
                    Index = i,
                    Reason = GetInvalidReason(feature.Geometry)
                });
            }
            
            // 检查空属性
            foreach (var name in feature.Attributes.GetNames())
            {
                if (feature.Attributes[name] == null || 
                    feature.Attributes[name].ToString() == "")
                {
                    if (!result.NullAttributes.ContainsKey(name))
                    {
                        result.NullAttributes[name] = new List<int>();
                    }
                    result.NullAttributes[name].Add(i);
                }
            }
        }
        
        return result;
    }

    /// <summary>
    /// 修复无效几何
    /// </summary>
    public List<Feature> FixGeometries(IEnumerable<Feature> features)
    {
        var fixed = new List<Feature>();
        
        foreach (var feature in features)
        {
            var geometry = feature.Geometry;
            
            if (geometry == null || geometry.IsEmpty)
            {
                continue;  // 跳过空几何
            }
            
            if (!geometry.IsValid)
            {
                // 尝试修复
                geometry = geometry.Buffer(0);
                if (geometry.IsEmpty)
                {
                    continue;  // 修复失败
                }
            }
            
            fixed.Add(new Feature(geometry, feature.Attributes));
        }
        
        return fixed;
    }

    private string GetInvalidReason(Geometry geometry)
    {
        var validator = new NetTopologySuite.Operation.Valid.IsValidOp(geometry);
        var error = validator.ValidationError;
        return error?.Message ?? "未知错误";
    }
}

public class ValidationResult
{
    public int TotalFeatures { get; set; }
    public List<int> EmptyGeometries { get; set; } = new();
    public List<InvalidGeometryInfo> InvalidGeometries { get; set; } = new();
    public Dictionary<string, List<int>> NullAttributes { get; set; } = new();

    public bool IsValid => EmptyGeometries.Count == 0 && InvalidGeometries.Count == 0;
}

public class InvalidGeometryInfo
{
    public int Index { get; set; }
    public string Reason { get; set; }
}
```

## 8.6 与数据库集成

### 8.6.1 导入到数据库

```csharp
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

public class SpatialEntity
{
    public int Id { get; set; }
    public string Name { get; set; }
    public Geometry Geometry { get; set; }
    public Dictionary<string, object> Properties { get; set; }
}

public class ShapefileDatabaseImporter
{
    private readonly ShapefileService _shapefileService;
    private readonly DbContext _dbContext;

    public ShapefileDatabaseImporter(DbContext dbContext)
    {
        _shapefileService = new ShapefileService();
        _dbContext = dbContext;
    }

    /// <summary>
    /// 导入 Shapefile 到数据库
    /// </summary>
    public async Task ImportToDatabase(string shapefilePath, string tableName)
    {
        var features = _shapefileService.ReadShapefile(shapefilePath);
        
        foreach (var feature in features)
        {
            var entity = new SpatialEntity
            {
                Name = feature.Attributes["name"]?.ToString() ?? "",
                Geometry = feature.Geometry,
                Properties = feature.Attributes.GetNames()
                    .ToDictionary(n => n, n => feature.Attributes[n])
            };
            
            _dbContext.Add(entity);
        }
        
        await _dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// 从数据库导出到 Shapefile
    /// </summary>
    public void ExportFromDatabase<T>(
        IQueryable<T> query, 
        string outputPath,
        Func<T, Feature> mapper)
    {
        var features = query.AsEnumerable()
            .Select(mapper)
            .ToList();
        
        _shapefileService.WriteShapefile(features, outputPath);
    }
}
```

## 8.7 本章小结

本章详细介绍了 NetTopologySuite 的 Shapefile 文件操作：

1. **Shapefile 格式**：了解 Shapefile 的组成和结构
2. **读取 Shapefile**：使用 Shapefile.ReadAllFeatures 和 ShapefileReader
3. **写入 Shapefile**：创建点、线、多边形 Shapefile
4. **服务封装**：完整的 ShapefileService 类
5. **批量处理**：批量转换、分割、合并
6. **数据验证**：验证和修复几何数据
7. **数据库集成**：导入导出数据库数据

## 8.8 下一步

下一章我们将学习 PostGIS 数据库集成，包括：

- PostGIS 基础配置
- Npgsql.NetTopologySuite 使用
- EF Core 集成
- 空间查询和分析

---

**相关资源**：

- [Shapefile 技术规范](https://www.esri.com/library/whitepapers/pdfs/shapefile.pdf)
- [NetTopologySuite.IO.Esri GitHub](https://github.com/NetTopologySuite/NetTopologySuite.IO.Esri)
- [dBASE 文件格式](https://www.dbase.com/Knowledgebase/INT/db7_file_fmt.htm)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第08章-Shapefile文件操作/第07章-GeoJSON数据处理/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第08章-Shapefile文件操作/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第08章-Shapefile文件操作/第09章-PostGIS数据库集成/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
