# Shapefile数据处理

## 概述

Shapefile是ESRI开发的矢量数据格式，是GIS领域使用最广泛的数据交换格式。本章介绍如何使用OGU4J读写Shapefile，以及处理常见问题的方法。

## Shapefile文件结构

一个完整的Shapefile由多个文件组成：

| 文件 | 后缀 | 说明 | 必需 |
|------|------|------|------|
| 主文件 | .shp | 存储几何数据 | 是 |
| 索引文件 | .shx | 存储几何索引 | 是 |
| 属性文件 | .dbf | 存储属性数据 | 是 |
| 投影文件 | .prj | 存储坐标系信息 | 是 |
| 编码文件 | .cpg | 存储字符编码 | 否 |

### 文件完整性检查

OGU4J在读取Shapefile时会自动检查文件完整性：

```java
/**
 * 检查shp文件完整性和编码
 */
public static Charset check(String shpPath) {
    List<String> requiredFiles = Arrays.asList(".shp", ".shx", ".dbf", ".prj");
    List<String> missing = new ArrayList<>();
    
    String basePath = shpPath.substring(0, shpPath.lastIndexOf("."));
    
    for (String ext : requiredFiles) {
        String filePath = basePath + ext;
        if (!FileUtil.exist(filePath)) {
            // 尝试大写后缀
            filePath = basePath + ext.toUpperCase();
            if (!FileUtil.exist(filePath)) {
                missing.add(ext);
            }
        }
    }
    
    if (!missing.isEmpty()) {
        throw new RuntimeException("缺少必要文件：" + String.join(",", missing));
    }
    
    return detectCharset(shpPath);
}
```

### 编码检测

Shapefile的编码问题是常见的痛点。OGU4J的编码检测优先级：

1. 读取CPG文件指定的编码
2. 根据DBF文件头标识判断
3. 默认使用UTF-8

```java
private static Charset detectCharset(String shpPath) {
    Charset charset = null;
    
    // 1. 检查CPG文件
    String cpgPath = shpPath.replace(".shp", ".cpg");
    if (FileUtil.exist(cpgPath)) {
        String cpgContent = FileUtil.readString(cpgPath, StandardCharsets.UTF_8);
        try {
            charset = Charset.forName(cpgContent.trim());
        } catch (Exception e) {
            throw new RuntimeException("CPG文件编码格式错误");
        }
    }
    
    // 2. 检查DBF文件头
    if (charset == null) {
        String dbfPath = shpPath.replace(".shp", ".dbf");
        byte[] bytes = FileUtil.readBytes(dbfPath);
        if (bytes != null && bytes.length >= 30) {
            if (bytes[29] == 0x4d) {
                charset = Charset.forName("GBK");
            }
        }
    }
    
    // 3. 默认UTF-8
    return charset != null ? charset : StandardCharsets.UTF_8;
}
```

## 读取Shapefile

### 基本读取

```java
/**
 * 读取Shapefile为OguLayer
 */
OguLayer layer = SimpleLayerConverter.fromShapefile(
    "data/parcels.shp",     // 文件路径
    null,                    // 属性过滤条件
    null,                    // 空间过滤条件
    GisEngineType.GEOTOOLS   // 使用的引擎
);

// 使用图层数据
System.out.println("要素数量: " + layer.getFeatures().size());
System.out.println("坐标系: EPSG:" + layer.getWkid());
System.out.println("几何类型: " + layer.getGeometryType());
```

### 带过滤条件读取

```java
// 属性过滤
OguLayer filtered = SimpleLayerConverter.fromShapefile(
    "parcels.shp",
    "AREA > 1000 AND TYPE = '住宅'",  // CQL表达式
    null,
    GisEngineType.GEOTOOLS
);

// 空间过滤
String boundaryWkt = "POLYGON((116 39, 117 39, 117 40, 116 40, 116 39))";
OguLayer spatial = SimpleLayerConverter.fromShapefile(
    "parcels.shp",
    null,
    boundaryWkt,
    GisEngineType.GEOTOOLS
);

// 组合过滤
OguLayer combined = SimpleLayerConverter.fromShapefile(
    "parcels.shp",
    "TYPE = '住宅'",
    boundaryWkt,
    GisEngineType.GEOTOOLS
);
```

### 使用GDAL引擎读取

GDAL引擎在某些场景下性能更好：

```java
OguLayer layer = SimpleLayerConverter.fromShapefile(
    "data/parcels.shp",
    null,
    null,
    GisEngineType.GDAL  // 使用GDAL引擎
);
```

## 写入Shapefile

