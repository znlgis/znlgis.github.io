---
layout: default
title: "第1章：Raspberry Pi Pico 概述"
---

# 第1章：Raspberry Pi Pico 概述

> 本章将全面介绍 Raspberry Pi Pico 开发板的硬件架构、核心特性以及在物联网项目中的应用场景。

---

## 1.1 Raspberry Pi Pico 简介

### 1.1.1 项目背景

2021年1月，树莓派基金会推出了进军微控制器领域的 Raspberry Pi Pico。作为一款低成本、高性能的微控制器开发板，Pico 以其强大的功能和亲民的价格迅速获得了全球创客的关注。

Pico 的外形尺寸为 21mm × 51mm，与 Arduino Nano 相近，但性能却有质的飞跃。

### 1.1.2 核心芯片 RP2040

Raspberry Pi Pico 的核心是 RP2040 微控制器芯片，由树莓派基金会自主设计。

| 特性 | 参数 |
|------|------|
| 处理器 | 双核 ARM Cortex-M0+ |
| 主频 | 133 MHz（可超频） |
| SRAM | 264 KB |
| Flash | 2 MB 板载闪存 |
| GPIO | 30 个多功能引脚（26 个暴露） |
| ADC | 12 位分辨率，4 通道 |
| PWM | 16 通道 |
| PIO | 8 个可编程 I/O 状态机 |

### 1.1.3 PIO 可编程 I/O

RP2040 最具创新性的特性是 **PIO（Programmable I/O）**。PIO 是一种可编程的状态机，能够实现各种自定义通信协议：

- 模拟 WS2812B LED 驱动时序
- 实现 VGA 视频输出
- 自定义 SPI/I2C 变体
- 高精度时序控制

```python
# PIO 状态机示例 - WS2812 时序
@rp2.asm_pio(sideset_init=rp2.PIO.OUT_LOW, out_shiftdir=rp2.PIO.SHIFT_LEFT, autopull=True, pull_thresh=24)
def ws2812():
    T1 = 2
    T2 = 5
    T3 = 3
    wrap_target()
    label("bitloop")
    out(x, 1)               .side(0)    [T3 - 1]
    jmp(not_x, "do_zero")   .side(1)    [T1 - 1]
    jmp("bitloop")          .side(1)    [T2 - 1]
    label("do_zero")
    nop()                   .side(0)    [T2 - 1]
    wrap()
```

---

## 1.2 引脚分布与功能

### 1.2.1 引脚图

```
                    ┌───────────────────┐
              GP0  ─┤ 1              40 ├─ VBUS
              GP1  ─┤ 2              39 ├─ VSYS
              GND  ─┤ 3              38 ├─ GND
              GP2  ─┤ 4              37 ├─ 3V3_EN
              GP3  ─┤ 5              36 ├─ 3V3(OUT)
              GP4  ─┤ 6              35 ├─ ADC_VREF
              GP5  ─┤ 7              34 ├─ GP28/ADC2
              GND  ─┤ 8              33 ├─ GND
              GP6  ─┤ 9              32 ├─ GP27/ADC1
              GP7  ─┤10              31 ├─ GP26/ADC0
              GP8  ─┤11              30 ├─ RUN
              GP9  ─┤12              29 ├─ GP22
              GND  ─┤13              28 ├─ GND
             GP10  ─┤14              27 ├─ GP21
             GP11  ─┤15              26 ├─ GP20
             GP12  ─┤16              25 ├─ GP19
             GP13  ─┤17              24 ├─ GP18
              GND  ─┤18              23 ├─ GND
             GP14  ─┤19              22 ├─ GP17
             GP15  ─┤20              21 ├─ GP16
                    └───────────────────┘
```

### 1.2.2 电源引脚

| 引脚 | 说明 |
|------|------|
| VBUS | USB 5V 电源输入 |
| VSYS | 系统电源输入 (2-5V) |
| 3V3(OUT) | 3.3V 稳压输出（最大 300mA） |
| GND | 接地（8 个 GND 引脚） |
| 3V3_EN | 稳压器使能控制 |

### 1.2.3 模拟输入

Pico 提供 3 个外部 ADC 通道：

