---
layout: default
title: 第12章 - CLI 命令详解：run / record / capture / serve
---

# 第12章 - CLI 命令详解：run / record / capture / serve

robotgo-flow 的核心是一个命令行工具（`robotgo-flow.exe`），提供四个子命令。前面章节我们已经用过 `run` 和 `capture`，本章将系统、完整地讲解全部四个子命令及其参数，作为一份可随时查阅的命令参考。

## 12.1 命令总览

编译得到的 `robotgo-flow.exe` 通过第一个参数分发到不同子命令：

| 命令 | 作用 |
| --- | --- |
| `run <工作流文件>` | 执行一个 YAML 工作流 |
| `record` | 交互式录制工作流 |
| `capture [元素名]` | 交互式截取模板图片 |
| `serve <工作流文件>` | JSON-Line 协议服务（供 WPF GUI 调用） |

此外还有辅助命令：

| 命令 | 作用 |
| --- | --- |
| `version` / `-v` / `--version` | 打印版本号 |
| `-h` / `--help` / `help` | 显示帮助信息 |
| （无参数） | 显示帮助信息 |

在源码 `main.go` 中，程序根据 `os.Args[1]` 进行 `switch` 分发，各子命令再用 `flag.FlagSet` 解析自己的参数。

## 12.2 run：执行工作流

`run` 是最常用的命令，用于执行一个工作流文件：

```powershell
robotgo-flow.exe run <workflow.yaml> [flags]
```

### 12.2.1 参数

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--from N` | 整数 | 1（从头） | 从第 N 步开始执行（步骤从 1 开始编号） |
| `--debug` | 布尔 | false | 调试模式，每步成功后自动保存截图 |
| `--out dir` | 字符串 | 工作流所在目录 | 截图输出目录（默认 `screenshots/`） |

### 12.2.2 运行时变量的输入

如果工作流定义了 `inputs`，`run` 会在执行前逐个提示用户输入变量值：

- 对每个 `input` 弹出输入提示（`notify.InputBoxStd`）；
- 若 `input.mask` 为 `true`，输入内容隐藏显示；
- 若 `input.required` 为 `true` 且用户留空，则报错退出；
- 收集完毕后，调用 `exe.ResolveInputs(values)` 把 `$input.<name>` 替换为实际值。

### 12.2.3 常见用法

```powershell
# 完整执行
robotgo-flow.exe run workflow.yaml

# 从第 3 步开始（前面已手动完成）
robotgo-flow.exe run workflow.yaml --from 3

# 调试模式，每步截图
robotgo-flow.exe run workflow.yaml --debug

# 指定截图输出目录
robotgo-flow.exe run workflow.yaml --debug --out C:\logs\shots
```

### 12.2.4 --from 的价值

`--from N` 在调试长流程时非常实用：假设一个 10 步的工作流在第 7 步失败，你修好模板后不必从头再跑，直接 `--from 7` 从失败处恢复即可，节省大量时间。注意 `--from` 是按**步骤**（Step）定位的，这也是把动作合理组织成语义步骤的好处之一。

## 12.3 record：交互式录制

`record` 通过命令行逐步引导你录制一个工作流，边操作边生成 YAML 与模板截图：

```powershell
robotgo-flow.exe record [flags]
```

### 12.3.1 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--out` | `workflow.yaml` | 输出的 YAML 文件路径 |
| `--tpl-dir` | `templates` | 模板截图保存目录 |
| `--pipe` | false | JSON-Line 管道模式（供 GUI 集成） |

### 12.3.2 录制流程

按提示逐步进行：

1. 输入工作流元信息（名称、描述）；
2. 添加步骤（输入步骤名，留空则结束录制）；
3. 为步骤选择动作类型（支持多种动作）；
4. 交互式截取所需模板图片；
5. 保存为 YAML 文件。

录制器的详细用法（包括动作菜单、模板截取、运行时变量设置）会在第 13 章展开。

