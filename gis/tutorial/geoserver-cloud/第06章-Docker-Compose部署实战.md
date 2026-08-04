---
layout: default
title: 第六章：Docker Compose 部署实战
---

# 第六章：Docker Compose 部署实战

## 6.1 引言

在前几章中，我们学习了 GeoServer Cloud 的架构、核心服务和配置管理。本章将进入实战环节，详细介绍如何使用 Docker Compose 部署生产级的 GeoServer Cloud 环境。Docker Compose 是单机或小规模部署的理想选择，它提供了简单而强大的容器编排能力。

我们将从基本的部署架构开始，逐步深入到监控集成、服务扩缩容、持久化配置以及生产环境的优化技巧。无论您是进行概念验证还是小规模生产部署，本章的内容都将为您提供完整的指导。

## 6.2 部署架构设计

### 6.2.1 典型部署架构

```
                            Internet
                               │
                               ▼
                    ┌────────────────────┐
                    │   Load Balancer    │
                    │   (Nginx/Traefik)  │
                    └────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Compose 部署                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Gateway (:9090)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │     WMS      │    │     WFS      │    │    WebUI     │      │
│  │   (x3实例)   │    │   (x2实例)   │    │   (x1实例)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   Discovery   │   Config   │   RabbitMQ                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               PostgreSQL (pgconfig)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2.2 服务组件选择

根据需求选择要部署的服务：

| 服务 | 必需性 | 说明 |
|------|--------|------|
| Gateway | 必需 | API 网关，统一入口 |
| Discovery | Docker Compose 必需 | 服务发现 |
| Config | Docker Compose 必需 | 配置服务 |
| RabbitMQ | 必需 | 事件总线 |
| PostgreSQL | pgconfig 必需 | 目录存储 |
| WMS | 按需 | 地图服务 |
| WFS | 按需 | 要素服务 |
| WCS | 按需 | 覆盖服务 |
| WPS | 按需 | 处理服务 |
| GWC | 按需 | 瓦片缓存 |
| REST | 按需 | REST API |
| WebUI | 按需 | 管理界面 |

### 6.2.3 资源规划

单机部署的资源建议：

| 场景 | CPU | 内存 | 存储 | 网络 |
|------|-----|------|------|------|
| 开发测试 | 4核 | 8GB | 50GB SSD | 100Mbps |
| 小型生产 | 8核 | 16GB | 200GB SSD | 1Gbps |
| 中型生产 | 16核 | 32GB | 500GB SSD | 1Gbps |

## 6.3 基础部署配置

### 6.3.1 目录结构

创建规范的部署目录结构：

```bash
mkdir -p geoserver-cloud-deploy/{config,data,logs,monitoring}
cd geoserver-cloud-deploy

# 目录结构
geoserver-cloud-deploy/
├── compose.yml              # 主配置文件
├── .env                     # 环境变量
├── config/                  # 配置文件
│   ├── gateway/
│   ├── geoserver/
│   └── monitoring/
├── data/                    # 数据卷
│   ├── postgres/
│   ├── rabbitmq/
│   └── geoserver/
├── logs/                    # 日志
└── monitoring/              # 监控配置
    ├── prometheus/
    └── grafana/
```

### 6.3.2 环境变量配置

创建 `.env` 文件：

```bash
# .env - 环境变量配置

# ===================
# 版本配置
# ===================
TAG=3.0.0.0
POSTGRES_VERSION=15-alpine
RABBITMQ_VERSION=3-management-alpine

# ===================
# 用户配置
# ===================
# 运行用户 (使用当前用户的 UID:GID)
GS_USER=1000:1000

# GeoServer 管理员
GEOSERVER_ADMIN_USERNAME=admin
GEOSERVER_ADMIN_PASSWORD=strong_password_here

# ===================
# 数据库配置
# ===================
PGCONFIG_HOST=database
PGCONFIG_PORT=5432
PGCONFIG_DATABASE=geoserver
PGCONFIG_SCHEMA=public
PGCONFIG_USERNAME=geoserver
PGCONFIG_PASSWORD=db_password_here

# ===================
# RabbitMQ 配置
# ===================
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=geoserver
RABBITMQ_PASSWORD=rabbitmq_password_here

# ===================
# 网络配置
# ===================
GEOSERVER_BASE_PATH=/geoserver/cloud
GATEWAY_PORT=9090

