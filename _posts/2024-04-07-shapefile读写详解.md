---
layout: post
title: "第07章 - Shapefile读写详解"
date: 2024-04-07 10:00:00 +0800
categories: [GIS, GeoTools]
tags: [GeoTools, Shapefile, 数据读写, 矢量数据]
---

# 第07章 - Shapefile读写详解

## 7.1 Shapefile 格式概述

### 7.1.1 Shapefile 文件组成

Shapefile 是 ESRI 开发的空间数据格式，由多个文件组成：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Shapefile 文件组成                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   必需文件                                                          │
│   ├── .shp    主文件，存储几何数据                                  │
│   ├── .shx    索引文件，几何数据的索引                              │
│   └── .dbf    属性表，dBASE 格式的属性数据                          │
│                                                                     │
│   可选文件                                                          │
│   ├── .prj    投影文件，WKT 格式的坐标系统定义                      │
│   ├── .cpg    代码页文件，指定 DBF 文件的字符编码                   │
│   ├── .sbn    空间索引文件                                          │
│   ├── .sbx    空间索引文件                                          │
│   ├── .qix    四叉树空间索引（GeoTools/GDAL 使用）                  │
│   └── .fix    要素ID索引                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.1.2 Shapefile 限制

| 限制项 | 限制值 |
|--------|--------|
| 文件大小 | 单个 .shp/.dbf 文件最大 2GB |
| 属性名长度 | 最大 10 个字符 |
| 几何类型 | 单一几何类型 |
| 字段数量 | 最多 255 个字段 |
| 字符串长度 | 最大 254 个字符 |
| 空值支持 | 不支持 NULL（使用空字符串或0） |

## 7.2 读取 Shapefile

### 7.2.1 基本读取

```java
import org.geotools.api.data.FileDataStore;
import org.geotools.api.data.FileDataStoreFinder;
import org.geotools.api.data.SimpleFeatureSource;
import org.geotools.api.feature.simple.SimpleFeature;
import org.geotools.api.feature.simple.SimpleFeatureType;
import org.geotools.data.simple.SimpleFeatureCollection;
import org.geotools.data.simple.SimpleFeatureIterator;

import java.io.File;

public class ShapefileReader {
    
    public static void readShapefile(String path) throws Exception {
        File file = new File(path);
        
        // 获取数据存储
        FileDataStore store = FileDataStoreFinder.getDataStore(file);
        
        try {
            // 获取要素源
            SimpleFeatureSource source = store.getFeatureSource();
            
            // 获取要素类型（Schema）
            SimpleFeatureType schema = source.getSchema();
            
            System.out.println("=== Shapefile 信息 ===");
            System.out.println("文件: " + file.getName());
            System.out.println("图层名: " + schema.getTypeName());
            System.out.println("几何类型: " + schema.getGeometryDescriptor().getType().getBinding().getSimpleName());
            System.out.println("坐标系: " + (schema.getCoordinateReferenceSystem() != null ? 
                schema.getCoordinateReferenceSystem().getName() : "未定义"));
            System.out.println("属性数量: " + schema.getAttributeCount());
            
            // 打印属性信息
            System.out.println("\n属性列表:");
            schema.getAttributeDescriptors().forEach(attr -> {
                System.out.printf("  - %s: %s%n",
                    attr.getLocalName(),
                    attr.getType().getBinding().getSimpleName());
            });
            
            // 获取边界
            System.out.println("\n边界: " + source.getBounds());
            
            // 获取要素数量
            System.out.println("要素数量: " + source.getCount(Query.ALL));
            
            // 读取要素
            SimpleFeatureCollection features = source.getFeatures();
            
            System.out.println("\n前5个要素:");
            try (SimpleFeatureIterator iter = features.features()) {
                int count = 0;
                while (iter.hasNext() && count < 5) {
                    SimpleFeature feature = iter.next();
                    System.out.printf("  %s: %s%n",
                        feature.getID(),
                        feature.getDefaultGeometry().getClass().getSimpleName());
                    count++;
                }
            }
            
        } finally {
            store.dispose();
        }
    }
    
    public static void main(String[] args) throws Exception {
        readShapefile("data/countries.shp");
    }
}
```

