---
layout: post
title: 第08章 - GeoJSON处理实战
date: 2024-04-08 10:00:00 +0800
categories: [GIS, GeoTools]
tags: [GeoTools, GeoJSON, 数据交换, JSON]
---

# 第08章 - GeoJSON处理实战

## 8.1 GeoJSON 格式概述

### 8.1.1 GeoJSON 结构

GeoJSON 是一种基于 JSON 的地理数据交换格式，由 RFC 7946 标准定义。

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [116.4074, 39.9042]
      },
      "properties": {
        "name": "北京",
        "population": 21540000
      }
    }
  ]
}
```

### 8.1.2 几何类型

GeoJSON 支持以下几何类型：

| 类型 | 说明 | 坐标示例 |
|------|------|----------|
| Point | 点 | [x, y] |
| MultiPoint | 多点 | [[x1,y1], [x2,y2]] |
| LineString | 线串 | [[x1,y1], [x2,y2], [x3,y3]] |
| MultiLineString | 多线串 | [[[x1,y1], [x2,y2]], [[x3,y3], [x4,y4]]] |
| Polygon | 多边形 | [[[x1,y1], [x2,y2], [x3,y3], [x1,y1]]] |
| MultiPolygon | 多多边形 | [[[[x1,y1], ...]]] |
| GeometryCollection | 几何集合 | {"geometries": [...]} |

## 8.2 读取 GeoJSON

### 8.2.1 使用 FeatureJSON

```java
import org.geotools.geojson.feature.FeatureJSON;
import org.geotools.geojson.geom.GeometryJSON;

public class GeoJSONReader {
    
    public static void readGeoJSON(String path) throws Exception {
        File file = new File(path);
        
        // 创建 FeatureJSON（15位小数精度）
        FeatureJSON featureJSON = new FeatureJSON(15);
        
        // 读取 FeatureCollection
        try (FileInputStream in = new FileInputStream(file)) {
            SimpleFeatureCollection fc = 
                (SimpleFeatureCollection) featureJSON.readFeatureCollection(in);
            
            System.out.println("要素数量: " + fc.size());
            System.out.println("要素类型: " + fc.getSchema().getTypeName());
            
            // 遍历要素
            try (SimpleFeatureIterator iter = fc.features()) {
                while (iter.hasNext()) {
                    SimpleFeature feature = iter.next();
                    System.out.printf("%s: %s%n",
                        feature.getID(),
                        feature.getAttribute("name"));
                }
            }
        }
    }
    
    // 从字符串读取
    public static SimpleFeatureCollection readFromString(String json) throws Exception {
        FeatureJSON featureJSON = new FeatureJSON();
        try (StringReader reader = new StringReader(json)) {
            return (SimpleFeatureCollection) featureJSON.readFeatureCollection(reader);
        }
    }
    
    // 读取单个 Feature
    public static SimpleFeature readFeature(String json) throws Exception {
        FeatureJSON featureJSON = new FeatureJSON();
        try (StringReader reader = new StringReader(json)) {
            return featureJSON.readFeature(reader);
        }
    }
    
    // 读取几何
    public static Geometry readGeometry(String json) throws Exception {
        GeometryJSON geometryJSON = new GeometryJSON();
        try (StringReader reader = new StringReader(json)) {
            return geometryJSON.read(reader);
        }
    }
}
```

### 8.2.2 使用 GeoJSONDataStore

```java
import org.geotools.data.geojson.GeoJSONDataStore;
import org.geotools.data.geojson.GeoJSONDataStoreFactory;

public class GeoJSONDataStoreExample {
    
    public static void readWithDataStore(String path) throws Exception {
        // 方式1：直接创建
        GeoJSONDataStore store = new GeoJSONDataStore(new File(path).toURI().toURL());
        
        // 方式2：通过工厂
        GeoJSONDataStoreFactory factory = new GeoJSONDataStoreFactory();
        Map<String, Object> params = new HashMap<>();
        params.put("url", new File(path).toURI().toURL());
        DataStore store2 = factory.createDataStore(params);
        
        try {
            String[] typeNames = store.getTypeNames();
            System.out.println("图层: " + Arrays.toString(typeNames));
            
            SimpleFeatureSource source = store.getFeatureSource(typeNames[0]);
            SimpleFeatureCollection features = source.getFeatures();
            
            System.out.println("要素数: " + features.size());
            System.out.println("边界: " + source.getBounds());
            
        } finally {
            store.dispose();
        }
    }
}
```

### 8.2.3 从URL读取

```java
public class GeoJSONURLReader {
    
