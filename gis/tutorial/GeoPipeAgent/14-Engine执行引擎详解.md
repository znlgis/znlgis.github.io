---
layout: default
title: "第14章：Engine 执行引擎详解"
---

# 第14章：Engine 执行引擎详解

> 本章深入剖析 GeoPipeAgent 执行引擎的五大核心组件：YAML 解析器（parser）、流水线校验器（validator）、执行器（executor）、上下文管理（context）和报告生成器（reporter）。这五个组件协同工作，将 YAML 流水线定义转化为可执行的空间数据处理工作流。

---

## 14.1 执行引擎概述

### 14.1.1 五大组件

执行引擎由五个核心组件构成，各司其职：

| 组件 | 模块 | 职责 |
|------|------|------|
| YAML 解析器 | `parser.py` | 将 YAML 文本解析为 `PipelineDefinition` 对象 |
| 流水线校验器 | `validator.py` | 验证流水线定义的完整性和正确性 |
| 执行器 | `executor.py` | 按顺序执行步骤，处理条件、重试和错误 |
| 上下文管理 | `context.py` | 管理变量、步骤输出和参数引用解析 |
| 报告生成器 | `reporter.py` | 生成 JSON 格式的执行报告 |

### 14.1.2 组件协作流程

```
YAML 文本
    │
    ▼
┌───────────┐
│  parser   │  parse_yaml()
│           │  _load_yaml() → _build_pipeline()
└─────┬─────┘
      │  PipelineDefinition
      ▼
┌───────────┐
│ validator │  validate_pipeline()
│           │  检查 step_id、注册表、引用
└─────┬─────┘
      │  验证通过
      ▼
┌───────────┐     ┌───────────┐
│ executor  │◀───▶│  context   │
│           │     │           │
│ 循环执行   │     │ 变量解析   │
│ 每个步骤   │     │ 输出存储   │
└─────┬─────┘     └───────────┘
      │  执行完成
      ▼
┌───────────┐
│ reporter  │  build_report()
│           │  生成 JSON 报告
└───────────┘
```

### 14.1.3 端到端执行流程

从用户调用到结果输出的完整链路：

```python
from geopipeagent.engine import parse_yaml, validate_pipeline
from geopipeagent.engine import execute_pipeline, build_report

# 1. 解析 YAML
pipeline = parse_yaml("pipeline.yaml")

# 2. 校验流水线
errors = validate_pipeline(pipeline)
if errors:
    raise ValueError(f"Validation failed: {errors}")

# 3. 执行流水线
results = execute_pipeline(pipeline)

# 4. 生成报告
report = build_report(pipeline, results)
```

---

## 14.2 YAML 解析器 parser.py

### 14.2.1 核心函数

parser.py 提供一个入口函数 `parse_yaml()`，内部调用三个辅助函数：

| 函数 | 功能 | 输入 | 输出 |
|------|------|------|------|
| `parse_yaml(source)` | 解析入口 | 文件路径或 YAML 字符串 | `PipelineDefinition` |
| `_load_yaml(source)` | 加载 YAML | 文件路径或字符串 | Python dict |
| `_build_pipeline(data)` | 构建流水线对象 | Python dict | `PipelineDefinition` |
| `_parse_step(step_data)` | 解析单个步骤 | dict | `StepDefinition` |

### 14.2.2 parse_yaml 主流程

```python
def parse_yaml(source) -> PipelineDefinition:
    """解析 YAML 文件或字符串为 PipelineDefinition

    Args:
        source: YAML 文件路径（str/Path）或 YAML 字符串

    Returns:
        PipelineDefinition: 解析后的流水线定义
    """
    data = _load_yaml(source)
    pipeline = _build_pipeline(data)
    return pipeline
```

### 14.2.3 _load_yaml 加载逻辑

