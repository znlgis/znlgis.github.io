---
layout: default
title: WKT数据格式处理
---

# WKT数据格式处理

## 概述

WKT（Well-Known Text）是一种用于表示几何对象的标准文本格式。作为一种通用的几何数据表示方法，WKT可以作为不同GIS数据格式之间转换的桥梁。本章介绍WKT格式的特点、使用方法以及基于WKT进行数据转换的优缺点。

## WKT格式详解

### 基本语法

WKT使用文本字符串描述几何对象，语法简洁直观：

```
// 点
POINT (116.397 39.908)

// 线
LINESTRING (0 0, 10 10, 20 0)

// 多边形（外环）
POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))

// 带岛洞的多边形
POLYGON ((0 0, 100 0, 100 100, 0 100, 0 0), (20 20, 80 20, 80 80, 20 80, 20 20))

// 多点
MULTIPOINT ((0 0), (10 10), (20 20))

// 多线
MULTILINESTRING ((0 0, 10 10), (20 20, 30 30))

// 多面
MULTIPOLYGON (((0 0, 10 0, 10 10, 0 10, 0 0)), ((20 20, 30 20, 30 30, 20 30, 20 20)))

// 几何集合
GEOMETRYCOLLECTION (POINT (0 0), LINESTRING (0 0, 10 10))
```

### WKT与JTS Geometry互转

```java
/**
 * WKT转JTS Geometry
 */
public static Geometry wkt2Geometry(String wkt) {
    WKTReader2 reader = new WKTReader2();
    return reader.read(wkt);
}

/**
 * JTS Geometry转WKT
 */
public static String geometry2Wkt(Geometry geometry) {
    WKTWriter2 writer = new WKTWriter2();
    return writer.write(geometry);
}
```

## 基于WKT的数据格式转换

### 转换思路

WKT作为标准的几何文本表示，可以作为不同格式之间转换的中间格式：

```
源格式 → WKT字符串 → 目标格式
```

### WKT与GeoJSON互转

```java
/**
 * WKT转GeoJSON
 */
public static String wkt2Geojson(String wkt) {
    Geometry geometry = wkt2Geometry(wkt);
    GeometryJSON gjson = new GeometryJSON(16);
    StringWriter writer = new StringWriter();
    gjson.write(geometry, writer);
    return writer.toString();
}

/**
 * GeoJSON转WKT
 */
public static String geojson2Wkt(String geojson) {
    GeometryJSON gjson = new GeometryJSON(16);
    Geometry geometry = gjson.read(new StringReader(geojson));
    return geometry2Wkt(geometry);
}
```

### WKT与EsriJSON互转

```java
/**
 * WKT转EsriJSON
 */
public static String wkt2EsriJson(String wkt, int wkid) {
    com.esri.core.geometry.Geometry geometry = EsriUtil.createGeometryByWkt(wkt);
    return EsriUtil.getEsriJson(wkid, geometry);
}

/**
 * EsriJSON转WKT
 */
public static String esriJson2Wkt(String esrijson) {
    com.esri.core.geometry.Geometry geometry = EsriUtil.createGeometryByJson(esrijson);
    return EsriUtil.getWktStr(geometry);
}
```

### GeoJSON与EsriJSON互转（通过WKT）

```java
/**
 * GeoJSON转EsriJSON
 */
public static String geoJson2EsriJson(int wkid, String geojson) {
    // 先转WKT，再转EsriJSON
    String wkt = geojson2Wkt(geojson);
    return wkt2EsriJson(wkt, wkid);
}

/**
 * EsriJSON转GeoJSON
 */
public static String esriJson2GeoJson(String esrijson) {
    // 先转WKT，再转GeoJSON
    String wkt = esriJson2Wkt(esrijson);
    return wkt2Geojson(wkt);
}
```

## 基于WKT转换的优势

### 1. 格式无关性

WKT是纯文本格式，不依赖于任何特定的GIS软件或库：

```java
// 无论数据来源是什么，都可以统一转为WKT处理
String wktFromShp = readFromShapefile(shpPath);
String wktFromJson = geojson2Wkt(geojsonStr);
String wktFromDB = readFromPostGIS(connection, tableName);

// 所有几何都可以用相同的方式处理
Geometry geom = wkt2Geometry(wkt);
```

