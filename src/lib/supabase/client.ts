import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

let cliente: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  cliente ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return cliente;
}
