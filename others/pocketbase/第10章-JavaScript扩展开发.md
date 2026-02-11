---
layout: default
title: 第10章 JavaScript扩展开发
---

# 第10章 JavaScript扩展开发

PocketBase 内置了基于 Goja 的 JavaScript 引擎，允许开发者通过编写 JavaScript 钩子文件来扩展 PocketBase 的功能，而无需编写 Go 代码或重新编译。本章将全面介绍如何利用 JavaScript 扩展来自定义路由、处理事件钩子、操作数据库、发送邮件、创建定时任务等。

---

## 10.1 JavaScript扩展概述

### 10.1.1 什么是JavaScript扩展

PocketBase 从 v0.17 版本开始内置了 **Goja** JavaScript 引擎（一个纯 Go 实现的 ES5.1+ JavaScript 运行时）。开发者可以在 `pb_hooks` 目录中放置 `.pb.js` 文件，PocketBase 启动时会自动加载和执行这些文件。

JavaScript 扩展的核心优势：

- **无需编译**：直接编写 JS 文件即可生效，修改后重启 PocketBase 即可
- **降低门槛**：相比 Go 扩展，JavaScript 更易于上手
- **热加载支持**：开发模式下支持文件变更自动重载
- **功能完整**：可以访问几乎所有 PocketBase 内部 API

### 10.1.2 Goja引擎特性

Goja 并非完整的 Node.js 环境，它具有以下特点：

- 支持 ES5.1 规范和部分 ES6+ 特性（如箭头函数、模板字符串、`let`/`const`等）
- 不支持 Node.js 原生模块（如 `fs`、`path`、`http`）
- 不支持 `import`/`export` ES 模块语法（使用 `require()` 加载）
- 同步执行模型，不支持 `async/await` 和 `Promise`
- PocketBase 提供了丰富的全局 API 来弥补缺失的功能

### 10.1.3 快速入门示例

```javascript
// pb_hooks/hello.pb.js

routerAdd("GET", "/api/hello", (e) => {
    return e.json(200, { "message": "你好，PocketBase！" })
})
```

将此文件放入 `pb_hooks` 目录，重启 PocketBase 后访问 `/api/hello` 即可看到返回结果。

---

## 10.2 pb_hooks目录结构

### 10.2.1 目录位置

`pb_hooks` 目录应位于 PocketBase 可执行文件的同级目录下：

```
项目根目录/
├── pocketbase           # PocketBase 可执行文件
├── pb_hooks/            # JavaScript 钩子目录
│   ├── main.pb.js       # 主钩子文件
│   ├── routes.pb.js     # 路由定义
│   ├── hooks.pb.js      # 事件钩子
│   ├── cron.pb.js       # 定时任务
│   └── utils.pb.js      # 工具函数
├── pb_data/             # 数据目录
└── pb_migrations/       # 迁移文件目录
```

### 10.2.2 文件命名规则

- 所有钩子文件**必须**以 `.pb.js` 为后缀
- PocketBase 只会加载 `.pb.js` 结尾的文件，普通 `.js` 文件会被忽略
- 文件按字母顺序加载，可以利用数字前缀控制加载顺序

```
pb_hooks/
├── 00_globals.pb.js     # 最先加载，定义全局变量
├── 01_middleware.pb.js   # 中间件定义
├── 02_routes.pb.js       # 路由定义
├── 03_hooks.pb.js        # 事件钩子
└── 99_cron.pb.js         # 最后加载，定时任务
```

### 10.2.3 使用require加载模块

可以使用 `require()` 在钩子文件之间共享代码：

```javascript
// pb_hooks/utils.js（注意：非 .pb.js 后缀，不会被自动执行）
module.exports = {
    formatDate: function(date) {
        return date.toISOString().split('T')[0]
    },
    generateCode: function(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result = ''
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }
}
```

```javascript
// pb_hooks/main.pb.js
const utils = require(`${__hooks}/utils.js`)

routerAdd("GET", "/api/code", (e) => {
    const code = utils.generateCode(6)
    return e.json(200, { "code": code })
})
```

`__hooks` 是一个内置的全局变量，指向 `pb_hooks` 目录的绝对路径。

---

## 10.3 自定义API路由

### 10.3.1 注册GET路由

```javascript
// pb_hooks/routes.pb.js

// 简单的 GET 路由
routerAdd("GET", "/api/custom/info", (e) => {
    return e.json(200, {
        "name": "我的应用",
        "version": "1.0.0",
        "status": "运行中"
    })
})
```

### 10.3.2 注册POST路由

