import { TopicoPagina } from "@/features/edital/topico/TopicoPagina";

export const metadata = { title: "Tópico · Caderno TJDFT" };

export default async function Pagina({ params }: { params: Promise<{ topico: string }> }) {
  const { topico } = await params;
  return <TopicoPagina id={topico} />;
}
