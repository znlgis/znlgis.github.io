# 第09章：PostGIS 数据库集成

## 9.1 PostGIS 概述

PostGIS 是 PostgreSQL 数据库的空间扩展，提供了存储、查询和分析地理空间数据的能力。NetTopologySuite 通过 Npgsql.NetTopologySuite 包实现与 PostGIS 的无缝集成。

### 9.1.1 PostGIS 特性

- **空间数据类型**：geometry、geography
- **空间索引**：GiST、SP-GiST 索引
- **空间函数**：ST_Distance、ST_Contains、ST_Buffer 等
- **坐标系支持**：数千种坐标系，支持转换
- **栅格支持**：PostGIS Raster

### 9.1.2 安装 NuGet 包

```bash
# 基础 Npgsql 包
dotnet add package Npgsql.NetTopologySuite

# EF Core 集成（如需要）
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite
```

## 9.2 基础配置

### 9.2.1 创建 PostGIS 数据库

```sql
-- 创建数据库
CREATE DATABASE spatial_demo;

-- 连接到数据库
\c spatial_demo

-- 启用 PostGIS 扩展
CREATE EXTENSION postgis;

-- 验证安装
SELECT PostGIS_Version();
```

### 9.2.2 配置 Npgsql 数据源

```csharp
using Npgsql;
using NetTopologySuite;

// 配置全局 NTS 支持
var dataSourceBuilder = new NpgsqlDataSourceBuilder(
    "Host=localhost;Database=spatial_demo;Username=postgres;Password=postgres");

// 启用 NetTopologySuite
dataSourceBuilder.UseNetTopologySuite();

// 构建数据源
await using var dataSource = dataSourceBuilder.Build();

// 获取连接
await using var connection = await dataSource.OpenConnectionAsync();
Console.WriteLine("连接成功！");
```

### 9.2.3 配置 GeometryFactory

```csharp
using NetTopologySuite;
using NetTopologySuite.Geometries;

// 创建几何服务
var geometryServices = new NtsGeometryServices(
    coordinateSequenceFactory: CoordinateArraySequenceFactory.Instance,
    precisionModel: new PrecisionModel(1000000),  // 6位小数精度
    srid: 4326,
    geometryOverlay: GeometryOverlay.NG,
    coordinateEqualityComparer: new CoordinateEqualityComparer()
);

// 获取工厂
var factory = geometryServices.CreateGeometryFactory(4326);
```

## 9.3 基本 CRUD 操作

### 9.3.1 创建表

```csharp
await using var cmd = dataSource.CreateCommand();

cmd.CommandText = @"
    CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        population INTEGER,
        location GEOMETRY(Point, 4326)
    );
    
    -- 创建空间索引
    CREATE INDEX IF NOT EXISTS idx_cities_location 
    ON cities USING GIST (location);
";

await cmd.ExecuteNonQueryAsync();
Console.WriteLine("表创建成功！");
```

### 9.3.2 插入数据

```csharp
using NetTopologySuite.Geometries;

var factory = new GeometryFactory(new PrecisionModel(), 4326);

await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    INSERT INTO cities (name, population, location) 
    VALUES (@name, @population, @location)
";

// 创建点
var point = factory.CreatePoint(new Coordinate(116.4074, 39.9042));

cmd.Parameters.AddWithValue("name", "北京");
cmd.Parameters.AddWithValue("population", 21540000);
cmd.Parameters.AddWithValue("location", point);

await cmd.ExecuteNonQueryAsync();
Console.WriteLine("数据插入成功！");
```

### 9.3.3 批量插入

