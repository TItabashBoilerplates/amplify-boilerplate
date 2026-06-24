-- =============================================
-- Post-Migration SQL: Functions & Triggers
-- =============================================
-- このファイルはマイグレーション適用後に実行されます。
-- テーブルに依存する関数・トリガーを定義します。
-- =============================================

-- CUID風のユニークIDを生成する関数
CREATE OR REPLACE FUNCTION generate_cuid()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  random_part TEXT;
BEGIN
  -- タイムスタンプとランダム値を組み合わせた16文字の英数字
  random_part := lower(substring(
    encode(sha256((random()::text || clock_timestamp()::text)::bytea), 'hex'),
    1, 16
  ));
  RETURN 'user_' || random_part;
END;
$$;

-- Auth Hook関数: 新規ユーザー作成時の処理
-- Atlas HCL functions.hcl から変換
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_name_value TEXT;
BEGIN
  -- account_nameを取得、存在しない場合はCUIDを生成
  account_name_value := COALESCE(
    NEW.raw_user_meta_data ->> 'account_name',
    generate_cuid()
  );

  -- 新規ユーザーのIDをusersテーブルに挿入
  INSERT INTO public.users(id, account_name)
  VALUES (NEW.id, account_name_value);

  RETURN NEW;
END;
$$;

-- Auth Hookトリガー
-- auth.usersテーブルに新規レコードが挿入された後にhandle_new_user関数を実行
DROP TRIGGER IF EXISTS auth_hook ON auth.users;
CREATE TRIGGER auth_hook
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