    public static SimpleFeatureCollection readFromURL(String urlString) throws Exception {
        URL url = new URL(urlString);
        FeatureJSON featureJSON = new FeatureJSON();
        
        try (InputStream in = url.openStream()) {
            return (SimpleFeatureCollection) featureJSON.readFeatureCollection(in);
        }
    }
    
    // 带超时的读取
    public static SimpleFeatureCollection readWithTimeout(String urlString, int timeout) 
            throws Exception {
        
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(timeout);
        conn.setReadTimeout(timeout);
        
        FeatureJSON featureJSON = new FeatureJSON();
        
        try (InputStream in = conn.getInputStream()) {
            return (SimpleFeatureCollection) featureJSON.readFeatureCollection(in);
        } finally {
            conn.disconnect();
        }
    }
}
```

## 8.3 写入 GeoJSON

### 8.3.1 写入文件

```java
public class GeoJSONWriter {
    
    public static void writeToFile(SimpleFeatureCollection fc, String path) 
            throws Exception {
        
        FeatureJSON featureJSON = new FeatureJSON();
        featureJSON.setEncodeFeatureCollectionBounds(true);
        featureJSON.setEncodeFeatureCollectionCRS(true);
        
        try (FileWriter writer = new FileWriter(path)) {
            featureJSON.writeFeatureCollection(fc, writer);
        }
        
        System.out.println("写入完成: " + path);
    }
    
    // 写入字符串
    public static String writeToString(SimpleFeatureCollection fc) throws Exception {
        FeatureJSON featureJSON = new FeatureJSON();
        
        StringWriter writer = new StringWriter();
        featureJSON.writeFeatureCollection(fc, writer);
        return writer.toString();
    }
    
    // 写入单个要素
    public static String writeFeature(SimpleFeature feature) throws Exception {
        FeatureJSON featureJSON = new FeatureJSON();
        
        StringWriter writer = new StringWriter();
        featureJSON.writeFeature(feature, writer);
        return writer.toString();
    }
    
    // 写入几何
    public static String writeGeometry(Geometry geometry) throws Exception {
        GeometryJSON geometryJSON = new GeometryJSON();
        
        StringWriter writer = new StringWriter();
        geometryJSON.write(geometry, writer);
        return writer.toString();
    }
}
```

### 8.3.2 自定义精度

```java
public class GeoJSONPrecision {
    
    public static void writeWithPrecision(SimpleFeatureCollection fc, String path, 
            int decimals) throws Exception {
        
        // 指定小数位数
        FeatureJSON featureJSON = new FeatureJSON(decimals);
        
        try (FileWriter writer = new FileWriter(path)) {
            featureJSON.writeFeatureCollection(fc, writer);
        }
    }
    
    // 比较不同精度
    public static void comparePrecision() throws Exception {
        GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();
        Point point = gf.createPoint(new Coordinate(116.40743243243243, 39.90423213214));
        
        // 不同精度
        int[] precisions = {3, 6, 9, 15};
        
        for (int p : precisions) {
            GeometryJSON gj = new GeometryJSON(p);
            StringWriter writer = new StringWriter();
            gj.write(point, writer);
            System.out.printf("精度 %d: %s%n", p, writer);
        }
    }
}
```

## 8.4 GeoJSON 转换

### 8.4.1 Shapefile 与 GeoJSON 互转

```java
public class GeoJSONConverter {
    
    // Shapefile -> GeoJSON
    public static void shpToGeoJSON(String shpPath, String jsonPath) throws Exception {
        File shpFile = new File(shpPath);
        FileDataStore store = FileDataStoreFinder.getDataStore(shpFile);
        
        try {
            SimpleFeatureCollection fc = store.getFeatureSource().getFeatures();
            
            FeatureJSON featureJSON = new FeatureJSON();
            featureJSON.setEncodeFeatureCollectionCRS(true);
            
            try (FileWriter writer = new FileWriter(jsonPath)) {
                featureJSON.writeFeatureCollection(fc, writer);
            }
            
        } finally {
            store.dispose();
        }
    }
    
