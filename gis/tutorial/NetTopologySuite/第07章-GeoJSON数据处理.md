---
layout: default
title: 第07章：GeoJSON 数据处理
---

# 第07章：GeoJSON 数据处理

## 7.1 GeoJSON 格式概述

GeoJSON 是一种基于 JSON 的地理数据交换格式，是 Web GIS 应用中最常用的矢量数据格式。NetTopologySuite.IO.GeoJSON 提供了完整的 GeoJSON 读写支持。

### 7.1.1 GeoJSON 规范

GeoJSON 遵循 RFC 7946 规范，支持以下几何类型：

| 几何类型 | GeoJSON 名称 | 说明 |
|----------|--------------|------|
| 点 | Point | 单个点坐标 |
| 线 | LineString | 点坐标数组 |
| 多边形 | Polygon | 环坐标数组 |
| 多点 | MultiPoint | 点数组 |
| 多线 | MultiLineString | 线数组 |
| 多多边形 | MultiPolygon | 多边形数组 |
| 几何集合 | GeometryCollection | 任意几何数组 |

### 7.1.2 GeoJSON 结构示例

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [116.4074, 39.9042]
      },
      "properties": {
        "name": "北京",
        "population": 21540000
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[116.3, 39.8], [116.5, 39.8], [116.5, 40.0], [116.3, 40.0], [116.3, 39.8]]
        ]
      },
      "properties": {
        "name": "区域A",
        "area": 0.04
      }
    }
  ]
}
```

### 7.1.3 安装 GeoJSON 库

```bash
# 安装 NetTopologySuite.IO.GeoJSON
dotnet add package NetTopologySuite.IO.GeoJSON
```

该包支持两种 JSON 库：
- **Newtonsoft.Json**：默认支持
- **System.Text.Json**：需要额外配置

## 7.2 使用 Newtonsoft.Json 读写 GeoJSON

### 7.2.1 基本读取

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json;

var factory = new GeometryFactory(new PrecisionModel(), 4326);
var serializer = GeoJsonSerializer.Create(factory);

// 读取 GeoJSON 字符串
var geoJson = @"{
    ""type"": ""Point"",
    ""coordinates"": [116.4074, 39.9042]
}";

using (var stringReader = new StringReader(geoJson))
using (var jsonReader = new JsonTextReader(stringReader))
{
    var geometry = serializer.Deserialize<Geometry>(jsonReader);
    Console.WriteLine($"几何类型: {geometry.GeometryType}");
    Console.WriteLine($"坐标: ({geometry.Centroid.X}, {geometry.Centroid.Y})");
}
```

### 7.2.2 基本写入

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json;

var factory = new GeometryFactory(new PrecisionModel(), 4326);
var serializer = GeoJsonSerializer.Create(factory);

// 创建几何
var point = factory.CreatePoint(new Coordinate(116.4074, 39.9042));

// 写入 GeoJSON
using (var stringWriter = new StringWriter())
using (var jsonWriter = new JsonTextWriter(stringWriter))
{
    jsonWriter.Formatting = Formatting.Indented;
    serializer.Serialize(jsonWriter, point);
    var geoJson = stringWriter.ToString();
    Console.WriteLine(geoJson);
}

// 输出:
// {
//   "type": "Point",
//   "coordinates": [116.4074, 39.9042]
// }
```

### 7.2.3 读写复杂几何

```csharp
// 读取多边形
var polygonJson = @"{
    ""type"": ""Polygon"",
    ""coordinates"": [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[2, 2], [2, 8], [8, 8], [8, 2], [2, 2]]
    ]
}";

using (var reader = new StringReader(polygonJson))
using (var jsonReader = new JsonTextReader(reader))
{
    var polygon = serializer.Deserialize<Polygon>(jsonReader);
    Console.WriteLine($"外环点数: {polygon.ExteriorRing.NumPoints}");
    Console.WriteLine($"内环数量: {polygon.NumInteriorRings}");
    Console.WriteLine($"面积: {polygon.Area}");
}

// 写入多边形
var shell = factory.CreateLinearRing(new Coordinate[]
{
    new Coordinate(0, 0), new Coordinate(20, 0),
    new Coordinate(20, 20), new Coordinate(0, 20), new Coordinate(0, 0)
});
var hole = factory.CreateLinearRing(new Coordinate[]
{
    new Coordinate(5, 5), new Coordinate(5, 15),
    new Coordinate(15, 15), new Coordinate(15, 5), new Coordinate(5, 5)
});
var polygon = factory.CreatePolygon(shell, new[] { hole });

