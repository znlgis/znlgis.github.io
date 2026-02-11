# 第六章：数据库操作与EF Core集成

## 6.1 EF Core集成概述

Furion 框架深度集成了 Entity Framework Core（EF Core），为开发者提供了强大且便捷的数据库操作能力。EF Core 是微软官方推荐的 ORM（对象关系映射）框架，它允许开发者通过 C# 对象来操作数据库，而无需手写大量的 SQL 语句。

Furion 在 EF Core 的基础上做了大量增强，主要包括：

| 特性 | 说明 |
|------|------|
| 多数据库支持 | 支持 SqlServer、MySQL、PostgreSQL、SQLite、Oracle 等主流数据库 |
| 内置仓储模式 | 提供 `IRepository<T>` 泛型仓储接口，简化数据访问层开发 |
| 自动配置 | 通过特性标注自动配置数据库上下文 |
| 读写分离 | 内置读写分离支持 |
| 多租户 | 支持多租户数据隔离方案 |
| 数据种子 | 支持数据库初始化种子数据 |
| 审计日志 | 自动记录数据变更审计日志 |

## 6.2 数据库上下文配置

### 6.2.1 创建数据库上下文

在 Furion 中，数据库上下文需要继承 `AppDbContext<TDbContext>` 或 `AppDbContext<TDbContext, TDbContextLocator>`：

```csharp
using Furion.DatabaseAccessor;
using Microsoft.EntityFrameworkCore;

// 默认数据库上下文
public class DefaultDbContext : AppDbContext<DefaultDbContext>
{
    public DefaultDbContext(DbContextOptions<DefaultDbContext> options) : base(options)
    {
    }

    // 实体集合定义
    public DbSet<User> Users { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<Order> Orders { get; set; }
}
```

### 6.2.2 使用 [AppDbContext] 特性

`[AppDbContext]` 特性用于配置数据库上下文的连接字符串、数据库类型等信息：

```csharp
using Furion.DatabaseAccessor;
using Microsoft.EntityFrameworkCore;

// 使用特性配置数据库上下文
[AppDbContext("ConnectionStrings:DefaultConnection", DbProvider.SqlServer)]
public class DefaultDbContext : AppDbContext<DefaultDbContext>
{
    public DefaultDbContext(DbContextOptions<DefaultDbContext> options) : base(options)
    {
    }
}

// MySQL 数据库上下文
[AppDbContext("ConnectionStrings:MySqlConnection", DbProvider.MySql)]
public class MySqlDbContext : AppDbContext<MySqlDbContext, MySqlDbContextLocator>
{
    public MySqlDbContext(DbContextOptions<MySqlDbContext> options) : base(options)
    {
    }
}
```

### 6.2.3 注册数据库上下文

在 `Startup.cs` 或 `Program.cs` 中注册数据库服务：

```csharp
// Program.cs (.NET 6+)
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDatabaseAccessor(options =>
{
    // 注册默认数据库上下文（SqlServer）
    options.AddDbPool<DefaultDbContext>(DbProvider.SqlServer);

    // 注册 MySQL 数据库上下文
    options.AddDbPool<MySqlDbContext, MySqlDbContextLocator>(DbProvider.MySql);

    // 注册 PostgreSQL 数据库上下文
    options.AddDbPool<PgSqlDbContext, PgSqlDbContextLocator>(DbProvider.Npgsql);
});

var app = builder.Build();
```

## 6.3 连接字符串配置

### 6.3.1 appsettings.json 配置

在 `appsettings.json` 中配置数据库连接字符串：

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=FurionDb;User Id=sa;Password=your_password;TrustServerCertificate=True;",
    "MySqlConnection": "Server=localhost;Port=3306;Database=FurionDb;Uid=root;Pwd=your_password;CharSet=utf8mb4;",
    "PgSqlConnection": "Host=localhost;Port=5432;Database=FurionDb;Username=postgres;Password=your_password;",
    "SqliteConnection": "Data Source=furion.db"
  }
}
```

### 6.3.2 多数据库连接配置

Furion 支持同时连接多个数据库，需要为每个数据库创建对应的定位器（Locator）：

```csharp
// 定义数据库上下文定位器
public sealed class MySqlDbContextLocator : IDbContextLocator { }
public sealed class PgSqlDbContextLocator : IDbContextLocator { }
public sealed class SqliteDbContextLocator : IDbContextLocator { }

