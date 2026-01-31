# 第7章 REST API与自动化

## 7.1 REST API概述

### 7.1.1 什么是REST API

GeoServer提供了完整的REST API（Representational State Transfer），允许通过HTTP请求对GeoServer进行程序化管理。REST API是实现自动化部署、批量操作和系统集成的关键工具。

**REST API的优势：**
- **自动化**：支持脚本化操作，减少人工干预
- **集成**：易于与其他系统和工作流集成
- **批量操作**：高效处理大量配置任务
- **版本控制**：配置可以作为代码管理
- **CI/CD**：支持持续集成和持续部署

### 7.1.2 REST API基础

GeoServer REST API遵循RESTful设计原则：

**HTTP方法：**
| 方法 | 操作 | 说明 |
|------|------|------|
| GET | 读取 | 获取资源信息 |
| POST | 创建 | 创建新资源 |
| PUT | 更新/创建 | 更新现有资源或创建新资源 |
| DELETE | 删除 | 删除资源 |

**响应格式：**
- JSON（推荐）
- XML

**URL基础路径：**
```
http://{host}:{port}/geoserver/rest
```

### 7.1.3 认证

REST API需要身份认证，支持HTTP Basic认证：

```bash
# 使用curl的-u参数
curl -u admin:geoserver http://localhost:8080/geoserver/rest/workspaces.json

# 使用Authorization头
curl -H "Authorization: Basic YWRtaW46Z2Vvc2VydmVy" \
  http://localhost:8080/geoserver/rest/workspaces.json
```

### 7.1.4 API文档

GeoServer提供了完整的REST API文档：
- 官方文档：https://docs.geoserver.org/latest/en/user/rest/
- Swagger UI（如果启用）：http://localhost:8080/geoserver/rest/openapi

## 7.2 工作区和数据存储API

### 7.2.1 工作区管理

**列出所有工作区：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/workspaces.json
```

**获取单个工作区：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/workspaces/topp.json
```

**创建工作区：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{"workspace":{"name":"newworkspace"}}' \
  http://localhost:8080/geoserver/rest/workspaces
```

**更新工作区：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/json" \
  -d '{"workspace":{"name":"renamedworkspace"}}' \
  http://localhost:8080/geoserver/rest/workspaces/oldname
```

**删除工作区：**
```bash
# 仅删除空工作区
curl -u admin:geoserver -X DELETE \
  http://localhost:8080/geoserver/rest/workspaces/workspace

# 递归删除（包含所有内容）
curl -u admin:geoserver -X DELETE \
  "http://localhost:8080/geoserver/rest/workspaces/workspace?recurse=true"
```

### 7.2.2 数据存储管理

**列出数据存储：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/workspaces/topp/datastores.json
```

**创建Shapefile数据存储：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "dataStore": {
      "name": "roads_store",
      "connectionParameters": {
        "entry": [
          {"@key":"url", "$":"file:data/roads.shp"},
          {"@key":"charset", "$":"UTF-8"}
        ]
      }
    }
  }' \
  http://localhost:8080/geoserver/rest/workspaces/topp/datastores
```

**创建PostGIS数据存储：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "dataStore": {
      "name": "postgis_store",
      "connectionParameters": {
        "entry": [
          {"@key":"host", "$":"localhost"},
          {"@key":"port", "$":"5432"},
          {"@key":"database", "$":"geodata"},
          {"@key":"schema", "$":"public"},
          {"@key":"user", "$":"geoserver"},
          {"@key":"passwd", "$":"password"},
          {"@key":"dbtype", "$":"postgis"}
        ]
      }
    }
  }' \
  http://localhost:8080/geoserver/rest/workspaces/topp/datastores
```

**上传Shapefile（自动创建数据存储和图层）：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/zip" \
  --data-binary @roads.zip \
  "http://localhost:8080/geoserver/rest/workspaces/topp/datastores/roads/file.shp"
```

### 7.2.3 覆盖存储管理

**创建GeoTIFF覆盖存储：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: image/tiff" \
  --data-binary @dem.tif \
  "http://localhost:8080/geoserver/rest/workspaces/topp/coveragestores/dem/file.geotiff"
```

**列出覆盖存储：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/workspaces/topp/coveragestores.json
```

## 7.3 图层和样式API

### 7.3.1 图层管理

**列出所有图层：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/layers.json
```

**获取图层详情：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/layers/topp:roads.json
```

