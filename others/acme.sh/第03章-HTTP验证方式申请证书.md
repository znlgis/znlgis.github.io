---
layout: default
title: 第03章 - HTTP验证方式申请证书
---

# 第03章 - HTTP验证方式申请证书

HTTP 验证（HTTP-01 Challenge）是 ACME 协议中最常见的验证方式。CA 通过访问特定 URL 来确认你控制该域名。本章详细介绍 acme.sh 支持的所有 HTTP 验证模式。

## 3.1 HTTP-01 验证原理

HTTP-01 验证流程如下：

1. acme.sh 向 CA 发起证书申请请求
2. CA 返回一个"挑战令牌"（token）
3. acme.sh 在域名对应的 Web 服务器上创建一个特殊文件
4. CA 通过 HTTP 访问 `http://<域名>/.well-known/acme-challenge/<token>` 验证文件是否存在及内容是否正确
5. 验证通过后 CA 颁发证书

**使用 HTTP-01 验证的前提条件：**
- 域名 DNS 必须已解析到当前服务器的公网 IP
- 服务器 **80 端口**必须对外可访问（CA 只使用 HTTP，不支持 HTTPS）
- 不支持申请**通配符证书**（必须使用 DNS-01 验证）

---

## 3.2 Webroot 模式

### 3.2.1 概述

Webroot 模式是最推荐的 HTTP 验证方式，适用于已有 Web 服务器（Nginx/Apache 等）正在运行的情况。acme.sh 直接将验证文件写入指定的 Web 根目录，由现有的 Web 服务器提供访问。

### 3.2.2 基本用法

```bash
# 单域名
acme.sh --issue -d example.com -w /var/www/html

# 多域名（使用同一 Webroot）
acme.sh --issue -d example.com -d www.example.com -w /var/www/html

# 多域名（不同 Webroot）
acme.sh --issue -d example.com -w /var/www/example.com \
                -d blog.example.com -w /var/www/blog

# 更多域名
acme.sh --issue -d example.com -w /var/www/html \
                -d www.example.com \
                -d api.example.com \
                -d mail.example.com
```

`-w` 参数指定域名对应的 Web 根目录。acme.sh 会在该目录下创建 `.well-known/acme-challenge/` 子目录并放置验证文件，验证完成后自动清理。

### 3.2.3 常见 Webroot 目录

| Web 服务器 | 常见 Webroot 目录 |
|-----------|-----------------|
| Nginx（默认） | `/var/www/html` 或 `/usr/share/nginx/html` |
| Apache（默认） | `/var/www/html` 或 `/srv/www/htdocs` |
| OpenLiteSpeed | `/usr/local/lsws/Example/html` |
| Caddy | `/var/www/caddy` 或由配置决定 |
| 宝塔面板 | `/www/wwwroot/example.com` |
| LNMP | `/home/wwwroot/example.com` |
| WDCP | `/home/wwwlogs/www` |

### 3.2.4 Nginx 配置要求

确保 Nginx 能正确提供 `.well-known/acme-challenge/` 路径的访问，以下为最佳实践配置：

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    # acme.sh 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        # 允许所有访问
        allow all;
    }

    # 其他请求重定向到 HTTPS（如果需要）
    location / {
        return 301 https://$host$request_uri;
    }
}
```

> **注意**：如果 Nginx 配置了全局 HTTP 到 HTTPS 的重定向，需要为 `.well-known` 路径添加例外，否则 CA 无法访问验证文件。

### 3.2.5 Apache 配置要求

```apache
<VirtualHost *:80>
    ServerName example.com
    DocumentRoot /var/www/html

    # acme.sh 验证目录
    Alias /.well-known/acme-challenge/ /var/www/html/.well-known/acme-challenge/
    <Directory /var/www/html/.well-known/acme-challenge/>
        Options None
        AllowOverride None
        Require all granted
    </Directory>

    # 其他请求重定向到 HTTPS
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/.well-known/acme-challenge/
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>
```

---

## 3.3 Standalone 独立模式

### 3.3.1 概述

Standalone 模式不依赖现有的 Web 服务器，acme.sh 会启动一个内置的**临时 HTTP 服务器**监听 80 端口，完成验证后立即关闭。

适用场景：
- 服务器上没有安装 Web 服务器
- Web 服务器已停止服务，80 端口空闲
- 临时申请证书

### 3.3.2 基本用法

```bash
# 停止占用 80 端口的服务
systemctl stop nginx
# 或
systemctl stop apache2

