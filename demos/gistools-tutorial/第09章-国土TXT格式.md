---
layout: default
title: 国土TXT格式
---

# 国土TXT格式

## 概述

国土TXT格式是中国自然资源部门使用的地块坐标文本格式，主要用于土地调查、不动产登记等业务场景。理解并正确处理该格式是从事国土相关GIS开发的必备技能。

## 文件格式

### 基本结构

国土TXT文件由多个部分组成：

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
13,1234.56,地块002,土地名称,面,...,@
...
```

### 属性描述说明

| 字段 | 说明 | 示例 |
|------|------|------|
| 格式版本号 | 文件格式版本 | 空或版本号 |
| 数据产生单位 | 数据生产单位名称 | 自然资源部 |
| 数据产生日期 | 数据生产日期 | 2024-01-01 |
| 坐标系 | 使用的坐标系 | 2000国家大地坐标系 |
| 几度分带 | 3度或6度分带 | 3 |
| 投影类型 | 投影方式 | 高斯克吕格 |
| 计量单位 | 坐标单位 | 米 |
| 带号 | 投影带号 | 38 |
| 精度 | 坐标精度 | 0.01 |
| 转换参数 | 七参数转换值 | 0,0,0,0,0,0,0 |

### 地块数据结构

地块数据行格式：`属性值1,属性值2,...,@`

默认字段顺序：
1. JZDS - 界址点数
2. DKMJ - 地块面积（公顷）
3. DKBH - 地块编号
4. DKMC - 地块名称
5. JLTXSX - 记录图形属性（面/线/点）
6. TFH - 图幅号
7. DKYT - 地块用途
8. DLBM - 地类编码
9. TBLX - 图斑类型
10. DL - 地类
11. GZQ - 改造前质量等别
12. GZH - 改造后质量等别
13. BZ - 备注

### 坐标点格式

`点号,圈号,Y坐标,X坐标`

- 点号：点的序号，J1、J2或1、2等
- 圈号：环的序号，1为外环，2及以上为内环（岛洞）
- Y坐标：北方向坐标（通常是大数）
- X坐标：东方向坐标（带号+坐标值）

**注意**：国土TXT中Y/X与常见GIS坐标系的X/Y是反的！

## 数据模型

### TxtLayer

```java
/**
 * TXT图层
 */
@Data
public class TxtLayer implements Serializable {
    private String name;          // 图层名称
    private String gsbbh;         // 格式版本号
    private String sjscdw;        // 数据产生单位
    private String sjscrq;        // 数据产生日期
    private String zbx;           // 坐标系
    private String jdfd;          // 几度分带
    private String tylx;          // 投影类型
    private String jldw;          // 计量单位
    private String dh;            // 带号
    private String jd;            // 精度
    private String zhcs;          // 转换参数
    private List<TxtExtInfo> exts;      // 扩展信息
    private List<TxtFeature> features;  // 要素列表
}
```

### TxtFeature

```java
/**
 * TXT要素
 */
@Data
public class TxtFeature implements Serializable {
    private List<String> values;              // 属性值列表
    private List<TxtCoordinate> coordinates;  // 坐标点列表
}
```

### TxtCoordinate

```java
/**
 * TXT坐标点
 */
@Data
public class TxtCoordinate implements Serializable {
    private String dh;    // 点号
    private Integer qh;   // 圈号
    private Double y;     // Y坐标
    private Double x;     // X坐标
}
```

## 文件读取

### 解析TXT文件

```java
/**
 * 加载TXT图层
 */
