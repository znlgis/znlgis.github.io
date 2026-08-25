---
layout: default
title: 第03章：Viewer 核心配置与 API 详解
---

# 第03章：Viewer 核心配置与 API 详解

上一章我们搭建了开发环境并成功运行了第一个全景应用。从那一句 `new Viewer({...})` 开始，全景世界的大门已经打开。本章将深入 Viewer 构造函数的每一个角落，系统梳理配置选项、核心方法、事件系统、导航栏定制、缓存机制和国际化等内容。掌握这些，你就能随心所欲地操控全景视图。

> 本章内容基于 Photo-Sphere-Viewer v5.x。v5 相对 v4 是一次彻底重写，API 有较大变化，如果你从 v4 迁移，请特别注意事件系统和插件机制的差异。

## 3.1 Viewer 构造函数与配置选项全解

### 3.1.1 构造函数签名

```javascript
const viewer = new Viewer({
  container: ...,  // （必填）容器
  panorama: ...,   // （必填）全景图
  // ... 其余可选配置
});
```

两个必填项：`container` 指定 DOM 挂载点，`panorama` 指定全景图资源。其余选项都有合理的默认值，即使不传也能正常工作。

### 3.1.2 配置选项速查表

以下表格覆盖了 Viewer 构造函数的全部核心选项。

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| **容器与全景图** | | | |
| `container` | `HTMLElement \| string` | —（必填） | DOM 元素或 CSS 选择器 |
| `panorama` | `*` | —（必填） | 全景图资源（URL、Blob、函数），具体格式取决于适配器 |
| `adapter` | `Adapter \| [Adapter, any]` | `EquirectangularAdapter` | 全景图适配器。可以是类引用或 `[类引用, 适配器选项]` 的元组 |
| `plugins` | `Array<Plugin \| [Plugin, any]>` | `[]` | 要启用的插件列表，同样支持 `[插件类, 插件选项]` 元组形式 |
| **尺寸与视场** | | | |
| `size` | `{ width: number, height: number }` | 自动继承容器尺寸 | 手动指定 viewer 画布的最终尺寸 |
| `minFov` | `number` | `30` | 最小视场角（度），限制缩小的下限 |
| `maxFov` | `number` | `90` | 最大视场角（度），限制放大的上限 |
| `defaultZoomLvl` | `number` | `50` | 初始缩放级别（0–100），0 对应 `maxFov`，100 对应 `minFov` |
| `fisheye` | `boolean \| number` | `false` | 启用鱼眼效果。传入数值可控制畸变强度（0.0 – 2.0），`true` 等效于 `1.0` |
| **初始视角** | | | |
| `defaultYaw` | `number \| string` | `0` | 初始水平旋转角度（弧度或 `'45deg'` 格式）。角度自动转换为弧度 |
| `defaultPitch` | `number \| string` | `0` | 初始垂直俯仰角度，正值向上看，负值向下看 |
| **交互控制** | | | |
| `mousewheel` | `boolean` | `true` | 是否启用鼠标滚轮缩放 |
| `mousemove` | `boolean` | `true` | 是否启用鼠标拖拽旋转 |
| `keyboard` | `boolean \| string` | `'fullscreen'` | 键盘控制策略：`true` 始终启用，`false` 始终禁用，`'fullscreen'` 仅在全屏时启用 |
| `mousewheelCtrlKey` | `boolean` | `false` | 是否必须按住 Ctrl 键才能滚轮缩放 |
| `touchmoveTwoFingers` | `boolean` | `false` | 是否要求双指才能拖拽旋转（单指变为其他用途） |
| `moveSpeed` | `number` | `1` | 旋转移动速度系数 |
| `zoomSpeed` | `number` | `1` | 缩放速度系数 |
| `moveInertia` | `boolean \| number` | `0.8` | 惯性阻尼系数。`false` 关闭惯性，数值越大衰减越慢 |
| **渲染** | | | |
| `canvasBackground` | `string` | `'#000'` | 画布背景色（CSS 颜色值） |
| `rendererParameters` | `object` | `{ alpha: true, antialias: true }` | 传递给 Three.js `WebGLRenderer` 的参数 |
| **高级选项** | | | |
| `sphereCorrection` | `{ pan?: number, tilt?: number, roll?: number }` | — | 球体姿态校正，用于补偿全景拍摄时的角度偏差。单位：弧度 |
| `panoData` | `{ fullWidth, fullHeight, croppedWidth, croppedHeight, croppedX, croppedY }` | — | 全景图裁剪元数据，适配器据此计算正确的 UV 映射 |
| `useXmpData` | `boolean` | `false` | 是否从 JPEG 文件中自动读取 XMP 元数据（含 `panoData` 和 `poseHeading`） |
| `defaultTransition` | `{ speed?, rotation?, effect? }` | — | 默认的过渡动画配置，供 `setPanorama` 和 `animate` 方法使用 |
| `requestHeaders` | `Record<string, string>` | — | 加载全景图时附加的 HTTP 请求头 |
| `withCredentials` | `boolean` | `false` | 是否在跨域请求中携带凭证（Cookie、HTTP 认证等） |
| `lang` | `object` | — | 国际化文本覆盖，键值对形式覆盖内置 UI 字符串 |
| `keyboardActions` | `Record<string, string>` | — | 自定义键盘映射。键为按键组合（支持 Ctrl/Shift/Alt 修饰键），值为动作名称 |
| `caption` | `string` | — | 标题文本，支持 HTML。显示在导航栏顶部 |
| `description` | `string` | — | 描述文本，支持 HTML。点击导航栏信息按钮显示 |
| `downloadUrl` | `string` | — | 下载按钮指向的 URL（若不指定则使用 `panorama` 的值） |
| `downloadName` | `string` | — | 下载按钮触发的文件名 |
| `loadingImg` | `string` | — | 加载中占位图的 URL |
| `loadingTxt` | `string` | — | 加载中提示文字 |

