---
layout: default
title: 第十五章：核心架构：pi-tui 终端 UI 库
---

# 第十五章：核心架构：pi-tui 终端 UI 库

终端 UI（TUI）是 Pi 的"门面"——从你启动 `pi` 的那一刻起，编辑器、消息流、状态栏、模型选择器、文件模糊搜索、会话树导航……你在 Pi 中看到的每一个像素都由 pi-tui 驱动。如果说 pi-ai 是 Pi 的"大脑"（负责与 LLM 通信），pi-agent-core 是 Pi 的"神经系统"（负责 Agent 运行时），那么 pi-tui 就是 Pi 的"皮肤和肌肉"——它不仅负责渲染界面，还负责键盘输入、组件生命周期、主题系统、以及差分渲染这个让终端 UI"不闪烁"的核心魔法。

本章对 pi-tui 做源码级的深入讲解。读完这一章，你将不仅理解 Pi TUI 为什么能如此流畅，还能自己动手写自定义 TUI 组件——无论是为 Extension 添加一个进度条面板，还是为自己嵌入 SDK 的应用构建一个完整的终端界面。

> **前置章节提醒：** 如果你还没读过第六章（交互式 TUI 深入），建议先读那一章——它从用户视角讲解了 Pi TUI 的所有交互功能和操作方式。本章从**开发者视角**讲解 pi-tui 的内部架构、设计原理和组件开发。

---

## 15.1 pi-tui 包概述

### 15.1.1 在 monorepo 中的位置

Pi 是一个 TypeScript monorepo，根目录下 `packages/` 包含 5 个核心包。pi-tui 是其中之一：

```text
packages/
├── ai/          → pi-ai：统一多供应商 LLM API
├── agent/       → pi-agent-core：Agent 运行时
├── coding-agent/→ pi-coding-agent：交互式 CLI 入口
├── tui/         → pi-tui：终端 UI 库          ← 本章主角
└── orchestrator/→ pi-orchestrator：工作流编排
```

| 属性 | 值 |
|------|-----|
| 源目录 | `packages/tui/` |
| npm 包名 | `@earendil-works/pi-tui` |
| 语言 | TypeScript（100%） |
| 外部依赖 | 极少数——核心渲染引擎全自研，只有如 Vim 仿真器等边缘功能有少量社区依赖 |
| 上级依赖方 | `pi-coding-agent`（CLI 入口直接引用）、`pi-agent-core`（消息渲染接口引用）、各类 Extensions（通过 `ctx.ui` API 引用） |

### 15.1.2 核心使命

pi-tui 是一个**差分渲染的保留模式终端 UI 框架**。用一句技术术语定位：

> pi-tui = **Retained Mode Component Tree** + **Differential Rendering Engine** + **Synchronized Output**
>
> （保留模式组件树 + 差分渲染引擎 + 同步输出转义序列）

它要解决的根本问题是：**如何在一个只能逐行打印字符的终端里，构建出接近 GUI 的交互体验——有组件、有状态、有事件、但不闪烁？**

传统 CLI 程序的输出方式是"立即模式"（Immediate Mode）：`console.log` 一行，屏幕上多一行，过去的内容滚出视口就再也管不着了。而 pi-tui 的做法是"保留模式"（Retained Mode）：维护一棵跨越帧的组件树，每一帧只重绘**变化了的部分**，未变化的部分原样保留。

### 15.1.3 为什么自己造轮子

在决定自己写 pi-tui 之前，Mario 考察了现有 Node.js 终端 UI 库的几个选项，最终全部否决。原因如下：

