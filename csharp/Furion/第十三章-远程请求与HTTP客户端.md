# 第十三章：远程请求与HTTP客户端

## 一、HttpClient 基础

### 1.1 .NET HttpClient 概述

在现代微服务和分布式架构中，服务间的 HTTP 通信是必不可少的。.NET 提供了 `HttpClient` 类用于发送 HTTP 请求，而 Furion 在此基础上进行了大量增强，提供了更简洁、更强大的远程请求方式。

### 1.2 原生 HttpClient 的问题

| 问题 | 说明 |
|------|------|
| 套接字耗尽 | 频繁创建/销毁 HttpClient 可能导致端口耗尽 |
| DNS 更新 | 单例 HttpClient 不会更新 DNS 解析结果 |
| 配置繁琐 | 每次请求需手动设置请求头、序列化等 |
| 缺少拦截器 | 不支持统一的请求/响应拦截 |
| 重试困难 | 没有内置的重试机制 |

### 1.3 IHttpClientFactory

.NET 推荐使用 `IHttpClientFactory` 管理 HttpClient 实例：

```csharp
// 注册 HttpClient
builder.Services.AddHttpClient();

// 使用命名客户端
builder.Services.AddHttpClient("GitHubApi", client =>
{
    client.BaseAddress = new Uri("https://api.github.com/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.DefaultRequestHeaders.Add("User-Agent", "FurionApp");
});
```

## 二、Furion 远程请求增强

### 2.1 注册远程请求服务

```csharp
var builder = WebApplication.CreateBuilder(args);

// 注册 Furion 远程请求服务
builder.Services.AddRemoteRequest();

var app = builder.Build();
app.Run();
```

### 2.2 基本使用方式

Furion 提供了多种远程请求方式：

| 方式 | 说明 | 适用场景 |
|------|------|---------|
| 字符串扩展方法 | 直接在 URL 字符串上调用 | 快速简单请求 |
| IHttpDispatchProxy | 接口代理方式 | 微服务间通信 |
| HttpClient 增强 | 增强版 HttpClient | 需要完全控制 |

```csharp
// 方式1：字符串扩展方法（最简洁）
var result = await "https://api.example.com/users".GetAsAsync<List<UserDto>>();

// 方式2：POST 请求
var user = await "https://api.example.com/users".SetBody(new { Name = "张三", Age = 25 })
    .PostAsAsync<UserDto>();

// 方式3：带请求头
var data = await "https://api.example.com/data"
    .SetHeaders(new Dictionary<string, object>
    {
        { "Authorization", "Bearer xxx" },
        { "X-Request-Id", Guid.NewGuid().ToString() }
    })
    .GetAsAsync<DataDto>();
```

## 三、IHttpDispatchProxy 接口代理

### 3.1 声明式 HTTP 请求

`IHttpDispatchProxy` 允许通过定义接口来声明 HTTP 请求，类似于 Java 中的 Feign：

```csharp
/// <summary>
/// 用户服务 HTTP 代理接口
/// </summary>
public interface IUserServiceApi : IHttpDispatchProxy
{
    /// <summary>
    /// 获取用户列表
    /// </summary>
    [Get("https://api.userservice.com/api/users")]
    Task<List<UserDto>> GetUsersAsync();

    /// <summary>
    /// 根据Id获取用户
    /// </summary>
    [Get("https://api.userservice.com/api/users/{id}")]
    Task<UserDto> GetUserByIdAsync([RouteParam] long id);

    /// <summary>
    /// 创建用户
    /// </summary>
    [Post("https://api.userservice.com/api/users")]
    Task<UserDto> CreateUserAsync([Body] CreateUserInput input);

    /// <summary>
    /// 更新用户
    /// </summary>
    [Put("https://api.userservice.com/api/users/{id}")]
    Task<UserDto> UpdateUserAsync([RouteParam] long id, [Body] UpdateUserInput input);

    /// <summary>
    /// 删除用户
    /// </summary>
    [Delete("https://api.userservice.com/api/users/{id}")]
    Task DeleteUserAsync([RouteParam] long id);
}
```

### 3.2 使用接口代理

