"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NAVEGACAO, VERSAO_APP } from "./navegacao";

export function Sidebar({
  recolhida,
  gavetaAberta,
  fecharGaveta,
  revisoesHoje,
}: {
  recolhida: boolean;
  gavetaAberta: boolean;
  fecharGaveta: () => void;
  revisoesHoje: number;
}) {
  const caminho = usePathname();
  // Na gaveta do celular a sidebar aparece sempre inteira.
  const compacta = recolhida && !gavetaAberta;

  return (
    <>
      <div
        className={`fixed inset-0 z-[35] bg-black/50 transition-opacity lg:hidden ${gavetaAberta ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={fecharGaveta}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-white transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          gavetaAberta ? "translate-x-0" : "-translate-x-full"
        } ${compacta ? "w-[68px]" : "w-[240px]"}`}
        aria-label="Menu principal"
      >
        <div className={`flex h-16 items-center ${compacta ? "justify-center" : "justify-between px-5"}`}>
          <Link href="/painel" onClick={fecharGaveta} aria-label="Caderno TJDFT, ir para o painel">
            <Logo claro compacto={compacta} />
          </Link>
          <button
            type="button"
            onClick={fecharGaveta}
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-0.5">
            {NAVEGACAO.map((item) => {
              const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
              const contagem = item.contador === "revisoes" ? revisoesHoje : 0;
              const Icone = item.icone;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={fecharGaveta}
                    title={compacta ? item.rotulo : undefined}
                    aria-current={ativo ? "page" : undefined}
                    className={`relative flex h-9 items-center gap-3 rounded-md text-[13.5px] font-semibold transition-colors ${
                      compacta ? "justify-center px-0" : "px-3"
                    } ${ativo ? "bg-sidebar-ativo text-white" : "text-white/80 hover:bg-white/5 hover:text-white"}`}
                  >
                    <Icone size={18} strokeWidth={ativo ? 2.3 : 2} className="shrink-0" />
                    {!compacta && <span className="flex-1 truncate">{item.rotulo}</span>}
                    {contagem > 0 &&
                      (compacta ? (
                        <span className="absolute top-1.5 right-2.5 h-2 w-2 rounded-full bg-rosa" aria-label={`${contagem} para hoje`} />
                      ) : (
                        <span className="tabular min-w-5 rounded-full bg-rosa px-1.5 text-center text-[11px] leading-5 font-bold text-white">
                          {contagem > 99 ? "99+" : contagem}
                        </span>
                      ))}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3">
          {compacta ? (
            <Link href="/metodos" className="flex h-9 items-center justify-center rounded-md text-white/70 hover:bg-white/5 hover:text-white" title="Ajuda">
              <LifeBuoy size={18} />
            </Link>
          ) : (
            <div className="rounded-lg border border-white/15 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-bold">
                <LifeBuoy size={15} className="text-rosa" /> Ajuda
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Dúvida sobre como estudar? Veja os métodos explicados.
              </p>
              <Link href="/metodos" onClick={fecharGaveta} className="mt-2 inline-block text-xs font-bold text-white underline underline-offset-2">
                Abrir Métodos
              </Link>
              <p className="mt-3 text-[11px] text-white/40">Versão {VERSAO_APP}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