### 3.1.3 容器与全景图

`container` 和 `panorama` 是启动 Viewer 的最小必要条件。我们把它们放在最前面来理解。

```html
<!-- HTML -->
<div id="my-viewer" style="width: 800px; height: 600px;"></div>
```

```javascript
// container 支持两种写法：DOM 元素或 CSS 选择器字符串
const viewer1 = new Viewer({
  container: document.getElementById('my-viewer'),
  panorama: '/images/panorama.jpg',
});

const viewer2 = new Viewer({
  container: '#my-viewer',
  panorama: '/images/panorama.jpg',
});
```

`panorama` 的值由适配器解释。对于默认的 `EquirectangularAdapter`，它可以是一个 URL 字符串、一个 `Blob` 对象，也可以是一个返回这些类型的函数（实现懒加载）：

```javascript
// 字符串 URL
panorama: 'path/to/image.jpg',

// Blob 对象（例如从 canvas 导出）
panorama: blob,

// 函数（首次渲染时才调用，适合懒加载）
panorama: () => fetch('/api/panorama').then(r => r.blob()),
```

### 3.1.4 适配器与插件配置

`adapter` 和 `plugins` 都支持两种写法：直接传入类引用，或传入一个 `[类引用, 配置]` 的元组。后者在需要向适配器/插件传递选项时使用。

```javascript
import { Viewer, CubemapAdapter } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

const viewer = new Viewer({
  container: '#viewer',
  panorama: 'panorama.jpg',

  // adapter: 直接传入类
  adapter: EquirectangularAdapter,

  // 或传入元组，第二个元素为适配器选项
  adapter: [EquirectangularAdapter, { resolution: 64 }],

  // plugins: 数组中每个元素同上
  plugins: [
    // 直接传入类（使用默认配置）
    MarkersPlugin,
    // 元组形式（传入插件配置）
    [MarkersPlugin, { clickEventOnMarker: false }],
  ],
});
```

### 3.1.5 初始视角与视场

`defaultYaw`、`defaultPitch` 和 `defaultZoomLvl` 决定了全景图"第一眼"看到的位置。这三个值分别控制水平旋转角度、垂直俯仰角度和缩放级别。

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'room.jpg',

  // 度数写法（自动转为弧度）
  defaultYaw: '45deg',      // 水平方向看向右侧 45 度
  defaultPitch: '10deg',    // 略向上看 10 度

  // 也可以用数字（弧度）
  // defaultYaw: Math.PI / 4,

  // 缩放级别 0-100，70 表示偏近（放大），20 表示偏远（缩小）
  defaultZoomLvl: 70,

  // 限制缩放范围：只允许 30° – 60° 之间
  minFov: 30,
  maxFov: 60,
});
```

`fisheye` 选项给全景图加上鱼眼畸变效果，适合做趣味展示或模拟广角镜头：

```javascript
// 适中畸变
fisheye: true,    // 等效于 fisheye: 1.0

// 强烈畸变
fisheye: 1.8,

// 轻微畸变
fisheye: 0.4,
```

### 3.1.6 交互微调

在生产项目中，常常需要精确控制交互行为。以下示例展示了一个适用于"产品展示全景"的配置：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'showroom.jpg',

  // 鼠标滚轮缩放——按住 Ctrl 才能滚动
  mousewheelCtrlKey: true,
  mousewheel: true,

  // 关闭鼠标拖拽（只允许通过按钮旋转）
  mousemove: false,

  // 移动端：要求双指才能旋转
  touchmoveTwoFingers: true,

  // 降低移动速度，让浏览更平缓
  moveSpeed: 0.5,

  // 关闭惯性，视角即刻停止
  moveInertia: false,

  // 键盘：仅在全屏时响应
  keyboard: 'fullscreen',
});
```

`keyboard` 选项的三个值各有适用场景：

| 值 | 场景 |
|---|------|
| `true` | 需要强力键盘操控（如展示类应用） |
| `false` | 页面本身有大量键盘快捷键，不希望与 viewer 冲突 |
| `'fullscreen'` | 折中方案：正常浏览时不干扰页面，全屏后自动支持键盘 |

内置键盘映射如下（可通过 `keyboardActions` 覆盖）：

| 按键 | 动作 |
|------|------|
| `ArrowLeft` / `ArrowRight` | 水平旋转 |
| `ArrowUp` / `ArrowDown` | 垂直旋转 |
| `+` / `=` | 放大 |
| `-` / `_` | 缩小 |
| `Ctrl+ArrowLeft` | 微调旋转（更小步长） |

