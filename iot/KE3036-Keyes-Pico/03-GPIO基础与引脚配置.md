---
layout: default
title: "第3章：GPIO 基础与引脚配置"
---

# 第3章：GPIO 基础与引脚配置

> 本章深入讲解 GPIO（通用输入输出）的工作原理、引脚模式配置以及 MicroPython 中的编程方法。

---

## 3.1 GPIO 概述

### 3.1.1 什么是 GPIO

GPIO（General Purpose Input/Output）是微控制器与外部世界交互的基本接口。每个 GPIO 引脚可以配置为：

- **输入模式**：读取外部信号（高电平/低电平）
- **输出模式**：输出电压信号控制外部设备

### 3.1.2 Pico 的 GPIO 资源

| 资源 | 数量 |
|------|------|
| 总 GPIO 引脚 | 30 |
| 可用 GPIO 引脚 | 26（GP0-GP22, GP26-GP28） |
| PWM 通道 | 16 |
| ADC 通道 | 3 |

---

## 3.2 输出模式

### 3.2.1 基本输出

```python
from machine import Pin

# 配置 GP0 为输出模式
pin = Pin(0, Pin.OUT)

# 输出高电平 (3.3V)
pin.value(1)
# 或使用
pin.high()
pin.on()

# 输出低电平 (0V)
pin.value(0)
# 或使用
pin.low()
pin.off()

# 切换状态
pin.toggle()
```

### 3.2.2 输出电流限制

⚠️ **重要**：Pico GPIO 的最大输出电流约为 **12mA**。

直接驱动大功率负载可能导致：
- GPIO 损坏
- 输出电压下降
- 芯片过热

**解决方案**：使用三极管或 MOS 管进行电流放大。

```
GPIO → 限流电阻 → 三极管基极
                   ↓
        VCC → 负载 → 三极管集电极
                   ↓
                  GND
```

---

## 3.3 输入模式

### 3.3.1 基本输入

```python
from machine import Pin

# 配置 GP15 为输入模式
button = Pin(15, Pin.IN)

# 读取引脚状态
state = button.value()  # 返回 0 或 1
```

### 3.3.2 上拉与下拉电阻

GPIO 输入引脚在未连接时处于"悬空"状态，电平不确定。需要使用上拉或下拉电阻确定默认状态。

```python
# 内部上拉电阻（默认高电平）
button = Pin(15, Pin.IN, Pin.PULL_UP)

# 内部下拉电阻（默认低电平）
button = Pin(15, Pin.IN, Pin.PULL_DOWN)
```

**工作原理**：

```
上拉模式:
  VCC
   │
  [R]  (上拉电阻，约 50KΩ)
   │
   ├── GPIO 引脚
   │
  [按钮]
   │
  GND

按钮断开时，GPIO 读取到高电平
按钮按下时，GPIO 读取到低电平（按钮短接到 GND）
```

### 3.3.3 外部上拉/下拉

套件中的传感器模块通常自带上拉电阻（如 4.7KΩ 或 10KΩ）：

```
VCC ─┬─ [R1 4.7K] ─┬─ 信号端 S
     │             │
     └─ [传感器] ──┘
                  │
                 GND
```

此时代码中可以不设置内部上拉：

```python
sensor = Pin(16, Pin.IN)  # 使用外部上拉
```

---

## 3.4 中断处理

### 3.4.1 中断概念

中断允许 GPIO 状态变化时立即执行特定函数，无需轮询检测。

### 3.4.2 中断配置

```python
from machine import Pin

# 定义中断处理函数
def button_callback(pin):
    print(f"按钮状态变化: {pin.value()}")

# 配置按钮
button = Pin(15, Pin.IN, Pin.PULL_UP)

# 设置中断
button.irq(trigger=Pin.IRQ_FALLING, handler=button_callback)
```

### 3.4.3 中断触发模式

| 模式 | 说明 |
|------|------|
| `Pin.IRQ_RISING` | 上升沿触发（低→高） |
| `Pin.IRQ_FALLING` | 下降沿触发（高→低） |
| `Pin.IRQ_RISING | Pin.IRQ_FALLING` | 双边沿触发 |

### 3.4.4 按键防抖

机械按键存在抖动问题，需要软件防抖：

```python
from machine import Pin
import time

last_press = 0
debounce_ms = 200

def button_handler(pin):
    global last_press
    now = time.ticks_ms()
    if time.ticks_diff(now, last_press) > debounce_ms:
        last_press = now
        print("按钮按下!")

button = Pin(15, Pin.IN, Pin.PULL_UP)
button.irq(trigger=Pin.IRQ_FALLING, handler=button_handler)
```

---

## 3.5 引脚复用

### 3.5.1 多功能引脚

Pico 的每个 GPIO 引脚可以配置为多种功能：

