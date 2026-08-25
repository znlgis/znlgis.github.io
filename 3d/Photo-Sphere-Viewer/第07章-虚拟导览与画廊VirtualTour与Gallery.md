---
layout: default
title: 第07章：虚拟导览与画廊 VirtualTour 与 Gallery
---

# 第07章：虚拟导览与画廊 VirtualTour 与 Gallery

VirtualTourPlugin 是 Photo Sphere Viewer 生态中最具实用价值的插件之一。它能将多个独立的全景图连接成一个可自由探索的虚拟漫游体验——效果类似于 Google Street View，用户只需点击场景中的箭头即可在房间、街道或任意全景节点之间跳转。GalleryPlugin 则为多全景应用提供了底部缩略图画廊，用户可以直接通过缩略图切换场景。本章将详细拆解这两个插件的配置参数、工作模式与完整实战。

## 1. VirtualTourPlugin 概述

### 1.1 定位与能力

VirtualTourPlugin 的核心要义是"连接"：定义一系列节点（Node），每个节点是一个全景图，节点之间通过链接（Link）关联。用户进入某个节点后，场景中会渲染出指向相邻节点的方向箭头（定向指示器），点击箭头即可过渡到目标节点。

它自动与以下插件联动：

- **MarkersPlugin**：节点上可携带专属标记，切换节点时自动替换；
- **GalleryPlugin**：自动将节点列表同步为画廊缩略图；
- **CompassPlugin**：在指南针上显示各链接方向；
- **MapPlugin / PlanPlugin**：在地图或平面图上显示节点位置。

### 1.2 安装与导入

```bash
npm install @photo-sphere-viewer/virtual-tour-plugin
```

NPM 包安装后，需要在代码中同时导入 JS 和 CSS：

```js
import { Viewer } from '@photo-sphere-viewer/core';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
```

CDN 方式（jsDelivr）：

```html
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/virtual-tour-plugin@5/index.css">
<script type="module">
  import { VirtualTourPlugin }
    from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/virtual-tour-plugin@5/index.module.js';
</script>
```

### 1.3 基本注册

插件通过 `VirtualTourPlugin.withConfig(config)` 静态工厂方法注册到 Viewer 中：

```js
const viewer = new Viewer({
  container: document.querySelector('#viewer'),
  panorama: 'initial.jpg',
  plugins: [
    VirtualTourPlugin.withConfig({
      dataMode: 'client',
      positionMode: 'manual',
      renderMode: '3d',
      nodes: [
        // 节点列表将在后续小节详细展开
      ],
    }),
  ],
});

const virtualTour = viewer.getPlugin(VirtualTourPlugin);
```

`withConfig` 是 v5 的约定式写法（返回 `[Constructor, Config]` 元组），它比直接 `new Plugin(viewer, config)` 更适合声明式配置。绝大多数 Photo Sphere Viewer 插件都遵循这一模式。

---

## 2. VirtualTour 节点（Node）详解

VirtualTourPlugin 的一切围绕"节点"展开。每个节点对应一个全景图，并携带与其相关联的链接、标记和元数据。

### 2.1 节点核心属性

```js
const nodes = [
  {
    // ========== 必填字段 ==========
    id: 'room-1',                          // 唯一标识，用于节点跳转
    panorama: 'room1.jpg',                 // 全景图URL（支持任意适配器）

    // ========== 展示字段 ==========
    name: '客厅',                           // 短名称（用于链接提示、画廊标签）
    caption: '宽敞明亮的客厅',                // Navbar中显示的标题
    description: '客厅面积约30平方米，南向采光极佳，配落地窗。', // 侧面板描述（点击信息按钮显示）

    // ========== 关联数据 ==========
    links: [                               // 链接列表——指向其他节点的方向箭头
      {
        nodeId: 'room-2',                  // 目标节点ID
        position: { yaw: '45deg', pitch: '0deg' }, // 箭头位置（manual模式必填）
        name: '卧室',                       // 覆盖在链接上的提示名称
        arrowStyle: {                      // 自定义此链接的箭头样式
          color: '#ff4444',
          hoverColor: '#ff8888',
        },
        linkOffset: {                      // 偏移量：移动箭头而不影响旋转目标
          yaw: 0.05,
          pitch: 0,
          depth: 0,
        },
        data: { floor: 1 },                // 自定义数据，可在事件回调中读取
      },
      {
        nodeId: 'room-3',
        position: { textureX: 3000, textureY: 800 }, // 也可用纹理坐标定位
      },
    ],

    // ========== 可选增强 ==========
    markers: [                             // 节点专属标记（配合MarkersPlugin）
      {
        id: 'sofa-tag',
        position: { yaw: '10deg', pitch: '-5deg' },
        html: '真皮沙发',
        style: { color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '4px 10px' },
      },
    ],
    thumbnail: 'thumb-room1.jpg',          // 画廊缩略图
    gps: [116.397128, 39.916527],          // GPS坐标 [经度, 纬度, 海拔?]
    panoData: {                            // 全景数据（覆盖Viewer级别panoData）
      fullWidth: 8192,
      fullHeight: 4096,
    },
    sphereCorrection: {                    // 球面校正
      pan: 0,
      tilt: 0,
      roll: 0,
    },
    showInGallery: true,                   // 是否在画廊中显示（默认true）
  },
];
```

