# FileGDB数据处理

## 概述

FileGDB（File Geodatabase）是ESRI开发的文件地理数据库格式，支持更大的数据量和更复杂的数据结构。本章介绍如何使用OGU4J（通过GDAL引擎）处理FileGDB数据。

## FileGDB特点

### 与Shapefile对比

| 特性 | FileGDB | Shapefile |
|------|---------|-----------|
| 文件大小限制 | 1TB | 2GB |
| 字段名长度 | 64字符 | 10字符 |
| 数据集支持 | 支持 | 不支持 |
| 空间索引 | 内置 | 需要额外文件 |
| 拓扑规则 | 支持 | 不支持 |
| 域/子类型 | 支持 | 不支持 |

### 优势

1. **大数据支持**：单表可存储上亿条记录
2. **完整字段名**：支持64字符字段名
3. **多表管理**：一个.gdb可包含多个图层
4. **高性能**：内置空间索引和压缩

### 限制

1. **需要GDAL**：必须安装GDAL才能读写
2. **ESRI专有**：开放性不如开源格式
3. **版本兼容**：不同版本可能不完全兼容

## 环境配置

### GDAL安装

FileGDB支持需要GDAL环境：

**Windows**：
1. 下载GDAL二进制包
2. 配置环境变量 `GDAL_DATA` 和 `PATH`
3. 安装GDAL Java绑定

**Linux/Docker**：
```bash
apt-get install gdal-bin libgdal-dev
pip install gdal
```

### 验证安装

```java
// 检查GDAL是否可用
try {
    gdal.AllRegister();
    System.out.println("GDAL版本: " + gdal.VersionInfo());
    System.out.println("FileGDB驱动: " + 
        (ogr.GetDriverByName("OpenFileGDB") != null ? "可用" : "不可用"));
} catch (Exception e) {
    System.err.println("GDAL未正确安装: " + e.getMessage());
}
```

## 读取FileGDB

### 基本读取

```java
/**
 * 从FileGDB读取指定图层
 */
OguLayer layer = SimpleLayerConverter.fromFileGDB(
    "data/sample.gdb",        // GDB路径
    "parcels",                 // 图层名称
    null,                      // 属性过滤条件
    null,                      // 空间过滤条件
    GisEngineType.GDAL         // 必须使用GDAL引擎
);

System.out.println("要素数量: " + layer.getFeatures().size());
```

### 带过滤条件读取

```java
// 属性过滤
OguLayer filtered = SimpleLayerConverter.fromFileGDB(
    "data/sample.gdb",
    "parcels",
    "AREA > 1000 AND TYPE = '住宅'",  // OGR SQL语法
    null,
    GisEngineType.GDAL
);

// 空间过滤
String boundaryWkt = "POLYGON((116 39, 117 39, 117 40, 116 40, 116 39))";
OguLayer spatial = SimpleLayerConverter.fromFileGDB(
    "data/sample.gdb",
    "parcels",
    null,
    boundaryWkt,
    GisEngineType.GDAL
);
```

### 列出GDB中的图层

```java
/**
 * 获取GDB结构信息
 */
GdbGroupModel structure = GdalCmdUtil.getGdbDataStructure("data/sample.gdb");

System.out.println("要素数据集:");
for (String dataset : structure.getFeatureDatasets()) {
    System.out.println("  " + dataset);
}

System.out.println("要素类:");
for (String fc : structure.getFeatureClasses()) {
    System.out.println("  " + fc);
}

System.out.println("表:");
for (String table : structure.getTables()) {
    System.out.println("  " + table);
}
```

## 写入FileGDB

### 基本写入

```java
/**
 * 将OguLayer写入FileGDB
 */
SimpleLayerConverter.toFileGDB(
    layer,                     // 图层数据
    "output/result.gdb",       // GDB路径
    "FeatureDataset",          // 要素数据集名称（可为null）
    "output_layer",            // 图层名称
    GisEngineType.GDAL         // 必须使用GDAL引擎
);
```

### 写入到要素数据集

```java
// 写入到指定的要素数据集
SimpleLayerConverter.toFileGDB(
    layer,
    "output/result.gdb",
    "LandUse",           // 要素数据集
    "Parcels",           // 图层名
    GisEngineType.GDAL
);
```

### 追加数据

```java
// 追加到现有图层
// GDAL会自动处理追加逻辑
SimpleLayerConverter.toFileGDB(
    newData,
    "existing.gdb",
    null,
    "existing_layer",
    GisEngineType.GDAL
);
```

## 实践案例

### 案例1：FileGDB转Shapefile

```java
/**
 * FileGDB图层转Shapefile
 */
public void gdb2Shp(String gdbPath, String layerName, String shpPath) {
    // 读取FileGDB
    OguLayer layer = SimpleLayerConverter.fromFileGDB(
        gdbPath, layerName, null, null, GisEngineType.GDAL);
    
    // 写入Shapefile
    SimpleLayerConverter.toShapefile(layer, shpPath, GisEngineType.GEOTOOLS);
    
    System.out.println("转换完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

### 案例2：Shapefile导入FileGDB

```java
/**
 * Shapefile导入FileGDB
 */
