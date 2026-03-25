---
layout: default
title: Engine执行引擎详解
---

# 第十二章：Engine 执行引擎详解

## 12.1 概述

Engine（引擎）是 GeoPipeAgent 的核心处理层，负责从 YAML 解析到结果输出的完整执行流程。引擎由六个子模块组成：

```
engine/
├── parser.py      # YAML 解析器
├── validator.py   # 流水线验证器
├── resolver.py    # 参数解析入口
├── context.py     # 执行上下文
├── executor.py    # 步骤执行器
└── reporter.py    # 报告生成器
```

## 12.2 Parser — YAML 解析器

### 12.2.1 入口函数

```python
def parse_yaml(source: str | Path) -> PipelineDefinition:
    """Parse a YAML pipeline file or string."""
```

`parse_yaml` 接受两种输入：
- **文件路径**：如 `"pipeline.yaml"` 或 `Path("pipeline.yaml")`
- **YAML 字符串**：直接传入 YAML 文本

### 12.2.2 解析流程

```
输入 (文件路径或字符串)
    │
    ▼ _load_yaml()
原始 dict
    │
    ▼ _build_pipeline()
PipelineDefinition
```

**_load_yaml() 的智能检测：**

```python
def _load_yaml(source):
    path = Path(source)
    if path.exists() and path.is_file():
        # 作为文件路径处理
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
    else:
        # 作为 YAML 字符串处理
        data = yaml.safe_load(source)
```

### 12.2.3 错误处理

解析器会在以下情况抛出 `PipelineParseError`：

| 错误情况 | 错误信息 |
|---------|---------|
| YAML 语法错误 | `Invalid YAML: ...` |
| 顶层不是映射 | `Pipeline YAML must be a mapping with a 'pipeline' key` |
| 缺少 pipeline 键 | `Missing 'pipeline' key at the top level` |
| steps 不是列表 | `'pipeline.steps' must be a non-empty list` |
| 步骤缺少 id | `Step X is missing required 'id' field` |
| 步骤缺少 use | `Step 'xxx' is missing required 'use' field` |

## 12.3 Validator — 流水线验证器

### 12.3.1 入口函数

```python
def validate_pipeline(pipeline: PipelineDefinition) -> list[str]:
    """Validate a parsed pipeline. Returns warnings."""
```

验证器在执行前检查流水线的合法性，返回警告列表（非致命），对于致命错误抛出 `PipelineValidationError`。

### 12.3.2 验证内容

#### 1. step_id 格式检查

```python
_VALID_STEP_ID = re.compile(r"^[a-z0-9_-]+$")

if not _VALID_STEP_ID.match(step.id):
    raise PipelineValidationError(
        f"Step id '{step.id}' is invalid. "
        f"step_id must match [a-z0-9_-] (no dots allowed)."
    )
```

#### 2. step_id 唯一性检查

```python
if step.id in seen_ids:
    raise PipelineValidationError(f"Duplicate step id '{step.id}'.")
```

#### 3. 步骤注册表检查

```python
if not registry.has(step.use):
    raise PipelineValidationError(
        f"Step '{step.id}' uses '{step.use}' which is not registered."
    )
```

#### 4. 参数引用递归检查

验证器会递归检查嵌套在 dict 和 list 中的引用：

```python
def _validate_value_refs(step_id, key, value, available_outputs, variables):
    if isinstance(value, dict):
        for k, v in value.items():
            _validate_value_refs(step_id, f"{key}.{k}", v, ...)
    if isinstance(value, list):
        for i, v in enumerate(value):
            _validate_value_refs(step_id, f"{key}[{i}]", v, ...)
    # 检查步骤引用和变量引用
```

错误信息中包含完整的键路径，如 `options.input` 或 `layers[0]`。

#### 5. on_error 值检查

```python
if step.on_error not in ("fail", "skip", "retry"):
    raise PipelineValidationError(...)
```

#### 6. 输出引用检查

```python
for key, ref in pipeline.outputs.items():
    if isinstance(ref, str) and ref.startswith("$"):
        step_id = ref[1:].split(".")[0]
        if step_id not in seen_ids:
            raise PipelineValidationError(...)
```

