---
layout: default
title: 第11章：安全与权限管理API
---

# 第11章：安全与权限管理API

## 11.1 GeoServer 安全架构

GeoServer 提供了完善的安全机制，包括身份认证、授权和访问控制。通过 REST API 可以程序化地管理这些安全设置。

### 11.1.1 安全组件

- **用户（Users）**：系统用户账户
- **用户组（User Groups）**：用户的逻辑分组
- **角色（Roles）**：权限的集合
- **访问规则（Access Rules）**：资源级别的权限控制
- **认证提供者（Authentication Providers）**：身份验证机制
- **认证过滤器（Authentication Filters）**：请求过滤和验证

## 11.2 用户和用户组管理

### 11.2.1 UserGroupService 接口

```csharp
public class UserGroupService
{
    // 用户管理
    public async Task<User[]> GetUsersAsync(string userGroupServiceName);
    public async Task<User> GetUserAsync(string userGroupServiceName, string username);
    public async Task CreateUserAsync(string userGroupServiceName, User user);
    public async Task UpdateUserAsync(string userGroupServiceName, string username, User user);
    public async Task DeleteUserAsync(string userGroupServiceName, string username);
    
    // 用户组管理
    public async Task<UserGroup[]> GetUserGroupsAsync(string userGroupServiceName);
    public async Task<UserGroup> GetUserGroupAsync(string userGroupServiceName, string groupName);
    public async Task CreateUserGroupAsync(string userGroupServiceName, UserGroup group);
    public async Task DeleteUserGroupAsync(string userGroupServiceName, string groupName);
}
```

### 11.2.2 创建用户

```csharp
using var factory = new GeoServerClientFactory(options);
var userGroupService = factory.CreateUserGroupService();

// 创建新用户
var newUser = new User
{
    Username = "john_doe",
    Password = "SecurePassword123!",
    Enabled = true
};

await userGroupService.CreateUserAsync("default", newUser);
Console.WriteLine("用户创建成功!");

// 为用户分配到组
var user = await userGroupService.GetUserAsync("default", "john_doe");
user.Groups = new[] { "editors", "viewers" };
await userGroupService.UpdateUserAsync("default", "john_doe", user);
```

### 11.2.3 创建用户组

```csharp
var userGroup = new UserGroup
{
    GroupName = "project_team",
    Enabled = true
};

await userGroupService.CreateUserGroupAsync("default", userGroup);

// 添加用户到组
var members = new[] { "john_doe", "jane_smith", "bob_wilson" };
foreach (var member in members)
{
    var user = await userGroupService.GetUserAsync("default", member);
    var groups = user.Groups?.ToList() ?? new List<string>();
    groups.Add("project_team");
    user.Groups = groups.ToArray();
    await userGroupService.UpdateUserAsync("default", member, user);
}
```

## 11.3 角色管理

### 11.3.1 RoleService 接口

```csharp
public class RoleService
{
    public async Task<Role[]> GetRolesAsync(string roleServiceName);
    public async Task<Role> GetRoleAsync(string roleServiceName, string roleName);
    public async Task CreateRoleAsync(string roleServiceName, Role role);
    public async Task DeleteRoleAsync(string roleServiceName, string roleName);
    
    // 角色分配
    public async Task AssignRoleToUserAsync(string roleServiceName, string roleName, string username);
    public async Task AssignRoleToGroupAsync(string roleServiceName, string roleName, string groupName);
}
```

### 11.3.2 创建和分配角色

```csharp
var roleService = factory.CreateRoleService();

// 创建角色
var role = new Role
{
    RoleName = "DATA_EDITOR",
    ParentRole = "AUTHENTICATED"
};

await roleService.CreateRoleAsync("default", role);

// 分配角色给用户
await roleService.AssignRoleToUserAsync("default", "DATA_EDITOR", "john_doe");

// 分配角色给组
await roleService.AssignRoleToGroupAsync("default", "DATA_EDITOR", "project_team");
```

## 11.4 访问控制规则

