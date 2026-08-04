---
layout: default
title: 第04章：Map 对象与地图管理
---

# 第04章：Map 对象与地图管理

## 4.1 Map 对象创建与配置

### 4.1.1 创建 Map 对象

```csharp
using SharpMap;
using System.Drawing;

// 方式1：使用默认构造函数
var map1 = new Map();
map1.Size = new Size(800, 600);

// 方式2：指定尺寸
var map2 = new Map(new Size(1024, 768));

// 方式3：工厂方法创建（自定义工厂）
public static Map CreateMap(int width, int height, Color backColor)
{
    var map = new Map(new Size(width, height));
    map.BackColor = backColor;
    return map;
}
```

### 4.1.2 基本属性配置

```csharp
var map = new Map(new Size(800, 600));

// 背景设置
map.BackColor = Color.White;                    // 纯色背景
map.BackColor = Color.Transparent;              // 透明背景
map.BackColor = Color.FromArgb(240, 240, 240);  // 自定义颜色

// 空间参考设置
map.SRID = 4326;    // WGS84
map.SRID = 3857;    // Web Mercator
map.SRID = 4490;    // CGCS2000

// 尺寸调整
map.Size = new Size(1920, 1080);

// 获取地图信息
Console.WriteLine($"宽度：{map.Size.Width}");
Console.WriteLine($"高度：{map.Size.Height}");
Console.WriteLine($"SRID：{map.SRID}");
Console.WriteLine($"背景色：{map.BackColor}");
```

### 4.1.3 缩放限制

```csharp
// 设置缩放限制
map.MinimumZoom = 0.001;        // 最小缩放级别（最大放大）
map.MaximumZoom = 10000000;     // 最大缩放级别（最小缩小）

// 动态计算缩放限制
public static void SetZoomLimits(Map map, VectorLayer layer)
{
    var extent = layer.Envelope;
    
    // 最大缩放：能看到全图
    map.MaximumZoom = Math.Max(extent.Width, extent.Height) * 1.2;
    
    // 最小缩放：合理的最大放大级别
    map.MinimumZoom = Math.Min(extent.Width, extent.Height) / 1000;
}

// 验证当前缩放是否在范围内
public static bool IsValidZoom(Map map, double zoom)
{
    return zoom >= map.MinimumZoom && zoom <= map.MaximumZoom;
}
```

## 4.2 地图视图控制

### 4.2.1 缩放操作

```csharp
// 缩放到全图范围
map.ZoomToExtents();

// 缩放到指定范围
var envelope = new Envelope(-180, 180, -90, 90);
map.ZoomToBox(envelope);

// 缩放到指定图层范围
public static void ZoomToLayer(Map map, string layerName)
{
    var layer = map.Layers.FirstOrDefault(l => l.LayerName == layerName);
    if (layer != null)
    {
        map.ZoomToBox(layer.Envelope);
    }
}

// 设置具体缩放级别
map.Zoom = 1000;        // 地图单位
map.Zoom *= 2;          // 缩小（视野扩大）
map.Zoom /= 2;          // 放大（视野缩小）

// 缩放到点
public static void ZoomToPoint(Map map, Coordinate point, double zoomLevel)
{
    map.Center = point;
    map.Zoom = zoomLevel;
}

// 按比例缩放
public static void ZoomByFactor(Map map, double factor)
{
    map.Zoom *= factor;
    
    // 确保在限制范围内
    if (map.Zoom < map.MinimumZoom)
        map.Zoom = map.MinimumZoom;
    if (map.Zoom > map.MaximumZoom)
        map.Zoom = map.MaximumZoom;
}
```

### 4.2.2 平移操作

