---
layout: default
title: 第04章：工作空间管理API实战
---

# 第04章：工作空间管理API实战

## 4.1 工作空间概念

### 4.1.1 什么是工作空间

工作空间（Workspace）是 GeoServer 中组织和管理资源的基本单元。它类似于数据库中的模式（Schema）或文件系统中的文件夹，用于：

- **逻辑分组**：将相关的数据存储、图层和样式组织在一起
- **命名空间隔离**：避免资源名称冲突
- **权限管理**：为不同的工作空间设置不同的访问权限
- **多租户支持**：在同一个 GeoServer 实例中为不同客户提供独立的工作环境

### 4.1.2 工作空间的作用

1. **资源组织**
   - 将属于同一项目或客户的资源放在同一工作空间
   - 便于管理和维护

2. **命名空间管理**
   - 每个工作空间关联一个URI命名空间
   - 确保要素类型的全局唯一性

3. **访问控制**
   - 为不同工作空间配置不同的安全策略
   - 实现细粒度的权限控制

4. **OGC服务隔离**
   - 可以为不同工作空间配置不同的OGC服务设置
   - 支持虚拟服务端点

### 4.1.3 工作空间的层次结构

```
GeoServer 实例
├── 工作空间 A
│   ├── 数据存储 1
│   │   ├── 要素类型 1
│   │   └── 要素类型 2
│   ├── 数据存储 2
│   └── 样式 1
├── 工作空间 B
│   ├── 数据存储 3
│   └── 覆盖范围存储 1
└── 工作空间 C
    └── WMS 存储 1
```

## 4.2 WorkspaceService 详解

### 4.2.1 服务概览

```csharp
public class WorkspaceService
{
    private readonly IGeoServerHttpClient _httpClient;

    public WorkspaceService(IGeoServerHttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    // 核心方法
    public async Task<Workspace[]> GetWorkspacesAsync();
    public async Task<Workspace> GetWorkspaceAsync(string workspaceName);
    public async Task CreateWorkspaceAsync(string workspaceName);
    public async Task UpdateWorkspaceAsync(string workspaceName, string newWorkspaceName);
    public async Task DeleteWorkspaceAsync(string workspaceName, bool recurse = false);
}
```

### 4.2.2 工作空间数据模型

```csharp
public class Workspace
{
    [JsonProperty("name")]
    public string Name { get; set; }

    [JsonProperty("href")]
    public string Href { get; set; }

    [JsonProperty("isolated")]
    public bool? Isolated { get; set; }

    [JsonProperty("dataStores")]
    public DataStoreListLink DataStores { get; set; }

    [JsonProperty("coverageStores")]
    public CoverageStoreListLink CoverageStores { get; set; }

    [JsonProperty("wmsStores")]
    public WMSStoreListLink WMSStores { get; set; }
}

// 包装器类
public class WorkspaceWrapper
{
    [JsonProperty("workspace")]
    public Workspace Workspace { get; set; }
}

public class WorkspaceListWrapper
{
    [JsonProperty("workspaces")]
    public WorkspaceList WorkspaceList { get; set; }
}

public class WorkspaceList
{
    [JsonProperty("workspace")]
    public Workspace[] Workspaces { get; set; }
}
```

## 4.3 获取工作空间列表

### 4.3.1 基本用法

```csharp
using GeoServerDesktop.GeoServerClient.Configuration;
using GeoServerDesktop.GeoServerClient.Services;

// 创建工厂和服务
var options = new GeoServerClientOptions
{
    BaseUrl = "http://localhost:8080/geoserver",
    Username = "admin",
    Password = "geoserver"
};

using var factory = new GeoServerClientFactory(options);
var workspaceService = factory.CreateWorkspaceService();

// 获取所有工作空间
var workspaces = await workspaceService.GetWorkspacesAsync();

// 输出结果
Console.WriteLine($"共找到 {workspaces.Length} 个工作空间:");
foreach (var workspace in workspaces)
{
    Console.WriteLine($"- {workspace.Name}");
}
```

