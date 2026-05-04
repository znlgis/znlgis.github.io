---
layout: default
title: Shapefile处理
---

# Shapefile处理

## 概述

Shapefile是ESRI开发的矢量数据格式，是GIS领域使用最广泛的数据交换格式。本章介绍Shapefile的结构、读写方法和常见处理场景。

## Shapefile文件结构

一个完整的Shapefile由多个文件组成：

| 文件 | 后缀 | 说明 | 必需 |
|------|------|------|------|
| 主文件 | .shp | 存储几何数据 | 是 |
| 索引文件 | .shx | 存储几何索引 | 是 |
| 属性文件 | .dbf | 存储属性数据（dBASE格式） | 是 |
| 投影文件 | .prj | 存储坐标系信息 | 是 |
| 编码文件 | .cpg | 存储字符编码信息 | 否 |

### 文件完整性检查

```java
/**
 * 检查shp文件编码及必要文件
 * @param shpPath shp文件路径
 * @return 编码
 */
public static Charset check(String shpPath) {
    List<String> shpFiles = CollUtil.newArrayList(".shp", ".shx", ".dbf", ".prj");
    List<String> qs = new ArrayList<>();
    
    for (String shpFile : shpFiles) {
        File file = null;
        String filePath = shpPath.substring(0, shpPath.lastIndexOf(".")) + shpFile;
        if (FileUtil.exist(filePath)) {
            file = new File(filePath);
        } else {
            // 尝试大写后缀
            filePath = shpPath.substring(0, shpPath.lastIndexOf(".")) + shpFile.toUpperCase();
            if (FileUtil.exist(filePath)) {
                file = new File(filePath);
            }
        }
        
        if (file == null) {
            qs.add(shpFile);
        }
    }
    
    if (!qs.isEmpty()) {
        throw new RuntimeException("缺少必要文件：" + CharSequenceUtil.join(",", qs));
    }
    
    // 检测编码...
    return detectCharset(shpPath);
}
```

### 编码检测

Shapefile的编码问题是常见的痛点。编码检测的优先级：

1. 读取CPG文件指定的编码
2. 根据DBF文件头标识判断
3. 默认使用UTF-8

```java
private static Charset detectCharset(String shpPath) {
    Charset shpCharset = null;
    
    // 1. 检查CPG文件
    File cpgFile = findCpgFile(shpPath);
    if (cpgFile != null) {
        Charset cpgCharset = EncodingUtil.getFileEncoding(cpgFile);
        String cpgString = FileUtil.readString(cpgFile, cpgCharset);
        try {
            shpCharset = Charset.forName(cpgString.trim());
        } catch (Exception e) {
            throw new RuntimeException("CPG文件保存的编码格式错误");
        }
    }
    
    // 2. 检查DBF文件头
    if (shpCharset == null) {
        String dbfPath = shpPath.substring(0, shpPath.lastIndexOf(".")) + ".dbf";
        if (!FileUtil.exist(dbfPath)) {
            dbfPath = shpPath.substring(0, shpPath.lastIndexOf(".")) + ".DBF";
        }
        
        byte[] bs = FileUtil.readBytes(dbfPath);
        if (bs != null && bs.length >= 30) {
            byte b = bs[29];
            if (b == 0x4d) {
                shpCharset = Charset.forName("GBK");
            }
        }
    }
    
    // 3. 默认UTF-8
    if (shpCharset == null) {
        shpCharset = StandardCharsets.UTF_8;
    }
    
    return shpCharset;
}
```

## 读取Shapefile

### 使用GeoTools读取

```java
/**
 * Shapefile文件转换为WktLayer
 */
public static WktLayer fromShapefile(String shpPath, String attributeFilter, 
        String spatialFilterWkt, GisEngineType gisEngineType) {
    Charset shpCharset = ShpUtil.check(shpPath);
    
    gisEngineType = GisEngineType.getGisEngineType(gisEngineType);
    
    if (gisEngineType == GisEngineType.GEOTOOLS) {
        File file = new File(shpPath);
        ShapefileDataStore shpDataStore = new ShapefileDataStore(file.toURI().toURL());
        shpDataStore.setCharset(shpCharset);
        
        String typeName = shpDataStore.getTypeNames()[0];
        SimpleFeatureSource source = shpDataStore.getFeatureSource(typeName);
        SimpleFeatureCollection featureCollection = 
            GeotoolsUtil.filter(source, attributeFilter, spatialFilterWkt);
        
        shpDataStore.dispose();
        return fromSimpleFeatureCollection(featureCollection);
    }
    // GDAL方式...
}
```

