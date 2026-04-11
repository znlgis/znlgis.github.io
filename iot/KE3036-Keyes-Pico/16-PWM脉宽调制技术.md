---
layout: default
title: "第16章：PWM 脉宽调制技术"
---

# 第16章：PWM 脉宽调制技术

> 本章深入讲解 PWM 的工作原理、频率与占空比设置，以及在 LED 调光、电机控制和舵机驱动中的应用。

---

## 16.1 PWM 基础概念

### 16.1.1 什么是 PWM

PWM（Pulse Width Modulation）脉宽调制是一种模拟控制技术：

```
         周期 T
    ├───────────────────┤
    ┌────────┐          ┌────────┐
    │        │          │        │
────┘        └──────────┘        └────
    ├───┤
    高电平时间 (占空比)
```

- **周期 (T)**：一个完整脉冲的时间
- **频率 (f)**：f = 1/T，单位 Hz
- **占空比 (D)**：高电平时间 / 周期 × 100%

### 16.1.2 Pico PWM 特性

| 特性 | 数值 |
|------|------|
| PWM 通道 | 8 个切片，每个 2 通道（共 16） |
| 分辨率 | 16 位 (0-65535) |
| 最高频率 | ~62.5 MHz / 分频值 |
| 引脚映射 | 所有 GPIO 都可配置为 PWM |

### 16.1.3 引脚与通道对应

```python
# PWM 切片分配
# GP0, GP1  → 切片 0
# GP2, GP3  → 切片 1
# GP4, GP5  → 切片 2
# ...
# GP14, GP15 → 切片 7

# 计算公式
slice_num = gpio_pin // 2
channel = gpio_pin % 2  # 0=A, 1=B
```

---

## 16.2 PWM 编程基础

### 16.2.1 创建 PWM 对象

```python
from machine import Pin, PWM

# 方法 1：直接创建
pwm = PWM(Pin(0))

# 方法 2：从已有 Pin 创建
pin = Pin(0, Pin.OUT)
pwm = PWM(pin)
```

### 16.2.2 设置频率和占空比

```python
# 设置频率 (Hz)
pwm.freq(1000)  # 1kHz

# 设置占空比 (16 位值，0-65535)
pwm.duty_u16(32768)  # 50%

# 设置占空比 (纳秒)
# duty_ns() 需要计算: ns = 占空比 / 频率 * 1e9
pwm.duty_ns(500000)  # 500μs
```

### 16.2.3 读取当前设置

```python
current_freq = pwm.freq()
current_duty = pwm.duty_u16()
print(f"频率: {current_freq}Hz, 占空比: {current_duty}")
```

### 16.2.4 释放 PWM

```python
pwm.deinit()  # 释放 PWM 资源
```

---

## 16.3 LED 调光

### 16.3.1 基础调光

```python
'''
实验：PWM 控制 LED 亮度
'''
from machine import Pin, PWM
import time

led = PWM(Pin(0))
led.freq(1000)  # 1kHz，避免闪烁

# 设置不同亮度
led.duty_u16(0)       # 0% - 熄灭
led.duty_u16(16384)   # 25%
led.duty_u16(32768)   # 50%
led.duty_u16(49152)   # 75%
led.duty_u16(65535)   # 100% - 最亮
```

### 16.3.2 呼吸灯效果

```python
'''
实验：呼吸灯
'''
from machine import Pin, PWM
import time

led = PWM(Pin(0))
led.freq(1000)

while True:
    # 渐亮
    for duty in range(0, 65536, 500):
        led.duty_u16(duty)
        time.sleep_ms(10)
    
    # 渐暗
    for duty in range(65535, -1, -500):
        led.duty_u16(duty)
        time.sleep_ms(10)
```

### 16.3.3 伽马校正

人眼对亮度的感知是非线性的，需要伽马校正：

