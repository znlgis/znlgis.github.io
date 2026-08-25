---
layout: default
title: 第08章：图层组管理API
---

# 第08章：图层组管理API

## 8.1 图层组概述

图层组（Layer Group）是 GeoServer 中将多个图层组合在一起作为单一服务发布的功能。它允许用户将相关的图层打包成一个逻辑单元，简化客户端的调用和管理。

### 8.1.1 图层组的优势

1. **简化客户端调用**
   - 一次请求获取多个图层
   - 减少网络请求次数
   - 统一的边界框和坐标系

2. **逻辑组织**
   - 将相关图层组织在一起
   - 支持图层嵌套和分组
   - 便于权限管理

3. **性能优化**
   - 服务器端合并渲染
   - 减少客户端渲染负担
   - 支持缓存整个图层组

4. **应用场景**
   - 底图组合（道路 + 建筑 + 水系）
   - 专题地图（人口 + 行政区划 + 统计）
   - 时间序列数据组合

### 8.1.2 图层组类型

GeoServer 支持多种图层组模式：

- **SINGLE**：单一图层组，所有图层合并为一个
- **OPAQUE CONTAINER**：不透明容器，图层组作为整体
- **NAMED TREE**：命名树，保持图层层次结构
- **CONTAINER TREE**：容器树，支持嵌套图层组

## 8.2 LayerGroupService 核心功能

### 8.2.1 服务接口

```csharp
public class LayerGroupService
{
    private readonly IGeoServerHttpClient _httpClient;

    public LayerGroupService(IGeoServerHttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    // 核心方法
    public async Task<LayerGroup[]> GetLayerGroupsAsync();
    public async Task<LayerGroup> GetLayerGroupAsync(string layerGroupName);
    public async Task CreateLayerGroupAsync(LayerGroup layerGroup);
    public async Task UpdateLayerGroupAsync(string layerGroupName, LayerGroup layerGroup);
    public async Task DeleteLayerGroupAsync(string layerGroupName);
    
    // 工作空间级别的图层组
    public async Task<LayerGroup[]> GetWorkspaceLayerGroupsAsync(string workspaceName);
    public async Task<LayerGroup> GetWorkspaceLayerGroupAsync(string workspaceName, string layerGroupName);
    public async Task CreateWorkspaceLayerGroupAsync(string workspaceName, LayerGroup layerGroup);
}
```

### 8.2.2 数据模型

```csharp
public class LayerGroup
{
    [JsonProperty("name")]
    public string Name { get; set; }

    [JsonProperty("mode")]
    public string Mode { get; set; } // SINGLE, OPAQUE_CONTAINER, NAMED, EO

    [JsonProperty("title")]
    public string Title { get; set; }

    [JsonProperty("abstractTxt")]
    public string Abstract { get; set; }

    [JsonProperty("workspace")]
    public WorkspaceReference Workspace { get; set; }

    [JsonProperty("publishables")]
    public PublishableList Publishables { get; set; }

    [JsonProperty("styles")]
    public StyleList Styles { get; set; }

    [JsonProperty("bounds")]
    public Bounds Bounds { get; set; }

    [JsonProperty("metadata")]
    public MetadataList Metadata { get; set; }
}

public class PublishableList
{
    [JsonProperty("published")]
    public Published[] Published { get; set; }
}

public class Published
{
    [JsonProperty("@type")]
    public string Type { get; set; } // layer, layerGroup

    [JsonProperty("name")]
    public string Name { get; set; }

    [JsonProperty("href")]
    public string Href { get; set; }
}

public class Bounds
{
    [JsonProperty("minx")]
    public double MinX { get; set; }

    [JsonProperty("maxx")]
    public double MaxX { get; set; }

    [JsonProperty("miny")]
    public double MinY { get; set; }

    [JsonProperty("maxy")]
    public double MaxY { get; set; }

    [JsonProperty("crs")]
    public string CRS { get; set; }
}
```

## 8.3 获取图层组列表

### 8.3.1 基本用法

