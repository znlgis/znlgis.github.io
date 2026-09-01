---
layout: default
title: 第04章 核心组件 PsvContainer 详解
---

# 第04章 核心组件 PsvContainer 详解

## 4.1 组件职责

`PsvContainer.vue` 是项目中最核心的组件，它是**唯一与 Photo Sphere Viewer 直接交互**的组件。它的职责是：

1. 封装 PSV Viewer 的完整生命周期（创建、更新、销毁）
2. 配置并管理两个插件：MarkersPlugin（全景标记）和 PlanPlugin（Leaflet 地图）
3. 建立全景标记与地图热点的双向联动
4. 通过 `defineExpose` 暴露语义化接口给父组件调用

组件文件位于 `src/components/PsvContainer.vue`，共 232 行。

## 4.2 Props 与 Emits

### 4.2.1 Props

```typescript
// PsvContainer.vue:18-23
const props = defineProps<{
  scene: Scene                    // 当前场景
  markers: MarkerData[]           // 当前场景的标记列表
  previewMarker?: MarkerData | null  // 待确认的红色脉冲预览 pin
}>()
```

- `scene`：当前场景对象，包含全景图地址、坐标、方位角等信息
- `markers`：当前场景的标记列表
- `previewMarker`：添加标记时的预览 pin（红色脉冲动画），可选

### 4.2.2 Emits

```typescript
// PsvContainer.vue:25-30
const emit = defineEmits<{
  'click-empty': [position: { yaw: number, pitch: number }]  // 点击全景空白处
  'map-pick': [coords: [number, number]]                     // 点击地图选点
  'marker-click': [id: string]                               // 点击全景标记或地图热点
}>()
```

三个事件分别对应三种交互：

- `click-empty`：点击全景空白处（非标记），携带球形坐标 yaw/pitch
- `map-pick`：点击地图选点，携带经纬度坐标
- `marker-click`：点击全景标记或地图热点，携带标记 id

## 4.3 模块级插件实例变量

```typescript
// PsvContainer.vue:32-37
let viewer: Viewer | null = null
let markersPlugin: MarkersPlugin | null = null
let planPlugin: PlanPlugin | null = null
let viewerSceneId: string | null = null  // 记录当前 viewer 绑定的场景
let previewShown = false
```

这些变量在模块级声明，用于在组件的不同生命周期钩子和 watcher 中共享插件实例。

## 4.4 PSV 实例化

### 4.4.1 创建 Viewer

```typescript
// PsvContainer.vue:39-122
viewer = new Viewer({
  container: containerRef.value,
  panorama: props.scene.panorama,
  caption: props.scene.name,
  loadingImg: BASE_URL + 'loader.gif',
  navbar: ['zoom', 'fullscreen', 'caption', 'markers', 'markersList'],
  lang: { /* 全中文 UI 文案 */ },
  plugins: [
    PlanPlugin.withConfig({
      coordinates: props.scene.coordinates,
      bearing: props.scene.bearing,
      defaultZoom: props.scene.defaultZoom,
      size: { width: 'min(300px, 72vw)', height: 'min(300px, 34vh)' },
      position: 'bottom left',
      visibleOnLoad: true,
    }),
    MarkersPlugin.withConfig({
      markers: props.markers.map(toPsvMarkerConfig),
    }),
  ],
})
```

关键配置说明：

- **container**：PSV 挂载的 DOM 容器
- **panorama**：全景图片地址
- **caption**：全景标题（显示在导航栏）
- **loadingImg**：加载动画
- **navbar**：导航栏按钮，包括缩放、全屏、标题、标记列表
- **lang**：全中文 UI 文案
- **plugins**：配置两个插件

### 4.4.2 PlanPlugin 配置

PlanPlugin 用于嵌入 Leaflet 地图：

- `coordinates`：地图中心坐标
- `bearing`：地图方位角（与全景视角对齐）
- `defaultZoom`：默认缩放级别
- `size`：地图面板尺寸（响应式）
- `position`：面板位置（左下角）
- `visibleOnLoad`：加载时可见

> **重要提示**：不要使用 `configureLeaflet` 选项。它的语义是"完全接管 Leaflet 配置"，传入后默认 OSM 底图不会添加，地图会变成灰色空面板。点击监听改为创建后通过 `getLeaflet()` 挂载。

### 4.4.3 MarkersPlugin 配置

MarkersPlugin 用于全景标记：

```typescript
MarkersPlugin.withConfig({
  markers: props.markers.map(toPsvMarkerConfig),
})
```

将标记数据通过 `toPsvMarkerConfig` 转换为 PSV 标记配置格式。

## 4.5 插件获取与事件绑定

### 4.5.1 获取插件实例

