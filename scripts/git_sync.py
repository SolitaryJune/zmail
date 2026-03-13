import subprocess
import sys
import datetime

def run_command(command):
    """运行 shell 命令并返回输出结果"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            check=True, 
            capture_output=True, 
            text=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ 错误: 执行命令时出错: {command}")
        print(f"错误信息: {e.stderr}")
        sys.exit(1)

def main():
    print("🚀 开始自动同步 (单一提交模式 - Python 版)...")

    # 1. 添加所有更改
    print("📦 正在暂存更改...")
    run_command("git add -A")

    # 2. 获取当前分支名
    current_branch = run_command("git rev-parse --abbrev-ref HEAD")

    # 3. 覆盖上一次提交
    # 尝试获取最后一次提交信息
    try:
        last_msg = run_command("git log -1 --pretty=%B")
    except:
        last_msg = ""

    if not last_msg:
        last_msg = f"Sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    print(f"📝 正在覆盖提交: {last_msg}")
    run_command(f'git commit --amend -m "{last_msg}" --no-edit')

    # 4. 强制推送
    print(f"📤 正在强制推送到远程分支: {current_branch}...")
    run_command(f"git push -f origin {current_branch}")

    print("✅ 同步成功！当前仓库仅保留最新一次提交。")

if __name__ == "__main__":
    main()
