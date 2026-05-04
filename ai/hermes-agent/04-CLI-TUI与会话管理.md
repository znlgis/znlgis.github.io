---
layout: default
title: 第四章：CLI/TUI 与会话管理
---

# 第四章：CLI/TUI 与会话管理

CLI（含 TUI 终端 UI）是 Hermes Agent 最核心、最常用的入口。本章把"一切跟键盘和会话有关"的事一次性讲透：界面布局、键位、斜杠命令体系、会话与历史、checkpoint/rollback、profile 切换、皮肤定制，以及一些资深用法。

## 4.1 启动与界面布局

```bash
hermes              # 进入 TUI
hermes chat         # 等价别名（更明确）
hermes chat -q "一行 prompt"  # 一次性 prompt，跑完即退出
hermes chat --toolsets web,terminal -q "..."  # 仅启用某些 toolset
```

进入 TUI 后界面大致分四块：

```
┌─ Banner（横幅，可换皮肤）───────────────────────────────┐
│ Hermes Agent v0.12.0  ☤   Profile: default             │
└────────────────────────────────────────────────────────┘
┌─ Status Bar（状态栏）─────────────────────────────────┐
│ Model: anthropic/claude-opus-4.6  | Personality: focused│
│ Context: 38% (45,120/120,000)     | Tools: 24 enabled  │
└────────────────────────────────────────────────────────┘
┌─ Conversation Area（对话区）──────────────────────────┐
│ User:  ...                                             │
│ Hermes ☤ (thinking)  [tool: terminal] $ ls -la         │
│        │ total 24                                      │
│        │ drwxr-xr-x ...                                │
│ Hermes: 当前目录有 5 个文件夹和 8 个文件...             │
└────────────────────────────────────────────────────────┘
┌─ Input（输入框，多行可编辑）─────────────────────────┐
│ > 帮我把这些 PNG 转成 webp                              │
└────────────────────────────────────────────────────────┘
```

底部输入框默认是 multiline editor：`Enter` 提交，`Shift+Enter` 换行；按 `↑/↓` 翻历史输入；按 `/` 触发斜杠命令补全。

## 4.2 关键键位

| 键位 | 行为 |
|------|------|
| `Enter` | 发送当前消息 |
| `Shift+Enter` | 换行 |
| `Ctrl+C` | **打断** 当前回答；按两次退出 |
| `Ctrl+D` | 退出 TUI |
| `Ctrl+L` | 清屏（不影响会话历史） |
| `Ctrl+B` | 启动语音录入（需 `voice` extra） |
| `Ctrl+R` | 反向搜索输入历史 |
| `Tab` | 斜杠命令 / 路径补全 |
| `↑/↓` | 上一条 / 下一条输入历史 |
| `Esc` 后字母 | 一些 emacs 风格快捷键（`Esc f/b` 单词移动等） |

`Ctrl+C` 是 Hermes 的灵魂键之一：你可以**打断后立刻发新消息纠正方向**，Agent 会优雅停止当前 turn、采纳你的新指示。

## 4.3 斜杠命令体系

斜杠命令是 Hermes "可发现性极高的隐藏菜单"。在 CLI 与所有消息平台共享同一套 `COMMAND_REGISTRY`（位于 `hermes_cli/commands.py`）。下面分类列出最常用命令——完整清单见官方 `reference/slash-commands.md`。

### 4.3.1 会话生命周期

| 命令 | 作用 |
|------|------|
| `/new` | 开启全新会话（清空 in-memory 历史，但旧会话已持久化在 SQLite） |
| `/reset` | 等价 `/new`，但更"狠"——同时清掉一些临时状态 |
| `/exit` 或 `/quit` | 退出 TUI |
| `/save [name]` | 把当前会话打个标签，便于以后查找 |
| `/load <id-or-name>` | 加载历史会话继续聊 |
| `/sessions` | 列出近期会话 |

### 4.3.2 模型与人格

