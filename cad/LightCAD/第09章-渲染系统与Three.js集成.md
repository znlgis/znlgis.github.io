---
layout: default
title: 渲染系统与Three.js集成
---

# 第九章：渲染系统与Three.js集成

## 9.1 渲染系统概述

### 9.1.1 双引擎渲染架构

LightCAD采用独特的双渲染引擎策略，同时集成了Three.js4Net和OpenTK两个渲染后端：

```
┌──────────────────────────────────────────┐
│              渲染抽象层                    │
│         LightCAD.RenderUtils              │
├────────────────┬─────────────────────────┤
│  Three.js4Net  │        OpenTK           │
│  （WebGL渲染） │    （OpenGL渲染）        │
└────────────────┴─────────────────────────┘
```

**Three.js4Net**：是Three.js JavaScript 3D库的.NET封装版本，提供了高层的场景图管理、材质系统和渲染管线。作为LightCAD的主要3D渲染引擎。

**OpenTK**：是.NET平台的OpenGL绑定库，提供了直接的GPU访问能力，用于需要低级图形控制的场景。

### 9.1.2 渲染模块结构

```
LightCAD.RenderUtils/
├── 3dcontrols/              # 3D交互控件
│   ├── TransformGizmo.cs    # 变换手柄
│   ├── RotationGizmo.cs     # 旋转手柄
│   └── ScaleGizmo.cs        # 缩放手柄
├── AssetManagers/           # 资源管理器
│   ├── RenderMaterialManager.cs  # 材质管理
│   ├── TextureManager.cs         # 纹理管理
│   └── ShaderManager.cs          # 着色器管理
├── ThreeUtils/              # Three.js工具集
│   ├── SceneManager.cs      # 场景管理
│   ├── CameraManager.cs     # 相机管理
│   ├── LightManager.cs      # 光照管理
│   └── GeometryBuilder.cs   # 几何体构建器
└── Events/                  # 渲染事件
    ├── RenderEvent.cs       # 渲染事件
    └── PickEvent.cs         # 拾取事件
```

## 9.2 Three.js4Net集成

### 9.2.1 Three.js4Net概述

Three.js4Net是将著名的Three.js JavaScript库移植到.NET平台的实现。它保持了Three.js的API风格和设计理念，但完全运行在.NET运行时中：

```csharp
// Three.js4Net的核心概念与Three.js完全一致
// 场景 (Scene) → 相机 (Camera) → 渲染器 (Renderer)

// 创建场景
var scene = new Scene();

// 创建相机
var camera = new PerspectiveCamera(
    fov: 75,
    aspect: 16.0 / 9.0,
    near: 0.1,
    far: 1000
);
camera.Position.Set(0, 50, 100);

// 添加光源
var ambientLight = new AmbientLight(0x404040);
scene.Add(ambientLight);

var directionalLight = new DirectionalLight(0xffffff, 0.8);
directionalLight.Position.Set(100, 100, 100);
scene.Add(directionalLight);
```

### 9.2.2 场景管理

```csharp
public class SceneManager
{
    private Scene scene;
    private Dictionary<long, Object3D> entityObjects = new();

    public SceneManager()
    {
        scene = new Scene();
        scene.Background = new Color(0xf0f0f0);
        SetupDefaultLighting();
    }

    /// <summary>
    /// 添加实体到场景
    /// </summary>
    public void AddEntity(LcEntity entity)
    {
        var object3d = ConvertToThreeObject(entity);
        if (object3d != null)
        {
            scene.Add(object3d);
            entityObjects[entity.Handle] = object3d;
        }
    }

    /// <summary>
    /// 从场景移除实体
    /// </summary>
    public void RemoveEntity(LcEntity entity)
    {
        if (entityObjects.TryGetValue(entity.Handle, out var obj))
        {
            scene.Remove(obj);
            entityObjects.Remove(entity.Handle);
        }
    }

    /// <summary>
    /// 更新实体的显示
    /// </summary>
    public void UpdateEntity(LcEntity entity)
    {
        RemoveEntity(entity);
        AddEntity(entity);
    }

    /// <summary>
    /// 将LightCAD实体转换为Three.js对象
    /// </summary>
    private Object3D ConvertToThreeObject(LcEntity entity)
    {
        return entity switch
        {
            LcLine line => CreateLineMesh(line),
            LcCircle circle => CreateCircleMesh(circle),
            LcArc arc => CreateArcMesh(arc),
            LcPolyline polyline => CreatePolylineMesh(polyline),
            LcSolid3d solid => CreateSolidMesh(solid),
            LcText text => CreateTextMesh(text),
            _ => null
        };
    }

    /// <summary>
    /// 设置默认光照
    /// </summary>
    private void SetupDefaultLighting()
    {
        var ambient = new AmbientLight(0x404040);
        scene.Add(ambient);

        var directional = new DirectionalLight(0xffffff, 0.8);
        directional.Position.Set(1, 1, 1);
        scene.Add(directional);

        var fill = new DirectionalLight(0xffffff, 0.3);
        fill.Position.Set(-1, 0.5, -1);
        scene.Add(fill);
    }
}
```

