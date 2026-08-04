---
layout: default
title: 第03章：HTTP客户端基础设施详解
---

# 第03章：HTTP客户端基础设施详解

## 3.1 HTTP 客户端架构

GeoServerDesktop.GeoServerClient 的 HTTP 客户端层是整个库的基础设施，它封装了所有与 GeoServer REST API 的通信细节。本章将深入探讨 HTTP 客户端的实现原理和使用技巧。

### 3.1.1 接口设计

#### IGeoServerHttpClient 接口

```csharp
public interface IGeoServerHttpClient : IDisposable
{
    /// <summary>
    /// 发送 GET 请求
    /// </summary>
    /// <param name="path">REST 端点的相对路径</param>
    /// <returns>响应内容字符串</returns>
    Task<string> GetAsync(string path);

    /// <summary>
    /// 发送 POST 请求
    /// </summary>
    /// <param name="path">REST 端点的相对路径</param>
    /// <param name="content">请求内容</param>
    /// <returns>响应内容字符串</returns>
    Task<string> PostAsync(string path, HttpContent content);

    /// <summary>
    /// 发送 PUT 请求
    /// </summary>
    /// <param name="path">REST 端点的相对路径</param>
    /// <param name="content">请求内容</param>
    /// <returns>响应内容字符串</returns>
    Task<string> PutAsync(string path, HttpContent content);

    /// <summary>
    /// 发送 DELETE 请求
    /// </summary>
    /// <param name="path">REST 端点的相对路径</param>
    /// <returns>响应内容字符串</returns>
    Task<string> DeleteAsync(string path);
}
```

**设计优点**：
- **抽象与实现分离**：便于单元测试和依赖注入
- **统一接口**：所有 HTTP 操作使用一致的方法签名
- **资源管理**：实现 IDisposable 确保资源正确释放
- **异步优先**：所有方法都是异步的，提高性能

### 3.1.2 实现类：GeoServerHttpClient

GeoServerHttpClient 是 IGeoServerHttpClient 的具体实现，它基于 .NET 的 HttpClient 类。

#### 核心属性

```csharp
public class GeoServerHttpClient : IGeoServerHttpClient
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private bool _disposed;
}
```

- `_httpClient`：底层的 HTTP 客户端
- `_baseUrl`：GeoServer 的基础 URL
- `_disposed`：标记对象是否已释放

## 3.2 初始化与配置

### 3.2.1 构造函数

```csharp
public GeoServerHttpClient(GeoServerClientOptions options)
{
    if (options == null)
        throw new ArgumentNullException(nameof(options));
    if (string.IsNullOrWhiteSpace(options.BaseUrl))
        throw new ArgumentException("BaseUrl is required", nameof(options));

    _baseUrl = options.BaseUrl.TrimEnd('/');

    _httpClient = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds)
    };

    // 设置基本身份验证
    if (!string.IsNullOrWhiteSpace(options.Username))
    {
        var authToken = Convert.ToBase64String(
            Encoding.ASCII.GetBytes($"{options.Username}:{options.Password}"));
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Basic", authToken);
    }

    // 设置 JSON 的默认头
    _httpClient.DefaultRequestHeaders.Accept.Add(
        new MediaTypeWithQualityHeaderValue("application/json"));
}
```

**关键步骤**：

1. **参数验证**：确保配置选项有效
2. **URL 规范化**：移除末尾的斜杠，避免重复
3. **超时设置**：配置请求超时时间
4. **身份验证**：设置 HTTP Basic Authentication
5. **内容协商**：设置接受 JSON 格式的响应

### 3.2.2 HTTP Basic Authentication

GeoServer 使用 HTTP Basic Authentication 进行身份验证：

```csharp
// 编码格式：Base64(username:password)
var credentials = $"{username}:{password}";
var authToken = Convert.ToBase64String(Encoding.ASCII.GetBytes(credentials));

// 设置 Authorization 头
// 格式：Basic <base64-encoded-credentials>
_httpClient.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Basic", authToken);
```

**示例**：
```
用户名：admin
密码：geoserver
凭据字符串：admin:geoserver
Base64 编码：YWRtaW46Z2Vvc2VydmVy
Authorization 头：Basic YWRtaW46Z2Vvc2VydmVy
```

### 3.2.3 自定义 HTTP 客户端配置

如需更高级的配置，可以扩展 GeoServerHttpClient：

