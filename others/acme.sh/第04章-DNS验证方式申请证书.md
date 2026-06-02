---
layout: default
title: 第04章 - DNS验证方式申请证书
---

# 第04章 - DNS验证方式申请证书

DNS-01 验证通过在域名的 DNS 记录中添加特定 TXT 记录来证明域名控制权。与 HTTP-01 相比，DNS-01 验证**不需要服务器开放任何端口**，且**支持通配符证书**，是企业和专业用户的首选验证方式。

## 4.1 DNS-01 验证原理

DNS-01 验证流程：

1. acme.sh 向 CA 发起证书申请
2. CA 返回一个挑战令牌
3. acme.sh（通过 DNS API 或手动）在 `_acme-challenge.<域名>` 添加 TXT 记录
4. CA 查询该 TXT 记录是否包含正确的值
5. 验证通过后颁发证书

**DNS-01 验证的优势：**
- ✅ 不需要服务器开放 80/443 端口
- ✅ 支持通配符证书（`*.example.com`）
- ✅ 服务器不需要直接暴露在公网
- ✅ 内网服务器也可以申请证书
- ✅ 适合 CDN、负载均衡、多服务器场景

**DNS-01 验证的局限：**
- DNS API 凭据存储在服务器上，有一定安全风险（建议使用最小权限 API Key）
- 手动 DNS 模式无法自动续期

---

## 4.2 手动 DNS 模式

### 4.2.1 适用场景

当 DNS 服务商没有提供 API，或者不方便使用 API 时，可以使用手动 DNS 模式。

```bash
# 申请单域名
acme.sh --issue -d example.com --dns

# 申请通配符证书（需要两条 TXT 记录）
acme.sh --issue -d example.com -d *.example.com --dns
```

### 4.2.2 操作步骤

执行命令后，acme.sh 会暂停并显示需要添加的 TXT 记录信息：

```
[Mon 15 Jan 2024 10:00:00] Add the following TXT record:
[Mon 15 Jan 2024 10:00:00] Domain: '_acme-challenge.example.com'
[Mon 15 Jan 2024 10:00:00] TXT value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
[Mon 15 Jan 2024 10:00:00] Please be aware that you prepend _acme-challenge. before your domain
[Mon 15 Jan 2024 10:00:00] so the resulting subdomain will be: _acme-challenge.example.com
[Mon 15 Jan 2024 10:00:00] Please add the TXT record and re-run with --renew.
```

申请通配符时会有**两条** TXT 记录需要添加（针对 `example.com` 和 `*.example.com` 各一条）。

按照提示：
1. 登录你的 DNS 控制台
2. 添加 `_acme-challenge.example.com` TXT 记录，值为提示中的字符串
3. 等待 DNS 记录生效（通常 1-5 分钟，也可能需要更长时间）
4. 验证 DNS 记录已生效：

```bash
# 检查 DNS 记录是否生效
dig _acme-challenge.example.com TXT
# 或
nslookup -type=TXT _acme-challenge.example.com
```

5. 确认生效后，执行续期命令完成验证：

```bash
acme.sh --renew -d example.com
```

### 4.2.3 手动 DNS 模式的缺点

手动 DNS 模式**无法自动续期**——每次续期都需要手动操作。如果域名的 DNS 服务商提供了 API，强烈建议改用 DNS API 自动模式。

---

## 4.3 DNS API 自动模式

DNS API 自动模式是 acme.sh 最强大的功能之一。acme.sh 调用 DNS 服务商的 API 自动添加/删除 TXT 记录，整个过程无需人工干预，且自动续期完全免维护。

### 4.3.1 DNS API 凭据管理

**首次使用**：通过环境变量传递凭据，acme.sh 会自动将其保存到 `~/.acme.sh/account.conf`：

```bash
export Ali_Key="your_key"
export Ali_Secret="your_secret"
acme.sh --issue --dns dns_ali -d example.com
# 第一次执行后，凭据会被保存，后续无需再 export
```

**查看已保存的凭据**：

```bash
cat ~/.acme.sh/account.conf
```

**修改凭据**（如 API Key 更换后）：

```bash
# 方式一：直接编辑 account.conf
vim ~/.acme.sh/account.conf

# 方式二：重新 export 并执行一次带 --force 的续期
export Ali_Key="new_key"
export Ali_Secret="new_secret"
acme.sh --renew -d example.com --force
```

### 4.3.2 通用参数

```bash
# DNS 传播等待时间（秒），当 DNS 更新较慢时需要增加
--dnssleep 120   # 等待 120 秒再让 CA 验证 TXT 记录

# 示例：申请通配符证书，等待 120 秒 DNS 传播
acme.sh --issue --dns dns_ali -d example.com -d *.example.com --dnssleep 120
```

---