| 命令 | 作用 |
|------|------|
| `/model` | 交互式切模型 |
| `/model <provider:model>` | 直接切指定模型，例如 `/model anthropic/claude-opus-4.6` |
| `/personality` | 选 personality preset |
| `/personality <name>` | 直接切，例如 `/personality concise` |
| `/soul` | 查看/编辑当前 SOUL.md |
| `/identity` | 显示当前 identity（SOUL.md 内容预览） |

### 4.3.3 上下文/Token

| 命令 | 作用 |
|------|------|
| `/usage` | 看本会话 token 用量、费用估算 |
| `/insights [--days N]` | 看跨会话使用洞察（model/cost/工具调用频率等） |
| `/compress` | 立刻压缩当前会话（用 Auxiliary Model 写摘要） |
| `/context` | 查看上下文构成（identity、memory、context files、tool schema 等） |
| `/expand` | 把上下文里的摘要重新展开（小心：会变长） |

### 4.3.4 文件改动安全网

| 命令 | 作用 |
|------|------|
| `/checkpoint [name]` | 手动给 working dir 打 checkpoint |
| `/rollback` | 列出 checkpoint，回滚 |
| `/diff` | 看自上次 checkpoint 起的改动 |

Hermes **会在每次工具改文件之前自动 checkpoint**，因此 `/rollback` 永远是你的安全网。详见 `user-guide/checkpoints-and-rollback.md`。

### 4.3.5 记忆与会话搜索

| 命令 | 作用 |
|------|------|
| `/memory` | 查看 / 编辑 MEMORY.md |
| `/user` | 查看 / 编辑 USER.md |
| `/recall <keyword>` | 跨会话 FTS5 搜索 |
| `/forget <keyword>` | 删掉某条记忆 |

### 4.3.6 工具与技能

| 命令 | 作用 |
|------|------|
| `/tools` | 当前启用了哪些工具 |
| `/skills` | Skills Hub 浏览器（含本地 + 远程） |
| `/<skill-name> [args]` | 触发某个技能，例如 `/plan 给团队搭一个 PR Review 流` |
| `/skill view <name>` | 查看某技能源 |
| `/skill enable / disable <name>` | 启用 / 禁用 |

### 4.3.7 自动化

| 命令 | 作用 |
|------|------|
| `/cron` | Cron 子菜单 |
| `/cron list` / `/cron add ... ...` | 列表 / 新增 |
| `/cron pause <id>` / `/cron resume <id>` / `/cron remove <id>` | 暂停/恢复/删除 |
| `/kanban` | Kanban 子菜单 |
| `/todo` | 当前 Todo 列表 |

### 4.3.8 Gateway / 平台

| 命令 | 作用 |
|------|------|
| `/platforms` | 当前 Gateway 状态（哪些平台在线） |
| `/status` | 平台特定状态（在 IM 里使用） |
| `/sethome` | 在 IM 里把当前对话设为"工作目录会话" |
| `/stop` | 在 IM 里打断当前 turn |

### 4.3.9 调试

| 命令 | 作用 |
|------|------|
| `/retry` | 重试最后一次助手回复 |
| `/undo` | 撤销最后一轮（user → assistant 一组） |
| `/raw` | 切换是否显示原始 tool 输出 |
| `/debug` | 切换 debug 输出（含 prompt 拼装、Provider 选择） |
| `/log` | 当前会话日志路径 |

### 4.3.10 自定义 Slash 命令

你可以自定义命令，做法是创建技能：技能名即斜杠命令（详见第七章）。

## 4.4 输入增强：上下文引用 `@`

Hermes 支持在输入框中用 `@` 引入外部内容：

```
帮我看看 @./src/main.py 里 Server 类的初始化逻辑
对比 @git:HEAD~1 与 @git:HEAD 的差异
分析 @https://example.com/post 这篇博客的论点
解读 @./docs/spec.pdf
```

支持类型（`user-guide/features/context-references.md`）：

