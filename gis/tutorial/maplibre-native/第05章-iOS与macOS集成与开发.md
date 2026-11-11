---
layout: default
title: 第05章 - iOS 与 macOS 集成与开发
---

# 第05章 - iOS 与 macOS 集成与开发

## 5.1 这一章解决什么问题

iOS 与 macOS 共享一个代码库（`platform/darwin`），但两端的视图层完全不同：iOS 用 UIKit 的 `MLNMapView`，macOS 用 AppKit 的 `MLNMapView`。共同点是都基于 Objective-C，Swift 通过桥接调用；都默认走 Metal 后端。

集成时最常踩的坑是类名前缀。网上大量教程还在用 `MGLMapView`、`import Mapbox`，那是 Mapbox 时代的写法，现在的正确前缀是 `MLN`（`platform/ios/src/MLNMapView.h`）。第二个坑是构建方式：main 分支已从"Bazel 生成 Xcode 工程"改为 CMake preset 直接产 Xcode 工程，老教程的命令跑不通。

本章按接入顺序讲：依赖引入、视图创建、代理、相机、样式与图层、macOS 差异、排错。

## 5.2 引入方式

iOS 有三种：

| 方式 | 场景 | 做法 |
| --- | --- | --- |
| Swift Package Manager | 推荐，Xcode 原生 | 添加 `https://github.com/maplibre/maplibre-gl-native-distribution` |
| CocoaPods | 已有 Podfile 的老项目 | `pod 'MapLibre'`（`platform/ios/MapLibre.podspec`） |
| 从源码构建 | 需要改核心 | `cmake --preset ios-metal -DDEVELOPMENT_TEAM_ID=...` |

SwiftPM 在 Xcode 里操作：File > Add Package Dependencies，粘贴 distribution 仓库 URL，选版本规则。接入后 `import MapLibre` 即可。

CocoaPods 的 podspec 里写的是 `s.platform = :ios`、`s.ios.deployment_target` 与 `s.vendored_frameworks = "MapLibre.xcframework"`，二进制从 GitHub Release 的 `MapLibre.dynamic.xcframework.zip` 下载。所以 `pod install` 需要能访问 GitHub。

从源码构建（main 分支）：

```bash
cmake --preset ios-metal -DDEVELOPMENT_TEAM_ID=YOUR_TEAM_ID
xed "build-ios/MapLibre Native.xcodeproj"
```

WebGPU 是实验路径，换 preset 即可：

```bash
cmake --preset ios-webgpu-dawn -DDEVELOPMENT_TEAM_ID=YOUR_TEAM_ID
cmake --preset ios-webgpu-wgpu -DDEVELOPMENT_TEAM_ID=YOUR_TEAM_ID
```

## 5.3 创建 MLNMapView

最短的 UIKit 接入：

```swift
import UIKit
import MapLibre

final class MapViewController: UIViewController, MLNMapViewDelegate {
    private var mapView: MLNMapView!

    override func viewDidLoad() {
        super.viewDidLoad()

        let styleURL = URL(string: "https://demotiles.maplibre.org/style.json")
        mapView = MLNMapView(frame: view.bounds, styleURL: styleURL)
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = self
        mapView.showsCompassView = true
        mapView.showsLogoView = false
        mapView.showsAttributionButton = true
        view.addSubview(mapView)
    }

    func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
        print("style loaded")
    }

    func mapView(_ mapView: MLNMapView, regionDidChangeAnimated animated: Bool) {
        print("center=\(mapView.centerCoordinate) zoom=\(mapView.zoomLevel)")
    }
}
```

关键属性（来自 `platform/ios/src/MLNMapView.h`）：