下面用 `keyboardActions` 自定义键盘映射，把 WASD 也绑定上：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'scene.jpg',
  keyboard: true,
  keyboardActions: {
    // W/S 控制俯仰
    'KeyW':      'pitch-up',
    'KeyS':      'pitch-down',
    // A/D 控制水平旋转
    'KeyA':      'yaw-left',
    'KeyD':      'yaw-right',
    // Ctrl+Shift+Up 急速缩小
    'ctrl+shift+ArrowUp': 'zoom-out-fast',
    // 自定义缩写也支持: Ctrl 可写为 ctrl 或 control
  },
});
```

### 3.1.7 裁剪全景图与 XMP 元数据

部分全景图源可能是从大图中裁剪出来的。此时需要告诉 Viewer 实际的像素区域，确保 UV 映射正确：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'cropped-pano.jpg',

  panoData: {
    fullWidth:   12000,    // 原始全景图的总宽度
    fullHeight:   6000,    // 原始全景图的总高度
    croppedWidth: 9600,    // 裁剪后图像的宽度
    croppedHeight: 4800,   // 裁剪后图像的高度
    croppedX:      1200,   // 裁剪区域的左上角 X 坐标
    croppedY:       600,   // 裁剪区域的左上角 Y 坐标
  },
});
```

如果你的全景图自带 XMP 元数据（如 Ricoh Theta、GoPro Fusion 等相机拍摄的），可以直接启用 `useXmpData`：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'camera-pano.jpg',

  useXmpData: true,  // 自动读取 panoData 和 poseHeading
});
```

> **注意**：`useXmpData` 会增加一次额外的 HTTP 请求（用于读取文件头部的 XMP 段）。如果全景图文件很大，网络延迟可能增长。对于确定不含 XMP 的图片，保持默认 `false` 即可。

### 3.1.8 球体校正与过渡动画

`sphereCorrection` 用于补偿全景拍摄时相机姿态的偏差。三个字段分别对应 **偏航（pan）**、**俯仰（tilt）** 和 **滚转（roll）**，单位均为弧度。

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'room.jpg',

  // 拍摄时相机向右倾斜了 3 度，需要反向补偿
  sphereCorrection: {
    pan:   0,
    tilt:  0,
    roll: -3 * Math.PI / 180,
  },
});
```

`defaultTransition` 则定义了 `setPanorama` 和 `animate` 方法在没有显式传参时使用的默认过渡效果：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'scene-a.jpg',

  defaultTransition: {
    speed: '20rpm',     // 旋转速度，接受 rpm（转/分）或秒数
    rotation: true,     // 是否让过渡路径走"最短圆弧"
    effect: 'fade',     // 过渡效果：'fade' 或 'none'
  },
});
```

### 3.1.9 导航栏文本

`caption` 和 `description` 是导航栏的两个静态信息入口：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'gallery.jpg',

  caption: '<h2>巴黎卢浮宫</h2>',
  description: `
    <p>拍摄日期：2026年7月</p>
    <p>摄影师：张三</p>
    <p>器材：Ricoh Theta Z1</p>
  `,

  downloadUrl:  '/images/gallery-full.jpg',
  downloadName: '卢浮宫全景.jpg',
});
```

> `caption` 和 `description` 都支持 HTML，但请务必过滤用户输入，防止 XSS。仅当内容来自你信任的数据源时才使用 HTML。

### 3.1.10 加载状态自定义

加载全景图需要时间，特别是大文件或慢网络环境。`loadingImg` 和 `loadingTxt` 让你自定义等待态的视觉反馈：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'huge-pano.jpg',

  loadingImg: '/assets/spinner.svg',
  loadingTxt: '全景图加载中，请稍候...',
});
```

内部会自动在容器中创建一个加载覆盖层。当 `panorama-loaded` 事件触发后，该层自动移除。

## 3.2 Viewer 核心方法详解

Viewer 实例提供了丰富的控制方法。以下按功能分组逐一介绍，每个方法都配有完整代码示例。

### 3.2.1 animate(options) — 平滑动画

`animate` 是 Viewer 最重要的动画接口，让你以平滑方式旋转到指定位置并调整缩放。它返回一个 Promise，动画结束时 resolve；Promise 附带一个 `cancel` 方法，可在中途取消。

```javascript
// 平滑旋转到指定位置，动画持续 2 秒
const anim = viewer.animate({
  yaw:   Math.PI / 2,    // 水平 90°
  pitch: 0.2,            // 略向上
  zoom:  75,             // 缩放到 75 级
  speed: '2rpm',         // 速度：每分钟 2 转
});

// 等待动画完成
await anim;

// 或在中途取消
setTimeout(() => anim.cancel(), 1000);
```

`options` 各字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `yaw` | `number` | 目标水平角度（弧度） |
| `pitch` | `number` | 目标垂直角度（弧度） |
| `zoom` | `number` | 目标缩放级别（0–100） |
| `speed` | `string \| number` | 动画速度。字符串形式如 `'5rpm'`，数字形式表示持续时间（毫秒） |

`animate` 返回的是**可取消的 Promise**——这是一个关键设计，避免了手动管理定时器的麻烦：

```javascript
let currentAnim = null;