```python
import yaml
from pathlib import Path

def _load_yaml(source):
    """加载 YAML 来源为 Python 字典

    支持两种输入：
    1. 文件路径 → 读取文件
    2. YAML 字符串 → 直接解析
    """
    if isinstance(source, (str, Path)):
        path = Path(source)
        if path.exists() and path.is_file():
            with open(path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)

    # 尝试作为 YAML 字符串解析
    if isinstance(source, str):
        return yaml.safe_load(source)

    raise ValueError(f"Cannot load YAML from: {source}")
```

### 14.2.4 _build_pipeline 构建流程

```python
def _build_pipeline(data: dict) -> PipelineDefinition:
    """从字典构建 PipelineDefinition 对象"""
    steps = [_parse_step(s) for s in data.get("steps", [])]

    return PipelineDefinition(
        name=data.get("name", "unnamed"),
        steps=steps,
        description=data.get("description", ""),
        crs=data.get("crs"),
        variables=data.get("variables", {}),
        outputs=data.get("outputs", {}),
    )
```

### 14.2.5 _parse_step 步骤解析

```python
def _parse_step(step_data: dict) -> StepDefinition:
    """解析单个步骤定义

    YAML 步骤格式：
        - id: buffer_roads
          step: vector.buffer       # 'step' 或 'use' 字段
          params:
            input: "$steps.read_roads"
            distance: 100
          when: "$var.enable_buffer == true"
          on_error: skip
          backend: gdal_cli
    """
    return StepDefinition(
        id=step_data["id"],
        use=step_data.get("step") or step_data.get("use"),
        params=step_data.get("params", {}),
        when=step_data.get("when"),
        on_error=step_data.get("on_error", "fail"),
        backend=step_data.get("backend"),
    )
```

### 14.2.6 YAML 到对象的映射关系

```
YAML 文件                          Python 对象
──────────                         ──────────
name: "分析流水线"        →        PipelineDefinition.name
description: "..."       →        PipelineDefinition.description
crs: "EPSG:4326"         →        PipelineDefinition.crs
variables:               →        PipelineDefinition.variables
  threshold: 100

steps:                   →        PipelineDefinition.steps (list)
  - id: step1            →          StepDefinition.id
    step: vector.buffer  →          StepDefinition.use
    params:              →          StepDefinition.params
      distance: 100
    when: "..."          →          StepDefinition.when
    on_error: skip       →          StepDefinition.on_error
    backend: gdal_cli    →          StepDefinition.backend
```

---

## 14.3 流水线校验器 validator.py

### 14.3.1 校验入口

```python
def validate_pipeline(pipeline: PipelineDefinition) -> list[str]:
    """校验流水线定义的完整性和正确性

    Args:
        pipeline: 待校验的流水线定义

    Returns:
        list[str]: 错误消息列表（空列表表示通过）
    """
    errors = []
    errors.extend(_check_step_ids(pipeline))
    errors.extend(_check_registry(pipeline))
    errors.extend(_check_references(pipeline))
    return errors
```

### 14.3.2 四项校验规则

| 校验项 | 函数 | 检查内容 | 错误示例 |
|--------|------|---------|---------|
| step_id 格式 | `_check_step_ids()` | ID 只含字母数字下划线 | `"step-1"` 包含非法字符 |
| step_id 唯一性 | `_check_step_ids()` | ID 不可重复 | `"read_data"` 出现两次 |
| 注册表验证 | `_check_registry()` | `use` 对应已注册步骤 | `"vector.unknown"` 未注册 |
| 引用验证 | `_check_references()` | `$steps.xxx` 引用合法 | `$steps.nonexistent` 不存在 |

### 14.3.3 step_id 格式与唯一性检查

```python
import re

def _check_step_ids(pipeline):
    """检查 step_id 格式和唯一性"""
    errors = []
    seen_ids = set()
    id_pattern = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

    for step in pipeline.steps:
        # 格式检查
        if not id_pattern.match(step.id):
            errors.append(
                f"Step ID '{step.id}' contains invalid characters. "
                f"Only letters, digits, and underscores are allowed."
            )

        # 唯一性检查
        if step.id in seen_ids:
            errors.append(
                f"Duplicate step ID: '{step.id}'"
            )
        seen_ids.add(step.id)

    return errors
```

