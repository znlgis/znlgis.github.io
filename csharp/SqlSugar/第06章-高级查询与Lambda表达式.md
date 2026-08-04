---
layout: default
title: 第六章：高级查询与Lambda表达式
---

# 第六章：高级查询与Lambda表达式

## 目录

- [6.1 Lambda表达式基础](#61-lambda表达式基础)
  - [6.1.1 Lambda表达式语法](#611-lambda表达式语法)
  - [6.1.2 表达式树](#612-表达式树)
- [6.2 复杂条件查询](#62-复杂条件查询)
  - [6.2.1 多条件组合](#621-多条件组合)
  - [6.2.2 OR条件](#622-or条件)
  - [6.2.3 动态条件构建](#623-动态条件构建)
- [6.3 动态查询](#63-动态查询)
  - [6.3.1 表达式拼接](#631-表达式拼接)
  - [6.3.2 条件构建器](#632-条件构建器)
- [6.4 Select投影](#64-select投影)
  - [6.4.1 匿名类型投影](#641-匿名类型投影)
  - [6.4.2 DTO投影](#642-dto投影)
  - [6.4.3 动态字段选择](#643-动态字段选择)
- [6.5 Join操作](#65-join操作)
  - [6.5.1 内连接](#651-内连接)
  - [6.5.2 左连接](#652-左连接)
  - [6.5.3 右连接](#653-右连接)
  - [6.5.4 多表连接](#654-多表连接)
- [6.6 分组与聚合](#66-分组与聚合)
  - [6.6.1 GroupBy分组](#661-groupby分组)
  - [6.6.2 Having条件](#662-having条件)
  - [6.6.3 聚合函数](#663-聚合函数)
- [6.7 去重与合并](#67-去重与合并)
  - [6.7.1 Distinct去重](#671-distinct去重)
  - [6.7.2 Union合并](#672-union合并)
- [6.8 子查询](#68-子查询)
  - [6.8.1 标量子查询](#681-标量子查询)
  - [6.8.2 IN子查询](#682-in子查询)
  - [6.8.3 EXISTS子查询](#683-exists子查询)
- [6.9 最佳实践](#69-最佳实践)
- [本章小结](#本章小结)

## 6.1 Lambda表达式基础

### 6.1.1 Lambda表达式语法

Lambda表达式是SqlSugar查询的核心,提供了类型安全和智能提示:

```csharp
public class LambdaBasics
{
    private readonly SqlSugarClient _db;

    public LambdaBasics(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础Lambda表达式
    public List<User> BasicLambda()
    {
        // 单个参数
        return _db.Queryable<User>()
            .Where(u => u.Age > 18)
            .ToList();
    }

    // 多个条件
    public List<User> MultipleConditions()
    {
        return _db.Queryable<User>()
            .Where(u => u.Age > 18 && u.Age < 60)
            .Where(u => u.Status == 1)
            .ToList();
    }

    // 字符串操作
    public List<User> StringOperations()
    {
        return _db.Queryable<User>()
            .Where(u => u.Name.Contains("张"))
            .Where(u => u.Email.StartsWith("test"))
            .Where(u => u.Email.EndsWith("@test.com"))
            .ToList();
    }

    // 数值比较
    public List<User> NumericComparisons()
    {
        return _db.Queryable<User>()
            .Where(u => u.Age >= 18)
            .Where(u => u.Age <= 60)
            .Where(u => u.Status != 0)
            .ToList();
    }

    // 日期比较
    public List<User> DateComparisons()
    {
        var today = DateTime.Today;
        var lastMonth = today.AddMonths(-1);

        return _db.Queryable<User>()
            .Where(u => u.CreateTime >= lastMonth)
            .Where(u => u.CreateTime < today)
            .ToList();
    }

    // 集合操作
    public List<User> CollectionOperations()
    {
        var ids = new List<int> { 1, 2, 3, 4, 5 };
        var statuses = new[] { 1, 2 };

        return _db.Queryable<User>()
            .Where(u => ids.Contains(u.Id))
            .Where(u => statuses.Contains(u.Status))
            .ToList();
    }
}
```

### 6.1.2 表达式树

理解和使用表达式树:

```csharp
public class ExpressionTreeExample
{
    private readonly SqlSugarClient _db;

    public ExpressionTreeExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 动态构建表达式
    public List<User> DynamicExpression(string fieldName, object value)
    {
        var parameter = Expression.Parameter(typeof(User), "u");
        var property = Expression.Property(parameter, fieldName);
        var constant = Expression.Constant(value);
        var equal = Expression.Equal(property, constant);
        var lambda = Expression.Lambda<Func<User, bool>>(equal, parameter);

        return _db.Queryable<User>()
            .Where(lambda)
            .ToList();
    }

    // 组合表达式
    public List<User> CombineExpressions()
    {
        Expression<Func<User, bool>> expr1 = u => u.Age > 18;
        Expression<Func<User, bool>> expr2 = u => u.Status == 1;

        return _db.Queryable<User>()
            .Where(expr1)
            .Where(expr2)
            .ToList();
    }

    // 可重用的表达式
    private Expression<Func<User, bool>> ActiveUserExpression()
    {
        return u => u.Status == 1 && u.IsDeleted == false;
    }

    public List<User> GetActiveUsers()
    {
        return _db.Queryable<User>()
            .Where(ActiveUserExpression())
            .ToList();
    }
}
```

## 6.2 复杂条件查询

### 6.2.1 多条件组合

组合多个查询条件:

```csharp
public class ComplexConditions
{
    private readonly SqlSugarClient _db;

    public ComplexConditions(SqlSugarClient db)
    {
        _db = db;
    }

    // AND条件组合
    public List<User> AndConditions()
    {
        return _db.Queryable<User>()
            .Where(u => u.Age > 18 && u.Age < 60)
            .Where(u => u.Status == 1 && u.IsDeleted == false)
            .Where(u => u.Name.Contains("张") && u.Email.Contains("@test.com"))
            .ToList();
    }

    // 复杂条件嵌套
    public List<User> NestedConditions()
    {
        return _db.Queryable<User>()
            .Where(u => (u.Age > 18 && u.Age < 30) || (u.Age > 40 && u.Age < 60))
            .Where(u => u.Status == 1)
            .ToList();
    }

    // 多字段OR查询
    public List<User> MultiFieldSearch(string keyword)
    {
        return _db.Queryable<User>()
            .Where(u => u.Name.Contains(keyword) || 
                       u.Email.Contains(keyword) || 
                       u.Phone.Contains(keyword))
            .ToList();
    }
}
```

### 6.2.2 OR条件

使用OR条件进行查询:

```csharp
public class OrConditions
{
    private readonly SqlSugarClient _db;

    public OrConditions(SqlSugarClient db)
    {
        _db = db;
    }

    // 简单OR条件
    public List<User> SimpleOr()
    {
        return _db.Queryable<User>()
            .Where(u => u.Age < 18 || u.Age > 60)
            .ToList();
    }

    // 复杂OR条件
    public List<User> ComplexOr()
    {
        return _db.Queryable<User>()
            .Where(u => (u.Status == 1 && u.Age > 18) || 
                       (u.Status == 2 && u.Age > 16))
            .ToList();
    }

    // 使用WhereOr
    public List<User> UseWhereOr(List<int> ids, string name)
    {
        return _db.Queryable<User>()
            .Where(u => ids.Contains(u.Id))
            .Or()
            .Where(u => u.Name == name)
            .ToList();
    }
}
```

### 6.2.3 动态条件构建

根据运行时条件动态构建查询:

```csharp
public class DynamicConditionBuilder
{
    private readonly SqlSugarClient _db;

    public DynamicConditionBuilder(SqlSugarClient db)
    {
        _db = db;
    }

    // 使用WhereIF动态添加条件
    public List<User> SearchUsers(UserSearchDto dto)
    {
        return _db.Queryable<User>()
            .WhereIF(!string.IsNullOrEmpty(dto.Name), u => u.Name.Contains(dto.Name))
            .WhereIF(dto.MinAge.HasValue, u => u.Age >= dto.MinAge.Value)
            .WhereIF(dto.MaxAge.HasValue, u => u.Age <= dto.MaxAge.Value)
            .WhereIF(dto.Status.HasValue, u => u.Status == dto.Status.Value)
            .WhereIF(dto.StartDate.HasValue, u => u.CreateTime >= dto.StartDate.Value)
            .WhereIF(dto.EndDate.HasValue, u => u.CreateTime < dto.EndDate.Value)
            .ToList();
    }

    // 使用Expressionable动态构建
    public List<User> AdvancedDynamicQuery(UserSearchDto dto)
    {
        var exp = Expressionable.Create<User>();

        if (!string.IsNullOrEmpty(dto.Name))
        {
            exp.And(u => u.Name.Contains(dto.Name));
        }

        if (dto.MinAge.HasValue && dto.MaxAge.HasValue)
        {
            exp.And(u => u.Age >= dto.MinAge.Value && u.Age <= dto.MaxAge.Value);
        }
        else if (dto.MinAge.HasValue)
        {
            exp.And(u => u.Age >= dto.MinAge.Value);
        }
        else if (dto.MaxAge.HasValue)
        {
            exp.And(u => u.Age <= dto.MaxAge.Value);
        }

        if (dto.Keywords != null && dto.Keywords.Any())
        {
            var orExp = Expressionable.Create<User>();
            foreach (var keyword in dto.Keywords)
            {
                orExp.Or(u => u.Name.Contains(keyword));
            }
            exp.And(orExp.ToExpression());
        }

        return _db.Queryable<User>()
            .Where(exp.ToExpression())
            .ToList();
    }
}

public class UserSearchDto
{
    public string Name { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public int? Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<string> Keywords { get; set; }
}
```

## 6.3 动态查询

### 6.3.1 表达式拼接

动态拼接查询表达式:

```csharp
public class ExpressionCombination
{
    private readonly SqlSugarClient _db;

    public ExpressionCombination(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础表达式拼接
    public List<User> CombineExpressions(bool includeAge, bool includeStatus)
    {
        var query = _db.Queryable<User>();

        if (includeAge)
        {
            query = query.Where(u => u.Age > 18);
        }

        if (includeStatus)
        {
            query = query.Where(u => u.Status == 1);
        }

        return query.ToList();
    }

    // 使用PredicateBuilder
    public List<User> UsePredicateBuilder(List<string> names, List<int> ages)
    {
        var predicate = PredicateBuilder.False<User>();

        foreach (var name in names)
        {
            var temp = name;
            predicate = predicate.Or(u => u.Name == temp);
        }

        foreach (var age in ages)
        {
            var temp = age;
            predicate = predicate.Or(u => u.Age == temp);
        }

        return _db.Queryable<User>()
            .Where(predicate)
            .ToList();
    }
}

// PredicateBuilder辅助类
public static class PredicateBuilder
{
    public static Expression<Func<T, bool>> True<T>() => f => true;
    public static Expression<Func<T, bool>> False<T>() => f => false;

    public static Expression<Func<T, bool>> Or<T>(
        this Expression<Func<T, bool>> expr1,
        Expression<Func<T, bool>> expr2)
    {
        var parameter = Expression.Parameter(typeof(T));
        var combined = new ParameterReplaceVisitor(parameter)
            .Visit(Expression.OrElse(expr1.Body, expr2.Body));
        return Expression.Lambda<Func<T, bool>>(combined, parameter);
    }

    public static Expression<Func<T, bool>> And<T>(
        this Expression<Func<T, bool>> expr1,
        Expression<Func<T, bool>> expr2)
    {
        var parameter = Expression.Parameter(typeof(T));
        var combined = new ParameterReplaceVisitor(parameter)
            .Visit(Expression.AndAlso(expr1.Body, expr2.Body));
        return Expression.Lambda<Func<T, bool>>(combined, parameter);
    }
}

class ParameterReplaceVisitor : ExpressionVisitor
{
    private readonly ParameterExpression _parameter;

    public ParameterReplaceVisitor(ParameterExpression parameter)
    {
        _parameter = parameter;
    }

    protected override Expression VisitParameter(ParameterExpression node)
    {
        return _parameter;
    }
}
```

### 6.3.2 条件构建器

使用条件构建器简化动态查询:

```csharp
public class ConditionBuilder
{
    private readonly SqlSugarClient _db;

    public ConditionBuilder(SqlSugarClient db)
    {
        _db = db;
    }

    // 使用Conditionals进行条件构建
    public List<User> BuildWithConditionals(UserFilter filter)
    {
        var conditionals = new List<IConditionalModel>();

        if (!string.IsNullOrEmpty(filter.Name))
        {
            conditionals.Add(new ConditionalModel
            {
                FieldName = "Name",
                ConditionalType = ConditionalType.Like,
                FieldValue = filter.Name
            });
        }

        if (filter.MinAge.HasValue)
        {
            conditionals.Add(new ConditionalModel
            {
                FieldName = "Age",
                ConditionalType = ConditionalType.GreaterThanOrEqual,
                FieldValue = filter.MinAge.Value.ToString()
            });
        }

        if (filter.MaxAge.HasValue)
        {
            conditionals.Add(new ConditionalModel
            {
                FieldName = "Age",
                ConditionalType = ConditionalType.LessThanOrEqual,
                FieldValue = filter.MaxAge.Value.ToString()
            });
        }

        return _db.Queryable<User>()
            .Where(conditionals)
            .ToList();
    }
}

public class UserFilter
{
    public string Name { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
}
```

## 6.4 Select投影

### 6.4.1 匿名类型投影

将查询结果投影到匿名类型:

```csharp
public class AnonymousProjection
{
    private readonly SqlSugarClient _db;

    public AnonymousProjection(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础投影
    public List<object> BasicProjection()
    {
        return _db.Queryable<User>()
            .Select(u => new { u.Id, u.Name, u.Email })
            .ToList<object>();
    }

    // 计算字段投影
    public List<object> ComputedProjection()
    {
        return _db.Queryable<User>()
            .Select(u => new
            {
                u.Id,
                u.Name,
                AgeGroup = u.Age < 18 ? "未成年" : u.Age < 60 ? "成年" : "老年",
                CreateYear = u.CreateTime.Year
            })
            .ToList<object>();
    }

    // 字符串拼接投影
    public List<object> ConcatProjection()
    {
        return _db.Queryable<User>()
            .Select(u => new
            {
                u.Id,
                FullInfo = u.Name + " (" + u.Email + ")",
                DisplayName = u.Name + " - " + u.Age
            })
            .ToList<object>();
    }
}
```

### 6.4.2 DTO投影

投影到数据传输对象(DTO):

```csharp
public class DtoProjection
{
    private readonly SqlSugarClient _db;

    public DtoProjection(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础DTO投影
    public List<UserDto> ProjectToDto()
    {
        return _db.Queryable<User>()
            .Select(u => new UserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Age = u.Age
            })
            .ToList();
    }

    // 包含计算字段的DTO
    public List<UserDetailDto> ProjectToDetailDto()
    {
        return _db.Queryable<User>()
            .Select(u => new UserDetailDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Age = u.Age,
                IsAdult = u.Age >= 18,
                AccountAge = SqlFunc.DateDiff(DateType.Day, u.CreateTime, DateTime.Now)
            })
            .ToList();
    }

    // 使用Mapper投影
    public List<UserDto> UseMapper()
    {
        return _db.Queryable<User>()
            .Select(u => new UserDto(), true)  // true表示自动映射
            .ToList();
    }
}

public class UserDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    public int Age { get; set; }
}

public class UserDetailDto : UserDto
{
    public bool IsAdult { get; set; }
    public int AccountAge { get; set; }
}
```

### 6.4.3 动态字段选择

根据需要动态选择字段:

```csharp
public class DynamicFieldSelection
{
    private readonly SqlSugarClient _db;

    public DynamicFieldSelection(SqlSugarClient db)
    {
        _db = db;
    }

    // 动态选择字段
    public List<Dictionary<string, object>> SelectDynamicFields(List<string> fields)
    {
        var query = _db.Queryable<User>();

        if (fields != null && fields.Any())
        {
            var selectFields = string.Join(",", fields);
            return query.Select(selectFields).ToList();
        }

        return query.Select("*").ToList();
    }

    // 根据权限选择字段
    public List<object> SelectByPermission(bool includeEmail, bool includePhone)
    {
        return _db.Queryable<User>()
            .Select(u => new
            {
                u.Id,
                u.Name,
                Email = includeEmail ? u.Email : null,
                Phone = includePhone ? u.Phone : null
            })
            .ToList<object>();
    }
}
```

## 6.5 Join操作

### 6.5.1 内连接

使用内连接查询多表数据:

```csharp
public class InnerJoinExample
{
    private readonly SqlSugarClient _db;

    public InnerJoinExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础内连接
    public List<object> BasicInnerJoin()
    {
        return _db.Queryable<User, Department>((u, d) => u.DepartmentId == d.Id)
            .Select((u, d) => new
            {
                UserId = u.Id,
                UserName = u.Name,
                DepartmentName = d.Name
            })
            .ToList<object>();
    }

    // 使用InnerJoin方法
    public List<UserDeptDto> UseInnerJoinMethod()
    {
        return _db.Queryable<User>()
            .InnerJoin<Department>((u, d) => u.DepartmentId == d.Id)
            .Select((u, d) => new UserDeptDto
            {
                UserId = u.Id,
                UserName = u.Name,
                UserEmail = u.Email,
                DepartmentName = d.Name
            })
            .ToList();
    }

    // 带条件的内连接
    public List<UserDeptDto> InnerJoinWithCondition(int minAge)
    {
        return _db.Queryable<User>()
            .InnerJoin<Department>((u, d) => u.DepartmentId == d.Id)
            .Where((u, d) => u.Age >= minAge)
            .Where((u, d) => d.Status == 1)
            .Select((u, d) => new UserDeptDto
            {
                UserId = u.Id,
                UserName = u.Name,
                DepartmentName = d.Name
            })
            .ToList();
    }
}
```

### 6.5.2 左连接

使用左连接保留主表所有记录:

```csharp
public class LeftJoinExample
{
    private readonly SqlSugarClient _db;

    public LeftJoinExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础左连接
    public List<UserDeptDto> BasicLeftJoin()
    {
        return _db.Queryable<User>()
            .LeftJoin<Department>((u, d) => u.DepartmentId == d.Id)
            .Select((u, d) => new UserDeptDto
            {
                UserId = u.Id,
                UserName = u.Name,
                DepartmentName = d.Name ?? "未分配"
            })
            .ToList();
    }

    // 多个左连接
    public List<object> MultipleLeftJoins()
    {
        return _db.Queryable<User>()
            .LeftJoin<Department>((u, d) => u.DepartmentId == d.Id)
            .LeftJoin<Role>((u, d, r) => u.RoleId == r.Id)
            .Select((u, d, r) => new
            {
                UserId = u.Id,
                UserName = u.Name,
                DepartmentName = d.Name,
                RoleName = r.Name
            })
            .ToList<object>();
    }
}
```

### 6.5.3 右连接

使用右连接保留从表所有记录:

```csharp
public class RightJoinExample
{
    private readonly SqlSugarClient _db;

    public RightJoinExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础右连接
    public List<object> BasicRightJoin()
    {
        return _db.Queryable<User>()
            .RightJoin<Department>((u, d) => u.DepartmentId == d.Id)
            .Select((u, d) => new
            {
                DepartmentName = d.Name,
                UserCount = SqlFunc.AggregateCount(u.Id)
            })
            .GroupBy((u, d) => d.Name)
            .ToList<object>();
    }
}
```

### 6.5.4 多表连接

连接多个表进行复杂查询:

```csharp
public class MultiTableJoin
{
    private readonly SqlSugarClient _db;

    public MultiTableJoin(SqlSugarClient db)
    {
        _db = db;
    }

    // 三表连接
    public List<OrderDetailDto> ThreeTableJoin()
    {
        return _db.Queryable<Order, User, Product>((o, u, p) => new JoinQueryInfos(
                JoinType.Left, o.UserId == u.Id,
                JoinType.Left, o.ProductId == p.Id
            ))
            .Select((o, u, p) => new OrderDetailDto
            {
                OrderNo = o.OrderNo,
                OrderTime = o.CreateTime,
                UserName = u.Name,
                ProductName = p.Name,
                Quantity = o.Quantity,
                TotalPrice = o.Quantity * p.Price
            })
            .ToList();
    }

    // 四表连接
    public List<object> FourTableJoin()
    {
        return _db.Queryable<Order, User, Product, Category>(
                (o, u, p, c) => new JoinQueryInfos(
                    JoinType.Left, o.UserId == u.Id,
                    JoinType.Left, o.ProductId == p.Id,
                    JoinType.Left, p.CategoryId == c.Id
                ))
            .Select((o, u, p, c) => new
            {
                OrderNo = o.OrderNo,
                UserName = u.Name,
                ProductName = p.Name,
                CategoryName = c.Name,
                TotalAmount = o.Quantity * p.Price
            })
            .ToList<object>();
    }
}

public class OrderDetailDto
{
    public string OrderNo { get; set; }
    public DateTime OrderTime { get; set; }
    public string UserName { get; set; }
    public string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal TotalPrice { get; set; }
}
```

## 6.6 分组与聚合

### 6.6.1 GroupBy分组

对数据进行分组统计:

```csharp
public class GroupByExample
{
    private readonly SqlSugarClient _db;

    public GroupByExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 单字段分组
    public List<object> SingleFieldGroup()
    {
        return _db.Queryable<User>()
            .GroupBy(u => u.Age)
            .Select(u => new
            {
                Age = u.Age,
                Count = SqlFunc.AggregateCount(u.Id)
            })
            .ToList<object>();
    }

    // 多字段分组
    public List<object> MultipleFieldsGroup()
    {
        return _db.Queryable<User>()
            .GroupBy(u => new { u.Age, u.Status })
            .Select(u => new
            {
                u.Age,
                u.Status,
                Count = SqlFunc.AggregateCount(u.Id)
            })
            .ToList<object>();
    }

    // 分组后排序
    public List<object> GroupWithOrder()
    {
        return _db.Queryable<User>()
            .GroupBy(u => u.Age)
            .Select(u => new
            {
                Age = u.Age,
                Count = SqlFunc.AggregateCount(u.Id)
            })
            .OrderBy("Count DESC")
            .ToList<object>();
    }
}
```

### 6.6.2 Having条件

对分组结果进行过滤:

```csharp
public class HavingExample
{
    private readonly SqlSugarClient _db;

    public HavingExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础Having
    public List<object> BasicHaving()
    {
        return _db.Queryable<User>()
            .GroupBy(u => u.Age)
            .Having(u => SqlFunc.AggregateCount(u.Id) > 5)
            .Select(u => new
            {
                Age = u.Age,
                Count = SqlFunc.AggregateCount(u.Id)
            })
            .ToList<object>();
    }

    // 复杂Having条件
    public List<object> ComplexHaving()
    {
        return _db.Queryable<Order>()
            .GroupBy(o => o.UserId)
            .Having(o => SqlFunc.AggregateSum(o.Amount) > 10000)
            .Having(o => SqlFunc.AggregateCount(o.Id) >= 10)
            .Select(o => new
            {
                UserId = o.UserId,
                TotalAmount = SqlFunc.AggregateSum(o.Amount),
                OrderCount = SqlFunc.AggregateCount(o.Id)
            })
            .ToList<object>();
    }
}
```

### 6.6.3 聚合函数

使用各种聚合函数:

```csharp
public class AggregateFunctions
{
    private readonly SqlSugarClient _db;

    public AggregateFunctions(SqlSugarClient db)
    {
        _db = db;
    }

    // 常用聚合函数
    public object CommonAggregates()
    {
        return _db.Queryable<User>()
            .Select(u => new
            {
                TotalCount = SqlFunc.AggregateCount(u.Id),
                AvgAge = SqlFunc.AggregateAvg(u.Age),
                MinAge = SqlFunc.AggregateMin(u.Age),
                MaxAge = SqlFunc.AggregateMax(u.Age),
                SumAge = SqlFunc.AggregateSum(u.Age)
            })
            .First();
    }

    // 分组聚合
    public List<object> GroupAggregates()
    {
        return _db.Queryable<Order>()
            .GroupBy(o => o.UserId)
            .Select(o => new
            {
                UserId = o.UserId,
                TotalOrders = SqlFunc.AggregateCount(o.Id),
                TotalAmount = SqlFunc.AggregateSum(o.Amount),
                AvgAmount = SqlFunc.AggregateAvg(o.Amount),
                MaxAmount = SqlFunc.AggregateMax(o.Amount),
                MinAmount = SqlFunc.AggregateMin(o.Amount)
            })
            .ToList<object>();
    }

    // 多维度聚合
    public List<object> MultiDimensionAggregates()
    {
        return _db.Queryable<Order>()
            .GroupBy(o => new { Year = o.CreateTime.Year, Month = o.CreateTime.Month })
            .Select(o => new
            {
                Year = o.CreateTime.Year,
                Month = o.CreateTime.Month,
                OrderCount = SqlFunc.AggregateCount(o.Id),
                TotalAmount = SqlFunc.AggregateSum(o.Amount)
            })
            .OrderBy("Year DESC, Month DESC")
            .ToList<object>();
    }
}
```

## 6.7 去重与合并

### 6.7.1 Distinct去重

使用Distinct去除重复数据:

```csharp
public class DistinctExample
{
    private readonly SqlSugarClient _db;

    public DistinctExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 单字段去重
    public List<int> DistinctAges()
    {
        return _db.Queryable<User>()
            .Select(u => u.Age)
            .Distinct()
            .ToList();
    }

    // 多字段去重
    public List<object> DistinctMultipleFields()
    {
        return _db.Queryable<User>()
            .Select(u => new { u.Age, u.Status })
            .Distinct()
            .ToList<object>();
    }

    // 去重后统计
    public int CountDistinct()
    {
        return _db.Queryable<User>()
            .Select(u => u.Email)
            .Distinct()
            .Count();
    }
}
```

### 6.7.2 Union合并

合并多个查询结果:

```csharp
public class UnionExample
{
    private readonly SqlSugarClient _db;

    public UnionExample(SqlSugarClient db)
    {
        _db = db;
    }

    // Union合并(去重)
    public List<User> UnionQuery()
    {
        var query1 = _db.Queryable<User>().Where(u => u.Age < 20);
        var query2 = _db.Queryable<User>().Where(u => u.Age > 60);

        return _db.Union(query1, query2).ToList();
    }

    // UnionAll合并(不去重)
    public List<User> UnionAllQuery()
    {
        var query1 = _db.Queryable<User>().Where(u => u.Status == 1);
        var query2 = _db.Queryable<User>().Where(u => u.Status == 2);

        return _db.UnionAll(query1, query2).ToList();
    }

    // 多个查询合并
    public List<object> MultipleUnion()
    {
        var query1 = _db.Queryable<User>()
            .Where(u => u.Age < 20)
            .Select(u => new { u.Id, u.Name, Category = "未成年" });

        var query2 = _db.Queryable<User>()
            .Where(u => u.Age >= 20 && u.Age < 60)
            .Select(u => new { u.Id, u.Name, Category = "成年" });

        var query3 = _db.Queryable<User>()
            .Where(u => u.Age >= 60)
            .Select(u => new { u.Id, u.Name, Category = "老年" });

        return _db.UnionAll(query1, query2, query3).ToList<object>();
    }
}
```

## 6.8 子查询

### 6.8.1 标量子查询

返回单个值的子查询:

```csharp
public class ScalarSubquery
{
    private readonly SqlSugarClient _db;

    public ScalarSubquery(SqlSugarClient db)
    {
        _db = db;
    }

    // 在Select中使用子查询
    public List<object> SubqueryInSelect()
    {
        return _db.Queryable<User>()
            .Select(u => new
            {
                u.Id,
                u.Name,
                OrderCount = SqlFunc.Subqueryable<Order>()
                    .Where(o => o.UserId == u.Id)
                    .Count()
            })
            .ToList<object>();
    }

    // 在Where中使用子查询
    public List<User> SubqueryInWhere()
    {
        return _db.Queryable<User>()
            .Where(u => u.Age > SqlFunc.Subqueryable<User>()
                .Select(s => SqlFunc.AggregateAvg(s.Age)))
            .ToList();
    }
}
```

### 6.8.2 IN子查询

使用IN进行子查询:

```csharp
public class InSubquery
{
    private readonly SqlSugarClient _db;

    public InSubquery(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础IN子查询
    public List<User> BasicInSubquery()
    {
        var orderUserIds = _db.Queryable<Order>()
            .Where(o => o.Amount > 1000)
            .Select(o => o.UserId)
            .ToList();

        return _db.Queryable<User>()
            .Where(u => orderUserIds.Contains(u.Id))
            .ToList();
    }

    // 使用SqlFunc.Subqueryable
    public List<User> UseSubqueryable()
    {
        return _db.Queryable<User>()
            .Where(u => SqlFunc.Subqueryable<Order>()
                .Where(o => o.UserId == u.Id && o.Amount > 1000)
                .Any())
            .ToList();
    }
}
```

### 6.8.3 EXISTS子查询

使用EXISTS判断存在性:

```csharp
public class ExistsSubquery
{
    private readonly SqlSugarClient _db;

    public ExistsSubquery(SqlSugarClient db)
    {
        _db = db;
    }

    // EXISTS子查询
    public List<User> ExistsQuery()
    {
        return _db.Queryable<User>()
            .Where(u => SqlFunc.Subqueryable<Order>()
                .Where(o => o.UserId == u.Id && o.Amount > 1000)
                .Any())
            .ToList();
    }

    // NOT EXISTS子查询
    public List<User> NotExistsQuery()
    {
        return _db.Queryable<User>()
            .Where(u => !SqlFunc.Subqueryable<Order>()
                .Where(o => o.UserId == u.Id)
                .Any())
            .ToList();
    }
}
```

## 6.9 最佳实践

```csharp
public class AdvancedQueryBestPractices
{
    private readonly SqlSugarClient _db;

    public AdvancedQueryBestPractices(SqlSugarClient db)
    {
        _db = db;
    }

    // 1. 使用AsQueryable提高可维护性
    public IQueryable<User> GetBaseQuery()
    {
        return _db.Queryable<User>()
            .Where(u => u.IsDeleted == false)
            .Where(u => u.Status == 1);
    }

    public List<User> GetActiveUsers()
    {
        return GetBaseQuery()
            .Where(u => u.Age >= 18)
            .ToList();
    }

    // 2. 避免N+1查询问题
    public List<UserWithOrdersDto> AvoidNPlusOne()
    {
        // 错误方式 - N+1查询
        // var users = _db.Queryable<User>().ToList();
        // foreach(var user in users)
        // {
        //     user.Orders = _db.Queryable<Order>().Where(o => o.UserId == user.Id).ToList();
        // }

        // 正确方式 - 使用Join
        return _db.Queryable<User>()
            .Mapper(u => u.Orders, u => u.Orders.First().UserId)
            .Select(u => new UserWithOrdersDto
            {
                User = u,
                Orders = u.Orders
            })
            .ToList();
    }

    // 3. 使用投影减少数据传输
    public List<UserSummaryDto> UseProjection()
    {
        // 只查询需要的字段
        return _db.Queryable<User>()
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                Name = u.Name
            })
            .ToList();
    }

    // 4. 合理使用索引
    public List<User> UseIndexEfficiently()
    {
        // 确保查询条件使用了索引字段
        return _db.Queryable<User>()
            .Where(u => u.Email == "test@test.com")  // Email有索引
            .ToList();
    }

    // 5. 批量操作优化
    public List<User> BatchQuery(List<int> ids)
    {
        // 使用IN而不是多次单条查询
        return _db.Queryable<User>()
            .Where(u => ids.Contains(u.Id))
            .ToList();
    }
}

public class UserSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; }
}

public class UserWithOrdersDto
{
    public User User { get; set; }
    public List<Order> Orders { get; set; }
}
```

## 本章小结

本章深入介绍了SqlSugar的高级查询与Lambda表达式:

1. **Lambda表达式**: 掌握了Lambda表达式的基础语法和表达式树
2. **复杂条件查询**: 学习了多条件组合、OR条件和动态条件构建
3. **动态查询**: 了解了表达式拼接和条件构建器的使用
4. **Select投影**: 掌握了匿名类型投影、DTO投影和动态字段选择
5. **Join操作**: 学习了内连接、左连接、右连接和多表连接
6. **分组与聚合**: 掌握了GroupBy、Having和各种聚合函数
7. **去重与合并**: 了解了Distinct去重和Union合并操作
8. **子查询**: 学习了标量子查询、IN子查询和EXISTS子查询
9. **最佳实践**: 总结了高级查询的性能优化和设计模式

通过本章的学习,你应该能够构建复杂的数据库查询,并能够根据实际需求进行性能优化。

**下一章**: [第07章-多表联查与导航属性](https://znlgis.github.io/csharp/SqlSugar/第07章-多表联查与导航属性/)