```javascript
// 接收 POST 请求
routerAdd("POST", "/api/custom/submit", (e) => {
    const data = e.requestInfo().body

    if (!data.title || !data.content) {
        return e.badRequestError("标题和内容不能为空", null)
    }

    // 处理业务逻辑
    const collection = $app.findCollectionByNameOrId("articles")
    const record = new Record(collection)
    record.set("title", data.title)
    record.set("content", data.content)
    $app.save(record)

    return e.json(200, {
        "message": "提交成功",
        "id": record.id
    })
})
```

### 10.3.3 注册PUT和DELETE路由

```javascript
// PUT 路由 - 更新资源
routerAdd("PUT", "/api/custom/articles/{id}", (e) => {
    const id = e.request.pathValue("id")
    const data = e.requestInfo().body

    const record = $app.findRecordById("articles", id)
    record.set("title", data.title)
    record.set("content", data.content)
    $app.save(record)

    return e.json(200, {
        "message": "更新成功",
        "record": record
    })
})

// DELETE 路由 - 删除资源
routerAdd("DELETE", "/api/custom/articles/{id}", (e) => {
    const id = e.request.pathValue("id")

    const record = $app.findRecordById("articles", id)
    $app.delete(record)

    return e.json(200, { "message": "删除成功" })
})
```

### 10.3.4 路由参数

```javascript
// 路径参数
routerAdd("GET", "/api/custom/users/{userId}/posts/{postId}", (e) => {
    const userId = e.request.pathValue("userId")
    const postId = e.request.pathValue("postId")

    return e.json(200, {
        "userId": userId,
        "postId": postId
    })
})
```

### 10.3.5 路由分组与中间件绑定

```javascript
// 为路由添加中间件
routerAdd("GET", "/api/custom/protected", (e) => {
    const info = e.requestInfo()
    return e.json(200, {
        "message": "这是受保护的路由",
        "user": info.auth
    })
}, $apis.requireAuth())
```

---

## 10.4 请求与响应处理

### 10.4.1 获取请求信息

```javascript
routerAdd("POST", "/api/custom/echo", (e) => {
    const info = e.requestInfo()

    // 获取请求体
    const body = info.body

    // 获取查询参数
    const page = e.request.url.query().get("page")
    const limit = e.request.url.query().get("limit")

    // 获取请求头
    const contentType = e.request.header.get("Content-Type")
    const userAgent = e.request.header.get("User-Agent")

    // 获取认证信息
    const authRecord = info.auth  // 已认证的用户记录（如果有）

    return e.json(200, {
        "body": body,
        "query": { "page": page, "limit": limit },
        "headers": { "contentType": contentType, "userAgent": userAgent },
        "auth": authRecord
    })
})
```

### 10.4.2 设置响应头

```javascript
routerAdd("GET", "/api/custom/download", (e) => {
    e.response.header().set("Content-Type", "text/csv")
    e.response.header().set("Content-Disposition", "attachment; filename=\"data.csv\"")
    e.response.header().set("X-Custom-Header", "自定义值")

    return e.string(200, "姓名,年龄,城市\n张三,25,北京\n李四,30,上海")
})
```

### 10.4.3 不同类型的响应

```javascript
// 返回 JSON
routerAdd("GET", "/api/custom/json", (e) => {
    return e.json(200, { "message": "JSON响应" })
})

// 返回纯文本
routerAdd("GET", "/api/custom/text", (e) => {
    return e.string(200, "纯文本响应")
})

// 返回 HTML
routerAdd("GET", "/api/custom/html", (e) => {
    return e.html(200, "<h1>HTML响应</h1><p>这是一个HTML页面</p>")
})

// 返回无内容
routerAdd("DELETE", "/api/custom/item/{id}", (e) => {
    const id = e.request.pathValue("id")
    // ... 删除操作
    return e.noContent(204)
})
```

### 10.4.4 错误响应

```javascript
routerAdd("GET", "/api/custom/error-demo", (e) => {
    const id = e.request.url.query().get("id")

    if (!id) {
        return e.badRequestError("缺少必要参数 id", null)
    }

    try {
        const record = $app.findRecordById("articles", id)
        return e.json(200, record)
    } catch (err) {
        return e.notFoundError("文章不存在", err)
    }
})
```

---

## 10.5 事件钩子(Event Hooks)

### 10.5.1 记录创建钩子

```javascript
// 创建记录之前触发
onRecordCreate((e) => {
    // 自动设置默认值
    if (!e.record.get("status")) {
        e.record.set("status", "draft")
    }

    // 设置创建时间
    e.record.set("publishedAt", new Date().toISOString())

    return e.next()
}, "articles")

// 创建记录之后触发
onRecordAfterCreateSuccess((e) => {
    console.log("新文章已创建:", e.record.id)

    // 发送通知
    const title = e.record.get("title")
    console.log(`文章 "${title}" 已成功发布`)

    return e.next()
}, "articles")
```

