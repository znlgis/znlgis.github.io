---
layout: default
title: 第03章：核心基础库Core详解
---

# 第03章：核心基础库 Core 详解

`Ara3D.SDK.Core` 是整个 SDK 的**跨平台基石**（`net8.0`），几乎零外部依赖。它把“高性能数据处理”所需的基础设施打包在一起：集合、内存、事件、日志、工作项、数据表、属性描述、Roslyn 编译。本章逐一讲解这些库的设计意图、关键类型与用法。

## 1. Ara3D.Collections——面向只读列表的高性能集合

**定位**：以 `IReadOnlyList<T>` 为核心、最小化内存分配的集合类型与 LINQ 辅助。零外部依赖。

### 1.1 核心类型

| 类型 | 说明 |
| --- | --- |
| `ReadOnlyList<T>` | 由“数量 + lambda”支撑的函数式只读列表 |
| `ReadOnlyList2D<T>` / `IReadOnlyList2D<T>` | 二维列表视图 |
| `ReadOnlyList3D<T>` / `IReadOnlyList3D<T>` | 三维列表视图 |
| `CompressedSparseRow` | CSR 稀疏矩阵 |
| `IntegerRange` | 惰性整数区间 |
| `EmptyList<T>` | 空列表单例 |
| `LinqArray` | 扩展方法静态类（40+ 方法） |
| `IStack<T>` / `ITree<T>` / `IBinaryTree<T>` | 抽象集合接口 |

### 1.2 函数式列表与惰性映射

`Ara3D.Collections` 的精髓是**用函数描述列表**，避免中间数组分配：

```csharp
// 由 count + lambda 构造只读列表
public static ReadOnlyList<T> Select<T>(this int count, Func<int, T> f)
    => new ReadOnlyList<T>(count, f);

// LINQ 风格 map，避免 IEnumerable 迭代器开销
public static ReadOnlyList<U> Select<T, U>(this IReadOnlyList<T> self, Func<T, U> f)
    => Select(self.Count, i => f(self[i]));

// 惰性整数区间
public static IntegerRange Range(this int self) => new IntegerRange(0, self);
public static IntegerRange UpTo(this int a, int b) => new IntegerRange(a, b - a);

// 展平嵌套列表 / 元素重复
public static ReadOnlyList<T> Flatten<T>(this IReadOnlyList<IReadOnlyList<T>> self, int stride);
public static ReadOnlyList<T> RepeatElements<T>(this IReadOnlyList<T> self, int count);
```

用法示例：

```csharp
var squares = 10.Range().Select(i => i * i);     // 惰性 [0,1,4,9,...,81]
var flat = new[] { new[]{1,2}, new[]{3,4} }
    .ToReadOnlyList().Flatten(2);                // [1,2,3,4]

bool ok  = squares.InRange(3);                   // 索引守卫
bool nil = squares.IsEmpty();
```

> 为什么重要：几何库大量使用 `IReadOnlyList<Point3D>` 表示顶点。用 `Select` 做顶点变换时，得到的是一个**惰性视图**，只有真正访问某个索引时才计算，天然适合链式管线与并行遍历。

## 2. Ara3D.Memory——非托管内存与 SIMD 对齐

**定位**：高性能非托管内存管理，64 字节 SIMD 对齐、堆可存的 `ByteSlice`、内存映射文件视图、类型化非托管缓冲区。依赖 `System.Memory`、`System.IO.Pipes`。

### 2.1 缓冲区接口体系

```csharp
// 原始字节视图（指针 + 长度，可存于堆、可超过 2GB）
public interface IBuffer { ByteSlice Bytes { get; } }

// 带 CLR 元素类型的缓冲区
public interface ITypedBuffer : IBuffer { Type Type { get; } }

// 非托管 T 的类型化数组，同时实现 IReadOnlyList<T>
public interface IBuffer<T> : ITypedBuffer, IReadOnlyList<T> where T : unmanaged
{ new ref T this[int i] { get; } }

// 拥有内存块（Dispose 时 NativeMemory.AlignedFree）
public interface IMemoryOwner : IBuffer, IDisposable
{ IMemoryOwner<T> Convert<T>() where T : unmanaged; }
```