async function goToSpot(spot) {
  // 取消上一次动画
  currentAnim?.cancel();

  currentAnim = viewer.animate({
    yaw: spot.yaw,
    pitch: spot.pitch,
    zoom: spot.zoom,
    speed: '3rpm',
  });

  await currentAnim;
  console.log('已到达目标位置');
}
```

### 3.2.2 destroy() — 销毁 Viewer

当你不再需要 Viewer 时，务必调用 `destroy()` 释放资源。它会：

- 停止所有动画
- 移除所有事件监听器
- 销毁 Three.js 的 WebGL 上下文、纹理、几何体
- 从 DOM 中移除 viewer 元素

```javascript
// 单页应用路由切换时，销毁旧的 viewer
router.beforeEach(() => {
  if (currentViewer) {
    currentViewer.destroy();
    currentViewer = null;
  }
});
```

调用 `destroy()` 后，Viewer 实例不再可用。任何对方法的调用都会抛出错误。

### 3.2.3 getPlugin(pluginId) — 获取插件实例

插件注册时会声明一个 `id`，通过 `getPlugin` 可以获取插件实例，进而调用插件专属方法。

```javascript
// 获取标记插件实例并调用其方法
const markersPlugin = viewer.getPlugin('markers');
if (markersPlugin) {
  markersPlugin.addMarker({
    id: 'point-1',
    position: { yaw: Math.PI / 4, pitch: 0.1 },
  });
}
```

常见的内置插件 ID 速查：

| 插件 | ID |
|------|-----|
| MarkersPlugin | `'markers'` |
| GyroscopePlugin | `'gyroscope'` |
| StereoPlugin | `'stereo'` |
| AutorotatePlugin | `'autorotate'` |
| VirtualTourPlugin | `'virtual-tour'` |
| GalleryPlugin | `'gallery'` |

> **注意**：如果获取的插件 ID 不存在，返回的不是 `null` 而是 `undefined`。上面的判断用了 truthy 检查来兼容两种情况。

### 3.2.4 getPosition() — 获取当前视角

返回 `{ yaw, pitch }` 对象，角度单位为弧度。

```javascript
const pos = viewer.getPosition();
console.log(`水平: ${pos.yaw.toFixed(3)} rad, 垂直: ${pos.pitch.toFixed(3)} rad`);

// 应用场景：保存用户浏览状态
function saveViewState() {
  const { yaw, pitch } = viewer.getPosition();
  const zoom = viewer.getZoomLevel();
  localStorage.setItem('viewState', JSON.stringify({ yaw, pitch, zoom }));
}

// 恢复浏览状态
function restoreViewState() {
  const saved = JSON.parse(localStorage.getItem('viewState'));
  if (saved) {
    viewer.rotate({ yaw: saved.yaw, pitch: saved.pitch });
    viewer.zoom(saved.zoom);
  }
}
```

### 3.2.5 getZoomLevel() — 获取缩放级别

返回 0 到 100 的数值，0 表示最远（视场角最大），100 表示最近（视场角最小）。

```javascript
const level = viewer.getZoomLevel();
if (level > 80) {
  console.log('用户正在仔细观察细节');
}
```

### 3.2.6 rotate(position) — 立即旋转

与 `animate` 不同，`rotate` 是瞬时的——无动画，即刻跳转到目标角度。

```javascript
// 立刻跳到水平 180°（回头看）
viewer.rotate({ yaw: Math.PI, pitch: 0 });

// 配合按钮点击时用得最多
button.addEventListener('click', () => {
  viewer.rotate({ yaw: 0, pitch: 0 }); // 一键回正
});
```

### 3.2.7 setOption / setOptions — 动态更新配置

这两种方法允许在 Viewer 运行时热更新配置项。

```javascript
// 更新单个选项
viewer.setOption('minFov', 15);
viewer.setOption('moveSpeed', 2);

// 批量更新
viewer.setOptions({
  mousewheelCtrlKey: false,
  moveInertia: 0.5,
  fisheye: 1.2,
});

// 动态修改标题
viewer.setOption('caption', '<h3>新标题</h3>');

// 动态修改键盘行为
viewer.setOption('keyboard', true);

// 切换导航栏文字
viewer.setOption('description', '更新后的描述');
```

**不是所有选项都能运行时修改。** 以下选项在 Viewer 创建后即固定：

- `container`
- `adapter`
- `rendererParameters`
- `useXmpData`
- `sphereCorrection`

这些选项关系到内部数据结构初始化，不支持热切换。

### 3.2.8 setPanorama(panorama, options?) — 切换全景图

这是 v5 中最强大的方法之一。你可以无缝切换到另一张全景图，并附带过渡动画。它返回 Promise。

```javascript
const transition = await viewer.setPanorama('/images/room-2.jpg', {
  transition: {
    speed: '10rpm',
    rotation: true,
    effect: 'fade',
  },
  caption: '第二展厅',
  description: '切换到第二展厅',
  panoData: {           // 新全景图可以有不同的裁剪信息
    fullWidth: 8000,
    fullHeight: 4000,
    croppedWidth: 8000,
    croppedHeight: 4000,
    croppedX: 0,
    croppedY: 0,
  },
  sphereCorrection: {   // 以及不同的校正参数
    pan: 0,
    tilt: 0.1,
    roll: 0,
  },
  showLoader: true,     // 切换期间显示加载动画
});
```

`options` 中包含一个关键属性 `transition`，它接受与 `defaultTransition` 相同格式的配置：

```javascript
// 不同过渡效果对比

// 淡入淡出
await viewer.setPanorama('next.jpg', {
  transition: { effect: 'fade', speed: '5rpm' },
});

