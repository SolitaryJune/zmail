# CPA 认证管理系统集成说明

本脚本支持将注册成功的 ChatGPT 账号自动上传到 CPA（Centralized Provider Authentication）认证管理系统。

## 配置说明

在 `config.json` 中添加以下配置：

```json
{
  "cpa_api_url": "http://localhost:8317",
  "cpa_management_key": "your_management_key_here",
  "auto_upload_to_cpa": true
}
```

### 配置项说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `cpa_api_url` | string | CPA 管理 API 地址，例如 `http://localhost:8317` |
| `cpa_management_key` | string | CPA 管理密钥，用于 Bearer Token 认证 |
| `auto_upload_to_cpa` | boolean | 是否自动上传到 CPA，`true` 开启，`false` 关闭 |

## 环境变量

也可以通过环境变量配置（优先级高于配置文件）：

```bash
# Linux/Mac
export CPA_API_URL='http://localhost:8317'
export CPA_MANAGEMENT_KEY='your_management_key_here'
export AUTO_UPLOAD_TO_CPA='true'

# Windows
set CPA_API_URL=http://localhost:8317
set CPA_MANAGEMENT_KEY=your_management_key_here
set AUTO_UPLOAD_TO_CPA=true
```

## 工作流程

1. **注册账号**：脚本使用 Zmail 临时邮箱注册 ChatGPT 账号
2. **获取 OAuth Token**（如果启用）：通过 OAuth 流程获取 access_token 和 refresh_token
3. **保存本地 JSON**：将认证信息保存到 `codex_tokens/` 目录下的 JSON 文件
4. **上传到 CPA**：自动将 JSON 文件上传到 CPA 认证管理系统

## JSON 文件格式

生成的认证 JSON 文件格式如下：

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

## CPA API 端点

脚本使用以下 CPA API 端点上传认证文件：

```
POST /v0/management/auth-files
Authorization: Bearer <MANAGEMENT_KEY>
Content-Type: multipart/form-data

file: <JSON 文件>
```

### 请求示例

```bash
curl -X POST \
  -H "Authorization: Bearer your_management_key" \
  -F "file=@codex_tokens/user@example.com.json" \
  http://localhost:8317/v0/management/auth-files
```

### 响应示例

成功时返回 200 或 201：

```json
{
  "success": true,
  "file": {
    "id": "user@example.com",
    "name": "user@example.com.json",
    "provider": "openai",
    "status": "ready"
  }
}
```

## 功能特性

### 1. 自动上传

当 `auto_upload_to_cpa` 设置为 `true` 且配置了 CPA API 时，每个注册成功的账号都会自动上传到 CPA。

### 2. 双重保存

- **本地保存**：JSON 文件保存在 `codex_tokens/` 目录
- **CPA 上传**：同时上传到 CPA 认证管理系统

### 3. 兼容旧版

脚本同时支持：
- 旧版 `upload_api_url` 和 `upload_api_token`（兼容保留）
- 新版 CPA 认证管理系统

### 4. 错误处理

- 上传失败不会中断注册流程
- 会在控制台显示上传状态
- 本地文件始终会保存

## 使用示例

### 完整配置示例

```json
{
  "total_accounts": 0,
  "max_workers": 1,
  "zmail_base_url": "https://jo24mail.gushao.club",
  "zmail_auth_password": "your_password",
  "proxy": "",
  "proxy_pool": [],
  "enable_oauth": true,
  "oauth_required": true,
  "cpa_api_url": "http://localhost:8317",
  "cpa_management_key": "your_management_key",
  "auto_upload_to_cpa": true
}
```

### 运行脚本

```bash
python chatgpt_register.py
```

### 输出示例

```
############################################################
  ChatGPT 批量自动注册 (Zmail 临时邮箱版)
  注册数量: 无限 | 并发数: 1
  Zmail: https://jo24mail.gushao.club
  代理: 不使用
  OAuth: 开启 | required: 是
  OAuth Issuer: https://auth.openai.com
  OAuth Client: app_EMoamEEZ73f0CkXaXp7hrann
  Token输出: codex_tokens/, ak.txt, rk.txt
  CPA 自动上传: 开启
  CPA API: http://localhost:8317
  输出文件: registered_accounts.txt
############################################################

[1] [Zmail] 创建临时邮箱...
[1] 注册: user@example.com
[1] [OAuth] 开始获取 Codex Token...
[1] [OAuth] Token 获取成功
[1] [OAuth] Token 已保存
  [CPA] 认证文件已上传: user@example.com.json
  [Zmail] 账号已保存到管理系统

[OK] [user] user@example.com 注册成功!
```

## 故障排查

### 问题：上传失败

**可能原因：**
1. CPA API 地址错误
2. 管理密钥错误
3. CPA 服务未运行
4. 网络连接问题

**解决方法：**
1. 检查 `cpa_api_url` 配置
2. 验证 `cpa_management_key` 是否正确
3. 确认 CPA 服务正常运行
4. 检查网络连接和防火墙设置

### 问题：JSON 文件格式错误

**可能原因：**
- OAuth Token 获取失败
- Token 解析错误

**解决方法：**
1. 检查 OAuth 配置
2. 查看本地 JSON 文件内容
3. 确认 access_token 和 refresh_token 存在

### 问题：CPA 不识别文件

**可能原因：**
- JSON 格式不符合 CPA 要求
- 缺少必要字段

**解决方法：**
1. 确认 JSON 包含 `type`, `email`, `access_token`, `refresh_token` 字段
2. 检查 CPA 日志获取详细错误信息

## 安全建议

1. **保护管理密钥**：不要将 `cpa_management_key` 提交到版本控制系统
2. **使用环境变量**：生产环境建议使用环境变量而非配置文件
3. **限制访问**：确保 CPA API 只能从可信来源访问
4. **定期轮换**：定期更换管理密钥

## 注意事项

1. 只有启用 OAuth 并成功获取 Token 时才会上传到 CPA
2. 上传失败不会影响本地文件保存
3. 建议先在测试环境验证配置正确性
4. 无限注册模式下会持续上传，注意 CPA 存储容量
