---
layout: default
title: 第07章 - 静态 STAC 目录构建
---

# 第07章 - 静态 STAC 目录构建

不是所有影像目录都需要一个 API 服务。数据量在几万景以内、更新频率低、检索需求简单（按集合、按时间、按范围浏览）时，一套纯静态的 JSON 目录放在对象存储或 GitHub Pages 上，成本接近零，可用性由 CDN 保证，且可以被任何 STAC 客户端直接爬取。

代价是**没有服务端检索**。静态目录只能靠客户端把 JSON 拉下来自己过滤；几万个 Item 时，客户端要发几万个请求——这是静态方案的天花板。

这一章用 pystac 从一堆 COG 生成目录，重点讲三件容易做错的事：链接类型怎么选、href 怎么组织、元数据从哪来。最后给一条“多少 Item 该换 API”的判断线。

## 7.1 静态目录的三种形态

pystac 的 CatalogType 决定写盘时链接怎么写：

| 类型 | self 链接 | 层级链接 | 适用 |
|------|-----------|----------|------|
| ABSOLUTE_PUBLISHED | 每个对象都有 | 绝对 URL | 已发布到固定域名，可被任意位置引用 |
| RELATIVE_PUBLISHED | 只有根有 | 相对 URL | 目录整体搬迁，但根位置已知 |
| SELF_CONTAINED | 都没有 | 相对 URL | 打包分发、离线浏览、随数据一起移动 |

默认是 ABSOLUTE_PUBLISHED。三种的实际差异：

```python
import pystac

cat = pystac.Catalog(id="demo", description="demo", catalog_type=pystac.CatalogType.SELF_CONTAINED)
print(cat.catalog_type)
# CatalogType.SELF_CONTAINED
```

选错的后果很具体：

- 用 ABSOLUTE_PUBLISHED 但域名还没定 → 生成的 JSON 里全是 http://localhost:8000/...，发布后全是死链。
- 用 SELF_CONTAINED 但客户端从别处引用 → 没有 self 链接，STAC Browser 无法确定“当前节点是谁”，面包屑与刷新都会出问题。
- 用 RELATIVE_PUBLISHED 但目录被移动过 → 相对链接基于根目录计算，移动后仍然有效，这是它相对 SELF_CONTAINED 的唯一优势。

我的建议：**对外发布的目录用 ABSOLUTE_PUBLISHED，随数据分发的用 SELF_CONTAINED，中间态用 RELATIVE_PUBLISHED**。不要混用。

## 7.2 从 COG 提取元数据

Item 的字段大多能从 COG 自身读出来。下面这个函数把 rasterio 的元数据映射成 STAC 字段：

```python
import rasterio
from rasterio.warp import transform_bounds
from rasterio.crs import CRS

def cog_to_props(path: str) -> dict:
    """从 COG 读出 STAC Item 需要的几何与投影字段。"""
    with rasterio.open(path) as src:
        # WGS84 的 bbox 与 geometry（STAC 要求经纬度）
        if src.crs is None:
            raise ValueError(f"{path}: 缺少 CRS，无法生成 STAC Item")
        left, bottom, right, top = transform_bounds(
            src.crs, CRS.from_epsg(4326),
            *src.bounds, densify_pts=21,
        )
        bbox = [left, bottom, right, top]

        # 多边形足迹：COG 是矩形网格，四个角即可
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [left, bottom], [right, bottom],
                [right, top], [left, top], [left, bottom],
            ]],
        }

        # proj:transform 用 rasterio 的顺序，9 个元素
        t = src.transform
        proj_transform = [
            t.a, t.b, t.c,
            t.d, t.e, t.f,
            0.0, 0.0, 1.0,
        ]

        props = {
            "proj:code": f"EPSG:{src.crs.to_epsg()}" if src.crs.to_epsg() else None,
            "proj:shape": [src.height, src.width],
            "proj:transform": proj_transform,
            "proj:bbox": list(src.bounds),
            "gsd": abs(src.transform.a),
        }
        # 清理 None，避免写出非法字段
        props = {k: v for k, v in props.items() if v is not None}
        return {"bbox": bbox, "geometry": geometry, "properties": props}
```

三个细节：

**densify_pts=21。** transform_bounds 默认只转换四个角，投影变换是非线性的，四个角连成的矩形会切掉一部分真实范围。21 个点是 GDAL 的常用值。

**proj:transform 用 9 个元素。** 规范允许 6 或 9，9 个更明确，避免下游对“最后一行是否省略”的判断分歧。

**proj:shape 是 [height, width]。** 顺序是 Y 在前。写成 [width, height] 会让 GDAL 构造虚拟图层时宽高颠倒，瓦片全错位——这个错误不会报错。

