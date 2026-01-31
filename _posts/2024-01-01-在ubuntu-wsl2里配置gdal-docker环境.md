---
layout: post
title: "在Ubuntu WSL2里配置GDAL Docker环境"
date: 2024-01-01 10:00:00 +0800
categories: [GIS, 环境配置]
tags: [环境配置]
---

# 在Ubuntu WSL2里配置GDAL Docker环境

## 启用systemd

```bash
# Ubuntu中执行
echo -e "[boot]\nsystemd=true" | sudo tee -a /etc/wsl.conf

# PowerShell中执行
wsl --shutdown

# Ubuntu中执行
ps --no-headers -o comm 1

```

## 配置Ubuntu国内源

[科大源](https://mirrors.ustc.edu.cn/repogen/)

```bash
sudo rm -rf /etc/apt/sources.list
sudo vim /etc/apt/sources.list
```

## 安装Docker

```bash
# 添加密钥
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 添加源
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://mirrors.ustc.edu.cn/docker-ce/linux/ubuntu/ \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# 安装
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 测试
sudo docker run hello-world

# 添加用户到docker组
sudo usermod -aG docker your-user
```

## 配置docker国内源

```bash
sudo vim /etc/docker/daemon.json

{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://ghcr.nju.edu.cn"
  ]
}

```

## GDAL Dockerfile

```Dockerfile
# GDAL官方镜像为基础，不要用最新的镜像，因为最新的镜像可能会有问题，用官网最新稳定版本即可，FULL版本的兼容性最好但体积最大
# 需要配置国内源 https://ghcr.nju.edu.cn
FROM ghcr.nju.edu.cn/osgeo/gdal:ubuntu-full-3.8.5
# 设置中文编码
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
# 设置时区为上海
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo 'Asia/Shanghai' >/etc/timezone
```