```csharp
using GeoServerDesktop.GeoServerClient.Configuration;
using GeoServerDesktop.GeoServerClient.Services;

var options = new GeoServerClientOptions
{
    BaseUrl = "http://localhost:8080/geoserver",
    Username = "admin",
    Password = "geoserver"
};

using var factory = new GeoServerClientFactory(options);
var layerGroupService = factory.CreateLayerGroupService();

// 获取所有图层组
var layerGroups = await layerGroupService.GetLayerGroupsAsync();

Console.WriteLine($"找到 {layerGroups.Length} 个图层组:");
foreach (var group in layerGroups)
{
    Console.WriteLine($"- {group.Name} ({group.Mode})");
}
```

### 8.3.2 获取特定工作空间的图层组

```csharp
// 获取工作空间中的图层组
var workspaceGroups = await layerGroupService.GetWorkspaceLayerGroupsAsync("myWorkspace");

Console.WriteLine($"工作空间 'myWorkspace' 中的图层组:");
foreach (var group in workspaceGroups)
{
    Console.WriteLine($"- {group.Name}");
    if (group.Publishables?.Published != null)
    {
        Console.WriteLine($"  包含 {group.Publishables.Published.Length} 个图层");
    }
}
```

## 8.4 创建图层组

### 8.4.1 创建简单图层组

```csharp
var layerGroup = new LayerGroup
{
    Name = "base_map",
    Title = "基础底图",
    Abstract = "包含道路、建筑和水系的基础底图",
    Mode = "SINGLE",
    Publishables = new PublishableList
    {
        Published = new[]
        {
            new Published
            {
                Type = "layer",
                Name = "roads"
            },
            new Published
            {
                Type = "layer",
                Name = "buildings"
            },
            new Published
            {
                Type = "layer",
                Name = "water"
            }
        }
    },
    Styles = new StyleList
    {
        Style = new[]
        {
            new StyleReference { Name = "line" },
            new StyleReference { Name = "polygon" },
            new StyleReference { Name = "polygon" }
        }
    }
};

await layerGroupService.CreateLayerGroupAsync(layerGroup);
Console.WriteLine("图层组创建成功!");
```

### 8.4.2 创建带边界框的图层组

```csharp
var layerGroup = new LayerGroup
{
    Name = "city_layers",
    Title = "城市图层组",
    Mode = "SINGLE",
    Publishables = new PublishableList
    {
        Published = new[]
        {
            new Published { Type = "layer", Name = "city_boundaries" },
            new Published { Type = "layer", Name = "city_roads" },
            new Published { Type = "layer", Name = "city_poi" }
        }
    },
    Bounds = new Bounds
    {
        MinX = -180,
        MaxX = 180,
        MinY = -90,
        MaxY = 90,
        CRS = "EPSG:4326"
    }
};

await layerGroupService.CreateLayerGroupAsync(layerGroup);
```

### 8.4.3 创建工作空间级别的图层组

```csharp
var workspaceLayerGroup = new LayerGroup
{
    Name = "project_layers",
    Title = "项目图层组",
    Workspace = new WorkspaceReference { Name = "myWorkspace" },
    Publishables = new PublishableList
    {
        Published = new[]
        {
            new Published 
            { 
                Type = "layer", 
                Name = "myWorkspace:layer1" 
            },
            new Published 
            { 
                Type = "layer", 
                Name = "myWorkspace:layer2" 
            }
        }
    }
};

await layerGroupService.CreateWorkspaceLayerGroupAsync(
    "myWorkspace", 
    workspaceLayerGroup);
```

## 8.5 嵌套图层组

### 8.5.1 创建嵌套图层组

