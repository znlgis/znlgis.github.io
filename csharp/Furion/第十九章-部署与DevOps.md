# 第十九章：部署与DevOps

## 一、发布准备

### 1.1 发布模式概述

.NET 应用程序支持多种发布模式，每种模式适用于不同的部署场景：

| 发布模式 | 说明 | 优点 | 缺点 |
|---------|------|------|------|
| Framework-dependent（框架依赖） | 依赖目标机器上已安装的 .NET 运行时 | 包体小、共享运行时更新 | 需要预安装运行时 |
| Self-contained（独立部署） | 包含 .NET 运行时 | 无需安装运行时、版本隔离 | 包体大（约60-80MB） |
| Single-file（单文件） | 打包为单个可执行文件 | 分发简单 | 首次启动稍慢 |
| ReadyToRun（R2R） | 预编译为原生代码 | 启动更快 | 包体更大 |
| Trimmed（裁剪） | 移除未使用的程序集 | 包体更小 | 可能有兼容问题 |

### 1.2 发布命令

```bash
# 框架依赖发布（默认）
dotnet publish -c Release -o ./publish

# 独立部署（Windows x64）
dotnet publish -c Release -r win-x64 --self-contained true -o ./publish

# 独立部署（Linux x64）
dotnet publish -c Release -r linux-x64 --self-contained true -o ./publish

# 单文件发布
dotnet publish -c Release -r linux-x64 --self-contained true \
    -p:PublishSingleFile=true -o ./publish

# 裁剪发布
dotnet publish -c Release -r linux-x64 --self-contained true \
    -p:PublishTrimmed=true -o ./publish

# ReadyToRun 发布
dotnet publish -c Release -r linux-x64 --self-contained true \
    -p:PublishReadyToRun=true -o ./publish
```

### 1.3 项目文件发布配置

```xml
<!-- .csproj 文件中的发布配置 -->
<Project Sdk="Microsoft.NET.Sdk.Web">
    <PropertyGroup>
        <TargetFramework>net8.0</TargetFramework>
        <RuntimeIdentifier>linux-x64</RuntimeIdentifier>
        <SelfContained>true</SelfContained>
        <PublishSingleFile>true</PublishSingleFile>
        <PublishReadyToRun>true</PublishReadyToRun>
        <PublishTrimmed>false</PublishTrimmed>

        <!-- 设置程序集版本 -->
        <Version>1.0.0</Version>
        <AssemblyVersion>1.0.0.0</AssemblyVersion>
        <FileVersion>1.0.0.0</FileVersion>

        <!-- 生成 XML 文档（Swagger 需要） -->
        <GenerateDocumentationFile>true</GenerateDocumentationFile>
        <NoWarn>$(NoWarn);1591</NoWarn>
    </PropertyGroup>
</Project>
```

## 二、IIS 部署

### 2.1 IIS 环境准备

```powershell
# 安装 ASP.NET Core Hosting Bundle（Windows Server）
# 下载地址：https://dotnet.microsoft.com/download/dotnet

# 安装 IIS（如果尚未安装）
Install-WindowsFeature -name Web-Server -IncludeManagementTools

# 安装 ASP.NET Core Module
# 下载并安装 .NET Hosting Bundle
```

### 2.2 web.config 配置

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
    <location path="." inheritInChildApplications="false">
        <system.webServer>
            <handlers>
                <add name="aspNetCore" path="*" verb="*"
                     modules="AspNetCoreModuleV2"
                     resourceType="Unspecified" />
            </handlers>
            <aspNetCore processPath="dotnet"
                        arguments=".\MyApp.dll"
                        stdoutLogEnabled="true"
                        stdoutLogFile=".\logs\stdout"
                        hostingModel="InProcess">
                <environmentVariables>
                    <environmentVariable name="ASPNETCORE_ENVIRONMENT"
                                        value="Production" />
                    <environmentVariable name="DOTNET_PRINT_TELEMETRY_MESSAGE"
                                        value="false" />
                </environmentVariables>
            </aspNetCore>
        </system.webServer>
    </location>