### 11.4.1 SecurityService 接口

```csharp
public class SecurityService
{
    // 获取访问规则
    public async Task<AccessRule[]> GetAccessRulesAsync();
    
    // 添加访问规则
    public async Task AddAccessRuleAsync(AccessRule rule);
    
    // 更新访问规则
    public async Task UpdateAccessRuleAsync(string ruleId, AccessRule rule);
    
    // 删除访问规则
    public async Task DeleteAccessRuleAsync(string ruleId);
}
```

### 11.4.2 配置数据访问规则

```csharp
var securityService = factory.CreateSecurityService();

// 为工作空间设置访问规则
var workspaceRule = new AccessRule
{
    Resource = "myWorkspace.*.*",
    Roles = new[] { "DATA_EDITOR", "ADMIN" },
    AccessMode = "READ_WRITE"
};

await securityService.AddAccessRuleAsync(workspaceRule);

// 为特定图层设置只读访问
var layerRule = new AccessRule
{
    Resource = "myWorkspace.cities.r",
    Roles = new[] { "VIEWER" },
    AccessMode = "READ"
};

await securityService.AddAccessRuleAsync(layerRule);

// 限制服务访问
var serviceRule = new AccessRule
{
    Resource = "wfs.*.*",
    Roles = new[] { "WFS_USER", "ADMIN" },
    AccessMode = "READ_WRITE"
};

await securityService.AddAccessRuleAsync(serviceRule);
```

## 11.5 认证配置

### 11.5.1 Authentication Filter Service

```csharp
public class AuthenticationFilterService
{
    public async Task<AuthenticationFilter[]> GetFiltersAsync();
    public async Task<AuthenticationFilter> GetFilterAsync(string filterName);
    public async Task CreateFilterAsync(AuthenticationFilter filter);
    public async Task UpdateFilterAsync(string filterName, AuthenticationFilter filter);
    public async Task DeleteFilterAsync(string filterName);
}
```

### 11.5.2 配置基本认证过滤器

```csharp
var authFilterService = factory.CreateAuthenticationFilterService();

var basicAuthFilter = new AuthenticationFilter
{
    Name = "basic_auth",
    ClassName = "org.geoserver.security.filter.GeoServerBasicAuthenticationFilter",
    UseFormLogin = false
};

await authFilterService.CreateFilterAsync(basicAuthFilter);
```

## 11.6 密码策略管理

### 11.6.1 PasswordService 接口

```csharp
public class PasswordService
{
    public async Task<PasswordPolicy> GetPasswordPolicyAsync(string policyName);
    public async Task UpdatePasswordPolicyAsync(string policyName, PasswordPolicy policy);
}
```

### 11.6.2 配置密码策略

```csharp
var passwordService = factory.CreatePasswordService();

var policy = new PasswordPolicy
{
    Name = "strong_password",
    MinLength = 12,
    MaxLength = 64,
    DigitRequired = true,
    UppercaseRequired = true,
    LowercaseRequired = true,
    SpecialCharRequired = true,
    UnlimitedLength = false
};

await passwordService.UpdatePasswordPolicyAsync("default", policy);
```

## 11.7 完整的安全配置示例

### 11.7.1 为新项目配置安全