```csharp
public class CustomGeoServerHttpClient : GeoServerHttpClient
{
    public CustomGeoServerHttpClient(GeoServerClientOptions options) 
        : base(options)
    {
        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        // 添加自定义请求头
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "MyGeoServerClient/1.0");
        _httpClient.DefaultRequestHeaders.Add("X-Custom-Header", "CustomValue");

        // 配置压缩
        _httpClient.DefaultRequestHeaders.AcceptEncoding.Add(
            new StringWithQualityHeaderValue("gzip"));
        _httpClient.DefaultRequestHeaders.AcceptEncoding.Add(
            new StringWithQualityHeaderValue("deflate"));
    }
}
```

## 3.3 HTTP 请求方法详解

### 3.3.1 GET 请求

GET 请求用于获取资源信息：

```csharp
public async Task<string> GetAsync(string path)
{
    var url = BuildUrl(path);
    var response = await _httpClient.GetAsync(url);
    return await ProcessResponse(response);
}
```

**使用场景**：
- 获取工作空间列表
- 获取图层详情
- 获取样式定义
- 查询系统信息

**示例**：
```csharp
// 获取所有工作空间
var response = await httpClient.GetAsync("/rest/workspaces.json");

// 获取特定工作空间
var response = await httpClient.GetAsync("/rest/workspaces/myWorkspace.json");

// 获取样式 SLD
var sld = await httpClient.GetAsync("/rest/styles/myStyle.sld");
```

### 3.3.2 POST 请求

POST 请求用于创建新资源：

```csharp
public async Task<string> PostAsync(string path, HttpContent content)
{
    var url = BuildUrl(path);
    var response = await _httpClient.PostAsync(url, content);
    return await ProcessResponse(response);
}
```

**使用场景**：
- 创建工作空间
- 创建数据存储
- 创建图层
- 上传样式

**示例**：
```csharp
// 创建工作空间
var workspace = new { workspace = new { name = "myWorkspace" } };
var json = JsonConvert.SerializeObject(workspace);
var content = new StringContent(json, Encoding.UTF8, "application/json");
await httpClient.PostAsync("/rest/workspaces", content);

// 上传文件
var fileContent = File.ReadAllBytes("data.zip");
var content = new ByteArrayContent(fileContent);
content.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
await httpClient.PostAsync("/rest/workspaces/ws/datastores/ds/file.shp", content);
```

### 3.3.3 PUT 请求

PUT 请求用于更新现有资源：

```csharp
public async Task<string> PutAsync(string path, HttpContent content)
{
    var url = BuildUrl(path);
    var response = await _httpClient.PutAsync(url, content);
    return await ProcessResponse(response);
}
```

**使用场景**：
- 更新工作空间
- 更新图层配置
- 更新样式定义
- 修改服务设置

**示例**：
```csharp
// 更新工作空间名称
var workspace = new { workspace = new { name = "newName" } };
var json = JsonConvert.SerializeObject(workspace);
var content = new StringContent(json, Encoding.UTF8, "application/json");
await httpClient.PutAsync("/rest/workspaces/oldName", content);

// 更新样式 SLD
var sldContent = File.ReadAllText("style.sld");
var content = new StringContent(sldContent, Encoding.UTF8, "application/vnd.ogc.sld+xml");
await httpClient.PutAsync("/rest/styles/myStyle", content);
```

### 3.3.4 DELETE 请求

DELETE 请求用于删除资源：

```csharp
public async Task<string> DeleteAsync(string path)
{
    var url = BuildUrl(path);
    var response = await _httpClient.DeleteAsync(url);
    return await ProcessResponse(response);
}
```

**使用场景**：
- 删除工作空间
- 删除图层
- 删除样式
- 清理资源

**示例**：
```csharp
// 删除工作空间（非递归）
await httpClient.DeleteAsync("/rest/workspaces/myWorkspace");

// 删除工作空间（递归删除所有内容）
await httpClient.DeleteAsync("/rest/workspaces/myWorkspace?recurse=true");

// 删除样式并清除文件
await httpClient.DeleteAsync("/rest/styles/myStyle?purge=true");
```

## 3.4 URL 构建

### 3.4.1 BuildUrl 方法

```csharp
private string BuildUrl(string path)
{
    path = path?.TrimStart('/') ?? string.Empty;
    return $"{_baseUrl}/{path}";
}
```