## 12.4 capture：截取模板

`capture` 用于单独截取一张模板图片，交互式框选屏幕区域：

```powershell
robotgo-flow.exe capture [元素名] [flags]
```

### 12.4.1 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--out-dir` | `templates` | 截图输出目录 |
| 位置参数（元素名） | `element` | 作为文件名的主干（如 `btn_login` → `btn_login.png`） |

### 12.4.2 交互流程

命令进入交互模式，提示你：

1. 把鼠标移动到目标区域的**左上角**，按回车确认；
2. 把鼠标移动到目标区域的**右下角**，按回车确认；
3. 框架自动框选这个矩形区域并保存为 PNG。

```powershell
# 截取一个名为 btn_login 的模板到 templates 目录
robotgo-flow.exe capture btn_login

# 指定输出目录
robotgo-flow.exe capture input_user --out-dir my_templates
```

## 12.5 serve：JSON-Line 协议服务

`serve` 启动一个基于 JSON-Line 协议的服务，通过标准输入输出（stdin/stdout）与外部程序（主要是 WPF 托盘应用）双向通信：

```powershell
robotgo-flow.exe serve <workflow.yaml> [flags]
```

### 12.5.1 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--from` | 1 | 从第 N 步开始（1-indexed） |
| `--debug` | false | 调试截图模式 |

### 12.5.2 工作方式

`serve` 一般不由人直接使用，而是被 WPF 托盘应用作为子进程启动。它的通信模型是：

- **Go → stdout**：以 JSON 行的形式输出各种事件（工作流开始、步骤开始、动作开始/完成、日志、工作流完成等）；
- **stdin → Go**：接收 JSON 命令（设置运行时变量 `set_inputs`、请求停止 `stop`）。

这套协议的完整细节会在第 15 章（WPF 集成）详解。这里只需知道：**`serve` 是把 CLI 引擎「服务化」，供图形界面驱动**。

## 12.6 version 与 help

```powershell
# 查看版本
robotgo-flow.exe version
robotgo-flow.exe -v
robotgo-flow.exe --version

# 查看帮助
robotgo-flow.exe -h
robotgo-flow.exe help
robotgo-flow.exe            # 无参数也显示帮助
```

版本号在编译时通过 `-ldflags "-X main.Version=..."` 注入，默认为 `dev`。

## 12.7 退出码与错误处理

`run`/`serve` 执行时，若工作流因 `abort` 策略失败，或运行时变量校验失败，进程会以非零退出码退出，并在终端打印错误信息（同时可能弹出错误提示框）。这使得 robotgo-flow 可以方便地嵌入到脚本、批处理或计划任务中——通过检查退出码判断自动化是否成功。

## 12.8 典型工作流的完整命令链

一个从零到运行的完整命令链通常是：

```powershell
# 1. 录制工作流（生成 YAML + 模板）
robotgo-flow.exe record --out login.yaml --tpl-dir templates

# 2. （可选）补充或重截某个模板
robotgo-flow.exe capture btn_extra --out-dir templates

# 3. 调试运行，观察每步截图
robotgo-flow.exe run login.yaml --debug

# 4. 从失败步骤恢复
robotgo-flow.exe run login.yaml --from 4

# 5. 正式运行
robotgo-flow.exe run login.yaml
```

## 12.9 小结

本章我们系统梳理了 robotgo-flow CLI 的四个子命令：`run` 执行工作流（`--from` 从指定步骤恢复、`--debug` 每步截图、`--out` 指定截图目录，并在执行前收集 `inputs`）；`record` 交互式录制工作流；`capture` 交互式截取单个模板；`serve` 提供 JSON-Line 服务供 GUI 调用。同时介绍了 `version`/`help` 辅助命令、退出码机制与典型命令链。下一章，我们深入 `record` 录制器与 `capture` 截图工具的实战细节。
