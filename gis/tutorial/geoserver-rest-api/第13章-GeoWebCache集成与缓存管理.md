# 第13章：GeoWebCache集成与缓存管理

## 13.1 GeoWebCache 概述

GeoWebCache (GWC) 是一个强大的瓦片缓存服务器，与 GeoServer 深度集成。它可以预先生成和缓存地图瓦片，显著提高地图服务的性能和响应速度。

### 13.1.1 GeoWebCache 的优势

1. **性能提升**：预渲染的瓦片响应速度极快
2. **负载减轻**：减少 GeoServer 的实时渲染压力
3. **带宽节约**：缓存的瓦片可以压缩传输
4. **支持多协议**：WMTS、TMS、WMS-C 等
5. **磁盘配额**：控制缓存占用的磁盘空间

### 13.1.2 缓存策略

- **按需缓存（On-Demand）**：首次请求时生成瓦片
- **预缓存（Seeding）**：预先生成指定区域和级别的瓦片
- **重新缓存（Reseeding）**：更新已缓存的瓦片
- **截断（Truncate）**：删除指定范围的缓存

## 13.2 GWCLayerService 核心功能

### 13.2.1 服务接口

```csharp
public class GWCLayerService
{
    // 获取缓存图层列表
    public async Task<GWCLayer[]> GetCachedLayersAsync();
    
    // 获取缓存图层详情
    public async Task<GWCLayer> GetCachedLayerAsync(string layerName);
    
    // 更新缓存图层配置
    public async Task UpdateCachedLayerAsync(string layerName, GWCLayer layer);
    
    // 清除图层缓存
    public async Task TruncateCacheAsync(string layerName, TruncateOptions options);
    
    // 预缓存（种子）
    public async Task SeedCacheAsync(string layerName, SeedOptions options);
}
```

### 13.2.2 数据模型

```csharp
public class GWCLayer
{
    [JsonProperty("name")]
    public string Name { get; set; }

    [JsonProperty("enabled")]
    public bool Enabled { get; set; }

    [JsonProperty("mimeFormats")]
    public string[] MimeFormats { get; set; }

    [JsonProperty("gridSubsets")]
    public GridSubset[] GridSubsets { get; set; }

    [JsonProperty("metaWidthHeight")]
    public int[] MetaWidthHeight { get; set; }

    [JsonProperty("expireCache")]
    public int ExpireCache { get; set; }

    [JsonProperty("expireClients")]
    public int ExpireClients { get; set; }

    [JsonProperty("gutter")]
    public int Gutter { get; set; }
}
```

## 13.3 启用和配置图层缓存

### 13.3.1 启用图层缓存

```csharp
using var factory = new GeoServerClientFactory(options);
var gwcService = factory.CreateGWCLayerService();

// 获取图层缓存配置
var cachedLayer = await gwcService.GetCachedLayerAsync("myWorkspace:cities");

// 启用缓存
cachedLayer.Enabled = true;

// 配置缓存格式
cachedLayer.MimeFormats = new[]
{
    "image/png",
    "image/jpeg",
    "application/vnd.mapbox-vector-tile"
};

// 配置瓦片大小
cachedLayer.MetaWidthHeight = new[] { 4, 4 }; // 4x4 metatiling

// 配置过期时间
cachedLayer.ExpireCache = 86400; // 24小时（秒）
cachedLayer.ExpireClients = 3600; // 1小时（秒）

// 配置边缘像素
cachedLayer.Gutter = 0; // 防止标注被裁切时设置为 10-20

await gwcService.UpdateCachedLayerAsync("myWorkspace:cities", cachedLayer);
Console.WriteLine("图层缓存配置完成!");
```

### 13.3.2 配置网格集

```csharp
// 为图层配置多个网格集
cachedLayer.GridSubsets = new[]
{
    new GridSubset
    {
        GridSetName = "EPSG:4326",
        MinLevel = 0,
        MaxLevel = 18
    },
    new GridSubset
    {
        GridSetName = "EPSG:900913", // Web Mercator
        MinLevel = 0,
        MaxLevel = 20
    },
    new GridSubset
    {
        GridSetName = "EPSG:3857",
        MinLevel = 0,
        MaxLevel = 19
    }
};

await gwcService.UpdateCachedLayerAsync("myWorkspace:cities", cachedLayer);
```

## 13.4 GridsetService - 网格集管理