## 12.4 Resolver — 参数解析器

### 12.4.1 功能

Resolver 是一个薄层封装，将参数解析委托给 PipelineContext：

```python
def resolve_step_params(pipeline, step_index, context) -> dict:
    step = pipeline.steps[step_index]
    return context.resolve_params(step.params)
```

### 12.4.2 解析规则

| 参数值格式 | 解析行为 | 示例 |
|-----------|---------|------|
| `$step.attr` | 获取步骤属性 | `$read.output` → GeoDataFrame |
| `${var}` | 替换变量（保持类型） | `${count}` → 100 |
| `text${var}text` | 字符串内嵌替换 | `data/${name}.shp` → `data/roads.shp` |
| 嵌套 dict | 递归解析 | `{a: $read.output}` |
| 列表 | 逐元素解析 | `[$a.output, $b.output]` |
| 纯值 | 原样返回 | `500` → `500` |

## 12.5 Context — 执行上下文

### 12.5.1 PipelineContext

`PipelineContext` 是流水线执行的全局状态容器：

```python
class PipelineContext:
    def __init__(self, variables=None):
        self.variables = dict(variables or {})
        self._step_outputs = {}  # step_id → StepResult
```

核心功能：

| 方法 | 说明 |
|------|------|
| `set_output(step_id, result)` | 存储步骤执行结果 |
| `get_output(step_id)` | 获取步骤执行结果 |
| `resolve(value)` | 解析单个值 |
| `resolve_params(params)` | 递归解析参数字典 |

### 12.5.2 引用解析详解

**步骤引用 `$step_id.attr`**：

```python
def _resolve_step_ref(self, ref):
    ref_body = ref[1:]               # 去掉 $
    step_id, attr = ref_body.split(".", 1)
    result = self._step_outputs[step_id]
    return getattr(result, attr)      # 使用 __getattr__
```

**变量替换 `${var}`**：

```python
def _substitute_variables(self, text):
    # 完整变量引用 → 保持原始类型
    match = re.fullmatch(r"\$\{(\w+)\}", text)
    if match:
        return self.variables[match.group(1)]

    # 嵌入式替换 → 字符串
    return re.sub(r"\$\{(\w+)\}", replace_func, text)
```

### 12.5.3 StepContext

`StepContext` 是传递给步骤函数的参数容器：

```python
class StepContext:
    def __init__(self, params, backend=None, pipeline_context=None):
        self._params = params
        self.backend = backend
        self.pipeline_context = pipeline_context
```

## 12.6 Executor — 步骤执行器

### 12.6.1 主执行函数

```python
def execute_pipeline(pipeline: PipelineDefinition) -> dict:
    context = PipelineContext(variables=pipeline.variables)
    registry = StepRegistry()
    backend_manager = BackendManager()
    step_reports = []

    for step_def in pipeline.steps:
        # 1. 条件执行检查
        # 2. 执行步骤（含重试逻辑）
        # 3. 记录结果
        ...

    return build_report(...)
```

### 12.6.2 条件执行（when）

```python
if step_def.when:
    if not _evaluate_condition(step_def.when, context):
        step_report["status"] = "skipped"
        context.set_output(step_def.id, StepResult())  # 空结果
        continue
```

跳过的步骤仍然存储一个空的 `StepResult`，这样后续步骤可以引用它而不会出错。

### 12.6.3 条件表达式安全评估

`_evaluate_condition` 使用 AST 白名单保证安全：

```python
def _evaluate_condition(condition, context):
    # 1. 替换 ${var} 和 $step.attr
    resolved = condition
    resolved = re.sub(r"\$\{(\w+)\}", replace_var, resolved)
    resolved = re.sub(r"\$(\w+)\.(\w+)", replace_ref, resolved)

    # 2. AST 验证
    tree = ast.parse(resolved, mode="eval")
    _SAFE_NODES = (
        ast.Expression, ast.Compare, ast.BoolOp, ast.UnaryOp,
        ast.BinOp, ast.Constant, ast.Name, ast.Load,
        ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
        ast.And, ast.Or, ast.Not, ...
    )
    for node in ast.walk(tree):
        if not isinstance(node, _SAFE_NODES):
            return False  # 不安全的表达式返回 False

    # 3. 安全 eval
    return bool(eval(
        compile(tree, "<when>", "eval"),
        {"__builtins__": {}}, {},
    ))
```

