---
layout: default
title: 第01章 PocketBase概述与入门
---

# 第01章 PocketBase概述与入门

本章将全面介绍PocketBase——一个现代化的开源后端即服务(BaaS)平台。通过本章的学习，你将了解PocketBase的核心理念、技术架构、适用场景，并为后续深入学习打下坚实基础。

---

## 1.1 什么是PocketBase

### 1.1.1 PocketBase简介

PocketBase是一个使用**Go语言**开发的开源后端即服务(Backend as a Service, BaaS)平台。它最大的特点是将后端开发所需的所有核心组件——数据库、认证系统、文件存储、实时订阅、管理面板——全部集成到**单个可执行文件**中。

PocketBase由Gani Georgiev于2022年首次发布，项目托管在GitHub上，采用MIT许可证，完全免费开源。

```
┌─────────────────────────────────────────────────┐
│                  PocketBase                      │
│                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  SQLite   │  │   认证    │  │ 文件存储   │   │
│  │  数据库   │  │   系统    │  │   系统     │   │
│  └───────────┘  └───────────┘  └───────────┘   │
│                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ RESTful   │  │  实时     │  │  Admin    │   │
│  │   API     │  │  订阅     │  │   UI      │   │
│  └───────────┘  └───────────┘  └───────────┘   │
│                                                  │
│            单个可执行文件 (~40MB)                  │
└─────────────────────────────────────────────────┘
```

### 1.1.2 核心理念

PocketBase的设计哲学可以用几个关键词概括：

- **简单(Simple)**：下载即用，无需安装数据库、配置中间件或管理复杂的基础设施
- **便携(Portable)**：单个二进制文件包含所有功能，可以在任何平台上运行
- **可扩展(Extensible)**：支持通过JavaScript钩子或Go框架进行深度定制
- **开源(Open Source)**：MIT许可证，完全免费，可以自由修改和部署

### 1.1.3 一个简单的例子

假设你要为一个博客应用创建后端，传统方式你可能需要：

1. 安装并配置数据库(MySQL/PostgreSQL)
2. 搭建Web框架(Express/Django/Spring Boot)
3. 编写数据模型和API接口
4. 实现用户认证系统
5. 配置文件上传存储
6. 部署到服务器

使用PocketBase，你只需要：

```bash
# 1. 下载PocketBase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.25.0/pocketbase_0.25.0_linux_amd64.zip

# 2. 解压
unzip pocketbase_0.25.0_linux_amd64.zip

# 3. 启动
./pocketbase serve
```

然后在管理面板中通过可视化界面创建数据集合，PocketBase会自动生成RESTful API，前端即可直接调用。整个过程不超过5分钟。

---

## 1.2 PocketBase的核心特性

### 1.2.1 内嵌SQLite数据库

PocketBase使用SQLite作为底层数据库引擎，数据存储在单个文件中。这意味着：

- **零配置**：不需要安装和维护独立的数据库服务
- **便于备份**：只需复制数据文件即可完成备份
- **高性能**：SQLite在读操作上性能优异，适合中小规模应用

```
数据文件位置：pb_data/data.db
存储文件位置：pb_data/storage/
```

### 1.2.2 自动RESTful API生成

当你在管理面板中创建一个集合(Collection)后，PocketBase会自动为该集合生成完整的CRUD API：

```
GET    /api/collections/{collection}/records     - 列表查询
GET    /api/collections/{collection}/records/{id} - 获取单条记录
POST   /api/collections/{collection}/records     - 创建记录
PATCH  /api/collections/{collection}/records/{id} - 更新记录
DELETE /api/collections/{collection}/records/{id} - 删除记录
```

例如，创建一个名为`posts`的集合后，你可以立即通过以下API进行操作：

```bash
# 获取所有帖子
curl http://127.0.0.1:8090/api/collections/posts/records

# 创建新帖子
curl -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Content-Type: application/json" \
  -d '{"title": "我的第一篇文章", "content": "Hello PocketBase!"}'

# 获取指定帖子
curl http://127.0.0.1:8090/api/collections/posts/records/RECORD_ID

# 更新帖子
curl -X PATCH http://127.0.0.1:8090/api/collections/posts/records/RECORD_ID \
  -H "Content-Type: application/json" \
  -d '{"title": "更新后的标题"}'

# 删除帖子
curl -X DELETE http://127.0.0.1:8090/api/collections/posts/records/RECORD_ID
```

### 1.2.3 内置认证系统

PocketBase提供完整的用户认证解决方案：

