---
layout: default
title: 第10章：Entity Framework Core 集成
---

# 第10章：Entity Framework Core 集成

## 10.1 EF Core 空间数据支持概述

Entity Framework Core 通过专用的 NuGet 包提供对空间数据的支持，使开发者能够使用 LINQ 进行空间查询，将几何对象映射到数据库列。

### 10.1.1 支持的数据库

| 数据库 | NuGet 包 |
|--------|----------|
| SQL Server | Microsoft.EntityFrameworkCore.SqlServer.NetTopologySuite |
| PostgreSQL | Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite |
| MySQL | Pomelo.EntityFrameworkCore.MySql.NetTopologySuite |
| SQLite | Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite |

### 10.1.2 安装 NuGet 包

```bash
# SQL Server
dotnet add package Microsoft.EntityFrameworkCore.SqlServer.NetTopologySuite

# PostgreSQL
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite

# SQLite
dotnet add package Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite
```

## 10.2 配置 DbContext

### 10.2.1 SQL Server 配置

```csharp
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;

public class SpatialDbContext : DbContext
{
    public DbSet<City> Cities { get; set; }
    public DbSet<Region> Regions { get; set; }
    public DbSet<Road> Roads { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSqlServer(
            "Server=localhost;Database=SpatialDemo;Trusted_Connection=True;",
            x => x.UseNetTopologySuite());
    }
}
```

### 10.2.2 PostgreSQL 配置

```csharp
public class SpatialDbContext : DbContext
{
    public DbSet<City> Cities { get; set; }
    public DbSet<Region> Regions { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseNpgsql(
            "Host=localhost;Database=spatial_demo;Username=postgres;Password=postgres",
            x => x.UseNetTopologySuite());
    }
}
```

### 10.2.3 使用依赖注入

```csharp
// Program.cs
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 配置 DbContext
builder.Services.AddDbContext<SpatialDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        x => x.UseNetTopologySuite());
});
```

## 10.3 实体模型定义

### 10.3.1 点实体

```csharp
using NetTopologySuite.Geometries;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class City
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = "";
    
    public int Population { get; set; }
    
    [Column(TypeName = "geometry (point, 4326)")]
    public Point? Location { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

### 10.3.2 多边形实体

```csharp
public class Region
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = "";
    
    public string RegionType { get; set; } = "";
    
    [Column(TypeName = "geometry (polygon, 4326)")]
    public Polygon? Boundary { get; set; }
    
    public double Area { get; set; }
    
    // 导航属性
    public ICollection<City> Cities { get; set; } = new List<City>();
}
```

### 10.3.3 线实体

```csharp
public class Road
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = "";
    
    public string RoadClass { get; set; } = "";
    
    public double LengthKm { get; set; }
    
    [Column(TypeName = "geometry (linestring, 4326)")]
    public LineString? Path { get; set; }
}
```

### 10.3.4 通用几何实体

```csharp
public class SpatialFeature
{
    public int Id { get; set; }
    
    public string Name { get; set; } = "";
    
    public string FeatureType { get; set; } = "";
    
    // 可以存储任何几何类型
    [Column(TypeName = "geometry")]
    public Geometry? Geometry { get; set; }
    
    // JSON 属性存储
    [Column(TypeName = "jsonb")]
    public Dictionary<string, object>? Properties { get; set; }
}
```

## 10.4 Fluent API 配置

### 10.4.1 完整配置示例

```csharp
public class SpatialDbContext : DbContext
{
    public DbSet<City> Cities { get; set; }
    public DbSet<Region> Regions { get; set; }
    public DbSet<Road> Roads { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // City 配置
        modelBuilder.Entity<City>(entity =>
        {
            entity.ToTable("cities");
            
            entity.HasKey(e => e.Id);
            
            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);
            
            entity.Property(e => e.Location)
                .HasColumnType("geometry (point, 4326)");
            
            // 创建空间索引
            entity.HasIndex(e => e.Location)
                .HasMethod("GIST");  // PostgreSQL
        });

        // Region 配置
        modelBuilder.Entity<Region>(entity =>
        {
            entity.ToTable("regions");
            
            entity.Property(e => e.Boundary)
                .HasColumnType("geometry (polygon, 4326)");
            
            entity.HasIndex(e => e.Boundary)
                .HasMethod("GIST");
        });

        // Road 配置
        modelBuilder.Entity<Road>(entity =>
        {
            entity.ToTable("roads");
            
            entity.Property(e => e.Path)
                .HasColumnType("geometry (linestring, 4326)");
            
            entity.HasIndex(e => e.Path)
                .HasMethod("GIST");
        });
    }
}
```

## 10.5 CRUD 操作

### 10.5.1 创建数据

```csharp
using NetTopologySuite.Geometries;

