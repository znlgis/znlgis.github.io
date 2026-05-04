---
layout: default
title: 第九章：Control UI、节点、Canvas 与语音能力
---

# 第九章：Control UI、节点、Canvas 与语音能力

OpenClaw 不只在聊天平台中工作，还提供浏览器 Control UI、桌面/移动节点、Canvas 和语音能力，让 AI 助手更像跨设备个人助手。

## 9.1 Control UI

打开：

```bash
openclaw dashboard
```

默认地址通常是 `http://127.0.0.1:18789/`。Control UI 可用于聊天、查看流式事件、修改配置、查看 Gateway 状态、管理节点、调试会话和模型。新手应先用 Control UI 验证 Gateway 和模型，再接入复杂通道。

## 9.2 自定义控制台

可把自定义构建挂载到 Gateway：

```json5
{
  gateway: {
    controlUi: {
      enabled: true,
      root: "$HOME/.openclaw/control-ui-custom",
    },
  },
}
```

重启后访问 dashboard。适合本地化、主题定制或企业 UI。

## 9.3 节点

节点以 `role: node` 连接 Gateway，声明设备身份、能力和命令。常见节点包括 macOS、iOS、Android、headless。节点可能提供 Canvas、摄像头、屏幕、位置、语音和设备动作。节点配对后属于同一操作员信任域，不要把节点能力开放给共享群聊强权限 Agent。

## 9.4 Canvas

Canvas 是 Agent 可驱动的视觉工作区，可用于展示图表、任务状态、可视化分析、临时 UI 和交互式结果。Gateway 提供 `/__openclaw__/canvas/` 和 `/__openclaw__/a2ui/` 路径。Canvas 能力涉及 UI 执行和设备显示，远程访问时必须配合 auth 与工具策略。

## 9.5 语音能力

OpenClaw 文档中提到 Voice Wake、Talk Mode、TTS 和移动端语音能力。macOS/iOS 可提供唤醒或按键讲话，Android 可提供连续语音模式，`tts` 可做文本转语音。语音让 OpenClaw 从文字助手扩展为随身助手，但也涉及麦克风权限、设备配对和隐私。

## 9.6 WebChat 与远程使用

WebChat 通过 Gateway WebSocket API 聊天。远程访问优先 SSH tunnel：

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

然后本地访问 `http://127.0.0.1:18789/`。也可使用 Tailscale/VPN，但仍应保留 Gateway auth。

## 9.7 小结

Control UI、节点、Canvas 和语音扩展了 OpenClaw 的交互边界，也扩大了攻击面。使用时始终考虑设备配对、节点能力、网络访问、工具策略和隐私权限。