合法与非法 step_id 示例：

| step_id | 合法性 | 原因 |
|---------|:-----:|------|
| `read_data` | ✅ | 字母和下划线 |
| `step1` | ✅ | 字母和数字 |
| `_private` | ✅ | 下划线开头 |
| `read-data` | ❌ | 包含连字符 |
| `1step` | ❌ | 数字开头 |
| `read data` | ❌ | 包含空格 |

### 14.3.4 注册表验证

```python
from geopipeagent.registry import get_registry

def _check_registry(pipeline):
    """检查步骤 use 字段是否在注册表中"""
    errors = []
    registry = get_registry()

    for step in pipeline.steps:
        if step.use not in registry:
            errors.append(
                f"Step '{step.id}': unknown step type '{step.use}'. "
                f"Available: {list(registry.keys())}"
            )

    return errors
```

### 14.3.5 引用验证

```python
def _check_references(pipeline):
    """检查步骤间的引用是否合法

    确保 $steps.xxx 引用的步骤 ID 存在，
    且被引用步骤在引用步骤之前定义。
    """
    errors = []
    defined_steps = set()

    for step in pipeline.steps:
        # 扫描 params 中的所有 $steps 引用
        refs = _extract_step_refs(step.params)

        for ref_id in refs:
            if ref_id not in defined_steps:
                errors.append(
                    f"Step '{step.id}': references "
                    f"'$steps.{ref_id}' which is not defined "
                    f"before this step."
                )

        defined_steps.add(step.id)

    return errors
```

引用验证确保**前向引用不存在**——步骤只能引用在自身之前定义的步骤输出：

```yaml
steps:
  - id: step_a    # ✅ 无引用
    ...
  - id: step_b
    params:
      input: "$steps.step_a"  # ✅ step_a 在 step_b 之前
  - id: step_c
    params:
      input: "$steps.step_d"  # ❌ step_d 尚未定义！
  - id: step_d
    ...
```

---

## 14.4 执行器 executor.py

### 14.4.1 execute_pipeline 完整流程

```python
def execute_pipeline(pipeline, backend_manager=None):
    """执行完整流水线

    Args:
        pipeline: PipelineDefinition 对象
        backend_manager: 可选的 BackendManager 实例

    Returns:
        dict: {step_id: StepResult} 映射
    """
    if backend_manager is None:
        backend_manager = BackendManager()

    context = PipelineContext(
        variables=pipeline.variables,
    )

    results = {}

    for step_def in pipeline.steps:
        # 1. 评估 when 条件
        if step_def.when:
            condition_met = _evaluate_condition(
                step_def.when, context
            )
            if not condition_met:
                results[step_def.id] = StepResult(
                    output=None,
                    stats={"status": "skipped", "reason": "when"},
                )
                continue

        # 2. 获取后端
        backend = backend_manager.get(
            preferred=step_def.backend or pipeline.backend
        )

        # 3. 解析参数（含 $steps 和 $var 引用）
        resolved_params = context.resolve_params(step_def.params)

        # 4. 执行步骤（含重试机制）
        try:
            result = _with_retry(
                lambda: _execute_step(
                    step_def, resolved_params, backend, context
                ),
                retries=step_def.retry or 0,
            )
        except Exception as e:
            result = _handle_error(step_def, e)

        # 5. 存储结果到上下文
        results[step_def.id] = result
        context.set_step_output(step_def.id, result)

    return results
```

### 14.4.2 _execute_step 单步执行

```python
from geopipeagent.registry import get_registry

def _execute_step(step_def, resolved_params, backend, context):
    """执行单个步骤

    Args:
        step_def: StepDefinition
        resolved_params: 已解析的参数字典
        backend: GeoBackend 实例
        context: PipelineContext

    Returns:
        StepResult
    """
    registry = get_registry()
    step_fn = registry[step_def.use]

    # 类型转换和验证
    validated_params = _validate_step_params(
        step_fn, resolved_params
    )

    # 构建 StepContext
    step_ctx = StepContext(
        params=validated_params,
        backend=backend,
    )

    # 调用步骤函数
    result = step_fn(step_ctx)

    return result
```

