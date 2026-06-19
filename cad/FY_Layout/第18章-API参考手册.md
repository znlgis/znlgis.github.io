---
layout: default
title: API参考手册
---

# 第十八章：API参考手册

## 18.1 概述

本章提供FY_Layout项目的完整API参考，包括所有核心类、接口、枚举和方法的详细说明。API按模块组织，方便开发者快速查阅。

## 18.2 核心接口

### 18.2.1 ILcPlugin 接口

插件入口接口，所有FY_Layout插件必须实现此接口。

```csharp
namespace LightCAD.Runtime
{
    /// <summary>
    /// LightCAD插件接口
    /// </summary>
    public interface ILcPlugin
    {
        /// <summary>
        /// 插件加载完成后调用，用于注册元素类型、Action等
        /// </summary>
        void Loaded();

        /// <summary>
        /// UI初始化时调用，用于注册工具栏、菜单等
        /// </summary>
        void InitUI();

        /// <summary>
        /// 所有插件初始化完成后调用
        /// </summary>
        void Completed();

        /// <summary>
        /// 文档运行时初始化时调用
        /// </summary>
        /// <param name="docRt">文档运行时实例</param>
        void OnInitializeDocRt(DocumentRuntime docRt);

        /// <summary>
        /// 文档运行时释放时调用
        /// </summary>
        /// <param name="docRt">文档运行时实例</param>
        void OnDisposeDocRt(DocumentRuntime docRt);
    }
}
```

**生命周期顺序**：`Loaded()` → `InitUI()` → `Completed()` → `OnInitializeDocRt()` ... `OnDisposeDocRt()`

### 18.2.2 IElement3dAction 接口

三维元素操作接口，用于将二维元素转换为三维模型。

```csharp
namespace LightCAD.Drawing.Actions
{
    /// <summary>
    /// 三维元素操作接口
    /// </summary>
    public interface IElement3dAction
    {
        /// <summary>
        /// 获取元素的三维对象
        /// </summary>
        /// <param name="element">二维元素</param>
        /// <param name="docRt">文档运行时</param>
        /// <returns>三维Object3D对象</returns>
        Object3D Get3dObject(LcElement element, DocumentRuntime docRt);
    }
}
```

### 18.2.3 IDllProviderImporter 接口

Provider导入接口，用于注册二维形状和三维实体的生成器。

```csharp
namespace LightCAD.Core
{
    /// <summary>
    /// DLL Provider导入器接口
    /// </summary>
    public interface IDllProviderImporter
    {
        /// <summary>
        /// 获取导入的Provider集合
        /// </summary>
        /// <returns>形状Provider集合和实体Provider集合</returns>
        (ShapeProviderCollection shapeProviders,
         SolidProviderCollection solidProviders) GetImportProviders();
    }
}
```

### 18.2.4 IEmbed 接口

嵌入式元素接口，用于支持元素间的嵌套关系（如基坑嵌入场地）。

```csharp
namespace LightCAD.Core
{
    /// <summary>
    /// 嵌入式元素接口
    /// </summary>
    public interface IEmbed
    {
        /// <summary>
        /// 嵌入关联列表
        /// </summary>
        LcList<EmbedAssociation> EmbedAssociations { get; }

        /// <summary>
        /// 是否可以更换宿主
        /// </summary>
        bool CanChangeHost { get; }

        /// <summary>
        /// 获取嵌入孔洞轮廓
        /// </summary>
        Profile2[] GetEmbedHoles();
    }
}
```

### 18.2.5 IComponentEdit 接口

组件编辑接口，提供拉伸等编辑功能。

```csharp
namespace LightCAD.Core
{
    /// <summary>
    /// 组件编辑接口
    /// </summary>
    public interface IComponentEdit
    {
        /// <summary>
        /// 获取嵌入孔洞
        /// </summary>
        Profile2[] GetEmbedHoles();

        /// <summary>
        /// 拉伸操作
        /// </summary>
        /// <param name="box">选择框</param>
        /// <param name="vector">拉伸方向和距离</param>
        /// <returns>拉伸后的新元素</returns>
        LcElement Stretch(Box2 box, Vector2 vector);
    }
}
```

