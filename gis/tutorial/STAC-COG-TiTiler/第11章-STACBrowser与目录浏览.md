---
layout: default
title: 第11章 - STAC Browser 与目录浏览
---

# 第11章 - STAC Browser 与目录浏览

前四章把数据、目录、服务都搭好了，但用户看到的第一屏仍然是一个 JSON 文件。STAC 的价值只有在“人能看懂、能点开、能看到图”之后才兑现。STAC Browser 就是这一层：一个纯前端应用，读 STAC API 或静态目录，渲染成可浏览的目录树、地图、资产列表与预览。

它不是一个需要长期维护的服务——构建产物是静态文件，可以扔到任何 Web 服务器、对象存储或 CDN 上。真正需要决策的只有三件事：指向哪个目录、用哪种路由模式、部署在哪个路径。

## 11.1 它支持什么

当前稳定版是 5.2.0，支持 STAC 0.6.0 到 1.1.0 之间的所有版本。这个跨度很重要：老目录（0.9、1.0.0-rc）和新目录（1.1.0）可以混着浏览，不需要先做数据迁移。

它同时支持两种数据源：

| 数据源 | 识别方式 | 行为 |
|--------|----------|------|
| 静态目录 | 根 JSON 的 type 是 Catalog 或 Collection，且有 child/item 链接 | 逐层拉 JSON |
| STAC API | 根文档有 conformsTo 与 data/search 链接 | 用 /collections 与 /search |

对 API，它还能额外显示集合列表、全局检索框、分页结果。对静态目录，只能逐层浏览，没有检索。

浏览器不做的事：不缓存瓦片、不做服务端渲染、不做鉴权代理。需要登录的 API 要自己在前面加一层。

## 11.2 三种部署方式

### 11.2.1 源码构建

```bash
git clone https://github.com/radiantearth/stac-browser.git
cd stac-browser
npm install

# 指向一个 STAC API
SB_catalogUrl="https://earth-search.aws.element84.com/v1/" npm start
# 开发服务器在 http://localhost:8080
```

构建产物：

```bash
SB_catalogUrl="https://api.example.com/stac" \
SB_historyMode="hash" \
SB_pathPrefix="/browser/" \
npm run build

ls dist/
# index.html  assets/  config.js  runtime-config.js
```

注意 historyMode 与 pathPrefix 是 **build-only 选项**——它们在构建时被编译进产物，运行时改不了。这一点与 catalogUrl 不同，后者可以在运行时用 SB_* 环境变量覆盖。

### 11.2.2 Docker

```bash
docker run -p 8080:8080 \
  -e SB_catalogUrl="https://api.example.com/stac" \
  -e SB_catalogTitle="示例影像目录" \
  ghcr.io/radiantearth/stac-browser:latest
```

镜像内部是多阶段构建：第一阶段 npm run build 生成 dist，第二阶段 nginx 提供静态文件。启动时 entrypoint 会把 SB_pathPrefix 渲染进 nginx 配置，并生成 runtime-config.js。

所以 Docker 方式下 pathPrefix 可以在启动时给：

```bash
docker run -p 8080:8080 \
  -e SB_catalogUrl="https://api.example.com/stac" \
  -e SB_pathPrefix="/browser/" \
  ghcr.io/radiantearth/stac-browser:latest
# 访问 http://localhost:8080/browser/
```

historyMode 仍然要在构建时定，除非用自定义镜像加 --build-arg historyMode=hash。

### 11.2.3 静态托管

构建出的 dist 是纯静态文件，可以直接放对象存储或 CDN：

```bash
aws s3 sync ./dist s3://my-bucket/browser \
  --delete \
  --cache-control "public, max-age=3600"

# index.html 不缓存，避免发布后用户拿到旧壳
aws s3 cp ./dist/index.html s3://my-bucket/browser/index.html \
  --cache-control "no-cache" \
  --content-type "text/html"
```

缓存策略值得单独说：assets/ 下的文件名带哈希，可以设一年；index.html 与 runtime-config.js 必须短缓存，否则改了 catalogUrl 用户要等很久才生效。

