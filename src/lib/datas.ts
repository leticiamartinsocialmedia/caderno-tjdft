// Todas as datas do app seguem o fuso de São Paulo e o formato dd/mm/aaaa.
// Datas "de calendário" circulam como texto ISO (aaaa-mm-dd), sem hora.

export const FUSO = "America/Sao_Paulo";

const partesSP = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje em São Paulo, como aaaa-mm-dd. */
export function hojeSP(agora: Date = new Date()): string {
  return partesSP.format(agora);
}

/** Converte um instante (timestamptz) na data de calendário de São Paulo. */
export function dataSP(instante: string | Date): string {
  return partesSP.format(typeof instante === "string" ? new Date(instante) : instante);
}

function paraUTC(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function somarDias(iso: string, dias: number): string {
  const d = paraUTC(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Dias de `de` até `ate` (positivo se `ate` for depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((paraUTC(ate).getTime() - paraUTC(de).getTime()) / 86_400_000);
}

/** aaaa-mm-dd → dd/mm/aaaa */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** dd/mm/aaaa → aaaa-mm-dd (ou null se inválida). */
export function lerDataBR(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return somarDias(iso, 0) === iso ? iso : null;
}

const nomeDia = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** "seg", "ter"... para rótulos de gráfico. */
export function diaDaSemanaCurto(iso: string): string {
  return nomeDia.format(paraUTC(iso)).replace(".", "");
}

/** Segunda-feira da semana de `iso`. */
export function inicioDaSemana(iso: string): string {
  const dia = paraUTC(iso).getUTCDay(); // 0 = domingo
  return somarDias(iso, dia === 0 ? -6 : 1 - dia);
}

/** "agora", "há 5 s", "há 3 min", "há 2 h", "em dd/mm/aaaa". */
export function haQuanto(instante: Date, agora: Date = new Date()): string {
  const s = Math.max(0, Math.round((agora.getTime() - instante.getTime()) / 1000));
  if (s < 3) return "agora";
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `há ${Math.floor(s / 3600)} h`;
  return `em ${formatarData(dataSP(instante))}`;
}
