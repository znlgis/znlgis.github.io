---
layout: default
title: 第17章 - 点云与 LiDAR 分析
---

# 第17章 - 点云与 LiDAR 分析

点云是 GeoLibre 里唯一以"百万点"为单位计量的数据形态，也是它与传统桌面 GIS 差别最明显的一环：一份 3DEP 的 COPC 文件动辄几个 GB，浏览器不会把它整个读进内存，而是按视图、按八叉树节点流式取点；标注一次地面类，背后是上百万个 uint8 分类码的原地改写；导出的 LAZ 又必须逐点对齐原始记录，否则下游训练集就废了。

本章按"数据进来 → 看得见 → 算得动 → 标得上 → 导得出"的顺序，把这条链路完整走一遍。前半部分讲格式、加载、样式与 LiDAR 工具箱（第 17.2–17.6 节），后半部分讲点云标注工作台（第 17.7–17.10 节），最后收在三维产品与 Cesium 球的边界条件上（第 17.11–17.13 节）。

> **说明**：本章基于 GeoLibre 3.4。菜单项、参数名、工具名、文件格式均保留英文原文，叙述用中文。事实来源为仓库 docs/user-guide/point-cloud-annotation.md、docs/user-guide/web-services.md、docs/user-guide/processing.md、docs/user-guide/adding-data.md、docs/user-guide/embedding.md、packages/plugins/src/plugins/components/lidar.ts、packages/plugins/src/plugins/point-cloud-annotation/classes.ts、apps/geolibre-desktop/src/lib/whitebox-menu-catalog.ts、apps/geolibre-desktop/src/lib/along-track-profile.ts。

---

## 17.1 点云在 GeoLibre 里的位置

### 17.1.1 三种数据形态，三种渲染路径

GeoLibre 的图层模型里，矢量走 MapLibre 的 source/layer，栅格走 MapLibre 的 raster 图层或 deck.gl 的 COG 图层，而点云走的是第三条路：一个由 maplibre-gl-lidar 提供的 **LidarControl**，它把点云画进一张**叠在 MapLibre 画布之上的 deck.gl 画布**。

这个细节决定了后面几乎所有限制。两张 canvas 无法交错绘制，所以：

