---
layout: default
title: 第13章 Docker部署与生产环境配置
---

# 第13章 Docker部署与生产环境配置

## 13.1 Docker部署概述

PocketBase 作为一个单文件可执行程序，天然适合容器化部署。通过 Docker 可以实现快速部署、环境隔离和便捷的版本管理。本章将详细介绍如何使用 Docker 和 Docker Compose 部署 PocketBase，并针对生产环境提供完整的配置建议。

### 13.1.1 为什么使用Docker部署

- **环境一致性**：确保开发、测试、生产环境完全一致
- **快速部署**：一条命令即可启动完整的后端服务
- **版本管理**：通过镜像标签轻松管理版本升级和回滚
- **资源隔离**：容器间资源隔离，互不影响
- **易于扩展**：配合 Kubernetes 等编排工具实现弹性扩展

## 13.2 Dockerfile编写

### 13.2.1 基础Dockerfile

```dockerfile
FROM alpine:latest

ARG PB_VERSION=0.25.0

RUN apk add --no-cache \
    unzip \
    ca-certificates

# 下载并解压PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && \
    rm /tmp/pb.zip

# 创建数据目录
RUN mkdir -p /pb/pb_data /pb/pb_public /pb/pb_hooks /pb/pb_migrations

EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
```

### 13.2.2 多阶段构建（Go扩展版）

如果你使用了 Go 扩展，需要多阶段构建：

```dockerfile
# 构建阶段
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o pocketbase .

# 运行阶段
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/pocketbase /app/pocketbase
COPY pb_public /app/pb_public
COPY pb_hooks /app/pb_hooks

RUN mkdir -p /app/pb_data /app/pb_migrations

EXPOSE 8090

CMD ["/app/pocketbase", "serve", "--http=0.0.0.0:8090"]
```

### 13.2.3 ARM架构支持

```dockerfile
FROM alpine:latest

ARG PB_VERSION=0.25.0
ARG TARGETARCH

RUN apk add --no-cache unzip ca-certificates

# 根据架构自动选择下载
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

RUN mkdir -p /pb/pb_data /pb/pb_public /pb/pb_hooks /pb/pb_migrations

EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
```

## 13.3 Docker Compose配置

### 13.3.1 基础docker-compose.yml

```yaml
version: '3.8'

services:
  pocketbase:
    build: .
    container_name: pocketbase
    ports:
      - "8090:8090"
    volumes:
      - pb_data:/pb/pb_data
      - ./pb_public:/pb/pb_public
      - ./pb_hooks:/pb/pb_hooks
      - ./pb_migrations:/pb/pb_migrations
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8090/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  pb_data:
```

### 13.3.2 完整生产环境配置

```yaml
version: '3.8'

services:
  pocketbase:
    build:
      context: .
      args:
        PB_VERSION: "0.25.0"
    container_name: pocketbase
    ports:
      - "8090:8090"
    volumes:
      - pb_data:/pb/pb_data
      - ./pb_public:/pb/pb_public
      - ./pb_hooks:/pb/pb_hooks
      - ./pb_migrations:/pb/pb_migrations
    environment:
      - GOMEMLIMIT=500MiB
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.25'
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8090/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - pocketbase
    restart: unless-stopped

volumes:
  pb_data:
    driver: local
```

### 13.3.3 常用Docker命令

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f pocketbase

# 停止服务
docker-compose down

# 重启服务
docker-compose restart pocketbase

# 进入容器
docker exec -it pocketbase sh

