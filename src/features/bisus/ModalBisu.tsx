"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Bisu, FonteBisu } from "@/lib/tipos";
import type { MateriaBasica, TopicoBasico } from "@/lib/useEditalBasico";
import { TextoGrifado } from "@/lib/grifo";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { SeletorMateriaTopico } from "@/components/ui/SeletorTopico";
import { useApp } from "@/components/shell/AppContext";
import { FONTES, normalizarLink } from "./fontes";

export function ModalBisu({
  bisu,
  materias,
  topicos,
  professores,
  ultimoProfessor,
  materiaInicial,
  fechar,
  aoSalvar,
}: {
  bisu?: Bisu;
  materias: MateriaBasica[];
  topicos: TopicoBasico[];
  professores: string[];
  ultimoProfessor: string;
  materiaInicial?: string;
  fechar: () => void;
  aoSalvar: (b: Bisu, novo: boolean) => void;
}) {
  const { usuario } = useApp();
  const [materiaId, setMateriaId] = useState(bisu?.materia_id ?? materiaInicial ?? "");
  const [topicoId, setTopicoId] = useState(bisu?.topico_id ?? "");
  const [texto, setTexto] = useState(bisu?.texto ?? "");
  const [professor, setProfessor] = useState(bisu?.professor ?? ultimoProfessor);
  const [fonte, setFonte] = useState<FonteBisu>(bisu?.fonte ?? "videoaula_gran");
  const [link, setLink] = useState(bisu?.link ?? "");
  const [caiMuito, setCaiMuito] = useState(bisu?.cai_muito ?? false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    const e: Record<string, string> = {};
    if (!materiaId) e.materia = "Escolha a matéria.";
    if (!texto.trim()) e.texto = "Escreva o bisu.";
    const linkOk = normalizarLink(link);
    if (linkOk === null) e.link = "Esse link não parece um endereço. Ex.: www.tecconcursos.com.br/...";
    setErros(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    const registro = {
      materia_id: materiaId,
      topico_id: topicoId || null,
      texto: texto.trim(),
      professor: professor.trim() || null,
      fonte,
      link: linkOk || null,
      cai_muito: caiMuito,
    };
    const sb = supabase();
    const { data, error } = bisu
      ? await sb.from("bisus").update(registro).eq("id", bisu.id).select().single()
      : await sb.from("bisus").insert(registro).select().single();
    if (error || !data) {
      setEnviando(false);
      setErros({ geral: "Não deu para guardar. Tente de novo." });
      return;
    }
    if (registro.professor) {
      // O app lembra o último professor para o próximo bisu.
      await sb.from("configuracoes").update({ ultimo_professor: registro.professor }).eq("user_id", usuario.id);
    }
    setEnviando(false);
    aoSalvar(data as Bisu, !bisu);
  }

  return (
    <ModalFormulario
      titulo={bisu ? "Editar bisu" : "Adicionar bisu"}
      fechar={fechar}
      aoEnviar={salvar}
      rotuloAcao="Guardar bisu"
      enviando={enviando}
      largura="max-w-2xl"
    >
      <SeletorMateriaTopico
        prefixo="bisu"
        materias={materias}
        topicos={topicos}
        materiaId={materiaId}
        topicoId={topicoId}
        erroMateria={erros.materia}
        aoMudar={(m, t) => {
          setMateriaId(m);
          setTopicoId(t);
          setErros((x) => ({ ...x, materia: "" }));
        }}
      />

      <Campo id="bisu-texto" rotulo="Bisu" erro={erros.texto} dica="Use ==assim== para grifar um trecho em amarelo.">
        <textarea
          id="bisu-texto"
          rows={4}
          className={`${estiloInput} resize-y leading-relaxed`}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setErros((x) => ({ ...x, texto: "" }));
          }}
          placeholder="Ex.: Na Lei 8.112, a posse ocorre em até ==30 dias== da publicação do ato de provimento."
          aria-invalid={Boolean(erros.texto)}
        />
      </Campo>
      {texto.includes("==") && (
        <div className="rounded-md bg-hover px-3 py-2.5 text-[13.5px] leading-relaxed">
          <span className="mb-1 block text-[11px] font-bold tracking-wide text-texto-2 uppercase">Assim vai ficar</span>
          <TextoGrifado texto={texto} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="bisu-professor" rotulo="Professor">
          <input
            id="bisu-professor"
            list="lista-professores"
            className={estiloInput}
            value={professor}
            onChange={(e) => setProfessor(e.target.value)}
            placeholder="Ex.: Prof. Herbert Almeida"
          />
          <datalist id="lista-professores">
            {professores.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Campo>
        <Campo id="bisu-fonte" rotulo="Onde ouvi">
          <select id="bisu-fonte" className={estiloInput} value={fonte} onChange={(e) => setFonte(e.target.value as FonteBisu)}>
            {FONTES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo id="bisu-link" rotulo="Link (opcional)" erro={erros.link}>
        <input
          id="bisu-link"
          type="url"
          inputMode="url"
          className={estiloInput}
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setErros((x) => ({ ...x, link: "" }));
          }}
          placeholder="Link da aula, do PDF ou da questão"
          aria-invalid={Boolean(erros.link)}
        />
      </Campo>

      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-borda px-3 py-2.5">
        <input
          id="bisu-cai-muito"
          type="checkbox"
          checked={caiMuito}
          onChange={(e) => setCaiMuito(e.target.checked)}
          className="h-4 w-4 accent-[#D97706]"
        />
        <Flame size={16} className="text-alerta" />
        <span className="text-[13.5px] font-semibold">Cai muito</span>
        <span className="text-xs text-texto-2">O professor disse que é recorrente na prova</span>
      </label>

      {erros.geral && (
        <p className="rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro" role="alert">
          {erros.geral}
        </p>
      )}
    </ModalFormulario>
  );
}