**输出示例**：
```
共找到 4 个工作空间:
- cite
- tiger
- nurc
- topp
```

### 4.3.2 HTTP 请求详情

**请求**：
```http
GET /rest/workspaces.json HTTP/1.1
Host: localhost:8080
Authorization: Basic YWRtaW46Z2Vvc2VydmVy
Accept: application/json
```

**响应**：
```json
{
  "workspaces": {
    "workspace": [
      {
        "name": "cite",
        "href": "http://localhost:8080/geoserver/rest/workspaces/cite.json"
      },
      {
        "name": "tiger",
        "href": "http://localhost:8080/geoserver/rest/workspaces/tiger.json"
      }
    ]
  }
}
```

### 4.3.3 高级用法：按条件过滤

```csharp
public static class WorkspaceExtensions
{
    /// <summary>
    /// 按名称搜索工作空间
    /// </summary>
    public static Workspace[] SearchByName(
        this Workspace[] workspaces, 
        string searchTerm)
    {
        return workspaces
            .Where(w => w.Name.Contains(searchTerm, StringComparison.OrdinalIgnoreCase))
            .ToArray();
    }

    /// <summary>
    /// 获取隔离的工作空间
    /// </summary>
    public static Workspace[] GetIsolated(this Workspace[] workspaces)
    {
        return workspaces
            .Where(w => w.Isolated == true)
            .ToArray();
    }

    /// <summary>
    /// 按名称排序
    /// </summary>
    public static Workspace[] SortByName(
        this Workspace[] workspaces,
        bool descending = false)
    {
        return descending
            ? workspaces.OrderByDescending(w => w.Name).ToArray()
            : workspaces.OrderBy(w => w.Name).ToArray();
    }
}

// 使用示例
var workspaces = await workspaceService.GetWorkspacesAsync();

// 搜索包含 "test" 的工作空间
var testWorkspaces = workspaces.SearchByName("test");

// 获取隔离工作空间
var isolatedWorkspaces = workspaces.GetIsolated();

// 按名称排序
var sortedWorkspaces = workspaces.SortByName();
```

## 4.4 获取单个工作空间详情

### 4.4.1 基本用法

```csharp
// 获取特定工作空间的详细信息
var workspace = await workspaceService.GetWorkspaceAsync("tiger");

Console.WriteLine($"工作空间名称: {workspace.Name}");
Console.WriteLine($"资源链接: {workspace.Href}");
Console.WriteLine($"是否隔离: {workspace.Isolated}");
```

### 4.4.2 HTTP 请求详情

**请求**：
```http
GET /rest/workspaces/tiger.json HTTP/1.1
Host: localhost:8080
Authorization: Basic YWRtaW46Z2Vvc2VydmVy
Accept: application/json
```

**响应**：
```json
{
  "workspace": {
    "name": "tiger",
    "isolated": false,
    "dataStores": "http://localhost:8080/geoserver/rest/workspaces/tiger/datastores.json",
    "coverageStores": "http://localhost:8080/geoserver/rest/workspaces/tiger/coveragestores.json",
    "wmsStores": "http://localhost:8080/geoserver/rest/workspaces/tiger/wmsstores.json"
  }
}
```

### 4.4.3 错误处理

```csharp
public static class WorkspaceHelper
{
    /// <summary>
    /// 安全地获取工作空间，如果不存在返回 null
    /// </summary>
    public static async Task<Workspace> GetWorkspaceSafeAsync(
        this WorkspaceService service,
        string workspaceName)
    {
        try
        {
            return await service.GetWorkspaceAsync(workspaceName);
        }
        catch (GeoServerRequestException ex) when (ex.StatusCode == 404)
        {
            return null;
        }
    }

    /// <summary>
    /// 检查工作空间是否存在
    /// </summary>
    public static async Task<bool> WorkspaceExistsAsync(
        this WorkspaceService service,
        string workspaceName)
    {
        var workspace = await service.GetWorkspaceSafeAsync(workspaceName);
        return workspace != null;
    }
}

// 使用示例
var workspace = await workspaceService.GetWorkspaceSafeAsync("mayNotExist");
if (workspace == null)
{
    Console.WriteLine("工作空间不存在");
}

// 或者检查存在性
if (await workspaceService.WorkspaceExistsAsync("myWorkspace"))
{
    Console.WriteLine("工作空间存在");
}
```