var factory = new GeometryFactory(new PrecisionModel(), 4326);

using var context = new SpatialDbContext();

// 创建城市
var city = new City
{
    Name = "北京",
    Population = 21540000,
    Location = factory.CreatePoint(new Coordinate(116.4074, 39.9042))
};
context.Cities.Add(city);

// 创建区域
var region = new Region
{
    Name = "华北地区",
    RegionType = "行政区",
    Boundary = factory.CreatePolygon(new Coordinate[]
    {
        new Coordinate(110, 35), new Coordinate(120, 35),
        new Coordinate(120, 42), new Coordinate(110, 42),
        new Coordinate(110, 35)
    })
};
region.Area = region.Boundary.Area;
context.Regions.Add(region);

await context.SaveChangesAsync();
```

### 10.5.2 查询数据

```csharp
// 基本查询
var cities = await context.Cities
    .Where(c => c.Population > 10000000)
    .ToListAsync();

// 查询并包含几何
var city = await context.Cities
    .FirstOrDefaultAsync(c => c.Name == "北京");

if (city?.Location != null)
{
    Console.WriteLine($"坐标: ({city.Location.X}, {city.Location.Y})");
}
```

### 10.5.3 更新数据

```csharp
var city = await context.Cities
    .FirstOrDefaultAsync(c => c.Name == "北京");

if (city != null)
{
    city.Population = 21600000;
    city.Location = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
    await context.SaveChangesAsync();
}
```

### 10.5.4 删除数据

```csharp
var city = await context.Cities
    .FirstOrDefaultAsync(c => c.Name == "test");

if (city != null)
{
    context.Cities.Remove(city);
    await context.SaveChangesAsync();
}
```

## 10.6 空间查询

### 10.6.1 包含查询

```csharp
var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 查询区域内的城市
var queryPoint = factory.CreatePoint(new Coordinate(116.4074, 39.9042));

var citiesInRegion = await context.Cities
    .Where(c => context.Regions
        .Any(r => r.Name == "华北地区" && r.Boundary!.Contains(c.Location!)))
    .ToListAsync();

// 或使用 Join
var citiesWithRegion = await context.Cities
    .Join(
        context.Regions,
        city => true,
        region => true,
        (city, region) => new { city, region })
    .Where(x => x.region.Boundary!.Contains(x.city.Location!))
    .Select(x => new { x.city.Name, RegionName = x.region.Name })
    .ToListAsync();
```

### 10.6.2 相交查询

```csharp
var queryArea = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(115, 39), new Coordinate(118, 39),
    new Coordinate(118, 41), new Coordinate(115, 41),
    new Coordinate(115, 39)
});

// 查询与区域相交的道路
var roads = await context.Roads
    .Where(r => r.Path!.Intersects(queryArea))
    .ToListAsync();
```

### 10.6.3 距离查询

```csharp
var center = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
var distanceThreshold = 1.0; // 约100公里（度数）

// 简单距离查询（使用度数）
var nearbyCities = await context.Cities
    .Where(c => c.Location!.Distance(center) < distanceThreshold)
    .OrderBy(c => c.Location!.Distance(center))
    .ToListAsync();

// PostgreSQL 真实距离查询（使用原生 SQL）
var nearbyCitiesWithDistance = await context.Cities
    .FromSqlRaw(@"
        SELECT * FROM cities 
        WHERE ST_DWithin(location::geography, 
                         ST_SetSRID(ST_MakePoint({0}, {1}), 4326)::geography, 
                         {2})
        ORDER BY ST_Distance(location::geography, 
                            ST_SetSRID(ST_MakePoint({0}, {1}), 4326)::geography)",
        116.4074, 39.9042, 100000)  // 100公里
    .ToListAsync();
```

### 10.6.4 最近邻查询

```csharp
var center = factory.CreatePoint(new Coordinate(116.4074, 39.9042));

// 查询最近的5个城市
var nearestCities = await context.Cities
    .OrderBy(c => c.Location!.Distance(center))
    .Take(5)
    .ToListAsync();
```

### 10.6.5 缓冲区查询

```csharp
var center = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
var buffer = center.Buffer(0.5); // 0.5度约50公里

var citiesInBuffer = await context.Cities
    .Where(c => buffer.Contains(c.Location!))
    .ToListAsync();
