---
layout: default
title: "第2章：MicroPython 环境搭建"
---

# 第2章：MicroPython 环境搭建

> 本章详细介绍 MicroPython 固件烧录、Thonny IDE 安装配置以及开发环境的完整搭建流程。

---

## 2.1 MicroPython 简介

### 2.1.1 什么是 MicroPython

MicroPython 是 Python 3 的精简高效实现，专为微控制器设计。它包含：

- Python 3 核心语法支持
- 标准库的精简版本
- 针对硬件的特定模块（`machine`、`rp2` 等）

### 2.1.2 为什么选择 MicroPython

| 优势 | 说明 |
|------|------|
| 易学易用 | Python 语法简洁，学习曲线平缓 |
| 交互式开发 | REPL 支持即时测试 |
| 跨平台 | 代码可在多种开发板运行 |
| 快速原型 | 无需编译，修改即运行 |
| 社区活跃 | 丰富的库和示例代码 |

---

## 2.2 固件烧录

### 2.2.1 下载固件

从树莓派官网下载最新的 MicroPython 固件：

1. 访问 https://www.raspberrypi.com/documentation/microcontrollers/
2. 点击 "MicroPython" 部分
3. 下载 `.uf2` 格式固件文件

### 2.2.2 烧录步骤

1. **进入 BOOTSEL 模式**
   - 按住 Pico 上的 BOOTSEL 按钮
   - 将 USB 线插入电脑
   - 松开按钮

2. **识别存储设备**
   - Pico 会作为名为 `RPI-RP2` 的 USB 存储设备出现
   
3. **复制固件**
   - 将下载的 `.uf2` 文件拖放到 RPI-RP2 驱动器
   - Pico 会自动重启

### 2.2.3 验证烧录

连接串口工具或 Thonny，输入：

```python
>>> import sys
>>> sys.implementation
(name='micropython', version=(1, 22, 0), ...)
```

---

## 2.3 Thonny IDE 安装

### 2.3.1 下载安装

1. 访问 https://thonny.org/
2. 下载对应操作系统版本
3. 按提示完成安装

### 2.3.2 首次配置

1. **启动 Thonny**
2. **选择语言**：在弹窗中选择"简体中文"
3. **选择模式**：选择 "Raspberry Pi" 预设

### 2.3.3 配置解释器

1. 点击 **工具** → **选项**
2. 选择 **解释器** 标签页
3. 在下拉菜单中选择 **MicroPython (Raspberry Pi Pico)**
4. 选择正确的串口端口

```
Windows: COM3, COM4 等
macOS: /dev/cu.usbmodem*
Linux: /dev/ttyACM0
```

---

## 2.4 Windows 驱动问题

### 2.4.1 Windows 10/11

Windows 10/11 通常会自动识别 Pico 并安装驱动。在设备管理器中可以看到 "USB 串行设备"。

### 2.4.2 Windows 7 手动安装

Windows 7 需要手动安装驱动：

1. **创建驱动文件** `pico.inf`：

```ini
[Version]
Signature="$Windows NT$"
Class=Ports
ClassGuid={4D36E978-E325-11CE-BFC1-08002BE10318}
Provider=%ManufacturerName%
DriverVer=01/01/2021,1.0.0.0

[Manufacturer]
%ManufacturerName%=DeviceList, NTx86, NTamd64

[DeviceList.NTx86]
%DeviceName%=DriverInstall, USB\VID_2E8A&PID_0005

[DeviceList.NTamd64]
%DeviceName%=DriverInstall, USB\VID_2E8A&PID_0005

[DriverInstall]
Include=mdmcpq.inf
CopyFiles=FakeModemCopyFileSection
AddReg=DriverAddReg

[DriverAddReg]
HKR,,DevLoader,,*ntkern
HKR,,NTMPDriver,,usbser.sys
HKR,,EnumPropPages32,,"MsPorts.dll,SerialPortPropPageProvider"

[Strings]
ManufacturerName="Raspberry Pi"
DeviceName="Pi Pico Serial Port"
```

2. 在设备管理器中右键未识别设备，选择"更新驱动程序"
3. 浏览计算机查找驱动程序，指向保存 `pico.inf` 的文件夹

---