- **邮箱/密码认证**：标准的注册、登录、密码重置流程
- **OAuth2社交登录**：支持Google、GitHub、Facebook、微软等多种OAuth2提供商
- **Token认证**：基于JWT的无状态认证机制

```bash
# 用户注册
curl -X POST http://127.0.0.1:8090/api/collections/users/records \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "passwordConfirm": "securepassword123",
    "name": "张三"
  }'

# 用户登录
curl -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "user@example.com",
    "password": "securepassword123"
  }'
```

### 1.2.4 实时数据订阅(SSE)

PocketBase使用Server-Sent Events (SSE)技术提供实时数据推送功能。当集合中的数据发生变化时，订阅的客户端会立即收到通知：

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 订阅posts集合的所有变化
pb.collection('posts').subscribe('*', function (e) {
    console.log(e.action); // create, update, delete
    console.log(e.record); // 变化的记录数据
});

// 订阅特定记录的变化
pb.collection('posts').subscribe('RECORD_ID', function (e) {
    console.log('记录已更新:', e.record);
});

// 取消订阅
pb.collection('posts').unsubscribe('*');
```

### 1.2.5 文件存储

PocketBase内置文件存储功能，支持在记录中附加文件字段：

- 文件默认存储在`pb_data/storage/`目录
- 支持配置S3兼容的对象存储(如AWS S3、MinIO、阿里云OSS)
- 自动生成缩略图(针对图片文件)
- 支持文件大小和类型限制

```bash
# 上传文件
curl -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -F "title=带图片的文章" \
  -F "cover=@/path/to/image.jpg"
```

### 1.2.6 管理面板(Admin UI)

PocketBase自带一个美观且功能强大的Web管理面板：

- 可视化集合管理：创建、修改、删除集合和字段
- 数据浏览和编辑：表格视图浏览和操作数据
- API规则配置：可视化设置API访问权限
- 日志查看：查看API请求日志
- 系统设置：邮件、S3存储、OAuth2等配置

访问地址：`http://127.0.0.1:8090/_/`

### 1.2.7 JavaScript/Go扩展能力

PocketBase提供两种扩展方式：

**JavaScript钩子(推荐入门使用)：**

```javascript
// pb_hooks/main.pb.js

// 在创建记录之前执行自定义逻辑
onRecordCreate((e) => {
    // 自动设置创建时间
    e.record.set("customField", "自动设置的值");
    e.next();
}, "posts");

// 添加自定义API路由
routerAdd("GET", "/api/hello", (e) => {
    return e.json(200, { "message": "你好，PocketBase！" });
});
```

**Go框架扩展(适合高级用户)：**

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
        log.Println("新帖子被创建:", e.Record.GetString("title"))
        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

---

## 1.3 PocketBase与其他BaaS对比

### 1.3.1 对比概览表

| 特性 | PocketBase | Firebase | Supabase |
|------|-----------|----------|----------|
| **开源** | ✅ MIT许可证 | ❌ 专有 | ✅ Apache 2.0 |
| **自托管** | ✅ 完全支持 | ❌ 仅云服务 | ✅ 支持(较复杂) |
| **数据库** | SQLite | Firestore(NoSQL) | PostgreSQL |
| **价格** | 完全免费 | 免费层+按量付费 | 免费层+按量付费 |
| **部署复杂度** | ⭐ 极简 | ⭐⭐ 简单 | ⭐⭐⭐⭐ 较复杂 |
| **实时功能** | SSE | WebSocket | WebSocket |
| **认证** | 邮箱+OAuth2 | 多种方式 | 邮箱+OAuth2+更多 |
| **文件存储** | 本地/S3 | Cloud Storage | S3 |
| **扩展性** | JS/Go钩子 | Cloud Functions | Edge Functions |
| **SQL支持** | ✅ 完整SQL | ❌ NoSQL查询 | ✅ 完整SQL |
| **管理面板** | ✅ 内置 | ✅ Firebase Console | ✅ Supabase Dashboard |
| **适用规模** | 小到中型 | 小到大型 | 小到大型 |
| **离线支持** | 需自行实现 | ✅ 内置 | 需自行实现 |
| **CDN** | 需自行配置 | ✅ 内置 | 需自行配置 |

### 1.3.2 与Firebase对比

**选择PocketBase的理由：**
- 需要完全控制数据，不希望数据存储在第三方云服务上
- 项目预算有限，希望零成本运行后端
- 需要使用SQL查询，习惯关系型数据库
- 需要在内网或离线环境下运行

