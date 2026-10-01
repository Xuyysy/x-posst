# X Auto Poster V1

个人定时文字发帖工具。你只需维护仓库中的 `data/posts.json`；GitHub Actions 每小时检查四次，Python 找到到期帖子并调用 Buffer GraphQL API 的 `createPost`，请求 Buffer 立即处理到你已连接的 X 账号。Buffer 接受请求后，本地状态记为 `submitted`。这表示 Buffer 已接收任务，不代表 X 已最终发布；最终投递状态请在 Buffer Dashboard 查看。

## 第一次配置

### 1. 在 Buffer 连接 X 账号

创建 Buffer 账号，并在 Buffer Dashboard 连接你准备发帖的 X 账号。V1 每次只使用一个 Buffer Channel。

### 2. 创建 Buffer API Key

在 Buffer 登录后打开 **Settings → API**，创建并复制 Personal API Key。API Key 只用于你自己的 Buffer 账号。官方说明见 [Buffer Authentication](https://developers.buffer.com/guides/authentication.html)。

### 3. 找到 X Channel ID

本项目包含一次性只读查询脚本。请在本机设置 Buffer API Key 环境变量，然后运行：

```bash
read -s 'BUFFER_API_KEY?Buffer API Key: '; export BUFFER_API_KEY
python scripts/list_buffer_channels.py
unset BUFFER_API_KEY
```

PowerShell 可用 `$secure = Read-Host "Buffer API Key" -AsSecureString; $env:BUFFER_API_KEY = [Net.NetworkCredential]::new("", $secure).Password` 设置临时环境变量，脚本完成后执行 `Remove-Item Env:BUFFER_API_KEY`。脚本会列出组织、Channel 名称、Service 和 ID。找到对应 X 账号的 Channel（通常 service 显示为 `twitter`），复制 ID。脚本不会输出 API Key，也不会修改 Buffer 数据。正常定时运行不会调用 Channel 查询。

### 4. 把项目放进 GitHub

Fork 本仓库，或在 GitHub 创建仓库并上传项目。不要把 API Key 放进任何文件或 Git 提交。

### 5. 添加 GitHub Secrets

在仓库打开 **Settings → Secrets and variables → Actions → New repository secret**，添加：

- `BUFFER_API_KEY`：上一步创建的 Buffer Personal API Key
- `BUFFER_CHANNEL_ID`：你复制的 X Channel ID

不要把这些 Secret 写入 `posts.json` 或 `state.json`。项目不需要 X 密码。

### 6. 添加第一条测试帖子

初始的示例帖子在远期且 `enabled: false`，不会意外发布。编辑 `data/posts.json`，在 `posts` 数组中加入一个近期但仍在未来的测试帖子：

```json
{
  "id": "test-2026-10-02-001",
  "scheduled_at": "2026-10-02T18:30:00",
  "content": "我的 Buffer 测试帖子",
  "enabled": true
}
```

每个 id 必须唯一。时间是 ISO 8601 本地时间且不带时区，由顶层 `timezone` 解释。整份配置在任何发帖前会一次性验证；配置有误时不会发布任何内容。`max_lateness_minutes` 必须是正整数，默认示例为 90 分钟。超出窗口的任务会标记为 `expired`，不会补发。

提交 `posts.json`。

### 7. 手动运行和确认

进入 GitHub **Actions → X Auto Poster → Run workflow**。手动和定时运行使用同一个 Python 入口。查看该次运行日志：如果有到期帖子，应看到 `Buffer accepted post …`。然后在 Buffer Dashboard 检查该 Post；在 Buffer 接收请求后，工作流会自动提交更新后的 `data/state.json`。如果没有到期帖子，日志显示 `No posts due.`，不会发起 Buffer API 请求。

## 日常使用

以后只需打开 `data/posts.json`，添加新帖子并 Commit。GitHub Actions 按 UTC cron 大约每小时的第 7、22、37、52 分钟运行一次。GitHub cron 的触发时间可能延迟，程序会按帖子计划时间检查。一次发现多条到期帖子时按时间先后依次提交，两次请求间隔 2 秒。

请只编辑 `data/posts.json`，平时不要手动修改 `data/state.json`。状态由程序维护，Actions 在状态变化后提交它。

## 状态与恢复

- `submitted`：Buffer 返回成功结果和 Post ID，表示 Buffer 已接收；V1 不轮询 Buffer 到 X 的最终投递结果。已经 `submitted` 的帖子不会再次创建。
- `failed`：Buffer 明确拒绝该帖子，例如 GraphQL mutation 业务错误。不会自动重试。
- `unknown`：网络超时或连接中断，无法确认 Buffer 是否已接收。不会自动重试，请先在 Buffer Dashboard 检查；确认未创建后，用新的唯一 ID 安排帖子。
- `expired`：超过 `max_lateness_minutes`，不会发布。
- `rate_limited`：Buffer 明确返回 HTTP 429。状态保存 `retry_after_at`，程序停止本轮后续发布；下一轮在该时间之后且尚未过期时允许重试。

API Key 无效或权限错误会停止当前运行，后续帖子不会被逐个标记为失败。Buffer 限流阈值依账号/API Key 和套餐而定；程序读取 Buffer 响应中的 RateLimit 信息用于日志告警，不在业务层设置每日发帖数量限制。当前限流实现以 [Buffer API Rate Limits 文档](https://developers.buffer.com/guides/api-limits.html) 为准。

## 本地安装和运行

需要 Python 3.12。安装可编辑项目和测试依赖：

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[test]'
```

在终端设置 `BUFFER_API_KEY` 和 `BUFFER_CHANNEL_ID` 后，可运行一次：

```bash
python -m x_auto_poster.main
```

缺少任何一个环境变量时，程序明确报错并退出，不请求 Buffer。

运行测试：

```bash
pytest
```

所有测试使用 Fake/Mock HTTP 客户端，不会访问真实 Buffer。

## GitHub Actions 和日志

定时工作流支持 `workflow_dispatch`，使用 `ubuntu-latest`、Python 3.12 和 `contents: write`。Concurrency 确保同一时间只运行一个发布任务。状态有变化时，工作流提交 `chore: update auto poster state`，然后 fetch/rebase 最新分支再 push；不使用 force push。没有状态变化时不提交。

如果运行失败，打开 **Actions → X Auto Poster → 对应运行 → publish job** 查看 stdout 日志。CI 工作流在 push 和 pull request 时运行 pytest，不需要 Secrets，也不会调用真实 Buffer API。

## 项目范围

V1 只发布纯文本到单个 Buffer Channel，不包含 X API、图片/视频、Thread、AI、后台界面、数据库、队列或用户系统。业务服务依赖 `SocialClient` 和 `PostRepository` 抽象；当前实现分别为 `BufferClient` 和 `JsonPostRepository`，以后可更换 Provider 或存储实现。