</configuration>
```

### 2.3 IIS 应用池配置

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| .NET CLR 版本 | 无托管代码 | ASP.NET Core 不需要 CLR |
| 托管管道模式 | 集成 | 使用 IIS 集成管道 |
| 启动模式 | AlwaysRunning | 避免冷启动延迟 |
| 回收间隔 | 0（禁用） | 避免定时回收导致的中断 |
| 闲置超时 | 0（禁用） | 保持应用持续运行 |
| 进程模型 | InProcess | 性能更好 |

```csharp
// Program.cs - IIS 集成配置
var builder = WebApplication.CreateBuilder(args);

// 配置 Kestrel 和 IIS 集成
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // 100MB
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(2);
});

var app = builder.Build();

// 在 IIS 后面时，使用转发头部
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor
                     | ForwardedHeaders.XForwardedProto
});

app.Run();
```

## 三、Kestrel 独立部署

### 3.1 Linux 环境部署

```bash
# 1. 安装 .NET 运行时（Ubuntu/Debian）
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update
sudo apt-get install -y aspnetcore-runtime-8.0

# 2. 创建应用目录
sudo mkdir -p /var/www/myapp
sudo chown -R www-data:www-data /var/www/myapp

# 3. 上传发布文件
scp -r ./publish/* user@server:/var/www/myapp/

# 4. 测试运行
cd /var/www/myapp
dotnet MyApp.dll --urls "http://0.0.0.0:5000"
```

### 3.2 Systemd 服务配置

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Furion Application
After=network.target

[Service]
WorkingDirectory=/var/www/myapp
ExecStart=/usr/bin/dotnet /var/www/myapp/MyApp.dll
Restart=always
RestartSec=10
SyslogIdentifier=myapp
User=www-data
Group=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://0.0.0.0:5000
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

# 资源限制
LimitNOFILE=65536
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable myapp
sudo systemctl start myapp

# 查看服务状态
sudo systemctl status myapp

# 查看日志
sudo journalctl -u myapp -f
```

### 3.3 Kestrel 高级配置

```csharp
// Program.cs - Kestrel 配置
var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    // HTTP 端口
    options.ListenAnyIP(5000);

    // HTTPS 端口
    options.ListenAnyIP(5001, listenOptions =>
    {
        listenOptions.UseHttps("/etc/ssl/certs/myapp.pfx", "password");
    });

    // 性能配置
    options.Limits.MaxConcurrentConnections = 1000;
    options.Limits.MaxConcurrentUpgradedConnections = 1000;
    options.Limits.MaxRequestBodySize = 50 * 1024 * 1024; // 50MB
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
});
```

## 四、Nginx 反向代理配置

### 4.1 Nginx 基本配置

```nginx
# /etc/nginx/sites-available/myapp
server {
    listen 80;
    server_name example.com www.example.com;

    # 强制 HTTPS 重定向
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # SSL 证书
    ssl_certificate     /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # 日志
    access_log /var/log/nginx/myapp_access.log;
    error_log  /var/log/nginx/myapp_error.log;

    # 请求体大小限制
    client_max_body_size 100M;

    # 反向代理
    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    # 静态文件缓存
    location /static/ {
        alias /var/www/myapp/wwwroot/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查端点
    location /health {
        proxy_pass http://127.0.0.1:5000/health;
        access_log off;
    }
}
```

### 4.2 Nginx 负载均衡

```nginx
# 上游服务器组
upstream myapp_cluster {
    least_conn;  # 最少连接数策略
    server 127.0.0.1:5000 weight=3;
    server 127.0.0.1:5001 weight=2;
    server 127.0.0.1:5002 weight=1;

    # 健康检查
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    location / {
        proxy_pass http://myapp_cluster;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 五、Docker 容器化部署

### 5.1 Dockerfile 编写

```dockerfile
# 多阶段构建 Dockerfile
# 阶段1：构建
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# 复制项目文件并还原依赖（利用 Docker 缓存层）
COPY ["MyApp.Web.Entry/MyApp.Web.Entry.csproj", "MyApp.Web.Entry/"]
COPY ["MyApp.Application/MyApp.Application.csproj", "MyApp.Application/"]
COPY ["MyApp.Core/MyApp.Core.csproj", "MyApp.Core/"]
COPY ["MyApp.EntityFramework.Core/MyApp.EntityFramework.Core.csproj", "MyApp.EntityFramework.Core/"]
RUN dotnet restore "MyApp.Web.Entry/MyApp.Web.Entry.csproj"

# 复制所有源代码并构建
COPY . .
WORKDIR "/src/MyApp.Web.Entry"
RUN dotnet build -c Release -o /app/build

# 阶段2：发布
FROM build AS publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# 阶段3：运行
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装中文字体（PDF 生成等场景需要）
RUN apt-get update && apt-get install -y fonts-wqy-zenhei && \
    rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=publish /app/publish .

# 设置环境变量
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

USER appuser
ENTRYPOINT ["dotnet", "MyApp.Web.Entry.dll"]
```

### 5.2 .dockerignore 文件

```
**/bin/
**/obj/
**/out/
**/.vs/
**/.vscode/
**/node_modules/
**/*.user
**/*.suo
**/Thumbs.db
.git
.gitignore
README.md
docker-compose*.yml
Dockerfile*
```

### 5.3 Docker Compose 编排

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 应用服务
  myapp:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: myapp
    ports:
      - "5000:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__Default=Server=db;Port=5432;Database=myapp;User Id=postgres;Password=postgres123;
      - Redis__Connection=redis:6379,password=redis123
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - myapp-network
    volumes:
      - app-logs:/app/logs
      - app-uploads:/app/uploads

  # PostgreSQL 数据库
  db:
    image: postgres:16-alpine
    container_name: myapp-db
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres123
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - myapp-network

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: myapp-redis
    command: redis-server --requirepass redis123
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "redis123", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - myapp-network

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: myapp-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - myapp
    restart: unless-stopped
    networks:
      - myapp-network

volumes:
  postgres-data:
  redis-data:
  app-logs:
  app-uploads:

networks:
  myapp-network:
    driver: bridge
```

