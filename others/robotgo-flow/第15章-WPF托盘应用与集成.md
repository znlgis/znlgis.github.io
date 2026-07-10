---
layout: default
title: 第15章 - WPF 托盘应用与集成
---

# 第15章 - WPF 托盘应用与集成

Go CLI 适合脚本化与无人值守，但对普通用户而言，图形界面更友好。robotgo-flow 配套了一个基于 **.NET 10 WPF** 的 Windows 系统托盘应用（`RobotgoFlow.Tray`），提供任务栏快捷操作、实时进度浮窗、桌面通知与输入变量采集。本章讲解托盘应用的功能、与 Go 引擎的两种通信方式，以及背后的 JSON-Line 协议。

## 15.1 托盘应用能做什么

WPF 托盘应用是一个可选的图形前端，主要提供：

- **系统托盘图标**：常驻任务栏，右键呼出菜单；
- **加载并运行工作流**：图形化选择 YAML 文件；
- **输入变量采集**：以对话框形式收集 `inputs` 定义的运行时变量；
- **实时进度浮窗**：显示当前步骤、动作、进度条；
- **桌面通知**：工作流成功/失败时弹出 Toast 通知；
- **录制标签页**：一键启动交互式录制。

整体使用流程是：**加载 YAML → 输入变量 → 执行 → 实时监控**。

> **再次强调**：托盘应用是**可选**组件。Go CLI 可独立使用，不依赖 .NET 或 WPF。

## 15.2 两种通信方式

WPF 应用与 Go 引擎之间有两种通信方式，两者都实现了统一的 `IEngineService` 抽象接口，可以互换：

| 方式 | 载体 | 实现类 |
| --- | --- | --- |
| 子进程模式 | 启动 `robotgo-flow.exe serve` 子进程，stdin/stdout 通信 | `GoProcessService` |
| DLL 模式 | 通过 P/Invoke 调用 `robotgo-flow.dll` | `RobotgoNative` |

### 15.2.1 子进程模式（GoProcessService）

`GoProcessService`（位于 `RobotgoFlow.Core/Services/`）把 `robotgo-flow.exe serve` 作为子进程启动，管理其标准输入输出：

- **启动**：`Start(workflowPath, fromStep, debug)` 构造参数 `serve <path> [--from N] [--debug]`，以重定向 stdin/stdout/stderr 启动进程，用 `BeginOutputReadLine()` 异步逐行读取 JSON 事件；
- **发送命令**：`SendCommand(cmd)` 把命令序列化为 JSON 写入子进程 stdin；
- **传入变量**：`ExecuteWithInputs(...)` 启动后发送 `set_inputs` 命令传入运行时变量；
- **停止**：`Stop()` 发送 `{"type":"stop"}`，等待 3 秒，若仍未退出则强杀（用 `Interlocked.Exchange` 防竞态）；
- **事件**：暴露 `OnEvent`、`OnStderr`、`OnExited` 供上层订阅。

子进程模式的优点是**隔离性好**：Go 引擎崩溃不会拖垮 WPF 主进程；缺点是有进程间通信开销。

### 15.2.2 DLL 模式（RobotgoNative）

DLL 模式把 Go 引擎编译为 `c-shared` 动态库（`robotgo-flow.dll`，编译自 `internal/ffi/` 包），WPF 通过 P/Invoke 直接调用。主要导出函数：

| 原生函数 | 作用 |
| --- | --- |
| `RobotgoInit()` | 初始化 DLL，返回版本字符串 |
| `RobotgoDestroy()` | 清理 |
| `RobotgoSetCallback(delegate)` | 注册事件回调 |
| `RobotgoExecute(path, fromStep, debug, inputsJson)` | 执行工作流，返回结果 JSON |
| `RobotgoStop()` | 取消执行 |
| `RobotgoPreload(path)` | 只加载工作流元信息、不执行 |
| `RobotgoFreeString(ptr)` | 释放 Go 分配的 C 字符串 |

`RobotgoNative` 采用**单例模式**（`Instance`），因为 DLL 全局状态不支持多实例。它在静态构造中注册回调、调用 `RobotgoInit()` 并设置 `IsAvailable`。

**UTF-8 处理**：`PtrToStringUTF8` 手动逐字节读取直到空结尾——因为 .NET Framework 4.8 没有内置该方法，而默认的 `LPStr` 编组会用 ANSI/GBK 解码从而破坏 UTF-8。这是跨 .NET 版本兼容的细节。

**线程编组**：`DispatchCallback` 让 WPF 把回调通过 `Dispatcher.Invoke` 编组到 UI 线程，保证界面更新的线程安全。

DLL 模式的优点是**无进程间开销、集成紧密**；缺点是 Go 崩溃可能影响宿主进程。

## 15.3 JSON-Line 协议详解

无论子进程模式还是 `serve` 命令，核心都是 **JSON-Line 协议**：一行一个 JSON 对象，通过 stdin/stdout 双向传递。

### 15.3.1 Go → 外部（事件）

`serve.go` 从 stdout 发出的事件类型：

| type | 关键字段 | 时机 |
| --- | --- | --- |
| `loaded` | `ok`、`name`、`total_steps`、`inputs[]` | 工作流加载完成 |
| `error` | `message` | 加载失败或协议错误 |
| `workflow_start` | `name`、`total_steps` | 执行开始 |
| `step_start` | `idx`、`total`、`name`、`estimated_sec` | 步骤开始 |
| `action_start` | `step_idx`、`idx`、`action`、`detail` | 动作开始 |
| `action_done` | `step_idx`、`idx` | 动作完成 |
| `step_done` | `idx`、`error?`、`screenshot_path?` | 步骤完成 |
| `workflow_done` | `ok`、`name`、`total_steps`、`error?`、`total_elapsed_sec` | 工作流结束 |
| `log` | `level`（info/warn/error）、`message`、`step_idx` | 日志 |
| `stopped` | — | 收到 stop 后 |

