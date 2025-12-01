# 国土TXT格式处理

## 概述

国土TXT格式是中国自然资源部门使用的地块坐标文本格式，主要用于土地调查、不动产登记等业务场景。本章介绍如何使用OGU4J处理国土TXT格式数据。

## 文件格式

### 基本结构

国土TXT文件由三个部分组成：

```
[扩展信息]（可选）
...

[属性描述]
格式版本号=
数据产生单位=自然资源部
数据产生日期=2024-01-01
坐标系=2000国家大地坐标系
几度分带=3
投影类型=高斯克吕格
计量单位=米
带号=38
精度=0.01
转换参数=0,0,0,0,0,0,0

[地块坐标]
13,1234.56,地块001,土地名称,面,图幅号,住宅用地,0101,,1,B,C,备注,@
J1,1,3456789.12,123456.78
J2,1,3456790.12,123457.78
...
```

### 属性描述说明

| 字段 | 说明 | 示例 |
|------|------|------|
| 格式版本号 | 文件格式版本 | 空或版本号 |
| 数据产生单位 | 数据生产单位 | 自然资源部 |
| 数据产生日期 | 生产日期 | 2024-01-01 |
| 坐标系 | 使用的坐标系 | 2000国家大地坐标系 |
| 几度分带 | 3度或6度 | 3 |
| 投影类型 | 投影方式 | 高斯克吕格 |
| 计量单位 | 坐标单位 | 米 |
| 带号 | 投影带号 | 38 |
| 精度 | 坐标精度 | 0.01 |
| 转换参数 | 七参数 | 0,0,0,0,0,0,0 |

### 地块数据结构

地块数据行格式：`属性值1,属性值2,...,@`

默认字段顺序：
1. JZDS - 界址点数
2. DKMJ - 地块面积（公顷）
3. DKBH - 地块编号
4. DKMC - 地块名称
5. JLTXSX - 记录图形属性
6. TFH - 图幅号
7. DKYT - 地块用途
8. DLBM - 地类编码
9. 其他自定义字段...

### 坐标点格式

`点号,圈号,Y坐标,X坐标`

- 点号：J1、J2或1、2等
- 圈号：1为外环，2及以上为内环（岛洞）
- Y坐标：北方向坐标
- X坐标：东方向坐标（含带号）

**重要**：国土TXT中Y/X与常见GIS坐标系的X/Y是反的！

## 读取TXT文件

### 基本读取

```java
/**
 * 读取国土TXT文件
 */
OguLayer layer = SimpleLayerConverter.fromTxtFile(
    "data/parcels.txt",    // 文件路径
    null                    // 自定义字段定义（null使用默认）
);

// 使用图层数据
System.out.println("要素数量: " + layer.getFeatures().size());
System.out.println("坐标系: EPSG:" + layer.getWkid());
```

### 使用自定义字段

```java
// 自定义字段定义
List<OguField> customFields = new ArrayList<>();
customFields.add(new OguField("JZDS", "界址点数", FieldDataType.INTEGER));
customFields.add(new OguField("DKMJ", "地块面积", FieldDataType.DOUBLE));
customFields.add(new OguField("DKBH", "地块编号", FieldDataType.STRING));
customFields.add(new OguField("DKMC", "地块名称", FieldDataType.STRING));
// ... 更多字段

OguLayer layer = SimpleLayerConverter.fromTxtFile(
    "data/parcels.txt",
    customFields
);
```

## 写入TXT文件

### 基本写入

```java
/**
 * 将OguLayer写入国土TXT文件
 */
OguLayerMetadata metadata = new OguLayerMetadata();
metadata.setDataSource("自然资源部");
metadata.setCoordinateSystemName("2000国家大地坐标系");
metadata.setZoneDivision("3");
metadata.setProjectionType("高斯克吕格");
metadata.setMeasureUnit("米");

int zoneNumber = 38;  // 带号

SimpleLayerConverter.toTxtFile(
    layer,               // 图层数据
    "output/result.txt", // 输出路径
    metadata,            // 元数据
    null,                // 字段名列表（null使用默认）
    zoneNumber           // 带号
);
```

### 元数据配置

