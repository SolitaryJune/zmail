# 🔐 私人账号管理 & 临时邮箱

> 私有化账号信息管理与临时邮箱工具，基于 Cloudflare Workers 构建。灵感来自Zmail，注册脚本详见scripts/codex.js

## ✨ 功能

- **账号管理** — 存储登录用户名、邮箱、密码、手机号、注册平台等信息
- **临时邮箱** — 创建临时邮箱地址，实时接收邮件（支持附件）
- **密码保护** — 所有 API 和页面均需密码认证
- **搜索筛选** — 按关键词搜索、按平台筛选账号
- **暗色模式** — 支持亮/暗主题切换

## 🚀 部署

<div align="center">
  <a href="http://deploy.workers.cloudflare.com/?url=https://github.com/SolitaryJune/zmail" target="_blank">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" />
  </a>
</div>

> 点击按钮一键部署，部署时在高级设置的构建变量中设置 `VITE_EMAIL_DOMAIN`（邮箱域名）和 `AUTH_PASSWORD`（登录密码）。

### 前置条件

- Cloudflare 账户
- 一个域名（已托管在 Cloudflare）

### GitHub Actions 自动部署

1. 在 Cloudflare Dashboard 创建 D1 数据库，记录 `database_name` 和 `database_id`
2. 在仓库 **Settings → Secrets and variables → Actions** 添加以下 Secrets：

| Secret | 说明 |
|--------|------|
| `CF_API_TOKEN` | Cloudflare API Token（使用 "Edit Cloudflare Workers" 模板） |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `D1_DATABASE_ID` | D1 数据库 ID |
| `D1_DATABASE_NAME` | D1 数据库名称 |
| `VITE_EMAIL_DOMAIN` | 邮箱域名，如 `jo24.mail.gushao.club` |
| `AUTH_PASSWORD` | 登录密码 |

3. 推送到 `main` 分支即自动部署，也可在 Actions 页面手动触发
4. 为 Worker 绑定自定义域名
5. 配置 Cloudflare Email Routing：
   - 进入域名 → Email → Email Routing
   - Catch-all → Send to Worker → 选择部署的 Worker

## 💻 本地开发

```bash
# 安装依赖
pnpm install

# 启动前端
pnpm dev:frontend

# 启动后端
pnpm dev:backend
```

## 🔧 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React + TypeScript + Tailwind CSS + Vite |
| 后端 | Cloudflare Workers + Hono |
| 数据库 | Cloudflare D1 |
| 邮件 | Cloudflare Email Workers |

## 📄 许可证

私有项目，仅供个人使用。
