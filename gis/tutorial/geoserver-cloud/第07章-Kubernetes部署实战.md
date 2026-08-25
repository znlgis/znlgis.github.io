---
layout: default
title: 第七章：Kubernetes 部署实战
---

# 第七章：Kubernetes 部署实战

## 7.1 引言

Kubernetes（K8s）是当今最流行的容器编排平台，为 GeoServer Cloud 这样的微服务应用提供了理想的运行环境。与 Docker Compose 相比，Kubernetes 提供了更强大的自动扩缩容、自愈能力、滚动更新和多节点部署支持。本章将详细介绍如何在 Kubernetes 环境中部署和管理 GeoServer Cloud。

我们将从 Kubernetes 的基础概念开始，逐步深入到使用 Helm Chart 部署 GeoServer Cloud、配置 Ingress、持久化存储、自动扩缩容以及在主流云平台上的部署实践。

## 7.2 Kubernetes 基础概念

### 7.2.1 核心组件

理解以下 Kubernetes 核心概念对于部署 GeoServer Cloud 至关重要：

| 组件 | 说明 | GeoServer Cloud 中的应用 |
|------|------|--------------------------|
| Pod | 最小部署单元，包含一个或多个容器 | 每个服务实例运行在一个 Pod 中 |
| Deployment | 管理 Pod 的副本集和更新策略 | 用于部署 WMS、WFS 等服务 |
| Service | 提供稳定的网络访问入口 | 服务发现和负载均衡 |
| ConfigMap | 存储配置数据 | GeoServer 配置文件 |
| Secret | 存储敏感数据 | 数据库密码、API 密钥 |
| PersistentVolume | 持久化存储 | 数据库、瓦片缓存 |
| Ingress | HTTP 路由和负载均衡 | 外部访问入口 |
| HPA | 水平自动扩缩容 | 根据负载自动调整副本数 |

### 7.2.2 架构示意

```
                            Internet
                               │
                               ▼
                    ┌────────────────────┐
                    │      Ingress       │
                    │   (NGINX/Traefik)  │
                    └────────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │   Gateway Service  │
                    │   (ClusterIP)      │
                    └────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ WMS Service │     │ WFS Service │     │ WebUI Svc   │
   └─────────────┘     └─────────────┘     └─────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ WMS Pods    │     │ WFS Pods    │     │ WebUI Pods  │
   │ (replicas:3)│     │ (replicas:2)│     │ (replicas:1)│
   └─────────────┘     └─────────────┘     └─────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌────────────────────┐
                    │  PostgreSQL Svc    │
                    │  (ClusterIP)       │
                    └────────────────────┘
                               │
                    ┌────────────────────┐
                    │  PostgreSQL Pod    │
                    │  + PVC             │
                    └────────────────────┘
```

### 7.2.3 GeoServer Cloud 在 K8s 中的特点

在 Kubernetes 中部署 GeoServer Cloud 时，有一些重要的变化：

**使用 Standalone 配置文件**

不再需要 Eureka 和 Config Server，改用 Kubernetes 原生服务发现：

```yaml
spring:
  profiles:
    active: standalone,pgconfig
    
eureka:
  client:
    enabled: false
```

**使用 K8s Service 进行服务发现**

```yaml
# WMS 服务访问 PostgreSQL
PGCONFIG_HOST: postgresql.geoserver.svc.cluster.local
```

## 7.3 环境准备

### 7.3.1 本地开发环境

**安装 Minikube（单节点测试）**

```bash
# macOS
brew install minikube
minikube start --cpus=4 --memory=8192

# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
minikube start --cpus=4 --memory=8192

# 验证
kubectl get nodes
```

**安装 Kind（Docker 中的 K8s）**

```bash
# 安装 Kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# 创建集群
kind create cluster --name geoserver-cloud

# 验证
kubectl cluster-info
```

### 7.3.2 安装 Helm

```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 验证
helm version
```

### 7.3.3 添加 Helm 仓库

```bash
# 添加 GeoServer Cloud Helm 仓库
helm repo add geoserver-cloud https://camptocamp.github.io/helm-geoserver-cloud
helm repo update

# 搜索可用 chart
helm search repo geoserver-cloud
```

## 7.4 使用 Helm 部署

### 7.4.1 基本部署

```bash
# 创建命名空间
kubectl create namespace geoserver

# 安装 Chart（使用默认值）
helm install gs-cloud geoserver-cloud/geoserver-cloud \
    --namespace geoserver

# 查看部署状态
kubectl get pods -n geoserver -w
```

### 7.4.2 自定义 values.yaml

创建自定义配置文件：

