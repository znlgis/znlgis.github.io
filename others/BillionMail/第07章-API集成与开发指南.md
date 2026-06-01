---
layout: default
title: 第07章 API集成与开发指南
---

# 第07章 API集成与开发指南

## 7.1 API 概述

BillionMail 提供了完整的 REST API，允许开发者将邮件功能集成到任何应用程序中。本章将详细介绍如何使用这些 API。

### 7.1.1 API 基础

**API 端点**

BillionMail API 的基础 URL：
```
https://your-domain.com/api/v1
```

所有 API 端点都以此基础 URL 开头。

**HTTP 方法**

API 使用标准的 HTTP 方法：
- **GET**：获取资源
- **POST**：创建资源
- **PUT**：更新资源（完整更新）
- **PATCH**：更新资源（部分更新）
- **DELETE**：删除资源

**请求格式**

所有请求应使用 JSON 格式：
```http
Content-Type: application/json
```

**响应格式**

所有响应都是 JSON 格式：
```json
{
  "success": true,
  "code": 0,
  "msg": "操作成功",
  "data": {
    // 响应数据
  }
}
```

**HTTP 状态码**

- **200 OK**：请求成功
- **201 Created**：资源创建成功
- **400 Bad Request**：请求参数错误
- **401 Unauthorized**：未认证或认证失败
- **403 Forbidden**：没有权限
- **404 Not Found**：资源不存在
- **429 Too Many Requests**：超过速率限制
- **500 Internal Server Error**：服务器错误

### 7.1.2 认证

BillionMail API 使用 API 密钥进行认证。

**生成 API 密钥**

1. 登录 BillionMail 管理界面
2. 导航到"设置" > "API 管理"
3. 点击"生成新密钥"
4. 输入密钥名称（如"生产环境"、"测试环境"）
5. 选择权限：
   - 读取权限：查看数据
   - 写入权限：创建和修改数据
   - 删除权限：删除数据
6. 点击"生成"
7. **重要**：复制并安全保存密钥，它只显示一次

**使用 API 密钥**

在所有 API 请求中包含密钥：

**方法 1：HTTP 头**（推荐）
```http
X-API-Key: your_api_key_here
```

**方法 2：查询参数**（不推荐，密钥可能被记录在日志中）
```http
GET /api/v1/campaigns?api_key=your_api_key_here
```

**示例**：
```bash
curl -X GET https://your-domain.com/api/v1/campaigns \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json"
```

**密钥管理**

- **定期轮换**：建议每 90 天更换一次密钥
- **最小权限原则**：只授予必要的权限
- **不同环境使用不同密钥**：开发、测试、生产环境分开
- **安全存储**：使用环境变量或密钥管理服务，不要硬编码在代码中
- **监控使用**：定期检查 API 密钥的使用情况
- **立即撤销**：如果密钥泄露，立即撤销并生成新密钥

### 7.1.3 速率限制

为了保护系统稳定性，API 有速率限制。

**默认限制**

- **每分钟**：60 请求
- **每小时**：1000 请求
- **每天**：10000 请求

超过限制会返回 429 状态码。

**响应头**

响应中包含速率限制信息：
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1609459200
```

**处理速率限制**

实现指数退避策略：
```python
import time
import requests

def api_call_with_retry(url, max_retries=3):
    for i in range(max_retries):
        response = requests.get(url, headers={"X-API-Key": API_KEY})
        
        if response.status_code == 429:
            # 被限制，等待后重试
            wait_time = (2 ** i) + random.random()
            print(f"速率限制，等待 {wait_time} 秒")
            time.sleep(wait_time)
            continue
        
        return response
    
    raise Exception("超过最大重试次数")
```

**提高限制**

如需更高的速率限制，请联系管理员。

### 7.1.4 分页

列表 API 使用分页来限制单次返回的数据量。

**分页参数**

- **page**：页码（从 1 开始）
- **per_page**：每页数量（默认 30，最大 100）

**示例**：
```bash
GET /api/v1/contacts?page=2&per_page=50
```

**分页响应**

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "current_page": 2,
      "per_page": 50,
      "total_pages": 10,
      "total_items": 500,
      "has_next": true,
      "has_prev": true
    }
  }
}
```

**遍历所有页**