```

## 10.7 空间分析

### 10.7.1 面积和长度计算

```csharp
// 计算区域面积
var regions = await context.Regions
    .Select(r => new
    {
        r.Name,
        Area = r.Boundary!.Area,  // 平方度
        Perimeter = r.Boundary!.Length  // 度
    })
    .ToListAsync();

// 计算道路长度
var roads = await context.Roads
    .Select(r => new
    {
        r.Name,
        Length = r.Path!.Length
    })
    .ToListAsync();
```

### 10.7.2 聚合操作

```csharp
// 按类型统计
var stats = await context.Cities
    .GroupBy(c => c.Location!.Within(someRegion))
    .Select(g => new
    {
        InRegion = g.Key,
        Count = g.Count(),
        TotalPopulation = g.Sum(c => c.Population)
    })
    .ToListAsync();
```

## 10.8 数据迁移

### 10.8.1 创建迁移

```bash
# 创建迁移
dotnet ef migrations add InitialCreate

# 应用迁移
dotnet ef database update
```

### 10.8.2 迁移文件示例

```csharp
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 启用 PostGIS 扩展
        migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS postgis;");
        
        migrationBuilder.CreateTable(
            name: "cities",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", 
                        NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                Name = table.Column<string>(type: "character varying(100)", 
                    maxLength: 100, nullable: false),
                Population = table.Column<int>(type: "integer", nullable: false),
                Location = table.Column<Point>(type: "geometry (point, 4326)", 
                    nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_cities", x => x.Id);
            });

        // 创建空间索引
        migrationBuilder.Sql(
            "CREATE INDEX IX_cities_Location ON cities USING GIST (\"Location\");");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "cities");
    }
}
```

## 10.9 仓储模式

### 10.9.1 空间仓储接口

```csharp
public interface ISpatialRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);
    Task<List<T>> GetAllAsync();
    Task<List<T>> QueryByExtentAsync(Envelope extent, string geometryProperty);
    Task<List<T>> QueryByDistanceAsync(Point center, double meters, string geometryProperty);
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(int id);
}
```

### 10.9.2 实现示例

```csharp
public class CityRepository : ISpatialRepository<City>
{
    private readonly SpatialDbContext _context;
    private readonly GeometryFactory _factory;

    public CityRepository(SpatialDbContext context)
    {
        _context = context;
        _factory = new GeometryFactory(new PrecisionModel(), 4326);
    }

    public async Task<City?> GetByIdAsync(int id)
    {
        return await _context.Cities.FindAsync(id);
    }

    public async Task<List<City>> GetAllAsync()
    {
        return await _context.Cities.ToListAsync();
    }

    public async Task<List<City>> QueryByExtentAsync(Envelope extent, string geometryProperty)
    {
        var bbox = _factory.ToGeometry(extent);
        return await _context.Cities
            .Where(c => c.Location != null && bbox.Contains(c.Location))
            .ToListAsync();
    }

    public async Task<List<City>> QueryByDistanceAsync(Point center, double meters, string geometryProperty)
    {
        // 转换为度数（近似）
        var degrees = meters / 111000;
        return await _context.Cities
            .Where(c => c.Location != null && c.Location.Distance(center) < degrees)
            .OrderBy(c => c.Location!.Distance(center))
            .ToListAsync();
    }

    public async Task<City> AddAsync(City entity)
    {
        _context.Cities.Add(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    public async Task UpdateAsync(City entity)
    {
        _context.Cities.Update(entity);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        var entity = await GetByIdAsync(id);
        if (entity != null)
        {
            _context.Cities.Remove(entity);
            await _context.SaveChangesAsync();
        }
    }
}
```

## 10.10 本章小结

本章详细介绍了 NetTopologySuite 与 Entity Framework Core 的集成：

1. **配置**：DbContext 配置和依赖注入
2. **实体模型**：定义带有空间属性的实体
3. **Fluent API**：空间列和索引配置
4. **CRUD 操作**：基本数据操作
5. **空间查询**：包含、相交、距离、最近邻查询
6. **数据迁移**：创建和管理迁移
7. **仓储模式**：封装空间数据访问

## 10.11 下一步

下一章我们将学习坐标系转换与投影，包括 ProjNet 的使用。

---

**相关资源**：

- [EF Core 空间数据文档](https://learn.microsoft.com/en-us/ef/core/modeling/spatial)
- [Npgsql EF Core 空间支持](https://www.npgsql.org/efcore/mapping/nts.html)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第09章-PostGIS数据库集成/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/NetTopologySuite/第11章-坐标系转换与投影/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