```csharp
// 设置中心点
map.Center = new Coordinate(116.4, 39.9);  // 北京

// 平移地图
public static void Pan(Map map, double deltaX, double deltaY)
{
    var center = map.Center;
    map.Center = new Coordinate(center.X + deltaX, center.Y + deltaY);
}

// 按像素平移
public static void PanByPixels(Map map, int pixelX, int pixelY)
{
    double worldDeltaX = pixelX * map.PixelWidth;
    double worldDeltaY = pixelY * map.PixelHeight;
    
    var center = map.Center;
    map.Center = new Coordinate(
        center.X + worldDeltaX,
        center.Y - worldDeltaY  // 注意：像素Y轴方向与地理Y轴相反
    );
}

// 平移到指定位置
public static void PanTo(Map map, Coordinate target)
{
    map.Center = target;
}
```

### 4.2.3 视图范围管理

```csharp
// 获取当前视图范围
Envelope currentExtent = map.Envelope;
Console.WriteLine($"当前范围：{currentExtent}");
Console.WriteLine($"宽度：{currentExtent.Width}");
Console.WriteLine($"高度：{currentExtent.Height}");
Console.WriteLine($"中心：{currentExtent.Centre}");

// 获取地图边界坐标
double minX = currentExtent.MinX;
double minY = currentExtent.MinY;
double maxX = currentExtent.MaxX;
double maxY = currentExtent.MaxY;

// 判断点是否在视图内
public static bool IsPointInView(Map map, Coordinate point)
{
    return map.Envelope.Contains(point);
}

// 判断范围是否在视图内
public static bool IsEnvelopeInView(Map map, Envelope envelope)
{
    return map.Envelope.Intersects(envelope);
}

// 扩展视图范围
public static void ExpandView(Map map, double percentage)
{
    var envelope = map.Envelope;
    double expandX = envelope.Width * percentage / 200;
    double expandY = envelope.Height * percentage / 200;
    
    var newEnvelope = new Envelope(
        envelope.MinX - expandX,
        envelope.MaxX + expandX,
        envelope.MinY - expandY,
        envelope.MaxY + expandY
    );
    
    map.ZoomToBox(newEnvelope);
}
```

### 4.2.4 历史视图管理

```csharp
public class ViewHistory
{
    private readonly Stack<Envelope> _undoStack = new Stack<Envelope>();
    private readonly Stack<Envelope> _redoStack = new Stack<Envelope>();
    private readonly int _maxHistory;
    
    public ViewHistory(int maxHistory = 50)
    {
        _maxHistory = maxHistory;
    }
    
    public void Push(Envelope envelope)
    {
        // 限制历史记录数量
        while (_undoStack.Count >= _maxHistory)
        {
            // 移除最旧的记录（需要转换为队列操作）
            var temp = _undoStack.ToArray();
            _undoStack.Clear();
            for (int i = 1; i < temp.Length; i++)
            {
                _undoStack.Push(temp[temp.Length - 1 - i]);
            }
        }
        
        _undoStack.Push(envelope);
        _redoStack.Clear();
    }
    
    public Envelope Undo()
    {
        if (_undoStack.Count <= 1)
            return null;
            
        var current = _undoStack.Pop();
        _redoStack.Push(current);
        return _undoStack.Peek();
    }
    
    public Envelope Redo()
    {
        if (_redoStack.Count == 0)
            return null;
            
        var envelope = _redoStack.Pop();
        _undoStack.Push(envelope);
        return envelope;
    }
    
    public bool CanUndo => _undoStack.Count > 1;
    public bool CanRedo => _redoStack.Count > 0;
}

// 使用视图历史
var viewHistory = new ViewHistory();

// 保存当前视图
viewHistory.Push(map.Envelope);

// 执行操作后保存
map.ZoomToBox(someEnvelope);
viewHistory.Push(map.Envelope);

// 撤销
if (viewHistory.CanUndo)
{
    var previousView = viewHistory.Undo();
    map.ZoomToBox(previousView);
}

// 重做
if (viewHistory.CanRedo)
{
    var nextView = viewHistory.Redo();
    map.ZoomToBox(nextView);
}
```

## 4.3 坐标转换

