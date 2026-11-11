---
layout: default
title: 第12章 - Python 绑定与批处理开发
---

# 第12章 - Python 绑定与批处理开发

命令行跑通一段 pipeline 之后，下一步几乎总是"把它变成能处理一万个文件的程序"。这时有三条路：shell 循环调用 `pdal translate`、用 Python 调 `subprocess`、或者直接用 PDAL 的 Python 绑定。第一条最简单，但文件数量一上来就会暴露三个问题：每个进程都要重新加载 GEOS/PROJ/GDAL 和驱动表，进程启动固定开销吃掉大半时间；错误只能从退出码和 stderr 里猜；中间结果落盘，磁盘 I/O 成为瓶颈。

Python 绑定（PyPI 包名 `PDAL`，import 名 `pdal`）解决的就是这些问题：pipeline 直接跑在进程内，结果以 NumPy 数组返回，不用落盘就能继续用 pandas/scipy 加工。它和 PDAL 内嵌的 `filters.python` 不是一回事：前者在 Python 里调 PDAL，后者在 PDAL pipeline 里调 Python 函数。本章把两者都讲清楚，并给出批处理程序的工程化结构。

## 12.1 版本与安装

### 12.1.1 绑定与 PDAL 的版本关系

Python 绑定是独立仓库（GitHub `PDAL/python`），与 PDAL 主库分开发布。它的 README 明确写出依赖下限：**PDAL 2.7+、Python ≥ 3.9、pybind11 ≥ 2.12、NumPy ≥ 1.24（隔离构建要求 ≥ 2.0）、scikit-build-core ≥ 1.0**。

这意味着两件事：绑定不是"PDAL 装好就自动有"；绑定的版本号与 PDAL 版本号也不对应（历史上 `PDAL/python 2.3` 对应 PDAL 2.1 前后）。判断兼容性的可靠方法不是比版本号，而是直接 import 后打印：

```bash
python -c "import pdal; print(pdal.__file__); print(pdal.__doc__)"
```

### 12.1.2 三种安装方式

| 方式 | 命令 | 适用场景 |
|---|---|---|
| conda（推荐） | `conda create -n pdal -c conda-forge python-pdal` | 会把 PDAL 主库一并装好，ABI 由 conda 保证 |
| pip | `pip install PDAL` | 已有匹配的 PDAL 动态库和头文件环境（如 OSGeo4W、自编译安装） |
| 源码 | `git clone https://github.com/PDAL/python && pip install .` | 需要绑定与自编译 PDAL 严格同版本 |

pip 路线最常见的失败是 import 时报找不到动态库：

```text
ImportError: libpdal_base.so.17: cannot open shared object file: No such file or directory
```

原因是 PDAL 的动态库不在 loader 搜索路径里。Linux 下把 PDAL 的 lib 目录写进 `/etc/ld.so.conf.d/` 后 `ldconfig`；Windows 下把 `pdal.dll` 所在目录加进 `PATH`；conda 安装不会有这个问题，因为库和扩展在同一个环境内。

### 12.1.3 先验证再写业务

一个 30 秒的连通性自检，能同时确认绑定、PDAL 主库、驱动表都正常：

```python
import pdal

# 用 faux reader 造 100 个点，不依赖任何数据文件
pipeline = pdal.Pipeline("""
[
  {"type": "readers.faux", "bounds": "([0,10],[0,10],[0,10])", "count": 100},
  {"type": "filters.stats"}
]
""")
count = pipeline.execute()
print("points:", count)                 # 100
print("arrays:", len(pipeline.arrays))  # 1
print("dims:", pipeline.arrays[0].dtype.names[:6])
```

## 12.2 Pipeline 的四种构造方式

### 12.2.1 JSON 字符串

最直接的方式，和命令行 `--pipeline` 内容完全一致：

```python
import pdal

json_str = """
[
  "input.las",
  {"type": "filters.sort", "dimension": "X"}
]
"""
pipeline = pdal.Pipeline(json_str)
count = pipeline.execute()
arrays = pipeline.arrays
metadata = pipeline.metadata
log = pipeline.log
```

