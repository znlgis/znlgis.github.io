---
layout: default
title: 第04章 - Map 对象与地图生命周期
---

# 第04章 - Map 对象与地图生命周期

## 4.1 构造函数做了什么

`new Map(options)` 不是简单赋值，它在构造函数里按固定顺序搭起整套子系统。顺序错了会直接报错，理解它能省掉一半初始化问题。源码在 `src/ui/map.ts`，关键步骤如下：

```text
new Map(options)
 ├─ 1. 合并默认值 resolvedOptions = {...defaultOptions, ...options}
 │     canvasContextAttributes 做浅合并（用户值覆盖默认值）
 ├─ 2. 校验参数：minZoom ≤ maxZoom，minPitch ≤ maxPitch，
 │     minPitch ≥ 0，maxPitch ≤ 180 —— 不满足直接 throw
 ├─ 3. 创建 renderLoop（requestRenderFrame / cancelRenderFrame）
 ├─ 4. 创建 Camera，把 min/maxZoom、min/maxPitch、bearingSnap、
 │     zoomSnap、renderWorldCopies、centerClampedToGround 传进去
 ├─ 5. 解析容器 container → 建 canvasContainer / canvas / controlContainer
 │     四个控件角位 div（top-left / top-right / bottom-left / bottom-right）
 ├─ 6. createMapHandlers：boxZoom、dragPan、dragRotate、scrollZoom、
 │     keyboard、doubleClickZoom、touchZoomRotate、touchPitch、cooperativeGestures
 ├─ 7. 建 HandlerManager，把 DOM 事件接到 canvas 上
 ├─ 8. hash 处理：hash:true 时读 URL 片段覆盖相机
 ├─ 9. 无 hash 则 jumpTo(center/zoom/bearing/pitch/roll)
 ├─ 10. resize()：按容器尺寸定画布像素
 ├─ 11. setStyle(style)：解析样式（异步）
 ├─ 12. attributionControl 为真则加 AttributionControl
 ├─ 13. maplibreLogo 为真则加 LogoControl
 └─ 14. 监听 style.load：把样式里的 center/zoom 应用到尚未被显式设置的相机
```

第 2 步的校验值得记住，它决定了哪些参数组合会当场抛错：

| 校验 | 错误信息 |
| --- | --- |
| `minZoom > maxZoom` | `maxZoom must be greater than or equal to minZoom` |
| `minPitch > maxPitch` | `maxPitch must be greater than or equal to minPitch` |
| `minPitch < 0` | `minPitch must be greater than or equal to 0` |
| `maxPitch > 180` | `maxPitch must be less than or equal to 180` |

注意 `maxPitch` 的硬上限是 180，但 `MapOptions.pitch` 的文档写的是 0–85，且明确"大于 60 度属于实验特性，可能出现渲染问题"。实践中把 `maxPitch` 放到 85 已经足够做倾斜视角，超过 90 度需要配合 `centerClampedToGround: false`，否则相机会被地形与地面约束拉回去。

## 4.2 MapOptions 全量默认值

`defaultOptions` 在 `src/ui/map.ts` 约 515 行处，是排查"为什么行为和文档不一样"的第一手资料。按用途分组如下。

### 4.2.1 相机与视口

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `center` | `[0, 0]` | 经纬度顺序，与 GeoJSON 一致 |
| `zoom` | `0` | 未设置时依次取 style 里的 zoom，再回落到 0 |
| `bearing` / `pitch` / `roll` | `0` | 度；pitch 0–85，roll 绕视线轴 |
| `elevation` | `0` | 中心点海拔（米） |
| `bearingSnap` | `7` | 旋转离正北 7 度内自动吸附 |
| `zoomSnap` | `0` | 0 表示连续缩放 |
| `minZoom` / `maxZoom` | `-2` / `22` | Mercator 下实际最小 zoom 还受视口高度限制 |
| `minPitch` / `maxPitch` | `0` / `60` | 硬上限 180，建议不超过 85 |
| `maxBounds` | 无 | 约束可视范围 |
| `renderWorldCopies` | `true` | 经度 ±180 之外是否重复渲染世界 |
| `zoomLevelsToOverscale` | `4` | 超 source maxzoom 后在近 maxZoom 若干层改用切分 |