### 4.3.1 屏幕坐标与地理坐标转换

```csharp
// 屏幕坐标转地理坐标
PointF screenPoint = new PointF(400, 300);
Coordinate worldPoint = map.ImageToWorld(screenPoint);
Console.WriteLine($"地理坐标：({worldPoint.X}, {worldPoint.Y})");

// 地理坐标转屏幕坐标
Coordinate geoPoint = new Coordinate(116.4, 39.9);
PointF pixelPoint = map.WorldToImage(geoPoint);
Console.WriteLine($"屏幕坐标：({pixelPoint.X}, {pixelPoint.Y})");

// 批量转换
public static List<PointF> WorldToImage(Map map, IEnumerable<Coordinate> coordinates)
{
    return coordinates.Select(c => map.WorldToImage(c)).ToList();
}

public static List<Coordinate> ImageToWorld(Map map, IEnumerable<PointF> points)
{
    return points.Select(p => map.ImageToWorld(p)).ToList();
}
```

### 4.3.2 坐标系转换配置

```csharp
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;

// 创建坐标系统工厂
var csFactory = new CoordinateSystemFactory();
var ctFactory = new CoordinateTransformationFactory();

// 定义 WGS84 坐标系
var wgs84 = GeographicCoordinateSystem.WGS84;

// 定义 Web Mercator 坐标系
string mercatorWkt = @"
    PROJCS[""WGS 84 / Pseudo-Mercator"",
        GEOGCS[""WGS 84"",
            DATUM[""WGS_1984"",
                SPHEROID[""WGS 84"",6378137,298.257223563,AUTHORITY[""EPSG"",""7030""]],
                AUTHORITY[""EPSG"",""6326""]],
            PRIMEM[""Greenwich"",0,AUTHORITY[""EPSG"",""8901""]],
            UNIT[""degree"",0.0174532925199433,AUTHORITY[""EPSG"",""9122""]],
            AUTHORITY[""EPSG"",""4326""]],
        PROJECTION[""Mercator_1SP""],
        PARAMETER[""central_meridian"",0],
        PARAMETER[""scale_factor"",1],
        PARAMETER[""false_easting"",0],
        PARAMETER[""false_northing"",0],
        UNIT[""metre"",1,AUTHORITY[""EPSG"",""9001""]],
        AXIS[""X"",EAST],
        AXIS[""Y"",NORTH],
        AUTHORITY[""EPSG"",""3857""]]";

var mercator = csFactory.CreateFromWkt(mercatorWkt);

// 创建转换
var wgs84ToMercator = ctFactory.CreateFromCoordinateSystems(wgs84, mercator);
var mercatorToWgs84 = ctFactory.CreateFromCoordinateSystems(mercator, wgs84);

// 应用到图层
vectorLayer.CoordinateTransformation = wgs84ToMercator;
vectorLayer.ReverseCoordinateTransformation = mercatorToWgs84;
```

### 4.3.3 动态投影转换

