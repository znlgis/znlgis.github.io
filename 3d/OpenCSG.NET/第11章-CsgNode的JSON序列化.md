---
layout: default
title: 第11章：CsgNode 的 JSON 序列化
---

# 第11章：CsgNode 的 JSON 序列化

声明式 `CsgNode` 树最大的价值，在于它是**纯数据**——数据就能被**保存、传输、版本管理、跨进程交换**。本章讲 OpenCSG.NET 内置的序列化模块 `CsgSerialization`：如何把一棵建模树写成 JSON、再原样读回来。这为"参数化配置文件""建模服务 API""可视化编辑器的存档"等场景铺平了道路。它基于 .NET 内置的 `System.Text.Json`，也是核心库唯一的运行时依赖（`System.Text.Json 8.0.5`）。

## 11.1 为什么要序列化建模树

回顾第 9 章的对比：命令式 API 产出 `Solid`（几何结果，无法有意义地序列化成"配方"），而声明式 API 产出 `CsgNode`（配方）。把配方序列化，你就能：

- **持久化**：把用户设计的零件参数存成 `.json`，下次读回来重新求值。
- **传输**：前端（浏览器/编辑器）拼一棵树，POST 给后端服务求值出 STL。
- **版本管理**：JSON 是文本，可以 diff、可以进 Git、可以 code review。
- **模板化**：把常用型材做成 JSON 模板，改几个数字就是新零件。

关键点：**你序列化的是"怎么建"，不是"建成什么"**。文件很小（几百字节的 JSON 能描述一个复杂零件），且与分辨率无关。

## 11.2 四个入口方法

`CsgSerialization` 是静态类，提供四个方法——两组"单个/数组"、"序列化/反序列化"的组合：

```csharp
// 单个节点
string json           = CsgSerialization.ToJson(node);            // 树 → JSON
string json           = CsgSerialization.ToJson(node, indented: false);  // 紧凑输出
CsgNode restored      = CsgSerialization.FromJson(json);          // JSON → 树

// 节点数组（比如一个装配体的多个零件）
string json                   = CsgSerialization.ToJson(nodes);   // IEnumerable<CsgNode> → JSON
IReadOnlyList<CsgNode> nodes  = CsgSerialization.FromJsonArray(json);  // JSON → 树列表
```

- `ToJson(CsgNode, bool indented = true)`：默认**带缩进**（易读）；传 `indented: false` 得到紧凑单行 JSON（省体积，适合网络传输）。
- `FromJson(string)`：反序列化单棵树，若结果为 `null` 抛 `JsonException`。
- `ToJson(IEnumerable<CsgNode>)` / `FromJsonArray(string)`：处理节点**数组**。

一个最小的往返（round-trip）例子：

```csharp
using Csg;
using static Csg.CsgNodes;

CsgNode tree = Subtract(
    Box(0, 0, 0, 10, 10, 10),
    Sphere(new Vector3D(0, 0, 0), 6));

string json = CsgSerialization.ToJson(tree);   // 存成文本
File.WriteAllText("part.json", json);

// ……某个时刻，从文件读回来……
CsgNode loaded = CsgSerialization.FromJson(File.ReadAllText("part.json"));
Solid solid = CsgEvaluator.Evaluate(loaded);   // 重新求值
```

## 11.3 序列化配置：camelCase + 自定义转换器

`CsgSerialization` 内部维护一份共享的 `JsonSerializerOptions`（`CreateOptions`）：

```csharp
var opts = new JsonSerializerOptions
{
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
};
opts.Converters.Add(new Vector3DConverter());
opts.Converters.Add(new Vector2DConverter());
opts.Converters.Add(new Profile2DConverter());
opts.Converters.Add(new CsgNodeConverter());
```

两个要点：

1. **camelCase 命名**：C# 属性 `Center`、`Size`、`FlangeWidth` 在 JSON 里变成 `center`、`size`、`flangeWidth`。这是前端友好的惯例。
2. **四个自定义转换器**：向量类型（`Vector3D`/`Vector2D`）和多态基类型（`Profile2D`/`CsgNode`）都需要特殊处理，靠这四个 `JsonConverter` 实现。

### 11.3.1 向量的紧凑表示

