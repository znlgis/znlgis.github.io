---
layout: default
title: 第五章：基础CRUD操作
---

# 第五章：基础CRUD操作

## 目录

- [5.1 Insert插入操作](#51-insert插入操作)
  - [5.1.1 单条插入](#511-单条插入)
  - [5.1.2 批量插入](#512-批量插入)
  - [5.1.3 返回自增ID](#513-返回自增id)
  - [5.1.4 插入指定列](#514-插入指定列)
- [5.2 Query查询操作](#52-query查询操作)
  - [5.2.1 基础查询](#521-基础查询)
  - [5.2.2 条件查询](#522-条件查询)
  - [5.2.3 排序查询](#523-排序查询)
  - [5.2.4 分页查询](#524-分页查询)
- [5.3 Update更新操作](#53-update更新操作)
  - [5.3.1 单条更新](#531-单条更新)
  - [5.3.2 批量更新](#532-批量更新)
  - [5.3.3 更新指定列](#533-更新指定列)
  - [5.3.4 条件更新](#534-条件更新)
- [5.4 Delete删除操作](#54-delete删除操作)
  - [5.4.1 物理删除](#541-物理删除)
  - [5.4.2 软删除](#542-软删除)
  - [5.4.3 批量删除](#543-批量删除)
  - [5.4.4 级联删除](#544-级联删除)
- [5.5 异步操作](#55-异步操作)
  - [5.5.1 异步插入](#551-异步插入)
  - [5.5.2 异步查询](#552-异步查询)
  - [5.5.3 异步更新](#553-异步更新)
  - [5.5.4 异步删除](#554-异步删除)
- [5.6 性能优化](#56-性能优化)
- [5.7 最佳实践](#57-最佳实践)
- [本章小结](#本章小结)

## 5.1 Insert插入操作

### 5.1.1 单条插入

插入单条数据是最基本的操作:

```csharp
public class InsertExample
{
    private readonly SqlSugarClient _db;

    public InsertExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础插入
    public void BasicInsert()
    {
        var user = new User
        {
            Name = "张三",
            Email = "zhangsan@test.com",
            Age = 25,
            CreateTime = DateTime.Now
        };

        int rows = _db.Insertable(user).ExecuteCommand();
        Console.WriteLine($"影响行数: {rows}");
    }

    // 插入并获取影响行数
    public bool InsertUser(User user)
    {
        return _db.Insertable(user).ExecuteCommand() > 0;
    }

    // 插入并返回实体
    public User InsertAndReturn(User user)
    {
        var result = _db.Insertable(user).ExecuteReturnEntity();
        return result;
    }
}
```

### 5.1.2 批量插入

批量插入可以显著提高性能:

```csharp
public class BatchInsertExample
{
    private readonly SqlSugarClient _db;

    public BatchInsertExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 批量插入
    public void BatchInsert()
    {
        var users = new List<User>
        {
            new User { Name = "张三", Email = "zhangsan@test.com", Age = 25 },
            new User { Name = "李四", Email = "lisi@test.com", Age = 30 },
            new User { Name = "王五", Email = "wangwu@test.com", Age = 28 }
        };

        int rows = _db.Insertable(users).ExecuteCommand();
        Console.WriteLine($"成功插入{rows}条数据");
    }

    // 大数据量批量插入(分批处理)
    public void BulkInsert()
    {
        var users = new List<User>();
        for (int i = 0; i < 10000; i++)
        {
            users.Add(new User
            {
                Name = $"用户{i}",
                Email = $"user{i}@test.com",
                Age = 20 + (i % 50)
            });
        }

        // 分批插入,每批1000条
        int rows = _db.Insertable(users).PageSize(1000).ExecuteCommand();
        Console.WriteLine($"成功插入{rows}条数据");
    }

    // 高性能批量插入
    public void FastestInsert()
    {
        var users = GenerateTestData(50000);

        // 使用最快的批量插入方式
        int rows = _db.Fastest<User>().BulkCopy(users);
        Console.WriteLine($"快速插入{rows}条数据");
    }

    private List<User> GenerateTestData(int count)
    {
        var users = new List<User>();
        for (int i = 0; i < count; i++)
        {
            users.Add(new User
            {
                Name = $"用户{i}",
                Email = $"user{i}@test.com",
                Age = 20 + (i % 50)
            });
        }
        return users;
    }
}
```

### 5.1.3 返回自增ID

插入数据后获取自增主键:

```csharp
public class ReturnIdentityExample
{
    private readonly SqlSugarClient _db;

    public ReturnIdentityExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 返回自增ID
    public int InsertReturnId()
    {
        var user = new User
        {
            Name = "张三",
            Email = "zhangsan@test.com",
            Age = 25
        };

        int id = _db.Insertable(user).ExecuteReturnIdentity();
        Console.WriteLine($"新插入的用户ID: {id}");
        return id;
    }

    // 返回long类型ID
    public long InsertReturnLongId()
    {
        var user = new User
        {
            Name = "李四",
            Email = "lisi@test.com",
            Age = 30
        };

        long id = _db.Insertable(user).ExecuteReturnBigIdentity();
        return id;
    }

    // 批量插入返回ID列表
    public List<long> BatchInsertReturnIds()
    {
        var users = new List<User>
        {
            new User { Name = "用户1", Email = "user1@test.com", Age = 25 },
            new User { Name = "用户2", Email = "user2@test.com", Age = 30 },
            new User { Name = "用户3", Email = "user3@test.com", Age = 28 }
        };

        var ids = _db.Insertable(users).ExecuteReturnPkList<long>();
        return ids;
    }

    // 插入后实体包含ID
    public User InsertWithEntityId()
    {
        var user = new User
        {
            Name = "王五",
            Email = "wangwu@test.com",
            Age = 35
        };

        _db.Insertable(user).ExecuteCommand();
        // 此时user.Id已经被赋值
        Console.WriteLine($"实体ID: {user.Id}");
        return user;
    }
}
```

### 5.1.4 插入指定列

只插入部分字段:

```csharp
public class InsertColumnsExample
{
    private readonly SqlSugarClient _db;

    public InsertColumnsExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 插入指定列
    public void InsertColumns()
    {
        var user = new User
        {
            Name = "张三",
            Email = "zhangsan@test.com",
            Age = 25,
            Status = 1
        };

        // 只插入Name和Email
        _db.Insertable(user)
            .InsertColumns(u => new { u.Name, u.Email })
            .ExecuteCommand();
    }

    // 忽略某些列
    public void InsertIgnoreColumns()
    {
        var user = new User
        {
            Name = "李四",
            Email = "lisi@test.com",
            Age = 30,
            Status = 1
        };

        // 忽略Status列
        _db.Insertable(user)
            .IgnoreColumns(u => u.Status)
            .ExecuteCommand();
    }

    // 忽略空值列
    public void InsertIgnoreNulls()
    {
        var user = new User
        {
            Name = "王五",
            Email = null,
            Age = 28
        };

        // 忽略为null的列
        _db.Insertable(user)
            .IgnoreColumns(ignoreNullColumn: true)
            .ExecuteCommand();
    }

    // 使用表达式插入
    public void InsertByExpression()
    {
        _db.Insertable<User>()
            .AddColumns(u => new User
            {
                Name = "赵六",
                Email = "zhaoliu@test.com",
                Age = 32
            })
            .ExecuteCommand();
    }
}
```

## 5.2 Query查询操作

### 5.2.1 基础查询

最基本的查询操作:

```csharp
public class BasicQueryExample
{
    private readonly SqlSugarClient _db;

    public BasicQueryExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 查询所有
    public List<User> GetAllUsers()
    {
        return _db.Queryable<User>().ToList();
    }

    // 查询单条
    public User GetUserById(int id)
    {
        return _db.Queryable<User>().First(u => u.Id == id);
    }

    // 查询单条(不存在返回null)
    public User GetUserByIdOrNull(int id)
    {
        return _db.Queryable<User>().Single(u => u.Id == id);
    }

    // 查询前N条
    public List<User> GetTopUsers(int count)
    {
        return _db.Queryable<User>().Take(count).ToList();
    }

    // 判断是否存在
    public bool ExistsUser(int id)
    {
        return _db.Queryable<User>().Any(u => u.Id == id);
    }

    // 统计数量
    public int CountUsers()
    {
        return _db.Queryable<User>().Count();
    }

    // 查询指定列
    public List<string> GetUserNames()
    {
        return _db.Queryable<User>()
            .Select(u => u.Name)
            .ToList();
    }

    // 查询匿名对象
    public List<object> GetUserBasicInfo()
    {
        return _db.Queryable<User>()
            .Select(u => new { u.Id, u.Name, u.Email })
            .ToList<object>();
    }
}
```

### 5.2.2 条件查询

使用各种条件进行查询:

```csharp
public class ConditionalQueryExample
{
    private readonly SqlSugarClient _db;

    public ConditionalQueryExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 单条件查询
    public List<User> GetUsersByAge(int age)
    {
        return _db.Queryable<User>()
            .Where(u => u.Age == age)
            .ToList();
    }

    // 多条件查询
    public List<User> GetUsers(string name, int minAge, int maxAge)
    {
        return _db.Queryable<User>()
            .Where(u => u.Name.Contains(name))
            .Where(u => u.Age >= minAge && u.Age <= maxAge)
            .ToList();
    }

    // 动态条件查询
    public List<User> DynamicQuery(string name, int? age, string email)
    {
        var query = _db.Queryable<User>();

        if (!string.IsNullOrEmpty(name))
        {
            query = query.Where(u => u.Name.Contains(name));
        }

        if (age.HasValue)
        {
            query = query.Where(u => u.Age == age.Value);
        }

        if (!string.IsNullOrEmpty(email))
        {
            query = query.Where(u => u.Email.Contains(email));
        }

        return query.ToList();
    }

    // 使用WhereIF动态查询
    public List<User> DynamicQueryWithWhereIF(string name, int? age)
    {
        return _db.Queryable<User>()
            .WhereIF(!string.IsNullOrEmpty(name), u => u.Name.Contains(name))
            .WhereIF(age.HasValue, u => u.Age == age.Value)
            .ToList();
    }

    // IN查询
    public List<User> GetUsersByIds(List<int> ids)
    {
        return _db.Queryable<User>()
            .In(u => u.Id, ids)
            .ToList();
    }

    // BETWEEN查询
    public List<User> GetUsersByAgeRange(int minAge, int maxAge)
    {
        return _db.Queryable<User>()
            .Where(u => SqlFunc.Between(u.Age, minAge, maxAge))
            .ToList();
    }

    // LIKE查询
    public List<User> SearchUsers(string keyword)
    {
        return _db.Queryable<User>()
            .Where(u => u.Name.Contains(keyword) || u.Email.Contains(keyword))
            .ToList();
    }

    // 时间范围查询
    public List<User> GetUsersByDateRange(DateTime startDate, DateTime endDate)
    {
        return _db.Queryable<User>()
            .Where(u => u.CreateTime >= startDate && u.CreateTime < endDate)
            .ToList();
    }
}
```

### 5.2.3 排序查询

对查询结果进行排序:

```csharp
public class OrderByExample
{
    private readonly SqlSugarClient _db;

    public OrderByExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 升序排序
    public List<User> GetUsersOrderByAge()
    {
        return _db.Queryable<User>()
            .OrderBy(u => u.Age)
            .ToList();
    }

    // 降序排序
    public List<User> GetUsersOrderByAgeDesc()
    {
        return _db.Queryable<User>()
            .OrderBy(u => u.Age, OrderByType.Desc)
            .ToList();
    }

    // 多字段排序
    public List<User> GetUsersMultipleOrder()
    {
        return _db.Queryable<User>()
            .OrderBy(u => u.Age)
            .OrderBy(u => u.CreateTime, OrderByType.Desc)
            .ToList();
    }

    // 动态排序
    public List<User> GetUsersWithDynamicOrder(string orderField, bool isDesc)
    {
        var query = _db.Queryable<User>();

        switch (orderField.ToLower())
        {
            case "age":
                query = isDesc ? query.OrderBy(u => u.Age, OrderByType.Desc)
                              : query.OrderBy(u => u.Age);
                break;
            case "name":
                query = isDesc ? query.OrderBy(u => u.Name, OrderByType.Desc)
                              : query.OrderBy(u => u.Name);
                break;
            case "createtime":
                query = isDesc ? query.OrderBy(u => u.CreateTime, OrderByType.Desc)
                              : query.OrderBy(u => u.CreateTime);
                break;
        }

        return query.ToList();
    }

    // 使用字符串排序
    public List<User> GetUsersOrderByString(string orderBy)
    {
        // orderBy格式: "Age desc, Name asc"
        return _db.Queryable<User>()
            .OrderByIF(!string.IsNullOrEmpty(orderBy), orderBy)
            .ToList();
    }
}
```

### 5.2.4 分页查询

实现数据分页:

```csharp
public class PaginationExample
{
    private readonly SqlSugarClient _db;

    public PaginationExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础分页
    public List<User> GetUsersByPage(int pageIndex, int pageSize)
    {
        return _db.Queryable<User>()
            .ToPageList(pageIndex, pageSize);
    }

    // 分页并返回总数
    public PagedResult<User> GetUsersPagedWithTotal(int pageIndex, int pageSize)
    {
        int totalCount = 0;
        var users = _db.Queryable<User>()
            .ToPageList(pageIndex, pageSize, ref totalCount);

        return new PagedResult<User>
        {
            Items = users,
            TotalCount = totalCount,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };
    }

    // 条件分页
    public PagedResult<User> SearchUsersWithPaging(string keyword, int pageIndex, int pageSize)
    {
        int totalCount = 0;
        var users = _db.Queryable<User>()
            .WhereIF(!string.IsNullOrEmpty(keyword), u => u.Name.Contains(keyword))
            .OrderBy(u => u.CreateTime, OrderByType.Desc)
            .ToPageList(pageIndex, pageSize, ref totalCount);

        return new PagedResult<User>
        {
            Items = users,
            TotalCount = totalCount,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }

    // 高性能分页(使用Skip和Take)
    public List<User> GetUsersWithSkipTake(int skipCount, int takeCount)
    {
        return _db.Queryable<User>()
            .Skip(skipCount)
            .Take(takeCount)
            .ToList();
    }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; }
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}
```

## 5.3 Update更新操作

### 5.3.1 单条更新

更新单条数据:

```csharp
public class UpdateExample
{
    private readonly SqlSugarClient _db;

    public UpdateExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 基础更新
    public bool UpdateUser(User user)
    {
        return _db.Updateable(user).ExecuteCommand() > 0;
    }

    // 根据主键更新
    public bool UpdateUserById(int id, string name, string email)
    {
        var user = _db.Queryable<User>().First(u => u.Id == id);
        if (user != null)
        {
            user.Name = name;
            user.Email = email;
            return _db.Updateable(user).ExecuteCommand() > 0;
        }
        return false;
    }

    // 更新并返回实体
    public User UpdateAndReturn(User user)
    {
        _db.Updateable(user).ExecuteCommand();
        return _db.Queryable<User>().First(u => u.Id == user.Id);
    }
}
```

### 5.3.2 批量更新

批量更新多条数据:

```csharp
public class BatchUpdateExample
{
    private readonly SqlSugarClient _db;

    public BatchUpdateExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 批量更新
    public int BatchUpdate(List<User> users)
    {
        return _db.Updateable(users).ExecuteCommand();
    }

    // 条件批量更新
    public int UpdateUsersByCondition(int age, int newAge)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.Age == newAge)
            .Where(u => u.Age == age)
            .ExecuteCommand();
    }

    // 批量更新特定字段
    public int BatchUpdateStatus(List<int> ids, int status)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.Status == status)
            .Where(u => ids.Contains(u.Id))
            .ExecuteCommand();
    }
}
```

### 5.3.3 更新指定列

只更新部分字段:

```csharp
public class UpdateColumnsExample
{
    private readonly SqlSugarClient _db;

    public UpdateColumnsExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 更新指定列
    public bool UpdateUserName(int id, string name)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.Name == name)
            .Where(u => u.Id == id)
            .ExecuteCommand() > 0;
    }

    // 更新多个列
    public bool UpdateUserInfo(int id, string name, string email)
    {
        return _db.Updateable<User>()
            .SetColumns(u => new User { Name = name, Email = email })
            .Where(u => u.Id == id)
            .ExecuteCommand() > 0;
    }

    // 更新指定列(使用实体)
    public bool UpdateSpecificColumns(User user)
    {
        return _db.Updateable(user)
            .UpdateColumns(u => new { u.Name, u.Email })
            .ExecuteCommand() > 0;
    }

    // 忽略某些列
    public bool UpdateIgnoreColumns(User user)
    {
        return _db.Updateable(user)
            .IgnoreColumns(u => new { u.CreateTime, u.UpdateTime })
            .ExecuteCommand() > 0;
    }

    // 忽略空值列
    public bool UpdateIgnoreNulls(User user)
    {
        return _db.Updateable(user)
            .IgnoreColumns(ignoreAllNullColumns: true)
            .ExecuteCommand() > 0;
    }

    // 列值自增
    public bool IncrementAge(int id, int increment)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.Age == u.Age + increment)
            .Where(u => u.Id == id)
            .ExecuteCommand() > 0;
    }
}
```

### 5.3.4 条件更新

根据复杂条件更新:

```csharp
public class ConditionalUpdateExample
{
    private readonly SqlSugarClient _db;

    public ConditionalUpdateExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 单条件更新
    public int UpdateByAge(int age, int newStatus)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.Status == newStatus)
            .Where(u => u.Age > age)
            .ExecuteCommand();
    }

    // 多条件更新
    public int UpdateByMultipleConditions(string name, int minAge, int status)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.Status == status)
            .Where(u => u.Name.Contains(name) && u.Age >= minAge)
            .ExecuteCommand();
    }

    // 动态条件更新
    public int DynamicUpdate(string name, int? age, int status)
    {
        var updateable = _db.Updateable<User>()
            .SetColumns(u => u.Status == status);

        if (!string.IsNullOrEmpty(name))
        {
            updateable = updateable.Where(u => u.Name == name);
        }

        if (age.HasValue)
        {
            updateable = updateable.Where(u => u.Age == age.Value);
        }

        return updateable.ExecuteCommand();
    }
}
```

## 5.4 Delete删除操作

### 5.4.1 物理删除

永久删除数据:

```csharp
public class DeleteExample
{
    private readonly SqlSugarClient _db;

    public DeleteExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 根据主键删除
    public bool DeleteById(int id)
    {
        return _db.Deleteable<User>().In(id).ExecuteCommand() > 0;
    }

    // 根据实体删除
    public bool DeleteUser(User user)
    {
        return _db.Deleteable(user).ExecuteCommand() > 0;
    }

    // 根据条件删除
    public int DeleteByCondition(int age)
    {
        return _db.Deleteable<User>()
            .Where(u => u.Age < age)
            .ExecuteCommand();
    }

    // 删除多条
    public int DeleteByIds(List<int> ids)
    {
        return _db.Deleteable<User>().In(ids).ExecuteCommand();
    }
}
```

### 5.4.2 软删除

标记删除而不是物理删除:

```csharp
public class SoftDeleteExample
{
    private readonly SqlSugarClient _db;

    public SoftDeleteExample(SqlSugarClient db)
    {
        _db = db;
        // 配置软删除
        ConfigureSoftDelete();
    }

    private void ConfigureSoftDelete()
    {
        // 配置软删除过滤器
        _db.QueryFilter.Add(new TableFilterItem<User>(u => u.IsDeleted == false));
    }

    // 软删除
    public bool SoftDelete(int id)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.IsDeleted == true)
            .Where(u => u.Id == id)
            .ExecuteCommand() > 0;
    }

    // 批量软删除
    public int SoftDeleteByIds(List<int> ids)
    {
        return _db.Updateable<User>()
            .SetColumns(u => u.IsDeleted == true)
            .Where(u => ids.Contains(u.Id))
            .ExecuteCommand();
    }

    // 恢复软删除的数据
    public bool RestoreDeleted(int id)
    {
        // 临时禁用过滤器
        _db.QueryFilter.Clear<User>();
        
        var result = _db.Updateable<User>()
            .SetColumns(u => u.IsDeleted == false)
            .Where(u => u.Id == id)
            .ExecuteCommand() > 0;

        // 重新配置过滤器
        ConfigureSoftDelete();
        
        return result;
    }

    // 查询包含软删除的数据
    public List<User> GetAllIncludingDeleted()
    {
        return _db.Queryable<User>()
            .ClearFilter<User>()
            .ToList();
    }
}

// 实体类需要包含IsDeleted字段
public class User
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true)]
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    
    [SugarColumn(DefaultValue = "0")]
    public bool IsDeleted { get; set; }
}
```

### 5.4.3 批量删除

批量删除多条数据:

```csharp
public class BatchDeleteExample
{
    private readonly SqlSugarClient _db;

    public BatchDeleteExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 根据ID列表批量删除
    public int BatchDeleteByIds(List<int> ids)
    {
        return _db.Deleteable<User>().In(ids).ExecuteCommand();
    }

    // 根据条件批量删除
    public int BatchDeleteByCondition(DateTime beforeDate)
    {
        return _db.Deleteable<User>()
            .Where(u => u.CreateTime < beforeDate)
            .ExecuteCommand();
    }

    // 删除全部(危险操作)
    public int DeleteAll()
    {
        return _db.Deleteable<User>().ExecuteCommand();
    }
}
```

### 5.4.4 级联删除

删除主表时删除关联表:

```csharp
public class CascadeDeleteExample
{
    private readonly SqlSugarClient _db;

    public CascadeDeleteExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 手动级联删除
    public bool DeleteUserWithOrders(int userId)
    {
        try
        {
            _db.Ado.BeginTran();

            // 删除用户的订单
            _db.Deleteable<Order>()
                .Where(o => o.UserId == userId)
                .ExecuteCommand();

            // 删除用户
            _db.Deleteable<User>()
                .Where(u => u.Id == userId)
                .ExecuteCommand();

            _db.Ado.CommitTran();
            return true;
        }
        catch
        {
            _db.Ado.RollbackTran();
            throw;
        }
    }

    // 级联软删除
    public bool SoftDeleteUserCascade(int userId)
    {
        try
        {
            _db.Ado.BeginTran();

            // 软删除订单
            _db.Updateable<Order>()
                .SetColumns(o => o.IsDeleted == true)
                .Where(o => o.UserId == userId)
                .ExecuteCommand();

            // 软删除用户
            _db.Updateable<User>()
                .SetColumns(u => u.IsDeleted == true)
                .Where(u => u.Id == userId)
                .ExecuteCommand();

            _db.Ado.CommitTran();
            return true;
        }
        catch
        {
            _db.Ado.RollbackTran();
            throw;
        }
    }
}
```

## 5.5 异步操作

### 5.5.1 异步插入

```csharp
public class AsyncInsertExample
{
    private readonly SqlSugarClient _db;

    public AsyncInsertExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 异步插入单条
    public async Task<bool> InsertAsync(User user)
    {
        return await _db.Insertable(user).ExecuteCommandAsync() > 0;
    }

    // 异步批量插入
    public async Task<int> BatchInsertAsync(List<User> users)
    {
        return await _db.Insertable(users).ExecuteCommandAsync();
    }

    // 异步插入并返回ID
    public async Task<int> InsertReturnIdAsync(User user)
    {
        return await _db.Insertable(user).ExecuteReturnIdentityAsync();
    }
}
```

### 5.5.2 异步查询

```csharp
public class AsyncQueryExample
{
    private readonly SqlSugarClient _db;

    public AsyncQueryExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 异步查询列表
    public async Task<List<User>> GetAllUsersAsync()
    {
        return await _db.Queryable<User>().ToListAsync();
    }

    // 异步查询单条
    public async Task<User> GetUserByIdAsync(int id)
    {
        return await _db.Queryable<User>().FirstAsync(u => u.Id == id);
    }

    // 异步分页查询
    public async Task<PagedResult<User>> GetUsersPagedAsync(int pageIndex, int pageSize)
    {
        RefAsync<int> totalCount = 0;
        var users = await _db.Queryable<User>()
            .ToPageListAsync(pageIndex, pageSize, totalCount);

        return new PagedResult<User>
        {
            Items = users,
            TotalCount = totalCount,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }

    // 异步统计
    public async Task<int> CountUsersAsync()
    {
        return await _db.Queryable<User>().CountAsync();
    }

    // 异步判断存在
    public async Task<bool> ExistsUserAsync(int id)
    {
        return await _db.Queryable<User>().AnyAsync(u => u.Id == id);
    }
}
```

### 5.5.3 异步更新

```csharp
public class AsyncUpdateExample
{
    private readonly SqlSugarClient _db;

    public AsyncUpdateExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 异步更新
    public async Task<bool> UpdateAsync(User user)
    {
        return await _db.Updateable(user).ExecuteCommandAsync() > 0;
    }

    // 异步批量更新
    public async Task<int> BatchUpdateAsync(List<User> users)
    {
        return await _db.Updateable(users).ExecuteCommandAsync();
    }

    // 异步条件更新
    public async Task<int> UpdateByConditionAsync(int age, int status)
    {
        return await _db.Updateable<User>()
            .SetColumns(u => u.Status == status)
            .Where(u => u.Age > age)
            .ExecuteCommandAsync();
    }
}
```

### 5.5.4 异步删除

```csharp
public class AsyncDeleteExample
{
    private readonly SqlSugarClient _db;

    public AsyncDeleteExample(SqlSugarClient db)
    {
        _db = db;
    }

    // 异步删除
    public async Task<bool> DeleteByIdAsync(int id)
    {
        return await _db.Deleteable<User>().In(id).ExecuteCommandAsync() > 0;
    }

    // 异步批量删除
    public async Task<int> BatchDeleteAsync(List<int> ids)
    {
        return await _db.Deleteable<User>().In(ids).ExecuteCommandAsync();
    }

    // 异步条件删除
    public async Task<int> DeleteByConditionAsync(DateTime beforeDate)
    {
        return await _db.Deleteable<User>()
            .Where(u => u.CreateTime < beforeDate)
            .ExecuteCommandAsync();
    }
}
```

## 5.6 性能优化

```csharp
public class PerformanceOptimization
{
    private readonly SqlSugarClient _db;

    public PerformanceOptimization(SqlSugarClient db)
    {
        _db = db;
    }

    // 使用BulkCopy进行大批量插入
    public void FastBulkInsert(List<User> users)
    {
        _db.Fastest<User>().BulkCopy(users);
    }

    // 使用BulkUpdate进行大批量更新
    public void FastBulkUpdate(List<User> users)
    {
        _db.Fastest<User>().BulkUpdate(users);
    }

    // 使用编译查询提高重复查询性能
    public List<User> CompiledQuery(int age)
    {
        var query = _db.Queryable<User>()
            .Where(u => u.Age > age)
            .ToList();
        return query;
    }

    // 只查询需要的列
    public List<UserDto> SelectSpecificColumns()
    {
        return _db.Queryable<User>()
            .Select(u => new UserDto
            {
                Id = u.Id,
                Name = u.Name
            })
            .ToList();
    }

    // 使用NoLock提高查询性能(SQL Server)
    public List<User> QueryWithNoLock()
    {
        return _db.Queryable<User>()
            .With(SqlWith.NoLock)
            .ToList();
    }
}

public class UserDto
{
    public int Id { get; set; }
    public string Name { get; set; }
}
```

## 5.7 最佳实践

```csharp
public class CrudBestPractices
{
    private readonly SqlSugarClient _db;

    public CrudBestPractices(SqlSugarClient db)
    {
        _db = db;
    }

    // 1. 使用仓储模式封装CRUD
    public class UserRepository
    {
        private readonly SqlSugarClient _db;

        public UserRepository(SqlSugarClient db)
        {
            _db = db;
        }

        public async Task<User> GetByIdAsync(int id)
        {
            return await _db.Queryable<User>()
                .FirstAsync(u => u.Id == id);
        }

        public async Task<bool> AddAsync(User user)
        {
            return await _db.Insertable(user).ExecuteCommandAsync() > 0;
        }

        public async Task<bool> UpdateAsync(User user)
        {
            return await _db.Updateable(user).ExecuteCommandAsync() > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            return await _db.Deleteable<User>().In(id).ExecuteCommandAsync() > 0;
        }
    }

    // 2. 使用DTO避免过度查询
    public class UserService
    {
        private readonly SqlSugarClient _db;

        public UserService(SqlSugarClient db)
        {
            _db = db;
        }

        public async Task<List<UserListDto>> GetUserListAsync()
        {
            return await _db.Queryable<User>()
                .Select(u => new UserListDto
                {
                    Id = u.Id,
                    Name = u.Name,
                    Email = u.Email
                })
                .ToListAsync();
        }
    }

    // 3. 参数验证
    public async Task<bool> AddUserSafely(User user)
    {
        if (user == null)
            throw new ArgumentNullException(nameof(user));

        if (string.IsNullOrEmpty(user.Name))
            throw new ArgumentException("用户名不能为空");

        // 检查邮箱是否已存在
        var exists = await _db.Queryable<User>()
            .AnyAsync(u => u.Email == user.Email);

        if (exists)
            throw new InvalidOperationException("邮箱已存在");

        return await _db.Insertable(user).ExecuteCommandAsync() > 0;
    }

    // 4. 使用事务保证数据一致性
    public async Task<bool> TransferUserAsync(int fromUserId, int toUserId)
    {
        try
        {
            _db.Ado.BeginTran();

            // 业务逻辑
            await _db.Updateable<User>()
                .SetColumns(u => u.Status == 0)
                .Where(u => u.Id == fromUserId)
                .ExecuteCommandAsync();

            await _db.Updateable<User>()
                .SetColumns(u => u.Status == 1)
                .Where(u => u.Id == toUserId)
                .ExecuteCommandAsync();

            _db.Ado.CommitTran();
            return true;
        }
        catch
        {
            _db.Ado.RollbackTran();
            throw;
        }
    }
}

public class UserListDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
}
```

## 本章小结

本章详细介绍了SqlSugar的基础CRUD操作:

1. **Insert操作**: 掌握了单条插入、批量插入、返回自增ID等插入技巧
2. **Query操作**: 学习了基础查询、条件查询、排序和分页等查询方法
3. **Update操作**: 了解了单条更新、批量更新、指定列更新等更新方式
4. **Delete操作**: 掌握了物理删除、软删除、批量删除和级联删除
5. **异步操作**: 学习了所有CRUD操作的异步版本,提高应用性能
6. **性能优化**: 掌握了提高CRUD操作性能的各种技巧
7. **最佳实践**: 总结了CRUD操作的最佳实践和设计模式

通过本章的学习,你应该能够熟练使用SqlSugar进行各种数据库操作,并能够根据实际需求选择合适的操作方式。

**下一章**: [第06章-高级查询与Lambda表达式](../第06章-高级查询与Lambda表达式)
