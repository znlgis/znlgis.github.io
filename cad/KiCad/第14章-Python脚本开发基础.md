# 第十四章：Python脚本开发基础

## 14.1 KiCad Python环境

### 14.1.1 Python接口概述

KiCad提供了Python脚本接口，允许自动化和扩展功能：

```
Python接口类型：
├── SWIG绑定（传统）
│   ├── pcbnew模块
│   ├── 直接操作板数据
│   └── 支持动作插件
│
└── IPC API（KiCad 9+）
    ├── kicad-python包
    ├── 与运行实例通信
    └── 更现代的接口
```

### 14.1.2 访问Python控制台

```
在Pcbnew中：
  菜单：Tools → Scripting Console
  或快捷键：未设置，可自定义

控制台特性：
- 交互式Python环境
- 自动导入pcbnew模块
- 可访问当前板对象
```

### 14.1.3 Python环境配置

```python
# 检查Python版本
import sys
print(sys.version)

# 检查可用模块
import pcbnew
print(pcbnew.GetBuildVersion())

# 获取当前板对象
board = pcbnew.GetBoard()
print(board.GetFileName())
```

## 14.2 pcbnew模块基础

### 14.2.1 基本对象访问

```python
import pcbnew

# 获取当前板
board = pcbnew.GetBoard()

# 获取封装列表
footprints = board.GetFootprints()
for fp in footprints:
    ref = fp.GetReference()
    value = fp.GetValue()
    pos = fp.GetPosition()
    print(f"{ref}: {value} at ({pcbnew.ToMM(pos.x)}, {pcbnew.ToMM(pos.y)})")

# 获取走线列表
tracks = board.GetTracks()
for track in tracks:
    if track.GetClass() == "PCB_TRACK":
        start = track.GetStart()
        end = track.GetEnd()
        width = pcbnew.ToMM(track.GetWidth())
        layer = track.GetLayerName()
        print(f"Track on {layer}: {width}mm wide")
```

### 14.2.2 单位转换

```python
import pcbnew

# KiCad内部使用纳米（nm）作为单位
# 提供转换函数

# 毫米转内部单位
internal_unit = pcbnew.FromMM(1.0)  # 1mm

# 内部单位转毫米
mm_value = pcbnew.ToMM(1000000)  # 1mm = 1000000nm

# 创建坐标点
point_mm = pcbnew.wxPointMM(50, 30)  # (50mm, 30mm)
point_internal = pcbnew.wxPoint(pcbnew.FromMM(50), pcbnew.FromMM(30))

# VECTOR2I类型（KiCad 7+）
vec = pcbnew.VECTOR2I(pcbnew.FromMM(100), pcbnew.FromMM(50))
```

### 14.2.3 网络访问

```python
import pcbnew

board = pcbnew.GetBoard()

# 获取网络信息
netinfo = board.GetNetInfo()

# 遍历所有网络
for netcode, net in netinfo.NetsByNetcode().items():
    netname = net.GetNetname()
    netclass = net.GetNetClassName()
    print(f"Net {netcode}: {netname} (class: {netclass})")

# 查找特定网络
gnd_net = board.FindNet("GND")
if gnd_net:
    print(f"GND netcode: {gnd_net.GetNetCode()}")
```

## 14.3 修改PCB数据

### 14.3.1 移动元器件

```python
import pcbnew

board = pcbnew.GetBoard()

# 按参考标号查找封装
for fp in board.GetFootprints():
    if fp.GetReference() == "R1":
        # 获取当前位置
        current_pos = fp.GetPosition()
        print(f"Current position: ({pcbnew.ToMM(current_pos.x)}, {pcbnew.ToMM(current_pos.y)})")
        
        # 设置新位置
        new_pos = pcbnew.wxPointMM(100, 50)
        fp.SetPosition(new_pos)
        
        # 旋转封装
        fp.SetOrientation(pcbnew.EDA_ANGLE(90, pcbnew.DEGREES_T))
        
        break

# 刷新显示
pcbnew.Refresh()
```

### 14.3.2 添加走线