| 属性/方法 | 类型 | 说明 |
| --- | --- | --- |
| `styleURL` | `NSURL *` | 样式地址，`null_resettable` |
| `delegate` | `id<MLNMapViewDelegate>` | 弱引用，必须自己保活 controller |
| `centerCoordinate` | `CLLocationCoordinate2D` | 中心点 |
| `zoomLevel` | `double` | 缩放级别 |
| `minimumZoomLevel` / `maximumZoomLevel` | `double` | 缩放限制 |
| `showsCompassView` | `BOOL` | 指南针显示 |
| `showsLogoView` | `BOOL` | logo 显示（商用需保留） |
| `showsAttributionButton` | `BOOL` | 版权按钮 |
| `setCenterCoordinate:animated:` | 方法 | 带动画的中心点切换 |
| `setZoomLevel:animated:` | 方法 | 带动画的缩放 |
| `setCamera:animated:` | 方法 | 相机整体（含 pitch/bearing）切换 |

从 `MLNMapView.h` 的注释能读出两条约定：`delegate` 是 `weak`，所以 controller 持有 mapView、mapView 弱引用 delegate 是正确方向；`showsLogoView` 默认可见，MapLibre 的商标要求保留 logo，商业项目不要随手关掉。

## 5.4 SwiftUI 接入

SwiftUI 需要一层 `UIViewRepresentable`：

```swift
import SwiftUI
import MapLibre

struct MapView: UIViewRepresentable {
    func makeUIView(context: Context) -> MLNMapView {
        let styleURL = URL(string: "https://demotiles.maplibre.org/style.json")
        let mapView = MLNMapView(frame: .zero, styleURL: styleURL)
        mapView.setCenter(
            CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074),
            zoomLevel: 10,
            animated: false
        )
        return mapView
    }

    func updateUIView(_ uiView: MLNMapView, context: Context) {
        // 根据 SwiftUI 状态更新相机
    }
}

struct ContentView: View {
    var body: some View {
        MapView().ignoresSafeArea()
    }
}
```

`updateUIView` 每次 SwiftUI 状态变化都会调用，不要在里面无条件调 `setCenter`，否则地图会被反复重置。比较状态再更新。

## 5.5 相机与动画

`MLNMapView` 的相机模型与 GL JS 一致：center、zoom、bearing、pitch。常用组合：

```swift
// 飞到某点并设置俯仰角
let camera = MLNMapCamera(
    lookingAtCenter: CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737),
    altitude: 0,
    pitch: 45,
    heading: 0
)
mapView.setCamera(camera, animated: true)

// 限定缩放范围，避免请求不存在的瓦片
mapView.minimumZoomLevel = 2
mapView.maximumZoomLevel = 16
```

`minimumZoomLevel` / `maximumZoomLevel` 与自有瓦片层级配合使用。超过数据最大层级后，Native 会继续请求 z17、z18 的瓦片，服务端返回 404，日志刷屏且拖慢调度。

飞行路径的控制看几个属性：`MLNMapView` 有 `dynamicNavigationCameraAnimationDuration`（导航场景下按距离动态调整动画时长）、`userLocationCameraFollowsConstantZoomFly` 等。做导航类应用时才需要动它们。

## 5.6 样式与图层

样式加载完成后通过 `MLNStyle` 修改。`MLNStyle` 是 `MLNMapView` 的 `style` 属性（`didFinishLoading` 回调里拿到），提供 `addSource`、`addLayer`、`removeLayer`、`imageForName` 等系列方法，与 Android 的 `Style` 一一对应。

风格化的常见做法是加载远程样式再删改：

```swift
func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
    // 删掉不需要的图层
    let unwanted = ["poi-label", "transit-label"]
    for id in unwanted {
        if let layer = style.layer(withIdentifier: id) {
            style.removeLayer(layer)
        }
    }

    // 调整已有图层的 paint 属性
    if let water = style.layer(withIdentifier: "water") as? MLNFillStyleLayer {
        water.fillColor = UIColor.systemBlue.withAlphaComponent(0.6)
    }
}
```

图层操作必须在 `didFinishLoading` 之后做，与 Android 一样是异步时序问题。

### 5.6.1 用 MLNShapeSource 添加 GeoJSON

