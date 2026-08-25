---
layout: default
title: 第05章：标记系统 MarkersPlugin 深度解析
---

# 第05章：标记系统 MarkersPlugin 深度解析

如果说 Viewer 是 Photo-Sphere-Viewer 的骨架，Panorama 是它的血肉，那么 **MarkersPlugin 就是它的灵魂**——正是标记系统让全景图从"能看"变成了"能交互"。本章将全面、深入地解析 MarkersPlugin 的每一种标记类型、每一个配置属性和每一个 API 方法，并提供可直接运行的完整实战示例。

## 1. MarkersPlugin 概述

MarkersPlugin 是 Photo-Sphere-Viewer 最核心、最强大的插件。它允许你在全景图上添加**多种类型的交互标记**——从简单的图片图钉到复杂的 SVG 多边形，从悬浮的 HTML 弹窗到嵌入场景的 3D 视频层。标记支持 Tooltip 气泡提示、侧面板内容展示、动态增删改查，以及丰富的鼠标/触摸事件回调。

**安装与注册：**

```js
// 1. 安装
// npm install @photo-sphere-viewer/markers-plugin

// 2. 导入 JS
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

// 3. 导入 CSS（确保 tooltip、侧面板等 UI 正常渲染）
import '@photo-sphere-viewer/markers-plugin/index.css';

// 4. 注册插件并添加初始标记
const viewer = new Viewer({
  container: document.getElementById('viewer'),
  panorama: 'pano.jpg',
  plugins: [
    [MarkersPlugin, {
      markers: [
        {
          id: 'marker-1',
          position: { yaw: '45deg', pitch: '0deg' },
          image: 'pin-red.png',
          size: { width: 32, height: 32 },
          tooltip: '第一个标记',
        },
      ],
    }],
  ],
});

// 5. 获取插件实例（后续所有 API 操作均通过此实例）
const markersPlugin = viewer.getPlugin(MarkersPlugin);
```

**一句话定位：** MarkersPlugin 是 PSV 最强大的插件，支持在全景图上添加 2D 浮层标记（HTML/图片/SVG）、3D 场景嵌入标记（图片层/视频层/DOM 元素层）以及球面多边形/折线标记。

---

## 2. 标记类型大全

MarkersPlugin 支持 **5 大类、15+ 种** 标记。每种标记通过一个且仅一个 `type` 属性来区分（例如 `image`、`circle`、`polygon` 等）。以下逐一详解。

### 2.1 2D 图片标记：`image`

浮在 viewer 渲染层之上的图片标记，是最常用的标记类型，适合放置图钉、图标等点位标记。

```js
{
  id: 'marker-image',
  position: { yaw: 0, pitch: 0 },
  image: 'pin-red.png',          // 图片路径
  size: { width: 32, height: 32 }, // 必填！图片标记必须指定尺寸
  tooltip: '图片标记示例',
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `image` | `string` | 图片 URL 路径 |
| `size` | `{width, height}` | **必填**，标记像素尺寸 |

### 2.2 HTML / DOM 元素标记：`html`、`element`

直接嵌入 HTML 内容或已存在的 DOM 元素，适合展示文本、按钮等自定义内容。

```js
// 方式一：直接写 HTML 字符串
{
  id: 'marker-html',
  position: { yaw: '30deg', pitch: '10deg' },
  html: '<div style="background:#ff6600;color:#fff;padding:4px 8px;border-radius:4px;">热门景点</div>',
  size: { width: 100, height: 30 },
}

// 方式二：使用已有的 DOM 元素
{
  id: 'marker-element',
  position: { yaw: '-45deg', pitch: '5deg' },
  element: document.querySelector('#my-custom-marker'),
}
```

> **注意：** `html` 内容是作为 HTML 直接渲染的。如果内容可能包含用户输入，务必先做 XSS 消毒处理。

对于 Web Components（自定义元素），如果你的组件定义了 `updateMarker(props)` 方法，插件会在每次渲染时自动调用它并传入：
- `marker`：标记对象引用
- `position`：当前 2D 视口坐标
- `viewerPosition`：当前相机朝向 `{yaw, pitch}`
- `zoomLevel`：当前缩放级别
- `viewerSize`：视口尺寸

### 2.3 SVG 形状标记：`square`、`rect`、`circle`、`ellipse`、`path`

使用内联 SVG 绘制的几何形状标记，适合做高亮区域标注。样式通过 `svgStyle` 属性控制。

```js
// 正方形
{
  id: 'marker-square',
  position: { yaw: '60deg', pitch: '0deg' },
  square: 20,  // 边长
  svgStyle: { fill: 'rgba(255,0,0,0.5)', stroke: '#ff0000', strokeWidth: '2px' },
}

