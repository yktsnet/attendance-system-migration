#!/bin/bash
set -euo pipefail

# 常にリポジトリのルートディレクトリに移動して実行する
cd "$(dirname "$0")/.."

echo "🚀 CI/CD Pipeline Started: $(date)"

# 1. 最新のコードを取得
echo "📥 Pulling latest changes..."
git pull origin main

# 2. テストの実行
echo "🧪 Running Tests..."
dotnet test src/Api.Tests/AttendanceApi.Tests.csproj
if [ $? -ne 0 ]; then
    echo "❌ Tests Failed. Deployment aborted."
    exit 1
fi

# 3. テスト成功時のみコンテナを再構築・起動
echo "🏗️ Tests Passed! Deploying..."
docker compose up -d --build

echo "✅ Deployment Successful: $(date)"
