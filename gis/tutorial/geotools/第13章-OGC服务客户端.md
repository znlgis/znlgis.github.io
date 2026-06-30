---
layout: default
title: 第13章 - OGC服务客户端
---

# 第13章 - OGC服务客户端

## 13.1 OGC 服务概述

### 13.1.1 主要 OGC 服务

| 服务 | 全称 | 功能 | GeoTools 模块 |
|------|------|------|---------------|
| WMS | Web Map Service | 地图图片服务 | gt-wms |
| WFS | Web Feature Service | 矢量要素服务 | gt-wfs-ng |
| WCS | Web Coverage Service | 栅格覆盖服务 | gt-wcs |
| WPS | Web Processing Service | 空间处理服务 | gt-wps |
| WMTS | Web Map Tile Service | 地图瓦片服务 | gt-wmts |

## 13.2 WMS 客户端

### 13.2.1 连接 WMS 服务

```java
import org.geotools.ows.wms.WebMapServer;
import org.geotools.ows.wms.WMSCapabilities;
import org.geotools.ows.wms.Layer;

public class WMSClientExample {
    
    public static void connectWMS(String wmsUrl) throws Exception {
        // 连接 WMS 服务
        URL url = new URL(wmsUrl);
        WebMapServer wms = new WebMapServer(url);
        
        // 获取能力文档
        WMSCapabilities capabilities = wms.getCapabilities();
        
        // 服务信息
        System.out.println("服务标题: " + capabilities.getService().getTitle());
        System.out.println("服务摘要: " + capabilities.getService().get_abstract());
        
        // 获取所有图层
        Layer[] layers = WMSUtils.getNamedLayers(capabilities);
        System.out.println("\n可用图层:");
        for (Layer layer : layers) {
            System.out.println("  - " + layer.getName() + ": " + layer.getTitle());
        }
    }
    
    // 获取地图图片
    public static BufferedImage getMap(String wmsUrl, String layerName,
            ReferencedEnvelope bounds, int width, int height) throws Exception {
        
        URL url = new URL(wmsUrl);
        WebMapServer wms = new WebMapServer(url);
        
        GetMapRequest request = wms.createGetMapRequest();
        
        // 查找图层
        Layer[] layers = WMSUtils.getNamedLayers(wms.getCapabilities());
        for (Layer layer : layers) {
            if (layerName.equals(layer.getName())) {
                request.addLayer(layer);
                break;
            }
        }
        
        // 设置参数
        request.setFormat("image/png");
        request.setDimensions(width, height);
        request.setSRS("EPSG:4326");
        request.setBBox(bounds);
        request.setTransparent(true);
        
        // 发送请求
        GetMapResponse response = wms.issueRequest(request);
        
        // 读取图片
        return ImageIO.read(response.getInputStream());
    }
}
```

### 13.2.2 WMS 图层

```java
import org.geotools.ows.wms.map.WMSLayer;

public class WMSLayerExample {
    
    public static void addWMSLayer(MapContent map, String wmsUrl, 
            String layerName) throws Exception {
        
        URL url = new URL(wmsUrl);
        WebMapServer wms = new WebMapServer(url);
        
        // 查找图层
        Layer wmsLayer = null;
        for (Layer l : WMSUtils.getNamedLayers(wms.getCapabilities())) {
            if (layerName.equals(l.getName())) {
                wmsLayer = l;
                break;
            }
        }
        
        if (wmsLayer != null) {
            // 创建 GeoTools 图层
            WMSLayer gtLayer = new WMSLayer(wms, wmsLayer);
            map.addLayer(gtLayer);
        }
    }
}
```

## 13.3 WFS 客户端

### 13.3.1 连接 WFS 服务

