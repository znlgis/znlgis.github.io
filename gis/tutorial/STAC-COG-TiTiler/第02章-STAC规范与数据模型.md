---
layout: default
title: 第02章 - STAC 规范与数据模型
---

# 第02章 - STAC 规范与数据模型

写 STAC 最容易犯的错，是把它当成“给 GeoTIFF 配个 JSON”。真实情况相反：STAC 定义的是一个**可爬取的对象图**，JSON 只是这张图的序列化形式。四个对象（Catalog、Collection、Item、Asset）由 Link 连成有向图，客户端从根节点出发，靠 rel 类型决定往哪走；字段值只是节点上的标签。

不理解这层图结构，后面所有问题都会以“莫名其妙”的形式出现：pystac 读目录时无限递归、STAC Browser 显示空集合、pgstac 导入报外键错误、API 里搜得到但取不到。

这一章按“对象 → 字段 → 约束 → 校验”的顺序把 1.1.0 的数据模型拆开。字段表尽量给全，因为 STAC 的字段语义经常被误用（比如 bbox 与 geometry 的关系、datetime 与 start/end_datetime 的互斥规则），而这些误用会直接导致检索结果不对。

## 2.1 四个对象与一张图

### 2.1.1 对象职责

| 对象 | 文件 | 作用 | 必填字段 |
|------|------|------|----------|
| Catalog | application/json | 逻辑分组，导航入口 | type、stac_version、id、description、links |
| Collection | application/json | 一组共享元数据的 Item，带 extent 与 summaries | Catalog 全部字段 + license、extent |
| Item | application/geo+json | 一景数据，GeoJSON Feature | type、stac_version、id、geometry、bbox、properties、links、assets |
| Asset | 内嵌 | 一个可下载或可流式读取的资源 | href |

Collection 是 Catalog 的子类型：规范原文是“任何包含全部必填字段的 JSON 对象都是合法 Catalog”，而 Collection 额外要求 license 与 extent。所以 Collection 文件天然也是合法 Catalog，反过来不成立。

### 2.1.2 Link 与 rel

Link 对象只有 href 与 rel 是必填：

| 字段 | 类型 | 说明 |
|------|------|------|
| href | string | URL，相对与绝对都允许；**末尾斜杠有语义** |
| rel | string | 关系类型 |
| type | string | 目标媒体类型，强烈建议给 |
| title | string | 人类可读标题 |
| method | string | HTTP 方法，大写，默认 GET（1.1.0 新增） |
| headers | object | 请求头，值是字符串或字符串数组（1.1.0 新增） |
| body | any | 请求体（1.1.0 新增） |

STAC 专用 rel 一共六个：

| rel | 指向 | 媒体类型 | 约束 |
|-----|------|----------|------|
| self | 自身 | application/json | 绝对 URL，强烈建议 |
| root | 根 Catalog/Collection | application/json | 概念上唯一 |
| parent | 父节点 | application/json | 概念上唯一 |
| child | 子 Catalog/Collection | application/json | 仅用于 Catalog→Catalog/Collection |
| collection | 所属 Collection | application/json | Item 有 collection 字段时必须同时有该链接 |
| item | 子 Item | application/geo+json | Item 中不允许出现 |

几个容易被忽略的硬约束：

- **Item 不能有 item rel**。规范明说“除 item 外的所有公共 rel 都能用在 Item 上”。
- **Item 的 collection 字段与 collection rel 是绑定的**：有 collection 字段就必须有 collection 链接，没有就不能有。这条在 stac-fastapi 的校验里会直接拒绝。
- **child 只能指向 Catalog 或 Collection**，不能指向 Item。Collection 里挂 Item 要用 item rel。
- **末尾斜杠有意义**。1.1.0 的变更日志专门澄清了 URL 解析机制：https://example.com/a 与 https://example.com/a/ 是两个不同资源。静态目录部署时这条会咬人。

### 2.1.3 图遍历的实际路径

一个典型静态目录：

```text
catalog.json  (root, self)
 ├─ rel=child → landsat/collection.json
 │                ├─ rel=item → landsat/LC08_123032/item.json
 │                │                └─ rel=collection → ../../collection.json
 │                └─ rel=item → ...
 └─ rel=child → sentinel2/collection.json
                  └─ ...
```

从 catalog.json 出发，客户端只需要认 child 与 item 两种 rel 就能爬完整棵树；parent 与 root 用于反向导航和构造面包屑。STAC Browser 的“返回上级”按钮就是读 parent。

如果 parent 缺失，pystac 仍能遍历（它自己维护父子关系），但重新从磁盘加载子节点时会丢失上下文——这是第 7 章强调“用 pystac 生成而不是手写”的直接原因。

