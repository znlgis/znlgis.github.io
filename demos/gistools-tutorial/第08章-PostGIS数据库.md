---
layout: default
title: PostGIS数据库
---

# PostGIS数据库

## 概述

PostGIS是PostgreSQL数据库的空间扩展，提供了强大的空间数据存储、查询和分析功能，是企业级GIS应用的首选数据库方案。

## 数据库连接

### 连接参数模型

```java
/**
 * 数据库连接参数模型
 */
@Data
public class DbConnBaseModel implements Serializable {
    private String dbtype = "postgis";
    private String host;
    private Integer port;
    private String schema;
    private String database;
    private String user;
    private String passwd;
}
```

### GeoTools连接方式

```java
/**
 * 获取Postgis数据源参数
 */
private static Map<String, Object> getPostgisInfo(DbConnBaseModel dbConnBaseModel) {
    Map<String, Object> params = new HashMap<>();
    params.put("dbtype", dbConnBaseModel.getDbtype());
    params.put("host", dbConnBaseModel.getHost());
    params.put("port", dbConnBaseModel.getPort());
    params.put("schema", dbConnBaseModel.getSchema());
    params.put("database", dbConnBaseModel.getDatabase());
    params.put("user", dbConnBaseModel.getUser());
    params.put("passwd", dbConnBaseModel.getPasswd());
    params.put("preparedStatements", true);
    params.put("encode functions", true);
    return params;
}

/**
 * 获取Postgis数据源
 */
public static JDBCDataStore getPostgisDataStore(DbConnBaseModel dbConnBaseModel) {
    Map<String, Object> params = getPostgisInfo(dbConnBaseModel);
    return (JDBCDataStore) DataStoreFinder.getDataStore(params);
}
```

### GDAL连接方式

```java
/**
 * 获取GDAL Postgis连接字符串
 */
public static String toGdalPostgisConnStr(DbConnBaseModel dbConnBaseModel) {
    return "PG: host=" + dbConnBaseModel.getHost() +
        " port=" + dbConnBaseModel.getPort() +
        " dbname=" + dbConnBaseModel.getDatabase() +
        " user=" + dbConnBaseModel.getUser() +
        " password=" + dbConnBaseModel.getPasswd() +
        " active_schema=" + dbConnBaseModel.getSchema();
}
```

## 数据读取

### 使用GeoTools读取

```java
/**
 * Postgis图层转换为WktLayer
 */
public static WktLayer fromPostGIS(DbConnBaseModel dbConnBaseModel, 
        String layerName, String attributeFilter, String spatialFilterWkt, 
        GisEngineType gisEngineType) {
    
    gisEngineType = GisEngineType.getGisEngineType(gisEngineType);
    
    if (gisEngineType == GisEngineType.GEOTOOLS) {
        DataStore dataStore = PostgisUtil.getPostgisDataStore(dbConnBaseModel);
        SimpleFeatureSource source = dataStore.getFeatureSource(layerName);
        
        // 应用过滤条件
        SimpleFeatureCollection simpleFeatureCollection = 
            GeotoolsUtil.filter(source, attributeFilter, spatialFilterWkt);
        
        dataStore.dispose();
        return fromSimpleFeatureCollection(simpleFeatureCollection);
    }
    
    return null;
}
```

### 使用GDAL读取

```java
/**
 * 使用GDAL读取PostGIS
 */
public static WktLayer fromPostGISWithGDAL(DbConnBaseModel dbConnBaseModel,
        String layerName, String attributeFilter, String spatialFilterWkt) {
    String connStr = PostgisUtil.toGdalPostgisConnStr(dbConnBaseModel);
    return OgrUtil.layer2WktLayer(DataFormatType.POSTGIS, connStr, 
        layerName, attributeFilter, spatialFilterWkt);
}
```

## 数据写入

### 使用GeoTools写入

