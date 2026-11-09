---
layout: default
title: 第16章 - OGC服务集成
---

# 第16章 - OGC 服务集成

## 16.1 WMS 服务

OGC 服务是 GIS 前后端分离的标准接口：服务端负责数据存储、渲染、权限，前端只发 HTTP 请求取图片或要素。好处是数据不出服务器、样式集中管理、跨语言跨平台；代价是每次交互都可能是一次网络往返，参数写错时表现为“图不出来”或者“图出来了但位置不对”，而不是报错。

三大服务各管一段：WMS 返回渲染好的图片，适合展示和打印；WFS 返回矢量要素（GML 或 GeoJSON），适合查询和编辑；WMTS 返回预切好的瓦片，适合高并发浏览。同一个图层往往三种服务都发布，前端按场景选择，而不是“哪个新用哪个”。

### 16.1.1 WMS 图层

`TileWMS` 与 `ImageWMS` 的区别在请求粒度：前者按网格切片，每块瓦片单独请求一张图，平移时不重复请求已缓存的区域；后者按当前视野整幅请求一张图，缩放平移都会重新请求。`TileWMS` 适合作为底图长期浏览，`ImageWMS` 适合叠加图层或需要“整幅一致渲染”的场景（比如带比例尺标注的专题图）。两者都支持 `TILED=true`，但只有服务端开启了瓦片缓存才有效。

`params` 里的 `LAYERS` 是服务端发布的图层名，通常带工作区前缀（`workspace:layer`），名字写错时服务端返回一张空图或错误图片，前端不会抛异常，只是看不见东西。`FORMAT` 决定返回图片格式，`image/png` 支持透明，`image/jpeg` 体积小但不支持透明，叠加在底图上会盖住下面。

`serverType: 'geoserver'` 影响两件事：`getFeatureInfoUrl` 生成的参数格式（GeoServer 用 `INFO_FORMAT`，MapServer 用 `INFO_FORMAT` 但字段名不同），以及瓦片编号规则。写错时图片可能正常显示，但点击查询失败。用别的服务端（MapServer、QGIS Server）时按文档改这个值，不要照抄。

WMS 1.3.0 与 1.1.1 的坐标轴顺序不同：1.3.0 对 EPSG:4326 要求 `BBOX=minLat,minLon,maxLat,maxLon`（纬度在前），1.1.1 是经度在前。OpenLayers 的 WMS 源会根据 `VERSION` 参数自动处理，但直接拼 URL 调服务时容易踩这个坑，现象是请求范围跑到地球另一侧。

```javascript
import TileWMS from 'ol/source/TileWMS';
import ImageWMS from 'ol/source/ImageWMS';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';

// 瓦片 WMS
const wmsLayer = new TileLayer({
  source: new TileWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: {
      'LAYERS': 'workspace:layer',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    serverType: 'geoserver'
  })
});

// 图像 WMS
const imageWmsLayer = new ImageLayer({
  source: new ImageWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: { 'LAYERS': 'workspace:layer' },
    ratio: 1,
    serverType: 'geoserver'
  })
});
```

### 16.1.2 GetFeatureInfo

`getFeatureInfoUrl` 把点击位置、分辨率、投影和额外参数拼成一次查询请求，返回的是 URL 字符串，是否发请求由调用方决定。它生成的参数包括 `REQUEST=GetFeatureInfo`、`QUERY_LAYERS`、`I`/`J`（像素坐标）、`INFO_FORMAT` 等，这些都由 OpenLayers 根据源配置补齐，不需要手写。

点击位置必须用 `event.coordinate`（地图坐标）而不是像素坐标，同时要传当前视图的 `resolution` 和投影。这三个值决定了服务端如何把“点”换算回数据范围，任何一个传错，查询结果都会偏。视图有旋转时 `getFeatureInfoUrl` 内部会处理，不需要额外转换。

返回格式取决于服务端支持：GeoServer 较新版本支持 `application/json`，老版本或部分数据源只返回 `text/html` 或 `application/vnd.ogc.gml`。示例直接用 `response.json()` 解析，格式不对时会抛解析异常。生产代码应当先判断 `Content-Type`，非 JSON 时走 XML 或 HTML 解析分支，并给用户一个明确的失败提示。

查询结果为空时 `data.features` 可能是 `undefined`，示例用 `?.` 做了保护。服务端返回的要素通常不带坐标系信息（GeoJSON 规范默认 WGS84，但很多服务端按请求的 `SRS` 返回），把它直接当作 3857 坐标去画点会偏移，需要按 `srsName` 做一次转换。