```java
import org.geotools.data.wfs.WFSDataStore;
import org.geotools.data.wfs.WFSDataStoreFactory;

public class WFSClientExample {
    
    public static DataStore connectWFS(String wfsUrl) throws Exception {
        Map<String, Object> params = new HashMap<>();
        
        // WFS 连接参数
        params.put(WFSDataStoreFactory.URL.key, wfsUrl);
        params.put(WFSDataStoreFactory.PROTOCOL.key, Boolean.TRUE);  // 使用 POST
        params.put(WFSDataStoreFactory.TIMEOUT.key, 30000);  // 超时30秒
        params.put(WFSDataStoreFactory.BUFFER_SIZE.key, 1000);  // 缓冲区大小
        params.put(WFSDataStoreFactory.TRY_GZIP.key, Boolean.TRUE);  // 使用 GZIP
        
        // 可选：设置版本
        // params.put(WFSDataStoreFactory.WFS_STRATEGY.key, "geoserver");
        
        DataStore store = DataStoreFinder.getDataStore(params);
        
        if (store == null) {
            throw new RuntimeException("无法连接到 WFS 服务");
        }
        
        return store;
    }
    
    public static void exploreWFS(DataStore store) throws Exception {
        // 列出所有图层
        String[] typeNames = store.getTypeNames();
        System.out.println("WFS 图层:");
        for (String name : typeNames) {
            System.out.println("  - " + name);
            
            // 获取 Schema
            SimpleFeatureType schema = store.getSchema(name);
            System.out.println("    几何: " + schema.getGeometryDescriptor().getLocalName());
            System.out.println("    属性数: " + schema.getAttributeCount());
        }
    }
}
```

### 13.3.2 查询 WFS 数据

```java
public class WFSQueryExample {
    
    public static void queryWFS(DataStore store, String typeName) throws Exception {
        SimpleFeatureSource source = store.getFeatureSource(typeName);
        
        // 简单查询
        SimpleFeatureCollection allFeatures = source.getFeatures();
        System.out.println("总要素数: " + allFeatures.size());
        
        // 空间查询
        FilterFactory2 ff = CommonFactoryFinder.getFilterFactory2();
        Filter bboxFilter = ff.bbox(
            ff.property("the_geom"),
            116.0, 39.0, 117.0, 40.0,
            "EPSG:4326"
        );
        
        SimpleFeatureCollection filtered = source.getFeatures(bboxFilter);
        System.out.println("BBOX 过滤后: " + filtered.size());
        
        // 属性查询
        Filter attrFilter = ff.equals(ff.property("name"), ff.literal("Beijing"));
        SimpleFeatureCollection attrFiltered = source.getFeatures(attrFilter);
        
        // 组合查询
        Query query = new Query(typeName);
        query.setFilter(ff.and(bboxFilter, attrFilter));
        query.setMaxFeatures(100);
        query.setPropertyNames("name", "population", "the_geom");
        
        SimpleFeatureCollection result = source.getFeatures(query);
        
        // 遍历结果
        try (SimpleFeatureIterator iter = result.features()) {
            while (iter.hasNext()) {
                SimpleFeature feature = iter.next();
                System.out.println(feature.getAttribute("name"));
            }
        }
    }
}
```

### 13.3.3 WFS-T 事务操作

```java
public class WFSTExample {
    
    public static void wfsTransaction(DataStore store, String typeName) throws Exception {
        SimpleFeatureSource source = store.getFeatureSource(typeName);
        
        if (source instanceof SimpleFeatureStore) {
            SimpleFeatureStore featureStore = (SimpleFeatureStore) source;
            
            // 创建事务
            Transaction transaction = new DefaultTransaction("wfs-t");
            featureStore.setTransaction(transaction);
            
            try {
                // 添加要素
                SimpleFeatureType schema = featureStore.getSchema();
                SimpleFeatureBuilder builder = new SimpleFeatureBuilder(schema);
                
                GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();
                builder.set("the_geom", gf.createPoint(new Coordinate(116.4, 39.9)));
                builder.set("name", "Test Point");
                
                SimpleFeature newFeature = builder.buildFeature(null);
                DefaultFeatureCollection collection = new DefaultFeatureCollection();
                collection.add(newFeature);
                
                List<FeatureId> ids = featureStore.addFeatures(collection);
                System.out.println("添加成功: " + ids);
                
                transaction.commit();
                
            } catch (Exception e) {
                transaction.rollback();
                throw e;
                
            } finally {
                transaction.close();
            }
        }
    }
}
```

## 13.4 WCS 客户端

### 13.4.1 连接 WCS 服务

