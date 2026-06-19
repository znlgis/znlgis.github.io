---
layout: default
title: "第4章：GeoDataFrame 基础操作"
---

# 第4章：GeoDataFrame 基础操作

> GeoDataFrame 是 GeoPandas 的核心数据结构。本章将全面讲解 GeoDataFrame 的创建、查看、选择、修改、合并等基础操作，是日常使用 GeoPandas 的必备技能。

---

## 4.1 创建 GeoDataFrame

GeoDataFrame 可以通过多种方式创建，适应不同的数据来源和使用场景。

### 4.1.1 从字典创建

最直接的方式是使用 Python 字典：

```python
import geopandas as gpd
from shapely.geometry import Point, Polygon, LineString

# 创建点数据
cities = gpd.GeoDataFrame({
    '城市': ['北京', '上海', '广州', '深圳', '成都'],
    '省份': ['北京市', '上海市', '广东省', '广东省', '四川省'],
    '人口_万': [2189, 2487, 1868, 1756, 2094],
    'GDP_亿': [41610, 44652, 28231, 32387, 20817],
    'geometry': [
        Point(116.40, 39.90),
        Point(121.47, 31.23),
        Point(113.26, 23.13),
        Point(114.06, 22.54),
        Point(104.07, 30.67)
    ]
}, crs="EPSG:4326")

print(cities)
```

输出：

```
   城市  省份  人口_万  GDP_亿                   geometry
0  北京  北京市    2189   41610  POINT (116.40000 39.90000)
1  上海  上海市    2487   44652  POINT (121.47000 31.23000)
2  广州  广东省    1868   28231  POINT (113.26000 23.13000)
3  深圳  广东省    1756   32387  POINT (114.06000 22.54000)
4  成都  四川省    2094   20817  POINT (104.07000 30.67000)
```

### 4.1.2 从 pandas DataFrame 转换

当数据已经在 pandas DataFrame 中时，可以转换为 GeoDataFrame：

```python
import pandas as pd
import geopandas as gpd

# 方法1：使用经纬度列
df = pd.DataFrame({
    '站名': ['站点A', '站点B', '站点C'],
    '经度': [116.40, 121.47, 113.26],
    '纬度': [39.90, 31.23, 23.13],
    'PM25': [75, 42, 38]
})

gdf = gpd.GeoDataFrame(
    df,
    geometry=gpd.points_from_xy(df['经度'], df['纬度']),
    crs="EPSG:4326"
)
print("方法1:\n", gdf)

# 方法2：使用 WKT 列
df_wkt = pd.DataFrame({
    '名称': ['区域A', '区域B'],
    'wkt': [
        'POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))',
        'POLYGON ((1 1, 2 1, 2 2, 1 2, 1 1))'
    ]
})

gdf_wkt = gpd.GeoDataFrame(
    df_wkt,
    geometry=gpd.GeoSeries.from_wkt(df_wkt['wkt']),
    crs="EPSG:4326"
)
print("\n方法2:\n", gdf_wkt)

# 方法3：使用已有的 Shapely 列
from shapely.geometry import Point

df['geom'] = [Point(x, y) for x, y in zip(df['经度'], df['纬度'])]
gdf3 = gpd.GeoDataFrame(df, geometry='geom', crs="EPSG:4326")
print("\n方法3:\n", gdf3)
```

### 4.1.3 从文件读取

最常用的方式是从地理空间文件中读取：

```python
import geopandas as gpd

# 读取 Shapefile
gdf = gpd.read_file("data/boundaries.shp")

# 读取 GeoJSON
gdf = gpd.read_file("data/points.geojson")

# 读取 GeoPackage（指定图层）
gdf = gpd.read_file("data/database.gpkg", layer="buildings")

# 读取 GeoPackage（列出所有图层）
import pyogrio
layers = pyogrio.list_layers("data/database.gpkg")
print("图层列表:", layers)

# 读取 Parquet
gdf = gpd.read_parquet("data/large_dataset.parquet")

# 读取 Feather
gdf = gpd.read_feather("data/dataset.feather")

# 从 URL 读取
gdf = gpd.read_file("https://example.com/data.geojson")

# 读取时过滤（只读取部分数据，提高性能）
gdf = gpd.read_file(
    "data/large_file.gpkg",
    bbox=(116.0, 39.0, 117.0, 40.0),  # 只读取该范围内的数据
    columns=['name', 'population']      # 只读取指定列
)
```

