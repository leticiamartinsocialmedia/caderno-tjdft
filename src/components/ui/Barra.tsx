export function BarraProgresso({ valor, cor = "rosa", rotulo }: { valor: number; cor?: "rosa" | "verde" | "texto"; rotulo?: string }) {
  const corBarra = { rosa: "bg-rosa", verde: "bg-sucesso", texto: "bg-texto" }[cor];
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-hover"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
    >
      <div className={`h-full rounded-full ${corBarra} transition-[width]`} style={{ width: `${pct}%` }} />
    </div>
  );
}
