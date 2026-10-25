import { Suspense } from "react";
import { BisusPagina } from "@/features/bisus/BisusPagina";

export const metadata = { title: "Bisus · Caderno TJDFT" };

export default function Pagina() {
  return (
    <Suspense>
      <BisusPagina />
    </Suspense>
  );
}