```csharp
public class ProjectSecurityConfigurator
{
    private readonly UserGroupService _userGroupService;
    private readonly RoleService _roleService;
    private readonly SecurityService _securityService;

    public async Task ConfigureProjectSecurityAsync(string projectName)
    {
        // 1. 创建项目角色
        var viewerRole = new Role { RoleName = $"{projectName}_VIEWER" };
        var editorRole = new Role { RoleName = $"{projectName}_EDITOR" };
        var adminRole = new Role { RoleName = $"{projectName}_ADMIN" };

        await _roleService.CreateRoleAsync("default", viewerRole);
        await _roleService.CreateRoleAsync("default", editorRole);
        await _roleService.CreateRoleAsync("default", adminRole);

        // 2. 创建用户组
        var viewerGroup = new UserGroup { GroupName = $"{projectName}_viewers" };
        var editorGroup = new UserGroup { GroupName = $"{projectName}_editors" };

        await _userGroupService.CreateUserGroupAsync("default", viewerGroup);
        await _userGroupService.CreateUserGroupAsync("default", editorGroup);

        // 3. 分配角色到组
        await _roleService.AssignRoleToGroupAsync("default", 
            $"{projectName}_VIEWER", $"{projectName}_viewers");
        await _roleService.AssignRoleToGroupAsync("default", 
            $"{projectName}_EDITOR", $"{projectName}_editors");

        // 4. 配置访问规则
        // 查看者：只读访问
        var viewerRule = new AccessRule
        {
            Resource = $"{projectName}.*.*",
            Roles = new[] { $"{projectName}_VIEWER" },
            AccessMode = "READ"
        };
        await _securityService.AddAccessRuleAsync(viewerRule);

        // 编辑者：读写访问
        var editorRule = new AccessRule
        {
            Resource = $"{projectName}.*.*",
            Roles = new[] { $"{projectName}_EDITOR", $"{projectName}_ADMIN" },
            AccessMode = "READ_WRITE"
        };
        await _securityService.AddAccessRuleAsync(editorRule);

        // 5. 限制 WFS-T (事务)访问
        var wfstRule = new AccessRule
        {
            Resource = $"wfs.Transaction.{projectName}",
            Roles = new[] { $"{projectName}_EDITOR", $"{projectName}_ADMIN" },
            AccessMode = "WRITE"
        };
        await _securityService.AddAccessRuleAsync(wfstRule);

        Console.WriteLine($"项目 '{projectName}' 的安全配置完成!");
    }
}

// 使用示例
var configurator = new ProjectSecurityConfigurator(
    userGroupService, 
    roleService, 
    securityService);
    
await configurator.ConfigureProjectSecurityAsync("urban_planning");
```

## 11.8 安全审计和监控

### 11.8.1 安全审计工具

```csharp
public class SecurityAuditor
{
    private readonly UserGroupService _userGroupService;
    private readonly RoleService _roleService;
    private readonly SecurityService _securityService;

    /// <summary>
    /// 审计用户权限
    /// </summary>
    public async Task<UserPermissionReport> AuditUserPermissionsAsync(string username)
    {
        var report = new UserPermissionReport { Username = username };

        // 获取用户信息
        var user = await _userGroupService.GetUserAsync("default", username);
        report.IsEnabled = user.Enabled;
        report.Groups = user.Groups;

        // 获取用户角色
        var roles = await _roleService.GetRolesAsync("default");
        report.Roles = roles
            .Where(r => user.Groups?.Any(g => r.AssignedGroups?.Contains(g) == true) == true)
            .Select(r => r.RoleName)
            .ToArray();

        // 获取可访问的资源
        var accessRules = await _securityService.GetAccessRulesAsync();
        report.AccessibleResources = accessRules
            .Where(rule => report.Roles.Any(role => rule.Roles.Contains(role)))
            .Select(rule => new ResourceAccess
            {
                Resource = rule.Resource,
                AccessMode = rule.AccessMode
            })
            .ToArray();

        return report;
    }

    /// <summary>
    /// 查找过度授权的用户
    /// </summary>
    public async Task<string[]> FindOverPrivilegedUsersAsync()
    {
        var users = await _userGroupService.GetUsersAsync("default");
        var overPrivileged = new List<string>();

        foreach (var user in users)
        {
            var report = await AuditUserPermissionsAsync(user.Username);
            
            // 检查是否有 ADMIN 角色
            if (report.Roles.Contains("ADMIN"))
            {
                overPrivileged.Add(user.Username);
            }
            
            // 检查是否有过多的写权限
            var writeCount = report.AccessibleResources
                .Count(r => r.AccessMode == "READ_WRITE" || r.AccessMode == "WRITE");
            
            if (writeCount > 10)
            {
                overPrivileged.Add(user.Username);
            }
        }

        return overPrivileged.Distinct().ToArray();
    }
}

public class UserPermissionReport
{
    public string Username { get; set; }
    public bool IsEnabled { get; set; }
    public string[] Groups { get; set; }
    public string[] Roles { get; set; }
    public ResourceAccess[] AccessibleResources { get; set; }
}

public class ResourceAccess
{
    public string Resource { get; set; }
    public string AccessMode { get; set; }
}
```

