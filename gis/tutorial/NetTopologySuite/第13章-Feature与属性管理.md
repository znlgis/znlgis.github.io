---
layout: default
title: 第13章：Feature 与属性管理
---

# 第13章：Feature 与属性管理

## 13.1 Feature 模型概述

Feature（要素）是 GIS 中的核心概念，由几何对象和属性数据组成。NetTopologySuite.Features 提供了完整的 Feature 模型支持。

### 13.1.1 安装

```bash
dotnet add package NetTopologySuite.Features
```

### 13.1.2 Feature 类结构

```csharp
public class Feature : IFeature
{
    public Geometry Geometry { get; set; }
    public IAttributesTable Attributes { get; set; }
    public Envelope BoundingBox { get; }
}
```

## 13.2 AttributesTable 详解

### 13.2.1 创建属性表

```csharp
using NetTopologySuite.Features;

// 方法1：使用初始化器
var attributes1 = new AttributesTable
{
    { "name", "北京" },
    { "population", 21540000 },
    { "area", 16410.54 },
    { "isCapital", true }
};

// 方法2：使用 Add 方法
var attributes2 = new AttributesTable();
attributes2.Add("name", "上海");
attributes2.Add("population", 24870000);

// 方法3：从字典创建
var dict = new Dictionary<string, object>
{
    { "name", "广州" },
    { "population", 15300000 }
};
var attributes3 = new AttributesTable(dict);
```

### 13.2.2 访问属性

```csharp
var attributes = new AttributesTable
{
    { "name", "北京" },
    { "population", 21540000 },
    { "area", 16410.54 }
};

// 通过索引器访问
var name = attributes["name"];
Console.WriteLine($"名称: {name}");

// 通过 GetOptionalValue 安全访问
var population = attributes.GetOptionalValue("population");
Console.WriteLine($"人口: {population}");

// 访问不存在的属性
var unknown = attributes.GetOptionalValue("unknown");  // 返回 null

// 获取所有属性名
var names = attributes.GetNames();
Console.WriteLine($"属性: {string.Join(", ", names)}");

// 获取所有值
var values = attributes.GetValues();

// 检查属性是否存在
var exists = attributes.Exists("name");
Console.WriteLine($"name 存在: {exists}");
```

### 13.2.3 修改属性

```csharp
var attributes = new AttributesTable
{
    { "name", "北京" },
    { "population", 21000000 }
};

// 修改属性值
attributes["population"] = 21540000;

// 添加新属性
attributes.Add("area", 16410.54);

// 删除属性
attributes.DeleteAttribute("area");

// 获取属性数量
Console.WriteLine($"属性数量: {attributes.Count}");
```

### 13.2.4 类型安全访问

```csharp
public static class AttributesTableExtensions
{
    public static T? GetValue<T>(this IAttributesTable table, string name)
    {
        var value = table.GetOptionalValue(name);
        if (value == null)
            return default;
        
        return (T)Convert.ChangeType(value, typeof(T));
    }

    public static T GetValueOrDefault<T>(
        this IAttributesTable table, 
        string name, 
        T defaultValue)
    {
        var value = table.GetOptionalValue(name);
        if (value == null)
            return defaultValue;
        
        try
        {
            return (T)Convert.ChangeType(value, typeof(T));
        }
        catch
        {
            return defaultValue;
        }
    }
}

// 使用示例
var attributes = new AttributesTable
{
    { "name", "北京" },
    { "population", 21540000 },
    { "area", 16410.54 }
};

var name = attributes.GetValue<string>("name");
var population = attributes.GetValue<int>("population");
var area = attributes.GetValueOrDefault<double>("area", 0);
var unknown = attributes.GetValueOrDefault<string>("unknown", "N/A");
```

## 13.3 Feature 操作

### 13.3.1 创建 Feature

```csharp
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 创建点要素
var point = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
var pointFeature = new Feature(point, new AttributesTable
{
    { "name", "北京" },
    { "type", "city" }
});

// 创建多边形要素
var polygon = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(116.3, 39.8), new Coordinate(116.5, 39.8),
    new Coordinate(116.5, 40.0), new Coordinate(116.3, 40.0),
    new Coordinate(116.3, 39.8)
});
var polygonFeature = new Feature(polygon, new AttributesTable
{
    { "name", "北京区域" },
    { "area", polygon.Area }
});

// 访问要素属性
Console.WriteLine($"几何类型: {pointFeature.Geometry.GeometryType}");
Console.WriteLine($"边界框: {pointFeature.BoundingBox}");
Console.WriteLine($"名称: {pointFeature.Attributes["name"]}");
```

### 13.3.2 Feature 复制

