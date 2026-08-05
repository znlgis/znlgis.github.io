---
layout: default
title: 第三章：Sentry 快速上手
---

# 第三章：Sentry 快速上手

## 目录

- [3.1 注册 Sentry SaaS 账号](#31-注册-sentry-saas-账号)
  - [3.1.1 选择部署方式](#311-选择部署方式)
  - [3.1.2 注册流程](#312-注册流程)
  - [3.1.3 账户安全设置](#313-账户安全设置)
- [3.2 创建组织与项目](#32-创建组织与项目)
  - [3.2.1 Organization（组织）的概念](#321-organization组织的概念)
  - [3.2.2 创建你的第一个组织](#322-创建你的第一个组织)
  - [3.2.3 Project（项目）的概念](#323-project项目的概念)
  - [3.2.4 创建你的第一个项目](#324-创建你的第一个项目)
- [3.3 理解 DSN（Data Source Name）](#33-理解-dsndata-source-name)
  - [3.3.1 DSN 的完整格式](#331-dsn-的完整格式)
  - [3.3.2 DSN 各部分的含义](#332-dsn-各部分的含义)
  - [3.3.3 公钥与密钥的角色](#333-公钥与密钥的角色)
  - [3.3.4 如何获取与安全保管 DSN](#334-如何获取与安全保管-dsn)
  - [3.3.5 DSN 的配置方式](#335-dsn-的配置方式)
- [3.4 各语言 SDK 快速集成](#34-各语言-sdk-快速集成)
  - [3.4.1 Python SDK](#341-python-sdk)
  - [3.4.2 JavaScript / Node.js SDK](#342-javascript--nodejs-sdk)
  - [3.4.3 Java SDK](#343-java-sdk)
  - [3.4.4 .NET / C# SDK](#344-net--c-sdk)
  - [3.4.5 Go SDK](#345-go-sdk)
  - [3.4.6 前端 JavaScript SDK](#346-前端-javascript-sdk)
- [3.5 发送第一条错误事件](#35-发送第一条错误事件)
  - [3.5.1 手动捕获异常](#351-手动捕获异常)
  - [3.5.2 在 Sentry 控制台查看事件](#352-在-sentry-控制台查看事件)
  - [3.5.3 理解 Issue Stream（问题流）](#353-理解-issue-stream问题流)
  - [3.5.4 事件详情页解析](#354-事件详情页解析)
- [3.6 初始化设置：团队与权限管理](#36-初始化设置团队与权限管理)
  - [3.6.1 邀请团队成员](#361-邀请团队成员)
  - [3.6.2 Sentry 的角色体系](#362-sentry-的角色体系)
  - [3.6.3 Team 的创建与管理](#363-team-的创建与管理)
  - [3.6.4 通知设置](#364-通知设置)
  - [3.6.5 告警规则初探](#365-告警规则初探)
- [3.7 Sentry 控制台界面导览](#37-sentry-控制台界面导览)
  - [3.7.1 全局导航栏](#371-全局导航栏)
  - [3.7.2 Projects 页面](#372-projects-页面)
  - [3.7.3 Issues 页面](#373-issues-页面)
  - [3.7.4 Performance 页面](#374-performance-页面)
  - [3.7.5 Discover 页面](#375-discover-页面)
  - [3.7.6 Alerts 页面](#376-alerts-页面)
  - [3.7.7 Settings 页面](#377-settings-页面)
  - [3.7.8 其他常用页面](#378-其他常用页面)
- [3.8 常见概念速查](#38-常见概念速查)
  - [3.8.1 Event（事件）](#381-event事件)
  - [3.8.2 Issue（问题）](#382-issue问题)
  - [3.8.3 Breadcrumb（面包屑）](#383-breadcrumb面包屑)
  - [3.8.4 Context（上下文）](#384-context上下文)
  - [3.8.5 Tags（标签）](#385-tags标签)
  - [3.8.6 Release（版本）](#386-release版本)
  - [3.8.7 Environment（环境）](#387-environment环境)
  - [3.8.8 概念关系图](#388-概念关系图)
- [本章小结](#本章小结)

---

## 3.1 注册 Sentry SaaS 账号

### 3.1.1 选择部署方式

在正式开始之前，需要了解 Sentry 提供的两种部署方式：

| 部署方式 | 说明 | 适用场景 |
|---------|------|---------|
| **Sentry SaaS（sentry.io）** | Sentry 官方托管的云服务，无需自行维护基础设施 | 中小团队、快速起步、不想维护自托管实例 |
| **Self-Hosted（自托管）** | 在自己的服务器上部署 Sentry 开源版本 | 对数据主权有严格要求、已有运维能力的大型企业 |

对于本章的快速上手教程，选择 **Sentry SaaS** 即可。免费套餐（Developer 计划）足以让个人开发者和初期团队完整体验核心功能，包括每月 5000 个错误事件、一个用户席位、30 天数据保留等。如果需要更多事件量和团队成员，后续可以升级到 Team 或 Business 计划。

### 3.1.2 注册流程

1. 打开浏览器，访问 [https://sentry.io](https://sentry.io)。
2. 点击页面右上角或中间的 **"Get Started"**（开始使用）按钮。
3. 注册页面提供三种注册方式：
   - **使用 GitHub 账号注册**：点击 "Continue with GitHub"，授权 Sentry 访问你的 GitHub 账号信息。
   - **使用 Google 账号注册**：点击 "Continue with Google"，授权 Sentry 访问你的 Google 账号信息。
   - **使用邮箱注册**：在表单中填写邮箱地址和密码，然后点击 "Create Account"。
4. 如果选择邮箱注册，系统会向你的邮箱发送一封验证邮件，点击邮件中的验证链接完成账号激活。
5. 注册完成后，Sentry 会引导你进入初始化向导（Setup Wizard），帮助你快速创建第一个组织和项目。这一步将在 [3.2 节](#32-创建组织与项目) 中详细介绍。

### 3.1.3 账户安全设置

注册完成后，建议立即完成以下安全设置：

- **设置双因素认证（2FA）**：登录后进入个人设置（点击左下角头像 → User Settings → Security），配置 TOTP 或安全密钥。Sentry 控制台关联着你的生产环境错误数据，启用 2FA 是必要的安全手段。
- **验证邮箱**：确认你的邮箱地址已验证，这有助于后续的团队邀请和通知接收。
- **配置个人通知偏好**：在 User Settings → Notifications 中，设置你希望接收通知的渠道（邮件、Slack、Discord 等）和频率。

---

## 3.2 创建组织与项目

### 3.2.1 Organization（组织）的概念

在 Sentry 中，**Organization（组织）** 是最高层级的管理单元，它相当于一个公司、一个部门或者一个独立的工作空间。组织的核心作用包括：

- **隔离资源**：不同组织之间的事件数据、成员、项目和设置完全隔离。
- **统一计费**：付费计划在组织级别生效，一个组织内的所有项目共享事件配额。
- **成员管理**：在组织级别邀请成员并分配角色，成员随后可以访问该组织下的项目。

一个 Sentry 账户可以属于多个组织，也可以在不同的组织之间切换。如果你的产品线有多个独立的应用，通常将它们放在同一个组织下，分别创建不同的项目即可。

### 3.2.2 创建你的第一个组织

如果你是通过注册流程进入的，Sentry 的初始化向导会引导你完成创建。如果没有自动弹出向导，也可以手动创建：

1. 登录 Sentry 后，如果没有属于任何组织，页面上会显示 "Create an Organization" 的入口。
2. 如果已有组织，点击左侧导航栏顶部的组织下拉菜单，然后点击 "Create a New Organization"。
3. 在创建页面中，填写以下信息：
   - **Organization Name**：组织名称，可以是你团队或公司的名字。
   - **Team Name**：初始团队的名称，默认为组织名。Sentry 会在创建组织时自动创建一个同名的团队。
4. 点击 "Create Organization" 完成创建。

### 3.2.3 Project（项目）的概念

**Project（项目）** 是组织之下的事件容器。一个项目通常对应一个独立的应用程序或服务。例如，你的产品有 Web 前端、后端 API、移动端 App，可以为它们分别创建三个项目。

Project 是 Sentry 数据模型中的关键节点：

- 每个事件（Event）都必须归属于一个项目。
- DSN（Data Source Name）是项目级别的——每个项目都有自己独立的 DSN。
- 告警规则、数据过滤、敏感信息脱敏等配置在项目级别进行。
- 项目可以归属到不同的 Team，实现细粒度的访问控制。

项目命名建议遵循 `所属产品-技术栈-环境` 的格式，例如 `myapp-backend-prod`、`myapp-frontend-prod`、`myapp-android-prod`。清晰地命名有助于团队在项目增多后快速定位。

### 3.2.4 创建你的第一个项目

1. 进入组织首页后，点击 "Create Project" 按钮。
2. 平台选择页面会列出 Sentry 支持的所有平台（Python、JavaScript、Java、.NET、Go 等）。选择一个与你当前使用的技术栈匹配的平台。这个选择**仅影响 SDK 集成引导页的示例代码**，不会限制项目实际接收何种语言的事件——一个 Python 项目同样可以接收来自 JavaScript 端上报的错误。
3. 为项目命名（例如 `my-first-app`），选择一个归属的 Team。
4. 点击 "Create Project"。

创建完成后，Sentry 会跳转到项目的 **SDK 配置引导页**，页面上会展示该平台对应的 SDK 安装步骤和你的专属 DSN。这是你下一步集成 SDK 时需要的关键信息。

> **建议**：即使你暂时用不上所有平台，也可以为不同端分别创建项目（Web 前端、后端 API 等各一个），这样在后续查看问题和性能数据时能够清晰地区分来源。

---

## 3.3 理解 DSN（Data Source Name）

### 3.3.1 DSN 的完整格式

DSN（Data Source Name）是 SDK 连接 Sentry 服务器的唯一凭证，它告诉 SDK **将事件发送到哪里**以及**如何认证**。每个项目都有自己独立的 DSN。一个典型的 Sentry DSN 格式如下：

```
https://<key>@<host>/<project_id>
```

完整示例：

```
https://a1b2c3d4e5f67890abcdef1234567890@o4505123456789012.ingest.sentry.io/4505123456789013
```

### 3.3.2 DSN 各部分的含义

| 组成部分 | 说明 | 示例 |
|---------|------|------|
| **协议** | 固定为 `https`，所有事件通过加密的 HTTP 协议传输 | `https://` |
| **公钥（Public Key）** | 32 位十六进制字符串，用于身份标识。会出现在 URL 和事件元数据中 | `a1b2c3d4e5f67890abcdef1234567890` |
| **主机（Host）** | Sentry 的接收端点地址。SaaS 用户通常以 `.ingest.sentry.io` 结尾；自托管用户使用自己的域名 | `o4505123456789012.ingest.sentry.io` |
| **项目 ID（Project ID）** | 数字标识符，指定事件应该归属于哪个项目 | `4505123456789013` |

SDK 在初始化时会解析 DSN，提取出 endpoint 地址、公钥和项目 ID。当事件被发送时，公钥会包含在 HTTP 头 `X-Sentry-Auth` 中，Sentry 服务器根据它来验证请求的合法性并将事件路由到正确的项目。

### 3.3.3 公钥与密钥的角色

DSN 中包含的是**公钥（Public Key）**，它只用于**发送事件**——将错误数据推送到 Sentry。Sentry 使用公私钥对来保证安全性：

| 密钥类型 | 用途 | 泄露后果 |
|---------|------|---------|
| **公钥（Public Key）** | 存在于 DSN 中，用于发送事件。可出现在客户端代码中 | 攻击者可以向你的项目发送虚假事件，但无法读取你的错误数据 |
| **密钥（Secret Key）** | 存在于 API Key 或 Auth Token 中，用于调用 Sentry API（读取事件、管理项目等） | 攻击者可以读取所有错误数据、修改项目配置——**必须严格保密** |

DSN 通常可以安全地出现在前端代码中，因为它不具备读取权限。但如果你的应用涉及商业机密，通过 DSN 发送的虚假事件仍可能造成干扰。可在项目设置的 Security & Privacy 中配置允许的来源域名来增加一层防护。

### 3.3.4 如何获取与安全保管 DSN

在 Sentry 控制台获取 DSN 的路径：

1. 进入你的项目页面。
2. 点击左侧导航栏的 **"Settings"**（齿轮图标）。
3. 在项目设置中选择 **"Client Keys (DSN)"**。
4. 页面会列出该项目的所有 DSN。每个项目默认有一个 DSN，旁边提供了直接复制按钮。

**安全实践：**

- 将 DSN 存储在环境变量中，而不是硬编码在代码仓库。
- 前端项目直接暴露在浏览器中是无法避免的，但可以配置 CSP（Content Security Policy）和 Sentry 的域名白名单来限制来源。
- 如果 DSN 泄露，可以在 Sentry 控制台的 Client Keys 页面中将其禁用，然后创建一个新的 DSN 替换。

各语言中使用环境变量存储 DSN 的惯例命名：

| 语言 / 框架 | 环境变量名 |
|------------|-----------|
| 通用 | `SENTRY_DSN` |
| Python | `SENTRY_DSN` |
| JavaScript / Node.js | `SENTRY_DSN` |
| Java | `SENTRY_DSN` |
| .NET | `Sentry__Dsn` |
| Go | `SENTRY_DSN` |

### 3.3.5 DSN 的配置方式

SDK 通常支持以下几种 DSN 配置方式，优先级从高到低：

**优先级 1：代码中显式传递**

```python
import sentry_sdk
sentry_sdk.init(dsn="https://xxx@xxx.ingest.sentry.io/xxx")
```

**优先级 2：环境变量**

```bash
export SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
```

**优先级 3：配置文件**（部分语言支持）

例如 .NET 项目中的 `appsettings.json`：

```json
{
  "Sentry": {
    "Dsn": "https://xxx@xxx.ingest.sentry.io/xxx"
  }
}
```

---

## 3.4 各语言 SDK 快速集成

Sentry 官方提供了 20 余种语言的 SDK。本节选取五个最常用的服务端语言加上前端 JavaScript，给出最小化集成示例。所有示例基于 Sentry SaaS 最新版 SDK，你可以直接复制并根据自己的 DSN 进行调整。

### 3.4.1 Python SDK

Python 是 Sentry 最早支持的语言之一，SDK 名为 `sentry-sdk`，覆盖了 Django、Flask、FastAPI、Celery 等主流框架。

**安装：**

```bash
pip install sentry-sdk
```

**最小集成示例：**

```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://a1b2c3d4e5f67890abcdef1234567890@o4505123456789012.ingest.sentry.io/4505123456789013",
    # 设置采样率，1.0 表示捕获 100% 的事务用于性能监控
    traces_sample_rate=1.0,
)

# 所有未捕获的异常将自动上报到 Sentry
def divide(a, b):
    return a / b

# 这行代码会触发 ZeroDivisionError 并自动上报
result = divide(1, 0)
```

**框架集成示例（Flask）：**

```python
from flask import Flask
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="https://xxx@xxx.ingest.sentry.io/xxx",
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0,
)

app = Flask(__name__)

@app.route("/")
def hello():
    1 / 0  # 此异常将被自动捕获
    return "Hello, World!"
```

### 3.4.2 JavaScript / Node.js SDK

Node.js SDK 名为 `@sentry/node`，支持 Express、Koa、NestJS 等框架。

**安装：**

```bash
npm install @sentry/node
```

**最小集成示例：**

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://a1b2c3d4e5f67890abcdef1234567890@o4505123456789012.ingest.sentry.io/4505123456789013",
  tracesSampleRate: 1.0,
});

// 未捕获的异常将自动上报
function divide(a, b) {
  return a / b;
}

// 触发异常
divide(1, 0);
```

**手动捕获异常：**

```javascript
try {
  JSON.parse("{ invalid json }");
} catch (error) {
  Sentry.captureException(error);
}
```

**Express 框架集成：**

```javascript
const express = require("express");
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://xxx@xxx.ingest.sentry.io/xxx",
  tracesSampleRate: 1.0,
});

const app = express();

// Sentry 的请求处理器必须在所有其他中间件之前
app.use(Sentry.Handlers.requestHandler());

app.get("/", (req, res) => {
  throw new Error("Something broke!");  // 自动捕获
});

// Sentry 的错误处理器必须在所有其他中间件之后
app.use(Sentry.Handlers.errorHandler());

app.listen(3000);
```

### 3.4.3 Java SDK

Java SDK 名为 `sentry`，支持 Spring Boot、Logback、Log4j2 等生态。

**Maven 依赖：**

```xml
<dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry</artifactId>
    <version>7.26.0</version>
</dependency>
```

**Gradle 依赖：**

```groovy
implementation 'io.sentry:sentry:7.26.0'
```

**最小集成示例：**

```java
import io.sentry.Sentry;

public class Main {
    public static void main(String[] args) {
        Sentry.init(options -> {
            options.setDsn("https://a1b2c3d4e5f67890abcdef1234567890@o4505123456789012.ingest.sentry.io/4505123456789013");
            options.setTracesSampleRate(1.0);
        });

        try {
            int result = 1 / 0;
        } catch (Exception e) {
            Sentry.captureException(e);
        }
    }
}
```

**Spring Boot 集成：**

在 `application.properties` 中配置：

```properties
sentry.dsn=https://xxx@xxx.ingest.sentry.io/xxx
sentry.traces-sample-rate=1.0
```

然后在启动类上添加依赖即可，Spring Boot 的全局异常将自动上报：

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 3.4.4 .NET / C# SDK

.NET SDK 名为 `Sentry`，支持 .NET Framework 4.6.1+ 和 .NET 8/9。SDK 深度集成 ASP.NET Core 管道，自动捕获未处理异常和 HTTP 请求。

**NuGet 安装：**

```bash
dotnet add package Sentry
# ASP.NET Core 项目还需要：
dotnet add package Sentry.AspNetCore
```

**控制台应用最小示例：**

```csharp
using Sentry;

SentrySdk.Init(options =>
{
    options.Dsn = "https://a1b2c3d4e5f67890abcdef1234567890@o4505123456789012.ingest.sentry.io/4505123456789013";
    options.TracesSampleRate = 1.0;
});

try
{
    int zero = 0;
    int result = 1 / zero;
}
catch (Exception ex)
{
    SentrySdk.CaptureException(ex);
}
```

**ASP.NET Core Web 应用集成：**

在 `Program.cs` 中添加一行代码即可完成集成：

```csharp
var builder = WebApplication.CreateBuilder(args);

// 添加这一行即可启用 Sentry 监控
builder.WebHost.UseSentry(options =>
{
    options.Dsn = "https://xxx@xxx.ingest.sentry.io/xxx";
    options.TracesSampleRate = 1.0;
});

var app = builder.Build();

app.MapGet("/", () =>
{
    throw new Exception("Something broke!");
});

app.Run();
```

**使用 appsettings.json 配置：**

```json
{
  "Sentry": {
    "Dsn": "https://xxx@xxx.ingest.sentry.io/xxx",
    "MaxRequestBodySize": "Always",
    "SendDefaultPii": false,
    "TracesSampleRate": 1.0
  }
}
```

然后在 `Program.cs` 中使用：

```csharp
builder.WebHost.UseSentry();
```

### 3.4.5 Go SDK

Go SDK 名为 `sentry-go`，支持所有 Go 项目类型。

**安装：**

```bash
go get github.com/getsentry/sentry-go
```

**最小集成示例：**

```go
package main

import (
    "time"
    "github.com/getsentry/sentry-go"
)

func main() {
    err := sentry.Init(sentry.ClientOptions{
        Dsn:              "https://a1b2c3d4e5f67890abcdef1234567890@o4505123456789012.ingest.sentry.io/4505123456789013",
        TracesSampleRate: 1.0,
    })
    if err != nil {
        panic(err)
    }
    // 确保在程序退出前将缓冲区中的事件全部发送
    defer sentry.Flush(2 * time.Second)

    // 手动捕获异常
    sentry.CaptureException(
        fmt.Errorf("an error occurred"),
    )
}
```

**自动捕获 panic：**

```go
func main() {
    err := sentry.Init(sentry.ClientOptions{
        Dsn: "https://xxx@xxx.ingest.sentry.io/xxx",
        TracesSampleRate: 1.0,
    })
    if err != nil {
        panic(err)
    }
    defer sentry.Flush(2 * time.Second)

    // 使用 Recover 自动捕获 panic
    defer sentry.Recover()

    // 这个 panic 会被自动捕获并上报
    panic("something went wrong!")
}
```

**HTTP 服务集成：**

```go
package main

import (
    "net/http"
    "github.com/getsentry/sentry-go"
    sentryhttp "github.com/getsentry/sentry-go/http"
)

func main() {
    sentry.Init(sentry.ClientOptions{
        Dsn: "https://xxx@xxx.ingest.sentry.io/xxx",
        TracesSampleRate: 1.0,
    })
    defer sentry.Flush(2 * time.Second)

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        panic("server error!")
    })

    // 包装 http.Handler 实现自动捕获
    handler := sentryhttp.New(sentryhttp.Options{}).Handle(http.DefaultServeMux)
    http.ListenAndServe(":8080", handler)
}
```

### 3.4.6 前端 JavaScript SDK

前端 SDK 名为 `@sentry/browser`，支持所有主流浏览器以及 React、Vue、Angular 等框架。

**安装（npm）：**

```bash
npm install @sentry/browser
```

**最小集成示例：**

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://a1b2c3d4e5f67890abcdef1234567890@o4505123456789012.ingest.sentry.io/4505123456789013",
  tracesSampleRate: 1.0,
});

// 手动捕获
try {
  myUndefinedFunction();  // ReferenceError
} catch (error) {
  Sentry.captureException(error);
}
```

**通过 CDN 引入（无构建工具）：**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sentry Test</title>
</head>
<body>
  <button onclick="triggerError()">触发错误</button>

  <script src="https://browser.sentry-cdn.com/8.55.0/bundle.min.js"
          integrity="sha384-..." crossorigin="anonymous"></script>
  <script>
    Sentry.init({
      dsn: "https://xxx@xxx.ingest.sentry.io/xxx",
      tracesSampleRate: 1.0,
    });

    function triggerError() {
      try {
        undefinedFunction();
      } catch (e) {
        Sentry.captureException(e);
      }
    }
  </script>
</body>
</html>
```

**React 框架集成：**

```bash
npm install @sentry/react
```

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://xxx@xxx.ingest.sentry.io/xxx",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>发生错误，请稍后再试。</p>}>
      <YourApp />
    </Sentry.ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
```

---

## 3.5 发送第一条错误事件

### 3.5.1 手动捕获异常

SDK 初始化完成后，最快验证集成是否成功的方法是手动触发生成一条测试事件。以 Python 为例：

```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://xxx@xxx.ingest.sentry.io/xxx",
    traces_sample_rate=1.0,
)

# 方式一：直接调用 capture_exception
try:
    1 / 0
except ZeroDivisionError as e:
    sentry_sdk.capture_exception(e)

# 方式二：使用 capture_message 发送自定义消息
sentry_sdk.capture_message("这是一条手动发送的测试消息", level="info")
```

运行这段脚本后，SDK 会异步地将事件发送到 Sentry。如果你的程序是短生命周期脚本（运行几秒就退出的），可能需要在末尾显式调用 flush 方法确保事件全部发送完成：

```python
sentry_sdk.flush()  # 阻塞等待所有事件发送完毕
```

对于各语言，手动发送测试事件的 API 几乎一致：

| 语言 | 捕获异常 | 发送消息 | 强制刷新 |
|------|---------|---------|---------|
| Python | `sentry_sdk.capture_exception(e)` | `sentry_sdk.capture_message("msg")` | `sentry_sdk.flush()` |
| Node.js | `Sentry.captureException(e)` | `Sentry.captureMessage("msg")` | `Sentry.flush()` |
| Java | `Sentry.captureException(e)` | `Sentry.captureMessage("msg")` | `Sentry.flush()` |
| .NET | `SentrySdk.CaptureException(e)` | `SentrySdk.CaptureMessage("msg")` | `SentrySdk.Flush()` |
| Go | `sentry.CaptureException(err)` | `sentry.CaptureMessage("msg")` | `sentry.Flush(timeout)` |

### 3.5.2 在 Sentry 控制台查看事件

事件发送成功后（通常在 1-3 秒内可达），按下列步骤在 Sentry 控制台查看：

1. 登录 [https://sentry.io](https://sentry.io)，进入你创建的组织。
2. 在左侧导航栏中点击 **"Issues"**。
3. 如果一切正常，你应该能看到一条或多条 Issue（问题）。每条 Issue 代表一种错误类型。
4. 如果暂时没有看到任何事件，可以点击页面右上角的刷新按钮，或者检查以下几点：
   - DSN 是否正确（注意不要有多余的空格或引号）。
   - SDK 版本是否过旧导致与当前服务端不兼容。
   - 网络是否可能被防火墙或代理拦截（Sentry SaaS 的 ingest endpoint 在公网上）。
   - 程序是否在发送前就已经退出（短生命周期脚本请确认 flush 被调用）。

### 3.5.3 理解 Issue Stream（问题流）

Issue Stream 是 Sentry 最核心的页面，它以列表形式展示所有被捕获的错误问题。列表中的每一条记录代表一个 Issue（问题），而不是单个 Event（事件）。多个相同类型的异常会被 Sentry 自动聚合到同一个 Issue 下。

Issue Stream 的每一行显示以下关键信息：

| 列 | 说明 |
|----|------|
| **错误类型和消息** | 例如 "ZeroDivisionError: division by zero"。Issue 的标题由异常类型和消息自动生成 |
| **级别（Level）** | error、warning、info 等。由 SDK 或手动设置 |
| **事件数量** | 该 Issue 下累积了多少个事件 |
| **用户数量** | 有多少不同的用户遇到了这个错误 |
| **首次出现时间** | 该 Issue 第一次被触发的时间 |
| **最近出现时间** | 该 Issue 最近一次被触发的时间 |
| **指派人** | 该 Issue 被分配给了哪位团队成员处理 |
| **状态** | resolved（已解决）、unresolved（未解决）、ignored（已忽略） |

### 3.5.4 事件详情页解析

点击 Issue Stream 中的某一条记录，进入事件详情页。这是排查错误的操作中心，包含以下关键区域：

- **错误堆栈（Stack Trace）**：以源码行级别的粒度展示调用链，包含文件名、行号和上下文代码片段。Sentry 支持与 GitHub/GitLab 等代码托管平台集成，堆栈中的文件路径可以直接链接到对应仓库的源码行。
- **Breadcrumbs（面包屑）**：记录错误发生前的关键操作序列，如 HTTP 请求、数据库查询、用户点击、日志输出等。这帮助开发者理解"导致错误的路径是什么"。
- **Tags（标签）**：由 SDK 自动添加或开发者手动设置的键值对标签，如环境（environment）、版本（release）、操作系统（os）等。用于后续的筛选和聚合分析。
- **Context（上下文）**：包含设备信息、操作系统版本、运行时版本、SDK 版本等环境快照。
- **Breadcrumbs + Tags + Context** 共同构成了一个完整的"案发现场"，使得远程排查错误几乎等同于本地调试。

---

## 3.6 初始化设置：团队与权限管理

### 3.6.1 邀请团队成员

Sentry 的核心价值之一是**团队协作排查错误**。邀请成员步骤如下：

1. 在左侧导航栏点击 **"Settings"**（齿轮图标）。
2. 在组织设置中点击 **"Members"**。
3. 点击页面右上角的 **"Invite Member"** 按钮。
4. 在弹出的对话框中输入团队成员的邮箱地址，多个地址用空格或逗号分隔。
5. 选择成员的角色（参见 [3.6.2 节](#362-sentry-的角色体系)）。
6. 可选地，设置该成员所属的 Team。
7. 点击 **"Send Invite"** 发送邀请。

被邀请人将收到一封邮件，点击其中的链接即可加入组织。邀请链接有有效期限制，过期后需要重新发送。

> **注意**：邀请成员的数量受你的付费计划限制。Developer（免费）计划只支持 1 个用户；Team 计划支持无限成员。

### 3.6.2 Sentry 的角色体系

Sentry 提供了分层的角色体系，适用于组织、团队和项目三个层级。

**组织级角色（Organization Roles）：**

| 角色 | 权限概述 |
|------|---------|
| **Owner（拥有者）** | 最高权限，可以删除组织、管理计费、管理所有成员和项目 |
| **Manager（管理者）** | 可以管理成员、项目和设置，但不能删除组织和更改计费 |
| **Admin（管理员）** | 可以管理团队和项目，添加/移除成员 |
| **Member（成员）** | 基本访问权限，可以查看和操作有权限的项目中的事件 |
| **Billing（计费管理员）** | 仅管理计费和订阅事项，不参与项目和事件管理 |

**团队级角色（Team Roles）：**

| 角色 | 权限概述 |
|------|---------|
| **Team Admin** | 管理团队成员、修改团队设置 |
| **Contributor** | 可以操作该团队关联项目中的事件（解决、分配、标记等） |

组织级角色定义了成员的全局权限范围，团队级角色补充了对特定团队的细粒度权限。一个成员在组织中可能是 Member 角色，但在某个 Team 中可以是 Team Admin。

### 3.6.3 Team 的创建与管理

**Team（团队）** 是项目和成员之间的关联桥梁。将项目分配给 Team，将成员加入 Team，就可以实现"哪些成员可以访问哪些项目"的权限模型。

**创建新团队：**

1. 进入组织设置 → **"Teams"**。
2. 点击 **"Create Team"**。
3. 填写团队名称（例如 `frontend-team`、`backend-team`）。
4. 点击 **"Create Team"** 完成创建。
5. 创建后，进入该团队的设置页面，可以添加成员和关联项目。

**典型实践：**

- 按照技术栈或业务模块划分 Team，例如 `Frontend`、`Backend`、`Mobile`、`Platform`。
- 将相关项目分配给对应 Team，实现各团队只关注自己负责的错误。
- 一些跨团队的项目（如基础设施相关）可以同时分配给多个 Team。

### 3.6.4 通知设置

Sentry 的通知系统帮助团队成员及时了解错误发生和处理情况。通知分为两个层级：

**项目级告警通知：** 在 [3.6.5 节](#365-告警规则初探) 中介绍的告警规则，当满足条件时自动发送通知。

**工作流通知：** 当 Issue 发生状态变更时发送通知，包括：

| 通知场景 | 说明 |
|---------|------|
| 新的 Issue 被创建 | 有新类型的错误首次出现 |
| Issue 被分配给你 | 有同事将你设为 Issue 的负责人 |
| Issue 状态变更 | Issue 被解决、标记为已忽略或重新打开 |
| Issue 有新的评论 | 有同事在 Issue 下添加了评论 |

配置路径：

1. **组织级通知**：组织设置 → Notifications，配置组织范围的通知偏好。
2. **项目级通知**：项目设置 → Notification Settings。
3. **个人通知偏好**：点击左下角头像 → User Settings → Notifications。

通知渠道支持：

- 电子邮件（默认启用）
- Slack（需要先在工作区集成中安装 Sentry Slack App）
- Discord
- Microsoft Teams
- PagerDuty / Opsgenie（用于值班告警）

### 3.6.5 告警规则初探

告警（Alerts）是 Sentry 自动通知能力的基础，它在错误事件满足特定条件时主动通知相关成员。Sentry 支持两类告警：

**Issue Alerts（问题告警）**：在某个 Issue 满足条件（如事件数量超过阈值、首次出现、状态变化）时触发。

**Metric Alerts（指标告警）**：基于聚合指标（如错误率、特定事件的发生次数）触发。

在初始化阶段，建议至少创建一条基础的 Issue Alert：

1. 进入项目设置 → **"Alerts"**。
2. 点击 **"Create Alert"** → 选择 **"Issue Alert"**。
3. 设置告警条件，例如：
   - **When**：`An event is first seen`（当某个错误首次出现时触发）
   - **Then**：`Send a notification to (team or member)`
4. 保存后，当项目中首次出现新的错误类型时，相关成员将收到通知。

更复杂的告警规则将在后续章节中详细讲解。

---

## 3.7 Sentry 控制台界面导览

Sentry 的控制台界面功能丰富，初次使用时可能会感到信息密度较高。本节对主要页面进行系统性的介绍，帮助你在后续使用中快速定位所需功能。

### 3.7.1 全局导航栏

登录后，左侧是全局导航栏，从上到下依次为：

| 导航项 | 图标/标识 | 功能说明 |
|-------|----------|---------|
| **组织名称下拉** | 组织名称 | 切换当前操作的组织，或创建新组织 |
| **Issues** | 惊叹号图标 | 查看所有项目的错误问题列表，是整个控制台的核心入口 |
| **Projects** | 文件夹图标 | 查看所有项目列表，了解各项目的健康状况 |
| **Explore** | 指南针图标 | 全局事件浏览和查询入口（包括 Traces、Profiles、Metrics、Logs、Replays 等） |
| **Boards** | 面板图标 | 可自定义的仪表盘视图 |
| **Insights** | 图表图标 | 应用洞察，按模块（数据库、HTTP、缓存等）展示性能数据 |
| **Alerts** | 铃铛图标 | 管理所有的告警规则和历史告警记录 |
| **Discover** | 搜索图标 | 强大的查询工具，可以对事件进行跨项目的灵活查询和分析 |
| **Dashboards** | 网格图标 | 创建和管理自定义仪表盘 |
| **Stats** | 柱状图图标 | 组织级的事件统计概览 |
| **Settings** | 齿轮图标 | 组织设置入口，包含成员、团队、项目、计费等 |

### 3.7.2 Projects 页面

Projects 页面以卡片或列表形式展示组织下所有项目，每个项目卡片上会显示关键健康指标：

- **近期错误频率**：一个微型的柱状图展示最近 24 小时或 7 天的错误趋势。
- **未解决的 Issue 数量**：该项目下有多少个尚未处理的错误问题。
- **首次出现时间**：项目中最早的事件发生时间，用于判断该项目的监控是否正常运作。
- **过滤的 Issue 数量**：被标记为 ignored 或规则过滤掉的 Issue 数量。

点击任意项目卡片即可进入该项目的 Issue Stream（问题列表）。

### 3.7.3 Issues 页面

这是日常使用频率最高的页面。Issues 页面是一个功能强大的问题列表，核心功能区包括：

**顶部筛选栏：**

你可以通过多维度筛选精确地缩小错误范围：

```
筛选条件示例：
- is:unresolved             仅显示未解决的 Issue
- assigned:me               仅显示分配给我的 Issue
- level:error               仅显示 error 级别的 Issue
- environment:production    仅显示生产环境的 Issue
- release:1.0.0             仅显示 1.0.0 版本的 Issue
```

筛选栏支持自由文本搜索和结构化查询，多个条件组合使用可以实现精确的数据定位。

**Issue 列表操作：**

- 点击 Issue 行进入事件详情页查看堆栈、上下文和面包屑。
- 使用行尾部的下拉菜单可以：解决（Resolve）、忽略（Ignore）、分配给成员等。
- 支持多选（勾选复选框）批量操作。
- "Resolved" 状态的 Issue 如果再次出现，Sentry 会自动将其重新打开（regression）。

**图表切换：**

Issues 页面顶部提供了图表视图切换，可以将问题列表切换为时间序列图表，直观地观察错误频率的变化趋势。

### 3.7.4 Performance 页面

Performance（性能监控）页面是 Sentry 另一大核心功能。它记录并分析应用的事务（Transaction）——也就是一次完整的请求处理过程。关键概念：

| 概念 | 说明 |
|------|------|
| **Transaction** | 一次完整的操作（HTTP 请求、后台任务、页面加载等），包含多个 Span |
| **Span** | Transaction 中的一个细分操作，例如一次数据库查询、一次外部 API 调用 |
| **Trace** | 跨越多个服务的完整调用链。在分布式系统中，同一个 Trace 可以包含来自不同服务的 Span |

Performance 页面默认视图按事务的耗时（Duration）排序，显示各端点的性能概况。你可以：

- 查看某个 Transaction 的详细信息，包括每个 Span 的耗时瀑布图。
- 通过百分位数（p50、p75、p95、p99）评估性能的稳定性。
- 按 Transaction 名称、HTTP 状态码、标签等维度筛选和排序。

Performance 功能需要在 SDK 初始化时设置 `tracesSampleRate`（采样率），Sentry 仅会对采样到的事务进行完整的 Span 追踪和存储。

### 3.7.5 Discover 页面

Discover 是一个强大的跨项目查询和分析工具，允许你编写类似 SQL 的查询来检索和聚合事件数据。与 Issues 页面相比，Discover 提供了更大的灵活性：

- **字段自由选择**：你可以选择 Event 中的任意字段作为查询结果的列（如 `event.type`、`user.email`、`transaction`、`timestamp` 等）。
- **聚合函数**：支持 `count()`、`count_unique()`、`avg()`、`p75()` 等聚合函数。
- **结果可视化**：查询结果可以切换为表格、柱状图、折线图、面积图、世界地图等可视化形式。

一个典型的 Discover 查询示例——查询最近 24 小时内按浏览器类型分组的错误数量：

```
event.type:error
| stats count() by browser.name
```

### 3.7.6 Alerts 页面

Alerts 页面集中管理所有告警规则。主要分为两个子视图：

- **Alert Rules（告警规则）**：展示所有已创建的告警规则，包括规则名称、触发条件、通知渠道、状态（启用/禁用）、最近触发时间等。点击某条规则可以编辑或查看详细历史。
- **Alert History（告警历史）**：以时间线形式展示告警的触发记录，包括触发时间、涉及的 Issue 或指标、通知结果（成功/失败）等。

从 Alerts 页面可以快速创建新规则，也可以对现有规则进行克隆、启用/禁用等操作。

### 3.7.7 Settings 页面

Settings 页面根据当前上下文（组织级 vs. 项目级）展示不同的配置选项。

**组织级设置（Organization Settings）：**

| 设置类别 | 主要功能 |
|---------|---------|
| **General** | 组织名称、slug、区域等基本设置 |
| **Projects** | 管理组织下的所有项目 |
| **Members** | 邀请、移除成员，管理角色 |
| **Teams** | 创建、编辑、删除团队 |
| **Repositories** | 关联 GitHub/GitLab 等代码仓库 |
| **Integrations** | 安装和管理第三方集成（Slack、Jira、GitHub 等） |
| **Developer Settings** | 管理 API Keys、Auth Tokens、Webhooks 等 |
| **Subscription** | 查看和管理付费计划、使用量 |

**项目级设置（Project Settings）：**

| 设置类别 | 主要功能 |
|---------|---------|
| **General** | 项目名称、平台、归属的 Team |
| **Client Keys (DSN)** | 管理项目的 DSN，创建或禁用密钥 |
| **Processing** | 数据过滤和清洗规则，敏感信息脱敏配置 |
| **Inbound Filters** | 按来源、错误消息等条件过滤事件 |
| **Security & Privacy** | 允许的来源域名、IP 限制、PII 保护策略 |
| **Alerts** | 该项目的告警规则 |
| **Ownership Rules** | 根据文件路径或 URL 自动分配 Issue |
| **Notification Settings** | 项目级的通知偏好 |
| **Tags & Context** | 管理和标记项目级的标签 |
| **Data Retention** | 数据保留策略（通常由组织计划决定） |

### 3.7.8 其他常用页面

| 页面 | 路径 | 功能 |
|------|------|------|
| **Replays** | Explore → Replays | 查看用户会话回放，还原用户操作过程中的 UI 行为，帮助理解错误发生前的交互上下文 |
| **Profiling** | Explore → Profiles | 代码级性能分析，展示函数调用频率和耗时，定位 CPU 热点 |
| **Crons / Uptime Monitoring** | Explore → Crons | 定时任务监控，当计划中的后台任务未按时执行时发出告警 |
| **User Feedback** | 项目 → User Feedback | 查看用户通过应用内反馈对话框主动提交的反馈 |
| **Releases** | 项目 → Releases | 按版本号组织事件数据，跟踪每个版本的稳定性，并与源代码管理系统关联 |
| **Activity** | 组织 → Activity | 审计日志，记录组织中所有重要操作（成员变更、设置修改等） |

---

## 3.8 常见概念速查

Sentry 有自己的一套术语体系，理解这些核心概念是高效使用的先决条件。本节对每个概念进行清晰的定义，并说明它们之间的关系。

### 3.8.1 Event（事件）

**Event 是 Sentry 中最基础的数据单元。** 每一次错误发生、每一次自定义消息上报，都对应一条 Event。

一条 Event 记录包含以下核心数据：

- **错误信息**：异常类型（如 `ZeroDivisionError`）和错误消息（如 `division by zero`）。
- **堆栈跟踪（Stack Trace）**：出错时的完整调用栈，包含文件名、函数名、行号。
- **时间戳**：事件发生的精确时间。
- **级别（Level）**：`fatal`、`error`、`warning`、`info`、`debug` 之一，用于标记事件的严重程度。
- **上下文（Context）**：运行时环境信息，如操作系统、浏览器、运行时版本等。
- **标签（Tags）**：键值对元数据，如 `environment: production`、`release: v2.1.0`。
- **面包屑（Breadcrumbs）**：事件发生前的操作轨迹。
- **用户信息**：触发事件的用户的标识符、IP 地址等。

**Event 不等于 Issue。** 同一个错误重复发生 100 次，会产生 100 条 Event，但在 Sentry 中它们会被自动聚合（grouping）为 1 条 Issue。

### 3.8.2 Issue（问题）

**Issue 是对相同类型错误事件的聚合。** Sentry 使用了一种名为"指纹（Fingerprint）"的机制来决定如何对 Event 进行分组。默认情况下，指纹由错误类型和堆栈信息计算得出。

Issue 的聚合策略意味着：

- 你不需要逐条处理每个错误事件——解决 Issue 意味着批量地确认"这类错误已经被修复"。
- Sentry 会自动计算每个 Issue 的统计信息：发生次数、影响用户数、首次/最近发生时间。
- Issue 的状态（unresolved → resolved → ignored）帮助团队追踪处理进度。

Issue 还支持以下协作操作：

- **Assign（分配）**：将 Issue 分配给某个团队成员。
- **Resolve（解决）**：标记为已解决。如果再次出现，会自动重新打开。
- **Ignore（忽略）**：标记为忽略。可以有条件地忽略（按出现次数、按时间段、按用户等）。
- **Snooze（暂时静默）**：在指定的时间段内不再提示该 Issue 的新事件。
- **Comment（评论）**：在 Issue 下添加团队讨论。

### 3.8.3 Breadcrumb（面包屑）

**Breadcrumb 是事件发生前的一系列操作记录，** 它们帮助开发者重建"导致错误的路径"。就像面包屑撒在走过的路上一样，每条 Breadcrumb 记录了一个时间点的操作快照。

常见的 Breadcrumb 类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `http` | HTTP 请求记录 | 用户点击了一个按钮，触发了 `POST /api/login` 请求 |
| `navigation` | 页面导航记录（前端） | 用户从 `/home` 导航到 `/settings` |
| `ui.click` | 用户点击记录（前端） | 用户点击了"提交"按钮 |
| `db` / `sql` | 数据库查询记录 | `SELECT * FROM users WHERE id = 1` |
| `error` | 被捕获但未上报的子错误 | 内部重试失败了 3 次但不构成致命错误 |
| `info` / `debug` | 自定义日志信息 | 开发者手动添加的调试信息 |

Breadcrumb 在事件详情页中以时间线形式展示，你可以逐条查看事件发生前应用程序经历了什么。

**手动添加 Breadcrumb：**

```python
from sentry_sdk import add_breadcrumb

add_breadcrumb(
    category="auth",
    message="用户登录成功",
    level="info",
    data={"user_id": 12345, "ip": "192.168.1.1"},
)
```

### 3.8.4 Context（上下文）

**Context 是事件发生时的环境快照。** 它描述的不是"错误本身"，而是"运行环境的情况"，为排查问题提供参考信息。

Sentry 支持的 Context 类型：

| Context 类型 | 内容 |
|-------------|------|
| **OS Context** | 操作系统名称、版本、内核版本 |
| **Runtime Context** | 编程语言运行时信息（如 Python 3.12.4、Node.js 20.11.0） |
| **Browser Context** | 浏览器名称、版本 |
| **Device Context** | 设备型号、CPU 架构、内存大小、是否 root/越狱 |
| **App Context** | 应用程序的包名/命名空间、版本号、构建号 |
| **User Context** | 用户标识符（ID、邮箱、用户名）、IP 地址 |

**手动设置 Context：**

```python
from sentry_sdk import set_context

set_context("character", {
    "name": "Mighty Fighter",
    "age": 19,
    "attack_type": "melee",
})
```

### 3.8.5 Tags（标签）

**Tags 是键值对的元数据标签。** 与 Context 不同，Tags 的主要用途是**搜索、筛选和聚合**，而不是提供详细信息。Tags 的值会被 Sentry 索引，用于在 Issues 和 Discover 页面中进行快速筛选。

Sentry SDK 自动添加的常用 Tags：

| Tag 名称 | 含义 | 示例值 |
|---------|------|--------|
| `environment` | 运行环境 | `production`、`staging`、`development` |
| `release` | 发布版本号 | `v2.1.0`、`a1b2c3d`（Git commit SHA） |
| `level` | 事件级别 | `error`、`warning` |
| `transaction` | 事务/端点名称 | `GET /api/users` |
| `os.name` | 操作系统名称 | `Linux`、`Windows` |
| `browser` | 浏览器名称 | `Chrome`、`Firefox` |
| `handled` | 是否被 try-catch 捕获 | `yes`、`no` |

**手动设置 Tags 的最佳时机是在初始化时：**

```python
sentry_sdk.init(
    dsn="https://xxx@xxx.ingest.sentry.io/xxx",
    environment="production",  # 这会自动设置 environment tag
    release="myapp@1.0.0",    # 这会自动设置 release tag
)
```

**运行时动态设置范围级 Tag：**

```python
from sentry_sdk import set_tag

set_tag("page.locale", "zh-CN")  # 将当前请求的地区信息作为 Tag
```

Tags 的重要特性：

- 每个项目最多支持 200 个不同的 Tag key。
- Tag value 长度有限制（通常为 200 字符），不适合存储长文本。
- Tags 在 Issues 页面的筛选栏、Discover 查询、告警规则中都可以使用。

### 3.8.6 Release（版本）

**Release 代表应用的一个特定部署版本。** 在 Sentry 中，Release 是一条全局性的标记线——将版本号关联到事件上之后，你就可以按版本维度来分析问题的分布，回答"这个问题是从哪个版本开始出现的"？的问题。

**Release 的核心作用：**

| 用途 | 说明 |
|------|------|
| **问题追溯** | 某个错误是在 `v2.0.0` 引入的还是在 `v1.9.0` 就存在 |
| **版本健康** | 对比新版本和旧版本的错误率，评估发布质量 |
| **源码映射** | 与 GitHub/GitLab 提交记录关联，定位到具体的 commit |
| **部署追踪** | 记录每次部署的时间点，帮助确定问题与部署操作的时序关系 |

**设置 Release：**

```python
sentry_sdk.init(
    dsn="https://xxx@xxx.ingest.sentry.io/xxx",
    release="myapp@1.0.0",
)
```

Release 值的推荐格式：

- 语义化版本：`myapp@1.0.0`
- Git Commit SHA：`a1b2c3d4e5f`
- 混合格式：`myapp@1.0.0+a1b2c3d`

### 3.8.7 Environment（环境）

**Environment 用于标识代码运行的环境上下文。** 最常见的划分是 `production`（生产环境）、`staging`（预发布环境）、`development`（开发环境）。通过 Environment 标签，你可以在同一个项目中隔离不同环境的事件：

- 生产环境的错误在 Issues 页面上单独查看，不会与开发环境的调试信息混淆。
- Performance 页面的数据也可以按环境区分，分别观察不同环境的性能表现。
- 告警规则可以针对特定环境（通常只对生产环境配置告警）。

**设置 Environment：**

```python
sentry_sdk.init(
    dsn="https://xxx@xxx.ingest.sentry.io/xxx",
    environment="production",
)
```

Sentry 默认不限制 Environment 的取值，但实际工程中建议使用有限的枚举值，例如 `production`、`staging`、`testing`。统一的环境命名有助于团队协作和数据对比。

### 3.8.8 概念关系图

为了更直观地理解这些概念的层次关系：

```
Organization（组织）
 └── Team（团队）
      └── Project（项目）
           ├── DSN（数据源名称）── SDK ──→ Event（事件）
           │                                 │
           │                      ┌─────────┴──────────┐
           │                      ▼                     ▼
           │               Issue（问题）        Transaction（事务）
           │                      │                     │
           │              Tags（标签）           Span（操作段）
           │           Environment（环境）
           │              Release（版本）
           │
           └── Settings（设置）
                 ├── Client Keys (DSN)
                 ├── Alerts（告警规则）
                 ├── Members（成员）
                 └── Notifications（通知）
```

**单条 Event 的数据结构：**

```
Event
 ├── 错误信息（异常类型 + 消息 + 堆栈跟踪）
 ├── Tags（标签：环境、版本、浏览器等元数据）
 ├── Breadcrumbs（面包屑：事件前的操作轨迹）
 ├── Context（上下文：设备、操作系统、运行时等环境快照）
 └── User（用户信息：标识符、IP 等）
```

---

## 本章小结

本章从零开始，完整覆盖了 Sentry 的入门全流程。回顾一下你学到的内容：

1. **注册与项目创建**：在 sentry.io 上注册账号，创建了你的第一个组织和项目。
2. **DSN 的工作原理**：理解了 DSN 的组成部分、公钥与密钥的区别、以及如何安全地配置 DSN。
3. **多语言 SDK 集成**：掌握了 Python、JavaScript、Java、.NET、Go 和前端 JavaScript 六个平台的 SDK 最小集成方法。
4. **发送并查看第一条错误**：通过 SDK API 手动发送异常和消息，在 Sentry 控制台的 Issues 页面中成功查看到了事件，并理解了 Issue Stream 和事件详情页的结构。
5. **团队协作基础**：学习了如何邀请成员、设置角色、创建团队和配置通知。
6. **控制台界面导览**：对 Sentry 的主要功能页面有了系统性的认知。
7. **核心概念**：建立了 Event、Issue、Breadcrumb、Context、Tags、Release、Environment 的完整概念模型。

到这一步，你已经拥有了独立使用 Sentry 进行错误监控的基础能力。在后续章节中，我们将深入探讨事件管理、告警优化、性能监控、源码关联等高级主题，帮助你充分发挥 Sentry 的完整价值。

**下一步行动建议：**

- 花 10 分钟将 Sentry SDK 集成到你正在开发的一个实际项目中。
- 故意触发几个不同类型的错误，观察它们在 Sentry 控制台中的展示效果。
- 邀请一位同事加入你的 Sentry 组织，体验一下 Issue 的分配和协作流程。