### 7.2.2 使用 ShapefileDataStore

```java
import org.geotools.data.shapefile.ShapefileDataStore;
import org.geotools.data.shapefile.ShapefileDataStoreFactory;

import java.nio.charset.Charset;

public class ShapefileDataStoreExample {
    
    public static void main(String[] args) throws Exception {
        File file = new File("data/china_cities.shp");
        
        // 方式1：直接创建
        ShapefileDataStore store = new ShapefileDataStore(file.toURI().toURL());
        
        // 设置字符编码（处理中文）
        store.setCharset(Charset.forName("GBK"));
        
        // 方式2：通过工厂创建
        ShapefileDataStoreFactory factory = new ShapefileDataStoreFactory();
        Map<String, Object> params = new HashMap<>();
        params.put("url", file.toURI().toURL());
        params.put("charset", "GBK");  // 指定编码
        
        ShapefileDataStore store2 = (ShapefileDataStore) factory.createDataStore(params);
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            
            // 读取数据
            try (SimpleFeatureIterator iter = source.getFeatures().features()) {
                while (iter.hasNext()) {
                    SimpleFeature feature = iter.next();
                    System.out.println(feature.getAttribute("NAME"));  // 中文属性
                }
            }
            
        } finally {
            store.dispose();
        }
    }
}
```

### 7.2.3 带查询条件读取

```java
import org.geotools.api.data.Query;
import org.geotools.api.filter.Filter;
import org.geotools.api.filter.FilterFactory;
import org.geotools.factory.CommonFactoryFinder;

public class ShapefileQueryExample {
    
    public static void queryShapefile(File file) throws Exception {
        FileDataStore store = FileDataStoreFinder.getDataStore(file);
        FilterFactory ff = CommonFactoryFinder.getFilterFactory();
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            String typeName = source.getSchema().getTypeName();
            
            // 1. 属性过滤
            Filter nameFilter = ff.equals(
                ff.property("NAME"),
                ff.literal("Beijing")
            );
            
            Query query1 = new Query(typeName, nameFilter);
            System.out.println("名称过滤: " + source.getFeatures(query1).size());
            
            // 2. 数值范围过滤
            Filter rangeFilter = ff.and(
                ff.greater(ff.property("POP"), ff.literal(1000000)),
                ff.less(ff.property("POP"), ff.literal(10000000))
            );
            
            Query query2 = new Query(typeName, rangeFilter);
            System.out.println("人口范围: " + source.getFeatures(query2).size());
            
            // 3. 空间过滤 - BBOX
            Filter bboxFilter = ff.bbox(
                ff.property("the_geom"),
                116.0, 39.5, 117.0, 40.5,
                "EPSG:4326"
            );
            
            Query query3 = new Query(typeName, bboxFilter);
            System.out.println("BBOX过滤: " + source.getFeatures(query3).size());
            
            // 4. 空间过滤 - 点缓冲区
            GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();
            Point center = gf.createPoint(new Coordinate(116.4, 39.9));
            Geometry buffer = center.buffer(0.5);  // 0.5度缓冲区
            
            Filter bufferFilter = ff.intersects(
                ff.property("the_geom"),
                ff.literal(buffer)
            );
            
            Query query4 = new Query(typeName, bufferFilter);
            System.out.println("缓冲区过滤: " + source.getFeatures(query4).size());
            
            // 5. 模糊匹配
            Filter likeFilter = ff.like(ff.property("NAME"), "*ing*");
            
            Query query5 = new Query(typeName, likeFilter);
            System.out.println("模糊匹配: " + source.getFeatures(query5).size());
            
            // 6. 组合查询 + 分页
            Filter combinedFilter = ff.and(bboxFilter, rangeFilter);
            Query query6 = new Query(typeName, combinedFilter);
            query6.setPropertyNames("NAME", "POP", "the_geom");
            query6.setMaxFeatures(10);
            query6.setStartIndex(0);
            
            SimpleFeatureCollection results = source.getFeatures(query6);
            System.out.println("\n组合查询结果:");
            try (SimpleFeatureIterator iter = results.features()) {
                while (iter.hasNext()) {
                    SimpleFeature f = iter.next();
                    System.out.printf("  %s: %s%n",
                        f.getAttribute("NAME"),
                        f.getAttribute("POP"));
                }
            }
            
        } finally {
            store.dispose();
        }
    }
}
```