### 14.4.3 _with_retry 重试机制

```python
import time

def _with_retry(fn, retries=0, delay=1.0):
    """带重试的函数执行

    Args:
        fn: 待执行的函数
        retries: 最大重试次数
        delay: 重试间隔（秒）

    Returns:
        函数返回值

    Raises:
        Exception: 所有重试耗尽后的最后一次异常
    """
    last_error = None

    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            last_error = e
            if attempt < retries:
                time.sleep(delay * (attempt + 1))  # 递增延迟
                continue
            raise last_error
```

重试机制的工作流程：

```
执行 → 成功 → 返回结果
  │
  └→ 失败 → attempt < retries?
               │          │
               是          否
               │          │
               ▼          ▼
          等待 delay   抛出异常
          重试执行
```

### 14.4.4 _validate_step_params 类型转换

`_validate_step_params` 根据步骤注册信息中的参数类型声明，对用户传入的参数值进行类型转换：

```python
def _validate_step_params(step_fn, params):
    """验证并转换步骤参数类型

    YAML 解析的值可能需要类型转换：
    - "100" (str) → 100 (int)   当参数类型为 number
    - "true" (str) → True (bool) 当参数类型为 boolean
    - 100 (int) → 100.0 (float) 当参数类型为 number
    """
    step_info = step_fn.step_info  # StepInfo 元数据
    validated = {}

    for key, value in params.items():
        param_info = step_info.get_param(key)
        if param_info is None:
            validated[key] = value
            continue

        expected_type = param_info.get("type")

        if expected_type == "number" and isinstance(value, str):
            try:
                validated[key] = float(value)
            except ValueError:
                validated[key] = value
        elif expected_type == "boolean" and isinstance(value, str):
            validated[key] = value.lower() in ("true", "1", "yes")
        elif expected_type == "integer" and isinstance(value, str):
            try:
                validated[key] = int(value)
            except ValueError:
                validated[key] = value
        else:
            validated[key] = value

    return validated
```

类型转换规则表：

| 声明类型 | 输入值 | 转换后 |
|---------|--------|--------|
| `number` | `"100"` | `100.0` |
| `number` | `100` | `100` (不变) |
| `boolean` | `"true"` | `True` |
| `boolean` | `"false"` | `False` |
| `integer` | `"42"` | `42` |
| `string` | `100` | `100` (不变) |

### 14.4.5 _evaluate_condition AST 安全求值

`when` 条件表达式使用 Python AST（抽象语法树）安全求值，防止代码注入：

```python
import ast

def _evaluate_condition(expression, context):
    """安全评估 when 条件表达式

    只允许：比较、布尔运算、数字、字符串字面量
    不允许：函数调用、属性访问、导入等

    Args:
        expression: 条件表达式字符串
        context: PipelineContext（用于解析 $steps/$var 引用）

    Returns:
        bool: 条件是否满足
    """
    # 1. 替换 $steps 和 $var 引用为实际值
    resolved_expr = context.resolve(expression)

    # 2. 解析为 AST
    tree = ast.parse(resolved_expr, mode="eval")

    # 3. 安全性检查——遍历 AST 节点
    for node in ast.walk(tree):
        if isinstance(node, (ast.Call, ast.Attribute, ast.Import)):
            raise ValueError(
                f"Unsafe expression: '{expression}'. "
                f"Function calls and imports are not allowed."
            )

    # 4. 编译并执行
    code = compile(tree, "<when>", "eval")
    return bool(eval(code))
```

允许和禁止的表达式：

