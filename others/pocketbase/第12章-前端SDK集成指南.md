---
layout: default
title: 第12章 前端SDK集成指南
---

# 第12章 前端SDK集成指南

PocketBase 提供了官方的 JavaScript SDK 和 Dart SDK，使前端应用能够轻松地与 PocketBase 后端进行交互。本章将全面介绍如何在各种前端框架中集成和使用 PocketBase SDK，涵盖认证、CRUD、文件操作、实时订阅等核心功能。

---

## 12.1 官方SDK概述

### 12.1.1 SDK类型

PocketBase 官方维护两个 SDK：

| SDK | 语言 | 适用场景 | 仓库 |
|-----|------|---------|------|
| JavaScript SDK | JavaScript/TypeScript | Web应用、Node.js、React Native | `pocketbase/js-sdk` |
| Dart SDK | Dart | Flutter 应用 | `pocketbase/dart-sdk` |

### 12.1.2 JavaScript SDK特性

- 完整的 TypeScript 类型支持
- 自动认证令牌管理
- 实时订阅（SSE）
- 文件上传支持
- 自动请求取消
- 支持浏览器和 Node.js 环境
- 体积小巧（约 12KB gzipped）

### 12.1.3 SDK与REST API的关系

SDK 本质上是对 PocketBase REST API 的封装，它简化了以下操作：

- HTTP 请求的构建和发送
- 认证令牌的存储和自动附加
- SSE 连接的建立和管理
- 请求/响应数据的序列化与反序列化
- 文件上传的 FormData 构建

---

## 12.2 JavaScript SDK安装

### 12.2.1 npm安装

```bash
# 使用 npm
npm install pocketbase

# 使用 yarn
yarn add pocketbase

# 使用 pnpm
pnpm add pocketbase
```

### 12.2.2 CDN引入

```html
<!-- 使用 ES Module -->
<script type="module">
    import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@latest/dist/pocketbase.es.mjs'

    const pb = new PocketBase('http://127.0.0.1:8090')
</script>
```

### 12.2.3 UMD方式引入

```html
<script src="https://cdn.jsdelivr.net/npm/pocketbase@latest/dist/pocketbase.umd.js"></script>
<script>
    const pb = new PocketBase('http://127.0.0.1:8090')
</script>
```

---

## 12.3 初始化与配置

### 12.3.1 基本初始化

```javascript
import PocketBase from 'pocketbase'

// 基本初始化
const pb = new PocketBase('http://127.0.0.1:8090')
```

### 12.3.2 自定义配置

```javascript
import PocketBase from 'pocketbase'

const pb = new PocketBase('http://127.0.0.1:8090')

// 设置默认请求语言
pb.lang = 'zh-CN'

// 全局请求前钩子
pb.beforeSend = function (url, options) {
    console.log('请求URL:', url)
    console.log('请求选项:', options)

    // 添加自定义请求头
    options.headers = {
        ...options.headers,
        'X-Custom-Header': 'custom-value'
    }

    return { url, options }
}

// 全局响应后钩子
pb.afterSend = function (response, data) {
    console.log('响应状态:', response.status)
    console.log('响应数据:', data)

    return data
}
```

### 12.3.3 多实例配置

```javascript
// 开发环境
const devPB = new PocketBase('http://localhost:8090')

// 生产环境
const prodPB = new PocketBase('https://api.example.com')

// 根据环境变量选择
const pb = new PocketBase(
    process.env.NODE_ENV === 'production'
        ? 'https://api.example.com'
        : 'http://localhost:8090'
)
```

---

## 12.4 认证操作

### 12.4.1 密码认证

```javascript
// 使用邮箱和密码登录
async function login(email, password) {
    try {
        const authData = await pb.collection('users').authWithPassword(email, password)

        console.log('认证成功')
        console.log('令牌:', authData.token)
        console.log('用户信息:', authData.record)

        return authData
    } catch (error) {
        console.error('登录失败:', error.message)
        throw error
    }
}

// 使用示例
await login('user@example.com', 'password123')
```

### 12.4.2 OAuth2认证

```javascript
// OAuth2 登录（打开新窗口）
async function loginWithGoogle() {
    try {
        const authData = await pb.collection('users').authWithOAuth2({
            provider: 'google',
        })

        console.log('Google 登录成功:', authData.record)
        return authData
    } catch (error) {
        console.error('OAuth2 登录失败:', error.message)
        throw error
    }
}

// GitHub 登录
async function loginWithGitHub() {
    try {
        const authData = await pb.collection('users').authWithOAuth2({
            provider: 'github',
        })

        console.log('GitHub 登录成功:', authData.record)
        return authData
    } catch (error) {
        console.error('GitHub 登录失败:', error.message)
        throw error
    }
}
```

### 12.4.3 AuthStore管理

```javascript
// 检查是否已认证
console.log('是否已认证:', pb.authStore.isValid)
console.log('当前令牌:', pb.authStore.token)
console.log('当前用户:', pb.authStore.record)

// 监听认证状态变化
pb.authStore.onChange((token, record) => {
    console.log('认证状态变化')
    console.log('新令牌:', token)
    console.log('用户记录:', record)
})

// 退出登录
function logout() {
    pb.authStore.clear()
    console.log('已退出登录')
}

// 刷新认证信息
async function refreshAuth() {
    try {
        const authData = await pb.collection('users').authRefresh()
        console.log('令牌已刷新:', authData.token)
    } catch (error) {
        // 令牌已过期或无效，需要重新登录
        pb.authStore.clear()
        console.log('令牌已过期，请重新登录')
    }
}
```