### 13.4.1 GridsetService 接口

```csharp
public class GridsetService
{
    // 获取网格集列表
    public async Task<Gridset[]> GetGridsetsAsync();
    
    // 获取网格集详情
    public async Task<Gridset> GetGridsetAsync(string gridsetName);
    
    // 创建自定义网格集
    public async Task CreateGridsetAsync(Gridset gridset);
    
    // 删除网格集
    public async Task DeleteGridsetAsync(string gridsetName);
}
```

### 13.4.2 创建自定义网格集

```csharp
var gridsetService = factory.CreateGridsetService();

var customGridset = new Gridset
{
    Name = "CHINA_2000",
    SRS = new SRS { Number = 4490 }, // CGCS2000
    Extent = new Extent
    {
        Coords = new[] { 73.0, 16.0, 136.0, 54.0 } // 中国范围
    },
    Aligntopleleft = true,
    Resolutions = new[]
    {
        0.703125, // Level 0
        0.3515625, // Level 1
        0.17578125, // Level 2
        0.087890625, // Level 3
        // ... more levels
    },
    MetersPerUnit = 111319.49079327358,
    PixelSize = 0.00028,
    TileWidth = 256,
    TileHeight = 256
};

await gridsetService.CreateGridsetAsync(customGridset);
Console.WriteLine("自定义网格集创建成功!");
```

## 13.5 DiskQuotaService - 磁盘配额管理

### 13.5.1 DiskQuotaService 接口

```csharp
public class DiskQuotaService
{
    // 获取磁盘配额配置
    public async Task<DiskQuotaConfig> GetDiskQuotaConfigAsync();
    
    // 更新磁盘配额配置
    public async Task UpdateDiskQuotaConfigAsync(DiskQuotaConfig config);
    
    // 获取磁盘使用统计
    public async Task<DiskUsageStats> GetDiskUsageStatsAsync();
}
```

### 13.5.2 配置磁盘配额

```csharp
var diskQuotaService = factory.CreateDiskQuotaService();

var config = await diskQuotaService.GetDiskQuotaConfigAsync();

// 启用磁盘配额
config.Enabled = true;

// 设置最大缓存大小
config.MaxConcurrentCleanUps = 2;
config.MaxCacheSizeMB = 10240; // 10GB

// 配置清理策略
config.CacheCleanUpFrequency = 10; // 每10分钟检查一次
config.CacheCleanUpUnits = "SECONDS";

// 配置每个图层的配额
config.LayerQuotas = new[]
{
    new LayerQuota
    {
        Layer = "myWorkspace:basemap",
        Quota = 5120, // 5GB
        ExpirationPolicy = "LRU" // Least Recently Used
    },
    new LayerQuota
    {
        Layer = "myWorkspace:satellite",
        Quota = 3072, // 3GB
        ExpirationPolicy = "LFU" // Least Frequently Used
    }
};

await diskQuotaService.UpdateDiskQuotaConfigAsync(config);
Console.WriteLine("磁盘配额配置完成!");
```

## 13.6 缓存预生成（Seeding）

### 13.6.1 预生成瓦片

```csharp
// 为指定图层和区域预生成瓦片
var seedOptions = new SeedOptions
{
    Name = "myWorkspace:cities",
    Format = "image/png",
    GridSetId = "EPSG:4326",
    ZoomStart = 0,
    ZoomStop = 10,
    Type = "seed", // 或 "reseed"、"truncate"
    ThreadCount = 4,
    Bounds = new Bounds
    {
        Coords = new BoundsCoords
        {
            MinX = -180,
            MinY = -90,
            MaxX = 180,
            MaxY = 90
        }
    }
};

await gwcService.SeedCacheAsync("myWorkspace:cities", seedOptions);
Console.WriteLine("缓存预生成任务已启动!");
```

### 13.6.2 按区域预生成