| 表达式 | 是否允许 | 说明 |
|--------|:-------:|------|
| `$var.threshold > 100` | ✅ | 变量比较 |
| `$steps.check.stats.error_count == 0` | ✅ | 步骤统计比较 |
| `True and False` | ✅ | 布尔运算 |
| `1 + 2 > 2` | ✅ | 算术比较 |
| `os.system("rm -rf /")` | ❌ | 函数调用 |
| `__import__("os")` | ❌ | 导入 |

### 14.4.6 _suggest_fix AI 友好建议

当步骤执行失败时，`_suggest_fix` 根据错误类型生成修复建议：

```python
def _suggest_fix(step_def, error):
    """为常见错误生成 AI 友好的修复建议

    Returns:
        str: 修复建议文本
    """
    error_msg = str(error)

    if "FileNotFoundError" in error_msg:
        return (
            f"Step '{step_def.id}': File not found. "
            f"Check the 'path' parameter and ensure "
            f"the file exists."
        )

    if "KeyError" in error_msg:
        return (
            f"Step '{step_def.id}': Column not found. "
            f"Check field names in params and ensure "
            f"they exist in the input data."
        )

    if "CRSError" in error_msg:
        return (
            f"Step '{step_def.id}': CRS error. "
            f"Ensure input data has a valid CRS or "
            f"add a reproject step before this step."
        )

    if "BackendNotAvailableError" in error_msg:
        return (
            f"Step '{step_def.id}': Backend not available. "
            f"Install the required backend or remove the "
            f"'backend' field to use the default."
        )

    return (
        f"Step '{step_def.id}' failed: {error_msg}. "
        f"Review the step parameters and input data."
    )
```

### 14.4.7 错误处理策略

`on_error` 字段控制步骤失败时的行为：

| on_error | 行为 | 适用场景 |
|----------|------|---------|
| `fail` | 终止流水线，抛出异常 | 关键步骤（默认） |
| `skip` | 跳过当前步骤，继续执行 | 可选步骤 |
| `retry` | 重试指定次数 | 网络请求等可恢复操作 |

```python
def _handle_error(step_def, error):
    """根据 on_error 策略处理步骤错误"""
    suggestion = _suggest_fix(step_def, error)

    if step_def.on_error == "skip":
        return StepResult(
            output=None,
            stats={
                "status": "skipped",
                "reason": "error",
                "error": str(error),
                "suggestion": suggestion,
            },
        )
    elif step_def.on_error == "fail":
        raise StepExecutionError(
            f"Step '{step_def.id}' failed: {error}\n"
            f"Suggestion: {suggestion}"
        ) from error
    else:
        raise error
```

---

## 14.5 上下文管理 context.py

### 14.5.1 PipelineContext 详解

`PipelineContext` 是流水线执行的全局上下文，管理变量和步骤输出：

```python
class PipelineContext:
    """流水线上下文——管理变量和步骤输出"""

    def __init__(self, variables=None):
        self.variables = variables or {}
        self._step_outputs = {}  # {step_id: StepResult}

    def set_step_output(self, step_id, result):
        """存储步骤执行结果"""
        self._step_outputs[step_id] = result

    def resolve(self, value):
        """解析字符串中的引用

        支持两种引用：
        - $var.xxx → 变量值
        - $steps.xxx → 步骤输出
        """
        if not isinstance(value, str):
            return value

        # 解析 $var 引用
        value = self._substitute_variables(value)

        # 解析 $steps 引用
        value = self._resolve_step_ref(value)

        return value

    def _substitute_variables(self, value):
        """替换 $var.xxx 引用为变量值"""
        import re
        pattern = r"\$var\.(\w+)"

        def replacer(match):
            var_name = match.group(1)
            if var_name in self.variables:
                return str(self.variables[var_name])
            raise ValueError(f"Undefined variable: {var_name}")

        return re.sub(pattern, replacer, value)

    def _resolve_step_ref(self, value):
        """解析 $steps.xxx 引用"""
        import re
        pattern = r"\$steps\.(\w+)(\.(\w+))?"

        match = re.match(pattern, value)
        if not match:
            return value

        step_id = match.group(1)
        attr = match.group(3)

        if step_id not in self._step_outputs:
            raise ValueError(
                f"Step '{step_id}' not found in context"
            )

        result = self._step_outputs[step_id]

        if attr:
            # $steps.xxx.output / $steps.xxx.stats / ...
            return getattr(result, attr)
        else:
            # $steps.xxx → 默认返回 output
            return result.output

    def resolve_params(self, params):
        """递归解析参数字典中的所有引用"""
        if isinstance(params, dict):
            return {
                k: self.resolve_params(v)
                for k, v in params.items()
            }
        elif isinstance(params, list):
            return [self.resolve_params(v) for v in params]
        elif isinstance(params, str):
            return self.resolve(params)
        else:
            return params
```

