#!/usr/bin/env python3
"""
自动重新登录失效的 Codex 账号并上传新 Token 到 CPA。

使用纯 HTTP 模式 + Zmail 获取邮箱验证码（OTP）。
"""
import os
import sys
import json
import re
import time
import argparse
import urllib.request
import urllib.error

# 添加当前目录到 sys.path，以便导入 codex 模块
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

try:
    from codex.protocol_keygen import (
        perform_codex_oauth_login_http,
        save_token_json,
        upload_token_json,
        load_config,
        create_session as create_codex_session,
    )
except ImportError as e:
    print(f"❌ 导入失败，请确保在 codex_auto_register-main 目录下运行此脚本: {e}")
    sys.exit(1)

# ==================== Zmail 配置 ====================

config_path = os.path.join(script_dir, "config.json")
_cfg = {}
if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        _cfg = json.load(f)

ZMAIL_BASE_URL = _cfg.get("zmail_base_url", "").rstrip("/")
ZMAIL_AUTH_PASSWORD = _cfg.get("zmail_auth_password", "")
CPA_API_URL = _cfg.get("cpa_api_url", "http://localhost:8317")
CPA_MANAGEMENT_KEY = _cfg.get("cpa_management_key", "")


# ==================== Zmail OTP 工具函数 ====================

def _zmail_headers():
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if ZMAIL_AUTH_PASSWORD:
        h["Authorization"] = f"Bearer {ZMAIL_AUTH_PASSWORD}"
    return h


def _zmail_fetch_emails(mail_address):
    """从 Zmail 获取邮件列表"""
    try:
        import urllib.request as ur
        req = ur.Request(f"{ZMAIL_BASE_URL}/api/mailboxes/{mail_address}/emails", headers=_zmail_headers())
        with ur.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("emails", [])
    except Exception:
        return []


def _zmail_fetch_email_detail(mail_id):
    """获取 Zmail 单封邮件详情"""
    try:
        import urllib.request as ur
        req = ur.Request(f"{ZMAIL_BASE_URL}/api/emails/{mail_id}", headers=_zmail_headers())
        with ur.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def _extract_verification_code(content):
    """从邮件正文提取 6 位验证码"""
    if not content:
        return None
    patterns = [
        r"Verification code:?\s*(\d{6})",
        r"code is\s*(\d{6})",
        r"(?<!\d)(\d{6})(?!\d)",
    ]
    for p in patterns:
        m = re.findall(p, content, re.IGNORECASE)
        for code in m:
            if code == "177010":
                continue
            return code
    return None


def wait_for_zmail_otp(mail_address, timeout=120):
    """轮询 Zmail 等待 OpenAI OTP 验证码"""
    print(f"  📬 从 Zmail 轮询验证码 ({mail_address}, 最多 {timeout}s)...")
    start = time.time()
    tried_ids = set()

    while time.time() - start < timeout:
        emails = _zmail_fetch_emails(mail_address)
        for email_item in emails:
            mid = email_item.get("id")
            if not mid or mid in tried_ids:
                continue
            from_addr = email_item.get("fromAddress", "").lower()
            subject = email_item.get("subject", "").lower()
            if "openai" not in from_addr and "openai" not in subject:
                continue
            tried_ids.add(mid)
            detail = _zmail_fetch_email_detail(mid)
            if detail:
                email_obj = detail.get("email", {})
                text = email_obj.get("textContent", "")
                html = email_obj.get("htmlContent", "")
                code = _extract_verification_code(subject + " " + text + " " + html)
                if code:
                    print(f"  ✅ Zmail 验证码: {code}")
                    return code
        elapsed = int(time.time() - start)
        print(f"  ⏳ 等待中... ({elapsed}s/{timeout}s)")
        time.sleep(3)

    print(f"  ❌ 验证码等待超时 ({timeout}s)")
    return None


# ==================== 自定义 HTTP OAuth 登录（带 Zmail OTP） ====================

