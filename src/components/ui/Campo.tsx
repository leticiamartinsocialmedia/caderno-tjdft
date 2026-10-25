import type { ReactNode } from "react";

export const estiloInput =
  "w-full rounded-md border border-borda bg-superficie px-3 py-2.5 text-base text-texto sm:py-2 sm:text-sm placeholder:text-texto-2/70 outline-none transition-colors focus:border-rosa aria-[invalid=true]:border-erro";

export function Campo({
  id,
  rotulo,
  erro,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-texto">
        {rotulo}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-xs font-medium text-erro" role="alert">
          {erro}
        </p>
      ) : dica ? (
        <p className="text-xs text-texto-2">{dica}</p>
      ) : null}
    </div>
  );
}