## 7.3 写入 Shapefile

### 7.3.1 创建新 Shapefile

```java
import org.geotools.data.shapefile.ShapefileDataStore;
import org.geotools.data.shapefile.ShapefileDataStoreFactory;

public class ShapefileWriter {
    
    public static void createShapefile(String path) throws Exception {
        File file = new File(path);
        
        // 定义要素类型
        SimpleFeatureType featureType = DataUtilities.createType(
            "City",
            "the_geom:Point:srid=4326," +
            "name:String," +
            "population:Long," +
            "area:Double," +
            "capital:Boolean"
        );
        
        // 创建 DataStore
        ShapefileDataStoreFactory factory = new ShapefileDataStoreFactory();
        
        Map<String, Object> params = new HashMap<>();
        params.put("url", file.toURI().toURL());
        params.put("create spatial index", Boolean.TRUE);
        
        ShapefileDataStore store = (ShapefileDataStore) factory.createNewDataStore(params);
        
        // 设置字符编码
        store.setCharset(Charset.forName("UTF-8"));
        
        // 创建 Schema
        store.createSchema(featureType);
        
        // 获取 FeatureStore
        SimpleFeatureStore featureStore = 
            (SimpleFeatureStore) store.getFeatureSource(store.getTypeNames()[0]);
        
        // 创建要素
        GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();
        SimpleFeatureBuilder builder = new SimpleFeatureBuilder(featureType);
        
        DefaultFeatureCollection collection = new DefaultFeatureCollection();
        
        // 添加北京
        builder.add(gf.createPoint(new Coordinate(116.4074, 39.9042)));
        builder.add("北京");
        builder.add(21540000L);
        builder.add(16410.54);
        builder.add(true);
        collection.add(builder.buildFeature("city.1"));
        
        // 添加上海
        builder.add(gf.createPoint(new Coordinate(121.4737, 31.2304)));
        builder.add("上海");
        builder.add(24280000L);
        builder.add(6340.5);
        builder.add(false);
        collection.add(builder.buildFeature("city.2"));
        
        // 使用事务写入
        Transaction transaction = new DefaultTransaction("create");
        featureStore.setTransaction(transaction);
        
        try {
            featureStore.addFeatures(collection);
            transaction.commit();
            System.out.println("Shapefile 创建成功: " + file.getAbsolutePath());
            
        } catch (Exception e) {
            transaction.rollback();
            throw e;
            
        } finally {
            transaction.close();
            store.dispose();
        }
    }
    
    public static void main(String[] args) throws Exception {
        createShapefile("output/cities.shp");
    }
}
```

### 7.3.2 追加数据到现有 Shapefile

```java
public class ShapefileAppender {
    
    public static void appendToShapefile(String path, List<SimpleFeature> newFeatures) 
            throws Exception {
        
        File file = new File(path);
        FileDataStore store = FileDataStoreFinder.getDataStore(file);
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            
            if (source instanceof SimpleFeatureStore) {
                SimpleFeatureStore featureStore = (SimpleFeatureStore) source;
                
                // 验证要素类型匹配
                SimpleFeatureType existingType = featureStore.getSchema();
                for (SimpleFeature feature : newFeatures) {
                    if (!feature.getFeatureType().equals(existingType)) {
                        throw new IllegalArgumentException("要素类型不匹配");
                    }
                }
                
                // 使用事务
                Transaction transaction = new DefaultTransaction("append");
                featureStore.setTransaction(transaction);
                
                try {
                    DefaultFeatureCollection collection = new DefaultFeatureCollection();
                    collection.addAll(newFeatures);
                    
                    List<FeatureId> ids = featureStore.addFeatures(collection);
                    transaction.commit();
                    
                    System.out.println("追加了 " + ids.size() + " 个要素");
                    
                } catch (Exception e) {
                    transaction.rollback();
                    throw e;
                    
                } finally {
                    transaction.close();
                }
                
            } else {
                throw new IOException("数据源不支持写入");
            }
            
        } finally {
            store.dispose();
        }
    }
}
```