- 点云之上的测量线必须由 deck.gl 再画一遍（见 17.3.4）；
- MapLibre 的 Blend（混合模式）菜单对点云无效——它在 [第07章 样式符号化与图例](https://znlgis.github.io/gis/tutorial/GeoLibre/第07章-样式符号化与图例/) 里列出的排除项中，点云与 3D Tiles、高斯泼溅并列；
- 点云只在一张 2D 地图上有意义，球面投影下不渲染（见 17.12）。

### 17.1.2 图层记录里存了什么

点云加载完成后，GeoLibre 会在 store 里写一条 type 为 lidar 的图层记录，但**不保存点本身**——点由控件持有。真正进工程文件的是元数据：

| 字段 | 值 | 用途 |
|------|-----|------|
| type | lidar | 图层类型判别 |
| metadata.sourceKind | lidar-url | 标记"这个图层由 LiDAR 控件按 URL 流式加载" |
| metadata.externalNativeLayer | true | 说明渲染不归 MapLibre 管 |
| metadata.hasClassification | 布尔 | 文件是否带分类维度，决定能否按分类着色 |
| metadata.hasIntensity | 布尔 | 文件是否带强度 |
| metadata.hasRGB | 布尔 | 文件是否带真彩色 |
| metadata.pointCount | 数值 | 文件声明的点数（不是当前视图已加载的点数） |
| metadata.wkt | 字符串 | 源文件 CRS 的 WKT，导出时用它写回坐标 |
| sourcePath / source.url | URL | 工程重开时重新流式加载的地址 |

> **提示**：工程重开时，GeoLibre 并不会把点云"恢复"出来，而是按保存的 URL **重新流式加载**（源码里的 restoreLidarLayers）。所以点云图层本质上是"URL + 元数据 + 可能的标注"，工程文件因此可以很小；反过来说，URL 一旦失效，重开工程就只剩一个空图层。

### 17.1.3 LiDAR 面板的默认参数

LiDAR 面板本身是一个地图控件，挂在**左上角**（position 为 top-left），宽度 365 px。它的构造参数就是用户看到的第一屏状态：

| 选项 | 默认值 | 含义 |
|------|--------|------|
| title | Add LiDAR Layer | 面板标题，也说明这个面板同时承担"添加点云"的职责 |
| pointSize | 2 | 单点像素尺寸，加载后可在面板里调 |
| colorScheme | elevation | 默认按高程着色 |
| autoZoom | true | 加载完成后自动飞到点云范围 |
| pickable | false | 不做逐点拾取（百万点级别的拾取代价过高） |
| closeOnOutsideClick | false | 点击地图不收起，避免误关 |
| sampleData | Autzen（COPC）、Cook County, IL（EPT） | 两个内置样例，一个走 COPC 一个走 EPT |

两个样例 URL 是公开可直接访问的：Autzen 是 https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz ，Cook County 是 https://s3-us-west-2.amazonaws.com/usgs-lidar-public/USGS_LPC_IL_4County_Cook_2017_LAS_2019/ept.json 。要确认"点云到底能不能在本机跑起来"，用它们比下载自己的数据快得多。

### 17.1.4 支持哪些渲染引擎

| 渲染引擎 | 点云 | 说明 |
|----------|------|------|
| **MapLibre**（默认） | 支持 | deck.gl 覆盖画布，全部功能可用；标注工作台只支持这一引擎 |
| **Mapbox** | 支持 | 同一套控件，通过引擎适配层挂载 |
| **ArcGIS Maps SDK** | 支持 | 走 arcgis-deck 的控件适配层 |
| **CesiumJS（3D 球）** | 不支持 | 点云按 Mercator 视口流式加载，球上不渲染；详见 17.12 |

---

## 17.2 点云格式与数据源

### 17.2.1 四种格式，四种读取方式

| 格式 | 实质 | GeoLibre 的读法 | 适用规模 |
|------|------|------------------|----------|
| **LAS** | 未压缩的 ASPRS 点云二进制，1.0–1.4 | 整文件读入；**LAS 1.4 若整体读取失败，会先转成 COPC 再加载** | 单文件几十 MB 到 1–2 GB |
| **LAZ** | LAS 的 LASzip 压缩版，通常约为 LAS 的 1/4 | 整文件读入并解压 | 同上，传输更省 |
| **COPC** | Cloud-Optimized Point Cloud（LASzip + 八叉树 + 视口索引） | 按视图、按八叉树节点**流式取点**，随缩放换细节层次 | 几 GB 到 TB 级 |
| **EPT** | Entwine Point Tile，一个含 ept.json 的目录 | 按 ept.json 声明的层次流式取点 | 城市级、州级公开数据集 |

读取方式的差别不是性能技巧，而是能力边界：**只有 COPC 与 EPT 支持"按视图流式"**。标注工作台里那个"Full detail in view（当前视图全细节）"按钮只在流式 COPC 上有意义，因为只有它才知道"视图里到底有哪些点"。

### 17.2.2 六条加载入口

| 入口 | 路径 | 适合 |
|------|------|------|
| **菜单** | Add Data → 3D layers → **LiDAR Layer** | 选文件或贴 URL，最正式的一条 |
| **拖拽** | 把 .las / .laz / .copc.laz 拖到地图上 | 单文件最快；LAS 1.4 读不了会自动转 COPC |
| **URL 深链** | ?data= 加点云 URL，无扩展名时补 dataType=lidar | 分享、嵌入、文档示例 |
| **S3 浏览器** | Plugins → Web Services → **S3 Browser**，选 COPC/LAZ/LAS 后点 **Add** | 私有桶；图层保留 s3:// URI，不写签名 URL |
| **专题面板** | Plugins → Web Services → **USGS LiDAR** / **IGN LiDAR HD** | 按范围裁剪 3DEP 点云、检索法国 LiDAR HD 瓦片 |
| **代码** | Python 的 add_lidar(url)；MCP 的 add_lidar_layer | 批量、可重复、无界面 |

两种深链写法（第二种给无扩展名的 API 端点补 `dataType=lidar`）：

```text
https://web.geolibre.app/?data=https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz
https://web.geolibre.app/?data=https%3A%2F%2Fapi.example.com%2Fdownload%2F42%3Ftoken%3Dabc%26expires%3D3600&dataType=lidar
```

### 17.2.3 远端读取的三条硬规则

1. **CORS**：点云由浏览器直接取，服务器必须允许跨源请求。私有桶的 CORS 规则若挡住当前来源，报错会是 "Failed to fetch"，GeoLibre 会把它翻译成 S3 读取错误的说明。
2. **HTTP Range**：COPC 的流式依赖字节范围请求。服务器不支持 Range 时，大文件会退化成整文件下载，甚至超时。
3. **大小闸门**：通过 ?data= 打开时，普通 LAS/LAZ 会被整份下载，若服务器报出的大小超过 **250 MB** 则直接拒绝；COPC / EPT 不受此限，因为它们是流式的。

### 17.2.4 两个开箱即用的 3DEP 入口

**USGS LiDAR**（Plugins → Web Services → USGS LiDAR）不是目录浏览器，而是一个"裁剪器"：

1. 打开面板后，一张 **3DEP Elevation Index** 图层会显示哪些地方有点云；
2. 地图自动切到 **Mercator** 投影（关闭面板时恢复你原来的投影）——原因就是 17.12 要讲的那条：流式点云不在球上渲染；
3. 在地图上框出感兴趣区，面板按 AOI 裁剪 3DEP 点云并给出一个 **COPC** 下载。

**IGN LiDAR HD**（Plugins → Web Services → IGN LiDAR HD）是法国 LiDAR HD 计划的瓦片检索面板：

- **Use map extent** 加 **Search tiles** 列出范围内瓦片，瓦片足迹作为一条图层记录绘制，悬停高亮；
- **Add to map** 把一瓦片作为点云图层流入地图（MapLibre / Mapbox / ArcGIS 三种引擎均可）；
- **Download** 保存 COPC 原文件；勾选多个瓦片可 **Add selected to map** 批量加入；
- 数据版权为 IGN，Licence Ouverte 2.0。

> **注意**：批量加入多个瓦片时，GeoLibre 会临时关掉 autoZoom，避免镜头被最后一个瓦片抢走；全部加载完再恢复。这是源码里用嵌套计数实现的，多次点击"Add to map"不会互相踩踏。

---

## 17.3 加载点云与使用 LiDAR 面板

### 17.3.1 一次标准加载

1. **Add Data → 3D layers → LiDAR Layer**，面板出现在左上角；
2. 在面板顶部选择**文件**（桌面版可直接选本地文件，浏览器版走文件选择器）或粘贴一个 **URL**；
3. 或点面板里的样例：**Autzen**（COPC）、**Cook County, IL (EPT)**；
4. 点加载后，头部显示读取进度；完成后镜头自动飞到点云范围（autoZoom）；
5. Layers 面板出现一条 lidar 类型图层，可改可见性与不透明度；
6. 展开面板，用 **point size** 调点的大小，用着色下拉切换颜色依据；
7. 需要留存时走 **Layer actions → Export** 导出 LAS / LAZ / COPC。

> **提示**：桌面版从本地磁盘选文件时，点云的字节会被缓存成一个 blob URL 记在 metadata.localBytesUrl 上（不写进工程文件）。这就是"本地 LAS 也能被 Whitebox 工具当作输入"的原因，也是"删掉图层还能撤销回来"的原因——那个 URL 从不主动释放。

### 17.3.2 着色：四种依据与它们的先决条件

| 着色依据 | 需要的维度 | 表现 |
|----------|------------|------|
| **Elevation**（默认） | 仅 z | 连续色带，最直观地看地形与建筑起伏 |
| **Classification** | hasClassification | 按 ASPRS 类别取固定颜色，与 17.8 的类别表一致 |
| **Intensity** | hasIntensity | 单色带，用于看材质差异（沥青、草地、金属屋面） |
| **RGB** | hasRGB | 真彩色，航摄点云常见 |

文件没带某个维度时，对应选项即使出现也不会画出差异——这一点先看图层元数据最快：Metadata 面板里 hasClassification / hasIntensity / hasRGB 三个布尔值就是答案。

**为什么分类颜色重要**：GeoLibre 的分类色是**照抄渲染器**的，不是另起一套。源码里 ASPRS_CLASSES 的注释明确写着"颜色镜像 maplibre-gl-lidar 的 CLASSIFICATION_COLORS，好让面板里的色块和地图上的点一致"。这意味着你在标注面板里看到的"Ground = 棕色 165,113,78"，与点云上真正的棕色点是同一个值。

### 17.3.3 图例与高程过滤

LiDAR 面板自带一份**按分类的图例**，每个类别一行，行首的复选框控制该类是否显示。这份图例不是装饰：

- 隐藏的类**不会被标注工具选中**（17.7.3）；
- 图例里的名称与颜色会跟随**自定义类**变化（17.8.2）；
- 面板上还有一组**高程过滤**（Min Z / Max Z），它同时影响显示与选择。

### 17.3.4 在点云上测量

测量工具画在 MapLibre 的 canvas 里，而点云画在它上层的 deck.gl canvas 里——按 z 序，被点遮住的线段会消失。GeoLibre 的处理是**把同一份几何在点云的 deck.gl 覆盖层里再画一遍**（depthTest 关掉，图层 id 为 geolibre-measure-above-points）：

- 线色 #3b82f6、线宽 3、填充 rgba(59,130,246,0.2)；
- 点云之外的区域由 MapLibre 那层负责，两者同色同形，肉眼无缝；
- 覆盖层在每一批点之后绘制，所以后续流入的点也盖不住它。

这也是"为什么点云上的测量看起来是浮在最上面"的准确答案，而不是视觉效果。

### 17.3.5 导出图层

点云图层的 **Layer actions → Export** 提供三种：

| 选项 | 输出 | 说明 |
|------|------|------|
| **LAS** | 未压缩 LAS | 保留分类、强度、回波、GPS 时间 |
| **LAZ** | LASzip 压缩 | 体积约为 LAS 的 1/4 |
| **COPC** | 云优化点云 | 导出后可直接再流式加载 |

> **警告**：这里的"导出"导出的是**当前已加载的点**，不是整个文件。要把标注应用到整份文件，用标注工作台的 **Full file with labels**（17.10.4）。

---

## 17.4 星载激光：ICESat-2 与 GEDI

星载激光雷达不是"点云"，而是**足迹点（footprint）矢量图层**：每个光斑一个点，带一列高度/生物量字段。GeoLibre 把它做成普通的 GeoJSON 点图层，因此样式、属性表、筛选、导出全都照常可用——这是它与 17.3 的机载点云最根本的区别。

### 17.4.1 支持的产品

| 产品 | 平台/仪器 | 主要字段 | 质量过滤规则 |
|------|-----------|----------|--------------|
| **ATL06** | ICESat-2 陆地冰高度 | h_li | 保留 atl06_quality_summary 等于 0 的段 |
| **ATL08** | ICESat-2 陆地与植被高度 | h_te_best_fit、h_canopy | 无质量标志，保留地形高有效的段 |
| **ATL03** | ICESat-2 地理定位光子 | h_ph、信号置信度、沿轨距离 | 按视图按需读取，见 17.4.3 |
| **GEDI L2A** | GEDI 高程与高度指标 | elev_lowestmode、rh98 | quality_flag 等于 1（v3 为 l2a_quality_flag_rel3） |
| **GEDI L2B** | GEDI 冠层覆盖与垂直剖面 | elev_lowestmode、rh100 | l2b_quality_flag 等于 1 |
| **GEDI L4A** | GEDI 地上生物量密度 | agbd | l4_quality_flag 等于 1 |

所有足迹都带四个基础属性：beam（波束名）、beam_type（强/弱波束）、time、distance_km（沿轨距离，km）。沿轨剖面就是靠 distance_km 排序的。

### 17.4.2 打开一份 granule

**入口一：本地或样例文件**

1. **Add Data → Files → ICESat-2 / GEDI**；
2. 选一个 .h5 granule，或点内置样例（ATL06 56 MB、ATL08 56 MB、GEDI L2A 1.7 GB、L2B 447 MB、L4A 301 MB）；
3. 读完后在同一个对话框里选 **Beams**（波束）与 **Fields**（字段，带字段过滤框）；
4. 选 **Color by**（默认按产品主字段着色）；
5. 决定是否勾 **Apply the product's quality filter**、**Only footprints in the current map view**、**Maximum footprints**（超出时按等步长抽稀，并在结果提示里说明抽稀比例）；
6. **Add layer**，图层按产品命名，着色字段来自第 4 步。

**入口二：NASA Earthaccess**

1. Plugins → Web Services → **NASA Earthaccess**；
2. 选一个 **popular dataset**（ATL03/ATL06/ATL08、GEDI L2A/L2B/L4A、HLS、NASADEM）或按关键字搜；
3. **Search this view** 列当前视图与日期范围内的 granule，足迹汇总成一条图层；
4. 对 ICESat-2 / GEDI 点 **Open** ——它会下载 granule 并交给 Add Data → ICESat-2 / GEDI 的对话框；
5. **Download** 保存原文件，**Details** 跳到 Earthdata Search。

> **注意**：搜索不需要账号，**下载需要 Earthdata Login token**。桌面版会把 token 存进系统钥匙串，网页版存浏览器存储；部分数据集还要求在网站上先接受一次 EULA。

### 17.4.3 ATL03 光子：按视图读，不下载整份

ATL03 保存一段轨道的**每一个光子**，一份 granule 可以有几个 GB。GeoLibre 不把它读进内存，而是从文件里按**当前地图视图**做字节范围读取：

| 选项 | 取值 | 说明 |
|------|------|------|
| **Surface** | Land / Ocean / Sea ice / Land ice / Inland water | 决定读哪一组光子 |
| **Lowest signal confidence** | 0 全部 / 1 Buffer 及以上 / 2 Low 及以上（信号）/ 3 Medium 及以上 / 4 仅 High | 越大越干净、点越少 |
| **Maximum photons** | 数值 | 超过则等步长抽稀 |
| **Add photons in view** | 按钮 | 读完把视图内光子加成点图层 |

视图太大时读不动：面板会提示"只读取跨度不超过若干度的视图"，缩小地图再来。读一份白天密集 granule 的宽视图大约要一分钟，读的过程中头部显示已接收的 MB 数。

### 17.4.4 沿轨剖面（Along-track profile）

入口：**Layer actions → Along-track profile**（仅对足迹图层出现）。剖面是"沿轨距离（x）对某个数值字段（y）"的二维图，按波束分条。

内置预设：

| 产品 | 预设 | 两条线 |
|------|------|--------|
| **ATL08** | Ground + canopy | h_te_best_fit（地面）与 h_te_best_fit 加 h_canopy（冠层顶） |
| **GEDI L2A** | Ground + canopy | elev_lowestmode 与 elev_lowestmode 加 rh98 |
| **GEDI L2B** | Ground + canopy | elev_lowestmode 与 elev_lowestmode 加 rh100 |
| **ATL06** | Surface | h_li 单线 |
| **ATL03** | Photons | h_ph 散点（不是折线） |

交互细节：

- 剖面与地图**双向联动**：悬停剖面点会在图上标出对应 footprint，点击图上 footprint 会定位剖面；
- 折线在点缺失或相邻间距超过阈值处**断开**（阈值取中位间距的 5 倍），所以云层缺口不会被一条假线跨过去；
- 可切换波束（同一条轨道常有 gt1l/gt1r/gt2l/gt2r/gt3l/gt3r）；
- 导出 CSV：列头是 distance_km、longitude、latitude，之后每条线一列，可直接进 pandas 或 Excel。

> **提示**：把剖面当作"先把曲线画出来，再决定要不要看三维"的工具。机载点云回答"这里长什么样"，星载剖面回答"沿这条轨，冠层高度怎么变"，两者服务的问题不同。

### 17.4.5 与机载点云的取舍

| 维度 | 机载点云（LAS/LAZ/COPC/EPT） | 星载足迹（ICESat-2 / GEDI） |
|------|------------------------------|------------------------------|
| 数据形态 | 点云图层（deck.gl） | 矢量点图层（GeoJSON） |
| 空间密度 | 每平方米数点到数百点 | 沿轨每 60 m（GEDI）或 100 m（ATL08）一个光斑 |
| 属性表 | 无（逐点属性不暴露） | 有，可筛选、可连接、可导出 |
| 标注工具 | 支持（17.7–17.10） | 不支持（不是点云图层） |
| 典型用途 | 建筑/植被提取、DEM/DSM、三维建模 | 冠层高度、生物量、冰盖高程变化 |
| 叠加能力 | 可与矢量、栅格叠加 | 可与其他矢量图层做空间连接 |

## 17.5 LiDAR 工具箱：Whitebox 的六十余个工具

### 17.5.1 两处入口，同一套工具

**入口一：Processing → LiDAR ▸**。这是一个按子类展开的菜单，条目直接来自工具清单（构建时生成，不手写），所以名字与上游 Whitebox 保持一致，不做中文化。

**入口二：Processing → Whitebox Toolbox**。在工具搜索框里输入名字，或在 **category** 下拉里选 LiDAR。两条路最后打开的是**同一个对话框**：左边工具列表，右边按工具参数清单生成的表单。

### 17.5.2 按子类列出全部条目

**GeoLibre (WASM)** —— 由 `geolibre-rust` 编译成 WebAssembly，混编进同一目录：

| 工具 id | 名称 |
|---------|------|
| `assign_projection_lidar` | Assign Projection Lidar |
| `lidar_convert` | LiDAR Convert |
| `lidar_grid_thin` | LiDAR Grid Thin |

**Analysis Metrics** —— 度量与统计，输出多为表或栅格摘要：

| 工具 id | 名称 |
|---------|------|
| `colourize_based_on_class` | Colourize Based On Class |
| `colourize_based_on_point_returns` | Colourize Based On Point Returns |
| `find_flightline_edge_points` | Find Flightline Edge Points |
| `individual_tree_detection` | Individual Tree Detection |
| `lidar_eigenvalue_features` | Lidar Eigenvalue Features |
| `lidar_histogram` | Lidar Histogram |
| `lidar_info` | Lidar Info |
| `lidar_kappa` | Lidar Kappa |
| `lidar_point_density` | Lidar Point Density |
| `lidar_point_return_analysis` | Lidar Point Return Analysis |
| `lidar_point_stats` | Lidar Point Stats |
| `lidar_ransac_planes` | Lidar Ransac Planes |
| `lidar_rooftop_analysis` | Lidar Rooftop Analysis |
| `normal_vectors` | Normal Vectors |

**Filtering & Classification** —— 本章的主力：

| 工具 id | 名称 |
|---------|------|
| `classify_buildings_in_lidar` | Classify Buildings In Lidar |
| `classify_lidar` | Classify Lidar |
| `classify_overlap_points` | Classify Overlap Points |
| `clip_lidar_to_polygon` | Clip Lidar To Polygon |
| `erase_polygon_from_lidar` | Erase Polygon From Lidar |
| `filter_lidar` | Filter Lidar |
| `filter_lidar_by_percentile` | Filter Lidar By Percentile |
| `filter_lidar_by_reference_surface` | Filter Lidar By Reference Surface |
| `filter_lidar_classes` | Filter Lidar Classes |
| `filter_lidar_noise` | Filter Lidar Noise |
| `filter_lidar_scan_angles` | Filter Lidar Scan Angles |
| `height_above_ground` | Height Above Ground |
| `improved_ground_point_filter` | Improved Ground Point Filter |
| `individual_tree_segmentation` | Individual Tree Segmentation |
| `lidar_classify_subset` | Lidar Classify Subset |
| `lidar_elevation_slice` | Lidar Elevation Slice |
| `lidar_remove_outliers` | Lidar Remove Outliers |
| `lidar_segmentation` | Lidar Segmentation |
| `lidar_segmentation_based_filter` | Lidar Segmentation Based Filter |
| `modify_lidar` | Modify Lidar |
| `normalize_lidar` | Normalize Lidar |
| `remove_duplicates` | Remove Duplicates |

**I/O & Management** —— 格式与瓦片管理：

| 工具 id | 名称 |
|---------|------|
| `ascii_to_las` | Ascii To Las |
| `las_to_ascii` | Las To Ascii |
| `las_to_shapefile` | Las To Shapefile |
| `lidar_colourize` | Lidar Colourize |
| `lidar_join` | Lidar Join |
| `lidar_shift` | Lidar Shift |
| `lidar_tile` | Lidar Tile |
| `lidar_tophat_transform` | Lidar Tophat Transform |
| `recover_flightline_info` | Recover Flightline Info |
| `select_tiles_by_polygon` | Select Tiles By Polygon |
| `sort_lidar` | Sort Lidar |
| `split_lidar` | Split Lidar |

**Interpolation & Gridding** —— 点云转栅格的整条产线：

| 工具 id | 名称 |
|---------|------|
| `flightline_overlap` | Flightline Overlap |
| `lidar_block_maximum` | Lidar Block Maximum |
| `lidar_block_minimum` | Lidar Block Minimum |
| `lidar_construct_vector_tin` | Lidar Construct Vector Tin |
| `lidar_contour` | Lidar Contour |
| `lidar_digital_surface_model` | Lidar Digital Surface Model |
| `lidar_hex_bin` | Lidar Hex Bin |
| `lidar_hillshade` | Lidar Hillshade |
| `lidar_idw_interpolation` | Lidar Idw Interpolation |
| `lidar_nearest_neighbour_gridding` | Lidar Nearest Neighbour Gridding |
| `lidar_radial_basis_function_interpolation` | Lidar Radial Basis Function Interpolation |
| `lidar_sibson_interpolation` | Lidar Sibson Interpolation |
| `lidar_thin` | Lidar Thin |
| `lidar_thin_high_density` | Lidar Thin High Density |
| `lidar_tile_footprint` | Lidar Tile Footprint |
| `lidar_tin_gridding` | Lidar Tin Gridding |

另外还有两条散落在别的分类里：**Remote Sensing → Filters** 下的 `lidar_ground_point_filter`（Lidar Ground Point Filter），以及 **Projection → General** 下的 `reproject_lidar`（Reproject Lidar）。

### 17.5.3 在哪里运行：WASM 还是 sidecar

| 复选框 **Run locally (WASM)** | 运行时 | 何时用 |
|------------------------------|--------|--------|
| 勾选 | 浏览器内 WebAssembly | 网页版、移动端、Mac App Store 版（那里没有 sidecar，复选框干脆不显示） |
| 不勾选 | 本地 Python sidecar（FastAPI，127.0.0.1:8765） | 桌面版默认；能读原生路径、适合成批处理磁盘目录 |

两种运行时的工具列表完全一样，变的只是执行引擎。工具运行会记进 **Processing → History**：工具名、引擎、耗时、输入输出图层，并提供 **Re-run**、**Edit & re-run**、**Copy JSON**、**Copy Python**。

### 17.5.4 输出怎么回到地图

- 点云输入 → 点云输出（如分类结果）：**作为点云图层加回地图**；WASM 引擎下若渲染器读不了这个格式，会**先转成 COPC** 再加；转换也失败时才退化为"下载文件"。
- 点云输入 → 栅格输出（如 DSM）：按 COG 加到地图，与普通栅格一样可调样式。
- 点云输入 → 矢量输出（如等高线、TIN）：加为普通矢量图层。

> **提示**：所有距离类参数在对话框里带一个**单位选择器**（米/英尺等），因为工具清单只声明"这是一个地面距离"，不声明单位。填完值记得看一眼单位，这是 LiDAR 工具最常见的参数事故。

---

## 17.6 从原始点云到 DEM/DSM：一条可复现的产线

这一节把散落的工具串成一次完整作业。目标：一份没有分类信息（或分类不可信）的机载点云 → 地面类 → 归一化 → DEM 与 DSM → 等高线。

### 17.6.1 先体检

动手前先跑两个"读"的工具，避免后面白做：

1. **Lidar Info**（`lidar_info`）：输出点数、范围、CRS、维度清单、分类直方图。**分类直方图是关键**——如果 Ground（2）为 0，说明这份数据没分类；如果 Ground 占比超过 60%，大概率已经分过。
2. **Lidar Point Stats**（`lidar_point_stats`）或 **Lidar Histogram**（`lidar_histogram`）：看高程分布与点密度，判断有没有明显的高程离群值。

### 17.6.2 分类：地面与建筑

| 步骤 | 工具 | 关键参数 | 结果 |
|------|------|----------|------|
| 1 | **Improved Ground Point Filter**（`improved_ground_point_filter`） | 最大坡度、坡度阈值、初始点间距、最大面尺寸 | 把地面点标为 **2 (Ground)**，其余标为 **1 (Unclassified)** |
| 2 | **Classify Lidar**（`classify_lidar`） | 同上，另加植被相关阈值 | 在 1/2 之外再分出低/中/高植被（3/4/5） |
| 3 | **Classify Buildings In Lidar**（`classify_buildings_in_lidar`） | 地面点已在手 | 把建筑屋顶标为 **6 (Building)** |
| 4 | **Classify Overlap Points**（`classify_overlap_points`） | 航带信息 | 标为 **12 (Reserved)** 或按工具设定，供后续剔除 |

> **注意**：第 1、2 步的参数没有"通用最优值"。点密度从 2 点每平方米到 50 点每平方米的城市，坡度阈值要差一个量级。经验做法是先用 **Clip Lidar To Polygon**（`clip_lidar_to_polygon`）裁一小块（例如 200 m x 200 m）反复调参，参数定下来再跑全图。

### 17.6.3 归一化与高度

分类只回答"这是不是地面"，归一化才回答"这一点离地面多高"：

1. **Normalize Lidar**（`normalize_lidar`）：用已分类的地面点插值出一张地面模型，逐点减去它，得到**归一化高度**；
2. **Height Above Ground**（`height_above_ground`）：直接输出每点的高于地面高度，常用于植被分析；
3. **Filter Lidar Classes**（`filter_lidar_classes`）：只留需要的类（例如只留 2 做 DEM，或留 2/6 做 DSM）；
4. **Lidar Remove Outliers**（`lidar_remove_outliers`）与 **Filter Lidar Noise**（`filter_lidar_noise`）：剔除 7 (Low point)、18 (High noise) 与统计离群点。

归一化之后的高程有两个用途：做**冠层高度模型（CHM）**，以及让 DEM 与 DSM 相减得到**真正的地物高度**（而不是地物顶部的绝对高程）。

### 17.6.4 栅格化：选对插值方式

| 工具 | 适用 | 输出特征 |
|------|------|----------|
| **Lidar Digital Surface Model**（`lidar_digital_surface_model`） | 一步出 DSM/DEM | 需要指定"取每格哪一个回波/哪一类" |
| **Lidar Tin Gridding**（`lidar_tin_gridding`） | 稀疏点、需要保形的 DEM | 三角网插值，边缘更贴合 |
| **Lidar Idw Interpolation**（`lidar_idw_interpolation`） | 规则格网 DEM | 反距离加权，参数是幂次与搜索半径 |
| **Lidar Nearest Neighbour Gridding**（`lidar_nearest_neighbour_gridding`） | 快速预览 | 最近邻，最快最粗糙 |
| **Lidar Radial Basis Function / Sibson** | 高质量曲面 | 慢，但平滑度好 |
| **Lidar Block Maximum / Minimum** | 建筑体量、地面包络 | 每格取最大/最小 z，不做插值 |
| **Lidar Hex Bin** | 密度与统计 | 六边形分箱 |
| **Lidar Hillshade** | 地形晕渲 | 直接由点云出晕渲图 |
| **Lidar Contour** | 等高线 | 输出矢量线 |

分辨率（`resolution`）是这些工具共有的核心参数。经验值：城市建筑用 0.5–1 m，区域地形用 1–5 m；分辨率小于平均点间距时会出现大量空洞。

### 17.6.5 一遍走完的检查清单

1. `lidar_info` 确认 Ground 类存在，否则先分类；
2. `filter_lidar_classes` 只留 Ground（2）→ 得到"只含地面点"的副本；
3. `lidar_tin_gridding` 或 `lidar_idw_interpolation` 生成 DEM，分辨率 1 m；
4. 回到原始（或只留 2/6）的副本，用 `lidar_digital_surface_model` 生成 DSM；
5. 两图相减（Processing → GeoLibre Toolbox → Raster → **Raster calculator**）得到地物高度；
6. `lidar_hillshade` 出晕渲，与 DEM 叠加检查是否有拉花、条带、空洞；
7. `lidar_contour` 出等高线，与晕渲对照检查高程是否自洽；
8. 把参数与中间结果记进 **History**（可 Copy Python），下次同类数据直接复用。

> **提示**：DEM/DSM 之后的坡度、坡向、填洼、汇流等分析，走的是 [第14章 地形与水文分析](https://znlgis.github.io/gis/tutorial/GeoLibre/第14章-地形与水文分析/) 里的栅格工具，不必在 LiDAR 分类里重复实现。点云这边只负责"把点变成一张可信的高程栅格"。

### 17.6.6 常见失败模式

| 现象 | 原因 | 处理 |
|------|------|------|
| DEM 上出现大片平面 | 该区域没有地面点（被过滤或本来就没采到） | 降低分类阈值重跑，或用 IDW 加大搜索半径 |
| DEM 比实际高 | 地面分类把低矮建筑/车辆当成地面 | 收紧最大面尺寸与坡度阈值 |
| DSM 有"毛刺" | 高噪声点未剔除 | 先跑 `filter_lidar_noise` 与 `lidar_remove_outliers` |
| 等高线出现锯齿 | 分辨率过高、点不足 | 降分辨率或用 TIN 插值 |
| 工具报内存不足 | WASM 一次处理点数过多 | 用 `lidar_tile` 切瓦片分批，或改用 sidecar |

---

## 17.7 点云标注工作台：会话与选择

**Point Cloud Annotation** 是一个插件（Plugins → Point Cloud Annotation），用来在地图上**直接给点打 ASPRS 类别**。它解决的问题很具体：一份 3DEP 数据里"体育场看台"常被留成"从未分类"，你要么补标，要么为分割模型造训练标签。

### 17.7.1 开始一个会话

1. 用 **Add Data → 3D layers → LiDAR Layer** 加载 LAS / LAZ / COPC / EPT；
2. **缩放到要标注的区域**。COPC/EPT 按细节层次流式加载，会话只持有"当前视图已加载的点"；
3. （可选，推荐）对流式 COPC 点 **Full detail in view**：把视图内所有点按**文件完整分辨率**加载进来（上限 **400 万点**），并在此后无论怎么缩放都保持加载，这样每一个点都能被标到。大范围可能要下载一两分钟；点 **Release full detail** 恢复普通流式。会话中也能用，但区域必须放得进"流式尚未占用的空间"；
4. 打开 **Plugins → Point Cloud Annotation**，选点云，点 **Start annotating**；
5. 会话期间点云**按分类着色**并**暂停流式**——移动地图不会把刚改过的点丢掉；
6. 标完点 **Finish session**，流式恢复。

> **警告**：会话期间不要切换渲染引擎、也不要移除点云图层。后者会直接结束会话并提示 "The point cloud was removed, so the session ended."。

### 17.7.2 五种选择工具

| 工具 | 快捷键 | 操作 | 备注 |
|------|--------|------|------|
| **Pan** | — | 左键拖拽平移地图 | 把左键还给地图 |
| **Box** | **B** | 拖出一个矩形 | 选择穿过所有深度的点（类似视锥） |
| **Lasso** | **L** | 自由画圈 | 同上 |
| **Brush** | **P** | 沿拖拽路径按半径选择 | 半径在面板设，或用 **[** / **]** 调 |
| **Polygon** | **G** | 逐点画多边形 | 双击 / **Enter** / 点第一个顶点闭合；**Esc** 取消 |

选择语义：

- 按住 **Shift** 加选，**Alt** 减选；面板里也有 **New selection / Add to selection / Remove from selection** 三档；
- 闭合多边形时按住 Shift/Alt 同样表示加/减；
- **Box / Lasso / Brush 的拖拽会贯穿深度**，一个矩形会同时选中它下方的地面和上方的屋顶——这正是后面要用 Z 过滤的原因。

### 17.7.3 三种收窄手段

| 手段 | 位置 | 作用 |
|------|------|------|
| **Min Z / Max Z** | Filters | 按高程（米）截取，只选这一段 |
| **Only points in class** | Filters | 只重标某一类，例如"只把 1 号点改成 2 号" |
| **Lock** | Classes in session | 锁住某类，其点永不被选中 |

此外还有两条隐含排除：**图例里被隐藏的类**、**高程过滤范围之外的点**，也不会被选中。

### 17.7.4 赋类

1. 选好点，面板显示 **N points selected**（底部状态会给一句 "Selected N points in M ms."）；
2. 在 **Assign class** 下拉选目标类，或直接按 **0**–**9** 选 ASPRS 0–9；
3. 按 **Apply (Enter)** 提交，一次可撤销的编辑；
4. **Clear (Esc)** 放弃选择；
5. **Undo / Redo** 在本次会话的赋类操作间前后翻。

在 **Classes in session** 里点某一行，等同于"把它设为待赋类"；行上的锁按钮就是 17.7.3 的 Lock。

---

## 17.8 类别、自定义类、实例、多边形转点与预标注

### 17.8.1 ASPRS 标准类别（0–18）

GeoLibre 使用 LAS 1.4 的标准分类码，颜色与渲染器一致：

| 码 | 名称 | 颜色 (RGB) | 典型用途 |
|----|------|------------|----------|
| 0 | Created, never classified | 128,128,128 | 未处理的原始点 |
| 1 | Unclassified | 128,128,128 | 分不出类 |
| 2 | Ground | 165,113,78 | DEM 的唯一来源 |
| 3 | Low vegetation | 144,238,144 | 草、低灌木 |
| 4 | Medium vegetation | 34,139,34 | 灌木、幼树 |
| 5 | High vegetation | 0,100,0 | 成熟林 |
| 6 | Building | 255,165,0 | 屋顶、墙面 |
| 7 | Low point (noise) | 255,0,0 | 低于地面的噪声 |
| 8 | Reserved | 128,128,128 | 保留 |
| 9 | Water | 0,0,255 | 水面 |
| 10 | Rail | 139,90,43 | 轨道 |
| 11 | Road surface | 128,128,128 | 路面 |
| 12 | Reserved | 128,128,128 | 保留（常被用来放"重叠点"） |
| 13 | Wire - guard | 255,255,0 | 防护线 |
| 14 | Wire - conductor | 255,200,0 | 导线 |
| 15 | Transmission tower | 200,200,0 | 电塔 |
| 16 | Wire-structure connector | 100,100,100 | 挂点 |
| 17 | Bridge deck | 0,128,255 | 桥面 |
| 18 | High noise | 255,0,255 | 高空噪声 |

### 17.8.2 自定义类

ASPRS 把 **19–63** 留给未来的标准类，**64–255** 留给用户。GeoLibre 的自定义类接受 **19–255**，但面板默认建议从 **64** 起的第一个空号。

1. 展开 **Custom classes**；
2. 填 **Code**（19–255）、**Name**、**Color**；
3. 点 **Add**。

加进去的类与标准类完全同权：可赋、可锁、可框选，LiDAR 面板的图例与悬停提示会显示它的名字和颜色。**随工程保存**，导出时写进 LAS 的 classification 字节（该字节本身就是 0–255）。

在代码侧可以提前定义：

- Python：`Map.set_point_cloud_classes([{"code": 64, "name": "Car", "color": "#e11d48"}])`
- MCP：`set_point_cloud_classes`

> **提示**：自定义类很适合"行业专有目标"——太阳能板、车辆、游船、施工围挡。训练集类目表定下来之后，先在 notebook 里一次性写进工程，再在界面里逐点修，比在面板里一个个加要稳。

同样的两件事可以在 notebook 里一次做完（需要在工程里已有该点云图层）：

```python
from geolibre import Map

m = Map()
m.set_point_cloud_classes([
    {"code": 64, "name": "Car", "color": "#e11d48"},
    {"code": 65, "name": "Solar panel", "color": "#0ea5e9"},
])

# 在图层文件的本地副本上跑预标注，把变化的类写成该图层的标签
m.prelabel_point_cloud(
    "https://example.com/tile.copc.laz",   # 图层的 source URL
    "C:/data/tile.copc.laz",               # 同一份文件的本地副本
    tool="ground-vegetation",
    only_unclassified=True,
)
```

### 17.8.3 实例（instance）

类别回答"这是什么"，实例回答"这是哪一个"。

1. 选中属于同一个物体的点（一辆车、一棵树、一栋楼）；
2. 在 **Assign class** 选好类；
3. 按 **New instance (N)** —— 这些点同时得到该类和一个新的**实例 id**，作为一次可撤销编辑；
4. 对 3D 框，**Assign class to points** 有同样效果（框内的点一起成为新实例）；
5. 展开 **Instances**：每行显示 "#id · 类名 · 点数"，**Select** 重新选中它的点，**Dissolve** 解散实例（点的类保留）。

实例 id 随工程保存，导出时随点一起写出（见 17.10.2 的 instance 维度）。

### 17.8.4 多边形转点（Polygons to points）

这个功能把"矢量面"当作"点云上的提取器"：SamGeo 分割出的掩膜、建筑轮廓、地块边界，都能直接"向上抬起"穿过点云。

1. 在 **Polygons to points** 里选一个多边形图层；
2. 二选一：
   - **Select inside**：选中落在任一面内（孔洞除外）的点，与当前选择按"绘制形状"的方式合并；
   - **Instance per polygon**：每个面内的点得到待赋类，并各自成为一个实例，一次可撤销编辑。点在多个重叠面里时，归**第一个**面。

> **警告**：一个建筑 footprint 会把**它上方和下方的所有点**都框进去，包括地面。先设 **Min Z / Max Z** 与 **Only points in class**（例如"只留地面以上的 1 号点"）再执行。锁定类、隐藏类、被高程过滤掉的点一律跳过——与手绘选择一致。

### 17.8.5 Whitebox 预标注

**Pre-label (Whitebox)** 在浏览器里跑 Whitebox 的 LiDAR 分类器（与 Processing → Whitebox Toolbox 同一份 WebAssembly），把结果作为一次可撤销编辑套上去。

| 选项 | 运行的分类器 | 结果 |
|------|--------------|------|
| **Ground (improved ground point filter)** | `improved_ground_point_filter` | 地面 → 2，其余 → 1 |
| **Ground, vegetation and unclassified (classify LiDAR)** | `classify_lidar` | 额外分出植被 |

配套选项与行为：

- **Only relabel unclassified points (0 and 1)** 默认**开**：你或测绘方已经分好的点一个都不动；
- 锁定类与隐藏类永不改动；
- 工具按**约 75 万点一片、20 m 重叠**分块跑（WASM 一次处理几百万点会内存耗尽）；一份 460 万点的会话大约几分钟；
- 进度显示 "tile n of total"；
- 结果只是**起点**，之后用选择工具修。

代码侧等价能力：

- Python `Map.prelabel_point_cloud(url, input_file, tool="ground", only_unclassified=True)`（需 `geolibre[pointcloud]` 额外依赖）；
- MCP `prelabel_point_cloud`。

两者都在**图层文件的本地副本**上跑同一套分类器，把变化的类写成该图层的标签；工程重新打开时标注工作台会显示这些标签。

---

## 17.9 3D 框（cuboid）与 3D 矢量

### 17.9.1 自动框：从一次点击长出一个物体

**Auto box (A)** 的算法是"区域生长 + 最小外接框"：

1. 在物体上点一下；
2. 从该点出发，把**彼此间距不超过 0.75 m** 的点聚成一簇；
3. 跳过地面、水面、噪声（2/9/7/18）以及锁定/隐藏类；
4. 对簇的**平面投影**求最小面积矩形，按物体朝向旋转；
5. 取簇的完整高程范围作为框高。

**Box from selection** 是它的手动版：先框选/套索/笔刷选好点，再点这个按钮。

新框使用 **Assign class** 里当前选中的类。

### 17.9.2 三个侧视图与键盘微调

点开一个框，进入 **Box views**：**Top**（俯视）、**Side**（沿框长边）、**Front**（横跨框）三个正交视图。

| 操作 | 手势 |
|------|------|
| 平移地图 | 框外拖拽 |
| 移动框 | 框内拖拽 |
| 缩放一条边 | 拖边（对面保持不动） |
| 旋转 | 顶视图里拖前缘之外的旋钮 |
| 缩放视图 | 滚轮（围绕指针） |

框在视图里打开时，键盘接管微调：

| 键 | 效果 | 按住 Shift |
|----|------|------------|
| 方向键 | 向北/南/东/西移动 10 cm | 1 m |
| **Q** / **E** | 逆/顺时针旋转 1 度 | 5 度 |
| **+** / **-** | 顶面升高/降低 10 cm | — |

> **注意**：框**只绕垂直轴旋转**，没有俯仰与横滚。这是当前实现的明确限制，倾斜屋顶只能靠调高度近似。

### 17.9.3 审核状态与属性

每个框带：

- **Review status**：**New** / **Reviewed** / **Flagged**；
- **Attributes**：名称/值对，最多 **32** 条，例如 `make: Ford`、`occluded: yes`。展开 **Attributes**，填名与值，点 **Add**；就地改值，或 **Remove**。名称若与框的内置属性重名会被拒绝。

框的每个条目还有三个动作：**Select points**（选中框内点）、**Assign class to points**（给框内点赋类，可撤销，且这些点同时成为新实例）、**Delete**。

### 17.9.4 导出框

| 格式 | 内容 |
|------|------|
| **Boxes as GeoJSON** | 每个框一个足迹多边形，属性含分类、z_min、z_max、尺寸、heading、status 与自定义属性 |
| **Boxes as Segments.ai JSON** | pointcloud-cuboid 标注：与 LAS 导出同一 CRS 与单位，heading 从格网东起算，状态与属性写在每条标注的 attributes 里 |

只在**从 URL 加载的点云**上，框才随工程保存（本地文件无法从工程重开，见 17.10.1）。

### 17.9.5 3D 矢量

用于描绘线状与点状地物：路缘、车道线、电力线、屋脊轮廓、电杆、树顶。

| 类型 | 快捷键 | 画法 |
|------|--------|------|
| **Polyline** | **V** | 逐点点击，双击 / **Enter** 结束 |
| **3D polygon** | — | 同上，闭合为面 |
| **Keypoint** | **K** | 点一下放一个点 |

细节：

- 每个顶点**吸附到 12 像素内最近的已绘制点**，并取该点的高程，所以矢量是"贴着点云表面"的；
- **Backspace** 删最后一个顶点，**Esc** 取消整条；
- 绘制期间地图的缩放与旋转被**锁定**，避免中途误转；
- 矢量使用 **Assign class** 当前类；在 **3D vectors** 列表里可以改类或删除。

导出：

- **Vectors as GeoJSON**：WGS 84 下的 3D Point / LineString / Polygon，带类与 3D 长度；
- **Vectors as Segments.ai JSON**：pointcloud-vector 标注，含 polyline / polygon / point 三类标注，CRS 与单位同 LAS 导出。

---

## 17.10 保存、导出与整文件回写

### 17.10.1 标签存在哪里

| 点云来源 | 标签是否随工程保存 | 说明 |
|----------|--------------------|------|
| **URL（COPC / EPT / 远端 LAZ）** | **是** | 每条编辑按"点的源节点 + 节点内索引"存储，而不是内存位置；工程重开、节点乱序到达都能重新套上 |
| **本地文件** | **否** | 工程无法重开这个文件，所以标签不保存；必须导出 |

这条差异直接影响工作流：**要长期保留标注，就用 URL 加载点云**（可以把本地文件放到任意静态服务器或对象存储上），或者在本地文件上直接导出 LAS/LAZ。

### 17.10.2 会话内导出

**Export** 下的四项，导的都是**当前会话已加载的点**：

| 选项 | 写出的内容 | 坐标系 | 备注 |
|------|------------|--------|------|
| **LAS 1.4** | 每点的分类、强度、回波、GPS 时间、扫描角 | 源文件 WKT 已知时写回源 CRS（含英尺单位），否则 WGS 84 | 有 RGB 时用 point format 7，否则 6；会话有实例时每点额外带一个 instance 记录（uint32，无实例写 0），laspy / PDAL / LAStools 可按名读取 |
| **LAZ (compressed)** | 与 LAS 相同的记录，LASzip 压缩 | 同上 | 在浏览器里用 laz-rs 的 WebAssembly 编码，体积约为 LAS 的 1/4 |
| **NumPy (.npy)** | 结构化数组：x、y、z（float64，与 LAS 导出同 CRS）、intensity、classification、有颜色时 red/green/blue、有实例时 instance | 同上 | 直接 `numpy.load` 即可 |
| **Segments.ai JSON** | pointcloud-segmentation 标注：point_annotations 与 LAS 文件**逐点对齐**，每个实例一条、无实例的点按类各一条，category_id 为类别码 | 同上 | 可直接上传 Segments.ai 做标注/训练 |

导出的 .npy 是不需要 GeoLibre 就能读的结构化数组：

```python
import numpy as np

cloud = np.load("session.npy")
print(cloud.dtype.names)                 # ('x','y','z','intensity','classification', ...)
print(len(cloud), cloud["classification"].max())
```

### 17.10.3 为什么"逐点对齐"是硬要求

Segments.ai 的标签是**按索引**对应点的，所以导出顺序必须与 LAS 文件严格一致。GeoLibre 的做法是：先把点写成 LAS/LAZ，再按同一份点序生成 JSON 标注。这意味着：

- 不要中途对点云做重排/抽稀类操作（`sort_lidar`、`lidar_thin`）后再导出配对文件；
- 训练集必须"一份 LAS + 一份 JSON"，成对保存；
- 若下游要 COPC，先按 17.10.5 转，再重新生成标注——COPC 内部点序与原始 LAS 可能不同。

### 17.10.4 Full file with labels：整文件回写

会话内导出只覆盖"已加载的点"。要把标签应用到**整份文件**，用 **Full file with labels**：

1. 确认 GeoLibre 本地服务（sidecar）在运行；
2. 该点云必须是从 **URL** 加载的（只有这类才有已保存标签）；
3. 填 **Local copy (.las, .laz or .copc.laz)**：与图层流式读取的同一份本地文件路径；
4. 填 **Output file (.las or .laz)**；
5. 点 **Write file**。

它**在 GeoLibre 服务里**逐块读取文件，因此比内存大的文件也能处理；输出永远是**普通 LAS/LAZ**，COPC 会被写成平面点云。完成后报告"写入 N 点，其中 M 个被重标、K 个属于实例"。

> **注意**：网页版下这两个路径必须在服务允许的目录内（`GEOLIBRE_CONVERSION_ROOTS`，Docker 镜像默认 `/data`）。桌面版没有这层限制。

### 17.10.5 需要 COPC 怎么办

标注工作台明确不支持 COPC 输出。做法是"导出 LAZ → 用 PDAL 转"：

```bash
# 把带 instance 维度与分类的 LAZ 转成 COPC
pdal translate labeled.laz labeled.copc.laz writers.copc
```

PDAL 会保留 Classification、Intensity、GpsTime、ScanAngleRank 与自定义 extra-bytes（含 instance）。转完用 GeoLibre 再打开验证一次分类着色是否正确——这是最省事的验收方式。

### 17.10.6 标注工作的推荐顺序

1. 把本地点云放到可访问的 URL（对象存储 / 静态服务器），用 URL 加载；
2. 缩放到目标区域，点 **Full detail in view**；
3. **Pre-label (Whitebox)** 打底（勾住"只改 0 和 1"）；
4. 按"先大类、后小类"修正：地面 → 建筑 → 植被 → 道路/水面；
5. 对独立物体补 **instances** 或 **3D boxes**；
6. 中途多次 **Export → LAS 1.4** 存档（切换引擎会丢未导出内容）；
7. 完成后 **Full file with labels** 出整份文件；
8. 需要 COPC 再转，转完复查。

## 17.11 3D Tiles、高斯泼溅与摄影测量产品

点云只是三维数据的一类。真实的摄影测量/激光扫描项目往往同时产出正射影像、DSM、点云、mesh 与 3D Tiles，GeoLibre 对每一类都有对应入口。

### 17.11.1 三维图层的入口与引擎

| 类型 | 入口 | 渲染方式 | 引擎限制 |
|------|------|----------|----------|
| **OGC 3D Tiles** | Add Data → 3D layers → **3D Tiles Layer**（tileset URL，可带鉴权请求头） | maplibre-gl-3d-tiles 加 deck.gl 的 Tile3DLayer | MapLibre / Mapbox / ArcGIS（经 deck 叠加）；Cesium 原生 |
| **Google Photorealistic 3D Tiles** | 同一面板的内置样例 | 同上 | 需要 Google Maps API key，走请求头，不落盘 |
| **Cesium Ion Asset** | Add Data → 3D layers → **Cesium Ion Asset**（asset id 加 ion token） | Cesium 原生 | 仅 Cesium；2D 引擎下该条目禁用 |
| **CZML** | Add Data → 3D layers → **CZML Dynamic 3D Scene** | Cesium 原生 | 仅 Cesium |
| **glTF / GLB** | Add Data → 3D layers → **3D Model (glTF)**（可调缩放、旋转、高度） | deck.gl 的 ScenegraphLayer | MapLibre / Mapbox / ArcGIS |
| **Gaussian Splatting** | Add Data → 3D layers → **Gaussian Splatting** | maplibre-gl-splat | 仅 MapLibre |

图层列表里这些与点云、矢量、XYZ 是**混排**的：同一条 Layers 面板里可以有 3D Tiles、glTF、点云、栅格。这也是 GeoLibre 与"必须开 Cesium 才能看 3D Tiles"的工具最大的差别。

### 17.11.2 点云还是 3D Tiles：怎么选

| 需求 | 选点云 | 选 3D Tiles |
|------|--------|-------------|
| 逐点分类、标注、训练集 | 是 | 否 |
| 提取 DEM/DSM、树高、建筑体量 | 是 | 否（几何已被烘焙） |
| 只做浏览、汇报、Web 发布 | 可以 | 更轻、更适合移动端 |
| 需要带纹理的真实感 | 否 | 是 |
| 需要体积测量、断面 | 是（配合测量工具） | 视 tileset 而定 |

一句话：**要"算"用点云，要"看"用 3D Tiles**。

### 17.11.3 摄影测量产品的落点

一套无人机摄影测量成果通常有五种产物，GeoLibre 各有对应入口：

| 产物 | 格式 | 入口 |
|------|------|------|
| 正射影像（Orthomosaic） | GeoTIFF / COG | Add Data → Files → **Raster Layer** |
| DSM / DTM | GeoTIFF / COG | 同上；与点云产出的 DEM 可互相对照 |
| 稀疏/密集点云 | LAS / LAZ / COPC | Add Data → 3D layers → **LiDAR Layer** |
| 三维 mesh | glTF / GLB / 3D Tiles | **3D Model (glTF)** 或 **3D Tiles Layer** |
| 等高线 / 矢量成果 | GeoJSON / Shapefile / GeoPackage | Add Data → Files → **Vector Layer** |

### 17.11.4 反向输出：把三维拉伸导出成模型

GeoLibre 也做"出"的一侧。把面图层的 **Visualization** 设为 **3D extrusion** 后，**Layer actions → Export** 会多出三个选项：

| 格式 | 特征 |
|------|------|
| **3D model: glTF (.glb)** | 每个要素一个命名对象，属性作为自定义属性，每种颜色一个材质；Blender 用 File → Import → glTF 2.0 打开 |
| **3D model: OBJ** | 每个要素一个对象，颜色写在顶点上 |
| **3D model: STL** | 单一无色网格，给 3D 打印与 CAD |

坐标以图层中心的米为单位；glTF 与 OBJ 以 **Y 轴向上**，STL 以 **Z 轴向上**；glTF 根对象上存了中心的经纬度。高度不高于拉伸底面、或没有面积的要素会被跳过，并提示跳过了多少个。

> **提示**：这条路径是"用二维轮廓加高度字段快速生成城市体块模型"的最短路径：在 GeoLibre 里做好分层拉伸与配色，导出 GLB 进 Blender 继续加工，比从零建模快得多。

---

## 17.12 在 Cesium 球上：能做什么，不能做什么

### 17.12.1 事实：点云不在球上渲染

GeoLibre 的点云靠 deck.gl 覆盖画布渲染，而覆盖层的视口计算是**按 Mercator 投影**做的。源码里两处写死了这件事：

1. 控件创建后立即调用 `ensureMercatorProjection(...)`；
2. 只要图层列表里还有点云，就持有一次 `acquireMercatorProjectionLock("lidar")`，全部点云移除才释放。

官方文档也直说 "the streamed point cloud does not render on the globe"。USGS LiDAR 面板因此在打开时**主动切到 Mercator**，关闭时恢复你原来的投影——这是一个明确的绕行方案，而不是 bug。

### 17.12.2 球上能做什么

| 能力 | Cesium 球 | 说明 |
|------|-----------|------|
| 地形、影像、3D Tiles | 可以 | Cesium 的主场 |
| Cesium Ion 资产、CZML 动态场景 | 可以 | 仅 Cesium 有 |
| 原生 KML/KMZ（保留样式与 overlay） | 可以 | 2D 引擎走普通 KML 导入器 |
| 星载足迹图层（ICESat-2 / GEDI） | 可以 | 它们是普通 GeoJSON 点图层 |
| 点云（LAS/LAZ/COPC/EPT） | 不可以 | 不渲染 |
| 点云标注工作台 | 不可以 | 明确限制为 MapLibre 渲染器 |
| 高斯泼溅 | 视引擎 | MapLibre 下可用；Cesium 下不作为原生能力承诺 |

### 17.12.3 三条可行的组合

1. **以点云为主**：留在 MapLibre（或 Mapbox/ArcGIS），要看球面时先移除或隐藏点云图层，再切投影。
2. **以球为主**：把点云成果先转成 3D Tiles（PDAL 到 Entwine / 3D Tiles 工具链），在球上浏览；分析仍在 MapLibre 下做。
3. **分屏**：项目支持多视图与多引擎分屏（见 [第08章 渲染引擎与三维可视化](https://znlgis.github.io/gis/tutorial/GeoLibre/第08章-渲染引擎与三维可视化/)），一侧球体看地形/城市，一侧 2D 看点云，两者共享同一份相机约定。

> **警告**：分屏时不要把点云塞进 Cesium 那一侧去"试试看"——它不会报错，只是什么都不画，很容易被误判成"数据坏了"。

---

## 17.13 性能、优化与限制清单

### 17.13.1 点云为什么"慢"，以及慢在哪

| 环节 | 瓶颈 | 缓解 |
|------|------|------|
| 传输 | 整份 LAS/LAZ 下载 | 转 **COPC**（八叉树加范围请求），只取视图内节点 |
| 解码 | 浏览器解压 LASzip | 用 COPC/EPT 的 LOD，减少单次解码量 |
| 绘制 | 单帧点数过多 | 调小 **point size**、缩小视图、按分类/高程过滤 |
| 标注 | 一次会话要保全部分辨率的点 | 用 **Full detail in view** 限定区域，别整幅图开全细节 |
| 工具 | WASM 内存上限 | 用 `lidar_tile` 切块，或切到 sidecar 引擎 |

### 17.13.2 让点云变轻的六个手段

1. **转 COPC**：收益最大的一步。本地 LAS/LAZ 可以用 Whitebox 的 `lidar_convert` 转，或用 PDAL 的 `writers.copc`。
2. **切瓦片**：`lidar_tile` / `lidar_tile_footprint` 按图幅拆分，一次只开一片。
3. **抽稀**：`lidar_thin` / `lidar_thin_high_density` / `lidar_grid_thin`（GeoLibre WASM 版）按格网保留代表点，用于可视化与快速分析。
4. **裁剪**：`clip_lidar_to_polygon` 只留研究区。
5. **去重**：`remove_duplicates` 去掉航带重叠造成的重复点。
6. **降维**：只保留需要的维度（例如去掉 RGB），用 `modify_lidar`。

### 17.13.3 标注工作台的性能边界

| 参数 | 数值 | 说明 |
|------|------|------|
| Full detail 上限 | **400 万点** | 视图内超出部分不会全细节加载 |
| 预标注分块 | **约 75 万点一片** | 20 m 重叠；WASM 单次处理上限所致 |
| 预标注耗时参考 | 460 万点约几分钟 | 与机器和分类器有关 |
| 选择耗时反馈 | 面板底部给出毫秒数 | 用于判断是否该缩小选择范围 |

### 17.13.4 限制清单（官方明示）

| 限制 | 影响 | 绕行 |
|------|------|------|
| **标注工作台仅 MapLibre 渲染器** | Mapbox/ArcGIS/Cesium 下不能用标注 | 切回 MapLibre 做标注 |
| **不支持导出 COPC** | 标注成果无法直接回到流式格式 | 导出 LAZ 后用 PDAL 的 `writers.copc` |
| **3D 框只绕垂直轴旋转** | 倾斜物体只能近似 | 调高度加属性标注 |
| **实例不按 id 着色** | 图上分不出不同实例 | 在 **Instances** 里点 **Select** 高亮 |
| **本地文件标签不随工程保存** | 重开工程丢标注 | 用 URL 加载，或及时导出 |
| **普通 LAS/LAZ 经 ?data= 超过 250 MB 被拒** | 大文件深链失败 | 转 COPC |
| **点云无 Blend 菜单** | 不能做混合模式叠加 | 用不透明度 |
| **球面不渲染点云** | Cesium 下看不到 | 见 17.12.3 |

### 17.13.5 排错对照表

| 症状 | 最可能的原因 | 处理 |
|------|--------------|------|
| 加载后一片空白，但图层在 | 镜头没飞过去（批量加入时 autoZoom 被临时关掉） | 双击图层或用 **Zoom to layer** |
| 报 "Failed to fetch" | 服务器 CORS 不允许当前来源 | 配 CORS；桌面版可走原生 HTTP |
| 分类着色全是灰 | 文件没有分类维度 | 先跑分类工具，或用高程着色 |
| 标注会话里点不动 | 类被 Lock，或该类在图例里被隐藏，或点在 Z 过滤之外 | 解锁 / 显示 / 放宽 Z |
| Full detail 卡在 loading | 视图太大或网络慢 | 缩小视图再点 |
| 导出 LAS 后 CRS 不对 | 源文件没有可用 WKT，退回 WGS 84 | 先用 `assign_projection_lidar` 赋投影 |
| Whitebox LiDAR 工具报内存不足 | WASM 单次点数过多 | 切瓦片或改用 sidecar |
| PDAL 读不到实例 id | 导出时没有实例 | 确认 **Instances** 非空后再导出 |

---

## 17.14 本章小结

- **数据形态决定能力边界**：点云是 deck.gl 覆盖层上的"流式点集合"，只有 COPC/EPT 能按视图取点；LAS/LAZ 整份读入，LAS 1.4 读不了会先转 COPC。
- **面板默认值就是起点**：左上角 LiDAR 面板，pointSize 为 2、colorScheme 为 elevation、autoZoom 开、pickable 关，两个内置样例（Autzen COPC、Cook County EPT）可用来验证环境。
- **三条数据来源**：本地/URL 直接加、USGS LiDAR（3DEP 裁剪成 COPC）、IGN LiDAR HD（法国瓦片）。星载的 ICESat-2 / GEDI 是**足迹矢量图层**，不是点云。
- **LiDAR 工具箱是 Whitebox 的 LiDAR 分类**，按 Analysis Metrics / Filtering & Classification / I/O / Interpolation & Gridding 四组组织，另有三个 GeoLibre (WASM) 条目；WASM 与 sidecar 二选一，结果按类型加回地图。
- **DEM/DSM 产线的关键不是插值，而是分类**：地面类错了，后面全是错的。标准顺序是体检 → 分类 → 归一化 → 过滤 → 插值 → 验证。
- **标注工作台的三个不变式**：会话期间暂停流式、锁定/隐藏/超 Z 的点永不被选、URL 加载的点云标签才随工程保存。
- **导出必须成对**：Segments.ai 标签按索引与 LAS 逐点对齐，任何重排都会破坏配对。
- **三维产品的分工**：要算用点云，要看用 3D Tiles / glTF / 高斯泼溅；球面不渲染点云是设计而非故障。

---

## 17.15 实践练习

**练习 1（基础加载与样式）**
用 Add Data → 3D layers → LiDAR Layer 加载内置 Autzen 样例（COPC）。完成：① 记录面板显示的点点数与包围盒；② 在 Elevation 与 Classification 之间切换，说明为什么某个选项在部分数据上看起来"没变化"；③ 导出一次 LAZ，比较文件大小与样例原文件。

**练习 2（格式对比）**
取同一份公开点云的 LAS 与 COPC 两个版本（例如 USGS 3DEP 某区块），分别在 GeoLibre 中加载。记录：首屏出现所需时间、拖动地图时的流畅度、内存占用趋势。写一段 200 字结论，说明在什么规模下值得做 COPC 转换。

**练习 3（DEM 产线）**
选一块 1 km x 1 km 的机载点云：用 `improved_ground_point_filter` 分类地面，用 `lidar_tin_gridding` 与 `lidar_idw_interpolation` 各出一份 1 m DEM，再用 `lidar_hillshade` 出晕渲。对比两份 DEM 在陡坎与建筑边缘的差异，并解释原因。

**练习 4（标注工作台）**
在 COPC 点云上开一个标注会话：① 用 **Full detail in view** 加载目标区域；② 用 **Only points in class** 只重标 1 号点；③ 给一处看台/屋顶建一个 **3D box**，设状态为 **Reviewed** 并加两条属性；④ 导出 LAS 1.4 与 Segments.ai JSON，并用 `numpy.load` 检查 .npy 导出的字段清单是否包含 instance。

**练习 5（星载剖面）**
用 Plugins → Web Services → NASA Earthaccess 搜一份 ICESat-2 ATL08 granule，Open 到 Add Data → ICESat-2 / GEDI，选两个强波束、开启质量过滤后加图层。打开 **Along-track profile**，导出剖面 CSV，用任意工具画出"沿轨距离—冠层顶"曲线，并说明曲线中断处代表什么。

**练习 6（边界条件）**
把一个点云图层加入项目后，切换到 Cesium 渲染引擎。记录发生了什么、GeoLibre 是否给出提示。再切回 MapLibre，用分屏（一侧 Cesium、一侧 MapLibre）复现一次，说明为什么"不报错但什么都不画"是最容易误判的失败模式。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/第16章-遥感影像与影像分析/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/第18章-AI助手MCP与智能体技能/" class="chapter-nav__next">下一章 →</a>
</div>
