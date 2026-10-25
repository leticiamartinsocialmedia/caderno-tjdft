"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { hojeSP } from "@/lib/datas";
import { pctAcerto, formatarPct } from "@/lib/desempenho";
import type { Atividade, Sessao } from "@/lib/tipos";
import type { MateriaBasica, TopicoBasico } from "@/lib/useEditalBasico";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { SeletorMateriaTopico } from "@/components/ui/SeletorTopico";
import { ATIVIDADES, validarSessao, type ErrosSessao } from "./atividades";

export function ModalSessao({
  sessao,
  minutosIniciais,
  materias,
  topicos,
  materiaInicial,
  topicoInicial,
  fechar,
  aoSalvar,
}: {
  sessao?: Sessao;
  minutosIniciais?: number;
  materias: MateriaBasica[];
  topicos: TopicoBasico[];
  materiaInicial?: string;
  topicoInicial?: string;
  fechar: () => void;
  aoSalvar: (s: Sessao, nova: boolean) => void;
}) {
  const [data, setData] = useState(sessao?.data ?? hojeSP());
  const [materiaId, setMateriaId] = useState(sessao?.materia_id ?? materiaInicial ?? "");
  const [topicoId, setTopicoId] = useState(sessao?.topico_id ?? topicoInicial ?? "");
  const [atividade, setAtividade] = useState<Atividade>(sessao?.atividade ?? "questoes_tec");
  const [minutos, setMinutos] = useState(String(sessao?.minutos ?? minutosIniciais ?? ""));
  const [questoes, setQuestoes] = useState(sessao?.questoes ? String(sessao.questoes) : "");
  const [acertos, setAcertos] = useState(sessao?.acertos ? String(sessao.acertos) : "");
  const [observacao, setObservacao] = useState(sessao?.observacao ?? "");
  const [erros, setErros] = useState<ErrosSessao>({});
  const [enviando, setEnviando] = useState(false);

  const q = Number(questoes) || 0;
  const a = Number(acertos) || 0;
  const previa = q > 0 && a <= q ? formatarPct(pctAcerto(a, q)) : null;

  async function salvar() {
    const e = validarSessao({ data, minutos, questoes, acertos });
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    const registro = {
      data,
      materia_id: materiaId || null,
      topico_id: topicoId || null,
      atividade,
      minutos: Number(minutos) || 0,
      questoes: Number(questoes) || 0,
      acertos: Number(acertos) || 0,
      observacao: observacao.trim() || null,
    };
    const sb = supabase();
    const { data: salvo, error } = sessao
      ? await sb.from("sessoes").update(registro).eq("id", sessao.id).select().single()
      : await sb.from("sessoes").insert(registro).select().single();
    setEnviando(false);
    if (error || !salvo) {
      setErros({ geral: "Não deu para guardar. Tente de novo." });
      return;
    }
    aoSalvar(salvo as Sessao, !sessao);
  }

  const numero = (id: string, rotulo: string, valor: string, mudar: (v: string) => void, erro?: string, dica?: string) => (
    <Campo id={id} rotulo={rotulo} erro={erro} dica={dica}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        className={`${estiloInput} tabular`}
        value={valor}
        onChange={(e) => {
          mudar(e.target.value);
          setErros({});
        }}
        aria-invalid={Boolean(erro)}
      />
    </Campo>
  );

  return (
    <ModalFormulario
      titulo={sessao ? "Editar sessão" : "Registrar sessão"}
      fechar={fechar}
      aoEnviar={salvar}
      rotuloAcao="Guardar sessão"
      enviando={enviando}
      largura="max-w-xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="sessao-data" rotulo="Data" erro={erros.data}>
          <input id="sessao-data" type="date" className={estiloInput} value={data} max={hojeSP()} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo id="sessao-atividade" rotulo="Atividade">
          <select id="sessao-atividade" className={estiloInput} value={atividade} onChange={(e) => setAtividade(e.target.value as Atividade)}>
            {ATIVIDADES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <SeletorMateriaTopico
        prefixo="sessao"
        materias={materias}
        topicos={topicos}
        materiaId={materiaId}
        topicoId={topicoId}
        materiaObrigatoria={false}
        aoMudar={(m, t) => {
          setMateriaId(m);
          setTopicoId(t);
        }}
      />
      <div className="grid grid-cols-3 gap-3">
        {numero("sessao-minutos", "Minutos", minutos, setMinutos, erros.minutos)}
        {numero("sessao-questoes", "Questões", questoes, setQuestoes, erros.questoes)}
        {numero("sessao-acertos", "Acertos", acertos, setAcertos, erros.acertos, previa ? `${previa} de acerto` : undefined)}
      </div>
      <Campo id="sessao-obs" rotulo="Observação (opcional)">
        <textarea
          id="sessao-obs"
          rows={2}
          className={`${estiloInput} resize-y`}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: errei muito prazo da posse"
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