```python
def get_all_contacts():
    all_contacts = []
    page = 1
    
    while True:
        response = requests.get(
            f"{API_BASE}/contacts",
            headers={"X-API-Key": API_KEY},
            params={"page": page, "per_page": 100}
        )
        
        data = response.json()
        contacts = data["data"]["items"]
        all_contacts.extend(contacts)
        
        if not data["data"]["pagination"]["has_next"]:
            break
        
        page += 1
    
    return all_contacts
```

## 7.2 邮件发送 API

### 7.2.1 发送单封邮件

**端点**
```http
POST /api/v1/mail/send
```

**请求参数**

```json
{
  "recipient": "recipient@example.com",
  "sender": {
    "email": "sender@yourdomain.com",
    "name": "发件人名称"
  },
  "subject": "邮件主题",
  "html": "<html><body><h1>邮件内容</h1></body></html>",
  "text": "纯文本邮件内容（可选）",
  "reply_to": "replyto@yourdomain.com",
  "cc": ["cc1@example.com", "cc2@example.com"],
  "bcc": ["bcc@example.com"],
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "base64_encoded_content",
      "type": "application/pdf"
    }
  ],
  "custom_args": {
    "user_id": "12345",
    "campaign_id": "summer_sale"
  },
  "send_at": "2024-01-15T10:00:00Z"
}
```

**必需字段**：
- `recipient`：收件人邮箱
- `subject`：邮件主题
- `html` 或 `text`：邮件内容（至少一个）

**可选字段**：
- `sender`：发件人信息（不指定则使用默认）
- `reply_to`：回复地址
- `cc`：抄送
- `bcc`：密送
- `attachments`：附件
- `custom_args`：自定义参数（用于追踪）
- `send_at`：定时发送（ISO 8601 格式）

**响应示例**

```json
{
  "success": true,
  "code": 0,
  "msg": "邮件已加入发送队列",
  "data": {
    "message_id": "msg_1234567890abcdef",
    "status": "queued"
  }
}
```

**完整示例（Python）**

```python
import requests
import json

API_BASE = "https://your-domain.com/api/v1"
API_KEY = "your_api_key"

def send_email(recipient, subject, html_content):
    url = f"{API_BASE}/mail/send"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "recipient": recipient,
        "subject": subject,
        "html": html_content
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        result = response.json()
        print(f"邮件已发送，消息 ID: {result['data']['message_id']}")
        return result['data']['message_id']
    else:
        print(f"发送失败: {response.text}")
        return None

# 使用
message_id = send_email(
    recipient="john@example.com",
    subject="欢迎加入我们！",
    html_content="<h1>您好！</h1><p>感谢注册。</p>"
)
```

**Node.js 示例**

```javascript
const axios = require('axios');

const API_BASE = 'https://your-domain.com/api/v1';
const API_KEY = 'your_api_key';

async function sendEmail(recipient, subject, htmlContent) {
  try {
    const response = await axios.post(
      `${API_BASE}/mail/send`,
      {
        recipient,
        subject,
        html: htmlContent
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('邮件已发送，消息 ID:', response.data.data.message_id);
    return response.data.data.message_id;
  } catch (error) {
    console.error('发送失败:', error.response?.data || error.message);
    return null;
  }
}

// 使用
sendEmail(
  'john@example.com',
  '欢迎加入我们！',
  '<h1>您好！</h1><p>感谢注册。</p>'
);
```

### 7.2.2 批量发送邮件

发送大量邮件时使用批量接口更高效。

**端点**
```http
POST /api/v1/mail/batch_send
```

**请求参数**

{% raw %}
```json
{
  "recipients": [
    {
      "email": "user1@example.com",
      "variables": {
        "name": "张三",
        "order_id": "ORD001"
      }
    },
    {
      "email": "user2@example.com",
      "variables": {
        "name": "李四",
        "order_id": "ORD002"
      }
    }
  ],
  "sender": {
    "email": "noreply@yourdomain.com",
    "name": "您的公司"
  },
  "subject": "订单确认 - {{order_id}}",
  "html": "<h1>您好 {{name}},</h1><p>您的订单 {{order_id}} 已确认。</p>",
  "template_id": "tpl_order_confirmation"
}
```
{% endraw %}

**使用模板**

如果指定了 `template_id`，可以省略 `subject` 和 `html`：

```json
{
  "recipients": [...],
  "template_id": "tpl_welcome_email",
  "sender": {...}
}
```

**响应示例**

```json
{
  "success": true,
  "code": 0,
  "msg": "批量邮件已加入队列",
  "data": {
    "batch_id": "batch_1234567890",
    "total": 2,
    "queued": 2,
    "failed": 0
  }
}
```

