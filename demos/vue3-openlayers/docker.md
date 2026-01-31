# 基础软件环境安装

## 安装docker desktop

## 安装postgis

```bash

docker pull postgis/postgis

docker run -d -p 5432:5432 --name postgis -e POSTGRES_PASSWORD=postgres -e PGDATA=/var/lib/postgresql/data/pgdata -v //d/docker/data/postgis:/var/lib/postgresql/data postgis/postgis

```

## 安装geoserver

```bash

docker pull kartoza/geoserver
# 初次运行
docker run -d -p 8765:8080 --name geoserver --link postgis:postgis -e SAMPLE_DATA=true -e GEOSERVER_ADMIN_PASSWORD=geoserver -e GEOSERVER_DATA_DIR=/data/geoserver/data_dir -e GEOWEBCACHE_CACHE_DIR=/data/geoserver/data_dir/gwc -v //d/docker/data/geoserver:/data/geoserver/data_dir -v //d/docker/data/geoserver/gwc:/data/geoserver/data_dir/gwc kartoza/geoserver
# 再次运行
docker run -d -p 8765:8080 --name geoserver --link postgis:postgis -e GEOSERVER_ADMIN_PASSWORD=geoserver -e GEOSERVER_DATA_DIR=/data/geoserver/data_dir -e GEOWEBCACHE_CACHE_DIR=/data/geoserver/data_dir/gwc -v //d/docker/data/geoserver:/data/geoserver/data_dir -v //d/docker/data/geoserver/gwc:/data/geoserver/data_dir/gwc kartoza/geoserver

```

## 安装nginx

```bash

docker pull nginx

docker run --rm --entrypoint=cat nginx /etc/nginx/nginx.conf

docker run --name nginx -v //d/docker/data/nginx/nginx.conf:/etc/nginx/nginx.conf:ro -d -p 8080:80 nginx

```

## 样例数据

[POI数据](https://www.poi86.com/)
