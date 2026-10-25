"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export type ItemMenu =
  | { rotulo: string; icone?: ReactNode; aoClicar: () => void; perigo?: boolean; marcado?: boolean }
  | "separador";

export function MenuAcoes({
  itens,
  rotulo = "Mais ações",
  className = "",
  gatilho,
}: {
  itens: ItemMenu[];
  rotulo?: string;
  className?: string;
  gatilho?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={ref} className={`relative ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setAberto((a) => !a);
        }}
        aria-label={rotulo}
        title={rotulo}
        aria-expanded={aberto}
        className="inline-flex h-10 min-w-10 sm:h-8 sm:min-w-8 items-center justify-center rounded-md text-texto-2 hover:bg-hover hover:text-texto"
      >
        {gatilho ?? <MoreHorizontal size={18} />}
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-borda bg-superficie p-1 shadow-lg">
          {itens.map((item, i) =>
            item === "separador" ? (
              <div key={i} className="my-1 border-t border-borda" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  setAberto(false);
                  item.aoClicar();
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 sm:py-2 text-left text-[13px] font-semibold hover:bg-hover ${
                  item.perigo ? "text-erro" : "text-texto"
                } ${item.marcado ? "bg-hover" : ""}`}
              >
                {item.icone}
                <span className="flex-1">{item.rotulo}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