```csharp
public class CoordinateTransformHelper
{
    private readonly CoordinateSystemFactory _csFactory;
    private readonly CoordinateTransformationFactory _ctFactory;
    private readonly Dictionary<string, ICoordinateSystem> _coordinateSystems;
    
    public CoordinateTransformHelper()
    {
        _csFactory = new CoordinateSystemFactory();
        _ctFactory = new CoordinateTransformationFactory();
        _coordinateSystems = new Dictionary<string, ICoordinateSystem>();
        
        // 预加载常用坐标系
        LoadCommonCoordinateSystems();
    }
    
    private void LoadCommonCoordinateSystems()
    {
        // WGS84
        _coordinateSystems["EPSG:4326"] = GeographicCoordinateSystem.WGS84;
        
        // Web Mercator
        _coordinateSystems["EPSG:3857"] = CreateWebMercator();
        
        // CGCS2000
        _coordinateSystems["EPSG:4490"] = CreateCGCS2000();
    }
    
    private ICoordinateSystem CreateWebMercator()
    {
        // Web Mercator WKT 定义
        string wkt = "PROJCS[\"WGS 84 / Pseudo-Mercator\",...省略...]";
        return _csFactory.CreateFromWkt(wkt);
    }
    
    private ICoordinateSystem CreateCGCS2000()
    {
        // CGCS2000 WKT 定义
        string wkt = "GEOGCS[\"China Geodetic Coordinate System 2000\",...省略...]";
        return _csFactory.CreateFromWkt(wkt);
    }
    
    public ICoordinateTransformation GetTransformation(string sourceEpsg, string targetEpsg)
    {
        if (!_coordinateSystems.ContainsKey(sourceEpsg) || 
            !_coordinateSystems.ContainsKey(targetEpsg))
        {
            throw new ArgumentException("未知的坐标系统");
        }
        
        return _ctFactory.CreateFromCoordinateSystems(
            _coordinateSystems[sourceEpsg],
            _coordinateSystems[targetEpsg]
        );
    }
    
    public Coordinate Transform(Coordinate coord, string sourceEpsg, string targetEpsg)
    {
        var transformation = GetTransformation(sourceEpsg, targetEpsg);
        var mathTransform = transformation.MathTransform;
        
        double[] input = { coord.X, coord.Y };
        double[] output = mathTransform.Transform(input);
        
        return new Coordinate(output[0], output[1]);
    }
}
```

## 4.4 地图渲染

### 4.4.1 基本渲染

```csharp
// 渲染地图到 Image
Image mapImage = map.GetMap();

// 保存为文件
mapImage.Save("map.png", ImageFormat.Png);
mapImage.Save("map.jpg", ImageFormat.Jpeg);
mapImage.Save("map.bmp", ImageFormat.Bmp);

// 渲染为指定格式的字节数组
public static byte[] RenderToBytes(Map map, ImageFormat format)
{
    using (var image = map.GetMap())
    using (var stream = new MemoryStream())
    {
        image.Save(stream, format);
        return stream.ToArray();
    }
}

// 渲染为 Base64 字符串
public static string RenderToBase64(Map map, ImageFormat format)
{
    byte[] bytes = RenderToBytes(map, format);
    return Convert.ToBase64String(bytes);
}
```

### 4.4.2 高质量渲染

```csharp
// 渲染到 Graphics 对象
using (var bitmap = new Bitmap(map.Size.Width, map.Size.Height))
using (var graphics = Graphics.FromImage(bitmap))
{
    // 设置高质量渲染
    graphics.SmoothingMode = SmoothingMode.HighQuality;
    graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
    graphics.CompositingQuality = CompositingQuality.HighQuality;
    graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
    
    // 填充背景
    graphics.Clear(map.BackColor);
    
    // 渲染各图层
    foreach (var layer in map.BackgroundLayer.Concat(map.Layers))
    {
        if (layer.Enabled)
        {
            layer.Render(graphics, map);
        }
    }
    
    bitmap.Save("high_quality_map.png", ImageFormat.Png);
}
```

### 4.4.3 瓦片渲染

