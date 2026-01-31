---
layout: default
title: 第08章 - Java绑定开发指南
---

# 第08章：Java绑定开发指南

## 8.1 Java GDAL 简介

### 8.1.1 概述

GDAL Java 绑定通过 SWIG（Simplified Wrapper and Interface Generator）生成，允许 Java 开发者使用 GDAL 的全部功能。Java 绑定特别适合企业级 GIS 应用开发。

```
┌─────────────────────────────────────────────────────────────┐
│                    Java GDAL 架构                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                Java 应用层                           │   │
│   │    GeoServer │ GeoTools │ 自定义应用                │   │
│   └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              GDAL Java 绑定                          │   │
│   │    org.gdal.gdal │ org.gdal.ogr │ org.gdal.osr     │   │
│   └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼ JNI                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              GDAL 本地库 (C/C++)                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.1.2 主要特点

| 特点 | 说明 |
|-----|------|
| **企业级支持** | 适合大型企业应用 |
| **类型安全** | Java 强类型系统提供编译时检查 |
| **多线程** | Java 优秀的多线程支持 |
| **生态丰富** | 可与 GeoTools、JTS 等库集成 |
| **跨平台** | 通过 JNI 支持多平台 |

## 8.2 环境配置

### 8.2.1 Maven 依赖配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>gdal-java-demo</artifactId>
    <version>1.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <gdal.version>3.7.0</gdal.version>
    </properties>

    <dependencies>
        <!-- GDAL Java 绑定 -->
        <dependency>
            <groupId>org.gdal</groupId>
            <artifactId>gdal</artifactId>
            <version>${gdal.version}</version>
        </dependency>
        
        <!-- JUnit 5 测试 -->
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.9.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>11</source>
                    <target>11</target>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### 8.2.2 本地库配置

```java
package com.example.gdal;

import org.gdal.gdal.gdal;
import org.gdal.ogr.ogr;
import org.gdal.osr.osr;

/**
 * GDAL 初始化工具类
 */
public class GdalInitializer {
    
    private static boolean initialized = false;
    
    /**
     * 初始化 GDAL
     */
    public static synchronized void initialize() {
        if (initialized) {
            return;
        }
        
        // 设置本地库路径（根据实际安装位置调整）
        String osName = System.getProperty("os.name").toLowerCase();
        String libraryPath;
        
        if (osName.contains("windows")) {
            libraryPath = "C:\\OSGeo4W\\bin";
        } else if (osName.contains("linux")) {
            libraryPath = "/usr/lib/jni";
        } else if (osName.contains("mac")) {
            libraryPath = "/usr/local/lib";
        } else {
            throw new RuntimeException("不支持的操作系统: " + osName);
        }
        
        // 添加到系统路径
        String currentPath = System.getProperty("java.library.path");
        System.setProperty("java.library.path", currentPath + ":" + libraryPath);
        
        // 注册所有驱动
        gdal.AllRegister();
        ogr.RegisterAll();
        
        // 设置配置选项
        gdal.SetConfigOption("GDAL_DATA", getGdalDataPath());
        gdal.SetConfigOption("PROJ_LIB", getProjDataPath());
        
        // 设置错误处理
        gdal.SetConfigOption("CPL_DEBUG", "OFF");
        
        initialized = true;
        
        System.out.println("GDAL 版本: " + gdal.VersionInfo("VERSION_NUM"));
        System.out.println("驱动数量: " + gdal.GetDriverCount());
    }
    
    private static String getGdalDataPath() {
        String osName = System.getProperty("os.name").toLowerCase();
        if (osName.contains("windows")) {
            return "C:\\OSGeo4W\\share\\gdal";
        } else {
            return "/usr/share/gdal";
        }
    }
    
    private static String getProjDataPath() {
        String osName = System.getProperty("os.name").toLowerCase();
        if (osName.contains("windows")) {
            return "C:\\OSGeo4W\\share\\proj";
        } else {
            return "/usr/share/proj";
        }
    }
    