// 矩形（数组形式或对象形式均可）
{
  id: 'marker-rect',
  position: { yaw: '-20deg', pitch: '15deg' },
  rect: [40, 20],  // 或 { width: 40, height: 20 }
  svgStyle: { fill: 'rgba(0,128,255,0.4)', stroke: '#0080ff', strokeWidth: '2px' },
}

// 圆形
{
  id: 'marker-circle',
  position: { yaw: '90deg', pitch: '5deg' },
  circle: 15,  // 半径
  svgStyle: { fill: 'rgba(0,255,0,0.5)', stroke: '#00ff00', strokeWidth: '2px' },
}

// 椭圆（数组或对象形式均可）
{
  id: 'marker-ellipse',
  position: { yaw: '120deg', pitch: '0deg' },
  ellipse: [30, 15],  // 或 { rx: 30, ry: 15 }
  svgStyle: { fill: 'rgba(255,255,0,0.4)' },
}

// 自定义 SVG 路径（(0,0) 即为标记的 position 锚点）
{
  id: 'marker-path',
  position: { yaw: '-90deg', pitch: '0deg' },
  path: 'M0,0 L60,60 L60,0 L0,60 L0,0',  // SVG path d 属性
  svgStyle: { fill: 'rgba(255,0,255,0.4)', stroke: '#ff00ff', strokeWidth: '2px' },
}
```

**适用场景：** 半透明圆形/矩形高亮某个区域，SVG 路径绘制箭头/方向指示器等。

### 2.4 球面多边形与折线：`polygon`、`polygonPixels`、`polyline`、`polylinePixels`

在全景球面上绘制多边形区域或折线。这些标记**不需要** `position` 和 `size` 属性，因为它们由多个顶点定义。

**多边形（球面坐标，支持带洞多边形）：**

```js
// 球面坐标多边形 [yaw, pitch]（弧度）
{
  id: 'marker-polygon',
  polygon: [
    [0.2, 0.4],
    [0.9, 1.1],
    [1.5, 0.7],
  ],
  svgStyle: { fill: 'rgba(255,0,0,0.3)', stroke: '#ff0000', strokeWidth: '2px' },
}

// 带洞的多边形（洞的顶点顺序需与外壳相反，类似 GeoJSON 规范）
{
  id: 'marker-polygon-hole',
  polygon: [
    [[0.2, 0.4], [0.9, 1.1], [1.5, 0.7]],  // 外环
    [[0.3, 0.5], [1.4, 0.8], [0.8, 1.0]],  // 内环（洞）
  ],
  svgStyle: { fill: 'rgba(0,128,255,0.3)', stroke: '#0080ff' },
}

// 像素坐标多边形（与全景图纹理坐标对应）
{
  id: 'marker-polygon-pixels',
  polygonPixels: [
    [100, 200],
    [150, 300],
    [300, 200],
  ],
  svgStyle: { fill: 'rgba(255,255,0,0.3)' },
}
```

**折线：**

```js
// 球面坐标折线
{
  id: 'marker-polyline',
  polyline: [
    [0.2, 0.4],
    [0.9, 1.1],
    [1.5, 0.7],
  ],
  svgStyle: { stroke: '#ff0000', strokeWidth: '3px' },
}

// 像素坐标折线
{
  id: 'marker-polyline-pixels',
  polylinePixels: [
    [100, 200],
    [150, 300],
    [300, 200],
  ],
  svgStyle: { stroke: '#00ff00', strokeWidth: '3px', strokeDasharray: '5,5' },
}
```

**适用场景：** 区域标注（如"这个房间内"）、路线指示、地界轮廓等。

### 2.5 3D 场景嵌入标记：`imageLayer`、`videoLayer`、`elementLayer`

这三者是"嵌入场景"的标记——它们不是浮在 viewer 上层的 2D DOM 元素，而是真正渲染在 Three.js 场景内部的平面，会随视角旋转自然地缩放和变形，视觉效果更加真实。

#### `imageLayer` —— 3D 图片层

```js
// 方式一：position + size（最简单）
{
  id: 'layer-image-1',
  imageLayer: 'info-panel.png',
  position: { yaw: 0, pitch: 0 },
  size: { width: 400, height: 300 },
}