### 4.1.4 从数据库读取

```python
import geopandas as gpd
from sqlalchemy import create_engine

# 连接 PostGIS 数据库
engine = create_engine("postgresql+psycopg://user:pass@localhost:5432/gisdb")

# 读取整表
gdf = gpd.read_postgis("SELECT * FROM buildings", engine, geom_col='geom')

# 带条件查询
gdf = gpd.read_postgis(
    "SELECT * FROM buildings WHERE area > 1000",
    engine,
    geom_col='geom'
)
```

### 4.1.5 创建方式对比

| 方式 | 适用场景 | 性能 | 复杂度 |
|------|----------|------|--------|
| 字典创建 | 小规模数据、测试 | - | ⭐ |
| DataFrame 转换 | CSV 数据、非空间数据源 | 中 | ⭐⭐ |
| 文件读取 | 标准 GIS 文件 | 高 | ⭐ |
| 数据库读取 | PostGIS、大规模数据 | 高 | ⭐⭐⭐ |
| Parquet 读取 | 中间数据、高性能需求 | 最高 | ⭐ |

---

## 4.2 GeoDataFrame 的结构

### 4.2.1 核心组件

```python
import geopandas as gpd
from shapely.geometry import Point

gdf = gpd.GeoDataFrame({
    '城市': ['北京', '上海', '广州'],
    '人口': [2189, 2487, 1868],
    'geometry': [Point(116.40, 39.90), Point(121.47, 31.23), Point(113.26, 23.13)]
}, crs="EPSG:4326")

# 列
print("列名:", gdf.columns.tolist())
# ['城市', '人口', 'geometry']

# 索引
print("索引:", gdf.index.tolist())
# [0, 1, 2]

# 几何列
print("几何列名:", gdf.geometry.name)
# 'geometry'

# CRS
print("CRS:", gdf.crs)
# EPSG:4326

# 形状
print("形状 (行, 列):", gdf.shape)
# (3, 3)
```

### 4.2.2 属性列 vs 几何列

GeoDataFrame 中的列分为两类：

```python
# 属性列（普通 pandas 列）
print("属性列:")
for col in gdf.columns:
    if col != gdf.geometry.name:
        print(f"  {col}: {gdf[col].dtype}")

# 几何列（GeoSeries）
print("\n几何列:")
print(f"  {gdf.geometry.name}: {gdf.geometry.dtype}")
print(f"  几何类型: {gdf.geom_type.unique()}")
```

---

## 4.3 查看与检查数据

### 4.3.1 基本查看方法

```python
import geopandas as gpd

# 假设已有 GeoDataFrame
gdf = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 查看前 N 行
print(gdf.head())      # 默认前5行
print(gdf.head(10))    # 前10行

# 查看后 N 行
print(gdf.tail())      # 默认后5行

# 查看随机 N 行
print(gdf.sample(3))   # 随机3行

# 查看数据形状
print(f"行数: {len(gdf)}")
print(f"形状: {gdf.shape}")

# 查看列名
print(f"列名: {gdf.columns.tolist()}")

# 查看数据类型
print(gdf.dtypes)
```

### 4.3.2 数据信息

```python
# 详细信息（类似 pandas info）
gdf.info()
```

输出示例：

```
<class 'geopandas.geodataframe.GeoDataFrame'>
RangeIndex: 177 entries, 0 to 176
Data columns (total 6 columns):
 #   Column    Non-Null Count  Dtype
---  ------    --------------  -----
 0   pop_est   177 non-null    int64
 1   continent 177 non-null    object
 2   name      177 non-null    object
 3   iso_a3    177 non-null    object
 4   gdp_md_est 177 non-null   float64
 5   geometry  177 non-null    geometry
dtypes: float64(1), geometry(1), int64(1), object(3)
memory usage: 8.4+ KB
```

