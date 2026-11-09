---
layout: default
title: 在Ubuntu WSL2里配置GDAL Docker环境
---

# 在Ubuntu WSL2里配置GDAL Docker环境

在 Windows 上做 GDAL 开发，一种省事的组合是 WSL2 里跑 Ubuntu，再用 Docker 起一个带 GDAL 的容器。Python 脚本、命令行工具都在容器里执行，宿主机不用装 GDAL 的一堆本地库；数据目录通过挂载映射进去，改完文件立刻生效。

这条路要依次解决四件事：让 WSL2 支持 systemd（Docker 服务依赖它）、把 apt 源换成国内镜像（否则装包很慢）、安装 Docker 并配国内加速、最后写一个固定版本的 GDAL Dockerfile。下面按顺序来。

开始前确认 WSL2 已经装好并能进入 Ubuntu。`wsl --list --verbose` 能看到发行版和版本号，VERSION 列是 2 才符合本文的前提。


## 启用systemd

较新的 WSL2 默认由 init 直接拉起进程，systemd 不启用。Docker 的官方安装包依赖 systemd 管理服务，不开启的话 `systemctl start docker` 会直接报 “System has not been booted with systemd”。

做法是往 `/etc/wsl.conf` 写一段启动配置，然后在 PowerShell 里执行 `wsl --shutdown` 让整个 WSL 实例重启——只重启当前终端不算，配置在实例启动时才会读取。重启后执行 `ps --no-headers -o comm 1`，输出 `systemd` 就说明生效了。


```bash
# Ubuntu中执行
echo -e "[boot]\nsystemd=true" | sudo tee -a /etc/wsl.conf

# PowerShell中执行
wsl --shutdown

# Ubuntu中执行
ps --no-headers -o comm 1

```

## 配置Ubuntu国内源

Ubuntu 默认的 `archive.ubuntu.com` 在国内访问不稳定。把 `/etc/apt/sources.list` 换成国内镜像能明显加快 `apt-get update` 和安装速度。