`pdal.Pipeline` 的构造参数里还有两个值得用的选项：`loglevel`（接受 `logging.DEBUG` 之类的整数）和 `timing=True`（把每阶段的耗时写进 `pipeline.log`）。

```python
import logging, pdal

p = pdal.Pipeline(json_str, loglevel=logging.DEBUG, timing=True)
p.execute()
print(p.log[:800])   # 含 "Stage filters.sort took ..." 之类的时间行
```

### 12.2.2 Stage 对象与管道运算符

绑定为每个 driver 自动生成了静态方法：`pdal.Reader.las`、`pdal.Filter.smrf`、`pdal.Writer.copc` 等等，方法签名来自 PDAL 的 options 反射，写错参数名会立刻报错而不是静默忽略：

```python
import pdal

pipeline = (
    pdal.Reader.las(filename="input.laz")
    | pdal.Filter.smrf()
    | pdal.Filter.range(limits="Classification[2:2]")
    | pdal.Writer.las(filename="ground.laz")
)
print(pipeline.execute())
```

规则（来自官方 README）：`Reader`/`Writer` 的 `filename` 和 `Filter` 的 `type` 可以作为第一个位置参数传入；每个 stage 都支持 `tag` 与 `inputs`（输入可以是别的 stage，也可以是它的 tag 字符串）。

管道运算符 `|` **每次都会创建一个新的 Pipeline 对象**，要就地更新用 `|=`：

```python
p = pdal.Pipeline()
p |= pdal.Reader("input.las")
p |= pdal.Filter.head(count=100)
print(p.execute())   # 100
```

### 12.2.3 单 stage 起步、按数组输入

`Stage.pipeline()` 把一个 stage 变成 pipeline；给 pipeline 传 `arrays` 参数时，PDAL 会把 NumPy 数组当作数据源：

```python
import numpy as np, pdal

arr = np.zeros(500, dtype=[("X", "f8"), ("Y", "f8"), ("Z", "f8")])
arr["X"] = np.linspace(0, 100, 500)
arr["Y"] = np.linspace(0, 100, 500)
arr["Z"] = np.sin(np.linspace(0, 10, 500)) * 5

p = pdal.Filter.range(limits="Z[0:5]").pipeline(arr)
print(p.execute())         # 只保留 Z 在 [0,5] 的点数
print(p.arrays[0].dtype.names)
```

这个模式的价值在于：可以用 pandas/numpy 做完预处理，再交回 PDAL 做格式转换（例如写 COPC），不必先生成一个中间 LAS。

### 12.2.4 带缓冲回调的流式输入

数组源还支持"边读边灌"：把数组和填充函数一起传给 `Pipeline(arrays=[...], stream_handlers=[...])`。回调在 PDAL 需要数据时被调用，返回本次有效行数，返回 0 表示结束。这让你能把数据分块读进来而不必一次性驻留内存——官方 README 用它实现了"超大 LAZ 分块转写，内存只占一个 chunk"。

## 12.3 execute 系列与内存策略

### 12.3.1 三个入口的语义

| 方法 | 返回 | 是否保留结果 | 内存特征 |
|---|---|---|---|
| `execute()` | 点数（int） | 是，结果在 `arrays`/`meshes` 里 | 全量驻留 |
| `execute_streaming(chunk_size)` | 点数 | 否 | 只占一个 chunk 的缓冲 |
| `iterator(chunk_size, prefetch)` | 迭代器，逐块产出 ndarray | 由调用者决定 | 块级驻留 + `prefetch` 个缓冲 |

`iterator` 的 `chunk_size` 默认 **10000** 点，和 C++ 侧 `PipelineManager` 的默认 `streamLimit` 一致；`prefetch` 默认 0，表示不并行预取。只有**全链路 streamable** 的 pipeline 才能用后两个入口，否则会拿到一个非流式 stage 的报错。

