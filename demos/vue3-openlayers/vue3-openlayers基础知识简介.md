# vue3-openlayers基础知识简介

[OpenLayers 3 Primer](https://linwei.xyz/ol3-primer/index.html)
[openlayers6：入门基础（一）](https://blog.csdn.net/sinat_36226553/article/details/121010290)
[openlayers 入门教程](https://dajianshi.blog.csdn.net/article/details/136679182)

## 一、基础概念介绍

### 地图(Map)

OpenLayers 的核心部件是 Map（ol.Map）。它被呈现到对象 target 容器（例如，网页上的 div 元素）。所有地图的属性可以在构造时进行配置。ol/Map 类是 OpenLayers API 中的核心组件之一，它负责创建和管理整个地图实例。

### 视图(View)

ol.View 负责地图的中心点，放大，投影之类的设置。一个 ol.View 实例包含投影 projection，该投影决定中心 center 的坐标系以及分辨率的单位，如果没有指定，默认的投影是球墨卡托（EPSG：3857），以米为地图单位。 放大 zoom 选项是一种方便的方式来指定地图的分辨率，可用的缩放级别由 maxZoom（默认值为 28）、zoomFactor（默认值为 2）、maxResolution（默认由投影在 256×256 像素瓦片的有效程度来计算）决定。起始缩放级别 0，以每像素 maxResolution 的单位为分辨率，后续的缩放级别是通过 zoomFactor 区分之前的缩放级别的分辨率来计算的，直到缩放级别达到 maxZoom。

### 图层(Layer)

一个图层是资源中数据的可视化显示，OpenLayers 包含几种基本图层类型：

- ol.layer.Tile 用于显示瓦片资源，这些瓦片提供了预渲染，并且由特定分辨率的缩放级别组织的瓦片图片网格组成。
- ol.layer.Image 用于显示支持渲染服务的图片，这些图片可用于任意范围和分辨率。
- ol.layer.Vector 用于显示在客户端渲染的矢量数据。
- ol.layer.VectorTile 用于显示在客户端渲染的矢量瓦片数据。
- ol.layer.WebGLTile 用于提供预渲染、平铺的瓦片图像，按特定分辨率的缩放级别组织。

### 数据源(Source)

OpenLayers 使用 ol.source.Source 子类获取远程数据图层，包含免费的和商业的地图瓦片服务，如 OpenStreetMap、Bing、OGC 资源（WMS 与 WMTS）、矢量数据（GeoJSON 格式、 KML 格式…）等。当资源(source)与地图视图(view)的坐标系相同时，无需再次设置投影projection（默认与view坐标系一致），只有在资源与视图的投影不同的情况下，才需要在资源中明确指定 projection 属性来表示要素缓存的投影。

### 控件(Control)

控件是一个可见的小部件，其 DOM 元素位于屏幕上的固定位置。 它们可以涉及用户输入（按钮），或者仅提供信息； 位置是使用 CSS 确定的。 默认情况下，它们放置在 CSS 类名为 ol-overlay container-stop event 的容器中，但可以使用任何外部 DOM 元素。在Openlayers中多数Controls直接可以在地图上添加，比如Navigation（导航栏）。第二类是需要放在Div元素中才能用。第三类需要放置在panel（面板）中的操作类似于网页HTML中button按钮，需要点击或绑定才能起作用。最后一类就是自定义类型的。

### 交互(Interaction)

Interaction是用来控制地图的，和控件一样的作用。不过它们的区别是控件触发都是一些可见的 HTML元素触发，如按钮、链接等，而交互功能不可见的，如鼠标双击、滚轮滑动，手机设备的手指缩放等。

### 几何(Geoms)

OpenLayers中的Geoms实际上指的是Geometry（几何对象），它是地图要素（Features）的核心部分，表示了空间数据的具体形状和位置。在OpenLayers中并没有直接名为Geoms的模块或类，而是通过ol/geom模块提供了一系列几何类型，如点（Point）、线（LineString）、多边形（Polygon）、多点集合（MultiPoint）、多线串（MultiLineString）、多边形集合（MultiPolygon）等。几何对象不仅用于构造要素，还可以用于各种空间分析和交互操作，如计算面积、长度、进行交集、缓冲区分析等。同时，它们也是OpenLayers中渲染的基础数据结构。

### 覆盖物(Overlay)

Overlay这个组件在Openlayers 项目中是经常要用到的，使用的场景通常是作为弹窗，显示某点或者某区域的信息。它不是根据屏幕位置固定的，而是与地理坐标相关联，因此平移地图将移动 Overlay。常用的大致有三类，弹窗、标注、文本信息。每个覆盖物都会生成对应的HTML元素，所以我们也可以使用css来修改去样式。一个覆盖物最少需要一个元素，当数据量大时，元素节点过多会导致页面加载卡顿，不流畅。大数据量的绘制图还是使用图层最好。

### 样式(Style)

OpenLayers 提供了一种强大且灵活的方式来自定义地图上的矢量要素（如点、线、面）的样式，这些样式是通过 ol/style 模块中的 ol.style.Style 类和其他相关子类（如 ol.style.Icon、ol.style.Stroke、ol.style.Fill、ol.style.Text 等）来实现的。

### 格式(Formats)

OpenLayers中的Formats主要用于处理地理空间数据的读写和解析，它包含了多种格式支持，比如WKT（Well-Known Text）、GeoJSON、KML、GML等。这些格式类允许开发者在客户端将地图要素转换为特定格式的字符串或者从字符串反序列化为地图要素。

## 二、第三方插件

[官方地址](https://openlayers.org/3rd-party/)
