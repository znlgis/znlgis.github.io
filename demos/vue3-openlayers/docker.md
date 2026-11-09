---
layout: default
title: 基础软件环境安装
---

# 基础软件环境安装

这个演示项目依赖四样东西：Docker Desktop 提供容器环境，PostGIS 存空间数据，GeoServer 发布地图服务，Nginx 做静态资源托管。四者都用容器跑，宿主机不用装数据库和 Java 环境。

下面的命令假定数据目录放在 Windows 的 `D:\docker\data` 下，并通过 WSL 路径 `//d/docker/data` 挂载进容器。路径写法是 Git Bash/WSL 的形式，在 PowerShell 里执行时改成 `-v D:/docker/data/postgis:/var/lib/postgresql/data`。

端口分配：PostGIS 用 5432，GeoServer 映射到 8765（避开容器内 8080 常用端口），Nginx 映射到 8080。如果本机端口被占用，改冒号左边的数字即可。


## 安装docker desktop

从 Docker 官网下载 Docker Desktop 安装包，安装时保持默认的 WSL 2 后端选项。装完在设置里确认 “Use the WSL 2 based engine” 已勾选，并在 “Resources → File sharing” 里把数据目录所在盘符加进共享列表，否则挂载会失败。

安装完成后打开终端执行 `docker version`，能看到 Client 和 Server 两段输出才算正常。只有 Client 段说明 Docker 守护进程没启动，先启动 Docker Desktop 再试。