**发布要素类型（从数据存储发布图层）：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "featureType": {
      "name": "roads",
      "nativeName": "roads",
      "title": "Roads Layer",
      "srs": "EPSG:4326",
      "nativeBoundingBox": {
        "minx": -180, "maxx": 180,
        "miny": -90, "maxy": 90,
        "crs": "EPSG:4326"
      }
    }
  }' \
  http://localhost:8080/geoserver/rest/workspaces/topp/datastores/roads_store/featuretypes
```

**配置图层属性：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "layer": {
      "defaultStyle": {
        "name": "road_style"
      },
      "queryable": true
    }
  }' \
  http://localhost:8080/geoserver/rest/layers/topp:roads
```

**删除图层：**
```bash
curl -u admin:geoserver -X DELETE \
  "http://localhost:8080/geoserver/rest/layers/topp:roads?recurse=true"
```

### 7.3.2 要素类型管理

**列出要素类型：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/workspaces/topp/datastores/roads_store/featuretypes.json
```

**重新计算边界框：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/json" \
  -d '{"featureType":{"name":"roads"}}' \
  "http://localhost:8080/geoserver/rest/workspaces/topp/datastores/roads_store/featuretypes/roads?recalculate=nativebbox,latlonbbox"
```

### 7.3.3 样式管理

**列出样式：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/styles.json
```

**获取样式内容：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/styles/road_style.sld
```

**上传新样式：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/vnd.ogc.sld+xml" \
  -d @road_style.sld \
  "http://localhost:8080/geoserver/rest/styles?name=road_style"
```

**更新样式：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/vnd.ogc.sld+xml" \
  -d @road_style.sld \
  http://localhost:8080/geoserver/rest/styles/road_style
```

**关联样式到图层：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "layer": {
      "defaultStyle": {"name": "road_style"},
      "styles": {
        "style": [
          {"name": "road_style"},
          {"name": "road_style_alt"}
        ]
      }
    }
  }' \
  http://localhost:8080/geoserver/rest/layers/topp:roads
```

**删除样式：**
```bash
# 删除样式（如果未被使用）
curl -u admin:geoserver -X DELETE \
  http://localhost:8080/geoserver/rest/styles/road_style

# 强制删除并清理引用
curl -u admin:geoserver -X DELETE \
  "http://localhost:8080/geoserver/rest/styles/road_style?purge=true"
```

### 7.3.4 图层组管理

**列出图层组：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/layergroups.json
```

**创建图层组：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "layerGroup": {
      "name": "basemap",
      "mode": "SINGLE",
      "title": "Base Map",
      "layers": {
        "layer": [
          {"name": "topp:landuse"},
          {"name": "topp:roads"},
          {"name": "topp:places"}
        ]
      },
      "styles": {
        "style": [
          {"name": "landuse_style"},
          {"name": "road_style"},
          {"name": "point_style"}
        ]
      }
    }
  }' \
  http://localhost:8080/geoserver/rest/layergroups
```

## 7.4 安全配置API

### 7.4.1 用户管理

**列出用户：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/security/usergroup/users.json
```

**创建用户：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "userName": "newuser",
      "password": "newpassword",
      "enabled": true
    }
  }' \
  http://localhost:8080/geoserver/rest/security/usergroup/users
```

**修改用户密码：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "password": "newpassword"
    }
  }' \
  http://localhost:8080/geoserver/rest/security/usergroup/user/username
```

### 7.4.2 角色管理

**列出角色：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/security/roles.json
```

**创建角色：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{"role":{"name":"ROLE_EDITOR"}}' \
  http://localhost:8080/geoserver/rest/security/roles/role/ROLE_EDITOR
```

**为用户分配角色：**
```bash
curl -u admin:geoserver -X POST \
  http://localhost:8080/geoserver/rest/security/roles/role/ROLE_EDITOR/user/username
```

### 7.4.3 访问规则管理

**获取数据访问规则：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/security/acl/layers.json
```

**添加数据访问规则：**
```bash
curl -u admin:geoserver -X POST \
  -H "Content-Type: application/json" \
  -d '{"*.*.r": "ROLE_AUTHENTICATED"}' \
  http://localhost:8080/geoserver/rest/security/acl/layers
```

## 7.5 Python自动化脚本

### 7.5.1 gsconfig库

gsconfig是Python的GeoServer管理库，简化了REST API的使用：

**安装：**
```bash
pip install gsconfig-py3
```

**基本使用：**
```python
from geoserver.catalog import Catalog

