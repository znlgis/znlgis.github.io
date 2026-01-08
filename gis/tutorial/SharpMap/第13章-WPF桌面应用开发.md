# 第13章：WPF 桌面应用开发

## 13.1 WPF 集成概述

SharpMap 没有原生的 WPF 控件，但可以通过以下方式在 WPF 中使用：

1. **WindowsFormsHost** - 在 WPF 中承载 WinForms MapBox 控件
2. **Image 绑定** - 将地图渲染为图片显示在 WPF Image 控件中
3. **自定义控件** - 创建基于 WPF 的自定义地图控件

## 13.2 使用 WindowsFormsHost

### 13.2.1 项目配置

```xml
<!-- 添加引用 -->
<ItemGroup>
    <PackageReference Include="SharpMap" Version="1.2.0" />
    <PackageReference Include="SharpMap.UI" Version="1.2.0" />
</ItemGroup>

<!-- 添加程序集引用 -->
<ItemGroup>
    <Reference Include="WindowsFormsIntegration" />
    <Reference Include="System.Windows.Forms" />
</ItemGroup>
```

### 13.2.2 XAML 布局

```xml
<Window x:Class="SharpMapWpf.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:wfi="clr-namespace:System.Windows.Forms.Integration;assembly=WindowsFormsIntegration"
        xmlns:sm="clr-namespace:SharpMap.Forms;assembly=SharpMap.UI"
        Title="SharpMap WPF" Height="600" Width="800">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- 工具栏 -->
        <ToolBar Grid.Row="0">
            <Button Content="平移" Click="Pan_Click"/>
            <Button Content="放大" Click="ZoomIn_Click"/>
            <Button Content="缩小" Click="ZoomOut_Click"/>
            <Separator/>
            <Button Content="全图" Click="ZoomToExtents_Click"/>
        </ToolBar>

        <!-- 地图控件 -->
        <WindowsFormsHost Grid.Row="1" x:Name="mapHost">
            <sm:MapBox x:Name="mapBox"/>
        </WindowsFormsHost>

        <!-- 状态栏 -->
        <StatusBar Grid.Row="2">
            <StatusBarItem>
                <TextBlock x:Name="statusText" Text="就绪"/>
            </StatusBarItem>
        </StatusBar>
    </Grid>
</Window>
```

### 13.2.3 代码实现

```csharp
using System.Windows;
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;
using SharpMap.Styles;
using SharpMap.Forms;

public partial class MainWindow : Window
{
    private Map _map;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        InitializeMap();
    }

    private void InitializeMap()
    {
        _map = new Map(new System.Drawing.Size(800, 600));
        _map.BackColor = System.Drawing.Color.White;

        // 加载图层
        var layer = new VectorLayer("Countries");
        layer.DataSource = new ShapeFile("countries.shp", true);
        layer.Style = new VectorStyle
        {
            Fill = new System.Drawing.SolidBrush(System.Drawing.Color.LightGreen),
            Outline = new System.Drawing.Pen(System.Drawing.Color.DarkGreen, 1),
            EnableOutline = true
        };
        _map.Layers.Add(layer);
        _map.ZoomToExtents();

        // 绑定到控件
        mapBox.Map = _map;
        mapBox.ActiveTool = MapBox.Tools.Pan;

        // 事件绑定
        mapBox.MouseMove += MapBox_MouseMove;
    }

    private void MapBox_MouseMove(object sender, System.Windows.Forms.MouseEventArgs e)
    {
        var worldPoint = _map.ImageToWorld(new System.Drawing.PointF(e.X, e.Y));
        statusText.Text = $"坐标: {worldPoint.X:F6}, {worldPoint.Y:F6}";
    }

    private void Pan_Click(object sender, RoutedEventArgs e)
        => mapBox.ActiveTool = MapBox.Tools.Pan;

    private void ZoomIn_Click(object sender, RoutedEventArgs e)
        => mapBox.ActiveTool = MapBox.Tools.ZoomIn;

    private void ZoomOut_Click(object sender, RoutedEventArgs e)
        => mapBox.ActiveTool = MapBox.Tools.ZoomOut;

    private void ZoomToExtents_Click(object sender, RoutedEventArgs e)
    {
        _map.ZoomToExtents();
        mapBox.Refresh();
    }
}
```

