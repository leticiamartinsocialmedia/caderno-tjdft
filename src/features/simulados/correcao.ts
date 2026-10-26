// Correção dos simulados, com a regra de cada banca.

import type { RespostaQuestao, SimuladoQuestao } from "@/lib/tipos";

export type Situacao = "certa" | "errada" | "branco" | "anulada";

export type Placar = { total: number; certas: number; erradas: number; brancos: number; anuladas: number; nota: number; pct: number | null };

/** Anulada: a banca dá o ponto a todos, então conta como certa na nota, mas aparece separada. */
export function situacaoDa(q: Pick<SimuladoQuestao, "gabarito" | "anulada">, resposta: RespostaQuestao | null | undefined): Situacao {
  if (q.anulada) return "anulada";
  if (!resposta) return "branco";
  return resposta === q.gabarito ? "certa" : "errada";
}

/**
 * FGV (múltipla escolha): nota = acertos.
 * Cebraspe (certo/errado com desconto): nota = acertos − erros; em branco vale zero.
 */
export function placar(itens: { situacao: Situacao }[], erradaDesconta: boolean): Placar {
  const c = { certas: 0, erradas: 0, brancos: 0, anuladas: 0 };
  for (const i of itens) {
    if (i.situacao === "certa") c.certas++;
    else if (i.situacao === "errada") c.erradas++;
    else if (i.situacao === "branco") c.brancos++;
    else c.anuladas++;
  }
  const pontos = c.certas + c.anuladas;
  const nota = erradaDesconta ? pontos - c.erradas : pontos;
  const total = itens.length;
  return { total, ...c, nota, pct: total ? (nota / total) * 100 : null };
}

/** Placar por grupo (bloco da prova, matéria ou assunto), na ordem em que o grupo aparece. */
export function placarPor<T extends { situacao: Situacao }>(itens: T[], chave: (i: T) => string, erradaDesconta: boolean) {
  const grupos = new Map<string, T[]>();
  for (const i of itens) grupos.set(chave(i), [...(grupos.get(chave(i)) ?? []), i]);
  return [...grupos].map(([nome, lista]) => ({ nome, ...placar(lista, erradaDesconta) }));
}

export const ROTULO_RESPOSTA: Record<RespostaQuestao, string> = { A: "A", B: "B", C: "C", D: "D", E: "E", CERTO: "Certo", ERRADO: "Errado" };

/** "1:05:09" ou "12:04" */
export function formatarRelogio(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