**处理逻辑**：
1. 移除路径开头的斜杠（如果存在）
2. 将基础 URL 和相对路径组合
3. 确保 URL 格式正确

**示例**：
```csharp
// 假设 _baseUrl = "http://localhost:8080/geoserver"

BuildUrl("/rest/workspaces")
// 结果：http://localhost:8080/geoserver/rest/workspaces

BuildUrl("rest/workspaces")
// 结果：http://localhost:8080/geoserver/rest/workspaces

BuildUrl("/rest/workspaces.json")
// 结果：http://localhost:8080/geoserver/rest/workspaces.json
```

### 3.4.2 查询参数处理

对于带查询参数的请求：

```csharp
public static class UrlBuilder
{
    public static string AppendQueryParameter(string url, string name, object value)
    {
        if (value == null) return url;

        var separator = url.Contains("?") ? "&" : "?";
        var encodedValue = Uri.EscapeDataString(value.ToString());
        return $"{url}{separator}{name}={encodedValue}";
    }

    public static string AppendQueryParameters(
        string url, 
        Dictionary<string, object> parameters)
    {
        if (parameters == null || parameters.Count == 0)
            return url;

        var query = string.Join("&", 
            parameters
                .Where(p => p.Value != null)
                .Select(p => $"{p.Key}={Uri.EscapeDataString(p.Value.ToString())}"));

        var separator = url.Contains("?") ? "&" : "?";
        return $"{url}{separator}{query}";
    }
}

// 使用示例
var url = "/rest/workspaces/myWorkspace";
url = UrlBuilder.AppendQueryParameter(url, "recurse", true);
// 结果：/rest/workspaces/myWorkspace?recurse=true

var parameters = new Dictionary<string, object>
{
    ["recurse"] = true,
    ["quietOnNotFound"] = true
};
url = UrlBuilder.AppendQueryParameters("/rest/layers/myLayer", parameters);
// 结果：/rest/layers/myLayer?recurse=true&quietOnNotFound=true
```

## 3.5 响应处理

### 3.5.1 ProcessResponse 方法

```csharp
private async Task<string> ProcessResponse(HttpResponseMessage response)
{
    var content = await response.Content.ReadAsStringAsync();

    if (!response.IsSuccessStatusCode)
    {
        throw new GeoServerRequestException(
            $"GeoServer request failed with status code {(int)response.StatusCode} ({response.StatusCode})",
            (int)response.StatusCode,
            content);
    }

    return content;
}
```

**处理流程**：
1. 读取响应内容（无论成功或失败）
2. 检查 HTTP 状态码
3. 如果失败，抛出 GeoServerRequestException
4. 如果成功，返回响应内容

### 3.5.2 响应内容类型

GeoServer REST API 支持多种响应格式：

```csharp
public class ContentTypeHelper
{
    public static readonly Dictionary<string, string> ContentTypes = new()
    {
        [".json"] = "application/json",
        [".xml"] = "application/xml",
        [".sld"] = "application/vnd.ogc.sld+xml",
        [".html"] = "text/html",
        [".png"] = "image/png",
        [".jpeg"] = "image/jpeg",
        [".zip"] = "application/zip",
        [".shp"] = "application/x-shapefile"
    };

    public static string GetContentType(string path)
    {
        var extension = Path.GetExtension(path).ToLowerInvariant();
        return ContentTypes.TryGetValue(extension, out var contentType)
            ? contentType
            : "application/octet-stream";
    }
}
```

### 3.5.3 流式响应处理

对于大文件下载，应使用流式处理：

```csharp
public async Task<Stream> GetStreamAsync(string path)
{
    var url = BuildUrl(path);
    var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);

    if (!response.IsSuccessStatusCode)
    {
        var content = await response.Content.ReadAsStringAsync();
        throw new GeoServerRequestException(
            $"GeoServer request failed with status code {(int)response.StatusCode}",
            (int)response.StatusCode,
            content);
    }

    return await response.Content.ReadAsStreamAsync();
}

// 使用示例：下载大型文件
using var stream = await httpClient.GetStreamAsync("/rest/resource/styles/myStyle.sld");
using var fileStream = File.Create("myStyle.sld");
await stream.CopyToAsync(fileStream);
```

## 3.6 异常处理

### 3.6.1 GeoServerRequestException

```csharp
public class GeoServerRequestException : Exception
{
    public int StatusCode { get; }
    public string ResponseContent { get; }

    public GeoServerRequestException(
        string message,
        int statusCode,
        string responseContent) 
        : base(message)
    {
        StatusCode = statusCode;
        ResponseContent = responseContent;
    }
}
```

