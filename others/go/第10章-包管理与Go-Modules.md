---
layout: default
title: 第10章 - 包管理与Go Modules
---

# 第10章 - 包管理与Go Modules

良好的依赖管理是工程化的基础。本章讲解 Go 的包（package）概念、可见性规则，以及现代 Go 依赖管理标准——Go Modules 的完整使用方法。

## 10.1 包的概念

包是 Go 代码组织和复用的基本单位。每个 Go 源文件都属于一个包，同一目录下的所有 `.go` 文件必须声明同一个包名。

- **`main` 包**：特殊的包，编译后生成可执行文件，必须包含 `main` 函数。
- **库包**：其他名称的包，编译后供其他包导入使用。

```go
package utils // 声明当前文件属于 utils 包
```

## 10.2 标识符可见性

Go 通过**标识符首字母的大小写**控制可见性，无需 `public`/`private` 关键字：

- **首字母大写**：导出的（exported），对包外可见，相当于 public。
- **首字母小写**：未导出的（unexported），仅包内可见，相当于 private。

```go
package account

type Account struct {
    Balance float64 // 导出字段，包外可访问
    pin     string  // 未导出字段，仅包内可访问
}

func New() *Account { return &Account{} } // 导出函数
func validate() bool { return true }      // 未导出函数
```

这一规则适用于变量、常量、函数、类型、结构体字段和方法。

## 10.3 导入包

```go
import (
    "fmt"                          // 标准库
    "strings"

    "github.com/gin-gonic/gin"     // 第三方库
    "example.com/myproject/utils"  // 本项目其他包
)
```

### 10.3.1 导入的特殊形式

```go
import (
    f "fmt"           // 别名导入，用 f 代替 fmt
    . "math"          // 点导入，可省略包名直接用（不推荐）
    _ "github.com/lib/pq" // 空白导入，仅执行包的 init 函数，不直接使用
)
```

空白导入常用于注册数据库驱动等需要触发 `init` 副作用的场景。

## 10.4 init 函数

每个包可以有一个或多个 `init` 函数，它在包被导入时**自动执行**，且在 `main` 函数之前。执行顺序为：先初始化被导入的包，再执行包级变量初始化，最后执行 `init`：

```go
func init() {
    // 初始化逻辑，如注册、配置加载、连接建立
}
```

> `init` 函数不能被显式调用，没有参数和返回值。应避免在 init 中放置复杂逻辑或可能失败的操作。

## 10.5 Go Modules 简介

Go Modules 是 Go 1.11 引入、1.16 起成为默认的官方依赖管理方案。一个 module 是一组相关包的集合，由根目录下的 `go.mod` 文件定义。Modules 解决了旧 GOPATH 模式下的依赖版本管理难题，支持语义化版本、可重现构建。

## 10.6 创建与初始化模块

```bash
# 初始化模块，module-path 通常是仓库地址
go mod init github.com/username/myproject
```

执行后生成 `go.mod` 文件：

```
module github.com/username/myproject

go 1.22
```

- `module`：模块的导入路径。
- `go`：项目使用的 Go 语言版本。

## 10.7 添加与管理依赖

### 10.7.1 添加依赖

直接在代码中 `import` 需要的包，然后运行：

```bash
go mod tidy   # 自动分析代码，添加缺失的依赖，移除未使用的依赖
```

或显式获取：

```bash
go get github.com/gin-gonic/gin           # 获取最新版本
go get github.com/gin-gonic/gin@v1.9.1    # 指定版本
go get github.com/gin-gonic/gin@latest    # 最新发布版
go get -u ./...                            # 升级所有依赖到最新次要版本
```

### 10.7.2 go.mod 文件详解

```
module github.com/username/myproject

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/stretchr/testify v1.8.4
)

require (
    // 间接依赖（依赖的依赖）标记为 // indirect
    github.com/bytedance/sonic v1.9.1 // indirect
)
```

- `require`：声明直接和间接依赖及其版本。
- `replace`：替换某个依赖的来源（常用于本地开发或 fork）。
- `exclude`：排除特定版本。

