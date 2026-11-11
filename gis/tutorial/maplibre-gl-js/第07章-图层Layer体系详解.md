---
layout: default
title: 第07章 - 图层 Layer 体系详解
---

# 第07章 - 图层 Layer 体系详解

## 7.1 图层是排序的"绘制单元"

地图上的每一块内容都属于某个图层。图层有三个作用：决定画什么（source + source-layer + filter）、决定怎么画（type + paint + layout）、决定画在哪一层（在 layers 数组里的位置）。

后一条最容易被忽视。样式里 `layers` 的数组顺序就是绘制顺序，**后来的在上**。加图层时如果没有指定插入位置，它就加在最顶层，遮住已有的标注：

```js
// 错误：新图层被追加到最上面，把 label 图层盖住了
map.addLayer({id: 'highlight', type: 'fill', source: 'districts', paint: {'fill-color': '#ff0'}});

// 正确：插到某个已有图层之前
map.addLayer(
  {id: 'highlight', type: 'fill', source: 'districts', paint: {'fill-color': '#ff0'}},
  'label-city' // before 参数：插到该图层之前
);

// 不写 before 时，也可以用 moveLayer 事后调整
map.moveLayer('highlight', 'label-city');
```

`before` 必须是**当前样式里真实存在**的图层 id，否则会报 `There is no layer with ID=...`。想在"所有标注之下、所有面之上"插入，最稳的做法是先记下目标图层的 id，再传 `before`。

## 7.2 各类型的属性范围

图层的类型决定了它能用哪些属性。把每类的 layout 与 paint 列出来，比翻文档快：

| 类型 | layout 属性 | paint 属性（关键项） |
| --- | --- | --- |
| `background` | 仅 `visibility` | `background-color`、`background-opacity`、`background-pattern` |
| `fill` | `fill-sort-key`、`visibility` | `fill-antialias`、`fill-opacity`、`fill-color`、`fill-outline-color`、`fill-translate`、`fill-pattern` |
| `line` | `line-cap`、`line-join`、`line-miter-limit`、`line-round-limit`、`line-sort-key`、`visibility` | `line-opacity`、`line-color`、`line-translate`、`line-width`、`line-gap-width`、`line-offset`、`line-blur`、`line-dasharray`、`line-pattern`、`line-gradient` |
| `symbol` | 30 余项，见 7.3 | 14 项：`icon-*` 与 `text-*` 各一组 |
| `circle` | `circle-sort-key`、`visibility` | `circle-radius`、`circle-color`、`circle-blur`、`circle-opacity`、`circle-translate`、`circle-pitch-scale`、`circle-pitch-alignment`、`circle-stroke-*` |
| `heatmap` | 仅 `visibility` | `heatmap-radius`、`heatmap-weight`、`heatmap-intensity`、`heatmap-color`、`heatmap-opacity` |
| `fill-extrusion` | `fill-extrusion-rounded-corner-distance`、`visibility` | `fill-extrusion-height`、`-base`、`-color`、`-opacity`、`-pattern`、`-translate`、`-vertical-gradient` |
| `raster` | 仅 `visibility` | `raster-opacity`、`raster-fade-duration`、`raster-resampling`、`raster-contrast` 等 |
| `hillshade` | 仅 `visibility` | `hillshade-illumination-direction`（默认 335）、`-altitude`、`-anchor`、`-exaggeration`（0.5）、`-method`、`resampling` |
| `color-relief` | 仅 `visibility` | `color-relief-color`、`color-relief-opacity`、`resampling` |

注意 `raster`、`hillshade`、`color-relief`、`heatmap` 四类的 layout 只有 `visibility`——它们没有"几何生成"这一步，所有属性都在 paint 侧。

### 7.2.1 fill 的描边陷阱

`fill-outline-color` 不是"给多边形的边描边"，它只在填充的边缘画 1 像素线，而且依赖 `fill-antialias: true`。要可控线宽的边，叠一个 line 图层：

```js
// 面
map.addLayer({
  id: 'district-fill', type: 'fill', source: 'districts',
  paint: {'fill-color': '#9ecae1', 'fill-opacity': 0.6}
});

// 边（用同一个 source，几何会被复用）
map.addLayer({
  id: 'district-outline', type: 'line', source: 'districts',
  paint: {'line-color': '#3182bd', 'line-width': 1.5}
});
```

