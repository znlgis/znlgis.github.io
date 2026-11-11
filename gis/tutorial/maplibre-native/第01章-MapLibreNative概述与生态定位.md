---
layout: default
title: 第01章 - MapLibre Native 概述与生态定位
---

# 第01章 - MapLibre Native 概述与生态定位

## 1.1 这一章解决什么问题

想在移动端或桌面端脱离 WebView 跑矢量地图，MapLibre Native 是少数可选项之一。它把同一套 Style Spec 用 C++ 实现了一遍：渲染交给 GPU，瓦片解析放进工作线程，平台壳只负责窗口、手势和把帧画到 surface 上。代价是要处理 NDK、Xcode、CMake/Bazel 这几条构建链。

理解它之前必须先分清三件极易混淆的事：

1. **命名空间与目录**：本教程基于上游 main 分支，命名空间是 `mln`、头文件路径是 `include/mln/...`。2025 年上游做了整体重命名，此前是 `mbgl`。网上大量资料仍写 `#include <mbgl/...>`，属于旧版写法。
2. **发布方式**：上游没有统一的 `5.4.0` tag。各平台分别打 tag 发版（`android-v13.5.4`、`ios-v7.0.0`、`node-v6.4.1`、`qt-v2.0.1`），而根目录 `package.json` 里的 `version` 字段显示 `5.4.0`——那只是 npm wrapper 的版本号，不能当成核心库版本。
3. **后端**：渲染后端是编译期单选，不是运行时开关。CMake 会强制你恰好选一个（OpenGL / Metal / Vulkan / WebGPU）。

本章把这三件事说清楚，并给出选型判断与最小可跑路径。

## 1.2 从 Mapbox GL Native 分叉而来

MapLibre Native 是 2020 年 12 月 Mapbox 更改许可证之前 mapbox-gl-native 的社区分叉。`FORK.md` 记录三条来源：

- 核心 C++ 来自 mapbox-gl-native 的 `d60fd30`（mbgl 1.6.0）
- iOS/macOS SDK 来自 mapbox-gl-native-ios 的 `a139216`
- Android SDK 来自 mapbox-gl-native-android 的 `4c12fb2c`

三个项目后来合并进 `platform/`，形成"一个仓库、多套原生壳"的单仓结构。许可证是 BSD 2-Clause，核心另有一份 `LICENSES.core.md`。FORK.md 里有一条对商业项目约束很强的规定：不允许从非自由许可的 Mapbox 项目回移代码。这意味着 Mapbox 新出的特性不能直接搬，只能等社区独立实现。

## 1.3 mbgl 到 mln：一次整体重命名

这是读上游代码最先撞上的坑。上游用两个 PR 把核心命名空间和目录整体改掉：

| 项目 | 旧（`mbgl`） | 新（`mln`） |
| --- | --- | --- |
| 公共头目录 | `include/mbgl/` | `include/mln/` |
| 实现目录 | `src/mbgl/` | `src/mln/` |
| 命名空间 | `namespace mbgl` | `namespace mln` |
| include 写法 | `#include <mbgl/map/map.hpp>` | `#include <mln/map/map.hpp>` |
| 类名限定 | `mbgl::Map`、`mbgl::style::Style` | `mln::Map`、`mln::style::Style` |

对应提交是 PR #4487（`core: rename mbgl namespace to mln`）与 PR #4511（`core: rename mbgl directories to mln`）。因此看到下面这种 include 时，不要以为是笔误：

```cpp
#include <mln/map/map.hpp>
#include <mln/style/style.hpp>
#include <mln/renderer/renderer.hpp>

namespace {
mln::Map* gMap = nullptr;
}
```

迁移已有代码时，机械替换通常够用，但有三类地方会漏：

```cpp
// 旧
#include <mbgl/util/run_loop.hpp>
mbgl::util::RunLoop loop;
// 新
#include <mln/util/run_loop.hpp>
mln::util::RunLoop loop;

// 旧：宏以 MBGL_ 开头
// MLN_RENDER_BACKEND_OPENGL=1   ← 5.4.0 时期 CMake 里还混用 MBGL_WITH_METAL
// 新：统一 MLN_ 前缀
// MLN_RENDER_BACKEND_OPENGL=1 / MLN_WITH_METAL=ON

// 旧：iOS 类名是 MGLMapView（Mapbox 时代）
// 新：MLNMapView
```