## 18.3 元素类型系统

### 18.3.1 ElementType 类

```csharp
namespace LightCAD.Core
{
    /// <summary>
    /// 元素类型定义
    /// </summary>
    public class ElementType
    {
        /// <summary>全局唯一标识符</summary>
        public LcGuid Guid { get; set; }

        /// <summary>类型内部名称（英文）</summary>
        public string Name { get; set; }

        /// <summary>类型显示名称（中文）</summary>
        public string DispalyName { get; set; }

        /// <summary>关联的C#类类型</summary>
        public Type ClassType { get; set; }
    }
}
```

### 18.3.2 LayoutElementType 静态类

FY_Layout定义的所有元素类型：

```csharp
namespace QdLayout
{
    /// <summary>
    /// FY_Layout元素类型定义
    /// </summary>
    public static class LayoutElementType
    {
        public static ElementType Lawn;            // 草坪
        public static ElementType PlateBuilding;   // 板房
        public static ElementType PlateBuildGroup;  // 板房楼栋
        public static ElementType FoundationPit;    // 基坑
        public static ElementType Fence;            // 围墙
        public static ElementType PlanBuild;        // 拟建建筑
        public static ElementType Road;             // 硬化地面
        public static ElementType Earthwork;        // 土方回填
        public static ElementType Berm;             // 出土道路
        public static ElementType Harden;           // 路面硬化
        public static ElementType Barrier;          // 防护栏杆
        public static ElementType Site;             // 场地
        public static ElementType Ground;           // 硬化地面
        public static ElementType PropertyLine;     // 用地红线
        public static ElementType OpenLine;         // 开门边线
        public static ElementType LayoutEquipment;  // 场布设备

        /// <summary>
        /// 注册到系统的元素类型数组
        /// 注意：并非所有定义的类型都在All数组中
        /// </summary>
        public static ElementType[] All = new ElementType[]
        {
            Lawn, FoundationPit, Road, Earthwork, Berm, Harden,
            Site, PropertyLine, Fence, PlateBuilding, PlateBuildGroup,
            OpenLine
        };
    }
}
```

### 18.3.3 元素GUID对照表

| 元素类型 | GUID | 中文名 | C#类 |
|---------|------|--------|------|
| Lawn | 63A566EA-3702-A98C-7A6B-8DBEA6B3F41A | 草坪 | QdLawn |
| PlateBuilding | 63A523EA-3702-A98C-7A6B-8DBEA5C3F42B | 板房 | PlateBuilding |
| PlateBuildGroup | C3A523EA-3702-A98C-7A6B-8DBEA2D2F4D4 | 板房楼栋 | PlateBuildGroup |
| FoundationPit | C082E6EA-E099-94AB-50FA-50DF72D286D4 | 基坑 | QdFoundationPit |
| Fence | 5A9EC5E6-09BF-4DB3-9AD2-DD0DA74F099A | 围墙 | QdFence |
| PlanBuild | 5A5EC5E6-06BF-4DB3-4AD2-DD0DA52F078A | 拟建建筑 | QdPlanBuild |
| Road | 85AB36C8-FBB1-424B-C7C4-1F92576EC5BD | 硬化地面 | QdRoad |
| Earthwork | B20D7BB7-6209-B3DB-2761-E1197E59723E | 土方回填 | QdEarthwork |
| Berm | 982B310D-627F-9168-6A63-1257A26BDDF8 | 出土道路 | QdBerm |
| Harden | 897700F4-F50B-62EE-3900-59D967BEBC85 | 路面硬化 | QdHarden |
| Barrier | 6A8E5173-8D53-4542-8272-5B1A6680AFD2 | 防护栏杆 | QdBarrier |
| Site | 15AC9FC1-9BC3-4D11-DFDB-3426FAE73336 | 场地 | QdSite |
| PropertyLine | 6FF93D96-A3D3-DAC7-D720-8497DA8E3A9A | 用地红线 | QdPropertyLine |
| OpenLine | 6FE950F0-9E13-FA8A-E216-AAE0D40BECBC | 开门边线 | QdOpenLine |
| LayoutEquipment | 552E316C-ADB2-43A7-AC77-9E0069ACEDC8 | 场布设备 | QdLayoutEquipment |