```java
import org.geotools.ows.wcs.WCSCapabilities;
import org.geotools.coverage.grid.GridCoverage2D;

public class WCSClientExample {
    
    public static void connectWCS(String wcsUrl) throws Exception {
        URL url = new URL(wcsUrl);
        WebCoverageServer wcs = new WebCoverageServer(url);
        
        // 获取能力
        WCSCapabilities capabilities = wcs.getCapabilities();
        
        System.out.println("服务标题: " + capabilities.getService().getTitle());
        
        // 获取覆盖列表
        for (CoverageInfo coverage : capabilities.getContentMetadata()) {
            System.out.println("覆盖: " + coverage.getName());
            System.out.println("  范围: " + coverage.getEnvelope());
        }
    }
    
    // 获取覆盖数据
    public static GridCoverage2D getCoverage(String wcsUrl, String coverageName,
            ReferencedEnvelope bounds, int width, int height) throws Exception {
        
        URL url = new URL(wcsUrl);
        WebCoverageServer wcs = new WebCoverageServer(url);
        
        GetCoverageRequest request = wcs.createGetCoverageRequest();
        request.setCoverage(coverageName);
        request.setDomainSubset(bounds);
        request.setFormat("GeoTIFF");
        
        GetCoverageResponse response = wcs.issueRequest(request);
        
        // 读取栅格数据
        GeoTiffReader reader = new GeoTiffReader(response.getInputStream());
        return reader.read(null);
    }
}
```

## 13.5 WMTS 客户端

### 13.5.1 连接 WMTS 服务

```java
import org.geotools.ows.wmts.WebMapTileServer;
import org.geotools.ows.wmts.model.WMTSCapabilities;
import org.geotools.ows.wmts.model.WMTSLayer;

public class WMTSClientExample {
    
    public static void connectWMTS(String wmtsUrl) throws Exception {
        URL url = new URL(wmtsUrl);
        WebMapTileServer wmts = new WebMapTileServer(url);
        
        WMTSCapabilities capabilities = wmts.getCapabilities();
        
        System.out.println("服务标题: " + capabilities.getService().getTitle());
        
        // 获取图层
        List<WMTSLayer> layers = capabilities.getLayerList();
        for (WMTSLayer layer : layers) {
            System.out.println("图层: " + layer.getName());
            System.out.println("  标题: " + layer.getTitle());
            System.out.println("  格式: " + layer.getFormats());
        }
    }
    
    // 获取瓦片
    public static BufferedImage getTile(WebMapTileServer wmts, String layerName,
            String tileMatrixSet, int zoom, int row, int col) throws Exception {
        
        GetTileRequest request = wmts.createGetTileRequest();
        
        // 查找图层
        WMTSLayer layer = null;
        for (WMTSLayer l : wmts.getCapabilities().getLayerList()) {
            if (layerName.equals(l.getName())) {
                layer = l;
                break;
            }
        }
        
        request.setLayer(layer);
        request.setFormat("image/png");
        request.setTileMatrixSet(tileMatrixSet);
        request.setTileMatrix(String.valueOf(zoom));
        request.setTileRow(row);
        request.setTileCol(col);
        
        GetTileResponse response = wmts.issueRequest(request);
        return ImageIO.read(response.getTileStream());
    }
}
```

## 13.6 本章小结

本章详细介绍了 GeoTools 的 OGC 服务客户端：

1. **WMS 客户端**
   - 连接服务
   - 获取地图图片
   - WMSLayer 集成

2. **WFS 客户端**
   - 连接和查询
   - 空间过滤
   - WFS-T 事务

3. **WCS 客户端**
   - 获取栅格数据

4. **WMTS 客户端**
   - 获取地图瓦片

### 关键要点

- 使用正确的 GetCapabilities URL
- 注意超时和错误处理
- WFS 支持类似 DataStore 的操作
- 了解各服务的版本差异

---

[← 上一章：地图渲染与输出](../第12章-地图渲染与输出) | [返回目录](../index) | [下一章：空间分析与处理 →](../第14章-空间分析与处理)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第12章-地图渲染与输出" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第14章-空间分析与处理" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
