---
layout: default
title: 第六章：SQL-MAP技术深入
---

# 第六章：SQL-MAP技术深入

## 6.1 SQL-MAP概述

### 6.1.1 什么是SQL-MAP

SQL-MAP是SOD框架的核心功能之一，它的核心思想是：**将SQL语句映射为程序代码**。

SQL-MAP技术解决了以下问题：
1. **SQL与代码分离**：SQL语句集中管理，便于DBA审核和优化
2. **参数化查询统一**：解决不同数据库参数语法不一致的问题
3. **代码自动生成**：根据SQL配置自动生成DAL层代码
4. **维护性提升**：修改SQL无需重新编译程序（使用外部配置时）

### 6.1.2 SQL-MAP的工作流程

```
SQL-MAP配置文件(XML) → 解析器 → CommandInfo对象 → AdoHelper执行 → 结果
        ↓
  代码生成工具 → DAL类代码
```

### 6.1.3 SQL-MAP vs ORM

| 特性 | SQL-MAP | ORM/OQL |
|------|---------|---------|
| SQL可控性 | 完全控制 | 框架生成 |
| 适用场景 | 复杂SQL、性能敏感 | 常规CRUD |
| DBA友好 | 是 | 一般 |
| 开发效率 | 中等 | 高 |
| 学习成本 | 低（会SQL即可） | 中等 |
| 类型安全 | 弱 | 强 |

## 6.2 SQL-MAP配置文件

### 6.2.1 配置文件结构

SQL-MAP配置文件是XML格式，基本结构如下：

```xml
<?xml version="1.0" encoding="utf-8" ?>
<SqlMap xmlns="http://tempuri.org/SqlMap.xsd">
  
  <!-- 数据库连接配置 -->
  <DataSource>
    <Default>local</Default>
  </DataSource>
  
  <!-- 命令类配置 -->
  <CommandClass Name="UserManagement" Description="用户管理" Class="UserDAL">
    
    <!-- Select查询 -->
    <Select CommandName="GetUserById" Description="根据ID获取用户">
      <![CDATA[
        SELECT * FROM TbUser WHERE ID = #ID:Int32#
      ]]>
    </Select>
    
    <!-- Insert插入 -->
    <Insert CommandName="AddUser" Description="添加用户">
      <![CDATA[
        INSERT INTO TbUser (Name, Email, Status, CreateTime) 
        VALUES (#Name:String,50#, #Email:String,100#, #Status:Int32#, #CreateTime:DateTime#)
      ]]>
    </Insert>
    
    <!-- Update更新 -->
    <Update CommandName="UpdateUser" Description="更新用户">
      <![CDATA[
        UPDATE TbUser SET Name=#Name:String,50#, Email=#Email:String,100# 
        WHERE ID=#ID:Int32#
      ]]>
    </Update>
    
    <!-- Delete删除 -->
    <Delete CommandName="DeleteUser" Description="删除用户">
      <![CDATA[
        DELETE FROM TbUser WHERE ID=#ID:Int32#
      ]]>
    </Delete>
    
  </CommandClass>
  
</SqlMap>
```

### 6.2.2 CommandClass节点

```xml
<CommandClass 
    Name="UserManagement"      <!-- 类名 -->
    Description="用户管理"      <!-- 描述 -->
    Class="UserDAL"            <!-- 生成的DAL类名 -->
    Namespace="MyApp.DAL">     <!-- 命名空间 -->
  
  <!-- 内部包含各种SQL命令 -->
  
</CommandClass>
```

### 6.2.3 SQL命令节点类型

| 节点类型 | 说明 | 默认返回类型 |
|----------|------|-------------|
| Select | 查询语句 | DataSet |
| Insert | 插入语句 | Int32（受影响行数） |
| Update | 更新语句 | Int32（受影响行数） |
| Delete | 删除语句 | Int32（受影响行数） |

### 6.2.4 命令节点属性