// 快速旋转切换（更有 VR 穿梭感）
await viewer.setPanorama('next.jpg', {
  transition: { effect: 'none', speed: '30rpm', rotation: true },
});
```

`setPanorama` 的能力不止于此：它还能接受函数和 `Blob`，适合动态加载场景。

```javascript
// 从 API 动态获取全景图 Blob
async function loadNextPanorama(id) {
  const response = await fetch(`/api/panorama/${id}`);
  const blob = await response.blob();

  await viewer.setPanorama(blob, {
    showLoader: true,
    transition: { speed: '8rpm', rotation: true },
  });
}
```

### 3.2.9 zoom / zoomIn / zoomOut — 缩放控制

三个缩放方法覆盖了最常见的缩放需求。

```javascript
// 直接设置缩放级别（0-100）
viewer.zoom(60);

// 在当前级别上增加 10
viewer.zoomIn(10);

// 在当前级别上减少 5
viewer.zoomOut(5);

// 搭建一个缩放步进按钮
document.getElementById('zoom-in-btn').addEventListener('click', () => {
  const current = viewer.getZoomLevel();
  if (current < 100) {
    viewer.zoomIn(20);
  }
});

document.getElementById('zoom-out-btn').addEventListener('click', () => {
  const current = viewer.getZoomLevel();
  if (current > 0) {
    viewer.zoomOut(20);
  }
});
```

> `zoom(level)` 会立即跳转到目标级别。如果需要平滑过渡，请在 `animate` 中设置 `zoom` 字段。

### 3.2.10 needsUpdate() — 通知尺寸变化

当 viewer 容器的尺寸因页面布局变化而改变时（例如侧边栏收起、浏览器窗口缩放、父容器 display 从 none 切换为 block），需要调用 `needsUpdate()` 让 viewer 重新计算渲染尺寸。

```javascript
// 场景一：浏览器窗口缩放
window.addEventListener('resize', () => {
  viewer.needsUpdate();
});

// 场景二：侧边栏展开/收起
document.getElementById('toggle-sidebar').addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  // 布局变化后告知 viewer
  setTimeout(() => viewer.needsUpdate(), 300); // 等 CSS 过渡完成后调用
});
```

> **提示**：除了手动调用，也可以使用内置的 [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) 自动监听。但如果你已经在更上层管理尺寸变化，`needsUpdate()` 是最直接的方式。

### 3.2.11 方法速查表

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `animate(options)` | 可取消的 `Promise` | 平滑动画到目标位置 |
| `destroy()` | `void` | 销毁 viewer，释放所有资源 |
| `getPlugin(id)` | `Plugin \| undefined` | 获取插件实例 |
| `getPosition()` | `{ yaw, pitch }` | 获取当前视角（弧度） |
| `getZoomLevel()` | `number` (0–100) | 获取当前缩放级别 |
| `needsUpdate()` | `void` | 通知 viewer 容器尺寸已变化 |
| `rotate(pos)` | `void` | 立即旋转到指定位置 |
| `setOption(key, val)` | `void` | 更新单个配置选项 |
| `setOptions(obj)` | `void` | 批量更新配置选项 |
| `setPanorama(pano, opts?)` | `Promise` | 切换全景图（支持过渡动画） |
| `zoom(level)` | `void` | 设置缩放级别 |
| `zoomIn(step)` | `void` | 放大指定步长 |
| `zoomOut(step)` | `void` | 缩小指定步长 |

## 3.3 Viewer 事件系统详解

v5 的事件系统基于浏览器原生 `EventTarget`。这意味着你可以使用标准的 `addEventListener` / `removeEventListener`，事件对象是标准的 `Event`（或 `CustomEvent`）。这与 v4 的 `on` / `off` 完全不同，迁移时请尤其注意。

### 3.3.1 事件绑定方式

```javascript
// v5 推荐写法：使用事件常量
viewer.addEventListener('ready', handler);

// 也可以用静态属性（IDE 友好的常量）
// 从 @photo-sphere-viewer/core 导入 Viewer
viewer.addEventListener(Viewer.READY_EVENT, handler);

// 传统字符串同样有效
viewer.addEventListener('position-updated', (e) => {
  console.log(e.yaw, e.pitch, e.zoom);
});

// 移除事件
viewer.removeEventListener('position-updated', myHandler);
```

> **最佳实践**：优先使用 `Viewer.EVENT_NAME` 静态常量，享受类型推导和拼写检查。

### 3.3.2 事件列表

#### ready

**触发时机**：全景图加载完毕，Viewer 可以开始交互。

这是你需要在 Viewer 创建后首先监听的事件。在 `ready` 触发之前，Viewer 的方法调用（如 `animate`、`getPosition`）可能会得到不稳定的结果。

```javascript
const viewer = new Viewer({ container: '#v', panorama: 'p.jpg' });

viewer.addEventListener('ready', () => {
  // 安全的操作起点
  console.log('Viewer 就绪');
  viewer.animate({ yaw: '90deg', pitch: '10deg', speed: '3rpm' });
});
```

也可以将 `ready` 事件包装为 Promise 使用：

```javascript
function whenReady(viewer) {
  return new Promise(resolve => {
    viewer.addEventListener('ready', resolve, { once: true });
  });
}

const viewer = new Viewer({ container: '#v', panorama: 'p.jpg' });
await whenReady(viewer);
console.log('Viewer 已就绪，可以安全操作');
```

#### click / dblclick

**触发时机**：用户在球体上点击 / 双击。

事件对象的 `detail` 属性包含点击位置信息。

```javascript
viewer.addEventListener('click', (e) => {
  const { yaw, pitch, right, dblclick } = e.detail;
  console.log(`点击位置: yaw=${yaw.toFixed(2)}, pitch=${pitch.toFixed(2)}`);
  console.log(`右键: ${right}, 双击: ${dblclick}`);
});