# 连接GeoServer
cat = Catalog("http://localhost:8080/geoserver/rest", 
              username="admin", 
              password="geoserver")

# 列出工作区
for ws in cat.get_workspaces():
    print(ws.name)

# 创建工作区
cat.create_workspace("new_workspace", "http://example.com/new_workspace")

# 获取图层
layer = cat.get_layer("topp:roads")
print(layer.default_style.name)
```

### 7.5.2 发布Shapefile

```python
from geoserver.catalog import Catalog
import os

cat = Catalog("http://localhost:8080/geoserver/rest", 
              username="admin", 
              password="geoserver")

# 获取或创建工作区
workspace = cat.get_workspace("myworkspace")
if workspace is None:
    workspace = cat.create_workspace("myworkspace", 
                                     "http://example.com/myworkspace")

# 发布Shapefile
shapefile_path = "/path/to/data.shp"
store_name = "data_store"

cat.create_featurestore(store_name, 
                        workspace=workspace,
                        data={"url": "file:" + shapefile_path})

# 获取已发布的图层
layer = cat.get_layer("myworkspace:data")
print(f"Published layer: {layer.name}")
```

### 7.5.3 发布PostGIS数据

```python
from geoserver.catalog import Catalog

cat = Catalog("http://localhost:8080/geoserver/rest",
              username="admin",
              password="geoserver")

workspace = cat.get_workspace("myworkspace")

# 创建PostGIS数据存储
ds = cat.create_datastore("postgis_store", workspace)
ds.connection_parameters.update({
    "host": "localhost",
    "port": "5432",
    "database": "geodata",
    "schema": "public",
    "user": "geoserver",
    "passwd": "password",
    "dbtype": "postgis"
})
cat.save(ds)

# 发布PostGIS表
ft = cat.publish_featuretype("roads", ds, "EPSG:4326")
```

### 7.5.4 上传和管理样式

```python
from geoserver.catalog import Catalog

cat = Catalog("http://localhost:8080/geoserver/rest",
              username="admin",
              password="geoserver")

# 读取SLD文件
with open("road_style.sld", "r") as f:
    sld_content = f.read()

# 创建样式
cat.create_style("road_style", sld_content)

# 为图层设置默认样式
layer = cat.get_layer("topp:roads")
style = cat.get_style("road_style")
layer.default_style = style
cat.save(layer)
```

### 7.5.5 批量发布脚本

```python
import os
from geoserver.catalog import Catalog

def batch_publish_shapefiles(directory, workspace_name, geoserver_url):
    """批量发布目录中的所有Shapefile"""
    
    cat = Catalog(geoserver_url, username="admin", password="geoserver")
    
    # 确保工作区存在
    workspace = cat.get_workspace(workspace_name)
    if workspace is None:
        workspace = cat.create_workspace(workspace_name, 
                                        f"http://example.com/{workspace_name}")
    
    # 遍历目录中的Shapefile
    for filename in os.listdir(directory):
        if filename.endswith(".shp"):
            shapefile_path = os.path.join(directory, filename)
            store_name = os.path.splitext(filename)[0]
            
            print(f"Publishing {store_name}...")
            
            try:
                # 创建数据存储并发布
                cat.create_featurestore(
                    store_name,
                    workspace=workspace,
                    data={"url": "file:" + shapefile_path}
                )
                print(f"  Successfully published {store_name}")
            except Exception as e:
                print(f"  Error publishing {store_name}: {e}")
    
    print("Batch publishing complete!")

# 使用示例
batch_publish_shapefiles(
    "/data/shapefiles",
    "batch_workspace",
    "http://localhost:8080/geoserver/rest"
)
```

## 7.6 批量操作与任务调度

### 7.6.1 Shell脚本批量操作

**批量创建工作区：**
```bash
#!/bin/bash

GEOSERVER_URL="http://localhost:8080/geoserver/rest"
AUTH="admin:geoserver"

workspaces=("ws1" "ws2" "ws3")

for ws in "${workspaces[@]}"; do
    echo "Creating workspace: $ws"
    curl -u $AUTH -X POST \
        -H "Content-Type: application/json" \
        -d "{\"workspace\":{\"name\":\"$ws\"}}" \
        "$GEOSERVER_URL/workspaces"
done
```

**批量删除图层：**
```bash
#!/bin/bash

GEOSERVER_URL="http://localhost:8080/geoserver/rest"
AUTH="admin:geoserver"

