# ChatGPT 批量自动注册工具 - Zmail 版

基于 Zmail 自建临时邮箱服务的 ChatGPT 账号批量自动注册工具，支持并发注册、代理池、OAuth Token 获取和 CPA 认证管理系统集成。

## 主要特性

- ✅ **自建邮箱服务**：使用 Zmail 自建临时邮箱，无需依赖第三方服务
- ✅ **自动验证码**：自动获取并填写 OpenAI 邮箱验证码
- ✅ **并发注册**：支持多线程并发，提高注册效率
- ✅ **代理池支持**：支持配置多个代理轮流使用
- ✅ **无限注册**：支持无限循环注册模式
- ✅ **OAuth Token**：可选获取 Codex OAuth Token
- ✅ **CPA 集成**：自动上传认证信息到 CPA 管理系统
- ✅ **账号管理**：自动保存账号到 Zmail 账号管理系统

## 快速开始

### 1. 安装依赖

```bash
pip install curl_cffi
```

### 2. 配置文件

复制配置示例：

```bash
cp config.example.json config.json
```

编辑 `config.json`：

```json
{
  "total_accounts": 0,
  "max_workers": 1,
  "zmail_base_url": "https://jo24mail.gushao.club",
  "zmail_auth_password": "your_password",
  "proxy": "",
  "proxy_pool": [],
  "enable_oauth": false,
  "oauth_required": false,
  "auto_upload_to_cpa": false
}
```

### 3. 运行脚本

```bash
python chatgpt_register.py
```

## 配置说明

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `total_accounts` | number | 0 | 注册数量，0 表示无限注册 |
| `max_workers` | number | 1 | 并发线程数 |
| `zmail_base_url` | string | "" | Zmail 服务地址（必填） |
| `zmail_auth_password` | string | "" | Zmail 鉴权密码（可选） |
| `zmail_email_domain` | string | "" | 邮箱域名（可选，自动获取） |
| `output_file` | string | "registered_accounts.txt" | 输出文件路径 |

### 代理配置

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `proxy` | string | 单个代理地址，例如 `http://127.0.0.1:7897` |
| `proxy_pool` | array | 代理池，多个代理轮流使用 |

**代理池示例：**

```json
{
  "proxy_pool": [
    "http://127.0.0.1:7897",
    "http://127.0.0.1:7898",
    "http://127.0.0.1:7899"
  ]
}
```

### OAuth 配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable_oauth` | boolean | true | 是否启用 OAuth |
| `oauth_required` | boolean | true | OAuth 失败是否中断注册 |
| `oauth_issuer` | string | "https://auth.openai.com" | OAuth 授权服务器 |
| `oauth_client_id` | string | "app_EMoamEEZ73f0CkXaXp7hrann" | OAuth 客户端 ID |
| `oauth_redirect_uri` | string | "http://localhost:1455/auth/callback" | OAuth 回调地址 |
| `ak_file` | string | "ak.txt" | Access Token 保存文件 |
| `rk_file` | string | "rk.txt" | Refresh Token 保存文件 |
| `token_json_dir` | string | "codex_tokens" | Token JSON 文件目录 |

### CPA 集成配置

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `cpa_api_url` | string | CPA 管理 API 地址 |
| `cpa_management_key` | string | CPA 管理密钥 |
| `auto_upload_to_cpa` | boolean | 是否自动上传到 CPA |

详见 [CPA_INTEGRATION.md](./CPA_INTEGRATION.md)

## 使用场景

### 场景 1：单线程无限注册（推荐）

适合长期稳定运行，避免触发风控。

```json
{
  "total_accounts": 0,
  "max_workers": 1,
  "enable_oauth": false
}
```

### 场景 2：批量快速注册

适合短时间内注册大量账号。

```json
{
  "total_accounts": 100,
  "max_workers": 3,
  "proxy_pool": [
    "http://proxy1:7897",
    "http://proxy2:7897",
    "http://proxy3:7897"
  ]
}
```

### 场景 3：获取 OAuth Token

适合需要 API 访问的场景。

```json
{
  "total_accounts": 10,
  "max_workers": 1,
  "enable_oauth": true,
  "oauth_required": true,
  "auto_upload_to_cpa": true,
  "cpa_api_url": "http://localhost:8317",
  "cpa_management_key": "your_key"
}
```

## 环境变量

所有配置项都支持通过环境变量覆盖：

