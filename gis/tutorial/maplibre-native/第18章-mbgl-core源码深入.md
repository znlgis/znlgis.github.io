---
layout: default
title: 第18章 - mbgl-core 源码深入
---

# 第18章 - mbgl-core 源码深入

> 本章标题沿用“mbgl-core”的习惯叫法，指 core C++ 库本身；main 分支的源码目录与命名空间已 rename 为 `src/mln` / `namespace mln`，正文以 mln 为主，并给出 mbgl → mln 的对照。

## 18.1 先看命名：`mbgl` 还是 `mln`

打开旧文章或旧代码，会看到 `include/mbgl`、`namespace mbgl`、`MBGL_*` 宏；当前 main 分支已经统一改名：

| 旧 | 当前 |
| --- | --- |
| `include/mbgl/...` | `include/mln/...` |
| `src/mbgl/...` | `src/mln/...` |
| `namespace mbgl` | `namespace mln` |
| `MBGL_WITH_*`（CMake 变量） | `MLN_WITH_*` |
| `MBGL_BUILDING_LIB` 等编译宏 | `MLN_*` 前缀（历史宏仍可见于个别条件编译） |

但**二进制目标名没有改**：`mbgl-core`、`mbgl-test-runner`、`mbgl-render-test-runner`、`mbgl-glfw`、`mbgl-render` 仍然是 `mbgl-` 前缀。所以搜索代码时两种前缀都要试：头文件用 `mln/`，构建产物用 `mbgl-`。

本章标题沿用章节文件名里的 “mbgl-core”，指的是同一份 core 库。下文路径一律以当前 `src/mln` 为准。

## 18.2 core 的分层

`src/mln` 下 20 多个目录可以按职责切成五层：

```text
平台绑定层（platform/ 下：android / ios / macos / node / qt / linux ...）
        │  只依赖 public include/mln 接口
        ▼
地图门面   map/      Map, Map::Impl, Transform, TransformState, MapProjection
        │
        ├──────────────┬─────────────────┬──────────────────┐
        ▼              ▼                 ▼                  ▼
样式与数据       渲染编排          瓦片生产            基础设施
style/           renderer/         tile/               actor/ util/ math/
parser, diff    orchestrator       TilePyramid         Scheduler Mailbox
                 RenderTree        TileCache           RunLoop  geometry
                 RenderLayer       GeometryTileWorker  gfx/ gl/ mtl/
        │
        ▼
后端抽象   gfx/  RendererBackend / Context / ShaderRegistry / Drawable
           gl/、mtl/、vulkan/、webgpu/ 四个具体实现
```

一个关键设计是 **`::Impl` 模式**：`Map` / `Style` / `Layer` / `Source` 这些公开类只是薄壳，真正的状态在对应的 `Impl` 里，且是 `Immutable<T>`（不可变共享引用）。改动样式时不是原地修改，而是"复制一份 Impl、改副本、冻结、换指针"。这样渲染线程拿到的永远是一份某个时刻的快照，不需要锁。

## 18.3 一帧的生命周期

入口在 `src/mln/map/map_impl.cpp` 的 `Map::Impl::onUpdate()`。它做三件事：

1. 按需更新相机过渡：`transform.updateTransitions(timePoint)`。
2. 组装 `UpdateParameters`——这是 core 里最重要的结构体，相当于"这一帧的输入快照"。字段覆盖了渲染需要的全部状态：

```cpp
UpdateParameters params = {.styleLoaded = style->impl->isLoaded(),
                           .mode = mode,
                           .pixelRatio = pixelRatio,
                           .timePoint = timePoint,
                           .transformState = transform.getState(),
                           .glyphURL = style->impl->getGlyphURL(),
                           .spriteLoaded = style->impl->areSpritesLoaded(),
                           .light = style->impl->getLight()->impl,
                           .images = style->impl->getImageImpls(),
                           .sources = style->impl->getSourceImpls(),
                           .layers = style->impl->getLayerImpls(),
                           .globalState = style->impl->getGlobalStateShared(),
                           .annotationManager = annotationManager.makeWeakPtr(),
                           .fileSource = fileSource,
                           .prefetchZoomDelta = prefetchZoomDelta,
                           .tileLodMode = tileLodMode};
```