    // GeoJSON -> Shapefile
    public static void geoJSONToShp(String jsonPath, String shpPath) throws Exception {
        // 读取 GeoJSON
        FeatureJSON featureJSON = new FeatureJSON();
        SimpleFeatureCollection fc;
        
        try (FileReader reader = new FileReader(jsonPath)) {
            fc = (SimpleFeatureCollection) featureJSON.readFeatureCollection(reader);
        }
        
        // 创建 Shapefile
        File shpFile = new File(shpPath);
        ShapefileDataStoreFactory factory = new ShapefileDataStoreFactory();
        
        Map<String, Object> params = new HashMap<>();
        params.put("url", shpFile.toURI().toURL());
        params.put("create spatial index", true);
        
        ShapefileDataStore store = (ShapefileDataStore) factory.createNewDataStore(params);
        
        try {
            // 处理属性名长度（Shapefile限制10字符）
            SimpleFeatureType originalType = fc.getSchema();
            SimpleFeatureTypeBuilder typeBuilder = new SimpleFeatureTypeBuilder();
            typeBuilder.setName(shpFile.getName().replace(".shp", ""));
            typeBuilder.setCRS(originalType.getCoordinateReferenceSystem());
            
            for (AttributeDescriptor desc : originalType.getAttributeDescriptors()) {
                String name = desc.getLocalName();
                if (name.length() > 10) {
                    name = name.substring(0, 10);
                }
                typeBuilder.add(name, desc.getType().getBinding());
            }
            
            SimpleFeatureType shpType = typeBuilder.buildFeatureType();
            store.createSchema(shpType);
            
            // 写入数据
            SimpleFeatureStore featureStore = 
                (SimpleFeatureStore) store.getFeatureSource(store.getTypeNames()[0]);
            
            Transaction transaction = new DefaultTransaction("convert");
            featureStore.setTransaction(transaction);
            
            try {
                // 转换要素
                DefaultFeatureCollection converted = new DefaultFeatureCollection();
                SimpleFeatureBuilder builder = new SimpleFeatureBuilder(shpType);
                
                try (SimpleFeatureIterator iter = fc.features()) {
                    while (iter.hasNext()) {
                        SimpleFeature f = iter.next();
                        for (int i = 0; i < f.getAttributeCount(); i++) {
                            builder.add(f.getAttribute(i));
                        }
                        converted.add(builder.buildFeature(null));
                    }
                }
                
                featureStore.addFeatures(converted);
                transaction.commit();
                
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

### 8.4.2 WKT 与 GeoJSON 互转

```java
public class WKTGeoJSONConverter {
    
    // WKT -> GeoJSON
    public static String wktToGeoJSON(String wkt) throws Exception {
        WKTReader wktReader = new WKTReader();
        Geometry geometry = wktReader.read(wkt);
        
        GeometryJSON geometryJSON = new GeometryJSON();
        StringWriter writer = new StringWriter();
        geometryJSON.write(geometry, writer);
        
        return writer.toString();
    }
    
    // GeoJSON -> WKT
    public static String geoJSONToWKT(String json) throws Exception {
        GeometryJSON geometryJSON = new GeometryJSON();
        Geometry geometry = geometryJSON.read(new StringReader(json));
        
        WKTWriter wktWriter = new WKTWriter();
        return wktWriter.write(geometry);
    }
}
```

## 8.5 处理复杂 GeoJSON

### 8.5.1 嵌套属性

```java
public class NestedGeoJSON {
    
    // GeoJSON 可能包含嵌套的 properties
    public static void handleNestedProperties(String json) throws Exception {
        // 使用 Jackson 解析
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(json);
        
        if (root.has("features")) {
            for (JsonNode feature : root.get("features")) {
                JsonNode properties = feature.get("properties");
                
                // 扁平化嵌套属性
                Map<String, Object> flatProps = flattenJson("", properties);
                
                for (Map.Entry<String, Object> entry : flatProps.entrySet()) {
                    System.out.println(entry.getKey() + ": " + entry.getValue());
                }
            }
        }
    }
    
    private static Map<String, Object> flattenJson(String prefix, JsonNode node) {
        Map<String, Object> result = new LinkedHashMap<>();
        
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String key = prefix.isEmpty() ? field.getKey() : prefix + "_" + field.getKey();
                result.putAll(flattenJson(key, field.getValue()));
            }
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                result.putAll(flattenJson(prefix + "_" + i, node.get(i)));
            }
        } else {
            if (node.isNumber()) {
                result.put(prefix, node.numberValue());
            } else if (node.isBoolean()) {
                result.put(prefix, node.booleanValue());
            } else {
                result.put(prefix, node.asText());
            }
        }
        
        return result;
    }
}
```

### 8.5.2 处理大 GeoJSON 文件

```java
public class LargeGeoJSONProcessor {
    
    // 流式处理大文件
    public static void processLargeFile(String path, FeatureProcessor processor) 
            throws Exception {
        
        ObjectMapper mapper = new ObjectMapper();
        JsonFactory factory = mapper.getFactory();
        
        try (JsonParser parser = factory.createParser(new File(path))) {
            // 找到 features 数组
            while (!parser.isClosed()) {
                JsonToken token = parser.nextToken();
                
                if (token == JsonToken.FIELD_NAME && "features".equals(parser.getCurrentName())) {
                    parser.nextToken(); // 进入数组
                    
                    // 逐个处理 feature
                    while (parser.nextToken() != JsonToken.END_ARRAY) {
                        JsonNode featureNode = mapper.readTree(parser);
                        SimpleFeature feature = nodeToFeature(featureNode);
                        processor.process(feature);
                    }
                }
            }
        }
    }
    
    private static SimpleFeature nodeToFeature(JsonNode node) throws Exception {
        // 解析几何
        String geomJson = node.get("geometry").toString();
        GeometryJSON geometryJSON = new GeometryJSON();
        Geometry geometry = geometryJSON.read(new StringReader(geomJson));
        
        // 解析属性
        JsonNode props = node.get("properties");
        Map<String, Object> attributes = new LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = props.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            attributes.put(field.getKey(), getValue(field.getValue()));
        }
        
        // 构建要素类型
        SimpleFeatureTypeBuilder typeBuilder = new SimpleFeatureTypeBuilder();
        typeBuilder.setName("Feature");
        typeBuilder.add("geometry", geometry.getClass());
        for (Map.Entry<String, Object> attr : attributes.entrySet()) {
            typeBuilder.add(attr.getKey(), 
                attr.getValue() != null ? attr.getValue().getClass() : String.class);
        }
        
        SimpleFeatureType type = typeBuilder.buildFeatureType();
        SimpleFeatureBuilder builder = new SimpleFeatureBuilder(type);
        
        builder.add(geometry);
        for (Object value : attributes.values()) {
            builder.add(value);
        }
        
        String id = node.has("id") ? node.get("id").asText() : null;
        return builder.buildFeature(id);
    }
    
    private static Object getValue(JsonNode node) {
        if (node.isNumber()) return node.numberValue();
        if (node.isBoolean()) return node.booleanValue();
        if (node.isNull()) return null;
        return node.asText();
    }
    
    public interface FeatureProcessor {
        void process(SimpleFeature feature);
    }
}
```

## 8.6 GeoJSON 验证

### 8.6.1 结构验证

```java
public class GeoJSONValidator {
    
    public static ValidationResult validate(String json) {
        ValidationResult result = new ValidationResult();
        
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(json);
            
            // 检查类型
            if (!root.has("type")) {
                result.addError("缺少 type 字段");
                return result;
            }
            
            String type = root.get("type").asText();
            
            switch (type) {
                case "FeatureCollection":
                    validateFeatureCollection(root, result);
                    break;
                case "Feature":
                    validateFeature(root, result);
                    break;
                case "Point":
                case "LineString":
                case "Polygon":
                case "MultiPoint":
                case "MultiLineString":
                case "MultiPolygon":
                case "GeometryCollection":
                    validateGeometry(root, result);
                    break;
                default:
                    result.addError("未知类型: " + type);
            }
            
        } catch (Exception e) {
            result.addError("JSON 解析错误: " + e.getMessage());
        }
        
        return result;
    }
    
    private static void validateFeatureCollection(JsonNode node, ValidationResult result) {
        if (!node.has("features")) {
            result.addError("FeatureCollection 缺少 features 数组");
            return;
        }
        
        JsonNode features = node.get("features");
        if (!features.isArray()) {
            result.addError("features 必须是数组");
            return;
        }
        
        for (int i = 0; i < features.size(); i++) {
            validateFeature(features.get(i), result, "features[" + i + "]");
        }
    }
    
    private static void validateFeature(JsonNode node, ValidationResult result) {
        validateFeature(node, result, "");
    }
    
    private static void validateFeature(JsonNode node, ValidationResult result, String path) {
        if (!node.has("geometry")) {
            result.addError(path + " 缺少 geometry 字段");
        } else {
            validateGeometry(node.get("geometry"), result);
        }
        
        if (!node.has("properties")) {
            result.addWarning(path + " 缺少 properties 字段");
        }
    }
    
    private static void validateGeometry(JsonNode node, ValidationResult result) {
        if (node == null || node.isNull()) {
            return; // null 几何是允许的
        }
        
        if (!node.has("type")) {
            result.addError("几何缺少 type 字段");
            return;
        }
        
        if (!node.has("coordinates") && !"GeometryCollection".equals(node.get("type").asText())) {
            result.addError("几何缺少 coordinates 字段");
        }
    }
    
    public static class ValidationResult {
        private List<String> errors = new ArrayList<>();
        private List<String> warnings = new ArrayList<>();
        
        public void addError(String msg) { errors.add(msg); }
        public void addWarning(String msg) { warnings.add(msg); }
        public boolean isValid() { return errors.isEmpty(); }
        public List<String> getErrors() { return errors; }
        public List<String> getWarnings() { return warnings; }
    }
}
```

### 8.6.2 几何验证

```java
public class GeoJSONGeometryValidator {
    
    public static void validateGeometries(String json) throws Exception {
        FeatureJSON featureJSON = new FeatureJSON();
        SimpleFeatureCollection fc;
        
        try (StringReader reader = new StringReader(json)) {
            fc = (SimpleFeatureCollection) featureJSON.readFeatureCollection(reader);
        }
        
        try (SimpleFeatureIterator iter = fc.features()) {
            while (iter.hasNext()) {
                SimpleFeature feature = iter.next();
                Geometry geom = (Geometry) feature.getDefaultGeometry();
                
                if (geom != null) {
                    // 检查几何有效性
                    if (!geom.isValid()) {
                        IsValidOp validOp = new IsValidOp(geom);
                        TopologyValidationError error = validOp.getValidationError();
                        System.out.printf("要素 %s 几何无效: %s at %s%n",
                            feature.getID(),
                            error.getMessage(),
                            error.getCoordinate());
                    }
                    
                    // 检查是否为空
                    if (geom.isEmpty()) {
                        System.out.println("要素 " + feature.getID() + " 几何为空");
                    }
                }
            }
        }
    }
}
```

## 8.7 本章小结

本章详细介绍了 GeoJSON 的处理：

1. **GeoJSON 格式**
   - 结构定义
   - 几何类型

2. **读取 GeoJSON**
   - FeatureJSON 使用
   - GeoJSONDataStore
   - URL 读取

3. **写入 GeoJSON**
   - 文件写入
   - 精度控制

4. **格式转换**
   - Shapefile 互转
   - WKT 互转

5. **高级处理**
   - 嵌套属性
   - 大文件处理
   - 验证

### 关键要点

- GeoJSON 使用 WGS84 坐标系
- 注意精度设置
- 大文件使用流式处理
- 验证几何有效性

---

[← 上一章：Shapefile读写详解](第07章-Shapefile读写详解) | [返回目录](README) | [下一章：数据库空间数据访问 →](第09章-数据库空间数据访问)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第07章-Shapefile读写详解" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第09章-数据库空间数据访问" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
