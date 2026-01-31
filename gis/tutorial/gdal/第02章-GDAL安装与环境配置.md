---
layout: default
title: 第02章 - GDAL安装与环境配置
---

# 第02章：GDAL安装与环境配置

## 2.1 安装概述

GDAL 的安装方式多种多样，根据操作系统和使用场景的不同，可以选择不同的安装方法。本章将详细介绍各种安装方式，帮助你在不同环境下成功配置 GDAL。

### 2.1.1 安装方式比较

| 安装方式 | 优点 | 缺点 | 适用场景 |
|---------|------|------|---------|
| 包管理器 | 简单快捷，依赖自动处理 | 版本可能较旧 | 快速开发、学习 |
| Conda | 版本选择灵活，环境隔离 | 需要学习 Conda | Python 开发 |
| OSGeo4W | Windows 专用，功能完整 | 仅限 Windows | Windows GIS 开发 |
| Docker | 环境隔离，可复制 | 需要 Docker 知识 | 生产部署、CI/CD |
| 源码编译 | 完全自定义 | 复杂耗时 | 特殊需求、嵌入式 |
| NuGet/.NET | .NET 集成简单 | 仅限 .NET 项目 | C#/.NET 开发 |
| Maven | Java 集成简单 | 仅限 Java 项目 | Java 开发 |

### 2.1.2 版本选择建议

| 使用场景 | 推荐版本 | 理由 |
|---------|---------|------|
| 生产环境 | 3.4.x LTS 或 3.6.x | 稳定性高 |
| 学习开发 | 最新稳定版 | 功能最全 |
| 旧系统兼容 | 2.4.x | 兼容性好 |
| 云原生应用 | 3.6.x+ | COG 支持完善 |

## 2.2 Windows 安装

### 2.2.1 使用 OSGeo4W 安装（推荐）

OSGeo4W 是 Windows 平台上安装 GDAL 的最佳选择，它提供了完整的 OSGeo 软件栈。

**步骤 1：下载安装程序**

