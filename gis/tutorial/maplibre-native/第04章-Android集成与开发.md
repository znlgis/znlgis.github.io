---
layout: default
title: 第04章 - Android 集成与开发
---

# 第04章 - Android 集成与开发

## 4.1 这一章解决什么问题

Android 端集成 MapLibre Native 的难点不在 API 调用，而在三处：生命周期回调必须手动转发、`MapLibre` 单例必须先初始化、样式与图层操作全部发生在 native 的渲染线程上（你在 UI 线程调用的是代理）。任何一处没处理好，表现都是"地图不出图"或"偶发崩溃"，而不是明确的异常。

这一章按一次真实接入的顺序走：初始化、布局、生命周期、样式、图层、相机、手势、查询，最后是 Android 特有的坑。

## 4.2 初始化的顺序约束

入口类是 `org.maplibre.android.MapLibre`，它有三个重载：

```java
public static synchronized MapLibre getInstance(Context context)
public static synchronized MapLibre getInstance(Context context, String apiKey, WellKnownTileServer tileServer)
public static synchronized MapLibre getInstance(Context context, String apiKey, WellKnownTileServer tileServer, /* ... */)
```

必须在 `MapView` 创建之前调用。它做三件事：加载 native 库、创建全局 `FileSource`（网络与缓存）、初始化 tile server 配置。

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // 1. 必须先初始化，否则 getMapAsync 不会回调
    MapLibre.getInstance(this)

    // 2. 再设置内容视图
    setContentView(R.layout.activity_main)

    // 3. 拿到 MapView
    mapView = findViewById(R.id.mapView)
    mapView.onCreate(savedInstanceState)
    mapView.getMapAsync { map ->
        map.setStyle("https://demotiles.maplibre.org/style.json") { style ->
            // 样式加载完成，可以安全地加图层
        }
    }
}
```

注意 `mapView.onCreate(savedInstanceState)`：`MapView` 需要这个调用来恢复相机位置与内部状态，`Activity` 的 `onCreate` 里必须转发。

## 4.3 MapView 生命周期

`MapView` 的生命周期方法是成对的，全部要转发。漏掉任一对应的回调，常见后果如表：

| 方法 | 必须在哪里调用 | 漏掉的后果 |
| --- | --- | --- |
| `onCreate(Bundle)` | `Activity.onCreate` | 相机位置丢失、内部状态未初始化 |
| `onStart()` | `Activity.onStart` | 渲染循环不启动，白屏 |
| `onResume()` | `Activity.onResume` | 地图暂停后就再也不更新 |
| `onPause()` | `Activity.onPause` | 后台仍占 GPU，耗电 |
| `onStop()` | `Activity.onStop` | 渲染线程不回收 |
| `onDestroy()` | `Activity.onDestroy` | native 内存泄漏 |
| `onSaveInstanceState(Bundle)` | `Activity.onSaveInstanceState` | 旋转屏幕后地图回到初始位置 |
| `onLowMemory()` | `Activity.onLowMemory` | 内存紧张时不释放瓦片缓存 |

完整模板：

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var mapView: MapView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapLibre.getInstance(this)
        setContentView(R.layout.activity_main)
        mapView = findViewById(R.id.mapView)
        mapView.onCreate(savedInstanceState)
        mapView.getMapAsync { map ->
            map.setStyle("https://demotiles.maplibre.org/style.json")
        }
    }

    override fun onStart() { super.onStart(); mapView.onStart() }
    override fun onResume() { super.onResume(); mapView.onResume() }
    override fun onPause() { super.onPause(); mapView.onPause() }
    override fun onStop() { super.onStop(); mapView.onStop() }
    override fun onDestroy() { super.onDestroy(); mapView.onDestroy() }
    override fun onLowMemory() { super.onLowMemory(); mapView.onLowMemory() }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        mapView.onSaveInstanceState(outState)
    }
}
```

用 `MapFragment` 时反而简单：Fragment 内部会自动转发，不需要手动写这堆方法。新项目优先用 `MapFragment`。

## 4.4 样式：setStyle 与 Style.Builder

`MapLibreMap` 有三个 `setStyle` 重载：