### 2.2 ByteSlice——堆上可存的“Span”

`Span<byte>` 只能在栈上，无法作为类字段长期持有。`ByteSlice` 用裸指针 + 长度解决这个问题：

```csharp
public readonly unsafe struct ByteSlice : IEquatable<ByteSlice>, IReadOnlyList<byte>
{
    public readonly byte* Ptr;
    public readonly long Length;

    public ByteSlice Slice(long from, long count) => new(Ptr + from, count);
    public ByteSlice Skip(long count) => Slice(count, Length - count);
    public Span<byte> AsSpan() => new(Ptr, CheckedLength);
    public string ToAsciiString();
    public string ToUtf8String();
}
```

### 2.3 对齐内存与常用类型

```csharp
// 64 字节对齐的原生块（适配 AVX/AVX-512 加载）
public unsafe class AlignedMemory : IMemoryOwner
{
    public const int Alignment = 64;
    public AlignedMemory(long count) { /* NativeMemory.AlignedAlloc */ }
    public IMemoryOwner<T> Convert<T>() where T : unmanaged => new MemoryOwner<T>(this);
}
```

其他重要类型：

- `UnmanagedList<T>`——可增长的非托管数组（类似 `List<T>` 但用非托管内存，绕过 GC）；
- `MemoryMappedView` / `MemoryMappedFileExtensions`——把文件内存映射进 `AlignedMemory`，实现零拷贝读取超大文件；
- `Serializer`——非托管类型的二进制读写；
- `FixedArray`——GC 固定（pinned）的托管数组，暴露为 `ByteSlice`。

> 设计动机：处理数百万顶点/构件时，托管数组会给 GC 造成巨大压力。`Ara3D.Memory` 让几何与 I/O 层使用**非托管、对齐、可内存映射**的缓冲区，实现稳定的实时性能。`RenderModelData`（第 06 章）正是建立在 `UnmanagedList<T>` 上。

## 3. Ara3D.Utils——通用工具箱

**定位**：文件系统、进程、压缩、性能分析、字符串等通用工具，零外部依赖，`net8.0`。目录较大（50+ 文件）。

代表性内容：

- `FilePath` / `DirectoryPath`——强类型路径包装，提供丰富的路径操作、相对/绝对转换、文件大小格式化（如 `GetFileSizeAsString()`）等；
- `ApplicationData` / `SpecialFolders`——应用数据目录（如 `LocalApplicationData`）；
- `Profiler` / 计时辅助——性能分析；
- `ZipUtils`、`ProcessUtils`、`StringUtils`、`TimeUtils`——压缩、进程、字符串、时间工具；
- `INamed` 接口——被日志、事件等多处复用（表示“有名字的东西”）。

```csharp
DirectoryPath dir = SpecialFolders.LocalApplicationData
    .RelativeFolder("Ara 3D", "MyApp", "Commands");
FilePath file = dir.RelativeFile("model.ply");
string size = file.GetFileSizeAsString();   // 如 "12.4 MB"
```

## 4. Ara3D.Events——线程安全事件总线

**定位**：线程安全、弱引用的发布/订阅事件总线，零外部依赖。

```csharp
public interface IEvent { }                                   // 事件标记接口

public interface ISubscriber<in T> : ISubscriber where T : IEvent
{ void OnEvent(T evt); }                                       // 同步订阅者

public interface IAsyncSubscriber<in T> : ISubscriber where T : IEvent
{ ValueTask OnEventAsync(T evt, CancellationToken ct); }       // 异步订阅者

public interface IEventBus
{
    void Publish<T>(T evt) where T : IEvent;
    void Subscribe<T>(ISubscriber<T> subscriber) where T : IEvent;
    void Unsubscribe<T>(ISubscriber<T> subscriber) where T : IEvent;
}
```

`EventBus` 实现要点：

- 每种事件类型用**无锁的写时复制**订阅者数组（`Subscriptions<T>` 静态内部类）；
- 订阅者以 `WeakReference<T>` 持有——死引用在 `Publish` 时惰性清除，**避免内存泄漏**；
- `IEventErrorHandler` 处理单个订阅者的异常，不影响其他订阅者。