// 注册多个数据库
builder.Services.AddDatabaseAccessor(options =>
{
    // 默认数据库（SqlServer）
    options.AddDbPool<DefaultDbContext>(DbProvider.SqlServer);

    // MySQL 数据库
    options.AddDbPool<MySqlDbContext, MySqlDbContextLocator>(DbProvider.MySql);

    // PostgreSQL 数据库
    options.AddDbPool<PgSqlDbContext, PgSqlDbContextLocator>(DbProvider.Npgsql);

    // SQLite 数据库
    options.AddDbPool<SqliteDbContext, SqliteDbContextLocator>(DbProvider.Sqlite);
});
```

## 6.4 实体定义与配置

### 6.4.1 基础实体类

Furion 提供了多种基础实体类供继承使用：

| 基类 | 说明 |
|------|------|
| `Entity` | 包含 `Id` 主键属性 |
| `EntityBase` | 包含 `Id`、`CreatedTime`、`UpdatedTime` 等审计字段 |
| `EntityNotKey` | 无主键实体 |
| `IEntity` | 实体接口，用于自定义实体 |

```csharp
using Furion.DatabaseAccessor;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// 使用 Entity 基类
public class User : Entity
{
    /// <summary>
    /// 用户名
    /// </summary>
    [Required, MaxLength(50)]
    public string UserName { get; set; }

    /// <summary>
    /// 邮箱
    /// </summary>
    [Required, EmailAddress, MaxLength(100)]
    public string Email { get; set; }

    /// <summary>
    /// 年龄
    /// </summary>
    [Range(0, 150)]
    public int Age { get; set; }

    /// <summary>
    /// 导航属性 - 用户角色
    /// </summary>
    public virtual ICollection<Role> Roles { get; set; }
}

// 使用 EntityBase 基类（包含审计字段）
public class Order : EntityBase
{
    /// <summary>
    /// 订单编号
    /// </summary>
    [Required, MaxLength(32)]
    public string OrderNo { get; set; }

    /// <summary>
    /// 订单金额
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    /// <summary>
    /// 订单状态
    /// </summary>
    public OrderStatus Status { get; set; }

    /// <summary>
    /// 用户ID（外键）
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// 导航属性
    /// </summary>
    public virtual User User { get; set; }
}

// 枚举定义
public enum OrderStatus
{
    Pending = 0,    // 待支付
    Paid = 1,       // 已支付
    Shipped = 2,    // 已发货
    Completed = 3,  // 已完成
    Cancelled = 4   // 已取消
}
```

### 6.4.2 数据注解配置

使用数据注解（Data Annotations）配置实体映射：

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("t_product")]  // 指定表名
public class Product : Entity
{
    [Key]                           // 主键
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]  // 自增
    public override int Id { get; set; }

    [Required(ErrorMessage = "产品名称不能为空")]
    [MaxLength(200)]
    [Column("product_name")]        // 指定列名
    public string Name { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }

    [MaxLength(500)]
    public string Description { get; set; }

    [NotMapped]                     // 不映射到数据库
    public string DisplayName => $"{Name} - ¥{Price}";
}
```

### 6.4.3 Fluent API 配置

使用 Fluent API 进行更精细的实体配置：

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

// 实体配置类
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        // 表名映射
        builder.ToTable("t_user");

        // 主键
        builder.HasKey(u => u.Id);

        // 索引
        builder.HasIndex(u => u.UserName).IsUnique();
        builder.HasIndex(u => u.Email).IsUnique();

        // 属性配置
        builder.Property(u => u.UserName)
            .IsRequired()
            .HasMaxLength(50)
            .HasComment("用户名");

        builder.Property(u => u.Email)
            .IsRequired()
            .HasMaxLength(100)
            .HasComment("邮箱地址");

        // 关系配置 - 一对多
        builder.HasMany(u => u.Roles)
            .WithMany()
            .UsingEntity(j => j.ToTable("t_user_role"));

        // 数据过滤（软删除）
        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}