## 2.2 Catalog 与 Collection

### 2.2.1 Catalog 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定 "Catalog" |
| stac_version | string | 是 | 如 "1.1.0" |
| stac_extensions | [string] | 否 | 扩展 JSON Schema 的 URL 列表 |
| id | string | 是 | 标识符 |
| title | string | 否 | 一行标题 |
| description | string | 是 | 多行描述，允许 CommonMark |
| links | [Link] | 是 | 至少建议有一个 item 或 child |

stac_extensions 的语义经常被写错：它**只列直接作用于该对象的扩展**，不列子对象实现的扩展。Item 用了 eo 扩展，Collection 不必写；但如果 Collection 的 summaries 里出现了 eo:cloud_cover，那 Collection 就必须写——因为它自己“实现”了该扩展。

### 2.2.2 Collection 的 extent

extent 是 Collection 唯一的“几何”信息，结构固定：

```json
{
  "extent": {
    "spatial": { "bbox": [[-180.0, -90.0, 180.0, 90.0]] },
    "temporal": { "interval": [["2013-04-11T00:00:00Z", null]] }
  }
}
```

规则细节：

- spatial.bbox 是**二维数组**，每个内层是一个 bbox，长度必须是 2n（n 为维数）。第一个 bbox 表示总体范围，后续可以给更精确的多个范围。
- 1.1.0 起，**只给两个 bbox 会被 schema 判为非法**——变更日志写的是“两个空间包围盒没有意义”。要么一个，要么三个以上（用多个来减少并集的空洞）。
- temporal.interval 每个内层恰好两个元素，可以是时间戳或 null；null 表示开区间。[["2019-01-01T00:00:00Z", null]] 表示 2019 年至今。

### 2.2.3 summaries 的三种形态

summaries 是“不用爬 Item 就能知道字段取值范围”的机制，值可以是三种：

| 形态 | 示例 | 适用 |
|------|------|------|
| 枚举数组 | "platform": ["landsat-8", "landsat-9"] | 离散值，强烈建议列全 |
| Range 对象 | "gsd": {"minimum": 10, "maximum": 30} | 有序数值/日期 |
| JSON Schema | "eo:cloud_cover": {"type": "number", "minimum": 0, "maximum": 100} | 需要精细约束 |

Range 对象只允许 minimum 与 maximum 两个必填键，可以自行附加 mean、stddev 等派生统计。JSON Schema 默认按 draft-07 解释，这是 STAC 全套 schema 用的版本。

一个实践中的坑：summaries 里的值必须符合被汇总字段自身的 schema。给 gsd 写 minimum: 0 会被拒（gsd 要求大于 0）；给 instruments 写字符串而不是字符串数组也会被拒。

### 2.2.4 item_assets

1.1.0 把 item_assets 从扩展并入了核心 Collection。它的作用是声明“本集合的 Item 里可能出现哪些 asset key”：

```json
{
  "item_assets": {
    "visual": {
      "title": "真彩色预览",
      "type": "image/tiff; application=geotiff; profile=cloud-optimized",
      "roles": ["data", "visual"],
      "gsd": 10
    },
    "thumbnail": {
      "title": "缩略图",
      "type": "image/png",
      "roles": ["thumbnail"]
    }
  }
}
```

两条约束：href 不是必填（它不指向具体数据）；**至少要有两个其他字段**（比如 title 加 type），否则无法有效描述。1.1.0 的修复项之一就是“item_assets 不是必填字段”——早期草稿里它被误标成必填。

## 2.3 Item 的字段与陷阱

### 2.3.1 字段表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定 "Feature" |
| stac_version | string | 是 | 如 "1.1.0" |
| stac_extensions | [string] | 否 | 扩展 URL 列表 |
| id | string | 是 | 在 Collection 内唯一 |
| geometry | GeoJSON Geometry 或 null | 是 | WGS84 经纬度；不允许 GeometryCollection |
| bbox | [number] | geometry 非 null 时必填 | 长度 2n |
| properties | object | 是 | 至少含 datetime |
| links | [Link] | 是 | 强烈建议 self 与 collection |
| assets | {string: Asset} | 是 | 键唯一 |
| collection | string | 条件必填 | 有 collection rel 时必须有 |

### 2.3.2 geometry 与 bbox 的三条硬规则