// 方式二：四个角点精确定位（从左上角顺时针）
{
  id: 'layer-image-2',
  imageLayer: 'billboard.png',
  position: [
    { yaw: -0.2, pitch: 0.2 },   // 左上
    { yaw: 0.2, pitch: 0.2 },    // 右上
    { yaw: 0.2, pitch: -0.2 },   // 右下
    { yaw: -0.2, pitch: -0.2 },  // 左下
  ],
}
```

#### `videoLayer` —— 3D 视频层

```js
{
  id: 'layer-video',
  videoLayer: 'intro.mp4',
  position: { yaw: 0, pitch: 0 },
  size: { width: 640, height: 360 },
  autoplay: true,  // 是否自动播放，默认 true
}
```

#### `elementLayer` —— 3D DOM 元素层

用于将任意 DOM 元素（包括 `<iframe>`、YouTube 播放器等）嵌入场景：

```js
{
  id: 'layer-youtube',
  elementLayer: getYouTubeIframe('dQw4w9WgXcQ'),  // 返回 iframe DOM 元素
  position: { yaw: 0, pitch: 0 },
  rotation: { yaw: '10deg' },
}
```

> **注意：** `elementLayer` 只能用 `position` + `rotation` 方式定位，不支持四角点定位。

---

## 3. 标记通用属性详解

以下表格汇总了**所有标记通用**的配置属性（除 polygon/polyline 外）。

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | **必填** | 标记的唯一标识符 |
| `position` | `object` | — | 标记位置（见第 4 节详解） |
| `size` | `{width, height}` | — | 标记尺寸（像素）。图片标记必填，HTML 标记建议填写 |
| `rotation` | `number \| {yaw, pitch, roll}` | — | 旋转角度。2D 标记仅 `roll` 有效；3D 标记三轴均有效 |
| `scale` | `number[] \| {zoom: [], yaw: []}` | 无缩放 | 根据缩放级别/偏航角动态调整标记大小 |
| `hoverScale` | `boolean \| {amount, duration, easing}` | `null` | 鼠标悬停缩放效果。设为 `false` 可单独禁用 |
| `opacity` | `number` | `1` | 透明度，范围 0～1 |
| `zIndex` | `number` | `1` | 层叠顺序。注意：`imageLayer`/`videoLayer` 总是在最底层 |
| `visible` | `boolean` | `true` | 初始可见性 |
| `className` | `string` | — | CSS 类名（不适用于 `imageLayer`/`videoLayer`） |
| `style` | `object` | — | 内联 CSS 样式（`imageLayer`/`videoLayer` 仅支持 `cursor`） |
| `svgStyle` | `object` | — | SVG 样式：`fill`、`stroke`、`strokeWidth` 等（仅 SVG/多边形标记） |
| `anchor` | `string` | `'center center'` | 锚点位置，如 `'bottom center'`、`'top left'`、`'20% 80%'` |
| `zoomLvl` | `number` | — | `gotoMarker()` 时自动缩放到此级别 |
| `chromaKey` | `object` | `{enabled: false}` | 色度键抠图，仅 `imageLayer`/`videoLayer` 有效 |
| `tooltip` | `string \| object` | — | 工具提示配置（见第 5 节详解） |
| `content` | `string` | — | 点击后在侧面板显示的 HTML 内容 |
| `listContent` | `string` | — | 标记列表中显示的名称（不填则用 tooltip 内容） |
| `hideList` | `boolean` | `false` | 是否在标记列表中隐藏此标记 |
| `autoplay` | `boolean` | `true` | `videoLayer` 标记是否自动播放 |
| `data` | `any` | — | 自定义数据，可在事件回调中通过 `marker.data` 访问 |

**scale 属性详解：**

`scale` 让标记的大小跟随缩放级别或视角偏移动态变化，营造自然的空间感：

```js
// 随缩放级别变化：zoom 3 时缩放 1.0，zoom 50 时缩放 0.2（越放大标记越小）
scale: { zoom: [1, 0.2] }

// 随偏航角变化：正对时缩放 1.0，偏到 90° 时缩放 0.5
scale: { yaw: [1, 0.5] }
```

**hoverScale 属性详解：**

```js
// 使用默认设置（2x 缩放，100ms 线性过渡）
hoverScale: true

// 自定义悬停效果
hoverScale: { amount: 1.5, duration: 200, easing: 'ease-out' }

// 对此标记禁用悬停缩放
hoverScale: false
```

---

## 4. Position 详解

### 4.1 球面坐标 `{yaw, pitch}`

Photo-Sphere-Viewer 使用 **yaw（偏航角）和 pitch（俯仰角）** 来表示全景球面上的位置。

- **yaw（偏航角）**：水平旋转角度，范围通常为 -π 到 π（或 -180° 到 180°）。0° 为正前方。
- **pitch（俯仰角）**：垂直仰角，范围通常为 -π/2 到 π/2（或 -90° 到 90°）。0° 为水平，正值向下，负值向上。

支持的数值格式：

```js
// 弧度（数字）
position: { yaw: 0.785, pitch: 0.3 }