```csharp
public class TileRenderer
{
    private readonly Map _templateMap;
    private readonly int _tileSize;
    
    public TileRenderer(Map templateMap, int tileSize = 256)
    {
        _templateMap = templateMap;
        _tileSize = tileSize;
    }
    
    public Image RenderTile(int x, int y, int zoom)
    {
        // 计算瓦片范围（Web Mercator）
        var extent = TileToEnvelope(x, y, zoom);
        
        // 克隆地图并设置范围
        var map = CloneMap(_templateMap);
        map.Size = new Size(_tileSize, _tileSize);
        map.ZoomToBox(extent);
        
        return map.GetMap();
    }
    
    private Envelope TileToEnvelope(int x, int y, int zoom)
    {
        double n = Math.Pow(2, zoom);
        double mercatorSize = 20037508.34 * 2;
        double tileSize = mercatorSize / n;
        
        double minX = -20037508.34 + x * tileSize;
        double maxX = minX + tileSize;
        double maxY = 20037508.34 - y * tileSize;
        double minY = maxY - tileSize;
        
        return new Envelope(minX, maxX, minY, maxY);
    }
    
    private Map CloneMap(Map original)
    {
        var clone = new Map(original.Size);
        clone.BackColor = original.BackColor;
        clone.SRID = original.SRID;
        
        foreach (var layer in original.BackgroundLayer)
        {
            clone.BackgroundLayer.Add(layer);
        }
        
        foreach (var layer in original.Layers)
        {
            clone.Layers.Add(layer);
        }
        
        return clone;
    }
}
```

### 4.4.4 异步渲染

```csharp
public class AsyncMapRenderer
{
    public async Task<Image> RenderMapAsync(Map map)
    {
        return await Task.Run(() =>
        {
            lock (map)
            {
                return map.GetMap();
            }
        });
    }
    
    public async Task<byte[]> RenderToBytesAsync(Map map, ImageFormat format)
    {
        var image = await RenderMapAsync(map);
        
        using (var stream = new MemoryStream())
        {
            image.Save(stream, format);
            return stream.ToArray();
        }
    }
    
    public async Task RenderToFileAsync(Map map, string filePath, ImageFormat format)
    {
        var image = await RenderMapAsync(map);
        
        await Task.Run(() =>
        {
            image.Save(filePath, format);
        });
    }
}

// 使用示例
var renderer = new AsyncMapRenderer();

// 异步渲染
var mapImage = await renderer.RenderMapAsync(map);

// 异步保存
await renderer.RenderToFileAsync(map, "async_map.png", ImageFormat.Png);
```

## 4.5 地图导出

### 4.5.1 导出为图片

```csharp
public class MapExporter
{
    public void ExportToPng(Map map, string filePath, int? dpi = null)
    {
        using (var image = map.GetMap())
        {
            if (dpi.HasValue)
            {
                // 设置 DPI
                var bitmap = image as Bitmap;
                if (bitmap != null)
                {
                    bitmap.SetResolution(dpi.Value, dpi.Value);
                }
            }
            
            image.Save(filePath, ImageFormat.Png);
        }
    }
    
    public void ExportToJpeg(Map map, string filePath, long quality = 90)
    {
        using (var image = map.GetMap())
        {
            var encoder = ImageCodecInfo.GetImageEncoders()
                .First(c => c.FormatID == ImageFormat.Jpeg.Guid);
            
            var encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(
                System.Drawing.Imaging.Encoder.Quality, quality);
            
            image.Save(filePath, encoder, encoderParams);
        }
    }
    
    public void ExportToTiff(Map map, string filePath)
    {
        using (var image = map.GetMap())
        {
            // 使用 LZW 压缩
            var encoder = ImageCodecInfo.GetImageEncoders()
                .First(c => c.FormatID == ImageFormat.Tiff.Guid);
            
            var encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(
                System.Drawing.Imaging.Encoder.Compression, 
                (long)EncoderValue.CompressionLZW);
            
            image.Save(filePath, encoder, encoderParams);
        }
    }
}
```

### 4.5.2 高分辨率导出

```csharp
public static void ExportHighResolution(Map map, string filePath, int scale)
{
    // 保存原始尺寸
    var originalSize = map.Size;
    var originalEnvelope = map.Envelope;
    
    try
    {
        // 设置高分辨率尺寸
        map.Size = new Size(originalSize.Width * scale, originalSize.Height * scale);
        
        // 保持相同的范围
        map.ZoomToBox(originalEnvelope);
        
        // 渲染并保存
        using (var image = map.GetMap())
        {
            var bitmap = image as Bitmap;
            if (bitmap != null)
            {
                // 设置 DPI（假设原始为 96 DPI）
                bitmap.SetResolution(96 * scale, 96 * scale);
            }
            
            image.Save(filePath, ImageFormat.Png);
        }
    }
    finally
    {
        // 恢复原始尺寸
        map.Size = originalSize;
        map.ZoomToBox(originalEnvelope);
    }
}

// 导出 300 DPI 图片（约 3 倍分辨率）
ExportHighResolution(map, "high_res_map.png", 3);
```

