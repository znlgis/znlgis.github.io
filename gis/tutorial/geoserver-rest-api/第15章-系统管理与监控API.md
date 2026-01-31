# 第15章：系统管理与监控API

## 15.1 系统管理概述

GeoServer提供了完善的系统管理API，用于监控服务器状态、管理配置、查看日志等。

## 15.2 AboutService - 系统信息

```csharp
var aboutService = factory.CreateAboutService();

// 获取版本信息
var version = await aboutService.GetVersionAsync();
Console.WriteLine($"GeoServer 版本: {version.Version}");
Console.WriteLine($"Git 版本: {version.GitRevision}");

// 获取系统状态
var status = await aboutService.GetStatusAsync();
Console.WriteLine($"JVM 版本: {status.JVM.Version}");
Console.WriteLine($"内存使用: {status.JVM.UsedMemory}/{status.JVM.TotalMemory}");
```

## 15.3 ReloadService - 配置重载

```csharp
var reloadService = factory.CreateReloadService();

// 重载配置
await reloadService.ReloadAsync();

// 重置缓存
await reloadService.ResetAsync();
```

## 15.4 LoggingService - 日志管理

```csharp
var loggingService = factory.CreateLoggingService();

// 获取日志配置
var loggingConfig = await loggingService.GetLoggingConfigAsync();

// 设置日志级别
loggingConfig.Level = "DEBUG";
loggingConfig.Location = "/var/log/geoserver/geoserver.log";
loggingConfig.StdOutLogging = true;

await loggingService.UpdateLoggingConfigAsync(loggingConfig);

// 获取日志内容
var logs = await loggingService.GetLogsAsync(1000); // 最后1000行
Console.WriteLine(logs);
```

## 15.5 MonitoringService - 监控服务

```csharp
var monitoringService = factory.CreateMonitoringService();

// 获取请求统计
var stats = await monitoringService.GetRequestStatsAsync();
Console.WriteLine($"总请求数: {stats.TotalRequests}");
Console.WriteLine($"成功请求: {stats.SuccessfulRequests}");
Console.WriteLine($"失败请求: {stats.FailedRequests}");
Console.WriteLine($"平均响应时间: {stats.AverageResponseTime}ms");
```

## 15.6 系统健康检查

```csharp
public class SystemHealthChecker
{
    public async Task<HealthReport> CheckHealthAsync()
    {
        var report = new HealthReport();
        
        // 检查服务器响应
        try
        {
            var version = await _aboutService.GetVersionAsync();
            report.IsOnline = true;
            report.Version = version.Version;
        }
        catch
        {
            report.IsOnline = false;
            return report;
        }
        
        // 检查内存使用
        var status = await _aboutService.GetStatusAsync();
        report.MemoryUsagePercent = 
            (double)status.JVM.UsedMemory / status.JVM.TotalMemory * 100;
        
        if (report.MemoryUsagePercent > 90)
        {
            report.Warnings.Add("内存使用率超过90%");
        }
        
        // 检查数据存储连接
        var dataStores = await _dataStoreService.GetDataStoresAsync("*");
        foreach (var ds in dataStores)
        {
            try
            {
                await _dataStoreService.ResetDataStoreAsync("workspace", ds.Name);
            }
            catch
            {
                report.Errors.Add($"数据存储 {ds.Name} 连接失败");
            }
        }
        
        return report;
    }
}

public class HealthReport
{
    public bool IsOnline { get; set; }
    public string Version { get; set; }
    public double MemoryUsagePercent { get; set; }
    public List<string> Warnings { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}
```

## 15.7 本章小结

本章学习了系统管理和监控API，包括版本信息获取、配置重载、日志管理和监控服务的使用。

---

**相关资源**：
- [GeoServer 监控文档](https://docs.geoserver.org/latest/en/user/community/monitoring/index.html)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第14章-资源与模板管理" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第16章-高级功能与扩展服务" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