### 2. 易于调试和日志记录

WKT的可读性使其非常适合调试：

```java
// 日志中记录几何数据
logger.info("处理几何: " + geometry.toText());

// 错误排查时可以直接查看几何形状
System.out.println("输入WKT: " + inputWkt);
System.out.println("处理后WKT: " + outputWkt);
```

### 3. 数据交换简便

WKT可以轻松地在不同系统间传递：

```java
// REST API返回
@GetMapping("/geometry/{id}")
public String getGeometry(@PathVariable Long id) {
    Geometry geom = repository.findById(id);
    return geom.toText();  // 返回WKT字符串
}

// 数据库存储
String sql = "INSERT INTO geometries (wkt) VALUES (?)";
preparedStatement.setString(1, geometry.toText());
```

### 4. 跨语言兼容

几乎所有GIS库都支持WKT格式：

```python
# Python中使用shapely
from shapely import wkt
geom = wkt.loads("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))")

# JavaScript中使用wicket
var wkt = new Wkt.Wkt();
wkt.read("POINT (116.397 39.908)");
```

### 5. 简化转换逻辑

使用WKT作为中间格式，可以避免为每种格式组合编写转换代码：

```
不使用WKT：需要 N×(N-1) 种转换方法
使用WKT：只需要 2×N 种转换方法（每种格式到WKT和从WKT）
```

## 基于WKT转换的局限性

### 1. 不包含属性信息

WKT只描述几何形状，不包含属性数据：

```java
// WKT只有几何，没有属性
String wkt = "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))";
// 属性需要单独处理
String name = "地块A";
double area = 100.0;
```

**解决方案**：将几何和属性分开存储和传输，或使用包含属性的格式（如GeoJSON）。

### 2. 不包含坐标系信息

WKT几何本身不携带坐标系定义：

```java
// 两个WKT看起来相同，但可能是不同坐标系
String wkt1 = "POINT (116.397 39.908)";  // 可能是WGS84
String wkt2 = "POINT (116.397 39.908)";  // 可能是CGCS2000
```

**解决方案**：在传输和存储时需要额外记录坐标系信息。

### 3. 文本格式效率较低

与二进制格式相比，WKT在存储和传输效率上较低：

```java
// 同一个几何，WKT比WKB占用更多空间
String wkt = "POINT (116.39700000 39.90800000)";  // 约35字节
byte[] wkb = // 二进制表示，约21字节
```

**解决方案**：大数据量场景可以考虑使用WKB（Well-Known Binary）格式。

### 4. 精度表示问题

浮点数转为文本可能存在精度问题：

```java
// 原始坐标
double x = 116.39748293847123;

// 转换为WKT后可能精度丢失
String wkt = geometry.toText();  // 默认精度可能不够

// 解决方案：指定足够的小数位数
WKTWriter2 writer = new WKTWriter2();
// 或使用GeometryJSON时指定精度
GeometryJSON gjson = new GeometryJSON(16);  // 16位小数
```

### 5. 复杂几何的文本较长

复杂几何的WKT表示会非常长：

```java
// 一个有10000个点的多边形，WKT可能有数百KB
Geometry complexPolygon = createComplexPolygon(10000);
String wkt = complexPolygon.toText();  // 非常长的字符串
```

**解决方案**：对于复杂几何，可以先简化再转换，或使用二进制格式。

## 实践建议

### 适用场景

1. **数据调试**：开发和测试阶段查看几何数据
2. **简单数据交换**：少量几何数据的传输
3. **日志记录**：记录几何处理过程
4. **数据库存储**：简单场景下存储几何数据
5. **API接口**：简单几何数据的请求和响应

### 不适用场景

1. **大数据量处理**：百万级几何数据
2. **高性能要求**：需要快速序列化/反序列化
3. **带属性数据**：需要同时处理几何和属性
4. **精确计算**：对精度要求极高的场景

### 最佳实践

