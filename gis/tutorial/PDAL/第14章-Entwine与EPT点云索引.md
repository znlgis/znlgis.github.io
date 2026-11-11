---
layout: default
title: 第14章 - Entwine 与 EPT 点云索引
---

# 第14章 - Entwine 与 EPT 点云索引

一个 4000 万点的 LAS 文件，`pdal info --summary` 要读完全部数据；`filters.smrf` 要把它整块装进内存；到了 Web 端，用户只想要某个街区，却必须下载整个文件。点云处理的所有这些不便，都来自同一个事实：**LAS/LAZ 是顺序文件，没有空间索引**。

EPT（Entwine Point Tile）就是给点云补上空间索引的格式：一个八叉树目录、每层按瓦片切分、每块单独存放，`ept.json` 描述范围、层级、schema 和每块的点数。PDAL 通过 `readers.ept` 原生读取，配合 `bounds`/`resolution`/`polygon` 就能只下载需要的那几块。Entwine 是生成 EPT 的工具，PDAL 是消费 EPT 的工具，两者都出自 Hobu。

本章讲 EPT 的数据组织方式、用 Entwine 建索引、用 `readers.ept` 做空间与分辨率查询，以及一条实测过的坑：EPT 的 `forward` 在 writer 侧不可用。

## 14.1 为什么需要点云索引

### 14.1.1 顺序文件的三个代价

| 代价 | 具体表现 |
|---|---|
| 全量 I/O | 查 1 km² 的街区要从头解压整个 LAZ |
| 内存峰值 | 非流式算法要求整个 view 在内存里，1 亿点约 3–6 GB |
| 无法局部更新 | 追加/修改任意区域都要重写文件 |

EPT 的解法是把点云切成"八叉树 + 瓦片"：根节点覆盖全域，每深入一层分成 8 个子节点（2×2×2），每个节点内再按点数切成若干块（`ept-data/` 目录下的 `.laz`）。查询时先读 `ept.json` 拿到边界与层级，判断哪些节点与查询范围相交，只下载相交的节点。

### 14.1.2 EPT 与 COPC 的分工

两者都是八叉树点云格式，差别在封装：

| | EPT | COPC |
|---|---|---|
| 形态 | 目录树：`ept.json` + `ept-data/` + `entwine-files.json` | 单个 `.laz` 文件（1.4 + 内部层级索引） |
| 适合 | 云端发布、增量更新、几亿到上千亿点 | 分发单个文件、单文件内随机访问 |
| PDAL 读取 | `readers.ept` | `readers.copc` |
| 生成工具 | Entwine（`entwine build`） | `writers.copc`（PDAL 自带） |

一个常见架构是：原始数据用 `writers.copc` 落成单文件（第 07 章），发布到 Web 时用 Entwine 转成 EPT 挂 CDN。两者不冲突。

## 14.2 Entwine 建索引

### 14.2.1 安装与构建命令

Entwine 与 PDAL 一样通过 conda-forge 分发：

```bash
conda create -n ept -c conda-forge entwine pdal
conda activate ept
entwine --version
```

最小构建命令（PDAL 官方 workshop 里的原样用法）：

```bash
entwine build -i ./just-ground.laz -o ./dublin-ground-ept
```

也可以先把多个文件塞进一个文本清单：

```bash
ls /data/2024/*.laz > files.txt
entwine build -i files.txt -o /data/ept/2024 --threads 8
```

构建结束后目录结构大致如下（层级数取决于数据范围，块大小取决于点数）：

```text
dublin-ground-ept/
├── ept.json                # 元数据：bounds、schema、span、层级、每块点数
├── ept-data/               # 点数据瓦片，按 层级-坐标.laz 命名
│   ├── 0-0-0-0.laz
│   ├── 1-0-0-0.laz
│   └── ...
├── ept-sources/            # 每个源文件的边界与 SRS 信息
│   ├── list.json
│   └── 0.json
└── entwine-files.json      # 源文件清单（origin 选项要用）
```

