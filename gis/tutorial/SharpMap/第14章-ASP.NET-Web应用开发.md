---
layout: default
title: 第14章：ASP.NET Web 应用开发
---

# 第14章：ASP.NET Web 应用开发

桌面应用里，地图控件可以直接操作 Graphics 对象，用户缩放、拖拽都能看到即时效果。搬到 Web 上，这个模型不成立：浏览器只认图片或数据，服务端要把地图渲染成字节流，再通过 HTTP 送出去。SharpMap 在服务端的角色，就是这套渲染逻辑。

这一章按接口形态展开：先做一个返回 PNG 的地图图片接口，再实现标准的 WMS 和 TMS，最后接到 OpenLayers、Leaflet 这类前端库。重点不在把代码贴完整，而在几个工程问题：请求参数怎么校验、坐标范围怎么对应、瓦片怎么缓存、渲染异常怎么不把整个接口拖垮。

## 14.1 Web 地图服务概述

SharpMap 可以在 ASP.NET 中用于：
- 生成地图图片（静态地图 API）
- 提供 WMS 服务
- 实现自定义地图 API

三种形态的复杂度递增。图片接口最简单，前端传尺寸和范围，后端返回一张图；WMS 要遵循 OGC 规范，请求参数名、Capabilities 文档、异常格式都有约定；TMS 则是按 z/x/y 分块渲染，配合前端瓦片库使用。选哪种取决于对接方：内部项目用自定义接口最省事，要接第三方 GIS 平台就得实现标准协议。

服务端渲染有固有的并发问题。SharpMap 的 Map 对象不是线程安全的，多个请求共用同一个实例会出现渲染错乱；正确做法是每个请求新建 Map，或者在对象池里取出后独占使用直到渲染结束。这一点和桌面应用差别很大，写接口时容易忽略。

## 14.2 ASP.NET Core Web API

Web API 项目分两层：Controller 负责解析请求、返回结果，渲染逻辑抽成服务。Controller 里写太多渲染代码，单元测试就没法做——测试里构造 HttpContext 和文件路径很麻烦，而一个纯服务类只需要传参数。

### 14.2.1 项目配置

创建项目、加依赖，这一步和其他 Web API 项目没有区别。SharpMap 本身是老库，依赖 System.Drawing，在 Linux 上部署需要额外的图形库支持；.NET 6 以后 System.Drawing.Common 只支持 Windows，跨平台部署要提前评估。下面的命令假设在 Windows 环境开发。

```bash
dotnet new webapi -n SharpMapWebApi
cd SharpMapWebApi
dotnet add package SharpMap
dotnet add package System.Drawing.Common
```

装包之后建议先写一个最小接口验证渲染链路能不能跑通：返回一张固定范围的地图，确认输出是有效 PNG。这一步能把数据路径、字体、权限之类的问题提前暴露，比等整页控制器写完再排查省时间。

数据文件放在 ContentRootPath 下的 Data 目录，或者通过配置指定绝对路径，别写死在代码里。容器部署时数据目录通常挂载成卷，路径由环境变量传入。

### 14.2.2 地图控制器

控制器里的四个动作覆盖了常见需求：出图、取范围、列图层、点查询。设计上把渲染逻辑放在 CreateMap 方法里，对外动作只做参数校验和结果封装，这是为了复用——出图和点查询都用同一份图层配置，避免两处不一致。

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

这段代码有几处值得展开。GetMapImage 判断四个范围参数是否都给了，全部存在才 ZoomToBox，否则 ZoomToExtents；这个判断很重要，只传一半参数时应当回退到全图，而不是用缺省值拼出一个错误范围。

返回的图片用 MemoryStream 中转再转成字节数组，是因为 Image 对象不能直接作为响应体，也不能在响应结束后继续持有。using 保证 Image 和 Stream 都被释放，否则高并发下 GDI 句柄会耗尽，表现为服务运行一段时间后所有出图请求卡死。

图层在每次请求时从 Data 目录重新扫描，文件多时这部分是明显的开销。生产环境应当把图层配置缓存起来，数据文件变动时再刷新，而不是每个请求都扫目录。

点查询接口把几何转成 WKT 文本返回，前端拿到的是一段可以解析的字符串。字段值直接序列化，日期和二进制字段要注意格式，序列化器可能抛异常。

