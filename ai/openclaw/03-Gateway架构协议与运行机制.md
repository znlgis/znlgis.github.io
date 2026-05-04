---
layout: default
title: 第三章：Gateway 架构、协议与运行机制
---

# 第三章：Gateway 架构、协议与运行机制

OpenClaw 的核心是 Gateway。它是长生命周期控制平面，负责连接通道、客户端、节点、Agent、工具和配置。

## 3.1 Gateway 职责

Gateway 维护聊天通道连接，暴露默认 `127.0.0.1:18789` 的 HTTP/WebSocket 服务，处理入站消息、DM pairing、allowlist、群聊 mention、Agent 路由、模型调用、工具策略、节点配对、配置热加载、健康检查和事件分发。

## 3.2 高层流程

```text
聊天平台 / WebChat / CLI / Control UI / 节点
              │
              ▼
        OpenClaw Gateway
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
    通道层   Agent层   工具/插件/节点层
              │
              ▼
          模型与本地能力
```

一次消息通常经过：通道适配、触发授权、会话选择、Agent 路由、模型推理、工具执行、回复分发。

## 3.3 WebSocket 协议

客户端连接 Gateway 后第一帧必须是 `connect`。握手后使用请求/响应和事件模型：

```json
{"type":"req","id":"1","method":"health","params":{}}
```

返回：

```json
{"type":"res","id":"1","ok":true,"payload":{}}
```

事件示例：`agent`、`chat`、`presence`、`health`、`heartbeat`、`cron`。副作用方法如 send、agent 应使用幂等键，避免重试造成重复动作。

## 3.4 客户端与节点

普通客户端包括 CLI、Control UI、桌面应用、自动化脚本。节点以 `role: node` 连接，声明设备身份、能力和命令，例如 Canvas、摄像头、屏幕、位置、语音等。节点配对后属于同一操作员信任域，应谨慎开放给共享通道 Agent。

## 3.5 Canvas 与 A2UI

Gateway 还承载 Canvas：`/__openclaw__/canvas/` 与 `/__openclaw__/a2ui/`。Canvas 允许 Agent 生成和驱动可视化界面，适合展示图表、任务状态、演示和移动端 UI。由于涉及可执行 UI 能力，远程暴露时必须配合 Gateway auth 和工具策略。

## 3.6 配置热加载

Gateway 读取 `~/.openclaw/openclaw.json` 并严格校验 schema。配置错误会导致启动失败或热加载被拒。排查顺序：`openclaw doctor`、`openclaw config schema`、Control UI Config 页面、日志。

## 3.7 关键不变量

- 一个 Gateway 是一个信任边界，不是强多租户隔离。
- `sessionKey` 是路由选择，不是认证令牌。
- Gateway auth、device pairing、DM allowlist、tool policy、sandbox 是不同层级控制。
- 同一平台会话通常应由一个 Gateway 控制，避免状态冲突。
- 本地 loopback 便利不代表可以直接公网暴露。

## 3.8 小结

理解 Gateway 后，OpenClaw 的其他功能都更清晰：通道是入口，Agent 是执行者，工具是行动力，技能是方法，插件是扩展，安全策略则由 Gateway 统一协调。
