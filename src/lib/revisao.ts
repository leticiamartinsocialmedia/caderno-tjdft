import { somarDias } from "./datas";
import type { Avaliacao } from "./tipos";

/** Intervalos da revisão espaçada, em dias: 1, 7, 30 e 90. */
export const INTERVALOS = [1, 7, 30, 90] as const;
export const NIVEL_MAXIMO = INTERVALOS.length - 1;

export const ROTULO_AVALIACAO: Record<Avaliacao, string> = {
  esqueci: "Esqueci",
  parcial: "Lembrei uma parte",
  bem: "Lembrei bem",
};

/** Primeira revisão: amanhã (nível 0 = intervalo de 1 dia). */
export function primeiraRevisao(hoje: string) {
  return { nivel: 0, proxima_data: somarDias(hoje, INTERVALOS[0]) };
}

/**
 * Próximo passo depois de revisar:
 * - "Esqueci" volta ao começo (1 dia);
 * - "Lembrei uma parte" repete o intervalo atual;
 * - "Lembrei bem" avança para o próximo intervalo (para em 90 dias).
 */
export function avaliar(nivel: number, avaliacao: Avaliacao, hoje: string) {
  const atual = Math.min(Math.max(0, nivel), NIVEL_MAXIMO);
  const novo = avaliacao === "esqueci" ? 0 : avaliacao === "parcial" ? atual : Math.min(atual + 1, NIVEL_MAXIMO);
  return { nivel: novo, proxima_data: somarDias(hoje, INTERVALOS[novo]), ultima_data: hoje };
}

/** "1 dia", "7 dias"... */
export function rotuloIntervalo(nivel: number) {
  const dias = INTERVALOS[Math.min(Math.max(0, nivel), NIVEL_MAXIMO)];
  return dias === 1 ? "1 dia" : `${dias} dias`;
}