// 在 DbContext 中应用配置
public class DefaultDbContext : AppDbContext<DefaultDbContext>
{
    public DefaultDbContext(DbContextOptions<DefaultDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 应用所有实体配置
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DefaultDbContext).Assembly);
    }
}
```

## 6.5 仓储模式

### 6.5.1 IRepository<T> 内置仓储

Furion 提供了强大的泛型仓储接口 `IRepository<T>`，开发者无需手动实现即可使用：

```csharp
using Furion.DatabaseAccessor;
using Furion.DynamicApiController;

public class UserService : IDynamicApiController
{
    private readonly IRepository<User> _userRepository;

    public UserService(IRepository<User> userRepository)
    {
        _userRepository = userRepository;
    }

    // 获取所有用户
    public async Task<List<User>> GetAllUsers()
    {
        return await _userRepository.Entities.ToListAsync();
    }

    // 根据ID获取用户
    public async Task<User> GetUser(int id)
    {
        return await _userRepository.FindAsync(id);
    }
}
```

### 6.5.2 仓储的常用方法

`IRepository<T>` 提供了丰富的数据操作方法：

| 方法类别 | 方法名 | 说明 |
|---------|--------|------|
| 查询 | `FindAsync` | 根据主键查找 |
| 查询 | `FirstOrDefaultAsync` | 获取第一条记录 |
| 查询 | `Where` | 条件查询 |
| 查询 | `Entities` | 获取 IQueryable |
| 新增 | `InsertAsync` | 新增单条记录 |
| 新增 | `InsertRangeAsync` | 批量新增 |
| 更新 | `UpdateAsync` | 更新记录 |
| 更新 | `UpdateRangeAsync` | 批量更新 |
| 删除 | `DeleteAsync` | 删除记录 |
| 删除 | `DeleteRangeAsync` | 批量删除 |
| 存在 | `AnyAsync` | 是否存在记录 |
| 计数 | `CountAsync` | 记录数量 |

### 6.5.3 多数据库仓储

访问不同数据库的仓储：

```csharp
public class MultiDbService : IDynamicApiController
{
    // 默认数据库仓储
    private readonly IRepository<User> _userRepository;

    // MySQL 数据库仓储
    private readonly IRepository<Log, MySqlDbContextLocator> _logRepository;

    public MultiDbService(
        IRepository<User> userRepository,
        IRepository<Log, MySqlDbContextLocator> logRepository)
    {
        _userRepository = userRepository;
        _logRepository = logRepository;
    }
}
```

## 6.6 CRUD操作详解

### 6.6.1 新增操作（Create）

```csharp
public class UserService : IDynamicApiController
{
    private readonly IRepository<User> _repository;

    public UserService(IRepository<User> repository)
    {
        _repository = repository;
    }

    // 新增单条记录
    public async Task<User> CreateUser(UserInput input)
    {
        var user = new User
        {
            UserName = input.UserName,
            Email = input.Email,
            Age = input.Age
        };

        var newUser = await _repository.InsertNowAsync(user);
        return newUser.Entity;
    }

    // 批量新增
    public async Task BatchCreateUsers(List<UserInput> inputs)
    {
        var users = inputs.Select(input => new User
        {
            UserName = input.UserName,
            Email = input.Email,
            Age = input.Age
        }).ToList();

        await _repository.InsertRangeAsync(users);
        await _repository.SaveNowAsync();
    }
}
```

### 6.6.2 查询操作（Read）

```csharp
public class UserQueryService : IDynamicApiController
{
    private readonly IRepository<User> _repository;

    public UserQueryService(IRepository<User> repository)
    {
        _repository = repository;
    }

    // 根据ID查询
    public async Task<User> GetById(int id)
    {
        return await _repository.FindAsync(id);
    }

    // 条件查询
    public async Task<List<User>> GetByCondition(string keyword, int? minAge)
    {
        var query = _repository.Where(u => true);

        if (!string.IsNullOrEmpty(keyword))
        {
            query = query.Where(u => u.UserName.Contains(keyword)
                                  || u.Email.Contains(keyword));
        }

        if (minAge.HasValue)
        {
            query = query.Where(u => u.Age >= minAge.Value);
        }

        return await query.OrderByDescending(u => u.Id).ToListAsync();
    }