### 9.2.3 几何体构建器

```csharp
public class GeometryBuilder
{
    /// <summary>
    /// 从LcLine创建线段几何体
    /// </summary>
    public static Object3D CreateLineMesh(LcLine line)
    {
        var geometry = new BufferGeometry();
        var positions = new float[]
        {
            (float)line.StartPoint.X, (float)line.StartPoint.Y, 0,
            (float)line.EndPoint.X, (float)line.EndPoint.Y, 0
        };

        geometry.SetAttribute("position",
            new BufferAttribute(positions, 3));

        var material = new LineBasicMaterial
        {
            Color = ConvertColor(line.Color),
            LineWidth = (float)line.LineWeight
        };

        return new Line(geometry, material);
    }

    /// <summary>
    /// 从LcCircle创建圆的几何体
    /// </summary>
    public static Object3D CreateCircleMesh(LcCircle circle)
    {
        var segments = 64;
        var geometry = new BufferGeometry();
        var positions = new float[(segments + 1) * 3];

        for (int i = 0; i <= segments; i++)
        {
            var angle = 2 * Math.PI * i / segments;
            positions[i * 3] = (float)(circle.Center.X +
                circle.Radius * Math.Cos(angle));
            positions[i * 3 + 1] = (float)(circle.Center.Y +
                circle.Radius * Math.Sin(angle));
            positions[i * 3 + 2] = 0;
        }

        geometry.SetAttribute("position",
            new BufferAttribute(positions, 3));

        var material = new LineBasicMaterial
        {
            Color = ConvertColor(circle.Color)
        };

        return new Line(geometry, material);
    }

    /// <summary>
    /// 从LcSolid3d创建实体网格
    /// </summary>
    public static Object3D CreateSolidMesh(LcSolid3d solid)
    {
        var meshData = solid.GenerateMesh();
        var geometry = new BufferGeometry();

        // 设置顶点位置
        var positions = new float[meshData.Vertices.Count * 3];
        for (int i = 0; i < meshData.Vertices.Count; i++)
        {
            positions[i * 3] = (float)meshData.Vertices[i].X;
            positions[i * 3 + 1] = (float)meshData.Vertices[i].Y;
            positions[i * 3 + 2] = (float)meshData.Vertices[i].Z;
        }
        geometry.SetAttribute("position",
            new BufferAttribute(positions, 3));

        // 设置法向量
        if (meshData.Normals.Count > 0)
        {
            var normals = new float[meshData.Normals.Count * 3];
            for (int i = 0; i < meshData.Normals.Count; i++)
            {
                normals[i * 3] = (float)meshData.Normals[i].X;
                normals[i * 3 + 1] = (float)meshData.Normals[i].Y;
                normals[i * 3 + 2] = (float)meshData.Normals[i].Z;
            }
            geometry.SetAttribute("normal",
                new BufferAttribute(normals, 3));
        }

        // 设置面索引
        geometry.SetIndex(new BufferAttribute(
            meshData.Indices.ToArray(), 1));

        var material = new MeshPhongMaterial
        {
            Color = ConvertColor(solid.Material?.Color ?? LcColor.White),
            Shininess = 30,
            Side = Side.Double
        };

        return new Mesh(geometry, material);
    }

    private static Color ConvertColor(LcColor color)
    {
        return new Color(
            color.R / 255.0f,
            color.G / 255.0f,
            color.B / 255.0f
        );
    }
}
```