### 5.4 Docker 常用操作

```bash
# 构建镜像
docker build -t myapp:latest .

# 使用 Docker Compose 启动
docker compose up -d

# 查看日志
docker compose logs -f myapp

# 重新构建并启动
docker compose up -d --build

# 停止并清理
docker compose down

# 查看容器资源使用
docker stats
```

## 六、Kubernetes 部署

### 6.1 Deployment 配置

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: registry.example.com/myapp:latest
        ports:
        - containerPort: 80
        env:
        - name: ASPNETCORE_ENVIRONMENT
          value: "Production"
        - name: ConnectionStrings__Default
          valueFrom:
            secretKeyRef:
              name: myapp-secrets
              key: db-connection-string
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 80
          initialDelaySeconds: 15
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
      imagePullSecrets:
      - name: registry-credentials
```

### 6.2 Service 和 Ingress 配置

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
  namespace: production
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.example.com
    secretName: myapp-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
```

### 6.3 ConfigMap 和 Secret

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
  namespace: production
data:
  appsettings.Production.json: |
    {
      "Logging": {
        "LogLevel": {
          "Default": "Warning"
        }
      },
      "AllowedHosts": "*",
      "Redis": {
        "Connection": "redis-service:6379"
      }
    }

---
# k8s/secret.yaml（使用 base64 编码）
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
  namespace: production
type: Opaque
data:
  db-connection-string: U2VydmVyPXBvc3RncmVzLXNlcnZpY2U7... # base64 编码
