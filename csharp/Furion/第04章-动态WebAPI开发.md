---
layout: default
title: 第四章：动态WebAPI开发
---

# 第四章：动态WebAPI开发

## 目录

1. [动态WebAPI概述](#1-动态webapi概述)
2. [IDynamicApiController接口](#2-idynamicapicontroller接口)
3. [DynamicApiController特性标记](#3-dynamicapicontroller特性标记)
4. [路由规则与约定](#4-路由规则与约定)
5. [HTTP方法约定](#5-http方法约定)
6. [自定义路由规则](#6-自定义路由规则)
7. [API版本管理](#7-api版本管理)
8. [Swagger文档集成与配置](#8-swagger文档集成与配置)
9. [请求参数绑定](#9-请求参数绑定)
10. [返回值处理](#10-返回值处理)
11. [接口分组与标签](#11-接口分组与标签)
12. [动态WebAPI高级配置](#12-动态webapi高级配置)

---

## 1. 动态WebAPI概述

### 1.1 什么是动态WebAPI

动态WebAPI是Furion框架最核心、最具特色的功能之一。它允许开发者 **无需手动编写Controller类**，只需创建普通的服务类，框架便能在运行时自动将其转换为标准的ASP.NET Core Web API控制器。

**传统开发方式 vs Furion动态WebAPI：**

```csharp
// ============ 传统方式 ============
// 需要创建Controller，编写大量模板代码
[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetUsers()
    {
        var users = await _userService.GetUsersAsync();
        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserDto>> GetUser(int id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        return Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<int>> CreateUser(CreateUserInput input)
    {
        var id = await _userService.CreateUserAsync(input);
        return Ok(id);
    }
}

// 还需要定义Service接口和实现
public interface IUserService
{
    Task<List<UserDto>> GetUsersAsync();
    Task<UserDto> GetUserByIdAsync(int id);
    Task<int> CreateUserAsync(CreateUserInput input);
}

public class UserService : IUserService
{
    // 实现...
}
```

```csharp
// ============ Furion动态WebAPI方式 ============
// 只需一个类，自动生成API接口
public class UserService : IDynamicApiController
{
    public async Task<List<UserDto>> GetUsersAsync()
    {
        // 自动映射为 GET /api/user/users
        return await _repository.AsQueryable().ToListAsync();
    }

    public async Task<UserDto> GetUserByIdAsync(int id)
    {
        // 自动映射为 GET /api/user/user-by-id?id={id}
        return await _repository.FindAsync(id);
    }

    public async Task<int> CreateUserAsync(CreateUserInput input)
    {
        // 自动映射为 POST /api/user/create-user
        var entity = await _repository.InsertNowAsync(input.Adapt<User>());
        return entity.Entity.Id;
    }
}
```

### 1.2 动态WebAPI的优势

| 优势 | 说明 |
|------|------|
| **减少代码量** | 无需编写Controller、无需手动定义路由 |
| **消除重复** | 不再需要Controller到Service的参数传递代码 |
| **自动路由** | 根据方法名自动推断HTTP方法和路由 |
| **Swagger集成** | 自动生成完整的API文档 |
| **灵活配置** | 支持自定义路由、分组、版本等 |
| **兼容性好** | 生成的是标准ASP.NET Core控制器，完全兼容现有生态 |

### 1.3 工作原理

动态WebAPI的工作原理是在应用启动时，Furion会扫描所有实现了`IDynamicApiController`接口或标记了`[DynamicApiController]`特性的类，然后通过ASP.NET Core的`ApplicationPart`和`ApplicationModel`机制，动态将这些类注册为控制器。

```
应用启动
  │
  ├── 扫描程序集
  │   └── 查找IDynamicApiController / [DynamicApiController]
  │
  ├── 解析方法信息
  │   ├── 方法名 → HTTP方法 + 路由
  │   ├── 参数 → 请求参数绑定
  │   └── 返回值 → 响应类型
  │
  ├── 创建ControllerModel
  │   └── 注册到ASP.NET Core路由系统
  │
  └── API可用
      └── Swagger文档自动生成
```

---

## 2. IDynamicApiController接口

### 2.1 基本用法

`IDynamicApiController`是一个标记接口（Marker Interface），不包含任何方法定义，实现该接口的类会被自动识别为动态API控制器：

```csharp
using Furion.DynamicApiController;

namespace MyApp.Application.Services;

/// <summary>
/// 产品管理服务
/// </summary>
public class ProductService : IDynamicApiController
{
    /// <summary>
    /// 获取所有产品
    /// </summary>
    /// <returns>产品列表</returns>
    public List<ProductDto> GetAll()
    {
        return new List<ProductDto>
        {
            new ProductDto { Id = 1, Name = "笔记本电脑", Price = 5999 },
            new ProductDto { Id = 2, Name = "机械键盘", Price = 399 },
            new ProductDto { Id = 3, Name = "无线鼠标", Price = 129 }
        };
    }

    /// <summary>
    /// 根据ID获取产品
    /// </summary>
    /// <param name="id">产品ID</param>
    /// <returns>产品信息</returns>
    public ProductDto GetById(int id)
    {
        return new ProductDto { Id = id, Name = "示例产品", Price = 99 };
    }

    /// <summary>
    /// 创建产品
    /// </summary>
    /// <param name="input">产品信息</param>
    /// <returns>新产品ID</returns>
    public int CreateProduct(CreateProductInput input)
    {
        // 业务逻辑...
        return 1;
    }

    /// <summary>
    /// 更新产品
    /// </summary>
    /// <param name="id">产品ID</param>
    /// <param name="input">更新信息</param>
    public void UpdateProduct(int id, UpdateProductInput input)
    {
        // 业务逻辑...
    }

    /// <summary>
    /// 删除产品
    /// </summary>
    /// <param name="id">产品ID</param>
    public void DeleteProduct(int id)
    {
        // 业务逻辑...
    }
}
```

上述代码自动生成以下API接口：

| HTTP方法 | 路由 | 对应方法 |
|---------|------|---------|
| GET | `/api/product/all` | `GetAll()` |
| GET | `/api/product/by-id?id={id}` | `GetById(int id)` |
| POST | `/api/product/create-product` | `CreateProduct(...)` |
| PUT | `/api/product/update-product?id={id}` | `UpdateProduct(...)` |
| DELETE | `/api/product/delete-product?id={id}` | `DeleteProduct(...)` |

### 2.2 构造函数注入

动态API控制器完全支持构造函数依赖注入：

```csharp
public class OrderService : IDynamicApiController
{
    private readonly IRepository<Order> _orderRepo;
    private readonly ILogger<OrderService> _logger;
    private readonly IMapper _mapper;

    public OrderService(
        IRepository<Order> orderRepo,
        ILogger<OrderService> logger,
        IMapper mapper)
    {
        _orderRepo = orderRepo;
        _logger = logger;
        _mapper = mapper;
    }

    public async Task<List<OrderDto>> GetAllAsync()
    {
        _logger.LogInformation("正在查询所有订单");
        var orders = await _orderRepo.AsQueryable().ToListAsync();
        return _mapper.Map<List<OrderDto>>(orders);
    }
}
```

### 2.3 排除方法

如果不希望某个公开方法被暴露为API接口，可以使用`[NonAction]`特性：

```csharp
using Microsoft.AspNetCore.Mvc;

public class HelperService : IDynamicApiController
{
    // ✅ 这个方法会暴露为API
    public string GetVersion()
    {
        return "1.0.0";
    }

    // ❌ 这个方法不会暴露为API
    [NonAction]
    public string InternalHelper()
    {
        return "内部辅助方法";
    }
}
```

---

## 3. DynamicApiController特性标记

### 3.1 使用特性标记

除了实现`IDynamicApiController`接口外，还可以使用`[DynamicApiController]`特性来标记动态API控制器：

```csharp
using Furion.DynamicApiController;

/// <summary>
/// 使用特性标记方式
/// </summary>
[DynamicApiController]
public class CategoryService
{
    public List<string> GetCategories()
    {
        return new List<string> { "电子产品", "家居用品", "服装鞋帽" };
    }

    public string GetCategory(int id)
    {
        return $"分类 {id}";
    }
}
```

### 3.2 两种方式的对比

| 特性 | IDynamicApiController接口 | [DynamicApiController]特性 |
|------|--------------------------|---------------------------|
| 使用方式 | 实现接口 | 添加特性 |
| 侵入性 | 需要引用Furion | 需要引用Furion |
| 继承传递 | 子类自动继承 | 子类不自动继承 |
| 适用场景 | 推荐用于标准服务类 | 适用于不想改变继承关系的类 |
| 语义性 | 语义更强 | 更灵活 |

### 3.3 基类方式

可以创建一个基类来统一实现`IDynamicApiController`接口：

```csharp
/// <summary>
/// 应用服务基类
/// </summary>
public abstract class BaseAppService : IDynamicApiController
{
    /// <summary>
    /// 获取当前登录用户ID
    /// </summary>
    protected long CurrentUserId => App.User?.FindFirst("UserId")?.Value.ToLong() ?? 0;

    /// <summary>
    /// 获取当前租户ID
    /// </summary>
    protected long CurrentTenantId => App.User?.FindFirst("TenantId")?.Value.ToLong() ?? 0;
}

/// <summary>
/// 订单服务 - 继承基类，自动成为动态API
/// </summary>
public class OrderAppService : BaseAppService
{
    public List<OrderDto> GetMyOrders()
    {
        var userId = CurrentUserId;
        // 查询当前用户的订单...
        return new List<OrderDto>();
    }
}
```

---

## 4. 路由规则与约定

### 4.1 默认路由规则

Furion的动态WebAPI有一套完善的默认路由生成规则：

**规则1：控制器名称**

类名会被自动处理为路由前缀：
- 移除常见后缀：`Service`、`AppService`、`Application`
- 转换为小写kebab-case格式

```
UserService          → /api/user/...
ProductAppService    → /api/product/...
OrderApplication     → /api/order/...
CategoryService      → /api/category/...
```

**规则2：方法名称转换**

方法名会经过以下处理：
- 移除HTTP方法前缀（Get、Post、Put、Delete等）
- 移除Async后缀
- 转换为小写kebab-case格式

```csharp
public class UserService : IDynamicApiController
{
    // GET /api/user/all
    public List<User> GetAll() { }

    // GET /api/user/by-id
    public User GetById(int id) { }

    // POST /api/user
    public void Post(CreateUserInput input) { }

    // PUT /api/user/info
    public void UpdateInfo(UpdateUserInput input) { }

    // DELETE /api/user
    public void Delete(int id) { }

    // GET /api/user/active-users（异步方法自动移除Async后缀）
    public Task<List<User>> GetActiveUsersAsync() { }
}
```

### 4.2 路由转换规则详解

| 方法名 | 转换后路由 | HTTP方法 |
|--------|-----------|---------|
| `GetAll` | `/all` | GET |
| `GetById` | `/by-id` | GET |
| `GetUserInfo` | `/user-info` | GET |
| `PostUser` | `/user` | POST |
| `CreateOrder` | `/create-order` | POST |
| `UpdateUserName` | `/update-user-name` | PUT |
| `DeleteById` | `/by-id` | DELETE |
| `GetActiveUsersAsync` | `/active-users` | GET |
| `Post` | `/` | POST |
| `Get` | `/` | GET |

### 4.3 PascalCase到kebab-case的转换

Furion会自动将方法名从PascalCase转换为kebab-case：

```
GetUserList       → get-user-list    → /api/user/user-list (去掉Get前缀)
CreateNewOrder    → create-new-order → /api/order/create-new-order
FindByNameAndAge  → find-by-name-and-age
UpdateUserProfile → update-user-profile
```

### 4.4 默认路由模板

默认的路由模板为：

```
api/[controller]/[action]
```

其中：
- `api` 是固定前缀
- `[controller]` 是控制器名称（类名去掉后缀）
- `[action]` 是操作名称（方法名去掉HTTP前缀）

---

## 5. HTTP方法约定

### 5.1 方法名前缀约定

Furion通过方法名的前缀来自动推断HTTP方法：

| 方法名前缀 | 对应HTTP方法 | 常见用途 |
|-----------|-------------|---------|
| `Get`、`Find`、`Fetch`、`Query`、`Search` | **GET** | 查询数据 |
| `Post`、`Create`、`Add`、`Insert`、`Submit` | **POST** | 创建数据 |
| `Put`、`Update`、`Modify`、`Change`、`Edit` | **PUT** | 更新数据 |
| `Delete`、`Remove`、`Clear`、`Cancel` | **DELETE** | 删除数据 |
| `Patch` | **PATCH** | 部分更新 |

```csharp
public class ArticleService : IDynamicApiController
{
    // ===== GET 方法 =====
    public List<Article> GetAll() { }              // GET /api/article/all
    public Article FindById(int id) { }            // GET /api/article/by-id
    public List<Article> FetchLatest() { }         // GET /api/article/latest
    public List<Article> QueryByCategory(int c) {} // GET /api/article/by-category
    public List<Article> SearchByTitle(string t) {} // GET /api/article/by-title

    // ===== POST 方法 =====
    public int CreateArticle(ArticleInput i) { }   // POST /api/article/article
    public int AddComment(CommentInput i) { }      // POST /api/article/comment
    public void SubmitReview(int id) { }            // POST /api/article/review

    // ===== PUT 方法 =====
    public void UpdateTitle(int id, string t) { }  // PUT /api/article/title
    public void ModifyContent(int id, string c) { } // PUT /api/article/content
    public void EditArticle(ArticleInput i) { }     // PUT /api/article/article

    // ===== DELETE 方法 =====
    public void DeleteArticle(int id) { }           // DELETE /api/article/article
    public void RemoveComment(int id) { }           // DELETE /api/article/comment
    public void ClearDrafts() { }                    // DELETE /api/article/drafts
}
```

### 5.2 显式指定HTTP方法

如果默认约定不满足需求，可以使用ASP.NET Core的HTTP方法特性显式指定：

```csharp
using Microsoft.AspNetCore.Mvc;

public class PaymentService : IDynamicApiController
{
    // 显式指定为POST（虽然以Get开头）
    [HttpPost]
    public PaymentResult GetPaymentUrl(PaymentInput input)
    {
        // 获取支付链接通常需要POST
        return new PaymentResult { Url = "https://pay.example.com/..." };
    }

    // 显式指定为GET（虽然以Check开头，默认会是POST）
    [HttpGet]
    public bool CheckPaymentStatus(string orderId)
    {
        return true;
    }

    // 方法名不以约定前缀开头时，默认为POST
    // 可以显式指定为其他方法
    [HttpPut]
    public void Process(int orderId)
    {
        // 处理订单
    }
}
```

### 5.3 无前缀方法名的默认行为

如果方法名不以任何约定前缀开头，Furion默认将其视为 **POST** 方法：

```csharp
public class TaskService : IDynamicApiController
{
    public void Execute(int taskId) { }       // POST /api/task/execute
    public string Process(string data) { }    // POST /api/task/process
    public bool Validate(ValidateInput i) { } // POST /api/task/validate
}
```

---

## 6. 自定义路由规则

### 6.1 使用ApiDescriptionSettings自定义控制器路由

`[ApiDescriptionSettings]`特性允许自定义控制器级别的路由配置：

```csharp
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

// 自定义控制器名称
[ApiDescriptionSettings(Name = "Users")]
public class UserManagementService : IDynamicApiController
{
    // 生成路由：GET /api/users/list 而不是 /api/user-management/list
    public List<UserDto> GetList() { return new(); }
}

// 自定义路由前缀
[ApiDescriptionSettings(Name = "Admin/Users")]
public class AdminUserService : IDynamicApiController
{
    // 生成路由：GET /api/admin/users/list
    public List<UserDto> GetList() { return new(); }
}
```

### 6.2 使用Route特性自定义路由

可以使用ASP.NET Core标准的`[Route]`特性来完全控制路由：

```csharp
public class CustomRouteService : IDynamicApiController
{
    // 完全自定义路由
    [HttpGet("api/v1/users/{id}")]
    public UserDto GetUserById(int id)
    {
        return new UserDto { Id = id, Name = "自定义路由用户" };
    }

    // 使用路由模板参数
    [HttpGet("api/departments/{deptId}/users")]
    public List<UserDto> GetDepartmentUsers(int deptId)
    {
        return new List<UserDto>();
    }

    // 多路由映射到同一方法
    [HttpGet("api/users/search")]
    [HttpGet("api/users/find")]
    public List<UserDto> SearchUsers(string keyword)
    {
        return new List<UserDto>();
    }
}
```

### 6.3 配置全局路由前缀

在`appsettings.json`中可以配置全局路由前缀：

```json
{
  "DynamicApiControllerSettings": {
    "DefaultRoutePrefix": "api",
    "DefaultHttpMethod": "POST",
    "LowercaseRoute": true,
    "KeepVerb": false,
    "KeepName": false,
    "AsLowerCamelCase": false,
    "SplitCamelCase": true,
    "AbandonControllerAffixes": ["Service", "AppService", "Application"],
    "AbandonActionAffixes": ["Async"]
  }
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DefaultRoutePrefix` | `"api"` | 全局路由前缀 |
| `DefaultHttpMethod` | `"POST"` | 无法推断HTTP方法时的默认方法 |
| `LowercaseRoute` | `true` | 路由是否转为小写 |
| `KeepVerb` | `false` | 是否保留方法名中的HTTP动词前缀 |
| `KeepName` | `false` | 是否保留完整方法名 |
| `SplitCamelCase` | `true` | 是否将PascalCase拆分为kebab-case |
| `AbandonControllerAffixes` | `[...]` | 要移除的控制器名称后缀 |
| `AbandonActionAffixes` | `["Async"]` | 要移除的方法名后缀 |

### 6.4 路由规则示例对照

```csharp
public class ProductService : IDynamicApiController
{
    // KeepVerb=false（默认）: GET /api/product/list
    // KeepVerb=true:         GET /api/product/get-list
    public List<Product> GetList() { }

    // KeepName=false（默认）: POST /api/product/product
    // KeepName=true:         POST /api/product/create-product
    public int CreateProduct(ProductInput input) { }

    // SplitCamelCase=true（默认）: GET /api/product/by-category-id
    // SplitCamelCase=false:        GET /api/product/bycategoryid
    public List<Product> GetByCategoryId(int categoryId) { }
}
```

---

## 7. API版本管理

### 7.1 基于路由的版本管理

```csharp
// V1版本
[ApiDescriptionSettings(Name = "v1/User")]
public class UserServiceV1 : IDynamicApiController
{
    // GET /api/v1/user/info
    public UserDto GetInfo(int id)
    {
        return new UserDto { Id = id, Name = "V1接口" };
    }
}

// V2版本
[ApiDescriptionSettings(Name = "v2/User")]
public class UserServiceV2 : IDynamicApiController
{
    // GET /api/v2/user/info
    public UserDtoV2 GetInfo(int id)
    {
        return new UserDtoV2 { Id = id, Name = "V2接口", Avatar = "avatar.png" };
    }
}
```

### 7.2 基于分组的版本管理

```csharp
// V1分组
[ApiDescriptionSettings("V1")]
public class UserServiceV1 : IDynamicApiController
{
    public UserDto GetInfo(int id) { return new(); }
}

// V2分组
[ApiDescriptionSettings("V2")]
public class UserServiceV2 : IDynamicApiController
{
    public UserDtoV2 GetInfo(int id) { return new(); }
}
```

在Swagger中会根据分组分别显示不同版本的接口。

### 7.3 集成ASP.NET Core API版本控制

```csharp
// 安装版本控制包
// dotnet add package Microsoft.AspNetCore.Mvc.Versioning

// 在Startup中配置
services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
});
```

---

## 8. Swagger文档集成与配置

### 8.1 基本Swagger配置

Furion通过`AddInject()`和`UseInject()`自动集成了Swagger。默认配置下，访问应用根路径即可看到Swagger UI。

### 8.2 详细Swagger配置

```json
// appsettings.json
{
  "SpecificationDocumentSettings": {
    "DocumentTitle": "MyApp API 文档",
    "DefaultGroupName": "Default",
    "FormatAsV2": false,
    "DocExpansionState": "List",
    "XmlComments": true,
    "RoutePrefix": "api-docs",
    "ServerDir": "",
    "LoginInfo": {
      "Enabled": true
    },
    "GroupOpenApiInfos": [
      {
        "Group": "Default",
        "Title": "通用接口",
        "Description": "通用业务接口",
        "Version": "v1.0",
        "TermsOfService": "https://furion.net",
        "Contact": {
          "Name": "开发团队",
          "Email": "dev@example.com",
          "Url": "https://example.com"
        }
      },
      {
        "Group": "System",
        "Title": "系统管理接口",
        "Description": "系统管理和配置相关接口",
        "Version": "v1.0"
      }
    ],
    "EnableAuthorized": true,
    "SecurityDefinitions": [
      {
        "Id": "Bearer",
        "Type": "Http",
        "Name": "Authorization",
        "Description": "JWT授权。在下方输入Token（不需要加Bearer前缀）",
        "BearerFormat": "JWT",
        "Scheme": "bearer",
        "In": "Header"
      }
    ]
  }
}
```

### 8.3 XML注释显示

确保在所有包含动态API的项目中启用XML文档生成：

```xml
<!-- 在每个项目的.csproj中添加 -->
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);1591</NoWarn>
</PropertyGroup>
```

```csharp
/// <summary>
/// 订单管理服务
/// </summary>
public class OrderService : IDynamicApiController
{
    /// <summary>
    /// 创建订单
    /// </summary>
    /// <remarks>
    /// 请求示例:
    ///
    ///     POST /api/order/create
    ///     {
    ///         "productId": 1,
    ///         "quantity": 2,
    ///         "address": "北京市朝阳区"
    ///     }
    ///
    /// </remarks>
    /// <param name="input">订单创建参数</param>
    /// <returns>订单编号</returns>
    /// <response code="200">创建成功</response>
    /// <response code="400">参数验证失败</response>
    public string CreateOrder(CreateOrderInput input)
    {
        return "ORD20240115001";
    }
}
```

---

## 9. 请求参数绑定

### 9.1 参数绑定特性

Furion支持ASP.NET Core的所有参数绑定方式：

| 特性 | 说明 | 适用场景 |
|------|------|---------|
| `[FromQuery]` | 从URL查询字符串获取 | GET请求的简单参数 |
| `[FromBody]` | 从请求体获取 | POST/PUT的复杂对象 |
| `[FromRoute]` | 从路由模板获取 | 路径参数 |
| `[FromHeader]` | 从请求头获取 | 认证信息、自定义头 |
| `[FromForm]` | 从表单数据获取 | 文件上传、表单提交 |

### 9.2 默认绑定规则

Furion对不同HTTP方法有不同的默认参数绑定规则：

```csharp
public class BindingDemoService : IDynamicApiController
{
    // GET方法：简单类型默认从Query获取
    // GET /api/binding-demo/user?id=1&name=张三
    public UserDto GetUser(int id, string name)
    {
        // id 和 name 自动从QueryString获取
        return new UserDto { Id = id, Name = name };
    }

    // POST方法：复杂类型默认从Body获取
    // POST /api/binding-demo/user
    // Body: { "name": "张三", "email": "..." }
    public int CreateUser(CreateUserInput input)
    {
        // input 自动从RequestBody获取
        return 1;
    }

    // PUT方法：复杂类型默认从Body获取
    // PUT /api/binding-demo/user?id=1
    // Body: { "name": "新名称" }
    public void UpdateUser(int id, UpdateUserInput input)
    {
        // id 从QueryString获取
        // input 从RequestBody获取
    }
}
```

### 9.3 显式指定参数绑定

```csharp
using Microsoft.AspNetCore.Mvc;

public class ExplicitBindingService : IDynamicApiController
{
    // 从路由获取参数
    [HttpGet("api/users/{userId}/orders/{orderId}")]
    public OrderDto GetOrder(
        [FromRoute] int userId,
        [FromRoute] int orderId)
    {
        return new OrderDto();
    }

    // 从请求头获取参数
    [HttpGet]
    public UserDto GetCurrentUser(
        [FromHeader(Name = "Authorization")] string token,
        [FromHeader(Name = "X-Tenant-Id")] string tenantId)
    {
        return new UserDto();
    }

    // 混合绑定
    [HttpPost("api/products/{categoryId}")]
    public int CreateProduct(
        [FromRoute] int categoryId,
        [FromQuery] string source,
        [FromBody] CreateProductInput input)
    {
        return 1;
    }

    // 文件上传
    [HttpPost]
    public string UploadFile(
        [FromForm] string description,
        [FromForm] IFormFile file)
    {
        return file.FileName;
    }
}
```

### 9.4 复杂查询参数

```csharp
// 分页查询DTO
public class PagedQueryInput
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string Keyword { get; set; }
    public string OrderBy { get; set; }
    public bool IsDesc { get; set; }
}

public class UserQueryService : IDynamicApiController
{
    // GET /api/user-query/paged?pageIndex=1&pageSize=20&keyword=张
    // 复杂类型在GET方法中需要显式标记[FromQuery]
    public PagedResult<UserDto> GetPaged([FromQuery] PagedQueryInput input)
    {
        return new PagedResult<UserDto>
        {
            Total = 100,
            PageIndex = input.PageIndex,
            PageSize = input.PageSize,
            Items = new List<UserDto>()
        };
    }
}
```

---

## 10. 返回值处理

### 10.1 基本返回类型

Furion的动态WebAPI支持各种返回类型：

```csharp
public class ReturnDemoService : IDynamicApiController
{
    // 返回简单类型
    public string GetString() => "Hello";
    public int GetNumber() => 42;
    public bool GetBool() => true;

    // 返回对象
    public UserDto GetUser()
    {
        return new UserDto { Id = 1, Name = "张三" };
    }

    // 返回集合
    public List<UserDto> GetUsers()
    {
        return new List<UserDto>();
    }

    // 返回匿名对象
    public object GetDashboard()
    {
        return new
        {
            UserCount = 1000,
            OrderCount = 5000,
            Revenue = 1234567.89
        };
    }

    // 无返回值（void）
    public void PostAction()
    {
        // 返回204 No Content
    }

    // 返回Task
    public async Task PostAsyncAction()
    {
        await Task.Delay(100);
    }

    // 返回Task<T>
    public async Task<UserDto> GetUserAsync()
    {
        return await Task.FromResult(new UserDto());
    }
}
```

### 10.2 规范化结果

Furion提供了规范化结果功能，将所有API返回值包装为统一格式：

```csharp
// 启用规范化结果
services.AddControllers()
    .AddInject();

// 规范化返回格式示例：
// {
//     "statusCode": 200,
//     "succeeded": true,
//     "data": { ... },       // 实际返回数据
//     "errors": null,
//     "extras": null,
//     "timestamp": 1705312000
// }
```

自定义规范化结果提供器：

```csharp
using Furion.DataValidation;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

/// <summary>
/// 自定义规范化结果提供器
/// </summary>
[UnifyModel(typeof(ApiResult<>))]
public class CustomResultProvider : IUnifyResultProvider
{
    public IActionResult OnSucceeded(ActionExecutedContext context, object data)
    {
        return new JsonResult(new ApiResult<object>
        {
            Code = 200,
            Success = true,
            Message = "请求成功",
            Data = data
        });
    }

    public IActionResult OnValidateFailed(ActionExecutingContext context, ValidationMetadata metadata)
    {
        return new JsonResult(new ApiResult<object>
        {
            Code = 400,
            Success = false,
            Message = metadata.Message,
            Data = null
        });
    }

    public async Task OnResponseStatusCodes(HttpContext context, int statusCode, UnifyResultSettingsOptions unifyResultSettings = null)
    {
        switch (statusCode)
        {
            case 401:
                await context.Response.WriteAsJsonAsync(new ApiResult<object>
                {
                    Code = 401,
                    Success = false,
                    Message = "未授权",
                    Data = null
                });
                break;
            case 403:
                await context.Response.WriteAsJsonAsync(new ApiResult<object>
                {
                    Code = 403,
                    Success = false,
                    Message = "禁止访问",
                    Data = null
                });
                break;
        }
    }

    public IActionResult OnException(ExceptionContext context, ExceptionMetadata metadata)
    {
        return new JsonResult(new ApiResult<object>
        {
            Code = 500,
            Success = false,
            Message = metadata.Message,
            Data = null
        });
    }
}

/// <summary>
/// 统一返回结果模型
/// </summary>
public class ApiResult<T>
{
    public int Code { get; set; }
    public bool Success { get; set; }
    public string Message { get; set; }
    public T Data { get; set; }
}
```

### 10.3 跳过规范化结果

某些接口不需要规范化结果包装时，可以使用特性跳过：

```csharp
using Furion.UnifyResult;

public class FileService : IDynamicApiController
{
    // 文件下载不需要规范化结果包装
    [NonUnify]
    [HttpGet]
    public IActionResult DownloadFile(string fileName)
    {
        var bytes = System.IO.File.ReadAllBytes($"uploads/{fileName}");
        return new FileContentResult(bytes, "application/octet-stream")
        {
            FileDownloadName = fileName
        };
    }

    // 健康检查不需要包装
    [NonUnify]
    public string HealthCheck() => "OK";
}
```

---

## 11. 接口分组与标签

### 11.1 使用ApiDescriptionSettings分组

```csharp
// 系统管理分组
[ApiDescriptionSettings("System", Name = "SysUser", Order = 1)]
public class SysUserService : IDynamicApiController
{
    /// <summary>
    /// 获取系统用户列表
    /// </summary>
    public List<UserDto> GetList() => new();

    /// <summary>
    /// 创建系统用户
    /// </summary>
    public int Create(CreateUserInput input) => 1;
}

// 业务管理分组
[ApiDescriptionSettings("Business", Name = "Order", Order = 1)]
public class OrderService : IDynamicApiController
{
    /// <summary>
    /// 获取订单列表
    /// </summary>
    public List<OrderDto> GetList() => new();
}

// 报表分组
[ApiDescriptionSettings("Report", Name = "SalesReport", Order = 1)]
public class SalesReportService : IDynamicApiController
{
    /// <summary>
    /// 获取销售报表
    /// </summary>
    public object GetSalesReport() => new { };
}
```

### 11.2 Swagger分组配置

```json
{
  "SpecificationDocumentSettings": {
    "GroupOpenApiInfos": [
      {
        "Group": "Default",
        "Title": "默认分组",
        "Description": "未分类的接口",
        "Version": "v1.0"
      },
      {
        "Group": "System",
        "Title": "系统管理",
        "Description": "系统管理相关接口，包括用户、角色、菜单等",
        "Version": "v1.0"
      },
      {
        "Group": "Business",
        "Title": "业务管理",
        "Description": "核心业务相关接口",
        "Version": "v1.0"
      },
      {
        "Group": "Report",
        "Title": "报表统计",
        "Description": "数据报表和统计分析接口",
        "Version": "v1.0"
      }
    ]
  }
}
```

### 11.3 方法级别的分组

```csharp
public class MixedService : IDynamicApiController
{
    // 同一个服务中的方法可以属于不同分组
    [ApiDescriptionSettings("System")]
    public string GetSystemInfo() => "系统信息";

    [ApiDescriptionSettings("Business")]
    public string GetBusinessData() => "业务数据";

    // 可以同时出现在多个分组中
    [ApiDescriptionSettings("System,Business")]
    public string GetCommonData() => "公共数据";
}
```

### 11.4 排序控制

```csharp
// 通过Order控制接口在Swagger中的显示顺序
[ApiDescriptionSettings("System", Order = 1)]  // 第一个显示
public class UserService : IDynamicApiController { }

[ApiDescriptionSettings("System", Order = 2)]  // 第二个显示
public class RoleService : IDynamicApiController { }

[ApiDescriptionSettings("System", Order = 3)]  // 第三个显示
public class MenuService : IDynamicApiController { }
```

---

## 12. 动态WebAPI高级配置

### 12.1 控制器命名规则配置

```csharp
// 自定义控制器名称
[ApiDescriptionSettings(
    Name = "UserMgmt",           // 自定义名称
    Tag = "用户管理",             // Swagger标签
    Order = 1,                   // 排序
    Description = "用户管理相关接口" // 描述
)]
public class UserManagementService : IDynamicApiController
{
    public List<UserDto> GetList() => new();
}
```

### 12.2 隐藏接口

```csharp
public class InternalService : IDynamicApiController
{
    // 公开接口
    public string GetPublicData() => "公开数据";

    // 隐藏接口（在Swagger中不显示，但仍可访问）
    [ApiDescriptionSettings(false)]
    public string GetHiddenData() => "隐藏数据";
}
```

### 12.3 自定义模型绑定

```csharp
// 自定义日期格式绑定
public class DateRangeInput
{
    [ModelBinder(BinderType = typeof(DateTimeModelBinder))]
    public DateTime StartDate { get; set; }

    [ModelBinder(BinderType = typeof(DateTimeModelBinder))]
    public DateTime EndDate { get; set; }
}
```

### 12.4 动态WebAPI与传统Controller共存

Furion的动态WebAPI可以与传统的ASP.NET Core Controller共存，互不影响：

```csharp
// 传统Controller
[ApiController]
[Route("api/[controller]")]
public class LegacyController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok("传统Controller");
}

// 动态WebAPI
public class ModernService : IDynamicApiController
{
    public string GetData() => "动态WebAPI";
}

// 两者可以在同一个项目中同时使用
// GET /api/legacy         → 传统Controller
// GET /api/modern/data    → 动态WebAPI
```

### 12.5 性能优化建议

| 建议 | 说明 |
|------|------|
| 合理使用异步方法 | IO密集型操作使用`async/await` |
| 避免大对象返回 | 使用分页和投影减少返回数据量 |
| 利用缓存 | 频繁查询的数据使用缓存 |
| 压缩响应 | 启用gzip/brotli压缩 |
| 限制请求大小 | 配置最大请求体大小 |

```csharp
// 异步方法示例
public class OptimizedService : IDynamicApiController
{
    private readonly IRepository<Product> _repo;
    private readonly IMemoryCache _cache;

    public OptimizedService(IRepository<Product> repo, IMemoryCache cache)
    {
        _repo = repo;
        _cache = cache;
    }

    /// <summary>
    /// 分页查询（高性能）
    /// </summary>
    public async Task<PagedResult<ProductDto>> GetPagedAsync([FromQuery] PagedInput input)
    {
        var cacheKey = $"products:{input.PageIndex}:{input.PageSize}:{input.Keyword}";

        return await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);

            var query = _repo.AsQueryable();

            if (!string.IsNullOrEmpty(input.Keyword))
            {
                query = query.Where(p => p.Name.Contains(input.Keyword));
            }

            var total = await query.CountAsync();
            var items = await query
                .Skip((input.PageIndex - 1) * input.PageSize)
                .Take(input.PageSize)
                .Select(p => new ProductDto { Id = p.Id, Name = p.Name })
                .ToListAsync();

            return new PagedResult<ProductDto>
            {
                Total = total,
                Items = items
            };
        });
    }
}
```

---

## 总结

本章全面介绍了Furion动态WebAPI的开发方法，这是Furion框架最核心的特色功能。通过动态WebAPI，开发者可以大幅减少样板代码，专注于业务逻辑的实现。

关键要点：

- **实现`IDynamicApiController`接口**或使用`[DynamicApiController]`特性即可创建动态API
- **方法名前缀约定**自动推断HTTP方法（Get→GET, Create→POST, Update→PUT, Delete→DELETE）
- **路由自动生成**遵循`api/[controller]/[action]`的模板，支持kebab-case转换
- **参数绑定**遵循HTTP方法的默认规则，也可以显式指定
- **规范化结果**提供统一的API返回格式
- **接口分组**通过`ApiDescriptionSettings`实现，方便API文档组织

> **下一章预告**：第五章将详细介绍Furion的依赖注入与服务注册机制，包括接口标记注入、构造函数注入、属性注入等多种注入方式。
