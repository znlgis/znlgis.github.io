---
layout: default
title: 第05章 RESTful API详解
---

# 第05章 RESTful API详解

PocketBase 最强大的特性之一是根据集合定义**自动生成完整的 RESTful API**。无需编写任何后端代码，你就可以通过标准的 HTTP 请求对数据进行增删改查操作。本章将全面讲解 PocketBase API 的使用方法。

---

## 5.1 API 概述

### 自动生成的 API

当你在 PocketBase 中创建一个集合后，系统会自动为该集合生成以下 API 端点：

| HTTP 方法 | 端点 | 说明 |
|-----------|------|------|
| `GET` | `/api/collections/{collection}/records` | 获取记录列表 |
| `GET` | `/api/collections/{collection}/records/{id}` | 获取单条记录 |
| `POST` | `/api/collections/{collection}/records` | 创建记录 |
| `PATCH` | `/api/collections/{collection}/records/{id}` | 更新记录 |
| `DELETE` | `/api/collections/{collection}/records/{id}` | 删除记录 |

### Auth 集合额外端点

如果集合类型为 Auth，还会额外生成认证相关的端点：

| HTTP 方法 | 端点 | 说明 |
|-----------|------|------|
| `POST` | `/api/collections/{collection}/auth-with-password` | 邮箱密码登录 |
| `POST` | `/api/collections/{collection}/auth-with-oauth2` | OAuth2 登录 |
| `POST` | `/api/collections/{collection}/auth-refresh` | 刷新 Token |
| `POST` | `/api/collections/{collection}/request-verification` | 请求邮箱验证 |
| `POST` | `/api/collections/{collection}/confirm-verification` | 确认邮箱验证 |
| `POST` | `/api/collections/{collection}/request-password-reset` | 请求密码重置 |
| `POST` | `/api/collections/{collection}/confirm-password-reset` | 确认密码重置 |

### API 基础 URL

```
http://127.0.0.1:8090/api/
```

所有 API 请求都以此为基础路径。在生产环境中，应使用 HTTPS 协议并配置域名。

---

## 5.2 记录 CRUD 操作

### 5.2.1 创建记录（POST）

```bash
# 基本创建
curl -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Content-Type: application/json" \
  -d '{
    "title": "我的第一篇文章",
    "content": "这是文章的内容...",
    "published": true,
    "status": "draft"
  }'
```

**响应示例（200 OK）：**

```json
{
  "id": "abc123def456789",
  "collectionId": "xyz789abc123456",
  "collectionName": "posts",
  "created": "2024-01-15 08:30:00.000Z",
  "updated": "2024-01-15 08:30:00.000Z",
  "title": "我的第一篇文章",
  "content": "这是文章的内容...",
  "published": true,
  "status": "draft"
}
```

**带文件上传的创建：**

```bash
# 使用 multipart/form-data 上传文件
curl -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Authorization: Bearer USER_TOKEN" \
  -F "title=带图片的文章" \
  -F "content=文章内容..." \
  -F "cover_image=@/path/to/image.jpg" \
  -F "attachments=@/path/to/file1.pdf" \
  -F "attachments=@/path/to/file2.pdf"
```

**指定自定义 ID：**

```bash
curl -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my_custom_id_01",
    "title": "使用自定义ID的文章"
  }'
```

### 5.2.2 查询记录列表（GET）

```bash
# 获取所有记录（默认分页，每页30条）
curl http://127.0.0.1:8090/api/collections/posts/records

# 带筛选条件的查询
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(published=true)&sort=-created&page=1&perPage=20"
```

**列表响应格式：**

```json
{
  "page": 1,
  "perPage": 20,
  "totalPages": 5,
  "totalItems": 98,
  "items": [
    {
      "id": "abc123def456789",
      "collectionId": "xyz789abc123456",
      "collectionName": "posts",
      "created": "2024-01-15 08:30:00.000Z",
      "updated": "2024-01-15 08:30:00.000Z",
      "title": "文章标题",
      "content": "文章内容...",
      "published": true
    }
  ]
}
```

### 5.2.3 查询单条记录（GET）

```bash
# 通过 ID 获取单条记录
curl http://127.0.0.1:8090/api/collections/posts/records/abc123def456789

# 带展开关联数据
curl "http://127.0.0.1:8090/api/collections/posts/records/abc123def456789?expand=author,categories"
```