def perform_login_with_zmail_otp(email, password):
    """
    纯 HTTP OAuth 登录，OTP 验证码通过 Zmail 获取。
    复用 protocol_keygen 的底层工具函数。
    """
    from codex.protocol_keygen import (
        create_session, generate_device_id, generate_pkce,
        generate_datadog_trace, build_sentinel_token,
        codex_exchange_code,
        OAUTH_ISSUER, OAUTH_CLIENT_ID, OAUTH_REDIRECT_URI,
        COMMON_HEADERS, NAVIGATE_HEADERS,
    )
    from urllib.parse import urlencode, urlparse, parse_qs
    import secrets

    print(f"\n🔐 执行 Codex OAuth 登录（纯 HTTP + Zmail OTP）: {email}")

    session = create_session()
    device_id = generate_device_id()
    session.cookies.set("oai-did", device_id, domain=".auth.openai.com")
    session.cookies.set("oai-did", device_id, domain="auth.openai.com")

    code_verifier, code_challenge = generate_pkce()
    state = secrets.token_urlsafe(32)

    authorize_params = {
        "response_type": "code",
        "client_id": OAUTH_CLIENT_ID,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "scope": "openid profile email offline_access",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "state": state,
    }
    authorize_url = f"{OAUTH_ISSUER}/oauth/authorize?{urlencode(authorize_params)}"

    # ===== 步骤1: GET /oauth/authorize =====
    try:
        resp = session.get(authorize_url, headers=NAVIGATE_HEADERS, allow_redirects=True, verify=False, timeout=30)
        print(f"  步骤1: {resp.status_code}")
    except Exception as e:
        print(f"  ❌ OAuth 授权请求失败: {e}")
        return None

    # ===== 步骤2: POST authorize/continue =====
    headers = dict(COMMON_HEADERS)
    headers["referer"] = f"{OAUTH_ISSUER}/log-in"
    headers["oai-device-id"] = device_id
    headers.update(generate_datadog_trace())

    sentinel_email = build_sentinel_token(session, device_id, flow="authorize_continue")
    if not sentinel_email:
        print("  ❌ 无法获取 sentinel token (authorize_continue)")
        return None
    headers["openai-sentinel-token"] = sentinel_email

    try:
        resp = session.post(
            f"{OAUTH_ISSUER}/api/accounts/authorize/continue",
            json={"username": {"kind": "email", "value": email}},
            headers=headers, verify=False, timeout=30,
        )
        print(f"  步骤2: {resp.status_code}")
    except Exception as e:
        print(f"  ❌ 邮箱提交失败: {e}")
        return None

    if resp.status_code != 200:
        print(f"  ❌ 邮箱提交失败: {resp.text[:200]}")
        return None

    # ===== 步骤3: POST password/verify =====
    headers["referer"] = f"{OAUTH_ISSUER}/log-in/password"
    headers.update(generate_datadog_trace())

    sentinel_pwd = build_sentinel_token(session, device_id, flow="password_verify")
    if not sentinel_pwd:
        print("  ❌ 无法获取 sentinel token (password_verify)")
        return None
    headers["openai-sentinel-token"] = sentinel_pwd

    try:
        resp = session.post(
            f"{OAUTH_ISSUER}/api/accounts/password/verify",
            json={"password": password},
            headers=headers, verify=False, timeout=30, allow_redirects=False,
        )
        print(f"  步骤3: {resp.status_code}")
    except Exception as e:
        print(f"  ❌ 密码提交失败: {e}")
        return None

    if resp.status_code != 200:
        print(f"  ❌ 密码验证失败: {resp.text[:200]}")
        return None

    continue_url = ""
    page_type = ""
    try:
        data = resp.json()
        continue_url = data.get("continue_url", "")
        page_type = data.get("page", {}).get("type", "")
        print(f"  page_type: {page_type}, continue_url: {continue_url[:100]}")
    except Exception:
        pass

    if not continue_url:
        print("  ❌ 未获取到 continue_url")
        return None

    # ===== 步骤3.5: 邮箱验证码 (Zmail OTP) =====
    if page_type == "email_otp_verification" or "email-verification" in continue_url:
        print("\n  --- [步骤3.5] 邮箱 OTP 验证（Zmail 模式） ---")

        # 提取邮箱本地部分作为 zmail mailbox address
        mail_address = email.split("@")[0]

        otp_code = wait_for_zmail_otp(mail_address)
        if not otp_code:
            return None

        h_val = dict(COMMON_HEADERS)
        h_val["referer"] = f"{OAUTH_ISSUER}/email-verification"
        h_val["oai-device-id"] = device_id
        h_val.update(generate_datadog_trace())

        resp = session.post(
            f"{OAUTH_ISSUER}/api/accounts/email-otp/validate",
            json={"code": otp_code},
            headers=h_val, verify=False, timeout=30,
        )
        if resp.status_code != 200:
            print(f"  ❌ 验证码验证失败: {resp.status_code} - {resp.text[:200]}")
            return None

        print(f"  ✅ 验证码 {otp_code} 验证通过！")
        try:
            data = resp.json()
            continue_url = data.get("continue_url", "")
            page_type = data.get("page", {}).get("type", "")
        except Exception:
            pass

        # about-you 步骤（对于已注册的重新登录一般不会出现，但以防万一）
        if "about-you" in continue_url:
            print("  📝 处理 about-you 步骤（跳转 consent）...")
            continue_url = f"{OAUTH_ISSUER}/sign-in-with-chatgpt/codex/consent"

    if "consent" in page_type:
        continue_url = f"{OAUTH_ISSUER}/sign-in-with-chatgpt/codex/consent"

    if not continue_url or "email-verification" in continue_url:
        print("  ❌ 未获取到 consent URL")
        return None

    # ===== 步骤4: consent → 提取 code → 换 token =====
    print("\n  --- [步骤4] consent → 提取 authorization code ---")

    if continue_url.startswith("/"):
        consent_url = f"{OAUTH_ISSUER}{continue_url}"
    else:
        consent_url = continue_url

    import base64

    def _extract_code_from_url(url):
        if not url or "code=" not in url:
            return None
        try:
            return parse_qs(urlparse(url).query).get("code", [None])[0]
        except Exception:
            return None

    def _decode_auth_session(session_obj):
        for c in session_obj.cookies:
            if c.name == "oai-client-auth-session":
                val = c.value
                first_part = val.split(".")[0] if "." in val else val
                pad = 4 - len(first_part) % 4
                if pad != 4:
                    first_part += "=" * pad
                try:
                    raw = base64.urlsafe_b64decode(first_part)
                    return json.loads(raw.decode("utf-8"))
                except Exception:
                    pass
        return None

    def _follow_and_extract_code(session_obj, url, max_depth=10):
        if max_depth <= 0:
            return None
        import requests
        try:
            r = session_obj.get(url, headers=NAVIGATE_HEADERS, verify=False, timeout=15, allow_redirects=False)
            if r.status_code in (301, 302, 303, 307, 308):
                loc = r.headers.get("Location", "")
                code = _extract_code_from_url(loc)
                if code:
                    return code
                if loc.startswith("/"):
                    loc = f"{OAUTH_ISSUER}{loc}"
                return _follow_and_extract_code(session_obj, loc, max_depth - 1)
            elif r.status_code == 200:
                return _extract_code_from_url(r.url)
        except Exception as e:
            url_match = re.search(r'(https?://localhost[^\s\'\"]+)', str(e))
            if url_match:
                return _extract_code_from_url(url_match.group(1))
        return None

    auth_code = None

    # 4a: GET consent
    try:
        resp = session.get(consent_url, headers=NAVIGATE_HEADERS, verify=False, timeout=30, allow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308):
            loc = resp.headers.get("Location", "")
            auth_code = _extract_code_from_url(loc)
            if not auth_code:
                auth_code = _follow_and_extract_code(session, loc)
        elif resp.status_code == 200:
            print(f"  consent 页面已加载")
    except Exception as e:
        url_match = re.search(r'(https?://localhost[^\s\'\"]+)', str(e))
        if url_match:
            auth_code = _extract_code_from_url(url_match.group(1))

    # 4b: workspace/select + organization/select
    if not auth_code:
        session_data = _decode_auth_session(session)
        workspace_id = None
        if session_data:
            workspaces = session_data.get("workspaces", [])
            if workspaces:
                workspace_id = workspaces[0].get("id")

        if workspace_id:
            h_consent = dict(COMMON_HEADERS)
            h_consent["referer"] = consent_url
            h_consent["oai-device-id"] = device_id
            h_consent.update(generate_datadog_trace())

            try:
                resp = session.post(
                    f"{OAUTH_ISSUER}/api/accounts/workspace/select",
                    json={"workspace_id": workspace_id},
                    headers=h_consent, verify=False, timeout=30, allow_redirects=False,
                )
                print(f"  workspace/select: {resp.status_code}")

                if resp.status_code in (301, 302, 303, 307, 308):
                    loc = resp.headers.get("Location", "")
                    auth_code = _extract_code_from_url(loc)
                    if not auth_code:
                        auth_code = _follow_and_extract_code(session, loc)
                elif resp.status_code == 200:
                    ws_data = resp.json()
                    ws_next = ws_data.get("continue_url", "")
                    orgs = ws_data.get("data", {}).get("orgs", [])

                    org_id = None
                    project_id = None
                    if orgs:
                        org_id = orgs[0].get("id")
                        projects = orgs[0].get("projects", [])
                        if projects:
                            project_id = projects[0].get("id")

                    if org_id:
                        body = {"org_id": org_id}
                        if project_id:
                            body["project_id"] = project_id

                        h_org = dict(COMMON_HEADERS)
                        h_org["referer"] = ws_next if ws_next.startswith("http") else f"{OAUTH_ISSUER}{ws_next}"
                        h_org["oai-device-id"] = device_id
                        h_org.update(generate_datadog_trace())

                        resp_org = session.post(
                            f"{OAUTH_ISSUER}/api/accounts/organization/select",
                            json=body, headers=h_org, verify=False, timeout=30, allow_redirects=False,
                        )
                        print(f"  organization/select: {resp_org.status_code}")

                        if resp_org.status_code in (301, 302, 303, 307, 308):
                            loc = resp_org.headers.get("Location", "")
                            auth_code = _extract_code_from_url(loc)
                            if not auth_code:
                                auth_code = _follow_and_extract_code(session, loc)
                        elif resp_org.status_code == 200:
                            org_data = resp_org.json()
                            org_next = org_data.get("continue_url", "")
                            if org_next:
                                full_next = org_next if org_next.startswith("http") else f"{OAUTH_ISSUER}{org_next}"
                                auth_code = _follow_and_extract_code(session, full_next)
                    elif ws_next:
                        full_next = ws_next if ws_next.startswith("http") else f"{OAUTH_ISSUER}{ws_next}"
                        auth_code = _follow_and_extract_code(session, full_next)
            except Exception as e:
                print(f"  ⚠️ consent 流程异常: {e}")

    # 4d: 备用 allow_redirects=True
    if not auth_code:
        try:
            resp = session.get(consent_url, headers=NAVIGATE_HEADERS, verify=False, timeout=30, allow_redirects=True)
            auth_code = _extract_code_from_url(resp.url)
            if not auth_code and resp.history:
                for r in resp.history:
                    auth_code = _extract_code_from_url(r.headers.get("Location", ""))
                    if auth_code:
                        break
        except Exception as e:
            url_match = re.search(r'(https?://localhost[^\s\'\"]+)', str(e))
            if url_match:
                auth_code = _extract_code_from_url(url_match.group(1))

    if not auth_code:
        print("  ❌ 未获取到 authorization code")
        return None

    print(f"  ✅ 获取到 code（长度: {len(auth_code)}）")
    return codex_exchange_code(auth_code, code_verifier)