**选择Firebase的理由：**
- 需要全球CDN分发和高可用性
- 项目规模大，需要自动扩缩容
- 需要完善的移动端SDK和离线支持
- 团队已有Google Cloud生态经验

### 1.3.3 与Supabase对比

**选择PocketBase的理由：**
- 追求极简部署，不想管理PostgreSQL集群
- 轻量级项目，不需要复杂的数据库功能
- 单机部署场景，服务器资源有限

**选择Supabase的理由：**
- 需要PostgreSQL的强大功能(复杂查询、存储过程、触发器)
- 需要大规模数据存储和高并发写入
- 需要实时数据库(基于PostgreSQL的逻辑复制)
- 需要更丰富的第三方集成

---

## 1.4 PocketBase的技术架构

### 1.4.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端层                                │
│  Web浏览器 / 移动App / 桌面应用 / 其他服务                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    PocketBase 核心                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Echo HTTP 框架 (路由层)                  │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐ │    │
│  │  │ CRUD │ │ Auth │ │ File │ │ SSE  │ │ Admin UI │ │    │
│  │  │ API  │ │ API  │ │ API  │ │ API  │ │  (SPA)   │ │    │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐     │
│  │  Goja JS     │  │   Hook       │  │  Middleware   │     │
│  │  引擎        │  │   系统       │  │  中间件       │     │
│  └──────────────┘  └──────────────┘  └───────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              数据访问层 (DAO)                         │    │
│  └─────────────────────┬───────────────────────────────┘    │
│                        │                                     │
│  ┌─────────────────────▼───────────────────────────────┐    │
│  │              SQLite 数据库引擎                        │    │
│  │         pb_data/data.db (数据文件)                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              文件存储层                                │    │
│  │       本地文件系统 / S3兼容对象存储                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.4.2 Go语言核心

PocketBase使用Go语言编写，带来以下技术优势：

- **编译为原生二进制**：无需运行时环境，直接在目标平台运行
- **高效的并发处理**：Go的goroutine轻量级协程，高效处理并发请求
- **内存管理**：Go的GC(垃圾回收)机制自动管理内存
- **交叉编译**：轻松为不同平台编译可执行文件

```go
// PocketBase的核心启动代码结构
package main

import (
    "github.com/pocketbase/pocketbase"
)

func main() {
    app := pocketbase.New()

    // PocketBase内部会自动完成以下初始化：
    // 1. 加载配置
    // 2. 初始化SQLite数据库
    // 3. 注册路由
    // 4. 启动HTTP服务器
    // 5. 加载Admin UI静态资源

    app.Start()
}
```

### 1.4.3 内嵌SQLite

PocketBase使用的SQLite具有以下特点：

- 基于`modernc.org/sqlite`，纯Go实现的SQLite绑定
- 开启WAL(Write-Ahead Logging)模式，提升并发读性能
- 支持完整的SQL查询语法
- 通过`pb_data/data.db`单文件存储所有数据

```sql
-- PocketBase内部的数据表结构示例
-- 每个集合对应一张数据表

-- 系统表：存储集合的元信息
SELECT * FROM _collections;

-- 用户数据表
SELECT id, email, name, created, updated FROM users;

-- 自定义集合的数据表
SELECT * FROM posts;
```

### 1.4.4 Echo HTTP框架

PocketBase使用Echo框架处理HTTP路由，这是Go生态中一个高性能的Web框架：

- 快速的HTTP路由匹配
- 中间件支持(CORS、日志、认证等)
- 请求/响应处理
- 静态文件服务

### 1.4.5 SSE实时推送

PocketBase使用Server-Sent Events(服务器发送事件)实现实时数据推送：

- **单向通信**：服务器主动向客户端推送数据
- **基于HTTP**：不需要WebSocket的握手升级，更简单
- **自动重连**：浏览器原生支持自动重连机制
- **轻量级**：比WebSocket更轻量，适合数据推送场景

```
客户端                           服务器
  │                                │
  │  GET /api/realtime (SSE连接)   │
  │ ──────────────────────────────>│
  │                                │
  │  data: {"action":"create",...} │
  │ <──────────────────────────────│
  │                                │
  │  data: {"action":"update",...} │
  │ <──────────────────────────────│
  │                                │
  │  data: {"action":"delete",...} │
  │ <──────────────────────────────│
  │                                │
```

### 1.4.6 Goja JavaScript引擎

PocketBase内嵌了Goja JavaScript引擎，允许使用JavaScript编写扩展逻辑：

