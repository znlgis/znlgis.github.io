---
layout: default
title: 第08章 - 并发编程：Goroutine与Channel
---

# 第08章 - 并发编程：Goroutine与Channel

并发是 Go 最引以为傲的特性。本章深入讲解 goroutine 和 channel——Go 并发编程的两大基石，以及基于它们的 CSP 并发模型。

## 8.1 并发与并行

首先厘清两个概念：

- **并发（Concurrency）**：在同一时间段内**处理**多个任务，任务交替执行（即使在单核 CPU 上也能实现）。
- **并行（Parallelism）**：在同一时刻**同时执行**多个任务，需要多核 CPU。

Rob Pike 有句名言："**并发不是并行**（Concurrency is not parallelism）"。并发是一种程序结构的设计方式，使程序能够处理多个独立任务；并行是这种结构在多核硬件上的运行表现。Go 让你用并发的方式编写程序，运行时再将其映射到可用的 CPU 核心上并行执行。

## 8.2 Goroutine

goroutine 是 Go 运行时管理的轻量级线程。在函数调用前加上 `go` 关键字，即可在新的 goroutine 中并发执行该函数：

```go
func say(s string) {
    for i := 0; i < 3; i++ {
        fmt.Println(s)
        time.Sleep(100 * time.Millisecond)
    }
}

func main() {
    go say("world") // 在新 goroutine 中执行
    say("hello")    // 在主 goroutine 中执行
}
```

### 8.2.1 goroutine 的优势

- **极轻量**：初始栈仅 2KB，按需增长/收缩，可以轻松创建数十万个。相比之下，操作系统线程通常占用 1-8MB 栈空间。
- **由 Go 运行时调度**：Go 使用 M:N 调度模型（详见第 14 章），将大量 goroutine 多路复用到少量操作系统线程上，切换成本远低于线程切换。
- **创建简单**：一个 `go` 关键字即可。

### 8.2.2 主 goroutine 退出问题

`main` 函数本身运行在主 goroutine 中。**当主 goroutine 结束时，整个程序立即退出，不会等待其他 goroutine 完成**：

```go
func main() {
    go fmt.Println("这行可能不会被打印")
    // main 立即结束，程序退出
}
```

因此需要某种同步机制确保主 goroutine 等待子 goroutine 完成，这正是 channel 和 `sync.WaitGroup` 的用武之地。

## 8.3 Channel

channel 是 goroutine 之间通信的管道，遵循 CSP 模型"通过通信共享内存"的理念。channel 是类型化的，只能传递特定类型的数据。

### 8.3.1 创建与基本操作

```go
ch := make(chan int)    // 创建一个传递 int 的无缓冲 channel

ch <- 42                // 发送：将 42 发送到 channel
value := <-ch           // 接收：从 channel 接收数据
close(ch)               // 关闭 channel
```

`<-` 是 channel 操作符，箭头方向表示数据流向。

### 8.3.2 无缓冲 channel

无缓冲 channel 的发送和接收是**同步**的：发送操作会阻塞，直到有另一个 goroutine 执行接收；反之亦然。这种特性天然提供了 goroutine 之间的同步：

```go
func main() {
    ch := make(chan string)
    go func() {
        time.Sleep(time.Second)
        ch <- "任务完成" // 发送，阻塞直到被接收
    }()
    msg := <-ch // 接收，阻塞直到有数据，实现了等待
    fmt.Println(msg)
}
```

### 8.3.3 有缓冲 channel

有缓冲 channel 拥有一个容量，只要缓冲区未满，发送就不会阻塞；只要缓冲区非空，接收就不会阻塞：

```go
ch := make(chan int, 3) // 容量为 3 的缓冲 channel
ch <- 1                 // 不阻塞
ch <- 2                 // 不阻塞
ch <- 3                 // 不阻塞
ch <- 4                 // 阻塞！缓冲区已满
```

有缓冲 channel 常用于限流、解耦生产者和消费者的速度差异。

### 8.3.4 关闭 channel

发送方负责关闭 channel，表示"不会再有数据了"。接收方可以通过第二个返回值判断 channel 是否已关闭：

```go
v, ok := <-ch
// ok 为 false 表示 channel 已关闭且数据已取完
```

> **重要规则**：
> - 只有发送方应该关闭 channel，接收方不应关闭。
> - 向已关闭的 channel 发送数据会 panic。
> - 从已关闭的 channel 接收数据会立即返回零值。
> - 重复关闭 channel 会 panic。