`Vector3D` 被序列化成简洁的 `{x, y, z}` 对象（`Vector2D` 则是 `{x, y}`），而不是 .NET 默认可能带出的一堆派生属性：

```json
{ "x": 1, "y": 2, "z": 3 }
```

`Vector3DConverter` 手写了 `Read`/`Write`，只认 `x`/`y`/`z` 三个字段，既紧凑又稳定。

## 11.4 `$type` 判别式：多态的关键

`CsgNode` 和 `Profile2D` 都是**抽象基类型**，一段 JSON 里既可能是 `BoxNode` 也可能是 `UnionNode`。反序列化时怎么知道该建哪个具体类型？答案是**判别式（discriminator）**：每个多态对象的 JSON 都带一个 **`$type`** 字段，写在对象的**第一个位置**。

例如一个 `BoxNode(Center(1,2,3), Size(4,5,6))` 序列化为：

```json
{
  "$type": "Box",
  "center": { "x": 1, "y": 2, "z": 3 },
  "size": { "x": 4, "y": 5, "z": 6 }
}
```

`CsgNodeConverter.Write` 先写 `$type`，再把对象自身的属性逐个补上；`Read` 时先读 `$type`，用一个 `switch` 分派到正确的具体类型去反序列化。

### 11.4.1 判别式取值表

`$type` 用的是**短名**（不是 C# 类名），下面两张表是完整映射：

**CsgNode 节点：**

| `$type` | 具体类型 |
| --- | --- |
| `Box` | `BoxNode` |
| `Sphere` | `SphereNode` |
| `Cylinder` | `CylinderNode` |
| `Cone` | `ConeNode` |
| `Extrude` | `ExtrudeNode` |
| `Wedge` | `WedgeNode` |
| `Union` | `UnionNode` |
| `Subtract` | `SubtractNode` |
| `Intersect` | `IntersectNode` |
| `Transform` | `TransformNode` |

**Profile2D 截面：**

| `$type` | 具体类型 |
| --- | --- |
| `Rectangle` | `RectangleProfile` |
| `HBeam` | `HBeamProfile` |
| `Channel` | `ChannelProfile` |
| `SquareTube` | `SquareTubeProfile` |
| `Trapezoid` | `TrapezoidProfile` |
| `Capsule` | `CapsuleProfile` |
| `LShape` | `LShapeProfile` |

> **注意**：即便是求值会抛异常的 `ConeNode`（第 9 章），也**能正常序列化/反序列化**——序列化和求值是两回事。你可以保存一棵含 `Cone` 的树，只是别拿它去 `Evaluate`。

## 11.5 嵌套树的完整 JSON

判别式机制在**嵌套**时依然清晰。下面这棵树——从大立方体里挖掉"球 ∪ 圆柱"：

```csharp
var inner = CsgNodes.Union(
    new SphereNode(new Vector3D(2, 2, 2), 2),
    new CylinderNode(new Vector3D(5, 5, 0), 1, 8));
var node = CsgNodes.Subtract(
    new BoxNode(new Vector3D(0, 0, 0), new Vector3D(10, 10, 10)),
    inner);
```

序列化后是（`children` 就是布尔节点的子列表，camelCase）：

```json
{
  "$type": "Subtract",
  "children": [
    {
      "$type": "Box",
      "center": { "x": 0, "y": 0, "z": 0 },
      "size": { "x": 10, "y": 10, "z": 10 }
    },
    {
      "$type": "Union",
      "children": [
        {
          "$type": "Sphere",
          "center": { "x": 2, "y": 2, "z": 2 },
          "radius": 2
        },
        {
          "$type": "Cylinder",
          "center": { "x": 5, "y": 5, "z": 0 },
          "radius": 1,
          "height": 8
        }
      ]
    }
  ]
}
```

带 `Profile2D` 的树同理——`ExtrudeNode` 里嵌套一个带 `$type` 的截面对象：

```json
{
  "$type": "Extrude",
  "profile": {
    "$type": "HBeam",
    "webHeight": 100,
    "flangeWidth": 80,
    "webThickness": 10,
    "flangeThickness": 12
  },
  "height": 50
}
```

## 11.6 往返保真与幂等

序列化模块的两个重要性质（官方测试直接验证）：