### 12.4.4 自定义AuthStore

```javascript
// 使用 localStorage 持久化（默认行为）
// SDK 默认使用 localStorage 存储认证信息

// 自定义 Cookie 存储（适用于 SSR）
import PocketBase, { AsyncAuthStore } from 'pocketbase'

const store = new AsyncAuthStore({
    save:    async (serialized) => {
        document.cookie = `pb_auth=${encodeURIComponent(serialized)}; path=/; max-age=604800; SameSite=Strict`
    },
    initial: getCookie('pb_auth'),
    clear:   async () => {
        document.cookie = 'pb_auth=; path=/; max-age=0'
    },
})

const pb = new PocketBase('http://127.0.0.1:8090', store)

function getCookie(name) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
        return decodeURIComponent(parts.pop().split(';').shift())
    }
    return ''
}
```

### 12.4.5 用户注册

```javascript
// 注册新用户
async function register(email, password, name) {
    try {
        const record = await pb.collection('users').create({
            email: email,
            password: password,
            passwordConfirm: password,
            name: name,
        })

        console.log('注册成功:', record)

        // 注册后自动登录
        await pb.collection('users').authWithPassword(email, password)

        return record
    } catch (error) {
        console.error('注册失败:', error.message)
        throw error
    }
}

// 请求验证邮件
async function requestVerification(email) {
    await pb.collection('users').requestVerification(email)
    console.log('验证邮件已发送')
}

// 请求密码重置
async function requestPasswordReset(email) {
    await pb.collection('users').requestPasswordReset(email)
    console.log('密码重置邮件已发送')
}
```

---

## 12.5 CRUD操作

### 12.5.1 查询列表

```javascript
// 基本列表查询
async function getArticles(page = 1, perPage = 20) {
    const result = await pb.collection('articles').getList(page, perPage, {
        sort: '-created',
        filter: 'status = "published"',
    })

    console.log('总数:', result.totalItems)
    console.log('总页数:', result.totalPages)
    console.log('当前页:', result.page)
    console.log('记录:', result.items)

    return result
}

// 获取所有记录（自动分页）
async function getAllArticles() {
    const records = await pb.collection('articles').getFullList({
        sort: '-created',
        filter: 'status = "published"',
        batch: 200,  // 每批次获取数量
    })

    console.log('全部记录:', records.length)
    return records
}

// 复杂过滤查询
async function searchArticles(keyword, category, startDate) {
    let filter = 'status = "published"'

    if (keyword) {
        filter += ` && (title ~ "${keyword}" || content ~ "${keyword}")`
    }
    if (category) {
        filter += ` && category = "${category}"`
    }
    if (startDate) {
        filter += ` && created >= "${startDate}"`
    }

    const result = await pb.collection('articles').getList(1, 20, {
        sort: '-created',
        filter: filter,
        expand: 'author,category',  // 展开关联字段
    })

    return result
}
```

### 12.5.2 查询单条记录

```javascript
// 根据 ID 查询
async function getArticle(id) {
    const record = await pb.collection('articles').getOne(id, {
        expand: 'author,comments_via_article',
    })

    console.log('文章标题:', record.title)
    console.log('作者:', record.expand?.author)
    console.log('评论:', record.expand?.comments_via_article)

    return record
}

// 根据过滤条件查询第一条
async function getArticleBySlug(slug) {
    const record = await pb.collection('articles').getFirstListItem(
        `slug = "${slug}"`,
        { expand: 'author' }
    )

    return record
}
```

### 12.5.3 创建记录

```javascript
// 创建记录
async function createArticle(data) {
    const record = await pb.collection('articles').create({
        title: data.title,
        content: data.content,
        status: 'draft',
        author: pb.authStore.record.id,
        category: data.categoryId,
        tags: JSON.stringify(data.tags || []),
    })

    console.log('创建成功:', record.id)
    return record
}

// 创建带文件的记录
async function createArticleWithImage(data, imageFile) {
    const formData = new FormData()
    formData.append('title', data.title)
    formData.append('content', data.content)
    formData.append('status', 'draft')
    formData.append('author', pb.authStore.record.id)
    formData.append('coverImage', imageFile)

    const record = await pb.collection('articles').create(formData)
    return record
}
```

### 12.5.4 更新记录

```javascript
// 更新记录
async function updateArticle(id, data) {
    const record = await pb.collection('articles').update(id, {
        title: data.title,
        content: data.content,
        status: data.status,
    })

    console.log('更新成功:', record.id)
    return record
}

// 部分更新
async function publishArticle(id) {
    const record = await pb.collection('articles').update(id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
    })

    return record
}
```

### 12.5.5 删除记录

```javascript
// 删除记录
async function deleteArticle(id) {
    await pb.collection('articles').delete(id)
    console.log('删除成功')
}

// 批量删除
async function deleteArticles(ids) {
    const promises = ids.map(id => pb.collection('articles').delete(id))
    await Promise.all(promises)
    console.log(`已删除 ${ids.length} 条记录`)
}
```

---

## 12.6 文件操作

### 12.6.1 文件上传