### 使用GDAL/OGR读取

```java
/**
 * 使用GDAL读取Shapefile
 */
public static WktLayer fromShapefile(String shpPath, String attributeFilter,
        String spatialFilterWkt) {
    gdal.SetConfigOption("SHAPE_ENCODING", shpCharset.name());
    
    String shpDir = FileUtil.getParent(shpPath, 1);
    String shpName = FileUtil.mainName(shpPath);
    
    return OgrUtil.layer2WktLayer(DataFormatType.SHP, shpDir, shpName, 
        attributeFilter, spatialFilterWkt);
}
```

### 读取过程详解

OGR读取Shapefile的核心逻辑：

```java
/**
 * Layer转WktLayer
 */
public static WktLayer layer2WktLayer(Layer layer, String attributeFilter, 
        String spatialFilterWkt) {
    WktLayer wktLayer = new WktLayer();
    wktLayer.setYwName(layer.GetName());
    wktLayer.setZwName(layer.GetName());
    
    // 获取坐标系
    SpatialReference sr = layer.GetSpatialRef();
    Map.Entry<Integer, CoordinateReferenceSystem> m = 
        CrsUtil.standardizeCRS(sr.ExportToWkt());
    wktLayer.setWkid(m.getKey());
    wktLayer.setTolerance(CrsUtil.getTolerance(m.getValue()));
    
    // 获取几何类型
    int geotype = layer.GetGeomType();
    wktLayer.setGeometryType(GeometryType.valueOfByWkbGeometryType(geotype));
    
    // 读取字段定义
    List<WktField> wktFields = new ArrayList<>();
    for (int i = 0; i < layer.GetLayerDefn().GetFieldCount(); i++) {
        WktField wktField = new WktField();
        wktField.setYwName(layer.GetLayerDefn().GetFieldDefn(i).GetName());
        wktField.setZwName(layer.GetLayerDefn().GetFieldDefn(i).GetNameRef());
        wktField.setDataType(FieldDataType.fieldDataTypeByGdalCode(
            layer.GetLayerDefn().GetFieldDefn(i).GetFieldType()));
        wktFields.add(wktField);
    }
    wktLayer.setFields(wktFields);
    
    // 设置过滤条件
    if (CharSequenceUtil.isNotBlank(attributeFilter)) {
        layer.SetAttributeFilter(attributeFilter);
    }
    if (CharSequenceUtil.isNotBlank(spatialFilterWkt)) {
        spatialFilterWkt = ESRIGeometryUtil.simplify(spatialFilterWkt, wktLayer.getWkid());
        Geometry spatialFilter = ogr.CreateGeometryFromWkt(spatialFilterWkt);
        layer.SetSpatialFilter(spatialFilter);
    }
    
    // 读取要素
    List<WktFeature> wktFeatures = new ArrayList<>();
    Feature feature = layer.GetNextFeature();
    while (feature != null) {
        WktFeature wktFeature = new WktFeature();
        String wkt = feature.GetGeometryRef().ExportToWkt();
        wktFeature.setWkt(ESRIGeometryUtil.simplify(wkt, wktLayer.getWkid()));
        
        // 读取属性值...
        wktFeatures.add(wktFeature);
        feature = layer.GetNextFeature();
    }
    
    wktLayer.setFeatures(wktFeatures);
    wktLayer.check();
    return wktLayer;
}
```

## 写入Shapefile

### 字段名处理

Shapefile的字段名最长只能10个字符：

```java
/**
 * 格式化字段名（限制为10字符）
 */
public static void formatFieldName(List<WktField> fields) {
    for (WktField wktField : fields) {
        if (wktField.getYwName().length() > 10) {
            String yw = wktField.getYwName().substring(0, 10);
            String finalYw = yw;
            
            // 检查是否有重名
            Optional<WktField> optional = fields.stream()
                .filter(f -> f.getYwName().equals(finalYw))
                .findFirst();
                
            if (optional.isPresent()) {
                // 有重名，添加数字后缀
                if (optional.get().getYwName().matches(".*_\\d$")) {
                    yw = wktField.getYwName().substring(0, 8) + "_" +
                        (Integer.parseInt(optional.get().getYwName().substring(9)) + 1);
                } else {
                    yw = wktField.getYwName().substring(0, 8) + "_1";
                }
            }
            wktField.setYwName(yw);
        }
    }
}
```

### 使用GeoTools写入

