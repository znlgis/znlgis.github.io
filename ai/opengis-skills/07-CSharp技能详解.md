---
layout: default
title: 第七章：C# 技能详解
---

# 第七章：C# 技能详解

在 opengis-skills 仓库中，C# / .NET 技能占据了重要地位。这一分类共收录 **8 个技能**，覆盖了从 Web 后端框架、后台管理系统、ORM 数据访问层，到 Office 文档处理、电子表格控件和代码保护的完整 .NET 开发生态链。无论你是需要快速开发一个 Web API、搭建企业级后台管理系统、高效操作数据库、读写 Excel 文件，还是保护分发出去的 DLL 不被反编译，C# 技能分类都有对应的解决方案。

本章将从技能全景出发，逐技能深入解析每个工具的核心理念、关键 API、典型用法和适用场景，最后通过决策树帮助你快速定位所需技能。

---

## 7.1 C# 技能全景

### 7.1.1 技能总览表

C# 分类下共有 8 个技能，按功能类型可以划分为五大方向：Web 框架、后台管理系统、ORM 框架、Excel/文档处理和代码保护。每个技能都在对应目录下包含完整的章节化教程。

| 技能 | 目录 | 章节数 | 类型 | 说明 |
|------|------|:------:|------|------|
| **furion** | `csharp/Furion/` | 20 章 | Web 框架 | .NET 极简 Web 应用框架，动态 API、规范化响应、零配置启动 |
| **admin-net-backend** | `csharp/Admin.NET/` | 10 章 | 后台管理 | 基于 Furion + SqlSugar + Redis + SignalR 的 RBAC 后台 |
| **admin-net-frontend** | `csharp/Admin.NET/` | — | 前端 | Vue 3 + Vite + Element Plus + Pinia + TypeScript 前端 |
| **sqlsugar** | `csharp/SqlSugar/` | 15 章 | ORM | 国产多数据库 ORM，支持 10+ 数据库，链式查询，读写分离 |
| **sod** | `csharp/sod/` | 10 章 | ORM | PDF.NET SOD，ORM + SQL-MAP + OQL 三合一框架 |
| **npoi** | `csharp/npoi/` | 18 章 | 文件操作 | Apache POI 的 .NET 移植，Excel/Word/PPT 读写 |
| **reogrid** | `csharp/ReoGrid/` | 20 章 | 控件 | .NET 电子表格控件（WinForms/WPF），内置公式引擎 |
| **dotnet-reactor** | `csharp/dotnet-reactor/` | 15 章 | 安全工具 | .NET 代码保护，混淆、加壳、反编译、许可证管理 |

### 7.1.2 五大方向与推荐学习路线

**推荐学习路线一：.NET 企业开发入栈**

```
furion（Web 框架）
  └→ admin-net-backend（后台管理实战）
      └→ sqlsugar（数据访问层）
          └→ sod（深入 ORM 设计思想）
```

这条路线从 Web 框架开始，到完整后台系统实战，再到 ORM 的深入掌握，覆盖了 .NET 后端开发的核心技能。

**推荐学习路线二：Office 文档处理**

```
npoi（Excel/Word 读写）
  └→ reogrid（交互式电子表格）
```

这条路线适合企业内部报表系统、数据导入导出系统、财务分析工具等场景。

**推荐学习路线三：代码安全加固**

```
dotnet-reactor（代码保护与混淆）
```

这条路线适合商业软件开发、ISV 授权管理、Unity 游戏保护等场景。

### 7.1.3 技能之间的引用关系

C# 技能之间存在紧密的依赖和引用关系，形成了一套完整的知识网络：

- **admin-net-backend** 构建在 **furion** + **sqlsugar** 之上，是这两个技能的实战级整合
- **admin-net-frontend** 是 admin-net-backend 的前端项目，提供 Vue 3 全家桶的完整实现
- **sod** 和 **sqlsugar** 是两种不同设计理念的 ORM，可以对比学习以理解 ORM 的本质
- **reogrid** 和 **npoi** 分别解决"动态编辑电子表格"和"静态读写 Office 文件"两个正交需求
- **dotnet-reactor** 可保护由上述任何框架生成的可执行文件

---

## 7.2 Web 框架：Furion

### 7.2.1 Furion 是什么

Furion 是由百小僧（MonkSoul）创建并开源的 .NET 应用开发框架，其核心理念是 **"让 .NET 开发更简单，更通用，更流行"**。它不是一个替代 ASP.NET Core 的重型框架，而是一组围绕 ASP.NET Core 生态的增强工具集，通过极简的 API 设计和零入侵的集成方式，帮助开发者快速构建高质量的 Web 应用和服务。

Furion 采用 **MIT/Apache-2.0** 双重开源许可证，截止 2026 年 6 月的最新稳定版为 4.9.9.2，全面支持 .NET 10，同时 5.0.0 预览版也在演进中。从 2020 年首次发布至今，Furion 累计在 GitHub 上收获了超过两万 Star，成为国内 .NET 社区最具影响力的框架之一。

### 7.2.2 核心概念

Furion 的功能体系围绕几个关键概念展开：

**动态 API（Dynamic API Controller）**

这是 Furion 最标志性的功能。在传统的 ASP.NET Core 开发中，你需要手动创建 Controller、标记路由特性、注入服务——这些步骤繁琐且重复。Furion 的动态 API 彻底颠覆了这个工作流：你只需要写一个普通的 Service 类，让它继承 `IDynamicApiController` 接口，Furion 就会在运行时自动扫描你的 Service，将其中的 public 方法暴露为 RESTful API 端点。

```csharp
// 只需要三行：定义接口、实现方法、继承 IDynamicApiController
public class UserService : IDynamicApiController
{
    private readonly SqlSugarClient _db;

    public UserService(SqlSugarClient db)
    {
        _db = db;
    }

    // Furion 自动生成 GET /api/user
    public List<User> GetList()
    {
        return _db.Queryable<User>().ToList();
    }

    // Furion 自动生成 POST /api/user
    public User Add(UserDto input)
    {
        var user = input.Adapt<User>();
        _db.Insertable(user).ExecuteReturnEntity();
        return user;
    }

    // Furion 自动生成 DELETE /api/user/{id}
    public void Delete(long id)
    {
        _db.Deleteable<User>().Where(u => u.Id == id).ExecuteCommand();
    }
}
```