// 度数（字符串）
position: { yaw: '45deg', pitch: '17deg' }

// 混合使用也可以
position: { yaw: Math.PI / 4, pitch: '0deg' }
```

### 4.2 纹理像素坐标 `{textureX, textureY}`

直接使用全景图纹理上的像素坐标：

```js
position: { textureX: 1500, textureY: 800 }
```

配合立方体贴图时还可指定面：

```js
position: { textureFace: 'front', textureX: 100, textureY: 200 }
```

### 4.3 四角点数组（仅 `imageLayer` / `videoLayer`）

不通过单一 `position` + `size` 定位，而是直接指定四个角点的球面坐标，实现精确贴合：

```js
position: [
  { yaw: -0.2, pitch: 0.2 },   // 左上
  { yaw: 0.2, pitch: 0.2 },    // 右上
  { yaw: 0.2, pitch: -0.2 },   // 右下
  { yaw: -0.2, pitch: -0.2 },  // 左下
]
```

### 4.4 坐标选择建议

| 场景 | 推荐坐标 |
|------|----------|
| 交互标记（图钉、热点） | `{yaw, pitch}` — 语义清晰，与视角操作一致 |
| 需要精确对齐全景图已有内容 | `{textureX, textureY}` — 与原始图片像素对应 |
| 3D 图层需要贴合不规则区域 | 四角点数组 — 提供最大定位自由度 |

---

## 5. Tooltip 系统

Tooltip 是鼠标悬停时显示的气泡提示，是标记最基本的交互反馈。

### 5.1 基础用法

```js
// 最简单：直接传字符串
tooltip: '这是一条提示'

// 自定义位置
tooltip: { content: '卫生间', position: 'bottom left' }

// 点击触发（而非默认的 hover）
tooltip: { content: '点击查看详情', trigger: 'click', position: 'top center' }

// 自定义样式类
tooltip: { content: 'VIP 区域', className: 'vip-tooltip' }
```

### 5.2 position 可选值

`position` 支持 `top`/`center`/`bottom` 与 `left`/`center`/`right` 的任意组合：

| position | 效果 |
|----------|------|
| `'top center'` | 标记正上方居中（默认） |
| `'bottom left'` | 标记左下角 |
| `'right center'` | 标记正右方居中 |
| `'top right'` | 标记右上方 |

### 5.3 动态控制 Tooltip

```js
// 始终显示某个标记的 tooltip
markersPlugin.showMarkerTooltip('marker-1');

// 隐藏
markersPlugin.hideMarkerTooltip('marker-1');

// 批量操作
markersPlugin.showAllTooltips();
markersPlugin.hideAllTooltips();
markersPlugin.toggleAllTooltips();
```

### 5.4 高级：HTML Tooltip

Tooltip 内容支持 HTML，配合 CSS 可实现复杂样式：

```css
/* 在全局样式中定义 */
.custom-tooltip {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  max-width: 200px;
}
```

```js
tooltip: {
  content: '<strong>故宫太和殿</strong><br/><small>建于明永乐十八年</small>',
  className: 'custom-tooltip',
  position: 'top center',
}
```

---

## 6. Content 侧面板

当标记定义了 `content` 属性时，点击该标记会在 viewer 左侧弹出一个**内容侧面板**，用于展示详细信息。

```js
{
  id: 'marker-with-content',
  position: { yaw: '30deg', pitch: '5deg' },
  image: 'pin-blue.png',
  size: { width: 32, height: 32 },
  tooltip: '点击查看详情',
  content: `
    <div style="padding: 16px;">
      <h3>景点：天坛祈年殿</h3>
      <p>祈年殿建于明永乐十八年（1420年），是北京天坛的主体建筑。</p>
      <ul>
        <li>建筑高度：38 米</li>
        <li>直径：32.7 米</li>
        <li>地位：世界文化遗产</li>
      </ul>
    </div>
  `,
}
```

**手动控制侧面板：**

```js
// 编程方式打开侧面板
markersPlugin.showMarkerPanel('marker-with-content');