```javascript
map.on('singleclick', async (event) => {
  const source = wmsLayer.getSource();
  const url = source.getFeatureInfoUrl(
    event.coordinate,
    map.getView().getResolution(),
    'EPSG:3857',
    { 'INFO_FORMAT': 'application/json' }
  );
  
  if (url) {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features?.length > 0) {
      showPopup(event.coordinate, data.features);
    }
  }
});
```

### 16.1.3 动态过滤

`source.updateParams({...})` 修改 WMS 请求参数并触发重新加载，这是做动态过滤的入口。它不改变已有瓦片的缓存键的语义，改完参数后旧瓦片会失效并重新请求，所以频繁调用会带来大量网络请求。输入框实时过滤时要做防抖，等用户停止输入 300 毫秒再更新参数。

`CQL_FILTER` 是 GeoServer 的扩展参数，语法类似 SQL 的 WHERE 子句：字符串用单引号，逻辑用 `AND`/`OR`，比较支持 `>`、`<`、`LIKE` 等。不是所有 WMS 服务端都支持 CQL，跨平台时要改用标准 `FILTER` 参数（OGC Filter 编码的 XML），通用性更好但可读性差很多。参数值直接拼接字符串时存在注入风险，来自用户输入的部分要做类型校验和转义。

`SLD_BODY` 传入完整的 SLD 文档来覆盖服务端默认样式。它的优点是前端可以完全控制渲染，缺点是请求体积大（SLD 动辄几 KB）、URL 长度在部分代理上会被截断。更稳的做法是把样式发布到服务端，用 `STYLES` 参数引用样式名；`SLD_BODY` 适合一次性、临时性的样式调整。

`TIME` 参数用于时态数据（遥感影像、气象场），格式由服务端配置决定，常见是 ISO 8601 时间点或区间。传了服务端不认识的维度名（比如 `ELEVATION`）不会报错，只是被忽略；判断参数是否生效，看请求 URL 与实际出图是否变化最直接。`updateParams` 会合并参数而不是替换全部，想删除某个参数要显式传 `undefined` 或空字符串，具体行为依版本而定。

```javascript
// CQL 过滤
function setWMSFilter(source, filter) {
  source.updateParams({ 'CQL_FILTER': filter });
}

setWMSFilter(wmsSource, "type = 'commercial' AND area > 1000");

// SLD 样式
function setWMSStyle(source, sldBody) {
  source.updateParams({ 'SLD_BODY': sldBody });
}

// 时间过滤
function setWMSTime(source, time) {
  source.updateParams({ 'TIME': time });
}

setWMSTime(wmsSource, '2024-01-01');
```

## 16.2 WFS 服务

WFS 与 WMS 的根本区别是返回数据而不是图片：前端拿到的是要素的几何与属性，可以做样式定制、属性查询、编辑。代价是数据量受网络与内存限制，一个几万要素的图层整包下载会让页面卡死，所以 WFS 通常配合 `bbox` 策略按视野加载，而不是一次性拉全量。

### 16.2.1 加载 WFS 数据

`VectorSource` 的 `url` 可以是一个函数，参数是当前加载范围（`extent`），返回请求地址。配合 `strategy: bboxStrategy`，每次视野变化就把范围作为 `bbox` 参数去请求，只加载看得见的部分。这个组合是 WFS 在大范围数据下的标准用法，不配策略时默认只加载一次（`all` 策略），平移后空白区域不会补数据。

URL 里的几个参数各有作用：`service=WFS&version=1.1.0&request=GetFeature` 是服务与操作声明；`typename` 是图层名；`outputFormat=application/json` 要求返回 GeoJSON（服务端需支持该输出格式，不支持时返回 GML）；`srsname=EPSG:3857` 指定返回坐标的投影，与 `bbox` 参数的单位保持一致。`srsname` 与 `bbox` 的 CRS 不一致时，服务端可能按自己理解解释范围，结果为空或偏移。

`format: new GeoJSON()` 负责把响应解析成要素。如果服务端返回的是 GML 而不是 JSON（`outputFormat` 不被支持时会回落），用 `GeoJSON` 解析会失败，控制台报解析错误。判断依据是响应的 `Content-Type`，或者直接用 `ol/format/WFS` 的 `readFeatures` 来兼容两种格式。

`bbox` 策略的请求次数与拖动频率直接相关。每次 `moveend` 都可能触发一批请求，快速拖动会积压大量请求。OpenLayers 内部对重复范围有缓存，但并发仍然可能很高，服务端扛不住时需要降低策略粒度（改用 `tile` 策略，把范围切成瓦片逐块加载）或给请求加节流。