```java
/**
 * WktLayer转换为Shapefile文件
 */
public static void toShapefile(WktLayer wktLayer, String shpPath, 
        GisEngineType gisEngineType) {
    wktLayer.check();
    EsriUtil.excludeSpecialFields(wktLayer.getFields());
    ShpUtil.formatFieldName(wktLayer.getFields());
    
    if (gisEngineType == GisEngineType.GEOTOOLS) {
        File shapeFile = new File(shpPath);
        SimpleFeatureCollection featureCollection = toSimpleFeatureCollection(wktLayer);
        
        Map<String, Serializable> params = new HashMap<>();
        params.put(ShapefileDataStoreFactory.URLP.key, shapeFile.toURI().toURL());
        
        ShapefileDataStore ds = (ShapefileDataStore) 
            new ShapefileDataStoreFactory().createNewDataStore(params);
        SimpleFeatureType featureType = featureCollection.getSchema();
        ds.createSchema(featureType);
        
        Charset charset = StandardCharsets.UTF_8;
        ds.setCharset(charset);
        
        String typeName = ds.getTypeNames()[0];
        FeatureWriter<SimpleFeatureType, SimpleFeature> writer = 
            ds.getFeatureWriterAppend(typeName, Transaction.AUTO_COMMIT);
        
        try (FeatureIterator<SimpleFeature> features = featureCollection.features()) {
            while (features.hasNext()) {
                SimpleFeature feature = features.next();
                writer.hasNext();
                SimpleFeature writefeature = writer.next();
                writefeature.setDefaultGeometry(feature.getDefaultGeometry());
                
                // 复制属性
                for (PropertyDescriptor d : featureType.getDescriptors()) {
                    if (!(feature.getAttribute(d.getName()) instanceof Geometry)) {
                        Name name = d.getName();
                        Object value = feature.getAttribute(name);
                        writefeature.setAttribute(name, value);
                    }
                }
                
                writer.write();
            }
        }
        
        writer.close();
        ds.dispose();
        
        // 写入CPG文件
        String cpgPath = shpPath.substring(0, shpPath.lastIndexOf(".")) + ".cpg";
        FileUtil.writeString("UTF-8", cpgPath, StandardCharsets.UTF_8);
    }
}
```

### 使用GDAL/OGR写入

```java
/**
 * 使用GDAL写入Shapefile
 */
public static void toShapefileWithGDAL(WktLayer wktLayer, String shpPath) {
    gdal.SetConfigOption("SHAPE_ENCODING", "");
    
    Vector options = new Vector();
    options.add("ENCODING=UTF-8");
    
    String shpDir = FileUtil.getParent(shpPath, 1);
    String shpName = FileUtil.mainName(shpPath);
    
    OgrUtil.wktLayer2Layer(DataFormatType.SHP, shpDir, wktLayer, shpName, options);
}
```

## 实践案例

### 案例1：Shapefile批量处理

处理一个目录下的所有Shapefile：

```java
/**
 * 批量处理Shapefile
 */
public void batchProcessShapefiles(String inputDir, String outputDir, int targetWkid) {
    File dir = new File(inputDir);
    File[] shpFiles = dir.listFiles((d, name) -> name.toLowerCase().endsWith(".shp"));
    
    if (shpFiles == null) return;
    
    for (File shpFile : shpFiles) {
        try {
            // 读取
            WktLayer layer = WktLayerConverter.fromShapefile(
                shpFile.getAbsolutePath(), null, null, GisEngineType.GEOTOOLS);
            
            // 坐标转换
            if (layer.getWkid() != targetWkid) {
                layer = CrsUtil.reproject(layer, targetWkid);
            }
            
            // 写入
            String outputPath = outputDir + File.separator + shpFile.getName();
            WktLayerConverter.toShapefile(layer, outputPath, GisEngineType.GEOTOOLS);
            
            System.out.println("处理完成: " + shpFile.getName());
        } catch (Exception e) {
            System.err.println("处理失败: " + shpFile.getName() + " - " + e.getMessage());
        }
    }
}
```

### 案例2：Shapefile属性筛选

从Shapefile中筛选特定要素：

```java
/**
 * 根据属性条件筛选要素
 */
public WktLayer filterByAttribute(String shpPath, String condition) {
    // 使用OGR的属性过滤功能
    return WktLayerConverter.fromShapefile(shpPath, condition, null, GisEngineType.GDAL);
}

// 使用示例
WktLayer selectedLayer = filterByAttribute("parcels.shp", "AREA > 1000 AND TYPE = '住宅'");
```

### 案例3：Shapefile空间裁剪

按区域边界裁剪Shapefile：