```

## 七、CI/CD 流水线

### 7.1 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Setup .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: '8.0.x'

    - name: Restore dependencies
      run: dotnet restore

    - name: Build
      run: dotnet build --no-restore -c Release

    - name: Run tests
      run: dotnet test --no-build -c Release --verbosity normal
           --collect:"XPlat Code Coverage"

    - name: Publish
      run: dotnet publish -c Release -o ./publish --no-restore

    - name: Upload artifact
      uses: actions/upload-artifact@v4
      with:
        name: app-publish
        path: ./publish

  docker-build:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write

    steps:
    - uses: actions/checkout@v4

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy:
    needs: docker-build
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
    - name: Deploy to server
      uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SERVER_SSH_KEY }}
        script: |
          cd /var/www/myapp
          docker compose pull
          docker compose up -d --force-recreate
          docker image prune -f
```

### 7.2 Azure DevOps Pipeline

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
    - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  buildConfiguration: 'Release'
  dotnetVersion: '8.0.x'

stages:
- stage: Build
  displayName: '构建阶段'
  jobs:
  - job: BuildJob
    displayName: '编译和测试'
    steps:
    - task: UseDotNet@2
      inputs:
        version: $(dotnetVersion)

    - script: dotnet restore
      displayName: '还原依赖'

    - script: dotnet build --configuration $(buildConfiguration) --no-restore
      displayName: '编译项目'

    - script: dotnet test --configuration $(buildConfiguration) --no-build
      displayName: '运行测试'

    - script: dotnet publish --configuration $(buildConfiguration)
              --output $(Build.ArtifactStagingDirectory)
      displayName: '发布项目'

    - publish: $(Build.ArtifactStagingDirectory)
      artifact: drop

- stage: Deploy
  displayName: '部署阶段'
  dependsOn: Build
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: DeployJob
    displayName: '部署到生产环境'
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "部署到生产服务器"
            displayName: '执行部署'
```

## 八、环境变量与配置管理

### 8.1 多环境配置

```csharp
// Program.cs - 环境配置加载
var builder = WebApplication.CreateBuilder(args);

// 配置加载顺序（后加载的覆盖先加载的）
// 1. appsettings.json
// 2. appsettings.{Environment}.json
// 3. 用户机密（仅开发环境）
// 4. 环境变量
// 5. 命令行参数

builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json",
        optional: true, reloadOnChange: true)
    .AddEnvironmentVariables()
    .AddCommandLine(args);
```

```json
// appsettings.json - 默认配置
{
    "Logging": {
        "LogLevel": {
            "Default": "Information"
        }
    },
    "AllowedHosts": "*",
    "ConnectionStrings": {
        "Default": ""
    }
}
```

```json
// appsettings.Development.json - 开发环境
{
    "Logging": {
        "LogLevel": {
            "Default": "Debug",
            "Microsoft.EntityFrameworkCore": "Information"
        }
    },
    "ConnectionStrings": {
        "Default": "Server=localhost;Database=MyApp_Dev;Uid=root;Pwd=123456;"
    },
    "Redis": {
        "Connection": "localhost:6379"
    }
}
```

```json
// appsettings.Production.json - 生产环境
{
    "Logging": {
        "LogLevel": {
            "Default": "Warning"
        }
    },
    "ConnectionStrings": {
        "Default": "${DB_CONNECTION_STRING}"
    },
    "Redis": {
        "Connection": "${REDIS_CONNECTION}"
    }
}
```

### 8.2 配置安全管理

```csharp
// 使用用户机密（开发环境）
// dotnet user-secrets init
// dotnet user-secrets set "ConnectionStrings:Default" "Server=..."

// 使用 Azure Key Vault（生产环境）
builder.Configuration.AddAzureKeyVault(
    new Uri("https://myapp-vault.vault.azure.net/"),
    new DefaultAzureCredential());