### 7.3.3 修改和删除要素

```java
public class ShapefileEditor {
    
    public static void editShapefile(String path) throws Exception {
        File file = new File(path);
        FileDataStore store = FileDataStoreFinder.getDataStore(file);
        FilterFactory ff = CommonFactoryFinder.getFilterFactory();
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            
            if (source instanceof SimpleFeatureStore) {
                SimpleFeatureStore featureStore = (SimpleFeatureStore) source;
                
                Transaction transaction = new DefaultTransaction("edit");
                featureStore.setTransaction(transaction);
                
                try {
                    // 1. 修改单个属性
                    Filter updateFilter = ff.equals(
                        ff.property("name"),
                        ff.literal("北京")
                    );
                    featureStore.modifyFeatures("population", 22000000L, updateFilter);
                    
                    // 2. 修改多个属性
                    featureStore.modifyFeatures(
                        new String[] { "population", "area" },
                        new Object[] { 22000000L, 16500.0 },
                        updateFilter
                    );
                    
                    // 3. 修改几何
                    GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();
                    Point newLocation = gf.createPoint(new Coordinate(116.41, 39.91));
                    featureStore.modifyFeatures("the_geom", newLocation, updateFilter);
                    
                    // 4. 删除要素
                    Filter deleteFilter = ff.less(
                        ff.property("population"),
                        ff.literal(1000000)
                    );
                    featureStore.removeFeatures(deleteFilter);
                    
                    transaction.commit();
                    System.out.println("编辑完成");
                    
                } catch (Exception e) {
                    transaction.rollback();
                    throw e;
                    
                } finally {
                    transaction.close();
                }
            }
            
        } finally {
            store.dispose();
        }
    }
}
```

## 7.4 Shapefile 与其他格式转换

### 7.4.1 Shapefile 转 GeoJSON

```java
import org.geotools.geojson.feature.FeatureJSON;

public class ShapefileToGeoJSON {
    
    public static void convert(String shpPath, String jsonPath) throws Exception {
        File shpFile = new File(shpPath);
        File jsonFile = new File(jsonPath);
        
        FileDataStore store = FileDataStoreFinder.getDataStore(shpFile);
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            SimpleFeatureCollection features = source.getFeatures();
            
            // 创建 GeoJSON 写入器
            FeatureJSON featureJSON = new FeatureJSON();
            featureJSON.setEncodeFeatureCollectionBounds(true);
            featureJSON.setEncodeFeatureCollectionCRS(true);
            
            // 写入文件
            try (FileOutputStream out = new FileOutputStream(jsonFile)) {
                featureJSON.writeFeatureCollection(features, out);
            }
            
            System.out.println("转换完成: " + jsonFile.getAbsolutePath());
            
        } finally {
            store.dispose();
        }
    }
}
```

### 7.4.2 GeoJSON 转 Shapefile