不需要写 Controller 文件，不需要写 `[Route]` 特性，不需要写 `[HttpPost]` 标记——写完 Service，API 就已经就绪。这相当于 Furion 帮你完成了从 Service 到 Controller 的自动映射层，将开发者的精力集中在业务逻辑上。

**规范化响应（UnifyResult）**

前后端分离架构中，API 的响应格式一致性是一个看似简单、实则容易失控的问题。张三写的接口返回 `{ data: ... }`，李四写的接口返回 `{ result: ..., code: 200 }`，前端需要针对不同格式写不同的处理逻辑。

Furion 的 UnifyResult 解决了这个问题：它自动将所有 API 的返回值包装为统一的 JSON 格式：

```json
{
  "status": 200,
  "success": true,
  "data": { "id": 1, "name": "张三" },
  "message": "操作成功",
  "timestamp": 1722441600000
}
```

无论你的 Service 方法返回什么类型（实体、列表、分页对象，甚至 void），Furion 都会自动套上这层规范化外壳。你还可以通过 `[UnifyResult]` 特性或配置文件自定义包装格式。这层自动化确保了所有 API 的一致性，也为全局异常处理和日志记录提供了单一入口。

**零配置启动**

传统的 ASP.NET Core 项目的 `Program.cs` 通常包含几十行样板代码：注册 Swagger、注册 JWT、注册 CORS、注册日志、注册控制器……每次新项目都要复制粘贴一遍。

Furion 的 `Serve.Run()` 一行代码替代了这些：

```csharp
using Furion;

Serve.Run(
    defaultBuilder: builder =>
    {
        // 仅需补充项目特有的配置
        builder.Services.AddSqlSugar(/* ... */);
        builder.Services.AddSingleton<JwtHandler>();
    }
);
```

Furion 内置了所有常见的注册逻辑，通过约定优于配置的原则，将启动文件压缩到最小。

### 7.2.3 关键功能模块

Furion 的 20 章教程覆盖了以下关键模块，每个模块都是实际项目中的刚需：

**依赖注入（[FromServices]）**

Furion 在 ASP.NET Core 内置 DI 容器的基础上提供了增强：支持 `[FromServices]` 特性注入、属性注入、命名服务注册与解析。

**JWT 认证**

集成了完整的 JWT 认证流水线：Token 签发、刷新、过期处理、权限验证，通过 `JwtHandler` 抽象类和 `[Security]` 特性实现声明式授权。

**定时任务**

通过 `[Period]` 特性定义定时任务，支持 Cron 表达式，无需引入额外的调度库：

```csharp
[Period("0/5 * * * *")] // 每 5 分钟执行一次
public async Task SyncUserData()
{
    // 定时执行的业务逻辑
}
```

**事件总线（EventBus）**

提供进程内事件发布/订阅模型，解耦业务模块间的通信。支持同步和异步执行，适合日志记录、邮件发送、数据同步等场景。

**远程请求（HttpRequest）**

封装了 `HttpClient` 的创建和管理，提供流畅的 API 调用链：

```csharp
var result = await "https://api.example.com/data"
    .SetHeaders(new { Authorization = "Bearer xxx" })
    .GetAsAsync<ApiResult>();
```

自动处理连接池复用、超时重试、异常降级。

**EF Core 集成**

Furion 在 EF Core 的基础上提供了 Code First 自动迁移、数据库上下文池化、动态过滤（如软删除和多租户过滤）等增强。

**日志与审计**

集成 Serilog 等日志框架，提供结构化的日志记录和审计追踪能力。

**缓存管理**

提供统一的缓存抽象，支持内存缓存和 Redis 分布式缓存，通过 `[Cache]` 特性实现声明式缓存。

**多租户**

支持数据库分离、Schema 分离、字段隔离三种多租户方案，通过 `[MultiTenant]` 特性自动处理租户上下文。

**中间件与过滤器**

提供了全局异常处理中间件、请求日志中间件、跨域处理等常用中间件的开箱即用配置。

### 7.2.4 适用场景与局限性

**适合：**
- 快速开发 Web API 后端服务
- 微服务架构中的单个服务
- 中小团队希望降低项目配置成本
- 需要前后端分离的标准化接口规范

**不适合：**
- 对框架"黑盒"行为零容忍的团队（Furion 做了大量自动约定）
- 需要完全手工控制 ASP.NET Core 底层细节的场景
- 已经深度定制了 Startup/Program.cs 的老项目（迁移成本高）

---

## 7.3 后台管理系统：Admin.NET

### 7.3.1 Admin.NET 是什么

Admin.NET 是 opengis-skills 中整合度最高的技能——它不是单个工具，而是一套**完整的、前后端分离的通用权限开发框架**。它的后端构建在 Furion + SqlSugar + Redis + SignalR 的技术栈之上，前端采用 Vue 3 + Vite + Element Plus + Pinia + TypeScript 全家桶。

Admin.NET 的核心理念是 **"站在巨人肩膀上"**——它不重复造轮子，而是将业界最优秀的开源组件整合为开箱即用的后台管理系统。无论是搭建企业内部管理系统、开发 SaaS 平台，还是作为新项目的脚手架，Admin.NET 都提供了 20+ 个内置功能模块和灵活的扩展机制。

### 7.3.2 后端架构（admin-net-backend）

后端基于 Furion 框架构建，继承了 Furion 的动态 API、规范化响应、JWT 认证等所有能力，并在此基础上叠加了企业级后台特有的功能模块。

**核心功能模块矩阵**