    // 包含导航属性查询
    public async Task<User> GetUserWithRoles(int id)
    {
        return await _repository.Entities
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == id);
    }

    // 投影查询（只查询需要的字段）
    public async Task<List<UserDto>> GetUserDtos()
    {
        return await _repository.Entities
            .Select(u => new UserDto
            {
                Id = u.Id,
                UserName = u.UserName,
                Email = u.Email
            })
            .ToListAsync();
    }
}
```

### 6.6.3 更新操作（Update）

```csharp
public class UserUpdateService : IDynamicApiController
{
    private readonly IRepository<User> _repository;

    public UserUpdateService(IRepository<User> repository)
    {
        _repository = repository;
    }

    // 完整更新
    public async Task UpdateUser(int id, UserUpdateInput input)
    {
        var user = await _repository.FindAsync(id);
        if (user == null) throw new Exception("用户不存在");

        user.UserName = input.UserName;
        user.Email = input.Email;
        user.Age = input.Age;

        await _repository.UpdateAsync(user);
        await _repository.SaveNowAsync();
    }

    // 部分更新（只更新指定字段）
    public async Task UpdateUserName(int id, string newName)
    {
        var user = await _repository.FindAsync(id);
        if (user == null) throw new Exception("用户不存在");

        user.UserName = newName;

        await _repository.UpdateIncludeAsync(user, new[] { nameof(User.UserName) });
        await _repository.SaveNowAsync();
    }

    // 排除字段更新
    public async Task UpdateUserExcludeEmail(int id, UserUpdateInput input)
    {
        var user = new User { Id = id, UserName = input.UserName, Age = input.Age };

        await _repository.UpdateExcludeAsync(user, new[] { nameof(User.Email) });
        await _repository.SaveNowAsync();
    }
}
```

### 6.6.4 删除操作（Delete）

```csharp
public class UserDeleteService : IDynamicApiController
{
    private readonly IRepository<User> _repository;

    public UserDeleteService(IRepository<User> repository)
    {
        _repository = repository;
    }

    // 根据ID删除
    public async Task DeleteUser(int id)
    {
        var user = await _repository.FindAsync(id);
        if (user == null) throw new Exception("用户不存在");

        await _repository.DeleteAsync(user);
        await _repository.SaveNowAsync();
    }

    // 根据实体删除
    public async Task DeleteByEntity(User user)
    {
        await _repository.DeleteAsync(user);
        await _repository.SaveNowAsync();
    }

    // 批量删除
    public async Task BatchDelete(List<int> ids)
    {
        var users = await _repository.Where(u => ids.Contains(u.Id)).ToListAsync();
        await _repository.DeleteRangeAsync(users);
        await _repository.SaveNowAsync();
    }

    // 软删除（逻辑删除）
    public async Task SoftDelete(int id)
    {
        var user = await _repository.FindAsync(id);
        if (user == null) throw new Exception("用户不存在");

        user.IsDeleted = true;
        await _repository.UpdateAsync(user);
        await _repository.SaveNowAsync();
    }
}
```

## 6.7 分页查询

Furion 提供了内置的分页支持：

```csharp
public class UserPageService : IDynamicApiController
{
    private readonly IRepository<User> _repository;

    public UserPageService(IRepository<User> repository)
    {
        _repository = repository;
    }

    // 基础分页查询
    public async Task<PagedList<User>> GetPagedUsers(int pageIndex = 1, int pageSize = 20)
    {
        return await _repository.Entities
            .OrderByDescending(u => u.Id)
            .ToPagedListAsync(pageIndex, pageSize);
    }

    // 带条件的分页查询
    public async Task<PagedList<UserDto>> GetPagedUserDtos(
        string keyword,
        int pageIndex = 1,
        int pageSize = 20)
    {
        var query = _repository.Entities.AsQueryable();

        if (!string.IsNullOrEmpty(keyword))
        {
            query = query.Where(u => u.UserName.Contains(keyword)
                                  || u.Email.Contains(keyword));
        }

        return await query
            .OrderByDescending(u => u.Id)
            .Select(u => new UserDto
            {
                Id = u.Id,
                UserName = u.UserName,
                Email = u.Email
            })
            .ToPagedListAsync(pageIndex, pageSize);
    }
}