### 15.3.2 外部 → Go（命令）

从 stdin 接收的命令类型：

| type | 关键字段 | 用途 |
| --- | --- | --- |
| `set_inputs` | `values: {name: value}` | 传入运行时变量（仅当工作流有 `inputs`） |
| `stop` | — | 请求取消执行 |

### 15.3.3 协议交互流程

`serve.Run` 的时序：

1. 加载工作流，发出 `loaded` 事件（带 `inputs` 元信息，供 GUI 生成输入表单）；
2. 若有 `inputs`：**阻塞等待** `set_inputs` 命令，收到后调用 `ResolveInputs`；
3. 创建可取消的 `context`，启动一个 goroutine 从 stdin 读取 `stop` 命令；
4. 创建引擎、执行器，设置回调，开始执行；
5. 用 `io.Pipe` 包装 stdin，确保函数返回时读取协程能干净退出（防泄漏）。

C# 侧的 `ProtocolMessages.cs` 定义了与之对应的 `ServeEvent`、`InputInfo`、`ServeCommand` 记录类型，所有属性用 `[JsonPropertyName("snake_case")]` 与 Go 的输出字段对齐。

## 15.4 事件如何驱动界面

`RobotgoFlow.Tray/Services/ExecutionService.cs` 负责把引擎事件路由到界面：

| 事件 type | 界面动作 |
| --- | --- |
| `step_start` | 更新进度浮窗的步骤信息 |
| `action_start` | 更新当前动作与描述 |
| `step_done`（有 error） | 标记错误，显示错误截图 |
| `workflow_done`（成功） | 标记完成 → 2.5 秒后隐藏浮窗 → Toast 成功通知 |
| `workflow_done`（失败） | 标记错误 → 5 秒后隐藏 → Toast 失败通知 |
| `error` | 标记错误 → Toast 失败 |
| `stopped` | 复位运行状态 |

所有界面更新都通过 `Dispatcher.InvokeAsync` 编组到 UI 线程。进度数据由 `ProgressViewModel` 承载，浮窗（`ProgressOverlay`）、迷你面板（`MiniPanelWindow`）、托盘图标（`TrayIcon`）与 Toast 通知（`ToastNotifier`）共同构成用户可见的界面。

## 15.5 构建与运行 WPF 应用

回顾第 2 章的构建步骤：

```powershell
# 安装 .NET 10 SDK 后
cd src\csharp
dotnet build RobotgoFlow.Wpf.sln -c Release
```

产物中的 `robotgo-flow-tray.exe` 即可直接运行。若使用 DLL 模式，还需先构建 DLL：

```powershell
.\scripts\build.ps1 -Dll
```

并确保 `robotgo-flow.dll`（DLL 模式）或 `robotgo-flow.exe`（子进程模式）位于应用可访问的路径。

## 15.6 C# 项目结构速览

```
src/csharp/
├── RobotgoFlow.Core/            # 共享核心库
│   ├── Models/ProtocolMessages.cs   # JSON-Line 协议消息类型
│   ├── Services/
│   │   ├── GoProcessService.cs      # Go 子进程管理
│   │   ├── IEngineService.cs        # 引擎服务接口（统一抽象）
│   │   └── RobotgoNative.cs         # P/Invoke 原生绑定
│   └── Helpers/ArgumentEscaper.cs   # 命令行参数转义
├── RobotgoFlow.Tray/            # WPF 托盘应用
│   ├── App.xaml                     # 应用入口
│   ├── MiniPanelWindow.xaml         # 迷你面板
│   ├── ProgressOverlay.xaml         # 进度浮窗
│   ├── TrayIcon.cs                  # 托盘图标
│   ├── ToastNotifier.cs             # 桌面通知
│   ├── Services/ExecutionService.cs # 执行编排
│   └── ViewModels/                  # MVVM 视图模型
└── RobotgoFlow.Wpf.sln
```

`RobotgoFlow.Core` 采用 .NET 10 / .NET Framework 4.8 双目标，兼顾现代与兼容；`RobotgoFlow.Tray` 是 .NET 10 WPF 应用。

## 15.7 何时用 GUI、何时用 CLI

| 场景 | 推荐 |
| --- | --- |
| 无人值守、计划任务、服务器 | CLI（`run`/`serve`） |
| 交互式、给非技术用户使用 | WPF 托盘应用 |
| 需要实时可视化进度 | WPF 托盘应用 |
| 嵌入到脚本/流水线 | CLI |

两者共享同一个 Go 引擎与同一份 YAML 工作流，可以按需选择前端。

## 15.8 小结

本章我们讲解了 WPF 托盘应用与集成：它提供托盘图标、变量采集、实时进度浮窗与桌面通知，通过统一的 `IEngineService` 抽象支持「子进程模式」（`GoProcessService` 启动 `serve` 子进程）与「DLL 模式」（`RobotgoNative` 经 P/Invoke 调 `robotgo-flow.dll`）两种通信方式。我们详解了 JSON-Line 协议的事件与命令、`serve` 的交互时序、事件如何驱动界面，以及 C# 项目结构。下一章，我们从整体上剖析框架的架构与源码组织。