```javascript
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';

// 基本 WFS
const wfsSource = new VectorSource({
  format: new GeoJSON(),
  url: function(extent) {
    return 'http://localhost:8080/geoserver/wfs?' +
      'service=WFS&version=1.1.0&request=GetFeature&' +
      'typename=workspace:layer&' +
      'outputFormat=application/json&' +
      'srsname=EPSG:3857&' +
      'bbox=' + extent.join(',') + ',EPSG:3857';
  },
  strategy: bboxStrategy
});

const wfsLayer = new VectorLayer({
  source: wfsSource,
  style: vectorStyle
});
```

### 16.2.2 WFS 事务

WFS 事务（WFS-T）把前端编辑写回服务端，是“在线编辑”的基础。`ol/format/WFS` 的 `writeTransaction(inserts, updates, deletes, options)` 生成一段 WFS Transaction XML，前三个参数分别是新增、修改、删除的要素数组，`options` 描述要素类型与命名空间。生成的 XML 通过 POST 发给服务端，服务端在一个事务里执行。

`featureNS` 必须与服务端工作区绑定的命名空间 URI 一致，示例里的 `http://geoserver.org` 只是一个占位值。真正的命名空间在 GeoServer 的工作区设置里能看到（通常形如 `http://www.example.com/workspace`），填错时服务端报“unknown feature type”。`featurePrefix` 是工作区名，`featureType` 是图层名，三者共同定位到服务端的一张表。

`srsName` 要让服务端知道要素坐标的投影。省略时服务端按数据源原生投影理解，而前端要素通常是 3857，写入后位置就错了，且这种错位不会报错，只在打开数据时发现。写事务前把要素坐标转换到服务端期望的投影，是最稳妥的做法。

示例的 fetch 没有设置 `Content-Type: text/xml`（或 `application/xml`），WFS 规范要求事务请求的 Content-Type 为 XML。GeoServer 对缺失的 Content-Type 比较宽容，但严格实现的服务端会返回 415。补上 header 是几行代码的事，却能避免换一个服务端就跑不通。

`response.ok` 只表示 HTTP 状态码 2xx，不代表事务成功。WFS 事务失败时可能返回 200 并在响应体里放 `ExceptionReport`，尤其是批量操作部分失败的情况。判断成功应当解析响应体，检查有没有 `Exception` 节点，并把失败原因显示给用户——直接信任 `ok` 会导致“界面提示成功、数据没写进去”。

```javascript
import WFS from 'ol/format/WFS';
import GML from 'ol/format/GML';

const wfsFormat = new WFS();

// 插入要素
async function insertFeature(feature) {
  const xml = wfsFormat.writeTransaction([feature], null, null, {
    featureNS: 'http://geoserver.org',
    featurePrefix: 'workspace',
    featureType: 'layer',
    srsName: 'EPSG:3857'
  });
  
  const response = await fetch('http://localhost:8080/geoserver/wfs', {
    method: 'POST',
    body: new XMLSerializer().serializeToString(xml)
  });
  
  return response.ok;
}

// 更新要素
async function updateFeature(feature) {
  const xml = wfsFormat.writeTransaction(null, [feature], null, {
    featureNS: 'http://geoserver.org',
    featurePrefix: 'workspace',
    featureType: 'layer',
    srsName: 'EPSG:3857'
  });
  
  return fetch('http://localhost:8080/geoserver/wfs', {
    method: 'POST',
    body: new XMLSerializer().serializeToString(xml)
  });
}

// 删除要素
async function deleteFeature(feature) {
  const xml = wfsFormat.writeTransaction(null, null, [feature], {
    featureNS: 'http://geoserver.org',
    featurePrefix: 'workspace',
    featureType: 'layer'
  });
  
  return fetch('http://localhost:8080/geoserver/wfs', {
    method: 'POST',
    body: new XMLSerializer().serializeToString(xml)
  });
}
```

## 16.3 WMTS 服务

WMTS 是预切瓦片服务，服务端把地图按层级切成图片，客户端按需取片。它没有渲染开销，单张瓦片是静态文件，适合高并发、大范围浏览；代价是不能按需过滤（切片时样式已固定），数据变化后要重新切片。对比 WMS，WMTS 快但不够灵活，WMS 灵活但每次都要服务端渲染。

### 16.3.1 WMTS 配置

