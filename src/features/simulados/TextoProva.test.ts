import { expect, it } from "vitest";
import { textoSimples } from "./TextoProva";

it("marca o sublinhado ao copiar", () => {
  expect(textoSimples("“__Faça-se__ justiça” e __se deseja__")).toBe("“_Faça-se_ justiça” e _se deseja_");
});