**单条记录响应格式：**

```json
{
  "id": "abc123def456789",
  "collectionId": "xyz789abc123456",
  "collectionName": "posts",
  "created": "2024-01-15 08:30:00.000Z",
  "updated": "2024-01-15 08:30:00.000Z",
  "title": "文章标题",
  "content": "文章内容...",
  "published": true,
  "author": "user_id_001",
  "expand": {
    "author": {
      "id": "user_id_001",
      "username": "zhangsan",
      "name": "张三"
    }
  }
}
```

### 5.2.4 更新记录（PATCH）

```bash
# 更新指定字段
curl -X PATCH http://127.0.0.1:8090/api/collections/posts/records/abc123def456789 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{
    "title": "更新后的标题",
    "published": true
  }'
```

**文件字段更新：**

```bash
# 追加新文件
curl -X PATCH http://127.0.0.1:8090/api/collections/posts/records/abc123def456789 \
  -H "Authorization: Bearer USER_TOKEN" \
  -F "attachments=@/path/to/new_file.pdf"

# 删除特定文件（通过设置文件名为空字符串的方式标记删除）
curl -X PATCH http://127.0.0.1:8090/api/collections/posts/records/abc123def456789 \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attachments-": ["old_file_abc123.pdf"]
  }'
```

**关联字段更新：**

```bash
# 追加关联记录（使用 + 后缀）
curl -X PATCH http://127.0.0.1:8090/api/collections/posts/records/abc123def456789 \
  -H "Content-Type: application/json" \
  -d '{
    "categories+": ["new_category_id"]
  }'

# 移除关联记录（使用 - 后缀）
curl -X PATCH http://127.0.0.1:8090/api/collections/posts/records/abc123def456789 \
  -H "Content-Type: application/json" \
  -d '{
    "categories-": ["old_category_id"]
  }'
```

### 5.2.5 删除记录（DELETE）

```bash
# 删除单条记录
curl -X DELETE http://127.0.0.1:8090/api/collections/posts/records/abc123def456789 \
  -H "Authorization: Bearer USER_TOKEN"
```

**响应：** 成功返回 `204 No Content`，响应体为空。

---

## 5.3 查询过滤（Filter）

PocketBase 提供了强大的过滤语法，通过 `filter` 查询参数进行数据筛选。

### 5.3.1 基本语法

过滤表达式格式：`(字段名 操作符 值)`

```bash
# 基本过滤
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(status='published')"
```

### 5.3.2 比较操作符

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `=` | 等于 | `(status='active')` |
| `!=` | 不等于 | `(status!='deleted')` |
| `>` | 大于 | `(price>100)` |
| `<` | 小于 | `(price<1000)` |
| `>=` | 大于等于 | `(stock>=10)` |
| `<=` | 小于等于 | `(rating<=5)` |
| `~` | 包含(like) | `(title~'PocketBase')` |
| `!~` | 不包含(not like) | `(title!~'测试')` |

### 5.3.3 操作符详细示例

```bash
# 等于
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(status='published')"

# 不等于
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(status!='draft')"

# 大于
curl "http://127.0.0.1:8090/api/collections/products/records?filter=(price>99.99)"

# 小于
curl "http://127.0.0.1:8090/api/collections/products/records?filter=(stock<10)"

# 大于等于
curl "http://127.0.0.1:8090/api/collections/products/records?filter=(rating>=4)"

# 包含（模糊匹配）
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(title~'教程')"

# 不包含
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(title!~'广告')"
```

### 5.3.4 逻辑运算符

| 运算符 | 说明 |
|--------|------|
| `&&` | 逻辑与（AND） |
| `\|\|` | 逻辑或（OR） |

```bash
# AND 组合条件
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(status='published' && published=true)"

# OR 条件
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(status='draft' || status='pending')"

# 复合条件
curl "http://127.0.0.1:8090/api/collections/products/records?filter=(price>=100 && price<=500 && stock>0)"
```

### 5.3.5 嵌套过滤与括号分组

