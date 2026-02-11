---
layout: default
title: 第07章 API访问规则与权限控制
---

# 第07章 API访问规则与权限控制

PocketBase 提供了一套强大而灵活的 API 访问规则系统，允许开发者以声明式的方式定义数据的访问权限。通过精心配置这些规则，你可以轻松实现从简单的公开访问到复杂的多角色权限控制。本章将全面讲解 PocketBase 的权限控制机制。

---

## 7.1 API规则概述

### 7.1.1 什么是API规则

PocketBase 的 API 规则是一种声明式的权限控制机制，它定义了谁可以对集合中的记录执行哪些操作。每个集合都有独立的 API 规则配置，开发者可以通过管理面板或 API 来设置这些规则。

API 规则本质上是**过滤表达式**，当一个请求到达时，PocketBase 会评估相应的规则表达式：
- 如果表达式的结果为 `true`，则允许该操作
- 如果表达式的结果为 `false`，则拒绝该操作并返回 403 错误

### 7.1.2 权限控制的层次

PocketBase 的权限控制分为以下几个层次：

```
┌─────────────────────────────────┐
│       管理员 (Admin)             │  → 拥有所有权限，绕过所有规则
├─────────────────────────────────┤
│       API 规则 (API Rules)       │  → 集合级别的访问控制
├─────────────────────────────────┤
│       字段级权限                  │  → 控制哪些字段可以修改
├─────────────────────────────────┤
│       关联数据权限                │  → 跨集合的权限检查
└─────────────────────────────────┘
```

### 7.1.3 规则评估流程

```
客户端请求 → 身份验证检查 → 查找对应的API规则 → 评估规则表达式 → 允许/拒绝
```

当用户发起一个 API 请求时，PocketBase 会：

1. 检查请求是否携带有效的认证 token
2. 根据请求的操作类型（列表、查看、创建、更新、删除）选择对应的规则
3. 将规则表达式中的变量替换为实际值
4. 评估表达式的结果
5. 根据结果允许或拒绝请求

---

## 7.2 五种API规则

PocketBase 为每个集合定义了五种 API 规则，分别对应五种不同的操作。

### 7.2.1 ListRule - 列表规则

控制谁可以获取集合的记录列表。当客户端请求 `GET /api/collections/{collection}/records` 时触发。

```
ListRule 作用于：获取记录列表
HTTP方法：GET
API端点：/api/collections/{collection}/records
```

**示例：** 只有认证用户才能查看文章列表：

```
@request.auth.id != ""
```

**注意：** ListRule 会作为额外的 WHERE 条件附加到查询中，因此它不仅决定是否允许查询，还会过滤返回的结果。

### 7.2.2 ViewRule - 查看规则

控制谁可以查看单条记录的详情。当客户端请求 `GET /api/collections/{collection}/records/{id}` 时触发。

```
ViewRule 作用于：查看单条记录
HTTP方法：GET
API端点：/api/collections/{collection}/records/{id}
```

**示例：** 只有记录的所有者才能查看该记录：

```
@request.auth.id = user
```

### 7.2.3 CreateRule - 创建规则

控制谁可以创建新记录。当客户端请求 `POST /api/collections/{collection}/records` 时触发。

```
CreateRule 作用于：创建新记录
HTTP方法：POST
API端点：/api/collections/{collection}/records
```

**示例：** 只有认证用户才能创建文章，且必须将自己设为作者：

```
@request.auth.id != "" && @request.data.author = @request.auth.id
```

### 7.2.4 UpdateRule - 更新规则

控制谁可以更新已有记录。当客户端请求 `PATCH /api/collections/{collection}/records/{id}` 时触发。

```
UpdateRule 作用于：更新已有记录
HTTP方法：PATCH
API端点：/api/collections/{collection}/records/{id}
```

**示例：** 只有记录的创建者才能更新该记录：

```
@request.auth.id = author
```

### 7.2.5 DeleteRule - 删除规则

控制谁可以删除记录。当客户端请求 `DELETE /api/collections/{collection}/records/{id}` 时触发。