- 文件 / 目录：`@./path/file.py`、`@./src/`（递归）
- Git diff：`@git:<rev>`、`@git:<rev1>..<rev2>`
- URL：`@https://...`（自动 fetch + 转 markdown）
- PDF / Office 文件：`@./report.pdf`、`@./slides.pptx`
- 屏幕截图（多模态）：`@clipboard`（粘贴图片）

`@` 引用会被 **就地展开**，把内容附在你这条消息后面，再交给模型。这避免了"模型看不到我说的那个文件"的常见尴尬。

## 4.5 会话与历史

每条对话都被持久化到 `~/.hermes/hermes.db`。重要概念：

- **session**：一段连续对话，有 task_id；
- **task**：每条 user → assistant 的对话回合；
- **trajectory**：包括所有工具调用日志；
- **FTS5 索引**：让 `/recall` 与 `session_search` 工具可以快速搜文本。

`/sessions` 让你浏览历史；`/load <id>` 跳回去继续。

跨会话搜索的另一条路是直接在对话中指挥 Agent：

```
搜索我以前关于 PostgreSQL 索引性能的讨论，整理成一份 cheatsheet
```

Agent 会调用 `session_search` 工具，命中后再调用 LLM 摘要。

## 4.6 Compression：把"长会话"压成关键事实

会话越长，token 消耗越大。Hermes 的策略：

- 启动时按 **冻结快照** 注入 identity + memory + skills index；
- 持续监控上下文使用比例；
- 超过阈值（默认 50% 起预警，80% 起强制）时调用 `/compress` 把"前面 N 条"压成简洁摘要；
- 摘要使用 **Auxiliary Model**（一个相对便宜的模型，避免烧旗舰额度）；
- 关键工具结果（如 patch 应用记录）会被保留为压缩前的"事实条目"。

你可以手动 `/compress` 提前压；可以用 `/usage` 看是否快到阈值；可以在 `config.yaml` 调阈值：

```yaml
context:
  compress_threshold: 0.5
  hard_compress_threshold: 0.8
auxiliary_model: openrouter/openai/gpt-5-mini
```

## 4.7 Checkpoints 与 Rollback

每当 `terminal`、`patch`、`write_file` 等工具会写盘时，Hermes 会自动：

1. 计算受影响目录；
2. 用 `git`-like 算法生成快照存到 `~/.hermes/checkpoints/`；
3. 标记 checkpoint id，附在工具结果上。

之后你可以：

```
/checkpoint            # 列表
/rollback              # 回到最近一次自动 checkpoint
/rollback <name>       # 回到指定 checkpoint
/diff                  # 看从最近 checkpoint 起的改动
```

也可以在普通对话中说："撤销刚才那次改动"，Hermes 会自己理解并回滚。

详细见 `user-guide/checkpoints-and-rollback.md`。

## 4.8 Profile：CLI 中的多身份切换

第三章已经介绍过 profile，CLI 内可以这样使用：

```bash
hermes profile list
hermes --profile work       # 这次会话用 work profile
HERMES_PROFILE=work hermes  # 等价
```

每个 profile 有独立的 `~/.hermes/profiles/<name>/`，相当于一份完整 `~/.hermes/`。同一时间一个 profile 只允许一个 CLI/Gateway 进程占用（通过 token lock 实现，避免数据库被并发改坏）。

## 4.9 Personality 与 SOUL.md

- `SOUL.md` 是 Hermes 的"主身份"，第一槽位写入系统提示。**只从 `$HERMES_HOME/SOUL.md` 加载**，不会从当前工作目录读取——这保证了"换项目不换人格"。
- `/personality <preset>` 是对 SOUL 的**叠加层**（session-level overlay），适合临时切换风格："严肃技术顾问"、"幽默助理"、"冷酷代码评审"等。

修改自己的 SOUL：

```bash
nano ~/.hermes/SOUL.md
```

或在 TUI 里 `/soul`，会调系统编辑器。修改完保存即可，下次会话生效。

要让 Hermes 有完全不同的人设（比如把它包装成"客户支持助理 Lily"），重写 `SOUL.md` 是最干净的做法。详细模板见 `guides/use-soul-with-hermes.md`。