## 18.4 元素基类API

### 18.4.1 DirectComponent 基类

```csharp
namespace LightCAD.Model
{
    /// <summary>
    /// 直接组件基类，所有场布元素的父类
    /// </summary>
    public class DirectComponent : LcElement
    {
        /// <summary>元素类型</summary>
        public ElementType Type { get; set; }

        /// <summary>组件定义</summary>
        public LcComponentDefinition Definition { get; }

        /// <summary>属性集合</summary>
        public LcParameterSet Properties { get; }

        /// <summary>基础曲线（轮廓）</summary>
        public Curve2d BaseCurve { get; set; }

        /// <summary>获取形状集合（二维显示用）</summary>
        public virtual Curve2dGroupCollection GetShapes();

        /// <summary>获取属性ID</summary>
        protected int GetPropId(string name);

        /// <summary>设置属性值</summary>
        protected void SetProps(params (int id, object value)[] props);

        /// <summary>属性变更前通知</summary>
        public void OnPropertyChangedBefore(string name, object oldVal, object newVal);

        /// <summary>属性变更后通知</summary>
        public void OnPropertyChangedAfter(string name, object oldVal, object newVal);

        /// <summary>重置缓存</summary>
        public virtual void ResetCache();
    }
}
```

### 18.4.2 LcElement 基类

```csharp
namespace LightCAD.Core
{
    /// <summary>
    /// 所有CAD元素的基类
    /// </summary>
    public abstract class LcElement
    {
        /// <summary>元素唯一标识</summary>
        public LcGuid Id { get; set; }

        /// <summary>元素所在图层名</summary>
        public string Layer { get; set; }

        /// <summary>包围盒</summary>
        public Box2 BoundingBox { get; protected set; }

        /// <summary>所属文档</summary>
        public LcDocument Document { get; }

        /// <summary>初始化元素</summary>
        public void Initilize(LcDocument document);

        /// <summary>计算包围盒</summary>
        public abstract Box2 GetBoundingBox();

        /// <summary>重置包围盒</summary>
        public void ResetBoundingBox();

        /// <summary>克隆元素</summary>
        public abstract LcElement Clone();

        /// <summary>复制属性</summary>
        public virtual void Copy(LcElement src);

        /// <summary>平移</summary>
        public virtual void Translate(double dx, double dy);

        /// <summary>平移(Vector2)</summary>
        public virtual void Translate(Vector2 offset);

        /// <summary>移动</summary>
        public virtual void Move(Vector2 startPoint, Vector2 endPoint);

        /// <summary>批量插入后回调</summary>
        public virtual void OnBatchInsertAfter();

        /// <summary>变换后回调</summary>
        public virtual void OnTransformAfter();

        /// <summary>判断是否与框选多边形相交</summary>
        public virtual bool IntersectWithBox(Polygon2d testPoly,
            List<RefChildElement> intersectChildren = null);

        /// <summary>判断是否被框选多边形完全包含</summary>
        public virtual bool IncludedByBox(Polygon2d testPoly,
            List<RefChildElement> includedChildren = null);
    }
}
```

## 18.5 操作类API

### 18.5.1 DirectComponentAction 基类