### 14.2.2 ept.json 里有什么

`ept.json` 是 EPT 的入口，PDAL 打开 `readers.ept` 时第一件事就是取它。关键字段：

| 字段 | 含义 | 对查询的影响 |
|---|---|---|
| `bounds` / `boundsConforming` | 数据范围（前者可能被投影或离群点夸大） | `bounds` 查询的重叠判断 |
| `schema` | 每个维度的名字、类型、size | `addons` 覆盖同名维度时按此匹配 |
| `span` | 每个节点在 X/Y 方向的瓦片格数 | 决定节点内分块数量 |
| `hierarchyType` | 层级编码方式（`json` 或 `gzip`） | 读层级表的解码方式 |
| `points` | 总点数 | `pdal info` 的 count 上限 |
| `srs` | 水平/垂直 SRS 的 WKT 与 authority | 与 `readers.ept` 的 `spatialreference` 交互 |

`bounds` 与 `boundsConforming` 的区别值得记住：`bounds` 是轴对齐外接盒，可能因为投影或离群点而远大于真实数据；`boundsConforming` 是贴合真实数据的范围。写查询时用后者更省流量。

## 14.3 readers.ept 的查询能力

### 14.3.1 参数表

| 参数 | 类型 | 默认 | 作用 |
|---|---|---|---|
| `filename` | string | 必填 | 必须指向 `ept.json` 本身（PDAL 2.2+ 起的行为） |
| `bounds` | string | 整个资源 | 2D/3D 范围，格式 `([minx,maxx],[miny,maxy],[minz,maxz])` |
| `resolution` | double | 不限 | 网格边长（坐标单位）；`0.1` 米约等于 100 点/m² |
| `polygon` | WKT | 无 | 裁剪多边形，可重复指定并取并集；可跟 `/SRS` 后缀 |
| `ogr` | JSON | 无 | 用 OGR 查询取多边形，等价于 `polygon` |
| `addons` | JSON | 无 | `维度名: addon 路径`，覆盖同名维度 |
| `origin` | string/int | 无 | 只取某个源文件的点（路径子串或 `OriginId`） |
| `requests` | int | **15**（最小 4） | 并发请求数 |
| `ignore_unreadable` | bool | `false` | 忽略缺失/损坏的瓦片 |
| `spatialreference` | string | 无 | 覆盖数据自带 SRS |

`filename` 必须是 `ept.json` 的完整 URL 或路径，这是 PDAL 2.2 的行为变更——旧代码里写目录或以 `/` 结尾，升级后会打不开。

### 14.3.2 按范围取数

官方示例，从纽约 47 亿点数据集里取自由女神像周边：

```json
[
  {
    "type": "readers.ept",
    "filename": "https://na-c.entwine.io/nyc/ept.json",
    "bounds": "([-8242669, -8242529], [4966549, 4966674])"
  },
  "statue-of-liberty.las"
]
```

`bounds` 是两段还是三段决定了是否裁剪 Z。两段只做水平裁剪，三维范围的写法是 `([minx,maxx],[miny,maxy],[minz,maxz])`。

### 14.3.3 按分辨率取数：先降采样再算

`resolution` 是 EPT 最有用的参数。它的语义是"网格单元边长"，单位跟资源坐标系一致：米制坐标下 `0.1` 表示每平方米最多 100 点。PDAL 会选一个"不低于该精度"的层级，所以实际点数可能略多于预期。

做区域统计、生成缩略视图、试算参数时，先用 `resolution` 把数据降到百万级再迭代，比全量跑一遍快一到两个数量级：

```bash
pdal info "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/IA_FullState/ept.json" \
  --readers.ept.bounds="([-10425171.940, -10423171.940], [5164494.710, 5166494.710])" \
  --readers.ept.resolution=2.0 \
  --summary
```