```java
// 1. 指定足够的精度
GeometryJSON gjson = new GeometryJSON(16);

// 2. 大数据量时考虑简化
if (geometry.getNumPoints() > 10000) {
    geometry = DouglasPeuckerSimplifier.simplify(geometry, tolerance);
}

// 3. 记录坐标系信息
Map<String, Object> data = new HashMap<>();
data.put("wkt", geometry.toText());
data.put("srid", 4490);

// 4. 异常处理
try {
    Geometry geom = wkt2Geometry(wktStr);
} catch (ParseException e) {
    logger.error("WKT解析失败: " + wktStr, e);
}
```

## 实践案例

### 案例1：几何格式转换服务

```java
/**
 * 几何格式转换服务
 */
public class GeometryFormatConverter {
    
    /**
     * 通用格式转换
     */
    public String convert(String input, String fromFormat, String toFormat) {
        // 先转为WKT
        String wkt = toWkt(input, fromFormat);
        
        // 再转为目标格式
        return fromWkt(wkt, toFormat);
    }
    
    private String toWkt(String input, String format) {
        switch (format.toUpperCase()) {
            case "WKT":
                return input;
            case "GEOJSON":
                return geojson2Wkt(input);
            case "ESRIJSON":
                return esriJson2Wkt(input);
            default:
                throw new IllegalArgumentException("不支持的输入格式: " + format);
        }
    }
    
    private String fromWkt(String wkt, String format) {
        switch (format.toUpperCase()) {
            case "WKT":
                return wkt;
            case "GEOJSON":
                return wkt2Geojson(wkt);
            case "ESRIJSON":
                return wkt2EsriJson(wkt, 4490);
            default:
                throw new IllegalArgumentException("不支持的输出格式: " + format);
        }
    }
}
```

### 案例2：几何数据验证

```java
/**
 * 使用WKT进行几何数据验证
 */
public class GeometryValidator {
    
    public boolean validate(String wkt) {
        try {
            Geometry geom = wkt2Geometry(wkt);
            return geom.isValid();
        } catch (Exception e) {
            return false;
        }
    }
    
    public String fix(String wkt) {
        Geometry geom = wkt2Geometry(wkt);
        if (!geom.isValid()) {
            geom = JTSGeometryUtil.validate(geom);
        }
        return geometry2Wkt(geom);
    }
}
```

### 案例3：Web API几何接口

```java
/**
 * REST API中使用WKT
 */
@RestController
@RequestMapping("/api/geometry")
public class GeometryController {
    
    @PostMapping("/buffer")
    public Map<String, Object> buffer(@RequestBody Map<String, Object> request) {
        String wkt = (String) request.get("wkt");
        Double distance = (Double) request.get("distance");
        Integer srid = (Integer) request.get("srid");
        
        Geometry geom = wkt2Geometry(wkt);
        Geometry buffer = geom.buffer(distance);
        
        Map<String, Object> result = new HashMap<>();
        result.put("wkt", geometry2Wkt(buffer));
        result.put("srid", srid);
        return result;
    }
    
    @PostMapping("/convert")
    public String convert(@RequestBody Map<String, Object> request) {
        String input = (String) request.get("geometry");
        String fromFormat = (String) request.get("from");
        String toFormat = (String) request.get("to");
        
        // 通过WKT进行格式转换
        String wkt = convertToWkt(input, fromFormat);
        return convertFromWkt(wkt, toFormat);
    }
}
```

## 小结

WKT作为GIS几何数据的标准文本表示格式，在数据格式转换中扮演着重要角色。

### 核心要点

1. **WKT优势**：格式无关、易于调试、跨语言兼容、简化转换逻辑
2. **WKT局限**：不含属性、不含坐标系、效率较低、精度问题
3. **适用场景**：调试、简单交换、日志记录、API接口
4. **不适用场景**：大数据量、高性能、带属性数据

### 使用建议

- 开发调试阶段优先使用WKT，便于查看和排错
- 生产环境根据数据量和性能要求选择合适的格式
- 始终注意坐标系信息的记录和传递
- 复杂几何考虑先简化再转换

通过本教程的学习，您应该能够：
- 理解WKT格式的语法和特点
- 使用WKT进行不同几何格式之间的转换
- 根据场景选择合适的数据格式
- 正确处理WKT转换中的精度和效率问题