### 4.2.2 交互开关

| 选项 | 默认值 | 备注 |
| --- | --- | --- |
| `interactive` | `true` | false 时不挂任何鼠标/触摸/键盘监听 |
| `scrollZoom` | `true` | 可传 `AroundCenterOptions` |
| `boxZoom` | `true` | 可传 `{boxZoomEnd}` 自定义框选结果处理 |
| `dragPan` / `dragRotate` | `true` | 6.15 起 `dragRotate` 支持 `{around: 'pointer'}` |
| `keyboard` | `true` | 方向键平移、+/- 缩放 |
| `doubleClickZoom` | `true` | 双击放大 |
| `touchZoomRotate` / `touchPitch` | `true` | 双指缩放旋转 / 倾斜 |
| `cooperativeGestures` | `false` | true 时需 Ctrl/⌘ 或双指才响应 |
| `clickTolerance` | `3` | 像素；超过视为拖拽而非点击 |
| `pitchWithRotate` | `true` | 右键拖动时是否允许改 pitch |
| `rollEnabled` | `false` | 是否允许 roll |
| `rotateSpeed` / `pitchSpeed` | `0.8` / `-0.5` | 每像素旋转/俯仰角度 |
| `aroundCenter` | 无（已废弃） | 改用 `dragRotate.around` + `movement` |

### 4.2.3 渲染与资源

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `canvasContextAttributes` | `antialias:false, preserveDrawingBuffer:false, powerPreference:'high-performance', failIfMajorPerformanceCaveat:false, desynchronized:false, contextType:'webgl2'` | `alpha/depth/stencil/premultipliedAlpha` 由内部强制为 true |
| `pixelRatio` | 未设时取 `devicePixelRatio` | 可强制 1 降低填充率压力 |
| `maxCanvasSize` | `[4096, 4096]` | 超出会降 pixelRatio 并告警一次 |
| `maxTileCacheSize` | `null`（按视口动态算） | 单 source 瓦片缓存上限 |
| `maxTileCacheZoomLevels` | `5` | 与视口瓦片数相乘得到动态缓存量 |
| `fadeDuration` | `300` | 标注碰撞淡入淡出（ms） |
| `crossSourceCollisions` | `true` | 多 source 的符号是否互相避让 |
| `refreshExpiredTiles` | `true` | 按 HTTP 缓存头重新请求过期瓦片 |
| `cancelPendingTileRequestsWhileZooming` | `true` | 放大时取消低层级未完成请求 |
| `trackResize` | `true` | ResizeObserver 自动跟随容器 |
| `validateStyle` | `true` | 生产可关，错误信息会变少 |
| `localIdeographFontFamily` | `'sans-serif'` | 中日韩字符用本地字体生成，省 glyph 请求；设为 `false` 让样式决定 |
| `anisotropicFilterPitch` | 见 `defaultAnisotropicFilterPitch` 常量 | 超过该 pitch 对栅格层开各向异性过滤 |

### 4.2.4 钩子与样式

| 选项 | 默认值 | 用途 |
| --- | --- | --- |
| `transformRequest` | `null` | 请求前改 URL、加 header、设 credentials |
| `transformCameraUpdate` | `null` | 相机更新前拦截（限制范围、做阻尼） |
| `transformConstrain` | `null` | 自定义视口约束，替换默认的 bounds 逻辑 |
| `transformStyle` | 无 | 样式获取后、提交前改写，可继承旧样式片段 |
| `globalState` | 无 | style 里 `state` 的初始值，可被 `setGlobalStateProperty` 覆盖 |
| `locale` | 默认英文字符串表 | 控件提示文案本地化 |
| `hash` | `false` | 相机与 URL 片段双向同步，可传字符串做参数名前缀 |
| `attributionControl` | `{compact: true, customAttribution: '<a ...>MapLibre</a>'}` | 传 `false` 关闭 |
| `maplibreLogo` / `logoPosition` | `false` / `'bottom-left'` | 是否显示文字 logo |
| `terrainSkirtLength` | `'auto'` | 地形瓦片裙边，透明背景下出现竖缝时可调 |
| `centerClampedToGround` | `true` | 中心点海拔随地形自动更新；pitch > 90 需设 false |

