---
layout: default
title: 第01章 - acme.sh概述与基础知识
---

# 第01章 - acme.sh概述与基础知识

## 1.1 什么是 acme.sh

### 1.1.1 项目简介

acme.sh 是由中国开发者 neilpang 发起并维护的开源项目，采用纯 Shell 脚本编写，实现了 ACME（Automatic Certificate Management Environment，自动化证书管理环境）协议客户端。项目托管于 GitHub：[https://github.com/acmesh-official/acme.sh](https://github.com/acmesh-official/acme.sh)，目前拥有超过 40,000 个 Star，是全球使用最广泛的 ACME 客户端之一。

ACME 协议（RFC 8555）是一种用于自动化域名验证和证书颁发的标准协议，最初由 Let's Encrypt 推动制定。有了 ACME 协议，网站管理员无需手动申请、下载、安装证书，也无需担心证书过期——一切都可以自动化完成。

acme.sh 最大的特点就是**零依赖**。它不需要 Python、Ruby、Node.js，甚至不依赖 OpenSSL 命令行工具（内部使用 `openssl` 库时有独立处理逻辑），只需要系统中有 `curl` 或 `wget`，以及 `cron` 定时任务支持即可运行。

### 1.1.2 核心特性

**跨平台兼容性**
- 支持 Linux（Debian/Ubuntu、CentOS/RHEL、Alpine 等所有主流发行版）
- 支持 macOS
- 支持 FreeBSD、OpenBSD、NetBSD
- 支持 Solaris
- 支持 Windows（通过 Cygwin 或 Git Bash）
- 兼容 POSIX Shell（bash、dash、sh、zsh、ksh 等）

**协议与标准支持**
- 完整支持 ACME v2 协议（RFC 8555）
- 支持 ARI（ACME Renewal Information，RFC 9773）——允许 CA 建议提前续期（如遇证书吊销事件）
- 支持 DNS Persist 模式（draft-ietf-acme-dns-persist-01）——一次性手动添加 DNS 记录，永久自动续期

**证书类型支持**
- 单域名证书（`example.com`）
- 多域名 SAN 证书（单张证书覆盖多个域名）
- 通配符证书（`*.example.com`，仅支持 DNS-01 验证）
- ECC（椭圆曲线密码）证书（EC-256、EC-384）
- RSA 证书（RSA-2048、RSA-3072、RSA-4096）
- 支持同一域名同时持有 RSA 和 ECC 双证书

**验证方式**
- HTTP-01 验证：Webroot、Standalone、Nginx、Apache、TLS-ALPN 模式
- DNS-01 验证：手动 DNS 、DNS API 自动模式、DNS 别名模式、DNS Persist 模式

**DNS API 集成**
- 支持超过 200 家 DNS 服务商的 API 自动验证
- 覆盖国内阿里云、腾讯云、华为云、百度云、京东云等主流服务商
- 覆盖国际 Cloudflare、AWS Route53、Azure DNS、Google Cloud DNS 等

**证书部署**
- 内置 `--install-cert` 命令，将证书安装到指定路径并执行重载命令
- 提供 30+ 种部署钩子（deploy hooks），支持 Nginx、Apache、HAProxy、SSH 远程部署、Synology NAS、Proxmox VE、Docker 等

**自动续期**
- 安装时自动创建 cron 定时任务，每天检查证书是否需要续期
- 证书剩余有效期不足 30 天时自动触发续期
- 支持 ARI 协议，可响应 CA 的提前续期建议

### 1.1.3 与其他 ACME 客户端的对比

| 对比项 | acme.sh | Certbot | acme.py | lego |
|--------|---------|---------|---------|------|
| 语言 | Shell | Python | Python | Go |
| 依赖 | 几乎零依赖 | Python 环境 | Python 环境 | Go 运行时 |
| DNS 提供商支持 | 200+ | 部分 | 部分 | 100+ |
| 安装难度 | 简单 | 中等 | 中等 | 简单 |
| root 权限要求 | 不需要 | 通常需要 | 不需要 | 不需要 |
| 活跃社区 | 非常活跃 | 活跃 | 活跃 | 活跃 |
| 中文友好 | 非常好 | 一般 | 一般 | 一般 |

---

## 1.2 SSL/TLS 证书基础知识

### 1.2.1 为什么需要 SSL/TLS 证书

HTTPS（HTTP over SSL/TLS）是现代互联网安全通信的基础。SSL/TLS 证书的主要作用：

1. **加密传输**：防止数据在传输过程中被窃听或篡改
2. **身份验证**：证明服务器的身份，防止中间人攻击
3. **信任建立**：浏览器地址栏显示绿色锁标，增加用户信任
4. **SEO 优化**：Google 等搜索引擎对 HTTPS 站点有排名优势
5. **合规要求**：国内备案域名的 HTTP 跳转限制、PCI DSS 等行业标准要求

### 1.2.2 证书类型

**按验证级别分类：**

| 类型 | 全称 | 验证内容 | 适用场景 |
|------|------|----------|----------|
| DV | Domain Validation | 仅验证域名所有权 | 个人网站、博客、小型应用 |
| OV | Organization Validation | 验证域名 + 组织信息 | 企业网站、电商 |
| EV | Extended Validation | 严格验证组织身份 | 银行、金融机构 |

acme.sh 主要申请 **DV 证书**（免费），OV/EV 证书由 DigiCert 等 CA 通过付费渠道提供。

**按密钥算法分类：**

| 类型 | 说明 | 密钥长度建议 | 兼容性 |
|------|------|-------------|--------|
| RSA | 传统非对称算法 | 2048~4096 位 | 兼容所有系统 |
| ECC | 椭圆曲线算法 | 256~384 位 | 不支持 Windows XP 等老系统 |

ECC 证书相同安全级别下密钥更短，握手更快，推荐在现代环境中使用。

**按覆盖范围分类：**

- **单域名证书**：仅覆盖 `example.com`，不覆盖子域名
- **多域名证书（SAN）**：一张证书覆盖多个域名，如 `example.com` + `www.example.com` + `api.example.com`
- **通配符证书**：覆盖同一级别的所有子域名，如 `*.example.com` 覆盖 `www.example.com`、`api.example.com` 等，但不覆盖 `example.com` 本身，也不覆盖二级通配如 `*.sub.example.com`

### 1.2.3 证书文件格式

acme.sh 申请证书后会生成以下文件，理解这些文件的作用至关重要：

| 文件名 | 说明 | 使用场景 |
|--------|------|----------|
| `example.com.cer` | 域名证书（不含中间证书） | 较少单独使用 |
| `example.com.key` | 私钥文件，**需严格保密** | Nginx/Apache 的 `ssl_certificate_key` |
| `fullchain.cer` | 完整证书链（域名证书 + 中间证书） | 推荐用于 Nginx/Apache 的 `ssl_certificate` |
| `ca.cer` | CA 中间证书 | Apache 的 `SSLCertificateChainFile`（较旧版本） |
| `example.com.conf` | acme.sh 内部配置，记录续期参数 | acme.sh 内部使用 |
| `example.com.csr` | 证书签名请求 | 发送给 CA 的请求文件 |

> **重要提示**：acme.sh 将证书存储在 `~/.acme.sh/example.com/` 目录下，但**不应直接在 Nginx/Apache 中引用这些路径**。应使用 `--install-cert` 命令将证书复制到指定位置，这样续期后会自动更新部署路径中的文件。

### 1.2.4 ACME 协议工作流程

ACME 协议的核心是通过"挑战-响应"机制来验证申请者确实控制该域名：

```
申请方 (acme.sh)                          CA (Let's Encrypt / ZeroSSL)
      |                                              |
      |  1. 创建账户 / 获取 nonce                      |
      |--------------------------------------------->|
      |  2. 提交订单（域名列表）                        |
      |--------------------------------------------->|
      |  3. 获取挑战（HTTP-01 或 DNS-01）              |
      |<---------------------------------------------|
      |  4. 完成挑战（放置文件 / 添加 DNS 记录）        |
      |  5. 通知 CA 验证                               |
      |--------------------------------------------->|
      |  6. CA 验证挑战                               |
      |<---------------------------------------------|
      |  7. 提交 CSR（证书签名请求）                    |
      |--------------------------------------------->|
      |  8. 获取已签发的证书                           |
      |<---------------------------------------------|
```

**HTTP-01 挑战**：CA 访问 `http://example.com/.well-known/acme-challenge/<token>` 检查特定文件是否存在，验证域名控制权。

**DNS-01 挑战**：CA 查询 `_acme-challenge.example.com` TXT 记录中是否包含特定值，验证 DNS 控制权。此方式支持通配符证书，且不要求服务器 80/443 端口可访问。

---

## 1.3 支持的证书颁发机构（CA）

### 1.3.1 CA 列表

acme.sh 支持多个 CA，**默认 CA 自 2021 年起更改为 ZeroSSL**（而非 Let's Encrypt）：

| CA 名称 | 短名称 | 服务器地址 | 说明 |
|---------|--------|-----------|------|
| ZeroSSL（默认） | `zerossl` | `https://acme.zerossl.com/v2/DV90` | 默认 CA，每域名免费 3 张证书 |
| Let's Encrypt | `letsencrypt` | `https://acme-v02.api.letsencrypt.org/directory` | 最知名的免费 CA |
| Let's Encrypt (测试) | `letsencrypt_test` | staging URL | 仅用于测试，证书不受信任 |
| Buypass | `buypass` | `https://api.buypass.com/acme/directory` | 挪威 CA，有效期 180 天 |
| SSL.com | `ssl_com` | `https://acme.ssl.com/sslcom-dv-rsa` | 付费 CA，支持 ACME 免费 DV |
| Google Public CA | `google` | `https://dv.acme-v02.api.pki.goog/directory` | Google 公共 CA（需要 Google 账户） |
| DigiCert | `digicert` | `https://acme.digicert.com/v2/OV` | 主要用于 OV 证书 |

### 1.3.2 各 CA 主要区别

**ZeroSSL**
- 证书有效期：90 天（符合 ACME 标准）
- 免费限额：每个域名 3 张同时有效的证书
- 特点：默认 CA，支持多线程 API，稳定性较好
- 注意：在某些国家/地区（如部分俄罗斯、伊朗网络环境）访问可能受限，中国大陆访问通常正常

**Let's Encrypt**
- 证书有效期：90 天
- 免费限额：每个注册域每周 50 张
- 特点：最知名，社区支持最完善，全球 CDN 节点分布广
- 中国大陆访问：偶有网络波动，但总体可用
- 适用于：大多数场景的首选之一

**Buypass**
- 证书有效期：**180 天**（比 Let's Encrypt 和 ZeroSSL 更长，减少续期频率）
- 特点：挪威公司，GDPR 合规性好
- 适用于：希望减少续期操作频率的场景

**Google Public CA**
- 证书有效期：90 天
- 特点：Google 背书，可信度高
- 要求：需要 Google Cloud 账户

### 1.3.3 切换默认 CA

```bash
# 查看当前默认 CA
acme.sh --info

# 将默认 CA 切换为 Let's Encrypt
acme.sh --set-default-ca --server letsencrypt

# 将默认 CA 切换回 ZeroSSL
acme.sh --set-default-ca --server zerossl

# 将默认 CA 切换为 Buypass
acme.sh --set-default-ca --server buypass

# 仅对单次申请使用特定 CA（不修改默认值）
acme.sh --issue --server letsencrypt -d example.com --dns dns_cf
```

> **建议**：在中国大陆服务器上推荐使用 Let's Encrypt 作为默认 CA，网络连通性更稳定。

---

## 1.4 项目目录结构

### 1.4.1 安装后目录

acme.sh 默认安装到用户主目录下的 `.acme.sh/` 文件夹：

```
~/.acme.sh/
├── acme.sh                    # 主脚本
├── account.conf               # 账户配置（CA 账户 Key 路径、邮箱等）
├── deploy/                    # 部署钩子脚本目录
│   ├── haproxy.sh
│   ├── nginx.sh
│   ├── ssh.sh
│   ├── synology_dsm.sh
│   └── ...
├── dnsapi/                    # DNS API 脚本目录
│   ├── dns_ali.sh             # 阿里云 DNS
│   ├── dns_cf.sh              # Cloudflare DNS
│   ├── dns_tencent.sh         # 腾讯云 DNS
│   ├── dns_huaweicloud.sh     # 华为云 DNS
│   ├── dns_aws.sh             # AWS Route53
│   └── ...（200+ 个）
├── example.com/               # 每个域名一个子目录
│   ├── example.com.cer        # 域名证书
│   ├── example.com.conf       # 该域名的 acme.sh 配置
│   ├── example.com.csr        # 证书签名请求
│   ├── example.com.csr.conf   # CSR 配置
│   ├── example.com.key        # 私钥
│   ├── ca.cer                 # CA 中间证书
│   └── fullchain.cer          # 完整证书链
└── ca/                        # CA 账户信息
    ├── acme-v02.api.letsencrypt.org/
    └── acme.zerossl.com/
```

### 1.4.2 重要配置文件

**`~/.acme.sh/account.conf`**：全局账户配置，存储注册邮箱、默认 CA、DNS API 凭据等：

```bash
# 通常不需要手动编辑，acme.sh 会自动维护
ACCOUNT_EMAIL='your@email.com'
DEFAULT_ACME_SERVER='https://acme-v02.api.letsencrypt.org/directory'

# DNS API 凭据会在首次使用后自动保存到这里
Ali_Key='your_aliyun_key'
Ali_Secret='your_aliyun_secret'
```

**`~/.acme.sh/example.com/example.com.conf`**：单个域名的续期配置，记录了当初申请时的所有参数：

```bash
Le_Domain='example.com'
Le_Alt='*.example.com'
Le_Webroot='dns:dns_ali'
Le_PreHook=''
Le_PostHook=''
Le_RenewHook=''
Le_API='https://acme-v02.api.letsencrypt.org/directory'
Le_Keylength=''
Le_ReloadCmd='systemctl reload nginx'
Le_RealCertPath='/etc/nginx/ssl/example.com.fullchain.pem'
Le_RealKeyPath='/etc/nginx/ssl/example.com.key'
```

---

## 1.5 版本与更新

### 1.5.1 查看版本

```bash
acme.sh --version
```

### 1.5.2 更新 acme.sh

```bash
# 更新到最新版本
acme.sh --upgrade

# 更新到开发版（dev 分支）
acme.sh --upgrade --branch dev

# 开启自动更新
acme.sh --upgrade --auto-upgrade 1

# 关闭自动更新
acme.sh --upgrade --auto-upgrade 0
```

### 1.5.3 查看已颁发证书列表

```bash
acme.sh --list
```

输出示例：

```
Main_Domain       KeyLength  SAN_Domains          CA         Created                Renew
example.com       ""         *.example.com        ZeroSSL    2024-01-15T10:00:00Z   2024-04-15T10:00:00Z
www.example.org   ""         n/a                  LetsEncrypt 2024-02-01T10:00:00Z  2024-05-01T10:00:00Z
```

---

## 1.6 小结

本章介绍了 acme.sh 的核心概念：

- acme.sh 是纯 Shell 实现的 ACME 协议客户端，零依赖、跨平台、支持 200+ DNS API
- SSL/TLS 证书分为 DV/OV/EV 三级，acme.sh 主要申请免费 DV 证书
- ACME 协议通过 HTTP-01 或 DNS-01 挑战验证域名所有权
- 默认 CA 为 ZeroSSL，可随时切换为 Let's Encrypt、Buypass 等
- 证书文件包括私钥、域名证书、完整证书链，推荐使用 `fullchain.cer` 配置 HTTPS

下一章将介绍 acme.sh 的安装方法和初始配置。
