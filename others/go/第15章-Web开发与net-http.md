---
layout: default
title: 第15章 - Web开发与net/http
---

# 第15章 - Web开发与net/http

Go 凭借出色的并发能力和强大的标准库，成为后端 Web 开发的热门选择。本章讲解使用标准库 `net/http` 构建 Web 服务的完整流程，并介绍主流 Web 框架。

## 15.1 最简 HTTP 服务器

Go 仅用几行代码即可启动一个生产可用的 HTTP 服务器：

```go
package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "Hello, World!")
    })

    fmt.Println("服务器启动在 :8080")
    http.ListenAndServe(":8080", nil)
}
```

- `http.HandleFunc`：注册一个路由及其处理函数。
- `http.ResponseWriter`：用于写响应。
- `*http.Request`：封装了请求的所有信息。
- `http.ListenAndServe`：在指定端口启动服务，`nil` 表示使用默认的多路复用器。

## 15.2 处理器与处理函数

Go HTTP 服务的核心抽象是 `http.Handler` 接口：

```go
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}
```

任何实现了 `ServeHTTP` 方法的类型都是处理器。`http.HandlerFunc` 是一个适配器，能将普通函数转为 Handler：

```go
type greetHandler struct {
    greeting string
}

func (h greetHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "%s!", h.greeting)
}

http.Handle("/greet", greetHandler{greeting: "你好"})
```

## 15.3 路由与多路复用器

`http.ServeMux` 是请求多路复用器，根据 URL 路径将请求分发到对应处理器：

```go
mux := http.NewServeMux()
mux.HandleFunc("/users", usersHandler)
mux.HandleFunc("/products", productsHandler)
http.ListenAndServe(":8080", mux)
```

### 15.3.1 Go 1.22 增强路由

Go 1.22 大幅增强了标准库路由，支持方法匹配和路径参数，许多场景下不再需要第三方路由库：

```go
mux := http.NewServeMux()

// 限定 HTTP 方法
mux.HandleFunc("GET /users", listUsers)
mux.HandleFunc("POST /users", createUser)

// 路径参数
mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id") // 提取路径参数
    fmt.Fprintf(w, "用户 ID: %s", id)
})
```

## 15.4 读取请求数据

### 15.4.1 查询参数与表单

```go
func handler(w http.ResponseWriter, r *http.Request) {
    // URL 查询参数 ?name=alice&age=30
    name := r.URL.Query().Get("name")

    // 表单数据（POST）
    r.ParseForm()
    email := r.FormValue("email")

    // 请求头
    contentType := r.Header.Get("Content-Type")

    // 路径与方法
    fmt.Println(r.Method, r.URL.Path)
}
```

### 15.4.2 读取请求体（JSON）

```go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

func createUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "无效的请求体", http.StatusBadRequest)
        return
    }
    defer r.Body.Close()
    // 处理 req...
}
```

## 15.5 返回响应

### 15.5.1 返回 JSON

```go
func getUser(w http.ResponseWriter, r *http.Request) {
    user := User{Name: "Alice", Age: 30}

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(user)
}
```

### 15.5.2 设置状态码与错误

```go
http.Error(w, "资源未找到", http.StatusNotFound)       // 404
w.WriteHeader(http.StatusCreated)                       // 201

// 重定向
http.Redirect(w, r, "/login", http.StatusFound)
```

> **注意**：必须在写入响应体之前调用 `WriteHeader` 和设置 Header，否则设置无效。

## 15.6 中间件

中间件是包裹处理器的函数，用于实现日志、认证、限流、CORS 等横切关注点。Go 中间件通常是"接收 Handler、返回 Handler"的函数：

```go
func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r) // 调用下一个处理器
        log.Printf("%s %s 耗时 %v", r.Method, r.URL.Path, time.Since(start))
    })
}

func authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" {
            http.Error(w, "未授权", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}

// 链式组合
handler := loggingMiddleware(authMiddleware(mux))
http.ListenAndServe(":8080", handler)
```

## 15.7 优雅关闭

生产服务需要支持优雅关闭：停止接收新请求，等待正在处理的请求完成后再退出：

```go
func main() {
    srv := &http.Server{Addr: ":8080", Handler: mux}

    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal(err)
        }
    }()

    // 等待中断信号
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
    <-quit

    // 给正在处理的请求 10 秒完成时间
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        log.Fatal("强制关闭:", err)
    }
    log.Println("服务器已优雅退出")
}
```

## 15.8 HTTP 客户端

`net/http` 同样提供强大的客户端能力：

```go
// 简单 GET
resp, err := http.Get("https://api.example.com/users")
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()
body, _ := io.ReadAll(resp.Body)

// 自定义请求
req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "******")

// 带超时的客户端（生产环境必须设置超时）
client := &http.Client{Timeout: 10 * time.Second}
resp, err = client.Do(req)
```

> **重要**：必须 `defer resp.Body.Close()`，否则会导致连接泄漏。生产环境务必为客户端设置超时。

## 15.9 模板渲染

标准库 `html/template` 用于安全地渲染 HTML（自动转义防止 XSS）。模板使用双花括号语法插入数据：

```go
import "html/template"

const page = `<h1>{% raw %}{{ .Title }}{% endraw %}</h1>
<ul>
{% raw %}{{ range .Items }}{% endraw %}
  <li>{% raw %}{{ . }}{% endraw %}</li>
{% raw %}{{ end }}{% endraw %}
</ul>`

func handler(w http.ResponseWriter, r *http.Request) {
    tmpl := template.Must(template.New("page").Parse(page))
    data := struct {
        Title string
        Items []string
    }{
        Title: "待办清单",
        Items: []string{"学习 Go", "编写 Web 服务"},
    }
    tmpl.Execute(w, data)
}
```

`html/template` 会根据上下文自动转义，有效防御跨站脚本攻击（XSS）。如果只是生成纯文本（非 HTML），可使用 `text/template`。

## 15.10 主流 Web 框架

虽然标准库已足够强大，但社区框架在路由、参数绑定、中间件生态上更便捷：

| 框架 | 特点 |
|------|------|
| **Gin** | 最流行，高性能，API 简洁，中间件丰富 |
| **Echo** | 高性能，功能全面，文档完善 |
| **Fiber** | 受 Express 启发，基于 fasthttp，极致性能 |
| **Chi** | 轻量，完全兼容标准库 `http.Handler` |
| **Beego** | 全栈 MVC 框架，企业级功能完善 |

以 Gin 为例：

```go
import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()
    r.GET("/users/:id", func(c *gin.Context) {
        id := c.Param("id")
        c.JSON(200, gin.H{"id": id})
    })
    r.Run(":8080")
}
```

## 15.11 本章小结

本章讲解了使用 Go 标准库 `net/http` 构建 Web 服务的完整流程：路由（含 Go 1.22 增强）、请求解析、响应生成、中间件、优雅关闭、HTTP 客户端和模板渲染。Go 的标准库已能胜任绝大多数 Web 开发需求，而 Gin、Echo 等框架则在便利性上更进一步。掌握这些知识，你已具备开发生产级 Web 服务的能力。

下一章我们将学习 Go 的数据库编程。
