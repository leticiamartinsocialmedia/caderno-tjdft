"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Moon, PanelLeft, Search, Settings, Sun, Timer } from "lucide-react";
import { formatarRelogio, useCronometroEstudo } from "@/lib/cronometro";
import { LogoIcone } from "@/components/Logo";
import { useStatusTempoReal } from "@/lib/tempoReal";
import { useApp } from "./AppContext";

function useFecharAoClicarFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, fechar]);
  return ref;
}

export function Topbar({
  alternarSidebar,
  escuro,
  alternarTema,
  sair,
}: {
  alternarSidebar: () => void;
  escuro: boolean;
  alternarTema: () => void;
  sair: () => void;
}) {
  const { usuario, revisoesHoje, abrirBusca } = useApp();
  const [sinoAberto, setSinoAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const refSino = useFecharAoClicarFora(sinoAberto, () => setSinoAberto(false));
  const refMenu = useFecharAoClicarFora(menuAberto, () => setMenuAberto(false));
  const inicial = (usuario.nome || usuario.email).trim().charAt(0).toUpperCase();
  const cronometro = useCronometroEstudo();
  const aoVivo = useStatusTempoReal();
  const rotuloAoVivo = { ao_vivo: "Ao vivo", conectando: "Conectando", offline: "Sem conexão" }[aoVivo];

  return (
    <header className="sticky top-[env(safe-area-inset-top)] z-20 flex h-16 items-center justify-between gap-3 border-b border-borda bg-fundo px-[max(16px,env(safe-area-inset-right))] lg:px-6">
      <div className="flex items-center gap-1">
        <Link href="/painel" className="flex items-center gap-2 lg:hidden" aria-label="Caderno TJDFT, ir para o painel">
          <LogoIcone className="h-7 w-7" />
          <span className="text-[15px] font-extrabold tracking-tight">Caderno</span>
        </Link>
        <button
          type="button"
          onClick={alternarSidebar}
          className="hidden h-9 w-9 items-center justify-center rounded-md text-texto-2 hover:bg-hover hover:text-texto lg:inline-flex"
          aria-label="Recolher ou abrir o menu lateral"
        >
          <PanelLeft size={19} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <span
          className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-texto-2"
          title={
            aoVivo === "ao_vivo"
              ? "Tempo real ligado: o que você muda aparece na hora em todos os aparelhos."
              : aoVivo === "offline"
                ? "Sem conexão: as mudanças sincronizam quando a internet voltar."
                : "Ligando o tempo real…"
          }
          role="status"
        >
          <span className={`size-2 rounded-full ${aoVivo === "ao_vivo" ? "bg-sucesso" : aoVivo === "offline" ? "bg-erro" : "animate-pulse bg-alerta"}`} aria-hidden />
          <span className="hidden sm:inline">{rotuloAoVivo}</span>
          <span className="sr-only sm:hidden">{rotuloAoVivo}</span>
        </span>
        {cronometro.rodando && (
          <Link
            href="/questoes"
            className="tabular mr-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-rosa-suave px-2.5 text-xs font-bold text-rosa-texto"
            aria-label={`Cronômetro de estudo: ${formatarRelogio(cronometro.ms)}`}
          >
            <Timer size={14} /> {formatarRelogio(cronometro.ms)}
          </Link>
        )}
        <button
          type="button"
          onClick={abrirBusca}
          className="inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-texto-2 hover:bg-hover hover:text-texto"
          aria-label="Buscar (Ctrl+K)"
        >
          <Search size={18} />
          <kbd className="hidden rounded border border-borda px-1.5 text-[11px] font-semibold sm:inline">Ctrl K</kbd>
        </button>

        <div ref={refSino} className="relative">
          <button
            type="button"
            onClick={() => setSinoAberto((v) => !v)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-texto-2 hover:bg-hover hover:text-texto"
            aria-label={revisoesHoje > 0 ? `Notificações: ${revisoesHoje} revisões para hoje` : "Notificações"}
            aria-expanded={sinoAberto}
          >
            <Bell size={18} />
            {revisoesHoje > 0 && <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-rosa ring-2 ring-fundo" />}
          </button>
          {sinoAberto && (
            <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-32px)] rounded-lg border border-borda bg-superficie p-2 shadow-lg">
              <p className="px-2 py-1.5 text-xs font-bold text-texto-2">Notificações</p>
              {revisoesHoje > 0 ? (
                <Link
                  href="/revisoes"
                  onClick={() => setSinoAberto(false)}
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-hover"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rosa" />
                  <span className="text-[13px]">
                    <strong>{revisoesHoje} {revisoesHoje === 1 ? "revisão" : "revisões"} para hoje.</strong>
                    <span className="block text-texto-2">Revisar agora</span>
                  </span>
                </Link>
              ) : (
                <p className="px-2 py-3 text-[13px] text-texto-2">Nada para revisar hoje.</p>
              )}
            </div>
          )}
        </div>

        <div ref={refMenu} className="relative">
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            className="flex h-9 items-center gap-2 rounded-md pr-2 pl-1 hover:bg-hover"
            aria-expanded={menuAberto}
            aria-label="Minha conta"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-xs font-bold text-white dark:bg-white dark:text-[#111114]">
              {inicial}
            </span>
            <span className="hidden max-w-[140px] truncate text-[13px] font-semibold sm:inline">{usuario.nome || usuario.email}</span>
          </button>
          {menuAberto && (
            <div className="absolute right-0 mt-2 w-60 rounded-lg border border-borda bg-superficie p-1.5 shadow-lg">
              <p className="truncate px-2.5 py-2 text-xs text-texto-2">{usuario.email}</p>
              <Link
                href="/configuracoes"
                onClick={() => setMenuAberto(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold hover:bg-hover"
              >
                <Settings size={16} /> Configurações e backup
              </Link>
              <button
                type="button"
                onClick={alternarTema}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold hover:bg-hover"
              >
                {escuro ? <Sun size={16} /> : <Moon size={16} />}
                {escuro ? "Usar tema claro" : "Usar tema escuro"}
              </button>
              <button
                type="button"
                onClick={sair}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-erro hover:bg-hover"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
