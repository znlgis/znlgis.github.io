# 第04章：CodeFirst代码优先开发

## 目录

1. [什么是Code First](#1-什么是code-first)
2. [InitTables基础用法](#2-inittables基础用法)
3. [表的创建与更新](#3-表的创建与更新)
4. [备份表与安全迁移](#4-备份表与安全迁移)
5. [列的增删改](#5-列的增删改)
6. [索引管理](#6-索引管理)
7. [不同数据库的类型处理](#7-不同数据库的类型处理)
8. [种子数据](#8-种子数据)
9. [CodeFirst配置选项](#9-codefirst配置选项)
10. [实战开发流程](#10-实战开发流程)
11. [处理已有数据库](#11-处理已有数据库)
12. [最佳实践](#12-最佳实践)
13. [本章小结](#13-本章小结)

---

## 1. 什么是Code First

### 1.1 Code First的概念

Code First（代码优先）是一种数据库开发模式，开发者首先编写 C# 实体类代码，然后由 ORM 框架根据实体类的定义自动创建或更新数据库表结构。

与之相对的是 **Db First**（数据库优先），即先设计数据库表，然后生成 C# 实体类。

```
Code First 工作流程：

  编写实体类 (C#)
       ↓
  配置特性/Fluent API
       ↓
  调用 InitTables()
       ↓
  ┌─────────────────┐
  │ 表不存在？→ 创建表 │
  │ 表已存在？→ 更新表 │
  │   新增列？→ 添加列 │
  │   列变更？→ 修改列 │
  └─────────────────┘
       ↓
  数据库表结构就绪
```

### 1.2 Code First 与 Db First 对比

| 对比维度 | Code First | Db First |
|---------|-----------|---------|
| 开发起点 | C# 实体类 | 数据库表 |
| 适用场景 | 新项目开发 | 已有数据库的项目 |
| 版本控制 | 实体类即文档，Git 友好 | 需要额外维护 SQL 脚本 |
| 灵活性 | 代码驱动，易于重构 | 数据库驱动 |
| 学习成本 | 需要了解特性配置 | 需要了解数据库设计 |
| 协作方式 | 修改代码 → 自动同步表 | 修改表 → 重新生成代码 |

### 1.3 SqlSugar Code First 的特点

SqlSugar 的 Code First 具有以下特点：

- **增量更新**：只处理有变更的部分，不会破坏已有数据
- **安全迁移**：支持备份表后再迁移
- **多数据库兼容**：同一套实体类适配多种数据库
- **灵活控制**：可以控制是否允许删除列、修改列类型等
- **无需命令行**：不像 EF Core 需要 `dotnet ef migrations` 命令

---

## 2. InitTables基础用法

### 2.1 初始化单个表

```csharp
using SqlSugar;

var db = new SqlSugarClient(new ConnectionConfig()
{
    ConnectionString = "Server=localhost;Database=mydb;Uid=root;Pwd=123456;",
    DbType = DbType.MySql,
    IsAutoCloseConnection = true,
    InitKeyType = InitKeyType.Attribute
});

// 根据实体类创建/更新 Student 表
db.CodeFirst.InitTables<Student>();
```

### 2.2 初始化多个表

```csharp
// 方式1：泛型方式（逐个指定）
db.CodeFirst.InitTables<Student>();
db.CodeFirst.InitTables<Course>();
db.CodeFirst.InitTables<Teacher>();

// 方式2：Type 数组方式（推荐）
db.CodeFirst.InitTables(
    typeof(Student),
    typeof(Course),
    typeof(Teacher),
    typeof(StudentCourse)
);
```

### 2.3 通过程序集批量初始化

在大型项目中，可以通过反射自动发现并初始化所有实体类：

```csharp
using System.Reflection;

// 获取实体类所在程序集
var entityAssembly = Assembly.Load("MyApp.Entity");

// 获取所有带有 SugarTable 特性的类
var entityTypes = entityAssembly.GetTypes()
    .Where(t => t.IsClass && !t.IsAbstract)
    .Where(t => t.GetCustomAttribute<SugarTableAttribute>() != null)
    .ToArray();

// 批量初始化
db.CodeFirst.InitTables(entityTypes);

Console.WriteLine($"已初始化 {entityTypes.Length} 张表");
```

### 2.4 通过基类发现实体

```csharp
// 获取所有继承自 BaseEntity 的实体类
var entityTypes = Assembly.Load("MyApp.Entity")
    .GetTypes()
    .Where(t => t.IsClass && !t.IsAbstract)
    .Where(t => t.IsSubclassOf(typeof(BaseEntity)))
    .ToArray();

db.CodeFirst.InitTables(entityTypes);
```

或者使用自定义接口标记：

```csharp
// 定义标记接口
public interface IEntity { }

// 实体类实现接口
[SugarTable("student")]
public class Student : IEntity
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// 批量发现并初始化
var entityTypes = Assembly.Load("MyApp.Entity")
    .GetTypes()
    .Where(t => typeof(IEntity).IsAssignableFrom(t) && t.IsClass && !t.IsAbstract)
    .ToArray();

db.CodeFirst.InitTables(entityTypes);
```

---

## 3. 表的创建与更新

### 3.1 自动创建新表

当实体类对应的表不存在时，`InitTables` 会自动创建表：

```csharp
[SugarTable("t_product", TableDescription = "商品表")]
public class Product
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true, ColumnDescription = "商品ID")]
    public int Id { get; set; }

    [SugarColumn(Length = 100, IsNullable = false, ColumnDescription = "商品名称")]
    public string ProductName { get; set; } = string.Empty;

    [SugarColumn(Length = 18, DecimalDigits = 2, ColumnDescription = "商品价格")]
    public decimal Price { get; set; }

    [SugarColumn(DefaultValue = "0", ColumnDescription = "库存数量")]
    public int Stock { get; set; }

    [SugarColumn(IsNullable = true, Length = 500, ColumnDescription = "商品描述")]
    public string? Description { get; set; }

    [SugarColumn(IsOnlyIgnoreUpdate = true, ColumnDescription = "创建时间")]
    public DateTime CreateTime { get; set; } = DateTime.Now;
}

// 执行后会生成类似以下 SQL（MySQL）：
// CREATE TABLE `t_product` (
//   `Id` int NOT NULL AUTO_INCREMENT COMMENT '商品ID',
//   `ProductName` varchar(100) NOT NULL COMMENT '商品名称',
//   `Price` decimal(18,2) NOT NULL COMMENT '商品价格',
//   `Stock` int NOT NULL DEFAULT 0 COMMENT '库存数量',
//   `Description` varchar(500) NULL COMMENT '商品描述',
//   `CreateTime` datetime NOT NULL COMMENT '创建时间',
//   PRIMARY KEY (`Id`)
// ) COMMENT='商品表';
db.CodeFirst.InitTables<Product>();
```

### 3.2 自动更新已有表

当实体类发生变更时，`InitTables` 会自动对比并更新表结构：

```csharp
// 假设我们给 Product 实体类新增了一个字段
[SugarTable("t_product", TableDescription = "商品表")]
public class Product
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    [SugarColumn(Length = 100, IsNullable = false)]
    public string ProductName { get; set; } = string.Empty;

    [SugarColumn(Length = 18, DecimalDigits = 2)]
    public decimal Price { get; set; }

    public int Stock { get; set; }

    [SugarColumn(IsNullable = true, Length = 500)]
    public string? Description { get; set; }

    public DateTime CreateTime { get; set; } = DateTime.Now;

    // ✅ 新增字段：商品分类
    [SugarColumn(Length = 50, IsNullable = true, ColumnDescription = "商品分类")]
    public string? Category { get; set; }

    // ✅ 新增字段：是否上架
    [SugarColumn(DefaultValue = "1", ColumnDescription = "是否上架")]
    public bool IsOnSale { get; set; }
}

// 再次执行 InitTables，会自动添加新列
// ALTER TABLE `t_product` ADD COLUMN `Category` varchar(50) NULL COMMENT '商品分类';
// ALTER TABLE `t_product` ADD COLUMN `IsOnSale` bit NOT NULL DEFAULT 1 COMMENT '是否上架';
db.CodeFirst.InitTables<Product>();
```

### 3.3 InitTables的工作流程

```
InitTables() 执行流程：

1. 检查表是否存在
   ├── 不存在 → 创建新表（包含所有列、主键、默认值、注释）
   └── 已存在 → 进入对比流程
                  ↓
2. 对比实体类与数据库表结构
   ├── 发现新增属性 → 添加列（ALTER TABLE ADD COLUMN）
   ├── 发现列类型变更 → 修改列（ALTER TABLE MODIFY COLUMN）
   ├── 发现列长度变更 → 修改列
   ├── 发现默认值变更 → 修改列
   ├── 发现可空性变更 → 修改列
   └── 发现实体中没有的列 → 根据配置决定是否删除
                              ↓
3. 完成迁移
```

> **重要**：`InitTables` 是增量更新的，不会删除表中已有的数据。

---

## 4. 备份表与安全迁移

### 4.1 备份表后再迁移

在生产环境中，建议先备份表再执行迁移：

```csharp
// 备份表后再更新结构
db.CodeFirst
    .BackupTable()       // 先备份表（创建备份副本）
    .InitTables<Product>();

// 备份的表名格式为：原表名_日期时间
// 例如：t_product_20240101120000
```

### 4.2 自定义备份表名

```csharp
// 使用自定义备份后缀
db.CodeFirst
    .BackupTable(maxBackupCount: 5)  // 最多保留5个备份
    .InitTables<Product>();
```

### 4.3 手动备份

```csharp
// 方式1：使用 SQL 直接备份
db.Ado.ExecuteCommand("CREATE TABLE t_product_backup AS SELECT * FROM t_product");

// 方式2：检查是否需要迁移
var tableColumns = db.DbMaintenance.GetColumnInfosByTableName("t_product");
Console.WriteLine($"当前表有 {tableColumns.Count} 列");

foreach (var col in tableColumns)
{
    Console.WriteLine($"  列名:{col.DbColumnName} 类型:{col.DataType} 可空:{col.IsNullable}");
}
```

### 4.4 安全迁移策略

```csharp
public static void SafeMigrate(ISqlSugarClient db, params Type[] entityTypes)
{
    Console.WriteLine("开始数据库迁移...");

    foreach (var entityType in entityTypes)
    {
        var tableName = entityType.GetCustomAttribute<SugarTableAttribute>()?.TableName
            ?? entityType.Name;

        try
        {
            // 检查表是否存在
            var tableExists = db.DbMaintenance.IsAnyTable(tableName);

            if (tableExists)
            {
                Console.WriteLine($"  表 {tableName} 已存在，执行增量更新...");
                // 备份后更新
                db.CodeFirst.BackupTable().InitTables(entityType);
            }
            else
            {
                Console.WriteLine($"  表 {tableName} 不存在，创建新表...");
                db.CodeFirst.InitTables(entityType);
            }

            Console.WriteLine($"  ✅ {tableName} 迁移完成");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  ❌ {tableName} 迁移失败: {ex.Message}");
            throw;
        }
    }

    Console.WriteLine("数据库迁移全部完成！");
}

// 使用
SafeMigrate(db, typeof(Student), typeof(Course), typeof(Teacher));
```

---

## 5. 列的增删改

### 5.1 新增列

在实体类中新增属性，然后调用 `InitTables` 即可：

```csharp
// 原始实体
public class Student
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
}

// 新增两个属性
public class Student
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }

    // ✅ 新增：邮箱
    [SugarColumn(Length = 100, IsNullable = true)]
    public string? Email { get; set; }

    // ✅ 新增：手机号
    [SugarColumn(Length = 20, IsNullable = true)]
    public string? Phone { get; set; }
}

// 执行迁移
db.CodeFirst.InitTables<Student>();
// 生成 SQL：
// ALTER TABLE Student ADD COLUMN Email varchar(100) NULL;
// ALTER TABLE Student ADD COLUMN Phone varchar(20) NULL;
```

> **提示**：新增列建议设置 `IsNullable = true` 或提供 `DefaultValue`，以避免与已有数据冲突。

### 5.2 修改列

修改列的类型、长度或可空性：

```csharp
// 修改前：Name 为 varchar(50)
[SugarColumn(Length = 50, IsNullable = false)]
public string Name { get; set; } = string.Empty;

// 修改后：Name 改为 varchar(100)
[SugarColumn(Length = 100, IsNullable = false)]
public string Name { get; set; } = string.Empty;

// 执行迁移
db.CodeFirst.InitTables<Student>();
// 生成 SQL：
// ALTER TABLE Student MODIFY COLUMN Name varchar(100) NOT NULL;
```

### 5.3 重命名列

使用 `OldColumnName` 特性来重命名列：

```csharp
public class Student
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    // 将列从 StudentName 重命名为 Name
    [SugarColumn(OldColumnName = "StudentName", Length = 100)]
    public string Name { get; set; } = string.Empty;

    // 将列从 BirthDate 重命名为 Birthday
    [SugarColumn(OldColumnName = "BirthDate", IsNullable = true)]
    public DateTime? Birthday { get; set; }
}

// 执行迁移
db.CodeFirst.InitTables<Student>();
// 生成 SQL：
// ALTER TABLE Student RENAME COLUMN StudentName TO Name;
```

> **注意**：`OldColumnName` 在迁移完成后应该保留一段时间再移除，以确保所有环境都已完成迁移。

### 5.4 删除列

默认情况下，SqlSugar 的 Code First **不会自动删除**实体类中不存在但数据库表中存在的列，这是为了数据安全。

如果需要允许删除列，可以使用以下配置：

```csharp
// 方式1：全局配置，允许删除不存在的列（谨慎使用！）
db.CodeFirst.InitTables<Student>();
// 默认不删除多余的列

// 方式2：在 SugarTable 中禁止删除
[SugarTable("student", IsDisabledDelete = true)]
public class Student
{
    // IsDisabledDelete = true 确保不会删除数据库中多余的列
}
```

如果确实需要删除列，可以使用 `DbMaintenance` 手动操作：

```csharp
// 手动删除列
if (db.DbMaintenance.IsAnyColumn("Student", "OldColumn"))
{
    db.DbMaintenance.DropColumn("Student", "OldColumn");
    Console.WriteLine("已删除列 OldColumn");
}
```

---

## 6. 索引管理

### 6.1 使用SugarIndex特性

SqlSugar 提供了 `[SugarIndex]` 特性来创建索引：

```csharp
// 在实体类上定义索引
[SugarTable("sys_user")]
[SugarIndex("idx_user_name", nameof(UserName), OrderByType.Asc)]
[SugarIndex("idx_user_email", nameof(Email), OrderByType.Asc)]
public class SysUser
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(Length = 50)]
    public string UserName { get; set; } = string.Empty;

    [SugarColumn(Length = 100, IsNullable = true)]
    public string? Email { get; set; }

    public int Status { get; set; }
}
```

### 6.2 唯一索引

```csharp
// 唯一索引
[SugarTable("sys_user")]
[SugarIndex("uk_user_name", nameof(UserName), OrderByType.Asc, true)]  // 最后一个参数 true 表示唯一索引
public class SysUser
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(Length = 50)]
    public string UserName { get; set; } = string.Empty;
}
```

### 6.3 复合索引

```csharp
// 复合索引（多列索引）
[SugarTable("t_order")]
[SugarIndex("idx_order_user_date", nameof(UserId), OrderByType.Asc, nameof(CreateTime), OrderByType.Desc)]
[SugarIndex("uk_order_no", nameof(OrderNo), OrderByType.Asc, true)]  // 唯一索引
public class Order
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(Length = 50)]
    public string OrderNo { get; set; } = string.Empty;

    public long UserId { get; set; }

    [SugarColumn(Length = 18, DecimalDigits = 2)]
    public decimal Amount { get; set; }

    public DateTime CreateTime { get; set; } = DateTime.Now;
}

// InitTables 会自动创建索引
db.CodeFirst.InitTables<Order>();
```

### 6.4 通过SugarColumn配置索引

```csharp
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    // 通过 IndexGroupNameList 创建索引
    [SugarColumn(Length = 50, IndexGroupNameList = new[] { "idx_user_name" })]
    public string UserName { get; set; } = string.Empty;

    // 通过 UniqueGroupNameList 创建唯一索引
    [SugarColumn(Length = 100, UniqueGroupNameList = new[] { "uk_user_email" })]
    public string? Email { get; set; }

    // 多个字段共用一个索引名称，形成复合索引
    [SugarColumn(IndexGroupNameList = new[] { "idx_user_status_role" })]
    public int Status { get; set; }

    [SugarColumn(IndexGroupNameList = new[] { "idx_user_status_role" })]
    public int RoleId { get; set; }
}
```

### 6.5 手动管理索引

```csharp
// 检查索引是否存在
var isExist = db.DbMaintenance.IsAnyIndex("idx_user_name");

// 创建索引
if (!isExist)
{
    db.Ado.ExecuteCommand("CREATE INDEX idx_user_name ON sys_user(UserName)");
}

// 删除索引
db.Ado.ExecuteCommand("DROP INDEX idx_user_name ON sys_user");

// 查看表的所有索引
var indexList = db.DbMaintenance.GetIndexList("sys_user");
foreach (var idx in indexList)
{
    Console.WriteLine($"索引名: {idx}");
}
```

---

## 7. 不同数据库的类型处理

### 7.1 类型映射差异

不同数据库对同一 C# 类型的映射可能不同：

```csharp
public class TypeDemo
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    // string 类型在不同数据库中的映射
    [SugarColumn(Length = 100)]
    public string Name { get; set; } = string.Empty;
    // MySQL: varchar(100)
    // SQL Server: nvarchar(100)
    // PostgreSQL: varchar(100)
    // Oracle: NVARCHAR2(100)
    // SQLite: TEXT

    // bool 类型
    public bool IsActive { get; set; }
    // MySQL: tinyint(1)
    // SQL Server: bit
    // PostgreSQL: boolean
    // Oracle: NUMBER(1)
    // SQLite: INTEGER

    // DateTime 类型
    public DateTime CreateTime { get; set; }
    // MySQL: datetime
    // SQL Server: datetime
    // PostgreSQL: timestamp
    // Oracle: DATE
    // SQLite: TEXT

    // decimal 类型
    [SugarColumn(Length = 18, DecimalDigits = 2)]
    public decimal Price { get; set; }
    // MySQL: decimal(18,2)
    // SQL Server: decimal(18,2)
    // PostgreSQL: numeric(18,2)
    // Oracle: NUMBER(18,2)
    // SQLite: REAL
}
```

### 7.2 使用ColumnDataType指定数据库特定类型

```csharp
public class SpecialTypeDemo
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    // 大文本
    [SugarColumn(ColumnDataType = "text")]
    public string Content { get; set; } = string.Empty;

    // 二进制数据
    [SugarColumn(ColumnDataType = "blob", IsNullable = true)]
    public byte[]? FileData { get; set; }
}
```

### 7.3 跨数据库兼容写法

```csharp
// 推荐的跨数据库兼容写法
public class CrossDbEntity
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    // 使用 Length 而非 ColumnDataType，让 SqlSugar 自动适配
    [SugarColumn(Length = 200)]
    public string Title { get; set; } = string.Empty;

    // 大文本：使用 Length = -1
    [SugarColumn(Length = -1)]
    public string Content { get; set; } = string.Empty;
    // MySQL → longtext
    // SQL Server → nvarchar(max)
    // PostgreSQL → text

    // 精确小数
    [SugarColumn(Length = 18, DecimalDigits = 4)]
    public decimal Amount { get; set; }

    // 可空日期
    [SugarColumn(IsNullable = true)]
    public DateTime? ExpireTime { get; set; }

    // JSON存储：使用 IsJson + ColumnDataType = "text"
    [SugarColumn(IsJson = true, ColumnDataType = "text", IsNullable = true)]
    public Dictionary<string, object>? ExtData { get; set; }
}
```

### 7.4 数据库特定处理

```csharp
// 根据数据库类型进行特殊处理
if (db.CurrentConnectionConfig.DbType == DbType.MySql)
{
    // MySQL 特有操作
    db.Ado.ExecuteCommand("SET NAMES utf8mb4");
}
else if (db.CurrentConnectionConfig.DbType == DbType.PostgreSQL)
{
    // PostgreSQL 特有操作
    db.Ado.ExecuteCommand("SET search_path TO public");
}
```

---

## 8. 种子数据

### 8.1 基本种子数据

```csharp
// 初始化表并插入种子数据
public static void InitDatabase(ISqlSugarClient db)
{
    // 1. 创建表
    db.CodeFirst.InitTables<SysRole>();

    // 2. 检查是否需要初始化种子数据
    if (db.Queryable<SysRole>().Count() == 0)
    {
        var roles = new List<SysRole>
        {
            new() { RoleName = "超级管理员", RoleCode = "admin", Description = "拥有系统所有权限" },
            new() { RoleName = "普通用户", RoleCode = "user", Description = "拥有基本操作权限" },
            new() { RoleName = "访客", RoleCode = "guest", Description = "仅查看权限" }
        };

        db.Insertable(roles).ExecuteCommand();
        Console.WriteLine("✅ 角色种子数据已初始化");
    }
}
```

### 8.2 封装种子数据服务

```csharp
public interface IDbSeedData
{
    void Initialize(ISqlSugarClient db);
}

public class RoleSeedData : IDbSeedData
{
    public void Initialize(ISqlSugarClient db)
    {
        if (db.Queryable<SysRole>().Any()) return;

        db.Insertable(new List<SysRole>
        {
            new() { RoleName = "超级管理员", RoleCode = "admin" },
            new() { RoleName = "普通用户", RoleCode = "user" }
        }).ExecuteCommand();
    }
}

public class ConfigSeedData : IDbSeedData
{
    public void Initialize(ISqlSugarClient db)
    {
        if (db.Queryable<SysConfig>().Any()) return;

        db.Insertable(new List<SysConfig>
        {
            new() { ConfigKey = "site.name", ConfigValue = "我的系统" },
            new() { ConfigKey = "site.version", ConfigValue = "1.0.0" },
            new() { ConfigKey = "site.copyright", ConfigValue = "© 2024" }
        }).ExecuteCommand();
    }
}

// 统一初始化
public static void SeedAllData(ISqlSugarClient db)
{
    var seeders = new List<IDbSeedData>
    {
        new RoleSeedData(),
        new ConfigSeedData()
    };

    foreach (var seeder in seeders)
    {
        seeder.Initialize(db);
    }
}
```

### 8.3 使用InsertOrUpdate实现幂等种子

```csharp
public static void SeedDictionary(ISqlSugarClient db)
{
    var dictItems = new List<SysDictItem>
    {
        new() { DictType = "gender", DictLabel = "男", DictValue = "1", SortOrder = 1 },
        new() { DictType = "gender", DictLabel = "女", DictValue = "2", SortOrder = 2 },
        new() { DictType = "status", DictLabel = "启用", DictValue = "1", SortOrder = 1 },
        new() { DictType = "status", DictLabel = "禁用", DictValue = "0", SortOrder = 2 }
    };

    // InsertOrUpdate：存在则更新，不存在则插入（幂等操作）
    db.Storageable(dictItems).ExecuteCommand();
    Console.WriteLine("✅ 字典种子数据已同步");
}
```

### 8.4 从JSON文件加载种子数据

```csharp
using System.Text.Json;

public static void SeedFromJson<T>(ISqlSugarClient db, string jsonFilePath)
    where T : class, new()
{
    if (db.Queryable<T>().Any()) return;

    var json = File.ReadAllText(jsonFilePath);
    var data = JsonSerializer.Deserialize<List<T>>(json);

    if (data?.Any() == true)
    {
        db.Insertable(data).ExecuteCommand();
        Console.WriteLine($"✅ 从 {jsonFilePath} 加载了 {data.Count} 条种子数据");
    }
}

// 使用
SeedFromJson<SysRole>(db, "SeedData/roles.json");
SeedFromJson<SysDictItem>(db, "SeedData/dict_items.json");
```

---

## 9. CodeFirst配置选项

### 9.1 SetStringDefaultLength

设置 `string` 类型属性的默认长度：

```csharp
// 所有没有指定 Length 的 string 属性，默认长度为 200
db.CodeFirst.SetStringDefaultLength(200);
db.CodeFirst.InitTables<Student>();
```

| 场景 | 推荐默认长度 |
|------|-------------|
| 一般业务系统 | 200 或 255 |
| 存储较长文本 | 500 |
| 精简系统 | 100 |

### 9.2 通过ConfigureExternalServices配置

```csharp
var db = new SqlSugarScope(new ConnectionConfig()
{
    ConnectionString = "...",
    DbType = DbType.MySql,
    IsAutoCloseConnection = true,

    ConfigureExternalServices = new ConfigureExternalServices()
    {
        EntityService = (property, column) =>
        {
            // 所有 string 类型且未指定长度的，设为 200
            if (property.PropertyType == typeof(string) && column.Length == 0)
            {
                column.Length = 200;
            }

            // 所有 DateTime 类型设置默认描述
            if (property.PropertyType == typeof(DateTime)
                && string.IsNullOrEmpty(column.ColumnDescription))
            {
                column.ColumnDescription = "时间";
            }

            // 所有可空引用类型自动设置 IsNullable
            if (column.IsPrimaryKey == false
                && new NullabilityInfoContext().Create(property).WriteState
                    is NullabilityState.Nullable)
            {
                column.IsNullable = true;
            }
        }
    }
});
```

### 9.3 控制迁移行为

```csharp
// SugarTable 级别的迁移控制
[SugarTable("sys_config", IsDisabledDelete = true, IsDisabledUpdateAll = false)]
public class SysConfig
{
    // IsDisabledDelete = true：不会删除数据库中存在但实体中不存在的列
    // IsDisabledUpdateAll = false：允许更新列结构
}
```

### 9.4 创建数据库

SqlSugar 支持在 Code First 时自动创建数据库（如果数据库不存在）：

```csharp
// 创建数据库（如果不存在）
db.DbMaintenance.CreateDatabase();

// 然后创建表
db.CodeFirst.InitTables<Student>();
```

> **注意**：不是所有数据库都支持自动创建数据库。MySQL、SQL Server、PostgreSQL 等支持此功能，SQLite 会自动创建数据库文件。

完整的初始化流程：

```csharp
public static void InitializeDatabase(ISqlSugarClient db)
{
    // 第一步：创建数据库
    db.DbMaintenance.CreateDatabase();
    Console.WriteLine("✅ 数据库已就绪");

    // 第二步：设置默认配置
    db.CodeFirst.SetStringDefaultLength(200);

    // 第三步：创建/更新表
    db.CodeFirst.InitTables(
        typeof(SysUser),
        typeof(SysRole),
        typeof(SysConfig),
        typeof(SysDictItem)
    );
    Console.WriteLine("✅ 数据表已就绪");

    // 第四步：初始化种子数据
    SeedAllData(db);
    Console.WriteLine("✅ 种子数据已就绪");
}
```

---

## 10. 实战开发流程

### 10.1 新项目开发流程

一个典型的 Code First 新项目开发流程如下：

```
第1步：创建项目，安装 SqlSugarCore
        ↓
第2步：配置 ConnectionConfig
        ↓
第3步：定义基础实体类（BaseEntity）
        ↓
第4步：定义业务实体类
        ↓
第5步：编写初始化代码（CreateDatabase + InitTables）
        ↓
第6步：编写种子数据
        ↓
第7步：运行项目，验证数据库结构
        ↓
第8步：开始业务开发
        ↓
第9步：随业务需求变化，修改实体类
        ↓
第10步：重新运行 InitTables 同步表结构
```

### 10.2 完整实战示例

```csharp
// ========== 第1步：定义基类 ==========
public abstract class BaseEntity
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(IsOnlyIgnoreUpdate = true)]
    public DateTime CreateTime { get; set; } = DateTime.Now;

    [SugarColumn(IsNullable = true)]
    public DateTime? UpdateTime { get; set; }

    [SugarColumn(DefaultValue = "0")]
    public bool IsDeleted { get; set; }
}

// ========== 第2步：定义业务实体 ==========
[SugarTable("t_department", TableDescription = "部门表")]
[SugarIndex("uk_dept_code", nameof(DeptCode), OrderByType.Asc, true)]
public class Department : BaseEntity
{
    [SugarColumn(Length = 50, ColumnDescription = "部门名称")]
    public string DeptName { get; set; } = string.Empty;

    [SugarColumn(Length = 50, ColumnDescription = "部门编码")]
    public string DeptCode { get; set; } = string.Empty;

    [SugarColumn(IsNullable = true, ColumnDescription = "上级部门ID")]
    public long? ParentId { get; set; }

    [SugarColumn(DefaultValue = "0", ColumnDescription = "排序")]
    public int SortOrder { get; set; }

    [Navigate(NavigateType.OneToMany, nameof(Employee.DeptId))]
    public List<Employee>? Employees { get; set; }
}

[SugarTable("t_employee", TableDescription = "员工表")]
[SugarIndex("idx_emp_dept", nameof(DeptId), OrderByType.Asc)]
[SugarIndex("uk_emp_no", nameof(EmployeeNo), OrderByType.Asc, true)]
public class Employee : BaseEntity
{
    [SugarColumn(Length = 20, ColumnDescription = "工号")]
    public string EmployeeNo { get; set; } = string.Empty;

    [SugarColumn(Length = 50, ColumnDescription = "姓名")]
    public string Name { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "部门ID")]
    public long DeptId { get; set; }

    [SugarColumn(Length = 50, IsNullable = true, ColumnDescription = "职位")]
    public string? Position { get; set; }

    [SugarColumn(Length = 18, DecimalDigits = 2, DefaultValue = "0", ColumnDescription = "薪资")]
    public decimal Salary { get; set; }

    [SugarColumn(IsNullable = true, ColumnDescription = "入职日期")]
    public DateTime? HireDate { get; set; }

    [Navigate(NavigateType.OneToOne, nameof(DeptId))]
    public Department? Department { get; set; }
}

// ========== 第3步：初始化数据库 ==========
public static class DbInitializer
{
    public static void Initialize(ISqlSugarClient db)
    {
        // 创建数据库
        db.DbMaintenance.CreateDatabase();

        // 设置默认字符串长度
        db.CodeFirst.SetStringDefaultLength(200);

        // 创建/更新所有表
        db.CodeFirst.InitTables(
            typeof(Department),
            typeof(Employee)
        );

        // 种子数据
        if (!db.Queryable<Department>().Any())
        {
            var departments = new List<Department>
            {
                new() { DeptName = "总经办", DeptCode = "CEO", SortOrder = 1 },
                new() { DeptName = "技术部", DeptCode = "TECH", SortOrder = 2 },
                new() { DeptName = "市场部", DeptCode = "MKT", SortOrder = 3 },
                new() { DeptName = "人事部", DeptCode = "HR", SortOrder = 4 }
            };
            db.Insertable(departments).ExecuteCommand();
        }

        if (!db.Queryable<Employee>().Any())
        {
            var techDeptId = db.Queryable<Department>()
                .First(d => d.DeptCode == "TECH")!.Id;

            var employees = new List<Employee>
            {
                new() { EmployeeNo = "EMP001", Name = "张三", DeptId = techDeptId,
                    Position = "高级开发工程师", Salary = 25000, HireDate = DateTime.Parse("2020-03-15") },
                new() { EmployeeNo = "EMP002", Name = "李四", DeptId = techDeptId,
                    Position = "中级开发工程师", Salary = 18000, HireDate = DateTime.Parse("2021-07-01") }
            };
            db.Insertable(employees).ExecuteCommand();
        }

        Console.WriteLine("✅ 数据库初始化完成");
    }
}

// ========== 第4步：在 Program.cs 中调用 ==========
// var db = ...（创建 SqlSugarClient）
// DbInitializer.Initialize(db);
```

### 10.3 迭代开发中的表结构更新

```csharp
// 第一次迭代：Employee 只有基本字段
// 第二次迭代：需要新增"紧急联系人"和"工位号"字段

[SugarTable("t_employee", TableDescription = "员工表")]
public class Employee : BaseEntity
{
    // ...原有字段...

    // 第二次迭代新增的字段
    [SugarColumn(Length = 50, IsNullable = true, ColumnDescription = "紧急联系人")]
    public string? EmergencyContact { get; set; }

    [SugarColumn(Length = 20, IsNullable = true, ColumnDescription = "紧急联系人电话")]
    public string? EmergencyPhone { get; set; }

    [SugarColumn(Length = 20, IsNullable = true, ColumnDescription = "工位号")]
    public string? SeatNo { get; set; }
}

// 重新运行 InitTables，自动添加新列
db.CodeFirst.InitTables<Employee>();
```

---

## 11. 处理已有数据库

### 11.1 已有数据库使用Code First

对于已经存在的数据库，也可以使用 Code First 进行管理：

```csharp
// 第1步：使用 Db First 生成实体类
// （详见下一章 Db First 内容）

// 第2步：在生成的实体类上添加 SugarTable/SugarColumn 特性

// 第3步：使用 InitTables 管理后续的表结构变更
db.CodeFirst.InitTables<ExistingTable>();
```

### 11.2 对比实体与数据库差异

```csharp
// 获取数据库表的列信息
var dbColumns = db.DbMaintenance.GetColumnInfosByTableName("t_employee");

Console.WriteLine("数据库表列信息：");
foreach (var col in dbColumns)
{
    Console.WriteLine($"  列名: {col.DbColumnName}");
    Console.WriteLine($"  类型: {col.DataType}");
    Console.WriteLine($"  长度: {col.Length}");
    Console.WriteLine($"  可空: {col.IsNullable}");
    Console.WriteLine($"  主键: {col.IsPrimarykey}");
    Console.WriteLine($"  自增: {col.IsIdentity}");
    Console.WriteLine($"  默认值: {col.DefaultValue}");
    Console.WriteLine($"  注释: {col.ColumnDescription}");
    Console.WriteLine("  ---");
}
```

### 11.3 获取数据库所有表

```csharp
// 获取所有表名
var tables = db.DbMaintenance.GetTableInfoList();

Console.WriteLine("数据库中的所有表：");
foreach (var table in tables)
{
    Console.WriteLine($"  表名: {table.Name}, 描述: {table.Description}");
}
```

### 11.4 安全地切换到Code First

```csharp
public static void MigrateToCodeFirst(ISqlSugarClient db, Type[] entityTypes)
{
    Console.WriteLine("开始从已有数据库迁移到 Code First 模式...\n");

    foreach (var entityType in entityTypes)
    {
        var tableName = entityType.GetCustomAttribute<SugarTableAttribute>()?.TableName
            ?? entityType.Name;

        var tableExists = db.DbMaintenance.IsAnyTable(tableName);

        if (tableExists)
        {
            // 对比现有列
            var dbCols = db.DbMaintenance.GetColumnInfosByTableName(tableName);
            Console.WriteLine($"表 {tableName} 已存在，包含 {dbCols.Count} 列");

            // 备份后同步
            db.CodeFirst.BackupTable().InitTables(entityType);
            Console.WriteLine($"  ✅ 已备份并同步");
        }
        else
        {
            db.CodeFirst.InitTables(entityType);
            Console.WriteLine($"表 {tableName} 不存在，已创建");
        }
    }

    Console.WriteLine("\n迁移完成！");
}
```

---

## 12. 最佳实践

### 12.1 开发环境 vs 生产环境

| 环节 | 开发环境 | 生产环境 |
|------|---------|---------|
| 建表方式 | `InitTables` 自动建表 | 导出 SQL 脚本，DBA 审核后执行 |
| 列删除 | 允许 | 禁止自动删除 |
| 备份 | 可选 | 必须备份 |
| 种子数据 | 每次启动初始化 | 仅首次部署 |
| 数据库创建 | `CreateDatabase()` 自动创建 | 手动创建 |

### 12.2 推荐的项目初始化代码

```csharp
public static class DatabaseSetup
{
    public static void Configure(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ISqlSugarClient>();

        if (app.Environment.IsDevelopment())
        {
            // 开发环境：自动创建数据库和表
            db.DbMaintenance.CreateDatabase();
            db.CodeFirst.SetStringDefaultLength(200);
            db.CodeFirst.InitTables(GetAllEntityTypes());
            SeedData(db);
            Console.WriteLine("✅ 开发环境数据库初始化完成");
        }
        else
        {
            // 生产环境：仅验证连接
            try
            {
                db.Ado.GetDataTable("SELECT 1");
                Console.WriteLine("✅ 生产环境数据库连接成功");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 数据库连接失败: {ex.Message}");
                throw;
            }
        }
    }

    private static Type[] GetAllEntityTypes()
    {
        return Assembly.Load("MyApp.Entity")
            .GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract)
            .Where(t => t.GetCustomAttribute<SugarTableAttribute>() != null)
            .ToArray();
    }

    private static void SeedData(ISqlSugarClient db)
    {
        // 种子数据逻辑...
    }
}

// Program.cs
var app = builder.Build();
DatabaseSetup.Configure(app);
app.Run();
```

### 12.3 Code First 常见注意事项

```
✅ 推荐做法：
├── 新增列时设置 IsNullable = true 或 DefaultValue
├── 修改列类型前先备份表
├── 使用 OldColumnName 重命名列
├── 保持实体类与数据库表的一致性
├── 使用基类提取公共字段
├── 在开发环境启动时自动 InitTables
└── 使用 AOP 日志观察生成的 DDL 语句

❌ 避免的做法：
├── 在生产环境自动执行 InitTables
├── 随意删除实体属性导致数据丢失
├── 在实体类中使用不支持的 C# 类型
├── 忽略不同数据库的类型差异
├── 频繁修改主键或自增列
└── 在高峰期执行大表的结构变更
```

### 12.4 导出DDL脚本

在生产环境中，建议先导出 DDL 脚本，经审核后再手动执行：

```csharp
// 通过 AOP 捕获 Code First 生成的 SQL
db.Aop.OnLogExecuting = (sql, pars) =>
{
    // 将 DDL 语句写入文件
    if (sql.StartsWith("CREATE") || sql.StartsWith("ALTER"))
    {
        File.AppendAllText("migration.sql", sql + ";\n\n");
    }
};

// 执行 InitTables（此时会触发 AOP 记录 SQL）
db.CodeFirst.InitTables<Employee>();

// 查看 migration.sql 文件获取所有 DDL 语句
```

---

## 13. 本章小结

本章全面介绍了 SqlSugar 的 Code First 代码优先开发模式：

- **Code First 概念**：先编写实体类，ORM 自动创建和更新数据库表
- **InitTables 方法**：支持单表、多表和按程序集批量初始化
- **表的创建与更新**：自动检测差异，增量更新表结构
- **备份表**：生产环境迁移前备份，确保数据安全
- **列的增删改**：新增列、修改列类型/长度、重命名列的操作方法
- **索引管理**：通过 `[SugarIndex]` 特性或 `SugarColumn` 创建普通索引和唯一索引
- **跨数据库类型处理**：了解不同数据库的类型映射差异及兼容写法
- **种子数据**：初始化系统必要的基础数据
- **最佳实践**：开发环境与生产环境的差异化策略，安全迁移的完整流程

掌握 Code First 开发模式后，你可以更高效地管理数据库结构的演进，将注意力集中在业务代码上，让 SqlSugar 帮你处理繁琐的数据库 DDL 操作。

---

> **下一章预告**：下一章将介绍 SqlSugar 的查询操作，包括基础查询、条件查询、联表查询、分组聚合、分页、子查询等丰富的查询功能。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第03章-实体类定义与特性配置" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第05章-DbFirst数据库优先开发" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