### 2.2 链接（Link）配置详解

Link 是连接两个节点的桥梁。它在场景中以可交互的箭头（或增强标记）形式出现。

| 属性 | 类型 | 说明 |
|------|------|------|
| `nodeId` | `string` | **必填**，目标节点的唯一ID |
| `position` | `{ yaw, pitch }` 或 `{ textureX, textureY }` | manual模式下**必填**，链接在球面上的位置 |
| `gps` | `[number, number, number?]` | GPS模式下**必填**（server模式），目标节点的GPS坐标 |
| `name` | `string` | 链接上显示的提示文本（覆盖目标节点的name） |
| `linkOffset` | `{ yaw?, pitch?, depth? }` | 箭头位置偏移，`depth`可用于3D模式下的遮挡处理 |
| `arrowStyle` | `object` | 覆盖全局arrowStyle，为此链接定制箭头外观 |
| `data` | `any` | 附加的自定义数据 |

关于坐标系统：

- **球面坐标 `{ yaw, pitch }`**：`yaw` 为水平旋转角（弧度或角度字符串如 `'45deg'`），`pitch` 为垂直仰角。`yaw=0` 为正前方，正值向右。
- **纹理坐标 `{ textureX, textureY }`**：基于全景图像素的平面坐标，左上角为原点。常用于从全景像素位置反推标记点。

---

## 3. 两种定位模式对比

VirtualTourPlugin 支持两种链接定位策略，通过 `positionMode` 配置切换。

### 3.1 Manual 模式（手动定位）

```js
VirtualTourPlugin.withConfig({
  positionMode: 'manual',      // 默认值
  nodes: [
    {
      id: 'node-1',
      panorama: 'pano1.jpg',
      links: [
        {
          nodeId: 'node-2',
          position: { yaw: '90deg', pitch: '5deg' },  // 必须手动指定位置
        },
      ],
    },
  ],
})
```

适用场景：

- 全景图之间无地理坐标关联（室内看房、展厅漫游）；
- 需要精确控制每个箭头的位置和朝向；
- 节点数量较少，手工标注工作量可接受。

### 3.2 GPS 模式（自动定位）

```js
VirtualTourPlugin.withConfig({
  positionMode: 'gps',         // 通过GPS坐标自动计算方向和距离
  nodes: [
    {
      id: 'node-1',
      panorama: 'street-1.jpg',
      gps: [-80.156479, 25.666725],                 // 本节点的GPS坐标
      links: [
        {
          nodeId: 'node-2',
          gps: [-80.156168, 25.666623],              // 目标节点的GPS坐标（server模式必填）
        },
      ],
    },
  ],
})
```

插件会根据两个节点的GPS坐标自动计算方位角（bearing）和俯仰角，无需手动指定 `position`。GPS坐标格式为 `[longitude, latitude, altitude?]`。

适用场景：

- 街景漫游（每个拍摄点有GPS记录）；
- 大范围户外场景（校园、景区、城市街道）；
- 节点数量庞大，手工标注不现实。

注意：GPS模式下，在 `server` 数据模式的链接中必须提供目标节点的 `gps` 坐标，否则插件无法在未加载目标节点的情况下计算箭头位置。

---

## 4. 两种渲染模式

`renderMode` 决定链接箭头以何种方式呈现。

### 4.1 2D 模式

```js
VirtualTourPlugin.withConfig({
  renderMode: '2d',
  arrowStyle: {
    color: 'rgba(255, 255, 255, 0.8)',
    hoverColor: 'rgba(255, 255, 255, 1)',
    size: 40,
    scale: [1, 1.5],        // [最小缩放, 最大缩放]
    opacity: 0.9,
  },
})
```

- 箭头渲染为屏幕空间的2D叠加层（CSS/Canvas元素）；
- 随视角移动，与3D场景无遮挡冲突；
- 性能开销更低；
- 不支持 `depth` 偏移，不能嵌入3D几何。