### 4.3.3 统计描述

```python
# 数值列的统计描述
print(gdf.describe())

# 包含所有列
print(gdf.describe(include='all'))

# 空间统计
print("\n空间统计:")
print(f"  CRS: {gdf.crs}")
print(f"  总边界: {gdf.total_bounds}")
print(f"  几何类型: {gdf.geom_type.value_counts().to_dict()}")
print(f"  空几何数: {gdf.is_empty.sum()}")
print(f"  无效几何数: {(~gdf.is_valid).sum()}")
```

### 4.3.4 几何信息快速检查

```python
# 几何类型分布
print("几何类型分布:")
print(gdf.geom_type.value_counts())

# 边界框
print("\n边界框 (每个要素):")
print(gdf.bounds.head())

# 总边界框
print("\n总边界框:")
minx, miny, maxx, maxy = gdf.total_bounds
print(f"  经度范围: [{minx:.2f}, {maxx:.2f}]")
print(f"  纬度范围: [{miny:.2f}, {maxy:.2f}]")
```

---

## 4.4 几何列管理

### 4.4.1 geometry 属性

`geometry` 属性返回当前活跃的几何列：

```python
import geopandas as gpd
from shapely.geometry import Point

gdf = gpd.GeoDataFrame({
    '名称': ['A', 'B'],
    'geometry': [Point(0, 0), Point(1, 1)]
}, crs="EPSG:4326")

# 访问几何列
geom = gdf.geometry
print("类型:", type(geom))           # GeoSeries
print("列名:", geom.name)            # 'geometry'
print("CRS:", geom.crs)              # EPSG:4326
```

### 4.4.2 set_geometry() - 设置活跃几何列

```python
import geopandas as gpd
from shapely.geometry import Point

gdf = gpd.GeoDataFrame({
    '名称': ['A', 'B'],
    '原始点': [Point(0, 0), Point(1, 1)],
    '偏移点': [Point(0.5, 0.5), Point(1.5, 1.5)]
})

# 设置 '原始点' 为活跃几何列
gdf = gdf.set_geometry('原始点')
print("活跃几何列:", gdf.geometry.name)  # '原始点'
print("质心:", gdf.centroid.tolist())

# 切换到 '偏移点'
gdf = gdf.set_geometry('偏移点')
print("活跃几何列:", gdf.geometry.name)  # '偏移点'
print("质心:", gdf.centroid.tolist())

# set_geometry 也可以接受 GeoSeries
new_geom = gpd.GeoSeries([Point(10, 10), Point(20, 20)])
gdf = gdf.set_geometry(new_geom)
```

### 4.4.3 rename_geometry() - 重命名几何列

```python
# 重命名几何列
gdf = gdf.rename_geometry('geom')
print("新列名:", gdf.geometry.name)  # 'geom'
```

### 4.4.4 active_geometry_name 属性

```python
# 获取活跃几何列的名称（只读）
print(gdf.active_geometry_name)
```

### 4.4.5 多几何列管理

```python
import geopandas as gpd
from shapely.geometry import Point

gdf = gpd.GeoDataFrame({
    '名称': ['A', 'B', 'C'],
    '实际位置': [Point(0, 0), Point(1, 1), Point(2, 2)],
    '标注位置': [Point(0.1, 0.1), Point(1.1, 1.1), Point(2.1, 2.1)]
})

# 设置活跃几何列
gdf = gdf.set_geometry('实际位置')

# 添加缓冲区作为新几何列
gdf['服务范围'] = gdf.buffer(0.5)

# 查看所有几何列
geom_cols = [col for col in gdf.columns if gdf[col].dtype.name == 'geometry']
print("所有几何列:", geom_cols)
# ['实际位置', '标注位置', '服务范围']

# 根据需要切换活跃几何列
gdf_service = gdf.set_geometry('服务范围')
print("当前操作的几何:", gdf_service.geometry.name)
```

