"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { hojeSP } from "@/lib/datas";
import { limparMarcaSessao, sessaoExpirouAoFecharNavegador } from "@/lib/sessao";
import { ToastProvider } from "@/components/ui/Toast";
import { AppCtx, type Usuario } from "./AppContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BuscaGlobal } from "./BuscaGlobal";

function lerPreferencia(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarPreferencia(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {}
}

export function AppShell({ usuario, children }: { usuario: Usuario; children: ReactNode }) {
  const router = useRouter();
  const [recolhida, setRecolhida] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [escuro, setEscuro] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [revisoesHoje, setRevisoesHoje] = useState(0);

  const sair = useCallback(async () => {
    await supabase().auth.signOut();
    limparMarcaSessao();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const atualizarContadores = useCallback(async () => {
    const { count } = await supabase()
      .from("revisoes")
      .select("id", { count: "exact", head: true })
      .eq("ativa", true)
      .lte("proxima_data", hojeSP());
    setRevisoesHoje(count ?? 0);
  }, []);

  useEffect(() => {
    if (sessaoExpirouAoFecharNavegador()) {
      void sair();
      return;
    }
    // Preferências guardadas só neste navegador.
    /* eslint-disable react-hooks/set-state-in-effect */
    setRecolhida(lerPreferencia("sidebar") === "recolhida");
    setEscuro(document.documentElement.classList.contains("dark"));
    /* eslint-enable react-hooks/set-state-in-effect */

    // Na primeira visita prepara o edital; nas outras a função só confere e sai.
    void supabase()
      .rpc("semear_edital")
      .then(() => atualizarContadores());

    const aoVoltar = () => document.visibilityState === "visible" && atualizarContadores();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [atualizarContadores, sair]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuscaAberta(true);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  function alternarSidebar() {
    setRecolhida((r) => {
      gravarPreferencia("sidebar", r ? "aberta" : "recolhida");
      return !r;
    });
  }

  function alternarTema() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    gravarPreferencia("tema", novo ? "escuro" : "claro");
  }

  return (
    <AppCtx.Provider value={{ usuario, revisoesHoje, atualizarContadores, abrirBusca: () => setBuscaAberta(true) }}>
      <ToastProvider>
        <div className="flex min-h-full">
          <Sidebar
            recolhida={recolhida}
            gavetaAberta={gavetaAberta}
            fecharGaveta={() => setGavetaAberta(false)}
            revisoesHoje={revisoesHoje}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              alternarSidebar={alternarSidebar}
              abrirGaveta={() => setGavetaAberta(true)}
              escuro={escuro}
              alternarTema={alternarTema}
              sair={sair}
            />
            <main className="mx-auto w-full max-w-[1280px] flex-1 px-[max(16px,env(safe-area-inset-right))] py-6 lg:px-8 lg:py-8">
              {children}
            </main>
          </div>
        </div>
        {buscaAberta && <BuscaGlobal fechar={() => setBuscaAberta(false)} />}
      </ToastProvider>
    </AppCtx.Provider>
  );
}