public static TxtLayer loadTxt(String txtPath) {
    File file = new java.io.File(txtPath);
    Charset encoding = EncodingUtil.getFileEncoding(file);
    
    // 读取并清理空行
    List<String> txtLines = new ArrayList<>();
    for (String line : FileUtil.readLines(file, encoding)) {
        String trim = line.trim();
        if (CharSequenceUtil.isBlank(trim)) continue;
        
        // 处理BOM头
        if (trim.startsWith("\uFEFF")) {
            trim = trim.substring(1);
        }
        txtLines.add(trim);
    }
    
    // 检查必要部分
    if (txtLines.stream().noneMatch("[属性描述]"::equals)) {
        throw new RuntimeException("缺少[属性描述]");
    }
    if (txtLines.stream().noneMatch("[地块坐标]"::equals)) {
        throw new RuntimeException("缺少[地块坐标]");
    }
    
    // 按模块分组
    LinkedHashMap<String, List<String>> txtMap = new LinkedHashMap<>();
    String currKey = null;
    for (String txtLine : txtLines) {
        if (txtLine.startsWith("[") && txtLine.endsWith("]")) {
            currKey = txtLine;
            txtMap.put(txtLine, new ArrayList<>());
        } else {
            txtMap.get(currKey).add(txtLine);
        }
    }
    
    // 解析各模块
    TxtLayer txtLayer = new TxtLayer();
    txtLayer.setName(FileUtil.getName(txtPath));
    
    parseAttributeDescription(txtLayer, txtMap.get("[属性描述]"));
    parseCoordinates(txtLayer, txtMap.get("[地块坐标]"));
    parseExtInfo(txtLayer, txtMap);
    
    return txtLayer;
}
```

### 解析属性描述

```java
private static void parseAttributeDescription(TxtLayer txtLayer, List<String> lines) {
    for (String line : lines) {
        String[] split = line.split("=");
        if (split.length == 0 || split.length > 2) {
            throw new RuntimeException("txt文件格式不正确");
        }
        
        String key = split[0].trim();
        String value = split.length == 2 ? split[1].trim() : null;
        
        switch (key) {
            case "格式版本号": txtLayer.setGsbbh(value); break;
            case "数据产生单位": txtLayer.setSjscdw(value); break;
            case "数据产生日期": txtLayer.setSjscrq(value); break;
            case "坐标系": txtLayer.setZbx(value); break;
            case "几度分带": txtLayer.setJdfd(value); break;
            case "投影类型": txtLayer.setTylx(value); break;
            case "计量单位": txtLayer.setJldw(value); break;
            case "带号": txtLayer.setDh(value); break;
            case "精度": txtLayer.setJd(value); break;
            case "转换参数": txtLayer.setZhcs(value); break;
            default:
                throw new RuntimeException("txt文件格式不正确，未知字段：" + key);
        }
    }
}
```

### 解析坐标数据

```java
private static void parseCoordinates(TxtLayer txtLayer, List<String> lines) {
    List<TxtFeature> features = new ArrayList<>();
    
    // 按地块分组（以@结尾的行是地块属性行）
    LinkedHashMap<String, List<String>> zbMap = new LinkedHashMap<>();
    String currZbKey = null;
    for (String line : lines) {
        if (line.endsWith("@")) {
            currZbKey = line;
            zbMap.put(currZbKey, new ArrayList<>());
        } else {
            zbMap.get(currZbKey).add(line);
        }
    }
    
    // 解析每个地块
    zbMap.forEach((zbKey, zbLines) -> {
        TxtFeature txtFeature = new TxtFeature();
        
        // 解析属性值
        List<String> fields = CharSequenceUtil.split(zbKey, ",");
        List<String> values = fields.subList(0, fields.size() - 1);
        txtFeature.setValues(values);
        
        // 解析坐标点
        List<TxtCoordinate> coordinates = new ArrayList<>();
        zbLines.forEach(zbLine -> {
            List<String> zbLineList = new ArrayList<>(CharSequenceUtil.split(zbLine, ","));
            if (zbLineList.size() != 4) {
                throw new RuntimeException("txt坐标点格式不正确：" + zbLine);
            }
            
            TxtCoordinate txtCoordinate = new TxtCoordinate();
            txtCoordinate.setDh(zbLineList.get(0));
            txtCoordinate.setQh(NumberUtil.parseInt(zbLineList.get(1)));
            txtCoordinate.setY(NumberUtil.parseDouble(zbLineList.get(2)));
            txtCoordinate.setX(NumberUtil.parseDouble(zbLineList.get(3)));
            coordinates.add(txtCoordinate);
        });
        
        txtFeature.setCoordinates(coordinates);
        features.add(txtFeature);
    });
    
    txtLayer.setFeatures(features);
}
```

## TXT转WktLayer

```java
/**
 * TxtLayer转WktLayer
 */