`arrowStyle` 在2D模式下常用配置：

| 属性 | 类型 | 说明 |
|------|------|------|
| `color` | `string` | 箭头颜色 |
| `hoverColor` | `string` | 悬停时的颜色 |
| `size` | `number` | 箭头尺寸（像素） |
| `scale` | `[min, max]` | 基于距离的缩放范围 |
| `opacity` | `number` | 不透明度（0~1） |

### 4.2 3D 模式（默认）

```js
VirtualTourPlugin.withConfig({
  renderMode: '3d',          // 默认值
  arrowStyle: {
    color: '#00aa00',
    hoverColor: '#00ff00',
    scale: 0.4,              // 3D缩放因子（不是像素）
    opacity: 0.8,
  },
  arrowsPosition: {
    minPitch: 0.3,           // 箭头最小垂直角度
    maxPitch: Math.PI / 2,   // 箭头最大垂直角度
    linkOverlapAngle: Math.PI / 4, // 箭头靠太近时自动透明化处理的阈值角
  },
})
```

- 箭头作为3D对象嵌入场景，与全景球面保持正确的透视关系；
- 支持 `linkOffset.depth` 处理重叠箭头；
- 视觉效果更自然，适合追求沉浸感的项目；
- 渲染开销略高于2D模式。

### 4.3 选择建议

| 维度 | 2D 模式 | 3D 模式 |
|------|---------|---------|
| 性能 | 更好 | 一般 |
| 视觉一致性 | 屏幕固定大小，可能显得突兀 | 随场景缩放，更自然 |
| 重叠处理 | 不支持depth | 支持depth偏移 |
| 推荐场景 | 低端设备、需高度自定义CSS样式 | 沉浸式漫游、看房应用 |

---

## 5. 两种数据加载模式

### 5.1 Client 模式

```js
VirtualTourPlugin.withConfig({
  dataMode: 'client',        // 默认值
  nodes: [ /* 所有节点一次性提供 */ ],
})
```

所有节点数据在初始化或调用 `setNodes()` 时一次性传入，事件和导航完全在本地完成。适合节点数量较少（< 20 个）的场景。

```js
// 注册后通过 setNodes 批量设置
virtualTour.setNodes([
  { id: 'room-1', panorama: 'room1.jpg', links: [ /* ... */ ] },
  { id: 'room-2', panorama: 'room2.jpg', links: [ /* ... */ ] },
], 'room-1'); // 第二个参数指定起始节点
```

### 5.2 Server 模式

```js
VirtualTourPlugin.withConfig({
  dataMode: 'server',
  startNodeId: 'node-1',     // server模式必填
  getNode: async (nodeId) => {
    const response = await fetch(`/api/nodes/${nodeId}`);
    return await response.json();
  },
})
```

每次跳转到新节点时，插件调用 `getNode(nodeId)` 异步获取节点数据。只在需要时加载，网络开销可控。

适用场景：

- 节点数量庞大（成百上千个），无法一次性传输；
- 节点数据变化频繁，需要实时获取最新数据；
- 配合后端权限控制，按用户角色动态返回可访问的节点。

`getNode` 必须返回完整的 `VirtualTourNode` 对象（包括 `links` 数组）。在GPS + server模式下，每个链接中必须包含目标节点的 `gps` 坐标。

---

## 6. VirtualTourPlugin 方法与事件

### 6.1 核心方法

```js
// 获取当前所在节点
const currentNode = virtualTour.getCurrentNode();
console.log(currentNode.id, currentNode.name);

// 跳转到指定节点（带动画过渡）
await virtualTour.setCurrentNode('room-2');
// 或覆盖过渡配置
await virtualTour.setCurrentNode('room-2', { speed: '30rpm', effect: 'fade' });
// forceUpdate: 重新加载当前节点（server模式清除缓存后重新拉取）
await virtualTour.setCurrentNode('room-1', { forceUpdate: true });

// 平滑旋转视角对准某个链接（不跳转）
await virtualTour.gotoLink('room-3');
// 可选速度参数，默认 '8rpm'
await virtualTour.gotoLink('room-3', '4rpm');

// 获取指定链接在当前视角中的位置
const linkPos = virtualTour.getLinkPosition('room-2');
console.log(linkPos.yaw, linkPos.pitch);

// (client模式) 批量设置节点
virtualTour.setNodes(newNodes, 'start-node-id');

// (client模式) 更新单个节点
virtualTour.updateNode({
  id: 'room-1',
  caption: '更新后的标题',
  links: [ /* 新的链接列表 */ ],
});
```

### 6.2 过渡动画配置

`transitionOptions` 控制节点切换时的过渡效果：