1. **geometry 为 null 时，bbox 必须缺席**。规范写的是“geometry 不为 null 时 bbox 必填，geometry 为 null 时 bbox 禁止出现”。很多生成器会给无几何的 Item 补一个全球 bbox，这是非法数据。
2. **bbox 是 2n 个数字**，顺序是西南角所有轴，再东北角所有轴。二维是 [west, south, east, north]，三维是 [west, south, minz, east, north, maxz]。
3. **API 的空间过滤必须用 geometry 求交，不能用 bbox**。规范原话：“STAC compliant APIs are required to compute intersection operations with the Item's geometry field, not its bbox”。用 bbox 做粗筛可以，但不能把 bbox 相交当成命中。

第 3 条在实际系统里经常被违反：为了性能，很多实现直接拿 bbox 建 GiST 索引并返回结果，导致“斜着飞的条带影像”被误命中。pgstac 的做法是对 geometry 建 GiST 索引（第 9 章会给 DDL），代价是索引更大。

### 2.3.3 datetime 与时间区间

properties.datetime 是必填，且必须是 UTC 的 RFC 3339 时间。当它没有意义（比如 100 年的时序产品）时可以写 null，但**此时必须同时提供 start_datetime 与 end_datetime**。

start_datetime 与 end_datetime 是**闭区间**，1.1.0 专门澄清了这一点：区间覆盖两个时间戳本身以及其间的全部时刻。

一个常见错误是把 datetime 写成带时区偏移的本地时间，比如 2023-05-01T08:00:00+08:00。RFC 3339 允许偏移，但 STAC 要求所有时间以 UTC 表示，正确写法是 2023-05-01T00:00:00Z。

### 2.3.4 assets 与 roles

Asset 的必填字段只有 href：

| 字段 | 类型 | 说明 |
|------|------|------|
| href | string | 相对或绝对 URI |
| title | string | 展示标题 |
| description | string | 处理说明，允许 CommonMark |
| type | string | 媒体类型 |
| roles | [string] | 语义角色 |

role 的取值是开放的，但有几个事实标准：thumbnail、overview、data、metadata。规范建议**每个 asset 至少给一个 role**，且鼓励给多个（数据文件通常同时是 data 与 visual）。

Asset 还允许“覆盖 Item 属性”的用法：Item 里写 gsd: 10 表示整体最优分辨率，某个 20 米波段的 asset 里再写 gsd: 20，读取时以 asset 为准。规范明确警告这种继承**不适用于检索**——“STAC API does not facilitate searching across Asset properties”，所以不要把可检索的字段只写在 asset 层。

## 2.4 扩展机制

### 2.4.1 stac_extensions 怎么写

每个扩展都有一个 Identifier，形式是 JSON Schema 的 URL，带版本号：

```text
https://stac-extensions.github.io/eo/v2.0.0/schema.json
https://stac-extensions.github.io/projection/v2.1.0/schema.json
https://stac-extensions.github.io/raster/v2.0.0/schema.json
```

三个要点：

- URL 必须指向 **schema.json**，不是扩展的文档页。校验器拿它去 fetch JSON Schema。
- 版本号在路径里，所以“升级扩展”意味着换 URL，而不是改字段。
- 1.1.0 的 schema 里，stac_extensions 的每项都会做 URI 校验；写成 "eo" 或 "eo/v2.0.0" 会直接失败。

### 2.4.2 bands：1.1.0 最大的变化

1.1.0 把 eo:bands 与 raster:bands 合并成了核心字段 **bands**，位置在 Item properties 或 asset 上，值是 Band Object 数组：

```json
{
  "type": "Feature",
  "stac_version": "1.1.0",
  "id": "LC08_L2SP_123032_20230501",
  "properties": {
    "datetime": "2023-05-01T03:12:45Z",
    "platform": "landsat-8",
    "instruments": ["oli", "tirs"],
    "gsd": 30
  },
  "assets": {
    "B04": {
      "href": "https://bucket.s3.amazonaws.com/l8/B04.tif",
      "type": "image/tiff; application=geotiff; profile=cloud-optimized",
      "roles": ["data"],
      "bands": [
        {
          "name": "B04",
          "eo:common_name": "red",
          "eo:center_wavelength": 0.655,
          "eo:full_width_half_max": 0.038,
          "data_type": "uint16",
          "nodata": 0,
          "raster:scale": 0.0000275,
          "raster:offset": -0.2,
          "statistics": {"minimum": 6000, "maximum": 15000}
        }
      ]
    }
  }
}
```

迁移规则（官方 best practices 给的）：

| 1.0.0 写法 | 1.1.0 写法 |
|------------|------------|
| eo:bands: [{"common_name": "red"}] | bands: [{"eo:common_name": "red"}] |
| raster:bands: [{"scale": 0.0001}] | bands: [{"raster:scale": 0.0001}] |
| eo:bands 与 raster:bands 按索引合并 | 同一个 Band Object 里合并 |

