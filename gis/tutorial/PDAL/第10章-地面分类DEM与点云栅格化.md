---
layout: default
title: 第10章 - 地面分类、DEM 与点云栅格化
---

# 第10章 - 地面分类、DEM 与点云栅格化

## 10.1 从点云到 DEM 的三段路

DEM 不是“点云一插值就出来的图”。中间至少隔三道处理，每一道都会影响最终精度：

```text
原始点云            ┌─ 噪声点剔除 ─┐   ┌─ 地面点识别 ─┐   ┌─ 栅格插值 ─┐
(raw)  ───────────▶│ ELM/outlier  │──▶│ SMRF/PMF/CSF │──▶│ writers.gdal│──▶ DEM
                    └──────────────┘   └──────────────┘   └────────────┘
                                           │
                                           └─▶ 归一化高度 HeightAboveGround
```

错误会沿链路放大：噪声没清干净，地面分类会拿噪声当“最低点”参考，整片地形被拉低；分类漏掉建筑边缘或误吞植被，DEM 出现台阶与隆起；插值参数选错，把点云问题变成栅格问题。

所以判据是：**分类质量决定 DEM 的形状，插值参数只决定分辨率外观**。先分类，再调插值。

## 10.2 地面分类：三种算法的取舍

PDAL 提供三个主流地面滤波：SMRF、PMF、CSF，都把地面点标为 `Classification = 2`。选型取决于地形与数据特征，不是“哪个新用哪个”。

| 算法 | 原理 | 强项 | 弱项 |
|------|------|------|------|
| `filters.smrf` | 简单形态学 + 可调坡度/阈值 | 综合表现最好，对城市与山地都稳 | 参数相对多，极陡地形需调 |
| `filters.pmf` | 渐进形态学开运算 | 经典方法，平坦地形表现好 | 官方明确说 SMRF “performs much better”，有退化行为 |
| `filters.csf` | 布料模拟（Cloth Simulation） | 反坡地形（如挖方、桥下）表现好 | 参数物理意义不直观，调参依赖经验 |

官方在 `filters.pmf` 页面顶部直接警告：`filters.smrf` performs much better, with fewer degenerate behaviors. You should prefer this over `filters.pmf` in most cases.

**默认选 SMRF。** 只有做算法对比、复现论文结果，或 SMRF 在特定地形上明显失败时才换。CSF 值得独立保留：它应对逆向坡面（河道下切、路堑）的能力是 SMRF 的补充。

### 10.2.1 filters.smrf：参数与物理含义

```json
[
    "input.laz",
    {
        "type": "filters.smrf",
        "window": 18.0,
        "slope": 0.15,
        "threshold": 0.5,
        "cell": 1.0,
        "scalar": 1.25,
        "returns": "last, only"
    },
    "ground.laz"
]
```

| 选项 | 默认 | 含义 |
|------|------|------|
| `window` | **18.0** | 最大窗口尺寸；决定能识别多大的地物 |
| `slope` | **0.15** | 坡度（rise/run），控制地形跟随的松紧 |
| `threshold` | **0.5** | 高程阈值，超过即判为非地面 |
| `cell` | **1.0** | 栅格化单元尺寸 |
| `scalar` | **1.25** | 高程缩放系数 |
| `cut` | **0.0** | 净切割尺寸；0 表示跳过切割步骤 |
| `returns` | **"last, only"** | 参与分类的回波类型 |
| `ignore` | 无 | 忽略某维度取值范围的区间 |
| `classbits` | 空 | 选择性忽略 synthetic / keypoint / withheld 点 |
| `dir` | 无 | 输出中间栅格的调试目录 |

调法：

**`window` 要大于最大的地物。** 城市建筑 20–50 米宽，`window` 就该在 30–50；林区树冠连片需要更大。太小会把大地物当成地形，DEM 上出现整块隆起。

**`slope` 决定陡坡会不会被误判。** 陡坡高差变化快，`slope` 太小会把坡面判成非地面。官方示例给出的论文优化组合（Pingel Table 3）是 `scalar=1.2, slope=0.2, threshold=0.45, window=16.0`——`slope` 比默认大，说明默认值在陡地形上偏保守。

**`returns` 默认只用末次回波与单次回波**，因为末次回波更可能打到地面；首回波多打到树冠和屋顶。稀疏植被区末次回波可能不足，可改成 `"last, intermediate, only"`，代价是噪声增加。

**`cut` 保持 0。** 它是净切割步骤，能去掉部分地下点，也可能削掉真实沟底。负异常交给 `filters.elm` 更可控。

