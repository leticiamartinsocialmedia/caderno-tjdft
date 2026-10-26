"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { somarDias } from "@/lib/datas";
import type { ItemCronograma } from "@/lib/tipos";
import { nomeCurto } from "./gran";
import { situacao, type Situacao } from "./dados";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

const COR: Record<Situacao, string> = {
  concluida: "bg-sucesso",
  atrasada: "bg-erro",
  hoje: "bg-rosa",
  futura: "bg-texto-2/50",
};

/** "2026-10" → "2026-11" (ou -1 para o anterior) */
export function somarMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const abs = a * 12 + (m - 1) + n;
  return `${Math.floor(abs / 12)}-${String((abs % 12) + 1).padStart(2, "0")}`;
}

/** Datas da grade do mês, de domingo a sábado, completando as semanas das pontas. */
export function diasDaGrade(mes: string) {
  const primeiro = `${mes}-01`;
  const ultimo = somarDias(`${somarMes(mes, 1)}-01`, -1);
  const semana = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
  const inicio = somarDias(primeiro, -semana(primeiro));
  const fim = somarDias(ultimo, 6 - semana(ultimo));
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

export function Calendario({
  porDia,
  hoje,
  mes,
  aoMudarMes,
  escolhido,
  aoEscolher,
}: {
  porDia: Map<string, ItemCronograma[]>;
  hoje: string;
  mes: string;
  aoMudarMes: (mes: string) => void;
  escolhido: string | null;
  aoEscolher: (data: string) => void;
}) {
  const dias = diasDaGrade(mes);
  const doMes = [...porDia.entries()].filter(([d]) => d.startsWith(mes)).flatMap(([, a]) => a);
  const feitas = doMes.filter((a) => a.concluido).length;
  const atrasadas = doMes.filter((a) => situacao(a, hoje) === "atrasada").length;
  const titulo = nomeMes.format(new Date(`${mes}-15T12:00:00Z`));

  return (
    <section aria-label={`Calendário de ${titulo}`} className="rounded-lg border border-borda-card bg-superficie">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-borda px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => aoMudarMes(somarMes(mes, -1))}
            className="flex size-9 items-center justify-center rounded-md hover:bg-hover"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="min-w-[150px] text-center text-[15px] font-extrabold first-letter:uppercase">{titulo}</h2>
          <button
            type="button"
            onClick={() => aoMudarMes(somarMes(mes, 1))}
            className="flex size-9 items-center justify-center rounded-md hover:bg-hover"
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {mes !== hoje.slice(0, 7) && (
          <button
            type="button"
            onClick={() => aoMudarMes(hoje.slice(0, 7))}
            className="h-8 rounded-md border border-borda px-2.5 text-xs font-bold hover:bg-hover"
          >
            Hoje
          </button>
        )}
        <p className="tabular ml-auto text-xs text-texto-2">
          {doMes.length} aulas · {feitas} concluídas{atrasadas > 0 && <span className="font-bold text-erro"> · {atrasadas} atrasadas</span>}
        </p>
      </div>

      <div className="grid grid-cols-7 border-b border-borda text-center text-[11px] font-bold tracking-wide text-texto-2 uppercase">
        {SEMANA.map((d) => (
          <span key={d} className="py-1.5">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const foraDoMes = !d.startsWith(mes);
          const aulas = foraDoMes ? [] : (porDia.get(d) ?? []);
          const ehHoje = d === hoje;
          const ativo = d === escolhido;
          const resto = aulas.length - 3;
          return (
            <button
              key={d}
              type="button"
              disabled={foraDoMes}
              onClick={() => aoEscolher(d)}
              aria-pressed={ativo}
              aria-label={`${Number(d.slice(8))}: ${aulas.length ? `${aulas.length} aulas` : "sem aulas"}`}
              className={`flex min-h-[64px] min-w-0 flex-col gap-1 border-borda p-1 text-left sm:min-h-[132px] sm:p-1.5 ${i % 7 ? "border-l" : ""} ${
                i >= 7 ? "border-t" : ""
              } ${foraDoMes ? "bg-hover/40" : "hover:bg-hover/60"} ${ativo ? "relative z-[1] outline-2 -outline-offset-2 outline-rosa" : ""}`}
            >
              <span
                className={`tabular mx-auto flex size-6 items-center justify-center rounded-full text-[12.5px] font-bold sm:mx-0 ${
                  ehHoje ? "bg-rosa text-white" : foraDoMes ? "text-texto-2/50" : ""
                }`}
              >
                {Number(d.slice(8))}
              </span>

              {/* Celular: bolinhas coloridas por aula */}
              {aulas.length > 0 && (
                <span className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden>
                  {aulas.slice(0, 6).map((a) => (
                    <span key={a.id} className={`size-1.5 rounded-full ${COR[situacao(a, hoje)]}`} />
                  ))}
                </span>
              )}

              {/* Computador: as 3 primeiras aulas, como no Gran */}
              <span className="hidden min-w-0 flex-col gap-1 sm:flex">
                {aulas.slice(0, 3).map((a) => {
                  const s = situacao(a, hoje);
                  return (
                    <span
                      key={a.id}
                      className={`flex min-w-0 items-start gap-1.5 rounded bg-hover px-1.5 py-1 text-[11.5px] leading-tight ${a.concluido ? "text-texto-2" : ""}`}
                    >
                      <span className={`mt-[3px] size-1.5 shrink-0 rounded-full ${COR[s]}`} />
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{a.disciplina === "Revisão" ? "Revisão" : nomeCurto(a.disciplina)}</span>
                        {a.aula !== a.disciplina && <span className={`block truncate ${a.concluido ? "line-through" : ""}`}>{a.aula}</span>}
                      </span>
                    </span>
                  );
                })}
                {resto > 0 && <span className="px-1 text-[11.5px] font-bold text-texto-2 underline underline-offset-2">Mais {resto}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-borda px-3 py-2 text-[11.5px] text-texto-2">
        {(
          [
            ["concluida", "Concluída"],
            ["atrasada", "Atrasada"],
            ["hoje", "Hoje"],
            ["futura", "A fazer"],
          ] as const
        ).map(([s, r]) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${COR[s]}`} /> {r}
          </span>
        ))}
      </div>
    </section>
  );
}