## 14.3 实现 WMS 服务

WMS 是与第三方系统对接时最常用的协议。它的请求全部是 GET 参数，参数名固定：SERVICE、REQUEST、VERSION、LAYERS、STYLES、SRS、BBOX、WIDTH、HEIGHT、FORMAT。服务端按 REQUEST 的值分派到不同操作，最常用的是 GetCapabilities 和 GetMap。

自己实现 WMS 容易漏掉规范要求。Capabilities 文档的 XML 结构必须符合 DTD，图层要列出可用的 SRS 和范围，异常要按 OGC 规定格式返回而不是随便一个 JSON。对方系统用标准客户端对接时，这些细节不满足就可能直接解析失败。

### 14.3.1 WMS 控制器

下面的控制器把参数解析、分派和出图拼在一起。注意 BBOX 的解析：WMS 的 BBOX 顺序是 minx,miny,maxx,maxy，而 Envelope 构造函数是 minX,maxX,minY,maxY，两者顺序不同，示例里按 parts[0]、parts[2]、parts[1]、parts[3] 重新排列，就是为这个差异。

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

WMS 1.1.1 与 1.3.0 有一个著名差异：1.3.0 的 BBOX 轴序取决于 CRS 的官方定义，EPSG:4326 变成了纬度在前。示例按 1.1.1 的经度在前处理，接 1.3.0 客户端时会画错位置。要么在 Capabilities 里声明只支持 1.1.1，要么按 VERSION 分支处理轴序。

GetFeatureInfo 在示例里没有实现，返回的是固定内容。真正要支持点击查询，得按 BBOX 和像素坐标反算出地理坐标，再用查询接口取要素，把结果按 INFO_FORMAT 输出成 HTML 或 JSON。

异常处理是 WMS 的另一个坑。参数缺失时不能返回 ASP.NET 默认的错误页，应当返回 OGC 规定的 ServiceException XML，否则客户端报的是解析错误，看不出真正原因。

## 14.4 瓦片服务

整张地图一次渲染，在高分辨率屏幕上会非常慢。瓦片把地图切成固定大小的小块，前端只请求视野内的瓦片，服务端每次只渲染 256 像素见方的小图，响应快、缓存也容易做。

瓦片服务的关键是坐标换算和缓存。z/x/y 到地理范围的换算公式必须和前端库一致，差一点就会在拼接处出现错位；缓存路径按 z/x/y 组织，命中直接返回文件，未命中才渲染。

### 14.4.1 TMS 控制器

下面这段代码实现了最简单的文件缓存：请求进来先查本地文件，存在就直接返回，不存在就渲染并写盘。缓存目录用 z/x/y 分层，避免单目录文件过多。

要留意的是坐标约定。TMS 规范里 y 轴从下往上数，XYZ 方案从上往下数，同一个位置两种编号是反的。示例用 maxY = 20037508.34 减去 y 乘瓦片高度，属于 XYZ 方案；前端用 Leaflet 的 L.tileLayer 时默认是 XYZ，能对上，换成严格的 TMS 客户端就要转换 y。

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

渲染失败时不要把异常直接抛给前端，也不要把半张图写进缓存。正确做法是先渲染到内存，成功后再写文件；写文件用临时文件加改名，避免并发下读到不完整的瓦片。

缓存没有过期策略。数据更新后旧瓦片会一直存在，需要按版本号或时间戳组织缓存目录，或者提供清理接口。生产环境还应当限制缓存目录大小，避免磁盘被瓦片占满。

## 14.5 前端集成

服务端接口写完，前端要能接上。OpenLayers 和 Leaflet 都支持 WMS 和瓦片图层，差别主要在坐标系和参数写法。前端集成阶段最容易出问题的是跨域和坐标对齐，接口本身反而简单。

### 14.5.1 OpenLayers 集成

OpenLayers 的 ImageWMS 图层把 WMS 当成一张会随视图变化的图片。它的参数里 LAYERS、FORMAT 会原样拼进请求，BBOX、WIDTH、HEIGHT 由视图自动计算，不用手写。

示例里的 serverType 设为 mapserver，影响的是 BBOX 的轴序处理；接自己实现的 WMS 时，要和服务端的 VERSION 对应上，否则请求能发出去但位置不对。

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

