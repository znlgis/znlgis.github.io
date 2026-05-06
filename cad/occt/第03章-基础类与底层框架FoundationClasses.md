---
layout: default
title: 第03章：基础类与底层框架 FoundationClasses
---

# 第03章：基础类与底层框架 FoundationClasses

FoundationClasses 是 OCCT 的“地基”，集中了内存管理、字符串、容器、数学、消息、单位、资源等通用基础设施。所有上层模块都直接或间接依赖它，因此理解这一层是阅读 OCCT 源码与编写稳健代码的前提。

## 1. 模块构成

FoundationClasses 模块包含的关键工具包（`src/<toolkit>`）：

- `Standard`：基类、句柄、原子操作、类型注册、内存分配、错误异常。
- `TCollection`：基础集合类型（字符串、ASCII/扩展字符串、列表、序列、堆）。
- `NCollection`：模板化容器（Array、List、Map、Vector、Set、IndexedMap、DataMap、Sequence、Heap、UBTree 等），是新代码的首选。
- `TColStd`、`TColgp`、`TopTools` 等：基于 `NCollection` 的预实例化常用集合。
- `gp`：几何点、向量、方向、矩阵、坐标系等几何基元（属于 FoundationClasses 与 ModelingData 的交界）。
- `Bnd`：包围盒（`Bnd_Box`、`Bnd_OBB`）。
- `Quantity`：物理量（颜色、长度、温度、时间），以及单位转换 `UnitsAPI`。
- `Message`：消息系统（`Message_Messenger`、`Message_Report`、`Message_Printer`）。
- `Resource`：资源管理（资源文件、字符串国际化）。
- `OSD`：跨平台操作系统抽象（文件系统、线程、进程、信号、动态库）。
- `Plugin`：插件加载机制。

## 2. `Standard_Transient` 与句柄

OCCT 大部分对象继承自 `Standard_Transient`，由 `Handle(T)` 智能指针管理：

```cpp
Handle(Geom_Curve) c = ...;     // 引用计数为 1
Handle(Geom_Curve) c2 = c;      // 引用计数为 2
c.Nullify();                    // 引用计数为 1，c 变为空
```

实现要点：

- `Standard_Transient` 的 `myCount` 是原子整数，确保多线程引用计数安全。
- `Handle(T)` 通过宏 `DEFINE_STANDARD_HANDLE(MyClass, BaseClass)` + `IMPLEMENT_STANDARD_RTTIEXT` 注册类型信息，支持 `DynamicType`、`IsKind`、`IsInstance`、`Handle::DownCast`。
- `Handle(T)::DownCast(Handle(Base) p)`：安全向下转换，失败返回空。
- 不要把同一个原始指针用两个独立 handle 持有，否则会重复释放。

值类型（`gp_Pnt`、`TopoDS_Shape`、`TCollection_AsciiString`、`TopLoc_Location` 等）不使用句柄，按值传递；它们的拷贝成本通常很低（共享底层数据 + 引用计数）。

## 3. 字符串

OCCT 提供两类字符串：

- `TCollection_AsciiString`：8-bit ASCII；
- `TCollection_ExtendedString`：UTF-16 宽字符；
- `NCollection_String`（少量场景使用）。

API 类似常见字符串类：构造、`Cat`、`AssignCat`、`Trunc`、`Replace`、`Split`、`Search`、`Token`，并提供与 `const char*`、`std::string`、`std::wstring` 的互转。注意：

- `AsciiString` 默认按字节存储，处理 UTF-8 时需要小心，OCCT 7.x 提供 `IsAscii()`、`ToCString()`、`UTF8` 转换接口。
- 文件路径推荐使用 `TCollection_AsciiString` 保留 UTF-8，再通过 `OSD_Path` 解析。
- `TCollection_ExtendedString` 与 Windows API 的 `LPCWSTR` 互通。

## 4. 集合容器（NCollection）

`NCollection_*` 是 OCCT 的模板容器，命名与 STL 略有差异但概念相似：

- `NCollection_Array1<T>`：一维数组，下标 1 起。
- `NCollection_Array2<T>`：二维数组，常用于曲面控制点。
- `NCollection_List<T>`：单链表。
- `NCollection_Sequence<T>`：双向序列，O(1) 头尾插入。
- `NCollection_Vector<T>`：分块的可扩展数组（避免一次拷贝整片内存）。
- `NCollection_Map<T, Hasher>`：基于桶的散列集合。
- `NCollection_DataMap<K, V, Hasher>`：键值映射。
- `NCollection_IndexedMap<T>`、`NCollection_IndexedDataMap<K, V>`：在哈希基础上保留插入序，支持按下标访问，常用于拓扑遍历去重。
- `NCollection_BaseAllocator`：自定义内存池，可显著加快频繁分配的算法。

预实例化包：

- `TColStd_*`：标准类型的集合（Integer、Real、Boolean、HAsciiString）。
- `TColgp_*`：`gp_*` 类型的集合（Pnt、Pnt2d、Vec、Dir）。
- `TopTools_*`：拓扑相关的集合（`TopoDS_Shape` 的 `MapOfShape`、`IndexedMapOfShape`、`IndexedDataMapOfShapeListOfShape`）。

迭代器风格：
```cpp
NCollection_Map<Standard_Integer> m;
for (auto it = m.cbegin(); it != m.cend(); ++it) { ... }
// 或者
NCollection_Map<Standard_Integer>::Iterator it(m);
for (; it.More(); it.Next()) { it.Value(); }
```

