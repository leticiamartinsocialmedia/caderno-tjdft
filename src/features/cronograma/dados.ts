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

export type ResultadoImportacao = { novas: number; concluidas: number; iguais: number; substituidas: number };

type Antiga = Pick<ItemCronograma, "id" | "data" | "disciplina" | "aula" | "concluido" | "concluido_em" | "link" | "topico_id">;

/**
 * Junta o que veio do Gran ao que já está no app: aulas novas entram; as que o Gran marca como
 * concluídas são marcadas aqui também. Nada que você concluiu no app volta a ficar pendente.
 *
 * Com `substituir`, as aulas que vieram do Gran antes são trocadas pelas novas (corrige datas erradas).
 * Cada aula nova herda, da antiga com a mesma disciplina e o mesmo nome, o "concluído", o link e o tópico.
 */
export async function importarAulas(
  lidas: AulaLida[],
  materias: { id: string; nome: string }[],
  substituir = false,
): Promise<ResultadoImportacao> {
  if (!lidas.length) return { novas: 0, concluidas: 0, iguais: 0, substituidas: 0 };
  const sb = supabase();
  const inicio = new Date().toISOString();
  let herdado = new Map<AulaLida, Antiga>();
  let antigas: Antiga[] = [];
  if (substituir) {
    const todas = await buscarTodos<Antiga>((de, ate) =>
      sb.from("cronograma").select("id, data, disciplina, aula, concluido, concluido_em, link, topico_id").eq("origem", "gran").order("data").range(de, ate),
    );
    // Pareia na ordem das datas: a 1ª "Penal | 2 - X" antiga com a 1ª nova, e assim por diante.
    const porNome = new Map<string, Antiga[]>();
    for (const v of [...todas].sort((x, y) => x.data.localeCompare(y.data))) {
      const k = `${normalizar(v.disciplina)}|${normalizar(v.aula)}`;
      porNome.set(k, [...(porNome.get(k) ?? []), v]);
    }
    herdado = new Map();
    for (const a of [...lidas].sort((x, y) => x.data.localeCompare(y.data))) {
      const v = porNome.get(`${normalizar(a.disciplina)}|${normalizar(a.aula)}`)?.shift();
      if (v) herdado.set(a, v);
    }
    // Sai só o que a colagem nova cobre: as aulas que reaparecem (mesmo com data errada) e as que estão
    // no período colado. Colar só novembro não apaga outubro.
    const pareadas = new Set([...herdado.values()].map((v) => v.id));
    const datas = lidas.map((a) => a.data).sort();
    antigas = todas.filter((v) => pareadas.has(v.id) || (v.data >= datas[0] && v.data <= datas.at(-1)!));
    for (let i = 0; i < antigas.length; i += 200) {
      const { error } = await sb.from("cronograma").delete().in("id", antigas.slice(i, i + 200).map((v) => v.id));
      if (error) throw error;
    }
  }

  try {
    const r = await juntar(lidas, materias, herdado);
    return { ...r, substituidas: antigas.length };
  } catch (e) {
    // Deu errado no meio: devolve as aulas antigas para não perder nada.
    if (antigas.length) {
      const ids = new Set(antigas.map((v) => v.id));
      const { data: entraram } = await sb.from("cronograma").select("id").eq("origem", "gran").gte("created_at", inicio);
      const sobrando = (entraram ?? []).map((x) => x.id as string).filter((id) => !ids.has(id));
      if (sobrando.length) await sb.from("cronograma").delete().in("id", sobrando);
      await sb.from("cronograma").upsert(antigas.map((v) => ({ ...v, origem: "gran" })), { onConflict: "id" });
    }
    throw e;
  }
}

async function juntar(lidas: AulaLida[], materias: { id: string; nome: string }[], herdado: Map<AulaLida, Antiga>) {
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
      novas.slice(i, i + 300).map((a) => {
        const v = herdado.get(a);
        const concluido = a.concluido || Boolean(v?.concluido);
        return {
          ...a,
          concluido,
          concluido_em: concluido ? (v?.concluido_em ?? agora) : null,
          link: v?.link ?? null,
          topico_id: v?.topico_id ?? null,
          materia_id: materiaDaDisciplina(a.disciplina, materias)?.id ?? null,
          origem: "gran",
        };
      }),
    );
    if (e) throw e;
  }
  if (paraConcluir.length) {
    const { error: e } = await sb.from("cronograma").update({ concluido: true, concluido_em: agora }).in("id", paraConcluir.map((p) => p.id));
    if (e) throw e;
  }
  return { novas: novas.length, concluidas: paraConcluir.length, iguais: lidas.length - novas.length - paraConcluir.length };
}
