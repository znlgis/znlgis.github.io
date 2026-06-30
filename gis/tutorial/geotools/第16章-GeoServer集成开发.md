---
layout: default
title: 第16章 - GeoServer集成开发
---

# 第16章 - GeoServer集成开发

## 16.1 GeoServer 与 GeoTools

### 16.1.1 架构关系

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GeoServer                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   REST API          Web Admin          OGC Services                 │
│   ┌─────────┐      ┌─────────┐        ┌──────────────┐             │
│   │  REST   │      │ Wicket  │        │ WMS│WFS│WCS │             │
│   │ Module  │      │   UI    │        │ WMTS│CSW│WPS│             │
│   └────┬────┘      └────┬────┘        └──────┬───────┘             │
│        │                │                    │                      │
│        └────────────────┼────────────────────┘                      │
│                         │                                           │
│                  ┌──────▼──────┐                                    │
│                  │  Catalog    │                                    │
│                  │   API       │                                    │
│                  └──────┬──────┘                                    │
│                         │                                           │
│   ┌─────────────────────┼─────────────────────┐                    │
│   │              GeoTools                      │                    │
│   │  DataStore │ Style │ Renderer │ CRS       │                    │
│   └───────────────────────────────────────────┘                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.1.2 GeoServer 插件开发

GeoServer 基于 GeoTools，开发 GeoServer 插件通常涉及：

- DataStore 插件：支持新的数据格式
- 处理插件：WPS 处理
- 输出格式插件：新的输出格式
- 服务插件：新的 OGC 服务

## 16.2 REST API 调用

### 16.2.1 Java 客户端

```java
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;

public class GeoServerRESTClient {
    
    private final String baseUrl;
    private final HttpClient client;
    private final String authHeader;
    
    public GeoServerRESTClient(String baseUrl, String username, String password) {
        this.baseUrl = baseUrl;
        this.client = HttpClient.newHttpClient();
        this.authHeader = "Basic " + Base64.getEncoder()
            .encodeToString((username + ":" + password).getBytes());
    }
    
    // 获取工作空间列表
    public String getWorkspaces() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/rest/workspaces.json"))
            .header("Authorization", authHeader)
            .GET()
            .build();
        
        HttpResponse<String> response = client.send(request, 
            HttpResponse.BodyHandlers.ofString());
        
        return response.body();
    }
    
    // 获取图层列表
    public String getLayers() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/rest/layers.json"))
            .header("Authorization", authHeader)
            .GET()
            .build();
        
        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());
        
        return response.body();
    }
    
    // 创建工作空间
    public void createWorkspace(String name) throws Exception {
        String json = "{\"workspace\":{\"name\":\"" + name + "\"}}";
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/rest/workspaces"))
            .header("Authorization", authHeader)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();
        
        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 201) {
            throw new RuntimeException("创建失败: " + response.body());
        }
    }
    
    // 发布 Shapefile
    public void publishShapefile(String workspace, String storeName, 
            File shpFile) throws Exception {
        
        // 上传 ZIP 文件
        byte[] zipContent = createZip(shpFile);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/rest/workspaces/" + workspace + 
                "/datastores/" + storeName + "/file.shp"))
            .header("Authorization", authHeader)
            .header("Content-Type", "application/zip")
            .PUT(HttpRequest.BodyPublishers.ofByteArray(zipContent))
            .build();
        
        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 201) {
            throw new RuntimeException("发布失败: " + response.body());
        }
    }
    
    private byte[] createZip(File shpFile) throws Exception {
        // 创建包含 .shp, .shx, .dbf, .prj 的 ZIP
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            String baseName = shpFile.getName().replace(".shp", "");
            String[] extensions = {".shp", ".shx", ".dbf", ".prj"};
            
            for (String ext : extensions) {
                File f = new File(shpFile.getParent(), baseName + ext);
                if (f.exists()) {
                    zos.putNextEntry(new ZipEntry(f.getName()));
                    Files.copy(f.toPath(), zos);
                    zos.closeEntry();
                }
            }
        }
        return baos.toByteArray();
    }
}
```

### 16.2.2 配置样式

```java
public class GeoServerStyleManager {
    
    private final GeoServerRESTClient client;
    
    public GeoServerStyleManager(GeoServerRESTClient client) {
        this.client = client;
    }
    
    // 上传 SLD 样式
    public void uploadStyle(String styleName, String sldContent) throws Exception {
        // 先创建样式
        HttpRequest createRequest = HttpRequest.newBuilder()
            .uri(URI.create(client.baseUrl + "/rest/styles"))
            .header("Authorization", client.authHeader)
            .header("Content-Type", "application/vnd.ogc.sld+xml")
            .POST(HttpRequest.BodyPublishers.ofString(
                "<style><name>" + styleName + "</name><filename>" + 
                styleName + ".sld</filename></style>"))
            .build();
        
        // 上传 SLD 内容
        HttpRequest uploadRequest = HttpRequest.newBuilder()
            .uri(URI.create(client.baseUrl + "/rest/styles/" + styleName))
            .header("Authorization", client.authHeader)
            .header("Content-Type", "application/vnd.ogc.sld+xml")
            .PUT(HttpRequest.BodyPublishers.ofString(sldContent))
            .build();
        
        // 执行请求...
    }
    
    // 为图层设置样式
    public void setLayerStyle(String workspace, String layerName, 
            String styleName) throws Exception {
        
        String json = "{\"layer\":{\"defaultStyle\":{\"name\":\"" + 
            styleName + "\"}}}";
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(client.baseUrl + "/rest/layers/" + 
                workspace + ":" + layerName))
            .header("Authorization", client.authHeader)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(json))
            .build();
        
        // 执行请求...
    }
}
```

