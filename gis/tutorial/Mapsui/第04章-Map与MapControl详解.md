---
layout: default
title: 第04章 - Map与MapControl详解
---

# 第04章：Map与MapControl详解

## 4.1 Map 类深入

### 4.1.1 Map 的生命周期

Map 对象的生命周期管理非常重要，特别是在涉及资源释放时：

```csharp
public class MapManager : IDisposable
{
    private Map _map;
    
    public MapManager()
    {
        _map = CreateMap();
    }
    
    private Map CreateMap()
    {
        var map = new Map
        {
            CRS = "EPSG:3857"
        };
        
        // 订阅事件
        map.DataChanged += OnDataChanged;
        map.PropertyChanged += OnPropertyChanged;
        map.Info += OnMapInfo;
        
        return map;
    }
    
    public void Dispose()
    {
        if (_map != null)
        {
            // 取消订阅事件
            _map.DataChanged -= OnDataChanged;
            _map.PropertyChanged -= OnPropertyChanged;
            _map.Info -= OnMapInfo;
            
            // 释放资源
            _map.Dispose();
            _map = null;
        }
    }
    
    private void OnDataChanged(object sender, DataChangedEventArgs e) { }
    private void OnPropertyChanged(object sender, PropertyChangedEventArgs e) { }
    private void OnMapInfo(object sender, MapInfoEventArgs e) { }
}
```

### 4.1.2 Map 属性详解

```csharp
public class Map
{
    /// <summary>
    /// 坐标参考系统标识符
    /// 默认为 "EPSG:3857" (Web Mercator)
    /// 也可设置为 "EPSG:4326" (WGS84 经纬度)
    /// </summary>
    public string CRS { get; set; }
    
    /// <summary>
    /// 地图背景颜色
    /// </summary>
    public Color BackColor { get; set; }
    
    /// <summary>
    /// 图层集合
    /// </summary>
    public LayerCollection Layers { get; }
    
    /// <summary>
    /// 导航器，用于控制视口
    /// </summary>
    public Navigator Navigator { get; }
    
    /// <summary>
    /// 小部件集合
    /// </summary>
    public IList<IWidget> Widgets { get; }
    
    /// <summary>
    /// 获取所有图层的合并范围
    /// </summary>
    public MRect? Extent { get; }
}
```

### 4.1.3 Map 方法详解

```csharp
// 刷新方法
public void Refresh()           // 完全刷新（数据+图形）
public void RefreshGraphics()   // 仅刷新图形
public void RefreshData()       // 仅刷新数据

// 获取地图信息
public MapInfo GetMapInfo(
    MPoint screenPosition,      // 屏幕坐标
    Viewport viewport,          // 视口
    int margin = 0              // 容差范围（像素）
)

// 使用示例
var mapInfo = map.GetMapInfo(
    new MPoint(400, 300),
    mapControl.Viewport,
    margin: 10  // 点击容差
);

if (mapInfo.Feature != null)
{
    Console.WriteLine($"Found feature: {mapInfo.Feature}");
    Console.WriteLine($"World position: {mapInfo.WorldPosition}");
    Console.WriteLine($"Layer: {mapInfo.Layer?.Name}");
}
```

## 4.2 MapControl 详解

### 4.2.1 各平台 MapControl 共同特性

虽然 MapControl 在不同平台有不同的实现，但它们共享以下特性：

```csharp
public interface IMapControl
{
    // 关联的 Map 对象
    Map? Map { get; set; }
    
    // 当前视口
    Viewport Viewport { get; }
    
    // 渲染器
    IRenderer Renderer { get; }
    
    // 刷新方法
    void Refresh();
    void RefreshGraphics();
    void RefreshData();
}
```

### 4.2.2 WPF MapControl

```csharp
// XAML 中声明
<mapsui:MapControl x:Name="mapControl"
                   Background="White"
                   ClipToBounds="True"/>

// 代码中配置
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        
        // 创建和配置 Map
        var map = new Map();
        map.Layers.Add(OpenStreetMap.CreateTileLayer());
        
        // 设置到控件
        mapControl.Map = map;
        
        // 事件处理
        mapControl.Loaded += OnMapControlLoaded;
    }
    
    private void OnMapControlLoaded(object sender, RoutedEventArgs e)
    {
        // 控件加载完成后的初始化
        mapControl.Map?.Navigator.ZoomToBox(GetInitialExtent());
    }
}
```

### 4.2.3 MAUI MapControl

```csharp
// XAML 中声明
<ContentPage xmlns:mapsui="clr-namespace:Mapsui.UI.Maui;assembly=Mapsui.UI.Maui">
    <mapsui:MapControl x:Name="mapControl"/>
</ContentPage>

// 代码中配置
public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();
        
        // MAUI 中 Map 通过 Map 属性访问
        mapControl.Map?.Layers.Add(OpenStreetMap.CreateTileLayer());
        
        // MAUI 特有的手势支持已内置
    }
    
    protected override void OnAppearing()
    {
        base.OnAppearing();
        
        // 页面显示时刷新
        mapControl.Refresh();
    }
}
```