注意前缀规则：通用字段（name、description、nodata、data_type、statistics、unit）不加前缀；eo 与 raster 专有字段保留各自前缀。这条规则是迁移时最容易搞混的地方——把 common_name 写成不带前缀的 name 会静默丢失语义。

还有一条语义变化：**Item properties 里的 bands 不再表示“所有 asset 波段的并集”**。1.1.0 规定 properties 里的 bands 适用于所有 asset，除非 asset 自己定义了 bands。也就是说它从“汇总”变成了“默认值”。

### 2.4.3 projection 扩展

projection 扩展当前是 v2.1.0，v2.0.0 做了一次破坏性变更：**proj:epsg 被移除，改用 proj:code**。

| 字段 | 类型 | 说明 |
|------|------|------|
| proj:code | string 或 null | 形如 "EPSG:32650" |
| proj:wkt2 | string 或 null | WKT2 字符串 |
| proj:projjson | object 或 null | PROJJSON 对象 |
| proj:geometry | GeoJSON Geometry | 资产 CRS 下的范围 |
| proj:bbox | [number] | 资产 CRS 下的 bbox，4 或 6 个数 |
| proj:centroid | {lat, lon} | 质心，永远是经纬度 |
| proj:shape | [integer] | [height, width]，注意是 Y 在前 |
| proj:transform | [number] | 3×3 仿射矩阵，可省略最后一行，即 6 或 9 个数 |

迁移示例（官方原文）："proj:epsg": 32659 要改成 "proj:code": "EPSG:32659"。类型从整数变成字符串，下游代码里所有 int(proj:epsg) 都会炸。

proj:transform 的元素顺序是 rasterio 的顺序，不是 GDAL 的顺序。GDAL 的 GetGeoTransform 返回 (c, a, b, f, d, e)，需要重排：

```python
g = src.GetGeoTransform()
proj_transform = [g[1], g[2], g[0],
                  g[4], g[5], g[3],
                     0,    0,    1]
```

这个重排错误不会报错，只会让所有瓦片错位半个像素到几十公里，排查起来非常费时。

GDAL 要“不打开文件就能构造虚拟图层”，需要三组信息之一：

1. proj:code 或 proj:wkt2 或 proj:projjson（三者至少一个非 null）；
2. 加上 proj:transform 与 proj:shape，或 proj:transform 与 proj:bbox，或 proj:bbox 与 proj:shape。

只给 proj:code 不给 shape/transform，GDAL 仍然得打开文件读尺寸。

### 2.4.4 raster 扩展

raster 扩展 v2.0.0，成熟度 Candidate（不是 Stable，这一点和 eo、projection 不同）：

| 字段 | 类型 | 说明 |
|------|------|------|
| raster:sampling | string | area 或 point |
| raster:bits_per_sample | number | 实际位深，非标准位深时才写 |
| raster:spatial_resolution | number | 米 |
| raster:scale | number | DN 转物理量的乘数 |
| raster:offset | number | 加数 |
| raster:histogram | object | 直方图 |

v2.0.0 移除了 raster:bands，全部搬进核心 bands。所以现在 raster 扩展只剩下“单个波段上的采样与数值变换”这几项。

scale/offset 的语义是 value = scale × DN + offset。Sentinel-2 的 L2A 反射率用 0.0001 的 scale 把 1–10000 的整数映射到 0–1，文件体积是 float32 的四分之一。

### 2.4.5 eo 扩展

eo 扩展 v2.0.0，Stable：

| 字段 | 类型 | 说明 |
|------|------|------|
| eo:cloud_cover | number | 云量百分比 0–100 |
| eo:snow_cover | number | 雪冰覆盖 0–100 |
| eo:common_name | string | 波段通用名，如 red、nir |
| eo:center_wavelength | number | 中心波长，微米 |
| eo:full_width_half_max | number | FWHM，微米 |
| eo:solar_illumination | number | 太阳辐照度，W/m²/μm |

eo:bands 在 v2.0.0 被移除，改用核心 bands。eo 字段现在可以出现在 Band Object 里，带 eo: 前缀。

云量计算有一条容易忽略的要求：只统计有效数据区域，排除 nodata。如果做不到，就不该写这个字段——写一个包含 nodata 的云量比不写更糟，因为下游会当真。

## 2.5 校验

### 2.5.1 三层校验

