---
layout: default
title: 第四章：实体类与ORM映射
---

# 第四章：实体类与ORM映射

## 4.1 实体类基础

### 4.1.1 EntityBase类详解

EntityBase是SOD框架中所有实体类的基类，它提供了动态属性管理、元数据映射和状态追踪等核心功能。

```csharp
public abstract class EntityBase
{
    // ===== 核心元数据属性 =====
    
    /// <summary>
    /// 映射的数据表名称
    /// </summary>
    public string TableName { get; set; }
    
    /// <summary>
    /// 自增/标识字段名称
    /// </summary>
    public string IdentityName { get; set; }
    
    /// <summary>
    /// 主键字段集合（支持联合主键）
    /// </summary>
    public List<string> PrimaryKeys { get; }
    
    /// <summary>
    /// 所有属性名称集合
    /// </summary>
    public string[] PropertyNames { get; }
    
    /// <summary>
    /// 所有属性值集合
    /// </summary>
    public object[] PropertyValues { get; }
    
    // ===== 核心方法 =====
    
    /// <summary>
    /// 获取属性值
    /// </summary>
    protected T getProperty<T>(string propertyName);
    
    /// <summary>
    /// 设置属性值
    /// </summary>
    protected void setProperty(string propertyName, object value, int length = 0);
    
    /// <summary>
    /// 索引器访问
    /// </summary>
    public object this[string propertyName] { get; set; }
    
    /// <summary>
    /// 设置外键关系
    /// </summary>
    protected void SetForeignKey<TParent>(string foreignKeyPropertyName);
    
    /// <summary>
    /// 获取表名（运行时）
    /// </summary>
    public string GetTableName();
    
    /// <summary>
    /// 判断属性是否被修改
    /// </summary>
    public bool PropertyChangedList(string propertyName);
    
    /// <summary>
    /// 重置属性修改状态
    /// </summary>
    public void ResetChanges();
}
```

### 4.1.2 实体类的生命周期

```
创建实体对象 → 设置属性值 → 状态追踪 → 持久化操作 → 状态重置
     │              │            │            │           │
     ↓              ↓            ↓            ↓           ↓
 构造函数     setProperty    记录变更   生成SQL      ResetChanges
 初始化元数据   触发状态变更   字段列表   执行操作     清除变更状态
```

### 4.1.3 属性值存储机制

SOD实体类的属性值存储在内部的PropertyList集合中，而不是传统的私有字段：

```csharp
// 传统实体类
public class TraditionalUser
{
    private string _name;  // 私有字段存储值
    
    public string Name
    {
        get { return _name; }
        set { _name = value; }
    }
}

// SOD实体类
public class SODUser : EntityBase
{
    public string Name
    {
        // 值存储在EntityBase内部的PropertyList中
        get { return getProperty<string>("Name"); }
        set { setProperty("Name", value, 50); }
    }
}
```

这种设计的优势：
- 自动追踪属性变化
- 支持动态属性名映射
- 便于序列化和反序列化
- 支持索引器访问

## 4.2 元数据映射详解

### 4.2.1 表名映射

```csharp
public class UserEntity : EntityBase
{
    public UserEntity()
    {
        // 基本映射
        TableName = "TbUser";
        
        // 带Schema的表名
        // TableName = "dbo.TbUser";
        
        // 动态表名（分表场景）
        // TableName = GetDynamicTableName();
    }
    
    private string GetDynamicTableName()
    {
        // 根据当前月份分表
        return $"TbUser_{DateTime.Now:yyyyMM}";
    }
}
```

### 4.2.2 主键映射

```csharp
public class OrderEntity : EntityBase
{
    public OrderEntity()
    {
        TableName = "TbOrder";
        
        // 单一主键
        PrimaryKeys.Add("OrderId");
        
        // 联合主键
        // PrimaryKeys.Add("OrderId");
        // PrimaryKeys.Add("ProductId");
    }
}
```

### 4.2.3 标识字段（自增）映射

```csharp
public class UserEntity : EntityBase
{
    public UserEntity()
    {
        TableName = "TbUser";
        
        // 设置自增字段
        IdentityName = "ID";
        PrimaryKeys.Add("ID");
    }
    
    public int ID
    {
        get { return getProperty<int>("ID"); }
        set { setProperty("ID", value); }
    }
}

// 使用时，插入后自动回填ID
var user = new UserEntity { Name = "张三" };
EntityQuery<UserEntity>.Instance.Insert(user, db);
Console.WriteLine($"新用户ID: {user.ID}");  // 自动获得自增值
```

### 4.2.4 字段名映射

