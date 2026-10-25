import type { MotivoErro } from "@/lib/tipos";

export const MOTIVOS: { id: MotivoErro; rotulo: string; dica: string }[] = [
  { id: "nao_sabia", rotulo: "Não sabia o conteúdo", dica: "Volte à teoria e faça uma escrita sobre o tópico." },
  { id: "confundi", rotulo: "Confundi conceitos", dica: "Use a Nomenclatura e o \"Não confundir com\"." },
  { id: "interpretacao", rotulo: "Interpretação", dica: "Leia o comando duas vezes e grife o que a banca pede." },
  { id: "pegadinha", rotulo: "Pegadinha ou desatenção", dica: "Treine lei seca: prazos, \"pode\" × \"deve\" e exceções." },
  { id: "chutei", rotulo: "Chutei", dica: "No Cebraspe, quando há desconto, deixar em branco pode ser melhor que chutar." },
];

export const ROTULO_MOTIVO = Object.fromEntries(MOTIVOS.map((m) => [m.id, m.rotulo])) as Record<MotivoErro, string>;
export const DICA_MOTIVO = Object.fromEntries(MOTIVOS.map((m) => [m.id, m.dica])) as Record<MotivoErro, string>;