// 使用环境变量覆盖配置
// export ConnectionStrings__Default="Server=prod-db;..."
// export Redis__Connection="prod-redis:6379"
```

## 九、健康检查

### 9.1 配置健康检查

```csharp
// Program.cs - 健康检查配置
builder.Services.AddHealthChecks()
    // 数据库健康检查
    .AddNpgSql(
        builder.Configuration.GetConnectionString("Default")!,
        name: "postgresql",
        tags: new[] { "db", "critical" })
    // Redis 健康检查
    .AddRedis(
        builder.Configuration["Redis:Connection"]!,
        name: "redis",
        tags: new[] { "cache", "critical" })
    // 自定义健康检查
    .AddCheck<DiskSpaceHealthCheck>(
        "disk-space",
        tags: new[] { "infrastructure" })
    // 外部 API 健康检查
    .AddUrlGroup(
        new Uri("https://api.example.com/health"),
        name: "external-api",
        tags: new[] { "external" });

var app = builder.Build();

// 映射健康检查端点
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => true,
    ResponseWriter = WriteHealthCheckResponse
});

// 就绪检查（仅检查关键依赖）
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("critical"),
    ResponseWriter = WriteHealthCheckResponse
});

// 存活检查
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // 不检查任何依赖，仅确认应用存活
});
```

### 9.2 自定义健康检查

```csharp
/// <summary>
/// 磁盘空间健康检查
/// </summary>
public class DiskSpaceHealthCheck : IHealthCheck
{
    private readonly long _minimumFreeMB;

    public DiskSpaceHealthCheck(long minimumFreeMB = 500)
    {
        _minimumFreeMB = minimumFreeMB;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var drives = DriveInfo.GetDrives()
            .Where(d => d.IsReady && d.DriveType == DriveType.Fixed);

        foreach (var drive in drives)
        {
            var freeMB = drive.AvailableFreeSpace / (1024 * 1024);
            if (freeMB < _minimumFreeMB)
            {
                return Task.FromResult(HealthCheckResult.Unhealthy(
                    $"磁盘 {drive.Name} 空间不足: {freeMB}MB 剩余" +
                    $"（最低要求: {_minimumFreeMB}MB）"));
            }
        }

        return Task.FromResult(HealthCheckResult.Healthy("磁盘空间充足"));
    }
}

/// <summary>
/// 健康检查响应格式化
/// </summary>
static async Task WriteHealthCheckResponse(
    HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";

    var response = new
    {
        Status = report.Status.ToString(),
        TotalDuration = report.TotalDuration.TotalMilliseconds + "ms",
        Checks = report.Entries.Select(e => new
        {
            Name = e.Key,
            Status = e.Value.Status.ToString(),
            Duration = e.Value.Duration.TotalMilliseconds + "ms",
            Description = e.Value.Description,
            Error = e.Value.Exception?.Message
        })
    };

    await context.Response.WriteAsJsonAsync(response);
}
```

## 十、应用监控

### 10.1 Prometheus + Grafana 监控

```csharp
// 安装 NuGet 包
// dotnet add package prometheus-net.AspNetCore

// Program.cs - 配置 Prometheus 指标
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

// 启用 HTTP 请求指标收集
app.UseHttpMetrics();

// 暴露 Prometheus 指标端点
app.MapMetrics();  // 默认路径: /metrics

app.Run();
```

### 10.2 自定义业务指标

```csharp
/// <summary>
/// 业务指标收集服务
/// </summary>
public class BusinessMetricsService
{
    // 订单创建计数器
    private static readonly Counter OrderCreatedCounter = Metrics
        .CreateCounter("myapp_orders_created_total", "创建的订单总数",
            new CounterConfiguration
            {
                LabelNames = new[] { "payment_method" }
            });

    // 请求处理时间直方图
    private static readonly Histogram RequestDuration = Metrics
        .CreateHistogram("myapp_request_duration_seconds", "请求处理时间",
            new HistogramConfiguration
            {
                LabelNames = new[] { "endpoint" },
                Buckets = Histogram.LinearBuckets(0.1, 0.1, 10)
            });

    // 在线用户数仪表盘
    private static readonly Gauge OnlineUsers = Metrics
        .CreateGauge("myapp_online_users", "当前在线用户数");

