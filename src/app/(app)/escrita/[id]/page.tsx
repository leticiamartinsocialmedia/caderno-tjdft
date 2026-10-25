import { EditorEscrita } from "@/features/escrita/EditorEscrita";

export const metadata = { title: "Escrita · Caderno TJDFT" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorEscrita key={id} id={id} />;
}