### 10.2.2 三个算法共享的地面类选项

三个算法都引入 `ground_cls_opts.md` 的三个选项：`ground_class`（默认 **2**，地面点分类值）、`other_class`（默认 **1**，非地面点分类值）、`only_ground`（默认 **false**）。

默认会把非地面点统统设成 1。输入数据若已分好建筑（6）、植被（3/4/5），**必须设 `only_ground: true`**，否则下游分类信息全被抹掉。

```json
{
    "type": "filters.smrf",
    "only_ground": true
}
```

### 10.2.3 filters.csf：布料模拟

```json
[
    "input.laz",
    {
        "type": "filters.csf",
        "resolution": 1.0,
        "threshold": 0.5,
        "hdiff": 0.3,
        "rigidness": 3,
        "iterations": 500
    },
    "ground_csf.laz"
]
```

| 选项 | 默认 | 含义 |
|------|------|------|
| `resolution` | **1.0** | 布料网格分辨率 |
| `threshold` | **0.5** | 分类阈值 |
| `hdiff` | **0.3** | 高差阈值；用于陡坡后处理 |
| `smooth` | **true** | 是否做坡度后处理 |
| `step` | **0.65** | 时间步长 |
| `rigidness` | **3** | 布料刚度（1–3） |
| `iterations` | **500** | 最大迭代次数 |
| `returns` | **"last, only"** | 回波类型 |

CSF 的直觉模型：把一块布倒扣在地形上，在重力下下落，被地形最高处托住，最终形状就是地面。`rigidness` 越大布越硬，越不跟小起伏走；`resolution` 越小布越密，细节越多但越慢。

它的强项是**反坡**：SMRF 在“地面被上方物体遮挡”的地形（桥下、路堑）容易把地面判成非地面，CSF 的布料是连续面，能把这类区域补回来。

## 10.3 抽出地面点

分类完不算结束——`filters.smrf` 只改 `Classification`，所有点都还在。要生成 DEM，必须把非地面点真正过滤掉：

```json
{ "type": "filters.expression", "expression": "Classification == 2" }
```

等价的旧写法是 `filters.range` + `limits: "Classification[2:2]"`，但它将在 PDAL 3.0 废弃（见第 8 章），新 pipeline 一律用 `filters.expression`。

顺序陷阱：**必须先抽地面再 `writers.gdal`**。直接把 SMRF 输出喂给 writer，非地面点也参与插值，得到的是 DSM 而不是 DEM——不是错误，是需求不同：

| 产物 | 用什么点 | 说明 |
|------|---------|------|
| DEM | 仅 `Classification == 2` | 裸地面，去掉建筑与植被 |
| DSM | 全部点 | 含建筑顶与树冠 |
| HAG | 两者都要 | 用地面点算基准，差值即高度 |

## 10.4 归一化高度：HAG 的两个算法

有了地面点，就能算每个点相对地面的高度（Height Above Ground）。这是很多下游任务（建筑提取、植被分割、树高统计）的输入。

### 10.4.1 filters.hag_nn：基于邻域插值

```json
[
    "input.laz",
    { "type": "filters.smrf" },
    {
        "type": "filters.hag_nn",
        "count": 3,
        "max_distance": 50.0,
        "allow_extrapolation": false
    },
    "hag.laz"
]
```

| 选项 | 默认 | 含义 |
|------|------|------|
| `count` | **1** | 用几个地面邻居做插值 |
| `max_distance` | 无 | 只用该距离内的地面点 |
| `allow_extrapolation` | **false** | 点落在地面点包围盒外时是否外推；false 则 HAG 设 0 |
| `class` | **2** | 地面点的分类值 |

`count = 1`（默认）是“找最近的地面点，用它的 Z 作基准”，粗糙：地面点稀疏时单点误差会传给整片非地面点，建筑密集区建议 3–5。`max_distance` 是安全阀，避免“用隔壁山头的高度做基准”。

`allow_extrapolation: false` 有副作用：**落在地面点包围盒之外的非地面点，HAG 会被设成 0**（数据边缘、水体常见）。统计 HAG 分布时这些 0 值要按 `Classification != 2 && HeightAboveGround > 0` 过滤掉。

### 10.4.2 filters.hag_dem：基于已有 DEM

如果已经有一份 DEM（比如上一轮生产的、或外购的），可以直接用它做基准：

```json
[
    "input.laz",
    {
        "type": "filters.hag_dem",
        "raster": "existing_dem.tif",
        "band": 1,
        "nodata_hag": 0.0,
        "zero_ground": true
    },
    "hag.laz"
]
```

