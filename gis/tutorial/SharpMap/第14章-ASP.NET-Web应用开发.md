# 第14章：ASP.NET Web 应用开发

## 14.1 Web 地图服务概述

SharpMap 可以在 ASP.NET 中用于：
- 生成地图图片（静态地图 API）
- 提供 WMS 服务
- 实现自定义地图 API

## 14.2 ASP.NET Core Web API

### 14.2.1 项目配置

```bash
dotnet new webapi -n SharpMapWebApi
cd SharpMapWebApi
dotnet add package SharpMap
dotnet add package System.Drawing.Common
```

### 14.2.2 地图控制器

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Drawing;
using System.Drawing.Imaging;
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;
using SharpMap.Styles;

[ApiController]
[Route("api/[controller]")]
public class MapController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    
    public MapController(IWebHostEnvironment env)
    {
        _env = env;
    }
    
    /// <summary>
    /// 获取地图图片
    /// </summary>
    [HttpGet("image")]
    public IActionResult GetMapImage(
        [FromQuery] int width = 800,
        [FromQuery] int height = 600,
        [FromQuery] double? minX = null,
        [FromQuery] double? minY = null,
        [FromQuery] double? maxX = null,
        [FromQuery] double? maxY = null)
    {
        try
        {
            var map = CreateMap(width, height);
            
            if (minX.HasValue && minY.HasValue && maxX.HasValue && maxY.HasValue)
            {
                map.ZoomToBox(new Envelope(minX.Value, maxX.Value, minY.Value, maxY.Value));
            }
            else
            {
                map.ZoomToExtents();
            }
            
            using (var image = map.GetMap())
            using (var stream = new MemoryStream())
            {
                image.Save(stream, ImageFormat.Png);
                return File(stream.ToArray(), "image/png");
            }
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// 获取地图范围
    /// </summary>
    [HttpGet("extent")]
    public IActionResult GetExtent()
    {
        var map = CreateMap(100, 100);
        map.ZoomToExtents();
        
        return Ok(new
        {
            minX = map.Envelope.MinX,
            minY = map.Envelope.MinY,
            maxX = map.Envelope.MaxX,
            maxY = map.Envelope.MaxY
        });
    }
    
    /// <summary>
    /// 获取图层列表
    /// </summary>
    [HttpGet("layers")]
    public IActionResult GetLayers()
    {
        var dataPath = Path.Combine(_env.ContentRootPath, "Data");
        var shapeFiles = Directory.GetFiles(dataPath, "*.shp");
        
        return Ok(shapeFiles.Select(f => new
        {
            name = Path.GetFileNameWithoutExtension(f),
            path = f
        }));
    }
    
    /// <summary>
    /// 要素查询
    /// </summary>
    [HttpGet("query")]
    public IActionResult Query(
        [FromQuery] string layer,
        [FromQuery] double x,
        [FromQuery] double y,
        [FromQuery] double tolerance = 0.01)
    {
        var map = CreateMap(100, 100);
        var targetLayer = map.Layers.FirstOrDefault(l => l.LayerName == layer) as VectorLayer;
        
        if (targetLayer == null)
            return NotFound(new { error = "图层不存在" });
        
        var queryEnvelope = new Envelope(
            x - tolerance, x + tolerance,
            y - tolerance, y + tolerance);
        
        var ds = new FeatureDataSet();
        targetLayer.DataSource.ExecuteIntersectionQuery(queryEnvelope, ds);
        
        if (ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            return Ok(new { features = new object[0] });
        
        var features = ds.Tables[0].Rows.Cast<FeatureDataRow>().Select(row =>
        {
            var properties = new Dictionary<string, object>();
            foreach (DataColumn col in ds.Tables[0].Columns)
            {
                properties[col.ColumnName] = row[col];
            }
            
            return new
            {
                geometry = row.Geometry.AsText(),
                properties
            };
        });
        
        return Ok(new { features });
    }
    
    private Map CreateMap(int width, int height)
    {
        var map = new Map(new Size(width, height));
        map.BackColor = Color.White;
        
        var dataPath = Path.Combine(_env.ContentRootPath, "Data");
        
        foreach (var shapeFile in Directory.GetFiles(dataPath, "*.shp"))
        {
            var layerName = Path.GetFileNameWithoutExtension(shapeFile);
            var layer = new VectorLayer(layerName);
            layer.DataSource = new ShapeFile(shapeFile, true);
            layer.Style = GetDefaultStyle();
            map.Layers.Add(layer);
        }
        
        return map;
    }
    
    private VectorStyle GetDefaultStyle()
    {
        return new VectorStyle
        {
            Fill = new SolidBrush(Color.FromArgb(150, 144, 238, 144)),
            Outline = new Pen(Color.DarkGreen, 1),
            EnableOutline = true
        };
    }
}
```

## 14.3 实现 WMS 服务

### 14.3.1 WMS 控制器

```csharp
[ApiController]
[Route("wms")]
public class WmsController : ControllerBase
{
    private readonly IMapService _mapService;
    
    public WmsController(IMapService mapService)
    {
        _mapService = mapService;
    }
    
    [HttpGet]
    public IActionResult HandleRequest(
        [FromQuery] string SERVICE,
        [FromQuery] string REQUEST,
        [FromQuery] string VERSION = "1.1.1",
        [FromQuery] string LAYERS = null,
        [FromQuery] string STYLES = null,
        [FromQuery] string SRS = null,
        [FromQuery] string BBOX = null,
        [FromQuery] int WIDTH = 256,
        [FromQuery] int HEIGHT = 256,
        [FromQuery] string FORMAT = "image/png")
    {
        if (SERVICE?.ToUpper() != "WMS")
            return BadRequest("Invalid SERVICE parameter");
        
        switch (REQUEST?.ToUpper())
        {
            case "GETCAPABILITIES":
                return GetCapabilities(VERSION);
            case "GETMAP":
                return GetMap(LAYERS, STYLES, SRS, BBOX, WIDTH, HEIGHT, FORMAT);
            case "GETFEATUREINFO":
                return GetFeatureInfo();
            default:
                return BadRequest("Invalid REQUEST parameter");
        }
    }
    
    private IActionResult GetCapabilities(string version)
    {
        var xml = GenerateCapabilitiesXml(version);
        return Content(xml, "application/xml");
    }
    
    private IActionResult GetMap(string layers, string styles, string srs, 
        string bbox, int width, int height, string format)
    {
        if (string.IsNullOrEmpty(bbox))
            return BadRequest("BBOX is required");
        
        var parts = bbox.Split(',');
        if (parts.Length != 4)
            return BadRequest("Invalid BBOX format");
        
        var envelope = new Envelope(
            double.Parse(parts[0]),
            double.Parse(parts[2]),
            double.Parse(parts[1]),
            double.Parse(parts[3]));
        
        var map = _mapService.CreateMap(width, height, layers?.Split(','));
        map.ZoomToBox(envelope);
        
        using (var image = map.GetMap())
        using (var stream = new MemoryStream())
        {
            var imageFormat = format.ToLower() == "image/jpeg" ? 
                ImageFormat.Jpeg : ImageFormat.Png;
            image.Save(stream, imageFormat);
            
            return File(stream.ToArray(), format);
        }
    }
    
    private string GenerateCapabilitiesXml(string version)
    {
        // 生成 WMS Capabilities XML
        var xml = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<WMT_MS_Capabilities version=""{version}"">
    <Service>
        <Name>OGC:WMS</Name>
        <Title>SharpMap WMS Server</Title>
    </Service>
    <Capability>
        <Request>
            <GetCapabilities>
                <Format>application/vnd.ogc.wms_xml</Format>
            </GetCapabilities>
            <GetMap>
                <Format>image/png</Format>
                <Format>image/jpeg</Format>
            </GetMap>
        </Request>
        <Layer>
            <Title>Layers</Title>
            <!-- 动态生成图层信息 -->
        </Layer>
    </Capability>
</WMT_MS_Capabilities>";
        
        return xml;
    }
}
```

## 14.4 瓦片服务

### 14.4.1 TMS 控制器

```csharp
[ApiController]
[Route("tms")]
public class TmsController : ControllerBase
{
    private readonly IMapService _mapService;
    private readonly string _cachePath;
    
    public TmsController(IMapService mapService, IConfiguration config)
    {
        _mapService = mapService;
        _cachePath = config["TileCache:Path"] ?? "TileCache";
    }
    
    /// <summary>
    /// 获取瓦片 /tms/{z}/{x}/{y}.png
    /// </summary>
    [HttpGet("{z:int}/{x:int}/{y:int}.png")]
    public async Task<IActionResult> GetTile(int z, int x, int y)
    {
        // 检查缓存
        var cacheFile = Path.Combine(_cachePath, $"{z}", $"{x}", $"{y}.png");
        if (System.IO.File.Exists(cacheFile))
        {
            var bytes = await System.IO.File.ReadAllBytesAsync(cacheFile);
            return File(bytes, "image/png");
        }
        
        // 计算瓦片范围
        var envelope = TileToEnvelope(x, y, z);
        
        // 渲染瓦片
        var map = _mapService.CreateMap(256, 256);
        map.ZoomToBox(envelope);
        
        using (var image = map.GetMap())
        using (var stream = new MemoryStream())
        {
            image.Save(stream, ImageFormat.Png);
            var tileBytes = stream.ToArray();
            
            // 保存缓存
            Directory.CreateDirectory(Path.GetDirectoryName(cacheFile));
            await System.IO.File.WriteAllBytesAsync(cacheFile, tileBytes);
            
            return File(tileBytes, "image/png");
        }
    }
    
    private Envelope TileToEnvelope(int x, int y, int z)
    {
        // Web Mercator 坐标系
        double n = Math.Pow(2, z);
        double tileSize = 20037508.34 * 2 / n;
        
        double minX = -20037508.34 + x * tileSize;
        double maxX = minX + tileSize;
        double maxY = 20037508.34 - y * tileSize;
        double minY = maxY - tileSize;
        
        return new Envelope(minX, maxX, minY, maxY);
    }
}
```

## 14.5 前端集成

### 14.5.1 OpenLayers 集成

```html
<!DOCTYPE html>
<html>
<head>
    <title>SharpMap + OpenLayers</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v7.3.0/ol.css">
    <script src="https://cdn.jsdelivr.net/npm/ol@v7.3.0/dist/ol.js"></script>
</head>
<body>
    <div id="map" style="width: 100%; height: 100vh;"></div>
    
    <script>
        const map = new ol.Map({
            target: 'map',
            layers: [
                // SharpMap WMS 图层
                new ol.layer.Image({
                    source: new ol.source.ImageWMS({
                        url: '/wms',
                        params: {
                            'LAYERS': 'countries',
                            'FORMAT': 'image/png'
                        },
                        serverType: 'mapserver'
                    })
                })
            ],
            view: new ol.View({
                center: [0, 0],
                zoom: 2
            })
        });
        
        // 点击查询
        map.on('singleclick', function(evt) {
            const coordinate = ol.proj.toLonLat(evt.coordinate);
            fetch(`/api/map/query?layer=countries&x=${coordinate[0]}&y=${coordinate[1]}`)
                .then(res => res.json())
                .then(data => {
                    console.log('查询结果:', data);
                });
        });
    </script>
</body>
</html>
```

### 14.5.2 Leaflet 集成

```html
<!DOCTYPE html>
<html>
<head>
    <title>SharpMap + Leaflet</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css">
    <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
</head>
<body>
    <div id="map" style="width: 100%; height: 100vh;"></div>
    
    <script>
        const map = L.map('map').setView([39.9, 116.4], 5);
        
        // SharpMap TMS 图层
        L.tileLayer('/tms/{z}/{x}/{y}.png', {
            attribution: 'SharpMap'
        }).addTo(map);
        
        // 或使用 WMS
        L.tileLayer.wms('/wms', {
            layers: 'countries',
            format: 'image/png',
            transparent: true
        }).addTo(map);
    </script>
</body>
</html>
```

## 14.6 性能优化

### 14.6.1 响应缓存

```csharp
[ResponseCache(Duration = 3600)]  // 缓存1小时
[HttpGet("image")]
public IActionResult GetMapImage(/* ... */)
```

### 14.6.2 ETag 支持

```csharp
[HttpGet("{z}/{x}/{y}.png")]
public IActionResult GetTile(int z, int x, int y)
{
    var etag = $"\"{z}-{x}-{y}\"";
    
    if (Request.Headers.TryGetValue("If-None-Match", out var requestEtag) &&
        requestEtag == etag)
    {
        return StatusCode(304);  // Not Modified
    }
    
    // 生成瓦片...
    
    Response.Headers.Add("ETag", etag);
    return File(tileBytes, "image/png");
}
```

## 14.7 本章小结

本章介绍了 ASP.NET Web 应用开发：

1. **Web API**：创建地图图片服务
2. **WMS 服务**：实现 OGC WMS 标准接口
3. **瓦片服务**：实现 TMS 瓦片服务
4. **前端集成**：OpenLayers 和 Leaflet 集成
5. **性能优化**：缓存和 ETag 策略

---

**下一章预告**：第15章将介绍扩展开发与插件集成。