```xml
<Select 
    CommandName="GetUsers"           <!-- 命令名称（生成的方法名） -->
    CommandType="Text"               <!-- 命令类型：Text/StoredProcedure -->
    Description="获取用户列表"        <!-- 描述 -->
    Method="GetAllUsers"             <!-- 自定义方法名 -->
    ResultClass="DataSet">           <!-- 返回类型 -->
  
  <!-- SQL语句 -->
  
</Select>
```

## 6.3 抽象SQL参数

### 6.3.1 参数语法

SQL-MAP使用统一的参数语法，格式为：

```
#参数名称[:参数类型][,数据类型][,参数长度][,参数方向]#
```

| 组成部分 | 必需 | 说明 | 示例 |
|----------|------|------|------|
| 参数名称 | 是 | 参数的名称 | ID |
| 参数类型 | 否 | .NET数据类型 | Int32, String, DateTime |
| 数据类型 | 否 | 数据库类型 | NVarChar, Int |
| 参数长度 | 否 | 字段长度 | 50, 100 |
| 参数方向 | 否 | 输入/输出 | Input, Output |

### 6.3.2 参数示例

```xml
<!-- 基本参数 -->
#ID#                         <!-- 默认String类型 -->
#ID:Int32#                   <!-- Int32类型 -->
#Name:String#                <!-- String类型 -->
#CreateTime:DateTime#        <!-- DateTime类型 -->

<!-- 带长度的参数 -->
#Name:String,NVarChar,50#    <!-- String类型，NVarChar，长度50 -->
#Email:String,NVarChar,100#

<!-- 输出参数 -->
#TotalCount:Int32,,Output#   <!-- 输出参数 -->

<!-- 简化写法（只指定类型和长度） -->
#Name:String,50#             <!-- 常用简化形式 -->
```

### 6.3.3 跨数据库参数转换

SQL-MAP的抽象参数语法会在运行时根据具体数据库转换：

```
原始SQL：SELECT * FROM User WHERE ID=#ID:Int32#

转换后：
SQL Server → SELECT * FROM User WHERE ID=@ID
MySQL      → SELECT * FROM User WHERE ID=?ID
Oracle     → SELECT * FROM User WHERE ID=:ID
PostgreSQL → SELECT * FROM User WHERE ID=$1
Access     → SELECT * FROM User WHERE ID=?
```

## 6.4 完整的SQL-MAP配置示例

### 6.4.1 用户管理模块

创建`SqlMap.config`文件：