```
// 将依赖替换为本地路径，便于联调
replace github.com/example/lib => ../lib
```

### 10.7.3 go.sum 文件

`go.sum` 记录每个依赖模块的加密哈希值，用于**校验依赖完整性**，确保每次下载的依赖内容一致，防止依赖被篡改。该文件应提交到版本控制。

## 10.8 语义化版本

Go Modules 遵循语义化版本规范 `vMAJOR.MINOR.PATCH`：

- **MAJOR**：不兼容的 API 变更。
- **MINOR**：向后兼容的功能新增。
- **PATCH**：向后兼容的 bug 修复。

### 10.8.1 主版本号语义导入

当主版本号 ≥ 2 时，模块路径必须包含版本后缀：

```go
import "github.com/example/lib/v2"
```

这允许同一个项目中并存某个库的 v1 和 v2 版本。

## 10.9 常用 module 命令

| 命令 | 作用 |
|------|------|
| `go mod init` | 初始化新模块 |
| `go mod tidy` | 整理依赖，增删对齐代码实际使用 |
| `go mod download` | 下载依赖到本地缓存 |
| `go mod verify` | 校验依赖是否被篡改 |
| `go mod graph` | 打印依赖关系图 |
| `go mod why <pkg>` | 解释为什么需要某个依赖 |
| `go mod vendor` | 将依赖复制到项目 vendor 目录 |
| `go list -m all` | 列出所有依赖模块 |

## 10.10 依赖缓存与代理

下载的依赖会缓存在 `$GOPATH/pkg/mod` 目录，多个项目共享。`GOPROXY` 环境变量控制依赖下载源：

```bash
go env -w GOPROXY=https://goproxy.cn,direct
```

`direct` 表示对于代理无法提供的模块，直接从源仓库下载。`GOSUMDB` 控制校验和数据库，`GOPRIVATE` 用于声明私有模块（跳过代理和校验）：

```bash
go env -w GOPRIVATE=*.corp.example.com
```

## 10.11 vendor 模式

`go mod vendor` 会将所有依赖复制到项目根目录的 `vendor` 文件夹。启用 vendor 后，构建时使用本地副本而非缓存，适合需要离线构建、依赖审计或锁定依赖快照的场景：

```bash
go mod vendor
go build -mod=vendor  # 使用 vendor 目录构建（有 vendor 时默认启用）
```

## 10.12 工作区模式 workspace（Go 1.18+）

当需要同时开发多个相互依赖的模块时，工作区模式（`go.work`）比 `replace` 更方便：

```bash
go work init ./moduleA ./moduleB
```

生成的 `go.work` 文件让多个本地模块协同开发，无需修改各自的 `go.mod`。

## 10.13 项目目录结构推荐

Go 社区有一套被广泛采用的项目布局约定：

```
myproject/
├── go.mod
├── go.sum
├── cmd/                  # 各可执行程序的 main 包
│   └── server/
│       └── main.go
├── internal/            # 私有代码，禁止外部模块导入
│   ├── service/
│   └── repository/
├── pkg/                 # 可被外部复用的公共库代码
├── api/                 # API 定义（protobuf、OpenAPI 等）
├── configs/             # 配置文件
├── test/                # 额外的测试数据和工具
└── README.md
```

### internal 目录的特殊规则

`internal` 是 Go 工具链识别的特殊目录：其中的包**只能被其父目录所在的模块导入**，外部模块无法导入。这是 Go 强制实现封装、隐藏实现细节的机制。

## 10.14 本章小结

本章讲解了 Go 的包机制与现代依赖管理。包通过首字母大小写控制可见性，`init` 函数完成包初始化。Go Modules 是官方的依赖管理标准，通过 `go.mod` 声明依赖、`go.sum` 保证完整性，配合 `go mod tidy`、`go get` 等命令管理依赖。合理的项目目录结构（cmd/internal/pkg）和 GOPROXY 代理配置，是构建可维护 Go 工程的基础。

下一章我们将系统学习 Go 标准库。