```csharp
// 首先创建子图层组
var subGroup1 = new LayerGroup
{
    Name = "transportation",
    Title = "交通图层",
    Mode = "SINGLE",
    Publishables = new PublishableList
    {
        Published = new[]
        {
            new Published { Type = "layer", Name = "roads" },
            new Published { Type = "layer", Name = "railways" }
        }
    }
};

await layerGroupService.CreateLayerGroupAsync(subGroup1);

var subGroup2 = new LayerGroup
{
    Name = "facilities",
    Title = "设施图层",
    Mode = "SINGLE",
    Publishables = new PublishableList
    {
        Published = new[]
        {
            new Published { Type = "layer", Name = "schools" },
            new Published { Type = "layer", Name = "hospitals" }
        }
    }
};

await layerGroupService.CreateLayerGroupAsync(subGroup2);

// 创建父图层组，包含子图层组
var parentGroup = new LayerGroup
{
    Name = "complete_map",
    Title = "完整地图",
    Mode = "NAMED",
    Publishables = new PublishableList
    {
        Published = new[]
        {
            new Published { Type = "layerGroup", Name = "transportation" },
            new Published { Type = "layerGroup", Name = "facilities" },
            new Published { Type = "layer", Name = "boundaries" }
        }
    }
};

await layerGroupService.CreateLayerGroupAsync(parentGroup);
Console.WriteLine("嵌套图层组创建成功!");
```

## 8.6 更新图层组

### 8.6.1 添加图层到图层组

```csharp
// 获取现有图层组
var layerGroup = await layerGroupService.GetLayerGroupAsync("base_map");

// 添加新图层
var publishedList = layerGroup.Publishables.Published.ToList();
publishedList.Add(new Published
{
    Type = "layer",
    Name = "parks"
});
layerGroup.Publishables.Published = publishedList.ToArray();

// 同时添加对应的样式
var styleList = layerGroup.Styles.Style.ToList();
styleList.Add(new StyleReference { Name = "polygon" });
layerGroup.Styles.Style = styleList.ToArray();

// 更新图层组
await layerGroupService.UpdateLayerGroupAsync("base_map", layerGroup);
Console.WriteLine("图层添加成功!");
```

### 8.6.2 修改图层顺序

```csharp
// 获取图层组
var layerGroup = await layerGroupService.GetLayerGroupAsync("city_layers");

// 重新排序图层（底层在前，顶层在后）
var reorderedLayers = new[]
{
    new Published { Type = "layer", Name = "city_boundaries" },  // 底层
    new Published { Type = "layer", Name = "city_roads" },       // 中层
    new Published { Type = "layer", Name = "city_poi" }          // 顶层
};

layerGroup.Publishables.Published = reorderedLayers;

// 更新
await layerGroupService.UpdateLayerGroupAsync("city_layers", layerGroup);
Console.WriteLine("图层顺序更新成功!");
```

### 8.6.3 更新图层组模式

```csharp
// 将图层组从 SINGLE 模式改为 NAMED 模式
var layerGroup = await layerGroupService.GetLayerGroupAsync("base_map");
layerGroup.Mode = "NAMED";

await layerGroupService.UpdateLayerGroupAsync("base_map", layerGroup);
Console.WriteLine("图层组模式更新为 NAMED");
```

## 8.7 删除图层组

### 8.7.1 删除全局图层组

```csharp
try
{
    await layerGroupService.DeleteLayerGroupAsync("old_layer_group");
    Console.WriteLine("图层组删除成功!");
}
catch (GeoServerRequestException ex) when (ex.StatusCode == 404)
{
    Console.WriteLine("图层组不存在");
}
```

### 8.7.2 删除工作空间图层组

```csharp
// 删除特定工作空间中的图层组
await layerGroupService.DeleteWorkspaceLayerGroupAsync(
    "myWorkspace", 
    "project_layers");
Console.WriteLine("工作空间图层组删除成功!");
```

## 8.8 图层组管理工具

### 8.8.1 图层组验证工具

