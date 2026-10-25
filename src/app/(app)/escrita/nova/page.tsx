import { EditorEscrita } from "@/features/escrita/EditorEscrita";
import { FORMATOS } from "@/features/escrita/formatos";
import type { FormatoEscrita } from "@/lib/tipos";

export const metadata = { title: "Nova escrita · Caderno TJDFT" };

type Busca = { materia?: string; topico?: string; formato?: string };

export default async function Pagina({ searchParams }: { searchParams: Promise<Busca> }) {
  const { materia, topico, formato } = await searchParams;
  const formatoValido = FORMATOS.some((f) => f.id === formato) ? (formato as FormatoEscrita) : undefined;
  return <EditorEscrita id={null} materiaInicial={materia ?? ""} topicoInicial={topico ?? ""} formatoInicial={formatoValido} />;
}