viewer.addEventListener('dblclick', (e) => {
  const { yaw, pitch } = e.detail;
  console.log(`双击: ${yaw.toFixed(2)}, ${pitch.toFixed(2)}`);
});
```

`detail` 对象字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `yaw` | `number` | 点击位置的水平角度（弧度） |
| `pitch` | `number` | 点击位置的垂直角度（弧度） |
| `target` | `EventTarget` | 事件目标元素 |
| `right` | `boolean` | 是否为右键（仅 `click` 事件） |
| `dblclick` | `boolean` | 是否同时触发双击（仅 `click` 事件） |
| `clientX` | `number` | 鼠标 X 坐标 |
| `clientY` | `number` | 鼠标 Y 坐标 |

#### position-updated

**触发时机**：视角位置发生改变（包括用户拖拽、`rotate`、`animate` 等）。

```javascript
viewer.addEventListener('position-updated', (e) => {
  const { yaw, pitch } = e.detail;
  // 更新外部 UI 组件，如罗盘、缩略图导航
  updateCompass(yaw);
});
```

#### zoom-updated

**触发时机**：缩放级别发生改变。

```javascript
viewer.addEventListener('zoom-updated', (e) => {
  const zoomLevel = e.detail.zoom;
  document.getElementById('zoom-indicator').textContent = `${zoomLevel}%`;
});
```

#### before-render / render

**触发时机**：
- `before-render`：每帧渲染之前
- `render`：每帧渲染之后

这两个事件每帧都会触发（通常 60fps），因此**切勿在其中执行重计算或者 DOM 操作**。它们适合做简单的状态同步或调试输出。

```javascript
viewer.addEventListener('before-render', (e) => {
  // e.detail 包含 { timestamp, delta }
  // 比如在这里更新第三人称视角的 avatar 朝向
});

viewer.addEventListener('render', (e) => {
  // 渲染完成后的回调
});
```

#### fullscreen-updated

**触发时机**：进入或退出全屏。

```javascript
viewer.addEventListener('fullscreen-updated', (e) => {
  console.log('全屏状态:', e.detail.fullscreen);
});
```

#### size-updated

**触发时机**：Viewer 尺寸改变（调用 `needsUpdate()` 或自动检测到尺寸变化后）。

```javascript
viewer.addEventListener('size-updated', (e) => {
  const { width, height } = e.detail.size;
  console.log(`新尺寸: ${width} x ${height}`);
});
```

#### panorama-loaded

**触发时机**：全景图纹理已加载并渲染到球体上（包括初始加载和 `setPanorama` 切换后）。

```javascript
viewer.addEventListener('panorama-loaded', (e) => {
  console.log('当前全景图已加载:', e.detail.panorama);
  // 可以在这里隐藏自定义的加载指示器
});
```

#### stop-all

**触发时机**：所有动画被强制停止后（例如调用 `destroy()` 或触发某些重置操作）。

```javascript
viewer.addEventListener('stop-all', () => {
  console.log('所有动画已停止');
});
```

### 3.3.3 事件常量汇总

在 TypeScript 项目中，建议使用 `Viewer` 类的静态常量来绑定事件：

```javascript
import { Viewer } from '@photo-sphere-viewer/core';

viewer.addEventListener(Viewer.READY_EVENT,              handler);
viewer.addEventListener(Viewer.CLICK_EVENT,              handler);
viewer.addEventListener(Viewer.DBLCLICK_EVENT,           handler);
viewer.addEventListener(Viewer.POSITION_UPDATED_EVENT,   handler);
viewer.addEventListener(Viewer.ZOOM_UPDATED_EVENT,       handler);
viewer.addEventListener(Viewer.BEFORE_RENDER_EVENT,      handler);
viewer.addEventListener(Viewer.RENDER_EVENT,             handler);
viewer.addEventListener(Viewer.FULLSCREEN_UPDATED_EVENT, handler);
viewer.addEventListener(Viewer.SIZE_UPDATED_EVENT,       handler);
viewer.addEventListener(Viewer.PANORAMA_LOADED_EVENT,    handler);
viewer.addEventListener(Viewer.STOP_ALL_EVENT,           handler);
```

### 3.3.4 事件使用场景实例

以下是一个综合示例，展示了事件在真实场景中的组合用法：

```javascript
import { Viewer } from '@photo-sphere-viewer/core';

const viewer = new Viewer({
  container: '#viewer',
  panorama: 'room.jpg',
});

// 就绪后：开始自动导览
viewer.addEventListener('ready', () => {
  startAutoTour();
});

// 跟踪用户浏览路径（每帧更新）
viewer.addEventListener('position-updated', (e) => {
  path.push({ time: Date.now(), yaw: e.detail.yaw, pitch: e.detail.pitch });
});

// 全景图切换后：更新侧边栏信息
viewer.addEventListener('panorama-loaded', (e) => {
  updateSidebarInfo(e.detail.panorama);
});