```python
import pcbnew

board = pcbnew.GetBoard()

# 创建新走线
track = pcbnew.PCB_TRACK(board)
track.SetStart(pcbnew.wxPointMM(10, 10))
track.SetEnd(pcbnew.wxPointMM(50, 10))
track.SetWidth(pcbnew.FromMM(0.25))
track.SetLayer(pcbnew.F_Cu)

# 设置网络
gnd_net = board.FindNet("GND")
if gnd_net:
    track.SetNet(gnd_net)

# 添加到板
board.Add(track)

# 刷新
pcbnew.Refresh()
```

### 14.3.3 添加过孔

```python
import pcbnew

board = pcbnew.GetBoard()

# 创建过孔
via = pcbnew.PCB_VIA(board)
via.SetPosition(pcbnew.wxPointMM(30, 30))
via.SetWidth(pcbnew.FromMM(0.8))  # 过孔外径
via.SetDrill(pcbnew.FromMM(0.4))   # 钻孔直径
via.SetViaType(pcbnew.VIATYPE_THROUGH)

# 设置网络
gnd_net = board.FindNet("GND")
if gnd_net:
    via.SetNet(gnd_net)

# 添加到板
board.Add(via)
pcbnew.Refresh()
```

### 14.3.4 操作覆铜区域

```python
import pcbnew

board = pcbnew.GetBoard()

# 遍历覆铜区域
zones = board.Zones()
for zone in zones:
    netname = zone.GetNetname()
    layer = zone.GetLayer()
    area = pcbnew.ToMM(zone.GetArea()) / 1e6  # 转换为平方毫米
    print(f"Zone: {netname} on layer {layer}")

# 填充所有覆铜
filler = pcbnew.ZONE_FILLER(board)
filler.Fill(board.Zones())
pcbnew.Refresh()
```

## 14.4 读取设计信息

### 14.4.1 板信息统计

```python
import pcbnew

def board_statistics():
    board = pcbnew.GetBoard()
    
    # 板尺寸
    bbox = board.GetBoardEdgesBoundingBox()
    width = pcbnew.ToMM(bbox.GetWidth())
    height = pcbnew.ToMM(bbox.GetHeight())
    
    # 元器件统计
    footprints = board.GetFootprints()
    smd_count = sum(1 for fp in footprints if fp.GetAttributes() & pcbnew.FP_SMD)
    tht_count = sum(1 for fp in footprints if not fp.GetAttributes() & pcbnew.FP_SMD)
    
    # 走线统计
    tracks = board.GetTracks()
    track_count = sum(1 for t in tracks if t.GetClass() == "PCB_TRACK")
    via_count = sum(1 for t in tracks if t.GetClass() == "PCB_VIA")
    
    print(f"Board size: {width:.2f} x {height:.2f} mm")
    print(f"Footprints: {len(list(footprints))} (SMD: {smd_count}, THT: {tht_count})")
    print(f"Tracks: {track_count}")
    print(f"Vias: {via_count}")

board_statistics()
```

### 14.4.2 网络连接分析

```python
import pcbnew

def analyze_connectivity():
    board = pcbnew.GetBoard()
    connectivity = board.GetConnectivity()
    
    # 检查未连接项
    connectivity.Build(board)
    
    # 获取网络列表和连接状态
    for netinfo in board.GetNetInfo().NetsByNetcode().values():
        netname = netinfo.GetNetname()
        if netname and netname != "":
            items = connectivity.GetConnectedItems(netinfo, 
                [pcbnew.PCB_PAD_T, pcbnew.PCB_TRACK_T])
            print(f"Net '{netname}': {len(items)} connected items")

analyze_connectivity()
```

## 14.5 脚本文件执行

### 14.5.1 从控制台运行脚本

```python
# 在控制台中执行外部脚本
exec(open("/path/to/script.py").read())

# 或使用execfile（Python 2风格，某些环境支持）
# execfile("/path/to/script.py")
```

### 14.5.2 命令行执行

```bash
# 使用kicad-cli执行Python脚本
kicad-cli pcb python-script \
    --script my_script.py \
    myboard.kicad_pcb

# 传递参数
kicad-cli pcb python-script \
    --script my_script.py \
    --define "PARAM1=value1" \
    myboard.kicad_pcb
```

