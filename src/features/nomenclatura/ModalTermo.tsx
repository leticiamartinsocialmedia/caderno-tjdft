"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { contem } from "@/lib/grifo";
import type { Termo } from "@/lib/tipos";
import type { MateriaBasica } from "@/lib/useEditalBasico";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";

/** Grava as ligações "Não confundir com" nas duas direções. */
export async function salvarRelacionados(termoId: string, relacionados: string[]) {
  const sb = supabase();
  const apagar = await sb.from("termos_relacionados").delete().or(`termo_id.eq.${termoId},relacionado_id.eq.${termoId}`);
  if (apagar.error) throw apagar.error;
  if (!relacionados.length) return;
  const linhas = relacionados.flatMap((r) => [
    { termo_id: termoId, relacionado_id: r },
    { termo_id: r, relacionado_id: termoId },
  ]);
  const { error } = await sb.from("termos_relacionados").upsert(linhas, { onConflict: "termo_id,relacionado_id", ignoreDuplicates: true });
  if (error) throw error;
}

export function ModalTermo({
  termo,
  relacionadosAtuais,
  todos,
  materias,
  fechar,
  aoSalvar,
}: {
  termo?: Termo;
  relacionadosAtuais: string[];
  todos: Termo[];
  materias: MateriaBasica[];
  fechar: () => void;
  aoSalvar: (t: Termo, relacionados: string[], novo: boolean) => void;
}) {
  const [nome, setNome] = useState(termo?.termo ?? "");
  const [extenso, setExtenso] = useState(termo?.extenso ?? "");
  const [pratica, setPratica] = useState(termo?.pratica ?? "");
  const [tecnica, setTecnica] = useState(termo?.tecnica ?? "");
  const [materiaIds, setMateriaIds] = useState<string[]>(termo?.materia_ids ?? []);
  const [dispositivo, setDispositivo] = useState(termo?.dispositivo ?? "");
  const [relacionados, setRelacionados] = useState<string[]>(relacionadosAtuais);
  const [buscaRel, setBuscaRel] = useState("");
  const [tags, setTags] = useState((termo?.tags ?? []).join(", "));
  const [status, setStatus] = useState<Termo["status"]>(termo?.status ?? "aprendendo");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const opcoesRel = useMemo(
    () =>
      todos
        .filter((t) => t.id !== termo?.id)
        .filter((t) => relacionados.includes(t.id) || !buscaRel.trim() || contem(t.termo, buscaRel) || contem(t.extenso, buscaRel))
        .sort((a, b) => Number(relacionados.includes(b.id)) - Number(relacionados.includes(a.id)) || a.termo.localeCompare(b.termo, "pt-BR")),
    [todos, termo, relacionados, buscaRel],
  );

  async function salvar() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.termo = "Escreva o termo ou a sigla.";
    else if (todos.some((t) => t.id !== termo?.id && t.termo.trim().toLowerCase() === nome.trim().toLowerCase())) {
      e.termo = "Esse termo já existe no dicionário.";
    }
    if (!pratica.trim() && !tecnica.trim()) e.pratica = "Escreva pelo menos uma das explicações.";
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    const registro = {
      termo: nome.trim(),
      extenso: extenso.trim() || null,
      pratica: pratica.trim() || null,
      tecnica: tecnica.trim() || null,
      materia_ids: materiaIds,
      dispositivo: dispositivo.trim() || null,
      tags: [...new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))],
      status,
    };
    const sb = supabase();
    try {
      const { data, error } = termo
        ? await sb.from("termos").update(registro).eq("id", termo.id).select().single()
        : await sb.from("termos").insert(registro).select().single();
      if (error || !data) throw error;
      await salvarRelacionados((data as Termo).id, relacionados);
      aoSalvar(data as Termo, relacionados, !termo);
    } catch {
      setErros({ geral: "Não deu para guardar. Tente de novo." });
      setEnviando(false);
    }
  }

  const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  return (
    <ModalFormulario
      titulo={termo ? `Editar ${termo.termo}` : "Adicionar termo"}
      fechar={fechar}
      aoEnviar={salvar}
      rotuloAcao="Guardar termo"
      enviando={enviando}
      largura="max-w-2xl"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Campo id="termo-nome" rotulo="Termo ou sigla" erro={erros.termo}>
          <input id="termo-nome" className={estiloInput} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: PAD" aria-invalid={Boolean(erros.termo)} />
        </Campo>
        <Campo id="termo-extenso" rotulo="Por extenso">
          <input id="termo-extenso" className={estiloInput} value={extenso} onChange={(e) => setExtenso(e.target.value)} placeholder="Ex.: Processo Administrativo Disciplinar" />
        </Campo>
      </div>
      <Campo id="termo-pratica" rotulo="Explicação prática" dica="Simples, com um exemplo do dia a dia." erro={erros.pratica}>
        <textarea id="termo-pratica" rows={3} className={`${estiloInput} resize-y leading-relaxed`} value={pratica} onChange={(e) => setPratica(e.target.value)} />
      </Campo>
      <Campo id="termo-tecnica" rotulo="Explicação técnica" dica="Como a prova cobra: termos, prazos, artigos.">
        <textarea id="termo-tecnica" rows={3} className={`${estiloInput} resize-y leading-relaxed`} value={tecnica} onChange={(e) => setTecnica(e.target.value)} />
      </Campo>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Matérias</legend>
        <div className="flex flex-wrap gap-2">
          {materias.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={materiaIds.includes(m.id)}
              onClick={() => setMateriaIds(alternar(materiaIds, m.id))}
              className={`min-h-9 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                materiaIds.includes(m.id) ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"
              }`}
            >
              {m.nome}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="termo-dispositivo" rotulo="Dispositivo legal (opcional)">
          <input id="termo-dispositivo" className={estiloInput} value={dispositivo} onChange={(e) => setDispositivo(e.target.value)} placeholder="Ex.: Lei 8.112/1990, art. 146" />
        </Campo>
        <Campo id="termo-tags" rotulo="Tags (separe por vírgula)">
          <input id="termo-tags" className={estiloInput} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex.: Lei 8.112, disciplinar" />
        </Campo>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">Não confundir com</legend>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-2" />
          <input
            id="termo-busca-rel"
            type="search"
            aria-label="Buscar termo para ligar"
            className={`${estiloInput} pl-9`}
            value={buscaRel}
            onChange={(e) => setBuscaRel(e.target.value)}
            placeholder="Buscar termo"
          />
        </div>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {opcoesRel.slice(0, 40).map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={relacionados.includes(t.id)}
              onClick={() => setRelacionados(alternar(relacionados, t.id))}
              className={`min-h-9 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                relacionados.includes(t.id) ? "border-rosa bg-rosa-suave text-rosa-texto" : "border-borda text-texto-2 hover:bg-hover"
              }`}
            >
              {t.termo}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Status</legend>
        <div className="flex gap-2">
          {(
            [
              ["aprendendo", "Aprendendo"],
              ["ja_sei", "Já sei"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={status === id}
              onClick={() => setStatus(id)}
              className={`h-10 rounded-md border px-4 text-[13px] font-bold ${status === id ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </fieldset>
      {erros.geral && (
        <p className="rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro" role="alert">
          {erros.geral}
        </p>
      )}
    </ModalFormulario>
  );
}