选项：`raster`（必填，GDAL 可读的 DEM）、`band`（默认 **1**）、`nodata_hag`（默认 **0.0**）、`min_clamp`/`max_clamp`（把 HAG 钳制在区间内）、`zero_ground`（默认 **true**，地面点 HAG 直接设 0）、`class`（默认 **2**）。

`zero_ground: true` 很实用：地面点的 HAG 定义上就是 0，没必要查栅格，还避免 DEM 与点云轻微不匹配造成的负值。

关键是 **DEM 与点云的坐标系必须一致**。不匹配时不报错，只会给出一片毫无意义的 HAG，动手前用 `pdal info --summary` 分别看两边 SRS。

## 10.5 writers.gdal：六种统计量与一个必填参数

`writers.gdal` 是 PDAL 唯一能做“点云 → 栅格”插值的 writer（`writers.raster` 只能写 filter 已经生成的栅格，不能从点云插值）。它的模型很简单：

```text
对每个栅格单元，取落在“单元中心 + radius”范围内的点，
按 output_type 指定的统计量算出一个值。
```

```json
[
    "ground.laz",
    {
        "type": "writers.gdal",
        "filename": "dem.tif",
        "resolution": 1.0,
        "output_type": "min",
        "gdaldriver": "GTiff"
    }
]
```

### 10.5.1 output_type 的六种取值

默认 `output_type = "all"`，会写 **6 个波段**：

| 值 | 波段含义 | 典型用途 |
|----|---------|---------|
| `min` | 单元内最小值 | **DEM 首选**，最不易被残留地物抬高 |
| `max` | 最大值 | DSM、冠层高度 |
| `mean` | 平均值 | 平滑地形，但会被地物拉高 |
| `idw` | Shepard 反距离加权 | 点稀疏时更平滑 |
| `count` | 单元内点数 | 密度图、覆盖度检查 |
| `stdev` | 总体标准差 | 粗糙度、质量诊断 |

**`min` 与 `mean` 的差别就是“残留地物”的差别**：分类漏掉一栋楼，`min` 只在楼的几个像元上错，`mean` 会把整栋楼的平均高度带进 DEM。DEM 生产默认用 `min`。

除了六个固定值，还支持百分位波段 `p<i>`：

```json
{
    "type": "writers.gdal",
    "filename": "dem_p.tif",
    "resolution": 1.0,
    "output_type": "p5,p50,p95",
    "binmode": true
}
```

百分位只在 `binmode: true` 时生效（`binmode` 表示只用落在像元**内部**的点，不做半径搜索）。

### 10.5.2 resolution 必填，radius 有默认值

`resolution` 是像元边长，**没有默认值，必须给**，漏了直接报错。`radius` 是搜索半径，默认 `resolution × √2`；官方点明的陷阱是：圆罩不住整个像元时，**有些落在像元内的点根本不会被考虑**。点云稀疏或分辨率小时要显式放大：`"resolution": 0.5, "radius": 1.0`。

### 10.5.3 空像元与 nodata

没有点落入搜索范围的像元写 `nodata`，默认值取决于 `data_type`：double/float/int/short 用 **-9999**，unsigned int/short 用 **9999**，unsigned char 用 **255**，char 用 **-128**。

要让空像元被邻域插值补上，用 `window_size`：

```json
{
    "type": "writers.gdal",
    "filename": "dem_filled.tif",
    "resolution": 1.0,
    "output_type": "min",
    "window_size": 2,
    "nodata": -9999
}
```

`window_size` 表示允许从多远（以像元为单位）的捐赠像元取值并做反距离加权：1 是 3×3，2 是 5×5。**别开太大**——它本质是给空洞插值，窗口越大越容易把远处地形拉进来，在山脊陡坎处造假地形。要补洞，先回点云看为什么没有地面点。

其余常用选项：`gdaldriver`（默认 `GTiff`）、`data_type`、`dimension`（默认 `Z`）、`bounds` 或 `origin_x/origin_y/width/height`（二选一，不能同时给）、`override_srs`/`default_srs`、`metadata`、`pdal_metadata`、`allow_empty`。

## 10.6 完整 DEM 生产 pipeline

把上面的步骤串成一条可复用的生产链路。这是本章的核心示例，覆盖 噪声 → 分类 → 抽地面 → 栅格化 全流程：