```bash
# 使用括号进行条件分组
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=((status='published' || status='featured') && author='user_001')"

# 复杂嵌套
curl "http://127.0.0.1:8090/api/collections/products/records?filter=((category='电子产品' && price<1000) || (category='图书' && price<100))"
```

### 5.3.6 日期过滤

```bash
# 过滤创建时间
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(created>='2024-01-01 00:00:00' && created<'2024-02-01 00:00:00')"

# 过滤最近7天
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(created>='2024-01-08 00:00:00')"
```

### 5.3.7 关联字段过滤

```bash
# 通过关联字段的属性过滤
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(author.verified=true)"

# 多层关联过滤
curl "http://127.0.0.1:8090/api/collections/comments/records?filter=(post.author.username='zhangsan')"
```

### 5.3.8 空值过滤

```bash
# 查找字段为空的记录
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(cover_image='')"

# 查找字段非空的记录
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(cover_image!='')"
```

---

## 5.4 排序（Sort）

通过 `sort` 参数对查询结果进行排序。

### 基本语法

```bash
# 升序排列（默认）
curl "http://127.0.0.1:8090/api/collections/posts/records?sort=created"

# 降序排列（字段名前加 -）
curl "http://127.0.0.1:8090/api/collections/posts/records?sort=-created"
```

### 多字段排序

使用逗号分隔多个排序字段：

```bash
# 先按状态升序，再按创建时间降序
curl "http://127.0.0.1:8090/api/collections/posts/records?sort=status,-created"

# 先按价格升序，再按评分降序
curl "http://127.0.0.1:8090/api/collections/products/records?sort=price,-rating"
```

### 按随机顺序排序

```bash
# 随机排序
curl "http://127.0.0.1:8090/api/collections/posts/records?sort=@random"
```

### 排序与过滤结合

```bash
# 查询已发布文章，按创建时间倒序
curl "http://127.0.0.1:8090/api/collections/posts/records?filter=(published=true)&sort=-created&perPage=10"
```

---

## 5.5 字段选择（Fields）

通过 `fields` 参数选择 API 返回的字段，减少不必要的数据传输。

### 基本用法

```bash
# 只返回 id、title、created 字段
curl "http://127.0.0.1:8090/api/collections/posts/records?fields=id,title,created"
```

**响应示例：**

```json
{
  "page": 1,
  "perPage": 30,
  "totalPages": 1,
  "totalItems": 5,
  "items": [
    {
      "id": "abc123def456789",
      "title": "文章标题",
      "created": "2024-01-15 08:30:00.000Z"
    }
  ]
}
```

### 嵌套字段选择

```bash
# 选择展开数据中的特定字段
curl "http://127.0.0.1:8090/api/collections/posts/records?expand=author&fields=id,title,expand.author.username,expand.author.name"
```

### 排除分页元数据

```bash
# 只获取 items 数组
curl "http://127.0.0.1:8090/api/collections/posts/records?fields=items.id,items.title"
```

**注意事项：**
- `id` 字段始终会被包含，即使未在 `fields` 中指定
- 使用 `fields` 参数可以显著减少响应体大小，提升性能
- 对于大列表查询，建议始终使用 `fields` 限制返回字段

---

## 5.6 关联数据展开（Expand）

`expand` 参数用于将关联字段引用的记录数据一并加载到响应中，避免多次请求。

### 单层展开

```bash
# 展开作者信息
curl "http://127.0.0.1:8090/api/collections/posts/records?expand=author"
```

**响应示例：**

```json
{
  "id": "post_001",
  "title": "PocketBase 教程",
  "author": "user_001",
  "expand": {
    "author": {
      "id": "user_001",
      "username": "zhangsan",
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }
}
```

### 多字段展开

```bash
# 同时展开多个关联字段
curl "http://127.0.0.1:8090/api/collections/posts/records?expand=author,categories,tags"
```

### 多层级展开（嵌套展开）

使用点号语法可以展开关联记录中的关联字段：

```bash
# 展开评论的作者，以及评论所属文章的作者
curl "http://127.0.0.1:8090/api/collections/comments/records?expand=author,post.author"
```

**响应示例：**