```xml
<?xml version="1.0" encoding="utf-8" ?>
<SqlMap xmlns="http://tempuri.org/SqlMap.xsd">
  
  <DataSource>
    <Default>local</Default>
  </DataSource>
  
  <CommandClass Name="UserManagement" Description="用户管理" Class="UserDAL">
    
    <!-- 查询所有用户 -->
    <Select CommandName="GetAllUsers" Description="获取所有用户" ResultClass="DataSet">
      <![CDATA[
        SELECT ID, Name, Email, Status, CreateTime 
        FROM TbUser 
        ORDER BY ID DESC
      ]]>
    </Select>
    
    <!-- 根据ID查询用户 -->
    <Select CommandName="GetUserById" Description="根据ID获取用户" ResultClass="DataSet">
      <![CDATA[
        SELECT ID, Name, Email, Status, CreateTime 
        FROM TbUser 
        WHERE ID = #ID:Int32#
      ]]>
    </Select>
    
    <!-- 条件查询用户 -->
    <Select CommandName="SearchUsers" Description="搜索用户" ResultClass="DataSet">
      <![CDATA[
        SELECT ID, Name, Email, Status, CreateTime 
        FROM TbUser 
        WHERE 1=1
        AND (@Name IS NULL OR Name LIKE '%' + #Name:String,50# + '%')
        AND (@Status IS NULL OR Status = #Status:Int32#)
        ORDER BY ID DESC
      ]]>
    </Select>
    
    <!-- 分页查询用户 -->
    <Select CommandName="GetUsersByPage" Description="分页获取用户" ResultClass="DataSet">
      <![CDATA[
        SELECT ID, Name, Email, Status, CreateTime 
        FROM TbUser 
        WHERE Status = #Status:Int32#
        ORDER BY ID DESC
        OFFSET #Offset:Int32# ROWS
        FETCH NEXT #PageSize:Int32# ROWS ONLY
      ]]>
    </Select>
    
    <!-- 获取用户总数 -->
    <Select CommandName="GetUserCount" Description="获取用户总数" ResultClass="Scalar">
      <![CDATA[
        SELECT COUNT(*) FROM TbUser WHERE Status = #Status:Int32#
      ]]>
    </Select>
    
    <!-- 添加用户 -->
    <Insert CommandName="AddUser" Description="添加用户">
      <![CDATA[
        INSERT INTO TbUser (Name, Email, Status, CreateTime) 
        VALUES (#Name:String,50#, #Email:String,100#, #Status:Int32#, #CreateTime:DateTime#);
        SELECT SCOPE_IDENTITY();
      ]]>
    </Insert>
    
    <!-- 更新用户 -->
    <Update CommandName="UpdateUser" Description="更新用户">
      <![CDATA[
        UPDATE TbUser 
        SET Name = #Name:String,50#, 
            Email = #Email:String,100#,
            Status = #Status:Int32#
        WHERE ID = #ID:Int32#
      ]]>
    </Update>
    
    <!-- 删除用户 -->
    <Delete CommandName="DeleteUser" Description="删除用户">
      <![CDATA[
        DELETE FROM TbUser WHERE ID = #ID:Int32#
      ]]>
    </Delete>
    
    <!-- 批量删除用户 -->
    <Delete CommandName="BatchDeleteUsers" Description="批量删除用户">
      <![CDATA[
        DELETE FROM TbUser WHERE ID IN (#IDs#)
      ]]>
    </Delete>
    
  </CommandClass>
  
</SqlMap>
```

### 6.4.2 存储过程调用

```xml
<Select CommandName="GetUsersByDept" 
        CommandType="StoredProcedure" 
        Description="根据部门获取用户">
  <![CDATA[
    sp_GetUsersByDept
  ]]>
  <!-- 存储过程参数 -->
  <Parameter Name="DeptId" Type="Int32" Direction="Input"/>
  <Parameter Name="TotalCount" Type="Int32" Direction="Output"/>
</Select>
```

## 6.5 使用SQL-MAP

### 6.5.1 加载配置文件

```csharp
using PWMIS.DataMap.SqlMap;

// 方式1：从配置文件加载
SqlMapper mapper = new SqlMapper("SqlMap.config");

// 方式2：从嵌入资源加载
SqlMapper mapper = new SqlMapper();
mapper.EmbedAssemblySource = "MyApp,MyApp.SqlMap.config";

// 方式3：使用DBMapper基类（推荐）
public class UserDAL : DBMapper
{
    public UserDAL()
    {
        Mapper.CommandClassName = "UserManagement";
        Mapper.EmbedAssemblySource = "MyApp,MyApp.SqlMap.config";
    }
}
```

### 6.5.2 执行查询