---

## 4.5 数据选择与过滤

### 4.5.1 基于索引选择

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# loc - 基于标签
print(world.loc[0])               # 第一行
print(world.loc[0:5])             # 前6行
print(world.loc[0, 'name'])       # 第一行的 name 列

# iloc - 基于位置
print(world.iloc[0])              # 第一行
print(world.iloc[0:5])            # 前5行（不含第5行）
print(world.iloc[0, 2])           # 第一行第三列
```

### 4.5.2 基于条件过滤

```python
# 单条件过滤
asia = world[world['continent'] == 'Asia']
print(f"亚洲国家: {len(asia)} 个")

# 多条件过滤（AND）
large_asian = world[(world['continent'] == 'Asia') & (world['pop_est'] > 100_000_000)]
print(f"亚洲人口过亿的国家: {len(large_asian)} 个")

# 多条件过滤（OR）
asia_or_europe = world[(world['continent'] == 'Asia') | (world['continent'] == 'Europe')]
print(f"亚洲或欧洲的国家: {len(asia_or_europe)} 个")

# 使用 isin
selected = world[world['continent'].isin(['Asia', 'Europe', 'Africa'])]
print(f"选定大洲的国家: {len(selected)} 个")

# 使用 query 方法
result = world.query("continent == 'Asia' and pop_est > 50_000_000")
print(f"query 结果: {len(result)} 个")

# 字符串方法
china_related = world[world['name'].str.contains('China', na=False)]
print(f"名称含 China: {len(china_related)} 个")
```

### 4.5.3 空间过滤

```python
from shapely.geometry import box, Point

# 使用边界框过滤
bbox = box(100, 20, 130, 50)  # 东亚区域
east_asia = world[world.intersects(bbox)]
print(f"东亚区域国家: {len(east_asia)} 个")

# 使用点过滤 - 找到包含某个点的多边形
beijing = Point(116.40, 39.90)
containing = world[world.contains(beijing)]
print(f"包含北京的国家: {containing['name'].tolist()}")

# 使用缓冲区过滤 - 找到某个点附近的要素
buffer_zone = beijing.buffer(10)  # 约10度范围
nearby = world[world.intersects(buffer_zone)]
print(f"北京附近的国家: {nearby['name'].tolist()}")

# cx 属性 - 基于坐标范围快速过滤
east_asia_cx = world.cx[100:130, 20:50]
print(f"cx 过滤结果: {len(east_asia_cx)} 个")
```

### 4.5.4 列选择

```python
# 选择特定列（保持 GeoDataFrame 类型）
subset = world[['name', 'continent', 'pop_est', 'geometry']]
print(type(subset))  # GeoDataFrame

# 选择不含几何列（变为普通 DataFrame）
attrs = world[['name', 'continent', 'pop_est']]
print(type(attrs))   # DataFrame

# 使用 drop 删除列
reduced = world.drop(columns=['iso_a3', 'gdp_md_est'])
print(reduced.columns.tolist())

# 使用 filter 方法
filtered = world.filter(items=['name', 'pop_est', 'geometry'])
print(filtered.columns.tolist())
```

---

## 4.6 数据修改

### 4.6.1 添加列

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 添加常规列
world['大洲中文'] = world['continent'].map({
    'Asia': '亚洲',
    'Europe': '欧洲',
    'Africa': '非洲',
    'North America': '北美洲',
    'South America': '南美洲',
    'Oceania': '大洋洲',
    'Antarctica': '南极洲'
})

# 添加计算列
world_proj = world.to_crs('+proj=aea +lat_1=20 +lat_2=60 +lon_0=0')
world['面积_km2'] = world_proj.area / 1e6
world['人口密度'] = world['pop_est'] / world['面积_km2']

# 添加空间属性列
world['质心经度'] = world.centroid.x
world['质心纬度'] = world.centroid.y

print(world[['name', '面积_km2', '人口密度', '质心经度', '质心纬度']].head())
```

### 4.6.2 修改值