## 4.3 生命周期事件时序

一个地图从创建到销毁，事件有明确的先后。把顺序画出来，比逐个记文档有效：

```text
new Map()
  │
  ├─ (无事件) 构造函数同步完成，style 开始异步加载
  │
  ├─ styledataloading ──► data (dataType: 'style')
  ├─ styledata
  ├─ style.load         样式结构就绪：可 addSource / addLayer / getLayer
  │
  ├─ sourcedataloading ──► data (dataType: 'source')
  ├─ sourcedata          瓦片逐个到达
  ├─ load                首屏必要资源就绪 + 第一帧完成
  ├─ render              每次真正绘制
  └─ idle                无动画、无待加载瓦片、无淡入淡出
  │
  ├─ setStyle(other)  → 再来一遍 styledata / style.load / load
  └─ remove()          → remove 事件，之后不得再调用任何 Map 方法
```

`load` 与 `style.load` 的区别常被搞混：前者等首屏瓦片也画完，后者只等样式结构可用。要在样式里加图层，用 `style.load`；要隐藏 loading 遮罩，用 `load`。

```js
import {Map, NavigationControl} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [116.391, 39.907],
  zoom: 9
});

// 样式一就绪就加图层，不必等瓦片
map.on('style.load', () => {
  map.addSource('boundary', {
    type: 'geojson',
    data: '/data/boundary.geojson'
  });
  map.addLayer({
    id: 'boundary-line',
    type: 'line',
    source: 'boundary',
    paint: {'line-color': '#e4572e', 'line-width': 2}
  });
});

// 首屏完成后再做 UI 层面的收尾
map.once('load', () => {
  document.getElementById('loading')?.remove();
  map.addControl(new NavigationControl(), 'top-right');
});

// 任何错误都会走 error 事件，不注册则打印到控制台
map.on('error', (e) => {
  console.error('[maplibre]', e.error?.message ?? e);
});
```

## 4.4 setStyle：热切换样式的正确姿势

`setStyle` 的默认行为是**增量对比**而不是全量重建。源码里 `options.diff !== false` 时走 `_diffStyle`，否则走 `_updateStyle`。增量对比能保住已加载的瓦片与已注册的图片，切换底图时不会白屏。

但有两个例外会强制全量更新：**sprite 与 glyphs 变化**。文档写得很明确——样式里的 sprite/glyphs 只要有任何不同，渲染器就放弃 diff，删掉当前样式重新构建。这意味着"换一套字体图标"的样式切换一定比"只换颜色"慢。

```js
// 增量：只改了 paint，diff 生效，瓦片不重新请求
map.setStyle(lightStyle);

// 强制全量：调试样式对比时用，会清空当前样式
map.setStyle(darkStyle, {diff: false});

// 用 transformStyle 把旧样式的某个 source 继承过来
map.setStyle(newStyleUrl, {
  transformStyle: (previous, next) => {
    if (!previous) return next;
    return {
      ...next,
      sources: {
        ...next.sources,
        // 保留业务图层依赖的 source
        poi: previous.sources.poi
      },
      layers: [
        ...next.layers,
        // 把业务图层追加到新样式最上面
        ...previous.layers.filter((l) => l.id.startsWith('biz-'))
      ]
    };
  }
});
```

`transformStyle` 在"底图可切换、业务图层不能丢"的产品里几乎是必备的。没有它，每次换底图都要手工重放一遍业务图层，容易漏。注意它接收的是序列化后的样式对象，修改时不要直接改 `previous`，返回新对象。

`setStyle` 也是异步的：调用后立刻 `getLayer('biz-x')` 可能拿到 `undefined`。要等新的 `style.load`：