平台层的变化更微妙。iOS 的 Objective-C 类在 5.x 时期就已经是 `MLN` 前缀（`platform/ios/src/MLNMapView.h`），但部分 README 示例里还残留 `MGLMapView`、`import Mapbox` 这类旧文案，照抄会编译失败。以 `platform/ios/src/` 下的头文件为准。

## 1.4 平台矩阵与发布 tag

仓库 `README.md` 把平台分成两档，并明确哪些是 MapLibre 核心项目：

| 平台 | 目录 | 分级 | 当前发布 tag 示例 |
| --- | --- | --- | --- |
| Android | `platform/android` | ⭐️ 核心 | `android-v13.5.4`（2026-11-09） |
| iOS | `platform/ios` | ⭐️ 核心 | `ios-v7.0.0`（2026-10-28） |
| macOS | `platform/macos` | 次级 | 随 iOS tag 走，无独立发布节奏 |
| Linux | `platform/linux` | 次级 | 随源码 tag，`mbgl-render` 等工具 |
| Windows | `platform/windows` | 次级 | 随源码 tag |
| Node.js | `platform/node` | 次级 | `node-v6.4.1` |
| Qt | `platform/qt` | 已迁出 | `qt-v2.0.1`（独立仓库 maplibre-native-qt） |
| HarmonyOS | `platform/ohos` | 新增 | 随 main，CMakePresets 有 `harmonyos` 组 |
| GLFW | `platform/glfw` | 开发用 | 桌面调试程序 `mbgl-glfw` |
| 共享代码 | `platform/darwin`、`platform/default` | — | 苹果共享层、跨平台默认实现 |

这张表有两个判断点。第一，Qt 绑定已不在本仓库，讲 `platform/qt` 的旧文章照做会失败。第二，macOS 官方支持弱于 iOS，`platform/macos/README.md` 明说支持程度不及 iOS，产品以 macOS 为主时要自己承担构建与回归成本。

关于版本号，还有一个容易误读的地方：`platform/android/VERSION` 当前是 `13.7.1`，`platform/ios/VERSION` 是 `7.0.0`，两者与根目录 `package.json` 的 `5.4.0` 不同步。这三个数字分属三套发布物，任何"本项目使用 MapLibre Native X.Y.Z"的表述都必须说明指的是哪一套。

## 1.5 渲染后端：编译期单选

这是 main 分支与旧版本差别最大的地方。旧版有一堆开关可以同时开，现在 `cmake/validate-backend-options.cmake` 会强制收敛：

```cmake
if (MLN_LEGACY_RENDERER)
  message(FATAL "The legacy renderer is no longer supported")
endif()

if (MLN_DRAWABLE_RENDERER)
  message(FATAL "Do not pass MLN_DRAWABLE_RENDERER, the drawable renderer is now the default")
endif()
```

也就是说，`MLN_LEGACY_RENDERER` 和 `MLN_DRAWABLE_RENDERER` 这两个老开关现在传了会直接报错退不出配置。drawable 管线已是唯一实现。

后端选择同样被强制：`MLN_WITH_OPENGL`、`MLN_WITH_METAL`、`MLN_WITH_VULKAN`、`MLN_WITH_WEBGPU` 之中必须恰好选一个，否则 CMake 直接 `FATAL_ERROR`。

| 后端 | CMake 开关 | 典型平台 | 实现目录 |
| --- | --- | --- | --- |
| OpenGL / OpenGL ES | `MLN_WITH_OPENGL` | Android、Linux、Windows | `src/mln/gl/` |
| Metal | `MLN_WITH_METAL` | iOS、macOS | `src/mln/mtl/` |
| Vulkan | `MLN_WITH_VULKAN` | Linux、Windows、Android（实验） | `src/mln/vulkan/` |
| WebGPU | `MLN_WITH_WEBGPU` | 跨平台实验，Dawn 或 wgpu-native 两种实现 | `src/mln/webgpu/` |

四个目录在 main 里都是真实存在的。WebGPU 还需要额外选实现：`MLN_WEBGPU_IMPL_DAWN` 或 `MLN_WEBGPU_IMPL_WGPU`，它们对应 `CMakePresets.json` 里 `*-webgpu-dawn` 与 `*-webgpu-wgpu` 两组 preset。

## 1.6 CMakePresets：别手写长命令

main 分支提供 `CMakePresets.json`，覆盖 iOS、macOS、Linux、Windows、HarmonyOS、Android 的组合。常用的几组：