    /**
     * 检查 GDAL 是否可用
     */
    public static boolean isAvailable() {
        try {
            initialize();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
```

### 8.2.3 Gradle 配置

```groovy
// build.gradle
plugins {
    id 'java'
    id 'application'
}

group = 'com.example'
version = '1.0-SNAPSHOT'

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.gdal:gdal:3.7.0'
    
    testImplementation 'org.junit.jupiter:junit-jupiter:5.9.2'
}

java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}

application {
    mainClass = 'com.example.gdal.Main'
}

test {
    useJUnitPlatform()
}

// 设置本地库路径
tasks.withType(JavaExec) {
    systemProperty 'java.library.path', '/usr/lib/jni'
}
```

## 8.3 栅格数据处理

### 8.3.1 读取栅格数据

```java
package com.example.gdal.raster;

import org.gdal.gdal.gdal;
import org.gdal.gdal.Dataset;
import org.gdal.gdal.Band;
import org.gdal.gdal.Driver;
import org.gdal.osr.SpatialReference;

/**
 * 栅格数据读取示例
 */
public class RasterReader {
    
    static {
        gdal.AllRegister();
    }
    
    /**
     * 读取栅格数据基本信息
     */
    public static void readRasterInfo(String filepath) {
        Dataset ds = gdal.Open(filepath);
        
        if (ds == null) {
            System.err.println("无法打开文件: " + filepath);
            return;
        }
        
        try {
            // 基本信息
            System.out.println("文件: " + ds.GetDescription());
            System.out.println("驱动: " + ds.GetDriver().getShortName());
            System.out.println("宽度: " + ds.getRasterXSize());
            System.out.println("高度: " + ds.getRasterYSize());
            System.out.println("波段数: " + ds.getRasterCount());
            
            // 地理变换
            double[] geoTransform = ds.GetGeoTransform();
            if (geoTransform != null) {
                System.out.println("原点X: " + geoTransform[0]);
                System.out.println("原点Y: " + geoTransform[3]);
                System.out.println("像素宽度: " + geoTransform[1]);
                System.out.println("像素高度: " + geoTransform[5]);
            }
            
            // 投影信息
            String projection = ds.GetProjection();
            if (projection != null && !projection.isEmpty()) {
                SpatialReference srs = new SpatialReference(projection);
                System.out.println("坐标系: " + srs.GetName());
            }
            
            // 波段信息
            for (int i = 1; i <= ds.getRasterCount(); i++) {
                Band band = ds.GetRasterBand(i);
                System.out.println("\n波段 " + i + ":");
                System.out.println("  数据类型: " + gdal.GetDataTypeName(band.getDataType()));
                
                Double[] nodata = new Double[1];
                band.GetNoDataValue(nodata);
                if (nodata[0] != null) {
                    System.out.println("  无效值: " + nodata[0]);
                }
                
                double[] minMax = new double[2];
                band.ComputeRasterMinMax(minMax);
                System.out.println("  最小值: " + minMax[0]);
                System.out.println("  最大值: " + minMax[1]);
            }
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 读取栅格数据为数组
     */
    public static double[][] readBandAsArray(String filepath, int bandIndex) {
        Dataset ds = gdal.Open(filepath);
        
        if (ds == null) {
            throw new RuntimeException("无法打开文件: " + filepath);
        }
        
        try {
            int width = ds.getRasterXSize();
            int height = ds.getRasterYSize();
            
            Band band = ds.GetRasterBand(bandIndex);
            
            double[] data = new double[width * height];
            band.ReadRaster(0, 0, width, height, data);
            
            // 转换为二维数组
            double[][] result = new double[height][width];
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    result[y][x] = data[y * width + x];
                }
            }
            
            return result;
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 分块读取栅格数据
     */
    public static void readRasterInBlocks(String filepath, BlockProcessor processor) {
        Dataset ds = gdal.Open(filepath);
        
        if (ds == null) {
            throw new RuntimeException("无法打开文件: " + filepath);
        }
        
        try {
            int width = ds.getRasterXSize();
            int height = ds.getRasterYSize();
            Band band = ds.GetRasterBand(1);
            
            int[] blockSize = new int[2];
            band.GetBlockSize(blockSize);
            int blockWidth = blockSize[0];
            int blockHeight = blockSize[1];
            
            System.out.println("块大小: " + blockWidth + " x " + blockHeight);
            
            for (int y = 0; y < height; y += blockHeight) {
                for (int x = 0; x < width; x += blockWidth) {
                    int actualWidth = Math.min(blockWidth, width - x);
                    int actualHeight = Math.min(blockHeight, height - y);
                    
                    double[] data = new double[actualWidth * actualHeight];
                    band.ReadRaster(x, y, actualWidth, actualHeight, data);
                    
                    processor.process(x, y, actualWidth, actualHeight, data);
                }
            }
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 块处理接口
     */
    public interface BlockProcessor {
        void process(int xOff, int yOff, int width, int height, double[] data);
    }
    
    public static void main(String[] args) {
        if (args.length < 1) {
            System.out.println("用法: java RasterReader <文件路径>");
            return;
        }
        
        readRasterInfo(args[0]);
    }
}
```

### 8.3.2 创建栅格数据

```java
package com.example.gdal.raster;

import org.gdal.gdal.gdal;
import org.gdal.gdal.Dataset;
import org.gdal.gdal.Band;
import org.gdal.gdal.Driver;
import org.gdal.gdalconst.gdalconstConstants;
import org.gdal.osr.SpatialReference;

import java.util.Vector;

/**
 * 栅格数据创建示例
 */
public class RasterWriter {
    
    static {
        gdal.AllRegister();
    }
    
    /**
     * 创建 GeoTIFF 文件
     */
    public static void createGeoTiff(
            String filepath,
            int width,
            int height,
            int bands,
            int dataType,
            double[] geoTransform,
            int epsg,
            double[][] data
    ) {
        Driver driver = gdal.GetDriverByName("GTiff");
        
        if (driver == null) {
            throw new RuntimeException("GTiff 驱动不可用");
        }
        
        // 创建选项
        Vector<String> options = new Vector<>();
        options.add("COMPRESS=LZW");
        options.add("TILED=YES");
        options.add("BLOCKXSIZE=256");
        options.add("BLOCKYSIZE=256");
        
        // 创建数据集
        Dataset ds = driver.Create(filepath, width, height, bands, dataType, options);
        
        if (ds == null) {
            throw new RuntimeException("无法创建文件: " + filepath);
        }
        
        try {
            // 设置地理变换
            if (geoTransform != null) {
                ds.SetGeoTransform(geoTransform);
            }
            
            // 设置投影
            if (epsg > 0) {
                SpatialReference srs = new SpatialReference();
                srs.ImportFromEPSG(epsg);
                ds.SetProjection(srs.ExportToWkt());
            }
            
            // 写入数据
            if (data != null) {
                for (int b = 0; b < bands && b < data.length; b++) {
                    Band band = ds.GetRasterBand(b + 1);
                    
                    // 转换为一维数组
                    double[] flatData = new double[width * height];
                    for (int y = 0; y < height; y++) {
                        for (int x = 0; x < width; x++) {
                            flatData[y * width + x] = data[b][y * width + x];
                        }
                    }
                    
                    band.WriteRaster(0, 0, width, height, flatData);
                    band.SetNoDataValue(-9999);
                    band.ComputeStatistics(false);
                }
            }
            
            ds.FlushCache();
            
            System.out.println("创建完成: " + filepath);
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 创建简单的 DEM 示例
     */
    public static void createSampleDEM(String filepath) {
        int width = 1000;
        int height = 1000;
        
        // 生成模拟高程数据
        double[][] data = new double[1][width * height];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                // 简单的高程模型
                double elevation = 100 + 
                    50 * Math.sin(x * Math.PI / 100) * Math.cos(y * Math.PI / 100) +
                    Math.random() * 10;
                data[0][y * width + x] = elevation;
            }
        }
        
        // 地理变换（覆盖北京区域）
        double[] geoTransform = {
            116.0,   // 原点X
            0.001,   // 像素宽度
            0,       // 旋转
            40.0,    // 原点Y
            0,       // 旋转
            -0.001   // 像素高度（负值）
        };
        
        createGeoTiff(filepath, width, height, 1, 
                     gdalconstConstants.GDT_Float32, geoTransform, 4326, data);
    }
    
    /**
     * 复制栅格并修改
     */
    public static void copyAndModify(String srcPath, String dstPath) {
        Dataset srcDs = gdal.Open(srcPath);
        
        if (srcDs == null) {
            throw new RuntimeException("无法打开源文件: " + srcPath);
        }
        
        try {
            Driver driver = gdal.GetDriverByName("GTiff");
            
            // 使用 CreateCopy 复制
            Vector<String> options = new Vector<>();
            options.add("COMPRESS=LZW");
            
            Dataset dstDs = driver.CreateCopy(dstPath, srcDs, 0, options);
            
            if (dstDs != null) {
                // 可以对复制后的数据进行修改
                dstDs.FlushCache();
                dstDs.delete();
            }
            
        } finally {
            srcDs.delete();
        }
    }
    
    public static void main(String[] args) {
        createSampleDEM("sample_dem.tif");
    }
}
```

### 8.3.3 栅格处理操作

```java
package com.example.gdal.raster;

import org.gdal.gdal.gdal;
import org.gdal.gdal.Dataset;
import org.gdal.gdal.WarpOptions;
import org.gdal.gdal.TranslateOptions;
import org.gdal.gdal.BuildVRTOptions;

import java.util.Vector;

/**
 * 栅格处理操作示例
 */
public class RasterProcessor {
    
    static {
        gdal.AllRegister();
    }
    
    /**
     * 重投影栅格
     */
    public static void reproject(String srcPath, String dstPath, String dstSRS) {
        Dataset srcDs = gdal.Open(srcPath);
        
        if (srcDs == null) {
            throw new RuntimeException("无法打开文件: " + srcPath);
        }
        
        try {
            Vector<String> options = new Vector<>();
            options.add("-t_srs");
            options.add(dstSRS);
            options.add("-r");
            options.add("bilinear");
            options.add("-co");
            options.add("COMPRESS=LZW");
            options.add("-co");
            options.add("TILED=YES");
            
            WarpOptions warpOptions = new WarpOptions(options);
            
            Dataset[] srcDatasets = {srcDs};
            Dataset dstDs = gdal.Warp(dstPath, srcDatasets, warpOptions);
            
            if (dstDs != null) {
                dstDs.delete();
            }
            
            System.out.println("重投影完成: " + dstPath);
            
        } finally {
            srcDs.delete();
        }
    }
    
    /**
     * 裁剪栅格
     */
    public static void clip(String srcPath, String dstPath, 
                           double minX, double minY, double maxX, double maxY) {
        Dataset srcDs = gdal.Open(srcPath);
        
        if (srcDs == null) {
            throw new RuntimeException("无法打开文件: " + srcPath);
        }
        
        try {
            Vector<String> options = new Vector<>();
            options.add("-projwin");
            options.add(String.valueOf(minX));
            options.add(String.valueOf(maxY));
            options.add(String.valueOf(maxX));
            options.add(String.valueOf(minY));
            options.add("-co");
            options.add("COMPRESS=LZW");
            
            TranslateOptions translateOptions = new TranslateOptions(options);
            
            Dataset dstDs = gdal.Translate(dstPath, srcDs, translateOptions);
            
            if (dstDs != null) {
                dstDs.delete();
            }
            
            System.out.println("裁剪完成: " + dstPath);
            
        } finally {
            srcDs.delete();
        }
    }
    
    /**
     * 使用矢量边界裁剪
     */
    public static void clipByVector(String srcPath, String dstPath, String cutlinePath) {
        Dataset srcDs = gdal.Open(srcPath);
        
        if (srcDs == null) {
            throw new RuntimeException("无法打开文件: " + srcPath);
        }
        
        try {
            Vector<String> options = new Vector<>();
            options.add("-cutline");
            options.add(cutlinePath);
            options.add("-crop_to_cutline");
            options.add("-dstnodata");
            options.add("-9999");
            options.add("-co");
            options.add("COMPRESS=LZW");
            
            WarpOptions warpOptions = new WarpOptions(options);
            
            Dataset[] srcDatasets = {srcDs};
            Dataset dstDs = gdal.Warp(dstPath, srcDatasets, warpOptions);
            
            if (dstDs != null) {
                dstDs.delete();
            }
            
        } finally {
            srcDs.delete();
        }
    }
    
    /**
     * 镶嵌多个栅格
     */
    public static void mosaic(String[] srcPaths, String dstPath) {
        Dataset[] srcDatasets = new Dataset[srcPaths.length];
        
        try {
            // 打开所有源文件
            for (int i = 0; i < srcPaths.length; i++) {
                srcDatasets[i] = gdal.Open(srcPaths[i]);
                if (srcDatasets[i] == null) {
                    throw new RuntimeException("无法打开文件: " + srcPaths[i]);
                }
            }
            
            // 创建 VRT
            Vector<String> vrtOptions = new Vector<>();
            BuildVRTOptions buildVRTOptions = new BuildVRTOptions(vrtOptions);
            
            Dataset vrtDs = gdal.BuildVRT("", srcDatasets, buildVRTOptions);
            
            if (vrtDs != null) {
                // 转换为 GeoTIFF
                Vector<String> translateOptions = new Vector<>();
                translateOptions.add("-co");
                translateOptions.add("COMPRESS=LZW");
                translateOptions.add("-co");
                translateOptions.add("TILED=YES");
                translateOptions.add("-co");
                translateOptions.add("BIGTIFF=IF_SAFER");
                
                TranslateOptions options = new TranslateOptions(translateOptions);
                Dataset dstDs = gdal.Translate(dstPath, vrtDs, options);
                
                if (dstDs != null) {
                    dstDs.delete();
                }
                
                vrtDs.delete();
            }
            
            System.out.println("镶嵌完成: " + dstPath);
            
        } finally {
            for (Dataset ds : srcDatasets) {
                if (ds != null) {
                    ds.delete();
                }
            }
        }
    }
    
    /**
     * 格式转换
     */
    public static void convert(String srcPath, String dstPath, String format) {
        Dataset srcDs = gdal.Open(srcPath);
        
        if (srcDs == null) {
            throw new RuntimeException("无法打开文件: " + srcPath);
        }
        
        try {
            Vector<String> options = new Vector<>();
            options.add("-of");
            options.add(format);
            
            TranslateOptions translateOptions = new TranslateOptions(options);
            
            Dataset dstDs = gdal.Translate(dstPath, srcDs, translateOptions);
            
            if (dstDs != null) {
                dstDs.delete();
            }
            
        } finally {
            srcDs.delete();
        }
    }
    
    public static void main(String[] args) {
        // 示例：重投影
        // reproject("input.tif", "output.tif", "EPSG:3857");
        
        // 示例：裁剪
        // clip("input.tif", "clipped.tif", 116.0, 39.0, 117.0, 40.0);
    }
}
```

## 8.4 矢量数据处理

### 8.4.1 读取矢量数据

```java
package com.example.gdal.vector;

import org.gdal.ogr.*;
import org.gdal.osr.SpatialReference;

/**
 * 矢量数据读取示例
 */
public class VectorReader {
    
    static {
        ogr.RegisterAll();
    }
    
    /**
     * 读取矢量数据信息
     */
    public static void readVectorInfo(String filepath) {
        DataSource ds = ogr.Open(filepath, false);
        
        if (ds == null) {
            System.err.println("无法打开文件: " + filepath);
            return;
        }
        
        try {
            System.out.println("数据源: " + ds.GetDescription());
            System.out.println("图层数: " + ds.GetLayerCount());
            
            for (int i = 0; i < ds.GetLayerCount(); i++) {
                Layer layer = ds.GetLayer(i);
                
                System.out.println("\n图层 " + i + ": " + layer.GetName());
                System.out.println("  要素数: " + layer.GetFeatureCount());
                System.out.println("  几何类型: " + 
                    ogr.GeometryTypeToName(layer.GetGeomType()));
                
                // 范围
                double[] extent = layer.GetExtent();
                if (extent != null) {
                    System.out.printf("  范围: (%.4f, %.4f) - (%.4f, %.4f)%n",
                        extent[0], extent[2], extent[1], extent[3]);
                }
                
                // 空间参考
                SpatialReference srs = layer.GetSpatialRef();
                if (srs != null) {
                    System.out.println("  坐标系: " + srs.GetName());
                }
                
                // 字段定义
                FeatureDefn layerDefn = layer.GetLayerDefn();
                System.out.println("  字段数: " + layerDefn.GetFieldCount());
                
                for (int j = 0; j < layerDefn.GetFieldCount(); j++) {
                    FieldDefn fieldDefn = layerDefn.GetFieldDefn(j);
                    System.out.printf("    - %s: %s(%d)%n",
                        fieldDefn.GetName(),
                        fieldDefn.GetTypeName(),
                        fieldDefn.GetWidth());
                }
            }
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 遍历要素
     */
    public static void iterateFeatures(String filepath) {
        DataSource ds = ogr.Open(filepath, false);
        
        if (ds == null) {
            throw new RuntimeException("无法打开文件: " + filepath);
        }
        
        try {
            Layer layer = ds.GetLayer(0);
            
            Feature feature;
            layer.ResetReading();
            
            while ((feature = layer.GetNextFeature()) != null) {
                long fid = feature.GetFID();
                
                // 获取几何
                Geometry geom = feature.GetGeometryRef();
                if (geom != null) {
                    String wkt = geom.ExportToWkt();
                    System.out.println("FID: " + fid + ", 几何: " + 
                        wkt.substring(0, Math.min(50, wkt.length())) + "...");
                }
                
                // 获取属性
                FeatureDefn defn = layer.GetLayerDefn();
                for (int i = 0; i < defn.GetFieldCount(); i++) {
                    String fieldName = defn.GetFieldDefn(i).GetName();
                    String value = feature.GetFieldAsString(i);
                    System.out.println("  " + fieldName + ": " + value);
                }
                
                feature.delete();
            }
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 使用过滤器查询
     */
    public static void queryFeatures(String filepath, String whereClause) {
        DataSource ds = ogr.Open(filepath, false);
        
        if (ds == null) {
            throw new RuntimeException("无法打开文件: " + filepath);
        }
        
        try {
            Layer layer = ds.GetLayer(0);
            
            // 设置属性过滤器
            layer.SetAttributeFilter(whereClause);
            
            System.out.println("满足条件的要素数: " + layer.GetFeatureCount());
            
            Feature feature;
            while ((feature = layer.GetNextFeature()) != null) {
                System.out.println("FID: " + feature.GetFID());
                feature.delete();
            }
            
            // 清除过滤器
            layer.SetAttributeFilter(null);
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 空间查询
     */
    public static void spatialQuery(String filepath, 
                                    double minX, double minY, 
                                    double maxX, double maxY) {
        DataSource ds = ogr.Open(filepath, false);
        
        if (ds == null) {
            throw new RuntimeException("无法打开文件: " + filepath);
        }
        
        try {
            Layer layer = ds.GetLayer(0);
            
            // 设置空间过滤器
            layer.SetSpatialFilterRect(minX, minY, maxX, maxY);
            
            System.out.println("空间范围内的要素数: " + layer.GetFeatureCount());
            
            Feature feature;
            while ((feature = layer.GetNextFeature()) != null) {
                System.out.println("FID: " + feature.GetFID());
                feature.delete();
            }
            
            // 清除过滤器
            layer.SetSpatialFilter(null);
            
        } finally {
            ds.delete();
        }
    }
    
    public static void main(String[] args) {
        if (args.length < 1) {
            System.out.println("用法: java VectorReader <文件路径>");
            return;
        }
        
        readVectorInfo(args[0]);
    }
}
```

### 8.4.2 创建矢量数据

```java
package com.example.gdal.vector;

import org.gdal.ogr.*;
import org.gdal.osr.SpatialReference;

import java.util.List;
import java.util.Map;

/**
 * 矢量数据创建示例
 */
public class VectorWriter {
    
    static {
        ogr.RegisterAll();
    }
    
    /**
     * 创建 Shapefile
     */
    public static void createShapefile(
            String filepath,
            int geomType,
            int epsg,
            List<FieldDefinition> fields,
            List<Map<String, Object>> features
    ) {
        Driver driver = ogr.GetDriverByName("ESRI Shapefile");
        
        if (driver == null) {
            throw new RuntimeException("Shapefile 驱动不可用");
        }
        
        // 删除已存在的文件
        driver.DeleteDataSource(filepath);
        
        // 创建数据源
        DataSource ds = driver.CreateDataSource(filepath);
        
        if (ds == null) {
            throw new RuntimeException("无法创建数据源: " + filepath);
        }
        
        try {
            // 创建空间参考
            SpatialReference srs = new SpatialReference();
            srs.ImportFromEPSG(epsg);
            
            // 创建图层
            Layer layer = ds.CreateLayer("layer", srs, geomType);
            
            // 创建字段
            for (FieldDefinition field : fields) {
                FieldDefn fieldDefn = new FieldDefn(field.name, field.type);
                if (field.width > 0) {
                    fieldDefn.SetWidth(field.width);
                }
                if (field.precision > 0) {
                    fieldDefn.SetPrecision(field.precision);
                }
                layer.CreateField(fieldDefn);
            }
            
            // 获取图层定义
            FeatureDefn layerDefn = layer.GetLayerDefn();
            
            // 添加要素
            for (Map<String, Object> featureData : features) {
                Feature feature = new Feature(layerDefn);
                
                // 设置几何
                Object geomObj = featureData.get("geometry");
                if (geomObj instanceof String) {
                    Geometry geom = Geometry.CreateFromWkt((String) geomObj);
                    feature.SetGeometry(geom);
                } else if (geomObj instanceof Geometry) {
                    feature.SetGeometry((Geometry) geomObj);
                }
                
                // 设置属性
                for (FieldDefinition field : fields) {
                    Object value = featureData.get(field.name);
                    if (value != null) {
                        if (value instanceof Integer) {
                            feature.SetField(field.name, (Integer) value);
                        } else if (value instanceof Long) {
                            feature.SetField(field.name, (Long) value);
                        } else if (value instanceof Double) {
                            feature.SetField(field.name, (Double) value);
                        } else {
                            feature.SetField(field.name, value.toString());
                        }
                    }
                }
                
                layer.CreateFeature(feature);
                feature.delete();
            }
            
            System.out.println("创建完成: " + filepath);
            
        } finally {
            ds.delete();
        }
    }
    
    /**
     * 字段定义类
     */
    public static class FieldDefinition {
        public String name;
        public int type;
        public int width;
        public int precision;
        
        public FieldDefinition(String name, int type) {
            this(name, type, 0, 0);
        }
        
        public FieldDefinition(String name, int type, int width) {
            this(name, type, width, 0);
        }
        
        public FieldDefinition(String name, int type, int width, int precision) {
            this.name = name;
            this.type = type;
            this.width = width;
            this.precision = precision;
        }
    }
    
    /**
     * 创建 GeoJSON
     */
    public static void createGeoJSON(
            String filepath,
            int geomType,
            int epsg,
            List<FieldDefinition> fields,
            List<Map<String, Object>> features
    ) {
        Driver driver = ogr.GetDriverByName("GeoJSON");
        
        if (driver == null) {
            throw new RuntimeException("GeoJSON 驱动不可用");
        }
        
        DataSource ds = driver.CreateDataSource(filepath);
        
        try {
            SpatialReference srs = new SpatialReference();
            srs.ImportFromEPSG(epsg);
            
            Layer layer = ds.CreateLayer("features", srs, geomType);
            
            for (FieldDefinition field : fields) {
                FieldDefn fieldDefn = new FieldDefn(field.name, field.type);
                layer.CreateField(fieldDefn);
            }
            
            FeatureDefn layerDefn = layer.GetLayerDefn();
            
            for (Map<String, Object> featureData : features) {
                Feature feature = new Feature(layerDefn);
                
                Object geomObj = featureData.get("geometry");
                if (geomObj instanceof String) {
                    Geometry geom = Geometry.CreateFromWkt((String) geomObj);
                    feature.SetGeometry(geom);
                }
                
                for (FieldDefinition field : fields) {
                    Object value = featureData.get(field.name);
                    if (value != null) {
                        feature.SetField(field.name, value.toString());
                    }
                }
                
                layer.CreateFeature(feature);
                feature.delete();
            }
            
        } finally {
            ds.delete();
        }
    }
    
    public static void main(String[] args) {
        // 示例：创建点 Shapefile
        List<FieldDefinition> fields = List.of(
            new FieldDefinition("name", ogr.OFTString, 50),
            new FieldDefinition("population", ogr.OFTInteger64)
        );
        
        List<Map<String, Object>> features = List.of(
            Map.of("geometry", "POINT(116.4 39.9)", "name", "北京", "population", 21540000L),
            Map.of("geometry", "POINT(121.5 31.2)", "name", "上海", "population", 24280000L)
        );
        
        createShapefile("cities.shp", ogr.wkbPoint, 4326, fields, features);
    }
}
```

## 8.5 坐标转换

```java
package com.example.gdal.coord;

import org.gdal.osr.SpatialReference;
import org.gdal.osr.CoordinateTransformation;
import org.gdal.ogr.Geometry;

/**
 * 坐标转换示例
 */
public class CoordinateTransformer {
    
    /**
     * 转换坐标点
     */
    public static double[] transformPoint(
            double x, double y,
            int srcEPSG, int dstEPSG
    ) {
        SpatialReference srcSRS = new SpatialReference();
        srcSRS.ImportFromEPSG(srcEPSG);
        
        SpatialReference dstSRS = new SpatialReference();
        dstSRS.ImportFromEPSG(dstEPSG);
        
        CoordinateTransformation transform = 
            new CoordinateTransformation(srcSRS, dstSRS);
        
        double[] result = new double[3];
        transform.TransformPoint(result, x, y, 0);
        
        return new double[]{result[0], result[1]};
    }
    
    /**
     * 转换几何对象
     */
    public static Geometry transformGeometry(
            Geometry geom,
            int srcEPSG, int dstEPSG
    ) {
        SpatialReference srcSRS = new SpatialReference();
        srcSRS.ImportFromEPSG(srcEPSG);
        
        SpatialReference dstSRS = new SpatialReference();
        dstSRS.ImportFromEPSG(dstEPSG);
        
        CoordinateTransformation transform = 
            new CoordinateTransformation(srcSRS, dstSRS);
        
        Geometry newGeom = geom.Clone();
        newGeom.Transform(transform);
        
        return newGeom;
    }
    
    /**
     * 批量转换坐标
     */
    public static double[][] transformPoints(
            double[][] points,
            int srcEPSG, int dstEPSG
    ) {
        SpatialReference srcSRS = new SpatialReference();
        srcSRS.ImportFromEPSG(srcEPSG);
        
        SpatialReference dstSRS = new SpatialReference();
        dstSRS.ImportFromEPSG(dstEPSG);
        
        CoordinateTransformation transform = 
            new CoordinateTransformation(srcSRS, dstSRS);
        
        double[][] results = new double[points.length][2];
        
        for (int i = 0; i < points.length; i++) {
            double[] result = new double[3];
            transform.TransformPoint(result, points[i][0], points[i][1], 0);
            results[i][0] = result[0];
            results[i][1] = result[1];
        }
        
        return results;
    }
    
    public static void main(String[] args) {
        // WGS84 转 Web Mercator
        double[] result = transformPoint(116.4, 39.9, 4326, 3857);
        System.out.printf("WGS84 (116.4, 39.9) -> Web Mercator (%.2f, %.2f)%n",
            result[0], result[1]);
        
        // 几何转换
        Geometry point = Geometry.CreateFromWkt("POINT(116.4 39.9)");
        Geometry transformed = transformGeometry(point, 4326, 3857);
        System.out.println("转换后: " + transformed.ExportToWkt());
    }
}
```

## 8.6 最佳实践

### 8.6.1 资源管理

```java
package com.example.gdal.utils;

import org.gdal.gdal.Dataset;
import org.gdal.ogr.DataSource;

/**
 * 资源管理工具类
 */
public class GdalResource implements AutoCloseable {
    
    private Dataset rasterDs;
    private DataSource vectorDs;
    
    public GdalResource(Dataset ds) {
        this.rasterDs = ds;
    }
    
    public GdalResource(DataSource ds) {
        this.vectorDs = ds;
    }
    
    public Dataset getRasterDataset() {
        return rasterDs;
    }
    
    public DataSource getVectorDataSource() {
        return vectorDs;
    }
    
    @Override
    public void close() {
        if (rasterDs != null) {
            rasterDs.delete();
            rasterDs = null;
        }
        if (vectorDs != null) {
            vectorDs.delete();
            vectorDs = null;
        }
    }
    
    /**
     * 打开栅格数据集
     */
    public static GdalResource openRaster(String filepath) {
        Dataset ds = org.gdal.gdal.gdal.Open(filepath);
        if (ds == null) {
            throw new RuntimeException("无法打开: " + filepath);
        }
        return new GdalResource(ds);
    }
    
    /**
     * 打开矢量数据源
     */
    public static GdalResource openVector(String filepath) {
        DataSource ds = org.gdal.ogr.ogr.Open(filepath, false);
        if (ds == null) {
            throw new RuntimeException("无法打开: " + filepath);
        }
        return new GdalResource(ds);
    }
}

// 使用示例
// try (GdalResource res = GdalResource.openRaster("input.tif")) {
//     Dataset ds = res.getRasterDataset();
//     // 处理数据...
// }
```

## 8.7 本章小结

本章介绍了 Java GDAL 开发的核心内容：

1. **环境配置**：Maven/Gradle 依赖和本地库配置
2. **栅格处理**：读取、创建和处理栅格数据
3. **矢量处理**：读取、创建和查询矢量数据
4. **坐标转换**：使用 OSR 进行坐标转换
5. **最佳实践**：资源管理和错误处理

## 8.8 思考与练习

1. 比较 Java GDAL 与 GeoTools 的优缺点。
2. 如何处理 JNI 相关的内存泄漏问题？
3. 实现一个支持多线程的栅格处理类。
4. 编写一个矢量格式转换工具。
5. 如何在 Spring Boot 项目中集成 GDAL？

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第07章-Python绑定开发指南" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第09章-CSharp绑定开发指南" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
