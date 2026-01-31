---
layout: post
title: 02 - GeoServer安装与配置
date: 2024-02-02 10:00:00 +0800
categories: [GIS, GeoServer]
tags: [GeoServer, 安装配置, Java, Tomcat]
---

# 第2章 GeoServer安装与配置

## 2.1 系统需求和环境准备

### 2.1.1 硬件要求

GeoServer作为一个Java Web应用，对硬件的要求取决于预期的负载和数据规模。以下是不同规模部署的建议配置：

**开发和测试环境：**
- CPU：双核处理器
- 内存：4GB RAM
- 硬盘：20GB可用空间
- 网络：100Mbps网络连接

**小型生产环境：**
- CPU：四核处理器
- 内存：8-16GB RAM
- 硬盘：100GB SSD存储
- 网络：1Gbps网络连接

**大型生产环境：**
- CPU：8核或以上处理器
- 内存：32GB或以上RAM
- 硬盘：SSD阵列，根据数据量配置
- 网络：10Gbps网络连接或负载均衡

需要注意的是，GeoServer的性能瓶颈通常在于：
1. 内存：地图渲染和要素查询都需要较多内存
2. I/O：频繁的数据读取对存储性能有要求
3. CPU：复杂的样式渲染和空间查询消耗CPU资源

### 2.1.2 操作系统支持

GeoServer是跨平台的Java应用，支持以下操作系统：

**Linux（推荐）：**
- Ubuntu Server 18.04/20.04/22.04 LTS
- CentOS 7/8、Rocky Linux 8/9
- Debian 10/11
- Red Hat Enterprise Linux 7/8/9

**Windows：**
- Windows Server 2016/2019/2022
- Windows 10/11（开发环境）

**macOS：**
- macOS 10.14及以上（主要用于开发）

在生产环境中，强烈推荐使用Linux操作系统，原因包括：
- 更好的稳定性和安全性
- 更低的资源占用
- 更成熟的运维工具链
- 大多数GeoServer部署都在Linux上运行

### 2.1.3 软件依赖

GeoServer的核心依赖是Java运行环境。不同版本的GeoServer对Java版本有不同要求：

| GeoServer版本 | 支持的Java版本 |
|--------------|---------------|
| 2.26.x及以上 | Java 11, 17, 21 |
| 2.24.x-2.25.x | Java 11, 17 |
| 2.20.x-2.23.x | Java 11, 17 |
| 2.15.x-2.19.x | Java 8, 11 |
| 2.9.x-2.14.x | Java 8 |

**推荐配置：**
- 使用最新的LTS版本GeoServer
- 使用Java 17或Java 21
- 选择OpenJDK或Eclipse Temurin（原AdoptOpenJDK）

### 2.1.4 网络要求

GeoServer需要以下网络配置：

- 默认HTTP端口：8080（可配置）
- 防火墙：允许外部访问GeoServer端口
- DNS：如果需要域名访问，配置相应的DNS记录
- 反向代理：生产环境建议通过Nginx或Apache进行反向代理

## 2.2 Java运行环境配置

### 2.2.1 在Ubuntu/Debian上安装Java

```bash
# 更新软件包列表
sudo apt update

# 安装OpenJDK 17
sudo apt install openjdk-17-jdk

# 验证安装
java -version

# 输出示例：
# openjdk version "17.0.8" 2023-07-18
# OpenJDK Runtime Environment (build 17.0.8+7-Ubuntu-122.04)
# OpenJDK 64-Bit Server VM (build 17.0.8+7-Ubuntu-122.04, mixed mode, sharing)
```

如果需要安装多个Java版本，可以使用update-alternatives管理：

```bash
# 列出已安装的Java版本
sudo update-alternatives --list java

# 切换默认Java版本
sudo update-alternatives --config java
```

### 2.2.2 在CentOS/RHEL上安装Java