3. 交给 `rendererFrontend.update(...)`。

注意 `if (mode != MapMode::Continuous && !stillImageRequest) return;`——静态模式下不会自己渲染，必须显式请求一帧。这解释了为什么离屏渲染使用 `MapMode::Static` 时要先设置相机再 `renderStill()`。

`Renderer::render()` 本身只有三行（`src/mln/renderer/renderer.cpp`）：

```cpp
if (auto renderTree = impl->orchestrator.createRenderTree(updateParameters, impl->dynamicTextureAtlas)) {
    renderTree->prepare();
    impl->render(*renderTree, updateParameters);
}
```

真正的复杂度都在 `createRenderTree()` 里。

## 18.4 RenderOrchestrator：diff 驱动的渲染树

`src/mln/renderer/render_orchestrator.cpp` 的 `createRenderTree()` 是整个 core 最核心的函数。它把"上一帧的渲染树"与"这一帧的 UpdateParameters 快照"做差，只重建变化部分。核心 diff 全部来自 `style_diff.hpp`：

| 函数 | 比较对象 | 用途 |
| --- | --- | --- |
| `diffLayers` | 旧/新 `Layer::Impl` 列表 | 增删图层、触发重布局 |
| `diffSources` | 旧/新 `Source::Impl` 列表 | 增删数据源 |
| `diffImages` | 旧/新 `Image::Impl` 列表 | 图片增删改，触发重布局 |
| `diffGlobalStateKeys` | 新旧 `GlobalStateMap` | 找出变化的 global-state 键 |

diff 能高效工作的前提就是 Impl 不可变：两个 `Immutable<T>` 指向同一对象说明没变，指针不同说明变了；集合本身是不可变集合时，指针相同就整批跳过。

由 diff 结果驱动的动作有三类：

- `layersAddedOrRemoved` 或样式属性变化 → 标记 `needsRelayout`，交给 TilePyramid 重新生成 bucket。
- 图片变化 → `hasImageDiff` 置位，同样触发重布局（图片参与 pattern 的图集打包）。
- 相机变化 → 只更新 `PaintParameters`，不重建几何。

渲染树的节点类型在 `src/mln/renderer/render_tree.hpp`：`RenderItem` 是抽象基类，`LayerRenderItem` 包装一个 `RenderLayer` 加它所属的 `RenderSource` 和绘制序号，`RenderTree` 把若干 `RenderItem` 按序排好，`prepare()` 之后由 `Renderer::impl->render()` 逐项 `upload()` + `render()`。

## 18.5 TilePyramid：瓦片金字塔的调度

`src/mln/renderer/tile_pyramid.cpp`（约 460 行）负责一个数据源的瓦片集合。核心是 `update()`，签名长达九个参数，但逻辑可以拆成四段：

```cpp
void TilePyramid::update(const std::vector<Immutable<style::LayerProperties>>& layers,
                         const bool needsRendering,
                         const bool needsRelayout,
                         const TileParameters& parameters,
                         const style::Source::Impl& sourceImpl,
                         const uint16_t tileSize,
                         const Range<uint8_t> zoomRange,
                         std::optional<LatLngBounds> bounds,
                         std::function<std::unique_ptr<Tile>(const OverscaledTileID&, TileObserver*)> createTile);
```

**第一段：清理。** `needsRelayout` 为真时直接 `cache.clear()`；不需要渲染时把所有在屏瓦片移入缓存（`TileNecessity::Optional`，抑制过期时的网络请求）或延迟释放，然后清空 `tiles`、`renderedTiles`。

**第二段：算要哪些瓦片。** 关键三步：