# ===================
# JVM 配置
# ===================
JAVA_OPTS_GATEWAY=-Xms256m -Xmx512m
JAVA_OPTS_WMS=-Xms512m -Xmx2g
JAVA_OPTS_WFS=-Xms512m -Xmx2g
JAVA_OPTS_WCS=-Xms512m -Xmx1g
JAVA_OPTS_REST=-Xms256m -Xmx1g
JAVA_OPTS_WEBUI=-Xms512m -Xmx1g
JAVA_OPTS_GWC=-Xms512m -Xmx2g

# ===================
# 日志配置
# ===================
LOG_LEVEL=INFO
```

### 6.3.3 完整的 compose.yml

```yaml
# compose.yml - GeoServer Cloud 生产部署配置

version: '3.8'

services:
  # ====================
  # 基础设施服务
  # ====================
  
  database:
    image: postgres:${POSTGRES_VERSION}
    container_name: gscloud-database
    environment:
      POSTGRES_DB: ${PGCONFIG_DATABASE}
      POSTGRES_USER: ${PGCONFIG_USERNAME}
      POSTGRES_PASSWORD: ${PGCONFIG_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PGCONFIG_USERNAME} -d ${PGCONFIG_DATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - gscloud-net

  rabbitmq:
    image: rabbitmq:${RABBITMQ_VERSION}
    container_name: gscloud-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USERNAME}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - gscloud-net

  discovery:
    image: geoservercloud/geoserver-cloud-discovery:${TAG}
    container_name: gscloud-discovery
    user: ${GS_USER}
    environment:
      JAVA_OPTS: -Xms256m -Xmx512m
    ports:
      - "8761:8761"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8761/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

  config:
    image: geoservercloud/geoserver-cloud-config:${TAG}
    container_name: gscloud-config
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
    environment:
      JAVA_OPTS: -Xms256m -Xmx512m
      EUREKA_SERVER_URL: http://discovery:8761/eureka
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

  # ====================
  # 前端服务
  # ====================
  
  gateway:
    image: geoservercloud/geoserver-cloud-gateway:${TAG}
    container_name: gscloud-gateway
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
      config:
        condition: service_healthy
    environment:
      JAVA_OPTS: ${JAVA_OPTS_GATEWAY}
      SPRING_PROFILES_ACTIVE: pgconfig
      EUREKA_SERVER_URL: http://discovery:8761/eureka
      GEOSERVER_BASE_PATH: ${GEOSERVER_BASE_PATH}
    ports:
      - "${GATEWAY_PORT}:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

  # ====================
  # GeoServer 服务
  # ====================
  
  wms:
    image: geoservercloud/geoserver-cloud-wms:${TAG}
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
      config:
        condition: service_healthy
      database:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      JAVA_OPTS: ${JAVA_OPTS_WMS}
      SPRING_PROFILES_ACTIVE: pgconfig
      EUREKA_SERVER_URL: http://discovery:8761/eureka
      GEOSERVER_BASE_PATH: ${GEOSERVER_BASE_PATH}
      PGCONFIG_HOST: ${PGCONFIG_HOST}
      PGCONFIG_PORT: ${PGCONFIG_PORT}
      PGCONFIG_DATABASE: ${PGCONFIG_DATABASE}
      PGCONFIG_USERNAME: ${PGCONFIG_USERNAME}
      PGCONFIG_PASSWORD: ${PGCONFIG_PASSWORD}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USERNAME: ${RABBITMQ_USERNAME}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      GEOSERVER_ADMIN_USERNAME: ${GEOSERVER_ADMIN_USERNAME}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_ADMIN_PASSWORD}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 10s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G

  wfs:
    image: geoservercloud/geoserver-cloud-wfs:${TAG}
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
      config:
        condition: service_healthy
      database:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      JAVA_OPTS: ${JAVA_OPTS_WFS}
      SPRING_PROFILES_ACTIVE: pgconfig
      EUREKA_SERVER_URL: http://discovery:8761/eureka
      GEOSERVER_BASE_PATH: ${GEOSERVER_BASE_PATH}
      PGCONFIG_HOST: ${PGCONFIG_HOST}
      PGCONFIG_PORT: ${PGCONFIG_PORT}
      PGCONFIG_DATABASE: ${PGCONFIG_DATABASE}
      PGCONFIG_USERNAME: ${PGCONFIG_USERNAME}
      PGCONFIG_PASSWORD: ${PGCONFIG_PASSWORD}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USERNAME: ${RABBITMQ_USERNAME}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      GEOSERVER_ADMIN_USERNAME: ${GEOSERVER_ADMIN_USERNAME}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_ADMIN_PASSWORD}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 10s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

  wcs:
    image: geoservercloud/geoserver-cloud-wcs:${TAG}
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
      config:
        condition: service_healthy
      database:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      JAVA_OPTS: ${JAVA_OPTS_WCS}
      SPRING_PROFILES_ACTIVE: pgconfig
      EUREKA_SERVER_URL: http://discovery:8761/eureka
      GEOSERVER_BASE_PATH: ${GEOSERVER_BASE_PATH}
      PGCONFIG_HOST: ${PGCONFIG_HOST}
      PGCONFIG_PORT: ${PGCONFIG_PORT}
      PGCONFIG_DATABASE: ${PGCONFIG_DATABASE}
      PGCONFIG_USERNAME: ${PGCONFIG_USERNAME}
      PGCONFIG_PASSWORD: ${PGCONFIG_PASSWORD}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USERNAME: ${RABBITMQ_USERNAME}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      GEOSERVER_ADMIN_USERNAME: ${GEOSERVER_ADMIN_USERNAME}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_ADMIN_PASSWORD}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 10s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

  rest:
    image: geoservercloud/geoserver-cloud-rest:${TAG}
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
      config:
        condition: service_healthy
      database:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      JAVA_OPTS: ${JAVA_OPTS_REST}
      SPRING_PROFILES_ACTIVE: pgconfig
      EUREKA_SERVER_URL: http://discovery:8761/eureka
      GEOSERVER_BASE_PATH: ${GEOSERVER_BASE_PATH}
      PGCONFIG_HOST: ${PGCONFIG_HOST}
      PGCONFIG_PORT: ${PGCONFIG_PORT}
      PGCONFIG_DATABASE: ${PGCONFIG_DATABASE}
      PGCONFIG_USERNAME: ${PGCONFIG_USERNAME}
      PGCONFIG_PASSWORD: ${PGCONFIG_PASSWORD}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USERNAME: ${RABBITMQ_USERNAME}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      GEOSERVER_ADMIN_USERNAME: ${GEOSERVER_ADMIN_USERNAME}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_ADMIN_PASSWORD}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 10s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

  webui:
    image: geoservercloud/geoserver-cloud-webui:${TAG}
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
      config:
        condition: service_healthy
      database:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      JAVA_OPTS: ${JAVA_OPTS_WEBUI}
      SPRING_PROFILES_ACTIVE: pgconfig
      EUREKA_SERVER_URL: http://discovery:8761/eureka
      GEOSERVER_BASE_PATH: ${GEOSERVER_BASE_PATH}
      PGCONFIG_HOST: ${PGCONFIG_HOST}
      PGCONFIG_PORT: ${PGCONFIG_PORT}
      PGCONFIG_DATABASE: ${PGCONFIG_DATABASE}
      PGCONFIG_USERNAME: ${PGCONFIG_USERNAME}
      PGCONFIG_PASSWORD: ${PGCONFIG_PASSWORD}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USERNAME: ${RABBITMQ_USERNAME}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      GEOSERVER_ADMIN_USERNAME: ${GEOSERVER_ADMIN_USERNAME}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_ADMIN_PASSWORD}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 10s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

  gwc:
    image: geoservercloud/geoserver-cloud-gwc:${TAG}
    user: ${GS_USER}
    depends_on:
      discovery:
        condition: service_healthy
      config:
        condition: service_healthy
      database:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      JAVA_OPTS: ${JAVA_OPTS_GWC}
      SPRING_PROFILES_ACTIVE: pgconfig
      EUREKA_SERVER_URL: http://discovery:8761/eureka
      GEOSERVER_BASE_PATH: ${GEOSERVER_BASE_PATH}
      PGCONFIG_HOST: ${PGCONFIG_HOST}
      PGCONFIG_PORT: ${PGCONFIG_PORT}
      PGCONFIG_DATABASE: ${PGCONFIG_DATABASE}
      PGCONFIG_USERNAME: ${PGCONFIG_USERNAME}
      PGCONFIG_PASSWORD: ${PGCONFIG_PASSWORD}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USERNAME: ${RABBITMQ_USERNAME}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      GEOSERVER_ADMIN_USERNAME: ${GEOSERVER_ADMIN_USERNAME}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_ADMIN_PASSWORD}
    volumes:
      - gwc-tiles:/opt/app/gwc-cache
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 10s
      retries: 10
    restart: unless-stopped
    networks:
      - gscloud-net