## 4.5 创建工作空间

### 4.5.1 基本创建

```csharp
// 创建新工作空间
await workspaceService.CreateWorkspaceAsync("myWorkspace");
Console.WriteLine("工作空间创建成功!");

// 验证创建
var workspace = await workspaceService.GetWorkspaceAsync("myWorkspace");
Console.WriteLine($"新工作空间: {workspace.Name}");
```

### 4.5.2 HTTP 请求详情

**请求**：
```http
POST /rest/workspaces HTTP/1.1
Host: localhost:8080
Authorization: Basic YWRtaW46Z2Vvc2VydmVy
Content-Type: application/json

{
  "workspace": {
    "name": "myWorkspace"
  }
}
```

**响应**：
```http
HTTP/1.1 201 Created
Location: http://localhost:8080/geoserver/rest/workspaces/myWorkspace
```

### 4.5.3 创建前检查

```csharp
/// <summary>
/// 创建工作空间（如果不存在）
/// </summary>
public static async Task<bool> CreateWorkspaceIfNotExistsAsync(
    this WorkspaceService service,
    string workspaceName)
{
    // 检查是否存在
    if (await service.WorkspaceExistsAsync(workspaceName))
    {
        Console.WriteLine($"工作空间 '{workspaceName}' 已存在");
        return false;
    }

    // 创建工作空间
    await service.CreateWorkspaceAsync(workspaceName);
    Console.WriteLine($"工作空间 '{workspaceName}' 创建成功");
    return true;
}

// 使用示例
await workspaceService.CreateWorkspaceIfNotExistsAsync("myWorkspace");
```

### 4.5.4 批量创建

```csharp
/// <summary>
/// 批量创建工作空间
/// </summary>
public static async Task<Dictionary<string, bool>> CreateWorkspacesAsync(
    this WorkspaceService service,
    params string[] workspaceNames)
{
    var results = new Dictionary<string, bool>();

    foreach (var name in workspaceNames)
    {
        try
        {
            await service.CreateWorkspaceAsync(name);
            results[name] = true;
            Console.WriteLine($"✓ 工作空间 '{name}' 创建成功");
        }
        catch (GeoServerRequestException ex) when (ex.StatusCode == 409)
        {
            results[name] = false;
            Console.WriteLine($"✗ 工作空间 '{name}' 已存在");
        }
        catch (Exception ex)
        {
            results[name] = false;
            Console.WriteLine($"✗ 工作空间 '{name}' 创建失败: {ex.Message}");
        }
    }

    return results;
}

// 使用示例
var results = await workspaceService.CreateWorkspacesAsync(
    "project1", "project2", "project3");

var successCount = results.Count(r => r.Value);
Console.WriteLine($"\n成功创建 {successCount}/{results.Count} 个工作空间");
```

## 4.6 更新工作空间

### 4.6.1 重命名工作空间

```csharp
// 重命名工作空间
await workspaceService.UpdateWorkspaceAsync("oldName", "newName");
Console.WriteLine("工作空间重命名成功!");

// 验证更新
var workspace = await workspaceService.GetWorkspaceAsync("newName");
Console.WriteLine($"新名称: {workspace.Name}");
```

### 4.6.2 HTTP 请求详情

**请求**：
```http
PUT /rest/workspaces/oldName HTTP/1.1
Host: localhost:8080
Authorization: Basic YWRtaW46Z2Vvc2VydmVy
Content-Type: application/json

{
  "workspace": {
    "name": "newName"
  }
}
```

**响应**：
```http
HTTP/1.1 200 OK
```

### 4.6.3 安全更新

