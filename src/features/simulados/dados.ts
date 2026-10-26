import { supabase } from "@/lib/supabase/client";
import { exigir } from "@/lib/useConsulta";
import { buscarTodos } from "@/lib/useEditalBasico";
import type { SimuladoProva, SimuladoQuestao, SimuladoResposta, SimuladoTentativa, SimuladoTexto } from "@/lib/tipos";

/** Antes do SQL 0005 as tabelas não existem: as telas explicam o que fazer em vez de dar erro. */
export function faltaTabela(e: unknown) {
  return ["42P01", "PGRST205"].includes(String((e as { code?: string })?.code));
}

export type QuestaoResumo = Pick<SimuladoQuestao, "id" | "prova_id" | "numero" | "bloco" | "materia" | "assunto" | "gabarito" | "anulada">;

/** Ordem do caderno: prova (mais recente primeiro) e, dentro dela, o número da questão. */
export function ordenarComoNaProva<T extends Pick<SimuladoQuestao, "prova_id" | "numero">>(questoes: T[], provas: SimuladoProva[]) {
  const posicao = new Map(provas.map((p, i) => [p.id, i]));
  return [...questoes].sort((a, b) => (posicao.get(a.prova_id) ?? 99) - (posicao.get(b.prova_id) ?? 99) || a.numero - b.numero);
}

export async function carregarBanco() {
  const sb = supabase();
  try {
    const [provas, questoes, tentativas, respostas] = await Promise.all([
      sb.from("simulado_provas").select("*").order("ordem").order("ano", { ascending: false }),
      buscarTodos<QuestaoResumo>((de, ate) => sb.from("simulado_questoes").select("id, prova_id, numero, bloco, materia, assunto, gabarito, anulada").range(de, ate)),
      sb.from("simulado_tentativas").select("*").order("iniciada_em", { ascending: false }).limit(200),
      buscarTodos<Pick<SimuladoResposta, "tentativa_id" | "questao_id" | "resposta">>((de, ate) =>
        sb.from("simulado_respostas").select("tentativa_id, questao_id, resposta").range(de, ate),
      ),
    ]);
    const listaProvas = exigir(provas) as SimuladoProva[];
    return {
      provas: listaProvas,
      questoes: ordenarComoNaProva(questoes, listaProvas),
      tentativas: exigir(tentativas) as SimuladoTentativa[],
      respostas,
      semTabela: false,
    };
  } catch (e) {
    if (faltaTabela(e)) return { provas: [], questoes: [], tentativas: [], respostas: [], semTabela: true };
    throw e;
  }
}

export async function criarTentativa(t: Pick<SimuladoTentativa, "modo" | "prova_id" | "titulo" | "questao_ids">) {
  const { data, error } = await supabase().from("simulado_tentativas").insert(t).select().single();
  if (error || !data) throw error ?? new Error("sem dados");
  return data as SimuladoTentativa;
}

export async function carregarTentativa(id: string) {
  const sb = supabase();
  const tentativa = exigir(await sb.from("simulado_tentativas").select("*").eq("id", id).maybeSingle()) as SimuladoTentativa | null;
  if (!tentativa) return null;
  const ids = tentativa.questao_ids;
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));
  const questoes = (await Promise.all(lotes.map(async (l) => exigir(await sb.from("simulado_questoes").select("*").in("id", l)) as SimuladoQuestao[]))).flat();
  const porId = new Map(questoes.map((q) => [q.id, q]));
  const ordenadas = ids.map((i) => porId.get(i)).filter((q): q is SimuladoQuestao => Boolean(q));
  const textoIds = [...new Set(ordenadas.map((q) => q.texto_id).filter((t): t is string => Boolean(t)))];
  const [textos, respostas, prova] = await Promise.all([
    textoIds.length ? sb.from("simulado_textos").select("*").in("id", textoIds) : Promise.resolve({ data: [], error: null }),
    sb.from("simulado_respostas").select("*").eq("tentativa_id", id),
    tentativa.prova_id ? sb.from("simulado_provas").select("*").eq("id", tentativa.prova_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  // Treino pode misturar bancas: busca as provas de origem para saber o estilo e a regra de cada questão.
  const provaIds = [...new Set(ordenadas.map((q) => q.prova_id))];
  const provas = exigir(await sb.from("simulado_provas").select("*").in("id", provaIds)) as SimuladoProva[];
  return {
    tentativa,
    prova: exigir(prova) as SimuladoProva | null,
    provas: new Map(provas.map((p) => [p.id, p])),
    questoes: ordenadas,
    textos: new Map((exigir(textos) as SimuladoTexto[]).map((t) => [t.id, t])),
    respostas: new Map((exigir(respostas) as SimuladoResposta[]).map((r) => [r.questao_id, r])),
  };
}

export async function salvarResposta(tentativaId: string, questaoId: string, campos: Partial<Pick<SimuladoResposta, "resposta" | "marcada_para_revisar">>) {
  const { data, error } = await supabase()
    .from("simulado_respostas")
    .upsert({ tentativa_id: tentativaId, questao_id: questaoId, ...campos }, { onConflict: "tentativa_id,questao_id" })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("sem dados");
  return data as SimuladoResposta;
}
