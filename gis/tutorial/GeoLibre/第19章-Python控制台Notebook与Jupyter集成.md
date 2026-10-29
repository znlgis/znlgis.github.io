---
layout: default
title: 第19章 - Python 控制台、Notebook 与 Jupyter 集成
---

# 第19章 - Python 控制台、Notebook 与 Jupyter 集成

GeoLibre 与 Python 的关系有三个方向，非常容易混淆：

1. **Python 在应用里**：**Python Console**，用 Pyodide 在浏览器里跑 CPython，直接驱动你眼前的地图；
2. **Notebook 在应用里**：**Notebook 面板**，网页版是 JupyterLite，桌面版是真 JupyterLab 服务器；
3. **应用在 Notebook 里**：`geolibre` Python 包，把**整站 GeoLibre** 嵌进一个单元格，状态双向同步。

一、二方向是"从我这里操作地图"，三方向是"从 notebook 操作地图"。三者的 API 表面刻意做成一致——控制台里学会的调用，搬到 notebook 里基本能直接用。

> **说明**：本章基于 GeoLibre 3.4。方法名、参数名、环境变量、文件路径保留英文原文，叙述用中文。事实来源为仓库 `docs/user-guide/python-console.md`、`docs/notebook.md`、`docs/python.md`、`docs/r.md`、`python/src/geolibre/geolibre.py`、`backend/geolibre_server/notebook_client.py`、`backend/geolibre_server/jupyter_server_config.py`。

---

## 19.1 三种运行位置，一张对照表

| | Python Console | Notebook 面板 | `geolibre` 包 |
| --- | --- | --- | --- |
| 入口 | Processing → Python Console | Processing → Jupyter Notebook | `pip install geolibre` |
| 运行时 | Pyodide（浏览器内 WebAssembly） | 网页版 JupyterLite / 桌面版 JupyterLab | 你环境里的 CPython |
| 面板形态 | 底部可调高度面板 | 底部 iframe 面板 | 单元格里的 anywidget |
| 地图在哪 | 主地图（同一页面） | 左/上主地图，右/下 notebook | iframe 内的整站 GeoLibre |
| 数据可达性 | 受 CSP 与沙箱限制 | 桌面版可读本地文件；网页版不能 | 完整 CPython：geopandas、rasterio、GDAL |
| 状态持久 | 应用开着就保留变量 | kernel 存活期 | kernel 存活期 |
| 典型用途 | 临时改地图、试 API | 边写代码边看地图 | 分析、批处理、出图、可重复研究 |

> **提示**：先想清楚"数据在哪一侧"。数据在桌面磁盘上，用桌面版的 Notebook 面板或 `geolibre` 包；数据是公开 URL，三者都行；只想快速把图层改一改，Console 最快。

---

## 19.2 Python Console：首次运行与界面

### 19.2.1 打开与首次运行

**Processing → Python Console**，面板停靠在窗口底部，拖上边缘改高度，**✕** 关闭。它不阻塞应用其余部分。