```csharp
/// <summary>
/// 安全地重命名工作空间
/// </summary>
public static async Task<bool> RenameWorkspaceAsync(
    this WorkspaceService service,
    string oldName,
    string newName)
{
    try
    {
        // 检查源工作空间是否存在
        if (!await service.WorkspaceExistsAsync(oldName))
        {
            Console.WriteLine($"源工作空间 '{oldName}' 不存在");
            return false;
        }

        // 检查目标名称是否已被使用
        if (await service.WorkspaceExistsAsync(newName))
        {
            Console.WriteLine($"目标名称 '{newName}' 已被使用");
            return false;
        }

        // 执行重命名
        await service.UpdateWorkspaceAsync(oldName, newName);
        Console.WriteLine($"工作空间从 '{oldName}' 重命名为 '{newName}'");
        return true;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"重命名失败: {ex.Message}");
        return false;
    }
}

// 使用示例
var success = await workspaceService.RenameWorkspaceAsync("old", "new");
```

## 4.7 删除工作空间

### 4.7.1 非递归删除

```csharp
// 删除空工作空间（不包含任何资源）
await workspaceService.DeleteWorkspaceAsync("emptyWorkspace", recurse: false);
Console.WriteLine("空工作空间删除成功!");
```

**注意**：如果工作空间包含资源（数据存储、图层等），非递归删除会失败。

### 4.7.2 递归删除

```csharp
// 递归删除工作空间及其所有内容
await workspaceService.DeleteWorkspaceAsync("myWorkspace", recurse: true);
Console.WriteLine("工作空间及其所有资源已删除!");
```

**警告**：递归删除会永久删除工作空间中的所有资源，包括：
- 数据存储
- 图层
- 样式
- 要素类型

### 4.7.3 HTTP 请求详情

**非递归删除**：
```http
DELETE /rest/workspaces/myWorkspace?recurse=false HTTP/1.1
Host: localhost:8080
Authorization: Basic YWRtaW46Z2Vvc2VydmVy
```

**递归删除**：
```http
DELETE /rest/workspaces/myWorkspace?recurse=true HTTP/1.1
Host: localhost:8080
Authorization: Basic YWRtaW46Z2Vvc2VydmVy
```

### 4.7.4 安全删除

```csharp
/// <summary>
/// 安全删除工作空间（带确认）
/// </summary>
public static async Task<bool> DeleteWorkspaceSafeAsync(
    this WorkspaceService service,
    string workspaceName,
    bool recurse = false,
    bool requireConfirmation = true)
{
    try
    {
        // 检查工作空间是否存在
        if (!await service.WorkspaceExistsAsync(workspaceName))
        {
            Console.WriteLine($"工作空间 '{workspaceName}' 不存在");
            return false;
        }

        // 需要确认时
        if (requireConfirmation)
        {
            Console.WriteLine($"警告: 即将删除工作空间 '{workspaceName}'");
            if (recurse)
            {
                Console.WriteLine("这将递归删除所有关联资源!");
            }
            Console.Write("确认删除? (yes/no): ");
            var confirm = Console.ReadLine()?.ToLower();
            
            if (confirm != "yes")
            {
                Console.WriteLine("删除已取消");
                return false;
            }
        }

        // 执行删除
        await service.DeleteWorkspaceAsync(workspaceName, recurse);
        Console.WriteLine($"工作空间 '{workspaceName}' 已删除");
        return true;
    }
    catch (GeoServerRequestException ex) when (ex.StatusCode == 409)
    {
        Console.WriteLine($"无法删除: 工作空间包含资源。使用 recurse=true 强制删除");
        return false;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"删除失败: {ex.Message}");
        return false;
    }
}

// 使用示例
await workspaceService.DeleteWorkspaceSafeAsync(
    "myWorkspace",
    recurse: true,
    requireConfirmation: true);
```

## 4.8 完整示例：工作空间管理应用

### 4.8.1 控制台管理工具

