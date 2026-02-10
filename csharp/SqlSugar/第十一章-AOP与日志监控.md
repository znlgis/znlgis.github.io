# 第十一章：AOP与日志监控

## 目录
- [11.1 AOP概念与原理](#111-aop概念与原理)
  - [11.1.1 什么是AOP](#1111-什么是aop)
  - [11.1.2 SqlSugar中的AOP](#1112-sqlsugar中的aop)
- [11.2 SQL执行拦截](#112-sql执行拦截)
  - [11.2.1 OnLogExecuting事件](#1121-onlogexecuting事件)
  - [11.2.2 OnLogExecuted事件](#1122-onlogexecuted事件)
  - [11.2.3 OnError事件](#1123-onerror事件)
- [11.3 SQL动态修改](#113-sql动态修改)
  - [11.3.1 OnExecutingChangeSql](#1131-onexecutingchangesql)
  - [11.3.2 动态参数处理](#1132-动态参数处理)
- [11.4 数据拦截](#114-数据拦截)
  - [11.4.1 DataExecuting事件](#1141-dataexecuting事件)
  - [11.4.2 DataExecuted事件](#1142-dataexecuted事件)
- [11.5 自定义拦截器](#115-自定义拦截器)
- [11.6 日志系统集成](#116-日志系统集成)
  - [11.6.1 集成Serilog](#1161-集成serilog)
  - [11.6.2 集成NLog](#1162-集成nlog)
  - [11.6.3 集成Log4Net](#1163-集成log4net)
- [11.7 性能监控](#117-性能监控)
- [11.8 审计日志](#118-审计日志)
- [11.9 本章小结](#119-本章小结)

---

## 11.1 AOP概念与原理

### 11.1.1 什么是AOP

AOP（Aspect-Oriented Programming，面向切面编程）是一种编程范式，它允许我们在不修改原有代码的情况下，为程序添加新的功能。

**AOP的核心概念**：
- **切面（Aspect）**：横切关注点的模块化
- **连接点（Join Point）**：程序执行的某个特定位置
- **通知（Advice）**：在切面的某个特定连接点上执行的动作
- **切入点（Pointcut）**：匹配连接点的表达式

### 11.1.2 SqlSugar中的AOP

SqlSugar提供了丰富的AOP事件：

```csharp
public class SqlSugarAopDemo
{
    public static void ConfigureAop(SqlSugarClient db)
    {
        // SQL执行前
        db.Aop.OnLogExecuting = (sql, pars) =>
        {
            Console.WriteLine("SQL执行前");
        };
        
        // SQL执行后
        db.Aop.OnLogExecuted = (sql, pars) =>
        {
            Console.WriteLine("SQL执行后");
        };
        
        // SQL执行错误
        db.Aop.OnError = (exp) =>
        {
            Console.WriteLine("SQL执行错误");
        };
        
        // SQL执行前可修改
        db.Aop.OnExecutingChangeSql = (sql, pars) =>
        {
            return new KeyValuePair<string, SugarParameter[]>(sql, pars);
        };
        
        // 数据执行前
        db.Aop.DataExecuting = (oldValue, entityInfo) =>
        {
            Console.WriteLine("数据执行前");
        };
        
        // 数据执行后
        db.Aop.DataExecuted = (value, entityInfo) =>
        {
            Console.WriteLine("数据执行后");
        };
    }
}
```

## 11.2 SQL执行拦截

### 11.2.1 OnLogExecuting事件

SQL执行前触发，用于记录SQL和参数：

```csharp
// 基础SQL日志
db.Aop.OnLogExecuting = (sql, pars) =>
{
    Console.WriteLine($"执行SQL: {sql}");
    
    if (pars != null && pars.Length > 0)
    {
        Console.WriteLine("参数:");
        foreach (var par in pars)
        {
            Console.WriteLine($"  {par.ParameterName} = {par.Value}");
        }
    }
};

// 高级SQL日志（包含执行时间）
db.Aop.OnLogExecuting = (sql, pars) =>
{
    // 记录开始时间
    var startTime = DateTime.Now;
    Console.WriteLine($"[{startTime:yyyy-MM-dd HH:mm:ss.fff}] 开始执行SQL");
    Console.WriteLine($"SQL: {sql}");
    
    // 格式化参数
    if (pars != null && pars.Length > 0)
    {
        var paramsStr = string.Join(", ", 
            pars.Select(p => $"{p.ParameterName}={p.Value}"));
        Console.WriteLine($"参数: {paramsStr}");
    }
    
    // 保存到上下文，用于计算执行时间
    db.Ado.SqlExecutionTime = Stopwatch.StartNew();
};

// 详细日志（包含调用栈）
db.Aop.OnLogExecuting = (sql, pars) =>
{
    var sb = new StringBuilder();
    sb.AppendLine("========== SQL执行日志 ==========");
    sb.AppendLine($"时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
    sb.AppendLine($"SQL: {sql}");
    
    if (pars != null && pars.Length > 0)
    {
        sb.AppendLine("参数:");
        foreach (var par in pars)
        {
            sb.AppendLine($"  {par.ParameterName} = {par.Value} ({par.DbType})");
        }
    }
    
    // 获取调用栈
    var stackTrace = new StackTrace(true);
    sb.AppendLine("调用栈:");
    for (int i = 0; i < Math.Min(5, stackTrace.FrameCount); i++)
    {
        var frame = stackTrace.GetFrame(i);
        var method = frame.GetMethod();
        sb.AppendLine($"  at {method.DeclaringType?.Name}.{method.Name}");
    }
    
    sb.AppendLine("================================");
    Console.WriteLine(sb.ToString());
};
```

### 11.2.2 OnLogExecuted事件

SQL执行后触发，用于记录执行结果和耗时：

```csharp
// 记录执行时间
db.Aop.OnLogExecuted = (sql, pars) =>
{
    var stopwatch = db.Ado.SqlExecutionTime as Stopwatch;
    if (stopwatch != null)
    {
        stopwatch.Stop();
        var elapsed = stopwatch.ElapsedMilliseconds;
        
        Console.WriteLine($"SQL执行完成，耗时: {elapsed}ms");
        
        // 慢查询警告
        if (elapsed > 1000)
        {
            Console.WriteLine($"⚠️ 慢查询警告: {elapsed}ms");
            Console.WriteLine($"SQL: {sql}");
        }
    }
};

// 完整的执行日志
db.Aop.OnLogExecuting = (sql, pars) =>
{
    db.Ado.SqlExecutionTime = new Dictionary<string, object>
    {
        ["StartTime"] = DateTime.Now,
        ["Stopwatch"] = Stopwatch.StartNew(),
        ["Sql"] = sql,
        ["Parameters"] = pars
    };
};

db.Aop.OnLogExecuted = (sql, pars) =>
{
    var context = db.Ado.SqlExecutionTime as Dictionary<string, object>;
    if (context != null)
    {
        var startTime = (DateTime)context["StartTime"];
        var stopwatch = (Stopwatch)context["Stopwatch"];
        stopwatch.Stop();
        
        var log = new
        {
            StartTime = startTime,
            EndTime = DateTime.Now,
            Duration = stopwatch.ElapsedMilliseconds,
            Sql = sql,
            Parameters = pars?.Select(p => new { p.ParameterName, p.Value }).ToList(),
            Status = "Success"
        };
        
        // 记录到日志系统
        Logger.LogInformation(JsonConvert.SerializeObject(log));
    }
};

// 统计SQL执行次数
private static ConcurrentDictionary<string, int> _sqlExecutionCount 
    = new ConcurrentDictionary<string, int>();

db.Aop.OnLogExecuted = (sql, pars) =>
{
    var sqlTemplate = GetSqlTemplate(sql);
    _sqlExecutionCount.AddOrUpdate(sqlTemplate, 1, (key, count) => count + 1);
    
    // 定期输出统计信息
    if (_sqlExecutionCount.Values.Sum() % 100 == 0)
    {
        Console.WriteLine("SQL执行统计:");
        foreach (var item in _sqlExecutionCount.OrderByDescending(x => x.Value).Take(10))
        {
            Console.WriteLine($"  执行{item.Value}次: {item.Key}");
        }
    }
};

static string GetSqlTemplate(string sql)
{
    // 移除参数值，只保留SQL模板
    return Regex.Replace(sql, @"'[^']*'|\d+", "?");
}
```

### 11.2.3 OnError事件

SQL执行错误时触发：

```csharp
// 基础错误日志
db.Aop.OnError = (exp) =>
{
    Console.WriteLine($"SQL执行错误: {exp.Message}");
    Console.WriteLine($"SQL: {exp.Sql}");
};

// 详细错误日志
db.Aop.OnError = (exp) =>
{
    var errorLog = new StringBuilder();
    errorLog.AppendLine("========== SQL执行错误 ==========");
    errorLog.AppendLine($"时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
    errorLog.AppendLine($"错误信息: {exp.Message}");
    errorLog.AppendLine($"SQL: {exp.Sql}");
    
    if (exp.Parametres != null && exp.Parametres.Length > 0)
    {
        errorLog.AppendLine("参数:");
        foreach (var par in exp.Parametres)
        {
            errorLog.AppendLine($"  {par.ParameterName} = {par.Value}");
        }
    }
    
    errorLog.AppendLine($"堆栈跟踪:\n{exp.StackTrace}");
    errorLog.AppendLine("================================");
    
    // 记录到日志文件
    File.AppendAllText("sql_errors.log", errorLog.ToString());
    
    // 发送错误通知
    SendErrorNotification(errorLog.ToString());
};

// 错误重试机制
db.Aop.OnError = (exp) =>
{
    // 判断是否为临时性错误（如超时、网络问题）
    if (IsTransientError(exp))
    {
        Console.WriteLine($"检测到临时性错误，将进行重试: {exp.Message}");
        // 重试逻辑由业务层处理
    }
    else
    {
        // 记录严重错误
        Logger.LogError(exp, "SQL执行失败");
    }
};

static bool IsTransientError(SqlSugarException exp)
{
    var message = exp.Message.ToLower();
    return message.Contains("timeout") 
        || message.Contains("deadlock") 
        || message.Contains("connection");
}

// 错误统计
private static ConcurrentDictionary<string, int> _errorCount 
    = new ConcurrentDictionary<string, int>();

db.Aop.OnError = (exp) =>
{
    var errorType = exp.GetType().Name;
    _errorCount.AddOrUpdate(errorType, 1, (key, count) => count + 1);
    
    Logger.LogError(exp, $"SQL错误 [总计:{_errorCount[errorType]}次]");
};
```

## 11.3 SQL动态修改

### 11.3.1 OnExecutingChangeSql

在SQL执行前动态修改SQL语句：

```csharp
// 添加WITH(NOLOCK)提示
db.Aop.OnExecutingChangeSql = (sql, pars) =>
{
    if (sql.Contains("SELECT") && !sql.Contains("WITH(NOLOCK)"))
    {
        // 为所有SELECT语句添加NOLOCK
        sql = Regex.Replace(sql, 
            @"FROM\s+(\w+)", 
            "FROM $1 WITH(NOLOCK)", 
            RegexOptions.IgnoreCase);
    }
    
    return new KeyValuePair<string, SugarParameter[]>(sql, pars);
};

// 动态添加租户过滤
db.Aop.OnExecutingChangeSql = (sql, pars) =>
{
    var tenantId = TenantContext.CurrentTenantId;
    
    if (tenantId > 0 && sql.Contains("FROM student"))
    {
        // 添加租户过滤条件
        if (sql.Contains("WHERE"))
        {
            sql = sql.Replace("WHERE", $"WHERE tenant_id = {tenantId} AND");
        }
        else
        {
            // 查找FROM后的位置
            var fromIndex = sql.IndexOf("FROM student", StringComparison.OrdinalIgnoreCase);
            var endIndex = sql.IndexOf(" ", fromIndex + 12);
            if (endIndex == -1) endIndex = sql.Length;
            
            sql = sql.Insert(endIndex, $" WHERE tenant_id = {tenantId}");
        }
    }
    
    return new KeyValuePair<string, SugarParameter[]>(sql, pars);
};

// SQL优化器
db.Aop.OnExecutingChangeSql = (sql, pars) =>
{
    // 移除不必要的空格
    sql = Regex.Replace(sql, @"\s+", " ");
    
    // 优化IN查询（当参数过多时转换为临时表）
    if (pars != null && pars.Length > 100)
    {
        // 实现大量参数的优化逻辑
        sql = OptimizeLargeInQuery(sql, pars);
    }
    
    return new KeyValuePair<string, SugarParameter[]>(sql, pars);
};

// SQL注入防护
db.Aop.OnExecutingChangeSql = (sql, pars) =>
{
    // 检测潜在的SQL注入
    if (ContainsSqlInjection(sql))
    {
        Logger.LogWarning($"检测到潜在的SQL注入: {sql}");
        throw new SecurityException("检测到不安全的SQL语句");
    }
    
    return new KeyValuePair<string, SugarParameter[]>(sql, pars);
};

static bool ContainsSqlInjection(string sql)
{
    var dangerousPatterns = new[]
    {
        @";\s*DROP\s+TABLE",
        @";\s*DELETE\s+FROM",
        @"EXEC\s*\(",
        @"EXECUTE\s*\("
    };
    
    return dangerousPatterns.Any(pattern => 
        Regex.IsMatch(sql, pattern, RegexOptions.IgnoreCase));
}
```

### 11.3.2 动态参数处理

```csharp
// 参数加密
db.Aop.OnExecutingChangeSql = (sql, pars) =>
{
    if (pars != null)
    {
        foreach (var par in pars)
        {
            // 对敏感参数进行加密
            if (par.ParameterName.Contains("Password") || 
                par.ParameterName.Contains("Secret"))
            {
                if (par.Value != null)
                {
                    par.Value = EncryptionHelper.Encrypt(par.Value.ToString());
                }
            }
        }
    }
    
    return new KeyValuePair<string, SugarParameter[]>(sql, pars);
};

// 参数验证
db.Aop.OnExecutingChangeSql = (sql, pars) =>
{
    if (pars != null)
    {
        foreach (var par in pars)
        {
            // 验证参数
            ValidateParameter(par);
        }
    }
    
    return new KeyValuePair<string, SugarParameter[]>(sql, pars);
};

static void ValidateParameter(SugarParameter par)
{
    if (par.Value == null) return;
    
    var value = par.Value.ToString();
    
    // 检查最大长度
    if (value.Length > 4000)
    {
        throw new ArgumentException($"参数 {par.ParameterName} 超过最大长度");
    }
    
    // 检查特殊字符
    if (par.ParameterName.Contains("Email") && !IsValidEmail(value))
    {
        throw new ArgumentException($"参数 {par.ParameterName} 不是有效的邮箱地址");
    }
}
```

## 11.4 数据拦截

### 11.4.1 DataExecuting事件

在数据插入或更新前触发：

```csharp
// 自动设置创建时间和更新时间
db.Aop.DataExecuting = (oldValue, entityInfo) =>
{
    if (entityInfo.OperationType == DataFilterType.InsertByObject)
    {
        // 插入操作
        if (entityInfo.PropertyName == "CreateTime")
        {
            entityInfo.SetValue(DateTime.Now);
        }
        if (entityInfo.PropertyName == "CreatorId")
        {
            entityInfo.SetValue(CurrentUser.Id);
        }
    }
    
    if (entityInfo.OperationType == DataFilterType.UpdateByObject)
    {
        // 更新操作
        if (entityInfo.PropertyName == "UpdateTime")
        {
            entityInfo.SetValue(DateTime.Now);
        }
        if (entityInfo.PropertyName == "UpdaterId")
        {
            entityInfo.SetValue(CurrentUser.Id);
        }
    }
};

// 软删除支持
db.Aop.DataExecuting = (oldValue, entityInfo) =>
{
    if (entityInfo.OperationType == DataFilterType.DeleteByObject)
    {
        // 拦截删除操作，改为软删除
        if (entityInfo.PropertyName == "IsDeleted")
        {
            entityInfo.SetValue(true);
        }
        if (entityInfo.PropertyName == "DeleteTime")
        {
            entityInfo.SetValue(DateTime.Now);
        }
    }
};

// 数据加密
db.Aop.DataExecuting = (oldValue, entityInfo) =>
{
    // 对敏感字段进行加密
    if (entityInfo.PropertyName == "Password" || 
        entityInfo.PropertyName == "IDCard")
    {
        var value = entityInfo.EntityValue?.ToString();
        if (!string.IsNullOrEmpty(value))
        {
            entityInfo.SetValue(EncryptionHelper.Encrypt(value));
        }
    }
};

// 数据验证
db.Aop.DataExecuting = (oldValue, entityInfo) =>
{
    if (entityInfo.OperationType == DataFilterType.InsertByObject ||
        entityInfo.OperationType == DataFilterType.UpdateByObject)
    {
        // 验证邮箱格式
        if (entityInfo.PropertyName == "Email")
        {
            var email = entityInfo.EntityValue?.ToString();
            if (!string.IsNullOrEmpty(email) && !IsValidEmail(email))
            {
                throw new ValidationException($"无效的邮箱地址: {email}");
            }
        }
        
        // 验证手机号格式
        if (entityInfo.PropertyName == "Phone")
        {
            var phone = entityInfo.EntityValue?.ToString();
            if (!string.IsNullOrEmpty(phone) && !IsValidPhone(phone))
            {
                throw new ValidationException($"无效的手机号: {phone}");
            }
        }
    }
};
```

### 11.4.2 DataExecuted事件

在数据操作完成后触发：

```csharp
// 数据解密
db.Aop.DataExecuted = (value, entityInfo) =>
{
    // 查询后解密敏感字段
    if (entityInfo.OperationType == DataFilterType.EntityQuery)
    {
        if (entityInfo.PropertyName == "Password" || 
            entityInfo.PropertyName == "IDCard")
        {
            var encryptedValue = value?.ToString();
            if (!string.IsNullOrEmpty(encryptedValue))
            {
                entityInfo.SetValue(EncryptionHelper.Decrypt(encryptedValue));
            }
        }
    }
};

// 数据脱敏
db.Aop.DataExecuted = (value, entityInfo) =>
{
    if (entityInfo.PropertyName == "Phone")
    {
        var phone = value?.ToString();
        if (!string.IsNullOrEmpty(phone) && phone.Length == 11)
        {
            // 手机号脱敏：138****5678
            entityInfo.SetValue($"{phone.Substring(0, 3)}****{phone.Substring(7)}");
        }
    }
    
    if (entityInfo.PropertyName == "IDCard")
    {
        var idCard = value?.ToString();
        if (!string.IsNullOrEmpty(idCard) && idCard.Length == 18)
        {
            // 身份证脱敏：110101********1234
            entityInfo.SetValue($"{idCard.Substring(0, 6)}********{idCard.Substring(14)}");
        }
    }
};

// 数据转换
db.Aop.DataExecuted = (value, entityInfo) =>
{
    // 枚举转换为描述
    if (entityInfo.PropertyType.IsEnum && value != null)
    {
        var enumValue = (Enum)value;
        var description = GetEnumDescription(enumValue);
        entityInfo.EntityColumnInfo.PropertyInfo
            .SetValue(entityInfo.EntityValue, description);
    }
};
```

## 11.5 自定义拦截器

创建完整的自定义拦截器：

```csharp
// 审计拦截器
public class AuditInterceptor
{
    private readonly SqlSugarClient _db;
    private readonly IAuditLogService _auditLogService;
    
    public AuditInterceptor(SqlSugarClient db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
        ConfigureAudit();
    }
    
    private void ConfigureAudit()
    {
        _db.Aop.DataExecuting = (oldValue, entityInfo) =>
        {
            if (entityInfo.OperationType == DataFilterType.UpdateByObject)
            {
                // 记录更新前的值
                var auditLog = new AuditLog
                {
                    TableName = entityInfo.EntityName,
                    PrimaryKeyValue = entityInfo.EntityColumnInfo.PropertyInfo
                        .GetValue(entityInfo.EntityValue)?.ToString(),
                    FieldName = entityInfo.PropertyName,
                    OldValue = oldValue?.ToString(),
                    NewValue = entityInfo.EntityValue?.ToString(),
                    OperationType = "Update",
                    OperatorId = CurrentUser.Id,
                    OperateTime = DateTime.Now
                };
                
                _auditLogService.Log(auditLog);
            }
        };
    }
}

// 性能监控拦截器
public class PerformanceInterceptor
{
    private readonly SqlSugarClient _db;
    private readonly ConcurrentDictionary<string, PerformanceMetrics> _metrics;
    
    public PerformanceInterceptor(SqlSugarClient db)
    {
        _db = db;
        _metrics = new ConcurrentDictionary<string, PerformanceMetrics>();
        ConfigurePerformanceMonitoring();
    }
    
    private void ConfigurePerformanceMonitoring()
    {
        _db.Aop.OnLogExecuting = (sql, pars) =>
        {
            var context = new ExecutionContext
            {
                Sql = sql,
                Parameters = pars,
                Stopwatch = Stopwatch.StartNew()
            };
            _db.Ado.SqlExecutionTime = context;
        };
        
        _db.Aop.OnLogExecuted = (sql, pars) =>
        {
            var context = _db.Ado.SqlExecutionTime as ExecutionContext;
            if (context != null)
            {
                context.Stopwatch.Stop();
                RecordMetrics(context);
            }
        };
    }
    
    private void RecordMetrics(ExecutionContext context)
    {
        var key = GetSqlKey(context.Sql);
        _metrics.AddOrUpdate(key,
            new PerformanceMetrics 
            { 
                SqlTemplate = key,
                Count = 1,
                TotalTime = context.Stopwatch.ElapsedMilliseconds,
                MinTime = context.Stopwatch.ElapsedMilliseconds,
                MaxTime = context.Stopwatch.ElapsedMilliseconds
            },
            (k, existing) =>
            {
                existing.Count++;
                existing.TotalTime += context.Stopwatch.ElapsedMilliseconds;
                existing.MinTime = Math.Min(existing.MinTime, context.Stopwatch.ElapsedMilliseconds);
                existing.MaxTime = Math.Max(existing.MaxTime, context.Stopwatch.ElapsedMilliseconds);
                return existing;
            });
    }
    
    public List<PerformanceMetrics> GetMetrics()
    {
        return _metrics.Values
            .OrderByDescending(m => m.AverageTime)
            .ToList();
    }
}

// 缓存拦截器
public class CacheInterceptor
{
    private readonly SqlSugarClient _db;
    private readonly IMemoryCache _cache;
    
    public CacheInterceptor(SqlSugarClient db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }
    
    public void EnableCache(int durationSeconds = 300)
    {
        _db.Aop.OnLogExecuting = (sql, pars) =>
        {
            var cacheKey = GenerateCacheKey(sql, pars);
            
            if (_cache.TryGetValue(cacheKey, out var cachedResult))
            {
                // 返回缓存结果
                _db.Ado.SqlExecutionTime = new { IsCached = true, Result = cachedResult };
            }
        };
        
        _db.Aop.OnLogExecuted = (sql, pars) =>
        {
            var context = _db.Ado.SqlExecutionTime;
            if (context == null || !(context is Dictionary<string, object> dict) || 
                !dict.ContainsKey("IsCached"))
            {
                // 缓存查询结果
                var cacheKey = GenerateCacheKey(sql, pars);
                _cache.Set(cacheKey, dict["Result"], TimeSpan.FromSeconds(durationSeconds));
            }
        };
    }
    
    private string GenerateCacheKey(string sql, SugarParameter[] pars)
    {
        var key = sql;
        if (pars != null && pars.Length > 0)
        {
            key += string.Join("_", pars.Select(p => $"{p.ParameterName}={p.Value}"));
        }
        return $"sql_cache_{key.GetHashCode()}";
    }
}
```

## 11.6 日志系统集成

### 11.6.1 集成Serilog

```csharp
public class SerilogIntegration
{
    public static void Configure(SqlSugarClient db)
    {
        // 配置Serilog
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .WriteTo.Console()
            .WriteTo.File("logs/sqlsugar-.txt", rollingInterval: RollingInterval.Day)
            .CreateLogger();
        
        // SQL执行日志
        db.Aop.OnLogExecuting = (sql, pars) =>
        {
            var paramsStr = pars != null 
                ? string.Join(", ", pars.Select(p => $"{p.ParameterName}={p.Value}"))
                : "";
            
            Log.Debug("执行SQL: {Sql}, 参数: {Parameters}", sql, paramsStr);
        };
        
        // SQL执行完成
        db.Aop.OnLogExecuted = (sql, pars) =>
        {
            var sw = db.Ado.SqlExecutionTime as Stopwatch;
            if (sw != null)
            {
                sw.Stop();
                Log.Information("SQL执行完成，耗时: {Duration}ms", sw.ElapsedMilliseconds);
                
                if (sw.ElapsedMilliseconds > 1000)
                {
                    Log.Warning("慢查询: {Duration}ms, SQL: {Sql}", 
                        sw.ElapsedMilliseconds, sql);
                }
            }
        };
        
        // SQL执行错误
        db.Aop.OnError = (exp) =>
        {
            Log.Error(exp, "SQL执行错误: {Sql}", exp.Sql);
        };
    }
}
```

### 11.6.2 集成NLog

```csharp
public class NLogIntegration
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    
    public static void Configure(SqlSugarClient db)
    {
        db.Aop.OnLogExecuting = (sql, pars) =>
        {
            var logEvent = new LogEventInfo(LogLevel.Debug, "SqlSugar", "执行SQL");
            logEvent.Properties["Sql"] = sql;
            logEvent.Properties["Parameters"] = JsonConvert.SerializeObject(
                pars?.Select(p => new { p.ParameterName, p.Value }));
            
            Logger.Log(logEvent);
        };
        
        db.Aop.OnLogExecuted = (sql, pars) =>
        {
            var sw = db.Ado.SqlExecutionTime as Stopwatch;
            if (sw != null)
            {
                sw.Stop();
                Logger.Info($"SQL执行完成，耗时: {sw.ElapsedMilliseconds}ms");
            }
        };
        
        db.Aop.OnError = (exp) =>
        {
            Logger.Error(exp, "SQL执行错误");
        };
    }
}
```

### 11.6.3 集成Log4Net

```csharp
public class Log4NetIntegration
{
    private static readonly ILog Logger = LogManager.GetLogger(typeof(Log4NetIntegration));
    
    public static void Configure(SqlSugarClient db)
    {
        db.Aop.OnLogExecuting = (sql, pars) =>
        {
            if (Logger.IsDebugEnabled)
            {
                var sb = new StringBuilder();
                sb.AppendLine($"执行SQL: {sql}");
                
                if (pars != null && pars.Length > 0)
                {
                    sb.AppendLine("参数:");
                    foreach (var par in pars)
                    {
                        sb.AppendLine($"  {par.ParameterName} = {par.Value}");
                    }
                }
                
                Logger.Debug(sb.ToString());
            }
        };
        
        db.Aop.OnError = (exp) =>
        {
            Logger.Error("SQL执行错误", exp);
        };
    }
}
```

## 11.7 性能监控

实现完整的性能监控系统：

```csharp
public class PerformanceMonitoringSystem
{
    private readonly ConcurrentDictionary<string, SqlPerformanceData> _performanceData;
    private readonly Timer _reportTimer;
    
    public PerformanceMonitoringSystem()
    {
        _performanceData = new ConcurrentDictionary<string, SqlPerformanceData>();
        _reportTimer = new Timer(GenerateReport, null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
    }
    
    public void Initialize(SqlSugarClient db)
    {
        db.Aop.OnLogExecuting = (sql, pars) =>
        {
            db.Ado.SqlExecutionTime = new ExecutionData
            {
                Sql = sql,
                Parameters = pars,
                StartTime = DateTime.Now,
                Stopwatch = Stopwatch.StartNew()
            };
        };
        
        db.Aop.OnLogExecuted = (sql, pars) =>
        {
            var data = db.Ado.SqlExecutionTime as ExecutionData;
            if (data != null)
            {
                data.Stopwatch.Stop();
                RecordPerformance(data);
            }
        };
    }
    
    private void RecordPerformance(ExecutionData data)
    {
        var key = GetSqlKey(data.Sql);
        
        _performanceData.AddOrUpdate(key,
            new SqlPerformanceData
            {
                SqlTemplate = key,
                ExecutionCount = 1,
                TotalDuration = data.Stopwatch.ElapsedMilliseconds,
                MinDuration = data.Stopwatch.ElapsedMilliseconds,
                MaxDuration = data.Stopwatch.ElapsedMilliseconds,
                LastExecutionTime = data.StartTime
            },
            (k, existing) =>
            {
                existing.ExecutionCount++;
                existing.TotalDuration += data.Stopwatch.ElapsedMilliseconds;
                existing.MinDuration = Math.Min(existing.MinDuration, data.Stopwatch.ElapsedMilliseconds);
                existing.MaxDuration = Math.Max(existing.MaxDuration, data.Stopwatch.ElapsedMilliseconds);
                existing.LastExecutionTime = data.StartTime;
                return existing;
            });
    }
    
    private void GenerateReport(object state)
    {
        var report = new StringBuilder();
        report.AppendLine("========== SQL性能报告 ==========");
        report.AppendLine($"报告时间: {DateTime.Now}");
        report.AppendLine();
        
        var topSlow = _performanceData.Values
            .OrderByDescending(d => d.AverageDuration)
            .Take(10);
        
        report.AppendLine("Top 10 慢查询:");
        foreach (var data in topSlow)
        {
            report.AppendLine($"  平均耗时: {data.AverageDuration}ms, 执行次数: {data.ExecutionCount}");
            report.AppendLine($"  SQL: {data.SqlTemplate}");
        }
        
        var topFrequent = _performanceData.Values
            .OrderByDescending(d => d.ExecutionCount)
            .Take(10);
        
        report.AppendLine();
        report.AppendLine("Top 10 高频查询:");
        foreach (var data in topFrequent)
        {
            report.AppendLine($"  执行次数: {data.ExecutionCount}, 平均耗时: {data.AverageDuration}ms");
            report.AppendLine($"  SQL: {data.SqlTemplate}");
        }
        
        report.AppendLine("================================");
        
        Console.WriteLine(report.ToString());
        File.AppendAllText("performance_report.log", report.ToString());
    }
    
    private string GetSqlKey(string sql)
    {
        return Regex.Replace(sql, @"'[^']*'|\d+", "?");
    }
}
```

## 11.8 审计日志

实现完整的审计日志系统：

```csharp
public class AuditLogSystem
{
    private readonly SqlSugarClient _db;
    private readonly SqlSugarClient _auditDb;
    
    public AuditLogSystem(SqlSugarClient db, SqlSugarClient auditDb)
    {
        _db = db;
        _auditDb = auditDb;
        ConfigureAudit();
    }
    
    private void ConfigureAudit()
    {
        _db.Aop.DataExecuting = (oldValue, entityInfo) =>
        {
            if (ShouldAudit(entityInfo))
            {
                var auditLog = CreateAuditLog(oldValue, entityInfo);
                SaveAuditLog(auditLog);
            }
        };
    }
    
    private bool ShouldAudit(DataFilterModel entityInfo)
    {
        // 只审计特定表的操作
        var auditTables = new[] { "User", "Order", "Product" };
        return auditTables.Contains(entityInfo.EntityName);
    }
    
    private AuditLog CreateAuditLog(object oldValue, DataFilterModel entityInfo)
    {
        return new AuditLog
        {
            TableName = entityInfo.EntityName,
            OperationType = entityInfo.OperationType.ToString(),
            FieldName = entityInfo.PropertyName,
            OldValue = oldValue?.ToString(),
            NewValue = entityInfo.EntityValue?.ToString(),
            PrimaryKey = GetPrimaryKeyValue(entityInfo),
            UserId = CurrentUser.Id,
            UserName = CurrentUser.Name,
            IpAddress = GetClientIp(),
            OperateTime = DateTime.Now
        };
    }
    
    private void SaveAuditLog(AuditLog log)
    {
        try
        {
            _auditDb.Insertable(log).ExecuteCommand();
        }
        catch (Exception ex)
        {
            // 审计日志失败不应影响主业务
            Logger.LogError(ex, "保存审计日志失败");
        }
    }
    
    private string GetPrimaryKeyValue(DataFilterModel entityInfo)
    {
        var pkProperty = entityInfo.EntityColumnInfo.PropertyInfo;
        return pkProperty?.GetValue(entityInfo.EntityValue)?.ToString();
    }
}

// 审计日志实体
public class AuditLog
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }
    
    public string TableName { get; set; }
    public string OperationType { get; set; }
    public string PrimaryKey { get; set; }
    public string FieldName { get; set; }
    public string OldValue { get; set; }
    public string NewValue { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; }
    public string IpAddress { get; set; }
    public DateTime OperateTime { get; set; }
}
```

## 11.9 本章小结

本章详细介绍了SqlSugar的AOP与日志监控功能：

1. **AOP概念**：理解了面向切面编程的基本概念和SqlSugar中的AOP实现
2. **SQL执行拦截**：掌握了OnLogExecuting、OnLogExecuted和OnError事件的使用
3. **SQL动态修改**：学会了使用OnExecutingChangeSql动态修改SQL和参数
4. **数据拦截**：实现了数据操作前后的拦截处理，如自动填充、加密解密
5. **自定义拦截器**：创建了审计、性能监控和缓存等自定义拦截器
6. **日志集成**：学会了与Serilog、NLog、Log4Net等主流日志框架的集成
7. **性能监控**：实现了完整的SQL性能监控和报告系统
8. **审计日志**：构建了完善的数据操作审计系统

通过本章的学习，您应该能够构建可监控、可审计的数据访问层，为系统的运维和问题排查提供强有力的支持。在下一章中，我们将学习SqlSugar的DbFirst与代码生成功能。