```java
OguLayerMetadata metadata = new OguLayerMetadata();
metadata.setFormatVersion("");                    // 格式版本号
metadata.setDataSource("自然资源部");              // 数据产生单位
metadata.setProductionDate("2024-01-01");         // 数据产生日期
metadata.setCoordinateSystemName("2000国家大地坐标系");  // 坐标系
metadata.setZoneDivision("3");                    // 几度分带
metadata.setProjectionType("高斯克吕格");         // 投影类型
metadata.setMeasureUnit("米");                    // 计量单位
metadata.setPrecision("0.01");                    // 精度
metadata.setTransformParams("0,0,0,0,0,0,0");    // 转换参数
```

## 坐标系处理

### 坐标系与带号

国土TXT使用投影坐标系，需要正确处理带号：

```java
// 从TXT读取时，根据带号自动确定坐标系
// 带号38 → EPSG:4526
// WKID = 4488 + 带号

// 检查数据的带号
OguLayer layer = SimpleLayerConverter.fromTxtFile("data/parcels.txt", null);
int dh = CrsUtil.getDh(layer.getWkid());
System.out.println("带号: " + dh);
```

### 坐标顺序处理

国土TXT的坐标顺序与常见GIS软件不同：

```java
// TXT中的坐标
// J1,1,3456789.12,38123456.78
// 其中 3456789.12 是Y坐标（北方向）
// 38123456.78 是X坐标（东方向，含带号38）

// 转换为JTS Coordinate
// JTS中 X 是东方向，Y 是北方向
Coordinate coord = new Coordinate(
    txtCoord.getX(),  // 东方向 → JTS的X
    txtCoord.getY()   // 北方向 → JTS的Y
);
```

## 实践案例

### 案例1：TXT转Shapefile

```java
/**
 * 国土TXT转Shapefile
 */
public void txt2Shp(String txtPath, String shpPath) {
    // 读取TXT
    OguLayer layer = SimpleLayerConverter.fromTxtFile(txtPath, null);
    
    // 写入Shapefile
    SimpleLayerConverter.toShapefile(layer, shpPath, GisEngineType.GEOTOOLS);
    
    System.out.println("转换完成，共 " + layer.getFeatures().size() + " 个地块");
}
```

### 案例2：Shapefile转TXT

```java
/**
 * Shapefile转国土TXT
 */
public void shp2Txt(String shpPath, String txtPath, Integer targetDh) {
    // 读取Shapefile
    OguLayer layer = SimpleLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 如果需要，转换到投影坐标系
    if (!CrsUtil.isProjectedCRS(layer.getWkid())) {
        if (targetDh == null) {
            // 自动确定带号
            Geometry geom = GeometryConverter.wkt2Geometry(
                layer.getFeatures().get(0).getWkt());
            targetDh = CrsUtil.getDh(geom);
        }
        int targetWkid = CrsUtil.getProjectedWkid(targetDh);
        layer = CrsUtil.reproject(layer, targetWkid);
    }
    
    // 配置元数据
    OguLayerMetadata metadata = new OguLayerMetadata();
    metadata.setDataSource("自然资源部");
    metadata.setCoordinateSystemName("2000国家大地坐标系");
    metadata.setZoneDivision("3");
    metadata.setProjectionType("高斯克吕格");
    metadata.setMeasureUnit("米");
    
    // 写入TXT
    SimpleLayerConverter.toTxtFile(layer, txtPath, metadata, null, targetDh);
}
```

### 案例3：批量转换

```java
/**
 * 批量TXT转Shapefile
 */
public void batchConvert(String inputDir, String outputDir) {
    File dir = new File(inputDir);
    File[] txtFiles = dir.listFiles((d, name) -> 
        name.toLowerCase().endsWith(".txt"));
    
    if (txtFiles == null) return;
    
    for (File txtFile : txtFiles) {
        try {
            String shpName = txtFile.getName().replace(".txt", ".shp");
            String shpPath = outputDir + File.separator + shpName;
            
            txt2Shp(txtFile.getAbsolutePath(), shpPath);
            System.out.println("转换成功: " + txtFile.getName());
        } catch (Exception e) {
            System.err.println("转换失败: " + txtFile.getName() + 
                " - " + e.getMessage());
        }
    }
}
```

### 案例4：TXT数据验证