### 10.5.2 记录更新钩子

```javascript
// 更新记录之前触发
onRecordUpdate((e) => {
    // 记录修改时间
    e.record.set("updatedAt", new Date().toISOString())

    // 检查权限
    const info = e.requestInfo()
    if (info.auth && info.auth.id !== e.record.get("author")) {
        return e.badRequestError("只能修改自己的文章", null)
    }

    return e.next()
}, "articles")

// 更新记录之后触发
onRecordAfterUpdateSuccess((e) => {
    console.log("文章已更新:", e.record.id)
    return e.next()
}, "articles")
```

### 10.5.3 记录删除钩子

```javascript
// 删除记录之前触发
onRecordDelete((e) => {
    // 检查是否可以删除
    const commentCount = $app.findRecordsByFilter(
        "comments",
        "article = {:articleId}",
        "-created",
        0, 0,
        { "articleId": e.record.id }
    ).length

    if (commentCount > 0) {
        return e.badRequestError("该文章存在评论，无法删除", null)
    }

    return e.next()
}, "articles")

// 删除记录之后触发
onRecordAfterDeleteSuccess((e) => {
    console.log("文章已删除:", e.record.id)
    return e.next()
}, "articles")
```

### 10.5.4 认证相关钩子

```javascript
// 认证之前
onRecordAuth((e) => {
    console.log("用户尝试登录:", e.record.email())

    // 检查账号状态
    if (e.record.get("banned") === true) {
        return e.badRequestError("该账号已被封禁", null)
    }

    return e.next()
}, "users")

// 认证成功之后
onRecordAfterAuthSuccess((e) => {
    // 更新最后登录时间
    e.record.set("lastLogin", new Date().toISOString())
    $app.save(e.record)

    console.log("用户登录成功:", e.record.email())
    return e.next()
}, "users")
```

### 10.5.5 模型验证钩子

```javascript
onRecordCreate((e) => {
    const title = e.record.get("title")
    const content = e.record.get("content")

    // 标题长度验证
    if (title && title.length < 5) {
        return e.badRequestError("标题长度不能少于5个字符", null)
    }

    // 内容长度验证
    if (content && content.length < 20) {
        return e.badRequestError("内容长度不能少于20个字符", null)
    }

    // 敏感词过滤
    const sensitiveWords = ["违禁词1", "违禁词2"]
    for (let word of sensitiveWords) {
        if (title.includes(word) || content.includes(word)) {
            return e.badRequestError("内容包含违禁词", null)
        }
    }

    return e.next()
}, "articles")
```

---

## 10.6 数据库操作

### 10.6.1 查询记录

```javascript
routerAdd("GET", "/api/custom/articles", (e) => {
    // 根据 ID 查询单条记录
    const record = $app.findRecordById("articles", "RECORD_ID")

    // 查询第一条匹配记录
    const firstRecord = $app.findFirstRecordByData("articles", "status", "published")

    // 使用过滤器查询多条记录
    const records = $app.findRecordsByFilter(
        "articles",                    // 集合名称
        "status = 'published'",        // 过滤条件
        "-created",                    // 排序（- 表示降序）
        10,                            // 限制数量
        0,                             // 偏移量
    )

    // 带参数的过滤器查询
    const userArticles = $app.findRecordsByFilter(
        "articles",
        "author = {:userId} && status = {:status}",
        "-created",
        20,
        0,
        { "userId": "USER_ID", "status": "published" }
    )

    return e.json(200, { "articles": records })
})
```

### 10.6.2 创建记录

```javascript
routerAdd("POST", "/api/custom/articles/create", (e) => {
    const data = e.requestInfo().body
    const collection = $app.findCollectionByNameOrId("articles")
    const record = new Record(collection)

    record.set("title", data.title)
    record.set("content", data.content)
    record.set("status", "draft")
    record.set("author", data.authorId)

    $app.save(record)

    return e.json(201, {
        "message": "创建成功",
        "record": record
    })
})
```

### 10.6.3 更新记录

```javascript
routerAdd("PUT", "/api/custom/articles/update/{id}", (e) => {
    const id = e.request.pathValue("id")
    const data = e.requestInfo().body

    const record = $app.findRecordById("articles", id)

    if (data.title) record.set("title", data.title)
    if (data.content) record.set("content", data.content)
    if (data.status) record.set("status", data.status)

    $app.save(record)

    return e.json(200, {
        "message": "更新成功",
        "record": record
    })
})
```

### 10.6.4 删除记录