**属性说明**：
- `StatusCode`：HTTP 状态码（401、403、404 等）
- `ResponseContent`：GeoServer 返回的错误详情
- `Message`：格式化的错误消息

### 3.6.2 异常处理最佳实践

```csharp
public static class GeoServerExceptionHandler
{
    public static async Task<T> ExecuteWithRetry<T>(
        Func<Task<T>> operation,
        int maxRetries = 3,
        int delayMilliseconds = 1000)
    {
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                return await operation();
            }
            catch (GeoServerRequestException ex) when (IsTransientError(ex.StatusCode))
            {
                if (i == maxRetries - 1)
                    throw;

                await Task.Delay(delayMilliseconds * (i + 1));
            }
            catch (HttpRequestException ex)
            {
                if (i == maxRetries - 1)
                    throw;

                await Task.Delay(delayMilliseconds * (i + 1));
            }
        }

        throw new InvalidOperationException("Should not reach here");
    }

    private static bool IsTransientError(int statusCode)
    {
        // 可重试的错误状态码
        return statusCode == 408 ||  // Request Timeout
               statusCode == 429 ||  // Too Many Requests
               statusCode == 502 ||  // Bad Gateway
               statusCode == 503 ||  // Service Unavailable
               statusCode == 504;    // Gateway Timeout
    }

    public static string FormatError(GeoServerRequestException ex)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"GeoServer 错误 ({ex.StatusCode}):");
        sb.AppendLine(ex.Message);
        
        if (!string.IsNullOrWhiteSpace(ex.ResponseContent))
        {
            sb.AppendLine("详细信息:");
            sb.AppendLine(ex.ResponseContent);
        }

        return sb.ToString();
    }
}

// 使用示例
try
{
    var result = await GeoServerExceptionHandler.ExecuteWithRetry(
        async () => await workspaceService.GetWorkspacesAsync(),
        maxRetries: 3,
        delayMilliseconds: 1000);
}
catch (GeoServerRequestException ex)
{
    Console.WriteLine(GeoServerExceptionHandler.FormatError(ex));
}
```

### 3.6.3 特定错误处理

```csharp
public static class GeoServerErrorHandler
{
    public static async Task<T> HandleNotFound<T>(
        Func<Task<T>> operation,
        T defaultValue = default)
    {
        try
        {
            return await operation();
        }
        catch (GeoServerRequestException ex) when (ex.StatusCode == 404)
        {
            return defaultValue;
        }
    }

    public static async Task<bool> ResourceExists(
        Func<Task> operation)
    {
        try
        {
            await operation();
            return true;
        }
        catch (GeoServerRequestException ex) when (ex.StatusCode == 404)
        {
            return false;
        }
    }

    public static async Task DeleteIfExists(
        Func<Task> deleteOperation)
    {
        try
        {
            await deleteOperation();
        }
        catch (GeoServerRequestException ex) when (ex.StatusCode == 404)
        {
            // 资源不存在，忽略错误
        }
    }
}

// 使用示例
// 1. 处理资源不存在
var workspace = await GeoServerErrorHandler.HandleNotFound(
    async () => await workspaceService.GetWorkspaceAsync("mayNotExist"),
    defaultValue: null);

// 2. 检查资源是否存在
bool exists = await GeoServerErrorHandler.ResourceExists(
    async () => await workspaceService.GetWorkspaceAsync("myWorkspace"));

// 3. 删除（如果存在）
await GeoServerErrorHandler.DeleteIfExists(
    async () => await workspaceService.DeleteWorkspaceAsync("mayNotExist"));
```

## 3.7 资源管理

### 3.7.1 Dispose 模式实现

```csharp
public void Dispose()
{
    Dispose(true);
    GC.SuppressFinalize(this);
}

protected virtual void Dispose(bool disposing)
{
    if (!_disposed)
    {
        if (disposing)
        {
            _httpClient?.Dispose();
        }
        _disposed = true;
    }
}
```

**关键点**：
- **标准 Dispose 模式**：符合 .NET 最佳实践
- **防止重复释放**：使用 `_disposed` 标志
- **托管资源清理**：释放 HttpClient
- **GC 优化**：调用 SuppressFinalize

### 3.7.2 使用 using 语句

