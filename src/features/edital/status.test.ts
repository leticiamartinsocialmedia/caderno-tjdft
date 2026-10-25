import { describe, expect, it } from "vitest";
import { calcularProgresso, ordensAlteradas, proximoStatus, reordenar } from "./status";

describe("status do tópico", () => {
  it("avança em ciclo com um clique", () => {
    expect(proximoStatus("nao_visto")).toBe("teoria");
    expect(proximoStatus("teoria")).toBe("questoes");
    expect(proximoStatus("questoes")).toBe("revisado");
    expect(proximoStatus("revisado")).toBe("nao_visto");
  });
});

describe("progresso do edital", () => {
  it("conta estudado e revisado", () => {
    const p = calcularProgresso([
      { status: "nao_visto" },
      { status: "teoria" },
      { status: "questoes" },
      { status: "revisado" },
    ]);
    expect(p).toMatchObject({ total: 4, estudados: 3, revisados: 1, pctEstudado: 75, pctRevisado: 25 });
  });

  it("matéria sem tópicos fica em 0%", () => {
    expect(calcularProgresso([]).pctEstudado).toBe(0);
  });
});

describe("reordenar", () => {
  const lista = ["a", "b", "c", "d"].map((id, ordem) => ({ id, ordem }));

  it("move e renumera", () => {
    const nova = reordenar(lista, 0, 2);
    expect(nova.map((x) => x.id)).toEqual(["b", "c", "a", "d"]);
    expect(nova.map((x) => x.ordem)).toEqual([0, 1, 2, 3]);
  });

  it("grava só o que mudou", () => {
    const nova = reordenar(lista, 0, 2);
    expect(ordensAlteradas(lista, nova).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});
