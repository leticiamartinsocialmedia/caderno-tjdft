import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

const estilos: Record<Variante, string> = {
  primario: "bg-rosa text-white hover:brightness-95 border border-rosa",
  secundario: "bg-superficie text-texto border border-borda hover:bg-hover",
  fantasma: "text-texto-2 hover:bg-hover hover:text-texto border border-transparent",
  perigo: "bg-erro text-white border border-erro hover:brightness-95",
};

export function Botao({
  variante = "secundario",
  icone,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icone?: ReactNode }) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 sm:h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3.5 text-[13px] font-bold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${estilos[variante]} ${className}`}
      {...props}
    >
      {icone}
      {children}
    </button>
  );
}

export function BotaoIcone({
  rotulo,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={`inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-md text-texto-2 transition hover:bg-hover hover:text-texto ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