```bash
# Zmail 配置
export ZMAIL_BASE_URL='https://jo24mail.gushao.club'
export ZMAIL_AUTH_PASSWORD='your_password'

# 注册配置
export TOTAL_ACCOUNTS=0
export MAX_WORKERS=1

# 代理配置
export PROXY='http://127.0.0.1:7897'

# OAuth 配置
export ENABLE_OAUTH='false'
export OAUTH_REQUIRED='false'

# CPA 配置
export CPA_API_URL='http://localhost:8317'
export CPA_MANAGEMENT_KEY='your_key'
export AUTO_UPLOAD_TO_CPA='true'
```

## 输出文件

### registered_accounts.txt

格式：`邮箱----ChatGPT密码----邮箱地址----oauth状态`

```
user1@domain.com----Pass123!@#----user1----oauth=ok
user2@domain.com----Pass456!@#----user2----oauth=fail
```

### codex_tokens/ 目录

每个账号一个 JSON 文件，包含完整的 OAuth Token 信息。

```json
{
  "type": "codex",
  "email": "user@example.com",
  "expired": "2025-12-31T23:59:59+08:00",
  "id_token": "eyJ...",
  "account_id": "acc-xxx",
  "access_token": "eyJ...",
  "last_refresh": "2025-01-01T12:00:00+08:00",
  "refresh_token": "eyJ..."
}
```

### ak.txt 和 rk.txt

分别保存所有的 Access Token 和 Refresh Token，每行一个。

## 工作流程

```
1. 创建 Zmail 临时邮箱
   ↓
2. 访问 ChatGPT 注册页面
   ↓
3. 提交注册信息
   ↓
4. 等待验证码邮件（自动轮询）
   ↓
5. 提取并提交验证码
   ↓
6. 完成账号创建
   ↓
7. [可选] 获取 OAuth Token
   ↓
8. [可选] 上传到 CPA
   ↓
9. 保存账号到 Zmail
   ↓
10. 写入输出文件
```

## 故障排查

### 问题：Chrome 版本不支持

**错误信息：** `Impersonating chrome142 is not supported`

**解决方法：** 已修复，脚本现在使用兼容的 Chrome 版本（120, 124, 131）

### 问题：创建邮箱失败

**可能原因：**
1. Zmail 服务地址错误
2. Zmail 服务未运行
3. 需要鉴权但未配置密码

**解决方法：**
1. 检查 `zmail_base_url` 配置
2. 确认 Zmail 服务正常运行
3. 如需鉴权，设置 `zmail_auth_password`

### 问题：获取不到验证码

**可能原因：**
1. 邮件延迟
2. OpenAI 未发送邮件
3. 邮箱地址错误

**解决方法：**
1. 增加等待时间（默认 120 秒）
2. 检查 Zmail 邮件列表接口
3. 查看脚本日志确认邮箱地址

### 问题：注册失败率高

**可能原因：**
1. IP 被风控
2. 并发数过高
3. 代理质量差

**解决方法：**
1. 使用代理池
2. 降低并发数（建议 1-3）
3. 更换高质量代理

## 性能优化

### 1. 代理池配置

使用多个高质量代理，避免单个 IP 被限制：

```json
{
  "proxy_pool": [
    "http://proxy1:7897",
    "http://proxy2:7897",
    "http://proxy3:7897"
  ]
}
```

### 2. 并发控制

根据代理数量和质量调整并发数：

- 单代理：`max_workers: 1`
- 3 个代理：`max_workers: 3`
- 10 个代理：`max_workers: 5-10`

### 3. 无限注册模式

长期运行建议使用无限注册模式：

```json
{
  "total_accounts": 0,
  "max_workers": 1
}
```

每完成 10 个账号会显示统计信息，可随时 Ctrl+C 中断。

## 安全建议

1. **不要公开配置文件**：包含敏感信息（密钥、代理等）
2. **使用环境变量**：生产环境建议使用环境变量
3. **定期更换代理**：避免 IP 被封禁
4. **控制注册速度**：避免触发风控
5. **保护 Token 文件**：妥善保管生成的 Token 文件

## 相关文档

- [Zmail 适配说明](./ZMAIL_MIGRATION.md)
- [CPA 集成说明](./CPA_INTEGRATION.md)
- [Zmail API 文档](../../zmail_api.md)

## 许可证

本项目仅供学习研究使用，请勿用于商业用途。