## 13.3 使用 Image 控件

### 13.3.1 MVVM 模式

```csharp
// ViewModel
public class MapViewModel : INotifyPropertyChanged
{
    private Map _map;
    private BitmapSource _mapImage;
    
    public BitmapSource MapImage
    {
        get => _mapImage;
        set { _mapImage = value; OnPropertyChanged(); }
    }
    
    public ICommand ZoomInCommand { get; }
    public ICommand ZoomOutCommand { get; }
    public ICommand PanCommand { get; }
    
    public MapViewModel()
    {
        InitializeMap();
        
        ZoomInCommand = new RelayCommand(() => Zoom(0.5));
        ZoomOutCommand = new RelayCommand(() => Zoom(2));
    }
    
    private void InitializeMap()
    {
        _map = new Map(new System.Drawing.Size(800, 600));
        _map.BackColor = System.Drawing.Color.White;
        
        // 加载数据...
        
        RefreshMap();
    }
    
    private void Zoom(double factor)
    {
        _map.Zoom *= factor;
        RefreshMap();
    }
    
    private void RefreshMap()
    {
        using (var image = _map.GetMap())
        {
            MapImage = ConvertToBitmapSource(image);
        }
    }
    
    private BitmapSource ConvertToBitmapSource(System.Drawing.Image image)
    {
        using (var bitmap = new System.Drawing.Bitmap(image))
        using (var memory = new MemoryStream())
        {
            bitmap.Save(memory, System.Drawing.Imaging.ImageFormat.Png);
            memory.Position = 0;
            
            var bitmapImage = new BitmapImage();
            bitmapImage.BeginInit();
            bitmapImage.StreamSource = memory;
            bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
            bitmapImage.EndInit();
            bitmapImage.Freeze();
            
            return bitmapImage;
        }
    }
    
    public event PropertyChangedEventHandler PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string name = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }
}
```

### 13.3.2 XAML 绑定

```xml
<Window x:Class="SharpMapWpf.ImageMapWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="SharpMap Image" Height="600" Width="800">
    <Window.DataContext>
        <local:MapViewModel/>
    </Window.DataContext>
    
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        
        <ToolBar Grid.Row="0">
            <Button Content="放大" Command="{Binding ZoomInCommand}"/>
            <Button Content="缩小" Command="{Binding ZoomOutCommand}"/>
        </ToolBar>
        
        <Image Grid.Row="1" Source="{Binding MapImage}" 
               Stretch="None" HorizontalAlignment="Center" 
               VerticalAlignment="Center"/>
    </Grid>
</Window>
```

## 13.4 鼠标交互

### 13.4.1 拖拽平移

```csharp
public class MapControl : Image
{
    private Map _map;
    private Point _lastMousePosition;
    private bool _isDragging;
    
    public MapControl()
    {
        this.MouseLeftButtonDown += OnMouseLeftButtonDown;
        this.MouseLeftButtonUp += OnMouseLeftButtonUp;
        this.MouseMove += OnMouseMove;
        this.MouseWheel += OnMouseWheel;
    }
    
    private void OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        _lastMousePosition = e.GetPosition(this);
        _isDragging = true;
        this.CaptureMouse();
    }
    
    private void OnMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        _isDragging = false;
        this.ReleaseMouseCapture();
    }
    
    private void OnMouseMove(object sender, MouseEventArgs e)
    {
        if (_isDragging && _map != null)
        {
            var currentPosition = e.GetPosition(this);
            var deltaX = (currentPosition.X - _lastMousePosition.X) * _map.PixelWidth;
            var deltaY = (currentPosition.Y - _lastMousePosition.Y) * _map.PixelHeight;
            
            var center = _map.Center;
            _map.Center = new Coordinate(center.X - deltaX, center.Y + deltaY);
            
            _lastMousePosition = currentPosition;
            RefreshMap();
        }
    }
    
    private void OnMouseWheel(object sender, MouseWheelEventArgs e)
    {
        if (_map != null)
        {
            double factor = e.Delta > 0 ? 0.8 : 1.2;
            _map.Zoom *= factor;
            RefreshMap();
        }
    }
}
```

