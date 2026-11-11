---
layout: default
title: 第13章 - C++ 开发与自定义 Stage
---

# 第13章 - C++ 开发与自定义 Stage

`filters.expression` 写不出的逻辑、Python 绑定里跑一百万个点太慢的那一段、公司内部特有的传感器格式——这三类需求最后都会落到同一个出口：写一个 C++ stage。PDAL 的扩展模型很轻：一个继承自 `Filter`（或 `Reader`/`Writer`）的类、一个描述结构体、一行注册宏、一个按命名约定产出的动态库，放进 `PDAL_DRIVER_PATH` 就能被 `pdal pipeline` 当成原生 stage 使用。

代价是 C++ 的门槛和 ABI 约束。本章按"先跑通、再讲规则、最后讲性能"的顺序：给出一份能编译、能加载、能被 pipeline 调用的最小 filter；讲清插件命名与搜索路径这套规则（90% 的"插件加载不上"都出在这里）；再讨论流式实现与类型系统的坑。代码以 PDAL 2.10.0 的 API 为准。

## 13.1 什么时候值得写 C++ stage

先给判断标准，避免"为了用 C++ 而用 C++"：

| 需求 | 推荐方案 |
|---|---|
| 按属性条件筛点、改属性 | `filters.expression` / `filters.assign`，纯 JSON |
| 一次性数据清洗、调用外部服务 | `filters.python`（原型）→ 稳定后改写 |
| 每点计算量小但点数上亿 | C++ streamable filter |
| 新的文件格式读写 | C++ reader/writer + 插件 |
| 需要访问 PDAL 内部类型（PointView、KD 索引） | C++ filter |
| 只是编排已有 stage | Python 绑定或 JSON pipeline |

换算成本：一个 C++ filter 从 0 到能在生产 pipeline 里用，通常是一天（含构建、调试、CI），之后每次 PDAL 大版本升级都要重新编译。如果逻辑能用 `filters.expression` 表达，别写 C++。

## 13.2 构建环境

### 13.2.1 依赖

写外部插件只需要 PDAL 的开发文件（头文件 + `PDALConfig.cmake`），不需要 PDAL 源码树。用官方二进制安装包（conda、OSGeo4W、vcpkg）时这些文件都在；自己编译 PDAL 时 `cmake --install` 会一并安装。

插件必须和 PDAL 主库**用同一个编译器 ABI**（MSVC 的 `_ITERATOR_DEBUG_LEVEL`、GCC 的 `_GLIBCXX_USE_CXX11_ABI` 都要一致）。这就是为什么"conda 里装 PDAL、系统里用 MSVC 编插件"经常在加载时崩：符号对不上。最稳的做法是在同一个 conda 环境里装 `pdal` + `cxx-compiler`，用它编译。

### 13.2.2 最小 CMakeLists

PDAL 官方示例 `examples/writing-filter/CMakeLists.txt` 只有 11 行，可以直接照抄：

```cpp
// MyFilter.hpp
#pragma once

#include <pdal/pdal_internal.hpp>
#include <pdal/Filter.hpp>

namespace pdal
{

class MyFilter : public Filter
{
public:
    MyFilter() : Filter() {}
    std::string getName() const;

private:
    double m_value;
    Dimension::Id m_myDimension;

    virtual void addDimensions(PointLayoutPtr layout);
    virtual void addArgs(ProgramArgs& args);
    virtual PointViewSet run(PointViewPtr view);
};

} // namespace pdal
```

```cmake
cmake_minimum_required(VERSION 3.13)
project(FilterTutorial)

find_package(PDAL 2.5 REQUIRED CONFIG)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_library(pdal_plugin_filter_myfilter SHARED MyFilter.cpp)
target_link_libraries(pdal_plugin_filter_myfilter PRIVATE ${PDAL_LIBRARIES})
target_include_directories(pdal_plugin_filter_myfilter PRIVATE ${PDAL_INCLUDE_DIRS})
target_link_directories(pdal_plugin_filter_myfilter PRIVATE ${PDAL_LIBRARY_DIRS})
```

`find_package(PDAL 2.5 REQUIRED CONFIG)` 是硬要求：`CONFIG` 模式才会加载 `PDALConfig.cmake` 并定义 `PDAL_LIBRARIES`/`PDAL_INCLUDE_DIRS`/`PDAL_LIBRARY_DIRS` 三个变量。`add_library(... SHARED ...)` 的 target 名字**就是这个插件的文件名**，见 13.3 节。