| 模块 | 功能描述 | 涉及技能 |
|------|---------|---------|
| **用户管理** | 企业用户和系统管理员的增删改查，支持职务、机构、角色、数据权限绑定 | Furion、SqlSugar |
| **角色管理** | 基于 RBAC 的权限模型，角色绑定菜单权限和数据授权范围 | SqlSugar |
| **菜单管理** | 目录、菜单、按钮三级权限树，支持动态路由生成 | Furion |
| **机构管理** | 公司组织架构的多层级树形维护，支持部门、子公司、分公司等 | SqlSugar |
| **职位管理** | 用户职务标签维护，作为组织管理的辅助维度 | SqlSugar |
| **字典管理** | 系统枚举值、固定数据字典的统一维护 | SqlSugar |
| **日志系统** | 访问日志（登录/退出）和操作日志（业务操作/异常），支持 ES 存储 | Furion、Elasticsearch |
| **定时任务** | 分布式作业调度，支持 Cron 表达式和集群部署 | Furion、Quartz |
| **文件管理** | 文件上传/下载/预览，支持本地存储、阿里云 OSS、MinIO 等多种后端 | Furion |
| **代码生成器** | 根据数据库表结构一键生成前后端全套代码（实体、Service、Controller、Vue 页面） | SqlSugar |
| **消息推送** | WebSocket 实时消息（基于 SignalR），邮件和短信发送 | SignalR、Furion |
| **系统配置** | 系统运行参数的动态维护，无需修改配置文件即可调整行为 | SqlSugar |
| **在线用户** | 查看当前在线用户列表，支持强制踢出 | SignalR、Redis |
| **服务监控** | 服务器 CPU、内存、磁盘运行状态实时监控 | System.Diagnostics |
| **通知公告** | 系统级通知和公告的发布与管理 | SqlSugar |
| **限流控制** | 基于令牌桶的接口访问频率限制 | Furion |
| **开放授权** | OAuth 2.0 标准协议，支持微信、Gitee 等第三方登录 | Furion |

**多租户支持**

Admin.NET 支持三种多租户模式：
- **独立数据库**：每个租户拥有独立的数据库实例，物理隔离最高
- **共享数据库、独立 Schema**：同一数据库下按 Schema 隔离
- **共享数据库、共享 Schema**：通过租户 ID 字段行级隔离

租户识别通过请求头或子域名完成，数据权限自动过滤，开发者无需在业务代码中手写租户过滤逻辑。

**数据权限控制**

除了功能权限（RBAC），Admin.NET 还实现了数据权限——同一角色下的不同用户可能看到不同范围的数据。数据权限可配置到组织级别、用户级别或自定义 SQL 条件。

**Redis 缓存**

高频查询数据（字典、配置、用户权限）会缓存到 Redis，减少数据库压力。通过 SignalR 推送缓存变更通知，保证集群环境下缓存一致性。

**WebSocket 实时消息**

基于 SignalR 实现服务端推送：在线用户变更通知、系统消息推送、缓存同步信号都走 WebSocket 通道，前端无需轮询。

### 7.3.3 前端架构（admin-net-frontend）

前端项目的核心技术栈：

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vue** | 3.x | 渐进式 JavaScript 框架 |
| **Vite** | 5.x | 下一代前端构建工具 |
| **Element Plus** | 2.x | 面向 Vue 3 的 UI 组件库 |
| **TypeScript** | 5.x | 类型安全的 JavaScript 超集 |
| **Pinia** | 2.x | Vue 3 官方状态管理库 |
| **Vue Router** | 4.x | Vue 3 官方路由库 |

**响应式布局**

基于 Element Plus 的布局组件实现四种导航模式：侧边栏、顶部菜单、混合布局和经典模式。支持移动端适配和拖拽调整侧边栏宽度。

**动态路由（权限驱动）**

菜单不是写死在路由配置里的。用户登录后，前端向后端请求当前用户有权限的菜单列表，然后在 `vue-router` 中动态注册路由。这意味着：
- 菜单即权限——后端配置什么菜单，用户就看到什么页面
- 按钮级权限——菜单下还可以定义按钮权限，控制页面内的操作按钮显隐
- 路由守卫——未登录或权限不足时自动重定向

**Pinia 状态管理**

全局状态（用户信息、权限列表、系统配置、主题设置）统一由 Pinia 管理。按功能模块拆分为多个 Store（`useUserStore`、`usePermissionStore`、`useAppStore`），通过 Composition API 风格的组织方式保持代码清晰。

**国际化**

内置中英文双语支持，通过 `vue-i18n` 实现。所有页面文案按模块拆分到独立的语言文件中，添加新语言只需新增一个 JSON 文件。

**多主题切换**

支持亮色/暗色主题切换，通过 CSS 变量和 Element Plus 的主题定制系统实现。主题配置持久化到 localStorage。

**API 接口封装**

前端通过 Axios 封装了统一的请求/响应拦截器：自动附加 Token、自动处理 Token 过期刷新、自动解析规范化响应体。所有后端 API 按模块组织为独立的 Service 文件。

### 7.3.4 Admin.NET 的定位

Admin.NET 不是一个"玩具项目"，而是经历过多个商业项目验证的生产级框架。它的价值在于：
- **节省 80% 的重复开发工作**：用户/角色/权限/菜单/日志这些每个项目都要写的功能，Admin.NET 已经写好并优化过
- **标准化团队开发**：统一的代码风格、统一的项目结构、统一的 API 规范
- **二次开发友好**：代码生成器可以快速生成 CRUD 页面，然后手工调整复杂逻辑

### 7.3.5 适用场景

- 企业级后台管理系统（MIS、ERP、OA、CRM 等）
- SaaS 平台的后端管理端
- 需要快速交付的权限管理系统
- 作为新项目的脚手架空项目

---

## 7.4 ORM 框架

### 7.4.1 SqlSugar

#### 7.4.1.1 SqlSugar 是什么

SqlSugar 是国产 .NET ORM 框架中的标杆产品，由中国开发者创建并维护。它的核心理念是 **"让数据访问更简单、更高效、更优雅"**，通过丰富的 Lambda 表达式 API 和链式查询语法，让 .NET 开发者可以完全不写 SQL（或者只在复杂场景下写 SQL）就能完成所有数据库操作。

SqlSugar 采用 Apache-2.0 开源许可，GitHub Star 数超 15000，NuGet 下载量数百万。截止 2026 年 6 月的最新稳定版为 5.1.4.215，支持从 .NET Core 3.1 到 .NET 10 的所有版本。

#### 7.4.1.2 多数据库支持

SqlSugar 支持超过 10 种数据库，切换数据库只需修改一行连接字符串，不需要改动任何业务代码：

