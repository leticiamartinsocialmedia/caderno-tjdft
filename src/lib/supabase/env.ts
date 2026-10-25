// Aceita a URL com ou sem barra e "/rest/v1" no fim (é comum colar assim do painel do Supabase).
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");

// Aceita o nome novo (publishable) e o antigo (anon) da chave pública.
export const SUPABASE_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();

export const SUPABASE_CONFIGURADO = /^https:\/\/.+/.test(SUPABASE_URL) && SUPABASE_KEY.length > 0;