```java
public class GeoJSONToShapefile {
    
    public static void convert(String jsonPath, String shpPath) throws Exception {
        File jsonFile = new File(jsonPath);
        File shpFile = new File(shpPath);
        
        // 读取 GeoJSON
        FeatureJSON featureJSON = new FeatureJSON();
        SimpleFeatureCollection features;
        
        try (FileInputStream in = new FileInputStream(jsonFile)) {
            features = (SimpleFeatureCollection) featureJSON.readFeatureCollection(in);
        }
        
        // 创建 Shapefile
        ShapefileDataStoreFactory factory = new ShapefileDataStoreFactory();
        Map<String, Object> params = new HashMap<>();
        params.put("url", shpFile.toURI().toURL());
        params.put("create spatial index", Boolean.TRUE);
        
        ShapefileDataStore store = (ShapefileDataStore) factory.createNewDataStore(params);
        
        try {
            // 创建 Schema（注意：Shapefile 属性名限制10字符）
            SimpleFeatureType originalType = features.getSchema();
            SimpleFeatureTypeBuilder typeBuilder = new SimpleFeatureTypeBuilder();
            typeBuilder.init(originalType);
            typeBuilder.setName(shpFile.getName().replace(".shp", ""));
            
            // 截断长属性名
            List<AttributeDescriptor> truncatedAttrs = new ArrayList<>();
            for (AttributeDescriptor desc : originalType.getAttributeDescriptors()) {
                String name = desc.getLocalName();
                if (name.length() > 10) {
                    name = name.substring(0, 10);
                }
                AttributeTypeBuilder atb = new AttributeTypeBuilder();
                atb.init(desc);
                atb.setName(name);
                truncatedAttrs.add(atb.buildDescriptor(name));
            }
            
            SimpleFeatureType shpType = typeBuilder.buildFeatureType();
            store.createSchema(shpType);
            
            // 写入数据
            SimpleFeatureStore featureStore = 
                (SimpleFeatureStore) store.getFeatureSource(store.getTypeNames()[0]);
            
            Transaction transaction = new DefaultTransaction("convert");
            featureStore.setTransaction(transaction);
            
            try {
                featureStore.addFeatures(features);
                transaction.commit();
                System.out.println("转换完成: " + shpFile.getAbsolutePath());
                
            } catch (Exception e) {
                transaction.rollback();
                throw e;
                
            } finally {
                transaction.close();
            }
            
        } finally {
            store.dispose();
        }
    }
}
```

### 7.4.3 复制 Shapefile

```java
public class ShapefileCopier {
    
    public static void copyShapefile(String sourcePath, String targetPath) throws Exception {
        File sourceFile = new File(sourcePath);
        File targetFile = new File(targetPath);
        
        // 读取源文件
        FileDataStore sourceStore = FileDataStoreFinder.getDataStore(sourceFile);
        
        try {
            SimpleFeatureSource source = sourceStore.getFeatureSource();
            SimpleFeatureType sourceType = source.getSchema();
            
            // 创建目标文件
            ShapefileDataStoreFactory factory = new ShapefileDataStoreFactory();
            Map<String, Object> params = new HashMap<>();
            params.put("url", targetFile.toURI().toURL());
            params.put("create spatial index", Boolean.TRUE);
            
            ShapefileDataStore targetStore = 
                (ShapefileDataStore) factory.createNewDataStore(params);
            
            try {
                // 设置编码
                if (sourceStore instanceof ShapefileDataStore) {
                    targetStore.setCharset(
                        ((ShapefileDataStore) sourceStore).getCharset());
                }
                
                // 创建 Schema
                SimpleFeatureTypeBuilder builder = new SimpleFeatureTypeBuilder();
                builder.init(sourceType);
                builder.setName(targetFile.getName().replace(".shp", ""));
                targetStore.createSchema(builder.buildFeatureType());
                
                // 复制数据
                SimpleFeatureStore targetFeatureStore = 
                    (SimpleFeatureStore) targetStore.getFeatureSource(
                        targetStore.getTypeNames()[0]);
                
                Transaction transaction = new DefaultTransaction("copy");
                targetFeatureStore.setTransaction(transaction);
                
                try {
                    targetFeatureStore.addFeatures(source.getFeatures());
                    transaction.commit();
                    System.out.println("复制完成: " + targetFile.getAbsolutePath());
                    
                } catch (Exception e) {
                    transaction.rollback();
                    throw e;
                    
                } finally {
                    transaction.close();
                }
                
            } finally {
                targetStore.dispose();
            }
            
        } finally {
            sourceStore.dispose();
        }
    }
}
```

