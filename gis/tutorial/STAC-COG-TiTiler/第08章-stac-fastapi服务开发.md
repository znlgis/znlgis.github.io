---
layout: default
title: 第08章 - stac-fastapi 服务开发
---

# 第08章 - stac-fastapi 服务开发

stac-fastapi 不是一个开箱可用的 STAC 服务，它是一个**装配框架**：把 HTTP 协议层（路由、参数解析、OpenAPI、错误映射）与业务层（怎么存、怎么查）拆开，中间用抽象基类对接。所以同一个 API 层可以接 PostgreSQL（pgstac）、接 Elasticsearch/OpenSearch，也可以接你自己写的内存字典。

这个设计的好处是：换后端不用改路由，加扩展不用改后端。代价是第一次读代码时会迷路——一个 /search 请求要穿过 request model、endpoint factory、client 方法、response model 四层，任何一层配错都表现为“参数没生效”。

这一章先把三层结构讲清楚，再用一个内存后端把整条链路跑通。这个后端只用于理解与测试，生产用第 9 章的 pgstac。

## 8.1 三层结构与两个抽象

### 8.1.1 包结构

7.1.1 把代码拆成三个独立发布的包：

| 包 | 职责 | 关键模块 |
|----|------|----------|
| stac-fastapi.types | 抽象接口与数据模型 | core.py（BaseCoreClient / AsyncBaseCoreClient）、search.py、stac.py、extension.py、config.py、conformance.py |
| stac-fastapi.api | FastAPI 装配层 | app.py（StacApi 工厂）、models.py、routes.py、errors.py、middleware.py |
| stac-fastapi.extensions | 官方扩展实现 | transaction、filter、sort、fields、query、pagination、aggregation、bulk_transactions、collection_search、free_text |

历史沿革值得知道，因为网上大量示例还是旧结构：6.3.0 把 core 与 third_party 两个扩展目录合并到根；7.0.0 删除了 stac_fastapi.extensions.core 命名空间，扩展要从 stac_fastapi.extensions 直接导入。照着 5.x 的教程写 import 会直接 ImportError。

还有一个容易误解的点：**没有 stac_fastapi.core 包**。早期的 stac-fastapi-core 已经并入 types，抽象客户端类现在在 stac_fastapi.types.core 里。

### 8.1.2 请求穿过哪几层

以 POST /search 为例：

```text
HTTP 请求
  ↓
[1] 路由：register_post_search() 注册 /search，response_class=GeoJSONResponse
  ↓
[2] 请求模型：search_post_request_model（默认 BaseSearchPostRequest）
     负责解析 bbox / intersects / datetime / limit / collections / ids
  ↓
[3] endpoint：create_async_endpoint(client.post_search, model)
     把模型实例化成 kwargs，调用 client 的方法
  ↓
[4] 业务：你的 AsyncBaseCoreClient.post_search(search_request, **kwargs)
  ↓
[5] 响应模型：api.ItemCollection（enable_response_models 为 true 时生效）
  ↓
JSON / GeoJSON
```

第 [2] 层决定哪些参数能被识别；扩展就是往这一层加字段（sort 加 sortby，filter 加 filter 与 filter-lang）。

### 8.1.3 两个基类

BaseCoreClient 是同步的，AsyncBaseCoreClient 是异步的，两者方法签名一致。必实现的抽象方法有六个：

| 方法 | 对应路由 |
|------|----------|
| get_search | GET /search |
| post_search | POST /search |
| get_item | GET /collections/{collection_id}/items/{item_id} |
| all_collections | GET /collections |
| get_collection | GET /collections/{collection_id} |
| item_collection | GET /collections/{collection_id}/items |

landing_page 与 conformance 有默认实现，从 base_conformance_classes 与已注册扩展的 conformance_classes 拼出来，通常不用覆写。

注意 get_search 的签名里 limit 默认值是 10，这与规范一致（默认 10，上限 10000）。BaseSearchPostRequest 的 limit 用 AfterValidator 裁剪到 10000：

```python
def crop(v: PositiveInt) -> PositiveInt:
    limit = 10_000
    if v > limit:
        v = limit
    return v

Limit = Annotated[PositiveInt, AfterValidator(crop)]
```

也就是说传 limit=999999 不会报错，会被静默裁到 10000。规范要求的行为正是“超过上限按上限处理，不报错”。

## 8.2 装配一个应用