```json
{
  "id": "comment_001",
  "content": "很好的文章！",
  "author": "user_002",
  "post": "post_001",
  "expand": {
    "author": {
      "id": "user_002",
      "username": "lisi",
      "name": "李四"
    },
    "post": {
      "id": "post_001",
      "title": "PocketBase 教程",
      "author": "user_001",
      "expand": {
        "author": {
          "id": "user_001",
          "username": "zhangsan",
          "name": "张三"
        }
      }
    }
  }
}
```

### 反向关联展开

PocketBase 支持通过 `back-relations` 展开反向关联的记录：

```bash
# 查询作者并展开其所有文章（反向关联）
curl "http://127.0.0.1:8090/api/collections/users/records?expand=posts_via_author"
```

**注意事项：**
- 反向关联格式为 `{集合名}_via_{关联字段名}`
- 最大展开深度为 6 级
- 展开操作会增加查询开销，应谨慎使用
- 对于大数据量的关联，建议使用分页查询而非展开

---

## 5.7 分页查询

PocketBase API 默认启用分页，通过 `page` 和 `perPage` 参数控制。

### 分页参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 当前页码（从 1 开始） |
| `perPage` | int | 30 | 每页记录数（最大 500） |
| `skipTotal` | bool | false | 跳过总数统计以提升性能 |

### 使用示例

```bash
# 第 1 页，每页 20 条
curl "http://127.0.0.1:8090/api/collections/posts/records?page=1&perPage=20"

# 第 3 页，每页 50 条
curl "http://127.0.0.1:8090/api/collections/posts/records?page=3&perPage=50"

# 跳过总数统计（大数据集优化）
curl "http://127.0.0.1:8090/api/collections/posts/records?page=1&perPage=20&skipTotal=true"
```

### 分页响应格式

```json
{
  "page": 1,
  "perPage": 20,
  "totalPages": 5,
  "totalItems": 98,
  "items": [...]
}
```

当设置 `skipTotal=true` 时：

```json
{
  "page": 1,
  "perPage": 20,
  "totalPages": -1,
  "totalItems": -1,
  "items": [...]
}
```

### 前端分页实现示例

```javascript
// JavaScript SDK 分页查询
async function fetchPosts(page = 1) {
  const result = await pb.collection('posts').getList(page, 20, {
    filter: 'published = true',
    sort: '-created',
    expand: 'author'
  });

  console.log('当前页:', result.page);
  console.log('总页数:', result.totalPages);
  console.log('总记录数:', result.totalItems);
  console.log('当前页数据:', result.items);

  return result;
}

// 获取所有记录（自动处理分页）
async function fetchAllPosts() {
  const records = await pb.collection('posts').getFullList({
    filter: 'published = true',
    sort: '-created',
    batch: 200  // 每批次获取 200 条
  });

  return records;
}
```

**性能建议：**
- 大数据集建议使用 `skipTotal=true` 跳过总数统计
- `perPage` 最大值为 500，超出将被限制
- 使用 `getFullList()` 时注意内存消耗

---

## 5.8 API 自动生成文档

PocketBase Admin UI 内置了 API 文档预览功能，方便开发者查看和测试 API。

### 访问 API 文档

1. 登录管理面板 `http://127.0.0.1:8090/_/`
2. 点击左侧的集合名称
3. 点击右上角的 **「API Preview」** 按钮（`</>` 图标）

### API 预览功能

API 预览页面提供了以下信息：

- **端点 URL**：完整的 API 请求地址
- **HTTP 方法**：GET、POST、PATCH、DELETE
- **请求头**：所需的 Authorization、Content-Type 等
- **请求体**：包含所有字段的 JSON 示例
- **响应体**：预期的响应格式
- **代码示例**：JavaScript SDK 和 Dart SDK 的代码片段
- **权限说明**：当前 API 规则的访问权限

### 在线测试

Admin UI 支持直接在浏览器中发送 API 请求并查看响应结果，省去了使用 Postman 等外部工具的步骤。

---

## 5.9 请求头与响应格式

### 常用请求头

| 请求头 | 值 | 说明 |
|--------|------|------|
| `Content-Type` | `application/json` | JSON 格式请求体 |
| `Content-Type` | `multipart/form-data` | 文件上传请求体 |
| `Authorization` | `Bearer {token}` | 用户/管理员认证令牌 |

### 请求示例