```python
import pdal

pipeline = (
    pdal.Reader.las(filename="big.laz")
    | pdal.Filter.expression(expression="Intensity > 80")
)
for arr in pipeline.iterator(chunk_size=50000, prefetch=2):
    process(arr)      # 每次最多 50000 点，块大小通常小于该值
```

`execute_streaming(chunk_size)` 与 `sum(len(a) for a in iterator(chunk_size))` 结果等价，但**不分配 ndarray**，适合"只写不读"的场景（pipeline 末尾是 writer）：

```python
p = pdal.Reader("big.laz") | pdal.Filter.smrf() | pdal.Writer.las(filename="out.laz")
print(p.execute_streaming(100000))   # 返回写入点数
```

### 12.3.2 arrays 的形状约定

`pipeline.arrays` 返回 `list`，长度等于输出 PointView 的个数。多数 pipeline 输出 1 个 view；用了 `filters.splitter`、`filters.chipper`、`filters.divider` 时会有多个。数组是结构化 NumPy 数组，字段名就是 PDAL 维度名，类型由维度类型决定：

```python
arr = pipeline.arrays[0]
print(arr.dtype)
# [('X', '<f8'), ('Y', '<f8'), ('Z', '<f8'), ('Intensity', '<u2'),
#  ('ReturnNumber', 'u1'), ..., ('Red', '<u2'), ('Green', '<u2'), ('Blue', '<u2')]
print(arr["Z"].mean())
```

要点：大文件用 `execute()` 时，内存约等于 `点数 × 每点字节数 × 2`（PDAL 内部 view + NumPy 拷贝），1000 万点、16 维 double 的文件就能吃掉 2 GB 以上。这类数据应该走 `iterator` 或 `execute_streaming`。

### 12.3.3 meshes 与 get_meshio

`filters.delaunay`/`filters.greedyprojection` 会产生 TIN 网格。`pipeline.meshes` 返回 `(1, n)` 的三角形索引数组；装了 `meshio` 后可以用 `pipeline.get_meshio(0)` 直接得到可写 OBJ/PLY 的网格对象：

```python
import pdal

p = pdal.Reader("ground.laz") | pdal.Filter.delaunay()
p.execute()
print(p.meshes[0].shape)       # (1, n_triangles)
mesh = p.get_meshio(0)         # 未安装 meshio 时抛 RuntimeError
mesh.write("tin.obj")
```

## 12.4 在 PDAL 里嵌 Python：filters.python

### 12.4.1 函数契约

`filters.python` 调用你写的函数，签名固定为 `(ins, outs)`：两个结构化 NumPy 数组，`ins` 是过滤前所有点、所有维度，`outs` 与 `ins` 同形同类型，你往里写值。函数必须 `return True`；返回 `False` 会让 pipeline 报错退出。

```python
# multiply_z.py
import numpy as np

def multiply_z(ins, outs):
    outs["Z"] = ins["Z"] * 10.0
    return True
```

```json
[
  "input.las",
  {
    "type": "filters.python",
    "script": "multiply_z.py",
    "function": "multiply_z",
    "module": "anything"
  },
  "output.las"
]
```

`module` 只是给内嵌解释器一个模块名，可以随便写；`script` 是相对 pipeline 文件或工作目录的路径。

### 12.4.2 删点、加维度、改元数据

**删点**靠 `Mask` 维度：给 `outs["Mask"]` 写布尔值/0-1 数组，`False` 的点被丢弃。

```python
def keep_ground_and_buildings(ins, outs):
    cls = ins["Classification"]
    outs["Mask"] = (cls == 2) | (cls == 6)
    return True
```

**加维度**要在 pipeline 里声明，否则函数里写了也会被忽略：

```json
{
  "type": "filters.python",
  "script": "feat.py",
  "function": "feat",
  "module": "m",
  "add_dimension": ["Roughness=float", "IsGround=uint8"]
}
```

**读全局信息**：内嵌解释器注入了三个全局变量——`schema`（维度定义）、`spatialreference`（SRS 对象）、`metadata`（只读元数据）。要设置本 stage 的元数据，写全局变量 `out_metadata`（注意：旧版本里叫 `metadata`，这是官方文档明确标注的变更）：

