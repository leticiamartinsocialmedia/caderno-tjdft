import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

// Links de e-mail (confirmar conta, recuperar senha) voltam para cá com um código.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const proximo = searchParams.get("next") ?? "/painel";
  const destino = proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/painel";

  if (codigo) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/login?erro=link`);
}