```csharp
using System;
using System.Linq;
using System.Threading.Tasks;
using GeoServerDesktop.GeoServerClient.Configuration;
using GeoServerDesktop.GeoServerClient.Services;

namespace WorkspaceManager
{
    class Program
    {
        static async Task Main(string[] args)
        {
            // 配置
            var options = new GeoServerClientOptions
            {
                BaseUrl = "http://localhost:8080/geoserver",
                Username = "admin",
                Password = "geoserver"
            };

            using var factory = new GeoServerClientFactory(options);
            var service = factory.CreateWorkspaceService();

            // 显示菜单
            while (true)
            {
                Console.WriteLine("\n========== GeoServer 工作空间管理 ==========");
                Console.WriteLine("1. 列出所有工作空间");
                Console.WriteLine("2. 查看工作空间详情");
                Console.WriteLine("3. 创建工作空间");
                Console.WriteLine("4. 重命名工作空间");
                Console.WriteLine("5. 删除工作空间");
                Console.WriteLine("0. 退出");
                Console.Write("\n请选择操作: ");

                var choice = Console.ReadLine();

                try
                {
                    switch (choice)
                    {
                        case "1":
                            await ListWorkspaces(service);
                            break;
                        case "2":
                            await ViewWorkspace(service);
                            break;
                        case "3":
                            await CreateWorkspace(service);
                            break;
                        case "4":
                            await RenameWorkspace(service);
                            break;
                        case "5":
                            await DeleteWorkspace(service);
                            break;
                        case "0":
                            return;
                        default:
                            Console.WriteLine("无效选择");
                            break;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"\n错误: {ex.Message}");
                }

                Console.WriteLine("\n按任意键继续...");
                Console.ReadKey();
            }
        }

        static async Task ListWorkspaces(WorkspaceService service)
        {
            Console.WriteLine("\n获取工作空间列表...");
            var workspaces = await service.GetWorkspacesAsync();

            Console.WriteLine($"\n共找到 {workspaces.Length} 个工作空间:\n");
            
            for (int i = 0; i < workspaces.Length; i++)
            {
                Console.WriteLine($"{i + 1}. {workspaces[i].Name}");
            }
        }

        static async Task ViewWorkspace(WorkspaceService service)
        {
            Console.Write("\n输入工作空间名称: ");
            var name = Console.ReadLine();

            var workspace = await service.GetWorkspaceSafeAsync(name);
            if (workspace == null)
            {
                Console.WriteLine($"工作空间 '{name}' 不存在");
                return;
            }

            Console.WriteLine($"\n工作空间详情:");
            Console.WriteLine($"名称: {workspace.Name}");
            Console.WriteLine($"隔离: {workspace.Isolated}");
            Console.WriteLine($"资源链接: {workspace.Href}");
        }

        static async Task CreateWorkspace(WorkspaceService service)
        {
            Console.Write("\n输入新工作空间名称: ");
            var name = Console.ReadLine();

            if (string.IsNullOrWhiteSpace(name))
            {
                Console.WriteLine("名称不能为空");
                return;
            }

            await service.CreateWorkspaceIfNotExistsAsync(name);
        }

        static async Task RenameWorkspace(WorkspaceService service)
        {
            Console.Write("\n输入当前工作空间名称: ");
            var oldName = Console.ReadLine();

            Console.Write("输入新名称: ");
            var newName = Console.ReadLine();

            await service.RenameWorkspaceAsync(oldName, newName);
        }

        static async Task DeleteWorkspace(WorkspaceService service)
        {
            Console.Write("\n输入要删除的工作空间名称: ");
            var name = Console.ReadLine();

            Console.Write("是否递归删除所有资源? (yes/no): ");
            var recurse = Console.ReadLine()?.ToLower() == "yes";

            await service.DeleteWorkspaceSafeAsync(name, recurse, requireConfirmation: true);
        }
    }
}
```

### 4.8.2 Web API 控制器