# ====================
# 数据卷
# ====================
volumes:
  postgres-data:
  rabbitmq-data:
  gwc-tiles:

# ====================
# 网络
# ====================
networks:
  gscloud-net:
    driver: bridge
```

## 6.4 服务扩缩容

### 6.4.1 手动扩缩容

```bash
# 扩展 WMS 服务到 5 个实例
docker compose up -d --scale wms=5

# 缩减 WCS 到 1 个实例
docker compose up -d --scale wcs=1

# 禁用 WPS 服务
docker compose up -d --scale wps=0

# 同时调整多个服务
docker compose up -d --scale wms=3 --scale wfs=2 --scale gwc=2
```

### 6.4.2 验证扩缩容

```bash
# 查看服务实例
docker compose ps

# 查看 Eureka 注册情况
curl http://localhost:8761/eureka/apps | jq '.applications.application[] | {name: .name, instances: [.instance[].instanceId]}'

# 测试负载均衡
for i in {1..10}; do
    curl -s "http://localhost:9090/geoserver/cloud/wms?service=WMS&request=GetCapabilities" > /dev/null
    echo "Request $i completed"
done
```

### 6.4.3 自动扩缩容脚本

创建监控脚本实现简单的自动扩缩容：

{% raw %}
```bash
#!/bin/bash
# auto-scale.sh - 基于负载的自动扩缩容

