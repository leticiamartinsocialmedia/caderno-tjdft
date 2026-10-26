import { PlayCircle, FileText, ListChecks, RotateCcw, CircleDot, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { diasEntre } from "@/lib/datas";
import type { ItemCronograma, TipoAula } from "@/lib/tipos";
import { materiaDaDisciplina, normalizar, type AulaLida } from "./gran";

export const TIPO_AULA: Record<TipoAula, { rotulo: string; icone: LucideIcon }> = {
  videoaula: { rotulo: "Videoaula", icone: PlayCircle },
  pdf: { rotulo: "PDF", icone: FileText },
  questoes: { rotulo: "Questões", icone: ListChecks },
  revisao: { rotulo: "Revisão", icone: RotateCcw },
  outro: { rotulo: "Outro", icone: CircleDot },
};

export type Situacao = "concluida" | "atrasada" | "hoje" | "futura";

export function situacao(item: Pick<ItemCronograma, "data" | "concluido">, hoje: string): Situacao {
  if (item.concluido) return "concluida";
  if (item.data < hoje) return "atrasada";
  return item.data === hoje ? "hoje" : "futura";
}

/** "Hoje", "Amanhã", "Ontem", "Atrasada há 5 dias", "Em 3 dias". */
export function rotuloDia(data: string, hoje: string) {
  const d = diasEntre(hoje, data);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "Ontem";
  return d < 0 ? `Há ${-d} dias` : `Em ${d} dias`;
}

const nomeDiaLongo = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** "terça-feira, 13/10" */
export function tituloDia(data: string) {
  return nomeDiaLongo.format(new Date(`${data}T12:00:00Z`));
}

export function chave(a: { data: string; disciplina: string; aula: string }) {
  return `${a.data}|${normalizar(a.disciplina)}|${normalizar(a.aula)}`;
}

export type ResultadoImportacao = { novas: number; concluidas: number; iguais: number };

/**
 * Junta o que veio do Gran ao que já está no app: aulas novas entram; as que o Gran marca como
 * concluídas são marcadas aqui também. Nada que você concluiu no app volta a ficar pendente.
 */
export async function importarAulas(lidas: AulaLida[], materias: { id: string; nome: string }[]): Promise<ResultadoImportacao> {
  if (!lidas.length) return { novas: 0, concluidas: 0, iguais: 0 };
  const sb = supabase();
  const datas = lidas.map((a) => a.data).sort();
  const { data, error } = await sb
    .from("cronograma")
    .select("id, data, disciplina, aula, concluido")
    .gte("data", datas[0])
    .lte("data", datas.at(-1)!);
  if (error) throw error;
  const existentes = new Map((data as Pick<ItemCronograma, "id" | "data" | "disciplina" | "aula" | "concluido">[]).map((e) => [chave(e), e]));

  const novas = lidas.filter((a) => !existentes.has(chave(a)));
  const paraConcluir = lidas.map((a) => existentes.get(chave(a))).filter((e, i) => e && !e.concluido && lidas[i].concluido) as { id: string }[];
  const agora = new Date().toISOString();

  for (let i = 0; i < novas.length; i += 300) {
    const { error: e } = await sb.from("cronograma").insert(
      novas.slice(i, i + 300).map((a) => ({
        ...a,
        materia_id: materiaDaDisciplina(a.disciplina, materias)?.id ?? null,
        concluido_em: a.concluido ? agora : null,
        origem: "gran",
      })),
    );
    if (e) throw e;
  }
  if (paraConcluir.length) {
    const { error: e } = await sb.from("cronograma").update({ concluido: true, concluido_em: agora }).in("id", paraConcluir.map((p) => p.id));
    if (e) throw e;
  }
  return { novas: novas.length, concluidas: paraConcluir.length, iguais: lidas.length - novas.length - paraConcluir.length };
}