| ADC 通道 | GPIO 引脚 |
|----------|-----------|
| ADC0 | GP26 |
| ADC1 | GP27 |
| ADC2 | GP28 |
| ADC3 | 内部温度传感器 |

**注意**：MicroPython 将 ADC 值映射到 16 位范围（0-65535），而非原生的 12 位（0-4095）。

```python
from machine import ADC

# 读取 ADC0
adc = ADC(26)
value = adc.read_u16()  # 返回 0-65535
voltage = value * 3.3 / 65535  # 转换为电压值
```

---

## 1.3 通信接口

### 1.3.1 I2C 总线

Pico 提供 2 个硬件 I2C 控制器：

| I2C | SDA 默认 | SCL 默认 |
|-----|----------|----------|
| I2C0 | GP4 | GP5 |
| I2C1 | GP14 | GP15 |

```python
from machine import I2C, Pin

# 初始化 I2C
i2c = I2C(0, sda=Pin(4), scl=Pin(5), freq=400000)

# 扫描设备
devices = i2c.scan()
for d in devices:
    print(f"发现设备: 0x{d:02x}")
```

### 1.3.2 SPI 总线

Pico 提供 2 个硬件 SPI 控制器：

```python
from machine import SPI, Pin

# 初始化 SPI
spi = SPI(0, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(2), mosi=Pin(3), miso=Pin(4))
```

### 1.3.3 UART 串口

```python
from machine import UART, Pin

# 初始化 UART
uart = UART(0, baudrate=9600, tx=Pin(0), rx=Pin(1))
uart.write("Hello World\n")
```

---

## 1.4 逻辑电平与供电

### 1.4.1 3.3V 逻辑

Pico 是 **3.3V 逻辑器件**，GPIO 引脚的高电平为 3.3V。直接连接 5V 设备可能损坏 Pico。

### 1.4.2 供电方式

1. **Micro USB**：通过 USB 供电，提供 5V
2. **VSYS 引脚**：外部 2-5V 电源输入
3. **VBUS 引脚**：外部 5V 电源输入

```
电源优先级: USB VBUS > VSYS
```

---

## 1.5 板载资源

### 1.5.1 板载 LED

Pico 板载一个连接到 **GP25** 的绿色 LED：

```python
from machine import Pin
import time

led = Pin(25, Pin.OUT)

while True:
    led.toggle()
    time.sleep(0.5)
```

### 1.5.2 BOOTSEL 按钮

BOOTSEL 按钮用于进入固件烧录模式：

1. 按住 BOOTSEL 按钮
2. 连接 USB
3. Pico 将作为 USB 存储设备出现
4. 拖放 UF2 固件文件

---

## 1.6 与 Arduino 的对比

| 特性 | Raspberry Pi Pico | Arduino Uno |
|------|-------------------|-------------|
| 处理器 | 双核 ARM Cortex-M0+ | ATmega328P |
| 主频 | 133 MHz | 16 MHz |
| RAM | 264 KB | 2 KB |
| Flash | 2 MB | 32 KB |
| 工作电压 | 3.3V | 5V |
| GPIO | 26 | 14 |
| ADC 分辨率 | 12 位 | 10 位 |
| 价格 | ￥25-35 | ￥50-80 |

---

## 1.7 适用场景

### 1.7.1 推荐场景

- **物联网传感器节点**：低功耗、多接口
- **教育实验**：价格低廉、资料丰富
- **原型开发**：快速验证想法
- **自定义外设**：PIO 实现特殊协议

### 1.7.2 不推荐场景

- **需要 WiFi/蓝牙**：原版 Pico 无无线功能（可选 Pico W）
- **高性能计算**：M0+ 核心计算能力有限
- **5V 信号处理**：需要电平转换

---

## 1.8 本章小结

本章介绍了 Raspberry Pi Pico 的硬件架构、引脚功能、通信接口和供电方式。关键要点：

1. Pico 采用双核 RP2040 芯片，主频高达 133 MHz
2. 提供 26 个可用 GPIO 引脚和 3 个 ADC 通道
3. 支持 I2C、SPI、UART 等多种通信协议
4. PIO 状态机可实现自定义通信时序
5. 3.3V 逻辑电平，注意电平兼容性

下一章将介绍 MicroPython 开发环境的搭建。