using (var writer = new StringWriter())
using (var jsonWriter = new JsonTextWriter(writer))
{
    jsonWriter.Formatting = Formatting.Indented;
    serializer.Serialize(jsonWriter, polygon);
    Console.WriteLine(writer.ToString());
}
```

### 7.2.4 使用 GeoJsonWriter 和 GeoJsonReader

```csharp
using NetTopologySuite.IO;

var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 使用 GeoJsonWriter
var writer = new GeoJsonWriter();
var point = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
var geoJson = writer.Write(point);
Console.WriteLine($"写入结果: {geoJson}");

// 使用 GeoJsonReader
var reader = new GeoJsonReader();
var geometry = reader.Read<Geometry>(geoJson);
Console.WriteLine($"读取类型: {geometry.GeometryType}");

// 读取为特定类型
var pointRead = reader.Read<Point>(geoJson);
Console.WriteLine($"点坐标: ({pointRead.X}, {pointRead.Y})");
```

## 7.3 Feature 和 FeatureCollection

### 7.3.1 读取 Feature

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO;

var featureJson = @"{
    ""type"": ""Feature"",
    ""geometry"": {
        ""type"": ""Point"",
        ""coordinates"": [116.4074, 39.9042]
    },
    ""properties"": {
        ""name"": ""北京"",
        ""population"": 21540000,
        ""isCapital"": true
    }
}";

var reader = new GeoJsonReader();
var feature = reader.Read<Feature>(featureJson);

Console.WriteLine($"几何类型: {feature.Geometry.GeometryType}");
Console.WriteLine($"名称: {feature.Attributes["name"]}");
Console.WriteLine($"人口: {feature.Attributes["population"]}");
Console.WriteLine($"是否首都: {feature.Attributes["isCapital"]}");
```

### 7.3.2 创建和写入 Feature

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO;

var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 创建几何
var point = factory.CreatePoint(new Coordinate(116.4074, 39.9042));

// 创建属性表
var attributes = new AttributesTable
{
    { "name", "北京" },
    { "population", 21540000 },
    { "isCapital", true },
    { "area", 16410.54 }
};

// 创建 Feature
var feature = new Feature(point, attributes);

// 写入 GeoJSON
var writer = new GeoJsonWriter();
var geoJson = writer.Write(feature);
Console.WriteLine(geoJson);
```

### 7.3.3 读取 FeatureCollection

```csharp
var featureCollectionJson = @"{
    ""type"": ""FeatureCollection"",
    ""features"": [
        {
            ""type"": ""Feature"",
            ""geometry"": {
                ""type"": ""Point"",
                ""coordinates"": [116.4074, 39.9042]
            },
            ""properties"": { ""name"": ""北京"" }
        },
        {
            ""type"": ""Feature"",
            ""geometry"": {
                ""type"": ""Point"",
                ""coordinates"": [121.4737, 31.2304]
            },
            ""properties"": { ""name"": ""上海"" }
        }
    ]
}";

var reader = new GeoJsonReader();
var collection = reader.Read<FeatureCollection>(featureCollectionJson);

Console.WriteLine($"要素数量: {collection.Count}");

foreach (var feature in collection)
{
    Console.WriteLine($"城市: {feature.Attributes["name"]}, " +
                      $"坐标: {feature.Geometry.AsText()}");
}
```

### 7.3.4 创建和写入 FeatureCollection

```csharp
var factory = new GeometryFactory(new PrecisionModel(), 4326);
var collection = new FeatureCollection();

// 添加北京
var beijing = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
collection.Add(new Feature(beijing, new AttributesTable
{
    { "name", "北京" },
    { "population", 21540000 }
}));

// 添加上海
var shanghai = factory.CreatePoint(new Coordinate(121.4737, 31.2304));
collection.Add(new Feature(shanghai, new AttributesTable
{
    { "name", "上海" },
    { "population", 24870000 }
}));

// 添加区域
var region = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(110, 30), new Coordinate(120, 30),
    new Coordinate(120, 40), new Coordinate(110, 40), new Coordinate(110, 30)
});
collection.Add(new Feature(region, new AttributesTable
{
    { "name", "华北地区" },
    { "area", 1000000 }
}));