## 16.3 WPS 处理开发

### 16.3.1 创建 WPS 处理

```java
import org.geotools.process.factory.DescribeParameter;
import org.geotools.process.factory.DescribeProcess;
import org.geotools.process.factory.DescribeResult;
import org.geotools.process.gs.GSProcess;

@DescribeProcess(
    title = "Buffer Process",
    description = "创建缓冲区"
)
public class BufferWPSProcess implements GSProcess {
    
    @DescribeResult(name = "result", description = "缓冲区结果")
    public SimpleFeatureCollection execute(
        @DescribeParameter(name = "features", description = "输入要素") 
        SimpleFeatureCollection features,
        
        @DescribeParameter(name = "distance", description = "缓冲区距离")
        Double distance
    ) throws Exception {
        
        SimpleFeatureType originalType = features.getSchema();
        
        // 创建输出类型
        SimpleFeatureTypeBuilder typeBuilder = new SimpleFeatureTypeBuilder();
        typeBuilder.init(originalType);
        typeBuilder.setName("buffered");
        
        // 修改几何类型为 Polygon
        typeBuilder.remove(originalType.getGeometryDescriptor().getLocalName());
        typeBuilder.add("the_geom", Polygon.class);
        
        SimpleFeatureType resultType = typeBuilder.buildFeatureType();
        
        DefaultFeatureCollection result = new DefaultFeatureCollection();
        SimpleFeatureBuilder builder = new SimpleFeatureBuilder(resultType);
        
        try (SimpleFeatureIterator iter = features.features()) {
            while (iter.hasNext()) {
                SimpleFeature feature = iter.next();
                Geometry geom = (Geometry) feature.getDefaultGeometry();
                Geometry buffer = geom.buffer(distance);
                
                builder.add(buffer);
                for (int i = 0; i < feature.getAttributeCount(); i++) {
                    if (!(feature.getAttribute(i) instanceof Geometry)) {
                        builder.add(feature.getAttribute(i));
                    }
                }
                
                result.add(builder.buildFeature(null));
            }
        }
        
        return result;
    }
}
```

### 16.3.2 注册 WPS 处理

在 `META-INF/services/org.geotools.process.ProcessFactory` 文件中注册：

```
com.example.wps.BufferWPSProcessFactory
```

工厂类：

```java
public class BufferWPSProcessFactory extends AnnotatedBeanProcessFactory {
    
    public BufferWPSProcessFactory() {
        super(
            Text.text("Custom WPS Processes"),
            "custom",
            BufferWPSProcess.class
        );
    }
}
```

## 16.4 自定义 DataStore

### 16.4.1 DataStore 工厂

```java
public class MyDataStoreFactory implements DataStoreFactorySpi {
    
    public static final Param URL_PARAM = new Param(
        "url", URL.class, "数据 URL", true);
    
    @Override
    public String getDisplayName() {
        return "My Custom DataStore";
    }
    
    @Override
    public String getDescription() {
        return "自定义数据格式支持";
    }
    
    @Override
    public Param[] getParametersInfo() {
        return new Param[] { URL_PARAM };
    }
    
    @Override
    public boolean canProcess(Map<String, ?> params) {
        if (params.containsKey("url")) {
            Object url = params.get("url");
            if (url instanceof URL) {
                return ((URL) url).toString().endsWith(".myformat");
            }
        }
        return false;
    }
    
    @Override
    public DataStore createDataStore(Map<String, ?> params) throws IOException {
        URL url = (URL) params.get("url");
        return new MyDataStore(url);
    }
    
    @Override
    public DataStore createNewDataStore(Map<String, ?> params) throws IOException {
        return createDataStore(params);
    }
    
    @Override
    public boolean isAvailable() {
        return true;
    }
}
```

## 16.5 本章小结

本章介绍了 GeoServer 与 GeoTools 的集成开发：

1. **架构关系**
   - GeoServer 基于 GeoTools
   - 共享核心组件

2. **REST API**
   - Java 客户端
   - 工作空间和图层管理
   - 样式配置

3. **WPS 开发**
   - 创建处理类
   - 注册工厂

4. **DataStore 扩展**
   - 自定义数据格式

### 关键要点

- GeoServer 扩展遵循 GeoTools 接口
- REST API 提供完整的管理能力
- WPS 处理可重用 GeoTools 分析功能

---

[← 上一章：性能优化与最佳实践](../第15章-性能优化与最佳实践) | [返回目录](../index) | [下一章：实战案例分析 →](../第17章-实战案例分析)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第15章-性能优化与最佳实践" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第17章-实战案例分析" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