### 8.2.1 最小装配

```python
from fastapi import FastAPI
from stac_fastapi.api.app import StacApi
from stac_fastapi.types.config import ApiSettings

from mybackend import MemoryClient

settings = ApiSettings(
    stac_fastapi_title="我的影像目录",
    stac_fastapi_description="示例 STAC API",
    stac_fastapi_version="1.0.0",
    stac_fastapi_landing_id="my-catalog",
)

api = StacApi(
    settings=settings,
    client=MemoryClient(),
    extensions=[],
)

app: FastAPI = api.app
```

StacApi 的 __attrs_post_init__ 做了一串事，顺序有意义：

```python
# 1. settings 注入 client；2. 设置全局 settings 单例
self.client.title = self.title
self.client.description = self.description
Settings.set(self.settings)

# 3. 注册核心路由；4. 逐个注册扩展
self.register_core()
for ext in self.extensions:
    ext.register(self.app)
```

第 1 步意味着：**client 的 title/description 由 StacApi 覆盖**，你在 client 里设的会被冲掉。想让落地页显示正确标题，必须通过 settings 或 StacApi 的参数传。

### 8.2.2 默认中间件

不传 middlewares 时，StacApi 会装三个：

| 中间件 | 作用 |
|--------|------|
| BrotliMiddleware | 响应压缩，JSON 通常能压到 1/5 |
| CORSMiddleware | 默认 allow_origins=["*"]、methods=["OPTIONS","POST","GET"]、headers=["Content-Type"]、max_age=600 |
| ProxyHeaderMiddleware | 处理 X-Forwarded-*，让生成的链接用对外域名 |

CORS 的默认 headers 只有 Content-Type——这意味着浏览器带 Authorization 或 Range 的预检会失败。私有部署必须自己传 middlewares：

```python
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

middlewares = [
    Middleware(
        CORSMiddleware,
        allow_origins=["https://app.example.com"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Range"],
        expose_headers=["Content-Range", "Accept-Ranges"],
        max_age=600,
    ),
]
```

注意 7.0.0 移除了 stac_fastapi.api.middleware 里的 CORSMiddleware 子类，要用 starlette 的官方实现。

### 8.2.3 健康检查

StacApi 会自动加两个管理端点：/_mgmt/ping 返回 {"message": "PONG"}，/_mgmt/health 返回 health_check() 的结果，默认 {"status": "UP"}。health_check 可以是同步或异步函数，生产上应该换成数据库探活（stac-fastapi-pgstac 自带 health_check，传给 StacApi 即可）。

## 8.3 写一个内存后端

下面这个实现覆盖六个核心方法，能跑通 GET/POST /search、集合与单条读取。它把数据放在字典里，用于理解链路与写单元测试。