```javascript
// 单文件上传
async function uploadAvatar(file) {
    const formData = new FormData()
    formData.append('avatar', file)

    const record = await pb.collection('users').update(
        pb.authStore.record.id,
        formData
    )

    console.log('头像上传成功')
    return record
}

// 多文件上传
async function uploadImages(articleId, files) {
    const formData = new FormData()
    for (const file of files) {
        formData.append('images', file)
    }

    const record = await pb.collection('articles').update(articleId, formData)
    return record
}

// 配合 input 元素使用
document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0]
    if (file) {
        await uploadAvatar(file)
    }
})
```

### 12.6.2 获取文件URL

```javascript
// 获取文件 URL
function getFileUrl(record, filename, options = {}) {
    return pb.files.getURL(record, filename, options)
}

// 使用示例
const record = await pb.collection('articles').getOne('RECORD_ID')

// 原始文件
const originalUrl = pb.files.getURL(record, record.coverImage)

// 缩略图（需要在集合中配置）
const thumbUrl = pb.files.getURL(record, record.coverImage, {
    thumb: '100x100',     // 100x100 像素缩略图
})

// 更多缩略图选项
const mediumUrl = pb.files.getURL(record, record.coverImage, {
    thumb: '300x300',
})

const largeUrl = pb.files.getURL(record, record.coverImage, {
    thumb: '600x0',       // 宽度 600，高度自适应
})

console.log('原图:', originalUrl)
console.log('缩略图:', thumbUrl)
```

### 12.6.3 文件删除

```javascript
// 删除单个文件
async function deleteFile(recordId, fieldName) {
    const record = await pb.collection('articles').update(recordId, {
        [fieldName]: null,
    })
    return record
}

// 删除多文件字段中的特定文件
async function removeImage(recordId, filename) {
    const record = await pb.collection('articles').update(recordId, {
        'images-': [filename],  // 使用 - 后缀移除特定文件
    })
    return record
}
```

---

## 12.7 实时订阅

### 12.7.1 订阅集合变更

```javascript
// 订阅整个集合
async function subscribeToArticles() {
    pb.collection('articles').subscribe('*', function (e) {
        console.log('事件动作:', e.action)  // create, update, delete
        console.log('记录数据:', e.record)

        switch (e.action) {
            case 'create':
                console.log('新文章:', e.record.title)
                addArticleToUI(e.record)
                break
            case 'update':
                console.log('文章更新:', e.record.title)
                updateArticleInUI(e.record)
                break
            case 'delete':
                console.log('文章删除:', e.record.id)
                removeArticleFromUI(e.record.id)
                break
        }
    })

    console.log('已订阅文章变更')
}
```

### 12.7.2 订阅单条记录

```javascript
// 订阅特定记录的变更
async function subscribeToArticle(articleId) {
    pb.collection('articles').subscribe(articleId, function (e) {
        console.log('文章变更:', e.action)
        console.log('最新数据:', e.record)

        // 更新 UI
        updateArticleDetail(e.record)
    })
}
```

### 12.7.3 取消订阅

```javascript
// 取消特定集合的所有订阅
pb.collection('articles').unsubscribe()

// 取消特定记录的订阅
pb.collection('articles').unsubscribe(articleId)

// 取消所有订阅
pb.realtime.disconnect()
```

### 12.7.4 实时聊天示例

```javascript
// 实时聊天功能
class ChatService {
    constructor(pb, roomId) {
        this.pb = pb
        this.roomId = roomId
        this.messages = []
        this.onNewMessage = null
    }

    // 加载历史消息
    async loadMessages(limit = 50) {
        const result = await this.pb.collection('messages').getList(1, limit, {
            filter: `room = "${this.roomId}"`,
            sort: 'created',
            expand: 'sender',
        })
        this.messages = result.items
        return this.messages
    }

    // 发送消息
    async sendMessage(content) {
        const record = await this.pb.collection('messages').create({
            room: this.roomId,
            sender: this.pb.authStore.record.id,
            content: content,
            type: 'text',
        })
        return record
    }

    // 开始实时监听
    startListening() {
        this.pb.collection('messages').subscribe('*', (e) => {
            if (e.action === 'create' && e.record.room === this.roomId) {
                this.messages.push(e.record)
                if (this.onNewMessage) {
                    this.onNewMessage(e.record)
                }
            }
        })
    }

    // 停止监听
    stopListening() {
        this.pb.collection('messages').unsubscribe()
    }
}

// 使用示例
const chat = new ChatService(pb, 'room_001')
chat.onNewMessage = (message) => {
    appendMessageToUI(message)
}
await chat.loadMessages()
chat.startListening()
```

---

## 12.8 React集成

### 12.8.1 创建PocketBase Context

```jsx
// src/contexts/PocketBaseContext.jsx
import { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react'
import PocketBase from 'pocketbase'

const PocketBaseContext = createContext(null)

export function PocketBaseProvider({ children }) {
    const pb = useMemo(() => new PocketBase('http://127.0.0.1:8090'), [])
    const [user, setUser] = useState(pb.authStore.record)
    const [isLoggedIn, setIsLoggedIn] = useState(pb.authStore.isValid)

    useEffect(() => {
        // 监听认证状态变化
        const removeListener = pb.authStore.onChange((token, record) => {
            setUser(record)
            setIsLoggedIn(pb.authStore.isValid)
        })

        return () => removeListener()
    }, [pb])

    const login = useCallback(async (email, password) => {
        return await pb.collection('users').authWithPassword(email, password)
    }, [pb])

    const logout = useCallback(() => {
        pb.authStore.clear()
    }, [pb])

    const register = useCallback(async (email, password, name) => {
        const record = await pb.collection('users').create({
            email,
            password,
            passwordConfirm: password,
            name,
        })
        await pb.collection('users').authWithPassword(email, password)
        return record
    }, [pb])

    const value = {
        pb,
        user,
        isLoggedIn,
        login,
        logout,
        register,
    }

    return (
        <PocketBaseContext.Provider value={value}>
            {children}
        </PocketBaseContext.Provider>
    )
}

export function usePocketBase() {
    const context = useContext(PocketBaseContext)
    if (!context) {
        throw new Error('usePocketBase 必须在 PocketBaseProvider 内部使用')
    }
    return context
}
```