## 11.3 配置项

### 11.3.1 catalogUrl

最重要的一项。规则很硬：

> 提供的 URL **必须**与响应体里 self 链接的 href 完全一致。

也就是说，如果根目录的 JSON 里写的是 "self": "https://cdn.example.com/stac/catalog.json"，那 catalogUrl 就必须是 https://cdn.example.com/stac/catalog.json，不能是 https://cdn.example.com/stac/ 或者带查询串的版本。不一致的表现是首页空白或报“无法加载目录”。

这条约束直接决定了第 7 章的 catalog_type 选择：用 ABSOLUTE_PUBLISHED 时 self 链接是写死的绝对 URL，与 catalogUrl 天然一致；用 SELF_CONTAINED 时根本没有 self 链接，Browser 会退化成“用传入的 URL 当基准”，行为不稳定。

### 11.3.2 其他常用项

| 配置 | 环境变量 | 默认 | 作用 |
|------|----------|------|------|
| catalogUrl | SB_catalogUrl | 空 | 根目录 URL；为空时显示 STAC Index 选择页 |
| catalogTitle | SB_catalogTitle | 从根读 | 标题兜底 |
| catalogImage | SB_catalogImage | 无 | 头部 logo |
| historyMode | SB_historyMode | history | 路由模式，build-only |
| pathPrefix | SB_pathPrefix | / | 子路径部署，build-only |
| apiCatalogPriority | SB_apiCatalogPriority | null | collections 或 childs |
| allowExternalAccess | SB_allowExternalAccess | false | 是否允许浏览外部数据 |
| searchResultsPerPage | SB_searchResultsPerPage | 12 | 检索每页条数 |
| displayGeoTiffByDefault | SB_displayGeoTiffByDefault | false | 是否用 GeoTIFF 渲染器显示 COG |
| preprocessSTAC | 仅配置文件 | 无 | 加载前改写 STAC 对象 |

apiCatalogPriority 解决一个具体问题：STAC API 既可能通过 /collections 暴露集合，也可能通过 child 链接暴露。两者都开时 Browser 会去重，但去重不一定准。如果你的 API 只有 /collections 没有 child 链接，设成 collections 更干净。

### 11.3.3 配置文件

环境变量适合少量覆盖，复杂配置（比如自定义字段渲染）要写 config.js：

```js
// config.js
export default {
  catalogUrl: "https://api.example.com/stac",
  catalogTitle: "示例影像目录",
  historyMode: "hash",
  pathPrefix: "/browser/",
  apiCatalogPriority: "collections",
  searchResultsPerPage: 24,
  displayGeoTiffByDefault: true,
  footerLinks: [
    { label: "使用条款", url: "https://example.com/terms" },
    { label: "联系我们", url: "https://example.com/contact" },
  ],
};
```

也可以用一个外部配置文件覆盖，不重新构建：

```bash
SB_CONFIG=./config.local.mjs npm start
```

### 11.3.4 私有查询参数

需要传 API Key 时，Browser 支持以 ~ 开头的查询参数：它们会被存进内存、从地址栏移除，然后附加到后续所有 STAC 请求上。

```text
https://example.com/browser/?~API_KEY=123
```

如果不想让托管 Browser 的服务器看到这个参数（比如走 history 模式时参数会进访问日志），可以放到 hash 里：

```text
https://example.com/browser/#?~API_KEY=123
```

这个机制是实验性的，且只对同域或 allowedDomains 里列出的域生效。

## 11.4 与静态目录的配合

### 11.4.1 目录结构要求

Browser 从根 JSON 开始，靠 child 与 item 链接往下走。它对目录结构没有要求，但对链接有：

- 根必须有 self（否则 catalogUrl 校验不过）；
- 每个子节点最好有 parent，用于面包屑；
- Item 的 href 要能直接取到。

第 7 章的 pystac 生成流程默认满足这些条件。检查方法：

