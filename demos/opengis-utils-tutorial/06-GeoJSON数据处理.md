# GeoJSON数据处理

## 概述

GeoJSON是基于JSON的地理数据格式，具有良好的可读性和跨平台兼容性，是Web GIS开发中最常用的数据交换格式。本章介绍如何使用OGU4J处理GeoJSON数据。

## GeoJSON结构

### 几何对象

```json
{
  "type": "Point",
  "coordinates": [116.397, 39.908]
}
```

支持的几何类型：
- Point：点
- LineString：线
- Polygon：多边形
- MultiPoint：多点
- MultiLineString：多线
- MultiPolygon：多面
- GeometryCollection：几何集合

### Feature（要素）

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [116.397, 39.908]
  },
  "properties": {
    "name": "天安门",
    "type": "landmark"
  }
}
```

### FeatureCollection（要素集合）

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {...},
      "properties": {...}
    },
    {
      "type": "Feature",
      "geometry": {...},
      "properties": {...}
    }
  ]
}
```

## 读取GeoJSON

### 基本读取

```java
/**
 * 读取GeoJSON文件为OguLayer
 */
OguLayer layer = SimpleLayerConverter.fromGeoJSON(
    "data/points.geojson",    // 文件路径
    GisEngineType.GEOTOOLS    // 使用的引擎
);

// 使用图层数据
System.out.println("要素数量: " + layer.getFeatures().size());
for (OguFeature feature : layer.getFeatures()) {
    String name = feature.getAttribute("name").getStringValue();
    System.out.println(name);
}
```

### 从字符串读取

```java
// GeoJSON字符串
String geojsonStr = "{\"type\":\"FeatureCollection\",\"features\":[...]}";

// 先保存为临时文件，再读取
Path tempFile = Files.createTempFile("temp", ".geojson");
Files.writeString(tempFile, geojsonStr);

OguLayer layer = SimpleLayerConverter.fromGeoJSON(
    tempFile.toString(), GisEngineType.GEOTOOLS);

// 删除临时文件
Files.delete(tempFile);
```

### 使用GDAL引擎读取

```java
OguLayer layer = SimpleLayerConverter.fromGeoJSON(
    "data/points.geojson",
    GisEngineType.GDAL  // 使用GDAL引擎
);
```

## 写入GeoJSON

### 基本写入

```java
/**
 * 将OguLayer写入GeoJSON文件
 */
SimpleLayerConverter.toGeoJSON(
    layer,                    // 图层数据
    "output/result.geojson",  // 输出路径
    GisEngineType.GEOTOOLS    // 使用的引擎
);
```

### 精度控制

写入时可以控制坐标精度以减小文件体积：

```java
// 简化几何后再写入
for (OguFeature feature : layer.getFeatures()) {
    Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
    
    // 简化复杂几何
    if (geom.getNumPoints() > 1000) {
        geom = JtsGeometryUtil.simplify(geom, 0.0001);
        feature.setWkt(geom.toText());
    }
}

SimpleLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
```

## 格式转换

### Shapefile转GeoJSON

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

### GeoJSON转Shapefile

```java
/**
 * GeoJSON转Shapefile
 */
public void geoJson2Shp(String geojsonPath, String shpPath) {
    // 读取GeoJSON
    OguLayer layer = SimpleLayerConverter.fromGeoJSON(
        geojsonPath, GisEngineType.GEOTOOLS);
    
    // 写入Shapefile
    SimpleLayerConverter.toShapefile(layer, shpPath, GisEngineType.GEOTOOLS);
}
```

### 几何格式转换

```java
// WKT转GeoJSON
String wkt = "POINT (116.397 39.908)";
String geojson = GeometryConverter.wkt2Geojson(wkt);
// 结果: {"type":"Point","coordinates":[116.397,39.908]}

// GeoJSON转WKT
String geojson = "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}";
String wkt = GeometryConverter.geojson2Wkt(geojson);
// 结果: POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))
```

## 实践案例

### 案例1：合并多个GeoJSON

```java
/**
 * 合并多个GeoJSON文件
 */
public void mergeGeoJson(List<String> inputPaths, String outputPath) {
    List<OguFeature> allFeatures = new ArrayList<>();
    OguLayer template = null;
    
    for (String inputPath : inputPaths) {
        OguLayer layer = SimpleLayerConverter.fromGeoJSON(
            inputPath, GisEngineType.GEOTOOLS);
        
        if (template == null) {
            template = layer;
        }
        
        allFeatures.addAll(layer.getFeatures());
    }
    
    if (template != null) {
        template.setFeatures(allFeatures);
        SimpleLayerConverter.toGeoJSON(template, outputPath, GisEngineType.GEOTOOLS);
    }
}
```

### 案例2：GeoJSON简化

```java
/**
 * 简化GeoJSON（减小文件体积）
 */
public void simplifyGeoJson(String inputPath, String outputPath, double tolerance) {
    OguLayer layer = SimpleLayerConverter.fromGeoJSON(
        inputPath, GisEngineType.GEOTOOLS);
    
    for (OguFeature feature : layer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        Geometry simplified = JtsGeometryUtil.simplify(geom, tolerance);
        feature.setWkt(simplified.toText());
    }
    
    SimpleLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例3：字段筛选

```java
/**
 * 只保留需要的字段
 */