## 13.3 最小可加载的 filter

### 13.3.1 完整源码

```cpp
// MyFilter.cpp
#include "MyFilter.hpp"
#include <pdal/pdal_internal.hpp>

namespace pdal
{

static PluginInfo const s_info
{
    "filters.name",                 // 必须叫 filters.<名字>
    "My awesome filter",            // pdal --drivers 里显示的描述
    "http://link/to/documentation"  // 文档链接
};

// 关键一行：注册成运行时加载的插件
CREATE_SHARED_STAGE(MyFilter, s_info)

std::string MyFilter::getName() const { return s_info.name; }

void MyFilter::addArgs(ProgramArgs& args)
{
    args.add("param", "Some parameter", m_value, 1.0);
}

void MyFilter::addDimensions(PointLayoutPtr layout)
{
    layout->registerDim(Dimension::Id::Intensity);
    m_myDimension = layout->registerOrAssignDim("MyDimension",
            Dimension::Type::Unsigned8);
}

PointViewSet MyFilter::run(PointViewPtr input)
{
    PointViewSet viewSet;
    viewSet.insert(input);
    return viewSet;
}

} // namespace pdal
```

三个 API 的作用：

- `addArgs(ProgramArgs&)`：声明 option。`args.add(name, description, member, default)` 会同时把默认值写进 `--options` 的输出，所以用户执行 `pdal --options filters.name` 能看到 `param [1]`。
- `addDimensions(PointLayoutPtr)`：向点表注册维度。已有标准维度用 `registerDim(Dimension::Id::Intensity)`；自定义维度用 `registerOrAssignDim("名字", 类型)`，返回的 `Dimension::Id` 存下来供后面读写。
- `run(PointViewPtr)`：非流式实现，拿到整个 view 的副本，返回新的 `PointViewSet`。想原地改可以像示例一样把 `input` 直接塞回 `viewSet`。

### 13.3.2 命名规则：文件、stage 名、宏三者必须对齐

`pdal::PluginDirectory` 启动时扫描目录，只认这种文件名：

```text
libpdal_plugin_{reader|writer|filter|kernel}_{stage 短名}.{dll|so|dylib}
```

对应的 stage 全名是 `{type}s.{短名}`。举例：

| 文件名 | stage 名 |
|---|---|
| `libpdal_plugin_filter_myfilter.so` | `filters.myfilter` |
| `libpdal_plugin_reader_myreader.so` | `readers.myreader` |
| `pdal_plugin_writer_txt.dll` | 不合法（缺 `lib` 前缀），不会被加载 |

注意最后一行的陷阱：`validPlugin()` 的校验是 `file.find("libpdal_plugin_") == 0`，**要求文件名以 `lib` 开头**。CMake 在 Linux/macOS 上给 `SHARED` 库自动加 `lib` 前缀，所以 `add_library(pdal_plugin_filter_myfilter ...)` 出来的就是 `libpdal_plugin_filter_myfilter.so`，刚好合法；Windows 下不加前缀，必须显式设置：

```cmake
if (MSVC)
  set_target_properties(pdal_plugin_filter_myfilter PROPERTIES PREFIX "lib")
endif()
```

PDAL 自己的插件用 `PDAL_CREATE_PLUGIN` 宏（`cmake/pluginmacros.cmake`）处理这个差异——它把 MSVC 下的 target 名直接写成 `libpdal_plugin_...`。手工写 CMake 时照这个规则来即可。

还要注意 stage 短名里不能带 `filters.` 前缀：`s_info` 里写 `"filters.myfilter"`，文件名里只写 `myfilter`。两者对不上时的现象是插件被加载了（Debug 日志 `Loaded plugin`）但没有注册（"No symbol PF_initPlugin" 或注册表里没有该名字）。

### 13.3.3 静态注册：不改 PDAL 源码的替代方案

如果不想维护外部动态库，可以把 stage 直接编进自己的宿主程序，用 `CREATE_STATIC_STAGE(T, info)` 替代 `CREATE_SHARED_STAGE`：

