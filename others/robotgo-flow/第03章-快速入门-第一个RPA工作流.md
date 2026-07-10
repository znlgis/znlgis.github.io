---
layout: default
title: 第03章 - 快速入门：第一个 RPA 工作流
---

# 第03章 - 快速入门：第一个 RPA 工作流

环境搭建完成后，本章通过一个完整的实例，带你从零走通「编写 YAML → 截取模板 → 运行工作流」的完整闭环。学完本章，你将对 robotgo-flow 的工作方式建立起直观、感性的整体认识，后续章节再逐一深入细节。

## 3.1 一个工作流的三要素

用 robotgo-flow 完成一次自动化，本质上需要三样东西：

1. **一份 YAML 工作流文件**：描述「先做什么、后做什么」；
2. **一组模板截图（PNG）**：告诉框架「要点击/输入的 UI 元素长什么样」；
3. **一次运行命令**：让 CLI 读取 YAML 并执行。

它们之间的关系是：YAML 中通过模板路径引用 PNG 图片，运行时框架在屏幕上「找图」，找到后在图片中心执行相应操作。

## 3.2 目录结构约定

robotgo-flow 约定：**YAML 中引用的模板路径是相对于工作流 YAML 文件所在目录的**。推荐的项目结构如下：

```
project/
├── workflow.yaml
└── templates/
    ├── btn_login.png
    ├── input_username.png
    ├── input_password.png
    └── welcome.png
```

也就是说，把工作流放在项目根，把所有模板截图统一放在 `templates/` 子目录，YAML 中用 `templates/xxx.png` 这样的相对路径引用即可。

## 3.3 编写第一个工作流

我们以「自动登录一个网页表单」为例。新建 `workflow.yaml`，内容如下：

```yaml
name: "示例：登录表单"
description: "自动打开登录页并填写用户名密码"

settings:
  element_timeout: 10      # 等待元素出现的超时秒数
  on_error: abort          # 出错策略：abort / skip / retry
  human:
    enabled: false         # 暂不启用人类行为模拟

inputs:
  - name: username         # 运行时变量：用户名
    label: "用户名"
    required: true
  - name: password         # 运行时变量：密码
    label: "密码"
    required: true
    mask: true             # 密码输入时隐藏显示

steps:
  - name: "打开网站"
    actions:
      - open_url: "https://example.com/login"
      - wait: "templates/input_username.png"

  - name: "填写并登录"
    actions:
      - type:
          into: "templates/input_username.png"
          text: "$input.username"
      - type:
          into: "templates/input_password.png"
          text: "$input.password"
      - click: "templates/btn_login.png"
      - wait: "templates/welcome.png"
```

让我们逐段解读这份文件：

- **`name` / `description`**：工作流的元信息，`name` 必填。
- **`settings`**：全局设置。`element_timeout: 10` 表示等待元素最多 10 秒；`on_error: abort` 表示任何一步出错立即终止。
- **`inputs`**：定义了两个运行时变量 `username` 和 `password`。运行前 CLI 会提示你输入它们的值，`password` 因为 `mask: true` 会隐藏输入。
- **`steps`**：两个步骤。第一步打开登录页并等待用户名输入框出现；第二步依次输入用户名、密码，点击登录按钮，最后等待欢迎页出现。
- **`$input.username` / `$input.password`**：运行时变量占位符，执行时会被替换为你输入的实际值。

## 3.4 截取模板截图

工作流引用了 4 个模板：`input_username.png`、`input_password.png`、`btn_login.png`、`welcome.png`。我们需要把这些 UI 元素截取下来，保存到 `templates/` 目录。

有三种方式截图，最简单的是使用 `capture` 命令。先在浏览器中打开目标登录页，让相关元素处于可见状态，然后执行：

```powershell
.\robotgo-flow.exe capture input_username --out-dir templates
```

命令会以交互模式引导你：先把鼠标移动到目标区域（用户名输入框）的**左上角**，按提示确认；再移动到**右下角**，确认后自动框选并保存为 `templates/input_username.png`。

依此类推，把其余三个模板也截取好。截取模板时有几个要点：

- **保证分辨率一致**：应在实际运行的那台机器、相同的显示缩放（DPI）下截图；
- **避开可变内容**：模板中尽量不要包含会变化的文字、时间戳、光标等，选择稳定的图标或按钮边缘；
- **范围适中**：太小容易匹配到多个位置，太大容易因周边内容变化而匹配失败。

> 关于 `capture` 命令与录制器的完整用法，会在第 13 章详细讲解。这里先建立直观印象。

## 3.5 运行工作流

模板都准备好后，运行工作流：

```powershell
.\robotgo-flow.exe run workflow.yaml
```

由于 YAML 定义了 `inputs`，CLI 会先在命令行提示你依次输入：

```
用户名: your_name
密码: ********
```

输入完成后，框架开始执行：自动打开浏览器、导航到登录页、等待用户名框出现、输入用户名与密码、点击登录、等待欢迎页。整个过程你只需要「旁观」。

### 3.5.1 从指定步骤开始

如果前面的步骤已经手动完成，只想从第 2 步开始，可以：

```powershell
.\robotgo-flow.exe run workflow.yaml --from 2
```

`--from N` 表示从第 N 步开始（步骤从 1 开始编号）。

### 3.5.2 调试模式

想观察每一步执行后的屏幕状态，可以开启调试模式：

```powershell
.\robotgo-flow.exe run workflow.yaml --debug
```

调试模式下，框架会在每一步成功后自动截取全屏，保存到输出目录（默认为工作流所在目录的 `screenshots/`）。这对排查「到底是哪一步出了问题」非常有帮助。

## 3.6 执行过程中如何停止

如果执行过程中发现问题，想中途停下来，可以直接在命令行按 `Ctrl+C` 中断，或在 WPF 界面中点击停止。robotgo-flow 基于 Go 的 `context` 取消机制实现了安全停止，能保证内部协程干净退出，不会留下「僵尸」操作。

## 3.7 理解执行的内部流程

虽然我们只写了 YAML，但框架内部经历了一连串处理。用一张简化的流程图理解：

```
robotgo-flow run workflow.yaml
  │
  ├── config.Load()      → 读取并解析 YAML → Workflow 结构
  ├── engine.NewEngine() → 封装 robotgo（含模板缓存、浏览器定位）
  ├── executor.New()     → 绑定引擎与工作流
  │     ├── ResolveInputs()  → 把 $input.<name> 替换为你输入的值
  │     └── Run()            → 遍历步骤 → 对每个动作调用 action.Execute()
  │                              └── 动作内部调用引擎方法 → 最终调用 robotgo API
  └── 完成 / 失败
```

也就是说：**YAML 被解析成内存中的工作流对象 → 变量被替换 → 执行器逐步、逐动作地执行 → 每个动作最终落到 robotgo 的鼠标键盘调用上。** 后续章节会把这条链路上的每个环节都拆开讲透。

## 3.8 小结

本章我们完整地走通了一个 robotgo-flow 工作流的生命周期：理解了「YAML + 模板截图 + 运行命令」三要素，编写了一份登录表单的工作流，用 `capture` 截取了模板，用 `run` 命令执行（并演示了 `--from` 与 `--debug`），最后从宏观上梳理了框架内部的执行流程。你现在应该对 robotgo-flow 的工作方式有了直观认识。从下一章开始，我们将系统深入 YAML 工作流文件的每一个字段。
