import { describe, expect, it } from "vitest";
import { assertivasDe, contarPalavras, palavrasDaEscrita, textoCorrido } from "./formatos";

describe("escrita", () => {
  it("conta palavras ignorando espaços extras", () => {
    expect(contarPalavras("  a posse   ocorre\nem 30 dias ", "", null)).toBe(6);
  });

  it("conta só o formato atual mais as lacunas", () => {
    const conteudo = { simples: "um dois", prova: "três", leigo: "não conta aqui" };
    expect(palavrasDaEscrita("pratica_tecnica", conteudo, "quatro cinco")).toBe(5);
  });

  it("sempre devolve 5 assertivas", () => {
    expect(assertivasDe({ assertivas: [{ texto: "x", gabarito: "C", comentario: "" }] })).toHaveLength(5);
  });

  it("monta o texto corrido da banca com gabarito", () => {
    const t = textoCorrido("banca", { assertivas: [{ texto: "A posse ocorre em 30 dias.", gabarito: "C", comentario: "art. 13" }] });
    expect(t).toBe("Assertiva 1 (Certo):\nA posse ocorre em 30 dias.\nComentário: art. 13");
  });
});