## 7.3 构建一个 Collection

Collection 的元数据大多来自业务约定，只有 extent 需要从数据算：

```python
import datetime as dt
import pystac

def make_collection(collection_id: str, title: str, items: list[pystac.Item]) -> pystac.Collection:
    """用一批 Item 反算 extent，构造 Collection。"""
    bboxes = [it.bbox for it in items if it.bbox]
    west = min(b[0] for b in bboxes)
    south = min(b[1] for b in bboxes)
    east = max(b[2] for b in bboxes)
    north = max(b[3] for b in bboxes)

    times = [it.datetime for it in items if it.datetime]
    start = min(times)
    end = max(times)

    extent = pystac.Extent(
        spatial=pystac.SpatialExtent([[west, south, east, north]]),
        temporal=pystac.TemporalExtent([[start, end]]),
    )

    return pystac.Collection(
        id=collection_id,
        description=f"{title}：{len(items)} 景，{start:%Y-%m-%d} 至 {end:%Y-%m-%d}",
        extent=extent,
        title=title,
        license="CC-BY-4.0",
        providers=[
            pystac.Provider(
                name="示例数据提供方",
                roles=[pystac.ProviderRole.PRODUCER, pystac.ProviderRole.HOST],
                url="https://example.com",
            )
        ],
        keywords=["landsat", "surface-reflectance"],
        summaries={
            "platform": ["landsat-8", "landsat-9"],
            "gsd": pystac.Summaries({"minimum": 30, "maximum": 30}),
        },
    )
```

summaries 的写法有两个坑：

- 传字典时键必须是被汇总的字段名，值是枚举数组或 Range 对象。pystac 的 Summaries 类会做基本校验。
- Range 的键是 minimum / maximum，不是 min / max。1.1.0 的变更日志专门修过这个（早期 schema 里写的是 min/max）。

license 字段在 1.1.0 要求 SPDX 标识符或 other。写 "proprietary" 或 "various" 会通过 schema（因为标了 deprecated 而非 removed），但会在校验时给出警告，未来版本会移除。

## 7.4 构建 Item 与 Asset

一个完整的 Item 构造：

```python
import pystac
from pystac.utils import datetime_to_str

def make_item(item_id: str, cog_path: str, href: str, acquisition: dt.datetime) -> pystac.Item:
    meta = cog_to_props(cog_path)
    bbox = meta["bbox"]
    geometry = meta["geometry"]

    item = pystac.Item(
        id=item_id,
        geometry=geometry,
        bbox=bbox,
        datetime=acquisition,
        properties={
            "platform": "landsat-8",
            "instruments": ["oli", "tirs"],
            "gsd": 30,
            "created": datetime_to_str(dt.datetime.now(dt.timezone.utc)),
            **meta["properties"],
        },
    )

    item.add_asset(
        "visual",
        pystac.Asset(
            href=href,
            media_type="image/tiff; application=geotiff; profile=cloud-optimized",
            roles=["data", "visual"],
            title="真彩色合成（B04/B03/B02）",
            extra_fields={
                "bands": [
                    {"name": "B04", "eo:common_name": "red",
                     "data_type": "uint16", "nodata": 0,
                     "raster:scale": 0.0000275, "raster:offset": -0.2},
                    {"name": "B03", "eo:common_name": "green",
                     "data_type": "uint16", "nodata": 0,
                     "raster:scale": 0.0000275, "raster:offset": -0.2},
                    {"name": "B02", "eo:common_name": "blue",
                     "data_type": "uint16", "nodata": 0,
                     "raster:scale": 0.0000275, "raster:offset": -0.2},
                ]
            },
        ),
    )

    item.add_asset(
        "thumbnail",
        pystac.Asset(
            href=href.replace(".tif", "_thumb.png"),
            media_type="image/png",
            roles=["thumbnail"],
            title="缩略图",
        ),
    )

    return item
```

几个决定值得解释：

**extra_fields 而不是扩展助手。** 2026 年春季起，pystac 的扩展实现（pystac.extensions.eo、projection、raster）拆成了独立包 pystac-ext-eo、pystac-ext-projection、pystac-ext-raster，版本与扩展规范对齐。用 extra_fields 直接写字段，省掉三个依赖，且不受拆分影响。代价是没有类型检查。

**media_type 写全。** image/tiff; application=geotiff; profile=cloud-optimized 是 IANA 注册的类型，profile 参数告诉客户端“这是 COG”。很多客户端据此决定要不要走 Range 读取。

**roles 给两个。** data 表示这是数据，visual 表示可以可视化。STAC Browser 的资产选择逻辑会优先挑带 visual 的。