```js
map.once('style.load', () => {
  console.log('新样式已就绪，图层数：', map.getStyle().layers.length);
});
map.setStyle(nextStyleUrl);
```

## 4.5 remove()：销毁地图时必须做的事

单页应用里反复创建地图而不销毁，会稳定泄漏 WebGL 上下文与 worker。`remove()` 的清理清单在源码里写得很清楚：

| 清理项 | 不清理的后果 |
| --- | --- |
| `hash.remove()` | URL 片段仍在变，事件监听残留 |
| 每个 control 的 `onRemove` | 控件 DOM 与监听器泄漏 |
| 中止渲染帧请求 | 已销毁的实例继续被回调 |
| 清空渲染任务队列 | 排队回调持有闭包引用 |
| 中止 `_diffStyleRequest` | 样式请求完成后写入已销毁实例 |
| `painter.destroy()` | GL 资源与上下文泄漏（浏览器上限约 16 个上下文） |
| `handlerManager.destroy()` | canvas 上的 DOM 监听器残留 |
| worker 池 `restart` 监听解绑 | 全局池持有已销毁地图 |
| `setStyle(null)` | 样式、source、图层状态不清空 |
| 移除图片请求节流控制 | 全局节流表累积 |
| `resizeObserver.disconnect()` | 容器变化继续触发已销毁地图 |
| `WEBGL_lose_context.loseContext()` | 上下文等到 GC 才释放，页面可能先到上限 |
| `_cleanupContainer()` | 容器上的 class 与子节点残留，无法复用 |
| 最后 `fire('remove')` | 外部清理钩子没有触发点 |

动手写时，最稳的模式是"一个容器只对应一个 Map 实例，销毁与创建成对出现"：

```js
let map = null;

function mountMap(containerId, styleUrl) {
  if (map) {
    map.remove();
    map = null;
  }
  map = new maplibregl.Map({
    container: containerId,
    style: styleUrl,
    center: [116.391, 39.907],
    zoom: 9
  });
  return map;
}

function unmountMap() {
  if (!map) return;
  map.remove();
  map = null;
}
```

React 里对应的写法是 `useEffect` 的清理函数，注意依赖数组不要放整个 options 对象，否则每次渲染都会重建地图：

```jsx
import {useEffect, useRef} from 'react';
import maplibregl from 'maplibre-gl'; // v6 请改用 import * as maplibregl
import 'maplibre-gl/dist/maplibre-gl.css';

function MapView({styleUrl, center, zoom}) {
  const holder = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: holder.current,
      style: styleUrl,
      center,
      zoom
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // 只在挂载/卸载时重建，styleUrl 等变化走 setStyle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(styleUrl);
  }, [styleUrl]);

  return <div ref={holder} className="map-holder" />;
}
```

## 4.6 事件订阅：on / once / 图层级

v5 起 `map.on()` 返回一个 `Subscription` 对象，可以显式退订；v6 沿用。这让"注册在组件里、卸载时统一退订"变得简单：

```js
const sub = map.on('moveend', () => {
  console.log('移动结束', map.getCenter().toArray());
});

// 需要时退订，不用保存原函数引用
sub.unsubscribe();

// 图层级事件：只在该图层的要素上触发，内部仍是 queryRenderedFeatures
const layerSub = map.on('click', 'boundary-line', (e) => {
  console.log(e.features[0].properties);
});
layerSub.unsubscribe();

// 带过滤条件的同一个事件，可以叠加多个监听
map.on('click', 'poi', (e) => console.log('poi', e.features.length));
```

几个容易踩的点：

- `map.on('click', layerId, fn)` 的第二个参数是图层 id 字符串，不是数组；要监听多个图层，注册多次或在回调里判断 `e.features[0].layer.id`。
- 图层不存在时注册图层级事件不会报错，但永远不会触发。等 `style.load` 之后再注册。
- `once` 对图层级事件同样有效，且 6.11.2 修过一个 bug：`once(type, layerId, listener)` 之前会在"第一个未命中图层的事件"上就退订，现在改成"第一个命中图层的事件"。用到旧版本时要注意。
- 事件对象在 v6 里都是类实例（`MapMouseEvent`、`MapMovementEvent` 等），判断类型请用 `e.type`，不要依赖 `instanceof` 跨包比较。