### 12.8.2 自定义Hooks

```jsx
// src/hooks/useCollection.js
import { useState, useEffect, useCallback } from 'react'
import { usePocketBase } from '../contexts/PocketBaseContext'

// 通用列表查询 Hook
export function useCollection(collectionName, options = {}) {
    const { pb } = usePocketBase()
    const [records, setRecords] = useState([])
    const [totalItems, setTotalItems] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const {
        page = 1,
        perPage = 20,
        sort = '-created',
        filter = '',
        expand = '',
        realtime = false,
    } = options

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await pb.collection(collectionName).getList(page, perPage, {
                sort,
                filter,
                expand,
            })
            setRecords(result.items)
            setTotalItems(result.totalItems)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [pb, collectionName, page, perPage, sort, filter, expand])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // 实时订阅
    useEffect(() => {
        if (!realtime) return

        pb.collection(collectionName).subscribe('*', (e) => {
            switch (e.action) {
                case 'create':
                    setRecords(prev => [e.record, ...prev])
                    setTotalItems(prev => prev + 1)
                    break
                case 'update':
                    setRecords(prev =>
                        prev.map(r => r.id === e.record.id ? e.record : r)
                    )
                    break
                case 'delete':
                    setRecords(prev => prev.filter(r => r.id !== e.record.id))
                    setTotalItems(prev => prev - 1)
                    break
            }
        })

        return () => {
            pb.collection(collectionName).unsubscribe('*')
        }
    }, [pb, collectionName, realtime])

    return { records, totalItems, loading, error, refetch: fetchData }
}

// 单条记录查询 Hook
export function useRecord(collectionName, id, options = {}) {
    const { pb } = usePocketBase()
    const [record, setRecord] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!id) return

        const fetchRecord = async () => {
            setLoading(true)
            try {
                const result = await pb.collection(collectionName).getOne(id, options)
                setRecord(result)
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchRecord()
    }, [pb, collectionName, id])

    return { record, loading, error }
}
```

### 12.8.3 React组件示例

```jsx
// src/App.jsx
import { PocketBaseProvider } from './contexts/PocketBaseContext'
import { ArticleList } from './components/ArticleList'
import { LoginForm } from './components/LoginForm'

function App() {
    return (
        <PocketBaseProvider>
            <div className="app">
                <LoginForm />
                <ArticleList />
            </div>
        </PocketBaseProvider>
    )
}

// src/components/LoginForm.jsx
import { useState } from 'react'
import { usePocketBase } from '../contexts/PocketBaseContext'

export function LoginForm() {
    const { login, logout, isLoggedIn, user } = usePocketBase()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        try {
            await login(email, password)
        } catch (err) {
            setError('登录失败: ' + err.message)
        }
    }

    if (isLoggedIn) {
        return (
            <div>
                <span>欢迎，{user.name}</span>
                <button onClick={logout}>退出</button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
            />
            {error && <p className="error">{error}</p>}
            <button type="submit">登录</button>
        </form>
    )
}

// src/components/ArticleList.jsx
import { useCollection } from '../hooks/useCollection'

export function ArticleList() {
    const { records, loading, error, totalItems } = useCollection('articles', {
        sort: '-created',
        filter: 'status = "published"',
        expand: 'author',
        realtime: true,
    })

    if (loading) return <div>加载中...</div>
    if (error) return <div>错误: {error}</div>

    return (
        <div>
            <h2>文章列表（共 {totalItems} 篇）</h2>
            {records.map(article => (
                <article key={article.id}>
                    <h3>{article.title}</h3>
                    <p>作者: {article.expand?.author?.name}</p>
                    <p>{article.content.substring(0, 200)}...</p>
                    <time>{new Date(article.created).toLocaleDateString()}</time>
                </article>
            ))}
        </div>
    )
}
```

---

## 12.9 Vue集成

### 12.9.1 Composables封装