| 备选方案 | 否决原因 |
|----------|----------|
| **[Ink](https://github.com/vadimdemedes/ink)**（React 风格 TUI） | Ink 使用 React reconciler 做终端渲染，本质是把终端当 DOM 用。这意味着：① 依赖 React 全套（体积大）；② React 的函数式/声明式组件模型对于"流式增量文本逐 token 追加"这种场景非常不自然——你不可能在每次收到 3 个 token 时就重新构造一棵新的虚拟 DOM 树；③ Ink 接管整个终端（全屏模式），Pi 要求的是"保留原生终端滚动缓冲区的增量式 TUI"。 |
| **[Blessed](https://github.com/chjj/blessed)** | 经典的终端 UI 库，但已**停止维护**多年。依赖过时版本的 Node.js API，不支持同步输出 escape 序列（CSI ?2026h/?2026l），没有差分渲染。 |
| **[opentui](https://github.com/opentui/opentui)** | 设计理念不错，但项目尚不成熟，API 不稳定，未达到生产就绪标准（production-ready）。 |

更重要的是，pi-tui 需要满足一个**硬性约束**：**不要接管整个终端**。大多数 TUI 库（包括 Ink、Blessed、ncurses 绑定等）的操作模式是"全屏渲染"——它们清空终端、进入替代屏幕缓冲区（alternate screen buffer），然后在那里构建 UI。这种模式的问题在于：

- 你的终端原生的**滚动历史（scrollback）全部丢失** ——退出 TUI 后，之前的输出已经不存在了。
- 你无法用终端的原生**搜索**（Cmd+F / Ctrl+Shift+F）浏览历史消息。
- 你无法用终端的**选择-复制**功能选中"已经滚出当前视口"的旧输出。

pi-tui 的做法截然不同：它像普通 CLI 程序一样**追加内容到终端的主屏幕缓冲区**。当你向上滚动终端的滚动条时，你能看到 Pi 启动时打印的全部历史消息——就像任何一个标准 CLI 程序一样。这种"增量式 TUI"（incremental TUI）是 Pi 对终端交互体验最核心的设计决策之一。

---

## 15.2 设计选择

pi-tui 的设计围绕四个核心原则展开。理解这些原则，你就能理解为什么 pi-tui 的 API 长成这个样子、以及它与所有现有 TUI 库的差异从何而来。

### 15.2.1 保留模式 UI（Retained Mode）

**立即模式（Immediate Mode）vs 保留模式（Retained Mode）** 是 UI 编程中最基本的二分法之一：

| 模式 | 工作方式 | 代表 |
|------|----------|------|
| **立即模式** | 每帧重绘整个界面。程序不保存组件状态——"状态在调用栈上"。 | `console.log`、ImGui 库 |
| **保留模式** | 组件树跨帧持久化。每个组件有身份（identity）和状态（state）。只更新变化的部分。 | DOM、React、Qt、SwiftUI |

pi-tui 选择了**保留模式**。这意味着：

- **每个组件是一个有明确身份的 TypeScript 对象**。组件不会在每次渲染后被销毁重建——同一个 `Editor` 组件实例会从会话开始存活到会话结束。
- **组件树是持久化的数据结构**。`TUI` 实例上挂着一棵树，每一帧渲染只是遍历这棵树找出"变化的叶子"，而不是重建整棵树。
- **状态随组件共存**。编辑器的光标位置、滚动偏移、输入文本——这些都存储在组件实例的字段上，不需要通过全局状态管理器来协调。

选择保留模式有多重理由：

1. **流式文本追加**。当模型逐 token 流式输出一段文本时，传统立即模式必须"整行重绘"。而 pi-tui 只需要在已有文本后面追加新字符——这天然适合保留模式的增量更新。
2. **组件状态复杂**。Editor 组件有光标、选区、滚动、Vim 模式状态、Undo 历史。如果每帧重建，这些状态的保存和恢复将极其复杂。
3. **减少终端写入**。在终端里"写入字符"是一个有系统调用开销的操作（通过 Node.js 的 `process.stdout.write`）。保留模式让你能精确计算"最小写入集合"——只写变化的部分。

### 15.2.2 不接管整个终端

这是 pi-tui 与所有传统 TUI 库最根本的区别。

| 传统 TUI（Ink / Blessed / ncurses） | pi-tui |
|--------------------------------------|--------|
| 进入替代屏幕缓冲区（`smcup`） | 使用**主屏幕缓冲区** |
| 清空终端，全屏重绘 | **像普通 CLI 一样追加输出** |
| 退出后滚动历史丢失 | 随时向上滚动查看全部历史 |
| 鼠标拖拽选择受 TUI 拦截 | 原生终端选择-复制完全可用 |
| 终端原生搜索（Cmd+F）不可用 | 原生搜索完整可用 |

pi-tui 的实现方式是将终端屏幕划分为两个区域：

```text
┌──────────────────────────────────────────────┐
│                                              │
│  滚动缓冲区区域（Scrollback Area）             │
│  ──────────────────────────────────────────  │
│  历史消息、工具输出等——这些内容"冻结"在上方，  │
│  终端原生滚动/搜索/选择均可操作它们            │
│                                              │
├──────────────────────────────────────────────┤
│  动态区域（Live Area）                        │
│  ──────────────────────────────────────────  │
│  当前正在流式渲染的消息 + 编辑器 + 底部栏       │
│  这一部分每一帧都可能变化，pi-tui 只刷新此区域  │
│                                              │
└──────────────────────────────────────────────┘
```

**滚动缓冲区区域**的内容是"已完成的输出"——一旦一条消息被完整渲染并确认不再变化，它就被"提升"（promote）到滚动缓冲区区域，此后不再被 pi-tui 管理（你看到的它是原生的终端文本，可以直接搜索和复制）。

**动态区域**的内容是"当前正在变化的组件"——模型正在流式输出的消息、编辑器光标、底部栏数值。pi-tui 的差分渲染引擎只对动态区域做追踪和更新。

### 15.2.3 差分渲染（Differential Rendering）

差分渲染是 pi-tui 性能的核心。它遵循一个简单的原则：

> **只重绘变化的部分。如果某行内容没有改变，就不要向终端写入任何东西。**

具体流程如下：

1. **构建当前帧的输出缓冲**：遍历组件树，让每个组件生成它当前状态的文本表示（字符矩阵 + ANSI 转义序列）。
2. **与上一帧的输出缓冲逐行比较**：对于每一行，比较文本内容和 ANSI 样式。如果完全相同——跳过此行的终端写入。
3. **只输出差异**：对于变化的行，移动光标到对应位置（通过 ANSI 光标定位序列），再写入新内容。
4. **同步输出包装**：将所有终端写入命令用 `CSI ?2026h`（开始同步输出）和 `CSI ?2026l`（结束同步输出）包裹（见下一节）。

对于流式文本追加（最常见场景），差分渲染的开销极小：一条 500 行的消息，模型每追加 5 个 token，pi-tui 只需要更新**最后 1~3 行**——其余 497 行完全不动。

### 15.2.4 同步输出转义序列（CSI ?2026h / ?2026l）

终端渲染有一个根本问题：**每一次 `process.stdout.write()` 都是独立的系统调用，终端模拟器可能在两次写入之间刷新帧**。这导致"撕裂"（tearing）——你看到上半行是旧内容、下半行是新内容，闪烁刺眼。

现代终端模拟器引入了**同步输出**（Synchronized Output）机制来解决这个问题。它使用一对 ANSI escape 序列：

```
ESC [ ? 2026 h    ← 开始同步输出（Begin Synchronized Update）
... 批量写入所有变化行 ...
ESC [ ? 2026 l    ← 结束同步输出（End Synchronized Update）
```

当终端模拟器接收到 `CSI ?2026h` 后，它会**暂不渲染**后续的所有输出，直到收到 `CSI ?2026l` 时才一次性把缓冲区的内容绘制到屏幕上。这样用户看到的是一次"原子性"的画面更新——没有撕裂，没有闪烁。

pi-tui 在每一帧的差分渲染输出中都用这对序列包裹。其结果是：即便是 60fps 的加载动画（Loader 组件），在支持同步输出的终端（Ghostty、iTerm2、Kitty、Windows Terminal 1.22+、WezTerm 等）上也几乎看不出任何闪烁。

**终端兼容性退路：** 如果终端模拟器不支持同步输出（如老旧版本的 Terminal.app、VS Code 内置终端旧版），`CSI ?2026h` 和 `CSI ?2026l` 会被忽略。pi-tui 仍能正常工作——只是可能会有轻微闪烁。pi-tui 在启动时检测终端能力并据此调整渲染策略。

---

## 15.3 核心类

pi-tui 的类型层级可以用三个核心类概括：

### 15.3.1 TUI ——主界面管理器

`TUI` 是 pi-tui 的**根对象**。它是整个 UI 渲染循环的入口，同时也是外部代码（pi-coding-agent）与 TUI 系统交互的唯一接口。

```typescript
class TUI {
  // 组件树
  readonly root: Container;

  // 终端实例
  readonly terminal: ProcessTerminal;

  // 渲染方法
  render(): void;
  tick(): void;

  // 尺寸信息
  get width(): number;
  get height(): number;

  // 生命周期
  start(): void;
  stop(): void;
  destroy(): void;

  // 事件
  on(event: "resize", handler: (cols: number, rows: number) => void): void;
  on(event: "key", handler: (key: Key) => void): void;
  on(event: "mouse", handler: (event: MouseEvent) => void): void;

  // 主题
  setTheme(theme: Theme): void;
  getTheme(): Theme;
}
```

**职责：**

- 管理终端连接（`ProcessTerminal` 实例）
- 持有组件树的根节点（`root: Container`）
- 驱动渲染循环（`tick()` 在每帧被调用）
- 处理终端 resize 事件（更新组件布局）
- 分发键盘和鼠标事件到组件树
- 管理主题系统

pi-coding-agent 端的典型使用方式：

```typescript
// 在 pi-coding-agent 中
const tui = new TUI({
  stdin: process.stdin,
  stdout: process.stdout,
  theme: loadTheme("dark"),
});

// 设置底部状态栏
tui.root.addChild(new Footer({ session, modelRegistry }));

// 设置消息区域
const messageContainer = new Container({ grow: true });
tui.root.addChild(messageContainer);

// 设置编辑器
const editor = new Editor({ onSubmit: handleSubmit });
tui.root.addChild(editor);

// 启动渲染循环
tui.start();
```

### 15.3.2 ProcessTerminal ——终端实例

`ProcessTerminal` 是对底层 Node.js 终端 I/O 的抽象封装。它不直接使用 `process.stdout` / `process.stdin`，而是通过传入的流来操作——这使得 pi-tui 可以被嵌入到任意 Node.js 流中（如 RPC 模式的 stdin/stdout、WebSocket 转发的终端等）。

```typescript
class ProcessTerminal {
  constructor(options: {
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    // 可选：是否启用同步输出（默认根据终端能力自动检测）
    synchronizedOutput?: boolean;
  });

  // 输出方法
  write(text: string): void;
  writeLine(text: string): void;

  // 光标控制
  moveTo(row: number, col: number): void;
  clearLine(): void;
  clearDown(): void;

  // 缓冲区管理
  beginSynchronizedUpdate(): void;
  endSynchronizedUpdate(): void;

  // 尺寸
  get columns(): number;
  get rows(): number;

  // 输入
  onKey(handler: (key: Key) => void): void;
  onMouse(handler: (event: MouseEvent) => void): void;
  onResize(handler: (cols: number, rows: number) => void): void;
}
```

**职责：**

- 管理 Node.js 原始终端流（stdin、stdout）的 raw mode 切换（进入 raw mode 以获得逐键输入而非逐行缓冲）
- 解析 ANSI escape 序列（键盘事件、鼠标事件、终端响应等）
- 输出 ANSI escape 序列（光标定位、颜色、同步输出控制等）
- 缓存终端尺寸，在 resize 时通知上层
- 处理 Windows 平台的终端兼容性差异

### 15.3.3 组件系统架构

pi-tui 的组件系统基于一个核心抽象类 `Component`，以及一系列具体组件（`Text`、`Editor`、`Box` 等）。组件树的根是一个 `Container` 特殊化实例。

```typescript
// 组件基类（简化版）
abstract class Component {
  // 唯一标识
  id: string;

  // 布局属性
  parent: Container | null;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  grow: number;       // 弹性增长权重（类似 CSS flex-grow）
  shrink: number;     // 弹性收缩权重

  // 可见性
  visible: boolean;

  // 核心方法
  abstract render(): RenderOutput;
  abstract layout(availableWidth: number, availableHeight: number): void;

  // 生命周期钩子
  onMount(): void;
  onUnmount(): void;
  onResize(cols: number, rows: number): void;

  // 事件处理
  onKey(key: Key): boolean;     // 返回 true 表示"事件已消费，停止冒泡"
  onMouse(event: MouseEvent): boolean;
  focus(): void;
  blur(): void;

  // 标记为"需要重绘"
  markDirty(): void;
  isDirty(): boolean;
}
```

**`RenderOutput` 数据结构：**

```typescript
interface RenderOutput {
  lines: string[];          // 每一行的文本内容（包含 ANSI 转义序列）
  cursor?: {                // 可选：光标位置
    row: number;
    col: number;
  };
}
```

**`Container` 容器组件：**

```typescript
class Container extends Component {
  children: Component[];
  direction: "vertical" | "horizontal";  // 布局方向
  gap: number;                            // 子组件间距

  addChild(child: Component): void;
  removeChild(child: Component): void;
  clearChildren(): void;
}
```

**布局算法：** pi-tui 使用类似 CSS Flexbox 的弹性布局算法（但简化为垂直/水平一维）。每个组件声明自身的 `minHeight` / `minWidth` 和 `grow` / `shrink` 权重，Container 在 `layout()` 调用时计算每个子组件的实际尺寸。这不同于 Ink 的 Yoga 布局引擎——pi-tui 的布局系统是针对"一维线性终端布局"场景定制的轻量实现。

**脏标记（Dirty Flag）机制：**

当组件状态改变时（如编辑器内容变化、消息文本追加），组件调用 `this.markDirty()`。渲染循环在 `tick()` 中遍历组件树，只对标记为"脏"的组件调用 `render()`。这避免了对整个组件树做无意义的渲染计算。

---

## 15.4 内置组件详解

pi-tui 提供了丰富的内置组件。每个组件都继承自 `Component` 基类，遵循统一的 `render()` / `layout()` / 生命周期模式。下面是所有内置组件的完整说明。

### 15.4.1 Text ——文本显示

最基础的组件，渲染一段静态文本。支持 ANSI 转义序列。

```typescript
class Text extends Component {
  constructor(text: string, options?: {
    wrap?: boolean;       // 是否自动换行（默认 true）
    align?: "left" | "center" | "right";
  });
  setText(text: string): void;
  getText(): string;
}
```

**使用示例：**

```typescript
const title = new Text("=== Pi 编码助手 ===", { align: "center" });
container.addChild(title);

// 动态更新
title.setText("=== 新会话已开始 ===");
title.markDirty(); // 触发重绘
```

**典型应用：** 启动头部文本、章节标题、静态提示信息。

### 15.4.2 TruncatedText ——截断文本

当文本宽度超过可用空间时，自动截断并追加省略号（`…`）。适合在有限空间内展示文件路径、长标识符等。

```typescript
class TruncatedText extends Text {
  constructor(text: string, options?: {
    truncatePosition?: "start" | "middle" | "end";  // 省略号位置（默认 "end"）
  });
}
```

**使用示例：**

```typescript
// 底部栏中展示工作目录——空间有限，长路径自动截断
const cwdDisplay = new TruncatedText(process.cwd(), {
  truncatePosition: "start",  // 截断开头："…/very/deep/nested/project/src"
});
footer.addChild(cwdDisplay);
```

**典型应用：** 底部栏路径显示、文件选择器中长文件名显示。

### 15.4.3 Input ——输入框

单行文本输入框，提供光标、选区、基本的 Emacs 风格编辑键位。

```typescript
class Input extends Component {
  value: string;

  constructor(options?: {
    placeholder?: string;
    value?: string;
    password?: boolean;        // 密码模式（输入回显为 * 或 ·）
    onSubmit?: (value: string) => void;
    onChange?: (value: string) => void;
    validator?: (value: string) => boolean;
  });
}
```

**使用示例：**

```typescript
const nameInput = new Input({
  placeholder: "请输入你的名字",
  onSubmit: (value) => {
    console.log(`你好，${value}！`);
  },
  validator: (value) => value.length > 0,  // 不允许空值
});
container.addChild(nameInput);
```

**典型应用：** 对话框中的文本输入（如 `/name` 命名会话、创建分支名）、扩展中的自定义输入面板、`/login` 时的 API Key 输入。

**与 Editor 的区别：** `Input` 是简单的单行输入框，只支持基本编辑键位（`Backspace`、`Arrow`、`Home`/`End`、`Ctrl+A/E/K/W`）。`Editor` 是多行富文本编辑器（详见下一节）。

### 15.4.4 Editor ——编辑器（Pi 主编辑器的基础）

`Editor` 是 pi-tui 中最复杂、代码量最大的内置组件——它就是你在 Pi 中键入 prompt 的那块区域。它实现了多行编辑、模糊文件搜索（`@` 触发）、路径补全（`Tab` 触发）、消息队列（Steering / Follow-up）、思考级别边框颜色、Vim 模式、外部编辑器回调（`Ctrl+G`）、斜杠命令补全（`/` 触发）等全部编辑器高级功能。

```typescript
class Editor extends Component {
  constructor(options: {
    onSubmit: (text: string, mode: "normal" | "steering" | "follow-up") => void;
    onCancel?: () => void;
    onModelSwitch?: () => void;
    onThinkingCycle?: () => void;
    onExternalEditor?: () => void;
    fileSearchProvider?: (query: string) => Promise<FileEntry[]>;
    pathCompleteProvider?: (partial: string) => Promise<string[]>;
    slashCommandProvider?: (query: string) => Promise<SlashCommand[]>;
    placeholder?: string;
    initialText?: string;
    borderColor?: Color;
  });

  // 编辑器内容管理
  getText(): string;
  setText(text: string): void;
  clear(): void;

  // 多行支持
  insertNewLine(): void;

  // 队列文本标记
  getQueuedTexts(): { text: string; mode: "steering" | "follow-up" }[];
  recoverQueuedText(): { text: string; mode: "steering" | "follow-up" } | null;

  // 思考级别边框颜色
  setBorderColor(color: Color): void;

  // Vim 模式
  setEditorMode(mode: "default" | "vim"): void;
}
```

Editor 的内部状态极其复杂，包含以下子系统：

| 子系统 | 涉及的状态 |
|--------|-----------|
| **文本缓冲** | 多行文本数组、光标行列位置、选区起止位置、滚动偏移 |
| **Undo/Redo** | 操作历史栈（增、删、替换等原子操作），支持无限 Undo |
| **文件搜索** | `@` 触发后的搜索查询字符串、过滤结果列表、选中项索引 |
| **路径补全** | `Tab` 触发后的补全候选列表、当前选中项 |
| **斜杠命令** | `/` 触发后的命令查询字符串、候选命令列表 |
| **消息队列** | 排队的 Steering 消息列表、Follow-up 消息列表 |
| **Vim 仿真器** | 当前模式（Normal / Insert / Visual）、操作符挂起（operator-pending）、寄存器内容 |
| **外部编辑器** | 临时文件路径、文件监视句柄 |

**Editor 内部的 Vim 仿真器：**

pi-tui 内置了一个精简但实用的 Vim 仿真器。它不是通过绑定外部 Vim 进程实现的（那样无法获取编辑器状态），而是直接在 TypeScript 中实现了 Vim 的核心模态编辑逻辑。支持的操作包括：

- Normal 模式导航：`h`、`j`、`k`、`l`、`w`、`b`、`e`、`0`、`$`、`gg`、`G`
- 编辑操作：`i`、`a`、`o`、`O`、`x`、`dd`、`yy`、`p`、`P`、`u`、`Ctrl+R`
- 文本对象：`ciw`、`diw`、`ci"`、`ci(`、`ci[` 等
- 搜索：`/pattern`、`?pattern`、`n`、`N`
- Visual 模式：`v`（字符选择）、`V`（行选择）

**不支持：** 宏录制（`q`）、标记（`m`）、全局命令（`:g`）、高级寄存器、插件系统。它专注于"终端中写 prompt"这个场景所需的核心子集。

**使用示例（完整嵌入 Editor）：**

```typescript
import { Editor } from "@earendil-works/pi-tui";

const editor = new Editor({
  placeholder: "向 Pi 提问或输入指令…",
  onSubmit: (text, mode) => {
    if (mode === "normal") {
      session.sendMessage(text);
    } else if (mode === "steering") {
      session.sendSteeringMessage(text);
    } else if (mode === "follow-up") {
      session.sendFollowUpMessage(text);
    }
  },
  fileSearchProvider: async (query) => {
    // 在当前项目中模糊搜索文件
    return await fuzzySearchFiles(process.cwd(), query);
  },
  pathCompleteProvider: async (partial) => {
    // Tab 路径补全
    return await completePath(process.cwd(), partial);
  },
  slashCommandProvider: async (query) => {
    // 斜杠命令补全
    return await filterSlashCommands(query);
  },
});

tui.root.addChild(editor);
```

**Editor 的事件流：**

1. 用户在物理键盘上按下一个键 → `ProcessTerminal` 解析为 `Key` 对象
2. `Key` 对象沿组件树分发（从根到叶子，通过 `onKey()` 链）
3. `Editor.onKey()` 接收到 `Key` 事件：
   - 检查是否处于**文件搜索模式**（`@` 触发）→ 如果是，处理搜索相关按键
   - 检查是否处于**斜杠命令模式**（`/` 触发）→ 如果是，处理命令补全相关按键
   - 检查是否处于**Vim Normal/Visual 模式** → 如果是，由 Vim 仿真器处理
   - 否则：Insert 模式标准编辑处理
4. 如果 `Key` 不是编辑器内部消费的（如 `Enter` 发送消息）→ 返回 `false`，让事件冒泡给父组件（最终由 `TUI.onKey()` 的全局快捷键处理器接盘）

### 15.4.5 Markdown ——Markdown 渲染

将 Markdown 文本渲染为 ANSI 样式的终端输出。支持代码块语法高亮、标题、粗体、斜体、列表等。

```typescript
class Markdown extends Component {
  constructor(options: {
    content: string;              // Markdown 源文本
    codeBlockTheme?: string;      // 代码块语法高亮主题（默认 "dark"）
    maxHeight?: number;           // 最大渲染高度，超出部分折叠
    collapsed?: boolean;          // 初始是否折叠
    renderInlineCode?: boolean;   // 是否渲染行内代码样式（默认 true）
  });

  setContent(markdown: string): void;
  appendContent(markdown: string): void;  // 流式追加（用于模型输出现场）
  toggleCollapse(): void;
}
```

**流式渲染支持：** `Markdown` 组件的一个关键特性是 `appendContent()` 方法。模型在输出 Markdown 格式的回复时，文本是逐 token 到达的。`appendContent()` 增量解析新到达的文本并追加到渲染缓冲中，而差分渲染引擎确保只有新增的行被写入终端。这意味着你看到模型"写" Markdown 的过程如同打字机一般流畅。

**使用示例：**

```typescript
const markdownView = new Markdown({
  content: "",
  collapsed: false,
});

// 模型流式输出时增量追加
providerStream.on("token", (token) => {
  markdownView.appendContent(token);
});

// 最终内容
console.log(markdownView.getContent());
// 渲染输出为 ANSI 样式文本
```

**支持的 Markdown 特性：**

| 特性 | 终端渲染效果 |
|------|-------------|
| `# 标题` | 粗体 + 下划线 + 高亮色 |
| `**粗体**` | ANSI 粗体属性 |
| `*斜体*` | ANSI 斜体属性 |
| `` `行内代码` `` | 反向色背景 + 细体 |
| `` ```language ``` 代码块 `` | 语法高亮（支持 TypeScript、Python、Rust、Bash、JSON 等 50+ 语言） + 边框 |
| `- 列表项` | `  • 列表项` 缩进 |
| `1. 有序列表` | `  1. 列表项` 缩进 |
| `> 引用块` | `│ 引用文本` 左边框 |
| `---` 分割线 | 全宽水平线（`─` 字符） |
| `` [链接](url) `` | 仅显示链接文本（终端不支持点击）；或显示为 `链接文本 (url)` |

**代码块语法高亮：** 使用基于 TextMate 语法的高亮引擎，预装了 50+ 语言的 grammar 文件。高亮结果使用 16 色 ANSI 转义序列映射到终端的实际颜色（由当前主题决定）。

**典型应用：** 消息区域中模型回复的渲染（这是 pi-tui 中使用频率最高的组件之一）。

### 15.4.6 Loader ——加载动画

显示一个旋转的加载动画（spinner），通常用于表示等待中的操作。

```typescript
class Loader extends Component {
  constructor(options?: {
    text?: string;                     // 旁边的文字（如 "正在思考…"）
    frames?: string[];                 // 自定义动画帧（默认使用内置的 spinner 字符集）
    interval?: number;                 // 帧切换间隔（毫秒，默认 80）
    color?: Color;                     // 动画颜色
  });

  setText(text: string): void;
  start(): void;
  stop(): void;
}
```

**使用示例：**

```typescript
const loader = new Loader({
  text: "正在连接 API…",
  color: "yellow",
});
container.addChild(loader);
loader.start();

// 操作完成后
await connectToAPI();
loader.setText("连接成功！");
loader.stop();
```

**内置 spinner 帧序列：**

```text
⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
```

你可以在 `options.frames` 中传入自定义帧序列（如 `["/", "-", "\\", "|"]`）。

**差分渲染与 Loader：** Loader 组件是一个很好的"差分渲染展示案例"。每一帧只有 spinner 字符变化（1 个字符），周围的文本完全不变。pi-tui 的差分引擎在每一帧只重写那一个字符——在 60fps 下，每次只做一次 `process.stdout.write` 调用，终端几乎无闪烁。

### 15.4.7 CancellableLoader ——可取消加载器

`Loader` 的增强版，附加了一个"取消"提示和按键绑定。

```typescript
class CancellableLoader extends Loader {
  constructor(options: {
    text: string;
    cancelKey?: string;          // 取消按键提示（默认 "Esc"）
    onCancel?: () => void;       // 取消回调
    color?: Color;
    interval?: number;
  });

  isCancelled(): boolean;
}
```

**使用示例：**

```typescript
const loader = new CancellableLoader({
  text: "正在生成代码…按 Esc 取消",
  cancelKey: "Esc",
  onCancel: () => {
    abortController.abort();
    loader.setText("已取消");
  },
});

container.addChild(loader);
loader.start();

try {
  const result = await generateCode(abortController.signal);
  loader.setText(`生成完成：${result.summary}`);
} catch (err) {
  if (loader.isCancelled()) {
    loader.setText("操作已取消");
  }
} finally {
  loader.stop();
}
```

**典型应用：** 长时间的模型推理过程（"正在生成…按 Esc 取消"）、大文件读取操作中。

### 15.4.8 SelectList ——选择列表

可交互的选择列表——列表项、键盘导航、搜索过滤。

```typescript
interface SelectListOption {
  id: string;
  label: string;
  description?: string;        // 辅助说明文本
  disabled?: boolean;          // 是否禁用（灰色，不可选）
}

class SelectList extends Component {
  constructor(options: {
    title: string;
    options: SelectListOption[];
    onSelect?: (id: string) => void;
    onCancel?: () => void;
    filterable?: boolean;       // 是否支持打字搜索过滤（默认 true）
    multiple?: boolean;         // 是否多选（默认 false）
    defaultSelected?: string[]; // 默认已选中的 id 列表（仅多选模式）
  });

  getSelected(): string | string[] | undefined;
  setOptions(options: SelectListOption[]): void;
  setTitle(title: string): void;
}
```

**使用示例：**

```typescript
// 模型选择器
const modelPicker = new SelectList({
  title: "选择模型",
  options: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", description: "Anthropic 出品，平衡质量与速度" },
    { id: "claude-opus-4-20250514", label: "Claude Opus 4", description: "最高质量，适合复杂任务" },
    { id: "gpt-4o", label: "GPT-4o", description: "OpenAI 多模态旗舰模型" },
    { id: "deepseek-chat", label: "DeepSeek V3", description: "高性价比国产模型" },
  ],
  filterable: true,
  onSelect: (id) => {
    switchModel(id);
  },
});
container.addChild(modelPicker);
```

**键盘交互：**

| 按键 | 功能 |
|------|------|
| `↑` / `↓` | 上下移动高亮项 |
| `PgUp` / `PgDn` | 翻页 |
| `Home` / `End` | 跳到首/尾项 |
| `Enter` | 确认选择 |
| `Esc` | 取消（关闭列表） |
| 打字 | 过滤选项（实时模糊匹配 label 和 description） |
| `Space` | 多选模式下切换选中状态 |

**典型应用：** `/model` 模型选择器、`/resume` 历史会话列表、`/scoped-models` 模型范围管理器、扩展中的选项面板。

**差分渲染优化：** SelectList 内部使用了一份"当前可见选项"索引缓存。当用户打字过滤时，只有匹配结果集发生变化的行被重绘；高亮光标移动时只有两行被重绘（旧位置去高亮 + 新位置加高亮）。

### 15.4.9 SettingsList ——设置列表

专门为配置选项面板设计的交互式选择列表。相比普通 `SelectList`，它增加了对**可编辑值**（如枚举选项、字符串、布尔开关、数字滑块）的特殊渲染。

```typescript
interface SettingsOption {
  key: string;
  label: string;
  type: "enum" | "string" | "boolean" | "number" | "action" | "section";
  value?: any;                           // 当前值
  options?: { value: any; label: string }[];  // 枚举型选项列表
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  onChange?: (key: string, value: any) => void;
}

class SettingsList extends Component {
  constructor(options: {
    title: string;
    settings: SettingsOption[];
    onClose?: () => void;
  });

  getValues(): Record<string, any>;
}
```

**使用示例：**

```typescript
const settingsPanel = new SettingsList({
  title: "设置",
  settings: [
    {
      key: "thinkingLevel",
      label: "思考级别",
      type: "enum",
      value: "medium",
      options: [
        { value: "off", label: "关闭" },
        { value: "low", label: "低" },
        { value: "medium", label: "中" },
        { value: "high", label: "高" },
        { value: "xhigh", label: "极高" },
      ],
      onChange: (key, value) => config.set(key, value),
    },
    {
      key: "autoCompactThreshold",
      label: "自动压缩阈值",
      type: "number",
      value: 0.85,
      min: 0.1,
      max: 0.95,
      step: 0.05,
      description: "上下文使用率超过此值时自动触发压缩",
      onChange: (key, value) => config.set(key, value),
    },
    {
      key: "collapseToolOutputs",
      label: "折叠工具输出",
      type: "boolean",
      value: true,
      onChange: (key, value) => config.set(key, value),
    },
    // section 类型不参与交互，仅做分组标题
    { key: "section-model", label: "── 模型设置 ──", type: "section" },
  ],
});
container.addChild(settingsPanel);
```

**交互方式：**

- `↑` / `↓` 上下移动
- `←` / `→` 调整当前设置项的值（enum→切换选项、boolean→切换、number→增减）
- `Enter` 对于 `action` 类型：触发动作；对于其他类型：进入编辑模式（如 string 类型的文本输入）
- `Esc` 关闭设置面板

**典型应用：** `/settings` 交互式设置面板——SettingsList 就是它的底层组件。

### 15.4.10 Spacer ——间距

不渲染任何内容，仅用于在弹性布局中占据空间。

```typescript
class Spacer extends Component {
  constructor(options?: {
    minWidth?: number;
    minHeight?: number;
    grow?: number;    // 默认为 1，即"吃掉所有剩余空间"
  });
}
```

**使用示例：**

```typescript
// 让标题居中：两侧各放一个 Spacer（grow=1），中间放标题
const header = new Container({ direction: "horizontal" });
header.addChild(new Spacer());
header.addChild(new Text("Pi 编码助手"));
header.addChild(new Spacer());

// 底部栏：左侧路径 — 中间 Spacer — 右侧统计
const footer = new Container({ direction: "horizontal" });
footer.addChild(new TruncatedText(process.cwd()));
footer.addChild(new Spacer());  // 吃掉所有剩余空间，把右侧内容推到最右
footer.addChild(new Text("↑12.3k ↓4.2k $0.042"));
```

### 15.4.11 Image ——图片显示

在支持图片显示的终端模拟器中渲染图片（iTerm2、Kitty、Ghostty、WezTerm 等）。

```typescript
class Image extends Component {
  constructor(options: {
    data: Buffer;          // 图片原始数据（PNG/JPEG/GIF/WebP）
    format?: "png" | "jpeg" | "gif" | "webp";
    width?: number;        // 显示宽度（列数）
    height?: number;       // 显示高度（行数）
    preserveAspectRatio?: boolean;
    alt?: string;          // 不支持图片显示时的替代文本
  });
}
```

**使用示例：**

```typescript
import { readFile } from "fs/promises";

const imageData = await readFile("screenshot.png");
const image = new Image({
  data: imageData,
  format: "png",
  width: 40,
  preserveAspectRatio: true,
  alt: "[截图：终端错误信息]",
});
container.addChild(image);
```

**终端兼容性：** 图片显示使用以下协议尝试（按优先级）：
1. **Kitty 图形协议**（Kitty、WezTerm、Konsole 23.04+ 支持）
2. **iTerm2 内嵌图片协议**（iTerm2、Ghostty、Warp 支持）
3. **不支持时** → 回退到 `alt` 文本显示 + 一条提示："[当前终端不支持图片显示]"

**典型应用：** 图片粘贴预览（编辑器中的 `Ctrl+V` 粘贴）、视觉模型的结果展示（如 `read` 工具的图片文件读取结果）。

### 15.4.12 Box ——盒子容器

`Box` 是 `Container` 的一个具体化别名，添加了边框、内边距、标题等装饰能力。

```typescript
class Box extends Container {
  constructor(options?: {
    border?: "single" | "double" | "rounded" | "none";   // 边框样式
    borderColor?: Color;
    title?: string;         // 边框标题
    padding?: number;       // 内边距（默认 0）
    paddingX?: number;      // 水平内边距
    paddingY?: number;      // 垂直内边距
    direction?: "vertical" | "horizontal";
  });

  setTitle(title: string): void;
  setBorderColor(color: Color): void;
}
```

**边框样式效果：**

| 样式 | 外观 |
|------|------|
| `single` | `┌─┐ │ │ └─┘` |
| `double` | `╔═╗ ║ ║ ╚═╝` |
| `rounded` | `╭─╮ │ │ ╰─╯` |
| `none` | 无边框 |

**使用示例：**

```typescript
// 消息气泡效果
const messageBox = new Box({
  border: "rounded",
  borderColor: "blue",
  title: "助手",
  padding: 1,
  direction: "vertical",
});

messageBox.addChild(new Markdown({ content: assistantResponse }));
container.addChild(messageBox);

// 动态更改边框（如编辑器在忙碌状态下的闪烁效果通过 color 交替实现）
setInterval(() => {
  messageBox.setBorderColor(i % 2 === 0 ? "yellow" : "brightYellow");
}, 500);
```

### 15.4.13 Container ——容器

基础容器组件，提供子组件布局能力。已在 [15.3.3](#1533-组件系统架构) 中详述，此处不重复。

但特别提一下 `Container` 的**弹性布局规则**：

```text
可用空间 = 容器总高度 - Σ(子组件 minHeight) - gap × (子组件数 - 1)
每个 grow 权重为 w 的子组件获得: minHeight + (w / Σ所有子组件grow) × 可用空间
```

这个算法与 CSS Flexbox 的 `flex-grow` 高度一致，差别在于 pi-tui 只做一维（垂直或水平）布局。

**典型布局示例——Pi 主界面结构：**

```typescript
const root = new Container({ direction: "vertical" });

// 消息区域 —— 吃满剩余空间
const messages = new Container({ direction: "vertical", grow: 1 });
root.addChild(messages);

// 编辑器 —— 固定高度（多行时自动扩展，但有最大高度限制）
const editor = new Editor({
  minHeight: 1,
  maxHeight: 10,  // 编辑器最多占 10 行，超出则内部滚动
  grow: 0,        // 不参与弹性分配
});
root.addChild(editor);

// 底部栏 —— 固定 1 行
const footer = new Container({
  direction: "horizontal",
  minHeight: 1,
});
root.addChild(footer);
```

---

## 15.5 差分渲染原理

差分渲染是 pi-tui 的核心性能机制。本节深入到"一帧之内发生了什么"的细节。

### 15.5.1 渲染循环

`TUI.tick()` 是每帧的入口。它由 `TUI.start()` 启动的轮询循环调用：

```typescript
class TUI {
  private frameLoop() {
    const loop = () => {
      this.tick();
      this.animationFrameId = setImmediate(loop);
    };
    loop();
  }

  tick() {
    // 1. 收集所有脏组件的渲染输出
    const outputs = this.collectDirtyOutputs();

    // 2. 与上一帧比较，计算差异
    const diff = this.computeDiff(outputs);

    // 3. 同步输出包装
    this.terminal.beginSynchronizedUpdate();

    // 4. 逐行写入差异
    for (const change of diff) {
      this.terminal.moveTo(change.row, 0);
      this.terminal.write(change.newLine);
      // 如果新行比旧行短，清除行尾残余
      if (change.newLine.length < change.oldLine.length) {
        this.terminal.clearLine();
      }
    }

    // 5. 更新光标位置
    if (this.activeCursor) {
      this.terminal.moveTo(this.activeCursor.row, this.activeCursor.col);
    }

    // 6. 结束同步输出
    this.terminal.endSynchronizedUpdate();

    // 7. 保存当前帧作为下一帧的比较基准
    this.previousOutput = this.flattenOutputs(outputs);
  }
}
```

**为什么不使用 `requestAnimationFrame`？** Node.js 没有浏览器的 `requestAnimationFrame` API，也不存在"垂直同步信号"。pi-tui 使用 `setImmediate` 实现高效的帧循环——它的优先级低于 I/O 回调但高于 `setTimeout`，适合在 I/O 密集的场景中保持响应性。

### 15.5.2 渲染树比较

"比较"（diffing）算法的核心是逐行比较文本内容和 ANSI 样式：

```typescript
interface FrameLine {
  text: string;
  styles: StyleRun[];  // 每段文本的 ANSI 样式信息
}

function computeLineDiff(
  previous: Map<number, FrameLine>,  // 行号 → 上一帧内容
  current: Map<number, FrameLine>,   // 行号 → 当前帧内容
): LineChange[] {
  const changes: LineChange[] = [];

  for (const [row, currLine] of current) {
    const prevLine = previous.get(row);
    if (!prevLine) {
      // 新增行：整体为新内容
      changes.push({ row, type: "new", newLine: renderLine(currLine) });
    } else if (!linesEqual(prevLine, currLine)) {
      // 内容变化：重写整行
      changes.push({
        row,
        type: "changed",
        oldLine: renderLine(prevLine),
        newLine: renderLine(currLine),
      });
    }
    // 内容相同：跳过（不输出任何内容）
  }

  // 处理被删除的行（当前帧的行数比上一帧少）
  for (const row of previous.keys()) {
    if (!current.has(row)) {
      changes.push({ row, type: "deleted", newLine: "" });
    }
  }

  return changes;
}
```

**ANSI 样式比较的细节：** 不能简单比较"包含 ANSI 转义序列的字符串"——因为同一颜色可以用不同的 ANSI 序列表示。例如 `\x1b[31m`（标准红）和 `\x1b[38;5;1m`（256 色模式的红）在显示上完全相同，但字符串不同。pi-tui 将每行的样式解析为结构化的 `StyleRun[]` 数组，比较时做规范化处理。

### 15.5.3 只输出变化部分

差分渲染的输出就是一组"光标移动 + 写入"命令：

```text
CSI ?2026h                    // 开始同步输出
CSI 5;1H                      // 光标移动到第 5 行第 1 列
This line has changed        // 写入新内容
CSI 12;1H                     // 光标移动到第 12 行
Another changed line         // 写入新内容
CSI 15;1H                     // 删除行：清空
CSI 2K                        // erase in line
CSI ?2026l                    // 结束同步输出
```

对于流式文本追加（99% 的场景），差分渲染的输出简单到极致：

```text
CSI ?2026h
CSI 23;48H                    // 移动到第 23 行第 48 列
 new tokens here             // 只写新增的字符
CSI ?2026l
```

——只有一行，只写几个字符。这就是为什么 Pi 的流式输出几乎和原生 `echo` 命令一样流畅。

### 15.5.4 性能优化策略

pi-tui 在差分渲染之上还有多层性能优化：

| 优化策略 | 说明 |
|----------|------|
| **脏标记（Dirty Flag）** | 组件状态改变时调用 `markDirty()`，渲染循环只遍历脏组件的子树。未标记脏的组件完全跳过。 |
| **输出缓冲复用** | 每帧的 `FrameLine[]` 数组对象在帧之间复用（通过对象池），避免频繁 GC。 |
| **样式规范化缓存** | 对于频繁出现的 ANSI 样式模式（如代码块高亮），样式解析结果被缓存。 |
| **节流（Throttling）** | 流式文本追加不是每个 token 触发一帧——如果 token 来得太快（< 16ms 间隔），pi-tui 缓冲它们并在下一帧一次性渲染。这避免了"过于频繁的终端写入导致反效果"。 |
| **滚动缓冲区提升** | 一旦某行内容被确认不再变化（如工具的完整输出已接收完毕），pi-tui 将该行"提升"到滚动缓冲区区域——此后不再被差分引擎追踪，节省了逐帧比较的开销。 |
| **组件可见性剪裁** | 对于 `visible = false` 的组件及其子树，完全跳过渲染和布局计算。 |

---

## 15.6 主题系统实现

pi-tui 的主题系统控制终端中每个像素的颜色。它的设计要点是：**声明式 JSON 定义 + 热重载 + 嵌套结构**。

### 15.6.1 颜色管理

pi-tui 内部使用一个统一的 `Theme` 类型来表示所有颜色：

```typescript
type Color = string;  // "#7aa2f7" | "red" | "color16"

interface Theme {
  name: string;
  colors: {
    // 基础调色板
    background: Color;
    foreground: Color;
    cursor: Color;
    selection: Color;
    border: Color;

    // ANSI 16 色（影响语法高亮）
    black: Color;
    red: Color;
    green: Color;
    yellow: Color;
    blue: Color;
    magenta: Color;
    cyan: Color;
    white: Color;
    brightBlack: Color;
    brightRed: Color;
    brightGreen: Color;
    brightYellow: Color;
    brightBlue: Color;
    brightMagenta: Color;
    brightCyan: Color;
    brightWhite: Color;

    // 语义化颜色
    userMessage: Color;
    assistantMessage: Color;
    toolCall: Color;
    toolResult: Color;
    thinkingBlock: Color;
    thinkingBlockText: Color;
    error: Color;
    warning: Color;
    info: Color;
    success: Color;

    // 特定 UI 区域
    startupHeader: Color;
    editorBorder: {
      default: Color;
      active: Color;
      busy: Color;
      error: Color;
    };
    editorCursor: Color;
    editorSelection: Color;
    editorText: Color;
    editorPlaceholder: Color;

    footerBackground: Color;
    footerForeground: Color;
    footerHighlight: Color;
    footerWarning: Color;

    treeNode: Color;
    treeBranch: Color;
    treeActive: Color;
    treeTag: Color;

    commandPalette: {
      background: Color;
      foreground: Color;
      selected: Color;
      description: Color;
    };

    fileSearchPopup: {
      background: Color;
      foreground: Color;
      selected: Color;
      pathMuted: Color;
    };
  };
}
```

**ANSI 转义序列生成：**

pi-tui 内部使用一个 `StyleBuilder` 类将颜色定义转换为 ANSI escape 序列：

```typescript
class StyleBuilder {
  private theme: Theme;

  foreground(color: keyof Theme["colors"]): this;
  background(color: keyof Theme["colors"]): this;
  bold(): this;
  italic(): this;
  underline(): this;
  dim(): this;
  reset(): this;

  build(): string;          // 输出完整的 ANSI escape 序列
  apply(text: string): string;  // 快捷：build() + text + reset()
}
```

**使用示例：**

```typescript
const style = new StyleBuilder(theme);
const headerText = style
  .foreground("startupHeader")
  .bold()
  .apply("=== Pi 编码助手 ===");

const errorText = style
  .foreground("error")
  .bold()
  .apply("错误：连接中断");
```

### 15.6.2 主题切换

主题切换通过 `TUI.setTheme()` 触发：

```typescript
// 内置主题
tui.setTheme(DARK_THEME);
tui.setTheme(LIGHT_THEME);

// 自定义主题文件
const customTheme = JSON.parse(readFileSync("~/.pi/agent/themes/dracula.json", "utf-8"));
tui.setTheme(customTheme);
```

切换流程：

1. `setTheme()` 更新内部 `theme` 引用
2. 标记根容器和所有子组件为"脏"（触发整树重绘）
3. 下一帧 `tick()` 时，所有组件使用新主题重新调用 `render()`
4. 差分渲染引擎将所有变化的行（即几乎所有行）一次性输出（通过同步输出包裹，无闪烁切换）

### 15.6.3 自定义主题注入

在 pi-coding-agent 中，主题由 `settings.json` 中的 `theme` 字段和 `themes` 路径数组控制。pi-tui 本身不负责主题文件发现和加载——它只接受一个 `Theme` 对象。文件发现逻辑在 pi-coding-agent 层完成。

**热重载（Hot Reload）：**

pi-coding-agent 在启动时监视主题文件路径（通过 `fs.watch`），一旦检测到文件修改，自动重新读取并调用 `TUI.setTheme()`。整个过程在 < 50ms 内完成（JSON 解析 + 组件重绘），用户看到的是即时的颜色切换，无需重启。

### 15.6.4 扩展如何访问主题

在 Extension 中，通过 `ctx.ui.getTheme()` 获取当前主题对象，可以用它来给自己的自定义组件渲染时设置匹配的颜色：

```typescript
pi.on("session_start", (event, ctx) => {
  const theme = ctx.ui.getTheme();
  const accentColor = theme.colors.blue;     // 获取当前主题的蓝色
  const errorColor = theme.colors.error;     // 获取当前主题的错误色
  // 用于自定义组件渲染...
});
```

---

## 15.7 键盘输入处理

pi-tui 的键盘输入系统从"原始终端字节流"到"组件事件"经历了一个完整的处理管线。

### 15.7.1 输入处理管线

```text
物理键盘按下
    ↓
终端模拟器生成字节序列
    ↓ (stdin)
ProcessTerminal 读取原始字节
    ↓
ANSI 转义序列解析器
    ↓
Key 对象生成
    ↓ (事件分发)
TUI.onKey()  →  全局快捷键检查
    ↓ (冒泡)
Component.onKey()  →  组件内部处理
    ↓ (如果组件返回 false)
父组件 onKey()  →  向上冒泡
```

### 15.7.2 Key 工具类型

pi-tui 定义了统一的 `Key` 类型，用于表示所有键盘事件：

```typescript
interface Key {
  name: string;            // 键名："a", "Enter", "Backspace", "ArrowUp", "F1"...
  ctrl: boolean;           // Ctrl 修饰键
  alt: boolean;            // Alt 修饰键（macOS 上对应 Option）
  shift: boolean;          // Shift 修饰键
  meta: boolean;           // Meta 修饰键（macOS 上对应 Cmd，Windows 上对应 Win）
  sequence: string;        // 原始字节序列（调试用）
}
```

### 15.7.3 matchesKey——按键匹配

`matchesKey()` 是 pi-tui 内置的工具函数，用于将物理按键与"声明式按键表达式"做匹配：

```typescript
function matchesKey(key: Key, expression: string): boolean;
```

**支持的表达式格式：**

| 表达式 | 匹配的按键 |
|--------|-----------|
| `"a"` | 普通字符键 `a`（小写） |
| `"A"` | 大写 `A`（即 Shift+a） |
| `"Ctrl+C"` | Ctrl + c |
| `"Alt+Enter"` | Alt + Enter |
| `"Shift+Tab"` | Shift + Tab |
| `"Ctrl+Shift+P"` | Ctrl + Shift + p |
| `"Meta+K"` | Cmd + k（macOS）或 Win + k |
| `"Enter"` | Enter 键 |
| `"Escape"` | Esc 键 |
| `"Backspace"` | 退格键 |
| `"Delete"` | Delete 键 |
| `"ArrowUp"` / `"ArrowDown"` / `"ArrowLeft"` / `"ArrowRight"` | 方向键 |
| `"Home"` / `"End"` | Home / End 键 |
| `"PageUp"` / `"PageDown"` | 翻页键 |
| `"F1"` ～ `"F12"` | 功能键 |
| `"Space"` | 空格键 |
| `"Tab"` | Tab 键 |

**使用示例（在组件内部）：**

```typescript
class MyComponent extends Component {
  onKey(key: Key): boolean {
    if (matchesKey(key, "Enter")) {
      this.submit();
      return true;  // 消费事件，停止冒泡
    }
    if (matchesKey(key, "Escape")) {
      this.cancel();
      return true;
    }
    if (matchesKey(key, "Ctrl+K")) {
      this.clear();
      return true;
    }
    return false;  // 未处理，继续冒泡
  }
}
```

### 15.7.4 按键绑定系统

pi-tui 支持声明式的按键绑定注册，这是 `keybindings.json` 的底层实现：

```typescript
interface KeyBinding {
  keys: string[];          // ["Ctrl+Shift+L"]
  command: string;         // "pi:model"
  title: string;           // "打开模型选择器"
  when?: string;           // 条件表达式（如 "editorFocus"）
}

class KeyBindingManager {
  register(binding: KeyBinding): void;
  unregister(command: string): void;
  getBindings(): KeyBinding[];

  // 尝试匹配并执行绑定的命令
  dispatch(key: Key, context: string): boolean;
}
```

**条件表达式（`when` 字段）：**

`when` 字段允许同一个按键在不同上下文中有不同行为。常见的上下文值：

| 上下文 | 含义 |
|--------|------|
| `"editorFocus"` | 编辑器获得焦点时 |
| `"editorEmpty"` | 编辑器为空时 |
| `"modelBusy"` | 模型正在工作时 |
| `"modelIdle"` | 模型空闲时 |
| `"selectListOpen"` | 选择列表打开时 |
| `"commandPaletteOpen"` | 斜杠命令菜单打开时 |
| `"treeViewOpen"` | 会话树导航打开时 |
| `"vimNormalMode"` | Vim 处于 Normal 模式 |
| `"vimInsertMode"` | Vim 处于 Insert 模式 |

例如，`Esc` 键在"模型忙碌时"是中断操作，在"选择列表打开时"是关闭列表，在"Vim Insert 模式"是切换到 Normal 模式——这就是通过 `when` 条件表达式实现的：

```typescript
keyBindingManager.register([
  { keys: ["Escape"], command: "pi:interrupt", when: "modelBusy" },
  { keys: ["Escape"], command: "pi:close-list", when: "selectListOpen" },
  { keys: ["Escape"], command: "pi:close-command-palette", when: "commandPaletteOpen" },
  { keys: ["Escape"], command: "vim:normal-mode", when: "vimInsertMode" },
]);
```

### 15.7.5 输入事件流——完整示例

下面演示从用户按键到组件响应的完整流程：

```typescript
// 1. TUI 启动时注册全局快捷键
tui.keyBindingManager.register([
  { keys: ["Ctrl+L"], command: "pi:model", title: "模型选择器" },
  { keys: ["Ctrl+O"], command: "pi:collapse-tool-output", title: "折叠工具输出" },
  { keys: ["Shift+Tab"], command: "pi:thinking-cycle", title: "切换思考级别" },
]);

// 2. ProcessTerminal 监听标准输入
process.stdin.on("data", (buffer: Buffer) => {
  // 解析原始字节序列
  const key = terminal.parseInput(buffer);
  if (key) {
    // 3. 先尝试全局快捷键匹配
    if (tui.keyBindingManager.dispatch(key, getCurrentContext())) {
      return;  // 快捷键被处理
    }
    // 4. 否则向下分发到组件树
    tui.dispatchKey(key);
  }
});

// 5. 组件树的 onKey 链
// TUI.dispatchKey → Editor.onKey → (如果 Editor 消费) → 停止
//                                   → (如果 Editor 不消费) → Container.onKey → ...
```

---

## 15.8 自定义组件开发

pi-tui 的组件系统是开放式的——你可以继承 `Component` 基类（或组合现有组件）来构建自定义 UI 组件。这是 Extensions 系统"构建自定义 TUI 组件"能力的底层基础。

### 15.8.1 组件基类

所有自定义组件的起点是继承 `Component` 并实现以下方法：

```typescript
abstract class Component {
  id: string;
  parent: Container | null;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  grow: number;
  shrink: number;
  visible: boolean;

  // === 必须实现的方法 ===
  abstract render(): RenderOutput;
  abstract layout(availableWidth: number, availableHeight: number): void;

  // === 可覆盖的生命周期钩子 ===
  onMount(): void { }
  onUnmount(): void { }
  onResize(cols: number, rows: number): void { }

  // === 可覆盖的事件处理 ===
  onKey(key: Key): boolean { return false; }
  onMouse(event: MouseEvent): boolean { return false; }

  // === 状态管理方法 ===
  markDirty(): void;
  isDirty(): boolean;
  focus(): void;
  blur(): void;
  isFocused(): boolean;
}

interface RenderOutput {
  lines: string[];
  cursor?: { row: number; col: number };
}
```

### 15.8.2 渲染方法——最佳实践

`render()` 是组件最重要的方法。它应该返回一个 `RenderOutput`，包含组件当前状态下的全部视觉内容。

**核心原则：**

1. **纯函数式**——`render()` 不应有副作用。读取组件字段、生成 `lines` 数组、返回。不要修改任何状态。
2. **ANSI 转义序列计数**——`lines` 中可以包含 ANSI escape 序列（颜色、样式等），但要注意 `lines.length` 必须等于组件的 `height`（或 `minHeight`，取较大值）。如果渲染内容行数不足，用空字符串填充。
3. **用 `StyleBuilder` 而不是手写 escape 序列**——手写 `\x1b[31m` 脆弱且不可主题化。始终使用 `StyleBuilder` 以确保主题切换时颜色自动适配。

```typescript
class ProgressBar extends Component {
  private progress: number = 0;  // 0 ~ 1
  private label: string = "";

  constructor(options?: { label?: string }) {
    super();
    this.minHeight = 1;
    this.label = options?.label ?? "进度";
  }

  setProgress(value: number, label?: string): void {
    this.progress = Math.max(0, Math.min(1, value));
    if (label !== undefined) this.label = label;
    this.markDirty();
  }

  render(): RenderOutput {
    const style = new StyleBuilder(this.getTheme());
    const barWidth = Math.floor((this.width - this.label.length - 4) * this.progress);
    const filled = "█".repeat(barWidth);
    const empty = "░".repeat(Math.max(0, this.width - this.label.length - 4 - barWidth));
    const percentage = Math.round(this.progress * 100);

    const line = style
      .foreground("info")
      .apply(`${this.label} [${filled}${empty}] ${percentage}%`);

    return { lines: [line] };
  }

  // ⚠ 注意：layout() 在此组件中不需要特殊处理
  // width 由父容器分配，height 固定为 1
  layout(availableWidth: number, _availableHeight: number): void {
    this.width = availableWidth;
    this.height = 1;
  }
}
```

### 15.8.3 生命周期详解

```text
组件实例创建
    ↓
addChild(child)  ← 添加到父容器
    ↓
layout() 调用     父容器递归布局，分配尺寸
    ↓
onMount() 触发   组件已被添加到树中，可以开始初始化操作
    ↓
┌── 渲染循环 ──────────────────────────────────────┐
│  markDirty()  →  tick()  →  render()  →  终端输出 │
│  onKey()      →  键盘事件处理                      │
│  onResize()   →  终端尺寸变化（如果组件关心）        │
└──────────────────────────────────────────────────┘
    ↓
removeChild(child)  ← 从父容器移除
    ↓
onUnmount() 触发   组件已从树中移除，清理资源
    ↓
组件实例可被 GC
```

**`onMount()` 典型用途：** 启动定时器、注册文件监视、订阅事件总线。

**`onUnmount()` 典型用途：** 清除定时器、取消文件监视、退订事件总线、释放外部资源。

```typescript
class Clock extends Component {
  private timer: NodeJS.Timeout | null = null;

  onMount(): void {
    this.timer = setInterval(() => {
      this.markDirty();
    }, 1000);
  }

  onUnmount(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  render(): RenderOutput {
    const now = new Date().toLocaleTimeString();
    return { lines: [style.foreground("info").apply(`当前时间: ${now}`)] };
  }
}
```

### 15.8.4 完整示例——Git 状态面板

下面是一个完整的自定义组件示例。它显示当前 Git 仓库的状态（分支、待提交、变更、未跟踪文件），并每 5 秒自动刷新：

```typescript
import { Component, ComponentOptions, StyleBuilder } from "@earendil-works/pi-tui";
import { execSync } from "child_process";

interface GitStatus {
  branch: string;
  staged: number;
  modified: number;
  untracked: number;
  ahead: number;
  behind: number;
}

class GitStatusPanel extends Component {
  private status: GitStatus = {
    branch: "unknown",
    staged: 0,
    modified: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
  };
  private refreshTimer: NodeJS.Timeout | null = null;
  private workingDir: string;

  constructor(workingDir: string, options?: ComponentOptions) {
    super(options);
    this.workingDir = workingDir;
    this.minHeight = 2;  // 分支行 + 统计行
    this.minWidth = 30;
  }

  onMount(): void {
    this.refreshStatus();
    this.refreshTimer = setInterval(() => {
      this.refreshStatus();
    }, 5000);
  }

  onUnmount(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private refreshStatus(): void {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: this.workingDir,
        encoding: "utf-8",
        timeout: 3000,
      }).trim();

      const statusOutput = execSync("git status --porcelain", {
        cwd: this.workingDir,
        encoding: "utf-8",
        timeout: 3000,
      });

      let staged = 0, modified = 0, untracked = 0;
      for (const line of statusOutput.split("\n")) {
        if (line.length < 2) continue;
        const statusCode = line.substring(0, 2);
        if (statusCode[0] !== " " && statusCode[0] !== "?") staged++;
        if (statusCode[1] !== " ") modified++;
        if (statusCode.startsWith("??")) untracked++;
      }

      const ahead = 0; // 简化：实际可用 `git rev-list --count HEAD..@{u}`
      const behind = 0;

      this.status = { branch, staged, modified, untracked, ahead, behind };
      this.markDirty();
    } catch (err) {
      // 不是 Git 仓库或命令失败——静默处理，保持旧状态
    }
  }

  render(): RenderOutput {
    const style = new StyleBuilder(this.getTheme());
    const { branch, staged, modified, untracked } = this.status;

    const branchLine = style
      .foreground("blue")
      .bold()
      .apply(`⎇ ${branch}`);

    const parts: string[] = [];
    if (staged > 0) parts.push(style.foreground("green").apply(`+${staged}`));
    if (modified > 0) parts.push(style.foreground("yellow").apply(`~${modified}`));
    if (untracked > 0) parts.push(style.foreground("red").apply(`?${untracked}`));

    const statsLine = parts.length > 0
      ? parts.join(" ")
      : style.foreground("brightBlack").apply("clean");

    return { lines: [branchLine, `  ${statsLine}`] };
  }

  layout(availableWidth: number, _availableHeight: number): void {
    this.width = Math.min(availableWidth, 60);  // 最大宽度 60 列
    this.height = 2;
  }
}

// === 使用示例 ===
// 在 Extension 中：
pi.on("session_start", (event, ctx) => {
  if (ctx.hasUI) {
    const gitPanel = new GitStatusPanel(process.cwd());
    // 将组件添加到 TUI 容器中（如底部栏上方）
    ctx.ui.setWidget(gitPanel);
  }
});
```

### 15.8.5 在 Extension 中使用自定义组件

Extensions 可以通过以下 `ctx.ui` API 将自定义组件注入 Pi TUI：

| API | 用途 |
|-----|------|
| `ctx.ui.setWidget(component)` | 在 TUI 的指定区域渲染一个持久化组件（如 Git 状态面板）。组件在会话期间一直显示，可设置自动刷新间隔 |
| `ctx.ui.custom({ ... })` | 弹出一个临时覆盖层（overlay），类似模态对话框。用户交互结束后自动关闭 |
| `ctx.ui.setEditorComponent({ ... })` | 完全替换 Pi 的内置编辑器组件。高级用法——仅当你需要全新的输入交互模式时使用 |
| `ctx.ui.setFooter(widgets[])` | 向底部栏添加自定义小部件（如自定义快捷键提示、状态指示器） |

详见 [第九章：Extensions 扩展开发](09-Extensions扩展开发) 中 `ctx.ui` 的完整 API 文档。

---

## 15.9 性能考量

pi-tui 在设计上已经内建了多层性能优化（差分渲染、脏标记、样式缓存、秒级节流等——详见 [15.5.4 节](#1554-性能优化策略)）。但对于组件开发者，仍然有几个需要注意的点：

### 15.9.1 渲染优化

1. **避免在 `render()` 中做 I/O 或计算密集操作。** `render()` 会在每一帧被调用（如果组件被标记为脏）。文件读取、网络请求、大型 JSON 解析都应该在别处完成后再调用 `markDirty()`。

2. **粒度控制——精确使用 `markDirty()`。** 不要因为一个微小变化（如光标移动一列）而标记整个大型组件为脏。如果组件内部结构允许，可以把"变化频繁的部分"拆分成子组件，单独标记它们为脏：

```typescript
// ❌ 不好：整个消息列表因为一条新消息被重绘
class MessageList extends Component {
  render() { /* 渲染全部 500 条消息 */ }
}

// ✅ 好：每条消息是独立的子组件
class MessageList extends Container {
  addMessage(msg: Message) {
    this.addChild(new MessageItem(msg));  // 只有新孩子被标记为脏
  }
}
```

3. **缓存 `StyleBuilder` 实例。** 在组件的多次 `render()` 调用之间复用同一个 `StyleBuilder` 实例，避免在每次渲染时重复创建（`StyleBuilder` 的构造函数会做一些样式映射计算）。

### 15.9.2 内存管理

1. **在 `onUnmount()` 中清理。** 如果你在 `onMount()` 中注册了定时器、事件监听器、文件监视器等外部资源，**必须**在 `onUnmount()` 中清理。否则组件被移除后，这些资源会导致内存泄漏。

2. **避免在组件实例属性中持有大型数据。** 组件实例在整个会话期间存活（保留模式的特点）。如果你把大文件内容、完整消息历史等大型数据直接存在组件字段中，它们会一直占用内存，直到会话结束。考虑用"数据由外部管理、组件只引用 ID"的模式：

```typescript
class MessageItem extends Component {
  private messageId: string;  // 只存 ID，不存内容

  render(): RenderOutput {
    const message = messageStore.getById(this.messageId);  // 从外部缓存获取
    return this.renderMessage(message);
  }
}
```

3. **监控大型列表。** 如果消息列表有上千条消息，每条都是一个独立组件实例——组件树的内存占用会变得显著。pi-tui 内部对消息组件有"视口外冻结"（viewport culling）策略：完全在视口上方的组件会被移除渲染（用 `visible = false` 或直接 `removeChild`），只在需要显示时重新挂载。

### 15.9.3 大量数据展示策略

当需要在终端中展示大量数据（如千行日志、万行工具输出）时，直接全部渲染是低效且无意义的——用户的屏幕只能显示 30~60 行。以下是推荐的优化策略：

**策略一：虚拟滚动（Virtual Scrolling）**

只渲染当前视口内可见的行（+ 少量缓冲区），其余行用"占位高度"代替：

```typescript
class VirtualLogViewer extends Component {
  private totalLines: number;
  private scrollOffset: number = 0;
  private lines: string[];

  render(): RenderOutput {
    const visibleStart = this.scrollOffset;
    const visibleEnd = Math.min(
      visibleStart + this.height,
      this.totalLines,
    );
    const output: string[] = [];

    for (let i = visibleStart; i < visibleEnd; i++) {
      output.push(this.lines[i]);
    }

    // 不足 height 的行数用空行填充
    while (output.length < this.height) {
      output.push("");
    }

    return { lines: output };
  }
}
```

**策略二：分段加载**

对于来自工具的流式输出，`pi-agent-core` 默认做分片传输——每次只发送一定大小的文本块（默认 4000 字符）。pi-tui 的 Markdown 组件接收到每个分片后增量渲染，不需要等待完整输出。这对用户是透明的——他们看到的是平滑的流式渲染，而非"等待→瞬间全部出现"。

**策略三：折叠——默认折叠大型输出**

pi-coding-agent 中，工具输出超过一定长度时默认折叠，只显示前几行。用户按 `Ctrl+O` 展开查看完整内容。这个行为可以由扩展开发者在自定义组件中实现，通过一个 `collapsed` 布尔字段控制渲染行数：

```typescript
class ExpandableOutput extends Component {
  collapsed = true;
  maxPreviewLines = 5;
  private fullContent: string;

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.markDirty();
  }

  render(): RenderOutput {
    const lines = this.fullContent.split("\n");
    if (this.collapsed && lines.length > this.maxPreviewLines) {
      return {
        lines: [
          ...lines.slice(0, this.maxPreviewLines),
          `… 还有 ${lines.length - this.maxPreviewLines} 行（按 Ctrl+O 展开）`,
        ],
      };
    }
    return { lines };
  }
}
```

---

## 15.10 与 Pi 编码代理的集成

pi-tui 是一个**独立的 npm 包**——它可以脱离 Pi 单独使用（虽然目前的主要用途就是 Pi）。pi-coding-agent 是它的主要消费方。本节梳理两者之间的集成点和职责边界。

### 15.10.1 pi-tui 在 coding-agent 中的使用方式

pi-coding-agent 在启动交互模式时，创建并管理一个 `TUI` 实例：

```typescript
// 在 pi-coding-agent 的启动逻辑中（简化版）
import { TUI, Editor, Markdown, Container, Box, Footer, ... } from "@earendil-works/pi-tui";

async function startInteractiveMode(config: PiConfig) {
  // 1. 创建 TUI 实例
  const tui = new TUI({
    stdin: process.stdin,
    stdout: process.stdout,
    theme: loadTheme(config.theme),
  });

  // 2. 构建 UI 结构
  const root = tui.root;

  // 2a. 消息容器
  const messageContainer = new Container({ direction: "vertical", grow: 1 });
  root.addChild(messageContainer);

  // 2b. 编辑器
  const editor = new Editor({
    placeholder: "向 Pi 提问或输入指令…",
    onSubmit: (text, mode) => messageQueue.enqueue(text, mode),
    fileSearchProvider: (query) => fileIndex.fuzzySearch(query),
    pathCompleteProvider: (partial) => fsPath.complete(partial),
    slashCommandProvider: (query) => commandRegistry.search(query),
  });
  root.addChild(editor);

  // 2c. 底部状态栏
  const footer = new Footer({
    session: currentSession,
    modelRegistry,
  });
  root.addChild(footer);

  // 3. 设置全局按键绑定
  tui.keyBindingManager.register([
    { keys: ["Ctrl+L"], command: "pi:model" },
    { keys: ["Ctrl+O"], command: "pi:collapse-tool-output" },
    // ... 其余绑定
  ]);

  // 4. 启动渲染循环
  tui.start();
}
```

**角色划分：**

| 职责 | 归属 |
|------|------|
| 终端渲染、差分更新、光标定位 | **pi-tui** |
| 组件布局、键盘/鼠标事件分发 | **pi-tui** |
| 主题管理与应用 | **pi-tui** |
| 模型消息流 → TUI 渲染的桥接 | **pi-coding-agent** |
| 会话状态管理（消息存储、树结构） | **pi-agent-core** |
| 工具调用展示与折叠控制 | **pi-coding-agent** + **pi-tui** |
| Extension 生命周期与 UI 注入 | **pi-coding-agent** |
| 主题文件发现与热重载 | **pi-coding-agent** |

### 15.10.2 组件扩展点

pi-tui 暴露了以下扩展点，供 pi-coding-agent 和 Extensions 使用：

**1. `ctx.ui.custom()` ——弹出自定义覆盖层**

详见 [15.8.5 节](#1585-在-extension-中使用自定义组件)。

**2. `ctx.ui.setWidget()` ——注入持久化组件**

将自定义组件挂载到 TUI 组件树的指定位置。组件在会话期间持续存在，可以被标记为脏来触发重绘。

**3. `ctx.ui.setEditorComponent()` ——替换编辑器**

完全接管 Pi 的输入界面。适用于构建特殊的交互模式（如"只读审查模式"——编辑器被替换为快捷键操作面板）。

**4. `registerMessageRenderer(type, renderer)` ——自定义消息类型渲染**

当 Pi 会话中出现非标准消息类型（如 Extension 通过 `pi.appendEntry` 写入的自定义条目）时，通过注册渲染器来定义其 TUI 显示方式。

**5. `ctx.ui.setFooter()` ——底部栏自定义**

向底部状态栏添加自定义状态指示器——如 Extension 的特定状态、CI 状态、Git 分支提醒等。

**6. `TUI.on("key", handler)` 与 `TUI.on("resize", handler)` ——全局事件监听**

监听终端级别的键盘事件和尺寸变化事件，用于实现全局行为（如窗口 resize 时重新计算组件布局）。

---

## 15.11 本章小结

本章对 pi-tui 做了全面的源码级剖析。你应当已经掌握以下关键内容：

- **pi-tui 是什么：** Pi monorepo 中的终端 UI 核心包（`@earendil-works/pi-tui`），一个**保留模式的差分渲染终端 UI 框架**。它是 Pi 交互体验的基石——编辑器、消息流、状态栏、所有 UI 组件都由它驱动。
- **设计选择：** pi-tui 与所有传统 TUI 库的根本区别在于**不接管整个终端**——它像普通 CLI 一样追加内容到主屏幕缓冲区，保留终端的原生滚动历史、搜索和选择-复制能力。它采用**保留模式**组件树（组件身份和状态跨帧持久化）、**差分渲染**（只重绘变化部分）、**同步输出**（`CSI ?2026h/?2026l` 防止撕裂）三大核心机制。
- **核心类：** `TUI`（根对象，持有组件树和渲染循环）、`ProcessTerminal`（终端 I/O 抽象，处理 ANSI 转义序列和 raw mode）、`Component`（组件基类，定义 `render()`/`layout()`/生命周期钩子/脏标记机制）。Container 提供弹性布局。
- **内置组件：** 13 个生产级组件——`Text`、`TruncatedText`、`Input`、`Editor`（含 Vim 仿真器）、`Markdown`（流式渲染）、`Loader`、`CancellableLoader`、`SelectList`、`SettingsList`、`Spacer`、`Image`、`Box`、`Container`。每个都有明确的职责、丰富的配置项和典型的集成场景。
- **差分渲染原理：** 渲染循环的逐帧流程（收集脏输出 → 逐行比较 → 同步输出包装 → 只写差异 → 光标更新）。流式文本追加场景中，通常只需输出 1~3 行的变化。
- **主题系统：** 声明式 JSON 主题文件 → `StyleBuilder` → ANSI escape 序列。支持热重载。颜色语义化（`editorBorder.busy` vs `error` vs `success`）确保 UI 一致性。
- **键盘输入处理：** 完整的输入管线（物理按键 → 字节序列 → ANSI 解析 → `Key` 对象 → 全局快捷键 → 组件树分发）。`matchesKey()` 提供声明式按键匹配。`KeyBindingManager` 支持条件上下文（`when` 字段）。
- **自定义组件开发：** 完整的组件生命周期（构造函数 → `layout()` → `onMount()` → 渲染循环 → `onUnmount()`）。基于 `Component` 基类实现 `render()` 和 `layout()`，使用 `StyleBuilder` 做主题化渲染。通过 `ctx.ui` API 将自定义组件注入 Pi TUI。
- **性能考量：** 避免在 `render()` 中做 I/O；精确使用 `markDirty()`（粒度控制）；在 `onUnmount()` 中清理外部资源以防水内存泄漏；大量数据场景使用虚拟滚动、分段加载和折叠策略。
- **与 coding-agent 的集成：** pi-tui 是独立包，pi-coding-agent 是其主要消费方。职责边界清晰——pi-tui 负责视觉和交互，pi-coding-agent 负责业务逻辑和会话管理。六个扩展点（`custom`、`setWidget`、`setEditorComponent`、`registerMessageRenderer`、`setFooter`、全局事件）让 Extensions 可以深度定制 Pi 的终端界面。

pi-tui 的设计哲学与 Pi 整体一致：**"做好一件事，留下干净的扩展点"**。它不追求成为一个"通用终端 UI 框架"——它只做 Pi 需要的那些事，并把它们做到极致。但也正因为它的核心抽象足够干净（`Component` + `render()` + `layout()` + 差分渲染），它天然具备了可扩展性——你可以在此基础上构建任何你需要的终端 UI 组件。

至此，本教程的三个核心架构章节（第十三章 pi-ai、第十四章 pi-agent-core、第十五章 pi-tui）全部结束。从 LLM API 层到 Agent 运行时再到终端 UI 框架，你已经掌握了 Pi 的完整技术栈。现在你已经不是 Pi 的用户——你是 Pi 的**建造者**。