WMTS 的接入方式是先读能力文档（GetCapabilities），再根据文档构造源。能力文档是一份 XML，描述了图层名、可用投影矩阵集（TileMatrixSet）、各层级的瓦片矩阵，以及每层的请求地址模板。手写这些参数容易出错，`optionsFromCapabilities` 从解析结果里自动提取，是官方推荐的做法。

`optionsFromCapabilities(capabilities, { layer, matrixSet })` 的两个选项都很关键。`layer` 是 WMTS 图层标识符，不一定是 WMS 里的 `workspace:layer` 写法，要看能力文档里的 `<ows:Identifier>`；`matrixSet` 是瓦片矩阵集名字，普通 Web 地图用 `EPSG:3857`（或 `GoogleMapsCompatible`），写错时会报“找不到矩阵集”或者瓦片层级对不上。

返回的 options 已经包含 `url`、`layer`、`matrixSet`、`format`、`tileGrid`、`style` 等全部必填项，直接 `new WMTS(options)` 即可。示例里 `new WMTS(options)` 用 `new` 调用是正确的，部分版本也支持工厂函数；两种写法等价，按项目风格统一即可。

能力文档请求失败、或者文档里没有目标图层时，`optionsFromCapabilities` 返回 `null`，`new WMTS(null)` 会抛异常。加载流程要有错误处理：网络失败、图层不存在、矩阵集不匹配，都应该给出可读的提示，而不是让地图直接白屏。能力文档通常有几十 KB 到几 MB，缓存解析结果可以避免重复请求。

```javascript
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';

// 从 Capabilities 自动配置
async function createWMTSLayer(capabilitiesUrl, layerName) {
  const response = await fetch(capabilitiesUrl);
  const text = await response.text();
  
  const parser = new WMTSCapabilities();
  const capabilities = parser.read(text);
  
  const options = optionsFromCapabilities(capabilities, {
    layer: layerName,
    matrixSet: 'EPSG:3857'
  });
  
  return new TileLayer({
    source: new WMTS(options)
  });
}

// 使用
const wmtsLayer = await createWMTSLayer(
  'http://localhost:8080/geoserver/gwc/service/wmts?REQUEST=GetCapabilities',
  'workspace:layer'
);
map.addLayer(wmtsLayer);
```

## 16.4 GeoServer 集成

除了 OGC 标准服务，GeoServer 还提供 REST API 管理资源：列出工作区、发布图层、上传样式、修改数据存储。前端需要“按当前用户权限动态加载图层列表”这类能力时，走 REST 比硬编码图层名灵活得多。它不是 OGC 标准，跨平台时不可移植，属于 GeoServer 专属能力。

### 16.4.1 REST API

GeoServer REST 的认证方式是 HTTP Basic：把 `用户名:密码` 用 base64 编码放进 `Authorization` 头。示例用 `btoa` 做编码，它只支持 Latin-1 字符，用户名或密码含中文时会抛异常，需要先按 UTF-8 编码再转 base64。Basic 认证的凭据在每次请求里明文传输，必须走 HTTPS，否则等同于把密码写在网上。

请求路径的结构是 `/rest/{资源类型}/{路径参数}.{格式}`：`/rest/workspaces/{ws}/layers.json` 列出工作区下的图层，`/rest/styles.json` 列出所有样式。格式后缀决定响应是 JSON 还是 XML，删掉后缀时默认返回 XML。REST API 的路径大小写敏感，`workspaces` 写成 `Workspaces` 会 404，这类错误在排查时容易被忽略。

`uploadStyle` 用 `Content-Type: application/vnd.ogc.sld+xml` 上传 SLD 内容。这个请求只是创建样式，还没有把它绑定到图层；要让样式生效，还需要调用 `/rest/layers/{layer}` 修改图层的 `defaultStyle`。两步操作之间缺少第二步时，现象是“样式上传成功了但地图没变化”。

浏览器直接调用 GeoServer REST 会遇到跨域问题。GeoServer 的 `web.xml` 默认没有配置 CORS 头，前端请求会被浏览器拦截；解决办法是在 GeoServer 侧配置 CORS 过滤器，或者由自己的后端做代理。示例代码在 Node 或同源环境下能跑，直接放进浏览器页面里则很可能失败，这是集成时第一个要确认的前提。

