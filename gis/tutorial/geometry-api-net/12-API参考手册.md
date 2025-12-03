# 第十二章：API 参考手册

## 12.1 几何类型

### 12.1.1 Geometry（抽象基类）

所有几何类型的基类。

```csharp
public abstract class Geometry
{
    // 属性
    public abstract GeometryType Type { get; }
    public abstract bool IsEmpty { get; }
    public abstract int Dimension { get; }
    public bool IsPoint { get; }
    public bool IsLinear { get; }
    public bool IsArea { get; }
    
    // 方法
    public abstract Envelope GetEnvelope();
    public virtual double CalculateArea2D();
    public virtual double CalculateLength2D();
    public virtual Geometry Copy();
    public virtual bool IsValid();
}
```

### 12.1.2 Point（点）

```csharp
public class Point : Geometry
{
    // 构造函数
    public Point();
    public Point(double x, double y);
    public Point(double x, double y, double z);
    
    // 属性
    public double X { get; set; }
    public double Y { get; set; }
    public double? Z { get; set; }
    public double? M { get; set; }
    
    // 方法
    public double Distance(Point other);
    public bool Equals(Point other, double tolerance = GeometryConstants.DefaultTolerance);
}
```

### 12.1.3 MultiPoint（多点）

```csharp
public class MultiPoint : Geometry
{
    // 构造函数
    public MultiPoint();
    public MultiPoint(IEnumerable<Point> points);
    
    // 属性
    public int Count { get; }
    
    // 方法
    public Point GetPoint(int index);
    public void Add(Point point);
    public IEnumerable<Point> GetPoints();
}
```

### 12.1.4 Line（线段）

```csharp
public class Line : Geometry
{
    // 构造函数
    public Line();
    public Line(Point start, Point end);
    
    // 属性
    public Point Start { get; set; }
    public Point End { get; set; }
    public double Length { get; }
}
```

### 12.1.5 Polyline（折线）

```csharp
public class Polyline : Geometry
{
    // 构造函数
    public Polyline();
    
    // 属性
    public int PathCount { get; }
    public double Length { get; }
    
    // 方法
    public void AddPath(IEnumerable<Point> points);
    public IReadOnlyList<Point> GetPath(int index);
    public IEnumerable<IReadOnlyList<Point>> GetPaths();
}
```

### 12.1.6 Polygon（多边形）

```csharp
public class Polygon : Geometry
{
    // 构造函数
    public Polygon();
    
    // 属性
    public int RingCount { get; }
    public double Area { get; }
    
    // 方法
    public void AddRing(IEnumerable<Point> points);
    public IReadOnlyList<Point> GetRing(int index);
    public IEnumerable<IReadOnlyList<Point>> GetRings();
}
```

### 12.1.7 Envelope（包络矩形）

```csharp
public class Envelope : Geometry
{
    // 构造函数
    public Envelope();
    public Envelope(double xMin, double yMin, double xMax, double yMax);
    
    // 属性
    public double XMin { get; set; }
    public double YMin { get; set; }
    public double XMax { get; set; }
    public double YMax { get; set; }
    public double Width { get; }
    public double Height { get; }
    public Point Center { get; }
    public double Area { get; }
    
    // 方法
    public bool Contains(Point point);
    public bool Intersects(Envelope other);
    public void Merge(Point point);
    public void Merge(Envelope other);
}
```

## 12.2 空间关系操作符

### 12.2.1 ContainsOperator

测试 geometry1 是否包含 geometry2。

```csharp
ContainsOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Contains(geometry1, geometry2);
```

### 12.2.2 IntersectsOperator

测试两个几何对象是否相交。

```csharp
IntersectsOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Intersects(geometry1, geometry2);
```

### 12.2.3 DistanceOperator

计算两个几何对象之间的距离。

```csharp
DistanceOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Distance(geometry1, geometry2);
```

### 12.2.4 EqualsOperator

测试两个几何对象是否空间相等。

```csharp
EqualsOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Equals(geometry1, geometry2);
```

### 12.2.5 DisjointOperator

测试两个几何对象是否分离。

```csharp
DisjointOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Disjoint(geometry1, geometry2);
```

### 12.2.6 WithinOperator

测试 geometry1 是否在 geometry2 内部。

```csharp
WithinOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Within(geometry1, geometry2);
```

### 12.2.7 CrossesOperator

测试两个几何对象是否交叉。

```csharp
CrossesOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Crosses(geometry1, geometry2);
```

### 12.2.8 TouchesOperator

测试两个几何对象是否接触。

```csharp
TouchesOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Touches(geometry1, geometry2);
```

### 12.2.9 OverlapsOperator

测试两个几何对象是否重叠。

```csharp
OverlapsOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Overlaps(geometry1, geometry2);
```

## 12.3 几何运算操作符

### 12.3.1 BufferOperator

创建缓冲区。

