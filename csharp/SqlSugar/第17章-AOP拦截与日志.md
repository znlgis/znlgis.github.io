# 第17章：AOP拦截与日志

## 17.1 AOP概述

### 17.1.1 什么是AOP

AOP（面向切面编程）是SqlSugar提供的强大功能，允许开发者在SQL执行的各个阶段插入自定义逻辑，无需修改业务代码即可实现日志记录、性能监控、数据审计等横切关注点。

### 17.1.2 SqlSugar AOP支持的拦截点

| 拦截点 | 说明 | 典型用途 |
|--------|------|----------|
| OnLogExecuting | SQL执行前触发 | 记录SQL日志、参数检查 |
| OnLogExecuted | SQL执行后触发 | 记录执行时间、慢SQL监控 |
| OnError | SQL执行出错时触发 | 错误日志、告警通知 |
| OnDiffLogEvent | 数据变更时触发 | 数据审计、变更记录 |
| DataExecuting | 数据操作前触发 | 自动填充字段、数据校验 |
| DataExecuted | 数据操作后触发 | 后处理逻辑 |
| OnLogExecuting（Filter） | 查询过滤器 | 多租户、软删除过滤 |

## 17.2 SQL日志拦截

### 17.2.1 基本SQL日志

```csharp
var db = new SqlSugarClient(new ConnectionConfig()
{
    ConnectionString = "连接字符串",
    DbType = DbType.SqlServer,
    IsAutoCloseConnection = true
});

// SQL执行前
db.Aop.OnLogExecuting = (sql, pars) =>
{
    Console.WriteLine($"【SQL】{sql}");
    Console.WriteLine($"【参数】{string.Join(",", pars?.Select(p => $"{p.ParameterName}={p.Value}"))}");
};

// SQL执行后
db.Aop.OnLogExecuted = (sql, pars) =>
{
    Console.WriteLine($"【耗时】{db.Ado.SqlExecutionTime.TotalMilliseconds}ms");
};
```

### 17.2.2 慢SQL监控

```csharp
db.Aop.OnLogExecuted = (sql, pars) =>
{
    // 超过1秒的SQL记录为慢SQL
    if (db.Ado.SqlExecutionTime.TotalSeconds > 1)
    {
        var fileName = $"SlowSql_{DateTime.Now:yyyyMMdd}.log";
        var content = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] 耗时:{db.Ado.SqlExecutionTime.TotalMilliseconds}ms\n{sql}\n参数:{string.Join(",", pars?.Select(p => $"{p.ParameterName}={p.Value}"))}\n\n";
        File.AppendAllText(fileName, content);
    }
};
```

### 17.2.3 结合日志框架（Serilog/NLog）

```csharp
// 使用Serilog记录SQL日志
db.Aop.OnLogExecuting = (sql, pars) =>
{
    Log.Debug("SqlSugar执行SQL: {@Sql}, 参数: {@Parameters}", sql,
        pars?.Select(p => new { p.ParameterName, p.Value }));
};

db.Aop.OnLogExecuted = (sql, pars) =>
{
    var time = db.Ado.SqlExecutionTime.TotalMilliseconds;
    if (time > 1000)
        Log.Warning("慢SQL告警 耗时{Time}ms: {Sql}", time, sql);
    else
        Log.Debug("SQL执行完成 耗时{Time}ms", time);
};

db.Aop.OnError = (exp) =>
{
    Log.Error(exp, "SQL执行异常: {Message}", exp.Message);
};
```

## 17.3 错误拦截

### 17.3.1 全局错误处理

```csharp
db.Aop.OnError = (exp) =>
{
    // 记录错误SQL
    Console.WriteLine($"【错误SQL】{exp.Sql}");
    Console.WriteLine($"【错误信息】{exp.Message}");
    
    // 可以发送告警通知
    // SendAlertEmail(exp.Sql, exp.Message);
};
```

### 17.3.2 错误分类处理

```csharp
db.Aop.OnError = (exp) =>
{
    if (exp.Message.Contains("deadlock"))
    {
        Log.Error("检测到死锁: {Sql}", exp.Sql);
    }
    else if (exp.Message.Contains("timeout"))
    {
        Log.Error("SQL执行超时: {Sql}", exp.Sql);
    }
    else
    {
        Log.Error(exp, "SQL执行异常");
    }
};
```