```cpp
#define CREATE_STATIC_STAGE(T, info) \
    static bool T ## _b = \
        pdal::PluginManager<pdal::Stage>::registerPlugin<T>(info);
```

区别只有一点：`CREATE_SHARED_STAGE` 生成导出符号 `PF_initPlugin`，由 PDAL 在 `dlopen` 后主动调用；`CREATE_STATIC_STAGE` 用静态变量初始化在 `main()` 之前完成注册。宿主程序完全不需要 `PDAL_DRIVER_PATH`，适合"PDAL 作为库嵌入自有软件"的形态。

### 13.3.4 验证三连

```bash
# 1) 能加载
export PDAL_DRIVER_PATH=/path/to/build
pdal --drivers | grep myfilter

# 2) 参数表正确
pdal --options filters.myfilter

# 3) 能跑
pdal pipeline test.json
```

Windows PowerShell 里第 1 行是 `$env:PDAL_DRIVER_PATH = "D:\build"`。如果 `--drivers` 里没有，开 Debug 日志看加载过程：

```bash
pdal --drivers --debug 2>&1 | grep -i "plugin\|can't load"
```

常见输出与含义：`Can't load library ...` 是动态库依赖缺失或 ABI 不匹配；`Loaded plugin` 后没有出现 stage 名，是注册宏没生效（多半写成了 `CREATE_SHARED_STAGE` 以外的宏，或文件名与 stage 名不匹配）。

## 13.4 流式 filter：继承 Filter 和 Streamable

### 13.4.1 为什么需要两个基类

PDAL 的 `Filter` 只保证非流式路径（`run(PointViewPtr)`）。要让 pipeline 能以 `--stream` 或 `execute_streaming` 跑，必须同时实现 `Streamable` 的 `processOne(PointRef&)`。官方 `filters.head` 就是最小范例：

```cpp
#include <pdal/Filter.hpp>
#include <pdal/Streamable.hpp>

namespace pdal
{

class HeadFilter : public Filter, public Streamable
{
public:
    std::string getName() const;

private:
    point_count_t m_count;
    point_count_t m_index;
    bool m_invert;

    virtual void addArgs(ProgramArgs& args);
    virtual bool processOne(PointRef& point);
    virtual PointViewSet run(PointViewPtr view);
    virtual void ready(PointTableRef table);
};

} // namespace pdal
```

对应的实现里，两个入口要保证语义一致：`processOne()` 返回 `false` 表示"丢弃该点"，`run()` 里对每个点调 `processOne`，为真的才 `appendPoint`：

```cpp
bool HeadFilter::processOne(PointRef& point)
{
    bool keep = (m_index < m_count);
    m_index++;
    return m_invert ? !keep : keep;
}

PointViewSet HeadFilter::run(PointViewPtr inView)
{
    PointViewSet viewSet;
    m_index = 0;
    PointViewPtr outView = inView->makeNew();
    for (PointRef point : *inView)
        if (processOne(point))
            outView->appendPoint(*inView, point.pointId());
    viewSet.insert(outView);
    return viewSet;
}
```

### 13.4.2 生命周期钩子

`pdal/Stage.hpp` 定义的虚函数按调用顺序：

| 钩子 | 时机 | 典型用途 |
|---|---|---|
| `addArgs(ProgramArgs&)` | 构造后、解析 option | 声明参数与默认值 |
| `initialize(PointTableRef)` | prepare 早期 | 校验互斥参数 |
| `addDimensions(PointLayoutPtr)` | prepare 中 | 注册输出维度 |
| `prepared(PointTableRef)` | prepare 后段 | 依赖最终 schema 的初始化 |
| `ready(PointTableRef)` | 开始处理前 | 重置计数器、打开文件 |
| `run(PointViewPtr)` / `processOne(PointRef&)` | 处理阶段 | 实际逻辑 |
| `done(PointTableRef)` | 结束后 | 关文件、写汇总元数据 |

`prerun(const PointViewSet&)` 只对多输入的 stage 有意义（merge 类）。把状态初始化放在 `ready()` 而不是构造函数里，是 PDAL stage 的惯例：构造函数会被 `StageFactory::createStage()` 调用，此时 option 还没解析。

### 13.4.3 自定义 reader/writer 的额外约定