## 7.5 处理投影

### 7.5.1 读取和设置投影

```java
public class ShapefileProjection {
    
    public static void handleProjection(String path) throws Exception {
        File file = new File(path);
        ShapefileDataStore store = new ShapefileDataStore(file.toURI().toURL());
        
        try {
            // 读取投影
            SimpleFeatureType schema = store.getSchema();
            CoordinateReferenceSystem crs = schema.getCoordinateReferenceSystem();
            
            if (crs != null) {
                System.out.println("坐标系名称: " + crs.getName());
                System.out.println("EPSG代码: " + CRS.lookupEpsgCode(crs, true));
                System.out.println("WKT:\n" + crs.toWKT());
            } else {
                System.out.println("未定义坐标系");
                
                // 强制设置坐标系
                store.forceSchemaCRS(CRS.decode("EPSG:4326"));
            }
            
        } finally {
            store.dispose();
        }
    }
}
```

### 7.5.2 重投影 Shapefile

```java
import org.geotools.api.referencing.operation.MathTransform;
import org.geotools.geometry.jts.JTS;

public class ShapefileReproject {
    
    public static void reproject(String sourcePath, String targetPath, String targetEPSG) 
            throws Exception {
        
        File sourceFile = new File(sourcePath);
        File targetFile = new File(targetPath);
        
        FileDataStore sourceStore = FileDataStoreFinder.getDataStore(sourceFile);
        
        try {
            SimpleFeatureSource source = sourceStore.getFeatureSource();
            SimpleFeatureType sourceType = source.getSchema();
            
            // 源坐标系
            CoordinateReferenceSystem sourceCRS = sourceType.getCoordinateReferenceSystem();
            
            // 目标坐标系
            CoordinateReferenceSystem targetCRS = CRS.decode(targetEPSG);
            
            // 创建转换
            MathTransform transform = CRS.findMathTransform(sourceCRS, targetCRS, true);
            
            // 创建目标要素类型
            SimpleFeatureTypeBuilder typeBuilder = new SimpleFeatureTypeBuilder();
            typeBuilder.init(sourceType);
            typeBuilder.setName(targetFile.getName().replace(".shp", ""));
            typeBuilder.setCRS(targetCRS);
            SimpleFeatureType targetType = typeBuilder.buildFeatureType();
            
            // 创建目标 Shapefile
            ShapefileDataStoreFactory factory = new ShapefileDataStoreFactory();
            Map<String, Object> params = new HashMap<>();
            params.put("url", targetFile.toURI().toURL());
            
            ShapefileDataStore targetStore = 
                (ShapefileDataStore) factory.createNewDataStore(params);
            targetStore.createSchema(targetType);
            
            try {
                SimpleFeatureStore targetFeatureStore = 
                    (SimpleFeatureStore) targetStore.getFeatureSource(
                        targetStore.getTypeNames()[0]);
                
                Transaction transaction = new DefaultTransaction("reproject");
                targetFeatureStore.setTransaction(transaction);
                
                try {
                    // 转换要素
                    DefaultFeatureCollection reprojected = new DefaultFeatureCollection();
                    SimpleFeatureBuilder builder = new SimpleFeatureBuilder(targetType);
                    
                    try (SimpleFeatureIterator iter = source.getFeatures().features()) {
                        while (iter.hasNext()) {
                            SimpleFeature feature = iter.next();
                            
                            // 转换几何
                            Geometry sourceGeom = (Geometry) feature.getDefaultGeometry();
                            Geometry targetGeom = JTS.transform(sourceGeom, transform);
                            
                            // 构建新要素
                            for (int i = 0; i < feature.getAttributeCount(); i++) {
                                if (feature.getAttribute(i) instanceof Geometry) {
                                    builder.add(targetGeom);
                                } else {
                                    builder.add(feature.getAttribute(i));
                                }
                            }
                            
                            reprojected.add(builder.buildFeature(feature.getID()));
                        }
                    }
                    
                    targetFeatureStore.addFeatures(reprojected);
                    transaction.commit();
                    
                    System.out.println("重投影完成: " + targetFile.getAbsolutePath());
                    
                } catch (Exception e) {
                    transaction.rollback();
                    throw e;
                    
                } finally {
                    transaction.close();
                }
                
            } finally {
                targetStore.dispose();
            }
            
        } finally {
            sourceStore.dispose();
        }
    }
}
```

