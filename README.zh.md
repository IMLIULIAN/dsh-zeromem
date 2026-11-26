<p align="right">
  <strong>简体中文</strong> | <a href="README.md">English</a>
</p>

# @imliulian/dsh-zeromem

> **ZeroMem（零忆）—— 面向 DeepSeek Harness（DSH）的纯本地、证据溯源长期记忆系统** · AGPL-3.0  
> 作者：**B站IM榴莲（IMLIULIAN）** · ZeroZoneX

`@imliulian/dsh-zeromem` 将一套**单文件、零外部依赖、有据可查的本地记忆引擎**原生集成进 DeepSeek Harness：无需云端向量库、无需 Python 运行环境、无需 `node-gyp` / `better-sqlite3` 原生编译，也无需 MCP 子进程中转。

---

## 核心能力（本地记忆系统）

1. **纯本地单文件引擎，`<1ms` 检索，零原生编译依赖**
   - 直接基于 Node 内置 `node:sqlite`（`Node >= 22.19` / DSH 内置 `Node 24`）构建，采用**中文 2-gram + 英文双轨 FTS5 全文索引**，同时索引提炼事实与原始证据片段。
   - **零第三方运行时依赖、零 `postinstall` 编译脚本**，完美兼容 `pnpm >= 10` 默认安全策略，秒装即用。
   - **100% Fail-Open 容错**：即使本地 Ollama 或云端 API 离线，也绝不阻塞 DSH 启动与正常对话，历史记忆本地 FTS5 检索始终可用。

