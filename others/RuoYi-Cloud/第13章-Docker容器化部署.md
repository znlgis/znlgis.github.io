---
layout: default
title: 第13章 - Docker容器化部署
---

# 第13章 - Docker容器化部署

## 13.1 Docker部署概述

### 13.1.1 部署架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Docker Compose 部署架构                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           ruoyi-nginx                                │    │
│  │                       Nginx反向代理 [:80]                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                │                                            │
│          ┌─────────────────────┴─────────────────────┐                      │
│          │                                           │                      │
│          ▼                                           ▼                      │
│  ┌───────────────┐                          ┌───────────────┐               │
│  │   前端静态    │                          │ ruoyi-gateway │               │
│  │   资源文件    │                          │   [:8080]     │               │
│  └───────────────┘                          └───────┬───────┘               │
│                                                     │                       │
│         ┌───────────────────────────────────────────┼───────────────────────┤
│         │                           │               │               │       │
│         ▼                           ▼               ▼               ▼       │
│ ┌───────────────┐         ┌───────────────┐ ┌───────────────┐ ┌───────────┐ │
│ │  ruoyi-auth   │         │ ruoyi-system  │ │  ruoyi-gen    │ │ruoyi-job  │ │
│ │   [:9200]     │         │   [:9201]     │ │   [:9202]     │ │  [:9203]  │ │
│ └───────────────┘         └───────────────┘ └───────────────┘ └───────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          基础设施层                                  │    │
│  ├─────────────────┬─────────────────┬─────────────────────────────────┤    │
│  │   ruoyi-mysql   │   ruoyi-redis   │          ruoyi-nacos            │    │
│  │     [:3306]     │     [:6379]     │   [:8848/:9848/:9849]           │    │
│  └─────────────────┴─────────────────┴─────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.1.2 目录结构

```
docker/
├── docker-compose.yml           # 编排文件
├── mysql/                       # MySQL配置
│   ├── Dockerfile
│   ├── conf/
│   │   └── my.cnf
│   └── db/
│       └── *.sql
├── nginx/                       # Nginx配置
│   ├── Dockerfile
│   ├── conf/
│   │   └── nginx.conf
│   ├── conf.d/
│   │   └── default.conf
│   └── html/
│       └── dist/                # 前端构建产物
├── nacos/                       # Nacos配置
│   ├── Dockerfile
│   └── conf/
│       └── application.properties
├── redis/                       # Redis配置
│   ├── Dockerfile
│   └── conf/
│       └── redis.conf
└── ruoyi/                       # 应用服务
    ├── gateway/
    │   └── Dockerfile
    ├── auth/
    │   └── Dockerfile
    └── modules/
        ├── system/
        │   └── Dockerfile
        ├── gen/
        │   └── Dockerfile
        └── job/
            └── Dockerfile
```

## 13.2 Docker Compose配置

### 13.2.1 完整编排文件

