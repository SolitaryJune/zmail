# Zmail 私有临时邮箱 API 文档

## 概述

Zmail 是一个私有临时邮箱服务，提供邮箱创建、邮件收取和账号管理功能。本文档提取自自动注册脚本，描述所有对外暴露的 API 接口及其用法。

---

## 配置

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ZMAIL_BASE_URL` | `` | Zmail 服务根地址 |
| `ZMAIL_AUTH_PASSWORD` | _(空)_ | Bearer Token 鉴权密码 |
| `ZMAIL_EMAIL_DOMAIN` | `` | 邮箱域名（获取域名接口失败时的回退值） |

### config.json（可选）

支持通过同目录下的 `config.json` 覆盖环境变量配置：

```json
{
  "zmail": {
    "base_url": "https://your-zmail-host.com",
    "auth_password": "your-secret-password"
  }
}
```

> **优先级**：`config.json` > 环境变量 > 默认值

---

## 请求头

所有接口均使用以下统一请求头：

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <ZMAIL_AUTH_PASSWORD>   # 仅在配置了密码时附加
```

---

## 接口列表

### 1. 获取系统配置

获取服务端支持的邮箱域名等配置信息。

```
GET /api/config
```

**请求示例：**

```bash
curl https://jo24mail.gushao.club/api/config
```

**响应示例：**