文中给的[科大源](https://mirrors.ustc.edu.cn/repogen/)页面可以按发行版和 Ubuntu 版本生成对应的源列表，直接复制就行，不用手写。注意 Ubuntu 24.04 起源文件格式改成了 deb822 的 `.sources` 文件，老教程里的 `sources.list` 写法在新版本上会被忽略，换源后先跑 `apt-get update` 看有没有报错。

替换前建议备份原文件：`sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak`。改坏了还能还原。


[科大源](https://mirrors.ustc.edu.cn/repogen/)

```bash
sudo rm -rf /etc/apt/sources.list
sudo vim /etc/apt/sources.list
```

## 安装Docker

下面这段命令是 Docker 官方文档（Ubuntu 版）的流程，差别只是把下载源指向了科大镜像。逐段看：

- `ca-certificates curl` 是后续下载 GPG 密钥和仓库索引的基础工具，很多精简镜像里没有预装。
- `/etc/apt/keyrings/docker.asc` 是 Docker 仓库的签名公钥。放进 `keyrings` 目录而不是老的 `trusted.gpg.d`，是官方近年推荐的隔离做法。
- 写进 `sources.list.d/docker.list` 的那行仓库地址里，`$(dpkg --print-architecture)` 会展开成 `amd64` 或 `arm64`，`$(. /etc/os-release && echo "$VERSION_CODENAME")` 展开成 `jammy`、`noble` 之类的发行版代号。这两处不要手写死，换机器容易错。
- 一次装四个包：`docker-ce` 是引擎，`docker-ce-cli` 是命令行客户端，`containerd.io` 是底层容器运行时，两个插件分别提供 buildx 和 compose v2。

`docker run hello-world` 拉不到镜像通常是网络问题，不是安装失败。先确认下面的镜像加速配置生效，再重试。

最后一步 `usermod -aG docker your-user` 把当前用户加进 docker 组。改完要重新登录（或重启 WSL 实例）才生效。不加组的话，所有 docker 命令都得加 `sudo`。


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

Docker Hub 的镜像在国外，拉取经常超时。在 `/etc/docker/daemon.json` 里配置 `registry-mirrors` 后，Docker 会优先走这些地址。

写完后执行 `sudo systemctl daemon-reload && sudo systemctl restart docker` 让配置生效，再用 `docker info | grep -A2 "Registry Mirrors"` 确认镜像地址已加载。

公共加速器不太稳定，失效是常态。文中那句话是认真的：地址不能用时换一家，别去折腾各种“永久免费”的第三方镜像站。企业环境更稳的做法是自己搭 registry 或走云厂商的容器镜像服务。


```bash
sudo vim /etc/docker/daemon.json

{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}

```

> 说明：公共加速器的可用性会随时间变化，若上述地址失效，请自行查找仍可用的 Docker Hub 加速器。

## GDAL Dockerfile

Dockerfile 本身很短，但每个决定都有原因：

- 基础镜像用 `ghcr.io/osgeo/gdal` 的 `ubuntu-full` 变体。`full` 版把 Proj、GEOS、各种栅格/矢量驱动都编译进去了，体积大（1GB 以上），但不用自己解决依赖；`small` 版则适合只需要基础读写的场景。
- 标签固定到具体版本（示例是 `3.13.3`），不要用 `latest`。GDAL 的小版本升级偶尔会改驱动行为和默认选项，教程里的命令在版本漂移后可能跑出不同结果。
- 通过南京大学的 ghcr 代理拉取，是为了绕开 ghcr.io 在国内的访问问题。能直连的环境把前缀去掉即可。
- `LANG` 和 `LC_ALL` 设成 `C.UTF-8` 解决容器内中文路径和中文输出的乱码问题。容器默认的 POSIX locale 不支持多字节字符，Python 里打印中文会直接抛 `UnicodeEncodeError`。
- 时区换成上海，避免日志时间和业务数据里的日期对不上。这两行在 `ubuntu` 基础镜像里需要 root 权限，Dockerfile 默认就是 root，所以不用额外加 `USER`。

### 构建与使用

在这个 Dockerfile 所在目录执行：

```bash
docker build -t gdal:3.13.3 .
docker run --rm -v /mnt/d/gisdata:/data gdal:3.13.3 gdalinfo /data/sample.tif
```

挂载路径两边都是 Linux 写法。WSL2 里访问 Windows 盘符用 `/mnt/d/...`，容器内再映射到 `/data`。这样 Windows 上用 QGIS 看过的数据，容器里可以直接读，不用来回拷贝。

需要反复进入容器调试时，用 `docker run --rm -it -v /mnt/d/gisdata:/data gdal:3.13.3 bash`，进去后 `gdalinfo`、`ogr2ogr`、`python3` 都能直接用。

### 常见问题

- `System has not been booted with systemd`：`/etc/wsl.conf` 没写或没执行 `wsl --shutdown`。
- apt 更新卡住或 404：换源时 Ubuntu 版本代号写错，或用了 deb822 新格式却还在改 `sources.list`。
- 拉镜像超时：镜像加速地址失效，换一个或直接 `docker pull` 官方地址试试。
- 容器里中文乱码：Dockerfile 里的 `LANG`/`LC_ALL` 没生效，或运行时被 `-e LANG=...` 覆盖了。
- 挂载目录读不到：Windows 路径没按 `/mnt/<盘符>/` 写，或 Docker Desktop 没开启对应的文件共享。


```Dockerfile
# GDAL官方镜像为基础，不要用 latest 标签，用固定的稳定版本标签，FULL 版本兼容性最好但体积最大
# 通过南京大学的 ghcr 代理拉取镜像 https://ghcr.nju.edu.cn
FROM ghcr.nju.edu.cn/osgeo/gdal:ubuntu-full-3.13.3
# 设置中文编码
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
# 设置时区为上海
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo 'Asia/Shanghai' >/etc/timezone
```

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/basic/env/Windows下的GDAL环境配置/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/basic/env/" class="chapter-nav__dir">目录</a>
</div>

<!-- /NAVIGATION -->