```csharp
var cities = new[]
{
    ("上海", 24870000, 121.4737, 31.2304),
    ("广州", 15300000, 113.2644, 23.1291),
    ("深圳", 13440000, 114.0579, 22.5431),
    ("成都", 16330000, 104.0665, 30.5728)
};

await using var batch = dataSource.CreateBatch();

foreach (var (name, population, lon, lat) in cities)
{
    var cmd = batch.CreateBatchCommand();
    cmd.CommandText = @"
        INSERT INTO cities (name, population, location) 
        VALUES (@name, @population, ST_SetSRID(ST_MakePoint(@lon, @lat), 4326))
    ";
    cmd.Parameters.AddWithValue("name", name);
    cmd.Parameters.AddWithValue("population", population);
    cmd.Parameters.AddWithValue("lon", lon);
    cmd.Parameters.AddWithValue("lat", lat);
    
    batch.BatchCommands.Add(cmd);
}

await batch.ExecuteNonQueryAsync();
Console.WriteLine($"批量插入 {cities.Length} 条数据成功！");
```

### 9.3.4 查询数据

```csharp
await using var cmd = dataSource.CreateCommand();
cmd.CommandText = "SELECT id, name, population, location FROM cities";

await using var reader = await cmd.ExecuteReaderAsync();

while (await reader.ReadAsync())
{
    var id = reader.GetInt32(0);
    var name = reader.GetString(1);
    var population = reader.GetInt32(2);
    var location = reader.GetFieldValue<Point>(3);
    
    Console.WriteLine($"{name}: ({location.X}, {location.Y}), 人口: {population}");
}
```

### 9.3.5 更新和删除

```csharp
// 更新
await using var updateCmd = dataSource.CreateCommand();
updateCmd.CommandText = @"
    UPDATE cities 
    SET population = @population 
    WHERE name = @name
";
updateCmd.Parameters.AddWithValue("name", "北京");
updateCmd.Parameters.AddWithValue("population", 21540000);
await updateCmd.ExecuteNonQueryAsync();

// 删除
await using var deleteCmd = dataSource.CreateCommand();
deleteCmd.CommandText = "DELETE FROM cities WHERE name = @name";
deleteCmd.Parameters.AddWithValue("name", "test");
await deleteCmd.ExecuteNonQueryAsync();
```

## 9.4 空间查询

### 9.4.1 范围查询

```csharp
var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 创建查询范围
var queryArea = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(100, 20), new Coordinate(120, 20),
    new Coordinate(120, 35), new Coordinate(100, 35),
    new Coordinate(100, 20)
});

await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    SELECT name, population, location
    FROM cities
    WHERE ST_Within(location, @area)
";
cmd.Parameters.AddWithValue("area", queryArea);

await using var reader = await cmd.ExecuteReaderAsync();
Console.WriteLine("范围内的城市：");
while (await reader.ReadAsync())
{
    Console.WriteLine($"  {reader.GetString(0)}");
}
```

### 9.4.2 距离查询

```csharp
// 查询距离北京1000公里内的城市
await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    SELECT name, 
           ST_Distance(
               location::geography, 
               ST_SetSRID(ST_MakePoint(@lon, @lat), 4326)::geography
           ) / 1000 as distance_km
    FROM cities
    WHERE ST_DWithin(
        location::geography, 
        ST_SetSRID(ST_MakePoint(@lon, @lat), 4326)::geography,
        @distance
    )
    ORDER BY distance_km
";
cmd.Parameters.AddWithValue("lon", 116.4074);
cmd.Parameters.AddWithValue("lat", 39.9042);
cmd.Parameters.AddWithValue("distance", 1000000);  // 1000公里 = 1000000米

await using var reader = await cmd.ExecuteReaderAsync();
Console.WriteLine("距离北京1000公里内的城市：");
while (await reader.ReadAsync())
{
    Console.WriteLine($"  {reader.GetString(0)}: {reader.GetDouble(1):F2} km");
}
```

### 9.4.3 最近邻查询

