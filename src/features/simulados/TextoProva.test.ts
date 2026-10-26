import { expect, it } from "vitest";
import { textoSimples } from "./TextoProva";

it("tira as marcas ao copiar, mantendo o sublinhado visível", () => {
  expect(textoSimples("“__Faça-se__ justiça” e __se deseja__")).toBe("“_Faça-se_ justiça” e _se deseja_");
  expect(textoSimples("substituída por **A despeito dos**, como em *cibercrimes*")).toBe("substituída por A despeito dos, como em cibercrimes");
});
