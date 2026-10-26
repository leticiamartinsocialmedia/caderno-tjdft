import { PlayCircle, FileText, ListChecks, RotateCcw, CircleDot, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { buscarTodos } from "@/lib/useEditalBasico";
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

export type ResultadoImportacao = { novas: number; concluidas: number; iguais: number; apagadas: number };

/**
 * "juntar": aulas novas entram; as que o Gran marca como concluídas são marcadas aqui também.
 * Nada que você concluiu no app volta a ficar pendente.
 *
 * "limpar": apaga o cronograma inteiro e grava exatamente o que foi colado (datas, ordem e concluído
 * do Gran). Se falhar no meio, devolve o cronograma que existia.
 */
export async function importarAulas(
  lidas: AulaLida[],
  materias: { id: string; nome: string }[],
  modo: "juntar" | "limpar" = "juntar",
): Promise<ResultadoImportacao> {
  if (!lidas.length) return { novas: 0, concluidas: 0, iguais: 0, apagadas: 0 };
  if (modo === "juntar") return { ...(await juntar(lidas, materias)), apagadas: 0 };

  const sb = supabase();
  const antes = await buscarTodos<ItemCronograma & { user_id?: string }>((de, ate) => sb.from("cronograma").select("*").order("data").range(de, ate));
  const apagar = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sb.from("cronograma").delete().in("id", ids.slice(i, i + 200));
      if (error) throw error;
    }
  };
  await apagar(antes.map((v) => v.id));
  try {
    const r = await juntar(lidas, materias);
    return { ...r, apagadas: antes.length };
  } catch (e) {
    const { data: entraram } = await sb.from("cronograma").select("id");
    await apagar((entraram ?? []).map((x) => x.id as string)).catch(() => {});
    for (let i = 0; i < antes.length; i += 300) await sb.from("cronograma").insert(antes.slice(i, i + 300));
    throw e;
  }
}

async function juntar(lidas: AulaLida[], materias: { id: string; nome: string }[]) {
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
        concluido_em: a.concluido ? agora : null,
        materia_id: materiaDaDisciplina(a.disciplina, materias)?.id ?? null,
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