```csharp
[ApiDescriptionSettings("用户管理")]
public class UserAppService : IDynamicApiController
{
    private readonly IUserServiceApi _userServiceApi;

    public UserAppService(IUserServiceApi userServiceApi)
    {
        _userServiceApi = userServiceApi;
    }

    /// <summary>
    /// 获取所有用户
    /// </summary>
    public async Task<List<UserDto>> GetUsers()
    {
        return await _userServiceApi.GetUsersAsync();
    }

    /// <summary>
    /// 获取用户详情
    /// </summary>
    public async Task<UserDto> GetUser(long id)
    {
        return await _userServiceApi.GetUserByIdAsync(id);
    }

    /// <summary>
    /// 创建用户
    /// </summary>
    public async Task<UserDto> CreateUser(CreateUserInput input)
    {
        return await _userServiceApi.CreateUserAsync(input);
    }
}
```

### 3.3 配置基础地址

通过 `appsettings.json` 配置服务地址，避免硬编码：

```json
{
  "RemoteRequest": {
    "UserService": {
      "BaseUrl": "https://api.userservice.com",
      "Timeout": 30
    },
    "OrderService": {
      "BaseUrl": "https://api.orderservice.com",
      "Timeout": 60
    }
  }
}
```

```csharp
/// <summary>
/// 使用配置的基础地址
/// </summary>
[Client("UserService")]
public interface IUserServiceApi : IHttpDispatchProxy
{
    [Get("/api/users")]
    Task<List<UserDto>> GetUsersAsync();

    [Get("/api/users/{id}")]
    Task<UserDto> GetUserByIdAsync([RouteParam] long id);

    [Post("/api/users")]
    Task<UserDto> CreateUserAsync([Body] CreateUserInput input);
}
```

## 四、RESTful 请求详解

### 4.1 GET 请求

```csharp
// 简单 GET 请求
var users = await "https://api.example.com/users".GetAsAsync<List<UserDto>>();

// 带查询参数
var result = await "https://api.example.com/users"
    .SetQueries(new
    {
        page = 1,
        pageSize = 20,
        keyword = "张三",
        status = "active"
    })
    .GetAsAsync<PagedResult<UserDto>>();

// 带请求头的 GET
var data = await "https://api.example.com/protected/data"
    .SetHeaders(new Dictionary<string, object>
    {
        { "Authorization", $"Bearer {token}" }
    })
    .GetAsAsync<ProtectedData>();

// 获取原始字符串
var rawJson = await "https://api.example.com/users".GetAsStringAsync();

// 获取 HttpResponseMessage
var response = await "https://api.example.com/users".GetAsync();
```

### 4.2 POST 请求

```csharp
// JSON Body
var newUser = await "https://api.example.com/users"
    .SetBody(new CreateUserInput
    {
        UserName = "张三",
        Email = "zhangsan@example.com",
        Password = "SecurePass123"
    })
    .PostAsAsync<UserDto>();

// Form 表单提交
var loginResult = await "https://api.example.com/auth/token"
    .SetBody(new Dictionary<string, string>
    {
        { "grant_type", "password" },
        { "username", "admin" },
        { "password", "123456" }
    }, "application/x-www-form-urlencoded")
    .PostAsAsync<TokenResult>();

// 带查询参数的 POST
var result = await "https://api.example.com/api/batch"
    .SetQueries(new { type = "import" })
    .SetBody(dataList)
    .PostAsAsync<BatchResult>();
```

### 4.3 PUT 请求

```csharp
// 更新资源
var updatedUser = await "https://api.example.com/users/1"
    .SetBody(new UpdateUserInput
    {
        UserName = "张三（已更新）",
        Email = "zhangsan_new@example.com"
    })
    .PutAsAsync<UserDto>();
```

### 4.4 DELETE 请求

```csharp
// 删除资源
await "https://api.example.com/users/1".DeleteAsync();

// 带条件删除
await "https://api.example.com/users"
    .SetQueries(new { ids = "1,2,3" })
    .DeleteAsync();
```

### 4.5 PATCH 请求

```csharp
// 部分更新
var patchedUser = await "https://api.example.com/users/1"
    .SetBody(new { Email = "new_email@example.com" })
    .PatchAsAsync<UserDto>();
```

## 五、请求拦截器

### 5.1 请求拦截

```csharp
/// <summary>
/// 请求拦截器：统一添加认证信息
/// </summary>
public class AuthorizationInterceptor : IHttpDispatchProxy
{
    // 在接口代理中使用拦截器
}

// 使用 OnRequesting 回调
var result = await "https://api.example.com/data"
    .OnRequesting((client, request) =>
    {
        // 添加认证头
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", GetAccessToken());

        // 添加自定义头
        request.Headers.Add("X-Correlation-Id", Guid.NewGuid().ToString());
        request.Headers.Add("X-Client-Version", "1.0.0");
    })
    .GetAsAsync<DataResult>();

private static string GetAccessToken() => "your-access-token";
```