```python
# mybackend.py
from typing import Any

import attr
from stac_fastapi.types.core import AsyncBaseCoreClient
from stac_fastapi.types.stac import Item, ItemCollection, Collection, Collections
from stac_fastapi.types.search import BaseSearchPostRequest


def _bbox_hit(item_bbox, query_bbox) -> bool:
    if not item_bbox or not query_bbox:
        return True
    if len(query_bbox) == 4:
        w, s, e, n = query_bbox
    else:
        w, s, _, e, n, _ = query_bbox
    return not (item_bbox[2] < w or item_bbox[0] > e
                or item_bbox[3] < s or item_bbox[1] > n)


@attr.s
class MemoryClient(AsyncBaseCoreClient):
    """极简内存后端，仅用于演示与测试。"""

    collections: dict[str, dict] = attr.ib(factory=dict)
    items: dict[tuple[str, str], dict] = attr.ib(factory=dict)

    def seed(self, collection: dict, items: list[dict]) -> None:
        cid = collection["id"]
        self.collections[cid] = collection
        for it in items:
            self.items[(cid, it["id"])] = it

    async def all_collections(self, **kwargs) -> Collections:
        return Collections(
            collections=list(self.collections.values()),
            links=[],
            numberMatched=len(self.collections),
            numberReturned=len(self.collections),
        )

    async def get_collection(self, collection_id: str, **kwargs) -> Collection:
        if collection_id not in self.collections:
            raise NotFoundError(f"collection {collection_id} not found")
        return Collection(**self.collections[collection_id])

    async def get_item(self, item_id: str, collection_id: str, **kwargs) -> Item:
        key = (collection_id, item_id)
        if key not in self.items:
            raise NotFoundError(f"item {item_id} not found")
        return Item(**self.items[key])

    async def item_collection(
        self, collection_id: str, bbox=None, datetime=None,
        limit: int = 10, token: str | None = None, **kwargs,
    ) -> ItemCollection:
        rows = [v for (cid, _), v in self.items.items() if cid == collection_id]
        rows = [r for r in rows if _bbox_hit(r.get("bbox"), bbox)]
        return ItemCollection(
            type="FeatureCollection",
            features=rows[:limit],
            links=[],
            numberReturned=len(rows[:limit]),
            numberMatched=len(rows),
        )

    async def get_search(
        self, collections=None, ids=None, bbox=None, intersects=None,
        datetime=None, limit: int | None = 10, **kwargs,
    ) -> ItemCollection:
        rows = list(self.items.values())
        if collections:
            rows = [r for r in rows if r.get("collection") in collections]
        if ids:
            rows = [r for r in rows if r["id"] in ids]
        rows = [r for r in rows if _bbox_hit(r.get("bbox"), bbox)]
        n = limit or 10
        return ItemCollection(
            type="FeatureCollection",
            features=rows[:n],
            links=[],
            numberReturned=len(rows[:n]),
            numberMatched=len(rows),
        )

    async def post_search(
        self, search_request: BaseSearchPostRequest, **kwargs
    ) -> ItemCollection:
        return await self.get_search(
            collections=search_request.collections,
            ids=search_request.ids,
            bbox=search_request.bbox,
            intersects=search_request.intersects,
            datetime=search_request.datetime,
            limit=search_request.limit,
        )
```

几个实现细节：

**用 attr.s 而不是 dataclass。** 基类用 attrs 定义，子类也用 attrs 才能正确继承字段。混用 dataclass 会丢掉 base_conformance_classes 与 extensions 两个字段，落地页的 conformsTo 会空。

**返回 stac_fastapi.types.stac 的模型。** 这些是 TypedDict 风格的类型，不是 pydantic 模型，运行时不做校验；真正的校验发生在 enable_response_models 打开时，由 stac_pydantic 的模型做。

**异常映射。** 抛 NotFoundError 会被 DEFAULT_STATUS_CODES 映射成 404。自定义异常要同时注册映射，否则变成 500。

### 8.3.1 启动

```python
# main.py
from fastapi import FastAPI
from stac_fastapi.api.app import StacApi
from stac_fastapi.types.config import ApiSettings

from mybackend import MemoryClient

settings = ApiSettings(stac_fastapi_title="内存示例")
client = MemoryClient()
client.seed(
    collection={
        "type": "Collection", "stac_version": "1.1.0", "id": "demo",
        "description": "示例集合", "license": "CC-BY-4.0",
        "extent": {"spatial": {"bbox": [[100, 20, 110, 30]]},
                   "temporal": {"interval": [["2023-01-01T00:00:00Z", None]]}},
        "links": [],
    },
    items=[{
        "type": "Feature", "stac_version": "1.1.0", "id": "demo-001", "collection": "demo",
        "geometry": {"type": "Polygon", "coordinates": [
            [[100, 20], [110, 20], [110, 30], [100, 30], [100, 20]]]},
        "bbox": [100, 20, 110, 30],
        "properties": {"datetime": "2023-05-01T00:00:00Z"}, "links": [], "assets": {},
    }],
)

api = StacApi(settings=settings, client=client, extensions=[])
app: FastAPI = api.app
```

```bash
uvicorn main:app --reload --port 8082
curl -s "http://localhost:8082/search?limit=1" | python -m json.tool
# {
#     "type": "FeatureCollection",
#     "features": [{"type": "Feature", "id": "demo-001", ...}],
#     "links": [],
#     "numberReturned": 1,
#     "numberMatched": 1
# }
```

到这里链路已经通了。接下来看扩展怎么接进来。

## 8.4 扩展机制

### 8.4.1 扩展做了什么

一个 ApiExtension 至少要有 register(app) 方法，通常还会带：

| 属性 | 作用 |
|------|------|
| GET / POST | 该扩展给请求模型加的字段（pydantic / attrs 模型） |
| conformance_classes | 会出现在 /conformance 与落地页 conformsTo 里 |
| schema_href | 扩展的 JSON Schema 地址 |
| register(app) | 注册路由、往请求模型注入字段 |