reader 必须实现 `read(PointViewPtr view, point_count_t count)`，返回本次实际读入的点数；返回 0 表示 EOF。writer 实现 `write(const PointViewPtr)&` 与 `readyFile()/doneFile()`。官方 `examples/writing-reader` 与 `writing-writer` 各给出了一份不到 120 行的完整实现，比看文档快。

reader 的 SRS 在 `ready()` 里用 `setSpatialReference(ref)` 声明：

```cpp
void MyReader::ready(PointTableRef)
{
    m_index = 0;
    SpatialReference ref("EPSG:4385");
    setSpatialReference(ref);
}
```

## 13.5 类型系统与数值写入

### 13.5.1 维度是强类型的

PDAL 的维度类型在注册时就固定了：`registerOrAssignDim("Roughness", Dimension::Type::Double)`。写入时用模板方法，类型不匹配会做转换而不是报错，但用错模板参数（例如把 `double` 写进 `Unsigned8` 维度）会静默截断：

```cpp
PointLayoutPtr layout = view->layout();
Dimension::Id rough = layout->findProprietaryDim("Roughness");
view->setField(rough, pointId, 3.14);        // 有隐式转换
double v = view->getFieldAs<double>(rough, pointId);
```

`findProprietaryDim()` 找不到时返回 `Dimension::Id::Unknown`。拿它去 `setField` 不会崩溃，但数据写不进去，表现为输出里该维度全是 0——这是自定义维度最常见的静默失败。

### 13.5.2 批量读写比逐点快

`PointView` 支持类型化数组访问：

```cpp
auto x = view->getFieldAs<double>(Dimension::Id::X, 0);   // 单点
// 批量：先拿指针，再按 layout 的 stride 走
char *base = view->getPoint(0);
```

逐点 `getFieldAs/setField` 每次都要查维度偏移，百万点级别会成为瓶颈。官方 filter 在热路径里通常先把 `Dimension::Id` 和偏移缓存到成员变量，或者在 `prepared()` 里取一次 layout 指针。

## 13.6 在自有程序里调用 PDAL

不想写 pipeline JSON 时，C++ 可以直接拼 pipeline。两种方式：`PipelineManager`（高层，帮你管理 stage 生命周期）与 `StageFactory`（低层，手工连 stage）。

### 13.6.1 StageFactory：手工连线

官方 `examples/writing/tutorial.cpp` 展示了完整流程：

```cpp
#include <pdal/PointView.hpp>
#include <pdal/PointTable.hpp>
#include <pdal/Dimension.hpp>
#include <pdal/Options.hpp>
#include <pdal/StageFactory.hpp>
#include <io/BufferReader.hpp>

using namespace pdal;

int main()
{
    Options options;
    options.add("filename", "myfile.las");

    PointTable table;
    table.layout()->registerDim(Dimension::Id::X);
    table.layout()->registerDim(Dimension::Id::Y);
    table.layout()->registerDim(Dimension::Id::Z);

    PointViewPtr view(new PointView(table));
    for (int i = 0; i < 1000; ++i)
    {
        view->setField(Dimension::Id::X, i, -93.0 + i * 0.001);
        view->setField(Dimension::Id::Y, i, 42.0 + i * 0.001);
        view->setField(Dimension::Id::Z, i, 106.0 + i);
    }

    BufferReader reader;
    reader.addView(view);

    StageFactory factory;
    Stage *writer = factory.createStage("writers.las");  // factory 拥有该对象
    writer->setInput(reader);
    writer->setOptions(options);
    writer->prepare(table);
    writer->execute(table);
}
```

要点：`StageFactory::createStage()` 返回裸指针，所有权归 factory（工厂析构时统一销毁），用 `destroyStage()` 可提前释放；`prepare(table)` 必须先于 `execute(table)`；`BufferReader` 是内存数据源，头文件在 `io/BufferReader.hpp`（属于内部头，随安装包一起发布）。

### 13.6.2 PipelineManager：按 JSON 或按名字

`PipelineManager` 更适合"配置驱动"的场景：

```cpp
#include <pdal/PipelineManager.hpp>

PipelineManager mgr;
mgr.readPipeline("pipeline.json");   // 读 JSON
mgr.execute();                       // 返回点数
const PointViewSet& views = mgr.views();
```