### 4.5.3 分幅导出

```csharp
public class GridExporter
{
    public void ExportGrid(Map map, string outputDir, int rows, int cols)
    {
        var fullExtent = map.Envelope;
        double cellWidth = fullExtent.Width / cols;
        double cellHeight = fullExtent.Height / rows;
        
        for (int row = 0; row < rows; row++)
        {
            for (int col = 0; col < cols; col++)
            {
                // 计算单元格范围
                double minX = fullExtent.MinX + col * cellWidth;
                double maxX = minX + cellWidth;
                double maxY = fullExtent.MaxY - row * cellHeight;
                double minY = maxY - cellHeight;
                
                var cellEnvelope = new Envelope(minX, maxX, minY, maxY);
                
                // 设置地图范围并渲染
                map.ZoomToBox(cellEnvelope);
                
                using (var image = map.GetMap())
                {
                    string fileName = $"tile_{row}_{col}.png";
                    string filePath = Path.Combine(outputDir, fileName);
                    image.Save(filePath, ImageFormat.Png);
                }
            }
        }
        
        // 恢复全图范围
        map.ZoomToBox(fullExtent);
    }
}
```

## 4.6 比例尺管理

### 4.6.1 比例尺计算

```csharp
public class ScaleHelper
{
    /// <summary>
    /// 获取当前地图比例尺
    /// </summary>
    public static double GetMapScale(Map map, double dpi = 96)
    {
        // 计算每像素代表的地图单位
        double pixelSize = map.PixelWidth;
        
        // 转换为米（假设坐标系为度）
        if (map.SRID == 4326)
        {
            // 1度约等于 111320 米（在赤道处）
            double metersPerUnit = 111320;
            double metersPerPixel = pixelSize * metersPerUnit;
            
            // 计算比例尺（每英寸 dpi 个像素，1 英寸 = 0.0254 米）
            double metersPerInch = metersPerPixel * dpi;
            return metersPerInch / 0.0254;
        }
        else if (map.SRID == 3857)
        {
            // Web Mercator 单位为米
            double metersPerInch = pixelSize * dpi;
            return metersPerInch / 0.0254;
        }
        
        return map.MapScale;
    }
    
    /// <summary>
    /// 设置地图到指定比例尺
    /// </summary>
    public static void SetMapScale(Map map, double scale, double dpi = 96)
    {
        // 计算每像素对应的地图单位
        double metersPerInch = scale * 0.0254;
        double pixelSize = metersPerInch / dpi;
        
        if (map.SRID == 4326)
        {
            double metersPerUnit = 111320;
            pixelSize /= metersPerUnit;
        }
        
        // 计算新的 Zoom 值
        map.Zoom = pixelSize * map.Size.Width;
    }
    
    /// <summary>
    /// 常用比例尺
    /// </summary>
    public static class CommonScales
    {
        public const double Scale_1_500 = 500;
        public const double Scale_1_1000 = 1000;
        public const double Scale_1_2000 = 2000;
        public const double Scale_1_5000 = 5000;
        public const double Scale_1_10000 = 10000;
        public const double Scale_1_25000 = 25000;
        public const double Scale_1_50000 = 50000;
        public const double Scale_1_100000 = 100000;
        public const double Scale_1_250000 = 250000;
        public const double Scale_1_500000 = 500000;
        public const double Scale_1_1000000 = 1000000;
    }
}

// 使用示例
double currentScale = ScaleHelper.GetMapScale(map);
Console.WriteLine($"当前比例尺：1:{currentScale:N0}");

// 设置到 1:50000
ScaleHelper.SetMapScale(map, ScaleHelper.CommonScales.Scale_1_50000);
```

