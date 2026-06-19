---
layout: default
title: 第09章 - 并发进阶：sync包与并发控制
---

# 第09章 - 并发进阶：sync包与并发控制

虽然 Go 推崇用 channel 通信，但在某些场景下，传统的共享内存加锁同步更简洁高效。本章讲解 `sync` 包提供的同步原语、`sync/atomic` 原子操作、`context` 包以及并发安全的注意事项。

## 9.1 何时用锁，何时用 channel

Go 社区有一条经验法则：

- **传递数据所有权、协调 goroutine** → 使用 channel。
- **保护共享状态、简单的计数与缓存** → 使用 `sync` 包的锁。

两者并非对立，应根据场景选择更清晰的方案。"通过通信共享内存"是首选，但不是教条。

## 9.2 互斥锁 sync.Mutex

`sync.Mutex` 是最常用的同步原语，用于保护临界区，确保同一时刻只有一个 goroutine 访问共享资源：

```go
type Counter struct {
    mu    sync.Mutex
    count int
}

func (c *Counter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock() // 保证解锁，即使 panic
    c.count++
}

func (c *Counter) Value() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.count
}
```

### 9.2.1 使用要点

- `Lock()` 和 `Unlock()` 必须成对出现，通常用 `defer` 确保解锁。
- Mutex 是值类型，不能复制（复制后两个锁互不影响）。包含 Mutex 的结构体应通过指针传递。
- Mutex 不可重入：同一 goroutine 重复 Lock 会死锁。

## 9.3 读写锁 sync.RWMutex

当读操作远多于写操作时，`sync.RWMutex` 允许多个读者同时持有读锁，但写锁是排他的，能显著提升并发读性能：

```go
type Cache struct {
    mu   sync.RWMutex
    data map[string]string
}

func (c *Cache) Get(key string) string {
    c.mu.RLock()         // 读锁，可并发
    defer c.mu.RUnlock()
    return c.data[key]
}

func (c *Cache) Set(key, value string) {
    c.mu.Lock()          // 写锁，排他
    defer c.mu.Unlock()
    c.data[key] = value
}
```

## 9.4 等待组 sync.WaitGroup

`sync.WaitGroup` 用于等待一组 goroutine 全部完成，是替代"用 channel 计数"的简洁方案：

```go
func main() {
    var wg sync.WaitGroup

    for i := 0; i < 5; i++ {
        wg.Add(1) // 计数器加 1
        go func(id int) {
            defer wg.Done() // 完成时计数器减 1
            fmt.Printf("worker %d 完成\n", id)
        }(i)
    }

    wg.Wait() // 阻塞直到计数器归零
    fmt.Println("所有 worker 已完成")
}
```

### 9.4.1 使用要点

- `Add` 应在启动 goroutine **之前**调用，避免竞态。
- `Done` 通常用 `defer` 调用，确保即使 panic 也能递减。
- WaitGroup 不能复制，传递时用指针。

## 9.5 一次性执行 sync.Once

`sync.Once` 确保某个操作在程序运行期间**仅执行一次**，常用于单例初始化、懒加载：

```go
var (
    instance *Database
    once     sync.Once
)

func GetDatabase() *Database {
    once.Do(func() {
        instance = &Database{ /* 初始化连接 */ }
    })
    return instance
}
```

无论 `GetDatabase` 被多少个 goroutine 并发调用，初始化逻辑只会执行一次，且其他 goroutine 会等待初始化完成。

## 9.6 并发安全的 map：sync.Map

内置 map 不是并发安全的。对于读多写少、键集合相对稳定的场景，可使用 `sync.Map`：

```go
var m sync.Map

m.Store("key", 100)              // 写入
value, ok := m.Load("key")       // 读取
m.Delete("key")                  // 删除
m.LoadOrStore("k", 1)            // 不存在则存储

// 遍历
m.Range(func(key, value any) bool {
    fmt.Println(key, value)
    return true // 返回 false 停止遍历
})
```

> **注意**：`sync.Map` 并非万能。对于大多数场景，"普通 map + RWMutex"性能更好、更直观。仅在特定读多写少或键稳定的场景才考虑 `sync.Map`。

## 9.7 原子操作 sync/atomic

对于简单的数值操作，原子操作比互斥锁更高效，因为它直接利用 CPU 的原子指令，无需加锁：

```go
import "sync/atomic"

var counter int64

func increment() {
    atomic.AddInt64(&counter, 1)        // 原子加
}

func read() int64 {
    return atomic.LoadInt64(&counter)   // 原子读
}
```

Go 1.19 起提供了更易用的原子类型封装：

```go
var counter atomic.Int64
counter.Add(1)
counter.Load()
counter.Store(10)
counter.CompareAndSwap(10, 20) // CAS 操作
```

## 9.8 context 包

`context` 是 Go 并发编程中用于**传递取消信号、超时、截止时间和请求范围值**的标准机制，在网络服务、API 调用链中无处不在。

### 9.8.1 创建 context

```go
import "context"

// 根 context
ctx := context.Background()  // 通常作为顶层
ctx := context.TODO()        // 不确定用哪个时的占位

// 可取消的 context
ctx, cancel := context.WithCancel(context.Background())
defer cancel() // 释放资源

// 带超时
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
defer cancel()

// 带截止时间
ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(time.Minute))
defer cancel()
```

### 9.8.2 监听取消信号

goroutine 通过 `ctx.Done()` channel 感知取消：

```go
func worker(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            fmt.Println("收到取消信号:", ctx.Err())
            return
        default:
            // 执行工作
            time.Sleep(100 * time.Millisecond)
        }
    }
}

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), time.Second)
    defer cancel()
    worker(ctx) // 1 秒后自动取消
}
```

### 9.8.3 传递请求范围的值

```go
ctx := context.WithValue(context.Background(), "userID", 12345)
userID := ctx.Value("userID")
```

> **最佳实践**：context 应作为函数的**第一个参数**显式传递（命名为 `ctx`），不要存储在结构体中；`WithValue` 只用于传递请求范围的元数据（如 trace ID），不要用于传递可选参数。

## 9.9 竞态检测器

数据竞争（data race）是并发编程中最隐蔽的 bug。Go 内置了强大的竞态检测器，在测试和运行时加上 `-race` 标志即可启用：

```bash
go run -race main.go
go test -race ./...
go build -race
```

竞态检测器会在运行时监控内存访问，一旦发现多个 goroutine 在没有同步的情况下并发访问同一内存（且至少有一个是写操作），就会报告详细的竞态信息。

> **强烈建议**：在 CI 流程中始终启用 `-race` 运行测试，及早发现并发问题。

## 9.10 并发设计原则

1. **共享状态最小化**：尽量减少需要同步的共享数据。
2. **明确所有权**：一份数据在同一时刻应只由一个 goroutine 拥有写权限。
3. **锁的粒度要合适**：锁太粗影响并发，太细容易出错。
4. **避免嵌套锁**：多个锁的获取顺序不一致会导致死锁。
5. **始终用 -race 测试**。
6. **每个 goroutine 都要有退出路径**：避免泄漏。

## 9.11 本章小结

本章讲解了 Go 并发的进阶工具：`sync.Mutex`/`RWMutex` 保护共享状态，`WaitGroup` 等待 goroutine 完成，`Once` 实现单次初始化，`sync.Map` 和 `atomic` 提供并发安全的数据访问，`context` 统一管理取消与超时。配合 `-race` 竞态检测器，可以构建出正确、高效的并发程序。channel 与锁各有适用场景，应根据问题选择最清晰的方案。

下一章我们将学习 Go 的包管理与 Go Modules。