```csharp
public class LayerGroupValidator
{
    private readonly LayerGroupService _layerGroupService;
    private readonly LayerService _layerService;

    public LayerGroupValidator(
        LayerGroupService layerGroupService,
        LayerService layerService)
    {
        _layerGroupService = layerGroupService;
        _layerService = layerService;
    }

    /// <summary>
    /// 验证图层组中的所有图层是否存在
    /// </summary>
    public async Task<ValidationResult> ValidateLayerGroupAsync(string layerGroupName)
    {
        var result = new ValidationResult { IsValid = true };

        try
        {
            // 获取图层组
            var layerGroup = await _layerGroupService.GetLayerGroupAsync(layerGroupName);

            if (layerGroup.Publishables?.Published == null)
            {
                result.IsValid = false;
                result.Errors.Add("图层组不包含任何图层");
                return result;
            }

            // 验证每个图层
            foreach (var published in layerGroup.Publishables.Published)
            {
                if (published.Type == "layer")
                {
                    try
                    {
                        await _layerService.GetLayerAsync(published.Name);
                    }
                    catch (GeoServerRequestException ex) when (ex.StatusCode == 404)
                    {
                        result.IsValid = false;
                        result.Errors.Add($"图层 '{published.Name}' 不存在");
                    }
                }
            }

            // 验证样式数量
            if (layerGroup.Styles?.Style != null)
            {
                var layerCount = layerGroup.Publishables.Published.Length;
                var styleCount = layerGroup.Styles.Style.Length;

                if (layerCount != styleCount)
                {
                    result.Warnings.Add(
                        $"图层数量 ({layerCount}) 与样式数量 ({styleCount}) 不匹配");
                }
            }
        }
        catch (Exception ex)
        {
            result.IsValid = false;
            result.Errors.Add($"验证失败: {ex.Message}");
        }

        return result;
    }
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new List<string>();
    public List<string> Warnings { get; set; } = new List<string>();
}

// 使用示例
var validator = new LayerGroupValidator(layerGroupService, layerService);
var result = await validator.ValidateLayerGroupAsync("base_map");

if (!result.IsValid)
{
    Console.WriteLine("验证失败:");
    foreach (var error in result.Errors)
    {
        Console.WriteLine($"  - {error}");
    }
}

if (result.Warnings.Any())
{
    Console.WriteLine("警告:");
    foreach (var warning in result.Warnings)
    {
        Console.WriteLine($"  - {warning}");
    }
}
```

### 8.8.2 图层组克隆工具

```csharp
public class LayerGroupCloner
{
    private readonly LayerGroupService _service;

    public LayerGroupCloner(LayerGroupService service)
    {
        _service = service;
    }

    /// <summary>
    /// 克隆图层组到新名称
    /// </summary>
    public async Task<bool> CloneLayerGroupAsync(
        string sourceGroupName,
        string targetGroupName,
        string targetWorkspace = null)
    {
        try
        {
            // 获取源图层组
            var sourceGroup = await _service.GetLayerGroupAsync(sourceGroupName);

            // 创建副本
            var targetGroup = new LayerGroup
            {
                Name = targetGroupName,
                Title = $"{sourceGroup.Title} (副本)",
                Abstract = sourceGroup.Abstract,
                Mode = sourceGroup.Mode,
                Publishables = sourceGroup.Publishables,
                Styles = sourceGroup.Styles,
                Bounds = sourceGroup.Bounds
            };

            // 如果指定了工作空间
            if (!string.IsNullOrWhiteSpace(targetWorkspace))
            {
                targetGroup.Workspace = new WorkspaceReference 
                { 
                    Name = targetWorkspace 
                };
                
                await _service.CreateWorkspaceLayerGroupAsync(
                    targetWorkspace, 
                    targetGroup);
            }
            else
            {
                await _service.CreateLayerGroupAsync(targetGroup);
            }

            Console.WriteLine($"图层组 '{sourceGroupName}' 已克隆为 '{targetGroupName}'");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"克隆失败: {ex.Message}");
            return false;
        }
    }
}

// 使用示例
var cloner = new LayerGroupCloner(layerGroupService);
await cloner.CloneLayerGroupAsync("base_map", "base_map_copy");
await cloner.CloneLayerGroupAsync("base_map", "base_map_ws", "myWorkspace");
```

### 8.8.3 批量图层组管理