```json
[
    {
        "type": "readers.las",
        "filename": "raw.laz"
    },
    { "type": "filters.assign", "value": "Classification = 0" },
    { "type": "filters.elm", "cell": 20.0, "threshold": 0.5 },
    { "type": "filters.outlier", "method": "statistical", "mean_k": 12, "multiplier": 2.5 },
    {
        "type": "filters.smrf",
        "window": 33.0,
        "slope": 0.15,
        "threshold": 0.5,
        "cell": 1.0,
        "scalar": 1.25
    },
    { "type": "filters.expression", "expression": "Classification == 2" },
    {
        "type": "writers.gdal",
        "filename": "dem_1m.tif",
        "resolution": 1.0,
        "radius": 1.5,
        "output_type": "min",
        "gdaldriver": "GTiff",
        "data_type": "float32",
        "nodata": -9999,
        "pdal_metadata": true
    }
]
```

参数依据：`assign` 归零清掉上一手可能错误的分类，避免 `classbits` 受污染；`elm` 的 `cell=20` 取平均点间距的若干倍，`threshold=0.5` 按地形起伏定；`outlier` 比默认 8/2.0 稍宽，免得把稀疏植被当噪声；`window=33` 大于城区最大建筑宽度；`radius=1.5` 显式放大，避免圆罩不住像元；`min` 最抗地物残留。

验收：`pdal info --summary dem_1m.tif` 看范围与 SRS，`gdalinfo` 确认波段数（这里应为 1）。忘了写 `output_type` 会得到 6 个波段，这是最常见的产出错误。

### 10.6.1 分块处理大范围数据

一条 pipeline 处理几千平方公里会撞上内存墙，按瓦片分块：

```bash
# 按 2000 米瓦片切开，带 50 米重叠避免边缘分类缺邻域
pdal tile "province.laz" "tiles/tile_#.laz" --length 2000 --buffer 50

# 每块单独跑 DEM pipeline
for f in tiles/*.laz; do
    base=$(basename "$f" .laz)
    pdal pipeline dem.json \
        --stage.reader.filename="$f" \
        --stage.writer.filename="dem_$base.tif"
done
```

两点必须注意：**瓦片间留 buffer**，否则边界处分类因缺邻域判错，接边出现缝；**所有瓦片用同一 `origin`**，保证栅格对齐。

## 10.7 与 las2dem / LAStools 的取舍

做 DEM 最常被比较的是 LAStools 的 `las2dem`，能力重叠大但适用场景不同。

| 维度 | PDAL | LAStools |
|------|------|----------|
| 许可 | BSD 3-Clause，商用无约束 | 混合，批量处理需授权 |
| 流程 | 声明式 JSON pipeline，可版本化 | 命令行串联，靠脚本拼接 |
| 分类 | SMRF/PMF/CSF | lasground/lasground_new |
| 插值 | 像元统计 min/max/mean/idw/count/stdev、百分位 | TIN 插值与多种栅格化模式 |
| 嵌入 | C++/Python 库 | 以命令行工具为主 |
| 大数据 | 流式 + 分块 + COPC/EPT 远程读 | 原生多核分块 |

三种情况：要把处理嵌进自己的系统、流程需要版本化审计、许可要求宽松、或输入是 COPC/EPT 云数据 —— 选 PDAL。团队已熟悉 LAStools 命令行、依赖 `las2dem` 的 TIN 插值、需要其质检工具链 —— 选 LAStools（注意商用授权）。最常见的是混合：PDAL 做格式转换、去噪、COPC 封装，地面分类与 DEM 按质量要求选工具，最后用 PDAL 统一质检与元数据归档。

一条实践判断值得记：**如果 DEM 精度验收没过，先怀疑分类，别急着换插值**。换插值算法带来的差异通常小于分类漏掉一片建筑。

## 10.8 辅助：轮廓与密度

**`filters.hexbin`** 生成实际覆盖轮廓（六边形密度面），比矩形范围更贴近真实数据边界。关键参数：`edge_length`（默认自动估算）、`threshold`（默认 **15**，一个六边形至少多少点才算有数据）、`sample_size`（默认 **5000**）、`boundary`/`density`（输出文件）、`ogrdriver`（默认 GeoJSON）。

```json
[
    "ground.laz",
    { "type": "filters.hexbin", "edge_length": 100, "boundary": "coverage.geojson" },
    "writers.null"
]
```

轮廓可直接当 DEM 的有效范围掩膜——矩形 DEM 的四个角常常是 nodata，一裁就干净了。

