#!/usr/bin/env bash

# Hook InputからJSONをパース
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# ファイルパスが空の場合は終了
if [ -z "$file_path" ]; then
  exit 0
fi

# プロジェクトルート取得
project_root=""
if [[ "$file_path" =~ /frontend/ ]]; then
  project_root="${file_path%/frontend/*}"
elif [[ "$file_path" =~ /backend-py/ ]]; then
  project_root="${file_path%/backend-py/*}"
elif [[ "$file_path" =~ /supabase/ ]]; then
  project_root="${file_path%/supabase/*}"
elif [[ "$file_path" =~ /drizzle/ ]]; then
  project_root="${file_path%/drizzle/*}"
fi

# プロジェクトルートが取得できない場合は終了
if [ -z "$project_root" ]; then
  exit 0
fi

cd "$project_root" || exit 0

# devenv scripts は devenv shell (direnv) 経由で PATH に入っている。
# direnv 未活性のセッション (CI 等) では devenv shell -- 経由でフォールバックする。
run() {
  if command -v "$1" >/dev/null 2>&1; then
    "$@"
  else
    devenv shell -- "$@"
  fi
}

# 結果を収集
results=""
has_error=0

# Frontend (TypeScript/JavaScript/JSON)
if [[ "$file_path" =~ /frontend/.*\.(ts|tsx|js|jsx|json)$ ]]; then
  echo "🔍 Running quality checks for frontend..." >&2

  if ! run lint-frontend 2>&1; then
    has_error=1
    results+="❌ lint-frontend failed\n"
  else
    results+="✅ lint-frontend passed\n"
  fi

  if ! run format-frontend 2>&1; then
    has_error=1
    results+="❌ format-frontend failed\n"
  else
    results+="✅ format-frontend passed\n"
  fi

  if ! run type-check-frontend 2>&1; then
    has_error=1
    results+="❌ type-check-frontend failed\n"
  else
    results+="✅ type-check-frontend passed\n"
  fi
fi

# Backend Python
if [[ "$file_path" =~ /backend-py/(apps|packages)/[^/]+/src/.*\.py$ ]]; then
  echo "🔍 Running quality checks for backend-py..." >&2

  if ! run lint-backend-py 2>&1; then
    has_error=1
    results+="❌ lint-backend-py failed\n"
  else
    results+="✅ lint-backend-py passed\n"
  fi

  if ! run format-backend-py 2>&1; then
    has_error=1
    results+="❌ format-backend-py failed\n"
  else
    results+="✅ format-backend-py passed\n"
  fi

  if ! run type-check-backend-py 2>&1; then
    has_error=1
    results+="❌ type-check-backend-py failed\n"
  else
    results+="✅ type-check-backend-py passed\n"
  fi
fi

# Edge Functions (Deno TypeScript)
if [[ "$file_path" =~ /supabase/functions/.*\.ts$ ]]; then
  echo "🔍 Running quality checks for edge functions..." >&2

  if ! run lint-functions 2>&1; then
    has_error=1
    results+="❌ lint-functions failed\n"
  else
    results+="✅ lint-functions passed\n"
  fi

  if ! run format-functions 2>&1; then
    has_error=1
    results+="❌ format-functions failed\n"
  else
    results+="✅ format-functions passed\n"
  fi

  if ! run check-functions 2>&1; then
    has_error=1
    results+="❌ check-functions failed\n"
  else
    results+="✅ check-functions passed\n"
  fi
fi

# Drizzle (TypeScript)
if [[ "$file_path" =~ /drizzle/.*\.ts$ ]]; then
  echo "🔍 Running quality checks for drizzle..." >&2

  if ! run lint-drizzle 2>&1; then
    has_error=1
    results+="❌ lint-drizzle failed\n"
  else
    results+="✅ lint-drizzle passed\n"
  fi

  if ! run format-drizzle 2>&1; then
    has_error=1
    results+="❌ format-drizzle failed\n"
  else
    results+="✅ format-drizzle passed\n"
  fi
fi

# 結果を表示
if [ -n "$results" ]; then
  if [ "$has_error" -eq 1 ]; then
    # エラーがある場合のみ Claude に表示
    echo -e "\n📋 Quality Check Results:\n$results" >&2
    exit 2
  fi
  # 成功時は transcript mode でのみ表示
  echo -e "\n📋 Quality Check Results:\n$results"
fi

exit 0
