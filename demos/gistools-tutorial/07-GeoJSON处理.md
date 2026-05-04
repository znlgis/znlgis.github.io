---
layout: default
title: GeoJSON处理
---

# GeoJSON处理

## 概述

GeoJSON是基于JSON的地理数据格式，具有良好的可读性和跨平台兼容性，是Web GIS开发中最常用的数据交换格式。

## GeoJSON结构

### 基本结构

GeoJSON由Geometry（几何）和Feature（要素）两个核心概念组成：

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

### 几何类型

GeoJSON支持的几何类型与WKT类似：

```json
// Point
{"type": "Point", "coordinates": [116.397, 39.908]}

// LineString
{"type": "LineString", "coordinates": [[0, 0], [10, 10], [20, 0]]}

// Polygon（外环逆时针，内环顺时针）
{"type": "Polygon", "coordinates": [
  [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
  [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]]
]}

// MultiPoint
{"type": "MultiPoint", "coordinates": [[0, 0], [10, 10]]}

// MultiLineString
{"type": "MultiLineString", "coordinates": [
  [[0, 0], [10, 10]],
  [[20, 20], [30, 30]]
]}

// MultiPolygon
{"type": "MultiPolygon", "coordinates": [
  [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
  [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]
]}
```

### FeatureCollection

多个要素组成的集合：

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

## 格式转换

### WKT与GeoJSON互转

```java
/**
 * WKT转GEOJSON
 */
public static String wkt2Geojson(String wkt) {
    Geometry geometry = wkt2Geometry(wkt);
    return geometry2Geojson(geometry);
}

/**
 * Geometry转GEOJSON
 */
public static String geometry2Geojson(Geometry geometry) {
    GeometryJSON gjson = new GeometryJSON(16);  // 16位小数精度
    StringWriter writer = new StringWriter();
    gjson.write(geometry, writer);
    return writer.toString();
}

/**
 * GEOJSON转WKT
 */
public static String geojson2Wkt(String geojson) {
    Geometry geometry = geojson2Geometry(geojson);
    return geometry2Wkt(geometry);
}

/**
 * GEOJSON转Geometry
 */
public static Geometry geojson2Geometry(String geojson) {
    GeometryJSON gjson = new GeometryJSON(16);
    return gjson.read(new StringReader(geojson));
}
```

### GeoJSON与EsriJSON互转

```java
/**
 * GEOJSON转ESRIJSON
 */
public static String geoJson2EsriJson(int wkid, String geojson) {
    com.esri.core.geometry.Geometry geometry = 
        EsriUtil.createGeometryByGeoJson(geojson);
    return EsriUtil.getEsriJson(wkid, geometry);
}

/**
 * ESRIJSON转GEOJSON
 */
public static String esriJson2GeoJson(String esrijson) {
    com.esri.core.geometry.Geometry geometry = 
        EsriUtil.createGeometryByJson(esrijson);
    return EsriUtil.getGeoJson(geometry);
}
```

## 读取GeoJSON文件

### 使用GeoTools读取

```java
/**
 * GEOJSON文件转换为WktLayer
 */
public static WktLayer fromGeoJSON(String geojsonPath, GisEngineType gisEngineType) {
    gisEngineType = GisEngineType.getGisEngineType(gisEngineType);
    
    if (gisEngineType == GisEngineType.GEOTOOLS) {
        File file = new File(geojsonPath);
        Charset encoding = EncodingUtil.getFileEncoding(file);
        String geojsonString = FileUtil.readString(file, encoding);
        
        GeometryJSON gjson = new GeometryJSON(16);
        FeatureJSON fjson = new FeatureJSON(gjson);
        
        // 读取Schema
        SimpleFeatureType simpleFeatureType = 
            fjson.readFeatureCollectionSchema(geojsonString, true);
        
        // 读取要素
        ListFeatureCollection featureCollection = 
            new ListFeatureCollection(simpleFeatureType);
        try (FeatureIterator<SimpleFeature> features = 
                fjson.streamFeatureCollection(geojsonString)) {
            while (features.hasNext()) {
                featureCollection.add(features.next());
            }
        }
        
        return fromSimpleFeatureCollection(featureCollection);
    }
    
    return null;
}
```

### 使用GDAL读取