```python
import math

def gamma_correct(linear_duty, gamma=2.2):
    """
    伽马校正
    linear_duty: 线性占空比 (0-65535)
    gamma: 伽马值，通常 2.2
    """
    normalized = linear_duty / 65535
    corrected = math.pow(normalized, gamma)
    return int(corrected * 65535)

# 使用伽马校正的呼吸灯
while True:
    for i in range(0, 101):
        linear = int(i / 100 * 65535)
        corrected = gamma_correct(linear)
        led.duty_u16(corrected)
        time.sleep_ms(20)
    
    for i in range(100, -1, -1):
        linear = int(i / 100 * 65535)
        corrected = gamma_correct(linear)
        led.duty_u16(corrected)
        time.sleep_ms(20)
```

---

## 16.4 RGB LED 控制

### 16.4.1 共阴极 RGB LED

```python
'''
实验：RGB LED 颜色控制
'''
from machine import Pin, PWM
import time

# 共阴极 RGB LED
red = PWM(Pin(0))
green = PWM(Pin(1))
blue = PWM(Pin(2))

for pwm in [red, green, blue]:
    pwm.freq(1000)

def set_color(r, g, b):
    """
    设置 RGB 颜色
    r, g, b: 0-255
    """
    red.duty_u16(r * 257)    # 255 * 257 ≈ 65535
    green.duty_u16(g * 257)
    blue.duty_u16(b * 257)

# 预定义颜色
COLORS = {
    'red': (255, 0, 0),
    'green': (0, 255, 0),
    'blue': (0, 0, 255),
    'yellow': (255, 255, 0),
    'cyan': (0, 255, 255),
    'magenta': (255, 0, 255),
    'white': (255, 255, 255),
    'off': (0, 0, 0),
}

# 循环显示颜色
for name, color in COLORS.items():
    print(f"颜色: {name}")
    set_color(*color)
    time.sleep(1)
```

### 16.4.2 彩虹效果

```python
'''
实验：彩虹色渐变
'''
def hsv_to_rgb(h, s, v):
    """
    HSV 转 RGB
    h: 色相 0-360
    s: 饱和度 0-1
    v: 明度 0-1
    """
    c = v * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = v - c
    
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    
    return int((r + m) * 255), int((g + m) * 255), int((b + m) * 255)

# 彩虹效果
while True:
    for hue in range(0, 360, 2):
        r, g, b = hsv_to_rgb(hue, 1, 1)
        set_color(r, g, b)
        time.sleep_ms(20)
```

---

## 16.5 舵机控制

### 16.5.1 舵机工作原理

舵机通过 PWM 信号控制角度：

```
周期: 20ms (50Hz)

0°:    ┌─┐                    (0.5ms 高电平)
       │ │
    ───┘ └────────────────────

90°:   ┌───┐                  (1.5ms 高电平)
       │   │
    ───┘   └──────────────────

180°:  ┌─────┐                (2.5ms 高电平)
       │     │
    ───┘     └────────────────
```

### 16.5.2 舵机控制代码

```python
'''
实验：舵机角度控制
接线：信号线连接 GP16
'''
from machine import Pin, PWM
import time

servo = PWM(Pin(16))
servo.freq(50)  # 舵机标准频率 50Hz

def set_angle(angle):
    """
    设置舵机角度
    angle: 0-180 度
    """
    # 脉宽: 0.5ms (0°) ~ 2.5ms (180°)
    # 周期: 20ms
    min_duty = 1638   # 0.5ms / 20ms * 65535 ≈ 1638
    max_duty = 8192   # 2.5ms / 20ms * 65535 ≈ 8192
    
    duty = int(min_duty + (max_duty - min_duty) * angle / 180)
    servo.duty_u16(duty)

# 测试不同角度
for angle in [0, 45, 90, 135, 180]:
    print(f"角度: {angle}°")
    set_angle(angle)
    time.sleep(1)
```

### 16.5.3 舵机类封装

