#!/bin/bash

# 自动同步脚本：保持单次提交并强制推送到远程
# 逻辑：将所有更改合并到上一次提交，并强制推送

echo "🚀 开始自动同步 (单一提交模式)..."

# 1. 添加所有更改
git add -A

# 2. 覆盖上一次提交
# 获取当前的提交信息，或者使用默认信息
LAST_MSG=$(git log -1 --pretty=%B)
if [ -z "$LAST_MSG" ]; then
    LAST_MSG="Sync: $(date +'%Y-%m-%d %H:%M:%S')"
fi

echo "📝 正在覆盖提交: $LAST_MSG"
git commit --amend -m "$LAST_MSG" --no-edit

# 3. 强制推送
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📤 正在强制推送到 $CURRENT_BRANCH..."
git push -f origin "$CURRENT_BRANCH"

if [ $? -eq 0 ]; then
    echo "✅ 同步成功！当前仓库仅保留最新一次提交。"
else
    echo "❌ 同步失败，请检查网络或远程仓库权限。"
    exit 1
fi