国内网络下拉镜像慢，可以在 Docker Desktop 的 Settings → Docker Engine 里加 `registry-mirrors`。具体配置见 [在Ubuntu WSL2里配置GDAL Docker环境](https://znlgis.github.io/gis/basic/env/在Ubuntu%20WSL2里配置GDAL%20Docker环境/)，思路是一样的。


## 安装postgis

PostGIS 是 PostgreSQL 的空间扩展，`postgis/postgis` 镜像已经把扩展装好，启动即用。

`docker run` 的几个参数：`-d` 后台运行，`-p 5432:5432` 把容器端口映射到宿主机，`--name postgis` 给容器起固定名字，后面 GeoServer 用 `--link` 连接它。`POSTGRES_PASSWORD` 是初始密码，例子用 `postgres` 只是演示，实际环境要换成强密码。

`PGDATA=/var/lib/postgresql/data/pgdata` 指定数据目录的子路径。PostgreSQL 官方镜像要求数据目录为空或只含丢失标记，把 PG 数据放在 `pgdata` 子目录里，挂载点根下即使有别的文件也不会启动失败。

启动后用 `docker logs postgis` 看日志，出现 `database system is ready to accept connections` 表示就绪。再用数据库客户端连 `localhost:5432`，库名 `postgres`、用户 `postgres`，建库后执行 `CREATE EXTENSION postgis;` 验证扩展可用。

数据是否需要持久化取决于用途。示例挂了 `-v //d/docker/data/postgis:...`，容器删了数据还在；不挂卷的话，`docker rm` 之后数据全丢。


```bash

docker pull postgis/postgis

docker run -d -p 5432:5432 --name postgis -e POSTGRES_PASSWORD=postgres -e PGDATA=/var/lib/postgresql/data/pgdata -v //d/docker/data/postgis:/var/lib/postgresql/data postgis/postgis

```

## 安装geoserver

`kartoza/geoserver` 是社区维护的 GeoServer 镜像，内置 Tomcat 和常用扩展。命令里几个环境变量的作用：

- `SAMPLE_DATA=true` 首次启动时安装示例数据。示例数据能省去自己找数据的麻烦，但会拖慢启动，正式环境可以设为 `false`。
- `GEOSERVER_ADMIN_PASSWORD` 设置管理员密码，默认用户名是 `admin`。
- `GEOSERVER_DATA_DIR` 指定数据目录，挂载出来以后配置、样式、发布的服务都不会随容器重建丢失。
- `GEOWEBCACHE_CACHE_DIR` 是瓦片缓存目录，单独挂载，清缓存时直接删目录内容，不影响其他配置。

`--link postgis:postgis` 让 GeoServer 容器通过网络别名访问 PostGIS。这是 Docker 早期的容器互联方式，在同一个自定义网络里用容器名也能互通，`--link` 主要是为了兼容老命令，新项目建议 `docker network create` 之后用 `--network`。

第一次运行和再次运行的区别在 `SAMPLE_DATA`：第一次装完示例数据后，数据目录里已经有了，后续启动再带这个参数会重复初始化或覆盖，所以第二次开始去掉它。容器创建后参数就固定了，要改参数得 `docker rm` 掉重建，数据目录挂载着，重建不会丢配置。

启动完成后访问 `http://localhost:8765/geoserver`，用 `admin` 和上面设的密码登录。能看到欢迎页和示例图层，环境就通了。


```bash

docker pull kartoza/geoserver
# 初次运行
docker run -d -p 8765:8080 --name geoserver --link postgis:postgis -e SAMPLE_DATA=true -e GEOSERVER_ADMIN_PASSWORD=geoserver -e GEOSERVER_DATA_DIR=/data/geoserver/data_dir -e GEOWEBCACHE_CACHE_DIR=/data/geoserver/data_dir/gwc -v //d/docker/data/geoserver:/data/geoserver/data_dir -v //d/docker/data/geoserver/gwc:/data/geoserver/data_dir/gwc kartoza/geoserver
# 再次运行
docker run -d -p 8765:8080 --name geoserver --link postgis:postgis -e GEOSERVER_ADMIN_PASSWORD=geoserver -e GEOSERVER_DATA_DIR=/data/geoserver/data_dir -e GEOWEBCACHE_CACHE_DIR=/data/geoserver/data_dir/gwc -v //d/docker/data/geoserver:/data/geoserver/data_dir -v //d/docker/data/geoserver/gwc:/data/geoserver/data_dir/gwc kartoza/geoserver

```

## 安装nginx

Nginx 在这个项目里负责托管前端打包后的静态文件，同时可以把 `/geoserver` 的请求反向代理到 GeoServer，避免浏览器跨域。

`docker run --rm --entrypoint=cat nginx /etc/nginx/nginx.conf` 的作用是把镜像里默认的配置打印出来，方便对照着改。先拿到一份能用的配置，再往里加自己的 `server` 块，比从零手写好排查。

启动命令把宿主机上的 `nginx.conf` 只读挂载进容器（`:ro`），改配置后执行 `docker exec nginx nginx -s reload` 重载即可，不用重启容器。端口映射 `-p 8080:80` 让浏览器通过 8080 访问。

配置里至少要有两段：`location / { root ...; try_files $uri $uri/ /index.html; }` 处理单页应用的路由回退，`location /geoserver/ { proxy_pass http://geoserver:8080/geoserver/; }` 把服务请求转给 GeoServer。代理时注意 `proxy_set_header Host $host;`，否则 GeoServer 生成的 WMS 能力文档里的地址会是容器内部地址。


```bash

docker pull nginx

docker run --rm --entrypoint=cat nginx /etc/nginx/nginx.conf

docker run --name nginx -v //d/docker/data/nginx/nginx.conf:/etc/nginx/nginx.conf:ro -d -p 8080:80 nginx

```

## 样例数据

示例用的 POI 数据来自 [poi86](https://www.poi86.com/)，下载后一般是 CSV 或 Excel。导入 PostGIS 之前先确认坐标系：POI 通常是 WGS84 经纬度（EPSG:4326），导入时字段类型选对，经度用 `numeric` 或 `double precision`，不要用整数。

导入后建空间索引：`CREATE INDEX idx_poi_geom ON poi USING GIST (geom);`。没有索引时，按范围查询几十万条数据会明显变慢。

在 GeoServer 里发布图层时，边界框由数据自动计算，样式先用默认点样式验证服务通不通，再换成自定义 SLD。如果地图上点位偏移，八九成是坐标系配错了，去检查数据源的 SRS 设置。

## 常用运维命令

```bash
# 查看运行中的容器
docker ps

# 查看某个容器日志
docker logs -f geoserver

# 停止并删除容器（数据卷保留）
docker rm -f geoserver

# 进入容器排查
docker exec -it geoserver bash
```

排查顺序建议是：先 `docker ps` 确认容器都在运行，再按服务逐个看日志，最后才查配置。容器反复重启时，日志里通常直接给出了原因，比如端口占用、挂载路径不存在、环境变量缺失。


[POI数据](https://www.poi86.com/)

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/demos/vue3-openlayers/functional-requirement/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/demos/vue3-openlayers/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/demos/vue3-openlayers/demo/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->