```python
# 修改单个值
world.loc[0, 'pop_est'] = 0

# 条件修改
world.loc[world['pop_est'] < 0, 'pop_est'] = 0

# 批量修改
world['pop_est'] = world['pop_est'].clip(lower=0)

# 修改几何
from shapely.geometry import Point
world.loc[0, 'geometry'] = Point(0, 0)  # 修改第一行的几何

# 使用 apply 修改
world['name_upper'] = world['name'].apply(str.upper)
```

### 4.6.3 删除列

```python
# 删除单列
world = world.drop(columns=['name_upper'])

# 删除多列
world = world.drop(columns=['质心经度', '质心纬度'])

# 使用 del
del world['大洲中文']

# 使用 pop（删除并返回）
area_col = world.pop('面积_km2')
```

### 4.6.4 删除行

```python
# 按索引删除
world = world.drop(index=[0, 1, 2])

# 按条件删除（保留满足条件的行）
world = world[world['pop_est'] > 0]

# 删除重复行
world = world.drop_duplicates(subset=['name'])

# 删除缺失值行
world = world.dropna(subset=['pop_est'])
```

---

## 4.7 排序与分组

### 4.7.1 排序

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 按单列排序
world_sorted = world.sort_values('pop_est', ascending=False)
print("人口最多的5个国家:")
print(world_sorted[['name', 'pop_est']].head())

# 按多列排序
world_sorted = world.sort_values(['continent', 'pop_est'], ascending=[True, False])

# 按索引排序
world_sorted = world.sort_index()

# 按面积排序（空间属性排序）
world['area'] = world.to_crs('+proj=aea +lat_1=20 +lat_2=60').area
world_by_area = world.sort_values('area', ascending=False)
print("\n面积最大的5个国家:")
print(world_by_area[['name', 'area']].head())
```

### 4.7.2 分组操作

```python
# 按大洲分组统计
continent_stats = world.groupby('continent').agg({
    'pop_est': ['sum', 'mean', 'count'],
    'gdp_md_est': 'sum'
}).round(0)
print("大洲统计:")
print(continent_stats)

# groupby 与空间数据的结合
# 按大洲计算总面积
continent_areas = world.groupby('continent')['area'].sum()
print("\n大洲面积:")
print(continent_areas)
```

### 4.7.3 dissolve - 空间分组融合

`dissolve()` 是 GeoPandas 特有的方法，可以同时进行空间几何融合和属性聚合：

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 按大洲融合（几何合并 + 属性聚合）
continents = world.dissolve(
    by='continent',
    aggfunc={
        'pop_est': 'sum',
        'gdp_md_est': 'sum',
        'name': 'count'  # 计数
    }
).rename(columns={'name': '国家数量'})

print("大洲融合结果:")
print(continents[['pop_est', 'gdp_md_est', '国家数量']])
print(f"\n几何类型: {continents.geom_type.tolist()}")
```

`dissolve` 与 `groupby` 的区别：

| 特性 | groupby | dissolve |
|------|---------|----------|
| 属性聚合 | ✅ | ✅ |
| 几何融合 | ❌ | ✅ |
| 返回类型 | DataFrame | GeoDataFrame |
| 空间操作 | 不涉及 | 合并相邻几何 |

---

## 4.8 合并与连接

### 4.8.1 merge - 属性连接

与 pandas 相同的属性连接（非空间）：

```python
import geopandas as gpd
import pandas as pd

# 空间数据
world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 属性数据（普通 DataFrame）
gdp_per_capita = pd.DataFrame({
    'iso_a3': ['CHN', 'USA', 'IND', 'BRA', 'JPN'],
    '人均GDP_美元': [12556, 76329, 2389, 8917, 39312]
})

# 属性连接
merged = world.merge(gdp_per_capita, on='iso_a3', how='left')
print(type(merged))  # GeoDataFrame（保持空间数据类型）
print(merged[['name', 'iso_a3', '人均GDP_美元']].head(10))
```

### 4.8.2 concat - 纵向合并