```js
VirtualTourPlugin.withConfig({
  transitionOptions: {
    showLoader: true,        // 显示加载动画
    speed: '20rpm',          // 过渡速度（或毫秒数）
    effect: 'fade',          // 'fade' | 'none'
    rotation: true,          // 是否自动转向下一个节点方向
  },
})
```

也支持回调函数，根据前后节点动态决定过渡参数：

```js
transitionOptions: (toNode, fromNode, fromLink) => {
  return {
    showLoader: toNode.id === 'room-5', // 只在跳转到特定节点时显示加载器
    speed: '30rpm',
    effect: 'fade',
    rotation: !!fromLink,               // 从链接点击时旋转，手动setCurrentNode时不旋转
  };
}
```

### 6.3 事件监听

VirtualTourPlugin 抛出三组事件：`node-changed`、`enter-arrow`、`leave-arrow`。

```js
// 节点切换事件——最核心的事件
virtualTour.addEventListener('node-changed', ({ node, data }) => {
  console.log(`当前节点：${node.id}（${node.name}）`);

  if (data.fromNode) {
    console.log(`上一个节点：${data.fromNode.id}`);
    console.log(`通过链接：${data.fromLink?.nodeId}`);
    console.log(`链接位置：yaw=${data.fromLinkPosition.yaw}, pitch=${data.fromLinkPosition.pitch}`);
  }

  // 常见用途：
  // - 更新UI中的房间名称、面包屑导航
  // - 发送统计埋点（用户访问了哪个房间）
  // - 根据当前节点切换背景音乐或环境音效
});

// 鼠标进入箭头
virtualTour.addEventListener('enter-arrow', ({ link, node }) => {
  console.log(`用户悬停在通往 ${link.nodeId} 的箭头上`);
});

// 鼠标离开箭头
virtualTour.addEventListener('leave-arrow', ({ link, node }) => {
  console.log(`用户移开了通往 ${link.nodeId} 的箭头`);
});
```

`NodeChangedEvent` 的 `data` 对象包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `fromNode` | `VirtualTourNode` | 跳转前的节点（首次进入时为 undefined） |
| `fromLink` | `VirtualTourLink` | 触发跳转的链接对象（手动调用setCurrentNode时为 undefined） |
| `fromLinkPosition` | `Position` | 链接在球面上的位置坐标 |

---

## 7. VirtualTour 完整实战示例