### 5.2 全局请求拦截

```csharp
/// <summary>
/// 全局 HTTP 请求拦截处理器
/// </summary>
public class GlobalHttpMessageHandler : DelegatingHandler
{
    private readonly ILogger<GlobalHttpMessageHandler> _logger;

    public GlobalHttpMessageHandler(ILogger<GlobalHttpMessageHandler> logger)
    {
        _logger = logger;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        // 请求前处理
        var requestId = Guid.NewGuid().ToString("N");
        request.Headers.Add("X-Request-Id", requestId);

        _logger.LogInformation("[{RequestId}] {Method} {Url}",
            requestId, request.Method, request.RequestUri);

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        // 发送请求
        var response = await base.SendAsync(request, cancellationToken);

        stopwatch.Stop();

        // 响应后处理
        _logger.LogInformation("[{RequestId}] 响应状态：{StatusCode}，耗时：{Elapsed}ms",
            requestId, (int)response.StatusCode, stopwatch.ElapsedMilliseconds);

        return response;
    }
}

// 注册全局拦截器
builder.Services.AddTransient<GlobalHttpMessageHandler>();
builder.Services.AddHttpClient("Default")
    .AddHttpMessageHandler<GlobalHttpMessageHandler>();
```

## 六、响应拦截器

### 6.1 响应处理

```csharp
// 响应拦截
var result = await "https://api.example.com/data"
    .OnResponsing((client, response) =>
    {
        // 检查响应状态
        if (!response.IsSuccessStatusCode)
        {
            // 记录错误日志
            Console.WriteLine($"请求失败：{response.StatusCode}");
        }

        // 检查特定响应头
        if (response.Headers.Contains("X-RateLimit-Remaining"))
        {
            var remaining = response.Headers.GetValues("X-RateLimit-Remaining").First();
            Console.WriteLine($"API 剩余调用次数：{remaining}");
        }
    })
    .GetAsAsync<DataResult>();
```

### 6.2 统一响应处理

```csharp
/// <summary>
/// 远程请求帮助类
/// </summary>
public static class RemoteRequestHelper
{
    /// <summary>
    /// 带统一错误处理的 GET 请求
    /// </summary>
    public static async Task<T> SafeGetAsync<T>(string url, Dictionary<string, object> headers = null)
    {
        try
        {
            var request = url;
            if (headers != null)
            {
                request = url;
            }

            var response = await url
                .SetHeaders(headers ?? new Dictionary<string, object>())
                .OnResponsing((client, resp) =>
                {
                    if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        throw new UnauthorizedAccessException("远程服务认证失败");
                    }

                    if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        throw new InvalidOperationException($"远程资源不存在：{url}");
                    }
                })
                .GetAsAsync<ApiResponse<T>>();

            if (response.Code != 200)
            {
                throw new Exception($"远程请求业务异常：{response.Message}");
            }

            return response.Data;
        }
        catch (HttpRequestException ex)
        {
            throw new Exception($"远程请求网络异常：{ex.Message}", ex);
        }
        catch (TaskCanceledException)
        {
            throw new TimeoutException($"远程请求超时：{url}");
        }
    }
}

/// <summary>
/// 统一 API 响应模型
/// </summary>
public class ApiResponse<T>
{
    public int Code { get; set; }
    public string Message { get; set; }
    public T Data { get; set; }
    public bool Success => Code == 200;
}
```

## 七、文件上传与下载

### 7.1 文件上传

```csharp
/// <summary>
/// 文件上传服务
/// </summary>
public class FileUploadService
{
    /// <summary>
    /// 单文件上传
    /// </summary>
    public async Task<FileUploadResult> UploadFileAsync(Stream fileStream, string fileName)
    {
        var content = new MultipartFormDataContent();
        var streamContent = new StreamContent(fileStream);
        content.Add(streamContent, "file", fileName);

        var result = await "https://api.example.com/files/upload"
            .SetBody(content)
            .PostAsAsync<FileUploadResult>();

        return result;
    }

    /// <summary>
    /// 多文件上传
    /// </summary>
    public async Task<List<FileUploadResult>> UploadFilesAsync(List<(Stream Stream, string FileName)> files)
    {
        var content = new MultipartFormDataContent();

        foreach (var (stream, fileName) in files)
        {
            var streamContent = new StreamContent(stream);
            content.Add(streamContent, "files", fileName);
        }

        // 添加额外表单字段
        content.Add(new StringContent("images"), "category");

        var result = await "https://api.example.com/files/batch-upload"
            .SetBody(content)
            .PostAsAsync<List<FileUploadResult>>();

        return result;
    }
}

/// <summary>
/// 文件上传结果
/// </summary>
public class FileUploadResult
{
    public string FileId { get; set; }
    public string FileName { get; set; }
    public string Url { get; set; }
    public long Size { get; set; }
}
```