## 2.5 Thonny 界面介绍

### 2.5.1 主要区域

```
┌─────────────────────────────────────────────────────────┐
│  文件  编辑  视图  运行  工具  帮助                        │
├─────────────────────────────────────────────────────────┤
│  [新建] [打开] [保存] [运行] [停止]                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                     代码编辑区                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  >>> Shell 交互区                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.5.2 文件面板

点击 **视图** → **文件**，左侧显示文件浏览器：

- **此计算机**：本地文件系统
- **MicroPython 设备**：Pico 上的文件

### 2.5.3 Shell 命令行

Shell 区域支持 REPL（Read-Eval-Print Loop）交互：

```python
>>> from machine import Pin
>>> led = Pin(25, Pin.OUT)
>>> led.value(1)  # LED 点亮
>>> led.value(0)  # LED 熄灭
```

---

## 2.6 第一个程序

### 2.6.1 点亮 LED

在编辑区输入以下代码：

```python
from machine import Pin
import time

# 配置板载 LED
led = Pin(25, Pin.OUT)

# 循环闪烁
while True:
    led.value(1)
    time.sleep(0.5)
    led.value(0)
    time.sleep(0.5)
```

### 2.6.2 运行程序

- **即时运行**：点击绿色 ▶ 按钮或按 F5
- **停止程序**：点击红色 ⬛ 按钮或按 Ctrl+C

### 2.6.3 保存到 Pico

要让程序开机自动运行：

1. 点击 **文件** → **另存为**
2. 选择 **MicroPython 设备**
3. 文件名必须是 `main.py`
4. 点击确定

**重要**：Pico 开机时会自动执行 `main.py`

---

## 2.7 库文件管理

### 2.7.1 内置库

MicroPython 内置常用库：

| 库名 | 用途 |
|------|------|
| `machine` | 硬件控制（GPIO、ADC、PWM 等） |
| `time` | 时间相关函数 |
| `rp2` | RP2040 特定功能（PIO 等） |
| `onewire` | 单总线协议 |
| `dht` | DHT 温湿度传感器 |

### 2.7.2 上传外部库

一些传感器需要额外的库文件：

1. 在 Thonny 中打开库文件（如 `lcd128_32.py`）
2. 点击 **文件** → **另存为**
3. 选择 **MicroPython 设备**
4. 保持原文件名保存

### 2.7.3 包管理器

Thonny 内置包管理器：

1. 点击 **工具** → **管理包**
2. 搜索需要的包
3. 点击安装

---

## 2.8 常用开发技巧

### 2.8.1 REPL 快捷操作

| 快捷键 | 功能 |
|--------|------|
| Ctrl+C | 中断当前程序 |
| Ctrl+D | 软重启 |
| Ctrl+E | 粘贴模式 |

### 2.8.2 文件系统操作

```python
import os

# 列出文件
os.listdir()

# 读取文件
with open('config.txt', 'r') as f:
    content = f.read()

# 写入文件
with open('data.txt', 'w') as f:
    f.write('Hello World')
```

### 2.8.3 错误调试

```python
try:
    # 可能出错的代码
    sensor.read()
except Exception as e:
    print(f"错误: {e}")
```

---

## 2.9 替代开发环境

### 2.9.1 VS Code + Pico-W-Go

1. 安装 VS Code
2. 安装 Pico-W-Go 扩展
3. 配置 Python 路径

### 2.9.2 PyCharm + MicroPython 插件

1. 安装 PyCharm
2. 安装 MicroPython 插件
3. 配置设备连接

### 2.9.3 命令行工具

使用 `ampy` 或 `rshell` 进行文件传输：

```bash
# 安装 ampy
pip install adafruit-ampy

# 上传文件
ampy --port /dev/ttyACM0 put main.py

# 运行文件
ampy --port /dev/ttyACM0 run main.py
```

---

## 2.10 本章小结

本章完成了 MicroPython 开发环境的搭建：

1. 下载并烧录 MicroPython 固件到 Pico
2. 安装配置 Thonny IDE
3. 解决 Windows 7 驱动问题
4. 编写并运行第一个程序
5. 了解库文件管理方法

下一章将深入讲解 GPIO 基础与引脚配置。