```yaml
version: '3.8'
services:
  # MySQL数据库
  ruoyi-mysql:
    container_name: ruoyi-mysql
    image: mysql:5.7
    build:
      context: ./mysql
    ports:
      - "3306:3306"
    volumes:
      - ./mysql/conf:/etc/mysql/conf.d
      - ./mysql/logs:/logs
      - ./mysql/data:/var/lib/mysql
    command: [
          'mysqld',
          '--innodb-buffer-pool-size=80M',
          '--character-set-server=utf8mb4',
          '--collation-server=utf8mb4_unicode_ci',
          '--default-time-zone=+8:00',
          '--lower-case-table-names=1'
        ]
    environment:
      MYSQL_DATABASE: 'ry-cloud'
      MYSQL_ROOT_PASSWORD: password
    networks:
      - ruoyi-network

  # Redis缓存
  ruoyi-redis:
    container_name: ruoyi-redis
    image: redis
    build:
      context: ./redis
    ports:
      - "6379:6379"
    volumes:
      - ./redis/conf/redis.conf:/home/ruoyi/redis/redis.conf
      - ./redis/data:/data
    command: redis-server /home/ruoyi/redis/redis.conf
    networks:
      - ruoyi-network

  # Nacos注册配置中心
  ruoyi-nacos:
    container_name: ruoyi-nacos
    image: nacos/nacos-server
    build:
      context: ./nacos
    environment:
      - MODE=standalone
    volumes:
      - ./nacos/logs/:/home/nacos/logs
      - ./nacos/conf/application.properties:/home/nacos/conf/application.properties
    ports:
      - "8848:8848"
      - "9848:9848"
      - "9849:9849"
    depends_on:
      - ruoyi-mysql
    networks:
      - ruoyi-network

  # Nginx反向代理
  ruoyi-nginx:
    container_name: ruoyi-nginx
    image: nginx
    build:
      context: ./nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/html/dist:/home/ruoyi/projects/ruoyi-ui
      - ./nginx/conf/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/logs:/var/log/nginx
      - ./nginx/conf.d:/etc/nginx/conf.d
    depends_on:
      - ruoyi-gateway
    links:
      - ruoyi-gateway
    networks:
      - ruoyi-network

  # 网关服务
  ruoyi-gateway:
    container_name: ruoyi-gateway
    build:
      context: ./ruoyi/gateway
      dockerfile: dockerfile
    ports:
      - "8080:8080"
    depends_on:
      - ruoyi-redis
      - ruoyi-nacos
    links:
      - ruoyi-redis
    networks:
      - ruoyi-network

  # 认证服务
  ruoyi-auth:
    container_name: ruoyi-auth
    build:
      context: ./ruoyi/auth
      dockerfile: dockerfile
    ports:
      - "9200:9200"
    depends_on:
      - ruoyi-redis
      - ruoyi-nacos
    links:
      - ruoyi-redis
    networks:
      - ruoyi-network

  # 系统服务
  ruoyi-modules-system:
    container_name: ruoyi-modules-system
    build:
      context: ./ruoyi/modules/system
      dockerfile: dockerfile
    ports:
      - "9201:9201"
    depends_on:
      - ruoyi-redis
      - ruoyi-mysql
      - ruoyi-nacos
    links:
      - ruoyi-redis
      - ruoyi-mysql
    networks:
      - ruoyi-network

  # 代码生成服务
  ruoyi-modules-gen:
    container_name: ruoyi-modules-gen
    build:
      context: ./ruoyi/modules/gen
      dockerfile: dockerfile
    ports:
      - "9202:9202"
    depends_on:
      - ruoyi-mysql
      - ruoyi-nacos
    links:
      - ruoyi-mysql
    networks:
      - ruoyi-network

  # 定时任务服务
  ruoyi-modules-job:
    container_name: ruoyi-modules-job
    build:
      context: ./ruoyi/modules/job
      dockerfile: dockerfile
    ports:
      - "9203:9203"
    depends_on:
      - ruoyi-mysql
      - ruoyi-nacos
    links:
      - ruoyi-mysql
    networks:
      - ruoyi-network

  # 文件服务
  ruoyi-modules-file:
    container_name: ruoyi-modules-file
    build:
      context: ./ruoyi/modules/file
      dockerfile: dockerfile
    ports:
      - "9300:9300"
    volumes:
      - ./ruoyi/uploadPath:/home/ruoyi/uploadPath
    depends_on:
      - ruoyi-nacos
    networks:
      - ruoyi-network

  # 监控服务
  ruoyi-visual-monitor:
    container_name: ruoyi-visual-monitor
    build:
      context: ./ruoyi/visual/monitor
      dockerfile: dockerfile
    ports:
      - "9100:9100"
    depends_on:
      - ruoyi-nacos
    networks:
      - ruoyi-network

networks:
  ruoyi-network:
    driver: bridge
```

## 13.3 各服务Dockerfile

### 13.3.1 MySQL Dockerfile

```dockerfile
# docker/mysql/Dockerfile
FROM mysql:5.7
MAINTAINER ruoyi

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 复制SQL脚本
COPY ./db/*.sql /docker-entrypoint-initdb.d/

# 设置字符集
RUN echo "character-set-server=utf8mb4" >> /etc/mysql/mysql.conf.d/mysqld.cnf
RUN echo "collation-server=utf8mb4_unicode_ci" >> /etc/mysql/mysql.conf.d/mysqld.cnf
```

### 13.3.2 Redis Dockerfile

```dockerfile
# docker/redis/Dockerfile
FROM redis
MAINTAINER ruoyi

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
```

### 13.3.3 Nginx Dockerfile

```dockerfile
# docker/nginx/Dockerfile
FROM nginx
MAINTAINER ruoyi

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 复制前端文件
COPY ./html/dist /home/ruoyi/projects/ruoyi-ui
```

### 13.3.4 Java应用Dockerfile

```dockerfile
# docker/ruoyi/gateway/dockerfile
FROM openjdk:8-jre
MAINTAINER ruoyi

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建目录
RUN mkdir -p /home/ruoyi

# 设置工作目录
WORKDIR /home/ruoyi

# 复制jar包
COPY ./jar/ruoyi-gateway.jar /home/ruoyi/ruoyi-gateway.jar

# 暴露端口
EXPOSE 8080

# 启动命令
ENTRYPOINT ["java","-Djava.security.egd=file:/dev/./urandom","-jar","ruoyi-gateway.jar"]
```

## 13.4 配置文件

### 13.4.1 Nginx配置

```nginx
# docker/nginx/conf/nginx.conf
worker_processes  1;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    keepalive_timeout  65;

    # gzip压缩
    gzip on;
    gzip_min_length 1k;
    gzip_buffers 4 16k;
    gzip_comp_level 4;
    gzip_types text/plain application/javascript application/x-javascript text/css application/xml text/javascript application/x-httpd-php image/jpeg image/gif image/png;
    gzip_vary on;

    include /etc/nginx/conf.d/*.conf;
}
```

```nginx
# docker/nginx/conf.d/default.conf
server {
    listen       80;
    server_name  localhost;

    # 前端资源
    location / {
        root   /home/ruoyi/projects/ruoyi-ui;
        try_files $uri $uri/ /index.html;
        index  index.html index.htm;
    }

    # 后端API代理
    location /prod-api/ {
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header REMOTE-HOST $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://ruoyi-gateway:8080/;
    }

    # 错误页面
    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
```