这里的 `--readers.ept.xxx=...` 是命令行的 option 覆盖写法，和 `pdal pipeline` 的 JSON 等价。

### 14.3.4 多边形裁剪与 SRS 后缀

`polygon` 接受 WKT，可以给多个（数组形式，取并集），每个后面能跟 `/SRS` 声明自己的坐标系：

```json
{
  "type": "readers.ept",
  "filename": "https://example.com/ept/ept.json",
  "polygon": [
    "POLYGON((500000 4500000, 500500 4500000, 500500 4500500, 500000 4500500, 500000 4500000))/EPSG:32633"
  ]
}
```

`bounds` 与 `polygon` 同时给时取**交集**。这一点官方文档写得很明确，但实践中容易误以为 `polygon` 会覆盖 `bounds`。

## 14.4 EPT 的增量属性：addon

### 14.4.1 为什么不重写整个索引

给一个已经发布的 EPT 加一种分类结果（比如重跑 SMRF 得到的 `Classification`），最笨的办法是重建 EPT——几亿点要跑几小时。EPT 提供了 addon 机制：新维度独立存放，读的时候按名字挂上去。

`writers.ept_addon` 的 `addons` 是 `addon 路径: 维度名`（注意方向），而 `readers.ept` 的 `addons` 是 `维度名: addon 路径`——两边相反，官方文档专门用 note 强调过。

写入：

```json
[
  { "type": "readers.ept", "filename": "http://na.entwine.io/autzen/ept.json" },
  { "type": "filters.assign", "assignment": "Classification[:]=0" },
  { "type": "filters.smrf" },
  {
    "type": "writers.ept_addon",
    "addons": { "~/entwine/addons/autzen/smrf": "Classification" }
  }
]
```

读取时覆盖：

```json
[
  {
    "type": "readers.ept",
    "filename": "http://na.entwine.io/autzen/ept.json",
    "addons": { "Classification": "~/entwine/addons/autzen/smrf" }
  },
  { "type": "writers.las", "filename": "autzen-ept-smrf.las" }
]
```

addon 的数据与 EPT 主体分开存放，所以写 addon **不需要对 EPT 资源有写权限**。这对发布在 S3 上的只读数据集很关键：可以在本地或另一个桶里维护自己的分类结果。

`writers.ept_addon` 的 `threads` 也有个细节：无论传多少，最小按 4 个线程执行。

## 14.5 云端读取的机制与坑

### 14.5.1 只下载需要的那几块

`readers.ept` 支持 `http(s)://`、`s3://`、`gs://` 等 URL（依赖 GDAL 的 VSI 层）。查询流程是：取 `ept.json` → 取层级表 → 对每个候选节点发 HTTP Range 请求取该块 → 解压 → 与本地的其他 stage 一样流式处理。`requests` 控制同时在途的请求数，默认 15；调大能提升高延迟链路的吞吐，但云端按请求计费时要注意成本。

实测经验：跨洲访问 S3 时，`requests=15` 的默认值通常已经能把带宽打满；真正拖慢速度的是 `resolution` 选得太细——数据量按 4 倍阶梯增长。

### 14.5.2 坑一：forward 对 EPT 无效

`writers.las`/`writers.copc` 的 `forward` 依赖"单一源文件的头信息"。EPT 是多个源文件混合而成的，没有统一可转发的元数据。官方文档明确写了：`forward` 与 EPT **不能配合使用**，输出选项必须显式设置。

具体后果：如果想把 EPT 读出来写成 LAS 1.4，得自己指定 `minor_version`、`dataformat_id`、`scale_x/y/z`、`offset_x/y/z`，否则会拿到 writer 的默认值（1.4、格式 7、scale 0.01）。在投影坐标下 0.01 米没问题；转到地理坐标就会踩第 11 章讲过的精度坑。

### 14.5.3 坑二：origin 选中的点数是上限

