# Codex 协议密钥生成工具

该目录提供基于 DuckMail 的纯 HTTP Codex OAuth 注册与 token 生成脚本。

## 主要能力

- 纯 HTTP 注册 ChatGPT 账号
- 通过 DuckMail API 创建邮箱并读取验证码
- 获取 `access_token`、`refresh_token`、`id_token`
- 生成 CLIProxyAPI v6 兼容的 token JSON 文件名
- 可选上传到 CPA 管理接口

## 配置文件

只提交示例文件：

```bash
copy config.example.json config.json
```

示例配置字段：

```json
{
  "total_accounts": 10,
  "concurrent_workers": 2,
  "headless": false,
  "proxy": "http://127.0.0.1:7897",
  "duckmail_api_base": "https://api.duckmail.sbs",
  "duckmail_api_key": "",
  "oauth_issuer": "https://auth.openai.com",
  "oauth_client_id": "app_EMoamEEZ73f0CkXaXp7hrann",
  "oauth_redirect_uri": "http://localhost:1455/auth/callback",
  "upload_api_url": "http://localhost:8317/v0/management/auth-files",
  "upload_api_token": "",
  "accounts_file": "accounts.txt",
  "csv_file": "registered_accounts.csv",
  "ak_file": "ak.txt",
  "rk_file": "rk.txt",
  "token_json_dir": "codex_accounts_tokens"
}
```

## 使用

```bash
python protocol_keygen.py
```

## 输出文件

运行后会在本地生成：

- `accounts.txt`
- `registered_accounts.csv`
- `ak.txt`
- `rk.txt`
- `codex_accounts_tokens/` 或你配置的 token 输出目录

这些文件都应保留本地使用，不应提交到仓库。

## 与原项目的差异

相比上游项目，本目录的核心改动是将邮箱接收能力切换为 DuckMail：

- 使用 `POST /accounts` 创建临时邮箱
- 使用 `POST /token` 获取 DuckMail Bearer Token
- 使用 `GET /messages` 和 `GET /messages/{id}` 轮询验证码邮件

## CPA 使用说明

- 生成的 token JSON 适配 CLIProxyAPI v6 命名格式
- `refresh_token` 会一并保存，供 CPA 自动刷新 access token
- 如果配置了 `upload_api_url`，脚本会自动上传生成的 auth file
