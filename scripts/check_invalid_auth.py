#!/usr/bin/env python3
import os
import sys
import json
import argparse
import urllib.request
import urllib.error

def check_auth_status(host, management_key):
    url = f"{host}/v0/management/auth-files"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {management_key}")

    files = None
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                files = data.get("files", [])
    except urllib.error.URLError as e:
        print(f"❌ 请求失败 ({url}): {e}")
        if hasattr(e, 'read'):
            try:
                print(e.read().decode('utf-8'))
            except:
                pass
        sys.exit(1)

    if files is None:
        print("未能获取文件列表。可能核心认证管理器不可用（或降级为仅扫描 auth-dir 模式）。")
        sys.exit(1)

    needs_relogin = []
    disabled_list = []
    
    for f in files:
        status = f.get("status")
        unavailable = f.get("unavailable")
        disabled = f.get("disabled")

        # 将 disabled (主动禁用) 与真实的异常失效状态区分开
        if disabled:
            if "sign" in str(f).lower():
                disabled_list.append(f)
        elif status not in ("ready", "active") or unavailable:
            # 根据要求，仅筛选出包含关键词 "sign" 的账号
            if "sign" in str(f).lower():
                needs_relogin.append(f)

    if not needs_relogin and not disabled_list:
        print("✅ 所有账号认证状态均为正常 (ready)，未发现需要重新登陆的账号。")
        return

    # 输出失效/异常账号
    if needs_relogin:
        print(f"⚠️  发现 {len(needs_relogin)} 个【认证异常 / 失效】需要重新登陆的账号：\n")
        for f in needs_relogin:
            print_account_info(f)

    # 补充输出主动禁用的账号（有时也会因为不可用而选择禁用）
    if disabled_list:
        print(f"⏸  发现 {len(disabled_list)} 个【主动禁用 (Disabled)】的账号：\n")
        for f in disabled_list:
            print_account_info(f)

def print_account_info(file):
    print(f"✉️  账号邮箱: {file.get('email', '未提供')}")
    print(f"🆔 文件 ID:   {file.get('id', file.get('name', 'N/A'))}")
    print(f"📂 提供商:   {file.get('provider', 'N/A')}")
    print(f"⛔️ 当前状态: {file.get('status', 'N/A')}")
    print(f"📝 状态信息: {file.get('status_message', '无')}")
    if file.get('last_refresh'):
        print(f"🔄 最后刷新: {file.get('last_refresh')}")
    if file.get('path'):
        print(f"🗂  本地路径: {file.get('path')}")
    print("-" * 50)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="查询需要重新登录或处于异常状态的账号")
    parser.add_argument("--host", help="API 主机地址 (默认优先使用 config.json 中的 cpa_api_url)")
    parser.add_argument("--key", help="管理密钥 (默认优先使用 config.json 中的 cpa_management_key)")

    args = parser.parse_args()

    # 尝试读取 config.json 获取默认配置
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "codex_auto_register-main", "config.json")
    
    config_host = "http://localhost:8317"
    config_key = None
    
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
                config_host = config_data.get("cpa_api_url", config_host)
                config_key = config_data.get("cpa_management_key", config_key)
        except Exception as e:
            print(f"⚠️ 读取 config.json 失败: {e}")

    host = args.host or config_host
    management_key = args.key or os.environ.get("MANAGEMENT_KEY") or config_key

    if not management_key:
        print("❌ 错误：必须提供 MANAGEMENT_KEY。可以通过 config.json、环境变量或 --key 参数传递。")
        sys.exit(1)

    print(f"🌐 正在连接 API 服务器: {host}")
    check_auth_status(host, management_key)