```csharp
public class RegionalSeedingManager
{
    /// <summary>
    /// 为多个区域预生成缓存
    /// </summary>
    public async Task SeedMultipleRegionsAsync(
        string layerName,
        List<Region> regions)
    {
        foreach (var region in regions)
        {
            var seedOptions = new SeedOptions
            {
                Name = layerName,
                Format = "image/png",
                GridSetId = "EPSG:3857",
                ZoomStart = region.MinZoom,
                ZoomStop = region.MaxZoom,
                Type = "seed",
                ThreadCount = 2,
                Bounds = new Bounds
                {
                    Coords = new BoundsCoords
                    {
                        MinX = region.MinX,
                        MinY = region.MinY,
                        MaxX = region.MaxX,
                        MaxY = region.MaxY
                    }
                }
            };

            await _gwcService.SeedCacheAsync(layerName, seedOptions);
            Console.WriteLine($"区域 '{region.Name}' 的缓存预生成已启动");

            // 等待一段时间避免服务器过载
            await Task.Delay(5000);
        }
    }
}

public class Region
{
    public string Name { get; set; }
    public double MinX { get; set; }
    public double MinY { get; set; }
    public double MaxX { get; set; }
    public double MaxY { get; set; }
    public int MinZoom { get; set; }
    public int MaxZoom { get; set; }
}
```

## 13.7 缓存清除（Truncate）

### 13.7.1 清除指定图层缓存

```csharp
// 清除所有缓存
var truncateOptions = new TruncateOptions
{
    Name = "myWorkspace:cities",
    GridSetId = "EPSG:4326",
    Format = "image/png"
};

await gwcService.TruncateCacheAsync("myWorkspace:cities", truncateOptions);
Console.WriteLine("缓存已清除!");
```

### 13.7.2 清除指定级别的缓存

```csharp
// 只清除特定级别的缓存
var truncateOptions = new TruncateOptions
{
    Name = "myWorkspace:cities",
    GridSetId = "EPSG:3857",
    ZoomStart = 0,
    ZoomStop = 5, // 只清除 0-5 级
    Format = "image/png"
};

await gwcService.TruncateCacheAsync("myWorkspace:cities", truncateOptions);
```

## 13.8 缓存性能监控

### 13.8.1 缓存统计信息

```csharp
public class CacheMonitor
{
    private readonly DiskQuotaService _diskQuotaService;

    /// <summary>
    /// 获取缓存使用情况
    /// </summary>
    public async Task<CacheUsageReport> GetCacheUsageAsync()
    {
        var stats = await _diskQuotaService.GetDiskUsageStatsAsync();
        
        var report = new CacheUsageReport
        {
            TotalUsedMB = stats.TotalUsedMB,
            TotalLimitMB = stats.TotalLimitMB,
            UsagePercentage = (double)stats.TotalUsedMB / stats.TotalLimitMB * 100,
            LayerStats = stats.LayerStats.Select(ls => new LayerCacheStats
            {
                LayerName = ls.LayerName,
                UsedMB = ls.UsedMB,
                TileCount = ls.TileCount,
                LastAccessed = ls.LastAccessed
            }).ToArray()
        };

        return report;
    }

    /// <summary>
    /// 检查是否需要清理缓存
    /// </summary>
    public async Task<bool> NeedsCacheCleanupAsync(double thresholdPercentage = 90)
    {
        var report = await GetCacheUsageAsync();
        return report.UsagePercentage > thresholdPercentage;
    }
}

public class CacheUsageReport
{
    public long TotalUsedMB { get; set; }
    public long TotalLimitMB { get; set; }
    public double UsagePercentage { get; set; }
    public LayerCacheStats[] LayerStats { get; set; }
}

public class LayerCacheStats
{
    public string LayerName { get; set; }
    public long UsedMB { get; set; }
    public long TileCount { get; set; }
    public DateTime LastAccessed { get; set; }
}
```

## 13.9 缓存优化策略

### 13.9.1 智能缓存配置