```python
class Servo:
    """舵机控制类"""
    
    def __init__(self, pin, freq=50, min_us=500, max_us=2500, angle_range=180):
        """
        pin: GPIO 引脚
        freq: PWM 频率 (Hz)
        min_us: 最小脉宽 (微秒)
        max_us: 最大脉宽 (微秒)
        angle_range: 角度范围 (度)
        """
        self.pwm = PWM(Pin(pin))
        self.pwm.freq(freq)
        self.min_us = min_us
        self.max_us = max_us
        self.angle_range = angle_range
        self.period_us = 1000000 // freq
    
    def set_angle(self, angle):
        """设置角度"""
        angle = max(0, min(self.angle_range, angle))
        pulse_us = self.min_us + (self.max_us - self.min_us) * angle / self.angle_range
        duty = int(pulse_us / self.period_us * 65535)
        self.pwm.duty_u16(duty)
        return angle
    
    def sweep(self, start=0, end=180, step=5, delay_ms=50):
        """扫描"""
        if start < end:
            angles = range(start, end + 1, step)
        else:
            angles = range(start, end - 1, -step)
        
        for angle in angles:
            self.set_angle(angle)
            time.sleep_ms(delay_ms)
    
    def release(self):
        """释放舵机（停止 PWM）"""
        self.pwm.duty_u16(0)

# 使用
servo = Servo(16)
servo.sweep(0, 180)
servo.sweep(180, 0)
servo.release()
```

---

## 16.6 电机调速

### 16.6.1 直流电机调速

```python
'''
实验：130 电机 PWM 调速
接线：INA→GP14, INB→GP15
'''
from machine import Pin, PWM
import time

motor_a = PWM(Pin(14))
motor_b = PWM(Pin(15))

motor_a.freq(1000)
motor_b.freq(1000)

def motor_control(speed):
    """
    控制电机
    speed: -100 到 100
        正值: 正转
        负值: 反转
        0: 停止
    """
    if speed > 0:
        motor_a.duty_u16(int(speed / 100 * 65535))
        motor_b.duty_u16(0)
    elif speed < 0:
        motor_a.duty_u16(0)
        motor_b.duty_u16(int(-speed / 100 * 65535))
    else:
        motor_a.duty_u16(0)
        motor_b.duty_u16(0)

# 测试
print("正转加速")
for speed in range(0, 101, 10):
    motor_control(speed)
    time.sleep(0.3)

print("正转减速")
for speed in range(100, -1, -10):
    motor_control(speed)
    time.sleep(0.3)

print("反转")
motor_control(-50)
time.sleep(2)

print("停止")
motor_control(0)
```

---

## 16.7 PWM 频率选择

### 16.7.1 不同应用的推荐频率

| 应用 | 推荐频率 | 原因 |
|------|----------|------|
| LED 调光 | 500-1000 Hz | 高于人眼识别闪烁极限 |
| 舵机 | 50 Hz | 舵机标准 |
| 直流电机 | 1-20 kHz | 减少噪音 |
| 蜂鸣器 | 20-20000 Hz | 可听音频范围 |

### 16.7.2 频率与分辨率权衡

```python
# Pico PWM 时钟 = 125MHz
# 实际频率 = 125MHz / (wrap + 1) / 分频
# 分辨率 = wrap + 1

# 高频率意味着低分辨率
# 例如：
# 50Hz → 高分辨率（舵机控制精确）
# 10kHz → 中等分辨率
# 100kHz → 低分辨率
```

---

## 16.8 本章小结

本章介绍了 PWM 脉宽调制技术：

1. **PWM 概念**：
   - 通过占空比模拟模拟信号
   - Pico 提供 16 位分辨率

2. **应用场景**：
   - LED 调光：伽马校正、呼吸灯
   - RGB 控制：颜色混合、彩虹效果
   - 舵机控制：角度映射
   - 电机调速：方向和速度控制

3. **参数设置**：
   - 频率：根据应用选择
   - 占空比：0-65535

下一章将学习 I2C 通信协议。
