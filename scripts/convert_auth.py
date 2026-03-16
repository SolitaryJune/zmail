import json
import os
import base64
from datetime import datetime, timezone, timedelta

def decode_jwt(token):
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload = parts[1]
        # Add padding if necessary
        missing_padding = len(payload) % 4
        if missing_padding:
            payload += '=' * (4 - missing_padding)
        decoded = base64.b64decode(payload).decode('utf-8')
        return json.loads(decoded)
    except Exception:
        return None

def format_iso8601(timestamp):
    # Convert unix timestamp to ISO 8601 with +08:00 offset as requested in example
    dt = datetime.fromtimestamp(timestamp, tz=timezone(timedelta(hours=8)))
    return dt.isoformat(timespec='seconds')

def convert():
    input_path = "/Users/a24/.codex/auth.json"

    if not os.path.exists(input_path):
        print(f"Error: Input file not found at {input_path}")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tokens = data.get("tokens", {})
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    account_id = tokens.get("account_id")
    last_refresh = data.get("last_refresh")

    # Decode tokens to get email and expiry
    id_info = decode_jwt(id_token) if id_token else {}
    access_info = decode_jwt(access_token) if access_token else {}

    email = id_info.get("email") or access_info.get("https://api.openai.com/profile", {}).get("email")
    exp = access_info.get("exp")
    expired_str = format_iso8601(exp) if exp else ""

    # Construct target format
    result = {
        "access_token": access_token,
        "account_id": account_id,
        "disabled": False,
        "email": email,
        "expired": expired_str,
        "id_token": id_token,
        "last_refresh": last_refresh,
        "refresh_token": refresh_token,
        "type": "codex",
        "websocket": False
    }

    # Generate output path with full email
    filename = f"{email}_auth.json" if email else "unknown_auth.json"
    output_path = os.path.expanduser(f"~/Downloads/{filename}")

    # Write in compact format (single line, no spaces after commas/colons)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, separators=(',', ':'), ensure_ascii=False)

    try:
        os.remove(input_path)
        print(f"Deleted input file: {input_path}")
    except OSError as e:
        print(f"Warning: Could not delete input file {input_path}: {e}")

    print(f"Success! Output written to {output_path}")

if __name__ == "__main__":
    convert()