# 配置
SERVICE="wms"
MIN_INSTANCES=2
MAX_INSTANCES=10
SCALE_UP_THRESHOLD=80    # CPU 使用率阈值
SCALE_DOWN_THRESHOLD=30
CHECK_INTERVAL=60

while true; do
    # 获取当前实例数
    CURRENT=$(docker compose ps -q $SERVICE | wc -l)
    
    # 获取平均 CPU 使用率
    CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" \
        $(docker compose ps -q $SERVICE) | \
        sed 's/%//' | awk '{sum+=$1} END {print sum/NR}')
    
    echo "$(date): $SERVICE instances=$CURRENT, CPU=$CPU_USAGE%"
    
    # 扩容逻辑
    if (( $(echo "$CPU_USAGE > $SCALE_UP_THRESHOLD" | bc -l) )); then
        if [ $CURRENT -lt $MAX_INSTANCES ]; then
            NEW_COUNT=$((CURRENT + 1))
            echo "Scaling up $SERVICE to $NEW_COUNT instances"
            docker compose up -d --scale $SERVICE=$NEW_COUNT
        fi
    fi
    
    # 缩容逻辑
    if (( $(echo "$CPU_USAGE < $SCALE_DOWN_THRESHOLD" | bc -l) )); then
        if [ $CURRENT -gt $MIN_INSTANCES ]; then
            NEW_COUNT=$((CURRENT - 1))
            echo "Scaling down $SERVICE to $NEW_COUNT instances"
            docker compose up -d --scale $SERVICE=$NEW_COUNT
        fi
    fi
    
    sleep $CHECK_INTERVAL
done
```
{% endraw %}

## 6.5 监控集成

### 6.5.1 添加监控服务

创建 `monitoring.yml` 覆盖文件：

```yaml
# monitoring.yml - 监控服务配置

version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: gscloud-prometheus
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'
    ports:
      - "9091:9090"
    restart: unless-stopped
    networks:
      - gscloud-net

  grafana:
    image: grafana/grafana:latest
    container_name: gscloud-grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=grafana_password
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - gscloud-net

volumes:
  prometheus-data:
  grafana-data:
```

### 6.5.2 Prometheus 配置

创建 `monitoring/prometheus/prometheus.yml`：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Prometheus 自身
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # GeoServer Cloud 服务 - 通过 Eureka 发现
  - job_name: 'geoserver-cloud'
    eureka_sd_configs:
      - server: 'http://discovery:8761/eureka'
        refresh_interval: 30s
    relabel_configs:
      - source_labels: [__meta_eureka_app_name]
        target_label: application
      - source_labels: [__meta_eureka_app_instance_instanceId]
        target_label: instance

  # 直接配置方式（备选）
  - job_name: 'gateway'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['gateway:8080']

  - job_name: 'wms'
    metrics_path: '/actuator/prometheus'
    dns_sd_configs:
      - names: ['wms']
        type: A
        port: 8080

  # PostgreSQL 监控
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # RabbitMQ 监控
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
```

### 6.5.3 Grafana Dashboard

创建 `monitoring/grafana/provisioning/dashboards/geoserver-cloud.json`：

