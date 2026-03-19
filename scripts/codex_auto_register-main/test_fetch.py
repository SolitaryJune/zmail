import sys
import os
import re
sys.path.append("/Users/a24/Library/Mobile Documents/com~apple~CloudDocs/Share/Code/zmail/scripts/codex_auto_register-main")

from chatgpt_register import _fetch_emails_zmail, _fetch_email_detail_zmail

mail_user = "1c0lukjstd"
print(f"[*] 正在获取邮箱 {mail_user} 的列表...")
emails = _fetch_emails_zmail(mail_user)

print(f"[*] 共获取到 {len(emails or [])} 封邮件。")
for m in reversed(emails or []):
    m_id = m.get("id") or m.get("messageId")
    subject = m.get("subject", "No Subject")
    print(f"\n  - 邮件 ID: {m_id} | 主题: {subject}")
    if not m_id: continue
    
    detail = _fetch_email_detail_zmail(m_id)
    content = detail.get("text", "") or detail.get("html", "") or ""
    match = re.search(r"\b\d{6}\b", content)
    
    if match:
        print(f"  --> [成功] 提取到验证码: {match.group(0)}")
    else:
        print(f"  --> [失败] 此邮件中未找到 6 位数验证码。")
