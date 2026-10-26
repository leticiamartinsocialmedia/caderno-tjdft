"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Erro, MotivoErro } from "@/lib/tipos";
import type { MateriaBasica, TopicoBasico } from "@/lib/useEditalBasico";
import { normalizarLink } from "@/features/bisus/fontes";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { SeletorMateriaTopico } from "@/components/ui/SeletorTopico";
import { MOTIVOS } from "./motivos";

const GABARITOS: { id: Erro["gabarito"]; rotulo: string }[] = [
  { id: "certo", rotulo: "Certo" },
  { id: "errado", rotulo: "Errado" },
  { id: "multipla", rotulo: "Múltipla escolha" },
];

export function ModalErro({
  erro,
  materias,
  topicos,
  materiaInicial,
  topicoInicial,
  preenchido,
  fechar,
  aoSalvar,
}: {
  erro?: Erro;
  materias: MateriaBasica[];
  topicos: TopicoBasico[];
  materiaInicial?: string;
  topicoInicial?: string;
  /** Para um erro novo vindo de outra tela (ex.: simulado): já chega com a questão e o gabarito. */
  preenchido?: { assertiva: string; gabarito: Erro["gabarito"]; regra?: string };
  fechar: () => void;
  aoSalvar: (e: Erro, novo: boolean) => void;
}) {
  const [materiaId, setMateriaId] = useState(erro?.materia_id ?? materiaInicial ?? "");
  const [topicoId, setTopicoId] = useState(erro?.topico_id ?? topicoInicial ?? "");
  const [assertiva, setAssertiva] = useState(erro?.assertiva ?? preenchido?.assertiva ?? "");
  const [gabarito, setGabarito] = useState<Erro["gabarito"] | "">(erro?.gabarito ?? preenchido?.gabarito ?? "");
  const [motivo, setMotivo] = useState<MotivoErro | "">(erro?.motivo ?? "");
  const [regra, setRegra] = useState(erro?.regra ?? preenchido?.regra ?? "");
  const [link, setLink] = useState(erro?.link_tec ?? "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    const e: Record<string, string> = {};
    if (!materiaId) e.materia = "Escolha a matéria.";
    if (!assertiva.trim()) e.assertiva = "Cole ou escreva a assertiva que você errou.";
    if (!gabarito) e.gabarito = "Marque o gabarito oficial.";
    if (!motivo) e.motivo = "Por que você errou?";
    const linkOk = normalizarLink(link);
    if (linkOk === null) e.link = "Esse link não parece um endereço.";
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    const registro = {
      materia_id: materiaId,
      topico_id: topicoId || null,
      assertiva: assertiva.trim(),
      gabarito,
      motivo,
      regra: regra.trim() || null,
      link_tec: linkOk || null,
    };
    const sb = supabase();
    const { data, error } = erro
      ? await sb.from("erros").update(registro).eq("id", erro.id).select().single()
      : await sb.from("erros").insert(registro).select().single();
    setEnviando(false);
    if (error || !data) {
      setErros({ geral: "Não deu para guardar. Tente de novo." });
      return;
    }
    aoSalvar(data as Erro, !erro);
  }

  return (
    <ModalFormulario
      titulo={erro ? "Editar erro" : "Adicionar erro"}
      fechar={fechar}
      aoEnviar={salvar}
      rotuloAcao="Guardar erro"
      enviando={enviando}
      largura="max-w-2xl"
    >
      <SeletorMateriaTopico
        prefixo="erro"
        materias={materias}
        topicos={topicos}
        materiaId={materiaId}
        topicoId={topicoId}
        erroMateria={erros.materia}
        aoMudar={(m, t) => {
          setMateriaId(m);
          setTopicoId(t);
        }}
      />
      <Campo id="erro-assertiva" rotulo="Assertiva" erro={erros.assertiva}>
        <textarea
          id="erro-assertiva"
          rows={3}
          className={`${estiloInput} resize-y leading-relaxed`}
          value={assertiva}
          onChange={(e) => setAssertiva(e.target.value)}
          placeholder="Ex.: O servidor nomeado terá 15 dias para tomar posse."
          aria-invalid={Boolean(erros.assertiva)}
        />
      </Campo>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">Gabarito</legend>
        <div className="flex flex-wrap gap-2">
          {GABARITOS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={gabarito === g.id}
              onClick={() => setGabarito(g.id)}
              className={`h-10 rounded-md border px-4 text-[13px] font-bold ${
                gabarito === g.id ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"
              }`}
            >
              {g.rotulo}
            </button>
          ))}
        </div>
        {erros.gabarito && (
          <p className="text-xs font-medium text-erro" role="alert">
            {erros.gabarito}
          </p>
        )}
      </fieldset>
      <Campo id="erro-motivo" rotulo="Motivo do erro" erro={erros.motivo}>
        <select
          id="erro-motivo"
          className={estiloInput}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoErro)}
          aria-invalid={Boolean(erros.motivo)}
        >
          <option value="">Escolha o motivo</option>
          {MOTIVOS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="erro-regra" rotulo="A regra certa, nas minhas palavras">
        <textarea
          id="erro-regra"
          rows={3}
          className={`${estiloInput} resize-y leading-relaxed`}
          value={regra}
          onChange={(e) => setRegra(e.target.value)}
          placeholder="Ex.: A posse é em até 30 dias da publicação do ato de provimento (Lei 8.112, art. 13, § 1º)."
        />
      </Campo>
      <Campo id="erro-link" rotulo="Link do TEC (opcional)" erro={erros.link}>
        <input
          id="erro-link"
          type="url"
          inputMode="url"
          className={estiloInput}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.tecconcursos.com.br/questoes/..."
          aria-invalid={Boolean(erros.link)}
        />
      </Campo>
      {erros.geral && (
        <p className="rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro" role="alert">
          {erros.geral}
        </p>
      )}
    </ModalFormulario>
  );
}