```csharp
var bus = new EventBus(myErrorHandler);
bus.Subscribe<MyEvent>(mySubscriber);   // 以弱引用存储
bus.Publish(new MyEvent { /* ... */ }); // 触发所有存活订阅者
bus.Unsubscribe<MyEvent>(mySubscriber);
```

## 5. Ara3D.Logging——日志、进度与任务

**定位**：基于字符串的简单日志库，带进度、取消与任务（Job）管理，面向桌面应用诊断。依赖 `Ara3D.Utils`。

```csharp
public enum LogLevel { None=0, Debug=1, Info=2, Warning=3, Error=4, Fatal=5, Profiling=6 }

public interface ILogger : INamed
{
    ILogger Log(string message, LogLevel level);
}
```

常用扩展方法：

```csharp
logger.Log("message");                       // Info 级
logger.LogWarning("watch out");
logger.LogError(exception);
using (logger.LogDuration("Loading file"))   // 记录 START + Dispose 时的耗时
{
    LoadBigFile();
}
```

`IJob` 把日志、取消、进度、状态、子任务组合到一起，非常适合长耗时管线：

```csharp
public interface IJob
    : ICancelable, IProgress, ILogger, INamed,
      IStatus<JobStatus>, IErrorHandler, ICompletionHandler
{
    IReadOnlyList<IJob> SubJobs { get; }
    void Start(); void Stop(); void Pause(); void Resume();
    object Result { get; }
    IJob PreviousJob { get; }
}
```

日志输出通过 `ILogWriter.Write(LogEntry)` 路由；内置 `LogWriter.DebugWriter` 会写到 `Debug.WriteLine` + `Console.WriteLine`。构造具体日志器：`new Logger(writer, "MyCategory")`。

## 6. Ara3D.WorkItems——后台工作项队列

**定位**：命名、可取消的后台工作项队列，底层用 `System.Threading.Channels`，零外部依赖。

```csharp
public record WorkItem(string Name, Action<CancellationToken> Action);

public interface IWorkItemQueue : IDisposable
{
    string Name { get; }
    void Enqueue(WorkItem item);
    void ProcessAllPendingWork();
    void ClearAllPendingWork();
    void CancelCurrentAndClearPending();
}
```

`WorkItemQueue` 特点：使用 `Channel<WorkItem>`（可有界/无界）、可选独立后台线程、双 `CancellationTokenSource`（`_shutdownCts` 用于 Dispose，`_preemptCts` 用于取消当前项），并通过 `IWorkItemListener` 回调 `OnWorkStarted` / `OnWorkCompleted` / `OnWorkError`。

```csharp
var queue = WorkItemQueueFactory.CreateThreaded("MyQueue", listener);
queue.Enqueue(new WorkItem("Load", ct => LoadData(ct)));
queue.CancelCurrentAndClearPending();   // 中止当前项、丢弃待处理项
queue.Dispose();                        // 关闭后台线程
```

> 应用：在查看器/编辑器里，把“加载大模型”“重建索引”这类耗时操作放进工作项队列，保持 UI 线程响应，并支持随时抢占取消。

## 7. Ara3D.DataTable——列式内存数据表

**定位**：列优先（struct-of-arrays）的内存数据结构，作为 `System.Data.DataTable` 的高性能替代，零外部依赖。是 BIM 层落地 Parquet/DuckDB 的桥梁。

```csharp
public interface IDataTable
{
    string Name { get; }
    IReadOnlyList<IDataRow> Rows { get; }
    IReadOnlyList<IDataColumn> Columns { get; }
    object this[int column, int row] { get; }
}

public interface IDataColumn
{
    int ColumnIndex { get; }
    IDataDescriptor Descriptor { get; }   // 名称 + 类型
    int Count { get; }
    object this[int n] { get; }
}

public interface IDataSet { IReadOnlyList<IDataTable> Tables { get; } }
```

构建器模式：

