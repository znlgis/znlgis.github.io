---
layout: default
title: 第18章 - AI 助手、MCP 与智能体技能
---

# 第18章 - AI 助手、MCP 与智能体技能

GeoLibre 有三条与 AI 相关的路径，它们经常被混为一谈，但服务的是完全不同的场景：

- **AI Assistant**：在应用**内部**，用自然语言驱动你正在看的这张地图；
- **MCP 服务器**：在应用**外部**（Claude Desktop、Claude Code、任何 MCP 客户端），把一句话变成一个真正的 `.geolibre.json` 工程文件；
- **agent skill**：一段给外部编码智能体的 `SKILL.md`，教它"什么时候用哪条路、哪些规则最容易踩坑"。

本章按"配置 → 使用 → 能力边界 → 外部集成"的顺序展开。第 18.2–18.12 节讲 AI 助手，第 18.13–18.17 节讲 MCP 服务器，第 18.18 节讲 agent skill。

> **说明**：本章基于 GeoLibre 3.4。Provider 名称、环境变量名、工具名、MCP 参数均保留英文原文，叙述用中文。事实来源为仓库 `docs/user-guide/ai-assistant.md`、`docs/mcp.md`、`docs/agent-skill.md`、`docs/user-guide/settings.md`、`skills/geolibre/SKILL.md`、`skills/geolibre/references/`。

---

## 18.1 三条路径的分工

先看一张表，后面所有细节都挂在这张表上。

| | AI 助手 | MCP 服务器 | agent skill |
| --- | --- | --- | --- |
| **跑在哪** | 应用内 | 你的 MCP 客户端里（应用外） | 你的智能体里（应用外） |
| **作用对象** | 你正在看的那张地图 | 磁盘上的 `.geolibre.json` | 智能体的工作方式 |
| **需要什么** | 一个配置好的 Provider | `pip install "geolibre[mcp]"` | 一个能加载 skill 的运行时 |
| **产物** | 可 Ctrl/Cmd+Z 撤销的编辑 | 工程文件 / 独立 HTML | 智能体写出的工程或页面 |
| **典型输入** | "把县按人口分级着色" | "给我做一张…的地图" | "帮我做个地图" |

三者可以**串起来用**：智能体用 MCP 写出工程，你在 GeoLibre 打开，再用 AI 助手继续改。这正是官方推荐的组合方式。

> **注意**：AI 助手**不能**替你生成工程文件并落盘，MCP 也**不能**动你眼前这张地图（除了 `live_*` 那一组，见 18.15.6）。分不清这两件事，是新手最常见的期待落差。

---

## 18.2 AI 助手的定位与打开方式

### 18.2.1 它是什么

AI 助手是一个"和你的数据聊天"的面板，把自然语言请求翻译成 **GeoLibre 自己的操作**——Spatial SQL、图层样式、地图控制——并且**通过应用本身**执行，而不是绕过应用去戳地图。

这句话的技术含义是：它的写操作走 store，与手动操作走同一条单向数据流。于是：

- 几乎每一个动作都能用 **Ctrl/Cmd + Z** 撤销；
- 每一次工具调用（包括它生成的 SQL）都显示在对话记录里，可审计；
- 图层面板、样式面板看到的状态与它改完的状态一致，不会出现"地图变了但面板没变"。

### 18.2.2 打开与关闭

| 入口 | 说明 |
|------|------|
| **Processing → AI Assistant** | Processing 菜单最上面一项 |
| **命令面板** | Ctrl/Cmd + K 搜 "AI Assistant" |

面板**停靠在窗口底部**，可拖动上边缘改变高度，右上角 **✕** 关闭。它不遮挡地图，可以和属性表、图层面板同时开着。

### 18.2.3 默认是关的

助手**默认关闭**，直到你配置了 Provider，或部署方启用了托管 AI 代理。在发送第一条提示词之前，**没有任何数据离开你的机器**。

---

## 18.3 配置 Provider

### 18.3.1 八个 Provider