```csharp
namespace LightCAD.Drawing.Actions
{
    /// <summary>
    /// 直接组件操作基类，处理用户交互和绘图
    /// </summary>
    public class DirectComponentAction
    {
        /// <summary>文档编辑器</summary>
        protected IDocumentEditor docEditor;

        /// <summary>文档运行时</summary>
        protected DocumentRuntime docRt;

        /// <summary>视口运行时</summary>
        protected ViewportRuntime vportRt;

        /// <summary>命令控制器</summary>
        protected CommandCtrl commandCtrl;

        /// <summary>命名空间键</summary>
        protected string NamespaceKey;

        // === 绘图方法 ===

        /// <summary>在画布上绘制元素（矩阵变换）</summary>
        public virtual void Draw(LcCanvas2d canvas, LcElement element, Matrix3 matrix);

        /// <summary>在画布上绘制元素（偏移）</summary>
        public virtual void Draw(LcCanvas2d canvas, LcElement element, Vector2 offset);

        /// <summary>绘制拖拽握柄</summary>
        public virtual void DrawDragGrip(LcCanvas2d canvas);

        // === 交互方法 ===

        /// <summary>获取控制握柄</summary>
        public virtual ControlGrip[] GetControlGrips(LcElement element);

        /// <summary>设置拖拽握柄</summary>
        public virtual void SetDragGrip(LcElement element,
            ControlGrip grip, Vector2 position, bool isEnd);

        /// <summary>捕捉点</summary>
        public virtual SnapPointResult SnapPoint(SnapRuntime snapRt,
            LcElement element, Vector2 point, double maxDistance,
            bool IsReturn, Matrix3 matrix3);

        // === 属性方法 ===

        /// <summary>获取属性观察者列表</summary>
        public virtual List<PropertyObserver> GetPropertyObservers();

        // === 辅助方法 ===

        /// <summary>获取绘制画笔</summary>
        protected LcPaint GetDrawPen(LcElement element);

        /// <summary>取消操作</summary>
        public virtual void Cancel();

        /// <summary>结束创建</summary>
        protected void EndCreating();
    }
}
```

## 18.6 命令系统API

### 18.6.1 命令特性

```csharp
namespace LightCAD.Runtime
{
    /// <summary>
    /// 标记命令类
    /// </summary>
    [AttributeUsage(AttributeTargets.Class)]
    public class CommandClassAttribute : Attribute { }

    /// <summary>
    /// 标记命令方法
    /// </summary>
    [AttributeUsage(AttributeTargets.Method)]
    public class CommandMethodAttribute : Attribute
    {
        /// <summary>命令名称</summary>
        public string Name { get; set; }

        /// <summary>快捷键</summary>
        public string ShortCuts { get; set; }
    }
}
```

### 18.6.2 命令方法签名

```csharp
// 标准命令方法签名
[CommandMethod(Name = "命令名", ShortCuts = "快捷键")]
public CommandResult 方法名(IDocumentEditor docEditor, string[] args)
{
    // 命令实现
    return CommandResult.Succ();
}
```

### 18.6.3 完整命令列表

| 命令名 | 快捷键 | 方法名 | 说明 |
|--------|--------|--------|------|
| Fence | W | DrawWall222 | 围墙 |
| PlateBuilding | W | DrawWall2322 | 板房 |
| SetBuildGroup | W | SetGroup | 楼栋设置 |
| PlateUBuild | W | PlateUBuild | 板房楼栋 |
| Lawn | LW | DrawLawn | 草坪(多边形) |
| LawnRec | LWRC | DrawLawnRec | 草坪(矩形) |
| LawnChange | LWCH | DrawLawnChange | 草坪(转换) |
| Site | Site | DrawSite | 场地(多边形) |
| SiteRec | STRC | DrawSiteRec | 场地(矩形) |
| SiteChange | STCH | DrawSiteChange | 场地(转换) |
| PropertyLine | PropertyLine | DrawPropertyLine | 用地红线(多边形) |
| PropertyLineRec | PLRC | DrawPropertyLineRec | 用地红线(矩形) |
| PropertyLineChange | PLCH | DrawPropertyLineChange | 用地红线(转换) |
| PlanBuild | PB | DrawPlanBuild | 拟建建筑 |
| PickLinePlanBuild | PLPB | DrawPickLinePlanBuild | 选线拟建建筑 |
| FoundationPit | FDP | DrawFoundationPit | 基坑(多边形) |
| FoundationPitRec | FDPRE | DrawFoundationPitRec | 基坑(矩形) |
| FoundationPitChange | FDPCH | DrawFoundationPitChange | 基坑(转换) |
| Road | ROD | DrawRoad | 道路 |
| Ground | GOD | DrawGround | 硬化地面(多边形) |
| GroundRec | GDRC | DrawGroundRec | 硬化地面(矩形) |
| GroundChange | GODCH | DrawGroundChange | 硬化地面(转换) |
| Earthwork | EWK | DrawEarthwork | 土方回填(多边形) |
| EarthworkRec | EWRC | DrawEarthworkRec | 土方回填(矩形) |
| EarthworkChange | EWCH | DrawEarthworkChange | 土方回填(转换) |
| Berm | BRM | DrawBerm | 出土道路 |
| Barrier | BRR | DrawBarrier | 防护栏杆 |
| Harden | HDR | DrawHarden | 路面硬化(多边形) |
| HardenRec | HDRC | DrawHardenRec | 路面硬化(矩形) |
| HardenChange | HDCH | DrawHardenChange | 路面硬化(转换) |
| OpenOuterLine | OPL | OpenOuterLine | 开门边线 |
| SelRedLinesForArrange | SRFA | SelRedLinesForArrange | 模板排布 |
| DrawOrAdjust | DRAD | DrawOrAdjust | 绘制调整 |