# ==================== CPA 上传 ====================

def upload_to_cpa(filepath):
    """使用 CPA 管理 API 上传 token JSON"""
    if not CPA_API_URL or not CPA_MANAGEMENT_KEY:
        print("  ⚠️ CPA 配置缺失，跳过上传")
        return False

    try:
        import urllib.request as ur
        url = f"{CPA_API_URL.rstrip('/')}/v0/management/auth-files?name={os.path.basename(filepath)}"
        with open(filepath, "rb") as f:
            data = f.read()
        req = ur.Request(url, data=data, method="POST")
        req.add_header("Authorization", f"Bearer {CPA_MANAGEMENT_KEY}")
        req.add_header("Content-Type", "application/json")
        with ur.urlopen(req, timeout=30) as resp:
            if resp.status in (200, 201):
                print(f"  ✅ 已上传到 CPA: {os.path.basename(filepath)}")
                return True
            else:
                print(f"  ❌ CPA 上传失败: {resp.status}")
                return False
    except Exception as e:
        print(f"  ❌ CPA 上传异常: {e}")
        return False


# ==================== 主流程 ====================

def get_registered_accounts(file_path):
    accounts = {}
    if not os.path.exists(file_path):
        print(f"⚠️ 找不到账号文件: {file_path}")
        return accounts
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split("----")
            if len(parts) >= 2:
                accounts[parts[0].strip()] = parts[1].strip()
    return accounts