```java
/**
 * 使用GDAL读取GeoJSON
 */
public static WktLayer fromGeoJSONWithGDAL(String geojsonPath) {
    String layerName = FileUtil.mainName(geojsonPath);
    return OgrUtil.layer2WktLayer(DataFormatType.GEOJSON, geojsonPath, 
        layerName, null, null);
}
```

## 写入GeoJSON文件

### 使用GeoTools写入

```java
/**
 * WktLayer转换为GEOJSON文件
 */
public static void toGeoJSON(WktLayer wktLayer, String geojsonPath, 
        GisEngineType gisEngineType) {
    wktLayer.check();
    EsriUtil.excludeSpecialFields(wktLayer.getFields());
    
    gisEngineType = GisEngineType.getGisEngineType(gisEngineType);
    
    if (gisEngineType == GisEngineType.GEOTOOLS) {
        SimpleFeatureCollection featureCollection = 
            toSimpleFeatureCollection(wktLayer);
            
        GeometryJSON gjson = new GeometryJSON(16);
        FeatureJSON fjson = new FeatureJSON(gjson);
        
        // 设置坐标系
        CoordinateReferenceSystem crs = 
            featureCollection.getSchema().getCoordinateReferenceSystem();
        if (crs != null) {
            Integer wkid = CrsUtil.standardizeCRS(crs).getKey();
            featureCollection = new ForceCoordinateSystemFeatureResults(
                featureCollection, CrsUtil.getSupportedCRS(wkid).getValue(), false);
        }
        
        String geojsonString = fjson.toString(featureCollection);
        FileUtil.writeString(geojsonString, geojsonPath, "utf-8");
    }
}
```

### 使用GDAL写入

```java
/**
 * 使用GDAL写入GeoJSON
 */
public static void toGeoJSONWithGDAL(WktLayer wktLayer, String geojsonPath) {
    String layerName = FileUtil.mainName(geojsonPath);
    OgrUtil.wktLayer2Layer(DataFormatType.GEOJSON, geojsonPath, 
        wktLayer, layerName, null);
}
```

## 数据模型转换

### WktLayer转SimpleFeatureCollection

```java
/**
 * WktLayer转换为GeoTools SimpleFeatureCollection
 */
public static SimpleFeatureCollection toSimpleFeatureCollection(WktLayer wktLayer) {
    // 创建要素类型
    SimpleFeatureTypeBuilder tb = new SimpleFeatureTypeBuilder();
    tb.setCRS(CrsUtil.getSupportedCRS(wktLayer.getWkid()).getValue());
    tb.setName(wktLayer.getYwName());
    tb.setDefaultGeometry("shape");
    tb.add("shape", wktLayer.getGeometryType().getTypeClass());
    
    // 处理字段（去重并设置类型）
    LinkedHashMap<String, FieldDataType> fieldMap = new LinkedHashMap<>();
    wktLayer.getFields().forEach(ff -> {
        if (!fieldMap.containsKey(ff.getYwName())) {
            fieldMap.put(ff.getYwName(), ff.getDataType());
        } else {
            if (fieldMap.get(ff.getYwName()) == null && ff.getDataType() != null) {
                fieldMap.put(ff.getYwName(), ff.getDataType());
            }
        }
    });
    
    // 添加字段定义
    fieldMap.forEach((k, v) -> {
        if (v != null) {
            tb.add(k, v.getTypeClass());
        } else {
            tb.add(k, String.class);
        }
    });
    
    SimpleFeatureType featureType = tb.buildFeatureType();
    
    // 创建要素集合
    ListFeatureCollection featureCollection = new ListFeatureCollection(featureType);
    for (WktFeature f : wktLayer.getFeatures()) {
        SimpleFeatureBuilder builder = new SimpleFeatureBuilder(featureType);
        
        // 设置几何
        if (CharSequenceUtil.isNotBlank(f.getWkt())) {
            builder.set("shape", GeometryConverter.wkt2Geometry(f.getWkt()));
        } else {
            builder.set("shape", null);
        }
        
        // 设置属性
        wktLayer.getFields().forEach(ff -> {
            Optional<WktFieldValue> optional = f.getFieldValues().stream()
                .filter(m -> CharSequenceUtil.equals(
                    m.getField().getYwName(), ff.getYwName(), true))
                .findFirst();
            optional.ifPresent(wktFieldValue -> 
                builder.set(wktFieldValue.getField().getYwName(), 
                    wktFieldValue.getValue()));
        });
        
        featureCollection.add(builder.buildFeature(null));
    }
    
    return featureCollection;
}
```