## 14.6 实用脚本示例

### 14.6.1 批量修改元器件值

```python
import pcbnew

def update_component_values(changes):
    """
    批量更新元器件值
    changes: dict, {reference: new_value}
    """
    board = pcbnew.GetBoard()
    
    for fp in board.GetFootprints():
        ref = fp.GetReference()
        if ref in changes:
            old_value = fp.GetValue()
            new_value = changes[ref]
            fp.SetValue(new_value)
            print(f"{ref}: {old_value} → {new_value}")
    
    pcbnew.Refresh()

# 使用示例
changes = {
    "R1": "10k",
    "R2": "4.7k",
    "C1": "100nF"
}
update_component_values(changes)
```

### 14.6.2 导出元器件位置

```python
import pcbnew
import csv

def export_positions(filename):
    """导出元器件位置到CSV"""
    board = pcbnew.GetBoard()
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Reference', 'Value', 'Footprint', 'X(mm)', 'Y(mm)', 'Rotation', 'Side'])
        
        for fp in board.GetFootprints():
            ref = fp.GetReference()
            value = fp.GetValue()
            fpname = str(fp.GetFPID().GetLibItemName())
            pos = fp.GetPosition()
            x = pcbnew.ToMM(pos.x)
            y = pcbnew.ToMM(pos.y)
            rotation = fp.GetOrientationDegrees()
            side = "Top" if fp.GetLayer() == pcbnew.F_Cu else "Bottom"
            
            writer.writerow([ref, value, fpname, f"{x:.4f}", f"{y:.4f}", f"{rotation:.1f}", side])
    
    print(f"Exported to {filename}")

export_positions("/tmp/positions.csv")
```

### 14.6.3 检查设计规则

```python
import pcbnew

def check_track_widths():
    """检查走线宽度"""
    board = pcbnew.GetBoard()
    min_width = pcbnew.FromMM(0.2)  # 最小线宽0.2mm
    
    violations = []
    for track in board.GetTracks():
        if track.GetClass() == "PCB_TRACK":
            width = track.GetWidth()
            if width < min_width:
                start = track.GetStart()
                violations.append({
                    'position': (pcbnew.ToMM(start.x), pcbnew.ToMM(start.y)),
                    'width': pcbnew.ToMM(width),
                    'layer': track.GetLayerName()
                })
    
    if violations:
        print(f"Found {len(violations)} track width violations:")
        for v in violations:
            print(f"  {v['layer']} at ({v['position'][0]:.2f}, {v['position'][1]:.2f}): {v['width']:.3f}mm")
    else:
        print("No track width violations found")

check_track_widths()
```

## 14.7 调试技巧

### 14.7.1 打印调试

```python
import pcbnew

# 打印对象信息
board = pcbnew.GetBoard()
print(dir(board))  # 列出所有方法和属性

# 打印封装详细信息
for fp in board.GetFootprints():
    print(f"Reference: {fp.GetReference()}")
    print(f"  Value: {fp.GetValue()}")
    print(f"  FPID: {fp.GetFPID()}")
    print(f"  Pads: {fp.GetPadCount()}")
    break  # 只打印第一个
```

### 14.7.2 错误处理

```python
import pcbnew

def safe_operation():
    try:
        board = pcbnew.GetBoard()
        if board is None:
            raise ValueError("No board loaded")
        
        # 执行操作
        # ...
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
```

## 14.8 本章小结

本章介绍了KiCad Python脚本开发基础：

1. **Python环境**：了解了KiCad的Python接口类型和访问方式。
2. **pcbnew模块**：掌握了基本对象访问和单位转换。
3. **修改数据**：学会了操作元器件、走线、过孔和覆铜。
4. **读取信息**：了解了如何获取板信息和网络分析。
5. **脚本执行**：学会了运行和调试Python脚本。
6. **实用示例**：通过实例掌握了常见脚本编写方法。

通过本章学习，读者可以使用Python自动化KiCad操作。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第13章-高速电路设计" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第15章-Python插件开发实战" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