图层与数据源的 API 与 Android 对称：`MLNStyle` 提供 `addSource:`、`addLayer:`、`removeLayer:`、`sourceWithIdentifier:`、`layerWithIdentifier:`；数据源子类在 `platform/darwin/src/` 下，常用的有 `MLNShapeSource`（GeoJSON）、`MLNRasterTileSource`、`MLNRasterDEMSource`、`MLNImageSource`、`MLNComputedShapeSource`。

添加一条 GeoJSON 线：

```swift
func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
    // 1. 构造 GeoJSON 字典（也可以从本地文件或网络加载）
    let geojson: [String: Any] = [
        "type": "FeatureCollection",
        "features": [[
            "type": "Feature",
            "properties": ["name": "长安街"],
            "geometry": [
                "type": "LineString",
                "coordinates": [
                    [116.3800, 39.9087],
                    [116.4100, 39.9087]
                ]
            ]
        ]]
    ]

    // 2. 数据源
    guard let source = MLNShapeSource(
        identifier: "roads",
        shape: MLNShape(data: try! JSONSerialization.data(withJSONObject: geojson), encoding: nil),
        options: nil
    ) else { return }
    style.addSource(source)

    // 3. 图层
    let line = MLNLineStyleLayer(identifier: "roads-line", source: source)
    line.lineColor = NSExpression(forConstantValue: UIColor.systemOrange)
    line.lineWidth = NSExpression(forConstantValue: 4)
    style.addLayer(line)
}
```

三个容易出错的点：

- `MLNShapeSource` 的初始化返回可选值，初始化失败返回 nil（几何或数据格式有问题时）。
- `MLNLineStyleLayer` 的样式属性是 `NSExpression` 类型，不是裸值。用 `NSExpression(forConstantValue:)` 包一层，要按属性数据驱动则用 `NSExpression(forKeyPath:)` 或 `NSExpression(format:)`。
- 数据源与图层必须在 `didFinishLoading` 之后添加，否则样式对象还没就绪。

### 5.6.2 图层的插入顺序

`addLayer:` 把图层追加到最上层。要插到中间，先找到锚点图层再操作。`MLNStyle` 没有 `addLayer:below:` 这种便捷方法，实际做法是取出图层列表重排，或者用 `insertLayer:atIndex:`（存在时）配合 `style.layers` 的下标。

一个稳妥模式：拿到全部图层，找到第一个 `MLNSymbolStyleLayer`，把业务图层插到它前面的位置。这样标注始终在上，业务图形在下。

```swift
func addBusinessLayerBelowLabels(_ layer: MLNStyleLayer, style: MLNStyle) {
    let layers = style.layers
    if let firstSymbolIndex = layers.firstIndex(where: { $0 is MLNSymbolStyleLayer }) {
        style.insertLayer(layer, at: UInt(firstSymbolIndex))
    } else {
        style.addLayer(layer)
    }
}
```

### 5.6.3 Info.plist 与网络配置

iOS 对 http 明文请求默认拦截。接内部瓦片服务（http）时必须在 `Info.plist` 加例外：

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>tiles.internal.example.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

User-Agent 等请求头通过 `MLNNativeNetworkManager` 修改（`platform/ios` 的网络层封装）：

```swift
let config = MLNNativeNetworkManager.sharedManager.sessionConfiguration
config.httpAdditionalHeaders = ["X-App-Version": "1.2.3"]
```

这条在需要按 UA 做灰度或统计时是唯一入口，改 `URLSession` 全局配置对 Native 内部的请求无效——它用的是自己的 session。

### 5.6.4 Swift Package 版本策略

SwiftPM 引入 `maplibre-gl-native-distribution` 时，版本规则建议锁 `.upToNextMinor` 或精确版本。原因是 iOS SDK 的 minor 版本会带样式规范更新，CSS 属性与图层默认值可能变化，导致同一份样式在两个版本上渲染不同。

```swift
// Package.swift 中
.package(url: "https://github.com/maplibre/maplibre-gl-native-distribution",
         .upToNextMinor(from: "7.0.0"))
```

Xcode 界面里选"Up to Next Minor Version"即可。升级前用 render test 或截图对比验证。

## 5.7 macOS 差异