// 销毁前：保存状态
window.addEventListener('beforeunload', () => {
  const { yaw, pitch } = viewer.getPosition();
  localStorage.setItem('lastView', JSON.stringify({ yaw, pitch }));
  viewer.destroy();
});
```

## 3.4 导航栏（Navbar）完全定制

导航栏是 Viewer 最直观的交互元素。v5 的导航栏通过 `navbar` 配置数组来完全定制——包括内置按钮的重排、自定义按钮的插入、甚至完整替换。

### 3.4.1 内置按钮 ID 列表

| 按钮 ID | 功能说明 |
|---------|----------|
| `zoomOut` | 缩小按钮 |
| `zoomRange` | 缩放滑动条（范围输入框） |
| `zoomIn` | 放大按钮 |
| `zoom` | 缩放按钮组（等同于 `['zoomOut', 'zoomRange', 'zoomIn']`） |
| `move` | 移动按钮组（等同于 `['moveLeft', 'moveRight', 'moveTop', 'moveDown']`） |
| `moveLeft` | 向左旋转 |
| `moveRight` | 向右旋转 |
| `moveTop` | 向上旋转 |
| `moveDown` | 向下旋转 |
| `download` | 下载按钮 |
| `description` | 描述信息按钮 |
| `caption` | 标题显示 |
| `fullscreen` | 全屏切换按钮 |

### 3.4.2 配置导航栏按钮

`navbar` 选项是一个字符串数组，每个字符串对应一个按钮 ID 或 `zoom`/`move` 这样的按钮组 ID。渲染顺序由数组顺序决定。

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'room.jpg',

  // 简洁的默认导航栏
  navbar: [
    'zoom',       // 缩放按钮组
    'move',       // 移动按钮组
    'fullscreen', // 全屏
  ],
});
```

如果只想要特定按钮：

```javascript
navbar: [
  'zoomOut',
  'zoomRange',
  'zoomIn',
  'download',
  'fullscreen',
],
```

要排除特定按钮，只需从数组中移除它的 ID。

### 3.4.3 自定义按钮

自定义按钮同样通过 `navbar` 数组添入，但不再是字符串，而是一个对象：

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'room.jpg',

  navbar: [
    'zoom',
    'fullscreen',
    // 自定义：一键回正按钮
    {
      id: 'reset-view',
      title: '回正视角',
      content: `
        <svg viewBox="0 0 24 24" width="20" height="20"
             fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="8,12 12,8 16,12"/>
          <line x1="12" y1="16" x2="12" y2="8"/>
        </svg>
      `,
      className: 'reset-btn',
      disabled: false,
      visible: true,
      onClick(viewer) {
        viewer.rotate({ yaw: 0, pitch: 0 });
        viewer.zoom(50);
      },
    },
  ],
});
```

自定义按钮的配置字段：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | — | 唯一标识，用于后续查找或更新 |
| `title` | `string` | — | 鼠标悬停提示 |
| `content` | `string` | — | 按钮内部 HTML 内容（通常是 SVG 图标或文字） |
| `className` | `string` | — | 额外的 CSS 类名 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `visible` | `boolean` | `true` | 是否可见 |
| `onClick` | `(viewer) => void` | — | 点击回调，接收 viewer 实例 |

### 3.4.4 动态控制按钮状态

通过 `navbar` 对象上的方法，你可以运行时更新按钮：

```javascript
const navbar = viewer.navbar;

// 获取按钮对象
const resetBtn = navbar.getButton('reset-view');
const fullscreenBtn = navbar.getButton('fullscreen');

// 禁用/启用
resetBtn.disabled = true;

// 隐藏/显示
resetBtn.visible = false;

// 修改提示
resetBtn.title = '点击回正视角';

// 修改内容（如切换图标）
resetBtn.content = '... 新的 SVG ...';

// 修改点击行为
resetBtn.onClick = (viewer) => { ... };
```

### 3.4.5 插件注册的按钮

一些插件也会向导航栏注册自己的按钮。它们会自动出现在导航栏中，除非你在 `navbar` 数组中显式排除了它们。常见的有：

- **AutorotatePlugin**：`autorotate`——自动旋转开关
- **GyroscopePlugin**：`gyroscope`——陀螺仪开关
- **StereoPlugin**：`stereo`——立体视图开关
- **MarkersPlugin**：`markersList`——标记列表按钮

```javascript
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

const viewer = new Viewer({
  container: '#viewer',
  panorama: 'room.jpg',
  plugins: [AutorotatePlugin, GyroscopePlugin],
  // 插件按钮会出现在导航栏中，顺序按 navbar 数组
  navbar: [
    'zoom',
    'autorotate',  // 插件注册的按钮
    'gyroscope',   // 插件注册的按钮
    'fullscreen',
  ],
});
```

### 3.4.6 完全自定义导航栏位置

如果默认的顶部/底部工具栏位置不满足需求，可以将导航栏的按钮手动渲染到页面的任意位置：

```javascript
// 获取按钮对象后，手动挂载其 DOM
const zoomOutBtn = viewer.navbar.getButton('zoomOut');
document.getElementById('custom-toolbar').appendChild(zoomOutBtn.container);
```

## 3.5 缓存系统（Cache）

Photo-Sphere-Viewer v5 内置了一个简单的纹理缓存机制，可以避免重复的全景图网络请求。

### 3.5.1 缓存配置

```javascript
import { Cache } from '@photo-sphere-viewer/core';

