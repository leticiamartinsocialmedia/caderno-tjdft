import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CONFIGURADO, SUPABASE_KEY, SUPABASE_URL } from "./env";

const ROTAS_PUBLICAS = ["/login", "/auth", "/redefinir-senha", "/configurar"];

export async function atualizarSessao(request: NextRequest) {
  // Sem as chaves do Supabase o app não funciona: mostra a página que explica o que falta.
  if (!SUPABASE_CONFIGURADO) {
    if (request.nextUrl.pathname === "/configurar") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/configurar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([chave, valor]) => response.headers.set(chave, valor));
      },
    },
  });

  // Não colocar código entre createServerClient e getClaims: é aqui que a sessão é renovada.
  let logada = false;
  try {
    const { data } = await supabase.auth.getClaims();
    logada = Boolean(data?.claims);
  } catch {
    // Supabase fora do ar ou chave errada: segue como deslogada, e a tela de login mostra o erro.
  }
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));

  if (!logada && !publica && !caminho.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (logada && caminho === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }

  return response;
}