| 数据库 | 支持程度 | 典型场景 |
|--------|:--------:|---------|
| **SQL Server** | 完整支持 | 传统企业 Windows 服务器环境 |
| **MySQL / MariaDB** | 完整支持 | 互联网主流场景 |
| **PostgreSQL** | 完整支持 | GIS 数据库、开源优先项目 |
| **Oracle** | 完整支持 | 大型金融、政府项目 |
| **SQLite** | 完整支持 | 桌面应用、移动端、测试环境 |
| **DM（达梦）** | 完整支持 | 国产化替代（政府、军工） |
| **KDBND（人大金仓）** | 完整支持 | 国产化替代 |
| **Oscar（神通）** | 完整支持 | 国产化替代 |
| **OpenGauss** | 完整支持 | 开源国产数据库 |
| **GBase / TDengine 等** | 扩展支持 | 物联网、时序数据场景 |

这种多数据库兼容能力让 SqlSugar 成为国产化替代项目中的首选 ORM——你可以先在 SQL Server 上开发，部署时切换到达梦或人大金仓，一行业务代码都不用改。

#### 7.4.1.3 核心功能

**Code First 模式**

先定义好 C# 实体类，SqlSugar 自动生成对应的数据库表结构。支持自动迁移——当你修改实体类（新增字段、修改类型）后，SqlSugar 可以对比现有表结构并自动执行差异 SQL：

```csharp
// 定义实体
[SugarTable("sys_user")]
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDataType = "nvarchar(50)")]
    public string Name { get; set; }

    public int Age { get; set; }

    [SugarColumn(IsNullable = true)]
    public string Email { get; set; }

    public DateTime CreateTime { get; set; } = DateTime.Now;
}

// Code First 初始化
db.CodeFirst.InitTables(typeof(User));
```

**链式查询**

SqlSugar 的标志性语法是流畅的链式 API，让数据查询读起来像自然语言：

```csharp
// 基础查询
var users = db.Queryable<User>()
    .Where(u => u.Age > 18)
    .OrderBy(u => u.Id, OrderByType.Desc)
    .Select(u => new { u.Name, u.Age })
    .ToList();

// 分页查询
var page = db.Queryable<User>()
    .Where(u => u.Name.Contains("张"))
    .ToPagedList(pageIndex: 1, pageSize: 20);

// 多表联查
var result = db.Queryable<User, Order, OrderDetail>((u, o, d) =>
        new JoinQueryInfos(
            JoinType.Left, u.Id == o.UserId,
            JoinType.Left, o.Id == d.OrderId
        ))
    .Where((u, o, d) => o.Amount > 100)
    .Select((u, o, d) => new
    {
        UserName = u.Name,
        OrderNo = o.OrderNo,
        ProductName = d.ProductName,
        d.Quantity
    })
    .ToList();
```

链式查询支持所有常见的 SQL 操作：WHERE、JOIN（内连接/左连接/右连接/全连接）、GROUP BY、HAVING、子查询、UNION、CTE（公用表表达式）。

**读写分离**

配置主库（写入）和从库（读取），SqlSugar 自动将查询操作路由到从库、写操作路由到主库：

```csharp
// 配置连接
var config = new ConnectionConfig
{
    ConnectionString = masterConnStr,
    SlaveConnectionConfigs = new List<SlaveConnectionConfig>
    {
        new() { ConnectionString = slave1ConnStr, HitRate = 5 },
        new() { ConnectionString = slave2ConnStr, HitRate = 3 }
    }
};
```

支持多从库负载均衡（通过 HitRate 配置权重）和故障自动切换。

**分表分库**

大数据量场景下，SqlSugar 支持按时间（年月）、按租户 ID、按自定义规则进行分表。查询时通过 `SplitTable` 方法自动拼接多表查询：

```csharp
// 按年月分表，格式为 Order_202401, Order_202402 ...
db.Insertable(order).SplitTable().ExecuteReturnEntity();

// 查询自动跨表合并
var list = db.Queryable<Order>()
    .SplitTable(tabs => tabs.Where(y => y.Date.Year == 2024))
    .Where(o => o.Status == 1)
    .ToList();
```

**导航属性**

支持一对多、多对多的导航属性，通过 `Include` / `ThenInclude` 实现类似 EF Core 的饥饿加载：

```csharp
var user = db.Queryable<User>()
    .Includes(u => u.Orders)           // 一对多
    .Includes(u => u.Roles, u => u.Permissions) // 多对多
    .Where(u => u.Id == 1)
    .First();
```

**AOP 拦截器**

SqlSugar 内置 AOP 机制，可以在 SQL 执行前后插入自定义逻辑。常见用法包括：
- **SQL 日志记录**：拦截所有 SQL 执行，记录到日志文件或数据库
- **缓存拦截**：查询前检查缓存，命中则返回缓存数据
- **数据加密**：写入前加密敏感字段，读取后解密
- **性能监控**：记录慢查询的执行时间

```csharp
db.Aop.OnLogExecuting = (sql, pars) =>
{
    Console.WriteLine($"SQL: {sql}");
    Console.WriteLine($"Params: {string.Join(",", pars.Select(p => p.Value))}");
};
```

**事务支持**

支持声明式事务（`[UseTran]` 特性）、编程式事务、异步事务和分布式事务（基于 CAP 理论）。

#### 7.4.1.4 与其他 ORM 的对比

| 特性 | SqlSugar | EF Core | Dapper |
|------|:--------:|:-------:|:------:|
| **查询语法** | Lambda + 链式 API | LINQ | 原生 SQL |
| **多数据库切换** | 改连接串即用 | 改 Provider | 改连接串即用 |
| **Code First** | 支持 | 支持 | 不支持 |
| **分表分库** | 内置支持 | 需扩展 | 需手工实现 |
| **导航属性** | 内置支持 | 内置支持 | 需 MultiQuery |
| **性能** | 高（接近 Dapper） | 中等 | 最高 |
| **学习曲线** | 低 | 中 | 低 |
| **国产数据库** | 广泛支持 | 有限 | 依赖 ADO.NET |

### 7.4.2 SOD（PDF.NET SOD）

