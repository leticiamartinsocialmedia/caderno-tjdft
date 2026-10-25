import type { ReactNode } from "react";
import { AlertTriangle, RotateCw, type LucideIcon } from "lucide-react";
import { Botao } from "./Botao";

export function EstadoVazio({
  icone: Icone,
  titulo,
  texto,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  texto?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-borda px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hover text-texto">
        <Icone size={20} />
      </span>
      <p className="mt-4 text-[15px] font-bold">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-[13px] text-texto-2">{texto}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function EstadoErro({ texto = "Não deu para carregar.", tentarDeNovo }: { texto?: string; tentarDeNovo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-borda px-6 py-12 text-center" role="alert">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-erro-suave text-erro">
        <AlertTriangle size={20} />
      </span>
      <p className="mt-4 text-[15px] font-bold">{texto}</p>
      <p className="mt-1 text-[13px] text-texto-2">Confira sua internet e tente de novo.</p>
      <Botao className="mt-5" onClick={tentarDeNovo} icone={<RotateCw size={15} />}>
        Tentar de novo
      </Botao>
    </div>
  );
}

export function Esqueleto({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function EsqueletoLista({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Carregando" role="status">
      {Array.from({ length: linhas }, (_, i) => (
        <Esqueleto key={i} className="h-12" />
      ))}
    </div>
  );
}

export function EsqueletoCards({ quantidade = 8 }: { quantidade?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Carregando" role="status">
      {Array.from({ length: quantidade }, (_, i) => (
        <Esqueleto key={i} className="h-[76px]" />
      ))}
    </div>
  );
}