### 4.2.4 Avalonia MapControl

```csharp
// AXAML 中声明
<mapsui:MapControl x:Name="mapControl"/>

// 代码中配置
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        
        // Avalonia 的初始化
        mapControl.Map?.Layers.Add(OpenStreetMap.CreateTileLayer());
        
        // Avalonia 特有事件
        mapControl.PointerPressed += OnPointerPressed;
    }
    
    private void OnPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        var position = e.GetPosition(mapControl);
        var worldPosition = mapControl.Viewport.ScreenToWorld(
            new MPoint(position.X, position.Y)
        );
        
        Console.WriteLine($"Clicked at: {worldPosition}");
    }
}
```

## 4.3 地图配置与初始化

### 4.3.1 完整的初始化流程

```csharp
public class MapInitializer
{
    public static Map CreateConfiguredMap()
    {
        var map = new Map();
        
        // 1. 设置基本属性
        ConfigureBasicProperties(map);
        
        // 2. 添加图层
        AddLayers(map);
        
        // 3. 配置小部件
        ConfigureWidgets(map);
        
        // 4. 设置导航限制
        ConfigureNavigation(map);
        
        // 5. 设置事件处理
        ConfigureEvents(map);
        
        return map;
    }
    
    private static void ConfigureBasicProperties(Map map)
    {
        map.CRS = "EPSG:3857";
        map.BackColor = Color.FromString("#F5F5F5");
    }
    
    private static void AddLayers(Map map)
    {
        // 底图
        map.Layers.Add(OpenStreetMap.CreateTileLayer());
        
        // 数据图层
        var dataLayer = new MemoryLayer
        {
            Name = "DataLayer",
            Features = new List<IFeature>(),
            Style = CreateDefaultStyle()
        };
        map.Layers.Add(dataLayer);
    }
    
    private static void ConfigureWidgets(Map map)
    {
        // 缩放按钮
        map.Widgets.Add(new ZoomInOutWidget
        {
            MarginX = 20,
            MarginY = 20,
            Orientation = Orientation.Vertical
        });
        
        // 比例尺
        map.Widgets.Add(new ScaleBarWidget(map)
        {
            MarginX = 10,
            MarginY = 30,
            TextAlignment = Alignment.Center
        });
    }
    
    private static void ConfigureNavigation(Map map)
    {
        // 缩放限制
        map.Navigator.ZoomLimits = new MMinMax(100, 100000000);
        
        // 平移限制（可选）
        // map.Navigator.PanLimits = new MRect(...);
        
        // 旋转（默认启用）
        map.Navigator.RotationLock = false;
    }
    
    private static void ConfigureEvents(Map map)
    {
        map.Info += (s, e) =>
        {
            Console.WriteLine($"Map clicked: {e.MapInfo?.WorldPosition}");
        };
        
        map.DataChanged += (s, e) =>
        {
            if (e.Error != null)
            {
                Console.WriteLine($"Data error: {e.Error.Message}");
            }
        };
    }
    
    private static IStyle CreateDefaultStyle()
    {
        return new SymbolStyle
        {
            SymbolScale = 0.5,
            Fill = new Brush(Color.Blue),
            Outline = new Pen(Color.White, 1)
        };
    }
}
```

### 4.3.2 使用 MapBuilder

Mapsui 提供了 MapBuilder 辅助类：

```csharp
// 使用 MapBuilder 创建地图
var map = new MapBuilder()
    .WithBackColor(Color.White)
    .WithOpenStreetMap()
    .Build();

// 自定义 MapBuilder 扩展
public static class MapBuilderExtensions
{
    public static MapBuilder WithOpenStreetMap(this MapBuilder builder)
    {
        // 内部实现添加 OSM 图层
        return builder;
    }
    
    public static MapBuilder WithMyCustomLayer(this MapBuilder builder, 
                                                IEnumerable<IFeature> features)
    {
        // 添加自定义图层的扩展方法
        return builder;
    }
}
```

## 4.4 视口管理

### 4.4.1 理解视口坐标系统

```
屏幕坐标系:                    地图坐标系 (Web Mercator):
┌────────────────┐             ┌────────────────────────┐
│ (0,0)          │             │                        │
│   ┌──────┐     │   ◄────────▶│     (x1, y2)──────(x2, y2)
│   │ 视口 │     │             │         │              │
│   │      │     │             │         │    地图      │
│   └──────┘     │             │         │    范围      │
│        (w,h)   │             │     (x1, y1)──────(x2, y1)
└────────────────┘             └────────────────────────┘
```