#### 7.4.2.1 SOD 是什么

SOD（SQL-MAP、ORM、Data Controls）是一个拥有超过 15 年历史的国产企业级数据应用开发框架。它的名称源于三大核心模块的缩写：

- **S** — SQL-MAP：基于 XML 配置的 SQL 查询映射（类似 MyBatis）
- **O** — ORM：对象关系映射 + OQL（ORM Query Language）查询语言
- **D** — Data Controls：数据窗体控件，支持 WinForm / WebForm / WPF

SOD 的设计目标是 **"对数据访问细节的全方位掌控"**。不同于 SqlSugar 的"零 SQL"理念，SOD 走了一条兼容并包的路线：你既可以使用 ORM 自动生成 SQL，也可以使用 OQL 编写类型安全的查询，还可以使用 SQL-MAP 编写手写 SQL，甚至可以三种方式混合使用。

#### 7.4.2.2 三种数据访问模式

**模式一：ORM 模式**

```csharp
// 查询单个实体
User user = db.Query<User>(1);  // 通过主键查询

// 插入
User newUser = new User { Name = "李四", Age = 25 };
db.Add(newUser);

// 更新
user.Name = "李四（修改）";
db.Update(user);
```

**模式二：OQL 查询语言**

OQL（ORM Query Language）是 SOD 独创的、类似 LINQ 但更接近 SQL 语义的查询语言：

```csharp
// OQL 查询
User user = OQL.From<User>()
    .Where(u => u.Age > 18 && u.Name.Contains("张"))
    .OrderBy(u => u.CreateTime, "desc")
    .Select()
    .ToEntity();

// OQL 支持 JOIN
var result = OQL.From<User>()
    .InnerJoin<Order>().On(u => u.Id == o.UserId)
    .Where<Order>(o => o.Amount > 500)
    .Select()
    .ToList<dynamic>();
```

OQL 的特点是 `Select()` 后面的 `.End` 或 `.ToEntity()` 作为终止符，语法风格自成一派。

**模式三：SQL-MAP 模式**

这是 SOD 最独特的特性——像 Java MyBatis 一样，将 SQL 语句写在 XML 配置文件中：

```xml
<!-- UserSQLMap.xml -->
<SqlMap>
  <Select CommandName="GetUsersByAge">
    <CommandText>
      SELECT Id, Name, Age, Email
      FROM sys_user
      WHERE Age > @MinAge
    </CommandText>
    <Parameters>
      <Param Name="MinAge" Type="int" />
    </Parameters>
  </Select>
</SqlMap>
```

```csharp
// C# 调用
var users = db.Query<User>("GetUsersByAge", new { MinAge = 18 });
```

SQL-MAP 模式的价值在于：
- **SQL 与代码分离**：DBA 可以直接优化 SQL 而无视 C# 代码
- **复杂 SQL 支持**：存储过程调用、递归 CTE、复杂的多表联查都可以写进 XML
- **热更新**：修改 XML 不需要重新编译项目

#### 7.4.2.3 SOD 与 SqlSugar 的对比

| 维度 | SqlSugar | SOD |
|------|----------|-----|
| **设计哲学** | "零 SQL"，链式 API 至上 | "全掌控"，多模式混合 |
| **主要查询方式** | Lambda 链式 | ORM / OQL / SQL-MAP 三选一 |
| **SQL 手写** | 不鼓励，但支持 | 鼓励通过 SQL-MAP 手写 |
| **XML 映射** | 不支持 | 核心特性（类似 MyBatis） |
| **历史** | 2015 年至今 | 2006 年至今 |
| **社区活跃度** | 极高（15K+ Star） | 中等 |
| **学习曲线** | 低 | 中（三种模式需要理解） |
| **最适合** | 快速开发、多数据库切换 | 金融、复杂 SQL、遗留系统迁移 |

**选择建议：**
- 如果你是 .NET 新手、项目需要快速交付——选 SqlSugar
- 如果你的系统需要复杂的手写 SQL、DBA 需要直接修改查询逻辑——选 SOD
- 如果你来自 Java 背景、习惯 MyBatis 的开发模式——SOD 的 SQL-MAP 会让你倍感亲切

---

## 7.5 Excel / 文档处理

### 7.5.1 NPOI

#### 7.5.1.1 NPOI 是什么

NPOI 是 Apache POI 项目的 .NET 移植版，由 Tony Qu（屈喆）创建，用于在 **不安装 Microsoft Office** 的情况下读写 Excel、Word、PowerPoint 文件。它完全开源免费（Apache 2.0 许可），跨平台支持 Windows、Linux、macOS，是 .NET 生态中最成熟的 Office 文件处理库。

NPOI 的名称含义：
- **N** — .NET 平台
- **POI** — 源自 Apache POI（Poor Obfuscation Implementation，对 Microsoft OLE2 格式的一种幽默称呼）

#### 7.5.1.2 支持的文件格式

| 类型 | 格式 | 扩展名 | NPOI 核心类 | 说明 |
|------|------|--------|-------------|------|
| Excel 97-2003 | BIFF8 二进制 | `.xls` | `HSSFWorkbook` | 最大 65536 行，256 列 |
| Excel 2007+ | OpenXML | `.xlsx` | `XSSFWorkbook` | 最大 1048576 行，16384 列 |
| Excel 流式写入 | OpenXML | `.xlsx` | `SXSSFWorkbook` | 大数据量导出，内存友好 |
| Word 2007+ | OpenXML | `.docx` | `XWPFDocument` | 段落、表格、图片 |
| Word 97-2003 | 二进制 | `.doc` | `HWPFDocument` | 有限支持 |
| PPT 2007+ | OpenXML | `.pptx` | `XMLSlideShow` | 幻灯片、形状、文本 |
| PPT 97-2003 | 二进制 | `.ppt` | `HSLFSlideShow` | 有限支持 |

#### 7.5.1.3 Excel 读写核心操作

**创建工作簿与工作表**