| 层次 | 工具 | 检查内容 |
|------|------|----------|
| JSON Schema | jsonschema / pystac validate | 字段类型、必填、枚举、URI 格式 |
| 语义 | pystac validate_all / stac-check | 链接可达性、parent 一致性 |
| 业务 | 自写规则 | 时间范围合理、CRS 与 bbox 一致、asset 存在 |

JSON Schema 能查出绝大多数低级错误，但查不出“geometry 与 proj:bbox 描述的其实是两块地方”这种语义矛盾。

### 2.5.2 用 pystac 校验

```bash
python -m pip install 'pystac[validation]'
```

```python
import pystac

# 单文件校验：读进来再验证
item = pystac.Item.from_file("item.json")
item.validate()          # 抛 STACValidationError 表示不合法

# 整棵树校验，返回校验过的 Item 数量
cat = pystac.Catalog.from_file("catalog.json")
n = cat.validate_all()
print("validated items:", n)
```

validate_all 的签名是 validate_all(max_items=None, recursive=True)。大目录建议先给 max_items 设个上限试跑，否则一次校验几千个 Item 会拉满网络。

### 2.5.3 手工校验的边界

不装 pystac 时可以用 jsonschema 直接对 schema 校验，但 schema 里的 $ref 会指向同目录的 basics.json、datetime.json 等文件，需要一个能解析远程引用的 resolver，否则报 Unresolvable。pystac 的 validate 已经处理了这层，非必要不要自己搭。

## 2.6 排错

| 报错信息 | 原因 | 修法 |
|----------|------|------|
| 'bbox' is a required property | geometry 非 null 但没给 bbox | 从 geometry 算，或写 null geometry |
| 'bbox' should not be valid | geometry 为 null 却给了 bbox | 删掉 bbox |
| 'collection' is a required property | 有 collection rel 但缺 collection 字段 | 两处都补，或都删 |
| Additional properties are not allowed ('eo:bands' was unexpected) | 用了 1.1.0 schema 却写 1.0.0 字段 | 改成 bands |
| 'proj:epsg' was unexpected | projection v2 已移除该字段 | 改成 proj:code 字符串 |
| Unresolvable JSON reference | 手工校验时 $ref 解析失败 | 换 pystac，或预下载全部 schema |
| Item has no self link | 生成时没设 href | pystac 的 normalize_hrefs 会补 |

最后一条值得展开：pystac 的 Catalog 在内存里可以完全没有 href，直到调用 normalize_hrefs 或 save 才落盘。如果中间直接 to_dict() 输出，得到的 JSON 里 self 链接是缺失的，STAC Browser 打开会显示“无法确定当前节点”。

## 2.7 生产建议

**Collection 粒度按“共享元数据的最大集合”划，不要按目录结构划。** 一个卫星一个 Collection、一个处理级别一个 Collection 都合理；按年份切 Collection 通常不合理——年份应该进 Item 的 datetime，检索时用时间过滤。切得太碎的直接后果是 collections 参数要列一长串，而 STAC API 的 collections 参数是可选的性能优化点（第 10 章）。

**summaries 要覆盖会被用来过滤的字段。** 前端做筛选器时需要知道 eo:cloud_cover 的取值范围；不给 summaries，前端只能硬编码 0–100。

**stac_extensions 宁多勿少，但不要乱写。** 多写一个没用到的扩展只会让校验多 fetch 一个 schema；少写一个用到的扩展会让校验器放行非法数据。判断依据是“这个对象里是否真的出现了该扩展定义的字段”。

**把 proj:shape 与 proj:transform 当必填来对待。** 规范说它们可选，但没有它们，GDAL/TiTiler 每次都要打开文件读尺寸，冷启动多一次 Range 请求。第 13 章会看到 TiTiler 对这两个字段的依赖。

## 2.8 本章小结

| 要点 | 结论 |
|------|------|
| 对象关系 | Catalog ⊃ Collection ⊃ Item ⊃ Asset，靠 Link 连成图 |
| rel 约束 | Item 不能有 item rel；collection 字段与 collection rel 绑定 |
| 1.1.0 关键变化 | bands 进入核心、item_assets 进入核心、Link 增加 method/headers/body |
| 扩展字段 | proj:epsg → proj:code；eo:bands/raster:bands → bands |
| 校验 | pystac[validation] 的 validate / validate_all 覆盖 schema 层 |
| 常见坑 | geometry 与 bbox 互斥、时间必须 UTC、末尾斜杠有语义 |

下一章转向像素侧：COG 的内部结构，以及 OGC 21-026 的每一条硬约束对应的实际字节布局。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第01章-影像云原生全景与架构定位/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第03章-COG云优化GeoTIFF原理/" class="chapter-nav__next">下一章 →</a>
</div>
