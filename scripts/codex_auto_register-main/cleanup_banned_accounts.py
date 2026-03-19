#!/usr/bin/env python3
"""
清理被 OpenAI 封禁的账号（以 CPA 为准）：
1. 从 CPA 获取失效账号列表（唯一数据源）
2. 从 CPA 删除对应的 auth 文件
3. 从 Zmail 云端批量删除对应的 OpenAI 账号记录
4. 在 registered_accounts.txt 中标记为 banned
"""
import os
import json
import urllib.request
import urllib.error

script_dir = os.path.dirname(os.path.abspath(__file__))

# 读取配置
config_path = os.path.join(script_dir, "config.json")
_cfg = {}
if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        _cfg = json.load(f)

CPA_API_URL = _cfg.get("cpa_api_url", "http://localhost:8317").rstrip("/")
CPA_MANAGEMENT_KEY = _cfg.get("cpa_management_key", "")
ZMAIL_BASE_URL = _cfg.get("zmail_base_url", "").rstrip("/")
ZMAIL_AUTH_PASSWORD = _cfg.get("zmail_auth_password", "")


def cpa_request(method, path, data=None):
    """发送 CPA API 请求"""
    url = f"{CPA_API_URL}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {CPA_MANAGEMENT_KEY}")
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if hasattr(e, "read") else ""
        return e.code, {"error": body}
    except Exception as e:
        return 0, {"error": str(e)}


def get_banned_accounts():
    """获取 CPA 中所有需要清理的封禁/失效账号"""
    status, data = cpa_request("GET", "/v0/management/auth-files")
    if status != 200:
        print(f"❌ 获取账号列表失败: {status}")
        return []

    banned = []
    for f in data.get("files", []):
        # 只处理 codex（ChatGPT）提供商的账号
        provider = f.get("provider", "")
        if provider != "codex":
            continue

        acc_status = f.get("status")
        disabled = f.get("disabled")
        unavailable = f.get("unavailable")

        if not disabled and (acc_status not in ("ready", "active") or unavailable):
            if "sign" in str(f).lower():
                banned.append(f)

    return banned


def delete_from_cpa(accounts):
    """从 CPA 删除指定的 auth 文件"""
    deleted = 0
    failed = 0
    for acc in accounts:
        name = acc.get("name", "")
        if not name:
            continue
        status, resp = cpa_request("DELETE", f"/v0/management/auth-files?name={name}")
        if status == 200:
            print(f"  ✅ 已删除: {name}")
            deleted += 1
        else:
            print(f"  ❌ 删除失败 ({status}): {name} - {resp}")
            failed += 1
    return deleted, failed


def delete_from_zmail(banned_emails):
    """从 Zmail 云端批量删除封禁的 OpenAI 账号"""
    if not ZMAIL_BASE_URL:
        print("  ⚠️ 未配置 zmail_base_url，跳过 Zmail 清理")
        return 0, 0

    emails_list = list(banned_emails)
    print(f"  📡 调用批量删除 API（{len(emails_list)} 个，仅 OpenAI 平台）...")

    url = f"{ZMAIL_BASE_URL}/api/accounts/batch-delete"
    body = json.dumps({"emails": emails_list, "platform": "OpenAI"}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {ZMAIL_AUTH_PASSWORD}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            deleted = data.get("deleted", 0)
            print(f"  ✅ Zmail 批量删除完成: {deleted} 个 OpenAI 账号")
            return deleted, 0
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8") if hasattr(e, "read") else ""
        print(f"  ❌ Zmail 批量删除失败 ({e.code}): {body_text[:200]}")
        return 0, len(emails_list)
    except Exception as e:
        print(f"  ❌ Zmail 批量删除异常: {e}")
        return 0, len(emails_list)


def mark_banned_in_file(banned_emails):
    """在 registered_accounts.txt 中标记封禁账号"""
    for candidate in [
        os.path.join(script_dir, "..", "..", "registered_accounts.txt"),
        os.path.join(script_dir, "..", "registered_accounts.txt"),
        os.path.join(script_dir, "registered_accounts.txt"),
    ]:
        p = os.path.abspath(candidate)
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                lines = f.readlines()

            marked = 0
            new_lines = []
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    new_lines.append(line)
                    continue
                email = stripped.split("----")[0].strip()
                if email in banned_emails and "----banned" not in stripped:
                    new_lines.append(stripped + "----banned\n")
                    marked += 1
                else:
                    new_lines.append(line)

            with open(p, "w", encoding="utf-8") as f:
                f.writelines(new_lines)

            print(f"  📝 {p}")
            print(f"  已标记 {marked} 个账号为 banned")
            return marked

    print("  ⚠️ 未找到 registered_accounts.txt")
    return 0


def main():
    print(f"🌐 连接 CPA: {CPA_API_URL}")

    # 1. 从 CPA 获取封禁账号列表（唯一数据源）
    banned = get_banned_accounts()
    if not banned:
        print("✅ CPA 中没有需要清理的封禁账号。")
        return

    print(f"\n⚠️ 发现 {len(banned)} 个封禁/失效账号：")
    banned_emails = set()
    for acc in banned:
        email = acc.get("email", "N/A")
        name = acc.get("name", "N/A")
        status_msg = acc.get("status_message", "")[:80]
        print(f"  • {email} ({name}) - {status_msg}")
        if email:
            banned_emails.add(email)

    # 2. 从 CPA 删除
    print(f"\n🗑️ 正在从 CPA 删除 {len(banned)} 个文件...")
    cpa_deleted, cpa_failed = delete_from_cpa(banned)
    print(f"  删除完成: 成功 {cpa_deleted}，失败 {cpa_failed}")

    # 3. 从 Zmail 云端批量删除（仅 OpenAI 平台）
    print(f"\n☁️ 正在从 Zmail 云端删除...")
    zmail_deleted, zmail_failed = delete_from_zmail(banned_emails)

    # 4. 在 registered_accounts.txt 中标记
    print(f"\n📋 标记本地账号文件...")
    mark_banned_in_file(banned_emails)

    print(f"\n🎉 清理完成！")
    print(f"  CPA:   删除 {cpa_deleted} 个")
    print(f"  Zmail: 删除 {zmail_deleted} 个（仅 OpenAI）")
    print(f"  本地:  标记 {len(banned_emails)} 个封禁账号")


if __name__ == "__main__":
    main()