    public void RecordOrderCreated(string paymentMethod)
    {
        OrderCreatedCounter.WithLabels(paymentMethod).Inc();
    }

    public IDisposable MeasureRequestDuration(string endpoint)
    {
        return RequestDuration.WithLabels(endpoint).NewTimer();
    }

    public void SetOnlineUsers(int count)
    {
        OnlineUsers.Set(count);
    }
}
```

## 十一、日志收集

### 11.1 Serilog 配置

```csharp
// 安装 NuGet 包
// dotnet add package Serilog.AspNetCore
// dotnet add package Serilog.Sinks.File
// dotnet add package Serilog.Sinks.Seq

// Program.cs - Serilog 配置
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithEnvironmentName()
    // 控制台输出
    .WriteTo.Console()
    // 文件输出（按日期滚动）
    .WriteTo.File(
        path: "logs/myapp-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} " +
            "[{Level:u3}] {Message:lj}{NewLine}{Exception}")
    // Seq 集中日志平台
    .WriteTo.Seq("http://localhost:5341")
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

var app = builder.Build();

// 请求日志中间件
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate =
        "HTTP {RequestMethod} {RequestPath} 响应 {StatusCode} 耗时 {Elapsed:0.0000}ms";
});

app.Run();
```

### 11.2 ELK Stack 集成

```json
// appsettings.json - Elasticsearch Sink 配置
{
    "Serilog": {
        "WriteTo": [
            {
                "Name": "Elasticsearch",
                "Args": {
                    "nodeUris": "http://elasticsearch:9200",
                    "indexFormat": "myapp-logs-{0:yyyy.MM.dd}",
                    "autoRegisterTemplate": true
                }
            }
        ]
    }
}
```

## 十二、性能优化与压测

### 12.1 性能优化清单

| 优化项 | 方法 | 预期效果 |
|--------|------|---------|
| 启用响应压缩 | UseResponseCompression | 减少 30-70% 传输量 |
| 启用响应缓存 | UseResponseCaching | 减少重复计算 |
| 数据库连接池 | 配置连接池大小 | 减少连接开销 |
| 异步编程 | async/await | 提高并发处理能力 |
| 缓存热点数据 | Redis/内存缓存 | 减少数据库查询 |
| 启用 HTTP/2 | Kestrel 配置 | 提高传输效率 |

```csharp
// 响应压缩配置
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

app.UseResponseCompression();
```

## 十三、蓝绿部署与金丝雀发布

### 13.1 蓝绿部署

```nginx
# Nginx 蓝绿部署配置
# 通过切换 upstream 实现零停机部署

# 蓝色环境（当前生产）
upstream blue {
    server 192.168.1.10:5000;
    server 192.168.1.11:5000;
}

# 绿色环境（新版本）
upstream green {
    server 192.168.1.20:5000;
    server 192.168.1.21:5000;
}

# 当前活跃环境（修改此行切换）
upstream active {
    server 192.168.1.10:5000;  # 指向蓝色
    server 192.168.1.11:5000;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    location / {
        proxy_pass http://active;
    }
}
```

### 13.2 金丝雀发布

```nginx
# 金丝雀发布 - 按权重分配流量
upstream canary {
    server 192.168.1.10:5000 weight=90;  # 旧版本 90%
    server 192.168.1.20:5000 weight=10;  # 新版本 10%
}
```

## 十四、安全加固

### 14.1 安全配置清单

```csharp
// Program.cs - 安全加固配置
var app = builder.Build();

// HTTPS 重定向
app.UseHttpsRedirection();

// HSTS（HTTP Strict Transport Security）
app.UseHsts();

// 安全头部
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'";
    context.Response.Headers.Remove("Server");
    context.Response.Headers.Remove("X-Powered-By");
    await next();
});

// 速率限制
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
        context => RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