## 7.6 空间索引

### 7.6.1 创建空间索引

```java
public class ShapefileSpatialIndex {
    
    public static void createIndex(String path) throws Exception {
        File file = new File(path);
        ShapefileDataStore store = new ShapefileDataStore(file.toURI().toURL());
        
        try {
            // 检查是否已有索引
            File qixFile = new File(path.replace(".shp", ".qix"));
            if (qixFile.exists()) {
                System.out.println("空间索引已存在");
            } else {
                // 创建索引
                store.createSpatialIndex(true);
                System.out.println("空间索引创建完成");
            }
            
        } finally {
            store.dispose();
        }
    }
    
    public static void queryWithIndex(String path, Envelope queryBounds) throws Exception {
        File file = new File(path);
        ShapefileDataStore store = new ShapefileDataStore(file.toURI().toURL());
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            FilterFactory ff = CommonFactoryFinder.getFilterFactory();
            
            // 使用 BBOX 查询（会利用空间索引）
            Filter bboxFilter = ff.bbox(
                ff.property("the_geom"),
                queryBounds.getMinX(), queryBounds.getMinY(),
                queryBounds.getMaxX(), queryBounds.getMaxY(),
                "EPSG:4326"
            );
            
            long startTime = System.currentTimeMillis();
            SimpleFeatureCollection results = source.getFeatures(bboxFilter);
            int count = results.size();
            long endTime = System.currentTimeMillis();
            
            System.out.printf("查询结果: %d 个要素, 耗时: %d ms%n",
                count, endTime - startTime);
            
        } finally {
            store.dispose();
        }
    }
}
```

## 7.7 字符编码处理

### 7.7.1 检测和设置编码

```java
public class ShapefileEncoding {
    
    public static void handleEncoding(String path) throws Exception {
        File file = new File(path);
        
        // 检查 .cpg 文件
        File cpgFile = new File(path.replace(".shp", ".cpg"));
        String detectedEncoding = null;
        
        if (cpgFile.exists()) {
            try (BufferedReader reader = new BufferedReader(new FileReader(cpgFile))) {
                detectedEncoding = reader.readLine().trim();
                System.out.println("CPG 文件指定编码: " + detectedEncoding);
            }
        }
        
        // 尝试不同编码读取
        String[] encodings = { "UTF-8", "GBK", "GB2312", "ISO-8859-1" };
        
        for (String encoding : encodings) {
            try {
                ShapefileDataStore store = new ShapefileDataStore(file.toURI().toURL());
                store.setCharset(Charset.forName(encoding));
                
                SimpleFeatureSource source = store.getFeatureSource();
                SimpleFeatureCollection fc = source.getFeatures();
                
                try (SimpleFeatureIterator iter = fc.features()) {
                    if (iter.hasNext()) {
                        SimpleFeature f = iter.next();
                        // 尝试读取一个字符串属性
                        for (int i = 0; i < f.getAttributeCount(); i++) {
                            Object attr = f.getAttribute(i);
                            if (attr instanceof String && !((String) attr).isEmpty()) {
                                System.out.printf("编码 %s: %s%n", encoding, attr);
                                break;
                            }
                        }
                    }
                }
                
                store.dispose();
                
            } catch (Exception e) {
                System.out.println("编码 " + encoding + " 失败: " + e.getMessage());
            }
        }
    }
    
    public static void setEncoding(String path, String encoding) throws Exception {
        File file = new File(path);
        
        // 创建或更新 .cpg 文件
        File cpgFile = new File(path.replace(".shp", ".cpg"));
        try (PrintWriter writer = new PrintWriter(cpgFile)) {
            writer.println(encoding);
        }
        
        System.out.println("编码设置为: " + encoding);
    }
}
```