### 12.6.4 重试机制

当 `on_error="retry"` 时，步骤最多重试 3 次：

```python
_MAX_RETRIES = 3

def _execute_step_with_retry(step_def, ...):
    max_attempts = _MAX_RETRIES if step_def.on_error == "retry" else 1

    for attempt in range(1, max_attempts + 1):
        try:
            # 执行步骤
            ...
            return  # 成功
        except Exception as e:
            if attempt < max_attempts:
                time.sleep(0.5 * attempt)  # 退避
            else:
                raise
```

### 12.6.5 步骤执行细节

每个步骤的执行包含以下步骤：

```python
# 1. 解析参数
resolved_params = resolve_step_params(pipeline, step_index, context)

# 2. 查找步骤信息
step_info = registry.get(step_def.use)

# 3. 选择后端（IO 步骤不需要后端）
backend = None
if step_info.category not in ("io",):
    backend = backend_manager.get(step_def.backend)

# 4. 构建 StepContext
step_ctx = StepContext(
    params=resolved_params,
    backend=backend,
    pipeline_context=context,
)

# 5. 执行步骤函数
result = step_info.func(step_ctx)

# 6. 存储结果
context.set_output(step_def.id, result)
```

### 12.6.6 AI 友好修复建议

执行器内置了一个简单的修复建议生成器：

```python
def _suggest_fix(step_use, error):
    msg = str(error).lower()
    if "crs" in msg and ("mismatch" in msg or "degree" in msg):
        return "Add a vector.reproject step before this step."
    if "file not found" in msg or "no such file" in msg:
        return "Check that the input file path is correct."
    if "permission" in msg:
        return "Check file permissions for the input/output paths."
    return None
```

## 12.7 Reporter — 报告生成器

### 12.7.1 报告结构

```python
def build_report(pipeline_name, status, duration, step_reports, outputs):
    return {
        "pipeline": pipeline_name,
        "status": status,              # "success" 或 "error"
        "duration_seconds": duration,   # 总执行时间
        "steps": step_reports,          # 各步骤报告
        "outputs": outputs,             # 流水线输出
    }
```

### 12.7.2 步骤报告格式

每个步骤的报告包含：

```json
{
  "id": "buffer",
  "step": "vector.buffer",
  "status": "success",
  "duration": 0.523,
  "output_summary": {
    "feature_count": 100,
    "crs": "EPSG:3857",
    "geometry_types": ["Polygon"],
    "total_area": 12345.67
  }
}
```

可能的状态值：

| status | 说明 |
|--------|------|
| `success` | 步骤执行成功 |
| `error` | 步骤执行失败 |
| `skipped` | 步骤被跳过（when 条件不满足或 on_error=skip） |

附加字段：

| 字段 | 条件 | 说明 |
|------|------|------|
| `retries` | 重试成功时 | 重试次数 |
| `skip_reason` | when 跳过时 | 跳过原因 |
| `error` | 失败时 | 错误信息 |

## 12.8 执行引擎完整流程图

```
geopipe-agent run pipeline.yaml --var key=value
    │
    ▼
1. CLI 层
    ├── setup_logging()
    ├── load_builtin_steps()           # 加载所有步骤
    ├── parse_yaml("pipeline.yaml")    # 解析 YAML
    ├── 应用 --var 覆盖               # 修改 variables
    ├── validate_pipeline(pipeline)    # 验证
    └── execute_pipeline(pipeline)     # 执行
         │
         ├── 创建 PipelineContext
         ├── 创建 BackendManager
         │
         ├── 对每个步骤:
         │    ├── 检查 when 条件
         │    ├── resolve_step_params()
         │    ├── registry.get() → 查找步骤
         │    ├── backend_manager.get() → 选择后端
         │    ├── StepContext(params, backend)
         │    ├── step_info.func(ctx) → 执行
         │    ├── context.set_output()
         │    └── 记录 step_report
         │
         └── build_report() → JSON
              │
              ▼
         输出到 stdout
```