```csharp
public class UserEntity : EntityBase
{
    public UserEntity()
    {
        TableName = "TbUser";
    }
    
    // 属性名与字段名相同
    public string Name
    {
        get { return getProperty<string>("Name"); }
        set { setProperty("Name", value, 50); }
    }
    
    // 属性名与字段名不同
    public string DisplayName
    {
        get { return getProperty<string>("UserDisplayName"); }  // 映射到UserDisplayName字段
        set { setProperty("UserDisplayName", value, 100); }
    }
}
```

### 4.2.5 字段长度映射

```csharp
public class UserEntity : EntityBase
{
    // 指定字段长度，用于Code First建表
    public string Name
    {
        get { return getProperty<string>("Name"); }
        set { setProperty("Name", value, 50); }  // 长度50
    }
    
    public string Remark
    {
        get { return getProperty<string>("Remark"); }
        set { setProperty("Remark", value, 500); }  // 长度500
    }
    
    // 不指定长度，使用默认值
    public string Description
    {
        get { return getProperty<string>("Description"); }
        set { setProperty("Description", value); }  // 默认长度
    }
}
```

### 4.2.6 外键映射

```csharp
// 主表
public class OrderEntity : EntityBase
{
    public OrderEntity()
    {
        TableName = "TbOrder";
        IdentityName = "OrderId";
        PrimaryKeys.Add("OrderId");
    }
    
    public long OrderId { get { ... } set { ... } }
    public string OrderNo { get { ... } set { ... } }
    
    // 子实体列表
    public List<OrderItemEntity> Items { get; set; }
}

// 子表
public class OrderItemEntity : EntityBase
{
    public OrderItemEntity()
    {
        TableName = "TbOrderItem";
        IdentityName = "ItemId";
        PrimaryKeys.Add("ItemId");
        
        // 设置外键关系
        SetForeignKey<OrderEntity>("OrderId");
    }
    
    public long ItemId { get { ... } set { ... } }
    public long OrderId { get { ... } set { ... } }  // 外键字段
    public string ProductName { get { ... } set { ... } }
}
```

## 4.3 数据类型映射

### 4.3.1 基本类型映射

| C#类型 | SQL Server | MySQL | Oracle | 说明 |
|--------|-----------|-------|--------|------|
| int | int | int | NUMBER(10) | 整数 |
| long | bigint | bigint | NUMBER(19) | 长整数 |
| float | real | float | FLOAT | 单精度浮点 |
| double | float | double | FLOAT | 双精度浮点 |
| decimal | decimal | decimal | NUMBER | 精确数值 |
| string | nvarchar | varchar | VARCHAR2 | 字符串 |
| bool | bit | tinyint(1) | NUMBER(1) | 布尔值 |
| DateTime | datetime | datetime | DATE | 日期时间 |
| Guid | uniqueidentifier | char(36) | RAW(16) | GUID |
| byte[] | varbinary | blob | BLOB | 二进制 |

### 4.3.2 可空类型处理

```csharp
public class UserEntity : EntityBase
{
    // 可空整数
    public int? Age
    {
        get { return getProperty<int?>("Age"); }
        set { setProperty("Age", value); }
    }
    
    // 可空日期
    public DateTime? Birthday
    {
        get { return getProperty<DateTime?>("Birthday"); }
        set { setProperty("Birthday", value); }
    }
    
    // 可空布尔
    public bool? IsVip
    {
        get { return getProperty<bool?>("IsVip"); }
        set { setProperty("IsVip", value); }
    }
}

// 使用时
var user = new UserEntity();
user.Age = null;  // 允许设置null
user.Birthday = null;
```

### 4.3.3 枚举类型处理

```csharp
// 定义枚举
public enum UserStatus
{
    Inactive = 0,
    Active = 1,
    Locked = 2
}

public class UserEntity : EntityBase
{
    // 方式1：存储为整数
    public int StatusValue
    {
        get { return getProperty<int>("Status"); }
        set { setProperty("Status", value); }
    }
    
    // 包装为枚举（不参与映射）
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public UserStatus Status
    {
        get { return (UserStatus)StatusValue; }
        set { StatusValue = (int)value; }
    }
    
    // 方式2：直接使用枚举
    public UserStatus StatusEnum
    {
        get { return getProperty<UserStatus>("Status"); }
        set { setProperty("Status", (int)value); }
    }
}
```

## 4.4 高级映射技术

### 4.4.1 动态表名（分表）