// 写入 GeoJSON
var writer = new GeoJsonWriter();
var geoJson = writer.Write(collection);
Console.WriteLine(geoJson);
```

## 7.4 使用 System.Text.Json

### 7.4.1 配置 System.Text.Json 支持

```csharp
using NetTopologySuite.IO.Converters;
using System.Text.Json;

// 创建 JsonSerializerOptions
var options = new JsonSerializerOptions
{
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
};

// 添加 GeoJson 转换器
options.Converters.Add(new GeoJsonConverterFactory());
```

### 7.4.2 读取 GeoJSON

```csharp
using NetTopologySuite.IO.Converters;
using NetTopologySuite.Geometries;
using System.Text.Json;

var options = new JsonSerializerOptions();
options.Converters.Add(new GeoJsonConverterFactory());

var geoJson = @"{
    ""type"": ""Point"",
    ""coordinates"": [116.4074, 39.9042]
}";

var geometry = JsonSerializer.Deserialize<Geometry>(geoJson, options);
Console.WriteLine($"类型: {geometry.GeometryType}");
Console.WriteLine($"WKT: {geometry.AsText()}");
```

### 7.4.3 写入 GeoJSON

```csharp
var factory = new GeometryFactory(new PrecisionModel(), 4326);
var point = factory.CreatePoint(new Coordinate(116.4074, 39.9042));

var options = new JsonSerializerOptions
{
    WriteIndented = true
};
options.Converters.Add(new GeoJsonConverterFactory());

var geoJson = JsonSerializer.Serialize(point, options);
Console.WriteLine(geoJson);
```

### 7.4.4 在 ASP.NET Core 中配置

```csharp
// Program.cs
using NetTopologySuite.IO.Converters;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // 添加 GeoJSON 转换器
        options.JsonSerializerOptions.Converters.Add(
            new GeoJsonConverterFactory());
        
        // 配置 JSON 选项
        options.JsonSerializerOptions.WriteIndented = true;
        options.JsonSerializerOptions.PropertyNamingPolicy = 
            JsonNamingPolicy.CamelCase;
    });

var app = builder.Build();
app.MapControllers();
app.Run();
```

## 7.5 文件读写

### 7.5.1 读取 GeoJSON 文件

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO;

public class GeoJsonFileService
{
    private readonly GeoJsonReader _reader;
    private readonly GeoJsonWriter _writer;

    public GeoJsonFileService()
    {
        _reader = new GeoJsonReader();
        _writer = new GeoJsonWriter();
    }

    /// <summary>
    /// 从文件读取 FeatureCollection
    /// </summary>
    public FeatureCollection ReadFeatureCollection(string filePath)
    {
        var json = File.ReadAllText(filePath);
        return _reader.Read<FeatureCollection>(json);
    }

    /// <summary>
    /// 从文件读取单个几何
    /// </summary>
    public Geometry ReadGeometry(string filePath)
    {
        var json = File.ReadAllText(filePath);
        return _reader.Read<Geometry>(json);
    }

    /// <summary>
    /// 异步读取
    /// </summary>
    public async Task<FeatureCollection> ReadFeatureCollectionAsync(string filePath)
    {
        var json = await File.ReadAllTextAsync(filePath);
        return _reader.Read<FeatureCollection>(json);
    }

    /// <summary>
    /// 写入 FeatureCollection 到文件
    /// </summary>
    public void WriteFeatureCollection(string filePath, FeatureCollection collection)
    {
        var json = _writer.Write(collection);
        File.WriteAllText(filePath, json);
    }

    /// <summary>
    /// 异步写入
    /// </summary>
    public async Task WriteFeatureCollectionAsync(
        string filePath, 
        FeatureCollection collection)
    {
        var json = _writer.Write(collection);
        await File.WriteAllTextAsync(filePath, json);
    }
}

// 使用示例
var service = new GeoJsonFileService();

// 读取文件
var collection = service.ReadFeatureCollection("cities.geojson");
Console.WriteLine($"读取了 {collection.Count} 个要素");

// 修改数据
foreach (var feature in collection)
{
    feature.Attributes["processed"] = true;
}

// 写入文件
service.WriteFeatureCollection("cities_processed.geojson", collection);
```

### 7.5.2 流式读写