## 9.3 相机系统

### 9.3.1 相机类型

```csharp
public class CameraManager
{
    private Camera currentCamera;

    /// <summary>
    /// 创建透视相机（3D视图）
    /// </summary>
    public PerspectiveCamera CreatePerspectiveCamera(
        double fov = 60,
        double aspect = 16.0 / 9.0,
        double near = 0.1,
        double far = 10000)
    {
        var camera = new PerspectiveCamera(fov, aspect, near, far);
        camera.Position.Set(0, 100, 200);
        camera.LookAt(new Vector3(0, 0, 0));
        return camera;
    }

    /// <summary>
    /// 创建正交相机（2D视图/工程视图）
    /// </summary>
    public OrthographicCamera CreateOrthographicCamera(
        double width, double height,
        double near = -10000, double far = 10000)
    {
        var halfWidth = width / 2;
        var halfHeight = height / 2;
        var camera = new OrthographicCamera(
            -halfWidth, halfWidth,
            halfHeight, -halfHeight,
            near, far
        );
        camera.Position.Set(0, 0, 1000);
        camera.LookAt(new Vector3(0, 0, 0));
        return camera;
    }

    /// <summary>
    /// 设置标准视图
    /// </summary>
    public void SetStandardView(StandardView view)
    {
        switch (view)
        {
            case StandardView.Top:
                currentCamera.Position.Set(0, 0, 1000);
                currentCamera.Up.Set(0, 1, 0);
                break;
            case StandardView.Front:
                currentCamera.Position.Set(0, -1000, 0);
                currentCamera.Up.Set(0, 0, 1);
                break;
            case StandardView.Right:
                currentCamera.Position.Set(1000, 0, 0);
                currentCamera.Up.Set(0, 0, 1);
                break;
            case StandardView.Isometric:
                currentCamera.Position.Set(500, -500, 500);
                currentCamera.Up.Set(0, 0, 1);
                break;
        }
        currentCamera.LookAt(new Vector3(0, 0, 0));
    }
}

public enum StandardView
{
    Top,         // 俯视
    Bottom,      // 仰视
    Front,       // 前视
    Back,        // 后视
    Left,        // 左视
    Right,       // 右视
    Isometric    // 等轴测
}
```

### 9.3.2 相机控制

```csharp
public class CameraController
{
    private Camera camera;
    private Vector3 target = new Vector3(0, 0, 0);

    /// <summary>
    /// 轨道旋转（鼠标中键拖动）
    /// </summary>
    public void Orbit(double deltaX, double deltaY)
    {
        var offset = camera.Position.Clone().Sub(target);
        var spherical = new Spherical();
        spherical.SetFromVector3(offset);

        spherical.Theta -= deltaX * 0.005;
        spherical.Phi -= deltaY * 0.005;
        spherical.Phi = Math.Max(0.01, Math.Min(Math.PI - 0.01, spherical.Phi));

        offset.SetFromSpherical(spherical);
        camera.Position.Copy(target).Add(offset);
        camera.LookAt(target);
    }

    /// <summary>
    /// 平移（Shift+中键拖动）
    /// </summary>
    public void Pan(double deltaX, double deltaY)
    {
        var panSpeed = GetPanSpeed();
        var right = new Vector3();
        var up = new Vector3();

        right.SetFromMatrixColumn(camera.MatrixWorld, 0);
        up.SetFromMatrixColumn(camera.MatrixWorld, 1);

        var panOffset = right.MultiplyScalar(-deltaX * panSpeed)
            .Add(up.MultiplyScalar(deltaY * panSpeed));

        target.Add(panOffset);
        camera.Position.Add(panOffset);
    }

    /// <summary>
    /// 缩放（鼠标滚轮）
    /// </summary>
    public void Zoom(double delta)
    {
        if (camera is PerspectiveCamera perspCamera)
        {
            var offset = camera.Position.Clone().Sub(target);
            var distance = offset.Length();
            var newDistance = distance * (1 - delta * 0.1);
            newDistance = Math.Max(1, Math.Min(100000, newDistance));

            offset.Normalize().MultiplyScalar(newDistance);
            camera.Position.Copy(target).Add(offset);
        }
        else if (camera is OrthographicCamera orthoCamera)
        {
            var zoomFactor = 1 - delta * 0.1;
            orthoCamera.Zoom *= zoomFactor;
            orthoCamera.UpdateProjectionMatrix();
        }
    }

    /// <summary>
    /// 缩放到适合所有对象
    /// </summary>
    public void ZoomToFit(BoundingBox3d bounds)
    {
        var center = bounds.Center;
        var size = bounds.Size;
        var maxDim = Math.Max(size.X, Math.Max(size.Y, size.Z));

        target = new Vector3(center.X, center.Y, center.Z);

        if (camera is PerspectiveCamera perspCamera)
        {
            var fov = perspCamera.Fov * Math.PI / 180;
            var distance = maxDim / (2 * Math.Tan(fov / 2)) * 1.5;
            camera.Position.Copy(target).Add(
                new Vector3(distance, -distance, distance));
        }

        camera.LookAt(target);
    }
}
```