**Python 示例**

```python
def send_batch_emails(recipients_data):
    url = f"{API_BASE}/mail/batch_send"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    data = {
        "recipients": recipients_data,
        "template_id": "tpl_order_confirmation",
        "sender": {
            "email": "noreply@example.com",
            "name": "Example Store"
        }
    }
    
    response = requests.post(url, headers=headers, json=data)
    result = response.json()
    
    print(f"批量发送完成: {result['data']['queued']} 封已加入队列")
    return result['data']['batch_id']

# 使用
recipients = [
    {
        "email": "user1@example.com",
        "variables": {"name": "张三", "order_id": "ORD001"}
    },
    {
        "email": "user2@example.com",
        "variables": {"name": "李四", "order_id": "ORD002"}
    }
]

batch_id = send_batch_emails(recipients)
```

### 7.2.3 使用模板发送

**获取模板列表**

```http
GET /api/v1/templates
```

**响应**：
{% raw %}
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "tpl_123",
        "name": "欢迎邮件",
        "subject": "欢迎加入 {{site_name}}",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```
{% endraw %}

**获取模板详情**

```http
GET /api/v1/templates/{template_id}
```

**使用模板发送**

```python
def send_with_template(recipient, template_id, variables):
    url = f"{API_BASE}/mail/send"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    data = {
        "recipient": recipient,
        "template_id": template_id,
        "variables": variables
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()

# 使用
send_with_template(
    recipient="newuser@example.com",
    template_id="tpl_welcome",
    variables={
        "name": "张三",
        "verification_link": "https://example.com/verify/abc123"
    }
)
```

### 7.2.4 查询发送状态

**查询单封邮件状态**

```http
GET /api/v1/mail/status/{message_id}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "message_id": "msg_123",
    "status": "delivered",
    "events": [
      {
        "event": "queued",
        "timestamp": "2024-01-15T10:00:00Z"
      },
      {
        "event": "sent",
        "timestamp": "2024-01-15T10:00:05Z"
      },
      {
        "event": "delivered",
        "timestamp": "2024-01-15T10:00:10Z"
      },
      {
        "event": "opened",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      {
        "event": "clicked",
        "timestamp": "2024-01-15T10:31:00Z",
        "url": "https://example.com/product"
      }
    ]
  }
}
```

**状态说明**：
- `queued`：已加入队列
- `sent`：已发送
- `delivered`：已送达
- `bounced`：退信
- `opened`：已打开
- `clicked`：已点击

**Python 示例**

```python
def check_email_status(message_id):
    url = f"{API_BASE}/mail/status/{message_id}"
    headers = {"X-API-Key": API_KEY}
    
    response = requests.get(url, headers=headers)
    data = response.json()
    
    if data["success"]:
        status = data["data"]["status"]
        print(f"邮件状态: {status}")
        
        # 打印事件历史
        for event in data["data"]["events"]:
            print(f"{event['timestamp']}: {event['event']}")
        
        return status
    else:
        print(f"查询失败: {data['msg']}")
        return None

