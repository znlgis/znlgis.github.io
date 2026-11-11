---
layout: default
title: 第05章 - Pipeline JSON 与 Stage 模型
---

# 第05章 - Pipeline JSON 与 Stage 模型

## 5.1 pipeline 到底是什么

把它当成一份**执行计划**而不是配置文件。`pdal pipeline` 拿到 JSON 后做的事，和 C++ 里手写 stage 链完全相同：解析出 stage 对象、按 `inputs` 连边、确定叶子节点、按模式执行。

理解这一点，很多“为什么这样写不行”的疑问就自动消解了：JSON 只是把 `StageFactory` 的构造过程数据化了，它的规则来自 `PipelineReaderJSON::parsePipeline()`，不是来自某个 schema。

一条 pipeline 的最小语义只有三条：

1. stage 按数组顺序创建；
2. 维护一个**默认输入列表**（default inputs），每创建一个 stage 就把它替换进去；
3. 没有显式 `inputs` 的 stage 吃这个默认列表。

## 5.2 两种顶层形态

```json
[
    "input.las",
    { "type": "filters.crop", "bounds": "([0,100],[0,100])" },
    "output.laz"
]
```

和

```json
{
    "pipeline": [
        "input.las",
        { "type": "filters.crop", "bounds": "([0,100],[0,100])" },
        "output.laz"
    ]
}
```

完全等价。第二种是 PDAL 1.9 之前的写法，为向后兼容一直保留；新写的 pipeline 一律用裸数组。解析器在 `readPipeline` 里判断根节点类型，不是数组就报 `Pipeline: root element is not a pipeline.`。

## 5.3 字符串元素的推断规则

数组里的字符串不是“文件名”，而是“待推断的 stage”。推断逻辑在 `parsePipeline()` 里只有几行，但决定了大量实际行为：

```text
type 为空 且 (i == 0 或 i != last)   → 按 reader 处理，filename = 该字符串
type 为空 且 i == last               → 按 writer 处理
type 以 "readers." 开头              → reader
type 以 "writers." 开头              → writer
其余                                 → filter
```

由此得到几条实用结论：

- **第一个字符串一定是 reader**，最后一个字符串一定是 writer；
- 中间位置放字符串会被当成 reader（这通常不是你想要的，应显式写 `{"type": ...}`）；
- 只有一个元素的 pipeline 会被当成 reader，没有 writer 就不会产生输出文件；
- 显式写 `type` 时，扩展名推断让位于显式声明。

### 5.3.1 字符串会做 glob 展开

reader 分支里有这么一段：

```cpp
StringList files = Utils::glob(spec.u8string());
if (files.empty())
    files.push_back(spec.u8string());
for (const std::string& path : files) {
    ...
    s = &manager.makeReader(ops);
    inputs.push_back(s);
}
```

也就是说，一个含通配符的字符串会展开成**多个 reader**，全部塞进默认输入列表：

```json
[
    "/data/2024/*.laz",
    "merged.laz"
]
```

这行 pipeline 等价于把这批 LAZ 全部读进来再合并写出，不用显式写 `filters.merge`——下游 writer 拿到了多个输入。

glob 只在 pipeline **文件**里生效。文档明确写了：通过命令行给 `pdal pipeline`/`pdal translate` 传文件名时不做通配展开。想要通配就得写进 JSON，或者让 shell 展开后传多个参数。

## 5.4 Stage 对象：四个保留键

一个 stage 对象的键分两类：**保留键**由解析器消费，其余全部当作 stage 选项。

| 保留键 | 类型 | 说明 |
|--------|------|------|
| `type` | string | stage 全名，如 `filters.smrf`；filter 必填 |
| `filename` | string | 文件路径，可写 URL；reader/writer 用 |
| `tag` | string | 本 stage 的别名，供 `inputs` 引用，全局唯一 |
| `inputs` | string 或 string[] | 上游 stage 的 tag 列表 |
| `plugin` | string | 加载指定插件（不传给 stage 本身） |
| `option_file` | string | 从外部文件读取选项 |
| `user_data` | any | 原样带到序列化输出里，不参与处理 |

其余键按 JSON 类型转成 PDAL 的 `Option`：