```javascript
routerAdd("DELETE", "/api/custom/articles/delete/{id}", (e) => {
    const id = e.request.pathValue("id")

    const record = $app.findRecordById("articles", id)
    $app.delete(record)

    return e.json(200, { "message": "删除成功" })
})
```

### 10.6.5 原始SQL查询

```javascript
routerAdd("GET", "/api/custom/stats", (e) => {
    // 使用原始 SQL 进行聚合查询
    const result = arrayOf(new DynamicModel({
        "total": 0,
        "status": "",
    }))

    $app.db()
        .newQuery("SELECT COUNT(*) as total, status FROM articles GROUP BY status")
        .all(result)

    return e.json(200, { "stats": result })
})
```

### 10.6.6 事务操作

```javascript
routerAdd("POST", "/api/custom/transfer", (e) => {
    const data = e.requestInfo().body

    $app.runInTransaction((txApp) => {
        // 扣除发送方余额
        const sender = txApp.findRecordById("wallets", data.senderId)
        const senderBalance = sender.getFloat("balance")
        if (senderBalance < data.amount) {
            throw new Error("余额不足")
        }
        sender.set("balance", senderBalance - data.amount)
        txApp.save(sender)

        // 增加接收方余额
        const receiver = txApp.findRecordById("wallets", data.receiverId)
        receiver.set("balance", receiver.getFloat("balance") + data.amount)
        txApp.save(receiver)

        // 创建转账记录
        const collection = txApp.findCollectionByNameOrId("transactions")
        const transaction = new Record(collection)
        transaction.set("sender", data.senderId)
        transaction.set("receiver", data.receiverId)
        transaction.set("amount", data.amount)
        txApp.save(transaction)
    })

    return e.json(200, { "message": "转账成功" })
})
```

---

## 10.7 邮件发送

### 10.7.1 发送简单邮件

```javascript
routerAdd("POST", "/api/custom/send-email", (e) => {
    const data = e.requestInfo().body

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name:    $app.settings().meta.senderName,
        },
        to:      [{ address: data.to }],
        subject: data.subject,
        html:    data.body,
    })

    $app.newMailClient().send(message)

    return e.json(200, { "message": "邮件发送成功" })
})
```

### 10.7.2 发送HTML邮件

```javascript
onRecordAfterCreateSuccess((e) => {
    const authorId = e.record.get("author")
    const author = $app.findRecordById("users", authorId)

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">文章发布成功</h2>
            <p>尊敬的 ${author.get("name")}，</p>
            <p>您的文章 <strong>"${e.record.get("title")}"</strong> 已成功发布。</p>
            <p>发布时间：${new Date().toLocaleString()}</p>
            <hr>
            <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
        </div>
    `

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name:    $app.settings().meta.senderName,
        },
        to:      [{ address: author.email() }],
        subject: "文章发布通知",
        html:    htmlContent,
    })

    $app.newMailClient().send(message)

    return e.next()
}, "articles")
```

### 10.7.3 批量发送邮件

```javascript
routerAdd("POST", "/api/custom/newsletter", (e) => {
    const data = e.requestInfo().body

    // 获取所有订阅用户
    const subscribers = $app.findRecordsByFilter(
        "users",
        "subscribed = true",
        "",
        0, 0
    )

    let successCount = 0
    let failCount = 0

    for (let subscriber of subscribers) {
        try {
            const message = new MailerMessage({
                from: {
                    address: $app.settings().meta.senderAddress,
                    name:    $app.settings().meta.senderName,
                },
                to:      [{ address: subscriber.email() }],
                subject: data.subject,
                html:    data.content,
            })
            $app.newMailClient().send(message)
            successCount++
        } catch (err) {
            console.log("发送失败:", subscriber.email(), err)
            failCount++
        }
    }

    return e.json(200, {
        "message": "批量发送完成",
        "success": successCount,
        "failed": failCount
    })
}, $apis.requireAuth())
```

---

## 10.8 定时任务(Cron Jobs)

### 10.8.1 基本定时任务

```javascript
// pb_hooks/cron.pb.js

// 每分钟执行一次
cronAdd("everyMinute", "* * * * *", () => {
    console.log("每分钟任务执行:", new Date().toISOString())
})

// 每小时执行一次
cronAdd("everyHour", "0 * * * *", () => {
    console.log("每小时任务执行:", new Date().toISOString())
})