# 查看容器状态
docker-compose ps
```

## 13.4 反向代理配置

### 13.4.1 Nginx反向代理

```nginx
upstream pocketbase {
    server 127.0.0.1:8090;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://pocketbase;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE支持
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### 13.4.2 Caddy反向代理

Caddy 配置更加简洁，自动处理 HTTPS：

```
your-domain.com {
    reverse_proxy 127.0.0.1:8090 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # 文件上传大小限制
    request_body {
        max_size 100MB
    }
}
```

## 13.5 HTTPS配置

### 13.5.1 PocketBase内置HTTPS

PocketBase 支持自动 HTTPS（通过 Let's Encrypt）：

```bash
./pocketbase serve --https=your-domain.com
```

### 13.5.2 使用Let's Encrypt + Nginx

```bash
# 安装certbot
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com

# 自动续期
certbot renew --dry-run
```

## 13.6 数据备份与恢复

### 13.6.1 手动备份

```bash
# 停止PocketBase服务
docker-compose stop pocketbase

# 备份数据目录
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz pb_data/

# 重启服务
docker-compose start pocketbase
```

### 13.6.2 自动备份脚本

```bash
#!/bin/bash
# backup.sh - PocketBase自动备份脚本

BACKUP_DIR="/backups/pocketbase"
DATA_DIR="/path/to/pb_data"
KEEP_DAYS=30

mkdir -p $BACKUP_DIR

# 创建备份（使用SQLite在线备份，无需停机）
BACKUP_FILE="$BACKUP_DIR/pb_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf $BACKUP_FILE $DATA_DIR

# 清理旧备份
find $BACKUP_DIR -name "pb_backup_*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "备份完成: $BACKUP_FILE"
```

配置定时任务：

```bash
# 每天凌晨2点执行备份
0 2 * * * /path/to/backup.sh >> /var/log/pb_backup.log 2>&1
```

### 13.6.3 数据恢复

```bash
# 停止服务
docker-compose down

# 恢复数据
tar -xzf backup_20240101_020000.tar.gz -C /

# 重启服务
docker-compose up -d
```

## 13.7 生产环境安全加固

### 13.7.1 系统级安全

```bash
# 增加文件描述符限制
ulimit -n 4096

# 在systemd服务文件中配置
# /etc/systemd/system/pocketbase.service
[Service]
LimitNOFILE=4096
```

### 13.7.2 PocketBase安全配置

1. **管理员账号安全**：使用强密码，启用 MFA
2. **加密密钥**：设置 `PB_ENCRYPTION_KEY` 加密敏感数据
3. **SMTP安全**：使用企业邮箱配置 SMTP，避免被标记为垃圾邮件
4. **API规则**：严格配置每个集合的 API 访问规则
5. **CORS配置**：限制允许的域名

### 13.7.3 防火墙配置

```bash
# 仅允许HTTP/HTTPS和SSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 禁止直接访问8090端口（通过反向代理访问）
ufw deny 8090/tcp
```

## 13.8 日志管理

### 13.8.1 Docker日志配置

```yaml
# docker-compose.yml中的日志配置
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "5"
```

### 13.8.2 PocketBase日志

PocketBase 的日志可通过 Admin UI 查看，也可在命令行启动时配置：

```bash
# 启用详细日志
./pocketbase serve --dev

# 日志输出到文件
./pocketbase serve 2>&1 | tee /var/log/pocketbase.log
```

## 13.9 监控与健康检查

### 13.9.1 健康检查端点

PocketBase 提供 `/api/health` 端点：

```bash
curl http://localhost:8090/api/health
# 响应: {"code":200,"message":"API is healthy."}
```

### 13.9.2 Docker健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8090/api/health || exit 1
```

### 13.9.3 Prometheus监控

可通过自定义中间件导出 Prometheus 指标：

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.GET("/metrics", func(re *core.RequestEvent) error {
        // 返回Prometheus格式的指标
        metrics := fmt.Sprintf(
            "pocketbase_uptime_seconds %d\n"+
            "pocketbase_requests_total %d\n",
            time.Since(startTime).Seconds(),
            requestCount,
        )
        re.Response.Header().Set("Content-Type", "text/plain")
        return re.String(200, metrics)
    })
    return se.Next()
})
```

## 13.10 云平台部署

### 13.10.1 部署到云服务器

```bash
# 1. 准备服务器（以Ubuntu为例）
apt update && apt upgrade -y
apt install docker.io docker-compose -y

# 2. 上传项目文件
scp -r ./pocketbase-project user@server:/opt/pocketbase

# 3. 启动服务
cd /opt/pocketbase
docker-compose up -d

# 4. 配置域名和反向代理
# 根据13.4节的Nginx或Caddy配置
```

### 13.10.2 部署到PocketHost

PocketHost 是专门托管 PocketBase 实例的云平台，提供免费和付费方案：

1. 注册 PocketHost 账号
2. 创建新实例
3. 上传 pb_hooks 和 pb_migrations
4. 配置域名

### 13.10.3 部署到Railway/Fly.io

```toml
# fly.toml（Fly.io配置）
app = "my-pocketbase"

[build]
  dockerfile = "Dockerfile"

[mounts]
  source = "pb_data"
  destination = "/pb/pb_data"

[[services]]
  internal_port = 8090
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

## 13.11 版本升级策略

### 13.11.1 升级步骤

```bash
# 1. 备份数据
tar -czf pre_upgrade_backup.tar.gz pb_data/

# 2. 更新Dockerfile中的版本号
# ARG PB_VERSION=0.26.0

# 3. 重新构建
docker-compose build --no-cache

# 4. 重启服务
docker-compose up -d

# 5. 验证服务正常
curl http://localhost:8090/api/health
```

### 13.11.2 回滚方案

```bash
# 如果升级失败，恢复备份
docker-compose down
tar -xzf pre_upgrade_backup.tar.gz
# 修改Dockerfile为旧版本号
docker-compose up -d --build
```

## 13.12 本章小结

本章详细介绍了 PocketBase 的 Docker 容器化部署方案，包括 Dockerfile 编写、Docker Compose 配置、反向代理设置、HTTPS 配置、数据备份恢复、安全加固、日志管理和监控等生产环境必备的配置。通过合理的部署方案，可以确保 PocketBase 在生产环境中稳定、安全地运行。

关键要点：
- 使用 Docker Compose 管理服务，确保数据持久化
- 通过反向代理（Nginx/Caddy）处理 HTTPS 和负载均衡
- 建立完善的备份策略，定期备份数据
- 配置健康检查和监控，及时发现问题
- 做好安全加固，防止未授权访问
