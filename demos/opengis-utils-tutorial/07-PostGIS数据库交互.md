# PostGIS数据库交互

## 概述

PostGIS是PostgreSQL数据库的空间扩展，提供了强大的空间数据存储、查询和分析功能，是企业级GIS应用的首选数据库方案。本章介绍如何使用OGU4J与PostGIS进行交互。

## 数据库连接

### 连接参数配置

```java
/**
 * 数据库连接参数
 */
DbConnBaseModel dbConn = new DbConnBaseModel();
dbConn.setDbtype("postgis");
dbConn.setHost("localhost");
dbConn.setPort("5432");
dbConn.setDatabase("gisdb");
dbConn.setSchema("public");
dbConn.setUser("postgres");
dbConn.setPasswd("password");
```

### 连接参数模型

```java
@Data
public class DbConnBaseModel implements Serializable {
    private String dbtype = "postgis";  // 数据库类型
    private String host;                 // 主机地址
    private Integer port;                // 端口号
    private String schema;               // 模式名
    private String database;             // 数据库名
    private String user;                 // 用户名
    private String passwd;               // 密码
}
```

## 数据读取

### 基本读取

```java
/**
 * 从PostGIS读取图层
 */
OguLayer layer = SimpleLayerConverter.fromPostGIS(
    dbConn,                   // 数据库连接
    "parcels",                // 表名
    null,                     // 属性过滤条件
    null,                     // 空间过滤条件
    GisEngineType.GEOTOOLS    // 使用的引擎
);

// 使用图层数据
System.out.println("要素数量: " + layer.getFeatures().size());
```

### 带过滤条件读取

```java
// 属性过滤
OguLayer filtered = SimpleLayerConverter.fromPostGIS(
    dbConn,
    "parcels",
    "area > 1000 AND type = '住宅'",  // SQL WHERE条件
    null,
    GisEngineType.GEOTOOLS
);

// 空间过滤
String boundaryWkt = "POLYGON((116 39, 117 39, 117 40, 116 40, 116 39))";
OguLayer spatial = SimpleLayerConverter.fromPostGIS(
    dbConn,
    "parcels",
    null,
    boundaryWkt,  // 空间过滤范围
    GisEngineType.GEOTOOLS
);

// 组合过滤
OguLayer combined = SimpleLayerConverter.fromPostGIS(
    dbConn,
    "parcels",
    "type = '住宅'",
    boundaryWkt,
    GisEngineType.GEOTOOLS
);
```

### 使用GDAL引擎读取

```java
OguLayer layer = SimpleLayerConverter.fromPostGIS(
    dbConn,
    "parcels",
    null,
    null,
    GisEngineType.GDAL  // 使用GDAL引擎
);
```

## 数据写入

### 基本写入

```java
/**
 * 将OguLayer写入PostGIS
 */
SimpleLayerConverter.toPostGIS(
    layer,                    // 图层数据
    dbConn,                   // 数据库连接
    "result_table",           // 目标表名
    GisEngineType.GEOTOOLS    // 使用的引擎
);
```

### 批量写入优化

OGU4J内置了批量写入优化，使用多线程分批写入：

```java
// 内部实现的批量写入逻辑
int batchSize = 1000;
ExecutorService executor = ThreadUtil.newExecutor(
    Runtime.getRuntime().availableProcessors());

// 分批处理
List<List<OguFeature>> batches = Lists.partition(features, batchSize);
for (List<OguFeature> batch : batches) {
    executor.submit(() -> writeBatch(dbConn, tableName, batch));
}

executor.shutdown();
executor.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
```

## 数据删除

```java
/**
 * 删除PostGIS中的要素
 * @param whereClause 删除条件，null表示删除所有
 */
int deleted = PostgisUtil.deletePostgisFeatures(
    dbConn, 
    "table_name", 
    "type = '临时'"  // WHERE条件
);
System.out.println("删除了 " + deleted + " 条记录");

// 清空整个表
PostgisUtil.deletePostgisFeatures(dbConn, "table_name", null);
```

## 实践案例

### 案例1：Shapefile导入PostGIS

```java
/**
 * 将Shapefile导入PostGIS
 */
public void importShpToPostGIS(String shpPath, DbConnBaseModel dbConn, 
        String tableName) {
    // 读取Shapefile
    OguLayer layer = SimpleLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 写入PostGIS
    SimpleLayerConverter.toPostGIS(layer, dbConn, tableName, GisEngineType.GEOTOOLS);
    
    System.out.println("导入完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

### 案例2：PostGIS导出Shapefile

```java
/**
 * 从PostGIS导出Shapefile
 */