```java
/**
 * WktLayer转换为Postgis图层
 */
public static void toPostGIS(WktLayer wktLayer, DbConnBaseModel dbConnBaseModel, 
        String layerName, GisEngineType gisEngineType) {
    
    wktLayer.check();
    EsriUtil.excludeSpecialFields(wktLayer.getFields());
    
    gisEngineType = GisEngineType.getGisEngineType(gisEngineType);
    
    if (gisEngineType == GisEngineType.GEOTOOLS) {
        SimpleFeatureCollection featureCollection = toSimpleFeatureCollection(wktLayer);
        SimpleFeatureType simpleFeatureType = featureCollection.getSchema();
        
        JDBCDataStore dataStore = PostgisUtil.getPostgisDataStore(dbConnBaseModel);
        
        // 检查表是否存在，不存在则创建
        if (!Arrays.asList(dataStore.getTypeNames()).contains(layerName)) {
            SimpleFeatureTypeBuilder tb = new SimpleFeatureTypeBuilder();
            tb.init(simpleFeatureType);
            tb.setName(layerName);
            dataStore.createSchema(tb.buildFeatureType());
        }
        
        // 构建字段映射
        SimpleFeatureType featureType = dataStore.getSchema(layerName);
        Map<String, String> fieldMap = buildFieldMapping(featureType, simpleFeatureType);
        
        dataStore.dispose();
        
        // 批量写入
        batchWrite(dbConnBaseModel, layerName, featureCollection, fieldMap);
    }
}

/**
 * 批量写入数据
 */
private static void batchWrite(DbConnBaseModel dbConnBaseModel, String layerName,
        SimpleFeatureCollection featureCollection, Map<String, String> fieldMap) {
    
    List<SimpleFeature> features = new ArrayList<>();
    try (FeatureIterator<SimpleFeature> iterator = featureCollection.features()) {
        while (iterator.hasNext()) {
            features.add(iterator.next());
        }
    }
    
    int batchSize = 1000;
    int count = features.size() / batchSize;
    ExecutorService executorService = ThreadUtil.newExecutor(count);
    
    for (int i = 0; i <= count; i++) {
        List<SimpleFeature> subList;
        if (i == count) {
            subList = features.subList(i * batchSize, features.size());
        } else {
            subList = features.subList(i * batchSize, (i + 1) * batchSize);
        }
        
        executorService.execute(() -> {
            writeBatch(dbConnBaseModel, layerName, subList, fieldMap);
        });
    }
    
    executorService.shutdown();
    executorService.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
}

/**
 * 写入单批数据
 */
private static void writeBatch(DbConnBaseModel dbConnBaseModel, String layerName,
        List<SimpleFeature> subList, Map<String, String> fieldMap) {
    try {
        DataStore ds = PostgisUtil.getPostgisDataStore(dbConnBaseModel);
        Transaction transaction = new DefaultTransaction("create");
        FeatureWriter<SimpleFeatureType, SimpleFeature> writer = 
            ds.getFeatureWriterAppend(layerName, transaction);
        
        try {
            for (SimpleFeature feature : subList) {
                writer.hasNext();
                SimpleFeature writefeature = writer.next();
                writefeature.setDefaultGeometry(feature.getDefaultGeometry());
                
                for (Map.Entry<String, String> kv : fieldMap.entrySet()) {
                    writefeature.setAttribute(kv.getKey(), 
                        feature.getAttribute(kv.getValue()));
                }
                
                writer.write();
            }
            
            transaction.commit();
        } catch (Exception e) {
            transaction.rollback();
            throw new RuntimeException(e);
        } finally {
            writer.close();
            transaction.close();
            ds.dispose();
        }
    } catch (Exception e) {
        throw new RuntimeException(e);
    }
}
```

### 使用GDAL写入

```java
/**
 * 使用GDAL写入PostGIS
 */
public static void toPostGISWithGDAL(WktLayer wktLayer, 
        DbConnBaseModel dbConnBaseModel, String layerName) {
    Vector options = new Vector();
    options.add("GEOMETRY_NAME=SHAPE");
    options.add("FID=FID");
    options.add("FID64=TRUE");
    
    String path = PostgisUtil.toGdalPostgisConnStr(dbConnBaseModel);
    OgrUtil.wktLayer2Layer4Postgis(DataFormatType.POSTGIS, dbConnBaseModel, 
        wktLayer, layerName, options);
}
```

### GDAL批量写入优化

```java
/**
 * GDAL批量写入PostGIS（优化版）
 */
private static void wktLayer2Layer4Postgis(DataFormatType driverType, String path, 
        WktLayer wktLayer, String layerName) {
    int batchSize = 1000;
    int count = wktLayer.getFeatures().size() / batchSize;
    ExecutorService executorService = ThreadUtil.newExecutor(count);
    
    for (int j = 0; j <= count; j++) {
        List<WktFeature> subList;
        if (j == count) {
            subList = wktLayer.getFeatures().subList(j * batchSize, 
                wktLayer.getFeatures().size());
        } else {
            subList = wktLayer.getFeatures().subList(j * batchSize, 
                (j + 1) * batchSize);
        }
        
        executorService.execute(() -> {
            try {
                wktFeatures2Layer(driverType, path, wktLayer.getFields(), 
                    subList, layerName);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }
    
    executorService.shutdown();
    executorService.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
}
```

## 数据删除