## 4.4 常用 DNS API 提供商（中国）

### 4.4.1 阿里云 DNS（dns_ali）

**获取 API 凭据：**
1. 登录[阿里云 RAM 控制台](https://ram.console.aliyun.com/users)
2. 创建 RAM 子用户（建议不要使用主账号 AccessKey）
3. 为该用户授予 `AliyunDNSFullAccess` 权限策略
4. 创建并保存 AccessKey ID 和 AccessKey Secret

```bash
export Ali_Key="your_access_key_id"
export Ali_Secret="your_access_key_secret"

# 申请单域名
acme.sh --issue --dns dns_ali -d example.com

# 申请通配符证书
acme.sh --issue --dns dns_ali -d example.com -d *.example.com

# 申请多域名
acme.sh --issue --dns dns_ali \
  -d example.com \
  -d *.example.com \
  -d www.example.com \
  -d api.example.com
```

**最小权限配置**（建议）：

在 RAM 控制台创建自定义权限策略，仅允许 DNS 相关操作：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Action": [
        "alidns:AddDomainRecord",
        "alidns:DeleteDomainRecord",
        "alidns:DescribeDomainRecords",
        "alidns:DescribeDomains"
      ],
      "Resource": "*",
      "Effect": "Allow"
    }
  ]
}
```

### 4.4.2 腾讯云 DNS/DNSPod（dns_tencent）

腾讯云有两个 DNS API：

**新版腾讯云 API（推荐，dns_tencent）：**

1. 登录[腾讯云 API 密钥控制台](https://console.cloud.tencent.com/cam/capi)
2. 新建密钥，获取 SecretId 和 SecretKey

```bash
export Tencent_SecretId="your_secret_id"
export Tencent_SecretKey="your_secret_key"

acme.sh --issue --dns dns_tencent -d example.com -d *.example.com
```

**旧版 DNSPod.cn API（dns_dp）：**

1. 登录 [DNSPod 控制台](https://console.dnspod.cn/account/token/token)
2. 创建 DNSPod API Token（注意：是 Token，不是密钥对）

```bash
export DP_Id="your_dnspod_id"
export DP_Key="your_dnspod_token"

acme.sh --issue --dns dns_dp -d example.com -d *.example.com
```

> **选择建议**：如果域名在腾讯云 DNS 上管理，使用 `dns_tencent`；如果通过 DNSPod.cn 独立账户管理，使用 `dns_dp`。

### 4.4.3 华为云 DNS（dns_huaweicloud）

1. 登录华为云 IAM 控制台
2. 创建 IAM 用户，授予 `DNS FullAccess` 权限
3. 获取账户域名（DomainName，即账号名）

```bash
export HUAWEICLOUD_Username="your_iam_username"
export HUAWEICLOUD_Password="your_iam_password"
export HUAWEICLOUD_DomainName="your_account_domain_name"

acme.sh --issue --dns dns_huaweicloud -d example.com -d *.example.com
```

> **注意**：华为云的 DomainName 是登录账号的"账号名"，不是邮箱，在华为云控制台右上角可以查看。

### 4.4.4 百度云 DNS（dns_baidu）

1. 登录[百度云 API 密钥管理](https://console.bce.baidu.com/iam/#/iam/accesslist)
2. 创建 AccessKey

```bash
export BAIDU_Cloud_ID="your_access_key_id"
export BAIDU_Cloud_Key="your_access_key_secret"

acme.sh --issue --dns dns_baidu -d example.com -d *.example.com
```

### 4.4.5 京东云 DNS（dns_jd）

1. 登录[京东云 API 密钥控制台](https://uc.jdcloud.com/account/accesskey)
2. 创建 AccessKey

```bash
export JD_ACCESS_KEY_ID="your_access_key_id"
export JD_ACCESS_KEY_SECRET="your_access_key_secret"

# 可选：指定区域（默认 cn-north-1）
export JD_REGION="cn-north-1"

acme.sh --issue --dns dns_jd -d example.com -d *.example.com
```

### 4.4.6 西部数码（dns_west_cn）

1. 登录[西部数码 API 配置页面](https://www.west.cn/manager/API/APIconfig.asp)
2. 获取 API 密钥（需要取 MD5 加密后的密钥）

```bash
export WEST_Username="your_username"
export WEST_Key="md5_encrypted_api_key"

acme.sh --issue --dns dns_west_cn -d example.com -d *.example.com
```

### 4.4.7 DNS.LA（dns_la）

1. 登录 [dns.la 控制台](https://console.dns.la/account-msg)
2. 获取 AppID 和 API Secret

```bash
export LA_Id="your_appid"
export LA_Sk="your_api_secret"

acme.sh --issue --dns dns_la -d example.com -d *.example.com
```

### 4.4.8 名字.com（dns_namecom）

```bash
export Namecom_Username="your_username"
export Namecom_Token="your_api_token"