以 TransactionExtension 为例，它的 register 会挂八个路由：

```text
POST|PUT|PATCH|DELETE  /collections
POST|PUT|PATCH|DELETE  /collections/{collection_id}/items[/{item_id}]
```

注意它同时实现了 Items 与 Collections 两套 conformance URI：

```python
class TransactionConformanceClasses(StrEnum):
    ITEMS = "https://api.stacspec.org/v1.0.0/ogcapi-features/extensions/transaction"
    COLLECTIONS = "https://api.stacspec.org/v1.0.0/collections/extensions/transaction"
```

### 8.4.2 挂上事务扩展

```python
from stac_fastapi.extensions import TransactionExtension
from stac_fastapi.api.models import JSONResponse

from mybackend import MemoryTransactionsClient

api = StacApi(
    settings=settings,
    client=client,
    extensions=[
        TransactionExtension(
            client=MemoryTransactionsClient(store=client),
            settings=settings,
            response_class=JSONResponse,
        )
    ],
)
```

MemoryTransactionsClient 要继承 BaseTransactionsClient 并实现八个方法。签名容易记错，尤其是 delete_item：

```python
def create_item(self, collection_id: str, item: Item, **kwargs): ...
def update_item(self, collection_id: str, item_id: str, item: Item, **kwargs): ...
def patch_item(self, collection_id: str, item_id: str, patch, **kwargs): ...
def delete_item(self, item_id: str, collection_id: str, **kwargs): ...   # 注意顺序
def create_collection(self, collection: Collection, **kwargs): ...
def update_collection(self, collection_id: str, collection: Collection, **kwargs): ...
def patch_collection(self, collection_id: str, patch, **kwargs): ...
def delete_collection(self, collection_id: str, **kwargs): ...
```

delete_item 的参数顺序是 (item_id, collection_id)，与 get_item 的 (item_id, collection_id) 一致，但与 update_item 的 (collection_id, item_id, item) 相反。这是源码里的既成事实，不要“顺手改对”。

### 8.4.3 事务扩展的 Location 头

7.1.0 修了一个规范符合性问题：POST 创建单个 Item 或 Collection 时，要返回 Location 头指向新资源。实现里包了一层（下面省略了状态码与异常分支）：

```python
async def create_item(request, response, request_data=Depends(PostItem)):
    item = await endpoint(request, request_data)
    # 单条 Item 成功创建时补 Location；ItemCollection 不补
    if request_data.item.type == "Feature" and "location" not in response.headers:
        response.headers["Location"] = _location_url(
            request, "Get Item", collection_id=..., item_id=item["id"])
    return item
```

如果你的后端在 create_item 里直接返回了 Response 对象（而不是 dict），Location 头会加到那个 Response 上；返回 dict 时加到框架的 response 上。两种都支持，但混用容易漏。

### 8.4.4 写一个自定义扩展

假设要给落地页加一个 /stats 端点，返回集合数：

```python
import attr
from fastapi import FastAPI
from stac_fastapi.types.extension import ApiExtension

@attr.s
class StatsExtension(ApiExtension):
    client: object = attr.ib(default=None)

    conformance_classes: list[str] = attr.ib(default=[])
    schema_href: str | None = attr.ib(default=None)

    def register(self, app: FastAPI) -> None:
        @app.get("/stats")
        async def stats():
            return {"collections": len(self.client.collections)}

api = StacApi(settings=settings, client=client, extensions=[StatsExtension(client=client)])
```

注意两点：conformance_classes 用 attr.ib 而不是类属性，否则 attrs 生成的 __init__ 会漏掉它；register 里直接 app.get 会绕开 StacApi 的 response_class，需要统一响应格式时用 APIRouter 加 response_class。

## 8.5 配置与环境变量

ApiSettings 的字段全部可以用环境变量覆盖（pydantic-settings，大小写不敏感）：

| 字段 | 环境变量 | 默认 | 说明 |
|------|----------|------|------|
| stac_fastapi_title | STAC_FASTAPI_TITLE | stac-fastapi | 落地页标题 |
| stac_fastapi_description | STAC_FASTAPI_DESCRIPTION | stac-fastapi | 描述 |
| stac_fastapi_version | STAC_FASTAPI_VERSION | 0.1 | API 版本 |
| stac_fastapi_landing_id | STAC_FASTAPI_LANDING_ID | stac-fastapi | 落地页 id |
| enable_response_models | ENABLE_RESPONSE_MODELS | false | 输出校验 |
| enable_direct_response | ENABLE_DIRECT_RESPONSE | false | 跳过序列化 |
| openapi_url | OPENAPI_URL | /api | OpenAPI 文档 |
| docs_url | DOCS_URL | /api.html | Swagger UI |
| root_path | ROOT_PATH | 空 | 反向代理前缀 |