点击查询用 singleclick 事件拿到坐标，经 ol.proj.toLonLat 转成经纬度，再请求自己的点查询接口。注意服务端的坐标系：如果数据是 Web 墨卡托，这里转成经纬度后直接传参就会错位，应当保持和图层一致的坐标系。

跨域问题在这里也会出现。前端页面和服务端不同源时，WMS 图片请求要么走同源代理，要么在服务端配置 CORS 允许来源。图片标签不受 CORS 限制，但 fetch 请求受，点查询接口尤其要配。

### 14.5.2 Leaflet 集成

Leaflet 更轻量，接 WMS 和瓦片都是一行配置。L.tileLayer.wms 对应 WMS，L.tileLayer 对应 XYZ 瓦片，后者要求的 URL 模板和示例里的 /tms/{z}/{x}/{y}.png 完全一致。

示例里的 view 中心点用了经纬度，地图默认坐标系是 EPSG:3857，Leaflet 会自动转换。服务端如果按投影坐标渲染，两边坐标系必须约定清楚。

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

前端集成完成之后，性能问题会从浏览器端冒出来：页面打开慢、拖动时瓦片一片片加载、点击查询没反应。这些多数不是 SharpMap 渲染慢，而是请求次数太多、缓存没命中、接口没有并发控制。

## 14.6 性能优化

服务端优化的优先级：缓存命中率、渲染耗时、数据传输量。瓦片命中的请求几乎不消耗 CPU，把缓存做对，整体吞吐能提高一个数量级。其次是减少一次渲染里的图层数量和数据量，按比例尺过滤。

### 14.6.1 响应缓存

ASP.NET Core 的 ResponseCache 特性会给响应加 Cache-Control 头，告诉浏览器和中间代理可以缓存多久。适合内容不常变的接口，比如固定版本的底图。

用了响应缓存后，数据更新要等缓存过期才能看到。给地图接口设置缓存时间之前，先想清楚数据更新频率和用户对延迟的容忍度。

```csharp
[ResponseCache(Duration = 3600)]  // 缓存1小时
[HttpGet("image")]
public IActionResult GetMapImage(/* ... */)
```

### 14.6.2 ETag 支持

ETag 是更细粒度的缓存协商：客户端带上 If-None-Match，服务端比对版本标识，没变就返回 304，省掉响应体传输。瓦片这种内容固定、数量巨大的资源很适合用 ETag。

示例用 z-x-y 拼成 ETag，前提是同一坐标的瓦片内容不变。数据更新后按这个 ETag 判断就会出错，客户端一直拿到旧瓦片；需要把数据版本号也拼进标识，或者更新时统一清理缓存。

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

这段代码里第一个动作是检查 If-None-Match，命中就返回 304，不生成瓦片。第二个动作是设置响应头再返回文件。顺序不能反，响应头必须在写响应体之前设置。

304 响应没有响应体，客户端继续用本地缓存的副本。这个机制对带宽友好，但调试时会让人困惑：改了服务端代码，浏览器还在显示旧图，清缓存或者开无痕窗口才能看到变化。

## 14.7 本章小结

本章介绍了 ASP.NET Web 应用开发：

1. **Web API**：创建地图图片服务
2. **WMS 服务**：实现 OGC WMS 标准接口
3. **瓦片服务**：实现 TMS 瓦片服务
4. **前端集成**：OpenLayers 和 Leaflet 集成
5. **性能优化**：缓存和 ETag 策略

把这一章的要点收拢成一份上线清单：每个请求新建 Map 对象，避免共享状态；渲染结果先落内存再写缓存，异常不写脏数据；WMS 的轴序和版本要和服务端约定一致；瓦片编号约定（XYZ 还是 TMS）写进接口文档；缓存目录有清理策略；ETag 与数据版本绑定；跨域和坐标系在前端联调前确认。

SharpMap 在 Web 场景里最大的限制是渲染性能。它适合中小数据量、低并发的内部系统；面向公众的高并发地图服务，更常见的做法是用 GeoServer 出图，SharpMap 负责业务侧的轻量渲染和空间计算。选型时想清楚量级，比后期优化省事。

---

**下一章预告**：第15章将介绍扩展开发与插件集成。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/SharpMap/第13章-WPF桌面应用开发/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/SharpMap/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/SharpMap/第15章-扩展开发与插件集成/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->