### 7.2 文件下载

```csharp
/// <summary>
/// 文件下载服务
/// </summary>
public class FileDownloadService
{
    /// <summary>
    /// 下载文件到本地
    /// </summary>
    public async Task DownloadFileAsync(string fileUrl, string savePath)
    {
        var response = await fileUrl.GetAsync();
        response.EnsureSuccessStatusCode();

        await using var fileStream = File.Create(savePath);
        await response.Content.CopyToAsync(fileStream);
    }

    /// <summary>
    /// 下载文件为字节数组
    /// </summary>
    public async Task<byte[]> DownloadFileBytesAsync(string fileUrl)
    {
        var response = await fileUrl.GetAsync();
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadAsByteArrayAsync();
    }

    /// <summary>
    /// 下载大文件（流式处理）
    /// </summary>
    public async Task DownloadLargeFileAsync(string fileUrl, string savePath, IProgress<long> progress = null)
    {
        using var httpClient = new HttpClient();
        using var response = await httpClient.GetAsync(fileUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var totalBytes = response.Content.Headers.ContentLength ?? -1L;

        await using var contentStream = await response.Content.ReadAsStreamAsync();
        await using var fileStream = File.Create(savePath);

        var buffer = new byte[8192];
        var totalBytesRead = 0L;
        int bytesRead;

        while ((bytesRead = await contentStream.ReadAsync(buffer)) > 0)
        {
            await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead));
            totalBytesRead += bytesRead;
            progress?.Report(totalBytesRead);
        }
    }
}
```

## 八、超时与重试

### 8.1 超时配置

```csharp
// 设置请求超时
var result = await "https://api.example.com/slow-api"
    .SetHttpClientTimeout(TimeSpan.FromSeconds(60))
    .GetAsAsync<SlowResult>();

// 在命名客户端中配置超时
builder.Services.AddHttpClient("SlowService", client =>
{
    client.BaseAddress = new Uri("https://api.slowservice.com");
    client.Timeout = TimeSpan.FromMinutes(2);
});
```

### 8.2 重试策略

使用 Polly 实现重试策略：

```csharp
// 安装 Microsoft.Extensions.Http.Polly 包
builder.Services.AddHttpClient("ResilientService")
    .AddTransientHttpErrorPolicy(policy =>
        policy.WaitAndRetryAsync(3, retryAttempt =>
            TimeSpan.FromSeconds(Math.Pow(2, retryAttempt))))
    .AddTransientHttpErrorPolicy(policy =>
        policy.CircuitBreakerAsync(5, TimeSpan.FromSeconds(30)));
```

### 8.3 自定义重试逻辑

```csharp
/// <summary>
/// 带重试的 HTTP 请求帮助类
/// </summary>
public static class ResilientHttpHelper
{
    /// <summary>
    /// 带重试的 GET 请求
    /// </summary>
    public static async Task<T> GetWithRetryAsync<T>(
        string url,
        int maxRetries = 3,
        int baseDelayMs = 1000)
    {
        Exception lastException = null;

        for (int i = 0; i <= maxRetries; i++)
        {
            try
            {
                return await url.GetAsAsync<T>();
            }
            catch (HttpRequestException ex) when (i < maxRetries)
            {
                lastException = ex;
                var delay = baseDelayMs * (int)Math.Pow(2, i);
                await Task.Delay(delay);
            }
            catch (TaskCanceledException ex) when (i < maxRetries)
            {
                lastException = ex;
                var delay = baseDelayMs * (int)Math.Pow(2, i);
                await Task.Delay(delay);
            }
        }

        throw new Exception($"请求 {url} 失败，已重试 {maxRetries} 次", lastException);
    }
}
```

## 九、请求日志

### 9.1 日志中间件