```
DeleteRule 作用于：删除记录
HTTP方法：DELETE
API端点：/api/collections/{collection}/records/{id}
```

**示例：** 只有管理员角色的用户才能删除文章：

```
@request.auth.role = "admin"
```

### 7.2.6 规则汇总表

| 规则 | 操作 | HTTP方法 | 说明 |
|------|------|----------|------|
| ListRule | 列表查询 | GET (列表) | 过滤返回的记录列表 |
| ViewRule | 查看详情 | GET (单条) | 控制单条记录的可见性 |
| CreateRule | 创建记录 | POST | 控制记录创建权限 |
| UpdateRule | 更新记录 | PATCH | 控制记录更新权限 |
| DeleteRule | 删除记录 | DELETE | 控制记录删除权限 |

---

## 7.3 规则语法详解

### 7.3.1 基础语法

API 规则使用类似 SQL WHERE 子句的过滤表达式语法。

**比较运算符：**

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `=` | 等于 | `status = "active"` |
| `!=` | 不等于 | `status != "deleted"` |
| `>` | 大于 | `age > 18` |
| `>=` | 大于等于 | `age >= 18` |
| `<` | 小于 | `price < 100` |
| `<=` | 小于等于 | `price <= 100` |
| `~` | 包含 (LIKE) | `title ~ "hello"` |
| `!~` | 不包含 (NOT LIKE) | `title !~ "spam"` |
| `?=` | 数组中任意一个等于 | `tags ?= "news"` |
| `?!=` | 数组中任意一个不等于 | `tags ?!= "draft"` |
| `?>` | 数组中任意一个大于 | `scores ?> 90` |
| `?>=` | 数组中任意一个大于等于 | `scores ?>= 60` |
| `?<` | 数组中任意一个小于 | `scores ?< 60` |
| `?<=` | 数组中任意一个小于等于 | `scores ?<= 100` |
| `?~` | 数组中任意一个包含 | `tags ?~ "tech"` |
| `?!~` | 数组中任意一个不包含 | `tags ?!~ "spam"` |

**逻辑运算符：**

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `&&` | 逻辑与 | `a = 1 && b = 2` |
| `\|\|` | 逻辑或 | `a = 1 \|\| b = 2` |

**括号分组：**

```
(status = "active" || status = "pending") && @request.auth.id != ""
```

### 7.3.2 @request 对象

`@request` 是一个特殊的对象，代表当前的 API 请求。它提供了以下属性：

#### @request.auth - 当前认证用户

```
@request.auth.id              // 当前认证用户的ID
@request.auth.collectionId    // 用户所属集合的ID
@request.auth.collectionName  // 用户所属集合的名称
@request.auth.username        // 用户名
@request.auth.email           // 邮箱
@request.auth.emailVisibility // 邮箱是否可见
@request.auth.verified        // 是否已验证邮箱
@request.auth.{自定义字段}     // 用户集合中的自定义字段
```

**常用示例：**

```
// 检查用户是否已认证
@request.auth.id != ""

// 检查用户是否来自特定集合
@request.auth.collectionName = "users"

// 检查用户角色
@request.auth.role = "editor"

// 检查用户是否已验证邮箱
@request.auth.verified = true
```

#### @request.data - 请求体数据

`@request.data` 包含 POST/PATCH 请求中提交的数据。

```
@request.data.title           // 提交的title字段
@request.data.status          // 提交的status字段
@request.data.author          // 提交的author字段
```

**常用示例：**

```
// 确保创建记录时设置正确的作者
@request.data.author = @request.auth.id

// 限制状态只能设置为特定值
@request.data.status = "draft" || @request.data.status = "published"

// 防止用户修改某些字段（通过要求字段值不变）
@request.data.role = role
```

#### @request.query - 查询参数

```
@request.query.filter        // URL查询参数中的filter
@request.query.sort          // URL查询参数中的sort
```

#### @request.headers - 请求头

```
@request.headers.x_custom_header   // 自定义请求头（注意：横线替换为下划线）
```

### 7.3.3 @collection 对象