def get_invalid_accounts(host, management_key):
    url = f"{host}/v0/management/auth-files"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {management_key}")
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            files = data.get("files", [])
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return []

    needs_relogin = []
    for f in files:
        status = f.get("status")
        unavailable = f.get("unavailable")
        disabled = f.get("disabled")
        if not disabled and (status not in ("ready", "active") or unavailable):
            if "sign" in str(f).lower():
                needs_relogin.append(f)
    return needs_relogin


def main():
    parser = argparse.ArgumentParser(description="自动重新登录失效的 Codex 账号（HTTP + Zmail OTP）")
    parser.add_argument("--host", help="CPA API 主机地址")
    parser.add_argument("--key", help="CPA 管理密钥")
    args = parser.parse_args()

    host = args.host or CPA_API_URL
    management_key = args.key or os.environ.get("MANAGEMENT_KEY") or CPA_MANAGEMENT_KEY

    if not management_key:
        print("❌ 必须提供 MANAGEMENT_KEY")
        sys.exit(1)

    print(f"🌐 正在连接 API 服务器获取失效账号列表: {host}")
    invalid_accounts = get_invalid_accounts(host, management_key)

    if not invalid_accounts:
        print("✅ 未发现需要重新登陆的失效账号。")
        return

    print(f"⚠️ 发现 {len(invalid_accounts)} 个待重新登录的账号。")

    # 查找 registered_accounts.txt
    for candidate in [
        os.path.join(script_dir, "..", "..", "registered_accounts.txt"),
        os.path.join(script_dir, "..", "registered_accounts.txt"),
        os.path.join(script_dir, "registered_accounts.txt"),
    ]:
        p = os.path.abspath(candidate)
        if os.path.exists(p):
            accounts_file_path = p
            break
    else:
        print("❌ 找不到 registered_accounts.txt")
        sys.exit(1)

    account_db = get_registered_accounts(accounts_file_path)
    print(f"📋 已加载 {len(account_db)} 个账号密码记录")

    success_count = 0
    fail_count = 0

    for idx, acc in enumerate(invalid_accounts):
        email = acc.get("email")
        if not email:
            print(f"[{idx+1}/{len(invalid_accounts)}] ❌ 跳过: 无邮箱 - {acc.get('id')}")
            fail_count += 1
            continue

        password = account_db.get(email)
        if not password:
            print(f"[{idx+1}/{len(invalid_accounts)}] ❌ 找不到密码: {email}")
            fail_count += 1
            continue

        print(f"\n{'='*60}")
        print(f"[{idx+1}/{len(invalid_accounts)}] 🚀 开始重新登录: {email}")

        try:
            tokens = perform_login_with_zmail_otp(email, password)
            if tokens and "access_token" in tokens:
                print(f"  ✅ 获取 Token 成功！")
                filename = save_token_json(
                    email,
                    tokens.get("access_token"),
                    tokens.get("refresh_token"),
                    tokens.get("id_token"),
                )
                # 上传到 CPA
                from codex.protocol_keygen import TOKEN_JSON_DIR
                filepath = None
                if filename:
                    # save_token_json 返回的是 None（它内部打印了路径），
                    # 需要自行构造路径
                    pass

                # 在 token_json_dir 中寻找刚保存的文件
                if os.path.exists(TOKEN_JSON_DIR):
                    for fn in sorted(os.listdir(TOKEN_JSON_DIR), key=lambda x: os.path.getmtime(os.path.join(TOKEN_JSON_DIR, x)), reverse=True):
                        if email in fn:
                            filepath = os.path.join(TOKEN_JSON_DIR, fn)
                            break

                if filepath and os.path.exists(filepath):
                    upload_to_cpa(filepath)

                success_count += 1
            else:
                print(f"  ❌ 重新登录失败，未返回 Token。")
                fail_count += 1
        except Exception as e:
            print(f"  ❌ 重新登录异常: {e}")
            import traceback
            traceback.print_exc()
            fail_count += 1

        if idx < len(invalid_accounts) - 1:
            print(f"\n⏳ 休息 5 秒后继续...")
            time.sleep(5)

    print(f"\n🎉 任务完成！成功: {success_count}，失败: {fail_count}")


if __name__ == "__main__":
    main()