```javascript
class GeoServerClient {
  constructor(baseUrl, auth) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': 'Basic ' + btoa(auth.username + ':' + auth.password),
      'Content-Type': 'application/json'
    };
  }
  
  // 获取图层列表
  async getLayers(workspace) {
    const response = await fetch(
      `${this.baseUrl}/rest/workspaces/${workspace}/layers.json`,
      { headers: this.headers }
    );
    return response.json();
  }
  
  // 获取图层详情
  async getLayer(workspace, layer) {
    const response = await fetch(
      `${this.baseUrl}/rest/workspaces/${workspace}/layers/${layer}.json`,
      { headers: this.headers }
    );
    return response.json();
  }
  
  // 获取样式
  async getStyles() {
    const response = await fetch(
      `${this.baseUrl}/rest/styles.json`,
      { headers: this.headers }
    );
    return response.json();
  }
  
  // 上传样式
  async uploadStyle(name, sld) {
    await fetch(`${this.baseUrl}/rest/styles`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/vnd.ogc.sld+xml' },
      body: sld
    });
  }
}

const geoserver = new GeoServerClient('http://localhost:8080/geoserver', {
  username: 'admin',
  password: 'geoserver'
});
```

### 16.4.2 图例获取

`GetLegendGraphic` 是 WMS 的一个操作，按图层和样式返回一张图例图片。参数里 `LAYER` 是图层名，`FORMAT` 是图片格式，`WIDTH`/`HEIGHT` 是图例中单个符号的尺寸（不是整张图的尺寸）。整张图的大小由样式里的规则数量决定，多个分类符号会排成一张图，前端用 `<img>` 直接显示即可，不需要额外处理。

`URLSearchParams` 负责拼接参数，它会自动做 URL 编码，避免图层名里的冒号、空格破坏请求。`...options.extraParams` 允许追加服务端特有参数，比如 `LEGEND_OPTIONS=fontAntiAliasing:true` 控制字体渲染。展开运算符放在最后意味着同名参数会覆盖前面的值，这是有意的设计，调用方可以借此覆盖默认参数。

图例图片的缓存要单独考虑。样式不变时图片不变，可以给 URL 加版本参数并设置较长的 `Cache-Control`；样式更新后旧 URL 仍然返回旧图例，需要改变版本参数来强制刷新。示例每次渲染都拼一个新 URL，浏览器缓存命中率取决于 URL 是否稳定，最好是“样式版本 + 图层名”组成稳定键。

图例的排版通常由服务端的 SLD 决定，前端拿到的是位图，无法改文字。需要可控排版（多列、分组、图例标题）时，要么给每个规则单独请求图例再自行排版，要么在前端用 SVG/Canvas 画图例。示例的做法适合“有几个图层就列几个图例”的简单场景。

```javascript
function getWMSLegendUrl(baseUrl, layerName, options = {}) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetLegendGraphic',
    LAYER: layerName,
    FORMAT: options.format || 'image/png',
    WIDTH: options.width || 20,
    HEIGHT: options.height || 20,
    ...options.extraParams
  });
  
  return `${baseUrl}?${params.toString()}`;
}

// 创建图例元素
function createLegend(layers) {
  const container = document.createElement('div');
  container.className = 'legend';
  
  layers.forEach(layer => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    
    const img = document.createElement('img');
    img.src = getWMSLegendUrl(
      'http://localhost:8080/geoserver/wms',
      layer.name
    );
    
    const label = document.createElement('span');
    label.textContent = layer.title;
    
    item.appendChild(img);
    item.appendChild(label);
    container.appendChild(item);
  });
  
  return container;
}
```

## 16.5 本章小结

OGC 服务集成的排查路径可以按“请求是否发出去、参数对不对、响应能不能解析”三步走。打开浏览器开发者工具的网络面板，看请求 URL 里 `LAYERS`、`BBOX`、`SRS` 是否符合预期；看响应状态码与 `Content-Type`；看返回内容是图片、XML 还是错误报告。多数“图层不显示”的问题在第一步就能看出来，不需要改代码。

生产环境还要考虑服务端的坐标系与前端视图是否一致、跨域是否放行、凭据如何管理、请求量是否可控。这几项与 OpenLayers 的 API 无关，但决定了集成能不能稳定运行，部署前应当逐项确认。

本章介绍了 OGC 服务集成：

1. **WMS 服务**：图层加载、GetFeatureInfo、动态过滤
2. **WFS 服务**：数据加载、事务操作
3. **WMTS 服务**：Capabilities 解析
4. **GeoServer 集成**：REST API、图例

### 关键要点

- WMS 适合栅格显示和简单查询
- WFS 支持矢量编辑和复杂查询
- WMTS 适合高性能瓦片服务
- 使用 GeoServer REST API 管理服务

---

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第15章-要素编辑与绘制/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第17章-性能优化与最佳实践/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->