```csharp
// 单个操作
using (var httpClient = new GeoServerHttpClient(options))
{
    var response = await httpClient.GetAsync("/rest/workspaces.json");
}

// 多个操作
using (var httpClient = new GeoServerHttpClient(options))
{
    var workspaces = await httpClient.GetAsync("/rest/workspaces.json");
    var layers = await httpClient.GetAsync("/rest/layers.json");
    var styles = await httpClient.GetAsync("/rest/styles.json");
}

// C# 8+ using 声明
async Task ProcessWorkspaces()
{
    using var httpClient = new GeoServerHttpClient(options);
    var response = await httpClient.GetAsync("/rest/workspaces.json");
    // httpClient 在方法结束时自动释放
}
```

### 3.7.3 HttpClient 生命周期管理

**注意事项**：
- HttpClient 是线程安全的
- 应该复用 HttpClient 实例
- 避免频繁创建和销毁

**推荐实践**：

```csharp
// 方式 1：使用工厂模式（推荐）
using (var factory = new GeoServerClientFactory(options))
{
    // 工厂内部管理 HttpClient 的生命周期
    var service1 = factory.CreateWorkspaceService();
    var service2 = factory.CreateLayerService();
}

// 方式 2：使用单例（长期运行的应用）
public class GeoServerHttpClientSingleton
{
    private static readonly Lazy<GeoServerHttpClient> _instance =
        new Lazy<GeoServerHttpClient>(() => 
            new GeoServerHttpClient(LoadOptions()));

    public static GeoServerHttpClient Instance => _instance.Value;

    private static GeoServerClientOptions LoadOptions()
    {
        // 从配置加载选项
        return new GeoServerClientOptions { /* ... */ };
    }
}

// 方式 3：在 ASP.NET Core 中使用依赖注入
services.AddSingleton<IGeoServerHttpClient>(sp =>
{
    var options = sp.GetRequiredService<IOptions<GeoServerClientOptions>>().Value;
    return new GeoServerHttpClient(options);
});
```

## 3.8 高级功能

### 3.8.1 请求拦截器

添加请求前后的处理逻辑：

```csharp
public class GeoServerHttpClientWithInterceptor : GeoServerHttpClient
{
    private readonly ILogger _logger;
    private readonly List<IRequestInterceptor> _interceptors;

    public GeoServerHttpClientWithInterceptor(
        GeoServerClientOptions options,
        ILogger logger,
        List<IRequestInterceptor> interceptors = null)
        : base(options)
    {
        _logger = logger;
        _interceptors = interceptors ?? new List<IRequestInterceptor>();
    }

    public override async Task<string> GetAsync(string path)
    {
        await OnBeforeRequest("GET", path);
        
        try
        {
            var result = await base.GetAsync(path);
            await OnAfterRequest("GET", path, result);
            return result;
        }
        catch (Exception ex)
        {
            await OnRequestError("GET", path, ex);
            throw;
        }
    }

    private async Task OnBeforeRequest(string method, string path)
    {
        _logger?.LogDebug($"[{method}] {path}");
        
        foreach (var interceptor in _interceptors)
        {
            await interceptor.BeforeRequestAsync(method, path);
        }
    }

    private async Task OnAfterRequest(string method, string path, string response)
    {
        _logger?.LogDebug($"[{method}] {path} - Success ({response?.Length ?? 0} bytes)");
        
        foreach (var interceptor in _interceptors)
        {
            await interceptor.AfterRequestAsync(method, path, response);
        }
    }

    private async Task OnRequestError(string method, string path, Exception exception)
    {
        _logger?.LogError(exception, $"[{method}] {path} - Error");
        
        foreach (var interceptor in _interceptors)
        {
            await interceptor.OnErrorAsync(method, path, exception);
        }
    }
}

public interface IRequestInterceptor
{
    Task BeforeRequestAsync(string method, string path);
    Task AfterRequestAsync(string method, string path, string response);
    Task OnErrorAsync(string method, string path, Exception exception);
}
```

### 3.8.2 请求日志记录