### 8.3.5 用 range 遍历 channel

`range` 会持续从 channel 接收数据，直到 channel 被关闭：

```go
func producer(ch chan<- int) {
    for i := 0; i < 5; i++ {
        ch <- i
    }
    close(ch) // 必须关闭，否则 range 会永久阻塞
}

func main() {
    ch := make(chan int)
    go producer(ch)
    for v := range ch { // 自动接收直到 channel 关闭
        fmt.Println(v)
    }
}
```

### 8.3.6 单向 channel

可以限定 channel 只能发送或只能接收，增强类型安全和代码可读性：

```go
func send(ch chan<- int) { // 只能发送
    ch <- 1
}

func receive(ch <-chan int) { // 只能接收
    fmt.Println(<-ch)
}
```

## 8.4 select 多路复用

`select` 语句让一个 goroutine 可以同时等待多个 channel 操作，哪个 channel 就绪就执行对应分支：

```go
select {
case msg1 := <-ch1:
    fmt.Println("收到 ch1:", msg1)
case msg2 := <-ch2:
    fmt.Println("收到 ch2:", msg2)
case ch3 <- "data":
    fmt.Println("发送到 ch3")
default:
    fmt.Println("没有就绪的 channel") // 非阻塞
}
```

- 若多个 case 同时就绪，`select` 会**随机**选择一个执行。
- `default` 分支使 `select` 变为非阻塞；没有 `default` 时，`select` 会阻塞直到某个 case 就绪。

### 8.4.1 超时控制

`select` 配合 `time.After` 是实现超时的经典模式：

```go
select {
case result := <-ch:
    fmt.Println("收到结果:", result)
case <-time.After(2 * time.Second):
    fmt.Println("超时！")
}
```

### 8.4.2 优雅退出

通过一个专门的 `done` channel 通知 goroutine 退出：

```go
func worker(done <-chan struct{}) {
    for {
        select {
        case <-done:
            fmt.Println("收到退出信号")
            return
        default:
            // 执行工作
        }
    }
}
```

## 8.5 经典并发模式

### 8.5.1 Worker Pool（工作池）

固定数量的 worker goroutine 从任务 channel 中取任务处理，控制并发度：

```go
func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        results <- j * 2 // 处理任务
    }
}

func main() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)

    // 启动 3 个 worker
    for w := 1; w <= 3; w++ {
        go worker(w, jobs, results)
    }

    // 发送 9 个任务
    for j := 1; j <= 9; j++ {
        jobs <- j
    }
    close(jobs)

    // 收集结果
    for a := 1; a <= 9; a++ {
        fmt.Println(<-results)
    }
}
```

### 8.5.2 Fan-out / Fan-in

- **Fan-out**：多个 goroutine 从同一个 channel 读取数据，分散处理。
- **Fan-in**：将多个 channel 的数据汇聚到一个 channel。

### 8.5.3 Pipeline（流水线）

将一系列处理阶段串联，每个阶段是一个 goroutine，通过 channel 连接，形成数据处理流水线：

```go
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * n
        }
        close(out)
    }()
    return out
}

// 使用: gen -> square
for n := range square(gen(2, 3, 4)) {
    fmt.Println(n) // 4 9 16
}
```

## 8.6 常见并发陷阱

- **死锁（Deadlock）**：所有 goroutine 都在等待，无人推进。如向无缓冲 channel 发送但无人接收。Go 运行时会检测全局死锁并 panic。
- **goroutine 泄漏**：goroutine 永久阻塞无法退出，持续占用资源。务必确保每个 goroutine 都有明确的退出路径。
- **闭包捕获循环变量**：在 Go 1.22 之前，循环变量在迭代间共享，闭包中需显式传参。Go 1.22 起每次迭代创建新变量，此问题已修复。

## 8.7 本章小结

本章深入讲解了 Go 并发编程的核心：goroutine 是极轻量的并发执行单元，channel 是它们之间类型安全的通信管道。我们学习了无缓冲/有缓冲 channel 的语义、channel 的关闭与遍历、`select` 多路复用与超时控制，以及 Worker Pool、Pipeline 等经典并发模式。掌握"通过通信共享内存"的思想，是写好 Go 并发程序的关键。

下一章我们将学习并发进阶内容：`sync` 包提供的传统同步原语及更多并发控制工具。
