---
layout: default
title: Demo工程代码创建说明
---

# Demo工程代码创建说明

这一页说明如何从零建一个 Vue 3 + OpenLayers 的演示工程。完整代码在 [GitHub 仓库](https://github.com/znlgis/openlayers-vue3-demo)，本页只走一遍初始化流程，并解释每一步装了什么、为什么装。

工程是 Vite + Vue 3 的单页应用，地图部分用 `vue3-openlayers` 封装，业务请求用 `axios`，少量 Base64 编解码用 `base-64`。依赖都不重，装完就能跑。

前提是 Node.js 18 以上和可用的 npm。Node 版本太低时 Vite 会直接报错，先 `node -v` 确认。


[工程地址](https://github.com/znlgis/openlayers-vue3-demo)

## 1. 创建Vue3工程

`npm create vite@latest` 拉取 Vite 的脚手架，按模板生成项目；`--template vue` 选的是 Vue 的 JavaScript 模板（想要 TypeScript 就把 `vue` 换成 `vue-ts`）。`--` 之后的参数会原样传给脚手架，别漏了这个分隔符。

命令执行后会生成 `openlayers-vue3-demo` 目录，里面有 `index.html`、`src/main.js`、`src/App.vue` 和 `vite.config.js`。进入目录、执行 `npm install` 装基础依赖，再用 `npm run dev` 起开发服务器，浏览器打开终端里提示的地址就能看到默认页面。

这一步只生成空壳，地图相关的代码还没有。确认页面能正常打开再往下走，Vite 启动失败通常是 Node 版本或端口占用的问题。


```shell
npm create vite@latest openlayers-vue3-demo -- --template vue
```

## 2. 安装OpenLayers

`vue3-openlayers` 把 OpenLayers 的常用对象（地图、图层、数据源、交互）封装成了 Vue 组件和组合式 API，模板里直接写 `<ol-map>`、`<ol-view>`、`<ol-tile-layer>` 就能搭建地图。它的版本会跟着 OpenLayers 的主版本走，装一个包就带上了 `ol` 依赖，不用再单独装。

如果项目里已经直接用 `ol`，注意两边的版本要匹配。`vue3-openlayers` 的 peer 依赖里写明了支持的 `ol` 版本范围，npm 报 `ERESOLVE` 冲突时优先调整 `ol` 版本，而不是加 `--force` 硬装。


```shell
npm install vue3-openlayers
```

## 3. 其他依赖

`axios` 用来请求 GeoServer 之类的服务。浏览器自带的 `fetch` 也能用，选 axios 主要是它的拦截器、取消请求和错误处理写起来省事，接后端统一封装的习惯更顺。

`base-64` 提供一个轻量的 Base64 编解码函数。国内 GIS 数据服务里偶尔会遇到把坐标串或图片转成 Base64 传递的接口，浏览器原生的 `btoa/atob` 对中文和二进制不友好，用这个库处理更稳。


```shell
npm install axios
npm install base-64
```

## 4. 目录结构说明

初始化完成后，地图相关的代码通常按下面的结构组织：

```text
openlayers-vue3-demo/
├── src/
│   ├── main.js               入口，挂载 Vue 应用
│   ├── App.vue               根组件
│   ├── views/                页面级组件
│   ├── components/           地图、面板等可复用组件
│   ├── api/                  服务请求封装
│   └── assets/               静态资源
├── public/
├── index.html
└── vite.config.js            构建配置、代理配置
```

地图组件建议放在 `components/` 下，页面只负责组织布局和数据。请求统一收进 `api/`，GeoServer 的地址和认证信息放在环境变量里，不要硬编码进组件——后面要换环境或者加代理时会省很多事。

## 5. 项目配置要点

vite.config.js 里有两处配置值得一开始就加上。一是开发服务器的 proxy：把 /geoserver 前缀代理到本地 GeoServer 地址，前端请求写相对路径，开发时不用处理跨域，部署时换 Nginx 反向代理即可。二是 base：如果站点部署在非根路径下（比如 /demo/map/），把这个值设成对应前缀，否则打包后静态资源会 404。

环境变量用 Vite 的 .env 机制管理，变量名必须以 VITE_ 开头才会被注入客户端代码。GeoServer 的地址、默认工作区名这类配置放进去，用 import.meta.env.VITE_GEOSERVER_URL 读取。这些值会打包进前端产物，别把密钥写在这里。

代码组织上，地图实例只创建一次，放在 onMounted 里初始化，卸载时调 map.setTarget(undefined) 释放资源；Vue 的响应式数据只存业务状态（当前图层、选中要素、面板开关），不要把 OpenLayers 对象塞进 reactive——大对象做深度代理会拖慢渲染，也容易在热更新时产生循环引用。


## 6. 下一步

工程能跑起来之后，先完成环境安装（见[基础软件环境安装](https://znlgis.github.io/demos/vue3-openlayers/docker/)），准备 PostGIS 和 GeoServer，再回来接地图数据。前端只拿到服务地址就能工作，先装环境可以避免边写边排查服务问题。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/demos/vue3-openlayers/docker/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/demos/vue3-openlayers/" class="chapter-nav__dir">目录</a>
</div>

<!-- /NAVIGATION -->