```python
def annotate(ins, outs):
    global out_metadata
    out_metadata = {"name": "qc", "value": "ok", "type": "string",
                    "children": [{"name": "n", "value": len(ins), "type": "integer"}]}
    return True
```

### 12.4.3 什么时候不该用它

`filters.python` 是**逐块**调用的（默认 chunk 大小 10000 点），所以：函数里不能依赖"看到全部点"，跨块统计必须在前面挂一个非流式 stage；它的性能比等价 C++/JSON 表达式差一到两个数量级。官方文档在 predicates 一节直接建议：能用 `filters.expression` 就用 `filters.expression`。

适合它的场景是原型验证：把 `filters.expression` 写不出来的逻辑（比如查表、调用外部模型）先用 Python 试通，验证后再决定是否写成 C++ stage（第 13 章）。

## 12.5 批处理程序的工程化结构

单文件处理脚本和批处理程序的差距，主要不在 PDAL 调用，而在四个工程约束：错误隔离、幂等、并发度、内存上限。

### 12.5.1 一个可用的批处理骨架

```python
# batch.py
import os, sys, logging
from concurrent.futures import ProcessPoolExecutor, as_completed
import pdal

log = logging.getLogger("pdal-batch")

PIPELINE_TMPL = [
    {"type": "readers.las", "filename": None, "nosrs": False},
    {"type": "filters.smrf"},
    {"type": "filters.range", "limits": "Classification[2:2]"},
    {"type": "writers.copc", "filename": None}
]

def ground(inp, out):
    pipeline = pdal.Pipeline(json.dumps(_fill(PIPELINE_TMPL, inp, out)))
    return pipeline.execute_streaming(chunk_size=200000)

def _fill(tmpl, inp, out):
    import copy, json
    t = copy.deepcopy(tmpl)
    t[0]["filename"] = inp
    t[-1]["filename"] = out
    return t

def process(inp, outdir):
    out = os.path.join(outdir, os.path.splitext(os.path.basename(inp))[0] + ".copc.laz")
    if os.path.exists(out):
        return inp, "skip", 0          # 幂等：已产出就跳过
    try:
        n = ground(inp, out)
        return inp, "ok", n
    except Exception as e:             # 单文件失败不影响整批
        return inp, "fail: %s" % str(e)[:200], 0

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    files = [os.path.join(src, f) for f in os.listdir(src) if f.lower().endswith((".las", ".laz"))]
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as ex:
        futs = [ex.submit(process, f, dst) for f in files]
        for fut in as_completed(futs):
            name, status, n = fut.result()
            log.info("%s %s %s", name, status, n)
```

这个骨架里每个选择都有理由：

- **`ProcessPoolExecutor` 而不是线程池**：pipeline 执行是 CPU 密集的，Python 层没有释放 GIL 的保证；进程池还能顺带隔离崩溃。
- **`execute_streaming` 而不是 `execute`**：批处理只关心写出结果，不需要把点留在内存里。
- **先检查输出存在再执行**：中断后重跑是常态，幂等比重试逻辑便宜。
- **异常收敛到返回值**：进程池里抛出的异常在 `fut.result()` 才暴露，提前包好并截断消息，避免一个坏文件让整批日志不可读。

### 12.5.2 并发度怎么定

判断依据是内存而不是核数。单个 `execute_streaming` 任务常驻内存 ≈ `chunk_size × 单点字节数 × 活跃 stage 数`。20 万点、每点 60 字节、5 个 stage 时约 60 MB；但 `filters.smrf` 这类非流式过滤会把整块 view 读进内存，峰值可能是它的几十倍。经验起点：`max_workers = min(cpu_count, 可用内存GB × 1024 / 单任务峰值MB)`，然后压测再调。

### 12.5.3 日志与可观测性

`pipeline.log` 是字符串，内容受 `loglevel` 控制。批处理里更实用的是 `timing=True` 加上每文件耗时统计，而不是把整个日志存下来：