```cpp
int32_t overscaledZoom = util::coveringZoomLevel(zoom, type, tileSize);
int32_t idealZoom = std::min<int32_t>(zoomRange.max, overscaledZoom);
panTiles = util::tileCover(tileCoverParameters, panZoom, zoomRange);
idealTiles = util::tileCover(tileCoverParameters, idealZoom, zoomRange, tileZoom);
```

`coveringZoomLevel` 根据数据源类型（矢量/栅格/DEM/GeoJSON）和 `tileSize` 决定用哪一级瓦片；`tileCover` 根据当前 `TransformState`（含 pitch、bearing、fov）算出视锥覆盖的瓦片集合。开了 `prefetchZoomDelta` 时还会额外算 `panTiles`——低一级的瓦片，用来在高层瓦片到达前先垫一层。

**第三段：保留与创建。** 两个 lambda 分工明确：

- `retainTileFn`：把要用的瓦片记进 `retain` 集合，设置必要性与更新参数；重布局时顺便 `tile.setLayers(layers, parameters.globalState)`。
- `createTileFn`：先从缓存 `cache.pop(tileID)` 复用，没有再调外部注入的 `createTile` 工厂创建。这是 `TilePyramid` 与具体瓦片类型解耦的地方——矢量、栅格、DEM、自定义几何都走同一个金字塔，只是工厂不同。

**第四段：驱动。** 核心算法在 `src/mln/algorithm/update_renderables.hpp`，`updateRenderables()` 接收四个回调（get/create/retain/render），在"理想瓦片未就绪时用父/子瓦片顶替"的逻辑上做统一处理。这也是为什么地图加载过程中能看到低分辨率瓦片先出现再被替换。

缓存本身是 `src/mln/tile/tile_cache.cpp`：按 `OverscaledTileID` 索引，分 `tiles`（在屏）与 `cache`（离屏）两层，通过 `TileNecessity`（Required/Optional）区分优先级。

## 18.6 Transform 与 TransformState：相机

`src/mln/map/transform.cpp` 处理"相机动作"，`transform_state.hpp` 保存"相机状态"。

`Transform` 的公开方法就是 camera API：`jumpTo`（立即）、`easeTo`（线性过渡）、`flyTo`（先拉远再飞入）、`moveBy`、`rotateBy`、`setLatLngBounds`、`setMinZoom`/`setMaxZoom`、`setPitch` 等。它们最终都改 `TransformState`：

```cpp
class Transform : private util::noncopyable {
    TransformState state;
    TimePoint transitionStart;
    Duration transitionDuration;
    std::function<bool(const TimePoint)> transitionFrameFn;
    // ...
};
```

过渡不是每帧插值一个"目标值"，而是存一个 `transitionFrameFn`，每帧用当前时间求值。`easeTo` 与 `flyTo` 的区别只在插值函数上：`flyTo` 会构造一条"缩放先降后升"的曲线，所以视觉上有拉远再拉近的过程。

`TransformState` 里最容易被忽略的是 **constrain 与 viewport 模式**：`ConstrainMode`（是否允许视图越界）、`ViewportMode`（是否为宽视口调整中心）、`NorthOrientation`（允许把地图旋转 90° 用于车载/导航场景）。这些不是 UI 细节，而是直接影响 `tileCover` 结果的输入。

投影与坐标换算在 `src/mln/map/map_projection.cpp`；具体投影实现藏在 `util/geo.hpp` 与 `ProjectionMode` 里（Web Mercator / globe / 垂直透视等）。

## 18.7 Style：解析主链路

Style 的加载分两条路径，最终汇合到同一个解析器（`src/mln/style/style_impl.cpp` → `src/mln/style/parser.cpp`）：

```text
Style::loadURL(url)                 Style::loadJSON(json)
    │  FileSource 异步请求               │
    ▼                                  ▼
Impl::loadURL 回调拿到 JSON ──────▶ Parser::parse(json)
                                       ├─ parseTransition
                                       ├─ parseLight
                                       ├─ parseState        （global-state 默认值）
                                       ├─ parseSprites
                                       ├─ parseSources
                                       └─ parseLayers
                                            └─ parseLayer → 逐层构造 Layer + Layer::Impl
```