Python 通过 [Pyodide](https://pyodide.org)（编译成 WebAssembly 的 CPython）运行，所以**网页版和桌面版都能用，什么都不用装**。第一次打开会下载运行时（几 MB，头部显示进度）；之后保持"热"状态，**变量在应用开着期间一直存在**——即使你关掉再打开面板。

### 19.2.2 键盘

| 键 | 动作 |
|----|------|
| **Ctrl/Cmd + Enter** | 运行当前代码 |
| **Enter** | 换行（多行编辑） |
| **↑ / ↓** | 上一条 / 下一条命令（光标在首行/末行时） |
| **Tab** 或 **Ctrl + Space** | 补全光标处的名字或属性 |

补全会**内省实时运行时**：输入 `geolibre.` 会列出它真正的方法，你自己定义的变量和导入的模块也能补全。多个候选时出现列表，**↑/↓** 选择，**Enter/Tab** 接受，**Esc** 关闭。

```python
geolibre.get_center()        # 当前视图的 [lng, lat]
geolibre.get_bounds()        # [west, south, east, north]
geolibre.fly_to(-122.4, 37.8, zoom=10)
```

### 19.2.3 脚本编辑器

要写多行、要留存的脚本，点头部的**面板图标**（Show editor）在控制台旁打开脚本编辑器——相当于 QGIS 的 Python 编辑器。拖分隔条改宽度，再点图标收起。

编辑器**与控制台共用同一个解释器**，所以脚本里定义的变量或函数立刻能在控制台用，反之亦然。

| 功能 | 行为 |
|------|------|
| **New / Open / Save / Save As** | 操作 `.py` 文件；桌面版写回打开的文件，浏览器版下载（或用 File System Access API） |
| 未保存标记 | 文件名旁显示 `•` |
| **Run**（或 Ctrl/Cmd+Enter） | 跑整个脚本，**有选中时只跑选中行**；输出与错误显示在右侧控制台 |
| **Tab** | 缩进 |
| **Ctrl+Space** | 补全 |
| **Ctrl/Cmd+S** | 保存 |

> **提示**：把常用的十行"初始化"（加底图、设视图、装包）存成一个 `.py`，每次开应用跑一遍，比记在脑子里可靠。

---

## 19.3 `geolibre` 对象：控制台的唯一入口

控制台暴露**一个对象** `geolibre`，它的方法镜像 Python 包，所以学一次两边通用。

### 19.3.1 相机与视图

| 方法 | 说明 |
|------|------|
| `get_view()` | 实时相机：`{center, zoom, bearing, pitch, bbox}` |
| `get_center()` | `[lng, lat]` |
| `get_bounds()` | `[west, south, east, north]` |
| `fly_to(lng, lat, zoom=, bearing=, pitch=, duration=)` | 动画移动；只改给出的字段 |
| `fit_bounds([w, s, e, n])` | 适配到范围 |
| `set_basemap(url)` | 设置底图样式（http(s) 或根相对 URL） |

### 19.3.2 图层

| 方法 | 说明 |
|------|------|
| `add_geojson(data, name=, **style)` | 从 GeoJSON 字典 / 几何 / 带 `__geo_interface__` 的对象加图层，可内联样式覆盖；返回图层 id |
| `await load_geojson(url, name=, **style)` | 抓一个 GeoJSON URL 再加，同样支持样式覆盖 |
| `layers` | `Layer` 列表，按绘制顺序 |
| `get_layer(layer_id)` | 取某个 `Layer`（不存在会抛错） |
| `remove_layer(layer_id)` | 按 id 删除 |
| `identify(lng, lat, layer_id=None)` | 查询某点的已渲染要素（等价于点击） |

`Layer` 的成员：

| 成员 | 说明 |
|------|------|
| `id`、`name`、`type` | 身份（只读） |
| `visible` | 读/写可见性 |
| `opacity` | 读/写不透明度（0–1） |
| `set_style(**style)` | 合并样式覆盖（例如 `fillColor="#ff0000"`） |
| `get_features()` | 要素列表，元素是 `Feature` |
| `zoom_to()` | 缩放到图层范围 |
| `remove()` | 从地图移除 |

`Feature` **本身就是一个普通 `dict`**，所以能直接序列化、能喂给 `geopandas.GeoDataFrame.from_features`；它另带 `.geometry`、`.properties`、`.id` 与 `__geo_interface__` 四个便利访问器。

### 19.3.3 处理与图像

| 方法 | 说明 |
|------|------|
| `list_algorithms()` | 可用算法（`id`、`name`、`group`、`parameters`） |
| `await run_algorithm(id, parameters=None)` | 跑算法，结果图层加进地图，返回 `{logs, resultLayerIds}` |
| `to_image()` | 把当前地图截成 **PNG 字节** |

### 19.3.4 异步与装包

控制台支持**顶层 await**。少数操作是异步的，必须 await：

```python
# 抓远程 GeoJSON 并加图层
await geolibre.load_geojson("https://example.com/data.geojson", name="Data")

# 跑处理算法；结果图层自动加进地图
geolibre.list_algorithms()            # 发现 id 与参数
result = await geolibre.run_algorithm("buffer", {"layer": layer_id, "distance": 1000})
print(result["logs"], result["resultLayerIds"])
```

为了启动快，初始只加载基础运行时，其余按需装：

```python
await geolibre.load_package("numpy")
import numpy as np
np.array([1, 2, 3]).mean()

await geolibre.load_package("geopandas")   # 会连带装 shapely / pyproj / pandas
```

Pyodide 发行版里的包都能这样装。

---

## 19.4 控制台的限制

| 限制 | 原因 | 影响 |
|------|------|------|
| **跑在主线程** | 设计使然——Python 要能同步驱动实时地图 | 长任务会短暂卡住界面；避免紧循环，重活走 `await run_algorithm(...)` |
| **沙箱** | Pyodide 读不到本机文件系统，也够不到桌面版的本地工具 | 不能 `open("C:/data.shp")`；网络访问受应用 CSP 约束 |
| **`to_image()` 返回字节** | 写不了文件 | 要落盘得自己走浏览器下载，或用桌面版脚本编辑器 |

> **注意**：同一个 API 在 notebook 里是 `Map` 对象的方法（见 19.12），在控制台里是 `geolibre` 模块函数。函数名一致，调用形态略有差别——控制台代码粘到 notebook 时通常只需把 `geolibre.` 换成 `m.`。

---

## 19.5 Notebook 面板：两种后端，同一个 iframe

**Processing → Jupyter Notebook** 在地图旁打开一个可缩放、可折叠的 notebook 面板。同一个 `<iframe>` 背后，网页版与桌面版是**不同的 Python 运行时**：

| 构建 | 后端 | 特征 |
|------|------|------|
| **网页版** | [JupyterLite](https://jupyterlite.readthedocs.io) | 整个 Jupyter UI 跑在浏览器里，Pyodide（WebAssembly）内核，**无服务器**；可用 `%pip install geopandas` 按需装包 |
| **桌面版** | 真 JupyterLab 服务器 | 应用从 uv 管理的 Python 环境里启动 `jupyter lab`（与 FastAPI sidecar 同一机制），监听 `127.0.0.1:8766`，token 认证，然后嵌入；完整 CPython 加原生地理栈（geopandas、rasterio、GDAL） |
| **Mac App Store 版** | JupyterLite | 例外：它无法 spawn 服务器，所以像网页版一样嵌 JupyterLite 站点 |

> **提示**：这与 `geolibre` Python 包**正好相反**：包是把整站应用嵌进 notebook，面板是把 notebook 嵌进应用。两者可以同时开，互不干扰。

---

## 19.6 从单元格驱动地图

### 19.6.1 客户端是预装的

一个轻量 `geolibre` 客户端已经预装进内核——网页版打包在 JupyterLite 的文件系统里，**不需要 pip install**；桌面版放在内核的 import 路径上。直接 import：

```python
import geolibre

m = geolibre.connect()          # 或 geolibre.Map()
m.fly_to(-122.4, 37.8, zoom=11) # 让左侧的实时地图飞过去
layer_id = m.add_geojson(
    gdf,
    name="My layer",
    fillColor="#facc15",
    strokeColor="#d97706",
)  # 接受 GeoDataFrame、dict 或 JSON 字符串；桌面版返回 id
m.get_layer(layer_id)
m.list_layers()
m.fit_bounds([-123, 37, -122, 38])
m.set_basemap("https://…/style.json")
```

### 19.6.2 "即发即忘"与读回语义

大多数**变更**调用是**即发即忘**的：发出去就行，不等回复。桌面版上 `add_geojson` 走中继的"带关联的请求/应答"路径，会返回新图层 id。同一条路径还提供：

- `list_layers()`：每个实时图层一个 dict，含 `id`、`name`、`type`、`visible`、`opacity`；
- `get_layer(layer_id)`：返回匹配的图层，或抛 `ValueError`。

拿到的 id 可以直接传给 `set_visibility`、`set_opacity`、`set_style`、`remove_layer`、`zoom_to_layer`。

### 19.6.3 多窗口与返回值陷阱

所有命令**广播**给连到同一个 Jupyter 服务器的每一个 GeoLibre 窗口。对 `add_geojson`、`list_layers`、`get_layer`，**第一个**关联回复返回给 notebook，后续回复被忽略。由于每个窗口维护自己的地图状态，**在把返回的图层 id 串进后续读回调用时，只用一个已连接窗口**。只有在你把多个窗口挂到同一个服务器时才会看到这个差异。

`add_geojson` 在两种情况下返回 `None`，且**从不直接失败**：

| 情况 | 行为 |
|------|------|
| **没有任何窗口收到命令**（没连接，或中继本身不可达） | 与其它变更一致：图层经显示通道发出，并给一个 `GeoLibreNotConnectedWarning` |
| **窗口收到了但 5 秒内没应答**（大的 `FeatureCollection` 会这样） | 给 `GeoLibreTimeoutWarning`；图层**仍在添加中**，所以刻意**不重发**（重发会加两次）——用 `list_layers()` 去找 |

读回调用在这两种情况下无值可返，于是**抛异常**：`GeoLibreNotConnectedError` / `GeoLibreTimeoutError`（都是 `RuntimeError`）。

> **注意**：**同步读回只在桌面版可用**。JupyterLite 走浏览器的 `postMessage`；阻塞它的 Python 调用会同时阻塞必须投递结果的浏览器事件循环。规范客户端源码在 `backend/geolibre_server/notebook_client.py`。

---

## 19.7 外部客户端与中继（relay）

### 19.7.1 用你自己的编辑器

桌面版的 JupyterLab 服务器是一个**普通、token 认证的** Jupyter 服务器，所以你可以挂任何 Jupyter 客户端上去，继续用自己的编辑器，而上面那些地图命令**照样能用**：

1. 打开一次 Notebook 面板（这一步才启动服务器）；
2. 点面板头部的**链接按钮**复制连接 URL；
3. 粘进你的客户端（VS Code 里是 *Jupyter: Specify Jupyter Server for Connections* → *Existing*）。

### 19.7.2 为什么能这样：中继而不是显示通道

命令走 Jupyter 服务器上的**中继**，而不是依赖 notebook 被"怎样显示"：

| 组件 | 作用 |
|------|------|
| `backend/geolibre_server/geolibre_server/jupyter_relay.py` | 一个 Jupyter Server 扩展（由 `jupyter_server_config.py` 启用），暴露 `POST …/geolibre/relay/command`、`…/geolibre/relay/socket`（WebSocket）、`GET …/geolibre/relay/status` |
| 环境变量注入 | 加载时把 `GEOLIBRE_RELAY_URL` 与 `GEOLIBRE_RELAY_TOKEN` 发布到服务器环境，**内核继承**——这就是 `import geolibre` 零配置找到地图的原因 |
| `useJupyterRelay` | 应用整个生命周期订阅那个 socket，带退避重连，把每条命令交给与 embed 相同的 `createScriptingHandlers` |
| `useNotebookBridge` | 仍然是**嵌入式面板**与网页版（JupyterLite）的 postMessage 路径——那里 notebook 页面确实是应用的 iframe |

POST 会回答"多少个应用窗口收到了命令"，所以断连会被报告而不是静默无事发生：

```python
geolibre.is_connected()   # False 表示没有 GeoLibre 窗口在监听
```

命令投递不了时客户端抛 `GeoLibreNotConnectedWarning` 并指向你自己的那一行。要把它升级为错误：

```python
import warnings, geolibre
warnings.simplefilter("error", geolibre.GeoLibreNotConnectedWarning)
```

**只有桌面版服务器有中继**：网页版（JupyterLite）没有服务器，也就没有可挂的外部客户端。

---

## 19.8 主题同步与 JupyterLite 站点构建

### 19.8.1 主题

| 构建 | 行为 |
|------|------|
| **网页版** | notebook **实时**跟随应用明暗主题（无需刷新）。JupyterLite 用 `exposeAppInBrowser` 构建（见 `apps/geolibre-desktop/jupyterlite/jupyter-lite.json`），把 app 对象放到 `window.jupyterapp`；iframe 同源，所以 `useNotebookThemeSync` 能伸进去，在主题变化时执行内置的 `apputils:change-theme` 命令 |
| **桌面版** | JupyterLab 服务器是**另一个来源**，这个跨源调用成为 no-op，notebook 保持自己的主题（要同步得写一个小 JupyterLab 扩展，属未来增强） |

### 19.8.2 构建网页版 JupyterLite 站点

网页版把自托管的 JupyterLite 站点嵌在 `apps/geolibre-desktop/public/jupyterlite/` 下。它**不进版本库**（约 70 MB），由一个尽力而为的预构建步骤生成，需要 `jupyter lite` CLI：

```bash
pip install -r apps/geolibre-desktop/jupyterlite/requirements.txt
npm run build:jupyterlite
```

`npm run dev` 与 `npm run build` 都会自动跑它：

| 命令 | 行为 |
|------|------|
| `npm run dev` | 首次经 `predev` 钩子构建**一次**（`--if-missing`），之后秒开 |
| `npm run build` | 每次经 `prebuild` **重建**，以便客户端/配置改动被带走 |

两者在 `jupyter lite` 未安装时**跳过并给警告**，所以纯 Node 构建仍能成功。但要清楚这样产出的后果：面板**不会**显示"未构建"提示，它的 iframe 请求 `/jupyterlite/lab/index.html`，而任何"未知路径返回 index.html"的东西——Tauri 的资源解析器，或带 SPA 回退（`try_files $uri /index.html`）的静态主机——会把**第二份 GeoLibre**交给面板（GeoLibre#1851、GeoLibre#1658）。装上依赖重构建即可。

有两种构建把"CLI 缺失"当**致命**而不是可跳过，因为它们要对外提供站点、不能降级：**Mac App Store 构建**，以及**任何设置了 `GEOLIBRE_JUPYTERLITE_REQUIRED=1` 的构建**（Docker 镜像就是）。

Docker 镜像会构建并提供该站点，并给 `/jupyterlite/` 单独一段 nginx 配置：

- **自己的 CSP**：JupyterLab 靠内联 `<script>` 引导，应用策略禁止内联，套用应用策略会出现"HTML 加载了但永远不启动"；
- **无 SPA 回退**（`try_files $uri $uri/ =404`），所以上面那个失败在这个镜像里表现为**404**，而不是重复的应用；
- 给内容哈希资源**长缓存**，否则前缀匹配会把它们的长缓存策略拿走。

构建配置在 `apps/geolibre-desktop/jupyterlite/`（`jupyter_lite_config.json`、`jupyter-lite.json`、构建用 `requirements.txt`）。构建会把内核客户端与起始 `Welcome.ipynb` 从 `backend/geolibre_server/` 下的规范副本（`notebook_client.py`、`notebook_examples/Welcome.ipynb`）拷进它的 `files/`。生成的目录被排除在 PWA 预缓存之外（见 `apps/geolibre-desktop/vite.config.ts` 的 `pwaPlugin`）。

### 19.8.3 桌面服务器

| 项 | 位置 / 值 |
|----|-----------|
| 后端 extra | `backend/geolibre_server/pyproject.toml` 里的 `notebook`（`jupyterlab`、`jupyter-server`），同步到它自己的 uv 项目环境，绝不打扰 sidecar 的环境 |
| 启动/停止 | `apps/geolibre-desktop/src-tauri/src/lib.rs` 的 `start_jupyter_server` / `stop_jupyter_server` Tauri 命令（与 sidecar 启动器同构），TS 包装在 `apps/geolibre-desktop/src/lib/jupyter.ts` |
| 嵌入授权 | `backend/geolibre_server/jupyter_server_config.py` 把 `Content-Security-Policy: frame-ancestors` 放宽到 Tauri webview / 回环来源；Tauri 的 CSP（`tauri.conf.json`）把回环来源加进 `frame-src`/`child-src` |
| 命令中继 | 同一个配置启用 `geolibre_server.jupyter_relay` 扩展；它的 WebSocket 只接受应用自己的来源，每个端点都要求服务器每次启动生成的 token，所以命令只能来自已经拥有该服务器内核执行权的东西 |

## 19.9 `geolibre` Python 包：安装与快速开始

### 19.9.1 安装

```bash
pip install geolibre
```

或从 conda-forge：

```bash
conda install -c conda-forge geolibre
```

可选 extras 提供对 GeoDataFrame 与本地矢量文件的 GeoPandas/Shapely 支持，以及对内存栅格的 xarray/rioxarray/rasterio/rio-tiler 支持：

```bash
pip install "geolibre[all]"      # 两者都装
pip install "geolibre[vector]"   # 只装 GeoPandas/Shapely
pip install "geolibre[raster]"   # 只装 xarray/rioxarray/rasterio/rio-tiler
```

`[all]` 是两者的并集，所以现在会顺带装上 rasterio（以及 GDAL）；只做矢量分析时用 `[vector]` 可以让环境保持轻量。

其它 extras：

| extra | 提供 |
|-------|------|
| `geolibre[spaceborne]` | h5py 加 NumPy，用于 `add_icesat2` / `add_gedi` 读 ICESat-2 与 GEDI 的 HDF5 granule |
| `geolibre[mcp]` | MCP SDK，跑 `geolibre-mcp` |
| `geolibre[pointcloud]` | 点云预标注与整文件回写 |
| `geolibre[dash]` | `from geolibre import DashMap`，嵌进 Dash 应用 |

> **注意**：`[all]` 只在 pip 上有效；用 conda 装完之后，要在同一环境里再 `pip install "geolibre[all]"`。

### 19.9.2 最小可运行示例

```python
from geolibre import Map

m = Map(center=(-100, 40), zoom=4)
m.add_geojson("https://example.com/data.geojson", name="Data")
m
```

最后那个裸露的 `m` 很关键：**完整 GeoLibre UI 在单元格里渲染**。继续加数据、继续驱动视图：

```python
m.add_tile_layer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    name="OpenStreetMap",
    attribution="(c) OpenStreetMap contributors",
)
m.add_cog("https://example.com/dem.tif", name="DEM", colormap="terrain")
m.add_basemap("dark")
m.set_center(-120, 47, zoom=8)
```

### 19.9.3 Earth Engine（可选）

需要 `pip install earthengine-api` 加凭据（`ee.Authenticate()` 一次，再指定 Google Cloud 项目）：

```python
import ee

ee.Authenticate()  # 每台机器一次
ee.Initialize(project="your-google-cloud-project")
m.add_ee_layer(ee.Image("USGS/SRTMGL1_003"), {"min": 0, "max": 3000}, name="SRTM")
```

`add_ee_layer` 在内核里求值 Earth Engine 对象，把得到的瓦片 URL 作为栅格图层加上去（ImageCollection 会被镶嵌；矢量对象会被样式化成栅格瓦片——那种情况下 `vis_params` 用 `ee.FeatureCollection.style()` 的键，例如 `color`、`fillColor`、`width`、`pointSize`，不是影像键）。

该 URL 绑定到一个会过期的 Earth Engine map id，所以保存的工程重开时可能需要重新生成这一层。结果是普通栅格瓦片图层，**不是**应用自己的 Earth Engine 面板管理的那种实时图层。

---

## 19.10 常用图层方法速查

| 方法 | 说明 |
|------|------|
| `add_geojson(data, name=, **style)` | GeoJSON 字典、文件路径、URL、JSON 字符串或 GeoDataFrame |
| `add_gdf(gdf, name=, column=None, **style)` | GeoDataFrame，可给 `column` 直接做分级设色 |
| `add_csv(data, x="longitude", y="latitude", name=, **style)` / `add_xy_data(...)` | 从 CSV 路径、URL、文本、DataFrame 或行映射加点 |
| `add_vector(data, name=, render_mode=, data_format=, source_layer=, **style)` | 远程矢量（GeoParquet、FlatGeobuf、ZIP Shapefile、GeoJSON…）或本地文件（经 GeoPandas 读入并内联） |
| `add_geoparquet` / `add_flatgeobuf` / `add_shp` / `add_kml` / `add_gpkg` | 各格式的便捷封装 |
| `add_polyline(polyline, name="Polyline", precision=5, unescape=False, **style)` | 编码折线图层（精度 5 或 6） |
| `add_vector_tiles(url, name=, source_layers=, source_layer=, **style)` | 从 TileJSON 端点加矢量瓦片 |
| `add_pmtiles(url, name=, tile_type=, source_layers=, **style)` | PMTiles 档案（矢量或栅格） |
| `add_tile_layer(url, name=, tile_size=, attribution=, bounds=, **style)` | 栅格 XYZ 瓦片 |
| `add_wms(endpoint, layers, name=, styles=, image_format=, transparent=, tile_size=, version=, crs=, bounds=, **style)` | WMS（GetMap，按瓦片栅格）；`crs` 默认 `EPSG:3857` |
| `add_wmts(url, name=, tile_size=, bounds=, **style)` | WMTS 瓦片模板 |
| `add_wfs(endpoint, type_name, name=, version=, output_format=, srs_name=, max_features=, **style)` | WFS（GetFeature GeoJSON，抓取后内联） |
| `add_cog(url, name=, bands=, colormap=, rescale=, **style)` | COG（URL 或内核侧本地 GeoTIFF 路径） |
| `add_raster(source, name=, url=, bands=, colormap=, rescale=, array_args=, **style)` | COG/GeoTIFF URL 或路径，或 xarray 对象（需 `geolibre[raster]`） |
| `add_lidar(url, name=None, **style)` | LAS / LAZ / COPC / EPT 点云（COPC/EPT 按细节层次流式） |
| `add_3d_tiles(url=None, name=, ion_asset_id=, altitude_offset=, request_headers=, **style)` | 3D Tiles `tileset.json`，或 Cesium Ion tileset（仅球面） |
| `add_czml` / `add_cesium_kml` | CZML 动态场景 / 原生球面 KML（仅球面） |
| `add_video(urls, coordinates, name=, **style)` | 四角点定位的地理参考视频 |
| `add_basemap(basemap)` / `set_basemap(basemap)` | 设置底图 |

关于本地栅格：`add_raster` / `add_cog` 也接受**内核主机上的本地 GeoTIFF 路径**，文件由随包启动的 localhost 服务器提供给应用读。这在本地 Jupyter 与 VS Code 里直接可用；在 Google Colab 里，因为内核代理不保留浏览器 COG 渲染所需的字节范围语义，GeoLibre 改在内核里把它渲染成 PNG XYZ 瓦片；JupyterHub 在装了 `jupyter-server-proxy` 时可以让 COG 走内核端口。**只有静态服务器扩展的部署**无法暴露内核文件，那里请传托管 URL。

> **警告**：这个服务出的 URL 是**会话级**的，所以保存了本地栅格的工程以后再打开**不会**恢复它。要做可重开的工程，就传托管 URL。

### 19.10.1 内存栅格（xarray）

装了 `geolibre[raster]` 才能可视化内存里的 xarray 对象。空间维叫 `lon`/`lat` 或 `longitude`/`latitude` 时默认按 EPSG:4326；否则要显式给 CRS 与维度名。Dataset 的变量默认成为波段，除非你选一个：

```python
m.add_raster(data_array, name="Temperature", colormap="viridis")
m.add_raster(
    dataset,
    name="Temperature",
    array_args={"variable": "temperature", "isel": {"time": 0}},
)
```

支撑一个 xarray 图层的临时 COG 在组件关闭时删除，所以 xarray 图层与本地文件有同样的"会话级"限制。本地时浏览器直接读那个 COG；在 Colab 里 rio-tiler 把它渲染成普通 PNG XYZ 瓦片，以避开 Colab 不兼容的字节范围代理行为。用完调 `m.close()` 可以立刻删；否则在 `Map` 被垃圾回收或内核正常退出时删。**被强杀的内核会把文件留在系统临时目录里**。

---

## 19.11 双向同步与工程文件

### 19.11.1 同步是双向的

因为工程双向同步，你可以在 UI 里平移缩放，再从 Python 把实时状态读回来：

```python
proj = m.to_project()
proj["mapView"]["center"]              # 反映 UI 里的实时视图
[layer["name"] for layer in proj["layers"]]
```

保存与重开工程，与桌面版、网页版**完全互通**：

```python
m.save_project("my-map.geolibre.json")

m2 = Map()
m2.load_project("my-map.geolibre.json")
m2
```

### 19.11.2 凭据自动脱敏

`to_project()`、`save_project()`、`to_html()` 会**脱敏凭据**：API key、token、带认证的请求头、密钥类环境变量（每一行没有标 `"secret": false` 的）、地理编码 key，以及 URL 里的凭据参数。所以任何你序列化、提交或分享的东西默认是安全的。

对"必须不重新输入凭据才能继续工作"的本地私密文件，给 `keep_credentials=True`：

```python
m.save_project("private.geolibre.json", keep_credentials=True)
```

> **注意**：`project` 这个 trait **本身不脱敏**，所以与组件的实时双向同步仍能让需要认证的图层正常渲染。这是有意为之："落盘/导出"要安全，"实时渲染"要能用。

---

## 19.12 Map 选项、交互查询、事件与处理

### 19.12.1 构造参数

```python
Map(
    center=(-100, 40),   # [lng, lat]
    zoom=4,
    basemap="dark",      # 底图名或 MapLibre style URL
    renderer="maplibre",  # maplibre / mapbox / cesium / arcgis
    height="800px",
    layout="embed",      # "embed"（紧凑 UI）、"full"（桌面 UI）或 "maponly"
    theme="light",       # "light" 或 "dark"
    server_proxy=False,  # 远程服务器时设 True，见 19.15
)
```

### 19.12.2 交互查询与事件

除了加数据，组件还能**查询实时应用并对它作出反应**——与应用内 Python Console 是同一个表面。这些调用会往运行中的地图**往返**，所以地图必须先显示（在一个单元格里输出 `m`），然后在后续单元格里查询。

```python
m.get_center()                 # 实时 [lng, lat]，反映 UI 的平移缩放
m.get_bounds()                 # [west, south, east, north]
m.fly_to(-122.4, 37.8, zoom=10)
m.identify(-122.4, 37.8)       # 某点上的要素，等价于点击地图

# Layer 对象：读写图层、读要素
for layer in m.layers:
    layer.opacity = 0.6
features = m.layers[0].get_features()   # GeoJSON Feature 列表

# 跑处理算法；结果图层加进地图
m.list_algorithms()
m.run_algorithm("buffer", {"layer": layer_id, "distance": 1000})

# 读回用户在图上选中或绘制的东西
m.get_selected_features()      # 被点选的要素
m.get_drawn_features()         # 用 Geo Editor 画的要素
m.user_rois                    # 画出的 ROI，GeoJSON FeatureCollection
m.get_drawn_features(as_gdf=True)   # 同一个，GeoDataFrame（需 GeoPandas）

png = m.to_image()             # PNG 字节（或 m.to_image("map.png")）
m.to_html("map.html")          # 独立 HTML，内嵌实时工程
```

事件回调：

```python
m.on_click(lambda e: print("clicked", e["lngLat"]))
m.on_selection_change(lambda e: print("selected", e))
m.on_layer_change(lambda e: print("layers", e["layerIds"]))
```

> **注意**：**交互查询会阻塞内核**直到应用回复（通过 `jupyter_ui_poll`，自动安装）。慢调用请传 `timeout=`，例如 `m.run_algorithm(..., timeout=300)`。

### 19.12.3 处理与 Whitebox

| 方法 | 说明 |
|------|------|
| `list_algorithms()` | 可用处理算法（`id`、`parameters` 等） |
| `run_algorithm(id, parameters=None, timeout=)` | 跑算法，返回 `{logs, resultLayerIds}` |
| `run_model_builder(graph, timeout=)` | 在已显示的 app 里跑一个序列化后的 Model Builder 图 |
| `list_whitebox_tools()` / `run_whitebox_tool(tool_id, parameters=None, timeout=)` | 列出/在浏览器里用 WASM 跑内置 Whitebox 工具；后者返回 `{logs, resultLayerIds}` |

### 19.12.4 其它常用方法（选摘）

| 方法 | 说明 |
|------|------|
| `set_center(lng, lat, zoom=None)` / `set_zoom` / `set_bearing` / `set_pitch` / `fit_project_bounds` | 不需要显示组件也能持久化相机改动 |
| `rename_layer` / `move_layer` / `duplicate_layer` / `show_layer` / `hide_layer` | 按 id、名字或 `Layer` 句柄管理图层 |
| `layer_properties(layer)` / `column_values(layer, column)` / `describe()` | 无浏览器往返地检查内联数据、汇总工程 |
| `set_layer_filter(layer, expression)` | 用布尔 MapLibre 表达式隐藏不匹配要素；`None` 清除 |
| `set_labels(layer, field=None, expression=None, enabled=None, **options)` | 按属性或文本表达式标注；选项含 `placement`、`size`、`color`、`halo_color`、`min_zoom`、`max_zoom`、`anchor`、`offset_x/y`、`rotation`、`number_format` 以及各类 `*_expression` |
| `set_identify(layer="all")` | 让点击弹出识别框：一个图层、一组图层、所有可见图层（`"all"`）、或关闭（`None`） |
| `show_control(name, visible=True)` / `hide_control(name)` | 显示/隐藏工具面板（`bookmark`、`search`、`measure`、`minimap`、`print`）或内置控件（`navigation`、`fullscreen`、`compass`、`geolocate`、`globe`、`scale`、`attribution`、`logo`） |
| `set_projection(projection)` / `projection` | `"globe"`（默认）或 `"mercator"`，随工程保存 |
| `set_story_map(**settings)` / `add_story_chapter(...)` | 故事地图与章节（见第 20 章） |
| `add_bookmark` / `remove_bookmark` | 书签面板条目 |
| `set_plugin_state(plugin_id, state=None, position=, activate=True, allow_unknown=False, clear=False)` | 保存插件的工程状态 |
| `set_layer_metadata(layer, merge=False, **fields)` / `clear_layer_metadata(layer)` | 编目元数据（应用 Metadata 对话框、STAC Item 导出与 GeoParquet 导出元数据都用它）；邮箱、ISO 8601 日期、链接 URL 会被校验 |

样式关键字参数（`fillColor`、`strokeColor`、`strokeWidth`、`circleRadius` 等）直接映射到 GeoLibre 的图层样式字段。

---

## 19.13 图例、色带与卷帘

```python
# 应用的地图图例面板（Controls > Legend），由每个图层的样式生成
m.set_map_legend("Population", position="bottom-right")

# 内置土地覆盖图例，或自己的 {label: color} 字典
m.add_legend(builtin="nlcd")
m.add_legend(legend_dict={"Water": "#0000ff", "Land": "#00ff00"})

# 连续栅格的色带
m.add_colorbar(colormap="terrain", vmin=0, vmax=4000, label="Elevation", units="m")

# 用卷帘滑块对比两个图层（或一个图层与底图）
before = m.add_cog("https://example.com/before.tif", name="Before")
after = m.add_cog("https://example.com/after.tif", name="After")
m.split_map(before, after)
```

| 方法 | 要点 |
|------|------|
| `set_map_legend(title=None, position=, group_by_layer=, visible=, collapsed=)` | 一个地图只有一个；再调即更新 |
| `add_legend(title=None, legend_dict=, labels=, colors=, builtin=, position=, shape=)` | `builtin` 可用 `"nlcd"`、`"esa_worldcover"` |
| `add_colorbar(colormap=, vmin=, vmax=, label=, units=, colors=, orientation=, position=)` | 可用命名色带或自定义 `colors` |
| `add_colormap(colormap, vmin=, vmax=, label=, **kwargs)` | `add_colorbar` 的 leafmap 风格别名 |
| `split_map(left_layers=None, right_layers=None, orientation=, position=, control_position=)` | 卷帘（分屏对比） |

> **提示**：`set_map_legend` 与 `add_legend` 的区别是"自动 vs 手写"。前者从图层符号化生成，改样式它跟着变；后者是你给的一组固定条目，适合叠加说明（例如"图中灰线为行政区界"）。

---

## 19.14 标记、弹窗与尺寸

### 19.14.1 两种点渲染模式

`add_marker` 与 `add_markers` 把常见点符号参数做成命名参数，不用记底层样式键：

```python
m.add_markers(points, color="#e11d48", radius=8, stroke_color="#ffffff", stroke_width=2)
m.add_markers(points, shape="pin", color="#e11d48", size=32)
m.add_markers(points, icon='<svg viewBox="0 0 24 24">…</svg>', size=28)
```

一个点图层有两种画法：

| 模式 | 触发 | 尺寸参数 |
|------|------|----------|
| **圆（circle）** | 默认 | `radius`（MapLibre 圆半径） |
| **标记精灵（sprite）** | 给了 `shape`、`size` 或 `icon` | `size`；`shape` 取 `circle`、`square`、`triangle`、`diamond`、`star`、`cross`、`pin`、`custom`（需 `icon`，原始 SVG 或 data URL） |

两种模式的参数**不通用**，混用会**报错而不是静默无效**：精灵图层会整体替换圆图层并自带白色光晕，所以 `opacity`、`radius`、`stroke_color`、`stroke_width` 是圆专用，给了 `shape`/`size`/`icon` 时会被拒绝。精灵的 `color` **必须是十六进制**，因为精灵烘焙器只接受这种，否则会静默回退到默认蓝。

命名参数与底层样式键同时给出时（`add_markers(pts, radius=8, circleRadius=20)`），**原始样式键胜**——它是底层逃生口。

### 19.14.2 弹窗字段类型

不给任何配置时，识别工具开启后点要素会显示图层名与全部可见属性，且没有悬停提示。每个接受样式覆盖的 `add_*` 方法都接受 `popup=` 与 `tooltip=`（例外是 `add_ee_layer`，签名固定），`set_popup` / `set_tooltip` / `clear_popup` 改已有图层。

```python
m.add_markers(
    points,
    popup={
        "title": "name",
        "fields": [
            {"field": "name", "label": "Site"},
            {"field": "photo", "kind": "image", "label": "Photo"},
            {"field": "url", "kind": "link", "link_label": "Read more"},
            {"field": "pop", "kind": "number", "thousands": True, "suffix": " people"},
            {"field": "surveyed", "kind": "date", "date_format": "datetime"},
        ],
    },
    tooltip="name",
)

m.set_popup("Sites", ["name", "pop"], title="name")   # 替换配置
m.set_tooltip("Sites", ["name"])                       # 加悬停提示
m.set_popup("Sites", click=False)                      # 点击不弹
m.clear_popup("Sites")                                 # 回到默认
```

字段的 `kind` 决定渲染方式：

| `kind` | 渲染为 |
| --- | --- |
| `auto`（默认） | 文本；内联 base64 栅格 data URL 会变成缩略图 |
| `text` | 文本，应用 `prefix`/`suffix` |
| `number` | 本地化数字；`decimals`、`thousands`、`prefix`、`suffix` |
| `date` | 本地化日期；`date_format` 取 `date`、`datetime`、`time`、`iso`、`year` |
| `link` | `http(s)` 值变链接，标签用 `link_label` |
| `image` | `http(s)` 值或内联 base64 栅格 data URL 变缩略图 |

### 19.14.3 尺寸

弹窗默认 **520 px** 宽（带图片时 **420 px**，可拖宽），内部图片最高画到 `min(50vh, 420px)`。`max_width` 与 `image_height` 以 CSS 像素改这两个值：

```python
m.set_popup("Sites", max_width=640, image_height=420, merge=True)
# 或作为任何 add_* 的顶层参数
m.add_markers(sites, popup=["name", "photo"], popup_max_width=640, popup_image_height=420)
```

| 参数 | 允许范围 |
|------|----------|
| `max_width` | 288–1200（视口仍会压它） |
| `image_height` | 40–1200 |

缩略图保持长宽比，所以横版照片要**同时**把宽度放大才能用上多出来的高度。超出应用渲染范围的尺寸会**报错**，而不是在图上被静默截断；点图片仍会在灯箱里全尺寸打开。

### 19.14.4 两条容易踩的规则

1. **属性里的原始 HTML 不会被当作标签渲染，Markdown 也不会。** 从 GeoJSON 来的弹窗值是不可信内容，所以按文本写出。要图片和链接就用 `kind="image"` 与 `kind="link"`；要拼一句话就用 `body_expression`（MapLibre 表达式，JSON 文本），例如 `body_expression='["concat", ["get", "name"], " — ", ["get", "county"], " County"]'`。唯一的例外是 KML 的 `description`：它的已知标记会被清洗后渲染，所以转换来的 KML 能保留描述卡片。
2. **悬停提示需要被标记的字段，而标记字段会收窄点击弹窗。** 两者共用一张字段表：提示显示标了 hover 的条目，点击弹窗显示**全部**条目——但只有在字段表为空时才回退到"全部可见属性"。所以 `m.add_markers(points, tooltip="name")` 会让点击弹窗**只显示 name**。要保留完整点击弹窗，就把点击要看的字段也列出来：

```python
m.add_markers(points, popup=["name", "pop", "county"], tooltip="name")
```

一个永远显示不出东西的提示会**报错**而不是静默不出现——包括只标了一个 `image` 字段的情况（图片不会进悬停提示，因为它的值是 URL，会把提示变成一整串地址）。点击弹窗仍然显示图片。

---

## 19.15 marimo 与远程环境

### 19.15.1 marimo

marimo 能渲染 GeoLibre 的 anywidget，但它的浏览器可能够不到 GeoLibre 通常服务应用的随机 `127.0.0.1` 端口，症状是 iframe 显示 `127.0.0.1 refused to connect`。显示之前把组件指向托管版应用：

```python
from geolibre import Map

m = Map(center=(-100, 40), zoom=4)
m._app_url = "https://web.geolibre.app/"
m.add_basemap("dark")
m.add_vector(
    "https://data.source.coop/giswqs/opengeos/world_cities.geojson",
    name="World cities",
)
m
```

这用的还是同一套工程同步桥，只是应用的位置变了。要在单元格返回 `m` **之前**设 `_app_url`，这样 iframe 首次渲染就用托管 URL。

示例用 `add_vector()` 让托管版浏览器**直接**去抓远程 GeoJSON；`add_geojson(url)` 则是用 Python 下载并内联，遇到拒绝 Python HTTP 客户端的数据主机就会失败。

因为托管版访问不到内核临时 localhost 服务器暴露的文件，栅格与其它"浏览器直接加载"的源要用托管 URL。本地 GeoJSON、CSV 与矢量文件仍可用——它们在 Python 里读入并内联进工程。`_app_url` 目前是**内部兼容手段**，不是公开构造参数。

> **警告**：组件会把同步后的工程（含任何内联的本地数据）通过 `window.postMessage` 发给 `_app_url` 指定的来源。处理敏感数据时只使用可信的 app URL，或自托管 GeoLibre。

### 19.15.2 支持的环境

| 环境 | 行为 |
|------|------|
| 本地 Jupyter / VS Code | 应用直接从 localhost 提供 |
| Google Colab | 自动走 Colab 内置端口代理（`google.colab.kernel.proxyPort`） |
| JupyterHub（含托管/共享 hub，运行时按 `JUPYTERHUB_SERVICE_PREFIX` 识别） | 前端探测两条同源路由，取活着的那条，所以主机只需**其中一条** |
| 其它远程服务器（Binder、SSH/网络上的远程 JupyterLab） | 传 `Map(server_proxy=True)` 走同一套双路由远程路径 |
| marimo | 用 19.15.1 的托管 app URL；Jupyter 的代理与服务器扩展路由在 marimo 里不可用 |

JupyterHub 的两条路由：

1. 随 `geolibre` 一起装的 **Jupyter Server 扩展**，挂在 `{base_url}geolibre/app/`（notebook 服务器自己的来源）。`pip install geolibre` 时**自动启用**，不需要 `jupyter-server-proxy`、不需要额外端口，所以能在禁止裸端口代理的受限 hub 上工作——但它从启动配置 drop-in 加载，**要重启 Jupyter 服务器才注册**。
2. `jupyter-server-proxy` 的 `{base_url}proxy/{port}/`，在任何装了它的地方都能到内核 localhost 的包，**正在运行的服务器无需重启**。

设 `Map(server_proxy=False)` 可以强制走直连 localhost。hub 上加载失败时，要么装 `jupyter-server-proxy`，要么确认扩展已启用（`jupyter server extension list` 看 `geolibre`；没有就跑 `jupyter server extension enable geolibre`）**并重启** Jupyter 服务器。

### 19.15.3 URL 抓取的安全提醒

`add_geojson(url)`、`add_csv(url)` / `add_xy_data(url)`、`add_wfs()` 是**从内核**抓 URL 的，会跟随重定向，所以 notebook 能到达内核能到的任何主机。每一跳都会检查，解析到非公网地址（私有、回环、链路本地——包括 `169.254.169.254` 这类云元数据端点）的 URL 会被拒绝；响应上限 **50 MB**。瓦片与服务图层则由**浏览器**抓取，所以那些仍可指向本地服务器。**不要在共享/多租户内核上加载不可信的 `.geolibre.json` 工程或 URL。**

---

## 19.16 MCP 与源码构建

### 19.16.1 同一个包里的 MCP 服务器

```bash
pip install "geolibre[mcp]"
geolibre-mcp --root ~/maps
```

它用与本包**相同的 builder** 造工程，所以它写的东西在组件、桌面版、网页版里都能原样打开。工具清单与客户端配置见 [第18章 AI 助手、MCP 与智能体技能](https://znlgis.github.io/gis/tutorial/GeoLibre/第18章-AI助手MCP与智能体技能/)。

### 19.16.2 从源码构建

包在仓库的 `python/` 目录。两个内置前端**独立**从 monorepo 根构建：

```bash
npm install
npm run build:embed      # 构建并暂存 Jupyter/web 应用
npm run build:mcp-app    # 构建并暂存独立 MCP App
python -m build python   # 构建 wheel 与 sdist
python -m twine upload python/dist/*  # 上传 PyPI
pip install -e python    # 开发用可编辑安装
```

打包钩子**只**跑那些暂存产物缺失的前端构建。要在一个完整 checkout 上刷新两者，设 `GEOLIBRE_FORCE_JS_BUILD=1`；预构建的 sdist 既不需要 Node 也不需要 monorepo 源码。

| 改了什么 | 怎么生效 |
|----------|----------|
| Python 代码 | 重启内核 |
| Jupyter 应用 | 重跑 `npm run build:embed` 并重启内核 |
| MCP 预览 | 跑 `npm run build:mcp-app` 并重启 MCP 客户端 |

---

## 19.17 渲染引擎与混排

```python
m = Map(renderer="cesium", center=(-100, 40), zoom=4)
m.set_map_layout(1, 2, view_kinds=["cesium", "maplibre"], sync_view=True)
pane_id = m.project["secondaryMapViews"][0]["id"]
m.set_renderer("cesium", pane_id=pane_id)
assert m.get_renderer() == "cesium"
```

| 项 | 规则 |
|----|------|
| 渲染器 | `"maplibre"`、`"mapbox"`、`"cesium"`、`"arcgis"` |
| 目标 | 省略 `pane_id` 改主图 |
| 网格维度 | 1–4；`view_kinds` 每格一个渲染器，主视图在前 |
| 调整布局 | 既有 pane id、相机与可见性覆盖会保留 |
| 保存 | 正常保存工程即可保留 `primaryRenderer` 与各分屏的 `viewKind` |
| Dash | `DashMap(renderer="cesium")` 设同一初始渲染器；回调可经 `project` 改这些字段 |

---

## 19.18 R 包与 Shiny / Quarto / R Markdown

`geolibre` 的 R 包通过 [`htmlwidgets`](https://www.htmlwidgets.org/) 把完整 GeoLibre 地图嵌进 RStudio、Quarto、R Markdown 与 Shiny。它创建标准的 `.geolibre.json` 工程，所以地图可以在 R 与 GeoLibre 网页版/桌面版之间来回。

### 19.18.1 安装

```r
install.packages("geolibre")            # CRAN
```

```r
install.packages("pak")
pak::pak("opengeos/geolibre-r")         # 开发版
```

### 19.18.2 快速开始

```r
library(geolibre)

places <- list(
  type = "FeatureCollection",
  features = list(list(
    type = "Feature",
    properties = list(name = "Washington, DC"),
    geometry = list(
      type = "Point",
      coordinates = c(-77.0369, 38.9072)
    )
  ))
)

geolibre(map_only = TRUE) |>
  add_geojson(
    places,
    name = "Places",
    style = list(fillColor = "#dc2626", circleRadius = 8)
  ) |>
  set_view(center = c(-77.0369, 38.9072), zoom = 10)
```

组件在 RStudio Viewer 与渲染出的 HTML 文档里自适应。它的地图**加载托管版 GeoLibre 应用**，所以查看需要联网——除非 `app_url` 指向自托管部署。

### 19.18.3 sf、栅格与工程文件

```r
library(sf)

nc <- st_read(system.file("shape/nc.shp", package = "sf"), quiet = TRUE)

geolibre() |>
  add_sf(nc, name = "North Carolina counties")
```

`add_sf()` 接受 `sf` 对象并在把 GeoJSON 交给浏览器之前转换到 WGS 84。`sf` 包是**可选**的；Linux 上安装它可能需要 GDAL、GEOS、PROJ、UDUNITS 等系统库。

```r
geolibre() |>
  add_raster(
    "https://example.org/visual.tif",
    name = "Satellite image",
    bands = c(1, 2, 3)
  )
```

GeoLibre 在浏览器里直接读远程 COG；托管它的服务器必须支持 CORS 与 HTTP range 请求。

```r
map <- geolibre() |> add_geojson(places)
save_project(map, "example.geolibre.json")

restored <- geolibre(load_project("example.geolibre.json"))
```

保存的工程也能在 GeoLibre Web 或 Desktop 打开。在 Shiny 应用里，浏览器侧的改动可从 `input$<outputId>_project` 读到。

### 19.18.4 Shiny

用 `geolibreOutput()` 与 `renderGeolibre()` 渲染地图；用 proxy 更新实时组件而不重建输出：

```r
library(shiny)
library(geolibre)

ui <- fluidPage(
  geolibreOutput("map", height = "80vh"),
  actionButton("reset", "Reset view")
)

server <- function(input, output, session) {
  map <- reactiveVal(geolibre(map_only = TRUE))
  output$map <- renderGeolibre(map())

  observeEvent(input$reset, {
    next_map <- set_view(map(), center = c(0, 20), zoom = 2)
    map(next_map)
    update_geolibre(geolibre_proxy("map"), next_map)
  })
}

shinyApp(ui, server)
```

### 19.18.5 自托管

给单个组件或整个 R 会话设自定义应用 URL：

```r
geolibre(app_url = "https://gis.example.org/")
options(geolibre.app_url = "https://gis.example.org/")
```

部署必须同时提供 GeoLibre web 应用与它的 `?embed=1` 工程桥。完整 API 见 <https://r.geolibre.app/reference/>。

---

## 19.19 架构：整站是怎么被嵌进一个单元格的

### 19.19.1 运行原理

wheel **打包了 GeoLibre 的 web 构建**。import 时包启动一个小的 localhost 静态服务器来提供这个打包好的应用；组件把该应用渲染在一个 iframe 里，并通过 `window.postMessage` 交换工程。

- 从 Python 加数据 = 改写同步中的工程并推给应用；
- UI 里的编辑 = 以同一路径回流。

### 19.19.2 这个设计的四个后果

| 后果 | 解释 |
|------|------|
| **需要连到那个 localhost 端口** | 所以 Colab/JupyterHub 要走端口代理；marimo 干脆用托管 URL |
| **数据在两侧都可能存在** | 内联进工程的数据随工程走；只留引用的数据（本地文件路径、会话级栅格 URL）只在出图那台机器有效 |
| **版本必须匹配** | 组件的 JS 与 Python 来自同一个 wheel，混用不同版本的 app URL 会出现协议不匹配 |
| **同步是"整份工程"** | 不是增量补丁；大工程在每次改动时都要序列化一次，这也是"别把上百 MB 内联进工程"的实际理由 |

> **提示**：要"可分享、可重开"的成果，内联小矢量、托管大栅格（COG/PMTiles/GeoParquet），这与 [第05章 数据添加与格式支持](https://znlgis.github.io/gis/tutorial/GeoLibre/第05章-数据添加与格式支持/) 里的建议一致。

---

## 19.20 常见问题

| 症状 | 原因 | 处理 |
|------|------|------|
| marimo 里 iframe 显示 `127.0.0.1 refused to connect` | marimo 的浏览器够不到随机回环端口 | `m._app_url = "https://web.geolibre.app/"`（见 19.15.1） |
| `add_geojson` 返回 `None`，图层却出现了 | 没窗口连接，或 5 秒内没应答 | 看是否收到 `GeoLibreNotConnectedWarning` / `GeoLibreTimeoutWarning`；用 `list_layers()` 找图层 |
| `list_layers()` 抛 `GeoLibreTimeoutError` | 大 FeatureCollection 来不及应答 | 加大超时或减小内联数据量；桌面版才有同步读回 |
| notebook 里改了地图，地图没反应 | 用 JupyterLite（网页版）时只有 postMessage 路径，且必须已显示 `m` | 先在一个单元格输出 `m`，再在后续单元格操作 |
| 外部客户端连上了但命令无效 | 中继未启动 | 先在应用里打开一次 Processing → Jupyter Notebook |
| Notebook 面板显示的是**另一个 GeoLibre** | JupyterLite 站点未构建，SPA 回退返回了 index.html | 装 `apps/geolibre-desktop/jupyterlite/requirements.txt` 后 `npm run build:jupyterlite` |
| 桌面版 Notebook 面板起不来 | `notebook` extra 缺失或端口占用 | 装后端 `[notebook]` extra；检查 8766 端口 |
| 本地栅格重开工程后不见了 | 服务 URL 是会话级 | 换托管 URL（COG） |
| 图片弹窗高度调了却没变大 | 缩略图保持长宽比 | 同时调大 `popup_max_width` |
| 悬停提示出现后点击弹窗只剩一个字段 | 字段表被 hover 标记收窄 | 用 `popup=[...]` 显式列出点击字段 |
| JupyterHub 上组件空白 | 双路由都不通 | 装 `jupyter-server-proxy`，或启用 `geolibre` 服务器扩展并重启 |
| 保存的工程里凭据丢了 | `save_project` 默认脱敏 | 私密本地文件用 `keep_credentials=True` |

---

## 19.21 本章小结

- **三个方向别混**：Console 在应用里跑 Pyodide；Notebook 面板是"应用里的 notebook"（网页版 JupyterLite、桌面版真 JupyterLab）；`geolibre` 包是"notebook 里的应用"。
- **API 是同一套**：`geolibre.` 的方法与 `Map` 的方法同名同义，控制台代码搬到 notebook 通常只需改前缀。
- **控制台的三条限制**：主线程、沙箱、`to_image()` 返回字节；长任务走 `await run_algorithm(...)`。
- **Notebook 面板的关键差异是后端**：JupyterLite 无服务器、包要按需装；桌面版有完整 CPython 与中继，因此才有同步读回与外部客户端。
- **中继才是"外部客户端能驱动地图"的原因**：`jupyter_relay` 把 `GEOLIBRE_RELAY_URL`/`TOKEN` 注入内核环境，`geolibre.is_connected()` 可自检。
- **返回值语义要背下来**：变更即发即忘；`add_geojson` 在两种情况下返回 `None` 且不重发；读回调用直接抛异常。
- **凭据默认脱敏**，`project` trait 例外（为了实时渲染），落盘要保留凭据才用 `keep_credentials=True`。
- **弹窗有两套尺寸与一条字段表规则**：圆与精灵不能混用；标记 hover 字段会收窄点击弹窗。
- **远程环境的正确姿势**：Colab 自动代理、JupyterHub 双路由、其它远程 `server_proxy=True`、marimo 用托管 URL。

---

## 19.22 实践练习

**练习 1（控制台）**
在 Python Console 里：读取当前中心与范围、飞到一个城市、用 `identify` 查询某点要素，并把结果打印成"图层名 + 属性键"。再用 `await geolibre.load_package("geopandas")` 装包，把 `get_features()` 的结果转成 GeoDataFrame 并报告行数。

**练习 2（脚本编辑器）**
写一个 20 行的 `.py` 脚本：加 OSM 底图、加一个远程 GeoJSON、按某个数值字段做分级设色、缩放到图层、导出 PNG 字节并说明为什么不落盘。保存、全跑与"只跑选中行"各试一次。

**练习 3（Notebook 面板）**
分别用网页版与桌面版打开 Notebook 面板，执行同一段 `import geolibre; m = geolibre.connect()` 代码。记录两者在 `add_geojson` 返回值、`list_layers()` 是否可用、能否用 VS Code 连上服务器这三点的差异，并解释原因。

**练习 4（工程往返）**
用 `Map` 建一个含三个图层（一个内联 GeoJSON、一个托管 COG、一个 XYZ 底图）的工程，`save_project` 后 `load_project` 到新组件。检查哪些图层恢复、哪些丢失，并说明"内联 vs 引用"的区别。

**练习 5（弹窗与图标）**
同一组点做两个图层：一个用 `radius` 画圆、一个用 `shape="pin"` 画精灵。给两个图层都配 `popup`（含 image 与 link 字段）与 `tooltip`。故意混用一次圆与精灵参数，记录报错信息；再验证"只给 tooltip 会收窄点击弹窗"这条规则。

**练习 6（R 与 Shiny）**
用 R 包做一个含 `sf` 图层的地图，`save_project` 后在 GeoLibre 网页版打开。再写一个最小 Shiny 应用，用 `geolibre_proxy` 在按钮点击时改视图，并读出 `input$<outputId>_project` 里的中心坐标。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/第18章-AI助手MCP与智能体技能/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/GeoLibre/第20章-制图输出故事地图与分享嵌入/" class="chapter-nav__next">下一章 →</a>
</div>