```csharp
/// <summary>
/// HTTP 请求日志处理器
/// </summary>
public class HttpLoggingHandler : DelegatingHandler
{
    private readonly ILogger<HttpLoggingHandler> _logger;

    public HttpLoggingHandler(ILogger<HttpLoggingHandler> logger) => _logger = logger;

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var requestId = Guid.NewGuid().ToString("N")[..8];
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        // 记录请求信息
        _logger.LogInformation(
            "[{RequestId}] >>> {Method} {Url}",
            requestId, request.Method, request.RequestUri);

        if (request.Content != null)
        {
            var body = await request.Content.ReadAsStringAsync(cancellationToken);
            if (body.Length <= 1000) // 限制日志长度
            {
                _logger.LogDebug("[{RequestId}] 请求体：{Body}", requestId, body);
            }
        }

        // 发送请求
        var response = await base.SendAsync(request, cancellationToken);

        stopwatch.Stop();

        // 记录响应信息
        var level = response.IsSuccessStatusCode ? LogLevel.Information : LogLevel.Warning;
        _logger.Log(level,
            "[{RequestId}] <<< {StatusCode} {ReasonPhrase} ({Elapsed}ms)",
            requestId, (int)response.StatusCode, response.ReasonPhrase,
            stopwatch.ElapsedMilliseconds);

        return response;
    }
}
```

### 9.2 注册日志处理器

```csharp
builder.Services.AddTransient<HttpLoggingHandler>();

builder.Services.AddHttpClient("LoggedClient")
    .AddHttpMessageHandler<HttpLoggingHandler>();
```

## 十、微服务间通信

### 10.1 服务发现与请求

```csharp
/// <summary>
/// 微服务 HTTP 代理集合
/// </summary>
[Client("OrderService")]
public interface IOrderServiceApi : IHttpDispatchProxy
{
    [Get("/api/orders")]
    Task<PagedResult<OrderDto>> GetOrdersAsync(
        [QueryString] int page = 1,
        [QueryString] int pageSize = 20);

    [Get("/api/orders/{orderId}")]
    Task<OrderDto> GetOrderAsync([RouteParam] long orderId);

    [Post("/api/orders")]
    Task<OrderDto> CreateOrderAsync([Body] CreateOrderInput input);

    [Put("/api/orders/{orderId}/status")]
    Task UpdateOrderStatusAsync(
        [RouteParam] long orderId,
        [Body] UpdateStatusInput input);
}

[Client("InventoryService")]
public interface IInventoryServiceApi : IHttpDispatchProxy
{
    [Get("/api/inventory/{productId}")]
    Task<InventoryDto> GetInventoryAsync([RouteParam] long productId);

    [Post("/api/inventory/deduct")]
    Task<bool> DeductInventoryAsync([Body] DeductInventoryInput input);

    [Post("/api/inventory/restore")]
    Task<bool> RestoreInventoryAsync([Body] RestoreInventoryInput input);
}
```

### 10.2 编排多个服务调用

```csharp
/// <summary>
/// 订单编排服务
/// </summary>
[ApiDescriptionSettings("订单编排")]
public class OrderOrchestrationService : IDynamicApiController
{
    private readonly IOrderServiceApi _orderApi;
    private readonly IInventoryServiceApi _inventoryApi;
    private readonly ILogger<OrderOrchestrationService> _logger;

    public OrderOrchestrationService(
        IOrderServiceApi orderApi,
        IInventoryServiceApi inventoryApi,
        ILogger<OrderOrchestrationService> logger)
    {
        _orderApi = orderApi;
        _inventoryApi = inventoryApi;
        _logger = logger;
    }

    /// <summary>
    /// 创建订单（编排多个服务）
    /// </summary>
    public async Task<OrderDto> CreateOrder(CreateOrderInput input)
    {
        // 1. 检查库存
        var inventory = await _inventoryApi.GetInventoryAsync(input.ProductId);
        if (inventory.Available < input.Quantity)
        {
            throw new Exception("库存不足");
        }

        // 2. 扣减库存
        var deducted = await _inventoryApi.DeductInventoryAsync(new DeductInventoryInput
        {
            ProductId = input.ProductId,
            Quantity = input.Quantity
        });

        if (!deducted)
        {
            throw new Exception("扣减库存失败");
        }

        try
        {
            // 3. 创建订单
            var order = await _orderApi.CreateOrderAsync(input);
            return order;
        }
        catch (Exception ex)
        {
            // 4. 补偿：恢复库存
            _logger.LogError(ex, "创建订单失败，开始恢复库存");
            await _inventoryApi.RestoreInventoryAsync(new RestoreInventoryInput
            {
                ProductId = input.ProductId,
                Quantity = input.Quantity
            });

            throw;
        }
    }
}
```

