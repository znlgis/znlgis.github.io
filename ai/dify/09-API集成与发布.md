---
layout: default
title: 第九章：API 集成与发布
---

# 第九章：API 集成与发布

## 9.1 应用发布概述

### 9.1.1 发布的意义

在 Dify 中完成应用的开发和测试后，需要将应用发布才能供外部使用。发布后的应用可以通过多种方式访问：

- **WebApp**：独立的网页应用
- **API**：程序化调用接口
- **嵌入**：嵌入到现有网站

### 9.1.2 发布方式对比

| 发布方式 | 适用场景 | 特点 |
|---------|---------|------|
| WebApp | 直接给终端用户使用 | 开箱即用、可定制 UI |
| API | 集成到现有系统 | 灵活、可编程 |
| 嵌入 | 在现有网站中添加 AI 功能 | 简单、快速集成 |

### 9.1.3 发布流程

```
开发应用 → 调试测试 → 发布 → 获取访问方式 → 配置权限 → 对外使用
```

## 9.2 发布应用

### 9.2.1 发布步骤

**步骤一：确认应用就绪**
- 完成所有配置
- 通过调试测试
- 检查提示词和参数

**步骤二：点击发布**
1. 进入应用编排界面
2. 点击右上角"发布"按钮
3. 填写版本说明（可选）
4. 确认发布

**步骤三：获取访问信息**
发布后自动生成：
- WebApp 访问链接
- API 端点
- 嵌入代码

### 9.2.2 版本管理

**查看版本历史**：
1. 进入应用设置
2. 点击"版本"选项卡
3. 查看所有发布版本

**版本操作**：
- 查看版本详情
- 对比版本差异
- 回滚到历史版本

## 9.3 WebApp 访问

### 9.3.1 WebApp 类型

根据应用类型，WebApp 有不同的界面风格：

**聊天助手 WebApp**：
- 类似 ChatGPT 的聊天界面
- 支持多轮对话
- 显示开场白和建议问题

**文本生成 WebApp**：
- 表单输入 + 结果展示
- 单次任务处理
- 支持自定义输入字段

**工作流 WebApp**：
- 参数输入表单
- 执行进度展示
- 结果输出

### 9.3.2 获取 WebApp 链接

**获取方式**：
1. 进入应用详情
2. 点击"访问 API" 或 "监控"
3. 复制 WebApp URL

**URL 格式**：
```
https://your-dify-domain/chat/app-id
https://your-dify-domain/completion/app-id
https://your-dify-domain/workflow/app-id
```

### 9.3.3 自定义 WebApp

**可定制项**：
- 应用名称和图标
- 主题颜色
- 开场白内容
- 版权信息

**高级定制**：
通过修改前端代码实现深度定制（需要技术能力）。

## 9.4 API 访问

### 9.4.1 API 认证

**获取 API 密钥**：
1. 进入应用详情
2. 点击"访问 API"
3. 创建新的 API 密钥
4. 复制保存密钥

**认证方式**：
```bash
# 在请求头中添加
Authorization: Bearer YOUR_API_KEY
```

### 9.4.2 API 端点

**基础 URL**：
```
https://api.dify.ai/v1  # Dify 云服务
https://your-domain/v1  # 自部署
```

**主要端点**：

| 应用类型 | 端点 | 方法 |
|---------|------|------|
| 聊天助手 | /chat-messages | POST |
| 文本生成 | /completion-messages | POST |
| 工作流 | /workflows/run | POST |

### 9.4.3 聊天助手 API

**请求示例**：
```bash
curl -X POST 'https://api.dify.ai/v1/chat-messages' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": {},
    "query": "你好，请介绍一下你自己",
    "response_mode": "blocking",
    "conversation_id": "",
    "user": "user-123"
  }'
```

**参数说明**：
```yaml
inputs: 开始节点的输入变量（对象）
query: 用户输入的问题（必填）
response_mode: 响应模式
  - blocking: 阻塞式，等待完整响应
  - streaming: 流式，逐步返回
conversation_id: 会话 ID（留空创建新会话）
user: 用户标识（必填）
files: 上传的文件列表（可选）
```

**响应示例**：
```json
{
  "message_id": "a9c9e7c0-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "conversation_id": "45701982-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "mode": "chat",
  "answer": "你好！我是一个 AI 助手...",
  "metadata": {
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 100,
      "total_tokens": 150
    }
  },
  "created_at": 1705395332
}
```

### 9.4.4 流式响应

**请求**：
```bash
curl -X POST 'https://api.dify.ai/v1/chat-messages' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": {},
    "query": "写一首关于春天的诗",
    "response_mode": "streaming",
    "user": "user-123"
  }'
```

**流式响应格式**：
```
data: {"event": "message", "message_id": "xxx", "answer": "春"}
data: {"event": "message", "message_id": "xxx", "answer": "天"}
data: {"event": "message", "message_id": "xxx", "answer": "来"}
...
data: {"event": "message_end", "metadata": {...}}
```

### 9.4.5 文本生成 API