```csharp
public class LayerGroupBatchManager
{
    private readonly LayerGroupService _service;

    public LayerGroupBatchManager(LayerGroupService service)
    {
        _service = service;
    }

    /// <summary>
    /// 批量创建图层组
    /// </summary>
    public async Task<Dictionary<string, bool>> CreateMultipleLayerGroupsAsync(
        params LayerGroup[] layerGroups)
    {
        var results = new Dictionary<string, bool>();

        foreach (var layerGroup in layerGroups)
        {
            try
            {
                await _service.CreateLayerGroupAsync(layerGroup);
                results[layerGroup.Name] = true;
                Console.WriteLine($"✓ 图层组 '{layerGroup.Name}' 创建成功");
            }
            catch (Exception ex)
            {
                results[layerGroup.Name] = false;
                Console.WriteLine($"✗ 图层组 '{layerGroup.Name}' 创建失败: {ex.Message}");
            }
        }

        return results;
    }

    /// <summary>
    /// 批量删除图层组
    /// </summary>
    public async Task<int> DeleteLayerGroupsByPatternAsync(string pattern)
    {
        var deleted = 0;
        var allGroups = await _service.GetLayerGroupsAsync();

        foreach (var group in allGroups)
        {
            if (group.Name.Contains(pattern, StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    await _service.DeleteLayerGroupAsync(group.Name);
                    deleted++;
                    Console.WriteLine($"✓ 删除图层组: {group.Name}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"✗ 删除失败 {group.Name}: {ex.Message}");
                }
            }
        }

        Console.WriteLine($"\n共删除 {deleted} 个图层组");
        return deleted;
    }
}
```

## 8.9 实战案例

### 8.9.1 创建多层次底图

```csharp
public async Task CreateBaseMapLayerGroupAsync()
{
    var layerGroupService = factory.CreateLayerGroupService();

    // 创建底图图层组
    var baseMap = new LayerGroup
    {
        Name = "base_map_complete",
        Title = "完整底图",
        Abstract = "包含多个层次的完整底图",
        Mode = "SINGLE",
        Publishables = new PublishableList
        {
            Published = new[]
            {
                // 底层 - 背景
                new Published { Type = "layer", Name = "background" },
                
                // 中层 - 自然要素
                new Published { Type = "layer", Name = "water_bodies" },
                new Published { Type = "layer", Name = "forests" },
                new Published { Type = "layer", Name = "elevation" },
                
                // 上层 - 人工要素
                new Published { Type = "layer", Name = "buildings" },
                new Published { Type = "layer", Name = "roads" },
                new Published { Type = "layer", Name = "railways" },
                
                // 顶层 - 标注
                new Published { Type = "layer", Name = "labels" }
            }
        },
        Styles = new StyleList
        {
            Style = new[]
            {
                new StyleReference { Name = "background_style" },
                new StyleReference { Name = "water_style" },
                new StyleReference { Name = "forest_style" },
                new StyleReference { Name = "elevation_style" },
                new StyleReference { Name = "building_style" },
                new StyleReference { Name = "road_style" },
                new StyleReference { Name = "railway_style" },
                new StyleReference { Name = "label_style" }
            }
        },
        Bounds = new Bounds
        {
            MinX = -180,
            MaxX = 180,
            MinY = -90,
            MaxY = 90,
            CRS = "EPSG:4326"
        }
    };

    await layerGroupService.CreateLayerGroupAsync(baseMap);
    Console.WriteLine("完整底图创建成功!");
}
```

### 8.9.2 按区域组织图层

```csharp
public async Task CreateRegionalLayerGroupsAsync()
{
    var layerGroupService = factory.CreateLayerGroupService();

    // 为不同区域创建图层组
    var regions = new[] { "north", "south", "east", "west", "central" };

    foreach (var region in regions)
    {
        var regionalGroup = new LayerGroup
        {
            Name = $"{region}_region",
            Title = $"{region.ToUpper()} 区域",
            Mode = "SINGLE",
            Publishables = new PublishableList
            {
                Published = new[]
                {
                    new Published { Type = "layer", Name = $"{region}_boundaries" },
                    new Published { Type = "layer", Name = $"{region}_cities" },
                    new Published { Type = "layer", Name = $"{region}_infrastructure" }
                }
            }
        };

        await layerGroupService.CreateLayerGroupAsync(regionalGroup);
        Console.WriteLine($"区域图层组 '{region}' 创建成功");
    }

    // 创建总图层组
    var nationalGroup = new LayerGroup
    {
        Name = "national_map",
        Title = "全国地图",
        Mode = "NAMED",
        Publishables = new PublishableList
        {
            Published = regions.Select(r => new Published
            {
                Type = "layerGroup",
                Name = $"{r}_region"
            }).ToArray()
        }
    };

    await layerGroupService.CreateLayerGroupAsync(nationalGroup);
    Console.WriteLine("全国地图图层组创建成功!");
}
```

