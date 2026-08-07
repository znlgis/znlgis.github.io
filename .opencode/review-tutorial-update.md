# Code Review — 教程更新 (v23 同步)

**Path**: Full (13 files, ~2000 effective lines)
**severity summary**: `critical: 1 | major: 7 | minor: 12 | nit: 0`

---

## [critical] `/commit` 命令引用了已删除的 `conventional-commits` 技能

**location**: `07-命令别名完整指南.md:645-647`, `07:994`, `10-典型工作流实战.md:550`

**issue**: `/commit` 命令的触发技能标注为 `conventional-commits`，template 以 `Load the conventional-commits skill.` 开头。但该技能已于 v21.1 移除，源码 opencode.jsonc:147-151 中 `/commit` 不加载任何 skill，Conventional Commits 规范已内联于 template 中。

**fix**: 将触发技能改为"无（内联规范）"，template 替换为源码实际内容。

---

## [major] Chapter 03：`fallback` 字段展示但源码已移除

**location**: `03-模型配置详解.md:171-186, 190-191, 354-355, 563-564`

**issue**: 教程展示了包含 fallback 字段的配置片段，但源码 opencode.jsonc:64 明确注释 `fallback is not a real schema key — omitted`。Chapter 11 自己记录了 v22.1 删除 fallback 死键，但 Chapter 03 未同步。

**fix**: 替换配置片段为当前实际配置（无 fallback），标注 fallback 相关描述为已废弃。

---

## [major] Chapter 10：多处引用已移除的 `diagnose` 技能

**location**: `10-典型工作流实战.md:58, 419, 422-431, 575, 1068`

**issue**: 工作流示例中多处引用 `diagnose` 技能，包括完整的 6 阶段调试表格（422-431）。该技能在 v21.1 移除，源码 skills/ 无 diagnose 目录。

**fix**: 删除所有 diagnose 引用，调试工作流改为基于 `systematic-debugging`（superpowers）+ oracle 根因分析。

---

## [major] Chapter 07：`/simplify` 命令模板与源码不一致

**location**: `07-命令别名完整指南.md:600`

**issue**: 教程 template 暗示 oracle 会直接修改代码并验证，但源码 template 明确要求 oracle 只输出简化方案（"Do not modify files yourself — output the simplification plan only"），由 writer agent 实施。

**fix**: 替换为源码实际 template。

---

## [major] Chapter 12：命令速查表含 9 条已删除命令

**location**: `12-最佳实践与定制指南.md:1255-1277`

**issue**: 速查表列出 23 条命令，其中 9 条不存在（/review-loop, /docs, /explore, /propose, /apply, /archive, /update, /learn, /skill）。与第七章（18 条）严重不一致。

**fix**: 替换为与 07:1027-1046 一致的 18 条命令速查表。

---

## [major] Chapter 12：spec-workflow 和技能速查表使用旧命令

**location**: `12-最佳实践与定制指南.md:1018-1021, 1279-1294`

**issue**: spec-workflow 流程用 `/explore → /propose → /apply → /archive`（已变更为 /spec-propose → /spec-apply）。技能速查表触发列引用 /propose, /apply, /archive, /docs（均不存在）。

**fix**: 改为当前命令链和触发方式。

---

## [major] Chapter 01：命令链示例使用旧命令

**location**: `01-项目概览与核心定位.md:269`

**issue**: `/explore → /propose → /apply → /review → /rmslop → /commit` 中前三个命令已改为 /spec-propose → /spec-apply。

**fix**: 改为 `/spec-propose → /spec-apply → /review → /rmslop → /commit`。

---

## [minor] 残留命令引用

| 位置 | 内容 |
|------|------|
| `02-安装部署与环境配置.md:452` | 引用 `/skill` 命令查看技能 |
| `03-模型配置详解.md:619` | "11 个 Agent" → 应为 10 个 |
| `05-Orchestrator路由机制深度解析.md:563` | 注释引用 `/explore`, `/debug`, `/security` |
| `06-技能体系与插件生态.md:45,84,316,509,519,524` | 6 处 `/review-loop`, `/propose`, `/apply`, `/archive` 残留 |
| `08-配置文件完全参考.md:585` | `/propose` → 应为 `/spec-propose` |
| `08-配置文件完全参考.md:10` | `.ai/calibration.yml` 描述错误（不是模型校准，是 code-review 严重度校准） |
| `10-典型工作流实战.md:1068` | "18 个技能" → 应为 16 个 |
| `11-设计决策与迭代历程.md:655` | "现状"描述使用旧命令链 |
| `12-最佳实践与定制指南.md:30` | 常用命令列表含 `/review-loop` |

---

## 整体评估

**不建议合并当前状态**（1 critical + 7 major 阻塞）。核心问题：v21-v23 精简迭代后部分章节未同步更新，导致 `conventional-commits`、`diagnose`、`fallback` 三个已移除特性仍在教程中以"当前可用"形态出现。第 12 章附录与第 7 章正文的 23 vs 18 条命令差异是全教程最大的一致性缺陷。

**What Looks Good**:
- 第 7 章自身 18 条命令定义完全准确
- 第 11 章历史引用处理精确（旧命令仅出现在历史版本描述中）
- AGENTS.md 212 行、技能 16 个、Agent 10 个、DCP 35K-75K 等核心数据在大部分章节一致
- 新增技能（shared-language, writing-great-skills）和核心原则（#9, #10）有完整解读
