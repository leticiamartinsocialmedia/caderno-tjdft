import type { Atividade } from "@/lib/tipos";

export const ATIVIDADES: { id: Atividade; rotulo: string }[] = [
  { id: "questoes_tec", rotulo: "Questões TEC" },
  { id: "videoaula_gran", rotulo: "Videoaula Gran" },
  { id: "pdf_gran", rotulo: "PDF Gran" },
  { id: "lei_seca", rotulo: "Lei seca" },
  { id: "revisao", rotulo: "Revisão" },
  { id: "escrita", rotulo: "Escrita" },
  { id: "simulado", rotulo: "Simulado" },
];

export const ROTULO_ATIVIDADE = Object.fromEntries(ATIVIDADES.map((a) => [a.id, a.rotulo])) as Record<Atividade, string>;

export type ErrosSessao = Partial<Record<"data" | "minutos" | "questoes" | "acertos" | "geral", string>>;

/** Valida os números da sessão. Acertos nunca passam do total de questões. */
export function validarSessao(v: { data: string; minutos: string; questoes: string; acertos: string }): ErrosSessao {
  const e: ErrosSessao = {};
  const inteiro = (s: string) => (s.trim() === "" ? 0 : Number(s));
  const minutos = inteiro(v.minutos);
  const questoes = inteiro(v.questoes);
  const acertos = inteiro(v.acertos);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data)) e.data = "Escolha a data.";
  if (!Number.isInteger(minutos) || minutos < 0) e.minutos = "Use um número inteiro de minutos.";
  else if (minutos > 1440) e.minutos = "Um dia tem no máximo 1.440 minutos.";
  if (!Number.isInteger(questoes) || questoes < 0) e.questoes = "Use um número inteiro.";
  if (!Number.isInteger(acertos) || acertos < 0) e.acertos = "Use um número inteiro.";
  else if (Number.isInteger(questoes) && acertos > questoes) e.acertos = "Os acertos não podem passar do total de questões.";
  if (!e.minutos && !e.questoes && minutos === 0 && questoes === 0) e.geral = "Informe os minutos estudados ou as questões feitas.";
  return e;
}