`Parser` 的成员就是解析结果：`sources`、`layers`、`sprites`、`glyphURL`、`fontFaces`、`transition`、`light`、`globalStateDefaults`，以及根级的 `name`/`latLng`/`zoom`/`bearing`/`pitch`/`roll`。返回类型是 `StyleParseResult = std::exception_ptr`——解析不抛异常，用 `exception_ptr` 回传错误。

一个细节：`parseLayers` 维护了 `layersMap` 和 `stack`（`std::forward_list<std::string>`），后者用于检测图层的 `ref` 引用环（Layer 可以引用另一个 Layer 的属性，成环会导致无限递归）。

解析完成后，Style 还要等异步资源：sprite、glyph、source 的元数据。`Style::isLoaded` 只表示 JSON 解析完成，不等待资源（这是 main 分支新增的语义，见 CHANGELOG）；真正的"可渲染"要等 `areSpritesLoaded()`、`styleLoaded` 等条件同时满足。

## 18.8 后端抽象：gfx 与四个实现

`src/mln/gfx/` 是与图形 API 无关的中间层：`Context`、`ShaderRegistry`、`Drawable`、`RenderPass`、纹理与 buffer 抽象。具体后端在 `gl/`、`mtl/`、`vulkan/`、`webgpu/` 四个目录，通过 `RendererBackend` 的纯虚函数接入：

```cpp
class RendererBackend {
public:
    virtual Renderable& getDefaultRenderable() = 0;
    virtual void initShaders(gfx::ShaderRegistry&, const ProgramParameters&) = 0;
protected:
    virtual std::unique_ptr<Context> createContext() = 0;
    virtual void activate() = 0;
    virtual void deactivate() = 0;
};
```

`getContext()` 用 `std::call_once` 延迟创建上下文，并 `assert(BackendScope::exists())` 强制"只能在 `BackendScope` 里访问上下文"。`activate/deactivate` 由 `BackendScope` 成对调用，覆盖两种场景：渲染一帧时、以及销毁 `Renderer` 释放 GPU 资源时。

这层设计的意义：core 的渲染逻辑（bucket → drawable → draw call）不感知后端，换 Metal/Vulkan/WebGPU 只需实现 `RendererBackend` + 一套 `ShaderRegistry` 与 shader 源码。

## 18.9 线程模型

core 不碰平台线程，只依赖 `Scheduler` 抽象（`src/mln/actor/scheduler.hpp`）：

| 调度器 | 语义 | 用途 |
| --- | --- | --- |
| `Scheduler::GetCurrent()` | 当前线程的调度器，通常是 `RunLoop` | 主线程/渲染线程 |
| `Scheduler::GetBackground()` | 共享线程池，任务可并行 | 瓦片解析、网络回调 |
| `Scheduler::GetSequenced()` | 单线程、任务顺序执行 | 需要串行化的对象 |

`RunLoop`（`include/mln/util/run_loop.hpp`）是默认实现：内部两个队列（`highPriorityQueue`/`defaultQueue`），`run()` 阻塞处理，`runOnce()` 单步。它提供 `setPlatformCallback`，让"没有完整 run loop 集成"的平台在任务入队时收到通知，自行决定何时调 `runOnce()`——Android 的 `GLThread`、iOS 的 GCD 就是这么接进来的。

Actor 层（`src/mln/actor/`）用 `Mailbox` + `ActorRef` 把"对象必须在自己线程上被调用"这件事变成类型约束：每个 actor 的消息排队串行执行。`GeometryTileWorker`、`RasterTileWorker`、`RenderSource` 都是 actor。

## 18.10 读源码的路线

面对 2000+ 文件，按"从入口往下"的顺序读效率最高：