```javascript
// src/composables/usePocketBase.js
import { ref, readonly, onMounted, onUnmounted } from 'vue'
import PocketBase from 'pocketbase'

const pb = new PocketBase('http://127.0.0.1:8090')
const currentUser = ref(pb.authStore.record)
const isLoggedIn = ref(pb.authStore.isValid)

// 监听认证状态变化
pb.authStore.onChange((token, record) => {
    currentUser.value = record
    isLoggedIn.value = pb.authStore.isValid
})

export function usePocketBase() {
    const login = async (email, password) => {
        return await pb.collection('users').authWithPassword(email, password)
    }

    const logout = () => {
        pb.authStore.clear()
    }

    const register = async (email, password, name) => {
        const record = await pb.collection('users').create({
            email,
            password,
            passwordConfirm: password,
            name,
        })
        await pb.collection('users').authWithPassword(email, password)
        return record
    }

    return {
        pb,
        currentUser: readonly(currentUser),
        isLoggedIn: readonly(isLoggedIn),
        login,
        logout,
        register,
    }
}

// src/composables/useCollection.js
import { ref, watch, onUnmounted } from 'vue'
import { usePocketBase } from './usePocketBase'

export function useCollection(collectionName, options = {}) {
    const { pb } = usePocketBase()
    const records = ref([])
    const totalItems = ref(0)
    const loading = ref(true)
    const error = ref(null)

    const fetchData = async () => {
        loading.value = true
        error.value = null
        try {
            const result = await pb.collection(collectionName).getList(
                options.page || 1,
                options.perPage || 20,
                {
                    sort: options.sort || '-created',
                    filter: options.filter || '',
                    expand: options.expand || '',
                }
            )
            records.value = result.items
            totalItems.value = result.totalItems
        } catch (err) {
            error.value = err.message
        } finally {
            loading.value = false
        }
    }

    // 初始加载
    fetchData()

    // 实时订阅
    if (options.realtime) {
        pb.collection(collectionName).subscribe('*', (e) => {
            switch (e.action) {
                case 'create':
                    records.value = [e.record, ...records.value]
                    totalItems.value++
                    break
                case 'update':
                    records.value = records.value.map(
                        r => r.id === e.record.id ? e.record : r
                    )
                    break
                case 'delete':
                    records.value = records.value.filter(r => r.id !== e.record.id)
                    totalItems.value--
                    break
            }
        })

        onUnmounted(() => {
            pb.collection(collectionName).unsubscribe('*')
        })
    }

    return { records, totalItems, loading, error, refetch: fetchData }
}
```

### 12.9.2 Vue组件示例

```vue
<!-- src/components/ArticleList.vue -->
<template>
  <div>
    <h2>文章列表（共 {{ totalItems }} 篇）</h2>

    <div v-if="loading">加载中...</div>
    <div v-else-if="error">错误: {{ error }}</div>
    <div v-else>
      <article v-for="article in records" :key="article.id" class="article-card">
        <h3>{{ article.title }}</h3>
        <p class="meta">
          作者: {{ article.expand?.author?.name }} |
          {{ formatDate(article.created) }}
        </p>
        <p>{{ article.content.substring(0, 200) }}...</p>
      </article>
    </div>
  </div>
</template>

<script setup>
import { useCollection } from '../composables/useCollection'

const { records, totalItems, loading, error } = useCollection('articles', {
  sort: '-created',
  filter: 'status = "published"',
  expand: 'author',
  realtime: true,
})

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>
```

```vue
<!-- src/components/LoginForm.vue -->
<template>
  <div>
    <div v-if="isLoggedIn">
      <span>欢迎，{{ currentUser.name }}</span>
      <button @click="logout">退出</button>
    </div>
    <form v-else @submit.prevent="handleLogin">
      <input v-model="email" type="email" placeholder="邮箱" />
      <input v-model="password" type="password" placeholder="密码" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">登录</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePocketBase } from '../composables/usePocketBase'

const { login, logout, isLoggedIn, currentUser } = usePocketBase()
const email = ref('')
const password = ref('')
const error = ref('')

async function handleLogin() {
  error.value = ''
  try {
    await login(email.value, password.value)
  } catch (err) {
    error.value = '登录失败: ' + err.message
  }
}
</script>
```

---

## 12.10 Svelte集成

### 12.10.1 Svelte Store封装

```javascript
// src/lib/pocketbase.js
import PocketBase from 'pocketbase'
import { writable, derived } from 'svelte/store'

export const pb = new PocketBase('http://127.0.0.1:8090')

// 认证 Store
export const currentUser = writable(pb.authStore.record)
export const isLoggedIn = derived(currentUser, $user => !!$user)

// 监听认证状态变化
pb.authStore.onChange((token, record) => {
    currentUser.set(record)
})

// 认证方法
export async function login(email, password) {
    return await pb.collection('users').authWithPassword(email, password)
}

export function logout() {
    pb.authStore.clear()
}

export async function register(email, password, name) {
    const record = await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        name,
    })
    await pb.collection('users').authWithPassword(email, password)
    return record
}
```

### 12.10.2 Svelte组件示例

```svelte
<!-- src/routes/+page.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte'
    import { pb, currentUser, isLoggedIn, login, logout } from '$lib/pocketbase'

    let articles = []
    let loading = true
    let email = ''
    let password = ''
    let error = ''

    onMount(async () => {
        await loadArticles()
        subscribeToArticles()
    })

    onDestroy(() => {
        pb.collection('articles').unsubscribe('*')
    })

    async function loadArticles() {
        loading = true
        try {
            const result = await pb.collection('articles').getList(1, 20, {
                sort: '-created',
                filter: 'status = "published"',
                expand: 'author',
            })
            articles = result.items
        } catch (err) {
            console.error('加载失败:', err)
        } finally {
            loading = false
        }
    }

    function subscribeToArticles() {
        pb.collection('articles').subscribe('*', (e) => {
            if (e.action === 'create') {
                articles = [e.record, ...articles]
            } else if (e.action === 'update') {
                articles = articles.map(a => a.id === e.record.id ? e.record : a)
            } else if (e.action === 'delete') {
                articles = articles.filter(a => a.id !== e.record.id)
            }
        })
    }

    async function handleLogin() {
        error = ''
        try {
            await login(email, password)
        } catch (err) {
            error = '登录失败: ' + err.message
        }
    }
</script>

{#if $isLoggedIn}
    <div>
        <span>欢迎，{$currentUser.name}</span>
        <button on:click={logout}>退出</button>
    </div>
{:else}
    <form on:submit|preventDefault={handleLogin}>
        <input bind:value={email} type="email" placeholder="邮箱" />
        <input bind:value={password} type="password" placeholder="密码" />
        {#if error}<p class="error">{error}</p>{/if}
        <button type="submit">登录</button>
    </form>
{/if}

<h2>文章列表</h2>
{#if loading}
    <p>加载中...</p>
{:else}
    {#each articles as article (article.id)}
        <article>
            <h3>{article.title}</h3>
            <p>{article.content.substring(0, 200)}...</p>
        </article>
    {/each}
{/if}
```