### 4.4.2 坐标转换

```csharp
// 屏幕坐标转地图坐标
public MPoint ScreenToWorld(MPoint screenPosition, Viewport viewport)
{
    return viewport.ScreenToWorld(screenPosition);
}

// 地图坐标转屏幕坐标
public MPoint WorldToScreen(MPoint worldPosition, Viewport viewport)
{
    return viewport.WorldToScreen(worldPosition);
}

// 经纬度与 Web Mercator 转换
public MPoint LonLatToMercator(double lon, double lat)
{
    return SphericalMercator.FromLonLat(lon, lat).ToMPoint();
}

public (double Lon, double Lat) MercatorToLonLat(MPoint mercator)
{
    var lonLat = SphericalMercator.ToLonLat(mercator.X, mercator.Y);
    return (lonLat.X, lonLat.Y);
}

// 完整的转换链
public void HandleMapClick(MPoint screenPosition, Viewport viewport)
{
    // 1. 屏幕坐标 -> Web Mercator
    var mercator = viewport.ScreenToWorld(screenPosition);
    
    // 2. Web Mercator -> 经纬度
    var lonLat = SphericalMercator.ToLonLat(mercator.X, mercator.Y);
    
    Console.WriteLine($"经度: {lonLat.X:F6}, 纬度: {lonLat.Y:F6}");
}
```

### 4.4.3 视口事件

```csharp
// 监听视口变化
map.Navigator.Viewport.PropertyChanged += (s, e) =>
{
    var viewport = map.Navigator.Viewport;
    
    Console.WriteLine($"Center: ({viewport.CenterX}, {viewport.CenterY})");
    Console.WriteLine($"Resolution: {viewport.Resolution}");
    Console.WriteLine($"Rotation: {viewport.Rotation * 180 / Math.PI}°");
    Console.WriteLine($"Extent: {viewport.Extent}");
};
```

## 4.5 地图交互

### 4.5.1 处理点击事件

```csharp
public class MapInteractionHandler
{
    private readonly Map _map;
    private readonly MapControl _mapControl;
    
    public MapInteractionHandler(Map map, MapControl mapControl)
    {
        _map = map;
        _mapControl = mapControl;
        
        // 使用 Map.Info 事件处理点击
        _map.Info += OnMapInfo;
    }
    
    private void OnMapInfo(object? sender, MapInfoEventArgs e)
    {
        var mapInfo = e.MapInfo;
        
        if (mapInfo == null) return;
        
        // 检查是否点击到要素
        if (mapInfo.Feature != null)
        {
            HandleFeatureClick(mapInfo);
        }
        else
        {
            HandleEmptyClick(mapInfo);
        }
    }
    
    private void HandleFeatureClick(MapInfo mapInfo)
    {
        var feature = mapInfo.Feature;
        var layer = mapInfo.Layer;
        
        // 获取要素属性
        var name = feature["name"]?.ToString() ?? "未知";
        
        // 高亮显示选中的要素
        HighlightFeature(feature);
        
        // 显示信息
        ShowFeatureInfo(feature);
    }
    
    private void HandleEmptyClick(MapInfo mapInfo)
    {
        // 清除高亮
        ClearHighlight();
        
        // 可选：在点击位置添加标记
        // AddMarkerAt(mapInfo.WorldPosition);
    }
    
    private void HighlightFeature(IFeature feature)
    {
        // 实现高亮逻辑
    }
    
    private void ClearHighlight()
    {
        // 清除高亮逻辑
    }
    
    private void ShowFeatureInfo(IFeature feature)
    {
        // 显示要素信息
    }
}
```

### 4.5.2 自定义交互模式

```csharp
public enum InteractionMode
{
    Pan,        // 平移
    Select,     // 选择
    Draw,       // 绘制
    Measure     // 测量
}

public class InteractionModeManager
{
    private InteractionMode _currentMode = InteractionMode.Pan;
    private readonly Map _map;
    
    public InteractionMode CurrentMode
    {
        get => _currentMode;
        set
        {
            _currentMode = value;
            OnModeChanged();
        }
    }
    
    public InteractionModeManager(Map map)
    {
        _map = map;
    }
    
    private void OnModeChanged()
    {
        switch (_currentMode)
        {
            case InteractionMode.Pan:
                EnablePanMode();
                break;
            case InteractionMode.Select:
                EnableSelectMode();
                break;
            case InteractionMode.Draw:
                EnableDrawMode();
                break;
            case InteractionMode.Measure:
                EnableMeasureMode();
                break;
        }
    }
    
    private void EnablePanMode()
    {
        // 默认模式，不需要特殊处理
    }
    
    private void EnableSelectMode()
    {
        // 配置选择模式
    }
    
    private void EnableDrawMode()
    {
        // 配置绘制模式
    }
    
    private void EnableMeasureMode()
    {
        // 配置测量模式
    }
}
```