// 编程方式关闭
markersPlugin.hideMarkerPanel();
```

---

## 7. ImageLayer vs Image 深度对比

这是新手最容易困惑的地方。虽然两者都能显示图片，但渲染机制天差地别。

| 维度 | `image`（2D 浮层） | `imageLayer`（3D 嵌入） |
|------|-------------------|--------------------------|
| **渲染层级** | 浮在 viewer 之上的 DOM 层 | 嵌入 Three.js 场景内部 |
| **缩放行为** | 始终保持像素尺寸不变 | 随视角缩放自然变化（近大远小） |
| **旋转** | 仅支持 `roll`（平面内旋转） | 支持 `yaw`/`pitch`/`roll` 三轴 |
| **性能** | 零 GPU 开销（纯 DOM） | 有 GPU 纹理开销 |
| **交互** | CSS hover/click 等完整 DOM 事件 | Three.js raycasting 事件 |
| **定位** | `position` + `size` + `anchor` | `position` + `size` 或四角点数组 |
| **zIndex** | 可控 | 始终在最底层（先于其他标记渲染） |
| **色度键抠图** | 不支持 | 支持 `chromaKey` |

**使用建议：**

- **用 `image`：** 图钉、图标、按钮等 UI 元素——需要固定像素大小、精确的 DOM 交互。
- **用 `imageLayer`：** 需要在全景中"自然存在"的内容——如墙上的画框、地面上的 Logo、信息展板。当你希望标记随放大而变大、随旋转而透视变形时。
- **用 `videoLayer`：** 在场景中嵌入视频播放，如"电视屏幕"或"投影幕布"效果。

```js
// ImageLayer 带色度键抠图的示例（绿幕视频变透明）
{
  id: 'spokesperson',
  videoLayer: 'spokesperson-green.mp4',
  position: { yaw: 0, pitch: 0 },
  size: { width: 640, height: 480 },
  chromaKey: {
    enabled: true,
    color: { r: 0, g: 255, b: 0 },
    similarity: 0.4,
    smoothness: 0.1,
  },
}
```

---

## 8. MarkersPlugin 方法详解

所有方法均通过 `markersPlugin` 实例调用：

### 8.1 添加标记

```js
markersPlugin.addMarker({
  id: 'new-marker',
  position: { yaw: '45deg', pitch: '0deg' },
  circle: 15,
  svgStyle: { fill: 'rgba(255,100,0,0.6)' },
  tooltip: '动态添加的标记',
});
```

### 8.2 删除标记

```js
// 删除单个
markersPlugin.removeMarker('new-marker');

// 批量删除
markersPlugin.removeMarkers(['marker-1', 'marker-2', 'marker-3']);
```

### 8.3 更新标记

```js
// 注意：不能改变标记类型（如从 image 变成 circle）
markersPlugin.updateMarker({
  id: 'new-marker',
  tooltip: '已更新的提示文本',
  opacity: 0.5,
});
```

### 8.4 批量设置

```js
// 一次性替换所有标记
markersPlugin.setMarkers([
  { id: 'a', position: { yaw: 0, pitch: 0 }, image: 'a.png', size: { width: 32, height: 32 } },
  { id: 'b', position: { yaw: '90deg', pitch: 0 }, image: 'b.png', size: { width: 32, height: 32 } },
]);
```

### 8.5 清除所有标记

```js
markersPlugin.clearMarkers();
```

### 8.6 平滑移动视角

```js
// 移动到标记位置，默认速度 8rpm
markersPlugin.gotoMarker('marker-1');

// 自定义速度
markersPlugin.gotoMarker('marker-1', '4rpm')
  .then(() => {
    console.log('视角已到达标记位置');
  });

// 立即跳转（无动画）
markersPlugin.gotoMarker('marker-1', 0);
```

### 8.7 可见性控制

```js
markersPlugin.hideMarker('marker-1');
markersPlugin.showMarker('marker-1');
markersPlugin.toggleMarker('marker-1');
// toggleMarker 也可显式传入目标状态
markersPlugin.toggleMarker('marker-1', true); // 强制显示

// 批量
markersPlugin.hideAllMarkers();
markersPlugin.showAllMarkers();
markersPlugin.toggleAllMarkers();
```

### 8.8 Tooltip 控制

```js
markersPlugin.showMarkerTooltip('marker-1');
markersPlugin.hideMarkerTooltip('marker-1');

markersPlugin.showAllTooltips();
markersPlugin.hideAllTooltips();
markersPlugin.toggleAllTooltips();
```

### 8.9 查询方法

```js
// 获取标记内部对象（只读）
const marker = markersPlugin.getMarker('marker-1');
console.log(marker.id, marker.position, marker.data);

// 获取所有标记
const allMarkers = markersPlugin.getMarkers();

// 获取标记数量
const count = markersPlugin.getNbMarkers();

