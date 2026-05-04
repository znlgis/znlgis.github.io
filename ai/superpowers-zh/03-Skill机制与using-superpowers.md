# 第三章：Skill 机制与 using-superpowers

## 3.1 Skill 的基本结构

superpowers-zh 的每个 Skill 都是一个独立目录，核心文件为 `SKILL.md`。文件开头使用 frontmatter 描述元数据：

```yaml
---
name: test-driven-development
description: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
---
```

其中：

- `name` 是 Skill 的唯一名称，用于工具发现和用户引用。
- `description` 是触发条件，告诉 AI 何时应该加载这个 Skill。
- frontmatter 之后是完整流程、检查清单、红线、示例和集成关系。

Skill 的设计重点不是给人读的知识点摘要，而是给 AI 执行的操作规程。因此它通常会写得非常明确，包括「必须」「绝不」「如果发生 X 就停下来」等强约束。

## 3.2 using-superpowers 的地位

`using-superpowers` 是所有 Skills 的入口规则。它的核心思想是：

> 如果某个 Skill 有哪怕 1% 的可能性适用于当前任务，AI 就必须先调用该 Skill 检查。

这条规则解决了一个根本问题：AI 容易凭记忆或惯性工作，即使项目安装了 Skills，也可能不主动使用。`using-superpowers` 要求 AI 在任何响应或操作前先做 Skill 匹配，包括澄清性问题之前。

它还定义了优先级：

1. 用户明确指令最高。
2. Superpowers Skills 其次。
3. 默认系统提示最低。

也就是说，Skills 是工作方法论，但不能覆盖用户明确要求。如果用户和仓库规范要求某种流程，应优先遵守用户和项目约定。

## 3.3 Skill 路由逻辑

实际使用时，可以把 Skill 路由理解为一个决策表：

| 场景 | 应优先使用的 Skill |
|------|--------------------|
| 新功能、组件、行为变更 | `brainstorming` |
| 已有设计，需要拆实施步骤 | `writing-plans` |
| 有书面计划，需要执行 | `executing-plans` 或 `subagent-driven-development` |
| 写新功能、修 Bug、重构 | `test-driven-development` |
| 测试失败、构建失败、线上 Bug | `systematic-debugging` |
| 声称完成、提交、PR 前 | `verification-before-completion` |
| 完成重要功能后 | `requesting-code-review` |
| 收到审查反馈后 | `receiving-code-review` |
| 多个独立问题域 | `dispatching-parallel-agents` |
| 需要隔离开发空间 | `using-git-worktrees` |
| 中文文档 | `chinese-documentation` |
| 中文 Commit | `chinese-commit-conventions` |
| 国内 Git 平台 | `chinese-git-workflow` |
| 构建 MCP Server | `mcp-builder` |
| 多角色 YAML 编排 | `workflow-runner` |

路由不是互斥的。一个任务可能同时触发多个 Skills。例如「给中文项目新增功能」通常先用 `brainstorming`，编码阶段用 `test-driven-development`，提交时用 `chinese-commit-conventions`，完成前用 `verification-before-completion`。

## 3.4 刚性 Skill 与灵活 Skill

superpowers-zh 中有些 Skill 是刚性的，例如：

- `test-driven-development`
- `systematic-debugging`
- `verification-before-completion`

这些 Skill 的价值来自纪律。如果 AI 说「这次情况特殊」「先写代码再补测试也一样」「看起来好了」，就违背了 Skill 的目的。

另一些 Skill 更偏模式和指导，例如：

- `chinese-documentation`
- `chinese-code-review`
- `chinese-git-workflow`
- `mcp-builder`

它们仍然有规范，但需要结合团队实际调整。例如中文代码审查的表达可以按团队文化微调，Git 工作流可以在主干开发、Git Flow 和简化 dev/main 流程中选择。

## 3.5 为什么要在响应前加载 Skill

很多人第一次看到 `using-superpowers` 会觉得「太严格」。但这条规则针对的是 AI 的典型失败模式：

- 先回答，再发现应该先问问题。
- 先改代码，再发现应该先写测试。
- 先给结论，再发现没有跑验证。
- 先接受审查意见，再发现建议不适用于当前代码库。