```python
import time, pdal
t0 = time.perf_counter()
p = pdal.Pipeline(json_str, timing=True)
n = p.execute_streaming(100000)
dt = time.perf_counter() - t0
print(f"{n} points in {dt:.2f}s, {n/dt/1e6:.2f} Mpts/s")
```

## 12.6 排错清单

| 现象 | 原因 | 修法 |
|---|---|---|
| `ModuleNotFoundError: No module named 'pdal'` | 装的是错的包（`pdal` 只提供 Python 扩展），或没装进当前环境 | `pip show PDAL` 确认；用目标解释器 `python -m pip install PDAL` |
| `ImportError: libpdal_base.so.xx` | PDAL 动态库不在 loader 路径 | Linux `ldconfig`，Windows 加 `PATH`，或改用 conda |
| `RuntimeError: Couldn't create ...` 且提示 stage 不存在 | 绑定与 PDAL 主库版本不匹配，driver 表不同 | 绑定与主库同版本重装 |
| pipeline 明明有输出，`arrays` 却为空 | 用了 `execute_streaming` | streaming 模式不保留数组，改用 `execute` 或 `iterator` |
| `'Stage ... is not streamable'` | chain 里有非流式 stage（如 `filters.smrf`、`filters.hexbin`） | 去掉 `execute_streaming`，或把该 stage 换成流式等价物 |
| `filters.python` 报 `KeyError: 'Mask'` | `Mask` 不是默认维度 | 在 `add_dimension` 里声明，或在函数里显式 `outs["Mask"]` 赋值前确认维度存在 |
| 函数返回 `False` 后 pipeline 退出 | 契约要求返回 `True` | 用 `Mask` 表达"删点"，不要用返回值 |
| 批处理内存爆掉 | `execute` + 大文件 + 高并发 | 换 `execute_streaming`，限制 `max_workers`，调小 `chunk_size` |

## 12.7 生产建议

**用 conda 或锁定的 wheel 交付。** 绑定与 PDAL 主库是二进制 ABI 契约，升级其中一个而不升级另一个是最隐蔽的故障源。容器镜像里把 PDAL、python-pdal、GDAL、PROJ 的版本一起冻结。

**批处理只保留接口，不保留数据。** pipeline 里尽量让最后一个 stage 是 writer，前面全用流式过滤器，配合 `execute_streaming`，单机内存占用与文件大小无关。需要交叉统计（如按 tile 计算密度）时，把统计放进单独的 `filters.stats` 并在执行后读 `metadata`，不要为此把点全读进 Python。

**`filters.python` 只做原型。** 它逐块执行、有 Python 解释器开销，稳定后应改写为 `filters.expression`（简单条件）或 C++ stage（复杂逻辑）。第 13 章给出后者的完整写法。

**失败要能定位到文件。** `ProcessPoolExecutor` 里把文件名随异常一起返回，日志里同时打输入路径、输出路径、耗时、点数四元组，出问题能直接重跑单个文件。

## 12.8 本章小结

| 主题 | 结论 |
|---|---|
| 安装 | conda-forge `python-pdal` 最省事；pip 需自备匹配的 PDAL 库 |
| 版本下限 | PDAL 2.7+ / Python 3.9+ / NumPy 1.24+ / pybind11 2.12+ |
| 构造 pipeline | JSON 字符串、Stage 对象 `|` 组合、`Stage.pipeline()`、带 `arrays` 的缓冲模式 |
| 三个执行入口 | `execute()` 全量驻留；`execute_streaming()` 不保留结果；`iterator()` 块级产出（默认 10000 点） |
| 数组源 | `Pipeline(arrays=[...])`；配合 `stream_handlers` 可实现低内存输入 |
| 内嵌 Python | `filters.python` 的 `ins/outs` 契约、`Mask` 删点、`add_dimension` 加维度、返回必须 `True` |
| 批处理 | 进程池 + `execute_streaming` + 输出存在性检查 + 异常收敛 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第11章-坐标参考系统与高程基准/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第13章-C++开发与自定义Stage/" class="chapter-nav__next">下一章 →</a>
</div>