- **Goja**是一个纯Go实现的ECMAScript 5.1+运行时
- 支持大部分现代JavaScript语法(包括ES6+特性)
- 无需安装Node.js或其他JavaScript运行时
- 通过`pb_hooks/`目录下的`.pb.js`文件加载

```javascript
// pb_hooks/main.pb.js

// Goja引擎支持的JavaScript特性示例
const greeting = (name) => `你好, ${name}！`;

// 使用PocketBase提供的全局API
routerAdd("GET", "/api/custom/greet/:name", (e) => {
    const name = e.request.pathValue("name");
    return e.json(200, { message: greeting(name) });
});
```

---

## 1.5 PocketBase的应用场景

### 1.5.1 快速原型与MVP开发

PocketBase非常适合快速验证产品想法：

- **10分钟搭建后端**：创建集合、配置规则、前端即可调用API
- **前端优先开发**：前端开发者无需关心后端实现，专注于UI/UX
- **快速迭代**：通过管理面板实时修改数据结构，无需重新部署

```
典型MVP开发流程：
1. 下载PocketBase (1分钟)
2. 创建数据集合和字段 (5分钟)
3. 配置API访问规则 (3分钟)
4. 前端调用API开发界面 (数小时)
5. 产品上线测试 (部署到VPS)
```

### 1.5.2 小型Web应用和移动App后端

适合用户量在数千到数万级别的应用：

- 博客系统
- 待办事项应用
- 笔记应用
- 小型电商网站
- 社区论坛
- 活动报名系统

```javascript
// 示例：待办事项App的前端代码
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 获取待办事项列表
const todos = await pb.collection('todos').getFullList({
    sort: '-created',
    filter: 'completed = false'
});

// 创建新待办事项
const newTodo = await pb.collection('todos').create({
    title: '学习PocketBase',
    completed: false,
    userId: pb.authStore.record.id
});

// 标记完成
await pb.collection('todos').update(newTodo.id, {
    completed: true
});
```

### 1.5.3 内部管理系统

PocketBase的Admin UI本身就是一个功能完善的管理面板：

- 员工信息管理系统
- 资产管理系统
- 项目管理工具
- 知识库系统

### 1.5.4 个人项目和独立开发者

对于个人项目，PocketBase几乎是最优选择：

- **零成本**：只需一台最低配置的VPS(2美元/月)即可运行
- **零运维**：单文件部署，备份只需复制`pb_data`目录
- **全功能**：认证、数据库、文件存储一应俱全

### 1.5.5 教学与学习

PocketBase是学习后端开发概念的优秀工具：

- 理解RESTful API设计
- 学习数据库建模
- 了解认证和授权机制
- 实践前后端分离开发
- 学习实时应用开发

---

## 1.6 PocketBase的优势与局限性

### 1.6.1 优势

**单文件部署**

```bash
# 部署只需要3步
scp pocketbase user@server:/app/
ssh user@server
/app/pocketbase serve --http=0.0.0.0:8090
```

一个二进制文件，约40MB大小，包含所有功能。没有依赖安装，没有环境配置，没有复杂的部署流程。

**零依赖**

- 不需要安装数据库服务器(MySQL、PostgreSQL等)
- 不需要安装运行时环境(Node.js、Python等)
- 不需要安装Web服务器(Nginx、Apache等)
- 不需要安装缓存服务(Redis等)

**低成本运行**

| 资源 | 最低要求 | 推荐配置 |
|------|---------|---------|
| CPU | 1核 | 2核 |
| 内存 | 256MB | 512MB-1GB |
| 磁盘 | 取决于数据量 | 10GB+ SSD |
| 操作系统 | Linux/macOS/Windows | Linux |

**内置管理面板**

无需额外开发后台管理系统，PocketBase自带功能完善的Web管理界面，支持可视化管理数据、配置系统、查看日志等。

**灵活的扩展能力**

通过JavaScript钩子或Go框架，可以实现：
- 自定义API接口
- 数据验证和处理逻辑
- 第三方服务集成
- 定时任务
- 邮件通知

### 1.6.2 局限性

**SQLite并发写入限制**

SQLite在并发写入方面存在天然限制：

- 同一时刻只能有一个写操作
- 大量并发写入时可能出现锁竞争
- 不适合写入密集型应用(如高频交易系统、实时分析)

```
适用场景：
✅ 读多写少的应用(博客、展示站点)
✅ 中等写入量的应用(普通CRUD应用)
❌ 高频写入应用(每秒数千次写入)
❌ 大量并发写入场景
```