{% raw %}
```json
{
  "dashboard": {
    "title": "GeoServer Cloud Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_server_requests_seconds_count{application=~\".*service\"}[5m])",
            "legendFormat": "{{application}}"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))",
            "legendFormat": "{{application}}"
          }
        ]
      },
      {
        "title": "JVM Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "jvm_memory_used_bytes{area=\"heap\"}",
            "legendFormat": "{{application}} - {{instance}}"
          }
        ]
      },
      {
        "title": "Active Instances",
        "type": "stat",
        "targets": [
          {
            "expr": "count(up{job=\"geoserver-cloud\"}) by (application)"
          }
        ]
      }
    ]
  }
}
```
{% endraw %}

### 6.5.4 启用监控

```bash
# 启动主服务和监控
docker compose -f compose.yml -f monitoring.yml up -d

# 访问监控界面
# Prometheus: http://localhost:9091
# Grafana: http://localhost:3000 (admin/grafana_password)
```

## 6.6 日志管理

### 6.6.1 配置集中日志

使用 Loki 和 Promtail 收集日志：

```yaml
# logging.yml
version: '3.8'

services:
  loki:
    image: grafana/loki:latest
    container_name: gscloud-loki
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - loki-data:/loki
    networks:
      - gscloud-net

  promtail:
    image: grafana/promtail:latest
    container_name: gscloud-promtail
    volumes:
      - ./monitoring/promtail/config.yml:/etc/promtail/config.yml
      - /var/run/docker.sock:/var/run/docker.sock
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - gscloud-net

volumes:
  loki-data:
```

### 6.6.2 Promtail 配置

```yaml
# monitoring/promtail/config.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: 'service'
```

## 6.7 生产环境配置要点

### 6.7.1 安全加固

```yaml
# 安全相关配置
services:
  gateway:
    environment:
      # 禁用不必要的端点
      - MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info,prometheus
      # 启用安全头
      - SERVER_SERVLET_SESSION_COOKIE_SECURE=true
      - SERVER_SERVLET_SESSION_COOKIE_HTTP_ONLY=true
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

### 6.7.2 资源限制

为所有服务配置资源限制：

```yaml
services:
  wms:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
```

### 6.7.3 健康检查优化

```yaml
services:
  wms:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health/readiness"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s  # 给服务足够的启动时间
```

### 6.7.4 重启策略

```yaml
services:
  wms:
    restart: unless-stopped
    # 或使用 deploy 配置
    deploy:
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
```

## 6.8 运维命令速查

### 6.8.1 常用命令

```bash
# 启动服务
docker compose up -d

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f [service]

# 停止服务
docker compose stop

# 重启服务
docker compose restart [service]

# 删除所有容器和网络
docker compose down

# 删除包括数据卷
docker compose down -v

# 更新镜像
docker compose pull
docker compose up -d

# 查看资源使用
docker stats
```

### 6.8.2 故障排除

{% raw %}
```bash
# 检查服务健康
docker compose ps
docker inspect --format='{{json .State.Health}}' gscloud-wms-1

# 查看容器日志
docker compose logs --tail=100 wms

# 进入容器调试
docker compose exec wms /bin/bash

# 检查网络连通性
docker compose exec wms ping database
docker compose exec wms nc -zv rabbitmq 5672

# 检查配置
docker compose exec wms env | grep -i pgconfig
```
{% endraw %}

## 6.9 本章小结

本章详细介绍了使用 Docker Compose 部署 GeoServer Cloud 的完整流程：

1. **架构设计**：理解了典型的部署架构和服务选择。

2. **基础配置**：创建了完整的 compose.yml 和环境变量配置。

3. **服务扩缩容**：学习了手动和自动扩缩容的方法。

4. **监控集成**：配置了 Prometheus 和 Grafana 监控。

5. **日志管理**：使用 Loki 实现集中日志收集。

6. **生产优化**：了解了安全加固、资源限制等最佳实践。

在下一章中，我们将学习如何在 Kubernetes 环境中部署 GeoServer Cloud。

## 6.10 思考题

1. 在什么情况下应该增加 WMS 实例数而不是 WFS 实例数？

2. 如何设计一个高可用的 PostgreSQL 数据库方案？

3. Docker Compose 部署的主要局限性是什么？什么时候应该迁移到 Kubernetes？

4. 如何实现零停机时间的服务更新？

5. 监控系统应该关注哪些关键指标来评估 GeoServer Cloud 的健康状态？

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-cloud/第06章-Docker-Compose部署实战/第05章-安全配置与认证/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-cloud/第06章-Docker-Compose部署实战/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-cloud/第06章-Docker-Compose部署实战/第07章-Kubernetes部署实战/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
