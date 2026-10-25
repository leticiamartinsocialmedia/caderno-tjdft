import type { FonteBisu } from "@/lib/tipos";

export const FONTES: { id: FonteBisu; rotulo: string }[] = [
  { id: "videoaula_gran", rotulo: "Videoaula Gran" },
  { id: "pdf_gran", rotulo: "PDF Gran" },
  { id: "comentario_tec", rotulo: "Comentário TEC" },
  { id: "revisao_live", rotulo: "Revisão ou live" },
  { id: "outro", rotulo: "Outro" },
];

export const ROTULO_FONTE = Object.fromEntries(FONTES.map((f) => [f.id, f.rotulo])) as Record<FonteBisu, string>;

/** Aceita link com ou sem https://. Devolve null se não parecer um endereço. */
export function normalizarLink(texto: string): string | null {
  const t = texto.trim();
  if (!t) return "";
  const comProtocolo = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const url = new URL(comProtocolo);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}