```csharp
using NetTopologySuite.IO;
using Newtonsoft.Json;

public class GeoJsonStreamService
{
    private readonly GeometryFactory _factory;

    public GeoJsonStreamService()
    {
        _factory = new GeometryFactory(new PrecisionModel(), 4326);
    }

    /// <summary>
    /// 使用流读取大文件
    /// </summary>
    public FeatureCollection ReadFromStream(Stream stream)
    {
        var serializer = GeoJsonSerializer.Create(_factory);
        
        using (var streamReader = new StreamReader(stream))
        using (var jsonReader = new JsonTextReader(streamReader))
        {
            return serializer.Deserialize<FeatureCollection>(jsonReader);
        }
    }

    /// <summary>
    /// 写入到流
    /// </summary>
    public void WriteToStream(Stream stream, FeatureCollection collection)
    {
        var serializer = GeoJsonSerializer.Create(_factory);
        
        using (var streamWriter = new StreamWriter(stream, leaveOpen: true))
        using (var jsonWriter = new JsonTextWriter(streamWriter))
        {
            jsonWriter.Formatting = Formatting.Indented;
            serializer.Serialize(jsonWriter, collection);
        }
    }
}

// 使用示例
var streamService = new GeoJsonStreamService();

// 从文件流读取
using (var fileStream = File.OpenRead("large_data.geojson"))
{
    var collection = streamService.ReadFromStream(fileStream);
    Console.WriteLine($"读取了 {collection.Count} 个要素");
}

// 写入到文件流
using (var fileStream = File.Create("output.geojson"))
{
    streamService.WriteToStream(fileStream, collection);
}
```

## 7.6 GeoJSON 与其他格式转换

### 7.6.1 WKT 与 GeoJSON 互转

```csharp
using NetTopologySuite.IO;
using NetTopologySuite.Geometries;

public class FormatConverter
{
    private readonly GeometryFactory _factory;
    private readonly WKTReader _wktReader;
    private readonly WKTWriter _wktWriter;
    private readonly GeoJsonReader _geoJsonReader;
    private readonly GeoJsonWriter _geoJsonWriter;

    public FormatConverter()
    {
        _factory = new GeometryFactory(new PrecisionModel(), 4326);
        _wktReader = new WKTReader(_factory);
        _wktWriter = new WKTWriter();
        _geoJsonReader = new GeoJsonReader();
        _geoJsonWriter = new GeoJsonWriter();
    }

    /// <summary>
    /// WKT 转 GeoJSON
    /// </summary>
    public string WktToGeoJson(string wkt)
    {
        var geometry = _wktReader.Read(wkt);
        return _geoJsonWriter.Write(geometry);
    }

    /// <summary>
    /// GeoJSON 转 WKT
    /// </summary>
    public string GeoJsonToWkt(string geoJson)
    {
        var geometry = _geoJsonReader.Read<Geometry>(geoJson);
        return _wktWriter.Write(geometry);
    }
}

// 使用示例
var converter = new FormatConverter();

// WKT 转 GeoJSON
var wkt = "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))";
var geoJson = converter.WktToGeoJson(wkt);
Console.WriteLine($"GeoJSON: {geoJson}");

// GeoJSON 转 WKT
var geoJsonStr = @"{""type"":""Point"",""coordinates"":[116.4074,39.9042]}";
var wktResult = converter.GeoJsonToWkt(geoJsonStr);
Console.WriteLine($"WKT: {wktResult}");
```

### 7.6.2 FeatureCollection 与数据对象互转

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

public class City
{
    public string Name { get; set; }
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public int Population { get; set; }
}

public class DataMapper
{
    private readonly GeometryFactory _factory;

    public DataMapper()
    {
        _factory = new GeometryFactory(new PrecisionModel(), 4326);
    }

    /// <summary>
    /// 数据对象列表转 FeatureCollection
    /// </summary>
    public FeatureCollection ToFeatureCollection(IEnumerable<City> cities)
    {
        var collection = new FeatureCollection();
        
        foreach (var city in cities)
        {
            var point = _factory.CreatePoint(
                new Coordinate(city.Longitude, city.Latitude));
            
            var attributes = new AttributesTable
            {
                { "name", city.Name },
                { "population", city.Population }
            };
            
            collection.Add(new Feature(point, attributes));
        }
        
        return collection;
    }

    /// <summary>
    /// FeatureCollection 转数据对象列表
    /// </summary>
    public List<City> FromFeatureCollection(FeatureCollection collection)
    {
        var cities = new List<City>();
        
        foreach (var feature in collection)
        {
            if (feature.Geometry is Point point)
            {
                cities.Add(new City
                {
                    Name = feature.Attributes["name"]?.ToString() ?? "",
                    Longitude = point.X,
                    Latitude = point.Y,
                    Population = Convert.ToInt32(
                        feature.Attributes["population"] ?? 0)
                });
            }
        }
        
        return cities;
    }
}