**请求示例**：
```bash
curl -X POST 'https://api.dify.ai/v1/completion-messages' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": {
      "source_text": "Hello, how are you?",
      "target_language": "中文"
    },
    "response_mode": "blocking",
    "user": "user-123"
  }'
```

**响应**：
```json
{
  "message_id": "xxx",
  "mode": "completion",
  "answer": "你好，你好吗？",
  "metadata": {
    "usage": {...}
  }
}
```

### 9.4.6 工作流 API

**运行工作流**：
```bash
curl -X POST 'https://api.dify.ai/v1/workflows/run' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": {
      "text": "需要处理的文本"
    },
    "response_mode": "blocking",
    "user": "user-123"
  }'
```

**响应**：
```json
{
  "workflow_run_id": "xxx",
  "task_id": "xxx",
  "data": {
    "id": "xxx",
    "workflow_id": "xxx",
    "status": "succeeded",
    "outputs": {
      "result": "处理结果"
    },
    "total_tokens": 500,
    "created_at": 1705395332,
    "finished_at": 1705395340
  }
}
```

### 9.4.7 会话管理 API

**获取会话列表**：
```bash
curl -X GET 'https://api.dify.ai/v1/conversations?user=user-123&limit=20' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**获取会话消息**：
```bash
curl -X GET 'https://api.dify.ai/v1/messages?conversation_id=xxx&user=user-123&limit=20' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**删除会话**：
```bash
curl -X DELETE 'https://api.dify.ai/v1/conversations/xxx' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"user": "user-123"}'
```

### 9.4.8 反馈 API

**提交消息反馈**：
```bash
curl -X POST 'https://api.dify.ai/v1/messages/xxx/feedbacks' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "rating": "like",
    "user": "user-123"
  }'
```

**rating 可选值**：
- `like`：点赞
- `dislike`：点踩
- `null`：取消反馈

## 9.5 嵌入网站

### 9.5.1 iframe 嵌入

**获取嵌入代码**：
1. 进入应用详情
2. 点击"嵌入"选项
3. 复制 iframe 代码

**代码示例**：
```html
<iframe
  src="https://your-dify-domain/chatbot/app-id"
  style="width: 100%; height: 600px; border: none;"
  allow="microphone">
</iframe>
```

### 9.5.2 聊天气泡嵌入

**嵌入代码**：
```html
<script>
  window.difyChatbotConfig = {
    token: 'YOUR_APP_TOKEN',
    baseUrl: 'https://your-dify-domain'
  };
</script>
<script
  src="https://your-dify-domain/embed.min.js"
  defer>
</script>
```

**自定义配置**：
```javascript
window.difyChatbotConfig = {
  token: 'YOUR_APP_TOKEN',
  baseUrl: 'https://your-dify-domain',
  isDev: false,
  inputs: {
    // 预设的输入变量
  },
  containerProps: {
    style: {
      // 自定义样式
    }
  }
};
```

### 9.5.3 React 组件集成

**安装**：
```bash
npm install @dify-ai/chatbot-sdk
```

**使用**：
```jsx
import { ChatBot } from '@dify-ai/chatbot-sdk';

function App() {
  return (
    <ChatBot
      token="YOUR_APP_TOKEN"
      baseUrl="https://your-dify-domain"
    />
  );
}
```

## 9.6 SDK 使用

### 9.6.1 Python SDK

**安装**：
```bash
pip install dify-client
```

**使用示例**：
```python
from dify_client import ChatClient

# 初始化客户端
client = ChatClient(
    api_key="YOUR_API_KEY",
    base_url="https://api.dify.ai/v1"
)

# 发送消息
response = client.create_chat_message(
    inputs={},
    query="你好",
    user="user-123"
)

print(response.answer)
```

**流式调用**：
```python
from dify_client import ChatClient

client = ChatClient(api_key="YOUR_API_KEY")

# 流式响应
for chunk in client.create_chat_message_stream(
    inputs={},
    query="写一首诗",
    user="user-123"
):
    if chunk.event == "message":
        print(chunk.answer, end="", flush=True)
    elif chunk.event == "message_end":
        print("\n完成")
```

### 9.6.2 JavaScript SDK

**安装**：
```bash
npm install dify-client
```

**使用示例**：
```javascript
import { DifyClient, ChatClient } from 'dify-client';

const client = new ChatClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://api.dify.ai/v1'
});

// 发送消息
const response = await client.createChatMessage({
  inputs: {},
  query: '你好',
  user: 'user-123'
});

console.log(response.answer);
```

**流式调用**：
```javascript
const stream = await client.createChatMessageStream({
  inputs: {},
  query: '写一首诗',
  user: 'user-123'
});

for await (const chunk of stream) {
  if (chunk.event === 'message') {
    process.stdout.write(chunk.answer);
  }
}
```

## 9.7 安全与权限

### 9.7.1 API 密钥管理

**最佳实践**：
- 为不同用途创建不同的密钥
- 定期轮换密钥
- 不在前端代码中暴露密钥
- 使用环境变量存储密钥