| preset | 平台 | 后端 | 二进制目录 |
| --- | --- | --- | --- |
| `linux-opengl` | Linux | OpenGL | `build-linux-opengl` |
| `linux-vulkan` | Linux | Vulkan | `build-linux-vulkan` |
| `linux-webgpu-dawn` | Linux | WebGPU（Dawn） | `build-linux-webgpu-dawn` |
| `ios-metal` | iOS | Metal | `build-ios` |
| `macos-metal` | macOS | Metal | `build-macos-metal` |
| `windows-opengl` | Windows | OpenGL | 对应目录 |

用法是标准 CMake preset 流程：

```bash
cmake --preset linux-opengl
cmake --build --preset linux-opengl
```

`CMakePresets.json` 里 `linux-vulkan` 还额外设了 `MLN_WITH_WAYLAND=OFF`、`MLN_WITH_X11=ON`，说明 Vulkan 后端在 Linux 上依赖 X11 的窗口系统集成。手写 CMake 命令时这些变量容易漏，用 preset 更稳。

## 1.7 最小可跑示例

### 1.7.1 Linux：用 preset 编出 `mbgl-render`

```bash
git clone --recurse-submodules -j8 https://github.com/maplibre/maplibre-native.git
cd maplibre-native

cmake --preset linux-opengl
cmake --build --preset linux-opengl --target mbgl-render

./build-linux-opengl/bin/mbgl-render \
  --style https://demotiles.maplibre.org/style.json \
  --output out.png
```

无显示器的机器会报 `Error: Failed to open X display.`，套 `xvfb-run -a` 即可：

```bash
xvfb-run -a ./build-linux-opengl/bin/mbgl-render \
  --style https://demotiles.maplibre.org/style.json --output out.png
```

或者干脆用软件渲染后端（WebGPU 的 headless 实现、或 `MLN_WITH_OSMESA` 距离最近的老办法）在 CI 里出图。

### 1.7.2 Android：Gradle 依赖 + MapView

应用侧只需一条依赖，坐标是 `org.maplibre.gl:android-sdk`：

```gradle
dependencies {
    implementation 'org.maplibre.gl:android-sdk:13.5.4'
}
```

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var mapView: MapView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapLibre.getInstance(this)        // 必须在 MapView 之前
        setContentView(R.layout.activity_main)
        mapView = findViewById(R.id.mapView)
        mapView.getMapAsync { map ->
            map.setStyle("https://demotiles.maplibre.org/style.json")
        }
    }

    override fun onStart() { super.onStart(); mapView.onStart() }
    override fun onResume() { super.onResume(); mapView.onResume() }
    override fun onPause() { super.onPause(); mapView.onPause() }
    override fun onStop() { super.onStop(); mapView.onStop() }
    override fun onDestroy() { super.onDestroy(); mapView.onDestroy() }
}
```

`MapLibre.getInstance(this)` 负责加载 native 库并设置网络配置。漏掉它的典型表现是 `getMapAsync` 不回调。

### 1.7.3 iOS：MLNMapView + Metal

iOS 端默认后端是 Metal（`platform/ios/README.md` 原话 "Uses Metal for real-time rendering"）。通过 SwiftPM 引入 `maplibre/maplibre-gl-native-distribution`：

```swift
import UIKit
import MapLibre

class MapViewController: UIViewController, MLNMapViewDelegate {
    var mapView: MLNMapView!

    override func viewDidLoad() {
        super.viewDidLoad()
        let styleURL = URL(string: "https://demotiles.maplibre.org/style.json")
        mapView = MLNMapView(frame: view.bounds, styleURL: styleURL)
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = self
        view.addSubview(mapView)
    }

    func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
        print("style loaded, layers: \(style.layers.count)")
    }
}
```

### 1.7.4 Node：服务端出图

```bash
npm install @maplibre/maplibre-gl-native
```

```js
const mbgl = require('@maplibre/maplibre-gl-native');
const fs = require('fs');

const map = new mbgl.Map({
  request: (req, callback) => {
    // Node 版不内置网络与文件读取，必须自己实现
    if (req.url.startsWith('http')) {
      fetch(req.url).then(r => r.arrayBuffer()).then(buf => {
        callback(null, { data: Buffer.from(buf) });
      }).catch(e => callback(e));
    } else {
      callback(null, { data: fs.readFileSync(req.url) });
    }
  },
});