也可以不读 JSON 直接加 stage：`mgr.makeReader(file, "readers.las")`、`mgr.makeFilter("filters.smrf")`、`mgr.makeWriter(out, "writers.las")`，返回值是 `Stage&`，可以链式设置 option。构造函数参数 `streamLimit` 默认 **10000**，就是流式执行的块大小——和 Python 绑定 `iterator()` 的默认 chunk_size 是同一个值。

## 13.7 排错清单

| 现象 | 原因 | 修法 |
|---|---|---|
| `pdal --drivers` 看不到插件 | `PDAL_DRIVER_PATH` 没设，或文件名不以 `libpdal_plugin_` 开头 | 设环境变量；Windows 下给 target 加 `lib` 前缀 |
| `Can't load library` | 依赖的 PDAL/GDAL 动态库找不到，或 ABI 不匹配 | 用 `ldd`/`dumpbin /dependents` 查缺哪个库；同环境编译 |
| 日志有 `Loaded plugin` 但 stage 不存在 | `s_info` 名字与文件名短名不一致，或用了错误的注册宏 | 对齐三者：文件名、`s_info.name`、注册宏 |
| `No symbol 'PF_initPlugin' found` | 用了 `CREATE_STATIC_STAGE` 编动态库 | 动态库必须用 `CREATE_SHARED_STAGE` |
| stage 能创建但 `--options` 无参数 | `addArgs` 没写，或参数名拼错 | 检查 `args.add()` 的第一个参数 |
| 自定义维度输出全 0 | `findProprietaryDim` 返回 `Unknown`，或维度没在 `addDimensions` 注册 | 用 `registerOrAssignDim` 返回的 Id，缓存到成员 |
| 流式模式报 "not streamable" | filter 没继承 `Streamable` 或没实现 `processOne` | 双继承 `Filter, Streamable` 并实现 `processOne` |
| 输出点数与预期不符 | `run()` 里的 `appendPoint` 条件与 `processOne` 语义不一致 | 让 `run()` 复用 `processOne()`，别写两套逻辑 |

## 13.8 生产建议

**版本对齐用容器，别靠文档。** 插件二进制对 PDAL 主库版本敏感，升级 PDAL 必须重编插件。CI 里固定基础镜像 tag，构建产物按 PDAL 版本分目录存放。

**优先写 streamable filter。** 非流式 `run()` 会把整个块读进内存，百万点以上差距明显；`processOne` 版本的实现通常只多十几行，但能进 `--stream` 流水线，也能被 `execute_streaming` 调用。

**自定义维度名加前缀。** 多个团队插件共存时，`Roughness`、`density` 这种通用名很容易和别的 stage 冲突。用 `ACME_Roughness` 之类的前缀，并在 `addDimensions` 里固定类型。

**参数校验放在 `initialize()`。** 互斥参数（如 `in_srs` 与 `override_srs`）、范围检查（如窗口半径必须 > 0）在那里抛 `pdal_error`，错误信息会带 stage 名，用户能定位。

**别改 PDAL 源码树做私有分支。** 自定义 stage 走外部插件，PDAL 升级只需重编和回归测试；改源码会把每次升级变成一次手工合并。

## 13.9 本章小结

| 主题 | 结论 |
|---|---|
| 注册宏 | 动态库用 `CREATE_SHARED_STAGE`（导出 `PF_initPlugin`），静态链接用 `CREATE_STATIC_STAGE` |
| 文件命名 | `libpdal_plugin_filter_<短名>.so/.dll`，Win 下需手动加 `lib` 前缀 |
| 搜索路径 | 环境变量 `PDAL_DRIVER_PATH` 优先，否则找 `./lib`、`./bin`、安装目录等 |
| 必需覆盖 | `addArgs`（参数）、`addDimensions`（维度）、`run`（非流式） |
| 流式 | 双继承 `Filter, Streamable` 并实现 `processOne(PointRef&)` |
| 生命周期 | `initialize → addDimensions → prepared → ready → run/processOne → done` |
| C++ 调用 | `StageFactory` 手工连线；`PipelineManager` 支持 JSON 与 `makeReader/makeFilter/makeWriter` |
| 构建 | `find_package(PDAL 2.5 REQUIRED CONFIG)` + `CMAKE_CXX_STANDARD 17` |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第12章-Python绑定与批处理开发/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第14章-Entwine与EPT点云索引/" class="chapter-nav__next">下一章 →</a>
</div>