// 分页结果模型
// PagedList<T> 包含以下属性：
// - Items: 当前页数据
// - TotalCount: 总记录数
// - TotalPages: 总页数
// - PageIndex: 当前页码
// - PageSize: 每页大小
// - HasPrevPage: 是否有上一页
// - HasNextPage: 是否有下一页
```

## 6.8 原生SQL查询

当 LINQ 无法满足需求时，可以使用原生 SQL：

```csharp
public class RawSqlService : IDynamicApiController
{
    private readonly IRepository<User> _repository;
    private readonly ISqlRepository _sqlRepository;

    public RawSqlService(IRepository<User> repository, ISqlRepository sqlRepository)
    {
        _repository = repository;
        _sqlRepository = sqlRepository;
    }

    // 原生 SQL 查询
    public async Task<List<User>> GetUsersBySql()
    {
        return await _repository.SqlQueriesAsync(
            "SELECT * FROM t_user WHERE Age > @p0", 18);
    }

    // 参数化查询（防止SQL注入）
    public async Task<List<User>> SearchUsers(string keyword)
    {
        return await _repository.SqlQueriesAsync(
            "SELECT * FROM t_user WHERE UserName LIKE @p0",
            $"%{keyword}%");
    }

    // 执行存储过程
    public async Task<List<User>> GetUsersByProc(int minAge)
    {
        return await _repository.SqlQueriesAsync(
            "EXEC sp_GetUsersByAge @p0", minAge);
    }

    // 执行非查询 SQL（INSERT/UPDATE/DELETE）
    public async Task<int> ExecuteNonQuery()
    {
        return await _sqlRepository.SqlNonQueryAsync(
            "UPDATE t_user SET Age = Age + 1 WHERE Age < @p0", 18);
    }

    // 执行标量查询
    public async Task<object> GetUserCount()
    {
        return await _sqlRepository.SqlScalarAsync(
            "SELECT COUNT(*) FROM t_user");
    }
}
```

## 6.9 事务管理

### 6.9.1 自动事务

Furion 的 `SaveChanges` 默认在同一个 DbContext 中是事务性的：

```csharp
public class TransactionService : IDynamicApiController
{
    private readonly IRepository<User> _userRepo;
    private readonly IRepository<Order> _orderRepo;

    public TransactionService(
        IRepository<User> userRepo,
        IRepository<Order> orderRepo)
    {
        _userRepo = userRepo;
        _orderRepo = orderRepo;
    }

    // 手动事务控制
    public async Task CreateOrderWithTransaction(OrderInput input)
    {
        // 使用 EnsureTransaction 确保事务
        using var transaction = await _userRepo.Context.Database.BeginTransactionAsync();

        try
        {
            // 操作1：创建用户
            var user = new User
            {
                UserName = input.UserName,
                Email = input.Email
            };
            await _userRepo.InsertNowAsync(user);

            // 操作2：创建订单
            var order = new Order
            {
                OrderNo = Guid.NewGuid().ToString("N"),
                Amount = input.Amount,
                UserId = user.Entity.Id,
                Status = OrderStatus.Pending
            };
            await _orderRepo.InsertNowAsync(order);

            // 提交事务
            await transaction.CommitAsync();
        }
        catch (Exception)
        {
            // 回滚事务
            await transaction.RollbackAsync();
            throw;
        }
    }
}
```

### 6.9.2 工作单元模式

```csharp
public class UnitOfWorkService : IDynamicApiController
{
    private readonly IRepository<User> _userRepo;
    private readonly IRepository<Order> _orderRepo;

    public UnitOfWorkService(
        IRepository<User> userRepo,
        IRepository<Order> orderRepo)
    {
        _userRepo = userRepo;
        _orderRepo = orderRepo;
    }

