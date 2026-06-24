#!/usr/bin/env bash
set -euo pipefail

ENV="${ENV:-}"

if [ "$ENV" = "local" ] || [ -z "$ENV" ]; then
    echo "⚠️  Skipping for local environment"
    exit 0
fi

echo "🪣 Syncing Storage Buckets..."
supabase seed buckets --linked