macOS 的 `MLNMapView` 在 `platform/macos`，是 `NSView` 子类而非 `UIView`，属性名基本一致，但有几个实际差异：

| 项 | iOS | macOS |
| --- | --- | --- |
| 基类 | `UIView` | `NSView` |
| 手势 | `UIGestureRecognizer` | `NSGestureRecognizer` |
| 侧栏控件 | 无 | 可选 `MLNMapView` 内建 zoom/compass 控件 |
| 发布节奏 | 独立 tag（`ios-v7.0.0`） | 随 iOS tag，无独立版本 |
| 官方支持等级 | 核心项目 | 次级（README 明说支持程度不及 iOS） |

macOS 开发构建：

```bash
cmake --preset macos-metal
cmake --build build-macos-metal
```

或生成 Xcode 工程：

```bash
cmake --preset macos-metal-xcode
xed "build-macos-metal-xcode/MapLibre Native.xcodeproj"
```

macOS 还提供 Vulkan preset（`macos-vulkan`、`macos-vulkan-xcode`），走 MoltenVK 路径，属于实验性质。

## 5.8 排错

**`No such module 'MapLibre'`**

SwiftPM 未解析完成，或项目里残留旧的 `Mapbox` 包。清理 DerivedData（`~/Library/Developer/Xcode/DerivedData`），重新解析包。

**`'MGLMapView' is unavailable`**

照抄了 Mapbox 时代的示例。改成 `MLNMapView`、`MLNStyle`、`MLNShapeSource`。

**样式不生效，`style` 为 nil**

`didFinishLoading` 之前访问 `mapView.style`。把逻辑移进回调。

**地图空白但无报错**

`styleURL` 为 nil，或者网络请求被 ATS 拦截。检查 Info.plist 的 `NSAppTransportSecurity`，内部服务的 http 地址需要例外。

**真机签名失败**

`cmake --preset ios-metal` 必须带 `-DDEVELOPMENT_TEAM_ID`。Xcode 里还要确认 Signing & Capabilities 的 Team 与 Bundle Identifier 匹配。

**编译报 Metal 相关符号缺失**

preset 选错，用了不带 `MLN_WITH_METAL` 的配置。iOS 生产必须用 `ios-metal`。

**模拟器跑着正常、真机崩溃**

架构差异。M 系列 Mac 模拟器是 arm64，老款 Intel Mac 模拟器是 x86_64；如果引入的 xcframework 缺少对应 slice，会链接失败或运行时崩。用官方 distribution 包可避免这个坑。

## 5.9 生产建议

- **用 SwiftPM + 官方 distribution 包**，不要自己编 xcframework。自带正确的 slice 与签名配置。
- **delegate 里不要做重活**：`regionDidChangeAnimated` 这类回调可能每帧触发。
- **logo 与 attribution 保留**：MapLibre 的商标与版权要求，商用项目按许可证处理。
- **锁 macOS 的预期**：官方支持等级低于 iOS，Bug 修复可能滞后，关键产品线不建议以 macOS 为主。
- **相机动画用 `setCamera:animated:` 而不是连续 `setCenter`**：前者由 native 做插值，后者每帧调用会与手势冲突。

## 5.10 本章小结

| 要点 | 事实 |
| --- | --- |
| 类名前缀 | `MLN`（`MLNMapView`、`MLNStyle`），不是 `MGL` |
| 引入方式 | SwiftPM（推荐）、CocoaPods、源码构建三条 |
| iOS 后端 | 默认 Metal（`ios-metal` preset） |
| 属性要点 | `delegate` 是 weak；`showsLogoView` 默认可见 |
| 样式时序 | 图层操作放在 `didFinishLoading` 回调 |
| macOS 差异 | `NSView` 基类、随 iOS 发版、官方支持次级 |
| 构建命令 | `cmake --preset ios-metal -DDEVELOPMENT_TEAM_ID=...` |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/第04章-Android集成与开发/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/第06章-渲染引擎与图形后端/" class="chapter-nav__next">下一章 →</a>
</div>