## 9.4 材质系统

### 9.4.1 材质管理器

```csharp
public class RenderMaterialManager
{
    private Dictionary<string, Material> materialCache = new();

    /// <summary>
    /// 获取或创建线框材质
    /// </summary>
    public LineBasicMaterial GetLineMaterial(LcColor color, double lineWidth = 1)
    {
        var key = $"line_{color.R}_{color.G}_{color.B}_{lineWidth}";
        if (!materialCache.TryGetValue(key, out var material))
        {
            material = new LineBasicMaterial
            {
                Color = new Color(color.R / 255.0f, color.G / 255.0f,
                    color.B / 255.0f),
                LineWidth = (float)lineWidth
            };
            materialCache[key] = material;
        }
        return (LineBasicMaterial)material;
    }

    /// <summary>
    /// 获取或创建Phong材质（3D实体用）
    /// </summary>
    public MeshPhongMaterial GetPhongMaterial(MaterialInfo info)
    {
        var key = $"phong_{info.GetHashCode()}";
        if (!materialCache.TryGetValue(key, out var material))
        {
            material = new MeshPhongMaterial
            {
                Color = ConvertColor(info.DiffuseColor),
                Specular = ConvertColor(info.SpecularColor),
                Shininess = (float)info.Shininess,
                Opacity = (float)info.Opacity,
                Transparent = info.Opacity < 1.0,
                Side = Side.Double
            };
            materialCache[key] = material;
        }
        return (MeshPhongMaterial)material;
    }

    /// <summary>
    /// 创建选中状态材质
    /// </summary>
    public Material GetSelectionMaterial()
    {
        return new MeshBasicMaterial
        {
            Color = new Color(0.0f, 0.5f, 1.0f),
            Opacity = 0.3f,
            Transparent = true,
            Side = Side.Double
        };
    }

    /// <summary>
    /// 创建高亮状态材质
    /// </summary>
    public Material GetHighlightMaterial()
    {
        return new MeshBasicMaterial
        {
            Color = new Color(1.0f, 1.0f, 0.0f),
            Opacity = 0.2f,
            Transparent = true,
            Side = Side.Double
        };
    }
}

public class MaterialInfo
{
    public LcColor DiffuseColor { get; set; } = LcColor.White;
    public LcColor SpecularColor { get; set; } = new LcColor(50, 50, 50);
    public double Shininess { get; set; } = 30;
    public double Opacity { get; set; } = 1.0;
    public string TexturePath { get; set; }
    public string Name { get; set; }
}
```

## 9.5 光照系统

### 9.5.1 光源管理