## 4.10 Skin / Theme：CLI 视觉皮肤

`hermes_cli/skin_engine.py` 让你能换：banner 颜色、spinner 表情和动词、回答框标签、品牌字、工具活动前缀。

```bash
hermes skin list
hermes skin use cyberpunk
hermes skin reset
```

或在 `config.yaml` 中：

```yaml
ui:
  skin: cyberpunk
  spinner: kawaii
```

更多预设 / 自定义见 `user-guide/features/skins.md`。

## 4.11 资深用法

### 4.11.1 一次性 Prompt 模式（headless）

```bash
hermes chat -q "总结一下 ~/code/myapp 这个项目的目录结构" --toolsets file,terminal
```

适合配合 shell 脚本，把 Hermes 当成强力 CLI。

### 4.11.2 把 Hermes 串到其它工具

```bash
cat error.log | hermes chat --toolsets file -q "诊断这段日志的根因"
```

stdin 会被自动当作附件注入。

### 4.11.3 自定义 toolset 组合

```bash
hermes chat --toolsets "web,search,terminal,file,delegation" -q "..."
```

或永久修改：

```yaml
toolsets:
  hermes-cli: [web, terminal, file, browser, vision, skills, memory, session_search, todo, clarify, code_execution, delegation, cronjob]
```

### 4.11.4 限制并发与速率

```bash
hermes config set tool_concurrency 4
hermes config set inference.max_iterations 30
```

### 4.11.5 Reasoning 显示

许多模型支持"扩展思考"（reasoning），Hermes 会在 `/raw` 模式下显式打出。可以这样切：

```bash
/raw           # 切换 raw
/reasoning     # 切换是否展示 reasoning
```

### 4.11.6 一边看 Trajectory 一边用

`hermes trajectory tail`（如有）和 `~/.hermes/logs/` 配合实时查看 Hermes 工具调用，便于做调试或写训练数据。

### 4.11.7 Headless API：`hermes api start`

`hermes api start --host 0.0.0.0 --port 8000` 起一个 OpenAI-Compatible 端点，把 Hermes 当成"自托管 ChatGPT"暴露给 Open WebUI / LobeChat / LibreChat：

```bash
curl http://localhost:8000/v1/chat/completions \
  -H 'Authorization: Bearer any-token' \
  -d '{"model":"hermes","messages":[{"role":"user","content":"hello"}]}'
```

详见 `user-guide/features/api-server.md`。第十一章会再展开。

## 4.12 一份"高效用 CLI"的清单

最后给你一份"打字习惯"清单，照着练 1 周你就成了 Hermes 老用户：

1. 默认开 TUI，永远把"想要 Agent 干"的事自然表达出来，不要纠结"如何 prompt"；
2. 不顺心就 `Ctrl+C` + 立即纠正方向；
3. 改文件之后 `/diff`，不放心 `/rollback`；
4. 会话长了 `/usage` 看一眼，必要时 `/compress`；
5. 想让它沉淀经验，直接说"把这一招记下来"——它会自动 `memory` 和必要时建 skill；
6. 切换关注的项目时 `cd` 进项目根，`@./` 引用自动让它读懂；
7. 每天结束让它写一段"今日复盘"，主动回写 `MEMORY.md`；
8. 定期 `/skills` 浏览 Hub，下载/裁剪你工作流相关的技能。

## 4.13 本章小结

- 你已经熟悉了 Hermes TUI 的布局、键位、状态栏；
- 掌握了几十条核心斜杠命令的分类与用法；
- 会用 `@` 引用文件 / git diff / URL / 图片 / PDF；
- 理解了 session、checkpoint、compression 三大"长寿命会话"机制；
- 学会了 profile、SOUL.md、personality、skin 这些定制点；
- 会用一次性 prompt 模式和 API server 把 Hermes 嵌入其它工具链。

下一章我们深入"模型层"：让 Hermes 真正发挥它"模型自由度"。
