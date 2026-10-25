import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServidor();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const email = typeof claims.email === "string" ? claims.email : "";
  const meta = (claims.user_metadata ?? {}) as { nome?: string };
  const { data: cfg } = await sb.from("configuracoes").select("nome").maybeSingle();
  const nome = cfg?.nome || meta.nome || email.split("@")[0];

  return (
    <AppShell usuario={{ id: claims.sub, email, nome }}>
      {children}
    </AppShell>
  );
}