```bash
# 使用yum安装OpenJDK 17
sudo yum install java-17-openjdk java-17-openjdk-devel

# 或使用dnf（CentOS 8/RHEL 8及以上）
sudo dnf install java-17-openjdk java-17-openjdk-devel

# 验证安装
java -version
```

### 2.2.3 在Windows上安装Java

1. 访问Eclipse Temurin下载页面：https://adoptium.net/
2. 下载适合您系统的JDK 17安装程序
3. 运行安装程序，按照向导完成安装
4. 配置环境变量：
   - 添加JAVA_HOME指向JDK安装目录
   - 将%JAVA_HOME%\bin添加到PATH

验证安装：
```cmd
java -version
echo %JAVA_HOME%
```

### 2.2.4 配置JAVA_HOME

无论使用哪种操作系统，建议配置JAVA_HOME环境变量：

**Linux（添加到~/.bashrc或/etc/profile）：**
```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

**Windows（系统属性 > 环境变量）：**
```
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.8+7
Path=%JAVA_HOME%\bin;...其他路径...
```

## 2.3 GeoServer的下载与安装

### 2.3.1 下载方式

GeoServer提供多种下载形式，适合不同的部署场景：

**平台无关包（推荐）：**
- Web Archive（WAR）：用于部署到现有的Servlet容器
- Binary（ZIP/tar.gz）：独立运行包，内置Jetty服务器

**平台特定包：**
- Windows Installer：Windows安装程序
- Docker镜像：容器化部署

下载地址：https://geoserver.org/download/

选择建议：
- 快速试用和开发：使用Binary包
- 生产部署：使用WAR包部署到Tomcat
- 容器化环境：使用Docker镜像

### 2.3.2 使用Binary包安装（独立模式）

Binary包是最简单的安装方式，适合快速试用和开发环境。

**下载和解压：**
```bash
# 下载GeoServer（以2.24.x版本为例）
wget https://sourceforge.net/projects/geoserver/files/GeoServer/2.24.0/geoserver-2.24.0-bin.zip

# 解压到指定目录
unzip geoserver-2.24.0-bin.zip -d /opt/
mv /opt/geoserver-2.24.0 /opt/geoserver

# 设置权限
sudo chown -R $USER:$USER /opt/geoserver
```

**启动GeoServer：**
```bash
cd /opt/geoserver/bin

# Linux/macOS
./startup.sh

# Windows
startup.bat
```

**停止GeoServer：**
```bash
# Linux/macOS
./shutdown.sh

# Windows
shutdown.bat
```

启动成功后，可以通过浏览器访问：http://localhost:8080/geoserver

### 2.3.3 使用WAR包部署到Tomcat

在生产环境中，推荐将GeoServer部署到专业的Servlet容器如Apache Tomcat。

**安装Tomcat：**
```bash
# Ubuntu/Debian
sudo apt install tomcat9

# CentOS/RHEL
sudo yum install tomcat

# 或手动安装
wget https://dlcdn.apache.org/tomcat/tomcat-9/v9.0.80/bin/apache-tomcat-9.0.80.tar.gz
tar xzf apache-tomcat-9.0.80.tar.gz -C /opt/
mv /opt/apache-tomcat-9.0.80 /opt/tomcat
```

**部署GeoServer WAR：**
```bash
# 下载WAR包
wget https://sourceforge.net/projects/geoserver/files/GeoServer/2.24.0/geoserver-2.24.0-war.zip

# 解压
unzip geoserver-2.24.0-war.zip

# 部署到Tomcat
cp geoserver.war /opt/tomcat/webapps/

# 启动Tomcat
/opt/tomcat/bin/startup.sh
```

Tomcat会自动解压WAR文件并启动GeoServer应用。

### 2.3.4 使用Docker部署

Docker是现代化部署的推荐方式，提供了环境隔离和便捷的版本管理。

**基本部署：**
```bash
# 拉取官方镜像
docker pull docker.osgeo.org/geoserver:2.24.0