// 使用示例
var mapper = new DataMapper();

// 数据对象转 FeatureCollection
var cities = new List<City>
{
    new City { Name = "北京", Longitude = 116.4074, Latitude = 39.9042, Population = 21540000 },
    new City { Name = "上海", Longitude = 121.4737, Latitude = 31.2304, Population = 24870000 }
};

var collection = mapper.ToFeatureCollection(cities);
Console.WriteLine($"转换了 {collection.Count} 个要素");

// FeatureCollection 转数据对象
var citiesBack = mapper.FromFeatureCollection(collection);
foreach (var city in citiesBack)
{
    Console.WriteLine($"{city.Name}: {city.Population}");
}
```

## 7.7 高级用法

### 7.7.1 自定义属性处理

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO;

// 处理嵌套属性
var featureJson = @"{
    ""type"": ""Feature"",
    ""geometry"": {
        ""type"": ""Point"",
        ""coordinates"": [116.4074, 39.9042]
    },
    ""properties"": {
        ""name"": ""北京"",
        ""details"": {
            ""province"": ""北京市"",
            ""country"": ""中国""
        },
        ""tags"": [""capital"", ""historical""]
    }
}";

var reader = new GeoJsonReader();
var feature = reader.Read<Feature>(featureJson);

// 访问嵌套属性
var name = feature.Attributes["name"];
var details = feature.Attributes["details"] as IDictionary<string, object>;
var tags = feature.Attributes["tags"] as IList<object>;

Console.WriteLine($"名称: {name}");
Console.WriteLine($"省份: {details?["province"]}");
Console.WriteLine($"标签: {string.Join(", ", tags ?? Array.Empty<object>())}");
```

### 7.7.2 处理坐标参考系统

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO;

// GeoJSON 支持 CRS（已废弃但仍在使用）
var featureCollectionWithCrs = @"{
    ""type"": ""FeatureCollection"",
    ""crs"": {
        ""type"": ""name"",
        ""properties"": {
            ""name"": ""EPSG:4326""
        }
    },
    ""features"": [
        {
            ""type"": ""Feature"",
            ""geometry"": {
                ""type"": ""Point"",
                ""coordinates"": [116.4074, 39.9042]
            },
            ""properties"": { ""name"": ""北京"" }
        }
    ]
}";

var reader = new GeoJsonReader();
var collection = reader.Read<FeatureCollection>(featureCollectionWithCrs);

// 检查 CRS
if (collection.CRS != null)
{
    Console.WriteLine($"坐标系: {collection.CRS}");
}

// 设置 CRS
collection.CRS = new NamedCRS("EPSG:4326");
```

### 7.7.3 处理大数据量

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.IO;

public class LargeDataProcessor
{
    /// <summary>
    /// 分批处理大型 GeoJSON 文件
    /// </summary>
    public IEnumerable<Feature> ProcessLargeFile(string filePath, int batchSize = 1000)
    {
        var reader = new GeoJsonReader();
        var json = File.ReadAllText(filePath);
        var collection = reader.Read<FeatureCollection>(json);
        
        // 分批返回
        for (int i = 0; i < collection.Count; i += batchSize)
        {
            var batch = collection.Skip(i).Take(batchSize);
            foreach (var feature in batch)
            {
                yield return feature;
            }
        }
    }

    /// <summary>
    /// 分批写入大量数据
    /// </summary>
    public void WriteLargeCollection(
        string filePath, 
        IEnumerable<Feature> features)
    {
        var collection = new FeatureCollection();
        var writer = new GeoJsonWriter();
        
        foreach (var feature in features)
        {
            collection.Add(feature);
        }
        
        var json = writer.Write(collection);
        File.WriteAllText(filePath, json);
    }
}
```

## 7.8 API 控制器示例

### 7.8.1 完整的空间数据 API