用默认值启动时日志会警告 “Using default values for stac_fastapi_title, ... This may impact API discoverability.”（6.4.0 加入），否则所有实例在 STAC Index 里都叫 stac-fastapi。

两个 flag 互斥：同时开会在启动时抛 ValueError。enable_response_models 让 FastAPI 用 stac_pydantic 校验输出（慢但安全），enable_direct_response 直接返回 Response（快但绕过校验）。

## 8.6 排错

| 现象 | 原因 | 修法 |
|------|------|------|
| 落地页 conformsTo 是空的 | client 用了 dataclass，丢了 base_conformance_classes | 改用 attr.s |
| 加了 sort 扩展但 sortby 不生效 | 扩展没加到 search 请求模型 | 用 create_request_model 或在 StacApi 传 search_post_request_model |
| 所有请求 500，日志报 Settings have not yet been set | 直接实例化 client 调方法，没经过 StacApi | 先构造 StacApi，或手动 Settings.set() |
| /search 的 limit 传 20000 返回 10000 | 正常行为，crop 到上限 | 无需处理 |
| 反向代理后链接是 http://内部IP | 没装 ProxyHeaderMiddleware 或没设 root_path | 加中间件 + 设 ROOT_PATH |
| ImportError: cannot import name 'X' from 'stac_fastapi.extensions.core' | 7.0.0 删了该命名空间 | 从 stac_fastapi.extensions 直接导入 |
| CORS 预检失败 | 默认 allow_headers 只有 Content-Type | 自定义 CORSMiddleware |

第三条值得展开：BaseCoreClient 在模块导入时就实例化了 ApiSettings()（api_settings = ApiSettings()），但真正的 Settings.set() 发生在 StacApi 初始化时。如果写单元测试直接 new 一个 client 调 landing_page，会因为没有 request 对象而失败；正确做法是用 TestClient 走 HTTP。

## 8.7 生产建议

**用工厂函数而不是模块级 app。** uvicorn 的 --factory 模式支持延迟初始化，配合 lifespan 管理连接池：

```python
def create_app() -> FastAPI:
    api = StacApi(settings=Settings(), client=CoreClient(), extensions=[...])
    return api.app
```

```bash
uvicorn myapp:create_app --factory --workers 4
```

**worker 数与连接池要对得上。** 每个 worker 一个连接池，DB_MAX_CONN_SIZE=10、4 个 worker 就是 40 个连接，Postgres 的 max_connections 默认 100，要留余量。

**Brotli 有 CPU 成本。** JSON 压缩比 1/5 到 1/10，但 /search 返回大 FeatureCollection 时会吃 CPU，放到反向代理层做更划算。

**给 /search 加超时。** FastAPI 没有请求超时，慢查询会一直占着连接；用 proxy_read_timeout 或 statement_timeout 兜底。

**健康检查要探到数据库。** /_mgmt/ping 只证明进程活着，负载均衡不该据此判断可用性。

## 8.8 本章小结

| 要点 | 结论 |
|------|------|
| 三层结构 | types（抽象）、api（装配）、extensions（扩展） |
| 必实现方法 | 六个核心方法，同步用 BaseCoreClient，异步用 AsyncBaseCoreClient |
| 装配顺序 | 注入 settings → 注册核心路由 → 注册扩展 → 中间件 |
| 扩展机制 | ApiExtension.register(app)，可带 GET/POST 模型与 conformance |
| 默认 CORS | 只允许 Content-Type，私有部署必须自定义 |
| 版本陷阱 | 7.0.0 删除 extensions.core 命名空间，没有 stac_fastapi.core 包 |

下一章接 PostgreSQL：pgstac 的表结构、分区策略、迁移与 SQL 函数，以及它为什么能在亿级 Item 上保持检索性能。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第07章-静态STAC目录构建/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第09章-pgstac与PostgreSQL后端/" class="chapter-nav__next">下一章 →</a>
</div>