```csharp
using Microsoft.AspNetCore.Mvc;
using GeoServerDesktop.GeoServerClient.Configuration;
using GeoServerDesktop.GeoServerClient.Services;

namespace GeoServerApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkspacesController : ControllerBase
    {
        private readonly WorkspaceService _service;

        public WorkspacesController(GeoServerClientFactory factory)
        {
            _service = factory.CreateWorkspaceService();
        }

        /// <summary>
        /// 获取所有工作空间
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var workspaces = await _service.GetWorkspacesAsync();
            return Ok(workspaces);
        }

        /// <summary>
        /// 获取单个工作空间
        /// </summary>
        [HttpGet("{name}")]
        public async Task<IActionResult> Get(string name)
        {
            var workspace = await _service.GetWorkspaceSafeAsync(name);
            if (workspace == null)
                return NotFound($"Workspace '{name}' not found");

            return Ok(workspace);
        }

        /// <summary>
        /// 创建工作空间
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] WorkspaceCreateRequest request)
        {
            await _service.CreateWorkspaceAsync(request.Name);
            return CreatedAtAction(nameof(Get), new { name = request.Name }, null);
        }

        /// <summary>
        /// 更新工作空间
        /// </summary>
        [HttpPut("{name}")]
        public async Task<IActionResult> Update(string name, [FromBody] WorkspaceUpdateRequest request)
        {
            await _service.UpdateWorkspaceAsync(name, request.NewName);
            return NoContent();
        }

        /// <summary>
        /// 删除工作空间
        /// </summary>
        [HttpDelete("{name}")]
        public async Task<IActionResult> Delete(string name, [FromQuery] bool recurse = false)
        {
            await _service.DeleteWorkspaceAsync(name, recurse);
            return NoContent();
        }
    }

    public class WorkspaceCreateRequest
    {
        public string Name { get; set; }
    }

    public class WorkspaceUpdateRequest
    {
        public string NewName { get; set; }
    }
}
```

## 4.9 最佳实践

### 4.9.1 命名规范

```csharp
public static class WorkspaceNamingConventions
{
    /// <summary>
    /// 验证工作空间名称
    /// </summary>
    public static bool IsValidName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return false;

        // 名称只能包含字母、数字、下划线和连字符
        return Regex.IsMatch(name, @"^[a-zA-Z0-9_-]+$");
    }

    /// <summary>
    /// 规范化工作空间名称
    /// </summary>
    public static string NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty");

        // 转换为小写
        name = name.ToLowerInvariant();

        // 替换空格和特殊字符为下划线
        name = Regex.Replace(name, @"[^a-z0-9_-]", "_");

        // 移除连续的下划线
        name = Regex.Replace(name, @"_{2,}", "_");

        // 移除首尾的下划线
        name = name.Trim('_');

        return name;
    }

    /// <summary>
    /// 生成唯一的工作空间名称
    /// </summary>
    public static string GenerateUniqueName(string baseName, string suffix = null)
    {
        var normalizedBase = NormalizeName(baseName);
        var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        
        if (!string.IsNullOrWhiteSpace(suffix))
        {
            return $"{normalizedBase}_{suffix}_{timestamp}";
        }

        return $"{normalizedBase}_{timestamp}";
    }
}

// 使用示例
var name = "My Test Workspace!";
var normalizedName = WorkspaceNamingConventions.NormalizeName(name);
// 结果: "my_test_workspace"

var uniqueName = WorkspaceNamingConventions.GenerateUniqueName("project", "dev");
// 结果: "project_dev_20231211_143025"
```

### 4.9.2 错误恢复