## 7.8 大文件处理

### 7.8.1 流式处理

```java
public class LargeShapefileProcessor {
    
    public static void processLargeFile(String path, FeatureProcessor processor) 
            throws Exception {
        
        File file = new File(path);
        FileDataStore store = FileDataStoreFinder.getDataStore(file);
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            
            // 分页处理
            int pageSize = 1000;
            int offset = 0;
            int total = source.getCount(Query.ALL);
            
            Query query = new Query(source.getSchema().getTypeName());
            query.setMaxFeatures(pageSize);
            
            while (offset < total) {
                query.setStartIndex(offset);
                SimpleFeatureCollection batch = source.getFeatures(query);
                
                try (SimpleFeatureIterator iter = batch.features()) {
                    while (iter.hasNext()) {
                        SimpleFeature feature = iter.next();
                        processor.process(feature);
                    }
                }
                
                offset += pageSize;
                System.out.printf("进度: %d/%d (%.1f%%)%n",
                    Math.min(offset, total), total,
                    Math.min(offset, total) * 100.0 / total);
            }
            
        } finally {
            store.dispose();
        }
    }
    
    public interface FeatureProcessor {
        void process(SimpleFeature feature);
    }
}
```

### 7.8.2 并行处理

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;

public class ParallelShapefileProcessor {
    
    public static void processParallel(String path, int threads) throws Exception {
        File file = new File(path);
        FileDataStore store = FileDataStoreFinder.getDataStore(file);
        
        try {
            SimpleFeatureSource source = store.getFeatureSource();
            int total = source.getCount(Query.ALL);
            int chunkSize = (total + threads - 1) / threads;
            
            ExecutorService executor = Executors.newFixedThreadPool(threads);
            CountDownLatch latch = new CountDownLatch(threads);
            
            for (int i = 0; i < threads; i++) {
                final int startIndex = i * chunkSize;
                final int endIndex = Math.min((i + 1) * chunkSize, total);
                
                executor.submit(() -> {
                    try {
                        processChunk(store, source.getSchema().getTypeName(),
                            startIndex, endIndex - startIndex);
                    } catch (Exception e) {
                        e.printStackTrace();
                    } finally {
                        latch.countDown();
                    }
                });
            }
            
            latch.await();
            executor.shutdown();
            
        } finally {
            store.dispose();
        }
    }
    
    private static void processChunk(DataStore store, String typeName, 
            int offset, int limit) throws Exception {
        
        SimpleFeatureSource source = store.getFeatureSource(typeName);
        
        Query query = new Query(typeName);
        query.setStartIndex(offset);
        query.setMaxFeatures(limit);
        
        try (SimpleFeatureIterator iter = source.getFeatures(query).features()) {
            while (iter.hasNext()) {
                SimpleFeature feature = iter.next();
                // 处理要素
            }
        }
    }
}
```

## 7.9 本章小结

本章详细介绍了 Shapefile 的读写操作：

1. **Shapefile 格式**
   - 文件组成
   - 格式限制

2. **读取操作**
   - 基本读取
   - 查询过滤
   - 使用 ShapefileDataStore

3. **写入操作**
   - 创建新文件
   - 追加数据
   - 修改和删除

4. **格式转换**
   - Shapefile 与 GeoJSON 互转
   - 复制 Shapefile

5. **投影处理**
   - 读取和设置投影
   - 重投影

6. **高级特性**
   - 空间索引
   - 字符编码
   - 大文件处理

### 关键要点

- 注意 Shapefile 的限制（属性名10字符）
- 正确处理字符编码
- 使用空间索引提高查询性能
- 大文件使用分页或流式处理

---

[← 上一章：数据源访问与管理](第06章-数据源访问与管理) | [返回目录](README) | [下一章：GeoJSON处理实战 →](第08章-GeoJSON处理实战)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第06章-数据源访问与管理" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第08章-GeoJSON处理实战" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->