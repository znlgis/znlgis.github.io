---
layout: default
title: 第五章：数据库操作与SqlSugar集成
---

# 第五章：数据库操作与SqlSugar集成

## 目录

1. [SqlSugar简介与配置](#1-sqlsugar简介与配置)
2. [仓储模式详解](#2-仓储模式详解)
3. [CRUD基础操作](#3-crud基础操作)
4. [高级查询技巧](#4-高级查询技巧)
5. [事务处理与并发控制](#5-事务处理与并发控制)
6. [数据库迁移与种子数据](#6-数据库迁移与种子数据)
7. [多数据库支持](#7-多数据库支持)
8. [性能优化与最佳实践](#8-性能优化与最佳实践)

---

## 1. SqlSugar简介与配置

### 1.1 什么是SqlSugar

SqlSugar是一款老牌的.NET开源ORM框架，具有以下特点：

- **高性能**：性能接近原生ADO.NET
- **多数据库支持**：支持MySQL、SQL Server、Oracle、PostgreSQL、SQLite、达梦等20+数据库
- **简单易用**：链式语法，学习成本低
- **功能丰富**：支持CodeFirst、DBFirst、读写分离、分表等

### 1.2 Admin.NET中的SqlSugar配置

**配置文件（appsettings.json）**：

```json
{
  "DbSettings": {
    "EnableInitDb": true,
    "EnableInitSeed": true,
    "EnableDiffLog": false,
    "EnableUnderLine": true,
    "DbConfigs": [
      {
        "ConfigId": "1300000000001",
        "DbType": "MySql",
        "ConnectionString": "Data Source=localhost;Database=AdminNET;User ID=root;Password=123456;pooling=true;port=3306;sslmode=none;CharSet=utf8mb4;AllowLoadLocalInfile=true",
        "IsAutoCloseConnection": true,
        "EnableSqlLog": true,
        "EnableDiffLog": false,
        "SlaveConnectionConfigs": []
      }
    ]
  }
}
```

**配置说明**：

| 配置项 | 说明 |
|--------|------|
| EnableInitDb | 是否自动创建数据库和表 |
| EnableInitSeed | 是否初始化种子数据 |
| EnableDiffLog | 是否启用差异日志 |
| EnableUnderLine | 是否将驼峰命名转换为下划线命名 |
| ConfigId | 数据库配置标识 |
| DbType | 数据库类型 |
| ConnectionString | 连接字符串 |
| IsAutoCloseConnection | 是否自动关闭连接 |
| EnableSqlLog | 是否启用SQL日志 |

### 1.3 SqlSugar服务注册

```csharp
// SqlSugar配置
public static class SqlSugarSetup
{
    public static void AddSqlSugar(this IServiceCollection services)
    {
        var dbSettings = App.GetConfig<DbSettings>("DbSettings");

        // 注册SqlSugar客户端
        services.AddSingleton<ISqlSugarClient>(sp =>
        {
            var connectionConfigs = dbSettings.DbConfigs.Select(config => new ConnectionConfig
            {
                ConfigId = config.ConfigId,
                DbType = (SqlSugar.DbType)Enum.Parse(typeof(SqlSugar.DbType), config.DbType),
                ConnectionString = config.ConnectionString,
                IsAutoCloseConnection = config.IsAutoCloseConnection,
                MoreSettings = new ConnMoreSettings
                {
                    IsAutoRemoveDataCache = true,
                    SqlServerCodeFirstNvarchar = true
                },
                ConfigureExternalServices = new ConfigureExternalServices
                {
                    EntityNameService = (type, entity) =>
                    {
                        // 驼峰转下划线
                        if (dbSettings.EnableUnderLine)
                            entity.DbTableName = UtilMethods.ToUnderLine(entity.DbTableName);
                    },
                    EntityService = (property, column) =>
                    {
                        // 驼峰转下划线
                        if (dbSettings.EnableUnderLine)
                            column.DbColumnName = UtilMethods.ToUnderLine(column.DbColumnName);

                        // 可空类型处理
                        if (column.IsPrimarykey == false && new NullabilityInfoContext()
                            .Create(property).WriteState is NullabilityState.Nullable)
                        {
                            column.IsNullable = true;
                        }
                    }
                }
            }).ToList();

            var db = new SqlSugarScope(connectionConfigs, db =>
            {
                connectionConfigs.ForEach(config =>
                {
                    var sqlSugarClient = db.GetConnectionScope((string)config.ConfigId);

                    // SQL执行日志
                    if (dbSettings.EnableSqlLog)
                    {
                        sqlSugarClient.Aop.OnLogExecuting = (sql, pars) =>
                        {
                            var sqlLog = $"【{DateTime.Now}】\n{UtilMethods.GetSqlString((SqlSugar.DbType)config.DbType, sql, pars)}";
                            Log.Information(sqlLog);
                        };
                    }

                    // 数据操作拦截
                    sqlSugarClient.Aop.DataExecuting = (oldValue, entityInfo) =>
                    {
                        // 新增操作
                        if (entityInfo.OperationType == DataFilterType.InsertByObject)
                        {
                            if (entityInfo.PropertyName == "CreateTime")
                                entityInfo.SetValue(DateTime.Now);
                            if (entityInfo.PropertyName == "CreateUserId")
                                entityInfo.SetValue(App.User?.FindFirstValue(ClaimConst.UserId));
                        }

                        // 更新操作
                        if (entityInfo.OperationType == DataFilterType.UpdateByObject)
                        {
                            if (entityInfo.PropertyName == "UpdateTime")
                                entityInfo.SetValue(DateTime.Now);
                            if (entityInfo.PropertyName == "UpdateUserId")
                                entityInfo.SetValue(App.User?.FindFirstValue(ClaimConst.UserId));
                        }
                    };

                    // 全局过滤器
                    SetupTableFilter(sqlSugarClient);
                });
            });

            return db;
        });

        // 注册仓储
        services.AddScoped(typeof(SqlSugarRepository<>));
    }

    /// <summary>
    /// 设置全局过滤器
    /// </summary>
    private static void SetupTableFilter(SqlSugarScopeProvider db)
    {
        // 软删除过滤器
        db.QueryFilter.AddTableFilter<IDeletedFilter>(d => d.IsDelete == false);

        // 租户过滤器
        db.QueryFilter.AddTableFilter<EntityTenant>(t => 
            t.TenantId == App.User.FindFirstValue<long?>(ClaimConst.TenantId));
    }
}
```

---

## 2. 仓储模式详解

### 2.1 仓储基类

Admin.NET封装了通用仓储类，提供常用的CRUD操作：

```csharp
/// <summary>
/// SqlSugar仓储类
/// </summary>
/// <typeparam name="T">实体类型</typeparam>
public class SqlSugarRepository<T> : SimpleClient<T> where T : class, new()
{
    public SqlSugarRepository(ISqlSugarClient context = null) : base(context)
    {
        Context = context ?? App.GetService<ISqlSugarClient>();
    }

    #region 扩展方法

    /// <summary>
    /// 获取可查询对象
    /// </summary>
    public ISugarQueryable<T> AsQueryable()
    {
        return Context.Queryable<T>();
    }

    /// <summary>
    /// 切换数据库
    /// </summary>
    public SqlSugarRepository<T> ChangeDb(object configId)
    {
        Context = ((SqlSugarScope)Context).GetConnectionScope(configId);
        return this;
    }

    /// <summary>
    /// 假删除（软删除）
    /// </summary>
    public async Task<bool> FakeDeleteAsync(T entity)
    {
        return await Context.Updateable(entity)
            .AS(GetTableName())
            .UpdateColumns(new[] { "IsDelete", "UpdateTime", "UpdateUserId" })
            .ExecuteCommandAsync() > 0;
    }

    /// <summary>
    /// 假删除（批量）
    /// </summary>
    public async Task<bool> FakeDeleteAsync(List<T> entities)
    {
        return await Context.Updateable(entities)
            .AS(GetTableName())
            .UpdateColumns(new[] { "IsDelete", "UpdateTime", "UpdateUserId" })
            .ExecuteCommandAsync() > 0;
    }

    /// <summary>
    /// 分页查询
    /// </summary>
    public async Task<SqlSugarPagedList<T>> ToPagedListAsync(int page, int pageSize)
    {
        return await AsQueryable().ToPagedListAsync(page, pageSize);
    }

    #endregion
}
```

### 2.2 仓储使用方式

```csharp
/// <summary>
/// 业务服务
/// </summary>
public class BusinessService : IDynamicApiController, ITransient
{
    private readonly SqlSugarRepository<Business> _businessRep;
    private readonly SqlSugarRepository<SysUser> _userRep;

    public BusinessService(
        SqlSugarRepository<Business> businessRep,
        SqlSugarRepository<SysUser> userRep)
    {
        _businessRep = businessRep;
        _userRep = userRep;
    }

    /// <summary>
    /// 查询单个
    /// </summary>
    public async Task<Business> GetById(long id)
    {
        return await _businessRep.GetByIdAsync(id);
    }

    /// <summary>
    /// 查询列表
    /// </summary>
    public async Task<List<Business>> GetList()
    {
        return await _businessRep.GetListAsync();
    }

    /// <summary>
    /// 新增
    /// </summary>
    public async Task<long> Add(Business entity)
    {
        return await _businessRep.InsertReturnSnowflakeIdAsync(entity);
    }

    /// <summary>
    /// 更新
    /// </summary>
    public async Task<bool> Update(Business entity)
    {
        return await _businessRep.UpdateAsync(entity);
    }

    /// <summary>
    /// 删除
    /// </summary>
    public async Task<bool> Delete(long id)
    {
        return await _businessRep.DeleteByIdAsync(id);
    }
}
```

### 2.3 直接使用ISqlSugarClient

```csharp
/// <summary>
/// 复杂业务服务
/// </summary>
public class ComplexService : IDynamicApiController, ITransient
{
    private readonly ISqlSugarClient _db;

    public ComplexService(ISqlSugarClient db)
    {
        _db = db;
    }

    /// <summary>
    /// 复杂查询
    /// </summary>
    public async Task<dynamic> ComplexQuery()
    {
        return await _db.Queryable<SysUser>()
            .LeftJoin<SysOrg>((u, o) => u.OrgId == o.Id)
            .LeftJoin<SysPos>((u, o, p) => u.PosId == p.Id)
            .Select((u, o, p) => new
            {
                u.Id,
                u.Account,
                u.RealName,
                OrgName = o.Name,
                PosName = p.Name
            })
            .ToListAsync();
    }

    /// <summary>
    /// 执行原生SQL
    /// </summary>
    public async Task<List<dynamic>> ExecuteSql()
    {
        return await _db.Ado.SqlQueryAsync<dynamic>(
            "SELECT * FROM sys_user WHERE status = @status",
            new { status = 1 }
        );
    }
}
```

---

## 3. CRUD基础操作

### 3.1 新增操作

```csharp
/// <summary>
/// 新增操作示例
/// </summary>
public class InsertExamples
{
    private readonly SqlSugarRepository<SysUser> _userRep;

    // 1. 插入单个实体
    public async Task<long> InsertOne(SysUser user)
    {
        // 返回自增Id
        return await _userRep.InsertReturnIdentityAsync(user);
    }

    // 2. 插入并返回雪花Id
    public async Task<long> InsertWithSnowflakeId(SysUser user)
    {
        return await _userRep.InsertReturnSnowflakeIdAsync(user);
    }

    // 3. 批量插入
    public async Task<bool> InsertBatch(List<SysUser> users)
    {
        return await _userRep.InsertRangeAsync(users);
    }

    // 4. 大批量插入（性能优化）
    public async Task InsertBulk(List<SysUser> users)
    {
        await _userRep.Context.Fastest<SysUser>().BulkCopyAsync(users);
    }

    // 5. 只插入指定列
    public async Task<int> InsertColumns(SysUser user)
    {
        return await _userRep.Context.Insertable(user)
            .InsertColumns(u => new { u.Account, u.RealName, u.Status })
            .ExecuteCommandAsync();
    }

    // 6. 忽略某些列
    public async Task<int> InsertIgnoreColumns(SysUser user)
    {
        return await _userRep.Context.Insertable(user)
            .IgnoreColumns(u => new { u.CreateTime, u.UpdateTime })
            .ExecuteCommandAsync();
    }
}
```

### 3.2 查询操作

```csharp
/// <summary>
/// 查询操作示例
/// </summary>
public class QueryExamples
{
    private readonly SqlSugarRepository<SysUser> _userRep;
    private readonly ISqlSugarClient _db;

    // 1. 根据Id查询
    public async Task<SysUser> GetById(long id)
    {
        return await _userRep.GetByIdAsync(id);
    }

    // 2. 条件查询单个
    public async Task<SysUser> GetFirst(string account)
    {
        return await _userRep.GetFirstAsync(u => u.Account == account);
    }

    // 3. 查询列表
    public async Task<List<SysUser>> GetList(string keyword)
    {
        return await _userRep.AsQueryable()
            .WhereIF(!string.IsNullOrEmpty(keyword), 
                u => u.Account.Contains(keyword) || u.RealName.Contains(keyword))
            .Where(u => u.Status == StatusEnum.Enable)
            .OrderBy(u => u.OrderNo)
            .ToListAsync();
    }

    // 4. 分页查询
    public async Task<SqlSugarPagedList<SysUser>> GetPage(int page, int pageSize)
    {
        return await _userRep.AsQueryable()
            .Where(u => u.Status == StatusEnum.Enable)
            .OrderByDescending(u => u.CreateTime)
            .ToPagedListAsync(page, pageSize);
    }

    // 5. 联表查询
    public async Task<List<UserOrgDto>> GetUsersWithOrg()
    {
        return await _db.Queryable<SysUser>()
            .LeftJoin<SysOrg>((u, o) => u.OrgId == o.Id)
            .Select((u, o) => new UserOrgDto
            {
                Id = u.Id,
                Account = u.Account,
                RealName = u.RealName,
                OrgName = o.Name
            })
            .ToListAsync();
    }

    // 6. 子查询
    public async Task<List<SysUser>> GetUsersWithSubQuery()
    {
        var orgIds = _db.Queryable<SysOrg>()
            .Where(o => o.Status == StatusEnum.Enable)
            .Select(o => o.Id);

        return await _userRep.AsQueryable()
            .Where(u => SqlFunc.Subqueryable<SysOrg>()
                .Where(o => o.Id == u.OrgId && o.Status == StatusEnum.Enable)
                .Any())
            .ToListAsync();
    }

    // 7. 动态条件查询
    public async Task<List<SysUser>> DynamicQuery(UserQueryInput input)
    {
        return await _userRep.AsQueryable()
            .WhereIF(!string.IsNullOrEmpty(input.Account), u => u.Account.Contains(input.Account))
            .WhereIF(!string.IsNullOrEmpty(input.RealName), u => u.RealName.Contains(input.RealName))
            .WhereIF(!string.IsNullOrEmpty(input.Phone), u => u.Phone.Contains(input.Phone))
            .WhereIF(input.Status.HasValue, u => u.Status == input.Status)
            .WhereIF(input.OrgId > 0, u => u.OrgId == input.OrgId)
            .WhereIF(input.StartTime.HasValue, u => u.CreateTime >= input.StartTime)
            .WhereIF(input.EndTime.HasValue, u => u.CreateTime <= input.EndTime)
            .ToListAsync();
    }

    // 8. 分组统计
    public async Task<List<dynamic>> GetStatistics()
    {
        return await _db.Queryable<SysUser>()
            .GroupBy(u => u.Status)
            .Select(u => new
            {
                Status = u.Status,
                Count = SqlFunc.AggregateCount(u.Id)
            })
            .ToListAsync();
    }

    // 9. 导航属性查询
    public async Task<List<SysUser>> GetUsersWithRoles()
    {
        return await _userRep.AsQueryable()
            .Includes(u => u.Roles)
            .Includes(u => u.Org)
            .ToListAsync();
    }

    // 10. 树形结构查询
    public async Task<List<SysOrg>> GetOrgTree()
    {
        return await _db.Queryable<SysOrg>()
            .Where(o => o.Status == StatusEnum.Enable)
            .OrderBy(o => o.OrderNo)
            .ToTreeAsync(o => o.Children, o => o.Pid, 0);
    }
}
```

### 3.3 更新操作

```csharp
/// <summary>
/// 更新操作示例
/// </summary>
public class UpdateExamples
{
    private readonly SqlSugarRepository<SysUser> _userRep;
    private readonly ISqlSugarClient _db;

    // 1. 更新整个实体
    public async Task<bool> UpdateEntity(SysUser user)
    {
        return await _userRep.UpdateAsync(user);
    }

    // 2. 只更新指定列
    public async Task<int> UpdateColumns(SysUser user)
    {
        return await _db.Updateable(user)
            .UpdateColumns(u => new { u.RealName, u.Phone, u.Email })
            .ExecuteCommandAsync();
    }

    // 3. 忽略某些列
    public async Task<int> UpdateIgnoreColumns(SysUser user)
    {
        return await _db.Updateable(user)
            .IgnoreColumns(u => new { u.Account, u.Password, u.CreateTime })
            .ExecuteCommandAsync();
    }

    // 4. 条件更新
    public async Task<int> UpdateByCondition()
    {
        return await _db.Updateable<SysUser>()
            .SetColumns(u => u.Status == StatusEnum.Disable)
            .Where(u => u.Status == StatusEnum.Enable && u.CreateTime < DateTime.Now.AddYears(-1))
            .ExecuteCommandAsync();
    }

    // 5. 批量更新
    public async Task<bool> UpdateBatch(List<SysUser> users)
    {
        return await _userRep.UpdateRangeAsync(users);
    }

    // 6. 只更新非空字段
    public async Task<int> UpdateNotNull(SysUser user)
    {
        return await _db.Updateable(user)
            .IgnoreColumns(ignoreAllNullColumns: true)
            .ExecuteCommandAsync();
    }

    // 7. 乐观锁更新
    public async Task<int> UpdateWithVersion(SysUser user)
    {
        return await _db.Updateable(user)
            .ExecuteCommandWithOptLockAsync();
    }
}
```

### 3.4 删除操作

```csharp
/// <summary>
/// 删除操作示例
/// </summary>
public class DeleteExamples
{
    private readonly SqlSugarRepository<SysUser> _userRep;
    private readonly ISqlSugarClient _db;

    // 1. 根据Id删除
    public async Task<bool> DeleteById(long id)
    {
        return await _userRep.DeleteByIdAsync(id);
    }

    // 2. 批量删除
    public async Task<bool> DeleteByIds(List<long> ids)
    {
        return await _userRep.DeleteByIdsAsync(ids.Cast<object>().ToArray());
    }

    // 3. 条件删除
    public async Task<int> DeleteByCondition()
    {
        return await _db.Deleteable<SysUser>()
            .Where(u => u.Status == StatusEnum.Disable)
            .ExecuteCommandAsync();
    }

    // 4. 软删除（假删除）
    public async Task<bool> SoftDelete(SysUser user)
    {
        return await _userRep.FakeDeleteAsync(user);
    }

    // 5. 批量软删除
    public async Task<int> SoftDeleteBatch(List<long> ids)
    {
        return await _db.Updateable<SysUser>()
            .SetColumns(u => u.IsDelete == true)
            .SetColumns(u => u.UpdateTime == DateTime.Now)
            .Where(u => ids.Contains(u.Id))
            .ExecuteCommandAsync();
    }

    // 6. 清空表
    public async Task TruncateTable()
    {
        await _db.DbMaintenance.TruncateTable<SysLogOp>();
    }
}
```

---

## 4. 高级查询技巧

### 4.1 复杂联表查询

```csharp
/// <summary>
/// 复杂联表查询示例
/// </summary>
public class JoinQueryExamples
{
    private readonly ISqlSugarClient _db;

    // 1. 多表联查
    public async Task<List<UserDetailDto>> GetUserDetails()
    {
        return await _db.Queryable<SysUser>()
            .LeftJoin<SysOrg>((u, o) => u.OrgId == o.Id)
            .LeftJoin<SysPos>((u, o, p) => u.PosId == p.Id)
            .LeftJoin<SysTenant>((u, o, p, t) => u.TenantId == t.Id)
            .Where((u, o, p, t) => u.Status == StatusEnum.Enable)
            .Select((u, o, p, t) => new UserDetailDto
            {
                Id = u.Id,
                Account = u.Account,
                RealName = u.RealName,
                Phone = u.Phone,
                OrgId = u.OrgId,
                OrgName = o.Name,
                PosId = u.PosId,
                PosName = p.Name,
                TenantId = u.TenantId,
                TenantName = t.Name
            })
            .ToListAsync();
    }

    // 2. 自关联查询（获取上级）
    public async Task<List<OrgWithParentDto>> GetOrgsWithParent()
    {
        return await _db.Queryable<SysOrg>()
            .LeftJoin<SysOrg>((o1, o2) => o1.Pid == o2.Id)
            .Select((o1, o2) => new OrgWithParentDto
            {
                Id = o1.Id,
                Name = o1.Name,
                Pid = o1.Pid,
                ParentName = o2.Name
            })
            .ToListAsync();
    }

    // 3. 使用SqlFunc函数
    public async Task<List<UserStatDto>> GetUserStatistics()
    {
        return await _db.Queryable<SysUser>()
            .GroupBy(u => SqlFunc.DateValue(u.CreateTime, DateType.Month))
            .Select(u => new UserStatDto
            {
                Month = SqlFunc.DateValue(u.CreateTime, DateType.Month),
                Count = SqlFunc.AggregateCount(u.Id),
                LastCreateTime = SqlFunc.AggregateMax(u.CreateTime)
            })
            .ToListAsync();
    }

    // 4. Union查询
    public async Task<List<SysUser>> GetUnionUsers()
    {
        var query1 = _db.Queryable<SysUser>().Where(u => u.Status == StatusEnum.Enable);
        var query2 = _db.Queryable<SysUser>().Where(u => u.AccountType == AccountTypeEnum.SuperAdmin);
        
        return await _db.UnionAll(query1, query2).ToListAsync();
    }
}
```

### 4.2 动态表名和列名

```csharp
/// <summary>
/// 动态表名示例
/// </summary>
public class DynamicTableExamples
{
    private readonly ISqlSugarClient _db;

    // 1. 动态表名
    public async Task<List<SysLogOp>> GetLogsByMonth(int year, int month)
    {
        var tableName = $"sys_log_op_{year}{month:D2}";
        
        return await _db.Queryable<SysLogOp>()
            .AS(tableName)
            .ToListAsync();
    }

    // 2. 分表查询
    public async Task<List<SysLogOp>> GetLogsFromMultipleTables()
    {
        var tables = new[] { "sys_log_op_202401", "sys_log_op_202402", "sys_log_op_202403" };
        var result = new List<SysLogOp>();
        
        foreach (var table in tables)
        {
            var logs = await _db.Queryable<SysLogOp>()
                .AS(table)
                .ToListAsync();
            result.AddRange(logs);
        }
        
        return result;
    }
}
```

### 4.3 原生SQL执行

```csharp
/// <summary>
/// 原生SQL示例
/// </summary>
public class RawSqlExamples
{
    private readonly ISqlSugarClient _db;

    // 1. 查询
    public async Task<List<SysUser>> QueryBySql()
    {
        var sql = "SELECT * FROM sys_user WHERE status = @status AND org_id = @orgId";
        return await _db.Ado.SqlQueryAsync<SysUser>(sql, 
            new { status = 1, orgId = 100 });
    }

    // 2. 执行命令
    public async Task<int> ExecuteSql()
    {
        var sql = "UPDATE sys_user SET status = @status WHERE id = @id";
        return await _db.Ado.ExecuteCommandAsync(sql, 
            new { status = 0, id = 100 });
    }

    // 3. 存储过程
    public async Task<List<SysUser>> CallProcedure()
    {
        return await _db.Ado.SqlQueryAsync<SysUser>(
            "CALL sp_get_users(@orgId)",
            new { orgId = 100 }
        );
    }

    // 4. 动态SQL
    public async Task<List<dynamic>> DynamicQuery(string whereClause)
    {
        var sql = $"SELECT * FROM sys_user WHERE 1=1 {whereClause}";
        return await _db.Ado.SqlQueryAsync<dynamic>(sql);
    }
}
```

---

## 5. 事务处理与并发控制

### 5.1 事务管理

```csharp
/// <summary>
/// 事务处理示例
/// </summary>
public class TransactionExamples
{
    private readonly ISqlSugarClient _db;
    private readonly SqlSugarRepository<SysUser> _userRep;
    private readonly SqlSugarRepository<SysUserRole> _userRoleRep;

    // 1. 基本事务
    public async Task BasicTransaction()
    {
        try
        {
            _db.Ado.BeginTran();
            
            var user = new SysUser { Account = "test" };
            await _userRep.InsertAsync(user);
            
            var userRole = new SysUserRole { UserId = user.Id, RoleId = 1 };
            await _userRoleRep.InsertAsync(userRole);
            
            _db.Ado.CommitTran();
        }
        catch (Exception)
        {
            _db.Ado.RollbackTran();
            throw;
        }
    }

    // 2. 使用事务包装器
    public async Task TransactionWrapper()
    {
        var result = await _db.Ado.UseTranAsync(async () =>
        {
            var user = new SysUser { Account = "test" };
            await _userRep.InsertAsync(user);
            
            var userRole = new SysUserRole { UserId = user.Id, RoleId = 1 };
            await _userRoleRep.InsertAsync(userRole);
        });

        if (!result.IsSuccess)
        {
            throw new Exception($"事务执行失败：{result.ErrorMessage}");
        }
    }

    // 3. 嵌套事务（保存点）
    public async Task NestedTransaction()
    {
        try
        {
            _db.Ado.BeginTran();
            
            await _userRep.InsertAsync(new SysUser { Account = "user1" });
            
            // 保存点
            _db.Ado.SavePoint("point1");
            
            try
            {
                await _userRep.InsertAsync(new SysUser { Account = "user2" });
            }
            catch
            {
                // 回滚到保存点
                _db.Ado.RollbackTranToPoint("point1");
            }
            
            _db.Ado.CommitTran();
        }
        catch
        {
            _db.Ado.RollbackTran();
            throw;
        }
    }

    // 4. 跨数据库事务
    public async Task CrossDbTransaction()
    {
        var db1 = _db.GetConnectionScope("db1");
        var db2 = _db.GetConnectionScope("db2");
        
        try
        {
            db1.Ado.BeginTran();
            db2.Ado.BeginTran();
            
            await db1.Insertable(new SysUser { Account = "test1" }).ExecuteCommandAsync();
            await db2.Insertable(new SysLog { Message = "test" }).ExecuteCommandAsync();
            
            db1.Ado.CommitTran();
            db2.Ado.CommitTran();
        }
        catch
        {
            db1.Ado.RollbackTran();
            db2.Ado.RollbackTran();
            throw;
        }
    }
}
```

### 5.2 乐观锁

```csharp
/// <summary>
/// 乐观锁实体
/// </summary>
public class Order : EntityBase
{
    public string OrderNo { get; set; }
    public decimal Amount { get; set; }
    
    /// <summary>
    /// 版本号（乐观锁）
    /// </summary>
    [SugarColumn(IsEnableUpdateVersionValidation = true)]
    public long Version { get; set; }
}

/// <summary>
/// 乐观锁使用示例
/// </summary>
public class OptimisticLockExample
{
    private readonly ISqlSugarClient _db;

    public async Task UpdateWithOptLock(Order order)
    {
        // 使用乐观锁更新
        var result = await _db.Updateable(order)
            .ExecuteCommandWithOptLockAsync();
        
        if (result == 0)
        {
            throw new Exception("数据已被其他用户修改，请刷新后重试");
        }
    }
}
```

### 5.3 悲观锁

```csharp
/// <summary>
/// 悲观锁示例
/// </summary>
public class PessimisticLockExample
{
    private readonly ISqlSugarClient _db;

    public async Task ProcessWithLock(long orderId)
    {
        try
        {
            _db.Ado.BeginTran();
            
            // 加锁查询
            var order = await _db.Queryable<Order>()
                .With(SqlWith.UpdLock)
                .FirstAsync(o => o.Id == orderId);
            
            if (order == null)
                throw new Exception("订单不存在");
            
            // 处理业务
            order.Amount += 100;
            await _db.Updateable(order).ExecuteCommandAsync();
            
            _db.Ado.CommitTran();
        }
        catch
        {
            _db.Ado.RollbackTran();
            throw;
        }
    }
}
```

---

## 6. 数据库迁移与种子数据

### 6.1 CodeFirst自动迁移

```csharp
/// <summary>
/// 数据库初始化
/// </summary>
public static class DbInitializer
{
    public static void InitDatabase(ISqlSugarClient db, DbSettings settings)
    {
        if (!settings.EnableInitDb)
            return;

        // 创建数据库
        db.DbMaintenance.CreateDatabase();

        // 获取需要创建表的实体类型
        var entityTypes = GetEntityTypes();

        // 按顺序创建表
        foreach (var type in entityTypes)
        {
            if (!db.DbMaintenance.IsAnyTable(GetTableName(type)))
            {
                // 创建表
                db.CodeFirst.InitTables(type);
            }
            else
            {
                // 同步表结构（只增加列，不删除列）
                db.CodeFirst.SetStringDefaultLength(256)
                    .InitTables(type);
            }
        }
    }

    private static List<Type> GetEntityTypes()
    {
        return typeof(EntityBase).Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract)
            .Where(t => t.IsSubclassOf(typeof(EntityBase)))
            .OrderBy(t => GetTableOrder(t))
            .ToList();
    }

    private static int GetTableOrder(Type type)
    {
        // 系统表优先创建
        var attr = type.GetCustomAttribute<SystemTableAttribute>();
        return attr != null ? 0 : 1;
    }
}
```

### 6.2 种子数据初始化

```csharp
/// <summary>
/// 种子数据接口
/// </summary>
public interface ISeedData
{
    /// <summary>
    /// 种子数据
    /// </summary>
    IEnumerable<object> GetSeedData();

    /// <summary>
    /// 顺序（越小越先执行）
    /// </summary>
    int Order { get; }
}

/// <summary>
/// 用户种子数据
/// </summary>
public class SysUserSeedData : ISeedData
{
    public int Order => 100;

    public IEnumerable<object> GetSeedData()
    {
        return new List<SysUser>
        {
            new SysUser
            {
                Id = 1300000000001,
                Account = "superAdmin",
                Password = CryptogramUtil.Encrypt("123456"),
                RealName = "超级管理员",
                NickName = "Admin",
                AccountType = AccountTypeEnum.SuperAdmin,
                OrgId = 1300000000001,
                PosId = 1300000000001,
                Status = StatusEnum.Enable
            },
            new SysUser
            {
                Id = 1300000000002,
                Account = "admin",
                Password = CryptogramUtil.Encrypt("123456"),
                RealName = "系统管理员",
                NickName = "Admin",
                AccountType = AccountTypeEnum.SysAdmin,
                OrgId = 1300000000001,
                PosId = 1300000000002,
                TenantId = 1300000000001,
                Status = StatusEnum.Enable
            }
        };
    }
}

/// <summary>
/// 种子数据初始化器
/// </summary>
public static class SeedDataInitializer
{
    public static async Task InitSeedData(ISqlSugarClient db, DbSettings settings)
    {
        if (!settings.EnableInitSeed)
            return;

        // 获取所有种子数据类
        var seedDataTypes = typeof(ISeedData).Assembly.GetTypes()
            .Where(t => typeof(ISeedData).IsAssignableFrom(t) && !t.IsAbstract)
            .Select(t => Activator.CreateInstance(t) as ISeedData)
            .OrderBy(s => s.Order)
            .ToList();

        foreach (var seedData in seedDataTypes)
        {
            var data = seedData.GetSeedData().ToList();
            if (!data.Any()) continue;

            var entityType = data.First().GetType();
            
            // 检查是否已有数据
            var hasData = await db.Queryable<object>()
                .AS(GetTableName(entityType))
                .AnyAsync();

            if (!hasData)
            {
                // 插入种子数据
                await db.Insertable(data)
                    .AS(GetTableName(entityType))
                    .ExecuteCommandAsync();
            }
        }
    }
}
```

---

## 7. 多数据库支持

### 7.1 多数据库配置

```json
{
  "DbSettings": {
    "DbConfigs": [
      {
        "ConfigId": "master",
        "DbType": "MySql",
        "ConnectionString": "server=localhost;database=admin_master;uid=root;pwd=123456;",
        "IsAutoCloseConnection": true
      },
      {
        "ConfigId": "log",
        "DbType": "PostgreSQL",
        "ConnectionString": "Host=localhost;Port=5432;Database=admin_log;Username=postgres;Password=123456",
        "IsAutoCloseConnection": true
      },
      {
        "ConfigId": "archive",
        "DbType": "SqlServer",
        "ConnectionString": "Server=localhost;Database=admin_archive;User Id=sa;Password=123456;",
        "IsAutoCloseConnection": true
      }
    ]
  }
}
```

### 7.2 多数据库操作

```csharp
/// <summary>
/// 多数据库服务
/// </summary>
public class MultiDbService : IDynamicApiController, ITransient
{
    private readonly ISqlSugarClient _db;

    public MultiDbService(ISqlSugarClient db)
    {
        _db = db;
    }

    /// <summary>
    /// 从主库查询用户
    /// </summary>
    public async Task<List<SysUser>> GetUsersFromMaster()
    {
        var masterDb = _db.GetConnectionScope("master");
        return await masterDb.Queryable<SysUser>().ToListAsync();
    }

    /// <summary>
    /// 从日志库查询日志
    /// </summary>
    public async Task<List<SysLogOp>> GetLogsFromLogDb()
    {
        var logDb = _db.GetConnectionScope("log");
        return await logDb.Queryable<SysLogOp>()
            .OrderByDescending(l => l.CreateTime)
            .Take(100)
            .ToListAsync();
    }

    /// <summary>
    /// 跨库查询
    /// </summary>
    public async Task<dynamic> CrossDbQuery()
    {
        var masterDb = _db.GetConnectionScope("master");
        var logDb = _db.GetConnectionScope("log");

        var users = await masterDb.Queryable<SysUser>()
            .Take(10)
            .ToListAsync();

        var logs = await logDb.Queryable<SysLogOp>()
            .Where(l => users.Select(u => u.Account).Contains(l.Account))
            .ToListAsync();

        return new { Users = users, Logs = logs };
    }
}
```

### 7.3 读写分离

```csharp
// 配置读写分离
{
  "DbSettings": {
    "DbConfigs": [
      {
        "ConfigId": "master",
        "DbType": "MySql",
        "ConnectionString": "server=master;database=admin;uid=root;pwd=123456;",
        "IsAutoCloseConnection": true,
        "SlaveConnectionConfigs": [
          {
            "HitRate": 10,
            "ConnectionString": "server=slave1;database=admin;uid=root;pwd=123456;"
          },
          {
            "HitRate": 10,
            "ConnectionString": "server=slave2;database=admin;uid=root;pwd=123456;"
          }
        ]
      }
    ]
  }
}

/// <summary>
/// 读写分离示例
/// </summary>
public class ReadWriteSplitExample
{
    private readonly ISqlSugarClient _db;

    // 查询自动走从库
    public async Task<List<SysUser>> Query()
    {
        return await _db.Queryable<SysUser>().ToListAsync();
    }

    // 写操作走主库
    public async Task<int> Insert(SysUser user)
    {
        return await _db.Insertable(user).ExecuteCommandAsync();
    }

    // 强制走主库查询
    public async Task<SysUser> QueryFromMaster(long id)
    {
        return await _db.Queryable<SysUser>()
            .Master()  // 强制走主库
            .FirstAsync(u => u.Id == id);
    }
}
```

---

## 8. 性能优化与最佳实践

### 8.1 查询优化

```csharp
/// <summary>
/// 查询优化示例
/// </summary>
public class QueryOptimization
{
    private readonly ISqlSugarClient _db;

    // 1. 只查询需要的列
    public async Task<List<UserSimpleDto>> GetSimpleList()
    {
        return await _db.Queryable<SysUser>()
            .Select(u => new UserSimpleDto
            {
                Id = u.Id,
                Account = u.Account,
                RealName = u.RealName
            })
            .ToListAsync();
    }

    // 2. 使用索引
    public async Task<SysUser> GetByAccount(string account)
    {
        // 确保account字段有索引
        return await _db.Queryable<SysUser>()
            .WithCache(60)  // 缓存60秒
            .FirstAsync(u => u.Account == account);
    }

    // 3. 分批查询大数据量
    public async Task ProcessLargeData()
    {
        var pageSize = 1000;
        var page = 1;
        
        while (true)
        {
            var data = await _db.Queryable<SysLogOp>()
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            
            if (!data.Any()) break;
            
            // 处理数据
            await ProcessBatch(data);
            
            page++;
        }
    }

    // 4. 使用异步流
    public async IAsyncEnumerable<SysUser> GetUsersStream()
    {
        var reader = await _db.Queryable<SysUser>().ToDataReaderAsync();
        
        while (await reader.ReadAsync())
        {
            yield return _db.Utilities.DataReaderToList<SysUser>(reader).First();
        }
        
        reader.Close();
    }
}
```

### 8.2 写入优化

```csharp
/// <summary>
/// 写入优化示例
/// </summary>
public class WriteOptimization
{
    private readonly ISqlSugarClient _db;

    // 1. 批量插入
    public async Task BulkInsert(List<SysLogOp> logs)
    {
        // 使用Fastest进行大批量插入
        await _db.Fastest<SysLogOp>().BulkCopyAsync(logs);
    }

    // 2. 批量更新
    public async Task BulkUpdate(List<SysUser> users)
    {
        await _db.Fastest<SysUser>().BulkUpdateAsync(users);
    }

    // 3. 分批插入
    public async Task BatchInsert(List<SysLogOp> logs, int batchSize = 1000)
    {
        for (var i = 0; i < logs.Count; i += batchSize)
        {
            var batch = logs.Skip(i).Take(batchSize).ToList();
            await _db.Insertable(batch).ExecuteCommandAsync();
        }
    }
}
```

### 8.3 缓存策略

```csharp
/// <summary>
/// 缓存策略示例
/// </summary>
public class CacheStrategy
{
    private readonly ISqlSugarClient _db;
    private readonly SysCacheService _cache;

    // 1. 查询缓存
    public async Task<List<SysConfig>> GetConfigs()
    {
        return await _db.Queryable<SysConfig>()
            .WithCache(300)  // 缓存5分钟
            .ToListAsync();
    }

    // 2. 自定义缓存键
    public async Task<List<SysDictData>> GetDictData(string typeCode)
    {
        return await _db.Queryable<SysDictData>()
            .Where(d => d.DictType.Code == typeCode)
            .WithCache(300, $"dict_{typeCode}")
            .ToListAsync();
    }

    // 3. 二级缓存
    public async Task<SysUser> GetUser(long id)
    {
        var cacheKey = $"user_{id}";
        
        // 先查内存缓存
        var user = _cache.Get<SysUser>(cacheKey);
        if (user != null) return user;
        
        // 再查数据库
        user = await _db.Queryable<SysUser>().FirstAsync(u => u.Id == id);
        
        if (user != null)
        {
            _cache.Set(cacheKey, user, TimeSpan.FromMinutes(30));
        }
        
        return user;
    }

    // 4. 清除缓存
    public async Task ClearCache()
    {
        _db.QueryFilter.ClearQuery<SysConfig>();
        _cache.RemoveByPrefix("dict_");
    }
}
```

### 8.4 最佳实践总结

```csharp
/// <summary>
/// 数据库操作最佳实践
/// </summary>
public class BestPractices
{
    /*
     * 1. 使用仓储模式统一数据访问
     * 2. 合理使用事务，避免长事务
     * 3. 大批量操作使用Fastest
     * 4. 查询时只选择需要的列
     * 5. 合理使用缓存减少数据库压力
     * 6. 使用WhereIF进行动态条件查询
     * 7. 软删除代替物理删除
     * 8. 使用乐观锁处理并发
     * 9. 记录SQL日志便于排查问题
     * 10. 定期维护数据库（清理日志、重建索引）
     */
}
```

---

## 总结

本章详细介绍了Admin.NET中SqlSugar的使用：

1. **SqlSugar配置**：连接字符串、全局过滤器、日志配置
2. **仓储模式**：封装常用CRUD操作
3. **CRUD操作**：增删改查的各种方式
4. **高级查询**：联表查询、动态条件、原生SQL
5. **事务处理**：基本事务、嵌套事务、跨库事务
6. **数据库迁移**：CodeFirst和种子数据
7. **多数据库**：多库配置、读写分离
8. **性能优化**：查询优化、写入优化、缓存策略

掌握SqlSugar是进行业务开发的基础。在下一章中，我们将学习前端Vue3的开发指南。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第03章-项目架构与核心模块解析" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
