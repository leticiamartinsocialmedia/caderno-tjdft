"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, LayoutGrid, List, type LucideIcon } from "lucide-react";

export function CabecalhoPagina({
  titulo,
  voltarPara,
  aoVoltar,
  acoes,
  subtitulo,
  acoesNaLinha = false,
}: {
  titulo: string;
  /** Mantém as ações ao lado do título também no celular (para um botão de ícone só). */
  acoesNaLinha?: boolean;
  voltarPara?: string;
  aoVoltar?: () => void;
  acoes?: ReactNode;
  subtitulo?: ReactNode;
}) {
  const estiloVoltar = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-texto hover:bg-hover";
  return (
    <div className={`flex gap-4 ${acoesNaLinha ? "flex-row items-start justify-between" : "flex-col sm:flex-row sm:items-center sm:justify-between"}`}>
      <div className="flex min-w-0 items-center gap-2">
        {voltarPara ? (
          <Link href={voltarPara} className={estiloVoltar} aria-label="Voltar">
            <ArrowLeft size={19} />
          </Link>
        ) : aoVoltar ? (
          <button type="button" onClick={aoVoltar} className={estiloVoltar} aria-label="Voltar">
            <ArrowLeft size={19} />
          </button>
        ) : null}
        <div className="min-w-0">
          <h1 className="line-clamp-2 text-[22px] leading-tight font-extrabold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 text-[13px] text-texto-2">{subtitulo}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export type Aba<T extends string> = { id: T; rotulo: string; icone?: LucideIcon; contagem?: number };

export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
  direita,
}: {
  abas: Aba<T>[];
  ativa: T;
  aoTrocar: (id: T) => void;
  direita?: ReactNode;
}) {
  return (
    <div className="mt-5 flex items-end justify-between gap-4 border-b border-borda">
      <div className="-mb-px flex min-w-0 gap-5 overflow-x-auto" role="tablist">
        {abas.map((a) => {
          const Icone = a.icone;
          const ehAtiva = a.id === ativa;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={ehAtiva}
              onClick={() => aoTrocar(a.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 pt-1 pb-2.5 text-[13.5px] font-bold transition-colors ${
                ehAtiva ? "border-rosa text-rosa-texto" : "border-transparent text-texto-2 hover:text-texto"
              }`}
            >
              {Icone && <Icone size={16} />}
              {a.rotulo}
              {a.contagem !== undefined && (
                <span className={`tabular rounded-full px-1.5 text-[11px] leading-[18px] ${ehAtiva ? "bg-rosa-suave" : "bg-hover"}`}>
                  {a.contagem}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {direita && <div className="mb-2 shrink-0">{direita}</div>}
    </div>
  );
}

export type Visualizacao = "lista" | "cards";

export function SeletorVisualizacao({ valor, aoTrocar }: { valor: Visualizacao; aoTrocar: (v: Visualizacao) => void }) {
  const op = (v: Visualizacao, Icone: LucideIcon, rotulo: string) => (
    <button
      type="button"
      onClick={() => aoTrocar(v)}
      aria-pressed={valor === v}
      aria-label={rotulo}
      title={rotulo}
      className={`inline-flex h-7 w-8 items-center justify-center rounded ${valor === v ? "bg-superficie text-texto shadow-sm" : "text-texto-2 hover:text-texto"}`}
    >
      <Icone size={15} />
    </button>
  );
  return (
    <div className="hidden rounded-md border border-borda bg-hover p-0.5 sm:flex">
      {op("lista", List, "Ver em lista")}
      {op("cards", LayoutGrid, "Ver em cards")}
    </div>
  );
}