`@collection` 允许你引用其他集合中的数据，实现跨集合的权限检查。

```
@collection.collectionName.fieldName
```

**示例：** 检查当前用户是否在团队成员列表中：

```
@collection.team_members.user ?= @request.auth.id && @collection.team_members.team = team_id
```

### 7.3.4 字段引用

在规则表达式中，你可以直接引用当前记录的字段名。

```
// 引用当前记录的 "author" 字段
author = @request.auth.id

// 引用关联字段的嵌套属性
author.role = "admin"

// 引用当前记录的 "status" 字段
status = "published"
```

### 7.3.5 特殊值

```
""       // 空字符串
null     // 空值
true     // 布尔真
false    // 布尔假
@now     // 当前时间
```

**示例：**

```
// 检查记录的过期时间是否在未来
expireDate > @now

// 检查某个字段是否为空
description != ""
```

---

## 7.4 常见权限配置模式

### 7.4.1 公开访问

将规则设置为**空字符串 `""`** 表示允许所有人访问，无需任何认证。

```
规则值: ""   (空字符串)
效果: 任何人都可以执行该操作，包括未认证的用户
```

**使用场景：**
- 公开的博客文章列表
- 产品展示页面
- 公共API接口

**管理面板设置：** 将规则输入框留空，但确保已解锁（非锁定状态）。

### 7.4.2 完全禁止

将规则设置为 **`null`**（在管理面板中锁定该规则）表示完全禁止该操作。

```
规则值: null (锁定状态)
效果: 除管理员外，任何人都不能执行该操作
```

**使用场景：**
- 禁止客户端删除重要数据
- 禁止直接通过API创建某些记录（只能通过后端钩子创建）
- 内部数据集合

**管理面板设置：** 点击规则旁的锁定图标。

### 7.4.3 仅认证用户

```
@request.auth.id != ""
```

**效果：** 只有携带有效认证 token 的用户才能执行该操作。

**使用场景：**
- 需要登录才能查看的内容
- 需要登录才能发表评论
- 需要登录才能创建订单

**变体 - 仅特定集合的认证用户：**

```
@request.auth.collectionName = "users"
```

**变体 - 仅已验证邮箱的用户：**

```
@request.auth.id != "" && @request.auth.verified = true
```

### 7.4.4 仅所有者

```
@request.auth.id = user
```

其中 `user` 是记录中存储用户ID的关联字段名称。

**效果：** 只有记录的所有者才能执行该操作。

**使用场景：**
- 用户只能编辑自己的个人资料
- 用户只能删除自己的帖子
- 用户只能查看自己的订单

**完整示例：**

```
// posts 集合的权限配置
ListRule:   ""                                    // 所有人可以查看列表
ViewRule:   ""                                    // 所有人可以查看详情
CreateRule: @request.auth.id != ""                // 认证用户可以创建
UpdateRule: @request.auth.id = author             // 只有作者可以更新
DeleteRule: @request.auth.id = author             // 只有作者可以删除
```

### 7.4.5 基于角色的访问控制

假设用户集合中有一个 `role` 字段：

```
// 只有管理员角色可以操作
@request.auth.role = "admin"

// 管理员或编辑者可以操作
@request.auth.role = "admin" || @request.auth.role = "editor"

// 管理员可以操作所有，普通用户只能操作自己的
@request.auth.role = "admin" || @request.auth.id = author
```

**多角色示例：**

```
// 用户集合增加 role 字段，可选值: "admin", "editor", "viewer"

// 文章集合权限配置:
ListRule:   ""
ViewRule:   ""
CreateRule: @request.auth.role = "admin" || @request.auth.role = "editor"
UpdateRule: @request.auth.role = "admin" || (@request.auth.role = "editor" && @request.auth.id = author)
DeleteRule: @request.auth.role = "admin"
```

---

## 7.5 关联数据权限

### 7.5.1 通过关联字段控制权限

当记录中有关联字段时，你可以通过点号语法访问关联记录的属性。

**示例：文章属于某个团队，只有团队成员可以编辑**