### 基本写入

```java
/**
 * 将OguLayer写入Shapefile
 */
SimpleLayerConverter.toShapefile(
    layer,                   // 图层数据
    "output/result.shp",     // 输出路径
    GisEngineType.GEOTOOLS   // 使用的引擎
);
```

### 字段名处理

Shapefile的字段名最长只能10个字符，OGU4J会自动处理：

```java
/**
 * 格式化字段名（限制为10字符）
 */
public static void formatFieldName(List<OguField> fields) {
    for (OguField field : fields) {
        if (field.getYwName().length() > 10) {
            String shortName = field.getYwName().substring(0, 10);
            
            // 处理重名
            int suffix = 1;
            while (hasName(fields, shortName)) {
                shortName = field.getYwName().substring(0, 8) + "_" + suffix;
                suffix++;
            }
            
            field.setYwName(shortName);
        }
    }
}
```

### 编码处理

写入时始终使用UTF-8编码并生成CPG文件：

```java
// 写入后自动生成CPG文件
String cpgPath = shpPath.replace(".shp", ".cpg");
FileUtil.writeString("UTF-8", cpgPath, StandardCharsets.UTF_8);
```

## 实践案例

### 案例1：Shapefile批量处理

```java
/**
 * 批量处理目录下的所有Shapefile
 */
public void batchProcess(String inputDir, String outputDir, int targetWkid) {
    File dir = new File(inputDir);
    File[] shpFiles = dir.listFiles((d, name) -> 
        name.toLowerCase().endsWith(".shp"));
    
    if (shpFiles == null) return;
    
    for (File shpFile : shpFiles) {
        try {
            // 读取
            OguLayer layer = SimpleLayerConverter.fromShapefile(
                shpFile.getAbsolutePath(), null, null, GisEngineType.GEOTOOLS);
            
            // 坐标转换
            if (layer.getWkid() != targetWkid) {
                layer = CrsUtil.reproject(layer, targetWkid);
            }
            
            // 写入
            String outputPath = outputDir + File.separator + shpFile.getName();
            SimpleLayerConverter.toShapefile(layer, outputPath, GisEngineType.GEOTOOLS);
            
            System.out.println("处理完成: " + shpFile.getName());
        } catch (Exception e) {
            System.err.println("处理失败: " + shpFile.getName() + " - " + e.getMessage());
        }
    }
}
```

### 案例2：Shapefile属性筛选

```java
/**
 * 按属性条件筛选要素
 */
public OguLayer filterByAttribute(String shpPath, String condition) {
    return SimpleLayerConverter.fromShapefile(
        shpPath, 
        condition,  // 如："AREA > 1000 AND TYPE = '住宅'"
        null, 
        GisEngineType.GEOTOOLS
    );
}

// 使用示例
OguLayer residential = filterByAttribute("parcels.shp", "TYPE = '住宅'");
OguLayer large = filterByAttribute("parcels.shp", "AREA > 1000");
```

### 案例3：Shapefile空间裁剪

```java
/**
 * 按边界裁剪Shapefile
 */
public void clipShapefile(String inputPath, String boundaryPath, String outputPath) {
    // 读取待裁剪数据
    OguLayer dataLayer = SimpleLayerConverter.fromShapefile(
        inputPath, null, null, GisEngineType.GEOTOOLS);
    
    // 读取边界
    OguLayer boundaryLayer = SimpleLayerConverter.fromShapefile(
        boundaryPath, null, null, GisEngineType.GEOTOOLS);
    
    // 合并边界为单个几何
    List<Geometry> boundaries = boundaryLayer.getFeatures().stream()
        .map(f -> GeometryConverter.wkt2Geometry(f.getWkt()))
        .collect(Collectors.toList());
    Geometry boundary = boundaries.get(0);
    for (int i = 1; i < boundaries.size(); i++) {
        boundary = boundary.union(boundaries.get(i));
    }
    
    // 空间过滤读取（提升性能）
    OguLayer filtered = SimpleLayerConverter.fromShapefile(
        inputPath, null, boundary.toText(), GisEngineType.GEOTOOLS);
    
    // 精确裁剪
    List<OguFeature> clipped = new ArrayList<>();
    for (OguFeature feature : filtered.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        Geometry result = geom.intersection(boundary);
        
        if (!result.isEmpty() && result.getArea() > 0) {
            OguFeature f = new OguFeature();
            f.setWfId(feature.getWfId());
            f.setWkt(result.toText());
            f.setFieldValues(feature.getFieldValues());
            clipped.add(f);
        }
    }
    
    filtered.setFeatures(clipped);
    
    // 输出
    SimpleLayerConverter.toShapefile(filtered, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例4：合并多个Shapefile

```java
/**
 * 合并多个Shapefile
 */