### 7.2.2 line 的双线技巧

`line-gap-width` 可以画出"外描边"效果，不用叠两个图层：主线宽 `w`，设置 `line-gap-width: w` 后，线被渲染成两条相距 `w` 的边。配合 `line-offset`，可以做出道路的立体感。

```js
map.addLayer({
  id: 'road-outline', type: 'line', source: 'roads', 'source-layer': 'transportation',
  layout: {'line-join': 'round', 'line-cap': 'round'},
  paint: {'line-color': '#5b5b5b', 'line-width': 7}
});
map.addLayer({
  id: 'road-casing', type: 'line', source: 'roads', 'source-layer': 'transportation',
  layout: {'line-join': 'round', 'line-cap': 'round'},
  paint: {'line-color': '#ffffff', 'line-width': 5}
});
```

这两个图层的 layout 完全一致，因此会**共享同一个 Bucket**（见 3.5），几何只算一遍。把 `line-cap` 从 `round` 改成 `butt`，就会立刻多出一份完整几何。

## 7.3 symbol：唯一需要碰撞计算的类型

`symbol` 的属性最多，因为图标和文字各有自己的一整套几何与锚点。规范里 `layout_symbol` 共 47 个字段，常用分组如下：

| 分组 | 属性 | 说明 |
| --- | --- | --- |
| 通用 | `symbol-placement` | `point` / `line` / `line-center`，决定标注贴在点上还是沿线上 |
| 通用 | `symbol-spacing` | line 模式下相邻标注的最小间距（像素） |
| 通用 | `symbol-sort-key` | 碰撞优先级，越小越优先保留 |
| 通用 | `symbol-z-order` | `auto` / `viewport-y` / `source`，控制叠放 |
| 图标 | `icon-image` | sprite 中的图片名 |
| 图标 | `icon-size` / `icon-rotate` / `icon-offset` / `icon-anchor` | 尺寸、旋转、偏移、锚点 |
| 图标 | `icon-allow-overlap` / `icon-ignore-placement` | 是否允许重叠、是否参与碰撞 |
| 文字 | `text-field` | 文本内容，支持 `{name}` token 或表达式 |
| 文字 | `text-font` / `text-size` / `text-max-width` | 字体栈、字号、换行宽度（em） |
| 文字 | `text-transform` / `text-letter-spacing` / `text-line-height` | 大小写、字距、行高 |
| 文字 | `text-anchor` / `text-variable-anchor` / `text-offset` | 锚点与偏移，variable-anchor 会在候选位置间自动择优 |
| 文字 | `text-allow-overlap` / `text-ignore-placement` / `text-padding` | 碰撞相关 |
| 文字 | `text-writing-mode` | 竖排文字 |
| 倾斜相关 | `icon-pitch-alignment` / `text-pitch-alignment` / `icon-rotation-alignment` / `text-rotation-alignment` | 选择 `map` 时贴着地图旋转，`viewport` 时保持屏幕朝向 |

`text-variable-anchor` 是提升标注可读性的利器：给它一组候选锚点（如 `["top", "bottom", "left", "right"]`），碰撞时会在这些位置里找空位。

```js
map.addLayer({
  id: 'poi-label',
  type: 'symbol',
  source: 'poi',
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 16, 15],
    'text-max-width': 8,
    'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
    'text-radial-offset': 0.6,
    'icon-image': ['get', 'icon'],
    'icon-size': 0.8,
    'symbol-sort-key': ['get', 'rank']
  },
  paint: {
    'text-color': '#222',
    'text-halo-color': '#fff',
    'text-halo-width': 1.4,
    'icon-opacity': 0.95
  }
});
```

`text-halo-width` 是保证可读性的关键参数。它只在 `text-halo-color` 与 `text-halo-width` 同时存在时生效，常见组合是白色描边 1–2 px。

**字体缺失是最常见的"标注不显示"原因。** `text-font` 里的每个字体名都必须在 glyphs 服务里存在。写了一个服务端没有的字体，这个图层的文字会整体不出现，控制台可能只有一条不显眼的 404。

## 7.4 图层的动态控制

### 7.4.1 可见性