```csharp
public class LoggingInterceptor : IRequestInterceptor
{
    private readonly ILogger _logger;
    private readonly Stopwatch _stopwatch = new Stopwatch();

    public LoggingInterceptor(ILogger logger)
    {
        _logger = logger;
    }

    public Task BeforeRequestAsync(string method, string path)
    {
        _stopwatch.Restart();
        _logger.LogInformation($"开始请求: [{method}] {path}");
        return Task.CompletedTask;
    }

    public Task AfterRequestAsync(string method, string path, string response)
    {
        _stopwatch.Stop();
        _logger.LogInformation(
            $"请求完成: [{method}] {path} - {_stopwatch.ElapsedMilliseconds}ms");
        return Task.CompletedTask;
    }

    public Task OnErrorAsync(string method, string path, Exception exception)
    {
        _stopwatch.Stop();
        _logger.LogError(
            exception,
            $"请求失败: [{method}] {path} - {_stopwatch.ElapsedMilliseconds}ms");
        return Task.CompletedTask;
    }
}
```

### 3.8.3 响应缓存

```csharp
public class CachingHttpClient : GeoServerHttpClient
{
    private readonly IMemoryCache _cache;
    private readonly int _cacheExpirationMinutes;

    public CachingHttpClient(
        GeoServerClientOptions options,
        IMemoryCache cache,
        int cacheExpirationMinutes = 5)
        : base(options)
    {
        _cache = cache;
        _cacheExpirationMinutes = cacheExpirationMinutes;
    }

    public override async Task<string> GetAsync(string path)
    {
        // 检查缓存
        if (_cache.TryGetValue(path, out string cachedResponse))
        {
            return cachedResponse;
        }

        // 执行请求
        var response = await base.GetAsync(path);

        // 存入缓存
        _cache.Set(path, response, TimeSpan.FromMinutes(_cacheExpirationMinutes));

        return response;
    }

    public void ClearCache()
    {
        if (_cache is MemoryCache memoryCache)
        {
            memoryCache.Compact(1.0);
        }
    }

    public void InvalidateCache(string path)
    {
        _cache.Remove(path);
    }
}
```

## 3.9 单元测试

### 3.9.1 模拟 HTTP 客户端

```csharp
public class MockGeoServerHttpClient : IGeoServerHttpClient
{
    private readonly Dictionary<string, string> _responses = new();

    public void SetupResponse(string path, string response)
    {
        _responses[path] = response;
    }

    public Task<string> GetAsync(string path)
    {
        if (_responses.TryGetValue(path, out var response))
        {
            return Task.FromResult(response);
        }
        throw new GeoServerRequestException("Not found", 404, "");
    }

    public Task<string> PostAsync(string path, HttpContent content)
    {
        return Task.FromResult("{}");
    }

    public Task<string> PutAsync(string path, HttpContent content)
    {
        return Task.FromResult("{}");
    }

    public Task<string> DeleteAsync(string path)
    {
        return Task.FromResult("");
    }

    public void Dispose() { }
}

// 在测试中使用
[Test]
public async Task GetWorkspaces_ReturnsWorkspaces()
{
    // Arrange
    var mockClient = new MockGeoServerHttpClient();
    mockClient.SetupResponse("/rest/workspaces.json", 
        @"{""workspaces"":{""workspace"":[{""name"":""test""}]}}");

    var service = new WorkspaceService(mockClient);

    // Act
    var workspaces = await service.GetWorkspacesAsync();

    // Assert
    Assert.AreEqual(1, workspaces.Length);
    Assert.AreEqual("test", workspaces[0].Name);
}
```

## 3.10 本章小结

本章深入讲解了 GeoServerDesktop.GeoServerClient 的 HTTP 客户端基础设施：

1. **接口设计**：学习了 IGeoServerHttpClient 接口和实现类
2. **HTTP 方法**：掌握了 GET、POST、PUT、DELETE 的使用
3. **URL 构建**：了解了 URL 拼接和查询参数处理
4. **响应处理**：学会了响应内容的读取和错误处理
5. **异常处理**：掌握了 GeoServer 异常的捕获和处理
6. **资源管理**：理解了 Dispose 模式和生命周期管理
7. **高级功能**：学习了拦截器、日志和缓存等高级特性
8. **单元测试**：学会了如何为 HTTP 客户端编写测试

下一章将学习工作空间管理 API 的具体使用。

---

**相关资源**：
- [HttpClient 最佳实践](https://docs.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines)
- [Dispose 模式](https://docs.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose)
- [异步编程](https://docs.microsoft.com/en-us/dotnet/csharp/async)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第03章-HTTP客户端基础设施详解/第02章-环境准备与客户端配置/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第03章-HTTP客户端基础设施详解/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第03章-HTTP客户端基础设施详解/第04章-工作空间管理API实战/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