`origin` 按源文件挑点，可以传路径子串或整数 `OriginId`。字符串形式要求**子串唯一**：官方例子给了 `one.las`、`two.las`、`two.bpf` 三个源文件，`"one"` 能唯一选中，`"two"` 会匹配两个文件而失败。

另一个官方 note：配合 `pdal info --summary` 时，`origin` 会让 bounds 裁剪到选中源的范围，但点数只是**上限**——因为 summary 不是精确计数。做入库对账时不能把这个数当准数。

### 14.5.4 坑三：无 bounds 的查询

不写 `bounds` 就取整个资源。Iowa 全州 3DEP 公开数据集约 **1600 亿点**，官方教程专门加了一句警告。任何面向用户的查询接口都应该强制要求 `bounds` 或 `polygon`，并在 `resolution` 上设下限。

## 14.6 排错清单

| 现象 | 原因 | 修法 |
|---|---|---|
| `Unable to open ... ept.json` | `filename` 给的是目录而非 `ept.json` | PDAL 2.2+ 必须给完整文件名 |
| `404` 或某个瓦片读不到 | 瓦片缺失或 addon 路径错 | 开 `ignore_unreadable` 跳过；检查 addon 路径 |
| 查询返回 0 点 | `bounds` 落在数据范围外 | 用 `pdal info` 读 `ept.json` 的 `bounds` 修正范围 |
| 点数远超预期 | 没设 `resolution`，选中了全部层级 | 加 `resolution`，按目标精度估算 |
| 读取很慢 | `requests` 太小，或跨洲访问 | 调大 `requests`（≥4）；就近部署 |
| addon 维度没生效 | 读写两侧 `addons` 方向写反 | reader 是 `维度: 路径`，writer 是 `路径: 维度` |
| `origin` 报歧义 | 子串匹配到多个源文件 | 用更长的路径子串或整数 `OriginId` |
| 输出 SRS/scale 丢了 | 用了 `forward` | EPT 不支持 `forward`，显式设 writer 参数 |

## 14.7 生产建议

**原始数据保留 COPC 或 LAZ，发布层才用 EPT。** EPT 的目录结构适合对象存储 + CDN，但文件碎片多（百万点级数据集可能上万个瓦片），备份、迁移、校验都比单文件麻烦。COPC 单文件更适合归档与分发。

**`resolution` 作为服务端强制参数。** 面向 Web 的取数接口按视距换算 `resolution`（例如屏幕 1 像素对应 1 米时取 1.0），而不是让客户端直接读全精度。

**addon 承载派生属性。** 分类结果、强度归一化结果、自研特征都做成 addon，原始 EPT 保持只读。这样重跑算法不触碰主体数据，也不需要重建索引。

**监控请求数与流量。** `requests` 与 `resolution` 决定了单次查询的请求数和字节数；把这两个值记进访问日志，容量规划时才有依据。

## 14.8 本章小结

| 主题 | 结论 |
|---|---|
| EPT 本质 | 八叉树 + 瓦片目录，`ept.json` 为入口，适合云端发布 |
| 建索引 | `entwine build -i <清单或目录> -o <输出目录>` |
| 读取入口 | `readers.ept`，`filename` 必须是 `ept.json` 完整路径（2.2+） |
| 空间查询 | `bounds`（2D/3D）、`polygon`（WKT，可多个取并集），两者同时给取交集 |
| 分辨率 | `resolution` 为网格边长，米制下 0.1 ≈ 100 点/m²，实际可能更精细 |
| 并发 | `requests` 默认 15，最小 4 |
| 增量属性 | `writers.ept_addon` 写、`readers.ept` 的 `addons` 读，两侧键值方向相反 |
| 已知限制 | `forward` 不适用于 EPT；`origin` 的 summary 点数是上限 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第13章-C++开发与自定义Stage/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第15章-点云分割聚类与特征提取/" class="chapter-nav__next">下一章 →</a>
</div>