```typescript
// PsvContainer.vue:92-118
markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin)
planPlugin = viewer.getPlugin<PlanPlugin>(PlanPlugin)
```

### 4.5.2 地图点击精确选点

```typescript
planPlugin?.getLeaflet().on('click', (e) => {
  emit('map-pick', [e.latlng.lng, e.latlng.lat])
})
```

通过 `getLeaflet()` 获取 Leaflet 地图实例，监听点击事件，将经纬度坐标 emit 出去。

### 4.5.3 全景点击获取位置

```typescript
viewer.addEventListener('click', (e) => {
  if (e.data.marker) return  // 点击标记时不触发
  emit('click-empty', { yaw: e.data.yaw, pitch: e.data.pitch })
})
```

监听全景点击事件，如果点击的是标记则忽略，否则 emit 球形坐标。

### 4.5.4 标记点击事件

```typescript
markersPlugin?.addEventListener('select-marker', ({ marker }) => {
  emit('marker-click', marker.id)
})

planPlugin?.addEventListener('select-hotspot', ({ hotspotId }) => {
  emit('marker-click', hotspotId)
})
```

全景标记点击（`select-marker`）和地图热点点击（`select-hotspot`）都 emit 同一个 `marker-click` 事件，由 App 统一决定是旋转视角还是切换场景。

## 4.6 预览 pin 配置

### 4.6.1 构造预览配置

```typescript
// PsvContainer.vue:134-152
function previewConfig() {
  // 构造一个 id 为 PREVIEW_ID 的红色 pin 标记
  // 同时带 data.plan 让地图上也显示
}
```

### 4.6.2 同步预览

```typescript
// PsvContainer.vue:154-164
function syncPreview() {
  // 先移除旧的预览，再按需添加
}
```

`syncPreview()` 负责预览 pin 的增删：先移除旧的再按需添加，避免重复。

## 4.7 标记刷新

```typescript
// PsvContainer.vue:166-171
function refreshMarkers() {
  markersPlugin?.setMarkers(props.markers.map(toPsvMarkerConfig))
}
```

`refreshMarkers()` 用 `setMarkers()` 全量替换标记。

## 4.8 场景切换 watcher

```typescript
// PsvContainer.vue:175-187
watch(() => props.scene.id, (id) => {
  if (!viewer || viewerSceneId === id) return
  viewerSceneId = id
  planPlugin?.setOptions({ bearing: props.scene.bearing })
  planPlugin?.setCoordinates(props.scene.coordinates)
  planPlugin?.setZoom(props.scene.defaultZoom)
  viewer.setPanorama(props.scene.panorama, {
    caption: props.scene.name,
    showLoader: true,
  })
})
```

**关键设计**：场景切换时**复用 viewer 而非销毁重建**。相比销毁重建，这种方式：

1. 保留 WebGL 上下文
2. 保留 Leaflet 瓦片缓存
3. 切换更快且带过渡动画

标记刷新交给下方的 markers watcher（切场景时 `currentMarkers` 返回新引用必然触发），避免 `setMarkers` 重复执行两次。

## 4.9 标记 watcher

```typescript
// PsvContainer.vue:190-199
watch(() => props.markers, () => {
  // 用 flush: 'post' 增量刷新
}, { flush: 'post' })

watch(() => props.previewMarker, () => {
  // 同步预览
})
```

两个 watcher 都依赖"每次返回新引用"来触发，无需 deep。

## 4.10 生命周期

```typescript
// PsvContainer.vue:201-207
onMounted(() => createViewer())
onUnmounted(() => destroyViewer())
```

- `onMounted`：创建 viewer
- `onUnmounted`：销毁 viewer（`viewer.destroy()` 并置空引用）

## 4.11 暴露接口

```typescript
// PsvContainer.vue:210-218
defineExpose({ gotoMarker, refreshMarkers })
```

通过 `defineExpose` 暴露语义化接口：

- `gotoMarker(id)`：内部调 `markersPlugin?.gotoMarker(id)`，这是**点击标记触发全景旋转**的入口
- `refreshMarkers()`：刷新标记

> **设计要点**：暴露语义化接口，不直接暴露插件实例，保持组件封装性。

## 4.12 组件在整体架构中的位置

```
App.vue
  └── PsvContainer (defineExpose: gotoMarker, refreshMarkers)
        ├── Viewer (全景查看器)
        ├── MarkersPlugin (全景标记)
        └── PlanPlugin (Leaflet 地图)
```

App.vue 通过 `psvRef` 引用 PsvContainer 实例，调用其暴露的 `gotoMarker` 方法实现"点击标记旋转视角"。

## 4.13 下一步

理解了核心组件后，进入 [第05章 全景与地图双向联动机制](https://znlgis.github.io/demos/map-360-demo/第05章-全景与地图双向联动机制/) 深入理解联动原理。