// 每天凌晨2点执行
cronAdd("dailyCleanup", "0 2 * * *", () => {
    console.log("开始每日清理任务...")

    // 删除30天前的日志记录
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const oldLogs = $app.findRecordsByFilter(
        "logs",
        "created < {:date}",
        "",
        500, 0,
        { "date": thirtyDaysAgo.toISOString() }
    )

    for (let log of oldLogs) {
        $app.delete(log)
    }

    console.log(`清理了 ${oldLogs.length} 条过期日志`)
})
```

### 10.8.2 Cron表达式说明

```
┌──────────── 分钟 (0-59)
│ ┌────────── 小时 (0-23)
│ │ ┌──────── 日期 (1-31)
│ │ │ ┌────── 月份 (1-12)
│ │ │ │ ┌──── 星期 (0-6, 0=周日)
│ │ │ │ │
* * * * *
```

常用表达式示例：

| 表达式 | 说明 |
|--------|------|
| `* * * * *` | 每分钟 |
| `*/5 * * * *` | 每5分钟 |
| `0 * * * *` | 每小时 |
| `0 0 * * *` | 每天午夜 |
| `0 2 * * *` | 每天凌晨2点 |
| `0 0 * * 1` | 每周一午夜 |
| `0 0 1 * *` | 每月1日午夜 |

### 10.8.3 定时统计报告

```javascript
// 每天早上8点生成统计报告
cronAdd("dailyReport", "0 8 * * *", () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // 统计昨天的新用户数
    const newUsers = $app.findRecordsByFilter(
        "users",
        "created >= {:start} && created < {:end}",
        "",
        0, 0,
        {
            "start": yesterday.toISOString(),
            "end": today.toISOString()
        }
    )

    // 统计昨天的新文章数
    const newArticles = $app.findRecordsByFilter(
        "articles",
        "created >= {:start} && created < {:end}",
        "",
        0, 0,
        {
            "start": yesterday.toISOString(),
            "end": today.toISOString()
        }
    )

    // 保存统计记录
    const collection = $app.findCollectionByNameOrId("daily_stats")
    const record = new Record(collection)
    record.set("date", yesterday.toISOString().split('T')[0])
    record.set("newUsers", newUsers.length)
    record.set("newArticles", newArticles.length)
    $app.save(record)

    console.log(`日报统计完成: 新用户 ${newUsers.length}, 新文章 ${newArticles.length}`)
})
```

---

## 10.9 中间件开发

### 10.9.1 日志中间件

```javascript
routerAdd("GET", "/api/custom/data", (e) => {
    return e.json(200, { "data": "示例数据" })
}, (e) => {
    // 记录请求开始时间
    const startTime = Date.now()
    const method = e.request.method
    const path = e.request.url.path

    // 调用下一个处理器
    const err = e.next()

    // 记录请求结束时间
    const duration = Date.now() - startTime
    console.log(`[${method}] ${path} - ${duration}ms`)

    return err
})
```

### 10.9.2 认证中间件

```javascript
// 自定义 API Key 认证中间件
function apiKeyAuth(e) {
    const apiKey = e.request.header.get("X-API-Key")

    if (!apiKey) {
        return e.unauthorizedError("缺少 API Key", null)
    }

    // 验证 API Key
    try {
        const keyRecord = $app.findFirstRecordByData("api_keys", "key", apiKey)
        if (!keyRecord || !keyRecord.getBool("active")) {
            return e.unauthorizedError("无效的 API Key", null)
        }

        // 更新使用次数
        keyRecord.set("usageCount", keyRecord.getInt("usageCount") + 1)
        keyRecord.set("lastUsed", new Date().toISOString())
        $app.save(keyRecord)
    } catch (err) {
        return e.unauthorizedError("API Key 验证失败", null)
    }

    return e.next()
}

// 应用中间件
routerAdd("GET", "/api/external/data", (e) => {
    return e.json(200, { "data": "受保护的数据" })
}, apiKeyAuth)
```

### 10.9.3 限流中间件

```javascript
// 简易限流实现（基于内存计数）
const rateLimitMap = {}

function rateLimit(maxRequests, windowSeconds) {
    return function(e) {
        const clientIP = e.realIP()
        const now = Date.now()
        const windowMs = windowSeconds * 1000

        if (!rateLimitMap[clientIP]) {
            rateLimitMap[clientIP] = []
        }

        // 清理过期记录
        rateLimitMap[clientIP] = rateLimitMap[clientIP].filter(
            (timestamp) => now - timestamp < windowMs
        )

        if (rateLimitMap[clientIP].length >= maxRequests) {
            return e.tooManyRequestsError("请求过于频繁，请稍后再试", null)
        }

        rateLimitMap[clientIP].push(now)
        return e.next()
    }
}

// 每分钟最多10次请求
routerAdd("GET", "/api/limited/resource", (e) => {
    return e.json(200, { "data": "限流保护的资源" })
}, rateLimit(10, 60))
```

### 10.9.4 CORS中间件

```javascript
function customCors(e) {
    e.response.header().set("Access-Control-Allow-Origin", "https://example.com")
    e.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    e.response.header().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
    e.response.header().set("Access-Control-Max-Age", "86400")

    if (e.request.method === "OPTIONS") {
        return e.noContent(204)
    }

    return e.next()
}

