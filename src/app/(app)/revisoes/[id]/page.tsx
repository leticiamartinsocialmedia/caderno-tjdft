import { RevisaoAtiva } from "@/features/revisoes/RevisaoAtiva";

export const metadata = { title: "Revisão · Caderno TJDFT" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RevisaoAtiva key={id} id={id} />;
}