### 14.5.2 引用解析流程

```
参数解析过程：

原始参数：
  input: "$steps.read_data"
  distance: "$var.buffer_size"
  threshold: 100

      │ resolve_params()
      ▼

  "$steps.read_data"
       │ _resolve_step_ref()
       ▼
  GeoDataFrame(...)    ← 从 _step_outputs 获取

  "$var.buffer_size"
       │ _substitute_variables()
       ▼
  "500"                ← 从 variables 获取

  100
       │ 非字符串，原样返回
       ▼
  100

最终解析结果：
  input: GeoDataFrame(...)
  distance: "500"
  threshold: 100
```

### 14.5.3 StepContext 详解

`StepContext` 是单个步骤的执行上下文，提供参数访问和输入数据获取的便捷接口：

```python
class StepContext:
    """步骤执行上下文"""

    def __init__(self, params, backend=None):
        self._params = params
        self._backend = backend

    def param(self, name, default=None):
        """获取参数值

        Args:
            name: 参数名
            default: 默认值（参数不存在时返回）

        Returns:
            参数值
        """
        return self._params.get(name, default)

    def input(self, name="input"):
        """获取输入数据

        等价于 self.param(name)，语义更清晰。

        Args:
            name: 输入参数名（默认 "input"）

        Returns:
            输入数据（通常是 GeoDataFrame）
        """
        value = self._params.get(name)
        if value is None:
            raise ValueError(f"Input '{name}' is required")
        return value

    @property
    def backend(self):
        """获取后端实例"""
        return self._backend
```

### 14.5.4 步骤函数使用 StepContext 的模式

```python
@step(id="vector.buffer", ...)
def buffer(ctx: StepContext):
    # 获取输入数据
    gdf = ctx.input("input")          # 必需参数

    # 获取其他参数
    distance = ctx.param("distance")   # 必需参数
    resolution = ctx.param("resolution", 16)  # 可选参数

    # 使用后端执行操作
    result = ctx.backend.buffer(gdf, distance, resolution=resolution)

    return StepResult(output=result, stats={...})
```

---

## 14.6 报告生成器 reporter.py

### 14.6.1 build_report 函数

```python
def build_report(pipeline, results):
    """生成 JSON 格式的执行报告

    Args:
        pipeline: PipelineDefinition
        results: {step_id: StepResult} 映射

    Returns:
        dict: JSON 可序列化的报告字典
    """
    report = {
        "pipeline": pipeline.name,
        "description": pipeline.description,
        "status": _determine_status(results),
        "steps": [],
    }

    # 构建每个步骤的报告
    for step_def in pipeline.steps:
        result = results.get(step_def.id)
        step_report = {
            "id": step_def.id,
            "use": step_def.use,
            "status": result.stats.get("status", "completed")
                      if result else "not_run",
            "stats": result.stats if result else {},
        }
        report["steps"].append(step_report)

    # 构建 QC 汇总
    qc_summary = _build_qc_summary(results)
    if qc_summary:
        report["qc_summary"] = qc_summary

    return report
```

### 14.6.2 _build_qc_summary QC 汇总