## 17.4 数据变更审计（DiffLog）

### 17.4.1 基本用法

DiffLog可以自动记录数据变更前后的差异，适用于审计需求。

```csharp
// 更新时记录变更
db.Updateable(entity)
    .EnableDiffLogEvent(new DiffLogModel()
    {
        BusinessData = new { Title = "修改用户信息", UserId = currentUserId },
        OperationDescription = "管理员修改了用户信息"
    })
    .ExecuteCommand();

// 删除时记录变更
db.Deleteable<User>()
    .Where(u => u.Id == 1)
    .EnableDiffLogEvent()
    .ExecuteCommand();
```

### 17.4.2 配置DiffLog事件处理

```csharp
db.Aop.OnDiffLogEvent = (diffModel) =>
{
    // 操作前数据
    var beforeData = diffModel.BeforeData;
    // 操作后数据
    var afterData = diffModel.AfterData;
    // 业务数据
    var businessData = diffModel.BusinessData;
    // SQL信息
    var sql = diffModel.Sql;
    var parameters = diffModel.Parameters;
    // 变更的列
    var diffColumns = diffModel.DiffType;

    // 保存到审计日志表
    var auditLog = new AuditLog
    {
        TableName = diffModel.BeforeData?.FirstOrDefault()?.TableName,
        OperationType = diffModel.DiffType.ToString(),
        BeforeData = JsonConvert.SerializeObject(beforeData),
        AfterData = JsonConvert.SerializeObject(afterData),
        Sql = sql,
        BusinessData = JsonConvert.SerializeObject(businessData),
        CreateTime = DateTime.Now
    };

    // 使用新连接保存审计日志，避免事务冲突
    using var auditDb = new SqlSugarClient(connectionConfig);
    auditDb.Insertable(auditLog).ExecuteCommand();
};
```

## 17.5 数据操作拦截

### 17.5.1 DataExecuting - 自动填充字段

```csharp
db.Aop.DataExecuting = (oldValue, entityInfo) =>
{
    // 插入时自动填充创建时间
    if (entityInfo.OperationType == DataFilterType.InsertByObject)
    {
        if (entityInfo.PropertyName == "CreateTime")
        {
            entityInfo.SetValue(DateTime.Now);
        }
        if (entityInfo.PropertyName == "CreateBy")
        {
            entityInfo.SetValue(GetCurrentUser());
        }
        if (entityInfo.PropertyName == "Id" && entityInfo.EntityColumnInfo.IsPrimarykey
            && entityInfo.EntityColumnInfo.PropertyInfo.PropertyType == typeof(string))
        {
            entityInfo.SetValue(Guid.NewGuid().ToString("N"));
        }
    }

    // 更新时自动填充修改时间
    if (entityInfo.OperationType == DataFilterType.UpdateByObject)
    {
        if (entityInfo.PropertyName == "UpdateTime")
        {
            entityInfo.SetValue(DateTime.Now);
        }
        if (entityInfo.PropertyName == "UpdateBy")
        {
            entityInfo.SetValue(GetCurrentUser());
        }
    }
};
```

### 17.5.2 数据校验拦截

```csharp
db.Aop.DataExecuting = (oldValue, entityInfo) =>
{
    // 插入和更新时检查字符串长度
    if (entityInfo.EntityColumnInfo.PropertyInfo.PropertyType == typeof(string))
    {
        var value = oldValue?.ToString();
        var maxLength = entityInfo.EntityColumnInfo.Length;
        if (maxLength > 0 && value?.Length > maxLength)
        {
            throw new Exception($"字段 {entityInfo.PropertyName} 的值超过最大长度 {maxLength}");
        }
    }
};
```

## 17.6 全局查询过滤器

### 17.6.1 软删除过滤

