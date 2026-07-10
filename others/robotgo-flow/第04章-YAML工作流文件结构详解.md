---
layout: default
title: 第04章 - YAML 工作流文件结构详解
---

# 第04章 - YAML 工作流文件结构详解

前几章我们已经写过一份工作流，本章将系统、完整地讲解 YAML 工作流文件的每一个字段：从顶层结构、运行时变量、全局设置，到步骤与动作的组织方式，以及框架的验证规则与默认值。掌握本章后，你就能读懂并写出任意复杂度的工作流。

## 4.1 顶层结构总览

一份完整的工作流由四个顶层部分构成：

```yaml
name: "工作流名称"          # 必填
description: "描述"         # 可选
inputs:                    # 可选：运行时变量定义
  - ...
settings:                  # 可选：全局设置
  ...
steps:                     # 必填：步骤列表
  - ...
```

对应到源码，`internal/config/workflow.go` 中的 `Workflow` 结构体定义了这四个字段：`Name`、`Description`、`Inputs`、`Settings`、`Steps`。其中 `Name` 与 `Steps` 是必填项，缺失会在加载时报错。

## 4.2 元信息：name 与 description

```yaml
name: "示例工作流"           # 必填，工作流的名称
description: "演示所有功能"   # 可选，描述信息
```

- **`name`**：工作流名称，必填。若为空，加载时验证会失败。它会显示在执行日志、进度界面与通知中。
- **`description`**：可选的描述信息，仅用于说明用途，不影响执行。

## 4.3 运行时变量：inputs

`inputs` 用于声明「运行时才确定的变量」，最典型的就是用户名、密码、验证码等不适合写死在 YAML 里的内容。

```yaml
inputs:
  - name: username           # 变量名，引用方式为 $input.username
    label: "用户名"           # 输入提示标签
    required: true           # 是否必填
    placeholder: "请输入用户名" # 占位符文本（可选）
    mask: false              # 是否隐藏输入（密码模式）
  - name: password
    label: "密码"
    required: true
    mask: true               # 密码类变量，隐藏显示
```

每个输入项对应源码中的 `InputSpec` 结构，字段含义如下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | 字符串 | 变量名，在动作中通过 `$input.<name>` 引用 |
| `label` | 字符串 | 输入提示标签，显示给用户 |
| `required` | 布尔 | 是否必填，为 `true` 时留空会报错 |
| `placeholder` | 字符串 | 占位符文本（可选） |
| `mask` | 布尔 | 是否隐藏输入内容（密码模式），可选 |

### 4.3.1 变量的引用与替换

在动作中使用 `$input.<变量名>` 占位符即可引用运行时变量，例如：

```yaml
- type: {into: "templates/input.png", text: "$input.username"}
- open_url: "https://example.com/user/$input.username"
```

执行前，框架会先提示用户输入所有 `inputs` 的值，然后通过 `executor.ResolveInputs` 把工作流中所有出现 `$input.<name>` 的地方替换为实际值。可被替换的位置包括：`type` 的 `text`/`into`、`open_url`、`prompt` 的 `title`/`message`/`into`、`confirm` 的 `title`/`message`、`notify` 的 `title`/`message`。

> **实现细节**：替换时，框架会把变量名**按长度从长到短**排序后再替换，以避免出现「`user` 是 `username` 的前缀」这类误替换问题。

## 4.4 全局设置：settings

`settings` 控制整个工作流的全局行为，全部字段可选，缺省时框架会填入默认值。

```yaml
settings:
  element_timeout: 10           # 等待元素出现的超时秒数（默认 10）
  on_error: abort               # 错误处理策略：abort / skip / retry（默认 abort）
  max_retries: 3                # retry 模式下的最大重试次数（默认 3）
  browser_refresh_delay: 3      # 刷新页面等待秒数
  browser_navigation_delay: 2   # 前进/后退等待秒数
  browser_page_load_delay: 3    # 打开 URL 等待秒数
  human:                        # 人类行为模拟设置
    enabled: false              # 是否启用
    speed: 1.0                  # 速度系数（0.1 ~ 5.0，默认 1.0）
    mistake_rate: 0.03          # 打字错误率（0.0 ~ 1.0，默认 0.0）
```

各字段的含义：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `element_timeout` | 10 | 等待元素出现的默认超时（秒），必须大于 0 |
| `on_error` | `abort` | 错误处理策略，取值 `abort`/`skip`/`retry` |
| `max_retries` | 3 | `retry` 模式下的最大重试次数 |
| `browser_refresh_delay` | 3 | 刷新页面后的等待时间 |
| `browser_navigation_delay` | 2 | 前进/后退后的等待时间 |
| `browser_page_load_delay` | 3 | 打开 URL 后的页面加载等待时间 |
| `human.enabled` | false | 是否启用人类行为模拟 |
| `human.speed` | 1.0 | 速度系数，范围 0.1 ~ 5.0 |
| `human.mistake_rate` | 0.0 | 打字错误率，范围 0.0 ~ 1.0 |

关于 `on_error` 与三种错误策略，会在第 14 章详细展开；关于 `human` 人类行为模拟，会在第 11 章深入。

> **关于浏览器延时的单位**：README 中的 YAML 注释以「秒」描述这几个浏览器延时字段（如「刷新页面等待秒数」）。在内部实现中，这些延时最终会转换为毫秒级的 `MilliSleep` 调用。使用时以 README 文档为准即可，实际效果就是「刷新/导航/打开页面后等待若干时间再继续」。