```python
def _build_qc_summary(results):
    """汇总所有 QC 步骤的问题

    遍历所有步骤结果，收集 issues 列表，
    按 severity 和 rule_id 分组统计。
    """
    all_issues = []
    step_summaries = {}

    for step_id, result in results.items():
        if not hasattr(result, "issues") or not result.issues:
            continue

        issues = result.issues
        all_issues.extend(issues)

        step_summaries[step_id] = {
            "issue_count": len(issues),
            "errors": sum(
                1 for i in issues if i.severity == "error"
            ),
            "warnings": sum(
                1 for i in issues if i.severity == "warning"
            ),
        }

    if not all_issues:
        return None

    # 按 severity 分组
    by_severity = {}
    for issue in all_issues:
        by_severity.setdefault(issue.severity, 0)
        by_severity[issue.severity] += 1

    # 按 rule_id 分组
    by_rule = {}
    for issue in all_issues:
        by_rule.setdefault(issue.rule_id, 0)
        by_rule[issue.rule_id] += 1

    return {
        "total_issues": len(all_issues),
        "by_severity": by_severity,
        "by_rule": by_rule,
        "steps": step_summaries,
    }
```

### 14.6.3 报告输出示例

```json
{
  "pipeline": "土地利用数据质检",
  "description": "对土地利用矢量数据执行全链路质检",
  "status": "completed",
  "steps": [
    {
      "id": "read_parcels",
      "use": "io.read_vector",
      "status": "completed",
      "stats": {
        "feature_count": 5000,
        "format": "GPKG"
      }
    },
    {
      "id": "check_geometry",
      "use": "qc.geometry_validity",
      "status": "completed",
      "stats": {
        "feature_count": 5000,
        "issue_count": 3,
        "error_count": 3,
        "warning_count": 0
      }
    }
  ],
  "qc_summary": {
    "total_issues": 15,
    "by_severity": {
      "error": 8,
      "warning": 7
    },
    "by_rule": {
      "geometry_validity": 3,
      "attribute_completeness": 7,
      "value_range": 5
    },
    "steps": {
      "check_geometry": {
        "issue_count": 3,
        "errors": 3,
        "warnings": 0
      },
      "check_completeness": {
        "issue_count": 7,
        "errors": 7,
        "warnings": 0
      }
    }
  }
}
```

---

## 14.7 执行流程时序图

### 14.7.1 完整执行时序

```
用户           parser       validator      executor       context        步骤函数       reporter
 │               │              │              │              │              │              │
 │ parse_yaml()  │              │              │              │              │              │
 │──────────────▶│              │              │              │              │              │
 │               │ _load_yaml() │              │              │              │              │
 │               │ _build_pipe()│              │              │              │              │
 │  Pipeline     │              │              │              │              │              │
 │◀──────────────│              │              │              │              │              │
 │               │              │              │              │              │              │
 │ validate_pipeline()          │              │              │              │              │
 │─────────────────────────────▶│              │              │              │              │
 │               │    check_ids │              │              │              │              │
 │               │  check_reg   │              │              │              │              │
 │               │   check_refs │              │              │              │              │
 │  errors=[]    │              │              │              │              │              │
 │◀─────────────────────────────│              │              │              │              │
 │               │              │              │              │              │              │
 │ execute_pipeline()           │              │              │              │              │
 │─────────────────────────────────────────────▶              │              │              │
 │               │              │              │  new Context │              │              │
 │               │              │              │─────────────▶│              │              │
 │               │              │              │              │              │              │
 │               │              │   ┌──── for each step ─────────────────┐  │              │
 │               │              │   │         │              │              │              │
 │               │              │   │  eval when             │              │              │
 │               │              │   │         │ resolve_params│              │              │
 │               │              │   │         │─────────────▶│              │              │
 │               │              │   │         │  resolved     │              │              │
 │               │              │   │         │◀─────────────│              │              │
 │               │              │   │         │              │              │              │
 │               │              │   │  _execute_step()       │  step_fn()   │              │
 │               │              │   │         │──────────────────────────────▶              │
 │               │              │   │         │              │  StepResult  │              │
 │               │              │   │         │◀──────────────────────────────              │
 │               │              │   │         │              │              │              │
 │               │              │   │         │ set_output   │              │              │
 │               │              │   │         │─────────────▶│              │              │
 │               │              │   │         │              │              │              │
 │               │              │   └─────────────────────────────────────┘  │              │
 │               │              │              │              │              │              │
 │  results      │              │              │              │              │              │
 │◀────────────────────────────────────────────│              │              │              │
 │               │              │              │              │              │              │
 │ build_report()│              │              │              │              │              │
 │──────────────────────────────────────────────────────────────────────────▶│              │
 │               │              │              │              │  _qc_summary │              │
 │  JSON report  │              │              │              │              │              │
 │◀──────────────────────────────────────────────────────────────────────────│              │
 │               │              │              │              │              │              │
```