# 运行容器
docker run -d \
  --name geoserver \
  -p 8080:8080 \
  -v /data/geoserver_data:/opt/geoserver_data \
  docker.osgeo.org/geoserver:2.24.0
```

**使用Docker Compose：**
```yaml
# docker-compose.yml
version: '3'
services:
  geoserver:
    image: docker.osgeo.org/geoserver:2.24.0
    container_name: geoserver
    ports:
      - "8080:8080"
    volumes:
      - geoserver_data:/opt/geoserver_data
    environment:
      - GEOSERVER_ADMIN_USER=admin
      - GEOSERVER_ADMIN_PASSWORD=geoserver
    restart: unless-stopped

volumes:
  geoserver_data:
```

启动服务：
```bash
docker-compose up -d
```

### 2.3.5 配置为系统服务

在生产环境中，应将GeoServer配置为系统服务，实现开机自启动和服务管理。

**使用systemd（Linux）：**

创建服务文件 /etc/systemd/system/geoserver.service：
```ini
[Unit]
Description=GeoServer
After=network.target

[Service]
Type=simple
User=geoserver
Group=geoserver
Environment="JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64"
Environment="GEOSERVER_HOME=/opt/geoserver"
Environment="GEOSERVER_DATA_DIR=/opt/geoserver_data"
ExecStart=/opt/geoserver/bin/startup.sh
ExecStop=/opt/geoserver/bin/shutdown.sh
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
# 重新加载systemd配置
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable geoserver

# 启动服务
sudo systemctl start geoserver

# 查看状态
sudo systemctl status geoserver
```

## 2.4 Web应用服务器部署

### 2.4.1 Apache Tomcat配置

当使用Tomcat部署GeoServer时，需要进行一些优化配置。

**配置server.xml：**
```xml
<!-- 调整连接器配置 -->
<Connector port="8080" protocol="HTTP/1.1"
           connectionTimeout="20000"
           redirectPort="8443"
           maxThreads="200"
           minSpareThreads="25"
           URIEncoding="UTF-8" />
```

**配置context.xml：**
```xml
<Context>
    <!-- 禁用会话持久化 -->
    <Manager pathname="" />