```yaml
# values.yaml - GeoServer Cloud Helm 配置

# 全局配置
global:
  image:
    tag: "3.0.0.0"
    pullPolicy: IfNotPresent
  
  # 管理员账户
  geoserver:
    admin:
      username: admin
      existingSecret: geoserver-admin-secret
      secretKey: password
    
    # 基础路径
    basePath: /geoserver-cloud

# PostgreSQL 配置
postgresql:
  enabled: true
  auth:
    username: geoserver
    database: geoserver
    existingSecret: postgresql-secret
  primary:
    persistence:
      enabled: true
      size: 20Gi
      storageClass: standard

# RabbitMQ 配置
rabbitmq:
  enabled: true
  auth:
    username: geoserver
    existingPasswordSecret: rabbitmq-secret
  persistence:
    enabled: true
    size: 8Gi

# Gateway 服务
gateway:
  enabled: true
  replicaCount: 2
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

# WMS 服务
wms:
  enabled: true
  replicaCount: 3
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

# WFS 服务
wfs:
  enabled: true
  replicaCount: 2
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi

# WCS 服务
wcs:
  enabled: true
  replicaCount: 1
  resources:
    requests:
      cpu: 300m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi

# REST 服务
rest:
  enabled: true
  replicaCount: 1
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 500m
      memory: 1Gi

# WebUI 服务
webui:
  enabled: true
  replicaCount: 1
  resources:
    requests:
      cpu: 300m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi

# GeoWebCache 服务
gwc:
  enabled: true
  replicaCount: 2
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  persistence:
    enabled: true
    size: 50Gi
    storageClass: standard

# Ingress 配置
ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: geoserver.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: geoserver-tls
      hosts:
        - geoserver.example.com
```

### 7.4.3 创建 Secrets

```bash
# 创建管理员密码 Secret
kubectl create secret generic geoserver-admin-secret \
    --namespace geoserver \
    --from-literal=password='your_admin_password'

# 创建 PostgreSQL 密码 Secret
kubectl create secret generic postgresql-secret \
    --namespace geoserver \
    --from-literal=postgres-password='postgres_password' \
    --from-literal=password='geoserver_password'

# 创建 RabbitMQ 密码 Secret
kubectl create secret generic rabbitmq-secret \
    --namespace geoserver \
    --from-literal=rabbitmq-password='rabbitmq_password'
```

### 7.4.4 部署应用

```bash
# 使用自定义 values 部署
helm install gs-cloud geoserver-cloud/geoserver-cloud \
    --namespace geoserver \
    --values values.yaml

# 查看部署状态
kubectl get all -n geoserver

# 等待所有 Pod 就绪
kubectl wait --for=condition=ready pod --all -n geoserver --timeout=600s
```

## 7.5 配置 Ingress

### 7.5.1 安装 NGINX Ingress Controller

```bash
# 使用 Helm 安装
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace
```

### 7.5.2 配置 Ingress 资源

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: geoserver-cloud
  namespace: geoserver
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    # 启用 WebSocket（如果需要）
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    # 重写规则（如果需要）
    # nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
    - host: geoserver.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: gs-cloud-gateway
                port:
                  number: 8080
  tls:
    - hosts:
        - geoserver.example.com
      secretName: geoserver-tls
```

### 7.5.3 配置 TLS 证书

**使用 cert-manager 自动管理证书**

```bash
# 安装 cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 创建 ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

## 7.6 持久化存储配置

### 7.6.1 StorageClass 配置

```yaml
# storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: geoserver-storage
provisioner: kubernetes.io/aws-ebs  # 根据云提供商调整
parameters:
  type: gp3
  fsType: ext4
reclaimPolicy: Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

### 7.6.2 PVC 配置示例

```yaml
# pvc-gwc-cache.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: gwc-cache
  namespace: geoserver
spec:
  accessModes:
    - ReadWriteMany  # 多 Pod 共享需要 RWX
  storageClassName: geoserver-storage
  resources:
    requests:
      storage: 100Gi
```

### 7.6.3 数据库持久化

```yaml
# PostgreSQL StatefulSet 中的存储配置
volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: geoserver-storage
      resources:
        requests:
          storage: 50Gi
```

## 7.7 自动扩缩容（HPA）

### 7.7.1 配置 HPA

```yaml
# hpa-wms.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wms-hpa
  namespace: geoserver
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gs-cloud-wms
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
```

### 7.7.2 基于自定义指标的 HPA

```yaml
# hpa-custom-metrics.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wms-hpa-custom
  namespace: geoserver
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gs-cloud-wms
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
```

### 7.7.3 安装 Metrics Server

```bash
# 安装 Metrics Server（HPA 依赖）
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 验证
kubectl top nodes
kubectl top pods -n geoserver
```

## 7.8 云平台部署

### 7.8.1 AWS EKS 部署

```bash
# 创建 EKS 集群
eksctl create cluster \
    --name geoserver-cloud \
    --region us-west-2 \
    --nodegroup-name standard-workers \
    --node-type m5.xlarge \
    --nodes 3 \
    --nodes-min 1 \
    --nodes-max 10 \
    --managed