```csharp
public class LightManager
{
    private List<Light> lights = new();

    /// <summary>
    /// 添加环境光
    /// </summary>
    public AmbientLight AddAmbientLight(
        LcColor color, double intensity = 0.4)
    {
        var light = new AmbientLight(
            new Color(color.R / 255.0f, color.G / 255.0f, color.B / 255.0f),
            (float)intensity);
        lights.Add(light);
        return light;
    }

    /// <summary>
    /// 添加方向光
    /// </summary>
    public DirectionalLight AddDirectionalLight(
        Vector3d direction, LcColor color, double intensity = 0.8)
    {
        var light = new DirectionalLight(
            new Color(color.R / 255.0f, color.G / 255.0f, color.B / 255.0f),
            (float)intensity);
        light.Position.Set(
            -(float)direction.X,
            -(float)direction.Y,
            -(float)direction.Z);
        lights.Add(light);
        return light;
    }

    /// <summary>
    /// 添加点光源
    /// </summary>
    public PointLight AddPointLight(
        Point3d position, LcColor color,
        double intensity = 1.0, double distance = 0)
    {
        var light = new PointLight(
            new Color(color.R / 255.0f, color.G / 255.0f, color.B / 255.0f),
            (float)intensity, (float)distance);
        light.Position.Set(
            (float)position.X,
            (float)position.Y,
            (float)position.Z);
        lights.Add(light);
        return light;
    }

    /// <summary>
    /// 设置CAD标准光照方案
    /// </summary>
    public void SetupCADLighting()
    {
        lights.Clear();

        // 环境光（避免完全黑暗）
        AddAmbientLight(new LcColor(64, 64, 64), 0.4);

        // 主光源（从右上方前方照射）
        AddDirectionalLight(
            new Vector3d(-1, -1, -1).Normalize(),
            LcColor.White, 0.6);

        // 填充光（从左方照射，较弱）
        AddDirectionalLight(
            new Vector3d(1, -0.5, 0.5).Normalize(),
            LcColor.White, 0.3);

        // 背光（从后方照射，很弱）
        AddDirectionalLight(
            new Vector3d(0, 1, -0.5).Normalize(),
            LcColor.White, 0.15);
    }
}
```

## 9.6 OpenTK渲染后端

### 9.6.1 OpenGL控制接口

```csharp
public interface IGLControl
{
    /// <summary>
    /// 初始化OpenGL上下文
    /// </summary>
    void Initialize();

    /// <summary>
    /// 渲染一帧
    /// </summary>
    void Render();

    /// <summary>
    /// 调整视口大小
    /// </summary>
    void Resize(int width, int height);

    /// <summary>
    /// 获取OpenGL版本信息
    /// </summary>
    string GetGLInfo();
}
```

### 9.6.2 OpenTK渲染器

```csharp
public class OpenTKRenderer : IGLControl
{
    public void Initialize()
    {
        // 设置OpenGL状态
        GL.Enable(EnableCap.DepthTest);
        GL.Enable(EnableCap.Blend);
        GL.BlendFunc(BlendingFactor.SrcAlpha,
            BlendingFactor.OneMinusSrcAlpha);
        GL.ClearColor(0.94f, 0.94f, 0.94f, 1.0f);

        // 启用抗锯齿
        GL.Enable(EnableCap.Multisample);
        GL.Enable(EnableCap.LineSmooth);
        GL.Hint(HintTarget.LineSmoothHint, HintMode.Nicest);
    }

    public void Render()
    {
        GL.Clear(ClearBufferMask.ColorBufferBit |
                 ClearBufferMask.DepthBufferBit);

        // 设置投影矩阵
        SetProjectionMatrix();

        // 设置视图矩阵
        SetViewMatrix();

        // 渲染场景中的所有对象
        RenderScene();

        // 渲染辅助元素（网格、坐标轴等）
        RenderHelpers();
    }

    public void Resize(int width, int height)
    {
        GL.Viewport(0, 0, width, height);
        UpdateProjectionMatrix(width, height);
    }
}
```

## 9.7 渲染管线

### 9.7.1 完整渲染流程

```
1. 数据准备阶段
   ├── 收集可见实体
   ├── 计算包围盒
   └── 视锥剔除

2. 几何处理阶段
   ├── 实体 → 网格数据（MeshData）
   ├── 曲线离散化
   └── 文本轮廓生成

3. 场景构建阶段
   ├── 创建Three.js几何体
   ├── 设置材质和纹理
   └── 构建场景图

4. 渲染执行阶段
   ├── 设置相机和光照
   ├── 深度排序
   ├── 渲染不透明物体
   ├── 渲染透明物体
   └── 渲染叠加层（标注、网格等）

5. 后处理阶段
   ├── 抗锯齿
   ├── 选择高亮
   └── 输出到屏幕
```

### 9.7.2 视锥剔除