```java
/**
 * 空间裁剪
 */
public void clipShapefile(String inputPath, String boundaryPath, String outputPath) {
    // 读取待裁剪数据
    WktLayer dataLayer = WktLayerConverter.fromShapefile(
        inputPath, null, null, GisEngineType.GEOTOOLS);
    
    // 读取边界
    WktLayer boundaryLayer = WktLayerConverter.fromShapefile(
        boundaryPath, null, null, GisEngineType.GEOTOOLS);
    
    // 合并边界为单个几何
    List<Geometry> boundaryGeoms = boundaryLayer.getFeatures().stream()
        .map(f -> GeometryConverter.wkt2Geometry(f.getWkt()))
        .collect(Collectors.toList());
    Geometry boundary = JTSGeometryUtil.union(boundaryGeoms.toArray(new Geometry[0]));
    String boundaryWkt = boundary.toText();
    
    // 空间过滤读取（提升性能）
    WktLayer filteredLayer = WktLayerConverter.fromShapefile(
        inputPath, null, boundaryWkt, GisEngineType.GEOTOOLS);
    
    // 精确裁剪
    List<WktFeature> clippedFeatures = new ArrayList<>();
    for (WktFeature feature : filteredLayer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        Geometry clipped = geom.intersection(boundary);
        
        if (!clipped.isEmpty() && clipped.getArea() > 0) {
            WktFeature clippedFeature = new WktFeature();
            clippedFeature.setWfId(feature.getWfId());
            clippedFeature.setWkt(clipped.toText());
            clippedFeature.setFieldValues(feature.getFieldValues());
            clippedFeatures.add(clippedFeature);
        }
    }
    
    // 更新图层要素
    filteredLayer.setFeatures(clippedFeatures);
    
    // 输出
    WktLayerConverter.toShapefile(filteredLayer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例4：Shapefile合并

合并多个Shapefile为一个：

```java
/**
 * 合并多个Shapefile
 */
public void mergeShapefiles(List<String> inputPaths, String outputPath) {
    List<WktFeature> allFeatures = new ArrayList<>();
    WktLayer template = null;
    
    for (String inputPath : inputPaths) {
        WktLayer layer = WktLayerConverter.fromShapefile(
            inputPath, null, null, GisEngineType.GEOTOOLS);
        
        if (template == null) {
            template = layer;
        }
        
        allFeatures.addAll(layer.getFeatures());
    }
    
    if (template != null) {
        template.setFeatures(allFeatures);
        WktLayerConverter.toShapefile(template, outputPath, GisEngineType.GEOTOOLS);
    }
}
```

### 案例5：字段重命名

处理字段名超长问题：

```java
/**
 * 创建字段映射表
 */
public Map<String, String> createFieldMapping(List<WktField> fields) {
    Map<String, String> mapping = new LinkedHashMap<>();
    
    for (WktField field : fields) {
        String originalName = field.getYwName();
        String shortName = originalName;
        
        if (originalName.length() > 10) {
            shortName = originalName.substring(0, 10);
            // 处理重名
            int suffix = 1;
            while (mapping.containsValue(shortName)) {
                shortName = originalName.substring(0, 8) + "_" + suffix;
                suffix++;
            }
        }
        
        mapping.put(originalName, shortName);
        field.setYwName(shortName);
    }
    
    return mapping;
}
```

## 常见问题

### 1. 乱码问题

**原因**：Shapefile编码与读取编码不一致

**解决**：
- 确保源数据有正确的CPG文件
- 读取时自动检测编码
- 输出时始终使用UTF-8并生成CPG文件

### 2. 字段名截断

**原因**：Shapefile字段名限制10字符

**解决**：
- 使用字段映射表记录原始名称
- 在元数据中保存完整字段名
- 考虑使用GeoJSON或GDB等无此限制的格式

### 3. 几何无效

**原因**：源数据几何不符合规范

**解决**：
```java
// 读取后检查并修复
for (WktFeature feature : layer.getFeatures()) {
    Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
    if (!geom.isValid()) {
        geom = JTSGeometryUtil.validate(geom);
        feature.setWkt(geom.toText());
    }
}
```

### 4. 大文件处理

**原因**：一次性读取大文件导致内存溢出

**解决**：
- 使用空间过滤分区读取
- 使用流式处理方式
- 考虑使用数据库存储

## 小结

本章介绍了Shapefile处理的核心内容：

1. **文件结构**：了解Shapefile的组成文件及其作用
2. **编码处理**：正确检测和处理字符编码
3. **读写操作**：使用GeoTools和GDAL两种方式
4. **字段处理**：字段名长度限制的处理方法
5. **实践案例**：批量处理、裁剪、合并等常见操作

下一章将介绍GeoJSON格式的处理方法。
