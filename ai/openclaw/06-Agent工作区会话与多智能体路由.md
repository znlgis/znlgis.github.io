---
layout: default
title: 第六章：Agent 工作区、会话与多智能体路由
---

# 第六章：Agent 工作区、会话与多智能体路由

OpenClaw 的 Agent 层把入站消息转成智能体任务，并组合模型、工具、技能、工作区和会话。

## 6.1 工作区

默认工作区常为：

```text
~/.openclaw/workspace
```

配置：

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } }
}
```

工作区是 Agent 的长期环境，包含提示文件、技能、用户资料、工具笔记和任务产物。

## 6.2 引导文件

OpenClaw 会读取工作区中的用户可编辑文件并注入新会话上下文：`AGENTS.md`、`SOUL.md`、`TOOLS.md`、`BOOTSTRAP.md`、`IDENTITY.md`、`USER.md`。空文件跳过，大文件会裁剪。`BOOTSTRAP.md` 通常只用于全新工作区首次运行，完成后可删除。

禁用 bootstrap：

```json5
{ agents: { defaults: { skipBootstrap: true } } }
```

## 6.3 会话存储

会话一般存储在：

```text
~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl
```

`sessionKey` 是路由和上下文选择，不是认证令牌。常见工具包括 `sessions_list`、`sessions_history`、`sessions_send`、`sessions_spawn`、`session_status`。

## 6.4 DM 隔离

共享入口建议：

```json5
{ session: { dmScope: "per-channel-peer" } }
```

多账号场景可考虑 `per-account-channel-peer`。这能减少上下文串扰，但不提供强多租户权限隔离。

## 6.5 队列与 streaming

当 Agent 运行中又收到消息，OpenClaw 可使用 steering、followup 或 collect 等模式处理。`steer` 适合实时对话，`followup/collect` 适合长任务。块级 streaming 可减少长回复等待，但在某些通道会刷屏，应谨慎启用。

## 6.6 多 Agent

多 Agent 用于不同入口、不同任务和不同信任边界：

```json5
{
  agents: {
    list: [
      { id: "main", workspace: "~/.openclaw/workspace-main" },
      { id: "writer", workspace: "~/.openclaw/workspace-writer", skills: ["writing"] },
      { id: "team-chat", workspace: "~/.openclaw/workspace-team", tools: { profile: "messaging" } },
    ],
  },
}
```

具体路由字段以当前 schema 为准。

## 6.7 技能 allowlist

```json5
{
  agents: {
    defaults: { skills: ["github", "weather"] },
    list: [
      { id: "writer" },
      { id: "docs", skills: ["docs-search"] },
      { id: "locked-down", skills: [] },
    ],
  },
}
```

省略 Agent skills 表示继承；空数组表示无技能；非空数组是最终集合，不与 defaults 合并。

## 6.8 小结

Agent 工作区和会话决定 OpenClaw 的长期记忆与执行环境。个人使用可先一个 Agent，接入团队或公共通道后应拆分 Agent、workspace、skills 和工具 profile。
