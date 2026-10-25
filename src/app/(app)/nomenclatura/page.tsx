import { Suspense } from "react";
import { NomenclaturaPagina } from "@/features/nomenclatura/NomenclaturaPagina";

export const metadata = { title: "Nomenclatura · Caderno TJDFT" };

export default function Pagina() {
  return (
    <Suspense>
      <NomenclaturaPagina />
    </Suspense>
  );
}
