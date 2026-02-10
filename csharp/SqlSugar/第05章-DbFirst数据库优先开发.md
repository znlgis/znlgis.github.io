# 第05章：DbFirst数据库优先开发

## 目录

1. [什么是DbFirst](#1-什么是dbfirst)
2. [DbFirst基础配置](#2-dbfirst基础配置)
3. [生成实体类](#3-生成实体类)
4. [生成带特性的实体类](#4-生成带特性的实体类)
5. [自定义模板](#5-自定义模板)
6. [生成单表与多表实体](#6-生成单表与多表实体)
7. [过滤表](#7-过滤表)
8. [生成带导航属性的实体](#8-生成带导航属性的实体)
9. [DbFirst与CodeFirst对比](#9-dbfirst与codefirst对比)
10. [已有项目的实战工作流](#10-已有项目的实战工作流)
11. [常见问题与解决方案](#11-常见问题与解决方案)
12. [本章小结](#12-本章小结)

---

## 1. 什么是DbFirst

### 1.1 DbFirst的概念

**DbFirst（数据库优先）** 是一种开发模式，指的是先设计和创建数据库表结构，然后通过 ORM 框架自动生成对应的实体类代码。这种模式特别适合以下场景：

- 项目中已有现成的数据库，需要使用 ORM 来操作
- DBA 负责数据库设计，开发人员专注于业务逻辑
- 遗留系统迁移，需要将老数据库接入新的 .NET 项目
- 数据库结构频繁由外部工具管理（如 PowerDesigner、Navicat 等）

> **核心思想**：数据库是设计的起点，代码从数据库结构自动生成。

### 1.2 DbFirst的工作流程

DbFirst 的典型工作流程如下：

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  设计数据库   │ ──→ │  创建表结构   │ ──→ │  生成实体类   │ ──→ │  编写业务代码  │
│  （DBA设计）  │     │  （SQL脚本）   │     │  （SqlSugar）  │     │  （开发人员）   │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 1.3 SqlSugar DbFirst 的特点

SqlSugar 的 DbFirst 功能具有以下优点：

| 特点 | 说明 |
|------|------|
| 自动映射 | 自动将数据库类型映射为 C# 类型 |
| 特性生成 | 可生成 `[SugarTable]`、`[SugarColumn]` 等特性 |
| 模板自定义 | 支持自定义生成模板，灵活控制输出格式 |
| 批量操作 | 支持一次性生成所有表或指定表的实体 |
| 导航属性 | 支持生成带导航属性的实体类 |
| 过滤机制 | 支持按表名前缀、后缀等条件过滤 |

---

## 2. DbFirst基础配置

### 2.1 创建SqlSugarClient

使用 DbFirst 功能前，首先需要创建 `SqlSugarClient` 实例：

```csharp
var db = new SqlSugarClient(new ConnectionConfig()
{
    ConnectionString = "Server=localhost;Database=MyDb;Uid=root;Pwd=123456;",
    DbType = DbType.MySql,
    IsAutoCloseConnection = true
});
```

### 2.2 获取DbFirst对象

通过 `db.DbFirst` 属性获取 DbFirst 操作对象：

```csharp
// 获取 DbFirst 实例
var dbFirst = db.DbFirst;
```

### 2.3 支持的数据库

SqlSugar DbFirst 支持所有 SqlSugar 兼容的数据库：

| 数据库 | DbType枚举值 | 说明 |
|--------|-------------|------|
| SQL Server | `DbType.SqlServer` | 支持 2008 及以上版本 |
| MySQL | `DbType.MySql` | 支持 5.6 及以上版本 |
| PostgreSQL | `DbType.PostgreSQL` | 支持 9.0 及以上版本 |
| Oracle | `DbType.Oracle` | 支持 11g 及以上版本 |
| SQLite | `DbType.Sqlite` | 支持 SQLite 3 |
| 达梦 | `DbType.Dm` | 国产数据库 |
| 人大金仓 | `DbType.Kdbndp` | 国产数据库 |
| TDengine | `DbType.TDengine` | 时序数据库 |

### 2.4 配置输出路径

生成实体类需要指定输出目录：

```csharp
// 生成实体到指定目录
db.DbFirst.CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

参数说明：

- 第一个参数：文件输出的物理路径
- 第二个参数：生成的实体类的命名空间

---

## 3. 生成实体类

### 3.1 生成所有表的实体类

最简单的用法，一行代码生成数据库中所有表的实体类：

```csharp
// 生成所有表的实体类
db.DbFirst.CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

假设数据库中有以下表：

```sql
CREATE TABLE Student (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Age INT,
    ClassId INT,
    CreateTime DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

生成的实体类如下：

```csharp
namespace MyProject.Models
{
    public class Student
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public int? Age { get; set; }
        public int? ClassId { get; set; }
        public DateTime? CreateTime { get; set; }
    }
}
```

### 3.2 数据库类型到C#类型的映射

SqlSugar 会自动将数据库类型映射为 C# 类型：

| 数据库类型（MySQL） | C# 类型 | 说明 |
|---------------------|---------|------|
| INT | `int` / `int?` | 可空列映射为 `int?` |
| BIGINT | `long` / `long?` | 大整数 |
| VARCHAR / TEXT | `string` | 字符串类型 |
| DATETIME | `DateTime` / `DateTime?` | 日期时间 |
| DECIMAL | `decimal` / `decimal?` | 高精度小数 |
| FLOAT | `float` / `float?` | 浮点数 |
| DOUBLE | `double` / `double?` | 双精度浮点 |
| BIT / TINYINT(1) | `bool` / `bool?` | 布尔值 |
| BLOB / LONGBLOB | `byte[]` | 二进制数据 |

### 3.3 生成实体到字符串

如果不想直接写文件，可以将生成结果以字符串形式获取：

```csharp
// 获取所有表的实体类字符串
var classStringList = db.DbFirst.ToClassStringList("MyProject.Models");

foreach (var item in classStringList)
{
    Console.WriteLine($"表名: {item.Key}");
    Console.WriteLine($"实体类代码:\n{item.Value}");
    Console.WriteLine("---");
}
```

### 3.4 生成视图的实体类

DbFirst 同样支持从视图生成实体类：

```csharp
// 生成所有视图的实体类
db.DbFirst
    .Where(DbObjectType.View)
    .CreateClassFile("C:\\MyProject\\Models\\Views", "MyProject.Models.Views");
```

---

## 4. 生成带特性的实体类

### 4.1 生成默认特性

通过 `IsCreateAttribute()` 方法生成带 SqlSugar 特性的实体类：

```csharp
db.DbFirst
    .IsCreateAttribute()  // 启用特性生成
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

生成结果示例：

```csharp
namespace MyProject.Models
{
    [SugarTable("Student")]
    public class Student
    {
        [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
        public int Id { get; set; }

        [SugarColumn(ColumnName = "Name", ColumnDataType = "varchar", Length = 100, IsNullable = false)]
        public string Name { get; set; }

        [SugarColumn(IsNullable = true)]
        public int? Age { get; set; }

        [SugarColumn(IsNullable = true)]
        public int? ClassId { get; set; }

        [SugarColumn(IsNullable = true)]
        public DateTime? CreateTime { get; set; }
    }
}
```

### 4.2 生成默认值特性

```csharp
db.DbFirst
    .IsCreateAttribute()
    .IsCreateDefaultValue()  // 生成默认值
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

生成的实体类会包含数据库中定义的默认值：

```csharp
[SugarColumn(IsNullable = true, DefaultValue = "CURRENT_TIMESTAMP")]
public DateTime? CreateTime { get; set; }
```

### 4.3 自定义特性格式

通过 `SettingClassDescriptionTemplate` 和 `SettingPropertyDescriptionTemplate` 可以自定义注释格式：

```csharp
db.DbFirst
    .IsCreateAttribute()
    .SettingClassDescriptionTemplate(it =>
    {
        return $@"/// <summary>
/// {it.TableComment}（表名：{it.TableName}）
/// </summary>";
    })
    .SettingPropertyDescriptionTemplate(it =>
    {
        return $@"/// <summary>
/// {it.ColumnComment}
/// </summary>";
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

生成结果：

```csharp
/// <summary>
/// 学生信息表（表名：Student）
/// </summary>
[SugarTable("Student")]
public class Student
{
    /// <summary>
    /// 主键ID
    /// </summary>
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    /// <summary>
    /// 学生姓名
    /// </summary>
    [SugarColumn(ColumnName = "Name", Length = 100, IsNullable = false)]
    public string Name { get; set; }
}
```

---

## 5. 自定义模板

### 5.1 自定义类模板

通过 `SettingClassTemplate` 方法可以完全自定义生成的类模板：

```csharp
db.DbFirst
    .SettingClassTemplate(it =>
    {
        return @"
{using}

namespace {Namespace}
{
    /// <summary>
    /// {ClassDescription}
    /// </summary>
    [SugarTable(""{ClassName}"")]
    public partial class {ClassName} : BaseEntity
    {
        {PropertyName}
    }
}";
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

模板中可用的占位符：

| 占位符 | 说明 |
|--------|------|
| `{using}` | using 引用区域 |
| `{Namespace}` | 命名空间 |
| `{ClassName}` | 类名 |
| `{ClassDescription}` | 类描述 |
| `{PropertyName}` | 属性区域 |

### 5.2 自定义属性模板

通过 `SettingPropertyTemplate` 方法自定义属性模板：

```csharp
db.DbFirst
    .SettingPropertyTemplate(it =>
    {
        return @"
        /// <summary>
        /// {PropertyDescription}
        /// </summary>
        {SugarColumn}
        public {PropertyType} {PropertyName} { get; set; }";
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

属性模板可用的占位符：

| 占位符 | 说明 |
|--------|------|
| `{PropertyDescription}` | 属性描述/注释 |
| `{SugarColumn}` | SugarColumn 特性 |
| `{PropertyType}` | 属性的 C# 类型 |
| `{PropertyName}` | 属性名 |

### 5.3 自定义命名转换

在一些旧系统中，数据库表名和列名可能不符合 C# 命名规范。通过 `SettingNamespaceTemplate` 和名称格式化方法可以解决：

```csharp
db.DbFirst
    // 表名转换：将下划线命名转为帕斯卡命名
    .SettingClassTemplate(it =>
    {
        // 表名: user_info => UserInfo
        it.ClassName = ToPascalCase(it.ClassName);
        return null; // 返回null使用默认模板
    })
    // 列名转换
    .SettingPropertyTemplate(it =>
    {
        // 列名: user_name => UserName
        it.PropertyName = ToPascalCase(it.PropertyName);
        return null;
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");

// 帕斯卡命名转换方法
static string ToPascalCase(string name)
{
    return string.Join("",
        name.Split('_')
            .Select(s => char.ToUpper(s[0]) + s.Substring(1).ToLower()));
}
```

### 5.4 添加自定义using引用

```csharp
db.DbFirst
    .SettingNamespaceTemplate(it =>
    {
        // 添加额外的 using 引用
        it.Add("System.ComponentModel.DataAnnotations");
        it.Add("MyProject.Common");
        return it;
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 5.5 完整自定义模板示例

以下是一个综合的自定义模板示例：

```csharp
db.DbFirst
    .IsCreateAttribute()
    .SettingClassDescriptionTemplate(it =>
    {
        return $@"/// <summary>
/// {it.TableComment ?? it.TableName}
/// 创建时间：{DateTime.Now:yyyy-MM-dd}
/// </summary>";
    })
    .SettingPropertyDescriptionTemplate(it =>
    {
        return $@"/// <summary>
/// {it.ColumnComment ?? it.ColumnName}
/// 数据库类型：{it.DataType}
/// </summary>";
    })
    .SettingNamespaceTemplate(it =>
    {
        it.Add("System.ComponentModel");
        it.Add("System.ComponentModel.DataAnnotations");
        return it;
    })
    .SettingConstructorTemplate(it =>
    {
        // 在构造函数中设置默认值
        return @"
        public {ClassName}()
        {
            // 默认构造函数
        }";
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

---

## 6. 生成单表与多表实体

### 6.1 生成指定表的实体

通过 `Where` 方法指定要生成的表名：

```csharp
// 生成单个表
db.DbFirst
    .Where("Student")
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 6.2 生成多个指定表的实体

```csharp
// 生成多个表
db.DbFirst
    .Where("Student", "Teacher", "Class", "Course")
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 6.3 使用数组指定表名

```csharp
// 通过数组动态指定
var tableNames = new string[] { "Student", "Teacher", "Class" };
db.DbFirst
    .Where(tableNames)
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 6.4 从数据库获取表信息后选择性生成

```csharp
// 获取数据库中所有表的信息
var tables = db.DbMaintenance.GetTableInfoList();

foreach (var table in tables)
{
    Console.WriteLine($"表名: {table.Name}, 描述: {table.Description}");
}

// 选择性生成（只生成业务表，跳过系统表）
var businessTables = tables
    .Where(t => !t.Name.StartsWith("sys_"))
    .Select(t => t.Name)
    .ToArray();

db.DbFirst
    .Where(businessTables)
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 6.5 获取表的列信息

```csharp
// 获取指定表的列信息
var columns = db.DbMaintenance.GetColumnInfosByTableName("Student");

foreach (var col in columns)
{
    Console.WriteLine($"列名: {col.DbColumnName}");
    Console.WriteLine($"类型: {col.DataType}");
    Console.WriteLine($"长度: {col.Length}");
    Console.WriteLine($"是否主键: {col.IsPrimarykey}");
    Console.WriteLine($"是否自增: {col.IsIdentity}");
    Console.WriteLine($"是否可空: {col.IsNullable}");
    Console.WriteLine($"描述: {col.ColumnDescription}");
    Console.WriteLine("---");
}
```

---

## 7. 过滤表

### 7.1 按前缀过滤

```csharp
// 只生成以 "t_" 开头的表
db.DbFirst
    .Where(it => it.StartsWith("t_"))
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 7.2 按后缀过滤

```csharp
// 排除以 "_bak" 结尾的备份表
db.DbFirst
    .Where(it => !it.EndsWith("_bak"))
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 7.3 按关键词过滤

```csharp
// 只生成包含 "order" 关键词的表
db.DbFirst
    .Where(it => it.Contains("order", StringComparison.OrdinalIgnoreCase))
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 7.4 复杂过滤条件

```csharp
// 排除系统表和临时表
db.DbFirst
    .Where(it =>
        !it.StartsWith("sys_") &&
        !it.StartsWith("tmp_") &&
        !it.EndsWith("_log") &&
        !it.EndsWith("_bak") &&
        it != "__EFMigrationsHistory"  // 排除EF迁移表
    )
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 7.5 使用白名单或黑名单

```csharp
// 白名单方式
var whiteList = new HashSet<string> { "Student", "Teacher", "Class", "Course", "Score" };
db.DbFirst
    .Where(it => whiteList.Contains(it))
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");

// 黑名单方式
var blackList = new HashSet<string> { "sys_config", "sys_log", "sys_user" };
db.DbFirst
    .Where(it => !blackList.Contains(it))
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 7.6 按数据库对象类型过滤

```csharp
// 只生成表（不含视图）
db.DbFirst
    .Where(DbObjectType.Table)
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");

// 只生成视图
db.DbFirst
    .Where(DbObjectType.View)
    .CreateClassFile("C:\\MyProject\\Models\\Views", "MyProject.Models.Views");
```

---

## 8. 生成带导航属性的实体

### 8.1 什么是导航属性

导航属性是实体类中表示表间关系的属性，通过它可以方便地进行关联查询和级联操作。SqlSugar 支持以下几种导航关系：

| 关系类型 | 说明 | 示例 |
|----------|------|------|
| 一对多 | 一个父记录对应多个子记录 | 班级 → 学生 |
| 多对一 | 多个子记录对应一个父记录 | 学生 → 班级 |
| 一对一 | 一个记录对应一个记录 | 用户 → 用户详情 |
| 多对多 | 多个记录互相关联 | 学生 ← 中间表 → 课程 |

### 8.2 生成一对多/多对一导航属性

假设数据库中有外键关系，可以通过以下方式生成带导航属性的实体：

```csharp
db.DbFirst
    .IsCreateAttribute()
    .SettingPropertyTemplate((columns, temp, type) =>
    {
        // 默认属性模板
        var result = new List<string>();

        foreach (var col in columns)
        {
            // 标准属性
            result.Add($@"
        [SugarColumn(ColumnName = ""{col.DbColumnName}"")]
        public {col.PropertyType} {col.PropertyName} {{ get; set; }}");
        }

        return string.Join("\r\n", result);
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 8.3 手动添加导航属性

在生成基础实体类后，可以通过 `partial` 类手动添加导航属性：

```csharp
// 自动生成的基础实体类
[SugarTable("Class")]
public partial class ClassInfo
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    public string ClassName { get; set; }
}

// 手动扩展的导航属性（另一个文件中）
public partial class ClassInfo
{
    /// <summary>
    /// 班级下的学生列表（一对多）
    /// </summary>
    [Navigate(NavigateType.OneToMany, nameof(Student.ClassId))]
    public List<Student> Students { get; set; }
}

// 自动生成的学生实体
[SugarTable("Student")]
public partial class Student
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }

    public string Name { get; set; }

    public int ClassId { get; set; }
}

// 手动扩展的导航属性
public partial class Student
{
    /// <summary>
    /// 所属班级（多对一）
    /// </summary>
    [Navigate(NavigateType.ManyToOne, nameof(ClassId))]
    public ClassInfo ClassInfo { get; set; }
}
```

### 8.4 多对多导航属性

```csharp
// 学生实体
public partial class Student
{
    /// <summary>
    /// 选修的课程列表（多对多）
    /// </summary>
    [Navigate(typeof(StudentCourse), nameof(StudentCourse.StudentId), nameof(StudentCourse.CourseId))]
    public List<Course> Courses { get; set; }
}

// 课程实体
public partial class Course
{
    /// <summary>
    /// 选修该课程的学生列表（多对多）
    /// </summary>
    [Navigate(typeof(StudentCourse), nameof(StudentCourse.CourseId), nameof(StudentCourse.StudentId))]
    public List<Student> Students { get; set; }
}

// 中间表实体
[SugarTable("StudentCourse")]
public class StudentCourse
{
    [SugarColumn(IsPrimaryKey = true)]
    public int StudentId { get; set; }

    [SugarColumn(IsPrimaryKey = true)]
    public int CourseId { get; set; }
}
```

### 8.5 推荐的导航属性使用策略

> **最佳实践**：使用 DbFirst 生成基础实体类（`partial` 类），然后在单独的文件中手动添加导航属性。这样即使重新生成实体，导航属性也不会被覆盖。

```
Models/
├── Generated/           ← DbFirst 自动生成的文件（可重新生成）
│   ├── Student.cs
│   ├── ClassInfo.cs
│   └── Course.cs
├── Extensions/          ← 手动添加的导航属性（不会被覆盖）
│   ├── Student.Nav.cs
│   ├── ClassInfo.Nav.cs
│   └── Course.Nav.cs
```

---

## 9. DbFirst与CodeFirst对比

### 9.1 对比表格

| 对比维度 | DbFirst | CodeFirst |
|----------|---------|-----------|
| **起点** | 数据库表结构 | C# 实体类 |
| **方向** | 数据库 → 代码 | 代码 → 数据库 |
| **适用场景** | 已有数据库的项目 | 新项目从零开始 |
| **DBA参与** | DBA 主导设计 | 开发人员主导 |
| **表结构修改** | 修改数据库后重新生成 | 修改代码后同步数据库 |
| **版本控制** | 数据库脚本管理 | 代码管理 |
| **学习成本** | 较低 | 较低 |
| **灵活性** | 受限于数据库结构 | 高度灵活 |

### 9.2 选择建议

```
┌──────────────────────────────────────┐
│            项目情况判断               │
├──────────────────────────────────────┤
│                                      │
│  已有数据库？                         │
│  ├── 是 ──→ 使用 DbFirst             │
│  └── 否                              │
│       ├── DBA主导设计？               │
│       │   ├── 是 ──→ 使用 DbFirst     │
│       │   └── 否 ──→ 使用 CodeFirst   │
│       └── 新项目快速开发？             │
│           └── 是 ──→ 使用 CodeFirst   │
│                                      │
└──────────────────────────────────────┘
```

### 9.3 混合使用策略

在实际项目中，DbFirst 和 CodeFirst 可以混合使用：

```csharp
// 第一步：使用 DbFirst 生成已有表的实体
db.DbFirst
    .Where("ExistingTable1", "ExistingTable2")
    .IsCreateAttribute()
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");

// 第二步：新增的表使用 CodeFirst
db.CodeFirst.InitTables<NewBusinessEntity>();
```

> **提示**：在团队协作中，约定好使用哪种模式很重要，避免冲突。

---

## 10. 已有项目的实战工作流

### 10.1 第一步：分析数据库结构

在接手一个已有数据库的项目时，首先需要了解数据库中的表和结构：

```csharp
var db = new SqlSugarClient(new ConnectionConfig()
{
    ConnectionString = "你的连接字符串",
    DbType = DbType.SqlServer,
    IsAutoCloseConnection = true
});

// 获取所有表信息
var tables = db.DbMaintenance.GetTableInfoList();
Console.WriteLine($"数据库中共有 {tables.Count} 张表：");
foreach (var t in tables)
{
    Console.WriteLine($"  {t.Name} - {t.Description}");
}

// 获取所有视图
var views = db.DbMaintenance.GetViewInfoList();
Console.WriteLine($"\n数据库中共有 {views.Count} 个视图：");
foreach (var v in views)
{
    Console.WriteLine($"  {v.Name} - {v.Description}");
}
```

### 10.2 第二步：规划实体生成策略

```csharp
// 分析表的分类
var allTables = db.DbMaintenance.GetTableInfoList();

// 系统配置表
var sysTables = allTables.Where(t => t.Name.StartsWith("sys_")).ToList();
// 业务表
var bizTables = allTables.Where(t => !t.Name.StartsWith("sys_") && !t.Name.StartsWith("log_")).ToList();
// 日志表
var logTables = allTables.Where(t => t.Name.StartsWith("log_")).ToList();

Console.WriteLine($"系统表: {sysTables.Count} 张");
Console.WriteLine($"业务表: {bizTables.Count} 张");
Console.WriteLine($"日志表: {logTables.Count} 张");
```

### 10.3 第三步：分目录生成实体

```csharp
var basePath = "C:\\MyProject\\Models";

// 生成系统表实体
db.DbFirst
    .Where(sysTables.Select(t => t.Name).ToArray())
    .IsCreateAttribute()
    .CreateClassFile(Path.Combine(basePath, "System"), "MyProject.Models.System");

// 生成业务表实体
db.DbFirst
    .Where(bizTables.Select(t => t.Name).ToArray())
    .IsCreateAttribute()
    .CreateClassFile(Path.Combine(basePath, "Business"), "MyProject.Models.Business");

// 生成日志表实体
db.DbFirst
    .Where(logTables.Select(t => t.Name).ToArray())
    .IsCreateAttribute()
    .CreateClassFile(Path.Combine(basePath, "Log"), "MyProject.Models.Log");
```

### 10.4 第四步：创建 DbFirst 工具类

在实际项目中，建议封装一个 DbFirst 工具类，方便后续重新生成：

```csharp
public class DbFirstHelper
{
    private readonly ISqlSugarClient _db;
    private readonly string _basePath;
    private readonly string _baseNamespace;

    public DbFirstHelper(ISqlSugarClient db, string basePath, string baseNamespace)
    {
        _db = db;
        _basePath = basePath;
        _baseNamespace = baseNamespace;
    }

    /// <summary>
    /// 生成所有实体类
    /// </summary>
    public void GenerateAll()
    {
        _db.DbFirst
            .Where(it => !it.StartsWith("__"))  // 排除迁移表
            .IsCreateAttribute()
            .IsCreateDefaultValue()
            .SettingClassDescriptionTemplate(it =>
            {
                return $@"/// <summary>
/// {it.TableComment ?? it.TableName}
/// </summary>";
            })
            .SettingPropertyDescriptionTemplate(it =>
            {
                return $@"/// <summary>
/// {it.ColumnComment ?? it.ColumnName}
/// </summary>";
            })
            .CreateClassFile(_basePath, _baseNamespace);
    }

    /// <summary>
    /// 生成指定表的实体类
    /// </summary>
    public void GenerateByTables(params string[] tableNames)
    {
        _db.DbFirst
            .Where(tableNames)
            .IsCreateAttribute()
            .CreateClassFile(_basePath, _baseNamespace);
    }

    /// <summary>
    /// 预览生成结果（不写入文件）
    /// </summary>
    public Dictionary<string, string> Preview(params string[] tableNames)
    {
        return _db.DbFirst
            .Where(tableNames)
            .IsCreateAttribute()
            .ToClassStringList(_baseNamespace);
    }
}
```

使用方式：

```csharp
var helper = new DbFirstHelper(db, "C:\\MyProject\\Models", "MyProject.Models");

// 全量生成
helper.GenerateAll();

// 只重新生成某个表
helper.GenerateByTables("Student");

// 先预览再决定是否生成
var preview = helper.Preview("Student");
Console.WriteLine(preview["Student"]);
```

### 10.5 第五步：配置代码生成脚本

在项目中创建一个控制台项目或单元测试，用于运行 DbFirst 代码生成：

```csharp
[TestClass]
public class CodeGeneratorTests
{
    private SqlSugarClient GetDb()
    {
        return new SqlSugarClient(new ConnectionConfig()
        {
            ConnectionString = "Server=localhost;Database=MyDb;Uid=root;Pwd=123456;",
            DbType = DbType.MySql,
            IsAutoCloseConnection = true
        });
    }

    [TestMethod]
    public void GenerateAllEntities()
    {
        var db = GetDb();
        var helper = new DbFirstHelper(db, @"..\..\..\..\MyProject\Models", "MyProject.Models");
        helper.GenerateAll();
        Console.WriteLine("实体类生成完成！");
    }

    [TestMethod]
    public void GenerateSpecificTable()
    {
        var db = GetDb();
        var helper = new DbFirstHelper(db, @"..\..\..\..\MyProject\Models", "MyProject.Models");
        helper.GenerateByTables("Student", "Teacher");
        Console.WriteLine("指定表实体类生成完成！");
    }
}
```

---

## 11. 常见问题与解决方案

### 11.1 表名与类名不一致

问题：数据库表名是 `t_student`，但希望生成的类名是 `Student`。

解决方案：

```csharp
db.DbFirst
    .SettingClassTemplate(it =>
    {
        // 去掉 t_ 前缀
        if (it.ClassName.StartsWith("t_"))
        {
            it.ClassName = it.ClassName.Substring(2);
        }
        // 首字母大写
        it.ClassName = char.ToUpper(it.ClassName[0]) + it.ClassName.Substring(1);
        return null; // 使用默认模板
    })
    .IsCreateAttribute()  // 保留SugarTable特性以记录原始表名
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 11.2 列名包含特殊字符

问题：数据库列名包含空格或特殊字符（如 `user name`、`order#`）。

解决方案：

```csharp
db.DbFirst
    .SettingPropertyTemplate(it =>
    {
        // 移除特殊字符
        it.PropertyName = Regex.Replace(it.PropertyName, @"[^a-zA-Z0-9_]", "");
        return null;
    })
    .IsCreateAttribute()
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 11.3 可空类型处理

问题：某些列是可空的，但希望生成的属性不带 `?`。

解决方案：

```csharp
// 通过自定义类型映射处理
db.DbFirst
    .SettingPropertyTemplate(it =>
    {
        // 将 int? 改为 int（根据业务需要）
        if (it.PropertyType == "int?")
        {
            it.PropertyType = "int";
        }
        return null;
    })
    .CreateClassFile("C:\\MyProject\\Models", "MyProject.Models");
```

### 11.4 生成后文件编码问题

如果生成的文件中文显示乱码，可以手动控制文件编码：

```csharp
// 使用 ToClassStringList 获取内容后自行写文件
var classStringList = db.DbFirst
    .IsCreateAttribute()
    .ToClassStringList("MyProject.Models");

foreach (var item in classStringList)
{
    var filePath = Path.Combine("C:\\MyProject\\Models", $"{item.Key}.cs");
    File.WriteAllText(filePath, item.Value, Encoding.UTF8);
}
```

### 11.5 重新生成时保留自定义代码

> **最佳实践**：使用 `partial` 类分离自动生成的代码和手动编写的代码，重新生成时只覆盖自动生成的部分。

```csharp
// 自动生成的文件 Student.Generated.cs
// ⚠️ 此文件由 DbFirst 自动生成，请勿手动修改
[SugarTable("Student")]
public partial class Student
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
}

// 手动编写的文件 Student.cs（不会被覆盖）
public partial class Student
{
    // 自定义属性和方法
    [SugarColumn(IsIgnore = true)]
    public string FullName => $"{Name}";

    // 导航属性
    [Navigate(NavigateType.OneToMany, nameof(Score.StudentId))]
    public List<Score> Scores { get; set; }
}
```

---

## 12. 本章小结

本章详细介绍了 SqlSugar 的 DbFirst 数据库优先开发模式：

- **DbFirst 概念**：从已有数据库自动生成实体类的开发方式
- **基础配置**：创建连接、获取 DbFirst 对象、指定输出路径
- **实体类生成**：生成所有表、指定表的实体，数据库类型自动映射
- **特性生成**：生成带 `[SugarTable]`、`[SugarColumn]` 特性的实体
- **自定义模板**：自定义类模板、属性模板、命名转换、引用添加
- **表过滤**：按前缀、后缀、关键词、白名单/黑名单过滤
- **导航属性**：使用 `partial` 类手动添加导航属性的推荐方式
- **DbFirst vs CodeFirst**：两种模式的对比及选择建议
- **实战工作流**：分析数据库 → 规划策略 → 分目录生成 → 封装工具类 → 自动化脚本

掌握 DbFirst 后，你可以快速将已有数据库接入 SqlSugar，大幅减少手动编写实体类的工作量，提高开发效率。

---

> **下一章预告**：下一章将介绍 SqlSugar 的基础查询操作，包括条件查询、排序、分组、聚合等常用查询功能。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第04章-CodeFirst代码优先开发" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第06章-基础查询操作" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