# 从文件读取图层列表
while IFS= read -r layer; do
    echo "Deleting layer: $layer"
    curl -u $AUTH -X DELETE \
        "$GEOSERVER_URL/layers/$layer?recurse=true"
done < layers_to_delete.txt
```

### 7.6.2 定时任务

**使用cron定时备份配置：**
```bash
# 编辑crontab
crontab -e

# 添加每日备份任务（凌晨2点）
0 2 * * * /opt/scripts/backup_geoserver.sh
```

**备份脚本示例：**
```bash
#!/bin/bash

BACKUP_DIR="/backup/geoserver"
DATA_DIR="/opt/geoserver_data"
DATE=$(date +%Y%m%d)

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份数据目录
tar -czf "$BACKUP_DIR/geoserver_data_$DATE.tar.gz" -C "$DATA_DIR" .

# 保留最近7天的备份
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/geoserver_data_$DATE.tar.gz"
```

### 7.6.3 重新加载配置

通过REST API触发配置重新加载：

```bash
# 重新加载全局配置
curl -u admin:geoserver -X POST \
  http://localhost:8080/geoserver/rest/reload

# 重置整个目录
curl -u admin:geoserver -X POST \
  http://localhost:8080/geoserver/rest/reset
```

## 7.7 监控与日志管理

### 7.7.1 系统状态API

**获取系统状态：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/about/status.json
```

**获取版本信息：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/about/version.json
```

**获取清单信息：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/about/manifest.json
```

### 7.7.2 监控扩展

GeoServer提供监控扩展，可以记录请求统计：

1. 安装监控扩展
2. 启用请求日志
3. 通过REST API获取统计信息

**获取请求统计：**
```bash
curl -u admin:geoserver \
  http://localhost:8080/geoserver/rest/monitor/requests.json
```

### 7.7.3 日志配置

**通过REST API修改日志级别：**
```bash
curl -u admin:geoserver -X PUT \
  -H "Content-Type: application/json" \
  -d '{"logging":{"level":"PRODUCTION_LOGGING"}}' \
  http://localhost:8080/geoserver/rest/logging
```

**日志级别选项：**
- PRODUCTION_LOGGING：生产环境（最少日志）
- GEOSERVER_DEVELOPER_LOGGING：开发调试
- GEOTOOLS_DEVELOPER_LOGGING：GeoTools调试
- VERBOSE_LOGGING：详细日志

### 7.7.4 健康检查脚本

```python
import requests
import sys

def check_geoserver_health(url, username, password):
    """检查GeoServer健康状态"""
    
    try:
        # 检查REST API
        response = requests.get(
            f"{url}/rest/about/version.json",
            auth=(username, password),
            timeout=10
        )
        
        if response.status_code == 200:
            version_info = response.json()
            print(f"GeoServer Status: OK")
            print(f"Version: {version_info['about']['resource'][0]['Version']}")
            return True
        else:
            print(f"GeoServer Status: ERROR (HTTP {response.status_code})")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"GeoServer Status: UNREACHABLE ({e})")
        return False

if __name__ == "__main__":
    healthy = check_geoserver_health(
        "http://localhost:8080/geoserver",
        "admin",
        "geoserver"
    )
    sys.exit(0 if healthy else 1)
```

## 本章小结

本章详细介绍了GeoServer REST API的使用和自动化实践：

1. **REST API基础**：理解API的设计原则和认证方式
2. **资源管理API**：掌握工作区、数据存储、图层和样式的API操作
3. **安全API**：学会通过API管理用户和权限
4. **Python自动化**：使用gsconfig库简化自动化脚本开发
5. **批量操作**：实现批量发布和配置任务
6. **监控管理**：了解系统状态API和日志配置

REST API是实现GeoServer自动化运维的核心工具。通过合理使用API，可以大大提高配置管理的效率。

在下一章中，我们将学习GeoServer的性能优化和高级配置技巧。

## 思考与练习

1. 使用curl编写脚本，自动创建工作区并发布Shapefile。
2. 使用Python gsconfig库实现批量发布PostGIS表。
3. 编写健康检查脚本，监控GeoServer服务状态。
4. 设置定时任务，每天备份GeoServer配置。
5. 通过REST API创建用户并分配角色。
6. 实现一个简单的Web界面，调用REST API管理图层。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="06-安全管理与访问控制" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="08-性能优化与高级配置" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