```csharp
// 深复制 Feature
public static Feature CloneFeature(Feature feature)
{
    var newGeometry = (Geometry)feature.Geometry.Copy();
    var newAttributes = new AttributesTable();
    
    foreach (var name in feature.Attributes.GetNames())
    {
        newAttributes.Add(name, feature.Attributes[name]);
    }
    
    return new Feature(newGeometry, newAttributes);
}

var original = new Feature(
    factory.CreatePoint(new Coordinate(0, 0)),
    new AttributesTable { { "id", 1 } }
);

var clone = CloneFeature(original);
clone.Attributes["id"] = 2;

Console.WriteLine($"Original ID: {original.Attributes["id"]}");  // 1
Console.WriteLine($"Clone ID: {clone.Attributes["id"]}");        // 2
```

## 13.4 FeatureCollection 详解

### 13.4.1 创建 FeatureCollection

```csharp
using NetTopologySuite.Features;

var collection = new FeatureCollection();

// 添加要素
collection.Add(new Feature(
    factory.CreatePoint(new Coordinate(116.4074, 39.9042)),
    new AttributesTable { { "name", "北京" } }
));

collection.Add(new Feature(
    factory.CreatePoint(new Coordinate(121.4737, 31.2304)),
    new AttributesTable { { "name", "上海" } }
));

Console.WriteLine($"要素数量: {collection.Count}");
Console.WriteLine($"边界框: {collection.BoundingBox}");
```

### 13.4.2 遍历和查询

```csharp
// 遍历所有要素
foreach (var feature in collection)
{
    Console.WriteLine($"名称: {feature.Attributes["name"]}");
}

// 使用 LINQ 查询
var citiesWithLargePopulation = collection
    .Where(f => f.Attributes.GetOptionalValue("population") is int pop && pop > 10000000)
    .ToList();

// 按属性筛选
var beijing = collection
    .FirstOrDefault(f => f.Attributes["name"]?.ToString() == "北京");

// 按几何类型筛选
var points = collection
    .Where(f => f.Geometry is Point)
    .ToList();

var polygons = collection
    .Where(f => f.Geometry is Polygon || f.Geometry is MultiPolygon)
    .ToList();
```

### 13.4.3 空间查询

```csharp
public static class FeatureCollectionExtensions
{
    /// <summary>
    /// 范围查询
    /// </summary>
    public static IEnumerable<IFeature> QueryByExtent(
        this FeatureCollection collection,
        Envelope extent)
    {
        return collection
            .Where(f => extent.Intersects(f.Geometry.EnvelopeInternal));
    }

    /// <summary>
    /// 相交查询
    /// </summary>
    public static IEnumerable<IFeature> QueryByGeometry(
        this FeatureCollection collection,
        Geometry queryGeometry,
        SpatialRelation relation = SpatialRelation.Intersects)
    {
        return collection.Where(f => relation switch
        {
            SpatialRelation.Intersects => f.Geometry.Intersects(queryGeometry),
            SpatialRelation.Contains => queryGeometry.Contains(f.Geometry),
            SpatialRelation.Within => f.Geometry.Within(queryGeometry),
            _ => false
        });
    }

    /// <summary>
    /// 距离查询
    /// </summary>
    public static IEnumerable<IFeature> QueryByDistance(
        this FeatureCollection collection,
        Point center,
        double maxDistance)
    {
        return collection
            .Where(f => f.Geometry.Distance(center) <= maxDistance)
            .OrderBy(f => f.Geometry.Distance(center));
    }
}

public enum SpatialRelation
{
    Intersects,
    Contains,
    Within
}

// 使用示例
var queryArea = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(115, 39), new Coordinate(118, 39),
    new Coordinate(118, 41), new Coordinate(115, 41),
    new Coordinate(115, 39)
});

var featuresInArea = collection.QueryByGeometry(queryArea).ToList();
Console.WriteLine($"区域内要素数量: {featuresInArea.Count}");
```

## 13.5 数据转换

### 13.5.1 Feature 与实体对象互转

```csharp
public class City
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int Population { get; set; }
    public double Longitude { get; set; }
    public double Latitude { get; set; }
}

public class FeatureMapper
{
    private readonly GeometryFactory _factory;

    public FeatureMapper()
    {
        _factory = new GeometryFactory(new PrecisionModel(), 4326);
    }

    /// <summary>
    /// 实体转 Feature
    /// </summary>
    public Feature ToFeature(City city)
    {
        var point = _factory.CreatePoint(
            new Coordinate(city.Longitude, city.Latitude));
        
        var attributes = new AttributesTable
        {
            { "id", city.Id },
            { "name", city.Name },
            { "population", city.Population }
        };
        
        return new Feature(point, attributes);
    }

    /// <summary>
    /// Feature 转实体
    /// </summary>
    public City FromFeature(Feature feature)
    {
        var point = (Point)feature.Geometry;
        
        return new City
        {
            Id = Convert.ToInt32(feature.Attributes["id"]),
            Name = feature.Attributes["name"]?.ToString() ?? "",
            Population = Convert.ToInt32(feature.Attributes["population"]),
            Longitude = point.X,
            Latitude = point.Y
        };
    }

    /// <summary>
    /// 实体列表转 FeatureCollection
    /// </summary>
    public FeatureCollection ToFeatureCollection(IEnumerable<City> cities)
    {
        var collection = new FeatureCollection();
        foreach (var city in cities)
        {
            collection.Add(ToFeature(city));
        }
        return collection;
    }

    /// <summary>
    /// FeatureCollection 转实体列表
    /// </summary>
    public List<City> FromFeatureCollection(FeatureCollection collection)
    {
        return collection
            .Select(f => FromFeature((Feature)f))
            .ToList();
    }
}
```

