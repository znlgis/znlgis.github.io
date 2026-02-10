# 第14章：SQL函数与自定义函数

## 目录

1. [SQL 函数概述](#1-sql-函数概述)
2. [字符串函数](#2-字符串函数)
3. [日期时间函数](#3-日期时间函数)
4. [数值函数](#4-数值函数)
5. [类型转换函数](#5-类型转换函数)
6. [聚合函数](#6-聚合函数)
7. [空值处理函数](#7-空值处理函数)
8. [条件判断函数](#8-条件判断函数)
9. [其他常用函数](#9-其他常用函数)
10. [自定义数据库函数：SqlFuncExternal](#10-自定义数据库函数sqlfuncexternal)
11. [C# 方法映射到 SQL 函数](#11-c-方法映射到-sql-函数)
12. [原生 SQL 表达式](#12-原生-sql-表达式)
13. [函数在不同数据库中的差异](#13-函数在不同数据库中的差异)
14. [综合实战案例](#14-综合实战案例)
15. [本章小结](#15-本章小结)

---

## 1. SQL 函数概述

### 1.1 为什么需要 SQL 函数

在使用 ORM 进行数据查询时，很多时候需要在数据库端进行数据处理，而不是将所有数据取出后在应用层处理。这些操作包括字符串处理、日期计算、数值运算、类型转换等。SQL 函数可以在数据库引擎中高效地完成这些操作。

```
┌──────────────────────────────────────────────────────┐
│                    应用层 (C#)                         │
│   db.Queryable<T>()                                   │
│     .Where(t => SqlFunc.Contains(t.Name, "张"))       │
│     .Select(t => new {                                │
│         t.Name,                                       │
│         Year = SqlFunc.GetDate().Year                  │
│     })                                                │
└──────────────────┬───────────────────────────────────┘
                   │ 翻译为 SQL
                   ▼
┌──────────────────────────────────────────────────────┐
│                    数据库层                            │
│   SELECT Name, YEAR(GETDATE()) AS Year                │
│   FROM Student                                        │
│   WHERE Name LIKE '%张%'                              │
└──────────────────────────────────────────────────────┘
```

### 1.2 SqlFunc 类

`SqlFunc` 是 SqlSugar 提供的核心工具类，封装了常用的数据库函数。开发者可以在 Lambda 表达式中直接调用这些方法，SqlSugar 会自动将其翻译为对应数据库的 SQL 函数。

| 函数类别 | 主要方法 | 说明 |
|---------|---------|------|
| 字符串 | Contains、StartsWith、EndsWith、Trim 等 | 字符串处理 |
| 日期 | GetDate、AddDays、DateDiff、Year 等 | 日期时间操作 |
| 数值 | Round、Ceiling、Floor、Abs 等 | 数值运算 |
| 转换 | ToInt32、ToDecimal、ToString、ToDate 等 | 类型转换 |
| 聚合 | AggregateSum、AggregateAvg、AggregateCount 等 | 聚合统计 |
| 其他 | IsNull、IIF、MappingColumn 等 | 辅助函数 |

> **重要**：`SqlFunc` 中的方法不能在内存中执行，只能在 SqlSugar 的 Lambda 表达式中使用，用于生成 SQL。

---

## 2. 字符串函数

### 2.1 Contains —— 包含判断

`Contains` 用于判断字符串是否包含指定的子字符串，生成 `LIKE '%xxx%'` 的 SQL：

```csharp
// 方式1：直接使用 C# 的 Contains 方法
var list = db.Queryable<Student>()
    .Where(s => s.Name.Contains("张"))
    .ToList();
// SQL: WHERE Name LIKE '%张%'

// 方式2：使用 SqlFunc
var list2 = db.Queryable<Student>()
    .Where(s => SqlFunc.Contains(s.Name, "张"))
    .ToList();
// SQL: WHERE Name LIKE '%张%'
```

### 2.2 StartsWith / EndsWith —— 前缀/后缀判断

```csharp
// 以"张"开头
var list = db.Queryable<Student>()
    .Where(s => s.Name.StartsWith("张"))
    .ToList();
// SQL: WHERE Name LIKE '张%'

// 以"明"结尾
var list2 = db.Queryable<Student>()
    .Where(s => s.Name.EndsWith("明"))
    .ToList();
// SQL: WHERE Name LIKE '%明'
```

### 2.3 Trim / TrimStart / TrimEnd —— 去除空白

```csharp
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.Trim(s.Name) == "张三")
    .ToList();
// SQL Server: WHERE LTRIM(RTRIM(Name)) = '张三'
// MySQL: WHERE TRIM(Name) = '张三'

// TrimStart（去左边空白）
var list2 = db.Queryable<Student>()
    .Where(s => SqlFunc.TrimStart(s.Name) == "张三")
    .ToList();
// SQL: WHERE LTRIM(Name) = '张三'

// TrimEnd（去右边空白）
var list3 = db.Queryable<Student>()
    .Where(s => SqlFunc.TrimEnd(s.Name) == "张三")
    .ToList();
// SQL: WHERE RTRIM(Name) = '张三'
```

### 2.4 ToLower / ToUpper —— 大小写转换

```csharp
// 转小写
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.ToLower(s.Email) == "zhangsan@example.com")
    .ToList();
// SQL: WHERE LOWER(Email) = 'zhangsan@example.com'

// 转大写
var list2 = db.Queryable<Student>()
    .Select(s => new
    {
        s.Id,
        UpperName = SqlFunc.ToUpper(s.Name)
    })
    .ToList();
// SQL: SELECT Id, UPPER(Name) AS UpperName FROM Student
```

### 2.5 Replace —— 字符串替换

```csharp
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Id,
        // 将手机号中间4位替换为 ****
        MaskedPhone = SqlFunc.Replace(s.Phone, SqlFunc.Substring(s.Phone, 4, 4), "****")
    })
    .ToList();

// 简单替换
var list2 = db.Queryable<Student>()
    .Where(s => SqlFunc.Replace(s.Name, " ", "") == "张三")
    .ToList();
// SQL: WHERE REPLACE(Name, ' ', '') = '张三'
```

### 2.6 Substring —— 子字符串截取

```csharp
// Substring(字段, 起始位置, 长度)
// 注意：起始位置从 1 开始
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Id,
        FirstChar = SqlFunc.Substring(s.Name, 1, 1),       // 取第1个字符
        AreaCode = SqlFunc.Substring(s.Phone, 1, 3)         // 取前3位区号
    })
    .ToList();
// SQL: SELECT Id, SUBSTRING(Name, 1, 1) AS FirstChar, SUBSTRING(Phone, 1, 3) AS AreaCode
```

### 2.7 Length —— 字符串长度

```csharp
// 获取字符串长度
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.Length(s.Name) > 2)
    .ToList();
// SQL Server: WHERE LEN(Name) > 2
// MySQL: WHERE CHAR_LENGTH(Name) > 2

// 在 Select 中使用
var list2 = db.Queryable<Student>()
    .Select(s => new
    {
        s.Name,
        NameLength = SqlFunc.Length(s.Name)
    })
    .ToList();
```

### 2.8 字符串函数速查表

| SqlFunc 方法 | SQL Server | MySQL | 说明 |
|-------------|-----------|-------|------|
| `Contains(a, b)` | `a LIKE '%b%'` | `a LIKE '%b%'` | 包含 |
| `StartsWith(a, b)` | `a LIKE 'b%'` | `a LIKE 'b%'` | 前缀 |
| `EndsWith(a, b)` | `a LIKE '%b'` | `a LIKE '%b'` | 后缀 |
| `Trim(a)` | `LTRIM(RTRIM(a))` | `TRIM(a)` | 去空白 |
| `ToLower(a)` | `LOWER(a)` | `LOWER(a)` | 转小写 |
| `ToUpper(a)` | `UPPER(a)` | `UPPER(a)` | 转大写 |
| `Replace(a, b, c)` | `REPLACE(a, b, c)` | `REPLACE(a, b, c)` | 替换 |
| `Substring(a, n, m)` | `SUBSTRING(a, n, m)` | `SUBSTRING(a, n, m)` | 截取 |
| `Length(a)` | `LEN(a)` | `CHAR_LENGTH(a)` | 长度 |

---

## 3. 日期时间函数

### 3.1 GetDate —— 获取当前时间

```csharp
// 获取数据库服务器当前时间
var now = db.Queryable<Student>()
    .Select(s => SqlFunc.GetDate())
    .First();
// SQL Server: SELECT GETDATE()
// MySQL: SELECT NOW()

// 在条件中使用
var list = db.Queryable<Order>()
    .Where(o => o.CreateTime <= SqlFunc.GetDate())
    .ToList();
```

### 3.2 AddDays / AddMonths / AddYears —— 日期加减

```csharp
// 查询最近7天的订单
var list = db.Queryable<Order>()
    .Where(o => o.CreateTime >= SqlFunc.GetDate().AddDays(-7))
    .ToList();
// SQL Server: WHERE CreateTime >= DATEADD(DAY, -7, GETDATE())
// MySQL: WHERE CreateTime >= DATE_ADD(NOW(), INTERVAL -7 DAY)

// 查询最近3个月
var list2 = db.Queryable<Order>()
    .Where(o => o.CreateTime >= SqlFunc.GetDate().AddMonths(-3))
    .ToList();

// 查询去年同期
var list3 = db.Queryable<Order>()
    .Where(o => o.CreateTime >= SqlFunc.GetDate().AddYears(-1))
    .ToList();

// 计算到期日期
var list4 = db.Queryable<Contract>()
    .Select(c => new
    {
        c.ContractNo,
        c.SignDate,
        ExpireDate = c.SignDate.AddMonths(c.DurationMonths)
    })
    .ToList();
```

### 3.3 DateDiff —— 日期差值

```csharp
// 计算两个日期之间的天数差
var list = db.Queryable<Order>()
    .Select(o => new
    {
        o.OrderNo,
        DaysFromCreate = SqlFunc.DateDiff(DateType.Day, o.CreateTime, SqlFunc.GetDate())
    })
    .ToList();

// DateType 枚举支持的类型
// DateType.Year      —— 年差
// DateType.Month     —— 月差
// DateType.Day       —— 日差
// DateType.Hour      —— 小时差
// DateType.Minute    —— 分钟差
// DateType.Second    —— 秒差
// DateType.Weekday   —— 周差

// 查询超过30天未支付的订单
var list2 = db.Queryable<Order>()
    .Where(o => o.Status == 0)  // 待支付
    .Where(o => SqlFunc.DateDiff(DateType.Day, o.CreateTime, SqlFunc.GetDate()) > 30)
    .ToList();
```

### 3.4 Year / Month / Day —— 日期分量提取

```csharp
// 获取年份
var list = db.Queryable<Order>()
    .Where(o => o.CreateTime.Year == 2024)
    .ToList();
// SQL Server: WHERE YEAR(CreateTime) = 2024

// 获取月份
var list2 = db.Queryable<Order>()
    .Where(o => o.CreateTime.Month == 6)
    .ToList();
// SQL Server: WHERE MONTH(CreateTime) = 6

// 获取日
var list3 = db.Queryable<Order>()
    .Where(o => o.CreateTime.Day == 15)
    .ToList();

// 按年月分组统计
var stats = db.Queryable<Order>()
    .GroupBy(o => new { Year = o.CreateTime.Year, Month = o.CreateTime.Month })
    .Select(o => new
    {
        Year = o.CreateTime.Year,
        Month = o.CreateTime.Month,
        OrderCount = SqlFunc.AggregateCount(o.Id),
        TotalAmount = SqlFunc.AggregateSum(o.TotalAmount)
    })
    .OrderBy(o => o.Year)
    .OrderBy(o => o.Month)
    .ToList();
```

### 3.5 DateIsSame —— 日期比较

```csharp
// 判断是否是同一天
var todayOrders = db.Queryable<Order>()
    .Where(o => SqlFunc.DateIsSame(o.CreateTime, DateTime.Now, DateType.Day))
    .ToList();

// 判断是否是同一个月
var thisMonthOrders = db.Queryable<Order>()
    .Where(o => SqlFunc.DateIsSame(o.CreateTime, DateTime.Now, DateType.Month))
    .ToList();

// 判断是否是同一年
var thisYearOrders = db.Queryable<Order>()
    .Where(o => SqlFunc.DateIsSame(o.CreateTime, DateTime.Now, DateType.Year))
    .ToList();
```

### 3.6 日期函数速查表

| SqlFunc 方法 | SQL Server | MySQL | 说明 |
|-------------|-----------|-------|------|
| `GetDate()` | `GETDATE()` | `NOW()` | 当前时间 |
| `AddDays(n)` | `DATEADD(DAY,n,x)` | `DATE_ADD(x,INTERVAL n DAY)` | 加天 |
| `AddMonths(n)` | `DATEADD(MONTH,n,x)` | `DATE_ADD(x,INTERVAL n MONTH)` | 加月 |
| `AddYears(n)` | `DATEADD(YEAR,n,x)` | `DATE_ADD(x,INTERVAL n YEAR)` | 加年 |
| `DateDiff(type,a,b)` | `DATEDIFF(type,a,b)` | `TIMESTAMPDIFF(type,a,b)` | 日期差 |
| `.Year` | `YEAR(x)` | `YEAR(x)` | 取年 |
| `.Month` | `MONTH(x)` | `MONTH(x)` | 取月 |
| `.Day` | `DAY(x)` | `DAY(x)` | 取日 |
| `DateIsSame(a,b,type)` | 自动生成对应SQL | 自动生成对应SQL | 日期比较 |

---

## 4. 数值函数

### 4.1 Round —— 四舍五入

```csharp
// 保留2位小数
var list = db.Queryable<Order>()
    .Select(o => new
    {
        o.OrderNo,
        AvgPrice = SqlFunc.Round(o.TotalAmount / o.Quantity, 2)
    })
    .ToList();
// SQL: SELECT OrderNo, ROUND(TotalAmount / Quantity, 2) AS AvgPrice FROM Orders
```

### 4.2 Ceiling —— 向上取整

```csharp
// 向上取整（天花板值）
var list = db.Queryable<Order>()
    .Select(o => new
    {
        o.OrderNo,
        Pages = SqlFunc.Ceiling(o.TotalCount * 1.0m / 20)  // 计算总页数
    })
    .ToList();
// SQL: SELECT OrderNo, CEILING(TotalCount * 1.0 / 20) AS Pages FROM Orders
```

### 4.3 Floor —— 向下取整

```csharp
// 向下取整（地板值）
var list = db.Queryable<Product>()
    .Select(p => new
    {
        p.ProductName,
        DiscountPrice = SqlFunc.Floor(p.Price * 0.8m)  // 打8折后向下取整
    })
    .ToList();
// SQL: SELECT ProductName, FLOOR(Price * 0.8) AS DiscountPrice FROM Products
```

### 4.4 Abs —— 绝对值

```csharp
// 获取绝对值
var list = db.Queryable<Account>()
    .Where(a => SqlFunc.Abs(a.Balance) > 1000)
    .ToList();
// SQL: WHERE ABS(Balance) > 1000

// 计算两个值的差异
var list2 = db.Queryable<PriceTrend>()
    .Select(p => new
    {
        p.ProductId,
        PriceDiff = SqlFunc.Abs(p.CurrentPrice - p.LastPrice)
    })
    .ToList();
```

### 4.5 数值函数速查表

| SqlFunc 方法 | SQL Server | MySQL | 说明 |
|-------------|-----------|-------|------|
| `Round(x, n)` | `ROUND(x, n)` | `ROUND(x, n)` | 四舍五入 |
| `Ceiling(x)` | `CEILING(x)` | `CEILING(x)` | 向上取整 |
| `Floor(x)` | `FLOOR(x)` | `FLOOR(x)` | 向下取整 |
| `Abs(x)` | `ABS(x)` | `ABS(x)` | 绝对值 |

---

## 5. 类型转换函数

### 5.1 ToInt32 —— 转整数

```csharp
// 将字符串转为整数
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.ToInt32(s.StudentNo) > 1000)
    .ToList();
// SQL Server: WHERE CAST(StudentNo AS INT) > 1000
// MySQL: WHERE CAST(StudentNo AS SIGNED) > 1000
```

### 5.2 ToInt64 —— 转长整数

```csharp
var list = db.Queryable<Order>()
    .Select(o => new
    {
        o.OrderNo,
        BigNumber = SqlFunc.ToInt64(o.Amount * 100)
    })
    .ToList();
```

### 5.3 ToDecimal —— 转十进制数

```csharp
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Name,
        AvgScore = SqlFunc.ToDecimal(s.TotalScore) / s.SubjectCount
    })
    .ToList();
// SQL Server: WHERE CAST(TotalScore AS DECIMAL(18,2)) / SubjectCount
```

### 5.4 ToString —— 转字符串

```csharp
var list = db.Queryable<Order>()
    .Select(o => new
    {
        o.Id,
        AmountStr = SqlFunc.ToString(o.TotalAmount),
        IdStr = SqlFunc.ToString(o.Id)
    })
    .ToList();
// SQL Server: CAST(TotalAmount AS NVARCHAR(MAX))
```

### 5.5 ToDate / ToDateTime —— 转日期

```csharp
// 将字符串转为日期
var list = db.Queryable<ImportData>()
    .Where(d => SqlFunc.ToDate(d.DateStr) >= DateTime.Parse("2024-01-01"))
    .ToList();
```

### 5.6 ToBool —— 转布尔值

```csharp
var list = db.Queryable<Config>()
    .Select(c => new
    {
        c.Key,
        IsEnabled = SqlFunc.ToBool(c.Value)
    })
    .ToList();
```

### 5.7 类型转换速查表

| SqlFunc 方法 | SQL Server | MySQL | 说明 |
|-------------|-----------|-------|------|
| `ToInt32(x)` | `CAST(x AS INT)` | `CAST(x AS SIGNED)` | 转 int |
| `ToInt64(x)` | `CAST(x AS BIGINT)` | `CAST(x AS SIGNED)` | 转 long |
| `ToDecimal(x)` | `CAST(x AS DECIMAL)` | `CAST(x AS DECIMAL)` | 转 decimal |
| `ToString(x)` | `CAST(x AS NVARCHAR)` | `CAST(x AS CHAR)` | 转 string |
| `ToDate(x)` | `CAST(x AS DATETIME)` | `CAST(x AS DATETIME)` | 转 DateTime |
| `ToBool(x)` | `CAST(x AS BIT)` | `(x = 1)` | 转 bool |

---

## 6. 聚合函数

### 6.1 AggregateCount —— 计数

```csharp
// 基本计数
var count = db.Queryable<Student>()
    .Where(s => s.IsActive == true)
    .Count();

// 在 Select 中使用聚合计数
var stats = db.Queryable<Order>()
    .GroupBy(o => o.Status)
    .Select(o => new
    {
        Status = o.Status,
        OrderCount = SqlFunc.AggregateCount(o.Id)
    })
    .ToList();
// SQL: SELECT Status, COUNT(Id) AS OrderCount FROM Orders GROUP BY Status
```

### 6.2 AggregateSum —— 求和

```csharp
// 计算总金额
var totalAmount = db.Queryable<Order>()
    .Where(o => o.Status == 3)  // 已完成
    .Sum(o => o.TotalAmount);

// 分组求和
var salesByMonth = db.Queryable<Order>()
    .Where(o => o.CreateTime.Year == 2024)
    .GroupBy(o => o.CreateTime.Month)
    .Select(o => new
    {
        Month = o.CreateTime.Month,
        TotalAmount = SqlFunc.AggregateSum(o.TotalAmount),
        OrderCount = SqlFunc.AggregateCount(o.Id)
    })
    .OrderBy(o => o.Month)
    .ToList();
```

### 6.3 AggregateAvg —— 平均值

```csharp
// 计算平均成绩
var avgScore = db.Queryable<Student>()
    .Where(s => s.ClassId == 1)
    .Avg(s => s.Score);

// 按班级统计平均分
var classStats = db.Queryable<Student>()
    .GroupBy(s => s.ClassId)
    .Select(s => new
    {
        ClassId = s.ClassId,
        AvgScore = SqlFunc.AggregateAvg(s.Score),
        StudentCount = SqlFunc.AggregateCount(s.Id)
    })
    .Having(s => SqlFunc.AggregateAvg(s.Score) >= 60)
    .ToList();
```

### 6.4 AggregateMin / AggregateMax —— 最小值/最大值

```csharp
// 查询最高分和最低分
var stats = db.Queryable<Student>()
    .Where(s => s.ClassId == 1)
    .Select(s => new
    {
        MaxScore = SqlFunc.AggregateMax(s.Score),
        MinScore = SqlFunc.AggregateMin(s.Score),
        AvgScore = SqlFunc.AggregateAvg(s.Score)
    })
    .First();

// 查询每个商品的价格区间
var priceRanges = db.Queryable<Product>()
    .GroupBy(p => p.CategoryId)
    .Select(p => new
    {
        CategoryId = p.CategoryId,
        MinPrice = SqlFunc.AggregateMin(p.Price),
        MaxPrice = SqlFunc.AggregateMax(p.Price),
        AvgPrice = SqlFunc.AggregateAvg(p.Price)
    })
    .ToList();
```

### 6.5 AggregateDistinctCount —— 去重计数

```csharp
// 统计不重复的客户数
var distinctCustomerCount = db.Queryable<Order>()
    .Select(o => SqlFunc.AggregateDistinctCount(o.CustomerId))
    .First();
// SQL: SELECT COUNT(DISTINCT CustomerId) FROM Orders
```

### 6.6 聚合函数速查表

| SqlFunc 方法 | SQL | 说明 |
|-------------|-----|------|
| `AggregateCount(x)` | `COUNT(x)` | 计数 |
| `AggregateSum(x)` | `SUM(x)` | 求和 |
| `AggregateAvg(x)` | `AVG(x)` | 平均值 |
| `AggregateMin(x)` | `MIN(x)` | 最小值 |
| `AggregateMax(x)` | `MAX(x)` | 最大值 |
| `AggregateDistinctCount(x)` | `COUNT(DISTINCT x)` | 去重计数 |

---

## 7. 空值处理函数

### 7.1 IsNull —— 空值替换

`SqlFunc.IsNull` 用于将 NULL 值替换为指定的默认值：

```csharp
// 如果 Score 为 NULL，返回 0
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Name,
        Score = SqlFunc.IsNull(s.Score, 0)
    })
    .ToList();
// SQL Server: SELECT Name, ISNULL(Score, 0) AS Score FROM Student
// MySQL: SELECT Name, IFNULL(Score, 0) AS Score FROM Student

// 多字段空值处理
var list2 = db.Queryable<Student>()
    .Select(s => new
    {
        s.Id,
        Name = SqlFunc.IsNull(s.NickName, s.Name),          // NickName为空则用Name
        Phone = SqlFunc.IsNull(s.Phone, "未填写"),
        Email = SqlFunc.IsNull(s.Email, "未填写"),
        Score = SqlFunc.IsNull(s.Score, 0)
    })
    .ToList();
```

### 7.2 IsNullOrEmpty —— 判断空值或空字符串

```csharp
// 判断是否为 NULL 或空字符串
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.IsNullOrEmpty(s.Email))
    .ToList();
// SQL Server: WHERE (Email IS NULL OR Email = '')
```

### 7.3 HasValue —— 判断有值

```csharp
// 判断字段是否有值（非 NULL 且非空）
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.HasValue(s.Phone))
    .ToList();
// SQL: WHERE (Phone IS NOT NULL AND Phone <> '')
```

### 7.4 在条件中处理 NULL

```csharp
// 空值安全的比较
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.IsNull(s.Score, 0) >= 60)
    .ToList();

// 排序时处理 NULL（NULL 值排在最后）
var list2 = db.Queryable<Student>()
    .OrderBy(s => SqlFunc.IsNull(s.Score, 0), OrderByType.Desc)
    .ToList();
```

---

## 8. 条件判断函数

### 8.1 IIF —— 简单条件判断

`SqlFunc.IIF` 类似于 SQL 的 `CASE WHEN` 或三元运算符：

```csharp
// 简单条件：如果 Score >= 60 则"及格"，否则"不及格"
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Name,
        s.Score,
        Result = SqlFunc.IIF(s.Score >= 60, "及格", "不及格")
    })
    .ToList();
// SQL: SELECT Name, Score, (CASE WHEN Score >= 60 THEN '及格' ELSE '不及格' END) AS Result
```

### 8.2 嵌套 IIF —— 多条件判断

```csharp
// 多级条件判断（成绩等级）
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Name,
        s.Score,
        Level = SqlFunc.IIF(s.Score >= 90, "优秀",
                SqlFunc.IIF(s.Score >= 80, "良好",
                SqlFunc.IIF(s.Score >= 70, "中等",
                SqlFunc.IIF(s.Score >= 60, "及格", "不及格"))))
    })
    .ToList();

// 订单状态文本转换
var orders = db.Queryable<Order>()
    .Select(o => new
    {
        o.OrderNo,
        StatusText = SqlFunc.IIF(o.Status == 0, "待支付",
                     SqlFunc.IIF(o.Status == 1, "已支付",
                     SqlFunc.IIF(o.Status == 2, "已发货",
                     SqlFunc.IIF(o.Status == 3, "已完成", "已取消"))))
    })
    .ToList();
```

### 8.3 IIF 在 Where 中使用

```csharp
// 条件性排序：VIP 客户优先
var list = db.Queryable<Customer>()
    .OrderBy(c => SqlFunc.IIF(c.IsVip == true, 0, 1))
    .OrderBy(c => c.CreateTime, OrderByType.Desc)
    .ToList();

// 条件性计数
var stats = db.Queryable<Order>()
    .Select(o => new
    {
        TotalCount = SqlFunc.AggregateCount(o.Id),
        PaidCount = SqlFunc.AggregateSum(SqlFunc.IIF(o.Status >= 1, 1, 0)),
        UnpaidCount = SqlFunc.AggregateSum(SqlFunc.IIF(o.Status == 0, 1, 0))
    })
    .First();
```

---

## 9. 其他常用函数

### 9.1 MappingColumn —— 字段映射

用于在多表查询中指定列的归属：

```csharp
var list = db.Queryable<Student, Class>((s, c) => s.ClassId == c.Id)
    .Select((s, c) => new
    {
        StudentName = s.Name,
        ClassName = c.Name,
        ClassId = SqlFunc.MappingColumn(s.ClassId, "s.ClassId")
    })
    .ToList();
```

### 9.2 RowNumber —— 行号

```csharp
// 按班级分组编号
var list = db.Queryable<Student>()
    .Select(s => new
    {
        RowNum = SqlFunc.RowNumber(s.Id),
        s.Name,
        s.ClassId
    })
    .ToList();

// 使用分区行号
var list2 = db.Queryable<Student>()
    .Select(s => new
    {
        RowNum = SqlFunc.RowNumber(
            SqlFunc.MappingColumn<int>(default, "ClassId"),  // PARTITION BY
            SqlFunc.MappingColumn<int>(default, "Score DESC") // ORDER BY
        ),
        s.Name,
        s.ClassId,
        s.Score
    })
    .ToList();
```

### 9.3 Between —— 范围判断

```csharp
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.Between(s.Age, 18, 25))
    .ToList();
// SQL: WHERE Age BETWEEN 18 AND 25
```

### 9.4 Equals —— 等值比较

```csharp
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.Equals(s.Name, "张三"))
    .ToList();
// SQL: WHERE Name = '张三'
```

---

## 10. 自定义数据库函数：SqlFuncExternal

### 10.1 概述

当 `SqlFunc` 内置函数不能满足需求时，可以使用 `SqlFuncExternal` 自定义映射 C# 方法到 SQL 函数。

### 10.2 定义自定义函数

```csharp
// 步骤1：定义 C# 方法（只做标记，不需要真正实现）
public static class MyDbFunc
{
    /// <summary>
    /// 自定义：JSON 值提取（SQL Server）
    /// </summary>
    [SugarFunction("JSON_VALUE({0}, {1})")]
    public static string JsonValue(string column, string path)
    {
        throw new NotSupportedException("此方法仅用于生成 SQL");
    }

    /// <summary>
    /// 自定义：字符串拼接
    /// </summary>
    [SugarFunction("CONCAT({0}, {1}, {2})")]
    public static string Concat3(string a, string b, string c)
    {
        throw new NotSupportedException("此方法仅用于生成 SQL");
    }

    /// <summary>
    /// 自定义：格式化日期
    /// </summary>
    [SugarFunction("FORMAT({0}, {1})")]
    public static string FormatDate(DateTime date, string format)
    {
        throw new NotSupportedException("此方法仅用于生成 SQL");
    }
}
```

### 10.3 使用自定义函数

```csharp
// 使用 JSON 函数
var list = db.Queryable<Order>()
    .Where(o => MyDbFunc.JsonValue(o.ExtData, "$.address.city") == "北京")
    .ToList();
// SQL: WHERE JSON_VALUE(ExtData, '$.address.city') = '北京'

// 使用字符串拼接
var list2 = db.Queryable<Student>()
    .Select(s => new
    {
        FullInfo = MyDbFunc.Concat3(s.Name, " - ", s.ClassName)
    })
    .ToList();
// SQL: SELECT CONCAT(Name, ' - ', ClassName) AS FullInfo FROM Student
```

### 10.4 多数据库兼容的自定义函数

```csharp
// 通过配置实现多数据库兼容
public static class DbFuncExtensions
{
    public static void ConfigCustomFunctions(ISqlSugarClient db)
    {
        db.CurrentConnectionConfig.ConfigureExternalServices = new ConfigureExternalServices
        {
            SqlFuncServices = new List<SqlFuncExternal>
            {
                new SqlFuncExternal
                {
                    UniqueMethodName = "MyJsonValue",
                    MethodValue = (methodInfo, values, dbType) =>
                    {
                        // 根据不同数据库生成不同 SQL
                        return dbType switch
                        {
                            DbType.SqlServer => $"JSON_VALUE({values[0]}, {values[1]})",
                            DbType.MySql => $"JSON_EXTRACT({values[0]}, {values[1]})",
                            DbType.PostgreSQL => $"{values[0]}::json->>{values[1]}",
                            _ => throw new NotSupportedException($"不支持的数据库类型：{dbType}")
                        };
                    }
                },
                new SqlFuncExternal
                {
                    UniqueMethodName = "MyDateFormat",
                    MethodValue = (methodInfo, values, dbType) =>
                    {
                        return dbType switch
                        {
                            DbType.SqlServer => $"FORMAT({values[0]}, {values[1]})",
                            DbType.MySql => $"DATE_FORMAT({values[0]}, {values[1]})",
                            DbType.PostgreSQL => $"TO_CHAR({values[0]}, {values[1]})",
                            _ => $"CAST({values[0]} AS VARCHAR)"
                        };
                    }
                }
            }
        };
    }
}
```

### 10.5 注册和使用

```csharp
// 在初始化时注册
var db = new SqlSugarClient(new ConnectionConfig
{
    ConnectionString = "...",
    DbType = DbType.SqlServer,
    IsAutoCloseConnection = true,
    ConfigureExternalServices = new ConfigureExternalServices
    {
        SqlFuncServices = new List<SqlFuncExternal>
        {
            new SqlFuncExternal
            {
                UniqueMethodName = "MyLeft",
                MethodValue = (methodInfo, values, dbType) =>
                {
                    return $"LEFT({values[0]}, {values[1]})";
                }
            },
            new SqlFuncExternal
            {
                UniqueMethodName = "MyRight",
                MethodValue = (methodInfo, values, dbType) =>
                {
                    return $"RIGHT({values[0]}, {values[1]})";
                }
            }
        }
    }
});

// C# 标记方法
public static class MyStringFunc
{
    [SugarFunction("MyLeft")]
    public static string Left(string str, int length) => throw new NotSupportedException();

    [SugarFunction("MyRight")]
    public static string Right(string str, int length) => throw new NotSupportedException();
}

// 使用
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Name,
        FirstChar = MyStringFunc.Left(s.Name, 1),
        LastTwo = MyStringFunc.Right(s.Phone, 4)
    })
    .ToList();
// SQL: SELECT Name, LEFT(Name, 1) AS FirstChar, RIGHT(Phone, 4) AS LastTwo
```

---

## 11. C# 方法映射到 SQL 函数

### 11.1 默认支持的 C# 方法映射

SqlSugar 默认支持一些 C# 方法直接映射到 SQL 函数：

```csharp
// string.Contains -> LIKE '%x%'
.Where(s => s.Name.Contains("张"))

// string.StartsWith -> LIKE 'x%'
.Where(s => s.Name.StartsWith("张"))

// string.EndsWith -> LIKE '%x'
.Where(s => s.Name.EndsWith("明"))

// string.ToLower -> LOWER()
.Where(s => s.Name.ToLower() == "test")

// string.ToUpper -> UPPER()
.Where(s => s.Name.ToUpper() == "TEST")

// string.Trim -> LTRIM(RTRIM())
.Where(s => s.Name.Trim() == "张三")

// string.Length -> LEN() / CHAR_LENGTH()
.Where(s => s.Name.Length > 2)

// DateTime.Year -> YEAR()
.Where(s => s.CreateTime.Year == 2024)

// DateTime.Month -> MONTH()
.Where(s => s.CreateTime.Month == 6)

// DateTime.AddDays -> DATEADD
.Where(s => s.CreateTime.AddDays(7) >= DateTime.Now)
```

### 11.2 List.Contains 映射 IN

```csharp
var ids = new List<int> { 1, 2, 3, 4, 5 };
var list = db.Queryable<Student>()
    .Where(s => ids.Contains(s.Id))
    .ToList();
// SQL: WHERE Id IN (1, 2, 3, 4, 5)

var names = new List<string> { "张三", "李四", "王五" };
var list2 = db.Queryable<Student>()
    .Where(s => names.Contains(s.Name))
    .ToList();
// SQL: WHERE Name IN ('张三', '李四', '王五')
```

### 11.3 数学运算映射

```csharp
// 四则运算直接映射
var list = db.Queryable<Product>()
    .Where(p => p.Price * p.Quantity > 1000)
    .Select(p => new
    {
        p.ProductName,
        TotalPrice = p.Price * p.Quantity,
        DiscountPrice = p.Price * 0.9m,
        Tax = p.Price * p.Quantity * 0.13m
    })
    .ToList();
// SQL: WHERE Price * Quantity > 1000
// SELECT ProductName, Price * Quantity AS TotalPrice, ...
```

---

## 12. 原生 SQL 表达式

### 12.1 SqlFunc.MappingColumn —— 嵌入原生 SQL

当内置函数和自定义函数都无法满足需求时，可以在 LINQ 中嵌入原生 SQL 片段：

```csharp
// 在 Select 中使用原生 SQL
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Name,
        // 使用原生 SQL 表达式
        Rank = SqlFunc.MappingColumn<int>(
            default,
            "ROW_NUMBER() OVER(PARTITION BY ClassId ORDER BY Score DESC)")
    })
    .ToList();
```

### 12.2 SelectStringJoin —— 原生 SQL 片段

```csharp
var list = db.Queryable<Student>()
    .Select(s => new
    {
        s.Id,
        s.Name,
        // 嵌入原生 SQL
        CustomField = SqlFunc.MappingColumn<string>(
            default,
            "CASE WHEN Score >= 90 THEN 'A' WHEN Score >= 80 THEN 'B' WHEN Score >= 70 THEN 'C' ELSE 'D' END")
    })
    .ToList();
```

### 12.3 AddParameters —— 原生 SQL 带参数

```csharp
// 使用原生 SQL 条件（参数化，防 SQL 注入）
var list = db.Queryable<Student>()
    .Where("Name LIKE @name AND Age > @age",
        new { name = "%张%", age = 18 })
    .ToList();

// 原生 SQL + LINQ 混合
var list2 = db.Queryable<Student>()
    .Where(s => s.IsActive == true)
    .Where("Score BETWEEN @min AND @max",
        new { min = 60, max = 100 })
    .OrderBy(s => s.Score, OrderByType.Desc)
    .ToList();
```

### 12.4 使用 Sql.Raw

```csharp
// 原生 SQL 片段
var list = db.Queryable<Order>()
    .Select(o => new
    {
        o.OrderNo,
        o.TotalAmount,
        // 使用子查询
        CustomerName = SqlFunc.Subqueryable<Customer>()
            .Where(c => c.Id == o.CustomerId)
            .Select(c => c.Name)
    })
    .ToList();
```

---

## 13. 函数在不同数据库中的差异

### 13.1 SqlSugar 的数据库适配

SqlSugar 会自动将 `SqlFunc` 方法翻译为对应数据库的 SQL 函数。开发者只需要使用统一的 `SqlFunc` API，无需关心底层差异：

```csharp
// 同一段代码，在不同数据库上生成不同 SQL
var list = db.Queryable<Student>()
    .Where(s => SqlFunc.IsNull(s.Score, 0) >= 60)
    .Select(s => new
    {
        s.Name,
        Score = SqlFunc.IsNull(s.Score, 0),
        CreateDate = s.CreateTime.ToString("yyyy-MM-dd")
    })
    .ToList();
```

| 功能 | SQL Server | MySQL | PostgreSQL | Oracle | SQLite |
|------|-----------|-------|-----------|--------|--------|
| NULL 替换 | `ISNULL` | `IFNULL` | `COALESCE` | `NVL` | `IFNULL` |
| 当前时间 | `GETDATE()` | `NOW()` | `NOW()` | `SYSDATE` | `datetime('now')` |
| 字符串长度 | `LEN()` | `CHAR_LENGTH()` | `LENGTH()` | `LENGTH()` | `LENGTH()` |
| 类型转换 | `CAST/CONVERT` | `CAST` | `CAST` | `TO_NUMBER/TO_CHAR` | `CAST` |

### 13.2 数据库特有函数

如果需要使用某个数据库特有的函数，推荐使用 `SqlFuncExternal`：

```csharp
// SQL Server 特有：STRING_AGG
new SqlFuncExternal
{
    UniqueMethodName = "StringAgg",
    MethodValue = (methodInfo, values, dbType) =>
    {
        return dbType switch
        {
            DbType.SqlServer => $"STRING_AGG({values[0]}, {values[1]})",
            DbType.MySql => $"GROUP_CONCAT({values[0]} SEPARATOR {values[1]})",
            DbType.PostgreSQL => $"STRING_AGG({values[0]}, {values[1]})",
            _ => throw new NotSupportedException()
        };
    }
}
```

---

## 14. 综合实战案例

### 14.1 销售报表统计

```csharp
public class SalesReportService
{
    private readonly ISqlSugarClient _db;

    public SalesReportService(ISqlSugarClient db) => _db = db;

    /// <summary>
    /// 月度销售报表
    /// </summary>
    public async Task<List<MonthlySalesReport>> GetMonthlySalesReport(int year)
    {
        return await _db.Queryable<Order>()
            .Where(o => o.CreateTime.Year == year)
            .Where(o => o.Status == 3)  // 已完成订单
            .GroupBy(o => o.CreateTime.Month)
            .Select(o => new MonthlySalesReport
            {
                Month = o.CreateTime.Month,
                OrderCount = SqlFunc.AggregateCount(o.Id),
                TotalAmount = SqlFunc.AggregateSum(o.TotalAmount),
                AvgOrderAmount = SqlFunc.Round(SqlFunc.AggregateAvg(o.TotalAmount), 2),
                MaxOrderAmount = SqlFunc.AggregateMax(o.TotalAmount),
                MinOrderAmount = SqlFunc.AggregateMin(o.TotalAmount),
                CustomerCount = SqlFunc.AggregateDistinctCount(o.CustomerId)
            })
            .OrderBy(o => o.Month)
            .ToListAsync();
    }

    /// <summary>
    /// 商品销售排行
    /// </summary>
    public async Task<List<ProductSalesRank>> GetProductSalesRank(
        DateTime startDate, DateTime endDate, int top = 10)
    {
        return await _db.Queryable<OrderDetail, Product>(
            (d, p) => d.ProductId == p.Id)
            .LeftJoin<Order>((d, p, o) => d.OrderId == o.Id)
            .Where((d, p, o) => o.CreateTime >= startDate && o.CreateTime < endDate)
            .Where((d, p, o) => o.Status == 3)
            .GroupBy((d, p, o) => new { p.Id, p.ProductName })
            .Select((d, p, o) => new ProductSalesRank
            {
                ProductId = p.Id,
                ProductName = p.ProductName,
                SalesCount = SqlFunc.AggregateSum(d.Quantity),
                SalesAmount = SqlFunc.AggregateSum(d.Quantity * d.UnitPrice),
                AvgPrice = SqlFunc.Round(
                    SqlFunc.AggregateSum(d.Quantity * d.UnitPrice) /
                    SqlFunc.AggregateSum(d.Quantity), 2)
            })
            .OrderBy(r => r.SalesAmount, OrderByType.Desc)
            .Take(top)
            .ToListAsync();
    }
}
```

### 14.2 数据清洗与转换

```csharp
public class DataCleanService
{
    private readonly ISqlSugarClient _db;

    public DataCleanService(ISqlSugarClient db) => _db = db;

    /// <summary>
    /// 清洗和标准化客户数据
    /// </summary>
    public async Task<List<CleanedCustomer>> CleanCustomerData()
    {
        return await _db.Queryable<Customer>()
            .Select(c => new CleanedCustomer
            {
                Id = c.Id,
                // 去除首尾空格
                Name = SqlFunc.Trim(c.Name),
                // 邮箱统一小写
                Email = SqlFunc.ToLower(SqlFunc.Trim(c.Email)),
                // 手机号脱敏
                MaskedPhone = SqlFunc.IIF(
                    SqlFunc.HasValue(c.Phone),
                    SqlFunc.Concat(
                        SqlFunc.Substring(c.Phone, 1, 3),
                        "****",
                        SqlFunc.Substring(c.Phone, 8, 4)),
                    "未设置"),
                // 注册天数
                RegisterDays = SqlFunc.DateDiff(DateType.Day, c.CreateTime, SqlFunc.GetDate()),
                // 客户等级
                Level = SqlFunc.IIF(c.TotalSpend >= 100000, "钻石",
                        SqlFunc.IIF(c.TotalSpend >= 50000, "金牌",
                        SqlFunc.IIF(c.TotalSpend >= 10000, "银牌", "普通"))),
                // 空值处理
                Address = SqlFunc.IsNull(c.Address, "未填写"),
                Remark = SqlFunc.IsNull(c.Remark, "")
            })
            .ToListAsync();
    }
}
```

### 14.3 复杂统计分析

```csharp
/// <summary>
/// 客户 RFM 分析
/// R - 最近一次消费时间（Recency）
/// F - 消费频率（Frequency）
/// M - 消费金额（Monetary）
/// </summary>
public async Task<List<RfmAnalysis>> GetRfmAnalysis()
{
    return await _db.Queryable<Order>()
        .Where(o => o.Status == 3)
        .GroupBy(o => o.CustomerId)
        .Select(o => new RfmAnalysis
        {
            CustomerId = o.CustomerId,
            // R：最近消费距今天数
            LastOrderDays = SqlFunc.DateDiff(
                DateType.Day,
                SqlFunc.AggregateMax(o.CreateTime),
                SqlFunc.GetDate()),
            // F：消费次数
            OrderCount = SqlFunc.AggregateCount(o.Id),
            // M：总消费金额
            TotalAmount = SqlFunc.AggregateSum(o.TotalAmount),
            // 平均客单价
            AvgOrderAmount = SqlFunc.Round(SqlFunc.AggregateAvg(o.TotalAmount), 2),
            // 首次消费时间
            FirstOrderDate = SqlFunc.AggregateMin(o.CreateTime),
            // 最后消费时间
            LastOrderDate = SqlFunc.AggregateMax(o.CreateTime),
            // 客户生命周期天数
            LifecycleDays = SqlFunc.DateDiff(
                DateType.Day,
                SqlFunc.AggregateMin(o.CreateTime),
                SqlFunc.AggregateMax(o.CreateTime))
        })
        .Having(o => SqlFunc.AggregateCount(o.Id) >= 2)
        .OrderBy(o => o.TotalAmount, OrderByType.Desc)
        .ToListAsync();
}
```

---

## 15. 本章小结

本章全面介绍了 SqlSugar 的 SQL 函数与自定义函数：

- **字符串函数**：Contains、StartsWith、EndsWith、Trim、ToLower、ToUpper、Replace、Substring、Length
- **日期时间函数**：GetDate、AddDays、AddMonths、DateDiff、DateIsSame、Year/Month/Day
- **数值函数**：Round、Ceiling、Floor、Abs
- **类型转换函数**：ToInt32、ToInt64、ToDecimal、ToString、ToDate、ToBool
- **聚合函数**：AggregateCount、AggregateSum、AggregateAvg、AggregateMin、AggregateMax、AggregateDistinctCount
- **空值处理**：IsNull、IsNullOrEmpty、HasValue
- **条件判断**：IIF 和嵌套 IIF
- **自定义函数**：使用 `SqlFuncExternal` 和 `[SugarFunction]` 特性定义自定义数据库函数
- **C# 方法映射**：string.Contains、List.Contains、DateTime 属性等自动映射
- **原生 SQL 表达式**：在 LINQ 中嵌入原生 SQL 片段
- **跨数据库兼容**：SqlSugar 自动适配不同数据库的函数差异
- **综合实战**：销售报表、数据清洗、RFM 客户分析

熟练掌握 SQL 函数是编写高效数据库查询的关键，合理使用数据库函数可以将计算推到数据库层，减少数据传输量，提升应用性能。

---

> **下一章预告**：下一章将介绍 SqlSugar 的多租户与分库分表，包括多租户架构设计、数据隔离策略、分表配置与查询等内容。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第13章-分页与动态表达式" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第15章-多租户与分库分表" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