```bash
# 带认证的 JSON 请求
curl -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "title": "新文章",
    "content": "内容..."
  }'

# 文件上传请求
curl -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "title=带图片的文章" \
  -F "cover=@image.jpg"
```

### 响应格式

所有 API 响应均为 **JSON 格式**。

**成功响应（200/204）：**

```json
{
  "id": "abc123def456789",
  "collectionId": "xyz789abc123456",
  "collectionName": "posts",
  "created": "2024-01-15 08:30:00.000Z",
  "updated": "2024-01-15 08:30:00.000Z",
  "title": "文章标题"
}
```

**删除成功（204）：** 空响应体

---

## 5.10 错误处理

### 错误响应格式

```json
{
  "code": 400,
  "message": "Failed to create record.",
  "data": {
    "title": {
      "code": "validation_required",
      "message": "Missing required value."
    },
    "email": {
      "code": "validation_invalid_email",
      "message": "Must be a valid email address."
    }
  }
}
```

### 常见错误码

| HTTP 状态码 | 含义 | 常见原因 |
|-------------|------|----------|
| `400` | 请求错误 | 请求体格式错误、字段验证失败 |
| `401` | 未认证 | 缺少或无效的 Authorization token |
| `403` | 权限不足 | API 规则拒绝访问 |
| `404` | 资源不存在 | 集合或记录 ID 不存在 |
| `405` | 方法不允许 | 使用了不支持的 HTTP 方法 |
| `429` | 请求过多 | 触发了速率限制 |
| `500` | 服务器错误 | 内部异常 |

### 字段验证错误码

| 错误码 | 说明 |
|--------|------|
| `validation_required` | 必填字段为空 |
| `validation_not_unique` | 违反唯一性约束 |
| `validation_invalid_email` | 邮箱格式无效 |
| `validation_invalid_url` | URL 格式无效 |
| `validation_min_text_constraint` | 文本长度不足 |
| `validation_max_text_constraint` | 文本长度超限 |
| `validation_min_number_constraint` | 数值低于最小值 |
| `validation_max_number_constraint` | 数值超过最大值 |
| `validation_invalid_pattern` | 不符合正则模式 |
| `validation_file_size_limit` | 文件大小超限 |
| `validation_file_mime_type` | 文件类型不允许 |

### 错误处理示例

```javascript
// JavaScript SDK 错误处理
try {
  const record = await pb.collection('posts').create({
    title: '',  // 必填字段为空
    email: 'invalid-email'
  });
} catch (error) {
  console.log('错误码:', error.status);       // 400
  console.log('错误信息:', error.message);     // "Failed to create record."

  // 获取各字段的详细错误
  const fieldErrors = error.data;
  if (fieldErrors.title) {
    console.log('标题错误:', fieldErrors.title.message);
  }
  if (fieldErrors.email) {
    console.log('邮箱错误:', fieldErrors.email.message);
  }
}
```

```bash
# curl 查看完整错误响应
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  -X POST http://127.0.0.1:8090/api/collections/posts/records \
  -H "Content-Type: application/json" \
  -d '{"title": ""}' | python3 -m json.tool
```

---

## 5.11 批量操作

PocketBase 原生不提供批量操作 API，但可以通过以下方式实现。

### 5.11.1 批量创建

**方式一：循环调用 API**

```bash
#!/bin/bash
# 批量创建记录的 Shell 脚本
for i in $(seq 1 100); do
  curl -s -X POST http://127.0.0.1:8090/api/collections/posts/records \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ADMIN_TOKEN" \
    -d "{
      \"title\": \"文章 ${i}\",
      \"content\": \"这是第 ${i} 篇文章的内容\",
      \"status\": \"draft\"
    }"
  echo ""
done
```

**方式二：JavaScript SDK 批量创建**

```javascript
// 使用 Promise.all 并发创建
const posts = Array.from({ length: 100 }, (_, i) => ({
  title: `文章 ${i + 1}`,
  content: `这是第 ${i + 1} 篇文章的内容`,
  status: 'draft'
}));

// 控制并发数，避免过载
async function batchCreate(items, batchSize = 10) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => pb.collection('posts').create(item))
    );
    results.push(...batchResults);
    console.log(`已创建 ${results.length}/${items.length} 条记录`);
  }
  return results;
}

await batchCreate(posts, 10);
```