</Context>
```

**配置JVM参数：**

创建或编辑 /opt/tomcat/bin/setenv.sh：
```bash
#!/bin/bash
export JAVA_OPTS="-Xms2g -Xmx4g -XX:+UseG1GC"
export CATALINA_OPTS="-DGEOSERVER_DATA_DIR=/opt/geoserver_data"
```

### 2.4.2 Nginx反向代理配置

在生产环境中，建议使用Nginx作为前端反向代理：

```nginx
# /etc/nginx/sites-available/geoserver
server {
    listen 80;
    server_name geoserver.example.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name geoserver.example.com;

    ssl_certificate /etc/letsencrypt/live/geoserver.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/geoserver.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080/geoserver/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 增加超时时间（某些操作可能较慢）
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/geoserver /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2.4.3 配置GeoServer代理基础URL

当使用反向代理时，需要在GeoServer中配置正确的代理基础URL，以确保生成的服务URL正确。

1. 登录GeoServer管理界面
2. 进入"全局设置"（Global）
3. 找到"代理基础URL"（Proxy Base URL）
4. 设置为外部访问URL，如：https://geoserver.example.com/geoserver

## 2.5 GeoServer目录结构

### 2.5.1 安装目录结构

Binary包解压后的目录结构：

```
geoserver/
├── bin/                    # 启动脚本
│   ├── startup.sh          # Linux/macOS启动脚本
│   ├── startup.bat         # Windows启动脚本
│   ├── shutdown.sh         # Linux/macOS停止脚本
│   └── shutdown.bat        # Windows停止脚本
├── data_dir/               # 默认数据目录
├── etc/                    # 配置文件
├── lib/                    # 依赖库
├── logs/                   # 日志文件
├── modules/                # 模块
├── resources/              # 资源文件
├── webapps/                # Web应用
│   └── geoserver/          # GeoServer应用
└── start.jar               # Jetty启动器
```

### 2.5.2 数据目录结构

数据目录是GeoServer最重要的目录，包含所有配置和数据：

```
data_dir/
├── global.xml              # 全局配置
├── logging.xml             # 日志配置
├── wms.xml                 # WMS服务配置
├── wfs.xml                 # WFS服务配置
├── wcs.xml                 # WCS服务配置
├── security/               # 安全配置
│   ├── masterpw.info       # 主密码信息
│   ├── users.xml           # 用户定义
│   ├── roles.xml           # 角色定义
│   ├── layers.properties   # 图层访问规则
│   └── services.properties # 服务访问规则
├── workspaces/             # 工作区配置
│   └── workspace_name/     # 单个工作区
│       ├── namespace.xml   # 命名空间配置
│       ├── workspace.xml   # 工作区配置
│       └── store_name/     # 数据存储
│           ├── datastore.xml
│           └── featuretype/
├── styles/                 # 样式文件
│   ├── style_name.sld      # SLD样式文件
│   └── style_name.xml      # 样式配置
├── layergroups/            # 图层组配置
├── gwc/                    # GeoWebCache配置
│   └── geowebcache.xml     # 瓦片缓存配置
├── gwc-layers/             # 缓存图层配置
├── palettes/               # 调色板文件
├── plugIns/                # 插件目录
├── user_projections/       # 自定义投影定义
│   └── epsg.properties
├── logs/                   # 日志文件
└── temp/                   # 临时文件
```

### 2.5.3 配置数据目录位置

可以通过环境变量或系统属性指定数据目录位置：

**环境变量方式：**
```bash
export GEOSERVER_DATA_DIR=/opt/geoserver_data
```

**Java系统属性方式：**
```bash
java -DGEOSERVER_DATA_DIR=/opt/geoserver_data -jar start.jar
```

**Tomcat配置方式：**
在setenv.sh中设置：
```bash
export CATALINA_OPTS="-DGEOSERVER_DATA_DIR=/opt/geoserver_data"
```

将数据目录与安装目录分离的好处：
- 升级GeoServer时保留配置
- 便于备份和迁移
- 可以将数据目录放在高性能存储上

## 2.6 基本配置详解

### 2.6.1 全局配置

在GeoServer管理界面的"全局设置"中，可以配置以下重要选项：

**服务器设置：**
- 管理员名称和密码
- 代理基础URL（用于反向代理）
- 日志配置文件位置
- 日志级别

**JAI设置（Java高级成像）：**
- 内存容量：建议设置为系统内存的1/4
- 瓦片线程数：根据CPU核心数设置
- 瓦片优先级：根据应用场景调整

**GeoWebCache设置：**
- 启用/禁用内置瓦片缓存
- 缓存目录位置
- 缓存参数

### 2.6.2 服务配置

每种OGC服务都有独立的配置页面：

**WMS配置：**
- 输出格式限制
- 最大渲染内存
- 最大渲染时间
- 水印设置

**WFS配置：**
- 服务级别（Basic、Transactional、Complete）
- 最大要素数量
- 输出格式

**WCS配置：**
- 最大输入/输出内存
- 覆盖范围限制

### 2.6.3 日志配置

GeoServer使用Log4j进行日志管理，日志级别可在管理界面中配置：

| 日志级别 | 说明 | 适用场景 |
|---------|------|---------|
| PRODUCTION_LOGGING | 仅记录警告和错误 | 生产环境 |
| GEOSERVER_DEVELOPER_LOGGING | 详细的GeoServer日志 | 调试GeoServer问题 |
| GEOTOOLS_DEVELOPER_LOGGING | 详细的GeoTools日志 | 调试数据读取问题 |
| VERBOSE_LOGGING | 非常详细的日志 | 深度调试 |

自定义日志配置：

创建logging.xml文件：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<logging>
  <level>PRODUCTION_LOGGING.properties</level>
  <location>logs/geoserver.log</location>
  <stdOutLogging>true</stdOutLogging>
</logging>
```

### 2.6.4 联系信息配置

配置正确的联系信息是OGC服务的标准要求：

1. 进入"联系信息"页面
2. 填写以下信息：
   - 联系人姓名
   - 组织名称
   - 职位
   - 联系方式（电话、传真、电子邮件）
   - 地址信息

这些信息会出现在服务的GetCapabilities响应中。

## 2.7 首次启动与验证

### 2.7.1 启动GeoServer

根据安装方式选择启动命令：

```bash
# Binary包方式
cd /opt/geoserver/bin
./startup.sh

# Tomcat方式
/opt/tomcat/bin/startup.sh

# Docker方式
docker start geoserver

# systemd方式
sudo systemctl start geoserver
```

### 2.7.2 访问管理界面

打开浏览器，访问：http://localhost:8080/geoserver

首页显示GeoServer的基本信息，包括版本、服务状态等。

### 2.7.3 登录管理界面

点击右上角的"登录"链接，使用默认凭据：
- 用户名：admin
- 密码：geoserver

**重要：首次登录后务必修改默认密码！**

修改密码步骤：
1. 登录后点击"用户"或进入"安全" > "用户、组、角色"
2. 编辑admin用户
3. 设置新的强密码

### 2.7.4 验证服务状态

**检查WMS服务：**

访问GetCapabilities：
```
http://localhost:8080/geoserver/wms?service=WMS&version=1.1.1&request=GetCapabilities
```

**检查WFS服务：**
```
http://localhost:8080/geoserver/wfs?service=WFS&version=2.0.0&request=GetCapabilities
```

**使用图层预览：**

1. 在管理界面点击"图层预览"
2. 选择任意内置图层
3. 点击"OpenLayers"查看地图预览

### 2.7.5 常见启动问题排查

**端口冲突：**
```
错误信息：Address already in use: bind
解决方案：检查8080端口是否被占用，使用netstat -tlnp | grep 8080
```

**Java版本不兼容：**
```
错误信息：Unsupported class file major version
解决方案：确认Java版本与GeoServer版本兼容
```

**内存不足：**
```
错误信息：OutOfMemoryError
解决方案：增加JVM堆内存大小，设置-Xmx参数
```

**权限问题：**
```
错误信息：Permission denied
解决方案：检查数据目录和日志目录的权限
```

### 2.7.6 健康检查

可以通过REST API进行健康检查：

```bash
# 检查系统状态
curl -u admin:geoserver http://localhost:8080/geoserver/rest/about/status.json

# 检查版本信息
curl -u admin:geoserver http://localhost:8080/geoserver/rest/about/version.json
```

## 本章小结

本章详细介绍了GeoServer的安装和配置过程，包括：

1. 系统需求分析和环境准备
2. Java运行环境的安装和配置
3. GeoServer的多种安装方式（Binary包、WAR包、Docker）
4. Web应用服务器的配置和反向代理设置
5. GeoServer目录结构的详细说明
6. 基本配置项的解释和设置方法
7. 首次启动和服务验证

正确的安装和配置是GeoServer稳定运行的基础。在生产环境中，建议：
- 使用专用的服务器用户运行GeoServer
- 将数据目录与安装目录分离
- 配置反向代理和HTTPS
- 定期备份数据目录

在下一章中，我们将学习如何管理和发布地理数据，包括创建工作区、配置数据存储和发布图层。

## 思考与练习

1. 在您的开发环境中安装GeoServer，使用Binary包方式进行快速部署。
2. 尝试将GeoServer部署到Tomcat，对比与独立模式的区别。
3. 配置Nginx反向代理，实现通过域名访问GeoServer。
4. 分析GeoServer数据目录的结构，理解各配置文件的作用。
5. 修改默认管理员密码，并尝试创建一个新的管理员用户。
6. 调整JVM参数，观察对GeoServer性能的影响。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="01-GeoServer概述与入门" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="03-数据管理与发布" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