```csharp
// 全局添加软删除过滤
db.QueryFilter.AddTableFilter<IDeletedFilter>(it => it.IsDeleted == false);

// 接口定义
public interface IDeletedFilter
{
    bool IsDeleted { get; set; }
}

// 实体实现接口
public class User : IDeletedFilter
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    public bool IsDeleted { get; set; }
}

// 查询时自动过滤已删除数据
var users = db.Queryable<User>().ToList();
// SQL: SELECT * FROM User WHERE IsDeleted = 0

// 需要查询所有数据时禁用过滤器
var allUsers = db.Queryable<User>().ClearFilter<IDeletedFilter>().ToList();
```

### 17.6.2 多租户过滤

```csharp
public interface ITenantFilter
{
    long TenantId { get; set; }
}

// 注册租户过滤器
db.QueryFilter.AddTableFilter<ITenantFilter>(it => it.TenantId == GetCurrentTenantId());
```

### 17.6.3 动态过滤器

```csharp
// 按表名动态添加过滤
db.QueryFilter.Add(new TableFilterItem<object>(FilterType.QueryFilter)
{
    FilterValue = it => new SqlSugarClient(new ConnectionConfig()).Ado.GetInt("1=1"),
    IsJoinQuery = true
});
```

## 17.7 在ASP.NET Core中集成AOP

### 17.7.1 统一配置

```csharp
public static class SqlSugarSetup
{
    public static void AddSqlSugarAop(this IServiceCollection services)
    {
        services.AddSingleton<ISqlSugarClient>(provider =>
        {
            var logger = provider.GetRequiredService<ILogger<SqlSugarClient>>();
            var httpContextAccessor = provider.GetRequiredService<IHttpContextAccessor>();

            var db = new SqlSugarScope(new ConnectionConfig()
            {
                ConnectionString = "连接字符串",
                DbType = DbType.SqlServer,
                IsAutoCloseConnection = true
            }, db =>
            {
                // SQL日志
                db.Aop.OnLogExecuting = (sql, pars) =>
                {
                    logger.LogDebug("执行SQL: {Sql}", sql);
                };

                db.Aop.OnLogExecuted = (sql, pars) =>
                {
                    var time = db.Ado.SqlExecutionTime.TotalMilliseconds;
                    if (time > 2000)
                        logger.LogWarning("慢SQL ({Time}ms): {Sql}", time, sql);
                };

                db.Aop.OnError = exp =>
                {
                    logger.LogError(exp, "SQL执行异常");
                };

                // 自动填充
                db.Aop.DataExecuting = (oldValue, entityInfo) =>
                {
                    var userId = httpContextAccessor.HttpContext?.User?.FindFirst("UserId")?.Value;

                    if (entityInfo.OperationType == DataFilterType.InsertByObject)
                    {
                        if (entityInfo.PropertyName == "CreateTime")
                            entityInfo.SetValue(DateTime.Now);
                        if (entityInfo.PropertyName == "CreateBy")
                            entityInfo.SetValue(userId);
                    }
                    if (entityInfo.OperationType == DataFilterType.UpdateByObject)
                    {
                        if (entityInfo.PropertyName == "UpdateTime")
                            entityInfo.SetValue(DateTime.Now);
                        if (entityInfo.PropertyName == "UpdateBy")
                            entityInfo.SetValue(userId);
                    }
                };

                // 全局过滤器
                db.QueryFilter.AddTableFilter<IDeletedFilter>(it => it.IsDeleted == false);
            });

            return db;
        });
    }
}
```

## 17.8 本章小结

本章详细介绍了SqlSugar的AOP拦截与日志功能：

- **OnLogExecuting/OnLogExecuted**：实现SQL执行日志和慢SQL监控
- **OnError**：全局错误捕获和分类处理
- **OnDiffLogEvent**：数据变更审计，记录操作前后的数据差异
- **DataExecuting**：自动填充创建时间、修改时间等公共字段
- **QueryFilter**：全局查询过滤器，实现软删除和多租户数据隔离
- **ASP.NET Core集成**：在依赖注入中统一配置AOP

AOP机制是SqlSugar的核心特色之一，合理使用AOP可以大幅减少重复代码，提升系统的可维护性和可观测性。

---

> **下一章预告**：下一章将介绍SqlSugar的缓存机制与性能优化策略，帮助你构建高性能的数据访问层。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第16章-大数据批量操作" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第18章-缓存与性能优化" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