假设数据结构：
- `teams` 集合：`id`, `name`, `members`（关联到 users，多值）
- `posts` 集合：`id`, `title`, `content`, `team`（关联到 teams）

```
// posts 集合的 UpdateRule:
// 检查当前用户是否在文章所属团队的成员列表中
team.members ?= @request.auth.id
```

### 7.5.2 跨集合权限检查

使用 `@collection` 可以引用其他集合的数据进行权限检查。

**示例：检查用户是否有某个权限**

假设有一个 `permissions` 集合：`user`（关联到 users），`resource`，`action`

```
// 检查当前用户是否有编辑该资源的权限
@collection.permissions.user ?= @request.auth.id &&
@collection.permissions.resource ?= id &&
@collection.permissions.action ?= "edit"
```

### 7.5.3 多层关联

PocketBase 支持多层关联字段的嵌套访问。

```
// 文章 -> 分类 -> 所有者
category.owner = @request.auth.id

// 评论 -> 文章 -> 作者
post.author = @request.auth.id
```

**示例：评论系统**

```
// comments 集合:
// 字段: id, content, post(关联posts), author(关联users)

// 评论的 ListRule - 只有当文章是公开的才能查看评论
post.status = "published"

// 评论的 DeleteRule - 文章作者或评论作者都可以删除评论
@request.auth.id = author || @request.auth.id = post.author
```

---

## 7.6 字段级权限控制

### 7.6.1 限制可修改字段

通过 `@request.data` 结合记录的当前值，你可以限制用户能够修改哪些字段。

**原理：** 如果要求提交的数据中某个字段的值必须等于该字段的当前值，就相当于禁止修改该字段。

```
// 禁止修改 role 字段（要求提交的 role 必须等于当前值）
@request.data.role = role

// 禁止修改 author 字段
@request.data.author = author

// 禁止修改 createdAt（系统字段，通常不需要额外保护）
```

### 7.6.2 组合字段限制

```
// 普通用户只能修改 title 和 content，不能修改 status 和 author
@request.auth.id = author &&
@request.data.status = status &&
@request.data.author = author
```

### 7.6.3 基于角色的字段权限

```
// 管理员可以修改所有字段，普通用户只能修改部分字段
@request.auth.role = "admin" ||
(@request.auth.id = author &&
 @request.data.status = status &&
 @request.data.featured = featured)
```

### 7.6.4 CreateRule 中的字段验证

在创建记录时，你可以强制设置某些字段的值：

```
// 创建文章时，必须将 author 设为当前用户
@request.data.author = @request.auth.id

// 创建文章时，状态必须为 "draft"
@request.data.author = @request.auth.id && @request.data.status = "draft"
```

### 7.6.5 实际应用示例

**用户资料更新：**

```
// users 集合的 UpdateRule:
// 用户只能更新自己的资料，且不能修改 role 和 verified 字段
@request.auth.id = id &&
@request.data.role = role &&
@request.data.verified = verified
```

**订单状态更新：**

```
// orders 集合的 UpdateRule:
// 只有管理员可以修改订单状态，普通用户不能修改任何字段（仅管理员操作）
@request.auth.role = "admin"

// 或者更精细的控制：
// 卖家只能将状态从 "pending" 改为 "shipped"
@request.auth.id = seller &&
status = "pending" &&
@request.data.status = "shipped"
```

---

## 7.7 管理员权限

### 7.7.1 管理员绕过所有规则

PocketBase 的管理员（Admin）账户拥有最高权限，**完全绕过所有 API 规则**。

```
管理员 (Admin) 特性:
├── 绕过所有 ListRule
├── 绕过所有 ViewRule
├── 绕过所有 CreateRule
├── 绕过所有 UpdateRule
├── 绕过所有 DeleteRule
└── 可以访问所有集合的所有记录
```

### 7.7.2 管理员认证

管理员通过独立的认证端点进行登录：

```bash
# 管理员登录
curl -X POST http://127.0.0.1:8090/api/admins/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "admin@example.com",
    "password": "your-admin-password"
  }'
```

返回的 token 可以用于后续的 API 请求：