public void shp2Gdb(String shpPath, String gdbPath, String layerName) {
    // 读取Shapefile
    OguLayer layer = SimpleLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 写入FileGDB
    SimpleLayerConverter.toFileGDB(layer, gdbPath, null, layerName, 
        GisEngineType.GDAL);
    
    System.out.println("导入完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

### 案例3：批量导出GDB图层

```java
/**
 * 批量导出GDB中的所有图层
 */
public void exportAllLayers(String gdbPath, String outputDir) {
    // 获取GDB结构
    GdbGroupModel structure = GdalCmdUtil.getGdbDataStructure(gdbPath);
    
    // 导出每个要素类
    for (String fcName : structure.getFeatureClasses()) {
        try {
            OguLayer layer = SimpleLayerConverter.fromFileGDB(
                gdbPath, fcName, null, null, GisEngineType.GDAL);
            
            String shpPath = outputDir + File.separator + fcName + ".shp";
            SimpleLayerConverter.toShapefile(layer, shpPath, 
                GisEngineType.GEOTOOLS);
            
            System.out.println("导出成功: " + fcName);
        } catch (Exception e) {
            System.err.println("导出失败: " + fcName + " - " + e.getMessage());
        }
    }
}
```

### 案例4：FileGDB空间查询

```java
/**
 * 在FileGDB上执行空间查询
 */
public List<OguFeature> spatialQuery(String gdbPath, String layerName, 
        String boundaryWkt) {
    OguLayer layer = SimpleLayerConverter.fromFileGDB(
        gdbPath, 
        layerName, 
        null, 
        boundaryWkt,  // 空间过滤
        GisEngineType.GDAL
    );
    
    return layer.getFeatures();
}
```

### 案例5：多图层合并

```java
/**
 * 合并GDB中的多个图层
 */
public void mergeLayers(String gdbPath, List<String> layerNames, 
        String outputPath) {
    List<OguFeature> allFeatures = new ArrayList<>();
    OguLayer template = null;
    
    for (String layerName : layerNames) {
        OguLayer layer = SimpleLayerConverter.fromFileGDB(
            gdbPath, layerName, null, null, GisEngineType.GDAL);
        
        if (template == null) {
            template = layer;
        }
        
        allFeatures.addAll(layer.getFeatures());
    }
    
    if (template != null) {
        template.setFeatures(allFeatures);
        SimpleLayerConverter.toShapefile(template, outputPath, 
            GisEngineType.GEOTOOLS);
    }
}
```

### 案例6：GDB转GeoJSON

```java
/**
 * FileGDB图层转GeoJSON
 */
public void gdb2GeoJson(String gdbPath, String layerName, String outputPath) {
    // 读取FileGDB
    OguLayer layer = SimpleLayerConverter.fromFileGDB(
        gdbPath, layerName, null, null, GisEngineType.GDAL);
    
    // 转换到经纬度（GeoJSON通常使用WGS84）
    if (CrsUtil.isProjectedCRS(layer.getWkid())) {
        layer = CrsUtil.reproject(layer, 4490);
    }
    
    // 写入GeoJSON
    SimpleLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例7：跨格式数据同步

```java
/**
 * FileGDB与PostGIS数据同步
 */
public void syncGdbToPostGIS(String gdbPath, String layerName,
        DbConnBaseModel dbConn, String tableName) {
    // 读取FileGDB
    OguLayer layer = SimpleLayerConverter.fromFileGDB(
        gdbPath, layerName, null, null, GisEngineType.GDAL);
    
    // 清空目标表
    PostgisUtil.deletePostgisFeatures(dbConn, tableName, null);
    
    // 写入PostGIS
    SimpleLayerConverter.toPostGIS(layer, dbConn, tableName, 
        GisEngineType.GEOTOOLS);
    
    System.out.println("同步完成，共 " + layer.getFeatures().size() + " 条记录");
}
```

## 性能优化

### 1. 空间过滤

尽量使用空间过滤减少读取数据量：

```java
// 推荐：使用空间过滤
OguLayer layer = SimpleLayerConverter.fromFileGDB(
    gdbPath, layerName, null, boundaryWkt, GisEngineType.GDAL);

// 不推荐：读取全部后筛选
OguLayer layer = SimpleLayerConverter.fromFileGDB(
    gdbPath, layerName, null, null, GisEngineType.GDAL);
// 然后在内存中筛选
```

### 2. 属性过滤

组合属性和空间过滤提升性能：

```java
OguLayer layer = SimpleLayerConverter.fromFileGDB(
    gdbPath, 
    layerName, 
    "TYPE = '住宅' AND YEAR > 2020",  // 属性过滤
    boundaryWkt,                        // 空间过滤
    GisEngineType.GDAL
);
```

### 3. 分批处理

大数据量时分批处理：

```java
// 使用空间分区分批读取
String[] quadrants = {
    "POLYGON((116 39, 116.5 39, 116.5 39.5, 116 39.5, 116 39))",
    "POLYGON((116.5 39, 117 39, 117 39.5, 116.5 39.5, 116.5 39))",
    // ...
};

for (String quad : quadrants) {
    OguLayer part = SimpleLayerConverter.fromFileGDB(
        gdbPath, layerName, null, quad, GisEngineType.GDAL);
    processPart(part);
}
```

## 常见问题

### 1. GDAL未安装

**错误**：`UnsatisfiedLinkError: gdal_jni`

**解决**：安装GDAL并配置环境变量

### 2. FileGDB驱动不可用

**错误**：`Unable to open datasource`

**解决**：确保GDAL编译时包含FileGDB驱动

### 3. 版本不兼容

**问题**：无法读取新版本GDB

**解决**：升级GDAL版本

### 4. 中文乱码

**问题**：属性中的中文显示乱码

**解决**：设置编码
```java
gdal.SetConfigOption("SHAPE_ENCODING", "UTF-8");
```

## 小结

本章介绍了FileGDB数据处理的核心内容：

1. **环境配置**：需要安装GDAL才能处理FileGDB
2. **读写操作**：使用SimpleLayerConverter配合GDAL引擎
3. **格式转换**：与Shapefile、GeoJSON、PostGIS互转
4. **性能优化**：使用过滤条件和分批处理
5. **常见问题**：GDAL安装、驱动可用性、编码问题

下一章将介绍实用工具与最佳实践。