```python
import geopandas as gpd
import pandas as pd

# 合并多个 GeoDataFrame
gdf1 = gpd.GeoDataFrame({
    'name': ['A'],
    'geometry': [Point(0, 0)]
}, crs="EPSG:4326")

gdf2 = gpd.GeoDataFrame({
    'name': ['B'],
    'geometry': [Point(1, 1)]
}, crs="EPSG:4326")

# 纵向合并
combined = pd.concat([gdf1, gdf2], ignore_index=True)
print(type(combined))  # GeoDataFrame
print(combined)

# 注意：合并的 GeoDataFrame 应该有相同的 CRS
# 如果 CRS 不同，需要先统一
```

### 4.8.3 sjoin - 空间连接

空间连接是 GeoPandas 最强大的功能之一：

```python
import geopandas as gpd
from shapely.geometry import Point, Polygon

# 点数据
points = gpd.GeoDataFrame({
    '站名': ['站A', '站B', '站C', '站D'],
    'PM25': [75, 42, 38, 60],
    'geometry': [
        Point(0.5, 0.5), Point(1.5, 1.5),
        Point(0.5, 1.5), Point(2.5, 0.5)
    ]
})

# 多边形数据
polygons = gpd.GeoDataFrame({
    '区域': ['东区', '西区'],
    'geometry': [
        Polygon([(0, 0), (2, 0), (2, 2), (0, 2)]),
        Polygon([(2, 0), (4, 0), (4, 2), (2, 2)])
    ]
})

# 空间连接：将点关联到所在的多边形
joined = gpd.sjoin(points, polygons, predicate='within')
print("空间连接结果:")
print(joined)

# 支持的空间谓词（predicate）
# 'intersects'  - 相交（默认）
# 'within'      - 在...之内
# 'contains'    - 包含
# 'crosses'     - 交叉
# 'overlaps'    - 重叠
# 'touches'     - 相切

# 连接类型
# how='inner' - 只保留匹配的行（默认）
# how='left'  - 保留左表所有行
# how='right' - 保留右表所有行
```

### 4.8.4 sjoin_nearest - 最近邻连接

```python
import geopandas as gpd
from shapely.geometry import Point

# 兴趣点
pois = gpd.GeoDataFrame({
    '名称': ['餐厅A', '超市B', '学校C'],
    'geometry': [Point(0, 0), Point(3, 3), Point(5, 5)]
})

# 目标点
targets = gpd.GeoDataFrame({
    '编号': ['T1', 'T2'],
    'geometry': [Point(1, 1), Point(4, 4)]
})

# 最近邻连接
nearest_result = gpd.sjoin_nearest(
    targets, pois,
    distance_col='距离',   # 可选：添加距离列
    max_distance=5         # 可选：最大距离限制
)
print("最近邻连接结果:")
print(nearest_result)
```

---

## 4.9 数据类型转换

### 4.9.1 CRS 转换 - to_crs()

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 查看当前 CRS
print("原始 CRS:", world.crs)  # EPSG:4326

# 转换为 Web 墨卡托
world_3857 = world.to_crs(epsg=3857)
print("转换后 CRS:", world_3857.crs)

# 使用 PROJ 字符串
world_aea = world.to_crs('+proj=aea +lat_1=20 +lat_2=60 +lon_0=105')

# 使用 CRS 对象
from pyproj import CRS
target_crs = CRS.from_epsg(32650)
world_utm = world.to_crs(target_crs)
```

### 4.9.2 几何类型转换

```python
import geopandas as gpd
from shapely.geometry import Point, MultiPoint

# 单几何 → 多几何
points = gpd.GeoSeries([Point(0, 0), Point(1, 1)])
multi_points = points.apply(lambda geom: MultiPoint([geom]))
print("转换后类型:", multi_points.geom_type.tolist())