### 5.11.2 批量更新

```javascript
// 批量更新：将所有草稿文章发布
const drafts = await pb.collection('posts').getFullList({
  filter: "status = 'draft'"
});

for (const draft of drafts) {
  await pb.collection('posts').update(draft.id, {
    status: 'published',
    published: true
  });
}
```

### 5.11.3 批量删除

```javascript
// 批量删除指定条件的记录
const toDelete = await pb.collection('posts').getFullList({
  filter: "status = 'archived' && created < '2023-01-01 00:00:00'"
});

for (const record of toDelete) {
  await pb.collection('posts').delete(record.id);
}

console.log(`已删除 ${toDelete.length} 条记录`);
```

**注意事项：**
- 批量操作时建议控制并发数，避免服务器过载
- 大批量操作建议使用延时或分批处理
- 管理员通过扩展 PocketBase（Go hooks）可以实现原生批量接口

---

## 5.12 API 速率限制

PocketBase 支持 API 请求速率限制，防止滥用和 DDoS 攻击。

### 默认速率限制

PocketBase 默认不启用速率限制。可以通过 Go 扩展代码自定义速率限制规则。

### 通过中间件实现速率限制

```go
// main.go - 自定义速率限制中间件
package main

import (
    "net/http"
    "sync"
    "time"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

type RateLimiter struct {
    requests map[string][]time.Time
    mu       sync.Mutex
    limit    int
    window   time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
    return &RateLimiter{
        requests: make(map[string][]time.Time),
        limit:    limit,
        window:   window,
    }
}

func (rl *RateLimiter) Allow(ip string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    now := time.Now()
    cutoff := now.Add(-rl.window)

    // 清理过期请求记录
    var valid []time.Time
    for _, t := range rl.requests[ip] {
        if t.After(cutoff) {
            valid = append(valid, t)
        }
    }
    rl.requests[ip] = valid

    if len(valid) >= rl.limit {
        return false
    }

    rl.requests[ip] = append(rl.requests[ip], now)
    return true
}

func main() {
    app := pocketbase.New()
    limiter := NewRateLimiter(100, time.Minute) // 每分钟100次请求

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.Use(func(next http.Handler) http.Handler {
            return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                ip := r.RemoteAddr
                if !limiter.Allow(ip) {
                    w.Header().Set("Content-Type", "application/json")
                    w.WriteHeader(http.StatusTooManyRequests)
                    w.Write([]byte(`{"code":429,"message":"Too many requests. Please try again later."}`))
                    return
                }
                next.ServeHTTP(w, r)
            })
        })
        return se.Next()
    })

    app.Start()
}
```

### 通过反向代理实现

推荐使用 Nginx 或 Caddy 等反向代理在前端实现速率限制：

```nginx
# Nginx 速率限制配置
http {
    # 定义限速区域：每个IP每秒10个请求
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name api.example.com;

        location /api/ {
            # 允许突发20个请求
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://127.0.0.1:8090;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

```
# Caddy 速率限制配置（使用 rate_limit 插件）
api.example.com {
    rate_limit {
        zone api {
            key {remote_host}
            events 100
            window 1m
        }
    }

    reverse_proxy 127.0.0.1:8090
}
```

### 客户端重试策略

```javascript
// 带指数退避的请求重试
async function apiRequestWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        // 指数退避等待
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`速率限制，${delay/1000}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// 使用示例
const result = await apiRequestWithRetry(() =>
  pb.collection('posts').getList(1, 20)
);
```

---

## 本章小结

本章全面介绍了 PocketBase 的 RESTful API 使用方法。核心要点：

1. PocketBase 根据集合定义**自动生成完整的 CRUD API**，零代码即可使用
2. **Filter** 语法提供了强大的数据过滤能力，支持多种操作符和逻辑组合
3. **Sort**、**Fields**、**Expand** 参数分别控制排序、字段选择和关联展开
4. **分页查询**是默认行为，大数据集可使用 `skipTotal` 优化性能
5. API 错误响应格式统一，包含详细的字段验证错误信息
6. 批量操作需要通过循环调用或 SDK 封装实现
7. 速率限制建议通过反向代理或 Go 中间件实现

下一章我们将深入学习 PocketBase 的认证与用户管理功能。