```csharp
// 查询最近的5个城市
await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    SELECT name, 
           ST_Distance(
               location::geography, 
               ST_SetSRID(ST_MakePoint(@lon, @lat), 4326)::geography
           ) / 1000 as distance_km
    FROM cities
    WHERE name != @exclude_name
    ORDER BY location <-> ST_SetSRID(ST_MakePoint(@lon, @lat), 4326)
    LIMIT 5
";
cmd.Parameters.AddWithValue("lon", 116.4074);
cmd.Parameters.AddWithValue("lat", 39.9042);
cmd.Parameters.AddWithValue("exclude_name", "北京");

await using var reader = await cmd.ExecuteReaderAsync();
Console.WriteLine("距离北京最近的5个城市：");
while (await reader.ReadAsync())
{
    Console.WriteLine($"  {reader.GetString(0)}: {reader.GetDouble(1):F2} km");
}
```

### 9.4.4 空间关系查询

```csharp
var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 相交查询
var queryLine = factory.CreateLineString(new Coordinate[]
{
    new Coordinate(100, 30), new Coordinate(130, 30)
});

await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    SELECT name
    FROM regions
    WHERE ST_Intersects(geometry, @line)
";
cmd.Parameters.AddWithValue("line", queryLine);

// 包含查询
cmd.CommandText = @"
    SELECT name
    FROM regions
    WHERE ST_Contains(geometry, @point)
";
var queryPoint = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
cmd.Parameters.Clear();
cmd.Parameters.AddWithValue("point", queryPoint);
```

## 9.5 空间分析

### 9.5.1 缓冲区分析

```csharp
// 创建缓冲区并存储
await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    INSERT INTO service_areas (city_name, buffer_km, area)
    SELECT 
        name,
        10,
        ST_Buffer(location::geography, 10000)::geometry
    FROM cities
    WHERE name = @name
";
cmd.Parameters.AddWithValue("name", "北京");
await cmd.ExecuteNonQueryAsync();

// 查询缓冲区内的POI
cmd.CommandText = @"
    SELECT p.name, p.category
    FROM pois p
    JOIN cities c ON ST_Within(
        p.location, 
        ST_Buffer(c.location::geography, 5000)::geometry
    )
    WHERE c.name = @city
";
cmd.Parameters.Clear();
cmd.Parameters.AddWithValue("city", "北京");
```

### 9.5.2 叠加分析

```csharp
// 计算交集
await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    SELECT 
        a.name as region_a,
        b.name as region_b,
        ST_Area(ST_Intersection(a.geometry, b.geometry)::geography) / 1000000 as area_km2
    FROM regions a
    JOIN regions b ON ST_Intersects(a.geometry, b.geometry)
    WHERE a.id < b.id
";

await using var reader = await cmd.ExecuteReaderAsync();
while (await reader.ReadAsync())
{
    Console.WriteLine(
        $"{reader.GetString(0)} 与 {reader.GetString(1)} 的交集面积: " +
        $"{reader.GetDouble(2):F2} km²");
}
```

### 9.5.3 聚合分析

```csharp
// 按省份统计城市数量和总人口
await using var cmd = dataSource.CreateCommand();
cmd.CommandText = @"
    SELECT 
        p.name as province,
        COUNT(c.id) as city_count,
        SUM(c.population) as total_population,
        ST_Union(c.location) as all_locations
    FROM provinces p
    JOIN cities c ON ST_Within(c.location, p.geometry)
    GROUP BY p.id, p.name
";

await using var reader = await cmd.ExecuteReaderAsync();
while (await reader.ReadAsync())
{
    Console.WriteLine(
        $"{reader.GetString(0)}: {reader.GetInt32(1)} 个城市, " +
        $"总人口 {reader.GetInt64(2)}");
}
```

## 9.6 PostGIS 服务封装