```csharp
public class UserDAL : DBMapper
{
    public UserDAL()
    {
        Mapper.CommandClassName = "UserManagement";
        Mapper.EmbedAssemblySource = "MyApp,MyApp.SqlMap.config";
    }
    
    // 获取所有用户
    public DataSet GetAllUsers()
    {
        CommandInfo cmdInfo = Mapper.GetCommandInfo("GetAllUsers");
        return CurrentDataBase.ExecuteDataSet(
            CurrentDataBase.ConnectionString,
            cmdInfo.CommandType,
            cmdInfo.CommandText,
            cmdInfo.DataParameters);
    }
    
    // 根据ID获取用户
    public DataSet GetUserById(int id)
    {
        CommandInfo cmdInfo = Mapper.GetCommandInfo("GetUserById");
        cmdInfo.DataParameters[0].Value = id;  // 设置参数值
        
        return CurrentDataBase.ExecuteDataSet(
            CurrentDataBase.ConnectionString,
            cmdInfo.CommandType,
            cmdInfo.CommandText,
            cmdInfo.DataParameters);
    }
    
    // 添加用户
    public int AddUser(string name, string email, int status)
    {
        CommandInfo cmdInfo = Mapper.GetCommandInfo("AddUser");
        cmdInfo.DataParameters[0].Value = name;
        cmdInfo.DataParameters[1].Value = email;
        cmdInfo.DataParameters[2].Value = status;
        cmdInfo.DataParameters[3].Value = DateTime.Now;
        
        // 返回新增的ID
        object result = CurrentDataBase.ExecuteScalar(
            CurrentDataBase.ConnectionString,
            cmdInfo.CommandType,
            cmdInfo.CommandText,
            cmdInfo.DataParameters);
            
        return Convert.ToInt32(result);
    }
    
    // 更新用户
    public int UpdateUser(int id, string name, string email, int status)
    {
        CommandInfo cmdInfo = Mapper.GetCommandInfo("UpdateUser");
        cmdInfo.DataParameters[0].Value = name;
        cmdInfo.DataParameters[1].Value = email;
        cmdInfo.DataParameters[2].Value = status;
        cmdInfo.DataParameters[3].Value = id;
        
        return CurrentDataBase.ExecuteNonQuery(
            CurrentDataBase.ConnectionString,
            cmdInfo.CommandType,
            cmdInfo.CommandText,
            cmdInfo.DataParameters);
    }
    
    // 删除用户
    public int DeleteUser(int id)
    {
        CommandInfo cmdInfo = Mapper.GetCommandInfo("DeleteUser");
        cmdInfo.DataParameters[0].Value = id;
        
        return CurrentDataBase.ExecuteNonQuery(
            CurrentDataBase.ConnectionString,
            cmdInfo.CommandType,
            cmdInfo.CommandText,
            cmdInfo.DataParameters);
    }
}
```

### 6.5.3 使用示例

```csharp
// 使用UserDAL
UserDAL userDal = new UserDAL();

// 获取所有用户
DataSet ds = userDal.GetAllUsers();
DataTable dt = ds.Tables[0];
foreach(DataRow row in dt.Rows)
{
    Console.WriteLine($"ID={row["ID"]}, Name={row["Name"]}");
}

// 添加用户
int newId = userDal.AddUser("张三", "zhangsan@example.com", 1);
Console.WriteLine($"新用户ID: {newId}");

// 更新用户
userDal.UpdateUser(newId, "张三（已更新）", "zhangsan_new@example.com", 1);

// 删除用户
userDal.DeleteUser(newId);
```

## 6.6 DAL代码自动生成

### 6.6.1 使用集成开发工具

SOD框架提供了集成开发工具，可以根据SQL-MAP配置文件自动生成DAL代码：

1. 打开SOD集成开发工具
2. 加载SQL-MAP配置文件
3. 点击"生成DAL代码"
4. 选择输出目录和命名空间
5. 生成代码

### 6.6.2 生成的DAL代码示例

