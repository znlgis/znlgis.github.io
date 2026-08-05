---
layout: default
title: 第九章：Releases 与源码映射
---

# 第九章：Releases 与源码映射

## 目录

- [9.1 Release 概念与重要性](#91-release-概念与重要性)
  - [9.1.1 什么是 Release](#911-什么是-release)
  - [9.1.2 Release 的核心价值](#912-release-的核心价值)
  - [9.1.3 数据模型深度解析](#913-数据模型深度解析)
- [9.2 Release 创建方式](#92-release-创建方式)
  - [9.2.1 SDK 自动创建](#921-sdk-自动创建)
  - [9.2.2 CLI 命令行创建](#922-cli-命令行创建)
  - [9.2.3 API 创建](#923-api-创建)
  - [9.2.4 自动创建的控制机制](#924-自动创建的控制机制)
- [9.3 Commit 关联与 Suspect Commits](#93-commit-关联与-suspect-commits)
  - [9.3.1 数据模型](#931-数据模型)
  - [9.3.2 仓库集成（GitHub/GitLab）](#932-仓库集成githubgitlab)
  - [9.3.3 set_commits：显式提交列表](#933-set_commits显式提交列表)
  - [9.3.4 set_refs：引用式提交关联](#934-set_refs引用式提交关联)
  - [9.3.5 Suspect Commits 与问题归属](#935-suspect-commits-与问题归属)
- [9.4 Deploy 部署追踪](#94-deploy-部署追踪)
  - [9.4.1 Deploy 数据模型](#941-deploy-数据模型)
  - [9.4.2 部署创建流程](#942-部署创建流程)
  - [9.4.3 部署通知机制](#943-部署通知机制)
  - [9.4.4 环境关联](#944-环境关联)
- [9.5 Source Maps 源码映射](#95-source-maps-源码映射)
  - [9.5.1 为什么需要 Source Maps](#951-为什么需要-source-maps)
  - [9.5.2 Source Map 文件格式](#952-source-map-文件格式)
  - [9.5.3 Source Maps 在 Sentry 中的处理](#953-source-maps-在-sentry-中的处理)
  - [9.5.4 调试符号文件（Debug Information Files）](#954-调试符号文件debug-information-files)
- [9.6 Source Maps 上传流程](#96-source-maps-上传流程)
  - [9.6.1 sentry-cli 上传](#961-sentry-cli-上传)
  - [9.6.2 Webpack Plugin 上传](#962-webpack-plugin-上传)
  - [9.6.3 Vite Plugin 上传](#963-vite-plugin-上传)
  - [9.6.4 直接 API 上传](#964-直接-api-上传)
- [9.7 Artifact Bundles](#97-artifact-bundles)
  - [9.7.1 Artifact Bundles 数据模型](#971-artifact-bundles-数据模型)
  - [9.7.2 Bundle 的上传与索引](#972-bundle-的上传与索引)
  - [9.7.3 Release 与 Bundle 的关联](#973-release-与-bundle-的关联)
  - [9.7.4 与传统 Release Files 的对比](#974-与传统-release-files-的对比)
- [9.8 Release 健康度](#98-release-健康度)
  - [9.8.1 Session 统计模型](#981-session-统计模型)
  - [9.8.2 Crash-free Rate（无崩溃率）](#982-crash-free-rate无崩溃率)
  - [9.8.3 Release Adoption（版本采纳率）](#983-release-adoption版本采纳率)
  - [9.8.4 Release Stages（版本阶段）](#984-release-stages版本阶段)
  - [9.8.5 Release Threshold（版本阈值告警）](#985-release-threshold版本阈值告警)
- [9.9 Release 对比与回归检测](#99-release-对比与回归检测)
  - [9.9.1 版本对比机制](#991-版本对比机制)
  - [9.9.2 回归检测原理](#992-回归检测原理)
  - [9.9.3 SemVer 智能排序](#993-semver-智能排序)
- [9.10 Release 归档与管理](#910-release-归档与管理)
  - [9.10.1 Release 状态管理](#9101-release-状态管理)
  - [9.10.2 Release 合并](#9102-release-合并)
  - [9.10.3 Release 安全删除](#9103-release-安全删除)
  - [9.10.4 未使用 Release 的清理](#9104-未使用-release-的清理)

---

## 9.1 Release 概念与重要性

### 9.1.1 什么是 Release

在 Sentry 的体系中，**Release（版本）** 是一个组织级别的核心概念，它代表应用的一次发布或部署。每一次代码变更被推送到生产环境，都应该对应一个唯一的 Release 标识。Release 是连接代码变更与运行时错误的关键纽带，没有 Release 信息，错误监控就失去了一半的诊断价值。

从 `src/sentry/models/release.py:208` 可以看到 Release 模型的 Docstring 定义：

```python
@cell_silo_model
class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.

    A commit is generally a git commit. See also releasecommit.py
    """
```

核心要点：**Release 的粒度由你决定**。它可以是一个语义化版本号（如 `myapp@1.2.3`）、一个 Git Commit SHA（如 `a3f8b9c`）、一个构建号（如 `20240805.1`），或任何你团队约定的版本标识。唯一强制约束是：**同一个 Organization 内的 version 字段必须唯一**，这由数据库层的 unique 约束保证：

```python
class Meta:
    app_label = "sentry"
    db_table = "sentry_release"
    unique_together = (("organization", "version"),)
```

### 9.1.2 Release 的核心价值

Release 在 Sentry 的 Issue 全生命周期中扮演着至关重要的角色，其价值体现为以下几个维度：

| 维度 | 说明 | 涉及的核心机制 |
|---|---|---|
| **版本追踪** | 将每一个错误事件关联到具体的发布版本，快速定位引入问题的版本 | `Event.release` -> `Group.first_release` -> `GroupRelease` |
| **问题归属** | 当一个 Issue 首次出现时，Sentry 记录 `first_release`，明确问题由哪个版本首次引入 | `Group.first_release` 外键 |
| **回归检测** | 如果一个问题在某个版本被标记为已解决（Resolved），但在后续版本再次出现，系统自动将其状态回退为 Regressed | `GroupResolution.release` 结合 `GroupRelease` 的时间比较 |
| **Suspect Commits** | 通过 Release 关联的 Commit 列表，在有新 Issue 出现时自动推荐最可能的嫌疑提交 | `ReleaseCommit` + `ReleaseHeadCommit` |
| **部署追踪** | 记录每次部署的目标环境、起止时间，关联部署通知 | `Deploy` + `ReleaseProjectEnvironment` |
| **健康度监控** | 追踪每个版本的会话数据、崩溃率、用户采纳情况，在版本质量下降时发出告警 | Session 指标聚合 + `ReleaseProjectEnvironment.adopted/unadopted` |
| **Source Maps** | 将混淆/压缩后的前端代码还原为可读的原始代码，离不开 Release 和 Distribution 的标识 | `ArtifactBundle` + `ReleaseArtifactBundle` |

以 `first_release` 为例，当一个 Issue 首次出现时，Sentry 会将当前触发事件的 Release 记录为 `Group.first_release`字段。这个信息在 Issue 详情页中直接可见，让开发者可以立即知道：这个问题是从哪个版本开始出现的。

### 9.1.3 数据模型深度解析

Release 模型的设计充分考虑了版本管理的多方面需求。以下是其在 `sentry_release` 数据库表中的完整字段结构：

**核心标识字段：**

```python
organization = FlexibleForeignKey("sentry.Organization")
projects = models.ManyToManyField(
    "sentry.Project", related_name="releases", through=ReleaseProject
)
version = models.CharField(max_length=DB_VERSION_LENGTH)  # DB_VERSION_LENGTH = 250
ref = models.CharField(max_length=DB_VERSION_LENGTH, null=True, blank=True)  # 分支名
url = models.URLField(null=True, blank=True)  # 发布链接
```

**时间与状态字段：**

```python
date_added = models.DateTimeField(default=timezone.now, db_index=True)
date_started = models.DateTimeField(null=True, blank=True)  # 已废弃
date_released = models.DateTimeField(null=True, blank=True)
status = BoundedPositiveIntegerField(
    default=ReleaseStatus.OPEN,  # 0=Open, 1=Archived
    null=True,
)
```

`ReleaseStatus` 是一个简洁的枚举（`src/sentry/models/release.py:61`）：

```python
class ReleaseStatus:
    OPEN = 0      # 活跃状态
    ARCHIVED = 1  # 已归档
```

**物料化统计字段（Materialized Stats）：**

为了查询性能，Release 表冗余存储了一些统计数据：

```python
commit_count = BoundedPositiveIntegerField(null=True, default=0)
last_commit_id = BoundedBigIntegerField(null=True)
authors = ArrayField(models.TextField(), default=list, null=True)
total_deploys = BoundedPositiveIntegerField(null=True, default=0)
last_deploy_id = BoundedPositiveIntegerField(null=True)
```

这些字段在 `set_commits` 或 `create_deploy` 等操作时同步更新，避免了关联查询的开销。

**SemVer（语义化版本）列：**

Sentry 对版本号有深度理解。如果版本号符合 SemVer 规范，系统会将其自动解析存入以下反范式化列（`src/sentry/models/release.py:253`）：

```python
# <package>@<major>.<minor>.<patch>.<revision>-<prerelease>+<build_code>
package = models.TextField(null=True)
major = models.BigIntegerField(null=True)
minor = models.BigIntegerField(null=True)
patch = models.BigIntegerField(null=True)
revision = models.BigIntegerField(null=True)
prerelease = models.TextField(null=True)
build_code = models.TextField(null=True)
build_number = models.BigIntegerField(null=True)
```

这些列的填充由 Relay 的 Rust 库 `sentry_relay.processing.parse_release` 完成（`src/sentry/models/release.py:546`）：

```python
@cached_property
def version_info(self):
    try:
        return parse_release(self.version, json_loads=orjson.loads)
    except RelayError:
        return None
```

**SemVer 智能排序：**

Sentry 对 SemVer 版本有专门的索引用以支持高效排序。以下是 `sentry_release_semver_idx` 索引定义（`src/sentry/models/release.py:299`）：

```python
models.Index(
    "organization",
    F("major").desc(),
    F("minor").desc(),
    F("patch").desc(),
    F("revision").desc(),
    Case(When(prerelease="", then=1), default=0).desc(),
    F("prerelease").desc(),
    name="sentry_release_semver_idx",
)
```

这个索引的精妙之处在于 `prerelease` 的处理：正式版本 `prerelease=""` 在排序中权重为 1，而预发布版本（如 `alpha`、`beta`）权重为 0，确保 `1.0.0` 永远排在 `1.0.0-beta` 之前。

**版本有效性校验：**

`Release.is_valid_version` 静态方法（`src/sentry/models/release.py:348`）定义了合法的版本号规则：

```python
@staticmethod
def is_valid_version(value):
    if value is None:
        return False
    if any(c in value for c in BAD_RELEASE_CHARS):
        return False
    value_stripped = str(value).strip()
    return not (
        not value_stripped
        or value_stripped in (".", "..")
        or value_stripped.lower() == "latest"
    )
```

`BAD_RELEASE_CHARS` 常量来自 `sentry.constants`，包含 `\n`、`\r`、`\t`、`\f` 等控制字符。另外 `"latest"`、`"."`、`".."` 被保留，不能用做版本号。

---

## 9.2 Release 创建方式

### 9.2.1 SDK 自动创建

SDK 自动创建是最常见的 Release 创建方式。当你在应用中初始化 Sentry SDK 并指定 `release` 选项后，SDK 上报的每一个事件、Transaction、Session 数据中都会携带该 release 值。Sentry 服务端在接收到数据后，如果发现某个 release 版本号尚不存在，会自动创建对应的 Release 记录。

以 Python SDK 为例：

```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://examplePublicKey@o0.ingest.sentry.io/0",
    release="myapp@1.2.3",
    environment="production",
)
```

以 JavaScript SDK 为例：

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
  release: "myapp@1.2.3",
  environment: "production",
});
```

服务端的处理逻辑位于 `Release.get_or_create` 方法（`src/sentry/models/release.py:458`）。这是一个高度优化的方法，其核心流程如下：

```
get_or_create(project, version, date_added)
  |
  v
检查缓存 (cache_key: "release:3:{org_id}:{version_hash}")
  |
  ├─[缓存命中] -> 直接返回
  |
  └─[缓存未命中]
      |
      v
    检查是否存在 (project-version 或 version)
      |
      ├─[存在] -> 关联到项目，返回
      |
      └─[不存在 & auto_create=True]
          |
          v
        创建新 Release (含 IntegrityError 处理)
          |
          v
        调用 release.add_project(project)
          |
          v
        更新缓存 (TTL 1小时)
```

关键代码片段：

```python
@classmethod
def _get_or_create_impl(cls, project, version, date_added, metric_tags, create=True):
    cache_key = cls.get_cache_key(project.organization_id, version)
    release = cache.get(cache_key)

    if release in (None, -1):
        project_version = (f"{project.slug}-{version}")[:DB_VERSION_LENGTH]
        releases = list(
            cls.objects.filter(
                organization_id=project.organization_id,
                version__in=[version, project_version],
                projects=project,
            )
        )

        if releases:
            # 已存在：优先匹配 project-version，其次匹配 version
            try:
                release = [r for r in releases if r.version == project_version][0]
            except IndexError:
                release = releases[0]
        elif not create:
            # 自动创建被禁用：仅关联已有的组织级 Release
            release = cls.objects.filter(
                organization_id=project.organization_id,
                version__in=[version, project_version],
            ).first()
            if release is None:
                return None
            release.add_project(project)
        else:
            # 创建新 Release
            try:
                with atomic_transaction(using=router.db_for_write(cls)):
                    release = cls.objects.create(
                        organization_id=project.organization_id,
                        version=version,
                        date_added=date_added,
                        total_deploys=0,
                    )
            except IntegrityError:
                release = cls.objects.get(
                    organization_id=project.organization_id, version=version
                )
            release.add_project(project)
```

版本号的一个特殊处理逻辑是：Sentry 会尝试查找 `{project.slug}-{version}` 格式的版本。这是为了兼容早期 SDK 实现中，某些 SDK 会在版本号前自动追加项目标识。如果同时存在 `myapp@1.2.3` 和 `myservice-myapp@1.2.3`，系统会优先匹配带项目前缀的版本。

### 9.2.2 CLI 命令行创建

Sentry CLI（`sentry-cli`）提供了完整的 Release 管理命令集。CLI 不仅负责创建 Release，还承担着上传 Source Maps、关联 Commits、创建 Deploy 等核心职责。

**安装 sentry-cli：**

```bash
# npm 全局安装
npm install -g @sentry/cli

# 或通过 brew (macOS)
brew install getsentry/tools/sentry-cli

# 或直接下载二进制
curl -sL https://sentry.io/get-cli/ | bash
```

**创建 Release：**

```bash
# 基础创建
sentry-cli releases new myapp@1.2.3

# 创建并指定项目
sentry-cli releases new -p my-project myapp@1.2.3

# 创建最终版本（立即标记为已发布）
sentry-cli releases new --finalize myapp@1.2.3
```

**关联 Commit：**

```bash
# 自动从 Git 历史推断 Commits
sentry-cli releases set-commits --auto myapp@1.2.3

# 手动指定 Commit 范围
sentry-cli releases set-commits myapp@1.2.3 --commit "owner/repo@abc123..def456"
```

**创建 Deploy：**

```bash
sentry-cli releases deploys myapp@1.2.3 new -e production
```

**上传 Source Maps：**

```bash
sentry-cli releases files myapp@1.2.3 upload-sourcemaps ./dist \
  --url-prefix "~/static/js" \
  --validate
```

### 9.2.3 API 创建

Sentry 提供了完整的 REST API。创建 Release 的 API 端点定义在 `src/sentry/api/endpoints/organization_releases.py:333` 的 `OrganizationReleasesEndpoint` 中。

**API 创建示例：**

```http
POST /api/0/organizations/{organization_id_or_slug}/releases/
Content-Type: application/json
Authorization: Bearer {auth_token}

{
    "version": "myapp@1.2.3",
    "ref": "refs/heads/main",
    "url": "https://github.com/myorg/myapp/releases/tag/v1.2.3",
    "projects": ["my-project"],
    "dateReleased": "2024-08-05T10:00:00Z",
    "commits": [
        {
            "patch_set": [
                {
                    "path": "src/main.py",
                    "type": "M"
                }
            ],
            "repository": "myorg/myapp",
            "author_name": "Zhang San",
            "author_email": "zhangsan@example.com",
            "timestamp": "2024-08-05T09:30:00Z",
            "message": "fix: resolve null pointer issue",
            "id": "abc123def456"
        }
    ],
    "refs": [
        {
            "repository": "myorg/myapp",
            "commit": "abc123def456",
            "previousCommit": "789012abc345"
        }
    ]
}
```

**幂等性设计：**

API 创建 Release 的关键特性是**幂等性**。从 POST handler 代码可以看到（`src/sentry/api/endpoints/organization_releases.py:830`）：

```python
# release creation is idempotent to simplify user experiences
created = False
try:
    release, created = Release.objects.get_or_create(
        organization_id=organization.id,
        version=result["version"],
        defaults={
            "ref": result.get("ref"),
            "url": result.get("url"),
            "owner_id": owner_id,
            "date_released": result.get("dateReleased"),
            "status": new_status or ReleaseStatus.OPEN,
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:256],
        },
    )
except IntegrityError:
    raise ConflictError(
        "Could not create the release it conflicts with existing data",
    )
```

如果 Release 已经存在且没有新增项目关联，API 返回状态码 **208 Already Reported**（而非 201 Created），遵循 RFC 5842（WebDAV）规范，表达"数据已存在但无冲突"的语义：

```python
if not created and not new_releaseprojects:
    status = 208
else:
    status = 201
```

**查询 Release 列表：**

```http
GET /api/0/organizations/{org_slug}/releases/?query=1.2&sort=date&status=open
```

查询支持多种排序方式（`src/sentry/api/endpoints/organization_releases.py:479`）：

| sort 参数 | 排序逻辑 | 说明 |
|---|---|---|
| `date` | 按 `date_added` 降序 | 默认排序，最近创建的在前 |
| `build` | 按 `build_number` 降序 | 需要版本号为 SemVer 带 build_code |
| `semver` | 按 `major, minor, patch, revision, prerelease` 降序 | 完整语义化版本排序 |
| `adoption` | 按 `ReleaseProjectEnvironment.adopted` 降序 | 最近被采纳的版本在前 |
| `crash_free_sessions` | 按 Session 崩溃率排序 | 需要 `flatten=1` |
| `crash_free_users` | 按用户崩溃率排序 | 需要 `flatten=1` |

### 9.2.4 自动创建的控制机制

Release 的自动创建并非无条件触发。Sentry 通过功能开关（Feature Flag）和项目级选项双重控制这一行为，代码位于 `src/sentry/releases/auto_creation.py`：

```python
def should_auto_create_releases(project: Project) -> bool:
    return not features.has("organizations:auto-release-creation", project.organization) or bool(
        project.get_option("sentry:enable_auto_release_creation")
    )
```

逻辑解读：
- **默认行为**：如果组织没有开启 `organizations:auto-release-creation` 功能标志，自动创建是开启的（返回 `True`）。
- **精细控制**：一旦组织开启该功能标志（SaaS 企业版特性），则进一步检查项目级选项 `sentry:enable_auto_release_creation` 决定是否允许自动创建。
- **禁用后的行为**：当自动创建被禁用时，`Release.get_or_create(project, version, create=False)` 仅会关联已存在的组织级 Release，但不会从遥测数据中**创建**新 Release。这意味着如果 Release 不是通过 CLI 或 API 预先创建的，相关事件将无法关联到 Release。

---

## 9.3 Commit 关联与 Suspect Commits

### 9.3.1 数据模型

Sentry 通过三张数据库表来维护 Release 与 Commit 之间的关系：

**ReleaseCommit（`src/sentry/models/releasecommit.py`）：**

```python
@cell_silo_model
class ReleaseCommit(Model):
    organization_id = BoundedBigIntegerField(db_index=True)
    release = FlexibleForeignKey("sentry.Release")
    commit = FlexibleForeignKey("sentry.Commit", db_constraint=False)
    order = BoundedPositiveIntegerField()

    class Meta:
        db_table = "sentry_releasecommit"
        unique_together = (("release", "commit"), ("release", "order"))
```

`order` 字段允许按提交的时间顺序排列，`unique_together` 保证同一 Release 不会出现重复 Commit 和顺序冲突。

**ReleaseHeadCommit（`src/sentry/models/releaseheadcommit.py`）：**

```python
@cell_silo_model
class ReleaseHeadCommit(Model):
    organization_id = BoundedBigIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()
    release = FlexibleForeignKey("sentry.Release")
    commit = FlexibleForeignKey("sentry.Commit", db_constraint=False)

    class Meta:
        db_table = "sentry_releaseheadcommit"
        unique_together = (("repository_id", "release"),)
```

`ReleaseHeadCommit` 记录的是每个仓库在该 Release 中的 HEAD commit（即最新的提交点），这是计算 "上一个 Release 到当前 Release 之间新增的 Commits" 的依据。

**Release 表的冗余字段：**

```python
commit_count = BoundedPositiveIntegerField(null=True, default=0)
last_commit_id = BoundedBigIntegerField(null=True)
authors = ArrayField(models.TextField(), default=list, null=True)
```

这三个字段是 `ReleaseCommit` 的物料化聚合结果，使得在 Release 列表页显示 Commit 数量、最后 Commit 和作者列表时，不需要执行额外的 JOIN 查询。

### 9.3.2 仓库集成（GitHub/GitLab）

要让 Suspect Commits 功能运作，首先需要在 Sentry 中配置代码仓库。Sentry 支持通过集成（Integration）对接以下平台：

- **GitHub** / **GitHub Enterprise**
- **GitLab** / **GitLab Self-Managed**
- **Bitbucket** / **Bitbucket Server**
- **Azure DevOps**

配置完成后，Sentry 会通过 API 同步仓库的 Commit 数据，建立 `Repository` -> `Commit` -> `CommitAuthor` 的完整链条。

### 9.3.3 set_commits：显式提交列表

`Release.set_commits` 方法（`src/sentry/models/release.py:690`）接收一个完整的 Commit 列表，将其直接绑定到 Release：

```python
@trace
def set_commits(self, commit_list):
    """
    Bind a list of commits to this release.
    This will clear any existing commit log and replace it with the given commits.
    """
    from sentry.models.releases.set_commits import set_commits
    set_commits(self, commit_list)
```

Commit 列表中的每个条目包含以下字段：

```json
{
    "patch_set": [
        {"path": "src/utils/helper.py", "type": "M"},
        {"path": "src/api/views.py", "type": "A"}
    ],
    "repository": "myorg/myapp",
    "author_name": "Zhang San",
    "author_email": "zhangsan@example.com",
    "timestamp": "2024-08-05T09:30:00Z",
    "message": "fix: resolve null pointer issue",
    "id": "abc123def456"
}
```

### 9.3.4 set_refs：引用式提交关联

`set_refs` 方法（`src/sentry/models/release.py:647`）是一种更高级的 Commit 关联方式。它不要求你提供完整的 Commit 列表，而是告诉 Sentry "这个 Release 对应哪些仓库的哪些 HEAD commit"：

```python
def set_refs(self, refs, user_id, fetch=False):
    with start_span(op="set_refs", name="set_refs"):
        from sentry.models.releaseheadcommit import ReleaseHeadCommit
        from sentry.models.repository import Repository
        from sentry.tasks.commits import fetch_commits

        names = {r["repository"] for r in refs}
        repos = list(
            Repository.objects.filter(organization_id=self.organization_id, name__in=names)
        )
        repos_by_name = {r.name: r for r in repos}
        invalid_repos = names - set(repos_by_name.keys())
        if invalid_repos:
            raise InvalidRepository(f"Invalid repository names: {','.join(invalid_repos)}")

        self.handle_commit_ranges(refs)

        for ref in refs:
            repo = repos_by_name[ref["repository"]]
            commit = Commit.objects.get_or_create(
                organization_id=self.organization_id,
                repository_id=repo.id, key=ref["commit"]
            )[0]
            ReleaseHeadCommit.objects.update_or_create(
                organization_id=self.organization_id,
                repository_id=repo.id,
                release=self,
                defaults={"commit": commit},
            )

        if fetch:
            prev_release = get_previous_release(self)
            fetch_commits.apply_async(
                kwargs={
                    "release_id": self.id,
                    "user_id": user_id,
                    "refs": refs,
                    "prev_release_id": prev_release and prev_release.id,
                }
            )
```

当 `fetch=True` 时，Sentry 会通过 Celery 异步任务 `fetch_commits` 去调用 GitHub/GitLab 等平台的 API，根据当前版本与上一版本的 HEAD commit 之间的差异，自动拉取完整的 Commit 列表。这个机制的巧妙之处在于：

1. 你只需要提供仓库名和 HEAD commit SHA（两个字段）
2. Sentry 自己去做 git log 区间查询，拉取所有新增 Commits
3. 异步任务完成后，`ReleaseHeadCommit` 表保留下一次 "区间对比" 的起点

`handle_commit_ranges` 方法还支持一个便捷的输入格式：使用 `..` 作为范围分隔符（如 `previous_sha..current_sha`）：

```python
def handle_commit_ranges(self, refs):
    for ref in refs:
        if COMMIT_RANGE_DELIMITER in ref["commit"]:
            ref["previousCommit"], ref["commit"] = ref["commit"].split(COMMIT_RANGE_DELIMITER)
```

### 9.3.5 Suspect Commits 与问题归属

当一个新的 Issue 首次出现时，Sentry 会自动分析关联的所有 Release 的 Commit 列表，通过 `patch_set` 中涉及的修改文件路径与异常堆栈中的文件路径进行匹配，推断最可能的 **Suspect Commit**（嫌疑提交）。

匹配逻辑的基本思路：
1. 收集当前 Release 中所有 Commits 的 `patch_set`（变更文件列表）
2. 取出异常堆栈中出现过的源文件路径
3. 计算交集——如果一个 Commit 修改过的文件在异常堆栈中出现，它就是潜在的嫌疑人
4. 根据 Commit 的时间戳（越新的嫌疑越大）和修改的重叠度给出加权评分

Suspect Commits 在 Issue 详情页中展示，帮助开发者快速定位问题来源。同时，`Group.first_release` 记录了问题**首次出现**的 Release，使得排查范围可以限定在"上一个 Release 到当前 Release 之间"的 Commit 集合，大幅缩小怀疑范围。

---

## 9.4 Deploy 部署追踪

### 9.4.1 Deploy 数据模型

Deploy 模型（`src/sentry/models/deploy.py:19`）记录每次部署的详细信息：

```python
@cell_silo_model
class Deploy(Model):
    organization_id = BoundedBigIntegerField(db_index=True)
    release = FlexibleForeignKey("sentry.Release")
    environment_id = BoundedPositiveIntegerField(db_index=True)
    date_finished = models.DateTimeField(default=timezone.now, db_index=True)
    date_started = models.DateTimeField(null=True, blank=True)
    name = models.CharField(max_length=64, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    notified = models.BooleanField(null=True, db_index=True, default=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_deploy"
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `release` | FK -> Release | 关联的发布版本 |
| `environment_id` | int | 部署的目标环境 ID（如 production、staging） |
| `date_started` | datetime | 部署开始时间，可为空 |
| `date_finished` | datetime | 部署完成时间，默认当前时间 |
| `name` | varchar(64) | 部署名称（可选），如 "canary-deploy-v2" |
| `url` | URL | 部署详情链接（如 CI/CD Pipeline URL） |
| `notified` | bool | 是否已发送部署通知 |

每次创建 Deploy 时，Release 表上的 `total_deploys` 和 `last_deploy_id` 也会同步更新（`src/sentry/releases/endpoints/release_deploys.py:123`）：

```python
Release.objects.filter(id=release.id).update(
    total_deploys=F("total_deploys") + 1, last_deploy_id=deploy.id
)
```

### 9.4.2 部署创建流程

Deploy 的创建由 `create_deploy` 函数处理（`src/sentry/releases/endpoints/release_deploys.py:90`）：

```python
def create_deploy(organization, release, serializer):
    result = serializer.validated_data
    release_projects = list(release.projects.all())
    projects = result.get("projects", release_projects)

    # 验证项目有效性
    invalid_projects = {project.slug for project in projects} - {
        project.slug for project in release_projects
    }
    if len(invalid_projects) > 0:
        raise ParameterValidationError(
            f"Invalid projects ({', '.join(invalid_projects)}) for release {release.version}"
        )

    # 获取或创建环境
    env = Environment.objects.get_or_create(
        name=result["environment"], organization_id=organization.id
    )[0]
    for project in projects:
        env.add_project(project)

    # 创建 Deploy 记录
    deploy = Deploy.objects.create(
        organization_id=organization.id,
        release=release,
        environment_id=env.id,
        date_finished=result.get("dateFinished", timezone.now()),
        date_started=result.get("dateStarted"),
        name=result.get("name"),
        url=result.get("url"),
    )
    deploy_created.send_robust(deploy=deploy, sender=create_deploy)

    # 更新 Release 统计
    Release.objects.filter(id=release.id).update(
        total_deploys=F("total_deploys") + 1, last_deploy_id=deploy.id
    )

    # 更新 ReleaseProjectEnvironment
    for project in projects:
        ReleaseProjectEnvironment.objects.update_or_create(
            release=release,
            environment=env,
            project=project,
            defaults={"last_deploy_id": deploy.id},
        )

    # 触发通知
    Deploy.notify_if_ready(deploy.id)

    return deploy
```

这个流程体现了几个设计要点：
1. **环境自动创建**：如果目标环境不存在，`get_or_create` 自动创建。
2. **信号分发**：`deploy_created.send_robust` 确保所有监听器都能收到通知，即使某个处理器出错也不影响。
3. **多项目支持**：同一个 Release 可以部署到多个项目，但 Deploy 记录只有一条。
4. **ReleaseProjectEnvironment 同步**：记录每个项目-环境组合的 `last_deploy_id`。

### 9.4.3 部署通知机制

`Deploy.notify_if_ready` 方法（`src/sentry/models/deploy.py:40`）负责在合适的时机发送部署通知：

```python
@classmethod
def notify_if_ready(cls, deploy_id, fetch_complete=False):
    lock_key = cls.get_lock_key(deploy_id)
    lock = locks.get(lock_key, duration=30, name="deploy_notify")
    with TimedRetryPolicy(10)(lock.acquire):
        deploy = cls.objects.filter(id=deploy_id).select_related("release").get()
        if deploy.notified:
            return

        release = deploy.release
        environment = Environment.objects.get(
            organization_id=deploy.organization_id, id=deploy.environment_id
        )

        if not fetch_complete:
            release_has_commits = ReleaseCommit.objects.filter(
                organization_id=release.organization_id, release=release
            ).exists()

            if not release_has_commits:
                if ReleaseHeadCommit.objects.filter(
                    organization_id=release.organization_id, release=release
                ).exists():
                    return  # 等待 fetch_commits 完成

        # 为每个项目创建 Activity 并发送通知
        activity = None
        for project in deploy.release.projects.all():
            activity = Activity.objects.create(
                type=ActivityType.DEPLOY.value,
                project=project,
                ident=Activity.get_version_ident(release.version),
                data={
                    "version": release.version,
                    "deploy_id": deploy.id,
                    "environment": environment.name,
                },
                datetime=deploy.date_finished,
            )
        if activity is not None:
            activity.send_notification()
            deploy.update(notified=True)
```

这个机制有一个**延迟发送**的设计：如果 Release 配置了 `ReleaseHeadCommit` 但 Commit 列表还未拉取完成（`ReleaseCommit` 尚为空），通知将被推迟。这确保部署通知中能包含完整的 Commit 信息。`fetch_complete=True` 参数由 `fetch_commits` 异步任务在完成后回调传入，触发"现在可以发通知了"的信号。

### 9.4.4 环境关联

Sentry 的环境（Environment）概念与 Deploy 紧密配合。每个 Environment 是组织级别的实体，可以关联到多个 Project。核心的关联表是：

**ReleaseEnvironment（`src/sentry/models/releaseenvironment.py`）：**

```python
@cell_silo_model
class ReleaseEnvironment(Model):
    organization = FlexibleForeignKey("sentry.Organization")
    release = FlexibleForeignKey("sentry.Release")
    environment = FlexibleForeignKey("sentry.Environment")
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "sentry_environmentrelease"
        unique_together = (("organization", "release", "environment"),)
```

这个表的 `get_or_create` 方法会在每次环境-版本-项目的事件首次出现时创建记录，并持续更新 `last_seen` 时间戳。

**ReleaseProjectEnvironment（`src/sentry/models/releaseprojectenvironment.py`）：**

```python
@cell_silo_model
class ReleaseProjectEnvironment(Model):
    release = FlexibleForeignKey("sentry.Release")
    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey("sentry.Environment")
    new_issues_count = BoundedPositiveIntegerField(default=0)
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    last_deploy_id = BoundedPositiveIntegerField(null=True, db_index=True)
    adopted = models.DateTimeField(null=True, blank=True)
    unadopted = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "sentry_releaseprojectenvironment"
        unique_together = (("project", "release", "environment"),)
```

`adopted` 和 `unadopted` 时间戳字段是版本采纳追踪的关键，将在 9.8.3 节详述。

---

## 9.5 Source Maps 源码映射

### 9.5.1 为什么需要 Source Maps

现代前端工程的构建流程通常会经历以下步骤：

```
TypeScript/ES6+ 源码
    |  (编译/转译)
    v
打包后的 bundle.js（含 Webpack/Vite 的模块包装代码）
    |  (压缩/混淆)
    v
bundle.min.js（变量名被缩短、空白被移除、代码完全不可读）
```

当生产环境中 `bundle.min.js` 抛出异常时，Sentry 捕获到的堆栈信息可能是这样的：

```
TypeError: Cannot read properties of undefined (reading 'map')
  at e.value (bundle.min.js:1:23456)
  at t.render (bundle.min.js:1:12345)
  at n.componentDidMount (bundle.min.js:1:34567)
```

这种堆栈对排查问题**几乎毫无帮助**——函数名 `e`、`t`、`n` 是压缩器生成的，行号 `1` 是因为代码都在同一行，列号无法对应到源码。

**Source Map** 的作用就是建立压缩代码与原始源码之间的映射关系。它是一个 JSON 文件，记录着"压缩后文件的第 1 行第 23456 列，对应原始文件 `src/components/MapView.tsx` 的第 42 行第 10 列"这样的映射信息。当 Sentry 获取到 Source Map 后，就能将不可读的压缩堆栈**反向解析**为可读的原始堆栈：

```
TypeError: Cannot read properties of undefined (reading 'map')
  at MapView.calculateCenter (src/components/MapView.tsx:42:10)
  at MapView.render (src/components/MapView.tsx:18:5)
  at App.componentDidMount (src/App.tsx:15:22)
```

### 9.5.2 Source Map 文件格式

Source Map 文件遵循 Source Map Revision 3 规范。一个典型的 `.map` 文件结构如下：

```json
{
  "version": 3,
  "file": "bundle.min.js",
  "sourceRoot": "",
  "sources": [
    "webpack://myapp/src/components/MapView.tsx",
    "webpack://myapp/src/utils/geo.ts",
    "webpack://myapp/node_modules/lodash/map.js"
  ],
  "sourcesContent": [
    "import { LatLng } from './types';\n\nclass MapView {\n  calculateCenter...",
    "export function calculateDistance(a: LatLng, b: LatLng): number {\n  ...",
    null
  ],
  "names": ["MapView", "calculateCenter", "LatLng", "a", "b"],
  "mappings": "AAAA,SAASA,GAAT;AACA,SAASC,eAAT;AACA,OAAOC,KAAP;;AAEA,MAAMC,OAAN,SAAsBD,KAAtB,CAA4B;..."
}
```

关键字段说明：

| 字段 | 说明 |
|---|---|
| `version` | Source Map 规范版本，恒为 3 |
| `sources` | 原始源文件的路径列表（通常以 `webpack://` 或 `~/` 为前缀） |
| `sourcesContent` | 可选，原始源文件的内容。如果嵌入了此字段，Sentry 无需访问你的源码仓库即可展示完整代码 |
| `names` | 原始变量名和方法名列表 |
| `mappings` | 核心字段，Base64 VLQ 编码的位置映射数据 |
| `sourceRoot` | 可选，sources 字段的公共前缀 |

`mappings` 字段是 Source Map 的精髓。它使用 **VLQ（Variable-Length Quantity）编码** 对位置信息进行高效压缩，包含五元组信息：

```
(生成文件的列, 源文件索引, 源文件行号, 源文件列号, 名称索引)
```

### 9.5.3 Source Maps 在 Sentry 中的处理

当 Sentry 收到一个包含压缩堆栈的 JavaScript 事件后，处理流程如下：

```
JavaScript Error Event
  |  (提取 stacktrace)
  v
识别压缩文件名 (bundle.min.js)
  |  (从 abs_path 中提取 URL)
  v
查找 Artifact Bundle
  |  (通过 url + release + dist 匹配 ArtifactBundleIndex)
  v
下载 Source Map 文件
  |  (从 File Storage 中读取)
  v
符号化 (Symbolication)
  |  (使用 symbolicator 服务解析 mappings 字段)
  v
生成原始堆栈
  |  (包含原始文件名、行号、列号、函数名)
  v
展示在 Issue 详情页
```

Sentry 的 Source Map 处理在服务端定义了明确的文件类型枚举（`src/sentry/models/artifactbundle.py:31`）：

```python
class SourceFileType(Enum):
    SOURCE = 1              # 原始源文件
    MINIFIED_SOURCE = 2     # 压缩后的源文件（bundle.min.js）
    SOURCE_MAP = 3          # Source Map 映射文件（bundle.min.js.map）
    INDEXED_RAM_BUNDLE = 4  # React Native 的 RAM Bundle 格式
```

这个枚举说明 Sentry 不仅处理标准的 Source Map，还支持 React Native 的 RAM Bundle 格式。RAM Bundle 是一种将 JS Bundle 按模块拆分并建立索引的格式，React Native 使用它来优化启动性能。

### 9.5.4 调试符号文件（Debug Information Files）

Source Maps 主要服务于 JavaScript/TypeScript 前端项目。对于原生应用（iOS、Android、Native C/C++），Sentry 支持另一种形式的符号映射——**调试符号文件（Debug Information Files / Debug Symbols）**。

| 平台 | 调试符号格式 | 说明 |
|---|---|---|
| iOS | dSYM | Xcode 编译时生成的调试符号包，包含函数名、文件名到地址的映射 |
| Android | ProGuard Mapping + Native Debug Symbols | ProGuard/R8 提供 Java 混淆映射；NDK 生成的 `.so` 文件需要保留调试符号 |
| Windows | PDB (Program Database) | Microsoft 的调试符号格式 |
| Linux | ELF with debug info (DWARF) | GCC/Clang 编译时使用 `-g` 参数嵌入的 DWARF 调试信息 |

sentry-cli 为不同平台提供了对应的上传命令：

```bash
# iOS dSYM 上传
sentry-cli upload-dsym ./MyApp.app.dSYM

# Android ProGuard 映射上传
sentry-cli upload-proguard ./app/build/outputs/mapping/release/mapping.txt

# 通用调试信息文件上传
sentry-cli debug-files upload ./libnative.so
```

**Debug ID 机制：**

Sentry 使用 Debug ID（通常是一个 UUID）来精确匹配崩溃报告中的模块与已上传的调试符号文件。这个机制对于原生崩溃的符号化至关重要：

1. 构建工具在编译时计算目标文件的 Debug ID，将其嵌入到生成的可执行文件/库中
2. 上传调试符号时，Sentry 同时记录该 Debug ID
3. 客户端崩溃后，SDK 上报崩溃地址和模块的 Debug ID
4. Sentry 的 Symbolicator 服务根据 Debug ID 精确查找对应的调试符号文件，进行地址到源码的映射

---

## 9.6 Source Maps 上传流程

### 9.6.1 sentry-cli 上传

sentry-cli 是最灵活、最通用的 Source Map 上传方式。它通过 `releases files upload-sourcemaps` 子命令完成上传。

**基础用法：**

```bash
sentry-cli releases files myapp@1.2.3 upload-sourcemaps ./dist \
  --url-prefix "~/static/js" \
  --validate
```

**核心参数：**

| 参数 | 说明 | 示例 |
|---|---|---|
| `--url-prefix` | 指定 JS 文件在服务器上的 URL 前缀，用于匹配运行时加载路径 | `~/static/js`、`https://cdn.example.com/js` |
| `--url-suffix` | 指定 URL 后缀，用于过滤上传文件 | `.js` |
| `--validate` | 上传后自动验证 Source Map 的有效性 | |
| `--ext` | 指定上传的文件扩展名列表 | `js`, `map`, `jsbundle` |
| `--dist` | 指定 Distribution 名称，用于多部署场景 | `android-arm64`, `web-prod` |
| `--rewrite` | 将 Source Map 中的 `sources` 重写为匹配 `url-prefix` | |
| `--strip-prefix` | 从上传文件的路径中剥离前缀 | `~/dist` |
| `--strip-common-prefix` | 自动剥离最长的公共前缀 | |
| `--no-sourcemap-reference` | 不从 minified 文件中自动检测 Source Map 引用 | |

**完整 CI/CD 示例：**

```bash
#!/bin/bash
# 构建项目
npm run build

# 创建 Release
sentry-cli releases new "myapp@${VERSION}"

# 关联 Commits
sentry-cli releases set-commits --auto "myapp@${VERSION}"

# 上传 Source Maps
sentry-cli releases files "myapp@${VERSION}" upload-sourcemaps ./dist \
  --url-prefix "~/static/js" \
  --validate \
  --rewrite

# 标记最终发布
sentry-cli releases finalize "myapp@${VERSION}"

# 记录部署
sentry-cli releases deploys "myapp@${VERSION}" new -e production
```

### 9.6.2 Webpack Plugin 上传

`@sentry/webpack-plugin` 将 Source Map 上传集成到 Webpack 构建流程中，在构建完成后自动上传。

**安装：**

```bash
npm install --save-dev @sentry/webpack-plugin
```

**配置（webpack.config.js）：**

```javascript
const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");

module.exports = {
  devtool: "source-map", // 必须生成 Source Map
  output: {
    // 确保文件名包含 hash 或 contenthash
    filename: "[name].[contenthash].js",
  },
  plugins: [
    sentryWebpackPlugin({
      // 认证信息
      org: "my-org",
      project: "my-project",
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Release 配置
      release: {
        name: process.env.RELEASE_VERSION,
        // 自动创建 Release（如果还不存在）
        injectReleaseInfo: true,
      },

      // Source Map 配置
      sourcemaps: {
        filesToDeleteAfterUpload: "**/*.js.map", // 上传后删除 .map 文件
      },
    }),
  ],
};
```

**工作原理：**

1. Webpack 构建完成，`devtool: "source-map"` 为每个 JS bundle 生成独立的 `.map` 文件
2. `sentryWebpackPlugin` 扫描输出目录，收集所有 `.js` 和 `.js.map` 文件
3. 对每个 JS 文件，插件计算其 URL 路径（基于 `output.publicPath` 和文件名）
4. 将 `.js.map` 文件及其关联的 `.js` 文件打包上传到 Sentry
5. （可选）上传后自动删除 `.js.map` 文件，防止泄漏到生产环境

### 9.6.3 Vite Plugin 上传

`@sentry/vite-plugin` 与 Webpack Plugin 类似，但适配 Vite 的构建体系。

**安装：**

```bash
npm install --save-dev @sentry/vite-plugin
```

**配置（vite.config.ts）：**

```typescript
import { defineConfig } from "vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  build: {
    sourcemap: true, // 必须生成 Source Map
  },
  plugins: [
    sentryVitePlugin({
      org: "my-org",
      project: "my-project",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.RELEASE_VERSION,
        injectReleaseInfo: true,
      },
      sourcemaps: {
        filesToDeleteAfterUpload: ["**/*.js.map", "**/*.mjs.map"],
        // 删除 .map 文件前的 glob 匹配模式
      },
    }),
  ],
});
```

**Vite Plugin 的特殊处理：**

Vite 默认使用 Rollup 作为打包器，其 Source Map 生成方式与 Webpack 有所不同。Vite Plugin 在处理时：

1. 自动识别 Vite 的输出目录结构（通常是 `dist/assets/`）
2. 处理 `import.meta.url` 生成的动态 chunk
3. 支持 `.mjs`、`.cjs` 等多种模块格式的 Source Map
4. 自动处理 Vite 的 CSS 代码分割（CSS Source Maps）

**Next.js Plugin 上传：**

对于 Next.js 项目，推荐使用 `@sentry/nextjs` SDK，它内置了 Source Map 上传功能：

```javascript
// next.config.js
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  // 你的 Next.js 配置
};

module.exports = withSentryConfig(nextConfig, {
  org: "my-org",
  project: "my-project",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: false,
});
```

`withSentryConfig` 在 `next build` 之后会自动：
1. 创建或更新 Sentry Release
2. 上传生成的 Source Maps
3. 删除 `.map` 文件防止泄漏
4. 如果是 Vercel 部署，将 Release 信息注入到构建输出中

### 9.6.4 直接 API 上传

Sentry 也提供了底层的 API 用于上传 Release 文件：

**上传单个文件：**

```http
POST /api/0/projects/{organization_slug}/{project_slug}/releases/{version}/files/
Content-Type: multipart/form-data
Authorization: Bearer {auth_token}

file: app.min.js.map
name: ~/static/js/app.min.js.map
```

**创建 Release 并批量关联文件：**

```http
POST /api/0/organizations/{org_slug}/releases/
Content-Type: application/json

{
    "version": "myapp@1.2.3",
    "projects": ["my-project"],
    "files": [
        {
            "name": "~/static/js/app.min.js",
            "file": "base64_encoded_content..."
        },
        {
            "name": "~/static/js/app.min.js.map",
            "file": "base64_encoded_content..."
        }
    ]
}
```

**组装式上传（Chunked Upload）：**

对于较大的 Source Map 文件或 Artifact Bundle，Sentry 支持分片上传：

```http
# 第一步：初始化组装任务
POST /api/0/projects/{org_slug}/{project_slug}/releases/{version}/assemble/
Content-Type: application/json

{
    "checksum": "sha256_of_bundle_file",
    "chunks": 3
}

# 第二步：上传各分片
POST /api/0/projects/{org_slug}/{project_slug}/releases/{version}/assemble/{checksum}/
```

---

## 9.7 Artifact Bundles

### 9.7.1 Artifact Bundles 数据模型

Artifact Bundles 是 Sentry 在 2022 年引入的新一代制品管理机制，旨在替代早期的单个文件上传方式。其数据模型定义在 `src/sentry/models/artifactbundle.py`：

**ArtifactBundle 主表：**

```python
@cell_silo_model
class ArtifactBundle(Model):
    organization_id = BoundedBigIntegerField(db_index=True)
    bundle_id = models.UUIDField(default=NULL_UUID, db_index=True)
    file = FlexibleForeignKey("sentry.File")
    artifact_count = BoundedPositiveIntegerField()
    indexing_state = models.IntegerField(
        default=None, null=True,
        choices=ArtifactBundleIndexingState.choices()
    )
    date_added = models.DateTimeField(default=timezone.now, db_index=True)
    date_uploaded = models.DateTimeField(default=timezone.now)
    date_last_modified = models.DateTimeField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundle"
```

**ArtifactBundleIndex 索引表：**

```python
@cell_silo_model
class ArtifactBundleIndex(Model):
    organization_id = BoundedBigIntegerField(db_index=True)
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    url = models.TextField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sentry_artifactbundleindex"
        indexes = (models.Index(fields=("url", "artifact_bundle")),)
```

`ArtifactBundleIndex` 是查找 Source Map 的**核心索引**。它记录了 "哪个 URL 的文件可以从哪个 ArtifactBundle 中找到"。当 Sentry 需要为 `https://cdn.example.com/static/js/app.abc123.js` 查找 Source Map 时，它通过 `url` 字段在这个表中定位对应的 Bundle。

**ReleaseArtifactBundle 关联表：**

```python
@cell_silo_model
class ReleaseArtifactBundle(Model):
    organization_id = BoundedBigIntegerField(db_index=True)
    release_name = models.CharField(max_length=250)
    dist_name = models.CharField(max_length=250)  # NULL 用空字符串表示
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    date_added = models.DateTimeField(default=timezone.now)
```

这个表的作用是将 Artifact Bundle 与具体的 Release 和 Distribution 关联起来。一个 Bundle 可以关联到多个 Release（例如：多个 patch 版本共享同一套 Source Maps）。

**Distribution（分发）：**

`dist_name` 是 Artifact Bundle 体系中的重要概念。在移动端开发中，同一个 Release 可能同时构建 Android 和 iOS 两个平台的应用，它们各有各自独立的 JS Bundle。通过 Distribution，你可以区分：

| Release | Distribution | 说明 |
|---|---|---|
| `myapp@1.2.3` | `android-arm64` | Android ARM64 架构的 JS Bundle |
| `myapp@1.2.3` | `ios-universal` | iOS 通用架构的 JS Bundle |
| `myapp@1.2.3` | `web-prod` | Web 生产版本 |
| `myapp@1.2.3` | `web-staging` | Web 预发布版本 |

### 9.7.2 Bundle 的上传与索引

Artifact Bundles 的上传通过 sentry-cli 或直接 API 完成：

```bash
sentry-cli sourcemaps upload ./dist \
  --release="myapp@1.2.3" \
  --dist="web-prod" \
  --bundle="myapp-bundle-$(uuidgen)"
```

底层机制：
1. **打包**：cli 将 `./dist` 目录中的所有 `.js` 和 `.js.map` 文件打包成一个 zip 文件
2. **上传**：通过 `File` 模型存储 zip 到对象存储（S3/GCS）
3. **解析**：服务端解压 zip，遍历每个文件
4. **索引**：对每个 `.js` 文件，计算其预期 URL（基于 `url-prefix` + 相对路径 + 文件名），写入 `ArtifactBundleIndex` 表
5. **关联**：创建 `ReleaseArtifactBundle` 记录，建立版本号->Bundle 的关联

**Bundle 的续期机制（Renewal）：**

Artifact Bundles 有一个续期机制：当一个 Bundle 被新的 Release 引用时，其 `date_added` 字段会更新，防止未被使用的 Bundle 被过早清理。`date_uploaded` 则永远保持首次上传时间不变。

### 9.7.3 Release 与 Bundle 的关联

`Release.get_release_associations` 方法（`src/sentry/models/artifactbundle.py:89`）展示了如何查询一个 ArtifactBundle 关联的所有 Release：

```python
@classmethod
def get_release_associations(cls, organization_id, artifact_bundle):
    release_artifact_bundles = ReleaseArtifactBundle.objects.filter(
        organization_id=organization_id, artifact_bundle=artifact_bundle
    ).order_by("-id")

    return [
        {
            "release": release_artifact_bundle.release_name,
            "dist": release_artifact_bundle.dist_name or None,
        }
        for release_artifact_bundle in release_artifact_bundles
    ]
```

`Release.count_artifacts_in_artifact_bundles` 方法统计了某个 Release 在 Artifact Bundle 中的制品数量（`src/sentry/models/release.py:743`）：

```python
def count_artifacts_in_artifact_bundles(self, project_ids):
    qs = (
        ArtifactBundle.objects.filter(
            organization_id=self.organization_id,
            releaseartifactbundle__organization_id=self.organization_id,
            releaseartifactbundle__release_name=self.version,
            projectartifactbundle__organization_id=self.organization_id,
            projectartifactbundle__project_id__in=project_ids,
        )
        .annotate(count=Sum(Func(F("artifact_count"), 1, function="COALESCE")))
        .values_list("releaseartifactbundle__release_name", "count")
    )
    qs.query.group_by = ["releaseartifactbundle__release_name"]
    if len(qs) == 0:
        return None
    return qs[0]
```

这个查询跨越了 `ArtifactBundle`、`ReleaseArtifactBundle`、`ProjectArtifactBundle` 三张表，展示了 Sentry 在多对多关联查询方面的复杂性。

### 9.7.4 与传统 Release Files 的对比

在 Artifact Bundles 之前，Sentry 使用的是 `ReleaseFile` 模型（`src/sentry/models/releasefile.py`），每个 Source Map 文件作为一个独立的 `ReleaseFile` 记录存储。两种方案的对比如下：

| 维度 | ReleaseFile（旧） | ArtifactBundle（新） |
|---|---|---|
| **上传粒度** | 逐文件上传 | 整个目录打包为 zip 一次性上传 |
| **文件存储** | 每个文件一条数据库记录 + 一条 File 记录 | 整个 Bundle 一条数据库记录 + 一条 File 记录 |
| **URL 匹配** | 通过 `ReleaseFile.name` 字段 | 通过 `ArtifactBundleIndex.url` 字段 |
| **查找性能** | 每个文件一条 SQL 查询或批量查询 | 通过索引表一次查询定位 Bundle |
| **Release 关联** | 直接 `ReleaseFile.release` FK | 通过 `ReleaseArtifactBundle` 中间表，支持多对多 |
| **Distribution** | `ReleaseFile.dist` 字段 | `ReleaseArtifactBundle.dist_name` 字段 |
| **多项目共享** | 不支持 | 通过 `ProjectArtifactBundle` 支持 |
| **续期机制** | 无 | 支持 Bundle 级别的 `date_added` 续期 |
| **适用场景** | 小规模项目 | 大型前端项目、多 Release 共享 Source Maps |

---

## 9.8 Release 健康度

### 9.8.1 Session 统计模型

Session（会话）是 Sentry 健康度数据的核心单位。一个 Session 代表用户的一次应用使用周期——从应用启动到应用退出（或转入后台、崩溃等）。SDK 负责在客户端追踪 Session 的生命周期，并通过 Session 数据上报以下信息：

- Session 的起止时间
- Session 是否以崩溃结束
- 异常退出（`exited`）的数量
- 异常退出时的持续时间
- 用户信息（匿名或已登录用户）

Sentry 服务端收到 Session 数据后，通过 Snuba（ClickHouse 查询层）进行聚合计算，生成以下核心指标：

| 指标 | 计算方式 | 说明 |
|---|---|---|
| `crash_free_sessions` | `(总 session 数 - 崩溃 session 数) / 总 session 数` | 基于 Session 的无崩溃率 |
| `crash_free_users` | `(总用户数 - 遇到崩溃的用户数) / 总用户数` | 基于用户的崩溃率 |
| `sessions` | 总 Session 计数 | 活跃度指标 |
| `users` | 总唯一用户计数 | 用户覆盖度指标 |
| `sessions_24h` | 最近 24 小时的 Session 数 | 短期活跃度 |
| `users_24h` | 最近 24 小时的用户数 | 短期用户量 |

### 9.8.2 Crash-free Rate（无崩溃率）

Crash-free Rate 是 Release 健康度最重要的指标。它可以在 Release 列表页中直接查看，也可以在 Dashboard 中绘制趋势图。

**Session 级别的崩溃率：**

```
crash_free_rate = (total_sessions - crashed_sessions) / total_sessions * 100%
```

**用户级别的崩溃率：**

```
crash_free_users_rate = (total_users - users_with_crashes) / total_users * 100%
```

两者的区别在于视角不同：
- **Session 级别**：如果你发布了一个致命 bug，每个用户可能在十分钟内崩溃 10 次，此时 Session 崩溃率会被放大（例如 90%），更真实地反映问题的严重程度
- **用户级别**：如果一个致命 bug 只影响 5% 的用户，即使他们每个人都崩溃了，用户崩溃率也只有 5%。这个指标更侧重于"有多少比例的用户受到了影响"

在实践中，两个指标通常结合使用：Session 崩溃率用于判断问题的严重程度，用户崩溃率用于判断问题的影响范围。

**健康度数据的排序支持：**

Release 列表 API 支持按健康度指标排序（`src/sentry/api/endpoints/organization_releases.py:500`）。当使用 `sort=crash_free_sessions` 或 `sort=crash_free_users` 时，系统通过 `release_health.backend.get_project_releases_by_stability` 从 Snuba 查询排序后的 Release 列表，再与 PostgreSQL 中的 Release 元数据合并。

```python
elif sort in self.SESSION_SORTS:
    if not flatten:
        return Response(
            {"detail": "sorting by crash statistics requires flattening (flatten=1)"},
            status=400,
        )
    paginator_cls = ReleasesMergingOffsetPaginator
    paginator_kwargs.update(
        data_load_func=lambda offset, limit: (
            release_health.backend.get_project_releases_by_stability(
                project_ids=filter_params["project_id"],
                environments=filter_params.get("environment"),
                scope=sort,
                offset=offset,
                stats_period=summary_stats_period,
                limit=limit,
            )
        ),
        ...
    )
```

`flatten=1` 是必需的，因为健康度数据是**项目级别**的——同一个 Release 在不同项目中的健康度可能不同。`flatten` 参数会将每条 Release 记录按项目拆分为多条结果。

### 9.8.3 Release Adoption（版本采纳率）

版本采纳（Release Adoption）衡量的是某个版本被用户使用的程度。最直观的理解是：在所有活跃 Session 中，有多大比例运行的是这个版本。

Sentry 内部通过 `ReleaseProjectEnvironment` 表的 `adopted` 和 `unadopted` 字段来追踪版本采纳状态（`src/sentry/models/releaseprojectenvironment.py:23`）：

```python
class ReleaseStages(str, Enum):
    ADOPTED = "adopted"
    LOW_ADOPTION = "low_adoption"
    REPLACED = "replaced"
```

`adoption_stage` 函数根据这两个时间戳判定版本阶段：

```python
def adoption_stage(adopted, unadopted) -> AdoptionStage:
    if adopted is not None and unadopted is None:
        stage = ReleaseStages.ADOPTED      # 已采纳（正在使用）
    elif adopted is not None and unadopted is not None:
        stage = ReleaseStages.REPLACED      # 已被新版本替代
    else:
        stage = ReleaseStages.LOW_ADOPTION  # 低采纳率
    return {"stage": stage, "adopted": adopted, "unadopted": unadopted}
```

采纳状态的计算逻辑：

1. **ADOPTED**：当一个版本的 Session 占比超过某个阈值（通常 20%-30%）时，标记 `adopted` 时间戳
2. **REPLACED**：当一个新版本的采纳率达到阈值时，旧版本的 `unadopted` 被标记
3. **LOW_ADOPTION**：Session 占比低于阈值，默认状态

### 9.8.4 Release Stages（版本阶段）

Release Stages 与 Adoption 不同，它描述的是 Release 在整个生命周期中的位置：

| Stage | 含义 | 判定条件 |
|---|---|---|
| `adopted` | 当前主力版本，大部分用户在使用 | `adopted != None && unadopted == None` |
| `low_adoption` | 新发布的版本，用户量尚少，或灰度发布阶段 | `adopted == None` |
| `replaced` | 已被新版本替代，用户已迁移 | `adopted != None && unadopted != None` |

这个分类在 Sentry 的 UI 中用于：
- **过滤**：只查看已采纳的版本
- **排序**：按采纳时间倒序排列
- **告警**：监控新版本的采纳速度

### 9.8.5 Release Threshold（版本阈值告警）

`ReleaseThreshold` 模型（`src/sentry/models/release_threshold/release_threshold.py`）允许你为 Release 设定健康度阈值，当指标低于阈值时自动触发告警：

```python
@cell_silo_model
class ReleaseThreshold(Model):
    threshold_type = BoundedPositiveIntegerField(choices=ReleaseThresholdType.as_choices())
    trigger_type = BoundedPositiveIntegerField(choices=ReleaseThresholdTriggerType.as_choices())
    value = models.IntegerField()
    window_in_seconds = models.PositiveIntegerField()
    project = FlexibleForeignKey("sentry.Project", related_name="release_thresholds")
    environment = FlexibleForeignKey("sentry.Environment", null=True)
    date_added = models.DateTimeField(default=timezone.now)
```

关键字段：

| 字段 | 说明 |
|---|---|
| `threshold_type` | 阈值类型（如 TOTAL_ERROR_COUNT 总错误数） |
| `trigger_type` | 触发条件（OVER 超过 / UNDER 低于） |
| `value` | 阈值数值（如 50 个错误） |
| `window_in_seconds` | 监控窗口（如 3600 秒 = 1 小时） |
| `environment` | 可选，限定特定环境 |

---

## 9.9 Release 对比与回归检测

### 9.9.1 版本对比机制

Sentry 提供了多种 Release 对比能力，帮助开发者在不同版本之间进行差异化分析：

**上一个 Release 的获取：**

`get_previous_release` 函数（`src/sentry/models/release.py:952`）实现了"获取当前 Release 的前一个版本"的逻辑：

```python
def get_previous_release(release: Release) -> Release | None:
    return (
        Release.objects.filter(organization_id=release.organization_id)
        .filter(
            Exists(
                ReleaseProject.objects.filter(
                    release=OuterRef("pk"),
                    project_id__in=ReleaseProject.objects.filter(
                        release=release
                    ).values_list("project_id", flat=True),
                )
            )
        )
        .extra(select={"sort": "COALESCE(date_released, date_added)"})
        .exclude(version=release.version)
        .order_by("-sort")
        .first()
    )
```

函数逻辑：
1. 找到当前 Release 关联的所有项目
2. 在同一个 Organization 内，查找这些项目中存在的前一个 Release
3. 按 `date_released` 优先（其次 `date_added`）排序，取最新的一条

**问题首次出现版本：**

`Release._get_group_release_version` 方法（`src/sentry/models/release.py:161`）通过 `GroupRelease` 中间表确定一个 Issue 首次出现的版本：

```python
def _get_group_release_version(self, group_id, environment_names, orderby):
    from sentry.models.grouprelease import GroupRelease
    group_releases = GroupRelease.objects.filter(group_id=group_id)
    if environment_names:
        group_releases = group_releases.filter(environment__in=environment_names)
    return self.get(
        id__in=group_releases.order_by(orderby).values("release_id")[:1]
    ).version
```

当 `orderby="first_seen"` 时，返回的是最早出现该 Issue 的 Release——即 `Group.first_release`。

### 9.9.2 回归检测原理

Sentry 的回归（Regression）检测基于以下核心逻辑：

1. 一个 Issue 在版本 v1.2.0 中被标记为 **Resolved**，此时系统创建 `GroupResolution` 记录，关联到 `release=v1.2.0`。
2. 此后，如果同一个 Issue 在版本 v1.3.0 中再次出现（通过 `GroupRelease` 记录检测），并且 `v1.3.0 > v1.2.0`（通过版本比较判断），则 Issue 状态从 Resolved 自动回退到 **Regressed**（回归）。
3. 版本比较不是简单的字符串比较，而是基于 `date_added` 或 SemVer 语义。

从 `Release.is_release_newer_or_equal` 方法（`src/sentry/models/release.py:395`）可以看到版本新旧比较的实现：

```python
@staticmethod
def is_release_newer_or_equal(org_id, release, other_release):
    if release is None:
        return False
    if other_release is None:
        return True
    if release == other_release:
        return True

    releases = {
        release.version: float(release.date_added.timestamp())
        for release in Release.objects.filter(
            organization_id=org_id, version__in=[release, other_release]
        )
    }
    release_date = releases.get(release)
    other_release_date = releases.get(other_release)

    if release_date is not None and other_release_date is not None:
        return release_date > other_release_date
    return False
```

在 `GroupResolution` 的上下文中，如果 `v1.3.0` 的 `date_added` 晚于 `v1.2.0`，则 Issue 被视为在新版本中回归。

### 9.9.3 SemVer 智能排序

`follows_semver_versioning_scheme` 函数（`src/sentry/models/release.py:890`）判断一个项目是否遵循语义化版本规范：

```python
def follows_semver_versioning_scheme(org_id, project_id, release_version=None):
    cache_key = "follows_semver:1:%s" % hash_values([org_id, project_id])
    follows_semver = cache.get(cache_key)

    if follows_semver is None:
        releases_list = list(
            Release.objects.filter(
                organization_id=org_id,
                projects__id__in=[project_id],
                status=ReleaseStatus.OPEN
            )
            .using_replica()
            .order_by("-date_added")[:10]
        )

        if len(releases_list) <= 2:
            follows_semver = releases_list[0].is_semver_release
        elif len(releases_list) < 10:
            follows_semver = any(
                release.is_semver_release for release in releases_list[0:3]
            )
        else:
            semver_matches = sum(
                map(lambda release: release.is_semver_release, releases_list)
            )
            at_least_three_in_last_ten = semver_matches >= 3
            at_least_one_in_last_three = any(
                release.is_semver_release for release in releases_list[0:3]
            )
            follows_semver = at_least_one_in_last_three and at_least_three_in_last_ten
        cache.set(cache_key, follows_semver, 3600)
    ...
```

判断逻辑：
- 如果最近版本数不超过 2 个，只看最近一个是否是 SemVer
- 如果在 3 到 9 个之间，最近 3 个中至少一个符合即可
- 如果 10 个或以上，需同时满足：**最近 3 个中至少 1 个** 且 **最近 10 个中至少 3 个**

一旦判定为 SemVer 项目，Release 列表的排序就从"按日期"切换为"按语义版本号"排序，使得 `1.2.10` > `1.2.9` > `1.2.0-beta` 这样符合直觉。

---

## 9.10 Release 归档与管理

### 9.10.1 Release 状态管理

Release 有两个状态（`ReleaseStatus`）：

| 状态 | 值 | 说明 |
|---|---|---|
| Open | `0` | 活跃状态。新创建的 Release 默认为此状态。 |
| Archived | `1` | 已归档。Release 不会再出现在默认列表中。 |

归档操作不会删除任何数据——Release、关联的 Commits、Deploy 记录、Source Maps 等都保持不变。归档的作用是**隐藏**：将不再需要关注的旧版本从 UI 中过滤掉。

**更新 Release 状态（API）：**

```http
PUT /api/0/organizations/{org_slug}/releases/{version}/
Content-Type: application/json

{
    "status": "archived"
}
```

### 9.10.2 Release 合并

当同一个版本因为命名不一致而创建了多条 Release 记录时（例如 `myapp@1.2.3` 和 `1.2.3` 是同一个版本），可以通过 `Release.merge` 方法将它们合并（`src/sentry/models/release.py:552`）：

```python
@classmethod
def merge(cls, to_release, from_releases):
    from sentry.models.group import Group
    from sentry.models.grouprelease import GroupRelease
    from sentry.models.groupresolution import GroupResolution
    from sentry.models.releasecommit import ReleaseCommit
    from sentry.models.releaseenvironment import ReleaseEnvironment
    from sentry.models.releasefile import ReleaseFile
    from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
    from sentry.models.releases.release_project import ReleaseProject

    model_list = (
        ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject,
        ReleaseProjectEnvironment, GroupRelease, GroupResolution,
    )
    for release in from_releases:
        for model in model_list:
            if hasattr(model, "release"):
                update_kwargs = {"release": to_release}
            else:
                update_kwargs = {"release_id": to_release.id}
            try:
                with atomic_transaction(using=router.db_for_write(model)):
                    model.objects.filter(release_id=release.id).update(**update_kwargs)
            except IntegrityError:
                for item in model.objects.filter(release_id=release.id):
                    try:
                        with atomic_transaction(using=router.db_for_write(model)):
                            model.objects.filter(id=item.id).update(**update_kwargs)
                    except IntegrityError:
                        item.delete()

        Group.objects.filter(first_release=release).update(first_release=to_release)
        release.delete()
```

合并流程：
1. 遍历所有关联表（`ReleaseCommit`、`ReleaseEnvironment`、`ReleaseFile`、`ReleaseProject` 等）
2. 将 `from_releases` 中的所有关联记录重定向到 `to_release`
3. 如果遇到唯一约束冲突（如 `(release, commit)` 已存在），逐条处理：能更新的更新，冲突的删除
4. 处理 `Group.first_release` 外键的重定向
5. 删除源 Release 记录

### 9.10.3 Release 安全删除

`Release.safe_delete` 方法（`src/sentry/models/release.py:703`）实现了带保护检查的删除逻辑：

```python
def safe_delete(self):
    from sentry import release_health
    from sentry.models.group import Group
    from sentry.models.releasefile import ReleaseFile

    # 保护 1：不能删除被 Group.first_release 引用的 Release
    if Group.objects.filter(first_release=self).exists():
        raise UnsafeReleaseDeletion(ERR_RELEASE_REFERENCED)

    # 保护 2：不能删除有健康度数据的 Release
    project_ids = list(self.projects.values_list("id").all())
    if release_health.backend.check_has_health_data(
        [(p[0], self.version) for p in project_ids]
    ):
        raise UnsafeReleaseDeletion(ERR_RELEASE_HEALTH_DATA)

    # 删除关联文件和 Release 自身
    file_list = ReleaseFile.objects.filter(
        release_id=self.id
    ).select_related("file")
    for releasefile in file_list:
        releasefile.file.delete()
        releasefile.delete()
    self.delete()
```

删除前的两道安全检查：

1. **`ERR_RELEASE_REFERENCED`**：如果任何 `Group` 的 `first_release` 指向该 Release，删除会被阻止。原因很明显：删除 Release 会丢失"问题首次出现版本"的关键信息。
2. **`ERR_RELEASE_HEALTH_DATA`**：如果 Release 在 Snuba 中有 Session 健康度数据，删除会被阻止。这是因为即使删除了 PostgreSQL 中的 Release 记录，Snuba 中仍会保留健康度数据，下一次数据同步时会因为 upsert 机制重新创建 Release（形成"僵尸 Release"）。

### 9.10.4 未使用 Release 的清理

对于长期未使用的 Release 记录，Sentry 提供了 `get_unused_filter` 方法（`src/sentry/models/release.py:787`），用于筛选出可以安全清理的 Release：

```python
@classmethod
def get_unused_filter(cls, cutoff_date: datetime) -> Q:
    from django.db.models import Exists, OuterRef
    from sentry.models.deploy import Deploy
    from sentry.models.distribution import Distribution
    from sentry.models.group import Group
    # ... 其他 imports

    # 子查询：检查各种"仍在使用"的条件
    group_first_release_exists = Exists(
        Group.objects.filter(first_release=OuterRef("id"))
    )
    recent_activity_exists = Exists(
        ReleaseProjectEnvironment.objects.filter(
            release_id=OuterRef("id"), last_seen__gte=cutoff_date
        )
    )
    recent_deploys_exist = Exists(
        Deploy.objects.filter(
            release_id=OuterRef("id"), date_finished__gte=cutoff_date
        )
    )
    group_resolutions_exist = Exists(
        GroupResolution.objects.filter(release_id=OuterRef("id"))
    )
    # ... 更多子查询

    # 定义"必须保留"的条件
    keep_conditions = (
        Q(date_added__gte=cutoff_date)
        | group_first_release_exists
        | group_resolutions_exist
        | recent_deploys_exist
        | recent_activity_exists
        # ... 更多条件
    )

    # 返回逆条件（可以删除的 Release）
    return cast(Q, ~keep_conditions)
```

这个方法使用了一系列 Django `Exists` 子查询来构建一个高效的 "哪些 Release 仍在被使用" 的判定逻辑。一个 Release 在以下情况下被视为"仍在使用"（必须保留）：

| 条件 | 原因 |
|---|---|
| `date_added >= cutoff_date` | 最近创建的 Release |
| `Group.first_release == release` | 作为某个问题的首次出现版本 |
| `GroupEnvironment.first_release == release` | 作为某个环境组合的首次出现版本 |
| `GroupHistory 引用` | 被问题变更历史引用 |
| `GroupResolution 引用` | 被问题解决记录引用，影响回归检测 |
| `Distribution.date_added >= cutoff_date` | 最近有分发记录 |
| `Deploy.date_finished >= cutoff_date` | 最近有部署记录 |
| `GroupRelease.last_seen >= cutoff_date` | 最近有问题事件 |
| `LatestRepoReleaseEnvironment 引用` | 仓库环境的最新 Release |
| `ReleaseProjectEnvironment.last_seen >= cutoff_date` | 最近有活跃数据 |

只有**不满足上述任何条件**的 Release，才被认为是"未使用"的，可以安全清理。这个过滤器是 Sentry 数据保留策略中 `--cutoff-date` 参数的核心实现。

---

本章详细解析了 Sentry 中 Release 体系的全貌：从 Release 的核心数据模型（包括 SemVer 解析、物料化统计字段）到各种创建方式（SDK 自动创建、CLI、API 及其幂等性设计），从 Commit 关联机制（`set_commits`、`set_refs`、Suspect Commits 推断）到 Deploy 部署追踪与通知，从 Source Maps 的原理与上传流程（sentry-cli、Webpack/Vite Plugin、API 上传）到 Artifact Bundles 的现代制品管理架构，从 Release 健康度（Crash-free Rate、Adoption、Session 统计）到回归检测和版本对比，最后到 Release 的归档、合并与安全删除。

理解 Release 体系是高效使用 Sentry 的关键——没有 Release 数据，Sentry 只能告诉你"有错误发生了"，而有了 Release 数据，Sentry 能告诉你"这个错误是从哪个版本引入的、由哪些 Commit 导致的、影响了多少用户、是否比上个版本更差"。这就是 Release 的核心价值。