```csharp
BufferOperator.Instance.Execute(geometry, distance);
GeometryEngine.Buffer(geometry, distance);
```

### 12.3.2 ConvexHullOperator

计算凸包。

```csharp
ConvexHullOperator.Instance.Execute(geometry);
GeometryEngine.ConvexHull(geometry);
```

### 12.3.3 AreaOperator

计算面积。

```csharp
AreaOperator.Instance.Execute(geometry);
GeometryEngine.Area(geometry);
```

### 12.3.4 LengthOperator

计算长度。

```csharp
LengthOperator.Instance.Execute(geometry);
GeometryEngine.Length(geometry);
```

### 12.3.5 SimplifyOperator

简化几何对象。

```csharp
SimplifyOperator.Instance.Execute(geometry, tolerance);
GeometryEngine.Simplify(geometry, tolerance);
```

### 12.3.6 CentroidOperator

计算质心。

```csharp
CentroidOperator.Instance.Execute(geometry);
GeometryEngine.Centroid(geometry);
```

### 12.3.7 BoundaryOperator

获取边界。

```csharp
BoundaryOperator.Instance.Execute(geometry);
GeometryEngine.Boundary(geometry);
```

### 12.3.8 GeneralizeOperator

概化几何对象。

```csharp
GeneralizeOperator.Instance.Execute(geometry, maxDeviation);
GeometryEngine.Generalize(geometry, maxDeviation);
```

### 12.3.9 DensifyOperator

密化几何对象。

```csharp
DensifyOperator.Instance.Execute(geometry, maxSegmentLength);
GeometryEngine.Densify(geometry, maxSegmentLength);
```

### 12.3.10 ClipOperator

裁剪几何对象。

```csharp
ClipOperator.Instance.Execute(geometry, envelope);
GeometryEngine.Clip(geometry, envelope);
```

### 12.3.11 OffsetOperator

偏移几何对象。

```csharp
OffsetOperator.Instance.Execute(geometry, distance);
GeometryEngine.Offset(geometry, distance);
```

## 12.4 集合操作符

### 12.4.1 UnionOperator

计算并集。

```csharp
UnionOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Union(geometry1, geometry2);
```

### 12.4.2 IntersectionOperator

计算交集。

```csharp
IntersectionOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Intersection(geometry1, geometry2);
```

### 12.4.3 DifferenceOperator

计算差集。

```csharp
DifferenceOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.Difference(geometry1, geometry2);
```

### 12.4.4 SymmetricDifferenceOperator

计算对称差。

```csharp
SymmetricDifferenceOperator.Instance.Execute(geometry1, geometry2);
GeometryEngine.SymmetricDifference(geometry1, geometry2);
```

## 12.5 大地测量操作符

### 12.5.1 GeodesicDistanceOperator

计算大地测量距离。

```csharp
GeodesicDistanceOperator.Instance.Execute(point1, point2);
GeometryEngine.GeodesicDistance(point1, point2);
```

### 12.5.2 GeodesicAreaOperator

计算大地测量面积。

```csharp
GeodesicAreaOperator.Instance.Execute(polygon);
GeometryEngine.GeodesicArea(polygon);
```

## 12.6 邻近操作

### 12.6.1 Proximity2DOperator

```csharp
// 获取最近坐标
Proximity2DOperator.Instance.GetNearestCoordinate(geometry, inputPoint, testPolygonInterior);
GeometryEngine.GetNearestCoordinate(geometry, inputPoint, testPolygonInterior);

// 获取最近顶点
Proximity2DOperator.Instance.GetNearestVertex(geometry, inputPoint);
GeometryEngine.GetNearestVertex(geometry, inputPoint);

// 获取范围内的顶点
Proximity2DOperator.Instance.GetNearestVertices(geometry, inputPoint, searchRadius, maxVertexCount);
GeometryEngine.GetNearestVertices(geometry, inputPoint, searchRadius, maxVertexCount);
```

### 12.6.2 Proximity2DResult

```csharp
public class Proximity2DResult
{
    public Point Coordinate { get; }
    public int VertexIndex { get; }
    public double Distance { get; }
    public bool IsEmpty { get; }
}
```

## 12.7 数据格式

### 12.7.1 WKT

```csharp
// 导出
WktExportOperator.ExportToWkt(geometry);
GeometryEngine.GeometryToWkt(geometry);

// 导入
WktImportOperator.ImportFromWkt(wkt);
GeometryEngine.GeometryFromWkt(wkt);
```

### 12.7.2 WKB

```csharp
// 导出
WkbExportOperator.ExportToWkb(geometry, bigEndian);
GeometryEngine.GeometryToWkb(geometry, bigEndian);

// 导入
WkbImportOperator.ImportFromWkb(wkb);
GeometryEngine.GeometryFromWkb(wkb);
```

### 12.7.3 GeoJSON