// 获取当前（最后被点击的）标记
const current = markersPlugin.getCurrentMarker();
```

### 8.10 侧面板控制

```js
markersPlugin.showMarkerPanel('marker-1');
markersPlugin.hideMarkerPanel();
```

### 8.11 标记列表

```js
markersPlugin.showMarkersList();
markersPlugin.hideMarkersList();
markersPlugin.toggleMarkersList();
```

---

## 9. MarkersPlugin 事件

所有事件均通过 `addEventListener` 绑定：

### 9.1 `select-marker` — 点击标记

```js
markersPlugin.addEventListener('select-marker', ({ marker, doubleClick, rightClick }) => {
  console.log(`选中了标记：${marker.id}`);
  if (rightClick) {
    console.log('右键点击');
  }
  if (doubleClick) {
    console.log('双击');
    markersPlugin.removeMarker(marker.id);
  }
  // 访问自定义数据
  console.log('自定义数据：', marker.data);
});
```

### 9.2 `unselect-marker` — 取消选中

```js
markersPlugin.addEventListener('unselect-marker', ({ marker }) => {
  console.log(`取消选中：${marker.id}`);
});
```

### 9.3 `enter-marker` / `leave-marker` — 鼠标悬停

```js
markersPlugin.addEventListener('enter-marker', ({ marker }) => {
  // 自定义悬停高亮逻辑
  markersPlugin.updateMarker({
    id: marker.id,
    svgStyle: { ...marker.state.svgStyle, fill: 'rgba(255,255,0,0.8)' },
  });
});

markersPlugin.addEventListener('leave-marker', ({ marker }) => {
  markersPlugin.updateMarker({
    id: marker.id,
    svgStyle: { ...marker.state.svgStyle, fill: 'rgba(255,0,0,0.5)' },
  });
});
```

### 9.4 `marker-visibility` — 可见性变化

```js
markersPlugin.addEventListener('marker-visibility', ({ marker, visible }) => {
  console.log(`标记 ${marker.id} 现在${visible ? '可见' : '隐藏'}`);
});
```

### 9.5 其他事件

| 事件 | 触发时机 |
|------|----------|
| `goto-marker-done` | `gotoMarker()` 动画完成 |
| `hide-markers` | 调用 `hideAllMarkers()` 后 |
| `show-markers` | 调用 `showAllMarkers()` 后 |
| `set-markers` | 调用 `setMarkers()` 后 |
| `render-markers-list` | 标记列表渲染完成 |
| `select-marker-list` | 在标记列表中点击某个标记 |

---

## 10. 进阶：动态标记

### 10.1 根据缩放级别切换标记

利用 `addEventListener('zoom-updated')` 监听 Viewer 的缩放变化，动态调整标记的精细度：

```js
viewer.addEventListener('zoom-updated', (e) => {
  if (e.zoomLevel > 30) {
    // 高缩放级别：显示细节标记
    if (!markersPlugin.getMarker('detail-1')) {
      markersPlugin.addMarker({
        id: 'detail-1',
        position: { yaw: '10deg', pitch: '5deg' },
        circle: 8,
        svgStyle: { fill: 'rgba(0,255,0,0.8)' },
        tooltip: '细节标记（仅放大后可见）',
      });
    }
  } else {
    try { markersPlugin.removeMarker('detail-1'); } catch (e) { /* 忽略已删除 */ }
  }
});
```

### 10.2 数据驱动的标记生成

从外部数据源（API、JSON 配置）批量生成标记：

```js
async function loadMarkersFromAPI() {
  const response = await fetch('/api/poi');
  const pois = await response.json();

  const markers = pois.map((poi, index) => ({
    id: `poi-${index}`,
    position: { yaw: poi.yaw, pitch: poi.pitch },
    image: poi.icon || 'default-pin.png',
    size: { width: 32, height: 32 },
    tooltip: { content: poi.name, position: 'top center' },
    content: `<h3>${poi.name}</h3><p>${poi.description}</p>`,
    data: poi,  // 保留原始数据，回调中可通过 marker.data 访问
  }));

  markersPlugin.setMarkers(markers);

  // 统一的点击事件处理
  markersPlugin.addEventListener('select-marker', ({ marker }) => {
    if (marker.data?.url) {
      window.open(marker.data.url, '_blank');
    }
  });
}
```

### 10.3 条件可见性

根据不同条件动态显示/隐藏标记组：

```js
function filterByCategory(category) {
  const all = markersPlugin.getMarkers();
  all.forEach(m => {
    if (m.data?.category === category || category === 'all') {
      markersPlugin.showMarker(m.id);
    } else {
      markersPlugin.hideMarker(m.id);
    }
  });
}

// 示例：只显示"餐饮"类标记
filterByCategory('restaurant');
```

### 10.4 路径动画——移动标记

通过定时更新标记位置实现标记平滑移动：

```js
let angle = 0;
const movingMarkerId = 'moving-target';

markersPlugin.addMarker({
  id: movingMarkerId,
  position: { yaw: 0, pitch: 0 },
  circle: 10,
  svgStyle: { fill: 'rgba(255,0,0,0.8)' },
});

