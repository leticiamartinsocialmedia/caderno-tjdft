import type { ReactNode } from "react";
import { CheckCircle2, Flame } from "lucide-react";

/** Pill de status: neutro (outline), andamento (com %), concluído (check verde). */
export function Pill({
  tipo = "neutro",
  children,
  percentual,
}: {
  tipo?: "neutro" | "andamento" | "concluido" | "verde" | "amarelo" | "vermelho";
  children: ReactNode;
  percentual?: number;
}) {
  if (tipo === "concluido") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold whitespace-nowrap text-texto">
        <CheckCircle2 size={16} className="text-sucesso" />
        {children}
      </span>
    );
  }
  const estilos = {
    neutro: "border border-borda text-texto-2",
    andamento: "bg-hover text-texto border border-borda",
    verde: "bg-sucesso-suave text-sucesso",
    amarelo: "bg-alerta-suave text-alerta",
    vermelho: "bg-erro-suave text-erro",
  }[tipo];
  return (
    <span className={`tabular inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${estilos}`}>
      {children}
      {percentual !== undefined && <span className="font-extrabold">{Math.round(percentual)}%</span>}
    </span>
  );
}

export function Badge({ cor, children }: { cor: "rosa" | "verde" | "amarelo"; children: ReactNode }) {
  const estilos = {
    rosa: "bg-rosa text-white",
    verde: "bg-sucesso-suave text-sucesso",
    amarelo: "bg-alerta-suave text-alerta",
  }[cor];
  return <span className={`tabular inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-bold whitespace-nowrap ${estilos}`}>{children}</span>;
}

export function BadgeCaiMuito() {
  return (
    <Badge cor="amarelo">
      <Flame size={11} /> Cai muito
    </Badge>
  );
}