### 13.4.2 Nacos配置

```properties
# docker/nacos/conf/application.properties
server.contextPath=/nacos
server.servlet.contextPath=/nacos
server.port=8848

spring.datasource.platform=mysql
db.num=1
db.url.0=jdbc:mysql://ruoyi-mysql:3306/ry-config?characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=UTC
db.user.0=root
db.password.0=password

nacos.cmdb.dumpTaskInterval=3600
nacos.cmdb.eventTaskInterval=10
nacos.cmdb.labelTaskInterval=300
nacos.cmdb.loadDataAtStart=false
management.metrics.export.elastic.enabled=false
management.metrics.export.influx.enabled=false
server.tomcat.accesslog.enabled=true
server.tomcat.accesslog.pattern=%h %l %u %t "%r" %s %b %D %{User-Agent}i
nacos.security.ignore.urls=/,/**/*.css,/**/*.js,/**/*.html,/**/*.map,/**/*.svg,/**/*.png,/**/*.ico,/console-ui/public/**,/v1/auth/login,/v1/console/health/**,/v1/cs/**,/v1/ns/**,/v1/cmdb/**,/actuator/**,/v1/console/server/**
nacos.naming.distro.taskDispatchThreadCount=1
nacos.naming.distro.taskDispatchPeriod=200
nacos.naming.distro.batchSyncKeyCount=1000
nacos.naming.distro.initDataRatio=0.9
nacos.naming.distro.syncRetryDelay=5000
nacos.naming.data.warmup=true
nacos.naming.expireInstance=true
nacos.console.ui.enabled=true
```

### 13.4.3 Redis配置

```conf
# docker/redis/conf/redis.conf
# 绑定地址
bind 0.0.0.0

# 端口
port 6379

# 密码（可选）
# requirepass ruoyi

# 最大客户端连接数
maxclients 10000

# 持久化
appendonly yes
appendfsync everysec

# 最大内存
maxmemory 256mb
maxmemory-policy allkeys-lru

# 日志级别
loglevel notice

# 数据库数量
databases 16
```

## 13.5 部署步骤

### 13.5.1 准备工作

```bash
# 1. 安装Docker
curl -fsSL https://get.docker.com | bash -s docker

# 2. 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 3. 验证安装
docker --version
docker-compose --version
```

### 13.5.2 构建项目

```bash
# 1. 进入项目目录
cd RuoYi-Cloud

# 2. 后端打包
mvn clean package -DskipTests

# 3. 前端打包
cd ruoyi-ui
npm install
npm run build:prod

# 4. 复制jar包到docker目录
cp ruoyi-gateway/target/ruoyi-gateway.jar docker/ruoyi/gateway/jar/
cp ruoyi-auth/target/ruoyi-auth.jar docker/ruoyi/auth/jar/
cp ruoyi-modules/ruoyi-system/target/ruoyi-modules-system.jar docker/ruoyi/modules/system/jar/
cp ruoyi-modules/ruoyi-gen/target/ruoyi-modules-gen.jar docker/ruoyi/modules/gen/jar/
cp ruoyi-modules/ruoyi-job/target/ruoyi-modules-job.jar docker/ruoyi/modules/job/jar/
cp ruoyi-modules/ruoyi-file/target/ruoyi-modules-file.jar docker/ruoyi/modules/file/jar/

# 5. 复制前端文件
cp -r ruoyi-ui/dist docker/nginx/html/
```

### 13.5.3 启动服务

```bash
# 进入docker目录
cd docker

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 单独查看某个服务日志
docker-compose logs -f ruoyi-gateway
```

### 13.5.4 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 停止单个服务
docker-compose stop ruoyi-gateway
```

## 13.6 常用命令

### 13.6.1 Docker命令

```bash
# 查看运行中的容器
docker ps

# 查看所有容器
docker ps -a

# 进入容器
docker exec -it ruoyi-mysql bash

# 查看容器日志
docker logs ruoyi-gateway

# 重启容器
docker restart ruoyi-gateway

# 查看容器资源使用
docker stats
```

### 13.6.2 Docker Compose命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重新构建
docker-compose build

# 查看服务状态
docker-compose ps

# 扩缩容
docker-compose up -d --scale ruoyi-system=3
```

## 13.7 小结

本章详细介绍了RuoYi-Cloud的Docker容器化部署，包括：

1. **部署架构**：各服务的容器化架构
2. **Docker Compose**：完整的编排配置
3. **Dockerfile**：各服务的镜像构建文件
4. **配置文件**：Nginx、Nacos、Redis配置
5. **部署步骤**：从构建到启动的完整流程
6. **常用命令**：Docker和Docker Compose操作命令

掌握Docker部署可以实现快速、一致的部署环境，是现代化运维的必备技能。

---

[上一章：数据库设计与管理](./第12章-数据库设计与管理.md) | [返回目录](./README.md) | [下一章：二次开发指南](./第14章-二次开发指南.md)
