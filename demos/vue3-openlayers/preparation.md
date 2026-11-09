---
layout: default
title: 课程知识准备
---

# 课程知识准备

这个演示项目横跨前端和 GIS 两块，缺哪边都会卡住。下面把需要先补的知识按“必须先会”和“用到再查”分开放，免得一开始就陷入大海捞针。

**必须先会的**：HTML/CSS 能看懂常见标签和布局，JavaScript 熟悉数组方法、异步（Promise、async/await）和模块化，Vue 3 会用组合式 API 写组件、会用 `ref`/`reactive`/`computed`。这些不过关，看地图组件里的响应式更新会一头雾水。

**用到再查的**：OpenLayers 的 Map、View、Layer、Source、Interaction 这几个核心对象，GeoServer 的 WMS/WMTS/WFS 服务类型，以及 PostGIS 的基本 SQL。项目初期只需要弄清楚“地图由哪些对象搭起来”，细节可以边做边补。

按下面的顺序补最快：HTML 和 CSS 过一遍语法，重点看 Flex 布局；JavaScript 把异步和数组方法吃透；Vue 3 官方教程的“基础”和“组合式 API”两章必看；OpenLayers 先看官方 Quick Start，把地图、图层、视图三个概念立起来；`vue3-openlayers` 的文档在 OpenLayers 之后看，它只是把前者包了一层。


1. [HTML5基础教程](https://www.runoob.com/html/html5-intro.html)
2. [CSS3基础教程](https://www.runoob.com/css3/css3-tutorial.html)
3. [JavaScript基础教程](https://www.runoob.com/js/js-tutorial.html)
4. [HTML DOM基础教程](https://www.runoob.com/htmldom/htmldom-tutorial.html)
5. [VUE3基础教程](https://www.runoob.com/vue3/vue3-tutorial.html)
6. [Element Plus](https://element-plus.org/zh-CN/#/zh-CN)
7. [OpenLayers](https://openlayers.org/)
8. [vue3-openlayers](https://vue3openlayers.netlify.app/)

## 学习节奏建议

这套演示项目最怕的是一头扎进 OpenLayers 的 API 里。地图类库的对象模型和前端框架的响应式模型叠在一起，学的时候两边都不熟，很容易写出一堆能跑但看不懂的代码。

比较顺的节奏是先用两三天把 Vue 3 的组合式 API 写熟：组件、props、ref、computed、watch、生命周期各写一个小例子。这一步不需要地图知识，纯粹练手。接着花一天看 OpenLayers 的官方 Quick Start 和 Map、View、Layer、Source 四个概念，能在页面上加一个 OSM 底图就算过关。最后再进 vue3-openlayers，重点不是背组件属性，而是理解它把 OpenLayers 的哪个对象映射成了哪个组件。

GeoServer 和 PostGIS 不必提前学。前端先把地图跑起来，用公开的 XYZ 瓦片服务当数据源；等页面骨架稳定了，再去装服务环境、发自己的图层。顺序反过来会让环境问题掩盖前端问题，排查起来很费劲。

遇到查不到的问题时，先分清是前端渲染问题还是服务数据问题：浏览器控制台报错、地图空白、请求 404，这三类现象的排查路径完全不同，混在一起看只会越查越乱。


## 动手前的检查清单

真正开始写代码前，花十分钟把环境过一遍，能少踩很多坑：Node 版本确认在 18 以上；npm 能正常装包，必要时先换国内源；浏览器开发者工具打开 Network 面板，方便后面看瓦片和服务请求；再准备一个能看 GeoServer 管理页的账号。前端开发不需要装 GIS 桌面软件，QGIS 只是用来核对数据对不对时顺手看一下。

把这几件事做完，再回头看资料列表就不至于停在“装环境”阶段反复折腾。

## 资料说明

上面列表里的链接按学习顺序排好了：前五项是前端基础，第六项是常用 UI 组件库，最后两项是地图库本身。

- 菜鸟教程适合快速过语法，遇到版本差异（比如 Vue 3 的选项式与组合式写法）以官方文档为准。
- Element Plus 是 Vue 3 的组件库，项目里的树形控件、弹窗、表单都会用到，重点看 Tree、Dialog、Form 三块的示例。
- [OpenLayers 官网](https://openlayers.org/) 的例子页比 API 文档更好用，想实现某个效果先去 Examples 里找相近的。
- [vue3-openlayers](https://vue3openlayers.netlify.app/) 的文档按组件组织，查组件属性比翻源码快。

这些资料不用全看完再动手。先把 Vue 3 和 OpenLayers 的基础示例跑通，其余的遇到问题再查，效率比通读高得多。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/demos/vue3-openlayers/vue3-openlayers基础知识简介/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/demos/vue3-openlayers/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/demos/vue3-openlayers/functional-requirement/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->
