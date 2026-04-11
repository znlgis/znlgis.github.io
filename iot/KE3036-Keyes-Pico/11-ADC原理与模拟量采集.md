---
layout: default
title: "第11章：ADC 原理与模拟量采集"
---

# 第11章：ADC 原理与模拟量采集

> 本章深入讲解 ADC（模数转换器）的工作原理、Pico 的 ADC 特性以及模拟传感器的数据采集方法。

---

## 11.1 ADC 基础概念

### 11.1.1 什么是 ADC

ADC（Analog-to-Digital Converter）将连续的模拟信号转换为离散的数字值。

```
模拟信号          采样               量化                编码
   │                │                 │                  │
  ~~~            ■ ■ ■             ■ ■ ■              1001
   │              ■   ■             ■   ■             0111
  ~~~           ■     ■           ■     ■            0101
              时间轴上取点      对应到离散级别      转为二进制
```

### 11.1.2 关键参数

| 参数 | 说明 |
|------|------|
| 分辨率 | 量化级别数（如 12 位 = 4096 级） |
| 采样率 | 每秒采样次数（SPS） |
| 参考电压 | 量程上限（Pico 为 3.3V） |
| 输入范围 | 可测量的电压范围 |
| LSB | 最小可分辨电压 |

### 11.1.3 Pico ADC 特性

| 特性 | 数值 |
|------|------|
| 分辨率 | 12 位（原生），MicroPython 映射为 16 位 |
| 通道数 | 4（3 外部 + 1 内部温度） |
| 采样率 | 最高 500kSPS |
| 参考电压 | 3.3V（默认）或 ADC_VREF |
| 输入阻抗 | 约 100kΩ |

---

## 11.2 ADC 数据编码

### 11.2.1 MicroPython 数据格式

```python
from machine import ADC

adc = ADC(26)  # GP26 / ADC0

# read_u16() 返回 16 位无符号整数 (0-65535)
raw_value = adc.read_u16()

# 实际 ADC 为 12 位，高 4 位为 0，或由驱动扩展
```

### 11.2.2 电压计算

```python
def adc_to_voltage(raw, vref=3.3):
    """
    将 ADC 原始值转换为电压
    raw: read_u16() 返回值 (0-65535)
    vref: 参考电压 (默认 3.3V)
    """
    return raw * vref / 65535

# 示例
raw = adc.read_u16()
voltage = adc_to_voltage(raw)
print(f"原始值: {raw}, 电压: {voltage:.3f}V")
```

### 11.2.3 分辨率与精度

```
12 位 ADC:
- 量化级别: 2^12 = 4096
- LSB = 3.3V / 4096 ≈ 0.8mV

MicroPython 16 位映射:
- 映射级别: 2^16 = 65536
- 映射 LSB = 3.3V / 65536 ≈ 0.05mV (理论值，实际受限于 12 位硬件)
```

---

## 11.3 基础 ADC 读取

### 11.3.1 单次读取

```python
'''
实验：ADC 基础读取
接线：传感器模拟输出连接 GP26 (ADC0)
'''
from machine import ADC
import time

adc = ADC(26)

while True:
    raw = adc.read_u16()
    voltage = raw * 3.3 / 65535
    print(f"ADC: {raw:5d}  电压: {voltage:.3f}V")
    time.sleep(0.5)
```

### 11.3.2 多通道读取

```python
'''
实验：三通道 ADC 读取
'''
from machine import ADC
import time

adc0 = ADC(26)  # GP26
adc1 = ADC(27)  # GP27
adc2 = ADC(28)  # GP28

while True:
    v0 = adc0.read_u16() * 3.3 / 65535
    v1 = adc1.read_u16() * 3.3 / 65535
    v2 = adc2.read_u16() * 3.3 / 65535
    
    print(f"ADC0: {v0:.3f}V | ADC1: {v1:.3f}V | ADC2: {v2:.3f}V")
    time.sleep(0.5)
```

### 11.3.3 内部温度传感器