```java
/**
 * 验证TXT数据
 */
public List<String> validateTxt(String txtPath) {
    List<String> errors = new ArrayList<>();
    
    try {
        OguLayer layer = SimpleLayerConverter.fromTxtFile(txtPath, null);
        
        for (OguFeature feature : layer.getFeatures()) {
            String dkbh = feature.getAttribute("DKBH").getStringValue();
            Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
            
            // 检查几何有效性
            if (!geom.isValid()) {
                errors.add("地块 " + dkbh + " 几何无效");
            }
            
            // 检查面积
            double area = geom.getArea();
            if (area <= 0) {
                errors.add("地块 " + dkbh + " 面积为0或负数");
            }
            
            // 检查闭合
            if (geom instanceof Polygon) {
                Polygon poly = (Polygon) geom;
                if (!poly.getExteriorRing().isClosed()) {
                    errors.add("地块 " + dkbh + " 外环未闭合");
                }
            }
        }
    } catch (Exception e) {
        errors.add("文件解析错误: " + e.getMessage());
    }
    
    return errors;
}
```

### 案例5：坐标系转换

```java
/**
 * TXT坐标系转换
 */
public void transformTxt(String inputPath, String outputPath, 
        int sourceDh, int targetDh) {
    // 读取
    OguLayer layer = SimpleLayerConverter.fromTxtFile(inputPath, null);
    
    // 坐标转换
    int targetWkid = CrsUtil.getProjectedWkid(targetDh);
    layer = CrsUtil.reproject(layer, targetWkid);
    
    // 写入
    OguLayerMetadata metadata = new OguLayerMetadata();
    metadata.setDataSource("自然资源部");
    metadata.setCoordinateSystemName("2000国家大地坐标系");
    metadata.setZoneDivision("3");
    metadata.setProjectionType("高斯克吕格");
    metadata.setMeasureUnit("米");
    
    SimpleLayerConverter.toTxtFile(layer, outputPath, metadata, null, targetDh);
}
```

### 案例6：TXT导入PostGIS

```java
/**
 * TXT导入PostGIS
 */
public void txt2PostGIS(String txtPath, DbConnBaseModel dbConn, 
        String tableName) {
    // 读取TXT
    OguLayer layer = SimpleLayerConverter.fromTxtFile(txtPath, null);
    
    // 写入PostGIS
    SimpleLayerConverter.toPostGIS(layer, dbConn, tableName, 
        GisEngineType.GEOTOOLS);
    
    System.out.println("导入完成，共 " + layer.getFeatures().size() + " 个地块");
}
```

### 案例7：面积校验

```java
/**
 * 校验地块面积
 */
public void verifyArea(String txtPath) {
    OguLayer layer = SimpleLayerConverter.fromTxtFile(txtPath, null);
    
    for (OguFeature feature : layer.getFeatures()) {
        String dkbh = feature.getAttribute("DKBH").getStringValue();
        Double dkmj = feature.getAttribute("DKMJ").getDoubleValue();  // 公顷
        
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        double calcArea = geom.getArea();  // 平方米
        double calcHa = calcArea / 10000;  // 转公顷
        
        // 比较面积
        double diff = Math.abs(calcHa - dkmj);
        double diffPercent = diff / dkmj * 100;
        
        if (diffPercent > 1) {  // 差异超过1%
            System.out.println(String.format(
                "地块 %s 面积差异: 记录值=%.4f公顷, 计算值=%.4f公顷, 差异=%.2f%%",
                dkbh, dkmj, calcHa, diffPercent));
        }
    }
}
```

## 常见问题

### 1. 坐标顺序问题

**问题**：TXT中Y是北方向，X是东方向，与常见GIS软件相反

**解决**：OGU4J已自动处理坐标转换

### 2. 内环方向

**问题**：多边形内环方向错误导致几何无效

**解决**：使用几何修复

```java
Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
if (!geom.isValid()) {
    geom = JtsGeometryUtil.validate(geom);
    feature.setWkt(geom.toText());
}
```

### 3. 编码问题

**问题**：中文乱码

**解决**：OGU4J自动检测文件编码

### 4. 精度损失

**问题**：坐标精度在转换过程中损失

**解决**：使用足够的小数位数（建议2-3位）

## 小结

本章介绍了国土TXT格式处理的核心内容：

1. **文件结构**：属性描述、扩展信息、地块坐标三部分
2. **坐标处理**：注意Y/X坐标顺序与常见GIS不同
3. **读写操作**：使用SimpleLayerConverter进行读写
4. **格式转换**：与Shapefile、PostGIS等格式互转
5. **实践案例**：批量转换、数据验证、面积校验

下一章将介绍FileGDB数据处理。