# 以 Standalone 模式申请证书
acme.sh --issue -d example.com --standalone

# 多域名
acme.sh --issue -d example.com -d www.example.com --standalone

# 申请完成后重新启动 Web 服务
systemctl start nginx
```

**重要**：运行此命令前必须确保 80 端口未被占用。可使用以下命令检查：

```bash
# 检查 80 端口占用情况
netstat -tlnp | grep :80
# 或
ss -tlnp | grep :80
# 或
lsof -i :80
```

### 3.3.3 使用自定义端口

如果服务器前面有反向代理（如 HAProxy、Nginx）将外部 80 端口流量转发到内部其他端口，可以指定 acme.sh 监听的端口：

```bash
# 监听 8080 端口（外部 80 转发到内部 8080）
acme.sh --issue -d example.com --standalone --httpport 8080
```

需要在上层反向代理中配置：

```nginx
# Nginx 反向代理配置（将外部 80 的 /.well-known 流量转发到内部 8080）
server {
    listen 80;
    server_name example.com;

    location /.well-known/acme-challenge/ {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

### 3.3.4 注意事项

1. **端口冲突**：必须确保 80 端口（或指定端口）在验证期间可用
2. **防火墙**：确保防火墙允许 80 端口的入站连接
3. **不推荐用于生产续期**：因为每次续期都需要暂停 Web 服务（可考虑 Webroot 模式或 DNS 模式）

---

## 3.4 TLS-ALPN 模式（Standalone ALPN）

### 3.4.1 概述

TLS-ALPN 模式（TLS-ALPN-01 Challenge）使用 443 端口代替 80 端口进行验证，acme.sh 启动一个支持 `acme-tls/1` ALPN 扩展的临时 TLS 服务器。

适用场景：
- 防火墙只开放了 443 端口，80 端口不可访问
- 不想使用 DNS 验证的场景

```bash
# 停止占用 443 端口的服务
systemctl stop nginx

# 以 TLS-ALPN 模式申请证书
acme.sh --issue -d example.com --alpn

# 指定自定义 TLS 端口
acme.sh --issue -d example.com --alpn --tlsport 8443
```

---

## 3.5 Nginx 模式

### 3.5.1 概述

Nginx 模式由 acme.sh 自动修改 Nginx 配置以支持验证，验证完成后自动还原配置。与 Webroot 模式不同，Nginx 模式不需要手动指定根目录路径。

```bash
# 让 acme.sh 自动检测 Nginx 配置
acme.sh --issue -d example.com --nginx

# 指定 Nginx 主配置文件
acme.sh --issue -d example.com --nginx /etc/nginx/nginx.conf

# 指定特定站点配置文件
acme.sh --issue -d example.com --nginx /etc/nginx/conf.d/example.com.conf
```

### 3.5.2 工作原理

acme.sh 在 Nginx 模式下会：
1. 读取 Nginx 配置文件，找到对应 `server_name` 的 `root` 指令
2. 临时修改配置以允许 `.well-known/acme-challenge/` 路径访问
3. 通知 CA 进行验证
4. 验证完成后恢复 Nginx 配置原状

**适用要求**：
- Nginx 已安装且正在运行
- 当前用户有权限读取和修改 Nginx 配置文件（通常需要 root）
- 域名对应的 `server` 块已存在于配置中

---

## 3.6 Apache 模式

### 3.6.1 概述

Apache 模式与 Nginx 模式类似，由 acme.sh 自动处理 Apache 的配置，完成验证后恢复。

```bash
# 让 acme.sh 自动处理 Apache 配置
acme.sh --issue -d example.com --apache

# 多域名
acme.sh --issue -d example.com -d www.example.com --apache
```

**适用要求**：
- Apache 已安装且正在运行
- `mod_rewrite` 模块已启用
- 当前用户有权限修改 Apache 配置（通常需要 root 或 www-data 用户）

---

## 3.7 宝塔面板（BT Panel）下的使用

宝塔面板是国内广泛使用的服务器管理面板，与 acme.sh 结合使用非常方便。

### 3.7.1 安装 acme.sh

在宝塔面板的终端中执行：

```bash
curl https://get.acme.sh | sh -s email=your@email.com
source ~/.bashrc
```

### 3.7.2 使用 Webroot 模式申请证书

宝塔面板的网站根目录通常为 `/www/wwwroot/域名/`：

```bash
# 申请证书
acme.sh --issue -d example.com -d www.example.com -w /www/wwwroot/example.com
```

### 3.7.3 安装证书到宝塔

有两种方式：

**方式一：手动粘贴**
1. 在宝塔面板中进入站点设置 → SSL
2. 选择"其他证书"
3. 将 fullchain.cer 内容粘贴到"证书"框，将 example.com.key 内容粘贴到"密钥"框

**方式二：使用 install-cert 命令**

宝塔面板 Nginx 证书目录通常为 `/www/server/panel/vhost/cert/example.com/`：

```bash
# 创建目录
mkdir -p /www/server/panel/vhost/cert/example.com/

# 安装证书
acme.sh --install-cert -d example.com \
  --key-file /www/server/panel/vhost/cert/example.com/privkey.pem \
  --fullchain-file /www/server/panel/vhost/cert/example.com/fullchain.pem \
  --reloadcmd "systemctl reload nginx"
```

然后在宝塔面板的 Nginx 站点配置中，将 SSL 证书路径修改为上述路径。

---

## 3.8 LNMP 环境下的使用

LNMP（Linux + Nginx + MySQL + PHP）是国内流行的 Web 服务器一键包。

```bash
# LNMP 网站根目录通常为 /home/wwwroot/example.com
acme.sh --issue -d example.com -w /home/wwwroot/example.com

# 安装证书（LNMP 通常将证书放在 /usr/local/nginx/conf/ssl/ 目录）
mkdir -p /usr/local/nginx/conf/ssl/example.com/

acme.sh --install-cert -d example.com \
  --key-file /usr/local/nginx/conf/ssl/example.com/example.com.key \
  --fullchain-file /usr/local/nginx/conf/ssl/example.com/fullchain.pem \
  --reloadcmd "systemctl reload nginx"
```

---

## 3.9 验证模式对比与选择建议

| 模式 | 80端口 | 443端口 | 需要Web服务器 | 支持通配符 | 推荐程度 |
|------|:------:|:-------:|:------------:|:--------:|:--------:|
| Webroot | 需要 | 不需要 | 需要 | ❌ | ⭐⭐⭐⭐⭐ |
| Standalone | 需要 | 不需要 | 不需要 | ❌ | ⭐⭐⭐ |
| TLS-ALPN | 不需要 | 需要 | 不需要 | ❌ | ⭐⭐⭐ |
| Nginx 模式 | 需要 | 不需要 | Nginx | ❌ | ⭐⭐⭐⭐ |
| Apache 模式 | 需要 | 不需要 | Apache | ❌ | ⭐⭐⭐⭐ |
| DNS API | 不需要 | 不需要 | 不需要 | ✅ | ⭐⭐⭐⭐⭐ |

**选择建议：**
- 已有运行中的 Nginx/Apache + 无需通配符 → **Webroot 模式**
- 内网服务器或 80 端口不可达 + 需要通配符 → **DNS-01 验证**（见第四章）
- 临时申请 + 没有 Web 服务器 → **Standalone 模式**
- 企业级部署（多域名、自动化） → **DNS API 模式**

---

## 3.10 小结

本章介绍了 HTTP 验证的所有模式：

- **Webroot**：推荐首选，将验证文件写入 Web 根目录
- **Standalone**：适合临时使用，acme.sh 自带 HTTP 服务器
- **TLS-ALPN**：使用 443 端口验证，适合仅开放 443 的环境
- **Nginx/Apache 模式**：自动处理 Web 服务器配置

HTTP 验证最大的限制是：**无法申请通配符证书**，且要求域名能通过公网访问到服务器 80 端口。下一章将介绍功能更强大的 DNS-01 验证方式。