## 4.7 排错清单

**`Style is not done loading.`** 在 `style.load` 之前调用了 `addLayer`/`addSource`/`setPaintProperty` 等。改成在 `style.load` 回调里执行，或者先 `map.isStyleLoaded()` 判断。

**`Source "xxx" already exists.`** 重复 `addSource` 同一个 id。切换数据时应该 `getSource(id).setData(...)`，或者先 `removeSource` 再加。注意 `setStyle` 后旧 source 已被移除，不能沿用旧引用。

**`There is no source with ID=xxx`** 与上一条相反：source 已被移除或从未添加，但 `addLayer` 引用了它。检查 `setStyle` 前后 source id 是否一致。

**`There is no layer with ID=xxx`** 在 `addLayer({before: 'label'})` 里指定了一个不存在的插入位置。`before` 必须是当前样式里真实存在的图层 id。

**地图在容器里"跳一下"再稳定。** 常见于先创建 Map、再让容器变成可见尺寸。创建时按 400×300 回落的尺寸渲染了一帧，随后 ResizeObserver 触发 resize。修法：容器先有尺寸再建 Map，或建完立刻 `map.resize()`。

**销毁后控制台仍在报错。** 检查是否有 `setTimeout`/`setInterval`/`requestAnimationFrame` 里还在调 `map.getCenter()` 之类的方法。`remove()` 之后 Map 的公开方法不应再被调用（官方文档明确写了这一点），业务侧的定时器要一并清掉。

## 4.8 生产建议

**把 options 收敛成一处配置。** MapOptions 有 60 多个字段，散落在组件里很快就会失控。建议在项目里维护一个 `createMapOptions()` 工厂，只暴露业务需要的少数字段，其余用默认值。

**相机状态与业务状态分开存。** 中心点、zoom 属于相机，用 `getCenter()`/`getZoom()` 读；业务筛选条件放在应用状态里。把相机状态塞进全局 store 并且每次 move 都更新，会在拖动时触发大量无意义渲染。

**少用 `setStyle` 做主题切换。** 如果只是换颜色，直接 `setPaintProperty` 逐图层改；`setStyle` 会触发样式解析、diff、可能的 sprite/glyphs 重载。只有底图整套资源都变时才值得。

**给 `transformRequest` 加超时与重试。** 它是所有外部请求的必经之路，在这里统一加超时、鉴权头、失败重试策略，比散落在各处的 fetch 更好维护。

**监控 `error` 事件而不是靠肉眼。** 生产环境把 `map.on('error')` 接到前端监控，并按 `e.error?.message` 归类。瓦片 404、CORS、样式校验失败都会走这里。

## 4.9 本章小结

| 主题 | 结论 |
| --- | --- |
| 构造顺序 | 合并默认值 → 校验 → Camera → 容器 → handlers → hash/jumpTo → resize → setStyle → 控件 |
| 会抛错的参数 | minZoom>maxZoom、minPitch>maxPitch、minPitch<0、maxPitch>180 |
| 关键默认值 | zoom 0、maxZoom 22、maxPitch 60、fadeDuration 300、maxCanvasSize 4096²、maxTileCacheZoomLevels 5 |
| 事件时序 | `style.load`（可改图层）→ `load`（首屏完成）→ `idle`（可截图） |
| setStyle | 默认增量 diff；sprite/glyphs 变更会强制全量；`transformStyle` 用于继承旧样式片段 |
| 事件订阅 | `map.on` 返回 `Subscription`，可 `unsubscribe()`；图层级事件需在 `style.load` 后注册 |
| 销毁 | `remove()` 必须调用；之后不得再调用 Map 的公开方法，业务定时器要同步清理 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第03章-核心架构与渲染管线/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第05章-样式规范StyleSpec详解/" class="chapter-nav__next">下一章 →</a>
</div>