public void mergeShapefiles(List<String> inputPaths, String outputPath) {
    List<OguFeature> allFeatures = new ArrayList<>();
    OguLayer template = null;
    
    for (String inputPath : inputPaths) {
        OguLayer layer = SimpleLayerConverter.fromShapefile(
            inputPath, null, null, GisEngineType.GEOTOOLS);
        
        if (template == null) {
            template = layer;
        } else {
            // 确保坐标系一致
            if (!layer.getWkid().equals(template.getWkid())) {
                layer = CrsUtil.reproject(layer, template.getWkid());
            }
        }
        
        allFeatures.addAll(layer.getFeatures());
    }
    
    if (template != null) {
        template.setFeatures(allFeatures);
        SimpleLayerConverter.toShapefile(template, outputPath, GisEngineType.GEOTOOLS);
    }
}
```

### 案例5：Shapefile转GeoJSON

```java
/**
 * Shapefile转GeoJSON
 */
public void shp2GeoJson(String shpPath, String geojsonPath) {
    // 读取Shapefile
    OguLayer layer = SimpleLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 写入GeoJSON
    SimpleLayerConverter.toGeoJSON(layer, geojsonPath, GisEngineType.GEOTOOLS);
}
```

### 案例6：几何有效性修复

```java
/**
 * 修复Shapefile中的无效几何
 */
public void fixGeometry(String inputPath, String outputPath) {
    OguLayer layer = SimpleLayerConverter.fromShapefile(
        inputPath, null, null, GisEngineType.GEOTOOLS);
    
    int fixedCount = 0;
    
    for (OguFeature feature : layer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        
        if (!geom.isValid()) {
            // 尝试修复
            Geometry fixed = JtsGeometryUtil.validate(geom);
            if (fixed.isValid()) {
                feature.setWkt(fixed.toText());
                fixedCount++;
            }
        }
    }
    
    SimpleLayerConverter.toShapefile(layer, outputPath, GisEngineType.GEOTOOLS);
    System.out.println("修复了 " + fixedCount + " 个无效几何");
}
```

## 常见问题

### 1. 乱码问题

**原因**：Shapefile编码与读取编码不一致

**解决**：
- 确保源数据有正确的CPG文件
- OGU4J自动检测编码
- 输出时始终使用UTF-8

```java
// 读取时自动处理编码
OguLayer layer = SimpleLayerConverter.fromShapefile(shpPath, null, null, 
    GisEngineType.GEOTOOLS);
// 编码自动检测，无需手动处理
```

### 2. 字段名截断

**原因**：Shapefile字段名限制10字符

**解决**：
- OGU4J自动处理超长字段名
- 建议使用简短的字段名
- 在元数据中保存完整字段名

### 3. 几何无效

**原因**：源数据几何不符合规范

**解决**：
```java
// 读取后检查并修复
for (OguFeature feature : layer.getFeatures()) {
    Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
    if (!geom.isValid()) {
        Geometry fixed = JtsGeometryUtil.validate(geom);
        feature.setWkt(fixed.toText());
    }
}
```

### 4. 大文件处理

**原因**：一次性读取大文件导致内存溢出

**解决**：
- 使用空间过滤分区读取
- 分批处理数据
- 考虑使用数据库存储

```java
// 分区读取
String[] bounds = {"POLYGON(...)", "POLYGON(...)", "..."};
for (String bound : bounds) {
    OguLayer part = SimpleLayerConverter.fromShapefile(
        shpPath, null, bound, GisEngineType.GEOTOOLS);
    // 处理分区数据
    processPart(part);
}
```

### 5. 坐标系丢失

**问题**：输出的Shapefile没有坐标系

**原因**：源数据没有.prj文件

**解决**：
```java
// 设置坐标系后再输出
layer.setWkid(4490);  // 设置CGCS2000
SimpleLayerConverter.toShapefile(layer, outputPath, GisEngineType.GEOTOOLS);
```

## 小结

本章介绍了Shapefile处理的核心内容：

1. **文件结构**：了解.shp、.shx、.dbf、.prj、.cpg文件的作用
2. **编码处理**：自动检测和正确处理字符编码
3. **读写操作**：使用SimpleLayerConverter进行读写
4. **字段处理**：自动处理超长字段名
5. **实践案例**：批量处理、裁剪、合并等常见操作

下一章将介绍GeoJSON格式的处理方法。