    // 使用 [UnitOfWork] 特性自动管理事务
    [UnitOfWork]
    public async Task CreateUserAndOrder(UserOrderInput input)
    {
        // 新增用户
        var user = new User { UserName = input.UserName, Email = input.Email };
        await _userRepo.InsertAsync(user);

        // 新增订单
        var order = new Order
        {
            OrderNo = Guid.NewGuid().ToString("N"),
            Amount = input.Amount,
            Status = OrderStatus.Pending
        };
        await _orderRepo.InsertAsync(order);

        // UnitOfWork 会在方法结束时自动调用 SaveChanges 并管理事务
    }
}
```

## 6.10 数据库迁移

### 6.10.1 Code First 迁移

通过代码定义实体，自动生成数据库结构：

```bash
# 安装 EF Core 工具
dotnet tool install --global dotnet-ef

# 添加迁移
dotnet ef migrations add InitialCreate -p YourProject.EntityFramework.Core -s YourProject.Web.Entry

# 更新数据库
dotnet ef database update -p YourProject.EntityFramework.Core -s YourProject.Web.Entry

# 生成 SQL 脚本（不直接执行）
dotnet ef migrations script -p YourProject.EntityFramework.Core -s YourProject.Web.Entry -o migration.sql

# 回滚迁移
dotnet ef database update PreviousMigrationName -p YourProject.EntityFramework.Core -s YourProject.Web.Entry

# 移除最后一次迁移
dotnet ef migrations remove -p YourProject.EntityFramework.Core -s YourProject.Web.Entry
```

### 6.10.2 Database First（从数据库生成实体）

```bash
# 从现有数据库反向生成实体
dotnet ef dbcontext scaffold "Server=localhost;Database=FurionDb;User Id=sa;Password=your_password;" Microsoft.EntityFrameworkCore.SqlServer -o Models -c DefaultDbContext -p YourProject.EntityFramework.Core -s YourProject.Web.Entry
```

## 6.11 多数据库支持

Furion 支持的数据库及对应的 NuGet 包：

| 数据库 | NuGet 包 | DbProvider |
|--------|----------|------------|
| SQL Server | `Microsoft.EntityFrameworkCore.SqlServer` | `DbProvider.SqlServer` |
| MySQL | `Pomelo.EntityFrameworkCore.MySql` | `DbProvider.MySql` |
| PostgreSQL | `Npgsql.EntityFrameworkCore.PostgreSQL` | `DbProvider.Npgsql` |
| SQLite | `Microsoft.EntityFrameworkCore.Sqlite` | `DbProvider.Sqlite` |
| Oracle | `Oracle.EntityFrameworkCore` | `DbProvider.Oracle` |
| 内存数据库 | `Microsoft.EntityFrameworkCore.InMemory` | `DbProvider.InMemoryDatabase` |

```csharp
// 多数据库同时使用示例
builder.Services.AddDatabaseAccessor(options =>
{
    // 主数据库 - SqlServer
    options.AddDbPool<DefaultDbContext>(DbProvider.SqlServer);

    // 日志数据库 - MySQL
    options.AddDbPool<LogDbContext, LogDbContextLocator>(DbProvider.MySql);

    // 缓存数据库 - SQLite
    options.AddDbPool<CacheDbContext, CacheDbContextLocator>(DbProvider.Sqlite);
});
```

## 6.12 读写分离

```csharp
// 配置读写分离
[AppDbContext("ConnectionStrings:MasterConnection", DbProvider.SqlServer)]
public class MasterDbContext : AppDbContext<MasterDbContext>
{
    public MasterDbContext(DbContextOptions<MasterDbContext> options) : base(options) { }
}

// 只读数据库上下文
public sealed class SlaveDbContextLocator : IDbContextLocator { }

[AppDbContext("ConnectionStrings:SlaveConnection", DbProvider.SqlServer)]
public class SlaveDbContext : AppDbContext<SlaveDbContext, SlaveDbContextLocator>
{
    public SlaveDbContext(DbContextOptions<SlaveDbContext> options) : base(options) { }
}

// 使用读写分离
public class ReadWriteService : IDynamicApiController
{
    private readonly IRepository<User> _writeRepo;  // 写库
    private readonly IRepository<User, SlaveDbContextLocator> _readRepo;  // 读库