**thumbnail 的 href 是猜的。** 生产上应该先生成缩略图再写 href，不要写一个不存在的路径——STAC Browser 会去请求它，404 会在控制台刷一片红。

## 7.5 组织层级与写盘

### 7.5.1 两种组织方式

```text
方式 A：Collection 下平铺所有 Item
catalog.json
└─ collection.json
   ├─ items/LC08_001.json
   ├─ items/LC08_002.json
   └─ ...（几千个）

方式 B：按时间或空间分子目录
catalog.json
└─ collection.json
   ├─ 2023/05/LC08_001.json
   ├─ 2023/06/LC08_002.json
   └─ ...
```

方式 A 的问题是 collection.json 里会有几千条 item 链接，文件本身几百 KB，客户端拉一次就要几百 KB；方式 B 把链接分散到子 Catalog，每次只拉一层。

但方式 B 会引入子 Catalog，而 STAC 的 Collection 里不能再嵌 Collection（只能是 Item 或子 Catalog）。所以结构上要么用 Catalog 组织（Collection 作为叶子），要么接受 Collection 直接挂所有 Item。

实践中更常见的第三种：**Collection 直接挂 Item，但把 Item 的 JSON 分目录存放**。链接仍然在 collection.json 里，只是 href 指向不同目录。这样避免了子 Catalog 的语义问题，但没解决“collection.json 太大”。

```python
# 分目录存放，链接仍在 Collection 上
item.set_self_href(f"{base}/items/{date:%Y/%m}/{item_id}.json")
```

我的建议：**Item 数少于 5000 用平铺，超过就上 API**。硬要在静态目录里塞十万个 Item，客户端的爬取成本会超过自建服务的成本。

### 7.5.2 normalize_hrefs 与 save

pystac 的写盘分两步：先算 href，再落盘。

```python
cat = pystac.Catalog(id="demo", description="示例影像目录")
cat.add_child(collection)
collection.add_items(items)

# 1. 算 href：按 id 生成路径
cat.normalize_hrefs("https://cdn.example.com/stac")

# 2. 落盘：写本地目录
cat.save(catalog_type=pystac.CatalogType.ABSOLUTE_PUBLISHED, dest_href="./dist")
```

normalize_hrefs 的参数是**发布后的根 URL**，不是本地路径。它据此生成每个对象的绝对 href。save 的 dest_href 才是本地写盘位置。

两者不一致时会出现“本地文件里的 self 链接指向 CDN，但文件在 ./dist”——这正是我们想要的：本地生成、上传 CDN、链接直接可用。

save 之后目录结构：

```text
dist/
├── catalog.json
└── demo/
    └── collection.json
        ├── item-001/item-001.json
        └── item-002/item-002.json
```

每个 Item 一个目录、目录里同名 JSON，这是 pystac 的默认布局策略。想改成扁平结构，用 strategy 参数：

```python
from pystac.layout import AsIsLayoutStrategy

cat.normalize_hrefs("https://cdn.example.com/stac", strategy=AsIsLayoutStrategy())
```

AsIsLayoutStrategy 会保留对象已有的 self href 路径。适合“文件名已经规划好”的场景。

## 7.6 完整生成脚本

把上面的片段拼成一个可跑的脚本：

```python
#!/usr/bin/env python3
"""从 COG 目录生成静态 STAC 目录。"""
import argparse
import datetime as dt
from pathlib import Path

import pystac

from stac_meta import cog_to_props, make_collection, make_item   # 前面定义的函数


def build(src_dir: Path, out_dir: Path, base_url: str, collection_id: str) -> None:
    cogs = sorted(src_dir.rglob("*.tif"))
    if not cogs:
        raise SystemExit(f"no .tif under {src_dir}")

    items = []
    for cog in cogs:
        # 用文件名当 id，生产上应该用数据提供方的原始 id
        item_id = cog.stem
        # 从文件名解析时间，这里假设形如 LC08_123032_20230501.tif
        date_part = item_id.split("_")[-1]
        acq = dt.datetime.strptime(date_part, "%Y%m%d").replace(tzinfo=dt.timezone.utc)

        href = f"{base_url}/imagery/{cog.parent.name}/{cog.name}"
        items.append(make_item(item_id, str(cog), href, acq))

    collection = make_collection(collection_id, "示例 Landsat 集合", items)
    collection.add_items(items)

    root = pystac.Catalog(
        id="demo-catalog",
        description="示例影像目录",
        title="示例影像目录",
    )
    root.add_child(collection)

    root.normalize_hrefs(f"{base_url}/stac")
    root.save(catalog_type=pystac.CatalogType.ABSOLUTE_PUBLISHED, dest_href=str(out_dir))

    n = root.validate_all()
    print(f"wrote {len(items)} items, validated {n}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--collection", default="demo-landsat")
    args = ap.parse_args()
    build(args.src, args.out, args.base_url.rstrip("/"), args.collection)
```