访问 [OSGeo4W 官网](https://trac.osgeo.org/osgeo4w/) 下载安装程序：

```
https://download.osgeo.org/osgeo4w/v2/osgeo4w-setup.exe
```

**步骤 2：运行安装程序**

```
1. 双击 osgeo4w-setup.exe
2. 选择 "Express Install" 或 "Advanced Install"
3. 选择下载站点（推荐选择离你最近的镜像）
4. 选择要安装的包
```

**Express Install 包含：**
- GDAL
- QGIS
- GRASS GIS

**Advanced Install 可选包：**

| 包名 | 描述 |
|-----|------|
| gdal | GDAL 核心库和工具 |
| gdal-python | Python 绑定 |
| gdal-java | Java 绑定 |
| gdal-csharp | C# 绑定 |
| proj | PROJ 投影库 |
| geos | GEOS 几何库 |

**步骤 3：配置环境变量**

安装完成后，需要配置环境变量：

```batch
:: 设置 OSGeo4W 根目录
set OSGEO4W_ROOT=C:\OSGeo4W

:: 添加到 PATH
set PATH=%OSGEO4W_ROOT%\bin;%PATH%

:: 设置 GDAL 数据目录
set GDAL_DATA=%OSGEO4W_ROOT%\share\gdal

:: 设置 PROJ 数据目录
set PROJ_LIB=%OSGEO4W_ROOT%\share\proj
```

也可以通过系统设置永久添加：

```
1. 右键"此电脑" -> 属性
2. 高级系统设置 -> 环境变量
3. 在"系统变量"中编辑 Path，添加 C:\OSGeo4W\bin
4. 新建系统变量 GDAL_DATA = C:\OSGeo4W\share\gdal
5. 新建系统变量 PROJ_LIB = C:\OSGeo4W\share\proj
```

**步骤 4：验证安装**

打开命令提示符：

```batch
:: 查看 GDAL 版本
gdalinfo --version

:: 输出示例：
:: GDAL 3.7.0, released 2023/05/02

:: 查看支持的格式
gdalinfo --formats

:: 查看矢量格式
ogrinfo --formats
```

### 2.2.2 使用 Conda 安装

Conda 是另一种在 Windows 上安装 GDAL 的好方法：

**步骤 1：安装 Miniconda 或 Anaconda**

从 [Conda 官网](https://docs.conda.io/en/latest/miniconda.html) 下载安装。

**步骤 2：创建环境并安装 GDAL**

```batch
:: 创建新环境
conda create -n gdal_env python=3.10

:: 激活环境
conda activate gdal_env

:: 从 conda-forge 安装 GDAL
conda install -c conda-forge gdal

:: 或指定版本
conda install -c conda-forge gdal=3.7.0
```

**步骤 3：验证安装**

```batch
:: 激活环境
conda activate gdal_env

:: Python 中验证
python -c "from osgeo import gdal; print(gdal.__version__)"
```

### 2.2.3 使用预编译二进制包

GISInternals 提供预编译的 Windows GDAL 包：

**下载地址：** https://www.gisinternals.com/release.php

**选择合适的版本：**

| 选项 | 说明 |
|-----|------|
| release-1930-x64 | VS2022 64位编译 |
| release-1928-x64 | VS2019 64位编译 |
| MSVC 版本 | 选择与你的开发环境匹配的版本 |

**安装步骤：**

```batch
1. 下载 gdal-X.X.X-XXXX-x64-core.msi
2. 运行安装程序
3. 选择安装目录（如 C:\GDAL）
4. 配置环境变量
```

## 2.3 Linux 安装

### 2.3.1 Ubuntu/Debian 安装

**方法 1：使用 apt 安装（版本可能较旧）**

```bash
# 更新包列表
sudo apt update

# 安装 GDAL 库
sudo apt install gdal-bin libgdal-dev

# 安装 Python 绑定
sudo apt install python3-gdal

# 验证安装
gdalinfo --version
```

**方法 2：使用 UbuntuGIS PPA（推荐，版本较新）**

```bash
# 添加 UbuntuGIS PPA
sudo add-apt-repository ppa:ubuntugis/ppa
sudo apt update

# 安装 GDAL
sudo apt install gdal-bin libgdal-dev

# 安装 Python 绑定
sudo apt install python3-gdal

# 验证安装
gdalinfo --version
```

**方法 3：使用 UbuntuGIS Unstable PPA（最新版本）**

```bash
# 添加 unstable PPA（慎用于生产环境）
sudo add-apt-repository ppa:ubuntugis/ubuntugis-unstable
sudo apt update

# 安装 GDAL
sudo apt install gdal-bin libgdal-dev
```

### 2.3.2 CentOS/RHEL/Rocky Linux 安装

**方法 1：使用 EPEL 仓库**

```bash
# 安装 EPEL 仓库
sudo dnf install epel-release

# 安装 GDAL
sudo dnf install gdal gdal-devel

# 安装 Python 绑定
sudo dnf install python3-gdal
```

**方法 2：使用 Conda**

```bash
# 安装 Miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh

# 创建环境并安装 GDAL
conda create -n gdal_env python=3.10
conda activate gdal_env
conda install -c conda-forge gdal
```

### 2.3.3 从源码编译（高级）

当需要特定功能或最新版本时，可以从源码编译：

**步骤 1：安装依赖**

```bash
# Ubuntu/Debian
sudo apt install build-essential cmake \
    libproj-dev libgeos-dev \
    libtiff-dev libgeotiff-dev \
    libpng-dev libjpeg-dev \
    libcurl4-openssl-dev libxml2-dev \
    libsqlite3-dev libpq-dev \
    python3-dev swig

# CentOS/RHEL
sudo dnf groupinstall "Development Tools"
sudo dnf install cmake proj-devel geos-devel \
    libtiff-devel libgeotiff-devel \
    libpng-devel libjpeg-devel \
    libcurl-devel libxml2-devel \
    sqlite-devel postgresql-devel \
    python3-devel swig
```

**步骤 2：下载源码**

```bash
# 从 GitHub 克隆
git clone https://github.com/OSGeo/gdal.git
cd gdal

# 或下载发布版本
wget https://github.com/OSGeo/gdal/releases/download/v3.7.0/gdal-3.7.0.tar.gz
tar -xzf gdal-3.7.0.tar.gz
cd gdal-3.7.0
```

**步骤 3：配置和编译**

```bash
# 创建构建目录
mkdir build
cd build

# 配置（使用 CMake）
cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DBUILD_PYTHON_BINDINGS=ON \
    -DGDAL_USE_GEOS=ON \
    -DGDAL_USE_PROJ=ON

# 编译（使用多线程加速）
make -j$(nproc)

# 安装
sudo make install

# 更新库缓存
sudo ldconfig
```

**步骤 4：验证安装**

```bash
# 检查版本
gdalinfo --version

# 检查库路径
ldconfig -p | grep gdal
```

## 2.4 macOS 安装

### 2.4.1 使用 Homebrew 安装（推荐）

```bash
# 安装 Homebrew（如果未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 GDAL
brew install gdal

# 验证安装
gdalinfo --version
```

### 2.4.2 使用 Conda 安装

```bash
# 安装 Miniconda
curl -O https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh
# 或 Apple Silicon
curl -O https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh

bash Miniconda3-latest-MacOSX-*.sh

# 创建环境并安装 GDAL
conda create -n gdal_env python=3.10
conda activate gdal_env
conda install -c conda-forge gdal
```

### 2.4.3 使用 KyngChaos 包（较旧方法）

访问 https://www.kyngchaos.com/software/frameworks/ 下载框架包。

## 2.5 Docker 安装

Docker 是部署 GDAL 的理想方式，提供了完全隔离和可复制的环境。

### 2.5.1 使用官方镜像

```bash
# 拉取官方 GDAL 镜像
docker pull ghcr.io/osgeo/gdal:ubuntu-full-latest

# 或指定版本
docker pull ghcr.io/osgeo/gdal:ubuntu-full-3.7.0

# 运行容器
docker run -it --rm ghcr.io/osgeo/gdal:ubuntu-full-latest gdalinfo --version
```

### 2.5.2 镜像类型选择

| 镜像标签 | 大小 | 描述 |
|---------|------|------|
| alpine-small | ~50MB | 最小镜像，基础功能 |
| alpine-normal | ~150MB | 常用格式支持 |
| ubuntu-small | ~200MB | Ubuntu 基础 |
| ubuntu-full | ~1GB | 完整功能，所有驱动 |

### 2.5.3 挂载数据目录

```bash
# 挂载本地目录到容器
docker run -it --rm \
    -v /path/to/data:/data \
    ghcr.io/osgeo/gdal:ubuntu-full-latest \
    gdalinfo /data/myfile.tif
```

### 2.5.4 自定义 Dockerfile

```dockerfile
# Dockerfile
FROM ghcr.io/osgeo/gdal:ubuntu-full-3.7.0

# 安装额外的 Python 包
RUN pip install numpy pandas rasterio

# 设置工作目录
WORKDIR /app

# 复制应用代码
COPY . /app

# 运行命令
CMD ["python", "process.py"]
```

构建和运行：

```bash
docker build -t my-gdal-app .
docker run -v /data:/data my-gdal-app
```

## 2.6 Python 环境配置

### 2.6.1 使用 pip 安装

**注意**：pip 安装需要系统已安装 GDAL 库。

```bash
# 查看系统 GDAL 版本
gdal-config --version
# 输出: 3.7.0

# 安装匹配版本的 Python 绑定
pip install GDAL==3.7.0
```

**常见问题解决：**

```bash
# 如果遇到编译错误，设置 GDAL 配置路径
export CPLUS_INCLUDE_PATH=/usr/include/gdal
export C_INCLUDE_PATH=/usr/include/gdal

# 或使用 gdal-config
pip install GDAL==$(gdal-config --version) \
    --global-option=build_ext \
    --global-option="-I$(gdal-config --cflags | sed 's/-I//')"
```

### 2.6.2 使用 Conda 安装（推荐）

```bash
# 创建新环境
conda create -n gis_env python=3.10

# 激活环境
conda activate gis_env

# 安装 GDAL 和常用 GIS 库
conda install -c conda-forge gdal rasterio fiona geopandas

# 验证
python -c "from osgeo import gdal; print(gdal.__version__)"
```

### 2.6.3 虚拟环境最佳实践

```bash
# 创建项目目录
mkdir my_gis_project
cd my_gis_project

# 创建 Conda 环境文件 environment.yml
cat > environment.yml << EOF
name: my_gis_env
channels:
  - conda-forge
dependencies:
  - python=3.10
  - gdal=3.7
  - rasterio
  - fiona
  - geopandas
  - shapely
  - pyproj
  - numpy
  - pandas
  - jupyter
EOF

# 创建环境
conda env create -f environment.yml

# 激活环境
conda activate my_gis_env
```

### 2.6.4 常用 Python GIS 库

| 库名 | 功能 | 与 GDAL 关系 |
|-----|------|-------------|
| rasterio | 栅格数据处理 | 基于 GDAL |
| fiona | 矢量数据处理 | 基于 OGR |
| geopandas | 空间数据分析 | 基于 fiona |
| shapely | 几何操作 | 基于 GEOS |
| pyproj | 坐标转换 | 基于 PROJ |

## 2.7 Java 环境配置

### 2.7.1 使用 Maven 依赖

在 `pom.xml` 中添加 GDAL Java 绑定：

```xml
<dependencies>
    <!-- GDAL Java 绑定 -->
    <dependency>
        <groupId>org.gdal</groupId>
        <artifactId>gdal</artifactId>
        <version>3.7.0</version>
    </dependency>
</dependencies>
```

**注意**：Java 绑定需要本地 GDAL 库支持。

### 2.7.2 本地库配置

**Windows：**

```batch
:: 设置 JAVA_OPTS 包含 GDAL 库路径
set JAVA_OPTS=-Djava.library.path=C:\OSGeo4W\bin

:: 或在代码中加载
System.loadLibrary("gdaljni");
```

**Linux：**

```bash
# 设置库路径
export LD_LIBRARY_PATH=/usr/lib/jni:$LD_LIBRARY_PATH

# 或在运行时指定
java -Djava.library.path=/usr/lib/jni -jar myapp.jar
```

### 2.7.3 完整 Maven 项目配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>gdal-demo</artifactId>
    <version>1.0-SNAPSHOT</version>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <gdal.version>3.7.0</gdal.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.gdal</groupId>
            <artifactId>gdal</artifactId>
            <version>${gdal.version}</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
            </plugin>
        </plugins>
    </build>
</project>
```

### 2.7.4 验证 Java 安装

```java
import org.gdal.gdal.gdal;
import org.gdal.gdal.Driver;

public class GdalTest {
    public static void main(String[] args) {
        // 注册所有驱动
        gdal.AllRegister();
        
        // 打印版本
        System.out.println("GDAL Version: " + gdal.VersionInfo("VERSION_NUM"));
        
        // 列出所有驱动
        int driverCount = gdal.GetDriverCount();
        System.out.println("Driver Count: " + driverCount);
        
        for (int i = 0; i < driverCount; i++) {
            Driver driver = gdal.GetDriver(i);
            System.out.println("  " + driver.getShortName() + " - " + driver.getLongName());
        }
    }
}
```

## 2.8 C#/.NET 环境配置

### 2.8.1 使用 NuGet 包

推荐使用 MaxRev.Gdal.Universal 包，它提供了跨平台支持：

```bash
# 使用 dotnet CLI
dotnet add package MaxRev.Gdal.Universal

# 或在 .csproj 中添加
```

```xml
<Project Sdk="Microsoft.NET.Sdk">
    <PropertyGroup>
        <OutputType>Exe</OutputType>
        <TargetFramework>net6.0</TargetFramework>
    </PropertyGroup>

    <ItemGroup>
        <PackageReference Include="MaxRev.Gdal.Universal" Version="3.7.0.100" />
    </ItemGroup>
</Project>
```

### 2.8.2 初始化 GDAL

```csharp
using MaxRev.Gdal.Core;
using OSGeo.GDAL;
using OSGeo.OGR;
using OSGeo.OSR;

class Program
{
    static void Main(string[] args)
    {
        // 初始化 GDAL（必须首先调用）
        GdalBase.ConfigureAll();
        
        // 打印版本
        Console.WriteLine($"GDAL Version: {Gdal.VersionInfo("VERSION_NUM")}");
        
        // 列出驱动
        int driverCount = Gdal.GetDriverCount();
        Console.WriteLine($"Driver Count: {driverCount}");
        
        for (int i = 0; i < driverCount; i++)
        {
            using var driver = Gdal.GetDriver(i);
            Console.WriteLine($"  {driver.ShortName} - {driver.LongName}");
        }
    }
}
```

### 2.8.3 其他 NuGet 包选项

| 包名 | 描述 | 平台支持 |
|-----|------|---------|
| MaxRev.Gdal.Universal | 自动配置，跨平台 | Windows, Linux, macOS |
| MaxRev.Gdal.WindowsRuntime.Minimal | Windows 最小运行时 | Windows |
| MaxRev.Gdal.LinuxRuntime.Minimal | Linux 最小运行时 | Linux |
| GDAL.Native | 官方原生包 | 平台特定 |

### 2.8.4 常见问题解决

**问题 1：DLL 找不到**

```csharp
// 确保正确初始化
GdalBase.ConfigureAll();

// 或手动设置路径
string gdalPath = @"C:\path\to\gdal";
Environment.SetEnvironmentVariable("PATH", 
    gdalPath + ";" + Environment.GetEnvironmentVariable("PATH"));
```

**问题 2：PROJ 数据缺失**

```csharp
// 设置 PROJ 数据目录
string projDataPath = @"C:\path\to\proj\data";
Gdal.SetConfigOption("PROJ_LIB", projDataPath);
```

## 2.9 环境变量配置

### 2.9.1 常用环境变量

| 变量名 | 描述 | 示例值 |
|-------|------|--------|
| GDAL_DATA | GDAL 数据文件目录 | /usr/share/gdal |
| PROJ_LIB | PROJ 数据文件目录 | /usr/share/proj |
| GDAL_DRIVER_PATH | 额外驱动目录 | /usr/lib/gdalplugins |
| CPL_DEBUG | 调试输出 | ON |
| GDAL_CACHEMAX | 缓存大小（MB） | 512 |
| GDAL_NUM_THREADS | 并行线程数 | ALL_CPUS |
| CPL_VSIL_CURL_ALLOWED_EXTENSIONS | 允许的网络文件扩展名 | .tif,.vrt |

### 2.9.2 Windows 环境变量设置

```batch
:: 永久设置（需要管理员权限）
setx GDAL_DATA "C:\OSGeo4W\share\gdal" /M
setx PROJ_LIB "C:\OSGeo4W\share\proj" /M

:: 临时设置
set GDAL_DATA=C:\OSGeo4W\share\gdal
set PROJ_LIB=C:\OSGeo4W\share\proj
```

### 2.9.3 Linux/macOS 环境变量设置

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
export GDAL_DATA=/usr/share/gdal
export PROJ_LIB=/usr/share/proj

# 性能优化设置
export GDAL_CACHEMAX=512
export GDAL_NUM_THREADS=ALL_CPUS

# 调试设置
export CPL_DEBUG=ON

# 使设置生效
source ~/.bashrc
```

### 2.9.4 在代码中设置配置

**Python：**

```python
from osgeo import gdal

# 设置配置选项
gdal.SetConfigOption('GDAL_CACHEMAX', '512')
gdal.SetConfigOption('GDAL_NUM_THREADS', 'ALL_CPUS')
gdal.SetConfigOption('CPL_DEBUG', 'ON')

# 获取配置选项
cache_max = gdal.GetConfigOption('GDAL_CACHEMAX')
print(f"Cache Max: {cache_max}")
```

**Java：**

```java
import org.gdal.gdal.gdal;

// 设置配置选项
gdal.SetConfigOption("GDAL_CACHEMAX", "512");
gdal.SetConfigOption("GDAL_NUM_THREADS", "ALL_CPUS");

// 获取配置选项
String cacheMax = gdal.GetConfigOption("GDAL_CACHEMAX", "64");
System.out.println("Cache Max: " + cacheMax);
```

**C#：**

```csharp
using OSGeo.GDAL;

// 设置配置选项
Gdal.SetConfigOption("GDAL_CACHEMAX", "512");
Gdal.SetConfigOption("GDAL_NUM_THREADS", "ALL_CPUS");

// 获取配置选项
string cacheMax = Gdal.GetConfigOption("GDAL_CACHEMAX", "64");
Console.WriteLine($"Cache Max: {cacheMax}");
```

## 2.10 验证安装

### 2.10.1 命令行验证

```bash
# 检查 GDAL 版本
gdalinfo --version

# 检查支持的栅格格式
gdalinfo --formats

# 检查支持的矢量格式
ogrinfo --formats

# 检查 PROJ 版本
projinfo --version

# 检查特定格式支持
gdalinfo --format GTiff
ogrinfo --format "ESRI Shapefile"
```

### 2.10.2 Python 验证脚本

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""GDAL 安装验证脚本"""

def check_gdal_installation():
    """检查 GDAL Python 绑定安装"""
    try:
        from osgeo import gdal, ogr, osr
        
        print("=" * 50)
        print("GDAL Python 绑定安装验证")
        print("=" * 50)
        
        # 版本信息
        print(f"\nGDAL 版本: {gdal.VersionInfo('VERSION_NUM')}")
        print(f"发布日期: {gdal.VersionInfo('RELEASE_DATE')}")
        
        # 栅格驱动
        gdal.AllRegister()
        raster_count = gdal.GetDriverCount()
        print(f"\n栅格驱动数量: {raster_count}")
        
        # 列出部分常用栅格驱动
        print("\n常用栅格驱动:")
        important_raster_formats = ['GTiff', 'PNG', 'JPEG', 'HFA', 'VRT', 'COG']
        for fmt in important_raster_formats:
            driver = gdal.GetDriverByName(fmt)
            if driver:
                print(f"  ✓ {fmt}: {driver.LongName}")
            else:
                print(f"  ✗ {fmt}: 不可用")
        
        # 矢量驱动
        vector_count = ogr.GetDriverCount()
        print(f"\n矢量驱动数量: {vector_count}")
        
        # 列出部分常用矢量驱动
        print("\n常用矢量驱动:")
        important_vector_formats = ['ESRI Shapefile', 'GeoJSON', 'PostgreSQL', 
                                     'GPKG', 'KML', 'FileGDB']
        for fmt in important_vector_formats:
            driver = ogr.GetDriverByName(fmt)
            if driver:
                print(f"  ✓ {fmt}")
            else:
                print(f"  ✗ {fmt}: 不可用")
        
        # 空间参考测试
        print("\n空间参考系统测试:")
        srs = osr.SpatialReference()
        srs.ImportFromEPSG(4326)
        print(f"  WGS84 (EPSG:4326): {srs.GetName()}")
        
        srs.ImportFromEPSG(4490)
        print(f"  CGCS2000 (EPSG:4490): {srs.GetName()}")
        
        print("\n" + "=" * 50)
        print("✓ GDAL 安装验证通过！")
        print("=" * 50)
        
        return True
        
    except ImportError as e:
        print(f"✗ 导入错误: {e}")
        return False
    except Exception as e:
        print(f"✗ 验证失败: {e}")
        return False


if __name__ == "__main__":
    check_gdal_installation()
```

### 2.10.3 Java 验证代码

```java
import org.gdal.gdal.gdal;
import org.gdal.gdal.Driver;
import org.gdal.ogr.ogr;
import org.gdal.osr.SpatialReference;

public class GdalVerify {
    public static void main(String[] args) {
        System.out.println("==================================================");
        System.out.println("GDAL Java 绑定安装验证");
        System.out.println("==================================================");
        
        // 注册所有驱动
        gdal.AllRegister();
        ogr.RegisterAll();
        
        // 版本信息
        System.out.println("\nGDAL 版本: " + gdal.VersionInfo("VERSION_NUM"));
        System.out.println("发布日期: " + gdal.VersionInfo("RELEASE_DATE"));
        
        // 栅格驱动
        int rasterCount = gdal.GetDriverCount();
        System.out.println("\n栅格驱动数量: " + rasterCount);
        
        // 矢量驱动
        int vectorCount = ogr.GetDriverCount();
        System.out.println("矢量驱动数量: " + vectorCount);
        
        // 空间参考测试
        System.out.println("\n空间参考系统测试:");
        SpatialReference srs = new SpatialReference();
        srs.ImportFromEPSG(4326);
        System.out.println("  WGS84 (EPSG:4326): " + srs.GetName());
        
        System.out.println("\n==================================================");
        System.out.println("✓ GDAL Java 绑定安装验证通过！");
        System.out.println("==================================================");
    }
}
```

### 2.10.4 C# 验证代码

```csharp
using System;
using MaxRev.Gdal.Core;
using OSGeo.GDAL;
using OSGeo.OGR;
using OSGeo.OSR;

class GdalVerify
{
    static void Main(string[] args)
    {
        Console.WriteLine("==================================================");
        Console.WriteLine("GDAL C# 绑定安装验证");
        Console.WriteLine("==================================================");
        
        // 初始化 GDAL
        GdalBase.ConfigureAll();
        
        // 版本信息
        Console.WriteLine($"\nGDAL 版本: {Gdal.VersionInfo("VERSION_NUM")}");
        Console.WriteLine($"发布日期: {Gdal.VersionInfo("RELEASE_DATE")}");
        
        // 栅格驱动
        int rasterCount = Gdal.GetDriverCount();
        Console.WriteLine($"\n栅格驱动数量: {rasterCount}");
        
        // 矢量驱动
        int vectorCount = Ogr.GetDriverCount();
        Console.WriteLine($"矢量驱动数量: {vectorCount}");
        
        // 空间参考测试
        Console.WriteLine("\n空间参考系统测试:");
        var srs = new SpatialReference("");
        srs.ImportFromEPSG(4326);
        Console.WriteLine($"  WGS84 (EPSG:4326): {srs.GetName()}");
        
        Console.WriteLine("\n==================================================");
        Console.WriteLine("✓ GDAL C# 绑定安装验证通过！");
        Console.WriteLine("==================================================");
    }
}
```

## 2.11 常见问题与解决方案

### 2.11.1 安装问题

| 问题 | 原因 | 解决方案 |
|-----|------|---------|
| pip 安装失败 | GDAL 版本不匹配 | 使用 `pip install GDAL==$(gdal-config --version)` |
| 找不到 gdal-config | GDAL 未安装或不在 PATH | 安装 GDAL 开发包或添加到 PATH |
| 编译错误 | 缺少头文件 | 安装 libgdal-dev |
| ImportError | Python 版本不匹配 | 确保 Python 版本与 GDAL 绑定兼容 |

### 2.11.2 运行时问题

| 问题 | 原因 | 解决方案 |
|-----|------|---------|
| PROJ 数据缺失 | PROJ_LIB 未设置 | 设置 PROJ_LIB 环境变量 |
| 驱动不可用 | 驱动未编译 | 使用完整版 GDAL 或重新编译 |
| 内存不足 | 处理大文件 | 增加 GDAL_CACHEMAX |
| 性能慢 | 单线程处理 | 设置 GDAL_NUM_THREADS |

### 2.11.3 调试技巧

```python
from osgeo import gdal

# 启用调试输出
gdal.SetConfigOption('CPL_DEBUG', 'ON')
gdal.SetConfigOption('CPL_LOG', 'gdal_debug.log')
gdal.SetConfigOption('CPL_LOG_ERRORS', 'ON')

# 查看详细错误信息
gdal.UseExceptions()

try:
    ds = gdal.Open('nonexistent.tif')
except Exception as e:
    print(f"错误: {e}")
```

## 2.12 本章小结

本章详细介绍了 GDAL 在各种平台上的安装方法：

1. **Windows**：OSGeo4W（推荐）、Conda、预编译包
2. **Linux**：包管理器、UbuntuGIS PPA、源码编译
3. **macOS**：Homebrew、Conda
4. **Docker**：官方镜像、自定义镜像
5. **Python**：Conda（推荐）、pip
6. **Java**：Maven 依赖 + 本地库
7. **C#/.NET**：NuGet 包（MaxRev.Gdal.Universal）

关键配置要点：
- 正确设置环境变量（GDAL_DATA、PROJ_LIB）
- 版本匹配（Python 绑定与系统 GDAL）
- 验证安装完整性

在下一章中，我们将深入探讨 GDAL 的核心架构与数据模型。

## 2.13 思考与练习

1. 在你的操作系统上安装 GDAL，并验证安装是否成功。
2. 比较不同安装方式的优缺点，选择最适合你的安装方式。
3. 配置 GDAL 环境变量，并测试配置是否生效。
4. 编写一个验证脚本，检查 GDAL 的所有主要功能是否可用。
5. 尝试使用 Docker 运行 GDAL 命令，体会容器化部署的优势。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第01章-GDAL概述与基础知识" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第03章-GDAL核心架构与数据模型" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