### SimpleFeatureCollection转WktLayer

```java
/**
 * GeoTools SimpleFeatureCollection转换为WktLayer
 */
public static WktLayer fromSimpleFeatureCollection(
        SimpleFeatureCollection featureCollection) {
    WktLayer wktLayer = new WktLayer();
    SimpleFeatureType featureType = featureCollection.getSchema();
    
    // 图层名称
    wktLayer.setYwName(featureType.getName().getLocalPart());
    
    // 坐标系
    CoordinateReferenceSystem crs = featureType.getCoordinateReferenceSystem();
    Map.Entry<Integer, CoordinateReferenceSystem> entry = CrsUtil.standardizeCRS(crs);
    wktLayer.setWkid(entry.getKey());
    wktLayer.setTolerance(CrsUtil.getTolerance(entry.getValue()));
    
    // 几何类型
    Class<?> binding = featureType.getGeometryDescriptor().getType().getBinding();
    if (binding != null) {
        wktLayer.setGeometryType(GeometryType.valueOfByTypeClass(binding));
    }
    
    // 字段定义
    List<WktField> wktFields = new ArrayList<>();
    for (int i = 0; i < featureType.getAttributeCount(); i++) {
        if (featureType.getDescriptor(i) instanceof GeometryDescriptor) {
            continue;
        }
        WktField wktField = new WktField();
        wktField.setYwName(featureType.getDescriptor(i).getLocalName());
        wktField.setZwName(featureType.getDescriptor(i).getLocalName());
        wktField.setDataType(FieldDataType.fieldDataTypeByTypeClass(
            featureType.getDescriptor(i).getType().getBinding()));
        wktFields.add(wktField);
    }
    wktLayer.setFields(wktFields);
    
    // 读取要素
    List<WktFeature> wktFeatures = new ArrayList<>();
    try (FeatureIterator<SimpleFeature> features = featureCollection.features()) {
        while (features.hasNext()) {
            SimpleFeature feature = features.next();
            WktFeature wktFeature = new WktFeature();
            
            // ID
            String id = feature.getID();
            if (CharSequenceUtil.isBlank(id)) {
                id = IdUtil.simpleUUID();
            }
            wktFeature.setWfId(id);
            
            // 几何
            String wkt = ((Geometry) feature.getDefaultGeometry()).toText();
            wktFeature.setWkt(ESRIGeometryUtil.simplify(wkt, wktLayer.getWkid()));
            
            // 属性
            List<WktFieldValue> wktFieldValues = new ArrayList<>();
            for (int i = 0; i < feature.getAttributeCount(); i++) {
                String fn = featureType.getDescriptor(i).getLocalName();
                WktField wktField = wktFields.stream()
                    .filter(f -> CharSequenceUtil.equals(f.getYwName(), fn, true))
                    .findFirst().orElse(null);
                if (wktField != null) {
                    WktFieldValue wktFieldValue = new WktFieldValue();
                    wktFieldValue.setField(wktField);
                    wktFieldValue.setValue(feature.getAttribute(fn));
                    wktFieldValues.add(wktFieldValue);
                }
            }
            wktFeature.setFieldValues(wktFieldValues);
            wktFeatures.add(wktFeature);
        }
    }
    
    wktLayer.setFeatures(wktFeatures);
    wktLayer.check();
    return wktLayer;
}
```

## 实践案例

### 案例1：Shapefile转GeoJSON

常见的格式转换需求：

```java
/**
 * Shapefile转GeoJSON
 */
public void shp2GeoJson(String shpPath, String geojsonPath) {
    // 读取Shapefile
    WktLayer layer = WktLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 转换坐标系为WGS84（Web地图常用）
    // CGCS2000(4490)与WGS84差异极小，一般可以直接用
    
    // 写入GeoJSON
    WktLayerConverter.toGeoJSON(layer, geojsonPath, GisEngineType.GEOTOOLS);
}
```

### 案例2：合并多个GeoJSON