```csharp
using Npgsql;
using NetTopologySuite.Geometries;

public class PostGisService : IAsyncDisposable
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly GeometryFactory _factory;

    public PostGisService(string connectionString)
    {
        var builder = new NpgsqlDataSourceBuilder(connectionString);
        builder.UseNetTopologySuite();
        _dataSource = builder.Build();
        _factory = new GeometryFactory(new PrecisionModel(), 4326);
    }

    public async ValueTask DisposeAsync()
    {
        await _dataSource.DisposeAsync();
    }

    /// <summary>
    /// 范围查询
    /// </summary>
    public async Task<List<T>> QueryByExtent<T>(
        string tableName,
        string geometryColumn,
        Envelope extent,
        Func<NpgsqlDataReader, T> mapper)
    {
        var queryBox = _factory.ToGeometry(extent);
        
        await using var cmd = _dataSource.CreateCommand();
        cmd.CommandText = $@"
            SELECT * FROM {tableName}
            WHERE ST_Intersects({geometryColumn}, @box)
        ";
        cmd.Parameters.AddWithValue("box", queryBox);

        var results = new List<T>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(mapper(reader));
        }
        return results;
    }

    /// <summary>
    /// 距离查询
    /// </summary>
    public async Task<List<(T Item, double Distance)>> QueryByDistance<T>(
        string tableName,
        string geometryColumn,
        Point center,
        double distanceMeters,
        Func<NpgsqlDataReader, T> mapper)
    {
        await using var cmd = _dataSource.CreateCommand();
        cmd.CommandText = $@"
            SELECT *, 
                   ST_Distance({geometryColumn}::geography, @center::geography) as distance
            FROM {tableName}
            WHERE ST_DWithin({geometryColumn}::geography, @center::geography, @distance)
            ORDER BY distance
        ";
        cmd.Parameters.AddWithValue("center", center);
        cmd.Parameters.AddWithValue("distance", distanceMeters);

        var results = new List<(T, double)>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var item = mapper(reader);
            var distance = reader.GetDouble(reader.GetOrdinal("distance"));
            results.Add((item, distance));
        }
        return results;
    }

    /// <summary>
    /// 创建缓冲区
    /// </summary>
    public async Task<Geometry> CreateBuffer(
        Geometry geometry, 
        double distanceMeters)
    {
        await using var cmd = _dataSource.CreateCommand();
        cmd.CommandText = @"
            SELECT ST_Buffer(@geom::geography, @distance)::geometry
        ";
        cmd.Parameters.AddWithValue("geom", geometry);
        cmd.Parameters.AddWithValue("distance", distanceMeters);

        return (Geometry)(await cmd.ExecuteScalarAsync())!;
    }

    /// <summary>
    /// 计算真实距离（米）
    /// </summary>
    public async Task<double> CalculateDistance(Geometry geom1, Geometry geom2)
    {
        await using var cmd = _dataSource.CreateCommand();
        cmd.CommandText = @"
            SELECT ST_Distance(@geom1::geography, @geom2::geography)
        ";
        cmd.Parameters.AddWithValue("geom1", geom1);
        cmd.Parameters.AddWithValue("geom2", geom2);

        return (double)(await cmd.ExecuteScalarAsync())!;
    }

    /// <summary>
    /// 空间聚合
    /// </summary>
    public async Task<Geometry> Union(string tableName, string geometryColumn, string? whereClause = null)
    {
        await using var cmd = _dataSource.CreateCommand();
        cmd.CommandText = $@"
            SELECT ST_Union({geometryColumn})
            FROM {tableName}
            {(whereClause != null ? $"WHERE {whereClause}" : "")}
        ";

        return (Geometry)(await cmd.ExecuteScalarAsync())!;
    }
}
```

## 9.7 本章小结

本章详细介绍了 NetTopologySuite 与 PostGIS 的集成：

1. **PostGIS 配置**：安装扩展、配置连接
2. **基本操作**：CRUD 操作
3. **空间查询**：范围查询、距离查询、最近邻查询
4. **空间分析**：缓冲区、叠加、聚合分析
5. **服务封装**：PostGisService 类

## 9.8 下一步

下一章我们将学习 Entity Framework Core 集成，包括完整的 ORM 空间数据操作。

---

**相关资源**：

- [PostGIS 官方文档](https://postgis.net/docs/)
- [Npgsql.NetTopologySuite](https://www.npgsql.org/doc/types/nts.html)
