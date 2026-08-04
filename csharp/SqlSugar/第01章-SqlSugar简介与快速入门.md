---
layout: default
title: 第一章：SqlSugar 简介与快速入门
---

# 第一章：SqlSugar 简介与快速入门

## 目录

1. [什么是SqlSugar](#1-什么是sqlsugar)
2. [SqlSugar的发展历程](#2-sqlsugar的发展历程)
3. [核心特性与优势](#3-核心特性与优势)
4. [适用场景分析](#4-适用场景分析)
5. [与其他ORM框架对比](#5-与其他orm框架对比)
6. [第一个SqlSugar程序](#6-第一个sqlsugar程序)
7. [社区与生态资源](#7-社区与生态资源)

---

## 1. 什么是SqlSugar

### 1.1 SqlSugar简介

SqlSugar是一个功能强大、易用且高性能的 .NET ORM（对象关系映射）框架，由中国开发者创建并维护，专为简化.NET平台的数据库访问而设计。SqlSugar的核心理念是"让数据访问更简单、更高效、更优雅"，通过丰富的API和强大的功能，帮助开发者快速构建高质量的数据访问层。

SqlSugar采用 **Apache-2.0** 开源许可证发布，开发者可以免费用于商业项目。框架托管在GitHub和Gitee平台上：

- **GitHub地址**：https://github.com/DotNetNext/SqlSugar
- **官方文档**：https://www.donet5.com/Home/Doc
- **Gitee镜像**：https://gitee.com/dotnetchina/SqlSugar

### 1.2 SqlSugar的命名含义

SqlSugar（SQL糖）这个名称富有深意：
- **SQL**：代表结构化查询语言，是数据库操作的基础
- **Sugar**：意为"语法糖"，即通过优雅简洁的API让SQL操作更甜蜜、更易用

正如其名，SqlSugar就是要为.NET开发者提供最甜蜜的数据访问体验。

### 1.3 核心定位

SqlSugar的核心定位可以概括为：

| 定位 | 说明 |
|------|------|
| **轻量级ORM** | 不是重型框架，核心库体积小，性能优异 |
| **全功能框架** | 提供CRUD、事务、分页、多表联查等完整功能 |
| **多数据库支持** | 支持MySQL、SQL Server、PostgreSQL、Oracle、SQLite等数十种数据库 |
| **开发加速器** | 减少重复代码，大幅提升开发效率 |
| **企业级方案** | 支持分表分库、多租户、分布式事务等企业特性 |

---

## 2. SqlSugar的发展历程

### 2.1 版本演进时间线

SqlSugar自诞生以来，经历了多个重要的版本迭代：

| 版本 | 发布时间 | 重要特性 |
|------|---------|---------|
| **1.x** | 2015年 | 项目初期，基础CRUD功能 |
| **2.x** | 2016年 | 增加多数据库支持 |
| **3.x** | 2017年 | 引入CodeFirst和DbFirst |
| **4.x** | 2018-2019年 | 性能大幅优化，增加分表功能 |
| **5.x** | 2020-至今 | 支持.NET Core/.NET 5+，增加多租户、分布式事务等企业特性 |
| **5.1.4.215** | 2026年6月 | 最新稳定版，支持.NET Standard 2.1、.NET Core 3.1至.NET 10 |

### 2.2 里程碑事件

- **2015年**：SqlSugar项目启动，在CodePlex平台开源
- **2016年**：迁移到GitHub，开始支持多数据库
- **2017年**：社区用户突破1万+
- **2018年**：性能优化，达到并超越Dapper性能水平
- **2019年**：引入分表分库功能，支持大数据量场景
- **2020年**：全面支持.NET Core 3.1和.NET 5
- **2021-2023年**：持续优化，支持.NET 6/7/8，增加更多数据库支持
- **2024年至今**：支持.NET 9，持续优化和完善
- **2025年**：支持.NET 10预览版
- **2026年6月**：发布5.1.4.215，全面支持.NET Core 3.1至.NET 10和.NET Standard 2.1

### 2.3 社区发展

SqlSugar拥有中国最活跃的.NET ORM社区之一：
- GitHub Star数：15,000+
- Gitee Star数：5,000+
- NuGet下载量：数百万次
- 开发者社区：活跃的QQ群、微信群、论坛

---

## 3. 核心特性与优势

### 3.1 零SQL开发

SqlSugar支持完全零SQL开发，通过Lambda表达式和链式API实现所有数据库操作：

```csharp
// 查询示例 - 无需编写SQL
var users = db.Queryable<User>()
    .Where(u => u.Age > 18 && u.Status == 1)
    .OrderBy(u => u.CreateTime, OrderByType.Desc)
    .ToList();
```

### 3.2 多数据库支持

SqlSugar支持数十种主流和国产数据库，切换数据库只需修改DbType配置：

**主流数据库**：
- SQL Server (2005-2022)
- MySQL (5.x/8.x)
- PostgreSQL
- Oracle
- SQLite

**国产数据库**：
- 达梦（DM）
- 人大金仓（KingbaseES）
- 神通（Oscar）
- 南大通用（GBase）
- 瀚高（HighGo）

**大数据/时序数据库**：
- ClickHouse
- TDengine
- MongoDB

**云数据库**：
- OceanBase
- PolarDB
- TiDB

### 3.3 高性能设计

SqlSugar在性能方面做了大量优化：

| 性能特性 | 说明 |
|---------|------|
| **表达式树编译** | 使用表达式树动态编译，避免反射性能损耗 |
| **对象池技术** | 复用对象，减少GC压力 |
| **批量操作** | 支持高效的批量插入、更新、删除 |
| **异步支持** | 全面支持async/await异步编程 |
| **一级缓存** | 智能缓存，减少数据库访问 |

性能对比（相对值）：
- 查询性能：与Dapper相当，优于EF Core 30-50%
- 批量插入：10万条数据仅需2-3秒
- 复杂查询：比EF Core快50%+

### 3.4 CodeFirst与DbFirst双支持

**CodeFirst（代码优先）**：
```csharp
// 定义实体类
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    public int Age { get; set; }
}

// 自动创建表
db.CodeFirst.InitTables<User>();
```

**DbFirst（数据库优先）**：
```csharp
// 根据现有数据库生成实体类
db.DbFirst.CreateClassFile("c:\\Demo\\Models");
```

### 3.5 分表分库支持

SqlSugar提供原生的分表分库支持，适用于大数据量场景：

```csharp
// 按年份分表
[SplitTable(SplitType.Year)]
[SugarTable("Order_{year}")]
public class Order
{
    public int Id { get; set; }
    public DateTime CreateTime { get; set; }
    public decimal Amount { get; set; }
}

// 自动路由到正确的分表
var orders = db.Queryable<Order>()
    .Where(o => o.CreateTime >= DateTime.Parse("2023-01-01"))
    .ToList();
```

### 3.6 多租户架构

内置多租户支持，轻松实现SaaS应用：

```csharp
// 配置租户数据库
var tenant = new SqlSugarScope(new ConnectionConfig[]
{
    new ConnectionConfig{ ConfigId="tenant1", DbType=DbType.MySql, ConnectionString="..." },
    new ConnectionConfig{ ConfigId="tenant2", DbType=DbType.MySql, ConnectionString="..." }
});

// 根据租户ID切换数据库
var db = tenant.GetConnection("tenant1");
```

### 3.7 强大的AOP功能

SqlSugar提供丰富的AOP拦截点，方便实现日志、审计、性能监控等功能：

```csharp
db.Aop.OnLogExecuting = (sql, pars) =>
{
    Console.WriteLine($"SQL: {sql}");
    Console.WriteLine($"参数: {db.Utilities.SerializeObject(pars.ToDictionary(it => it.ParameterName, it => it.Value))}");
};

db.Aop.OnError = (exp) =>
{
    Console.WriteLine($"错误: {exp.Message}");
};
```

---

## 4. 适用场景分析

### 4.1 最适合的场景

SqlSugar特别适合以下开发场景：

| 场景 | 原因 |
|------|------|
| **快速原型开发** | API简洁，学习成本低，可快速构建原型 |
| **中小型项目** | 功能全面，无需引入多个组件 |
| **多数据库项目** | 切换数据库极其方便，一套代码多数据库运行 |
| **大数据量项目** | 支持分表分库，性能优异 |
| **SaaS多租户系统** | 内置多租户支持 |
| **微服务架构** | 轻量级，适合在微服务中使用 |
| **遗留系统重构** | 可以与现有代码共存，逐步替换 |

### 4.2 不太适合的场景

以下场景可能需要考虑其他方案：

- **复杂的领域驱动设计（DDD）**：如果需要复杂的聚合根、值对象等DDD概念，EF Core可能更合适
- **需要强类型的数据库迁移**：EF Core的Migration功能更强大
- **需要复杂的继承映射**：EF Core在继承映射方面支持更好

### 4.3 实际应用案例

SqlSugar已被众多企业和项目采用：

- **电商平台**：某大型电商平台使用SqlSugar处理千万级订单数据
- **物联网系统**：某物联网平台使用SqlSugar存储海量传感器数据
- **政务系统**：多个政府项目使用SqlSugar，支持国产数据库
- **金融系统**：某金融公司使用SqlSugar的分布式事务功能
- **SaaS平台**：多个SaaS产品使用SqlSugar的多租户功能

---

## 5. 与其他ORM框架对比

### 5.1 SqlSugar vs EF Core

| 对比项 | SqlSugar | EF Core |
|-------|----------|---------|
| **学习曲线** | 平缓，API简单直观 | 较陡，概念较多 |
| **性能** | 优秀，接近Dapper | 良好，但较SqlSugar慢 |
| **数据库支持** | 30+种，包括国产数据库 | 主流数据库 |
| **分表分库** | 原生支持 | 需第三方库 |
| **代码优先** | 支持，简单直观 | 支持，功能强大 |
| **迁移功能** | 基础支持 | 强大的Migration |
| **多租户** | 原生支持 | 需自行实现 |
| **DDD支持** | 基础支持 | 更完善 |

**选择建议**：
- 追求性能、需要多数据库支持 → SqlSugar
- 需要复杂的领域模型、强类型迁移 → EF Core

### 5.2 SqlSugar vs Dapper

| 对比项 | SqlSugar | Dapper |
|-------|----------|--------|
| **学习曲线** | 中等 | 平缓 |
| **性能** | 与Dapper相当 | 极佳 |
| **功能完整性** | 完整的ORM功能 | 轻量级Micro-ORM |
| **查询构建** | 链式Lambda表达式 | 需手写SQL |
| **多表联查** | 支持，无需写SQL | 需手写SQL |
| **代码量** | 少 | 较多（需写SQL） |
| **类型安全** | 完全类型安全 | 基本类型安全 |

**选择建议**：
- 需要完整ORM功能、追求开发效率 → SqlSugar
- 极致追求性能、喜欢写SQL → Dapper

### 5.3 SqlSugar vs FreeSql

| 对比项 | SqlSugar | FreeSql |
|-------|----------|---------|
| **诞生时间** | 2015年 | 2019年 |
| **成熟度** | 非常成熟 | 较新但发展快 |
| **文档质量** | 完善 | 完善 |
| **社区活跃度** | 非常活跃 | 活跃 |
| **功能特性** | 非常丰富 | 丰富 |
| **API风格** | 简洁直观 | 功能丰富 |

两者都是优秀的.NET ORM框架，选择主要看个人偏好和项目需求。

---

## 6. 第一个SqlSugar程序

### 6.1 安装SqlSugar

通过NuGet安装SqlSugar：

```bash
# .NET CLI
dotnet add package SqlSugar

# Package Manager Console
Install-Package SqlSugar
```

根据使用的数据库，可能还需要安装对应的数据库驱动：

```bash
# MySQL
dotnet add package MySqlConnector

# SQL Server - 通常.NET已包含

# PostgreSQL
dotnet add package Npgsql

# Oracle
dotnet add package Oracle.ManagedDataAccess.Core

# SQLite
dotnet add package System.Data.SQLite.Core
```

### 6.2 创建第一个控制台程序

创建一个简单的控制台应用程序：

```csharp
using SqlSugar;
using System;

namespace SqlSugarDemo
{
    class Program
    {
        static void Main(string[] args)
        {
            // 1. 创建数据库连接
            SqlSugarClient db = new SqlSugarClient(new ConnectionConfig()
            {
                ConnectionString = "server=localhost;database=testdb;uid=root;pwd=123456;",
                DbType = DbType.MySql,
                IsAutoCloseConnection = true,
                InitKeyType = InitKeyType.Attribute
            });

            // 2. 定义实体类
            // 见下方User类定义

            // 3. 创建表（CodeFirst）
            db.CodeFirst.InitTables(typeof(User));

            // 4. 插入数据
            db.Insertable(new User
            {
                Name = "张三",
                Age = 25,
                Email = "zhangsan@example.com"
            }).ExecuteCommand();

            // 5. 查询数据
            var users = db.Queryable<User>().ToList();

            // 6. 输出结果
            foreach (var user in users)
            {
                Console.WriteLine($"ID: {user.Id}, Name: {user.Name}, Age: {user.Age}");
            }
        }
    }

    // 实体类定义
    public class User
    {
        [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
        public int Id { get; set; }

        [SugarColumn(Length = 50)]
        public string Name { get; set; }

        public int Age { get; set; }

        [SugarColumn(Length = 100)]
        public string Email { get; set; }
    }
}
```

### 6.3 代码说明

**1. 创建数据库连接**
```csharp
SqlSugarClient db = new SqlSugarClient(new ConnectionConfig()
{
    ConnectionString = "连接字符串",
    DbType = DbType.MySql,  // 数据库类型
    IsAutoCloseConnection = true,  // 自动关闭连接
    InitKeyType = InitKeyType.Attribute  // 使用特性初始化
});
```

**2. 定义实体类**
使用特性标注实体类和属性：
- `[SugarColumn(IsPrimaryKey = true)]`：标识主键
- `[SugarColumn(IsIdentity = true)]`：标识自增
- `[SugarColumn(Length = 50)]`：指定字段长度

**3. 创建表**
```csharp
db.CodeFirst.InitTables(typeof(User));
```

**4. 基本操作**
- 插入：`db.Insertable(entity).ExecuteCommand()`
- 查询：`db.Queryable<T>().ToList()`
- 更新：`db.Updateable(entity).ExecuteCommand()`
- 删除：`db.Deleteable<T>().Where(...).ExecuteCommand()`

### 6.4 运行程序

编译并运行程序：

```bash
dotnet run
```

输出结果：
```
ID: 1, Name: 张三, Age: 25
```

---

## 7. 社区与生态资源

### 7.1 官方资源

| 资源 | 链接 | 说明 |
|------|------|------|
| **官方网站** | https://www.donet5.com | 完整文档和教程 |
| **GitHub仓库** | https://github.com/DotNetNext/SqlSugar | 源代码、Issue、PR |
| **Gitee镜像** | https://gitee.com/dotnetchina/SqlSugar | 国内访问更快 |
| **NuGet包** | https://www.nuget.org/packages/SqlSugar | 下载安装包 |

### 7.2 学习资源

**官方文档**：
- 入门教程：https://www.donet5.com/Home/Doc
- API参考：详细的API文档
- 视频教程：B站有多个视频教程
- 示例代码：GitHub仓库中的Examples目录

**社区文章**：
- CSDN、博客园有大量实战文章
- SegmentFault、掘金也有很多教程
- 公众号文章和技术博客

**视频教程**：
- B站搜索"SqlSugar教程"
- 作者录制的官方教程
- 社区开发者分享的实战视频

### 7.3 社区支持

**交流群组**：
- QQ群：多个技术交流群
- 微信群：开发者交流群
- GitHub Discussions：英文交流
- Gitee Issues：中文问题讨论

**技术支持**：
- GitHub Issues：Bug报告和功能请求
- Gitee Issues：中文问题反馈
- Stack Overflow：标签sqlsugar
- 官方论坛：开发者论坛

### 7.4 贡献指南

如果你想为SqlSugar做贡献：

1. **报告Bug**：在GitHub/Gitee提Issue
2. **提交PR**：Fork仓库，修改后提交Pull Request
3. **完善文档**：帮助改进文档
4. **分享经验**：写文章、录视频分享使用经验

### 7.5 商业支持

SqlSugar提供商业技术支持服务：
- 技术咨询
- 定制开发
- 培训服务
- VIP技术支持

---

## 本章小结

本章我们全面了解了SqlSugar框架：

1. **SqlSugar是什么**：一个高性能、易用的.NET ORM框架
2. **发展历程**：从2015年至今，持续发展和完善
3. **核心特性**：零SQL开发、多数据库支持、高性能、分表分库等
4. **适用场景**：适合各种规模的项目，尤其是多数据库和大数据量场景
5. **对比分析**：相比EF Core、Dapper各有优势
6. **快速上手**：通过第一个程序了解基本用法
7. **社区资源**：丰富的文档、教程和社区支持

在下一章，我们将详细学习如何在实际项目中配置和集成SqlSugar。

---

## 延伸阅读

- SqlSugar官方文档：https://www.donet5.com/Home/Doc
- GitHub仓库：https://github.com/DotNetNext/SqlSugar
- .NET ORM框架对比：https://www.nuget.org/packages?q=orm
- 表达式树基础：https://docs.microsoft.com/zh-cn/dotnet/csharp/expression-trees

---

## 练习题

1. 在本地创建一个控制台应用程序，安装SqlSugar并连接到MySQL/SQL Server数据库
2. 定义一个Product实体类，包含Id、Name、Price、Stock等属性
3. 使用CodeFirst创建Product表
4. 实现基本的CRUD操作：插入3个产品、查询所有产品、更新一个产品价格、删除一个产品
5. 思考：SqlSugar与你之前使用的ORM框架有什么不同？

下一章：[第二章：环境配置与项目集成](https://znlgis.github.io/csharp/SqlSugar/第02章-环境配置与项目集成/)