## 11.9 最佳实践

### 11.9.1 最小权限原则

```csharp
public class SecurityBestPractices
{
    /// <summary>
    /// 应用最小权限原则
    /// </summary>
    public static async Task ApplyLeastPrivilegeAsync(
        SecurityService securityService,
        string workspace,
        string[] readOnlyLayers,
        string[] readWriteLayers)
    {
        // 为只读图层设置只读权限
        foreach (var layer in readOnlyLayers)
        {
            var rule = new AccessRule
            {
                Resource = $"{workspace}.{layer}.*",
                Roles = new[] { "VIEWER", "EDITOR", "ADMIN" },
                AccessMode = "READ"
            };
            await securityService.AddAccessRuleAsync(rule);
        }

        // 为可编辑图层设置读写权限
        foreach (var layer in readWriteLayers)
        {
            var readRule = new AccessRule
            {
                Resource = $"{workspace}.{layer}.r",
                Roles = new[] { "VIEWER", "EDITOR", "ADMIN" },
                AccessMode = "READ"
            };
            await securityService.AddAccessRuleAsync(readRule);

            var writeRule = new AccessRule
            {
                Resource = $"{workspace}.{layer}.w",
                Roles = new[] { "EDITOR", "ADMIN" },
                AccessMode = "WRITE"
            };
            await securityService.AddAccessRuleAsync(writeRule);
        }
    }
}
```

### 11.9.2 定期安全检查

```csharp
public class SecurityChecker
{
    /// <summary>
    /// 执行定期安全检查
    /// </summary>
    public async Task<SecurityCheckReport> PerformSecurityCheckAsync()
    {
        var report = new SecurityCheckReport();

        // 1. 检查默认凭据
        var users = await _userGroupService.GetUsersAsync("default");
        var defaultUsers = users.Where(u => 
            u.Username == "admin" && u.Password == "geoserver").ToArray();
        
        if (defaultUsers.Any())
        {
            report.Issues.Add("发现使用默认凭据的管理员账户");
            report.Severity = "CRITICAL";
        }

        // 2. 检查禁用的账户
        var disabledUsers = users.Where(u => !u.Enabled).ToArray();
        report.Info.Add($"发现 {disabledUsers.Length} 个禁用的账户");

        // 3. 检查访问规则
        var rules = await _securityService.GetAccessRulesAsync();
        var openRules = rules.Where(r => 
            r.Roles.Contains("*") || r.Roles.Contains("ANONYMOUS")).ToArray();
        
        if (openRules.Any())
        {
            report.Warnings.Add($"发现 {openRules.Length} 条允许匿名访问的规则");
        }

        return report;
    }
}

public class SecurityCheckReport
{
    public string Severity { get; set; } = "NORMAL";
    public List<string> Issues { get; set; } = new List<string>();
    public List<string> Warnings { get; set; } = new List<string>();
    public List<string> Info { get; set; } = new List<string>();
}
```

## 11.10 本章小结

本章学习了：
1. GeoServer 安全架构的组成
2. 用户、用户组和角色管理
3. 访问控制规则配置
4. 认证和密码策略
5. 完整的项目安全配置示例
6. 安全审计和监控
7. 安全最佳实践

下一章将学习覆盖范围与栅格数据管理。

---

**相关资源**：
- [GeoServer 安全文档](https://docs.geoserver.org/latest/en/user/security/index.html)
- [REST API 安全配置](https://docs.geoserver.org/latest/en/api/#1.0.0/security.yaml)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第10章-服务设置与配置管理" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第12章-覆盖范围与栅格数据管理" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
