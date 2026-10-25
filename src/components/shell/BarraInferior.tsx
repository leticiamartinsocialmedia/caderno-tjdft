"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, LayoutDashboard, Menu, PenLine, RotateCcw, type LucideIcon } from "lucide-react";

const ATALHOS: { href: string; rotulo: string; icone: LucideIcon }[] = [
  { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/edital", rotulo: "Edital", icone: FolderOpen },
  { href: "/escrita", rotulo: "Escrita", icone: PenLine },
  { href: "/revisoes", rotulo: "Revisões", icone: RotateCcw },
];

/** Navegação de polegar no celular. "Mais" abre a gaveta com as outras seções. */
export function BarraInferior({ revisoesHoje, abrirGaveta }: { revisoesHoje: number; abrirGaveta: () => void }) {
  const caminho = usePathname();
  const naGaveta = !ATALHOS.some((a) => caminho === a.href || caminho.startsWith(`${a.href}/`));
  const estilo = (ativo: boolean) =>
    `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
      ativo ? "text-white" : "text-white/60 active:text-white"
    }`;

  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-sidebar pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden"
    >
      <div className="flex h-16">
        {ATALHOS.map(({ href, rotulo, icone: Icone }) => {
          const ativo = caminho === href || caminho.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={estilo(ativo)} aria-current={ativo ? "page" : undefined}>
              <span className="relative">
                <Icone size={22} strokeWidth={ativo ? 2.4 : 2} />
                {href === "/revisoes" && revisoesHoje > 0 && (
                  <span className="tabular absolute -top-1.5 -right-2.5 min-w-[18px] rounded-full bg-rosa px-1 text-center text-[10px] leading-[18px] text-white">
                    {revisoesHoje > 99 ? "99+" : revisoesHoje}
                  </span>
                )}
              </span>
              {rotulo}
              {ativo && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-rosa" />}
            </Link>
          );
        })}
        <button type="button" onClick={abrirGaveta} className={estilo(naGaveta)} aria-label="Mais seções">
          <Menu size={22} strokeWidth={naGaveta ? 2.4 : 2} />
          Mais
          {naGaveta && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-rosa" />}
        </button>
      </div>
    </nav>
  );
}