map.load(require('./style.json'));
map.render({ width: 512, height: 512, zoom: 2 }, (err, buffer) => {
  if (err) throw err;
  fs.writeFileSync('out.png', buffer);
  map.release();
});
```

Node 包声明支持的平台是 Ubuntu 24.04（amd64/arm64）、macOS（amd64/arm64）、Windows（amd64/arm64），Node 版本 22/24/26，安装时下载预编译二进制。

## 1.8 版本与依赖速查

| 项 | main 分支的值 | 依据 |
| --- | --- | --- |
| C++ 标准 | C++20 | `CMakeLists.txt` 的 `CMAKE_CXX_STANDARD` |
| CMake 最低版本 | 3.25 | `CMakeLists.txt` 第 1 行 |
| Bazel 版本 | 8.6.0 | `.bazelversion` |
| 命名空间 | `mln` | `include/mln/map/map.hpp` |
| Android minSdk | 23 | `MapLibreAndroid/build.gradle.kts` |
| Android NDK | 28.2.13676358 | `platform/android/buildSrc/.../Versions.kt` |
| Android VERSION | 13.7.1 | `platform/android/VERSION` |
| iOS VERSION | 7.0.0 | `platform/ios/VERSION` |
| npm wrapper version | 5.4.0 | 根 `package.json` |
| 许可证 | BSD 2-Clause | `LICENSE.md` |

## 1.9 选型判断

按下面三条走，任一条为"是"就该认真评估 Native：

1. **需要连续手势不掉帧**：渲染在 GPU，瓦片解析在工作线程；WebView 方案这些工作压在主线程。
2. **需要离线包与自定义数据源**：核心自带 `DatabaseFileSource`（SQLite）、`MBTilesFileSource`、`PMTilesFileSource`（`MLN_WITH_PMTILES` 默认 ON）。
3. **需要与原生 UI 深度融合**：地图上叠原生控件、与系统手势共存，WebView 做不到。

不该选 Native 的场景：一次性数据可视化、交互很少；团队没有 NDK/Xcode 构建经验；需要频繁热更新地图逻辑。

## 1.10 排错：三个真实错误

**`The legacy renderer is no longer supported`**

CMake 配置阶段直接 FATAL。原因是从旧脚本复制了 `-DMLN_LEGACY_RENDERER=ON`。删掉该参数即可，drawable 已是唯一实现。

**`You need to set a rendering backend` / `Multiple rendering backends selected`**

`validate-backend-options.cmake` 强制恰好选一个后端。前者是四个 `MLN_WITH_*` 全没开（注意 main 里 `MLN_WITH_OPENGL` 默认是 OFF），后者是同时开了两个。用 `CMakePresets.json` 的 preset 不会踩这个坑。

**`Failed to open X display.`**

无头环境跑 `mbgl-render`。OpenGL 上下文需要 X display，套 `xvfb-run -a` 或改用 headless 后端。

## 1.11 生产建议

- **绑定发布 tag，不要绑 main**：上游 main 变化快，重命名这种破坏性改动随时可能再来一次。生产用 `android-v*`、`ios-v*`、`node-v*` 的具体 tag。
- **后端按平台固定**：Android 走 OpenGL ES、iOS/macOS 走 Metal、Linux 桌面按需选 OpenGL 或 Vulkan。WebGPU 目前仍是实验路径，不要放进关键链路。
- **CI 里保留 render test**：`mbgl-render-test-runner` 输出 HTML 报告与 `diff.png`，样式改动的像素回归能定位到用例名。
- **ARCHITECTURE.md 只信架构部分**：线程模型、Immutability 仍然准确；构建章节仍在讲 make/gyp/mason，早就不适用。

## 1.12 本章小结

| 要点 | 具体事实 |
| --- | --- |
| 命名空间 | main 为 `mln`；旧版为 `mbgl`（PR #4487 改命名空间、#4511 改目录） |
| 发布方式 | 按平台打 tag：`android-v13.5.4`、`ios-v7.0.0`、`node-v6.4.1`、`qt-v2.0.1` |
| npm 版本 | 根 `package.json` 的 `5.4.0` 只是 wrapper 版本 |
| 后端 | 编译期单选：OpenGL / Metal / Vulkan / WebGPU，由 `validate-backend-options.cmake` 强制 |
| 老开关 | `MLN_LEGACY_RENDERER`、`MLN_DRAWABLE_RENDERER` 传入即 FATAL |
| 构建 | CMake 3.25+ / C++20 / Bazel 8.6.0 / `CMakePresets.json` |
| 平台分级 | Android、iOS 为核心项目；macOS、Linux、Windows、Node 为次级 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/第02章-架构总览与模块划分/" class="chapter-nav__next">下一章 →</a>
</div>