acme.sh --issue --dns dns_namecom -d example.com -d *.example.com
```

### 4.4.9 CloudDNS（dns_clouddns）

部分国内用户使用 CloudDNS：

```bash
export CLOUDDNS_EMAIL="your@email.com"
export CLOUDDNS_PASSWORD="your_password"

acme.sh --issue --dns dns_clouddns -d example.com -d *.example.com
```

---

## 4.5 DNS Persist 模式（新特性）

### 4.5.1 概述

DNS Persist 模式（基于 draft-ietf-acme-dns-persist-01）是 acme.sh 最新支持的特性，专为**无 DNS API、但希望实现自动续期**的场景设计。

传统手动 DNS 模式的问题：每次续期都需要手动更新 TXT 记录。

DNS Persist 模式的解决方案：**只需手动添加一次特殊 TXT 记录**，之后 acme.sh 可以永久自动续期，无需再次手动操作。

### 4.5.2 使用步骤

**第一步：生成持久化验证值**

```bash
acme.sh --make-dns-persist-value -d example.com
```

输出示例：

```
[Mon 15 Jan 2024 10:00:00] Add the following TXT record:
[Mon 15 Jan 2024 10:00:00] Domain: '_validation-persist.example.com'
[Mon 15 Jan 2024 10:00:00] TXT value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
[Mon 15 Jan 2024 10:00:00] Once the record is added, you can use --dns-persist to issue/renew.
```

**第二步：手动在 DNS 控制台添加 TXT 记录**

- 记录名：`_validation-persist.example.com`
- 记录类型：`TXT`
- 记录值：命令输出的字符串

**第三步：申请证书（含通配符）**

```bash
acme.sh --issue -d example.com -d *.example.com --dns-persist
```

之后所有续期都会自动进行，无需任何手动操作。

> **注意**：DNS Persist 模式需要 CA 支持，目前主要在 Let's Encrypt 测试环境和部分 CA 上可用。

---

## 4.6 DNS 别名模式（DNS Alias Mode）

### 4.6.1 概述

DNS 别名模式适用于以下场景：
- 主域名的 DNS 服务商没有提供 API
- 出于安全考虑，不想把主域名的 DNS API Key 存放在服务器上
- 多服务器共用一个 DNS API Key 进行验证

**原理**：将 ACME 挑战的 TXT 记录 CNAME 到另一个域名（该域名支持 API 操作），acme.sh 通过操作该别名域名的 DNS 来完成验证。

### 4.6.2 配置步骤

**第一步**：在主域名 DNS 控制台添加 CNAME 记录（一次性手动操作）：

```
_acme-challenge.example.com  CNAME  _acme-challenge.challenge.anotherdomain.com
```

**第二步**：确保 `challenge.anotherdomain.com` 的 DNS 支持 API 操作（如使用 Cloudflare）：

```bash
export CF_Token="your_cloudflare_token"
export CF_Account_ID="your_account_id"

# 使用 DNS 别名模式申请证书
acme.sh --issue --dns dns_cf \
  -d example.com \
  -d *.example.com \
  --challenge-alias challenge.anotherdomain.com
```

acme.sh 会将 TXT 记录写入 `challenge.anotherdomain.com` 域，而主域名通过 CNAME 解析到该域，CA 可以验证成功。

---

## 4.7 DNS 传播等待时间调整

不同 DNS 服务商的 TTL 和记录传播时间不同，有时需要调整等待时间：

```bash
# 为当次申请设置等待时间（秒）
acme.sh --issue --dns dns_ali -d example.com --dnssleep 120

# 为特定域名设置持久等待时间（保存到配置）
acme.sh --issue --dns dns_ali -d example.com
# 编辑 ~/.acme.sh/example.com/example.com.conf，添加：
# Le_DNSSleep=120
```

各 DNS 服务商推荐等待时间参考：

| DNS 服务商 | 推荐等待时间 |
|-----------|------------|
| 阿里云 DNS | 60-120 秒 |
| 腾讯云 DNS | 60-120 秒 |
| Cloudflare | 默认（极快）|
| GoDaddy | 600 秒 |
| Linode | 900 秒 |
| AWS Route53 | 60-120 秒 |

---

## 4.8 小结

本章介绍了 DNS-01 验证的所有模式：

- **手动 DNS 模式**：适合一次性申请，无法自动续期
- **DNS API 自动模式**：推荐生产环境使用，支持通配符，自动续期
- **DNS Persist 模式**：新特性，一次手动操作，永久自动续期
- **DNS 别名模式**：适合主域名 DNS 无 API 的场景

下一章将专门介绍 acme.sh 与中国各大主流云服务商的集成使用。