```bash
# 使用管理员 token 访问受限数据
curl http://127.0.0.1:8090/api/collections/posts/records \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 7.7.3 管理员 vs 普通用户

| 特性 | 管理员 (Admin) | 普通用户 (Auth Record) |
|------|---------------|----------------------|
| 存储位置 | 系统内部表 | Auth 类型集合 |
| API规则 | 完全绕过 | 受规则约束 |
| 认证端点 | `/api/admins/auth-*` | `/api/collections/{collection}/auth-*` |
| 管理面板 | 可以访问 | 不可访问 |
| 适用场景 | 后台管理 | 前端用户 |

### 7.7.4 安全建议

```
⚠️ 安全最佳实践:

1. 不要在前端应用中使用管理员 token
2. 管理员账户应使用强密码
3. 管理员 token 不应存储在客户端
4. 生产环境应限制管理面板的访问（如通过反向代理限制IP）
5. 定期轮换管理员密码
```

---

## 7.8 规则调试技巧

### 7.8.1 使用API Explorer测试

PocketBase 管理面板自带 API Explorer，可以方便地测试 API 规则。

**步骤：**

1. 打开管理面板 (`http://127.0.0.1:8090/_/`)
2. 进入集合设置
3. 点击 "API Preview" 或使用 API Explorer
4. 选择要测试的操作（List、View、Create 等）
5. 可以选择以不同身份发送请求（管理员、普通用户、匿名用户）

### 7.8.2 使用curl测试

**测试匿名访问：**

```bash
# 不带认证 token 的请求
curl -i http://127.0.0.1:8090/api/collections/posts/records

# 预期结果:
# 如果 ListRule 为 "" → 返回 200 和记录列表
# 如果 ListRule 为 null → 返回 403 Forbidden
# 如果 ListRule 需要认证 → 返回 200 但可能为空列表
```

**测试认证用户访问：**

```bash
# 先获取用户 token
TOKEN=$(curl -s -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"user@example.com","password":"password123"}' \
  | jq -r '.token')

# 使用 token 访问
curl -i http://127.0.0.1:8090/api/collections/posts/records \
  -H "Authorization: Bearer $TOKEN"
```

**测试创建权限：**

```bash
# 尝试创建记录
curl -i -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Post",
    "content": "Test Content",
    "author": "USER_ID"
  }'
```

### 7.8.3 使用JS SDK测试

```javascript
import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

// 测试匿名访问
try {
    const records = await pb.collection('posts').getList(1, 10);
    console.log('匿名访问成功:', records.items.length, '条记录');
} catch (e) {
    console.log('匿名访问失败:', e.status, e.message);
}

// 以用户身份登录后测试
await pb.collection('users').authWithPassword('user@example.com', 'password123');

try {
    const records = await pb.collection('posts').getList(1, 10);
    console.log('认证访问成功:', records.items.length, '条记录');
} catch (e) {
    console.log('认证访问失败:', e.status, e.message);
}

// 测试更新权限
try {
    await pb.collection('posts').update('RECORD_ID', {
        title: '更新后的标题'
    });
    console.log('更新成功');
} catch (e) {
    console.log('更新失败:', e.status, e.message);
}
```

### 7.8.4 常见错误排查

**403 Forbidden:**

```
可能原因:
1. API规则设置为 null（锁定状态）
2. 用户未认证但规则要求认证
3. 用户不满足规则表达式的条件
4. @request.data 中的字段值不符合规则要求

排查步骤:
1. 检查集合的API规则配置
2. 确认请求携带了有效的 Authorization header
3. 确认 token 未过期
4. 使用管理员 token 测试是否可以访问（排除数据问题）
```

**返回空列表（而非403）：**

```
可能原因:
ListRule 作为过滤条件附加到查询中，当没有记录满足条件时返回空列表

排查步骤:
1. 使用管理员 token 查看是否有数据
2. 检查 ListRule 的条件是否过于严格
3. 确认关联字段的值是否正确
```

### 7.8.5 日志查看

PocketBase 会在日志中记录 API 请求的详细信息：