```csharp
var builder = new DataTableBuilder("Walls");
builder.AddColumn(new[] { 1, 2, 3 }, "EntityId");
builder.AddColumn(new[] { "Wall-01", "Wall-02", "Wall-03" }, "Name");
IDataTable table = builder.Build();
```

`DataTableExtensions` 提供 `ToSystemDataTable()`、过滤、列查找、连接等；`SparseColumn` 支持只存非空单元格的稀疏列。第 08 章会看到 `IDataTable` / `IDataSet` 被直接序列化为 Parquet / DuckDB / Excel / CSV。

## 8. Ara3D.PropKit——运行时属性描述符

**定位**：运行时属性描述，用于 UI 数据绑定（兼容 WPF/WinForms 的 `INotifyPropertyChanged`、`ICustomTypeProvider`）。依赖 `Ara3D.Geometry`、`Ara3D.Utils`。

```csharp
class PropDescriptor { /* 名称、类型、UI 标签、默认值、校验 */ }
class PropValue { /* 构造时校验的 描述符 + 值 */ }
class PropAccessor { /* 用 PropDescriptor 包装 getter/setter */ }

interface IPropContainer : INotifyPropertyChanged, ICustomTypeProvider
{
    PropValue GetValue(string name);
    void SetValue(PropValue value);
    IReadOnlyList<PropValue> GetAllValues();
}

class PropProvider : IPropContainer { }             // 包装 PropAccessor 列表
class PropContainerDictionary : IPropContainer { }  // PropValue 键值存储
class PropContainerWrapper { }                      // 把任意对象包装成动态视图模型
```

> 用途：Studio 的属性面板、任何需要“根据对象动态生成可编辑属性表”的场景，都可以用 PropKit 把普通对象暴露为可绑定的属性容器。

## 9. Ara3D.Utils.Roslyn——运行时 C# 编译

**定位**：基于 Roslyn 的 C# 编译工具——把源码文件/字符串编译成内存程序集，支持目录监视以实现热重载/脚本化。依赖 `Microsoft.CodeAnalysis.CSharp 4.8.0`、`Microsoft.DiaSymReader.Native`、`Ara3D.Logging`。

```csharp
public class Compilation
{
    public CompilerInput Input { get; }
    public CompilerOutput Output { get; }   // Success / Assembly / Errors
    public ILogger Logger { get; }
}

public class DirectoryWatchingCompiler : IDisposable
{
    public event EventHandler RecompileEvent;
    public bool AutoRecompile { get; set; } = true;
    public Compilation Compilation { get; private set; }
    public void Compile();   // 取消上一次，重新编译
}
```

用法：

```csharp
var compiler = new DirectoryWatchingCompiler(logger, scriptsDir, libsDir);
compiler.RecompileEvent += (s, e) =>
{
    if (compiler.Compilation.Output.Success)
        UseAssembly(compiler.Compilation.Output.Assembly);
};
compiler.Compile();  // 触发首次构建
```

> 这正是第 10 章 **Bowerbird 实时脚本系统**的技术底座：把 `.cs` 文件放进目录，编辑保存即自动编译并运行。

## 10. 本章小结

`Ara3D.SDK.Core` 为高性能三维/BIM 处理提供了完整的基础设施：

- **Collections**：函数式只读列表 + 惰性映射，最小化分配；
- **Memory**：非托管、64 字节对齐、内存映射的缓冲区，绕开 GC；
- **Utils**：强类型路径与通用工具；
- **Events**：无锁、弱引用的事件总线；
- **Logging**：日志 + 进度 + 任务（Job）；
- **WorkItems**：可取消、可抢占的后台队列；
- **DataTable**：列式数据表，直通 Parquet/DuckDB；
- **PropKit**：运行时属性描述用于 UI 绑定；
- **Utils.Roslyn**：运行时编译，支撑热重载脚本。

理解了这层，你就明白 Ara3D 为何能稳定处理海量数据。下一章我们进入数学基础与 `Ara3D.F8` 的 SIMD 加速。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第02章-环境搭建NuGet包体系与第一个程序" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第04章-数学基础与F8-SIMD加速" style="text-decoration: none;">下一章 →</a>
</div>