```bash
# 根节点应该有 self
curl -s https://cdn.example.com/stac/catalog.json | python -m json.tool | head -20

# 子节点应该有 parent
curl -s https://cdn.example.com/stac/demo/collection.json \
  | python -c "import json,sys; d=json.load(sys.stdin); print([l['rel'] for l in d['links']])"
# ['self', 'root', 'parent', 'item', 'item', ...]
```

### 11.4.2 同源部署避开 CORS

静态托管（尤其是 GitHub Pages、S3 静态网站）通常不能自定义响应头，也就配不了 CORS。此时把 Browser 与 STAC 目录放在**同一个域名**下就能绕开：

```text
https://example.github.io/imagery/
├── index.html          ← STAC Browser 的 dist
├── assets/
├── config.js
└── stac/
    ├── catalog.json
    ├── demo/collection.json
    └── demo/item-001/item-001.json
```

catalogUrl 写 https://example.github.io/imagery/stac/catalog.json，同源，不需要 CORS。

### 11.4.3 GitHub Pages 的两个限制

**不支持 URL 重写。** history 模式下刷新 /browser/collections/demo 会 404，因为 Pages 只认实际存在的文件。必须用 hash 模式：

```bash
SB_historyMode="hash" \
SB_catalogUrl="https://example.github.io/imagery/stac/catalog.json" \
npm run build
```

**不支持自定义响应头。** 所以 Content-Type 由文件扩展名决定，.json 会被当成 application/json——这对 Browser 没问题，但某些严格校验 STAC 媒体类型的客户端可能不认。

### 11.4.4 子路径部署

部署在 /browser/ 而不是根路径时，pathPrefix 必须设：

```bash
SB_pathPrefix="/browser/" npm run build
```

漏设的表现是页面能打开但所有 assets 404——因为 index.html 里引用的是 /assets/xxx 而不是 /browser/assets/xxx。

Docker 部署时还有一层：nginx 配置里的 location 也要跟着改。镜像的 entrypoint 会自动处理，前提是设了 SB_pathPrefix。

## 11.5 与 API 的配合

### 11.5.1 指向 stac-fastapi

```bash
SB_catalogUrl="https://api.example.com/stac" npm run build
```

Browser 会先请求根文档，发现 conformsTo 里有 item-search，就启用检索框。检索走 POST /search，带 bbox、datetime、collections 与分页。

一个常见问题：Browser 期望根文档的 self 链接与 catalogUrl 一致。stac-fastapi 生成的 self 链接来自请求的 Host 头，反向代理没传 X-Forwarded-Host 时会变成内部地址。

```nginx
location /stac/ {
    proxy_pass http://api:8082/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

stac-fastapi 的 ProxyHeaderMiddleware 会读这些头来构造链接。漏了就会看到 self 指向 http://api:8082。

### 11.5.2 事务扩展的界面

5.1 起 Browser 支持 STAC API 的 Transactions 扩展，可以在界面上新建、编辑、删除 Item。默认关闭，要在配置里显式打开：

```js
export default {
  catalogUrl: "https://api.example.com/stac",
  transactions: true,
  transactionsRequireLogin: true,
};
```

打开之前想清楚：Browser 是纯前端，所有请求都从浏览器发出。要鉴权就得让 API 支持 CORS 携带凭据，或者用前面说的私有查询参数传 token。生产环境建议 transactionsRequireLogin 保持 true。

### 11.5.3 缩略图与预览

Browser 会优先展示带 thumbnail 角色的 asset，其次是有 visual 角色的 COG（如果 displayGeoTiffByDefault 为 true）。

COG 的预览有两条路径：

1. 直接读 COG 的前几个块渲染缩略图（依赖服务端 CORS 与 Range，见第 6 章）；
2. 走 TiTiler 的预览端点。

第 1 条对静态托管友好但慢；第 2 条需要额外部署 TiTiler。Browser 本身不代理请求，它只是发起请求。

## 11.6 自定义

### 11.6.1 字段渲染

自定义扩展的字段默认显示为原始 JSON。想让它好看，用 stac-fields 的注册机制：

```js
// fields.config.js
import { Registry } from "@radiantearth/stac-fields";