    public ReadWriteService(
        IRepository<User> writeRepo,
        IRepository<User, SlaveDbContextLocator> readRepo)
    {
        _writeRepo = writeRepo;
        _readRepo = readRepo;
    }

    // 查询走从库
    public async Task<List<User>> GetUsers()
    {
        return await _readRepo.Entities.ToListAsync();
    }

    // 写入走主库
    public async Task CreateUser(UserInput input)
    {
        var user = new User { UserName = input.UserName, Email = input.Email };
        await _writeRepo.InsertNowAsync(user);
    }
}
```

## 6.13 数据种子与初始化

```csharp
using Furion.DatabaseAccessor;
using Microsoft.EntityFrameworkCore;

// 实现 IEntitySeedData<T> 接口来配置种子数据
public class UserSeedData : IEntitySeedData<User>
{
    public IEnumerable<User> HasData(DbContext dbContext, Type dbContextLocator)
    {
        return new List<User>
        {
            new User
            {
                Id = 1,
                UserName = "admin",
                Email = "admin@example.com",
                Age = 30
            },
            new User
            {
                Id = 2,
                UserName = "guest",
                Email = "guest@example.com",
                Age = 25
            }
        };
    }
}

// 也可以在 OnModelCreating 中配置种子数据
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    modelBuilder.Entity<Role>().HasData(
        new Role { Id = 1, Name = "管理员", Code = "admin" },
        new Role { Id = 2, Name = "普通用户", Code = "user" },
        new Role { Id = 3, Name = "访客", Code = "guest" }
    );
}
```

## 6.14 性能优化建议

### 6.14.1 查询优化

```csharp
public class PerformanceService : IDynamicApiController
{
    private readonly IRepository<User> _repository;

    public PerformanceService(IRepository<User> repository)
    {
        _repository = repository;
    }

    // 1. 使用 AsNoTracking 提升只读查询性能
    public async Task<List<User>> GetUsersNoTracking()
    {
        return await _repository.AsQueryable()
            .AsNoTracking()
            .ToListAsync();
    }

    // 2. 只查询需要的字段（投影查询）
    public async Task<List<UserDto>> GetUserDtos()
    {
        return await _repository.Entities
            .AsNoTracking()
            .Select(u => new UserDto
            {
                Id = u.Id,
                UserName = u.UserName
            })
            .ToListAsync();
    }

    // 3. 使用 AsSplitQuery 优化多导航属性加载
    public async Task<List<User>> GetUsersWithDetails()
    {
        return await _repository.Entities
            .Include(u => u.Roles)
            .AsSplitQuery()
            .ToListAsync();
    }

    // 4. 批量操作而非逐条操作
    public async Task BatchInsert(List<UserInput> inputs)
    {
        var users = inputs.Select(i => new User
        {
            UserName = i.UserName,
            Email = i.Email
        }).ToList();

        // 批量插入，一次性 SaveChanges
        await _repository.InsertRangeAsync(users);
        await _repository.SaveNowAsync();
    }
}
```

### 6.14.2 性能优化清单

| 优化项 | 说明 |
|--------|------|
| 使用 `AsNoTracking()` | 只读查询时禁用变更跟踪 |
| 投影查询 | 只查询需要的字段，减少数据传输 |
| 分页查询 | 避免一次性加载大量数据 |
| 延迟加载 vs 预加载 | 根据场景选择合适的加载策略 |
| 批量操作 | 使用 `InsertRange` / `UpdateRange` 而非循环单条操作 |
| 索引优化 | 为频繁查询的字段建立索引 |
| 连接池 | 合理配置数据库连接池大小 |
| 缓存 | 对热点数据使用缓存，减少数据库压力 |
| `AsSplitQuery()` | 多 Include 时使用拆分查询 |
| 原生 SQL | 复杂查询考虑使用原生 SQL 提升性能 |

---

**上一章**: [第五章-依赖注入与服务注册](第五章-依赖注入与服务注册.md) | [返回目录](index.md) | **下一章**: [第七章-数据验证与异常处理](第七章-数据验证与异常处理.md)
