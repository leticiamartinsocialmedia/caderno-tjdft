import type { StatusTopico, Topico } from "@/lib/tipos";

export const ORDEM_STATUS: StatusTopico[] = ["nao_visto", "teoria", "questoes", "revisado"];

export const ROTULO_STATUS: Record<StatusTopico, string> = {
  nao_visto: "Não visto",
  teoria: "Teoria",
  questoes: "Questões",
  revisado: "Revisado",
};

/** Um clique avança: Não visto → Teoria → Questões → Revisado → Não visto. */
export function proximoStatus(atual: StatusTopico): StatusTopico {
  return ORDEM_STATUS[(ORDEM_STATUS.indexOf(atual) + 1) % ORDEM_STATUS.length];
}

export type Progresso = { total: number; estudados: number; revisados: number; pctEstudado: number; pctRevisado: number };

/** Estudado = saiu de "Não visto". Revisado = chegou em "Revisado". */
export function calcularProgresso(topicos: Pick<Topico, "status">[]): Progresso {
  const total = topicos.length;
  const estudados = topicos.filter((t) => t.status !== "nao_visto").length;
  const revisados = topicos.filter((t) => t.status === "revisado").length;
  return {
    total,
    estudados,
    revisados,
    pctEstudado: total ? (estudados / total) * 100 : 0,
    pctRevisado: total ? (revisados / total) * 100 : 0,
  };
}

/** Move um item da posição `de` para `para` e devolve a lista com `ordem` renumerada. */
export function reordenar<T extends { id: string; ordem: number }>(lista: T[], de: number, para: number): T[] {
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova.map((x, i) => ({ ...x, ordem: i }));
}

/** Só os itens cuja ordem mudou, para gravar o mínimo no banco. */
export function ordensAlteradas<T extends { id: string; ordem: number }>(antes: T[], depois: T[]) {
  const ordemAntes = new Map(antes.map((x) => [x.id, x.ordem]));
  return depois.filter((x) => ordemAntes.get(x.id) !== x.ordem);
}