routerAdd("GET", "/api/cors/data", (e) => {
    return e.json(200, { "data": "跨域数据" })
}, customCors)
```

---

## 10.10 第三方API调用

### 10.10.1 基本HTTP请求

```javascript
routerAdd("GET", "/api/custom/weather", (e) => {
    const city = e.request.url.query().get("city") || "北京"

    // 使用 $http.send 发起 HTTP 请求
    const res = $http.send({
        url:     "https://api.example.com/weather?city=" + encodeURIComponent(city),
        method:  "GET",
        headers: {
            "Authorization": "Bearer YOUR_API_KEY",
            "Accept": "application/json"
        },
        timeout: 30  // 超时时间（秒）
    })

    if (res.statusCode !== 200) {
        return e.badRequestError("获取天气信息失败", null)
    }

    return e.json(200, res.json)
})
```

### 10.10.2 POST请求

```javascript
routerAdd("POST", "/api/custom/notify", (e) => {
    const data = e.requestInfo().body

    // 调用第三方通知 API
    const res = $http.send({
        url:    "https://api.example.com/notifications",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer YOUR_TOKEN"
        },
        body: JSON.stringify({
            "channel": "email",
            "to": data.recipient,
            "message": data.message
        }),
        timeout: 15
    })

    return e.json(200, {
        "status": res.statusCode,
        "response": res.json
    })
})
```

### 10.10.3 Webhook通知

```javascript
// 当文章发布时发送 Webhook 通知
onRecordAfterCreateSuccess((e) => {
    if (e.record.get("status") !== "published") {
        return e.next()
    }

    // 发送到 Slack
    try {
        $http.send({
            url:    "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                "text": `📝 新文章发布: ${e.record.get("title")}`,
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `*新文章发布*\n标题: ${e.record.get("title")}\n作者: ${e.record.get("author")}`
                        }
                    }
                ]
            }),
            timeout: 10
        })
    } catch (err) {
        console.log("Webhook 发送失败:", err)
    }

    return e.next()
}, "articles")
```

### 10.10.4 调用支付API

```javascript
routerAdd("POST", "/api/custom/payment", (e) => {
    const data = e.requestInfo().body
    const info = e.requestInfo()

    if (!info.auth) {
        return e.unauthorizedError("请先登录", null)
    }

    // 创建支付订单
    const orderCollection = $app.findCollectionByNameOrId("orders")
    const order = new Record(orderCollection)
    order.set("user", info.auth.id)
    order.set("amount", data.amount)
    order.set("status", "pending")
    $app.save(order)

    // 调用支付网关 API
    const res = $http.send({
        url:    "https://api.payment-gateway.com/v1/charges",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer PAYMENT_SECRET_KEY"
        },
        body: JSON.stringify({
            "amount": data.amount * 100,
            "currency": "cny",
            "description": data.description,
            "metadata": { "orderId": order.id }
        }),
        timeout: 30
    })

    if (res.statusCode === 200) {
        order.set("status", "paid")
        order.set("paymentId", res.json.id)
        $app.save(order)
    }

    return e.json(200, {
        "orderId": order.id,
        "paymentStatus": res.json
    })
}, $apis.requireAuth())
```

---

## 10.11 JavaScript扩展注意事项

### 10.11.1 性能限制

JavaScript 扩展运行在 Goja 引擎中，相比原生 Go 代码存在一定的性能开销：

- **CPU 密集型操作**：Goja 的执行速度约为原生 Go 的 1/10 到 1/50，不适合复杂计算
- **内存管理**：Goja 使用 Go 的 GC，大量 JS 对象可能增加 GC 压力
- **并发限制**：JavaScript 钩子在同一个线程中执行，长时间阻塞会影响其他请求

**建议**：

```javascript
// ❌ 避免在钩子中进行大量计算
onRecordCreate((e) => {
    // 不要在这里进行复杂的加密、压缩等操作
    for (let i = 0; i < 1000000; i++) {
        // 大量循环计算
    }
    return e.next()
}, "articles")