Registry.addExtension("radiant", "Radiant Earth");
Registry.addMetadataField("radiant:public_access", {
  label: "数据访问",
  formatter: (value) => (value ? "公开" : "受限"),
});
```

这比改源码稳——升级 Browser 时配置不会丢。

### 11.6.2 加载前改写

preprocessSTAC 可以在渲染前修改 STAC 对象，适合补字段、改链接：

```js
export default {
  catalogUrl: "https://api.example.com/stac",
  preprocessSTAC: (stac) => {
    // 给所有 Item 补一个默认缩略图
    if (stac.type === "Feature" && !stac.assets?.thumbnail) {
      stac.assets = stac.assets || {};
      stac.assets.thumbnail = {
        href: "https://cdn.example.com/placeholder.png",
        type: "image/png",
        roles: ["thumbnail"],
      };
    }
    return stac;
  },
};
```

这个钩子只在配置文件里可用，不能通过环境变量传（函数没法序列化）。

## 11.7 排错

| 现象 | 原因 | 修法 |
|------|------|------|
| 首页空白，控制台报 catalogUrl 不匹配 | catalogUrl 与 self 链接不一致 | 逐字符比对，注意末尾斜杠 |
| 刷新页面 404 | history 模式 + 服务器不支持重写 | 改 hash 模式 |
| 所有 assets 404 | pathPrefix 没设 | 重新构建并设 SB_pathPrefix |
| 地图不出图，控制台 CORS 错误 | COG 所在域没配 CORS | 见第 6 章的 CORS 三件套 |
| 检索框不出现 | 根文档没有 item-search conformance | 检查 conformsTo |
| 缩略图 404 | Item 的 thumbnail href 指向不存在的文件 | 生成缩略图或删掉该 asset |
| 发布后改了 catalogUrl 不生效 | index.html 或 runtime-config.js 被长缓存 | 给这两个文件设 no-cache |
| 中文标题乱码 | 服务器没返回 charset | 配 Content-Type: text/html; charset=utf-8 |

第一条最费时间，因为“看起来一样”的 URL 可能差一个斜杠。规范 1.1.0 专门澄清了末尾斜杠有语义，Browser 是严格按字符串比对的。

## 11.8 生产建议

**Browser 与目录同域部署。** 省掉 CORS 配置，也避免混合内容问题。子路径 /browser/ 与 /stac/ 分开即可。

**构建产物进版本控制或制品库。** dist 是构建产物，但配置（catalogUrl、historyMode）决定了它的行为。把构建命令与配置一起记录，比只存 dist 更可靠。

**不要给 Browser 开写权限。** transactions 打开意味着任何能访问页面的人都能改数据。确实需要时，前面加一层带鉴权的反向代理，并且只对特定路径放行。

**用 STAC Index 做发现。** 目录稳定后提交到 stacindex.org，Browser 的默认首页就是读它。这是让别人找到你的目录的最低成本方式。

**监控首屏加载。** Browser 首屏要拉根文档 + 集合列表 + 缩略图，任何一环慢都会让首屏超过 3 秒。根文档建议放在 CDN 边缘，缩略图控制在 50 KB 以内。

## 11.9 本章小结

| 要点 | 结论 |
|------|------|
| 版本 | 5.2.0，支持 STAC 0.6.0–1.1.0 |
| 数据源 | 静态目录（逐层拉）与 STAC API（/collections + /search） |
| 关键约束 | catalogUrl 必须与根 self 链接完全一致 |
| 路由 | history 需要 URL 重写；S3 与 GitHub Pages 必须用 hash |
| 路径 | 子路径部署必须设 pathPrefix，且是 build-only |
| 部署 | 静态文件即可，与目录同域最省事 |

到这里，从影像上云、编目、建服务到浏览的链路已经闭环。后面的章节进入渲染层：TiTiler 如何把 COG 变成瓦片，以及 STAC 元数据如何驱动动态渲染。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第10章-STACAPI检索与扩展/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第12章-TiTiler架构与部署/" class="chapter-nav__next">下一章 →</a>
</div>