```java
public void setStyle(String style)                                   // 不等待加载完成
public void setStyle(String style, Style.OnStyleLoaded callback)     // 等加载完成后回调
public void setStyle(Style.Builder builder, Style.OnStyleLoaded callback)
```

只用第一个重载是典型错误：`setStyle` 是异步的，紧接着调 `getStyle()` 会得到 null 或空样式。所有图层与数据源操作都必须放进回调：

```kotlin
map.setStyle("https://demotiles.maplibre.org/style.json") { style ->
    style.addSource(
        GeoJsonSource("markers", FeatureCollection.fromFeatures(emptyList()))
    )
    style.addLayer(
        SymbolLayer("marker-layer", "markers")
            .withProperties(
                PropertyFactory.iconImage("marker-icon"),
                PropertyFactory.iconAllowOverlap(true)
            )
    )
}
```

从字符串直接构造样式（离线或内置 JSON）：

```kotlin
val styleJson = """
{
  "version": 8,
  "sources": {},
  "layers": [
    { "id": "background", "type": "background",
      "paint": { "background-color": "#f2efe9" } }
  ]
}
""".trimIndent()

map.setStyle(Style.Builder().fromJson(styleJson)) { style ->
    Log.d("Map", "custom style ready, layers = ${style.layers.size}")
}
```

`Style`（`org.maplibre.android.maps.Style`）提供的图层操作：

| 方法 | 作用 |
| --- | --- |
| `addSource(Source)` | 添加数据源 |
| `getSourceAs<T>(String)` | 按 ID 取数据源并转型 |
| `addLayer(Layer)` | 追加图层到最上层 |
| `addLayerBelow(Layer, String)` | 插到指定图层下方 |
| `addLayerAbove(Layer, String)` | 插到指定图层上方 |
| `addLayerAt(Layer, int)` | 按索引插入 |
| `getLayerAs<T>(String)` | 取图层并转型 |
| `removeLayer(String)` | 删除图层 |
| `addImage(String, Bitmap)` | 注册 sprite 图片 |
| `addImage(String, Bitmap, boolean sdf)` | 注册 SDF 图标，用于 `icon-color` 染色 |

`addLayerBelow/Above` 在接入已有样式的图层树时是必需的。直接用 `addLayer` 会把图层压在最上面，挡住标注——这是"我的线遮住了地名"这类问题的常见原因。

## 4.5 相机控制

`MapLibreMap` 的相机 API 分两组：瞬时跳转与动画。

```kotlin
// 瞬时跳转
map.cameraPosition = CameraPosition.Builder()
    .target(LatLng(39.9042, 116.4074))
    .zoom(10.0)
    .bearing(0.0)
    .tilt(0.0)
    .build()

// 动画到目标（默认动画时长由 MapLibreConstants.ANIMATION_DURATION 决定）
map.animateCamera(
    CameraUpdateFactory.newLatLngZoom(LatLng(31.2304, 121.4737), 12.0),
    1500,
    object : MapLibreMap.CancelableCallback {
        override fun onFinish() { Log.d("Map", "camera arrived") }
        override fun onCancel() { Log.d("Map", "camera cancelled") }
    }
)
```

几个约束值直接写在 `MapLibreConstants` 里，可用 API 调整：

| 设置 | API | 说明 |
| --- | --- | --- |
| 最小缩放 | `setMinZoomPreference(float)` | 小于该值不再缩 |
| 最大缩放 | `setMaxZoomPreference(float)` | 常用于限制在自己的瓦片层级范围 |
| 相机移动监听 | `addOnCameraMoveListener(OnCameraMoveListener)` | 每帧相机变化回调 |
| UI 控件 | `getUiSettings()` | 指南针、logo、attribution 开关 |

`setMinZoomPreference`/`setMaxZoomPreference` 是防护手段。用自己的瓦片集时，超出数据范围的缩放会请求不存在的瓦片，服务端 404 刷满日志。把 max zoom 限制在数据最大层级上更稳。

## 4.6 手势与交互

Android 的手势由 `GesturesManager` 体系处理，可以从 `MapLibreMap` 拿到并逐项开关。常用操作：

```kotlin
val ui = map.uiSettings
ui.isCompassEnabled = false
ui.isLogoEnabled = false
ui.isAttributionEnabled = true

// 关掉某类手势（例如让地图只读）
map.uiSettings.setAllGesturesEnabled(false)
```

