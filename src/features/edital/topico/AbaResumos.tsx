"use client";

import { useState } from "react";
import { NotebookText, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { TextoGrifado } from "@/lib/grifo";
import { dataSP, formatarData } from "@/lib/datas";
import type { Resumo } from "@/lib/tipos";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";

export function AbaResumos({ topicoId, resumos, aoMudar }: { topicoId: string; resumos: Resumo[]; aoMudar: (lista: Resumo[]) => void }) {
  const { avisar, excluirComDesfazer } = useToast();
  const [modal, setModal] = useState<{ resumo?: Resumo } | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  function excluir(r: Resumo) {
    const copia = resumos;
    excluirComDesfazer({
      texto: "Resumo excluído",
      esconder: () => aoMudar(copia.filter((x) => x.id !== r.id)),
      restaurar: () => aoMudar(copia),
      apagar: async () => {
        const { error } = await supabase().from("resumos").delete().eq("id", r.id);
        if (error) throw error;
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})}>
          Novo resumo
        </Botao>
      </div>
      {resumos.length === 0 ? (
        <EstadoVazio
          icone={NotebookText}
          titulo="Nenhum resumo ainda"
          texto="Resuma a aula ou o PDF com as suas palavras. Use ==assim== para grifar o que mais cai."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {resumos.map((r) => {
            const aberto = abertos.has(r.id);
            const longo = r.texto.length > 600 || r.texto.split("\n").length > 8;
            return (
              <li key={r.id} className="rounded-lg border border-borda-card bg-superficie p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[14.5px] font-extrabold">{r.titulo || "Resumo"}</h3>
                    <p className="tabular text-xs text-texto-2">Atualizado em {formatarData(dataSP(r.updated_at))}</p>
                  </div>
                  <div className="flex shrink-0">
                    <BotaoIcone rotulo="Editar resumo" onClick={() => setModal({ resumo: r })}>
                      <Pencil size={15} />
                    </BotaoIcone>
                    <BotaoIcone rotulo="Excluir resumo" onClick={() => excluir(r)} className="hover:text-erro">
                      <Trash2 size={15} />
                    </BotaoIcone>
                  </div>
                </div>
                <p className={`mt-2 font-serif text-[15.5px] leading-relaxed whitespace-pre-line ${longo && !aberto ? "line-clamp-6" : ""}`}>
                  <TextoGrifado texto={r.texto} />
                </p>
                {longo && (
                  <button
                    type="button"
                    onClick={() => setAbertos((s) => new Set(s.has(r.id) ? [...s].filter((x) => x !== r.id) : [...s, r.id]))}
                    className="mt-2 text-[13px] font-bold text-rosa-texto hover:underline"
                  >
                    {aberto ? "Mostrar menos" : "Ler tudo"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modal && (
        <ModalResumo
          topicoId={topicoId}
          resumo={modal.resumo}
          fechar={() => setModal(null)}
          aoSalvar={(r, novo) => {
            aoMudar(novo ? [r, ...resumos] : resumos.map((x) => (x.id === r.id ? r : x)));
            setModal(null);
            avisar({ texto: novo ? "Resumo guardado" : "Resumo atualizado" });
          }}
        />
      )}
    </div>
  );
}

function ModalResumo({
  topicoId,
  resumo,
  fechar,
  aoSalvar,
}: {
  topicoId: string;
  resumo?: Resumo;
  fechar: () => void;
  aoSalvar: (r: Resumo, novo: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(resumo?.titulo ?? "");
  const [texto, setTexto] = useState(resumo?.texto ?? "");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    if (!texto.trim()) {
      setErro("Escreva o resumo.");
      return;
    }
    setEnviando(true);
    const registro = { titulo: titulo.trim() || null, texto: texto.trim() };
    const sb = supabase();
    const { data, error } = resumo
      ? await sb.from("resumos").update(registro).eq("id", resumo.id).select().single()
      : await sb.from("resumos").insert({ ...registro, topico_id: topicoId }).select().single();
    setEnviando(false);
    if (error || !data) {
      setErro("Não deu para guardar. Confira se o SQL 0003 foi rodado no Supabase.");
      return;
    }
    aoSalvar(data as Resumo, !resumo);
  }

  return (
    <ModalFormulario titulo={resumo ? "Editar resumo" : "Novo resumo"} fechar={fechar} aoEnviar={salvar} rotuloAcao="Guardar resumo" enviando={enviando} largura="max-w-3xl">
      <Campo id="resumo-titulo" rotulo="Título (opcional)">
        <input id="resumo-titulo" className={estiloInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Resumo da aula 3" maxLength={140} />
      </Campo>
      <Campo id="resumo-texto" rotulo="Resumo" erro={erro} dica="Use ==assim== para grifar.">
        <textarea
          id="resumo-texto"
          rows={14}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setErro("");
          }}
          className="folha w-full resize-y rounded-md border border-borda outline-none focus:border-rosa"
          aria-invalid={Boolean(erro)}
        />
      </Campo>
    </ModalFormulario>
  );
}