// 修改全局缓存策略（在创建 Viewer 之前设置）
Cache.enabled  = true;    // 启用缓存（默认 true）
Cache.ttl      = 10;      // 缓存保留时长：10 分钟
Cache.maxItems = 50;      // 最多缓存 50 个纹理
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `Cache.enabled` | `boolean` | `true` | 是否启用缓存 |
| `Cache.ttl` | `number` | — | 缓存项的 TTL（Time To Live），单位分钟 |
| `Cache.maxItems` | `number` | — | 缓存中的最大纹理数，超出后按 LRU 策略淘汰 |

### 3.5.2 使用场景与注意事项

缓存在以下场景中效果显著：

1. **虚拟导览**：在多场景之间来回切换时，已看过的场景直接从缓存取，实现秒切。
2. **画廊模式**：用户反复浏览几张全景图时，缓存命中可以节省大量带宽。

但需要注意：

- 缓存以纹理对象的形式存储在内存中。如果全景图尺寸大（8K 以上），每张纹理可能占据几十 MB 显存。此时应适当降低 `maxItems`。
- 缓存键基于全景图的 URL。如果使用 Blob 或函数作为 `panorama` 值，缓存将不起作用。

```javascript
// 场景：一个 20 张 16K 全景图的虚拟展厅
// 每张纹理会占用约 100MB 显存，全部缓存会导致 OOM
Cache.enabled = true;
Cache.maxItems = 5;   // 仅缓存最近 5 张
Cache.ttl = 15;       // 15 分钟后自动清除
```

> 如果你需要更精细的缓存控制（如基于 IndexedDB 的持久化缓存），建议结合 Service Worker 来实现。

## 3.6 国际化（i18n）

Viewer 的所有界面文本都可以通过 `lang` 选项覆盖，从而实现中文化或其他语言的翻译。

### 3.6.1 可覆盖的文本键

```javascript
const viewer = new Viewer({
  container: '#viewer',
  panorama: 'room.jpg',

  lang: {
    loading:          '加载中...',
    autorotate:       '自动旋转',
    zoom:             '缩放',
    zoomOut:          '缩小',
    zoomIn:           '放大',
    move:             '移动',
    moveLeft:         '向左',
    moveRight:        '向右',
    moveUp:           '向上',
    moveDown:         '向下',
    download:         '下载',
    fullscreen:       '全屏',
    menu:             '菜单',
    close:            '关闭',
    twoFingers:       '使用双指移动',
    ctrlZoom:         '按住 Ctrl 键滚动以缩放',
    loadError:        '全景图加载失败',
    panorama:         '全景图',
    gyroscope:        '陀螺仪',
    stereo:           '立体视图',
    stereoNotification:'点击以退出立体视图',
    pleaseRotate:     '请旋转您的设备',
    autorotatePaused: '自动旋转已暂停',
  },
});
```

### 3.6.2 扩展自定义文本

你也可以在 `lang` 中添加任意键，供插件或自定义 UI 使用：

```javascript
lang: {
  // ... 标准键
  'custom-tooltip': '点击查看详情',
  'floor-plan':     '楼层平面图',
},

// 在自定义按钮中引用
{
  id: 'floor-plan-btn',
  title: viewer.config.lang['floor-plan'],
  // ...
}
```

## 3.7 本章小结

本章覆盖了 Viewer 构造函数的全部配置选项、11 个核心方法、完整的 v5 事件系统、导航栏定制、缓存机制和国际化。让我们用一张图来总结这些模块之间的关系：

```
                    ┌─────────────────────────────────┐
                    │        Viewer 实例              │
                    └───────────────┬─────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
    ┌───────▼────────┐    ┌────────▼────────┐    ┌─────────▼─────────┐
    │   配置选项      │    │   核心方法       │    │    事件系统       │
    │ (构造函数参数)  │    │ (animate/rotate  │    │ (EventTarget API) │
    │                │    │  setPanorama/    │    │                  │
    │ container      │    │  zoom/destroy    │    │ ready/click/     │
    │ panorama       │    │  getPlugin/      │    │ position-updated │
    │ navbar/caption │    │  setOptions... ) │    │ zoom-updated...  │
    │ lang/plugins   │    │                 │    │                  │
    └────────────────┘    └─────────────────┘    └──────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼────────┐            ┌────────▼────────┐
            │  导航栏 (Navbar)│            │  缓存 (Cache)    │
            │ 内置按钮+自定义 │            │ enabled/ttl/     │
            │ 插件按钮        │            │ maxItems        │
            └────────────────┘            └─────────────────┘
```

**几个重要原则**：

1. **创建 Viewer 后先监听 `ready`**——在它触发之前不要调用方法。
2. **`setPanorama` 是切换全景图的统一入口**——不要试图通过修改 `panorama` 选项来切换。
3. **调用 `destroy()` 释放资源**——特别是 SPA 场景下。
4. **善用 `animate` 替代 `rotate`**——用户更喜欢平滑过渡而非瞬时跳转。
5. **事件处理保持轻量**——`before-render` 和 `render` 中不要做重计算。

下一章我们将深入研究各种全景图类型（等距柱状投影、立方体贴图、鱼眼、视频全景等）的原理与适配器配置，这是将 Viewer 应用到不同数据源的关键知识。

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/Photo-Sphere-Viewer/第02章-环境搭建与第一个全景应用/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/3d/Photo-Sphere-Viewer/第04章-全景图类型与适配器详解/" style="text-decoration: none;">下一章 →</a>
</div>