```csharp
public class WorkspaceManager
{
    private readonly WorkspaceService _service;
    private readonly ILogger _logger;

    public WorkspaceManager(WorkspaceService service, ILogger logger)
    {
        _service = service;
        _logger = logger;
    }

    /// <summary>
    /// 创建工作空间（带重试）
    /// </summary>
    public async Task<bool> CreateWithRetryAsync(
        string workspaceName,
        int maxRetries = 3)
    {
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                await _service.CreateWorkspaceAsync(workspaceName);
                _logger.LogInformation($"工作空间 '{workspaceName}' 创建成功");
                return true;
            }
            catch (GeoServerRequestException ex) when (ex.StatusCode == 409)
            {
                _logger.LogWarning($"工作空间 '{workspaceName}' 已存在");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, 
                    $"创建工作空间失败 (尝试 {attempt}/{maxRetries}): {ex.Message}");

                if (attempt == maxRetries)
                {
                    _logger.LogError($"创建工作空间 '{workspaceName}' 最终失败");
                    return false;
                }

                // 等待后重试
                await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)));
            }
        }

        return false;
    }

    /// <summary>
    /// 批量操作事务
    /// </summary>
    public async Task<bool> CreateMultipleTransactionalAsync(
        string[] workspaceNames)
    {
        var createdWorkspaces = new List<string>();

        try
        {
            foreach (var name in workspaceNames)
            {
                await _service.CreateWorkspaceAsync(name);
                createdWorkspaces.Add(name);
                _logger.LogInformation($"已创建: {name}");
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "批量创建失败，开始回滚");

            // 回滚：删除已创建的工作空间
            foreach (var name in createdWorkspaces)
            {
                try
                {
                    await _service.DeleteWorkspaceAsync(name, recurse: true);
                    _logger.LogInformation($"已回滚: {name}");
                }
                catch (Exception rollbackEx)
                {
                    _logger.LogError(rollbackEx, $"回滚失败: {name}");
                }
            }

            return false;
        }
    }
}
```

### 4.9.3 性能优化

```csharp
public class WorkspaceCache
{
    private readonly WorkspaceService _service;
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _cacheDuration = TimeSpan.FromMinutes(5);

    public WorkspaceCache(WorkspaceService service, IMemoryCache cache)
    {
        _service = service;
        _cache = cache;
    }

    /// <summary>
    /// 获取工作空间（带缓存）
    /// </summary>
    public async Task<Workspace[]> GetWorkspacesAsync(bool forceRefresh = false)
    {
        const string cacheKey = "all_workspaces";

        if (!forceRefresh && _cache.TryGetValue(cacheKey, out Workspace[] cachedWorkspaces))
        {
            return cachedWorkspaces;
        }

        var workspaces = await _service.GetWorkspacesAsync();
        
        _cache.Set(cacheKey, workspaces, _cacheDuration);

        return workspaces;
    }

    /// <summary>
    /// 获取单个工作空间（带缓存）
    /// </summary>
    public async Task<Workspace> GetWorkspaceAsync(
        string workspaceName,
        bool forceRefresh = false)
    {
        var cacheKey = $"workspace_{workspaceName}";

        if (!forceRefresh && _cache.TryGetValue(cacheKey, out Workspace cachedWorkspace))
        {
            return cachedWorkspace;
        }

        var workspace = await _service.GetWorkspaceAsync(workspaceName);
        
        _cache.Set(cacheKey, workspace, _cacheDuration);

        return workspace;
    }

    /// <summary>
    /// 清除缓存
    /// </summary>
    public void ClearCache()
    {
        // 实现缓存清除逻辑
    }
}
```

## 4.10 本章小结

本章详细介绍了 GeoServer 工作空间管理的各个方面：

1. **工作空间概念**：理解了工作空间的作用和层次结构
2. **WorkspaceService**：学习了服务接口和数据模型
3. **CRUD 操作**：掌握了创建、读取、更新、删除工作空间的方法
4. **错误处理**：学会了安全操作和异常处理
5. **实战示例**：通过完整示例理解实际应用
6. **最佳实践**：学习了命名规范、错误恢复和性能优化

下一章将学习数据存储管理 API，了解如何连接和管理各种数据源。

---

**相关资源**：
- [GeoServer 工作空间文档](https://docs.geoserver.org/latest/en/user/data/webadmin/workspaces.html)
- [GeoServer REST API - Workspaces](https://docs.geoserver.org/latest/en/api/#1.0.0/workspaces.yaml)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第03章-HTTP客户端基础设施详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第05章-数据存储管理API详解/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
