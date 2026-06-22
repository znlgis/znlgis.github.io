---
layout: default
title: 第11章 - 全局事件监听（GoHook）
---

# 第11章 - 全局事件监听（GoHook）

前面章节我们都在“主动控制”计算机——让程序去移动鼠标、敲键盘。本章则反过来：让程序“被动感知”用户的键盘鼠标动作。这种全局事件监听能力由 RobotGo 的配套子库 **gohook**（[robotn/gohook](https://github.com/robotn/gohook)）提供，是实现全局热键、操作录制、快捷工具的核心。

## 11.1 什么是全局事件监听

全局事件监听（Global Event Hook）是指：无论焦点在哪个窗口，程序都能捕获到系统范围内发生的键盘按键、鼠标点击、移动、滚轮等事件。它与普通 GUI 程序“只能收到自己窗口内事件”不同，是系统级的钩子（hook）。

典型用途：

- **全局热键**：按下某个组合键（如 Ctrl+Shift+Q）触发自定义动作，即使你的程序在后台。
- **操作录制**：记录用户的一连串键鼠操作，之后回放。
- **效率工具**：监听特定按键序列触发文本扩展、窗口切换等。

## 11.2 引入 gohook

事件监听不在 RobotGo 主库，需要单独导入 gohook：

```go
import (
    hook "github.com/robotn/gohook"
)
```

并在 Linux 上确保安装了 GoHook 所需的依赖库（xcb、libxkbcommon 等，见第 2 章），否则无法编译或运行。

## 11.3 注册事件回调：Register

`hook.Register` 是最常用的高层 API，用于注册“当某个按键/组合键被按下时”执行的回调函数。

```go
package main

import (
    "fmt"

    hook "github.com/robotn/gohook"
)

func main() {
    fmt.Println("--- 按 ctrl + shift + q 停止监听 ---")
    hook.Register(hook.KeyDown, []string{"q", "ctrl", "shift"}, func(e hook.Event) {
        fmt.Println("触发了 ctrl-shift-q")
        hook.End() // 停止监听
    })

    fmt.Println("--- 按 w 键 ---")
    hook.Register(hook.KeyDown, []string{"w"}, func(e hook.Event) {
        fmt.Println("你按了 w")
    })

    s := hook.Start()
    <-hook.Process(s) // 阻塞，直到 hook.End() 被调用
}
```

理解这个程序的关键：

- `hook.Register(事件类型, 按键组合, 回调)`：声明“当满足条件时执行回调”。
- `hook.KeyDown`：事件类型，表示“按键按下”。还有 `hook.KeyUp`、`hook.MouseDown`、`hook.MouseUp`、`hook.MouseMove`、`hook.MouseWheel` 等。
- `hook.Start()`：启动事件监听，返回一个事件通道。
- `hook.Process(s)`：处理已注册的回调，返回一个通道；`<-` 阻塞主协程直到 `hook.End()` 被调用。
- `hook.End()`：停止监听，使 `Process` 返回、程序得以退出。

## 11.4 低层事件流：直接消费事件通道

如果你不想用 `Register` 的“注册回调”模式，而是想自己处理每一个原始事件，可以直接消费 `hook.Start()` 返回的事件通道：

```go
func low() {
    evChan := hook.Start()
    defer hook.End()

    for ev := range evChan {
        fmt.Println("捕获事件:", ev)
    }
}
```

这种“低层模式”能拿到所有事件的完整信息（事件类型、键码、鼠标坐标等），适合做操作录制、事件分析等需要原始数据的场景。

## 11.5 事件结构 hook.Event

每个事件都是一个 `hook.Event` 结构，包含诸如事件类型（`Kind`）、键码（`Keycode`/`Rawcode`）、键盘字符、鼠标按键、坐标（`X`、`Y`）、滚轮量等字段。你可以根据 `ev.Kind` 判断事件类型再读取对应字段：

```go
for ev := range evChan {
    switch ev.Kind {
    case hook.KeyDown:
        fmt.Println("按键按下, keychar:", ev.Keychar)
    case hook.MouseDown:
        fmt.Printf("鼠标按下, 坐标 (%d, %d)\n", ev.X, ev.Y)
    case hook.MouseMove:
        fmt.Printf("鼠标移动到 (%d, %d)\n", ev.X, ev.Y)
    }
}
```

不同版本的 gohook 字段名可能略有差异，使用时可结合 `fmt.Printf("%+v", ev)` 打印完整结构来确认可用字段。

## 11.6 添加单次事件等待：AddEvent / AddEvents

gohook 还提供了“阻塞等待某个事件发生一次”的便捷函数，适合简单的“等用户按某个键再继续”的场景：

```go
func event() {
    // 等待组合键 q + ctrl + shift
    ok := hook.AddEvents("q", "ctrl", "shift")
    if ok {
        fmt.Println("检测到组合键")
    }

    // 等待单个键 k
    keve := hook.AddEvent("k")
    if keve {
        fmt.Println("你按了 k")
    }

    // 等待鼠标左键
    mleft := hook.AddEvent("mleft")
    if mleft {
        fmt.Println("你按了鼠标左键")
    }
}
```

`AddEvent` / `AddEvents` 会阻塞直到对应事件发生，返回 `true`。鼠标按键用 `"mleft"`、`"mright"` 等名称表示。

## 11.7 完整示例

下面是官方 gohook 示例的整理版，把三种用法放在一起（实际运行时一次选用一种）：

```go
package main

import (
    "fmt"

    hook "github.com/robotn/gohook"
)

func main() {
    add()
    // low()
    // event()
}

func add() {
    fmt.Println("--- 按 ctrl + shift + q 停止 ---")
    hook.Register(hook.KeyDown, []string{"q", "ctrl", "shift"}, func(e hook.Event) {
        fmt.Println("ctrl-shift-q")
        hook.End()
    })

    fmt.Println("--- 按 w ---")
    hook.Register(hook.KeyDown, []string{"w"}, func(e hook.Event) {
        fmt.Println("w")
    })

    s := hook.Start()
    <-hook.Process(s)
}

func low() {
    evChan := hook.Start()
    defer hook.End()
    for ev := range evChan {
        fmt.Println("hook:", ev)
    }
}

func event() {
    ok := hook.AddEvents("q", "ctrl", "shift")
    if ok {
        fmt.Println("add events...")
    }

    keve := hook.AddEvent("k")
    if keve {
        fmt.Println("you press k")
    }

    mleft := hook.AddEvent("mleft")
    if mleft {
        fmt.Println("you press mouse left")
    }
}
```

## 11.8 实战：用热键触发自动化动作

把事件监听（gohook）与主动控制（robotgo）结合，就能做出真正的“全局热键工具”。下面演示按 Ctrl+Shift+P 自动粘贴一段签名文本：

```go
package main

import (
    "fmt"

    "github.com/go-vgo/robotgo"
    hook "github.com/robotn/gohook"
)

func main() {
    fmt.Println("按 ctrl+shift+p 粘贴签名，按 ctrl+shift+q 退出")

    hook.Register(hook.KeyDown, []string{"p", "ctrl", "shift"}, func(e hook.Event) {
        robotgo.WriteAll("此致\n敬礼\n张三")
        robotgo.MilliSleep(50)
        robotgo.KeyTap("v", "ctrl")
    })

    hook.Register(hook.KeyDown, []string{"q", "ctrl", "shift"}, func(e hook.Event) {
        hook.End()
    })

    s := hook.Start()
    <-hook.Process(s)
}
```

这个小程序常驻后台，任何时候按下热键都会自动粘贴预设文本——这正是事件监听与桌面控制协同的威力。

## 11.9 实战技巧与注意事项

1. **平台权限**：与控制类似，事件监听在 macOS 上同样需要“辅助功能”权限；Linux 上需要安装 GoHook 相关依赖库。
2. **务必能退出**：注册一个“停止热键”（如 Ctrl+Shift+Q 调 `hook.End()`），否则 `<-hook.Process(s)` 会一直阻塞，程序无法正常退出。
3. **回调要轻量**：事件回调中不要做耗时操作，以免阻塞事件流。耗时任务应放到单独的 goroutine。
4. **避免自触发**：当你用 robotgo 模拟按键时，gohook 也可能捕获到这些“自己发出的”事件，设计逻辑时要避免无限循环触发。
5. **录制回放**：用低层事件流记录事件序列时，注意同时记录时间戳，回放时按相对时间间隔重放才自然。

## 11.10 小结

本章我们学习了基于 gohook 子库的全局事件监听：用 `Register` 注册热键回调、用 `Start`/`Process`/`End` 控制监听生命周期、用低层事件通道消费原始事件、用 `AddEvent`/`AddEvents` 阻塞等待单次事件，并通过“热键触发自动粘贴”示例把监听与控制结合起来。至此，RobotGo 主库及核心子库的能力已基本讲完。下一章我们进入进阶话题——基于 OpenCV 的图像识别。
