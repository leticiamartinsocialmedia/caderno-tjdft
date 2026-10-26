// Lê o cronograma do Gran copiado da página (Ctrl+A, Ctrl+C) e liga cada aula à matéria do edital.

import { diasEntre } from "@/lib/datas";
import type { TipoAula } from "@/lib/tipos";

export type AulaLida = {
  data: string;
  ordem: number;
  disciplina: string;
  aula: string;
  tipo: TipoAula;
  concluido: boolean;
};

export type Leitura = { aulas: AulaLida[]; avisos: string[] };

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

/** minúsculas, sem acento, espaços simples */
export function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const RE_MES = /^(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/\s*(\d{4})$/;
const RE_DIA = /^(\d{1,2})\s*[-–]\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)/;

function iso(ano: number, mes: number, dia: number) {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return d.toISOString().slice(0, 10);
}

function diaDaSemana(data: string) {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

/** Data mais próxima de `perto` (antes ou depois) em que o dia do mês cai nesse dia da semana. */
function dataMaisProxima(dia: number, semana: number, perto: string): string | null {
  const [a, m] = perto.split("-").map(Number);
  let melhor: string | null = null;
  for (let delta = -12; delta <= 12; delta++) {
    const mesAbs = a * 12 + (m - 1) + delta;
    const data = iso(Math.floor(mesAbs / 12), (mesAbs % 12) + 1, dia);
    if (!data || diaDaSemana(data) !== semana) continue;
    if (!melhor || Math.abs(diasEntre(perto, data)) < Math.abs(diasEntre(perto, melhor))) melhor = data;
  }
  return melhor;
}

function lerTipo(t: string): TipoAula {
  const n = normalizar(t);
  if (n.startsWith("revis")) return "revisao";
  if (n.includes("video")) return "videoaula";
  if (n.includes("pdf") || n.includes("livro") || n.includes("leitura")) return "pdf";
  if (n.includes("quest") || n.includes("exerc") || n.includes("simulado")) return "questoes";
  return "outro";
}

/** "Noções de Direito Penal | 3 - Princípios" → disciplina e aula. */
function separarAula(texto: string) {
  const i = texto.indexOf("|");
  // O Gran às vezes escreve "Nocões": corrige para a mesma disciplina não aparecer duas vezes.
  const disciplina = (i < 0 ? texto : texto.slice(0, i)).trim().replace(/^No[cç][oõ]es\s+de\s+/i, "Noções de ");
  const aula = i < 0 ? "" : texto.slice(i + 1).trim();
  return { disciplina, aula: aula || disciplina };
}

/**
 * Aceita o texto com colunas separadas por tabulação (cópia de tabela no Chrome) ou uma célula por linha
 * (cópia no celular). Sem o cabeçalho "Outubro/2026", o mês é deduzido pelo dia da semana.
 */
export function lerCronogramaGran(texto: string, hoje: string): Leitura {
  const celulas = texto
    .split(/\r?\n/)
    .flatMap((l) => l.split("\t"))
    .map((c) => c.replace(/ /g, " ").trim())
    .filter(Boolean);
  const aulas: AulaLida[] = [];
  const avisos: string[] = [];
  let mes: { ano: number; mes: number } | null = null;
  let ultima = null as string | null;
  const ordemDoDia = new Map<string, number>();
  const vistos = new Set<string>();

  for (let i = 0; i < celulas.length; i++) {
    const n = normalizar(celulas[i]);
    const m = n.match(RE_MES);
    if (m) {
      mes = { ano: Number(m[2]), mes: MESES.indexOf(m[1]) + 1 };
      continue;
    }
    const d = n.match(RE_DIA);
    if (!d) continue;
    // Linha do dia: as próximas células são aula, tipo e concluído.
    const [aulaTxt, tipoTxt, feitoTxt] = celulas.slice(i + 1, i + 4);
    const feito = feitoTxt ? normalizar(feitoTxt) : "";
    if (!aulaTxt || !tipoTxt || (feito !== "sim" && feito !== "nao")) {
      avisos.push(`Não entendi a linha "${celulas.slice(i, i + 4).join(" | ")}".`);
      continue;
    }
    i += 3;
    const dia = Number(d[1]);
    const semana = DIAS.indexOf(d[2]);
    // O cabeçalho "Outubro/2026" manda, em qualquer ordem que os meses venham. Sem cabeçalho (ou se o dia
    // da semana não bate), vale a data mais próxima da linha anterior em que esse dia cai nesse dia da semana.
    const doCabecalho = mes ? iso(mes.ano, mes.mes, dia) : null;
    const data: string | null =
      doCabecalho && diaDaSemana(doCabecalho) === semana
        ? doCabecalho
        : dataMaisProxima(dia, semana, ultima ?? (mes ? iso(mes.ano, mes.mes, 15)! : hoje));
    if (!data) {
      avisos.push(`Não achei a data de "${celulas[i - 3]}".`);
      continue;
    }
    ultima = data;
    const { disciplina, aula } = separarAula(aulaTxt);
    // A mesma aula pode aparecer repetida no dia quando se copia a página em partes.
    const chave = `${data}|${normalizar(disciplina)}|${normalizar(aula)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const ordem = ordemDoDia.get(data) ?? 0;
    ordemDoDia.set(data, ordem + 1);
    aulas.push({ data, ordem, disciplina, aula, tipo: lerTipo(tipoTxt), concluido: feito === "sim" });
  }
  return { aulas, avisos };
}

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "nocoes", "prova", "aplicado", "ao"]);

function palavras(s: string) {
  return new Set(
    normalizar(s)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((p) => p && !PALAVRAS_VAZIAS.has(p)),
  );
}

/** Liga "Noções de Direito Penal" à matéria do edital: nome igual primeiro; depois, palavras em comum sem ambiguidade. */
export function materiaDaDisciplina<M extends { id: string; nome: string }>(disciplina: string, materias: M[]): M | null {
  const alvo = palavras(disciplina);
  if (!alvo.size) return null;
  const iguais = materias.filter((m) => {
    const p = palavras(m.nome);
    return p.size === alvo.size && [...alvo].every((x) => p.has(x));
  });
  if (iguais.length === 1) return iguais[0];
  const contidas = materias.filter((m) => {
    const p = palavras(m.nome);
    const [menor, maior] = p.size <= alvo.size ? [p, alvo] : [alvo, p];
    return menor.size > 0 && [...menor].every((x) => maior.has(x));
  });
  return contidas.length === 1 ? contidas[0] : null;
}

/** "Noções de Direito Processual Civil" → "Processual Civil", para caber no celular. */
export function nomeCurto(disciplina: string) {
  return disciplina
    .replace(/^Noções de\s+/i, "")
    .replace(/^Direito\s+/i, "")
    .replace(/^Administração de Recursos Humanos e Gestão Pública$/i, "RH e Gestão Pública")
    .replace(/\s*\(prova discursiva\)$/i, "");
}
