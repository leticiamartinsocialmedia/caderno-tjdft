import { Logo } from "@/components/Logo";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export const metadata = { title: "Falta configurar · Caderno TJDFT" };
export const dynamic = "force-dynamic";

function Item({ nome, ok }: { nome: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-borda px-3 py-2.5">
      <code className="min-w-0 truncate text-[13px] font-semibold">{nome}</code>
      <span className={`shrink-0 text-xs font-bold ${ok ? "text-sucesso" : "text-erro"}`}>{ok ? "Encontrada" : "Faltando"}</span>
    </li>
  );
}

export default function Configurar() {
  const urlOk = /^https:\/\/.+/.test(SUPABASE_URL);
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col gap-8 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">Falta ligar o banco de dados</h1>
        <p className="mt-2 text-sm leading-relaxed text-texto-2">
          O app foi publicado, mas a Vercel não passou as chaves do Supabase para ele. Sem elas não dá para entrar.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        <Item nome="NEXT_PUBLIC_SUPABASE_URL" ok={urlOk} />
        <Item nome="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ok={SUPABASE_KEY.length > 0} />
      </ul>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
        <li>Na Vercel, abra o projeto caderno-tjdft e vá em Settings → Environment Variables.</li>
        <li>Adicione as que estão &quot;Faltando&quot;, marcando Production, Preview e Development.</li>
        <li>Vá em Deployments, clique nos três pontos da publicação mais recente e escolha Redeploy.</li>
      </ol>
      <p className="text-xs text-texto-2">As variáveis só valem para publicações feitas depois de salvas. Por isso o Redeploy.</p>
    </main>
  );
}