以下示例构建一个室内看房虚拟漫游，包含客厅→卧室→厨房→阳台四个节点，使用3D箭头模式。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>虚拟看房 - Photo Sphere Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    #viewer { width: 100vw; height: 100vh; }

    /* 房间信息面板 */
    .room-info {
      position: absolute;
      bottom: 60px;
      left: 20px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 100;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .room-info .name { font-size: 18px; font-weight: bold; }
    .room-info .desc { margin-top: 4px; opacity: 0.8; }

    /* 房间导航列表 */
    .room-nav {
      position: absolute;
      top: 70px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 8px;
      padding: 10px 0;
      z-index: 100;
    }
    .room-nav button {
      display: block;
      width: 140px;
      padding: 8px 16px;
      background: none;
      border: none;
      color: #ccc;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
    }
    .room-nav button:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
    .room-nav button.active { color: #4fc3f7; background: rgba(79, 195, 247, 0.15); }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <div class="room-info" id="roomInfo">
    <div class="name" id="roomName"></div>
    <div class="desc" id="roomDesc"></div>
  </div>
  <div class="room-nav" id="roomNav"></div>

  <script type="module">
    import { Viewer } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/index.module.js';
    import { VirtualTourPlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/virtual-tour-plugin@5/index.module.js';
    import { MarkersPlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@5/index.module.js';

    const BASE = 'https://photo-sphere-viewer-data.netlify.app/assets/';

    // ============================================================
    // 节点数据定义
    // ============================================================
    const nodes = [
      {
        id: 'living-room',
        panorama: BASE + 'sphere.jpg',
        thumbnail: BASE + 'sphere-small.jpg',
        name: '客厅',
        caption: '客厅 - 第一人称漫游',
        description: '宽敞明亮的客厅，面积约35平方米，南向采光。配备真皮沙发和65寸智慧屏。',
        markers: [
          {
            id: 'tag-sofa',
            position: { yaw: '20deg', pitch: '-3deg' },
            html: '<div style="color:#fff;background:rgba(0,0,0,0.7);padding:4px 10px;border-radius:4px;">真皮沙发组合</div>',
            anchor: 'bottom center',
          },
          {
            id: 'tag-tv',
            position: { yaw: '-30deg', pitch: '2deg' },
            html: '<div style="color:#fff;background:rgba(255,100,0,0.8);padding:4px 10px;border-radius:4px;">65寸智慧屏</div>',
            anchor: 'bottom center',
          },
        ],
        links: [
          {
            nodeId: 'bedroom',
            position: { yaw: '90deg', pitch: '2deg' },
            name: '前往卧室',
          },
          {
            nodeId: 'kitchen',
            position: { yaw: '-25deg', pitch: '-2deg' },
            name: '前往厨房',
          },
        ],
      },
      {
        id: 'bedroom',
        panorama: BASE + 'sphere-test.jpg',
        thumbnail: BASE + 'sphere-test.jpg',
        name: '主卧',
        caption: '主卧室 - 温馨舒适',
        description: '主卧配备1.8米大床和步入式衣帽间，采光良好。',
        markers: [
          {
            id: 'tag-bed',
            position: { yaw: '0deg', pitch: '-8deg' },
            html: '<div style="color:#fff;background:rgba(0,0,0,0.7);padding:4px 10px;border-radius:4px;">1.8m 实木大床</div>',
            anchor: 'bottom center',
          },
        ],
        links: [
          {
            nodeId: 'living-room',
            position: { yaw: '-90deg', pitch: '-2deg' },
            name: '返回客厅',
          },
          {
            nodeId: 'balcony',
            position: { yaw: '30deg', pitch: '0deg' },
            name: '前往阳台',
          },
        ],
      },
      {
        id: 'kitchen',
        panorama: BASE + 'sphere.jpg',
        thumbnail: BASE + 'sphere-small.jpg',
        name: '厨房',
        caption: '开放式厨房',
        description: '现代化开放式厨房，配备嵌入式烤箱、洗碗机和双开门冰箱。',
        markers: [
          {
            id: 'tag-fridge',
            position: { yaw: '-10deg', pitch: '0deg' },
            html: '<div style="color:#fff;background:rgba(0,0,0,0.7);padding:4px 10px;border-radius:4px;">双开门冰箱</div>',
            anchor: 'bottom center',
          },
        ],
        links: [
          {
            nodeId: 'living-room',
            position: { yaw: '25deg', pitch: '2deg' },
            name: '返回客厅',
          },
        ],
      },
      {
        id: 'balcony',
        panorama: BASE + 'sphere-test.jpg',
        thumbnail: BASE + 'sphere-test.jpg',
        name: '阳台',
        caption: '观景阳台',
        description: '超大观景阳台，可俯瞰小区花园，适合午后品茶小憩。',
        markers: [],
        links: [
          {
            nodeId: 'bedroom',
            position: { yaw: '-30deg', pitch: '0deg' },
            name: '返回卧室',
          },
        ],
      },
    ];

    // ============================================================
    // 初始化 Viewer
    // ============================================================
    const viewer = new Viewer({
      container: document.querySelector('#viewer'),
      plugins: [
        MarkersPlugin,
        VirtualTourPlugin.withConfig({
          dataMode: 'client',
          positionMode: 'manual',
          renderMode: '3d',
          transitionOptions: {
            showLoader: true,
            speed: '30rpm',
            effect: 'fade',
            rotation: true,
          },
          arrowStyle: {
            color: '#4fc3f7',
            hoverColor: '#81d4fa',
            scale: 0.45,
          },
          arrowsPosition: {
            minPitch: 0.2,
            maxPitch: Math.PI / 2.5,
          },
          nodes: nodes,
        }),
      ],
    });

    const virtualTour = viewer.getPlugin(VirtualTourPlugin);

    // ============================================================
    // 构建房间导航按钮
    // ============================================================
    const roomNav = document.querySelector('#roomNav');
    const roomNames = ['客厅', '主卧', '厨房', '阳台'];
    const roomIds = ['living-room', 'bedroom', 'kitchen', 'balcony'];

    roomNames.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.dataset.nodeId = roomIds[i];
      btn.addEventListener('click', () => {
        virtualTour.setCurrentNode(roomIds[i]);
      });
      roomNav.appendChild(btn);
    });

    // ============================================================
    // 事件处理：更新UI
    // ============================================================
    const roomNameEl = document.querySelector('#roomName');
    const roomDescEl = document.querySelector('#roomDesc');

    const updateUI = (node) => {
      roomNameEl.textContent = node.name;
      roomDescEl.textContent = node.description || '';

      // 高亮当前房间按钮
      document.querySelectorAll('.room-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nodeId === node.id);
      });
    };

    // 监听节点切换
    virtualTour.addEventListener('node-changed', ({ node, data }) => {
      updateUI(node);

      console.log(`[Tour] 切换到 ${node.name}`);
      if (data.fromNode) {
        console.log(`[Tour] 来自 ${data.fromNode.name}，通过链接 ${data.fromLink?.nodeId || '手动跳转'}`);
      }
    });

    // 初始UI更新
    const initNode = virtualTour.getCurrentNode();
    if (initNode) updateUI(initNode);
  </script>
</body>
</html>
```

在这个示例中，我们构建了一个完整的交互式看房场景。左侧底部的信息面板实时跟随节点切换更新房间名称和描述；右侧的导航列表允许用户直接点击按钮跳转到任意房间；3D箭头提供了空间中的方向指示。`virtualTour.getCurrentNode()` 获取当前节点，`node-changed` 事件驱动UI更新。

---

## 8. GalleryPlugin 详解

GalleryPlugin 位于 viewer 底部，以水平缩略图条带的形式展示可切换的全景图列表。它既可作为独立的缩略图导航工具，也能与 VirtualTourPlugin 配合使用——当 VirtualTourPlugin 注册后，GalleryPlugin 自动同步节点列表为画廊项，无需手动配置。

### 8.1 安装

```bash
npm install @photo-sphere-viewer/gallery-plugin
```

```js
import { GalleryPlugin } from '@photo-sphere-viewer/gallery-plugin';
import '@photo-sphere-viewer/gallery-plugin/index.css';
```

> 注意：GalleryPlugin 与 ResolutionPlugin 不兼容，二者不要同时使用。

### 8.2 配置参数

```js
const viewer = new Viewer({
  plugins: [
    GalleryPlugin.withConfig({
      items: [                             // 画廊项目列表
        {
          id: 'pano-1',                    // 唯一标识
          panorama: 'path/to/pano-1.jpg',  // 全景图
          thumbnail: 'path/to/thumb-1.jpg',// 缩略图URL
          name: '全景一',                   // 缩略图上方的标签文本
          options: {                       // 切换到该项目时的额外setPanorama选项
            caption: '全景一 - 自定义标题',
            description: '这是全景一的详细描述。',
          },
        },
        {
          id: 'pano-2',
          panorama: 'path/to/pano-2.jpg',
          thumbnail: 'path/to/thumb-2.jpg',
          name: '全景二',
        },
      ],
      visibleOnLoad: false,               // 首屏是否显示画廊（默认false）
      hideOnClick: true,                  // 点击缩略图后是否自动隐藏画廊
      thumbnailSize: { width: 200, height: 120 }, // 缩略图尺寸（默认200x100）
      navigationArrows: true,             // 是否显示左右导航箭头（默认true）
    }),
  ],
});
```

**`hideOnClick` 的特别规则**：当屏幕宽度小于 500px 时，该选项强制设为 `true`——在手机上点击缩略图后画廊必然自动收起，避免遮挡视野。

### 8.3 独立使用 GalleryPlugin

在不配合 VirtualTourPlugin 时，画廊完全独立运作：

```js
const gallery = viewer.getPlugin(GalleryPlugin);

// 显示/隐藏画廊
gallery.show();
gallery.hide();
gallery.toggle();

// 检查可见性
if (gallery.isVisible()) { /* ... */ }

// 替换全部项目
gallery.setItems([
  { id: 'a', panorama: 'a.jpg', thumbnail: 'a-thumb.jpg', name: '场景A' },
  { id: 'b', panorama: 'b.jpg', thumbnail: 'b-thumb.jpg', name: '场景B' },
]);

// 动态更新缩略图尺寸
gallery.setOption('thumbnailSize', { width: 150, height: 90 });
```

画廊项目（`GalleryItem`）的完整结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 必需，唯一标识 |
| `panorama` | `any` | 必需，全景图（与Viewer的`panorama`参数格式一致） |
| `thumbnail` | `string` | 缩略图URL |
| `name` | `string` | 缩略图下方显示的文本标签 |
| `options` | `PanoramaOptions` | 切换到该项时传递给 `setPanorama` 的额外参数（如 `caption`, `description`） |

---

## 9. GalleryPlugin 代码示例

### 9.1 独立的缩略图画廊

```js
import { Viewer } from '@photo-sphere-viewer/core';
import { GalleryPlugin } from '@photo-sphere-viewer/gallery-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/gallery-plugin/index.css';

const viewer = new Viewer({
  container: document.querySelector('#viewer'),
  plugins: [
    GalleryPlugin.withConfig({
      visibleOnLoad: true,     // 加载后立即显示画廊
      hideOnClick: false,      // 点击不自动隐藏
      thumbnailSize: { width: 180, height: 110 },
      items: [
        {
          id: 'merc',
          panorama: 'https://photo-sphere-viewer-data.netlify.app/assets/sphere.jpg',
          thumbnail: 'https://photo-sphere-viewer-data.netlify.app/assets/sphere-small.jpg',
          name: 'Mercantour',
          options: {
            caption: 'Parc national du Mercantour <b>(C) Damien Sorel</b>',
          },
        },
        {
          id: 'key',
          panorama: 'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-1.jpg',
          thumbnail: 'https://photo-sphere-viewer-data.netlify.app/assets/tour/key-biscayne-1-thumb.jpg',
          name: 'Key Biscayne',
          options: {
            caption: 'Cape Florida Light <b>(C) Pixexid</b>',
          },
        },
      ],
    }),
  ],
});
```

### 9.2 动态加载画廊项

在一些场景中，画廊项需要根据用户行为或API响应动态设置：

```js
const gallery = viewer.getPlugin(GalleryPlugin);

async function loadGalleryFromAPI() {
  const response = await fetch('/api/panoramas');
  const data = await response.json();

  gallery.setItems(data.map(item => ({
    id: item.slug,
    panorama: item.fullUrl,
    thumbnail: item.thumbUrl,
    name: item.title,
    options: {
      caption: item.title,
      description: item.description,
    },
  })));
}

// 初始化后异步加载
viewer.addEventListener('ready', () => {
  loadGalleryFromAPI();
  gallery.show();
});
```

### 9.3 与 setPanorama 配合

画廊的核心价值在于让用户通过视觉化的缩略图自由选择全景。点击缩略图时，内部自动调用 `viewer.setPanorama()`，并应用 `options` 中的配置。

如果需要监听切换事件，可以在 Viewer 上注册：

```js
viewer.addEventListener('panorama-loaded', (e) => {
  console.log('全景图加载完成：', e.data.panorama);
  // 可在此更新面包屑、标题等UI元素
});
```

---

## 10. VirtualTour + Gallery + Markers 组合实战

三个插件协同工作是 Photo Sphere Viewer 最典型的应用模式。下面给出一个精简但完整的组合示例，展示三者如何自然衔接。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>看房漫游 - 完整版</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    #viewer { width: 100vw; height: 100vh; }
    .breadcrumb {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0,0,0,0.65);
      color: #fff;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <div class="breadcrumb" id="breadcrumb">当前位置：客厅</div>

  <script type="module">
    import { Viewer } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/index.module.js';
    import { VirtualTourPlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/virtual-tour-plugin@5/index.module.js';
    import { GalleryPlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/gallery-plugin@5/index.module.js';
    import { MarkersPlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@5/index.module.js';

    const BASE = 'https://photo-sphere-viewer-data.netlify.app/assets/';

    const viewer = new Viewer({
      container: document.querySelector('#viewer'),
      plugins: [
        MarkersPlugin,
        VirtualTourPlugin.withConfig({
          dataMode: 'client',
          positionMode: 'manual',
          renderMode: '3d',
          transitionOptions: { showLoader: true, speed: '25rpm', effect: 'fade', rotation: true },
          arrowStyle: { color: '#4fc3f7', hoverColor: '#81d4fa', scale: 0.4 },
          nodes: [
            {
              id: 'living',
              panorama: BASE + 'sphere.jpg',
              name: '客厅',
              caption: '客厅',
              thumbnail: BASE + 'sphere-small.jpg',
              markers: [
                { id: 'poi-1', position: { yaw: '20deg', pitch: '-5deg' }, html: '沙发区', anchor: 'bottom center' },
              ],
              links: [
                { nodeId: 'bedroom', position: { yaw: '85deg', pitch: '0deg' }, name: '卧室' },
                { nodeId: 'kitchen', position: { yaw: '-30deg', pitch: '-2deg' }, name: '厨房' },
              ],
            },
            {
              id: 'bedroom',
              panorama: BASE + 'sphere-test.jpg',
              name: '主卧',
              caption: '主卧',
              thumbnail: BASE + 'sphere-test.jpg',
              markers: [
                { id: 'poi-2', position: { yaw: '0deg', pitch: '-8deg' }, html: '大床', anchor: 'bottom center' },
              ],
              links: [
                { nodeId: 'living', position: { yaw: '-85deg', pitch: '0deg' }, name: '客厅' },
              ],
            },
            {
              id: 'kitchen',
              panorama: BASE + 'sphere.jpg',
              name: '厨房',
              caption: '厨房',
              thumbnail: BASE + 'sphere-small.jpg',
              markers: [
                { id: 'poi-3', position: { yaw: '0deg', pitch: '-3deg' }, html: '料理台', anchor: 'bottom center' },
              ],
              links: [
                { nodeId: 'living', position: { yaw: '30deg', pitch: '2deg' }, name: '客厅' },
              ],
            },
          ],
        }),
        GalleryPlugin.withConfig({
          visibleOnLoad: true,
          hideOnClick: false,
          thumbnailSize: { width: 180, height: 110 },
        }),
      ],
    });

    const virtualTour = viewer.getPlugin(VirtualTourPlugin);

    // 面包屑导航
    const breadcrumb = document.querySelector('#breadcrumb');
    virtualTour.addEventListener('node-changed', ({ node }) => {
      breadcrumb.textContent = `当前位置：${node.name}`;
    });

    // 标记点击处理
    const markersPlugin = viewer.getPlugin(MarkersPlugin);
    markersPlugin.addEventListener('select-marker', ({ marker }) => {
      console.log(`点击了标记：${marker.id}`);
    });
  </script>
</body>
</html>
```

这个组合示例中：

1. **GalleryPlugin** 自动从 VirtualTourPlugin 的节点列表中提取 `name`、`thumbnail` 生成画廊缩略图；用户点击缩略图或3D箭头均可切换房间；
2. **VirtualTourPlugin** 负责房间节点之间的空间关联和箭头渲染；
3. **MarkersPlugin** 为每个房间提供POI标记——切换房间时，标记随节点自动替换；
4. 顶部面包屑由 `node-changed` 事件实时更新。

三者之间的数据流是自动的：`VirtualTourPlugin.setNodes()` 之后，插件内部会调用 `GalleryPlugin.setItems()` 和 `MarkersPlugin` 的相关方法同步数据。你无需手动桥接。

---

## 11. 节点预加载策略

当用户在房间之间切换时，如果全景图体积较大，首次加载可能出现短暂白屏或加载动画。VirtualTourPlugin 提供了 `preload` 配置来预先加载相邻节点，使跳转更流畅。

```js
VirtualTourPlugin.withConfig({
  // 预加载当前节点的所有相邻节点（默认false）
  preload: true,

  // 或使用函数精确控制预加载
  preload: (node, link) => {
    // 只预加载同一楼层的房间
    return node.data?.floor === link.data?.targetFloor;

    // 或只预加载前3个链接
    // const idx = node.links.indexOf(link);
    // return idx < 3;
  },
})
```

每当进入一个新节点，插件自动遍历其 `links` 数组，对 `preload` 判定为 `true` 的目标节点提前发起全景图加载。当用户点击该链接时，如果全景图已预加载完成，切换将是即时的。

注意：`preload` 会同时发起多个全景图请求，对于移动网络或全景图体积较大的场景，建议配合 `(node, link) => boolean` 回调做选择性预加载。

---

## 12. 本章小结

VirtualTourPlugin 与 GalleryPlugin 构成了 Photo Sphere Viewer 的多全景管理能力：

- **VirtualTourPlugin** 将分散的全景图组织为有向图，通过3D/2D箭头和GPS/手动定位实现空间导航，支持client和server两种数据加载模式；
- **GalleryPlugin** 以缩略图画廊的方式提供视觉化的全景切换入口，天然适配任意多全景场景；
- 两者配合 MarkersPlugin 可构建完善的虚拟漫游体验——节点携带标记、画廊展示缩略图、箭头连接空间，三者的数据流完全自动化。

关键决策速查：

| 决策项 | 选项 | 何时选择 |
|--------|------|----------|
| 数据模式 | `client` | 节点数 < 20，全部在一处定义 |
| 数据模式 | `server` | 节点数庞大或需后端权限控制 |
| 定位模式 | `manual` | 室内场景，无GPS数据，需精确控制 |
| 定位模式 | `gps` | 街景/户外，有坐标数据 |
| 渲染模式 | `3d` | 沉浸式体验（推荐默认） |
| 渲染模式 | `2d` | 低端设备或需自定义CSS外观 |
| 画廊隐藏 | `hideOnClick: true` | 移动端优先，点击即隐藏 |
| 画廊隐藏 | `hideOnClick: false` | 桌面端，保留画廊供连续浏览 |
| 预加载 | `true` | 全景图体积小，WiFi环境 |
| 预加载 | 函数模式 | 精确控制哪些相邻节点预加载 |

下一章将介绍视频全景的播放与移动端交互适配。

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/Photo-Sphere-Viewer/第06章-插件体系架构与自定义插件开发/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/3d/Photo-Sphere-Viewer/第08章-视频全景与移动端交互/" style="text-decoration: none;">下一章 →</a>
</div>