```csharp
using NPOI.XSSF.UserModel;

// 创建 .xlsx 工作簿
var workbook = new XSSFWorkbook();
var sheet = workbook.CreateSheet("员工信息表");

// 创建表头行
var headerRow = sheet.CreateRow(0);
headerRow.CreateCell(0).SetCellValue("编号");
headerRow.CreateCell(1).SetCellValue("姓名");
headerRow.CreateCell(2).SetCellValue("年龄");
headerRow.CreateCell(3).SetCellValue("入职日期");

// 填充数据行
var dataRow = sheet.CreateRow(1);
dataRow.CreateCell(0).SetCellValue(1);
dataRow.CreateCell(1).SetCellValue("张三");
dataRow.CreateCell(2).SetCellValue(28);

// 日期需要特殊处理
var dateCell = dataRow.CreateCell(3);
dateCell.SetCellValue(DateTime.Now);
var dateStyle = workbook.CreateCellStyle();
dateStyle.DataFormat = workbook.CreateDataFormat().GetFormat("yyyy-MM-dd");
dateCell.CellStyle = dateStyle;

// 保存到文件
using var fs = File.Create("员工信息.xlsx");
workbook.Write(fs);
```

**读取 Excel 文件**

```csharp
using var fs = File.OpenRead("员工信息.xlsx");
var workbook = new XSSFWorkbook(fs);
var sheet = workbook.GetSheetAt(0);

for (int row = 1; row <= sheet.LastRowNum; row++) // 跳过表头
{
    var currentRow = sheet.GetRow(row);
    if (currentRow == null) continue;

    var id = (int)currentRow.GetCell(0).NumericCellValue;
    var name = currentRow.GetCell(1).StringCellValue;
    var age = (int)currentRow.GetCell(2).NumericCellValue;
    // 处理数据...
}
```

**单元格样式**

NPOI 支持丰富的单元格样式控制：

```csharp
var style = workbook.CreateCellStyle();

// 字体
var font = workbook.CreateFont();
font.FontName = "微软雅黑";
font.FontHeightInPoints = 12;
font.IsBold = true;
font.Color = IndexedColors.White.Index;
style.SetFont(font);

// 背景色
style.FillForegroundColor = IndexedColors.DarkBlue.Index;
style.FillPattern = FillPattern.SolidForeground;

// 边框
style.BorderTop = BorderStyle.Thin;
style.BorderBottom = BorderStyle.Thin;
style.BorderLeft = BorderStyle.Thin;
style.BorderRight = BorderStyle.Thin;

// 对齐
style.Alignment = HorizontalAlignment.Center;
style.VerticalAlignment = VerticalAlignment.Center;

cell.CellStyle = style;
```

**合并单元格**

```csharp
// 合并 A1 到 D1（第 0 行，第 0 列到第 3 列）
sheet.AddMergedRegion(new CellRangeAddress(0, 0, 0, 3));
```

**公式计算**

NPOI 支持 Excel 公式的写入和求值：

```csharp
cell.SetCellFormula("SUM(A2:A10)");  // 写入公式

// 求值公式
var evaluator = new XSSFFormulaEvaluator(workbook);
var cellValue = evaluator.Evaluate(cell);
double result = cellValue.NumberValue;
```

**大数据量导出（SXSSFWorkbook）**

当需要导出几十万行数据时，`XSSFWorkbook` 会把整个表格加载到内存中，导致 OOM。`SXSSFWorkbook` 通过流式（窗口化）写入解决了这个问题：

```csharp
var workbook = new SXSSFWorkbook(100);  // 内存中只保留 100 行
var sheet = workbook.CreateSheet();

for (int i = 0; i < 500000; i++)
{
    var row = sheet.CreateRow(i);
    row.CreateCell(0).SetCellValue(i);
    // ...
}

// 写入文件
using var fs = File.Create("大数据.xlsx");
workbook.Write(fs);
workbook.Dispose();  // 清理临时文件
```

**图表**

NPOI 支持绘制折线图、柱状图、饼图等常见图表。通过 `XSSFDrawing` 在工作表上创建绘图区域，然后添加图表系列并绑定数据区域。

#### 7.5.1.4 Word 操作

```csharp
using NPOI.XWPF.UserModel;

var doc = new XWPFDocument();
var para = doc.CreateParagraph();
var run = para.CreateRun();
run.SetText("这是标题");
run.SetBold(true);
run.SetFontSize(18);

// 表格
var table = doc.CreateTable();
var row = table.GetRow(0);
row.GetCell(0).SetText("列1");
row.GetCell(1).SetText("列2");

using var fs = File.Create("文档.docx");
doc.Write(fs);
```

#### 7.5.1.5 NPOI 的适用场景

- 后台系统的数据导出（用户列表、订单报表、财务报表）
- 批量数据导入（学生成绩、员工信息、产品目录）
- 自动化报表生成（日报、周报、月报的定时生成）
- Word 模板填充（合同、通知书、证书的批量生成）
- 不需要 Microsoft Office 的服务器端文档处理

### 7.5.2 ReoGrid

#### 7.5.2.1 ReoGrid 是什么

ReoGrid 是一个开源的 .NET 电子表格控件，由 Unvell 团队开发维护。它解决了 NPOI 无法解决的问题——**在应用程序内部提供类似于 Excel 的可视化编辑体验**。

NPOI 做的是"静"——读写文件，生成一个 Excel 文件或者从一个 Excel 文件读取数据。ReoGrid 做的是"动"——在你的 WinForms 或 WPF 应用里嵌入一个完整的表格编辑器，用户可以像操作 Excel 一样编辑单元格、输入公式、设置格式、拖拽填充。

ReoGrid 的核心价值在于：

```
传统 Excel 方案                    ReoGrid 方案
─────────────────                  ─────────────────
用户打开 Excel → 编辑 → 保存       应用内嵌表格控件 → 用户直接编辑
→ 上传回系统                        → 数据直接在数据库中
依赖 Office 安装                   无需安装 Office
无法控制编辑行为                   可编程控制每个单元格的行为
```

#### 7.5.2.2 核心特性

**300+ 内置函数**

ReoGrid 的公式引擎内置了超过 300 个函数，覆盖了常用 Excel 函数的 90% 以上：

