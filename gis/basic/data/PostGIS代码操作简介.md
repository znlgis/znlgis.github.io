---
layout: default
title: PostGIS代码操作简介
---

# PostGIS代码操作简介

## 1. 代码操作POSTGIS的可选方案

1. jdbc
2. postgis-java
3. geotools
4. gdal

## 2. JDBC

```Java

    public void testJdbc() {
        String sql = "select st_area(st_geomfromtext('MULTIPOLYGON (((39364656.2504190132021904 2701523.9713633288629353, 39364650.82893280684947968 2701491.44244607863947749, 39364683.77488745748996735 2701504.16208679834380746, 39364683.77488745748996735 2701504.16208679834380746, 39364656.2504190132021904 2701523.9713633288629353)))'))";
        DataSource ds = new SimpleDataSource("jdbc:postgresql://localhost:5432/postgres",
                "postgres", "123456");
        Connection connection = ds.getConnection();
        ResultSet rs = connection.createStatement().executeQuery(sql);
        while (rs.next()) {
            System.out.println(rs.getString(1));
        }
        connection.close();
    }

```

## 3. PostGIS-Java

```Java

    public void testPostgisJava(){
        String wkt = "MULTIPOLYGON (((39364656.2504190132021904 2701523.9713633288629353, 39364650.82893280684947968 2701491.44244607863947749, 39364683.77488745748996735 2701504.16208679834380746, 39364683.77488745748996735 2701504.16208679834380746, 39364656.2504190132021904 2701523.9713633288629353)))";
        Connection connection = DriverManager.getConnection("jdbc:postgresql://localhost:5432/postgres",
                "postgres", "123456");
        PGgeometry geom = new PGgeometry(wkt);
        PreparedStatement ps = connection.prepareStatement("select st_area(?)");
        ps.setObject(1, geom);
        ResultSet rs = ps.executeQuery();
        while (rs.next()) {
            System.out.println(rs.getString(1));
        }
        connection.close();
    }

```

## 4. GeoTools

```Java

    public void testGeotools(){
        Map<String, Object> params = new HashMap<>();
        params.put("dbtype", "postgis");
        params.put("host", "127.0.0.1");
        params.put("port", "5432");
        params.put("schema", "public");
        params.put("database", "postgres");
        params.put("user", "postgres");
        params.put("passwd", "123456");
        params.put("preparedStatements", true);
        params.put("encode functions", true);

        String sql = "select st_area(st_geomfromtext('MULTIPOLYGON (((39364656.2504190132021904 2701523.9713633288629353, 39364650.82893280684947968 2701491.44244607863947749, 39364683.77488745748996735 2701504.16208679834380746, 39364683.77488745748996735 2701504.16208679834380746, 39364656.2504190132021904 2701523.9713633288629353)))'))";
        JDBCDataStore jdbcDataStore = (JDBCDataStore) DataStoreFinder.getDataStore(params);
        Statement statement = jdbcDataStore.getConnection(Transaction.AUTO_COMMIT).createStatement();
        ResultSet rs = statement.executeQuery(sql);
        while (rs.next()) {
            System.out.println(rs.getString(1));
        }
        statement.close();
        jdbcDataStore.dispose();
    }

```

## 5. GDAL

```Java

    public void testGdal(){
        String path = "PG: host=127.0.0.1 port=5432 dbname=postgres user=postgres password=123456 active_schema=public";
        ogr.RegisterAll();
        org.gdal.ogr.Driver driver = ogr.GetDriverByName("PostgreSQL");
        org.gdal.ogr.DataSource dataSource = driver.Open(path, 1);
        String sql = "select st_area(st_geomfromtext('MULTIPOLYGON (((39364656.2504190132021904 2701523.9713633288629353, 39364650.82893280684947968 2701491.44244607863947749, 39364683.77488745748996735 2701504.16208679834380746, 39364683.77488745748996735 2701504.16208679834380746, 39364656.2504190132021904 2701523.9713633288629353)))'))";
        Layer layer = dataSource.ExecuteSQL(sql);
        System.out.println(layer.GetFeature(0).GetFieldAsDouble(0));
        dataSource.delete();
    }

```

## 6. Geometry与Geography区别

PostGIS提供了两种主要的空间数据类型：`GEOMETRY`和`GEOGRAPHY`。这两种数据类型都可以用来存储地理空间数据，如点、线和多边形，但它们在处理这些数据时有一些重要的区别：

1. **坐标系统**：`GEOMETRY`数据类型使用笛卡尔坐标系统（平面坐标系统），而`GEOGRAPHY`数据类型使用球面坐标系统（经纬度）。这意味着`GEOMETRY`类型更适合处理本地或区域数据，而`GEOGRAPHY`类型更适合处理全球数据。

2. **计算**：`GEOMETRY`类型在计算距离、面积和长度时使用的是笛卡尔坐标系统，这可能会导致结果不准确，特别是在处理大范围的数据时。相反，`GEOGRAPHY`类型在计算这些值时会考虑地球的曲率，因此结果更准确。

3. **性能**：`GEOMETRY`类型通常比`GEOGRAPHY`类型更快，因为笛卡尔计算通常比球面计算更简单。然而，这种性能差异通常只在处理大量数据时才显著。

4. **空间函数支持**：`GEOMETRY`类型支持更多的空间函数，而`GEOGRAPHY`类型只支持一部分空间函数。

在选择使用`GEOMETRY`还是`GEOGRAPHY`时，你应该根据你的具体需求和数据来决定。如果你需要处理全球数据，并且需要准确的距离和面积计算，那么`GEOGRAPHY`可能是更好的选择。如果你需要处理本地或区域数据，或者需要使用更多的空间函数，那么`GEOMETRY`可能是更好的选择。