```python
'''
实验：读取 Pico 芯片温度
'''
from machine import ADC
import time

temp_sensor = ADC(4)  # 内部温度传感器

def read_temperature():
    """读取芯片温度"""
    raw = temp_sensor.read_u16()
    voltage = raw * 3.3 / 65535
    
    # 温度计算公式（来自 RP2040 数据手册）
    # T = 27 - (V - 0.706) / 0.001721
    temperature = 27 - (voltage - 0.706) / 0.001721
    return temperature

while True:
    temp = read_temperature()
    print(f"芯片温度: {temp:.1f}°C")
    time.sleep(1)
```

---

## 11.4 信号滤波

### 11.4.1 为什么需要滤波

ADC 采样可能受到：
- 电源噪声
- 电磁干扰
- 热噪声

滤波可以平滑信号，提高稳定性。

### 11.4.2 移动平均滤波

```python
'''
实验：移动平均滤波
'''
from machine import ADC
import time

adc = ADC(26)

class MovingAverage:
    """移动平均滤波器"""
    
    def __init__(self, size=10):
        self.size = size
        self.buffer = [0] * size
        self.index = 0
        self.sum = 0
        self.count = 0
    
    def add(self, value):
        """添加新样本"""
        self.sum -= self.buffer[self.index]
        self.buffer[self.index] = value
        self.sum += value
        self.index = (self.index + 1) % self.size
        self.count = min(self.count + 1, self.size)
        return self.get_average()
    
    def get_average(self):
        """获取平均值"""
        if self.count == 0:
            return 0
        return self.sum / self.count

# 创建滤波器（窗口大小 10）
filter = MovingAverage(10)

while True:
    raw = adc.read_u16()
    filtered = filter.add(raw)
    
    print(f"原始: {raw:5d}  滤波后: {filtered:7.1f}")
    time.sleep(0.1)
```

### 11.4.3 中值滤波

```python
def median_filter(adc, samples=5):
    """中值滤波（对脉冲噪声有效）"""
    values = [adc.read_u16() for _ in range(samples)]
    values.sort()
    return values[samples // 2]

# 使用
raw = median_filter(adc, 5)
```

### 11.4.4 指数加权移动平均 (EWMA)

```python
class EWMA:
    """指数加权移动平均"""
    
    def __init__(self, alpha=0.2):
        """alpha: 平滑因子，0 < alpha < 1，越小越平滑"""
        self.alpha = alpha
        self.value = None
    
    def add(self, new_value):
        if self.value is None:
            self.value = new_value
        else:
            self.value = self.alpha * new_value + (1 - self.alpha) * self.value
        return self.value

# 使用
ewma = EWMA(alpha=0.1)

while True:
    raw = adc.read_u16()
    filtered = ewma.add(raw)
    print(f"原始: {raw}  EWMA: {filtered:.0f}")
    time.sleep(0.05)
```

---

## 11.5 电位器模块

### 11.5.1 工作原理

旋转电位器是可变电阻：

```
    VCC ─────┬─────
             │
           ┌─┴─┐
           │   │
           │ R │  可变电阻
           │   │
           └─┬─┘
             │
    S ───────┼─────→ 到 ADC
             │
           ┌─┴─┐
           │   │
           │ R │
           │   │
           └─┬─┘
             │
    GND ─────┴─────
```

输出电压 = VCC × (旋钮位置 / 总行程)

### 11.5.2 电位器读取

```python
'''
实验：旋转电位器
接线：S 端连接 GP26 (ADC0)
'''
from machine import ADC
import time

pot = ADC(26)

def read_pot_percent():
    """读取电位器百分比位置"""
    raw = pot.read_u16()
    percent = raw / 65535 * 100
    return percent

while True:
    position = read_pot_percent()
    print(f"位置: {position:.1f}%")
    time.sleep(0.1)
```

### 11.5.3 电位器控制 LED 亮度

```python
'''
实验：电位器调节 LED 亮度
'''
from machine import ADC, Pin, PWM
import time

pot = ADC(26)
led = PWM(Pin(0))
led.freq(1000)

while True:
    # 直接用电位器值控制占空比
    duty = pot.read_u16()
    led.duty_u16(duty)
    time.sleep(0.05)
```

