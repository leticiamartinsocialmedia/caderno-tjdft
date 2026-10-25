import { motivoMaisComum, pctAcerto, somar } from "@/lib/desempenho";
import type { MotivoErro, StatusTopico } from "@/lib/tipos";
import { DICA_MOTIVO, ROTULO_MOTIVO } from "@/features/erros/motivos";

export type Recomendacao = {
  id: string;
  nivel: "alerta" | "atencao" | "ok";
  titulo: string;
  texto: string;
  acao?: "revisar-erros" | "escrita-feynman" | "nova-escrita" | "registrar-sessao" | "flashcards" | "revisoes" | "materiais";
  rotuloAcao?: string;
};

export type DadosDiagnostico = {
  status: StatusTopico;
  sessoes: { minutos: number; questoes: number; acertos: number }[];
  erros: { motivo: MotivoErro; revisado: boolean }[];
  escritas: { dominio: number | null; rascunho: boolean }[];
  termosAprendendo: number;
  revisoesHoje: number;
  materiais: number;
};

/** Mínimo de questões para o % de acerto valer como sinal. */
export const MINIMO_QUESTOES = 10;

/** Diz o que revisar no tópico, do mais urgente para o menos. */
export function diagnosticar(d: DadosDiagnostico): Recomendacao[] {
  const r: Recomendacao[] = [];
  const total = somar(d.sessoes);
  const pct = pctAcerto(total.acertos, total.questoes);
  const pendentes = d.erros.filter((e) => !e.revisado);
  const guardadas = d.escritas.filter((e) => !e.rascunho);

  if (d.revisoesHoje > 0) {
    r.push({
      id: "revisoes",
      nivel: "alerta",
      titulo: d.revisoesHoje === 1 ? "1 revisão deste tópico para hoje" : `${d.revisoesHoje} revisões deste tópico para hoje`,
      texto: "Reescreva de memória antes de olhar o original.",
      acao: "revisoes",
      rotuloAcao: "Revisar agora",
    });
  }

  if (pendentes.length > 0) {
    const principal = motivoMaisComum(pendentes);
    r.push({
      id: "erros",
      nivel: "alerta",
      titulo: pendentes.length === 1 ? "1 erro para revisar" : `${pendentes.length} erros para revisar`,
      texto: principal
        ? `Motivo mais comum: ${ROTULO_MOTIVO[principal.motivo].toLowerCase()}. ${DICA_MOTIVO[principal.motivo]}`
        : "Releia a regra de cada erro.",
      acao: "revisar-erros",
      rotuloAcao: "Pôr os erros na revisão",
    });
  }

  if (pct !== null && total.questoes >= MINIMO_QUESTOES) {
    if (pct < 60) {
      r.push({
        id: "acerto",
        nivel: "alerta",
        titulo: `Acerto baixo: ${Math.round(pct)}% em ${total.questoes} questões`,
        texto: "Volte à teoria antes de fazer mais questões. Uma escrita Feynman mostra onde está a dúvida.",
        acao: "escrita-feynman",
        rotuloAcao: "Escrever (Feynman)",
      });
    } else if (pct < 75) {
      r.push({
        id: "acerto",
        nivel: "atencao",
        titulo: `Acerto em ${Math.round(pct)}%: quase lá`,
        texto: "Faça mais questões deste tópico e anote cada erro no caderno.",
        acao: "registrar-sessao",
        rotuloAcao: "Registrar questões",
      });
    }
  } else if (d.status !== "nao_visto" && total.questoes < MINIMO_QUESTOES) {
    r.push({
      id: "questoes",
      nivel: "atencao",
      titulo: total.questoes === 0 ? "Nenhuma questão registrada" : `Só ${total.questoes} questões registradas`,
      texto: `Resolva pelo menos ${MINIMO_QUESTOES} questões deste tópico e registre a sessão para medir o acerto.`,
      acao: "registrar-sessao",
      rotuloAcao: "Registrar questões",
    });
  }

  if (d.status === "nao_visto") {
    r.push({
      id: "nao-visto",
      nivel: "atencao",
      titulo: "Tópico ainda não estudado",
      texto: d.materiais
        ? "Comece pela aula ou pelo PDF guardados aqui e marque o status como Teoria."
        : "Guarde aqui o link da aula e o PDF do Gran e marque o status como Teoria quando terminar.",
      acao: "materiais",
      rotuloAcao: d.materiais ? "Ver materiais" : "Adicionar material",
    });
  } else if (guardadas.length === 0) {
    r.push({
      id: "escrita",
      nivel: "atencao",
      titulo: "Nenhuma escrita guardada",
      texto: "Escrever com as suas palavras fixa o conteúdo e já agenda as revisões.",
      acao: "nova-escrita",
      rotuloAcao: "Escrever",
    });
  } else {
    const dominios = guardadas.map((e) => e.dominio).filter((x): x is number => x !== null);
    const media = dominios.length ? dominios.reduce((s, x) => s + x, 0) / dominios.length : null;
    if (media !== null && media <= 2) {
      r.push({
        id: "dominio",
        nivel: "atencao",
        titulo: `Domínio baixo nas escritas (${media.toFixed(1).replace(".", ",")} de 5)`,
        texto: "Refaça uma escrita no formato Folha em branco e compare com o material.",
        acao: "nova-escrita",
        rotuloAcao: "Escrever de novo",
      });
    }
  }

  if (d.termosAprendendo > 0) {
    r.push({
      id: "termos",
      nivel: "atencao",
      titulo: d.termosAprendendo === 1 ? "1 termo para treinar" : `${d.termosAprendendo} termos para treinar`,
      texto: "Passe pelos flashcards. Os que você não souber entram na revisão.",
      acao: "flashcards",
      rotuloAcao: "Treinar flashcards",
    });
  }

  if (r.length === 0) {
    r.push({ id: "ok", nivel: "ok", titulo: "Tudo em dia neste tópico", texto: "Siga as revisões programadas e faça questões de vez em quando para manter." });
  }

  const peso = { alerta: 0, atencao: 1, ok: 2 };
  return r.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}