```csharp
public class GpuVisibleFilter
{
    /// <summary>
    /// 视锥剔除，过滤不在视锥内的对象
    /// </summary>
    public List<LcEntity> FilterVisible(
        IEnumerable<LcEntity> entities, Camera camera)
    {
        var frustum = new Frustum();
        var projScreenMatrix = camera.ProjectionMatrix.Clone()
            .Multiply(camera.MatrixWorldInverse);
        frustum.SetFromProjectionMatrix(projScreenMatrix);

        return entities.Where(entity =>
        {
            var bounds = entity.Bounds;
            var box3 = new Box3(
                new Vector3(bounds.Min.X, bounds.Min.Y, -1000),
                new Vector3(bounds.Max.X, bounds.Max.Y, 1000)
            );
            return frustum.IntersectsBox(box3);
        }).ToList();
    }
}
```

## 9.8 3D交互控件

### 9.8.1 变换手柄（Gizmo）

```csharp
public class TransformGizmo
{
    private GizmoMode mode = GizmoMode.Translate;

    /// <summary>
    /// 创建平移手柄
    /// </summary>
    public Object3D CreateTranslateGizmo()
    {
        var group = new Group();

        // X轴（红色箭头）
        var xArrow = CreateArrow(Vector3d.XAxis,
            new LcColor(255, 0, 0));
        group.Add(xArrow);

        // Y轴（绿色箭头）
        var yArrow = CreateArrow(Vector3d.YAxis,
            new LcColor(0, 255, 0));
        group.Add(yArrow);

        // Z轴（蓝色箭头）
        var zArrow = CreateArrow(Vector3d.ZAxis,
            new LcColor(0, 0, 255));
        group.Add(zArrow);

        return group;
    }

    /// <summary>
    /// 创建旋转手柄
    /// </summary>
    public Object3D CreateRotateGizmo()
    {
        var group = new Group();

        // X轴旋转环（红色）
        group.Add(CreateRotationRing(Vector3d.XAxis,
            new LcColor(255, 0, 0)));
        // Y轴旋转环（绿色）
        group.Add(CreateRotationRing(Vector3d.YAxis,
            new LcColor(0, 255, 0)));
        // Z轴旋转环（蓝色）
        group.Add(CreateRotationRing(Vector3d.ZAxis,
            new LcColor(0, 0, 255)));

        return group;
    }
}

public enum GizmoMode
{
    Translate,  // 平移
    Rotate,     // 旋转
    Scale       // 缩放
}
```

## 9.9 渲染性能优化

### 9.9.1 LOD（细节层次）

```csharp
public class LODManager
{
    /// <summary>
    /// 根据距离选择合适的细节层次
    /// </summary>
    public int GetMeshQuality(double distanceToCamera,
                               double entitySize)
    {
        var relativeSize = entitySize / distanceToCamera;

        if (relativeSize > 0.5) return 3;    // 高精度
        if (relativeSize > 0.1) return 2;    // 中精度
        if (relativeSize > 0.01) return 1;   // 低精度
        return 0;                             // 最低精度
    }
}
```

### 9.9.2 实例化渲染

```csharp
/// <summary>
/// 对于大量相同几何体，使用实例化渲染
/// </summary>
public InstancedMesh CreateInstancedMesh(
    BufferGeometry geometry, Material material,
    List<Matrix4d> transforms)
{
    var instancedMesh = new InstancedMesh(
        geometry, material, transforms.Count);

    for (int i = 0; i < transforms.Count; i++)
    {
        var matrix = ConvertMatrix(transforms[i]);
        instancedMesh.SetMatrixAt(i, matrix);
    }

    instancedMesh.InstanceMatrix.NeedsUpdate = true;
    return instancedMesh;
}
```

## 9.10 本章小结

本章详细介绍了LightCAD的渲染系统和Three.js集成。LightCAD采用双渲染引擎策略，以Three.js4Net为主要3D渲染引擎，以OpenTK为补充。渲染系统涵盖了场景管理、相机控制、材质系统、光照系统和3D交互控件等方面。通过视锥剔除、LOD和实例化渲染等优化技术，确保了大规模CAD模型的渲染性能。

---

> **上一章**：[第八章：实体建模系统](https://znlgis.github.io/cad/LightCAD/第08章-实体建模系统/)
>
> **下一章**：[第十章：二维绘图与视口管理](https://znlgis.github.io/cad/LightCAD/第10章-二维绘图与视口管理/)