**`filters.dem`** 是另一条栅格化路径：不算统计量，而是把点云转成 GDAL 栅格数据集供 pipeline 内部使用（喂给 `filters.hag_dem` 或 `writers.raster`）。DEM 需要在 pipeline 内被二次使用时走这条，而不是落地 TIFF 再读回来。

## 10.9 排错

| 现象 | 原因 | 处理 |
|------|------|------|
| 输出 TIFF 有 6 个波段 | 没写 `output_type` | 显式 `output_type: "min"` |
| 报错缺 `resolution` | 该参数无默认值 | 必须显式给 |
| DEM 上建筑轮廓清晰 | 没抽地面点 | 加 `filters.expression: Classification == 2` |
| DEM 整体偏低 | 噪声被当地面基准 | 分类前加 `elm` + `outlier` |
| DEM 有台阶状突起 | 地物边缘被当成地面 | 加大 `window`，或换 CSF |
| 大片 nodata | 点稀或 `radius` 太小 | 调大 `radius`；必要时 `window_size` 补洞 |
| 原有植被分类全丢 | `only_ground` 默认 false | 设 `only_ground: true` |
| HAG 大量为 0 | `allow_extrapolation` 默认 false | 设 true，或统计时排除 |
| `hag_dem` 结果无意义 | DEM 与点云 SRS 不一致 | `pdal info --summary` 核对 |
| 瓦片接边有缝 | 分块没留 buffer | 用 `pdal tile --buffer` |
| 分类极慢、内存暴涨 | SMRF 需全局栅格化 | 分块；先降采样试参数 |

最后一条展开：SMRF 内部把整块点云栅格化再做形态学运算，内存与覆盖范围成正比，**不可能流式运行**（第 1 章的 standard 模式）。100 平方公里的 1 米格网就是 1 亿个栅格单元，跑之前先估内存。

## 10.10 生产建议

**分类参数按地形分档。** 城区 `window` 33–50、林区 50+、山地 18–25 且 `slope` 0.2+，用命令行覆盖切换：

```bash
pdal pipeline dem.json --filters.smrf.window=50 --filters.smrf.slope=0.2
```

**DEM 分辨率由用途定，不由数据密度定。** 1:500 用 0.5 米格网，1:2000 用 1 米，区域规划 5–10 米。比数据密度还细只会得到插值出来的假细节。

**保留中间产物。** 分类后的 LAZ 比 DEM 更有价值：改参数可以重跑插值，重新分类却很贵。把 `ground.laz` 连同 pipeline JSON 一起归档。

**交付带 `pdal_metadata`。** pipeline 与参数会以 base64 写进 TIFF 元数据，验收方拿到图就能看到用了什么参数。

**用轮廓裁掉 nodata 边角。** 矩形 DEM 四角通常是空的，用 `filters.hexbin` 的 boundary 做掩膜。

## 10.11 小结

| 主题 | 关键事实 |
|------|---------|
| 三阶段 | 去噪 → 分类 → 插值；分类质量决定 DEM 形状 |
| SMRF 默认 | `window=18.0`、`slope=0.15`、`threshold=0.5`、`cell=1.0`、`scalar=1.25`、`cut=0.0` |
| SMRF 调参 | `window` 必须大于最大地物；陡地形加大 `slope`；论文优化组合 1.2/0.2/0.45/16 |
| PMF 默认 | `cell_size=1`、`slope=1.0`、`max_window_size=33`、`initial_distance=0.15`、`max_distance=2.5`；官方建议优先 SMRF |
| CSF 默认 | `resolution=1.0`、`threshold=0.5`、`hdiff=0.3`、`rigidness=3`、`iterations=500` |
| 地面类选项 | `ground_class=2`、`other_class=1`、`only_ground=false` |
| 抽地面 | `filters.expression: Classification == 2`（range 将废弃） |
| HAG | `hag_nn`（`count=1`、`class=2`）或 `hag_dem`（`band=1`、`zero_ground=true`） |
| writers.gdal | `resolution` 必填；`radius` 默认 `resolution×√2`；`output_type` 默认 `all`=6 波段 |
| DEM 统计量 | `min` 最抗地物残留，是 DEM 生产的默认选择 |
| nodata | double/float/int/short 用 -9999；unsigned 用 9999；uchar 用 255 |
| 补洞 | `window_size`（0 关闭，1=3×3，2=5×5），开大易造假地形 |
| 与 LAStools | PDAL 强在可嵌入与云数据；las2dem 强在 TIN 插值与工具链 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第09章-点云滤波与噪声处理/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第11章-坐标参考系统与高程基准/" class="chapter-nav__next">下一章 →</a>
</div>