`setAllGesturesEnabled(false)` 是"只读地图"最省事的做法，适合大屏看板。需要精细控制时，用 `getGesturesManager()` 拿到各手势识别器逐个设置阈值。

一个真实现象：上一行代码里的地图是只读的，但子 View（比如浮在上面的按钮）仍然响应——这是因为手势被地图消费之前已经在 View 层判定了。需要在父容器上做事件拦截，而不是只关掉地图手势。

## 4.7 查询与注解

运行时查询用于点击拾取：

```kotlin
map.addOnMapClickListener { latLng ->
    Log.d("Map", "tapped at ${'$'}{latLng.latitude}, ${'$'}{latLng.longitude}")
    true
}
```

`onMapClick` 返回 `true` 表示事件已消费。返回 `false` 时事件会继续向下传，可能触发别的监听器。

注解（Marker、Polyline、Polygon）是 Android 特有的一层封装，位于 `org.maplibre.android.annotations`。它比 Style 图层简单，适合少量交互元素；上百个以上就应该改用 GeoJSON source + layer，因为注解每个都会创建独立的 native 对象。

## 4.8 排错：Android 侧的高频问题

**白屏，没有异常**

按顺序排查：`MapLibre.getInstance` 是否调用、`mapView.onStart()` 是否转发、`setStyle` 是否在 `getMapAsync` 回调里调用。三者缺一都会白屏。

**`java.lang.IllegalStateException: MapLibreMap is not ready`**

在 `getMapAsync` 回调之前调用了地图方法。把逻辑移进回调，或用 `addOnMapReadyCallback` 排队。

**`setStyle` 后立刻 `getStyle()` 得到 null**

`setStyle` 异步。必须用带 `Style.OnStyleLoaded` 的重载。

**图层挡住了标注**

用了 `addLayer` 而不是 `addLayerBelow`。把业务图层插到 `water`、`road-label` 之类的锚点图层下方。

**旋转屏幕后地图重置**

`onSaveInstanceState` 没转发给 `MapView`。

**native 崩溃日志里出现 `libmaplibre.so`**

先看是不是跨线程调用地图 API。`MapLibre` 的 API 只能在主线程调用，在协程的 IO 调度器里直接调会崩。

**MapTiler 底图 401 / 403**

`MapLibre.getInstance(context, apiKey, WellKnownTileServer.MapTiler)` 需要有效 key。测试可以直接用 `https://demotiles.maplibre.org/style.json`，无需 key。

## 4.9 生产建议

- **优先用 `MapFragment`**：自动处理生命周期，减少一整个类别的 bug。
- **图层操作统一收敛到样式回调**：所有 `addLayer`/`addSource` 放进 `OnStyleLoaded`，避免异步竞态。
- **限制缩放范围**：用 `setMinZoomPreference`/`setMaxZoomPreference` 贴合自有瓦片层级，减少无效请求。
- **大数量要素用 GeoJSON source，不用注解**：注解是逐对象封装，上百个后内存与帧率都明显劣化。
- **R8/ProGuard 保留 native 回调类**：JNI 通过反射调用 `NativeMap` 等类，混淆会导致运行时找不到方法。官方 SDK 自带 consumer rules，自己写 JNI 类时要补 `-keep` 规则。

## 4.10 本章小结

| 要点 | 事实 |
| --- | --- |
| 入口初始化 | `MapLibre.getInstance(context)` 必须在 `MapView` 之前 |
| 包名 | `org.maplibre.android`，Style 在 `org.maplibre.android.maps.Style` |
| 样式异步 | 必须用 `setStyle(String, Style.OnStyleLoaded)` |
| 图层插入 | `addLayerBelow/Above/At` 控制绘制顺序 |
| 生命周期 | 8 个方法逐一转发；`MapFragment` 可自动处理 |
| 相机 | `cameraPosition` 瞬时、`animateCamera` 动画带 `CancelableCallback` |
| 只读地图 | `uiSettings.setAllGesturesEnabled(false)` |
| 注解 vs 图层 | 少量交互用注解，大量要素用 GeoJSON source |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/第03章-构建系统与环境搭建/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/第05章-iOS与macOS集成与开发/" class="chapter-nav__next">下一章 →</a>
</div>