2. **证据绑定 + 写前原文对照审校（拒绝黑盒幻觉）**
   - 内置**短窗切块 → 结构化抽取 → 1 轮原文对照审校（Admission）→ 确定性规则守卫**双阶段流水线，针对开源 4B 记忆专项微调模型 **[Qwen3.5-4B-Memory-V2](https://huggingface.co/IMLIULIAN/qwen3.5-4b-memory-v2)** 深度打磨（通过 Ollama 100% 离线运行，写入 ¥0 云端费）。
   - 每一条入库事实均**强制绑定原始证据片段**（`evidence_ids`），随时可回溯原文核对，避免摘要漂移与无中生有。
   - **离开本机前自动密钥脱敏**：常见密钥与凭据（`sk-...`、`ghp_...`、`AKIA...`、`Bearer ...` 等）在送往模型与写入数据库前自动替换为 `[REDACTED]`，切换云端 API 时同样受保护。

3. **面向长周期演进的时间线演化与记忆治理机制**
   - **时间线演化与替代链（`fact_supersessions`）**：写前自动经 `<1ms` 同空间 FTS5 召回相关活跃旧事实（`prior_facts`），结合 Ollama JSON Schema 约束在单轮审校内安全标出 `supersedes_fact_id`；召回时活跃事实自动优先于被替代历史事实排序，同时完整保留历史可溯源链。
   - **事件时间区间过滤（`occurred_from` / `occurred_to`）**：支持 `YYYY`、`YYYY-MM`、`YYYY-MM-DD` 区间重叠检索与 `include_superseded` 控制，覆盖引擎、`zeromem_recall` 工具、Web 工作台与 CLI。
   - **`until:YYYY-MM-DD` 过期自动后移**：严格日历校验临时规则/阶段性计划，过期记录无损后移至召回尾部并附带结构化过期标记，不污染当前有效记忆。
   - **`2–8` 动态相对分数门槛**：按头名相关性比值（默认 `0.35`，可开关）自动截断尾部低相关噪音，减少无效上下文占用。
   - **无损软淘汰 + `SHA-256` 防篡改原子恢复**：删除的记忆连同原文片段、替代链边与规范化 `SHA-256` 指纹一并归档至同库 `evicted_records` 边表；恢复时先做完整性校验，再原子写回并重建 FTS5 索引与演化边表。

4. **只读 Markdown 导出与 SQLite 在线安全备份（适配 Obsidian / Git / 网盘）**
   - **100% 只读 Markdown 导出**（`dsh-zeromem export --md` / `GET /dsh-zeromem/api/export.md` / `exportMarkdown()`）：只读模式打开数据库（`PRAGMA query_only = ON`），零 LLM 调用，支持标准输出、单文件（`-o`）及按空间拆分的 Obsidian/Git 目录（`--dir`，附 `INDEX.md`），保留 YAML frontmatter、原文引用块、替代链与 `until:` 过期标注。
   - **WAL 安全在线热备**（`dsh-zeromem backup` / `POST /dsh-zeromem/api/backup` / `backupDatabase()`）：直接调用 Node 内置 `node:sqlite` Online Backup API，不阻塞并发读写，自动将快照拍平为 `journal_mode = DELETE`（无 `-wal`/`-shm` 伴生文件，安全适配 OneDrive/百度网盘/iCloud），内置 `PRAGMA integrity_check` 与可选 `.sha256` 校验文件。

5. **本地模型 ↔ 云端 API 自由切换（无独显也能用）**
   - **本地模型（Ollama，默认）**：回环地址直连 `127.0.0.1:11434`（自动绕过系统代理），自动检测本机 Ollama 与 `Qwen3.5-4B-Memory-V2`，支持按需一键拉取 `Q8_0` / `Q4_K_M` 版本（均带二次确认）。
   - **云端 / 自定义 OpenAI 兼容 API**：无需重启 DSH 实时切换，内置 DeepSeek / OpenAI / SiliconFlow / OpenRouter 预设，并支持持久化保存**自定义 API**（Base URL + Model ID，适配 vLLM、LM Studio 或私有网关）。API Key 仅保存在本机 `~/.zeromem/dsh-zeromem.json`（POSIX `0600`），绝不向浏览器回显明文。

6. **DSH 原生闭环、命令行工具 & 跨工具数据库互通**
   - **5 个原生 DSH 工具**（严格无损 JSON）：`zeromem_recall`（支持 `occurred_from` / `occurred_to` / `include_superseded`）、`zeromem_remember`（支持 `link_supersessions`）、`zeromem_stats`、`zeromem_evict`、`zeromem_restore`。
   - **会话生命周期自动闭环**（均支持热开关）：`agent/pre-step`（发消息前 `<1ms` 带防回环标记自动召回）与 `agent/turn-stopping`（每轮结束后后台异步沉淀，自动跳过 subagent）。
   - **与 Python 版 ZeroMem 100% 数据互通**：共用同一份 `~/.zeromem/memory.db`（`schema_version = 1`，完整互通 `fact_supersessions` 与 `evicted_records`），与 [IMLIULIAN/zeromem](https://github.com/IMLIULIAN/zeromem) 在 DSH、Cursor、Claude Code、Codex 之间无缝共享同一套本地记忆库。

---

## 安装

### 方式一：DSH CLI（推荐）
```bash
# 安装到 web 或 desktop profile
dsh plugin --profile web add @imliulian/dsh-zeromem
```

### 方式二：DSH 插件市场
打开 DeepSeek Harness **设置 → 插件市场**，搜索 `@imliulian/dsh-zeromem`（或 `dsh-zeromem`）点击安装。

### 本地开发与隔离测试
```bash
# 建议使用独立测试 profile，避免与现有记忆插件冲突
dsh plugin --profile zeromem-dev add link:/path/to/dsh-zeromem
```

---

## 模型配置

### 方案 A：本地 Ollama（推荐，完全离线、零云端费）
拉取配套开源专项 4B 记忆模型（也可在设置中填入任意本机已有 Ollama 模型）：
```bash
# 高精度推荐版（约 4.5 GB，建议 6–8 GB 以上显存或 Apple Silicon）
ollama pull hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q8_0

# 轻量显存版（约 2.7 GB）
ollama pull hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q4_K_M
```
> 也可直接在插件设置页点击一键检测、后台静默启动 Ollama 或确认拉取模型。

### 方案 B：云端 / OpenAI 兼容 API（无独显 / 轻薄本）
在 `~/.zeromem/dsh-zeromem.json`、环境变量或插件设置页切换到「云端 API」，选择预设或填写自定义 Base URL 与模型 ID 即可。敏感密钥在离开本机前仍会自动脱敏为 `[REDACTED]`。

---

## 配置文件与环境变量

默认配置文件位于 `~/.zeromem/dsh-zeromem.json`（POSIX 下权限 `0600`），亦支持在 profile 的 `cordis.patch.yml` 中通过 `config:` 覆盖，或使用以下环境变量：

| 环境变量 | 说明 |
| :--- | :--- |
| `ZEROMEM_DB` | 自定义 SQLite 数据库路径（默认 `~/.zeromem/memory.db`） |
| `ZEROMEM_DSH_CONFIG` | 自定义插件配置文件路径 |
| `ZEROMEM_PROVIDER` | 后端模式：`ollama`（默认）或 `openai-compatible` |
| `ZEROMEM_OLLAMA_URL` / `ZEROMEM_MODEL` / `ZEROMEM_NUM_CTX` | 本地 Ollama 地址、模型标签与上下文长度 |
| `ZEROMEM_API_BASE_URL` / `ZEROMEM_API_MODEL` / `ZEROMEM_API_KEY` | OpenAI 兼容 API 地址、模型 ID 与密钥 |
| `ZEROMEM_UNTIL=0` | 关闭 `until:` 过期后移逻辑 |
| `ZEROMEM_ADAPTIVE_LIMIT_DISABLED=1` | 关闭 `2–8` 动态门槛，回退固定 Top-6 召回 |

---

## 附带加分项：内嵌 Web / 桌面管理面板

在本地记忆引擎之上，插件额外附带了一个轻量的 Shadow DOM 内嵌侧滑工作台（仅在带界面的 DSH Web / 桌面端注入，Headless 环境自动跳过，受本机回环 + 同源双层安全栅栏保护），方便可视化日常打理：

- 快速检索、按空间或事件日期区间筛选、查看替代链徽章（`替代 #N` / `已被 #M 替代`）、点击记忆展开原始绑定证据、高亮查看 `[REDACTED]` 脱敏标记。
- 一键**导出只读 Markdown（`.md`）**与**在线安全备份**（自动生成拍平 WAL 的单文件快照及 `.sha256` 至 `~/.zeromem/backups/`）。
- 手动写入记忆、软淘汰至回收站、按批次预览与 `SHA-256` 校验一键恢复、一键清理已过期 `until:` 记忆。
- 实时切换本地 Ollama / 云端 API、一键测试连接，附带亮/暗毛玻璃主题与自定义壁纸等轻量交互体验。

---

## 命令行工具（`dsh-zeromem`）

```bash
# 按事件时间区间检索并隐藏被替代的历史事实
npx @imliulian/dsh-zeromem search "架构方案" --occurred-from 2026-01-01 --hide-superseded

# 只读导出为单文件 Markdown 或 Obsidian/Git 分空间目录
npx @imliulian/dsh-zeromem export --md -o ./zeromem.md
npx @imliulian/dsh-zeromem export --md --dir ./obsidian-vault/zeromem

# WAL 安全在线备份（拍平为无 -wal/-shm 单文件快照 + integrity_check + .sha256）
npx @imliulian/dsh-zeromem backup ./backups/ --sha256
```

---

## 开发与测试

```bash
npm run check
npm test
```

## 许可、血缘归属与同名消歧
- **开源协议**：**GNU Affero General Public License v3.0（`AGPL-3.0-only`）**，详见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。任何基于本插件的二次修改分发或网络服务部署均须以 AGPL-3.0 同等开源并保留原作者署名与版权声明。
- **作者与关联项目**：**B站IM榴莲（IMLIULIAN）** · **ZeroZoneX** — [IMLIULIAN/zeromem](https://github.com/IMLIULIAN/zeromem) · [Qwen3.5-4B-Memory-V2（Hugging Face，模型权重单独采用 Apache-2.0）](https://huggingface.co/IMLIULIAN/qwen3.5-4b-memory-v2)
- **Schema 血缘与兼容致谢**：本插件与 ZeroMem 共用的结构化事实字段协议（`bank`、`type: world | experience | observation`、`occurred_start` / `occurred_end` / `mentioned_at`、`where`、`entities`）受开源项目 [**Vectorize Hindsight**](https://github.com/vectorize-io/hindsight)（MIT License）启发并保持概念/Schema 兼容；本插件基于 `node:sqlite` 的双轨 FTS5 引擎、写前审校守卫、过期/软淘汰与 SHA-256 恢复机制及 DSH 集成代码均为独立从零实现，不含 Hindsight 源码。
- **同名论文消歧**：**ZeroMem（零忆）** 与 `@imliulian/dsh-zeromem` 是独立开发的纯本地记忆系统，与学术论文 *Zero-Mem: Zero-Token Memory Operations for LLM Agents*（Yilin Xiao et al., [arXiv:2607.29377](https://arxiv.org/abs/2607.29377), 2026 年 7 月）名称相近，但两者完全独立，无作者、代码、模型或隶属关系。