---

## 12.11 Flutter/Dart SDK集成

### 12.11.1 安装Dart SDK

```yaml
# pubspec.yaml
dependencies:
  pocketbase: ^0.18.0
```

```bash
flutter pub get
```

### 12.11.2 初始化

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://10.0.2.2:8090'); // Android 模拟器
// final pb = PocketBase('http://127.0.0.1:8090'); // iOS 模拟器/桌面
```

### 12.11.3 认证操作

```dart
// 登录
Future<RecordAuth> login(String email, String password) async {
  try {
    final authData = await pb.collection('users').authWithPassword(
      email,
      password,
    );
    print('登录成功: ${authData.record?.getStringValue('name')}');
    return authData;
  } catch (e) {
    print('登录失败: $e');
    rethrow;
  }
}

// 注册
Future<RecordModel> register(String email, String password, String name) async {
  final record = await pb.collection('users').create(body: {
    'email': email,
    'password': password,
    'passwordConfirm': password,
    'name': name,
  });

  // 自动登录
  await pb.collection('users').authWithPassword(email, password);

  return record;
}

// 退出
void logout() {
  pb.authStore.clear();
}

// 检查认证状态
bool get isLoggedIn => pb.authStore.isValid;
```

### 12.11.4 CRUD操作

```dart
// 获取列表
Future<List<RecordModel>> getArticles({int page = 1, int perPage = 20}) async {
  final result = await pb.collection('articles').getList(
    page: page,
    perPage: perPage,
    sort: '-created',
    filter: 'status = "published"',
    expand: 'author',
  );

  return result.items;
}

// 获取单条
Future<RecordModel> getArticle(String id) async {
  return await pb.collection('articles').getOne(
    id,
    expand: 'author',
  );
}

// 创建
Future<RecordModel> createArticle(String title, String content) async {
  return await pb.collection('articles').create(body: {
    'title': title,
    'content': content,
    'status': 'draft',
    'author': pb.authStore.record?.id,
  });
}

// 更新
Future<RecordModel> updateArticle(String id, Map<String, dynamic> data) async {
  return await pb.collection('articles').update(id, body: data);
}

// 删除
Future<void> deleteArticle(String id) async {
  await pb.collection('articles').delete(id);
}
```

### 12.11.5 实时订阅

```dart
// 订阅集合
void subscribeToArticles(Function(RecordSubscriptionEvent) callback) {
  pb.collection('articles').subscribe('*', callback);
}

// 取消订阅
void unsubscribeFromArticles() {
  pb.collection('articles').unsubscribe('*');
}

// Flutter Widget 中使用
class ArticleListPage extends StatefulWidget {
  @override
  _ArticleListPageState createState() => _ArticleListPageState();
}

class _ArticleListPageState extends State<ArticleListPage> {
  List<RecordModel> articles = [];

  @override
  void initState() {
    super.initState();
    loadArticles();
    subscribeToArticles((e) {
      setState(() {
        if (e.action == 'create') {
          articles.insert(0, e.record!);
        } else if (e.action == 'update') {
          final index = articles.indexWhere((a) => a.id == e.record!.id);
          if (index != -1) articles[index] = e.record!;
        } else if (e.action == 'delete') {
          articles.removeWhere((a) => a.id == e.record!.id);
        }
      });
    });
  }

  Future<void> loadArticles() async {
    final items = await getArticles();
    setState(() => articles = items);
  }

  @override
  void dispose() {
    unsubscribeFromArticles();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: articles.length,
      itemBuilder: (context, index) {
        final article = articles[index];
        return ListTile(
          title: Text(article.getStringValue('title')),
          subtitle: Text(article.getStringValue('content').substring(0, 50)),
        );
      },
    );
  }
}
```

---

## 12.12 Next.js/Nuxt.js SSR集成

### 12.12.1 Next.js App Router集成

```javascript
// lib/pocketbase.js
import PocketBase from 'pocketbase'
import { cookies } from 'next/headers'

// 服务端获取 PocketBase 实例
export async function createServerPB() {
    const pb = new PocketBase('http://127.0.0.1:8090')

    // 从 Cookie 恢复认证状态
    const cookieStore = await cookies()
    const authCookie = cookieStore.get('pb_auth')

    if (authCookie) {
        pb.authStore.loadFromCookie(`pb_auth=${authCookie.value}`)
    }

    return pb
}

// 客户端单例
let clientPB = null

export function createBrowserPB() {
    if (clientPB) return clientPB

    clientPB = new PocketBase('http://127.0.0.1:8090')

    // 从 Cookie 恢复认证状态
    pb.authStore.loadFromCookie(document.cookie)

    pb.authStore.onChange(() => {
        document.cookie = pb.authStore.exportToCookie({ httpOnly: false })
    })

    return clientPB
}
```

```jsx
// app/articles/page.jsx (Server Component)
import { createServerPB } from '@/lib/pocketbase'

