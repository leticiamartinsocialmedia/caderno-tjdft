import { describe, expect, it } from "vitest";
import { contem, partesGrifo } from "./grifo";

describe("grifo com ==", () => {
  it("separa trechos grifados", () => {
    expect(partesGrifo("O prazo é de ==15 dias== úteis")).toEqual([
      { texto: "O prazo é de ", grifado: false },
      { texto: "15 dias", grifado: true },
      { texto: " úteis", grifado: false },
    ]);
  });

  it("aceita vários grifos e ignora == sozinho", () => {
    const partes = partesGrifo("==a== e ==b== mas == não");
    expect(partes.filter((p) => p.grifado).map((p) => p.texto)).toEqual(["a", "b"]);
    expect(partes.at(-1)).toEqual({ texto: " mas == não", grifado: false });
  });

  it("busca sem acento nem maiúscula", () => {
    expect(contem("Remoção é diferente", "remocao")).toBe(true);
    expect(contem(null, "x")).toBe(false);
  });
});