### 4.6.2 比例尺控件实现

```csharp
public class ScaleBar
{
    public float X { get; set; }
    public float Y { get; set; }
    public int Width { get; set; } = 200;
    public int Height { get; set; } = 30;
    public Font Font { get; set; } = new Font("Arial", 8);
    public Color ForeColor { get; set; } = Color.Black;
    public Color BackColor { get; set; } = Color.White;
    
    public void Render(Graphics g, Map map)
    {
        // 计算比例尺
        double scale = map.MapScale;
        double pixelSize = map.PixelWidth;
        
        // 选择合适的距离
        double[] distances = { 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000 };
        double selectedDistance = 0;
        double selectedPixels = 0;
        
        foreach (var distance in distances)
        {
            double pixels = distance / (pixelSize * 111320);  // 假设 WGS84
            if (pixels > 50 && pixels < Width - 50)
            {
                selectedDistance = distance;
                selectedPixels = pixels;
                break;
            }
        }
        
        if (selectedDistance == 0)
            return;
        
        // 绘制背景
        g.FillRectangle(new SolidBrush(BackColor), X, Y, Width, Height);
        
        // 绘制比例尺条
        float barY = Y + Height / 2;
        float barX = X + 10;
        
        using (var pen = new Pen(ForeColor, 2))
        {
            // 主线
            g.DrawLine(pen, barX, barY, barX + (float)selectedPixels, barY);
            
            // 端点
            g.DrawLine(pen, barX, barY - 5, barX, barY + 5);
            g.DrawLine(pen, barX + (float)selectedPixels, barY - 5, 
                barX + (float)selectedPixels, barY + 5);
        }
        
        // 绘制文字
        string text = FormatDistance(selectedDistance);
        var textSize = g.MeasureString(text, Font);
        g.DrawString(text, Font, new SolidBrush(ForeColor),
            barX + (float)selectedPixels / 2 - textSize.Width / 2,
            barY + 5);
    }
    
    private string FormatDistance(double meters)
    {
        if (meters >= 1000)
            return $"{meters / 1000:N0} km";
        return $"{meters:N0} m";
    }
}
```

## 4.7 地图事件处理

### 4.7.1 MapBox 事件