| 函数类别 | 代表函数 |
|---------|---------|
| 数学 | `SUM`, `AVERAGE`, `MAX`, `MIN`, `ROUND`, `ABS`, `MOD` |
| 统计 | `COUNT`, `COUNTA`, `COUNTIF`, `SUMIF`, `AVERAGEIF` |
| 查找 | `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH`, `INDIRECT` |
| 逻辑 | `IF`, `AND`, `OR`, `NOT`, `IFERROR`, `IFNA` |
| 文本 | `LEFT`, `RIGHT`, `MID`, `CONCATENATE`, `TRIM`, `UPPER` |
| 日期 | `TODAY`, `NOW`, `YEAR`, `MONTH`, `DAY`, `DATEDIF` |
| 财务 | `PMT`, `FV`, `NPV`, `IRR`, `RATE` |

公式引擎支持单元格引用（`=A1+B2`）、跨工作表引用（`=Sheet2!A1`）和区域引用（`=SUM(A1:A10)`）。公式改变时自动触发重算。

**自定义公式**

你可以注册自己的公式函数，扩展 ReoGrid 的计算能力：

```csharp
// 注册自定义函数：计算增值税
worksheet.RegisterFunction("VAT", (args) =>
{
    var amount = (double)args[0];
    var rate = args.Length > 1 ? (double)args[1] : 0.13;
    return amount * rate;
});
// 现在可以在单元格中使用 =VAT(A1) 或 =VAT(A1, 0.09)
```

**数据绑定**

支持将 DataTable、List、Dictionary 等数据源直接绑定到表格区域：

```csharp
var dataTable = GetUserListFromDatabase();
worksheet["A1"] = dataTable;  // 自动填充表头和所有行
```

数据绑定支持双向同步——修改单元格后数据源自动更新。

**条件格式**

根据单元格的值动态应用样式，支持数据条、色阶和图标集：

```csharp
// 销售额大于 10000 的标记为绿色
var rule = new ConditionRule
{
    Condition = new GreaterThanCondition(10000),
    Style = new WorksheetRangeStyle
    {
        Flag = PlainStyleFlag.BackColor,
        BackColor = Color.LightGreen
    }
};
worksheet.SetConditionalFormat("B2:B100", rule);
```

**冻结窗格与视图控制**

```csharp
worksheet.FreezeToCell(1, 1);  // 冻结首行和首列
```

**图表与可视化**

内置柱状图、折线图、饼图等基本图表类型，可直接嵌入表格中。

**事件处理**

```csharp
worksheet.CellDataChanged += (sender, args) =>
{
    var cell = args.Cell;
    Console.WriteLine($"单元格 {cell.Address} 的值变更为: {cell.Data}");
    // 可以在此触发数据校验或自动计算
};
```

**Excel 文件导入导出**

既可以通过 NPOI 等库实现导入导出，也可以使用 ReoGrid 自带的文件支持读写 `.xlsx` 文件（注意：是 ReoGrid 的 `.rgf` 格式和 `.xlsx` 格式）。

#### 7.5.2.3 ReoGrid 与 NPOI 的对比

| 维度 | NPOI | ReoGrid |
|------|------|---------|
| **核心功能** | 读写 Office 文件（静态） | 可视化电子表格控件（动态） |
| **使用方式** | NuGet 库，纯代码操作 | 拖拽控件到窗体 + 代码控制 |
| **UI 能力** | 无 | 完整的 Excel 式界面 |
| **公式引擎** | 支持求值但不展示 | 内置功能完整的公式引擎 |
| **用户交互** | 不支持 | 用户可直接编辑单元格 |
| **文件格式** | .xls / .xlsx / .docx / .pptx | .xlsx 读写 |
| **平台** | 任意 .NET 平台 | WinForms + WPF |
| **适用场景** | 服务端生成/解析文件 | 桌面应用内嵌表格编辑器 |

**选择建议：**
- 如果你的需求是"生成一个 Excel 文件让用户下载"——选 NPOI
- 如果你的需求是"在应用里做一个能编辑的表格界面"——选 ReoGrid
- 如果两者都需要——NPOI 负责后台文件生成，ReoGrid 负责前台表格编辑

---

## 7.6 代码保护：.NET Reactor

### 7.6.1 .NET Reactor 是什么

.NET Reactor 是由 Eziriz 公司开发的专业 .NET 代码保护和软件许可工具。它的使命是保护 .NET 程序集（EXE 和 DLL）免受反编译、逆向工程和未授权使用的威胁。

要理解 .NET Reactor 的价值，首先要理解 .NET 程序的一个"先天缺陷"：.NET 编译后的产物不是原生机器码，而是 **IL（Intermediate Language，中间语言）**字节码。IL 代码保留了类名、方法名、参数名、局部变量名等丰富的元数据——足够让反编译工具（如 ILSpy、dnSpy、dotPeek）近乎完美地还原出可读的 C# 源代码。

这意味着你辛辛苦苦写的商业逻辑、核心算法，分发给客户后，任何一个稍微懂 .NET 的人都能拿到近乎原始代码。

.NET Reactor 解决的就是这个问题。

### 7.6.2 保护技术的层次体系

.NET Reactor 提供从浅到深的多层保护机制。合理的保护策略不是"无脑全开"（会影响性能），而是根据保护需求逐层选择：

**第一层：混淆（Obfuscation）**

混淆不改变代码逻辑，但让反编译后的代码变得难以阅读。

- **重命名混淆**：将类名、方法名、变量名替换为无意义的短字符串。例如 `UserManager.GetUserById()` 被重命名为 `a.b()`。
- **控制流混淆**：对方法的 IL 代码进行控制流变换（插入无用分支、打乱顺序），让反编译器的逻辑还原彻底失效。
- **字符串加密**：代码中的字符串常量（数据库连接串、加密密钥、URL）在编译后被加密存储，运行时动态解密。
- **资源加密**：嵌入的文本资源、配置文件同样被加密。

**第二层：加密与加壳**

- **程序集加密**：将整个 DLL 加密，只有在运行时才解密加载到内存。
- **加壳（Packing）**：将多个依赖 DLL 合并为一个可执行文件，简化分发的同时增加分析难度。
- **NecroBit 技术**：将 IL 代码的关键部分转换为不可读的字节码，反编译器直接报错，而非显示混淆后的代码。这是 .NET Reactor 区别于普通混淆工具的杀手级特性。

