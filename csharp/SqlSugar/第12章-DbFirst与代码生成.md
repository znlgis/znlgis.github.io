---
layout: default
title: 第十二章：DbFirst与代码生成
---

# 第十二章：DbFirst与代码生成

## 目录
- [12.1 DbFirst概述](#121-dbfirst概述)
  - [12.1.1 什么是DbFirst](#1211-什么是dbfirst)
  - [12.1.2 DbFirst的优势](#1212-dbfirst的优势)
- [12.2 生成实体类](#122-生成实体类)
  - [12.2.1 基础实体生成](#1221-基础实体生成)
  - [12.2.2 批量生成](#1222-批量生成)
  - [12.2.3 生成配置](#1223-生成配置)
- [12.3 模板定制](#123-模板定制)
  - [12.3.1 自定义模板](#1231-自定义模板)
  - [12.3.2 模板变量](#1232-模板变量)
  - [12.3.3 高级模板](#1233-高级模板)
- [12.4 代码生成器](#124-代码生成器)
  - [12.4.1 生成仓储层](#1241-生成仓储层)
  - [12.4.2 生成服务层](#1242-生成服务层)
  - [12.4.3 生成控制器](#1243-生成控制器)
- [12.5 保持同步](#125-保持同步)
  - [12.5.1 数据库变更检测](#1251-数据库变更检测)
  - [12.5.2 自动更新实体](#1252-自动更新实体)
- [12.6 自动化工具](#126-自动化工具)
- [12.7 本章小结](#127-本章小结)

---

## 12.1 DbFirst概述

### 12.1.1 什么是DbFirst

DbFirst（Database First）是一种数据库优先的开发模式，先设计数据库，然后根据数据库结构生成实体类和相关代码。

**工作流程**：
```
数据库设计 → 创建表结构 → 生成实体类 → 编写业务逻辑
```

**适用场景**：
- 已有数据库系统
- 数据库设计由DBA负责
- 需要严格的数据库规范
- 多个系统共享同一数据库

### 12.1.2 DbFirst的优势

```csharp
// 传统手写实体类的问题
public class Student  // 容易出现拼写错误
{
    public int Id { get; set; }
    public string Nmae { get; set; }  // 错误：应该是Name
    public int Agee { get; set; }     // 错误：应该是Age
}

// DbFirst自动生成，避免错误
// 从数据库自动生成，保证与数据库结构一致
```

**优势总结**：
1. 减少手工编码错误
2. 保持代码与数据库同步
3. 提高开发效率
4. 统一命名规范
5. 自动生成注释文档

## 12.2 生成实体类

### 12.2.1 基础实体生成

```csharp
// 生成单个表的实体类
public class EntityGenerator
{
    private readonly SqlSugarClient _db;
    
    public EntityGenerator(string connectionString)
    {
        _db = new SqlSugarClient(new ConnectionConfig()
        {
            ConnectionString = connectionString,
            DbType = DbType.SqlServer,
            IsAutoCloseConnection = true
        });
    }
    
    // 生成单个表
    public void GenerateEntity(string tableName)
    {
        var entityCode = _db.DbFirst
            .Where(tableName)
            .IsCreateAttribute()        // 创建特性
            .IsCreateDefaultValue()     // 创建默认值
            .ToClassString();           // 转换为字符串
        
        Console.WriteLine(entityCode);
        
        // 保存到文件
        File.WriteAllText($"{tableName}.cs", entityCode);
    }
    
    // 示例：生成Student表
    public void GenerateStudentEntity()
    {
        var code = _db.DbFirst
            .Where("student")
            .IsCreateAttribute()
            .IsCreateDefaultValue()
            .ToClassString();
        
        /*
        生成的代码：
        [SugarTable("student")]
        public class Student
        {
            [SugarColumn(IsPrimaryKey=true, IsIdentity=true)]
            public int Id { get; set; }
            
            [SugarColumn(Length=50, IsNullable=false)]
            public string Name { get; set; }
            
            public int Age { get; set; }
            
            [SugarColumn(Length=100)]
            public string Email { get; set; }
            
            public DateTime CreateTime { get; set; }
        }
        */
    }
}
```

### 12.2.2 批量生成

生成数据库中的所有表：

```csharp
public class BatchEntityGenerator
{
    private readonly SqlSugarClient _db;
    
    public BatchEntityGenerator(string connectionString)
    {
        _db = new SqlSugarClient(new ConnectionConfig()
        {
            ConnectionString = connectionString,
            DbType = DbType.SqlServer,
            IsAutoCloseConnection = true
        });
    }
    
    // 生成所有表
    public void GenerateAllEntities(string outputPath)
    {
        // 确保输出目录存在
        if (!Directory.Exists(outputPath))
        {
            Directory.CreateDirectory(outputPath);
        }
        
        _db.DbFirst
            .IsCreateAttribute()
            .IsCreateDefaultValue()
            .CreateClassFile(outputPath, "MyProject.Models");
        
        Console.WriteLine($"实体类已生成到: {outputPath}");
    }
    
    // 生成指定表
    public void GenerateSpecificTables(string outputPath, params string[] tableNames)
    {
        foreach (var tableName in tableNames)
        {
            _db.DbFirst
                .Where(tableName)
                .IsCreateAttribute()
                .IsCreateDefaultValue()
                .CreateClassFile(outputPath, "MyProject.Models");
        }
    }
    
    // 排除某些表
    public void GenerateExcludeTables(string outputPath, params string[] excludeTables)
    {
        var allTables = _db.DbMaintenance.GetTableInfoList();
        var targetTables = allTables
            .Where(t => !excludeTables.Contains(t.Name))
            .Select(t => t.Name)
            .ToArray();
        
        GenerateSpecificTables(outputPath, targetTables);
    }
}

// 使用示例
var generator = new BatchEntityGenerator(connectionString);

// 生成所有表
generator.GenerateAllEntities("./Models");

// 只生成指定表
generator.GenerateSpecificTables("./Models", "student", "teacher", "class");

// 排除系统表
generator.GenerateExcludeTables("./Models", "sys_log", "sys_config");
```

### 12.2.3 生成配置

详细的生成配置选项：

```csharp
public class EntityGeneratorConfig
{
    public void GenerateWithConfig(string connectionString, string outputPath)
    {
        var db = new SqlSugarClient(new ConnectionConfig()
        {
            ConnectionString = connectionString,
            DbType = DbType.SqlServer,
            IsAutoCloseConnection = true
        });
        
        db.DbFirst
            .IsCreateAttribute()                    // 创建特性
            .IsCreateDefaultValue()                 // 创建默认值
            .SettingClassTemplate(ClassTemplate)    // 自定义类模板
            .SettingPropertyTemplate(PropertyTemplate)  // 自定义属性模板
            .SettingPropertyDescriptionTemplate(DescriptionTemplate)  // 自定义描述模板
            .SettingNamespaceTemplate(NamespaceTemplate)  // 自定义命名空间模板
            .SettingConstructorTemplate(ConstructorTemplate)  // 自定义构造函数模板
            .CreateClassFile(outputPath, "MyProject.Models");
    }
    
    // 类模板
    private string ClassTemplate => @"
{ClassDescription}
[SugarTable(""{TableName}"")]
public class {ClassName}
{
    {Constructor}
    {PropertyName}
}";
    
    // 属性模板
    private string PropertyTemplate => @"
    /// <summary>
    /// {PropertyDescription}
    /// </summary>
    {SugarColumn}
    public {PropertyType} {PropertyName} { get; set; }";
    
    // 描述模板
    private string DescriptionTemplate => "/// <summary>\r\n/// {PropertyDescription}\r\n/// </summary>";
    
    // 命名空间模板
    private string NamespaceTemplate => @"
using System;
using SqlSugar;

namespace {Namespace}
{
    {ClassContent}
}";
    
    // 构造函数模板
    private string ConstructorTemplate => @"
    public {ClassName}()
    {
        // 初始化代码
    }";
}

// 高级配置示例
public class AdvancedGeneratorConfig
{
    public void GenerateWithAdvancedConfig(SqlSugarClient db, string outputPath)
    {
        db.DbFirst
            // 基础配置
            .IsCreateAttribute()
            .IsCreateDefaultValue()
            
            // 命名转换
            .FormatPropertyName(name => ToPascalCase(name))  // 属性名转换为PascalCase
            .FormatClassName(name => ToPascalCase(name))      // 类名转换
            
            // 类型映射
            .SettingPropertyTypeConvert(type =>
            {
                // 自定义类型转换
                if (type == "varchar" || type == "nvarchar")
                    return "string";
                if (type == "int")
                    return "int";
                if (type == "bigint")
                    return "long";
                if (type == "decimal")
                    return "decimal";
                return type;
            })
            
            // 过滤条件
            .Where(tableName => !tableName.StartsWith("sys_"))  // 排除系统表
            
            .CreateClassFile(outputPath, "MyProject.Models");
    }
    
    private string ToPascalCase(string str)
    {
        if (string.IsNullOrEmpty(str)) return str;
        
        var words = str.Split('_');
        var result = string.Join("", words.Select(w => 
            char.ToUpper(w[0]) + w.Substring(1).ToLower()));
        
        return result;
    }
}
```

## 12.3 模板定制

### 12.3.1 自定义模板

创建完全自定义的代码模板：

{% raw %}
```csharp
public class CustomTemplateGenerator
{
    // 完整的自定义模板
    private const string CustomClassTemplate = @"
using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using SqlSugar;

namespace {Namespace}
{
    /// <summary>
    /// {ClassDescription}
    /// 表名: {TableName}
    /// 创建时间: {GenerateTime}
    /// </summary>
    [SugarTable(""{TableName}"")]
    [Description(""{ClassDescription}"")]
    public partial class {ClassName} : BaseEntity
    {
{PropertyContent}

        /// <summary>
        /// 构造函数
        /// </summary>
        public {ClassName}()
        {
            this.CreateTime = DateTime.Now;
        }
    }
}";
    
    private const string CustomPropertyTemplate = @"
        /// <summary>
        /// {PropertyDescription}
        /// </summary>
        {SugarColumn}
        [DisplayName(""{PropertyDescription}"")]
        public {PropertyType} {PropertyName} { get; set; }";
    
    public void Generate(SqlSugarClient db, string outputPath)
    {
        db.DbFirst
            .IsCreateAttribute()
            .IsCreateDefaultValue()
            .SettingClassTemplate(CustomClassTemplate)
            .SettingPropertyTemplate(CustomPropertyTemplate)
            .CreateClassFile(outputPath, "MyProject.Models");
    }
}

// 生成带接口的实体
public class InterfaceEntityGenerator
{
    private const string InterfaceTemplate = @"
using System;

namespace {Namespace}
{
    /// <summary>
    /// {ClassName}接口
    /// </summary>
    public interface I{ClassName}
    {
{InterfaceProperties}
    }
}";
    
    private const string ClassWithInterfaceTemplate = @"
using System;
using SqlSugar;

namespace {Namespace}
{
    /// <summary>
    /// {ClassDescription}
    /// </summary>
    [SugarTable(""{TableName}"")]
    public class {ClassName} : I{ClassName}
    {
{PropertyContent}
    }
}";
    
    public void Generate(SqlSugarClient db, string outputPath)
    {
        var tables = db.DbMaintenance.GetTableInfoList();
        
        foreach (var table in tables)
        {
            // 生成接口
            GenerateInterface(db, table.Name, outputPath);
            
            // 生成类
            GenerateClass(db, table.Name, outputPath);
        }
    }
    
    private void GenerateInterface(SqlSugarClient db, string tableName, string outputPath)
    {
        var columns = db.DbMaintenance.GetColumnInfosByTableName(tableName, false);
        
        var properties = string.Join("\n", columns.Select(col =>
            $"        {GetCSharpType(col.DataType)} {col.DbColumnName} {{ get; set; }}"));
        
        var interfaceCode = InterfaceTemplate
            .Replace("{Namespace}", "MyProject.Models")
            .Replace("{ClassName}", tableName)
            .Replace("{InterfaceProperties}", properties);
        
        File.WriteAllText(Path.Combine(outputPath, $"I{tableName}.cs"), interfaceCode);
    }
    
    private void GenerateClass(SqlSugarClient db, string tableName, string outputPath)
    {
        db.DbFirst
            .Where(tableName)
            .IsCreateAttribute()
            .SettingClassTemplate(ClassWithInterfaceTemplate)
            .CreateClassFile(outputPath, "MyProject.Models");
    }
    
    private string GetCSharpType(string dbType)
    {
        return dbType.ToLower() switch
        {
            "int" => "int",
            "bigint" => "long",
            "varchar" or "nvarchar" or "text" => "string",
            "datetime" or "datetime2" => "DateTime",
            "bit" => "bool",
            "decimal" or "money" => "decimal",
            _ => "object"
        };
    }
}
```
{% endraw %}

### 12.3.2 模板变量

可用的模板变量说明：

```csharp
public class TemplateVariables
{
    /*
    类模板变量：
    {Namespace}           - 命名空间
    {ClassName}           - 类名
    {TableName}           - 表名
    {ClassDescription}    - 类描述（从表注释获取）
    {PropertyContent}     - 属性内容
    {Constructor}         - 构造函数
    {GenerateTime}        - 生成时间
    
    属性模板变量：
    {PropertyName}        - 属性名
    {PropertyType}        - 属性类型
    {PropertyDescription} - 属性描述（从列注释获取）
    {SugarColumn}         - SqlSugar列特性
    {DefaultValue}        - 默认值
    */
    
    // 使用自定义变量的示例
    public void GenerateWithCustomVariables(SqlSugarClient db, string outputPath)
    {
        var template = @"
using System;
using SqlSugar;

namespace {Namespace}
{
    /// <summary>
    /// {ClassDescription}
    /// 表名: {TableName}
    /// 生成时间: {GenerateTime}
    /// 作者: {Author}
    /// 版本: {Version}
    /// </summary>
    [SugarTable(""{TableName}"")]
    public class {ClassName}
    {
{PropertyContent}
    }
}";
        
        // 替换自定义变量
        template = template
            .Replace("{Author}", "张三")
            .Replace("{Version}", "1.0.0")
            .Replace("{GenerateTime}", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
        
        db.DbFirst
            .IsCreateAttribute()
            .SettingClassTemplate(template)
            .CreateClassFile(outputPath, "MyProject.Models");
    }
}
```

### 12.3.3 高级模板

创建包含业务逻辑的高级模板：

{% raw %}
```csharp
public class AdvancedTemplateGenerator
{
    // 生成带验证的实体
    private const string EntityWithValidationTemplate = @"
using System;
using System.ComponentModel.DataAnnotations;
using SqlSugar;

namespace {Namespace}
{
    [SugarTable(""{TableName}"")]
    public class {ClassName} : IValidatableObject
    {
{PropertyContent}

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            var results = new List<ValidationResult>();
            
            // 自定义验证逻辑
            {ValidationLogic}
            
            return results;
        }
    }
}";
    
    // 生成带审计字段的实体
    private const string AuditableEntityTemplate = @"
using System;
using SqlSugar;

namespace {Namespace}
{
    [SugarTable(""{TableName}"")]
    public class {ClassName} : IAuditableEntity
    {
{PropertyContent}

        [SugarColumn(IsOnlyIgnoreInsert = true)]
        public DateTime CreateTime { get; set; }
        
        [SugarColumn(IsOnlyIgnoreInsert = true)]
        public int CreateUserId { get; set; }
        
        [SugarColumn(IsIgnore = true)]
        public DateTime? UpdateTime { get; set; }
        
        [SugarColumn(IsIgnore = true)]
        public int? UpdateUserId { get; set; }
    }
}";
    
    // 生成DTO
    private const string DtoTemplate = @"
using System;

namespace {Namespace}.Dtos
{
    /// <summary>
    /// {ClassName} DTO
    /// </summary>
    public class {ClassName}Dto
    {
{PropertyContent}
    }
    
    /// <summary>
    /// {ClassName} 创建 DTO
    /// </summary>
    public class Create{ClassName}Dto
    {
{CreatePropertyContent}
    }
    
    /// <summary>
    /// {ClassName} 更新 DTO
    /// </summary>
    public class Update{ClassName}Dto
    {
{UpdatePropertyContent}
    }
}";
    
    public void GenerateAdvancedEntities(SqlSugarClient db, string outputPath)
    {
        // 生成实体
        db.DbFirst
            .IsCreateAttribute()
            .SettingClassTemplate(AuditableEntityTemplate)
            .CreateClassFile(Path.Combine(outputPath, "Entities"), "MyProject.Entities");
        
        // 生成DTO
        GenerateDtos(db, Path.Combine(outputPath, "Dtos"));
    }
    
    private void GenerateDtos(SqlSugarClient db, string outputPath)
    {
        var tables = db.DbMaintenance.GetTableInfoList();
        
        foreach (var table in tables)
        {
            var columns = db.DbMaintenance.GetColumnInfosByTableName(table.Name, false);
            
            // 生成完整DTO属性
            var allProperties = GenerateProperties(columns, false);
            
            // 生成创建DTO属性（排除ID和审计字段）
            var createProperties = GenerateProperties(
                columns.Where(c => !c.IsPrimarykey && 
                    !IsAuditField(c.DbColumnName)), false);
            
            // 生成更新DTO属性（包含ID，排除审计字段）
            var updateProperties = GenerateProperties(
                columns.Where(c => c.IsPrimarykey || 
                    !IsAuditField(c.DbColumnName)), false);
            
            var dtoCode = DtoTemplate
                .Replace("{Namespace}", "MyProject")
                .Replace("{ClassName}", table.Name)
                .Replace("{PropertyContent}", allProperties)
                .Replace("{CreatePropertyContent}", createProperties)
                .Replace("{UpdatePropertyContent}", updateProperties);
            
            File.WriteAllText(
                Path.Combine(outputPath, $"{table.Name}Dto.cs"), 
                dtoCode);
        }
    }
    
    private string GenerateProperties(IEnumerable<DbColumnInfo> columns, bool withAttributes)
    {
        return string.Join("\n", columns.Select(col =>
        {
            var type = GetCSharpType(col);
            var nullable = col.IsNullable && !type.EndsWith("?") && type != "string" 
                ? "?" : "";
            
            return $"        public {type}{nullable} {col.DbColumnName} {{ get; set; }}";
        }));
    }
    
    private bool IsAuditField(string columnName)
    {
        var auditFields = new[] { "CreateTime", "CreateUserId", "UpdateTime", "UpdateUserId" };
        return auditFields.Contains(columnName);
    }
    
    private string GetCSharpType(DbColumnInfo column)
    {
        return column.DataType.ToLower() switch
        {
            "int" => "int",
            "bigint" => "long",
            "varchar" or "nvarchar" or "text" => "string",
            "datetime" or "datetime2" => "DateTime",
            "bit" => "bool",
            "decimal" or "money" => "decimal",
            "uniqueidentifier" => "Guid",
            _ => "object"
        };
    }
}
```
{% endraw %}

## 12.4 代码生成器

### 12.4.1 生成仓储层

```csharp
public class RepositoryGenerator
{
    private const string RepositoryInterfaceTemplate = @"
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MyProject.Models;

namespace MyProject.IRepositories
{
    /// <summary>
    /// {ClassName}仓储接口
    /// </summary>
    public interface I{ClassName}Repository : IBaseRepository<{ClassName}>
    {
        // 在此添加特定的方法
    }
}";
    
    private const string RepositoryClassTemplate = @"
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using SqlSugar;
using MyProject.Models;
using MyProject.IRepositories;

namespace MyProject.Repositories
{
    /// <summary>
    /// {ClassName}仓储实现
    /// </summary>
    public class {ClassName}Repository : BaseRepository<{ClassName}>, I{ClassName}Repository
    {
        public {ClassName}Repository(ISqlSugarClient db) : base(db)
        {
        }
        
        // 实现特定方法
    }
}";
    
    private const string BaseRepositoryTemplate = @"
using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;
using SqlSugar;

namespace MyProject.Repositories
{
    public interface IBaseRepository<T> where T : class, new()
    {
        Task<T> GetByIdAsync(object id);
        Task<List<T>> GetListAsync();
        Task<List<T>> GetListAsync(Expression<Func<T, bool>> whereExpression);
        Task<PageResult<T>> GetPageListAsync(int pageIndex, int pageSize);
        Task<int> InsertAsync(T entity);
        Task<bool> UpdateAsync(T entity);
        Task<bool> DeleteAsync(object id);
        Task<bool> DeleteAsync(Expression<Func<T, bool>> whereExpression);
    }
    
    public class BaseRepository<T> : IBaseRepository<T> where T : class, new()
    {
        protected readonly ISqlSugarClient _db;
        
        public BaseRepository(ISqlSugarClient db)
        {
            _db = db;
        }
        
        public virtual async Task<T> GetByIdAsync(object id)
        {
            return await _db.Queryable<T>().InSingleAsync(id);
        }
        
        public virtual async Task<List<T>> GetListAsync()
        {
            return await _db.Queryable<T>().ToListAsync();
        }
        
        public virtual async Task<List<T>> GetListAsync(Expression<Func<T, bool>> whereExpression)
        {
            return await _db.Queryable<T>().Where(whereExpression).ToListAsync();
        }
        
        public virtual async Task<PageResult<T>> GetPageListAsync(int pageIndex, int pageSize)
        {
            RefAsync<int> total = 0;
            var list = await _db.Queryable<T>()
                .ToPageListAsync(pageIndex, pageSize, total);
            
            return new PageResult<T>
            {
                PageIndex = pageIndex,
                PageSize = pageSize,
                TotalCount = total,
                Items = list
            };
        }
        
        public virtual async Task<int> InsertAsync(T entity)
        {
            return await _db.Insertable(entity).ExecuteReturnIdentityAsync();
        }
        
        public virtual async Task<bool> UpdateAsync(T entity)
        {
            return await _db.Updateable(entity).ExecuteCommandHasChangeAsync();
        }
        
        public virtual async Task<bool> DeleteAsync(object id)
        {
            return await _db.Deleteable<T>().In(id).ExecuteCommandHasChangeAsync();
        }
        
        public virtual async Task<bool> DeleteAsync(Expression<Func<T, bool>> whereExpression)
        {
            return await _db.Deleteable<T>().Where(whereExpression).ExecuteCommandHasChangeAsync();
        }
    }
}";
    
    public void GenerateRepositories(SqlSugarClient db, string outputPath)
    {
        // 生成基础仓储
        File.WriteAllText(
            Path.Combine(outputPath, "BaseRepository.cs"), 
            BaseRepositoryTemplate);
        
        // 生成各表的仓储
        var tables = db.DbMaintenance.GetTableInfoList();
        
        foreach (var table in tables)
        {
            // 生成接口
            var interfaceCode = RepositoryInterfaceTemplate
                .Replace("{ClassName}", table.Name);
            File.WriteAllText(
                Path.Combine(outputPath, "Interfaces", $"I{table.Name}Repository.cs"),
                interfaceCode);
            
            // 生成实现类
            var classCode = RepositoryClassTemplate
                .Replace("{ClassName}", table.Name);
            File.WriteAllText(
                Path.Combine(outputPath, $"{table.Name}Repository.cs"),
                classCode);
        }
    }
}
```

### 12.4.2 生成服务层

```csharp
public class ServiceGenerator
{
    private const string ServiceInterfaceTemplate = @"
using System.Collections.Generic;
using System.Threading.Tasks;
using MyProject.Models;
using MyProject.Dtos;

namespace MyProject.IServices
{
    public interface I{ClassName}Service
    {
        Task<{ClassName}Dto> GetByIdAsync(int id);
        Task<PageResult<{ClassName}Dto>> GetPageListAsync(int pageIndex, int pageSize);
        Task<int> CreateAsync(Create{ClassName}Dto dto);
        Task<bool> UpdateAsync(int id, Update{ClassName}Dto dto);
        Task<bool> DeleteAsync(int id);
    }
}";
    
    private const string ServiceClassTemplate = @"
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AutoMapper;
using MyProject.Models;
using MyProject.Dtos;
using MyProject.IRepositories;
using MyProject.IServices;

namespace MyProject.Services
{
    public class {ClassName}Service : I{ClassName}Service
    {
        private readonly I{ClassName}Repository _repository;
        private readonly IMapper _mapper;
        
        public {ClassName}Service(
            I{ClassName}Repository repository,
            IMapper mapper)
        {
            _repository = repository;
            _mapper = mapper;
        }
        
        public async Task<{ClassName}Dto> GetByIdAsync(int id)
        {
            var entity = await _repository.GetByIdAsync(id);
            return _mapper.Map<{ClassName}Dto>(entity);
        }
        
        public async Task<PageResult<{ClassName}Dto>> GetPageListAsync(int pageIndex, int pageSize)
        {
            var result = await _repository.GetPageListAsync(pageIndex, pageSize);
            return new PageResult<{ClassName}Dto>
            {
                PageIndex = result.PageIndex,
                PageSize = result.PageSize,
                TotalCount = result.TotalCount,
                Items = _mapper.Map<List<{ClassName}Dto>>(result.Items)
            };
        }
        
        public async Task<int> CreateAsync(Create{ClassName}Dto dto)
        {
            var entity = _mapper.Map<{ClassName}>(dto);
            return await _repository.InsertAsync(entity);
        }
        
        public async Task<bool> UpdateAsync(int id, Update{ClassName}Dto dto)
        {
            var entity = await _repository.GetByIdAsync(id);
            if (entity == null)
                throw new Exception(""记录不存在"");
            
            _mapper.Map(dto, entity);
            return await _repository.UpdateAsync(entity);
        }
        
        public async Task<bool> DeleteAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }
    }
}";
    
    public void GenerateServices(SqlSugarClient db, string outputPath)
    {
        var tables = db.DbMaintenance.GetTableInfoList();
        
        foreach (var table in tables)
        {
            // 生成接口
            var interfaceCode = ServiceInterfaceTemplate
                .Replace("{ClassName}", table.Name);
            File.WriteAllText(
                Path.Combine(outputPath, "Interfaces", $"I{table.Name}Service.cs"),
                interfaceCode);
            
            // 生成实现类
            var classCode = ServiceClassTemplate
                .Replace("{ClassName}", table.Name);
            File.WriteAllText(
                Path.Combine(outputPath, $"{table.Name}Service.cs"),
                classCode);
        }
    }
}
```

### 12.4.3 生成控制器

```csharp
public class ControllerGenerator
{
    private const string ControllerTemplate = @"
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using MyProject.IServices;
using MyProject.Dtos;

namespace MyProject.Api.Controllers
{
    [ApiController]
    [Route(""api/[controller]"")]
    public class {ClassName}Controller : ControllerBase
    {
        private readonly I{ClassName}Service _service;
        
        public {ClassName}Controller(I{ClassName}Service service)
        {
            _service = service;
        }
        
        /// <summary>
        /// 获取{ClassDescription}详情
        /// </summary>
        [HttpGet(""{id}"")]
        public async Task<IActionResult> Get(int id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result == null)
                return NotFound();
            
            return Ok(result);
        }
        
        /// <summary>
        /// 分页查询{ClassDescription}
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetPage([FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _service.GetPageListAsync(pageIndex, pageSize);
            return Ok(result);
        }
        
        /// <summary>
        /// 创建{ClassDescription}
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Create{ClassName}Dto dto)
        {
            var id = await _service.CreateAsync(dto);
            return Ok(new { id });
        }
        
        /// <summary>
        /// 更新{ClassDescription}
        /// </summary>
        [HttpPut(""{id}"")]
        public async Task<IActionResult> Update(int id, [FromBody] Update{ClassName}Dto dto)
        {
            var result = await _service.UpdateAsync(id, dto);
            return Ok(new { success = result });
        }
        
        /// <summary>
        /// 删除{ClassDescription}
        /// </summary>
        [HttpDelete(""{id}"")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.DeleteAsync(id);
            return Ok(new { success = result });
        }
    }
}";
    
    public void GenerateControllers(SqlSugarClient db, string outputPath)
    {
        var tables = db.DbMaintenance.GetTableInfoList();
        
        foreach (var table in tables)
        {
            var controllerCode = ControllerTemplate
                .Replace("{ClassName}", table.Name)
                .Replace("{ClassDescription}", table.Description ?? table.Name);
            
            File.WriteAllText(
                Path.Combine(outputPath, $"{table.Name}Controller.cs"),
                controllerCode);
        }
    }
}
```

## 12.5 保持同步

### 12.5.1 数据库变更检测

```csharp
public class DatabaseChangeDetector
{
    private readonly SqlSugarClient _db;
    
    public DatabaseChangeDetector(SqlSugarClient db)
    {
        _db = db;
    }
    
    // 检测表结构变化
    public List<TableChange> DetectTableChanges(string entityNamespace)
    {
        var changes = new List<TableChange>();
        
        // 获取数据库中的所有表
        var dbTables = _db.DbMaintenance.GetTableInfoList();
        
        // 获取实体类
        var entityTypes = Assembly.Load(entityNamespace)
            .GetTypes()
            .Where(t => t.GetCustomAttribute<SugarTable>() != null)
            .ToList();
        
        // 检测新增的表
        foreach (var dbTable in dbTables)
        {
            if (!entityTypes.Any(t => t.Name == dbTable.Name))
            {
                changes.Add(new TableChange
                {
                    TableName = dbTable.Name,
                    ChangeType = "新增",
                    Description = "数据库中存在，但没有对应的实体类"
                });
            }
        }
        
        // 检测删除的表
        foreach (var entityType in entityTypes)
        {
            var tableName = entityType.Name;
            if (!dbTables.Any(t => t.Name == tableName))
            {
                changes.Add(new TableChange
                {
                    TableName = tableName,
                    ChangeType = "删除",
                    Description = "实体类存在，但数据库中没有对应的表"
                });
            }
        }
        
        // 检测列变化
        foreach (var entityType in entityTypes)
        {
            var tableName = entityType.Name;
            var dbTable = dbTables.FirstOrDefault(t => t.Name == tableName);
            
            if (dbTable != null)
            {
                var columnChanges = DetectColumnChanges(entityType, tableName);
                changes.AddRange(columnChanges);
            }
        }
        
        return changes;
    }
    
    private List<TableChange> DetectColumnChanges(Type entityType, string tableName)
    {
        var changes = new List<TableChange>();
        
        // 获取数据库列
        var dbColumns = _db.DbMaintenance.GetColumnInfosByTableName(tableName, false);
        
        // 获取实体属性
        var properties = entityType.GetProperties()
            .Where(p => !p.GetCustomAttributes<SugarColumn>()
                .Any(a => a.IsIgnore))
            .ToList();
        
        // 检测新增的列
        foreach (var dbColumn in dbColumns)
        {
            if (!properties.Any(p => p.Name == dbColumn.DbColumnName))
            {
                changes.Add(new TableChange
                {
                    TableName = tableName,
                    ColumnName = dbColumn.DbColumnName,
                    ChangeType = "列新增",
                    Description = $"数据库中存在列，但实体类没有对应属性"
                });
            }
        }
        
        // 检测删除的列
        foreach (var property in properties)
        {
            if (!dbColumns.Any(c => c.DbColumnName == property.Name))
            {
                changes.Add(new TableChange
                {
                    TableName = tableName,
                    ColumnName = property.Name,
                    ChangeType = "列删除",
                    Description = "实体类有属性，但数据库中没有对应的列"
                });
            }
        }
        
        return changes;
    }
}

public class TableChange
{
    public string TableName { get; set; }
    public string ColumnName { get; set; }
    public string ChangeType { get; set; }
    public string Description { get; set; }
}
```

### 12.5.2 自动更新实体

```csharp
public class AutoEntityUpdater
{
    private readonly SqlSugarClient _db;
    
    public AutoEntityUpdater(SqlSugarClient db)
    {
        _db = db;
    }
    
    // 自动更新实体类
    public void UpdateEntities(string outputPath, string entityNamespace)
    {
        var detector = new DatabaseChangeDetector(_db);
        var changes = detector.DetectTableChanges(entityNamespace);
        
        if (!changes.Any())
        {
            Console.WriteLine("没有检测到变化");
            return;
        }
        
        Console.WriteLine($"检测到 {changes.Count} 个变化:");
        foreach (var change in changes)
        {
            Console.WriteLine($"  {change.ChangeType}: {change.TableName}.{change.ColumnName}");
        }
        
        // 重新生成受影响的实体类
        var affectedTables = changes.Select(c => c.TableName).Distinct();
        
        foreach (var tableName in affectedTables)
        {
            Console.WriteLine($"正在更新实体: {tableName}");
            
            _db.DbFirst
                .Where(tableName)
                .IsCreateAttribute()
                .IsCreateDefaultValue()
                .CreateClassFile(outputPath, entityNamespace);
        }
        
        Console.WriteLine("实体类更新完成");
    }
    
    // 监控数据库变化并自动更新
    public void StartAutoUpdate(string outputPath, string entityNamespace, TimeSpan interval)
    {
        var timer = new Timer(_ =>
        {
            try
            {
                UpdateEntities(outputPath, entityNamespace);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"自动更新失败: {ex.Message}");
            }
        }, null, TimeSpan.Zero, interval);
    }
}
```

## 12.6 自动化工具

创建完整的代码生成工具：

```csharp
public class CodeGeneratorTool
{
    private readonly SqlSugarClient _db;
    private readonly string _outputPath;
    private readonly string _namespace;
    
    public CodeGeneratorTool(string connectionString, string outputPath, string @namespace)
    {
        _db = new SqlSugarClient(new ConnectionConfig
        {
            ConnectionString = connectionString,
            DbType = DbType.SqlServer,
            IsAutoCloseConnection = true
        });
        
        _outputPath = outputPath;
        _namespace = @namespace;
    }
    
    // 生成所有代码
    public void GenerateAll()
    {
        Console.WriteLine("开始生成代码...");
        
        // 1. 生成实体类
        Console.WriteLine("生成实体类...");
        GenerateEntities();
        
        // 2. 生成DTO
        Console.WriteLine("生成DTO...");
        GenerateDtos();
        
        // 3. 生成仓储
        Console.WriteLine("生成仓储层...");
        GenerateRepositories();
        
        // 4. 生成服务
        Console.WriteLine("生成服务层...");
        GenerateServices();
        
        // 5. 生成控制器
        Console.WriteLine("生成控制器...");
        GenerateControllers();
        
        // 6. 生成AutoMapper配置
        Console.WriteLine("生成AutoMapper配置...");
        GenerateMapperProfile();
        
        Console.WriteLine("代码生成完成！");
    }
    
    private void GenerateEntities()
    {
        _db.DbFirst
            .IsCreateAttribute()
            .IsCreateDefaultValue()
            .CreateClassFile(Path.Combine(_outputPath, "Models"), $"{_namespace}.Models");
    }
    
    private void GenerateDtos()
    {
        var generator = new AdvancedTemplateGenerator();
        generator.GenerateAdvancedEntities(_db, _outputPath);
    }
    
    private void GenerateRepositories()
    {
        var generator = new RepositoryGenerator();
        generator.GenerateRepositories(_db, Path.Combine(_outputPath, "Repositories"));
    }
    
    private void GenerateServices()
    {
        var generator = new ServiceGenerator();
        generator.GenerateServices(_db, Path.Combine(_outputPath, "Services"));
    }
    
    private void GenerateControllers()
    {
        var generator = new ControllerGenerator();
        generator.GenerateControllers(_db, Path.Combine(_outputPath, "Controllers"));
    }
    
    private void GenerateMapperProfile()
    {
        // 生成AutoMapper配置代码
        var profile = @"
using AutoMapper;
using MyProject.Models;
using MyProject.Dtos;

namespace MyProject
{
    public class AutoMapperProfile : Profile
    {
        public AutoMapperProfile()
        {
";
        var tables = _db.DbMaintenance.GetTableInfoList();
        foreach (var table in tables)
        {
            profile += $"            CreateMap<{table.Name}, {table.Name}Dto>();\n";
            profile += $"            CreateMap<Create{table.Name}Dto, {table.Name}>();\n";
            profile += $"            CreateMap<Update{table.Name}Dto, {table.Name}>();\n";
        }
        
        profile += @"        }
    }
}";
        
        File.WriteAllText(Path.Combine(_outputPath, "AutoMapperProfile.cs"), profile);
    }
}

// 使用示例
class Program
{
    static void Main(string[] args)
    {
        var connectionString = "server=.;database=MyDB;uid=sa;pwd=123";
        var outputPath = "./Generated";
        var @namespace = "MyProject";
        
        var tool = new CodeGeneratorTool(connectionString, outputPath, @namespace);
        tool.GenerateAll();
        
        Console.WriteLine("按任意键退出...");
        Console.ReadKey();
    }
}
```

## 12.7 本章小结

本章详细介绍了SqlSugar的DbFirst与代码生成功能：

1. **DbFirst概念**：理解了数据库优先的开发模式及其优势
2. **实体生成**：掌握了生成单表和批量生成实体类的方法
3. **模板定制**：学会了自定义代码模板，生成符合项目规范的代码
4. **代码生成器**：实现了完整的三层架构代码生成，包括仓储、服务和控制器
5. **同步机制**：掌握了检测数据库变更和自动更新实体类的方法
6. **自动化工具**：创建了完整的代码生成工具，大幅提高开发效率

通过本章的学习，您应该能够快速从数据库生成完整的项目代码，并保持代码与数据库的同步。在下一章中，我们将学习SqlSugar的多数据库支持功能。