```csharp
using System;
using System.Data;
using System.Collections.Generic;
using PWMIS.DataMap.SqlMap;
using PWMIS.DataMap.Entity;
using PWMIS.Common;

namespace MyApp.DAL
{
    /// <summary>
    /// 用户管理
    /// </summary>
    public partial class UserDAL : DBMapper
    {
        public UserDAL()
        {
            Mapper.CommandClassName = "UserManagement";
            Mapper.EmbedAssemblySource = "MyApp,MyApp.SqlMap.config";
        }

        /// <summary>
        /// 获取所有用户
        /// </summary>
        /// <returns></returns>
        public DataSet GetAllUsers()
        {
            CommandInfo cmdInfo = Mapper.GetCommandInfo("GetAllUsers");
            return CurrentDataBase.ExecuteDataSet(
                CurrentDataBase.ConnectionString, 
                cmdInfo.CommandType, 
                cmdInfo.CommandText, 
                cmdInfo.DataParameters);
        }

        /// <summary>
        /// 根据ID获取用户
        /// </summary>
        /// <param name="ID"></param>
        /// <returns></returns>
        public DataSet GetUserById(Int32 ID)
        {
            CommandInfo cmdInfo = Mapper.GetCommandInfo("GetUserById");
            cmdInfo.DataParameters[0].Value = ID;
            return CurrentDataBase.ExecuteDataSet(
                CurrentDataBase.ConnectionString, 
                cmdInfo.CommandType, 
                cmdInfo.CommandText, 
                cmdInfo.DataParameters);
        }

        /// <summary>
        /// 添加用户
        /// </summary>
        /// <param name="Name"></param>
        /// <param name="Email"></param>
        /// <param name="Status"></param>
        /// <param name="CreateTime"></param>
        /// <returns></returns>
        public Object AddUser(String Name, String Email, Int32 Status, DateTime CreateTime)
        {
            CommandInfo cmdInfo = Mapper.GetCommandInfo("AddUser");
            cmdInfo.DataParameters[0].Value = Name;
            cmdInfo.DataParameters[1].Value = Email;
            cmdInfo.DataParameters[2].Value = Status;
            cmdInfo.DataParameters[3].Value = CreateTime;
            return CurrentDataBase.ExecuteScalar(
                CurrentDataBase.ConnectionString, 
                cmdInfo.CommandType, 
                cmdInfo.CommandText, 
                cmdInfo.DataParameters);
        }

        /// <summary>
        /// 更新用户
        /// </summary>
        /// <param name="Name"></param>
        /// <param name="Email"></param>
        /// <param name="Status"></param>
        /// <param name="ID"></param>
        /// <returns></returns>
        public Int32 UpdateUser(String Name, String Email, Int32 Status, Int32 ID)
        {
            CommandInfo cmdInfo = Mapper.GetCommandInfo("UpdateUser");
            cmdInfo.DataParameters[0].Value = Name;
            cmdInfo.DataParameters[1].Value = Email;
            cmdInfo.DataParameters[2].Value = Status;
            cmdInfo.DataParameters[3].Value = ID;
            return CurrentDataBase.ExecuteNonQuery(
                CurrentDataBase.ConnectionString, 
                cmdInfo.CommandType, 
                cmdInfo.CommandText, 
                cmdInfo.DataParameters);
        }

        /// <summary>
        /// 删除用户
        /// </summary>
        /// <param name="ID"></param>
        /// <returns></returns>
        public Int32 DeleteUser(Int32 ID)
        {
            CommandInfo cmdInfo = Mapper.GetCommandInfo("DeleteUser");
            cmdInfo.DataParameters[0].Value = ID;
            return CurrentDataBase.ExecuteNonQuery(
                CurrentDataBase.ConnectionString, 
                cmdInfo.CommandType, 
                cmdInfo.CommandText, 
                cmdInfo.DataParameters);
        }
    }
}
```

## 6.7 SQL-MAP与实体类结合

### 6.7.1 查询结果映射到实体类