# 使用
status = check_email_status("msg_1234567890")
```

**查询批量发送状态**

```http
GET /api/v1/mail/batch_status/{batch_id}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "batch_id": "batch_123",
    "total": 100,
    "sent": 98,
    "delivered": 95,
    "bounced": 2,
    "opened": 45,
    "clicked": 12,
    "status": "completed"
  }
}
```

## 7.3 联系人管理 API

### 7.3.1 创建联系人

**端点**
```http
POST /api/v1/contacts
```

**请求**：
```json
{
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "company": "Acme Inc",
  "phone": "+1234567890",
  "tags": ["customer", "VIP"],
  "custom_fields": {
    "total_spent": 1250.00,
    "signup_source": "website"
  },
  "lists": ["list_123", "list_456"]
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "id": "contact_123",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Python 示例**：
```python
def create_contact(email, **kwargs):
    url = f"{API_BASE}/contacts"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    data = {"email": email, **kwargs}
    
    response = requests.post(url, headers=headers, json=data)
    result = response.json()
    
    if result["success"]:
        print(f"联系人已创建: {result['data']['id']}")
        return result['data']['id']
    else:
        print(f"创建失败: {result['msg']}")
        return None

# 使用
contact_id = create_contact(
    email="john@example.com",
    first_name="John",
    last_name="Doe",
    tags=["customer"],
    custom_fields={"signup_source": "api"}
)
```

### 7.3.2 更新联系人

**端点**
```http
PUT /api/v1/contacts/{contact_id_or_email}
```

或使用 PATCH 进行部分更新：
```http
PATCH /api/v1/contacts/{contact_id_or_email}
```

**请求**（PATCH）：
```json
{
  "custom_fields": {
    "total_spent": 1500.00
  },
  "tags": ["VIP"]
}
```

**Python 示例**：
```python
def update_contact(email, updates):
    url = f"{API_BASE}/contacts/{email}"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    response = requests.patch(url, headers=headers, json=updates)
    result = response.json()
    
    if result["success"]:
        print(f"联系人已更新")
    else:
        print(f"更新失败: {result['msg']}")

# 使用
update_contact(
    email="john@example.com",
    updates={
        "custom_fields": {"last_purchase": "2024-01-15"},
        "tags": ["VIP", "frequent_buyer"]
    }
)
```

### 7.3.3 查询联系人

**获取单个联系人**

```http
GET /api/v1/contacts/{contact_id_or_email}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "id": "contact_123",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "tags": ["customer", "VIP"],
    "custom_fields": {
      "total_spent": 1500.00
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

**搜索联系人**

```http
GET /api/v1/contacts?query=john&tags=VIP&page=1&per_page=50
```

**Python 示例**：
```python
def search_contacts(**filters):
    url = f"{API_BASE}/contacts"
    headers = {"X-API-Key": API_KEY}
    
    response = requests.get(url, headers=headers, params=filters)
    result = response.json()
    
    if result["success"]:
        contacts = result["data"]["items"]
        print(f"找到 {len(contacts)} 个联系人")
        return contacts
    else:
        print(f"搜索失败: {result['msg']}")
        return []

# 使用
vip_customers = search_contacts(tags="VIP", per_page=100)
```

### 7.3.4 批量操作

**批量创建联系人**

```http
POST /api/v1/contacts/batch
```

**请求**：
```json
{
  "contacts": [
    {
      "email": "user1@example.com",
      "first_name": "User",
      "last_name": "One"
    },
    {
      "email": "user2@example.com",
      "first_name": "User",
      "last_name": "Two"
    }
  ]
}
```

**Python 示例**：
```python
def batch_create_contacts(contacts):
    url = f"{API_BASE}/contacts/batch"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    data = {"contacts": contacts}
    
    response = requests.post(url, headers=headers, json=data)
    result = response.json()
    
    if result["success"]:
        print(f"成功创建 {result['data']['created']} 个联系人")
        print(f"跳过 {result['data']['skipped']} 个（已存在）")
        print(f"失败 {result['data']['failed']} 个")
    
    return result

# 使用
contacts = [
    {"email": f"user{i}@example.com", "first_name": f"User{i}"}
    for i in range(1, 101)
]

batch_create_contacts(contacts)
```

### 7.3.5 列表和标签管理

**获取列表**

```http
GET /api/v1/lists
```

**创建列表**

```http
POST /api/v1/lists
```

**请求**：
```json
{
  "name": "VIP 客户",
  "description": "高价值客户列表"
}
```

**添加联系人到列表**

```http
POST /api/v1/lists/{list_id}/contacts
```

**请求**：
```json
{
  "contacts": ["contact_123", "contact_456"]
}
```

或使用邮箱：
```json
{
  "emails": ["john@example.com", "jane@example.com"]
}
```

**管理标签**

**添加标签**：
```http
POST /api/v1/contacts/{contact_id}/tags
```

**请求**：
```json
{
  "tags": ["new_tag1", "new_tag2"]
}
```

**移除标签**：
```http
DELETE /api/v1/contacts/{contact_id}/tags
```

**请求**：
```json
{
  "tags": ["tag_to_remove"]
}
```

## 7.4 活动管理 API

### 7.4.1 创建活动

```http
POST /api/v1/campaigns
```

**请求**：
```json
{
  "name": "2024春季促销",
  "subject": "春季特惠 - 全场5折",
  "sender": {
    "email": "marketing@example.com",
    "name": "营销团队"
  },
  "html": "<html>...</html>",
  "template_id": "tpl_123",
  "recipients": {
    "lists": ["list_123"],
    "tags": ["customer"],
    "filter": {
      "custom_fields": {
        "total_spent": {
          "$gt": 500
        }
      }
    }
  },
  "schedule": {
    "send_at": "2024-03-01T10:00:00Z"
  }
}
```

### 7.4.2 获取活动统计

```http
GET /api/v1/campaigns/{campaign_id}/stats
```

**响应**：
```json
{
  "success": true,
  "data": {
    "campaign_id": "camp_123",
    "sent": 10000,
    "delivered": 9800,
    "bounced": 200,
    "opened": 2450,
    "clicked": 490,
    "unsubscribed": 10,
    "complained": 2,
    "open_rate": 0.25,
    "click_rate": 0.05,
    "click_to_open_rate": 0.20
  }
}
```

## 7.5 Webhook 集成

### 7.5.1 配置 Webhook

Webhook 允许 BillionMail 在特定事件发生时通知你的应用。

**配置步骤**：

1. 导航到"设置" > "Webhooks"
2. 点击"添加 Webhook"
3. 填写信息：
   - URL：接收 Webhook 的端点
   - 事件：选择要订阅的事件
   - 密钥：用于验证请求的密钥

**支持的事件**：
- `email.sent`：邮件已发送
- `email.delivered`：邮件已送达
- `email.bounced`：邮件退信
- `email.opened`：邮件已打开
- `email.clicked`：链接已点击
- `email.unsubscribed`：用户退订
- `email.complained`：用户投诉

### 7.5.2 处理 Webhook

**Webhook 请求格式**

POST 请求到你的 URL，JSON 格式：

```json
{
  "event": "email.opened",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "message_id": "msg_123",
    "recipient": "john@example.com",
    "campaign_id": "camp_123",
    "ip_address": "203.0.113.10",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**验证 Webhook**

使用 HMAC-SHA256 验证请求：

```python
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = "your_webhook_secret"

@app.route('/webhooks/billionmail', methods=['POST'])
def handle_webhook():
    # 获取签名
    signature = request.headers.get('X-Webhook-Signature')
    
    # 计算预期签名
    payload = request.get_data()
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # 验证签名
    if not hmac.compare_digest(signature, expected_signature):
        return jsonify({"error": "Invalid signature"}), 401
    
    # 处理事件
    event_data = request.get_json()
    event_type = event_data['event']
    
    if event_type == 'email.opened':
        handle_email_opened(event_data['data'])
    elif event_type == 'email.clicked':
        handle_email_clicked(event_data['data'])
    # ... 其他事件处理
    
    return jsonify({"success": true}), 200

def handle_email_opened(data):
    message_id = data['message_id']
    recipient = data['recipient']
    print(f"邮件 {message_id} 被 {recipient} 打开")
    # 更新数据库、触发后续操作等

def handle_email_clicked(data):
    message_id = data['message_id']
    recipient = data['recipient']
    url = data['url']
    print(f"{recipient} 点击了链接: {url}")
    # 记录用户兴趣、触发推荐等

if __name__ == '__main__':
    app.run(port=5000)
```

**Node.js 示例**：

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
const WEBHOOK_SECRET = 'your_webhook_secret';

app.use(express.json());

app.post('/webhooks/billionmail', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  
  // 计算预期签名
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  // 验证签名
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // 处理事件
  const { event, data } = req.body;
  
  switch (event) {
    case 'email.opened':
      handleEmailOpened(data);
      break;
    case 'email.clicked':
      handleEmailClicked(data);
      break;
    // ... 其他事件
  }
  
  res.json({ success: true });
});

function handleEmailOpened(data) {
  console.log(`邮件 ${data.message_id} 被 ${data.recipient} 打开`);
}

function handleEmailClicked(data) {
  console.log(`${data.recipient} 点击了链接: ${data.url}`);
}

app.listen(5000, () => {
  console.log('Webhook 服务器运行在端口 5000');
});
```

## 7.6 SDK 和代码示例

### 7.6.1 Python SDK

创建简单的 Python SDK：

```python
import requests
from typing import Dict, List, Optional

class BillionMailClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
    
    def send_email(self, recipient: str, subject: str, 
                   html: str, **kwargs) -> Dict:
        """发送单封邮件"""
        url = f"{self.base_url}/mail/send"
        data = {
            "recipient": recipient,
            "subject": subject,
            "html": html,
            **kwargs
        }
        response = requests.post(url, headers=self.headers, json=data)
        return response.json()
    
    def send_batch(self, recipients: List[Dict], 
                   template_id: str, **kwargs) -> Dict:
        """批量发送邮件"""
        url = f"{self.base_url}/mail/batch_send"
        data = {
            "recipients": recipients,
            "template_id": template_id,
            **kwargs
        }
        response = requests.post(url, headers=self.headers, json=data)
        return response.json()
    
    def create_contact(self, email: str, **kwargs) -> Dict:
        """创建联系人"""
        url = f"{self.base_url}/contacts"
        data = {"email": email, **kwargs}
        response = requests.post(url, headers=self.headers, json=data)
        return response.json()
    
    def get_contact(self, email: str) -> Dict:
        """获取联系人"""
        url = f"{self.base_url}/contacts/{email}"
        response = requests.get(url, headers=self.headers)
        return response.json()
    
    def update_contact(self, email: str, updates: Dict) -> Dict:
        """更新联系人"""
        url = f"{self.base_url}/contacts/{email}"
        response = requests.patch(url, headers=self.headers, json=updates)
        return response.json()

# 使用示例
client = BillionMailClient(
    api_key="your_api_key",
    base_url="https://your-domain.com/api/v1"
)

# 发送邮件
result = client.send_email(
    recipient="john@example.com",
    subject="欢迎！",
    html="<h1>欢迎加入</h1>"
)

# 创建联系人
contact = client.create_contact(
    email="jane@example.com",
    first_name="Jane",
    tags=["customer"]
)
```

### 7.6.2 实战案例

**案例 1：用户注册后发送欢迎邮件**

```python
from flask import Flask, request, jsonify
from billionmail import BillionMailClient

app = Flask(__name__)
mail_client = BillionMailClient(api_key="xxx", base_url="xxx")

@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.get_json()
    email = data['email']
    name = data['name']
    
    # 1. 创建用户账户（示例）
    user_id = create_user_in_database(email, name)
    
    # 2. 添加到邮件列表
    mail_client.create_contact(
        email=email,
        first_name=name,
        custom_fields={"user_id": user_id},
        tags=["new_user"]
    )
    
    # 3. 发送欢迎邮件
    mail_client.send_email(
        recipient=email,
        template_id="tpl_welcome",
        variables={
            "name": name,
            "verification_link": f"https://example.com/verify/{user_id}"
        }
    )
    
    return jsonify({"success": True, "user_id": user_id})
```

**案例 2：订单确认邮件**

```python
@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    
    # 创建订单
    order = create_order_in_database(data)
    
    # 发送确认邮件
    mail_client.send_email(
        recipient=order['customer_email'],
        template_id="tpl_order_confirmation",
        variables={
            "name": order['customer_name'],
            "order_id": order['id'],
            "order_total": order['total'],
            "items": order['items'],
            "tracking_url": f"https://example.com/track/{order['id']}"
        }
    )
    
    return jsonify({"success": True, "order_id": order['id']})
```

**案例 3：放弃购物车提醒**

```python
import schedule
import time

def send_cart_reminders():
    """每小时检查并发送购物车提醒"""
    # 1. 查询放弃购物车（创建超过1小时，未完成）
    abandoned_carts = get_abandoned_carts()
    
    for cart in abandoned_carts:
        # 2. 发送提醒邮件
        mail_client.send_email(
            recipient=cart['email'],
            template_id="tpl_cart_reminder",
            variables={
                "name": cart['name'],
                "cart_items": cart['items'],
                "cart_total": cart['total'],
                "checkout_url": f"https://example.com/checkout/{cart['id']}"
            }
        )
        
        # 3. 标记为已发送提醒
        mark_reminder_sent(cart['id'])

# 每小时执行一次
schedule.every().hour.do(send_cart_reminders)

while True:
    schedule.run_pending()
    time.sleep(60)
```

## 7.7 小结

在本章中，我们详细学习了 BillionMail 的 API 集成，包括：

1. **API 基础**：认证、速率限制、分页等基本概念
2. **邮件发送 API**：单封和批量发送邮件
3. **联系人管理 API**：创建、更新、查询联系人
4. **活动管理 API**：创建和管理邮件活动
5. **Webhook 集成**：接收实时事件通知
6. **SDK 和实战案例**：实际应用场景的代码示例

通过 API，可以将 BillionMail 的强大功能无缝集成到任何应用中，实现自动化的邮件营销和通知系统。在下一章中，我们将探讨如何进行高级功能配置和性能优化。