```text
1. include/mln/map/map.hpp                 公开 API 面
2. src/mln/map/map_impl.cpp                onUpdate() → UpdateParameters
3. src/mln/renderer/renderer.cpp           render() 三行
4. src/mln/renderer/render_orchestrator.cpp  createRenderTree()：diff → 更新
5. src/mln/renderer/tile_pyramid.cpp       update()：tileCover → retain/create
6. src/mln/algorithm/update_renderables.hpp  父/子瓦片顶替算法
7. src/mln/style/parser.cpp                Style JSON → Impl 树
8. src/mln/map/transform.cpp               camera → TransformState
9. src/mln/gfx/renderer_backend.hpp        后端接入点
```

调试时常用的三个切入口：`UpdateParameters` 的字段（判断"这一帧为什么重绘"）、`diffLayers` 的结果（判断"哪个图层触发了重布局"）、`TilePyramid::getTiles()`（判断"该有的瓦片在不在"）。

## 18.11 排错

**编译报 `fatal error: 'mbgl/...' file not found`。** 代码还是旧命名。当前头文件统一是 `#include <mln/...>`，CMake 选项是 `MLN_WITH_*`；但目标名仍是 `mbgl-core`，两者不要混。

**改了样式属性但画面不更新。** 检查是否绕过了 `setXxx` 的 Impl 复制流程，直接改了被 `Immutable` 包裹的对象（编译期一般会被 `const` 拦住）；或者 `needsRelayout` 没被置位——diff 认为属性没变。

**瓦片一直不显示，日志里没有错误。** 看 `TilePyramid::isLoaded()` 与 `tileRange`：如果数据源设了 `bounds`，超出范围的瓦片在 `createTileFn` 里直接返回 `nullptr`，不会报错。

**`assert(BackendScope::exists())` 触发。** 在 `BackendScope` 之外调了 `getContext()`。所有 GPU 资源操作都要在 `BackendScope` 生命周期内。

**多线程下偶发崩溃。** 检查对象是否跨线程直接访问，而不是通过 `Scheduler`/actor 投递。core 的约定是"对象只在所属线程被调用"，违反它的代码在单测里可能通过，在真机上会随任务调度概率性失败。

**`Style::isLoaded()` 返回 true 但首帧空白。** 它只代表 JSON 解析完成。首帧还需要 sprite、glyph、source 元数据就绪，用 `MapObserver::onDidFinishLoadingStyle` 或 `onDidBecomeIdle` 判断更可靠。

## 18.12 本章小结

| 要点 | 结论 |
| --- | --- |
| 命名 | 头文件与命名空间是 `mln`，构建目标仍是 `mbgl-*`，CMake 选项是 `MLN_*` |
| 分层 | 平台绑定 → map 门面 → style/renderer/tile → gfx 后端抽象 |
| Impl 模式 | 公开类是壳，状态在不可变 `Impl` 里，靠换指针实现线程安全的样式变更 |
| 一帧输入 | `UpdateParameters`，由 `Map::Impl::onUpdate()` 组装 |
| 渲染树 | `RenderOrchestrator::createRenderTree()`，用 `diffLayers/diffSources/diffImages` 做增量更新 |
| 瓦片 | `TilePyramid::update()`：tileCover 算集合 → retain/create → `updateRenderables` 顶替 |
| 相机 | `Transform` 管动作与过渡，`TransformState` 是状态，含 constrain/viewport/projection 模式 |
| 样式 | `Parser::parse()` 产出 source/layer/sprite/glyph/light/globalState，引用环用 stack 检测 |
| 后端 | `RendererBackend` 四个纯虚函数，`BackendScope` 管上下文生命周期 |
| 线程 | `Scheduler` 三档 + `RunLoop` + actor/mailbox，core 不直接创建线程 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/第17章-测试CI与贡献流程/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-native/第19章-平台适配与移植指南/" class="chapter-nav__next">下一章 →</a>
</div>
