# 第01章：SqlSugar概述与入门

## 目录

1. [什么是SqlSugar](#1-什么是sqlsugar)
2. [发展历程与版本演进](#2-发展历程与版本演进)
3. [核心优势](#3-核心优势)
4. [支持的.NET版本](#4-支持的net版本)
5. [支持的数据库](#5-支持的数据库)
6. [与其他ORM框架对比](#6-与其他orm框架对比)
7. [架构概览](#7-架构概览)
8. [开源许可与社区生态](#8-开源许可与社区生态)
9. [快速入门：Hello World示例](#9-快速入门hello-world示例)
10. [本章小结](#10-本章小结)

---

## 1. 什么是SqlSugar

SqlSugar 是一款国产的 .NET 开源 ORM（Object-Relational Mapping，对象关系映射）框架，由国内开发者 **果糖大数据科技** 团队开发和维护。项目托管在 GitHub 上：[https://github.com/DotNetNext/SqlSugar](https://github.com/DotNetNext/SqlSugar)。

### 1.1 ORM的基本概念

ORM 是一种编程技术，用于在面向对象编程语言和关系型数据库之间建立映射关系。通过 ORM，开发者可以使用面向对象的方式来操作数据库，而不需要编写大量的 SQL 语句。

```
┌─────────────────┐         ┌─────────────────┐
│   C# 对象模型    │  ←ORM→  │   数据库表结构    │
│                 │  映射    │                 │
│  class Student  │ ======> │  Table: Student  │
│  {              │         │  ┌────┬──────┐  │
│    Id           │         │  │ Id │ Name │  │
│    Name         │         │  ├────┼──────┤  │
│    Age          │         │  │ 1  │ 张三 │  │
│  }              │         │  └────┴──────┘  │
└─────────────────┘         └─────────────────┘
```

### 1.2 SqlSugar的定位

SqlSugar 定位为一款 **轻量级、高性能、功能全面** 的 .NET ORM 框架。它的设计理念是：

- **简单易用**：API 设计直观，学习成本低
- **功能全面**：覆盖日常开发中几乎所有的数据库操作需求
- **高性能**：接近原生 ADO.NET 的执行效率
- **多数据库支持**：一套代码适配多种数据库

> SqlSugar 的口号是："让 .NET 操作数据库变得更简单"。

---

## 2. 发展历程与版本演进

SqlSugar 自发布以来，经历了多个重要版本的迭代：

| 时间节点 | 版本 | 重要里程碑 |
|---------|------|-----------|
| 2015年 | 1.x | 项目启动，支持基础 CRUD 操作 |
| 2017年 | 4.x | 重构升级，支持 .NET Core，引入 Lambda 表达式查询 |
| 2019年 | 5.x | 新增 Code First、Db First 功能，支持更多数据库 |
| 2021年 | 5.0.5+ | 支持 .NET 6，新增导航属性、分表功能 |
| 2022年 | 5.1.x | 新增多租户、大数据写入、跨库查询 |
| 2023年 | 5.1.4+ | 支持 .NET 8，新增 MongoDB 支持，ClickHouse 支持 |
| 2024年 | 5.1.4.x | 持续优化，支持更多国产数据库，性能提升 |

### 2.1 版本号说明

SqlSugar 当前主要版本为 **5.x** 系列，NuGet 包名为 `SqlSugarCore`。安装时建议使用最新稳定版本以获得最新的功能和 Bug 修复。

```bash
# 安装最新版本
dotnet add package SqlSugarCore
```

---

## 3. 核心优势

### 3.1 低代码量

SqlSugar 通过简洁的 API 设计，大幅减少了数据库操作所需的代码量。一行代码即可完成常见的 CRUD 操作：

```csharp
// 查询所有学生
var list = db.Queryable<Student>().ToList();

// 根据条件查询
var student = db.Queryable<Student>().Where(it => it.Id == 1).First();

// 插入数据
db.Insertable(new Student { Name = "张三", Age = 20 }).ExecuteCommand();

// 更新数据
db.Updateable(new Student { Id = 1, Name = "李四" }).ExecuteCommand();

// 删除数据
db.Deleteable<Student>(1).ExecuteCommand();
```

### 3.2 高性能

SqlSugar 在性能方面进行了大量优化：

- **表达式缓存**：Lambda 表达式解析结果会被缓存，避免重复解析
- **对象映射优化**：使用 Emit 技术进行高效的对象映射
- **SQL 生成优化**：生成的 SQL 语句经过优化，执行效率高
- **连接池管理**：支持自动连接管理，减少连接开销
- **批量操作**：支持 BulkCopy 等高效批量操作

> 性能测试表明，SqlSugar 的查询性能与原生 ADO.NET 相差不到 5%，远优于 Entity Framework Core。

### 3.3 简洁的API

SqlSugar 的 API 设计遵循 **链式调用** 的风格，代码可读性强：

```csharp
// 分页查询示例
var pageList = db.Queryable<Student>()
    .Where(it => it.Age > 18)
    .OrderBy(it => it.Id, OrderByType.Desc)
    .Select(it => new StudentDto
    {
        StudentName = it.Name,
        StudentAge = it.Age
    })
    .ToPageList(pageIndex, pageSize, ref totalCount);
```

### 3.4 功能全面

SqlSugar 提供了丰富的功能模块：

| 功能模块 | 说明 |
|---------|------|
| CRUD 操作 | 增删改查，支持批量操作 |
| Lambda 表达式 | 强类型查询，编译时检查 |
| Code First | 代码优先，自动建表 |
| Db First | 数据库优先，自动生成实体类 |
| 导航属性 | 一对一、一对多、多对多关联查询 |
| 分表分库 | 水平分表、垂直分库 |
| 多租户 | 支持多租户架构 |
| 二级缓存 | 查询结果缓存 |
| AOP 拦截 | SQL 日志、执行时间监控 |
| 读写分离 | 主从数据库读写分离 |
| 大数据写入 | BulkCopy 批量高效写入 |
| 跨库查询 | 支持跨数据库联表查询 |
| 存储过程 | 支持调用存储过程 |
| 报表查询 | 复杂统计报表查询 |

### 3.5 多数据库兼容

SqlSugar 最大的优势之一是对多种数据库的广泛支持，**同一套代码可以无缝切换不同的数据库**，这在实际项目中非常有价值。

---

## 4. 支持的.NET版本

SqlSugar 对 .NET 生态有着广泛的版本支持：

### 4.1 .NET Framework

| 版本 | 支持情况 | 包名 |
|------|---------|------|
| .NET Framework 4.5+ | ✅ 支持 | SqlSugar |
| .NET Framework 4.6+ | ✅ 支持 | SqlSugar |
| .NET Framework 4.7+ | ✅ 支持 | SqlSugar |
| .NET Framework 4.8 | ✅ 支持 | SqlSugar |

### 4.2 .NET Core / .NET

| 版本 | 支持情况 | 包名 |
|------|---------|------|
| .NET Core 3.1 | ✅ 支持 | SqlSugarCore |
| .NET 5 | ✅ 支持 | SqlSugarCore |
| .NET 6 | ✅ 支持（LTS） | SqlSugarCore |
| .NET 7 | ✅ 支持 | SqlSugarCore |
| .NET 8 | ✅ 支持（LTS） | SqlSugarCore |
| .NET 9 | ✅ 支持 | SqlSugarCore |
| .NET 10 | ✅ 支持 | SqlSugarCore |

> **注意**：.NET Framework 项目使用 `SqlSugar` 包，.NET Core/.NET 项目使用 `SqlSugarCore` 包。

---

## 5. 支持的数据库

SqlSugar 支持的数据库种类极为丰富，涵盖了国际主流数据库和国产数据库：

### 5.1 国际主流数据库

| 数据库 | DbType枚举值 | 说明 |
|-------|-------------|------|
| MySQL | `DbType.MySql` | 支持 5.x、8.x 版本 |
| SQL Server | `DbType.SqlServer` | 支持 2008 及以上版本 |
| PostgreSQL | `DbType.PostgreSQL` | 支持 9.x 及以上版本 |
| Oracle | `DbType.Oracle` | 支持 11g 及以上版本 |
| SQLite | `DbType.Sqlite` | 轻量级嵌入式数据库 |
| MongoDB | `DbType.MongoDB` | NoSQL 文档数据库 |
| ClickHouse | `DbType.ClickHouse` | OLAP 列式数据库 |

### 5.2 国产数据库

| 数据库 | DbType枚举值 | 说明 |
|-------|-------------|------|
| 达梦（DM） | `DbType.Dm` | 武汉达梦数据库 |
| 人大金仓（KingbaseES） | `DbType.Kdbndp` | 北京人大金仓 |
| 瀚高（HighGo） | `DbType.HG` | 瀚高数据库 |
| 南大通用（GBase） | `DbType.GBase` | 南大通用数据库 |
| 神通（Oscar） | `DbType.Oscar` | 神通数据库 |
| 虚谷（QuestDB） | `DbType.QuestDB` | 虚谷数据库 |
| TDengine | `DbType.TDengine` | 涛思数据 |
| GaussDB | `DbType.GaussDB` | 华为 GaussDB |

### 5.3 其他数据库

| 数据库 | DbType枚举值 | 说明 |
|-------|-------------|------|
| Access | `DbType.Access` | Microsoft Access |
| 自定义 | `DbType.Custom` | 自定义数据库适配器 |

> SqlSugar 还在不断扩展对更多数据库的支持，最新支持列表请参考官方文档。

---

## 6. 与其他ORM框架对比

### 6.1 SqlSugar vs Entity Framework Core

| 对比维度 | SqlSugar | Entity Framework Core |
|---------|----------|----------------------|
| 学习曲线 | 较低，API 简单直观 | 较高，概念较多 |
| 性能 | 接近原生 ADO.NET | 相对较慢 |
| 数据库支持 | 20+ 种数据库 | 主要支持主流数据库 |
| 国产数据库 | ✅ 全面支持 | ❌ 需要第三方适配 |
| 分表 | ✅ 内置支持 | ❌ 需要第三方库 |
| 批量操作 | ✅ 内置 BulkCopy | 需要扩展包 |
| 多租户 | ✅ 内置支持 | 需要自行实现 |
| Change Tracking | ❌ 不支持 | ✅ 支持 |
| Migration | Code First | Migration 命令行 |
| 社区规模 | 国内社区活跃 | 全球社区庞大 |

### 6.2 SqlSugar vs Dapper

| 对比维度 | SqlSugar | Dapper |
|---------|----------|--------|
| 类型 | 全功能 ORM | 微型 ORM |
| Lambda查询 | ✅ 支持 | ❌ 不支持 |
| Code First | ✅ 支持 | ❌ 不支持 |
| 导航属性 | ✅ 支持 | ❌ 不支持 |
| SQL编写 | 可选 | 必须手写 SQL |
| 性能 | 高 | 极高（最接近ADO.NET） |
| 功能丰富度 | 非常丰富 | 较少，仅映射 |
| 学习成本 | 低 | 极低 |

### 6.3 SqlSugar vs FreeSql

| 对比维度 | SqlSugar | FreeSql |
|---------|----------|---------|
| 开源时间 | 更早（2015年） | 较晚（2018年） |
| API风格 | 链式调用 | 链式调用 |
| 数据库支持 | 更多（含国产库） | 较多 |
| 分表 | ✅ 支持 | ✅ 支持 |
| 多租户 | ✅ 支持 | ✅ 支持 |
| 文档完善度 | 中文文档齐全 | 中文文档齐全 |
| Star 数 | 较高 | 较高 |
| 社区活跃度 | 高 | 高 |

### 6.4 选型建议

```
选择 SqlSugar 的场景：
├── 需要支持国产数据库（达梦、人大金仓等）
├── 需要内置分表功能
├── 需要低学习成本快速上手
├── 需要多数据库兼容切换
├── 国内项目，需要中文文档和社区支持
└── 需要丰富的内置功能，减少第三方依赖

选择 EF Core 的场景：
├── 团队已有 EF Core 经验
├── 需要 Change Tracking 功能
├── 国际化项目，需要全球社区支持
└── 微软生态深度集成

选择 Dapper 的场景：
├── 追求极致性能
├── 团队擅长 SQL 编写
├── 项目需求简单，仅需对象映射
└── 需要完全控制 SQL 语句
```

---

## 7. 架构概览

### 7.1 整体架构

SqlSugar 的架构分为以下几个核心层次：

```
┌─────────────────────────────────────────────┐
│              应用层（Application）             │
│         SqlSugarClient / SqlSugarScope       │
├─────────────────────────────────────────────┤
│              功能层（Feature）                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │
│  │Query │ │Insert│ │Update│ │ Delete   │   │
│  │able  │ │able  │ │able  │ │ able     │   │
│  └──────┘ └──────┘ └──────┘ └──────────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │
│  │Code  │ │Db    │ │AOP   │ │ 分表/    │   │
│  │First │ │First │ │拦截  │ │ 多租户   │   │
│  └──────┘ └──────┘ └──────┘ └──────────┘   │
├─────────────────────────────────────────────┤
│           表达式解析层（Expression）            │
│      Lambda → SQL 转换引擎                    │
├─────────────────────────────────────────────┤
│           数据库适配层（Provider）              │
│  MySQL│SqlServer│PostgreSQL│Oracle│SQLite│...│
├─────────────────────────────────────────────┤
│           ADO.NET / 数据库驱动                 │
└─────────────────────────────────────────────┘
```

### 7.2 核心组件

| 组件 | 类名 | 说明 |
|------|-----|------|
| 客户端 | `SqlSugarClient` | 核心操作对象，非线程安全 |
| 作用域客户端 | `SqlSugarScope` | 线程安全的单例模式客户端 |
| 查询器 | `ISugarQueryable<T>` | 查询操作接口 |
| 插入器 | `IInsertable<T>` | 插入操作接口 |
| 更新器 | `IUpdateable<T>` | 更新操作接口 |
| 删除器 | `IDeleteable<T>` | 删除操作接口 |
| Code First | `ICodeFirst` | 代码优先接口 |
| Db First | `IDbFirst` | 数据库优先接口 |

### 7.3 工作流程

一个典型的 SqlSugar 查询操作流程如下：

```
1. 创建 SqlSugarClient/SqlSugarScope 实例
       ↓
2. 调用 Queryable<T>() 创建查询器
       ↓
3. 链式调用 Where/OrderBy/Select 等方法
       ↓
4. Lambda 表达式解析为 SQL 片段
       ↓
5. 根据 DbType 生成对应数据库的 SQL 语句
       ↓
6. 通过 ADO.NET 执行 SQL
       ↓
7. 将 DataReader 映射为 C# 对象
       ↓
8. 返回结果
```

---

## 8. 开源许可与社区生态

### 8.1 开源许可

SqlSugar 采用 **MIT 许可证** 开源，这意味着：

- ✅ 可以免费用于商业项目
- ✅ 可以修改和分发源代码
- ✅ 无需支付任何费用
- ✅ 无需公开自己的项目源码
- ⚠️ 需要保留原始的版权声明

### 8.2 社区与生态

SqlSugar 拥有活跃的社区生态：

- **GitHub**：[https://github.com/DotNetNext/SqlSugar](https://github.com/DotNetNext/SqlSugar)
- **官方文档**：[https://www.donet5.com/Home/Doc](https://www.donet5.com/Home/Doc)
- **NuGet 下载量**：累计数百万次下载
- **QQ 群/微信群**：多个技术交流群
- **示例项目**：官方提供了丰富的示例项目

### 8.3 与其他框架的集成

SqlSugar 可以与许多主流 .NET 框架无缝集成：

```
SqlSugar 集成生态
├── Web 框架
│   ├── ASP.NET Core WebAPI
│   ├── ASP.NET Core MVC
│   └── Blazor
├── 微服务框架
│   ├── ABP Framework
│   ├── Furion
│   └── Admin.NET
├── 桌面应用
│   ├── WPF
│   ├── WinForms
│   └── MAUI
└── 其他
    ├── Worker Service
    ├── Azure Functions
    └── 控制台应用
```

---

## 9. 快速入门：Hello World示例

### 9.1 创建项目

首先，使用 .NET CLI 创建一个控制台项目：

```bash
# 创建项目
dotnet new console -n SqlSugarDemo
cd SqlSugarDemo

# 安装 SqlSugarCore
dotnet add package SqlSugarCore

# 安装 SQLite 驱动（用于快速体验）
dotnet add package System.Data.SQLite.Core
```

### 9.2 定义实体类

创建一个简单的学生实体类：

```csharp
using SqlSugar;

namespace SqlSugarDemo;

/// <summary>
/// 学生实体类
/// </summary>
[SugarTable("Student")]
public class Student
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    [SugarColumn(Length = 50, IsNullable = false)]
    public string Name { get; set; } = string.Empty;

    public int Age { get; set; }

    [SugarColumn(IsNullable = true)]
    public string? SchoolName { get; set; }

    public DateTime CreateTime { get; set; } = DateTime.Now;
}
```

### 9.3 编写主程序

```csharp
using SqlSugar;
using SqlSugarDemo;

// 1. 创建数据库连接
var db = new SqlSugarClient(new ConnectionConfig()
{
    ConnectionString = "DataSource=demo.db",  // SQLite 数据库文件
    DbType = DbType.Sqlite,                   // 数据库类型
    IsAutoCloseConnection = true,              // 自动关闭连接
    InitKeyType = InitKeyType.Attribute        // 使用特性初始化主键
});

// 2. 配置 AOP 输出 SQL 日志
db.Aop.OnLogExecuting = (sql, pars) =>
{
    Console.WriteLine($"SQL: {sql}");
    Console.WriteLine($"参数: {string.Join(", ", pars.Select(p => $"{p.ParameterName}={p.Value}"))}");
    Console.WriteLine("---");
};

// 3. Code First：自动创建表
db.CodeFirst.InitTables<Student>();
Console.WriteLine("✅ 数据表创建成功！");

// 4. 插入数据
var student1 = new Student { Name = "张三", Age = 20, SchoolName = "清华大学" };
var student2 = new Student { Name = "李四", Age = 22, SchoolName = "北京大学" };
var student3 = new Student { Name = "王五", Age = 19, SchoolName = "清华大学" };

db.Insertable(new List<Student> { student1, student2, student3 }).ExecuteCommand();
Console.WriteLine("✅ 数据插入成功！");

// 5. 查询数据
var allStudents = db.Queryable<Student>().ToList();
Console.WriteLine($"\n📋 所有学生（共 {allStudents.Count} 人）：");
foreach (var s in allStudents)
{
    Console.WriteLine($"  ID:{s.Id} 姓名:{s.Name} 年龄:{s.Age} 学校:{s.SchoolName}");
}

// 6. 条件查询
var adultStudents = db.Queryable<Student>()
    .Where(it => it.Age >= 20)
    .OrderBy(it => it.Age)
    .ToList();
Console.WriteLine($"\n📋 成年学生（年龄>=20，共 {adultStudents.Count} 人）：");
foreach (var s in adultStudents)
{
    Console.WriteLine($"  {s.Name} - {s.Age}岁");
}

// 7. 更新数据
db.Updateable<Student>()
    .SetColumns(it => it.Age == it.Age + 1)
    .Where(it => it.Name == "张三")
    .ExecuteCommand();
Console.WriteLine("\n✅ 张三的年龄已更新！");

// 8. 查询更新后的数据
var zhangsan = db.Queryable<Student>().First(it => it.Name == "张三");
Console.WriteLine($"  张三当前年龄：{zhangsan?.Age}");

// 9. 删除数据
db.Deleteable<Student>().Where(it => it.Name == "王五").ExecuteCommand();
Console.WriteLine("\n✅ 王五已被删除！");

// 10. 查询最终数据
var finalList = db.Queryable<Student>().ToList();
Console.WriteLine($"\n📋 最终学生列表（共 {finalList.Count} 人）：");
foreach (var s in finalList)
{
    Console.WriteLine($"  ID:{s.Id} 姓名:{s.Name} 年龄:{s.Age} 学校:{s.SchoolName}");
}

Console.WriteLine("\n🎉 SqlSugar Hello World 演示完成！");
```

### 9.4 运行结果

执行 `dotnet run` 后，你将看到类似以下输出：

```
✅ 数据表创建成功！
✅ 数据插入成功！

📋 所有学生（共 3 人）：
  ID:1 姓名:张三 年龄:20 学校:清华大学
  ID:2 姓名:李四 年龄:22 学校:北京大学
  ID:3 姓名:王五 年龄:19 学校:清华大学

📋 成年学生（年龄>=20，共 2 人）：
  张三 - 20岁
  李四 - 22岁

✅ 张三的年龄已更新！
  张三当前年龄：21

✅ 王五已被删除！

📋 最终学生列表（共 2 人）：
  ID:1 姓名:张三 年龄:21 学校:清华大学
  ID:2 姓名:李四 年龄:22 学校:北京大学

🎉 SqlSugar Hello World 演示完成！
```

### 9.5 代码要点回顾

通过这个简单的示例，我们已经体验了 SqlSugar 的核心功能：

1. **创建连接**：通过 `SqlSugarClient` 和 `ConnectionConfig` 配置数据库连接
2. **AOP 日志**：通过 `Aop.OnLogExecuting` 输出执行的 SQL 语句
3. **Code First**：通过 `CodeFirst.InitTables<T>()` 自动创建数据表
4. **插入数据**：通过 `Insertable()` 插入单条或多条数据
5. **查询数据**：通过 `Queryable<T>()` 配合 Lambda 表达式查询
6. **更新数据**：通过 `Updateable()` 更新指定数据
7. **删除数据**：通过 `Deleteable<T>()` 删除指定数据

> 仅用不到 60 行代码，就完成了建表、增删改查的全流程操作——这就是 SqlSugar 的魅力所在。

---

## 10. 本章小结

本章我们全面介绍了 SqlSugar ORM 框架的基础知识：

- **SqlSugar** 是一款国产开源的 .NET ORM 框架，采用 MIT 许可证
- 核心优势包括 **低代码量、高性能、简洁 API、功能全面、多数据库兼容**
- 支持 **.NET Framework 4.5+** 和 **.NET Core 3.1 / .NET 5-10** 所有版本
- 支持 **20+ 种数据库**，包括 MySQL、SQL Server、PostgreSQL、Oracle、SQLite 以及达梦、人大金仓等国产数据库
- 与 EF Core、Dapper、FreeSql 相比，SqlSugar 在多数据库支持和功能全面性方面具有明显优势
- 通过 Hello World 示例，我们体验了从建表到增删改查的完整流程

---

> **下一章预告**：下一章将介绍 SqlSugar 的环境搭建与项目配置，包括 NuGet 包安装、ConnectionConfig 详细配置、SqlSugarClient 与 SqlSugarScope 的区别、ASP.NET Core 依赖注入集成等内容。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-环境搭建与项目配置" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