```csharp
// 导出
GeoJsonExportOperator.ExportToGeoJson(geometry);
GeometryEngine.GeometryToGeoJson(geometry);

// 导入
GeoJsonImportOperator.ImportFromGeoJson(geoJson);
GeometryEngine.GeometryFromGeoJson(geoJson);
```

### 12.7.4 Esri JSON

```csharp
// 导出
EsriJsonExportOperator.Instance.Execute(geometry, spatialReference);
GeometryEngine.GeometryToEsriJson(geometry);

// 导入
EsriJsonImportOperator.ImportFromEsriJson(esriJson);
GeometryEngine.GeometryFromEsriJson(esriJson);
```

## 12.8 空间参考

### 12.8.1 SpatialReference

```csharp
public class SpatialReference
{
    // 构造函数
    public SpatialReference();
    public SpatialReference(int wkid);
    
    // 属性
    public int? Wkid { get; set; }
    public int? LatestWkid { get; set; }
    public string? Wkt { get; set; }
    
    // 工厂方法
    public static SpatialReference Wgs84();       // EPSG:4326
    public static SpatialReference WebMercator(); // EPSG:3857
}
```

### 12.8.2 MapGeometry

```csharp
public class MapGeometry
{
    // 构造函数
    public MapGeometry();
    public MapGeometry(Geometry geometry, SpatialReference spatialReference);
    
    // 属性
    public Geometry? Geometry { get; set; }
    public SpatialReference? SpatialReference { get; set; }
    
    // 方法
    public bool Equals(MapGeometry other);
    public override int GetHashCode();
    public override string ToString();
}
```

## 12.9 GeometryEngine

统一的静态 API 入口。

```csharp
public static class GeometryEngine
{
    // 空间关系
    public static bool Contains(Geometry g1, Geometry g2);
    public static bool Intersects(Geometry g1, Geometry g2);
    public static double Distance(Geometry g1, Geometry g2);
    public static bool Equals(Geometry g1, Geometry g2);
    public static bool Disjoint(Geometry g1, Geometry g2);
    public static bool Within(Geometry g1, Geometry g2);
    public static bool Crosses(Geometry g1, Geometry g2);
    public static bool Touches(Geometry g1, Geometry g2);
    public static bool Overlaps(Geometry g1, Geometry g2);
    
    // 集合操作
    public static Geometry Union(Geometry g1, Geometry g2);
    public static Geometry Intersection(Geometry g1, Geometry g2);
    public static Geometry Difference(Geometry g1, Geometry g2);
    public static Geometry SymmetricDifference(Geometry g1, Geometry g2);
    
    // 几何操作
    public static Geometry Buffer(Geometry g, double distance);
    public static Geometry ConvexHull(Geometry g);
    public static double Area(Geometry g);
    public static double Length(Geometry g);
    public static Geometry Simplify(Geometry g, double tolerance);
    public static Geometry SimplifyOGC(Geometry g, SpatialReference? sr);
    public static bool IsSimpleOGC(Geometry g, SpatialReference? sr);
    public static Point Centroid(Geometry g);
    public static Geometry Boundary(Geometry g);
    public static Geometry Generalize(Geometry g, double maxDeviation);
    public static Geometry Densify(Geometry g, double maxSegmentLength);
    public static Geometry Clip(Geometry g, Envelope clipEnvelope);
    public static Geometry Offset(Geometry g, double distance);
    
    // 大地测量
    public static double GeodesicDistance(Point p1, Point p2);
    public static double GeodesicArea(Polygon polygon);
    
    // 邻近操作
    public static Proximity2DResult GetNearestCoordinate(Geometry g, Point p, bool testPolygonInterior);
    public static Proximity2DResult GetNearestVertex(Geometry g, Point p);
    public static Proximity2DResult[] GetNearestVertices(Geometry g, Point p, double radius, int maxCount);
    
    // 数据格式
    public static string GeometryToWkt(Geometry g);
    public static Geometry GeometryFromWkt(string wkt);
    public static byte[] GeometryToWkb(Geometry g, bool bigEndian);
    public static Geometry GeometryFromWkb(byte[] wkb);
    public static string GeometryToGeoJson(Geometry g);
    public static Geometry GeometryFromGeoJson(string geoJson);
    public static string GeometryToEsriJson(Geometry g);
    public static Geometry GeometryFromEsriJson(string esriJson);
}
```

## 12.10 常量

```csharp
public static class GeometryConstants
{
    public const double DefaultTolerance = 1e-10;
    public const double Epsilon = 1e-12;
}
```

## 12.11 枚举

```csharp
public enum GeometryType
{
    Unknown = 0,
    Point = 1,
    Line = 2,
    Envelope = 3,
    MultiPoint = 4,
    Polyline = 5,
    Polygon = 6
}
```

---

本手册涵盖了 geometry-api-net 的所有公共 API。如需更多详细信息，请参阅源代码中的 XML 文档注释。