setInterval(() => {
  angle += 0.01;
  markersPlugin.updateMarker({
    id: movingMarkerId,
    position: {
      yaw: Math.sin(angle) * 0.8,
      pitch: Math.cos(angle) * 0.3,
    },
  });
}, 50); // 20 FPS
```

---

## 11. 完整实战示例

以下是一份**可以直接运行的完整 HTML 文件**，涵盖了本章所有核心知识点：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MarkersPlugin 完整实战</title>

  <!-- Photo-Sphere-Viewer 核心 CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/index.min.css">
  <!-- MarkersPlugin CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@5/index.min.css">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #viewer { width: 100vw; height: 100vh; }

    /* 自定义 Tooltip */
    .vip-tooltip {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: bold;
    }

    /* 自定义标记样式 */
    .html-marker {
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      white-space: nowrap;
      border: 2px solid #ffd700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="viewer"></div>

  <script type="importmap">
  {
    "imports": {
      "@photo-sphere-viewer/core": "https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/index.module.js",
      "@photo-sphere-viewer/markers-plugin": "https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@5/index.module.js"
    }
  }
  </script>

  <script type="module">
    import { Viewer } from '@photo-sphere-viewer/core';
    import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

    // ============ 1. 创建 Viewer 并注册 MarkersPlugin ============
    const viewer = new Viewer({
      container: document.getElementById('viewer'),
      // 使用一张示例全景图（替换为你的图片）
      panorama: 'https://photo-sphere-viewer-data.netlify.app/pano/Velisches-Silver/IMG_0577.JPG',
      defaultZoomLvl: 30,
      navbar: [
        'zoom',
        'markers',
        'markersList',
        'fullscreen',
      ],
      plugins: [
        [MarkersPlugin, {
          markers: [
            // ---- (A) 图片标记 ----
            {
              id: 'camera',
              position: { yaw: '15deg', pitch: '5deg' },
              image: 'https://img.icons8.com/color/48/camera--v1.png',
              size: { width: 40, height: 40 },
              tooltip: { content: '拍照点', position: 'bottom center' },
              anchor: 'bottom center',
              data: { type: 'scenic', rating: 5 },
            },

            // ---- (B) 圆形 SVG 标记 ----
            {
              id: 'hotspot-circle',
              position: { yaw: '120deg', pitch: '-10deg' },
              circle: 20,
              svgStyle: { fill: 'rgba(255, 100, 0, 0.6)', stroke: '#ff6400', strokeWidth: '2px' },
              tooltip: { content: '热门区域', position: 'right center', className: 'vip-tooltip' },
              hoverScale: { amount: 1.3, duration: 150, easing: 'ease-out' },
              content: '<h3>热门区域</h3><p>这里是游客最多的观景点，可俯瞰整个城市天际线。</p>',
              zoomLvl: 50,
            },

            // ---- (C) HTML 标记 ----
            {
              id: 'html-sign',
              position: { yaw: '-60deg', pitch: '10deg' },
              html: '<div class="html-marker">★ 推荐景点</div>',
              size: { width: 120, height: 36 },
              anchor: 'center center',
              tooltip: '点击查看详情',
            },

            // ---- (D) 多边形区域 ----
            {
              id: 'building-area',
              polygon: [
                [0.55, 0.15],
                [0.85, 0.15],
                [0.85, -0.15],
                [0.55, -0.15],
              ],
              svgStyle: {
                fill: 'rgba(0, 128, 255, 0.2)',
                stroke: '#0080ff',
                strokeWidth: '2px',
                strokeDasharray: '8,4',
              },
              tooltip: { content: '建筑区域', position: 'top center', trigger: 'click' },
              hideList: true, // 在标记列表中隐藏此多边形
            },

            // ---- (E) 折线 ----
            {
              id: 'path-line',
              polyline: [
                [0.2, 0.1],
                [0.4, 0.0],
                [0.6, 0.1],
                [0.8, -0.05],
              ],
              svgStyle: { stroke: '#ff4444', strokeWidth: '3px' },
              tooltip: '推荐游览路线',
            },
          ],
        }],
      ],
    });

    const markersPlugin = viewer.getPlugin(MarkersPlugin);

    // ============ 2. 动态添加一个椭圆标记 ============
    viewer.addEventListener('ready', () => {
      markersPlugin.addMarker({
        id: 'dynamic-ellipse',
        position: { yaw: '-120deg', pitch: '-5deg' },
        ellipse: [25, 12],
        svgStyle: {
          fill: 'rgba(100, 255, 100, 0.5)',
          stroke: '#00cc00',
          strokeWidth: '2px',
        },
        tooltip: '动态添加的标记',
        data: { addedAt: new Date().toISOString() },
      });
    });

    // ============ 3. 事件监听 ============

    // 点击标记
    markersPlugin.addEventListener('select-marker', ({ marker, doubleClick, rightClick }) => {
      console.group(`标记事件：${marker.id}`);
      console.log('类型：', Object.keys(marker.config).find(k =>
        ['image', 'circle', 'rect', 'square', 'ellipse', 'path',
         'html', 'element', 'polygon', 'polyline',
         'imageLayer', 'videoLayer', 'elementLayer'].includes(k)
      ));
      console.log('自定义数据：', marker.data);
      console.log('是否双击：', doubleClick);
      console.log('是否右键：', rightClick);
      console.groupEnd();

      // 双击删除动态标记
      if (doubleClick && marker.id === 'dynamic-ellipse') {
        markersPlugin.removeMarker(marker.id);
        console.log('已删除：dynamic-ellipse');
      }
    });

    // 悬停事件
    markersPlugin.addEventListener('enter-marker', ({ marker }) => {
      // 可以在此做高亮逻辑
    });

    markersPlugin.addEventListener('leave-marker', ({ marker }) => {
      // 可以在此恢复样式
    });

    // 可见性变化
    markersPlugin.addEventListener('marker-visibility', ({ marker, visible }) => {
      console.log(`标记 [${marker.id}] ${visible ? '显示' : '隐藏'}`);
    });

    // ============ 4. 工具栏：键盘快捷键 ============
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case '1':
          // 按 1 键：平滑移动到"拍照点"标记
          markersPlugin.gotoMarker('camera', '4rpm')
            .then(() => console.log('已到达拍照点'));
          break;
        case '2':
          // 按 2 键：跳转到热门区域并放大
          markersPlugin.gotoMarker('hotspot-circle', 0);
          viewer.zoom(50);
          break;
        case '3':
          // 按 3 键：切换所有标记显示/隐藏
          markersPlugin.toggleAllMarkers();
          break;
        case '4':
          // 按 4 键：显示所有 tooltip
          markersPlugin.toggleAllTooltips();
          break;
        case '5':
          // 按 5 键：打开/关闭标记列表
          markersPlugin.toggleMarkersList();
          break;
      }
    });

    console.log('MarkersPlugin 完整实战已就绪。');
    console.log('快捷键：1-跳转到拍照点  2-跳转到热门区域  3-切换标记  4-切换Tooltip  5-标记列表');
  </script>
</body>
</html>
```

