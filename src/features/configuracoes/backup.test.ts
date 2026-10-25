import { describe, expect, it } from "vitest";
import { lerBackup, paraCsv } from "./backup";

describe("backup", () => {
  it("recusa arquivos que não são do app", () => {
    expect(() => lerBackup("oi")).toThrow(/JSON válido/);
    expect(() => lerBackup('{"app":"outro","dados":{}}')).toThrow(/não é um backup/);
    expect(() => lerBackup('{"app":"caderno-tjdft","versao":1,"dados":{"bisus":"x"}}')).toThrow(/corrompida/);
  });

  it("aceita um backup válido", () => {
    const b = lerBackup('{"app":"caderno-tjdft","versao":1,"exportado_em":"2026-10-25","dados":{"bisus":[{"id":"1"}]}}');
    expect(b.dados.bisus).toHaveLength(1);
  });

  it("gera CSV com ponto e vírgula e aspas quando precisa", () => {
    const csv = paraCsv(
      [
        { titulo: "Texto", valor: (l) => l.texto },
        { titulo: "Tags", valor: (l) => l.tags },
      ],
      [{ texto: 'Prazo de "30 dias"; atenção', tags: ["a", "b"] }],
    );
    expect(csv).toBe('﻿Texto;Tags\r\n"Prazo de ""30 dias""; atenção";a, b');
  });
});