// ✅ 将耗时操作分解或异步处理
onRecordAfterCreateSuccess((e) => {
    // 使用外部 API 处理耗时任务
    try {
        $http.send({
            url: "https://your-worker.example.com/process",
            method: "POST",
            body: JSON.stringify({ recordId: e.record.id }),
            timeout: 5
        })
    } catch(err) {
        console.log("异步任务发送失败:", err)
    }
    return e.next()
}, "articles")
```

### 10.11.2 不支持的Node.js API

以下 Node.js 特性在 Goja 中**不可用**：

| 不支持的特性 | 替代方案 |
|-------------|---------|
| `fs` 文件系统 | 使用 `$os` 全局对象 |
| `http`/`https` | 使用 `$http.send()` |
| `async/await` | 同步编程模式 |
| `Promise` | 回调或同步调用 |
| `Buffer` | 使用字符串或 `$security` 工具 |
| `setTimeout` | 使用 `cronAdd()` |
| `import/export` | 使用 `require()` |
| npm 模块 | 仅支持纯 ES5 的模块 |

### 10.11.3 调试技巧

```javascript
// 1. 使用 console.log 调试
onRecordCreate((e) => {
    console.log("=== 调试信息 ===")
    console.log("记录数据:", JSON.stringify(e.record))
    console.log("请求信息:", JSON.stringify(e.requestInfo().body))
    return e.next()
}, "articles")

// 2. 使用 try-catch 捕获错误
routerAdd("GET", "/api/custom/debug", (e) => {
    try {
        const record = $app.findRecordById("articles", "invalid-id")
        return e.json(200, record)
    } catch (err) {
        console.log("错误类型:", typeof err)
        console.log("错误信息:", err.message || err)
        return e.json(500, { "error": String(err) })
    }
})

// 3. 开发模式运行以获取详细日志
// ./pocketbase serve --dev
```

### 10.11.4 文件操作

```javascript
// 读取文件
routerAdd("GET", "/api/custom/config", (e) => {
    const content = $os.readFile(`${__hooks}/config.json`)
    const config = JSON.parse(String.fromCharCode(...content))
    return e.json(200, config)
})

// 写入文件
routerAdd("POST", "/api/custom/log", (e) => {
    const data = e.requestInfo().body
    const logLine = `${new Date().toISOString()} - ${data.message}\n`
    $os.writeFile(`${__hooks}/app.log`, logLine, 0o644)
    return e.json(200, { "message": "日志已写入" })
})
```

---

## 10.12 实战案例

### 10.12.1 自定义注册流程

```javascript
// pb_hooks/auth.pb.js

// 自定义注册接口 - 支持邀请码验证
routerAdd("POST", "/api/custom/register", (e) => {
    const data = e.requestInfo().body

    // 1. 验证必填字段
    if (!data.email || !data.password || !data.name) {
        return e.badRequestError("邮箱、密码和姓名为必填项", null)
    }

    // 2. 验证邀请码
    if (!data.inviteCode) {
        return e.badRequestError("需要邀请码才能注册", null)
    }

    let invite
    try {
        invite = $app.findFirstRecordByData("invites", "code", data.inviteCode)
    } catch (err) {
        return e.badRequestError("无效的邀请码", null)
    }

    if (invite.getBool("used")) {
        return e.badRequestError("该邀请码已被使用", null)
    }

    // 3. 创建用户
    $app.runInTransaction((txApp) => {
        const collection = txApp.findCollectionByNameOrId("users")
        const user = new Record(collection)
        user.set("email", data.email)
        user.set("password", data.password)
        user.set("name", data.name)
        user.set("role", "member")
        user.set("invitedBy", invite.get("createdBy"))
        txApp.save(user)

        // 4. 标记邀请码已使用
        invite.set("used", true)
        invite.set("usedBy", user.id)
        invite.set("usedAt", new Date().toISOString())
        txApp.save(invite)

        // 5. 创建默认用户配置
        const settingsCollection = txApp.findCollectionByNameOrId("user_settings")
        const settings = new Record(settingsCollection)
        settings.set("user", user.id)
        settings.set("theme", "light")
        settings.set("language", "zh-CN")
        settings.set("notifications", true)
        txApp.save(settings)
    })

    return e.json(201, { "message": "注册成功" })
})
```

### 10.12.2 数据校验中间件

```javascript
// pb_hooks/validators.pb.js