```text
string  → 字符串
number  → int64 / uint64 / double（按实际类型）
bool    → bool
array   → 逐个元素加入同名选项（多值选项就靠这个）
object  → 整个对象当值传入
null    → 空字符串
```

最后两条容易踩坑。`null` 被当成空字符串，所以 `"where": null` 不会清空默认值，只会传一个空串进去；object 类型的值会在 stage 内部被字符串化后重新解析，这也是 `bounds` 支持 GeoJSON BBOX 与 JSON 对象两种写法的原因。

### 5.4.1 tag 的命名规则是强制的

tag 不对会直接抛异常，报错信息写得很明确：

| 错误信息 | 触发条件 |
|---------|---------|
| `JSON pipeline: tag must be specified as a string.` | `tag` 不是字符串 |
| `JSON pipeline: duplicate tag 'x'.` | 同一 tag 用了两次 |
| `JSON pipeline: Invalid tag name 'x'. Must start with letter. Remainder can be letters, digits or underscores.` | 命名不合规 |
| `JSON pipeline: Invalid pipeline: undefined stage tag 'x'.` | `inputs` 引用了不存在的 tag |
| `JSON pipeline: 'inputs' tag must be specified as a string or array of strings.` | `inputs` 类型错 |
| `JSON pipeline: Inputs not permitted for reader: 'path'.` | 给 reader 写了 `inputs` |

规则：**必须以字母开头**，后续只能是字母、数字、下划线。`las-1` 这种带连字符的写法会被拒。这条限制来自 `Stage::parseTagName()`，不是解析器随手加的。

## 5.5 inputs 与多分支

默认输入列表的语义要一次性记牢，否则会得到“数据凭空丢失”的结果：

- 当前 stage 是 **reader**：忽略 `inputs`（写了就报错），并被追加进默认列表；
- 当前 stage 是 **filter/writer 且没写 `inputs`**：消费默认列表里的全部 stage；
- 当前 stage 是 **filter/writer 且写了 `inputs`**：只用指定的那些 tag，默认列表被替换成当前 stage。

“替换”两个字是关键。下面这条 pipeline 是本教程反复引用的范例：两个 reader 分别重投影后再合并。

```json
[
    {
        "filename": "A.las",
        "type": "readers.las",
        "spatialreference": "EPSG:26916"
    },
    {
        "type": "filters.reprojection",
        "in_srs": "EPSG:26916",
        "out_srs": "EPSG:4326",
        "tag": "A2"
    },
    {
        "filename": "B.las",
        "type": "readers.las",
        "tag": "B"
    },
    {
        "type": "filters.merge",
        "tag": "merged",
        "inputs": ["A2", "B"]
    },
    {
        "type": "writers.gdal",
        "filename": "output.tif"
    }
]
```

执行顺序与数据流：

```text
reader A ──▶ reprojection(tag=A2) ──┐
                                    ├─▶ merge(inputs=[A2, B]) ──▶ writers.gdal
reader B (tag=B) ───────────────────┘
```

几个细节值得注意：

- reader `B` 声明在 `A2` 之后，但**没有任何连接被自动建立**——B 只是被追加到默认输入列表里；
- `merge` 明确指定 `inputs`，因此只取 `A2` 与 `B`，默认列表里可能残留的其他 stage 全被忽略；
- 如果省略 `merge` 的 `inputs`，它会吞掉默认列表里的全部内容（当前就是 A2 和 B），结果相同。但一旦 pipeline 更复杂，显式 `inputs` 才能保证你连的是想要的那条链。

### 5.5.1 多叶子节点只是警告，不是错误

如果 pipeline 长出了多个末端（没有人消费的 stage），解析器不会失败，只会在日志里报：

```text
Pipeline has multiple leaf nodes.
Only the first of the following leaf nodes will be run.
    <tag 或 stage 名>
    ...
```

这条消息常常被忽略，因为它是 `LogLevel::Error` 级别但**不中断执行**。后果是：你以为两个分支都跑了，实际只跑了第一个叶子所依赖的那条链。文档也专门说明了这一点——pipeline 可以有多个 writer，但必须顺序串联（`Reader → Filter → Writer → Filter → Writer`），不能分叉成多个终点。