public void exportToShp(DbConnBaseModel dbConn, String tableName,
        String outputPath, String whereClause) {
    // 读取PostGIS
    OguLayer layer = SimpleLayerConverter.fromPostGIS(
        dbConn, tableName, whereClause, null, GisEngineType.GEOTOOLS);
    
    // 写入Shapefile
    SimpleLayerConverter.toShapefile(layer, outputPath, GisEngineType.GEOTOOLS);
    
    System.out.println("导出完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

### 案例3：空间查询

```java
/**
 * 空间查询：找出指定区域内的要素
 */
public List<OguFeature> spatialQuery(DbConnBaseModel dbConn,
        String tableName, String boundaryWkt) {
    // 使用空间过滤读取
    OguLayer layer = SimpleLayerConverter.fromPostGIS(
        dbConn, tableName, null, boundaryWkt, GisEngineType.GEOTOOLS);
    
    return layer.getFeatures();
}
```

### 案例4：增量更新

```java
/**
 * 增量更新PostGIS数据
 */
public void incrementalUpdate(DbConnBaseModel dbConn, String tableName,
        OguLayer newData, String keyField) {
    // 获取新数据的Key列表
    Set<String> newKeys = newData.getFeatures().stream()
        .map(f -> f.getAttribute(keyField).getStringValue())
        .filter(Objects::nonNull)
        .collect(Collectors.toSet());
    
    if (newKeys.isEmpty()) {
        System.out.println("没有需要更新的数据");
        return;
    }
    
    // 删除旧数据
    String whereClause = keyField + " IN ('" + String.join("','", newKeys) + "')";
    int deleted = PostgisUtil.deletePostgisFeatures(dbConn, tableName, whereClause);
    System.out.println("删除旧数据 " + deleted + " 条");
    
    // 写入新数据
    SimpleLayerConverter.toPostGIS(newData, dbConn, tableName, GisEngineType.GEOTOOLS);
    System.out.println("写入新数据 " + newData.getFeatures().size() + " 条");
}
```

### 案例5：数据同步

```java
/**
 * 同步两个PostGIS表的数据
 */
public void syncTables(DbConnBaseModel sourceDb, String sourceTable,
        DbConnBaseModel targetDb, String targetTable, String whereClause) {
    // 读取源数据
    OguLayer layer = SimpleLayerConverter.fromPostGIS(
        sourceDb, sourceTable, whereClause, null, GisEngineType.GEOTOOLS);
    
    // 清空目标表
    PostgisUtil.deletePostgisFeatures(targetDb, targetTable, null);
    
    // 写入目标表
    SimpleLayerConverter.toPostGIS(layer, targetDb, targetTable, GisEngineType.GEOTOOLS);
    
    System.out.println("同步完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

### 案例6：坐标转换后入库

```java
/**
 * 坐标转换后写入PostGIS
 */
public void transformAndImport(String shpPath, DbConnBaseModel dbConn,
        String tableName, int targetWkid) {
    // 读取Shapefile
    OguLayer layer = SimpleLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 坐标转换
    if (layer.getWkid() != targetWkid) {
        layer = CrsUtil.reproject(layer, targetWkid);
    }
    
    // 写入PostGIS
    SimpleLayerConverter.toPostGIS(layer, dbConn, tableName, GisEngineType.GEOTOOLS);
}
```

### 案例7：分页读取

```java
/**
 * 分页读取大表数据
 */
public void processLargeTable(DbConnBaseModel dbConn, String tableName,
        int pageSize, Consumer<OguLayer> processor) {
    int offset = 0;
    boolean hasMore = true;
    
    while (hasMore) {
        // 构建分页查询条件
        String sql = String.format("1=1 ORDER BY id LIMIT %d OFFSET %d", 
            pageSize, offset);
        
        OguLayer layer = SimpleLayerConverter.fromPostGIS(
            dbConn, tableName, sql, null, GisEngineType.GEOTOOLS);
        
        if (layer.getFeatures().isEmpty()) {
            hasMore = false;
        } else {
            // 处理当前页数据
            processor.accept(layer);
            offset += pageSize;
            
            System.out.println("已处理 " + offset + " 条记录");
        }
    }
}

// 使用示例
processLargeTable(dbConn, "large_table", 10000, layer -> {
    for (OguFeature feature : layer.getFeatures()) {
        // 处理每个要素
    }
});
```

## PostGIS SQL示例

虽然OGU4J主要使用Java API，但了解PostGIS SQL也很有帮助：

### 空间查询

```sql
-- 点在面内查询
SELECT * FROM parcels 
WHERE ST_Contains(shape, ST_GeomFromText('POINT(116.397 39.908)', 4490));

-- 缓冲区查询
SELECT * FROM points 
WHERE ST_DWithin(shape, ST_GeomFromText('POINT(116.397 39.908)', 4490), 0.01);

-- 相交查询
SELECT * FROM buildings 
WHERE ST_Intersects(shape, ST_GeomFromText('POLYGON(...)', 4490));
```

### 空间计算

```sql
-- 计算面积
SELECT id, ST_Area(shape) as area FROM parcels;

-- 计算缓冲区
SELECT id, ST_Buffer(shape, 100) as buffer FROM roads;

-- 计算交集
SELECT a.id, ST_Intersection(a.shape, b.shape) as intersection
FROM layer_a a, layer_b b
WHERE ST_Intersects(a.shape, b.shape);
```

### 坐标转换

```sql
-- 坐标转换
SELECT id, ST_Transform(shape, 4526) as shape_proj FROM parcels;
```

## 性能优化

### 1. 空间索引

确保表有空间索引：

```sql
CREATE INDEX idx_parcels_shape ON parcels USING GIST(shape);
```

### 2. 批量写入

OGU4J默认使用批量写入，每批1000条，多线程处理。

### 3. 使用PreparedStatement

GeoTools连接参数中启用：

```java
// OGU4J内部自动启用
params.put("preparedStatements", true);
```

### 4. 合理使用过滤

优先使用数据库端过滤：

```java
// 推荐：使用过滤条件
OguLayer layer = SimpleLayerConverter.fromPostGIS(
    dbConn, tableName, "type = 'residential'", boundaryWkt, ...);

// 不推荐：读取所有后在内存中过滤
OguLayer layer = SimpleLayerConverter.fromPostGIS(
    dbConn, tableName, null, null, ...);
layer.filter(f -> "residential".equals(f.getValue("type")));
```

## 小结

本章介绍了PostGIS数据库交互的核心内容：

1. **数据库连接**：配置DbConnBaseModel连接参数
2. **数据读取**：支持属性过滤和空间过滤
3. **数据写入**：自动批量写入优化
4. **数据删除**：按条件删除要素
5. **性能优化**：空间索引、批量操作、数据库端过滤

下一章将介绍国土TXT格式的处理方法。