1. **类型与数值保真**：`FromJson(ToJson(x))` 得到的树，类型（`BoxNode` 还是 `SphereNode`）、结构（子节点个数、嵌套关系）、数值（坐标、半径、尺寸）都与原树一致。
2. **幂等（idempotent）**：序列化 → 反序列化 → 再序列化，**两次 JSON 文本完全相等**。这保证 JSON 可以安全地做 diff、缓存、比对：

```csharp
var node  = new ExtrudeNode(Profiles.Capsule(3, 1), 5);
var json1 = CsgSerialization.ToJson(node);
var json2 = CsgSerialization.ToJson(CsgSerialization.FromJson(json1));
// json1 == json2 —— 恒成立
```

## 11.7 错误处理

反序列化对**畸形输入**有明确反应，便于你写健壮的加载逻辑：

- **缺少 `$type`**：多态对象若没有 `$type` 字段，抛 `JsonException("Missing required '$type' discriminator ...")`。
- **未知 `$type`**：`$type` 是无法识别的字符串（如 `"UnknownType"`），抛 `JsonException("Unknown CsgNode $type: ...")`。
- **反序列化得到 null**：`FromJson`/`FromJsonArray` 检测到 `null` 结果时抛 `JsonException`。

```csharp
try
{
    var node = CsgSerialization.FromJson(userProvidedJson);
    var solid = CsgEvaluator.Evaluate(node);
}
catch (JsonException ex)
{
    Console.Error.WriteLine($"配置文件无效：{ex.Message}");
}
catch (CsgEvaluationException ex)   // 比如里面含 ConeNode
{
    Console.Error.WriteLine($"求值失败：{ex.Message}");
}
```

建议在加载外部 JSON 时同时捕获 `JsonException`（格式/类型问题）和 `CsgEvaluationException`（求值问题，见第 9 章），给用户清晰的反馈。

## 11.8 端到端：JSON 配置驱动的型材生成

把序列化用起来——一个"读 JSON、求值、导出 STL"的小工具，就是一个最小的**参数化建模服务**雏形：

```csharp
using Csg;

static void BuildFromConfig(string jsonPath, string stlPath)
{
    // 1) 读入建模配方
    string json = File.ReadAllText(jsonPath);
    CsgNode tree = CsgSerialization.FromJson(json);

    // 2) 求值成几何
    Solid solid = CsgEvaluator.Evaluate(tree);

    // 3) 导出 STL
    using var w = new StreamWriter(stlPath);
    solid.WriteStl(Path.GetFileNameWithoutExtension(stlPath), w);

    Console.WriteLine($"{jsonPath} → {stlPath}，{solid.Polygons.Count} 面");
}
```

配上前面第 10 章的截面体系，你完全可以让**非程序员**通过编辑 JSON（甚至一个网页表单生成 JSON）来定制型材，后端只管 `FromJson` → `Evaluate` → `WriteStl`。这就是声明式 + 序列化组合的工程价值。

## 11.9 本章小结

- `CsgSerialization` 基于 `System.Text.Json`，提供 `ToJson`/`FromJson`（单树）与 `ToJson`/`FromJsonArray`（数组）四个入口；`indented` 参数控制紧凑或缩进输出。
- 配置为 **camelCase** 命名；`Vector3D`/`Vector2D` 用紧凑的 `{x,y,z}`/`{x,y}` 表示。
- 多态靠 **`$type` 判别式**：每个 `CsgNode`/`Profile2D` 对象的 JSON 首字段是短名 `$type`，反序列化按它分派具体类型。
- 序列化**保真且幂等**（两次序列化文本相等）；`ConeNode` 能序列化但不能求值。
- 畸形输入（缺 `$type`、未知 `$type`、null）抛 `JsonException`；加载外部 JSON 时应同时防范 `JsonException` 与 `CsgEvaluationException`。

至此，声明式 API 三章（9–11）讲完。下一章我们**潜入引擎室**——剖析命令式内核 `Solid`/`Tree`/`Node` 的 BSP 算法实现细节，理解布尔运算到底是怎么算出来的。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="第10章-参数化截面与拉伸建模">← 上一章</a>
  <a href="./">目录</a>
  <a href="第12章-源码剖析Solid内核与BSP算法">下一章 →</a>
</div>