```java
/**
 * 合并多个GeoJSON文件
 */
public void mergeGeoJson(List<String> inputPaths, String outputPath) {
    List<WktFeature> allFeatures = new ArrayList<>();
    WktLayer template = null;
    
    for (String inputPath : inputPaths) {
        WktLayer layer = WktLayerConverter.fromGeoJSON(inputPath, GisEngineType.GEOTOOLS);
        
        if (template == null) {
            template = layer;
        }
        
        allFeatures.addAll(layer.getFeatures());
    }
    
    if (template != null) {
        template.setFeatures(allFeatures);
        WktLayerConverter.toGeoJSON(template, outputPath, GisEngineType.GEOTOOLS);
    }
}
```

### 案例3：GeoJSON简化（减小文件体积）

```java
/**
 * 简化GeoJSON（减小文件体积）
 */
public void simplifyGeoJson(String inputPath, String outputPath, double tolerance) {
    WktLayer layer = WktLayerConverter.fromGeoJSON(inputPath, GisEngineType.GEOTOOLS);
    
    for (WktFeature feature : layer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        Geometry simplified = JTSGeometryUtil.simplify(geom, tolerance);
        feature.setWkt(simplified.toText());
    }
    
    WktLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例4：GeoJSON字段筛选

只保留需要的字段，减小文件体积：

```java
/**
 * 筛选GeoJSON字段
 */
public void filterGeoJsonFields(String inputPath, String outputPath, 
        List<String> keepFields) {
    WktLayer layer = WktLayerConverter.fromGeoJSON(inputPath, GisEngineType.GEOTOOLS);
    
    // 筛选字段定义
    List<WktField> filteredFields = layer.getFields().stream()
        .filter(f -> keepFields.contains(f.getYwName()))
        .collect(Collectors.toList());
    layer.setFields(filteredFields);
    
    // 筛选要素属性
    for (WktFeature feature : layer.getFeatures()) {
        List<WktFieldValue> filteredValues = feature.getFieldValues().stream()
            .filter(v -> keepFields.contains(v.getField().getYwName()))
            .collect(Collectors.toList());
        feature.setFieldValues(filteredValues);
    }
    
    WktLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例5：坐标精度控制

控制输出坐标的精度，减小文件体积：

```java
/**
 * 控制坐标精度
 */
public void reduceCoordinatePrecision(String inputPath, String outputPath, 
        int decimalPlaces) {
    WktLayer layer = WktLayerConverter.fromGeoJSON(inputPath, GisEngineType.GEOTOOLS);
    
    // 使用PrecisionModel控制精度
    double scale = Math.pow(10, decimalPlaces);
    PrecisionModel pm = new PrecisionModel(scale);
    GeometryFactory factory = new GeometryFactory(pm);
    
    for (WktFeature feature : layer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        
        // 重新创建几何，应用新的精度模型
        Geometry reducedGeom = factory.createGeometry(geom);
        GeometryPrecisionReducer reducer = new GeometryPrecisionReducer(pm);
        reducedGeom = reducer.reduce(geom);
        
        feature.setWkt(reducedGeom.toText());
    }
    
    WktLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
}
```

### 案例6：GeoJSON与前端交互

生成适合前端展示的GeoJSON：

```java
/**
 * 生成Web展示用的GeoJSON
 */
public String prepareForWeb(WktLayer layer) {
    // 1. 确保使用WGS84坐标系
    if (layer.getWkid() != 4490 && layer.getWkid() != 4326) {
        layer = CrsUtil.reproject(layer, 4490);
    }
    
    // 2. 简化几何（根据显示比例尺确定容差）
    double tolerance = 0.0001;  // 约11米
    for (WktFeature feature : layer.getFeatures()) {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        if (geom.getNumPoints() > 100) {
            Geometry simplified = JTSGeometryUtil.simplify(geom, tolerance);
            feature.setWkt(simplified.toText());
        }
    }
    
    // 3. 转换为GeoJSON
    SimpleFeatureCollection fc = WktLayerConverter.toSimpleFeatureCollection(layer);
    GeometryJSON gjson = new GeometryJSON(6);  // 6位小数足够Web显示
    FeatureJSON fjson = new FeatureJSON(gjson);
    
    return fjson.toString(fc);
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
2. **格式转换**：WKT、GeoJSON、EsriJSON互转
3. **读写操作**：使用GeoTools和GDAL读写GeoJSON文件
4. **数据模型**：WktLayer与SimpleFeatureCollection互转
5. **优化技巧**：简化、字段筛选、精度控制

下一章将介绍PostGIS数据库的交互操作。
