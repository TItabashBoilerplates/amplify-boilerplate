CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"account_name" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_account_name_unique" UNIQUE("account_name")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "edit_policy_users" ON "users" AS PERMISSIVE FOR ALL TO "authenticated" USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);--> statement-breakpoint
CREATE POLICY "insert_policy_users" ON "users" AS PERMISSIVE FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "select_own_user" ON "users" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);