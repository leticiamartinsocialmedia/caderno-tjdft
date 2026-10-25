import { Columns2, FileText, Gavel, GraduationCap, ListChecks, type LucideIcon } from "lucide-react";
import type { Assertiva, ConteudoEscrita, FormatoEscrita } from "@/lib/tipos";

export type CampoTexto = { chave: Exclude<keyof ConteudoEscrita, "assertivas">; rotulo: string; dica: string };

export type Formato = {
  id: FormatoEscrita;
  nome: string;
  resumo: string;
  icone: LucideIcon;
  campos: CampoTexto[];
};

export const FORMATOS: Formato[] = [
  {
    id: "pratica_tecnica",
    nome: "Prática + Técnica",
    resumo: "O mesmo assunto do jeito simples e do jeito da prova.",
    icone: Columns2,
    campos: [
      { chave: "simples", rotulo: "Do jeito simples", dica: "Explique com um exemplo do dia a dia." },
      { chave: "prova", rotulo: "Do jeito da prova", dica: "Use os termos técnicos e cite os artigos." },
    ],
  },
  {
    id: "feynman",
    nome: "Feynman",
    resumo: "Explique para um leigo e descubra onde trava.",
    icone: GraduationCap,
    campos: [
      { chave: "leigo", rotulo: "Explique para um leigo", dica: "Como se fosse para alguém da sua família que nunca estudou Direito." },
      { chave: "travei", rotulo: "Onde travei", dica: "Em que ponto a explicação ficou confusa ou você não soube continuar?" },
      { chave: "corrigi", rotulo: "O que corrigi no material", dica: "Volte à aula ou ao PDF e anote o que estava faltando ou errado." },
      { chave: "final", rotulo: "Versão final curta, com uma analogia", dica: "Poucas linhas. Uma comparação que ajude a lembrar." },
    ],
  },
  {
    id: "folha_branca",
    nome: "Folha em branco",
    resumo: "10 minutos escrevendo tudo o que lembra, sem consultar.",
    icone: FileText,
    campos: [
      { chave: "texto", rotulo: "Tudo o que eu lembro", dica: "Sem olhar o material. Escreva até o tempo acabar." },
      { chave: "conferi", rotulo: "Conferi no material", dica: "Depois do tempo: o que você esqueceu ou errou?" },
    ],
  },
  {
    id: "lei_seca",
    nome: "Lei seca nas minhas palavras",
    resumo: "O artigo, a sua paráfrase e como a banca pode trocar.",
    icone: Gavel,
    campos: [
      { chave: "dispositivo", rotulo: "Dispositivo", dica: "Cole ou escreva o artigo, com número e lei. Ex.: Lei 8.112, art. 13, § 1º." },
      { chave: "parafrase", rotulo: "Paráfrase", dica: "O mesmo artigo com as suas palavras." },
      { chave: "troca", rotulo: "Como a banca pode trocar", dica: "Prazo, quórum, \"pode\" × \"deve\", exceções. Ex.: trocar 30 dias por 15." },
    ],
  },
  {
    id: "banca",
    nome: "Banca por um dia",
    resumo: "Você escreve 5 assertivas Certo ou Errado e comenta o gabarito.",
    icone: ListChecks,
    campos: [],
  },
];

export const FORMATO_POR_ID = Object.fromEntries(FORMATOS.map((f) => [f.id, f])) as Record<FormatoEscrita, Formato>;

export const ASSERTIVAS_VAZIAS: Assertiva[] = Array.from({ length: 5 }, () => ({ texto: "", gabarito: "", comentario: "" }));

export function assertivasDe(conteudo: ConteudoEscrita): Assertiva[] {
  const lista = conteudo.assertivas ?? [];
  return ASSERTIVAS_VAZIAS.map((vazia, i) => ({ ...vazia, ...lista[i] }));
}

/** Os textos do formato atual, na ordem em que aparecem. */
export function textosDoFormato(formato: FormatoEscrita, conteudo: ConteudoEscrita): { rotulo: string; texto: string }[] {
  if (formato === "banca") {
    return assertivasDe(conteudo).flatMap((a, i) =>
      a.texto.trim() || a.comentario.trim()
        ? [
            {
              rotulo: `Assertiva ${i + 1}${a.gabarito ? ` (${a.gabarito === "C" ? "Certo" : "Errado"})` : ""}`,
              texto: [a.texto.trim(), a.comentario.trim() && `Comentário: ${a.comentario.trim()}`].filter(Boolean).join("\n"),
            },
          ]
        : [],
    );
  }
  return FORMATO_POR_ID[formato].campos.map((c) => ({ rotulo: c.rotulo, texto: (conteudo[c.chave] ?? "").trim() })).filter((x) => x.texto);
}

export function contarPalavras(...textos: (string | null | undefined)[]): number {
  return textos.reduce((total, t) => total + (t?.trim() ? t.trim().split(/\s+/u).length : 0), 0);
}

export function palavrasDaEscrita(formato: FormatoEscrita, conteudo: ConteudoEscrita, lacunas: string | null) {
  return contarPalavras(...textosDoFormato(formato, conteudo).map((x) => x.texto), lacunas);
}

/** Texto corrido da escrita: usado na revisão, na busca e na correção por IA. */
export function textoCorrido(formato: FormatoEscrita, conteudo: ConteudoEscrita) {
  return textosDoFormato(formato, conteudo)
    .map((x) => `${x.rotulo}:\n${x.texto}`)
    .join("\n\n");
}