## 十一、请求转发

### 11.1 网关模式转发

```csharp
/// <summary>
/// API 网关转发控制器
/// </summary>
[ApiDescriptionSettings("网关")]
public class GatewayAppService : IDynamicApiController
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public GatewayAppService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    /// <summary>
    /// 转发请求到目标服务
    /// </summary>
    [HttpGet("{serviceName}/{**path}")]
    public async Task<IActionResult> ForwardRequest(
        string serviceName, string path,
        [FromServices] HttpContext httpContext)
    {
        var serviceUrl = _configuration[$"Services:{serviceName}:BaseUrl"];
        if (string.IsNullOrEmpty(serviceUrl))
        {
            return new NotFoundObjectResult($"服务 {serviceName} 未配置");
        }

        var targetUrl = $"{serviceUrl}/{path}{httpContext.Request.QueryString}";
        var client = _httpClientFactory.CreateClient();

        // 复制请求头
        foreach (var header in httpContext.Request.Headers)
        {
            if (!header.Key.StartsWith("Host", StringComparison.OrdinalIgnoreCase))
            {
                client.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value.ToArray());
            }
        }

        var response = await client.GetAsync(targetUrl);
        var content = await response.Content.ReadAsStringAsync();

        return new ContentResult
        {
            Content = content,
            ContentType = response.Content.Headers.ContentType?.ToString(),
            StatusCode = (int)response.StatusCode
        };
    }
}
```

## 十二、最佳实践

### 12.1 远程请求设计原则

| 原则 | 说明 |
|------|------|
| 使用 IHttpClientFactory | 避免直接 new HttpClient |
| 设置合理超时 | 根据业务场景设置超时时间 |
| 添加重试策略 | 网络不稳定场景添加重试 |
| 断路器模式 | 避免雪崩效应 |
| 请求日志 | 记录请求和响应便于排查 |
| 接口代理 | 使用 IHttpDispatchProxy 提升可维护性 |
| 配置外置 | 服务地址放配置文件 |
| 异常处理 | 统一处理远程请求异常 |

### 12.2 完整的远程请求服务示例

```csharp
/// <summary>
/// 第三方支付服务代理
/// </summary>
[Client("PaymentService")]
public interface IPaymentApi : IHttpDispatchProxy
{
    /// <summary>
    /// 创建支付订单
    /// </summary>
    [Post("/api/payment/create")]
    Task<PaymentResult> CreatePaymentAsync([Body] CreatePaymentInput input);

    /// <summary>
    /// 查询支付状态
    /// </summary>
    [Get("/api/payment/{paymentId}/status")]
    Task<PaymentStatusResult> GetPaymentStatusAsync([RouteParam] string paymentId);

    /// <summary>
    /// 退款
    /// </summary>
    [Post("/api/payment/{paymentId}/refund")]
    Task<RefundResult> RefundAsync([RouteParam] string paymentId, [Body] RefundInput input);
}

/// <summary>
/// 支付服务封装
/// </summary>
public class PaymentService
{
    private readonly IPaymentApi _paymentApi;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(IPaymentApi paymentApi, ILogger<PaymentService> logger)
    {
        _paymentApi = paymentApi;
        _logger = logger;
    }

    /// <summary>
    /// 发起支付（带重试和异常处理）
    /// </summary>
    public async Task<PaymentResult> CreatePaymentWithRetry(CreatePaymentInput input)
    {
        const int maxRetries = 3;

        for (int i = 0; i <= maxRetries; i++)
        {
            try
            {
                var result = await _paymentApi.CreatePaymentAsync(input);
                _logger.LogInformation("支付订单创建成功：{PaymentId}", result.PaymentId);
                return result;
            }
            catch (Exception ex) when (i < maxRetries)
            {
                _logger.LogWarning(ex, "支付请求失败，第 {Retry} 次重试", i + 1);
                await Task.Delay(1000 * (i + 1));
            }
        }

        throw new Exception("支付服务暂时不可用，请稍后重试");
    }
}
```

通过 Furion 的远程请求增强功能，可以极大简化微服务间的 HTTP 通信代码，提升代码的可读性和可维护性。结合拦截器、重试策略和日志记录，可以构建出健壮可靠的分布式系统。
