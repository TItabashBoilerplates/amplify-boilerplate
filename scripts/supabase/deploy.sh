#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV="${ENV:-}"

if [ "$ENV" = "local" ] || [ -z "$ENV" ]; then
    echo "⚠️  deploy-supabase is for remote environments only."
    echo ""
    echo "Usage: devenv tasks run -P staging deploy:supabase"
    echo "       devenv tasks run -P production deploy:supabase"
    exit 0
fi

echo "🚀 Deploying Supabase resources to $ENV..."
echo ""

# Step 1: Link
"$SCRIPT_DIR/link.sh"

# Step 2: Config
"$SCRIPT_DIR/deploy-config.sh"

# Step 3: Buckets
"$SCRIPT_DIR/deploy-buckets.sh"

# Step 4: Functions
"$SCRIPT_DIR/deploy-functions.sh"

# Secrets: Doppler ネイティブ連携（Doppler→Supabase sync）で自動 sync するため、ここでは push しない。
# 連携の設定手順は .claude/skills/doppler/references/cicd.md を参照。
echo ""
echo "ℹ️  Supabase secrets は Doppler ネイティブ連携で sync 済み（このスクリプトでは push しない）"

echo ""
echo "✅ Supabase deployment complete!"
