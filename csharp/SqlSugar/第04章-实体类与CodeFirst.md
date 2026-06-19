---
layout: default
title: 第四章：实体类与CodeFirst
---

# 第四章：实体类与CodeFirst

## 目录

- [4.1 实体类定义](#41-实体类定义)
  - [4.1.1 基础实体类](#411-基础实体类)
  - [4.1.2 实体类约定](#412-实体类约定)
- [4.2 SqlSugar特性标注](#42-sqlsugar特性标注)
  - [4.2.1 表特性](#421-表特性)
  - [4.2.2 列特性](#422-列特性)
  - [4.2.3 主键特性](#423-主键特性)
- [4.3 数据类型映射](#43-数据类型映射)
  - [4.3.1 C#与数据库类型对应](#431-c与数据库类型对应)
  - [4.3.2 自定义类型转换](#432-自定义类型转换)
- [4.4 主键配置](#44-主键配置)
  - [4.4.1 单一主键](#441-单一主键)
  - [4.4.2 复合主键](#442-复合主键)
  - [4.4.3 自增主键](#443-自增主键)
- [4.5 索引配置](#45-索引配置)
  - [4.5.1 普通索引](#451-普通索引)
  - [4.5.2 唯一索引](#452-唯一索引)
  - [4.5.3 复合索引](#453-复合索引)
- [4.6 实体关系](#46-实体关系)
  - [4.6.1 一对一关系](#461-一对一关系)
  - [4.6.2 一对多关系](#462-一对多关系)
  - [4.6.3 多对多关系](#463-多对多关系)
- [4.7 CodeFirst表创建](#47-codefirst表创建)
  - [4.7.1 创建单表](#471-创建单表)
  - [4.7.2 批量创建表](#472-批量创建表)
  - [4.7.3 表存在性检查](#473-表存在性检查)
- [4.8 数据库迁移](#48-数据库迁移)
  - [4.8.1 表结构同步](#481-表结构同步)
  - [4.8.2 备份与迁移](#482-备份与迁移)
- [4.9 最佳实践](#49-最佳实践)
- [本章小结](#本章小结)

## 4.1 实体类定义

### 4.1.1 基础实体类

实体类是数据库表的C#对象表示,每个实体类对应一张数据库表:

```csharp
// 基础实体类
public class User
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    public int Age { get; set; }
    public DateTime CreateTime { get; set; }
}

// 使用实体类
var db = new SqlSugarClient(config);
var users = db.Queryable<User>().ToList();
```

### 4.1.2 实体类约定

SqlSugar遵循以下约定:

```csharp
// 约定1: 类名对应表名
public class Student { } // 对应表名 Student

// 约定2: 属性名对应列名
public class Product
{
    public int ProductId { get; set; }    // 对应列名 ProductId
    public string ProductName { get; set; } // 对应列名 ProductName
}

// 约定3: 名为Id或{类名}Id的属性自动识别为主键
public class Order
{
    public int Id { get; set; }  // 自动识别为主键
    public string OrderNo { get; set; }
}

public class Customer
{
    public int CustomerId { get; set; }  // 自动识别为主键
    public string CustomerName { get; set; }
}
```

## 4.2 SqlSugar特性标注

### 4.2.1 表特性

使用SugarTable特性自定义表配置:

```csharp
// 指定表名
[SugarTable("sys_user")]
public class User
{
    public int Id { get; set; }
    public string Name { get; set; }
}

// 指定表名和描述
[SugarTable("sys_user", "系统用户表")]
public class User
{
    public int Id { get; set; }
    public string Name { get; set; }
}

// 分表配置
[SplitTable(SplitType.Year)]  // 按年分表
[SugarTable("order_{year}")]
public class Order
{
    public int Id { get; set; }
    public string OrderNo { get; set; }
    [SplitField]  // 分表字段
    public DateTime CreateTime { get; set; }
}
```

### 4.2.2 列特性

使用SugarColumn特性配置列:

```csharp
public class User
{
    // 主键,自增
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    // 指定列名和描述
    [SugarColumn(ColumnName = "user_name", ColumnDescription = "用户名")]
    public string Name { get; set; }

    // 指定数据类型和长度
    [SugarColumn(ColumnDataType = "varchar", Length = 50)]
    public string Email { get; set; }

    // 设置默认值
    [SugarColumn(DefaultValue = "0")]
    public int Status { get; set; }

    // 可空列
    [SugarColumn(IsNullable = true)]
    public string Remark { get; set; }

    // 不映射到数据库
    [SugarColumn(IsIgnore = true)]
    public string TempData { get; set; }

    // 创建时间,插入时自动填充
    [SugarColumn(InsertServerTime = true)]
    public DateTime CreateTime { get; set; }

    // 更新时间,更新时自动填充
    [SugarColumn(UpdateServerTime = true)]
    public DateTime UpdateTime { get; set; }

    // 不可更新字段
    [SugarColumn(IsOnlyIgnoreUpdate = true)]
    public DateTime CreateTime2 { get; set; }

    // 不可插入字段
    [SugarColumn(IsOnlyIgnoreInsert = true)]
    public DateTime UpdateTime2 { get; set; }

    // 唯一约束
    [SugarColumn(IsUnique = true)]
    public string Email2 { get; set; }

    // 索引列
    [SugarColumn(IsIndex = true)]
    public string Phone { get; set; }
}
```

### 4.2.3 主键特性

配置主键的多种方式:

```csharp
// 方式1: 使用IsPrimaryKey
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
}

// 方式2: 使用Guid主键
public class Product
{
    [SugarColumn(IsPrimaryKey = true)]
    public Guid Id { get; set; } = Guid.NewGuid();
}

// 方式3: 使用雪花ID
public class Order
{
    [SugarColumn(IsPrimaryKey = true)]
    public long Id { get; set; }
}

// 方式4: 复合主键
public class UserRole
{
    [SugarColumn(IsPrimaryKey = true)]
    public int UserId { get; set; }
    
    [SugarColumn(IsPrimaryKey = true)]
    public int RoleId { get; set; }
}
```

## 4.3 数据类型映射

### 4.3.1 C#与数据库类型对应

```csharp
public class DataTypeMapping
{
    // 整数类型
    public int IntValue { get; set; }           // int, INTEGER
    public long LongValue { get; set; }         // bigint, BIGINT
    public short ShortValue { get; set; }       // smallint, SMALLINT
    public byte ByteValue { get; set; }         // tinyint, TINYINT

    // 小数类型
    public decimal DecimalValue { get; set; }   // decimal, DECIMAL
    public double DoubleValue { get; set; }     // float, DOUBLE
    public float FloatValue { get; set; }       // real, FLOAT

    // 字符串类型
    public string StringValue { get; set; }     // nvarchar, VARCHAR
    
    [SugarColumn(ColumnDataType = "char", Length = 10)]
    public string CharValue { get; set; }       // char, CHAR

    [SugarColumn(ColumnDataType = "text")]
    public string TextValue { get; set; }       // text, TEXT

    // 日期时间类型
    public DateTime DateTimeValue { get; set; } // datetime, DATETIME
    public DateTimeOffset DateTimeOffsetValue { get; set; } // datetimeoffset

    // 布尔类型
    public bool BoolValue { get; set; }         // bit, BOOLEAN

    // 二进制类型
    public byte[] BinaryValue { get; set; }     // varbinary, BLOB

    // Guid类型
    public Guid GuidValue { get; set; }         // uniqueidentifier, VARCHAR(36)

    // 可空类型
    public int? NullableIntValue { get; set; }
    public DateTime? NullableDateTimeValue { get; set; }
}
```

### 4.3.2 自定义类型转换

```csharp
// 枚举类型映射
public enum UserStatus
{
    Normal = 0,
    Locked = 1,
    Deleted = 2
}

public class User
{
    public int Id { get; set; }
    public string Name { get; set; }
    
    // 枚举保存为整数
    public UserStatus Status { get; set; }
    
    // 枚举保存为字符串
    [SugarColumn(ColumnDataType = "varchar", Length = 20)]
    public UserStatus Status2 { get; set; }
}

// JSON类型映射
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; }
    
    // 复杂对象保存为JSON字符串
    [SugarColumn(IsJson = true)]
    public ProductDetail Detail { get; set; }
}

public class ProductDetail
{
    public string Brand { get; set; }
    public string Model { get; set; }
    public List<string> Tags { get; set; }
}

// 自定义序列化
public class CustomSerialize
{
    public void Configure(SqlSugarClient db)
    {
        db.CurrentConnectionConfig.ConfigureExternalServices = new ConfigureExternalServices()
        {
            SerializeService = new CustomSerializeService()
        };
    }
}

public class CustomSerializeService : ISerializeService
{
    public string SerializeObject(object value)
    {
        return Newtonsoft.Json.JsonConvert.SerializeObject(value);
    }

    public T DeserializeObject<T>(string value)
    {
        return Newtonsoft.Json.JsonConvert.DeserializeObject<T>(value);
    }
}
```

## 4.4 主键配置

### 4.4.1 单一主键

```csharp
// 自增主键
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
}

// 手动赋值主键
public class Product
{
    [SugarColumn(IsPrimaryKey = true)]
    public string ProductCode { get; set; }
}

// Guid主键
public class Order
{
    [SugarColumn(IsPrimaryKey = true)]
    public Guid Id { get; set; } = Guid.NewGuid();
}
```

### 4.4.2 复合主键

```csharp
// 用户角色关联表
[SugarTable("user_role")]
public class UserRole
{
    [SugarColumn(IsPrimaryKey = true)]
    public int UserId { get; set; }
    
    [SugarColumn(IsPrimaryKey = true)]
    public int RoleId { get; set; }
    
    public DateTime CreateTime { get; set; }
}

// 插入数据
var userRole = new UserRole
{
    UserId = 1,
    RoleId = 2,
    CreateTime = DateTime.Now
};
db.Insertable(userRole).ExecuteCommand();
```

### 4.4.3 自增主键

```csharp
public class AutoIncrementExample
{
    public void InsertWithIdentity()
    {
        var db = new SqlSugarClient(config);
        
        var user = new User
        {
            Name = "张三",
            Email = "zhangsan@test.com"
        };
        
        // 插入并返回自增ID
        var id = db.Insertable(user).ExecuteReturnIdentity();
        Console.WriteLine($"新用户ID: {id}");
        
        // 插入后实体的Id属性也会被赋值
        Console.WriteLine($"实体ID: {user.Id}");
    }
}
```

## 4.5 索引配置

### 4.5.1 普通索引

```csharp
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    
    // 普通索引
    [SugarColumn(IsIndex = true)]
    public string Email { get; set; }
    
    [SugarColumn(IsIndex = true)]
    public string Phone { get; set; }
}
```

### 4.5.2 唯一索引

```csharp
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    
    // 唯一索引
    [SugarColumn(IsUnique = true)]
    public string Username { get; set; }
    
    [SugarColumn(IsUnique = true)]
    public string Email { get; set; }
}
```

### 4.5.3 复合索引

```csharp
// 使用IndexAttribute创建复合索引
[SugarTable("order_detail")]
[SugarIndex("idx_order_product", nameof(OrderId), nameof(ProductId), OrderByType.Asc)]
public class OrderDetail
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}

// 多个复合索引
[SugarTable("log")]
[SugarIndex("idx_user_time", nameof(UserId), nameof(CreateTime), OrderByType.Desc)]
[SugarIndex("idx_type_time", nameof(LogType), nameof(CreateTime), OrderByType.Desc)]
public class Log
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    
    public int UserId { get; set; }
    public string LogType { get; set; }
    public string Content { get; set; }
    public DateTime CreateTime { get; set; }
}
```

## 4.6 实体关系

### 4.6.1 一对一关系

```csharp
// 用户表
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    
    // 导航属性
    [Navigate(NavigateType.OneToOne, nameof(UserId))]
    public UserProfile Profile { get; set; }
}

// 用户资料表
public class UserProfile
{
    [SugarColumn(IsPrimaryKey = true)]
    public int UserId { get; set; }
    public string Avatar { get; set; }
    public string Bio { get; set; }
}
```

### 4.6.2 一对多关系

```csharp
// 部门表
public class Department
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    
    // 导航属性: 一个部门有多个员工
    [Navigate(NavigateType.OneToMany, nameof(Employee.DepartmentId))]
    public List<Employee> Employees { get; set; }
}

// 员工表
public class Employee
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    public int DepartmentId { get; set; }
    
    // 导航属性: 多个员工属于一个部门
    [Navigate(NavigateType.ManyToOne, nameof(DepartmentId))]
    public Department Department { get; set; }
}
```

### 4.6.3 多对多关系

```csharp
// 学生表
public class Student
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    
    // 导航属性: 多对多关系
    [Navigate(typeof(StudentCourse), nameof(StudentCourse.StudentId), nameof(StudentCourse.CourseId))]
    public List<Course> Courses { get; set; }
}

// 课程表
public class Course
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    
    // 导航属性: 多对多关系
    [Navigate(typeof(StudentCourse), nameof(StudentCourse.CourseId), nameof(StudentCourse.StudentId))]
    public List<Student> Students { get; set; }
}

// 中间表
public class StudentCourse
{
    [SugarColumn(IsPrimaryKey = true)]
    public int StudentId { get; set; }
    
    [SugarColumn(IsPrimaryKey = true)]
    public int CourseId { get; set; }
    
    public DateTime EnrollDate { get; set; }
    public decimal? Score { get; set; }
}
```

## 4.7 CodeFirst表创建

### 4.7.1 创建单表

```csharp
public class CreateTableExample
{
    public void CreateSingleTable()
    {
        var db = new SqlSugarClient(config);
        
        // 根据实体类创建表
        db.CodeFirst.InitTables<User>();
        
        Console.WriteLine("用户表创建成功");
    }
    
    public void CreateTableWithBackup()
    {
        var db = new SqlSugarClient(config);
        
        // 创建表前备份
        db.CodeFirst.BackupTable().InitTables<User>();
    }
}
```

### 4.7.2 批量创建表

```csharp
public class BatchCreateTables
{
    public void CreateMultipleTables()
    {
        var db = new SqlSugarClient(config);
        
        // 方式1: 指定多个类型
        db.CodeFirst.InitTables(
            typeof(User),
            typeof(Department),
            typeof(Employee),
            typeof(Product),
            typeof(Order)
        );
        
        // 方式2: 通过反射获取所有实体类
        var types = Assembly.GetExecutingAssembly()
            .GetTypes()
            .Where(t => t.Namespace == "YourNamespace.Entities")
            .ToArray();
        
        db.CodeFirst.InitTables(types);
        
        Console.WriteLine($"成功创建{types.Length}张表");
    }
    
    public void CreateTablesWithOptions()
    {
        var db = new SqlSugarClient(config);
        
        // 设置表创建选项
        db.CodeFirst.SetStringDefaultLength(200); // 字符串默认长度
        
        // 只创建不存在的表
        db.CodeFirst.InitTables(typeof(User), typeof(Product));
    }
}
```

### 4.7.3 表存在性检查

```csharp
public class TableExistenceCheck
{
    public void CheckAndCreateTable()
    {
        var db = new SqlSugarClient(config);
        
        // 检查表是否存在
        if (!db.DbMaintenance.IsAnyTable("User", false))
        {
            db.CodeFirst.InitTables<User>();
            Console.WriteLine("创建User表");
        }
        else
        {
            Console.WriteLine("User表已存在");
        }
    }
    
    public void GetTableList()
    {
        var db = new SqlSugarClient(config);
        
        // 获取所有表名
        var tables = db.DbMaintenance.GetTableInfoList(false);
        
        foreach (var table in tables)
        {
            Console.WriteLine($"表名: {table.Name}, 描述: {table.Description}");
        }
    }
}
```

## 4.8 数据库迁移

### 4.8.1 表结构同步

```csharp
public class DatabaseMigration
{
    public void SyncTableStructure()
    {
        var db = new SqlSugarClient(config);
        
        // 对比表结构差异
        var diffString = db.CodeFirst.GetDifferenceTables<User>().ToDiffString();
        Console.WriteLine(diffString);
        
        // 同步表结构(添加新列、修改列类型等)
        db.CodeFirst.SetStringDefaultLength(200)
            .InitTables<User>();
    }
    
    public void AddColumn()
    {
        var db = new SqlSugarClient(config);
        
        // 添加列
        if (!db.DbMaintenance.IsAnyColumn("User", "Age"))
        {
            db.DbMaintenance.AddColumn("User", new DbColumnInfo
            {
                ColumnName = "Age",
                DataType = "int",
                IsNullable = false,
                DefaultValue = "0"
            });
        }
    }
    
    public void UpdateColumn()
    {
        var db = new SqlSugarClient(config);
        
        // 修改列
        db.DbMaintenance.UpdateColumn("User", new DbColumnInfo
        {
            ColumnName = "Name",
            DataType = "varchar(100)",
            IsNullable = false
        });
    }
    
    public void DropColumn()
    {
        var db = new SqlSugarClient(config);
        
        // 删除列
        if (db.DbMaintenance.IsAnyColumn("User", "TempColumn"))
        {
            db.DbMaintenance.DropColumn("User", "TempColumn");
        }
    }
}
```

### 4.8.2 备份与迁移

```csharp
public class BackupAndMigration
{
    public void BackupTable()
    {
        var db = new SqlSugarClient(config);
        
        // 备份表
        var backupTableName = $"User_Backup_{DateTime.Now:yyyyMMddHHmmss}";
        db.DbMaintenance.BackupTable("User", backupTableName);
        
        Console.WriteLine($"表已备份到: {backupTableName}");
    }
    
    public void ExportTableStructure()
    {
        var db = new SqlSugarClient(config);
        
        // 获取建表SQL
        var createTableSql = db.DbMaintenance.CreateTableScript<User>();
        Console.WriteLine(createTableSql);
        
        // 保存到文件
        File.WriteAllText("User_CreateTable.sql", createTableSql);
    }
    
    public void MigrateData()
    {
        var sourceDb = new SqlSugarClient(sourceConfig);
        var targetDb = new SqlSugarClient(targetConfig);
        
        // 创建目标表
        targetDb.CodeFirst.InitTables<User>();
        
        // 迁移数据
        var users = sourceDb.Queryable<User>().ToList();
        targetDb.Insertable(users).ExecuteCommand();
        
        Console.WriteLine($"成功迁移{users.Count}条数据");
    }
}
```

## 4.9 最佳实践

```csharp
// 1. 使用基类实体
public abstract class BaseEntity
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    
    [SugarColumn(InsertServerTime = true, IsOnlyIgnoreUpdate = true)]
    public DateTime CreateTime { get; set; }
    
    [SugarColumn(UpdateServerTime = true)]
    public DateTime UpdateTime { get; set; }
    
    [SugarColumn(IsNullable = true)]
    public int? CreateUserId { get; set; }
    
    [SugarColumn(IsNullable = true)]
    public int? UpdateUserId { get; set; }
    
    [SugarColumn(DefaultValue = "0")]
    public bool IsDeleted { get; set; }
}

public class User : BaseEntity
{
    public string Name { get; set; }
    public string Email { get; set; }
}

// 2. 实体类分层
namespace YourProject.Entities
{
    // 系统模块
    namespace System
    {
        public class User : BaseEntity { }
        public class Role : BaseEntity { }
        public class Permission : BaseEntity { }
    }
    
    // 业务模块
    namespace Business
    {
        public class Order : BaseEntity { }
        public class Product : BaseEntity { }
    }
}

// 3. 使用数据注解验证
using System.ComponentModel.DataAnnotations;

public class User : BaseEntity
{
    [Required(ErrorMessage = "用户名不能为空")]
    [StringLength(50, ErrorMessage = "用户名长度不能超过50")]
    public string Name { get; set; }
    
    [Required(ErrorMessage = "邮箱不能为空")]
    [EmailAddress(ErrorMessage = "邮箱格式不正确")]
    public string Email { get; set; }
    
    [Range(1, 150, ErrorMessage = "年龄必须在1-150之间")]
    public int Age { get; set; }
}

// 4. 实体类文档注释
/// <summary>
/// 用户实体类
/// </summary>
[SugarTable("sys_user", "系统用户表")]
public class User : BaseEntity
{
    /// <summary>
    /// 用户名
    /// </summary>
    [SugarColumn(ColumnDescription = "用户名")]
    public string Name { get; set; }
    
    /// <summary>
    /// 邮箱
    /// </summary>
    [SugarColumn(ColumnDescription = "邮箱")]
    public string Email { get; set; }
}

// 5. 版本化迁移
public class MigrationVersion
{
    private readonly SqlSugarClient _db;
    
    public MigrationVersion(SqlSugarClient db)
    {
        _db = db;
    }
    
    public void ApplyMigrations()
    {
        var currentVersion = GetCurrentVersion();
        
        if (currentVersion < 1)
        {
            Migration_V1();
        }
        
        if (currentVersion < 2)
        {
            Migration_V2();
        }
    }
    
    private int GetCurrentVersion()
    {
        // 从版本表获取当前版本
        return 0;
    }
    
    private void Migration_V1()
    {
        // 初始化表
        _db.CodeFirst.InitTables<User>();
        _db.CodeFirst.InitTables<Role>();
    }
    
    private void Migration_V2()
    {
        // 添加新字段
        _db.DbMaintenance.AddColumn("User", new DbColumnInfo
        {
            ColumnName = "Phone",
            DataType = "varchar(20)"
        });
    }
}
```

### 常见陷阱

1. **忘记配置主键**: 导致无法正确执行更新和删除操作
2. **字段名与数据库关键字冲突**: 使用IsIgnore或ColumnName避免
3. **导航属性未正确配置**: 导致无法正确加载关联数据
4. **CodeFirst与现有数据库冲突**: 使用BackupTable进行备份
5. **枚举类型未指定保存方式**: 可能导致数据不一致

## 本章小结

本章详细介绍了SqlSugar的实体类与CodeFirst功能:

1. **实体类定义**: 掌握了实体类的基本定义和约定
2. **特性标注**: 学习了各种SqlSugar特性的使用方法
3. **数据类型映射**: 了解了C#类型与数据库类型的对应关系
4. **主键和索引**: 掌握了主键和索引的配置方法
5. **实体关系**: 学习了一对一、一对多、多对多关系的配置
6. **CodeFirst**: 掌握了使用代码创建数据库表的方法
7. **数据库迁移**: 学习了表结构同步和数据迁移的技巧
8. **最佳实践**: 总结了实体类设计的最佳实践

通过本章的学习,你应该能够熟练设计实体类并使用CodeFirst功能管理数据库结构。

**下一章**: [第05章-基础CRUD操作](第05章-基础CRUD操作.md)