`visibility` 是最便宜的开关。设为 `none` 后该图层不参与绘制，但样式与 source 都保留，切回来是瞬时的。

```js
map.setLayoutProperty('poi-label', 'visibility', 'none');
map.setLayoutProperty('poi-label', 'visibility', 'visible');
```

相比之下 `removeLayer` 会销毁图层对象及其 Bucket 引用，再加回来要重新解析。

### 7.4.2 zoom 范围

`setLayerZoomRange(id, minzoom, maxzoom)` 等价于改 `layout` 之外的图层公共字段，比手动改样式对象安全：

```js
// 只在 8 到 14 层显示
map.setLayerZoomRange('district-fill', 8, 14);

// 只设下限
map.setLayerZoomRange('district-fill', 8, null);
```

注意 minzoom/maxzoom 的语义：`zoom < minzoom` 或 `zoom >= maxzoom` 时隐藏，上限是开区间。

### 7.4.3 filter 与 feature-state

`setFilter` 适合"按属性筛要素"。要做"选中某个要素并高亮"，用 `setFeatureState` 更省：

```js
// 一次注册，之后只改状态
map.addLayer({
  id: 'road-line',
  type: 'line',
  source: 'roads',
  'source-layer': 'transportation',
  paint: {
    'line-color': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      '#ff6b35', // 选中
      '#7a7a7a'  // 默认
    ],
    'line-width': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      6,
      2
    ]
  }
});

// 选中
map.setFeatureState({source: 'roads', id: roadId}, {selected: true});

// 取消
map.removeFeatureState({source: 'roads', id: roadId}, 'selected');
```

前提是 source 有稳定的 feature id：矢量瓦片要配 `promoteId`，GeoJSON 可以用 `generateId` 或 `promoteId`。没有 id，`setFeatureState` 无处落地。

## 7.5 查询图层要素

三类查询各有用途，别混用：

| 方法 | 查询范围 | 是否受样式影响 | 典型用途 |
| --- | --- | --- | --- |
| `queryRenderedFeatures` | 当前屏幕上已渲染的要素 | 是（filter、zoom、碰撞都算） | 点击拾取、悬停高亮 |
| `querySourceFeatures` | 某个 source 已加载的所有瓦片要素 | 否（但需要瓦片已加载） | 统计、导出当前视图数据 |
| `queryTerrainElevation` | 某个经纬度的高程 | — | 地形上的位置计算 |

```js
// 点击拾取：限定图层与半径，性能最好
map.on('click', (e) => {
  const hits = map.queryRenderedFeatures(
    [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]],
    {layers: ['road-line', 'poi-label']}
  );
  console.log(hits.map((f) => [f.layer.id, f.properties.name]));
});

// 统计当前已加载的要素（不受 filter 影响）
const all = map.querySourceFeatures('roads', {sourceLayer: 'transportation'});
console.log('已加载要素数：', all.length);
```

`queryRenderedFeatures` 返回的 feature 带 `layer`、`source`、`properties`、`geometry`，但 `geometry` 是**屏幕坐标系下的简化几何**，不是原始地理坐标。要做空间计算，用 `f.geometry` 前先确认坐标系，或改用 `querySourceFeatures` 拿瓦片坐标再转换。

## 7.6 图层事件

图层级事件是 `map.on(type, layerId, listener)` 的简写，内部会先做一次 `queryRenderedFeatures`：

```js
const layerEvents = [
  'click', 'dblclick', 'mousemove',
  'mouseenter', 'mouseleave',
  'mouseover', 'mouseout', 'contextmenu'
];

for (const type of layerEvents) {
  map.on(type, 'poi-label', (e) => {
    // 只有点的位置落在该图层要素上才会进来
    console.log(type, e.features[0].properties);
  });
}
```

几个限制：图层必须已经存在，否则注册成功但永不触发；`mouseenter`/`mouseleave` 是按要素去重后的结果，快速移动时可能漏事件；移动端没有鼠标语义，`mouseenter` 不会触发，要用 `click`。

## 7.7 三维图层

`fill-extrusion` 是从面挤出体块的图层，常用于建筑。两个高度属性决定立体形状：