### 13.5.2 使用反射的通用转换器

```csharp
public class GenericFeatureMapper<T> where T : class, new()
{
    private readonly GeometryFactory _factory;
    private readonly string _geometryProperty;
    private readonly Func<T, Geometry> _geometryGetter;
    private readonly Action<T, Geometry> _geometrySetter;

    public GenericFeatureMapper(
        string geometryProperty,
        Func<T, Geometry> geometryGetter,
        Action<T, Geometry> geometrySetter,
        int srid = 4326)
    {
        _factory = new GeometryFactory(new PrecisionModel(), srid);
        _geometryProperty = geometryProperty;
        _geometryGetter = geometryGetter;
        _geometrySetter = geometrySetter;
    }

    public Feature ToFeature(T entity)
    {
        var geometry = _geometryGetter(entity);
        var attributes = new AttributesTable();
        
        var properties = typeof(T).GetProperties()
            .Where(p => p.Name != _geometryProperty && p.CanRead);
        
        foreach (var prop in properties)
        {
            var value = prop.GetValue(entity);
            if (value != null)
            {
                attributes.Add(prop.Name, value);
            }
        }
        
        return new Feature(geometry, attributes);
    }

    public T FromFeature(Feature feature)
    {
        var entity = new T();
        
        _geometrySetter(entity, feature.Geometry);
        
        var properties = typeof(T).GetProperties()
            .Where(p => p.Name != _geometryProperty && p.CanWrite);
        
        foreach (var prop in properties)
        {
            if (feature.Attributes.Exists(prop.Name))
            {
                var value = feature.Attributes[prop.Name];
                if (value != null)
                {
                    prop.SetValue(entity, Convert.ChangeType(value, prop.PropertyType));
                }
            }
        }
        
        return entity;
    }
}
```

## 13.6 属性统计与分析

### 13.6.1 属性统计

```csharp
public class FeatureStatistics
{
    /// <summary>
    /// 计算数值属性的统计信息
    /// </summary>
    public static Statistics CalculateStatistics(
        FeatureCollection collection,
        string attributeName)
    {
        var values = collection
            .Select(f => f.Attributes.GetOptionalValue(attributeName))
            .Where(v => v != null)
            .Select(v => Convert.ToDouble(v))
            .ToList();

        if (values.Count == 0)
            return new Statistics();

        return new Statistics
        {
            Count = values.Count,
            Sum = values.Sum(),
            Min = values.Min(),
            Max = values.Max(),
            Mean = values.Average(),
            StandardDeviation = CalculateStdDev(values)
        };
    }

    private static double CalculateStdDev(List<double> values)
    {
        var mean = values.Average();
        var sumOfSquares = values.Sum(v => Math.Pow(v - mean, 2));
        return Math.Sqrt(sumOfSquares / values.Count);
    }

    /// <summary>
    /// 按属性分组统计
    /// </summary>
    public static Dictionary<object, int> GroupByAttribute(
        FeatureCollection collection,
        string attributeName)
    {
        return collection
            .GroupBy(f => f.Attributes.GetOptionalValue(attributeName) ?? "null")
            .ToDictionary(g => g.Key, g => g.Count());
    }
}

public class Statistics
{
    public int Count { get; set; }
    public double Sum { get; set; }
    public double Min { get; set; }
    public double Max { get; set; }
    public double Mean { get; set; }
    public double StandardDeviation { get; set; }
}

// 使用示例
var stats = FeatureStatistics.CalculateStatistics(collection, "population");
Console.WriteLine($"人口统计:");
Console.WriteLine($"  数量: {stats.Count}");
Console.WriteLine($"  总和: {stats.Sum:N0}");
Console.WriteLine($"  平均: {stats.Mean:N0}");
Console.WriteLine($"  最小: {stats.Min:N0}");
Console.WriteLine($"  最大: {stats.Max:N0}");

var groups = FeatureStatistics.GroupByAttribute(collection, "type");
foreach (var group in groups)
{
    Console.WriteLine($"{group.Key}: {group.Value} 个");
}
```

## 13.7 本章小结

本章详细介绍了 Feature 与属性管理：

1. **AttributesTable**：属性表的创建、访问、修改
2. **Feature 操作**：创建、复制要素
3. **FeatureCollection**：要素集合的管理和查询
4. **数据转换**：Feature 与实体对象互转
5. **属性统计**：数值统计和分组统计

## 13.8 下一步

下一章我们将学习高级功能与性能优化。

---

**相关资源**：

- [NetTopologySuite.Features](https://www.nuget.org/packages/NetTopologySuite.Features/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第12章-矢量切片生成/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第14章-高级功能与性能优化/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
