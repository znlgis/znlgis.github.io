---
layout: default
title: PostGIS数据库操作简介
---

# PostGIS数据库操作简介

## PostGIS Docker安装

```Bash
docker pull postgis/postgis
docker run --name postgis -e POSTGRES_PASSWORD=123456 -d -p 5432:5432 postgis/postgis
```

## PostGIS数据库连接

### DataGrip

### Navicat

### pgAdmin4

### QGIS

### HeidiSQL

### DBeaver

## PostGIS数据库操作

**空间查询**：PostGIS提供了一系列的空间函数，可以进行复杂的空间查询。例如，你可以使用ST_Contains函数来查询一个几何体是否包含另一个几何体。

```sql
SELECT * FROM table1 WHERE ST_Contains(geom1, geom2);
```

**空间分析**：PostGIS也提供了一系列的空间分析函数。例如，你可以使用ST_Distance函数来计算两个几何体之间的最短距离。

```sql
SELECT ST_Distance(geom1::geography, geom2::geography) AS distance FROM table1;
```

**空间索引**：为了提高空间查询的性能，你可以在地理数据列上创建空间索引。

```sql
CREATE INDEX table1_geom_gist ON table1 USING gist(geom);
```

**地理数据导入和导出**：PostGIS提供了一些工具来导入和导出地理数据。例如，你可以使用shp2pgsql工具来将Shapefile导入到PostGIS数据库，或者使用pgsql2shp工具来将PostGIS数据库中的数据导出为Shapefile。

**地理数据类型转换**：PostGIS支持多种地理数据类型，并提供了一些函数来进行数据类型的转换。例如，你可以使用ST_AsText函数来将几何体转换为WKT（Well-Known Text）格式。

```sql
SELECT ST_AsText(geom) FROM table1;
```

## PostGIS的分布式方案

PostGIS本身并不直接支持分布式数据库，但是可以通过PostgreSQL的一些扩展和工具来实现分布式解决方案。以下是一些可能的选项：

1. **PostgreSQL Foreign Data Wrappers (FDW)**：FDW允许PostgreSQL数据库访问和管理其他PostgreSQL数据库中的数据，就像它们是本地表一样。这可以用来实现一种简单的分布式解决方案，但是它可能不适合处理大规模的数据。

2. **PostgreSQL Partitioning**：PostgreSQL支持表分区，这可以用来将大表分割成小表，提高查询性能。虽然这不是真正的分布式解决方案，但是它可以用来处理大规模的数据。

3. **Citus**：Citus是一个开源的PostgreSQL扩展，它可以将PostgreSQL数据库转变为分布式数据库。Citus支持分布式表，可以将大表分割成小表，并将它们分布在多个节点上。Citus也支持分布式查询和分布式事务，这使得它可以处理大规模的数据。

4. **Postgres-XL**：Postgres-XL是一个开源的PostgreSQL扩展，它提供了一种分布式解决方案，可以处理大规模的数据。Postgres-XL支持分布式表，分布式查询和分布式事务。

请注意，这些解决方案可能需要额外的配置和管理，而且可能会影响PostGIS的性能和功能。在选择分布式解决方案时，你应该根据你的具体需求和应用场景，考虑上述因素，选择最适合你的解决方案。

## PostGIS相关扩展

1. **postgis_sfcgal**：这是一个提供对SFCGAL库访问的扩展，SFCGAL是一个围绕CGAL（计算几何算法库）的C++包装库，提供了如3D交集、3D差集、3D并集、3D面积、3D体积等高级3D操作。

2. **postgis_topology**：这个扩展提供了对拓扑数据模型的支持。拓扑数据模型是一种描述地理对象之间空间关系的数据模型，它可以用来表示和查询地理对象之间的连接性和相邻性。

3. **postgis_tiger_geocoder**：这个扩展提供了对美国TIGER/Line地理编码服务的支持。地理编码是一种将地理名称（如街道地址）转换为地理坐标（如经度和纬度）的过程。

4. **postgis_raster**：这个扩展提供了对栅格数据的支持。栅格数据是一种由像素组成的地理数据，常用于表示地形、气候、土壤类型等连续变化的地理现象。

5. **pgrouting**：由 pgRouting 项目提供的独立扩展（并非 PostGIS 自带），支持网络分析与路由计算，如最短路径、旅行时间等，可用于道路、河流、电力线等网络结构。

6. **pointcloud**：点云扩展（同样独立于 PostGIS 发布，无 postgis_ 前缀），提供对点云数据的支持。点云数据由大量地理坐标点组成，常用于表示和查询三维地形、建筑物、植被等。

7. **hstore**：PostgreSQL 附带的键值对扩展（无 postgis_ 前缀），提供对存储键值对的支持，对存储半结构化数据非常有用。

8. **osm2pgsql**：这不是 PostGIS 扩展，而是把 OpenStreetMap 数据导入 PostgreSQL/PostGIS 的独立工具，并不存在 postgis_osm 扩展。

9. **postgis_fdw**：这个扩展提供了对远程PostGIS服务器的外部数据包装器，允许你查询远程PostGIS数据库，就像它们是本地表一样。

10. **GiST 索引**：PostGIS 的 GiST（通用搜索树）索引能力内置于 postgis 扩展中，建索引时直接使用即可，不存在单独的 postgis_gist 扩展。

11. **geohash 函数**：geohash 的编码和解码（ST_GeoHash 等）内置于 PostGIS 核心函数中，无需单独扩展，也不存在 postgis_geohash 扩展。

12. **fuzzystrmatch**：PostgreSQL 附带的扩展（无 postgis_ 前缀），提供确定字符串之间的相似性和距离的功能。

13. **address_standardizer**：PostGIS 附带的扩展（无 postgis_ 前缀），用于将给定的地址解析为标准格式，可配合 address_standardizer_data_us 使用。

> 注：以上扩展名以官方发布为准，安装时用 `CREATE EXTENSION <扩展名>` 启用。

## 默认建图层SQL

```SQL

create table test_layer
(
    fid           serial primary key,
    shape         public.geometry(MultiPolygon, 4490),
    test          varchar
);

create index spatial_test_layer_shape on test_layer using gist (shape);

comment on table test_layer is '测试图层';
comment on column test_layer.fid is '要素ID';
comment on column test_layer.shape is '图形';
comment on column test_layer.test is '测试字段';

```

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/basic/data/FileGDB代码示例/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/basic/data/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/basic/data/PostGIS代码操作简介/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