```js
map.addLayer({
  id: 'building-3d',
  type: 'fill-extrusion',
  source: 'buildings',
  'source-layer': 'building',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': [
      'interpolate', ['linear'], ['get', 'height'],
      0, '#d9d9d9',
      50, '#bdbdbd',
      200, '#969696'
    ],
    'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': ['get', 'min_height'],
    'fill-extrusion-opacity': 0.85,
    // 侧面明暗渐变，增强体积感（默认 true）
    'fill-extrusion-vertical-gradient': true
  }
});
```

`fill-extrusion-height` 默认 `0`，所以只写 type 不写高度时看到的是平的。`base` 用于"建筑从某个高度起算"，例如高架桥面；两个都用 `["get", ...]` 时才是数据驱动。

倾斜视角需要 `pitch > 0`；`maxPitch` 默认 60，够用。若要让相机深入楼群，需要配合 `centerClampedToGround` 与地形。

## 7.8 排错清单

**图层加了但不显示。** 按顺序查：source 是否存在、`source-layer` 是否匹配、`minzoom/maxzoom` 是否排除当前层级、`filter` 是否筛空、`layout.visibility` 是否为 `none`、图层是否被更上层的图层完全遮住。

**`There is no layer with ID=xxx`。** `before` 参数指向了不存在的图层，或 `removeLayer` 了一个不存在的 id。

**改属性没反应。** 检查是不是把 paint 属性写进了 layout（或反之）。写错位置时校验会报错，但如果关了 `validateStyle`，可能静默忽略。

**标注互相压盖。** 三个手段：调 `symbol-sort-key` 给重要要素更高优先级、加 `text-padding` 让碰撞框更保守、用 `text-variable-anchor` 增加候选位置。

**文字不显示但图标正常。** 字体名在 glyphs 服务里不存在，或 glyphs URL 模板错误。用浏览器网络面板搜 `.pbf` 请求。

**line-dasharray 不生效。** `line-dasharray` 与 `line-pattern` 互斥；另外它要求线宽与虚线长度比例合理，过小的 dash 值在某些渲染后端上会被忽略。

**feature-state 高亮在缩放后丢失。** `promoteId` 没配，或 source 被 `setData` 替换后 feature id 变了。跨缩放保持一致的前提是 id 稳定。

## 7.9 生产建议

**图层数量控制在几十个以内。** 每多一个图层就多一轮绘制与状态切换。把同色同宽的要素合并到同一图层，用表达式区分样式，比拆成十个图层快。

**把"开关类"图层合并。** 例如"道路、铁路、水系"三类都可能有可见性开关，用 `visibility` 控制比动态增删图层稳定，也便于做 URL 状态同步。

**用 `setPaintProperty` 而不是重建样式。** 主题切换、颜色高亮都只该改属性。重建样式会触发 sprite/glyphs 检查，可能引发全量更新。

**给数据驱动属性设上限。** `["get", "height"]` 这类表达式为每个顶点写数据。要素超过十万时，考虑在数据侧预计算分档，用 `step` 减少取值精度。

**图层顺序写进配置而不是硬编码。** 用常量定义 z-order（底图 → 面 → 线 → 点 → 标注 → 交互高亮），所有 `addLayer` 都按这份顺序计算 `before`，避免不同模块互相插队。

## 7.10 本章小结

| 主题 | 结论 |
| --- | --- |
| 顺序 | `layers` 数组顺序即绘制顺序，后加的在上；用 `before` 或 `moveLayer` 定位 |
| 类型 | 10 种规范类型；layout 只影响几何，paint 影响像素 |
| symbol | 47 个 layout 属性；`text-halo-width` + `text-halo-color` 是可读性关键；字体必须存在于 glyphs |
| line | 同 layout 的图层共享 Bucket；`line-gap-width` 可做双线 |
| 动态控制 | `visibility` 最便宜；`setFilter` 筛要素；`setFeatureState` 做选中态（需稳定 id） |
| 查询 | 点击用 `queryRenderedFeatures`（受样式影响），统计用 `querySourceFeatures` |
| 3D | `fill-extrusion-height` 默认 0，必须显式给值 |
| 常见坑 | before 图层不存在、字体缺失、filter 筛空、feature id 不稳定 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第06章-数据源Source体系/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第08章-表达式与数据驱动样式/" class="chapter-nav__next">下一章 →</a>
</div>
