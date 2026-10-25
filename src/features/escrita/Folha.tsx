"use client";

import { useLayoutEffect, useRef } from "react";

const LINHA = 32;

/** Área de escrita em folha pautada, com margem vermelha. Cresce com o texto. */
export function Folha({
  id,
  rotulo,
  dica,
  valor,
  aoMudar,
  linhasMinimas = 6,
  destaque,
  numero,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  valor: string;
  aoMudar: (v: string) => void;
  linhasMinimas?: number;
  destaque?: boolean;
  numero?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const linhas = Math.max(linhasMinimas, Math.ceil((el.scrollHeight + 4) / LINHA));
    el.style.height = `${linhas * LINHA}px`;
  }, [valor, linhasMinimas]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline gap-2">
        {numero !== undefined && (
          <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-texto text-xs font-extrabold text-fundo">
            {numero}
          </span>
        )}
        <div className="min-w-0">
          <label htmlFor={id} className="text-[14px] font-extrabold">
            {rotulo}
          </label>
          {dica && <p className="text-[12.5px] text-texto-2">{dica}</p>}
        </div>
      </div>
      <textarea
        ref={ref}
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        spellCheck
        lang="pt-BR"
        className={`folha w-full resize-none overflow-hidden rounded-md border text-texto outline-none transition-colors focus:border-rosa ${
          destaque ? "border-rosa" : "border-borda"
        }`}
      />
    </div>
  );
}