```java
/**
 * 删除PostGIS指定图层的指定要素
 */
public static int deletePostgisFeatures(DbConnBaseModel dbConnBaseModel, 
        String layerName, String whereClause) {
    JDBCDataStore dataStore = PostgisUtil.getPostgisDataStore(dbConnBaseModel);
    Statement statement = dataStore.getConnection(Transaction.AUTO_COMMIT)
        .createStatement();
    
    String sql = String.format("DELETE FROM %s.%s", 
        dbConnBaseModel.getSchema(), layerName);
    if (CharSequenceUtil.isNotBlank(whereClause)) {
        sql += " WHERE " + whereClause;
    }
    
    int count = statement.executeUpdate(sql);
    
    statement.close();
    dataStore.dispose();
    return count;
}
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
    WktLayer layer = WktLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 写入PostGIS
    WktLayerConverter.toPostGIS(layer, dbConn, tableName, GisEngineType.GEOTOOLS);
    
    System.out.println("导入完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

### 案例2：PostGIS导出Shapefile

```java
/**
 * 从PostGIS导出Shapefile
 */
public void exportPostGISToShp(DbConnBaseModel dbConn, String tableName,
        String outputPath, String whereClause) {
    // 读取PostGIS
    WktLayer layer = WktLayerConverter.fromPostGIS(
        dbConn, tableName, whereClause, null, GisEngineType.GEOTOOLS);
    
    // 写入Shapefile
    WktLayerConverter.toShapefile(layer, outputPath, GisEngineType.GEOTOOLS);
    
    System.out.println("导出完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

### 案例3：空间查询

```java
/**
 * 空间查询：找出指定区域内的要素
 */
public List<WktFeature> spatialQueryFromPostGIS(DbConnBaseModel dbConn,
        String tableName, String boundaryWkt) {
    // 使用空间过滤读取
    WktLayer layer = WktLayerConverter.fromPostGIS(
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
        WktLayer newData, String keyField) {
    // 获取新数据的Key列表
    Set<String> newKeys = newData.getFeatures().stream()
        .map(f -> {
            Optional<WktFieldValue> opt = f.getFieldValues().stream()
                .filter(v -> v.getField().getYwName().equals(keyField))
                .findFirst();
            return opt.map(v -> v.getValue().toString()).orElse("");
        })
        .collect(Collectors.toSet());
    
    // 删除旧数据
    String whereClause = keyField + " IN ('" + String.join("','", newKeys) + "')";
    int deleted = PostgisUtil.deletePostgisFeatures(dbConn, tableName, whereClause);
    System.out.println("删除旧数据 " + deleted + " 条");
    
    // 写入新数据
    WktLayerConverter.toPostGIS(newData, dbConn, tableName, GisEngineType.GEOTOOLS);
    System.out.println("写入新数据 " + newData.getFeatures().size() + " 条");
}
```

### 案例5：数据同步

```java
/**
 * 同步两个PostGIS表的数据
 */
public void syncPostGISTables(DbConnBaseModel sourceDb, String sourceTable,
        DbConnBaseModel targetDb, String targetTable, String whereClause) {
    // 读取源数据
    WktLayer layer = WktLayerConverter.fromPostGIS(
        sourceDb, sourceTable, whereClause, null, GisEngineType.GEOTOOLS);
    
    // 清空目标表
    PostgisUtil.deletePostgisFeatures(targetDb, targetTable, null);
    
    // 写入目标表
    WktLayerConverter.toPostGIS(layer, targetDb, targetTable, GisEngineType.GEOTOOLS);
    
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
    WktLayer layer = WktLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 坐标转换
    if (layer.getWkid() != targetWkid) {
        layer = CrsUtil.reproject(layer, targetWkid);
    }
    
    // 写入PostGIS
    WktLayerConverter.toPostGIS(layer, dbConn, tableName, GisEngineType.GEOTOOLS);
}
```

## PostGIS SQL示例

虽然本教程主要使用Java API，但了解PostGIS的SQL语法也很有帮助：

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

```sql
-- 创建空间索引
CREATE INDEX idx_parcels_shape ON parcels USING GIST(shape);
```

### 2. 批量写入

使用多线程批量写入，每批1000条左右：

```java
int batchSize = 1000;
ExecutorService executor = ThreadUtil.newExecutor(Runtime.getRuntime().availableProcessors());
```

### 3. 使用PreparedStatement

GeoTools连接参数中启用：

```java
params.put("preparedStatements", true);
```

### 4. 合理使用过滤

优先使用数据库端过滤，减少数据传输量：

```java
// 推荐：使用属性过滤
WktLayerConverter.fromPostGIS(dbConn, tableName, "TYPE='residential'", null, ...);

// 推荐：使用空间过滤
WktLayerConverter.fromPostGIS(dbConn, tableName, null, boundaryWkt, ...);
```

## 小结

本章介绍了PostGIS数据库的核心内容：

1. **数据库连接**：GeoTools和GDAL两种连接方式
2. **数据读取**：支持属性过滤和空间过滤
3. **数据写入**：批量写入提升性能
4. **数据删除**：按条件删除要素
5. **性能优化**：空间索引、批量操作、数据库端过滤

下一章将介绍国土TXT格式的处理方法。