# 配置 kubectl
aws eks update-kubeconfig --name geoserver-cloud --region us-west-2

# 安装 AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
    --namespace kube-system \
    --set clusterName=geoserver-cloud

# 部署 GeoServer Cloud
helm install gs-cloud geoserver-cloud/geoserver-cloud \
    --namespace geoserver \
    --values values-aws.yaml
```

**AWS 特定 values**

```yaml
# values-aws.yaml
ingress:
  enabled: true
  className: alb
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:...

postgresql:
  primary:
    persistence:
      storageClass: gp3

gwc:
  persistence:
    storageClass: gp3
```

### 7.8.2 Azure AKS 部署

```bash
# 创建资源组
az group create --name geoserver-rg --location eastus

# 创建 AKS 集群
az aks create \
    --resource-group geoserver-rg \
    --name geoserver-cloud-aks \
    --node-count 3 \
    --node-vm-size Standard_D4s_v3 \
    --enable-addons monitoring \
    --generate-ssh-keys

# 获取凭据
az aks get-credentials --resource-group geoserver-rg --name geoserver-cloud-aks

# 部署
helm install gs-cloud geoserver-cloud/geoserver-cloud \
    --namespace geoserver \
    --values values-azure.yaml
```

### 7.8.3 Google GKE 部署

```bash
# 创建 GKE 集群
gcloud container clusters create geoserver-cloud \
    --region us-central1 \
    --num-nodes 3 \
    --machine-type e2-standard-4 \
    --enable-autoscaling \
    --min-nodes 1 \
    --max-nodes 10

# 获取凭据
gcloud container clusters get-credentials geoserver-cloud --region us-central1

# 部署
helm install gs-cloud geoserver-cloud/geoserver-cloud \
    --namespace geoserver \
    --values values-gcp.yaml
```

## 7.9 运维操作

### 7.9.1 滚动更新

```bash
# 更新镜像版本
helm upgrade gs-cloud geoserver-cloud/geoserver-cloud \
    --namespace geoserver \
    --set global.image.tag=3.0.0.0

# 或修改 values.yaml 后升级
helm upgrade gs-cloud geoserver-cloud/geoserver-cloud \
    --namespace geoserver \
    --values values.yaml
```

### 7.9.2 回滚

```bash
# 查看历史
helm history gs-cloud -n geoserver

# 回滚到上一版本
helm rollback gs-cloud -n geoserver

# 回滚到指定版本
helm rollback gs-cloud 2 -n geoserver
```

### 7.9.3 扩缩容

```bash
# 手动扩展
kubectl scale deployment gs-cloud-wms --replicas=5 -n geoserver

# 查看 HPA 状态
kubectl get hpa -n geoserver

# 查看当前副本数
kubectl get deployment -n geoserver
```

### 7.9.4 日志查看

```bash
# 查看 Pod 日志
kubectl logs -f deployment/gs-cloud-wms -n geoserver

# 查看所有 WMS Pod 日志
kubectl logs -l app=wms -n geoserver --all-containers

# 使用 stern 查看多 Pod 日志
stern wms -n geoserver
```

### 7.9.5 调试

```bash
# 进入 Pod
kubectl exec -it deployment/gs-cloud-wms -n geoserver -- /bin/bash

# 查看 Pod 描述
kubectl describe pod gs-cloud-wms-xxx -n geoserver

# 查看事件
kubectl get events -n geoserver --sort-by='.lastTimestamp'
```

## 7.10 本章小结

本章详细介绍了在 Kubernetes 环境中部署 GeoServer Cloud：

1. **基础概念**：了解了 K8s 核心组件与 GeoServer Cloud 的对应关系。

2. **环境准备**：安装了 Minikube/Kind 本地环境和 Helm。

3. **Helm 部署**：使用 Helm Chart 完成了 GeoServer Cloud 的部署。

4. **Ingress 配置**：配置了外部访问和 TLS 证书。

5. **持久化存储**：配置了 PVC 和 StorageClass。

6. **自动扩缩容**：使用 HPA 实现了自动扩缩容。

7. **云平台部署**：在 AWS、Azure、GCP 上的部署实践。

8. **运维操作**：滚动更新、回滚、日志和调试。

在下一章中，我们将学习 GeoServer Cloud 的运维监控和故障排除。

## 7.11 思考题

1. Kubernetes 原生服务发现与 Eureka 相比有什么优势？

2. 如何设计一个跨可用区的高可用 GeoServer Cloud 部署？

3. HPA 的扩缩容行为配置（behavior）有什么作用？如何优化？

4. 在生产环境中，应该如何管理 Kubernetes Secrets？

5. 如何实现 GeoServer Cloud 的蓝绿部署或金丝雀发布？

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-cloud/第06章-Docker-Compose部署实战/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-cloud/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-cloud/第08章-运维监控与故障排除/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