```text
允许：Reader → Filter → Writer → Writer
允许：Reader → Filter → Writer → Filter → Writer
不允许：
                ┌─▶ Writer
Reader → Filter ─┤
                └─▶ Writer
```

需要多份输出时，正确做法是写多条 pipeline，或者在同一条里串接多个 writer（前一个 writer 的输出作为后一个的输入）。

## 5.6 PointView 与 # 占位符

前文说过，一个 stage 可以输出多个 PointView。写侧要接住它们，靠文件名里的 `#`：

```json
[
    "input.las",
    {
        "type": "filters.splitter",
        "length": 1000
    },
    "tile_#.las"
]
```

`filters.splitter` 每个瓦片产出一个 view，writer 为每个 view 写一个文件，`#` 被替换成递增整数。`writers.las` 与 `writers.bpf` 是明确支持这个机制的。

反过来，如果文件名**不含** `#`，所有 view 会被合并成一份输出。这个默认行为很合理，但也会掩盖“本来想分开写”的意图：跑完只看到一个文件，数据却没丢——全在里面。

能用 `#` 的前提是上游真的产出了多个 view。产出多 view 的典型 stage：

| stage | 怎么产生多 view |
|-------|----------------|
| `filters.splitter` | 按瓦片边长切 |
| `filters.chipper` | 按容量切（默认 5000 点/chip） |
| `filters.divider` | `partition`/`round_robin`/`expression` 三种模式 |
| `filters.crop` | 给多个 bounds/polygon 就一个区域一个 view |
| `readers.*` | 多个 reader 并行时天然多输入 |

## 5.7 where 与 where_merge：只处理一部分点

每个 filter 和 writer 都支持 `where`（来自 `doc/stages/filter_opts.md`）：一个表达式，只有满足条件的点才进入这个 stage，其余点**跳过但保留**，继续给下游。

```json
[
    "input.laz",
    {
        "type": "filters.assign",
        "where": "Classification == 1",
        "value": "Classification = 0"
    },
    "output.laz"
]
```

`where_merge` 决定被跳过的点怎么归并：

| 取值 | 行为 |
|------|------|
| `true` | 合并进该 filter 返回的第一个 view；没有返回 view 时单独成 view |
| `false` | 单独成一个 view |
| `auto`（默认） | 只有一个返回 view 且点数未变时合并，否则单独成 view |

`auto` 的判定条件值得记住：**返回单一 view 且点数与执行前一致**。很多 filter 会改变点数（过滤类）或产出多个 view（切分类），此时被跳过的点会独立成 view，于是下游写出时可能出现意料之外的多份输出。

## 5.8 option_file：把选项挪出去

所有 stage 都支持 `option_file`，把选项放到独立文件里。两种语法都行——JSON 块或命令行风格：

```json
{
    "minor_version": 4,
    "out_srs": "EPSG_4326"
}
```

```text
--minor_version=4 --out_srs="EPSG_4326"
```

典型用法是**同一套参数复用**：把常用的 writer 参数抽成 `las-out.opts`，多个 pipeline 引用它。

```json
[
    "input.las",
    {
        "type": "writers.las",
        "filename": "output.las",
        "option_file": "conf/las-out.opts"
    }
]
```

注意 `option_file` 里的选项与 stage 内联选项冲突时，**内联的优先**（选项后加入者覆盖先加入者）。所以把“默认值”放文件里、“这一条的特殊值”写在 JSON 里，是最稳妥的组织方式。

## 5.9 序列化与元数据：让 pipeline 自证

pipeline 最有价值的副产品是**可复现性**。三个入口：

| 命令 | 产物 |
|------|------|
| `pdal translate ... --pipeline out.json` | 命令行构造出的等价 pipeline（不执行） |
| `pdal pipeline in.json --pipeline-serialization out.json` | 实际执行过的完整 pipeline |
| `pdal pipeline in.json --metadata meta.json` | 执行元数据（每个 stage 的统计与耗时） |

`--pipeline-serialization` 与 `--pipeline` 的区别值得强调：后者是“按我的命令行参数应该长这样”，前者是“实际跑的是这样”，包含 parser 补全的内容。生产环境归档用后者。

writer 侧还有两个把 pipeline 写进数据的选项：