```csharp
public class UserDAL : DBMapper
{
    // ... 构造函数略

    // 获取用户列表（映射到实体类）
    public List<UserEntity> GetUserList()
    {
        CommandInfo cmdInfo = Mapper.GetCommandInfo("GetAllUsers");
        
        // 使用ExecuteMapper映射
        return CurrentDataBase.ExecuteMapper(
            cmdInfo.CommandText, 
            cmdInfo.DataParameters)
            .MapToList<UserEntity>();
    }
    
    // 获取单个用户
    public UserEntity GetUser(int id)
    {
        CommandInfo cmdInfo = Mapper.GetCommandInfo("GetUserById");
        cmdInfo.DataParameters[0].Value = id;
        
        return CurrentDataBase.ExecuteMapper(
            cmdInfo.CommandText, 
            cmdInfo.DataParameters)
            .MapToSingle<UserEntity>();
    }
}
```

### 6.7.2 SQL-MAP实体类查询

```xml
<Select CommandName="GetActiveUsers" 
        Description="获取活动用户" 
        ResultClass="UserEntity">
  <![CDATA[
    SELECT ID, Name, Email, Status, CreateTime 
    FROM TbUser 
    WHERE Status = 1
  ]]>
</Select>
```

```csharp
public List<UserEntity> GetActiveUsers()
{
    CommandInfo cmdInfo = Mapper.GetCommandInfo("GetActiveUsers");
    // ResultClass指定了UserEntity，框架自动映射
    return EntityQuery<UserEntity>.QueryList(cmdInfo, CurrentDataBase);
}
```

## 6.8 最佳实践

### 6.8.1 SQL-MAP文件组织

```
MyApp/
├── SqlMaps/
│   ├── User.SqlMap.config      # 用户模块
│   ├── Order.SqlMap.config     # 订单模块
│   └── Product.SqlMap.config   # 产品模块
├── DAL/
│   ├── UserDAL.cs
│   ├── OrderDAL.cs
│   └── ProductDAL.cs
```

### 6.8.2 使用场景选择

| 场景 | 推荐方式 |
|------|----------|
| 简单CRUD | ORM/OQL |
| 复杂报表查询 | SQL-MAP |
| 性能敏感的批量操作 | SQL-MAP |
| 需要DBA审核的SQL | SQL-MAP |
| 存储过程调用 | SQL-MAP |
| 快速原型开发 | ORM/OQL |

### 6.8.3 SQL-MAP与ORM混合使用

```csharp
public class UserService
{
    private readonly UserDAL _userDal;
    private readonly AdoHelper _db;
    
    public UserService()
    {
        _userDal = new UserDAL();
        _db = MyDB.GetDBHelper();
    }
    
    // 复杂查询使用SQL-MAP
    public DataTable GetUserReport(DateTime startDate, DateTime endDate)
    {
        return _userDal.GetUserReport(startDate, endDate).Tables[0];
    }
    
    // 简单CRUD使用ORM
    public UserEntity GetUser(int id)
    {
        var user = new UserEntity { ID = id };
        var oql = OQL.From(user).Select().Where(user.ID).END;
        return EntityQuery<UserEntity>.QueryObject(oql, _db);
    }
    
    public void UpdateUser(UserEntity user)
    {
        EntityQuery<UserEntity>.Instance.Update(user, _db);
    }
}
```

## 6.9 本章小结

本章详细介绍了SQL-MAP技术：

1. **SQL-MAP概念**：将SQL映射为程序代码的技术
2. **配置文件**：XML格式的SQL-MAP配置结构
3. **抽象参数**：跨数据库的统一参数语法
4. **执行SQL-MAP**：DBMapper基类和CommandInfo的使用
5. **代码生成**：自动生成DAL层代码
6. **与实体结合**：SQL-MAP查询结果映射到实体类
7. **最佳实践**：SQL-MAP与ORM的合理搭配使用

SQL-MAP技术让开发者能够完全控制SQL语句，同时享受框架的便利性，是SOD框架三大核心功能之一。

---

> **下一章预告**：第七章将介绍SOD框架的数据窗体开发技术，包括WebForm和WinForm的数据控件使用。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/csharp/sod/第05章-OQL查询语言详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/sod/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/csharp/sod/第07章-数据窗体开发/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