在响应前加载 Skill，可以让流程影响第一步行动。第一步一旦错了，后面很难补救。例如 TDD 要求先看到失败测试，如果先写了生产代码，后补测试就不再等价。

## 3.6 与工具能力的关系

不同 AI 工具对 Skill 的支持程度不同：

- 有些工具有真正的 Skill/Agent 工具，可以按需加载完整 Skill。
- 有些工具只能通过自定义指令引用 Markdown。
- 有些工具支持子 Agent，有些不支持。
- 有些工具支持项目级规则，有些只支持用户级规则。

因此，使用 superpowers-zh 时要区分两层：

1. **方法论层：** Skill 规定该怎么做。
2. **工具适配层：** 当前 AI 工具能否自动发现、加载和执行这些流程。

如果工具不支持自动调用 Skill，也可以通过项目规则要求 AI 在对应场景读取 Skill 文件。但要注意，这种方式依赖模型遵守规则，强度弱于原生 Skill 工具。

## 3.7 如何判断 AI 是否真正遵守 Skill

判断标准不是 AI 有没有说「我会使用某某 Skill」，而是看行为：

### brainstorming

- 是否先探索项目上下文？
- 是否逐个提澄清问题？
- 是否给出 2-3 种方案及权衡？
- 是否在获得批准前避免实现？

### test-driven-development

- 是否先写失败测试？
- 是否实际运行并看到失败？
- 是否只写最少代码让测试通过？
- 是否在重构后保持测试通过？

### systematic-debugging

- 是否先阅读错误、稳定复现、检查近期变更？
- 是否提出单一假设并最小化验证？
- 是否避免「试试看」式补丁？

### verification-before-completion

- 是否运行了能证明结论的命令？
- 是否阅读输出和退出码？
- 是否用证据表述结果，而不是说「应该可以」？

如果 AI 只是口头声明但没有执行这些动作，就应提醒它重新加载并严格执行对应 Skill。

## 3.8 在项目中建立 Skill 纪律

个人使用时，可以靠提示词显式要求：

```text
开始前请先使用 superpowers-zh 的 using-superpowers，判断需要调用哪些 Skill。
```

团队使用时，建议把规则写入项目级自定义指令：

```markdown
本项目使用 superpowers-zh。任何任务开始前必须先判断是否有匹配 Skill：

- 新需求先使用 brainstorming。
- 编码和修 Bug 遵循 TDD。
- Bug/测试失败先使用 systematic-debugging。
- 声称完成前必须运行验证。
- 中文文档遵循 chinese-documentation。
```

更进一步，可以在 PR 模板中加入检查项：

```markdown
- [ ] 已在实现前澄清需求或引用设计说明
- [ ] 新行为有测试，且测试先失败后通过
- [ ] 已运行构建/测试/文档生成验证
- [ ] 中文文档符合中英混排规范
```

## 3.9 常见误区

### 误区一：安装了就自动变强

安装只是把流程文件放到工具能看到的位置。AI 是否遵守还取决于工具机制、项目指令和用户监督。

### 误区二：把 Skill 当知识库

Skill 不是百科文档，而是流程约束。不要只摘录知识点，要让 AI 按步骤行动。

### 误区三：所有任务都套完整流程

Skill 讲究匹配场景。简单解释性问题不需要进入完整开发流程；但只要涉及实现、修复、审查、验证，就应启用相应 Skill。

### 误区四：多个 Skill 冲突时随意选择

通常按「流程 Skill 优先，领域 Skill 叠加」处理。例如构建 MCP Server 时，先用 `brainstorming` 做需求设计，再用 `mcp-builder` 指导实现细节，编码时仍遵循 TDD 和验证。

## 3.10 本章小结

`using-superpowers` 是 superpowers-zh 的总开关。它要求 AI 在行动前先判断适用 Skill，避免凭惯性直接编码。理解这套路由机制后，后续学习每个 Skill 才有意义。否则即使安装了 20 个 Skills，AI 也可能只把它们当作可选参考，而不是必须遵守的工程纪律。