public static WktLayer parseTxtLayerToWktLayer(TxtLayer txtLayer, List<WktField> wktFields) {
    // 默认字段定义
    if (wktFields == null) {
        wktFields = getDefaultFields();
    }
    
    WktLayer wktLayer = new WktLayer();
    wktLayer.setYwName("TXT");
    wktLayer.setZwName(txtLayer.getName());
    
    // 根据带号确定坐标系
    int wkid = 4488 + NumberUtil.parseInt(txtLayer.getDh());
    wktLayer.setWkid(wkid);
    wktLayer.setTolerance(CrsUtil.getTolerance(wkid));
    wktLayer.setGeometryType(GeometryType.MULTIPOLYGON);
    wktLayer.setFields(wktFields);
    
    // 转换要素
    List<WktFeature> wktFeatures = new ArrayList<>();
    for (TxtFeature txtFeature : txtLayer.getFeatures()) {
        WktFeature wktFeature = convertFeature(txtFeature, wktFields, wkid);
        wktFeatures.add(wktFeature);
    }
    
    wktLayer.setFeatures(wktFeatures);
    wktLayer.check();
    return wktLayer;
}

/**
 * 转换单个要素
 */
private static WktFeature convertFeature(TxtFeature txtFeature, 
        List<WktField> wktFields, int wkid) {
    // 按圈号分组坐标点
    LinkedHashMap<Integer, List<Coordinate>> coordinateMap = new LinkedHashMap<>();
    for (TxtCoordinate zb : txtFeature.getCoordinates()) {
        int qh = zb.getQh();
        List<Coordinate> coordinates = coordinateMap.computeIfAbsent(qh, 
            k -> new ArrayList<>());
        // 注意：TXT中Y是北方向，X是东方向
        // JTS中X是东方向，Y是北方向
        coordinates.add(new Coordinate(zb.getX(), zb.getY()));
    }
    
    // 构建多边形
    GeometryFactory factory = new GeometryFactory(
        new PrecisionModel(PrecisionModel.FLOATING));
    LinearRing shell = null;
    LinearRing[] holes = null;
    if (coordinateMap.size() > 1) {
        holes = new LinearRing[coordinateMap.size() - 1];
    }
    
    int index = 0;
    for (Map.Entry<Integer, List<Coordinate>> entry : coordinateMap.entrySet()) {
        List<Coordinate> coordinates = entry.getValue();
        // 确保闭合
        if (!coordinates.get(0).equals2D(coordinates.get(coordinates.size() - 1))) {
            coordinates.add(coordinates.get(0));
        }
        
        LinearRing ring = factory.createLinearRing(
            ArrayUtil.toArray(coordinates, Coordinate.class));
        if (index == 0) {
            shell = ring;
        } else if (holes != null) {
            holes[index - 1] = ring;
        }
        index++;
    }
    
    Polygon polygon = factory.createPolygon(shell, holes);
    
    // 设置属性
    List<WktFieldValue> wktFieldValues = new ArrayList<>();
    for (int i = 0; i < txtFeature.getValues().size() && i < wktFields.size(); i++) {
        WktFieldValue fv = new WktFieldValue();
        fv.setField(wktFields.get(i));
        fv.setValue(txtFeature.getValues().get(i));
        wktFieldValues.add(fv);
    }
    
    WktFeature wktFeature = new WktFeature();
    wktFeature.setFieldValues(wktFieldValues);
    wktFeature.setWfId(IdUtil.simpleUUID());
    wktFeature.setWkt(ESRIGeometryUtil.simplify(polygon.toText(), wkid));
    
    return wktFeature;
}
```

## WktLayer转TXT

```java
/**
 * WktLayer转TxtLayer
 */