- `writers.las.pdal_metadata`：写两个 VLR，分别存 metadata 与 pipeline 序列化；
- `writers.copc.pipeline`：把运行中的 pipeline 以 VLR 写进 COPC。

这两个开关的价值在交付场景：数据文件自己带着处理历史，接收方不需要你的文档也能知道它经历过什么。

## 5.10 排错表

| 报错 / 现象 | 原因 | 处理 |
|------------|------|------|
| `Pipeline: root element is not a pipeline.` | 根节点是对象但没 `pipeline` 键 | 用裸数组或补上 `pipeline` 键 |
| `JSON pipeline: duplicate tag 'x'.` | tag 重复 | 改唯一名 |
| `JSON pipeline: Invalid tag name 'las-1'.` | 含连字符 | 改成 `las1` 或 `las_1` |
| `JSON pipeline: undefined stage tag 'x'.` | `inputs` 引用了未定义或后置的 tag | tag 必须先定义后引用 |
| `JSON pipeline: Inputs not permitted for reader` | 给 reader 写了 `inputs` | 删掉；reader 只能被追加 |
| `Pipeline has multiple leaf nodes.` | 分叉出多个末端 | 串联 writer，或拆成多条 pipeline |
| 输出少了数据 | 某个 filter 用了 `inputs` 导致默认列表被替换 | 检查每个 filter 的 `inputs` |
| 输出只有第一个分支 | 多叶子只跑第一个 | 同上 |
| `--where` 没生效 | 表达式写成赋值形式 | `where` 只接受布尔表达式 |
| 相对路径找不到 | 基准目录是进程 CWD，不是 JSON 所在目录 | 用绝对路径或在 JSON 同目录执行 |

最后一条是高频问题：pipeline 里的相对路径以**进程当前工作目录**为基准，与 JSON 文件位置无关。在 `/etc/cron.d` 里跑一条引用 `data/input.las` 的 pipeline，实际找的是 `/data/input.las`。稳妥做法是 JSON 里一律用绝对路径，或脚本里先 `cd` 到数据目录。

## 5.11 生产建议

**显式写 type，别依赖推断。** 推断规则只适合示例和小脚本。生产 pipeline 里每个 stage 都写全 `type`，reader/writer 都写全 `filename`。

**每个 filter 都显式写 `inputs`（超过 3 个 stage 时）。** 默认输入列表是隐式状态，stage 一多就难追踪。显式连边让数据流在 JSON 里就能读出来。

**用 tag 命名关键中间结果。** `tag: "ground"`、`tag: "reproj"` 让 `inputs: ["ground", "reproj"]` 自解释；出问题时日志里也有可读的名字。

**把 `--pipeline-serialization` 的输出入库。** 它是“实际执行了什么”的唯一权威记录，比手写 JSON 更可靠。

**归档时打开 `pdal_metadata` / `pipeline` VLR。** 数据自带处理史，尤其适合跨组织交付。

## 5.12 小结

| 主题 | 关键事实 |
|------|---------|
| 顶层形态 | 裸数组；`{"pipeline": [...]}` 是 1.9 前的兼容写法 |
| 解析入口 | `PipelineReaderJSON::parsePipeline()`，规则来自源码不是 schema |
| 字符串推断 | 首位或非末位→reader；末位→writer；中间字符串会被当 reader |
| glob | 仅 pipeline 文件内生效，一个通配展开成多个 reader |
| 保留键 | `type`/`filename`/`tag`/`inputs`/`plugin`/`option_file`/`user_data` |
| tag 规则 | 字母开头，后续字母/数字/下划线；全局唯一；先定义后引用 |
| 默认输入列表 | filter/writer 无 `inputs` 时消费全部；有 `inputs` 时替换 |
| 多叶子 | 只警告不报错，只有第一个叶子会被执行 |
| 多视图 | `#` 占位符逐个写文件；无 `#` 则合并成一份 |
| 通用选项 | `where` 表达式 + `where_merge`（`auto` 默认） |
| 序列化 | `--pipeline`（构造的）vs `--pipeline-serialization`（实跑的） |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第04章-命令行工具与日常操作/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第06章-Readers读取器详解/" class="chapter-nav__next">下一章 →</a>
</div>