public void filterFields(String inputPath, String outputPath, 
        List<String> keepFields) {
    OguLayer layer = SimpleLayerConverter.fromGeoJSON(
        inputPath, GisEngineType.GEOTOOLS);
    
    // 筛选字段定义
    List<OguField> filteredFields = layer.getFields().stream()
        .filter(f -> keepFields.contains(f.getYwName()))
        .collect(Collectors.toList());
    layer.setFields(filteredFields);
    
    // 筛选要素属性
    for (OguFeature feature : layer.getFeatures()) {
        List<OguFieldValue> filteredValues = feature.getFieldValues().stream()
            .filter(v -> keepFields.contains(v.getField().getYwName()))
            .collect(Collectors.toList());
        feature.setFieldValues(filteredValues);
    }
    
    SimpleLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例4：坐标转换

```java
/**
 * 转换GeoJSON坐标系
 */
public void reprojectGeoJson(String inputPath, String outputPath, 
        Integer targetWkid) {
    OguLayer layer = SimpleLayerConverter.fromGeoJSON(
        inputPath, GisEngineType.GEOTOOLS);
    
    // 坐标转换
    if (!layer.getWkid().equals(targetWkid)) {
        layer = CrsUtil.reproject(layer, targetWkid);
    }
    
    SimpleLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例5：Web展示优化

```java
/**
 * 优化GeoJSON用于Web展示
 */
public String prepareForWeb(OguLayer layer) {
    // 1. 确保使用WGS84/CGCS2000经纬度
    if (CrsUtil.isProjectedCRS(layer.getWkid())) {
        layer = CrsUtil.reproject(layer, 4490);
    }
    
    // 2. 简化复杂几何
    double tolerance = 0.0001;  // 约11米
    for (OguFeature feature : layer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        if (geom.getNumPoints() > 100) {
            Geometry simplified = JtsGeometryUtil.simplify(geom, tolerance);
            feature.setWkt(simplified.toText());
        }
    }
    
    // 3. 保存为临时文件并读取内容
    Path tempFile = Files.createTempFile("web", ".geojson");
    SimpleLayerConverter.toGeoJSON(layer, tempFile.toString(), GisEngineType.GEOTOOLS);
    String result = Files.readString(tempFile);
    Files.delete(tempFile);
    
    return result;
}
```

### 案例6：要素筛选

```java
/**
 * 按属性筛选要素
 */
public void filterFeatures(String inputPath, String outputPath, 
        Predicate<OguFeature> filter) {
    OguLayer layer = SimpleLayerConverter.fromGeoJSON(
        inputPath, GisEngineType.GEOTOOLS);
    
    // 使用filter函数过滤
    List<OguFeature> filtered = layer.getFeatures().stream()
        .filter(filter)
        .collect(Collectors.toList());
    
    layer.setFeatures(filtered);
    
    SimpleLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}

// 使用示例
filterFeatures("input.geojson", "output.geojson", 
    feature -> {
        Double area = feature.getAttribute("AREA").getDoubleValue();
        return area != null && area > 1000;
    });
```

### 案例7：空间裁剪

```java
/**
 * 按边界裁剪GeoJSON
 */
public void clipGeoJson(String inputPath, String boundaryWkt, String outputPath) {
    OguLayer layer = SimpleLayerConverter.fromGeoJSON(
        inputPath, GisEngineType.GEOTOOLS);
    
    Geometry boundary = GeometryConverter.wkt2Geometry(boundaryWkt);
    
    List<OguFeature> clipped = new ArrayList<>();
    for (OguFeature feature : layer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        
        if (geom.intersects(boundary)) {
            Geometry result = geom.intersection(boundary);
            if (!result.isEmpty()) {
                OguFeature f = new OguFeature();
                f.setWfId(feature.getWfId());
                f.setWkt(result.toText());
                f.setFieldValues(feature.getFieldValues());
                clipped.add(f);
            }
        }
    }
    
    layer.setFeatures(clipped);
    SimpleLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

## GeoJSON的优缺点

### 优点

1. **可读性好**：JSON格式，易于阅读和调试
2. **跨平台**：几乎所有编程语言都支持JSON
3. **Web友好**：与JavaScript天然契合
4. **无字段限制**：字段名长度无限制
5. **单文件**：一个文件包含所有信息

### 缺点

1. **文件体积大**：文本格式比二进制格式大
2. **解析性能**：大数据量时解析较慢
3. **精度问题**：浮点数精度可能有损失
4. **无空间索引**：查询效率不如数据库

### 使用建议

- **适合场景**：Web展示、数据交换、小规模数据
- **不适合场景**：大数据量存储、高性能查询

## 小结

本章介绍了GeoJSON处理的核心内容：

1. **数据结构**：Geometry、Feature、FeatureCollection
2. **读写操作**：使用SimpleLayerConverter进行读写
3. **格式转换**：与Shapefile、WKT等格式互转
4. **优化技巧**：简化、字段筛选、精度控制
5. **实践案例**：合并、裁剪、Web优化等

下一章将介绍PostGIS数据库的交互操作。
