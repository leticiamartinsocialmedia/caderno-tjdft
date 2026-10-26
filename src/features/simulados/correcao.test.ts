import { describe, expect, it } from "vitest";
import { formatarRelogio, placar, placarPor, situacaoDa } from "./correcao";

describe("situacaoDa", () => {
  it("compara com o gabarito e trata anulada e branco", () => {
    expect(situacaoDa({ gabarito: "B", anulada: false }, "B")).toBe("certa");
    expect(situacaoDa({ gabarito: "B", anulada: false }, "C")).toBe("errada");
    expect(situacaoDa({ gabarito: "CERTO", anulada: false }, null)).toBe("branco");
    expect(situacaoDa({ gabarito: "A", anulada: true }, "C")).toBe("anulada");
  });
});

describe("placar", () => {
  const itens = [{ situacao: "certa" }, { situacao: "certa" }, { situacao: "errada" }, { situacao: "branco" }, { situacao: "anulada" }] as const;

  it("FGV: nota é o número de acertos, com a anulada valendo ponto", () => {
    expect(placar([...itens], false)).toMatchObject({ total: 5, certas: 2, erradas: 1, brancos: 1, anuladas: 1, nota: 3, pct: 60 });
  });

  it("Cebraspe: cada erro anula um acerto", () => {
    expect(placar([...itens], true)).toMatchObject({ nota: 2, pct: 40 });
    expect(placar([{ situacao: "errada" }, { situacao: "errada" }], true).nota).toBe(-2);
  });

  it("separa por grupo na ordem da prova", () => {
    const r = placarPor(
      [
        { situacao: "certa" as const, m: "Português" },
        { situacao: "errada" as const, m: "Penal" },
        { situacao: "certa" as const, m: "Português" },
      ],
      (i) => i.m,
      false,
    );
    expect(r.map((g) => [g.nome, g.certas, g.total])).toEqual([
      ["Português", 2, 2],
      ["Penal", 0, 1],
    ]);
  });
});

it("formatarRelogio", () => {
  expect(formatarRelogio(65)).toBe("1:05");
  expect(formatarRelogio(3 * 3600 + 4 * 60 + 9)).toBe("3:04:09");
});
