import { Construction } from "lucide-react";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { EstadoVazio } from "@/components/ui/Estados";

export const metadata = { title: "Métodos · Caderno TJDFT" };

export default function Pagina() {
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Métodos" />
      <EstadoVazio icone={Construction} titulo="Em construção" texto="Esta seção chega na etapa 9." />
    </div>
  );
}