## 4.6 地图状态管理

### 4.6.1 保存和恢复地图状态

```csharp
public class MapState
{
    public double CenterX { get; set; }
    public double CenterY { get; set; }
    public double Resolution { get; set; }
    public double Rotation { get; set; }
    public List<string> VisibleLayers { get; set; } = new();
}

public class MapStateManager
{
    public MapState CaptureState(Map map)
    {
        var viewport = map.Navigator.Viewport;
        
        return new MapState
        {
            CenterX = viewport.CenterX,
            CenterY = viewport.CenterY,
            Resolution = viewport.Resolution,
            Rotation = viewport.Rotation,
            VisibleLayers = map.Layers
                .Where(l => l.Enabled)
                .Select(l => l.Name)
                .ToList()
        };
    }
    
    public void RestoreState(Map map, MapState state)
    {
        // 恢复视口状态
        map.Navigator.CenterOnAndZoomTo(
            new MPoint(state.CenterX, state.CenterY),
            state.Resolution
        );
        map.Navigator.RotateTo(state.Rotation);
        
        // 恢复图层可见性
        foreach (var layer in map.Layers)
        {
            layer.Enabled = state.VisibleLayers.Contains(layer.Name);
        }
    }
    
    public string SerializeState(MapState state)
    {
        return JsonSerializer.Serialize(state);
    }
    
    public MapState? DeserializeState(string json)
    {
        return JsonSerializer.Deserialize<MapState>(json);
    }
}
```

### 4.6.2 历史记录管理

```csharp
public class NavigationHistory
{
    private readonly Stack<MapState> _undoStack = new();
    private readonly Stack<MapState> _redoStack = new();
    private readonly MapStateManager _stateManager = new();
    
    public void PushState(Map map)
    {
        _undoStack.Push(_stateManager.CaptureState(map));
        _redoStack.Clear();  // 新操作清除重做栈
    }
    
    public bool CanUndo => _undoStack.Count > 1;
    public bool CanRedo => _redoStack.Count > 0;
    
    public void Undo(Map map)
    {
        if (!CanUndo) return;
        
        // 保存当前状态到重做栈
        _redoStack.Push(_undoStack.Pop());
        
        // 恢复上一个状态
        var previousState = _undoStack.Peek();
        _stateManager.RestoreState(map, previousState);
    }
    
    public void Redo(Map map)
    {
        if (!CanRedo) return;
        
        var nextState = _redoStack.Pop();
        _undoStack.Push(nextState);
        _stateManager.RestoreState(map, nextState);
    }
}
```

## 4.7 性能考虑

### 4.7.1 Map 和 MapControl 的性能优化

```csharp
public class PerformanceOptimizer
{
    public static void OptimizeMap(Map map)
    {
        // 1. 限制图层数量
        // 避免添加过多图层
        
        // 2. 使用适当的缩放限制
        map.Navigator.ZoomLimits = new MMinMax(100, 50000000);
        
        // 3. 配置合理的数据获取策略
        foreach (var layer in map.Layers.OfType<TileLayer>())
        {
            // 配置瓦片缓存
        }
    }
    
    public static void OptimizeMapControl(dynamic mapControl)
    {
        // 平台特定优化
        // WPF: 启用硬件加速
        // MAUI: 配置渲染模式
    }
}
```

### 4.7.2 批量操作优化

```csharp
// 不推荐：频繁刷新
foreach (var feature in features)
{
    layer.Add(feature);
    layer.DataHasChanged();  // 每次都刷新，性能差
}

// 推荐：批量操作后刷新一次
foreach (var feature in features)
{
    layer.Add(feature);
}
layer.DataHasChanged();  // 只刷新一次

// 更好的方式：使用 WritableLayer 的批量方法
var writableLayer = new WritableLayer();
writableLayer.AddRange(features);
writableLayer.DataHasChanged();
```

## 4.8 本章小结

本章详细介绍了 Map 和 MapControl 的使用：

1. **Map 类**：生命周期管理、属性、方法和事件
2. **MapControl**：各平台实现的共同特性和差异
3. **地图配置**：完整的初始化流程和 MapBuilder
4. **视口管理**：坐标系统和坐标转换
5. **地图交互**：点击事件处理和自定义交互模式
6. **状态管理**：保存、恢复状态和历史记录
7. **性能优化**：批量操作和资源管理

在下一章中，我们将深入学习 Mapsui 的图层系统。

## 4.9 思考与练习

1. 实现一个地图书签功能，允许用户保存和恢复多个视图状态。
2. 创建一个自定义的交互模式，支持绘制多边形。
3. 实现地图的前进/后退导航功能。
4. 优化一个包含大量要素的地图应用的性能。
5. 比较不同平台 MapControl 的实现差异。