**密钥权限**：
```yaml
权限范围:
  - 调用应用 API
  - 管理会话
  - 提交反馈
不包含:
  - 修改应用配置
  - 删除应用
  - 管理其他应用
```

### 9.7.2 访问控制

**IP 白名单**（企业版）：
```yaml
允许的 IP:
  - 192.168.1.0/24
  - 10.0.0.100
```

**速率限制**：
```yaml
默认限制:
  每分钟: 60 次
  每天: 10000 次
可配置:
  根据套餐和需求调整
```

### 9.7.3 数据安全

**传输安全**：
- 强制 HTTPS
- TLS 1.2+

**数据存储**：
- API 密钥加密存储
- 对话数据可配置保留策略
- 支持数据导出和删除

### 9.7.4 用户标识

**user 参数的作用**：
- 区分不同终端用户
- 会话隔离
- 用量统计
- 审计追踪

**建议做法**：
```python
# 使用有意义但不敏感的用户标识
user_id = f"user_{hash(email)[:8]}"

# 而不是
user_id = email  # 不推荐，可能泄露隐私
```

## 9.8 监控与日志

### 9.8.1 访问监控面板

1. 进入应用详情
2. 点击"监控"选项卡
3. 查看各项指标

### 9.8.2 监控指标

**调用统计**：
- 总调用次数
- 成功率
- 平均响应时间
- 活跃用户数

**Token 消耗**：
- 总 Token 数
- 输入/输出 Token 分布
- 成本估算

**质量指标**：
- 用户反馈（点赞/点踩）
- 平均对话轮次
- 知识库命中率

### 9.8.3 日志查看

**日志内容**：
- 用户输入
- AI 响应
- Token 消耗
- 响应时间
- 工具调用记录

**日志过滤**：
- 按时间范围
- 按用户
- 按会话
- 按反馈类型

## 9.9 集成示例

### 9.9.1 Python Flask 集成

```python
from flask import Flask, request, jsonify
from dify_client import ChatClient

app = Flask(__name__)
client = ChatClient(api_key="YOUR_API_KEY")

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_id = data.get('user_id')
    message = data.get('message')
    conversation_id = data.get('conversation_id', '')
    
    response = client.create_chat_message(
        inputs={},
        query=message,
        user=user_id,
        conversation_id=conversation_id
    )
    
    return jsonify({
        'answer': response.answer,
        'conversation_id': response.conversation_id
    })

if __name__ == '__main__':
    app.run()
```

### 9.9.2 Node.js Express 集成

```javascript
const express = require('express');
const { ChatClient } = require('dify-client');

const app = express();
app.use(express.json());

const client = new ChatClient({
  apiKey: 'YOUR_API_KEY'
});

app.post('/chat', async (req, res) => {
  const { userId, message, conversationId } = req.body;
  
  try {
    const response = await client.createChatMessage({
      inputs: {},
      query: message,
      user: userId,
      conversationId: conversationId || ''
    });
    
    res.json({
      answer: response.answer,
      conversationId: response.conversationId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### 9.9.3 微信小程序集成

```javascript
// pages/chat/chat.js
const API_KEY = 'YOUR_API_KEY';
const BASE_URL = 'https://your-dify-domain/v1';

Page({
  data: {
    messages: [],
    inputValue: '',
    conversationId: ''
  },
  
  async sendMessage() {
    const { inputValue, conversationId } = this.data;
    
    wx.request({
      url: `${BASE_URL}/chat-messages`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        inputs: {},
        query: inputValue,
        user: wx.getStorageSync('userId'),
        conversation_id: conversationId,
        response_mode: 'blocking'
      },
      success: (res) => {
        this.setData({
          messages: [...this.data.messages, {
            role: 'user',
            content: inputValue
          }, {
            role: 'assistant',
            content: res.data.answer
          }],
          conversationId: res.data.conversation_id,
          inputValue: ''
        });
      }
    });
  }
});
```

## 9.10 本章小结

通过本章的学习，你应该掌握：

1. **发布流程**：了解应用发布的完整流程
2. **访问方式**：掌握 WebApp、API、嵌入三种访问方式
3. **API 调用**：熟练使用各类 API 端点
4. **SDK 使用**：会使用 Python 和 JavaScript SDK
5. **安全配置**：了解 API 密钥管理和安全最佳实践
6. **集成开发**：能够将 Dify 集成到各种应用中

## 9.11 思考与练习

1. **实践练习**：
   - 发布一个聊天应用并获取 API 密钥
   - 使用 Python SDK 实现一个简单的命令行聊天程序
   - 将 Dify 聊天气泡嵌入到一个网页中

2. **思考题**：
   - 如何在生产环境中安全地管理 API 密钥？
   - 流式响应和阻塞响应各有什么优缺点？
   - 如何设计一个高并发的 AI 应用架构？

---

**下一章预告**：第十章将介绍最佳实践与进阶技巧，包括提示词工程、性能优化和企业级部署方案。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/ai/dify/08-模型接入与配置/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/ai/dify/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/ai/dify/10-最佳实践与进阶技巧/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