```csharp
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

[ApiController]
[Route("api/[controller]")]
public class GeoDataController : ControllerBase
{
    private readonly GeometryFactory _factory;
    private readonly GeoJsonReader _reader;
    private readonly GeoJsonWriter _writer;

    public GeoDataController()
    {
        _factory = new GeometryFactory(new PrecisionModel(), 4326);
        _reader = new GeoJsonReader();
        _writer = new GeoJsonWriter();
    }

    /// <summary>
    /// 获取所有城市
    /// </summary>
    [HttpGet("cities")]
    public ActionResult<FeatureCollection> GetCities()
    {
        var collection = new FeatureCollection();
        
        var cities = new[]
        {
            (Name: "北京", Lon: 116.4074, Lat: 39.9042, Pop: 21540000),
            (Name: "上海", Lon: 121.4737, Lat: 31.2304, Pop: 24870000),
            (Name: "广州", Lon: 113.2644, Lat: 23.1291, Pop: 15300000)
        };
        
        foreach (var city in cities)
        {
            var point = _factory.CreatePoint(new Coordinate(city.Lon, city.Lat));
            collection.Add(new Feature(point, new AttributesTable
            {
                { "name", city.Name },
                { "population", city.Pop }
            }));
        }
        
        return Ok(collection);
    }

    /// <summary>
    /// 按范围查询
    /// </summary>
    [HttpGet("cities/bbox")]
    public ActionResult<FeatureCollection> GetCitiesByBbox(
        double minX, double minY, double maxX, double maxY)
    {
        var envelope = new Envelope(minX, maxX, minY, maxY);
        var bbox = _factory.ToGeometry(envelope);
        
        // 获取所有城市并筛选
        var allCities = GetCities().Value as FeatureCollection;
        var filtered = new FeatureCollection();
        
        foreach (var feature in allCities)
        {
            if (bbox.Contains(feature.Geometry))
            {
                filtered.Add(feature);
            }
        }
        
        return Ok(filtered);
    }

    /// <summary>
    /// 缓冲区分析
    /// </summary>
    [HttpPost("buffer")]
    public ActionResult<Feature> CreateBuffer([FromBody] BufferRequest request)
    {
        var geometry = _reader.Read<Geometry>(request.GeoJson);
        var buffer = geometry.Buffer(request.Distance);
        
        var feature = new Feature(buffer, new AttributesTable
        {
            { "source_type", geometry.GeometryType },
            { "buffer_distance", request.Distance }
        });
        
        return Ok(feature);
    }

    /// <summary>
    /// 几何运算
    /// </summary>
    [HttpPost("operation")]
    public ActionResult<Feature> PerformOperation([FromBody] OperationRequest request)
    {
        var geom1 = _reader.Read<Geometry>(request.GeoJson1);
        var geom2 = _reader.Read<Geometry>(request.GeoJson2);
        
        Geometry result = request.Operation.ToLower() switch
        {
            "union" => geom1.Union(geom2),
            "intersection" => geom1.Intersection(geom2),
            "difference" => geom1.Difference(geom2),
            "symmetric_difference" => geom1.SymmetricDifference(geom2),
            _ => throw new ArgumentException("不支持的操作类型")
        };
        
        var feature = new Feature(result, new AttributesTable
        {
            { "operation", request.Operation },
            { "result_type", result.GeometryType },
            { "result_area", result.Area }
        });
        
        return Ok(feature);
    }
}

public class BufferRequest
{
    public string GeoJson { get; set; }
    public double Distance { get; set; }
}

public class OperationRequest
{
    public string GeoJson1 { get; set; }
    public string GeoJson2 { get; set; }
    public string Operation { get; set; }
}
```

## 7.9 本章小结

本章详细介绍了 NetTopologySuite 的 GeoJSON 数据处理：

1. **GeoJSON 格式**：了解 GeoJSON 规范和结构
2. **Newtonsoft.Json**：使用 GeoJsonSerializer 读写 GeoJSON
3. **Feature/FeatureCollection**：处理带属性的空间数据
4. **System.Text.Json**：使用 GeoJsonConverterFactory
5. **文件读写**：同步和异步文件操作
6. **格式转换**：WKT 与 GeoJSON 互转
7. **高级用法**：嵌套属性、CRS、大数据处理
8. **API 集成**：ASP.NET Core 中的空间数据 API

## 7.10 下一步

下一章我们将学习 Shapefile 文件操作，包括：

- Shapefile 格式介绍
- 读取 Shapefile 文件
- 写入 Shapefile 文件
- 属性数据处理

---

**相关资源**：

- [GeoJSON 规范 RFC 7946](https://tools.ietf.org/html/rfc7946)
- [NetTopologySuite.IO.GeoJSON GitHub](https://github.com/NetTopologySuite/NetTopologySuite.IO.GeoJSON)
- [geojson.io - 在线 GeoJSON 编辑器](https://geojson.io/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第06章-空间分析算法/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第08章-Shapefile文件操作/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