```bash
python build_stac.py ./cog ./dist --base-url https://cdn.example.com
# wrote 128 items, validated 128
```

validate_all 返回的是校验过的 Item 数量。它需要 pystac[validation]，否则会抛 ImportError 提示装 jsonschema。

## 7.7 发布与托管

### 7.7.1 对象存储

```bash
# 上传，注意 Content-Type
aws s3 sync ./dist s3://my-bucket/stac \
  --exclude "*" --include "*.json" \
  --content-type "application/json" \
  --cache-control "public, max-age=300"

# Item 文件用 geo+json
aws s3 sync ./dist s3://my-bucket/stac \
  --exclude "*" --include "*/item.json" \
  --content-type "application/geo+json" \
  --cache-control "public, max-age=3600"
```

Content-Type 很重要：application/json 与 application/geo+json 会让某些客户端走不同的解析路径。cache-control 给 300 秒是因为目录会更新；Item 变化少，可以给 3600。

### 7.7.2 GitHub Pages

静态目录放 GitHub Pages 有个硬限制：**不支持自定义响应头**，所以没法配 CORS。这意味着浏览器里的 STAC Browser 读不了 Pages 上的目录（同源除外）。

可行方案是把 STAC Browser 与目录部署在同一个 Pages 站点下，同源就不需要 CORS。第 11 章会给具体做法。

另一个限制是 historyMode 必须用 hash——Pages 不支持 URL 重写，history 模式刷新会 404。

## 7.8 排错

| 现象 | 原因 | 修法 |
|------|------|------|
| STAC Browser 打开根节点显示“无法加载” | 根 catalog 缺 self 链接 | 用 ABSOLUTE_PUBLISHED 重新 save |
| 点进 Item 后 404 | normalize_hrefs 的根 URL 与实际上传路径不一致 | 检查 base_url 与桶内前缀 |
| validate_all 报 'bbox' is required | geometry 非 null 但 bbox 为 None | 用 cog_to_props 的返回值 |
| Collection 的 extent 是全世界的 | 没有 Item 时算不出范围，用了默认值 | 先加 Item 再算 extent |
| summaries 校验失败 | 用了 min/max 而不是 minimum/maximum | 改成规范字段名 |
| Item 的 href 是相对路径但客户端解析错 | 混用了 SELF_CONTAINED 与绝对 base | 统一 catalog_type |
| pystac 报 Unresolvable JSON reference | 缺 pystac[validation] | 装 extras |

第一条与第三条最常见。第一条的根因是：pystac 在内存里可以没有 href，直接 to_dict() 输出的 JSON 就没有 self 链接；必须走 normalize_hrefs + save。

## 7.9 生产建议

**把生成过程做成幂等的。** 同一个输入跑两次，输出应该字节一致（除了 created 时间戳）。做法是排序输入、固定时间字段、不用随机 id。这样可以用 diff 判断“这次到底改了什么”。

**Collection 的 extent 与 summaries 每次重建都重算。** 手工维护一定会过期。重算的成本是遍历所有 Item，几万个以内可以接受。

**给 Item 加一个 checksum 字段。** 对象存储的 ETag 对分片上传不可靠，自己算 sha256 存进 properties，便于发现“元数据没变但文件变了”。

**静态目录也要有 CI 校验。** 一条 pystac validate_all 加一条 check-internal-links，能拦住 90% 的发布事故。

**规划好“什么时候换 API”。** 判断线不是 Item 数量，而是查询模式：如果用户需要“按空间范围 + 时间 + 云量过滤”，静态目录做不到，就该上第 8 章的 stac-fastapi。

## 7.10 本章小结

| 要点 | 结论 |
|------|------|
| catalog_type | 对外用 ABSOLUTE_PUBLISHED，分发用 SELF_CONTAINED |
| 元数据来源 | 从 COG 读 CRS、bounds、transform、shape，densify 后再转 WGS84 |
| 关键字段 | proj:shape 是 [高, 宽]；proj:transform 用 9 元素 rasterio 顺序 |
| 写盘 | normalize_hrefs 给发布 URL，save 给本地路径 |
| 校验 | validate_all 返回 Item 数，需要 pystac[validation] |
| 规模上限 | 5000 个 Item 以内平铺；需要组合过滤就上 API |

下一章开始搭服务：stac-fastapi 的分层结构、如何实现一个后端、扩展怎么装、以及从零写一个最小可用的内存后端。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第06章-对象存储与HTTPRange访问/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第08章-stac-fastapi服务开发/" class="chapter-nav__next">下一章 →</a>
</div>