```bash
# 启动时开启详细日志
./pocketbase serve --dev

# 查看日志中的请求信息
# 包括: 请求方法、路径、状态码、认证信息等
```

---

## 7.9 实战案例

### 7.9.1 博客系统权限设计

**集合结构：**

```
users (Auth集合):
├── username: Text
├── email: Email
├── role: Select ("admin", "author", "reader")
└── avatar: File

posts:
├── title: Text
├── content: Editor
├── author: Relation → users
├── status: Select ("draft", "published", "archived")
├── category: Relation → categories
└── tags: Relation → tags (多值)

comments:
├── content: Text
├── post: Relation → posts
├── author: Relation → users
└── status: Select ("approved", "pending", "spam")

categories:
├── name: Text
└── description: Text
```

**权限配置：**

```
=== posts 集合 ===
ListRule:   status = "published" || @request.auth.id = author || @request.auth.role = "admin"
ViewRule:   status = "published" || @request.auth.id = author || @request.auth.role = "admin"
CreateRule: @request.auth.id != "" && @request.data.author = @request.auth.id
UpdateRule: @request.auth.id = author || @request.auth.role = "admin"
DeleteRule: @request.auth.id = author || @request.auth.role = "admin"

=== comments 集合 ===
ListRule:   post.status = "published" && status = "approved"
ViewRule:   post.status = "published" && status = "approved"
CreateRule: @request.auth.id != "" && @request.data.author = @request.auth.id && @request.data.status = "pending"
UpdateRule: @request.auth.id = author && @request.data.status = status
DeleteRule: @request.auth.id = author || @request.auth.role = "admin" || @request.auth.id = post.author

=== categories 集合 ===
ListRule:   ""
ViewRule:   ""
CreateRule: @request.auth.role = "admin"
UpdateRule: @request.auth.role = "admin"
DeleteRule: @request.auth.role = "admin"
```

### 7.9.2 多角色系统权限设计

**场景：项目管理系统**

```
users (Auth集合):
├── username: Text
├── email: Email
└── role: Select ("super_admin", "project_manager", "developer", "viewer")

projects:
├── name: Text
├── description: Editor
├── owner: Relation → users
├── members: Relation → users (多值)
└── status: Select ("active", "completed", "archived")

tasks:
├── title: Text
├── description: Editor
├── project: Relation → projects
├── assignee: Relation → users
├── reporter: Relation → users
├── status: Select ("todo", "in_progress", "done")
└── priority: Select ("low", "medium", "high", "urgent")
```

**权限配置：**

```
=== projects 集合 ===
ListRule:   @request.auth.role = "super_admin" ||
            @request.auth.id = owner ||
            members ?= @request.auth.id

ViewRule:   @request.auth.role = "super_admin" ||
            @request.auth.id = owner ||
            members ?= @request.auth.id

CreateRule: @request.auth.role = "super_admin" ||
            @request.auth.role = "project_manager"

UpdateRule: @request.auth.role = "super_admin" ||
            @request.auth.id = owner

DeleteRule: @request.auth.role = "super_admin"

=== tasks 集合 ===
ListRule:   @request.auth.role = "super_admin" ||
            project.owner = @request.auth.id ||
            project.members ?= @request.auth.id

ViewRule:   @request.auth.role = "super_admin" ||
            project.owner = @request.auth.id ||
            project.members ?= @request.auth.id

CreateRule: @request.auth.role = "super_admin" ||
            @request.auth.role = "project_manager" ||
            (@request.auth.role = "developer" &&
             project.members ?= @request.auth.id)

UpdateRule: @request.auth.role = "super_admin" ||
            project.owner = @request.auth.id ||
            @request.auth.id = assignee ||
            @request.auth.id = reporter

DeleteRule: @request.auth.role = "super_admin" ||
            project.owner = @request.auth.id
```

### 7.9.3 社交应用权限设计

**场景：社交媒体应用**