## 8.10 最佳实践

### 8.10.1 图层组命名规范

```csharp
public static class LayerGroupNamingConventions
{
    /// <summary>
    /// 生成标准化的图层组名称
    /// </summary>
    public static string GenerateLayerGroupName(
        string purpose,
        string region = null,
        string version = null)
    {
        var parts = new List<string> { purpose.ToLowerInvariant() };

        if (!string.IsNullOrWhiteSpace(region))
            parts.Add(region.ToLowerInvariant());

        if (!string.IsNullOrWhiteSpace(version))
            parts.Add($"v{version}");

        return string.Join("_", parts);
    }
}

// 使用示例
var groupName = LayerGroupNamingConventions.GenerateLayerGroupName(
    "basemap", "beijing", "1");
// 结果: "basemap_beijing_v1"
```

### 8.10.2 图层组性能优化

```csharp
public class LayerGroupPerformanceOptimizer
{
    /// <summary>
    /// 优化建议
    /// </summary>
    public static List<string> GetOptimizationSuggestions(LayerGroup layerGroup)
    {
        var suggestions = new List<string>();

        // 检查图层数量
        var layerCount = layerGroup.Publishables?.Published?.Length ?? 0;
        if (layerCount > 10)
        {
            suggestions.Add($"图层数量较多 ({layerCount})，考虑拆分为多个子图层组");
        }

        // 检查边界框
        if (layerGroup.Bounds == null)
        {
            suggestions.Add("建议设置边界框以提高渲染性能");
        }

        // 检查模式
        if (layerCount > 5 && layerGroup.Mode == "NAMED")
        {
            suggestions.Add("对于多图层，SINGLE 模式可能有更好的性能");
        }

        return suggestions;
    }
}
```

### 8.10.3 错误处理

```csharp
public static class LayerGroupErrorHandler
{
    public static async Task<LayerGroup> GetLayerGroupSafeAsync(
        this LayerGroupService service,
        string layerGroupName)
    {
        try
        {
            return await service.GetLayerGroupAsync(layerGroupName);
        }
        catch (GeoServerRequestException ex) when (ex.StatusCode == 404)
        {
            return null;
        }
    }

    public static async Task<bool> LayerGroupExistsAsync(
        this LayerGroupService service,
        string layerGroupName)
    {
        var group = await service.GetLayerGroupSafeAsync(layerGroupName);
        return group != null;
    }
}
```

## 8.11 本章小结

本章详细介绍了 GeoServer 图层组管理的各个方面：

1. **图层组概念**：理解了图层组的优势和应用场景
2. **LayerGroupService**：学习了服务接口和数据模型
3. **CRUD 操作**：掌握了创建、读取、更新、删除图层组的方法
4. **嵌套图层组**：学会了创建多层次的图层组结构
5. **管理工具**：了解了验证、克隆和批量管理工具
6. **实战案例**：通过实例理解实际应用
7. **最佳实践**：学习了命名规范、性能优化和错误处理

下一章将学习命名空间管理，了解如何管理 GeoServer 的 URI 命名空间。

---

**相关资源**：
- [GeoServer 图层组文档](https://docs.geoserver.org/latest/en/user/data/webadmin/layergroups.html)
- [GeoServer REST API - Layer Groups](https://docs.geoserver.org/latest/en/api/#1.0.0/layergroups.yaml)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第07章-样式管理与SLD配置/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第09章-命名空间管理/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