```json
{
  "config": {
    "emailDomains": ["jo24.mail.gushao.club"]
  }
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `config.emailDomains` | `string[]` | 可用的邮箱域名列表，取第一个使用 |

---

### 2. 创建邮箱

创建一个新的临时邮箱。

```
POST /api/mailboxes
```

**请求体：**

```json
{
  "address": "your-local-part"
}
```

> `address` 为邮箱本地部分（`@` 前缀），可省略由后端随机生成。

**策略：** 优先指定 `address` 创建；若返回非 200/201，则改为空 body 重试，让后端自动分配。

**响应示例：**

```json
{
  "success": true,
  "mailbox": {
    "address": "swiftfox42"
  }
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | `boolean` | 是否创建成功 |
| `mailbox.address` | `string` | 邮箱本地部分，拼接域名后得到完整邮箱地址 |

**完整邮箱地址构造：**

1. 调用 `GET /api/config` 获取 `emailDomains[0]`
2. 拼接：`{address}@{domain}` → `swiftfox42@jo24.mail.gushao.club`
3. 若获取域名失败，回退到环境变量 `ZMAIL_EMAIL_DOMAIN`

---

### 3. 获取邮箱邮件列表

轮询指定邮箱的收件箱。

```
GET /api/mailboxes/{address}/emails
```

**路径参数：**

| 参数 | 说明 |
|------|------|
| `address` | 邮箱本地部分（即创建邮箱时返回的 `mailbox.address`） |

**响应示例：**

```json
{
  "emails": [
    {
      "id": "msg-001",
      "fromAddress": "noreply@openai.com",
      "subject": "Verify your email"
    }
  ]
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `emails` | `object[]` | 邮件摘要列表 |
| `emails[].id` | `string` | 邮件唯一 ID，用于获取详情 |
| `emails[].fromAddress` | `string` | 发件人地址 |
| `emails[].subject` | `string` | 邮件主题 |

---

### 4. 获取邮件详情

根据邮件 ID 获取完整邮件内容（含正文）。

```
GET /api/emails/{mail_id}
```

**路径参数：**

| 参数 | 说明 |
|------|------|
| `mail_id` | 邮件 ID（来自列表接口的 `emails[].id`） |

**响应示例：**

```json
{
  "email": {
    "textContent": "Your verification code is 123456",
    "htmlContent": "<p>Your verification code is <b>123456</b></p>"
  }
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `email.textContent` | `string` | 纯文本正文 |
| `email.htmlContent` | `string` | HTML 正文 |

---

### 5. 保存账号

将注册成功的第三方账号信息保存到 Zmail 账号管理系统。

> ⚠️ 此接口需要配置 `ZMAIL_AUTH_PASSWORD`，否则跳过。

```
POST /api/accounts
```

**请求体：**

```json
{
  "title": "OpenAI - user@example.com",
  "email": "user@example.com",
  "password": "account-password",
  "platforms": "OpenAI",
  "notes": "自动注册于 2025-01-01 12:00:00"
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 账号标题，格式为 `{platform} - {email}` |
| `email` | `string` | 注册邮箱 |
| `password` | `string` | 账号密码（可为空） |
| `platforms` | `string` | 平台名称，如 `OpenAI` |
| `notes` | `string` | 备注，记录注册时间 |

**响应示例：**

```json
{
  "success": true
}
```

---

## 验证码提取逻辑

获取邮件列表后，按以下逻辑过滤并提取验证码：

1. **过滤发件人：** `fromAddress` 包含 `openai`，或邮件主题包含 `openai`（不区分大小写）
2. **获取详情：** 用邮件 `id` 请求 `GET /api/emails/{id}`，拼接 `subject + textContent + htmlContent`
3. **正则提取：** 匹配 6 位纯数字验证码（前后不能是数字）

```regex
(?<!\d)(\d{6})(?!\d)
```

**轮询策略：**

- 每隔 **3 秒** 轮询一次
- 最多轮询 **40 次**（约 2 分钟超时）
- 失败/异常自动跳过，不中断轮询

---

## 完整使用示例（Python）

```python
import requests, re, time, os

ZMAIL_BASE_URL = os.environ.get("ZMAIL_BASE_URL", "https://jo24mail.gushao.club")
ZMAIL_AUTH_PASSWORD = os.environ.get("ZMAIL_AUTH_PASSWORD", "")

def headers():
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if ZMAIL_AUTH_PASSWORD:
        h["Authorization"] = f"Bearer {ZMAIL_AUTH_PASSWORD}"
    return h

# 1. 创建邮箱
r = requests.post(f"{ZMAIL_BASE_URL}/api/mailboxes", headers=headers(), json={"address": "testbox"})
data = r.json()
address = data["mailbox"]["address"]

# 2. 获取域名
cfg = requests.get(f"{ZMAIL_BASE_URL}/api/config").json()
domain = cfg["config"]["emailDomains"][0]
email = f"{address}@{domain}"
print(f"邮箱: {email}")

# 3. 轮询验证码
for _ in range(40):
    mails = requests.get(f"{ZMAIL_BASE_URL}/api/mailboxes/{address}/emails", headers=headers()).json()
    for mail in mails.get("emails", []):
        if "openai" not in mail.get("fromAddress", "").lower():
            continue
        detail = requests.get(f"{ZMAIL_BASE_URL}/api/emails/{mail['id']}", headers=headers()).json()
        email_obj = detail.get("email", {})
        content = email_obj.get("textContent", "") + email_obj.get("htmlContent", "")
        m = re.search(r"(?<!\d)(\d{6})(?!\d)", content)
        if m:
            print(f"验证码: {m.group(1)}")
            break
    time.sleep(3)

# 4. 保存账号（可选）
requests.post(f"{ZMAIL_BASE_URL}/api/accounts", headers=headers(), json={
    "title": f"OpenAI - {email}",
    "email": email,
    "password": "",
    "platforms": "OpenAI",
    "notes": "自动注册"
})
```

---

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 创建邮箱返回非 200/201 | 改用空 body 重试一次 |
| `success` 为 `false` | 返回失败，不继续 |
| 获取域名接口异常 | 回退到 `ZMAIL_EMAIL_DOMAIN` 环境变量 |
| 轮询邮件超时（40次） | 返回空字符串，由调用方判断失败 |
| 保存账号未配置密码 | 跳过，打印提示，不报错 |
| 任意网络异常 | 捕获异常，跳过本次轮询，继续重试 |