public static TxtLayer parseWktLayerToTxtLayer(WktLayer wktLayer, 
        TxtLayer msAndExtInfo, List<String> fieldNames, Integer dh) {
    
    TxtLayer txtLayer = new TxtLayer();
    txtLayer.setName(wktLayer.getZwName() != null ? 
        wktLayer.getZwName() : wktLayer.getYwName());
    
    // 设置属性描述（从模板或默认值）
    txtLayer.setGsbbh(getOrDefault(msAndExtInfo, TxtLayer::getGsbbh, ""));
    txtLayer.setSjscdw(getOrDefault(msAndExtInfo, TxtLayer::getSjscdw, "自然资源部"));
    txtLayer.setSjscrq(getOrDefault(msAndExtInfo, TxtLayer::getSjscrq, 
        DatePattern.NORM_DATE_FORMAT.format(DateUtil.date())));
    txtLayer.setZbx(getOrDefault(msAndExtInfo, TxtLayer::getZbx, "2000国家大地坐标系"));
    txtLayer.setJdfd(getOrDefault(msAndExtInfo, TxtLayer::getJdfd, "3"));
    txtLayer.setTylx(getOrDefault(msAndExtInfo, TxtLayer::getTylx, "高斯克吕格"));
    txtLayer.setJldw(getOrDefault(msAndExtInfo, TxtLayer::getJldw, "米"));
    txtLayer.setJd(getOrDefault(msAndExtInfo, TxtLayer::getJd, "0.01"));
    txtLayer.setZhcs(getOrDefault(msAndExtInfo, TxtLayer::getZhcs, "0,0,0,0,0,0,0"));
    
    // 默认字段
    if (fieldNames == null || fieldNames.isEmpty()) {
        fieldNames = getDefaultFieldNames();
    }
    
    // 确定坐标系
    Integer wkid = null;
    if (dh != null) {
        wkid = CrsUtil.getProjectedWkid(dh);
    }
    
    // 转换要素
    List<TxtFeature> txtFeatures = new ArrayList<>();
    for (WktFeature wktFeature : wktLayer.getFeatures()) {
        TxtFeature txtFeature = convertToTxtFeature(wktFeature, wktLayer, 
            fieldNames, wkid);
        txtFeatures.add(txtFeature);
        
        // 更新带号
        if (dh == null) {
            dh = CrsUtil.getDh(GeometryConverter.wkt2Geometry(wktFeature.getWkt()));
            wkid = CrsUtil.getProjectedWkid(dh);
        }
    }
    
    txtLayer.setFeatures(txtFeatures);
    txtLayer.setDh(String.valueOf(dh));
    
    return txtLayer;
}
```

## 文件写入

```java
/**
 * 保存TXT图层
 */
public static void saveTxt(TxtLayer txtLayer, String txtPath) {
    List<String> txtLines = new ArrayList<>();
    
    // 写入扩展信息
    if (txtLayer.getExts() != null && !txtLayer.getExts().isEmpty()) {
        for (TxtExtInfo extInfo : txtLayer.getExts()) {
            txtLines.add("[" + extInfo.getName() + "]");
            for (Map.Entry<String, String> entry : extInfo.getFields().entrySet()) {
                txtLines.add(entry.getKey() + "=" + entry.getValue());
            }
        }
    }
    
    // 写入属性描述
    txtLines.add("[属性描述]");
    txtLines.add("格式版本号=" + txtLayer.getGsbbh());
    txtLines.add("数据产生单位=" + txtLayer.getSjscdw());
    txtLines.add("数据产生日期=" + txtLayer.getSjscrq());
    txtLines.add("坐标系=" + txtLayer.getZbx());
    txtLines.add("几度分带=" + txtLayer.getJdfd());
    txtLines.add("投影类型=" + txtLayer.getTylx());
    txtLines.add("计量单位=" + txtLayer.getJldw());
    txtLines.add("带号=" + txtLayer.getDh());
    txtLines.add("精度=" + txtLayer.getJd());
    txtLines.add("转换参数=" + txtLayer.getZhcs());
    
    // 写入地块坐标
    txtLines.add("[地块坐标]");
    for (TxtFeature txtFeature : txtLayer.getFeatures()) {
        // 属性行
        txtLines.add(CharSequenceUtil.join(",", txtFeature.getValues()) + ",@");
        // 坐标点
        for (TxtCoordinate coord : txtFeature.getCoordinates()) {
            txtLines.add(CharSequenceUtil.join(",", 
                coord.getDh(), coord.getQh(),
                NumUtil.getPlainString(coord.getY()),
                NumUtil.getPlainString(coord.getX())));
        }
    }
    
    FileUtil.writeLines(txtLines, txtPath, StandardCharsets.UTF_8);
}
```

## 实践案例

### 案例1：TXT转Shapefile

```java
/**
 * 国土TXT转Shapefile
 */