## 13.5 自定义 WPF 地图控件

```csharp
public class WpfMapControl : FrameworkElement
{
    private Map _map;
    private DrawingVisual _visual;
    
    public static readonly DependencyProperty MapProperty =
        DependencyProperty.Register("Map", typeof(Map), typeof(WpfMapControl),
            new PropertyMetadata(null, OnMapChanged));
    
    public Map Map
    {
        get => (Map)GetValue(MapProperty);
        set => SetValue(MapProperty, value);
    }
    
    public WpfMapControl()
    {
        _visual = new DrawingVisual();
        AddVisualChild(_visual);
    }
    
    private static void OnMapChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var control = (WpfMapControl)d;
        control._map = e.NewValue as Map;
        control.RefreshMap();
    }
    
    public void RefreshMap()
    {
        if (_map == null || ActualWidth == 0 || ActualHeight == 0)
            return;
        
        _map.Size = new System.Drawing.Size((int)ActualWidth, (int)ActualHeight);
        
        using (var image = _map.GetMap())
        using (var bitmap = new System.Drawing.Bitmap(image))
        using (var memory = new MemoryStream())
        {
            bitmap.Save(memory, System.Drawing.Imaging.ImageFormat.Png);
            memory.Position = 0;
            
            var bitmapImage = new BitmapImage();
            bitmapImage.BeginInit();
            bitmapImage.StreamSource = memory;
            bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
            bitmapImage.EndInit();
            
            using (var dc = _visual.RenderOpen())
            {
                dc.DrawImage(bitmapImage, new Rect(0, 0, ActualWidth, ActualHeight));
            }
        }
    }
    
    protected override int VisualChildrenCount => 1;
    
    protected override Visual GetVisualChild(int index) => _visual;
    
    protected override void OnRenderSizeChanged(SizeChangedInfo sizeInfo)
    {
        base.OnRenderSizeChanged(sizeInfo);
        RefreshMap();
    }
}
```

## 13.6 图层管理

```xml
<!-- XAML -->
<ListBox ItemsSource="{Binding Layers}">
    <ListBox.ItemTemplate>
        <DataTemplate>
            <CheckBox Content="{Binding Name}" 
                      IsChecked="{Binding IsVisible, Mode=TwoWay}"/>
        </DataTemplate>
    </ListBox.ItemTemplate>
</ListBox>
```

```csharp
// ViewModel
public class LayerViewModel : INotifyPropertyChanged
{
    private readonly ILayer _layer;
    
    public string Name => _layer.LayerName;
    
    public bool IsVisible
    {
        get => _layer.Enabled;
        set
        {
            _layer.Enabled = value;
            OnPropertyChanged();
            // 触发地图刷新
        }
    }
}
```

## 13.7 本章小结

本章介绍了 SharpMap WPF 桌面应用开发：

1. **WindowsFormsHost**：在 WPF 中承载 WinForms 控件
2. **Image 绑定**：使用 MVVM 模式渲染地图
3. **鼠标交互**：实现拖拽和缩放
4. **自定义控件**：创建 WPF 原生地图控件
5. **图层管理**：WPF 风格的图层控制

---

**下一章预告**：第14章将介绍 ASP.NET Web 应用开发。