```csharp
public class UserLogEntity : EntityBase
{
    private string _tableMonth;
    
    public UserLogEntity() : this(DateTime.Now) { }
    
    public UserLogEntity(DateTime logDate)
    {
        _tableMonth = logDate.ToString("yyyyMM");
        TableName = $"TbUserLog_{_tableMonth}";
        IdentityName = "LogId";
        PrimaryKeys.Add("LogId");
    }
    
    public long LogId { get { ... } set { ... } }
    public int UserId { get { ... } set { ... } }
    public string Action { get { ... } set { ... } }
    public DateTime LogTime { get { ... } set { ... } }
}

// 使用
// 查询2024年1月的日志
var janLog = new UserLogEntity(new DateTime(2024, 1, 15));
var oql = OQL.From(janLog).Select().END;
var logs = EntityQuery<UserLogEntity>.QueryList(oql);
// 实际查询: SELECT * FROM TbUserLog_202401

// 查询2024年2月的日志
var febLog = new UserLogEntity(new DateTime(2024, 2, 15));
var oql2 = OQL.From(febLog).Select().END;
// 实际查询: SELECT * FROM TbUserLog_202402
```

### 4.4.2 动态主键

```csharp
public class UserEntity : EntityBase
{
    public UserEntity()
    {
        TableName = "TbUser";
        IdentityName = "ID";
        PrimaryKeys.Add("ID");  // 默认主键
    }
    
    public int ID { get { ... } set { ... } }
    public string LoginName { get { ... } set { ... } }
    public string Email { get { ... } set { ... } }
}

// 使用场景：根据登录名删除用户
var user = new UserEntity();
user.PrimaryKeys.Clear();
user.PrimaryKeys.Add("LoginName");  // 临时更换主键
user.LoginName = "zhangsan";

EntityQuery<UserEntity>.Instance.Delete(user, db);
// 生成: DELETE FROM TbUser WHERE LoginName = @LoginName
```

### 4.4.3 虚拟映射（不存在的字段）

```csharp
public class UserEntity : EntityBase
{
    public UserEntity()
    {
        TableName = "TbUser";
        IdentityName = "ID";
        PrimaryKeys.Add("ID");
    }
    
    public int ID { get { ... } set { ... } }
    public string FirstName { get { ... } set { ... } }
    public string LastName { get { ... } set { ... } }
    
    // 虚拟属性：不映射到数据库字段
    // 通过在属性上不使用getProperty/setProperty实现
    public string FullName
    {
        get { return $"{FirstName} {LastName}"; }
    }
    
    // 或者使用普通属性（不参与数据库操作）
    private int _tempData;
    public int TempData
    {
        get { return _tempData; }
        set { _tempData = value; }
    }
}
```

### 4.4.4 计算字段

```csharp
public class OrderEntity : EntityBase
{
    public decimal UnitPrice { get { ... } set { ... } }
    public int Quantity { get { ... } set { ... } }
    public decimal Discount { get { ... } set { ... } }
    
    // 计算字段：总价
    public decimal TotalPrice
    {
        get { return UnitPrice * Quantity * (1 - Discount); }
    }
}
```

## 4.5 实体类工厂

### 4.5.1 EntityBuilder动态创建

使用接口动态创建实体类，无需定义完整的实体类：

```csharp
// 定义接口
public interface IUser
{
    int ID { get; set; }
    string Name { get; set; }
    string Email { get; set; }
}

// 动态创建实体对象
IUser user = EntityBuilder.CreateEntity<IUser>();
user.Name = "张三";
user.Email = "zhangsan@example.com";

// 查询
var oql = OQL.FromObject<IUser>()
    .Select()
    .Where((cmp, u) => cmp.Property(u.Name) == "张三")
    .END;

var users = oql.ToList();
```

### 4.5.2 接口命名约定

```csharp
// 接口类型 IXxx 默认映射到表 Xxx（去掉前缀I）
public interface IUser { }       // → 表名: User
public interface ITbUser { }     // → 表名: TbUser
public interface IDbUser { }     // → 表名: DbUser

// 可以通过GOQL指定表名
var oql = OQL.FromObject<IUser>("CustomTableName")
    .Select()
    .END;
```

### 4.5.3 动态实体与静态实体的选择

| 特性 | 动态实体（接口） | 静态实体（类） |
|------|---------------|---------------|
| 定义方式 | 接口 | 继承EntityBase的类 |
| 元数据配置 | 使用约定 | 在构造函数中配置 |
| 自增字段 | 不支持 | 支持 |
| 外键关系 | 不支持 | 支持 |
| 自定义方法 | 不支持 | 支持 |
| 适用场景 | 简单查询 | 完整CRUD |

## 4.6 实体类设计最佳实践

### 4.6.1 规范的实体类定义