public void txt2Shp(String txtPath, String shpPath) {
    // 读取TXT
    TxtLayer txtLayer = TxtLayerUtil.loadTxt(txtPath);
    
    // 转换为WktLayer
    WktLayer wktLayer = TxtLayerUtil.parseTxtLayerToWktLayer(txtLayer, null);
    
    // 写入Shapefile
    WktLayerConverter.toShapefile(wktLayer, shpPath, GisEngineType.GEOTOOLS);
}
```

### 案例2：Shapefile转TXT

```java
/**
 * Shapefile转国土TXT
 */
public void shp2Txt(String shpPath, String txtPath, Integer targetDh) {
    // 读取Shapefile
    WktLayer wktLayer = WktLayerConverter.fromShapefile(
        shpPath, null, null, GisEngineType.GEOTOOLS);
    
    // 转换为TxtLayer
    TxtLayer txtLayer = TxtLayerUtil.parseWktLayerToTxtLayer(
        wktLayer, null, null, targetDh);
    
    // 保存TXT
    TxtLayerUtil.saveTxt(txtLayer, txtPath);
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
            String shpName = FileUtil.mainName(txtFile) + ".shp";
            String shpPath = outputDir + File.separator + shpName;
            
            txt2Shp(txtFile.getAbsolutePath(), shpPath);
            System.out.println("转换成功: " + txtFile.getName());
        } catch (Exception e) {
            System.err.println("转换失败: " + txtFile.getName() + " - " + e.getMessage());
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
        TxtLayer txtLayer = TxtLayerUtil.loadTxt(txtPath);
        WktLayer wktLayer = TxtLayerUtil.parseTxtLayerToWktLayer(txtLayer, null);
        
        for (WktFeature feature : wktLayer.getFeatures()) {
            Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
            
            // 检查几何有效性
            if (!geom.isValid()) {
                errors.add("地块 " + feature.getWfId() + " 几何无效");
            }
            
            // 检查面积
            double area = geom.getArea();
            if (area <= 0) {
                errors.add("地块 " + feature.getWfId() + " 面积为0或负数");
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
        Integer sourceDh, Integer targetDh) {
    // 读取并转换为WktLayer
    TxtLayer txtLayer = TxtLayerUtil.loadTxt(inputPath);
    WktLayer wktLayer = TxtLayerUtil.parseTxtLayerToWktLayer(txtLayer, null);
    
    // 坐标转换
    int targetWkid = CrsUtil.getProjectedWkid(targetDh);
    wktLayer = CrsUtil.reproject(wktLayer, targetWkid);
    
    // 转回TXT格式
    TxtLayer newTxtLayer = TxtLayerUtil.parseWktLayerToTxtLayer(
        wktLayer, txtLayer, null, targetDh);
    
    // 保存
    TxtLayerUtil.saveTxt(newTxtLayer, outputPath);
}
```

## 常见问题

### 1. 坐标顺序问题

**问题**：TXT中Y是北方向，X是东方向，与常见GIS软件相反

**解决**：转换时注意坐标对应关系
```java
// TXT → JTS
new Coordinate(txtCoord.getX(), txtCoord.getY())  // X是东，Y是北

// JTS → TXT  
txtCoord.setX(coordinate.getX());  // 东方向
txtCoord.setY(coordinate.getY());  // 北方向
```

### 2. 内环方向

**问题**：多边形内环（岛洞）方向错误导致几何无效

**解决**：确保外环逆时针，内环顺时针，或使用几何修复

### 3. 编码问题

**问题**：中文乱码

**解决**：自动检测文件编码，输出使用UTF-8

### 4. 精度损失

**问题**：坐标精度在转换过程中损失

**解决**：使用足够的小数位数（建议保留2-3位）

## 小结

本章介绍了国土TXT格式的核心内容：

1. **文件结构**：属性描述、扩展信息、地块坐标三个部分
2. **数据模型**：TxtLayer、TxtFeature、TxtCoordinate
3. **格式转换**：TXT与WktLayer互转
4. **读写操作**：解析和生成TXT文件
5. **实践案例**：格式转换、数据验证、坐标转换

下一章将介绍不同数据格式之间的转换方法总结。