**运行说明：**

1. 将上述代码保存为 `index.html`
2. 替换 `panorama` 为你的全景图 URL
3. 替换图片标记的 `image` URL 为有效的图标地址
4. 直接用浏览器打开即可（使用 importmap 从 CDN 加载模块）

---

## 12. 本章小结

本章全面解析了 Photo-Sphere-Viewer 的 MarkersPlugin 标记系统，涵盖以下核心要点：

| 维度 | 核心内容 |
|------|----------|
| **标记类型** | 5 大类：图片/HTML（2D 浮层）、SVG 形状、多边形/折线、3D 图层（imageLayer/videoLayer/elementLayer） |
| **定位系统** | yaw/pitch 球面坐标、textureX/textureY 纹理坐标、四角点数组三种方式 |
| **通用属性** | id、position、size、rotation、scale、hoverScale、opacity、zIndex、anchor、tooltip、content 等 20+ 个 |
| **Tooltip** | 字符串或对象配置，支持 HTML 内容、8 个方位、hover/click 触发 |
| **Content** | 点击后在侧面板展示详细 HTML 信息 |
| **Image vs ImageLayer** | 2D DOM 浮层 vs 3D 场景嵌入，后者缩放更自然但性能消耗更大 |
| **API 方法** | addMarker、removeMarker、updateMarker、setMarkers、gotoMarker、可见性控制、Tooltip 控制等 |
| **事件系统** | select-marker、unselect-marker、enter-marker、leave-marker、marker-visibility 等 |
| **进阶技巧** | 缩放级联动、数据驱动生成、条件可见性、路径动画 |

掌握 MarkersPlugin 之后，你的全景应用就从"静态观赏"升级到了"深度交互"。在下一章中，我们将深入 Photo-Sphere-Viewer 的**插件体系架构**，学习如何开发自定义插件，真正按照自己的需求扩展 PSV 的能力边界。

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/Photo-Sphere-Viewer/第04章-全景图类型与适配器详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/3d/Photo-Sphere-Viewer/第06章-插件体系架构与自定义插件开发/" style="text-decoration: none;">下一章 →</a>
</div>