# 多几何 → 单几何（explode）
gdf = gpd.GeoDataFrame({
    '名称': ['组A'],
    'geometry': [MultiPoint([Point(0, 0), Point(1, 1), Point(2, 2)])]
})
exploded = gdf.explode(index_parts=True)
print("explode 结果:")
print(exploded)
print("行数: 1 → ", len(exploded))
```

### 4.9.3 属性类型转换

```python
# 数据类型转换（同 pandas）
gdf['pop_est'] = gdf['pop_est'].astype(float)
gdf['continent'] = gdf['continent'].astype('category')

# 日期类型
gdf['date'] = pd.to_datetime(gdf['date_str'])
```

---

## 4.10 迭代与应用函数

### 4.10.1 iterrows() - 逐行迭代

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 逐行迭代（注意：速度较慢，应尽量避免）
for idx, row in world.head(3).iterrows():
    print(f"{row['name']}: 人口 {row['pop_est']:,}, 几何类型 {row.geometry.geom_type}")
```

> ⚠️ **性能警告**：`iterrows()` 速度很慢，应尽量使用向量化操作代替。

### 4.10.2 iterfeatures() - 迭代为 GeoJSON Feature

```python
# 迭代为 GeoJSON Feature 字典
for feature in world.head(3).iterfeatures():
    print(f"类型: {feature['type']}")
    print(f"属性: {list(feature['properties'].keys())}")
    print(f"几何: {feature['geometry']['type']}")
    print()
```

### 4.10.3 apply() - 应用函数

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 对列应用函数
world['name_len'] = world['name'].apply(len)

# 对几何应用函数
world['vertex_count'] = world.geometry.apply(
    lambda geom: len(geom.exterior.coords) if geom.geom_type == 'Polygon'
    else sum(len(p.exterior.coords) for p in geom.geoms) if geom.geom_type == 'MultiPolygon'
    else 0
)
print(world[['name', 'vertex_count']].head())

# 对行应用函数
def describe_country(row):
    return f"{row['name']} ({row['continent']}): {row['pop_est']:,.0f} 人"

world['描述'] = world.apply(describe_country, axis=1)
print(world['描述'].head())
```

### 4.10.4 向量化操作（推荐替代方案）

```python
# ❌ 不推荐：使用 apply 计算缓冲区
# gdf['buffer'] = gdf.geometry.apply(lambda g: g.buffer(100))

# ✅ 推荐：使用向量化操作
gdf['buffer'] = gdf.buffer(100)

# ❌ 不推荐：使用 apply 计算距离
# target = Point(0, 0)
# gdf['dist'] = gdf.geometry.apply(lambda g: g.distance(target))

# ✅ 推荐：使用向量化操作
from shapely.geometry import Point
target = Point(0, 0)
gdf['dist'] = gdf.distance(target)
```

---

## 4.11 复制与内存管理

### 4.11.1 copy() - 复制 GeoDataFrame

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 深拷贝（默认）- 完全独立的副本
world_copy = world.copy()
world_copy.loc[0, 'name'] = 'Modified'
print(world.loc[0, 'name'])       # 原始值未变
print(world_copy.loc[0, 'name'])  # 'Modified'

# 浅拷贝 - 共享底层数据
world_shallow = world.copy(deep=False)
```

### 4.11.2 内存使用

```python
# 查看内存使用
print("内存使用:")
print(world.memory_usage(deep=True))
print(f"\n总内存: {world.memory_usage(deep=True).sum() / 1024:.1f} KB")

# 优化内存
# 1. 使用分类类型
world['continent'] = world['continent'].astype('category')

# 2. 缩小数值类型
world['pop_est'] = world['pop_est'].astype('int32')

# 3. 简化几何（减少顶点数）
world_simplified = world.copy()
world_simplified['geometry'] = world_simplified.simplify(tolerance=0.1)

print("\n优化后内存:")
print(f"  原始: {world.memory_usage(deep=True).sum() / 1024:.1f} KB")
print(f"  简化后: {world_simplified.memory_usage(deep=True).sum() / 1024:.1f} KB")
```

---

## 4.12 GeoJSON 接口

### 4.12.1 __geo_interface__ 协议

GeoPandas 实现了 Python 的 `__geo_interface__` 协议，允许与其他地理空间库无缝交互：