```csharp
using PWMIS.DataMap.Entity;
using System;

namespace MyProject.Entities
{
    /// <summary>
    /// 用户实体类
    /// 映射表：TbUser
    /// </summary>
    public class UserEntity : EntityBase
    {
        #region 构造函数
        
        public UserEntity()
        {
            TableName = "TbUser";
            IdentityName = "ID";
            PrimaryKeys.Add("ID");
        }
        
        #endregion

        #region 主键/标识字段
        
        /// <summary>
        /// 用户ID（主键，自增）
        /// </summary>
        public int ID
        {
            get { return getProperty<int>(nameof(ID)); }
            set { setProperty(nameof(ID), value); }
        }
        
        #endregion

        #region 业务字段
        
        /// <summary>
        /// 用户名
        /// </summary>
        public string Name
        {
            get { return getProperty<string>(nameof(Name)); }
            set { setProperty(nameof(Name), value, 50); }
        }

        /// <summary>
        /// 邮箱
        /// </summary>
        public string Email
        {
            get { return getProperty<string>(nameof(Email)); }
            set { setProperty(nameof(Email), value, 100); }
        }

        /// <summary>
        /// 状态：0-禁用，1-启用
        /// </summary>
        public int Status
        {
            get { return getProperty<int>(nameof(Status)); }
            set { setProperty(nameof(Status), value); }
        }

        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreateTime
        {
            get { return getProperty<DateTime>(nameof(CreateTime)); }
            set { setProperty(nameof(CreateTime), value); }
        }

        /// <summary>
        /// 最后登录时间（可空）
        /// </summary>
        public DateTime? LastLoginTime
        {
            get { return getProperty<DateTime?>(nameof(LastLoginTime)); }
            set { setProperty(nameof(LastLoginTime), value); }
        }
        
        #endregion

        #region 关联实体
        
        /// <summary>
        /// 用户角色列表
        /// </summary>
        public List<UserRoleEntity> Roles { get; set; }
        
        #endregion

        #region 计算属性
        
        /// <summary>
        /// 是否已激活
        /// </summary>
        public bool IsActive => Status == 1;
        
        #endregion
    }
}
```

### 4.6.2 使用nameof提高可维护性

```csharp
// 推荐：使用nameof
public string Name
{
    get { return getProperty<string>(nameof(Name)); }
    set { setProperty(nameof(Name), value, 50); }
}

// 不推荐：使用字符串字面量
public string Name
{
    get { return getProperty<string>("Name"); }
    set { setProperty("Name", value, 50); }
}
```

### 4.6.3 分离业务接口

```csharp
// 定义业务接口
public interface IUser
{
    int ID { get; set; }
    string Name { get; set; }
    string Email { get; set; }
}

// 实体类实现接口
public class UserEntity : EntityBase, IUser
{
    public UserEntity()
    {
        TableName = "TbUser";
        IdentityName = "ID";
        PrimaryKeys.Add("ID");
    }
    
    public int ID { get { ... } set { ... } }
    public string Name { get { ... } set { ... } }
    public string Email { get { ... } set { ... } }
}

// 业务层使用接口
public class UserService
{
    public IUser GetUser(int id)
    {
        // 返回接口类型，隐藏实现细节
        return EntityQuery<UserEntity>.QueryObject(...);
    }
}
```

### 4.6.4 实体类继承

```csharp
// 基础实体类（包含通用字段）
public abstract class BaseEntity : EntityBase
{
    public DateTime CreateTime
    {
        get { return getProperty<DateTime>(nameof(CreateTime)); }
        set { setProperty(nameof(CreateTime), value); }
    }

    public DateTime? UpdateTime
    {
        get { return getProperty<DateTime?>(nameof(UpdateTime)); }
        set { setProperty(nameof(UpdateTime), value); }
    }

    public int CreatorId
    {
        get { return getProperty<int>(nameof(CreatorId)); }
        set { setProperty(nameof(CreatorId), value); }
    }
}

// 业务实体类
public class UserEntity : BaseEntity
{
    public UserEntity()
    {
        TableName = "TbUser";
        IdentityName = "ID";
        PrimaryKeys.Add("ID");
    }

    public int ID { get { ... } set { ... } }
    public string Name { get { ... } set { ... } }
    // 自动继承了CreateTime, UpdateTime, CreatorId
}
```

## 4.7 本章小结

本章详细介绍了SOD框架的实体类与ORM映射机制：

1. **EntityBase基类**：核心方法和属性的使用
2. **元数据映射**：表名、主键、标识字段、字段名、外键的映射
3. **数据类型映射**：基本类型、可空类型、枚举类型的处理
4. **高级映射技术**：分表、动态主键、虚拟映射
5. **实体类工厂**：EntityBuilder动态创建实体
6. **最佳实践**：规范的实体类定义方式

掌握实体类的定义和映射是使用SOD框架进行ORM开发的基础，在下一章我们将学习强大的OQL查询语言。

---

> **下一章预告**：第五章将深入讲解OQL查询语言，包括基础查询、条件表达式、关联查询、分页等高级特性。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="03-快速入门与环境配置" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="05-OQL查询语言详解" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