**不适合大规模分布式部署**

- PocketBase设计为单实例运行，不支持原生集群部署
- 不支持水平扩展(无法通过增加实例来提升性能)
- 不支持数据库主从复制
- 不支持跨地域部署

**数据量限制**

SQLite理论上支持最大281TB的数据库文件，但实际使用中：
- 建议数据量控制在10GB以内以获得最佳性能
- 超过1GB时需要关注查询优化和索引设计
- 大量二进制数据建议使用S3存储

**生态相对较新**

- 社区规模相比Firebase等成熟平台较小
- 第三方插件和集成相对较少
- 中文文档和教程资源有限(这也是本教程存在的意义)

---

## 1.7 学习路线规划

### 1.7.1 推荐学习路径

```
第一阶段：基础入门 (1-3天)
├── 第01章：PocketBase概述与入门 ← 当前位置
├── 第02章：环境搭建与安装部署
├── 第03章：管理面板与数据建模
└── 第04章：数据集合与字段类型详解

第二阶段：核心功能 (3-5天)
├── 第05章：RESTful API详解
├── 第06章：认证与用户管理
├── 第07章：API访问规则与权限控制
├── 第08章：文件存储与管理
└── 第09章：实时数据订阅

第三阶段：进阶扩展 (3-5天)
├── 第10章：JavaScript扩展开发
├── 第11章：Go语言扩展开发
└── 第12章：前端SDK集成指南

第四阶段：生产实践 (2-3天)
├── 第13章：Docker部署与生产环境配置
├── 第14章：性能优化与运维监控
└── 第15章：实战案例与最佳实践
```

### 1.7.2 各章节概览

| 章节 | 内容 | 难度 |
|------|------|------|
| 第01章 | PocketBase概述与入门 | ⭐ |
| 第02章 | 环境搭建与安装部署 | ⭐ |
| 第03章 | 管理面板与数据建模 | ⭐ |
| 第04章 | 数据集合与字段类型详解 | ⭐⭐ |
| 第05章 | RESTful API详解 | ⭐⭐ |
| 第06章 | 认证与用户管理 | ⭐⭐ |
| 第07章 | API访问规则与权限控制 | ⭐⭐⭐ |
| 第08章 | 文件存储与管理 | ⭐⭐ |
| 第09章 | 实时数据订阅 | ⭐⭐ |
| 第10章 | JavaScript扩展开发 | ⭐⭐⭐ |
| 第11章 | Go语言扩展开发 | ⭐⭐⭐⭐ |
| 第12章 | 前端SDK集成指南 | ⭐⭐ |
| 第13章 | Docker部署与生产环境配置 | ⭐⭐⭐ |
| 第14章 | 性能优化与运维监控 | ⭐⭐⭐⭐ |
| 第15章 | 实战案例与最佳实践 | ⭐⭐⭐ |

### 1.7.3 学习前提

学习本教程，建议具备以下基础知识：

- **基础**：了解HTTP协议和RESTful API概念
- **前端**：熟悉HTML/CSS/JavaScript基础
- **命令行**：能够使用终端/命令行执行基本命令
- **可选**：了解SQL查询语言
- **可选**：了解Go语言基础(第11章需要)

### 1.7.4 学习资源

| 资源 | 链接 | 说明 |
|------|------|------|
| 官方文档 | https://pocketbase.io/docs/ | 最权威的参考资料 |
| GitHub仓库 | https://github.com/pocketbase/pocketbase | 源代码和Issue |
| JavaScript SDK | https://github.com/pocketbase/js-sdk | 前端集成库 |
| Dart SDK | https://github.com/pocketbase/dart-sdk | Flutter集成库 |
| 社区讨论 | https://github.com/pocketbase/pocketbase/discussions | 社区问答 |

---

## 本章小结

本章我们全面了解了PocketBase的基本概念、核心特性、技术架构和适用场景。关键要点回顾：

1. **PocketBase是什么**：一个集数据库、认证、文件存储、实时订阅于一体的开源BaaS平台
2. **核心优势**：单文件部署、零依赖、自动API生成、内置管理面板
3. **技术栈**：Go语言 + SQLite + Echo框架 + Goja JS引擎
4. **适用场景**：原型开发、小型应用、内部系统、个人项目、教学
5. **局限性**：不适合大规模分布式、高并发写入场景

下一章我们将学习如何搭建PocketBase的开发环境，开始动手实践。