```python
import geopandas as gpd
from shapely.geometry import Point

gdf = gpd.GeoDataFrame({
    '名称': ['A', 'B'],
    '值': [10, 20],
    'geometry': [Point(0, 0), Point(1, 1)]
}, crs="EPSG:4326")

# GeoDataFrame 的 __geo_interface__
geo_dict = gdf.__geo_interface__
print("类型:", geo_dict['type'])  # 'FeatureCollection'
print("要素数:", len(geo_dict['features']))
print("第一个要素:", geo_dict['features'][0])

# GeoSeries 的 __geo_interface__
gs_dict = gdf.geometry.__geo_interface__
print("\nGeoSeries 类型:", gs_dict['type'])  # 'GeometryCollection'
```

### 4.12.2 to_json() - 导出 GeoJSON 字符串

```python
# 导出为 GeoJSON 字符串
geojson_str = gdf.to_json()
print(geojson_str[:200])

# 自定义参数
geojson_str = gdf.to_json(
    na='null',           # 缺失值处理
    show_bbox=True,      # 包含边界框
    drop_id=False        # 保留索引作为 id
)

# 保存到文件
with open('output.geojson', 'w') as f:
    f.write(gdf.to_json())
```

### 4.12.3 to_geo_dict() - 导出为字典

```python
# 导出为 Python 字典（GeoJSON 格式）
geo_dict = gdf.to_geo_dict()
print("类型:", type(geo_dict))  # dict
print("键:", geo_dict.keys())   # dict_keys(['type', 'features'])
```

### 4.12.4 从 GeoJSON 创建

```python
import geopandas as gpd
import json

# 从 GeoJSON 字符串创建
geojson_str = '''
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "A", "value": 10},
            "geometry": {"type": "Point", "coordinates": [116.40, 39.90]}
        },
        {
            "type": "Feature",
            "properties": {"name": "B", "value": 20},
            "geometry": {"type": "Point", "coordinates": [121.47, 31.23]}
        }
    ]
}
'''

gdf = gpd.GeoDataFrame.from_features(json.loads(geojson_str)['features'])
print(gdf)

# 从文件读取 GeoJSON
gdf = gpd.read_file("data.geojson")
```

---

## 4.13 本章小结

本章全面介绍了 GeoDataFrame 的基础操作：

| 主题 | 要点 |
|------|------|
| 创建 | 字典、DataFrame 转换、文件读取、数据库读取 |
| 结构 | 属性列 + 几何列 + CRS + 空间索引 |
| 查看 | head(), info(), describe(), dtypes, shape |
| 几何列管理 | geometry 属性、set_geometry()、rename_geometry() |
| 数据选择 | loc/iloc、条件过滤、空间过滤、cx 属性 |
| 数据修改 | 添加/修改/删除列和行 |
| 排序分组 | sort_values()、groupby()、dissolve() |
| 合并连接 | merge()（属性）、sjoin()（空间）、concat()（纵向） |
| 类型转换 | to_crs()、explode()、astype() |
| 迭代应用 | iterrows()、apply()，推荐向量化操作 |
| 复制管理 | copy()、内存优化、simplify() |
| GeoJSON | __geo_interface__、to_json()、from_features() |

**核心原则**：

1. **优先使用向量化操作**，避免 `iterrows()` 和 `apply()`
2. **空间连接** (`sjoin`) 是最常用的空间操作之一
3. **dissolve** 是 GeoPandas 特有的空间分组方法
4. **CRS 转换** 是进行空间度量计算（面积、距离）的前提

**下一章预告**：第 5 章将深入讲解 GeoSeries 和几何对象的详细操作，包括各种几何类型、属性和方法。

---

> 📚 **参考资料**
> - [GeoPandas GeoDataFrame 文档](https://geopandas.org/en/stable/docs/reference/geodataframe.html)
> - [pandas DataFrame 文档](https://pandas.pydata.org/docs/reference/frame.html)
> - [GeoPandas 合并数据指南](https://geopandas.org/en/stable/docs/user_guide/mergingdata.html)