助手是**可插拔**的，底层用 [Strands Agents](https://strandsagents.com) SDK。在 **Settings → AI Providers** 中配置一个或多个。

| Provider | 环境变量 | 默认模型 |
| --- | --- | --- |
| Google Gemini | `GEMINI_API_KEY` 或 `GOOGLE_API_KEY` | `gemini-3.6-flash` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-opus-5` |
| OpenAI | `OPENAI_API_KEY` | `gpt-5.6` |
| **OpenRouter** | `OPENROUTER_API_KEY`（可选 `OPENROUTER_MODEL`） | `openai/gpt-5.6-luna` |
| **Vercel AI Gateway** | `AI_GATEWAY_API_KEY`（可选 `AI_GATEWAY_MODEL`） | `openai/gpt-5.6-luna` |
| **Ollama**（本地） | `OLLAMA_BASE_URL`（例如 `http://localhost:11434`） | `gemma4` |
| **Amazon Bedrock** | `AWS_ACCESS_KEY_ID` 加 `AWS_SECRET_ACCESS_KEY`（可加 `AWS_REGION`、`AWS_SESSION_TOKEN`） | `global.anthropic.claude-opus-5` |
| **Custom**（OpenAI 兼容） | `OPENAI_COMPATIBLE_BASE_URL`（可选 `OPENAI_COMPATIBLE_API_KEY`）与 `OPENAI_COMPATIBLE_MODEL` | — |

几条补充：

- **Ollama** 在你自己机器上跑模型，不需要 key，数据不出本机。`OLLAMA_BASE_URL` 指向 Ollama 主机即可（`/v1` 后缀自动补），`OLLAMA_MODEL` 选已 pull 的模型。
- **Bedrock** 在浏览器里用你的凭据直接调 AWS，模型 id 是推理配置文件 id（如 `global.anthropic.claude-sonnet-4-6`），`BEDROCK_MODEL` 可换。
- **OpenRouter** 在浏览器里调它的 Chat Completions API。模型选择器会**不携带你的 key** 拉公开目录；可按名字/id 搜，也可直接填未收录的 `provider/model`。
- **Vercel AI Gateway** 用同一个 `AI_GATEWAY_API_KEY` 覆盖网关上的所有模型；BYOK 凭据留在 Vercel 后台，不替代网关 key。
- **Custom** 覆盖任何 OpenAI 兼容端点：LiteLLM、vLLM、Groq、Together、本地服务器等。

> **提示**：Hosted 的 key（以及 AWS 凭据）**从浏览器直接**发给 Provider，从不经过 GeoLibre 的服务器。保存设置后面板**立刻**可用，不需要重启。

### 18.3.2 配置档案（profile）

1. **Settings → AI Providers**；
2. **Add profile**，给一个名字（例如 *Work Gemini*、*Local Ollama*）；
3. 选 Provider，填它要求的字段；
4. **Save profile**；
5. 其中一个点 **Set as default**，助手打开时用它。

凭据保存在**当前设备**，从不写进工程文件；系统钥匙串可用时，密文字段进钥匙串。**一个配置好的 profile 就够开始聊天。**

### 18.3.3 密钥从哪里来：三层来源

| 来源 | 适用范围 | 优先级 |
|------|----------|--------|
| **Settings → Environment Variables** 里填的值 | 全平台 | 最高 |
| **操作系统环境变量** | **仅桌面版** | 次之（只补空缺） |
| **构建时注入**（自托管） | 全平台 | 取决于打包方式 |

桌面版会从 OS 环境变量里读一份**白名单**，白名单**在原生后端里强制执行**，不只是 UI 过滤：

| 分组 | 读取的变量 |
|------|------------|
| Provider / 模型覆盖 | `GEOLIBRE_ASSISTANT_PROVIDER`、`GEOLIBRE_ASSISTANT_MODEL` |
| Google Gemini | `GEMINI_API_KEY`、`GOOGLE_API_KEY`、`GOOGLE_GENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY`、`OPENROUTER_MODEL` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY`、`AI_GATEWAY_MODEL` |
| Ollama | `OLLAMA_BASE_URL`、`OLLAMA_MODEL` |
| Custom（OpenAI 兼容） | `OPENAI_COMPATIBLE_BASE_URL`、`OPENAI_COMPATIBLE_API_KEY`、`OPENAI_COMPATIBLE_MODEL` |
| 联网搜索 | `TAVILY_API_KEY` |
| 快速路径与工具检索 | `JEV_API_KEY` |

- **优先级**：Settings → Environment Variables 里的值永远赢；OS 环境只填空。
- 由环境变量提供的字段会在设置里标出"由哪个变量提供"，该字段留空即继续用环境值。
- **改了 OS 变量要重启应用**才生效；网页版与 Jupyter 版**读不到**系统环境，只能填 Settings 或构建时注入。

> **警告**：Bedrock 的 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`（以及 `OLLAMA_HOST`）被**刻意排除**在 OS 环境读取之外。原因很实际：开发者 shell 里常年导着 AWS 凭据，若被静默采纳，助手一开就可能拿你的 AWS 账单跑 LLM。要用 Bedrock，请在 **Settings → Environment Variables** 里显式填。

### 18.3.4 多个 Provider 时怎么切

配置了多个 key 之后，面板头部会出现 **provider** 下拉与 **model** 下拉；你的选择**跨会话记住**。

部署方还可以用两个变量强制：

| 变量 | 作用 |
|------|------|
| `GEOLIBRE_ASSISTANT_PROVIDER` | 强制 Provider（`google` / `anthropic` / `openai` / `openrouter` / `vercel`） |
| `GEOLIBRE_ASSISTANT_MODEL` | 钉死模型 id，覆盖默认值与选择器 |

---

## 18.4 让本地 Ollama 被网页版访问

网页版的页面来源是 `https://web.geolibre.app`，浏览器要直连你机器上的 Ollama，**Ollama 必须显式允许这个来源**。这是一个 Ollama 侧的权限，网页无法自动打开。

先给 Ollama 服务器设环境变量，然后重启它：

```text
OLLAMA_ORIGINS=https://web.geolibre.app
```

再在 **Settings → AI Providers** 里加/改一个 **Ollama** profile，Base URL 填：

```text
http://localhost:11434
```

各平台设置方式：

| 平台 | 做法 |
|------|------|
| **Linux（systemd）** | `sudo systemctl edit ollama.service`，加 `[Service]` 段的 `Environment="OLLAMA_ORIGINS=https://web.geolibre.app"`，然后 `sudo systemctl daemon-reload` 与 `sudo systemctl restart ollama` |
| **macOS** | `launchctl setenv OLLAMA_ORIGINS "https://web.geolibre.app"`，然后退出并重开 Ollama |
| **Windows** | 从任务栏退出 Ollama → 打开"编辑账户的环境变量" → 新建用户变量 `OLLAMA_ORIGINS`，值为 `https://web.geolibre.app` → 从开始菜单重新启动 Ollama |
| **Docker** | `docker run -d -e OLLAMA_ORIGINS=https://web.geolibre.app -p 11434:11434 ollama/ollama` |

自托管 GeoLibre 时，把 `https://web.geolibre.app` 换成 GeoLibre 报错信息里给出的**精确来源**（含 scheme 与端口），例如 `http://192.168.1.98:4000`。

> **提示**：桌面版没有这层限制——它走 Tauri 的原生 HTTP 客户端，不受浏览器同源策略约束。

---

## 18.5 Docker 托管 AI：不分发 key 的做法

部署方可以"提供 AI 但不下发 Provider key"。这种模式下：

1. 浏览器调用**同源**的 `/ai` 路由；
2. Docker 里的 nginx 在配置了 HTTP Basic Auth 时校验实例账号；
3. nginx 再加上一个**只存在于服务器**的实例 token，转发到 `ai.geolibre.app`；
4. 浏览器既拿不到实例 token，也拿不到 Cloudflare AI Gateway 的 token。

用户只需登录 GeoLibre 实例，**不需要配置任何 Provider key**。直接打 `ai.geolibre.app` 而不带服务器 token 的请求会得到 **401 Unauthorized**。

启动容器时必须带齐托管 AI 的变量：

```bash
docker run --rm -p 8080:80 \
  -e GEOLIBRE_AUTH_USER=admin \
  -e GEOLIBRE_AUTH_PASSWORD='change-me' \
  -e GEOLIBRE_AI_URL=/ai \
  -e GEOLIBRE_AI_MODEL=openai/gpt-5.6-luna \
  -e GEOLIBRE_AI_PROXY_URL=https://ai.geolibre.app \
  -e GEOLIBRE_AI_PROXY_TOKEN="$GEOLIBRE_AI_PROXY_TOKEN" \
  ghcr.io/opengeos/geolibre:latest
```

| 变量 | 作用 |
|------|------|
| `GEOLIBRE_AUTH_USER` / `GEOLIBRE_AUTH_PASSWORD` | 实例的 HTTP Basic Auth 账号 |
| `GEOLIBRE_AI_URL` | 浏览器使用的同源路由，通常是 `/ai`；**未设置则托管代理整体关闭**，也不会向应用注入任何 AI 代理 URL |
| `GEOLIBRE_AI_MODEL` | 托管模式下使用的模型 id |
| `GEOLIBRE_AI_PROXY_URL` | 上游代理地址 |
| `GEOLIBRE_AI_PROXY_TOKEN` | 服务器侧 token，不下发浏览器 |

> **注意**：NASA OPERA 灾害工作流的新闻检索需要 `TAVILY_API_KEY`，它应作为 **secret 设在 `geolibre-ai-proxy` Worker 上**，不要用 `docker run -e` 传给容器——容器根本不读它。

---

## 18.6 使用方式与交互细节

### 18.6.1 键盘

| 按键 | 动作 |
|------|------|
| **Enter** | 发送 |
| **Shift + Enter** | 换行 |
| **Ctrl/Cmd + Enter** | 仍然发送（习惯 QGIS/编辑器的人常用） |

### 18.6.2 运行状态

- 回复**流式**返回，工具按需调用，做完会报告做了什么；
- 工作时 **Send** 变成 **Stop**，点它取消；
- **Clear**（橡皮擦图标）开一段新对话。

### 18.6.3 提示词的三种写法

| 写法 | 例子 | 说明 |
|------|------|------|
| 单步 | "把道路缓冲 100 米" | 一次工具调用 |
| 链式 | "把道路缓冲 100 米，然后裁剪到县界" | 一句话里多步 |
| 递进 | 先"按人口着色"，再说"改成 7 级" | 跨轮细化 |

---

## 18.7 能力清单与边界

助手**只能调用一组固定工具**，它不能发明操作——这是它比"让模型写代码直接跑"更安全的原因。

| 能力 | 具体做什么 |
| --- | --- |
| **查看图层** | 列出已加载图层、几何类型、属性字段名、SQL 表名（**只有 schema，不含你的完整数据**） |
| **自然语言转 Spatial SQL** | 生成并执行**只读** DuckDB Spatial SQL（走 SQL Workspace），可把结果加成图层 |
| **地理处理** | 运行已注册的处理算法（buffer、clip、dissolve、intersection、difference、union、spatial join、simplify、H3 格网等），可串成多步流水线，每步结果加为图层 |
| **栅格工具** | 检索 Whitebox 目录并在浏览器里用 WASM 运行——水文（填洼、汇流、提取河网）、地形（坡度、坡向、晕渲）、LiDAR、影像处理、栅格矢量互转 |
| **Model Builder** | 用一段描述生成**可编辑、已校验**的模型图，随工程保存，并先打开给你审阅再运行；画布有未保存内容或仍在跑时会先询问 |
| **符号化** | 给图层套**分级**（数值）或**分类**（文本）色带 |
| **添加数据** | 从公开 GeoJSON URL 加图层；按名字加 XYZ 底图（`osm`、`opentopomap`、`carto-dark`）或自定义 `{z}/{x}/{y}` URL |
| **对地观测** | 检索 Microsoft Planetary Computer 的 STAC 目录（Sentinel-2、Landsat、NAIP、DEM 等），把当前视图上的一景加为栅格图层（瓦片由服务端签名，无需凭据） |
| **地图控制** | 移动相机（适配图层或 bbox）、切底图、切换图层可见性/不透明度、删除图层 |
| **联网搜索** | 查当前信息（配 `TAVILY_API_KEY` 效果最好） |
| **插件工具** | 调用已安装插件注册的工具；当插件**声明了助手工具**而当前是关的，可以按名字或按任务把它打开 |
| **代码兜底** | 没有专用工具时，运行一小段 **JavaScript**（针对当前地图，例如切球面投影）或 **Python**（在 Pyodide 运行时里） |

> **注意**：代码兜底是**唯一**不经过 store 的路径。它对地图的直接修改**不可撤销**，代码会显示在对话记录里。其余所有能力都走 store，都可撤销。

---

## 18.8 快速路径：六个命令不走大模型

有些请求是**纯路由**——"隐藏河流"、"底图换成暗色"、"缩放到县界"——不需要推理、不需要 SQL、不需要代码，只要一个意图加一个图层 id。把它们送给大模型，仍然要付一次带系统提示词和全部工具定义的往返。

如果配置了 [TypeSafe](https://typesafe.ai) 的凭据，GeoLibre 用 **Jev** 路由这类请求：它返回**带类型的判断**而不是生成文本，然后执行与慢路径**完全相同**的那个工具。

实测（以本仓库自己的提示词为基准）：托管模型上约 **3.8 秒**（本地模型约 **0.8 秒**）的等待，变成约 **190 毫秒**。

它只覆盖**六条**命令：

| 命令 | 例子 |
|------|------|
| 切换底图样式 | "把底图换成暗色" |
| 添加指定瓦片底图 | "加 OpenTopoMap" |
| 显示/隐藏图层 | "隐藏河流" |
| 改图层不透明度 | "把城市图层设成半透明" |
| 缩放到图层 | "缩放到县界图层" |
| 删除图层 | "删掉高程栅格" |

其余一切——查数据、地理处理、按属性着色、加数据、跑代码——都判为"复杂"，照旧走你的 LLM。路由**没把握**、匹配不到图层、TypeSafe 慢/不可达/未配置，也一律回退到 LLM。**快速路径永远不会成为请求失败的原因。**

它不是免费的：路由发生在模型请求**之前**，所以复杂请求要等路由答案（通常 200 ms 内，1.5 秒后放弃）才开始 LLM 往返。多秒级的模型回合里这点开销不大，但确实存在——这也是它默认关闭的第二个理由。

### 18.8.1 启用

| 场景 | 做法 |
|------|------|
| **桌面版** | 在 **Settings → Environment Variables** 填 `JEV_API_KEY`，或在 shell 里导出后启动应用；走 Tauri 原生 HTTP 客户端 |
| **Web / Docker** | `api.typesafe.ai` 拒绝浏览器来源，个人 key 在浏览器里**无效**。由部署方在 [AI proxy Worker](https://github.com/opengeos/GeoLibre/tree/main/workers/ai-proxy) 上设 `JEV_API_KEY`，它在 `/systemone` 暴露路由端点，凭据留在服务端：`cd workers/ai-proxy && npx wrangler secret put JEV_API_KEY` |
| **本地开发** | `npm run dev` 在给定凭据时自己代理 `/systemone`：`GEOLIBRE_AI_PROXY_TOKEN=… npm run dev`（走已部署 Worker，推荐）或 `JEV_API_KEY=… npm run dev`（直连 TypeSafe） |

安全约束：**另一个来源上的路由端点必须用 HTTPS**，明文 HTTP 被拒绝——它返回的答案决定助手执行哪个工具。回环地址与同源端点是例外。

> **警告**：启用快速路径意味着**提示词文本与你的图层名**会发到 TypeSafe。对"本地 Ollama、本来什么都不出机器"的配置来说，这是实打实的取舍。

---

## 18.9 Whitebox 语义检索：775 个工具怎么找

同一个凭据还改变助手检索 **Whitebox 目录**的方式——那是 775 个栅格、地形、水文、LiDAR 与影像工具，多到不可能一次全塞给模型。

| 检索方式 | 机制 | 效果 |
|----------|------|------|
| **仅子串（未配置）** | 目录内按子串过滤 | 只有当模型已经猜到目录用的那个词才管用。说"grainy"，四个斑点滤波工具一个也匹配不到 |
| **语义合并（已配置）** | 两个问题交给 Jev：先定位目录的哪一段，再定位段内哪个工具；结果排在子串命中之前 | 普通语言也能找到 |

官方在 20 个栅格请求上的实测：

| 助手搜索的是 | 找对工具 | 排在第一位 |
| --- | --- | --- |
| 关键词，仅子串（之前） | 19/20 | 8/20 |
| 关键词，合并后 | 19/20 | **15/20** |
| 用大白话描述，仅子串（之前） | 0/20 | 0/20 |
| 用大白话描述，合并后 | **19/20** | **19/20** |

代价：给一次"模型本来就在等"的工具调用增加约 **400 ms**；且与快速路径一样，它**只能增加候选**——TypeSafe 不可达/慢/未配置时，检索退回原来的子串过滤。

> **注意**：两次检索都读工具的 `summary`，775 个里 770 个有。缺的五个是 `assign_projection_lidar`、`assign_projection_raster`、`assign_projection_vector`、`reproject_lidar`、`reproject_raster`——它们在工具分类里但不在运行时目录里，所以只按名字与分类匹配。

---

## 18.10 语音命令

浏览器支持语音识别时，输入区会多一个**麦克风**按钮。你说的话走**同一个 agent、同一套工具**——因此同样可审计、可撤销。

| 手势 | 模式 | 怎么结束 |
|------|------|----------|
| **点麦克风** | 开放麦克风——持续听，停顿约 **2.5 秒**后发送，句中短暂停顿会被合并 | 再点一次 |
| **按住 Space 半秒** | 对讲机（push-to-talk）——一个回合 | 松开 Space |

对讲机刻意设计成"按住"：轻点 Space 仍然是激活当前焦点控件，输入框里的空格永远是空格，快捷键不会干扰正常输入。只有助手面板打开时才生效。

回答会**朗读**出来，麦克风旁的**扬声器**按钮可关掉（选择会被记住）。只有**说出来的**问题才会被朗读——开着麦克风时打字，回答保持静音。朗读会跳过代码块与 URL，长回答只读前几句；完整内容始终在对话记录里。

几个边角行为：

- **朗读期间麦克风关闭**，避免助手把自己的回答再转录一遍。要打断对讲机回答，再按住 Space——新一轮会立刻停止播放。开放麦克风会在回答结束后自动重开，按钮可以更早停掉；Space 刻意不碰开放麦克风，误按不会切断你主动开的会话。
- **它工作时再说话会取消当前运行**，用你刚说的内容重新开始，与发一条新消息等价。
- **识别用的是浏览器的能力**：Chrome、Edge、Safari 提供；Firefox 与桌面（Tauri）构建不提供，因此那里干脆不显示麦克风。Chrome 的实现会把音频发给 Google 的语音服务——与你的 AI Provider 是两条独立链路。
- **它按应用语言听**，并用浏览器区域变体细化（应用是 `pt`、浏览器是 `pt-BR` 时按 `pt-BR` 听）。

---

## 18.11 示例提示词

提示词是自由的，下面是起点而非固定命令。**用图层名指代数据**，其余由助手查。

**探查与查询**

```text
what layers are loaded, and what fields does the parcels layer have?
how many parcels are larger than 1 hectare?
list the 10 most populous counties with their population
show parcels within 500 m of a river and add them as a layer
count points in each polygon of the districts layer
```

**地理处理**

```text
buffer the roads by 100 meters
buffer the roads by 100 m, then clip the buffer to the county boundary
create a Model Builder model that buffers roads by 100 m, clips the result to counties, and names the output Road buffers
dissolve the parcels by zoning type
find where the floodplain overlaps the buildings (intersection)
create an H3 hex grid at resolution 8 over the points and count points per cell
```

**符号化**

```text
color the counties by population with a graduated red ramp
style the parcels categorized by land-use type
shade the tracts by median income using a viridis ramp with 7 classes
```

**加数据与影像**

```text
load the latest Sentinel-2 scene over this view
add the most recent cloud-free Landsat image for this area
search the Planetary Computer for NAIP imagery here
add an OpenTopoMap basemap
add this GeoJSON: https://example.com/data.geojson
```

**地图控制**

```text
zoom to the parcels layer
fly to San Francisco
switch to a dark basemap
hide the buildings layer and set the parcels opacity to 0.5
remove the temporary buffer layer
```

**高级（代码兜底）**

```text
switch the map to a 3D globe projection
enable terrain with hillshade exaggeration of 1.5
load a CSV from a URL with pandas and summarize its columns
```

---

## 18.12 安全、隐私与限制

### 18.12.1 五条设计约束

1. **通过 store 行动**：图层、样式、底图、增删都走与手动操作相同的数据流，因此状态一致，并且被撤销/重做覆盖。
2. **可审计**：生成的 SQL 与每一次工具调用都在对话记录里。
3. **只读 SQL**：`run_sql` 拒绝任何不是 `SELECT` / `WITH` 的查询。
4. **上下文最小化**：发给模型的只有图层/表的**名字**、属性**字段名**与当前视图，**不包括要素数据**。
5. **明确"什么会离开浏览器"**：你发一条提示词时，它加上上述受限上下文，用你自己的 key 发给你选的 Provider。**不要在不能分享给该 Provider 的敏感数据上启用助手。**

### 18.12.2 TypeSafe 是第二个数据去向

- **快速路径**：发**提示词**与**图层名**。
- **工具检索**：发"助手正在目录里搜的那段文字"（**不含**图层名）。

两者都默认关闭；并且 GeoLibre 拒绝另一个来源上的**明文 HTTP** 路由端点。

### 18.12.3 限制

| 限制 | 说明 |
|------|------|
| 需要 Provider key | 不支持离线使用（除非本地 Ollama） |
| 语音需要 Web Speech API | Chrome、Edge、Safari；Firefox 与桌面版不可用 |
| 受 Provider 成本、速率限制、CORS/CSP 影响 | 浏览器侧调用尤其明显 |
| 不含非官方 Google Maps 瓦片端点 | 请用列出的官方底图或自备 XYZ URL |

## 18.13 MCP 服务器：安装、运行与客户端配置

### 18.13.1 它解决什么问题

GeoLibre 的 MCP 服务器把"给我做一张地图"变成一次**写文件**。它面向 MCP 客户端（Claude Desktop、Claude Code 或任何其它实现），把一个 `.geolibre.json` 工程写到磁盘上，你在桌面版、网页版或 `geolibre` Jupyter 组件里打开它，也可以直接导出成独立 HTML。

关键在于**工程编制工具是全无头的**：不需要浏览器、不需要运行中的 GeoLibre、不需要打包好的网页构建。它们用与 Python 包**同一套 project builder** 生成工程，所以写出的文件与桌面/web 版能加载的工程**逐字节同类**。

另一半是 `live_*` 系列，它们走桌面版 Notebook 面板的中继（见 [第19章 Python 控制台、Notebook 与 Jupyter 集成](https://znlgis.github.io/gis/tutorial/GeoLibre/第19章-Python控制台Notebook与Jupyter集成/)），让 MCP 客户端直接推动已经打开的地图。

### 18.13.2 安装

MCP SDK 是可选依赖：

```bash
pip install "geolibre[mcp]"
```

### 18.13.3 运行

```bash
geolibre-mcp --root ~/maps
```

| 参数 / 变量 | 说明 |
|-------------|------|
| `--root` | 可重复，声明工作区根目录 |
| `GEOLIBRE_MCP_ROOTS` | 环境变量版；`:` 分隔（Windows 用 `;`） |
| 两者都不给 | 工作区就是当前目录 |
| `--transport` | 默认 `stdio`（桌面客户端 spawn 用）；可选 `streamable-http` 或 `sse` |

### 18.13.4 客户端配置

Claude Desktop（`claude_desktop_config.json`）与大多数客户端用同一个形状：

```json
{
  "mcpServers": {
    "geolibre": {
      "command": "geolibre-mcp",
      "args": ["--root", "/Users/you/maps"]
    }
  }
}
```

Claude Code 一行命令：

```bash
claude mcp add geolibre -- geolibre-mcp --root ~/maps
```

如果 `geolibre-mcp` 不在客户端的 `PATH` 里（装进 virtualenv 时很常见），给解释器：

```json
{
  "mcpServers": {
    "geolibre": {
      "command": "/path/to/venv/bin/python",
      "args": ["-m", "geolibre.mcp", "--root", "/Users/you/maps"]
    }
  }
}
```

> **提示**：Windows 上把路径写成 `C:/Users/you/maps`（正斜杠）最省事；反斜杠在 JSON 里要成对写，容易错。

---

## 18.14 工作区限制与写盘规则

这一节是 MCP 的安全模型，值得逐条读——它决定了"为什么有些路径就是不进去"。

### 18.14.1 路径解析

- 每次工具调用里的每个路径，都在**碰它之前**先按允许的根解析；
- 根之外的路径**拒绝**；
- 根内指向根外的**符号链接也拒绝**；
- 相对路径相对**第一个根**解析，所以客户端可以说 `city.geolibre.json` 而不必知道宿主布局。

### 18.14.2 写盘的三道闸

| 闸门 | 规则 |
|------|------|
| 扩展名 | 只写 `.json`（工程）或 `.html`（导出）；光秃秃的 `.json` 没有名字也拒绝 |
| 覆盖 | 除非调用里带 `overwrite`，否则不覆盖已存在文件 |
| 目标校验 | 编辑已有工程的工具会先确认"它确实是一份工程"，所以根目录里某个无关的 `package.json` 不会被改写成地图 |

> **警告**：给它一个**专门放地图的目录**，不要给家目录。这条建议来自官方文档，不是客套话——工作区根是信任边界，不是"方便而已"。

### 18.14.3 大小与网络

| 限制 | 数值 | 说明 |
|------|------|------|
| 内联 GeoJSON | **50 MB** | 超过请用 `add_vector_layer` 或瓦片源 |
| 读取的工程文件 | **256 MB** | 同上 |
| 远程抓取 | 每一跳都检查 | host 解析到私有/回环/链路本地地址即拒绝，防止用构造 URL 打云元数据端点 |

---

## 18.15 工具清单

下面按用途分组，括号里是工具名。

### 18.15.1 工程生命周期

| 工具 | 作用 |
|------|------|
| `create_project` | 写一个新空工程：名字、中心、缩放、底图 |
| `describe_project` | 汇总相机、底图、图层、地图控件；内联要素只报数量，不回显 |
| `get_point_cloud_annotations` | 每份点云被标成各类多少点、每个实例多少点，外加自定义类、3D 矢量与已存 3D 框（含状态与属性） |
| `set_point_cloud_classes` | 定义标注器的自定义类（码 19–255、名字、`#rrggbb` 颜色），保留既有标签与框 |
| `prelabel_point_cloud` | 在 LiDAR 图层的本地副本上跑预标注分类器，把变化的类写成标签（需 `geolibre[pointcloud]`） |
| `write_labeled_point_cloud` | 把工程的标签与实例 id 应用到本地 LAS/LAZ/COPC 副本（需 `geolibre[pointcloud]`） |
| `list_catalog` | 列出命名底图、色带、图例预设、`set_plugin_state` 可接受的插件 id，以及工作区根 |

> **提示**：`list_catalog` 是"第一个该调用的工具"。官方 SKILL.md 把"猜底图/色带名字"列为最常见的失败原因——猜出来的名字不报错，只是静默不生效。

### 18.15.2 添加图层

| 工具 | 用于 |
|------|------|
| `add_geojson_layer` | 内联进工程的矢量数据（URL、工作区文件或字面 GeoJSON）；自包含，也是**唯一能 `classify_layer` 的图层类型** |
| `add_vector_layer` | 大型远程 FlatGeobuf / GeoParquet / GeoJSON，原地读取 |
| `add_raster_layer` | COG，带波段、色带、重标定选项 |
| `add_tile_layer` | 栅格 XYZ 瓦片模板 |
| `add_tiles_layer` | PMTiles 档案与矢量瓦片服务 |
| `add_ogc_layer` | WMS 与 WMTS 端点 |
| `add_lidar_layer` | LAS/LAZ/COPC/EPT 点云，按 URL |
| `add_spaceborne_lidar_layer` | ICESat-2（ATL06/ATL08）或 GEDI（L2A/L2B/L4A）足迹，来自本地 HDF5 granule（需 `geolibre[spaceborne]`） |
| `add_3d_tiles_layer` | OGC 3D Tiles tileset，URL 或 Cesium Ion asset id |
| `add_cesium_ion_layer` | Cesium Ion 资产（tileset 或影像），仅 3D 球渲染 |
| `add_czml_layer` | CZML 动态三维场景，URL 或内联 packets，仅 3D 球 |
| `add_cesium_kml_layer` | 原生球面 KML/KMZ（URL、内联 XML、KMZ data URL），保留文档样式与 overlay |

### 18.15.3 编辑

| 工具 | 作用 |
|------|------|
| `update_layer` | 改名、显隐、不透明度、重排 |
| `remove_layer` | 删图层 |
| `style_layer` | 合并样式键（`fillColor`、`strokeWidth`、`circleRadius` 等） |
| `set_layer_popup` | 设定点击弹窗的字段、标签、格式、宽度、图片高度，以及可选悬停提示 |
| `set_layer_metadata` | 编目元数据（标题、摘要、关键词、许可、署名、联系人、谱系、时段、链接）——即 Metadata 对话框编辑、并可导出 STAC Item 的那份 |
| `classify_layer` | 用数值列做分级设色 |
| `list_layer_properties` | 列出要素属性与样例值 |
| `set_layer_filter` | 用布尔 MapLibre 表达式隐藏不匹配的要素（等价于界面里"按表达式选择→过滤图层"）；省略表达式即清除 |
| `set_labels` | 按属性或文本表达式标注，可设字号、颜色、光晕、缩放范围、锚点等 |

图层可以用 **id 或显示名**寻址，所以客户端可以照着 `describe_project` 的输出干活，不必跟踪 UUID。

### 18.15.4 取景与装饰

| 工具 | 作用 |
|------|------|
| `set_view` | 设中心、缩放、方位、俯仰，或传 `bbox` 框一个范围 |
| `set_basemap` | 换背景样式 |
| `set_map_legend` | 显示地图图例（由各图层自身符号化生成） |
| `add_legend` | 用预设、`{label: color}` 字典或平行列表加图例 |
| `add_colorbar` | 为连续数据加色带 |
| `add_swipe` | 配置分屏对比滑块 |

### 18.15.5 插件状态与故事地图

| 工具 | 作用 |
|------|------|
| `set_plugin_state` | 保存插件的工程状态（它打开时恢复的那块数据，如时间滑块的时刻表）；内置 id 来自 `list_catalog`，外部插件需 `allow_unknown` |
| `set_story_map` | 设故事地图的标题块、主题、标记、小地图、起始/结束页 |
| `add_story_chapter` | 加一章：相机、文字、图片、对齐、动画、图层淡入淡出；省略的相机值取工程已保存视图 |
| `move_story_chapter` / `remove_story_chapter` | 按 id、标题或索引重排/删除章节 |
| `add_bookmark` | 把当前视图存进书签面板，可放进文件夹并指定打开时显示哪些图层 |
| `remove_bookmark` | 按 id、名字或索引删书签 |

这些数据形状与界面读取的一致（`@geolibre/core` 的 `parseProject`）；仓库里有往返测试，把工具写出的工程再读一遍，确认什么都没丢。

### 18.15.6 桌面实时地图

| 工具 | 作用 |
|------|------|
| `live_status` | 报告是否有 GeoLibre Desktop 在监听 |
| `live_list_layers` | 列打开地图的图层 |
| `live_fly_to` / `live_fit_bounds` / `live_zoom_to_layer` | 移动相机 |
| `live_set_basemap` | 换底图 |
| `live_add_geojson` / `live_remove_layer` | 加/删图层 |
| `live_set_visibility` / `live_set_opacity` / `live_set_style` | 改图层 |
| `live_list_algorithms` | 列应用内的处理算法与参数，可按 `query` 过滤 |
| `live_run_algorithm` | 在打开的地图上跑算法，返回日志与新增图层的 id |

**处理只能在实时路径上做**：算法目录与执行引擎（Turf.js、DuckDB-WASM）都在应用里，文件工具没有可跑的东西。中继等结果大约 **5 秒**；更久的运行会在应用里继续，工具会报告"没在时限内完成"而不是结果图层 id——所以再跑之前先 `live_list_layers` 看一眼。

前置条件：**每次启动应用后要打开一次 Processing → Jupyter Notebook**；面板随后可以关掉。Web 与 JupyterLite 没有中继，这些工具在那里无从附着。

### 18.15.7 导出

`export_html` 写一个独立页面：内嵌托管版 GeoLibre viewer，把工程注入进去，收件人无需安装。**凭据在出口前会被剥掉**。指向本地文件的图层对别人不会加载，要做可分享的导出就用托管 URL。

> **警告**：`export_html` 的 `app_url` 是**信任边界**。它指定导出页内嵌哪个 viewer，页面会把工程 POST 给**正好那个来源**（必须是 http/https）。这里之所以要强调，是因为**调用者是模型**，而模型可能在被它读到的内容影响。凭据已被剥离，不是 key 泄漏，但工程的其余部分（内联 GeoJSON、图层 URL、相机）确实会发过去。只接受你本来就想让它去的 `app_url`。

### 18.15.8 已知偏差

- **`set_view` 的 `bbox` 是近似的**：工程只存中心与缩放，应用加载时按原样应用，不会去 fit 一个存下来的 bbox。服务器自己用一个假定窗格尺寸把框解算成相机，落点与"缩放到图层"相差约半个缩放级别。需要精确取景就传 `center` 与 `zoom`。

---

## 18.16 聊天内地图预览（show_map）

### 18.16.1 它做什么

创建或改完工程后调用 `show_map(path="city.geolibre.json")`。支持 [MCP Apps](https://apps.extensions.modelcontextprotocol.io/) 的客户端会在对话里渲染一张**可交互、只读**的地图：保存的相机、GeoLibre 图层样式、平移缩放、点击识别。

其它客户端只收到文本/结构化摘要，**不含内联要素数据**。两个预览工具都**不写工程**。

App 用的是工作区的 `@geolibre/core` 与 `@geolibre/map/headless` 渲染器，不是托管 viewer 的 iframe。它画 MapLibre 原生图层（内联 GeoJSON、栅格/WMS/WMTS/XYZ 瓦片、矢量瓦片、图片 overlay）。

**其余东西不会被静默丢掉**——它们在状态提示里逐项点名：插件渲染的图层（点云、3D Tiles、COG、ArcGIS、PMTiles、DuckDB、deck.gl）、桌面本地源（MBTiles、`file:` 路径）、视频 overlay、带 Z 的 GeoJSON、活动插件、图例、地图控件、额外地图视图、非 MapLibre 主渲染器。Mapbox 底图是空白的，因为凭据被剥离。配置了图片字段的弹窗会把 URL 显示为文本。

### 18.16.2 能力前提

宿主必须支持 **App 调用服务器的工具**（`serverTools`）：预览通过 app-only 的 `get_map_preview` 载入"已脱敏工程"，再用 app-only 工具批准来源、取资源字节、关闭预览会话。**不要直接调用这些工具**；完整要素数据不在 `show_map` 对模型可见的结果里。

> **注意**：app-only 可见性依赖宿主遵守 `ui.visibility: ["app"]`。这**不是服务端认证**——忽略该元数据的客户端可以把脱敏工程与批准/抓取工具暴露给模型。所以那套同意 UI **不是**独立的服务端安全边界；授权、公网地址与资源上限仍由服务器强制。

### 18.16.3 网络同意

- 初始一张**同意面板**列出底图与可见、可渲染图层来源里已知的来源；**Allow all** / **Block all** 作用于这张表，包括底图样式加载后才开始加载的来源；
- **在批准之前不发出任何资源请求**；全部拦下时，内联数据仍可在空白底图上查看；
- 远程样式里新发现的来源会**并入同一张面板**，不会被此前的决定静默批准；已拦下的保持拦下；
- 面板支持明暗主题、窄屏与键盘操作。

**已批准的资源由 Python MCP 服务器抓取**，不是浏览器——目标看到的是服务器机器的 IP，可能与浏览器 IP 不同，提示里会明说。字节通过 app-only 工具回传。

### 18.16.4 硬限制

| 项 | 值 |
|----|-----|
| 允许的目标 | 公网 HTTP/HTTPS；回环、私有/LAN、链路本地、保留、多播地址**即使批准后**也拒绝 |
| 单个资源体 | **4 MiB**（base64 传输后约 5.3 MiB） |
| 网络超时 | **15 秒** |
| 内容编码 | 请求 identity 编码，**拒绝压缩响应** |
| 重定向 | 失败关闭（fail closed）——请直接用并批准目标 URL |
| 视频 | 抓取样式里的 video 源会被移除（MapLibre 走非同意路径加载视频） |
| 预览空闲过期 | **30 分钟**；成功批准与资源授权会刷新计时 |
| 来源授权有效期 | **5 分钟**，仅对本次预览中已允许的来源续期 |
| 并发预览会话 | 最多 **64**；到上限拒绝新会话而不是驱逐活跃预览 |
| 凭据 | 工程 URL 与源配置里的已知凭据在 App 收到之前脱敏；已知像凭据的 URL 参数被拒（`key`、`sr` 这类保守键即使装的是非密值也会被拒） |

> **警告**：指向私网的服务**不被此预览支持**。这不是"提示一下就能过"的限制，而是地址检查层面的拒绝。

---

## 18.17 渲染引擎与分屏编排

MCP 也能编排引擎与分屏：

```python
# 打开工程时用球面渲染器
set_renderer(path, "cesium")

# 建一个 1 行 2 列的混排网格，并把第二块指定为 MapLibre
panes = set_map_layout(path, 1, 2, view_kinds=["cesium", "maplibre"])
pane_id = panes["secondaryMapViews"][0]["id"]
set_renderer(path, "maplibre", pane_id=pane_id)
```

| 概念 | 说明 |
|------|------|
| 可选渲染器 | `maplibre`、`mapbox`、`cesium`、`arcgis` |
| 网格维度 | 1–4；`view_kinds` 每格一个渲染器，主视图在前 |
| 相机约定 | 仍是经纬度加共享的缩放、方位、俯仰 |
| 分屏 id | 返回在 `secondaryMapViews` 里，传给 `set_renderer` 的 `pane_id` 只改那一格 |
| 保存 | `primaryRenderer` 与各分屏的 `viewKind` 随工程保存 |

> **提示**：分屏让"球上看地形、平面看点云/大图层"成为一次演示里的事。Python 包里的 `set_map_layout` 与 `set_renderer` 是同一套语义，见第 19 章。

---

## 18.18 skills/geolibre：给外部智能体的说明书

### 18.18.1 它是什么

仓库里有一份 agent skill：`skills/geolibre/SKILL.md`——一份带 YAML frontmatter 的纯 Markdown，教外部编码智能体（Claude Code、Claude Desktop，或任何会加载 skill 的运行时）如何替你造 GeoLibre 地图。

目录结构：

| 文件 | 内容 |
|------|------|
| `SKILL.md` | 主文件：入口选择、工作流、易踩的规则、验收方法 |
| `references/mcp-tools.md` | 每个 MCP 工具及其参数，外加"按文件扩展名/服务类型选 `add_*` 工具"的对照表 |
| `references/python-api.md` | `geolibre.Map` 的 notebook / 无头生成配方，含 MCP 做不到的循环 |
| `references/project-json.md` | `.geolibre.json` 架构、最小有效工程、图层对象 |
| `references/catalog.md` | 底图、色带、图例预设、图层类型、支持格式、embed/URL 参数面 |

### 18.18.2 安装

```bash
git clone --depth 1 https://github.com/opengeos/GeoLibre /tmp/geolibre
mkdir -p ~/.claude/skills
cp -r /tmp/geolibre/skills/geolibre ~/.claude/skills/
```

要在某个仓库内生效，就把 `.claude/skills/` 放进项目里而不是家目录。之后**开一个新的 agent 会话**；请求匹配时 skill 会自己加载。

最短路径是同时装好它偏好的 MCP 服务器：

```bash
pip install "geolibre[mcp]"
claude mcp add geolibre -- geolibre-mcp --root ~/maps
```

没有 MCP 也能用——它会回退到 Python API，再回退到直接写工程 JSON。

### 18.18.3 它教什么：六步工作流

1. **`create_project`** —— 永远第一步。给 `path`（以 `.geolibre.json` 结尾）、`name`，知道的话再给 `center`（`[lng, lat]`）与 `zoom`（0 世界、约 4 国家、约 10 都市、约 14 城市）。
2. **加图层** —— 每份数据一个 `add_*_layer`，**先加栈底的**。按数据"是什么"选工具，而不是按你想看到什么。
3. **取景** —— `set_view` 给 `center`+`zoom`，或用 `bbox` 适配一个范围。
4. **样式** —— `style_layer` 合并样式键，或 `classify_layer` 用数值列做分级设色。
5. **装饰** —— `set_map_legend`（由图层自身样式生成）、`add_legend`（手写条目）、`add_colorbar`、`add_swipe`；`set_labels` 标注，`set_layer_filter` 隐藏不想要的要素，`add_story_chapter` 把工程变成滚动叙事。
6. **`export_html`** —— 一个自包含页面，收件人零安装打开。

> **提示**：用户想要"能看/能发"的东西时**一定以 `export_html` 收尾**。裸的 `.geolibre.json` 是"得装 GeoLibre 才能开的文件"，HTML 是"双击就能看的地图"。只有用户明确要工程、或还要继续编辑时才停在工程文件。

一个从零到导出的分级设色例子：

```text
create_project(path="counties.geolibre.json", name="Population by county",
               center=[-98.5, 39.8], zoom=4, basemap="positron")
add_geojson_layer(path=..., name="Counties",
                  data="https://example.com/counties.geojson")
list_layer_properties(path=..., layer="Counties")     # 找真实的列名
classify_layer(path=..., layer="Counties", column="pop_2020",
               class_count=5, colormap="blues", scheme="quantile")
set_map_legend(path=..., title="Population")         # 列出上面的分级
export_html(path=..., out_path="counties.html", title="Population by county")
```

### 18.18.4 "真的会咬人"的九条规则

这些是 SKILL.md 里单列的坑，实战价值最高：

| 规则 | 后果 |
|------|------|
| **命名底图、色带、图例预设之前先 `list_catalog`** | 猜名字是最常见的失败；服务器才是权威 |
| **并非 `list_catalog` 列出的每个色带都能画进 colorbar** | 该控件只画更窄、区分大小写的一组；`blues`、`greens`、`oranges`、`reds`、`purples`、`greys`、`rdylgn`、`rdylbu`、`rdbu` 会静默变成 viridis。要与图层配色一致时传 `add_colorbar(colors=[...])` |
| **`classify_layer` 只对内联 GeoJSON 有效** | `add_vector_layer`、瓦片、栅格图层没有可分类的属性表 |
| **分类或过滤前先 `list_layer_properties`** | 列名靠猜必错 |
| **内联 GeoJSON 上限 50 MB** | 超过请用 `add_vector_layer` 或瓦片源 |
| **本地路径只在数据被内联时可移植** | `add_geojson_layer` 读工作区文件并把要素复制进工程，所以能带走；只保留"引用"的图层（桌面 `sourcePath`、只在一个 notebook 会话里服务的栅格）只在出图那台机器上有效 |
| **`set_view(bbox=...)` 是近似的** | 工程存的是中心与缩放，服务器自己解算，落点差约半个缩放级别 |
| **`export_html` 的 `app_url` 是信任边界** | 导出页会把工程 POST 给那个来源；除非用户点名自建部署，否则别改 |
| **远程 URL 会被检查** | 解析到私有/回环/链路本地地址的 host 在每一跳都被拒。别想着绕过——它保护的是你正在跑的这台机器 |

### 18.18.5 另外三条工程性提醒

- **文件工具与 `live_*` 工具不是一回事**：前者在磁盘上写 `.geolibre.json`；后者推动 GeoLibre Desktop 里已经打开的地图，走 `127.0.0.1:8766` 的中继。先 `live_status()`；报无中继就请用户打开一次 Processing → Jupyter Notebook。实时编辑在用户于应用里保存之前**不在磁盘上**。
- **验收靠 `describe_project`**：它报相机、底图、每个图层与控件，内联要素只报数量，所以对大工程也安全。图层可用 id **或**显示名寻址；重名有歧义，先改名再改样式。
- **图层画不出东西的四个常见原因**：相机在别处（`set_view` 到数据）、URL 404 或被 CORS 挡、被上面某个不透明图层盖住（`update_layer(index=...)`）、数据不在 WGS84（GeoLibre 期待经纬度）。

### 18.18.6 与 AI 助手的对照

| | AI 助手 | agent skill |
| --- | --- | --- |
| 跑在哪 | 应用内 | 你的智能体里，应用外 |
| 作用对象 | 你正在看的地图 | 磁盘上的 `.geolibre.json` |
| 需要 | 配置好的 Provider | 会加载 skill 的智能体 |
| 产物 | 可 Ctrl/Cmd+Z 撤销的编辑 | 工程文件与/或独立 HTML |

两者**互补**：智能体出工程，你打开后用助手继续改；MCP 的 `live_*` 则是第三条路。

> **注意**：其它 agent 运行时也能用。`SKILL.md` 是带 YAML frontmatter 的纯 Markdown，多数支持 skill 的运行时能直接加载；没有加载器的，把文件粘进系统提示词或 `AGENTS.md` 即可——它是按"能独立成立"写的，`references/` 只在任务需要时才读。

---

## 18.19 本章小结

- **三条路径别混**：AI 助手改你眼前的地图（走 store、可撤销、可审计）；MCP 写磁盘上的工程；agent skill 是给外部智能体的说明书。
- **Provider 三层来源**：Settings → Environment Variables 优先，OS 环境（仅桌面、白名单、Bedrock 刻意排除）填空，构建时注入兜底。
- **凭据不落工程**：Provider key、AWS 凭据、Share token 都不写进 `.geolibre.json`；桌面版还能完全不把 key 输进设置。
- **托管 AI 是部署方的事**：同源 `/ai` + nginx Basic Auth + 服务器侧实例 token，浏览器两个 token 都看不到。
- **两条可选加速**：Jev 快速路径只覆盖六条纯路由命令（约 190 ms），Whitebox 语义检索把"大白话找工具"从 0/20 提到 19/20；两者都要 TypeSafe 凭据，且都会把文本发出去。
- **代码兜底是唯一不可撤销的路径**，其余能力都经 store。
- **MCP 的安全模型是"根 + 扩展名 + 不覆盖 + 每跳检查"**：给它一个专门放地图的目录。
- **预览有硬边界**：只连公网、4 MiB/资源、15 秒、30 分钟空闲过期、最多 64 会话，私网一律拒绝。
- **skill 的价值在"规则"**：`list_catalog` 先行、`classify_layer` 只吃内联 GeoJSON、bbox 近似、`app_url` 是信任边界——这四条能省掉大半返工。

---

## 18.20 实践练习

**练习 1（配置与撤销）**
在 Settings → AI Providers 里配一个 profile（Ollama 或任一托管 Provider），确认面板头部出现 provider/model 下拉。然后让助手"把某个线图层缓冲 100 米"，再用 Ctrl/Cmd+Z 撤销，观察图层面板与对话记录是否一致。

**练习 2（只读 SQL）**
让助手"统计每个区内的点数"，检查它生成的 SQL 是否是 `SELECT`/`WITH` 开头。再试着让它"删掉所有要素"或"UPDATE 一下"，记录它如何拒绝。说明这条限制保护的是什么。

**练习 3（MCP 从零到 HTML）**
按 18.13 配置 MCP 客户端（`--root` 指向一个专用目录），用六步工作流做一张分级设色图，最后 `export_html`。在浏览器里打开导出的 HTML，确认相机、图例、配色与工程一致；再用 `describe_project` 验证一遍。

**练习 4（工作区边界）**
故意让客户端访问根目录之外的路径（例如 `../secret.json`），记录返回的错误。再试一次覆盖已存在文件（不带 `overwrite`），以及与地图无关的 `.json` 文件。总结这道闸门的三条规则。

**练习 5（快速路径的取舍）**
在本地 Ollama 配置下，分别测三条纯路由命令（"隐藏某图层"、"缩放到某图层"、"底图换暗色"）与一条复杂命令的响应时间。然后启用 `JEV_API_KEY` 重测，并回答：为什么官方说"快速路径永远不是请求失败的原因"，以及它对本地模型的隐私意味着什么。

**练习 6（agent skill）**
把 `skills/geolibre/` 装到 `~/.claude/skills/`，开一个新会话，让智能体"做一张能发的地图"。观察它是否先调 `list_catalog`、是否先 `list_layer_properties` 再 `classify_layer`、是否以 `export_html` 收尾。哪一步没做到，就在 `SKILL.md` 里找到对应规则，说明它为什么存在。
