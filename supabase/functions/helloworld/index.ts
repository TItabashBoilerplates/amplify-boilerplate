import { createClient } from "@supabase/supabase-js";
// Drizzle型の使用例
import type { InferSelectModel } from "drizzle-orm";
import type { users } from "../shared/drizzle/index.ts";
import { createFunctionLogger } from "../shared/logger/index.ts";
import type { Database } from "../shared/types/supabase/schema.ts";

const logger = createFunctionLogger("helloworld");

// Drizzle型を推論
type User = InferSelectModel<typeof users>;

logger.info("Hello from Deno Functions!");

const supabaseClient = createClient<Database>(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
);

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      const query = await supabaseClient.from("users").select("*").limit(1);

      logger.debug("Query result", { data: query.data });
      const generalUser = query.data?.[0];

      // Drizzle型を使用して型安全にデータを扱う
      const typedUser: User | undefined = generalUser as User | undefined;

      return new Response(
        JSON.stringify({
          message: `Hello ${typedUser?.displayName ?? "World"}!`,
          user: typedUser
            ? {
              id: typedUser.id,
              displayName: typedUser.displayName,
              accountName: typedUser.accountName,
            }
            : null,
          info: "This response uses Drizzle types for type safety!",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    if (req.method === "POST") {
      const body = await req.json();

      return new Response(
        JSON.stringify({
          message: `Hello ${body.name ?? "World"}!`,
          receivedData: body,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