## 5. 数学与基础几何（`gp` 与 `math`）

`gp` 工具包定义了 CAD 中无处不在的几何基元：

- `gp_XY`、`gp_XYZ`：纯坐标，不带单位语义。
- `gp_Pnt2d`、`gp_Pnt`：2D/3D 点。
- `gp_Vec2d`、`gp_Vec`：自由向量。
- `gp_Dir2d`、`gp_Dir`：归一化方向。
- `gp_Ax1`、`gp_Ax2`、`gp_Ax3`、`gp_Ax2d`、`gp_Ax22d`：1/2/3D 轴系，2 表示带 X 方向，3 表示带 X、Y 方向且区分手性。
- `gp_Lin`、`gp_Circ`、`gp_Elips`、`gp_Hypr`、`gp_Parab`、`gp_Pln`、`gp_Cylinder`、`gp_Cone`、`gp_Sphere`、`gp_Torus`：解析几何对象。
- `gp_Trsf`、`gp_GTrsf`：刚体/一般变换。
- `gp_Mat`、`gp_Mat2d`：矩阵。
- `gp_Quaternion`：四元数。

`math` 工具包提供数值算法：方程求解（`math_NewtonFunctionRoot`、`math_BFGS`、`math_FunctionSetRoot`）、最小化、雅可比、积分、特征值、矩阵分解等，是上层 `Geom`、`Approx`、`AdvApprox` 的数值核心。

## 6. 包围盒（`Bnd`）

`Bnd_Box`：轴对齐包围盒，OCCT 大量算法（拓扑遍历、求交、显示裁剪）以它做空间过滤。`Bnd_OBB` 是有向包围盒，`Bnd_Tools` 提供从 `BRepBndLib` 计算包围盒的接口。

```cpp
Bnd_Box bb;
BRepBndLib::Add(shape, bb);
Standard_Real xmin, ymin, zmin, xmax, ymax, zmax;
bb.Get(xmin, ymin, zmin, xmax, ymax, zmax);
```

## 7. 物理量与颜色（`Quantity`）

- `Quantity_Color`：颜色（RGB、HLS、CIELAB、Name）。
- `Quantity_ColorRGBA`：带 alpha 的颜色。
- `Quantity_Length`、`Quantity_Time` 等使用 `typedef double` 实现，仅作为语义提示。
- `UnitsAPI`：单位转换，如毫米与英寸、度与弧度。

## 8. 消息与日志（`Message`）

OCCT 使用统一的消息系统：

- `Message_Messenger`：默认全局单例，可挂载多个 `Message_Printer`（控制台、文件、Qt、自定义 sink）。
- `Message_Report`：算法执行过程的结构化报告，记录警告、错误、耗时，与 `Message_ProgressIndicator` 协作。
- `Message_Gravity`：消息严重等级（`Trace`、`Info`、`Warning`、`Alarm`、`Fail`）。

```cpp
Message::SendInfo() << "Box created: " << shape;
Message::DefaultMessenger()->Send("Hello", Message_Info);
```

## 9. 资源与本地化（`Resource`）

`Resource_Manager` 加载键值对配置文件（`.cmd` 风格），支持：

- 默认资源 + 用户资源覆盖；
- 通过 `CSF_*Defaults` 环境变量定位资源目录；
- 字符串国际化（`Resource_Unicode`）。

OCCT 自带的 `XSTEPResource`、`IGESResource` 等控制 STEP/IGES 转换器行为。

## 10. 操作系统抽象（`OSD`）

`OSD` 把跨平台细节屏蔽起来，主要类：

- `OSD_File`、`OSD_Directory`、`OSD_Path`、`OSD_Process`：文件与进程。
- `OSD_Thread`、`OSD_Mutex`、`OSD_Semaphore`：线程同步（新代码更倾向 `Standard_Mutex`）。
- `OSD_Timer`、`OSD_Chronometer`：性能计时。
- `OSD_Environment`：环境变量。
- `OSD_OpenFile`：跨平台打开宽字符路径文件，避免在 Windows 上踩 UTF-8 坑。

## 11. 错误处理

OCCT 的异常体系以 `Standard_Failure` 为基类，常见子类：

- `Standard_DomainError`、`Standard_OutOfRange`、`Standard_NumericError`、`Standard_NoSuchObject`、`Standard_NullObject`、`Standard_TypeMismatch`、`Standard_ConstructionError`。

抛出与捕获：
```cpp
try {
    OCC_CATCH_SIGNALS
    BRepPrimAPI_MakeBox box(-1, 1, 1);
    return box.Shape();
} catch (Standard_Failure const& e) {
    std::cerr << e.GetMessageString() << std::endl;
}
```

`OCC_CATCH_SIGNALS` 宏把硬件信号（SIGSEGV、SIGFPE）转换为 C++ 异常，便于在算法循环中捕获。

## 12. 日常编程建议

- 始终使用 `Handle(T)`，不要裸 `new`；
- 使用 `NCollection` 替代 STL，除非完全脱离 OCCT 语义；
- 字符串区分 `AsciiString` 与 `ExtendedString`，不要乱拼接；
- 性能敏感处使用 `NCollection_BaseAllocator` 预分配；
- 全局错误通过 `Message_Messenger`，避免到处 `std::cout`；
- 时间度量统一用 `OSD_Timer`；
- 避免直接操作底层指针，OCCT 的内存模型与拷贝语义可能让你踩坑。

掌握 FoundationClasses 之后，下一章我们将深入数学与几何基元，开始接触 OCCT 真正的几何世界。