| GP 引脚 | 功能 1 | 功能 2 | 功能 3 |
|---------|--------|--------|--------|
| GP0 | GPIO | UART0 TX | I2C0 SDA |
| GP1 | GPIO | UART0 RX | I2C0 SCL |
| GP2 | GPIO | SPI0 SCK | - |
| GP3 | GPIO | SPI0 TX | - |
| GP4 | GPIO | SPI0 RX | I2C0 SDA |
| GP5 | GPIO | SPI0 CSn | I2C0 SCL |

### 3.5.2 引脚分配策略

合理规划引脚分配：

```python
# 引脚分配表
PINS = {
    'LED': 0,           # GP0 - LED 输出
    'BUTTON': 15,       # GP15 - 按钮输入
    'BUZZER': 21,       # GP21 - 蜂鸣器 PWM
    'TEMP_SENSOR': 26,  # GP26/ADC0 - 温度传感器
    'I2C_SDA': 20,      # GP20 - I2C 数据线
    'I2C_SCL': 21,      # GP21 - I2C 时钟线
}

led = Pin(PINS['LED'], Pin.OUT)
button = Pin(PINS['BUTTON'], Pin.IN, Pin.PULL_UP)
```

---

## 3.6 驱动电路设计

### 3.6.1 LED 驱动

**直接驱动**（电流 < 12mA）：

```
GPIO ─── [R 220Ω] ─── LED+ ─── LED- ─── GND
```

**三极管驱动**（推荐）：

```
GPIO ─── [R 1KΩ] ─── NPN基极
                      │
                    集电极 ─── LED- ─── [R 220Ω] ─── VCC
                      │
                    发射极 ─── GND
```

### 3.6.2 继电器驱动

继电器需要较大电流，必须使用驱动电路：

```
GPIO ─── [R 1KΩ] ─── NPN基极
                      │
                    集电极 ─┬─ 继电器线圈 ─── VCC
                           │
                          [D 续流二极管]
                           │
                    发射极 ─┴─ GND
```

---

## 3.7 传感器接口类型

### 3.7.1 数字传感器

只输出高/低电平（0/1）：

```python
# 红外避障传感器
obstacle = Pin(16, Pin.IN)

if obstacle.value() == 0:
    print("检测到障碍物")
else:
    print("无障碍物")
```

### 3.7.2 模拟传感器

输出连续变化的电压值：

```python
from machine import ADC

# 光敏传感器
light = ADC(26)

value = light.read_u16()  # 0-65535
print(f"光照值: {value}")
```

### 3.7.3 数字+模拟复合

同时输出数字和模拟信号：

```python
from machine import Pin, ADC

# 烟雾传感器 MQ-2
mq2_digital = Pin(22, Pin.IN)  # 数字输出（是否超阈值）
mq2_analog = ADC(26)           # 模拟输出（浓度值）

if mq2_digital.value() == 0:
    print("警告: 烟雾浓度超标!")
print(f"烟雾浓度: {mq2_analog.read_u16()}")
```

---

## 3.8 电平转换

### 3.8.1 5V 设备兼容

Pico 是 3.3V 逻辑，连接 5V 设备需要电平转换：

**方法 1：电阻分压（仅输入）**

```
5V 信号 ─── [R1 2KΩ] ─┬─ GPIO
                       │
                     [R2 3.3KΩ]
                       │
                      GND
```

**方法 2：电平转换模块**

使用 BSS138 或 TXS0108 等专用芯片。

### 3.8.2 开漏输出

某些 I2C 设备使用开漏输出，需要外部上拉：

```python
# 某些场景需要模拟开漏
pin = Pin(0, Pin.OPEN_DRAIN, Pin.PULL_UP)
```

---

## 3.9 代码规范

### 3.9.1 引脚常量定义

```python
# 在文件开头定义引脚
PIN_LED = 0
PIN_BUTTON = 15
PIN_BUZZER = 21

led = Pin(PIN_LED, Pin.OUT)
button = Pin(PIN_BUTTON, Pin.IN, Pin.PULL_UP)
```

### 3.9.2 封装类

```python
class LED:
    def __init__(self, pin_num):
        self.pin = Pin(pin_num, Pin.OUT)
    
    def on(self):
        self.pin.value(1)
    
    def off(self):
        self.pin.value(0)
    
    def toggle(self):
        self.pin.toggle()
    
    def blink(self, times=3, interval=0.2):
        for _ in range(times):
            self.toggle()
            time.sleep(interval)

# 使用
led = LED(0)
led.blink(5)
```

---

## 3.10 本章小结

本章介绍了 GPIO 的基础知识和配置方法：

1. GPIO 可配置为输入或输出模式
2. 输入模式需要上拉或下拉电阻确定默认状态
3. 中断可实现事件驱动编程，需注意防抖
4. 驱动大电流负载需要外部驱动电路
5. 连接 5V 设备需要电平转换

下一章将介绍 Keyes IO 扩展板的使用方法。