```csharp
public partial class MapForm : Form
{
    private Map _map;
    private SharpMap.Forms.MapBox _mapBox;
    
    private void InitializeMapBox()
    {
        _mapBox = new SharpMap.Forms.MapBox();
        _mapBox.Dock = DockStyle.Fill;
        _mapBox.Map = _map;
        
        // 绑定事件
        _mapBox.MouseMove += MapBox_MouseMove;
        _mapBox.MouseClick += MapBox_MouseClick;
        _mapBox.MouseDoubleClick += MapBox_MouseDoubleClick;
        _mapBox.MouseWheel += MapBox_MouseWheel;
        _mapBox.MapRefreshed += MapBox_MapRefreshed;
        _mapBox.MapViewOnChange += MapBox_MapViewOnChange;
        _mapBox.MapZoomChanged += MapBox_MapZoomChanged;
        _mapBox.MapCenterChanged += MapBox_MapCenterChanged;
        
        this.Controls.Add(_mapBox);
    }
    
    private void MapBox_MouseMove(object sender, MouseEventArgs e)
    {
        // 显示当前坐标
        var worldPoint = _map.ImageToWorld(new PointF(e.X, e.Y));
        statusLabel.Text = $"坐标：{worldPoint.X:F6}, {worldPoint.Y:F6}";
    }
    
    private void MapBox_MouseClick(object sender, MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left)
        {
            var worldPoint = _map.ImageToWorld(new PointF(e.X, e.Y));
            
            // 执行点击查询
            PerformPointQuery(worldPoint);
        }
    }
    
    private void MapBox_MouseDoubleClick(object sender, MouseEventArgs e)
    {
        // 双击放大到点击位置
        var worldPoint = _map.ImageToWorld(new PointF(e.X, e.Y));
        _map.Center = worldPoint;
        _map.Zoom /= 2;
        _mapBox.Refresh();
    }
    
    private void MapBox_MouseWheel(object sender, MouseEventArgs e)
    {
        // 滚轮缩放在 MapBox 内部已实现
        // 可以在这里添加额外的逻辑
        UpdateScaleDisplay();
    }
    
    private void MapBox_MapRefreshed(object sender, EventArgs e)
    {
        // 地图刷新后的处理
        Console.WriteLine("地图已刷新");
    }
    
    private void MapBox_MapViewOnChange(object sender)
    {
        // 视图变化时的处理
        UpdateScaleDisplay();
    }
    
    private void MapBox_MapZoomChanged(double zoom)
    {
        // 缩放变化时的处理
        Console.WriteLine($"当前缩放：{zoom}");
    }
    
    private void MapBox_MapCenterChanged(Coordinate center)
    {
        // 中心点变化时的处理
        Console.WriteLine($"中心点：{center.X}, {center.Y}");
    }
    
    private void PerformPointQuery(Coordinate point)
    {
        // 创建查询范围
        double tolerance = _map.PixelWidth * 5;  // 5 像素容差
        var queryEnvelope = new Envelope(
            point.X - tolerance, point.X + tolerance,
            point.Y - tolerance, point.Y + tolerance
        );
        
        // 查询各图层
        foreach (var layer in _map.Layers.OfType<VectorLayer>())
        {
            var ds = new FeatureDataSet();
            layer.DataSource.ExecuteIntersectionQuery(queryEnvelope, ds);
            
            if (ds.Tables.Count > 0 && ds.Tables[0].Rows.Count > 0)
            {
                // 显示查询结果
                ShowQueryResult(layer.LayerName, ds.Tables[0]);
                break;
            }
        }
    }
    
    private void ShowQueryResult(string layerName, FeatureDataTable table)
    {
        var row = table.Rows[0] as FeatureDataRow;
        var sb = new StringBuilder();
        sb.AppendLine($"图层：{layerName}");
        
        foreach (DataColumn column in table.Columns)
        {
            sb.AppendLine($"{column.ColumnName}: {row[column]}");
        }
        
        MessageBox.Show(sb.ToString(), "查询结果");
    }
    
    private void UpdateScaleDisplay()
    {
        double scale = _map.MapScale;
        scaleLabel.Text = $"比例尺 1:{scale:N0}";
    }
}
```

## 4.8 本章小结

本章详细介绍了 Map 对象的各种操作和管理方法：

1. **Map 对象创建**：了解了 Map 对象的创建和基本属性配置
2. **视图控制**：掌握了缩放、平移、范围管理等操作
3. **坐标转换**：学习了屏幕坐标与地理坐标的转换方法
4. **地图渲染**：了解了基本渲染、高质量渲染和异步渲染
5. **地图导出**：掌握了各种格式的地图导出方法
6. **比例尺管理**：学习了比例尺计算和比例尺控件实现
7. **事件处理**：了解了 MapBox 控件的事件处理机制

## 4.9 参考资源

- [SharpMap Wiki - Map 类](https://github.com/SharpMap/SharpMap/wiki)
- [ProjNet 文档](https://github.com/NetTopologySuite/ProjNet4GeoAPI)

---

**下一章预告**：第05章将详细介绍 SharpMap 的图层系统，包括各种图层类型的使用方法和高级配置。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/SharpMap/第04章-Map对象与地图管理/第03章-核心架构与类库设计/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/SharpMap/第04章-Map对象与地图管理/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/SharpMap/第04章-Map对象与地图管理/第05章-图层系统详解/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