```
users (Auth集合):
├── username: Text
├── displayName: Text
├── bio: Text
├── avatar: File
├── isPrivate: Bool
└── verified: Bool

posts:
├── content: Text
├── images: File (多值)
├── author: Relation → users
├── visibility: Select ("public", "followers", "private")
└── likes_count: Number

follows:
├── follower: Relation → users
├── following: Relation → users
└── status: Select ("active", "pending")

likes:
├── user: Relation → users
└── post: Relation → posts

messages:
├── sender: Relation → users
├── receiver: Relation → users
├── content: Text
└── read: Bool
```

**权限配置：**

```
=== posts 集合 ===
ListRule:   visibility = "public" ||
            @request.auth.id = author ||
            (visibility = "followers" &&
             @collection.follows.follower = @request.auth.id &&
             @collection.follows.following = author &&
             @collection.follows.status = "active")

ViewRule:   visibility = "public" ||
            @request.auth.id = author ||
            (visibility = "followers" &&
             @collection.follows.follower = @request.auth.id &&
             @collection.follows.following = author &&
             @collection.follows.status = "active")

CreateRule: @request.auth.id != "" &&
            @request.data.author = @request.auth.id

UpdateRule: @request.auth.id = author

DeleteRule: @request.auth.id = author

=== follows 集合 ===
ListRule:   @request.auth.id != ""
ViewRule:   @request.auth.id != ""
CreateRule: @request.auth.id != "" &&
            @request.data.follower = @request.auth.id &&
            @request.data.follower != @request.data.following
UpdateRule: null
DeleteRule: @request.auth.id = follower

=== likes 集合 ===
ListRule:   ""
ViewRule:   ""
CreateRule: @request.auth.id != "" &&
            @request.data.user = @request.auth.id
UpdateRule: null
DeleteRule: @request.auth.id = user

=== messages 集合 ===
ListRule:   @request.auth.id = sender || @request.auth.id = receiver
ViewRule:   @request.auth.id = sender || @request.auth.id = receiver
CreateRule: @request.auth.id != "" &&
            @request.data.sender = @request.auth.id &&
            @request.data.read = false
UpdateRule: @request.auth.id = receiver &&
            @request.data.sender = sender &&
            @request.data.receiver = receiver &&
            @request.data.content = content
DeleteRule: @request.auth.id = sender
```

**代码实现示例：**

```javascript
import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

// 登录用户
await pb.collection('users').authWithPassword('user@example.com', 'password123');

// 获取公开帖子和关注者可见的帖子
const posts = await pb.collection('posts').getList(1, 20, {
    sort: '-created',
    expand: 'author',
});

// 创建新帖子
const newPost = await pb.collection('posts').create({
    content: '这是一条新帖子',
    author: pb.authStore.model.id,
    visibility: 'public',
});

// 关注用户
await pb.collection('follows').create({
    follower: pb.authStore.model.id,
    following: 'TARGET_USER_ID',
    status: 'active',
});

// 点赞
await pb.collection('likes').create({
    user: pb.authStore.model.id,
    post: 'POST_ID',
});

// 发送私信
await pb.collection('messages').create({
    sender: pb.authStore.model.id,
    receiver: 'TARGET_USER_ID',
    content: '你好！',
    read: false,
});

// 标记私信已读
await pb.collection('messages').update('MESSAGE_ID', {
    read: true,
    sender: message.sender,     // 必须保持不变，因为 UpdateRule 要求
    receiver: message.receiver, // 必须保持不变
    content: message.content,   // 必须保持不变
});
```

### 7.9.4 权限设计最佳实践总结

```
✅ 推荐做法:
1. 默认锁定所有规则 (null)，然后逐步开放
2. 使用最小权限原则
3. CreateRule 中始终验证 @request.data.author = @request.auth.id
4. UpdateRule 中限制不可修改的字段
5. 利用关联字段实现层级权限
6. 充分测试每种角色的访问权限

❌ 避免的做法:
1. 不要将所有规则设置为 ""（全部公开）
2. 不要在前端代码中使用管理员 token
3. 不要忽略 DeleteRule 的配置
4. 不要假设前端校验可以替代后端权限检查
5. 不要在规则中硬编码用户ID
```
