import { inicioDaSemana, somarDias } from "./datas";
import type { MotivoErro } from "./tipos";

type SessaoBase = { data: string; materia_id?: string | null; minutos: number; questoes: number; acertos: number };

export type Totais = { minutos: number; questoes: number; acertos: number; pct: number | null };

/** % de acerto; null quando não há questões (evita mostrar 0% enganoso). */
export function pctAcerto(acertos: number, questoes: number): number | null {
  return questoes > 0 ? (acertos / questoes) * 100 : null;
}

/** Verde a partir de 75%, amarelo de 60% a 74%, vermelho abaixo de 60%. */
export function corAcerto(pct: number | null): "verde" | "amarelo" | "vermelho" | "neutro" {
  if (pct === null) return "neutro";
  const arredondado = Math.round(pct);
  if (arredondado >= 75) return "verde";
  if (arredondado >= 60) return "amarelo";
  return "vermelho";
}

export function somar(sessoes: SessaoBase[]): Totais {
  const minutos = sessoes.reduce((s, x) => s + x.minutos, 0);
  const questoes = sessoes.reduce((s, x) => s + x.questoes, 0);
  const acertos = sessoes.reduce((s, x) => s + x.acertos, 0);
  return { minutos, questoes, acertos, pct: pctAcerto(acertos, questoes) };
}

export function porMateria(sessoes: SessaoBase[]): Map<string | null, Totais> {
  const grupos = new Map<string | null, SessaoBase[]>();
  for (const s of sessoes) grupos.set(s.materia_id ?? null, [...(grupos.get(s.materia_id ?? null) ?? []), s]);
  return new Map([...grupos].map(([id, lista]) => [id, somar(lista)]));
}

/** Os últimos `dias` dias até hoje (inclusive), um item por dia, mesmo sem estudo. */
export function porDia(sessoes: SessaoBase[], hoje: string, dias = 7) {
  const inicio = somarDias(hoje, -(dias - 1));
  return Array.from({ length: dias }, (_, i) => {
    const data = somarDias(inicio, i);
    return { data, ...somar(sessoes.filter((s) => s.data === data)) };
  });
}

/** % de acerto por semana (segunda a domingo), só semanas com questões. */
export function evolucaoSemanal(sessoes: SessaoBase[]) {
  const semanas = new Map<string, SessaoBase[]>();
  for (const s of sessoes) {
    if (s.questoes <= 0) continue;
    const semana = inicioDaSemana(s.data);
    semanas.set(semana, [...(semanas.get(semana) ?? []), s]);
  }
  return [...semanas]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, lista]) => ({ semana, ...somar(lista) }));
}

/** Minutos estudados na semana atual (segunda até hoje). */
export function minutosDaSemana(sessoes: SessaoBase[], hoje: string) {
  const inicio = inicioDaSemana(hoje);
  return somar(sessoes.filter((s) => s.data >= inicio && s.data <= hoje)).minutos;
}

/** "45 min", "2 h", "1 h 25 min" */
export function formatarMinutos(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatarPct(pct: number | null) {
  return pct === null ? "—" : `${Math.round(pct)}%`;
}

/** Motivo de erro mais frequente (empate: o que aparece primeiro na lista de motivos). */
export function motivoMaisComum(erros: { motivo: MotivoErro }[]) {
  const ordem: MotivoErro[] = ["nao_sabia", "confundi", "interpretacao", "pegadinha", "chutei"];
  const contagem = new Map<MotivoErro, number>();
  for (const e of erros) contagem.set(e.motivo, (contagem.get(e.motivo) ?? 0) + 1);
  let melhor: { motivo: MotivoErro; quantidade: number } | null = null;
  for (const motivo of ordem) {
    const q = contagem.get(motivo) ?? 0;
    if (q > 0 && (!melhor || q > melhor.quantidade)) melhor = { motivo, quantidade: q };
  }
  return melhor;
}