### 14.7.2 单步执行详细流程

```
executor                      context                   registry               step_fn
    │                            │                         │                      │
    │  resolve_params(params)    │                         │                      │
    │───────────────────────────▶│                         │                      │
    │                            │ resolve("$steps.xxx")   │                      │
    │                            │ resolve("$var.yyy")     │                      │
    │  resolved_params           │                         │                      │
    │◀───────────────────────────│                         │                      │
    │                            │                         │                      │
    │  registry[step.use]        │                         │                      │
    │──────────────────────────────────────────────────────▶│                      │
    │  step_fn                   │                         │                      │
    │◀──────────────────────────────────────────────────────│                      │
    │                            │                         │                      │
    │  _validate_step_params()   │                         │                      │
    │  (类型转换)                 │                         │                      │
    │                            │                         │                      │
    │  StepContext(params, backend)                         │                      │
    │─────────────────────────────────────────────────────────────────────────────▶│
    │                            │                         │         step_fn(ctx) │
    │  StepResult                │                         │                      │
    │◀─────────────────────────────────────────────────────────────────────────────│
    │                            │                         │                      │
    │  context.set_step_output() │                         │                      │
    │───────────────────────────▶│                         │                      │
    │                            │                         │                      │
```

---

## 14.8 本章小结

本章详细介绍了 GeoPipeAgent 执行引擎的五大核心组件：

**1. parser.py（YAML 解析器）：**
- `parse_yaml()` → `_load_yaml()` → `_build_pipeline()` → `_parse_step()`
- 支持文件路径和 YAML 字符串两种输入
- 将 YAML 映射为 `PipelineDefinition` 和 `StepDefinition` 对象

**2. validator.py（流水线校验器）：**
- `validate_pipeline()` 执行四项校验：step_id 格式、step_id 唯一性、注册表存在性、步骤引用合法性
- 确保前向引用不存在——步骤只能引用在自身之前定义的步骤

**3. executor.py（执行器）：**
- `execute_pipeline()` 循环执行每个步骤，处理 `when` 条件、`on_error` 策略和重试机制
- `_evaluate_condition()` 使用 AST 安全求值，防止代码注入
- `_validate_step_params()` 进行类型转换，确保参数类型正确
- `_suggest_fix()` 为常见错误生成 AI 友好的修复建议

**4. context.py（上下文管理）：**
- `PipelineContext` 管理全局变量和步骤输出，提供 `resolve()` 方法解析 `$var` 和 `$steps` 引用
- `StepContext` 为步骤函数提供 `param()` 和 `input()` 便捷接口
- `resolve_params()` 递归解析嵌套参数中的所有引用

**5. reporter.py（报告生成器）：**
- `build_report()` 生成 JSON 格式的完整执行报告
- `_build_qc_summary()` 汇总所有 QC 步骤的问题，按 severity 和 rule_id 分组统计

这五个组件通过清晰的职责划分和数据传递构成了 GeoPipeAgent 的执行核心，将声明式 YAML 流水线转化为可靠的空间数据处理工作流。

---

[下一章：数据模型与类型系统 →](15-数据模型与类型系统.md)