**第三层：本地代码编译（Native Compilation）**

将 IL 方法转换为 x86/x64 原生机器码。原生代码的逆向难度远高于 IL 代码——IL 反编译工具对此完全失效，逆向工程师需要面对汇编级别的分析。

**第四层：反调试与防篡改**

- **反调试检测**：运行时检测是否被调试器附加（如 Visual Studio、dnSpy），检测到则终止或执行反制逻辑。
- **防篡改签名**：程序启动时检查自身文件哈希，如果被修改（比如注入破解代码），拒绝运行。
- **内存保护**：防止运行时代码注入和内存 dump。

### 7.6.3 许可证管理系统

.NET Reactor 不只是代码保护工具，还内置了一套完整的 **软件许可管理系统（Automation License System）**：

- **硬件锁定**：通过 CPU ID、硬盘序列号、MAC 地址等绑定到特定机器
- **试用版管理**：限制试用天数、使用次数、到期日期
- **功能授权**：不同许可证级别解锁不同功能模块
- **订阅续费**：定期验证许可证有效性
- **在线激活**：通过 Web API 激活和反激活
- **离线激活**：支持无网络环境的许可证文件激活

许可证验证逻辑被嵌入到保护后的程序集中，与代码保护协同工作——破解许可证首先需要攻破代码保护，形成双重防线。

### 7.6.4 命令行与 CI/CD 集成

.NET Reactor 提供完整的命令行接口，可以集成到 CI/CD 流水线中，实现每次构建自动保护：

```bash
# 命令行保护示例
dotnet_reactor.exe -project myapp.nrproj -build
```

`.nrproj` 是 .NET Reactor 的项目文件，保存了所有保护设置。团队可以在版本库中提交这个配置文件，确保所有开发者和 CI 环境使用一致的保护策略。

### 7.6.5 适用场景

- 商业 .NET 桌面软件（ERP、财务软件、工具软件）的保护
- Unity 游戏的反破解保护
- ISV（独立软件供应商）的许可证管理
- 企业内部工具的保护（防止员工逆向出敏感逻辑）
- 加密狗/硬件锁的软件配合保护

### 7.6.6 注意事项

- **性能折中**：越强的保护（特别是 NecroBit 和本地编译），运行时性能开销越大。建议核心算法高强度保护，UI 层轻量保护
- **调试困难**：保护后的程序几乎无法调试，保留一份未保护的版本用于测试和排错
- **杀毒软件误报**：加壳后的程序可能被杀毒软件误判为恶意软件，需要提交白名单
- **.NET 版本兼容**：确认 .NET Reactor 版本支持你使用的 .NET 版本（.NET 5/6/7/8/9/10）

---

## 7.7 C# 技能决策树

当你在 .NET 开发中遇到需求时，可以按照以下决策树快速定位应该使用哪个技能：

```
需要 C# / .NET 技能？
│
├─ 快速开发 Web API 服务
│   └─ furion
│       含：动态 API、JWT 认证、缓存、事件总线、定时任务
│
├─ 搭建后台管理系统
│   │
│   ├─ 后端（权限/用户/菜单/日志/代码生成）
│   │   └─ admin-net-backend
│   │       基于 Furion + SqlSugar + Redis + SignalR
│   │
│   └─ 前端（Vue 3 管理界面）
│       └─ admin-net-frontend
│           基于 Vue 3 + Vite + Element Plus + Pinia + TypeScript
│
├─ 数据库操作 / ORM
│   │
│   ├─ 快速开发，多数据库切换
│   │   └─ sqlsugar
│   │       链式 API、Code First、分表分库、导航属性
│   │
│   └─ 复杂 SQL，需要 SQL 与代码分离
│       └─ sod
│           SQL-MAP（类似 MyBatis）+ OQL 查询语言
│
├─ Office 文档处理
│   │
│   ├─ 批量生成/解析 Excel、Word、PPT 文件
│   │   └─ npoi
│   │       服务端读写，无需安装 Office
│   │
│   └─ 桌面应用内嵌可交互的电子表格
│       └─ reogrid
│           可视化编辑、公式引擎、WinForms / WPF
│
└─ 保护 .NET 程序不被反编译
    └─ dotnet-reactor
        混淆、NecroBit、本地编译、许可证管理
```

**常见组合方案：**

| 业务场景 | 推荐技能组合 |
|---------|------------|
| 从零搭建企业后台 | furion → admin-net-backend + admin-net-frontend |
| 已有项目，需要 ORM | sqlsugar（轻量）或 sod（重 SQL） |
| 已有项目，需要数据导出 | npoi |
| 已有项目，需要表格编辑界面 | reogrid（WinForms/WPF） |
| 产品发布前 | dotnet-reactor（代码保护 + 许可证） |
| 全栈开发自学路径 | furion → sqlsugar → admin-net-backend → npoi → dotnet-reactor |

---

## 7.8 本章小结

C# 技能分类虽然只有 8 个技能，但它们覆盖了 .NET 生态中从开发框架到生产保护的全链路。这 8 个技能不是孤岛，而是一张知识网络：

- **furion** 是 WEB 开发的"地基"，提供了动态 API、依赖注入、认证等基础设施
- **admin-net-backend** 和 **admin-net-frontend** 是在地基上建好的"毛坯房"——开箱即用的后台管理系统
- **sqlsugar** 和 **sod** 解决了最核心的数据访问问题，提供了两种不同设计理念的 ORM 方案
- **npoi** 和 **reogrid** 分别处理 Office 文档的"静态读写"和"动态编辑"，覆盖了报表和电子表格两大类需求
- **dotnet-reactor** 是"封条"，在软件交付的最后一环保障代码安全

无论你处于 .NET 开发旅程的哪个阶段——初学者通过 furion 快速上手 Web API，中级开发者通过 admin-net-backend 学习完整项目架构，高级工程师通过 sqlsugar 和 sod 理解 ORM 设计思想，商业软件作者通过 dotnet-reactor 保护成果——C# 技能分类都能提供对应的知识支撑。

下一章将进入 **GIS 技能详解**，带你深入 GDAL、GeoServer、PostGIS 等地理信息系统的核心技能。
