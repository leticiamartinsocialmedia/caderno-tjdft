import { Suspense } from "react";
import { ErrosPagina } from "@/features/erros/ErrosPagina";

export const metadata = { title: "Caderno de erros · Caderno TJDFT" };

export default function Pagina() {
  return (
    <Suspense>
      <ErrosPagina />
    </Suspense>
  );
}