## 18.7 用户输入API

### 18.7.1 PointInputer

```csharp
/// <summary>
/// 点输入器 - 获取用户点击的坐标点
/// </summary>
public class PointInputer
{
    public PointInputer(IDocumentEditor docEditor);
    public bool isCancelled { get; }
    public Task<InputResult<Vector2>> Execute(string prompt);
}
```

### 18.7.2 CmdTextInputer

```csharp
/// <summary>
/// 命令文本输入器 - 获取用户输入的文本
/// </summary>
public class CmdTextInputer
{
    public CmdTextInputer(IDocumentEditor docEditor);
    public bool isCancelled { get; }
    public Task<InputResult<string>> Execute(string prompt,
        string[] options = null);
}
```

### 18.7.3 ElementSetInputer

```csharp
/// <summary>
/// 元素集输入器 - 获取用户选择的元素集合
/// </summary>
public class ElementSetInputer
{
    public ElementSetInputer(IDocumentEditor docEditor);
    public bool isCancelled { get; }
    public Task<InputResult<object>> Execute(string prompt);
}
```

## 18.8 几何工具API

### 18.8.1 Intersect2d 类

```csharp
namespace LightCAD.MathLib
{
    /// <summary>
    /// 二维相交计算工具
    /// </summary>
    public static class Intersect2d
    {
        /// <summary>延长线与延长线的交点</summary>
        public static Vector2 XLineWithXLine(
            Vector2 origin1, Vector2 dir1,
            Vector2 origin2, Vector2 dir2);

        /// <summary>判断多边形与线段是否相交</summary>
        public static bool IsPolygonWithLine(
            Vector2[] polygon, Vector2 start, Vector2 end);

        /// <summary>判断多边形与圆弧是否相交</summary>
        public static bool IsPolygonWithArc(
            Vector2[] polygon, Arc2d arc);

        /// <summary>圆与延长线的交点</summary>
        public static List<Vector2> CircleWithXLine(
            Circle2d circle, XLine2d xline);

        /// <summary>圆与圆的交点</summary>
        public static List<Vector2> CircleWithCircle(
            Circle2d circle1, Circle2d circle2);
    }
}
```

### 18.8.2 GeoModelUtil 类

```csharp
namespace LightCAD.RenderUtils
{
    /// <summary>
    /// 几何模型工具类
    /// </summary>
    public static class GeoModelUtil
    {
        /// <summary>
        /// 拉伸几何体
        /// </summary>
        /// <param name="shape">二维形状</param>
        /// <param name="matrix">坐标变换矩阵</param>
        /// <param name="height">拉伸高度</param>
        /// <param name="direction">拉伸方向(-1为向下)</param>
        /// <returns>三维几何数据</returns>
        public static GeometryResult GetStretchGeometryData(
            Shape shape, Matrix4 matrix,
            double height, int direction);
    }
}
```