---

## 11.6 数据映射

### 11.6.1 线性映射函数

```python
def map_value(value, in_min, in_max, out_min, out_max):
    """
    线性映射
    将 value 从 [in_min, in_max] 映射到 [out_min, out_max]
    """
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min

# 示例：ADC (0-65535) 映射到角度 (0-180)
adc_value = adc.read_u16()
angle = map_value(adc_value, 0, 65535, 0, 180)
```

### 11.6.2 校准映射

```python
'''
实验：传感器校准
'''
def calibrated_map(value, cal_low, cal_high, out_min, out_max):
    """
    使用校准值映射
    cal_low, cal_high: 实际测量的最小/最大 ADC 值
    """
    if value < cal_low:
        value = cal_low
    if value > cal_high:
        value = cal_high
    
    return (value - cal_low) * (out_max - out_min) / (cal_high - cal_low) + out_min

# 校准步骤
print("校准：将传感器置于最小值位置，按回车")
input()
cal_min = adc.read_u16()

print("校准：将传感器置于最大值位置，按回车")
input()
cal_max = adc.read_u16()

print(f"校准值: min={cal_min}, max={cal_max}")

# 使用校准值
while True:
    raw = adc.read_u16()
    mapped = calibrated_map(raw, cal_min, cal_max, 0, 100)
    print(f"原始: {raw}  映射: {mapped:.1f}%")
    time.sleep(0.5)
```

---

## 11.7 ADC 采样优化

### 11.7.1 过采样提高分辨率

通过多次采样平均，可以提高有效分辨率：

```python
def oversampling_read(adc, oversample=16):
    """
    过采样读取
    每增加 4 倍采样，理论上增加 1 位有效分辨率
    """
    total = sum(adc.read_u16() for _ in range(oversample))
    return total // oversample

# 16 倍过采样 → 约增加 2 位有效分辨率
raw = oversampling_read(adc, 16)
```

### 11.7.2 定时采样

```python
'''
实验：固定频率采样
'''
from machine import ADC, Timer
import time

adc = ADC(26)
samples = []
SAMPLE_RATE = 100  # Hz

def sample_callback(timer):
    """定时器回调采样"""
    samples.append(adc.read_u16())

# 设置定时器
timer = Timer()
timer.init(freq=SAMPLE_RATE, callback=sample_callback)

# 采样 1 秒
time.sleep(1)
timer.deinit()

print(f"采集了 {len(samples)} 个样本")
print(f"平均值: {sum(samples) / len(samples):.0f}")
```

---

## 11.8 常见问题

### 11.8.1 ADC 值不稳定

**原因**：
- 电源噪声
- 浮空输入
- 高阻抗信号源

**解决方案**：
```python
# 1. 使用滤波
filtered = median_filter(adc, 5)

# 2. 并联电容（硬件）
# 在 ADC 输入端并联 100nF 电容

# 3. 限制输入阻抗
# 信号源阻抗不应超过 10KΩ
```

### 11.8.2 读数范围不满

```python
# 检查传感器输出范围
# 如果传感器输出 0-5V，而 ADC 只能测 0-3.3V
# 需要电阻分压:
#   5V信号 → [R1 3.3K] → ADC → [R2 5K] → GND
#   这样 5V 会被分压为 ~3V
```

---

## 11.9 本章小结

本章介绍了 ADC 原理与模拟量采集：

1. **ADC 基础**：
   - 将模拟信号转换为数字值
   - Pico 有 3 个外部 ADC 通道 + 1 个内部温度传感器
   - MicroPython 返回 16 位值（0-65535）

2. **数据编码**：
   - 电压 = raw × 3.3 / 65535
   - 支持线性映射到任意范围

3. **信号滤波**：
   - 移动平均滤波
   - 中值滤波
   - 指数加权移动平均

4. **采样优化**：
   - 过采样提高分辨率
   - 定时采样保证频率稳定

下一章将学习环境光与紫外线传感器。
