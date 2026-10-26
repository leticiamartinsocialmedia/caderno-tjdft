import { TentativaPagina } from "@/features/simulados/TentativaPagina";

export const metadata = { title: "Simulado · Caderno TJDFT" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TentativaPagina id={id} />;
}