### 18.8.3 ShapeUtils 类

```csharp
namespace LightCAD.MathLib
{
    /// <summary>
    /// 形状工具类
    /// </summary>
    public static class ShapeUtils
    {
        /// <summary>判断点序列是否为顺时针方向</summary>
        public static bool isClockWise(List<Vector2> points);
    }
}
```

## 18.9 Provider API

### 18.9.1 Provider委托签名

```csharp
// 形状生成委托
public delegate Curve2dGroupCollection CreateShape(
    LcParameterSet pset, ShapeCreator creator);

// 实体生成委托
public delegate Solid3dCollection CreateSolid(
    LcComponentDefinition definition,
    LcParameterSet pset,
    SolidCreator creator);

// 材质获取委托
public delegate MaterialInfo[] GetMaterials(
    LcComponentDefinition definition,
    LcParameterSet pset,
    SolidCreator creator,
    Solid3d solid);
```

### 18.9.2 Provider注册方法

```csharp
// 注册形状Provider
internal static void ConvertToProviders(
    List<(string uuid, string name, CreateShape creator)> providers);

// 注册实体Provider
internal static void ConvertToProvider(
    string uuid, string name,
    CreateSolid solidCreator,
    GetMaterials materialsGetter);
```

## 18.10 UI组件API

### 18.10.1 TabItem 结构

```csharp
/// <summary>工具栏选项卡</summary>
public class TabItem
{
    public string Name { get; set; }       // 内部名称
    public string Text { get; set; }       // 显示文本
    public string ShortCut { get; set; }   // 快捷键
    public TabButtonGroup[] Children { get; set; } // 按钮组
}

/// <summary>按钮组</summary>
public class TabButtonGroup
{
    public string Name { get; set; }       // 组名
    public TabButton[] Children { get; set; } // 按钮列表
}

/// <summary>工具栏按钮</summary>
public class TabButton
{
    public string Name { get; set; }       // 按钮名称
    public string CommandName { get; set; } // 关联命令
    public Image Image { get; set; }       // 按钮图标
    public string ToolTip { get; set; }    // 工具提示
}
```

### 18.10.2 PropertyObserver 类

```csharp
/// <summary>属性观察者 - 连接元素属性和属性面板</summary>
public class PropertyObserver
{
    public string Name { get; set; }              // 属性内部名
    public string DisplayName { get; set; }       // 显示名称
    public string CategoryName { get; set; }      // 分类内部名
    public string CategoryDisplayName { get; set; } // 分类显示名
    public PropertyType PropType { get; set; }     // 属性类型
    public Func<LcElement, object> Getter { get; set; }  // 取值器
    public Action<LcElement, object> Setter { get; set; } // 赋值器
}

/// <summary>属性类型枚举</summary>
public enum PropertyType
{
    String,
    Double,
    Int,
    Bool,
    Enum,
    Color,
    Material
}
```

## 18.11 本章小结

本章提供了FY_Layout的完整API参考手册：

1. **核心接口**：ILcPlugin、IElement3dAction、IDllProviderImporter、IEmbed、IComponentEdit
2. **元素类型系统**：ElementType定义和16种场布元素类型GUID对照表
3. **元素基类**：DirectComponent和LcElement的完整API
4. **操作类**：DirectComponentAction的绘图、交互、属性方法
5. **命令系统**：33个注册命令的完整列表
6. **用户输入**：PointInputer、CmdTextInputer、ElementSetInputer
7. **几何工具**：Intersect2d、GeoModelUtil、ShapeUtils
8. **Provider API**：形状和实体生成的委托和注册方法
9. **UI组件**：TabItem、PropertyObserver等界面组件

开发者可以将本章作为日常开发的快速参考手册。

---

[上一章：项目部署与发布指南](第17章-项目部署与发布指南) | [下一章：常见问题与解决方案](第19章-常见问题与解决方案)