export default async function ArticlesPage() {
    const pb = await createServerPB()

    const articles = await pb.collection('articles').getList(1, 20, {
        sort: '-created',
        filter: 'status = "published"',
        expand: 'author',
    })

    return (
        <div>
            <h1>文章列表</h1>
            {articles.items.map(article => (
                <article key={article.id}>
                    <h2>{article.title}</h2>
                    <p>作者: {article.expand?.author?.name}</p>
                    <p>{article.content.substring(0, 200)}...</p>
                </article>
            ))}
        </div>
    )
}
```

### 12.12.2 Next.js API Route

```javascript
// app/api/login/route.js
import { createServerPB } from '@/lib/pocketbase'
import { NextResponse } from 'next/server'

export async function POST(request) {
    const { email, password } = await request.json()
    const pb = await createServerPB()

    try {
        const authData = await pb.collection('users').authWithPassword(email, password)

        const response = NextResponse.json({
            user: authData.record,
            token: authData.token,
        })

        // 设置认证 Cookie
        response.cookies.set('pb_auth', pb.authStore.exportToCookie(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7天
        })

        return response
    } catch (error) {
        return NextResponse.json(
            { error: '登录失败' },
            { status: 401 }
        )
    }
}
```

### 12.12.3 Nuxt.js集成

```javascript
// plugins/pocketbase.js
import PocketBase from 'pocketbase'

export default defineNuxtPlugin(() => {
    const pb = new PocketBase('http://127.0.0.1:8090')

    // 在客户端恢复认证
    if (process.client) {
        const cookie = useCookie('pb_auth')
        if (cookie.value) {
            pb.authStore.loadFromCookie(`pb_auth=${cookie.value}`)
        }

        pb.authStore.onChange(() => {
            cookie.value = pb.authStore.exportToCookie()
        })
    }

    return {
        provide: {
            pb,
        },
    }
})
```

```vue
<!-- pages/articles.vue -->
<template>
  <div>
    <h1>文章列表</h1>
    <article v-for="article in articles" :key="article.id">
      <h2>{{ article.title }}</h2>
      <p>{{ article.content.substring(0, 200) }}...</p>
    </article>
  </div>
</template>

<script setup>
const { $pb } = useNuxtApp()

const { data: articles } = await useAsyncData('articles', async () => {
  const result = await $pb.collection('articles').getList(1, 20, {
    sort: '-created',
    filter: 'status = "published"',
  })
  return result.items
})
</script>
```

---

## 12.13 错误处理与重试策略

### 12.13.1 统一错误处理

```javascript
import PocketBase, { ClientResponseError } from 'pocketbase'

const pb = new PocketBase('http://127.0.0.1:8090')

// 封装请求方法
async function safeRequest(fn) {
    try {
        return await fn()
    } catch (error) {
        if (error instanceof ClientResponseError) {
            console.error('API错误:', {
                状态码: error.status,
                消息: error.message,
                详情: error.data,
            })

            switch (error.status) {
                case 400:
                    throw new Error('请求参数错误: ' + error.message)
                case 401:
                    // 认证过期，尝试刷新
                    try {
                        await pb.collection('users').authRefresh()
                        return await fn() // 重试
                    } catch {
                        pb.authStore.clear()
                        throw new Error('认证已过期，请重新登录')
                    }
                case 403:
                    throw new Error('没有权限执行此操作')
                case 404:
                    throw new Error('请求的资源不存在')
                case 429:
                    throw new Error('请求过于频繁，请稍后再试')
                default:
                    throw new Error('服务器错误，请稍后再试')
            }
        }

        throw error
    }
}

// 使用示例
const articles = await safeRequest(() =>
    pb.collection('articles').getList(1, 20)
)
```

### 12.13.2 重试策略

```javascript
// 带重试的请求封装
async function requestWithRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            // 不重试的错误类型
            if (error instanceof ClientResponseError) {
                if ([400, 401, 403, 404].includes(error.status)) {
                    throw error // 客户端错误不重试
                }
            }

            if (attempt < maxRetries) {
                const waitTime = delay * Math.pow(2, attempt - 1) // 指数退避
                console.log(`请求失败，${waitTime}ms 后重试 (${attempt}/${maxRetries})`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
            }
        }
    }

    throw lastError
}

// 使用示例
const data = await requestWithRetry(
    () => pb.collection('articles').getList(1, 20),
    3,
    1000
)
```

### 12.13.3 表单验证错误处理

```javascript
async function createArticle(data) {
    try {
        return await pb.collection('articles').create(data)
    } catch (error) {
        if (error instanceof ClientResponseError && error.status === 400) {
            // 解析字段级别的错误
            const fieldErrors = {}

            if (error.data?.data) {
                for (const [field, detail] of Object.entries(error.data.data)) {
                    fieldErrors[field] = detail.message
                }
            }

            return { success: false, errors: fieldErrors }
        }
        throw error
    }
}

// 使用示例
const result = await createArticle({ title: '', content: '' })
if (!result.success) {
    console.log('验证错误:', result.errors)
    // { title: "不能为空", content: "不能为空" }
}
```

---

## 12.14 TypeScript类型支持

### 12.14.1 定义记录类型

```typescript
// types/pocketbase.ts

// 基础记录类型
interface BaseRecord {
    id: string
    collectionId: string
    collectionName: string
    created: string
    updated: string
}