// 通用数据校验中间件工厂
function validateBody(rules) {
    return function(e) {
        const body = e.requestInfo().body
        const errors = {}

        for (let field in rules) {
            const fieldRules = rules[field]
            const value = body[field]

            // 必填检查
            if (fieldRules.required && (!value || value === "")) {
                errors[field] = `${field} 是必填字段`
                continue
            }

            if (!value && !fieldRules.required) continue

            // 最小长度检查
            if (fieldRules.minLength && typeof value === "string" && value.length < fieldRules.minLength) {
                errors[field] = `${field} 长度不能少于 ${fieldRules.minLength} 个字符`
            }

            // 最大长度检查
            if (fieldRules.maxLength && typeof value === "string" && value.length > fieldRules.maxLength) {
                errors[field] = `${field} 长度不能超过 ${fieldRules.maxLength} 个字符`
            }

            // 数值范围检查
            if (fieldRules.min !== undefined && typeof value === "number" && value < fieldRules.min) {
                errors[field] = `${field} 不能小于 ${fieldRules.min}`
            }
            if (fieldRules.max !== undefined && typeof value === "number" && value > fieldRules.max) {
                errors[field] = `${field} 不能大于 ${fieldRules.max}`
            }

            // 正则检查
            if (fieldRules.pattern && typeof value === "string") {
                const regex = new RegExp(fieldRules.pattern)
                if (!regex.test(value)) {
                    errors[field] = fieldRules.patternMessage || `${field} 格式不正确`
                }
            }
        }

        if (Object.keys(errors).length > 0) {
            return e.badRequestError("数据校验失败", errors)
        }

        return e.next()
    }
}

// 使用校验中间件
routerAdd("POST", "/api/custom/products", (e) => {
    const data = e.requestInfo().body

    const collection = $app.findCollectionByNameOrId("products")
    const record = new Record(collection)
    record.set("name", data.name)
    record.set("price", data.price)
    record.set("description", data.description)
    record.set("sku", data.sku)
    $app.save(record)

    return e.json(201, { "message": "商品创建成功", "id": record.id })
}, validateBody({
    name:        { required: true, minLength: 2, maxLength: 100 },
    price:       { required: true, min: 0.01, max: 999999.99 },
    description: { required: false, maxLength: 5000 },
    sku:         { required: true, pattern: "^[A-Z]{2}-\\d{6}$", patternMessage: "SKU格式应为: XX-000000" }
}))
```

### 10.12.3 Webhook通知系统

```javascript
// pb_hooks/webhooks.pb.js

// Webhook 管理
function sendWebhook(event, payload) {
    // 获取所有活跃的 webhook 配置
    let webhooks
    try {
        webhooks = $app.findRecordsByFilter(
            "webhooks",
            "active = true && events ~ {:event}",
            "",
            0, 0,
            { "event": event }
        )
    } catch (err) {
        console.log("获取 Webhook 配置失败:", err)
        return
    }

    for (let webhook of webhooks) {
        try {
            const res = $http.send({
                url:    webhook.get("url"),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Webhook-Event": event,
                    "X-Webhook-Secret": webhook.get("secret")
                },
                body: JSON.stringify({
                    "event": event,
                    "timestamp": new Date().toISOString(),
                    "payload": payload
                }),
                timeout: 10
            })

            // 记录发送日志
            const logCollection = $app.findCollectionByNameOrId("webhook_logs")
            const log = new Record(logCollection)
            log.set("webhook", webhook.id)
            log.set("event", event)
            log.set("statusCode", res.statusCode)
            log.set("success", res.statusCode >= 200 && res.statusCode < 300)
            $app.save(log)
        } catch (err) {
            console.log(`Webhook 发送失败 [${webhook.get("url")}]:`, err)
        }
    }
}

// 注册事件钩子
onRecordAfterCreateSuccess((e) => {
    sendWebhook("article.created", {
        "id": e.record.id,
        "title": e.record.get("title"),
        "author": e.record.get("author"),
        "status": e.record.get("status")
    })
    return e.next()
}, "articles")

onRecordAfterUpdateSuccess((e) => {
    sendWebhook("article.updated", {
        "id": e.record.id,
        "title": e.record.get("title"),
        "status": e.record.get("status")
    })
    return e.next()
}, "articles")

onRecordAfterDeleteSuccess((e) => {
    sendWebhook("article.deleted", {
        "id": e.record.id,
        "title": e.record.get("title")
    })
    return e.next()
}, "articles")

// Webhook 管理 API
routerAdd("POST", "/api/custom/webhooks/test", (e) => {
    const data = e.requestInfo().body

    const res = $http.send({
        url:    data.url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            "event": "test",
            "timestamp": new Date().toISOString(),
            "payload": { "message": "这是一条测试消息" }
        }),
        timeout: 10
    })

    return e.json(200, {
        "statusCode": res.statusCode,
        "success": res.statusCode >= 200 && res.statusCode < 300
    })
}, $apis.requireAuth())
```

---

> **小结**：PocketBase 的 JavaScript 扩展系统提供了一种便捷、低门槛的方式来扩展后端功能。通过 `pb_hooks` 目录中的 `.pb.js` 文件，开发者可以自定义路由、处理事件钩子、操作数据库、发送邮件、创建定时任务等。对于简单到中等复杂度的后端逻辑，JavaScript 扩展是理想的选择；对于需要更高性能或更复杂功能的场景，可以考虑使用 Go 扩展（参见下一章）。