```csharp
public class CacheOptimizer
{
    /// <summary>
    /// 为不同类型的图层优化缓存配置
    /// </summary>
    public async Task OptimizeLayerCacheAsync(string layerName, LayerType layerType)
    {
        var cachedLayer = await _gwcService.GetCachedLayerAsync(layerName);

        switch (layerType)
        {
            case LayerType.BaseMap:
                // 底图：高缓存时间，PNG格式
                cachedLayer.ExpireCache = 86400 * 7; // 7天
                cachedLayer.ExpireClients = 86400; // 1天
                cachedLayer.MimeFormats = new[] { "image/png" };
                cachedLayer.MetaWidthHeight = new[] { 4, 4 };
                break;

            case LayerType.DynamicData:
                // 动态数据：短缓存时间，PNG8格式
                cachedLayer.ExpireCache = 300; // 5分钟
                cachedLayer.ExpireClients = 60; // 1分钟
                cachedLayer.MimeFormats = new[] { "image/png8" };
                cachedLayer.MetaWidthHeight = new[] { 1, 1 };
                break;

            case LayerType.SatelliteImagery:
                // 卫星影像：长缓存时间，JPEG格式
                cachedLayer.ExpireCache = 86400 * 30; // 30天
                cachedLayer.ExpireClients = 86400 * 7; // 7天
                cachedLayer.MimeFormats = new[] { "image/jpeg" };
                cachedLayer.MetaWidthHeight = new[] { 4, 4 };
                break;

            case LayerType.VectorTiles:
                // 矢量瓦片：中等缓存时间，MVT格式
                cachedLayer.ExpireCache = 86400; // 1天
                cachedLayer.ExpireClients = 3600; // 1小时
                cachedLayer.MimeFormats = new[] { "application/vnd.mapbox-vector-tile" };
                cachedLayer.MetaWidthHeight = new[] { 1, 1 };
                break;
        }

        await _gwcService.UpdateCachedLayerAsync(layerName, cachedLayer);
        Console.WriteLine($"图层 '{layerName}' 缓存优化完成!");
    }
}

public enum LayerType
{
    BaseMap,
    DynamicData,
    SatelliteImagery,
    VectorTiles
}
```

## 13.10 实战案例

### 13.10.1 完整的缓存部署方案

```csharp
public class CacheDeploymentManager
{
    public async Task DeployProductionCacheAsync()
    {
        // 1. 配置全局缓存设置
        var diskQuotaService = _factory.CreateDiskQuotaService();
        var config = await diskQuotaService.GetDiskQuotaConfigAsync();
        config.Enabled = true;
        config.MaxCacheSizeMB = 51200; // 50GB
        await diskQuotaService.UpdateDiskQuotaConfigAsync(config);

        // 2. 配置底图缓存
        var gwcService = _factory.CreateGWCLayerService();
        var baseMapLayers = new[] { "basemap", "roads", "labels" };
        
        foreach (var layerName in baseMapLayers)
        {
            var cachedLayer = await gwcService.GetCachedLayerAsync($"production:{layerName}");
            cachedLayer.Enabled = true;
            cachedLayer.MimeFormats = new[] { "image/png", "image/jpeg" };
            cachedLayer.GridSubsets = new[]
            {
                new GridSubset { GridSetName = "EPSG:3857", MinLevel = 0, MaxLevel = 18 }
            };
            cachedLayer.MetaWidthHeight = new[] { 4, 4 };
            cachedLayer.ExpireCache = 86400 * 7;
            await gwcService.UpdateCachedLayerAsync($"production:{layerName}", cachedLayer);
        }

        // 3. 预生成核心区域缓存
        var coreRegions = new[]
        {
            new Region { Name = "Beijing", MinX = 115.4, MinY = 39.4, MaxX = 117.5, MaxY = 41.1, MinZoom = 0, MaxZoom = 15 },
            new Region { Name = "Shanghai", MinX = 120.8, MinY = 30.7, MaxX = 122.0, MaxY = 31.9, MinZoom = 0, MaxZoom = 15 }
        };

        foreach (var layer in baseMapLayers)
        {
            foreach (var region in coreRegions)
            {
                var seedOptions = new SeedOptions
                {
                    Name = $"production:{layer}",
                    Format = "image/png",
                    GridSetId = "EPSG:3857",
                    ZoomStart = region.MinZoom,
                    ZoomStop = region.MaxZoom,
                    Type = "seed",
                    ThreadCount = 4,
                    Bounds = new Bounds { /* region bounds */ }
                };

                await gwcService.SeedCacheAsync($"production:{layer}", seedOptions);
                Console.WriteLine($"正在预生成 {layer} - {region.Name} 的缓存...");
            }
        }

        Console.WriteLine("生产环境缓存部署完成!");
    }
}
```

## 13.11 本章小结

本章学习了：
1. GeoWebCache 的概念和优势
2. GWCLayerService 的核心功能
3. 图层缓存的启用和配置
4. 网格集和磁盘配额管理
5. 缓存预生成和清除操作
6. 缓存性能监控
7. 缓存优化策略
8. 生产环境部署方案

下一章将学习资源与模板管理。

---

**相关资源**：
- [GeoWebCache 文档](https://www.geowebcache.org/)
- [GeoServer 缓存文档](https://docs.geoserver.org/latest/en/user/geowebcache/index.html)