## 4.5 步骤：steps

`steps` 是工作流的主体，是一个有序的步骤列表。每个步骤（`Step`）由名称和动作列表组成：

```yaml
steps:
  - name: "步骤名称"       # 步骤名，用于日志与进度显示
    actions:              # 动作列表，至少一个
      - click: "templates/button.png"
      - wait: "templates/next.png"
```

对应源码中的 `Step` 结构体，包含 `Name` 与 `Actions` 两个字段。验证规则要求：

- 至少要有一个步骤；
- 每个步骤的 `name` 不能为空；
- 每个步骤至少要有一个动作。

**步骤的意义**：步骤是「进度」与「恢复」的基本单位。`--from N` 是按步骤定位的；进度界面按步骤显示；调试截图也是按步骤命名的（如 `debug_step_001.png`）。因此，合理地把动作组织成有语义的步骤（如「打开页面」「填写表单」「提交」），能让工作流更易读、更易调试。

## 4.6 动作：actions

每个步骤下的 `actions` 是一个动作列表。**每一个动作项必须且只能包含一个动作字段**——这是框架的一条重要验证规则（`validateSingleAction`）。也就是说，下面这样是错误的：

```yaml
# 错误示例：一个动作项里塞了两个动作
- click: "templates/a.png"
  type: {into: "templates/b.png", text: "x"}
```

正确的写法是把它们拆成两个独立的列表项：

```yaml
- click: "templates/a.png"
- type: {into: "templates/b.png", text: "x"}
```

robotgo-flow 共支持 **19 种动作类型**，按类别分组如下：

| 类别 | 动作字段 |
| --- | --- |
| 鼠标 | `click`、`double_click`、`right_click`、`drag` |
| 键盘 | `type`、`press`、`combo` |
| 等待 | `wait`、`wait_gone` |
| 滚动 | `scroll` |
| 浏览器 | `open_url`、`refresh`、`back`、`forward`、`switch_tab` |
| 延时 | `sleep` |
| 交互 | `prompt`、`confirm`、`notify` |

这 19 种动作会在第 5～9 章分类详解。这里先建立整体印象。

## 4.7 加载、验证与默认值

理解框架如何加载和校验 YAML，有助于你快速定位配置错误。`internal/config/loader.go` 中的 `Load` 函数流程如下：

1. **读取文件**：`os.ReadFile(path)` 读入原始字节；
2. **编码转换**：调用 `encoding.ToUTF8`，如果检测到是 GBK 编码，自动转为 UTF-8；
3. **解析**：`yaml.Unmarshal` 反序列化为 `Workflow` 结构；
4. **填充默认值**：`applyDefaults()` 为未设置的字段填入默认值（如 `element_timeout=10`、`human.speed=1.0`、`on_error=abort`、`max_retries=3` 等）；
5. **验证**：`Validate()` 执行多层校验。

`Validate` 会检查：

- `name` 不为空、至少一个步骤；
- 每个步骤名称不为空、至少一个动作；
- 每个动作非空、只设置一个动作字段；
- **动作引用的模板文件在磁盘上真实存在**（`validateTemplates`）；
- 坐标类动作的 `x`/`y` 字段完整（`validateMapFields`）；
- `prompt`/`confirm` 的 `title` 与 `message` 不为空；
- `element_timeout > 0`；
- 若启用人类模拟，`speed` 在 [0.1, 5.0]、`mistake_rate` 在 [0.0, 1.0]。

> **一个容易忽视的点**：由于验证阶段会检查模板文件是否真实存在，因此**运行工作流前必须先把所有模板截图准备好**，否则加载阶段就会失败。这也是为什么推荐先用 `capture`/`record` 截好模板，再运行。

## 4.8 一份「大而全」的参考示例

下面是一份涵盖了元信息、运行时变量、完整设置、多步骤的参考工作流，可作为你编写时的模板：

```yaml
name: "完整示例工作流"
description: "演示 inputs、settings 与多步骤"

inputs:
  - name: username
    label: "用户名"
    required: true
    placeholder: "请输入用户名"
    mask: false
  - name: password
    label: "密码"
    required: true
    mask: true

settings:
  element_timeout: 10
  on_error: retry
  max_retries: 3
  browser_refresh_delay: 3
  browser_navigation_delay: 2
  browser_page_load_delay: 3
  human:
    enabled: true
    speed: 0.8
    mistake_rate: 0.03

steps:
  - name: "打开登录页"
    actions:
      - open_url: "https://example.com/login"
      - wait: "templates/login_form.png"
  - name: "填写用户名"
    actions:
      - type: {into: "templates/input_user.png", text: "$input.username"}
  - name: "填写密码"
    actions:
      - type: {into: "templates/input_pass.png", text: "$input.password"}
  - name: "提交"
    actions:
      - click: "templates/btn_submit.png"
      - wait: {template: "templates/dashboard.png", timeout: 30}
```

## 4.9 小结

本章我们系统拆解了 YAML 工作流文件的完整结构：顶层的 `name`/`description`/`inputs`/`settings`/`steps` 四大部分；`inputs` 运行时变量的定义与 `$input.<name>` 替换机制；`settings` 全局设置的每个字段与默认值；步骤与动作的组织规则（尤其是「一个动作项只能有一个动作字段」）；以及框架的加载、编码转换、默认值填充与多层验证流程。下一章开始，我们进入动作详解，先从鼠标操作讲起。