// 用户记录
interface UserRecord extends BaseRecord {
    email: string
    name: string
    avatar: string
    role: 'admin' | 'editor' | 'member'
    bio?: string
    lastLogin?: string
}

// 文章记录
interface ArticleRecord extends BaseRecord {
    title: string
    content: string
    status: 'draft' | 'published' | 'archived'
    author: string
    category: string
    tags: string[]
    coverImage?: string
    views: number
    publishedAt?: string
    expand?: {
        author?: UserRecord
        category?: CategoryRecord
    }
}

// 分类记录
interface CategoryRecord extends BaseRecord {
    name: string
    description: string
    sortOrder: number
    active: boolean
}

// 评论记录
interface CommentRecord extends BaseRecord {
    article: string
    author: string
    content: string
    expand?: {
        author?: UserRecord
        article?: ArticleRecord
    }
}
```

### 12.14.2 类型安全的SDK封装

```typescript
// lib/pocketbase.ts
import PocketBase, { ListResult, RecordModel } from 'pocketbase'

const pb = new PocketBase('http://127.0.0.1:8090')

// 类型安全的集合服务
class TypedCollectionService<T extends BaseRecord> {
    constructor(
        private pb: PocketBase,
        private collectionName: string
    ) {}

    async getList(
        page: number = 1,
        perPage: number = 20,
        options?: {
            sort?: string
            filter?: string
            expand?: string
        }
    ): Promise<ListResult<T>> {
        return await this.pb.collection(this.collectionName).getList(
            page,
            perPage,
            options
        ) as unknown as ListResult<T>
    }

    async getOne(id: string, options?: { expand?: string }): Promise<T> {
        return await this.pb.collection(this.collectionName).getOne(
            id,
            options
        ) as unknown as T
    }

    async create(data: Partial<Omit<T, keyof BaseRecord>>): Promise<T> {
        return await this.pb.collection(this.collectionName).create(
            data
        ) as unknown as T
    }

    async update(id: string, data: Partial<Omit<T, keyof BaseRecord>>): Promise<T> {
        return await this.pb.collection(this.collectionName).update(
            id,
            data
        ) as unknown as T
    }

    async delete(id: string): Promise<boolean> {
        return await this.pb.collection(this.collectionName).delete(id)
    }

    subscribe(
        topic: string,
        callback: (data: { action: string; record: T }) => void
    ) {
        return this.pb.collection(this.collectionName).subscribe(topic, callback as any)
    }

    unsubscribe(topic?: string) {
        return this.pb.collection(this.collectionName).unsubscribe(topic)
    }
}

// 导出类型安全的服务实例
export const articles = new TypedCollectionService<ArticleRecord>(pb, 'articles')
export const users = new TypedCollectionService<UserRecord>(pb, 'users')
export const categories = new TypedCollectionService<CategoryRecord>(pb, 'categories')
export const comments = new TypedCollectionService<CommentRecord>(pb, 'comments')

export { pb }
```

### 12.14.3 在React中使用类型

```tsx
// components/ArticleList.tsx
import { useState, useEffect } from 'react'
import { articles } from '../lib/pocketbase'
import type { ArticleRecord } from '../types/pocketbase'

interface ArticleListProps {
    category?: string
    limit?: number
}

export function ArticleList({ category, limit = 20 }: ArticleListProps) {
    const [items, setItems] = useState<ArticleRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchArticles = async () => {
            setLoading(true)
            try {
                let filter = 'status = "published"'
                if (category) {
                    filter += ` && category = "${category}"`
                }

                const result = await articles.getList(1, limit, {
                    sort: '-created',
                    filter,
                    expand: 'author,category',
                })

                setItems(result.items)
            } catch (err) {
                setError(err instanceof Error ? err.message : '加载失败')
            } finally {
                setLoading(false)
            }
        }

        fetchArticles()
    }, [category, limit])

    if (loading) return <div>加载中...</div>
    if (error) return <div>错误: {error}</div>

    return (
        <div>
            {items.map((article: ArticleRecord) => (
                <article key={article.id}>
                    <h3>{article.title}</h3>
                    <div className="meta">
                        <span>作者: {article.expand?.author?.name}</span>
                        <span>分类: {article.expand?.category?.name}</span>
                        <span>浏览: {article.views}</span>
                        <span>状态: {article.status}</span>
                    </div>
                    <p>{article.content.substring(0, 200)}...</p>
                </article>
            ))}
        </div>
    )
}
```

### 12.14.4 类型生成工具

可以使用第三方工具自动从 PocketBase 集合生成 TypeScript 类型：

```bash
# 安装 pocketbase-typegen
npm install -D pocketbase-typegen

# 从运行中的 PocketBase 实例生成类型
npx pocketbase-typegen --url http://127.0.0.1:8090 --email admin@example.com --password admin123 --out src/types/pocketbase-types.ts
```

生成的类型文件会包含所有集合的完整字段定义，确保类型与数据库结构保持同步。

---

> **小结**：PocketBase 的前端 SDK 提供了丰富的 API 来简化前端与后端的交互。无论是 React、Vue、Svelte 还是 Flutter，都可以通过官方 SDK 快速实现认证、CRUD、文件管理和实时订阅等功能。通过合理的封装（Context/Provider、Composables、Store）和类型支持，可以构建出类型安全、可维护的前端应用。在 SSR 场景下，需要注意认证状态的跨请求传递和 Cookie 管理。
