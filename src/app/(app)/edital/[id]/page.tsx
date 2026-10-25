import { MateriaPagina } from "@/features/edital/MateriaPagina";

export const metadata = { title: "Edital · Caderno TJDFT" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MateriaPagina id={id} />;
}