app.UseRateLimiter();
```

## 十五、国产化环境部署

### 15.1 麒麟 OS 部署

```bash
# 麒麟 V10（ARM64/x86_64）安装 .NET
# 1. 下载 .NET SDK/Runtime（ARM64 版本）
wget https://download.visualstudio.microsoft.com/download/.../dotnet-runtime-8.0.x-linux-arm64.tar.gz

# 2. 解压安装
sudo mkdir -p /usr/share/dotnet
sudo tar zxf dotnet-runtime-8.0.x-linux-arm64.tar.gz -C /usr/share/dotnet
sudo ln -s /usr/share/dotnet/dotnet /usr/local/bin/dotnet

# 3. 验证安装
dotnet --info

# 4. 发布为指定平台
dotnet publish -c Release -r linux-arm64 --self-contained true -o ./publish
```

### 15.2 达梦数据库适配

```csharp
// 使用达梦数据库（DM8）
// dotnet add package Dm

// 配置达梦数据库连接
builder.Services.AddDbContext<DefaultDbContext>(options =>
{
    options.UseDm(builder.Configuration.GetConnectionString("DmDatabase"));
});
```

```json
// appsettings.json
{
    "ConnectionStrings": {
        "DmDatabase": "Server=192.168.1.100;Port=5236;Database=MYAPP;User=SYSDBA;Password=SYSDBA001;"
    }
}
```

## 十六、运维最佳实践

### 16.1 运维检查清单

| 类别 | 检查项 | 建议 |
|------|--------|------|
| 安全 | HTTPS 证书有效期 | 自动续期（Let's Encrypt） |
| 安全 | 依赖漏洞扫描 | 定期执行 `dotnet list package --vulnerable` |
| 性能 | 数据库慢查询 | 配置慢查询监控告警 |
| 性能 | 内存使用率 | 设置阈值告警（>80%） |
| 可用性 | 健康检查 | 配置自动重启策略 |
| 可用性 | 数据备份 | 每日自动备份 + 异地备份 |
| 日志 | 日志轮转 | 保留30天，自动清理 |
| 日志 | 错误日志告警 | 关键错误实时通知 |

### 16.2 自动化运维脚本

```bash
#!/bin/bash
# deploy.sh - 自动化部署脚本

set -e

APP_NAME="myapp"
DEPLOY_DIR="/var/www/${APP_NAME}"
BACKUP_DIR="/var/backup/${APP_NAME}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== 开始部署 ${APP_NAME} ==="

# 1. 备份当前版本
echo ">>> 备份当前版本..."
mkdir -p ${BACKUP_DIR}
cp -r ${DEPLOY_DIR} ${BACKUP_DIR}/${TIMESTAMP}

# 2. 停止服务
echo ">>> 停止服务..."
sudo systemctl stop ${APP_NAME}

# 3. 部署新版本
echo ">>> 部署新版本..."
cp -r ./publish/* ${DEPLOY_DIR}/

# 4. 启动服务
echo ">>> 启动服务..."
sudo systemctl start ${APP_NAME}

# 5. 健康检查
echo ">>> 执行健康检查..."
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)

if [ "$HTTP_CODE" = "200" ]; then
    echo "=== 部署成功！==="
else
    echo "=== 健康检查失败，回滚中... ==="
    sudo systemctl stop ${APP_NAME}
    cp -r ${BACKUP_DIR}/${TIMESTAMP}/* ${DEPLOY_DIR}/
    sudo systemctl start ${APP_NAME}
    echo "=== 回滚完成 ==="
    exit 1
fi

# 6. 清理旧备份（保留最近5个）
cd ${BACKUP_DIR}
ls -t | tail -n +6 | xargs -r rm -rf

echo "=== 部署完成 ==="
```

通过本章的学习，你已经全面掌握了 Furion 应用从开发到部署的完整流程，包括多种部署方式、CI/CD 流水线、监控告警、安全加固等关键环节。合理的部署策略和运维实践能够确保应用的高可用性和稳定性。在下一章中，我们将总结最佳实践与常见问题。
